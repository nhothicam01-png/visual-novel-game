/* Shared GitHub API transport for every Studio page.
 * Reads the Personal Access Token saved by GitHub Manager and applies it to
 * every api.github.com request, including direct fetch() calls.
 */
(()=>{'use strict';
const originalFetch=window.fetch.bind(window);
const PREFIX='vn.github.shared.get.v1:',TTL=180000,pending=new Map();
function token(){try{return localStorage.getItem('vnGitHubTokenV1')||''}catch(_){return ''}}
function clear(){try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith(PREFIX))localStorage.removeItem(k)}}catch(_){}pending.clear()}
function keyFor(url){const u=new URL(url);u.searchParams.delete('v');u.searchParams.delete('_');return PREFIX+btoa(unescape(encodeURIComponent(u.toString()))).replace(/=+$/,'')}
function read(key){try{const x=JSON.parse(localStorage.getItem(key)||'null');return x&&x.at&&x.data!==undefined?x:null}catch(_){return null}}
function write(key,data){try{localStorage.setItem(key,JSON.stringify({at:Date.now(),data}))}catch(_){}}
window.fetch=async function(input,init){
 let url;try{url=new URL(typeof input==='string'?input:input.url,location.href)}catch(_){return originalFetch(input,init)}
 if(url.hostname!=='api.github.com')return originalFetch(input,init);
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
window.VNSLocal={enabled:false,fetch:originalFetch,clearTreeCache:clear,clearApiCache:clear};
})();