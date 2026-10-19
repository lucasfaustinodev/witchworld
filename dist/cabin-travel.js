import * as THREE from './vendor/three.module.js';

// One actor, two independently owned scenes/collision worlds, one renderer.
// No new keyboard listener: the existing contextual E delegates here.
export function createCabinTravel({witch,cabin,gardenScene,gardenCamera,gardenNavigation,pipeline,canTravel,hint}){
 let world='garden',phase='idle',elapsed=0,switched=false,visits=0;
 const entrance=new THREE.Vector3(-4.77,0,-2.68),returnPosition=new THREE.Vector3();let returnYaw=0;
 const fade=document.createElement('div');fade.className='world-transition';fade.hidden=true;fade.setAttribute('aria-hidden','true');document.body.append(fade);
 const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
 function nearDoor(p=witch.root.position){const at=world==='garden'?entrance:cabin.exit;return Math.hypot(p.x-at.x,p.z-at.z)<(world==='garden'?.63:.75);}
 function eligible(){return phase==='idle'&&witch.isStable()&&canTravel();}
 function start(){
  if(!nearDoor()||!eligible())return false;
  phase=world==='garden'?'entering':'leaving';elapsed=0;switched=false;fade.hidden=false;fade.style.opacity='0';
  if(world==='garden'){returnPosition.copy(witch.root.position);returnYaw=witch.root.rotation.y;}
  lock();return true;
 }
 function lock(){if(phase!=='idle')witch.setExternalFocus({locked:true,weight:0,yaw:witch.root.rotation.y,label:phase==='entering'?'Entrando na cabana…':'Voltando ao Jardim…'});}
 function update(dt){
  if(phase==='idle')return;elapsed+=dt;
  const duration=1.05,progress=Math.min(1,elapsed/duration);
  fade.style.opacity=String(progress<.5?smooth(progress*2):1-smooth((progress-.5)*2));
  if(progress>=.5&&!switched){
   switched=true;world=phase==='entering'?'cabin':'garden';
   const targetScene=world==='cabin'?cabin.scene:gardenScene,targetCamera=world==='cabin'?cabin.camera:gardenCamera;
   targetScene.add(witch.root);witch.setNavigation(world==='cabin'?cabin.navigation:gardenNavigation);
   witch.placeAt(world==='cabin'?cabin.spawn:returnPosition,world==='cabin'?Math.PI:returnYaw);
   pipeline.setWorld(targetScene,targetCamera);if(world==='cabin')visits++;
  }
  if(progress===1){phase='idle';fade.style.opacity='0';fade.hidden=true;witch.setExternalFocus({locked:false,weight:0,yaw:witch.root.rotation.y});}
  else lock();
 }
 function present(){
  if(phase!=='idle'){hint.hidden=false;hint.textContent=phase==='entering'?'Entrando na cabana…':'Voltando ao Jardim…';}
  else if(nearDoor()&&eligible()){hint.hidden=false;hint.textContent=label();}
 }
 function label(){return world==='garden'?'E — Entrar na cabana':'E — Voltar ao Jardim';}
 return {update,lock,present,start,label,canStart:p=>nearDoor(p)&&eligible(),isGarden:()=>world==='garden',busy:()=>phase!=='idle',snapshot:()=>({world,phase,elapsed,visits,sceneCount:2,collisionWorlds:2})};
}
