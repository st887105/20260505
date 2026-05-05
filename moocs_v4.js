// MOOCS 一鍵完課 v4.1
// 修正：影片計時模式 + Gemini 429 重試 + 測驗自動偵測
// 使用：書籤一鍵執行

(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ── API Key ────────────────────────────────────
    let KEY = localStorage.getItem('moocs_gemini_key');
    if (!KEY) {
        KEY = prompt('請輸入 Gemini API Key（免費申請 aistudio.google.com）：');
        if (!KEY) return;
        localStorage.setItem('moocs_gemini_key', KEY);
    }

    // ── 面板 ───────────────────────────────────────
    document.getElementById('moocs-v41')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v41';
    panel.style.cssText = [
        'position:fixed','bottom:20px','right:20px','width:300px',
        'z-index:999999','background:#13151f','color:#e2e8f0',
        'border-radius:14px','font-family:monospace','font-size:12px',
        'box-shadow:0 8px 32px rgba(0,0,0,.7)','border:1px solid #2a2d3e',
        'overflow:hidden'
    ].join(';');

    panel.innerHTML = `
        <div id="mv41-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);
            padding:12px 16px;display:flex;align-items:center;
            justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;font-size:13px;color:#4f8ef7">🎓 MOOCS 一鍵完課 v4.1</span>
            <span id="mv41-close" style="cursor:pointer;opacity:.5;font-size:15px">✕</span>
        </div>
        <div id="mv41-status" style="padding:7px 16px;font-size:11px;
            color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">
            準備中...
        </div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv41-log" style="max-height:220px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:8px">
            <button id="mv41-stop" style="flex:1;padding:8px;background:#3d1a1a;
                color:#ef4444;border:none;border-radius:7px;cursor:pointer;font-size:12px">
                ⏹ 停止
            </button>
            <button id="mv41-key" style="padding:8px 10px;background:#1a2a3d;
                color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">
                🔑 換Key
            </button>
        </div>`;

    document.body.appendChild(panel);

    let stopped = false;
    document.getElementById('mv41-close').onclick = () => panel.remove();
    document.getElementById('mv41-stop').onclick = () => { stopped = true; log('⏹ 停止中...', '#f59e0b'); };
    document.getElementById('mv41-key').onclick = () => {
        localStorage.removeItem('moocs_gemini_key');
        log('🔑 Key 已清除，重新整理後重新輸入', '#f59e0b');
    };

    // 拖曳
    let drag = false, ox, oy;
    document.getElementById('mv41-hdr').onmousedown = e => {
        drag = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
    };
    document.onmousemove = e => {
        if (!drag) return;
        panel.style.left = (e.clientX - ox) + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
        panel.style.top = (e.clientY - oy) + 'px';
    };
    document.onmouseup = () => drag = false;

    // ── 工具 ───────────────────────────────────────
    function log(msg, color = '#94a3b8') {
        const el = document.getElementById('mv41-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8">
            <span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    function setStatus(msg, color = '#64748b') {
        const el = document.getElementById('mv41-status');
        if (el) { el.textContent = msg; el.style.color = color; }
    }

    // ── Gemini API（含 429 重試）──────────────────
    async function askGemini(questionText, type, retryCount = 0) {
        const isYesNo = type && type.includes('是非');
        const instruction = isYesNo
            ? `台灣教育訓練是非題，只回答數字 0（正確/是）或 1（錯誤/否），絕對不要解釋：\n${questionText}`
            : `台灣教育訓練選擇題，只回答正確選項數字（從0開始，第一選項=0），絕對不要解釋：\n${questionText}`;

        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }] })
                }
            );

            // 429 重試（最多 3 次，等待 15/30/60 秒）
            if (res.status === 429) {
                if (retryCount >= 3) {
                    log('❌ Gemini 429 超過重試次數，保底選第0項', '#ef4444');
                    return '0';
                }
                const waitSec = [15, 30, 60][retryCount];
                log(`⏳ Gemini 429，等待 ${waitSec} 秒後重試...`, '#f59e0b');
                setStatus(`等待 Gemini 限流 ${waitSec} 秒...`, '#f59e0b');
                await sleep(waitSec * 1000);
                return askGemini(questionText, type, retryCount + 1);
            }

            const data = await res.json();
            if (!res.ok) {
                log(`❌ Gemini 錯誤 ${res.status}`, '#ef4444');
                return '0';
            }

            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            const match = text?.match(/\d/);
            return match ? match[0] : '0';

        } catch (e) {
            log('❌ 網路錯誤: ' + e.message, '#ef4444');
            return '0';
        }
    }

    // ── 影片等待（計時模式，不依賴 ended）────────
    async function waitForVideo() {
        // 等影片元素出現（最多 10 秒）
        let video = null;
        for (let i = 0; i < 20; i++) {
            video = document.querySelector('video');
            if (video && video.duration && isFinite(video.duration)) break;
            await sleep(500);
        }

        if (!video) {
            log('  ℹ️ 無影片元素，等待 5 秒後繼續');
            await sleep(5000);
            return;
        }

        const dur = video.duration;
        if (!dur || !isFinite(dur)) {
            log('  ⚠️ 無法取得影片長度，等待 30 秒');
            await sleep(30000);
            return;
        }

        log(`  ▶️ 影片 ${Math.round(dur)} 秒，開始計時等待...`);
        video.muted = true;
        try { await video.play(); } catch (e) {}

        // ★ 改用計時模式，不依賴 video.ended（解決 iframe 跨域問題）
        let elapsed = 0;
        while (elapsed < dur && !stopped) {
            await sleep(5000);
            elapsed += 5;

            // 嘗試讀取實際播放進度（如果能讀到就用）
            try {
                if (video.currentTime > 0) elapsed = video.currentTime;
            } catch(e) {}

            const remain = Math.round(dur - elapsed);
            if (remain > 0 && elapsed % 30 < 5) {
                log(`  ⏳ 還剩約 ${remain} 秒...`, '#475569');
                setStatus(`影片播放中，還剩 ${remain} 秒`, '#4f8ef7');
            }
        }

        log('  ✅ 影片等待完成', '#22c55e');
    }

    // ── 處理測驗 ──────────────────────────────────
    async function doQuiz(chapterName) {
        // 等待「進入測驗」按鈕出現（最多 5 秒）
        let enterBtn = null;
        for (let i = 0; i < 10; i++) {
            enterBtn = [...document.querySelectorAll('button, a')]
                .find(b => /進入測驗|開始測驗/.test(b.textContent));
            if (enterBtn) break;
            await sleep(500);
        }

        if (!enterBtn) {
            log('  ℹ️ 無測驗按鈕，跳過', '#64748b');
            return;
        }

        log(`  📝 進入測驗：${chapterName}`, '#a78bfa');
        enterBtn.click();
        await sleep(2500);

        let count = 0;
        for (let i = 0; i < 50; i++) {
            if (stopped) return;

            const qEl = document.querySelector('.question__title');
            if (!qEl) { log('  ✅ 測驗題目結束', '#22c55e'); break; }

            count++;
            const question = qEl.innerText.trim();
            const type = document.querySelector(
                '.quesiton__type-and-index, .question__type-and-index'
            )?.innerText?.trim() || '';

            log(`  📝 第 ${count} 題 [${type || '選擇'}]`, '#a78bfa');
            setStatus(`${chapterName} — 第 ${count} 題`, '#6c63ff');

            const answer = await askGemini(question, type);
            const idx = parseInt(answer);

            const opts = document.querySelectorAll(
                '.question-wrap .question__options label, ' +
                '.question-wrap label, moocs-question label'
            );

            if (!isNaN(idx) && opts[idx]) {
                opts[idx].click();
                log(`  ✅ 選第 ${idx} 項`, '#22c55e');
            } else {
                if (opts[0]) opts[0].click();
                log(`  🎲 找不到選項 ${idx}，保底選第0項`, '#f59e0b');
            }

            await sleep(1500);

            // 下一題
            const next = [...document.querySelectorAll('button')]
                .find(b => /下一|next/i.test(b.textContent));
            if (next) { next.click(); await sleep(2000); }
            else break;
        }

        // 送出
        await sleep(800);
        const submit = [...document.querySelectorAll('button')]
            .find(b => /送出|提交|完成|結束|繳交/i.test(b.textContent));
        if (submit) {
            submit.click();
            log(`  📤 ${chapterName} 測驗送出！`, '#22c55e');
            await sleep(2000);
        }
    }

    // ── 處理單一章節 ──────────────────────────────
    async function processChapter(header, index, total) {
        if (stopped) return;

        const title = header.querySelector('.syllabus__title')?.innerText?.trim()
            || header.innerText?.split('\n')[0]?.trim()
            || `章節${index + 1}`;

        log(`📌 [${index + 1}/${total}] ${title}`, '#60a5fa');
        setStatus(`章節 ${index + 1}/${total}：${title}`, '#4f8ef7');

        header.click();
        await sleep(2500);

        // 等待影片
        await waitForVideo();
        if (stopped) return;

        await sleep(1000);

        // 處理測驗
        await doQuiz(title);

        await sleep(1500);
    }

    // ── 主流程 ────────────────────────────────────
    log('▶ 開始執行 v4.1（計時模式 + 429重試）', '#4f8ef7');

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
