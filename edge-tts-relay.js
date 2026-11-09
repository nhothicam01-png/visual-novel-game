// Cloudflare Worker – relay Edge Neural TTS.
// Dán toàn bộ mã này vào Cloudflare Workers → Edit code → Deploy.
// GET chỉ kiểm tra Worker; POST mới thực hiện tổng hợp âm thanh.

const TOKEN='6A5AA1D4EAFF4E9FB37E23D68491D6F4',VER='2-143.0.3650.96';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const esc=s=>s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const dt=()=>new Date().toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+)/,'$1 $3 $2 $4').replace('GMT','GMT+0000 (Coordinated Universal Time)');
const G2C='Copyright (C) Microsoft Corporation. All rights reserved.',G2S1=[0xEF0569FB,0x76F50F34,0xC3EFEA97],G2S2=[0xC31713DB,0x1881CE3C,0x35BD1EC9],G2M1=[0xCF98B111,0x87085B9F,0x12CEB96D,0x257E1D83],G2M2=[0xA27416F5,0xD38396FF,0x7C932B89,0xBFA49F69];
const g2h=v=>((v<<16)|(v>>>16))>>>0,g2hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
const g2t=(w,k,m)=>{const s=Math.imul(w,k)+Math.imul(g2h(w),m[0]),p=Math.imul(g2h(s),m[1])>>>0;return (Math.imul(g2h(p),m[2])+p)>>>0};
const g2m=(v,ms)=>{for(const m of ms)v=Math.imul(g2h(v),m)>>>0;return v};
function g2cs64(msg,dg){
 const dv=new DataView(dg.buffer,dg.byteOffset,dg.byteLength),k1=(dv.getUint32(0,true)|1)>>>0,k2=(dv.getUint32(4,true)|1)>>>0;
 const pad=new Uint8Array(Math.ceil(msg.length/8)*8);pad.set(msg);const w=new DataView(pad.buffer);let ss=0,ls=0,mx=0,ms=0;
 for(let o=0;o<pad.length;o+=8){const a=w.getUint32(o,true),b=w.getUint32(o+4,true),f=g2t(a,k1,G2S1);ls=g2t(b,k2,G2S2);ss=(ss+f+ls)>>>0;mx=g2m(Math.imul(mx+a,k1),G2M1);ms=(ms+mx)>>>0;mx=g2m(Math.imul(mx+b,k2),G2M2);ms=(ms+mx)>>>0}
 const out=new Uint8Array(8),ov=new DataView(out.buffer);ov.setUint32(0,(ls^mx)>>>0,true);ov.setUint32(4,(ss^ms)>>>0,true);return out;
}
async function gec(){
 let t=Math.floor(Date.now()/1000)+11644473600;t-=t%300;
 const msg=new TextEncoder().encode(G2C+(BigInt(t)*10000000n).toString()+TOKEN),dg=new Uint8Array(await crypto.subtle.digest('SHA-256',msg));
 return g2hex(g2cs64(msg,dg))+'-'+g2hex(dg);
}
const textResponse=(text,status=200)=>new Response(text,{status,headers:{...CORS,'Content-Type':'text/plain; charset=utf-8'}});

async function synthesize(text,voice,rate,pitch){
 const id=crypto.randomUUID().replace(/-/g,'');
 const url='https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken='+TOKEN+'&ConnectionId='+id+'&Sec-MS-GEC='+await gec()+'&Sec-MS-GEC-Version='+VER;
 const upstream=await fetch(url,{headers:{
  Upgrade:'websocket',
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  Origin:'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
 }});
 const ws=upstream.webSocket;
 if(!ws){
  const detail=(await upstream.text().catch(()=>'' )).slice(0,500);
  throw new Error('Microsoft không chấp nhận WebSocket (HTTP '+upstream.status+')'+(detail?' · '+detail:''));
 }

 // Cloudflare đổi mặc định frame nhị phân sang Blob từ compatibility date mới.
 // Đặt binaryType trước accept(); đồng thời vẫn hỗ trợ Blob để phòng thay đổi runtime.
 ws.binaryType='arraybuffer';
 const chunks=[];
 await new Promise((resolve,reject)=>{
  let settled=false;
  const finish=error=>{
   if(settled)return;
   settled=true;
   clearTimeout(timer);
   try{ws.close()}catch(_){}
   if(error)reject(error);else resolve(chunks);
  };
  const timer=setTimeout(()=>finish(new Error('Microsoft không trả kết quả trong 20 giây')),20000);

  ws.addEventListener('message',async event=>{
   if(typeof event.data==='string'){
    if(event.data.includes('Path:turn.end')){
     finish(parts.length?null:new Error('Microsoft kết thúc nhưng không gửi frame âm thanh'));
    }
    return;
   }
   try{
    const buffer=event.data instanceof ArrayBuffer?event.data:
      (event.data instanceof Blob?await event.data.arrayBuffer():null);
    if(!buffer||buffer.byteLength<2)return;
    const view=new DataView(buffer),headerLength=view.getUint16(0);
    const audioOffset=2+headerLength;
    if(audioOffset>buffer.byteLength)return;
    const header=new TextDecoder().decode(new Uint8Array(buffer,2,headerLength));
    if(header.includes('Path:audio')&&audioOffset<buffer.byteLength)chunks.push(buffer.slice(audioOffset));
   }catch(_){/* Bỏ qua frame lỗi; báo lỗi nếu không thu được âm thanh. */}
  });
  ws.addEventListener('error',()=>finish(new Error('WebSocket tới Microsoft phát sinh lỗi')));
  ws.addEventListener('close',event=>finish(new Error('Microsoft đóng WebSocket trước khi hoàn tất (code '+(event.code||'không rõ')+(event.reason?': '+event.reason:'')+')')));

  try{
   ws.accept();
   ws.send('X-Timestamp:'+dt()+'\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}');
   const lang=voice.split('-').slice(0,2).join('-');
   const ssml="<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='"+lang+"'><voice name='"+voice+"'><prosody pitch='"+pitch+"' rate='"+rate+"' volume='+0%'>"+esc(text)+'</prosody></voice></speak>';
   ws.send('X-RequestId:'+id+'\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:'+dt()+'Z\r\nPath:ssml\r\n\r\n'+ssml);
  }catch(error){finish(error)}
 });
 return chunks;
}

export default{async fetch(req){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(req.method==='GET'){
  const url=new URL(req.url);
  return textResponse(url.searchParams.get('test')==='1'
   ?'Edge TTS relay đang chạy ✔ (GET chỉ xác nhận Worker; POST mới thử tạo âm thanh).'
   :'Edge TTS relay đang chạy ✔. Thêm /?test=1 để kiểm tra Worker.');
 }
 if(req.method!=='POST')return textResponse('Chỉ hỗ trợ GET, POST và OPTIONS.',405);
 let payload;
 try{payload=await req.json()}catch(_){return textResponse('Body phải là JSON hợp lệ.',400)}
 const text=String(payload?.text??'').trim();
 const voice=String(payload?.voice||'vi-VN-HoaiMyNeural').trim();
 const rate=String(payload?.rate??'+0%').trim();
 const pitch=String(payload?.pitch??'+0Hz').trim();
 if(!text||text.length>3000)return textResponse('text không hợp lệ (giới hạn 1–3000 ký tự).',400);
 if(!/^[a-z]{2,3}-[A-Z]{2,4}-[A-Za-z0-9]+Neural$/.test(voice))return textResponse('Tên voice không hợp lệ.',400);
 if(!/^[+-]?\d{1,3}%$/.test(rate)||! /^[+-]?\d{1,4}Hz$/.test(pitch))return textResponse('rate hoặc pitch không hợp lệ.',400);
 try{
  const parts=await synthesize(text,voice,rate,pitch);
  const audio=new Blob(parts,{type:'audio/mpeg'});
  if(!audio.size)return textResponse('Edge TTS không trả về dữ liệu âm thanh.',502);
  return new Response(audio,{status:200,headers:{...CORS,'Content-Type':'audio/mpeg','Content-Length':String(audio.size),'Cache-Control':'no-store'}});
 }catch(error){
  const message=String(error?.message||error);
  return textResponse('Edge TTS relay lỗi: '+message,/20 giây/.test(message)?504:502);
 }
}};
