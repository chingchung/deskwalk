const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('./star-atlas-engine.js'),A=require('./star-atlas-art.js');
test('a concave loop gets an interior point even when its bounding centre is outside',()=>{
 const polygon=[[0,0],[100,0],[100,20],[20,20],[20,100],[0,100]].map(([x,y])=>({x,y}));
 assert(A.polygonDistance({x:50,y:50},polygon)<0);
 const p=A.interiorPoint(polygon);assert(A.polygonDistance(p,polygon)>10);
 assert.deepEqual(A.interiorPoint(polygon),p);
});
test('diagonal and multi-star artwork produce interior star markers, including rotations',()=>{
 const s=E.play(E.demo(),0,3,0,1);
 for(let turn=0;turn<4;turn++){
  const board=s.board.map(t=>{let x=t.x,y=t.y;for(let n=0;n<turn;n++)[x,y]=[-y-1,x];return {...t,x,y,rotation:(t.rotation+turn)%4};});
  const rings=E.cycles(board),positions=A.markerPositions(board,rings);assert.equal(positions.length,1);
  assert(A.polygonDistance(positions[0],A.ringPolygon(board,rings[0]))>0);
 }
});
test('two-tile thin loops and adjacent loops get distinct interior positions',()=>{
 const board=[{id:'a',x:0,y:0,shape:'wing',rotation:0,color:'white'},{id:'b',x:1,y:0,shape:'fourcorners',rotation:0,color:'white'},{id:'c',x:2,y:0,shape:'wing',rotation:2,color:'white'}];
 const rings=E.cycles(board),positions=A.markerPositions(board,rings);assert.equal(rings.length,2);
 positions.forEach((p,i)=>assert(A.polygonDistance(p,A.ringPolygon(board,rings[i]))>0));
 assert(Math.hypot(positions[0].x-positions[1].x,positions[0].y-positions[1].y)>20);
 assert(!A.markerSvg({...rings[0],owner:0}).includes('<text'));
});
test('every claimed ring in simulated games has a marker strictly inside its artwork',()=>{
 let count=0;
 for(let run=0;run<6;run++){
  let s=E.create({seed:'meeple-'+run,rounds:10});
  while(s.phase==='playing'){
   s=E.draw(s);const moves=s.players[s.active].hand.flatMap((tile,index)=>E.moves(s.board,tile).map(m=>({...m,index})));
   if(!moves.length){s=E.pass(s);continue;}const m=moves[(s.turn*13+7)%moves.length];s=E.play(s,m.index,m.rotation,m.x,m.y);
  }
  const positions=A.markerPositions(s.board,s.constellations);
  positions.forEach((p,i)=>{assert(p,'non-degenerate ring has marker');const polygon=A.ringPolygon(s.board,s.constellations[i]);assert(A.polygonDistance(p,polygon)>0);assert(p.clearance>0);count++;});
  assert.deepEqual(A.markerPositions(E.copy(s.board),E.copy(s.constellations)),positions);
 }
 assert(count>=10);
});
