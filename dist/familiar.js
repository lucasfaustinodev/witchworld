import * as THREE from './vendor/three.module.js';
import {mergeGeometries,mergeVertices} from './vendor/addons/utils/BufferGeometryUtils.js';

export const CAT_STATES=Object.freeze(['CAT_IDLE','CAT_WALK','CAT_SIT','CAT_LOOK','CAT_FOLLOW','CAT_RITUAL']);
// Physical / astral low-poly familiar. Route decisions and simulation clocks are preserved.
export function createFamiliar({scene,pavers=[]}){
 const root=new THREE.Group();root.name='black-cat-familiar';scene.add(root);
 const coat=new THREE.MeshStandardMaterial({color:'#171827',roughness:.72,flatShading:true}),soft=new THREE.MeshStandardMaterial({color:'#202134',roughness:.77,flatShading:true}),earMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9,vertexColors:true,flatShading:true}),eyeMaterial=new THREE.MeshStandardMaterial({color:'#a0b85b',emissive:'#637c2c',emissiveIntensity:.22,roughness:.38});
 // One material family for both planes: no duplicate cat, lights or render passes.
 const pupilMaterial=coat.clone();pupilMaterial.color.set('#080912');
 const spectral={amount:{value:0},time:{value:0}};
 for(const m of [coat,soft,earMaterial,eyeMaterial,pupilMaterial]){
  m.userData.familiarSpectral=true;m.transparent=true;m.depthWrite=true;
  const isEye=m===eyeMaterial,isPupil=m===pupilMaterial;
  m.onBeforeCompile=shader=>{
   shader.uniforms.catAstral=spectral.amount;shader.uniforms.catTime=spectral.time;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 catLocal;').replace('#include <project_vertex>','catLocal=transformed;\n#include <project_vertex>');
   shader.fragmentShader='uniform float catAstral,catTime;varying vec3 catLocal;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
    float rim=pow(1.-abs(dot(normal,normalize(vViewPosition))),2.1);
    float lightSide=.36+.64*max(0.,dot(normal,normalize(vec3(-.4,.8,.55))));
    float flow=.5+.5*sin(catLocal.y*13.+catLocal.z*9.-catTime*.9);
    vec3 astral=mix(vec3(.095,.035,.20),vec3(.40,.18,.66),lightSide);
    astral+=vec3(.41,.23,.68)*rim*.65+vec3(.13,.055,.22)*flow*.12;
    ${isEye?'astral=vec3(.56,.70,.22)*(1.05+rim*.15);':isPupil?'astral=vec3(.022,.01,.045);':''}
    outgoingLight=mix(outgoingLight,astral,catAstral);
    diffuseColor.a*=1.-catAstral*${isEye?'.03':'.16'};
    #include <opaque_fragment>`);
  };
  m.customProgramCacheKey=()=>isEye?'familiar-lowpoly-eye-v1':isPupil?'familiar-lowpoly-pupil-v1':'familiar-lowpoly-violet-v1';
 }
 const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),mix=THREE.MathUtils.lerp,damp=(a,b,k,dt)=>mix(a,b,1-Math.exp(-k*dt));
 function surface(positions,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);const welded=mergeVertices(g,1e-6);g.dispose();welded.computeVertexNormals();return welded;}
 function shape(parent,parts,m,name){const g=parts.length===1?parts[0]:mergeGeometries(parts,false);if(parts.length>1)parts.forEach(p=>p.dispose());const mesh=new THREE.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name||'';parent.add(mesh);return mesh;}
 // A single closed loft: spline of elliptical sections, perpendicular to the spine.
 // Topology stays identical in standing/sitting shapes; GPU morphing handles the pose.
 function loft(sections,rows=20,sides=12){
  const spine=new THREE.CatmullRomCurve3(sections.map(s=>V(0,s[0],s[1])),false,'catmullrom',.25);
  const profile=new THREE.CatmullRomCurve3(sections.map((s,i)=>V(i/(sections.length-1),s[2],s[3])),false,'catmullrom',.25);
  const positions=[],indices=[];
  for(let i=0;i<=rows;i++){const t=i/rows,c=spine.getPoint(t),d=spine.getTangent(t),r=profile.getPoint(t),rx=Math.max(0,r.y),ry=Math.max(0,r.z);
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;positions.push(Math.cos(a)*rx,c.y+Math.sin(a)*ry*d.z,c.z-Math.sin(a)*ry*d.y);}
  }
  for(let i=0;i<rows;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
  return surface(positions,indices);
 }
 function morph(base,targets){base.morphAttributes.position=targets.map(g=>g.attributes.position);base.morphAttributes.normal=targets.map(g=>g.attributes.normal);base.computeBoundingSphere();return base;}
 const body=new THREE.Group();root.add(body);
 const torsoStanding=loft([[.33,-.35,0,0],[.35,-.30,.071,.075],[.355,-.22,.112,.112],[.345,-.11,.089,.093],[.35,.005,.083,.098],[.37,.115,.098,.135],[.415,.20,.082,.106],[.47,.245,.061,.078],[.52,.265,.051,.052],[.54,.275,0,0]]);
 const torsoSitting=loft([[.027,-.22,0,0],[.08,-.20,.092,.102],[.155,-.17,.136,.14],[.25,-.11,.111,.126],[.345,-.048,.087,.098],[.43,.005,.083,.086],[.50,.034,.067,.075],[.555,.058,.051,.064],[.594,.074,.041,.045],[.612,.078,0,0]]);
 const torso=shape(body,[morph(torsoStanding,[torsoSitting])],coat,'cat-continuous-torso');
 const head=new THREE.Bone();head.name="cat-head-control";head.position.set(0,.545,.285);body.add(head);
 // Explicit cheek / brow / muzzle sections, rather than a squeezed spherical head.
 // Eye patches sample the actual front triangles so they cannot sink into the face.
 const faceRows=[[-.115,.035,.022,.026],[-.094,.031,.061,.055],[-.062,.022,.100,.084],[-.025,.010,.139,.112],[.022,-.005,.150,.119],[.067,-.012,.136,.104],[.105,-.023,.095,.074],[.126,-.029,.035,.028]];
 function felineHead(){const p=[],idx=[],sides=20;
  for(const [y,cz,rx,rz] of faceRows)for(let j=0;j<sides;j++){
   const a=j/sides*Math.PI*2,x=Math.sin(a)*rx,front=Math.max(0,Math.cos(a));
   const muzzle=.047*Math.exp(-(((y+.050)/.034)**2))*Math.exp(-((x/.061)**2))*front;
   p.push(x,y,cz+Math.cos(a)*rz+muzzle);
  }
  for(let i=0;i<faceRows.length-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;idx.push(a,b,c,b,d,c);}
  const bottom=p.length/3;p.push(0,-.122,.035);const top=p.length/3;p.push(0,.132,-.029);
  for(let j=0;j<sides;j++){idx.push(bottom,(j+1)%sides,j);const a=(faceRows.length-1)*sides+j,b=(faceRows.length-1)*sides+(j+1)%sides;idx.push(top,a,b);}
  return surface(p,idx);
 }
 const faceGeometry=felineHead();
 const faceRay=new THREE.Raycaster(),faceProbe=new THREE.Mesh(faceGeometry,coat);
 function faceZ(x,y){faceRay.set(V(x,y,.4),V(0,0,-1));const hit=faceRay.intersectObject(faceProbe,false);return hit.length?hit[0].point.z:.09;}
 shape(head,[faceGeometry],coat,'cat-sculpted-head');
 const nose=surface([0,-.052,.164,-.015,-.040,.158,.015,-.040,.158,0,-.055,.149],[0,2,1,0,1,3,0,3,2,1,2,3]);
 shape(head,[nose],pupilMaterial,'cat-nose');
 function eye(side,pupil=false){const p=[],idx=[],segments=20,rings=3,rx=pupil?.007:.045,ry=pupil?.025:.030;
  for(let i=0;i<=rings;i++)for(let j=0;j<=segments;j++){
   const a=j/segments*Math.PI*2,t=i/rings,x=side*.075+Math.cos(a)*rx*t,y=.025+Math.sin(a)*Math.sqrt(Math.abs(Math.sin(a)))*ry*t+side*Math.cos(a)*rx*t*.22;
   p.push(x,y,faceZ(x,y)+.003+(pupil?.002:0));
  }
  for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;idx.push(a,b,a+1,a+1,b,b+1);}return surface(p,idx);
 }
 const eyePivot=new THREE.Group();eyePivot.position.y=.025;head.add(eyePivot);
 const eyes=shape(eyePivot,[-1,1].map(s=>eye(s).translate(0,-.025,0)),eyeMaterial,'cat-almond-eyes');eyes.castShadow=false;
 const pupils=shape(eyePivot,[-1,1].map(s=>eye(s,true).translate(0,-.025,0)),pupilMaterial,'cat-pupils');pupils.castShadow=false;
 // Broad, thin triangular ears with curved faces and rounded integration at the base.
 function earGeometry(inner=false){const p=[],idx=[],rows=6,cols=4,h=inner?.105:.145,w=inner?.045:.069;
  for(let face=0;face<2;face++)for(let i=0;i<=rows;i++){const t=i/rows,width=w*Math.pow(1-t,.85);
   for(let j=0;j<=cols;j++){const u=j/cols*2-1;p.push(u*width+.012*t,h*t,(face?-.023*(1-t):.016+.009*Math.sin(t*Math.PI)*(1-u*u)));}
  }
  const n=(rows+1)*(cols+1);for(let face=0;face<2;face++)for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=face*n+i*(cols+1)+j,b=a+cols+1;if(face)idx.push(a,b,a+1,a+1,b,b+1);else idx.push(a,a+1,b,a+1,b+1,b);}
  for(let i=0;i<rows;i++)for(const j of [0,cols]){const a=i*(cols+1)+j,b=a+cols+1;idx.push(a,b,a+n,b,b+n,a+n);}for(let j=0;j<cols;j++)idx.push(j,j+n,j+1,j+1,j+n,j+n+1);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
 }
 const ears=[-1,1].map(side=>{const group=new THREE.Bone();group.name="cat-ear-control";group.position.set(side*.096,.077,-.015);group.rotation.z=-side*.19;head.add(group);const g=earGeometry(),colors=[];
  for(let face=0;face<2;face++)for(let i=0;i<=6;i++)for(let j=0;j<=4;j++){const inner=face===0&&i>0&&i<6&&j>0&&j<4;new THREE.Color(inner?'#53424f':'#162235').toArray(colors,colors.length);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));shape(group,[g],earMaterial,'cat-organic-ear');return group});
 // Four real skinned limbs. Blended joint bands remove the disconnected ball-joint look.
 // Two-link IK drives shoulder/hip and elbow/knee; ankle bone keeps the paw planted.
 const legs=[];
 function skinGeometry(g,weights){
  const ids=[],values=[];
  for(let i=0;i<g.attributes.position.count;i++){
   const pair=weights(i,g.attributes.position);ids.push(pair[0],pair[1],0,0);values.push(1-pair[2],pair[2],0,0);
  }
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));
  g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(values,4));return g;
 }
 for(const back of [false,true])for(const side of [-1,1]){
  const a=back?.15:.16,b=back?.145:.16,c=back?.08:0;
  const pivot=new THREE.Bone();pivot.name=back?'cat-hip':'cat-shoulder';pivot.rotation.order='ZXY';pivot.position.set(side*.072,.325,back?-.21:.17);body.add(pivot);
  const lower=new THREE.Bone();lower.name=back?'cat-knee':'cat-elbow';lower.position.y=-a;pivot.add(lower);
  const ankle=new THREE.Bone();ankle.name=back?'cat-hock':'cat-wrist';ankle.position.y=-b;lower.add(ankle);
  let paw=ankle;if(back){paw=new THREE.Bone();paw.name='cat-hind-paw';paw.position.y=-c;ankle.add(paw);}
  const length=a+b+c,sections=[[.095,0,0,0],[.065,0,back?.049:.026,back?.045:.027],[.014,0,back?.078:.045,back?.071:.044],[-.070,-.006,back?.063:.033,back?.053:.033],[-a+.023,0,back?.036:.025,back?.034:.027],[-a-.018,0,.026,.026],[-a-b+.032,0,.021,.023],[-a-b,0,.021,.023]];
  if(back)sections.push([-length+.030,0,.019,.020]);
  sections.push([-length,.012,.032,.022],[-length,.047,.037,.023],[-length,.075,.024,.017],[-length,.087,0,0]);
  const g=loft(sections,30,12),smooth=x=>{const t=THREE.MathUtils.clamp(x,0,1);return t*t*(3-2*t)};
  skinGeometry(g,(i,p)=>{
   const y=p.getY(i);
   if(y>-a-.05)return [0,1,smooth((-a+.035-y)/.070)];
   if(!back||y>-a-b-.035)return [1,2,smooth((-a-b+.028-y)/.056)];
   return [2,3,smooth((-length+.025-y)/.033)];
  });
  g.translate(pivot.position.x,pivot.position.y,pivot.position.z);
  const mesh=new THREE.SkinnedMesh(g,coat);mesh.name=back?'cat-skinned-hind-limb':'cat-skinned-fore-limb';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;body.add(mesh);
  root.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton(back?[pivot,lower,ankle,paw]:[pivot,lower,ankle]));
  legs.push({pivot,lower,ankle,paw,mesh,back,side,a,b,c,plant:V(),foot:V(),ready:false,inStance:false});
 }
 // Tapered tubes are built once; posed curves interpolate on GPU, never by a CPU vertex loop.
 function tailGeometry(points){const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p))),g=new THREE.TubeGeometry(curve,24,.032,8,false),a=g.attributes.position,c=V(),v=V();
  for(let i=0;i<=24;i++){c.copy(curve.getPointAt(i/24));const radius=.030*Math.pow(1-i/24,.72)+.003;
   for(let j=0;j<=8;j++){const n=i*9+j;v.fromBufferAttribute(a,n).sub(c).multiplyScalar(radius/.032).add(c);a.setXYZ(n,v.x,v.y,v.z);}}
  g.computeVertexNormals();return g;
 }
 const tail=new THREE.Group();body.add(tail);let tailAlertBlend=0;
 const tailPoints=[[0,0,0],[-.02,.08,-.13],[-.045,.24,-.23],[-.01,.39,-.20],[.07,.43,-.11],[.10,.39,-.055]];
 const tailStand=tailGeometry(tailPoints);
 const tailSit=tailGeometry([[0,0,0],[-.10,-.048,-.015],[-.23,-.055,.105],[-.23,-.053,.25],[-.135,-.053,.37]]);
 const tailAlert=tailGeometry([[0,0,0],[-.10,-.029,-.035],[-.23,-.025,.09],[-.24,.035,.24],[-.16,.065,.33]]);
 const tailShape=morph(tailStand,[tailSit,tailAlert]);
 skinGeometry(tailShape,i=>{const t=Math.floor(i/9)/24*4,k=Math.min(3,Math.floor(t));return [k,k+1,t-k]});
 const tailCurve=new THREE.CatmullRomCurve3(tailPoints.map(p=>V(...p))),tailBones=[];
 for(let i=0;i<5;i++){
  const bone=new THREE.Bone();bone.name='cat-tail-'+i;bone.position.copy(tailCurve.getPointAt(i/4));
  if(i){bone.position.sub(tailCurve.getPointAt((i-1)/4));tailBones[i-1].add(bone)}else tail.add(bone);
  tailBones.push(bone);
 }
 const tailMesh=new THREE.SkinnedMesh(tailShape,coat);tailMesh.name='cat-continuous-tail';tailMesh.castShadow=true;tailMesh.receiveShadow=true;tailMesh.frustumCulled=false;tail.add(tailMesh);root.updateMatrixWorld(true);tailMesh.bind(new THREE.Skeleton(tailBones));
 // All routes lie on a safe front/left arc, outside the entire stone platform.
 // The front-left arc avoids dense planted banks, the pond and rear buildings.
 const radius=3.95,minAngle=1.80,maxAngle=2.90;
 let angle=2.24,targetAngle=angle,clock=0,state='CAT_IDLE',stateTime=0,nextDecision=3.5,sit=0,travel=0,speed=0,headYaw=0,startled=0,lastLit=0,heading=-Math.PI/2,groundLevel=0,spirit=0,angularVelocity=0,hover=0,walkBlend=0;
 const visited=new Set([state]),safeCenter={x:0,z:.3};
 function switchState(next){if(next===state)return;state=next;stateTime=0;visited.add(next)}
 function targetAt(a){return V(Math.cos(a)*radius,0,.3+Math.sin(a)*radius)}
 const interest=[2.24,1.84,2.87,2.10];let interestIndex=0;
 const previousPosition=V(),displacement=V(),legTarget=V(),footParentQ=new THREE.Quaternion(),groundQ=new THREE.Quaternion();
 root.position.copy(targetAt(angle));
 function update(dt,pose,ritual,observation=null){
  spirit=THREE.MathUtils.clamp(observation?.veilTarget?.amount??0,0,1);spectral.amount.value=spirit;spectral.time.value=clock;
  const veilObserved=observation?.veilTarget&&Math.hypot(observation.veilTarget.x-root.position.x,observation.veilTarget.z-root.position.z)<3.8;
  const pondObserved=observation?.active&&observation.amount>.04,lookX=veilObserved?observation.veilTarget.x:pondObserved?observation.x:pose.x,lookZ=veilObserved?observation.veilTarget.z:pondObserved?observation.z:pose.z;
  clock+=dt;stateTime+=dt;const ritualWanted=pose.state==='sitting'||pose.state==='meditate'||ritual.state!=='inactive';
  if(ritualWanted){
   if(state!=='CAT_RITUAL'){const perches=[1.84,2.20,2.55,2.87];targetAngle=perches.reduce((best,a)=>Math.abs(a-angle)<Math.abs(best-angle)?a:best,perches[0]);switchState('CAT_RITUAL');}
  }
  else if(state==='CAT_RITUAL'){switchState('CAT_LOOK');nextDecision=clock+3.5;}
  else if(clock>=nextDecision){
   nextDecision=clock+4.8+(interestIndex%3)*1.7;
   if(state==='CAT_WALK'||state==='CAT_FOLLOW'){switchState('CAT_SIT');}
   else if(interestIndex%3===0){switchState('CAT_LOOK');interestIndex++;}
   else {targetAngle=interest[(++interestIndex)%interest.length];switchState('CAT_WALK');}
  }
  const witchAngle=THREE.MathUtils.clamp(Math.atan2(pose.z-.3,pose.x),minAngle,maxAngle);
  if(!ritualWanted&&pose.speed>.1&&state!=='CAT_WALK'&&state!=='CAT_FOLLOW'&&stateTime>2.8&&Math.hypot(pose.x-root.position.x,pose.z-root.position.z)>3.6&&Math.abs(witchAngle-angle)>.38){targetAngle=witchAngle;switchState('CAT_FOLLOW');nextDecision=clock+4;}
  const movingState=state==='CAT_WALK'||state==='CAT_FOLLOW'||state==='CAT_RITUAL';
  const gap=targetAngle-angle,step=Math.sign(gap)*Math.min(Math.abs(gap),dt*.49/radius);
  const old=previousPosition.copy(root.position);
  if(spirit>0){
   const desired=movingState?THREE.MathUtils.clamp(gap*1.8,-.49/radius,.49/radius):0;
   angularVelocity=damp(angularVelocity,desired,3.2,dt);
   const glide=Math.sign(angularVelocity)*Math.min(Math.abs(gap),Math.abs(angularVelocity)*dt);
   angle=THREE.MathUtils.clamp(angle+mix(movingState?step:0,glide,spirit),minAngle,maxAngle);
  }else{angularVelocity=0;if(movingState&&Math.abs(gap)>.005)angle=THREE.MathUtils.clamp(angle+step,minAngle,maxAngle);}
  root.position.copy(targetAt(angle));
  const delta=displacement.copy(root.position).sub(old);delta.y=0;const actual=delta.length();speed=dt>0?actual/dt:0;travel+=actual;
  // Gentle height support over the existing pavers, local to this actor.
  let groundTarget=0;
  for(const p of pavers){const dx=root.position.x-p.x,dz=root.position.z-p.z,c=Math.cos(p.yaw),s=Math.sin(p.yaw);const edge=Math.max(Math.abs(dx*c-dz*s)-p.width*.46,Math.abs(dx*s+dz*c)-p.depth*.46),u=THREE.MathUtils.clamp((edge+.10)/.22,0,1);groundTarget=Math.max(groundTarget,.13*(1-u*u*(3-2*u)));}
  groundLevel=damp(groundLevel,groundTarget,8,dt);
  hover=spirit*(.25+.027*Math.sin(clock*1.27+.8)+.014*Math.sin(clock*.71+2.1));root.position.y=groundLevel+hover;
  if(speed>.02){heading=Math.atan2(delta.x,delta.z);if(Math.abs(targetAngle-angle)<.009&&!ritualWanted){switchState('CAT_SIT');nextDecision=clock+3.2;}}
  else if(state==='CAT_RITUAL'||state==='CAT_LOOK'||state==='CAT_SIT')heading=Math.atan2(lookX-root.position.x,lookZ-root.position.z);
  const turn=Math.atan2(Math.sin(heading-root.rotation.y),Math.cos(heading-root.rotation.y));root.rotation.y+=turn*(1-Math.exp(-mix(6,3.4,spirit)*dt));
  const sitting=(state==='CAT_SIT'||state==='CAT_RITUAL')&&speed<.02;
  sit=damp(sit,sitting?1:0,4.5,dt);walkBlend=damp(walkBlend,THREE.MathUtils.clamp(speed/.46,0,1)*(1-spirit),12,dt);const gait=travel/.32*Math.PI*2,walk=walkBlend,breath=Math.sin(clock*1.8)*.0023;
  torso.morphTargetInfluences[0]=sit;
  body.position.y=breath+Math.cos(gait*2)*.0012*walk;
  body.rotation.set(spirit*(Math.sin(clock*.83+.4)*.025+Math.sin(clock*.39+1.2)*.010-speed*.06),0,
   Math.sin(gait)*.006*walk+spirit*(Math.sin(clock*.97)*.027+THREE.MathUtils.clamp(turn,-.30,.30)*speed*.10));body.scale.set(1,1+breath*.6,1);
  head.position.set(0,mix(.545,.616,sit),mix(.285,.080,sit));const lookAtWitch=Math.atan2(lookX-root.position.x,lookZ-root.position.z)-root.rotation.y;
  headYaw=damp(headYaw,THREE.MathUtils.clamp(Math.atan2(Math.sin(lookAtWitch),Math.cos(lookAtWitch)),-.50,.50)*(state==='CAT_LOOK'||ritualWanted||pondObserved||veilObserved?1:.30),4,dt);
  if(ritual.litSkulls===5&&lastLit!==5)startled=1;lastLit=ritual.litSkulls;startled*=Math.exp(-3*dt);
  head.rotation.set(-.035*sit-.12*startled+Math.sin(clock*.43)*.015-body.rotation.x*.7,headYaw,-body.rotation.z+Math.sin(clock*.39+1)*.012);
  root.updateMatrixWorld(true);root.getWorldQuaternion(groundQ);
  for(const l of legs){
   // Four-beat walk; hind feet precede the corresponding front feet by a quarter cycle.
   const u=(travel/.32+(l.side<0?0:.5)+(l.back?.25:0))%1,stance=u<.65;
   const swing=THREE.MathUtils.clamp((u-.65)/.35,0,1),ease=swing*swing*(3-2*swing);
   const footZ=stance?mix(.104,-.104,u/.65):mix(-.104,.104,ease);
   const lift=stance?0:Math.sin(swing*Math.PI)**2*.047;
   l.pivot.position.set(l.side*mix(.072,l.back?.102:.068,sit),mix(.325,l.back?.17:.335,sit),mix(l.back?-.21:.17,l.back?-.19:.075,sit));
   legTarget.set(l.pivot.position.x,.026+lift*walk+spirit*((l.back?.025:.040)+.006*Math.sin(clock*.67+l.side+(l.back?1.3:0))),
    (l.back?-.21:.17)+footZ*walk+sit*(l.back?.130:-.055)+spirit*(Math.sin(clock*.89+l.side)*.009-speed*.018));
   root.localToWorld(legTarget);
   const plantNow=stance&&speed>.04&&spirit<.05&&sit<.08&&Math.abs(turn)<.25;
   if(plantNow){if(!l.inStance||!l.ready){l.plant.copy(l.ready?l.foot:legTarget);l.plant.y=legTarget.y;}legTarget.copy(l.plant);}
   l.inStance=plantNow;
   if(!l.ready){l.foot.copy(legTarget);l.ready=true;}
   // Keep a planted paw fixed in world space. Ease swing/stop poses, not stance contacts.
   if(plantNow)l.foot.copy(legTarget);else l.foot.lerp(legTarget,dt>0?1-Math.exp(-(Math.abs(turn)>.25?48:28)*dt):1);
   legTarget.copy(l.foot);body.worldToLocal(legTarget);legTarget.sub(l.pivot.position);
   const {a,b,c}=l;
   // The hind hock sits behind and above the paw; it is a separate anatomical joint.
   const hockY=l.back?mix(Math.sqrt(c*c-.027*.027),.018,sit):0,hockZ=l.back?-Math.sqrt(c*c-hockY*hockY):0;
   l.pivot.rotation.z=Math.atan2(legTarget.x,-legTarget.y);
   const dy=Math.hypot(legTarget.x,legTarget.y)-hockY,dz=legTarget.z+hockZ,d=Math.max(.025,Math.min(a+b-.0001,Math.hypot(dy,dz)));
   const flex=Math.acos(THREE.MathUtils.clamp((d*d-a*a-b*b)/(2*a*b),-1,1));
   const bend=Math.acos(THREE.MathUtils.clamp((a*a+d*d-b*b)/(2*a*d),-1,1));
   const direction=Math.atan2(-dz,dy),sign=l.back?1:-1;
   l.pivot.rotation.x=direction-sign*bend;l.lower.rotation.x=sign*flex;
   if(l.back){const hockDirection=Math.atan2(hockZ,hockY);l.ankle.rotation.x=hockDirection-l.pivot.rotation.x-l.lower.rotation.x;l.paw.rotation.x=-hockDirection;}
   else l.ankle.rotation.x=-l.pivot.rotation.x-l.lower.rotation.x;
   l.pivot.updateWorldMatrix(true,true);l.paw.parent.getWorldQuaternion(footParentQ);l.paw.quaternion.copy(footParentQ.invert().multiply(groundQ));
  }
  for(let i=1;i<tailBones.length;i++){const bone=tailBones[i],amp=(1-sit*.85)*(.012+spirit*.025);bone.rotation.z=Math.sin(clock*.91-i*.65)*amp;bone.rotation.x=Math.sin(clock*.64-i*.51)*amp*.65;}
  tailAlertBlend=damp(tailAlertBlend,state==='CAT_RITUAL'||pondObserved||veilObserved?1:0,4.5,dt);const alert=tailAlertBlend;
  tail.position.set(0,mix(.365,.09,sit),mix(-.30,-.27,sit));
  tailMesh.morphTargetInfluences[0]=sit*(1-alert);tailMesh.morphTargetInfluences[1]=sit*alert;
  tail.rotation.set(Math.sin(clock*.49)*.025*(1-sit)+spirit*Math.sin(clock*.73+.5)*.075,(Math.sin(clock*.56)*.15+(state==='CAT_LOOK'?headYaw*.08:0))*(1-.70*sit)*mix(1,.45,alert)+spirit*(Math.sin(clock*.61)*.11+Math.sin(clock*.37+1)*.055),Math.sin(clock*.41+1)*.025*(1-sit)+spirit*Math.sin(clock*.47+1)*.042);
  ears.forEach((ear,i)=>{const side=i?1:-1,observing=state==='CAT_LOOK'||ritualWanted||pondObserved||veilObserved;ear.rotation.z=-side*(.19+.065*startled)+Math.sin(clock*.52+i*2.1)*.018;ear.rotation.x=Math.sin(clock*.37+i)*.018-.12*startled+(observing?-side*headYaw*.10:0)});
  const blink=1-.80*Math.pow(Math.max(0,Math.sin(clock*.31+1.2)),32);eyes.scale.y=blink;pupils.scale.y=blink;
  root.updateMatrixWorld();
  return snapshot();
 }
 function snapshot(){return {state,stateTime,x:root.position.x,z:root.position.z,y:root.position.y,radius:Math.hypot(root.position.x-safeCenter.x,root.position.z-safeCenter.z),speed,sit,groundLevel,clock,travel,targetAngle,angle,startled,headYaw,spirit,hover,angularVelocity,visited:[...visited]};}
 update(0,{state:'idle',speed:0,x:0,z:.3},{state:'inactive',litSkulls:0});
 return {root,update,snapshot};
}
