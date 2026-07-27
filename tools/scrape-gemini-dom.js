// ============================================================
// Gemini DOM Scraper — FINAL approach
// Fresh Playwright browser, user logs in manually IN THAT WINDOW
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'dom-analysis');
// Use a persistent profile so login is saved between runs
const PW_PROFILE = path.join(__dirname, '.pw-profile');

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║    A CHROME WINDOW WILL OPEN — IT IS THE PLAYWRIGHT WINDOW     ║');
  console.log('║                                                                   ║');
  console.log('║   ⚠️  DO NOT USE YOUR NORMAL CHROME!                             ║');
  console.log('║   ⚠️  LOG IN TO GOOGLE *IN THE PLAYWRIGHT WINDOW*                ║');
  console.log('║   ⚠️  THEN CLICK A CONVERSATION *IN THAT SAME WINDOW*            ║');
  console.log('║                                                                   ║');
  console.log('║   The window title will say "Playwright" or have a test banner.  ║');
  console.log('║   Your login will be saved for next time.                        ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');

  const context = await chromium.launchPersistentContext(PW_PROFILE, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--window-position=0,0',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = context.pages()[0] || await context.newPage();

  // Inject a visible banner so user knows THIS is the right window
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const banner = document.createElement('div');
      banner.id = 'pw-scraper-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#dc2626;color:white;text-align:center;padding:10px 20px;font:bold 16px sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      banner.innerHTML = '🤖 AI SESSION EXTRACTOR — Log in to Google HERE, then click a conversation with messages! This window will auto-scrape when ready.';
      document.body.prepend(banner);
    });
  });

  await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
  console.log('📄 Navigated to gemini.google.com/app');
  console.log('');
  console.log('👀 LOOK AT THE CHROME WINDOW WITH THE RED BANNER AT THE TOP!');
  console.log('   1. Log in to Google in THAT window');
  console.log('   2. Click on a conversation with messages in THAT window');
  console.log('   3. Wait — the script will detect it automatically');
  console.log('');

  // Wait for a real conversation (not zero-state, not signed-out)
  let loaded = false;
  const t0 = Date.now();
  const maxWait = 8 * 60 * 1000; // 8 minutes

  while (Date.now() - t0 < maxWait) {
    try {
      const s = await page.evaluate(() => {
        const b = document.body;
        if (!b) return { ok: false };
        const z = b.className.includes('zero-state-theme');
        const signedOut = !!(document.querySelector('[data-test-id="sidenav-error-action-link"]') ||
                            document.querySelector('a[href*="accounts.google.com"]'));

        // Count actual message content elements
        let md = 0, uq = 0, mr = 0, msgTest = 0;
        for (const el of document.querySelectorAll('*')) {
          const c = typeof el.className === 'string' ? el.className : '';
          const txt = (el.textContent || '').trim();
          // model-response-text is the actual text container for model messages
          if (/model-response-text/i.test(c) && txt.length > 20) md++;
          // query-text is the user's message text
          if (/query-text/i.test(c) && txt.length > 0) uq++;
          // model-response is the wrapper
          if (/^model-response$|model-response\s/i.test(c) || (/\bmodel-response\b/.test(c) && !/model-response-text/.test(c))) mr++;
        }
        msgTest = document.querySelectorAll('[data-test-id="message"]').length;

        const cc = document.querySelector('[class*="chat-container"]');
        const ct = cc ? cc.innerText.length : 0;

        // Must NOT be zero state AND must have actual message content
        const has = !z && !signedOut && (md > 0 || uq > 0 || mr > 0 || msgTest > 1 || ct > 1000);

        return { ok: true, z, signedOut, md, uq, mr, msgTest, ct, has };
      });

      if (!s.ok) { await sleep(2000); continue; }

      if (s.has) {
        loaded = true;
        console.log(`\n✅ CONVERSATION DETECTED!`);
        console.log(`   model-response-text: ${s.md}`);
        console.log(`   query-text: ${s.uq}`);
        console.log(`   model-response: ${s.mr}`);
        console.log(`   [data-test-id=message]: ${s.msgTest}`);
        console.log(`   chat container text: ${s.ct} chars`);
        console.log('\n   Waiting 5s for full render...');
        await sleep(5000);
        break;
      }

      const el = Math.round((Date.now() - t0) / 1000);
      const status = s.signedOut ? 'NOT LOGGED IN' : s.z ? 'zero-state (no chat open)' : 'waiting...';
      process.stdout.write(`\r   [${el}s] ${status} | md=${s.md} uq=${s.uq} mr=${s.mr} msgs=${s.msgTest} ct=${s.ct}    `);
    } catch (e) {
      process.stdout.write('\r   [page navigating...] ');
      await sleep(3000);
    }
    await sleep(2000);
  }

  if (!loaded) {
    console.log('\n\n⚠️  Timeout — scraping current page state anyway.');
    await sleep(2000);
  }

  // ============================================================
  // SCRAPE
  // ============================================================
  console.log('\n🔍 Scraping DOM structure...\n');
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

  const data = await page.evaluate(() => {
    const C = el => (!el || typeof el.className !== 'string') ? [] : el.className.split(/\s+/).filter(c => c && !/^ng-/.test(c) && !/^_ng/.test(c) && c.length < 80);
    const I = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), cls: C(el), id: el.id||undefined, role: el.getAttribute('role')||undefined, aria: el.getAttribute('aria-label')||undefined, testId: el.getAttribute('data-test-id')||undefined, data: Object.fromEntries([...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value.substring(0,100)])), rect:{t:Math.round(r.top),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)} }; };
    const P = (el,n=8) => { const c=[]; let cur=el; for(let i=0;i<n&&cur&&cur!==document.body;i++){c.push({tag:cur.tagName.toLowerCase(),cls:C(cur).slice(0,5),role:cur.getAttribute('role'),testId:cur.getAttribute('data-test-id')});cur=cur.parentElement;} return c; };
    const T = (el,d=0,mx=5) => { if(!el||d>mx)return null; const ch=[...el.children].slice(0,25); const n={tag:el.tagName.toLowerCase(),cls:C(el).slice(0,6),role:el.getAttribute('role')||undefined,testId:el.getAttribute('data-test-id')||undefined}; if(ch.length===0){const t=el.textContent?.trim();if(t&&t.length<200)n.text=t;}else{n.kids=ch.map(c=>T(c,d+1,mx)).filter(Boolean);if(el.children.length>25)n.more=el.children.length-25;} return n; };

    const R = { url:location.href, title:document.title, ts:new Date().toISOString(), bodyCls:document.body.className, zero:document.body.className.includes('zero-state-theme') };

    // Chat container
    const cc = document.querySelector('[class*="chat-container"]');
    if (cc) R.chatContainer = { ...I(cc), tree: T(cc,0,3) };

    // Scroller
    const sc = document.querySelector('infinite-scroller[data-test-id="chat-history-container"]') || document.querySelector('[class*="chat-history-scroll"]') || document.querySelector('infinite-scroller');
    if (sc) {
      R.scroller = { ...I(sc), kids: sc.children.length };
      R.scrollerKids = [...sc.children].slice(0,50).map((c,i) => ({
        i, tag:c.tagName.toLowerCase(), cls:C(c).slice(0,8), role:c.getAttribute('role'), testId:c.getAttribute('data-test-id'),
        h:Math.round(c.getBoundingClientRect().height), tLen:(c.textContent||'').length, t:(c.textContent||'').substring(0,200).trim(),
        nKids:c.children.length, kidTags:[...new Set([...c.children].map(k=>k.tagName.toLowerCase()))].slice(0,10),
        kidCls:[...new Set([...c.children].flatMap(k=>C(k)))].slice(0,15),
      }));
    }

    // Model selectors
    R.model = {};
    for (const s of ['.model-response-text','[class*="model-response-text"]','[class*="model-response"]','.markdown','[class*="markdown"]','message-content','[class*="message-content"]','model-response','[class*="response"]','.text']) {
      try { const e=document.querySelectorAll(s); if(e.length>0) R.model[s]={n:e.length,s:[...e].slice(0,4).map(el=>({...I(el),p:P(el),t:(el.textContent||'').substring(0,500),h:el.innerHTML.substring(0,2000),tree:T(el,0,3)}))}; } catch(e){}
    }

    // User selectors
    R.user = {};
    for (const s of ['.query-text','[class*="query-text"]','[class*="user-query"]','user-query','[class*="user-message"]','[class*="prompt"]','[class*="query"]']) {
      try { const e=document.querySelectorAll(s); if(e.length>0) R.user[s]={n:e.length,s:[...e].slice(0,4).map(el=>({...I(el),p:P(el),t:(el.textContent||'').substring(0,500),h:el.innerHTML.substring(0,1000)}))}; } catch(e){}
    }

    // Turns
    R.turns = {};
    for (const s of ['[class*="turn"]','[class*="exchange"]','model-response','user-query','[class*="message-row"]','[class*="message-container"]','[class*="msg-row"]']) {
      try { const e=document.querySelectorAll(s); if(e.length>0) R.turns[s]={n:e.length,s:[...e].slice(0,3).map(el=>({...I(el),p:P(el,5),tree:T(el,0,4),html:el.outerHTML.substring(0,5000)}))}; } catch(e){}
    }

    // Custom tags + classes
    const allEls = document.querySelectorAll('*');
    const ctags = new Set(); const rcls = {};
    for (const el of allEls) { const tag=el.tagName.toLowerCase(); if(tag.includes('-'))ctags.add(tag); C(el).forEach(c=>{if(/turn|message|response|query|model|user|markdown|chat|content|text|prompt|bubble|row/i.test(c))rcls[c]=(rcls[c]||0)+1;}); }
    R.customTags = [...ctags].sort();
    R.relCls = Object.entries(rcls).sort((a,b)=>b[1]-a[1]).slice(0,80);

    // test-ids
    const tids = {};
    document.querySelectorAll('[data-test-id]').forEach(el => { const id=el.getAttribute('data-test-id'); if(!tids[id])tids[id]={n:0,tag:el.tagName.toLowerCase(),cls:C(el).slice(0,3),t:(el.textContent||'').substring(0,80)}; tids[id].n++; });
    R.testIds = tids;

    // Scroller children HTML
    if (sc && sc.children.length > 0) R.kidHTML = [...sc.children].slice(0,10).map(c=>c.outerHTML.substring(0,6000));

    // Markdown parent context
    const mdEls = document.querySelectorAll('.markdown, [class*="model-response-text"]');
    if (mdEls.length > 0) R.mdCtx = [...mdEls].slice(0,3).map(el => { let p=el; for(let i=0;i<5&&p.parentElement&&p.parentElement!==document.body;i++)p=p.parentElement; return {html:p.outerHTML.substring(0,8000),info:I(p),p:P(p,4),tree:T(p,0,5)}; });

    // First user + model context
    const fu = document.querySelector('.query-text, [class*="query-text"], [class*="user-query"]');
    const fm = document.querySelector('.model-response-text, [class*="model-response-text"], .markdown');
    if (fu) { let p=fu; for(let i=0;i<6&&p.parentElement;i++)p=p.parentElement; R.userCtx={html:p.outerHTML.substring(0,6000),tree:T(p,0,5)}; }
    if (fm) { let p=fm; for(let i=0;i<6&&p.parentElement;i++)p=p.parentElement; R.modelCtx={html:p.outerHTML.substring(0,6000),tree:T(p,0,5)}; }

    return R;
  });

  // Save
  fs.writeFileSync(path.join(OUTPUT_DIR, 'gemini-dom-real.json'), JSON.stringify(data, null, 2));
  console.log('💾 dom-analysis/gemini-dom-real.json');
  const html = await page.content();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'gemini-page-real.html'), html);
  console.log('💾 dom-analysis/gemini-page-real.html');

  // Print summary
  printSummary(data);

  console.log('\n⏳ Closing in 5s...');
  await sleep(5000);
  await context.close();
  console.log('✅ Done!');
}

function printSummary(d) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 DOM ANALYSIS');
  console.log('='.repeat(70));
  console.log(`URL: ${d.url} | Zero: ${d.zero}`);
  console.log(`\n🏷️  Custom tags: ${d.customTags?.join(', ')}`);
  console.log(`\n📋 Relevant classes:`);
  for (const [c,n] of (d.relCls||[])) console.log(`   ${n}x .${c}`);
  console.log(`\n🤖 Model selectors:`);
  for (const [s,v] of Object.entries(d.model||{})) {
    console.log(`   "${s}" → ${v.n}`);
    for (const x of v.s) { console.log(`     <${x.tag} class="${(x.cls||[]).join(' ')}"> "${(x.t||'').substring(0,100)}"`); console.log(`     ↑ ${(x.p||[]).map(p=>`<${p.tag}.${(p.cls||[]).join('.')}>`).join(' > ')}`); }
  }
  console.log(`\n👤 User selectors:`);
  for (const [s,v] of Object.entries(d.user||{})) {
    console.log(`   "${s}" → ${v.n}`);
    for (const x of v.s) { console.log(`     <${x.tag} class="${(x.cls||[]).join(' ')}"> "${(x.t||'').substring(0,100)}"`); console.log(`     ↑ ${(x.p||[]).map(p=>`<${p.tag}.${(p.cls||[]).join('.')}>`).join(' > ')}`); }
  }
  console.log(`\n🔄 Turns:`);
  for (const [s,v] of Object.entries(d.turns||{})) console.log(`   "${s}" → ${v.n}`);
  console.log(`\n🧪 test-ids:`);
  for (const [id,v] of Object.entries(d.testIds||{})) console.log(`   [${id}] ${v.n}x <${v.tag}> "${(v.t||'').substring(0,60)}"`);
  console.log(`\n📜 Scroller children (${d.scroller?.kids||0}):`);
  for (const c of (d.scrollerKids||[]).slice(0,25)) {
    console.log(`   [${c.i}] <${c.tag}> h=${c.h} t=${c.tLen} kids=${c.nKids} cls=${c.cls.join(' ')}`);
    if (c.kidCls?.length) console.log(`        kidCls: ${c.kidCls.join(', ')}`);
    console.log(`        "${c.t.substring(0,100)}"`);
  }
  console.log('='.repeat(70));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
main().catch(e => { console.error('❌', e.message); process.exit(1); });
