import * as THREE from './vendor/three.module.js';

// View-only reactions: consumes snapshots, never changes character/ritual state.
export function createLivingGarden({scene,waterMesh,waterMaterial,rippleMaterial,lanterns}){
 const uniforms={gardenTime:{value:0},gardenBreeze:{value:1},gardenPulse:{value:0},gardenFront:{value:0},gardenScry:{value:0},gardenVeil:{value:0}};
 let clock=0,motionTime=0,breeze=1,quiet=0,convergence=0,pulse=0,front=0,animatedInstances=0,animatedMeshes=0;
 const clamp=THREE.MathUtils.clamp,damp=(a,b,k,dt)=>THREE.MathUtils.lerp(a,b,1-Math.exp(-k*dt));
 function animateMaterial(mat,kind){
  const oldCompile=mat.onBeforeCompile,oldKey=mat.customProgramCacheKey();
  mat.onBeforeCompile=shader=>{
   oldCompile.call(mat,shader);Object.assign(shader.uniforms,uniforms);
   shader.fragmentShader='uniform float gardenVeil;varying float veilLeaf;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    totalEmissiveRadiance+=vec3(.045,.027,.115)*gardenVeil*veilLeaf;`);
   shader.vertexShader='varying float veilLeaf;uniform float gardenTime,gardenBreeze,gardenPulse,gardenFront,gardenScry;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    mat4 gardenTransform=modelMatrix;
    #ifdef USE_INSTANCING
     gardenTransform=modelMatrix*instanceMatrix;
    #endif
    vec3 anchor=gardenTransform[3].xyz;
    veilLeaf=step(.84,sin(anchor.x*3.17+anchor.z*2.91))*clamp(position.y+.4,0.,1.);
    float phase=anchor.x*1.79+anchor.z*2.31+anchor.y*.83;
    float sway=sin(gardenTime*.71+phase)*.62+sin(gardenTime*1.13+phase*1.67)*.28;
    float flex=${kind==='grass'?'clamp((position.y+.5)*1.05,0.,1.)':kind==='crown'?'.65':'(.42+.58*abs(position.z))'};
    vec2 radial=anchor.xz-vec2(0.,.3);float radius=length(radial);
    float wave=exp(-pow((radius-gardenFront*5.1)/.43,2.))*gardenPulse;
    float localScry=(1.-smoothstep(1.3,4.,distance(anchor.xz,vec2(4.8,2.25))))*gardenScry;
    vec2 delta=vec2(sway,sin(gardenTime*.51+phase)*.45)*${kind==='crown'?'.020':kind==='grass'?'.026':'.018'}*gardenBreeze*flex*(1.-localScry*.70);
    delta+=radial/max(radius,.01)*wave*.045*flex;
    vec3 worldDelta=vec3(delta.x,0.,delta.y);
    transformed+=vec3(dot(worldDelta,gardenTransform[0].xyz)/max(dot(gardenTransform[0].xyz,gardenTransform[0].xyz),.00001),dot(worldDelta,gardenTransform[1].xyz)/max(dot(gardenTransform[1].xyz,gardenTransform[1].xyz),.00001),dot(worldDelta,gardenTransform[2].xyz)/max(dot(gardenTransform[2].xyz,gardenTransform[2].xyz),.00001));`);
  };
  mat.customProgramCacheKey=()=>oldKey+'garden-wind-veil-v1-'+kind;mat.needsUpdate=true;
 }
 const materialKinds=new Map();
 scene.traverse(o=>{
  const kind=o.userData.environmentKind;if(!kind||!o.isMesh)return;
  if(o.isInstancedMesh)animatedInstances+=o.count;animatedMeshes++;
  // Batches reuse material; cache shader by material/kind without per-instance updates.
  const original=o.material,key=original.uuid+'/'+kind;
  if(!materialKinds.has(key)){const m=original.clone();animateMaterial(m,kind);materialKinds.set(key,m)}
  o.material=materialKinds.get(key);
  if(o.castShadow){o.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:o.material.side});animateMaterial(o.customDepthMaterial,kind);}
  // Tiny shader offsets stay within conservative bounds.
  if(o.boundingSphere)o.boundingSphere.radius+=.10;
 });
 const oldCompile=waterMaterial.onBeforeCompile,waterKey=waterMaterial.customProgramCacheKey();
 waterMaterial.onBeforeCompile=shader=>{
  oldCompile.call(waterMaterial,shader);Object.assign(shader.uniforms,uniforms);
  shader.fragmentShader='uniform float gardenTime,gardenPulse,gardenFront;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   // Analytic small normal waves; no surface rebuild or reflection pass.
   vec2 lakeUV=vMapUv*48.;
   float ripple=sin(length(lakeUV-vec2(20.,20.))*1.2-gardenFront*18.)*gardenPulse;
   normal=normalize(normal+vec3(sin(lakeUV.x*.72+lakeUV.y*.45+gardenTime*.40)*.033+ripple*.024,cos(lakeUV.y*.63-lakeUV.x*.35-gardenTime*.31)*.024,0.));`);
 };
 waterMaterial.customProgramCacheKey=()=>waterKey+'garden-water-v1';waterMaterial.needsUpdate=true;
 // Existing textures drift slowly. Separate uniform boundary leaves room for future surface effects.
 const originalRippleOpacity=rippleMaterial.opacity;
 const count=14,positions=new Float32Array(count*3),colors=new Float32Array(count*3),anchors=[];
 for(let i=0;i<count;i++){
  const angle=i*2.399963,r=3.3+(i%4)*.28;
  anchors.push({x:Math.cos(angle)*r-.30,z:.3+Math.sin(angle)*r,y:.40+(i%5)*.19,phase:i*1.73,speed:.10+(i%4)*.021});
  new THREE.Color(i%3?'#829851':'#b5b375').toArray(colors,i*3);
 }
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(16,16,0,16,16,16);
 g.addColorStop(0,'rgba(255,255,220,1)');g.addColorStop(.18,'rgba(232,251,179,.75)');g.addColorStop(1,'rgba(198,235,133,0)');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 const baseColors=colors.slice();
 const fireflies=new THREE.Points(geometry,new THREE.PointsMaterial({map:new THREE.CanvasTexture(canvas),color:'#ffffff',size:3.5,vertexColors:true,transparent:true,opacity:.68,depthWrite:false,blending:THREE.AdditiveBlending}));
 fireflies.name='garden-fireflies';fireflies.frustumCulled=false;scene.add(fireflies);
 function update(dt,pose,ritual,scry={calm:0,amount:0}){
  clock+=dt;const preparing=pose.state==='sitting'||ritual.state==='pause',magic=ritual.state==='awakening'||ritual.state==='active';
  quiet=damp(quiet,preparing?1:0,preparing?3.8:1.8,dt);
  breeze=damp(breeze,preparing?.14:magic?.70:1,2.4,dt);motionTime+=dt*(.15+.85*breeze);
  convergence=damp(convergence,magic?.12:0,magic?.85:1.2,dt);
  // Derived from the exact approved radial-front timing; only read elapsed/state.
  const t=ritual.elapsed-.65,smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
  front=ritual.state==='awakening'?smooth((t-.14)/1.51):1;
  pulse=ritual.state==='awakening'?(ritual.vfxPulse??smooth((t-.14)/.25)*(1-smooth((t-1.65)/.30))):0;
  if(ritual.state==='awakening'&&ritual.vfxFrontRadius!==undefined)front=ritual.vfxFrontRadius/5.1;
  uniforms.gardenScry.value=scry.calm;uniforms.gardenTime.value=motionTime;uniforms.gardenBreeze.value=breeze;uniforms.gardenPulse.value=pulse;uniforms.gardenFront.value=front;
  waterMaterial.map.offset.set(Math.sin(motionTime*.11)*.005,motionTime*.0018);
  waterMaterial.bumpMap.offset.set(-motionTime*.0021,Math.sin(motionTime*.09)*.008);
  rippleMaterial.opacity=originalRippleOpacity*(.95+Math.sin(motionTime*.43)*.09+pulse*.13);
  for(let i=0;i<lanterns.length;i++){
   const l=lanterns[i],phase=i*1.83,flicker=1+Math.sin(clock*1.04+phase)*.025+Math.sin(clock*2.11+phase*1.3)*.012;
   const near=1-THREE.MathUtils.smoothstep(Math.hypot(l.light.position.x-4.8,l.light.position.z-2.25),1.4,4);const factor=flicker*(1-quiet*.045)*(1-near*scry.amount*.035);l.light.intensity=l.baseIntensity*factor;
   l.core.color.copy(l.baseColor).multiplyScalar(factor);l.glass.opacity=l.baseOpacity*(1+Math.sin(clock*.92+phase)*.035);
  }
  for(let i=0;i<count;i++){
   const a=anchors[i],u=motionTime*a.speed+a.phase,k=1-convergence;
   const near=1-THREE.MathUtils.smoothstep(Math.hypot(a.x-4.8,a.z-2.25),1.3,4),wander=1-near*scry.calm*.85;
   const x=(a.x+(Math.sin(u)*.35+Math.sin(u*.61+1.4)*.13)*wander)*k,z=.3+(a.z-.3+Math.cos(u*.79)*.29*wander)*k;
   const dx=x,dz=z-.3,r=Math.hypot(dx,dz),push=Math.exp(-(((r-front*5.1)/.5)**2))*pulse*.065;
   positions[i*3]=x+dx/Math.max(r,.01)*push;positions[i*3+1]=a.y+Math.sin(u*.87)*.13;positions[i*3+2]=z+dz/Math.max(r,.01)*push;
   const intensity=.52+.35*Math.sin(clock*.62+i*2.3)**2;for(let c=0;c<3;c++)colors[i*3+c]=baseColors[i*3+c]*intensity;
  }
  geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;fireflies.material.opacity=magic?.42:.68;
 }
 function metrics(){return {clock,motionTime,breeze,quiet,convergence,pulse,front,fireflies:count,animatedMeshes,animatedInstances,lanterns:lanterns.length,water:'analytic normal + existing texture drift'};}
 return {update,metrics,setVeilStrength:value=>{uniforms.gardenVeil.value=value},waterSurface:waterMesh,fireflies};
}
