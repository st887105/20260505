// 研習救星｜供既有 Chrome 書籤載入的選擇介面。
// 兩個課程助手各自維護於 moocs.js 和 specialedu.js。
((startSpecialEdu) => {
  'use strict';

  const panelId = 'training-rescuer-launcher';
  const existing = document.getElementById(panelId);
  if (existing) {
    existing.querySelector('button')?.focus();
    return;
  }

  const pages = 'https://st887105.github.io/20260505/';
  const modules = [
    {
      name: '教育部磨課師',
      file: 'moocs.js',
      origin: 'https://moocs.moe.edu.tw',
      course: /^#\/learning\/[^/?#]+/,
      entry: 'https://moocs.moe.edu.tw/',
      instruction: '請先在教育部磨課師進入要學習的課程。',
    },
    {
      name: '特殊教育專業發展',
      file: 'specialedu.js',
      origin: 'https://specialeduelearning.moe.edu.tw',
      course: /^#\/learning\/10000337(?:[/?]|$)/,
      entry: 'https://specialeduelearning.moe.edu.tw/web/#/courses/10000337',
      instruction: '請先在「普特合作（教師篇）」按「已報名開始學習」。',
    },
  ];

  const dialog = document.createElement('dialog');
  dialog.id = panelId;
  dialog.setAttribute('aria-labelledby', `${panelId}-title`);
  dialog.style.cssText = 'margin:auto;width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 32px);box-sizing:border-box;padding:20px;color:#16243d;background:#fff;border:1px solid #c7d3e3;border-radius:16px;box-shadow:0 18px 60px #10223e55;font:15px/1.45 system-ui;';
  dialog.innerHTML = `<h2 id="${panelId}-title" style="margin:0 0 14px;color:#16243d;font:700 22px/1.3 system-ui">研習救星</h2>
    <div data-choices style="display:grid;gap:8px"></div>
    <p role="status" style="margin:12px 0;min-height:1.45em;color:#3d506c"></p>
    <button type="button" data-close style="padding:5px 12px;border:1px solid #c7d3e3;border-radius:8px;color:#243650;background:#fff;font:inherit;cursor:pointer">關閉</button>`;
  const choices = dialog.querySelector('[data-choices]');
  const status = dialog.querySelector('[role=status]');
  const lifecycle = new AbortController();
  let loading = false;

  const matchesCourse = module => location.origin === module.origin && module.course.test(location.hash);

  function showLink(message, href, label) {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = label;
    status.replaceChildren(`${message} `, link);
  }

  async function launch(module) {
    if (loading) return;
    if (!matchesCourse(module)) {
      showLink(module.instruction, module.entry, '開啟平台');
      return;
    }
    const useSpecialEdu = module.file === 'specialedu.js';
    if (useSpecialEdu && !startSpecialEdu) {
      showLink('特教平台限制課程頁的外部連線，請改用新版書籤。', pages, '取得新版書籤');
      return;
    }

    loading = true;
    for (const button of choices.children) button.disabled = true;
    status.textContent = `正在載入${module.name}助手…`;
    try {
      if (useSpecialEdu) {
        startSpecialEdu();
      } else {
        const url = new URL(module.file, pages);
        url.searchParams.set('v', String(Date.now()));
        const response = await fetch(url.href, { cache: 'no-store', signal: lifecycle.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const script = await response.text();
        if (lifecycle.signal.aborted) return;
        if (!matchesCourse(module)) throw new Error('已離開課程學習頁');
        (0, eval)(script);
      }
      dialog.close();
    } catch (error) {
      if (!lifecycle.signal.aborted) status.textContent = `無法載入${module.name}助手（${error.message}）`;
    } finally {
      loading = false;
      for (const button of choices.children) button.disabled = false;
    }
  }

  for (const module of modules) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = module.name;
    button.style.cssText = 'width:100%;border:1px solid #c7d3e3;border-radius:10px;padding:11px 13px;text-align:left;color:#203b61;background:#eef4fc;font:600 15px/1.4 system-ui;cursor:pointer;';
    if (matchesCourse(module)) button.autofocus = true;
    button.addEventListener('click', () => launch(module));
    choices.append(button);
  }

  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    lifecycle.abort();
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
})(/* bookmarklet-specialedu */ null);
