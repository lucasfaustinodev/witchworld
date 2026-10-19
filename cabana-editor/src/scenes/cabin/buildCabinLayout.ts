import * as THREE from 'three'
import { createHewnStone, createJoineryBlock } from './cabinGeometry.ts'
import { createBannerCrescent, createBedQuilt, createBedTurnover } from './cabinTextiles.ts'
import { createRugBacking, createRugSurface, createRugTassel, rugClothHeight, rugRadius } from './cabinRugGeometry.ts'
import type { CabinObjectDefinition } from '../../editor/layoutModel.ts'

export type Vec3 = [number,number,number]
export type CabinCategory = 'architecture' | 'furniture'
export interface CabinBatch {key:string;category:CabinCategory;g:THREE.BufferGeometry;m:THREE.MeshStandardMaterial;shadow:boolean;matrices:THREE.Matrix4[];ownerIds:(string|null)[];uvMode?:'authored';paintIndices?:number[]}
export interface CabinObstacle {kind:'box';name:string;position:Vec3;size:Vec3}
export interface LampPlacement {position:Vec3;level:number;phase:number}

/** v44 geometry port. Shared buffers and matrices, no Scene/renderer/input/physics. */
export function buildCabinLayout(){
 const materials:Record<string,THREE.MeshStandardMaterial>={},batches=new Map<string,CabinBatch>(),geometries=new Map<string,THREE.BufferGeometry>(),obstacles:CabinObstacle[]=[],lamps:LampPlacement[]=[];
 let category:CabinCategory='architecture';
 let ownerId:string|null=null,fixedFixture=false;
 const objects:CabinObjectDefinition[]=[],origins=new Map<string,Vec3>(),counters=new Map<string,number>();
 function object(id:string,name:string,pivot:Vec3,parentId:string|null=null){
  if(!origins.has(id)){
   const parent=parentId?origins.get(parentId)!:[0,0,0];
   objects.push({id,name,parentId,position:[pivot[0]-parent[0],pivot[1]-parent[1],pivot[2]-parent[2]],rotationY:0});origins.set(id,[...pivot]);
  }
  ownerId=id;category='furniture';
 }
 function prop(kind:string,name:string,pivot:Vec3,draw:()=>void){
  if(fixedFixture){draw();return;}
  const previous=ownerId,previousCategory=category,prefix=previous??'decor',key=`${prefix}/${kind}`,index=(counters.get(key)??0)+1;
  counters.set(key,index);object(`${key}-${String(index).padStart(3,'0')}`,`${name} ${index}`,pivot,previous);
  try{draw();}finally{ownerId=previous;category=previousCategory;}
 }
 function architecture(draw:()=>void){
  const previous=ownerId,previousCategory=category,previousFixed=fixedFixture;
  ownerId=null;category='architecture';fixedFixture=true;
  try{draw();}finally{ownerId=previous;category=previousCategory;fixedFixture=previousFixed;}
 }
 const mat=(name:string,color:THREE.ColorRepresentation,options:THREE.MeshStandardMaterialParameters={})=>materials[name]=new THREE.MeshStandardMaterial({name,color,roughness:.86,...options});
 mat('wood','#543829',{roughness:.72});mat('plank','#654733',{roughness:.70});mat('plankLight','#70503a',{roughness:.73});mat('beam','#2c2228');
 mat('wall','#604332',{roughness:.82});mat('stone','#474249');mat('stoneLight','#655960');mat('metal','#332e3c',{metalness:.50,roughness:.57});
 mat('brass','#a18450',{metalness:.42,roughness:.59});mat('cloth','#493149');mat('clothLight','#886479');
 mat('bedCloth','#493149');mat('bedLinen','#886479');mat('bannerMoon','#c5a079',{roughness:.98});
 mat('rug','#302539');mat('roundRug','#302539');mat('trim','#958087');mat('paper','#bfb098');mat('book','#49354f');
 mat('rugEdge','#2a183c',{roughness:1});mat('rugFringe','#342045',{roughness:1});mat('rugFringeLight','#3b254e',{roughness:1});
 mat('bookRed','#7d4546');mat('bookBlue','#46566f');mat('bookGreen','#435b4b');mat('bookOchre','#8a6946');mat('ceramic','#405456');mat('leaf','#39493e');
 mat('wax','#d3bc95');mat('crystal','#9a81b6',{emissive:'#6d458e',emissiveIntensity:.10,roughness:.45});
 mat('flame','#ffe6af',{emissive:'#ffc16a',emissiveIntensity:1.3,roughness:1});
 mat('window','#637aa6',{emissive:'#43568b',emissiveIntensity:.25,roughness:.8});
 mat('soot','#211e27');mat('potion','#8154b6',{emissive:'#9463d4',emissiveIntensity:.84,metalness:.18,roughness:.32});
 mat('stitch','#a98c7c');mat('windowMoon','#bacbff',{emissive:'#9aafff',emissiveIntensity:.9});mat('soil','#261e27');
 mat('leather','#48302b');mat('leatherLight','#72513b');mat('bark','#453329');
 mat('leafLight','#687044');mat('leafDark','#283c32');mat('herbDry','#8c7352');mat('terracotta','#89533d');
 materials.bottleGlass=new THREE.MeshPhysicalMaterial({name:'bottleGlass',color:'#48687b',roughness:.22,clearcoat:.72,clearcoatRoughness:.18});
 materials.bottleGlassGreen=new THREE.MeshPhysicalMaterial({name:'bottleGlassGreen',color:'#426258',roughness:.24,clearcoat:.65,clearcoatRoughness:.20});
 const get=(key:string,make:()=>THREE.BufferGeometry):THREE.BufferGeometry=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key)!;};
 const box=get('box',()=>new THREE.BoxGeometry(1,1,1));
 const joinery=get('joinery',()=>createJoineryBlock());
 const masonry=[0,1,2].map(i=>get(`hewn-stone-${i}`,()=>createHewnStone(i)));
 const cylinder=get('cylinder',()=>new THREE.CylinderGeometry(1,1,1,10));
 const sphere=get('orb',()=>new THREE.IcosahedronGeometry(1,1));
 const cone=get('cone',()=>new THREE.ConeGeometry(1,1,8));
 const leaf=get('leaf',()=>{
  const p=[0,.5,0,-.40,.17,0,-.35,-.23,0,0,-.5,0,.35,-.23,0,.40,.17,0,0,0,.12,0,0,-.035],indices=[];
  for(let i=0;i<6;i++){const j=(i+1)%6;indices.push(6,i,j,7,j,i);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
 });
 const softBox=get('soft-box',()=>{
  const g=new THREE.BoxGeometry(1,1,1,4,2,4),p=g.attributes.position,v=new THREE.Vector3(),inner=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);inner.copy(v).clampScalar(-.40,.40);v.sub(inner).normalize().multiplyScalar(.10).add(inner);p.setXYZ(i,v.x,v.y,v.z);}
  g.computeVertexNormals();return g;
 });
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Euler(),quaternion=new THREE.Quaternion();
 function add(g:THREE.BufferGeometry,m:THREE.MeshStandardMaterial,p:Vec3,s:Vec3=[1,1,1],r:Vec3=[0,0,0],shadow=true){
  if(category==='furniture'&&!ownerId){prop('detail','Objeto decorativo',p,()=>add(g,m,p,s,r,shadow));return;}
  const key=category+g.uuid+m.uuid+shadow;
  if(!batches.has(key))batches.set(key,{key,category,g,m,shadow,matrices:[],ownerIds:[]});
  quaternion.setFromEuler(rotation.set(...r));matrix.compose(position.set(...p),quaternion,scale.set(...s));
  batches.get(key)!.matrices.push(matrix.clone());
  batches.get(key)!.ownerIds.push(category==='furniture'?ownerId:null);
 }
 function block(m:string,p:Vec3,s:Vec3,r:Vec3=[0,0,0]){
  const size=Math.min(...s),timber=['wood','plank','plankLight','beam','wall','book','bookRed','bookBlue','bookGreen','bookOchre','leather','leatherLight'].includes(m);
  const stone=m==='stone'||m==='stoneLight';
  const index=Math.abs(Math.round(p[0]*11+p[1]*23+p[2]*17))%3;
  add(stone&&size>.10?masonry[index]:timber&&size>.035?joinery:box,materials[m],p,s,r);
 }
 function round(m:string,p:Vec3,r:number,h:number){const g=m==='rug'?get('rug-disc',()=>new THREE.CylinderGeometry(1,1,1,48)):cylinder;add(g,materials[m],p,[r,h,r]);}
 function solid(name:string,p:Vec3,s:Vec3){obstacles.push({kind:'box',name,position:p,size:s});}
 function ring(m:string,x:number,y:number,z:number,r:number,thickness=.012){
  const g=get(`ring-${r}-${thickness}`,()=>new THREE.RingGeometry(r-thickness,r+thickness,64));
  add(g,materials[m],[x,y,z],[1,1,1],[-Math.PI/2,0,0],false);
 }
 function stroke(m:string,a:Vec3,b:Vec3,w=.012){
  const d=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());
  const e=new THREE.Euler().setFromQuaternion(quaternion);block(m,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[w,d.length(),w],[e.x,e.y,e.z]);
 }
 function candle(x:number,y:number,z:number,height=.23){
  return prop('candle','Vela',[x,y,z],()=>{
  round('brass',[x,y+.023,z],.105,.035);round('wax',[x,y+height/2+.04,z],.047,height);
  add(sphere,materials.flame,[x,y+height+.085,z],[.025,.061,.025],[0,0,.12],false);
  });
 }
 function bottle(x:number,y:number,z:number,index=0){
  return prop('bottle','Frasco',[x,y,z],()=>{
  const m=index%2?'bottleGlassGreen':'bottleGlass';
  const vessel=get('potion-bottle',()=>new THREE.LatheGeometry([[0,0],[.060,0],[.076,.018],[.078,.14],[.068,.19],[.034,.225],[.034,.26],[.043,.266],[.043,.278],[.026,.278],[.026,.22]].map(v=>new THREE.Vector2(v[0],v[1])),12));
  add(vessel,materials[m],[x,y,z]);
  round('wood',[x,y+.298,z],.038,.034);block('brass',[x,y+.12,z+.075],[.07,.065,.006]);
  });
 }
 function crystal(x:number,y:number,z:number,h=.28){
  return prop('crystal','Cristal',[x,y,z],()=>{
  add(cone,materials.crystal,[x,y+h*.65,z],[h*.24,h*.75,h*.24],[0,.3,.15]);
  add(cylinder,materials.crystal,[x,y+h*.28,z],[h*.23,h*.43,h*.23],[0,.3,.15]);
  });
 }
 function book(x:number,y:number,z:number,h=.28,w=.10,material='book',lean=0){
  return prop('book','Livro',[x,y,z],()=>{
  block(material,[x,y+h/2,z],[w,h,.22],[0,0,lean]);
  block('paper',[x,y+h/2,z+.045],[w*.72,h*.87,.135],[0,0,lean]);
  block(material,[x,y+h/2,z+.119],[w,h,.012],[0,0,lean]);
  block('brass',[x,y+h*.72,z+.128],[w*.78,.013,.009],[0,0,lean]);
  for(const t of [.16,.84])block('leatherLight',[x,y+h*t,z+.130],[w*.94,.018,.013],[0,0,lean]);
  block('brass',[x,y+h*.47,z+.133],[w*.46,h*.15,.005],[0,0,lean]);
  });
 }
 function plant(x:number,y:number,z:number,s=.45){
  return prop('plant','Planta',[x,y,z],()=>{
  round('terracotta',[x,y+.10*s,z],.19*s,.20*s);round('soil',[x,y+.205*s,z],.155*s,.012);
  for(let i=0;i<9;i++){const a=i*2.39996,h=(.40+(i%3)*.07)*s;
   stroke('leaf',[x,y+.16*s,z],[x+Math.sin(a)*.19*s,y+h,z+Math.cos(a)*.19*s],.014*s);
   add(leaf,materials[['leaf','leafLight','leafDark'][i%3]],[x+Math.sin(a)*.19*s,y+h,z+Math.cos(a)*.19*s],[.24*s,.36*s,.28*s],[.45, a, .45]);
  }
  });
 }
 function pile(x:number,y:number,z:number,count=3){
  return prop('book-stack','Pilha de livros',[x,y,z],()=>{
  for(let i=0;i<count;i++){
   const a=(i%3-1)*.09,m=['bookRed','book','bookBlue'][i%3];
   block(m,[x,y+.045+i*.086,z],[.32+i%2*.035,.079,.24],[0,a,0]);
   block('paper',[x,y+.045+i*.086,z+.127],[.275,.041,.013],[0,a,0]);
  }
  });
 }
 function ivy(x:number,y:number,z:number,length=.85,side=false){
  return prop('ivy','Hera',[x,y,z],()=>{
  for(let i=0;i<7;i++){
   const t=i/6,sway=Math.sin(i*1.7)*.06,px=x+(side?0:sway),pz=z+(side?sway:0),py=y-length*t;
   if(i)stroke('leaf',[x+(side?0:Math.sin((i-1)*1.7)*.06),y-length*(i-1)/6,z+(side?Math.sin((i-1)*1.7)*.06:0)],[px,py,pz],.009);
   for(const sign of [-1,1])add(leaf,materials[i%3?'leaf':'leafLight'],[px+(side?.07:sign*.075),py-.022,pz+(side?sign*.075:.07)],[.19,.24,.22],[.18,side?Math.PI/2:0,sign*.48]);
  }
  });
 }
 function lamp(id:string,name:string,x:number,y:number,z:number,level=5,phase=0,lightAt:Vec3|null=null){
  const previous=ownerId,previousCategory=category;
  object(id,name,[x,y,z]);
  try{
  round('brass',[x,y-.25,z],.17,.04);
  for(const side of [-1,1])for(const depth of [-1,1])block('metal',[x+side*.12,y,z+depth*.12],[.023,.48,.023]);
  add(cone,materials.metal,[x,y+.32,z],[.25,.20,.25]);
  candle(x,y-.25,z,.22);
  if(!level)return; // The two entrance fixtures share one local light.
  lamps.push({position:lightAt??[x,y,z],level,phase});
  }finally{ownerId=previous;category=previousCategory;}
 }
 // 10.4 × 8.4 m: the centre has a clear 3.4 m diameter circulation area.
 block('beam',[0,-.11,0],[10.4,.22,8.4]);
 for(let row=0;row<21;row++){
  const z=-4+row*.4,offset=(row%3)*.81;
  const joints=[-5.2];for(let x=-5.2+2.6-offset;x<5.19;x+=2.6)if(x>-5.19)joints.push(x);joints.push(5.2);
  for(let col=0;col<joints.length-1;col++){
   const width=joints[col+1]-joints[col],x=(joints[col+1]+joints[col])/2,m=['wood','plank','plankLight'][(row*7+col*5+Math.floor(row/3))%3];
   block(m,[x,.014,z],[width-.016,.028,.385]);
   // Recessed iron pegs follow staggered joinery rather than painting repeated grain lines.
   if(row%3===1)for(const side of [-1,1])add(cylinder,materials.metal,[x+side*(width/2-.075),.030,z+.115],[.012,.003,.012],[0,0,0],false);
  }
 }
 const top=.028;
 // One upward-facing support surface. Visual plank seams never catch the capsule.

 const wallH=2.95;
 for(let i=0;i<24;i++)block('wall',[-4.97+i*.4325,wallH/2,-4.21],[.422,wallH,.18]);
 for(let i=0;i<19;i++)block('wall',[-5.21,wallH/2,-3.99+i*.4325],[.18,wallH,.421]);
 // The camera-facing sides are intentionally cut down; collision bounds remain full.
 block('beam',[5.21,.22,0],[.20,.44,8.62]);block('beam',[0,-.05,4.23],[10.62,.28,.18]);
 for(const x of [-5.18,-2.58,0,2.60,5.18])block('beam',[x,wallH/2,-4.12],[.17,wallH+.22,.23]);
 for(const z of [-4.12,-1.35,1.45,4.12])block('beam',[-5.12,wallH/2,z],[.23,wallH+.22,.16]);
 block('beam',[0,3.03,-4.14],[10.65,.20,.29]);block('beam',[-5.14,3.03,0],[.29,.20,8.48]);
 block('wood',[0,.31,-4.03],[10.3,.13,.11]);block('wood',[-5.03,.31,0],[.11,.13,8.3]);
 for(const y of [.64,2.67]){
  block('wood',[0,y,-4.075],[10.3,.065,.07]);block('wood',[-5.075,y,0],[.07,.065,8.3]);
 }
 // Cool moonlit window above the sleeping alcove; no additional light per pane.
 object('window','Janela e cortinas',[-5.06,1.85,-1.46]);
 block('beam',[-5.06,1.85,-1.46],[.11,1.53,1.55]);block('window',[-4.991,1.86,-1.46],[.014,1.29,1.28]);
 block('wood',[-4.966,1.86,-1.46],[.10,1.40,.073]);block('wood',[-4.96,1.86,-1.46],[.10,.073,1.42]);
 block('plank',[-4.83,1.12,-1.46],[.45,.08,1.78]);
 // Draped curtain ribbons rather than perfect rectangular cloth blocks.
 function drape(key:string,width:number,height:number,amplitude=.035){
  return get(key,()=>{
   const g=new THREE.PlaneGeometry(width,height,12,10),p=g.attributes.position;
   for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),t=(height/2-y)/height;
    p.setZ(i,Math.sin(x/width*Math.PI*7)*amplitude*(.35+t*.65));p.setY(i,y-Math.cos(x/width*Math.PI*4)*t*.035);
   }g.computeVertexNormals();return g;
  });
 }
 object('curtains','Cortinas da janela',[-4.93,1.85,-1.46],'window');
 for(const z of [-2.14,-.77])add(drape('curtain',.33,1.48),materials.cloth,[-4.93,1.85,z],[1,1,1],[0,Math.PI/2,0]);
 ownerId=null;plant(-4.79,1.16,-1.08,.65);
 category='furniture';
 // Proper bed: frame, headboard, quilt, draped sides, pillows, corner posts.
 const bed={x:-3.70,z:-1.08};
 object('bed-rug','Tapete da cama',[bed.x,0,bed.z+.14]);
 block('rug',[bed.x,.031,bed.z+.14],[2.52,.006,3.45]);
 for(const side of [-1,1])block('trim',[bed.x+side*1.16,.035,bed.z+.14],[.010,.001,3.22]);
 for(const end of [-1,1])block('trim',[bed.x,.035,bed.z+.14+end*1.60],[2.32,.001,.010]);
 object('bed','Cama e tecidos',[bed.x,0,bed.z]);
 block('beam',[bed.x,.30,bed.z],[1.96,.24,2.64]);add(softBox,materials.bedLinen,[bed.x,.51,bed.z],[1.79,.19,2.47]);
 block('beam',[bed.x,.74,bed.z-1.32],[2.03,.87,.14]);
 for(let i=0;i<5;i++)block(i%2?'wood':'plank',[bed.x-.76+i*.38,.75,bed.z-1.226],[.35,.61,.024]);
 block('wood',[bed.x,.38,bed.z+1.33],[2.03,.46,.12]);
 for(const x of [-1,1])for(const z of [-1,1]){
  block('beam',[bed.x+x*.95,.38,bed.z+z*1.29],[.12,.82,.12]);add(sphere,materials.brass,[bed.x+x*.95,.82,bed.z+z*1.29],[.067,.039,.067]);
 }
 const quilt=get('quilt',createBedQuilt);
 add(quilt,materials.bedCloth,[bed.x,0,bed.z+.30]);
 const turnover=get('blanket-fold',createBedTurnover);
 add(turnover,materials.bedLinen,[bed.x,0,bed.z-.40]);
 for(const x of [-.43,.43])add(softBox,materials.bedLinen,[bed.x+x,.66,bed.z-.96],[.76,.21,.43],[.12,x*.1,x*.06]);
 add(softBox,materials.bedCloth,[bed.x-.17,.70,bed.z-.79],[.35,.12,.30],[.1,.18,0]);
 solid('bed',[bed.x,.54,bed.z],[2.04,1.08,2.78]);
 object('bedside','Criado-mudo',[-4.51,0,-2.97]);
 block('wood',[-4.51,.42,-2.97],[.62,.72,.61]);block('plank',[-4.51,.82,-2.97],[.69,.08,.69]);
 block('brass',[-4.51,.59,-2.652],[.09,.036,.022]);solid('bedside',[-4.51,.43,-2.97],[.69,.86,.69]);
 candle(-4.65,.86,-2.90,.25);candle(-4.45,.86,-2.83,.17);pile(-4.43,.86,-3.12,2);
 // Bookcase, on the back wall: varied spines, open shelf volumes and a ladder.
 const shelfX=-2.5,shelfZ=-3.66;
 object('bookshelf','Estante da biblioteca',[shelfX,0,shelfZ]);
 block('beam',[shelfX,1.28,shelfZ],[2.0,2.50,.11]);
 for(const x of [-.98,.98])block('wood',[shelfX+x,1.30,shelfZ+.18],[.09,2.60,.46]);
 for(let row=0;row<5;row++){
  const y=.18+row*.51;block('wood',[shelfX,y,shelfZ+.16],[2.06,.08,.51]);
  let cursor=shelfX-.87;
  for(let i=0;i<11;i++){
   if(row===2&&i>=7)continue; // A clear shelf bay for the original GLB skull.
   const seed=(row*19+i*13)%17;
   if(row===3&&i>7){if(i===9){crystal(shelfX+.64,y+.06,shelfZ+.19,.29);crystal(shelfX+.85,y+.06,shelfZ+.19,.20);}continue;}
   if(row===1&&i>=7){if(i===7)pile(shelfX+.58,y+.055,shelfZ+.16,3);continue;}
   const w=.080+(seed%4)*.022,h=.27+(seed%6)*.029;
   book(cursor+w/2,y+.055,shelfZ+.17,h,w,['book','bookRed','bookBlue','bookGreen','bookOchre'][seed%5],i===0?-.065:i===10?.10:0);cursor+=w+.025;
  }
 }
 plant(-3.31,2.35,-3.49,.83);candle(-2.0,2.27,-3.48,.21);
 ivy(-3.43,2.37,-3.34,.95);ivy(-1.57,2.61,-3.40,1.09);
 solid('bookshelf',[shelfX,1.30,shelfZ+.12],[2.12,2.60,.62]);
 object('library-ladder','Escada da biblioteca',[-2.69,0,-3.10]);
 for(const x of [-.31,.31])block('plank',[-2.69+x,.62,-3.10],[.055,1.30,.055],[.10,0,0]);
 for(let i=0;i<4;i++)block('wood',[-2.69,.22+i*.26,-3.04-i*.026],[.68,.044,.05]);
 // Study desk: large enough to read as a usable place, with an open grimoire.
 const desk={x:.70,z:-3.05};
 object('study-desk','Escrivaninha',[desk.x,0,desk.z]);
 add(softBox,materials.plank,[desk.x,.94,desk.z],[2.70,.14,.90]);
 for(const x of [-1.15,1.15])for(const z of [-.33,.33])block('wood',[desk.x+x,.45,desk.z+z],[.10,.88,.10]);
 for(const x of [-1.0,1.0]){block('wood',[desk.x+x,.55,desk.z],[.41,.61,.71]);block('beam',[desk.x+x,.59,desk.z+.361],[.33,.25,.023]);block('brass',[desk.x+x,.59,desk.z+.378],[.060,.026,.013]);}
 for(const x of [-1.0,1.0]){
  for(const side of [-1,1])block('plank',[desk.x+x+side*.174,.56,desk.z+.377],[.035,.55,.025]);
  for(const y of [.31,.54,.81])block('plank',[desk.x+x,y,desk.z+.379],[.36,.025,.029]);
  block('wood',[desk.x+x,.405,desk.z+.374],[.29,.20,.018]);
  block('brass',[desk.x+x,.41,desk.z+.395],[.048,.024,.018]);
 }
 block('leather',[desk.x,1.018,desk.z],[1.26,.016,.77]);
 object('grimoire','Grimório aberto',[desk.x,1.018,desk.z+.055],'study-desk');
 for(const side of [-1,1]){
  block('book',[desk.x+side*.235,1.065,desk.z+.055],[.46,.062,.46],[0,0,side*-.085]);
  block('paper',[desk.x+side*.23,1.11,desk.z+.055],[.43,.02,.43],[0,0,side*-.085]);
 }
 const pageHeight=(x:number,z:number)=>.015+.022*Math.cos(x*6)+.012*Math.sin(z*5);
 const parchment=get('grimoire-page',()=>{
  const g=new THREE.PlaneGeometry(.435,.43,10,6),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,pageHeight(x,z),z);}
  const ix=g.index!;for(let i=0;i<ix.count;i+=3){const a=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,a);}g.computeVertexNormals();return g;
 });
 for(const side of [-1,1]){
  add(parchment,materials.paper,[desk.x+side*.23,1.113,desk.z+.055],[1,1,1],[0,0,side*-.085]);
  for(let row=0;row<5;row++){
   const z=-.13+row*.058,width=.26-row%2*.045,angle=side*-.085;
   const inkPoint=(x:number):Vec3=>{const y=pageHeight(x,z)+.002;return [desk.x+side*.23+Math.cos(angle)*x-Math.sin(angle)*y,1.113+Math.sin(angle)*x+Math.cos(angle)*y,desk.z+.055+z];};
   for(let segment=0;segment<4;segment++)stroke('book',inkPoint(-width/2+segment*width/4),inkPoint(-width/2+(segment+1)*width/4),.005);
  }
 }
 round('brass',[desk.x,1.133,desk.z+.08],.065,.011);
 object('study-desk','Escrivaninha',[desk.x,0,desk.z]);
 for(let i=0;i<2;i++)bottle(desk.x-1.03+i*.18,1.013,-3.26,i);
 pile(desk.x-1.02,1.013,-2.89,2);crystal(desk.x+.99,1.013,-3.11,.23);candle(desk.x+.79,1.013,-3.27,.25);candle(desk.x+1.12,1.013,-2.94,.17);
 object('study-notes','Pergaminho e pena',[desk.x+.47,1.02,-2.86],'study-desk');
 block('paper',[desk.x+.47,1.027,-2.86],[.22,.014,.30],[0,-.25,0]);stroke('brass',[desk.x+.37,1.043,-2.76],[desk.x+.54,1.073,-3.04],.012);
 solid('study-desk',[desk.x,.52,desk.z],[2.78,1.04,.98]);
 object('study-chair','Cadeira de estudo',[desk.x,0,-2.22]);
 add(softBox,materials.wood,[desk.x,.45,-2.22],[.54,.08,.50]);for(const x of [-.20,.20])for(const z of [-.18,.18])block('wood',[desk.x+x,.22,-2.22+z],[.05,.44,.05]);
 block('beam',[desk.x,.70,-2.04],[.50,.48,.075]);solid('study-chair',[desk.x,.48,-2.19],[.61,.96,.64]);
 object('study-desk','Escrivaninha',[desk.x,0,desk.z]);
 plant(desk.x-1.20,1.014,-3.31,.48);
 ownerId=null;
 // Moon tapestries flank the study. Inert markings, not unlock icons/UI.
 for(const x of [-.50,2.0]){
  object(x<0?'banner-left':'banner-right',x<0?'Estandarte esquerdo':'Estandarte direito',[x,2.09,-4.08]);
  add(drape('banner',.83,1.10,.02),materials.cloth,[x,2.09,-4.08]);
  block('brass',[x,2.69,-4.025],[.94,.036,.03]);
 }
 // Flat crescent embroidery on the hanging fabric.
 const moon=get('moon',()=>{
  const shape=new THREE.Shape();shape.absarc(0,0,.19,.50,Math.PI*2-.50,false);shape.quadraticCurveTo(-.075,0,.19*Math.cos(.50),.19*Math.sin(.50));
  return new THREE.ShapeGeometry(shape,18);
 });
 const bannerMoon=get('banner-crescent',createBannerCrescent);
 for(const x of [-.50,2.0]){
  object(x<0?'banner-left':'banner-right',x<0?'Estandarte esquerdo':'Estandarte direito',[x,2.09,-4.08]);
  add(bannerMoon,materials.bannerMoon,[x,2.11,-4.017],[1.12,1.12,1.12],[0,0,0],false);
 }
 ownerId=null;category='architecture';
 // Recessed masonry and a hollow cauldron; no smoke/particle system.
 block('stone',[4.08,.105,-3.0],[1.48,.17,1.40]);block('soot',[4.08,.58,-3.39],[.95,.76,.08]);
 for(let row=0;row<4;row++)for(const side of [-1,1]){
  block(row%2?'stoneLight':'stone',[4.08+side*.57,.27+row*.20,-2.99],[.25,.19,1.06]);
  block('beam',[4.08+side*.57,.17+row*.20,-2.456],[.235,.015,.012]);
 }
 for(let i=0;i<7;i++){const a=i*Math.PI/6;block(i%2?'stone':'stoneLight',[4.08+Math.cos(a)*.43,.65+Math.sin(a)*.30,-2.46],[.22,.20,.26],[0,0,a-Math.PI/2]);}
 block('stoneLight',[4.08,1.15,-3.0],[1.50,.15,1.45]);
 for(let row=0;row<7;row++)for(let col=0;col<2;col++)block((row+col)%3?'stone':'stoneLight',[3.89+col*.38,1.39+row*.245,-3.60],[.367,.235,.58]);
 block('stone',[4.08,3.075,-3.60],[.92,.11,.72]);
 for(let i=0;i<3;i++)add(cylinder,materials.bark,[3.84+i*.18,.23,-2.88],[.062,.49,.062],[Math.PI/2,.2-i*.2,0]);
 for(let i=0;i<3;i++)add(cone,materials.flame,[3.90+i*.17,.39+(i%2)*.045,-2.83],[.075,.26+(i%2)*.07,.075],[.06,0,(i-1)*.14],false);
 object('cauldron','Caldeirão e poção',[4.08,1.25,-2.81]);
 const cauldronProfile=[[0,0],[.22,0],[.34,.08],[.43,.24],[.44,.34],[.40,.47],[.36,.55],[.34,.58],[.31,.57],[.315,.50],[.35,.42],[.37,.30],[.32,.16],[.18,.11],[0,.11]];
 const cauldronGeo=get('cauldron-body',()=>new THREE.LatheGeometry(cauldronProfile.map(p=>new THREE.Vector2(p[0],p[1])),20));
 add(cauldronGeo,materials.metal,[4.08,1.27,-2.81]);
 const rim=get('cauldron-rim',()=>new THREE.TorusGeometry(.347,.045,6,24));add(rim,materials.metal,[4.08,1.82,-2.81],[1,1,1],[-Math.PI/2,0,0]);
 const handle=get('cauldron-handle',()=>new THREE.TorusGeometry(.13,.026,6,16));
 for(const side of [-1,1])add(handle,materials.metal,[4.08+side*.445,1.61,-2.81],[1,1,1],[0,Math.PI/2,side*.09]);
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3;block('metal',[4.08+Math.sin(a)*.25,1.25,-2.81+Math.cos(a)*.25],[.085,.13,.085],[.08,0,.08]);}
 const liquid=get('potion-surface',()=>new THREE.CircleGeometry(.309,32));add(liquid,materials.potion,[4.08,1.742,-2.81],[1,1,1],[-Math.PI/2,0,0],false);
 const meniscus=get('potion-edge',()=>new THREE.TorusGeometry(.300,.008,4,32));add(meniscus,materials.potion,[4.08,1.744,-2.81],[1,1,1],[-Math.PI/2,0,0],false);
 ownerId=null;candle(4.63,1.23,-3.27,.18);
 solid('hearth',[4.08,.7,-3.0],[1.55,1.40,1.50]);
 for(const y of [1.46,2.02]){
  object(y<1.5?'alchemy-shelf-low':'alchemy-shelf-high',y<1.5?'Prateleira de alquimia baixa':'Prateleira de alquimia alta',[2.94,y,-4.0]);
  block('plank',[2.94,y,-4.0],[1.05,.065,.40]);for(let i=0;i<3;i++)bottle(2.57+i*.30,y+.04,-3.96,i);
 }
 ownerId=null;plant(2.83,.037,-3.58,.70);ivy(2.42,2.65,-3.97,1.0);
 // Rug in the hub: quiet embroidered rings, a small compass rather than a new ritual.
 object('central-rug','Tapete de meditação',[0,0,.36]);
 // Same painted-material approach as the rectangular rug: one opaque cloth
 // surface with integrated motifs; only the thin edge and fringe need geometry.
 add(get('round-rug-body',createRugBacking),materials.rugEdge,[0,0,.36]);
 add(get('round-rug-surface',createRugSurface),materials.roundRug,[0,0,.36]);
 const tassel=get('round-rug-tassel',createRugTassel);
 for(let i=0;i<64;i++){
  const a=i*Math.PI*2/64;
  const r=rugRadius(Math.PI/2-a)-.006,x=Math.sin(a)*r,z=Math.cos(a)*r;
  add(tassel,materials[i%3?'rugFringe':'rugFringeLight'],[x,rugClothHeight(x,z)+.001,.36+z],[1,1,1],[0,a,0],false);
 }
 // One walkable meditation zone; the small cushion joins the reading chair.
 object('storage','Armário de entrada',[4.12,0,2.86]);
 block('wood',[4.12,.43,2.86],[1.48,.80,.63]);add(softBox,materials.plank,[4.12,.87,2.86],[1.59,.09,.72]);
 for(const x of [3.79,4.45])block('beam',[x,.45,3.195],[.60,.63,.027]);
 for(const x of [3.79,4.45]){
  block('plank',[x,.45,3.216],[.48,.51,.019]);
  for(const side of [-1,1])block('wood',[x+side*.26,.45,3.234],[.035,.57,.033]);
  for(const y of [.18,.72])block('wood',[x,y,3.234],[.55,.033,.035]);
 }
 for(const x of [4.06,4.17])round('brass',[x,.50,3.226],.022,.036);
 solid('storage',[4.12,.46,2.86],[1.65,.92,.79]);plant(4.54,.92,2.80,.90);bottle(3.72,.92,2.85);pile(3.96,.92,2.80,2);
 // Chest and a comfortable small chair on the opposite side of the entry.
 object('chest','Baú',[-3.38,0,1.20]);
 block('wood',[-3.38,.27,1.20],[1.46,.48,.70]);
 const chestLid=get('chest-lid',()=>{
  const shape=new THREE.Shape();shape.moveTo(-.35,0);shape.lineTo(.35,0);shape.absarc(0,0,.35,0,Math.PI,false);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:1.44,steps:1,curveSegments:12,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:1});
  g.translate(0,0,-.72);g.rotateY(Math.PI/2);return g;
 });add(chestLid,materials.wood,[-3.38,.50,1.20]);
 for(const x of [-3.90,-2.88])add(get('lid-strap',()=>new THREE.TorusGeometry(.357,.021,4,18,Math.PI)),materials.metal,[x,.50,1.20],[1,1,1],[0,Math.PI/2,0]);
 for(const x of [-3.90,-2.88])block('metal',[x,.28,1.563],[.055,.48,.018]);block('brass',[-3.38,.36,1.575],[.085,.08,.028]);
 solid('chest',[-3.38,.45,1.20],[1.49,.90,.79]);
 object('reading-chair','Poltrona e manta',[-3.85,0,2.78]);
 block('wood',[-3.85,.31,2.78],[1.05,.22,.94]);add(softBox,materials.cloth,[-3.85,.46,2.78],[.88,.18,.76]);
 add(softBox,materials.clothLight,[-3.85,.77,2.43],[.89,.62,.17],[.16,0,0]);
 add(softBox,materials.clothLight,[-3.78,.59,2.77],[.42,.17,.36],[0,.20,.06]);
 for(const x of [-4.31,-3.39])block('wood',[x,.67,2.77],[.11,.43,.96]);
 for(const x of [-4.26,-3.44])for(const z of [2.43,3.11])block('beam',[x,.18,z],[.07,.35,.07]);
 const chairThrow=get('chair-throw',()=>{
  const g=new THREE.PlaneGeometry(.59,1.34,10,18),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),t=(p.getY(i)+.67)/1.34;
   const y=t<.42?.32+t*.65:t<.74?.593+(t-.42)*1.03:.923-(t-.74)*.22;
   const z=t<.42?3.22-t*1.0:t<.74?2.80-(t-.42)*.90:2.512-(t-.74)*.42;
   p.setXYZ(i,x,y+.018*Math.sin(x*24+t*2),z);
  }
  g.computeVertexNormals();return g;
 });add(chairThrow,materials.clothLight,[-3.87,0,0]);
 solid('reading-chair',[-3.85,.6,2.78],[1.15,1.20,1.05]);
 object('side-table','Mesa lateral',[-2.66,0,2.79]);
 round('wood',[-2.66,.52,2.79],.36,.09);round('beam',[-2.66,.26,2.79],.095,.48);candle(-2.66,.57,2.79,.22);
 solid('side-table',[-2.66,.28,2.79],[.73,.56,.73]);
 ownerId=null;category='architecture';
 // Entry: clear threshold and three outer steps. The pack candelabra have
 // their own movable bases; no fixed stone/wood pedestals remain underneath.
 block('plank',[0,.032,3.64],[1.81,.035,.84]);
 for(let i=0;i<3;i++)block('beam',[0,-.16-i*.11,4.28+i*.23],[1.96,.16,.33]);
 for(const p of [[-4.45,.032,3.72],[4.65,.032,1.65],[-1.13,.035,-3.14]])plant(p[0],p[1],p[2],.75);
 ivy(-4.95,2.91,-2.65,1.16,true);ivy(-4.95,2.62,-.32,.86,true);ivy(-4.95,2.53,2.89,1.16,true);
 // Dried herbs on the back beam: a few silhouettes, not a dense curtain.
 for(let i=0;i<5;i++){
  const x=2.56+i*.15;object(`hanging-herbs-${i+1}`,`Ervas penduradas ${i+1}`,[x,2.5,-3.96]);stroke('brass',[x,2.82,-4.0],[x,2.50,-3.96],.010);
  for(let j=0;j<3;j++)add(leaf,materials[i%2?'herbDry':'leaf'],[x+(j-1)*.055,2.32-j*.025,-3.92],[.17,.38,.26],[0,0,(j-1)*.20]);
 }

 // Lanterns are movable groups; the walls and entrance posts stay protected.
 lamp('lamp-library','Lamparina da biblioteca',-3.77,2.22,-2.75,9,0);
 lamp('lamp-study','Lamparina da escrivaninha',.98,2.26,-3.30,10,2.1);
 lamp('lamp-hearth','Lamparina junto à lareira',4.65,1.98,-3.18,7,4.5);
 lamp('lamp-entry-left','Lamparina esquerda da entrada',-1.06,1.38,3.85,6,1.3,[0,1.38,3.65]);
 lamp('lamp-entry-right','Lamparina direita da entrada',1.06,1.38,3.85,0);
 // Additional modelling follows the reference without narrowing the hub.
 category='architecture';
 for(const x of [-4.9,-2.4,2.4,4.9])stroke('wood',[x,2.53,-4.0],[x+(x<0?.35:-.35),2.94,-4.0],.09);
 for(const z of [-3.8,1.25,3.85])stroke('wood',[-5.0,2.48,z],[-5.0,2.94,z-.35],.08);
 ownerId=null;category='architecture';
 object('floor-cushion','Almofada de chão',[-1.38,0,1.47]);
 // Curved loose cushion stays outside the central travel lane.
 add(softBox,materials.clothLight,[-1.38,.14,1.47],[.62,.22,.48],[0,.30,.045]);
 for(let i=0;i<5;i++)block('stitch',[-1.61+i*.115,.247,1.47],[.012,.007,.31],[0,.30,0]);
 object('bed','Cama e tecidos',[bed.x,0,bed.z]);
 // Keep the illustrated folds; the dotted stitch rows were removed after visual QA.
 // Carved headboard crest and nightstand candle saucers.
 add(moon,materials.brass,[bed.x,.85,bed.z-1.226],[.60,.60,.60],[0,0,0],false);
 // Organic pottery: lathed profiles complement the square carpentry.
 const pot=get('herb-pot',()=>new THREE.LatheGeometry([[0,0],[.12,0],[.18,.08],[.20,.22],[.19,.27],[.21,.29],[.21,.32],[.16,.32],[.16,.27]].map(v=>new THREE.Vector2(v[0],v[1])),12));
 for(const [x,y,z] of [[-4.22,.038,3.73],[2.67,.038,-2.65],[4.54,.96,2.80]]){
  object(`herb-pot-${x}`, 'Vaso de ervas',[x,y,z],x>4?'storage':null);
  add(pot,materials.ceramic,[x,y,z]);round('soil',[x,y+.285,z],.15,.012);
 }
 // Wall shelves compose the negative space around the library and study.
 for(const [x,y,z] of [[-4.24,1.64,-3.92],[2.68,2.47,-3.91]]){
  object(`wall-shelf-${x}`, 'Prateleira decorativa',[x,y,z]);
  block('plank',[x,y,z],[.84,.075,.42]);
  for(const side of [-1,1])stroke('brass',[x+side*.31,y-.22,z+.10],[x+side*.31,y-.02,z+.16],.025);
  bottle(x-.23,y+.04,z+.06,1);bottle(x,y+.04,z+.06,0);candle(x+.23,y+.04,z+.05,.17);
 }
 object('rolled-linen','Rolos de linho',[4.03,.91,2.75],'storage');
 // A shelf of rolled linen and supplies makes the entrance feel inhabited.
 for(let i=0;i<3;i++)add(cylinder,materials.clothLight,[3.78+i*.25,.91,2.75],[.08,.28,.08],[Math.PI/2,0,0]);
 object('alchemy-bench','Bancada de alquimia',[2.68,0,-2.65]);
 // Alchemy worktop joins the study/hearth composition, keeping the fire visible.
 add(softBox,materials.plank,[2.68,.91,-2.65],[1.15,.13,1.0]);
 for(const x of [2.22,3.14])for(const z of [-3.02,-2.28])block('wood',[x,.45,z],[.075,.88,.075]);
 block('wood',[2.68,.28,-2.65],[1.03,.065,.86]);
 pile(2.35,.32,-2.50,3);bottle(2.92,.32,-2.49,1);bottle(2.85,.98,-2.96,0);bottle(3.06,.98,-2.92,1);
 object('mortar','Almofariz e pilão',[2.45,.98,-2.47],'alchemy-bench');
 const mortar=get('mortar',()=>new THREE.LatheGeometry([[0,0],[.10,0],[.17,.08],[.18,.17],[.16,.19],[.12,.16],[.08,.07],[0,.06]].map(v=>new THREE.Vector2(v[0],v[1])),12));
 add(mortar,materials.stone,[2.45,.98,-2.47]);add(cylinder,materials.wood,[2.47,1.16,-2.45],[.025,.27,.025],[.28,0,.38]);
 object('alchemy-bench','Bancada de alquimia',[2.68,0,-2.65]);
 prop('notes','Anotações',[2.92,.986,-2.39],()=>block('paper',[2.92,.986,-2.39],[.25,.012,.28],[0,.16,0]));
 crystal(2.28,.98,-2.94,.20);

 solid('alchemy-bench',[2.68,.48,-2.65],[1.20,.96,1.05]);
 // Rings secure the bundles of hanging herbs, away from circulation.
 for(let i=0;i<5;i++){object(`hanging-herbs-${i+1}`,`Ervas penduradas ${i+1}`,[2.56+i*.15,2.5,-3.96]);add(get('herb-ring',()=>new THREE.TorusGeometry(.037,.009,4,8)),materials.brass,[2.56+i*.15,2.84,-3.96],[1,1,1]);}
 // Embroidery is muted metal-coloured thread, with a clear visual hierarchy around each moon.
 for(const x of [-.50,2.0]){
  object(x<0?'banner-left':'banner-right',x<0?'Estandarte esquerdo':'Estandarte direito',[x,2.09,-4.08]);
  for(let i=0;i<16;i++){
   const a=i*Math.PI*2/16,inner=.255,outer=i%2?.30:.335;
   stroke('stitch',[x+Math.sin(a)*inner,2.11+Math.cos(a)*inner,-4.007],[x+Math.sin(a)*outer,2.11+Math.cos(a)*outer,-4.007],.008);
  }
  for(const side of [-1,1]){
   stroke('stitch',[x+side*.26,1.76,-4.005],[x+side*.26,1.84,-4.005],.010);
   stroke('stitch',[x+side*.225,1.80,-4.005],[x+side*.295,1.80,-4.005],.010);
  }
 }
 ownerId=null;category='architecture';
 // Visible iron nails and bindings anchor joinery. All details share instanced buffers.
 for(const x of [-5.18,-2.58,0,2.60,5.18])for(const y of [.40,2.64])
  add(sphere,materials.metal,[x,y,-3.99],[.028,.028,.011],[0,0,0]);
 object('chest','Baú',[-3.38,0,1.20]);
 for(const x of [-3.90,-2.88])for(const y of [.12,.39])
  add(sphere,materials.brass,[x,y,1.581],[.022,.022,.009],[0,0,0]);
 object('reading-chair','Poltrona e manta',[-3.85,0,2.78]);
 // A stitched edge follows the throw rather than floating over a flat cushion.
 for(const x of [-4.13,-3.61])stroke('stitch',[x,.34,3.20],[x,.58,2.83],.008);
 object('library-skull','Caveira da biblioteca',[-2.12,1.30,-3.38],'bookshelf');
 // Additive, independently editable floor prop. Its proxy is replaced by the
 // pack's Cauldron before rendering; all existing object definitions stay intact.
 object('floor-cauldron','Caldeirão de chão',[4.1,0,.3]);
 block('metal',[4.1,.435,.3],[.90,.80,.90]);
 const values=[...batches.values()];
 const metrics={triangles:0,meshes:values.length,instances:0,geometries:geometries.size,materials:Object.keys(materials).length};
 for(const b of values){metrics.instances+=b.matrices.length;metrics.triangles+=(b.g.index?.count??b.g.attributes.position.count)/3*b.matrices.length;}
 return {batches:values,objects,materials,geometries:[...geometries.values()],obstacles,lamps,metrics,
  dispose(){for(const g of geometries.values())g.dispose();for(const m of Object.values(materials))m.dispose();}};
}
