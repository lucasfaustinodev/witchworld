import * as THREE from './vendor/three.module.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const ascend=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
const ramp=(t,start,duration)=>ease((t-start)/duration);

// A separate, initially invisible layer. Approved scenery/materials stay untouched.
export function createRitual({scene,character,skulls,hint}){
  const group=new THREE.Group();group.name='ritual';group.visible=false;scene.add(group);
  const floor=.259,groundY=character.root.position.y;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const ink=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const symbol=new THREE.Mesh(new THREE.PlaneGeometry(5.1,5.1),ink);
  symbol.rotation.x=-Math.PI/2;symbol.position.set(0,floor,.3);group.add(symbol);
  let lastSymbol=-1,lastCircle=-1,lastFront=-1,lastWave=-1;
  function paintSymbol(reveal,circle,front,wave){
    // Quantization avoids uploading a new texture on every sustained frame.
    const a=Math.round(reveal*80),b=Math.round(circle*60),c=Math.round(front*60),d=Math.round(wave*30);
    if(a===lastSymbol&&b===lastCircle&&c===lastFront&&d===lastWave)return;
    lastSymbol=a;lastCircle=b;lastFront=c;lastWave=d;ctx.clearRect(0,0,1024,1024);
    const points=Array.from({length:5},(_,i)=>{const angle=-Math.PI/2+i*Math.PI*2/5;return [512+415*Math.cos(angle),512+415*Math.sin(angle)];});
    ctx.save();ctx.beginPath();ctx.arc(512,512,415*a/80,0,Math.PI*2);ctx.clip();
    for(const [width,color] of [[15,'rgba(127,49,181,.32)'],[6,'#b487d9'],[2,'#dbb4e5']]){
      ctx.lineWidth=width;ctx.strokeStyle=color;ctx.lineJoin='round';ctx.beginPath();
      for(let i=0;i<=5;i++){const p=points[(i*2)%5];i?ctx.lineTo(...p):ctx.moveTo(...p);}ctx.stroke();
    }
    ctx.restore();
    if(b>0){
      ctx.globalAlpha=b/60;
      for(const [radius,width,color] of [[415,6,'#b487d9'],[440,3,'#986fba']]){
        ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(512,512,radius,0,Math.PI*2);ctx.stroke();
      }
      // Reuse the thirty engraved marks; no extra geometry or invented symbols.
      ctx.lineWidth=2;ctx.strokeStyle='#ad85cb';ctx.globalAlpha=b/60*.65;
      for(let i=0;i<30;i++){
        const angle=i*Math.PI*2/30;ctx.save();ctx.translate(512+465*Math.cos(angle),512+465*Math.sin(angle));ctx.rotate(angle);
        ctx.beginPath();ctx.moveTo(-5,-6);ctx.lineTo(5,6);ctx.moveTo(0,-8);ctx.lineTo(0,8);
        if(i%3===0){ctx.moveTo(-5,6);ctx.lineTo(5,-6);}ctx.stroke();ctx.restore();
      }
      ctx.globalAlpha=1;
    }
    // A radial front reaches all five equal-radius skull roots together.
    if(c>0&&d>0){
      ctx.globalAlpha=d/30;
      for(const [width,color] of [[14,'rgba(134,70,186,.20)'],[3,'rgba(191,148,218,.63)']]){
        ctx.lineWidth=width;ctx.strokeStyle=color;ctx.beginPath();ctx.arc(512,512,429*c/60,0,Math.PI*2);ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    texture.needsUpdate=true;
  }
  const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128;
  const hc=haloCanvas.getContext('2d'),gradient=hc.createRadialGradient(64,64,4,64,64,64);
  gradient.addColorStop(0,'rgba(160,92,197,.36)');gradient.addColorStop(.4,'rgba(122,52,179,.25)');gradient.addColorStop(1,'rgba(122,52,179,0)');
  hc.fillStyle=gradient;hc.fillRect(0,0,128,128);
  const haloTex=new THREE.CanvasTexture(haloCanvas);haloTex.colorSpace=THREE.SRGBColorSpace;
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.7),new THREE.MeshBasicMaterial({map:haloTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  halo.rotation.x=-Math.PI/2;halo.position.set(0,floor+.003,.3);group.add(halo);
  const centerLight=new THREE.PointLight('#ad68ed',0,5.6,2);centerLight.position.set(.55,1.35,1.45);scene.add(centerLight);

  // Effects stay on the approved roots; GLB eye anchors only align the visual glow.
  const boneGlow=new THREE.Color('#66248e');
  const responders=skulls.map((skull,index)=>{
    const effects=new THREE.Group();effects.visible=false;skull.add(effects);
    const eyes=new THREE.MeshBasicMaterial({color:'#c3a0e1',transparent:true,depthWrite:false});
    for(const [eyeIndex,x] of [-.093,.093].entries()){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),eyes);
      eye.position.set(x,.24,.197);eye.scale.set(.032,.029,.020);eye.rotation.z=-Math.sign(x)*.18;effects.add(eye);
      if(skull.userData.ritualEyes)eye.position.copy(skull.userData.ritualEyes[eyeIndex]);
    }
    const light=new THREE.PointLight('#a953e5',0,2.3,2);light.position.set(0,.53,0);skull.add(light);
    function ribbon(inner){
      const segments=18,positions=new Float32Array((segments+1)*2*3),indices=[];
      for(let j=0;j<segments;j++){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
      const colors=[];
      for(let j=0;j<=segments;j++){const t=j/segments,v=Math.sin(Math.PI*t)**.45;for(let s=0;s<2;s++)colors.push(v,v,v);}
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      const material=new THREE.MeshBasicMaterial({color:inner?'#d0b4e3':'#874fc0',vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
      const mesh=new THREE.Mesh(geometry,material);mesh.rotation.y=.46-skull.rotation.y;mesh.position.y=.42;mesh.frustumCulled=false;effects.add(mesh);
      return {mesh,inner,segments};
    }
    return {effects,eyes,light,ribbons:[ribbon(false),ribbon(true)],index,boneMaterials:skull.userData.ritualBoneMaterials??[]};
  });

  // Sparse points: two loose circular flows and a few embers over each skull.
  const count=75,positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  for(let i=0;i<count;i++){const c=new THREE.Color(i%3?'#9960ce':'#caa5dd');c.toArray(colors,i*3);}
  const pointCanvas=document.createElement('canvas');pointCanvas.width=pointCanvas.height=32;
  const pc=pointCanvas.getContext('2d'),pg=pc.createRadialGradient(16,16,0,16,16,16);
  pg.addColorStop(0,'rgba(255,255,255,1)');pg.addColorStop(.2,'rgba(255,255,255,.8)');pg.addColorStop(1,'rgba(255,255,255,0)');pc.fillStyle=pg;pc.fillRect(0,0,32,32);
  const pointsGeometry=new THREE.BufferGeometry();pointsGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));pointsGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const points=new THREE.Points(pointsGeometry,new THREE.PointsMaterial({map:new THREE.CanvasTexture(pointCanvas),size:3.6,transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending}));
  points.frustumCulled=false;group.add(points);
  const pointBase=colors.slice();
  let state='inactive',elapsed=0,clock=0,height=0,exitElapsed=0;
  let exitValues=null;
  let values={energy:0,lift:0,lines:0,circle:0,particles:0,light:0,front:0,wave:0,skulls:[0,0,0,0,0]};
  character.setMeditationExitHandler(()=>{
    if(state!=='descending'){
      state='descending';exitElapsed=0;exitValues={...values,skulls:[...values.skulls],height};
    }
    return true;
  });
  function update(dt,pose){
    clock+=dt;
    if(state==='inactive'&&pose.state==='meditate'){state='pause';elapsed=0;}
    if(state==='pause'||state==='awakening'||state==='active'){
      elapsed+=dt;const t=elapsed-.65;
      state=t<0?'pause':t<2.7?'awakening':'active';
      values={energy:ramp(t,0,.45),lift:ascend((t-.20)/1.55),lines:ramp(t,.48,1.25),circle:ramp(t,1.42,.65),particles:ramp(t,1.78,.72),light:ramp(t,.20,2.30),front:ramp(t,.14,1.51),wave:ramp(t,.14,.25)*(1-ramp(t,1.65,.30)),skulls:responders.map(()=>ramp(t,1.65,.34))};
      height=.34*values.lift+Math.sin(clock*1.6)*.010*values.lift;
    }else if(state==='descending'){
      exitElapsed+=dt;const fade=1-ease(exitElapsed/.80),down=1-ease(exitElapsed/1.05);
      values={...exitValues,energy:exitValues.energy*fade,lines:exitValues.lines*fade,circle:exitValues.circle*fade,particles:exitValues.particles*fade,light:exitValues.light*fade,wave:exitValues.wave*fade,skulls:exitValues.skulls.map(v=>v*fade)};
      height=exitValues.height*down;
      if(exitElapsed>=1.05){state='inactive';height=0;character.root.position.y=groundY;character.standUp();}
    }
    const visible=state!=='inactive'&&state!=='pause';group.visible=visible;
    character.root.position.y=groundY+height;
    const pulse=1+Math.sin(clock*1.9)*.060;
    paintSymbol(values.lines,values.circle,values.front,values.wave);ink.opacity=state==='descending'?1-ease(exitElapsed/.80):.86*pulse;
    halo.material.opacity=values.energy*.82*pulse;halo.scale.setScalar(.55+values.energy*.70);
    centerLight.intensity=values.light*9.8*pulse;
    let litSkulls=0;
    responders.forEach((r,i)=>{
      const activation=values.skulls[i],flame=activation*activation,flutter=1+Math.sin(clock*1.7+i*1.8)*.04;
      for(const {material,baseEmissive} of r.boneMaterials)material.emissive.copy(baseEmissive).lerp(boneGlow,activation*.16);
      r.effects.visible=visible&&activation>.001;r.eyes.opacity=activation*.85;
      r.light.intensity=activation*2.8*pulse*(1+Math.sin(clock*1.7+i*1.8)*.025*activation);if(activation>.95)litSkulls++;
      if(r.effects.visible)for(const {mesh,inner,segments} of r.ribbons){
        mesh.material.opacity=flame*(inner?.42:.32)*flutter;const p=mesh.geometry.attributes.position;
        for(let j=0;j<=segments;j++){
          const t=j/segments,tip=Math.sin(t*Math.PI)*.060+Math.pow(1-t,.8)*(inner?.026:.079);
          const curl=Math.sin(t*4.5-clock*1.4+i*1.8)*.070*t*t+Math.sin(t*2.7)*.045;
          for(let s=0;s<2;s++)p.setXYZ(j*2+s,curl+(s?1:-1)*tip,t*(inner?.60:.84)*flame*flutter,Math.sin(t*4-clock+i)*.045*t);
        }
        p.needsUpdate=true;
      }
    });
    if(visible&&values.particles>0){
      for(let i=0;i<count;i++){
        let fade=1;
        if(i<32){
          const angle=i*2.399963+clock*.24,radius=1.42+.26*Math.sin(i*1.7);
          positions[i*3]=Math.cos(angle)*radius;positions[i*3+1]=.32+.10*(i%5)/5+Math.sin(angle*2+clock)*.025;positions[i*3+2]=.3+Math.sin(angle)*radius;
          fade=.70+.25*Math.sin(clock*1.1+i)**2;
        }else if(i<50){
          const u=((i-32)/18+clock*.11)%1,angle=i*2.399963-clock*.28,radius=.43+.05*Math.sin(i+clock*.6);
          positions[i*3]=Math.cos(angle)*radius;positions[i*3+1]=.35+height+u*.80;positions[i*3+2]=.3+Math.sin(angle)*radius;
          fade=Math.sin(u*Math.PI)**.65;
        }else{
          const n=(i-50)%5,skull=skulls[n],u=((i-50)/25+clock*.22)%1;
          positions[i*3]=skull.position.x+Math.sin(i+clock)*.10*u;positions[i*3+1]=.68+u*.98;positions[i*3+2]=skull.position.z+Math.cos(i*2+clock)*.09*u;
          fade=Math.sin(u*Math.PI)**.7*values.skulls[n];
        }
        for(let c=0;c<3;c++)colors[i*3+c]=pointBase[i*3+c]*fade;
      }
      pointsGeometry.attributes.position.needsUpdate=true;pointsGeometry.attributes.color.needsUpdate=true;
    }
    points.material.opacity=values.particles*.78;
    if(pose.state==='meditate'){
      hint.hidden=false;hint.textContent=state==='descending'?'Encerrando…':'E — Encerrar ritual';
    }
    return {state,elapsed,height,litSkulls,lines:values.lines,circle:values.circle};
  }
  return {update};
}
