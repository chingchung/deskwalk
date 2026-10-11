/* Visual construction studies; deliberately independent of the playable rules. */
(function(root){
'use strict';
const TYPES=[
 {id:'diagonal',code:'A',name:'斜角星路',en:'CORNER CONNECTIONS',description:'方形牌增加四角接口，星線可以斜跨棋盤。單星與雙星混合，讓輪廓朝不同方向伸展。',spec:'方形 · 四邊中點＋四角 · 1–2 顆星',note:'斜向最明顯。角落相遇時，需另定三片以上共點的連接規則。'},
 {id:'offset',code:'B',name:'錯位星軌',en:'OFFSET PORTS',description:'接口放在每邊的 ¼ 與 ¾，避開整齊的十字中心。長斜線穿過板塊，接縫退成微小星點。',spec:'方形 · 每邊兩接口 · 1–2 顆星',note:'最接近參考圖的長斜線。接口更多，也需要較大的實體板塊。'},
 {id:'fragments',code:'C',name:'星座碎片',en:'CONSTELLATION FRAGMENTS',description:'每片先是一小段星座：2–4 顆大小不同的星，以折線串起。拼接時接的是星座片段。',spec:'方形 · 四邊中點 · 2–4 顆星',note:'可沿用四邊中點。視覺較自然，單片內容更豐富，適合優先試做。'},
 {id:'hex',code:'D',name:'六向星野',en:'HEXAGON FIELD',description:'六角牌讓連線自然沿六個方向生長。細線、大小星點與少數星芒，形成較鬆散的星野。',spec:'六角形 · 六邊中點 · 1–3 顆星',note:'整體最少方格感。需要重做牌形、旋轉方式與落牌邏輯。'}
];
const f=n=>Math.round(n*100)/100;
const key=p=>f(p.x)+','+f(p.y);
function rng(seed){let n=2166136261;for(const c of String(seed)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return()=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,n|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function build(type,seed=17){
 const r=rng(type+':'+seed),hex=type==='hex',cells=[],byId=new Map(),side=85;
 for(let y=0;y<7;y++)for(let x=0;x<8;x++){
  // A continuous, irregular silhouette leaves breathing room around the artwork.
  if((x===0&&y<2)||(x===7&&y>4)||(y===0&&x>4)||(y===6&&x<3))continue;
  if((x===2&&y===2)||(x===5&&y===4))continue;
  let cx,cy,poly;
  if(hex){cx=side*Math.sqrt(3)*(x+(y%2)/2);cy=side*1.5*y;poly=Array.from({length:6},(_,i)=>({x:cx+side*Math.cos((i*60-30)*Math.PI/180),y:cy+side*Math.sin((i*60-30)*Math.PI/180)}));}
  else {cx=x*140;cy=y*140;poly=[{x:cx-70,y:cy-70},{x:cx+70,y:cy-70},{x:cx+70,y:cy+70},{x:cx-70,y:cy+70}];}
  const count=type==='fragments'?2+Math.floor(r()*3):type==='hex'?1+Math.floor(r()*3):1+(r()>.58?1:0);
  const nodes=[];
  for(let i=0;i<count;i++){
   let p;for(let tries=0;tries<30;tries++){p={x:cx+(r()-.5)*82,y:cy+(r()-.5)*82,size:1.7+r()*2.2,rays:r()>.82};if(nodes.every(n=>dist(n,p)>25))break;}
   nodes.push(p);
  }
  const c={id:x+':'+y,x,y,cx,cy,poly,nodes,ports:[],lines:[]};cells.push(c);byId.set(c.id,c);
 }
 const edges=[],seen=new Set();
 for(const a of cells)for(const b of cells){
  if(a.id===b.id)continue;const id=[a.id,b.id].sort().join('|');if(seen.has(id))continue;
  const dx=b.x-a.x,dy=b.y-a.y;let adjacent=false,diagonal=false;
  if(hex)adjacent=Math.abs(dist({x:a.cx,y:a.cy},{x:b.cx,y:b.cy})-side*Math.sqrt(3))<1;
  else {adjacent=Math.abs(dx)+Math.abs(dy)===1;diagonal=type==='diagonal'&&Math.abs(dx)===1&&Math.abs(dy)===1;}
  if(!adjacent&&!diagonal)continue;seen.add(id);
  let port={x:(a.cx+b.cx)/2,y:(a.cy+b.cy)/2};
  if(type==='offset'){if(dx)port.y+=r()<.5?-35:35;else port.x+=r()<.5?-35:35;}
  edges.push({a,b,port,weight:r()+(diagonal?-.36:0)});
 }
 // Shared edge coordinates are generated once for both adjacent tiles.
 const parent=new Map(cells.map(c=>[c.id,c.id]));
 function find(id){while(parent.get(id)!==id)id=parent.get(id);return id;}
 const chosen=[];edges.sort((a,b)=>a.weight-b.weight);
 for(const e of edges){const a=find(e.a.id),b=find(e.b.id);if(a!==b){parent.set(a,b);chosen.push(e);}else if(r()<.105)chosen.push(e);}
 for(const e of chosen){e.a.ports.push(e.port);e.b.ports.push(e.port);}
 for(const c of cells){
  // Connect internal stars with a short tree; ports meet the nearest star.
  const joined=[c.nodes[0]],left=c.nodes.slice(1);
  while(left.length){let best={d:Infinity};for(const a of joined)for(let i=0;i<left.length;i++){const dd=dist(a,left[i]);if(dd<best.d)best={d:dd,a,i};}const b=left.splice(best.i,1)[0];c.lines.push([best.a,b]);joined.push(b);}
  for(const p of c.ports){const near=c.nodes.reduce((a,b)=>dist(a,p)<dist(b,p)?a:b);c.lines.push([near,p]);}
 }
 const minX=Math.min(...cells.flatMap(c=>c.poly.map(p=>p.x)))-70,minY=Math.min(...cells.flatMap(c=>c.poly.map(p=>p.y)))-70;
 const maxX=Math.max(...cells.flatMap(c=>c.poly.map(p=>p.x)))+70,maxY=Math.max(...cells.flatMap(c=>c.poly.map(p=>p.y)))+70;
 return {type,seed,cells,edges:chosen,box:{x:minX,y:minY,w:maxX-minX,h:maxY-minY},stars:cells.reduce((n,c)=>n+c.nodes.length,0)};
}
function star(p,index=0){
 const size=p.size,glow='<circle cx="'+f(p.x)+'" cy="'+f(p.y)+'" r="'+f(size*2.8)+'" fill="#f0f2e5" opacity=".045"/>';
 const rays=p.rays?'<g transform="translate('+f(p.x)+' '+f(p.y)+') rotate('+(index%2?22:-15)+')"><path d="M0 '+f(-size*3.5)+'Q'+f(size*.38)+' '+f(-size*.3)+' '+f(size*3)+' 0 Q'+f(size*.3)+' '+f(size*.28)+' 0 '+f(size*3.5)+' Q'+f(-size*.33)+' '+f(size*.3)+' '+f(-size*3)+' 0 Q'+f(-size*.3)+' '+f(-size*.3)+' 0 '+f(-size*3.5)+'Z" fill="#edf1e6"/></g>':'';
 return glow+rays+'<circle cx="'+f(p.x)+'" cy="'+f(p.y)+'" r="'+f(size)+'" fill="#e8eee8"/>';
}
function dust(box,seed,amount){const r=rng('dust'+seed);return Array.from({length:amount},()=>'<circle cx="'+f(box.x+r()*box.w)+'" cy="'+f(box.y+r()*box.h)+'" r="'+f(.18+r()*.85)+'" fill="#c0cbc5" opacity="'+f(.07+r()*.27)+'"/>').join('');}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
function ornaments(model,cell){
 const r=rng('quiet-sky:'+model.type+':'+model.seed+':'+cell.id),dots=[],chains=[];
 const clear=p=>inside(p,cell.poly)&&cell.poly.every((a,i)=>segmentDistance(p,a,cell.poly[(i+1)%cell.poly.length])>11)&&cell.nodes.every(n=>dist(n,p)>n.size*3.5+8)&&cell.lines.every(([a,b])=>segmentDistance(p,a,b)>10);
 const point=()=>({x:cell.cx+(r()-.5)*130,y:cell.cy+(r()-.5)*130});
 // Isolated, open decorative chains stay well away from playable lines and borders.
 for(let attempt=0;attempt<55&&chains.length<2;attempt++){
  const a=point(),angle=r()*Math.PI*2,len=13+r()*14;
  const b={x:a.x+Math.cos(angle)*len,y:a.y+Math.sin(angle)*len};
  const c={x:b.x+Math.cos(angle+.5+r())*(9+r()*12),y:b.y+Math.sin(angle+.5+r())*(9+r()*12)};
  const points=[a,b,...(r()>.45?[c]:[])];
  const safeSegments=points.slice(1).every((p,i)=>Array.from({length:12},(_,j)=>({x:points[i].x+(p.x-points[i].x)*j/11,y:points[i].y+(p.y-points[i].y)*j/11})).every(clear));
  if(points.every(clear)&&safeSegments&&chains.every(old=>points.every(p=>old.every(q=>dist(p,q)>15))))chains.push(points);
 }
 for(let tries=0;tries<80&&dots.length<5;tries++){const p=point();if(clear(p)&&dots.every(q=>dist(p,q)>10)&&chains.every(chain=>chain.every(q=>dist(p,q)>8)))dots.push({...p,size:.55+r()*.65,rays:r()>.86});}
 return {dots,chains};
}
function ornamentSvg(model){let out='<g class="decorative-sky" aria-hidden="true" pointer-events="none">';for(const cell of model.cells){const o=ornaments(model,cell);for(const points of o.chains){out+='<path d="'+points.map((p,i)=>(i?'L':'M')+f(p.x)+' '+f(p.y)).join(' ')+'" stroke="#b2c4c0" stroke-width=".65" opacity=".20" fill="none"/>';for(const p of points)out+='<circle cx="'+f(p.x)+'" cy="'+f(p.y)+'" r="1.05" fill="#cbd8d2" opacity=".32"/>';}
 for(const p of o.dots){out+='<circle cx="'+f(p.x)+'" cy="'+f(p.y)+'" r="'+f(p.size)+'" fill="#cfdbd5" opacity=".40"/>';if(p.rays)out+='<path d="M'+f(p.x-2.4)+' '+f(p.y)+'h4.8M'+f(p.x)+' '+f(p.y-2.4)+'v4.8" stroke="#cedbd4" stroke-width=".45" opacity=".28"/>';}}
 return out+'</g>';}
function body(model,{grid=false,ports=false,ambient=true}={}){
 let out=ambient?ornamentSvg(model):'';
 if(grid)out+='<g fill="none" stroke="#aec6b6" stroke-width=".9" opacity=".25">'+model.cells.map(c=>'<polygon points="'+c.poly.map(p=>f(p.x)+','+f(p.y)).join(' ')+'"/>').join('')+'</g>';
 out+='<g stroke="#dae3dd" stroke-linecap="round" fill="none">';
 for(const c of model.cells)for(const [a,b] of c.lines)out+='<path d="M'+f(a.x)+' '+f(a.y)+'L'+f(b.x)+' '+f(b.y)+'" stroke-width="'+(c.nodes.length>2?'.95':'1.15')+'" opacity=".8"/>';
 out+='</g>';
 const portMap=new Map(model.cells.flatMap(c=>c.ports).map(p=>[key(p),p]));
 for(const p of portMap.values())out+='<circle cx="'+f(p.x)+'" cy="'+f(p.y)+'" r="'+(ports?4.4:.9)+'" fill="'+(ports?'#c5e6a7':'#dbe6df')+'" opacity="'+(ports?'.9':'.5')+'"/>';
 let i=0;for(const c of model.cells)for(const p of c.nodes)out+=star(p,i++);
 return out;
}
function svg(model,options={}){const b=model.box;return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+TYPES.find(t=>t.id===model.type).name+'成品星圖" viewBox="'+[b.x,b.y,b.w,b.h].map(f).join(' ')+'"><rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" fill="#222827"/>'+dust(b,model.seed,1250)+body(model,options)+'</svg>';}
function tileSvg(model,cell,index=0){
 const b={x:cell.cx-100,y:cell.cy-100,w:200,h:200},id='tile-'+model.type+'-'+index;
 const points=cell.poly.map(p=>f(p.x)+','+f(p.y)).join(' ');
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+[b.x,b.y,200,200].join(' ')+'"><defs><clipPath id="'+id+'"><polygon points="'+points+'"/></clipPath></defs><polygon points="'+points+'" fill="#222827" stroke="#8b9b92" stroke-width="1"/><g clip-path="url(#'+id+')">'+body({...model,cells:[cell]},{ports:true})+'</g></svg>';
}
const api={TYPES,build,svg,tileSvg,ornaments};if(typeof module!=='undefined')module.exports=api;else root.AtlasVisualLab=api;
})(typeof window==='undefined'?this:window);
