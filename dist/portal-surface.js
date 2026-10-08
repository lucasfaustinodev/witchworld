import * as THREE from './vendor/three.module.js';

// Shared visual recess. No figure, lights, controls or passage mechanics.
export function createPortalSurface(name){
 const shape=new THREE.Shape();shape.moveTo(-.69,.16);shape.lineTo(.69,.16);shape.lineTo(.69,1.82);
 for(let i=0;i<=24;i++){const angle=i/24*Math.PI;shape.lineTo(Math.cos(angle)*.69,1.82+Math.sin(angle)*.69)}shape.closePath();
 const geometry=new THREE.ShapeGeometry(shape,24),uniforms={time:{value:0},presence:{value:1},veilStrength:{value:0}};
 const material=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,
  vertexShader:`varying vec2 archUV;void main(){archUV=vec2(position.x/.69,position.y/2.51);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 archUV;uniform float time,presence,veilStrength;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
   float archDistance(vec2 p){float side=abs(p.x)-1.;float top=p.y>.725?length(vec2(p.x,(p.y-.725)/.275))-1.:side;return max(top,.065-p.y);}
   void main(){vec2 p=archUV;float ridge=pow(abs(p.x),5.);float cloud=sin(p.x*7.+p.y*11.-time*.18)*sin(p.x*13.-p.y*7.+time*.13);
    float mist=exp(-pow((p.y-.19-cloud*.045)/.14,2.))*(.45+.55*ridge);float depth=(1.-ridge)*smoothstep(.03,.56,p.y);
    vec3 voidColor=mix(vec3(.012,.021,.037),vec3(.007,.010,.032),depth);
    voidColor+=vec3(.18,.14,.38)*mist+vec3(.035,.028,.085)*exp(-pow(p.x/.55,2.)-pow((p.y-.53)/.39,2.))+vec3(.05,.075,.14)*ridge*(.6+.4*sin(p.y*12.+cloud));
    // Only the Veil gains nested recesses. The physical aperture stays exact.
    if(veilStrength>0.){
     vec2 vanishing=vec2(.045,.56),q=p-vanishing;float falloff=exp(-dot(q*vec2(1.35,2.4),q*vec2(1.35,2.4)));
     vec2 drift=vec2(time*.022,-time*.017);float vapor=noise(p*vec2(3.4,5.7)+drift);vapor=.65*vapor+.35*noise(p*vec2(7.,11.)-drift*.6+vapor);
     vec3 recess=vec3(.007,.011,.026)+vec3(.016,.022,.060)*vapor;
     recess+=vec3(.048,.052,.105)*exp(-pow((p.y-.18-vapor*.08)/.17,2.))*(.5+.5*ridge);
     for(int i=0;i<4;i++){
      float layer=float(i),scale=.89-layer*.175;vec2 a=q/scale+vanishing;
      float contour=exp(-abs(archDistance(a))*26.);float broken=.43+.57*noise(a*vec2(2.8,4.)+vec2(layer*7.,time*.025));
      float topLight=smoothstep(.20,.86,a.y);recess+=vec3(.093,.112,.19)*contour*broken*topLight/(1.+layer*.55);
     }
     float inward=sin(length(q*vec2(1.,1.8))*11.-time*.20+vapor*2.);float depthMist=smoothstep(.38,.80,vapor)*(.48+.13*inward);
     recess+=vec3(.075,.072,.15)*depthMist*(1.-falloff*.68);
     recess+=vec3(.055,.073,.12)*ridge*(.62+.38*vapor);
     voidColor=mix(voidColor,recess,veilStrength);
    }
    gl_FragColor=vec4(mix(vec3(.002,.004,.009),voidColor,presence),1.);}`
 });
 const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(0,0,-4.76);
 return {mesh,uniforms,update:dt=>{uniforms.time.value+=dt},dispose:()=>{geometry.dispose();material.dispose()}};
}
