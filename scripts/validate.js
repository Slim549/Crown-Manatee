const r=require('../config/questionBank').load(); console.log('File:',r.file); console.log(r.report.length?r.report.join('\n'):'Question bank OK'); process.exit(r.report.length?1:0);
