import {makeRetriever,localAnswer} from './retrieval.js';
import {testConnection,generateAnswer,MODEL_DEFAULT} from './api.js';
import {PATH,QUIZ} from './course.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const state={chunks:[],search:()=>[],history:[],busy:false,key:'',testedKey:'',model:MODEL_DEFAULT,controller:null,filter:'',visible:12,toastTimer:0};
const KEY_STORAGE='xiaoou.deepseek.key.v2',MODEL_STORAGE='xiaoou.deepseek.model.v2',PROGRESS_STORAGE='xiaoou.progress.v2';
function readStorage(key,fallback=''){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
function writeStorage(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}
function removeStorage(key){try{localStorage.removeItem(key);}catch{}}
function el(tag,className='',text=''){const n=document.createElement(tag);n.className=className;if(text)n.textContent=text;return n;}
function icon(id){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');const u=document.createElementNS('http://www.w3.org/2000/svg','use');u.setAttribute('href','#i-'+id);n.append(u);return n;}
function toast(text){clearTimeout(state.toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;state.toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
function route(){const view=location.hash.slice(1)||'chat';const valid=['chat','knowledge','path','lab','quiz'].includes(view)?view:'chat';$$('.view').forEach(n=>{n.hidden=n.id!=='view-'+valid;n.classList.toggle('active',!n.hidden);});$$('[data-view]').forEach(n=>{n.classList.toggle('active',n.dataset.view===valid);if(n.dataset.view===valid)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});$('#page-label').textContent=({chat:'AI 课程助教',knowledge:'课程知识库',path:'实训学习路线',lab:'测量仿真实验',quiz:'随堂自测'})[valid];if(valid==='knowledge')renderKnowledge();window.scrollTo({top:0,behavior:'instant'});}
window.addEventListener('hashchange',route);

function updateConnection(){
 const connected=Boolean(state.key);$('#connect-button-text').textContent=connected?(state.testedKey===state.key?'DeepSeek 已连接':'DeepSeek 已设置'):'连接 DeepSeek';
 $('#connection-label').replaceChildren(el('i'),document.createTextNode(connected?'使用自己的 DeepSeek Key':'课程检索已就绪'));
 $('#composer-mode').replaceChildren(el('span','dot'),document.createTextNode(connected?'DeepSeek · 课程增强':'课程资料检索'));
 $('#review-enabled').title=connected?'复核会多调用一次模型':'连接 DeepSeek 后启用模型证据复核';
}
function openSettings(){
 $('#api-key').value=state.key;$('#remember-key').checked=Boolean(readStorage(KEY_STORAGE));
 if(![...$('#model-select').options].some(o=>o.value===state.model)){const o=new Option(state.model,state.model);$('#model-select').add(o);}
 $('#model-select').value=state.model;$('#connection-result').textContent='';$('#connection-result').className='connection-result';$('#settings-dialog').showModal();
}
$$('[data-open-settings]').forEach(b=>b.addEventListener('click',openSettings));
$('#close-settings').addEventListener('click',()=>$('#settings-dialog').close());
$('#settings-dialog').addEventListener('click',event=>{if(event.target===$('#settings-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
$('#reveal-key').addEventListener('click',()=>{const field=$('#api-key');const reveal=field.type==='password';field.type=reveal?'text':'password';$('#reveal-key').setAttribute('aria-pressed',String(reveal));$('#reveal-key').setAttribute('aria-label',reveal?'隐藏API密钥':'显示API密钥');});
$('#settings-dialog').addEventListener('close',()=>{$('#api-key').type='password';$('#api-key').value='';$('#reveal-key').setAttribute('aria-pressed','false');$('#reveal-key').setAttribute('aria-label','显示API密钥');});
function validateKey(){const key=$('#api-key').value.trim();if(!key||/\s/.test(key)||key.length<12){$('#connection-result').textContent='请粘贴完整的 API Key，不要包含空格或换行。';$('#connection-result').className='connection-result error';return '';}return key;}
$('#test-connection').addEventListener('click',async()=>{
 const key=validateKey();if(!key)return;
 const button=$('#test-connection');button.disabled=true;$('#connection-result').className='connection-result';$('#connection-result').textContent='正在验证 Key 并获取可用模型…';
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{const models=await testConnection(key,controller.signal);state.testedKey=key;const prior=$('#model-select').value;$('#model-select').replaceChildren(...models.map(m=>new Option(m,m)));$('#model-select').value=models.includes(prior)?prior:(models.find(m=>m.includes('flash'))||models[0]);$('#connection-result').textContent=`连接成功，可用模型 ${models.length} 个。选择模型后点“保存并开始”。`;}
 catch(error){$('#connection-result').className='connection-result error';$('#connection-result').textContent=error.name==='AbortError'?'连接超时，请检查网络后重试。':error.message;}
 finally{clearTimeout(timeout);button.disabled=false;}
});
$('#settings-form').addEventListener('submit',event=>{
 event.preventDefault();const key=validateKey();if(!key)return;
 if(state.busy){toast('请先停止当前回答，再更新连接。');return;}
 state.key=key;state.model=$('#model-select').value;
 if($('#remember-key').checked){if(!writeStorage(KEY_STORAGE,key))toast('浏览器限制了本机存储，Key 仅在本次页面有效。');}else removeStorage(KEY_STORAGE);
 writeStorage(MODEL_STORAGE,state.model);updateConnection();$('#settings-dialog').close();toast('DeepSeek 已设置，可以开始课程问答。');
});
$('#clear-key').addEventListener('click',()=>{state.controller?.abort();state.key='';removeStorage(KEY_STORAGE);$('#api-key').value='';$('#remember-key').checked=false;updateConnection();$('#settings-dialog').close();toast('已断开连接，并删除本机保存的 Key。');});

function renderRichText(container,text,hits=[]){
 const allowed=new Set(hits.map(h=>h.id));
 // Safe text rendering: model output is never assigned to innerHTML.
 for(const line of String(text).split('\n')){
  const p=el('div');if(!line){p.append(document.createElement('br'));container.append(p);continue;}
  const parts=line.split(/(\*\*[^*\n]+\*\*|\[(?:C\d{3}|T\d+|A\d+)\])/g);
  for(const part of parts){
   const id=part.match(/^\[(C\d{3}|T\d+|A\d+)\]$/)?.[1];
   if(id&&allowed.has(id)){const b=el('button','citation-button',part);b.type='button';b.setAttribute('aria-label','查看来源 '+id);b.addEventListener('click',()=>{const details=container.closest('.message-body').querySelector('details');if(details){details.open=true;const card=[...details.querySelectorAll('[data-source]')].find(n=>n.dataset.source===id);card?.scrollIntoView({behavior:'smooth',block:'center'});}});p.append(b);}
   else if(part.startsWith('**')&&part.endsWith('**'))p.append(el('strong','',part.slice(2,-2)));
   else p.append(document.createTextNode(part));
  }
  container.append(p);
 }
}
function sourceDetails(hits){
 const details=el('details','source-disclosure');details.append(el('summary','',`查看本轮 ${hits.length} 条检索证据与原文`));const list=el('div','evidence-list');
 for(const h of hits){const card=el('article','evidence-card');card.dataset.source=h.id;card.append(el('b','',`[${h.id}] ${h.source}`),el('small','',h.locator),el('p','',h.text));if(h.url&&/^https:\/\//i.test(h.url)){const link=el('a','','打开原始资料 ↗');link.href=h.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}list.append(card);}
 details.append(list);return details;
}
function addMessage(role,content='',hits=[]){
 const message=el('article','message '+role),avatar=el('div','avatar',role==='user'?'你':'Ω'),body=el('div','message-body'),label=el('div','message-label',role==='user'?'你':'小欧 · 课程学习助手'),text=el('div','message-content');
 body.append(label,text);message.append(avatar,body);renderRichText(text,content,hits);$('#messages').append(message);return {message,body,text,label};
}
function beginConversation(){$('#welcome-area').hidden=true;$('#conversation-toolbar').hidden=false;}
function finishMessage(node,{answer,hits,mode,reviewed=false,issues=[]}){
 node.message.classList.remove('pending');node.text.replaceChildren();renderRichText(node.text,answer,hits);
 if(hits.length)node.body.append(sourceDetails(hits));
 const meta=el('div','answer-meta'),label=el('span');label.append(icon(reviewed?'check':'book'),document.createTextNode(mode==='local'?'课程知识检索':reviewed?'DeepSeek · 已完成证据复核':'DeepSeek · 请结合来源核对'));
 const copy=el('button','text-button','复制答案');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(answer);toast('答案已复制。');}catch{toast('浏览器不允许复制，请长按或选中文本复制。');}});meta.append(label,copy);node.body.append(meta);
 if(issues.length)node.body.append(el('p','review-issues',issues.join('；')));
}
async function ask(question){
 question=question.trim();if(!question)return;if(state.busy){toast('小欧正在回答，您可以先停止当前请求。');return;}
 if(question.length>1500){toast('请将问题控制在1500字以内。');return;}
 if(!state.chunks.length){toast('知识库尚未就绪，请稍后刷新重试。');return;}
 if(location.hash!=='#chat')location.hash='chat';beginConversation();state.busy=true;$('#send-button').disabled=true;$('#stop-button').hidden=false;$('#question').value='';
 const prior=state.history.slice(-6);addMessage('user',question);
 const node=addMessage('assistant','正在检索课程资料…');node.message.classList.add('pending');
 let retrievalQuery=question;
 if(/^(那|它|这样|为什么|继续|这个)/.test(question)&&question.length<18){const previous=[...prior].reverse().find(m=>m.role==='user');if(previous)retrievalQuery=previous.content+' '+question;}
 const hits=state.search(retrievalQuery,5);
 state.controller=new AbortController();const timeout=setTimeout(()=>state.controller?.abort(),180000);
 let result;
 try{
  if(!state.key||!hits.length){result={answer:localAnswer(question,hits),mode:'local',reviewed:false,issues:[]};}
  else{result=await generateAnswer({key:state.key,model:state.model,question,history:prior,hits,review:$('#review-enabled').checked,signal:state.controller.signal,onStage:text=>node.text.textContent=text});result.mode='ai';}
 }catch(error){
  const reason=error.name==='AbortError'?'本次 AI 请求已停止或超时。':error.message;
  result={answer:reason+'\n\n'+localAnswer(question,hits),mode:'local',reviewed:false,issues:['AI 请求未完成，以下展示课程检索内容。']};
 }finally{clearTimeout(timeout);state.busy=false;state.controller=null;$('#send-button').disabled=false;$('#stop-button').hidden=true;}
 finishMessage(node,{...result,hits});state.history.push({role:'user',content:question},{role:'assistant',content:result.answer});
 node.message.scrollIntoView({behavior:'smooth',block:'start'});
}
$('#ask-form').addEventListener('submit',event=>{event.preventDefault();ask($('#question').value);});
$('#question').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!matchMedia('(pointer: coarse)').matches){event.preventDefault();$('#ask-form').requestSubmit();}});
$('#stop-button').addEventListener('click',()=>state.controller?.abort());
document.addEventListener('click',event=>{const button=event.target.closest('[data-question]');if(button)ask(button.dataset.question);});
$('#new-chat').addEventListener('click',()=>{if(state.busy){toast('请先停止当前回答。');return;}state.history=[];$('#messages').replaceChildren();$('#welcome-area').hidden=false;$('#conversation-toolbar').hidden=true;$('#question').focus();});
$('#export-chat').addEventListener('click',()=>{
 if(!state.history.length){toast('还没有可以导出的对话。');return;}
 const content='# 小欧电子实验室 学习笔记\n\n'+new Date().toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})+'\n\n'+state.history.map(m=>`## ${m.role==='user'?'我的问题':'小欧的回答'}\n\n${m.content}`).join('\n\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='小欧学习笔记.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('学习笔记已导出，不包含 API Key。');
});

function renderKnowledge(){
 const query=$('#knowledge-query').value.trim();let items=query?state.search(query,197):state.chunks;
 if(state.filter==='external')items=items.filter(x=>x.kind==='external_reference');
 else if(state.filter)items=items.filter(x=>(x.locator+' '+x.text).includes(state.filter));
 $('#knowledge-total').textContent=state.chunks.length+' 条带出处资料';$('#result-count').textContent=`找到 ${items.length} 条相关资料`;
 const list=$('#knowledge-list');list.replaceChildren();
 if(!items.length)list.append(el('p','field-note','没有找到匹配内容。试试更具体的模块名或测量术语。'));
 for(const h of items.slice(0,state.visible)){const card=el('article','knowledge-card');card.append(el('h3','',`[${h.id}] ${h.source}`),el('div','source-loc',h.locator),el('p','',h.text));const ask=el('button','text-button','围绕这条内容提问');ask.type='button';ask.dataset.question='请解释课程知识点：'+h.text.slice(0,150);ask.append(icon('arrow'));card.append(ask);if(h.url){const a=el('a','text-button','原始资料 ↗');a.href=h.url;a.target='_blank';a.rel='noopener noreferrer';card.append(document.createTextNode('　'),a);}list.append(card);}
 $('#load-more').hidden=items.length<=state.visible;
}
$('#knowledge-query').addEventListener('input',()=>{state.visible=12;renderKnowledge();});
$('#knowledge-filters').addEventListener('click',event=>{const b=event.target.closest('[data-filter]');if(!b)return;state.filter=b.dataset.filter;state.visible=12;$$('#knowledge-filters button').forEach(n=>n.classList.toggle('selected',n===b));renderKnowledge();});
$('#load-more').addEventListener('click',()=>{state.visible+=12;renderKnowledge();});

let progress=[];try{const v=JSON.parse(readStorage(PROGRESS_STORAGE,'[]'));if(Array.isArray(v))progress=v.filter(n=>Number.isInteger(n)&&n>=0&&n<7);}catch{}
function updateProgress(){const done=new Set(progress);$('#progress-count').textContent=`${done.size} / 7`;$('#progress-bar').style.width=(done.size/7*100)+'%';}
function renderPath(){
 const list=$('#path-list');list.replaceChildren();PATH.forEach((step,i)=>{
  const card=el('article','path-step'+(progress.includes(i)?' completed':'')),number=el('span','step-number',String(i+1).padStart(2,'0')),main=el('div','step-main');main.append(el('h3','',step.title+' · '+step.hours),el('p','',step.detail),el('div','step-evidence','验收证据：'+step.evidence));
  const actions=el('div','step-actions'),label=el('label','complete-label'),check=el('input');check.type='checkbox';check.checked=progress.includes(i);check.addEventListener('change',()=>{progress=progress.filter(n=>n!==i);if(check.checked)progress.push(i);if(!writeStorage(PROGRESS_STORAGE,JSON.stringify(progress)))toast('本机存储不可用，进度仅在当前页面保留。');card.classList.toggle('completed',check.checked);updateProgress();});label.append(check,document.createTextNode('已完成学习'));const ask=el('button','text-button','请小欧带我做');ask.type='button';ask.dataset.question=step.question;ask.append(icon('arrow'));actions.append(label,ask);main.append(actions);card.append(number,main);list.append(card);
 });updateProgress();
}
function numberValue(id,min,max){const value=Number($(id).value);return Number.isFinite(value)&&value>=min&&value<=max?value:null;}
function updateLab(){
 const resistance=numberValue('#resistance',0,200),current=numberValue('#current',.1,1000),gain=numberValue('#gain',1,1000),lead=numberValue('#lead-resistance',0,1000),threshold=numberValue('#threshold',0,200);
 if([resistance,current,gain,lead,threshold].includes(null)){$('#lab-warning').textContent='请输入允许范围内的有限数值；当前结果尚未更新。';return;}
 $('#resistance-label').textContent=resistance.toFixed(1)+' mΩ';$('#read-resistance').textContent=resistance.toFixed(1);
 const voltageMv=current*resistance/1000,outputV=voltageMv*gain/1000;
 $('#read-voltage').textContent=voltageMv.toFixed(3)+' mV';$('#read-output').textContent=outputV.toFixed(3)+' V';$('.calculation-lines>div:nth-child(2)>span').textContent=gain+' 倍放大后输出';
 $('#read-two-wire').textContent=(resistance+lead).toFixed(1)+' mΩ';$('#read-four-wire').textContent=resistance.toFixed(1)+' mΩ';$('#read-error').textContent=resistance===0?'零阻值处不定义相对误差':(lead/resistance*100).toFixed(1)+'%';
 const over=resistance>threshold;$('#sorting-state').textContent=over?'超出设定阈值 · 理想超限状态':'低于或等于设定阈值 · 理想合格状态';$('#sorting-state').classList.toggle('over',over);
 $('#lab-warning').textContent=outputV>=2?'理论输出已达到或超过2 V。真实运放、表头的量程和饱和限制需按电路验证。':'仿真按理想值与直接阈值比较计算；未模拟滞回和报警时延，实际仪器仍需校准。';
}
$$('#view-lab input').forEach(n=>n.addEventListener('input',updateLab));

function renderQuiz(){const list=$('#quiz-list');QUIZ.forEach((q,i)=>{const card=el('fieldset','quiz-card');const legend=el('legend');legend.append(el('span','',String(i+1).padStart(2,'0')),document.createTextNode(q.q));card.append(legend);const options=el('div','quiz-options');q.options.forEach((option,j)=>{const label=el('label','quiz-option'),input=el('input');input.type='radio';input.name='question-'+i;input.value=String(j);input.required=true;label.append(input,document.createTextNode(String.fromCharCode(65+j)+'. '+option));options.append(label);});card.append(options);const feedback=el('p','quiz-explanation');feedback.hidden=true;card.append(feedback);list.append(card);});}
$('#quiz-form').addEventListener('submit',event=>{event.preventDefault();let score=0;$$('.quiz-card').forEach((card,i)=>{const q=QUIZ[i],chosen=Number(card.querySelector('input:checked')?.value);if(chosen===q.answer)score++;[...card.querySelectorAll('.quiz-option')].forEach((label,j)=>{label.classList.toggle('correct',j===q.answer);label.classList.toggle('incorrect',j===chosen&&chosen!==q.answer);});const source=q.source||state.chunks.find(h=>q.find&&h.text.includes(q.find))?.id;const feedback=card.querySelector('.quiz-explanation');feedback.hidden=false;feedback.textContent=`${chosen===q.answer?'回答正确':'再想一想'} · 正确选项 ${String.fromCharCode(65+q.answer)}。${q.explanation}${source?' 来源：['+source+']':''}`;});$('#quiz-score').textContent=`答对 ${score} / ${QUIZ.length} 题`;toast('解析已展开，看看哪些知识点值得再复习。');});

async function init(){
 state.key=readStorage(KEY_STORAGE);state.model=readStorage(MODEL_STORAGE,MODEL_DEFAULT);updateConnection();renderPath();renderQuiz();updateLab();route();
 try{const response=await fetch(new URL('../knowledge/chunks.jsonl',import.meta.url));if(!response.ok)throw new Error('load failed');const lines=(await response.text()).trim().split('\n');state.chunks=lines.map(line=>JSON.parse(line));state.search=makeRetriever(state.chunks);$('#kb-count').textContent=state.chunks.length;renderKnowledge();}
 catch{toast('课程知识库加载失败，请刷新或检查网站文件是否完整。');$('#connection-label').textContent='知识库加载失败';}
}
init();
