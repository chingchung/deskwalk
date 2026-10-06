/* 星圖拾光 v0.2 · a shared sky, with stable rings and no individual score. */
(function (root) {
  'use strict';
  const DIRS = [[0,-1],[1,0],[0,1],[-1,0]];
  const SHAPES = { end:[0], bend:[0,1], straight:[0,2], fork:[0,1,3], cross:[0,1,2,3] };
  const COLORS = ['blue','gold','white'];
  const key = (x,y) => `${x},${y}`;
  const copy = o => JSON.parse(JSON.stringify(o));
  const edgeKey = (a,b) => JSON.stringify([a,b].sort());
  function hash(seed) { let h=2166136261; for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0; }
  function rng(seed) {let a=hash(seed);return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function ports(t) {return SHAPES[t.shape].map(d=>(d+(t.rotation||0))%4);}
  function candidates(board){if(!board.length)return [{x:0,y:0}];const taken=new Set(board.map(t=>key(t.x,t.y)));const out=new Map();for(const t of board)for(const [dx,dy] of DIRS){const x=t.x+dx,y=t.y+dy,k=key(x,y);if(!taken.has(k))out.set(k,{x,y});}return [...out.values()];}
  function placement(board,tile,x,y) {
    if(!tile || !SHAPES[tile.shape] || !Number.isInteger(x)||!Number.isInteger(y))return {ok:false,reason:'請先揀一塊星空牌。'};
    const map=new Map(board.map(t=>[key(t.x,t.y),t]));
    if(map.has(key(x,y)))return {ok:false,reason:'呢個位置已經有牌。'};
    let adjacent=false;const p=ports(tile);
    for(let d=0;d<4;d++){const n=map.get(key(x+DIRS[d][0],y+DIRS[d][1]));if(!n)continue;adjacent=true;if(p.includes(d)!==ports(n).includes((d+2)%4))return {ok:false,reason:'相鄰牌嘅連線需要對齊，空白邊亦要接空白邊。'};}
    return adjacent||board.length===0?{ok:true}:{ok:false,reason:'新牌至少要貼住一塊牌嘅邊。'};
  }
  function moves(board,tile){const result=[];for(let r=0;r<4;r++)for(const p of candidates(board))if(placement(board,{...tile,rotation:r},p.x,p.y).ok)result.push({...p,rotation:r});return result;}
  function groups(board){
    const map=new Map(board.map(t=>[key(t.x,t.y),t])),seen=new Set(),result=[];
    for(const origin of board){if(seen.has(origin.id))continue;const stack=[origin],nodes=[];let open=0,edges=0;
      while(stack.length){const t=stack.pop();if(seen.has(t.id))continue;seen.add(t.id);nodes.push(t);
        for(const d of ports(t)){const n=map.get(key(t.x+DIRS[d][0],t.y+DIRS[d][1]));if(n&&ports(n).includes((d+2)%4)){edges++;if(!seen.has(n.id))stack.push(n);}else open++;}
      }
      result.push({id:nodes.map(t=>t.id).sort().join('|'),tileIds:nodes.map(t=>t.id),size:nodes.length,open,closed:open===0,edges:edges/2,loop:edges/2>=nodes.length,branch:nodes.some(t=>ports(t).length>=3),counts:Object.fromEntries(COLORS.map(c=>[c,nodes.filter(t=>t.color===c).length]))});
    }return result;
  }
  // Add edges in placement order, never reordering old edges. A forest records a
  // single stable path between connected stars; each extra edge closes one ring.
  // This yields E − V + components independent rings, without enumerating the
  // exponentially many possible walks through a dense constellation.
  function cycles(board){
    const at=new Map(),forest=new Map(),parents=new Map(),result=[];
    function root(id){let current=id;while(parents.get(current)!==current)current=parents.get(current);return current;}
    function path(from,to){const todo=[from],previous=new Map([[from,null]]);for(let i=0;i<todo.length&&!previous.has(to);i++)for(const n of forest.get(todo[i]))if(!previous.has(n)){previous.set(n,todo[i]);todo.push(n);}const nodes=[];for(let node=to;node!==null;node=previous.get(node))nodes.push(node);return nodes.reverse();}
    for(const t of board){
      parents.set(t.id,t.id);forest.set(t.id,[]);
      for(const d of ports(t)){
        const n=at.get(key(t.x+DIRS[d][0],t.y+DIRS[d][1]));if(!n||!ports(n).includes((d+2)%4))continue;
        const a=root(t.id),b=root(n.id);
        if(a!==b){parents.set(a,b);forest.get(t.id).push(n.id);forest.get(n.id).push(t.id);}
        else {
          const tileIds=path(t.id,n.id),edges=tileIds.map((id,i)=>[id,tileIds[(i+1)%tileIds.length]]),edgeKeys=edges.map(([u,v])=>edgeKey(u,v)).sort();
          result.push({id:JSON.stringify(edgeKeys),tileIds,size:tileIds.length,edges,edgeKeys});
        }
      }
      at.set(key(t.x,t.y),t);
    }
    return result;
  }
  function ensureMarket(s){
    function fill(){while(s.market.length<3){if(s.deck.length)s.market.push(s.deck.shift());else{s.market.push({id:`rescue-${s.rescueDraws++}`,shape:'end',color:COLORS[(s.turn+s.rescueDraws)%3],rotation:0});}}}
    fill();
    if(s.phase!=='playing')return;
    while(!s.market.some(t=>moves(s.board,t).length)){
      s.discarded+=s.market.length;s.market=[];fill();
    }
    // A terminal tile always fits beyond an extreme row of a finite board:
    // it either joins that exposed port or faces away from the blank edge.
    // Thus rescue draws terminate, preserve three public choices and equal turns.
  }
  function create({names=['玩家 1','玩家 2'],seed='starlight',rounds}={}){
    if(names.length<2||names.length>6)throw new Error('支援 2–6 人');
    const n=names.length,r=rng(seed),perPlayer=rounds??Math.max(8,Math.ceil(36/n));
    if(!Number.isInteger(perPlayer)||perPlayer<1||perPlayer>30)throw new Error('回合數無效');
    const marketSize=3,totalTurns=n*perPlayer,amount=totalTurns+marketSize;
    const shapePool=shuffle(Array.from({length:amount},(_,i)=>i<Math.round(amount*.10)?'end':i<Math.round(amount*.45)?'bend':i<Math.round(amount*.65)?'straight':i<Math.round(amount*.95)?'fork':'cross'),r);
    const colorPool=shuffle(Array.from({length:amount},(_,i)=>COLORS[i%3]),r);
    const players=names.map((name,i)=>({name:String(name).trim().slice(0,20)||`玩家 ${i+1}`,moves:0}));
    const s={version:2,seed:String(seed),players,rounds:perPlayer,totalTurns,turn:0,active:0,marketSize,market:[],deck:shapePool.map((shape,i)=>({id:`tile-${i}`,shape,color:colorPool[i],rotation:0})),board:[{id:'origin',x:0,y:0,shape:'fork',color:'white',rotation:0}],constellations:[],cycleIds:[],log:[],discarded:0,rescueDraws:0,phase:'playing',demo:false};ensureMarket(s);return s;
  }
  function play(state,index,rotation,x,y,durationMs=0){
    if(state.phase!=='playing')throw new Error('呢局已經完結。');
    if(!Number.isInteger(index)||!state.market[index])throw new Error('請選擇星空牌。');
    if(!Number.isInteger(rotation)||rotation<0||rotation>3)throw new Error('旋轉方向無效');
    const tile={...state.market[index],rotation,x,y},valid=placement(state.board,tile,x,y);if(!valid.ok)throw new Error(valid.reason);
    const s=copy(state),actor=s.active,seen=new Set(s.cycleIds);s.board.push(tile);s.market.splice(index,1);s.players[actor].moves++;
    const events=[];
    for(const ring of cycles(s.board))if(!seen.has(ring.id)){
      s.cycleIds.push(ring.id);seen.add(ring.id);
      const c={...ring,number:s.constellations.length+1,name:`第 ${s.constellations.length+1} 星座`,turn:s.turn+1};s.constellations.push(c);events.push(c);
    }
    s.log.push({turn:s.turn+1,player:actor,tile:{...tile},durationMs:Number.isFinite(durationMs)?Math.max(0,Math.round(durationMs)):0,events});
    s.turn++;if(s.turn>=s.totalTurns)s.phase='finished';else s.active=s.turn%s.players.length;ensureMarket(s);return s;
  }
  function demo(){
    const s=create({names:['玩家 1','玩家 2'],seed:'DEMO',rounds:6});s.demo=true;
    s.board=[{id:'d0',x:-1,y:0,shape:'fork',color:'blue',rotation:1},{id:'d1',x:0,y:0,shape:'bend',color:'white',rotation:2},{id:'d2',x:-1,y:1,shape:'bend',color:'gold',rotation:0}];
    s.market=[{id:'d3',shape:'bend',color:'blue',rotation:0},{id:'d4',shape:'straight',color:'white',rotation:0},{id:'d5',shape:'fork',color:'gold',rotation:0}];return s;
  }
  const api={DIRS,SHAPES,COLORS,key,copy,ports,candidates,placement,moves,groups,cycles,create,play,demo};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StarAtlas=api;
})(typeof window!=='undefined'?window:this);
