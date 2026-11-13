(()=>{'use strict';
const $=id=>document.getElementById(id);
const audio=$('audio-file'),splitBtn=$('split-mp3'),list=$('segment-list'),status=$('split-status');
let sourceFile=null,segments=[],txtFiles=[];
const fmtBytes=n=>n<1024*1024?(n/1024).toFixed(1)+' KB':(n/1024/1024).toFixed(1)+' MB';
const fmtTime=s=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60),v=Math.floor(s%60);return h?h+' giờ '+m+' phút '+v+' giây':m+' phút '+v+' giây'};
const safeName=s=>String(s||'audio').replace(/\.[^.]+$/,'').normalize('NFC').replace(/[\\/:*?"<>|]+/g,'_').trim()||'audio';
function promptFor(n,total,name){return 'Bạn là chuyên gia chuyển giọng nói thành văn bản (speech-to-text). Tôi gửi kèm một đoạn MP3 được cắt từ một bản ghi âm dài. Đây là phần '+n+'/'+total+' của bản ghi; tên file: '+name+'.\n\nHãy nghe TOÀN BỘ đoạn MP3 đính kèm và chép lại chính xác tất cả lời nói nghe được. Yêu cầu:\n1. Chép nguyên văn theo đúng thứ tự từ đầu đến cuối; không tóm tắt, không diễn giải, không viết lại cho hay hơn, không bỏ câu lặp hoặc đoạn nhỏ.\n2. Giữ nguyên ngôn ngữ gốc, tên riêng, thuật ngữ và cách nói. Thêm dấu câu, chia đoạn hợp lý.\n3. Nếu có nhiều người nói, ghi nhãn Người nói 1, Người nói 2… khi phân biệt được. Giữ nhất quán cách gọi người nói trong đoạn này.\n4. Đoạn nghe không rõ ghi [không nghe rõ], không tự đoán. Không bịa thêm nội dung.\n5. Đoạn audio có thể bắt đầu hoặc kết thúc giữa câu do được cắt từ file dài. Hãy chép đúng phần nghe được, không tự hoàn thành câu dựa trên suy đoán.\n6. Không viết lời mở đầu, lời kết, nhận xét, tóm tắt, tiêu đề hay phân tích.\n7. Chỉ trả về nội dung transcript thuần văn bản để tôi lưu thành file TXT.\n\nHãy kiểm tra kỹ phần cuối audio để không bỏ sót lời nói cuối cùng. Đây chỉ là phần '+n+'/'+total+'; không cần kể lại nội dung các phần khác.'}
$('gemini-prompt').value=promptFor('[SỐ PHẦN]','[TỔNG SỐ]','[TÊN FILE MP3]');
$('copy-prompt').onclick=async()=>{try{await navigator.clipboard.writeText($('gemini-prompt').value);$('split-status').textContent='Đã sao chép prompt.'}catch(e){$('gemini-prompt').select();$('split-status').textContent='Hãy sao chép prompt từ menu của thiết bị.'}};
$('download-prompt').onclick=()=>download('PROMPT_CHÉP_LỜI_GEMINI.txt',$('gemini-prompt').value,'text/plain;charset=utf-8');
function download(name,blobOrText,mime){const blob=blobOrText instanceof Blob?blobOrText:new Blob(['\ufeff'+blobOrText],{type:mime||'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function id3Offset(bytes){if(bytes.length<10||bytes[0]!==73||bytes[1]!==68||bytes[2]!==51)return 0;const size=(bytes[6]&127)*2097152+(bytes[7]&127)*16384+(bytes[8]&127)*128+(bytes[9]&127);return 10+size+((bytes[5]&16)?10:0)}
const BR1=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
const BR2=[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0];
function headerAt(b,i){
 if(i+4>b.length)return null;
 const x=(b[i]<<24)|(b[i+1]<<16)|(b[i+2]<<8)|b[i+3];
 if((x>>>21)!==2047)return null;
 const ver=(x>>>19)&3,layer=(x>>>17)&3,bi=(x>>>12)&15,si=(x>>>10)&3,pad=(x>>>9)&1;
 if(ver===1||layer!==1||bi===0||bi===15||si===3)return null;
 const rate0=[44100,48000,32000][si],rate=rate0/(ver===3?1:ver===2?2:4),kbps=(ver===3?BR1:BR2)[bi];
 const len=Math.floor((ver===3?144:72)*kbps*1000/rate)+pad;
 if(len<24)return null;
 return {len,duration:(ver===3?1152:576)/rate,rate,kbps};
}
async function inspectAndSplit(file,targetSeconds,onProgress){
 const head=new Uint8Array(await file.slice(0,10).arrayBuffer()),startOffset=id3Offset(head);
 let readOffset=startOffset,carry=new Uint8Array(0),segmentStart=null,lastEnd=null,segmentDuration=0,totalDuration=0,frames=0,parts=[];
 const blockSize=1024*1024;
 while(readOffset<file.size){
  const end=Math.min(file.size,readOffset+blockSize),chunk=new Uint8Array(await file.slice(readOffset,end).arrayBuffer());
  const buf=new Uint8Array(carry.length+chunk.length);buf.set(carry);buf.set(chunk,carry.length);
  const base=readOffset-carry.length;let i=0;
  while(i+4<=buf.length){
   const h=headerAt(buf,i);
   if(!h){i++;continue}
   if(i+h.len>buf.length)break;
   const next=i+h.len;
   if(next+4<=buf.length&&!headerAt(buf,next)){i++;continue}
   if(next+4>buf.length&&end<file.size)break;
   const absolute=base+i,frameEnd=absolute+h.len;
   if(segmentStart===null)segmentStart=absolute;
   segmentDuration+=h.duration;totalDuration+=h.duration;frames++;lastEnd=frameEnd;i+=h.len;
   if(segmentDuration>=targetSeconds){parts.push({start:segmentStart,end:lastEnd,duration:segmentDuration});segmentStart=null;segmentDuration=0}
  }
  carry=buf.slice(i);readOffset=end;onProgress?.(Math.min(99,readOffset/file.size*100),frames);
 }
 if(segmentStart!==null&&lastEnd!==null&&lastEnd>segmentStart)parts.push({start:segmentStart,end:lastEnd,duration:segmentDuration});
 if(!frames||!parts.length)throw Error('Không tìm thấy frame MP3 hợp lệ. Hãy kiểm tra file có đúng định dạng MP3 không.');
 return {parts,frames,totalDuration};
}
audio.addEventListener('change',()=>{
 sourceFile=audio.files?.[0]||null;segments=[];list.innerHTML='';list.classList.add('hidden');
 if(!sourceFile){$('file-meta').textContent='Chưa chọn file MP3';splitBtn.disabled=true;return}
 $('file-meta').textContent=sourceFile.name+' · '+fmtBytes(sourceFile.size);
 $('output-prefix').value=safeName(sourceFile.name);splitBtn.disabled=!/\.mp3$/i.test(sourceFile.name);
 $('split-status').textContent=splitBtn.disabled?'Vui lòng chọn file có đuôi .mp3.':'Sẵn sàng chia file.';
});
splitBtn.addEventListener('click',async()=>{
 if(!sourceFile)return;
 splitBtn.disabled=true;$('clear-splits').disabled=true;$('split-progress').classList.remove('hidden');$('split-progress').classList.remove('indeterminate');
 $('split-status').textContent='Đang đọc cấu trúc frame MP3…';
 try{
  const target=Number($('chunk-minutes').value)*60;
  const result=await inspectAndSplit(sourceFile,target,(p,n)=>{$('split-progress-fill').style.width=p+'%';$('split-status').textContent='Đang quét frame MP3… '+Math.round(p)+'% · '+n.toLocaleString('vi-VN')+' frame'});
  const prefix=safeName($('output-prefix').value||sourceFile.name);
  segments=result.parts.map((p,i)=>({...p,name:prefix+'_part_'+String(i+1).padStart(3,'0')+'.mp3'}));
  renderSegments();$('split-progress-fill').style.width='100%';
  $('split-status').textContent='✓ Đã chia thành '+segments.length+' phần · thời lượng '+fmtTime(result.totalDuration)+' · '+result.frames.toLocaleString('vi-VN')+' frame. Không có âm thanh nào bị nén lại.';
 }catch(e){$('split-status').textContent='Lỗi: '+e.message}
 finally{splitBtn.disabled=!sourceFile;$('clear-splits').disabled=false}
});
function renderSegments(){
 list.innerHTML='';list.classList.remove('hidden');
 const summary=document.createElement('p');summary.className='note';summary.textContent=segments.length+' file MP3 đã sẵn sàng. Nhấn Tải từng phần để lưu về máy.';list.append(summary);
 segments.forEach((p,i)=>{
  const row=document.createElement('div');row.className='segment-row';
  const info=document.createElement('div');info.className='segment-info';
  const name=document.createElement('b');name.textContent=p.name;
  const detail=document.createElement('span');detail.textContent=fmtTime(p.duration)+' · '+fmtBytes(p.end-p.start);
  info.append(name,detail);
  const btn=document.createElement('button');btn.type='button';btn.className='btn';btn.textContent='Tải MP3';
  btn.onclick=()=>download(p.name,sourceFile.slice(p.start,p.end,'audio/mpeg'),'audio/mpeg');
  const promptBtn=document.createElement('button');promptBtn.type='button';promptBtn.className='btn secondary';promptBtn.textContent='Prompt phần này';
  promptBtn.onclick=async()=>{const text=promptFor(i+1,segments.length,p.name);try{await navigator.clipboard.writeText(text);$('split-status').textContent='Đã sao chép prompt cho '+p.name+'.'}catch(e){$('gemini-prompt').value=text;$('gemini-prompt').scrollIntoView({behavior:'smooth'});$('split-status').textContent='Đã điền prompt cho '+p.name+'. Hãy sao chép bên trên.'}};
  const actions=document.createElement('div');actions.className='segment-actions';actions.append(btn,promptBtn);row.append(info,actions);list.append(row);
 });
}
$('clear-splits').onclick=()=>{segments=[];list.innerHTML='';list.classList.add('hidden');$('split-progress').classList.add('hidden');$('split-status').textContent='Đã xóa danh sách phần đã chia.'};
const txtInput=$('txt-files'),txtList=$('txt-file-list'),mergeBtn=$('merge-txt-files');
const collator=new Intl.Collator('vi',{numeric:true,sensitivity:'base'});
function renderTxtFiles(){
 txtList.innerHTML='';txtList.classList.toggle('hidden',!txtFiles.length);mergeBtn.disabled=!txtFiles.length;
 txtFiles.forEach((f,i)=>{
  const row=document.createElement('div');row.className='txt-row';
  const info=document.createElement('div');info.className='segment-info';const name=document.createElement('b');name.textContent=f.name;const size=document.createElement('span');size.textContent=fmtBytes(f.size);info.append(name,size);
  const actions=document.createElement('div');actions.className='segment-actions';
  [['↑',()=>{if(i){[txtFiles[i-1],txtFiles[i]]=[txtFiles[i],txtFiles[i-1]];renderTxtFiles()}}],['↓',()=>{if(i<txtFiles.length-1){[txtFiles[i+1],txtFiles[i]]=[txtFiles[i],txtFiles[i+1]];renderTxtFiles()}}],['×',()=>{txtFiles.splice(i,1);renderTxtFiles()}]].forEach(([label,fn])=>{const b=document.createElement('button');b.type='button';b.className='btn secondary';b.textContent=label;b.disabled=(label==='↑'&&i===0)||(label==='↓'&&i===txtFiles.length-1);b.onclick=fn;actions.append(b)});
  row.append(info,actions);txtList.append(row);
 });
}
txtInput.addEventListener('change',()=>{
 const fresh=[...(txtInput.files||[])];for(const f of fresh)if(!txtFiles.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified))txtFiles.push(f);
 txtFiles.sort((a,b)=>collator.compare(a.name,b.name));renderTxtFiles();
 $('txt-import-status').textContent='Đã chọn '+txtFiles.length+' file TXT. Kiểm tra thứ tự rồi ghép.';
 txtInput.value='';
});
mergeBtn.addEventListener('click',async()=>{
 if(!txtFiles.length)return;
 mergeBtn.disabled=true;$('txt-import-status').textContent='Đang đọc '+txtFiles.length+' file TXT…';
 try{
  const pieces=[];
  for(let i=0;i<txtFiles.length;i++){
   const f=txtFiles[i],text=(await f.text()).replace(/^\uFEFF/,'').trim();
   pieces.push('========== PHẦN '+String(i+1).padStart(3,'0')+' · '+f.name+' ==========\n'+text);
  }
  $('transcript').value=pieces.join('\n\n');$('transcript').dispatchEvent(new Event('input',{bubbles:true}));
  $('txt-import-status').textContent='✓ Đã ghép '+txtFiles.length+' file theo thứ tự hiện tại. Tổng '+$('transcript').value.length.toLocaleString('vi-VN')+' ký tự.';
 }catch(e){$('txt-import-status').textContent='Lỗi đọc TXT: '+e.message}
 finally{mergeBtn.disabled=!txtFiles.length}
});
$('clear-txt-files').onclick=()=>{txtFiles=[];renderTxtFiles();$('txt-import-status').textContent='Đã xóa danh sách TXT.'};
})();