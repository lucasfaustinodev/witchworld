/** Paint a material map, using the rectangular rug's original brushwork.
 * Coordinates stay Cartesian: circular motifs cannot stretch along radial UVs.
 * No product photograph, lighting, backdrop or silhouette is baked into it. */
export function paintCabinRug(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,atlasSize:number,size=2048){
  const cell=atlasSize/4
  ctx.canvas.width=ctx.canvas.height=size
  // Interior of the existing rug cell; exclude its rectangular gold frame.
  ctx.drawImage(atlas,cell*2.20,cell*.20,cell*.60,cell*.60,0,0,size,size)
  const cloth=ctx.getImageData(0,0,size,size),grain=new Uint8Array(size*size)
  for(let i=0;i<cloth.data.length;i+=4){
    const y=.2126*cloth.data[i]+.7152*cloth.data[i+1]+.0722*cloth.data[i+2]
    grain[i/4]=y
    cloth.data[i]=y*.84+6;cloth.data[i+1]=y*.39+4;cloth.data[i+2]=y*1.25+9;cloth.data[i+3]=255
  }
  ctx.putImageData(cloth,0,0)
  ctx.save();ctx.scale(size/2048,size/2048);ctx.translate(1024,1024)
  const unit=2048/(3.22*1.003)
  ctx.scale(unit,unit);ctx.lineJoin='round';ctx.lineCap='round'
  const ink='#b1845f',shade='#754e3b'
  function stroke(draw:()=>void,width:number){
    ctx.beginPath();draw();ctx.strokeStyle=shade;ctx.lineWidth=width*1.22;ctx.stroke()
    ctx.strokeStyle=ink;ctx.lineWidth=width*.78;ctx.stroke()
  }
  function star(x:number,y:number,r:number){
    ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,s=i%2?r*.23:r;const px=x+Math.sin(a)*s,py=y+Math.cos(a)*s;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fillStyle=ink;ctx.fill()
  }
  for(const [r,w]of[[1.45,.017],[1.31,.014],[.93,.012],[.165,.012]])stroke(()=>ctx.arc(0,0,r,0,Math.PI*2),w)
  stroke(()=>{for(let i=0;i<=5;i++){const a=(i*2%5)*Math.PI*2/5,x=Math.sin(a)*.95,y=-Math.cos(a)*.95;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}},.020)
  ctx.fillStyle=ink
  for(let i=0;i<96;i++){const a=(i+.5)*Math.PI*2/96;ctx.beginPath();ctx.arc(Math.sin(a)*1.38,Math.cos(a)*1.38,.009,0,Math.PI*2);ctx.fill()}
  const r=.17,inner=.156,offset=.076,x=(r*r-inner*inner+offset*offset)/(2*offset),y=Math.sqrt(r*r-x*x)
  for(const[px,py]of[[0,-1.1],[0,1.1],[-1.1,0],[1.1,0]]){
    ctx.save();ctx.translate(px,py);if(px<0)ctx.scale(-1,1)
    ctx.beginPath();ctx.arc(0,0,r,Math.atan2(y,x),2*Math.PI-Math.atan2(y,x));ctx.arc(offset,0,inner,-Math.atan2(y,x-offset),Math.atan2(y,x-offset),true);ctx.closePath();ctx.fill();ctx.restore()
  }
  for(const px of[-1.1,1.1]){ctx.beginPath();ctx.arc(px,0,.025,0,Math.PI*2);ctx.fill()}
  for(let i=0;i<8;i++){const a=i*Math.PI/4;star(Math.sin(a)*1.45,Math.cos(a)*1.45,i%2?.055:.074)}
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;star(Math.sin(a)*.95,-Math.cos(a)*.95,.045)}
  star(0,0,.065);for(const[x,y]of[[-.48,-.35],[.48,-.35],[-.43,.4],[.43,.4]])star(x,y,.044)
  ctx.restore()
  // Carry the original textile's brush values through the embroidery pigment.
  const painted=ctx.getImageData(0,0,size,size)
  for(let i=0;i<painted.data.length;i+=4){const f=.89+Math.min(1,grain[i/4]/100)*.18;for(let c=0;c<3;c++)painted.data[i+c]*=f}
  ctx.putImageData(painted,0,0)
}
