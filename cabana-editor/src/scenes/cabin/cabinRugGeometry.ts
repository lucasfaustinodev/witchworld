import { BufferGeometry, Float32BufferAttribute } from 'three'

/** A real woven surface with a softly irregular circular outline, gentle cloth relief,
 * and one continuous UV island. Its border never bends or stretches the motif. */
export function rugRadius(a:number,r=1.61){return r*(1+.0016*Math.sin(a*5)+.001*Math.sin(a*11))}
export function rugClothHeight(x:number,z:number) {
  const t=Math.min(1,Math.hypot(x,z)/1.61),a=Math.atan2(z,x)
  return .034+.0015*Math.sin(x*2.4+z*.8)*Math.cos(z*2.1)+.004*Math.pow(t,6)*(.5+.5*Math.sin(a*7+.7))
}
export function createRugSurface(radius=1.61,segments=96,rings=7) {
  const positions=[0,rugClothHeight(0,0),0],uv=[.5,.5],indices:number[]=[]
  for(let ring=1;ring<=rings;ring++)for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,t=ring/rings,r=rugRadius(a,radius)*t,x=Math.cos(a)*r,z=Math.sin(a)*r
    positions.push(x,rugClothHeight(x,z),z)
    uv.push(.5+x/(2*radius*1.003),.5-z/(2*radius*1.003))
  }
  for(let i=0;i<segments;i++)indices.push(0,1+i+1,1+i)
  for(let ring=1;ring<rings;ring++)for(let i=0;i<segments;i++){
    const a=1+(ring-1)*(segments+1)+i,b=a+segments+1
    indices.push(a,b+1,b,a,a+1,b+1)
  }
  const g=new BufferGeometry();g.name='violet-woven-rug-surface'
  g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals()
  return g
}

/** Thin flexible backing follows the cloth edge, rather than a rigid cylinder. */
export function createRugBacking() {
  const p:number[]=[],uv:number[]=[],ix:number[]=[],segments=96
  for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,r=rugRadius(a),x=Math.cos(a)*r,z=Math.sin(a)*r
    p.push(x,rugClothHeight(x,z)-.0005,z,x,.019,z);uv.push(i/segments,1,i/segments,0)
  }
  for(let i=0;i<segments;i++){const a=i*2;ix.push(a,a+3,a+1,a,a+2,a+3)}
  const g=new BufferGeometry();g.name='flexible-textile-backing'
  g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g
}

/** Flat woven fringe strips have the same upward-facing textile surface as
 * the rug; tiny cylindrical side faces previously produced a dark dotted rim. */
export function createRugTassel() {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[]
  for(let strand=0;strand<3;strand++){
    const x=(strand-1)*.020,length=.070+(strand%2)*.008,start=positions.length/3
    for(let section=0;section<3;section++){
      const t=section/2,width=section===1?.018:.014
      for(const side of[-1,1]){
        positions.push(x*(1+t*.12)+side*width/2,-.0005*t,length*t)
        uv.push(side<0?0:1,t)
      }
    }
    for(let section=0;section<2;section++){
      const a=start+section*2
      indices.push(a,a+2,a+1,a+1,a+2,a+3)
    }
  }
  const g=new BufferGeometry();g.name='woven-rug-flat-fringe'
  g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g
}
