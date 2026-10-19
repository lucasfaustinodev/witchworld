import { Matrix4, Vector3 } from 'three'
import type { CabinBatch, Vec3 } from './buildCabinLayout.ts'

export function fixtureModel(id:string) {
  if(/^lamp-entry-(left|right)$/.test(id))return 'CandleStick_Stand'
  if(/^lamp-(library|study|hearth)$/.test(id))return 'Chandelier'
  return null
}

// Wick positions measured from the pack's authored geometry (glTF metres).
// Flame bases meet the wick; no imported texture or mesh is redrawn.
const wicks:Record<string,Vec3[]>={
  Chandelier:[[-.57742,-.91669,-.00027],[-.4048,-.91669,.41487],[-.00127,-.94295,.57424],[.40179,-.96913,.40829],[.57857,-.91669,.0053],[.40613,-.91669,-.40781],[-.0018,-.94295,-.56832],[-.409,-.96913,-.408]],
  CandleStick_Stand:[[-.31675,1.29887,-.00018],[-.22177,1.29499,.22818],[-.00064,1.27876,.31487],[.22003,1.26236,.22404],[.31774,1.29499,.00346],[.22284,1.29487,-.22372],[-.001,1.27876,-.31102],[-.22443,1.26236,-.22382]],
}
export function fixtureTransform(model:string,pivot:Vec3) {
  // Preserve proportions. The chandelier mount stays at the old lamp's top;
  // entrance candelabra now include the pack's complete base on the floor.
  // Retain the original editor pivot and imported layouts' height offsets.
  const scale=model==='Chandelier'?.76:1
  const y=model==='Chandelier'?pivot[1]+.42-.0359170437*scale:pivot[1]-1.38+.035+.0079470528*scale
  return new Matrix4().makeTranslation(pivot[0],y,pivot[2]).multiply(new Matrix4().makeScale(scale,scale,scale))
}
export function fixtureFlames(model:string,matrix:Matrix4) {
  const scale=new Vector3().setFromMatrixScale(matrix).x
  return wicks[model].map(p=>new Vector3(...p).applyMatrix4(matrix).add(new Vector3(0,.040*scale,0)))
}

export interface CandleLightSource {id:string;position:Vec3;power:number;distance:number}
/** One local emitter per candle object/fixture. Multiple flames on a chandelier
 * share their centroid emitter, rather than allocating eight shader lights. */
export function candleLightSources(batches:readonly CabinBatch[]):CandleLightSource[] {
  const groups=new Map<string,Vector3[]>()
  for(const batch of batches)if(batch.m.name==='flame')batch.ownerIds.forEach((id,i)=>{
    if(!id)return
    if(!groups.has(id))groups.set(id,[])
    groups.get(id)!.push(new Vector3().setFromMatrixPosition(batch.matrices[i]))
  })
  return [...groups].map(([id,positions])=>({id,position:positions.reduce((sum,p)=>sum.add(p),new Vector3()).divideScalar(positions.length).toArray() as Vec3,
    power:id.startsWith('lamp-')?Math.min(8,3+positions.length*.6):1.7,distance:id.startsWith('lamp-')?3.5:1.9}))
}
