export function sceneTime(scene,globalTime){return globalTime-(Number(scene.start)||0);}
export function activeAt(item,t){const start=Number(item.start)||0;const duration=Number(item.duration??Infinity);return t>=start&&t<start+duration;}
export function getAnimationAt(characterTrack,t){
 const list=[...(characterTrack.animations||[])].sort((a,b)=>(a.start||0)-(b.start||0));
 return list.find(a=>activeAt(a,t))||{animationId:characterTrack.defaultAnimation||"idle",loop:true};
}
export function sampleAnimation(anim,localTime){
 const id=anim?.animationId||anim?.id||"idle",duration=Math.max(.001,Number(anim.duration)||1);
 let p=Math.max(0,localTime-(Number(anim.start)||0))/duration;
 if(anim.loop||anim.repeat)p=p%1;else p=Math.min(1,p);
 const wave=Math.sin(p*Math.PI*2);
 const result={x:Number(anim.x)||0,y:Number(anim.y)||0,rotation:Number(anim.rotation)||0,scale:Number(anim.scale)||1,frame:p};
 if(id==="walk"){result.x+=wave*8;result.y+=Math.abs(Math.cos(p*Math.PI*2))*10;result.rotation+=wave*.035;}
 if(id==="run"){result.x+=wave*12;result.y+=Math.abs(Math.cos(p*Math.PI*2))*18;result.rotation+=wave*.06;}
 if(id==="jump"){result.y-=Math.sin(p*Math.PI)*100;}
 if(id==="idle"){result.y+=Math.sin(localTime*2.2)*3;result.rotation+=Math.sin(localTime*1.4)*.012;}
 if(id==="talk"){result.y+=Math.sin(localTime*8)*1.5;}
 if(id==="listen"){result.rotation+=Math.sin(localTime*1.5)*.025;}
 return result;
}
export function collectActiveDialogue(scene,t){return (scene.dialogues||[]).filter(d=>activeAt(d,t));}
