import * as THREE from './vendor/three.module.js';
import {mergeGeometries,mergeVertices} from './vendor/addons/utils/BufferGeometryUtils.js';

export const CAT_STATES=Object.freeze(['CAT_IDLE','CAT_WALK','CAT_SIT','CAT_LOOK','CAT_FOLLOW','CAT_RITUAL']);
// Visual reconstruction only. The approved decisions, routes and clocks below are unchanged.
export function createFamiliar({scene,pavers=[]}){
 const root=new THREE.Group();root.name='black-cat-familiar';scene.add(root);
 const coat=new THREE.MeshStandardMaterial({color:'#162235',roughness:.66}),soft=new THREE.MeshStandardMaterial({color:'#1e2b40',roughness:.72}),earMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9,vertexColors:true}),eyeMaterial=new THREE.MeshStandardMaterial({color:'#a0b85b',emissive:'#637c2c',emissiveIntensity:.22,roughness:.38});
 const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),mix=THREE.MathUtils.lerp,damp=(a,b,k,dt)=>mix(a,b,1-Math.exp(-k*dt));
 function surface(positions,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);const welded=mergeVertices(g,1e-6);g.dispose();welded.computeVertexNormals();return welded;}
 function shape(parent,parts,m,name){const g=parts.length===1?parts[0]:mergeGeometries(parts,false);if(parts.length>1)parts.forEach(p=>p.dispose());const mesh=new THREE.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name||'';parent.add(mesh);return mesh;}
 // A single closed loft: spline of elliptical sections, perpendicular to the spine.
 // Topology stays identical in standing/sitting shapes; GPU morphing handles the pose.
 function loft(sections,rows=24,sides=16){
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
 const torsoStanding=loft([[.28,-.34,0,0],[.285,-.29,.075,.095],[.285,-.21,.13,.137],[.29,-.10,.108,.12],[.30,0,.097,.111],[.315,.11,.112,.14],[.35,.205,.100,.112],[.40,.25,.076,.081],[.445,.276,.058,.053],[.46,.28,0,0]]);
 const torsoSitting=loft([[.024,-.21,0,0],[.075,-.20,.097,.108],[.15,-.165,.145,.155],[.24,-.09,.13,.125],[.32,-.045,.104,.103],[.405,.005,.101,.095],[.465,.042,.085,.075],[.52,.065,.060,.054],[.555,.080,.043,.041],[.57,.083,0,0]]);
 const torso=shape(body,[morph(torsoStanding,[torsoSitting])],coat,'cat-continuous-torso');
 const head=new THREE.Group();head.position.set(0,.465,.285);body.add(head);
 // Sculpted cranium, cheeks, muzzle and chin in one surface, not separate spheres.
 function felineHead(){const p=[],idx=[],rows=16,sides=24;
  for(let i=0;i<=rows;i++)for(let j=0;j<=sides;j++){const lat=i/rows*Math.PI,a=j/sides*Math.PI*2,sy=Math.cos(lat),s=Math.sin(lat);let y=sy*.118,x=Math.sin(a)*s*.137,z=Math.cos(a)*s*.116;
   x*=1-.19*Math.max(0,(-y-.014)/.104);const front=Math.pow(Math.max(0,Math.cos(a)),6);
   z+=front*(.028*Math.exp(-Math.pow((y+.040)/.048,2))*Math.exp(-Math.pow(x/.104,2))-.006*Math.exp(-Math.pow((y-.024)/.029,2)));
   y-=front*.008*Math.exp(-Math.pow((y+.085)/.026,2));p.push(x,y,z);
  }
  for(let i=0;i<rows;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;idx.push(a,b,a+1,a+1,b,b+1);}return surface(p,idx);
 }
 shape(head,[felineHead(),surface([0,-.032,.146,-.014,-.028,.139,.014,-.028,.139,0,-.045,.14,0,-.033,.132],[0,1,2,0,3,1,0,2,3,1,4,2,1,3,4,2,4,3])],coat,'cat-sculpted-head');
 function eye(side,pupil=false){const p=[],idx=[],segments=32,rings=4,rx=pupil?.0055:.038,ry=pupil?.022:.023;
  for(let i=0;i<=rings;i++)for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2,t=i/rings,x=side*.069+Math.cos(a)*rx*t,y=.023+Math.sin(a)*Math.sqrt(Math.abs(Math.sin(a)))*ry*t+side*Math.cos(a)*rx*t*.18;
   const sy=Math.sqrt(Math.max(.01,1-(y/.118)**2)),face=Math.pow(Math.max(0,1-(x/(.137*sy))**2),3);
   const z=.116*Math.sqrt(Math.max(.01,1-(x/.137)**2-(y/.118)**2))+face*(.028*Math.exp(-(((y+.040)/.048)**2))*Math.exp(-((x/.104)**2))-.006*Math.exp(-(((y-.024)/.029)**2)))+.004+(pupil?.002:0);p.push(x,y,z);
  }
  for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;idx.push(a,b,a+1,a+1,b,b+1);}return surface(p,idx);
 }
 const eyes=shape(head,[-1,1].map(s=>eye(s)),eyeMaterial,'cat-almond-eyes');eyes.castShadow=false;eyes.material.side=THREE.DoubleSide;
 const pupils=shape(head,[-1,1].map(s=>eye(s,true)),coat,'cat-pupils');pupils.castShadow=false;
 // Broad, thin triangular ears with curved faces and rounded integration at the base.
 function earGeometry(inner=false){const p=[],idx=[],rows=6,cols=4,h=inner?.105:.145,w=inner?.045:.069;
  for(let face=0;face<2;face++)for(let i=0;i<=rows;i++){const t=i/rows,width=w*Math.pow(1-t,.85);
   for(let j=0;j<=cols;j++){const u=j/cols*2-1;p.push(u*width+.012*t,h*t,(face?-.023*(1-t):.016+.009*Math.sin(t*Math.PI)*(1-u*u)));}
  }
  const n=(rows+1)*(cols+1);for(let face=0;face<2;face++)for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=face*n+i*(cols+1)+j,b=a+cols+1;if(face)idx.push(a,b,a+1,a+1,b,b+1);else idx.push(a,a+1,b,a+1,b+1,b);}
  for(let i=0;i<rows;i++)for(const j of [0,cols]){const a=i*(cols+1)+j,b=a+cols+1;idx.push(a,b,a+n,b,b+n,a+n);}for(let j=0;j<cols;j++)idx.push(j,j+n,j+1,j+1,j+n,j+n+1);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
 }
 const ears=[-1,1].map(side=>{const group=new THREE.Group();group.position.set(side*.096,.077,-.015);group.rotation.z=-side*.19;head.add(group);const g=earGeometry(),colors=[];
  for(let face=0;face<2;face++)for(let i=0;i<=6;i++)for(let j=0;j<=4;j++){const inner=face===0&&i>0&&i<6&&j>0&&j<4;new THREE.Color(inner?'#53424f':'#162235').toArray(colors,colors.length);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));shape(group,[g],earMaterial,'cat-organic-ear');return group});
 const legs=[];
 for(const back of [false,true])for(const side of [-1,1]){
  const pivot=new THREE.Group();pivot.position.set(side*.087,.27,back?-.19:.16);body.add(pivot);
  const upper=loft([[.024,0,0,0],[.007,0,back?.066:.042,back?.061:.039],[-.042,-.006,back?.060:.034,back?.053:.033],[-.085,-.003,back?.041:.027,back?.039:.028],[-.125,0,.028,.026],[-.135,0,0,0]],12,12);
  const upperMesh=shape(pivot,[upper],coat,'cat-upper-leg');
  const lower=new THREE.Group();lower.name='cat-leg-lower';lower.position.y=-.123;pivot.add(lower);
  const lowerMesh=shape(lower,[loft([[.015,0,0,0],[.005,0,.028,.027],[-.045,0,.025,.026],[-.105,0,.023,.025],[-.133,0,.025,.025],[-.143,0,0,0]],12,12)],soft,'cat-tapered-lower-leg');
  const paw=new THREE.Group();lower.add(paw);
  shape(paw,[loft([[0,-.042,0,0],[0,-.028,.028,.020],[0,0,.040,.026],[0,.039,.039,.023],[0,.066,.027,.016],[0,.080,0,0]],12,12)],soft,'cat-small-paw');
  legs.push({pivot,lower,paw,upperMesh,lowerMesh,back,side});
 }
 // Tapered tubes are built once; posed curves interpolate on GPU, never by a CPU vertex loop.
 function tailGeometry(points){const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p))),g=new THREE.TubeGeometry(curve,24,.032,8,false),a=g.attributes.position,c=V(),v=V();
  for(let i=0;i<=24;i++){c.copy(curve.getPointAt(i/24));const radius=.030*Math.pow(1-i/24,.72)+.003;
   for(let j=0;j<=8;j++){const n=i*9+j;v.fromBufferAttribute(a,n).sub(c).multiplyScalar(radius/.032).add(c);a.setXYZ(n,v.x,v.y,v.z);}}
  g.computeVertexNormals();return g;
 }
 const tail=new THREE.Group();body.add(tail);let tailAlertBlend=0;
 const tailStand=tailGeometry([[0,0,0],[.015,.12,-.07],[.06,.27,-.052],[.10,.36,.005],[.11,.38,.05]]);
 const tailSit=tailGeometry([[0,0,0],[-.10,-.048,-.015],[-.23,-.055,.105],[-.23,-.053,.25],[-.135,-.053,.37]]);
 const tailAlert=tailGeometry([[0,0,0],[-.10,-.029,-.035],[-.23,-.025,.09],[-.24,.035,.24],[-.16,.065,.33]]);
 const tailMesh=shape(tail,[morph(tailStand,[tailSit,tailAlert])],coat,'cat-continuous-tail');tailMesh.frustumCulled=false;
 // All routes lie on a safe front/left arc, outside the entire stone platform.
 // The front-left arc avoids dense planted banks, the pond and rear buildings.
 const radius=3.95,minAngle=1.80,maxAngle=2.90;
 let angle=2.24,targetAngle=angle,clock=0,state='CAT_IDLE',stateTime=0,nextDecision=3.5,sit=0,travel=0,speed=0,headYaw=0,startled=0,lastLit=0,heading=-Math.PI/2,groundLevel=0,spirit=0,angularVelocity=0,hover=0;
 const visited=new Set([state]),safeCenter={x:0,z:.3};
 function switchState(next){if(next===state)return;state=next;stateTime=0;visited.add(next)}
 function targetAt(a){return V(Math.cos(a)*radius,0,.3+Math.sin(a)*radius)}
 const interest=[2.24,1.84,2.87,2.10];let interestIndex=0;
 root.position.copy(targetAt(angle));
 function update(dt,pose,ritual,observation=null){
  spirit=THREE.MathUtils.clamp(observation?.veilTarget?.amount??0,0,1);
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
  const old=root.position.clone();
  if(spirit>0){
   const desired=movingState?THREE.MathUtils.clamp(gap*1.8,-.49/radius,.49/radius):0;
   angularVelocity=damp(angularVelocity,desired,3.2,dt);
   const glide=Math.sign(angularVelocity)*Math.min(Math.abs(gap),Math.abs(angularVelocity)*dt);
   angle=THREE.MathUtils.clamp(angle+mix(movingState?step:0,glide,spirit),minAngle,maxAngle);
  }else{angularVelocity=0;if(movingState&&Math.abs(gap)>.005)angle=THREE.MathUtils.clamp(angle+step,minAngle,maxAngle);}
  root.position.copy(targetAt(angle));
  const delta=root.position.clone().sub(old);delta.y=0;const actual=delta.length();speed=dt>0?actual/dt:0;travel+=actual;
  // Gentle height support over the existing pavers, local to this actor.
  let groundTarget=0;
  for(const p of pavers){const dx=root.position.x-p.x,dz=root.position.z-p.z,c=Math.cos(p.yaw),s=Math.sin(p.yaw);const edge=Math.max(Math.abs(dx*c-dz*s)-p.width*.46,Math.abs(dx*s+dz*c)-p.depth*.46),u=THREE.MathUtils.clamp((edge+.10)/.22,0,1);groundTarget=Math.max(groundTarget,.13*(1-u*u*(3-2*u)));}
  groundLevel=damp(groundLevel,groundTarget,8,dt);
  hover=spirit*(.25+.027*Math.sin(clock*1.27+.8)+.014*Math.sin(clock*.71+2.1));root.position.y=groundLevel+hover;
  if(speed>.02){heading=Math.atan2(delta.x,delta.z);if(Math.abs(targetAngle-angle)<.009&&!ritualWanted){switchState('CAT_SIT');nextDecision=clock+3.2;}}
  else if(state==='CAT_RITUAL'||state==='CAT_LOOK'||state==='CAT_SIT')heading=Math.atan2(lookX-root.position.x,lookZ-root.position.z);
  const turn=Math.atan2(Math.sin(heading-root.rotation.y),Math.cos(heading-root.rotation.y));root.rotation.y+=turn*(1-Math.exp(-mix(6,3.4,spirit)*dt));
  const sitting=(state==='CAT_SIT'||state==='CAT_RITUAL')&&speed<.02;
  sit=damp(sit,sitting?1:0,4.5,dt);const gait=travel/.30*Math.PI*2,walk=THREE.MathUtils.clamp(speed/.46,0,1)*(1-spirit),breath=Math.sin(clock*1.8)*.0023;
  torso.morphTargetInfluences[0]=sit;
  body.position.y=breath+Math.cos(gait*2)*.0012*walk;body.rotation.set(spirit*(Math.sin(clock*.83+.4)*.021-speed*.06),0,Math.sin(gait)*.006*walk+spirit*Math.sin(clock*.97)*.026);body.scale.set(1,1+breath*.6,1);
  head.position.set(0,mix(.465,.574,sit),mix(.285,.080,sit));const lookAtWitch=Math.atan2(lookX-root.position.x,lookZ-root.position.z)-root.rotation.y;
  headYaw=damp(headYaw,THREE.MathUtils.clamp(Math.atan2(Math.sin(lookAtWitch),Math.cos(lookAtWitch)),-.50,.50)*(state==='CAT_LOOK'||ritualWanted||pondObserved||veilObserved?1:.30),4,dt);
  if(ritual.litSkulls===5&&lastLit!==5)startled=1;lastLit=ritual.litSkulls;startled*=Math.exp(-3*dt);
  head.rotation.set(-.035*sit-.12*startled+Math.sin(clock*.43)*.015-body.rotation.x*.7,headYaw,-body.rotation.z+Math.sin(clock*.39+1)*.012);
  for(const l of legs){
   const u=((travel/.30+(l.side<0?0:.5)+(l.back?.5:0))%1),stance=u<.60;
   const footZ=stance?mix(.09,-.09,u/.60):mix(-.09,.09,(u-.60)/.40);
   const lift=stance?0:Math.sin((u-.60)/.40*Math.PI)*.046;
   l.pivot.position.set(l.side*mix(.087,l.back?.112:.078,sit),mix(.27,l.back?.157:.350,sit),mix(l.back?-.19:.16,l.back?-.18:.075,sit));
   const groundTarget=V(l.pivot.position.x,.028+lift*walk-body.position.y+spirit*(l.back?.025:.040),(l.back?-.19:.16)+footZ*walk+sit*(l.back?.065:.023)+spirit*Math.sin(clock*.89+l.side)*.007);
   groundTarget.applyAxisAngle(V(0,0,1),-body.rotation.z).sub(l.pivot.position);
   const a=mix(.123,l.back?.123:.173,sit),b=mix(.132,l.back?.132:.160,sit),dy=-groundTarget.y,dz=groundTarget.z,d=Math.max(.025,Math.min(a+b-.001,Math.hypot(dy,dz)));
   l.upperMesh.scale.y=a/.123;l.lower.position.y=-a;l.lowerMesh.scale.y=b/.132;l.paw.position.y=-b;
   const flex=Math.acos(THREE.MathUtils.clamp((d*d-a*a-b*b)/(2*a*b),-1,1));
   const bend=Math.acos(THREE.MathUtils.clamp((a*a+d*d-b*b)/(2*a*d),-1,1));
   const direction=Math.atan2(-dz,dy),sign=l.back?-1:1;
   l.pivot.rotation.x=direction-sign*bend;l.lower.rotation.x=sign*flex;
   l.paw.rotation.x=-l.pivot.rotation.x-l.lower.rotation.x; // Level sole independent of ankle angle.
  }
  tailAlertBlend=damp(tailAlertBlend,state==='CAT_RITUAL'||pondObserved||veilObserved?1:0,4.5,dt);const alert=tailAlertBlend;
  tail.position.set(0,mix(.31,.09,sit),mix(-.30,-.27,sit));
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
