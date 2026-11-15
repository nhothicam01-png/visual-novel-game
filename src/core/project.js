export const emptyProject = () => ({project:{id:"untitled",name:"Dự án mới",fps:30,resolution:{width:1920,height:1080},duration:30},assets:{characters:[],backgrounds:[],audio:[]},scenes:[]});
export function validateProject(data){
 const errors=[],warnings=[];
 if(!data||typeof data!=="object") return {errors:["JSON phải là object."],warnings:[]};
 if(!data.project) errors.push("Thiếu project.");
 if(!data.assets) errors.push("Thiếu assets.");
 if(!Array.isArray(data.scenes)) errors.push("scenes phải là mảng.");
 const ids=new Set();
 for(const c of data.assets?.characters||[]){if(!c.id)errors.push("Nhân vật thiếu id.");else if(ids.has(c.id))errors.push("Trùng character id: "+c.id);else ids.add(c.id);}
 const charIds=new Set((data.assets?.characters||[]).map(c=>c.id));
 const bgIds=new Set((data.assets?.backgrounds||[]).map(a=>a.id));
 const audioIds=new Set((data.assets?.audio||[]).map(a=>a.id));
 for(const [i,s] of (data.scenes||[]).entries()){
  if(!s.id)errors.push(`Scene ${i+1} thiếu id.`);
  for(const c of s.characters||[])if(!charIds.has(c.characterId))errors.push(`Scene ${s.id}: không tìm thấy characterId ${c.characterId}.`);
  const bg=s.background?.id;if(bg&&!bgIds.has(bg)&&!s.background?.src)warnings.push(`Scene ${s.id}: background ${bg} chưa có asset hoặc src.`);
  const music=s.music?.id;if(music&&!audioIds.has(music)&&!s.music?.src)warnings.push(`Scene ${s.id}: music ${music} chưa có asset hoặc src.`);
  for(const d of s.dialogues||[])for(const sp of d.speakers||[])if(!charIds.has(sp.characterId))errors.push(`Dialogue ${d.id}: không tìm thấy speaker ${sp.characterId}.`);
 }
 return {errors,warnings};
}
export function assetUrl(project,id,kind){
 const list=project.assets?.[kind]||[];const item=list.find(x=>x.id===id);return item?.src||item?.image||"";
}
