import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import { createVeilWanderers } from './veil-wanderers.js';

const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

// One controller, one existing update loop. Ritual and pond own their states.
export function createVeil({scene,camera,renderer,witch,familiar,skulls,portal,environment,lanterns,canEnter}){
 const root=new THREE.Group();root.name='veil-presence';root.visible=false;scene.add(root);
 // Violet belongs to the spectral figures; the garden keeps its blue night.
 const spectralTone=new THREE.Color('#b488ff');
 const spectralEyeTone=new THREE.Color('#ead3ff');
 const shared={time:{value:0},strength:{value:0},spectralTone:{value:spectralTone}};
 // Only the astral copy is remodelled. The physical hierarchy and its gait
 // remain the source of the recognisable head, costume and hand geometry.
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
  if(!o.isMesh||!o.visible||o.name==='draped-skirt')return;
  let ancestor=o,part=o.name==='shoulder-cloak'?6:0,arm=0;
  while(ancestor){
   if(ancestor.name==='leftLegPivot'||ancestor.name==='rightLegPivot')return;
   if(ancestor.name==='headRoot')part=1;
   if(ancestor.name==='leftArmPivot')arm=-1;if(ancestor.name==='rightArmPivot')arm=1;
   ancestor=ancestor.parent;
  }
  if(part===1&&o.name.includes('hair'))part=8;
  let g=o.geometry.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));g.computeBoundingBox();
  if(part===0&&!arm&&g.boundingBox.max.y<.30){g.dispose();return}
  if(arm)part=(arm<0?2:4)+(g.boundingBox.getCenter(V()).y<.69?1:0);
  append(g,o.material.color??new THREE.Color('#8273b4'),part);
 });
 // Three broad, overlapping fabric skirts. No axis collapses to a tail/cone.
 // Each open hem has its own scallops, folds, transparency and bone weighting.
 function fabric(layer){
  const profiles=[[[.63,.151],[.52,.185],[.38,.230],[.22,.276],[.06,.330],[-.12,.368]],
   [[.626,.162],[.49,.209],[.34,.272],[.19,.321],[.035,.358]],
   [[.62,.176],[.50,.239],[.36,.289],[.24,.318],[.12,.341]]];
  const curve=new THREE.CatmullRomCurve3(profiles[layer].map(([y,r])=>V(y,r,0)),false,'catmullrom',.25);
  const positions=[],indices=[],rows=24,sides=48;
  for(let i=0;i<=rows;i++){
   const t=i/rows,p=curve.getPoint(t),free=ease((t-.20)/.8);
   for(let j=0;j<=sides;j++){
    const a=j/sides*Math.PI*2,fold=1+free*(.070*Math.cos(a*7+layer*.9)+.026*Math.sin(a*11-layer));
    const scallop=Math.pow(t,5)*(.037*Math.sin(a*(layer?5:7)+layer)+.025*Math.sin(a*3+.8*layer));
    positions.push(Math.cos(a)*p.y*fold,p.x+scallop,Math.sin(a)*p.y*.78*fold-.048*free);
   }
  }
  for(let i=0;i<rows;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  append(g,new THREE.Color(layer===0?'#674488':layer===1?'#9975c9':'#a68acb'),layer===0?7:layer===1?9:10);
 }
 for(let layer=0;layer<3;layer++)fabric(layer);
 // Two tapered locks continue the existing hair into loose spectral ends.
 // Their roots share the head, their lengths blend through the hair bones.
 for(const side of [-1,1]){
  const curve=new THREE.CatmullRomCurve3([V(side*.115,1.10,-.035),V(side*.17,.92,-.06),V(side*.205,.76,-.105),V(side*.22,.63,-.15),V(side*.175,.55,-.135)]);
  const g=new THREE.TubeGeometry(curve,24,.025,8,false),a=g.attributes.position;
  for(let i=0;i<=24;i++){const t=i/24,center=curve.getPoint(t),radius=1-ease((t-.25)/.75)*.97;for(let j=0;j<=8;j++){const k=i*9+j;a.setXYZ(k,center.x+(a.getX(k)-center.x)*radius,center.y+(a.getY(k)-center.y)*radius,center.z+(a.getZ(k)-center.z)*radius)}}
  g.computeVertexNormals();append(g,new THREE.Color('#8775b1'),8);
 }
 const ghostGeometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
 // A real rest-pose skeleton, shared by colour, contour and occlusion surfaces.
 // 22 useful joints: root/spine/head, two 3-joint arms, two 2-joint hair locks,
 // and three 3-joint cloth branches. No physical character bones are changed.
 const bones=[],rest=[];
 function joint(name,parentIndex,x,y,z){
  const b=new THREE.Bone();b.name='astral-'+name;const position=V(x,y,z);rest.push(position);
  b.position.copy(position);if(parentIndex>=0){b.position.sub(rest[parentIndex]);bones[parentIndex].add(b)}bones.push(b);return bones.length-1;
 }
 joint('root',-1,0,0,0);joint('spine',0,0,.66,0);joint('head',1,0,.995,0);
 for(const side of [-1,1]){const upper=joint(side<0?'left-shoulder':'right-shoulder',1,side*.19,.85,0);const fore=joint(side<0?'left-elbow':'right-elbow',upper,side*.23,.65,0);joint(side<0?'left-hand':'right-hand',fore,side*.235,.46,0)}
 for(const side of [-1,1]){const upper=joint(side<0?'left-hair':'right-hair',2,side*.12,1.03,-.055);joint(side<0?'left-hair-tip':'right-hair-tip',upper,side*.13,.77,-.060)}
 for(let k=0;k<3;k++){const a=k*Math.PI*2/3,base=joint('cloth-'+k+'-waist',0,0,.625,0);const mid=joint('cloth-'+k+'-fold',base,Math.cos(a)*.14,.34,Math.sin(a)*.11);joint('cloth-'+k+'-hem',mid,Math.cos(a)*.25,.04,Math.sin(a)*.19-.04)}
 const vertex=ghostGeometry.attributes.position,partAttribute=ghostGeometry.attributes.astralPart;
 const skinIndices=new Uint16Array(vertex.count*4),skinWeights=new Float32Array(vertex.count*4);
 function weights(i,ids,values){for(let k=0;k<4;k++){skinIndices[i*4+k]=ids[k]??0;skinWeights[i*4+k]=values[k]??0}}
 for(let i=0;i<vertex.count;i++){
  const x=vertex.getX(i),y=vertex.getY(i),z=vertex.getZ(i),part=partAttribute.getX(i);
  if(part===7||part===9||part===10){
   const azimuth=((Math.atan2(z+.035,x)/(Math.PI*2))*3+3)%3,a=Math.floor(azimuth),b=(a+1)%3,angular=azimuth-a;
   const level=clamp((.625-y)/.295,0,2),low=Math.min(1,Math.floor(level)),f=level-low;
   weights(i,[13+a*3+low,13+a*3+low+1,13+b*3+low,13+b*3+low+1],[(1-angular)*(1-f),(1-angular)*f,angular*(1-f),angular*f]);
  }else if(part===8){
   const hair=x<0?9:11,free=1-ease((y-.74)/.37),tip=1-ease((y-.72)/.20);
   weights(i,[2,hair,hair+1],[1-free,free*(1-tip),free*tip]);
  }else if(part===1)weights(i,[2],[1]);
  else if(part>=2&&part<=5){
   const arm=part<4?3:6,elbow=1-ease((y-.58)/.16),hand=1-ease((y-.44)/.08);
   weights(i,[1,arm,arm+1,arm+2],[.12*ease((y-.80)/.07),(1-elbow)*(1-.12*ease((y-.80)/.07)),elbow*(1-hand),elbow*hand]);
  }else{const spine=ease((y-.60)/.20);weights(i,[0,1],[1-spine,spine])}
 }
 ghostGeometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));ghostGeometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));
 const ghostUniforms={...shared,opacity:{value:0},concentration:{value:0},shellWidth:{value:0},drift:{value:new THREE.Vector2()},inertia:{value:new THREE.Vector2()}};
 // Skinning gives actual joint deformation; travelling folds are a second,
 // low-amplitude GPU layer, with finite-difference normals for cloth lighting.
 const ghostVertex=`attribute float astralPart;varying vec3 nView,pView,pLocal,shade;varying float part;uniform float time,shellWidth;uniform vec2 drift,inertia;
  #include <skinning_pars_vertex>
  vec3 clothWave(vec3 p,float layer){float free=1.-smoothstep(.08,.62,p.y);float a=atan(p.z,p.x);float phase=layer*.83;
   p.x+=free*(.022*sin(p.y*8.-time*.91+a*2.+phase)+.011*sin(time*.57-p.y*12.+a*3.));
   p.z+=free*(.028*sin(p.y*7.-time*.73+a*3.+phase)-drift.y*.028-inertia.y*.012);
   p.x-=free*(drift.x*.030+inertia.x*.012);p.y+=free*.016*sin(a*5.+p.y*5.-time*1.03+phase);return p;}
  void main(){pLocal=position;shade=color;part=astralPart;
   #include <skinbase_vertex>
   vec3 objectNormal=normal;
   #include <skinnormal_vertex>
   vec3 transformed=position;
   #include <skinning_vertex>
   vec3 p=transformed,n=normalize(objectNormal);
   if(abs(part-7.)<.25||abs(part-9.)<.25||abs(part-10.)<.25){
    vec3 t=normalize(cross(n,vec3(0.,1.,.07))),b=normalize(cross(n,t));
    vec3 center=clothWave(p,part),d1=clothWave(p+t*.002,part)-center,d2=clothWave(p+b*.002,part)-center;
    n=normalize(cross(d1,d2));p=center;
   }else if(abs(part-8.)<.25){float lock=1.-smoothstep(.75,1.12,pLocal.y);p.x+=lock*.012*sin(pLocal.y*8.-time*.84+pLocal.x*8.);p.z+=lock*.014*sin(pLocal.y*11.-time*.65);}
   else if(abs(part-6.)<.25){float free=1.-smoothstep(.48,.90,pLocal.y);p.z+=free*(.023*sin(pLocal.x*9.-time*.79)-drift.y*.038);p.x-=free*drift.x*.026;}
   else if(abs(part-1.)<.25&&pLocal.y>1.30){float tip=smoothstep(1.30,1.65,pLocal.y);p.x+=tip*.017*sin(time*.64);p.z-=tip*drift.y*.024;}
   p+=n*shellWidth;nView=normalize(normalMatrix*n);vec4 view=modelViewMatrix*vec4(p,1.);pView=view.xyz;gl_Position=projectionMatrix*view;}`;
 const ghostFragment=`varying vec3 nView,pView,pLocal,shade;varying float part;uniform float time,opacity,concentration;uniform vec3 spectralTone;
  float hemAlpha(){float fabric=(abs(part-7.)<.25||abs(part-9.)<.25||abs(part-10.)<.25)?1.:0.;float lower=abs(part-7.)<.25?-.12:abs(part-9.)<.25?.035:.12;
   float a=atan(pLocal.z,pLocal.x),edge=lower+.035*sin(a*5.-time*.43)+.025*sin(a*9.+time*.31);
   return mix(1.,smoothstep(edge-.04,edge+.19,pLocal.y),fabric);}
  void main(){vec3 n=normalize(nView);float facing=abs(dot(n,normalize(-pView))),rim=pow(1.-facing,2.4);
   float key=max(0.,dot(n,normalize(vec3(-.52,.76,.65)))),fill=max(0.,dot(n,normalize(vec3(.72,.18,-.55))));
   float azimuth=atan(pLocal.z,pLocal.x),fold=.5+.5*sin(azimuth*7.+pLocal.y*5.);
   float fabric=(abs(part-7.)<.25||abs(part-9.)<.25||abs(part-10.)<.25)?1.:0.,hair=abs(part-8.)<.25?1.:0.;
   float band=pow(.5+.5*sin(pLocal.y*10.-time*1.14+.35*sin(azimuth*3.+time*.37)),9.);
   float channel=pow(.5+.5*sin(azimuth*3.+pLocal.y*7.-time*.47),14.);
   float identity=clamp(dot(shade,vec3(.22,.60,.18))*1.5,.13,.85);
   vec3 dark=vec3(.075,.027,.155),lit=mix(vec3(.36,.18,.57),vec3(.49,.33,.70),hair*.70+identity*.18);
   vec3 c=mix(dark,lit,pow(key,.8)*.88)+vec3(.075,.065,.16)*fill;
   c*=1.-fabric*(1.-fold)*.18;
   c+=vec3(.67,.48,1.05)*rim*.58+spectralTone*(band*channel*.17+concentration*.10);
   c+=vec3(.28,.19,.45)*fabric*band*(1.-hemAlpha())*.38;
   float layerAlpha=abs(part-7.)<.25?.72:abs(part-9.)<.25?.36:.28;
   if(abs(part-9.)<.25)layerAlpha*=.45+.55*pow(.5+.5*sin(azimuth*4.+.8),3.);
   if(abs(part-10.)<.25)layerAlpha*=.32+.68*pow(.5+.5*sin(azimuth*3.+1.4),4.);
   float alpha=(fabric>.5?layerAlpha:hair>.5?.77*(.25+.75*smoothstep(.55,.86,pLocal.y)):.89)*hemAlpha();alpha+=rim*.07*hemAlpha();
   gl_FragColor=vec4(c,opacity*alpha);}`;
 const ghostMaterial=new THREE.ShaderMaterial({uniforms:ghostUniforms,transparent:true,depthWrite:false,side:THREE.FrontSide,vertexColors:true,vertexShader:ghostVertex,fragmentShader:ghostFragment});
 const projection=new THREE.SkinnedMesh(ghostGeometry,ghostMaterial);projection.name='witch-astral-projection';projection.frustumCulled=false;projection.renderOrder=9;root.add(projection);projection.add(bones[0]);
 projection.normalizeSkinWeights();projection.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);projection.bind(skeleton);
 const contour=new THREE.SkinnedMesh(ghostGeometry,new THREE.ShaderMaterial({uniforms:{...ghostUniforms,shellWidth:{value:.009}},vertexColors:true,vertexShader:ghostVertex,
  fragmentShader:`varying vec3 pLocal,nView,pView;varying float part;uniform float opacity,time;void main(){float free=(abs(part-7.)<.25||abs(part-9.)<.25||abs(part-10.)<.25)?smoothstep(-.15,.23,pLocal.y):1.;float rim=pow(1.-abs(dot(normalize(nView),normalize(-pView))),3.);
   gl_FragColor=vec4(vec3(.57,.40,.92),opacity*free*rim*.26);}`,transparent:true,depthWrite:false,side:THREE.BackSide}));
 contour.name='astral-violet-contour';contour.frustumCulled=false;contour.renderOrder=7;contour.bind(skeleton,projection.bindMatrix);root.add(contour);
 // Upper dressed surfaces resolve depth, hiding anatomy under the costume.
 // Legs are excluded; the lower fabric can therefore blend and dissolve freely.
 const depthShell=new THREE.SkinnedMesh(ghostGeometry,new THREE.ShaderMaterial({uniforms:ghostUniforms,vertexColors:true,vertexShader:ghostVertex,
  fragmentShader:`varying vec3 pLocal;varying float part;void main(){if(abs(part-7.)<.25||abs(part-9.)<.25||abs(part-10.)<.25||(abs(part-8.)<.25&&pLocal.y<.78))discard;gl_FragColor=vec4(0.);}`,
  colorWrite:false,depthWrite:true,transparent:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,side:THREE.FrontSide}));
 depthShell.name='astral-dressed-depth';depthShell.frustumCulled=false;depthShell.renderOrder=8;depthShell.bind(skeleton,projection.bindMatrix);root.add(depthShell);
 const motionMemory=new THREE.Vector2(),previousDrift=new THREE.Vector2();
 function animateAstral(dt){
  const drift=ghostUniforms.drift.value,acceleration=ghostUniforms.inertia.value;
  motionMemory.lerp(drift,1-Math.exp(-2.8*dt));
  if(dt>0){acceleration.set(clamp((drift.x-previousDrift.x)/dt,-4,4),clamp((drift.y-previousDrift.y)/dt,-4,4));previousDrift.copy(drift)}
  const t=clock;
  bones[1].rotation.set(.018*Math.sin(t*.61)+motionMemory.y*.025,.026*Math.sin(t*.47)-motionMemory.x*.033,.042*Math.sin(t*.73)-motionMemory.x*.030);
  bones[2].rotation.set(.035*Math.sin(t*.71+.4)-motionMemory.y*.017,.075*Math.sin(t*.51),-.032*Math.sin(t*.73));
  for(let k=0;k<2;k++){
   const side=k?1:-1,arm=3+k*3,phase=k*2.3;
   bones[arm].rotation.set(-.15+.09*Math.sin(t*.63+phase)-motionMemory.y*.052,.03*Math.sin(t*.41+phase),side*(.25+.09*Math.sin(t*.77+phase)+Math.abs(motionMemory.x)*.06));
   bones[arm+1].rotation.set(-.26+.13*Math.sin(t*.57+phase+1.),.045*Math.sin(t*.37+phase),side*.05*Math.sin(t*.49+phase));
   bones[arm+2].rotation.set(.06*Math.sin(t*.81+phase),.05*Math.sin(t*.47+phase),side*.075*Math.sin(t*.53+phase));
   const hair=9+k*2;bones[hair].rotation.set(.065*Math.sin(t*.67+phase)-motionMemory.y*.080,0,.04*Math.sin(t*.59+phase)-motionMemory.x*.085);
   bones[hair+1].rotation.set(.080*Math.sin(t*.67+phase-.7)-motionMemory.y*.075,0,.070*Math.sin(t*.59+phase-.9)-motionMemory.x*.065);
  }
  for(let k=0;k<3;k++)for(let j=0;j<3;j++){
   const b=bones[13+k*3+j],phase=k*1.9-j*.72,weight=(j+1)/3;
   b.rotation.set(weight*(.050*Math.sin(t*.74+phase)-motionMemory.y*.065),.022*Math.sin(t*.51+phase),weight*(.062*Math.sin(t*.63+phase)-motionMemory.x*.060));
  }
 }
 const segmentCount=40,linePositions=new Float32Array((segmentCount+1)*2*3),uv=[],indices=[];
 for(let i=0;i<=segmentCount;i++){uv.push(i/segmentCount,0,i/segmentCount,1);if(i<segmentCount){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2)}}
 const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.BufferAttribute(linePositions,3));lineGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));lineGeometry.setIndex(indices);
 const tetherUniforms={...shared,tension:{value:0},opacity:{value:0}};
 const lineMaterial=new THREE.ShaderMaterial({uniforms:tetherUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 vUv;uniform float time,tension,opacity;uniform vec3 spectralTone;
   void main(){float across=vUv.y*2.-1.,along=vUv.x;
    float braid=sin(along*16.-time*1.15)*.22*sin(along*3.14159);
    float core=exp(-pow((across-braid)*5.,2.));
    float filament=exp(-pow((across+braid)*7.,2.))*.40;
    float halo=exp(-across*across*3.)*(1.-smoothstep(.72,1.,abs(across)));
    float flow=.58+.42*pow(.5+.5*sin(along*19.-time*2.7+sin(along*7.+time*.37)),3.);
    vec3 c=mix(vec3(.29,.23,.49),spectralTone*(.95+tension*.22),clamp(core+filament,0.,1.));
    gl_FragColor=vec4(c,opacity*(halo*.23+(core+filament)*.63)*flow);}`
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
    float hollow=smoothstep(.29,.49,n)*(1.-smoothstep(.64,.86,n));
    vec3 c=mix(vec3(.10,.14,.24),vec3(.34,.36,.52),n);c+=vec3(.11,.14,.23)*filament;
    gl_FragColor=vec4(c,strength*perimeter*envelope*(curl*.40+hollow*.12+filament*.11));}`
 });
 const mistAnchors=[[-4.4,.33,2.1],[4.15,.31,-1.7],[-2.8,.36,-3.45],[4.2,.28,3.5],[.15,.29,4.65],[-4.85,.32,-.7],[2.35,.34,-3.95],[5.15,.27,.6],[-3.3,.29,3.55],[2.15,.26,4.35],[-4.25,.30,-2.15],[.15,.27,-4.45],[-3.85,.28,-2.8],[4.65,.25,1.8]];
 const mist=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),mistMaterial,mistAnchors.length);mist.name='veil-low-wisps';mist.frustumCulled=false;root.add(mist);
 const billboard=new THREE.Object3D();for(let i=0;i<mistAnchors.length;i++){billboard.position.set(...mistAnchors[i]);billboard.quaternion.copy(camera.quaternion);billboard.scale.set(3.25+(i%3)*.28,.74+(i%2)*.16,1);billboard.updateMatrix();mist.setMatrixAt(i,billboard.matrix)}
 // Sixty-four fixed slots: eyes, passive auras, portal dust and a short trail.
 const count=64,pointPositions=new Float32Array(count*3),pointSizes=new Float32Array(count),pointAlpha=new Float32Array(count),pointColors=new Float32Array(count*3);
 const pointsGeometry=new THREE.BufferGeometry();pointsGeometry.setAttribute('position',new THREE.BufferAttribute(pointPositions,3));pointsGeometry.setAttribute('size',new THREE.BufferAttribute(pointSizes,1));pointsGeometry.setAttribute('alpha',new THREE.BufferAttribute(pointAlpha,1));pointsGeometry.setAttribute('color',new THREE.BufferAttribute(pointColors,3));
 for(let i=0;i<count;i++)new THREE.Color(i<20?'#bf8eff':i%3?'#c3a0ff':'#ead6ff').toArray(pointColors,i*3);
 const pointsMaterial=new THREE.ShaderMaterial({uniforms:{...shared,pixelRatio:{value:renderer.getPixelRatio()}},transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,
  vertexShader:`attribute float size,alpha;varying float vAlpha;varying vec3 vColor;uniform float pixelRatio;void main(){vAlpha=alpha;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size*pixelRatio;}`,
  fragmentShader:`varying float vAlpha;varying vec3 vColor;uniform float strength;void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*6.)*(1.-smoothstep(.75,1.,d));gl_FragColor=vec4(vColor,strength*vAlpha*a);}`
 });
 const points=new THREE.Points(pointsGeometry,pointsMaterial);points.name='veil-spiritual-points';points.frustumCulled=false;root.add(points);
 const bodyAnchor=V(),ghostAnchor=V(),point=V(),side=V(),direction=V(),scratch=V(),radial=V(),offset=V(),tangent=V(),edgePoint=V();
 const driftTarget=new THREE.Vector2(),groundCold=new THREE.Color('#232746'),lampTone=new THREE.Color();camera.getWorldDirection(direction);
 const worldMaterials=new Map(),lightBases=[],warmSurfaces=[];
 const lampBases=lanterns.map(l=>({lamp:l,glassColor:l.glass.color.clone()}));
 const bodyMaterials=new Set(),catMaterials=new Set(),catEyes=new Set();witch.root.traverse(o=>{if(o.material)bodyMaterials.add(o.material)});familiar.root.traverse(o=>{if(o.material){catMaterials.add(o.material);if(o.name==='cat-almond-eyes')catEyes.add(o.material)}});
 scene.traverse(o=>{
  if(o.isLight)lightBases.push({light:o,color:o.color.clone(),ground:o.groundColor?.clone(),intensity:o.intensity,live:o.intensity});
  if(!o.isMesh||!o.layers.test(camera.layers))return;
  let parent=o,excluded=false;while(parent){if(parent===root||parent.name==='ritual'||parent.name==='scrying-vision')excluded=true;parent=parent.parent}if(excluded)return;
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   if(m.isMeshBasicMaterial&&m.toneMapped===false&&m.color.r>m.color.b*1.5&&!lampBases.some(b=>b.lamp.core===m||b.lamp.glass===m)&&!warmSurfaces.some(b=>b.material===m))warmSurfaces.push({material:m,color:m.color.clone()});
   if(!m.isMeshStandardMaterial||m.userData.familiarSpectral||bodyMaterials.has(m)||worldMaterials.has(m))continue;
   const base=m.color.clone(),luma=base.r*.2126+base.g*.7152+base.b*.0722;
   const cold=base.clone().lerp(new THREE.Color(luma*.70,luma*.76,luma*1.02),.42);
   worldMaterials.set(m,{base,cold,emissive:m.emissive.clone(),isCat:catMaterials.has(m),isEye:catEyes.has(m),eyeIntensity:m.emissiveIntensity,warm:m.emissive.r>m.emissive.b*1.5});
  }
 });
 // Reveal the familiar's contour on its existing materials, without another cat.
 for(const m of catMaterials){
  if(!m.isMeshStandardMaterial||m.userData.familiarSpectral||catEyes.has(m))continue;
  const compile=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=shader=>{compile.call(m,shader);shader.uniforms.astralPresence=shared.strength;shader.uniforms.astralTone=shared.spectralTone;shader.uniforms.astralTime=shared.time;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 spectralLocal;').replace('#include <project_vertex>','spectralLocal=transformed;\n#include <project_vertex>');
   shader.fragmentShader='uniform float astralPresence,astralTime;uniform vec3 astralTone;varying vec3 spectralLocal;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   float catRim=pow(1.-abs(dot(normal,normalize(vViewPosition))),1.6);
   float catLight=.48+.52*max(0.,dot(normal,normalize(vec3(-.4,.8,.6))));
   float catVein=exp(-pow((spectralLocal.x-.027*sin(spectralLocal.z*13.-astralTime*.62+spectralLocal.y*5.))/.024,2.));
   float catFlow=.5+.5*sin(spectralLocal.z*17.-astralTime*1.5+spectralLocal.y*8.);
   vec3 catSpirit=mix(vec3(.13,.045,.29),astralTone*.70,catLight)+vec3(.76,.46,1.30)*catRim*.90+astralTone*catVein*catFlow*.22;
   outgoingLight=mix(outgoingLight,catSpirit,astralPresence);
   #include <opaque_fragment>`)};
  m.customProgramCacheKey=()=>key+'familiar-spirit-v3-violet-volume';m.needsUpdate=true;
 }
 const bodyBases=[...bodyMaterials].filter(m=>m.emissive).map(m=>({material:m,emissive:m.emissive.clone()}));
 const bodySoft=new THREE.Color('#30364c');
 const fogBase={color:scene.fog.color.clone(),density:scene.fog.density};
 const fogCold=new THREE.Color('#232944'),moonCold=new THREE.Color('#afb6f5'),warmCold=new THREE.Color('#9ab2ed');
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
   projection.position.copy(origin).add(scratch.set(.34*emerge,.12*emerge,.36*emerge));
   if(elapsed>=2.1){state='VEIL_ACTIVE';elapsed=0;weight=opacity=meditation=1;}
  }else if(state==='VEIL_ACTIVE'){
   const requested=witch.movementInput();if(requested.lengthSq()>0)requested.normalize();
   radial.copy(projection.position).sub(origin).setY(0);distance=radial.length();tension=ease((distance-softLimit)/(hardLimit-softLimit));
   const outward=distance>0?requested.dot(scratch.copy(radial).normalize()):0;if(outward>0)requested.addScaledVector(radial.normalize(),-outward*tension*.94);
   requested.multiplyScalar(1.65);velocity.lerp(requested,1-Math.exp(-7*dt));projection.position.addScaledVector(velocity,dt);
   offset.copy(projection.position).sub(origin).setY(0);if(offset.length()>hardLimit){offset.setLength(hardLimit);projection.position.x=origin.x+offset.x;projection.position.z=origin.z+offset.z;const n=offset.normalize(),v=velocity.dot(n);if(v>0)velocity.addScaledVector(n,-v)}
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
  ghostUniforms.drift.value.lerp(driftTarget.set(localSide,localForward),1-Math.exp(-3*dt));
  const floatPitch=opacity*(Math.sin(clock*.79)*.033+Math.sin(clock*.43+.4)*.013+localForward*.035);
  const floatRoll=opacity*(Math.sin(clock*.91+.7)*.032-localSide*.043);
  projection.rotation.x=lerp(projection.rotation.x,floatPitch,1-Math.exp(-3.8*dt));projection.rotation.z=lerp(projection.rotation.z,floatRoll,1-Math.exp(-3.8*dt));
  if(active())witch.setAstralPose({locked:true,meditation});
 }
 function put(i,p,size,alpha){p.toArray(pointPositions,i*3);pointSizes[i]=size;pointAlpha[i]=alpha}
 function present(dt){
  const concentration=state==='VEIL_ENTERING'?Math.sin(Math.PI*ease(elapsed/2.1)):state==='VEIL_RETURNING'?Math.sin(Math.PI*ease(elapsed/2.1)):0;
  shared.time.value=clock;shared.strength.value=weight;ghostUniforms.opacity.value=opacity;ghostUniforms.concentration.value=concentration;
  if(active())animateAstral(dt);
  depthShell.visible=opacity>.001;depthShell.position.copy(projection.position);depthShell.rotation.copy(projection.rotation);
  contour.visible=opacity>.001;contour.position.copy(projection.position);contour.rotation.copy(projection.rotation);
  wanderers.update(dt,weight,state==='VEIL_ENTERING'||state==='VEIL_ACTIVE');
  environment.setVeilStrength(weight);portal.uniforms.veilStrength.value=weight;
  if(lastWeight!==weight){
   for(const [m,b] of worldMaterials){m.color.copy(b.base).lerp(b.cold,weight);if(b.isEye){m.color.lerp(spectralTone,weight);m.emissive.copy(b.emissive).lerp(spectralEyeTone,weight);m.emissiveIntensity=lerp(b.eyeIntensity,1.18,weight)}else if(b.isCat)m.emissive.copy(b.emissive);else if(b.warm)m.emissive.copy(b.emissive).multiplyScalar(1-weight*.72)}
   for(const b of bodyBases)b.material.emissive.copy(b.emissive).lerp(bodySoft,weight*.26);
   scene.fog.color.copy(fogBase.color).lerp(fogCold,weight);for(const b of warmSurfaces)b.material.color.copy(b.color).lerp(spectralTone,weight);
   scene.fog.density=lerp(fogBase.density,.042,weight);lastWeight=weight;
  }
  for(const b of lightBases){
   b.live=b.light.intensity;if(weight===0)continue;
   const warm=b.color.r>b.color.b*1.5;b.light.color.copy(b.color).lerp(warm?warmCold:moonCold,weight*(warm?1:.32));b.light.intensity=b.live*lerp(1,warm?.76:b.light.isDirectionalLight&& !b.light.castShadow?1.7:1.22,weight);
   if(b.ground)b.light.groundColor.copy(b.ground).lerp(groundCold,weight*.60);
  }
  // The garden animation restores each core's live flicker before this step.
  for(const b of lampBases){const l=b.lamp,flicker=l.core.color.r/Math.max(l.baseColor.r,.0001);l.core.color.lerp(lampTone.copy(spectralTone).multiplyScalar(flicker),weight);l.glass.color.copy(b.glassColor).lerp(spectralTone,weight);}
  for(const skull of skulls)for(const b of skull.userData.ritualBoneMaterials??[])if(weight>0)b.material.emissive.copy(b.baseEmissive).lerp(spectralTone,weight*.17);
  if(!active())return;
  distance=Math.hypot(projection.position.x-origin.x,projection.position.z-origin.z);if(state==='VEIL_ACTIVE')tension=ease((distance-softLimit)/(hardLimit-softLimit));
  for(const b of bodyBases)b.material.emissive.copy(b.emissive).lerp(bodySoft,weight*.26).lerp(spectralTone,concentration*.16);
  bodyAnchor.copy(origin).add(scratch.set(0,.81-.34*meditation,0));ghostAnchor.copy(projection.position).add(scratch.set(0,.79,0).applyQuaternion(projection.quaternion));
  tangent.copy(ghostAnchor).sub(bodyAnchor);side.crossVectors(tangent,direction).normalize();if(side.lengthSq()<.01)side.set(1,0,0);
  const width=lerp(.046,.024,clamp(distance/hardLimit,0,1));
  for(let i=0;i<=segmentCount;i++){
   const u=i/segmentCount,wave=Math.sin(Math.PI*u),swirl=(Math.sin(u*9.-clock*.85)*.058+Math.sin(u*5.+clock*.49)*.024)*wave*(1-tension*.35);
   point.lerpVectors(bodyAnchor,ghostAnchor,u);point.y+=wave*(.31+.10*Math.sin(u*4.+clock*.65))*(1-tension*.46);point.addScaledVector(side,swirl);
   const taper=width*(.65+.35*wave);edgePoint.copy(point).addScaledVector(side,-taper).toArray(linePositions,i*6);edgePoint.copy(point).addScaledVector(side,taper).toArray(linePositions,i*6+3);
  }
  lineGeometry.attributes.position.needsUpdate=true;tetherUniforms.tension.value=tension;tetherUniforms.opacity.value=opacity*.85;
  // These passive skull eyes never touch ritual responders or lights.
  for(let k=0;k<5;k++){
   const skull=skulls[k];skull.updateMatrixWorld(true);
   for(let j=0;j<2;j++){point.copy(skull.userData.ritualEyes?.[j]??scratch.set(j?.093:-.093,.24,.197));skull.localToWorld(point);put(k*2+j,point,9,1.05+.12*Math.sin(clock*1.2+k*1.83));}
   for(let j=0;j<2;j++){const phase=clock*.32+k*1.9+j*Math.PI;point.copy(skull.position).add(scratch.set(Math.cos(phase)*.12,.34+j*.08+Math.sin(phase)*.04,Math.sin(phase)*.10));put(10+k*2+j,point,11,.16+.05*Math.sin(clock*.8+k));}
  }
  familiar.root.updateMatrixWorld(true);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2+clock*.17;point.set(Math.cos(a)*.19,.10+Math.sin(a)*.06,-.17+Math.sin(a)*.21);familiar.root.localToWorld(point);put(20+i,point,12-i*.9,.13);}
  for(let i=0;i<12;i++){const u=(i/12+clock*.043)%1;point.set((i%2?1:-1)*(.68*(1-u)+Math.sin(clock*.19+i)*.10*u),.25+u*2.05,-4.66+Math.sin(i+clock*.14)*.08);put(26+i,point,3.2,.30*Math.sin(u*Math.PI));}
  trailTime+=dt;if(trailTime>=.095){trailTime%=.095;trail[trailCursor].copy(projection.position);trailCursor=(trailCursor+1)%12;}
  for(let i=0;i<12;i++){const age=(trailCursor-1-i+12)%12;
   point.copy(trail[age]).add(scratch.set(Math.sin(i*.72+clock*.61)*.045,.14+i*.009,Math.cos(i*.65+clock*.49)*.04));
   if(concentration>0){const a=i*2.39996+clock*.47,r=.18+.035*Math.sin(i+clock*.73);
    scratch.copy(origin);scratch.x+=Math.cos(a)*r;scratch.z+=Math.sin(a)*r;scratch.y+=.33+(i%5)*.11-.10*meditation;
    point.lerp(scratch,concentration);}
   put(38+i,point,14-i*.55,opacity*(velocity.length()>.02?.17:.035)*(1-i/12)+concentration*.10*(1-i/18));}
  for(let i=0;i<11;i++){const a=i*2.39996+Math.sin(clock*.07+i)*.035,r=4.3+(i%3)*.22;point.set(Math.cos(a)*r+Math.sin(clock*.14+i)*.12,.25+(i%4)*.12+Math.sin(clock*.21+i)*.08,.3+Math.sin(a)*r*.90);put(50+i,point,3.3,.18+.045*Math.sin(clock*.32+i))}
  for(let i=0;i<3;i++){const a=i*2.1+.5;point.set(Math.cos(a)*4.9,.85+Math.sin(clock*.19+i)*.12,.3+Math.sin(a)*4.1);put(61+i,point,13,.11+.055*Math.sin(clock*.45+i*2))}
  for(const key of ['position','size','alpha'])pointsGeometry.attributes[key].needsUpdate=true;
 }
 function snapshot(){return {state,amount:weight,meditation,opacity,x:projection.position.x,z:projection.position.z,y:projection.position.y,tilt:[projection.rotation.x,projection.rotation.z],body:origin.toArray(),distance,tension,speed:velocity.length(),limit:hardLimit,softLimit,entryCount,exitCount,particles:active()?count:0,additionalLights:0,additionalPasses:0,surface:'depth-resolved-dressed-shell',silhouette:'layered-spectral-witch',lowerBody:'three-open-dissolving-fabric-hems',motion:'native-22-bone-skinning-and-travelling-folds',boneCount:bones.length,fabricLayers:3,characterHeight,mistPlacement:'perimeter-clear-center',projectionSpeed:1.65,mistInstances:mistAnchors.length,spectralColor:'#b488ff',wanderers:wanderers.snapshot()}}
 return {root,projection,active,toggle,prepare,present,snapshot,observation:()=>active()?{x:projection.position.x,z:projection.position.z,amount:weight}:null};
}
