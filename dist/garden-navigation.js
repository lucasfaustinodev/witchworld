import * as THREE from './vendor/three.module.js';

// The physical witch alone owns this world. Rendering, ritual and astral travel
// keep their existing controllers. All collision data is authored with the scene.
let rapierReady;
export async function createGardenNavigation({surfaces,obstacles,outline,waterOutline=[],start,flatFloor=false}) {
  const {default:R}=await import('./vendor/rapier/rapier.mjs');
  // Both environments share the loaded WASM module, not their collision worlds.
  rapierReady??=R.init();await rapierReady;
  const world=new R.World({x:0,y:-9.81,z:0});
  try {
  const floorHandles=new Set(),obstacleHandles=new Set(),bridgeHandles=new Set();
  let colliderCount=0,groundTriangles=0;
  const point=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),edge=new THREE.Vector3(),normal=new THREE.Vector3();
  const q=new THREE.Quaternion(),euler=new THREE.Euler();
  function register(desc,ground=false,bridge=false){
    const collider=world.createCollider(desc.setFriction(.85));colliderCount++;
    (ground?floorHandles:obstacleHandles).add(collider.handle);
    if(bridge)bridgeHandles.add(collider.handle);return collider;
  }
  // Full static meshes are cooked once; never inspect decorative leaves per frame.
  for(const mesh of surfaces){
    mesh.updateWorldMatrix(true,false);const geometry=mesh.geometry,positions=geometry.attributes.position;
    const count=geometry.index?.count??positions.count,vertices=[],indices=[];
    for(let i=0;i<count;i+=3){
      a.fromBufferAttribute(positions,geometry.index?geometry.index.getX(i):i).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(positions,geometry.index?geometry.index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(positions,geometry.index?geometry.index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
      normal.crossVectors(edge.copy(b).sub(a),point.copy(c).sub(a));
      // Only support surfaces: vertical island sides must not snag on the bevel.
      if(normal.y<=0||normal.y/normal.length()<.70)continue;
      const n=vertices.length/3;vertices.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);indices.push(n,n+1,n+2);
    }
    if(indices.length){register(R.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(indices),R.TriMeshFlags.MERGE_DUPLICATE_VERTICES|R.TriMeshFlags.FIX_INTERNAL_EDGES),true);groundTriangles+=indices.length/3;}
  }
  const deckBounds=new THREE.Box3(),deckBox=new THREE.Box3(),deckMatrix=new THREE.Matrix4(),deckPosition=new THREE.Vector3(),unitScale=new THREE.Vector3(1,1,1);
  let deckTop=0,deckPlanks=0;
  for(const o of obstacles){
    let desc;
    if(o.kind==='cylinder')desc=R.ColliderDesc.cylinder(o.height/2,o.radius);
    else desc=R.ColliderDesc.cuboid(o.size[0]/2,o.size[1]/2,o.size[2]/2);
    if(o.rotation){q.setFromEuler(euler.set(...o.rotation));desc.setRotation(q);}
    register(desc.setTranslation(...o.position),!!o.ground,!!o.bridge);
    if(o.bridge){
      deckTop+=o.position[1]+o.size[1]/2;deckPlanks++;
      deckBox.min.set(-o.size[0]/2,-o.size[1]/2,-o.size[2]/2);deckBox.max.copy(deckBox.min).negate();
      q.setFromEuler(euler.set(...(o.rotation??[0,0,0])));deckMatrix.compose(deckPosition.set(...o.position),q,unitScale);deckBounds.union(deckBox.applyMatrix4(deckMatrix));
    }
  }
  // A boot spans the narrow visual seams. The structural deck collider fills
  // those seams, strictly within the existing wooden footprint, never the pond.
  if(deckPlanks){const size=deckBounds.getSize(point),at=deckBounds.getCenter(a);register(R.ColliderDesc.cuboid(size.x/2,.035,size.z/2).setTranslation(at.x,deckTop/deckPlanks-.035,at.z),true,true);}
  function inside(x,z,polygon){let odd=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [ax,az]=polygon[i],[bx,bz]=polygon[j];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)odd=!odd;
  }return odd;}
  const bridgeBounds={minX:deckBounds.min.x,maxX:deckBounds.max.x,minZ:deckBounds.min.z,maxZ:deckBounds.max.z};
  const onBridge=(x,z)=>x>=bridgeBounds.minX&&x<=bridgeBounds.maxX&&z>=bridgeBounds.minZ&&z<=bridgeBounds.maxZ;
  // Invisible edge guards follow the approved land/water outlines. The wooden
  // deck remains a real support surface, not an invisible walkway over the pond.
  function guardPolygon(polygon,water){for(let i=0;i<polygon.length;i++){
    const p=polygon[i],next=polygon[(i+1)%polygon.length],dx=next[0]-p[0],dz=next[1]-p[1],length=Math.hypot(dx,dz),cuts=[0,1];
    // Split only at the deck's four edges, rather than hundreds of short walls.
    for(const [d,origin,limits] of [[dx,p[0],[bridgeBounds.minX,bridgeBounds.maxX]],[dz,p[1],[bridgeBounds.minZ,bridgeBounds.maxZ]]]){
      if(Math.abs(d)<1e-8)continue;for(const limit of limits){const t=(limit-origin)/d;if(t>0&&t<1)cuts.push(t);}
    }
    cuts.sort((a,b)=>a-b);
    for(let j=1;j<cuts.length;j++){
      const u=(cuts[j-1]+cuts[j])/2,x=p[0]+dx*u,z=p[1]+dz*u;
      if(onBridge(x,z))continue;
      if(water&&!inside(x-.015,z,outline)&&!inside(x+.015,z,outline))continue;
      q.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(dx,dz));
      register(R.ColliderDesc.cuboid(.025,1.2,length*(cuts[j]-cuts[j-1])*.5+.004).setTranslation(x,1.05,z).setRotation(q));
    }
  }}
  guardPolygon(outline,false);guardPolygon(waterOutline,true);
  const radius=.31,halfHeight=.42,baseOffset=radius+halfHeight;
  const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x,start.y+baseOffset,start.z));
  const player=world.createCollider(R.ColliderDesc.capsule(halfHeight,radius),body);
  const controller=world.createCharacterController(.010);
  controller.setSlideEnabled(true);controller.enableAutostep(.19,.17,false);
  controller.enableSnapToGround(.23);controller.setMaxSlopeClimbAngle(Math.PI*.22);controller.setMinSlopeSlideAngle(Math.PI*.25);
  controller.setApplyImpulsesToDynamicBodies(false);
  const ray=new R.Ray({x:0,y:0,z:0},{x:0,y:-1,z:0});
  const groundFilter=collider=>floorHandles.has(collider.handle),solidFilter=collider=>obstacleHandles.has(collider.handle);
  const desired={x:0,y:0,z:0},next={x:0,y:0,z:0},movement={x:0,y:0,z:0};
  const collision=new R.CharacterCollision(),footShape=new R.Ball(.070),identity={x:0,y:0,z:0,w:1},footOrigin={x:0,y:0,z:0},footDelta={x:0,y:0,z:0};
  const sample={height:0,normal:new THREE.Vector3(0,1,0),valid:false};
  let verticalVelocity=0,lastX=start.x,lastZ=start.z,grounded=true,calls=0,cpuTotal=0,cpuMax=0,rejected=0;
  world.timestep=1/60;world.step();
  function sampleGround(x,z,referenceY,out=sample){
    ray.origin.x=x;ray.origin.z=z;ray.origin.y=referenceY+.42;
    const hit=world.castRayAndGetNormal(ray,1.15,true,undefined,undefined,player,body,groundFilter);
    out.valid=!!hit&&hit.normal.y>.65;
    if(out.valid&&!bridgeHandles.has(hit.collider.handle))out.valid=inside(x,z,outline)&&!inside(x,z,waterOutline);
    if(out.valid){out.height=ray.origin.y-hit.timeOfImpact;out.normal.set(hit.normal.x,hit.normal.y,hit.normal.z).normalize();}
    else {out.height=referenceY-.010;out.normal.set(0,1,0);}
    return out;
  }
  function sync(position){
    body.setTranslation({x:position.x,y:position.y+baseOffset,z:position.z},true);
    world.propagateModifiedBodyPositionsToColliders();verticalVelocity=0;lastX=position.x;lastZ=position.z;
  }
  function move(position,delta,velocity,dt){
    if(dt<=0)return;const begin=performance.now();
    // Ritual/Veil restore their own positions while locked. A displaced actor
    // resynchronizes here; ordinary smoothing never teleports the physical capsule.
    if(Math.hypot(position.x-lastX,position.z-lastZ)>.10)sync(position);
    const steps=Math.max(1,Math.ceil(dt/(1/60))),step=dt/steps;
    for(let s=0;s<steps;s++){
      verticalVelocity=grounded?-.18:Math.max(-4,verticalVelocity-9.81*step);
      // The cabin is a single known horizontal floor. No artificial downward
      // drift into it; preserve the garden's slope/step/gravity configuration.
      desired.x=delta.x/steps;desired.z=delta.z/steps;desired.y=flatFloor?0:verticalVelocity*step;
      controller.computeColliderMovement(player,desired);
      controller.computedMovement(movement);const p=body.translation();
      next.x=p.x+movement.x;next.y=p.y+movement.y;next.z=p.z+movement.z;
      sampleGround(next.x,next.z,next.y-baseOffset,sample);
      if(!sample.valid){next.x=p.x;next.z=p.z;next.y=p.y;velocity.x=velocity.z=0;rejected++;}
      grounded=controller.computedGrounded();if(grounded)verticalVelocity=0;
      // Remove only inward velocity, retaining tangential motion along walls.
      for(let i=0;i<controller.numComputedCollisions();i++){
        const hit=controller.computedCollision(i,collision);if(!hit||floorHandles.has(hit.collider.handle)||Math.abs(hit.normal1.y)>.65)continue;
        const dot=velocity.x*hit.normal1.x+velocity.z*hit.normal1.z;
        if(dot<0){velocity.x-=hit.normal1.x*dot;velocity.z-=hit.normal1.z*dot;}
      }
      body.setNextKinematicTranslation(next);world.timestep=step;world.step();
    }
    const p=body.translation();position.x=p.x;position.z=p.z;
    const targetY=p.y-baseOffset;position.y+= (targetY-position.y)*(1-Math.exp(-24*dt));
    lastX=position.x;lastZ=position.z;calls++;const cost=performance.now()-begin;cpuTotal+=cost;cpuMax=Math.max(cpuMax,cost);
  }
  function constrainFoot(from,to,referenceY){
    footOrigin.x=from.x;footOrigin.y=referenceY+.14;footOrigin.z=from.z;
    footDelta.x=to.x-from.x;footDelta.y=0;footDelta.z=to.z-from.z;
    const hit=world.castShape(footOrigin,identity,footDelta,footShape,.010,1,true,undefined,undefined,player,body,solidFilter);
    if(hit){const u=Math.max(0,hit.time_of_impact-.02);to.x=from.x+footDelta.x*u;to.z=from.z+footDelta.z*u;}
    return to;
  }
  function snapshot(){return {engine:'Rapier',version:'0.21.0',radius,colliders:colliderCount+1,groundTriangles,grounded,rejected,movementCalls:calls,meanCpuMs:calls?cpuTotal/calls:0,maxCpuMs:cpuMax,additionalDrawCalls:0,additionalLights:0,additionalRenderPasses:0};}
  function dispose(){world.removeCharacterController(controller);world.free();}
  return {move,sync,sampleGround,constrainFoot,snapshot,dispose};
  }catch(error){world.free();throw error;}
}
