/* 星圖拾光 v0.4 · a shared sky, with stable rings and ownership markers. */
(function (root) {
  'use strict';
  const DIRS = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];
  const PORTS = [[1,0],[2,1],[1,2],[0,1],[2,0],[2,2],[0,2],[0,0]];
  const SHAPES = { end:[0], bend:[0,1], straight:[0,2], fork:[0,1,3], cross:[0,1,2,3],
    diagonal:[4,6], wing:[4,5], kite:[0,5], slope:[0,6],
    triad:[0,4,6], arrow:[1,4,6], crown:[0,4,7], drift:[2,4,7],
    compass:[0,2,4,6], flare:[1,3,4,6], fourcorners:[4,5,6,7], diagonalEnd:[4]
  };
  const DECK_SHAPES=['diagonal','wing','kite','slope','triad','triad','arrow','arrow','crown','drift','compass','flare','fourcorners'];
  const COLORS = ['blue','gold','white'];
  const key = (x,y) => `${x},${y}`;
  const copy = o => JSON.parse(JSON.stringify(o));
  const edgeKey = (a,b) => JSON.stringify([a,b].sort());
  function hash(seed) { let h=2166136261; for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0; }
  function rng(seed) {let a=hash(seed);return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function ports(t) {const r=((t.rotation||0)%4+4)%4;return SHAPES[t.shape].map(d=>d<4?(d+r)%4:4+(d-4+r)%4);}
  function joint(t,d){const p=PORTS[d];return key(t.x*2+p[0],t.y*2+p[1]);}
  function junctions(board){const result=new Map();for(const t of board)for(const d of ports(t)){const k=joint(t,d);if(!result.has(k))result.set(k,[]);result.get(k).push(t);}return result;}
  function connectedPorts(t,board){const points=junctions(board);return ports(t).filter(d=>points.get(joint(t,d))?.some(n=>n.id!==t.id));}
  function candidates(board){if(!board.length)return [{x:0,y:0}];const taken=new Set(board.map(t=>key(t.x,t.y)));const out=new Map();for(const t of board)for(const [dx,dy] of DIRS){const x=t.x+dx,y=t.y+dy,k=key(x,y);if(!taken.has(k))out.set(k,{x,y});}return [...out.values()];}
  function placement(board,tile,x,y) {
    if(!tile||!SHAPES[tile.shape]||!Number.isInteger(x)||!Number.isInteger(y))return {ok:false,reason:'請先選擇星空牌。'};
    const map=new Map(board.map(t=>[key(t.x,t.y),t]));
    if(map.has(key(x,y)))return {ok:false,reason:'這個位置已經有牌。'};
    const p=ports(tile);
    // One shared physical port is enough. Other line ends may remain open,
    // including midpoints touching a blank edge on the neighbouring tile.
    const points=junctions(board),placed={...tile,x,y};
    return !board.length||p.some(d=>points.has(joint(placed,d)))?{ok:true}:{ok:false,reason:'至少要有一個邊中點或角落接口接上現有星圖。'};
  }
  function moves(board,tile){const result=[];for(let r=0;r<4;r++)for(const p of candidates(board))if(placement(board,{...tile,rotation:r},p.x,p.y).ok)result.push({...p,rotation:r});return result;}
  function groups(board){
    const points=junctions(board),seen=new Set(),result=[];
    for(const origin of board){if(seen.has(origin.id))continue;const stack=[origin],nodes=[],jointIds=new Set();let incidences=0,open=0;
      while(stack.length){const t=stack.pop();if(seen.has(t.id))continue;seen.add(t.id);nodes.push(t);
        for(const d of ports(t)){const k=joint(t,d),others=points.get(k);incidences++;jointIds.add(k);if(others.length===1)open++;for(const n of others)if(!seen.has(n.id))stack.push(n);}
      }
      // Collapse junctions for the public count, never into a clique at a shared corner.
      const edges=incidences-jointIds.size;
      result.push({id:nodes.map(t=>t.id).sort().join('|'),tileIds:nodes.map(t=>t.id),size:nodes.length,open,closed:open===0,edges,loop:edges>=nodes.length,branch:nodes.some(t=>ports(t).length>=3),counts:Object.fromEntries(COLORS.map(c=>[c,nodes.filter(t=>t.color===c).length]))});
    }return result;
  }
  function cycles(board){
    // Tile nodes attach to explicit junction nodes. Three or four tiles touching
    // one corner form a junction, not a spurious triangle or multiple fake rings.
    const forest=new Map(),parents=new Map(),result=[],tileByNode=new Map();
    const add=id=>{if(!parents.has(id)){parents.set(id,id);forest.set(id,[]);}};
    function root(id){while(parents.get(id)!==id)id=parents.get(id);return id;}
    function path(from,to){const todo=[from],previous=new Map([[from,null]]);for(let i=0;i<todo.length&&!previous.has(to);i++)for(const n of forest.get(todo[i]))if(!previous.has(n)){previous.set(n,todo[i]);todo.push(n);}const nodes=[];for(let node=to;node!==null;node=previous.get(node))nodes.push(node);return nodes.reverse();}
    for(const t of board){const tid='tile:'+t.id;add(tid);tileByNode.set(tid,t.id);
      for(const d of ports(t)){const jid='joint:'+joint(t,d);add(jid);const a=root(tid),b=root(jid);
        if(a!==b){parents.set(a,b);forest.get(tid).push(jid);forest.get(jid).push(tid);}
        else {
          const nodeIds=path(tid,jid),tileIds=nodeIds.filter(n=>tileByNode.has(n)).map(n=>tileByNode.get(n));
          const edges=tileIds.map((id,i)=>[id,tileIds[(i+1)%tileIds.length]]),edgeKeys=edges.map(([u,v])=>edgeKey(u,v)).sort();
          const jointEdges=nodeIds.map((id,i)=>edgeKey(id,nodeIds[(i+1)%nodeIds.length])).sort();
          result.push({id:JSON.stringify(jointEdges),tileIds,size:tileIds.length,edges,edgeKeys,junctionIds:nodeIds.filter(n=>n.startsWith('joint:')).map(n=>n.slice(6))});
        }
      }
    }return result;
  }
  function create({names=['玩家 1','玩家 2'],seed='starlight',rounds}={}){
    if(names.length<2||names.length>6)throw new Error('支援 2–6 人');
    const n=names.length,r=rng(seed),perPlayer=rounds??Math.max(8,Math.ceil(36/n));
    if(!Number.isInteger(perPlayer)||perPlayer<1||perPlayer>30)throw new Error('回合數無效');
    const totalTurns=n*perPlayer,amount=totalTurns+n;
    const shapes=shuffle(Array.from({length:amount},(_,i)=>DECK_SHAPES[i%DECK_SHAPES.length]),r);
    const colors=shuffle(Array.from({length:amount},(_,i)=>COLORS[i%3]),r);
    const deck=shapes.map((shape,i)=>({id:'tile-'+i,shape,color:colors[i],rotation:0}));
    const players=names.map((name,i)=>({name:String(name).trim().slice(0,20)||'玩家 '+(i+1),moves:0,hand:[deck.shift()]}));
    return {version:4,seed:String(seed),players,rounds:perPlayer,totalTurns,turn:0,active:0,deck,
      board:[{id:'origin',x:0,y:0,shape:'fourcorners',color:'white',rotation:0}],
      constellations:[],cycleIds:[],log:[],discarded:[],phase:'playing',stage:'draw'};
  }
  function draw(state){
    if(state.phase!=='playing'||state.stage!=='draw')throw new Error('本回合已抽牌。');
    if(!state.deck.length)throw new Error('牌堆已用完。');
    const s=copy(state);s.players[s.active].hand.push(s.deck.shift());s.stage='place';return s;
  }
  function advance(s){
    s.turn++;s.stage='draw';
    if(!s.deck.length||s.turn>=s.totalTurns){s.phase='finished';s.finishReason='deck-empty';}
    else if(!Object.keys(SHAPES).some(shape=>moves(s.board,{shape}).length)){
      s.phase='finished';s.finishReason='no-connections';
    }else s.active=(s.active+1)%s.players.length;
    return s;
  }
  function play(state,index,rotation,x,y,durationMs=0){
    if(state.phase!=='playing'||state.stage!=='place')throw new Error('請先抽一張牌。');
    if(!Number.isInteger(index)||!state.players[state.active].hand[index])throw new Error('請選擇手牌。');
    if(!Number.isInteger(rotation)||rotation<0||rotation>3)throw new Error('旋轉方向無效');
    const tile={...state.players[state.active].hand[index],rotation,x,y};
    const valid=placement(state.board,tile,x,y);if(!valid.ok)throw new Error(valid.reason);
    const s=copy(state),actor=s.active,seen=new Set(s.cycleIds);
    s.board.push(tile);s.players[actor].hand.splice(index,1);s.players[actor].moves++;
    const events=[];
    for(const ring of cycles(s.board))if(!seen.has(ring.id)){
      s.cycleIds.push(ring.id);seen.add(ring.id);
      const c={...ring,number:s.constellations.length+1,name:'第 '+(s.constellations.length+1)+' 星座',turn:s.turn+1,owner:actor,markerTileId:tile.id};
      s.constellations.push(c);events.push(c);
    }
    s.log.push({turn:s.turn+1,player:actor,tile:{...tile},durationMs:Number.isFinite(durationMs)?Math.max(0,Math.round(durationMs)):0,events});
    return advance(s);
  }
  // Only available when neither card has a legal position in any rotation.
  // Keep the original hand and discard this turn's draw; never silently replace cards.
  function pass(state){
    if(state.phase!=='playing'||state.stage!=='place')throw new Error('請先抽牌。');
    if(state.players[state.active].hand.some(t=>moves(state.board,t).length))throw new Error('仍有可放的手牌。');
    const s=copy(state),tile=s.players[s.active].hand.pop();s.discarded.push(tile);
    s.log.push({turn:s.turn+1,player:s.active,passed:true,tile,events:[]});return advance(s);
  }
  function demo(){
    const s=create({names:['玩家 1','玩家 2'],seed:'DEMO',rounds:6});s.stage='place';
    s.board=[{id:'d0',x:-1,y:0,shape:'wing',color:'blue',rotation:0},{id:'d1',x:0,y:-1,shape:'wing',color:'white',rotation:1},{id:'d2',x:1,y:0,shape:'crown',color:'gold',rotation:3}];
    s.players[0].hand=[{id:'d3',shape:'wing',color:'blue',rotation:0},{id:'d4',shape:'compass',color:'white',rotation:0}];return s;
  }
  const api={DIRS,PORTS,SHAPES,DECK_SHAPES,joint,junctions,connectedPorts,COLORS,key,copy,ports,candidates,placement,moves,groups,cycles,create,draw,play,pass,demo};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StarAtlas=api;
})(typeof window!=='undefined'?window:this);
