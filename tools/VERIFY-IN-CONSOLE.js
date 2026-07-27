// ============================================================
// QUICK VERIFICATION — Paste in console on an OPEN conversation
// Tests if the new selectors find messages correctly
// ============================================================
(function(){
  const scroller = document.querySelector('infinite-scroller[data-test-id="chat-history-container"]') || document.querySelector('infinite-scroller');
  console.log('Scroller found:', !!scroller, scroller ? scroller.children.length + ' children' : '');

  if (!scroller) { console.error('❌ No scroller! Are you on a conversation page?'); return; }

  let userCount = 0, modelCount = 0, unknownCount = 0;
  const samples = [];

  for (const child of scroller.children) {
    const cls = (child.className || '').toString();
    if (/zero-state|banner|disclaimer/i.test(cls) || child.tagName.toLowerCase().startsWith('zero-state')) continue;

    const userEl = child.querySelector('user-query, .query-text, [class*="query-text"], [class*="user-query"]');
    const modelEl = child.querySelector('model-response, .model-response-text, [class*="model-response-text"], model-response-primary');

    if (userEl) {
      userCount++;
      if (samples.length < 3) samples.push({ type: 'USER', text: (userEl.innerText || userEl.textContent || '').substring(0, 150) });
    }
    if (modelEl) {
      modelCount++;
      if (samples.length < 6) samples.push({ type: 'MODEL', text: (modelEl.innerText || modelEl.textContent || '').substring(0, 150) });
    }
    if (!userEl && !modelEl && (child.innerText || '').trim().length > 20) {
      unknownCount++;
      if (samples.length < 8) samples.push({ type: 'UNKNOWN', tag: child.tagName, cls: cls.substring(0, 80), text: (child.innerText || '').substring(0, 150) });
    }
  }

  console.log(`%c✅ Results: ${userCount} user msgs, ${modelCount} model msgs, ${unknownCount} unknown`, 'font-size:16px;color:#4ade80;font-weight:bold');
  console.log('Samples:');
  samples.forEach((s, i) => console.log(`  [${i}] ${s.type}: "${s.text}"`));

  // Also check direct queries
  const directUser = document.querySelectorAll('user-query, .query-text, [class*="query-text"]');
  const directModel = document.querySelectorAll('model-response, .model-response-text, [class*="model-response-text"]');
  console.log(`\nDirect queries: ${directUser.length} user els, ${directModel.length} model els`);

  if (userCount === 0 && modelCount === 0) {
    console.log('%c⚠️ No messages found via scroller children. Trying broader search...', 'color:#facc15');
    const allMarkdown = document.querySelectorAll('.markdown');
    const allQueryText = document.querySelectorAll('.query-text');
    console.log(`  .markdown elements: ${allMarkdown.length}`);
    console.log(`  .query-text elements: ${allQueryText.length}`);

    // Show the scroller children structure
    console.log('\nScroller children structure:');
    for (let i = 0; i < Math.min(scroller.children.length, 10); i++) {
      const c = scroller.children[i];
      console.log(`  [${i}] <${c.tagName.toLowerCase()}> cls="${(c.className||'').toString().substring(0,80)}" kids=${c.children.length} text=${(c.innerText||'').length}chars`);
      // Show first level children
      for (let j = 0; j < Math.min(c.children.length, 5); j++) {
        const gc = c.children[j];
        console.log(`    [${j}] <${gc.tagName.toLowerCase()}> cls="${(gc.className||'').toString().substring(0,80)}"`);
      }
    }
  }
})();
