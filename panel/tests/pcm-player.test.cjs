const test=require('node:test');
const assert=require('node:assert/strict');
const PcmPlayer=require('../pcm-player.js');

function setup(){
 const sources=[];
 const context={currentTime:0,
  createBuffer(channels,count,rate){return {duration:count/rate,getChannelData:()=>new Float32Array(count)}},
  createBufferSource(){const source={stopped:false,connect(){},disconnect(){},start(t){this.time=t},stop(){this.stopped=true}};sources.push(source);return source}
 };
 return {context,sources,player:new PcmPlayer(context,{})};
}
const packet=()=>new ArrayBuffer(2048);

test('plays every sample in a two-second burst, without cancelling buffered speech',()=>{
 const {player,sources}=setup();
 for(let i=0;i<32;i++)player.push(packet());
 assert.equal(sources.length,32);
 assert.ok(sources.every(s=>!s.stopped));
 for(let i=1;i<sources.length;i++)assert.ok(Math.abs(sources[i].time-sources[i-1].time-.064)<1e-9);
 assert.ok(Math.abs(player.nextTime-(1+32*.064))<1e-9);
});

test('absorbs a 700 ms network pause and delayed batch without losing or cancelling audio',()=>{
 const {player,sources,context}=setup();
 for(let i=0;i<10;i++){context.currentTime=i*.064;player.push(packet())}
 context.currentTime=1.34;
 for(let i=0;i<12;i++)player.push(packet());
 assert.equal(sources.length,22);
 assert.equal(player.recoveries,0);
 assert.ok(sources.every(s=>!s.stopped));
 assert.ok(Math.abs(player.nextTime-(1+22*.064))<1e-9);
});

test('resumes after a long outage with a larger buffer and retains all arriving samples',()=>{
 const {player,sources,context}=setup();
 player.push(packet());context.currentTime=3;
 player.push(packet());
 assert.equal(player.recoveries,1);
 assert.equal(player.delay,1.25);
 assert.equal(sources[1].time,4.25);
 assert.ok(sources.every(s=>!s.stopped));
});

test('explicit stop immediately cancels all pending audio',()=>{
 const {player,sources}=setup();
 player.push(packet());player.push(packet());player.stop();
 assert.ok(sources.every(s=>s.stopped));
 assert.equal(player.nodes.size,0);
});

test('invalid partial samples do not disturb valid audio',()=>{
 const {player,sources}=setup();
 assert.equal(player.push(new ArrayBuffer(3)),null);
 assert.equal(sources.length,0);
});
