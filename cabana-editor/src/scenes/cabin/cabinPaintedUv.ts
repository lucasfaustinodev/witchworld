import { Float32BufferAttribute, InstancedBufferAttribute, Vector3 } from 'three'
import type { CabinBatch } from './buildCabinLayout.ts'

/** UV unwrap only: all positions, normals, triangles, instances and layout stay unchanged. */
export function createPaintedBatchGeometry(batch: CabinBatch,sourceIndices=batch.matrices.map((_,i)=>i)) {
  if(batch.uvMode==='authored')return batch.g.clone()
  const geometry = batch.g.clone(), position = geometry.attributes.position, normal = geometry.attributes.normal
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox!, dimensions = bounds.getSize(new Vector3())
  const xUV: number[] = [], yUV: number[] = [], zUV: number[] = [], fallback: number[] = []
  const unit = (value: number, min: number, span: number) => span > .00001 ? (value - min) / span : .5
  for (let i = 0; i < position.count; i++) {
    const x = unit(position.getX(i), bounds.min.x, dimensions.x), y = unit(position.getY(i), bounds.min.y, dimensions.y), z = unit(position.getZ(i), bounds.min.z, dimensions.z)
    const n = [Math.abs(normal.getX(i)), Math.abs(normal.getY(i)), Math.abs(normal.getZ(i))], face = n.indexOf(Math.max(...n))
    xUV.push(face === 1 ? z : y, face === 0 ? z : x)
    yUV.push(face === 0 ? z : x, face === 1 ? z : y)
    zUV.push(face === 0 ? y : x, face === 2 ? y : z)
    fallback.push(x, y)
  }
  if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new Float32BufferAttribute(fallback, 2))
  else {
    // Shape/Extrude UVs may use model units; atlas coordinates need a finite 0–1 island.
    const uv = geometry.getAttribute('uv')
    let minU=Infinity,minV=Infinity,maxU=-Infinity,maxV=-Infinity
    for (let i=0;i<uv.count;i++) { minU=Math.min(minU,uv.getX(i)); maxU=Math.max(maxU,uv.getX(i)); minV=Math.min(minV,uv.getY(i)); maxV=Math.max(maxV,uv.getY(i)) }
    if (minU<0||minV<0||maxU>1||maxV>1) for (let i=0;i<uv.count;i++) uv.setXY(i,unit(uv.getX(i),minU,maxU-minU),unit(uv.getY(i),minV,maxV-minV))
  }
  geometry.setAttribute('cabinUvX', new Float32BufferAttribute(xUV, 2))
  geometry.setAttribute('cabinUvY', new Float32BufferAttribute(yUV, 2))
  geometry.setAttribute('cabinUvZ', new Float32BufferAttribute(zUV, 2))
  const crops: number[] = [], axes: number[] = []
  const wood = ['wood','plank','plankLight','beam','wall','bark'].includes(batch.m.name)
  sourceIndices.forEach(index => {
    const matrix=batch.matrices[index]
    const e = matrix.elements,paintIndex=batch.paintIndices?.[index]??index
    const lengths = [Math.hypot(e[0],e[1],e[2])*dimensions.x, Math.hypot(e[4],e[5],e[6])*dimensions.y, Math.hypot(e[8],e[9],e[10])*dimensions.z]
    axes.push(lengths.indexOf(Math.max(...lengths)))
    // Curated crops of painted grain, without procedural surface synthesis or tiling.
    if (wood) {
      const variant = (paintIndex * 5 + Math.round(Math.abs(e[12]*13+e[14]*7))) % 8, width = .22 + (variant % 3) * .035
      crops.push((variant / 7) * (1-width), (variant % 3)*.035, width, .90)
    } else crops.push(0,0,1,1)
  })
  geometry.setAttribute('cabinPaintCrop', new InstancedBufferAttribute(new Float32Array(crops), 4))
  geometry.setAttribute('cabinPaintAxis', new InstancedBufferAttribute(new Float32Array(axes), 1))
  return geometry
}
