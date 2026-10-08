import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import { createVeilWanderers } from './veil-wanderers.js';

const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

// One controller, one existing update loop. Ritual and pond own their states.
export function createVeil({scene,camera,renderer,witch,familiar,skulls,portal,environment,lanterns,canEnter}){
 const root=new THREE.Group();root.name='veil-presence';root.visible=false;scene.add(root);
 const spectralTone=new THREE.Color('#9ab2ed');
 const shared={time:{value:0},strength:{value:0},spectralTone:{value:spectralTone}};
 // Reuse the clothed surfaces, with a small procedural joint adapter on GPU.
 // Physical legs/boots are excluded only from this astral representation.
 witch.root.updateMatrixWorld(true);
 const characterHeight=new THREE.Box3().setFromObject(witch.root).getSize(V()).y;
 const wanderers=createVeilWanderers({parent:root,shared,characterHeight});
 const inverse=witch.root.matrixWorld.clone().invert(),parts=[];
 function append(g,color,part){
  if(g.index){const old=g;g=g.toNonIndexed();old.dispose()}
  for(const key of Object.keys(g.attributes))if(!['position','normal'].includes(key))g.deleteAttribute(key);
  const colors=new Float32Array(g.attributes.position.count*3),motion=new Float32Array(g.attributes.position.count);motion.fill(part);
  for(let i=0;i<g.attributes.position.count;i++)color.toArray(colors,i*3);
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('astralPart',new THREE.BufferAttribute(motion,1));parts.push(g);
 }
 witch.root.traverse(o=>{
  if(!o.isMesh||!o.visible)return;
  let ancestor=o,part=o.name==='shoulder-cloak'?6:0,arm=0;
  while(ancestor){
   if(ancestor.name==='leftLegPivot'||ancestor.name==='rightLegPivot')return;
   if(ancestor.name==='headRoot')part=1;
   if(ancestor.name==='leftArmPivot')arm=-1;if(ancestor.name==='rightArmPivot')arm=1;
   ancestor=ancestor.parent;
  }
  let g=o.geometry.clone();
  g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
  if(arm){g.computeBoundingBox();part=(arm<0?2:4)+(g.boundingBox.getCenter(V()).y<.69?1:0)}
  append(g,o.material.color??new THREE.Color('#8273b4'),part);
 });
 // Continuous tapered energy volumes flow out of the skirt instead of feet.
 function spectralTail(points,radii,segments,sides,part){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p))),g=new THREE.TubeGeometry(curve,segments,1,sides,false),a=g.attributes.position,c=V(),v=V();
  for(let i=0;i<=segments;i++){
   const t=i/segments,r=t*(radii.length-1),k=Math.min(radii.length-2,Math.floor(r)),radius=lerp(radii[k],radii[k+1],r-k);c.copy(curve.getPointAt(t));
   for(let j=0;j<=sides;j++){const n=i*(sides+1)+j;v.fromBufferAttribute(a,n).sub(c).multiplyScalar(radius);v.z*=.72;v.add(c);a.setXYZ(n,v.x,v.y,v.z);}
  }
  g.computeVertexNormals();append(g,new THREE.Color('#a6b8df'),part);
 }
 spectralTail([[0,.24,.005],[0,.14,-.04],[.035,.035,-.11],[.10,-.065,-.18],[.175,-.15,-.20],[.18,-.235,-.14],[.105,-.30,-.095]], [.292,.215,.155,.109,.064,.030,.002],30,16,7);
 const ghostGeometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
 const ghostUniforms={...shared,opacity:{value:0},drift:{value:new THREE.Vector2()}};
 // Keep both passes on the same gently drifting surface: cloth still occludes
 // interior parts even where the outer silhouette becomes translucent.
 const ghostVertex=`attribute float astralPart;varying vec3 nView,pView,pLocal,shade;varying float part;uniform float time;uniform vec2 drift;
  vec3 rx(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}
  vec3 ry(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
  vec3 rz(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}
  void main(){pLocal=position;shade=color;part=astralPart;vec3 p=position,n=normal;
   if(part>1.5&&part<5.5){
    float side=part<3.5?-1.:1.;vec3 shoulder=vec3(side*.19,.85,0.),elbow=vec3(side*.23,.65,0.);
    float fore=-.18+.17*sin(time*.71+side*.8)-drift.y*.045;
    if(part==3.||part==5.){p=elbow+rx(p-elbow,fore);n=rx(n,fore);}
    float open=side*(.17+.12*sin(time*.83+side*1.3)+.045*abs(drift.x));float swing=.10*sin(time*.63+side*.6)-drift.y*.038;
    p=shoulder+rz(rx(p-shoulder,swing),open);n=rz(rx(n,swing),open);
   }
   if(part==1.){vec3 pivot=vec3(0.,.995,0.);float yaw=.10*sin(time*.57)+.035*sin(time*.97+.5),nod=.055*sin(time*.73+.4);
    p=pivot+ry(rx(p-pivot,nod),yaw);n=ry(rx(n,nod),yaw);float hair=1.-smoothstep(.74,1.12,pLocal.y);p.z+=hair*.022*sin(time*.91+pLocal.x*5.);}
   if(part<6.5){float spine=(part>=1.&&part<=5.)?1.:smoothstep(.57,.84,pLocal.y);float sway=(.045*sin(time*.69)+.018*sin(time*1.13+.7))*spine;
    p=vec3(0.,.57,0.)+rz(p-vec3(0.,.57,0.),sway);n=rz(n,sway);
    float hem=1.-smoothstep(.23,.83,pLocal.y);p.x+=sin(pLocal.y*6.+pLocal.z*3.-time*.82)*(.005+.027*hem);p.z-=hem*hem*(.030*sin(time*.74+pLocal.x*7.)+drift.y*.026);
   }else{float trail=clamp((.24-pLocal.y)/.54,0.,1.);float flow=pow(trail,1.4);
    // A travelling curl keeps the root attached and the tip alive even at rest.
    p.x+=flow*(.115*sin(time*1.35-trail*3.7)+.035*sin(time*.73+trail*6.1)-drift.x*.075);
    p.z+=flow*(.080*sin(time*1.09-trail*4.2+.8)+.020*sin(time*.61+trail*5.)-drift.y*.095);
    p.y+=sin(time*1.17-trail*4.8)*.023*trail;
   }
   nView=normalize(normalMatrix*n);vec4 view=modelViewMatrix*vec4(p,1.);pView=view.xyz;gl_Position=projectionMatrix*view;}`;
 const ghostMaterial=new THREE.ShaderMaterial({uniforms:ghostUniforms,transparent:true,depthWrite:false,side:THREE.FrontSide,vertexColors:true,
  vertexShader:ghostVertex,
  fragmentShader:`varying vec3 nView,pView,pLocal,shade;varying float part;uniform float time,opacity;uniform vec3 spectralTone;
   void main(){float facing=abs(dot(normalize(nView),normalize(-pView)));float rim=pow(1.-facing,2.6);float silver=pow(1.-facing,7.);
    float light=.45+.55*max(0.,dot(normalize(nView),normalize(vec3(-.4,.8,.6))));float folds=dot(shade,vec3(.22,.60,.18));
    vec3 c=spectralTone*(.22+.54*clamp(folds*2.,0.,1.))*light;c+=spectralTone*.38*rim+vec3(.62,.72,.86)*silver*.30;
    float flow=.5+.5*sin(pLocal.y*7.-time*.42+sin(pLocal.x*4.+pLocal.z*3.+time*.31));float hem=1.-smoothstep(.08,.52,pLocal.y);
    float veil=.80-.14*rim-.12*hem*(.4+.6*flow);float breath=.97+.03*sin(pLocal.y*4.-time*.55);
    if(part>6.5){float tip=1.-smoothstep(-.40,.22,pLocal.y);veil*=1.-tip*.67;c=mix(c,spectralTone*(.60+.26*rim),.52);}
    gl_FragColor=vec4(c*breath,opacity*veil);}`
 });
 const projection=new THREE.Mesh(ghostGeometry,ghostMaterial);projection.name='witch-astral-projection';projection.frustumCulled=false;projection.renderOrder=9;root.add(projection);
 // Resolve the closest dressed surface before blending. Interior anatomy cannot
 // accumulate through the skirt/cape; this shares the existing merged geometry.
 const depthShell=new THREE.Mesh(ghostGeometry,new THREE.ShaderMaterial({uniforms:ghostUniforms,vertexColors:true,vertexShader:ghostVertex,fragmentShader:'void main(){gl_FragColor=vec4(0.);}',colorWrite:false,depthWrite:true,transparent:true,side:THREE.FrontSide}));
 depthShell.name='astral-dressed-depth';depthShell.frustumCulled=false;depthShell.renderOrder=8;root.add(depthShell);
 const segmentCount=40,linePositions=new Float32Array((segmentCount+1)*2*3),uv=[],indices=[];
 for(let i=0;i<=segmentCount;i++){uv.push(i/segmentCount,0,i/segmentCount,1);if(i<segmentCount){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2)}}
 const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.BufferAttribute(linePositions,3));lineGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));lineGeometry.setIndex(indices);
 const tetherUniforms={...shared,tension:{value:0},opacity:{value:0}};
 const lineMaterial=new THREE.ShaderMaterial({uniforms:tetherUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 vUv;uniform float time,tension,opacity;void main(){float edge=pow(max(0.,1.-abs(vUv.y*2.-1.)),2.);float core=pow(edge,7.);float pulse=.76+.24*sin(vUv.x*12.-time*1.1);vec3 c=mix(vec3(.26,.19,.48),vec3(.69,.64,.84),core);gl_FragColor=vec4(c*(1.+tension*.5),opacity*edge*pulse);}`
 });
 const tether=new THREE.Mesh(lineGeometry,lineMaterial);tether.name='astral-lifeline';tether.frustumCulled=false;root.add(tether);
 // Low billboards stay at the edges; there is no full-screen fog overlay.
 const mistUniforms={...shared};
 const mistMaterial=new THREE.ShaderMaterial({uniforms:mistUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:`varying vec2 vUv;varying vec3 pWorld;varying float phase;uniform float time;void main(){vUv=uv;phase=instanceMatrix[3].x*.73+instanceMatrix[3].z*1.17;vec3 p=position;p.x+=.018*sin(time*.17+phase);vec4 world=modelMatrix*instanceMatrix*vec4(p,1.);pWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader:`varying vec2 vUv;varying vec3 pWorld;varying float phase;uniform float time,strength;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
   float cloud(vec2 p){return noise(p)*.57+noise(p*2.07+7.1)*.28+noise(p*4.13-5.3)*.15;}
   void main(){vec2 p=vUv*2.-1.;vec2 drift=vec2(time*.024+phase,-time*.016);vec2 warp=vec2(noise(vUv*3.+drift),noise(vUv*3.-drift+3.4));
    float n=cloud(vUv*vec2(4.,2.7)+warp*.95+drift);float envelope=exp(-p.x*p.x*2.9-p.y*p.y*7.5);
    float perimeter=smoothstep(2.35,3.65,length(pWorld.xz-vec2(0.,.3)));float curl=smoothstep(.22,.79,n);
    float filament=exp(-pow((vUv.y-(.47+.16*sin(vUv.x*5.+warp.x*2.+phase+time*.11)))/.12,2.))*smoothstep(.38,.74,n);
    vec3 c=mix(vec3(.11,.14,.25),vec3(.31,.28,.46),n);c+=vec3(.10,.14,.23)*filament;
    gl_FragColor=vec4(c,strength*perimeter*envelope*(curl*.53+filament*.09));}`
 });
 const mistAnchors=[[-4.4,.33,2.1],[4.15,.31,-1.7],[-2.8,.36,-3.45],[4.2,.28,3.5],[.15,.29,4.65],[-4.85,.32,-.7],[2.35,.34,-3.95],[5.15,.27,.6],[-3.3,.29,3.55],[2.15,.26,4.35],[-4.25,.30,-2.15],[.15,.27,-4.45],[-3.85,.28,-2.8],[4.65,.25,1.8]];
 const mist=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),mistMaterial,mistAnchors.length);mist.name='veil-low-wisps';mist.frustumCulled=false;root.add(mist);
 const billboard=new THREE.Object3D();for(let i=0;i<mistAnchors.length;i++){billboard.position.set(...mistAnchors[i]);billboard.quaternion.copy(camera.quaternion);billboard.scale.set(3.25+(i%3)*.28,.74+(i%2)*.16,1);billboard.updateMatrix();mist.setMatrixAt(i,billboard.matrix)}
 // Sixty-four fixed slots: eyes, passive auras, portal dust and a short trail.
 const count=64,pointPositions=new Float32Array(count*3),pointSizes=new Float32Array(count),pointAlpha=new Float32Array(count),pointColors=new Float32Array(count*3);
 const pointsGeometry=new THREE.BufferGeometry();pointsGeometry.setAttribute('position',new THREE.BufferAttribute(pointPositions,3));pointsGeometry.setAttribute('size',new THREE.BufferAttribute(pointSizes,1));pointsGeometry.setAttribute('alpha',new THREE.BufferAttribute(pointAlpha,1));pointsGeometry.setAttribute('color',new THREE.BufferAttribute(pointColors,3));
 for(let i=0;i<count;i++)new THREE.Color(i<20?'#b2c8ff':i%3?'#9ab2ed':'#d4e2ff').toArray(pointColors,i*3);
 const pointsMaterial=new THREE.ShaderMaterial({uniforms:{...shared,pixelRatio:{value:renderer.getPixelRatio()}},transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,
  vertexShader:`attribute float size,alpha;varying float vAlpha;varying vec3 vColor;uniform float pixelRatio;void main(){vAlpha=alpha;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size*pixelRatio;}`,
  fragmentShader:`varying float vAlpha;varying vec3 vColor;uniform float strength;void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*6.)*(1.-smoothstep(.75,1.,d));gl_FragColor=vec4(vColor,strength*vAlpha*a);}`
 });
 const points=new THREE.Points(pointsGeometry,pointsMaterial);points.name='veil-spiritual-points';points.frustumCulled=false;root.add(points);
 const bodyAnchor=V(),ghostAnchor=V(),point=V(),side=V(),direction=V();camera.getWorldDirection(direction);
 const worldMaterials=new Map(),lightBases=[],warmSurfaces=[];
 const lampBases=lanterns.map(l=>({lamp:l,glassColor:l.glass.color.clone()}));
 const bodyMaterials=new Set(),catMaterials=new Set(),catEyes=new Set();witch.root.traverse(o=>{if(o.material)bodyMaterials.add(o.material)});familiar.root.traverse(o=>{if(o.material){catMaterials.add(o.material);if(o.name==='cat-almond-eyes')catEyes.add(o.material)}});
 scene.traverse(o=>{
  if(o.isLight)lightBases.push({light:o,color:o.color.clone(),ground:o.groundColor?.clone(),intensity:o.intensity,live:o.intensity});
  if(!o.isMesh||!o.layers.test(camera.layers))return;
  let parent=o,excluded=false;while(parent){if(parent===root||parent.name==='ritual'||parent.name==='scrying-vision')excluded=true;parent=parent.parent}if(excluded)return;
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   if(m.isMeshBasicMaterial&&m.toneMapped===false&&m.color.r>m.color.b*1.5&&!lampBases.some(b=>b.lamp.core===m||b.lamp.glass===m)&&!warmSurfaces.some(b=>b.material===m))warmSurfaces.push({material:m,color:m.color.clone()});
   if(!m.isMeshStandardMaterial||bodyMaterials.has(m)||worldMaterials.has(m))continue;
   const base=m.color.clone(),luma=base.r*.2126+base.g*.7152+base.b*.0722;
   const cold=base.clone().lerp(new THREE.Color(luma*.70,luma*.76,luma*1.02),.42);
   worldMaterials.set(m,{base,cold,emissive:m.emissive.clone(),isCat:catMaterials.has(m),isEye:catEyes.has(m),eyeIntensity:m.emissiveIntensity,warm:m.emissive.r>m.emissive.b*1.5});
  }
 });
 // Reveal the familiar's contour on its existing materials, without another cat.
 for(const m of catMaterials){
  if(!m.isMeshStandardMaterial||catEyes.has(m))continue;
  const compile=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=shader=>{compile.call(m,shader);shader.uniforms.astralPresence=shared.strength;shader.uniforms.astralTone=shared.spectralTone;shader.fragmentShader='uniform float astralPresence;uniform vec3 astralTone;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   float catRim=pow(1.-abs(dot(normal,normalize(vViewPosition))),2.3);
   float catLight=.48+.52*max(0.,dot(normal,normalize(vec3(-.4,.8,.6))));
   vec3 catSpirit=astralTone*(.50*catLight+.30*catRim);
   outgoingLight=mix(outgoingLight,catSpirit,astralPresence);
   #include <opaque_fragment>`)};
  m.customProgramCacheKey=()=>key+'familiar-spirit-v1';m.needsUpdate=true;
 }
 const bodyBases=[...bodyMaterials].filter(m=>m.emissive).map(m=>({material:m,emissive:m.emissive.clone()}));
 const bodySoft=new THREE.Color('#30364c');
 const fogBase={color:scene.fog.color.clone(),density:scene.fog.density};
 const fogCold=new THREE.Color('#232944'),moonCold=new THREE.Color('#afb6f5'),warmCold=spectralTone;
 const trail=Array.from({length:12},()=>V());let trailTime=0,trailCursor=0;
 let state='VEIL_PHYSICAL',elapsed=0,clock=0,weight=0,meditation=0,opacity=0,entryCount=0,exitCount=0,lastWeight=-1;
 const origin=V(),velocity=V(),returnFrom=V();let distance=0,tension=0,returnOpacity=0,returnWeight=0,returnMeditation=0;
 const softLimit=4.8,hardLimit=6.0;
 function active(){return state!=='VEIL_PHYSICAL'}
 function toggle(){
  if(state==='VEIL_ENTERING'||state==='VEIL_RETURNING')return false;
  if(state==='VEIL_ACTIVE'){
   state='VEIL_RETURNING';elapsed=0;returnFrom.copy(projection.position);returnOpacity=opacity;returnWeight=weight;returnMeditation=meditation;velocity.set(0,0,0);return true;
  }
  if(!canEnter()||!witch.isStable())return false;
  state='VEIL_ENTERING';elapsed=0;entryCount++;origin.copy(witch.root.position);projection.position.copy(origin);projection.rotation.copy(witch.root.rotation);velocity.set(0,0,0);
  trail.forEach(p=>p.copy(origin));trailTime=0;root.visible=true;witch.setAstralPose({locked:true,meditation:0});return true;
 }
 function restoreLights(){if(weight>0)for(const b of lightBases){b.light.intensity=b.live;b.light.color.copy(b.color);if(b.ground)b.light.groundColor.copy(b.ground)}}
 // Called before the existing character update; the body pose is orthogonal to E.
 function prepare(dt){
  restoreLights();clock+=dt;if(!active())return;
  elapsed+=dt;
  if(state==='VEIL_ENTERING'){
   meditation=ease(elapsed/1.05);const emerge=ease((elapsed-1.04)/1.06);
   weight=ease((elapsed-.72)/1.38);opacity=emerge;
   projection.position.copy(origin).add(V(.34*emerge,.12*emerge,.36*emerge));
   if(elapsed>=2.1){state='VEIL_ACTIVE';elapsed=0;weight=opacity=meditation=1;}
  }else if(state==='VEIL_ACTIVE'){
   const requested=witch.movementInput();if(requested.lengthSq()>0)requested.normalize();
   const radial=projection.position.clone().sub(origin).setY(0);distance=radial.length();tension=ease((distance-softLimit)/(hardLimit-softLimit));
   const outward=distance>0?requested.dot(radial.clone().normalize()):0;if(outward>0)requested.addScaledVector(radial.normalize(),-outward*tension*.94);
   requested.multiplyScalar(1.65);velocity.lerp(requested,1-Math.exp(-7*dt));projection.position.addScaledVector(velocity,dt);
   const offset=projection.position.clone().sub(origin).setY(0);if(offset.length()>hardLimit){offset.setLength(hardLimit);projection.position.x=origin.x+offset.x;projection.position.z=origin.z+offset.z;const n=offset.normalize(),v=velocity.dot(n);if(v>0)velocity.addScaledVector(n,-v)}
   // The same island footprint; no navigation library, map copy or free flight.
   const island=Math.hypot(projection.position.x/6.15,(projection.position.z-.3)/5.15);if(island>1){projection.position.x/=island;projection.position.z=.3+(projection.position.z-.3)/island;velocity.multiplyScalar(.75)}
   if(velocity.length()>.015){const yaw=Math.atan2(velocity.x,velocity.z),delta=Math.atan2(Math.sin(yaw-projection.rotation.y),Math.cos(yaw-projection.rotation.y));projection.rotation.y+=delta*(1-Math.exp(-6*dt))}
  }else if(state==='VEIL_RETURNING'){
   const merge=ease(elapsed/1.18);projection.position.lerpVectors(returnFrom,origin,merge);projection.position.y+=.08*Math.sin(merge*Math.PI);
   opacity=returnOpacity*(1-ease((elapsed-.85)/.55));weight=returnWeight*(1-ease((elapsed-.72)/1.38));meditation=returnMeditation*(1-ease((elapsed-1.12)/.98));
   tension=1-ease((elapsed-1)/.55);
   if(elapsed>=2.1){state='VEIL_PHYSICAL';elapsed=0;weight=opacity=meditation=0;root.visible=false;exitCount++;witch.setAstralPose({locked:false,meditation:0});}
  }
  // Two incommensurate rhythms avoid a mechanical hover loop. Movement tilts
  // toward the drift, with exponential smoothing rather than a walk cycle.
  if(state==='VEIL_ENTERING'||state==='VEIL_ACTIVE')projection.position.y=origin.y+opacity*(.38+.034*Math.sin(clock*1.19)+.017*Math.sin(clock*.67+.8));
  const localForward=velocity.x*Math.sin(projection.rotation.y)+velocity.z*Math.cos(projection.rotation.y),localSide=velocity.x*Math.cos(projection.rotation.y)-velocity.z*Math.sin(projection.rotation.y);
  ghostUniforms.drift.value.lerp(new THREE.Vector2(localSide,localForward),1-Math.exp(-3*dt));
  const floatPitch=opacity*(Math.sin(clock*.79)*.033+Math.sin(clock*.43+.4)*.013+localForward*.035);
  const floatRoll=opacity*(Math.sin(clock*.91+.7)*.032-localSide*.043);
  projection.rotation.x=lerp(projection.rotation.x,floatPitch,1-Math.exp(-3.8*dt));projection.rotation.z=lerp(projection.rotation.z,floatRoll,1-Math.exp(-3.8*dt));
  if(active())witch.setAstralPose({locked:true,meditation});
 }
 function put(i,p,size,alpha){p.toArray(pointPositions,i*3);pointSizes[i]=size;pointAlpha[i]=alpha}
 function present(dt){
  shared.time.value=clock;shared.strength.value=weight;ghostUniforms.opacity.value=opacity;depthShell.visible=opacity>.001;depthShell.position.copy(projection.position);depthShell.rotation.copy(projection.rotation);
  wanderers.update(dt,weight,state==='VEIL_ENTERING'||state==='VEIL_ACTIVE');
  environment.setVeilStrength(weight);portal.uniforms.veilStrength.value=weight;
  if(lastWeight!==weight){
   for(const [m,b] of worldMaterials){m.color.copy(b.base).lerp(b.cold,weight);if(b.isEye){m.color.lerp(spectralTone,weight);m.emissive.copy(b.emissive).lerp(spectralTone,weight);m.emissiveIntensity=lerp(b.eyeIntensity,.72,weight)}else if(b.isCat)m.emissive.copy(b.emissive);else if(b.warm)m.emissive.copy(b.emissive).multiplyScalar(1-weight*.72)}
   for(const b of bodyBases)b.material.emissive.copy(b.emissive).lerp(bodySoft,weight*.26);
   scene.fog.color.copy(fogBase.color).lerp(fogCold,weight);for(const b of warmSurfaces)b.material.color.copy(b.color).lerp(spectralTone,weight);
   scene.fog.density=lerp(fogBase.density,.042,weight);lastWeight=weight;
  }
  for(const b of lightBases){
   b.live=b.light.intensity;if(weight===0)continue;
   const warm=b.color.r>b.color.b*1.5;b.light.color.copy(b.color).lerp(warm?warmCold:moonCold,weight*(warm?1:.32));b.light.intensity=b.live*lerp(1,warm?.76:b.light.isDirectionalLight&& !b.light.castShadow?1.7:1.22,weight);
   if(b.ground)b.light.groundColor.copy(b.ground).lerp(new THREE.Color('#232746'),weight*.60);
  }
  // The garden animation restores each core's live flicker before this step.
  for(const b of lampBases){const l=b.lamp,flicker=l.core.color.r/Math.max(l.baseColor.r,.0001);l.core.color.lerp(spectralTone.clone().multiplyScalar(flicker),weight);l.glass.color.copy(b.glassColor).lerp(spectralTone,weight);}
  for(const skull of skulls)for(const b of skull.userData.ritualBoneMaterials??[])if(weight>0)b.material.emissive.copy(b.baseEmissive).lerp(spectralTone,weight*.17);
  if(!active())return;
  distance=Math.hypot(projection.position.x-origin.x,projection.position.z-origin.z);if(state==='VEIL_ACTIVE')tension=ease((distance-softLimit)/(hardLimit-softLimit));
  bodyAnchor.copy(origin).add(V(0,.81-.34*meditation,0));ghostAnchor.copy(projection.position).add(V(0,.79,0).applyQuaternion(projection.quaternion));
  const tangent=ghostAnchor.clone().sub(bodyAnchor);side.crossVectors(tangent,direction).normalize();if(side.lengthSq()<.01)side.set(1,0,0);
  const width=lerp(.046,.024,clamp(distance/hardLimit,0,1));
  for(let i=0;i<=segmentCount;i++){
   const u=i/segmentCount,wave=Math.sin(Math.PI*u),swirl=Math.sin(u*9.-clock*.85)*.045*wave;
   point.lerpVectors(bodyAnchor,ghostAnchor,u);point.y+=wave*(.34+.12*Math.sin(u*4.+clock*.65));point.addScaledVector(side,swirl);
   const taper=width*(.65+.35*wave);point.clone().addScaledVector(side,-taper).toArray(linePositions,i*6);point.clone().addScaledVector(side,taper).toArray(linePositions,i*6+3);
  }
  lineGeometry.attributes.position.needsUpdate=true;tetherUniforms.tension.value=tension;tetherUniforms.opacity.value=opacity*.85;
  // These passive skull eyes never touch ritual responders or lights.
  for(let k=0;k<5;k++){
   const skull=skulls[k];skull.updateMatrixWorld(true);
   for(let j=0;j<2;j++){point.copy(skull.userData.ritualEyes?.[j]??V(j?.093:-.093,.24,.197));skull.localToWorld(point);put(k*2+j,point,12,.96+.12*Math.sin(clock*1.2+k*1.83));}
   for(let j=0;j<2;j++){const phase=clock*.32+k*1.9+j*Math.PI;point.copy(skull.position).add(V(Math.cos(phase)*.16,.42+j*.10+Math.sin(phase)*.06,Math.sin(phase)*.12));put(10+k*2+j,point,21,.38+.09*Math.sin(clock*.8+k));}
  }
  familiar.root.updateMatrixWorld(true);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2+clock*.17;point.set(Math.cos(a)*.23,.22+Math.sin(a)*.09,Math.sin(a)*.27);familiar.root.localToWorld(point);put(20+i,point,i<2?10:7,.18);}
  for(let i=0;i<12;i++){const u=(i/12+clock*.043)%1;point.set((i%2?1:-1)*(.68*(1-u)+Math.sin(clock*.19+i)*.10*u),.25+u*2.05,-4.66+Math.sin(i+clock*.14)*.08);put(26+i,point,3.2,.30*Math.sin(u*Math.PI));}
  trailTime+=dt;if(trailTime>=.095){trailTime%=.095;trail[trailCursor].copy(projection.position);trailCursor=(trailCursor+1)%12;}
  for(let i=0;i<12;i++){const age=(trailCursor-1-i+12)%12;point.copy(trail[age]).add(V(Math.sin(i+clock)*.045,.27+i*.006,Math.cos(i+clock)*.04));put(38+i,point,3.5,opacity*(velocity.length()>.02?.30:.08)*(1-i/12));}
  for(let i=0;i<11;i++){const a=i*2.39996+Math.sin(clock*.07+i)*.035,r=4.3+(i%3)*.22;point.set(Math.cos(a)*r+Math.sin(clock*.14+i)*.12,.25+(i%4)*.12+Math.sin(clock*.21+i)*.08,.3+Math.sin(a)*r*.90);put(50+i,point,3.3,.18+.045*Math.sin(clock*.32+i))}
  for(let i=0;i<3;i++){const a=i*2.1+.5;point.set(Math.cos(a)*4.9,.85+Math.sin(clock*.19+i)*.12,.3+Math.sin(a)*4.1);put(61+i,point,13,.11+.055*Math.sin(clock*.45+i*2))}
  for(const key of ['position','size','alpha'])pointsGeometry.attributes[key].needsUpdate=true;
 }
 function snapshot(){return {state,amount:weight,meditation,opacity,x:projection.position.x,z:projection.position.z,y:projection.position.y,tilt:[projection.rotation.x,projection.rotation.z],body:origin.toArray(),distance,tension,speed:velocity.length(),limit:hardLimit,softLimit,entryCount,exitCount,particles:active()?count:0,additionalLights:0,additionalPasses:0,surface:'depth-resolved-dressed-shell',silhouette:'articulated-drifting-wisps',lowerBody:'single-flowing-energy-tail-no-feet',motion:'shoulder-elbow-head-spine-cloth',characterHeight,mistPlacement:'perimeter-clear-center',projectionSpeed:1.65,mistInstances:mistAnchors.length,spectralColor:'#9ab2ed',wanderers:wanderers.snapshot()}}
 return {root,projection,active,toggle,prepare,present,snapshot,observation:()=>active()?{x:projection.position.x,z:projection.position.z,amount:weight}:null};
}
