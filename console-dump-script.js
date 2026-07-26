// ============================================================
// PASTE THIS INTO YOUR GEMINI TAB'S CONSOLE (F12 → Console)
// It will analyze the DOM and download the result as JSON
// ============================================================

(function() {
  console.log('🔍 Analyzing Gemini DOM structure...');

  function cls(el) {
    if (!el || !el.className || typeof el.className !== 'string') return [];
    return el.className.split(/\s+/).filter(c => c && !/^ng-/.test(c) && !/^_ng/.test(c) && c.length < 80);
  }

  function info(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      cls: cls(el),
      id: el.id || undefined,
      role: el.getAttribute('role') || undefined,
      aria: el.getAttribute('aria-label') || undefined,
      testId: el.getAttribute('data-test-id') || undefined,
      data: Object.fromEntries([...el.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value.substring(0, 100)])),
      rect: { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
    };
  }

  function parents(el, n = 8) {
    const chain = [];
    let cur = el;
    for (let i = 0; i < n && cur && cur !== document.body; i++) {
      chain.push({ tag: cur.tagName.toLowerCase(), cls: cls(cur).slice(0, 5), role: cur.getAttribute('role'), testId: cur.getAttribute('data-test-id') });
      cur = cur.parentElement;
    }
    return chain;
  }

  function tree(el, depth = 0, maxD = 5) {
    if (!el || depth > maxD) return null;
    const children = [...el.children].slice(0, 20);
    const node = { tag: el.tagName.toLowerCase(), cls: cls(el).slice(0, 5), role: el.getAttribute('role') || undefined, testId: el.getAttribute('data-test-id') || undefined };
    if (children.length === 0) {
      const t = el.textContent?.trim();
      if (t && t.length < 200) node.text = t;
    } else {
      node.kids = children.map(c => tree(c, depth + 1, maxD)).filter(Boolean);
      if (el.children.length > 20) node.more = el.children.length - 20;
    }
    return node;
  }

  const R = {
    url: location.href,
    title: document.title,
    timestamp: new Date().toISOString(),
    bodyClasses: document.body.className,
    isZeroState: document.body.className.includes('zero-state-theme'),
  };

  // 1. Chat container
  const chatContainer = document.querySelector('[class*="chat-container"]');
  if (chatContainer) R.chatContainer = { ...info(chatContainer), tree: tree(chatContainer, 0, 3) };

  // 2. Scroller / message list
  const scroller = document.querySelector('infinite-scroller[data-test-id="chat-history-container"]') ||
                   document.querySelector('[class*="chat-history-scroll"]') ||
                   document.querySelector('infinite-scroller');
  if (scroller) {
    R.scroller = { ...info(scroller), childCount: scroller.children.length };
    R.scrollerChildren = [...scroller.children].slice(0, 40).map((c, i) => ({
      i, tag: c.tagName.toLowerCase(), cls: cls(c).slice(0, 8),
      role: c.getAttribute('role'), testId: c.getAttribute('data-test-id'),
      h: Math.round(c.getBoundingClientRect().height),
      textLen: (c.textContent || '').length,
      text: (c.textContent || '').substring(0, 200).trim(),
      kidCount: c.children.length,
      kidTags: [...new Set([...c.children].map(k => k.tagName.toLowerCase()))].slice(0, 10),
      kidClasses: [...new Set([...c.children].flatMap(k => cls(k)))].slice(0, 10),
    }));
  }

  // 3. Try ALL possible model response selectors
  const modelSels = ['.model-response-text', '[class*="model-response-text"]', '[class*="model-response"]',
    '.markdown', '[class*="markdown"]', '[class*="response-content"]', 'message-content',
    '[class*="message-content"]', 'model-response', '[class*="assistant-message"]',
    '[class*="response"]', '.text', '[class*="text"]'];
  R.modelElements = {};
  for (const sel of modelSels) {
    try {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        R.modelElements[sel] = { count: els.length, samples: [...els].slice(0, 3).map(el => ({
          ...info(el), parents: parents(el), text: (el.textContent || '').substring(0, 400),
          html: el.innerHTML.substring(0, 1500), tree: tree(el, 0, 3),
        }))};
      }
    } catch(e) {}
  }

  // 4. Try ALL possible user query selectors
  const userSels = ['.query-text', '[class*="query-text"]', '[class*="user-query"]',
    'user-query', '[class*="user-message"]', '[class*="prompt-text"]', '[class*="query"]'];
  R.userElements = {};
  for (const sel of userSels) {
    try {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        R.userElements[sel] = { count: els.length, samples: [...els].slice(0, 3).map(el => ({
          ...info(el), parents: parents(el), text: (el.textContent || '').substring(0, 400),
          html: el.innerHTML.substring(0, 800),
        }))};
      }
    } catch(e) {}
  }

  // 5. Turn/exchange containers
  const turnSels = ['[class*="turn"]', '[class*="exchange"]', 'model-response', 'user-query',
    '[class*="conversation-turn"]', '[class*="chat-turn"]', '[class*="message-row"]',
    '[class*="message-container"]', '[class*="msg"]'];
  R.turnElements = {};
  for (const sel of turnSels) {
    try {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        R.turnElements[sel] = { count: els.length, samples: [...els].slice(0, 3).map(el => ({
          ...info(el), parents: parents(el, 5), tree: tree(el, 0, 4),
          outerHTML: el.outerHTML.substring(0, 4000),
        }))};
      }
    } catch(e) {}
  }

  // 6. Custom elements
  const allEls = document.querySelectorAll('*');
  const customTags = new Set();
  const relClasses = {};
  for (const el of allEls) {
    const tag = el.tagName.toLowerCase();
    if (tag.includes('-')) customTags.add(tag);
    cls(el).forEach(c => {
      if (/turn|message|response|query|model|user|markdown|chat|content|text|prompt|bubble/i.test(c)) {
        relClasses[c] = (relClasses[c] || 0) + 1;
      }
    });
  }
  R.customTags = [...customTags].sort();
  R.relevantClasses = Object.entries(relClasses).sort((a, b) => b[1] - a[1]).slice(0, 80);

  // 7. data-test-id inventory
  const testIds = {};
  document.querySelectorAll('[data-test-id]').forEach(el => {
    const id = el.getAttribute('data-test-id');
    if (!testIds[id]) testIds[id] = { count: 0, tag: el.tagName.toLowerCase(), cls: cls(el).slice(0, 3), text: (el.textContent || '').substring(0, 80) };
    testIds[id].count++;
  });
  R.testIds = testIds;

  // 8. First children HTML of scroller (the actual message elements)
  if (scroller && scroller.children.length > 0) {
    R.scrollerChildrenHTML = [...scroller.children].slice(0, 8).map(c => c.outerHTML.substring(0, 5000));
  }

  // 9. If we found markdown elements, get their parent context
  const mdEls = document.querySelectorAll('.markdown, [class*="model-response-text"]');
  if (mdEls.length > 0) {
    R.markdownParentHTML = [...mdEls].slice(0, 3).map(el => {
      let p = el;
      for (let i = 0; i < 4 && p.parentElement && p.parentElement !== document.body; i++) p = p.parentElement;
      return { html: p.outerHTML.substring(0, 6000), info: info(p), parents: parents(p, 4) };
    });
  }

  // 10. Get the full structure around the first user message and first model message
  const firstUser = document.querySelector('.query-text, [class*="query-text"], [class*="user-query"]');
  const firstModel = document.querySelector('.model-response-text, [class*="model-response-text"], .markdown');
  if (firstUser) {
    let p = firstUser;
    for (let i = 0; i < 5 && p.parentElement; i++) p = p.parentElement;
    R.firstUserContext = { html: p.outerHTML.substring(0, 5000), tree: tree(p, 0, 5) };
  }
  if (firstModel) {
    let p = firstModel;
    for (let i = 0; i < 5 && p.parentElement; i++) p = p.parentElement;
    R.firstModelContext = { html: p.outerHTML.substring(0, 5000), tree: tree(p, 0, 5) };
  }

  // Download as JSON
  const blob = new Blob([JSON.stringify(R, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gemini-dom-dump.json';
  a.click();
  URL.revokeObjectURL(url);

  console.log('✅ DOM analysis downloaded as gemini-dom-dump.json');
  console.log('📊 Quick summary:');
  console.log(`   Zero-state: ${R.isZeroState}`);
  console.log(`   Scroller children: ${R.scroller?.childCount || 0}`);
  console.log(`   Model selectors matched: ${Object.keys(R.modelElements).length}`);
  console.log(`   User selectors matched: ${Object.keys(R.userElements).length}`);
  console.log(`   Turn selectors matched: ${Object.keys(R.turnElements).length}`);
  console.log(`   Custom tags: ${R.customTags.join(', ')}`);
  console.log(`   Relevant classes: ${R.relevantClasses.map(([c,n]) => `${n}x.${c}`).join(', ')}`);

  // Also copy to clipboard
  copy(JSON.stringify(R, null, 2));
  console.log('📋 Also copied to clipboard!');

  return R;
})();
