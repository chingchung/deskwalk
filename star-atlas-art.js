/* 星圖拾光 · deterministic constellation drawing and self-contained SVG prints. */
(function (root) {
  'use strict';
  const SKY = '#2b2926';
  const PAPER = '#f2eee4';
  const INK = '#39352f';
  const PORTS = [[50, 0], [100, 50], [50, 100], [0, 50]];
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const SHAPES = { end: [0], bend: [0, 1], straight: [0, 2], fork: [0, 1, 3], cross: [0, 1, 2, 3] };
  const COLORS = { blue: '#b8d1dc', gold: '#e5cd94', white: '#f3ece0' };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f = n => Math.round(n * 100) / 100;
  const key = (x, y) => `${x},${y}`;
  const rotation = t => ((Number(t.rotation) || 0) % 4 + 4) % 4;
  const ports = t => (SHAPES[t.shape] || SHAPES.end).map(d => (d + rotation(t)) % 4);

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
    const rand = random(`atlas-art:${t.id ?? t.shape}:${t.color}`);
    const x = 27 + rand() * 46, y = 27 + rand() * 46;
    const directions = SHAPES[t.shape] || SHAPES.end;
    const core = { x, y, radius: 1.9 + rand() * 1.45, rays: rand() > .62 };
    const arms = directions.map(d => {
      const [px, py] = PORTS[d], fraction = .42 + rand() * .26;
      // Each terminal is placed well inside the card. It becomes a real endpoint
      // when the open edge is hidden, rather than leaving a line cut in mid-air.
      const sx = x + (px - x) * fraction;
      const sy = y + (py - y) * fraction;
      const bend = (rand() - .5) * 12;
      return {
        d, px, py,
        x: d % 2 ? sx : sx + bend,
        y: d % 2 ? sy + bend : sy,
        star: true, radius: 1.05 + rand() * .7,
      };
    });
    return { core, arms };
  }

  function star(x, y, radius, color, rays = false) {
    let s = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(radius * 2.35)}" fill="${color}" opacity=".065"/>`;
    if (rays) {
      const a = radius * 2.8, b = radius * .36;
      s += `<path d="M${f(x)} ${f(y-a)}L${f(x+b)} ${f(y-b)}L${f(x+a)} ${f(y)}L${f(x+b)} ${f(y+b)}L${f(x)} ${f(y+a)}L${f(x-b)} ${f(y+b)}L${f(x-a)} ${f(y)}L${f(x-b)} ${f(y-b)}Z" fill="${color}" opacity=".8"/>`;
    }
    return s + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(radius)}" fill="${color}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(radius * .42)}" fill="#fff8ed" opacity=".75"/>`;
  }

  function tileContent(t, { frame = true, connections = null, highlight = false, finished = false } = {}) {
    const shape = geometry(t), turn = rotation(t), color = COLORS[t.color] || COLORS.white;
    const connected = connections === null ? null : new Set(connections);
    const paths = [], stars = [];
    let content = '';
    if (frame) content += `<rect x=".6" y=".6" width="98.8" height="98.8" rx="2" fill="${SKY}" stroke="${highlight ? '#d9c294' : '#70665a'}" stroke-opacity="${highlight ? '.9' : '.42'}" stroke-width="${highlight ? '1.5' : '.7'}"/>`;
    for (const arm of shape.arms) {
      const open = connected !== null && !connected.has((arm.d + turn) % 4);
      const terminal = arm.star || (finished && open);
      const mid = terminal ? `L${f(arm.x)} ${f(arm.y)}` : '';
      if (finished && open) {
        paths.push(`<path d="M${f(shape.core.x)} ${f(shape.core.y)}${mid}"/>`);
      } else {
        paths.push(`<path d="M${f(shape.core.x)} ${f(shape.core.y)}${mid}L${arm.px} ${arm.py}"${open ? ' opacity=".55"' : ''}/>`);
      }
      if (terminal) stars.push(star(arm.x, arm.y, arm.radius, color));
      if (frame && open) content += `<circle cx="${PORTS[(arm.d + turn) % 4][0]}" cy="${PORTS[(arm.d + turn) % 4][1]}" r="1.2" fill="#d4bea0" opacity=".65"/>`;
    }
    content += `<g transform="rotate(${turn * 90} 50 50)"><g fill="none" stroke="${highlight ? '#ead5a6' : '#b5ac9d'}" stroke-width=".85" stroke-linejoin="round" stroke-linecap="round" opacity=".79">${paths.join('')}</g>${stars.join('')}${star(shape.core.x, shape.core.y, shape.core.radius, color, shape.core.rays)}</g>`;
    return content;
  }

  function tileSvg(t, options = {}) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">${tileContent(t, options)}</svg>`;
  }

  function connectionsFor(board) {
    const map = new Map(board.map(t => [key(t.x, t.y), t]));
    return t => ports(t).filter(d => {
      const other = map.get(key(t.x + DIRS[d][0], t.y + DIRS[d][1]));
      return other && ports(other).includes((d + 2) % 4);
    });
  }

  function starCount(board) {
    // Physical stars are permanent: joining an edge never adds or removes one.
    return board.reduce((total, t) => total + 1 + geometry(t).arms.length, 0);
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
      const x = r() * width, y = r() * height, radius = .35 + r() * .8;
      dots.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(radius)}" fill="#ded2bc" opacity="${f(.12 + r() * .21)}"/>`);
    }
    return dots.join('');
  }

  function boardContent(board, showGrid) {
    const connected = connectionsFor(board);
    return board.map(t => `<g transform="translate(${f(t.x * 100)} ${f(t.y * 100)})">${tileContent(t, { frame: showGrid, connections: connected(t), finished: !showGrid })}</g>`).join('');
  }

  function mapSvg(board, { title = '我們的星圖', subtitle = '', constellations = [], poster = false, showGrid = false } = {}) {
    const box = bounds(board), stars = starCount(board), sky = boardContent(board, showGrid);
    const common = 'xmlns="http://www.w3.org/2000/svg" role="img"';
    const rawTitle = String(title || '我們的星圖');
    const titleText = esc(rawTitle);
    if (!poster) {
      const pad = 45, width = box.w + pad * 2, height = box.h + pad * 2;
      return `<svg ${common} viewBox="0 0 ${width} ${height}"><title>${titleText}</title><rect width="${width}" height="${height}" fill="${SKY}"/>${scatter(width, height, 'atlas-preview', Math.round(width * height / 4000))}<g transform="translate(${pad - box.x} ${pad - box.y})">${sky}</g></svg>`;
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
<g transform="translate(${chart.x} ${chart.y})">${scatter(chart.w, chart.h, 'atlas-poster-field', 230)}
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

  const api = { tileContent, tileSvg, mapSvg, starCount, geometry };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StarAtlasArt = api;
})(typeof window !== 'undefined' ? window : this);
