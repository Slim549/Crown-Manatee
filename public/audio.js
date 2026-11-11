// Audio manager: named events -> files in assets.js AUDIO. Missing files fail silently. Starts only after a user gesture.
import { AUDIO } from './assets.js';
const st = JSON.parse(localStorage.getItem('mcg-audio')||'{"volume":0.6,"muted":false}');
let unlocked=false, music=null; addEventListener('pointerdown',()=>{unlocked=true;},{once:true}); addEventListener('keydown',()=>{unlocked=true;},{once:true});
export const audio = {
  get settings(){return st;},
  set(k,v){st[k]=v;localStorage.setItem('mcg-audio',JSON.stringify(st)); if(music){music.volume=st.muted?0:st.volume;}},
  play(name){ if(!unlocked||st.muted||!AUDIO[name])return; const a=new Audio(AUDIO[name]); a.volume=st.volume; a.play().catch(()=>{}); },
  loop(name){ if(!unlocked||!AUDIO[name])return; if(music&&music.dataset.n===name)return; music?.pause(); music=new Audio(AUDIO[name]); music.dataset.n=name; music.loop=true; music.volume=st.muted?0:st.volume; music.play().catch(()=>{}); },
  stopLoop(){music?.pause();music=null;},
};
