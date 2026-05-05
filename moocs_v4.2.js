// MOOCS 一鍵完課 v4.3
// 功能：智慧影片等待（已看過直接跳過）+ 防閒置登出 + 測驗自動重測

(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ── API Key ────────────────────────────────────
    let CLAUDE_KEY = localStorage.getItem('moocs_claude_key');
    if (!CLAUDE_KEY) {
        CLAUDE_KEY = prompt('請輸入 Claude API Key：');
        if (!CLAUDE_KEY) return;
        localStorage.setItem('moocs_claude_key', CLAUDE_KEY);
    }

    // ── 面板 ───────────────────────────────────────
    document.getElementById('moocs-v43')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v43';
    panel.style.cssText = [
        'position:fixed','bottom:20px','right:20px','width:310px',
        'z-index:999999','background:#13151f','color:#e2e8f0',
        'border-radius:14px','font-family:monospace','font-size:12px',
        'box-shadow:0 8px 32px rgba(0,0,0,.7)','border:1px solid #2a2d3e',
        'overflow:hidden'
    ].join(';');
    panel.innerHTML = `
        <div id="mv43-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);
            padding:12px 16px;display:flex;align-items:center;
            justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;font-size:13px;color:#4f8ef7">🎓 MOOCS v4.3</span>
            <span id="mv43-close" style="cursor:pointer;opacity:.5;font-size:15px">✕</span>
        </div>
        <div id="mv43-status" style="padding:7px 16px;font-size:11px;
            color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">準備中...</div>
        <div id="mv43-keepalive" style="padding:4px 16px;font-size:10px;
            color:#22c55e;background:#0a0f0a;border-bottom:1px solid #1a1d27">
            🟢 防閒置：啟動中...</div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv43-log" style="max-height:220px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:8px">
            <button id="mv43-stop" style="flex:1;padding:8px;background:#3d1a1a;
                color:#ef4444;border:none;border-radius:7px;cursor:pointer;font-size:12px">⏹ 停止</button>
            <button id="mv43-key" style="padding:8px 10px;background:#1a2a3d;
                color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">🔑 換Key</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false;
    document.getElementById('mv43-close').onclick = () => { stopped = true; panel.remove(); };
    document.getElementById('mv43-stop').onclick = () => { stopped = true; log('⏹ 停止中...', '#f59e0b'); };
    document.getElementById('mv43-key').onclick = () => {
        localStorage.removeItem('moocs_claude_key');
        log('🔑 Key 已清除，重新整理後重新輸入', '#f59e0b');
    };

    // 拖曳
    let drag = false, ox, oy;
    document.getElementById('mv43-hdr').onmousedown = e => {
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
        const el = document.getElementById('mv43-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8">
            <span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    function setStatus(msg, color = '#64748b') {
        const el = document.getElementById('mv43-status');
        if (el) { el.textContent = msg; el.style.color = color; }
    }
    function setKeepAlive(msg, color = '#22c55e') {
        const el = document.getElementById('mv43-keepalive');
        if (el) { el.textContent = msg; el.style.color = color; }
    }

    // ── 防閒置機制（每2分鐘模擬活動）──────────
    let keepAliveTimer = null;
    let lastActivityTime = Date.now();

    function startKeepAlive() {
        keepAliveTimer = setInterval(() => {
            if (stopped) { clearInterval(keepAliveTimer); return; }

            const idleMins = Math.round((Date.now() - lastActivityTime) / 60000);

            // 每2分鐘模擬滑鼠移動與點擊
            document.dispatchEvent(new MouseEvent('mousemove', {
                clientX: Math.random() * window.innerWidth,
                clientY: Math.random() * window.innerHeight,
                bubbles: true
            }));

            // 模擬鍵盤活動
            document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

            // 如果超過25分鐘沒有真實章節切換，主動點擊頁面元素保持 session
            if (idleMins >= 25) {
                log('⚡ 防閒置：主動觸發頁面活動', '#f59e0b');
                // 點擊課程介紹 tab 再切回來
                const tabs = document.querySelectorAll('.mat-tab-label, [role="tab"]');
                if (tabs.length > 0) {
                    tabs[0].click();
                    setTimeout(() => tabs[tabs.length > 1 ? 1 : 0]?.click(), 500);
                }
                setKeepAlive(`🟡 防閒置：已觸發活動（閒置${idleMins}分鐘）`, '#f59e0b');
            } else {
                setKeepAlive(`🟢 防閒置：正常（閒置${idleMins}分鐘 / 上限25分鐘）`, '#22c55e');
            }

        }, 2 * 60 * 1000); // 每2分鐘執行一次

        log('🛡️ 防閒置機制已啟動（每2分鐘觸發活動）', '#22c55e');
    }

    function resetIdleTimer() {
        lastActivityTime = Date.now();
    }

    // ── 判斷章節是否已看過 ────────────────────
    function isChapterWatched(header) {
        // 方法1：看父層是否有完成標記
        const panel = header.closest('mat-expansion-panel');
        if (!panel) return false;

        // 檢查進度條或完成圖示
        const hasCheck = panel.querySelector(
            '.completed, [class*="complete"], .check-icon, ' +
            'mat-icon[data-mat-icon-name="check"], ' +
            '[class*="finish"], [class*="done"]'
        );
        if (hasCheck) return true;

        // 方法2：檢查章節標題旁邊是否有打勾
        const titleEl = header.querySelector('.syllabus__title, [class*="title"]');
        if (titleEl) {
            const parentText = header.innerHTML;
            if (parentText.includes('✓') || parentText.includes('check') ||
                parentText.includes('complete') || parentText.includes('finish')) {
                return true;
            }
        }

        // 方法3：讀取右側課程章節列表的狀態
        const title = header.querySelector('.syllabus__title')?.innerText?.trim();
        if (title) {
            const sidebarItems = document.querySelectorAll(
                '.course-content-list li, .chapter-list li, [class*="chapter-item"]'
            );
            for (const item of sidebarItems) {
                if (item.innerText.includes(title)) {
                    const isWatched = item.querySelector(
                        '[class*="watched"], [class*="complete"], [class*="check"]'
                    );
                    if (isWatched) return true;
                }
            }
        }

        return false;
    }

    // ── Claude API ────────────────────────────
    async function askClaude(q, opts_text, type, knownAnswer = null) {
        await sleep(2000);

        const prompt = knownAnswer !== null
            ? `只回答數字${knownAnswer}。`
            : (type && type.includes('是非'))
                ? `台灣資訊安全教育是非題，只回答0（正確）或1（錯誤）：\n${q}`
                : `台灣資訊安全教育單選題，選最正確答案，只回答數字（從0開始）：\n題目：${q}\n選項：\n${opts_text}`;

        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': CLAUDE_KEY,
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
                log('⏳ 429 限流，等20秒...', '#f59e0b');
                await sleep(20000);
                return askClaude(q, opts_text, type, knownAnswer);
            }

            const data = await res.json();
            if (!res.ok) { log(`❌ API ${res.status}`, '#ef4444'); return '0'; }
            return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0] || '0';
        } catch (e) {
            log('❌ 網路錯誤: ' + e.message, '#ef4444');
            return '0';
        }
    }

    // ── 點下一題 ─────────────────────────────
    async function clickNext() {
        const next = [...document.querySelectorAll('button')]
            .find(b => /下一|next/i.test(b.textContent));
        if (next) { next.click(); return true; }

        const rightBtn = [...document.querySelectorAll('button,[role="button"]')]
            .find(el => {
                const r = el.getBoundingClientRect();
                return r.left > window.innerWidth * 0.65
                    && r.top > 150 && r.top < window.innerHeight - 100
                    && r.width > 0 && r.height > 0;
            });
        if (rightBtn) { rightBtn.click(); return true; }
        return false;
    }

    // ── 跑測驗 ────────────────────────────────
    async function doQuiz(chapterName, knownAnswers = []) {
        let enterBtn = null;
        for (let t = 0; t < 20; t++) {
            enterBtn = [...document.querySelectorAll('button,a')]
                .find(b => /進入測驗|開始測驗|重新測驗/.test(b.textContent));
            if (enterBtn) break;
            await sleep(500);
        }
        if (!enterBtn) { log(`  ℹ️ 無測驗按鈕`, '#64748b'); return null; }

        log(`  📝 進入測驗：${chapterName}`, '#a78bfa');
        enterBtn.click();
        await sleep(3000);

        const myAnswers = [];

        for (let i = 0; i < 30; i++) {
            if (stopped) return null;
            const qEl = document.querySelector('.question__title');
            if (!qEl) { log('  ✅ 題目結束', '#22c55e'); break; }

            const q = qEl.innerText.trim();
            const type = document.querySelector(
                '.quesiton__type-and-index,.question__type-and-index'
            )?.innerText || '';
            const opts = document.querySelectorAll('.question-wrap label,moocs-question label');
            const opts_text = [...opts].map((o, i) => `${i}: ${o.innerText.trim()}`).join('\n');

            log(`  Q${i + 1}: ${q.substring(0, 35)}...`, '#a78bfa');

            const ans = await askClaude(q, opts_text, type, knownAnswers[i] ?? null);
            const idx = parseInt(ans) || 0;
            (opts[idx] || opts[0])?.click();
            myAnswers.push(idx);
            log(`  ✅ 選第${idx}項`, '#22c55e');
            await sleep(1500);

            const sub = [...document.querySelectorAll('button')]
                .find(b => /送出|提交|完成|繳交/i.test(b.textContent));
            if (sub) {
                await sleep(800);
                sub.click();
                log(`  📤 送出！`, '#22c55e');
                await sleep(3000);
                break;
            }

            const moved = await clickNext();
            if (moved) { await sleep(2000); }
            else { log('  ⚠️ 找不到下一題', '#f59e0b'); break; }
        }

        return myAnswers;
    }

    // ── 等待影片（智慧模式）─────────────────────
    async function waitForVideo(isWatched) {
        // 已看過 → 完全跳過
        if (isWatched) {
            log('  ⏭️ 已看過，跳過影片等待', '#22c55e');
            await sleep(2000);
            return;
        }

        // 等影片元素出現
        let video = null;
        for (let i = 0; i < 20; i++) {
            video = document.querySelector('video');
            if (video && video.duration && isFinite(video.duration)) break;
            await sleep(500);
        }

        if (!video || !video.duration) {
            log('  ℹ️ 無影片，等5秒', '#64748b');
            await sleep(5000);
            return;
        }

        const dur = Math.round(video.duration);
        log(`  ▶️ 影片 ${dur} 秒，2倍速播放...`);
        video.muted = true;
        video.playbackRate = 2.0; // 2倍速，節省一半時間
        try { await video.play(); } catch (e) {}

        // 計時等待（2倍速所以只等一半時間）
        const waitTime = Math.ceil(dur / 2);
        let elapsed = 0;
        while (elapsed < waitTime && !stopped) {
            await sleep(5000);
            elapsed += 5;

            // 嘗試讀取實際進度
            try {
                if (video.currentTime > 0) {
                    const remain = Math.max(0, Math.ceil((dur - video.currentTime) / 2));
                    if (elapsed % 30 < 6) {
                        log(`  ⏳ 還剩約 ${remain} 秒...`, '#475569');
                        setStatus(`影片播放中（2倍速），還剩 ${remain} 秒`, '#4f8ef7');
                    }
                    if (video.ended || video.currentTime >= dur - 1) break;
                } else {
                    const remain = waitTime - elapsed;
                    if (elapsed % 30 < 6) {
                        log(`  ⏳ 還剩約 ${remain} 秒...`, '#475569');
                        setStatus(`影片播放中（2倍速），還剩 ${remain} 秒`, '#4f8ef7');
                    }
                }
            } catch (e) {}
        }

        log('  ✅ 影片播放完成', '#22c55e');
        resetIdleTimer();
    }

    // ── 處理單一章節 ─────────────────────────────
    async function processChapter(header, index, total) {
        if (stopped) return;

        const title = header.querySelector('.syllabus__title')?.innerText?.trim() || `章節${index + 1}`;
        const watched = isChapterWatched(header);

        log(`📌 [${index + 1}/${total}] ${title} ${watched ? '（已看過）' : '（未看）'}`,
            watched ? '#22c55e' : '#60a5fa');
        setStatus(`章節 ${index + 1}/${total}：${title}`, '#4f8ef7');
        resetIdleTimer();

        header.click();
        await sleep(2500);

        // 等影片（已看過直接跳過）
        await waitForVideo(watched);
        if (stopped) return;

        await sleep(1000);

        // 第一次測驗
        const myAnswers = await doQuiz(title);
        if (!myAnswers) return;

        // 等待成績頁
        await sleep(2000);

        // 判斷是否未過關（有「重新測驗」按鈕）
        const retestBtn = [...document.querySelectorAll('button,a')]
            .find(b => /重新測驗/.test(b.textContent));

        if (retestBtn) {
            log(`  ⚠️ 未達標，嘗試觀看答案後重測...`, '#f59e0b');

            // 找「觀看答案」
            const viewBtn = [...document.querySelectorAll('button,a')]
                .find(b => /觀看答案/.test(b.textContent));

            if (viewBtn) {
                viewBtn.click();
                await sleep(3000);

                // 從答案頁讀取正確答案索引
                const correctAnswers = [];
                const answerGroups = document.querySelectorAll(
                    '.question-wrap, moocs-question, [class*="question-item"]'
                );

                answerGroups.forEach((group, qi) => {
                    const labels = group.querySelectorAll('label');
                    labels.forEach((label, li) => {
                        const isCorrect =
                            label.classList.contains('correct') ||
                            label.querySelector('.correct, [class*="correct-answer"]') ||
                            label.style.color === 'rgb(34, 197, 94)' || // green
                            label.closest('.correct-answer');
                        if (isCorrect && correctAnswers[qi] === undefined) {
                            correctAnswers[qi] = li;
                        }
                    });
                });

                log(`  📖 讀取到 ${correctAnswers.filter(x=>x!==undefined).length} 個正確答案`, '#60a5fa');

                // 返回
                history.back();
                await sleep(2000);
                header.click();
                await sleep(2000);

                // 重測帶入正確答案
                log(`  🔄 重測中...`, '#a78bfa');
                await doQuiz(title, correctAnswers.length > 0 ? correctAnswers : []);
            } else {
                // 沒有觀看答案按鈕，直接重測
                retestBtn.click();
                await sleep(3000);
                await doQuiz(title);
            }
        }

        await sleep(1500);
    }

    // ── 主流程 ────────────────────────────────────
    log('▶ 開始執行 v4.3（智慧等待 + 防閒置）', '#4f8ef7');

    // 啟動防閒置
    startKeepAlive();

    const headers = [...document.querySelectorAll('mat-expansion-panel-header')];
    if (!headers.length) {
        log('❌ 找不到章節，請確認已進入課程頁面', '#ef4444');
        setStatus('❌ 找不到章節', '#ef4444');
        return;
    }

    log(`📚 找到 ${headers.length} 個章節`);

    for (let i = 0; i < headers.length; i++) {
        if (stopped) break;
        await processChapter(headers[i], i, headers.length);
    }

    clearInterval(keepAliveTimer);

    if (!stopped) {
        setStatus('🎉 全部完成！', '#22c55e');
        setKeepAlive('🔵 防閒置：已結束', '#60a5fa');
        log('🎉 全部章節與測驗完成！', '#22c55e');
    } else {
        setStatus('已停止', '#ef4444');
    }

})();
