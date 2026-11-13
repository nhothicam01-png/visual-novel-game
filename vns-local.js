(function(){
'use strict';
const LOCAL=location.hostname==='localhost'||location.hostname==='127.0.0.1';
const originalFetch=window.fetch.bind(window);
const TREE_KEY='vns.github.tree.cache.v1',TREE_TTL=120000;
function cachedTree(){try{return JSON.parse(localStorage.getItem(TREE_KEY)||'null')}catch(_){return null}}
function saveTree(data){try{localStorage.setItem(TREE_KEY,JSON.stringify({at:Date.now(),data}))}catch(_){}}
function localPathFromRaw(url){const marker='/main/';const i=url.pathname.indexOf(marker);return i<0?null:url.pathname.slice(i+marker.length).split('/').map(decodeURIComponent).join('/')}
window.fetch=function(input,init){
 let url;try{url=new URL(typeof input==='string'?input:input.url,location.href)}catch(_){return originalFetch(input,init)}
 const method=(init&&init.method)||(input&&input.method)||'GET';
 if(LOCAL&&url.hostname==='raw.githubusercontent.com'){
  const p=localPathFromRaw(url);if(p!==null)return originalFetch('/'+p+url.search,init);
 }
 if(url.hostname==='api.github.com'&&/\/git\/trees\/[^/]+$/.test(url.pathname)&&url.searchParams.get('recursive')==='1'&&method==='GET'){
  if(LOCAL)return originalFetch('/__local__/tree');
  const old=cachedTree();if(old&&Date.now()-old.at<TREE_TTL)return Promise.resolve(new Response(JSON.stringify(old.data),{status:200,headers:{'Content-Type':'application/json'}}));
  return originalFetch(input,init).then(async response=>{if(response.ok){try{saveTree(await response.clone().json())}catch(_){}}else if(old&&old.data)return new Response(JSON.stringify(old.data),{status:200,headers:{'Content-Type':'application/json','X-VNS-Cache':'stale'}});return response}).catch(error=>{if(old&&old.data)return new Response(JSON.stringify(old.data),{status:200,headers:{'Content-Type':'application/json','X-VNS-Cache':'offline'}});throw error});
 }
 if(LOCAL&&url.hostname==='api.github.com'&&url.pathname.includes('/contents/')){
  const marker='/contents/',i=url.pathname.indexOf(marker),p=decodeURIComponent(url.pathname.slice(i+marker.length));
  return originalFetch('/__local__/contents/'+p+url.search,init);
 }
 return originalFetch(input,init);
};
window.VNSLocal={enabled:LOCAL,fetch:originalFetch,clearTreeCache(){try{localStorage.removeItem(TREE_KEY)}catch(_){}},async status(){if(!LOCAL)return {local:false};return originalFetch('/__local__/status').then(r=>r.json())}};
})();