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
  const localBlobs=new Map();let localBlobId=0;
  function getToken(){try{return localStorage.getItem(TOKEN_KEY)||''}catch(e){return ''}}
  function setToken(token){if(!token)throw new Error('Token trống.');localStorage.setItem(TOKEN_KEY,String(token).trim())}
  function clearToken(){localStorage.removeItem(TOKEN_KEY)}
  function getConfig(){try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')}catch(e){return {}}}
  function setConfig(config){localStorage.setItem(CONFIG_KEY,JSON.stringify(config||{}))}
  const isLocal=()=>location.hostname==='localhost'||location.hostname==='127.0.0.1';
  async function writeLocal(path,blob){const response=await fetch('/__local__/write?path='+encodeURIComponent(path),{method:'PUT',body:blob});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Không ghi được file cục bộ.');return {commitSha:'LOCAL',htmlUrl:'/'+path,path,created:false,local:true};}
  async function request(url,options={}){
    const token=getToken();if(!token)throw new Error('Chưa lưu GitHub Token. Mở github_manager.html để kết nối.');
    const response=await fetch(url,{...options,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token,...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const message=data.message||('GitHub API HTTP '+response.status);if(response.status===401)throw new Error('Token không hợp lệ hoặc đã hết hạn.');if(response.status===403)throw new Error('GitHub từ chối quyền. Kiểm tra quyền Contents: Read and write và quyền truy cập repository.');throw new Error(message)}
    return data;
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
    if(isLocal())return writeLocal(path,new Blob([content],{type:'text/plain;charset=utf-8'}));
    if(!owner||!repo||!path||typeof content!=='string')throw new Error('Thiếu owner, repository, đường dẫn hoặc nội dung file.');
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
    return putContentWithRetry({url,path,bytes:new TextEncoder().encode(content),message,branch});
  }
  async function pushFile({owner,repo,path,file,message,branch='main'}){
    if(isLocal())return writeLocal(path,file);
    if(!(file instanceof File))throw new Error('File không hợp lệ.');
    const buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer);
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
    return putContentWithRetry({url,path,bytes,message,branch});
  }

  async function listCharacterFolders({owner,repo,branch='main'}){
    if(isLocal()){const r=await fetch('/__local__/tree');const d=await r.json();return [...new Set((d.tree||[]).filter(x=>x.path.startsWith('assets/NhanVat/')&&x.path.split('/').length>2).map(x=>x.path.split('/')[2]))].sort((a,b)=>a.localeCompare(b,'vi'))}
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/assets/NhanVat?ref='+encodeURIComponent(branch);
    try{const rows=await request(url);return rows.filter(x=>x.type==='dir').map(x=>x.name).sort((a,b)=>a.localeCompare(b,'vi'))}
    catch(e){if(String(e.message).includes('Not Found'))return [];throw e}
  }
  async function listCharacterWebm({owner,repo,character,branch='main'}){
    if(isLocal()){const r=await fetch('/__local__/tree');const d=await r.json(),prefix='assets/NhanVat/'+String(character||'').trim()+'/';return (d.tree||[]).filter(x=>x.path.startsWith(prefix)&&x.path.slice(prefix.length).indexOf('/')<0&&/\.webm$/i.test(x.path)).map(x=>({name:x.path.split('/').pop(),path:x.path,size:x.size||0,downloadUrl:'/'+x.path,htmlUrl:'/'+x.path})).sort((a,b)=>a.name.localeCompare(b.name,'vi'))}
    const safe=String(character||'').trim();
    if(!safe) return [];
    const path='assets/NhanVat/'+safe;
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(branch);
    const rows=await request(url);
    return rows.filter(x=>x.type==='file'&&/\.webm$/i.test(x.name)).map(x=>({name:x.name,path:x.path,size:x.size||0,downloadUrl:x.download_url||'',htmlUrl:x.html_url||''})).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  }
  async function pushFiles({owner,repo,files,message,branch='main'}){
    if(isLocal()){if(!Array.isArray(files)||!files.length)throw new Error('Không có file để lưu.');const results=[];for(const item of files){if(!item?.path||!(item.blob instanceof Blob))throw new Error('File không hợp lệ.');results.push(await writeLocal(item.path,item.blob));}return {commitSha:'LOCAL',fileCount:results.length,local:true}}
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
    if(isLocal()){const sha='local:'+String(++localBlobId);localBlobs.set(sha,String(content));return {sha}}
    if(typeof content!=='string')throw new Error('Nội dung blob không hợp lệ.');
    const bytes=new TextEncoder().encode(content);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return request(API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/git/blobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:btoa(binary),encoding:'base64'})});
  }
  async function applyTreeChanges({owner,repo,branch='main',changes,message}){
    if(isLocal()){
      if(!Array.isArray(changes)||!changes.length)throw new Error('Không có thay đổi cục bộ.');
      const deletes=changes.filter(x=>x.sha===null),adds=changes.filter(x=>x.sha!==null);
      const used=new Set();
      for(const item of adds){
        let blob;
        if(String(item.sha).startsWith('local:')){if(!localBlobs.has(item.sha))throw new Error('Không tìm thấy dữ liệu tạm cho '+item.path);blob=new Blob([localBlobs.get(item.sha)]);localBlobs.delete(item.sha)}
        else{
          const byName=deletes.find(x=>!used.has(x.path)&&x.path.split('/').pop()===item.path.split('/').pop());
          if(!byName)throw new Error('Không xác định được file nguồn để đổi tên: '+item.path);
          used.add(byName.path);const response=await fetch('/'+byName.path);if(!response.ok)throw new Error('Không đọc được file nguồn '+byName.path);blob=await response.blob();
        }
        await writeLocal(item.path,blob);
      }
      for(const item of deletes)if(!used.has(item.path)){const r=await fetch('/__local__/delete?path='+encodeURIComponent(item.path),{method:'DELETE'});if(!r.ok)throw new Error('Không xóa được '+item.path)}
      return {commitSha:'LOCAL',fileCount:changes.length,local:true};
    }
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

  async function checkConnection(){if(isLocal()){const r=await fetch('/__local__/status');const d=await r.json();return {login:'local',name:d.git?'Local · Git '+d.branch:'Local · chưa có Git',local:true}}const user=await request(API+'/user');return {login:user.login,name:user.name||user.login}}
  window.GitHubManager={getToken,setToken,clearToken,getConfig,setConfig,pushTextFile,pushFile,listCharacterFolders,listCharacterWebm,pushFiles,createBlob,applyTreeChanges,checkConnection};
})();