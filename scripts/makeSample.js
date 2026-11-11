// Writes PLACEHOLDER questions (NOT real content) so the game is playable until you add data/questions.json.
const N=require('../config/nodes'),fs=require('fs'); const d=['easy','medium','hard'];
fs.writeFileSync(__dirname+'/../data/questions.sample.json',JSON.stringify(N.map(n=>({nodeId:n.id,nodeName:n.name,questions:Array.from({length:30},(_,i)=>{
 const c='ABCD'[(i*3+n.number)%4]; return {id:`${n.id}-${d[i/10|0]}-${String(i%10+1).padStart(3,'0')}`,difficulty:d[i/10|0],
 prompt:`[PLACEHOLDER] ${n.name} question ${i+1}: any answer works while testing. Replace data/questions.sample.json with your real bank.`,
 choices:Object.fromEntries('ABCD'.split('').map(k=>[k,`Placeholder option ${k}`])),correctAnswer:c};})})),null,1));
