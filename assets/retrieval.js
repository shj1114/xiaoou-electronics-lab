export function normalize(text) { return String(text).normalize('NFKC').toLowerCase().replace(/\s+/g, ' '); }
const boilerplate = /为什么|怎么|如何|请问|能否|可以|是什么|有什么|哪些|是否|已经|相关|关系|请你|一下/g;
const generic = new Set(['课程','报告','项目','问题','同学','学生','老师','你好','谢谢','什么','多少','需要','应该','提供']);
const aliases = [
  [/四线|四端|开尔文|kelvin/i,'开尔文 四端子 感测 引线电阻'],
  [/漂移|跳数|跳动/,'读数漂移 接触电阻 基准 噪声 故障'],
  [/实测|达标|精度/,'实测精度 验收要求 示值误差 真实数据'],
  [/7107|满量程/,'ICL7107 参考电压 满量程'],
  [/干电路/,'干电路 开路电压 短路电流'],
  [/安全|冒烟|发热/,'安全规范 立即断电 电流异常'],
];
export function tokens(text) {
  const parts = normalize(text).replace(boilerplate,' ').match(/[a-z]+\d*[a-z\d]*|\d+(?:\.\d+)?|[\u3400-\u9fff]+/g) || [];
  const result=[];
  for(const part of parts){
    if(/^[\u3400-\u9fff]+$/.test(part)){
      for(let n=2;n<=3;n++)for(let i=0;i<=part.length-n;i++){const t=part.slice(i,i+n);if(!generic.has(t))result.push(t);}
    }else result.push(part);
  }
  return result;
}
export function makeRetriever(chunks) {
  const docs=chunks.map(c=>tokens(c.text+' '+c.locator));
  const counts=docs.map(t=>{const m=new Map();for(const x of t)m.set(x,(m.get(x)||0)+1);return m;});
  const df=new Map();for(const m of counts)for(const x of m.keys())df.set(x,(df.get(x)||0)+1);
  const avg=docs.reduce((s,t)=>s+t.length,0)/Math.max(1,docs.length);
  return function search(question,limit=5){
    let expanded=question;
    for(const [pattern,extra] of aliases)if(pattern.test(question))expanded+=' '+extra;
    const terms=[...new Set(tokens(expanded))];
    if(!terms.length)return [];
    const originals=[...new Set(tokens(question))];
    // Require more than accidental generic overlap for an out-of-course question.
    const covered=originals.filter(t=>df.has(t));
    if(covered.length===0 || (originals.length>8 && covered.length/originals.length<.15))return [];
    const scores=[];
    counts.forEach((m,i)=>{
      let score=0;
      for(const t of terms){const f=m.get(t)||0;if(!f)continue;const idf=Math.log(1+(chunks.length-(df.get(t)||0)+.5)/((df.get(t)||0)+.5));score+=idf*f*2.2/(f+1.2*(.25+.75*docs[i].length/Math.max(1,avg)));}
      const text=normalize(chunks[i].text);
      for(const phrase of ['四线','四端子','实测','ICL7107','干电路','漂移','恒流','满量程'])if(normalize(question).includes(normalize(phrase))&&text.includes(normalize(phrase)))score+=2;
      if(chunks[i].kind==='external_reference'&&(/四线|四端|开尔文/.test(question)&&chunks[i].id==='T1'))score+=8;
      if(/实测|达标/.test(question)&&text.includes('不虚构整机实测'))score+=12;
      if(/7107|参考电压/.test(question)&&chunks[i].id==='A1')score+=8;
      if(score>2)scores.push({...chunks[i],score});
    });
    scores.sort((a,b)=>b.score-a.score);
    const unique=[];const seen=new Set();
    for(const item of scores){if(seen.has(item.text))continue;seen.add(item.text);unique.push(item);if(unique.length>=limit)break;}
    return unique;
  };
}
export function evidenceText(hits){return hits.map(h=>`[${h.id}] ${h.source} | ${h.locator}\n${h.text}`).join('\n\n');}
export function checkCitations(answer,hits){
  const allowed=new Set(hits.map(h=>h.id)),invalid=[];
  const text=String(answer).replace(/\[((?:C\d{3})|(?:T\d+)|(?:A\d+))\]/g,(match,id)=>{if(allowed.has(id))return match;invalid.push(id);return '';});
  return {text,invalid:[...new Set(invalid)],hasCitations:/\[(?:C\d{3}|T\d+|A\d+)\]/.test(text)};
}
export function localAnswer(question,hits){
  if(!hits.length)return '目前课程资料中没有找到足够依据。请补充涉及的电路模块、测量点、现象或原理图版本，再一起定位问题。';
  let lead='以下是本次检索到的相关证据。连接 DeepSeek 后，小欧可以结合这些原文组织解释并复核答案。';
  const cite=(id)=>hits.find(h=>h.id===id);
  const measured=hits.find(h=>h.text.includes('不虚构整机实测'));
  if(/四线|四端|开尔文/.test(question)&&cite('T1'))lead='四线法把“送电流”和“测电压”分给两组导线。感测支路电流很小，因此其引线压降通常可忽略；这样能减小低阻测量中的引线误差，但热电势、夹具接触和仪器误差仍然需要检查。[T1]';
  else if(/7107|参考电压/.test(question)&&cite('A1'))lead='ICL7107 可采用 1.000 V 参考输入，对应 2.000 V 满量程输入；采用 100.0 mV 参考输入时，对应 200.0 mV 满量程。实际使用哪一种，要核对原理图和参考端电压。[A1]';
  else if(/实测|达标/.test(question)&&measured)lead=`报告中的误差指标是验收要求，不能直接当作已测得的性能。原文明确没有虚构整机实测精度，相关结果要由实际实施后的测试记录补充。[${measured.id}]`;
  else if(/100\s*mA/i.test(question)&&/200\s*m[Ωω]/i.test(question)){
    const h=hits.find(h=>h.text.includes('20mV')&&h.text.includes('2.0V'));
    if(h)lead=`按报告的设计参数计算：\n100 mA = 0.100 A，200 mΩ = 0.200 Ω。\nV = I × R = 0.100 × 0.200 = 0.020 V = 20 mV。\n100 倍放大后为 2.000 V。\n这是理论计算值，实际输出需要测量和校准。[${h.id}]`;
  }
  return lead+'\n\n'+hits.slice(0,lead.startsWith('以下')?3:1).map(h=>`[${h.id}] ${h.locator}\n${h.text}`).join('\n\n');
}
