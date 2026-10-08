import * as THREE from './vendor/three.module.js';

const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)};
// Five reusable slots; simulation lives here, one instanced surface draws them.
// Hand-authored short corridors stay away from the cabin, water and main circle.
export function createVeilWanderers({parent,shared,characterHeight}){
 const routes=[
  [[-4.45,1.35],[-4.15,.65],[-4.05,-.30]],
  [[-1.75,-3.0],[-1.32,-3.45],[-.92,-3.62]],
  [[1.55,-3.20],[1.95,-3.55],[2.30,-3.55]],
  [[2.80,-1.90],[2.82,-1.10],[2.80,-.25]],
  [[2.78,.78],[2.80,1.12],[2.63,1.58]],
  [[2.15,3.72],[1.45,4.10],[.60,4.27]],
  [[-3.55,3.00],[-3.82,2.62],[-4.05,2.10]],
  [[-.30,4.35],[-.98,4.20],[-1.55,4.03]]
 ].map(path=>new THREE.CatmullRomCurve3(path.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'catmullrom',.25));
 const profile=new THREE.CatmullRomCurve3([
  [0,.17,.095],[.09,.235,.12],[.25,.19,.11],[.48,.135,.09],
  [.67,.23,.13],[.75,.16,.12],[.83,.145,.135],[.98,.15,.135],[1.08,.08,.09],[1.12,0,0]
 ].map(p=>new THREE.Vector3(...p)),false,'catmullrom',.25);
 const pos=[],indices=[],rows=28,sides=16;
 for(let i=0;i<=rows;i++){
  const p=profile.getPoint(i/rows);
  for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;pos.push(Math.cos(a)*Math.max(0,p.y),p.x,Math.sin(a)*Math.max(0,p.z));}
 }
 for(let i=0;i<rows;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,a+1,b,b+1)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const alphas=new Float32Array(5),phases=new Float32Array([.2,1.7,3.4,4.8,6.1]);
 geometry.setAttribute('spiritAlpha',new THREE.InstancedBufferAttribute(alphas,1));geometry.setAttribute('spiritPhase',new THREE.InstancedBufferAttribute(phases,1));
 const material=new THREE.ShaderMaterial({uniforms:shared,transparent:true,depthWrite:false,side:THREE.FrontSide,
  vertexShader:`attribute float spiritAlpha,spiritPhase;varying float presence,phase;varying vec3 pLocal,nView,pView;uniform float time;
   void main(){presence=spiritAlpha;phase=spiritPhase;pLocal=position;vec3 p=position;float hem=1.-smoothstep(.03,.62,p.y);
    p.x+=sin(p.y*6.-time*.68+phase)*hem*.023;p.z+=sin(p.y*4.+time*.53+phase)*hem*.016;
    vec4 view=modelViewMatrix*instanceMatrix*vec4(p,1.);pView=view.xyz;nView=normalize(normalMatrix*mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*view;}`,
  fragmentShader:`varying float presence,phase;varying vec3 pLocal,nView,pView;uniform float time,strength;uniform vec3 spectralTone;
   void main(){float facing=abs(dot(normalize(nView),normalize(-pView)));float rim=pow(1.-facing,2.7);
    float light=.46+.54*max(0.,dot(normalize(nView),normalize(vec3(-.4,.8,.6))));
    float face=exp(-pow(pLocal.x/.093,2.)-pow((pLocal.y-.935)/.087,2.))*smoothstep(.05,.095,pLocal.z);
    vec3 c=spectralTone*(.30*light+.35*rim);c=mix(c,vec3(.035,.045,.075),face*.74);
    float flow=.5+.5*sin(pLocal.y*9.-time*.65+phase+sin(pLocal.x*6.+time*.31));
    float hem=smoothstep(.015,.21+flow*.045,pLocal.y);float alpha=presence*strength*hem*(.45+.17*rim);
    gl_FragColor=vec4(c,alpha);}`
 });
 const mesh=new THREE.InstancedMesh(geometry,material,5);mesh.name='veil-wandering-spirits';mesh.frustumCulled=false;mesh.renderOrder=4;mesh.visible=false;parent.add(mesh);
 const slots=Array.from({length:5},(_,id)=>({id,active:false,age:0,duration:0,route:0,scale:1,alpha:0,x:0,y:0,z:0}));
 const transform=new THREE.Object3D(),point=new THREE.Vector3(),tangent=new THREE.Vector3();
 let clock=0,started=false,cursor=0,appearances=0,target=3;
 function spawn(slot){
  let index=cursor++%routes.length;
  for(let n=0;n<routes.length&&slots.some(s=>s.active&&s.route===index);n++)index=(index+1)%routes.length;
  Object.assign(slot,{active:true,age:0,duration:10.4+(appearances%4)*1.55,route:index,scale:characterHeight/1.12*(.97+(appearances%4)*.02),alpha:0});appearances++;
 }
 function reset(){started=false;clock=0;target=3;slots.forEach(s=>{s.active=false;s.alpha=0});alphas.fill(0);geometry.attributes.spiritAlpha.needsUpdate=true;mesh.visible=false;}
 function update(dt,strength,roaming){
  if(strength<=0){if(started)reset();return}
  mesh.visible=true;
  if(!started){started=true;for(let i=0;i<3;i++){spawn(slots[i]);slots[i].age=1.7+i*1.5;}}
  if(roaming)clock+=dt;
  const segment=clock%44;target=segment<11?3:segment<24?4:segment<33?5:3;
  for(const s of slots)if(s.active){if(roaming)s.age+=dt;if(s.age>=s.duration){s.active=false;s.alpha=0}}
  // Replace a fading presence while its successor is still emerging.
  const sustaining=slots.filter(s=>s.active&&s.age<s.duration-2.1).length;
  let needed=target-sustaining;
  if(roaming)for(const s of slots)if(needed>0&&!s.active){spawn(s);needed--}
  for(const s of slots){
   if(s.active){
    const t=ease((s.age-1.2)/(s.duration-4.4));routes[s.route].getPoint(t,point);routes[s.route].getTangent(t,tangent);
    const phase=phases[s.id],bob=.030*Math.sin(clock*1.12+phase)+.017*Math.sin(clock*.63+phase*1.3);
    s.alpha=ease(s.age/1.65)*(1-ease((s.age-s.duration+2.1)/2.1));s.x=point.x;s.z=point.z;s.y=.27+bob;
    transform.position.set(s.x,s.y,s.z);transform.rotation.set(.024*Math.sin(clock*.71+phase),Math.atan2(tangent.x,tangent.z),.032*Math.sin(clock*.83+phase));transform.scale.setScalar(s.scale);
   }else{transform.position.set(0,-20,0);transform.scale.setScalar(0);s.alpha=0}
   transform.updateMatrix();mesh.setMatrixAt(s.id,transform.matrix);alphas[s.id]=s.alpha;
  }
  mesh.instanceMatrix.needsUpdate=true;geometry.attributes.spiritAlpha.needsUpdate=true;
 }
 function snapshot(){return {capacity:5,target,active:slots.filter(s=>s.active&&s.alpha>.035).length,appearances,clock,referenceHeight:characterHeight,slots:slots.map(s=>({...s,height:s.scale*1.12})),routes:routes.length}}
 return {update,snapshot,mesh};
}
