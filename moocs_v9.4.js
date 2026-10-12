// MOOCS v9.11 — 自動辨識章節；客觀題 AI 判斷；主觀問卷依使用者指定選第一項。
// 由使用者提供的 v9.8 原始檔修改；v9.11 依登入後的真實 DOM 與播放記錄修正。
// 完整課程認列仍須由使用者核對，實測範圍見隨附觀察報告。
// 僅操作既有頁面與正常播放器；不偽造可見狀態、學習紀錄或閒置訊號。
(() => {
  'use strict';
  if (location.origin !== 'https://moocs.moe.edu.tw' || !location.hash.includes('/learning/')) {
    alert('請先登入並開啟 MOOCS 課程學習頁，再執行此程式。');
    return;
  }
  const prior = window.__moocs911?.root || window.__moocs910?.root || window.__moocs99?.root || window.__moocs98?.root || window.__moocs97?.root || window.__moocs96?.root;
  const previousSettings = Object.fromEntries(['engine', 'model', 'key'].map(name => [name, prior?.querySelector(`[data-role="${name}"]`)?.value || '']));
  const previousBackground = prior?.querySelector('[data-role="background"]')?.checked || false;
  window.__moocs911?.close();
  window.__moocs910?.close();
  window.__moocs99?.close();
  window.__moocs96?.close();
  window.__moocs97?.close();
  window.__moocs98?.close();
  const root = document.createElement('section');
  root.id = 'moocs-v911';
  root.style.cssText = 'position:fixed;left:16px;top:100px;width:390px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);box-sizing:border-box;overflow:auto;z-index:2147483647;background:#151925;color:#eef2ff;border:1px solid #64748b;border-radius:12px;font:13px/1.5 system-ui;box-shadow:0 8px 30px #0008';
  root.innerHTML = `
    <div data-role="handle" tabindex="0" aria-label="拖曳視窗標題，或使用方向鍵移動" style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:12px;background:#26324b;cursor:move;touch-action:none;user-select:none;border-radius:12px 12px 0 0">
      <strong>MOOCS v9.11 <small>拖曳此處移動</small></strong>
      <span style="display:flex;gap:4px"><button data-action="collapse" aria-expanded="true">縮合</button><button data-action="close" aria-label="關閉視窗">✕</button></span>
    </div><div data-role="body" style="padding:12px">
    <p>自動辨識影片、測驗及問卷。主觀問卷依你的指定選第一項。</p>
    <div><button data-action="scan">重新掃描</button> <button data-action="run">自動開始</button>
    <button data-action="stop">停止</button></div>
    <p data-role="status" aria-live="polite">等待掃描</p>
    <div data-role="queue"></div>
    <details open><summary>播放設定</summary>
      <label><input data-role="resume" type="checkbox" checked>從目前章節接續（前面章節仍須自行核對認列）</label><br>
      <label><input data-role="background" type="checkbox">允許分頁在背景時繼續等待播放</label>
      <p style="color:#fde68a">背景運作未必獲平台認列。此選項不會偽裝分頁可見、不會自動恢復平台暫停、不會模擬操作或繞過學習紀錄與閒置檢查。瀏覽器也可能限制背景播放，請自行留意平台提示。</p>
    </details>
    <details><summary>作答設定</summary>
      <p><label><input data-role="ai" type="checkbox" checked>客觀題由 AI 選答案</label><br>
      <label><input data-role="submit" type="checkbox" checked>自動繳交測驗／問卷</label></p>
      <label>引擎 <select data-role="engine"><option value="gemini">Gemini</option><option value="claude">Claude</option></select></label>
      <p><label>模型 <input data-role="model" value="gemini-2.5-flash-lite"></label></p>
      <p><label>API Key <input data-role="key" type="password" autocomplete="off"></label></p>
      <p>申請 API Key：<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Gemini 官方申請</a> · <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener noreferrer">Claude 官方申請</a> · <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">ChatGPT／OpenAI 官方申請</a></p>
      <small>開啟官方網站登入後建立金鑰，再貼到上方 API Key 欄位，並選擇相符的引擎。</small><br>
      <small>主觀問卷固定選第一項。客觀題需 API Key；Key 只留在本面板記憶體。AI 會把題目與選項傳給所選服務，可能產生費用，答案不保證正確。</small>
    </details>
    <details><summary>診斷與記錄</summary><button data-action="diagnose">顯示診斷</button>
      <button data-action="download">下載診斷</button>
      <pre data-role="log" style="white-space:pre-wrap;max-height:220px;overflow:auto"></pre></details></div>`;
  document.body.append(root);
  const $ = name => root.querySelector(`[data-role="${name}"]`);
  $('background').checked = previousBackground;
  for (const name of ['engine', 'model', 'key']) if (previousSettings[name]) $(name).value = previousSettings[name];
  const playbackDone = new Set(), completedItems = new Set();
  let verifiedItem = null, activeItemKey = null;
  const recordedVideos = new Set();
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
  const visible = el => {
    if (!el?.isConnected || root.contains(el) || !el.getClientRects().length || el.ownerDocument.defaultView.getComputedStyle(el).visibility === 'hidden') return false;
    // 同來源 iframe 的影片，也必須確認外層 iframe 可見。
    try { const frame = el.ownerDocument.defaultView.frameElement; return !frame || visible(frame); }
    catch { return false; }
  };
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
    if (location.hash.match(/^#\/learning\/[^/?]+/)?.[0] !== COURSE_HASH) throw new Error(location.hash.startsWith('#/home') ? '已返回首頁，可能是平台閒置檢查或自行離開。請自行回到課程並核對平台提示；不自動重入或偽造活動。' : '已離開原課程，停止。');
  }
  async function expand() {
    for (const header of document.querySelectorAll('mat-expansion-panel-header')) {
      // 真實 MOOCS 的 course-node 標題也是影片切換按鈕，掃描時不可點擊。
      if (header.matches('.course-node') || chapterLabel(cleanText(header.textContent))) continue;
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
      // 共用容器的 active 不能代表每個子章節都被選取。
      if (depth > 0 && [...el.querySelectorAll(explicitRowSelector)].some(other => other !== row && !row.contains(other) && !other.contains(row))) break;
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
      title = title.replace(/\s*(?:未測驗|已填寫|已提交|測驗合格|已通過|已完成觀看|觀看完成|已觀看|已完成|未完成|\d+(?:\.\d+)?\s*%)\s*$/g, '').trim();
      if (!title) return [];
      const key = url && url.href !== courseURL ? `url:${url.href}` : `title:${title}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const hints = `${text} ${[...row.querySelectorAll('[title],[aria-label]')].map(el => `${el.title || ''} ${el.getAttribute('aria-label') || ''}`).join(' ')}`;
      const type = /問卷|調查/.test(hints) ? 'survey' : /測驗|單選題|是非題|多選題/.test(hints) ? 'quiz' : /影片|影音|video|播放/i.test(hints) ? 'video' : 'auto';
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
      const badge = document.createElement('small');
      badge.style.cssText = 'color:#a5b4fc;white-space:nowrap';
      const labels = { auto: '自動辨識', video: '影片', quiz: '測驗', survey: '問卷' };
      badge.textContent = completedItems.has(item.key) ? '平台已完成' : recordedVideos.has(item.key) ? '平台顯示觀看完成' : playbackDone.has(item.key) ? '已播完／認列待確認' : labels[item.type];
      line.append(text, badge); $('queue').append(line);
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
      note(queue.length ? `找到 ${queue.length} 項；按「自動開始」，程式會點開並判斷內容，不需手選類型。` : '未找到章節。請展開右側「課程章節」，再掃描；仍失敗時按「下載診斷」。');
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
    return documents().flatMap(doc => [...doc.querySelectorAll('video')]).find(visible);
  }
  function videoSource(video) {
    const raw = video ? (video.currentSrc || video.src || video.querySelector('source[src]')?.src || '') : '';
    if (!raw) return '';
    try { return new URL(raw, video.ownerDocument.baseURI).href; } catch { return raw; }
  }
  function sourceMatchesItem(video, item) {
    const expected = item.title.match(/^EP\s*(\d+(?:[-.．]\d+)*)/i)?.[1]?.replace(/[.．]/g, '-');
    let filename;
    try { filename = decodeURIComponent(new URL(videoSource(video)).pathname.split('/').pop()); }
    catch { return null; }
    // 真實 EP2-1 檔名採「ep2_…教學模組示例2-1…」，先讀取子單元編號。
    const titleStem = item.title.replace(/^EP\s*\d+(?:[-.．]\d+)*[.．、:\s]*/i, '').replace(/[^\p{L}\p{N}]/gu, '');
    const normalizedFilename = filename.replace(/[^\p{L}\p{N}]/gu, '');
    if (titleStem.length >= 4 && normalizedFilename.includes(titleStem)) return true;
    const actual = (filename.match(/(?:示例|單元|章節)\s*(\d+(?:[-_.]\d+)+)/i)?.[1] ||
      filename.match(/(?:^|[^a-z0-9])ep\s*(\d+(?:[-_.]\d+)*)(?!\d)/i)?.[1])?.replace(/[_.]/g, '-');
    return expected && actual ? expected === actual : null;
  }
  function playable(video) {
    return !!video && !!videoSource(video) && video.readyState >= 2 && !video.error && !video.ended;
  }
  async function openItem(item) {
    ensureCourse(); stopped();
    verifiedItem = null;
    const match = roster().find(entry => itemMatches(entry, item));
    if (!match) throw new Error(`找不到章節「${item.title}」，請回課綱重新掃描。`);
    match.link.scrollIntoView({ block: 'center' });
    const oldVideo = videoElement(), oldSource = videoSource(oldVideo);
    const oldQuestion = question()?.signature, oldTask = taskSnapshot();
    const initialSelected = rowSelected(match.row);
    const sourceMatch = sourceMatchesItem(oldVideo, item);
    const sameItem = sourceMatch !== false && (activeItemKey === item.key || sourceMatch === true || (activeItemKey === null && initialSelected));
    const keepCurrentMedia = sameItem && !!oldVideo && oldVideo.readyState >= 2 && !!oldSource && !oldVideo.error;
    let loaded = false, emptySeen = false, stableSince = 0, candidate = null, candidateSource = '';
    const minimumStable = 3000;
    const onEmpty = () => { emptySeen = true; };
    const onLoaded = () => { loaded = true; };
    oldVideo?.addEventListener('emptied', onEmpty);
    oldVideo?.addEventListener('loadedmetadata', onLoaded);
    try {
      if (keepCurrentMedia) note(`沿用目前播放器，保留進度：${item.title}`);
      else match.link.click();
      const result = await waitFor(() => {
        ensureCourse();
        const current = roster().find(entry => itemMatches(entry, item));
        if (!current) return false;
        const selected = rowSelected(current.row);
        // 若清單明确選取別章，不接受任何播放器／題目變化。
        const otherSelected = roster().some(entry => entry.key !== item.key && rowSelected(entry.row));
        if (otherSelected && !selected) return false;
        const video = videoElement(), kind = contentKind(item);
        const taskMatch = taskMatchesItem(item);
        if (kind !== 'video' && taskMatch === false) { stableSince = 0; candidate = null; return false; }
        if (kind === 'video' && sourceMatchesItem(video, item) === false) { stableSince = 0; candidate = null; return false; }
        if (!kind) return false;
        const q = question()?.signature, task = taskSnapshot();
        const newTask = !!(q && q !== oldQuestion) || !!(task && task !== oldTask);
        const newMedia = !!video && (video !== oldVideo || videoSource(video) !== oldSource || (emptySeen && loaded));
        // 選取樣式單獨不足以證明播放器切換。相同 URL 重載須有載入事件。
        const verified = kind === 'video'
          ? (playable(video) || (sameItem && video?.ended && video.readyState >= 2 && videoSource(video) && !video.error)) && (sameItem || newMedia)
          : (taskMatch === true || sameItem || newTask);
        if (!verified) { stableSince = 0; candidate = null; return false; }
        const identity = kind === 'video' ? video : (q || task);
        const currentSource = videoSource(video);
        if (identity !== candidate || currentSource !== candidateSource) {
          candidate = identity; candidateSource = currentSource; stableSince = Date.now(); return false;
        }
        if (Date.now() - stableSince < minimumStable) return false;
        return { key: item.key, kind, video: kind === 'video' ? video : null, source: videoSource(video) };
      }, 30000, `無法確認「${item.title}」內容切換成功；已停止，不沿用前一章內容。請下載診斷。`);
      verifiedItem = result;
      activeItemKey = item.key;
      item.type = result.kind;
      renderQueue();
      note(`已核對切換「${item.title}」：${{ video: '影片', quiz: '測驗', survey: '問卷' }[item.type]}`);
    } finally {
      oldVideo?.removeEventListener('emptied', onEmpty);
      oldVideo?.removeEventListener('loadedmetadata', onLoaded);
    }
  }
  function taskCover() {
    return [...document.querySelectorAll('.question-set-cover')].find(visible) || null;
  }
  function taskMatchesItem(item) {
    const title = cleanText(taskCover()?.querySelector('.question-set-cover__title')?.textContent);
    if (!title) return null;
    return title === cleanText(item.title);
  }
  function taskSnapshot() {
    // 問卷封面的標題與題數是內容身分；footer 只有「開始填寫」，不足以區分問卷。
    const cover = taskCover();
    if (cover) return cleanText(cover.textContent);
    const q = question();
    if (q) return q.signature;
    const start = choose('button,a,[role="button"]', /^(開始填寫|填寫問卷|開始問卷|進入測驗|開始測驗)$/);
    if (!start) return '';
    return cleanText(start.closest('[class*="quiz"], [class*="survey"], [class*="question"], [class*="assessment"]')?.textContent || start.parentElement?.textContent).slice(0, 500);
  }
  function contentKind(item) {
    const q = question();
    if (q?.options.length) return item.type === 'survey' ? 'survey' : 'quiz';
    if (choose('button,a,[role="button"]', /^(開始填寫|填寫問卷|開始問卷)$/)) return 'survey';
    if (choose('button,a,[role="button"]', /^(進入測驗|開始測驗)$/)) return 'quiz';
    if (videoElement()) return 'video';
    return null;
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
  const videoRecorded = text => !/未完成|尚未完成|未觀看|尚未觀看/.test(text) && /已完成觀看|觀看完成|已觀看|已完成|(?:^|\s)100\s*%/.test(text);
  async function watch(item) {
    note(`觀看：${item.title}`);
    if (choose('div.question-wrap', /./)) throw new Error('此項被設為影片，但頁面顯示測驗。請下載診斷。');
    const video = verifiedItem?.key === item.key && verifiedItem.kind === 'video' ? verifiedItem.video : null;
    if (!video || video !== videoElement()) throw new Error('播放器尚未核對，停止。');
    const source = verifiedItem.source;
    if (video.playbackRate !== 1) video.playbackRate = 1;
    let naturallyEnded = video.ended, backgroundNoted = false;
    const onEnded = () => { naturallyEnded = true; };
    video.addEventListener('ended', onEnded);
    try {
      if (document.hidden && !$('background').checked) throw new Error('頁面已切到背景。請回到課程頁，或自行啟用背景等待選項後重新開始。');
      // 背景時不呼叫 play()，避免恢復平台刻意暫停的播放器。
      if (!document.hidden && !naturallyEnded) {
        try { await video.play(); } catch { note('瀏覽器未允許自動播放，請在播放器按播放；程式會等待。'); }
      }
      let lastTime = video.currentTime, lastAdvance = Date.now(), lastNote = 0;
      while (true) {
        stopped(); ensureCourse();
        if (document.hidden && !$('background').checked) throw new Error('頁面已切到背景。請回到課程頁播放，或自行啟用背景等待選項後重新開始。');
        if (document.hidden && !backgroundNoted) {
          note('分頁在背景；僅等待原播放器，背景運作未必獲平台認列。請自行留意閒置與學習紀錄提示。');
          backgroundNoted = true;
        }
        if (!document.hidden) backgroundNoted = false;
        if (!video.isConnected || videoElement() !== video || videoSource(video) !== source) throw new Error('播放器或影片來源已更換，停止以免錯認影片。');
        if (video.error) throw new Error(`播放器錯誤：${video.error.code}`);
        if (video.playbackRate !== 1 || video.seeking) throw new Error('偵測到變速或跳轉；請以正常速度完整觀看後重新開始。');
        if (naturallyEnded || video.ended) break;
        if (video.currentTime > lastTime + 0.05) { lastAdvance = Date.now(); lastTime = video.currentTime; }
        if (Date.now() - lastAdvance > 120000) throw new Error('影片超過兩分鐘沒有前進，請回分頁檢查暫停、緩衝或平台提示；不自動恢復平台暫停。');
        if (Date.now() - lastNote > 10000) {
          const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : '?';
          note(`觀看 ${item.title}：${Math.round(video.currentTime)} / ${duration} 秒${video.paused ? '（暫停中）' : ''}`);
          lastNote = Date.now();
        }
        await sleep(500);
      }
    } finally { video.removeEventListener('ended', onEnded); }
    playbackDone.add(item.key);
    note('影片已自然結束；等待平台儲存並核對課綱。');
    await sleep(4000);
    await returnToRoster();
    // 只讀取平台顯示，不提交或偽造觀看紀錄。未確認仍可切下一章，
    // 但下次開始不以本機「播放完」紀錄略過此章。
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      stopped(); ensureCourse();
      const row = roster().find(entry => itemMatches(entry, item));
      if (row && videoRecorded(row.text)) { recordedVideos.add(item.key); break; }
      await sleep(500);
    }
    if (recordedVideos.has(item.key)) note(`平台已顯示影片完成：${item.title}`);
    else note(`影片已播完：${item.title}；平台認列尚未確認。接續下一章，請自行核對學習紀錄；重新開始時仍會檢查此章。`);
    renderQueue();
  }
  function questions() {
    const wraps = [...document.querySelectorAll('div.question-wrap, [class*="survey-question"], [class*="question-item"], fieldset')]
      .filter(el => visible(el) && el.querySelector('input[type="radio"], input[type="checkbox"]'));
    return wraps.filter(el => !wraps.some(other => other !== el && el.contains(other))).map(wrap => {
      const options = [...wrap.querySelectorAll('label')].filter(el => visible(el) && el.innerText.trim() &&
        (el.querySelector('input[type="radio"], input[type="checkbox"]') || (el.htmlFor && wrap.ownerDocument.getElementById(el.htmlFor)?.matches('input[type="radio"], input[type="checkbox"]'))));
      const text = wrap.innerText.trim();
      const stem = wrap.cloneNode(true);
      stem.querySelectorAll('label,input,button,select,textarea').forEach(el => el.remove());
      const prompt = cleanText(stem.textContent) || text;
      const names = [...wrap.querySelectorAll('input')].map(input => input.name).join('|');
      return { wrap, options, text: prompt, signature: `${names}\n${prompt}\n${options.map(el => el.innerText.trim()).join('\n')}` };
    });
  }
  function question() { return questions()[0] || null; }
  function parseAnswers(raw, count, multiple) {
    let data;
    try { data = JSON.parse(raw.trim()); } catch { throw new Error(`AI 回覆不是答案陣列：${raw.slice(0, 80)}`); }
    if (!Array.isArray(data) || !data.length || (!multiple && data.length !== 1) || new Set(data).size !== data.length || data.some(n => !Number.isInteger(n) || n < 0 || n >= count)) {
      throw new Error('AI 回覆包含無效、重複或超出範圍的選項，停止作答。');
    }
    return data;
  }
  function subjective(q) {
    const rating = q.options.some(el => /非常滿意|很滿意|不滿意|非常同意|非常不同意/.test(el.innerText));
    const personal = /滿意|滿不滿意|滿意度|同意程度|推薦|學習經驗|參與經驗|是否曾|是否有過|你的經驗|您的經驗|你認為|您認為|你覺得|您覺得|你感覺|您感覺|對您.{0,12}幫助|對你.{0,12}幫助|課程.{0,12}(?:幫助|收穫|評價)|自我評估|授課.{0,12}評價|觀看.{0,12}體驗/.test(q.text);
    return rating || (personal && !/下列|何者|哪一|哪個|正確|錯誤|法規|依規定/.test(q.text));
  }
  async function ask(questionData, settings) {
    const multiple = /多選題/.test(questionData.text);
    const prompt = `請依題目與選項內容判斷答案。若詢問使用者滿意度、個人感受、實際經驗或自我評估，遵循使用者已指定的填答偏好，一律回覆 [0]。客觀知識題則判斷正確答案。僅回覆 JSON 整數陣列，索引從 0 起。${multiple ? '多選，可選多項。' : '單選或是非，只選一項。是非也必須依實際選項順序判斷。'}不能判斷客觀答案時回覆 []。\n題目：${questionData.text}\n${questionData.options.map((el, index) => `${index}: ${el.innerText.trim()}`).join('\n')}`;
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
  const inputFor = option => option.querySelector('input[type="radio"], input[type="checkbox"]') || (option.htmlFor ? option.ownerDocument.getElementById(option.htmlFor) : null);
  function taskComplete(item) {
    const row = roster().find(entry => itemMatches(entry, item));
    if (row && /已通過|已完成|已填寫|已提交/.test(row.text)) return true;
    if (item.type === 'quiz') return !!confirmedResult();
    return [...document.querySelectorAll('[role="dialog"], [class*="result"], [class*="success"], [class*="survey"], [class*="questionnaire"]')]
      .filter(visible).some(el => /感謝.{0,12}填寫|填寫完成|問卷已送出|提交成功|送出成功|已完成問卷/.test(el.innerText));
  }
  async function quiz(item, settings) {
    const answeredQuestions = new Set();
    let entered = false;
    await waitFor(() => {
      if (question()?.options.length) return true;
      const enter = choose('button,a,[role="button"]', /^(進入測驗|開始測驗|開始填寫|填寫問卷|開始問卷)$/);
      if (enter && !entered) { stopped(); enter.click(); entered = true; }
      return false;
    }, 20000, '測驗頁未出現。');
    for (let index = 0; index < 100; index++) {
      stopped(); ensureCourse();
      const q = questions().find(entry => !answeredQuestions.has(entry.signature));
      if (!q?.options.length) throw new Error('題目或選項無法辨識。');
      note(`測驗 ${item.title}：第 ${index + 1} 題`);
      const useFirst = subjective(q);
      if (!useFirst && (!settings.ai || !settings.key || !settings.model)) {
        $('ai').closest('details').open = true;
        throw new Error('這是客觀題，需要在「作答設定」輸入 API Key，再按自動開始。主觀問卷可不使用 AI。');
      }
      const answers = useFirst ? [0] : await ask(q, settings);
      if (useFirst) note('依你的主觀問卷偏好，選第一個選項。');
      stopped();
      if (!questions().some(entry => entry.wrap === q.wrap && entry.signature === q.signature)) throw new Error('等待 AI 期間題目已改變，停止以免選錯題。');
      for (const [optionIndex, option] of q.options.entries()) {
        const input = inputFor(option);
        if (!input || input.disabled) throw new Error('無法找到可操作的答案輸入欄。');
        const desired = answers.includes(optionIndex);
        if (input.type === 'checkbox' && input.checked !== desired) input.click();
        else if (input.type === 'radio' && desired && !input.checked) input.click();
      }
      await sleep(300);
      if (answers.some(i => {
        const option = q.options[i];
        const input = inputFor(option);
        return !input?.checked;
      })) throw new Error('選項沒有成功勾選，停止。');
      answeredQuestions.add(q.signature);
      if (questions().some(entry => !answeredQuestions.has(entry.signature))) continue;
      const next = [...document.querySelectorAll('button.btn-control.--right')].find(el => visible(el) && !el.disabled) || choose('button', /^(下一題|下一頁|下一|Next)$/);
      if (next) {
        const pageSignature = questions().map(entry => entry.signature).join('\n');
        stopped(); next.click();
        await waitFor(() => questions().map(entry => entry.signature).join('\n') !== pageSignature, 15000, '下一題沒有載入；不強制繳交。');
        await waitFor(() => question()?.options.length, 15000, '下一題選項尚未載入。');
        answeredQuestions.clear();
        continue;
      }
      const submit = choose('button', /^(送出|提交|繳交|繳交作答|送出問卷|提交問卷|完成填寫|Submit)$/);
      if (!submit) throw new Error('找不到下一題或繳交按鈕。');
      if (!settings.submit) throw new Error('答案已勾選，請核對後手動繳交。');
      stopped(); submit.click();
      let confirmed = false;
      await waitFor(() => {
        if (taskComplete(item)) return true;
        const dialogs = [...document.querySelectorAll('[role="dialog"], mat-dialog-container')].filter(visible);
        const dialog = dialogs.find(el => /(?:確定|確認|是否).{0,20}(?:送出|繳交|提交)|(?:送出|繳交|提交).{0,20}(?:確定|確認|是否)/.test(el.innerText));
        const button = dialog && [...dialog.querySelectorAll('button')].find(el => visible(el) && !el.disabled && /^(確定|確認|送出|繳交|提交)$/.test(el.innerText.trim()));
        if (button && !confirmed) { stopped(); button.click(); confirmed = true; }
        return false;
      }, 25000, '已送出，但未看到明確通過／問卷完成結果。請查看平台提示；不自動重測。');
      note(`平台顯示${item.type === 'survey' ? '問卷完成' : '測驗通過'}：${item.title}`);
      completedItems.add(item.key);
      await returnToRoster();
      return;
    }
    throw new Error('已到測驗題數上限。');
  }
  async function run() {
    if (running || scanning) return;
    if (!queue.length) await scan();
    if (!queue.length) return;
    const settings = { ai: $('ai').checked, submit: $('submit').checked, engine: $('engine').value, model: $('model').value.trim(), key: $('key').value.trim() };
    running = true; controller = new AbortController();
    const thisGeneration = ++generation;
    const currentVideo = videoElement();
    const resumeIndex = $('resume').checked ? queue.findIndex(item => currentVideo ? sourceMatchesItem(currentVideo, item) === true : taskMatchesItem(item) === true) : -1;
    const startIndex = Math.max(0, resumeIndex);
    renderQueue();
    try {
      ensureCourse();
      if (startIndex > 0) note(`從目前章節「${queue[startIndex].title}」接續；前面章節未因此標記完成，請自行核對平台紀錄。`);
      for (const item of queue.slice(startIndex)) {
        stopped();
        const current = roster().find(entry => itemMatches(entry, item));
        if (!current) throw new Error(`章節「${item.title}」不在目前課綱；請回課綱重新掃描。`);
        const complete = item.type === 'video' ? videoRecorded(current.text) :
          item.type === 'auto' ? videoRecorded(current.text) || /已通過|測驗合格|已填寫/.test(current.text) :
          /已通過|測驗合格|已填寫/.test(current.text);
        if (complete) { note(`平台已完成，略過：${item.title}`); continue; }
        await openItem(item);
        if (item.type === 'video') await watch(item);
        else if (item.type === 'survey' || item.type === 'quiz') await quiz(item, settings);
        else throw new Error('無法辨識此章節的內容；請下載診斷。');
      }
      note(startIndex > 0 ? '從目前章節起處理完畢；請核對前面章節及平台認證條件，這不代表已取得證書。' : '清單處理完畢。請到平台檢查認證條件；這不代表已取得證書。');
    } catch (error) { note(error.name === 'AbortError' ? '已停止；不會繼續點擊或作答。' : `停止：${error.message}`); }
    finally { if (generation === thisGeneration) { running = false; renderQueue(); } }
  }
  function diagnosticData() {
    return {
      version: '9.10', backgroundAllowed: $('background').checked, pageHidden: document.hidden,
      activeItemKey, verifiedSource: verifiedItem?.source || '',
      playbackEnded: [...playbackDone], platformRecorded: [...recordedVideos],
      media: documents().flatMap(doc => [...doc.querySelectorAll('video')]).map(video => ({ source: videoSource(video), readyState: video.readyState, ended: video.ended, paused: video.paused, currentTime: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : null })),
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
    const link = document.createElement('a'); link.href = url; link.download = 'moocs-v9.11-diagnostic.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    note('已下載診斷。分享前請檢查章節標題及按鈕文字。');
  }
  function stop() { controller?.abort(); note('已要求停止。'); }
  function close() { controller?.abort(); window.removeEventListener('resize', reposition); root.remove(); if (window.__moocs911?.root === root) delete window.__moocs911; }
  $('engine').onchange = () => { $('model').value = $('engine').value === 'gemini' ? 'gemini-2.5-flash-lite' : 'claude-haiku-4-5-20251001'; };
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const actions = { scan, run, stop, close, diagnose, download, collapse };
    if (actions[action]) Promise.resolve(actions[action]()).catch(error => note(`停止：${error.message}`));
  });
  window.__moocs911 = { root, close };
  scan().catch(error => note(`停止：${error.message}`));
})();
