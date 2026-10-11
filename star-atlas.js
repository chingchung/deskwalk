(function(){
  'use strict';
  const E=window.StarAtlas,A=window.StarAtlasArt,$=id=>document.getElementById(id);
  const STORE='deskwalk-star-atlas-v4-hand';
  const shapeNames={end:'單枝',bend:'轉角',straight:'長線',fork:'分岔',cross:'交會',diagonal:'斜穿',wing:'角翼',kite:'風箏',slope:'斜折',triad:'斜岔',arrow:'箭羽',crown:'星冠',drift:'流向',compass:'羅盤',flare:'光叉',fourcorners:'四角',diagonalEnd:'角端'};
  A.setTheme('diagonal');
  let state=null,history=[],saved=null,selected=0,rotation=0,pending=null,cell=96,renderedMetrics=null;
  const showGrid=false;
  const canPlace=()=>state?.phase==='playing'&&state.stage==='place';
  const hand=()=>state?.players[state.active].hand||[];
  const currentTile=()=>canPlace()&&hand()[selected]?{...hand()[selected],rotation}:null;
  function notify(message){$('notice').textContent=message;}
  function persist(){try{localStorage.setItem(STORE,JSON.stringify({state,history}));saved={state:E.copy(state),history:E.copy(history)};}catch{notify('未能儲存進度。');}}
  function load(){try{const v=JSON.parse(localStorage.getItem(STORE));if(v?.state?.version===4&&v.state.players?.every(p=>Array.isArray(p.hand))&&Array.isArray(v.history))saved=v;}catch{}$('resume').hidden=!saved;}
  function autoSelect(){selected=Math.max(0,hand().findIndex(t=>E.moves(state.board,t).length));rotation=hand()[selected]?E.moves(state.board,hand()[selected])[0]?.rotation||0:0;pending=null;}
  const prepareTurn=s=>s.phase==='playing'&&s.stage==='draw'?E.draw(s):s;
  function enter(next,previous=[]){state=prepareTurn(next);history=previous;cell=96;autoSelect();$('setup').hidden=true;$('game').hidden=false;$('new-game').hidden=false;notify('');render();persist();requestAnimationFrame(fit);}
  function render(){renderHand();renderBoard();renderHint();
    $('players').innerHTML=state.players.map((p,i)=>{const count=state.constellations.filter(c=>c.owner===i).length;return '<span class="player '+(i===state.active&&state.phase==='playing'?'active':'')+'" style="--owner:'+A.OWNER_COLORS[i]+'" title="玩家 '+(i+1)+' · '+count+' 個星座" aria-label="玩家 '+(i+1)+'：'+count+' 個星座" '+(i===state.active&&state.phase==='playing'?'aria-current="true"':'')+'>'+A.markerSvg({owner:i,name:count+' 個星座'},state.players)+'<span>'+count+'</span></span>';}).join('');
    $('supply').textContent=state.phase==='finished'?'完成':'餘 '+state.deck.length+' 張';
    $('turn-title').innerHTML=state.phase==='finished'?'星圖完成':A.markerSvg({owner:state.active,name:'本回合'},state.players)+'<span>玩家 '+(state.active+1)+'</span>';
    $('undo').disabled=!history.length;
  }
  function renderHand(){
    const placing=canPlace(),playing=state.phase==='playing';
    $('rotate').hidden=!placing;
    const blocked=placing&&!hand().some(t=>E.moves(state.board,t).length);
    $('pass').hidden=!blocked;$('rotate').disabled=blocked;
    $('hand').innerHTML=placing?hand().map((t,i)=>'<button type="button" class="hand-tile" data-index="'+i+'" aria-label="手牌 '+(i+1)+'：'+shapeNames[t.shape]+'" aria-pressed="'+(selected===i)+'" '+(E.moves(state.board,t).length?'':'disabled')+'>'+A.tileSvg({...t,rotation:i===selected?rotation:0},{frame:false})+'</button>').join(''):playing?'<div class="hand-tile retained" role="img" aria-label="保留手牌：'+shapeNames[hand()[0].shape]+'">'+A.tileSvg(hand()[0],{frame:false})+'</div>':'';
  }
  function renderHint(){
    $('turn-hint').textContent=state.phase==='finished'?state.constellations.length+' 個星座':!canPlace()?'已有 1 張 · 再抽 1 張':!hand().some(t=>E.moves(state.board,t).length)?'兩張都無法連接':pending&&!E.placement(state.board,currentTile(),pending.x,pending.y).ok?'接不上，請旋轉':'選 1 張放下 · 另 1 張保留';
  }
  function bounds() {
    const xs = state.board.map(t=>t.x), ys = state.board.map(t=>t.y);
    return {minX:Math.min(...xs)-1,maxX:Math.max(...xs)+1,minY:Math.min(...ys)-1,maxY:Math.max(...ys)+1};
  }
  function boardMetrics() {
    const b = bounds(), viewport = $('board-scroll');
    const logicalW = (b.maxX-b.minX+1)*cell, logicalH = (b.maxY-b.minY+1)*cell;
    const top=window.innerWidth<=650?112:80,bottom=180;
    const w = Math.max(logicalW+48,viewport.clientWidth), h = Math.max(logicalH+top+bottom,viewport.clientHeight);
    return {...b,w,h,offsetX:(w-logicalW)/2,offsetY:top+(h-top-bottom-logicalH)/2};
  }
  function links(tile,board) {return E.connectedPorts(tile,board);}
  function renderBoard() {
    const b = boardMetrics(), board = $('board');
    renderedMetrics=b;
    const latest = state.log.at(-1)?.tile?.id;
    const preview = pending && canPlace() ? {...currentTile(),...pending} : null;
    const displayed = preview ? [...state.board,preview] : state.board;
    board.style.setProperty('--cell',cell+'px');
    board.style.width = b.w+'px'; board.style.height = b.h+'px';
    board.classList.toggle('show-grid',showGrid);
    const position = (x,y)=>'left:'+((x-b.minX)*cell+b.offsetX)+'px;top:'+((y-b.minY)*cell+b.offsetY)+'px';
    board.innerHTML = state.board.map(tile=>
      '<div class="board-cell placed '+(latest===tile.id?'latest':'')+'" style="'+position(tile.x,tile.y)+
      '" role="img" aria-label="'+shapeNames[tile.shape]+'星線，座標 '+tile.x+', '+tile.y+'">'+
      A.tileSvg(tile,{frame:showGrid,connections:links(tile,displayed),finished:false})+'</div>').join('');
    const joints=document.createElement('div');joints.className='joined-dots';
    joints.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="'+b.w+'" height="'+b.h+'"><g transform="translate('+(b.offsetX-b.minX*cell)+' '+(b.offsetY-b.minY*cell)+') scale('+cell/100+')">'+A.junctionContent(displayed)+'</g></svg>';
    board.appendChild(joints);
    const markers=A.markerPositions(state.board,state.constellations);
    state.constellations.forEach((c,i)=>{
      const point=markers[i];if(!point||!Number.isInteger(c.owner))return;
      const size=Math.min(26,point.clearance*cell/100*1.7);
      const badge=document.createElement('div');badge.className='ownership-marker';
      badge.dataset.constellationId=c.id;
      badge.style.cssText='left:'+((point.x/100-b.minX)*cell+b.offsetX-size/2)+'px;top:'+((point.y/100-b.minY)*cell+b.offsetY-size/2)+'px;width:'+size+'px;height:'+size+'px';
      badge.innerHTML=A.markerSvg(c,state.players);board.appendChild(badge);
    });
    const possible=new Set(canPlace()?E.moves(state.board,currentTile()).map(m=>m.x+','+m.y):[]);
    if (canPlace()) for (const p of E.candidates(state.board)) {
      const button=document.createElement('button');
      const valid=possible.has(p.x+','+p.y);
      const aligned=E.placement(state.board,currentTile(),p.x,p.y).ok;
      button.type='button';button.className='board-cell candidate'+(valid?'':' unavailable');
      button.style.cssText=position(p.x,p.y);button.dataset.x=p.x;button.dataset.y=p.y;
      button.setAttribute('aria-label',(valid?'放置星空牌於 ':'此方向無法連接，右鍵或 R 旋轉：')+p.x+', '+p.y);
      button.setAttribute('aria-disabled',String(!valid));
      button.innerHTML='<span aria-hidden="true">'+(valid?(aligned?'＋':'↻'):'·')+'</span>';
      board.appendChild(button);
    }
    renderGhost();
    $('zoom-out').disabled=cell<=32; $('zoom-in').disabled=cell>=132;
  }
  function renderGhost() {
    $('board').querySelector('.tile-ghost')?.remove();
    if(!pending||!canPlace()||!currentTile())return;
    const b=renderedMetrics,tile={...currentTile(),...pending};
    const valid=E.placement(state.board,tile,pending.x,pending.y).ok;
    const ghost=document.createElement('div');ghost.className='board-cell tile-ghost'+(valid?'':' invalid');
    ghost.setAttribute('aria-hidden','true');
    ghost.style.cssText='left:'+((pending.x-b.minX)*cell+b.offsetX)+'px;top:'+((pending.y-b.minY)*cell+b.offsetY)+'px';
    ghost.innerHTML=A.tileSvg(tile,{frame:true})+(valid?'':'<span class="invalid-mark">×</span>');
    $('board').appendChild(ghost);
  }
  function previewAt(p) {
    if(pending?.x===p?.x&&pending?.y===p?.y)return;
    pending=p;
    if(p && !E.placement(state.board,currentTile(),p.x,p.y).ok){
      const fitting=E.moves(state.board,currentTile()).find(m=>m.x===p.x&&m.y===p.y);
      if(fitting){rotation=fitting.rotation;renderHand();}
    }
    renderGhost();renderHint();
  }
  function targetPosition(target) {
    const button=target.closest('.candidate');
    return button?{x:Number(button.dataset.x),y:Number(button.dataset.y)}:null;
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
    cell=Math.max(32,Math.min(96,Math.floor(Math.min((scroll.clientWidth-48)/(b.maxX-b.minX+1),(scroll.clientHeight-(window.innerWidth<=650?292:260))/(b.maxY-b.minY+1)))));
    renderBoard();center();
  }
  function change(next,remember=true){if(remember)history.push(E.copy(state));state=prepareTurn(next);autoSelect();notify('');persist();render();}
  function commit(){if(!pending||!canPlace()||!E.placement(state.board,currentTile(),pending.x,pending.y).ok)return;
    const before=boardMetrics(),scroll=$('board-scroll'),left=scroll.scrollLeft,top=scroll.scrollTop;
    try{change(E.play(state,selected,rotation,pending.x,pending.y));const after=boardMetrics();scroll.scrollLeft=left+(before.minX-after.minX)*cell+after.offsetX-before.offsetX;scroll.scrollTop=top+(before.minY-after.minY)*cell+after.offsetY-before.offsetY;}catch(e){notify(e.message);}
  }
  function rotate(){if(!canPlace()||!currentTile())return;rotation=(rotation+1)%4;renderHand();renderBoard();renderHint();}
  $('setup-form').onsubmit=e=>{e.preventDefault();const names=Array.from({length:Number($('count').value)},(_,i)=>'玩家 '+(i+1));enter(E.create({names,seed:'sky-'+Math.random().toString(36).slice(2,9)}));persist();};
  $('resume').onclick=()=>{if(saved)enter(E.copy(saved.state),E.copy(saved.history));};
  $('new-game').onclick=()=>{$('setup').hidden=false;$('game').hidden=true;$('new-game').hidden=true;load();notify('');};
  $('pass').onclick=()=>{try{change(E.pass(state));}catch(e){notify(e.message);}};
  $('undo').onclick=()=>{if(!history.length)return;state=history.pop();autoSelect();notify('');persist();render();requestAnimationFrame(fit);};
  $('hand').onclick=e=>{const b=e.target.closest('button.hand-tile');if(!canPlace()||!b||b.disabled)return;selected=Number(b.dataset.index);rotation=E.moves(state.board,hand()[selected])[0]?.rotation||0;pending=null;renderHand();renderBoard();renderHint();};
  $('rotate').onclick=rotate;
  $('board').addEventListener('pointermove',e=>{if(e.pointerType!=='touch'&&canPlace())previewAt(targetPosition(e.target));});
  $('board').addEventListener('pointerleave',()=>{if(canPlace())previewAt(null);});
  $('board').addEventListener('focusin',e=>{if(canPlace())previewAt(targetPosition(e.target));});
  $('board').addEventListener('click',e=>{if(!canPlace())return;const p=targetPosition(e.target);if(p){previewAt(p);commit();}});
  $('board').addEventListener('contextmenu',e=>{if(!canPlace())return;e.preventDefault();const p=targetPosition(e.target);if(p)pending=p;rotate();});
  $('zoom-in').onclick=()=>{cell=Math.min(132,cell+12);renderBoard();center();};
  $('zoom-out').onclick=()=>{cell=Math.max(32,cell-12);renderBoard();center();};$('fit').onclick=fit;
  document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||$('game').hidden)return;if(e.key.toLowerCase()==='r'){e.preventDefault();rotate();}});
  let resizeFrame;window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(state&&!$('game').hidden){renderBoard();center();}});});
  load();
})();
