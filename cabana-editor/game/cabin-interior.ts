import * as THREE from 'three'
// Existing game modules stay external: the game owns the renderer and physics.
import { GLTFLoader } from '../../dist/vendor/addons/loaders/GLTFLoader.js'
import { createGardenNavigation } from '../../dist/garden-navigation.js'
import { buildPlayableCabin } from './buildPlayableCabin.ts'
import approvedLayout from '../src/scenes/cabin/approved-cabin-layout-v3.json'

export async function createCabinInterior() {
  const base=new URL('./',import.meta.url),textureLoader=new THREE.TextureLoader(),loader=new GLTFLoader()
  const [wood,surfaces,assets,skull]=await Promise.all([
    textureLoader.loadAsync(new URL('assets/painted/cabin-wood-art-v1.png',base).href),
    textureLoader.loadAsync(new URL('assets/painted/cabin-surfaces-art-v1.png',base).href),
    loader.loadAsync(new URL('assets/quaternius/cabin-props.glb',base).href),
    loader.loadAsync(new URL('assets/ritual-skull.glb',base).href),
  ])
  const cabin=buildPlayableCabin(assets.scene,skull.scene,{wood,surfaces},JSON.stringify(approvedLayout))
  const support=new THREE.Mesh(new THREE.PlaneGeometry(10.4,8.4),new THREE.MeshBasicMaterial())
  support.rotation.x=-Math.PI/2;support.position.y=.028
  try {
    const navigation=await createGardenNavigation({surfaces:[support],obstacles:cabin.obstacles,outline:[[-5.1,-4.1],[5.1,-4.1],[5.1,4.1],[-5.1,4.1]],start:cabin.spawn,flatFloor:true})
    return {...cabin,navigation,metrics(){return {...cabin.metrics(),navigation:navigation.snapshot()}}}
  }catch(error){cabin.dispose();wood.dispose();surfaces.dispose();throw error}
  finally{support.geometry.dispose();support.material.dispose()}
}
