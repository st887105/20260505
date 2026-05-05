// MOOCS 一鍵完課 v4.2
// 功能：計時等影片 → 測驗 → 分數不夠看答案 → 帶答案重測
// 修正：Claude 模型名稱、右側箭頭翻頁、重測帶入正確答案

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
    document.getElementById('moocs-v42')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v42';
    panel.style.cssText = [
        'position:fixed','bottom:20px','right:20px','width:310px',
        'z-index:999999','background:#13151f','color:#e2e8f0',
        'border-radius:14px','font-family:monospace','font-size:12px',
        'box-shadow:0 8px 32px rgba(0,0,0,.7)','border:1px solid #2a2d3e',
        'overflow:hidden'
    ].join(';');
    panel.innerHTML = `
        <div id="mv42-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);
            padding:12px 16px;display:flex;align-items:center;
            justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;font-size:13px;color:#4f8ef7">🎓 MOOCS v4.2</span>
            <span id="mv42-close" style="cursor:pointer;opacity:.5;font-size:15px">✕</span>
        </div>
        <div id="mv42-status" style="padding:7px 16px;font-size:11px;
            color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">準備中...</div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv42-log" style="max-height:240px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:8px">
            <button id="mv42-stop" style="flex:1;padding:8px;background:#3d1a1a;
                color:#ef4444;border:none;border-radius:7px;cursor:pointer;font-size:12px">⏹ 停止</button>
            <button id="mv42-key" style="padding:8px 10px;background:#1a2a3d;
                color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">🔑 換Key</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false;
    document.getElementById('mv42-close').onclick = () => panel.remove();
    document.getElementById('mv42-stop').onclick = () => { stopped = true; log('⏹ 停止中...', '#f59e0b'); };
    document.getElementById('mv42-key').onclick = () => {
        localStorage.removeItem('moocs_claude_key');
        log('🔑 Key 已清除，重新整理後重新輸入', '#f59e0b');
    };

    let drag = false, ox, oy;
    document.getElementById('mv42-hdr').onmousedown = e => {
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
        const el = document.getElementById('mv42-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8"><span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    function setStatus(msg, color = '#64748b') {
        const el = document.getElementById('mv42-status');
        if (el) { el.textContent = msg; el.style.color = color; }
    }

    // ── Claude API（正確模型名稱）────────────────
    async function askClaude(q, opts_text, type, knownAnswer = null) {
        await sleep(2000);

        let prompt;
        if (knownAnswer !== null) {
            // 重測模式：帶入已知正確答案
            prompt = `台灣資安教育測驗重測，正確答案是第${knownAnswer}項（從0開始）。只回答數字${knownAnswer}，不要解釋。`;
        } else {
            const isYesNo = type && type.includes('是非');
            prompt = isYesNo
                ? `台灣資訊安全教育課程是非題，只回答0（正確）或1（錯誤），不要解釋：\n${q}`
                : `台灣資訊安全教育課程單選題，選出最正確答案，只回答數字（從0開始），不要解釋：\n題目：${q}\n選項：\n${opts_text}`;
        }

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
                    model: 'claude-haiku-4-5-20251001', // 正確模型名稱
                    max_tokens: 10,
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            if (res.status === 429) {
                log('⏳ Claude 429，等20秒...', '#f59e0b');
                await sleep(20000);
                return askClaude(q, opts_text, type, knownAnswer);
            }

            const data = await res.json();
            if (!res.ok) {
                log(`❌ API錯誤 ${res.status}: ${JSON.stringify(data?.error)}`, '#ef4444');
                return '0';
            }
            return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0] || '0';
        } catch (e) {
            log('❌ 網路錯誤: ' + e.message, '#ef4444');
            return '0';
        }
    }

    // ── 點擊下一題（支援箭頭翻頁）───────────────
    async function clickNext() {
        // 1. 找「下一題」文字按鈕
        const nextBtn = [...document.querySelectorAll('button')]
            .find(b => /下一|next/i.test(b.textContent));
        if (nextBtn) { nextBtn.click(); return true; }

        // 2. 找右側箭頭（位置判斷）
        const allClickable = [...document.querySelectorAll(
            'button, [role="button"], .arrow, .nav-btn, [class*="arrow"], [class*="next"]'
        )];
        const rightBtn = allClickable.find(el => {
            const r = el.getBoundingClientRect();
            return r.left > window.innerWidth * 0.65
                && r.top > 150 && r.top < window.innerHeight - 100
                && r.width > 0 && r.height > 0;
        });
        if (rightBtn) { rightBtn.click(); return true; }

        return false;
    }

    // ── 讀取答案（觀看答案後）───────────────────
    async function readAnswers() {
        // 等答案頁面載入
        await sleep(2000);
        const answers = [];
        const answerEls = document.querySelectorAll('.correct-answer, .answer-correct, [class*="correct"]');

        // 嘗試從答案頁面讀取正確選項索引
        const allLabels = document.querySelectorAll('.question-wrap label, moocs-question label');
        allLabels.forEach((label, idx) => {
            const isCorrect = label.classList.contains('correct') ||
                label.querySelector('[class*="correct"]') ||
                label.style.color === 'green' ||
                label.closest('[class*="correct"]');
            if (isCorrect) answers.push(idx);
        });

        return answers;
    }

    // ── 跑測驗（支援重測帶入答案）───────────────
    async function doQuiz(chapterName, knownAnswers = []) {
        // 等進入測驗按鈕
        let enterBtn = null;
        for (let t = 0; t < 20; t++) {
            enterBtn = [...document.querySelectorAll('button, a')]
                .find(b => /進入測驗|開始測驗|重新測驗/.test(b.textContent));
            if (enterBtn) break;
            await sleep(500);
        }
        if (!enterBtn) { log(`  ℹ️ ${chapterName} 無測驗按鈕`, '#64748b'); return null; }

        log(`  📝 進入測驗：${chapterName}`, '#a78bfa');
        enterBtn.click();
        await sleep(3000);

        const myAnswers = []; // 記錄本次選的答案
        let qCount = 0;

        for (let i = 0; i < 30; i++) {
            if (stopped) return null;

            const qEl = document.querySelector('.question__title');
            if (!qEl) { log('  ✅ 題目結束', '#22c55e'); break; }

            qCount++;
            const q = qEl.innerText.trim();
            const type = document.querySelector('.quesiton__type-and-index,.question__type-and-index')?.innerText || '';
            const opts = document.querySelectorAll('.question-wrap label, moocs-question label');
            const opts_text = [...opts].map((o, idx) => `${idx}: ${o.innerText.trim()}`).join('\n');

            log(`  Q${qCount}: ${q.substring(0, 40)}...`, '#a78bfa');

            // 重測模式用已知答案，否則問 Claude
            const knownAns = knownAnswers[i] !== undefined ? knownAnswers[i] : null;
            const ans = await askClaude(q, opts_text, type, knownAns);
            const idx = parseInt(ans);

            const chosen = opts[isNaN(idx) ? 0 : idx] || opts[0];
            chosen?.click();
            myAnswers.push(isNaN(idx) ? 0 : idx);
            log(`  ✅ 選第${isNaN(idx) ? 0 : idx}項`, '#22c55e');
            await sleep(1500);

            // 找送出或下一題
            const sub = [...document.querySelectorAll('button')]
                .find(b => /送出|提交|完成|繳交/i.test(b.textContent));
            if (sub) {
                await sleep(800);
                sub.click();
                log(`  📤 ${chapterName} 測驗送出！`, '#22c55e');
                await sleep(3000);
                break;
            }

            const moved = await clickNext();
            if (moved) {
                await sleep(2000);
            } else {
                log('  ⚠️ 找不到下一題按鈕', '#f59e0b');
                break;
            }
        }

        // 讀取成績
        const scoreEl = document.querySelector('[class*="score"], .score, .result-score');
        const scoreText = scoreEl?.innerText || document.body.innerText.match(/本次成績[：:]\s*(\d+)/)?.[1];
        log(`  📊 成績: ${scoreText || '未知'}`, '#60a5fa');

        return { answers: myAnswers, scoreText };
    }

    // ── 等影片（計時模式）────────────────────────
    async function waitForVideo() {
        let video = null;
        for (let i = 0; i < 20; i++) {
            video = document.querySelector('video');
            if (video && video.duration && isFinite(video.duration)) break;
            await sleep(500);
        }
        if (!video || !video.duration) {
            log('  ℹ️ 無影片，等 5 秒', '#64748b');
            await sleep(5000);
            return;
        }

        const dur = Math.round(video.duration);
        log(`  ▶️ 影片 ${dur} 秒，計時等待...`);
        video.muted = true;
        try { await video.play(); } catch (e) {}

        let elapsed = 0;
        while (elapsed < dur && !stopped) {
            await sleep(5000);
            elapsed += 5;
            const remain = dur - elapsed;
            if (remain > 0 && elapsed % 30 < 6) {
                log(`  ⏳ 還剩約 ${Math.max(0, remain)} 秒...`, '#475569');
                setStatus(`影片播放中，還剩 ${Math.max(0, remain)} 秒`, '#4f8ef7');
            }
        }
        log('  ✅ 影片等待完成', '#22c55e');
    }

    // ── 處理單一章節（含重測邏輯）───────────────
    async function processChapter(header, index, total) {
        if (stopped) return;

        const title = header.querySelector('.syllabus__title')?.innerText?.trim() || `章節${index + 1}`;
        log(`📌 [${index + 1}/${total}] ${title}`, '#60a5fa');
        setStatus(`章節 ${index + 1}/${total}：${title}`, '#4f8ef7');

        header.click();
        await sleep(2500);

        await waitForVideo();
        if (stopped) return;
        await sleep(1000);

        // 第一次測驗
        const result = await doQuiz(title);
        if (!result) return;

        // 判斷是否需要重測（檢查是否有「重新測驗」按鈕或分數低）
        await sleep(2000);
        const retestBtn = [...document.querySelectorAll('button, a')]
            .find(b => /重新測驗/.test(b.textContent));
        const viewAnswerBtn = [...document.querySelectorAll('button, a')]
            .find(b => /觀看答案/.test(b.textContent));

        if (retestBtn && viewAnswerBtn) {
            log(`  ⚠️ 分數未達標，先觀看答案...`, '#f59e0b');
            viewAnswerBtn.click();
            await sleep(3000);

            // 讀取正確答案
            const correctAnswers = await readAnswers();
            log(`  📖 讀取到 ${correctAnswers.length} 個正確答案`, '#60a5fa');

            // 回到測驗頁重測
            history.back();
            await sleep(2000);
            header.click();
            await sleep(2000);

            // 重測（帶入正確答案）
            log(`  🔄 開始重測（帶入正確答案）...`, '#a78bfa');
            await doQuiz(title, correctAnswers);
        }

        await sleep(1500);
    }

    // ── 主流程 ────────────────────────────────────
    log('▶ 開始執行 v4.2', '#4f8ef7');

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

    if (!stopped) {
        setStatus('🎉 全部完成！', '#22c55e');
        log('🎉 全部章節與測驗完成！', '#22c55e');
    } else {
        setStatus('已停止', '#ef4444');
    }
})();
