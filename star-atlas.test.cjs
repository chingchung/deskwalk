const assert=require('node:assert/strict');
const {test}=require('node:test');
const E=require('./star-atlas-engine.js');
const t=(id,x,y,shape,rotation=0,color='white')=>({id,x,y,shape,rotation,color});
function legacyDemo(){const s=E.create({names:['A','B'],seed:'cardinal',rounds:6});s.demo=true;s.board=[t('d0',-1,0,'fork',1,'blue'),t('d1',0,0,'bend',2),t('d2',-1,1,'bend',0,'gold')];s.stage='place';s.players[s.active].hand=[t('d3',0,0,'bend',0,'blue'),t('d4',0,0,'straight')];return s;}
const square=(prefix='',dx=0)=>[t(prefix+'a',dx,0,'bend',1),t(prefix+'b',dx+1,0,'bend',2),t(prefix+'c',dx+1,1,'bend',3),t(prefix+'d',dx,1,'bend',0)];

test('rotation preserves ports, including the four-way star',()=>{
 assert.deepEqual(E.ports(t('a',0,0,'fork',1)),[1,2,0]);
 assert.deepEqual(E.ports(t('a',0,0,'bend',4)),[0,1]);
 assert.deepEqual([...E.ports(t('a',0,0,'cross',3))].sort(),[0,1,2,3]);
});
test('at least one real port must match; overlap and blank-only contact are rejected',()=>{
 const board=[t('a',0,0,'end',1)];assert(E.placement(board,t('b',0,0,'end',3),1,0).ok);
 assert(!E.placement(board,t('b',0,0,'end',0),1,0).ok);assert(!E.placement(board,t('b',0,0,'end'),0,0).ok);
 assert(!E.placement(board,t('b',0,0,'end'),1,1).ok);assert(!E.placement(board,t('b',0,0,'end',0),0,-1).ok);
 const corner=[...board,t('c',1,-1,'end',2)];assert(E.placement(corner,t('b',0,0,'end',3),1,0).ok);
 assert.deepEqual(E.candidates([]),[{x:0,y:0}]);
});
test('a ring is discovered while its outward branch stays open, without personal scores',()=>{
 const s=legacyDemo(),before=JSON.stringify(s),next=E.play(s,0,3,0,1);
 assert.equal(JSON.stringify(s),before);assert.equal(next.constellations.length,1);
 const ring=next.constellations[0];assert.equal(ring.size,4);assert.equal(ring.edges.length,4);assert.equal(ring.edgeKeys.length,4);
 assert.equal(new Set(ring.tileIds).size,4);assert.equal(E.groups(next.board)[0].open,1);
 assert.equal(next.active,1);assert.equal(next.phase,'playing');assert.equal(next.players[0].hand.length,1);
 assert(next.players.every(p=>!('score' in p)&&!('targets' in p)));assert(!('discoverer' in ring));
 assert.equal(next.log[0].player,0);assert.deepEqual(next.log[0].events,[ring]);
});
test('growing and finishing a branch never rediscovers its existing ring',()=>{
 let s=E.play(legacyDemo(),0,3,0,1),first=E.copy(s.constellations[0]);
 s=E.draw(s);s.players[s.active].hand[0]=t('extension',0,0,'straight');s=E.play(s,0,0,-1,-1);
 assert.equal(s.constellations.length,1);assert.deepEqual(s.constellations[0],first);assert.equal(s.log.at(-1).events.length,0);
 s=E.draw(s);s.players[s.active].hand[0]=t('leaf',0,0,'end');s=E.play(s,0,2,-1,-2);
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
test('fixed seed deals one private tile per player and a finite deck',()=>{
 const s=E.create({seed:'replay'});assert.deepEqual(s,E.create({seed:'replay'}));assert.notDeepEqual(s.deck,E.create({seed:'other'}).deck);
 assert.equal(s.version,4);assert(s.players.every(p=>p.hand.length===1));assert.equal(s.deck.length,s.totalTurns);assert(!('market' in s));
});
test('draw exactly once, keep the unplayed tile, and reject invalid actions immutably',()=>{
 const s=E.create(),before=JSON.stringify(s);assert.throws(()=>E.play(s,0,0,1,0));
 const d=E.draw(s);assert.equal(JSON.stringify(s),before);assert.equal(d.players[0].hand.length,2);assert.equal(d.players[1].hand.length,1);assert.equal(d.deck.length,s.deck.length-1);
 assert.throws(()=>E.draw(d));assert.throws(()=>E.play(d,99,0,1,0));assert.throws(()=>E.play(d,0,9,1,0));assert.throws(()=>E.play(d,0,0,0,0));assert.throws(()=>E.pass(d));
 const index=d.players[0].hand.findIndex(t=>E.moves(d.board,t).length),keep=d.players[0].hand[1-index],m=E.moves(d.board,d.players[0].hand[index])[0];
 const n=E.play(d,index,m.rotation,m.x,m.y);assert.deepEqual(n.players[0].hand,[keep]);assert.equal(n.stage,'draw');assert.equal(n.active,1);assert.throws(()=>E.play(n,0,0,2,2));
 assert.throws(()=>E.create({names:['Only one']}));assert.throws(()=>E.create({rounds:0}));
});
test('blocked hands discard only the new draw and never generate rescue cards',()=>{
 const s=E.draw(E.create());s.board=[t('closed-a',0,0,'end',1),t('closed-b',1,0,'end',3)];
 const original=E.copy(s.players[0].hand[0]),fresh=E.copy(s.players[0].hand[1]),old=JSON.stringify(s);
 const n=E.pass(s);assert.equal(JSON.stringify(s),old);assert.deepEqual(n.players[0].hand,[original]);assert.deepEqual(n.discarded,[fresh]);assert.equal(n.phase,'finished');assert.equal(n.finishReason,'no-connections');
});
test('a sealed sky finishes without drawing forever',()=>{
 const s=legacyDemo();s.board[0].shape='bend';s.board[0].rotation=1;
 const n=E.play(s,0,3,0,1);assert.equal(n.phase,'finished');assert.equal(n.finishReason,'no-connections');assert.equal(n.players[0].hand.length,1);
});
for(let count=2;count<=6;count++)test(count+' players draw one, play one, keep one until the finite deck ends',()=>{
 let s=E.create({names:Array.from({length:count},(_,i)=>'P'+i),seed:'players-'+count}),steps=0;
 const initial=s.deck.length+count;
 while(s.phase==='playing'){
  assert(s.players.every(p=>p.hand.length===1));assert.equal(s.active,steps%count);
  const d=E.draw(s),actor=d.active,choices=d.players[actor].hand.flatMap((tile,index)=>E.moves(d.board,tile).map(m=>({...m,index})));
  const previous=JSON.stringify(d);if(choices.length){const m=choices[(steps*13+7)%choices.length];s=E.play(d,m.index,m.rotation,m.x,m.y);}else s=E.pass(d);
  assert.equal(JSON.stringify(d),previous);assert(s.players.every(p=>p.hand.length===1));
  const all=[...s.board.slice(1),...s.deck,...s.players.flatMap(p=>p.hand),...s.discarded];assert.equal(all.length,initial);assert.equal(new Set(all.map(t=>t.id)).size,initial);
  steps++;assert(steps<=s.totalTurns);
 }
 assert.equal(E.groups(s.board).length,1);assert.equal(new Set(s.cycleIds).size,s.cycleIds.length);assert.deepEqual(s.constellations.map(c=>c.id),s.cycleIds);
 if(s.finishReason==='deck-empty'){assert.equal(s.deck.length,0);assert.equal(steps,s.totalTurns);}else assert.equal(s.finishReason,'no-connections');
 assert.throws(()=>E.draw(s));assert.throws(()=>E.play(s,0,0,4,4));
});
test('serialized undo restores the exact future, including stable ring identity',()=>{
 const s=legacyDemo(),snapshot=E.copy(s),next=E.play(s,0,3,0,1);assert.deepEqual(E.play(snapshot,0,3,0,1),next);
 next.constellations[0].name='紙飛機座';const persisted=E.copy(next);assert.equal(persisted.constellations[0].name,'紙飛機座');
 assert.deepEqual(E.cycles(persisted.board).map(c=>c.id),persisted.cycleIds);
});
