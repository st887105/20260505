// MOOCS v9.7 — 支援無 href 的右側 EP 課綱；可拖曳、縮合視窗。
// 在已登入的 MOOCS 課程頁執行。登入後的 DOM 尚未實測，請先核對掃描清單。
(() => {
  'use strict';
  if (location.origin !== 'https://moocs.moe.edu.tw' || !location.hash.includes('/learning/')) {
    alert('請先登入並開啟 MOOCS 課程學習頁，再執行此程式。');
    return;
  }
  window.__moocs96?.close();
  window.__moocs97?.close();
  const root = document.createElement('section');
  root.id = 'moocs-v97';
  root.style.cssText = 'position:fixed;left:16px;top:100px;width:390px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);box-sizing:border-box;overflow:auto;z-index:2147483647;background:#151925;color:#eef2ff;border:1px solid #64748b;border-radius:12px;font:13px/1.5 system-ui;box-shadow:0 8px 30px #0008';
  root.innerHTML = `
    <div data-role="handle" tabindex="0" aria-label="拖曳視窗標題，或使用方向鍵移動" style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:12px;background:#26324b;cursor:move;touch-action:none;user-select:none;border-radius:12px 12px 0 0">
      <strong>MOOCS v9.7 <small>拖曳此處移動</small></strong>
      <span style="display:flex;gap:4px"><button data-action="collapse" aria-expanded="true">縮合</button><button data-action="close" aria-label="關閉視窗">✕</button></span>
    </div><div data-role="body" style="padding:12px">
    <p>先掃描並核對每項類型，再開始。未知項目會停止流程。</p>
    <div><button data-action="scan">掃描章節</button> <button data-action="run">依序開始</button>
    <button data-action="stop">停止</button></div>
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
    <details><summary>診斷與記錄</summary><button data-action="diagnose">顯示診斷</button>
      <button data-action="download">下載診斷</button>
      <pre data-role="log" style="white-space:pre-wrap;max-height:220px;overflow:auto"></pre></details></div>`;
  document.body.append(root);
  const $ = name => root.querySelector(`[data-role="${name}"]`);
  let queue = [], running = false, scanning = false, controller = null, generation = 0;
  function place(left, top) {
    root.style.left = `${Math.max(8, Math.min(left, Math.max(8, innerWidth - root.offsetWidth - 8)))}px`;
    root.style.top = `${Math.max(8, Math.min(top, Math.max(8, innerHeight - root.offsetHeight - 8)))}px`;
  }
  const handle = $('handle');
  let drag = null;
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const rect = root.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId) place(event.clientX - drag.x, event.clientY - drag.y);
  });
  const endDrag = () => { drag = null; };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(event, endDrag);
  handle.addEventListener('keydown', event => {
    if (event.target !== handle) return;
    const step = event.shiftKey ? 50 : 10;
    const deltas = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!deltas[event.key]) return;
    event.preventDefault();
    const rect = root.getBoundingClientRect();
    place(rect.left + deltas[event.key][0], rect.top + deltas[event.key][1]);
  });
  const reposition = () => { const rect = root.getBoundingClientRect(); place(rect.left, rect.top); };
  window.addEventListener('resize', reposition);
  place(16, 100);
  function collapse() {
    $('body').hidden = !$('body').hidden;
    const button = root.querySelector('[data-action="collapse"]');
    button.textContent = $('body').hidden ? '展開' : '縮合';
    button.setAttribute('aria-expanded', String(!$('body').hidden));
    reposition();
  }
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
  const COURSE_HASH = location.hash.match(/^#\/learning\/[^/?]+/)?.[0];
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
  const cleanText = text => (text || '').trim().replace(/\s+/g, ' ');
  const chapterLabel = text => /^(?:EP\s*\d+(?:[-.．]\d+)*[.．、:\s]?|第\s*[\d一二三四五六七八九十]+\s*[章節])|(?:課後問卷|課後測驗|章節測驗|總測驗)/i.test(text);
  const explicitRowSelector = '.syllabus__list-item, .course-node, mat-expansion-panel li, mat-list-item, [role="listitem"]';
  function rows() {
    const explicit = [...document.querySelectorAll(explicitRowSelector)].filter(visible);
    // 畫面上的 EP1 / EP2-1 / 課後問卷可能是 Angular click 節點，沒有 href。
    const candidates = [...document.querySelectorAll('a, button, li, div, p, span, h3, h4, mat-list-item')].filter(el => {
      if (!visible(el)) return false;
      const text = cleanText(el.textContent);
      const rect = el.getBoundingClientRect();
      return text.length <= 240 && chapterLabel(text) && rect.left >= innerWidth * 0.55;
    });
    const labels = candidates.filter(el => !candidates.some(other => other !== el && el.contains(other)));
    const result = labels.map(label => {
      const ancestor = label.closest(explicitRowSelector);
      if (ancestor && cleanText(ancestor.textContent).length <= 400) return ancestor;
      const clickable = label.closest('a,button,[role="button"]');
      if (clickable && cleanText(clickable.textContent).length <= 400) return clickable;
      let row = label;
      for (let parent = label.parentElement, depth = 0; parent && depth < 4; parent = parent.parentElement, depth++) {
        if (parent.getBoundingClientRect().left < innerWidth * 0.55 || cleanText(parent.textContent).length > 400 ||
          labels.filter(other => parent.contains(other)).length !== 1) break;
        row = parent; // 保留同一列的完成文字及 Angular click 父層。
      }
      return row;
    });
    for (const el of explicit) {
      if (!result.some(other => el.contains(other) || other.contains(el)) &&
        !explicit.some(other => other !== el && el.contains(other)) && cleanText(el.textContent).length <= 400) result.push(el);
    }
    return [...new Set(result)].sort((a, b) => a.compareDocumentPosition(b) & 4 ? -1 : 1);
  }
  const rowLink = row => row.matches('a,button,[role="button"]') ? row : row.querySelector('a,button,[role="button"]') || row;
  const itemMatches = (entry, item) => entry.key === item.key;
  function rowSelected(row) {
    for (let el = row, depth = 0; el && depth < 3; el = el.parentElement, depth++) {
      if (el.matches('[aria-selected="true"], [aria-current="true"], [aria-current="page"], .active, .selected, .is-active, .mat-selected')) return true;
      if (/(?:^|\s)\S*--(?:active|selected|current)(?:\s|$)/.test(String(el.className))) return true;
    }
    return false;
  }
  function roster() {
    const seen = new Set();
    return rows().flatMap(row => {
      const link = rowLink(row);
      if (!visible(link)) return [];
      const rawURL = link.getAttribute('href');
      const url = rawURL && rawURL !== '#' && !rawURL.startsWith('javascript:') ? new URL(rawURL, location.href) : null;
      if (url && (url.origin !== location.origin || !url.hash.startsWith(COURSE_HASH))) return [];
      const text = cleanText(row.textContent);
      let title = cleanText(row.querySelector('.course-node__title, [class*="title"]')?.textContent || text);
      title = title.replace(/\s*(?:未測驗|已通過|已完成觀看|觀看完成|已觀看|已完成|未完成|\d+(?:\.\d+)?\s*%)\s*$/g, '').trim();
      if (!title) return [];
      const key = url && url.href !== courseURL ? `url:${url.href}` : `title:${title}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const hints = `${text} ${[...row.querySelectorAll('[title],[aria-label]')].map(el => `${el.title || ''} ${el.getAttribute('aria-label') || ''}`).join(' ')}`;
      const type = /問卷|調查/.test(hints) ? 'survey' : /測驗|單選題|是非題|多選題/.test(hints) ? 'quiz' : /影片|影音|video|播放/i.test(hints) ? 'video' : 'unknown';
      return [{ key, url: url?.href || null, title, type, text, row, link }];
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
      for (const [value, title] of [['unknown', '待確認'], ['video', '影片'], ['quiz', '測驗'], ['survey', '問卷（手動）']]) {
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
    if (running || scanning) return;
    scanning = true;
    controller = new AbortController();
    try {
      ensureCourse();
      await expand();
      queue = roster();
      renderQueue();
      note(queue.length ? `找到 ${queue.length} 項；請將 EP 章節核對為影片或測驗。課後問卷另列手動，不會自動填寫。` : '未找到章節。請展開右側「課程章節」，再掃描；仍失敗時按「下載診斷」。');
      reposition();
    } finally { scanning = false; }
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
    const match = roster().find(entry => itemMatches(entry, item));
    if (!match) throw new Error(`找不到章節「${item.title}」，請回課綱重新掃描。`);
    stopped();
    match.link.scrollIntoView({ block: 'center' });
    const oldVideo = videoElement();
    const oldSource = oldVideo?.currentSrc || oldVideo?.src;
    const oldQuestion = question()?.signature;
    const alreadySelected = rowSelected(match.row);
    match.link.click();
    await sleep(700);
    if (item.type === 'video' && !alreadySelected) {
      await waitFor(() => {
        const video = videoElement();
        if (!video) return false;
        const current = roster().find(entry => itemMatches(entry, item));
        return video !== oldVideo || (video.currentSrc || video.src) !== oldSource || (current && rowSelected(current.row));
      }, 20000, '章節點擊後沒有確認播放器切換。請手動點此影片，再重新掃描；不沿用上一部影片。');
    } else if (item.type === 'quiz' && oldQuestion && !alreadySelected) {
      await waitFor(() => question()?.signature !== oldQuestion, 15000, '測驗章節沒有切換。');
    }
  }
  async function returnToRoster() {
    stopped();
    ensureCourse();
    // 學習頁右側清單持續存在時，不需返回或重載課程。
    if (roster().length) { await expand(); return; }
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
      const row = roster().find(entry => itemMatches(entry, item));
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
      await waitFor(() => /已通過|已完成|測驗合格/.test(roster().find(entry => itemMatches(entry, item))?.text || ''), 15000, '結果頁通過，但課綱尚未確認測驗完成，停止。');
      return;
    }
    throw new Error('已到測驗題數上限。');
  }
  async function run() {
    if (running || scanning) return;
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
        const current = roster().find(entry => itemMatches(entry, item));
        if (!current) throw new Error(`章節「${item.title}」不在目前課綱；請回課綱重新掃描。`);
        const complete = item.type === 'video' ? videoRecorded(current.text) : /已通過|測驗合格/.test(current.text);
        if (complete) { note(`平台已完成，略過：${item.title}`); continue; }
        await openItem(item);
        if (item.type === 'video') await watch(item);
        else if (item.type === 'survey') throw new Error(`已到達課後問卷「${item.title}」。請依實際學習經驗手動填寫。`);
        else await quiz(item, settings);
      }
      note('清單處理完畢。請到平台檢查認證條件；這不代表已取得證書。');
    } catch (error) { note(error.name === 'AbortError' ? '已停止；不會繼續點擊或作答。' : `停止：${error.message}`); }
    finally { if (generation === thisGeneration) { running = false; renderQueue(); } }
  }
  function diagnosticData() {
    return {
      version: '9.7',
      chapterRows: rows().length, scanEntries: roster().map(({ title, type }) => ({ title, type })),
      chapterElements: rows().map(row => ({ title: cleanText(row.textContent), tag: row.tagName, class: String(row.className),
        ancestors: [row.parentElement, row.parentElement?.parentElement].filter(Boolean).map(el => ({ tag: el.tagName, class: String(el.className) })) })),
      videoCount: documents().reduce((n, doc) => n + doc.querySelectorAll('video').length, 0),
      iframeOrigins: [...document.querySelectorAll('iframe[src]')].map(el => { try { return new URL(el.src).origin; } catch { return '(未知)'; } }),
      questionVisible: !!question(), buttons: [...document.querySelectorAll('button')].filter(visible).map(el => el.textContent.trim()).filter(Boolean)
    };
  }
  function diagnose() { note(JSON.stringify(diagnosticData(), null, 2)); root.querySelector('details:last-of-type').open = true; }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(diagnosticData(), null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'moocs-v9.7-diagnostic.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    note('已下載診斷。分享前請檢查章節標題及按鈕文字。');
  }
  function stop() { controller?.abort(); note('已要求停止。'); }
  function close() { controller?.abort(); window.removeEventListener('resize', reposition); root.remove(); if (window.__moocs97?.root === root) delete window.__moocs97; }
  $('engine').onchange = () => { $('model').value = $('engine').value === 'gemini' ? 'gemini-2.5-flash-lite' : 'claude-haiku-4-5-20251001'; };
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const actions = { scan, run, stop, close, diagnose, download, collapse };
    if (actions[action]) Promise.resolve(actions[action]()).catch(error => note(`停止：${error.message}`));
  });
  window.__moocs97 = { root, close };
})();
