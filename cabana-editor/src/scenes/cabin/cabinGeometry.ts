import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'

/** A shared 44-triangle joinery block. The bevel catches light instead of relying on painted edges. */
export function createJoineryBlock(bevel = 0.035) {
  const b = Math.max(0.005, Math.min(0.12, bevel)), c = 0.5 - b
  const positions: number[] = [], normals: number[] = [], uvs: number[] = []
  function polygon(points: number[][]) {
    const a = new Vector3(...points[0] as [number, number, number])
    const n = new Vector3(...points[1] as [number, number, number]).sub(a)
      .cross(new Vector3(...points[2] as [number, number, number]).sub(a)).normalize()
    const centre = new Vector3()
    for (const p of points) centre.add(new Vector3(...p as [number, number, number]))
    if (n.dot(centre) < 0) { points = [...points].reverse(); n.negate() }
    for (let i = 1; i < points.length - 1; i++) for (const p of [points[0], points[i], points[i + 1]]) {
      positions.push(...p); normals.push(n.x, n.y, n.z)
      const axis = Math.abs(n.x) >= Math.abs(n.y) && Math.abs(n.x) >= Math.abs(n.z) ? 0 : Math.abs(n.y) >= Math.abs(n.z) ? 1 : 2
      uvs.push(p[axis === 0 ? 2 : 0] + .5, p[axis === 1 ? 2 : 1] + .5)
    }
  }
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const other = [0, 1, 2].filter((v) => v !== axis)
    polygon([[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v]) => {
      const p = [0,0,0]; p[axis] = sign * .5; p[other[0]] = u*c; p[other[1]] = v*c; return p
    }))
  }
  for (let along = 0; along < 3; along++) for (const sa of [-1,1]) for (const sb of [-1,1]) {
    const [a,b] = [0,1,2].filter((v) => v !== along)
    polygon([[-c,.5,c],[c,.5,c],[c,c,.5],[-c,c,.5]].map(([length,u,v]) => {
      const p=[0,0,0];p[along]=length;p[a]=sa*u;p[b]=sb*v;return p
    }))
  }
  for (const x of [-1,1]) for (const y of [-1,1]) for (const z of [-1,1])
    polygon([[x*.5,y*c,z*c],[x*c,y*.5,z*c],[x*c,y*c,z*.5]])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions,3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals,3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs,2))
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

/** Blunted masonry with uneven corners. Bounds stay within the same unit collision box. */
export function createHewnStone(variant = 0) {
  const geometry = createJoineryBlock(.095)
  const p = geometry.attributes.position
  for (let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i)
    const wave=.965+.028*Math.sin(x*7.1+y*9.4+z*5.7+variant*2.3)
    p.setXYZ(i,x*wave,y*(.97+.018*Math.sin(x*8+z*6+variant)),z*wave)
  }
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}
