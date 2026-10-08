import * as THREE from './vendor/three.module.js';
import { createWitch } from './character.js';
import { createRitual } from './ritual.js';
import { loadSkullModel } from './skull-model.js';
import { createRenderPipeline } from './render-pipeline.js';
import { createLivingGarden } from './living-garden.js';
import { createFamiliar } from './familiar.js';
import { createScryingPond } from './scrying-pond.js';
import { createVeil } from './veil.js';
import { createPortalSurface } from './portal-surface.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

// BLOCO 4: acabamento local; composição, movimento e sequência preservados.
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.querySelector('#scene').append(renderer.domElement);
scene.fog = new THREE.FogExp2('#101b35', 0.025);
const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, 0.1, 80);
camera.position.set(10, 14, 20);
camera.lookAt(0, 1.05, 0);

// Reprodutibilidade: a vegetação e as irregularidades não mudam a cada abertura.
let seed = 53117;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
const range = (a, b) => a + random() * (b - a);
const material = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...opts });
const palette = {
  stone: ['#655f69','#74707a','#5c5a64','#817777','#716a72'].map(c => material(c)),
  wall: ['#726764','#80746b','#615d62','#898077'].map(c => material(c)),
  wood: material('#49382d'), woodLight: material('#70513b'), darkWood: material('#302a2b'),
  roof: ['#242d44','#303951','#37415b'].map(c => material(c)),
  leaf: ['#1f3f3f','#304b42','#3d5645','#48604a','#233c44'].map(c => material(c)),
  petals: [material('#9e8aa0'), material('#ab8fb3'), material('#8079a0')],
  moss: material('#35423a'), earth: material('#343b37'), dirt: material('#262c30'),
  brass: material('#927447', { metalness: 0.65, roughness: 0.45 }),
  iron: material('#312b29', { metalness: 0.65 }),
  bone: material('#c7b394'), socket: material('#171922'),
  warm: material('#ffd285', { emissive: '#ff891d', emissiveIntensity: 0.95 }),
  wax: material('#d8bc8b'),
};
// Small shared material textures use a separate seed; decorative layout RNG is frozen.
let detailSeed=81271;
const detailRandom=()=>{detailSeed=(Math.imul(detailSeed,1664525)+1013904223)>>>0;return detailSeed/4294967296;};
const detailRange=(a,b)=>a+(b-a)*detailRandom();
function canvasTexture(canvas,repeat=1){
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);
 t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;
}
function surfaceTexture(kind){
 const c=document.createElement('canvas');c.width=c.height=128;const cx=c.getContext('2d');
 cx.fillStyle=kind==='wood'?'#dfd8cf':'#eeece9';cx.fillRect(0,0,128,128);
 if(kind==='wood'){
  for(let i=0;i<42;i++){
   const x=i*3.13;cx.strokeStyle=`rgba(70,47,31,${detailRange(.04,.14)})`;cx.lineWidth=detailRange(.5,1.8);
   cx.beginPath();cx.moveTo(x,0);cx.bezierCurveTo(x+detailRange(-8,8),38,x+detailRange(-7,7),90,x,128);cx.stroke();
  }
  for(const [x,y] of [[35,42],[96,101]])for(let i=1;i<5;i++){
   cx.strokeStyle='rgba(74,46,31,.07)';cx.lineWidth=.6;cx.beginPath();cx.ellipse(x,y,i*1.7,i*4.5,.1,0,Math.PI*2);cx.stroke();
  }
 }else for(let i=0;i<110;i++){
  cx.fillStyle=i%2?'rgba(75,71,83,.08)':'rgba(255,255,255,.12)';cx.beginPath();
  cx.ellipse(detailRange(0,128),detailRange(0,128),detailRange(1,7),detailRange(.5,2),detailRange(0,3),0,Math.PI*2);cx.fill();
 }
 return canvasTexture(c);
}
const stoneTexture=surfaceTexture('stone'),woodTexture=surfaceTexture('wood');
for(const [i,m] of palette.stone.entries()){m.map=stoneTexture;m.bumpMap=stoneTexture;m.bumpScale=.025;m.roughness=.88+i*.016;}
for(const m of palette.wall){m.map=stoneTexture;m.bumpMap=stoneTexture;m.bumpScale=.025;m.roughness=.94;}
for(const m of [palette.wood,palette.woodLight,palette.darkWood]){m.map=woodTexture;m.bumpMap=woodTexture;m.bumpScale=.014;}
palette.wood.roughness=.86;palette.woodLight.roughness=.88;palette.darkWood.roughness=.96;
for(const m of palette.roof){m.map=stoneTexture;m.bumpMap=stoneTexture;m.bumpScale=.018;m.roughness=.80;}
palette.bone.roughness=.84;palette.socket.roughness=1;
// Chanfrados pequenos recebem luz nas arestas sem pós-processamento.
const blockShape=new THREE.Shape();blockShape.moveTo(-.46,-.46);blockShape.lineTo(.46,-.46);blockShape.lineTo(.46,.46);blockShape.lineTo(-.46,.46);blockShape.closePath();
const blockGeo=new THREE.ExtrudeGeometry(blockShape,{depth:.92,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:1,steps:1});blockGeo.translate(0,0,-.46);
// Three leaf silhouettes share the same topology/cost; petals have a softer cupped profile.
function foliageGeometry(kind){
 // Closed lenticular leaf: 14 vertices, 24 triangles, matching the old flat leaf cost.
 const profiles=kind===0?[[-.58,.48],[0,1],[.58,.54]]:kind===1?[[-.57,.72],[-.04,1.03],[.60,.67]]:[[-.63,.70],[0,1],[.64,.71]];
 const p=[0,0,-1],uv=[.5,0],colors=[.72,.72,.72],indices=[],thickness=kind===0?.075:kind===3?.15:.12;
 for(const [z,w] of profiles)for(let j=0;j<4;j++){
  const a=j*Math.PI*.5,t=(z+1)*.5,curl=Math.sin(t*Math.PI)*.10,value=.79+Math.sin(t*Math.PI)*.20+(j===1?.045:0);
  p.push(Math.cos(a)*w,curl+Math.sin(a)*thickness*w,z);uv.push(j/4,t);colors.push(value,value,value);
 }
 p.push(0,0,1);uv.push(.5,1);colors.push(.75,.75,.75);
 for(let j=0;j<4;j++){
  const next=(j+1)%4;indices.push(0,1+next,1+j,13,9+j,9+next);
  for(let row=0;row<2;row++){const a=1+row*4+j,b=1+row*4+next;indices.push(a,b,a+4,b,b+4,a+4);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
const foliageShapes=[0,1,2].map(foliageGeometry),petalGeo=foliageGeometry(3),leafGeo=foliageShapes[0];
const foliageMaterials=new Map();
for(const m of [...palette.leaf,...palette.petals,palette.moss]){
 m.side=THREE.DoubleSide;const surface=m.clone();surface.vertexColors=true;surface.roughness=palette.petals.includes(m)?.86:.96;foliageMaterials.set(m,surface);
}
const geo = {
 box:blockGeo,sphere:new THREE.SphereGeometry(1,12,8),rock:new THREE.IcosahedronGeometry(1,1),leaf:leafGeo,
 cylinder:new THREE.CylinderGeometry(1,1,1,12),cone:new THREE.ConeGeometry(1,1,12),
};
// Shared instanced batches reduce thousands of decorative pieces to a few draws.
const batches = new Map();
const transform = new THREE.Object3D();
function part(g, m, p, s=[1,1,1], r=[0,0,0], shadow=true) {
  if(foliageShapes.includes(g)||g===petalGeo){if(palette.petals.includes(m))g=petalGeo;m=foliageMaterials.get(m)??m;}
  const key = `${g.uuid}/${m.uuid}/${shadow}`;
  if (!batches.has(key)) batches.set(key, { g, m, shadow, matrices: [] });
  transform.position.set(...p); transform.scale.set(...s); transform.rotation.set(...r); transform.updateMatrix();
  batches.get(key).matrices.push(transform.matrix.clone());
}
const box = (m,p,s,r,shadow) => part(geo.box,m,p,s,r,shadow);
const sphere = (m,p,s,r,shadow) => part(geo.sphere,m,p,s,r,shadow);
function beam(a,b,width,m=palette.wood) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
  const mid = av.clone().add(bv).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bv.clone().sub(av).normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  box(m,mid.toArray(),[width,av.distanceTo(bv),width],e.toArray().slice(0,3));
}
function mesh(g,m,p=[0,0,0]) {
  const o=new THREE.Mesh(g,m);o.position.set(...p);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;
}
const grain=document.createElement('canvas');grain.width=128;grain.height=128;
const gr=grain.getContext('2d');gr.fillStyle='#c1bdba';gr.fillRect(0,0,128,128);
for(let i=0;i<4800;i++){gr.fillStyle=i%3?'rgba(35,31,41,.09)':'rgba(249,235,219,.14)';gr.fillRect(random()*128,random()*128,range(.5,2),range(.5,2));}
// Keep the approved random calls above; broad wear uses only the detail seed.
for(let i=0;i<22;i++){
 const x=detailRange(0,128),y=detailRange(0,128),r=detailRange(6,24),fade=gr.createRadialGradient(x,y,0,x,y,r);
 fade.addColorStop(0,i%2?'rgba(70,74,71,.12)':'rgba(241,229,207,.10)');fade.addColorStop(1,'rgba(0,0,0,0)');
 gr.fillStyle=fade;gr.fillRect(x-r,y-r,r*2,r*2);
}
const stoneGrain=canvasTexture(grain);
for(const m of [...palette.stone,...palette.wall]){m.map=stoneGrain;m.bumpMap=stoneGrain;m.bumpScale=.034;}

const pick = arr => arr[Math.floor(random()*arr.length)];

// Noite pintada proceduralmente; não é uma imagem substituindo a cena 3D.
const sky = document.createElement('canvas');sky.width=1536;sky.height=1024;
const sk=sky.getContext('2d');
const gradient=sk.createLinearGradient(0,0,0,1024);
gradient.addColorStop(0,'#10162f');gradient.addColorStop(.6,'#16213a');gradient.addColorStop(1,'#080f1d');
sk.fillStyle=gradient;sk.fillRect(0,0,1536,1024);
for(let i=0;i<65;i++){sk.fillStyle=`rgba(161,179,214,${range(.08,.4)})`;sk.beginPath();sk.arc(range(0,1536),range(0,580),range(.6,1.4),0,Math.PI*2);sk.fill();}
// Pequena lua em crescente, discreta e atrás do jardim.
sk.fillStyle='#b5b4dc';sk.beginPath();sk.arc(1290,140,28,0,Math.PI*2);sk.fill();
sk.fillStyle='#111830';sk.beginPath();sk.arc(1303,130,27,0,Math.PI*2);sk.fill();
let skyTex=new THREE.CanvasTexture(sky);skyTex.colorSpace=THREE.SRGBColorSpace;
scene.background=skyTex;

scene.add(new THREE.HemisphereLight('#879fcf','#252325',1.05));
const moon=new THREE.DirectionalLight('#9cb4ed',1.8);moon.position.set(-5,13,-7);moon.castShadow=true;
moon.shadow.mapSize.set(2048,2048);moon.shadow.camera.left=-10;moon.shadow.camera.right=10;
moon.shadow.camera.top=10;moon.shadow.camera.bottom=-10;moon.shadow.camera.near=.1;moon.shadow.camera.far=36;
moon.shadow.normalBias=.018;moon.shadow.bias=-.0002;moon.shadow.radius=2;scene.add(moon);
const bounce=new THREE.DirectionalLight('#647da7',.60);bounce.position.set(3,7,12);scene.add(bounce);

// Ilha de solo irregular com borda orgânica, água no lado direito.
const outline=[[-6,-5.5],[-2.9,-5.8],[.2,-5.65],[2.8,-5.1],[3.9,-3.4],[3.6,-1.3],[4.5,.5],[4.2,2.3],[3.2,4.4],[.5,5.7],[-2,5.5],[-4.4,4.6],[-5.8,2.8],[-6.3,-.5]];
const shape=new THREE.Shape();outline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
const landGeo=new THREE.ExtrudeGeometry(shape,{depth:.6,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.18,bevelThickness:.14});
landGeo.rotateX(-Math.PI/2);mesh(landGeo,[palette.earth,palette.dirt],[0,-.6,0]);
// Unobtrusive darker plinth beneath the pool and island, visually bounded diorama.
// O próprio terreno sustenta o diorama; sem pedestal retangular de demo.
// Static water relief: no reflection render, simulation or time-dependent shader.
const waterCanvas=document.createElement('canvas');waterCanvas.width=waterCanvas.height=128;
const wctx=waterCanvas.getContext('2d');wctx.fillStyle='#808080';wctx.fillRect(0,0,128,128);
for(let row=0;row<24;row++){
 const y=row*128/24;wctx.strokeStyle=row%2?'rgba(255,255,255,.26)':'rgba(0,0,0,.23)';wctx.lineWidth=detailRange(1,3);
 wctx.beginPath();wctx.moveTo(0,y);wctx.bezierCurveTo(40,y+detailRange(-5,5),85,y+detailRange(-5,5),128,y);wctx.stroke();
}
const waterRelief=canvasTexture(waterCanvas,.32);waterRelief.colorSpace=THREE.NoColorSpace;
const waterColor=document.createElement('canvas');waterColor.width=waterColor.height=128;
const waveColor=waterColor.getContext('2d');waveColor.fillStyle='#a9bfcd';waveColor.fillRect(0,0,128,128);
for(let i=0;i<18;i++){
 const x=detailRange(0,128),y=detailRange(0,128),length=detailRange(18,42);
 waveColor.strokeStyle='rgba(245,249,253,.32)';waveColor.lineWidth=detailRange(1.5,3);
 waveColor.beginPath();waveColor.moveTo(x,y);waveColor.quadraticCurveTo(x+length*.5,y+3,x+length,y);waveColor.stroke();
}
const water=material('#30566c',{metalness:.20,roughness:.30,map:canvasTexture(waterColor,.32),bumpMap:waterRelief,bumpScale:.090});
const rippleMaterial=material('#638294',{transparent:true,opacity:.14,depthWrite:false,roughness:.36,metalness:.24});
const lakeOutline = new THREE.Shape();
lakeOutline.moveTo(3.05,-4.9);lakeOutline.bezierCurveTo(5.7,-6,6.5,-4.5,6.4,-1.8);lakeOutline.bezierCurveTo(7.2,1.5,6.2,5.4,3.3,5.3);lakeOutline.lineTo(3.05,-4.9);
const lakeGeo=new THREE.ExtrudeGeometry(lakeOutline,{depth:.14,bevelEnabled:false,curveSegments:24});lakeGeo.rotateX(-Math.PI/2);const waterMesh=mesh(lakeGeo,water,[0,-.37,0]);waterMesh.name='pond-surface';
for(let i=0;i<24;i++) {
  const z=range(-4.5,5),x=range(4.2,6.2);
  box(rippleMaterial,[x,-.232,z],[range(.15,.6),.002,.012],undefined,false);
}

// Surface: individually colored masonry sectors, quiet engraved circle and star.
const radius=2.87, top=.23;
mesh(new THREE.CylinderGeometry(radius+.13,radius+.22,.24,80),palette.stone[2],[0,.06,.3]);
function sector(inner,outer,a,b,h=.055) {
 const sh=new THREE.Shape();sh.absarc(0,0,outer,a,b,false);sh.lineTo(Math.cos(b)*inner,Math.sin(b)*inner);sh.absarc(0,0,inner,b,a,true);sh.closePath();
 const g=new THREE.ExtrudeGeometry(sh,{depth:h,bevelEnabled:true,bevelSize:.012,bevelThickness:.008,bevelSegments:2,curveSegments:3});g.rotateX(-Math.PI/2);return g;
}
const sectorBatches=new Map();
for(let row=0;row<4;row++){
 const inner=row*.67,outer=(row+1)*.67, n=row===0?9:18+row*6;
 for(let i=0;i<n;i++){
  const g=sector(Math.max(.012,inner+.012),outer-.015,i*Math.PI*2/n+.009+row*.19,(i+1)*Math.PI*2/n-.009+row*.19);
  const m=pick(palette.stone),y=top-.055+range(-.005,.004);g.translate(0,y,.3);
  if(!sectorBatches.has(m))sectorBatches.set(m,[]);sectorBatches.get(m).push(g);
 }
}
// Batch the exact existing sectors by material. World vertices/UVs stay unchanged.
for(const [m,parts] of sectorBatches){mesh(mergeGeometries(parts,false),m).name='ritual-stone-sectors';parts.forEach(g=>g.dispose());}
for(let i=0;i<42;i++){
 const a=i/42*Math.PI*2;box(pick(palette.stone),[Math.cos(a)*2.91,.23,Math.sin(a)*2.91+.3],[.41,.18,.24],[0,-a,range(-.02,.02)]);
}
const inscription=document.createElement('canvas');inscription.width=1024;inscription.height=1024;
const ctx=inscription.getContext('2d');const center=512,rr=415;
ctx.strokeStyle='#e0cfcc';ctx.lineWidth=6;ctx.lineCap='round';
ctx.beginPath();ctx.arc(center,center,rr,0,Math.PI*2);ctx.stroke();
ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(center,center,rr+25,0,Math.PI*2);ctx.stroke();
const vertices=Array.from({length:5},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/5;return [center+rr*Math.cos(a),center+rr*Math.sin(a)];});
ctx.lineWidth=7;ctx.beginPath();for(let i=0;i<=5;i++){const p=vertices[(i*2)%5];i?ctx.lineTo(...p):ctx.moveTo(...p);}ctx.stroke();
// Pequenos sinais geométricos discretos, sem escrita inventada ou emissivo.
ctx.lineWidth=2;
for(let i=0;i<30;i++){const a=i*Math.PI*2/30;ctx.save();ctx.translate(center+465*Math.cos(a),center+465*Math.sin(a));ctx.rotate(a);ctx.beginPath();ctx.moveTo(-5,-6);ctx.lineTo(5,6);ctx.moveTo(0,-8);ctx.lineTo(0,8);if(i%3===0){ctx.moveTo(-5,6);ctx.lineTo(5,-6);}ctx.stroke();ctx.restore();}
const symbolTexture=new THREE.CanvasTexture(inscription);symbolTexture.colorSpace=THREE.SRGBColorSpace;symbolTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
const engraving=mesh(new THREE.PlaneGeometry(5.1,5.1),new THREE.MeshStandardMaterial({map:symbolTexture,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1}),[0,.245,.3]);engraving.rotation.x=-Math.PI/2;engraving.castShadow=false;

// Replace only the visual child; the approved roots and ritual anchors stay fixed.
const createSkullVisual=await loadSkullModel();
function skull(x,z,angle) {
  const group=new THREE.Group();group.position.set(x,.25,z);group.rotation.y=angle;
  const {visual,eyes,boneMaterials}=createSkullVisual();
  group.add(visual);group.userData.ritualEyes=eyes;group.userData.ritualBoneMaterials=boneMaterials;
  scene.add(group);group.name='caveira';return group;
}
for(let i=0;i<5;i++){
 const a=-Math.PI/2+i*Math.PI*2/5;
 const x=2.13*Math.cos(a),z=.3+2.13*Math.sin(a);
 // Cinco posições radiais; rostos dirigidos à câmera para manter leitura.
 skull(x,z,.40+.18*Math.sin(a));
}

// Substituição exclusiva da personagem do Bloco 1.
const witch=createWitch({hint:document.querySelector('#meditate-hint')});
scene.add(witch.root);

function rock(x,z,size=.35,y=.08){part(geo.rock,pick(palette.stone),[x,y,z],[size,range(.5,.9)*size,size*range(.7,1.1)],[range(0,1),range(0,3),range(0,1)]);}
const familiarPavers=[];
function paving(x,z,w=.75){
 const m=pick(palette.stone),depth=range(.45,.7),yaw=range(-.1,.1);box(m,[x,.06,z],[w,.12,depth],[0,yaw,0]);
 familiarPavers.push({x,z,width:w,depth,yaw});
}
// Path from cabin to circle, plus front stairs.
for(let j=0;j<5;j++)for(let i=0;i<3;i++)paving(-4.7+i*.61+j*.22,-1.1+j*.60,.59);
for(let j=0;j<3;j++){box(pick(palette.stone),[-1.1,-.15-j*.20,5.07+j*.29],[2.0,.22,.48]);}
for(let i=0;i<9;i++)paving(-1.4+(i%3)*.62,3.47+Math.floor(i/3)*.55,.60);

function wall(x,z,length,axis='x',height=.65){
 const n=Math.round(length/.56);
 for(let row=0;row<Math.ceil(height/.25);row++)for(let i=0;i<n;i++){
 const offset=(i-(n-1)/2)*.56+(row%2)*.07;
 box(pick(palette.wall),[x+(axis==='x'?offset:0),.14+row*.25,z+(axis==='z'?offset:0)],axis==='x'?[.535,.23,.40]:[.40,.23,.535],[range(-.025,.025),range(-.02,.02),range(-.02,.02)]);
 }
}
wall(-4.1,4.4,2.2,'x',.85);wall(1.65,4.9,3.25,'x',.50);wall(-5.65,2.9,2.6,'z',.65);
wall(3.85,2.3,3.3,'z',.58);wall(3.9,-2.45,2.1,'z',.7);

// Cabana discreta: madeira, alvenaria, telhas e uma janela quente.
wall(-4.45,-3.65,3.15,'x',2.25);
box(palette.darkWood,[-4.45,1.1,-3.82],[3.32,2.3,.32]);
for(let i=0;i<9;i++)box(pick(palette.wall),[-5.89+i*.36,1.12,-3.58],[.34,2.18,.12]);
for(const x of [-6.05,-4.44,-2.84])box(palette.wood,[x,1.34,-3.43],[.15,2.68,.16]);
box(palette.wood,[-4.45,2.47,-3.43],[3.45,.19,.2]);
// Portinha com tábuas e moldura, apoiada atrás dos degraus.
box(palette.darkWood,[-4.77,.94,-3.46],[.93,1.88,.10]);
for(let i=0;i<6;i++)box(palette.wood,[-5.16+i*.155,.94,-3.38],[.142,1.85,.09]);
for(const x of [-5.28,-4.26])box(palette.woodLight,[x,1,-3.29],[.13,2.04,.15]);
box(palette.woodLight,[-4.77,2,-3.29],[1.12,.15,.16]);
beam([-5.12,.40,-3.28],[-4.43,1.55,-3.28],.08,palette.darkWood);
sphere(palette.brass,[-4.44,.95,-3.24],[.046,.046,.04]);
for(let j=0;j<3;j++)box(pick(palette.stone),[-4.77,.065+j*.10,-2.55-j*.23],[1.45,.14,.44]);
box(palette.wood,[-3.45,1.48,-3.31],[.90,1.05,.12]);
box(new THREE.MeshBasicMaterial({color:'#ffad48',toneMapped:false}),[-3.45,1.48,-3.24],[.69,.80,.025],undefined,false);
box(palette.wood,[-3.45,1.48,-3.20],[.07,.89,.07]);box(palette.wood,[-3.45,1.48,-3.20],[.75,.07,.07]);
const windowLight=new THREE.PointLight('#ffac55',10,3.5,2);windowLight.position.set(-3.45,1.4,-2.9);scene.add(windowLight);
// Roof pitch running away from viewer, rows of individually staggered slate tiles.
for(let row=0;row<6;row++)for(let col=0;col<12;col++){
 const z=-3.15-row*.34,y=2.55+row*.16;
 box(pick(palette.roof),[-6.28+col*.32+(row%2)*.04,y,z],[.308,.075,.48],[.44,0,0]);
}
beam([-6.35,2.53,-2.94],[-2.5,2.53,-2.94],.14,palette.darkWood);

// Close the missing visible side under the existing sloped roof. Deterministic
// additions do not consume either layout RNG or change any existing placement.
const cabinFront=-3.65,cabinRear=-5.02,cabinTop=z=>2.55+(-3.15-z)*(.16/.34)-.06;
const cabinSideShape=new THREE.Shape();cabinSideShape.moveTo(cabinFront,0);cabinSideShape.lineTo(cabinRear,0);cabinSideShape.lineTo(cabinRear,cabinTop(cabinRear));cabinSideShape.lineTo(cabinFront,cabinTop(cabinFront));cabinSideShape.closePath();
const cabinSideGeo=new THREE.ExtrudeGeometry(cabinSideShape,{depth:.20,bevelEnabled:false});cabinSideGeo.rotateY(-Math.PI/2);
const cabinSide=mesh(cabinSideGeo,palette.wall[2],[-2.81,0,0]);cabinSide.name='cabin-side-wall';
for(let row=0;row<14;row++)for(let col=0;col<3;col++){
 const z=cabinFront-.225-col*.455,bottom=.025+row*.25,top=Math.min(bottom+.23,cabinTop(z+.215)-.025),height=top-bottom;
 if(height>.035)box(palette.wall[(row+col*2)%palette.wall.length],[-2.77,bottom+height*.5,z],[.085,height,.425]);
}
beam([-2.75,.06,cabinRear],[-2.75,cabinTop(cabinRear),cabinRear],.12,palette.wood);
beam([-2.75,cabinTop(cabinFront),cabinFront],[-2.75,cabinTop(cabinRear),cabinRear],.13,palette.darkWood);

// Old rear arch assembled with separate voussoirs.
for(const x of [-.93,.93]){
 for(let row=0;row<7;row++)for(let i=0;i<2;i++)box(pick(palette.wall),[x+(i-.5)*.22,.16+row*.27,-4.7],[.215,.25,.55],[0,range(-.035,.035),0]);
}
for(let i=0;i<11;i++){
 const a=(i+.5)*Math.PI/11;
 box(pick(palette.wall),[Math.cos(a)*.94,1.83+Math.sin(a)*.94,-4.7],[.30,.41,.56],[0,0,a-Math.PI/2]);
}
wall(-1.67,-4.7,.95,'x',1.2);wall(1.64,-4.7,.98,'x',1.15);
const gardenPortal=createPortalSurface('garden-portal-recess');scene.add(gardenPortal.mesh);
// Pergola behind: taller rear silhouette and hanging flowers.
for(const x of [-2.55,1.95])box(palette.wood,[x,1.71,-5.35],[.15,3.42,.15]);
box(palette.wood,[-.3,3.35,-5.35],[4.8,.18,.21]);
for(let i=0;i<8;i++)box(palette.darkWood,[-2.5+i*.63,3.42,-5.15],[.12,.12,.65]);

// Wooden bridge in the rear right, no controls or interactions.
for(let i=0;i<12;i++)box(i%3?palette.wood:palette.woodLight,[4.35,.18,-2.20+i*.17],[2.25,.12,.153],[0,0,range(-.012,.012)]);
for(const x of [3.4,5.32]){
 for(const z of [-2.35,-.37])box(palette.wood,[x,.66,z],[.14,1.07,.14]);
 beam([x,.93,-2.35],[x,.93,-.37],.10);beam([x,.53,-2.35],[x,.53,-.37],.075);
}

const lanternResponders=[];
function lantern(x,y,z,power=12){
 box(palette.iron,[x,y-.26,z],[.34,.09,.34]);box(palette.iron,[x,y+.23,z],[.37,.07,.37]);
 part(geo.cone,palette.iron,[x,y+.35,z],[.29,.21,.29],[0,Math.PI/4,0]);
 for(const dx of [-.14,.14])for(const dz of [-.14,.14])box(palette.brass,[x+dx,y,z+dz],[.035,.46,.035]);
 const core=new THREE.MeshBasicMaterial({color:'#ffab32',toneMapped:false});sphere(core,[x,y,z],[.065,.17,.065],undefined,false);
 const glass=new THREE.MeshBasicMaterial({color:'#ff9f32',transparent:true,opacity:.24,depthWrite:false,toneMapped:false});
 box(glass,[x,y,z],[.28,.43,.28],undefined,false);
 const light=new THREE.PointLight('#ff912c',power*1.5,4.5,2);light.position.set(x,y,z);scene.add(light);
 lanternResponders.push({light,core,glass,baseIntensity:light.intensity,baseColor:core.color.clone(),baseOpacity:glass.opacity});
}
// Six local lamps: each really lights the adjacent ground and plants.
box(palette.wood,[-5.25,1,2.6],[.19,2,.19]);lantern(-5.25,1.92,2.6,16);
box(palette.wood,[2.92,.7,3.75],[.20,1.4,.20]);lantern(2.92,1.4,3.75,16);
box(palette.wood,[-2.55,.66,4.55],[.22,1.32,.22]);lantern(-2.55,1.33,4.55,13);
lantern(.98,1.78,-4.22,18);lantern(-5.85,2.08,-3.06,12);lantern(5.29,1.09,-.42,13);
function candle(x,z,y=.29){
 const h=range(.16,.31);part(geo.cylinder,palette.wax,[x,y+h/2,z],[.047,h,.047]);
 part(geo.cone,palette.warm,[x,y+h+.041,z],[.023,.085,.023],undefined,false);
}
for(const [x,z] of [[-2.50,.02],[1.86,1.88],[-1.38,2.57]]){
 for(let i=0;i<3;i++)candle(x+range(-.16,.16),z+range(-.14,.14));
 const light=new THREE.PointLight('#ffb35c',2.3,1.6,2);light.position.set(x,.65,z);scene.add(light);
}

// Vegetation: deliberately planted banks, clear central disc and walking paths.
function bush(x,z,s=.55,y=.10){
 const m=pick(palette.leaf),foliage=foliageShapes[Math.abs(Math.round(x*13+z*7))%3];
 for(let i=0;i<42;i++){
  const a=i*2.4;const d=range(.05,.38)*s;
  part(foliage,m,[x+Math.cos(a)*d,y+range(.16,.5)*s,z+Math.sin(a)*d],[range(.15,.29)*s,range(.23,.38)*s,range(.29,.49)*s],[range(-.42,.20),Math.PI*.5-a+range(-.32,.32),range(-.30,.30)]);
 }
}
function fern(x,z,size=.5){
 for(let i=0;i<6;i++){
 const a=i*Math.PI/3,d=.32*size;
 for(let j=1;j<5;j++){
  const t=j/4;
  part(geo.leaf,pick(palette.leaf),[x+Math.cos(a)*d*t,.10+Math.sin(t*Math.PI)*size*.33,z+Math.sin(a)*d*t],[.075*size,.025*size,.15*size],[0,-a,range(-.4,.4)]);
 }
 }
}
function flower(x,z,h=.6,y=.08,color=pick(palette.petals)){
 beam([x,y,z],[x,y+h,z],.014,palette.leaf[1]);
 for(let i=0;i<2;i++)part(geo.leaf,palette.leaf[2],[x+(i?-.045:.045),y+h*(.25+i*.22),z],[.075,.018,.025],[0,0,i?-.45:.45]);
 for(let k=0;k<6;k++){
 const a=k*Math.PI/3;
 part(geo.leaf,color,[x+Math.cos(a)*.083,y+h+Math.sin(a)*.064,z],[.061,.042,.024],[0,0,a],false);
 }
 sphere(palette.brass,[x,y+h,z+.015],[.025,.025,.025],undefined,false);
}
function spike(x,z,h=.75,y=.08){
 beam([x,y,z],[x,y+h,z],.014,palette.leaf[2]);
 for(let j=0;j<7;j++){
 const hh=.24+j*.067, a=j*2.4;
 part(geo.leaf,palette.petals[2],[x+Math.cos(a)*.045,y+hh*h,z+Math.sin(a)*.045],[.048,.055,.036],[0,a,.25],false);
 }
}
const beds=[[-5.75,1.1,.6],[-4.8,3.4,.8],[-3.2,3.8,.6],[-3.3,1.7,.6],[-2.65,-2.6,.65],[-1.9,-3.6,.7],[.1,-3.2,.65],[1.8,-3.6,.7],[2.9,-2.7,.6],[3.25,.5,.7],[3.4,2.4,.6],[1.1,4.4,.6],[-.05,4.8,.5],[-5.3,-2,.5],[-5.8,4,.6]];
for(const [x,z,s] of beds){
 bush(x,z,s*1.65);fern(x+.33,z+.25,s*1.6);
 for(let i=0;i<8;i++){
 const xx=x+range(-.46,.46),zz=z+range(-.4,.4);
 if(i%3===0)flower(xx,zz,range(.45,.85));else spike(xx,zz,range(.55,.9));
 }
}
// Replace only the old grass cone surface; its approved instance transforms stay fixed.
const scatteredGrassGeo=grassGeometry();scatteredGrassGeo.translate(0,-.5,0);scatteredGrassGeo.scale(12,1,12);
// Low moss patches, scattered grass and stones only outside the ritual boundary.
for(let i=0;i<600;i++){
 const x=range(-5.8,3.4),z=range(-4.8,4.7);
 if(Math.hypot(x,z-.3)<3.17|| (x<-3&&z<-2.35)|| (x<-3.3&&z<1.7&&z>-.9))continue;
 part(geo.leaf,palette.moss,[x,.045,z],[range(.08,.24),.035,range(.08,.20)],[0,range(0,6),0],false);
 if(i%3===0)rock(x,z,range(.055,.14),.06);
 if(i%2===0)part(scatteredGrassGeo,foliageMaterials.get(pick(palette.leaf)),[x,.13,z],[.036,.25,.04],[range(-.25,.25),range(0,6),range(-.25,.25)],false);
}
// Ivy climbing rear arch and cabin, hanging pale muted wisteria.
for(let i=0;i<70;i++){
 const a=range(0,Math.PI);const x=.94*Math.cos(a)+range(-.17,.17),y=1.83+Math.sin(a)*.94+range(-.17,.17);
 part(geo.leaf,pick(palette.leaf),[x,y,-4.34],[.12,.055,.075],[0,0,range(-2,2)]);
}
for(let i=0;i<60;i++){
 const x=range(-2.6,2),y=range(3.2,3.6);
 part(geo.leaf,pick(palette.leaf),[x,y,-5.18],[.14,.055,.1],[range(0,2),range(0,2),range(0,2)]);
}
for(const x of [-2.35,-1.76,-.38,.5,1.76])for(let j=0;j<9;j++){
 part(geo.leaf,palette.petals[2],[x+Math.sin(j*1.8)*.045,3.27-j*.084,-5.03],[.06-j*.003,.065,.05],undefined,false);
}
for(let i=0;i<35;i++)part(geo.leaf,pick(palette.leaf),[-5.95+range(-.18,.18),range(.5,2.6),-3.23],[.13,.06,.085],[0,0,range(0,6)]);
// Pond bank masonry, floating lilies: static water, no reflection pass.
for(let i=0;i<26;i++){
 const z=-4.3+i*.37,x=3.7+.28*Math.sin(z*1.4);
 rock(x,z,range(.20,.36),-.08);
}
for(let i=0;i<13;i++){
 const x=range(4.6,6),z=range(.25,4.4),a=range(0,6);
 part(geo.cylinder,palette.leaf[1],[x,-.22,z],[range(.13,.27),.015,range(.13,.23)],[0,a,0],false);
 if(i%4===0){for(let j=0;j<7;j++){const b=j*Math.PI*2/7;part(geo.leaf,palette.petals[1],[x+Math.cos(b)*.09,-.12,z+Math.sin(b)*.09],[.057,.10,.04],[Math.cos(b)*.7,b,Math.sin(b)*.7],false);}}
}
// Background trees are restrained silhouettes; no random object pile.
for(const [x,z,h] of [[-5.9,-5,3.6],[2.8,-5.4,4.2],[4.4,-5.1,3.3]]){
 part(geo.cylinder,palette.darkWood,[x,h*.37,z],[.09,h*.74,.12]);
 for(let j=0;j<5;j++){
  const a=j*2.4;
  beam([x,h*.42,z],[x+Math.cos(a)*.65,h*.82,z+Math.sin(a)*.5],.065,palette.darkWood);
 }
 for(let j=0;j<27;j++){
  const a=j*2.4,d=range(.2,.85),yy=h*.75+range(-.3,.6);
  part(geo.rock,pick(palette.leaf),[x+Math.cos(a)*d,yy,z+Math.sin(a)*d],[range(.22,.45),range(.16,.29),range(.26,.45)],[0,a,.15]);
 }
}
// Deliberate foreground plants frame the entry without covering the disc.
bush(-4.2,4.5,1.35);bush(2.9,4.8,.95);fern(-3.65,4.9,1.8);

// Uneven planted banks connect the separate beds, rather than isolated bushes.
for(let i=0;i<36;i++){
 const a=i/36*Math.PI*2;
 const x=Math.cos(a)*3.40,z=.3+Math.sin(a)*3.35;
 if((x<-2.6 && z<1.3 && z>-.8) || (Math.abs(x+1)<1&&z>3.2))continue;
 bush(x,z,range(.55,.88));fern(x+.15,z+.22,range(1,1.4));
 if(i%3===0)flower(x,z,range(.6,.92));
}
// Soil variation stays a material effect: approved land/collision heights are unchanged.
const groundCanvas=document.createElement('canvas');groundCanvas.width=groundCanvas.height=512;
const gc=groundCanvas.getContext('2d'),pixels=gc.createImageData(512,512);
const grids=[5,15,65].map(n=>({n,values:Array.from({length:n*n},detailRandom)}));
function field(grid,x,y){
 const fx=x/512*grid.n,fy=y/512*grid.n,ix=Math.floor(fx),iy=Math.floor(fy),smooth=t=>t*t*(3-2*t),u=smooth(fx-ix),v=smooth(fy-iy);
 const get=(xx,yy)=>grid.values[(yy%grid.n)*grid.n+(xx%grid.n)];
 return THREE.MathUtils.lerp(THREE.MathUtils.lerp(get(ix,iy),get(ix+1,iy),u),THREE.MathUtils.lerp(get(ix,iy+1),get(ix+1,iy+1),u),v);
}
for(let y=0;y<512;y++)for(let x=0;x<512;x++){
 const broad=field(grids[0],x,y),grain=field(grids[2],x,y),n=.60*broad+.26*field(grids[1],x,y)+.14*grain,j=(y*512+x)*4;
 const tone=THREE.MathUtils.clamp((n-.5)*1.65+.5,0,1);
 pixels.data[j]=115+tone*95;pixels.data[j+1]=121+tone*83;pixels.data[j+2]=103+tone*74;pixels.data[j+3]=255;
}
gc.putImageData(pixels,0,0);
const groundTex=canvasTexture(groundCanvas,.38);palette.earth.color.set('#4b5149');
palette.earth.map=groundTex;palette.earth.bumpMap=groundTex;palette.earth.bumpScale=.065;palette.earth.roughness=.99;

// A few directed clusters of three curved blades, in one instanced draw, without shadow casting.
function grassGeometry(){
 const p=[],indices=[],colors=[];
 for(let blade=0;blade<3;blade++){
  const a=blade*2.39996,bend=.08+blade*.017,h=.82+blade*.09,start=p.length/3;
  for(let row=0;row<=2;row++){
   const t=row*.5,w=(1-t)*.038;
   for(const side of [-1,1]){
    const x=side*w,z=t*t*bend;p.push(Math.cos(a)*x-Math.sin(a)*z,t*h,Math.sin(a)*x+Math.cos(a)*z);
    const c=.43+t*.64;colors.push(c,c,c*.93);
   }
  }
  for(let row=0;row<2;row++){const v=start+row*2;indices.push(v,v+1,v+2,v+1,v+3,v+2);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function onIsland(x,z){
 let inside=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){
  const [a,b]=outline[i],[c,d]=outline[j];if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)inside=!inside;
 }return inside;
}
const grassGeo=grassGeometry(),grassMaterial=material('#647a60',{vertexColors:true,side:THREE.DoubleSide,roughness:1});
const grassMatrices=[];
const grassAnchors=[...beds.map(([x,z])=>[x,z]),...Array.from({length:28},(_,i)=>[Math.cos(i/28*Math.PI*2)*3.5,.3+Math.sin(i/28*Math.PI*2)*3.5])];
for(const [cx,cz] of grassAnchors)for(let i=0;i<11;i++){
 const a=detailRange(0,Math.PI*2),r=detailRange(.38,.82),x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
 if(!onIsland(x,z)||Math.hypot(x,z-.3)<3.22||(x<-2.5&&z<-2.7)||(x<-3&&z>-1.6&&z<1.7)||(x>-2.15&&x<.15&&z>3.2)||(x>3.15&&z>-2.6&&z<-.2))continue;
 transform.position.set(x,.018,z);transform.rotation.set(0,detailRange(0,Math.PI*2),detailRange(-.13,.13));
 transform.scale.set(detailRange(.7,1.1),detailRange(.14,.26),detailRange(.7,1.1));transform.updateMatrix();grassMatrices.push(transform.matrix.clone());
}
const grass=new THREE.InstancedMesh(grassGeo,grassMaterial,grassMatrices.length);grass.name='ground-grass';
grass.userData.environmentKind='grass';grassMatrices.forEach((m,i)=>grass.setMatrixAt(i,m));grass.receiveShadow=true;grass.computeBoundingSphere();scene.add(grass);

for(const {g,m,shadow,matrices} of batches.values()){
 const inst=new THREE.InstancedMesh(g,m,matrices.length);
 if(g===scatteredGrassGeo)inst.userData.environmentKind='grass';
 else if(foliageShapes.includes(g)||g===petalGeo)inst.userData.environmentKind='leaf';
 else if(g===geo.rock&&palette.leaf.includes(m))inst.userData.environmentKind='crown';
 else if(g===geo.box&&palette.leaf.includes(m))inst.userData.environmentKind='stem';
 matrices.forEach((matrix,i)=>inst.setMatrixAt(i,matrix));
 inst.castShadow=shadow;inst.receiveShadow=true;inst.computeBoundingSphere();scene.add(inst);
}
const ritual=createRitual({scene,character:witch,skulls:scene.children.filter(o=>o.name==='caveira'),hint:document.querySelector('#meditate-hint')});
const environment=createLivingGarden({scene,waterMesh,waterMaterial:water,rippleMaterial,lanterns:lanternResponders});
const familiar=createFamiliar({scene,pavers:familiarPavers});
let ritualStatus={state:'inactive'},veil;
const scrying=createScryingPond({scene,renderer,witch,waterMesh,waterMaterial:water,isRitualInactive:()=>ritualStatus.state==='inactive'&&!veil?.active()});
witch.setInteraction(scrying);
veil=createVeil({scene,camera,renderer,witch,familiar,skulls:scene.children.filter(o=>o.name==='caveira'),portal:gardenPortal,environment,lanterns:lanternResponders,canEnter:()=>ritualStatus.state==='inactive'&&!scrying.active()});
witch.setAstralController(veil);
const pipeline=createRenderPipeline({renderer,scene,camera,beforeRender:()=>scrying.renderVision()});
// Fixed orthographic composition; only the frustum adapts to viewport dimensions.
function render(){
 const width=innerWidth,height=innerHeight,aspect=width/height;
 const halfHeight=Math.max(6.65,9.25/aspect);
 camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;
 camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
 sky.width=width;sky.height=height;
 const bg=sk.createLinearGradient(0,0,0,height);bg.addColorStop(0,'#10162f');bg.addColorStop(.6,'#16213a');bg.addColorStop(1,'#080f1d');
 sk.fillStyle=bg;sk.fillRect(0,0,width,height);
 const moonSize=Math.min(width,height)*.025;
 sk.fillStyle='#b5b4dc';sk.beginPath();sk.arc(width*.84,height*.13,moonSize,0,Math.PI*2);sk.fill();
 sk.fillStyle='#121a32';sk.beginPath();sk.arc(width*.84+moonSize*.45,height*.13-moonSize*.35,moonSize*.98,0,Math.PI*2);sk.fill();
 const previousSky=skyTex;skyTex=new THREE.CanvasTexture(sky);skyTex.colorSpace=THREE.SRGBColorSpace;scene.background=skyTex;previousSky.dispose();
 pipeline.setSize(width,height);pipeline.render();
 document.querySelector('#status').hidden=true;
 // Read-only diagnostics in DOM permit QA without shipping any debug controls.
 renderer.domElement.dataset.ready='true';
 renderer.domElement.dataset.three=THREE.REVISION;
 renderer.domElement.dataset.drawCalls=renderer.info.render.calls;
 renderer.domElement.dataset.triangles=renderer.info.render.triangles;
 renderer.domElement.dataset.skulls=scene.children.filter(o=>o.name==='caveira').length;
}
let resizeFrame;
addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(render);});
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();document.querySelector('#status').hidden=false;document.querySelector('#status').textContent='O contexto gráfico foi interrompido. Recarregue a página.';});
render();

// Tempo real; a configuração da câmera, fundo e viewport permanece no resize.
let previousTime=null;
function animate(now){
 let remaining=previousTime===null?0:Math.max(0,(now-previousTime)/1000);previousTime=now;
 let snapshot,ritualSnapshot;
 // Subpassos preservam o tempo real e o apoio dos pés mesmo em frames lentos.
 do {const dt=Math.min(remaining,1/30);veil.prepare(dt);gardenPortal.update(dt);const pond=scrying.update(dt);snapshot=witch.update(dt);ritualSnapshot=ritual.update(dt,snapshot);ritualStatus=ritualSnapshot;environment.update(dt,snapshot,ritualSnapshot,pond);familiar.update(dt,snapshot,ritualSnapshot,{...pond,veilTarget:veil.observation()});veil.present(dt);remaining-=dt;} while(remaining>1e-7);
 pipeline.render();
 const pond=scrying.snapshot();Object.assign(renderer.domElement.dataset,{scryState:pond.state,scryAmount:pond.amount.toFixed(4),scryReveal:pond.reveal.toFixed(4),scryTargets:pond.targetCount});
 const spirit=veil.snapshot();Object.assign(renderer.domElement.dataset,{veilState:spirit.state,veilAmount:spirit.amount.toFixed(4),projectionX:spirit.x.toFixed(4),projectionZ:spirit.z.toFixed(4),lifeline:spirit.distance.toFixed(4)});
 const cat=familiar.snapshot();Object.assign(renderer.domElement.dataset,{catState:cat.state,catX:cat.x.toFixed(4),catZ:cat.z.toFixed(4),ambientParticles:14});
 Object.assign(renderer.domElement.dataset,{characterState:snapshot.state,characterX:snapshot.x.toFixed(4),characterZ:snapshot.z.toFixed(4),characterSpeed:snapshot.speed.toFixed(4),meditation:snapshot.meditation.toFixed(4),phase:snapshot.phase.toFixed(4)});
 Object.assign(renderer.domElement.dataset,{ritualState:ritualSnapshot.state,ritualTime:ritualSnapshot.elapsed.toFixed(4),levitation:ritualSnapshot.height.toFixed(4),activeSkulls:ritualSnapshot.litSkulls,ritualLines:ritualSnapshot.lines.toFixed(4),ritualCircle:ritualSnapshot.circle.toFixed(4)});
}
document.addEventListener('visibilitychange',()=>{previousTime=null;renderer.setAnimationLoop(document.hidden?null:animate);});
renderer.setAnimationLoop(animate);
