const zlib=require('zlib'),fs=require('fs');
function crc(b){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}let r=0xffffffff;for(const x of b)r=t[(r^x)&255]^(r>>>8);return(r^0xffffffff)>>>0}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])}
function png(s,maskable){const px=Buffer.alloc(s*s*4);
 const set=(x,y,c)=>{const i=(y*s+x)*4;px[i]=c[0];px[i+1]=c[1];px[i+2]=c[2];px[i+3]=255};
 const pad=maskable?0:s*0.0, r=maskable?0:s*0.22;
 for(let y=0;y<s;y++)for(let x=0;x<s;x++){
  let inside=true;if(!maskable){const cx=Math.min(x,s-1-x),cy=Math.min(y,s-1-y);if(cx<r&&cy<r){inside=((r-cx)**2+(r-cy)**2)<=r*r}}
  if(inside)set(x,y,[22,163,74]);else{const i=(y*s+x)*4;px[i+3]=0}}
 // white bars
 const bars=[[.26,.45],[.40,.62],[.54,.36],[.68,.72]];const bw=s*.10,base=s*.74;
 for(const [bx,bh] of bars){for(let y=Math.floor(base-bh*s*.55);y<base;y++)for(let x=Math.floor(bx*s);x<bx*s+bw;x++)set(x,y,[255,255,255])}
 for(let x=Math.floor(s*.2);x<s*.8;x++)for(let y=Math.floor(base);y<base+s*.03;y++)set(x,y,[255,255,255]);
 const raw=Buffer.alloc((s*4+1)*s);for(let y=0;y<s;y++){raw[y*(s*4+1)]=0;px.copy(raw,y*(s*4+1)+1,y*s*4,(y+1)*s*4)}
 const ih=Buffer.alloc(13);ih.writeUInt32BE(s,0);ih.writeUInt32BE(s,4);ih[8]=8;ih[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])}
fs.writeFileSync('icon-192.png',png(192,false));fs.writeFileSync('icon-512.png',png(512,false));fs.writeFileSync('icon-maskable.png',png(512,true));
