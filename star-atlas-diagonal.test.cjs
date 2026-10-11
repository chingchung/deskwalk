const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('./star-atlas-engine.js'),A=require('./star-atlas-art.js');
const tile=(id,x,y,shape,rotation=0)=>({id,x,y,shape,rotation,color:'white'});
test('corner rotation follows 90 degree physical coordinates',()=>{
 assert.deepEqual(E.ports(tile('a',0,0,'kite',1)),[1,6]);
 for(const shape of Object.keys(E.SHAPES)){
  const a=tile('a',0,0,shape),base=E.ports(a);
  assert.deepEqual(E.ports({...a,rotation:4}),base);
  assert.deepEqual(E.ports({...a,rotation:1}).map(d=>E.PORTS[d]),base.map(d=>[2-E.PORTS[d][1],E.PORTS[d][0]]));
 }
});
test('diagonal placement needs a matching physical corner',()=>{
 const board=[tile('a',0,0,'diagonalEnd')];
 assert(E.placement(board,tile('b',0,0,'diagonalEnd',2),1,-1).ok);
 assert(!E.placement(board,tile('b',0,0,'diagonalEnd',0),1,-1).ok);
 assert(!E.placement(board,tile('b',0,0,'end',0),0,-1).ok);
 assert(E.candidates(board).some(p=>p.x===1&&p.y===-1));
});
test('a shared corner connects 4 tiles without creating any rings',()=>{
 const b=[tile('a',0,0,'diagonalEnd',1),tile('b',1,0,'diagonalEnd',2),tile('c',0,1,'diagonalEnd'),tile('d',1,1,'diagonalEnd',3)];
 assert.equal(E.junctions(b).size,1);assert.equal(E.groups(b).length,1);assert.equal(E.cycles(b).length,0);
 assert.equal(E.groups(b)[0].edges,3);assert.equal(E.groups(b)[0].loop,false);
});
test('two tiles sharing two distinct corners form one real ring',()=>{
 const b=[tile('a',0,0,'wing'),tile('b',1,0,'wing',2)];
 assert(E.placement(b.slice(0,1),b[1],1,0).ok);assert.equal(E.cycles(b).length,1);
 assert.equal(E.cycles(b)[0].junctionIds.length,2);
});

test('a diagonal fits between two tiles despite unmatched top and left midpoints',()=>{
 // Screenshot regression: above exposes S/SE; left exposes E/SE.
 const above=tile('above',0,-1,'crown',2); // S, SW, SE
 const left=tile('left',-1,0,'triad',1); // E, SE, NW
 const candidate=tile('candidate',0,0,'diagonal'); // NE and SW
 const board=[above,left];
 assert(E.placement(board,candidate,0,0).ok);
 assert.deepEqual(E.connectedPorts(candidate,[...board,candidate]).sort(),[4,6]);
 assert(E.moves(board,candidate).some(m=>m.x===0&&m.y===0&&m.rotation===0));
 assert.equal(E.groups([...board,candidate]).length,1);
 assert.equal(E.cycles([...board,candidate]).length,0);
 for(let turn=0;turn<4;turn++){
  const rotate=t=>{let x=t.x,y=t.y;for(let n=0;n<turn;n++)[x,y]=[-y-1,x];return {...t,x,y,rotation:(t.rotation+turn)%4};};
  const c=rotate(candidate);assert(E.placement(board.map(rotate),c,c.x,c.y).ok);
 }
 const distant=tile('distant',3,3,'diagonal');assert(!E.placement(board,distant,3,3).ok);
});
test('diagonal demonstration closes a ring for the active player and undo is exact',()=>{
 const s=E.demo(),old=JSON.stringify(s),n=E.play(s,0,3,0,1);
 assert.equal(n.constellations.length,1);assert.equal(n.constellations[0].owner,0);
 assert.equal(n.constellations[0].tileIds.length,4);assert.equal(JSON.stringify(s),old);
 assert.deepEqual(E.play(JSON.parse(old),0,3,0,1),n);
});
test('growth at an existing corner cannot reassign a claimed ring',()=>{
 let s=E.play(E.demo(),0,3,0,1),first=E.copy(s.constellations[0]);
 s=E.draw(s);const options=s.players[s.active].hand.flatMap((t,index)=>E.moves(s.board,t).map(m=>({...m,index})));
 const m=options[0];s=E.play(s,m.index,m.rotation,m.x,m.y);
 assert.deepEqual(s.constellations[0],first);
});
test('new games use diagonal deck, preserve fixed stars and do not load old rules version',()=>{
 const s=E.create({seed:'A'});assert.equal(s.version,4);assert(s.players.flatMap(p=>p.hand).concat(s.deck).every(t=>E.SHAPES[t.shape].some(d=>d>=4)));
 for(const t of s.players.flatMap(p=>p.hand)){const before=JSON.stringify(t),g=A.geometry(t);assert(g.nodes.length>=1&&g.nodes.length<=2);A.setTheme('diagonal');A.tileSvg(t);assert.equal(JSON.stringify(t),before);assert.equal(A.starCount([t]),g.nodes.length);}
});
test('finished artwork hides unused port tails while gameplay retains all connection options',()=>{
 const t=tile('art',0,0,'wing',1);
 assert.equal((A.tileSvg(t,{finished:false,connections:[5]}).match(/class="port-dot"/g)||[]).length,2);
 const final=A.tileSvg(t,{finished:true,connections:[5]});
 assert.equal((final.match(/class="port-dot"/g)||[]).length,1);
 assert(final.includes('data-port="4"'));
});
