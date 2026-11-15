import {readPsd} from "ag-psd";
function walk(nodes,out=[],parent=""){for(const n of nodes||[]){const path=parent?parent+"/"+n.name:n.name;out.push({name:n.name,path,visible:n.hidden!==true,opacity:n.opacity??255,canvas:n.canvas||null,children:!!n.children});if(n.children)walk(n.children,out,path);}return out;}
export async function importPsd(file){
 const buffer=await file.arrayBuffer();const psd=readPsd(buffer,{useImageData:true,skipLayerImageData:false});
 const layers=walk(psd.children||[]);let composite=null;
 if(psd.canvas){composite=document.createElement("canvas");composite.width=psd.width;composite.height=psd.height;composite.getContext("2d").drawImage(psd.canvas,0,0);}
 const extracted=[];
 for(const layer of layers){if(layer.canvas){const c=document.createElement("canvas");c.width=layer.canvas.width;c.height=layer.canvas.height;c.getContext("2d").drawImage(layer.canvas,0,0);extracted.push({...layer,dataUrl:c.toDataURL("image/png")});}}
 return {name:file.name,width:psd.width,height:psd.height,layers,extracted,preview:composite?.toDataURL("image/png")||null};
}
