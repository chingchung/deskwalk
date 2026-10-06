const assert=require('node:assert/strict');
const {test}=require('node:test');
const E=require('./star-atlas-engine.js');
const t=(id,x,y,shape,rotation=0,color='white')=>({id,x,y,shape,rotation,color});
const square=(prefix='',dx=0)=>[t(prefix+'a',dx,0,'bend',1),t(prefix+'b',dx+1,0,'bend',2),t(prefix+'c',dx+1,1,'bend',3),t(prefix+'d',dx,1,'bend',0)];

test('rotation preserves ports, including the four-way star',()=>{
 assert.deepEqual(E.ports(t('a',0,0,'fork',1)),[1,2,0]);
 assert.deepEqual(E.ports(t('a',0,0,'bend',4)),[0,1]);
 assert.deepEqual([...E.ports(t('a',0,0,'cross',3))].sort(),[0,1,2,3]);
});
test('all touching edges must match; overlap and diagonal-only are rejected',()=>{
 const board=[t('a',0,0,'end',1)];assert(E.placement(board,t('b',0,0,'end',3),1,0).ok);
 assert(!E.placement(board,t('b',0,0,'end',0),1,0).ok);assert(!E.placement(board,t('b',0,0,'end'),0,0).ok);
 assert(!E.placement(board,t('b',0,0,'end'),1,1).ok);assert(E.placement(board,t('b',0,0,'end',0),0,-1).ok);
 const corner=[...board,t('c',1,-1,'end',2)];assert(!E.placement(corner,t('b',0,0,'end',3),1,0).ok);
 assert.deepEqual(E.candidates([]),[{x:0,y:0}]);
});
test('a ring is discovered while its outward branch stays open, without personal scores',()=>{
 const s=E.demo(),before=JSON.stringify(s),next=E.play(s,0,3,0,1);
 assert.equal(JSON.stringify(s),before);assert.equal(next.constellations.length,1);
 const ring=next.constellations[0];assert.equal(ring.size,4);assert.equal(ring.edges.length,4);assert.equal(ring.edgeKeys.length,4);
 assert.equal(new Set(ring.tileIds).size,4);assert.equal(E.groups(next.board)[0].open,1);
 assert.equal(next.active,1);assert.equal(next.phase,'playing');assert.equal(next.market.length,3);
 assert(next.players.every(p=>!('score' in p)&&!('targets' in p)));assert(!('discoverer' in ring));
 assert.equal(next.log[0].player,0);assert.deepEqual(next.log[0].events,[ring]);
});
test('growing and finishing a branch never rediscovers its existing ring',()=>{
 let s=E.play(E.demo(),0,3,0,1),first=E.copy(s.constellations[0]);
 s.market[0]=t('extension',0,0,'straight');s=E.play(s,0,0,-1,-1);
 assert.equal(s.constellations.length,1);assert.deepEqual(s.constellations[0],first);assert.equal(s.log.at(-1).events.length,0);
 s.market[0]=t('leaf',0,0,'end');s=E.play(s,0,2,-1,-2);
 assert.equal(s.constellations.length,1);assert.deepEqual(s.constellations[0],first);assert.equal(E.groups(s.board)[0].open,0);
});
test('a closed tree or a two-star fragment has no ring',()=>{
 const tree=[t('a',0,0,'fork'),t('b',0,-1,'end',2),t('c',1,0,'end',3),t('d',-1,0,'end',1)];
 assert.equal(E.groups(tree)[0].open,0);assert.equal(E.groups(tree)[0].branch,true);assert.deepEqual(E.cycles(tree),[]);
 assert.deepEqual(E.cycles([t('a',0,0,'end',1),t('b',1,0,'end',3)]),[]);
});
test('a second ring can borrow a previous path without changing the first ring',()=>{
 const board=[t('a',0,0,'bend',1),t('b',1,0,'fork',2),t('c',1,1,'fork'),t('d',0,1,'bend')];
 const first=E.cycles(board);assert.equal(first.length,1);
 board.push(t('e',2,0,'bend',2),t('f',2,1,'bend',3));
 const all=E.cycles(board);assert.equal(all.length,2);assert.deepEqual(all[0],first[0]);
 assert.notEqual(all[0].id,all[1].id);assert.equal(all[1].size,4);
 assert.equal(all[0].edgeKeys.filter(edge=>all[1].edgeKeys.includes(edge)).length,1);
 assert.equal(new Set(all.map(c=>c.id)).size,all.length);
});
test('joining two existing star groups preserves both rings without creating a third',()=>{
 const left=square('l'),right=square('r',3);left[1].shape='fork';left[1].rotation=2;right[0].shape='fork';right[0].rotation=2;
 const before=[...left,...right],rings=E.cycles(before);assert.equal(rings.length,2);assert.equal(E.groups(before).length,2);
 const bridge=t('bridge',2,0,'straight',1);assert(E.placement(before,bridge,2,0).ok);
 const after=[...before,bridge];assert.equal(E.groups(after).length,1);assert.deepEqual(E.cycles(after),rings);
});
test('dense graphs record independent rings, rather than every combinatorial perimeter',()=>{
 const grid=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)grid.push(t(`${x}:${y}`,x,y,'cross'));
 const rings=E.cycles(grid),g=E.groups(grid)[0];assert.equal(rings.length,49);assert.equal(rings.length,g.edges-g.size+1);
 for(const ring of rings){assert.equal(ring.size,ring.edges.length);assert.equal(new Set(ring.tileIds).size,ring.size);assert.equal(new Set(ring.edgeKeys).size,ring.size);}
});
test('fixed seed reproduces all public choices and state without private hands',()=>{
 const s=E.create({seed:'replay'});assert.deepEqual(s,E.create({seed:'replay'}));assert.notDeepEqual(s.deck,E.create({seed:'other'}).deck);
 assert.equal(s.version,2);assert(s.players.every(p=>!('hand' in p)));assert.equal(s.marketSize,3);
});
test('invalid actions are rejected and cannot alter the source state',()=>{
 const s=E.create(),before=JSON.stringify(s);assert.throws(()=>E.play(s,99,0,1,0));assert.throws(()=>E.play(s,0,9,1,0));assert.throws(()=>E.play(s,0,0,0,0));assert.equal(JSON.stringify(s),before);
 assert.throws(()=>E.create({names:['Only one']}));assert.throws(()=>E.create({rounds:0}));
});
test('an exhausted or unusable supply refills three public choices and always permits a move',()=>{
 const s=E.demo();s.board[0].shape='bend';s.board[0].rotation=1;
 s.market=[s.market[0],t('unusable-a',0,0,'cross'),t('unusable-b',0,0,'cross')];s.deck=[t('unusable-c',0,0,'cross')];
 const next=E.play(s,0,3,0,1);assert.equal(E.groups(next.board)[0].open,0);assert.equal(next.discarded,3);
 assert.equal(next.market.length,3);assert.equal(next.rescueDraws,3);assert(next.market.some(tile=>E.moves(next.board,tile).length));
 assert.equal(new Set(next.market.map(tile=>tile.id)).size,3);
});
for(let n=2;n<=6;n++)test(`${n} players each place one tile per turn, see three choices, and finish equally`,()=>{
 let s=E.create({names:Array.from({length:n},(_,i)=>`P${i+1}`),seed:`players-${n}`}),steps=0;
 while(s.phase==='playing'){
  assert.equal(s.market.length,3);assert.equal(s.marketSize,3);assert.equal(s.active,steps%n);
  const choices=s.market.flatMap((tile,index)=>E.moves(s.board,tile).map(m=>({...m,index})));assert(choices.length,'There must be a legal move after any rescue draw');
  const choice=choices[(steps*13+7)%choices.length],old=JSON.stringify(s),oldLength=s.board.length,next=E.play(s,choice.index,choice.rotation,choice.x,choice.y,1000);
  assert.equal(JSON.stringify(s),old);assert.equal(next.board.length,oldLength+1);assert.equal(next.log.at(-1).player,steps%n);
  s=next;steps++;assert(steps<=s.totalTurns);
 }
 assert.equal(steps,s.totalTurns);assert(s.players.every(p=>p.moves===s.rounds));assert.equal(s.market.length,3);
 assert.equal(new Set(s.cycleIds).size,s.cycleIds.length);assert.deepEqual(s.constellations.map(c=>c.id),s.cycleIds);
 assert.equal(s.log.flatMap(e=>e.events).length,s.constellations.length);assert.throws(()=>E.play(s,0,0,4,4));
 console.log(`${n}p: ${steps} placements; ${s.constellations.length} rings; ${s.discarded} discarded; ${s.rescueDraws} rescue draws`);
});
test('serialized undo restores the exact future, including stable ring identity',()=>{
 const s=E.demo(),snapshot=E.copy(s),next=E.play(s,0,3,0,1);assert.deepEqual(E.play(snapshot,0,3,0,1),next);
 next.constellations[0].name='紙飛機座';const persisted=E.copy(next);assert.equal(persisted.constellations[0].name,'紙飛機座');
 assert.deepEqual(E.cycles(persisted.board).map(c=>c.id),persisted.cycleIds);
});
