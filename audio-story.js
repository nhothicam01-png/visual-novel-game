(()=>{'use strict';
const $=id=>document.getElementById(id);
if(!$('story-workflow'))return;
const REPO='nhothicam01-png/visual-novel-game',RAW='https://raw.githubusercontent.com/'+REPO+'/main/';
let controller=null,busy=false,activeWorld=null,worldPaths=[];
function say(t){$('creative-status').textContent=t}
function progress(p,ind){$('creative-progress').classList.remove('hidden');$('creative-progress').classList.toggle('indeterminate',!!ind);$('creative-progress-fill').style.width=ind?'35%':Math.max(0,Math.min(100,p))+'%'}
function lock(v){busy=v;['analyze-source','create-treatment','generate-story-json'].forEach(id=>$(id).disabled=v);$('cancel-creative').disabled=!v}
function key(){return $('api-key').value.trim()||localStorage.getItem('subtitleGeminiApiKey')||''}
function model(){return $('model')?.value||'gemini-2.5-flash'}
function slug(s){return String(s||'DuAnMoi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').replace(/[^a-zA-Z0-9]+/g,' ').trim().split(/\s+/).map(x=>x[0]?.toUpperCase()+x.slice(1)).join('')||'DuAnMoi'}
function parse(t){return JSON.parse(String(t).replace(/\x60{3}(?:json)?/gi,'').trim())}
function download(name,text,mime){const a=document.createElement('a'),u=URL.createObjectURL(new Blob(['\ufeff'+text],{type:mime||'text/plain;charset=utf-8'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000)}
async function ask(prompt,opt={}){
 if(!key())throw Error('Chưa nhập Gemini API Key.');
 const signal=opt.signal||controller?.signal;
 const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model())+':generateContent?key='+encodeURIComponent(key()),{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:opt.temperature??.3,maxOutputTokens:opt.max||12000,...(opt.json?{responseMimeType:'application/json'}:{})}})});
 const d=await res.json().catch(()=>({}));if(!res.ok)throw Error(d.error?.message||'Gemini API HTTP '+res.status);
 const c=d.candidates?.[0],txt=(c?.content?.parts||[]).filter(x=>x.text&&!x.thought).map(x=>x.text).join('\n').trim();
 if(!txt)throw Error('Gemini không trả nội dung ('+(c?.finishReason||'unknown')+').');
 if(c?.finishReason==='MAX_TOKENS')throw Error('Đầu ra đã chạm giới hạn token. Hãy rút gọn treatment hoặc chia nhỏ nội dung.');
 return txt;
}
function chunks(text,max=9500){
 const paras=String(text).replace(/\r/g,'').split(/\n\s*\n/);let out=[],buf='';
 for(let p of paras){p=p.trim();if(!p)continue;while(p.length>max){if(buf){out.push(buf);buf=''}let n=p.lastIndexOf(' ',max);if(n<max*.55)n=max;out.push(p.slice(0,n));p=p.slice(n).trim()}if(buf&&buf.length+p.length+2>max){out.push(buf);buf=p}else buf=buf?buf+'\n\n'+p:p}
 if(buf)out.push(buf);return out;
}
async function mergeNotes(notes){
 let level=notes;
 while(level.length>1){
  const next=[];
  for(let i=0;i<level.length;i+=5){const batch=level.slice(i,i+5);next.push(await ask('合併以下按原文順序排列的分析筆記，輸出越完整越好。保留所有重要事件、因果鏈、人物、關係、動機、伏筆、已知與未知，不要創作新情節。若有矛盾請標明。\n\n'+batch.map((x,j)=>'筆記'+(i+j+1)+'：\n'+x).join('\n\n'),{max:10000,temperature:.15}));}
  level=next;
 }
 return level[0];
}
async function loadWorlds(){
 const sel=$('existing-world');sel.innerHTML='<option value="">Đang tải danh sách…</option>';
 const r=await fetch('https://api.github.com/repos/'+REPO+'/git/trees/main?recursive=1');const d=await r.json();if(!r.ok)throw Error(d.message||'Không đọc được GitHub.');
 worldPaths=(d.tree||[]).filter(x=>x.type==='blob'&&/^assets\/TheGioi\/[^/]+\/TheGioi\.json$/.test(x.path));
 sel.innerHTML='<option value="">— Chọn thế giới —</option>';
 worldPaths.forEach(x=>{const o=document.createElement('option');o.value=x.path;o.textContent=x.path.split('/')[2];sel.append(o)});
 if(!worldPaths.length)sel.innerHTML='<option value="">Chưa có thế giới đã lưu</option>';
}
async function selectedWorld(){
 if($('creation-mode').value==='new')return null;
 const path=$('existing-world').value;if(!path)throw Error('Hãy chọn thế giới muốn sử dụng.');
 const r=await fetch(RAW+path,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Không tải được hồ sơ thế giới.');
 const w=await r.json();if(!w.world_name||!w.slug)throw Error('Hồ sơ thế giới thiếu tên hoặc slug.');return w;
}
$('creation-mode').addEventListener('change',()=>{$('existing-world-box').classList.toggle('hidden',$('creation-mode').value!=='existing');$('world-json-label').classList.toggle('hidden',$('creation-mode').value==='existing');if($('creation-mode').value==='existing')loadWorlds().catch(e=>say(e.message))});
$('reload-world-list').onclick=()=>loadWorlds().catch(e=>say(e.message));
$('cancel-creative').onclick=()=>controller?.abort();
$('analyze-source').onclick=async()=>{
 const source=$('transcript').value.trim();if(!source){say('Hãy chép lời audio hoặc dán nội dung TXT trước.');return}
 controller=new AbortController();lock(true);progress(0);['analysis-panel','treatment-panel','story-json-panel'].forEach(id=>$(id).classList.add('hidden'));
 try{
  const list=chunks(source);if(!list.length)throw Error('Transcript rỗng.');
  const notes=[];
  for(let i=0;i<list.length;i++){
   say('Đang phân tích phần '+(i+1)+'/'+list.length+'…');
   notes.push(await ask('Phân tích phần '+(i+1)+'/'+list.length+' của transcript. Viết tiếng Việt, không sáng tác. Ghi: diễn biến theo thứ tự; sự kiện và chuỗi nguyên nhân-hành động-phản ứng-kết quả; nhân vật và động cơ; quan hệ; bối cảnh/thời gian; manh mối/bí mật; chủ đề/cảm xúc; điều chưa rõ. Giữ các chi tiết có thể quan trọng cho chuyển thể.\n\n'+list[i],{max:9000,temperature:.15}));
   progress((i+1)/list.length*65);
  }
  say('Đang tổng hợp '+notes.length+' bản phân tích thành hồ sơ nguồn…');
  $('source-analysis').value=await mergeNotes(notes);
  $('analysis-panel').classList.remove('hidden');progress(100);say('✓ Phân tích xong '+list.length+' phần. Hãy đọc/sửa hồ sơ rồi sáng tác.');
  $('analysis-panel').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){say(e.message)}finally{lock(false);controller=null}
};
$('download-analysis').onclick=()=>download('ho-so-phan-tich.txt',$('source-analysis').value);
function newWorldPrompt(analysis){
 return 'Bạn là kiến trúc sư thế giới. Từ hồ sơ nguồn, sáng tạo một thế giới hư cấu MỚI, độc lập, giữ tinh thần/chủ đề/xung đột hấp dẫn nhưng không sao chép nguyên xi tên và sự kiện. Trả JSON schema_version 2 gồm: world_name, slug PascalCase không dấu, genre, premise, setting, tone, extra, mode:"manual", places:[{name,description,kind,selected:true}], characters:[{character_id:"char_slug",name,role,personality,relationships,assetFolder:"",selected:true}], rules:[{name,description,selected:true}], events:[{name,description,selected:true}], story_ideas:[{title,description,selected:true}], story_folders:[], updated_at. Tạo 4-8 nhân vật, ID char_ duy nhất. Không gán assetFolder, luôn để chuỗi rỗng. Chỉ trả JSON.\n\nHỒ SƠ NGUỒN:\n'+analysis+'\n\nYÊU CẦU:\n'+$('creative-notes').value;
}
function treatmentPrompt(analysis,world){
 return 'Bạn là biên kịch trưởng. Hãy sáng tác MỘT CÂU CHUYỆN MỚI dựa trên chất liệu hấp dẫn của nguồn. Có thể thay tên, bối cảnh, nhân vật, tình tiết và kết thúc; giữ lại tinh thần, chủ đề, cảm xúc và xung đột hấp dẫn. Không bê nguyên xi. Tạo treatment đầy đủ: logline, chủ đề, nhân vật/mục tiêu/quan hệ, cấu trúc hồi/chương tự nhiên, bản đồ sự kiện theo nhân quả, phân cảnh chi tiết, bước ngoặt, cao trào và kết thúc. Mọi biến cố quan trọng phải có nguyên nhân, quá trình, phản ứng và hệ quả; không nhảy cóc. Đánh dấu cảm hứng từ nguồn và sáng tạo mới. Không áp đặt số tập/phút.\n\nHỒ SƠ NGUỒN:\n'+analysis+'\n\nTHẾ GIỚI:\n'+JSON.stringify(world,null,2)+'\n\nYÊU CẦU:\n'+$('creative-notes').value;
}
$('create-treatment').onclick=async()=>{
 const analysis=$('source-analysis').value.trim();if(!analysis)return say('Hồ sơ phân tích đang trống.');
 controller=new AbortController();lock(true);$('treatment-panel').classList.add('hidden');$('story-json-panel').classList.add('hidden');
 try{
  activeWorld=await selectedWorld();
  if(!activeWorld){
   say('Đang sáng tạo thế giới mới…');const w=parse(await ask(newWorldPrompt(analysis),{json:true,max:14000,temperature:.7}));
   if(w.schema_version!==2||!w.world_name||!Array.isArray(w.characters)||!Array.isArray(w.places))throw Error('JSON thế giới không đúng schema v2.');
   w.slug=slug(w.world_name);w.story_folders=w.story_folders||[];w.updated_at=new Date().toISOString();w.characters.forEach((c,i)=>{if(!c.character_id)c.character_id='char_'+slug(c.name||('nhan_vat_'+(i+1))).toLowerCase();c.assetFolder='';c.selected=true});
   $('world-json').value=JSON.stringify(w,null,2);$('world-json-label').classList.remove('hidden');
  }else{$('world-json').value=JSON.stringify(activeWorld,null,2);$('world-json-label').classList.add('hidden')}
  say('Đang viết treatment và bản đồ sự kiện…');progress(80,true);
  $('treatment').value=await ask(treatmentPrompt(analysis,activeWorld),{max:26000,temperature:.75});
  $('treatment-panel').classList.remove('hidden');$('treatment-panel').scrollIntoView({behavior:'smooth',block:'start'});
  say('✓ Đã tạo thế giới/treatment. Hãy duyệt và sửa treatment trước khi tạo JSON.');
 }catch(e){say(e.message)}finally{lock(false);controller=null}
};
$('download-treatment').onclick=()=>download('treatment.txt',$('treatment').value);\n$('download-world-json').onclick=()=>download((activeWorld?.slug||'TheGioiMoi')+'.json',$('world-json').value,'application/json;charset=utf-8');
async function systemPrompt(){const r=await fetch(RAW+'PROMPT_TAO_KICH_BAN_JSON.txt');if(!r.ok)throw Error('Không tải được prompt schema v3.');return r.text()}
function validateStory(d,w){
 if(!d||d.phien_ban!==3||d.world_id!==w.slug||!d.thiet_lap_chung||!d.nhan_vat||!Array.isArray(d.danh_sach)||!d.danh_sach.length||!d.am_thanh_mac_dinh||typeof d.am_thanh_mac_dinh.nhac_nen!=='string')throw Error('JSON không đúng schema v3 hoặc world_id không khớp.');
 for(const [id,c] of Object.entries(d.nhan_vat)){if(!/^char_[a-z0-9_]{1,120}$/.test(id)||c.character_id!==id||typeof c.assetFolder!=='string'||!c.ten_hien_thi||!c.giong_noi||typeof c.giong_noi.voice_id!=='string')throw Error('Nhân vật sai cấu trúc: '+id);const old=(w.characters||[]).find(x=>x.character_id===id);if(old&&String(old.assetFolder||'')!==String(c.assetFolder||''))throw Error('assetFolder của '+id+' không khớp thế giới.')}
 return true;
}
$('generate-story-json').onclick=async()=>{
 const treatment=$('treatment').value.trim();if(!treatment)return say('Treatment đang trống.');
 controller=new AbortController();lock(true);$('story-json-panel').classList.add('hidden');
 try{
  activeWorld=$('creation-mode').value==='new'?parse($('world-json').value):activeWorld;
  if(!activeWorld?.slug)throw Error('Hồ sơ thế giới không hợp lệ.');
  say('Đang tải quy tắc JSON v3…');const spec=await systemPrompt();
  const prompt='Chuyển treatment thành một JSON hoàn chỉnh schema phiên bản 3 cho Visual Novel Studio. world_id phải chính xác là '+JSON.stringify(activeWorld.slug)+'. Dùng đúng character_id và assetFolder của nhân vật trong thế giới; được thêm nhân vật mới với ID char_ duy nhất và assetFolder:"". Không thay ID nhân vật hiện có. Mỗi nhân vật có ten_hien_thi, character_id, assetFolder, giong_noi:{profile_id:"",lang:"vi-VN",voice_id:""}. expression_id là object ngữ nghĩa, không dùng tên WEBM. Bảo đảm thiet_lap_chung, nhan_vat, danh_sach, am_thanh_mac_dinh:{nhac_nen:""} và mọi trường đúng prompt. Viết các cảnh đầy đủ theo treatment, không tóm tắt. Chỉ trả JSON hợp lệ, không markdown.\n\nPROMPT SCHEMA V3:\n'+spec+'\n\nWORLD JSON:\n'+JSON.stringify(activeWorld,null,2)+'\n\nTREATMENT ĐÃ DUYỆT:\n'+treatment+'\n\nYÊU CẦU THÊM:\n'+$('creative-notes').value;
  say('Gemini đang tạo JSON v3…');progress(85,true);
  const data=parse(await ask(prompt,{json:true,max:65536,temperature:.25}));
  validateStory(data,activeWorld);$('story-json').value=JSON.stringify(data,null,2);
  const title=$('creation-title').value.trim()||data.thiet_lap_chung.ten_truyen||data.thiet_lap_chung.tieu_de||'TruyenMoi';
  $('creation-title').value=title;$('story-folder').value=slug(title);
  $('story-json-panel').classList.remove('hidden');$('story-json-panel').scrollIntoView({behavior:'smooth',block:'start'});say('✓ Đã tạo JSON v3. Hãy kiểm tra trước khi xuất bản.');
 }catch(e){say(e.message)}finally{lock(false);controller=null}
};
$('validate-story-json').onclick=()=>{try{validateStory(parse($('story-json').value),activeWorld);$('publish-creative-status').textContent='✓ JSON v3 hợp lệ ở mức kiểm tra cấu trúc cơ bản.'}catch(e){$('publish-creative-status').textContent='Lỗi: '+e.message}};
$('download-story-json').onclick=()=>download(($('story-folder').value||'KichBanMoi')+'.json',$('story-json').value,'application/json;charset=utf-8');
$('publish-creative').onclick=async()=>{
 try{
  const world=$('creation-mode').value==='new'?parse($('world-json').value):activeWorld;
  const story=parse($('story-json').value);validateStory(story,world);
  world.characters=Array.isArray(world.characters)?world.characters:[];
  for(const [id,person] of Object.entries(story.nhan_vat)){
   const existing=world.characters.find(c=>c.character_id===id);
   if(existing){existing.assetFolder=String(person.assetFolder||'');existing.asset_status=existing.assetFolder?'linked':'missing';existing.name=String(person.ten_hien_thi||existing.name||id);}
   else world.characters.push({character_id:id,name:String(person.ten_hien_thi||id),role:'Nhân vật mới trong kịch bản',personality:'Chưa cập nhật',relationships:'Được đăng ký khi xuất bản kịch bản',assetFolder:String(person.assetFolder||''),selected:true,asset_status:person.assetFolder?'linked':'missing'});
  }
  if(!window.GitHubManager?.pushFiles)throw Error('GitHub Manager chưa sẵn sàng. Bạn vẫn có thể tải JSON về.');
  const title=$('creation-title').value.trim()||'TruyenMoi',folder=slug($('story-folder').value||title),dir='assets/KichBan/'+folder,jp=dir+'/'+folder+'.json',wp='assets/TheGioi/'+world.slug+'/TheGioi.json';
  const check=await fetch('https://api.github.com/repos/'+REPO+'/git/trees/main?recursive=1');const tree=await check.json();if(!check.ok)throw Error('Không kiểm tra được GitHub.');
  if((tree.tree||[]).some(x=>x.path===jp)&&!confirm('Truyện đã tồn tại. Bạn có chắc muốn ghi đè?'))return;
  world.story_folders=world.story_folders||[];if(!world.story_folders.some(x=>x.folder===folder))world.story_folders.push({title,folder,path:dir,json_path:jp});
  world.updated_at=new Date().toISOString();
  const files=[{path:wp,blob:new Blob([JSON.stringify(world,null,2)],{type:'application/json'})},{path:jp,blob:new Blob([JSON.stringify(story,null,2)],{type:'application/json'})},{path:dir+'/PhuDe/.gitkeep',blob:new Blob([''],{type:'text/plain'})},{path:'assets/PhuDe/.gitkeep',blob:new Blob([''],{type:'text/plain'})}];
  $('publish-creative-status').textContent='Đang lưu thế giới và truyện trong một commit…';
  const result=await GitHubManager.pushFiles({owner:'nhothicam01-png',repo:'visual-novel-game',branch:'main',message:'Publish AI story from audio: '+title,files});
  $('publish-creative-status').textContent='✓ Đã lưu. Commit '+result.commitSha;
 }catch(e){$('publish-creative-status').textContent='Không thể xuất bản: '+e.message}
};
if($('creation-mode').value==='existing')loadWorlds().catch(e=>say(e.message));
})();