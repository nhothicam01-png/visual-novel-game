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
  async function checkConnection(){const user=await request(API+'/user');return {login:user.login,name:user.name||user.login}}
  window.GitHubManager={getToken,setToken,clearToken,getConfig,setConfig,pushTextFile,pushFile,checkConnection};
})();