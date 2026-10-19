import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { createRugBacking, createRugSurface, createRugTassel, rugClothHeight, rugRadius } from '../src/scenes/cabin/cabinRugGeometry.ts'

test('rug has a thin outward-facing flexible edge and continuous cloth',()=>{
  const backing=createRugBacking(),surface=createRugSurface()
  try{
    backing.computeBoundingBox();surface.computeBoundingBox();
    assert.ok(backing.boundingBox!.max.y-backing.boundingBox!.min.y<.022,'textile edge cannot read as a thick disc')
    const bp=backing.attributes.position,bn=backing.attributes.normal
    for(let i=0;i<bp.count;i++)assert.ok(bp.getX(i)*bn.getX(i)+bp.getZ(i)*bn.getZ(i)>0,'backing faces outward')
    for(const g of[backing,surface])for(const a of Object.values(g.attributes))assert.ok(Array.from(a.array).every(Number.isFinite))
    assert.ok(new Vector3().fromBufferAttribute(surface.attributes.normal,0).y>.99)
  }finally{backing.dispose();surface.dispose()}
})


test('all modeled fringe strands clear the plank surface at default and approved rug scales',()=>{
  const g=createRugTassel(),p=g.attributes.position
  for(let i=0;i<p.count;i++)assert.ok(g.attributes.normal.getY(i)>.99,'fringe has an upward textile face, without dark cylindrical side facets')
  try{
    for(const scale of[1,1.3048819091105484])for(let i=0;i<64;i++){
      const a=i*Math.PI*2/64,r=rugRadius(Math.PI/2-a)-.006
      const attachment=rugClothHeight(Math.sin(a)*r,Math.cos(a)*r)+.001
      for(let v=0;v<p.count;v++)assert.ok((attachment+p.getY(v))*scale>.028,`fringe ${i} vertex ${v} clears floor at scale ${scale}`)
    }
    for(const x of[-.885,-.735])assert.ok(rugClothHeight(x,.115-.36)>.0315,'cloth covers nearby floor peg heads')
  }finally{g.dispose()}
})
