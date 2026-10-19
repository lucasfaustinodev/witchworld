import { DoubleSide, Vector4 } from 'three'
import type { MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import { createCabinSurfaceLibrary } from './cabinSurfaceLibrary.ts'
import type { PaintedCabinAtlases, CabinSurfaceKind } from './cabinSurfaceLibrary.ts'

interface Finish {
  surface: CabinSurfaceKind
  tint?: string
  roughness: number
  metalness?: number
  wood?: boolean
  crop?: readonly [number,number,number,number]
  /** Recolour small prop variants, retaining the authored brush-value pattern. */
  recolor?: number
}
const finishes: Record<string, Finish> = {
  wood: { surface: 'chestnut', roughness: .88, wood: true, tint: '#dfcfc2' },
  plank: { surface: 'furniture', roughness: .90, wood: true, tint: '#dbc5ae' },
  plankLight: { surface: 'oak', roughness: .88, wood: true, tint: '#dccbb8' },
  beam: { surface: 'walnut', roughness: .94, wood: true, tint: '#ddd2db' },
  wall: { surface: 'chestnut', roughness: .92, wood: true, tint: '#c4b3a7' },
  bark: { surface: 'walnut', roughness: .98, wood: true, tint: '#b4acb7' },
  cloth: { surface: 'plum', roughness: .98 },
  clothLight: { surface: 'linen', roughness: .98, tint: '#e4d6de' },
  bedCloth: { surface: 'plum', roughness: .98, crop: [.07,.14,.82,.26] },
  bedLinen: { surface: 'linen', roughness: .98, tint: '#e4d6de', crop: [.10,.08,.78,.20] },
  rug: { surface: 'rug', roughness: 1 },
  roundRug: { surface: 'rug', roughness: 1, crop: [.22,.22,.56,.56] },
  trim: { surface: 'linen', roughness: .97, tint: '#c4a28e', recolor: 1.6 },
  stitch: { surface: 'linen', roughness: .96, tint: '#d6b58b', recolor: 1.7 },
  stone: { surface: 'stone', roughness: .98, tint: '#b4a9b6', crop: [.08,.08,.80,.80] },
  stoneLight: { surface: 'stone', roughness: .96, tint: '#ded0d2', crop: [.15,.12,.80,.80] },
  metal: { surface: 'iron', roughness: .90, metalness: .18, crop: [.21,.05,.74,.90] },
  brass: { surface: 'brass', roughness: .80, metalness: .24 },
  leather: { surface: 'leather', roughness: .95, tint: '#b99287', crop: [.22,.22,.52,.50] },
  leatherLight: { surface: 'parchment', roughness: .95, tint: '#b79370', recolor: 1.7 },
  book: { surface: 'leather', roughness: .94, tint: '#86618b', recolor: 4.2 },
  bookRed: { surface: 'leather', roughness: .94 },
  bookBlue: { surface: 'leather', roughness: .94, tint: '#607b9c', recolor: 4.2 },
  bookGreen: { surface: 'leather', roughness: .94, tint: '#687a51', recolor: 4.2 },
  bookOchre: { surface: 'leather', roughness: .94, tint: '#b2915c', recolor: 4.2 },
  paper: { surface: 'parchment', roughness: .98 },
  ceramic: { surface: 'glaze', roughness: .85, tint: '#bdc8c4' },
  bottleGlass: { surface: 'glaze', roughness: .82, tint: '#a8b6cd' },
  bottleGlassGreen: { surface: 'glaze', roughness: .84, tint: '#57806c', recolor: 4.1 },
  terracotta: { surface: 'terracotta', roughness: .96, tint: '#c7aa95' },
  wax: { surface: 'wax', roughness: .92, tint: '#ead5a3' },
  leaf: { surface: 'foliage', roughness: .98, tint: '#b1bc9b' },
  leafLight: { surface: 'foliage', roughness: .98, tint: '#ded4a5' },
  leafDark: { surface: 'foliage', roughness: .98, tint: '#829b8d' },
  herbDry: { surface: 'foliage', roughness: 1, tint: '#d6b38e' },
  soil: { surface: 'soil', roughness: 1, tint: '#aa9296' },
  soot: { surface: 'stone', roughness: 1, tint: '#302836', recolor: 2.2 },
  crystal: { surface: 'crystal', roughness: .80, tint: '#c7afda' },
  potion: { surface: 'potion', roughness: .82, tint: '#dac3ef' },
  floorPotion: { surface: 'potion', roughness: .72, tint: '#dac3ef' },
  bone: { surface: 'parchment', roughness: .97, tint: '#cbbab2' },
}

// UV0 is authored on each geometry. Vary only orientation, atlas cell and crop;
// no procedural surface pattern, triplanar sampling, noise or height derivatives.
const paintedVertexPars = /* glsl */`
  uniform vec4 uCabinPaintRect;
  uniform float uCabinWood;
  attribute vec2 cabinUvX;
  attribute vec2 cabinUvY;
  attribute vec2 cabinUvZ;
  attribute vec4 cabinPaintCrop;
  attribute float cabinPaintAxis;
`
const paintedUv = /* glsl */`
  #ifdef USE_MAP
    vec2 cabinUV = uv;
    #ifdef USE_INSTANCING
      if (uCabinWood > .5) cabinUV = cabinPaintAxis < .5 ? cabinUvX : (cabinPaintAxis < 1.5 ? cabinUvY : cabinUvZ);
      cabinUV = cabinPaintCrop.xy + cabinUV * cabinPaintCrop.zw;
    #endif
    vMapUv = uCabinPaintRect.xy + clamp(cabinUV,0.0,1.0) * uCabinPaintRect.zw;
  #endif
`
const paintedMap = /* glsl */`
  #ifdef USE_MAP
    vec4 paintedTexel = texture2D(map,vMapUv);
    // Three uploads colour maps in SRGB8; the standard texture sample is already linear.
    if (uPaintRecolor > .0) paintedTexel.rgb=vec3(clamp(dot(paintedTexel.rgb,vec3(.2126,.7152,.0722))*uPaintRecolor,.06,1.25));
    diffuseColor *= paintedTexel;
  #endif
`
export interface CabinMaterialClock { value: number; boil:{value:number}; dispose(): void }
const preparations = new WeakMap<Record<string, MeshStandardMaterial>, CabinMaterialClock>()

export function prepareCabinMaterials(materials: Record<string, MeshStandardMaterial>, textures?: PaintedCabinAtlases): CabinMaterialClock {
  const existing = preparations.get(materials)
  if (existing) return existing
  const library = createCabinSurfaceLibrary(textures)
  let disposed = false
  const time: CabinMaterialClock = { value: 0, boil:{value:0}, dispose() { if (disposed) return; disposed = true; library.dispose(); preparations.delete(materials) } }
  preparations.set(materials,time)
  for (const [name, material] of Object.entries(materials)) {
    const finish = finishes[name]
    const isPotion=name==='potion'||name==='floorPotion'
    const animated = isPotion || name === 'flame' || name==='potionBubble'
    if (!finish && !animated) continue
    const surface = finish && library.surfaces[finish.surface]
    if (finish && surface) {
      material.color.set(finish.tint ?? '#ffffff')
      material.map = surface.map
      material.normalMap = material.bumpMap = material.roughnessMap = material.metalnessMap = null
      material.roughness = finish.roughness
      material.metalness = finish.metalness ?? 0
      material.envMapIntensity = .20
      if ('clearcoat' in material) (material as MeshPhysicalMaterial).clearcoat = 0
      if (['leaf','leafLight','leafDark','herbDry','cloth','clothLight','bedCloth','bedLinen'].includes(name)) material.side = DoubleSide
      if (name === 'crystal') material.emissiveIntensity = .035
      if (isPotion) { material.emissive.set('#6e399c'); material.emissiveIntensity = .22 }
      const rect = [...surface.rect]
      if (finish.crop) { rect[0] += finish.crop[0]*rect[2]; rect[1] += finish.crop[1]*rect[3]; rect[2] *= finish.crop[2]; rect[3] *= finish.crop[3] }
      material.userData.cabinSurface = { kind: finish.surface, map: surface.map, rect, wood: !!finish.wood, style: 'original-hand-painted-albedo', uv: 'geometry-uv0', relief: 0 }
    }
    material.onBeforeCompile = (shader) => {
      let vertexPars = '', fragmentPars = '', vertexBody = ''
      if (finish && surface) {
        Object.assign(shader.uniforms, {
          uCabinPaintRect: { value: new Vector4(...material.userData.cabinSurface.rect) },
          uCabinWood: { value: finish.wood ? 1 : 0 },
          uPaintRecolor: { value: finish.recolor ?? 0 },
        })
        vertexPars += paintedVertexPars
        fragmentPars += 'uniform float uPaintRecolor;\n'
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n${paintedUv}`)
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',paintedMap)
      }
      if (animated) {
        shader.uniforms.uCabinTime = name==='floorPotion'||name==='potionBubble'?time.boil:time
        vertexPars += 'uniform float uCabinTime; varying vec3 vCabinWorld;\n'
        fragmentPars += 'uniform float uCabinTime; varying vec3 vCabinWorld;\n'
        if (isPotion) {
          vertexPars += 'varying vec2 vCabinPotionPlane;\n'
          fragmentPars += 'varying vec2 vCabinPotionPlane;\n'
          vertexBody += 'vCabinPotionPlane=position.xy; transformed.z += 0.0025*sin(position.x*18.0+uCabinTime*.7)*sin(position.y*14.0-uCabinTime*.5);'
        }
        if(name==='potionBubble')vertexBody+=`float boilSeed=0.0;
          #ifdef USE_INSTANCING
            boilSeed=instanceMatrix[3].x*7.13+instanceMatrix[3].z*11.79;
          #endif
          float boilPhase=fract(uCabinTime*.58+boilSeed);
          transformed*=sin(3.14159265359*boilPhase);
          transformed.y+=boilPhase*1.4-.8;`
        if (name === 'flame') vertexBody += `float phase=0.0;
          #ifdef USE_INSTANCING
            phase=instanceMatrix[3].x*3.7+instanceMatrix[3].z*5.3;
          #endif
          transformed.x+=sin(uCabinTime*1.9+position.y*3.0+phase)*.10*max(position.y+.4,0.0);
          transformed.z+=sin(uCabinTime*1.4+position.y*4.0+phase)*.06*max(position.y+.4,0.0);`
        vertexBody += `
          vec4 cabinWorld=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            cabinWorld=instanceMatrix*cabinWorld;
          #endif
          vCabinWorld=(modelMatrix*cabinWorld).xyz;`
        if (isPotion) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          vec2 p=vCabinPotionPlane;
          diffuseColor.rgb*=1.0-smoothstep(.22,.32,length(p))*.08;`)
        if (name === 'flame') shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance*=.94+.06*sin(uCabinTime*2.1+vCabinWorld.x*9.0+vCabinWorld.z*5.0);`)
      }
      shader.vertexShader = vertexPars + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`)
      shader.fragmentShader = fragmentPars + shader.fragmentShader
    }
    material.customProgramCacheKey = () => `cabin-painted-albedo-${animated ? name : 'uv'}-art-pass-1`
    material.needsUpdate = true
  }
  return time
}
