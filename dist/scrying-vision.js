import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/addons/utils/BufferGeometryUtils.js';
import {createPortalSurface} from './portal-surface.js';

// Live, proportional view-only composition built from the actual garden meshes.
export function createAbsentGarden({scene,witch}){
 const root=new THREE.Group();root.name='scry-garden-without-you';root.visible=false;root.position.set(5.28,-.35,2.79);root.rotation.y=-.35;root.scale.setScalar(.38);scene.add(root);
 const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),ownedGeometry=[],ownedMaterials=[];
 const viewMaterials=new Map();
 function viewMaterial(source){if(!viewMaterials.has(source)){const m=source.clone();viewMaterials.set(source,m);ownedMaterials.push(m);}return viewMaterials.get(source)}
 // Reuse the actual circle and arch meshes, only within this uniformly scaled view.
 for(const object of scene.children){
  if(object.name==='ritual-stone-sectors'||(object.geometry?.type==='PlaneGeometry'&&object.geometry.parameters.width===5.1)){
   const copy=object.clone();copy.material=viewMaterial(object.material);copy.name='scry-circle-'+(object.name||'inscription');root.add(copy);
   if(copy.material.map&&copy.material.transparent){copy.material.emissive.set('#8268c4');copy.material.emissiveIntensity=.13;}
  }
  if(!object.isInstancedMesh)continue;
  const ring=[],arch=[],plants=[],matrix=new THREE.Matrix4(),anchor=V();
  for(let i=0;i<object.count;i++){
   object.getMatrixAt(i,matrix);anchor.setFromMatrixPosition(matrix);
   if(Math.abs(anchor.y-.23)<.002&&Math.abs(Math.hypot(anchor.x,anchor.z-.3)-2.91)<.04)ring.push(matrix.clone());
   if(Math.abs(anchor.z+4.7)<.02&&Math.abs(anchor.x)<1.5&&anchor.y>.05&&anchor.y<2.9)arch.push(matrix.clone());
   const vegetation=['grass','leaf','stem'].includes(object.userData.environmentKind);
   const inGarden=Math.abs(anchor.x)<3.7&&anchor.z>-5.3&&anchor.z<4.2;
   const lowPlant=anchor.y<1.4,archIvy=Math.abs(anchor.x)<1.3&&Math.abs(anchor.z+4.7)<.6&&anchor.y<2.9;
   if(vegetation&&inGarden&&(lowPlant||archIvy))plants.push(matrix.clone());
  }
  for(const [name,matrices] of [['ring',ring],['arch',arch],['garden-plants',plants]])if(matrices.length){const copy=new THREE.InstancedMesh(object.geometry,viewMaterial(object.material),matrices.length);matrices.forEach((m,i)=>copy.setMatrixAt(i,m));copy.name='scry-'+name+'-stones';copy.computeBoundingSphere();root.add(copy);}
 }
 for(const skull of scene.children.filter(o=>o.name==='caveira')){const copy=skull.clone(true);copy.name='scry-still-skull';const extraLights=[];copy.traverse(o=>{if(o.isLight)extraLights.push(o)});extraLights.forEach(o=>o.removeFromParent());root.add(copy);}
 const hat=witch.root.getObjectByName('hatPivot').clone(true);hat.name='scry-abandoned-hat';
 hat.position.set(0,0,.30);hat.rotation.set(-.035,-.42,-.07);hat.scale.setScalar(1.45);root.add(hat);
 // Center the brim's actual footprint, not the inherited animated hat pivot.
 root.updateMatrixWorld(true);hat.updateMatrixWorld(true);const brim=hat.children[0];brim.geometry.computeBoundingBox();
 const brimCenter=brim.geometry.boundingBox.getCenter(V()).applyMatrix4(brim.matrixWorld).applyMatrix4(root.matrixWorld.clone().invert());
 hat.position.x-=brimCenter.x;hat.position.z+=.30-brimCenter.z;
 hat.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(hat);hat.position.y=.268-(bounds.min.y-root.position.y)/root.scale.y;

 // Pose a clone once, then bake its four material batches. No AI, second update loop,
 // animated vertices on CPU, or changes to the real cat's geometry/state.
 const posed=scene.getObjectByName('black-cat-familiar').clone(true),body=posed.children[0];
 posed.position.set(0,0,0);posed.rotation.set(0,0,0);posed.scale.set(1,1,1);
 body.position.set(0,0,0);body.rotation.set(0,0,0);body.scale.set(1,1,1);
 const torso=posed.getObjectByName('cat-continuous-torso');torso.morphTargetInfluences[0]=1;
 const head=posed.getObjectByName('cat-sculpted-head').parent;head.position.set(0,.574,.080);head.rotation.set(-.055,-.12,.01);
 const tail=posed.getObjectByName('cat-continuous-tail');tail.morphTargetInfluences[0]=1;tail.morphTargetInfluences[1]=0;
 tail.parent.position.set(0,.09,-.27);tail.parent.rotation.set(0,.04,0);
 posed.getObjectByName('cat-almond-eyes').scale.y=1;posed.getObjectByName('cat-pupils').scale.y=1;
 const limbs=[];posed.traverse(o=>{if(o.name==='cat-upper-leg')limbs.push(o)});
 for(const upper of limbs){
  const pivot=upper.parent,back=pivot.position.z<0,side=Math.sign(pivot.position.x),lower=pivot.getObjectByName('cat-leg-lower'),lowerMesh=lower.getObjectByName('cat-tapered-lower-leg'),paw=lower.getObjectByName('cat-small-paw').parent;
  pivot.position.set(side*(back?.112:.078),back?.157:.350,back?-.18:.075);
  const a=back?.123:.173,b=back?.132:.160;upper.scale.y=a/.123;lower.position.y=-a;lowerMesh.scale.y=b/.132;paw.position.y=-b;
  const dy=pivot.position.y-.028,dz=(back?-.125:.183)-pivot.position.z,d=THREE.MathUtils.clamp(Math.hypot(dy,dz),.025,a+b-.001);
  const bend=Math.acos(THREE.MathUtils.clamp((a*a+d*d-b*b)/(2*a*d),-1,1)),flex=Math.acos(THREE.MathUtils.clamp((d*d-a*a-b*b)/(2*a*b),-1,1)),sign=back?-1:1;
  pivot.rotation.x=Math.atan2(-dz,dy)-sign*bend;lower.rotation.x=sign*flex;paw.rotation.x=-pivot.rotation.x-lower.rotation.x;
 }
 posed.updateMatrixWorld(true);const batches=new Map(),vertex=V(),blinkParts=[];
 posed.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone(),positions=g.attributes.position;
  for(let i=0;i<positions.count;i++){o.getVertexPosition(i,vertex);positions.setXYZ(i,vertex.x,vertex.y,vertex.z)}
  g.morphAttributes={};for(const name of Object.keys(g.attributes))if(name!=='position'&&!(name==='color'&&o.material.vertexColors))g.deleteAttribute(name);
  if(!g.index)g.setIndex(Array.from({length:positions.count},(_,i)=>i));g.applyMatrix4(o.matrixWorld);g.computeVertexNormals();
  if(o.name==='cat-almond-eyes'||o.name==='cat-pupils'){blinkParts.push({geometry:g,material:o.material,name:o.name});return;}
  if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(g);
 });
 const cat=new THREE.Group();cat.name='scry-waiting-cat';cat.position.set(.65,.268,-.10);cat.rotation.y=.32;cat.scale.setScalar(1.48);root.add(cat);
 for(const [material,parts] of batches){const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());ownedGeometry.push(geometry);const viewMaterial=material.color?.getHex()===0x162235?material.clone():material;if(viewMaterial!==material){ownedMaterials.push(viewMaterial);viewMaterial.color.set('#26364b');viewMaterial.roughness=.64;}const mesh=new THREE.Mesh(geometry,viewMaterial);mesh.name='scry-cat-'+(material.vertexColors?'ears':material.emissive?.getHex()?'eyes':'coat');cat.add(mesh);}

 const blinkRoot=new THREE.Group();blinkRoot.name='scry-cat-blink';cat.add(blinkRoot);
 let eyeY=0;for(const part of blinkParts){part.geometry.computeBoundingBox();eyeY=Math.max(eyeY,part.geometry.boundingBox.getCenter(V()).y);}
 blinkRoot.position.y=eyeY;
 for(const part of blinkParts){part.geometry.translate(0,-eyeY,0);ownedGeometry.push(part.geometry);const material=viewMaterial(part.material);if(part.name==='cat-almond-eyes'){material.color.set('#e5c66c');material.emissive.set('#c09842');material.emissiveIntensity=.55;}const mesh=new THREE.Mesh(part.geometry,material);mesh.name='scry-'+part.name;blinkRoot.add(mesh);}

 // Cheap contact anchors for the abandoned hat and the waiting cat.
 const contacts=[];for(const [x,z,rx,rz] of [[0,.30,.59,.46],[.65,-.10,.26,.37]]){const g=new THREE.CircleGeometry(1,32);g.rotateX(-Math.PI/2);g.scale(rx,1,rz);g.translate(x,.265,z);contacts.push(g)}
 const contactGeo=mergeGeometries(contacts,false);contacts.forEach(g=>g.dispose());ownedGeometry.push(contactGeo);
 const contactMaterial=new THREE.MeshBasicMaterial({color:'#050811',transparent:true,opacity:.36,depthWrite:false});ownedMaterials.push(contactMaterial);root.add(new THREE.Mesh(contactGeo,contactMaterial));

 // A dark recess fitted inside the existing arch. Only visible in the vision;
 // no passage or portal mechanics; a quiet silhouette lives only in this view.
 const portal=createPortalSurface('scry-arch-recess'),arch=portal.mesh,archUniforms=portal.uniforms;
 ownedGeometry.push(arch.geometry);ownedMaterials.push(arch.material);root.add(arch);
 // The contrast comes from illuminated depth behind the figure, not a jump scare.
 const figure=new THREE.Group();figure.name='scry-portal-shadow';figure.position.set(0,.15,-4.70);root.add(figure);
 const silhouetteMaterial=new THREE.MeshBasicMaterial({color:'#03040a'});ownedMaterials.push(silhouetteMaterial);
 const cloakGeo=new THREE.LatheGeometry([new THREE.Vector2(.33,0),new THREE.Vector2(.25,.45),new THREE.Vector2(.18,1.14),new THREE.Vector2(.21,1.25),new THREE.Vector2(.11,1.39)],12);ownedGeometry.push(cloakGeo);figure.add(new THREE.Mesh(cloakGeo,silhouetteMaterial));
 const hoodGeo=new THREE.SphereGeometry(.145,12,8);ownedGeometry.push(hoodGeo);const hood=new THREE.Mesh(hoodGeo,silhouetteMaterial);hood.position.y=1.49;hood.scale.set(.82,1.2,.82);figure.add(hood);
 root.traverse(o=>{o.layers.set(12);if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
 const lights=[];scene.traverse(o=>{if(o.isLight)lights.push(o)});
 const materials=new Set();scene.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)});
 const warmMaterials=[...materials].filter(m=>m.color&&((m.isMeshBasicMaterial&&m.color.r>m.color.b*1.25&&m.color.r>m.color.g*.98)||(m.emissive&&m.emissiveIntensity>0&&m.emissive.r>m.emissive.b*1.25)));

 let visionTime=0;
 function prepare(clock,closing){visionTime=clock;archUniforms.time.value=clock;archUniforms.presence.value=1-closing;cat.scale.y=1.48*(1+Math.sin(clock*.8)*.007);cat.rotation.y=.32+Math.sin(clock*.23)*.012;const phase=(clock+1.15)%4.8;blinkRoot.scale.y=1-.96*Math.exp(-Math.pow((phase-.22)/.065,2));figure.scale.y=1+Math.sin(clock*.42)*.004;}
 function enter(){
  const oldLights=lights.map(light=>({light,intensity:light.intensity,color:light.color.clone(),position:light.position.clone(),layers:light.layers.mask})),oldMaterials=warmMaterials.map(material=>({material,color:material.color.clone(),emissiveIntensity:material.emissiveIntensity}));
  for(const {light} of oldLights){
   light.layers.enable(12);
   if(light.isPointLight){light.intensity*=.14;
    if(Math.hypot(light.position.x-.55,light.position.z-1.45)<.01&&Math.abs(light.position.y-1.35)<.01){light.position.copy(V(.55,1.35,1.45).applyMatrix4(root.matrixWorld));light.color.set('#b28cde');light.intensity=.62*(1+Math.sin(visionTime*.71)*.025);}}
   else if(light.isHemisphereLight){light.intensity*=.58;light.color.set('#8672b1');}
   else if(light.isDirectionalLight){light.intensity*=.82;light.color.set('#aaa0c9');}
  }
  for(const {material} of oldMaterials){if(material.isMeshBasicMaterial)material.color.multiplyScalar(.30);if(material.emissiveIntensity!==undefined)material.emissiveIntensity*=.22;}
  root.visible=true;
  return ()=>{root.visible=false;for(const old of oldLights){old.light.intensity=old.intensity;old.light.color.copy(old.color);old.light.position.copy(old.position);old.light.layers.mask=old.layers}for(const old of oldMaterials){old.material.color.copy(old.color);if(old.emissiveIntensity!==undefined)old.material.emissiveIntensity=old.emissiveIntensity}};
 }
 function dispose(){scene.remove(root);ownedGeometry.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());}
 return {root,hat,cat,arch,figure,prepare,enter,dispose};
}
