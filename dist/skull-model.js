import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';

// One cached load; the five instances share geometries and retain the GLB materials.
let modelPromise;
export function loadSkullModel(){
  return modelPromise ??= new GLTFLoader().loadAsync(new URL('./assets/ritual-skull.glb',import.meta.url).href).then(gltf=>{
    const source=gltf.scene.getObjectByName('JR_Caveira_Ritual');
    if(!source)throw new Error('O GLB não contém JR_Caveira_Ritual.');
    // Ignore the unrelated export cube and remove only the asset's export offset.
    const template=source.clone(true);template.position.set(0,0,0);template.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(template),size=bounds.getSize(new THREE.Vector3());
    const center=bounds.getCenter(new THREE.Vector3());
    // Fit the approved .453-high silhouette without deforming the supplied model.
    const scale=.453/size.y;
    const offset=new THREE.Vector3(-center.x*scale,.012-bounds.min.y*scale,-center.z*scale);
    return function createSkullVisual(){
      const visual=new THREE.Group();visual.name='GLB-skull';
      visual.scale.setScalar(scale);visual.position.copy(offset);
      const model=template.clone(true),materials=new Map(),boneMaterials=[];
      model.traverse(mesh=>{
        if(!mesh.isMesh)return;
        mesh.castShadow=true;mesh.receiveShadow=true;
        const ownMaterial=original=>{
          if(!materials.has(original)){
            const material=original.clone();materials.set(original,material);
            if(material.name==='JR_Osso_Envelhecido')boneMaterials.push({material,baseEmissive:material.emissive.clone()});
          }
          return materials.get(original);
        };
        mesh.material=Array.isArray(mesh.material)?mesh.material.map(ownMaterial):ownMaterial(mesh.material);
      });
      visual.add(model);
      // The original two eye lights need only follow this model's cavities.
      const eyes=[-1,1].map(side=>new THREE.Vector3(side*.65,1.025,.96).multiplyScalar(scale).add(offset));
      return {visual,eyes,boneMaterials};
    };
  });
}
