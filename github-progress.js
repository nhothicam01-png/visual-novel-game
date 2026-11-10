(()=>{'use strict';
if(window.__vnsGithubProgressInstalled)return;window.__vnsGithubProgressInstalled=true;
const css=`
#vns-github-progress{position:fixed;left:12px;right:12px;top:12px;z-index:2147483000;max-width:560px;margin:0 auto;padding:12px 14px;background:#101a2df5;border:1px solid #53658a;border-radius:12px;box-shadow:0 12px 38px #0008;color:#eef2ff;font:13px/1.45 system-ui,Segoe UI,sans-serif;display:none;backdrop-filter:blur(12px)}
#vns-github-progress.show{display:block}
#vns-github-progress .vns-gp-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:7px}
#vns-github-progress .vns-gp-title{font-weight:750}
#vns-github-progress .vns-gp-percent{font-variant-numeric:tabular-nums;color:#c4b5fd;font-weight:800}
#vns-github-progress .vns-gp-track{height:9px;background:#26354e;border-radius:99px;overflow:hidden}
#vns-github-progress .vns-gp-fill{height:100%;width:0;background:linear-gradient(90deg,#7167e8,#b18af5,#64d9e8);border-radius:99px;transition:width .22s ease}
#vns-github-progress .vns-gp-meta{margin-top:6px;color:#aebbd0;font-size:11px}
#vns-github-progress.done .vns-gp-fill{background:linear-gradient(90deg,#22c55e,#6ee7b7)}
#vns-github-progress.error .vns-gp-fill{background:#fb7185}
@media(max-width:600px){#vns-github-progress{left:8px;right:8px;top:8px;padding:10px 12px}}
`;
const style=document.createElement('style');style.textContent=css;(document.head||document.documentElement).appendChild(style);
const box=document.createElement('div');box.id='vns-github-progress';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
box.innerHTML='<div class="vns-gp-head"><span class="vns-gp-title"></span><span class="vns-gp-percent">0%</span></div><div class="vns-gp-track"><div class="vns-gp-fill"></div></div><div class="vns-gp-meta"></div>';
(document.body||document.documentElement).appendChild(box);
const title=box.querySelector('.vns-gp-title'),percent=box.querySelector('.vns-gp-percent'),fill=box.querySelector('.vns-gp-fill'),meta=box.querySelector('.vns-gp-meta');
let active=0,done=0,failed=0,mode='',hideTimer=null,peak=0;
function set(p,label,detail,state){peak=Math.max(peak,p);fill.style.width=peak+'%';percent.textContent=Math.round(peak)+'%';title.textContent=label;meta.textContent=detail;box.classList.add('show');box.classList.toggle('done',state==='done');box.classList.toggle('error',state==='error')}
function tracked(url){try{const u=new URL(url,location.href);return u.origin===location.origin||u.hostname==='api.github.com'||u.hostname==='raw.githubusercontent.com'||u.hostname==='github.com'}catch{return false}}
function start(method){clearTimeout(hideTimer);if(active===0&&box.classList.contains('done')){done=0;failed=0;peak=0;mode=''}if(!mode)mode=(method==='GET'||method==='HEAD')?'download':'upload';else if(mode!==((method==='GET'||method==='HEAD')?'download':'upload'))mode='sync';active++;const label=mode==='download'?'Đang tải dữ liệu từ GitHub về website':mode==='upload'?'Đang gửi dữ liệu từ website lên GitHub':'Đang đồng bộ dữ liệu với GitHub';set(Math.max(peak,Math.min(90,8+done*7)),label,'Đang xử lý '+active+' yêu cầu · Hoàn tất '+done+' yêu cầu');}
function finish(error){active=Math.max(0,active-1);done++;if(error)failed++;if(active>0){const p=Math.min(94,8+done*86/(done+active+2));const label=mode==='download'?'Đang tải dữ liệu từ GitHub về website':mode==='upload'?'Đang gửi dữ liệu từ website lên GitHub':'Đang đồng bộ dữ liệu với GitHub';set(p,label,'Đang xử lý '+active+' yêu cầu · Hoàn tất '+done+' yêu cầu'+(failed?' · Có '+failed+' lỗi kết nối':''));return}
const label=failed?'Hoàn tất một phần · Có lỗi kết nối':mode==='download'?'Đã tải dữ liệu về website':mode==='upload'?'Đã gửi dữ liệu lên GitHub':'Đã đồng bộ GitHub';
set(100,label,failed?('Có '+failed+' yêu cầu mạng thất bại. Hãy kiểm tra thông báo của trang.'):'Đã xử lý '+done+' yêu cầu thành công.','done');if(failed)box.classList.add('error');
hideTimer=setTimeout(()=>{box.classList.remove('show','done','error');active=0;done=0;failed=0;mode='';peak=0},1600)}
const originalFetch=window.fetch.bind(window);
window.fetch=function(input,init){const url=typeof input==='string'?input:input&&input.url||'',method=String(init&&init.method||input&&input.method||'GET').toUpperCase();if(!tracked(url))return originalFetch(input,init);start(method);let result;try{result=originalFetch(input,init)}catch(e){finish(true);throw e}return result.then(response=>{finish(false);return response},error=>{finish(true);throw error})};
window.StudioProgress={show(label,detail){clearTimeout(hideTimer);peak=0;set(5,label||'Đang xử lý GitHub…',detail||'Đang bắt đầu','')},update(value,label,detail){set(Math.max(0,Math.min(99,Number(value)||0)),label||title.textContent,detail||meta.textContent,'')},complete(label){set(100,label||'Hoàn tất', 'Đã hoàn thành.','done');hideTimer=setTimeout(()=>box.classList.remove('show','done','error'),1600)},fail(label,detail){set(100,label||'Có lỗi',detail||'Vui lòng thử lại.','error');hideTimer=setTimeout(()=>box.classList.remove('show','done','error'),3500)}};
})();