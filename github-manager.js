/* Shared GitHub browser helper for Visual Novel Studio.
 * Token is stored in localStorage on this GitHub Pages origin.
 * Security note: any script running on this origin can read it. Keep the token
 * fine-grained, repository-scoped, and Contents: Read and write only.
 */
(function(){
  'use strict';
  const TOKEN_KEY='vnGitHubTokenV1';
  const CONFIG_KEY='vnGitHubConfigV1';
  const API='https://api.github.com';
  function getToken(){try{return localStorage.getItem(TOKEN_KEY)||''}catch(e){return ''}}
  function setToken(token){if(!token)throw new Error('Token trống.');localStorage.setItem(TOKEN_KEY,String(token).trim());clearApiCache()}
  function clearToken(){localStorage.removeItem(TOKEN_KEY);clearApiCache()}
  function getConfig(){try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')}catch(e){return {}}}
  function setConfig(config){localStorage.setItem(CONFIG_KEY,JSON.stringify(config||{}))}
  const API_CACHE_PREFIX='vn.github.api.get.v2:',API_CACHE_TTL=180000;
  const apiPending=new Map();
  function readApiCache(key){try{const v=JSON.parse(localStorage.getItem(API_CACHE_PREFIX+key)||'null');return v&&v.at&&v.data!==undefined?v:null}catch(_){return null}}
  function writeApiCache(key,data){try{localStorage.setItem(API_CACHE_PREFIX+key,JSON.stringify({at:Date.now(),data}))}catch(_){}}
  function clearApiCache(){try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith(API_CACHE_PREFIX))localStorage.removeItem(k)}}catch(_){}apiPending.clear()}
  async function request(url,options={}){
    const token=getToken();if(!token)throw new Error('Chưa lưu GitHub Token. Mở github_manager.html để kết nối.');
    const method=String(options.method||'GET').toUpperCase(),cacheable=method==='GET'&&!/\/git\/(?:blobs|commits)\//.test(url);
    const key=cacheable?btoa(unescape(encodeURIComponent(url))).replace(/=+$/,''): '';
    const cached=cacheable?readApiCache(key):null;
    if(cacheable){if(cached&&Date.now()-cached.at<API_CACHE_TTL)return cached.data;if(apiPending.has(key))return apiPending.get(key)}
    const task=(async()=>{
      const response=await fetch(url,{...options,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token,...(options.headers||{})}});
      const data=await response.json().catch(()=>({}));
      if(response.ok&&method!=='GET'){clearApiCache();if(window.VNSLocal)window.VNSLocal.clearTreeCache()}
      if(!response.ok){if(cacheable&&cached&&(response.status===403||response.status===429))return cached.data;const message=data.message||('GitHub API HTTP '+response.status);if(response.status===401)throw new Error('Token không hợp lệ hoặc đã hết hạn.');if(response.status===403||response.status===429)throw new Error('GitHub từ chối yêu cầu hoặc đã chạm giới hạn API. Hãy chờ reset limit rồi thử lại.');throw new Error(message)}
      if(cacheable)writeApiCache(key,data);
      return data;
    })();
    if(cacheable)apiPending.set(key,task);
    try{return await task}finally{if(cacheable&&apiPending.get(key)===task)apiPending.delete(key)}
  }
  async function putContentWithRetry({url,path,bytes,message,branch}){
    let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    for(let attempt=0;attempt<3;attempt++){
      let sha;
      try{const existing=await request(url+'?ref='+encodeURIComponent(branch)+'&_='+Date.now());sha=existing.sha}
      catch(e){if(!String(e.message).includes('Not Found'))throw e}
      const body={message:message||('Update '+path),content:btoa(binary),branch};if(sha)body.sha=sha;
      try{
        const result=await request(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        return {commitSha:result.commit?.sha||'',htmlUrl:result.content?.html_url||'',path:result.content?.path||path,created:!sha};
      }catch(e){
        if(attempt<2&&/does not match/i.test(String(e.message)))continue;
        throw e;
      }
    }
    throw new Error('File liên tục thay đổi trên GitHub. Hãy thử cập nhật lại sau.');
  }
  async function pushTextFile({owner,repo,path,content,message,branch='main'}){
    if(!owner||!repo||!path||typeof content!=='string')throw new Error('Thiếu owner, repository, đường dẫn hoặc nội dung file.');
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
    return putContentWithRetry({url,path,bytes:new TextEncoder().encode(content),message,branch});
  }
  async function pushFile({owner,repo,path,file,message,branch='main'}){
    if(!(file instanceof File))throw new Error('File không hợp lệ.');
    const buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer);
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
    return putContentWithRetry({url,path,bytes,message,branch});
  }

  async function listCharacterFolders({owner,repo,branch='main'}){
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/git/trees/'+encodeURIComponent(branch)+'?recursive=1';
    const data=await request(url);const prefix='assets/NhanVat/';
    return [...new Set((data.tree||[]).filter(x=>x.type==='blob'&&x.path.startsWith(prefix)).map(x=>x.path.slice(prefix.length).split('/')[0]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
  }
  async function listCharacterWebm({owner,repo,character,branch='main'}){
    const safe=String(character||'').trim();
    if(!safe) return [];
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/git/trees/'+encodeURIComponent(branch)+'?recursive=1';
    const data=await request(url),prefix='assets/NhanVat/'+safe+'/';
    return (data.tree||[]).filter(x=>x.type==='blob'&&x.path.startsWith(prefix)&&x.path.slice(prefix.length).indexOf('/')<0&&/\.webm$/i.test(x.path)).map(x=>({name:x.path.slice(prefix.length),path:x.path,size:x.size||0,downloadUrl:'https://raw.githubusercontent.com/'+owner+'/'+repo+'/'+branch+'/'+x.path.split('/').map(encodeURIComponent).join('/'),htmlUrl:'https://github.com/'+owner+'/'+repo+'/blob/'+branch+'/'+x.path})).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  }
  async function pushFiles({owner,repo,files,message,branch='main'}){
    if(!Array.isArray(files)||!files.length)throw new Error('Không có file để push.');
    const base=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo);
    const ref=await request(base+'/git/ref/heads/'+encodeURIComponent(branch));
    const parentSha=ref.object.sha;
    const parent=await request(base+'/git/commits/'+parentSha);
    const tree=[];
    for(let i=0;i<files.length;i++){
      const item=files[i];if(!item?.path||!(item.blob instanceof Blob))throw new Error('File thứ '+(i+1)+' không hợp lệ.');
      if(item.blob.size>90*1024*1024)throw new Error('File '+item.path+' vượt giới hạn an toàn 90 MB.');
      const bytes=new Uint8Array(await item.blob.arrayBuffer());let binary='';for(let j=0;j<bytes.length;j+=0x8000)binary+=String.fromCharCode(...bytes.subarray(j,j+0x8000));
      const blob=await request(base+'/git/blobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:btoa(binary),encoding:'base64'})});
      tree.push({path:item.path,mode:'100644',type:'blob',sha:blob.sha});
    }
    const newTree=await request(base+'/git/trees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:parent.tree.sha,tree})});
    const commit=await request(base+'/git/commits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:message||'Upload files',tree:newTree.sha,parents:[parentSha]})});
    await request(base+'/git/refs/heads/'+encodeURIComponent(branch),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:commit.sha,force:false})});
    return {commitSha:commit.sha,htmlUrl:'https://github.com/'+owner+'/'+repo+'/commit/'+commit.sha,fileCount:files.length};
  }

  async function createBlob({owner,repo,content}){
    if(typeof content!=='string')throw new Error('Nội dung blob không hợp lệ.');
    const bytes=new TextEncoder().encode(content);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return request(API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/git/blobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:btoa(binary),encoding:'base64'})});
  }
  async function applyTreeChanges({owner,repo,branch='main',changes,message}){
    if(!Array.isArray(changes)||!changes.length)throw new Error('Không có thay đổi GitHub.');
    const base=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo);
    const ref=await request(base+'/git/ref/heads/'+encodeURIComponent(branch));
    const parentSha=ref.object.sha;
    const parent=await request(base+'/git/commits/'+parentSha);
    const seen=new Set();
    const tree=changes.map(item=>{
      if(!item?.path||seen.has(item.path))throw new Error('Đường dẫn thay đổi bị trùng hoặc không hợp lệ: '+(item?.path||''));
      seen.add(item.path);
      return {path:item.path,mode:item.mode||'100644',type:'blob',sha:item.sha===null?null:item.sha};
    });
    const nextTree=await request(base+'/git/trees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:parent.tree.sha,tree})});
    const commit=await request(base+'/git/commits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:message||'Manage story world',tree:nextTree.sha,parents:[parentSha]})});
    await request(base+'/git/refs/heads/'+encodeURIComponent(branch),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:commit.sha,force:false})});
    return {commitSha:commit.sha,fileCount:changes.length};
  }

  async function checkConnection(){const user=await request(API+'/user');return {login:user.login,name:user.name||user.login}}
  window.GitHubManager={getToken,setToken,clearToken,getConfig,setConfig,clearApiCache,pushTextFile,pushFile,listCharacterFolders,listCharacterWebm,pushFiles,createBlob,applyTreeChanges,checkConnection};
})();