import {assetUrl} from "../core/project.js";
import {sceneTime,activeAt,getAnimationAt,sampleAnimation,collectActiveDialogue} from "../engine/timeline.js";
const imageCache=new Map();
function image(src){if(!src)return null;if(!imageCache.has(src)){const im=new Image();im.src=src;imageCache.set(src,im);}return imageCache.get(src);}
function resolve(project,id,kind,inline){return inline||assetUrl(project,id,kind);}
function effectFilter(effects=[]){return effects.map(e=>{const v=Number(e.intensity??e.value??1);if(e.type==="blur")return `blur(${v*4}px)`;if(e.type==="grayscale")return `grayscale(${v})`;if(e.type==="sepia")return `sepia(${v})`;if(e.type==="brightness")return `brightness(${1+v*.5})`;return "";}).filter(Boolean).join(" ");}
export class CanvasRenderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext("2d");this.project=null;this.time=0;this.onDialogue=null;}
 setProject(project){this.project=project;const r=project.project?.resolution||{};this.canvas.width=r.width||1920;this.canvas.height=r.height||1080;}
 draw(time=0){
  if(!this.project)return;this.time=time;const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.clearRect(0,0,w,h);c.fillStyle="#252938";c.fillRect(0,0,w,h);
  const scenes=(this.project.scenes||[]).filter(s=>activeAt({start:s.start||0,duration:s.duration??Infinity},time));
  for(const scene of scenes)this.drawScene(scene,time-(scene.start||0));
 }
 drawScene(scene,t){
  const c=this.ctx,w=this.canvas.width,h=this.canvas.height,bg=scene.background||{};const bgSrc=resolve(this.project,bg.id,"backgrounds",bg.src);const bgImg=image(bgSrc);
  c.save();const zoom=Number(scene.camera?.zoom)||1;c.translate(w/2+(Number(scene.camera?.x)||0),h/2+(Number(scene.camera?.y)||0));c.scale(zoom,zoom);c.translate(-w/2,-h/2);
  if(bgImg?.complete&&bgImg.naturalWidth){c.filter=effectFilter(bg.effects);c.drawImage(bgImg,0,0,w,h);c.filter="none";}else{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,"#37445e");g.addColorStop(1,"#171b29");c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle="#ffffffaa";c.font="28px sans-serif";c.fillText(bg.id||"Chưa chọn background",40,70);}
  for(const track of scene.characters||[])if(activeAt(track,t)){const def=(this.project.assets.characters||[]).find(x=>x.id===track.characterId)||{};this.drawCharacter(track,def,t);}
  const dialogues=collectActiveDialogue(scene,t);if(dialogues.length){const d=dialogues[dialogues.length-1];c.fillStyle="#10131ddd";c.fillRect(w*.12,h-150,w*.76,100);c.fillStyle="#fff";c.font="28px sans-serif";c.textAlign="center";c.fillText(d.text||"",w*.5,h-92,w*.72);c.textAlign="left";this.onDialogue?.(d);}
  c.restore();
 }
 drawCharacter(track,def,t){
  const c=this.ctx,w=this.canvas.width,h=this.canvas.height;const anim=getAnimationAt(track,t),state=sampleAnimation(anim,t);const pos=track.position||{};const x=Number(pos.x??track.x??w/2)+state.x,y=Number(pos.y??track.y??h*.8)+state.y,scale=Number(track.scale)||1;const src=def.image||def.src||track.src;const im=image(src);
  c.save();c.translate(x,y);c.rotate(state.rotation);c.scale(scale*state.scale,scale*state.scale);
  if(im?.complete&&im.naturalWidth){const ih=Number(track.height)||Math.min(h*.78,im.naturalHeight),iw=ih*im.naturalWidth/im.naturalHeight;c.drawImage(im,-iw/2,-ih,iw,ih);}
  else{c.fillStyle=def.color||"#e8a0b5";c.beginPath();c.ellipse(0,-170,58,72,0,0,Math.PI*2);c.fill();c.fillStyle="#34364a";c.fillRect(-55,-105,110,175);c.fillStyle="#fff";c.font="20px sans-serif";c.textAlign="center";c.fillText(def.name||track.characterId,0,95);}
  c.restore();
 }
}
