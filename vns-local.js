/* Shared GitHub API transport for every Studio page.
 * Reads the Personal Access Token saved by GitHub Manager and applies it to
 * every api.github.com request, including direct fetch() calls.
 */
(()=>{'use strict';
const originalFetch=window.fetch.bind(window);
const PREFIX='vn.github.shared.get.v1:',TTL=15000,pending=new Map();
function token(){try{return localStorage.getItem('vnGitHubTokenV1')||''}catch(_){return ''}}
function clear(){try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith(PREFIX))localStorage.removeItem(k)}}catch(_){}pending.clear()}
function keyFor(url){const u=new URL(url);return PREFIX+btoa(unescape(encodeURIComponent(u.toString()))).replace(/=+$/,'')}
function read(key){try{const x=JSON.parse(localStorage.getItem(key)||'null');return x&&x.at&&x.data!==undefined?x:null}catch(_){return null}}
function write(key,data){try{localStorage.setItem(key,JSON.stringify({at:Date.now(),data}))}catch(_){}}
window.fetch=async function(input,init){
 let url;try{url=new URL(typeof input==='string'?input:input.url,location.href)}catch(_){return originalFetch(input,init)}
 if(url.hostname!=='api.github.com')return originalFetch(input,init);
 // Explicit no-store reads must bypass both the persistent cache and in-flight deduplication.
 if(String((init&&init.cache)||(input&&input.cache)||'').toLowerCase()==='no-store'){
  const headers=new Headers((init&&init.headers)||(input&&input.headers)||{}),pat=token();
  if(pat)headers.set('Authorization','Bearer '+pat);
  headers.set('Accept',headers.get('Accept')||'application/vnd.github+json');
  headers.set('X-GitHub-Api-Version',headers.get('X-GitHub-Api-Version')||'2022-11-28');
  return originalFetch(input,{...(init||{}),cache:'no-store',headers});
 }
 const method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
 const headers=new Headers((init&&init.headers)||(input&&input.headers)||{});
 const pat=token();if(pat)headers.set('Authorization','Bearer '+pat);
 headers.set('Accept',headers.get('Accept')||'application/vnd.github+json');
 headers.set('X-GitHub-Api-Version',headers.get('X-GitHub-Api-Version')||'2022-11-28');
 const opts={...(init||{}),headers};
 if(method!=='GET'){const response=await originalFetch(input,opts);clear();return response}
 const key=keyFor(url.toString()),cached=read(key);
 if(cached&&Date.now()-cached.at<TTL)return new Response(JSON.stringify(cached.data),{status:200,headers:{'Content-Type':'application/json'}});
 if(pending.has(key))return pending.get(key).then(data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}}));
 const task=(async()=>{
  try{
   const response=await originalFetch(input,opts),data=await response.clone().json().catch(()=>null);
   if(response.ok&&data!==null){write(key,data);return data}
   if(cached&&(response.status===403||response.status===429))return cached.data;
   if(!response.ok)throw new Error((data&&data.message)||('GitHub API HTTP '+response.status));
   return data;
  }catch(error){if(cached)return cached.data;throw error}
 })();
 pending.set(key,task);
 try{const data=await task;return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}})}
 finally{if(pending.get(key)===task)pending.delete(key)}
};
const STORY_DB_NAME='vns-story-cache-v1',STORY_STORE='stories';
let storyDbPromise=null;
function openStoryDb(){
 if(storyDbPromise)return storyDbPromise;
 if(!('indexedDB' in window))return Promise.reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
 storyDbPromise=new Promise((resolve,reject)=>{
  const request=indexedDB.open(STORY_DB_NAME,1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORY_STORE))db.createObjectStore(STORY_STORE,{keyPath:'key'})};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Không mở được kho kịch bản cục bộ.'));
  request.onblocked=()=>reject(new Error('Kho lưu kịch bản đang bị khóa bởi tab khác.'));
 });
 return storyDbPromise;
}
function storyRecordKey(owner,repo,path){return String(owner||'')+'/'+String(repo||'')+'/'+String(path||'')}
async function saveStory({owner,repo,path,name,data,commitSha=''}){
 if(!owner||!repo||!path||!data||typeof data!=='object')throw new Error('Thiếu thông tin để lưu kịch bản cục bộ.');
 const db=await openStoryDb(),record={key:storyRecordKey(owner,repo,path),owner,repo,path,name:String(name||path.split('/').at(-1).replace(/\\.json$/i,'')),data,commitSha:String(commitSha||''),updatedAt:new Date().toISOString()};
 await new Promise((resolve,reject)=>{const tx=db.transaction(STORY_STORE,'readwrite');tx.objectStore(STORY_STORE).put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Không ghi được kịch bản vào IndexedDB.'));tx.onabort=()=>reject(tx.error||new Error('Lưu kịch bản cục bộ bị hủy.'))});
 return record;
}
async function getStory({owner,repo,path}){
 const db=await openStoryDb();
 return new Promise((resolve,reject)=>{const request=db.transaction(STORY_STORE,'readonly').objectStore(STORY_STORE).get(storyRecordKey(owner,repo,path));request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error||new Error('Không đọc được kịch bản cục bộ.'))});
}
async function listStories({owner,repo}){
 const db=await openStoryDb();
 return new Promise((resolve,reject)=>{const request=db.transaction(STORY_STORE,'readonly').objectStore(STORY_STORE).getAll();request.onsuccess=()=>resolve((request.result||[]).filter(item=>item.owner===owner&&item.repo===repo).sort((a,b)=>String(a.name).localeCompare(String(b.name),'vi')));request.onerror=()=>reject(request.error||new Error('Không đọc được danh sách kịch bản cục bộ.'))});
}
window.VNSLocal={enabled:false,fetch:originalFetch,clearTreeCache:clear,clearApiCache:clear,saveStory,getStory,listStories};
})();