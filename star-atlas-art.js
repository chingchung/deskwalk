/* 星圖拾光 · deterministic constellation drawing and self-contained SVG prints. */
(function (root) {
  'use strict';
  const ENGINE=typeof module!=='undefined'&&module.exports?require('./star-atlas-engine.js'):root.StarAtlas;
  const LAB=typeof module!=='undefined'&&module.exports?require('./star-atlas-visual-lab.js'):root.AtlasVisualLab;
  const THEMES = {
    diagonal: {name:'A · 斜角星路', sky:'#222827', ink:'#e9eeea', line:'#c7d0cb', accent:'#f4f6ef', mode:'night'},
    night: {name:'00 · 夜航 / Night Atlas', sky:'#252a29', ink:'#e9eeea', line:'#c7d0cb', accent:'#f4f6ef', mode:'night'},
    noir: {name:'01 · 墨光 / Ink & Light', sky:'#f1eee6', ink:'#242321', line:'#46423e', accent:'#242321', mode:'sculpted'},
    cobalt: {name:'02 · 日光藍 / Solar Blue', sky:'#0866d9', ink:'#fff1ae', line:'#fff5cd', accent:'#ffe16b', mode:'ribbon'},
    chalk: {name:'03 · 星跡 / Chalk Orbit', sky:'#eee1c5', ink:'#159dcc', line:'#262c32', accent:'#159dcc', mode:'sketch'}
  };
  let theme = 'diagonal', SKY = THEMES.diagonal.sky;
  const setTheme = value => {theme = THEMES[value] ? value : 'noir'; SKY = THEMES[theme].sky; return THEMES[theme];};
  const OWNER_COLORS = ['#ef967a','#8eaff1','#abd294','#de9ac6','#edcd77','#75cec9'];
  const PAPER = '#f2eee4';
  const INK = '#39352f';
  const PORTS = ENGINE.PORTS.map(p=>p.map(n=>n*50));
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const SHAPES = ENGINE.SHAPES;
  const COLORS = { blue: '#b8d1dc', gold: '#e5cd94', white: '#f3ece0' };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f = n => Math.round(n * 100) / 100;
  const key = (x, y) => `${x},${y}`;
  const rotation = t => ((Number(t.rotation) || 0) % 4 + 4) % 4;
  const ports = t => ENGINE.ports(t);

  function random(seed) {
    let h = 2166136261;
    for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => {
      h += 0x6D2B79F5;
      let n = Math.imul(h ^ h >>> 15, 1 | h);
      n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
  }

  function geometry(t) {
    const rand=random(`atlas-art:${t.id ?? t.shape}:${t.color}`);
    const core={x:24+rand()*52,y:24+rand()*52,radius:3.4+rand()*.9,rays:true};
    const nodes=[core];
    if(!['end','bend','straight','fork','cross'].includes(t.shape)&&rand()>.55){
      let second;for(let i=0;i<20;i++){second={x:24+rand()*52,y:24+rand()*52,radius:2.3+rand()*.8,rays:true};if(Math.hypot(core.x-second.x,core.y-second.y)>26)break;}nodes.push(second);
    }
    const arms=(SHAPES[t.shape]||SHAPES.end).map(d=>{const [px,py]=PORTS[d],node=nodes.reduce((a,b)=>Math.hypot(a.x-px,a.y-py)<Math.hypot(b.x-px,b.y-py)?a:b);return {d,px,py,node};});
    return {core,nodes,arms};
  }
  function quietSky(t,shape,color){
    if(!LAB)return '';
    const c={id:t.id,cx:50,cy:50,poly:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],nodes:shape.nodes.map(n=>({...n,size:2})),lines:shape.arms.map(a=>[a.node,{x:a.px,y:a.py}])};
    if(shape.nodes.length>1)c.lines.push(shape.nodes);
    const o=LAB.ornaments({type:'diagonal',seed:t.id},c);
    let out='<g class="decorative-sky" aria-hidden="true" pointer-events="none">';
    for(const chain of o.chains){out+='<path d="'+chain.map((p,i)=>(i?'L':'M')+f(p.x)+' '+f(p.y)).join(' ')+'" stroke="'+color+'" stroke-width=".45" opacity=".16" fill="none"/>';for(const p of chain)out+='<circle cx="'+f(p.x)+'" cy="'+f(p.y)+'" r=".75" fill="'+color+'" opacity=".26"/>';}
    for(const p of o.dots)out+='<circle cx="'+f(p.x)+'" cy="'+f(p.y)+'" r="'+f(p.size*.7)+'" fill="'+color+'" opacity=".3"/>';
    return out+'</g>';
  }

  function star(x, y, radius, color, rays = false) {
    const p = THEMES[theme], r = radius * (rays ? 3.5 : 1.5);

    const rand = random(x+':'+y), angle = -24 + rand()*48;
    if(p.mode==='night'){
      const size=1.65+rand()*1.5;
      const glow='<circle cx="'+f(x)+'" cy="'+f(y)+'" r="'+f(size*2.7)+'" fill="'+color+'" opacity=".055"/>';
      const rays=rand()>.65?'<path d="M'+f(x-size*3.4)+' '+f(y)+'H'+f(x+size*3.4)+'M'+f(x)+' '+f(y-size*3.4)+'V'+f(y+size*3.4)+'" stroke="'+color+'" stroke-width=".5" opacity=".65"/>':'';
      return glow+rays+'<circle cx="'+f(x)+'" cy="'+f(y)+'" r="'+f(size)+'" fill="'+color+'"/>';
    }
    let path;
    if (p.mode === 'sketch') {
      const points = Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;const d=i%2?r*.15:r*(.65+rand()*.85);return f(Math.cos(a)*d)+','+f(Math.sin(a)*d);});
      path='<polygon points="'+points.join(' ')+'" fill="'+color+'"/>';
    } else {
      path='<path d="M0 '+f(-r*1.35)+' Q'+f(r*.10)+' '+f(-r*.12)+' '+f(r*1.6)+' '+f(-r*.2)+' Q'+f(r*.16)+' '+f(r*.13)+' '+f(r*.1)+' '+f(r)+' Q'+f(-r*.14)+' '+f(r*.16)+' '+f(-r*1.1)+' '+f(r*.18)+' Q'+f(-r*.12)+' '+f(-r*.16)+' 0 '+f(-r*1.35)+'Z" fill="'+color+'"/>';
    }
    return '<g transform="translate('+f(x)+' '+f(y)+') rotate('+f(angle)+')">'+path+'</g>';
  }

  function tileContent(t, { frame = true, connections = null, highlight = false, finished = false } = {}) {
    const shape=geometry(t), turn=rotation(t), p=THEMES[theme], rand=random('surface:'+t.id);
    const connected=connections===null?null:new Set(connections);
    let content=frame?'<rect x=".4" y=".4" width="99.2" height="99.2" fill="'+p.sky+'" stroke="'+p.line+'" stroke-opacity=".22" stroke-width=".8"/>':'';
    // Deterministic print grain: independent of connectivity and rotation.
    if(p.mode!=='sculpted') for(let i=0;i<68;i++)content+='<circle cx="'+f(rand()*100)+'" cy="'+f(rand()*100)+'" r="'+f(.12+rand()*.22)+'" fill="'+p.ink+'" opacity=".14"/>';
    let lines='',dots='';
    if(shape.nodes.length>1)lines+='<path class="star-link" d="M'+f(shape.nodes[0].x)+' '+f(shape.nodes[0].y)+'L'+f(shape.nodes[1].x)+' '+f(shape.nodes[1].y)+'"/>';
    for(const arm of shape.arms){
      const direction=arm.d<4?(arm.d+turn)%4:4+(arm.d-4+turn)%4;
      if(finished&&connected&&!connected.has(direction))continue;
      lines+='<path class="star-link" d="M'+f(arm.node.x)+' '+f(arm.node.y)+'L'+arm.px+' '+arm.py+'"/>';
      const r=p.mode==='night'?1.3:4;
      const path=arm.d<4?'M'+(50-r)+' 0 A'+r+' '+r+' 0 0 0 '+(50+r)+' 0 Z':'M100 0 L'+(100-r)+' 0 A'+r+' '+r+' 0 0 0 100 '+r+' Z';
      dots+='<path class="port-dot" data-port="'+arm.d+'" d="'+path+'" transform="rotate('+(arm.d<4?arm.d:arm.d-4)*90+' 50 50)" fill="'+p.ink+'"/>';
    }
    const decoration=quietSky(t,shape,p.ink);
    const stars=shape.nodes.map(n=>'<g class="tile-star">'+star(n.x,n.y,n.radius,p.accent,true)+'</g>').join('');
    return content+'<g transform="rotate('+turn*90+' 50 50)">'+decoration+'<g fill="none" stroke="'+p.ink+'" stroke-width="'+(p.mode==='night'?'.7':'1.2')+'" stroke-linecap="butt">'+lines+'</g>'+dots+stars+'</g>';
  }

  // Follow the actual drawn star/port path, not tile centres: the latter can
  // put a marker outside a thin or concave constellation.
  function ringPolygon(board,ring){
    const tiles=new Map(board.map(t=>[t.id,t])),polygon=[];
    const append=p=>{const last=polygon.at(-1);if(!last||Math.hypot(last.x-p.x,last.y-p.y)>1e-6)polygon.push(p);};
    for(let i=0;i<ring.tileIds.length;i++){
      const t=tiles.get(ring.tileIds[i]);if(!t)return [];
      const incoming=ring.junctionIds[(i+ring.tileIds.length-1)%ring.tileIds.length],outgoing=ring.junctionIds[i];
      const g=geometry(t),turn=rotation(t);
      const armAt=id=>g.arms.find(a=>ENGINE.joint(t,a.d<4?(a.d+turn)%4:4+(a.d-4+turn)%4)===id);
      const a=armAt(incoming),b=armAt(outgoing);if(!a||!b)return [];
      const world=n=>{let x=n.x,y=n.y;for(let j=0;j<turn;j++)[x,y]=[100-y,x];return {x:t.x*100+x,y:t.y*100+y};};
      append(world({x:a.px,y:a.py}));append(world(a.node));append(world(b.node));append(world({x:b.px,y:b.py}));
    }
    if(polygon.length>1&&Math.hypot(polygon[0].x-polygon.at(-1).x,polygon[0].y-polygon.at(-1).y)<1e-6)polygon.pop();
    return polygon;
  }
  function polygonDistance(p,polygon){
    let inside=false,distance=Infinity;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[i],b=polygon[j],dx=b.x-a.x,dy=b.y-a.y;
      if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
      const u=dx||dy?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy))):0;
      distance=Math.min(distance,Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy));
    }
    return (inside?1:-1)*distance;
  }
  function interiorPoint(polygon,occupied=[]){
    if(polygon.length<3)return null;
    const xs=polygon.map(p=>p.x),ys=polygon.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys);
    const size=Math.min(maxX-minX,maxY-minY);if(size<=0)return null;
    const distance=(x,y)=>Math.min(polygonDistance({x,y},polygon),...occupied.map(p=>Math.hypot(p.x-x,p.y-y)-p.radius));
    const cell=(x,y,h)=>{const d=distance(x,y);return {x,y,h,d,max:d+h*Math.SQRT2};};
    const queue=[];for(let x=minX;x<maxX;x+=size)for(let y=minY;y<maxY;y+=size)queue.push(cell(x+size/2,y+size/2,size/2));
    let best=cell((minX+maxX)/2,(minY+maxY)/2,0);
    // Branch and bound finds an interior point with room around it, even when
    // the bounding-box centre or area centroid is outside a concave loop.
    while(queue.length){queue.sort((a,b)=>a.max-b.max);const c=queue.pop();if(c.d>best.d)best=c;
      if(c.max-best.d<=.25)continue;
      const h=c.h/2;for(const dx of [-h,h])for(const dy of [-h,h])queue.push(cell(c.x+dx,c.y+dy,h));
    }
    return best.d>0?{x:best.x,y:best.y,clearance:polygonDistance(best,polygon)}:null;
  }
  function markerPositions(board,rings){
    const placed=[];
    return rings.map(ring=>{
      const polygon=ringPolygon(board,ring),point=interiorPoint(polygon,placed)||interiorPoint(polygon);
      if(!point)return null;
      placed.push({...point,radius:Math.min(18,point.clearance)});return {...point,id:ring.id};
    });
  }
  function markerSvg(c, players=[]) {
    if(!Number.isInteger(c.owner))return '';
    const color=OWNER_COLORS[c.owner%OWNER_COLORS.length];
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" role="img"><title>'+esc(players[c.owner]?.name||'玩家 '+(c.owner+1))+' · '+esc(c.name)+'</title><path class="owner-star" d="M15 2 Q17 12 28 15 Q17 17 15 28 Q13 17 2 15 Q13 13 15 2Z" fill="'+color+'" stroke="#222827" stroke-width="1.5"/></svg>';
  }

  function tileSvg(t, options = {}) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">${tileContent(t, options)}</svg>`;
  }

  function connectionsFor(board) {return t=>ENGINE.connectedPorts(t,board);}
  function starCount(board) {return board.reduce((n,t)=>n+geometry(t).nodes.length,0);}
  function junctionContent(board){
    const p=THEMES[theme],r=p.mode==='night'?1.3:4;
    return [...ENGINE.junctions(board)].filter(([,tiles])=>tiles.length>1).map(([joint])=>{
      const [x,y]=joint.split(',').map(Number);return '<circle cx="'+(x*50)+'" cy="'+(y*50)+'" r="'+r+'" fill="'+p.ink+'"/>';
    }).join('');
  }

  function bounds(board) {
    if (!board.length) return { x: 0, y: 0, w: 100, h: 100 };
    const xs = board.map(t => Number(t.x) || 0), ys = board.map(t => Number(t.y) || 0);
    const x = Math.min(...xs) * 100, y = Math.min(...ys) * 100;
    return { x, y, w: (Math.max(...xs) + 1) * 100 - x, h: (Math.max(...ys) + 1) * 100 - y };
  }

  function scatter(width, height, seed, amount) {
    const r = random(seed), dots = [];
    for (let i = 0; i < amount; i++) {
      const x = r() * width, y = r() * height, radius = THEMES[theme].mode==='night' ? .25+r()*1.1 : .35+r()*.8;
      dots.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(radius)}" fill="#ded2bc" opacity="${f(.12 + r() * .21)}"/>`);
    }
    return dots.join('');
  }

  function boardContent(board, showGrid) {
    const connected = connectionsFor(board);
    return board.map(t => `<g transform="translate(${f(t.x * 100)} ${f(t.y * 100)})">${tileContent(t, { frame: showGrid, connections: connected(t), finished: !showGrid })}</g>`).join('')+junctionContent(board);
  }

  function mapSvg(board, { title = '我們的星圖', subtitle = '', constellations = [], poster = false, showGrid = false } = {}) {
    const box = bounds(board), stars = starCount(board), sky = boardContent(board, showGrid);
    const common = 'xmlns="http://www.w3.org/2000/svg" role="img"';
    const rawTitle = String(title || '我們的星圖');
    const titleText = esc(rawTitle);
    if (!poster) {
      const pad = 45, width = box.w + pad * 2, height = box.h + pad * 2;
      return `<svg ${common} viewBox="0 0 ${width} ${height}"><title>${titleText}</title><rect width="${width}" height="${height}" fill="${SKY}"/>${scatter(width, height, 'atlas-preview', Math.round(width * height / (THEMES[theme].mode==='night'?650:4000)))}<g transform="translate(${pad - box.x} ${pad - box.y})">${sky}</g></svg>`;
    }

    const width = 1200;
    const chart = { x: 82, y: 240, w: 1036, h: 1036 };
    const safe = 82;
    const scale = Math.min((chart.w - safe * 2) / box.w, (chart.h - safe * 2) / box.h);
    const tx = chart.x + (chart.w - box.w * scale) / 2 - box.x * scale;
    const ty = chart.y + (chart.h - box.h * scale) / 2 - box.y * scale;
    const serif = 'Georgia, &quot;Noto Serif TC&quot;, &quot;Songti TC&quot;, &quot;PMingLiU&quot;, serif';
    const sans = '&quot;Helvetica Neue&quot;, &quot;PingFang TC&quot;, sans-serif';
    const names = constellations.filter(c => c.name).map(c => String(c.name));
    const ticks = [];
    for (let i = 0; i <= 24; i++) {
      const p = chart.x + chart.w * i / 24, q = chart.y + chart.h * i / 24;
      const length = i % 6 === 0 ? 12 : i % 3 === 0 ? 8 : 4;
      ticks.push(`<path d="M${f(p)} ${chart.y}v${length}M${f(p)} ${chart.y + chart.h}v-${length}M${chart.x} ${f(q)}h${length}M${chart.x + chart.w} ${f(q)}h-${length}"/>`);
    }
    const metadata = esc(JSON.stringify({ title, subtitle, tiles: board.length, stars, constellations: names }));
    const linesFor = (text, limit) => {
      const lines = []; let line = '', units = 0;
      for (const c of String(text)) {
        const weight = c.codePointAt(0) > 255 ? 1 : .56;
        if (units + weight > limit && line) { lines.push(line); line = ''; units = 0; }
        line += c; units += weight;
      }
      if (line) lines.push(line);
      return lines.length ? lines : [''];
    };
    let legend = '', legendBottom = 1390;
    if (names.length) {
      let y = 1366;
      for (let row = 0; row < Math.ceil(names.length / 3); row++) {
        let maxLines = 1;
        for (let column = 0; column < 3; column++) {
          const i = row * 3 + column;
          if (i >= names.length) continue;
          const x = 92 + column * 348, lines = linesFor(names[i], 19);
          maxLines = Math.max(maxLines, lines.length);
          legend += `<text x="${x}" y="${y}" font-family="${sans}" font-size="10" fill="#a49170">${String(i + 1).padStart(2, '0')}</text>`;
          legend += lines.map((line, n) => `<text x="${x + 28}" y="${y + n * 21}" font-family="${sans}" font-size="14" fill="#746b5b">${esc(line)}</text>`).join('');
        }
        y += maxLines * 21 + 13;
      }
      legendBottom = y - 13;
    } else {
      legend = `<text x="600" y="1370" text-anchor="middle" font-family="${serif}" font-size="17" font-style="italic" fill="#827765">A sky that belongs to us.</text>`;
    }
    const footerY = Math.max(1430, legendBottom + 38), height = footerY + 70;
    const sub = String(subtitle || `${stars} 顆星　／　${board.length} 塊星空牌　／　${constellations.length} 個星座`);
    const subLines = linesFor(sub, 68);
    const subSize = subLines.length > 2 ? Math.max(8, 14 * 2 / subLines.length) : 14;
    const titleUnits = [...rawTitle].reduce((total, c) => total + (c.codePointAt(0) > 255 ? 1.1 : .64), 0);
    const titleSize = Math.min(47, Math.max(18, 1000 / Math.max(1, titleUnits)));
    const titleSpacing = rawTitle.length > 18 ? 1 : 4;
    return `<svg ${common} viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<title>${titleText}</title><desc>共同拼砌的星圖。${stars} 顆星，${board.length} 塊星空牌。${esc(names.join('、'))}</desc><metadata>${metadata}</metadata>
<rect width="1200" height="${height}" fill="${PAPER}"/>
<rect x="36" y="36" width="1128" height="${height - 72}" fill="none" stroke="#c9bda8" stroke-width="1"/>
<path d="M52 82V52h30M1118 52h30v30M52 ${height - 82}v30h30M1118 ${height - 52}h30v-30" fill="none" stroke="#a89573" stroke-width="1"/>
<text x="600" y="98" text-anchor="middle" font-family="${sans}" font-size="12" letter-spacing="5" fill="#887957">A COLLECTIVE CELESTIAL ATLAS</text>
<text x="600" y="164" text-anchor="middle" font-family="${serif}" font-size="${titleSize}" letter-spacing="${titleSpacing}" fill="${INK}">${titleText}</text>
${subLines.map((line, i) => `<text x="600" y="${subLines.length === 1 ? 202 : 192 + i * (subSize + 4)}" text-anchor="middle" font-family="${sans}" font-size="${subSize}" letter-spacing=".6" fill="#867b68">${esc(line)}</text>`).join('')}
<rect x="${chart.x}" y="${chart.y}" width="${chart.w}" height="${chart.h}" fill="${SKY}"/>
<g transform="translate(${chart.x} ${chart.y})">${scatter(chart.w, chart.h, 'atlas-poster-field', THEMES[theme].mode==='night'?1200:230)}
<circle cx="518" cy="518" r="462" fill="none" stroke="#cfba90" stroke-width=".65" opacity=".13"/>
<circle cx="518" cy="518" r="335" fill="none" stroke="#cfba90" stroke-width=".5" stroke-dasharray="2 9" opacity=".1"/>
<path d="M32 518H1004M518 32V1004" fill="none" stroke="#cfba90" stroke-width=".55" stroke-dasharray="2 10" opacity=".11"/>
</g>
<g stroke="#b59c72" stroke-width=".85" fill="none" opacity=".5">${ticks.join('')}</g>
<g transform="translate(${f(tx)} ${f(ty)}) scale(${f(scale)})">${sky}</g>
<text x="600" y="262" text-anchor="middle" font-family="${serif}" font-size="11" fill="#bca985" letter-spacing="4">N</text>
<text x="600" y="1258" text-anchor="middle" font-family="${serif}" font-size="11" fill="#bca985" letter-spacing="4">S</text>
<path d="M92 1316H1108" stroke="#cfc4b0"/>
<text x="92" y="1340" font-family="${sans}" font-size="10" letter-spacing="2" fill="#968466">${names.length ? 'THE CONSTELLATIONS WE FOUND' : 'AN OPEN SKY · A SHARED MOMENT'}</text>
${legend}
<text x="92" y="${footerY}" font-family="${sans}" font-size="11" letter-spacing="1.5" fill="#8c806a">星圖拾光　/　deskwalk</text>
<text x="1108" y="${footerY}" text-anchor="end" font-family="${sans}" font-size="10" letter-spacing="1.5" fill="#9b8d76">MADE TOGETHER · NO TWO SKIES ALIKE</text>
</svg>`;
  }

  const api = { tileContent, tileSvg, mapSvg, starCount, geometry, junctionContent, THEMES, setTheme, markerSvg, markerPositions, ringPolygon, interiorPoint, polygonDistance, OWNER_COLORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StarAtlasArt = api;
})(typeof window !== 'undefined' ? window : this);
