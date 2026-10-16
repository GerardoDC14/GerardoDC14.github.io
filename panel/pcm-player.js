'use strict';

// Buffer network jitter without discarding already received microphone audio.
class PcmPlayer {
  constructor(context, destination, {sampleRate=16000, delay=1.0}={}) {
    this.context=context;
    this.destination=destination;
    this.sampleRate=sampleRate;
    this.delay=delay;
    this.nextTime=0;
    this.nodes=new Set();
    this.started=false;
    this.recoveries=0;
  }

  push(bytes) {
    const view=new DataView(bytes);
    if(view.byteLength===0 || view.byteLength%2!==0) return null;
    const count=view.byteLength/2;
    const buffer=this.context.createBuffer(1,count,this.sampleRate);
    const samples=buffer.getChannelData(0);
    let energy=0;
    for(let i=0;i<count;i++) {
      samples[i]=view.getInt16(i*2,true)/32768;
      energy+=samples[i]*samples[i];
    }
    const now=this.context.currentTime;
    if(!this.started) {
      this.nextTime=now+this.delay;
      this.started=true;
    } else if(this.nextTime<now) {
      // A longer interruption requires more protection on subsequent arrivals.
      // Resume after a pause; never cancel buffered words to catch up.
      this.delay=Math.min(2.5,this.delay+0.25);
      this.nextTime=now+this.delay;
      this.recoveries++;
    }
    const source=this.context.createBufferSource();
    source.buffer=buffer;
    source.connect(this.destination);
    this.nodes.add(source);
    source.onended=()=>{source.disconnect();this.nodes.delete(source)};
    source.start(this.nextTime);
    this.nextTime+=buffer.duration;
    return {level:Math.min(1,Math.sqrt(energy/count)*4),bufferSeconds:this.nextTime-now,recoveries:this.recoveries};
  }

  stop() {
    for(const source of this.nodes) {
      try {source.stop()} catch {}
      source.disconnect();
    }
    this.nodes.clear();
    this.nextTime=0;
    this.started=false;
  }
}

if(typeof module!=='undefined' && module.exports) module.exports=PcmPlayer;
else globalThis.PcmPlayer=PcmPlayer;
