// Loads data/questions.json (your real bank) else data/questions.sample.json (PLACEHOLDER text).
// Validates; malformed questions are dropped and reported -- never crashes.
const fs=require('fs'),path=require('path'); const NODES=require('./nodes');
function load(){
  const real=path.join(__dirname,'../data/questions.json'), sample=path.join(__dirname,'../data/questions.sample.json');
  const file=fs.existsSync(real)?real:sample, report=[], bank={}, ids=new Set();
  let raw=[]; try{ raw=JSON.parse(fs.readFileSync(file,'utf8')); }catch(e){ report.push('Cannot read '+file+': '+e.message); }
  if(!Array.isArray(raw)){ report.push('Bank must be an array of {nodeId, questions[]}'); raw=[]; }
  for(const n of NODES){
    const entry=raw.find(r=>r.nodeId===n.id); bank[n.id]=[];
    if(!entry){ report.push(`${n.id}: missing node`); continue; }
    const d={easy:0,medium:0,hard:0}, ks=['A','B','C','D'];
    for(const q of entry.questions||[]){
      const bad=[];
      if(!q.id||ids.has(q.id)) bad.push('missing/duplicate id'); if(!q.prompt) bad.push('no prompt');
      if(!q.choices||ks.some(k=>!String(q.choices[k]||'').trim())) bad.push('needs 4 non-empty choices A-D');
      if(!ks.includes(q.correctAnswer)) bad.push('correctAnswer must be A-D');
      if(!(q.difficulty in d)) bad.push('difficulty must be easy|medium|hard');
      if(bad.length){ report.push(`${n.id}/${q.id||'?'}: ${bad.join('; ')}`); continue; }
      ids.add(q.id); d[q.difficulty]++; bank[n.id].push(q);
    }
    if(bank[n.id].length!==30||d.easy!==10||d.medium!==10||d.hard!==10)
      report.push(`${n.id}: expected 30 (10/10/10), got ${bank[n.id].length} (${d.easy}/${d.medium}/${d.hard})`);
  }
  return {bank,report,file:path.basename(file)};
}
module.exports={load};
