import test from 'node:test'
import assert from 'node:assert/strict'
import { createBannerCrescent, createBedQuilt, createBedTurnover, quiltHeight } from '../src/scenes/cabin/cabinTextiles.ts'

test('quilt clears the mattress; soft edge drapes and turnover never intersect', () => {
  const quilt=createBedQuilt(), fold=createBedTurnover()
  try {
    for (let x=-.84;x<=.84;x+=.04) for(let z=-1.07;z<=.85;z+=.04) assert.ok(quiltHeight(x,z)>.615)
    assert.ok(quiltHeight(1.09,0)<quiltHeight(.8,0)-.15)
    for(let i=0;i<fold.attributes.position.count;i++) {
      const p=fold.attributes.position
      assert.ok(p.getY(i)-quiltHeight(p.getX(i),p.getZ(i)-.70)>.018,'fold must stay above quilt')
    }
    for(const g of [quilt,fold]) {
      for(const a of Object.values(g.attributes)) assert.ok(Array.from(a.array).every(Number.isFinite))
      assert.ok(Array.from(g.attributes.normal.array).filter((_,i)=>i%3===1).some(n=>n>.9))
    }
  } finally {quilt.dispose();fold.dispose()}
})

test('banner crescent has symmetric tapered tips and a real open concavity', () => {
  const g=createBannerCrescent()
  try {
    const p=g.attributes.position
    g.computeBoundingBox()
    const b=g.boundingBox!
    assert.ok(Math.abs(b.max.y+b.min.y)<1e-6)
    assert.ok(b.min.x<-.185 && b.max.x<.10 && b.max.x>.05)
    // No triangle may fill the opening at x=.13, y=0.
    const point=[.13,0]
    const area=(a:number[],b:number[],c:number[]) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    const count=g.index?.count ?? p.count
    for(let i=0;i<count;i+=3) {
      const v=[0,1,2].map(j=>{const n=g.index?.getX(i+j)??i+j;return [p.getX(n),p.getY(n)]})
      const signs=[area(v[0],v[1],point),area(v[1],v[2],point),area(v[2],v[0],point)]
      assert.ok(!(signs.every(n=>n>=0)||signs.every(n=>n<=0)),'crescent opening must remain empty')
      assert.ok(area(v[0],v[1],v[2])>0,'front-facing clean triangles')
    }
  } finally {g.dispose()}
})
