// MOOCS 一鍵完課 v5.3 - 修正閱讀超時 + 測驗偵測
(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let KEY = localStorage.getItem('moocs_claude_key');
    if (!KEY) {
        KEY = prompt('請輸入 Claude API Key：');
        if (!KEY) return;
        localStorage.setItem('moocs_claude_key', KEY);
    }

    // ── 面板 ─────────────────────────────────────
    document.getElementById('moocs-v53')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v53';
    panel.style.cssText = [
        'position:fixed','bottom:20px','right:20px','width:320px',
        'z-index:999999','background:#13151f','color:#e2e8f0',
        'border-radius:14px','font-family:monospace','font-size:12px',
        'box-shadow:0 8px 32px rgba(0,0,0,.7)','border:1px solid #2a2d3e',
        'overflow:hidden'
    ].join(';');
    panel.innerHTML = `
        <div id="mv53-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);
            padding:12px 16px;display:flex;align-items:center;
            justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;font-size:13px;color:#4f8ef7">🎓 MOOCS v5.3</span>
            <span id="mv53-close" style="cursor:pointer;opacity:.5;font-size:15px">✕</span>
        </div>
        <div id="mv53-status" style="padding:7px 16px;font-size:11px;
            color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">準備中...</div>
        <div id="mv53-progress" style="padding:4px 16px;font-size:10px;
            color:#22c55e;background:#0a0f0a;border-bottom:1px solid #1a1d27">⏳ 初始化...</div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv53-log" style="max-height:220px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:8px">
            <button id="mv53-stop" style="flex:1;padding:8px;background:#3d1a1a;
                color:#ef4444;border:none;border-radius:7px;cursor:pointer;font-size:12px">⏹ 停止</button>
            <button id="mv53-quiz-only" style="flex:1;padding:8px;background:#1a3a1a;
                color:#22c55e;border:none;border-radius:7px;cursor:pointer;font-size:12px">📝 只跑測驗</button>
            <button id="mv53-key" style="padding:8px 10px;background:#1a2a3d;
                color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">🔑 Key</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false;
    let quizOnly = false;
    document.getElementById('mv53-close').onclick = () => { stopped = true; panel.remove(); };
    document.getElementById('mv53-stop').onclick = () => { stopped = true; log('⏹ 停止中...', '#f59e0b'); };
    document.getElementById('mv53-quiz-only').onclick = () => {
        quizOnly = true;
        log('📝 切換為只跑測驗模式', '#22c55e');
    };
    document.getElementById('mv53-key').onclick = () => {
        localStorage.removeItem('moocs_claude_key');
        log('🔑 Key 已清除', '#f59e0b');
    };

    // 拖曳
    let drag = false, ox, oy;
    document.getElementById('mv53-hdr').onmousedown = e => {
        drag = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
    };
    document.onmousemove = e => {
        if (!drag) return;
        panel.style.left = (e.clientX - ox) + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
        panel.style.top = (e.clientY - oy) + 'px';
    };
    document.onmouseup = () => drag = false;

    function log(msg, color = '#94a3b8') {
        const el = document.getElementById('mv53-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8">
            <span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    function setStatus(msg, color = '#64748b') {
        const el = document.getElementById('mv53-status');
        if (el) { el.textContent = msg; el.style.color = color; }
    }
    function setProgress(msg, color = '#22c55e') {
        const el = document.getElementById('mv53-progress');
        if (el) { el.textContent = msg; el.style.color = color; }
    }

    // ── 讀取目前進度 ─────────────────────────────
    function getCurrentProgress() {
        try {
            // 嘗試從頁面讀取閱讀時數%和測驗成績%
            const bars = document.querySelectorAll('.progress-bar,[class*="progress"]');
            let readPct = 0, quizPct = 0;
            // 也試試直接找文字
            const allText = document.body.innerText;
            const readMatch = allText.match(/閱讀時數[^\d]*(\d+)[^\d]*\((\d+)%\)/);
            const quizMatch = allText.match(/測驗成績[^\d]*[\d.]+[^\d]*\((\d+)%\)/);
            if (readMatch) readPct = parseInt(readMatch[2]);
            if (quizMatch) quizPct = parseInt(quizMatch[1]);
            return { readPct, quizPct };
        } catch(e) { return { readPct: 0, quizPct: 0 }; }
    }

    // ── 防閒置 ───────────────────────────────────
    let lastActive = Date.now();
    const aliveTimer = setInterval(() => {
        if (stopped) { clearInterval(aliveTimer); return; }
        const idle = Math.round((Date.now() - lastActive) / 60000);
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true,
            clientX: Math.random() * window.innerWidth,
            clientY: Math.random() * window.innerHeight }));
        const prog = getCurrentProgress();
        setProgress(`🟢 閒置${idle}分 | 閱讀${prog.readPct}% | 測驗${prog.quizPct}%`, '#22c55e');
    }, 2 * 60 * 1000);

    // ── 等待平台記錄（改良版：有上限不卡死）────
    // 改為：點擊後監聽API，但最多等 READ_WAIT_MAX 秒，不會卡死
    const READ_WAIT_MAX = 45; // 秒，超過就跳過

    function waitForRecord() {
        return new Promise(resolve => {
            let done = false;
            const orig = window.fetch;

            const timer = setTimeout(() => {
                if (!done) {
                    done = true;
                    window.fetch = orig;
                    log('  ⚠️ 記錄等待逾時（45秒），繼續下一項', '#f59e0b');
                    resolve('timeout');
                }
            }, READ_WAIT_MAX * 1000);

            window.fetch = function (...args) {
                const url = args[0]?.toString() || '';
                if ((url.includes('add-course-reading-record') ||
                     url.includes('reading-record') ||
                     url.includes('course-record')) && !done) {
                    done = true;
                    clearTimeout(timer);
                    window.fetch = orig;
                    log('  ✅ 平台記錄完成', '#22c55e');
                    setTimeout(resolve, 800, 'ok');
                }
                return orig.apply(this, args);
            };
        });
    }

    // ── 判斷子單元是否已完成 ─────────────────────
    function isItemCompleted(linkEl) {
        // 找父層，看有無完成圖示
        const parent = linkEl.closest('li,.syllabus__item') || linkEl.parentElement;
        if (!parent) return false;
        const text = parent.innerHTML;
        // 常見完成標誌
        return /✓|✔|完成|mat-icon.*check|done|completed/i.test(text) ||
               parent.querySelector('[class*="done"],[class*="complete"],[class*="check"]') !== null;
    }

    // ── Claude API ───────────────────────────────
    async function askClaude(q, opts_text, type, retry = 0) {
        await sleep(1500);
        const isYesNo = type && type.includes('是非');
        const prompt = isYesNo
            ? `台灣教育訓練是非題，只回答0（正確）或1（錯誤），不要解釋：\n${q}`
            : `台灣教育訓練單選題，選最正確答案，只回答數字（從0開始），不要解釋：\n題目：${q}\n選項：\n${opts_text}`;
        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': KEY,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            if (res.status === 429) {
                const w = [20, 40, 80][retry] || 80;
                log(`  ⏳ 429限流，等${w}秒...`, '#f59e0b');
                await sleep(w * 1000);
                return askClaude(q, opts_text, type, retry + 1);
            }
            const data = await res.json();
            if (!res.ok) { log(`  ❌ API ${res.status}: ${JSON.stringify(data)}`, '#ef4444'); return '0'; }
            return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0] || '0';
        } catch (e) { log('  ❌ ' + e.message, '#ef4444'); return '0'; }
    }

    // ── 找右側翻頁箭頭 ───────────────────────────
    function findRightArrow() {
        return [...document.querySelectorAll('button,[role="button"]')]
            .find(el => {
                const r = el.getBoundingClientRect();
                return r.right >= window.innerWidth - 300
                    && r.right <= window.innerWidth - 50
                    && r.top > 200
                    && r.top < window.innerHeight - 100
                    && r.width > 0 && r.width < 100;
            });
    }

    // ── 跑測驗（含無限重試）─────────────────────
    async function doQuiz(name, attempt = 1) {
        if (stopped) return false;
        if (attempt > 10) { log('  ⚠️ 超過最大重試次數', '#ef4444'); return false; }

        log(`  📝 測驗（第${attempt}次）：${name}`, '#a78bfa');
        await sleep(2000);

        // 找「進入測驗」或「開始測驗」按鈕（測驗說明頁）
        let enterBtn = null;
        for (let t = 0; t < 15; t++) {
            enterBtn = [...document.querySelectorAll('button,a')]
                .find(b => /進入測驗|開始測驗/.test(b.textContent?.trim()));
            if (enterBtn) break;
            await sleep(600);
        }

        if (!enterBtn) {
            log(`  ℹ️ 找不到進入測驗按鈕`, '#64748b');
            return false;
        }

        enterBtn.click();
        await sleep(3000);

        // 答題迴圈
        let answered = 0;
        for (let i = 0; i < 50; i++) {
            if (stopped) return false;

            const qEl = document.querySelector(
                '.question__title,.question-title,[class*="question__title"]'
            );
            if (!qEl) {
                log(`  ✅ 題目結束（共答${answered}題）`, '#22c55e');
                break;
            }

            const q = qEl.innerText.trim();
            const typeEl = document.querySelector(
                '.quesiton__type-and-index,.question__type-and-index,[class*="type-and-index"]'
            );
            const type = typeEl?.innerText || '';
            const opts = document.querySelectorAll(
                '.question-wrap label,moocs-question label,[class*="question"] label'
            );

            if (opts.length === 0) {
                log(`  ⚠️ Q${i+1} 找不到選項，跳過`, '#f59e0b');
                await sleep(1000);
                const next = [...document.querySelectorAll('button')]
                    .find(b => /下一|next/i.test(b.textContent));
                if (next) { next.click(); await sleep(2000); }
                continue;
            }

            const opts_text = [...opts].map((o, i) => `${i}: ${o.innerText.trim()}`).join('\n');
            log(`  Q${i+1}[${type.includes('是非') ? '是非' : '單選'}]: ${q.substring(0, 30)}`, '#a78bfa');

            const ans = await askClaude(q, opts_text, type);
            const idx = Math.min(parseInt(ans) || 0, opts.length - 1);
            opts[idx]?.click();
            log(`  → 選第${idx}項`, '#22c55e');
            answered++;
            await sleep(1200);

            // 找送出按鈕
            const sub = [...document.querySelectorAll('button')]
                .find(b => /送出|提交|繳交/i.test(b.textContent) &&
                           !/取消|關閉/.test(b.textContent));
            if (sub) {
                await sleep(600);
                sub.click();
                log('  📤 送出！', '#22c55e');
                await sleep(4000);
                break;
            }

            // 找下一題
            const next = [...document.querySelectorAll('button')]
                .find(b => /下一題|下一|next/i.test(b.textContent));
            if (next) { next.click(); await sleep(2000); continue; }

            const arrow = findRightArrow();
            if (arrow) { arrow.click(); await sleep(2000); continue; }

            log('  ⚠️ 找不到下一題/送出按鈕', '#f59e0b');
            break;
        }

        // 點「完成測驗」
        await sleep(1500);
        const doneBtn = [...document.querySelectorAll('button,a')]
            .find(b => /完成測驗/.test(b.textContent));
        if (doneBtn) { doneBtn.click(); await sleep(3000); }

        // 檢查是否通過
        await sleep(1500);
        const retestBtn = [...document.querySelectorAll('button,a')]
            .find(b => /重新測驗/.test(b.textContent));
        if (retestBtn) {
            log(`  ⚠️ 未達標，準備第${attempt+1}次重測...`, '#f59e0b');
            retestBtn.click();
            await sleep(2000);
            return doQuiz(name, attempt + 1);
        } else {
            log(`  🎉 測驗通過！`, '#22c55e');
            return true;
        }
    }

    // ── 掃描並觸發所有未通過的測驗 ──────────────
    async function runAllPendingQuizzes() {
        log('\n🔍 掃描所有未測驗項目...', '#60a5fa');

        // 展開所有群組
        const allHeaders = [...document.querySelectorAll('mat-expansion-panel-header')];
        for (const h of allHeaders) {
            const panel2 = h.closest('mat-expansion-panel');
            if (!panel2?.classList.contains('mat-expanded')) {
                h.click(); await sleep(800);
            }
        }
        await sleep(1500);

        // 找所有「未測驗」按鈕
        let quizBtns = [...document.querySelectorAll('button')]
            .filter(b => /未測驗/.test(b.textContent?.trim()));

        log(`  找到 ${quizBtns.length} 個未測驗按鈕`, '#60a5fa');

        if (quizBtns.length === 0) {
            log('  ✅ 無未完成測驗', '#22c55e');
            return;
        }

        // 逐一點擊未測驗
        for (let i = 0; i < quizBtns.length; i++) {
            if (stopped) break;
            // 每次重新抓，因為DOM可能更新
            const freshBtns = [...document.querySelectorAll('button')]
                .filter(b => /未測驗/.test(b.textContent?.trim()));
            if (freshBtns.length === 0) break;

            const btn = freshBtns[0]; // 每次都點第一個
            const groupName = btn.closest('mat-expansion-panel')
                ?.querySelector('mat-expansion-panel-header')
                ?.innerText?.trim()?.substring(0, 25) || `測驗${i+1}`;

            log(`\n🎯 [${i+1}/${quizBtns.length}] 前往測驗：${groupName}`, '#60a5fa');
            setStatus(`測驗 ${i+1}/${quizBtns.length}：${groupName}`, '#a78bfa');

            btn.click();
            await sleep(2500);
            await doQuiz(groupName);
            await sleep(2000);

            // 回到課程簡介tab（確保側邊欄還在）
            const courseTab = [...document.querySelectorAll('[role="tab"],.mat-tab-label')]
                .find(el => /課程簡介/.test(el.textContent));
            if (courseTab) { courseTab.click(); await sleep(1500); }
        }
    }

    // ── 處理群組（子單元閱讀）───────────────────
    async function processGroup(groupHeader, gIdx, total) {
        if (stopped) return;

        const groupTitle = groupHeader.innerText?.trim()?.substring(0, 25) || `群組${gIdx+1}`;
        log(`\n📂 [${gIdx+1}/${total}] ${groupTitle}`, '#60a5fa');
        setStatus(`閱讀 ${gIdx+1}/${total}：${groupTitle}`, '#4f8ef7');
        lastActive = Date.now();

        const panel2 = groupHeader.closest('mat-expansion-panel');
        if (!panel2?.classList.contains('mat-expanded')) {
            groupHeader.click(); await sleep(1500);
        }

        const links = [...(panel2?.querySelectorAll('a.syllabus__item-content') || [])];
        log(`  找到 ${links.length} 個子單元`);

        for (let s = 0; s < links.length; s++) {
            if (stopped) return;

            // 重新抓連結（DOM可能因展開而更新）
            const freshLinks = [...(panel2?.querySelectorAll('a.syllabus__item-content') || [])];
            const link = freshLinks[s];
            if (!link) continue;

            const title = link.innerText?.trim()?.substring(0, 25) || `子單元${s+1}`;

            // 判斷是否已完成
            if (isItemCompleted(link)) {
                log(`  ✓ [${s+1}/${links.length}] ${title}（已完成，跳過）`, '#475569');
                continue;
            }

            log(`\n  📌 [${s+1}/${links.length}] ${title}`, '#60a5fa');
            setStatus(`${groupTitle} → ${title}`, '#4f8ef7');
            lastActive = Date.now();

            const recordDone = waitForRecord();
            link.click();
            await sleep(1500);

            const result = await recordDone;
            if (result === 'timeout') {
                // 逾時仍繼續，不卡住
                await sleep(500);
            } else {
                await sleep(800);
            }
        }
    }

    // ── 發表討論 ─────────────────────────────────
    async function postDiscussion() {
        log('\n💬 前往討論區...', '#60a5fa');
        setStatus('發表討論中...', '#60a5fa');

        const discussTab = [...document.querySelectorAll('[role="tab"],.mat-tab-label,a')]
            .find(el => /討論/.test(el.textContent));
        if (!discussTab) { log('  ⚠️ 找不到討論區tab', '#f59e0b'); return; }
        discussTab.click();
        await sleep(2000);

        const myPost = document.querySelector('[class*="my-post"],[class*="mine"],[class*="owner"]');
        if (myPost) { log('  ℹ️ 已有發文，跳過', '#64748b'); return; }

        const postBtn = [...document.querySelectorAll('button,a')]
            .find(b => /發表主題|新增討論|發文/.test(b.textContent));
        if (!postBtn) { log('  ⚠️ 找不到發表按鈕', '#f59e0b'); return; }
        postBtn.click();
        await sleep(2000);

        const titleInput = document.querySelector('input[placeholder*="標題"],input[name*="title"],input[type="text"]');
        if (titleInput) {
            titleInput.focus();
            titleInput.value = '課程心得分享';
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(500);
        }

        const contentEl = document.querySelector('textarea,[contenteditable="true"],.ql-editor');
        if (contentEl) {
            contentEl.focus();
            const text = '這門課程內容豐富完整，涵蓋重要知識，對工作很有幫助，推薦給大家。';
            if (contentEl.tagName === 'TEXTAREA') {
                contentEl.value = text;
                contentEl.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                contentEl.innerText = text;
                contentEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
            await sleep(500);
        }

        const submitBtn = [...document.querySelectorAll('button')]
            .find(b => /送出|發表|提交|確認/.test(b.textContent) &&
                       !/取消|關閉/.test(b.textContent));
        if (submitBtn) {
            submitBtn.click();
            log('  ✅ 討論已發表！', '#22c55e');
            await sleep(2000);
        } else {
            log('  ⚠️ 找不到送出按鈕，請手動發表', '#f59e0b');
        }
    }

    // ── 主流程 ───────────────────────────────────
    log('▶ 開始執行 v5.3', '#4f8ef7');

    const prog = getCurrentProgress();
    log(`📊 目前進度：閱讀${prog.readPct}% | 測驗${prog.quizPct}%`, '#60a5fa');

    if (quizOnly || prog.readPct >= 100) {
        // 閱讀已完成，直接跑測驗
        log('📚 閱讀已完成，直接處理測驗', '#22c55e');
    } else {
        // 需要跑閱讀
        const groups = [...document.querySelectorAll('mat-expansion-panel-header')];
        if (!groups.length) {
            log('❌ 找不到群組，請確認已進入課程頁面', '#ef4444');
            setStatus('❌ 找不到群組', '#ef4444');
            clearInterval(aliveTimer);
            return;
        }
        log(`📚 找到 ${groups.length} 個群組，開始閱讀...`);

        for (let g = 0; g < groups.length; g++) {
            if (stopped) break;
            await processGroup(groups[g], g, groups.length);
        }
    }

    if (!stopped) {
        // 統一在閱讀完成後跑所有測驗
        await runAllPendingQuizzes();
    }

    if (!stopped) {
        await postDiscussion();
        await sleep(1500);

        clearInterval(aliveTimer);
        const finalProg = getCurrentProgress();
        setStatus(`🎉 完成！閱讀${finalProg.readPct}% 測驗${finalProg.quizPct}%`, '#22c55e');
        log('\n🎉 全部完成！', '#22c55e');
        log('📋 請至「我修的課」確認是否通過', '#60a5fa');
    } else {
        clearInterval(aliveTimer);
        setStatus('已停止', '#ef4444');
    }
})();
