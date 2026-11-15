import * as THREE from "three";
import {FBXLoader} from "three/addons/loaders/FBXLoader.js";
export async function loadFbx(file,host){
 const url=URL.createObjectURL(file),loader=new FBXLoader();const root=await loader.loadAsync(url);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x171a25);scene.add(new THREE.HemisphereLight(0xffffff,0x556070,2));
 const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(3,5,4);scene.add(key);scene.add(root);
 const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());root.position.sub(center);
 const camera=new THREE.PerspectiveCamera(35,1,.1,1000);camera.position.set(0,Math.max(size.y*0.35,1),Math.max(size.x,size.y,size.z)*2.8);camera.lookAt(0,0,0);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(host.clientWidth||500,host.clientHeight||320);host.replaceChildren(renderer.domElement);
 const mixer=root.animations.length?new THREE.AnimationMixer(root):null;const actions=root.animations.map(clip=>mixer.clipAction(clip));actions.forEach(a=>a.play());
 let previous=performance.now(),frame;const animate=now=>{frame=requestAnimationFrame(animate);mixer?.update(Math.min((now-previous)/1000,.05));previous=now;renderer.render(scene,camera);};animate(previous);
 const resize=()=>{const w=host.clientWidth||500,h=host.clientHeight||320;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);};const observer=new ResizeObserver(resize);observer.observe(host);
 URL.revokeObjectURL(url);
 return {clips:root.animations.map(c=>({name:c.name,duration:c.duration})),stop(){cancelAnimationFrame(frame);observer.disconnect();renderer.dispose();host.replaceChildren();}};
}
