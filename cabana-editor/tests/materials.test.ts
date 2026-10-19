import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { inflateSync } from 'node:zlib'
import { MeshPhysicalMaterial, ShaderChunk, ShaderLib, SRGBColorSpace, Texture, UniformsUtils } from 'three'
import { createCabinSurfaceLibrary, PAINTED_ATLAS_PATHS } from '../src/scenes/cabin/cabinSurfaceLibrary.ts'
import { prepareCabinMaterials } from '../src/scenes/cabin/cabinMaterials.ts'
import { createPaintedBatchGeometry } from '../src/scenes/cabin/cabinPaintedUv.ts'
import { buildCabinLayout } from '../src/scenes/cabin/buildCabinLayout.ts'
import { prepareReferenceRug, RUG_STAR_POINTS } from '../src/scenes/cabin/cabinReferenceRug.ts'
import { createHash } from 'node:crypto'

test('painted PNG assets decode into full atlases, with valid nonempty cells', async () => {
  for (const path of PAINTED_ATLAS_PATHS) {
    const bytes = await readFile(new URL(`../public/${path}`, import.meta.url))
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20)
    assert.equal(width,height)
    assert.ok(width >= 1024 && width <= 4096)
    assert.equal(bytes[24],8,'8-bit colour')
    assert.equal(bytes[28],0,'not interlaced')
    const channels = bytes[25] === 2 ? 3 : bytes[25] === 6 ? 4 : 0
    assert.ok(channels > 0,'RGB or RGBA colour artwork')
    const chunks: Buffer[] = []
    for (let offset = 8; offset < bytes.length;) {
      const size = bytes.readUInt32BE(offset), type = bytes.toString('ascii',offset+4,offset+8)
      if (type === 'IDAT') chunks.push(bytes.subarray(offset+8,offset+8+size))
      offset += size+12
    }
    const scanlines = inflateSync(Buffer.concat(chunks))
    assert.equal(scanlines.length,(width*channels+1)*height,'complete PNG pixel payload')
  }
})

test('twenty painted cells share two sRGB albedo textures with separate ownership', () => {
  const wood = new Texture(), surfaces = new Texture(), library = createCabinSurfaceLibrary({wood,surfaces})
  assert.equal(Object.keys(library.surfaces).length,20)
  assert.equal(new Set(Object.values(library.surfaces).map((s)=>s.map)).size,2)
  let disposed = 0
  for (const texture of [wood,surfaces]) {
    assert.equal(texture.colorSpace,SRGBColorSpace)
    texture.addEventListener('dispose',()=>disposed++)
  }
  for (const surface of Object.values(library.surfaces)) {
    const [u,v,w,h] = surface.rect
    assert.ok([u,v,w,h].every(Number.isFinite))
    assert.ok(u>0 && v>0 && w>0 && h>0 && u+w<1 && v+h<1,'atlas padding in bounds')
  }
  library.dispose(); library.dispose()
  assert.equal(disposed,0,'Drei cache owns loaded textures')
  wood.dispose(); surfaces.dispose()
  const headless = createCabinSurfaceLibrary()
  let releases=0
  headless.textures.forEach((t)=>t.addEventListener('dispose',()=>releases++))
  headless.dispose(); headless.dispose()
  assert.equal(releases,2,'test-owned textures release once')
})

test('painted UVs cover every batch without changing positions, indices or instances', () => {
  const layout = buildCabinLayout()
  try {
    for (const batch of layout.batches) {
      const geometry = createPaintedBatchGeometry(batch)
      try {
        assert.deepEqual(geometry.attributes.position.array,batch.g.attributes.position.array)
        assert.deepEqual(geometry.index?.array,batch.g.index?.array)
        for (const key of ['uv','cabinUvX','cabinUvY','cabinUvZ']) {
          const uv = geometry.getAttribute(key)
          assert.equal(uv.count,geometry.attributes.position.count)
          assert.ok(Array.from(uv.array).every((n)=>Number.isFinite(n) && n>=0 && n<=1))
        }
        const crop = geometry.getAttribute('cabinPaintCrop'), axis = geometry.getAttribute('cabinPaintAxis')
        assert.equal(crop.count,batch.matrices.length)
        assert.equal(axis.count,batch.matrices.length)
        for (let i=0;i<crop.count;i++) {
          assert.ok(crop.getX(i)>=0 && crop.getY(i)>=0 && crop.getX(i)+crop.getZ(i)<=1 && crop.getY(i)+crop.getW(i)<=1)
          assert.ok([0,1,2].includes(axis.getX(i)))
        }
      } finally { geometry.dispose() }
    }
  } finally { layout.dispose() }
})

function expand(source: string): string {
  return source.replace(/#include <([\w\d_]+)>/g, (_,key: keyof typeof ShaderChunk)=> {
    assert.equal(typeof ShaderChunk[key],'string',key)
    return expand(ShaderChunk[key])
  })
}

test('all surface materials use painted albedo, matte shading and installed shader chunks', () => {
  const layout = buildCabinLayout(), clock = prepareCabinMaterials(layout.materials)
  try {
    assert.equal(prepareCabinMaterials(layout.materials),clock)
    const maps = new Set<Texture>()
    let painted = 0
    for (const [name,material] of Object.entries(layout.materials)) {
      const source = material instanceof MeshPhysicalMaterial ? ShaderLib.physical : ShaderLib.standard
      const shader = { uniforms: UniformsUtils.clone(source.uniforms), vertexShader: source.vertexShader, fragmentShader: source.fragmentShader }
      material.onBeforeCompile(shader as never,{} as never)
      const vertex = expand(shader.vertexShader), fragment = expand(shader.fragmentShader)
      assert.ok(!vertex.includes('#include') && !fragment.includes('#include'))
      if (material.userData.cabinSurface) {
        painted++
        assert.ok(material.map)
        maps.add(material.map)
        assert.equal(material.bumpMap,null)
        assert.equal(material.normalMap,null)
        assert.equal(material.roughnessMap,null)
        assert.ok(material.roughness>=.79 && material.metalness<=.24)
        assert.ok(vertex.includes('vMapUv = uCabinPaintRect.xy'))
        assert.equal(shader.uniforms.uCabinWood.value,material.userData.cabinSurface.wood?1:0)
        assert.ok(!fragment.includes('cabinGradient') && !fragment.includes('cabinSample('))
        assert.ok(!fragment.includes('uCabinHeight'))
        if (material instanceof MeshPhysicalMaterial) assert.equal(material.clearcoat,0)
      }
      if (name==='potion'||name==='flame') assert.equal(shader.uniforms.uCabinTime,clock)
    }
    assert.equal(painted,39,'original surfaces, isolated bed finishes and a round-rug interior crop')
    assert.equal(maps.size,2)
    assert.ok(layout.materials.crystal.emissiveIntensity<.05)
    assert.ok(layout.materials.potion.emissiveIntensity<.25)
  } finally { clock.dispose(); layout.dispose() }
})

test('round rug preserves the approved painting with an enlarged star and one upright central crescent',()=>{
  const model=buildCabinLayout(),material=model.materials.roundRug,clock=prepareCabinMaterials(model.materials)
  const rectangular=model.materials.rug,map=rectangular.map,program=rectangular.onBeforeCompile
  try{
    prepareReferenceRug(model.materials)
    assert.equal(rectangular.map,map);assert.equal(rectangular.onBeforeCompile,program)
    for(const name of ['roundRug','rugEdge','rugFringe','rugFringeLight']) {
      const m=model.materials[name]
      assert.equal(m.map,map)
      assert.equal(m.color.getHex(),rectangular.color.getHex())
      assert.equal(m.roughness,rectangular.roughness);assert.equal(m.metalness,rectangular.metalness)
      assert.deepEqual(m.userData.cabinSurface.rect,rectangular.userData.cabinSurface.rect)
      assert.equal(m.alphaTest,0);assert.equal(m.transparent,false)
      const shader={uniforms:UniformsUtils.clone(ShaderLib.standard.uniforms),vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader}
      m.onBeforeCompile(shader as any,{} as any)
      const fragment=expand(shader.fragmentShader)
      assert.ok(fragment.indexOf('uniform sampler2D map')<fragment.indexOf('vec4 rugPaint'))
      assert.ok(fragment.includes('diffuseColor'))
      assert.ok(!fragment.includes('clothPigment'),'no hue correction or alternate generated rug texture')
      if(name==='roundRug') {
        assert.equal((fragment.match(/starDistance=min/g)||[]).length,5)
        assert.equal((fragment.match(/float moonMask=/g)||[]).length,1)
        assert.ok(!fragment.includes('moonMask=max'))
        assert.ok(fragment.includes('p-vec2(.051,0.0)')&&fragment.includes('p-vec2(.126,0.0)'),'crescent cut is horizontal, so horns are vertical')
      }
    }
    assert.equal(RUG_STAR_POINTS.length,5)
    for(const {tip} of RUG_STAR_POINTS){
      assert.ok(Math.abs(Math.hypot(...tip)-.74)<1e-10,'star is enlarged from the previous .55 radius')
      assert.ok(Math.hypot(...tip)+.009<.80,'star clears the original circular border')
    }
    assert.ok(.051+.160<.74*Math.cos(2*Math.PI/5)-.009,'central crescent clears the inner pentagon lines')
    const batch=model.batches.find(b=>b.m.name==='roundRug')!,uv=batch.g.attributes.uv
    assert.ok(Array.from(uv.array).every(n=>n>=0&&n<=1));assert.equal(batch.g.name,'violet-woven-rug-surface')
  }finally{clock.dispose();model.dispose()}
})
