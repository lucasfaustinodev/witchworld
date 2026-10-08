import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

// Visual surfaces adapt to the approved rig; input, movement and state timing stay below.
export function createWitch({ hint }) {
  const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
  const mix = THREE.MathUtils.lerp;
  const smooth = t => {t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
  const settle = t => {t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
  const damp = (a,b,k,dt) => mix(a,b,1-Math.exp(-k*dt));
  const mat = (color,opts={}) => new THREE.MeshStandardMaterial({color,roughness:.83,...opts});
  const cloth=mat('#786d88',{roughness:.94}),trim=mat('#82738c',{roughness:.88}),lining=mat('#66516d',{roughness:.96});
  const weaveCanvas=document.createElement('canvas');weaveCanvas.width=weaveCanvas.height=64;
  const wc=weaveCanvas.getContext('2d');wc.fillStyle='#bcbcbc';wc.fillRect(0,0,64,64);
  for(let i=0;i<64;i+=2){wc.fillStyle=i%4?'#b6b6b6':'#c4c4c4';wc.fillRect(i,0,1,64);wc.fillRect(0,i,64,1);}
  const weave=new THREE.CanvasTexture(weaveCanvas);weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(5,5);
  for(const m of [cloth,trim,lining]){m.bumpMap=weave;m.bumpScale=.002;}
  const hairMat=mat('#43364d',{roughness:.67}),hairHighlight=mat('#5b4663',{roughness:.72});
  const skin=mat('#d0aa96',{roughness:.79}),bootMat=mat('#655969',{roughness:.68}),faceMat=mat('#3b2734');
  const shoeMat=bootMat.clone();shoeMat.vertexColors=true;
  const brass=mat('#aa8151',{metalness:.55,roughness:.48});
  const root=new THREE.Group();root.name='bruxa-procedural';root.position.set(0,.255,.3);root.rotation.y=.46;
  const body=new THREE.Group();body.name='bodyRoot';root.add(body);
  const head=new THREE.Group();head.name='headRoot';head.position.y=.995;body.add(head);
  const sphereGeo=new THREE.SphereGeometry(1,16,12);
  function add(parent,geometry,material,position=[0,0,0],scale=[1,1,1]){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.scale.set(...scale);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  const ellipsoid=(p,m,pos,s)=>add(p,sphereGeo,m,pos,s);
  function curveGeo(points,r,segments=12,sides=6){return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>V(...p))),segments,r,sides,false);}
  function tube(parent,points,r,material){return add(parent,curveGeo(points,r),material);}
  function combined(parts){const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());return g;}
  function seamNormals(g,rows,segments){
    g.computeVertexNormals();const n=g.attributes.normal;
    for(let i=0;i<rows;i++){const first=i*(segments+1),last=first+segments,v=V().fromBufferAttribute(n,first).add(V().fromBufferAttribute(n,last)).normalize();n.setXYZ(first,v.x,v.y,v.z);n.setXYZ(last,v.x,v.y,v.z);}
    return g;
  }
  // Elliptical lofts express ribcage/waist/hip and limb contours with continuous normals.
  function loft(profile,segments=24){
    const p=[],uv=[],idx=[];
    for(let i=0;i<profile.length;i++)for(let j=0;j<=segments;j++){
      const a=j/segments*Math.PI*2,[y,rx,rz=rx,cx=0,cz=0,fold=0]=profile[i];
      const f=1+fold*Math.cos(a*7+.5);p.push(cx+Math.cos(a)*rx*f,y,cz+Math.sin(a)*rz*f);uv.push(j/segments,i/(profile.length-1));
    }
    for(let i=0;i<profile.length-1;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;idx.push(a,b,a+1,a+1,b,b+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);return seamNormals(g,profile.length,segments);
  }
  function rings(profile,segments=36){return loft(profile.map(([y,r,cx=0,cz=0,fold=0])=>[y,r,r,cx,cz,fold]),segments);}
  // A flattened, tapering swept volume for hair masses and softly curled digits.
  function sweep(points,width,depth,segments=14,sides=8){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p))),p=[],uv=[],idx=[];
    for(let i=0;i<=segments;i++){
      const t=i/segments,c=curve.getPointAt(t),tangent=curve.getTangentAt(t).normalize();
      const across=V(1,0,0).addScaledVector(tangent,-tangent.x).normalize(),normal=across.clone().cross(tangent).normalize();
      const taper=.055+.945*Math.sin(Math.PI*(.12+.88*t))**.65;
      for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,v=c.clone().addScaledVector(across,Math.cos(a)*width*taper).addScaledVector(normal,Math.sin(a)*depth*taper);p.push(v.x,v.y,v.z);uv.push(j/sides,t);}
    }
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;idx.push(a,b,a+1,a+1,b,b+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);return seamNormals(g,segments+1,sides);
  }
  cloth.side=trim.side=lining.side=THREE.DoubleSide;
  const torso=add(body,loft([[.515,.161,.121],[.552,.185,.143],[.595,.169,.132],[.644,.143,.111],[.706,.162,.129],[.770,.184,.143,0,.006],[.821,.185,.133,0,.003],[.866,.178,.111],[.893,.112,.082,0,-.006],[.910,.068,.057,0,-.009]],32),cloth);torso.name='ribcage-waist-hips';
  add(body,loft([[.863,.059,.052],[.900,.054,.047],[.942,.051,.045],[.971,.049,.043]],24),skin).name='neck';
  // Tailored overlapping neckline; no circular bib or spherical shoulder pads.
  const collar=[];
  for(const side of [-1,1])collar.push(curveGeo([[side*.12,.89,.090],[side*.073,.831,.132],[side*.027,.795,.137]],.014,12,6));
  add(body,combined(collar),lining);
  add(body,loft([[.630,.145,.117],[.654,.146,.118]],32),bootMat).name='belt';
  ellipsoid(body,brass,[0,.646,.127],[.026,.023,.012]);
  tube(body,[[-.10,.883,.105],[0,.816,.145],[.10,.883,.105]],.006,brass);
  ellipsoid(body,brass,[0,.812,.150],[.016,.025,.010]);
  const skirt=add(body,rings([[.22,.296,0,.008,.055],[.255,.307,0,.005,.063],[.32,.288,0,0,.073],[.39,.263,0,0,.065],[.46,.226,0,0,.057],[.52,.190,0,0,.040],[.575,.165,0,0,.022],[.63,.146,0,0,.012]],40),cloth);skirt.name='draped-skirt';
  const skirtBase=skirt.geometry.attributes.position.array.slice();
  const hem=add(body,rings([[-.006,.293,0,.005,.055],[.003,.302,0,.005,.055],[.010,.302,0,.005,.055]],40),trim,[0,.235,0]);
  const capeVertices=[],capeIndices=[];
  for(let i=0;i<=12;i++)for(let j=0;j<=20;j++){
    const t=i/12,a=j/20*Math.PI*.94+Math.PI*.03,width=mix(.225,.332,smooth(t)),depth=mix(.108,.292,t);
    capeVertices.push(Math.cos(a)*width,.93-t*.55,-.025-Math.sin(a)*depth-.013*Math.sin(j*1.55)*t*t);
  }
  for(let i=0;i<12;i++)for(let j=0;j<20;j++){const a=i*21+j;capeIndices.push(a,a+21,a+1,a+1,a+21,a+22);}
  const capeGeo=new THREE.BufferGeometry();capeGeo.setAttribute('position',new THREE.Float32BufferAttribute(capeVertices,3));capeGeo.setIndex(capeIndices);capeGeo.computeVertexNormals();
  const cape=add(body,capeGeo,lining);cape.name='shoulder-cloak';const capeBase=capeGeo.attributes.position.array.slice();
  // The facial profile is sculpted into one surface: jaw/chin, cheeks, nose and recessed orbits.
  const gauss=(x,y,cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
  const jaw=y=>.70+.30*smooth((y+.86)/.66);
  function facialRelief(x,y){
    return .017*gauss(x,y,0,.040,.023,.061)+.025*gauss(x,y,0,.007,.025,.025)
      +.010*(gauss(x,y,-.081,.017,.041,.033)+gauss(x,y,.081,.017,.041,.033))
      -.012*(gauss(x,y,-.063,.052,.037,.022)+gauss(x,y,.063,.052,.037,.022))
      +.007*(gauss(x,y,-.063,.088,.043,.018)+gauss(x,y,.063,.088,.043,.018))
      +.011*gauss(x,y,0,-.077,.052,.032)+.004*gauss(x,y,0,-.036,.038,.012);
  }
  const faceGeo=new THREE.SphereGeometry(1,32,24),fp=faceGeo.attributes.position;
  for(let i=0;i<fp.count;i++){
    const x=fp.getX(i),y=fp.getY(i),z=fp.getZ(i),px=x*.155*jaw(y),py=y*.184+.069;
    const pz=z*(z<0?.145:.133)+(z>0?facialRelief(px,py)*smooth(z*4):0);
    fp.setXYZ(i,px,py,pz);
  }
  faceGeo.computeVertexNormals();
  const skinParts=[faceGeo];
  for(const side of [-1,1]){const ear=new THREE.SphereGeometry(1,12,8);ear.scale(.019,.037,.014);ear.translate(side*.148,.060,-.001);skinParts.push(ear);}
  function faceZ(x,y){const yy=(y-.069)/.184;return .133*Math.sqrt(Math.max(.001,1-yy*yy-(x/(.155*jaw(yy)))**2))+facialRelief(x,y);}
  const marks=[];
  for(const side of [-1,1]){
    const eyelid=[[side*.031,.054],[side*.060,.047],[side*.090,.057]].map(([x,y])=>[x,y,faceZ(x,y)+.001]);
    skinParts.push(curveGeo(eyelid,.0040,12,6));
    marks.push(curveGeo(eyelid.map(([x,y,z])=>[x,y-.002,z+.003]),.0027,12,6));
    marks.push(curveGeo([[side*.034,.085],[side*.062,.091],[side*.089,.087]].map(([x,y])=>[x,y,faceZ(x,y)+.003]),.0024,10,5));
  }
  add(head,combined(skinParts),skin).name='sculpted-face';
  marks.push(curveGeo([[-.022,-.035],[0,-.039],[.022,-.035]].map(([x,y])=>[x,y,faceZ(x,y)+.002]),.0028,10,6));
  add(head,combined(marks),faceMat).name='lids-brows-mouth';
  // Broad flattened locks connect to a rear mass; only the same two side locks animate.
  const rearGeo=new THREE.SphereGeometry(1,24,18),rp=rearGeo.attributes.position;
  for(let i=0;i<rp.count;i++){
    const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),lower=smooth(-y);
    rp.setXYZ(i,x*.172*(1-.15*lower),.075+y*(y<0?.365:.180),-.047+z*.139-.025*lower);
  }
  rearGeo.computeVertexNormals();const hairParts=[rearGeo],highlightParts=[],locks=[];
  for(const side of [-1,1]){
    const flowing=sweep([[side*.116,.187,.014],[side*.174,.047,.073],[side*.180,-.128,.092],[side*.205,-.318,.021]],.055,.023,18,10);
    const moving=add(head,flowing,hairMat);moving.name='side-hair';locks.push(moving);
    hairParts.push(sweep([[side*.129,.170,-.017],[side*.159,-.066,-.016],[side*.142,-.255,-.043],[side*.123,-.341,-.072]],.052,.021,16,8));
    highlightParts.push(sweep([[side*.103,.177,.076],[side*.125,.067,.139],[side*.150,-.062,.140],[side*.177,-.206,.069]],.032,.016,16,8));
  }
  hairParts.push(sweep([[-.126,.204,.058],[-.075,.172,.128],[-.017,.128,.148],[.045,.087,.142]],.047,.022,16,8));
  hairParts.push(sweep([[.114,.194,.059],[.073,.166,.137],[.046,.105,.152],[.034,.079,.148]],.026,.013,12,8));
  add(head,combined(hairParts),hairMat).name='hair-mass-fringe';
  add(head,combined(highlightParts),hairHighlight);
  const hat=new THREE.Group();hat.name='hatPivot';hat.rotation.x=-.18;head.add(hat);
  const brimGeo=rings([[.137,.19],[.127,.29],[.109,.420,0,.007,.012],[.121,.445,0,.007,.014],[.137,.419,0,.007,.012],[.150,.29],[.155,.19]],56);
  const bp=brimGeo.attributes.position;
  for(let i=0;i<bp.count;i++){
    const x=bp.getX(i),z=bp.getZ(i),a=Math.atan2(z,x),r=Math.hypot(x,z),edge=Math.max(0,r-.19);
    bp.setY(i,bp.getY(i)+edge*(.128*Math.sin(a*2+.6)+.055*Math.sin(a*3-.8))+.125*Math.pow(Math.max(0,z)/.445,1.65));
  }
  brimGeo.computeVertexNormals();const brim=add(hat,brimGeo,cloth);brim.scale.z=.85;
  add(hat,rings([[.150,.181,0,0,.009],[.206,.177,-.001,0,.012],[.263,.160,-.004,.002,.018],[.326,.138,-.012,.004,.020],[.390,.114,-.023,.008,.020],[.452,.091,-.040,.012,.018],[.507,.067,-.063,.018,.014],[.552,.047,-.089,.024,.008],[.587,.032,-.112,.029],[.614,.021,-.135,.033],[.638,.010,-.151,.038],[.650,.002,-.160,.040]],40),cloth);
  add(hat,rings([[.184,.182],[.221,.175,-.002]],40),bootMat);
  ellipsoid(hat,brass,[.042,.209,.172],[.025,.020,.010]);
  // A boot is a flattened outsole + rounded toe + instep + narrow rear ankle shaft.
  const shoeGeo=loft([[-1.18,.87,.96,0,.015],[-1.02,.96,1.03,0,.010],[-.77,.94,1.0,0,.010],[-.28,.91,.91,0,-.03],[.18,.84,.74,0,-.14],[.57,.73,.52,0,-.30],[1.15,.66,.37,0,-.39],[1.65,.63,.35,0,-.40],[1.78,.64,.35,0,-.40]],20);
  const shoeP=shoeGeo.attributes.position,shoeColors=[];
  for(let i=0;i<shoeP.count;i++){const shade=shoeP.getY(i)<-.76?.58:1;shoeColors.push(shade,shade,shade);}
  shoeGeo.setAttribute('color',new THREE.Float32BufferAttribute(shoeColors,3));
  // Joint-centered contours overlap gently at the same approved shoulder/elbow/knee endpoints.
  function segment(material,radius,kind){
    const shape=kind==='upperArm'?[[0,.72],[.10,.95],[.27,1],[.48,.91],[.70,.79],[.90,.67],[1,.65]]
      :kind==='forearm'?[[0,.78],[.16,.93],[.35,1],[.60,.79],[.83,.60],[1,.53]]
      :kind==='thigh'?[[0,.91],[.15,1.09],[.38,1.02],[.61,.86],[.85,.72],[1,.70]]
      :[[0,.77],[.15,.95],[.34,1.04],[.54,.94],[.77,.72],[1,.62]];
    const length=1+radius*2,profile=[[-length*.585,.003,.003]];
    for(const [t,r] of shape)profile.push([(t-.5)*length,radius*r,radius*r*(kind==='thigh'?1.02:.90)]);
    profile.push([length*.585,.003,.003]);return add(root,loft(profile,16),material);
  }
  function handGeometry(side){
    const palm=loft([[-.043,.018,.013],[-.029,.032,.019],[-.009,.034,.019],[.008,.026,.017],[.023,.021,.014]],16),parts=[palm];
    for(let j=0;j<4;j++){
      const x=(j-1.5)*.014,end=-.072+[.009,0,.004,.014][j];
      parts.push(sweep([[x,-.025,.005],[x,-.046,.015],[x-side*.003,end,.012]],.0071,.0065,8,6));
    }
    parts.push(sweep([[-side*.023,.002,.004],[-side*.041,-.018,.014],[-side*.037,-.041,.021]],.010,.0085,10,8));
    return combined(parts);
  }
  const limbs=[];
  for(const side of [-1,1]){
    const armGroup=new THREE.Group();armGroup.name=side<0?'leftArmPivot':'rightArmPivot';root.add(armGroup);
    const legGroup=new THREE.Group();legGroup.name=side<0?'leftLegPivot':'rightLegPivot';root.add(legGroup);
    const upperArm=segment(cloth,.065,'upperArm'),lowerArm=segment(cloth,.055,'forearm'),hand=add(root,handGeometry(side),skin);
    const upperLeg=segment(cloth,.07,'thigh'),lowerLeg=segment(bootMat,.058,'calf'),shoe=add(root,shoeGeo,shoeMat,[0,0,0],[.071,.047,.104]);
    hand.name='palm-thumb-fingers';shoe.name='boot';
    armGroup.attach(upperArm);armGroup.attach(lowerArm);armGroup.attach(hand);
    legGroup.attach(upperLeg);legGroup.attach(lowerLeg);legGroup.attach(shoe);
    const initial=V(side*.13,.052,.02).applyAxisAngle(V(0,1,0),root.rotation.y).add(root.position);
    limbs.push({side,upperArm,lowerArm,hand,upperLeg,lowerLeg,shoe,foot:initial.clone(),from:initial.clone(),to:initial.clone(),prevU:1,swing:false});
  }
  const up=V(0,1,0);
  function link(object,a,b,radius){
    object.position.copy(a).add(b).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());
    // Contour length follows the approved endpoints, with soft overlap around joints.
    object.scale.set(1,a.distanceTo(b)/(1+radius*2),1);
  }
  function knee(hip,foot){
    const direction=foot.clone().sub(hip),distance=Math.min(direction.length(),.528),length=.265;
    direction.normalize();
    const pole=V(0,0,1).addScaledVector(direction,-direction.z).normalize();
    return hip.clone().addScaledVector(direction,distance*.5).addScaledVector(pole,Math.sqrt(Math.max(0,length*length-distance*distance*.25)));
  }
  const keys=new Set(),velocity=V(),center=V(0,.255,.3);
  const cameraYaw=Math.atan2(10,20); // Basis matches the frozen camera, never changes it.
  const screenRight=V(Math.cos(cameraYaw),0,-Math.sin(cameraYaw));
  const screenUp=V(-Math.sin(cameraYaw),0,-Math.cos(cameraYaw));
  let state='idle',clock=0,distance=0,walkWeight=0,meditation=0,transitionTime=0;
  let transitionStart=0,transitionTarget=0,centeringFrom=root.position.clone(),centeringYaw=root.rotation.y;
  let stoppedElapsed=0;
  let astralController=null,astralPose={locked:false,meditation:0};
  let meditationExitHandler=null,interaction=null,externalFocus={locked:false,weight:0,yaw:root.rotation.y};
  function standUp(){
    if(state!=='meditate')return;
    state='rising';transitionTime=0;transitionStart=meditation;transitionTarget=0;keys.clear();
  }
  function onKey(event){
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','KeyE','KeyV'].includes(event.code))event.preventDefault();
    keys.add(event.code);
    if(event.code==='KeyV'){if(!event.repeat)astralController?.toggle();return;}
    if(astralPose.locked&&event.code==='KeyE')return;
    if(event.code!=='KeyE'||event.repeat)return;
    if(interaction?.active()){interaction.toggle();return;}
    if(state==='meditate'){
      if(!meditationExitHandler?.())standUp();
    }else if((state==='idle'||state==='walk'||state==='stop')&&root.position.distanceTo(center)<.38){
      state='sitting';transitionTime=0;transitionStart=meditation;transitionTarget=1;
      centeringFrom.copy(root.position);centeringYaw=root.rotation.y;velocity.set(0,0,0);keys.clear();
    }else if((state==='idle'||state==='walk'||state==='stop')&&interaction?.canStart(root.position)){interaction.start();}
  }
  const clearInput=()=>keys.clear();
  addEventListener('keydown',onKey);addEventListener('keyup',event=>keys.delete(event.code));
  addEventListener('blur',clearInput);document.addEventListener('visibilitychange',clearInput);

  function update(dt){
    clock+=dt;
    const inTransition=state==='sitting'||state==='rising',locked=inTransition||state==='meditate'||externalFocus.locked||astralPose.locked;
    if(astralPose.locked)meditation=astralPose.meditation;
    if(inTransition){
      transitionTime+=dt;
      const duration=state==='sitting'?1.15:.95,progress=Math.min(1,transitionTime/duration);
      // Same duration: prepare, fold with zero endpoint acceleration, then settle.
      const pose=state==='sitting'?settle((progress-.12)/.80):smooth((progress-.16)/.84);
      meditation=mix(transitionStart,transitionTarget,pose);
      if(state==='sitting'){
        const centering=smooth(progress/.42);root.position.lerpVectors(centeringFrom,center,centering);
        root.rotation.y=centeringYaw+Math.atan2(Math.sin(.46-centeringYaw),Math.cos(.46-centeringYaw))*centering;
      }
      if(progress===1){state=transitionTarget===1?'meditate':'idle';meditation=transitionTarget;stoppedElapsed=0;}
    }
    let speed=0;
    if(!locked){
      const horizontal=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
      const vertical=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
      const requested=screenRight.clone().multiplyScalar(horizontal).addScaledVector(screenUp,vertical);
      if(requested.lengthSq()>0)requested.normalize().multiplyScalar(1.10);
      const k=requested.lengthSq()?10:14;
      const decay=Math.exp(-k*dt);
      const displacement=requested.clone().multiplyScalar(dt).addScaledVector(velocity.clone().sub(requested),(1-decay)/k);
      velocity.lerp(requested,1-decay);
      if(velocity.length()<.003)velocity.set(0,0,0);
      const previous=root.position.clone();root.position.add(displacement);
      const fromCenter=root.position.clone().sub(center);fromCenter.y=0;
      if(fromCenter.length()>1.36){
        if(interaction?.projectWalk){const attempted=root.position.clone(),projected=interaction.projectWalk(attempted);root.position.copy(projected);const normal=attempted.sub(projected).normalize(),outward=velocity.dot(normal);if(outward>0)velocity.addScaledVector(normal,-outward);}
        else {fromCenter.setLength(1.36);root.position.copy(center).add(fromCenter);const normal=fromCenter.clone().normalize();const outward=velocity.dot(normal);if(outward>0)velocity.addScaledVector(normal,-outward);}
      }
      const actual=root.position.distanceTo(previous);speed=actual/Math.max(dt,.00001);distance+=actual;
      if(speed>.025){
        const target=Math.atan2(velocity.x,velocity.z),angle=Math.atan2(Math.sin(target-root.rotation.y),Math.cos(target-root.rotation.y));
        root.rotation.y+=angle*(1-Math.exp(-12*dt));
        state=requested.lengthSq()?'walk':'stop';stoppedElapsed=0;
      }else {state=requested.lengthSq()&&velocity.length()>.03?'stop':'idle';stoppedElapsed+=dt;}
    }else{velocity.set(0,0,0);stoppedElapsed+=dt;}
    walkWeight=damp(walkWeight,locked?0:Math.min(1,speed/.65),12,dt);
    const phase=distance/.48*Math.PI*2;
    const breath=Math.sin(clock*1.9)*.0027*(1-meditation*.7);
    const bob=-Math.cos(phase*2)*.0055*walkWeight;
    body.position.y=-.34*meditation+breath+bob;
    const preparation=smooth(Math.min(transitionTime/(state==='rising'?.95:1.15),1));
    body.rotation.x=-Math.sin(Math.PI*preparation)*.045*(inTransition?1:0)+.015*walkWeight;
    body.rotation.z=Math.sin(phase)*.018*walkWeight;
    body.scale.set(1,1+breath*.55,1+breath*.65);
    head.rotation.x=Math.sin(clock*.8)*.009*(1-meditation)+.08*meditation;
    head.rotation.z=Math.sin(phase-.4)*.009*walkWeight;
    if(externalFocus.locked){const angle=Math.atan2(Math.sin(externalFocus.yaw-root.rotation.y),Math.cos(externalFocus.yaw-root.rotation.y));root.rotation.y+=angle*(1-Math.exp(-5*dt));}
    body.rotation.x+=externalFocus.weight*.025;head.rotation.x+=externalFocus.weight*.095;
    hat.rotation.z=Math.sin(phase-.65)*.015*walkWeight+Math.sin(clock*1.1)*.003;
    for(let i=0;i<locks.length;i++)locks[i].rotation.x=Math.sin(phase-.85)*.012*walkWeight+Math.sin(clock*1.3+i)*.002;
    // Clothing folds react locally. Hem lifts rather than intersecting the platform when seated.
    const drapeWeight=smooth(meditation);
    const sp=skirt.geometry.attributes.position;
    for(let i=0;i<sp.count;i++){
      const x=skirtBase[i*3],y=skirtBase[i*3+1],z=skirtBase[i*3+2],t=(.63-y)/.41;
      const angle=Math.atan2(z,x),drape=.63-.235*Math.pow(t,.85)+.012*Math.cos(angle*2)*Math.sin(t*Math.PI);
      sp.setXYZ(i,mix(x,x*(1+.40*smooth(t)),drapeWeight),mix(y,drape,drapeWeight),mix(z,z*(1-.16*t)+.065*t,drapeWeight)+Math.sin(phase+.7)*.014*t*walkWeight);
    }
    sp.needsUpdate=true;skirt.geometry.computeVertexNormals();
    hem.position.y=mix(.235,.395,drapeWeight);hem.position.z=.065*drapeWeight;hem.scale.set(1+.40*drapeWeight,1,1-.16*drapeWeight);
    const cp=capeGeo.attributes.position;
    for(let i=0;i<cp.count;i++){
      const x=capeBase[i*3],y=capeBase[i*3+1],z=capeBase[i*3+2],t=(.93-y)/.55;
      cp.setXYZ(i,x*(1+.10*t*meditation),mix(y,.93-t*.57,meditation),z-Math.sin(phase-.9)*.025*t*t*walkWeight-Math.sin(clock*1.3)*.003*t);
    }
    cp.needsUpdate=true;capeGeo.computeVertexNormals();
    for(let index=0;index<limbs.length;index++){
      const l=limbs[index],side=l.side;
      const gait=(distance/.48+index*.5)%1;
      const swingDuration=.38;
      if(speed>.015&&!locked){
        if(gait<swingDuration){
          if(!l.swing||gait<l.prevU){
            l.from.copy(l.foot);
            const forward=velocity.clone().setY(0).normalize(),right=V(forward.z,0,-forward.x);
            l.to.copy(root.position).addScaledVector(forward,.24).addScaledVector(right,side*.13);l.to.y=root.position.y+.052;
          }
          l.swing=true;const t=gait/swingDuration;
          l.foot.lerpVectors(l.from,l.to,smooth(t));l.foot.y+=Math.sin(t*Math.PI)*.075;
        }else {if(l.swing)l.foot.copy(l.to);l.swing=false;}
      }else {
        const neutral=V(side*.13,.052,.025).applyAxisAngle(up,root.rotation.y).add(root.position);
        l.foot.lerp(neutral,1-Math.exp(-15*dt));l.swing=false;
      }
      l.prevU=gait;
      const local=l.foot.clone().sub(root.position).applyAxisAngle(up,-root.rotation.y);
      const hip=V(side*.13,.51+body.position.y,0);
      // Turning may leave a planted world-space foot across the body's midline.
      // Keep targets on their anatomical side and within the two-bone reach.
      if(!locked||externalFocus.locked){
        local.x=side*THREE.MathUtils.clamp(side*local.x,.065,.195);
        const reach=Math.sqrt(Math.max(.0064,.528*.528-(hip.y-local.y)**2-(hip.x-local.x)**2));
        local.z=THREE.MathUtils.clamp(local.z,-reach,reach);
        l.foot.copy(local).applyAxisAngle(up,root.rotation.y).add(root.position);
      }
      const standingKnee=knee(hip,local);
      const seatedKnee=V(side*.31,.105,.23),seatedFoot=V(-side*.075,.063+index*.02,.36);
      const ankle=local.clone().lerp(seatedFoot,meditation),joint=standingKnee.lerp(seatedKnee,meditation);
      link(l.upperLeg,hip,joint,.07);link(l.lowerLeg,joint,ankle,.058);
      l.shoe.position.copy(ankle).add(V(0,-.011,.044));
      l.shoe.rotation.set(-.22*meditation,-meditation*side*1.32,-side*.32*meditation);
      // Arms stay close; cross swing is subdued and hands settle on knees.
      const shoulder=V(side*.19,.85+body.position.y,0);
      const armSwing=Math.sin(phase+index*Math.PI)*.052*walkWeight;
      const elbow=V(side*.23,.65+body.position.y,armSwing*.55).lerp(V(side*.29,.43,.065),meditation);
      const wrist=V(side*.235,.46+body.position.y,armSwing).lerp(V(side*.29,.18,.22),meditation);
      link(l.upperArm,shoulder,elbow,.065);link(l.lowerArm,elbow,wrist,.055);
      l.hand.position.copy(wrist).add(V(0,-.004,.008*meditation));l.hand.rotation.set(-.95*meditation,0,side*meditation*.45);
    }
    // Only the contextual interaction hint is visible. No HUD or debug buttons.
    const canMeditate=!locked&&root.position.distanceTo(center)<.38;
    hint.hidden=!(canMeditate||state==='meditate');hint.textContent=state==='meditate'?'E — Levantar':'E — Meditar';
    if(externalFocus.locked){hint.hidden=false;hint.textContent=interaction?.snapshot().state==='SCRY_CLOSING'?'Encerrando…':'E — Encerrar vidência';}
    else if(!locked&&!canMeditate&&interaction?.canStart(root.position)){hint.hidden=false;hint.textContent='E — Contemplar lago';}
    if(astralPose.locked)hint.hidden=true;
    return {state,x:root.position.x,z:root.position.z,speed,meditation,walkWeight,phase};
  }
  update(0);
  return {root,update,standUp,
    isStable:()=>['idle','walk','stop'].includes(state)&&!externalFocus.locked,
    movementInput:()=>screenRight.clone().multiplyScalar(Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))).addScaledVector(screenUp,Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))),
    setAstralController(handler){astralController=handler;},
    setAstralPose(next){if(next.locked!==astralPose.locked){keys.clear();velocity.set(0,0,0);state='idle';}astralPose=next;if(!next.locked)meditation=0;},
    setInteraction(handler){interaction=handler;},setExternalFocus(next){if(next.locked!==externalFocus.locked){keys.clear();velocity.set(0,0,0);if(state==='walk'||state==='stop')state='idle';}externalFocus=next;},setMeditationExitHandler(handler){meditationExitHandler=handler;}};
}
