// Zero-dependency authoritative game server: HTTP + Server-Sent Events. Run: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const NODES=require('./config/nodes'),RULES=require('./config/gameConfig'),QB=require('./config/questionBank').load();
const {blocked,displayName}=require('./config/nameFilter');
if(QB.report.length) console.warn('[question bank:'+QB.file+']\n  '+QB.report.slice(0,15).join('\n  ')+(QB.report.length>15?`\n  ...+${QB.report.length-15} more`:''));
const sessions=new Map(), rid=n=>crypto.randomBytes(n).toString('hex');
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
function queueFor(nodeId){
  const all=QB.bank[nodeId]||[];
  const ranked=['easy','medium','hard'].flatMap(level=>shuffle(all.filter(q=>q.difficulty===level)));
  const used=new Set(ranked.map(q=>q.id));
  return ranked.concat(all.filter(q=>!used.has(q.id)));
}
const now=()=>Date.now();

function blankRun(){ return {building:0,runs:{},revisiting:false,queue:[],qi:0,continuing:false,mode:'wait',q:null,choice:null,outcome:null,deadline:0,resultUntil:0,choiceUntil:0,current:null,number:0}; }
function newSession(){
  let code; do{code=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('');}while(sessions.has(code));
  const s={code,hostKey:rid(8),clients:new Set(),settings:{...RULES.defaults},nodeOrder:NODES.map(n=>n.id)};
  reset(s); sessions.set(code,s); return s;
}
function reset(s){
  s.phase='lobby'; s.players=s.players||{};
  for(const p of Object.values(s.players)){ p.nodes=[]; p.stats={}; p.picked=false; Object.assign(p,blankRun()); }
  s.endsAt=0;
}
const stat=(p,nid)=>p.stats[nid]||(p.stats[nid]={correct:0,incorrect:0,unanswered:0,points:0});
const total=p=>Object.values(p.stats).reduce((a,x)=>({correct:a.correct+x.correct,asked:a.asked+x.correct+x.incorrect+x.unanswered,points:a.points+x.points}),{correct:0,asked:0,points:0});
const eligible=(s,nid)=>Object.values(s.players).filter(p=>p.nodes.includes(nid));

function maybeFinish(){}
function saveRun(p){
  if(!p.current) return;
  p.runs[p.current]={queue:p.queue.map(q=>q.id),qi:p.qi,continuing:!!p.continuing};
}
function questionsFor(nodeId,ids){
  const bank=QB.bank[nodeId]||[];
  return ids.map(id=>bank.find(q=>q.id===id)).filter(Boolean);
}
function park(p){
  p.revisiting=false; p.mode='done'; p.q=null; p.current=null; p.deadline=0; p.number=0; p.choice=null; p.outcome=null;
}
function beginBuilding(s,p){
  if(p.building>=p.nodes.length) return park(p);
  p.revisiting=false;
  enterNode(s,p,p.nodes[p.building]);
}
function enterNode(s,p,nodeId){
  p.current=nodeId;
  const saved=p.runs[nodeId];
  if(saved){
    p.queue=questionsFor(nodeId,saved.queue);
    p.qi=Math.min(saved.qi,p.queue.length);
    p.continuing=p.qi>=s.settings.requiredPerNode||!!saved.continuing;
  } else {
    p.queue=queueFor(nodeId);
    p.qi=0; p.continuing=false;
  }
  p.choice=null; p.outcome=null;
  if(!p.queue.length||p.qi>=p.queue.length){
    saveRun(p);
    if(p.revisiting) return park(p);
    p.building++; return beginBuilding(s,p);
  }
  openQuestion(s,p);
}
function openQuestion(s,p){
  if(p.qi>=p.queue.length) return leaveNode(s,p);
  if(!p.continuing&&p.qi>=s.settings.requiredPerNode) return showChoice(p);
  p.q=present(p.queue[p.qi]); p.mode='question'; p.choice=null; p.outcome=null; p.number=p.qi+1; p.deadline=0;
}
function leaveNode(s,p){
  saveRun(p);
  if(p.revisiting) return park(p);
  p.building++;
  beginBuilding(s,p);
}
function revisit(s,p,nodeId){
  if(p.mode!=='done') return 'Finish your buildings first';
  if(!p.nodes.includes(nodeId)) return 'That is not one of your buildings';
  const saved=p.runs[nodeId];
  if(!saved||saved.qi>=saved.queue.length) return 'No questions left at that building';
  p.revisiting=true;
  enterNode(s,p,nodeId);
}
function showChoice(p){ p.mode='choice'; p.q=null; p.deadline=0; p.choiceUntil=0; }
function present(q){
  const order=shuffle(['A','B','C','D']);
  const choices={};
  order.forEach((src,i)=>{ choices['ABCD'[i]]=q.choices[src]; });
  return {...q, choices, correctAnswer:'ABCD'[order.indexOf(q.correctAnswer)]};
}
function grade(s,p,choice){
  const st=stat(p,p.current), q=p.q;
  if(!choice){ st.unanswered++; p.outcome='unanswered'; p.choice=null; }
  else {
    const ok=choice===q.correctAnswer; ok?st.correct++:st.incorrect++;
    st.points=Math.round((st.points+RULES.scoreAnswer(ok,s.settings,0))*100)/100;
    p.outcome=ok?'correct':'incorrect'; p.choice=choice;
  }
  p.qi++; p.mode='result';
  p.resultUntil=p.outcome==='correct'?now()+2200:0;
}
function promote(s,p){
  if(p.mode!=='result') return;
  if(!p.continuing&&p.qi>=s.settings.requiredPerNode) return showChoice(p);
  openQuestion(s,p);
}
function moveOn(s,p){
  if(p.mode==='done') return;
  if(p.mode!=='choice'&&p.qi<s.settings.requiredPerNode) return 'Finish the five questions first';
  leaveNode(s,p);
}
function keepGoing(s,p){
  if(p.mode!=='choice') return 'This is not a choice point';
  p.continuing=true; openQuestion(s,p);
}

setInterval(()=>{
  for(const s of sessions.values()) if(s.phase==='playing'){
    let changed=false;
    if(s.endsAt&&now()>=s.endsAt){ s.phase='final'; broadcast(s); continue; }
    for(const p of Object.values(s.players)){
      if(p.mode==='result'&&p.resultUntil&&now()>=p.resultUntil){ promote(s,p); changed=true; }
    }
    if(s.phase==='playing'){ const before=s.phase; maybeFinish(s); if(s.phase!==before) changed=true; }
    if(changed) broadcast(s);
  }
},250);

function results(s){
  const nodes=NODES.map(n=>{const el=eligible(s,n.id), max=Math.max(0,...el.map(p=>stat(p,n.id).correct));
    const w=el.filter(p=>stat(p,n.id).correct===max&&max>0);
    return {id:n.id,eligible:el.length,winners:w.map(p=>p.id),tie:w.length>1,unclaimed:!el.length};});
  const rows=Object.values(s.players).map(p=>({id:p.id,name:p.name,...total(p)})).map(r=>({...r,accuracy:r.asked?Math.round(100*r.correct/r.asked):0}))
    .sort((a,b)=>b.points-a.points||b.correct-a.correct);
  rows.forEach((r,i)=>{r.rank=i&&r.points===rows[i-1].points&&r.correct===rows[i-1].correct?rows[i-1].rank:i+1;});
  const top=rows.filter(r=>r.rank===1&&r.correct>0);
  return {nodes,rows,overall:top.map(r=>r.id),overallTie:top.length>1};
}
function view(s,role,pid){
  const me=s.players[pid], playing=s.phase==='playing';
  const deadline=playing?s.endsAt:0, clock=playing?'game':null;
  const v={code:s.code,phase:s.phase,settings:s.settings,now:now(),clock,deadline,paused:false,pausedLeft:0,
    minPlayers:RULES.minPlayers,picks:RULES.picksRequired,endsAt:s.endsAt,
    players:Object.values(s.players).map(p=>{const t=total(p);return {id:p.id,name:displayName(p.name),connected:p.connected,picked:p.picked,
      nodes:role==='host'||p.id===pid||s.phase==='playing'||s.phase==='final'?p.nodes:undefined,correct:t.correct,points:t.points,currentNode:playing||s.phase==='final'?p.current:null,
      mode:p.mode,progress:p.qi,
      status:p.mode==='question'?'answering':p.mode==='result'?p.outcome:p.mode==='choice'?'choosing':p.mode==='done'?'done':undefined};}),
    results:s.phase==='final'?results(s):undefined,nodeScores:{}};
  for(const n of NODES) v.nodeScores[n.id]=Object.fromEntries(eligible(s,n.id).map(p=>[p.id,stat(p,n.id).correct]));
  if(role==='player'&&me){
    v.me={id:me.id,nodes:me.nodes,mode:me.mode,currentNode:me.current,number:me.number,required:s.settings.requiredPerNode,bonus:!!me.continuing,revisiting:!!me.revisiting,
      buildings:me.nodes.map(id=>{const run=me.runs[id], st=stat(me,id), asked=run?run.qi:0, totalQ=run?run.queue.length:0;
        return {id,asked,left:Math.max(0,totalQ-asked),correct:st.correct,points:st.points};})};
    if(playing&&me.q&&(me.mode==='question'||me.mode==='result')){
      const closed=me.mode==='result';
      v.question={id:me.q.id,prompt:me.q.prompt,choices:me.q.choices,number:me.number,required:s.settings.requiredPerNode,bonus:!!me.continuing,home:!!me.revisiting,
        myChoice:closed?me.choice:undefined,outcome:closed?me.outcome:undefined,
        correctAnswer:closed&&s.settings.revealCorrect?me.q.correctAnswer:undefined};
    }
  }
  return v;
}
function broadcast(s){ for(const c of s.clients){ try{c.res.write('data: '+JSON.stringify(view(s,c.role,c.pid))+'\n\n');}catch{} } }

const A={
  openSelection(s){ if(s.phase!=='lobby')return 'bad phase'; if(Object.values(s.players).filter(p=>p.connected).length<RULES.minPlayers)return `Need at least ${RULES.minPlayers} players`; s.phase='select'; },
  lock(s){ if(s.phase!=='select')return 'bad phase'; if(!Object.values(s.players).some(p=>p.picked))return 'No player has chosen yet'; s.phase='locked'; },
  start(s){ if(s.phase!=='locked')return 'bad phase'; s.phase='playing'; s.endsAt=now()+s.settings.gameMinutes*60000;
    for(const p of Object.values(s.players)) if(p.picked) beginBuilding(s,p); },
  end(s){ s.phase='final'; },
  reset(s){ reset(s); },
  settings(s,v){ const d=s.settings,n=x=>Math.max(1,Math.min(600,+x|0));
    if(s.phase==='playing'||s.phase==='final')return 'Change settings between games';
    if('gameMinutes' in v)d.gameMinutes=Math.max(5,Math.min(90,n(v.gameMinutes)));
    if('questionSeconds' in v)d.questionSeconds=Math.max(5,Math.min(120,n(v.questionSeconds)));
    if('requiredPerNode' in v)d.requiredPerNode=Math.max(1,Math.min(30,n(v.requiredPerNode)));
    if('maxQuestions' in v||'questionsPerPlayerPerNode' in v)d.maxQuestions=Math.min(30,n(v.maxQuestions||v.questionsPerPlayerPerNode));
    if('pointsPerCorrect' in v)d.pointsPerCorrect=n(v.pointsPerCorrect);
    for(const k of ['speedBonus','revealCorrect']) if(k in v) d[k]=!!v[k];
    if(Array.isArray(v.nodeOrder)&&v.nodeOrder.length===10&&NODES.every(x=>v.nodeOrder.includes(x.id))) s.nodeOrder=v.nodeOrder; },
};
const json=(res,code,o)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(o));};
const body=req=>new Promise(r=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{r(JSON.parse(b||'{}'));}catch{r({});}});});
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.mp3':'audio/mpeg'};

http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x');
  if(u.pathname==='/api/meta') return json(res,200,{nodes:NODES,rules:{picks:RULES.picksRequired,min:RULES.minPlayers,required:RULES.defaults.requiredPerNode}});
  if(u.pathname==='/api/session'){ const s=sessions.get((u.searchParams.get('code')||'').toUpperCase()); if(!s) return json(res,404,{error:'Invalid join code'}); return json(res,200,{ok:1,phase:s.phase}); }
  if(u.pathname==='/events'){ const s=sessions.get(u.searchParams.get('code')); if(!s){res.writeHead(404);return res.end();}
    const role=u.searchParams.get('role')==='host'&&u.searchParams.get('key')===s.hostKey?'host':'player', pid=u.searchParams.get('pid'), p=s.players[pid];
    if(role==='player'&&!p){res.writeHead(403);return res.end();}
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});
    const c={res,role,pid}; s.clients.add(c); if(p)p.connected=true; broadcast(s);
    req.on('close',()=>{s.clients.delete(c); if(p&&![...s.clients].some(x=>x.pid===pid)){p.connected=false;broadcast(s);}}); return; }
  if(req.method==='POST'&&u.pathname.startsWith('/api/')){
    const b=await body(req), act=u.pathname.slice(5);
    if(act==='create'){ const s=newSession(); const m=+b.gameMinutes; if(m>=5&&m<=90) s.settings.gameMinutes=Math.round(m); return json(res,200,{code:s.code,hostKey:s.hostKey}); }
    const s=sessions.get(String(b.code||'').toUpperCase()); if(!s) return json(res,404,{error:'Invalid join code'});
    if(act==='join'){ const name=String(b.name||'').trim().slice(0,18); if(!name)return json(res,400,{error:'Enter a name'});
      if(blocked(name))return json(res,400,{error:'That name isn\'t allowed. Choose another.'});
      let p=b.pid&&s.players[b.pid]; if(p)return json(res,200,{pid:p.id,code:s.code});
      if(s.phase!=='lobby')return json(res,400,{error:'Game already started'});
      if(Object.values(s.players).some(x=>x.name.toLowerCase()===name.toLowerCase()))return json(res,400,{error:'Name already taken'});
      p={id:rid(6),name,nodes:[],stats:{},picked:false,connected:false,...blankRun()}; s.players[p.id]=p; broadcast(s); return json(res,200,{pid:p.id,code:s.code}); }
    if(act==='select'){ const p=s.players[b.pid]; if(!p||s.phase!=='select')return json(res,400,{error:'Selection is not open'});
      const picked=[...new Set(b.nodes)].filter(id=>NODES.some(x=>x.id===id)); if(picked.length!==RULES.picksRequired)return json(res,400,{error:`Pick exactly ${RULES.picksRequired}`});
      p.nodes=s.nodeOrder.filter(id=>picked.includes(id)); p.picked=true; broadcast(s); return json(res,200,{ok:1}); }
    if(act==='answer'||act==='advance'||act==='continue'||act==='move'||act==='revisit'){
      const p=s.players[b.pid]; if(!p||s.phase!=='playing')return json(res,400,{error:'The game is not accepting answers'});
      if(act==='revisit'){ const err=revisit(s,p,b.node); if(err)return json(res,400,{error:err}); broadcast(s); return json(res,200,{ok:1}); }
      if(act==='answer'){
        if(p.mode!=='question'||!p.q||b.qid!==p.q.id) return json(res,p.q&&b.qid===p.q.id?409:400,{error:p.mode==='result'?'Already submitted':'Answer not accepted'});
        if(!'ABCD'.includes(b.choice)||!b.choice) return json(res,400,{error:'Bad choice'});
        grade(s,p,b.choice); broadcast(s); return json(res,200,{ok:1});
      }
      const err=act==='advance'?(p.mode==='result'?(promote(s,p),null):'Nothing to advance'):act==='continue'?keepGoing(s,p):moveOn(s,p);
      if(err) return json(res,400,{error:err});
      broadcast(s); return json(res,200,{ok:1});
    }
    if(b.key!==s.hostKey)return json(res,403,{error:'Not host'});
    if(!A[act])return json(res,404,{error:'Unknown action'});
    const err=A[act](s,b.value); if(err)return json(res,400,{error:err}); broadcast(s); return json(res,200,{ok:1});
  }
  let f=u.pathname==='/'||u.pathname==='/host'||u.pathname==='/play'?'/index.html':u.pathname; f=path.join(__dirname,'public',path.normalize(f));
  if(!f.startsWith(path.join(__dirname,'public'))||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(res);
}).listen(process.env.PORT||3000,()=>console.log('Manatee County Game on http://localhost:'+(process.env.PORT||3000)));
