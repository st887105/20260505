// 教育部特殊教育專業發展數位課程平臺｜普特合作（教師篇）
// GitHub Pages 版 v1.0.1｜在本課程學習頁點擊對應的 Chrome 書籤。
// 在面板選擇「從講義開始」或「播放／接續」。影片由平台播放器原速播放。
(() => {
  'use strict';

  const origin = 'https://specialeduelearning.moe.edu.tw';
  const course = /^#\/learning\/10000337(?:[/?]|$)/;
  const onCourse = () => location.origin === origin && course.test(location.hash);
  if (!onCourse()) {
    alert('請先在「普特合作（教師篇）」按「已報名開始學習」。');
    return;
  }

  const panelId = 'specialedu-10000337-helper';
  if (document.getElementById(panelId)) return;

  const panel = document.createElement('section');
  panel.id = panelId;
  panel.setAttribute('aria-label', '課程播放助手');
  panel.style.cssText = 'position:fixed;z-index:10000;left:16px;bottom:16px;width:min(320px,calc(100vw - 32px));box-sizing:border-box;background:#17243a;color:#fff;padding:14px;border-radius:10px;font:14px/1.5 system-ui;box-shadow:0 4px 20px #0005';
  panel.innerHTML = '<strong>普特合作（教師篇）播放助手</strong><p role="status" style="margin:8px 0">可從講義開始，或選擇要接續播放的影片。</p><button type="button" data-action="documents">從講義開始</button> <button type="button" data-action="run">播放／接續</button> <button type="button" data-action="stop" disabled>停止</button> <button type="button" data-action="close">關閉</button>';
  document.body.append(panel);

  const status = panel.querySelector('[role=status]');
  const documents = panel.querySelector('[data-action=documents]');
  const start = panel.querySelector('[data-action=run]');
  const stop = panel.querySelector('[data-action=stop]');
  let runController = null;

  const note = message => { status.textContent = message; };
  const rows = () => [...document.querySelectorAll('.child-layer[title]')];
  const selected = () => document.querySelector('.child-layer--active')?.title;
  const rowByTitle = title => rows().find(row => row.title === title);
  const visible = element => element?.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible';
  const promptVisible = () => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], mat-dialog-container')].some(visible);
  const movie = () => document.querySelector('ui-video-player.learning-video video');
  const playControl = () => document.querySelector('ui-video-player.learning-video button:has([aria-label="暫停圖示"])');
  const quizRow = () => rowByTitle('普特合作(教師篇)');
  const marked = row => !!row?.querySelector(':scope > ui-svg-icon[value="check_circle"]');

  function checkRun(signal) {
    signal.throwIfAborted();
    if (!onCourse()) throw new Error('已離開原課程。');
  }

  function delay(signal, ms = 1000) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', cancel);
        resolve();
      }, ms);
      function cancel() {
        clearTimeout(timer);
        reject(signal.reason);
      }
      signal.addEventListener('abort', cancel, { once: true });
    });
  }

  async function waitUntilVisible(signal) {
    checkRun(signal);
    while (document.hidden || promptVisible()) {
      note(document.hidden ? '回到課程分頁後繼續檢查。' : '請先查看平台提示，解除後會繼續檢查。');
      await delay(signal);
      checkRun(signal);
    }
  }

  function choose(title) {
    const row = rowByTitle(title);
    if (!row || row.getAttribute('aria-disabled') !== 'false') throw new Error(`無法開啟「${title}」。`);
    if (selected() !== title) row.click();
  }

  const pdfInfo = () => {
    const input = document.querySelector('input#pageNumber');
    return input && { page: Number(input.value), total: Number(input.max) };
  };

  async function waitForPdf(title, signal) {
    let previous = '';
    let stableSince = 0;
    for (let remaining = 25000; remaining > 0; remaining -= 200) {
      await waitUntilVisible(signal);
      if (selected() !== title) throw new Error('所選講義已變更。');
      const info = pdfInfo();
      if (info?.page >= 1 && info.total >= info.page) {
        const key = `${info.page}/${info.total}`;
        if (key !== previous) {
          previous = key;
          stableSince = Date.now();
        } else if (Date.now() - stableSince >= 1000) {
          return info;
        }
      } else {
        previous = '';
      }
      await delay(signal, 200);
    }
    throw new Error(`「${title}」的預覽尚未就緒。可切至另一份講義再回來重試。`);
  }

  async function openHandout(title, signal) {
    await waitUntilVisible(signal);
    note(`載入講義 · ${title}`);
    choose(title);
    let info = await waitForPdf(title, signal);
    if (info.page !== 1) {
      const first = document.querySelector('button#primaryFirstPage');
      if (!visible(first) || first.disabled) throw new Error(`「${title}」無法返回封面。`);
      first.click();
      info = await waitForPdf(title, signal);
    }
    if (info.page !== 1) throw new Error(`「${title}」沒有返回封面。`);

    for (let page = 1; page <= info.total; page++) {
      await waitUntilVisible(signal);
      if (selected() !== title || pdfInfo()?.page !== page) throw new Error(`「${title}」的頁碼已變更。`);
      note(`${title} 第 ${page}／${info.total} 頁`);
      await delay(signal, 1500);
      if (page === info.total) break;
      await waitUntilVisible(signal);
      const next = document.querySelector('button#primaryNext');
      if (selected() !== title || pdfInfo()?.page !== page || !visible(next) || next.disabled) {
        throw new Error(`「${title}」無法翻到下一頁。`);
      }
      next.click();
    }
  }

  async function openVideo(title, signal) {
    await waitUntilVisible(signal);
    const previousSource = movie()?.getAttribute('src');
    const switching = selected() !== title;
    choose(title);

    for (let remaining = 20000; remaining > 0; remaining -= 300) {
      await waitUntilVisible(signal);
      const video = movie();
      const source = video?.getAttribute('src');
      if (selected() === title && source && (!switching || source !== previousSource) &&
          Number.isFinite(video.duration) && video.readyState >= 2) return video;
      await delay(signal, 300);
    }
    throw new Error(`「${title}」的播放器尚未就緒。`);
  }

  async function watch(title, video, signal) {
    const source = video.getAttribute('src');
    if (video.playbackRate !== 1 || video.seeking) throw new Error('請將播放器恢復為 1 倍速並停止跳轉。');
    let userPaused = false;
    let attempts = 0;
    let lastAttempt = -Infinity;
    let lastPosition = video.currentTime;

    function trackPlayerInput(event) {
      if (!event.isTrusted || !event.target.closest('ui-video-player.learning-video')) return;
      const control = event.target.closest('button, video, .tv-player__play-button--big');
      if (control && control !== playControl() && !control.matches('video, .tv-player__play-button--big')) return;
      if (event.type === 'keydown' && ![' ', 'Enter', 'k', 'K'].includes(event.key)) return;
      if (event.type === 'click' && !control) return;
      userPaused = movie()?.paused === false;
      if (userPaused) note('已手動暫停。按播放器的播放鍵後會接續。');
    }

    const listeners = { capture: true, signal };
    document.addEventListener('click', trackPlayerInput, listeners);
    document.addEventListener('keydown', trackPlayerInput, listeners);
    try {
      while (true) {
        await waitUntilVisible(signal);
        if (selected() !== title) throw new Error('所選章節已變更，請從目前章節接續。');
        video = movie();
        const currentSource = video?.getAttribute('src');
        if (!currentSource) {
          note(`${title}，等待原播放器重新載入。`);
          await delay(signal);
          continue;
        }
        if (currentSource !== source) throw new Error('影片來源已變更，請從目前章節接續。');
        if (video.error) throw new Error(`「${title}」的播放器發生錯誤。`);
        if (video.playbackRate !== 1 || video.seeking) throw new Error('偵測到變速或跳轉，已停止換章。');
        if (video.ended) return;

        if (!video.paused && video.currentTime > lastPosition + 0.2) {
          attempts = 0;
          userPaused = false;
        }
        lastPosition = video.currentTime;
        const time = `${Math.floor(lastPosition / 60)}:${String(Math.floor(lastPosition % 60)).padStart(2, '0')}`;
        let message = `${title} ${time}`;
        if (video.paused) {
          message += '，已暫停。可按播放器的播放鍵接續。';
          const control = playControl();
          if (!userPaused && attempts < 3 && Date.now() - lastAttempt >= 5000 && video.readyState >= 2 && visible(control) && !control.disabled) {
            lastAttempt = Date.now();
            attempts++;
            control.click();
            message = `${title} ${time}，已提出續播請求（${attempts}/3）。`;
          }
        }
        note(message);
        await delay(signal);
      }
    } finally {
      document.removeEventListener('click', trackPlayerInput, true);
      document.removeEventListener('keydown', trackPlayerInput, true);
    }
  }

  async function run(signal, fromDocuments = false) {
    const titles = rows().map(row => row.title);
    const videos = titles.filter(title => /^【影片[1-9]】/.test(title));
    if (videos.length !== 9 || !quizRow()) throw new Error('請清除章節篩選，確認課綱顯示 9 部影片及測驗。');
    if (fromDocuments) {
      const handouts = titles.filter(title => /^【講義[1-3]】/.test(title));
      if (handouts.length !== 3) throw new Error('請清除章節篩選，確認課綱顯示 3 份講義。');
      for (const title of handouts) await openHandout(title, signal);
    }

    const first = videos.indexOf(selected());
    for (const title of videos.slice(Math.max(0, first))) {
      const video = await openVideo(title, signal);
      await watch(title, video, signal);
      await delay(signal, 3000);
      await waitUntilVisible(signal);
      if (selected() !== title) throw new Error('所選章節已變更，請從目前章節接續。');
    }

    const refresh = document.querySelector('button[aria-label="重整"]');
    if (visible(refresh) && !refresh.disabled) refresh.click();
    await delay(signal, 2000);
    await waitUntilVisible(signal);
    const quiz = quizRow();
    if (marked(quiz)) {
      note('平台已標記測驗完成。請確認課程通過狀態。');
      return;
    }
    if (quiz?.getAttribute('aria-disabled') === 'false') {
      quiz.click();
      note('已開啟測驗入口。請依畫面進行測驗，並確認課程通過狀態。');
    } else {
      note('播放流程已結束，測驗仍鎖定。請在平台確認講義節點和觀看時數。');
    }
  }

  async function startRun(fromDocuments) {
    if (runController) return;
    const controller = new AbortController();
    runController = controller;
    documents.disabled = true;
    start.disabled = true;
    stop.disabled = false;
    try {
      await run(controller.signal, fromDocuments);
    } catch (error) {
      note(controller.signal.aborted ? '已停止自動操作。' : error.message);
    } finally {
      runController = null;
      documents.disabled = false;
      start.disabled = false;
      stop.disabled = true;
    }
  }
  start.addEventListener('click', () => startRun(false));
  documents.addEventListener('click', () => startRun(true));
  stop.addEventListener('click', () => runController?.abort());
  const close = () => {
    runController?.abort();
    panel.remove();
    window.removeEventListener('hashchange', onNavigate);
  };
  const onNavigate = () => { if (!onCourse()) close(); };
  panel.querySelector('[data-action=close]').addEventListener('click', close);
  window.addEventListener('hashchange', onNavigate);
})();
