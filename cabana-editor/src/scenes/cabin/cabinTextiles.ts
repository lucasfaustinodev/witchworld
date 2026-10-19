import { PlaneGeometry, Shape, ShapeGeometry } from 'three'

const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
/** Mattress top is .605. Broad shallow folds stay above it, then drape at the edges. */
export function quiltHeight(x:number,z:number) {
  return .642-.24*smooth(.84,1.09,Math.abs(x))-.15*smooth(.89,1.07,z)
    +.005*Math.sin(x*3.8+z*.7)+.003*Math.cos(z*3.2)
}
function upward(g:PlaneGeometry) {
  const ix=g.index!
  for(let i=0;i<ix.count;i+=3){const a=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,a)}
  g.computeVertexNormals();return g
}
export function createBedQuilt() {
  const g=new PlaneGeometry(2.18,2.14,32,24),p=g.attributes.position
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,quiltHeight(x,z),z)}
  return upward(g)
}
export function createBedTurnover() {
  const g=new PlaneGeometry(2.16,.35,24,6),p=g.attributes.position
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getY(i),t=(z+.175)/.35
    p.setXYZ(i,x,quiltHeight(x,z-.70)+.026+.012*Math.sin(Math.PI*t),z)
  }
  return upward(g)
}
/** Two intersecting circular arcs, with shared exact tips and an open inner arc. */
export function createBannerCrescent() {
  const r=.19, inner=.175, offset=.09, x=(r*r-inner*inner+offset*offset)/(2*offset)
  const y=Math.sqrt(r*r-x*x), outerAngle=Math.atan2(y,x), innerAngle=Math.atan2(y,x-offset)
  const shape=new Shape()
  shape.absarc(0,0,r,outerAngle,Math.PI*2-outerAngle,false)
  shape.absarc(offset,0,inner,-innerAngle,innerAngle,true)
  shape.closePath()
  // Arc endpoints coincide mathematically; remove their floating point duplicates
  // before triangulation so the tips do not contain zero-area triangles.
  const points=shape.getPoints(40).filter((p,i,all)=>i===0||p.distanceTo(all[i-1])>1e-7)
  if(points[0].distanceTo(points.at(-1)!)<1e-7)points.pop()
  return new ShapeGeometry(new Shape(points),40)
}
