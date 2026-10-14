import * as THREE from './vendor/three.module.js';

// Presentation adapter only: the approved ritual owns states, timing and height.
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const ramp=(t,start,duration)=>ease((t-start)/duration);
const common=`float field(vec2 p){return sin(p.x*2.7+p.y*1.9)*.48+sin(p.x*5.3-p.y*3.7+.9)*.31+sin(p.x*9.1+p.y*7.7+2.1)*.21;}`;
const output=`
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;
function material(uniforms,vertexShader,fragmentShader){
 const m=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
 m.userData.ritualVFX=true;return m;
}
function strips(count,segments,attributes){
 const p=[],uv=[],ids=[],index=[];
 for(let k=0;k<count;k++)for(let j=0;j<=segments;j++)for(let s=0;s<2;s++){p.push(0,0,0);uv.push(s,j/segments);ids.push(k);}
 for(let k=0;k<count;k++)for(let j=0;j<segments;j++){const a=k*(segments+1)*2+j*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('strand',new THREE.Float32BufferAttribute(ids,1));g.setIndex(index);
 if(attributes)attributes(g,ids);return g;
}
export function createRitualVFX({group,symbol,texture,halo,floor,character,skulls}){
 const u={time:{value:0},energy:{value:0},lift:{value:0},height:{value:0},lines:{value:0},circle:{value:0},prepare:{value:0},wave:{value:0},frontRadius:{value:0},activation:{value:0},strength:{value:0},sigil:{value:texture},floor:{value:floor}};
 const ringRadius=Math.hypot(skulls[0].position.x,skulls[0].position.z-.3);
 const symbolMaterial=material(u,`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,`
 varying vec2 vUv;uniform sampler2D sigil;uniform float time,lines,circle,prepare,strength,lift,height;${common}
 vec2 corner(float n){float a=-1.57079632679+n*1.25663706144;return vec2(cos(a),sin(a))*2.06689453;}
 void main(){
  vec2 p=(vUv-.5)*5.1;float radius=length(p);vec4 ink=texture2D(sigil,vUv);
  float interior=1.-smoothstep(2.075,2.13,radius);
  float reveal=(1.-smoothstep(lines*2.58-.045,lines*2.58+.045,radius))*step(.001,lines);
  float mask=mix(circle,reveal,interior),travel=0.;
  for(int i=0;i<5;i++){
   vec2 a=corner(float(i)*2.),b=corner(float(i+1)*2.),ab=b-a;
   float along=clamp(dot(p-a,ab)/dot(ab,ab),0.,1.),distance=length(p-a-ab*along);
   float head=fract(along*1.25-time*.31+float(i)*.21);
   travel+=exp(-distance*distance/.0010)*pow(max(0.,1.-abs(head-.5)*2.),9.);
  }
  float ringFlow=pow(max(0.,sin(atan(p.y,p.x)*5.-time*1.8)),12.)*(1.-interior)*circle;
  float rhythm=.86+.08*sin(time*1.77)+.06*sin(time*.93+radius*1.6);
  float anticipation=prepare*strength*.045*(1.-smoothstep(.3,1.2,radius));
  float power=mask*strength*rhythm+anticipation;
  vec3 color=mix(vec3(.25,.12,.53),vec3(.65,.44,.99),ink.r);
  // Quiet the continuous ink; preserve the moving highlights as accents.
  color*=.74;
  color+=vec3(.42,.41,.63)*(travel+ringFlow)*(.3+.7*lift);color*=1.+min(height,.36)*.6;
  float alpha=ink.a*power;if(alpha<.001)discard;gl_FragColor=vec4(color,alpha);
  ${output}
 }`);
 symbolMaterial.polygonOffset=true;symbolMaterial.polygonOffsetFactor=-2;symbol.material.dispose();symbol.material=symbolMaterial;
 const pulseMaterial=material(u,`
 attribute float strand;varying vec2 vUv;varying float wrinkle;uniform float time,frontRadius,wave,floor;${common}
 void main(){vUv=uv;float angle=uv.y*6.28318530718;vec2 ray=vec2(cos(angle),sin(angle));
  wrinkle=field(ray*3.+vec2(time*.5,-time*.4));
  float radius=max(.005,frontRadius+(uv.x-.5)*.32+wrinkle*.034);
  float crest=pow(sin(uv.x*3.14159265359),3.)*(.065+.022*wrinkle)*wave;
  vec3 p=vec3(ray.x*radius,floor+.006+crest,.3+ray.y*radius);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
 }`,`
 varying vec2 vUv;varying float wrinkle;uniform float wave,time,frontRadius;${common}
 void main(){float across=abs(vUv.x-.56),core=exp(-across*across/.003),shoulder=pow(sin(vUv.x*3.14159265359),1.5);
  float texture=.82+.18*field(vec2(vUv.y*28.-time*.22,vUv.x*3.));
  float alpha=wave*shoulder*texture*min(1.,frontRadius*3.);if(alpha<.003)discard;
  vec3 color=mix(vec3(.25,.10,.61),vec3(.75,.63,1.12),core);gl_FragColor=vec4(color,alpha*.72);
  ${output}
 }`);
 const pulse=new THREE.Mesh(strips(1,160),pulseMaterial);pulse.name='ritual-radial-crest';pulse.frustumCulled=false;group.add(pulse);
 const flowMaterial=material(u,`
 attribute float strand;varying vec2 vUv;varying float stream;uniform float time,energy,lift,height,floor;
 vec3 currentPath(float t){
  float envelope=sin(t*3.14159265),drift=t*6.2-time*(.62+strand*.043)+strand*1.73;
  float eddy=sin(drift)+.36*sin(drift*1.63+time*.19+strand);
  float theta=time*(.32+strand*.027)+strand*1.5707963+t*4.6+envelope*eddy*.22;
  float radius=mix(1.20,.58,t)+envelope*.085*eddy;
  vec3 p=vec3(cos(theta)*radius,floor+.10+t*(.62+lift*.52+height)+envelope*.045*sin(drift*.71),.3+sin(theta)*radius);
  return p;
 }
 void main(){vUv=uv;stream=strand;float t=uv.y,envelope=sin(t*3.14159265);
  float drift=t*6.2-time*(.62+strand*.043)+strand*1.73;
  vec3 p=currentPath(t);
  float width=(.22+.16*envelope)*(1.+.15*sin(drift-1.1));
  // Soft ribbons face the camera, with depth testing against the real scene.
  vec4 view=modelViewMatrix*vec4(p,1.);
  // Stable screen-space axis avoids ribbon flips at projected curve cusps.
  vec2 normal=normalize(vec2(.32*sin(strand*1.7),1.));
  view.xy+=normal*(uv.x-.5)*width;
  gl_Position=projectionMatrix*view;
 }`,`
 varying vec2 vUv;varying float stream;uniform float time,energy,lift,prepare,strength;${common}
 void main(){
  float t=vUv.y,x=vUv.x*2.-1.,transport=t*8.-time*(.73+stream*.043)+stream*1.79;
  float turbulence=field(vec2(transport,vUv.x*3.1+stream));
  float vein=x-.24*sin(transport)-.12*sin(transport*1.81+stream);
  float core=exp(-vein*vein/.025);
  float branch=vein+.32+.08*sin(transport*1.37);
  float secondary=exp(-branch*branch/.045);
  float edge=1.-smoothstep(.45,1.,abs(x));
  float vapor=exp(-vein*vein/.32)*(.60+.40*turbulence);
  float ends=smoothstep(0.,.12,t)*(1.-smoothstep(.72,1.,t));
  float flow=.72+.28*sin(transport*.83+sin(transport*.41));
  float visibility=prepare*.085+energy*(.22+.78*lift);
  float vertical=mix(.65,1.15,smoothstep(.12,.70,t));
  float alpha=edge*ends*visibility*strength*vertical*(vapor*.18+core*.30+secondary*.10)*flow;
  if(alpha<.001)discard;
  vec3 color=mix(vec3(.24,.10,.49),vec3(.64,.45,.94),core*.75+secondary*.15);
  gl_FragColor=vec4(color,alpha);
  ${output}
 }`);
 const flows=new THREE.Mesh(strips(4,48),flowMaterial);flows.name='ritual-converging-currents';flows.frustumCulled=false;group.add(flows);
 const flameGeometry=strips(15,24,(g,ids)=>{const anchors=[],phases=[];for(const id of ids){const n=Math.floor(id/3),s=skulls[n];anchors.push(s.position.x,s.position.y+.42,s.position.z);phases.push(n*1.79);}g.setAttribute('anchor',new THREE.Float32BufferAttribute(anchors,3));g.setAttribute('flamePhase',new THREE.Float32BufferAttribute(phases,1));});
 const flameMaterial=material(u,`
 attribute float strand,flamePhase;attribute vec3 anchor;varying vec2 vUv;varying float phase,lobe;uniform float time,activation;
 void main(){vUv=uv;phase=flamePhase;lobe=mod(strand,3.);float t=uv.y,growth=activation*activation;
  // Lobes share a bending spine; independent skull rates prevent synchronized sway.
  float rate=1.10+.17*sin(phase*1.37+.4),flowTime=time*rate;
  float bend=flowTime-t*5.7+phase,curl=flowTime*.73-t*9.1+phase*.43;
  float turn=.46+lobe*1.04719755+.20*t*sin(bend*.63);
  float width=(.032+.184*pow(max(0.,1.-t),.70))*sin((.18+t*.82)*3.14159265)*(1.+sin(t*10.5-flowTime*1.38+phase)*.17*t),side=(uv.x*2.-1.)*width;
  vec3 center=vec3(sin(bend)*.112*t*t+sin(curl)*.037*t*t,t*(.82+.065*sin(flowTime*.79+phase)+.025*sin(flowTime*1.31+phase*.6)),cos(bend*.81+phase*.3)*.088*t*t+sin(curl*1.14)*.022*t*t);
  vec3 p=anchor+(center+vec3(cos(turn)*side,0.,sin(turn)*side))*growth;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
 }`,`
 varying vec2 vUv;varying float phase,lobe;uniform float time,activation,strength;${common}
 void main(){float t=vUv.y,flowTime=time*(1.10+.17*sin(phase*1.37+.4));
  float x=abs(vUv.x*2.-1.+.16*t*sin(t*10.5-flowTime*1.38+phase)),edge=pow(max(0.,1.-x),1.25);
  float wisps=.76+.24*field(vec2(t*5.-flowTime*.65+phase,vUv.x*3.+.12*sin(flowTime*.53+phase)));
  float tip=(1.-smoothstep(.65,1.,t))*smoothstep(0.,.07,t),alpha=edge*tip*wisps*activation*activation*strength*(lobe<.5?.64:.29);
  if(alpha<.004)discard;vec3 color=mix(vec3(.22,.13,.66),vec3(.75,.58,1.16),pow(max(0.,1.-x),4.)*(1.-t*.55));gl_FragColor=vec4(color,alpha);
  ${output}
 }`);
 const flames=new THREE.Mesh(flameGeometry,flameMaterial);flames.name='ritual-spectral-flames-batch';flames.frustumCulled=false;group.add(flames);
 let visualWave=0,visualFront=0,preparation=0,active=false,lastState='inactive',release=null;
 function update({clock,state,elapsed,pose,values,height,exitElapsed}){
  const closing=state==='descending';
  // Capture the displayed energy once; gameplay continues to own exit duration.
  if(closing&&lastState!=='descending')release={wave:visualWave,front:visualFront,preparation,energy:u.energy.value,lift:u.lift.value,lines:u.lines.value,circle:u.circle.value,activation:u.activation.value};
  const fade=closing?1-ease(exitElapsed/.80):1;
  active=state!=='inactive'||pose.state==='sitting';const t=elapsed-.65;
  preparation=state==='inactive'&&pose.state==='sitting'?ease(pose.meditation):state==='pause'?1:state==='awakening'?1-ramp(t,0,.85):0;
  visualWave=state==='awakening'?ramp(t,.14,.25)*(1-ramp(t,1.65,.70)):0;
  visualFront=ringRadius*values.front+ramp(t,1.65,.70)*1.40;
  if(closing&&release){
   preparation=release.preparation;
   visualWave=release.wave*fade;
   visualFront=release.front+exitElapsed*.45;
  }
  const source=closing&&release?release:values;
  u.time.value=clock;u.energy.value=source.energy;u.lift.value=source.lift;u.height.value=height;
  u.lines.value=source.lines;u.circle.value=source.circle;u.prepare.value=preparation;
  u.wave.value=visualWave;u.frontRadius.value=visualFront;
  u.activation.value=closing&&release?release.activation:values.skulls[0];u.strength.value=fade;
  group.visible=active;symbol.visible=active&&fade>.001&&(source.lines>0||preparation>0);
  pulse.visible=visualWave>.001;flows.visible=active&&fade>.001&&(source.energy>.001||preparation>.001);
  flames.visible=u.activation.value*fade>.001&&state!=='inactive';halo.visible=values.energy>.001&&state!=='inactive';
  lastState=state;
  if(state==='inactive'&&pose.state!=='sitting')release=null;
  return {preparation:preparation*fade,frontRadius:visualFront,wave:visualWave};
 }
 function metrics(){return {active,preparation:preparation*u.strength.value,frontRadius:visualFront,wave:visualWave,releaseStrength:u.strength.value,flameBatches:1,flowStrands:4,pointBudget:25,canvasUploadsDuringRitual:0,materials:4};}
 return {update,metrics};
}
