// ============================================================
// 📋 COPY THIS ENTIRE SCRIPT
// 📋 Open Gemini in your NORMAL Chrome (already logged in)
// 📋 Open a conversation with multiple messages
// 📋 Press F12 → Console tab → Paste → Enter
// 📋 It will auto-download a JSON file with the DOM analysis
// ============================================================

(function(){
  console.log('%c🔍 AI Session Extractor — DOM Analysis', 'font-size:20px;color:#6366f1;font-weight:bold');
  console.log('%cAnalyzing page structure...', 'font-size:14px;color:#4ade80');

  const C = el => (!el||typeof el.className!=='string')?[]:el.className.split(/\s+/).filter(c=>c&&!/^ng-/.test(c)&&!/^_ng/.test(c)&&c.length<80);
  const I = el => {if(!el)return null;const r=el.getBoundingClientRect();return{tag:el.tagName.toLowerCase(),cls:C(el),id:el.id||undefined,role:el.getAttribute('role')||undefined,aria:el.getAttribute('aria-label')||undefined,testId:el.getAttribute('data-test-id')||undefined,data:Object.fromEntries([...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value.substring(0,100)])),rect:{t:Math.round(r.top),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}};};
  const P = (el,n=8)=>{const c=[];let cur=el;for(let i=0;i<n&&cur&&cur!==document.body;i++){c.push({tag:cur.tagName.toLowerCase(),cls:C(cur).slice(0,5),role:cur.getAttribute('role'),testId:cur.getAttribute('data-test-id')});cur=cur.parentElement;}return c;};
  const T = (el,d=0,mx=6)=>{if(!el||d>mx)return null;const ch=[...el.children].slice(0,30);const n={tag:el.tagName.toLowerCase(),cls:C(el).slice(0,6),role:el.getAttribute('role')||undefined,testId:el.getAttribute('data-test-id')||undefined};if(ch.length===0){const t=el.textContent?.trim();if(t&&t.length<300)n.text=t;}else{n.kids=ch.map(c=>T(c,d+1,mx)).filter(Boolean);if(el.children.length>30)n.more=el.children.length-30;}return n;};

  const R = {url:location.href,title:document.title,ts:new Date().toISOString(),bodyCls:document.body.className,zero:document.body.className.includes('zero-state-theme')};

  // 1. Chat container
  const cc=document.querySelector('[class*="chat-container"]');
  if(cc)R.chatContainer={...I(cc),tree:T(cc,0,3)};

  // 2. Scroller
  const sc=document.querySelector('infinite-scroller[data-test-id="chat-history-container"]')||document.querySelector('[class*="chat-history-scroll"]')||document.querySelector('infinite-scroller');
  if(sc){
    R.scroller={...I(sc),kids:sc.children.length};
    R.scrollerKids=[...sc.children].slice(0,60).map((c,i)=>({
      i,tag:c.tagName.toLowerCase(),cls:C(c).slice(0,10),role:c.getAttribute('role'),testId:c.getAttribute('data-test-id'),
      h:Math.round(c.getBoundingClientRect().height),tLen:(c.textContent||'').length,t:(c.textContent||'').substring(0,300).trim(),
      nKids:c.children.length,kidTags:[...new Set([...c.children].map(k=>k.tagName.toLowerCase()))].slice(0,10),
      kidCls:[...new Set([...c.children].flatMap(k=>C(k)))].slice(0,20),
    }));
  }

  // 3. Model response elements
  R.model={};
  for(const s of ['.model-response-text','[class*="model-response-text"]','[class*="model-response"]','.markdown','[class*="markdown"]','message-content','[class*="message-content"]','model-response','[class*="response"]','.text','[class*="response-text"]','[class*="bot-message"]','[class*="ai-message"]','[class*="assistant"]']){
    try{const e=document.querySelectorAll(s);if(e.length>0)R.model[s]={n:e.length,s:[...e].slice(0,5).map(el=>({...I(el),p:P(el),t:(el.textContent||'').substring(0,600),h:el.innerHTML.substring(0,3000),tree:T(el,0,4)}))};}catch(e){}
  }

  // 4. User query elements
  R.user={};
  for(const s of ['.query-text','[class*="query-text"]','[class*="user-query"]','user-query','[class*="user-message"]','[class*="prompt"]','[class*="query"]','[class*="human-message"]','[class*="user-text"]']){
    try{const e=document.querySelectorAll(s);if(e.length>0)R.user[s]={n:e.length,s:[...e].slice(0,5).map(el=>({...I(el),p:P(el),t:(el.textContent||'').substring(0,600),h:el.innerHTML.substring(0,1500)}))};}catch(e){}
  }

  // 5. Turn/exchange containers
  R.turns={};
  for(const s of ['[class*="turn"]','[class*="exchange"]','model-response','user-query','[class*="message-row"]','[class*="message-container"]','[class*="msg-row"]','[class*="chat-message"]','[class*="dialogue"]']){
    try{const e=document.querySelectorAll(s);if(e.length>0)R.turns[s]={n:e.length,s:[...e].slice(0,4).map(el=>({...I(el),p:P(el,6),tree:T(el,0,5),html:el.outerHTML.substring(0,8000)}))};}catch(e){}
  }

  // 6. Custom tags + relevant classes
  const allEls=document.querySelectorAll('*');
  const ctags=new Set();const rcls={};
  for(const el of allEls){const tag=el.tagName.toLowerCase();if(tag.includes('-'))ctags.add(tag);C(el).forEach(c=>{if(/turn|message|response|query|model|user|markdown|chat|content|text|prompt|bubble|row|dialog/i.test(c))rcls[c]=(rcls[c]||0)+1;});}
  R.customTags=[...ctags].sort();
  R.relCls=Object.entries(rcls).sort((a,b)=>b[1]-a[1]).slice(0,100);

  // 7. data-test-id inventory
  const tids={};
  document.querySelectorAll('[data-test-id]').forEach(el=>{const id=el.getAttribute('data-test-id');if(!tids[id])tids[id]={n:0,tag:el.tagName.toLowerCase(),cls:C(el).slice(0,3),t:(el.textContent||'').substring(0,100)};tids[id].n++;});
  R.testIds=tids;

  // 8. Scroller children outerHTML (the actual message wrappers)
  if(sc&&sc.children.length>0)R.kidHTML=[...sc.children].slice(0,12).map(c=>c.outerHTML.substring(0,8000));

  // 9. Markdown parent context (go up 5 levels)
  const mdEls=document.querySelectorAll('.markdown, [class*="model-response-text"]');
  if(mdEls.length>0)R.mdCtx=[...mdEls].slice(0,4).map(el=>{let p=el;for(let i=0;i<6&&p.parentElement&&p.parentElement!==document.body;i++)p=p.parentElement;return{html:p.outerHTML.substring(0,10000),info:I(p),p:P(p,5),tree:T(p,0,6)};});

  // 10. First user + model full context
  const fu=document.querySelector('.query-text, [class*="query-text"], [class*="user-query"]');
  const fm=document.querySelector('.model-response-text, [class*="model-response-text"], .markdown');
  if(fu){let p=fu;for(let i=0;i<7&&p.parentElement;i++)p=p.parentElement;R.userCtx={html:p.outerHTML.substring(0,8000),tree:T(p,0,6)};}
  if(fm){let p=fm;for(let i=0;i<7&&p.parentElement;i++)p=p.parentElement;R.modelCtx={html:p.outerHTML.substring(0,8000),tree:T(p,0,6)};}

  // 11. ALL elements with role="article" or role="listitem" (common in chat UIs)
  const roleEls=document.querySelectorAll('[role="article"],[role="listitem"],[role="log"]');
  R.roleElements=[...roleEls].slice(0,10).map(el=>({...I(el),p:P(el,4),t:(el.textContent||'').substring(0,200),tree:T(el,0,3)}));

  // 12. Get the sidebar conversation list
  const sideLinks=document.querySelectorAll('[class*="chat-history"] a, [class*="history"] a[href*="/app/"]');
  R.sidebar=[...sideLinks].slice(0,20).map(a=>({href:a.href,text:a.textContent.trim().substring(0,100),cls:C(a)}));

  // DOWNLOAD
  const blob=new Blob([JSON.stringify(R,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='gemini-dom-dump.json';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);

  // SUMMARY
  console.log('%c✅ DOM analysis downloaded as gemini-dom-dump.json!', 'font-size:16px;color:#4ade80;font-weight:bold');
  console.log('%c📊 Quick Summary:', 'font-size:14px;color:#facc15;font-weight:bold');
  console.log(`   Zero-state: ${R.zero}`);
  console.log(`   URL: ${R.url}`);
  console.log(`   Scroller children: ${R.scroller?.kids||0}`);
  console.log(`   Model selectors matched: ${Object.entries(R.model).map(([k,v])=>`${k}(${v.n})`).join(', ')||'NONE'}`);
  console.log(`   User selectors matched: ${Object.entries(R.user).map(([k,v])=>`${k}(${v.n})`).join(', ')||'NONE'}`);
  console.log(`   Turn selectors matched: ${Object.entries(R.turns).map(([k,v])=>`${k}(${v.n})`).join(', ')||'NONE'}`);
  console.log(`   Custom tags: ${R.customTags.join(', ')}`);
  console.log(`   Top classes: ${R.relCls.slice(0,15).map(([c,n])=>`${n}x.${c}`).join(', ')}`);
  console.log(`   data-test-ids: ${Object.entries(R.testIds).map(([k,v])=>`[${k}]×${v.n}`).join(', ')}`);
  console.log(`   Role elements: ${R.roleElements.length}`);

  console.log('%c📋 Please share the gemini-dom-dump.json file!', 'font-size:14px;color:#f87171;font-weight:bold');

  return R;
})();
