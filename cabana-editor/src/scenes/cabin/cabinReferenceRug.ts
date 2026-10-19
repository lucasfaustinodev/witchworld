import { Vector4 } from 'three'
import type { MeshStandardMaterial } from 'three'

// Reuse the rectangular rug's original pigments and material, with new UV placement.
export const RUG_STAR_POINTS = Array.from({length:5},(_,i)=>{
  const angle=Math.PI/2+i*2*Math.PI/5
  return {tip:[Math.cos(angle)*.74,Math.sin(angle)*.74]}
})
const vec=(p:number[])=>`vec2(${p.map(n=>n.toFixed(8)).join(',')})`
const starSegments=RUG_STAR_POINTS.map((p,i)=>`starDistance=min(starDistance,rugSegment(p,${vec(p.tip)},${vec(RUG_STAR_POINTS[(i+2)%5].tip)}));`).join('\n')

export function prepareReferenceRug(materials:Record<string,MeshStandardMaterial>) {
  const source=materials.rug,rect=source.userData.cabinSurface.rect
  for(const name of ['roundRug','rugEdge','rugFringe','rugFringeLight']) {
    const m=materials[name],edge=name!=='roundRug'
    m.map=source.map;m.color.copy(source.color);m.roughness=source.roughness;m.metalness=source.metalness;m.envMapIntensity=source.envMapIntensity
    m.normalMap=m.bumpMap=m.roughnessMap=m.metalnessMap=null
    m.alphaTest=0;m.transparent=false
    m.userData.cabinSurface={...source.userData.cabinSurface,rect:[...rect]}
    m.userData.artSource='rectangular-rug-original-atlas'
    m.onBeforeCompile=shader=>{
      shader.uniforms.uRugRect={value:new Vector4(...rect)}
      shader.vertexShader='varying vec2 vRugUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvRugUv=uv;')
      shader.fragmentShader=`uniform vec4 uRugRect;
        varying vec2 vRugUv;
        float rugSegment(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0));}
        `+shader.fragmentShader
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>',`#include <map_pars_fragment>
        vec4 rugPaint(vec2 uv){return texture2D(map,uRugRect.xy+uv*uRugRect.zw);}`)
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',edge?`
        diffuseColor*=rugPaint(vec2(.22+vRugUv.x*.56,.78+vRugUv.y*.015));
      `:`
        vec2 p=(vRugUv-.5)*2.0;
        float radius=length(p),aa=max(fwidth(p.x),fwidth(p.y));
        vec4 cloth=rugPaint(vec2(.22)+vRugUv*.56);
        // Roll the original two straight painted borders into concentric circles.
        vec4 border=rugPaint(vec2(.5+.28*sin(atan(p.y,p.x)),.965-(1.0-radius)*.60));
        cloth=mix(cloth,border,smoothstep(.80,.82,radius));
        float starDistance=10.0;
        ${starSegments}
        float starMask=1.0-smoothstep(.009-aa*.6,.009+aa*.6,starDistance);
        // One upright crescent, visually centered inside the central pentagon.
        // Horizontal cut offset keeps the horns vertical; no moons at the tips.
        float moonMask=(1.0-smoothstep(.160-aa,.160+aa,length(p-vec2(.051,0.0))))
          *smoothstep(.150-aa,.150+aa,length(p-vec2(.126,0.0)));
        // Pigment sampled from the rectangular rug's painted inner gold border.
        vec4 gold=rugPaint(vec2(.22+.56*vRugUv.x,.855));
        diffuseColor*=mix(cloth,gold,max(starMask,moonMask));
      `)
    }
    m.customProgramCacheKey=()=>`witchworld-round-large-star-center-moon-v8-${edge?'edge':'surface'}`
    m.needsUpdate=true
  }
}
