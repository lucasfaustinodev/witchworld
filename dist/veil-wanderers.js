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
 // The approved sheet ghost: one continuous low-poly shell, a rounded crown,
 // five broad folds and two recessed, genuinely open polygonal eye sockets.
 // No limbs, rear cloak or extra energy meshes. Navigation stays unchanged.
 const positions=[],indices=[],surfaces=[];
 const rings=[
  [.026,.314,.213],[.085,.303,.207],[.18,.274,.196],
  [.30,.256,.186],[.43,.248,.181],[.58,.245,.179],
  [.71,.241,.176],[.78,.235,.171],[.84,.224,.163],
  [.90,.211,.154],[.96,.189,.142],[1.02,.153,.119],
  [1.075,.100,.083],[1.105,.047,.043]
 ],sides=32,stride=sides+1;
 for(let i=0;i<rings.length;i++){
  const [y,rx,rz]=rings[i],free=1-ease((y-.04)/.52);
  for(let j=0;j<=sides;j++){
   const a=j/sides*Math.PI*2,fold=1+free*(.064*Math.cos(a*5+.35)+.020*Math.sin(a*3));
   positions.push(Math.cos(a)*rx*fold,y+free*free*(.023*Math.sin(a*5+.35)+.011*Math.sin(a*3)),Math.sin(a)*rz*fold);
   surfaces.push(0);
  }
 }
 const eyeStarts=[5,9],eyeBottom=7,eyeTop=9;
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){
  if(i>=eyeBottom&&i<eyeTop&&eyeStarts.some(start=>j>=start&&j<start+2))continue;
  const a=i*stride+j,b=a+stride;indices.push(a,b,a+1,a+1,b,b+1);
 }
 const crown=positions.length/3;positions.push(0,1.12,0);surfaces.push(0);
 for(let j=0;j<sides;j++){const a=(rings.length-1)*stride+j;indices.push(a,crown,a+1)}
 for(const start of eyeStarts){
  const rim=[
   eyeBottom*stride+start,eyeBottom*stride+start+1,eyeBottom*stride+start+2,
   (eyeBottom+1)*stride+start+2,eyeTop*stride+start+2,
   eyeTop*stride+start+1,eyeTop*stride+start,(eyeBottom+1)*stride+start
  ];
  const middle=((eyeBottom+1)*stride+start+1)*3,cx=positions[middle],cy=.84,cz=positions[middle+2];
  const normal=new THREE.Vector3(cx/(.224*.224),0,cz/(.163*.163)).normalize(),horizontal=new THREE.Vector3(normal.z,0,-normal.x);
  const shape=[[.707,-.707],[0,-1],[-.707,-.707],[-1,0],[-.707,.707],[0,1],[.707,.707],[1,0]];
  // Share a regular octagonal rim with the shell; its cavity follows the
  // tangent of the rounded face instead of folding into a zigzag silhouette.
  for(let k=0;k<rim.length;k++){
   const n=rim[k]*3,x=shape[k][0]*.045,y=shape[k][1]*.061;
   positions[n]=cx+horizontal.x*x;positions[n+1]=cy+y;positions[n+2]=cz+horizontal.z*x;
  }
  const inner=[];
  for(const v of rim){const n=v*3;inner.push(positions.length/3);positions.push(cx+(positions[n]-cx)*.86-normal.x*.048,cy+(positions[n+1]-cy)*.86,cz+(positions[n+2]-cz)*.86-normal.z*.048);surfaces.push(1);}
  for(let k=0;k<rim.length;k++){const q=(k+1)%rim.length;indices.push(rim[k],inner[k],rim[q],rim[q],inner[k],inner[q]);}
  const center=positions.length/3;positions.push(cx-normal.x*.052,cy,cz-normal.z*.052);surfaces.push(1);
  for(let k=0;k<rim.length;k++)indices.push(inner[(k+1)%rim.length],inner[k],center);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('spiritSurface',new THREE.Float32BufferAttribute(surfaces,1));geometry.setIndex(indices);geometry.computeVertexNormals();
 const alphas=new Float32Array(5),phases=new Float32Array([.2,1.7,3.4,4.8,6.1]),shapes=new Float32Array([-.09,.08,-.025,.055,-.065]);
 geometry.setAttribute('spiritAlpha',new THREE.InstancedBufferAttribute(alphas,1));geometry.setAttribute('spiritPhase',new THREE.InstancedBufferAttribute(phases,1));geometry.setAttribute('spiritShape',new THREE.InstancedBufferAttribute(shapes,1));
 // A travelling cloth wave deforms the hem on the GPU. Independent instance
 // phases keep the folds alive without new bones or per-vertex CPU updates.
 const material=new THREE.ShaderMaterial({uniforms:shared,transparent:true,depthWrite:false,side:THREE.FrontSide,
  vertexShader:`attribute float spiritAlpha,spiritPhase,spiritShape,spiritSurface;varying float presence,phase,surface;varying vec3 pLocal,pView;uniform float time;
   void main(){presence=spiritAlpha;phase=spiritPhase;surface=spiritSurface;pLocal=position;vec3 p=position;p.x*=1.+spiritShape;
    float free=1.-smoothstep(.04,.78,p.y),a=atan(p.z,p.x),delay=p.y*6.5;
    p.x+=free*(.034*sin(time*.76-delay+phase)+.011*sin(time*.43+p.y*9.+a*2.+phase));
    p.z+=free*(.028*sin(time*.62-delay+phase+1.)+.008*sin(time*.89+p.y*8.+a*3.));
    p.y+=free*.016*sin(a*5.+time*.72+phase-p.y*4.);
    float sway=.018*sin(time*.53+phase)+.007*sin(time*.91+phase*1.4);
    float c=cos(sway),s=sin(sway);p.xy=mat2(c,-s,s,c)*p.xy;
    vec4 view=modelViewMatrix*instanceMatrix*vec4(p,1.);pView=view.xyz;gl_Position=projectionMatrix*view;}`,
  fragmentShader:`varying float presence,phase,surface;varying vec3 pLocal,pView;uniform float time,strength;uniform vec3 spectralTone;
   void main(){
    // Derivatives preserve the broad low-poly planes after deformation.
    vec3 n=normalize(cross(dFdx(pView),dFdy(pView)));float facing=abs(dot(n,normalize(-pView))),rim=pow(1.-facing,2.8);
    float light=max(0.,dot(n,normalize(vec3(-.45,.75,.65))));
    float flow=.5+.5*sin(pLocal.y*6.-time*.51+phase+.35*sin(pLocal.x*8.+time*.27));
    vec3 violet=mix(vec3(.30,.055,.67),spectralTone,.24);
    vec3 color=violet*(.66+.37*light)+spectralTone*rim*.16;
    color*=.97+.03*flow;
    float hem=smoothstep(-.015,.16+.022*flow,pLocal.y);
    float alpha=presence*strength*hem*(.70+.09*rim);
    if(surface>.5){color=vec3(.015,.004,.030)*(1.+light*.18);alpha=presence*strength*.98;}
    gl_FragColor=vec4(color,alpha);}`
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
