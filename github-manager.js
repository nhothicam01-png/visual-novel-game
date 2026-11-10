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
  function setToken(token){if(!token)throw new Error('Token trống.');localStorage.setItem(TOKEN_KEY,String(token).trim())}
  function clearToken(){localStorage.removeItem(TOKEN_KEY)}
  function getConfig(){try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')}catch(e){return {}}}
  function setConfig(config){localStorage.setItem(CONFIG_KEY,JSON.stringify(config||{}))}
  async function request(url,options={}){
    const token=getToken();if(!token)throw new Error('Chưa lưu GitHub Token. Mở github_manager.html để kết nối.');
    const response=await fetch(url,{...options,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token,...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const message=data.message||('GitHub API HTTP '+response.status);if(response.status===401)throw new Error('Token không hợp lệ hoặc đã hết hạn.');if(response.status===403)throw new Error('GitHub từ chối quyền. Kiểm tra quyền Contents: Read and write và quyền truy cập repository.');throw new Error(message)}
    return data;
  }
  async function pushTextFile({owner,repo,path,content,message,branch='main'}){
    if(!owner||!repo||!path||typeof content!=='string')throw new Error('Thiếu owner, repository, đường dẫn hoặc nội dung file.');
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
    let sha;
    try{const existing=await request(url+'?ref='+encodeURIComponent(branch));sha=existing.sha}catch(e){if(!String(e.message).includes('Not Found'))throw e}
    const bytes=new TextEncoder().encode(content);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    const body={message:message||('Update '+path),content:btoa(binary),branch};if(sha)body.sha=sha;
    const result=await request(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {commitSha:result.commit?.sha||'',htmlUrl:result.content?.html_url||'',path:result.content?.path||path,created:!sha};
  }
  async function pushFile({owner,repo,path,file,message,branch='main'}){
    if(!(file instanceof File))throw new Error('File không hợp lệ.');
    const buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
    let sha;try{const existing=await request(url+'?ref='+encodeURIComponent(branch));sha=existing.sha}catch(e){if(!String(e.message).includes('Not Found'))throw e}
    const body={message:message||('Upload '+path),content:btoa(binary),branch};if(sha)body.sha=sha;
    const result=await request(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {commitSha:result.commit?.sha||'',htmlUrl:result.content?.html_url||'',path:result.content?.path||path,created:!sha};
  }

  async function listCharacterFolders({owner,repo,branch='main'}){
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/assets/NhanVat?ref='+encodeURIComponent(branch);
    try{const rows=await request(url);return rows.filter(x=>x.type==='dir').map(x=>x.name).sort((a,b)=>a.localeCompare(b,'vi'))}
    catch(e){if(String(e.message).includes('Not Found'))return [];throw e}
  }
  async function listCharacterWebm({owner,repo,character,branch='main'}){
    const safe=String(character||'').trim();
    if(!safe) return [];
    const path='assets/NhanVat/'+safe;
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(branch);
    const rows=await request(url);
    return rows.filter(x=>x.type==='file'&&/\\.webm$/i.test(x.name)).map(x=>({name:x.name,path:x.path,size:x.size||0,downloadUrl:x.download_url||'',htmlUrl:x.html_url||''})).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
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

  async function checkConnection(){const user=await request(API+'/user');return {login:user.login,name:user.name||user.login}}
  window.GitHubManager={getToken,setToken,clearToken,getConfig,setConfig,pushTextFile,pushFile,listCharacterFolders,listCharacterWebm,pushFiles,checkConnection};
})();