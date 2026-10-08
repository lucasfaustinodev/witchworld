import * as THREE from './vendor/three.module.js';
import {createAbsentGarden} from './scrying-vision.js';

export const SCRY_STATES=Object.freeze(['SCRY_IDLE','SCRY_FOCUS','SCRY_OPENING','SCRY_VISION','SCRY_CLOSING']);
// One contextual interaction and one pooled offscreen view. Never drives the ritual.
export function createScryingPond({scene,renderer,witch,waterMesh,waterMaterial,isRitualInactive,resolution=512}){
 const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),clamp=THREE.MathUtils.clamp;
 const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
 const bank=V(2.55,.255,1.15),lake=V(4.8,-.23,2.25),originalDepthWrite=waterMaterial.depthWrite;
 let state='SCRY_IDLE',elapsed=0,clock=0,total=0,calm=0,amount=0,reveal=0,deep=0,closing=0,closeFrom=null;

 let target=null,lastCapture=-Infinity,captures=0,lastCalls=0,lastTriangles=0;
 const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,80);camera.position.set(10,14,20);camera.lookAt(0,1.05,0);camera.updateMatrixWorld(true);camera.layers.set(12);
 // Geometry is the only coverage mask. A tiny shoreline-distance lookup follows
 // the actual sampled outline; it softens the bank, never defines an inner window.
 // The scene below is fitted with uniform geometry scale and an affine projection.
 // No inner card or frame-cache image asset.
 waterMesh.updateMatrixWorld(true);const waterBounds=new THREE.Box3().setFromObject(waterMesh),waterSpan=waterBounds.getSize(V()),waterCenter=waterBounds.getCenter(V());waterCenter.y=waterBounds.max.y;
 const outline=waterMesh.geometry.parameters.shapes.getPoints(24).map(p=>V(p.x,0,-p.y).applyMatrix4(waterMesh.matrixWorld));
 const shoreWidth=96,shoreHeight=256,shoreData=new Uint8Array(shoreWidth*shoreHeight);
 for(let y=0;y<shoreHeight;y++)for(let x=0;x<shoreWidth;x++){
  const px=waterBounds.min.x+(x+.5)/shoreWidth*waterSpan.x,pz=waterBounds.min.z+(y+.5)/shoreHeight*waterSpan.z;let nearest=Infinity;
  for(let i=0;i<outline.length-1;i++){const a=outline[i],b=outline[i+1],dx=b.x-a.x,dz=b.z-a.z,u=clamp(((px-a.x)*dx+(pz-a.z)*dz)/(dx*dx+dz*dz||1),0,1);nearest=Math.min(nearest,Math.hypot(px-a.x-dx*u,pz-a.z-dz*u));}
  shoreData[y*shoreWidth+x]=Math.round(clamp(nearest/.50,0,1)*255);
 }
 const shoreline=new THREE.DataTexture(shoreData,shoreWidth,shoreHeight,THREE.RedFormat);shoreline.minFilter=shoreline.magFilter=THREE.LinearFilter;shoreline.generateMipmaps=false;shoreline.needsUpdate=true;
 // One affine projection, matched to the fixed main view. Scene geometry is
 // uniformly scaled in the vision group; no per-row stretching of its image.
 const points=outline.map(p=>p.clone().setY(waterBounds.max.y).applyMatrix4(camera.matrixWorldInverse));
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const viewWidth=maxX-minX,viewHeight=maxY-minY,fit=Math.min(resolution/viewWidth,resolution/viewHeight);
 const captureWidth=Math.round(viewWidth*fit),captureHeight=Math.round(viewHeight*fit),captureX=Math.floor((resolution-captureWidth)/2),captureY=Math.floor((resolution-captureHeight)/2);
 camera.left=minX;camera.right=maxX;camera.bottom=minY;camera.top=maxY;camera.updateProjectionMatrix();
 const projectionInfo={uniformScale:true,aspect:viewWidth/viewHeight,captureViewport:[captureX,captureY,captureWidth,captureHeight],viewBounds:[minX,minY,viewWidth,viewHeight]};
 const visionFog=new THREE.FogExp2('#1c1532',.008),visionBackground=new THREE.Color('#090711');
 const uniforms={scryCaptureUV:{value:new THREE.Vector4(captureX/resolution,captureY/resolution,captureWidth/resolution,captureHeight/resolution)},scryProjection:{value:camera.matrixWorldInverse},scryViewBounds:{value:new THREE.Vector4(minX,minY,viewWidth,viewHeight)},scryTime:{value:0},scryCalm:{value:0},scryAmount:{value:0},scryReveal:{value:0},scryDeep:{value:0},scryClosing:{value:0},scryTexture:{value:null},scryShore:{value:shoreline},scryBounds:{value:new THREE.Vector4(waterBounds.min.x,waterBounds.min.z,waterSpan.x,waterSpan.z)},scryCenter:{value:waterCenter},scrySubmerge:{value:0}};
 // Existing 24 water-highlight strips share one material. Fade their alpha on
 // GPU with the same calm curve; ordinary exploration keeps the exact shader result.
 const rippleMesh=scene.children.find(o=>o.isInstancedMesh&&o.material?.transparent&&o.material.color?.getHex()===0x638294),rippleMaterial=rippleMesh?.material;
 const rippleCompile=rippleMaterial?.onBeforeCompile,rippleKey=rippleMaterial?.customProgramCacheKey();
 if(rippleMaterial){rippleMaterial.onBeforeCompile=shader=>{rippleCompile.call(rippleMaterial,shader);shader.uniforms.scryCalm=uniforms.scryCalm;shader.fragmentShader='uniform float scryCalm;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=1.-scryCalm*.94;');};rippleMaterial.customProgramCacheKey=()=>rippleKey+'scry-calm-highlights';rippleMaterial.needsUpdate=true;}
 // The approved floating batches keep their matrices and materials. Only these
 // 41 anchors receive a small world-space sink and progressively lose coverage.
 // Stable pixel dithering preserves the approved opaque batches and depth behavior.
 // No global transparency toggle or per-frame instance loop.
 const floating=[];scene.children.forEach(object=>{
  if(!object.isInstancedMesh||object===rippleMesh)return;
  const matrix=new THREE.Matrix4(),anchor=V();let count=0;
  for(let i=0;i<object.count;i++){object.getMatrixAt(i,matrix);anchor.setFromMatrixPosition(matrix);if(anchor.x>4.4&&anchor.x<6.15&&anchor.z>.1&&anchor.z<4.6&&anchor.y>-.225&&anchor.y<-.115)count++;}
  if(!count)return;const material=object.material,compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  floating.push({material,compile,key,count});material.onBeforeCompile=shader=>{
   compile.call(material,shader);shader.uniforms.scrySubmerge=uniforms.scrySubmerge;
   shader.vertexShader='uniform float scrySubmerge;varying float vScryFloating;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    mat4 floatingTransform=modelMatrix;
    #ifdef USE_INSTANCING
     floatingTransform=modelMatrix*instanceMatrix;
    #endif
    vec3 floatingAnchor=floatingTransform[3].xyz;
    vScryFloating=float(floatingAnchor.x>4.4&&floatingAnchor.x<6.15&&floatingAnchor.z>.1&&floatingAnchor.z<4.6&&floatingAnchor.y>-.225&&floatingAnchor.y<-.115);
    float sinkDepth=floatingAnchor.y<-.17?.055:.30;
    vec3 sink=vec3(0.,-sinkDepth*scrySubmerge*vScryFloating,0.);
    transformed+=vec3(dot(sink,floatingTransform[0].xyz)/max(dot(floatingTransform[0].xyz,floatingTransform[0].xyz),.00001),dot(sink,floatingTransform[1].xyz)/max(dot(floatingTransform[1].xyz,floatingTransform[1].xyz),.00001),dot(sink,floatingTransform[2].xyz)/max(dot(floatingTransform[2].xyz,floatingTransform[2].xyz),.00001));`);
   shader.fragmentShader='uniform float scrySubmerge;varying float vScryFloating;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vScryFloating>.5&&scrySubmerge>0.){float coverage=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(coverage<scrySubmerge)discard;}');
  };material.customProgramCacheKey=()=>key+'scry-float-sink-v2-coverage';material.needsUpdate=true;
 });
 const oldCompile=waterMaterial.onBeforeCompile,oldKey=waterMaterial.customProgramCacheKey();
 waterMaterial.onBeforeCompile=shader=>{
  oldCompile.call(waterMaterial,shader);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 vScryWorld;varying float vScryTop;varying vec2 vScryView;uniform vec4 scryBounds;uniform vec3 scryCenter;uniform mat4 scryProjection;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvScryWorld=(modelMatrix*vec4(transformed,1.)).xyz;vScryTop=max(0.,normal.y);vScryView=(scryProjection*vec4(vScryWorld.x,scryCenter.y,vScryWorld.z,1.)).xy;');
  shader.fragmentShader=`varying vec3 vScryWorld;varying float vScryTop;varying vec2 vScryView;uniform float scryTime,scryCalm,scryAmount,scryReveal,scryDeep,scryClosing;uniform sampler2D scryTexture,scryShore;uniform vec4 scryViewBounds,scryCaptureUV;uniform vec4 scryBounds;
   float scryMistNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1.,0.),vec2(127.1,311.7)),dot(i+vec2(0.,1.),vec2(127.1,311.7)),dot(i+vec2(1.,1.),vec2(127.1,311.7))))*43758.5453);return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}
   float scryMistCloud(vec2 p){mat2 turn=mat2(.8,-.6,.6,.8);vec2 p2=turn*p*2.03+vec2(7.2,1.8),p3=turn*p2*2.03+vec2(2.3,9.4);return scryMistNoise(p)*.57+scryMistNoise(p2)*.29+scryMistNoise(p3)*.14;}
  \n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(roughnessFactor,.89,scryCalm*.88);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.003,.006,.018),scryCalm*.62);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',`normal=normalize(mix(normal,nonPerturbedNormal,scryCalm*.92));\n#include <lights_fragment_begin>`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   if(scryAmount>.00001&&vScryTop>.5){
   vec2 waterUV=(vScryWorld.xz-scryBounds.xy)/scryBounds.zw;
   vec2 q=waterUV*2.-1.;float shore=texture2D(scryShore,waterUV).r*.50;
   float edge=1.-smoothstep(.025,.36,shore);
   float flow=sin(q.x*5.+q.y*4.+scryTime*.17)*sin(q.y*6.-q.x*3.-scryTime*.11);
   float wave=sin(q.y*12.+q.x*3.-scryTime*.38+flow*.6);
   vec2 distortion=vec2(sin(q.y*7.+scryTime*.21),cos(q.x*6.-scryTime*.15))*(.0002+edge*.0015+scryClosing*.009)+q*wave*(.0001+edge*.0003);
   vec2 proportionalUV=(vScryView-scryViewBounds.xy)/scryViewBounds.zw;
   vec2 uv=scryCaptureUV.xy+proportionalUV*scryCaptureUV.zw+distortion;
   float blur=.00035+edge*.004;
   vec4 centerSample=texture2D(scryTexture,clamp(uv,.002,.998));
   vec4 sideA=texture2D(scryTexture,clamp(uv+vec2(blur,0.),.002,.998)),sideB=texture2D(scryTexture,clamp(uv-vec2(blur,0.),.002,.998));
   vec3 image=centerSample.rgb*.76+(sideA.rgb+sideB.rgb)*.12;
   float sceneCoverage=max(centerSample.a,max(sideA.a,sideB.a));
   image=pow(max(image,vec3(0.)),vec3(.82))*1.14;
   float silver=dot(image,vec3(.2126,.7152,.0722));image=mix(image,vec3(silver*.82,silver*.92,silver*1.10),.16);
   // RT alpha marks actual geometry, even dark foliage and the portal shadow.
   // Mist fills uncovered water, never infers empty space from scene luminance.
   // Rotated octaves and two-axis warping avoid the former stretched stripe layer.
   vec2 mistP=vScryWorld.xz*1.10+vec2(scryTime*.024,-scryTime*.018);
   vec2 mistWarp=vec2(scryMistNoise(mistP*.62+vec2(0.,scryTime*.009)),scryMistNoise(mistP*.62+vec2(8.1,3.7)-scryTime*.006))-.5;
   float cloud=scryMistCloud(mistP+mistWarp*.75);
   float bankDensity=smoothstep(.20,.82,cloud);
   vec3 mistColor=mix(vec3(.030,.019,.067),vec3(.14,.063,.22),bankDensity);
   float emptyDepth=1.-smoothstep(.015,.45,sceneCoverage);
   float veil=(.18+bankDensity*.30)*emptyDepth;
   image=mix(image*(1.-edge*.44),mistColor,veil);
   image+=mistColor*emptyDepth*(.24+bankDensity*.30)*scryDeep;
   vec3 abyss=mix(vec3(.005,.009,.018),mistColor*(.30+bankDensity*.42),scryDeep);
   // A broad, liquid front travels from the witch's bank through the whole lake.
   // The field stays bounded, so both endpoints are exact over every top fragment.
   float travel=length((vScryWorld.xz-vec2(3.25,1.15))*vec2(1.,.52))/4.80;
   float field=clamp(travel+flow*.075,0.,1.);
   float liquidFront=smoothstep(field-.13,field+.13,scryReveal*1.30-.15);
   vec3 depthView=mix(abyss,image,liquidFront*scryReveal);
   outgoingLight=mix(outgoingLight,depthView,scryAmount*vScryTop);}
   #include <opaque_fragment>`);
 };
 waterMaterial.customProgramCacheKey=()=>oldKey+'scry-surface-v9-coverage-mist';waterMaterial.needsUpdate=true;
 const vision=createAbsentGarden({scene,witch});
 // The skulls dominate/occlude the hat and waiting cat at this small viewing scale.
 // Filter only this camera's capture; the five real ritual roots never change.
 const viewOccluders=scene.children.filter(o=>o.name==='caveira');
 // Eight motes cross the surface and fade downward. Fixed buffer, analytic motion on GPU.
 const motePositions=[],phases=[];for(let i=0;i<8;i++){motePositions.push(4.15+(i%4)*.36,0,1.20+Math.floor(i/4)*1.35);phases.push(i*.137);}
 const moteGeometry=new THREE.BufferGeometry();moteGeometry.setAttribute('position',new THREE.Float32BufferAttribute(motePositions,3));moteGeometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
 const motes=new THREE.Points(moteGeometry,new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,
  vertexShader:`attribute float phase;uniform float scryTime,scryAmount;varying float fall;void main(){fall=fract(scryTime*.14+phase);vec3 p=position;p.x+=sin(scryTime*.3+phase*23.)*.035;p.y=mix(.18,-.72,fall);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=3.;}`,
  fragmentShader:`uniform float scryAmount;varying float fall;void main(){float spot=1.-smoothstep(.04,.5,length(gl_PointCoord-.5));float fade=smoothstep(0.,.13,fall)*(1.-smoothstep(.30,.46,fall));gl_FragColor=vec4(.44,.49,.69,spot*fade*scryAmount*.43);}`
 }));motes.name='scry-descending-motes';motes.visible=false;motes.frustumCulled=false;scene.add(motes);
 function active(){return state!=='SCRY_IDLE'}
 function canStart(position){return !active()&&isRitualInactive()&&Math.hypot(position.x-bank.x,position.z-bank.z)<.40;}
 function focus(){const yaw=Math.atan2(lake.x-witch.root.position.x,lake.z-witch.root.position.z);witch.setExternalFocus({locked:active(),weight:calm,yaw});}
 function start(){if(!canStart(witch.root.position))return false;state='SCRY_FOCUS';elapsed=total=0;focus();return true;}
 function toggle(){if(!active())return start();if(state==='SCRY_CLOSING'||total<.18)return true;closeFrom={calm,amount,reveal,deep,submerge:uniforms.scrySubmerge.value};state='SCRY_CLOSING';elapsed=0;return true;}
 // Union of original disk and a narrow bank approach. Existing central boundary is retained elsewhere.
 function projectWalk(position){
  const original=position.clone(),center=V(0,position.y,.3),disk=position.clone().sub(center);disk.y=0;
  if(disk.length()<=1.36)return original;
  const a=V(1.05,position.y,.65),b=bank.clone().setY(position.y),axis=b.clone().sub(a),u=clamp(position.clone().sub(a).dot(axis)/axis.lengthSq(),0,1),nearest=a.clone().addScaledVector(axis,u),offset=position.clone().sub(nearest);offset.y=0;
  if(offset.length()<=.30)return original;
  const corridor=nearest.clone().add(offset.setLength(.30)),circle=center.clone().add(disk.setLength(1.36));return corridor.distanceToSquared(original)<circle.distanceToSquared(original)?corridor:circle;
 }
 function update(dt){
  clock+=dt;if(active()){elapsed+=dt;total+=dt;}
  if(state==='SCRY_FOCUS'||state==='SCRY_OPENING'){
   const progress=clamp(total/2.80,0,1);calm=smooth(progress/.58);amount=smooth((progress-.03)/.97);deep=smooth((progress-.10)/.68);reveal=smooth((progress-.27)/.73);
   if(state==='SCRY_FOCUS'&&total>=.55){state='SCRY_OPENING';elapsed=total-.55;}
   if(total>=2.80){state='SCRY_VISION';elapsed=total-2.80;calm=amount=deep=reveal=1;}
  }
  if(state==='SCRY_VISION'){calm=amount=deep=reveal=1;}
  if(state==='SCRY_CLOSING'){closing=smooth(elapsed/.55);reveal=closeFrom.reveal*(1-smooth((elapsed-.05)/1.30));deep=closeFrom.deep*(1-smooth((elapsed-.35)/1.35));amount=closeFrom.amount*(1-smooth((elapsed-.55)/1.55));calm=closeFrom.calm*(1-smooth((elapsed-.65)/1.45));if(elapsed>=2.10){state='SCRY_IDLE';elapsed=calm=amount=reveal=deep=closing=0;closeFrom=null;}}
  waterMaterial.depthWrite=originalDepthWrite;motes.visible=active()&&amount>.04;
  uniforms.scryTime.value=clock;uniforms.scryCalm.value=calm;uniforms.scryAmount.value=amount;uniforms.scryReveal.value=reveal;uniforms.scryDeep.value=deep;uniforms.scryClosing.value=closing;
  uniforms.scrySubmerge.value=state==='SCRY_CLOSING'?closeFrom?.submerge*(1-smooth((elapsed-.55)/1.55))||0:state==='SCRY_IDLE'?0:smooth((total-.40)/1.80);
  focus();return snapshot();
 }
 function renderVision(){
  if(state==='SCRY_IDLE'||(state==='SCRY_FOCUS'&&amount<.04)||(target&&clock-lastCapture<1/20-1e-6))return 0;
  if(!target){target=new THREE.WebGLRenderTarget(resolution,resolution,{type:renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:true});target.viewport.set(captureX,captureY,captureWidth,captureHeight);target.texture.colorSpace=THREE.NoColorSpace;target.texture.generateMipmaps=false;uniforms.scryTexture.value=target.texture;}
  const previous={target:renderer.getRenderTarget(),background:scene.background,fog:scene.fog,clearColor:renderer.getClearColor(new THREE.Color()),clearAlpha:renderer.getClearAlpha(),toneMapping:renderer.toneMapping,shadow:renderer.shadowMap.autoUpdate,xr:renderer.xr.enabled,viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),water:waterMesh.visible,witch:witch.root.visible,motes:motes.visible,cat:scene.getObjectByName('black-cat-familiar')};
  previous.catVisible=previous.cat?.visible;previous.occluders=viewOccluders.map(object=>({object,visible:object.visible}));let restoreVision=null;const calls=renderer.info.render.calls,triangles=renderer.info.render.triangles;
  try{
   waterMesh.visible=false;witch.root.visible=false;motes.visible=false;if(previous.cat)previous.cat.visible=false;viewOccluders.forEach(o=>{o.visible=false});
   vision.prepare(clock,state==='SCRY_CLOSING'?smooth(elapsed/1.05):0);restoreVision=vision.enter();
   // Transparent background stores coverage in the existing RGBA target.
   // No extra texture, target or render pass is needed to protect the scene.
   scene.background=null;renderer.setClearColor(visionBackground,0);scene.fog=visionFog;renderer.toneMapping=THREE.NoToneMapping;renderer.shadowMap.autoUpdate=false;renderer.xr.enabled=false;
   renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.clear();renderer.render(scene,camera);
   lastCalls=renderer.info.render.calls-calls;lastTriangles=renderer.info.render.triangles-triangles;lastCapture=clock;captures++;
  }finally{
   waterMesh.visible=previous.water;witch.root.visible=previous.witch;motes.visible=previous.motes;previous.occluders.forEach(({object,visible})=>{object.visible=visible});restoreVision?.();if(previous.cat)previous.cat.visible=previous.catVisible;
   scene.background=previous.background;scene.fog=previous.fog;renderer.setClearColor(previous.clearColor,previous.clearAlpha);renderer.toneMapping=previous.toneMapping;renderer.shadowMap.autoUpdate=previous.shadow;renderer.xr.enabled=previous.xr;
   renderer.setRenderTarget(previous.target);renderer.setViewport(previous.viewport);renderer.setScissor(previous.scissor);renderer.setScissorTest(previous.scissorTest);
  }
  return 1;
 }
 function snapshot(){return {vision:'garden-without-you',surface:'whole-geometry',mapping:'affine-proportional-3d-composition',projection:projectionInfo,source:'shared-live-scene',refreshHz:20,lastCaptureTime:lastCapture,floatingInstances:floating.reduce((n,o)=>n+o.count,0),submerge:uniforms.scrySubmerge.value,openingSeconds:2.8,closingSeconds:2.1,state,elapsed,total,clock,active:active(),calm,amount,reveal,deep,closing,x:lake.x,z:lake.z,bank:[bank.x,bank.z],resolution,captures,lastVisionCalls:lastCalls,lastVisionTriangles:lastTriangles,targetAllocated:!!target,targetCount:target?1:0,approxTargetMiB:target?resolution*resolution*((target.texture.type===THREE.HalfFloatType?8:4)+4)/1048576:0};}
 function dispose(){target?.dispose();shoreline.dispose();for(const f of floating){f.material.onBeforeCompile=f.compile;f.material.customProgramCacheKey=()=>f.key;f.material.needsUpdate=true;}if(rippleMaterial){rippleMaterial.onBeforeCompile=rippleCompile;rippleMaterial.customProgramCacheKey=()=>rippleKey;rippleMaterial.needsUpdate=true;}moteGeometry.dispose();motes.material.dispose();vision.dispose();scene.remove(motes);waterMaterial.depthWrite=originalDepthWrite;witch.setExternalFocus({locked:false,weight:0,yaw:witch.root.rotation.y});}
 return {start,toggle,active,canStart,projectWalk,update,renderVision,snapshot,dispose,camera};
}
