(function () {
  'use strict';
  const E = window.StarAtlas, A = window.StarAtlasArt;
  const $ = id => document.getElementById(id);
  const STORE = 'deskwalk-star-atlas-v2';
  const shapeNames = {end:'單枝',bend:'轉角',straight:'長線',fork:'分岔',cross:'交會'};
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state = null, history = [], selected = 0, rotation = 0, pending = null;
  let cell = 86, startedAt = performance.now(), saved = null, setupCount = 2, showGrid = false;

  function notify(message) { $('notice').textContent = message; }
  function persist() {
    if (!state || state.demo) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({state,history:history.slice(-60)}));
      saved = {state:E.copy(state),history:E.copy(history)};
    } catch { notify('未能自動儲存。可以繼續拼，並下載星圖或試玩紀錄。'); }
  }
  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(STORE));
      if (value?.state?.version === 2 && value.state.players?.length >= 2 &&
          value.state.players.length <= 6 && Array.isArray(value.state.board) &&
          Array.isArray(value.history)) saved = value;
    } catch { /* An unavailable save does not block a new sky. */ }
    $('resume').hidden = !saved;
  }
  function setupNames(count) {
    const previous = Array.from($('player-names').querySelectorAll('input')).map(i=>i.value);
    $('player-names').innerHTML = Array.from({length:count},(_,i)=>
      '<label class="field-label" for="name-'+i+'">觀星者 '+(i+1)+
      '<input id="name-'+i+'" name="player-'+i+'" maxlength="20" value="'+
      esc(previous[i] || '玩家 '+(i+1))+'" autocomplete="off"></label>').join('');
    setupCount = count;
    lengthNote();
  }
  function lengthNote() {
    const rounds = $('length').value === 'quick' ? 6 : Math.max(8,Math.ceil(36/setupCount));
    $('length-note').textContent = '每人 '+rounds+' 回合，共 '+(rounds*setupCount)+' 次放牌 · 公開 3 張，選 1 張';
  }
  function sampleBoard() {
    const rows = [[0,0,'fork',1],[1,0,'bend',2],[1,1,'cross',0],[0,1,'fork',0],
      [2,1,'bend',2],[2,2,'bend',3],[1,2,'bend',0],[-1,1,'bend',0],
      [-1,0,'straight',0],[-1,-1,'bend',1],[0,-1,'fork',2],[1,-1,'end',3]];
    return rows.map((r,i)=>({id:'cover-'+i,x:r[0],y:r[1],shape:r[2],rotation:r[3],color:['white','gold','blue'][i%3]}));
  }
  function cover() {
    $('cover-art').innerHTML = A.mapSvg(sampleBoard(),{title:'一片未被命名的星空'});
  }
  function currentTile() {
    return state?.market[selected] ? {...state.market[selected],rotation} : null;
  }
  function available() {
    const tile = currentTile();
    return tile ? E.candidates(state.board).filter(p=>E.placement(state.board,tile,p.x,p.y).ok) : [];
  }
  function autoSelect() {
    selected = Math.max(0,state.market.findIndex(t=>E.moves(state.board,t).length));
    const options = state.market[selected] ? E.moves(state.board,state.market[selected]) : [];
    rotation = options[0]?.rotation || 0;
    pending = null;
  }
  function choose(index) {
    selected = index; pending = null;
    rotation = E.moves(state.board,state.market[index])[0]?.rotation || 0;
    renderMarket(); renderBoard(); renderPlacement();
  }
  function enter(next,previous=[]) {
    state = next; history = previous; showGrid = false; cell = 86;
    autoSelect(); startedAt = performance.now();
    $('setup').hidden = true; $('artwork').hidden = true; $('game').hidden = false;
    notify(''); render();
    window.scrollTo({top:0,behavior:'instant'});
    requestAnimationFrame(fit);
  }
  function render() {
    renderPlayers(); renderMarket(); renderBoard(); renderPlacement(); renderStatus(); renderJournal();
  }
  function renderPlayers() {
    $('players').style.setProperty('--players',state.players.length);
    $('players').innerHTML = state.players.map((player,i)=>
      '<div class="player '+(i===state.active && state.phase==='playing'?'active':'')+'" '+
      (i===state.active && state.phase==='playing'?'aria-current="true"':'')+'>'+
      '<span class="player-name">'+esc(player.name)+'</span><small>'+
      (i===state.active && state.phase==='playing'?'輪到你':'已拼 '+player.moves+' 張')+'</small></div>').join('');
    $('turn-progress').textContent = state.phase==='finished' ? '這幅星圖完成了' :
      '第 '+(Math.floor(state.turn/state.players.length)+1)+' / '+state.rounds+' 輪';
  }
  function renderMarket() {
    const playing = state.phase === 'playing';
    $('play-controls').hidden = !playing;
    $('result').hidden = playing;
    $('finish').hidden = !playing;
    $('market').style.setProperty('--market',3);
    $('market').innerHTML = state.market.map((tile,i)=>{
      const playable = E.moves(state.board,tile).length > 0;
      return '<button type="button" class="market-tile" data-index="'+i+'" aria-label="星空牌 '+
        (i+1)+'：'+shapeNames[tile.shape]+(playable?'':'，暫時無位可放')+'" aria-pressed="'+
        (i===selected)+'" '+(playable?'':'disabled')+'>'+
        A.tileSvg({...tile,rotation:i===selected?rotation:0},{frame:true})+
        '<span class="tile-caption">'+shapeNames[tile.shape]+'</span></button>';
    }).join('');
    $('market').querySelectorAll('button').forEach(button=>button.onclick=()=>choose(Number(button.dataset.index)));
    $('supply').textContent = '餘下 '+(state.totalTurns-state.turn)+' 步';
    $('tile-label').textContent = currentTile() ? shapeNames[currentTile().shape]+' · '+rotation*90+'°' : '';
    $('undo').disabled = !history.length;
  }
  function bounds() {
    const xs = state.board.map(t=>t.x), ys = state.board.map(t=>t.y);
    return {minX:Math.min(...xs)-1,maxX:Math.max(...xs)+1,minY:Math.min(...ys)-1,maxY:Math.max(...ys)+1};
  }
  function boardMetrics() {
    const b = bounds(), viewport = $('board-scroll');
    const logicalW = (b.maxX-b.minX+1)*cell, logicalH = (b.maxY-b.minY+1)*cell;
    const w = Math.max(logicalW,viewport.clientWidth), h = Math.max(logicalH,viewport.clientHeight);
    return {...b,w,h,offsetX:(w-logicalW)/2,offsetY:(h-logicalH)/2};
  }
  function links(tile,board) {
    return E.ports(tile).filter(d=>{
      const neighbour=board.find(t=>t.x===tile.x+E.DIRS[d][0] && t.y===tile.y+E.DIRS[d][1]);
      return neighbour && E.ports(neighbour).includes((d+2)%4);
    });
  }
  function renderBoard() {
    const b = boardMetrics(), board = $('board');
    const latest = state.log.at(-1)?.tile.id;
    const preview = pending && state.phase==='playing' ? {...currentTile(),...pending} : null;
    const displayed = preview ? [...state.board,preview] : state.board;
    board.style.setProperty('--cell',cell+'px');
    board.style.width = b.w+'px'; board.style.height = b.h+'px';
    board.classList.toggle('show-grid',showGrid);
    const position = (x,y)=>'left:'+((x-b.minX)*cell+b.offsetX)+'px;top:'+((y-b.minY)*cell+b.offsetY)+'px';
    board.innerHTML = state.board.map(tile=>
      '<div class="board-cell placed '+(latest===tile.id?'latest':'')+'" style="'+position(tile.x,tile.y)+
      '" role="img" aria-label="'+shapeNames[tile.shape]+'星線，座標 '+tile.x+', '+tile.y+'">'+
      A.tileSvg(tile,{frame:showGrid,connections:links(tile,displayed),finished:!showGrid})+'</div>').join('');
    if (state.phase==='playing') for (const p of available()) {
      const button=document.createElement('button'), isPending=pending?.x===p.x && pending?.y===p.y;
      button.type='button'; button.className='board-cell candidate'+(isPending?' pending':'');
      button.style.cssText=position(p.x,p.y);
      button.setAttribute('aria-label','放喺 '+p.x+', '+p.y);
      button.setAttribute('aria-pressed',String(isPending));
      button.innerHTML=isPending ? A.tileSvg(preview,{frame:true,connections:links(preview,displayed),finished:false,highlight:true}) : '<span aria-hidden="true">＋</span>';
      button.onclick=()=>{pending=p;renderBoard();renderPlacement();};
      board.appendChild(button);
    }
    $('sky-count').textContent = state.board.length+' 片星光 · '+state.constellations.length+' 個環';
    $('grid-toggle').textContent = showGrid ? '隱藏牌邊' : '顯示牌邊';
    $('grid-toggle').setAttribute('aria-pressed',String(showGrid));
    $('zoom-out').disabled=cell<=32; $('zoom-in').disabled=cell>=132;
  }
  function renderPlacement() {
    $('confirm').disabled = !pending || state.phase!=='playing';
    $('rotate').disabled = !currentTile(); $('hint').disabled = !currentTile();
    $('preview-event').textContent = '';
    if (state.phase!=='playing') return;
    if (pending) {
      const next=E.play(state,selected,rotation,pending.x,pending.y);
      const count=next.log.at(-1).events.length;
      $('placement-hint').textContent='這片星光放在這裡。確認後交給下一位。';
      $('preview-event').textContent=count ? '將連成 '+count+' 個新環，分支可以繼續生長。' : '星線會從這裡繼續生長。';
      $('confirm').textContent='放好這片星光';
    } else {
      $('placement-hint').textContent=available().length ?
        '選好牌，點星空上的 ＋ 預覽。' : '這個方向暫時放不到，試試旋轉或另一張牌。';
      $('confirm').textContent='先選擇落點';
    }
  }
  function renderStatus() {
    const playing=state.phase==='playing';
    $('turn-title').innerHTML=playing ? '<p class="eyebrow">'+(state.demo?'一起試拼':'輪到你接一片')+
      '</p><h2>'+esc(state.players[state.active].name)+'</h2>' : '<p class="eyebrow">OUR SKY, COMPLETE</p>';
    const last=state.log.at(-1);
    $('receipt').textContent=last ? (last.events.length ?
      '連成了 '+last.events.length+' 個新環。到星座手記替它起個名字吧。' :
      state.players[last.player].name+' 放好一片星光。'+(playing?'輪到 '+state.players[state.active].name+'。':'我們的星圖完成了。')) :
      (state.demo?'把預覽中的星線接上，試試形成一個帶分支的環。':'選一片喜歡的星線，慢慢拼出你們的形狀。');
    if (!playing) {
      $('result').innerHTML='<h2>一起拼出的星空。</h2><p>'+state.board.length+' 片星光，'+
        state.constellations.length+' 個環。每一條分支都留在作品裡。</p>'+
        '<button id="result-art" class="primary wide">欣賞這幅星圖 ↗</button>'+
        '<button id="finish-undo" class="quiet wide" '+(history.length?'':'disabled')+'>↶ 返回完成前</button>';
      $('result-art').onclick=showArtwork; $('finish-undo').onclick=undo;
    }
  }
  function renderJournal() {
    $('constellation-count').textContent=state.constellations.length;
    $('constellations').innerHTML=state.constellations.length ? state.constellations.map((c,i)=>
      '<article class="constellation"><div class="mini-sky">'+
      A.mapSvg(state.board.filter(t=>c.tileIds.includes(t.id)),{title:c.name})+
      '</div><label class="sr-only" for="constellation-name-'+i+'">為第 '+(i+1)+' 個星座起名</label>'+
      '<input id="constellation-name-'+i+'" maxlength="24" value="'+esc(c.name)+'">'+
      '<p>第 '+String(i+1).padStart(2,'0')+' 個環 · 一起發現</p></article>').join('') :
      '<p class="empty-journal">星線連成環後，就可以在這裡替它起名。環外的分支不用收起。</p>';
    state.constellations.forEach((c,i)=>{
      $('constellation-name-'+i).oninput=e=>{c.name=e.target.value.slice(0,24);persist();};
      $('constellation-name-'+i).onchange=e=>{
        c.name=e.target.value.trim() || '未命名星座 '+(i+1);e.target.value=c.name;persist();
      };
    });
    $('session-stats').textContent='拼砌試驗 v0.2 · 牌序 '+state.seed+' · 已放 '+state.turn+' 張 · 公開牌 3 張'+
      (state.demo?' · 示範不覆蓋正式進度':'');
    $('move-log').innerHTML=state.log.slice().reverse().map(l=>
      '<div class="log-line"><span>'+String(l.turn).padStart(2,'0')+'</span><span>'+
      esc(state.players[l.player].name)+'</span><span>'+shapeNames[l.tile.shape]+
      (l.events.length?' · 連成新環':'')+'</span></div>').join('');
  }
  function center(position) {
    const b=boardMetrics(), scroll=$('board-scroll');
    scroll.scrollTo({left:position ? (position.x-b.minX+.5)*cell+b.offsetX-scroll.clientWidth/2 : (b.w-scroll.clientWidth)/2,
      top:position ? (position.y-b.minY+.5)*cell+b.offsetY-scroll.clientHeight/2 : (b.h-scroll.clientHeight)/2,
      behavior:'instant'});
  }
  function fit() {
    if (!state || $('game').hidden) return;
    const b=bounds(), scroll=$('board-scroll');
    cell=Math.max(32,Math.min(96,Math.floor(Math.min(scroll.clientWidth/(b.maxX-b.minX+1),scroll.clientHeight/(b.maxY-b.minY+1)))));
    renderBoard();center();
  }
  function commit() {
    if (!pending) return;
    try {
      const old=E.copy(state), position={...pending};
      state=E.play(state,selected,rotation,pending.x,pending.y,performance.now()-startedAt);
      history.push(old); autoSelect(); startedAt=performance.now();
      persist();render();center(position);
      if (state.phase==='finished') showArtwork();
    } catch (error) { notify(error.message); }
  }
  function undo() {
    if (!history.length) return;
    state=history.pop(); autoSelect();startedAt=performance.now();
    $('artwork').hidden=true;$('game').hidden=false;
    persist();render();requestAnimationFrame(fit);notify('已撤回一步，星圖與牌序一起還原。');
  }
  function finish() {
    if (state.phase==='playing') {
      history.push(E.copy(state));state.phase='finished';state.finishedEarly=true;persist();render();
    }
    showArtwork();
  }
  function showSetup() {
    $('setup').hidden=false;$('game').hidden=true;$('artwork').hidden=true;
    load();notify('');window.scrollTo({top:0,behavior:'instant'});
  }
  function rotate() {
    if (state?.phase!=='playing' || !currentTile()) return;
    rotation=(rotation+1)%4;pending=null;renderMarket();renderBoard();renderPlacement();
  }
  function posterSvg() {
    return A.mapSvg(state.board,{poster:true,title:state.atlasTitle || '我們的第一片星空',
      subtitle:state.players.length+' 位觀星者　／　'+state.board.length+' 片星光　／　'+state.constellations.length+' 個環',
      constellations:state.constellations});
  }
  function renderPoster() { $('poster').innerHTML=posterSvg(); }
  function showArtwork() {
    $('setup').hidden=true;$('game').hidden=true;$('artwork').hidden=false;
    $('atlas-title').value=state.atlasTitle || '';
    $('artwork-status').textContent=state.phase==='finished'?'OUR NIGHT, ON PAPER':'WORK IN PROGRESS / 星圖預覽';
    $('artwork-meta').textContent='一起拼砌：'+state.players.map(p=>p.name).join('、')+'。';
    $('back-to-game').textContent=state.phase==='finished'?'← 返回星座手記':'← 返回拼砌';
    renderPoster();notify('');window.scrollTo({top:0,behavior:'instant'});
  }
  function downloadBlob(name,blob) {
    const url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);notify('已準備下載 '+name);
  }
  function fileName(extension) {
    return (state.atlasTitle || '星圖拾光').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-')+'.'+extension;
  }
  async function exportPng() {
    const button=$('export-png');button.disabled=true;button.textContent='正在準備圖片…';
    const svg=posterSvg(), url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
    try {
      const picture=new Image();
      await new Promise((resolve,reject)=>{picture.onload=resolve;picture.onerror=reject;picture.src=url;});
      const canvas=document.createElement('canvas');
      canvas.width=picture.naturalWidth || 1200;canvas.height=picture.naturalHeight || 1500;
      const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
      context.drawImage(picture,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob)throw new Error('Export unavailable');
      downloadBlob(fileName('png'),blob);
    } catch { notify('圖片暫時未能下載，可以先下載 SVG，或稍後再試。'); }
    finally { URL.revokeObjectURL(url);button.disabled=false;button.textContent='下載圖片 PNG ↓'; }
  }

  $('count-options').innerHTML=[2,3,4,5,6].map(n=>
    '<label class="count-option"><input type="radio" name="count" value="'+n+'" '+(n===2?'checked':'')+
    '><span>'+n+'<span class="sr-only"> 人</span></span></label>').join('');
  $('count-options').addEventListener('change',e=>setupNames(Number(e.target.value)));
  setupNames(2);cover();load();
  $('length').onchange=lengthNote;
  $('setup-form').onsubmit=e=>{
    e.preventDefault();
    const names=Array.from($('player-names').querySelectorAll('input')).map(i=>i.value);
    enter(E.create({names,seed:$('seed').value.trim() || 'sky-'+Math.random().toString(36).slice(2,9),
      rounds:$('length').value==='quick'?6:undefined}));persist();
  };
  $('resume').onclick=()=>{if(saved)enter(E.copy(saved.state),E.copy(saved.history));};
  $('demo').onclick=()=>{
    enter(E.demo());selected=0;rotation=3;pending={x:0,y:1};render();
  };
  $('new-game').onclick=showSetup;$('art-new-game').onclick=showSetup;
  $('rotate').onclick=rotate;$('confirm').onclick=commit;$('undo').onclick=undo;
  $('finish').onclick=finish;
  $('hint').onclick=()=>{
    const tile=currentTile();if(!tile)return;
    const options=E.moves(state.board,tile);
    const same=options.filter(p=>p.rotation===rotation);
    const candidates=same.length?same:options;
    // Prefer a nearby connection, not an optimal move or automatic placement.
    candidates.sort((a,b)=>Math.abs(a.x)+Math.abs(a.y)-Math.abs(b.x)-Math.abs(b.y));
    const p=candidates[0];if(!p)return;
    rotation=p.rotation;pending={x:p.x,y:p.y};renderMarket();renderBoard();renderPlacement();center(p);
  };
  $('zoom-in').onclick=()=>{cell=Math.min(132,cell+12);renderBoard();center();};
  $('zoom-out').onclick=()=>{cell=Math.max(32,cell-12);renderBoard();center();};
  $('fit').onclick=fit;
  $('grid-toggle').onclick=()=>{showGrid=!showGrid;renderBoard();};
  $('view-art').onclick=showArtwork;$('journal-art').onclick=showArtwork;
  $('back-to-game').onclick=()=>{
    $('artwork').hidden=true;$('game').hidden=false;render();requestAnimationFrame(fit);
    window.scrollTo({top:0,behavior:'instant'});
  };
  $('atlas-title').oninput=e=>{state.atlasTitle=e.target.value.slice(0,32);persist();renderPoster();};
  $('export-png').onclick=exportPng;
  $('export-svg').onclick=()=>downloadBlob(fileName('svg'),new Blob([posterSvg()],{type:'image/svg+xml;charset=utf-8'}));
  $('export-log').onclick=()=>downloadBlob('星圖拾光-試玩紀錄.json',
    new Blob([JSON.stringify({exportedAt:new Date().toISOString(),rulesVersion:'0.2',state},null,2)],{type:'application/json;charset=utf-8'}));
  function toggleRules(open) {
    $('rules').hidden=!open;$('rules-toggle').setAttribute('aria-expanded',String(open));
    if(open)$('rules').scrollIntoView({block:'start',behavior:'instant'});
  }
  $('rules-toggle').onclick=()=>toggleRules($('rules').hidden);$('rules-close').onclick=()=>toggleRules(false);
  document.addEventListener('keydown',e=>{
    if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || $('game').hidden)return;
    if(e.key.toLowerCase()==='r'){e.preventDefault();rotate();}
  });
  let resizeFrame;
  window.addEventListener('resize',()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{if(state && !$('game').hidden){renderBoard();center();}});
  });
})();
