// MOOCS v9.6 — 依序觀看、核對平台進度，再處理測驗。
// 在已登入的 MOOCS 課程頁執行。登入後的 DOM 尚未實測，請先核對掃描清單。
(() => {
  'use strict';
  if (location.origin !== 'https://moocs.moe.edu.tw' || !location.hash.includes('/learning/')) {
    alert('請先登入並開啟 MOOCS 課程學習頁，再執行此程式。');
    return;
  }
  window.__moocs96?.close();
  const root = document.createElement('section');
  root.id = 'moocs-v96';
  root.style.cssText = 'position:fixed;right:16px;top:60px;width:400px;max-width:95vw;max-height:85vh;overflow:auto;z-index:2147483647;background:#151925;color:#eef2ff;border:1px solid #64748b;border-radius:12px;padding:16px;font:13px/1.5 system-ui;box-shadow:0 8px 30px #0008';
  root.innerHTML = `
    <strong>MOOCS v9.6｜影片 → 進度 → 測驗</strong>
    <p>先掃描並核對每項類型，再開始。未知項目會停止流程。</p>
    <div><button data-action="scan">掃描章節</button> <button data-action="run">依序開始</button>
    <button data-action="stop">停止</button> <button data-action="close">關閉</button></div>
    <p data-role="status" aria-live="polite">等待掃描</p>
    <div data-role="queue"></div>
    <details><summary>測驗設定（預設手動）</summary>
      <p><label><input data-role="ai" type="checkbox">使用 AI 選答案</label><br>
      <label><input data-role="submit" type="checkbox">允許自動繳交測驗</label></p>
      <label>引擎 <select data-role="engine"><option value="gemini">Gemini</option><option value="claude">Claude</option></select></label>
      <p><label>模型 <input data-role="model" value="gemini-2.5-flash-lite"></label></p>
      <p><label>API Key <input data-role="key" type="password" autocomplete="off"></label></p>
      <small>Key 只保留在本面板記憶體。啟用 AI 會把題目與選項傳給所選服務，可能產生費用。答案需自行核對。</small>
    </details>
    <details><summary>診斷與記錄</summary><button data-action="diagnose">顯示播放器診斷</button>
      <pre data-role="log" style="white-space:pre-wrap;max-height:220px;overflow:auto"></pre></details>`;
  document.body.append(root);
  const $ = name => root.querySelector(`[data-role="${name}"]`);
  let queue = [], running = false, controller = null, generation = 0;
  const visible = el => !!el?.isConnected && !root.contains(el) && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const note = text => {
    $('status').textContent = text;
    const line = document.createElement('div');
    line.textContent = `${new Date().toLocaleTimeString('zh-TW')} ${text}`;
    $('log').append(line);
    if ($('log').childElementCount > 150) $('log').firstChild.remove();
    $('log').scrollTop = $('log').scrollHeight;
  };
  const stopped = () => { if (controller?.signal.aborted) throw new DOMException('已停止', 'AbortError'); };
  const sleep = ms => new Promise((resolve, reject) => {
    stopped();
    const signal = controller?.signal;
    const cancel = () => { clearTimeout(timer); reject(new DOMException('已停止', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
  async function waitFor(fn, timeout, message) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      stopped();
      const value = fn();
      if (value) return value;
      await sleep(300);
    }
    throw new Error(message);
  }
  const choose = (selector, regex) => [...document.querySelectorAll(selector)].find(el => visible(el) && !el.disabled && regex.test(el.textContent.trim()));
  const courseURL = location.href;
  const COURSE_HASH = location.hash.split('?')[0];
  function ensureCourse() {
    if (!location.hash.startsWith(COURSE_HASH)) throw new Error('已離開原課程，停止。');
  }
  async function expand() {
    for (const header of document.querySelectorAll('mat-expansion-panel-header')) {
      stopped();
      if (!header.closest('mat-expansion-panel')?.classList.contains('mat-expanded')) {
        header.click();
        await sleep(250);
      }
    }
  }
  // 保留原稿的章節 selector；登入後需用掃描清單核對，不能假定所有節點都是影片。
  const rows = () => [...document.querySelectorAll('.syllabus__list-item, .course-node, mat-expansion-panel li')]
    .filter(row => visible(row) && ![...row.children].some(child => child.matches('.syllabus__list-item, .course-node')));
  const rowLink = row => row.matches('a[href]') ? row : row.querySelector('a.syllabus__item-content[href], a.course-node[href], a[href]');
  function roster() {
    const seen = new Set();
    return rows().flatMap(row => {
      const link = rowLink(row);
      if (!link || !visible(link)) return [];
      const url = new URL(link.getAttribute('href'), location.href);
      if (url.origin !== location.origin || !url.hash.startsWith(COURSE_HASH) || url.href === courseURL || seen.has(url.href)) return [];
      seen.add(url.href);
      const title = (row.querySelector('.course-node__title, [class*="title"]')?.textContent || link.textContent || '').trim().replace(/\s+/g, ' ');
      const text = row.textContent.trim().replace(/\s+/g, ' ');
      const hints = `${text} ${[...row.querySelectorAll('[title],[aria-label]')].map(el => `${el.title || ''} ${el.getAttribute('aria-label') || ''}`).join(' ')}`;
      const type = /測驗|單選題|是非題|多選題/.test(hints) ? 'quiz' : /影片|影音|video|播放/i.test(hints) ? 'video' : 'unknown';
      return [{ url: url.href, title: title || '(無標題)', type, text, row, link }];
    });
  }
  function renderQueue() {
    $('queue').replaceChildren();
    queue.forEach((item, index) => {
      const line = document.createElement('div');
      line.style.margin = '6px 0';
      const text = document.createElement('span');
      text.textContent = `${index + 1}. ${item.title} `;
      const select = document.createElement('select');
      for (const [value, title] of [['unknown', '待確認'], ['video', '影片'], ['quiz', '測驗']]) {
        const option = document.createElement('option');
        option.value = value; option.textContent = title; select.append(option);
      }
      select.value = item.type;
      select.disabled = running;
      select.onchange = () => { item.type = select.value; };
      line.append(text, select); $('queue').append(line);
    });
  }
  async function scan() {
    if (running) return;
    controller = new AbortController();
    ensureCourse();
    await expand();
    queue = roster();
    renderQueue();
    note(queue.length ? `找到 ${queue.length} 項；請核對順序、類型及是否涵蓋全部章節。` : '找不到章節連結。請先回課綱，再使用診斷；此版本的 selector 可能不適用。');
  }
  function documents() {
    const docs = [document];
    for (const doc of docs) for (const frame of doc.querySelectorAll('iframe')) {
      try { if (frame.contentDocument && !docs.includes(frame.contentDocument)) docs.push(frame.contentDocument); } catch { /* 跨來源：不讀取 */ }
    }
    return docs;
  }
  function videoElement() {
    return documents().flatMap(doc => [...doc.querySelectorAll('video')]).find(video => video.getClientRects().length && !root.contains(video));
  }
  async function openItem(item) {
    ensureCourse();
    const match = roster().find(entry => entry.url === item.url);
    if (!match) throw new Error(`找不到章節「${item.title}」，請回課綱重新掃描。`);
    stopped();
    match.link.scrollIntoView({ block: 'center' });
    match.link.click();
    await sleep(700);
  }
  async function returnToRoster() {
    stopped();
    ensureCourse();
    if (location.href !== courseURL) location.href = courseURL;
    await waitFor(() => location.href === courseURL, 15000, '無法回到原課綱。');
    await sleep(800);
    await expand();
    await waitFor(() => roster().length, 15000, '課綱尚未載入或章節 selector 不適用。');
  }
  const videoRecorded = text => /已完成觀看|觀看完成|已觀看|已完成|(?:^|\s)100\s*%/.test(text);
  async function watch(item) {
    note(`觀看：${item.title}`);
    if (choose('div.question-wrap', /./)) throw new Error('此項被設為影片，但頁面顯示測驗。請修正清單類型。');
    const video = await waitFor(videoElement, 20000, '找不到可讀取的影片播放器。若為跨來源 iframe，請手動觀看；此版本無法確認其播放結束。');
    if (video.playbackRate !== 1) video.playbackRate = 1;
    try { await video.play(); } catch { note('瀏覽器未允許自動播放，請在播放器按播放；程式會等待。'); }
    let lastTime = video.currentTime, lastAdvance = Date.now(), lastNote = 0;
    while (!video.ended) {
      stopped(); ensureCourse();
      if (document.hidden) throw new Error('頁面已切到背景。請回到課程頁播放，避免平台不記錄觀看。');
      if (!video.isConnected || videoElement() !== video) throw new Error('播放器已更換，停止以免錯認影片。');
      if (video.error) throw new Error(`播放器錯誤：${video.error.code}`);
      if (video.playbackRate !== 1 || video.seeking) throw new Error('偵測到變速或跳轉；請以正常速度完整觀看後重新開始。');
      if (video.currentTime > lastTime + 0.05) { lastAdvance = Date.now(); lastTime = video.currentTime; }
      if (Date.now() - lastAdvance > 120000) throw new Error('影片超過兩分鐘沒有前進，請檢查暫停、緩衝或平台提示。');
      if (Date.now() - lastNote > 10000) {
        const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : '?';
        note(`觀看 ${item.title}：${Math.round(video.currentTime)} / ${duration} 秒${video.paused ? '（暫停中）' : ''}`);
        lastNote = Date.now();
      }
      await sleep(500);
    }
    note('影片已結束；等待平台儲存並回課綱核對。');
    await sleep(4000);
    await returnToRoster();
    await waitFor(() => {
      const row = roster().find(entry => entry.url === item.url);
      return row && videoRecorded(row.text);
    }, 15000, '影片結束，但課綱未顯示已完成／100%。請手動確認學習進度；不繼續測驗。');
    note(`平台已顯示影片完成：${item.title}`);
  }
  function question() {
    const wrap = [...document.querySelectorAll('div.question-wrap')].find(visible);
    if (!wrap) return null;
    const options = [...wrap.querySelectorAll('label.question__option, li.question__option-wrap label')]
      .filter(el => visible(el) && el.innerText.trim());
    const text = wrap.innerText.trim();
    const index = options.length ? text.indexOf(options[0].innerText.trim()) : -1;
    const prompt = index > 0 ? text.slice(0, index).trim() : text;
    return { wrap, options, text: prompt, signature: `${prompt}\n${options.map(el => el.innerText.trim()).join('\n')}` };
  }
  function parseAnswers(raw, count, multiple) {
    let data;
    try { data = JSON.parse(raw.trim()); } catch { throw new Error(`AI 回覆不是答案陣列：${raw.slice(0, 80)}`); }
    if (!Array.isArray(data) || !data.length || (!multiple && data.length !== 1) || new Set(data).size !== data.length || data.some(n => !Number.isInteger(n) || n < 0 || n >= count)) {
      throw new Error('AI 回覆包含無效、重複或超出範圍的選項，停止作答。');
    }
    return data;
  }
  async function ask(questionData, settings) {
    const multiple = /多選題/.test(questionData.text);
    const prompt = `請依題目與選項內容判斷答案。僅回覆 JSON 整數陣列，索引從 0 起。${multiple ? '多選，可選多項。' : '單選或是非，只選一項。是非也必須依實際選項順序判斷。'}不能判斷時回覆 []。\n題目：${questionData.text}\n${questionData.options.map((el, index) => `${index}: ${el.innerText.trim()}`).join('\n')}`;
    const isGemini = settings.engine === 'gemini';
    const url = isGemini ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent` : 'https://api.anthropic.com/v1/messages';
    for (let attempt = 0; attempt < 3; attempt++) {
      stopped();
      const request = new AbortController();
      const signal = controller.signal;
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 45000);
      let response, data;
      try {
        response = await fetch(url, {
          method: 'POST', signal: request.signal,
          headers: isGemini ? { 'Content-Type': 'application/json', 'x-goog-api-key': settings.key } : {
            'Content-Type': 'application/json', 'x-api-key': settings.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify(isGemini ? { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 128, temperature: 0 } } : {
            model: settings.model, max_tokens: 128, messages: [{ role: 'user', content: prompt }]
          })
        });
        if (response.ok) data = await response.json();
      } catch (error) {
        stopped();
        throw new Error(error.name === 'AbortError' ? 'AI 請求逾時；停止作答。' : 'AI 連線失敗；請檢查網路或瀏覽器跨來源限制。');
      } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
      if (response.status === 429 && attempt < 2) { note('AI 額度限制，稍後重試。'); await sleep((attempt + 1) * 20000); continue; }
      if (!response.ok) throw new Error(`AI API 錯誤 HTTP ${response.status}；停止作答。`);
      const raw = isGemini ? (data?.candidates?.[0]?.content?.parts || []).filter(part => !part.thought).map(part => part.text || '').join('') :
        (data?.content || []).filter(part => part.type === 'text').map(part => part.text).join('');
      return parseAnswers(raw, questionData.options.length, multiple);
    }
    throw new Error('AI 重試次數已用完。');
  }
  function confirmedResult() {
    // 結果須有明確文字；不能用「沒有重新測驗按鈕」推定通過。
    const result = [...document.querySelectorAll('[class*="result"], [role="dialog"], [class*="score"]')].filter(visible);
    return result.find(el => /(?:測驗通過|已通過|恭喜.{0,12}通過|測驗合格)/.test(el.innerText) && !/未通過|不合格/.test(el.innerText));
  }
  async function quiz(item, settings) {
    if (!settings.ai) throw new Error(`已依順序到達測驗「${item.title}」。請手動作答；完成後回課綱重新掃描。`);
    let entered = false;
    await waitFor(() => {
      if (question()?.options.length) return true;
      const enter = choose('button', /^(進入測驗|開始測驗)$/);
      if (enter && !entered) { stopped(); enter.click(); entered = true; }
      return false;
    }, 20000, '測驗頁未出現。');
    for (let index = 0; index < 100; index++) {
      stopped(); ensureCourse();
      const q = question();
      if (!q?.options.length) throw new Error('題目或選項無法辨識。');
      note(`測驗 ${item.title}：第 ${index + 1} 題`);
      const answers = await ask(q, settings);
      stopped();
      if (question()?.signature !== q.signature) throw new Error('等待 AI 期間題目已改變，停止以免選錯題。');
      for (const [optionIndex, option] of q.options.entries()) {
        const input = option.querySelector('input[type="radio"], input[type="checkbox"]') || (option.htmlFor ? document.getElementById(option.htmlFor) : null);
        if (!input || input.disabled) throw new Error('無法找到可操作的答案輸入欄。');
        const desired = answers.includes(optionIndex);
        if (input.type === 'checkbox' && input.checked !== desired) input.click();
        else if (input.type === 'radio' && desired && !input.checked) input.click();
      }
      await sleep(300);
      if (answers.some(i => {
        const option = q.options[i];
        const input = option.querySelector('input') || document.getElementById(option.htmlFor);
        return !input?.checked;
      })) throw new Error('選項沒有成功勾選，停止。');
      const next = [...document.querySelectorAll('button.btn-control.--right')].find(el => visible(el) && !el.disabled) || choose('button', /^(下一題|下一|Next)$/);
      if (next) {
        stopped(); next.click();
        await waitFor(() => question()?.signature !== q.signature, 15000, '下一題沒有載入；不強制繳交。');
        await waitFor(() => question()?.options.length, 15000, '下一題選項尚未載入。');
        continue;
      }
      const submit = choose('button', /^(送出|提交|繳交|繳交作答|Submit)$/);
      if (!submit) throw new Error('找不到下一題或繳交按鈕。');
      if (!settings.submit) throw new Error('答案已勾選，請核對後手動繳交。');
      stopped(); submit.click();
      await waitFor(confirmedResult, 20000, '未看到明確通過結果。若出現確認視窗，請自行核對並處理；不自動重測。');
      note(`測驗頁明確顯示通過：${item.title}`);
      await returnToRoster();
      await waitFor(() => /已通過|已完成|測驗合格/.test(roster().find(entry => entry.url === item.url)?.text || ''), 15000, '結果頁通過，但課綱尚未確認測驗完成，停止。');
      return;
    }
    throw new Error('已到測驗題數上限。');
  }
  async function run() {
    if (running) return;
    if (!queue.length) { note('請先掃描章節。'); return; }
    if (queue.some(item => item.type === 'unknown')) { note('請先確認清單中所有「待確認」項目的類型。'); return; }
    const settings = { ai: $('ai').checked, submit: $('submit').checked, engine: $('engine').value, model: $('model').value.trim(), key: $('key').value.trim() };
    if (settings.ai && (!settings.model || !settings.key)) { note('啟用 AI 時需要模型名稱與 API Key。'); return; }
    running = true; controller = new AbortController();
    const thisGeneration = ++generation;
    renderQueue();
    try {
      ensureCourse();
      for (const item of queue) {
        stopped();
        const current = roster().find(entry => entry.url === item.url);
        if (!current) throw new Error(`章節「${item.title}」不在目前課綱；請回課綱重新掃描。`);
        const complete = item.type === 'video' ? videoRecorded(current.text) : /已通過|測驗合格/.test(current.text);
        if (complete) { note(`平台已完成，略過：${item.title}`); continue; }
        await openItem(item);
        if (item.type === 'video') await watch(item); else await quiz(item, settings);
      }
      note('清單處理完畢。請到平台檢查認證條件；這不代表已取得證書。');
    } catch (error) { note(error.name === 'AbortError' ? '已停止；不會繼續點擊或作答。' : `停止：${error.message}`); }
    finally { if (generation === thisGeneration) { running = false; renderQueue(); } }
  }
  function diagnose() {
    note(JSON.stringify({
      chapterRows: rows().length, scanEntries: roster().map(({ title, type }) => ({ title, type })),
      videoCount: documents().reduce((n, doc) => n + doc.querySelectorAll('video').length, 0),
      iframeOrigins: [...document.querySelectorAll('iframe[src]')].map(el => { try { return new URL(el.src).origin; } catch { return '(未知)'; } }),
      questionVisible: !!question(), buttons: [...document.querySelectorAll('button')].filter(visible).map(el => el.textContent.trim()).filter(Boolean)
    }, null, 2));
  }
  function stop() { controller?.abort(); note('已要求停止。'); }
  function close() { controller?.abort(); root.remove(); if (window.__moocs96?.root === root) delete window.__moocs96; }
  $('engine').onchange = () => { $('model').value = $('engine').value === 'gemini' ? 'gemini-2.5-flash-lite' : 'claude-haiku-4-5-20251001'; };
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const actions = { scan, run, stop, close, diagnose };
    if (actions[action]) Promise.resolve(actions[action]()).catch(error => note(`停止：${error.message}`));
  });
  window.__moocs96 = { root, close };
})();
