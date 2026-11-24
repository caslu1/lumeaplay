// Arte cinematográfica gerada (placeholder realista até entrarem as capas reais da lista M3U)
function rnd(s){return function(){s=(s*16807)%2147483647;return (s-1)/2147483646}}
const PAL={
 desert:['#0a0f2e','#2b2a7a','#5b6cff','#9fd8ff'],
 city:['#03061a','#0d1a4a','#2a3fa8','#38d6ff'],
 mount:['#060c22','#13265a','#2f5fb3','#bfe3ff'],
 ocean:['#040b24','#0e2f6b','#3a7bd5','#a8f0ff'],
 space:['#02030f','#0a0f3a','#3b2bb0','#7ad7ff'],
 forest:['#03101a','#0a2a3a','#14607a','#8ff0ff'],
 neon:['#05031a','#1a0f5a','#5b4dff','#22d3ee'],
 blood:['#070a24','#22186a','#6a4dff','#c4b5ff'],
 ice:['#06101c','#123049','#5aa3c7','#e6f6ff']
};
function scene(type,seed,w=1600,h=900,fig=true){
 const r=rnd(seed*7919+13),p=PAL[type],id='s'+seed+type;
 let s=`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='xMidYMid slice'><defs>
 <linearGradient id='${id}k' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${p[0]}'/><stop offset='.55' stop-color='${p[1]}'/><stop offset='1' stop-color='${p[2]}'/></linearGradient>
 <radialGradient id='${id}g'><stop offset='0' stop-color='${p[3]}' stop-opacity='.95'/><stop offset='.3' stop-color='${p[3]}' stop-opacity='.35'/><stop offset='1' stop-color='${p[3]}' stop-opacity='0'/></radialGradient>
 <filter id='${id}n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .08 0'/></filter>
 <filter id='${id}b'><feGaussianBlur stdDeviation='6'/></filter>
 <linearGradient id='${id}v' x1='0' y1='0' x2='0' y2='1'><stop offset='.5' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.55'/></linearGradient>
 </defs><rect width='${w}' height='${h}' fill='url(#${id}k)'/>`;
 const sx=w*(.25+r()*.5),sy=h*(.3+r()*.25);
 if(type=='space'||type=='city'||type=='mount'||type=='ice'){for(let i=0;i<140;i++)s+=`<circle cx='${r()*w}' cy='${r()*h*.7}' r='${r()*1.6+.3}' fill='#fff' opacity='${r()*.8+.1}'/>`}
 s+=`<circle cx='${sx}' cy='${sy}' r='${h*.55}' fill='url(#${id}g)'/>`;
 if(type!='city')s+=`<circle cx='${sx}' cy='${sy}' r='${h*(.07+r()*.05)}' fill='${p[3]}' opacity='.95'/>`;
 const layer=(base,amp,col,op,jag)=>{let d=`M0 ${h} L0 ${base}`;const n=jag?14:8;for(let i=0;i<=n;i++){const x=i*w/n,y=base-(jag?(i%2?amp*r():amp*.2*r()):Math.sin(i*1.3+seed)*amp*.5+amp*r()*.5);d+=jag?` L${x} ${y}`:` Q${x-w/n/2} ${y-amp*.4} ${x} ${y}`}return `<path d='${d} L${w} ${h} Z' fill='${col}' opacity='${op}'/>`};
 if(type=='desert'||type=='blood'){s+=layer(h*.72,70,p[1],.9,0)+layer(h*.8,60,'#14061c',.95,0)+layer(h*.9,40,'#07020b',1,0)}
 if(type=='mount'||type=='ice'){s+=`<g filter='url(#${id}b)'>`+layer(h*.55,260,p[2],.55,1)+`</g>`+layer(h*.65,220,p[1],.85,1)+layer(h*.8,160,'#060a12',1,1)}
 if(type=='forest'){s+=layer(h*.7,60,p[2],.5,0);for(let L=0;L<3;L++){const c=['#1c3b2e','#0e2018','#030806'][L],base=h*(.68+L*.1);for(let x=-40;x<w+40;x+=25+r()*40){const th=120+r()*220+L*60;s+=`<path d='M${x} ${base-th} L${x+30+L*8} ${base} L${x-30-L*8} ${base}Z' fill='${c}'/>`}s+=`<rect y='${base}' width='${w}' height='${h}' fill='${c}'/>`}}
 if(type=='ocean'){s+=`<rect y='${h*.62}' width='${w}' height='${h*.38}' fill='${p[1]}'/>`;for(let i=0;i<40;i++){const y=h*.63+r()*h*.36,x=r()*w;s+=`<rect x='${x}' y='${y}' width='${40+r()*160}' height='2' fill='${p[3]}' opacity='${.15+r()*.5*(1-Math.abs(x-sx)/w)}'/>`}}
 if(type=='city'||type=='neon'){if(type=='neon'){s+=`<circle cx='${w/2}' cy='${h*.55}' r='${h*.22}' fill='${p[3]}'/>`;for(let i=0;i<7;i++)s+=`<rect x='${w/2-h*.25}' y='${h*.5+i*h*.03}' width='${h*.5}' height='${4+i*2}' fill='${p[0]}'/>`;}
  let x=0;while(x<w){const bw=40+r()*110,bh=h*(.2+r()*.5);s+=`<rect x='${x}' y='${h*.85-bh}' width='${bw}' height='${bh+h}' fill='#05040c'/>`;for(let wy=h*.85-bh+12;wy<h*.83;wy+=18)for(let wx=x+8;wx<x+bw-8;wx+=14)if(r()<.3)s+=`<rect x='${wx}' y='${wy}' width='6' height='9' fill='${r()<.7?'#ffd28a':p[3]}' opacity='${.4+r()*.6}'/>`;x+=bw+2}
  if(type=='neon'){for(let i=0;i<12;i++)s+=`<line x1='${w/2}' y1='${h*.85}' x2='${(i-5.5)*w/4+w/2}' y2='${h}' stroke='${p[2]}' stroke-width='2' opacity='.6'/>`;for(let i=0;i<6;i++)s+=`<line x1='0' x2='${w}' y1='${h*.86+i*i*4}' y2='${h*.86+i*i*4}' stroke='${p[2]}' stroke-width='2' opacity='.6'/>`}}
 if(type=='space'){s+=`<g filter='url(#${id}b)'><ellipse cx='${w*.7}' cy='${h*.35}' rx='${w*.35}' ry='${h*.18}' fill='${p[2]}' opacity='.35'/></g><circle cx='${w*.3}' cy='${h*.75}' r='${h*.45}' fill='#0c0820'/><ellipse cx='${w*.3}' cy='${h*.75}' rx='${h*.75}' ry='${h*.08}' fill='none' stroke='${p[3]}' stroke-width='5' opacity='.6'/>`}
 if(fig){const fx=w*(.55+r()*.25),fy=h*(type=='forest'?.98:.92),k=h/900*(.42+r()*.22);s+=`<g transform='translate(${fx} ${fy}) scale(${k})' fill='#020104'><circle cx='0' cy='-232' r='22'/><path d='M-30 -205 Q0 -215 30 -205 L42 -95 L28 -95 L22 -150 L18 -60 L28 0 L8 0 L0 -70 L-8 0 L-28 0 L-18 -60 L-22 -150 L-28 -95 L-42 -95Z'/></g>`}
 s+=`<rect width='${w}' height='${h}' fill='url(#${id}v)'/><rect width='${w}' height='${h}' filter='url(#${id}n)'/></svg>`;
 return 'url(data:image/svg+xml;base64,'+btoa(s)+')';
}
const TYPES=Object.keys(PAL);
