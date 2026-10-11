const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./star-atlas-engine.js'), A=require('./star-atlas-art.js');
test('edge and corner markers match ports, decorative sky never counts as stars',()=>{
 for(const theme of Object.keys(A.THEMES))for(const shape of Object.keys(E.SHAPES)){
  A.setTheme(theme);const tile={id:'port-test',shape,rotation:0,color:'white'},g=A.geometry(tile);
  const svg=A.tileSvg(tile,{frame:false,finished:false,connections:[]});
  assert.equal((svg.match(/class="port-dot"/g)||[]).length,E.SHAPES[shape].length);
  assert.equal((svg.match(/class="tile-star"/g)||[]).length,g.nodes.length);
  assert.equal((svg.match(/class="star-link"/g)||[]).length,E.SHAPES[shape].length+g.nodes.length-1);
  assert.equal(A.starCount([tile]),g.nodes.length);
  for(const d of E.SHAPES[shape])assert(svg.includes('data-port="'+d+'"'));
 }
});
test('last draw completes the game without generating extra cards',()=>{
 const s=E.demo();s.deck=[];const n=E.play(s,0,3,0,1);assert.equal(n.phase,'finished');assert.equal(n.deck.length,0);assert.equal(n.players[0].hand.length,1);
});
test('closing player claims the ring; undo snapshot and serialized ownership survive',()=>{
 const before=E.demo(),snapshot=JSON.stringify(before),next=E.play(before,0,3,0,1);
 assert.equal(next.constellations[0].owner,0);
 assert.equal(next.constellations[0].markerTileId,'d3');
 assert.equal(JSON.stringify(before),snapshot);
 assert.equal(JSON.parse(JSON.stringify(next)).constellations[0].owner,0);
 const drawn=E.draw(next),hand=drawn.players[drawn.active].hand,index=hand.findIndex(t=>E.moves(drawn.board,t).length),move=E.moves(drawn.board,hand[index])[0];
 const later=E.play(drawn,index,move.rotation,move.x,move.y);
 assert.equal(later.constellations[0].owner,0);
 assert.equal(E.copy(before).constellations.length,0);
});
test('each newly closed ring belongs to the active player, including multi-ring moves',()=>{
 const s=E.create({names:['A','B'],rounds:2});
 s.board=[['a',0,0,'bend',1],['b',1,0,'fork',2],['c',2,0,'bend',2],['d',0,1,'bend',0],['e',2,1,'bend',3]].map(([id,x,y,shape,rotation])=>({id,x,y,shape,rotation,color:'white'}));
 s.active=1;s.stage='place';s.players[1].hand.push(s.deck.shift());s.players[1].hand[0]={id:'closing',shape:'fork',rotation:0,color:'white'};
 const n=E.play(s,0,0,1,1);
 assert.equal(n.log.at(-1).events.length,2);
 assert(n.constellations.every(c=>c.owner===1&&c.markerTileId==='closing'));
});
test('art themes preserve geometry and deterministic output for all tile shapes',()=>{
 for(const shape of Object.keys(E.SHAPES)){
  const t={id:'fixed-'+shape,shape,color:'white',rotation:0},geometry=JSON.stringify(A.geometry(t));
  const variants=[];
  for(const theme of Object.keys(A.THEMES)){
   A.setTheme(theme);variants.push(A.tileSvg(t));
   assert.equal(A.tileSvg(t),A.tileSvg(t));assert.equal(JSON.stringify(A.geometry(t)),geometry);
   for(const arm of A.geometry(t).arms)assert.deepEqual([arm.px,arm.py],E.PORTS[arm.d].map(n=>n*50));
   assert(A.tileSvg({...t,rotation:1}).includes('rotate(90 50 50)'));
  }
  assert.equal(new Set(variants).size,Object.keys(A.THEMES).length);
 }
});
