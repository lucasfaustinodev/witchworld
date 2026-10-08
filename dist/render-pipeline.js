import * as THREE from './vendor/three.module.js';
import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/addons/postprocessing/RenderPass.js';
import { OutputPass } from './vendor/addons/postprocessing/OutputPass.js';
import { SMAAPass } from './vendor/addons/postprocessing/SMAAPass.js';
import { Pass, FullScreenQuad } from './vendor/addons/postprocessing/Pass.js';

// Only presentation. No input, character state, ritual clock or geometry lives here.
export const RENDER_QUALITY = Object.freeze({
 HIGH: { post:true, contact:true, bloom:true, aa:true, fog:true, pixelRatio:1.5 },
 MEDIUM: { post:true, contact:false, bloom:true, aa:true, fog:true, pixelRatio:1.25 },
 LOW: { post:false, contact:false, bloom:false, aa:false, fog:true, pixelRatio:1 },
});
const vertexShader=`varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
function screenMaterial(uniforms,fragmentShader){
 return new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,depthTest:false,depthWrite:false,toneMapped:false});
}
function target(type=THREE.HalfFloatType){return new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:false});}

// Small-radius, depth-derived contact AO. Reuses the base depth texture; no normal/scene prepass.
// 12 directions, half resolution, bilateral upsampling. It deliberately is not full GTAO.
const contactShader=`
 varying vec2 vUv; uniform sampler2D depthMap; uniform vec2 texel; uniform mat4 inverseProjection;
 uniform vec2 worldSpan; uniform float radius;
 vec3 viewPosition(vec2 uv){vec4 p=inverseProjection*vec4(uv*2.-1.,texture2D(depthMap,uv).r*2.-1.,1.);return p.xyz/p.w;}
 void main(){
  float depth=texture2D(depthMap,vUv).r;
  if(depth>.99999){gl_FragColor=vec4(1.,depth,0.,1.);return;}
  vec3 p=viewPosition(vUv);
  vec3 l=p-viewPosition(vUv-vec2(texel.x,0.)), r=viewPosition(vUv+vec2(texel.x,0.))-p;
  vec3 b=p-viewPosition(vUv-vec2(0.,texel.y)), t=viewPosition(vUv+vec2(0.,texel.y))-p;
  vec3 dx=abs(l.z)<abs(r.z)?l:r,dy=abs(b.z)<abs(t.z)?b:t;
  vec3 normal=normalize(cross(dx,dy));
  float occlusion=0.;
  for(int i=0;i<12;i++){
   float angle=float(i)*2.39996323;
   float distance=radius*(.32+.68*sqrt((float(i)+.5)/12.));
   vec2 uv=vUv+vec2(cos(angle),sin(angle))*distance/worldSpan;
   vec3 delta=viewPosition(uv)-p;float len=length(delta);
   float horizon=max(0.,dot(normal,delta)/max(len,.0001)-.18);
   occlusion+=horizon*(1.-smoothstep(radius*.40,radius*1.6,len));
  }
  gl_FragColor=vec4(clamp(1.-occlusion/12.*2.4,.65,1.),depth,0.,1.);
 }`;
const blurShader=`varying vec2 vUv;uniform sampler2D source;uniform vec2 stepUV;
 void main(){vec3 c=texture2D(source,vUv).rgb*.227027;
 c+=(texture2D(source,vUv+stepUV*1.384615).rgb+texture2D(source,vUv-stepUV*1.384615).rgb)*.316216;
 c+=(texture2D(source,vUv+stepUV*3.230769).rgb+texture2D(source,vUv-stepUV*3.230769).rgb)*.070270;
 gl_FragColor=vec4(c,1.);}`;
const combineShader=`varying vec2 vUv;uniform sampler2D source,contactMap,bloomMap,depthMap;
 uniform bool useContact,useBloom;uniform vec2 contactTexel;uniform float nearFarSpan,contactStrength,bloomStrength;
 void main(){vec3 c=texture2D(source,vUv).rgb;
 if(useContact){float d=texture2D(depthMap,vUv).r;float ao=0.,weights=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   vec4 a=texture2D(contactMap,vUv+vec2(float(x),float(y))*contactTexel);
   float w=exp(-abs(a.g-d)*nearFarSpan*90.)*(x==0&&y==0?2.:1.);ao+=a.r*w;weights+=w;
  }
  c*=mix(1.,ao/max(weights,.0001),contactStrength);
 }
 if(useBloom)c+=texture2D(bloomMap,vUv).rgb*bloomStrength;
 gl_FragColor=vec4(c,texture2D(depthMap,vUv).r>.99999?0.:1.);}`;

class BasePass extends RenderPass {
 render(renderer,writeBuffer,readBuffer,...rest){super.render(renderer,writeBuffer,readBuffer,...rest);this.depth=readBuffer.depthTexture;}
}
// Canvas sky was deliberately un-tonemapped in the approved direct renderer.
// Preserve that backdrop instead of applying ACES to it a second time.
class GardenOutputPass extends OutputPass {
 constructor(){
  super();
  this.material.fragmentShader=this.material.fragmentShader
   .replace('// tone mapping',`vec3 backdrop=gl_FragColor.rgb;
 // tone mapping`)
   .replace('// color space',`gl_FragColor.rgb=mix(backdrop,gl_FragColor.rgb,gl_FragColor.a);gl_FragColor.a=1.;
 // color space`);
 }
}
class DetailPass extends Pass {
 constructor(scene,base){
  super();this.scene=scene;this.base=base;this.options={contact:true,bloom:true};
  this.ao=target();this.emission=target();this.blur=target();this.glow=target();
  this.contact=screenMaterial({depthMap:{value:null},texel:{value:new THREE.Vector2()},inverseProjection:{value:new THREE.Matrix4()},worldSpan:{value:new THREE.Vector2()},radius:{value:.24}},contactShader);
  this.blurMaterial=screenMaterial({source:{value:null},stepUV:{value:new THREE.Vector2()}},blurShader);
  this.combine=screenMaterial({source:{value:null},contactMap:{value:this.ao.texture},bloomMap:{value:this.glow.texture},depthMap:{value:null},useContact:{value:true},useBloom:{value:true},contactTexel:{value:new THREE.Vector2()},nearFarSpan:{value:80},contactStrength:{value:.78},bloomStrength:{value:.18}},combineShader);
  this.quad=new FullScreenQuad(null);this.emitters=[];this.black=new THREE.Color(0);this.layer=30;
  // Explicit selection, independent of brightness threshold. The moon, lit stone,
  // whole character, GLB bone and vegetation cannot enter this mask.
  scene.traverse(o=>{
   if(!o.material)return;
   const materials=Array.isArray(o.material)?o.material:[o.material];
   const inMagic=(()=>{let p=o;while(p){if(p.name==='ritual'||p.name==='caveira')return true;p=p.parent;}return false;})();
   const selected=m=>(m.emissive&&m.emissiveIntensity>0&&m.emissive.getHex()!==0&&!inMagic)||(m.isMeshBasicMaterial&&!m.toneMapped)||(inMagic&&(m.isMeshBasicMaterial||m.isPointsMaterial));
   if(!materials.some(selected))return;
   const copies=materials.map(m=>{
    const c=m.isPointsMaterial?m.clone():new THREE.MeshBasicMaterial();
    for(const k of ['map','alphaMap','alphaTest','transparent','opacity','side','vertexColors','blending','depthWrite','polygonOffset','polygonOffsetFactor','polygonOffsetUnits'])if(m[k]!==undefined)c[k]=m[k];
    c.fog=false;c.toneMapped=false;
    c.userData.selected=selected(m);c.userData.source=m;
    c.onBeforeCompile=shader=>{
     shader.uniforms.sceneDepth=this.depthUniform;shader.uniforms.maskSize=this.sizeUniform;
     shader.fragmentShader='uniform sampler2D sceneDepth;uniform vec2 maskSize;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(gl_FragCoord.z>texture2D(sceneDepth,gl_FragCoord.xy/maskSize).r+.00008)discard;');
    };
    c.customProgramCacheKey=()=>`ritual-emission-depth-v1`;return c;
   });
   this.emitters.push({object:o,materials,copies});
  });
  this.depthUniform={value:null};this.sizeUniform={value:new THREE.Vector2()};this.drawStages=0;
 }
 setSize(w,h){
  this.ao.setSize(Math.max(1,Math.ceil(w/2)),Math.max(1,Math.ceil(h/2)));
  for(const rt of [this.emission,this.blur,this.glow])rt.setSize(Math.max(1,Math.ceil(w/4)),Math.max(1,Math.ceil(h/4)));
  this.contact.uniforms.texel.value.set(1/w,1/h);
  this.combine.uniforms.contactTexel.value.set(1/this.ao.width,1/this.ao.height);
  this.sizeUniform.value.set(this.emission.width,this.emission.height);
 }
 fullscreen(renderer,mat,rt){this.quad.material=mat;renderer.setRenderTarget(rt);this.quad.render(renderer);this.drawStages++;}
 render(renderer,writeBuffer,readBuffer){
  this.drawStages=0;const camera=this.base.camera,depth=this.base.depth;
  if(this.options.contact){
   this.contact.uniforms.depthMap.value=depth;
   this.contact.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
   this.contact.uniforms.worldSpan.value.set(camera.right-camera.left,camera.top-camera.bottom);
   this.fullscreen(renderer,this.contact,this.ao);
  }
  if(this.options.bloom){
   const originalBackground=this.scene.background,originalFog=this.scene.fog,autoShadow=renderer.shadowMap.autoUpdate;
   const clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha(),layers=camera.layers.mask;
   this.depthUniform.value=depth;
   // Only temporary rendering substitutions. Original materials/layers are restored
   // even if rendering throws; ritual continues to own its emissive/opacity values.
   try{
    for(const e of this.emitters){
     e.mask=e.object.layers.mask;e.original=e.object.material;e.object.layers.set(this.layer);
     for(const c of e.copies){const m=c.userData.source;
      c.color.copy(m.emissive&&m.emissive.getHex()!==0?m.emissive:m.color);
      if(m.emissive)c.color.multiplyScalar(m.emissiveIntensity);
      if(!c.userData.selected)c.color.set(0);
      c.opacity=m.opacity;c.visible=m.visible;c.map=m.map;
     }
     e.object.material=Array.isArray(e.original)?e.copies:e.copies[0];
    }
    camera.layers.set(this.layer);this.scene.background=null;this.scene.fog=null;
    renderer.shadowMap.autoUpdate=false;renderer.setClearColor(this.black,0);
    renderer.setRenderTarget(this.emission);renderer.clear();renderer.render(this.scene,camera);this.drawStages++;
   }finally{
    for(const e of this.emitters){e.object.material=e.original;e.object.layers.mask=e.mask;}
    camera.layers.mask=layers;this.scene.background=originalBackground;this.scene.fog=originalFog;
    renderer.shadowMap.autoUpdate=autoShadow;renderer.setClearColor(clearColor,clearAlpha);
   }
   const u=this.blurMaterial.uniforms;u.source.value=this.emission.texture;u.stepUV.value.set(1.35/this.emission.width,0);this.fullscreen(renderer,this.blurMaterial,this.blur);
   u.source.value=this.blur.texture;u.stepUV.value.set(0,1.35/this.emission.height);this.fullscreen(renderer,this.blurMaterial,this.glow);
  }
  const u=this.combine.uniforms;u.source.value=readBuffer.texture;u.depthMap.value=depth;
  u.useContact.value=this.options.contact;u.useBloom.value=this.options.bloom;u.nearFarSpan.value=camera.far-camera.near;
  this.fullscreen(renderer,this.combine,this.renderToScreen?null:writeBuffer);
 }
 dispose(){for(const t of [this.ao,this.emission,this.blur,this.glow])t.dispose();for(const m of [this.contact,this.blurMaterial,this.combine])m.dispose();for(const e of this.emitters)for(const c of e.copies)c.dispose();this.quad.dispose();}
}

export function createRenderPipeline({renderer,scene,camera,quality=innerWidth<600?'MEDIUM':'HIGH',beforeRender=null}){
 const originalFog=scene.fog;let config={...RENDER_QUALITY[quality]},width=1,height=1,auxiliaryPasses=0;
 // Half float holds radiance before the single ACES/sRGB output conversion.
 const rt=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
 rt.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
 const composer=new EffectComposer(renderer,rt),base=new BasePass(scene,camera),detail=new DetailPass(scene,base),aa=new SMAAPass(),output=new GardenOutputPass(base);
 composer.addPass(base);composer.addPass(detail);composer.addPass(aa);composer.addPass(output);
 renderer.info.autoReset=false;
 const capabilitiesOK=renderer.extensions.has('EXT_color_buffer_float');
 if(!capabilitiesOK)config={...RENDER_QUALITY.LOW};
 function configure(options={}){
  if(options.quality){if(!RENDER_QUALITY[options.quality])throw new Error('Unknown render quality');quality=options.quality;config={...RENDER_QUALITY[quality]};}
  for(const k of ['post','contact','bloom','aa','fog','pixelRatio'])if(k in options)config[k]=options[k];
  if(!capabilitiesOK)config.post=false;
  detail.options.contact=config.contact;detail.options.bloom=config.bloom;
  detail.enabled=true;aa.enabled=config.aa;
  scene.fog=config.fog?originalFog:null;
  renderer.setPixelRatio(Math.min(devicePixelRatio,config.pixelRatio));renderer.setSize(width,height);
  composer.setPixelRatio(config.post?renderer.getPixelRatio():1);composer.setSize(config.post?width:1,config.post?height:1);
 }
 function setSize(w,h){width=w;height=h;configure();}
 function render(viewCamera=camera){
  renderer.info.reset();auxiliaryPasses=beforeRender?.()||0;
  if(config.post){base.camera=viewCamera;composer.render(0);}else{renderer.setRenderTarget(null);renderer.render(scene,viewCamera);}
  Object.assign(renderer.domElement.dataset,{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,renderQuality:quality,renderPasses:auxiliaryPasses+(config.post?1+(detail.enabled?detail.drawStages:0)+(aa.enabled?3:0)+1:1)});
 }
 function metrics(){return {quality,...config,auxiliaryPasses,passes:Number(renderer.domElement.dataset.renderPasses),color:'linear HDR → ACES 1.15 → sRGB',contactBuffer:[detail.ao.width,detail.ao.height],bloomBuffer:[detail.emission.width,detail.emission.height],selectedObjects:detail.emitters.length,halfFloatSupported:capabilitiesOK};}
 function dispose(){detail.dispose();aa.dispose();output.dispose();composer.dispose();renderer.info.autoReset=true;scene.fog=originalFog;}
 configure();return {render,setSize,configure,metrics,dispose};
}
