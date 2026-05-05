// MOOCS 一鍵完課 v3.0
// 功能：真實等待影片播完 + Claude AI 自動作答測驗
// 使用：書籤一鍵執行

(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ── API Key（自動記住）────────────────────────
    let KEY = localStorage.getItem('moocs_claude_key');
    if (!KEY) {
        KEY = prompt('請輸入 Claude API Key（只需輸入一次）：');
        if (!KEY) return;
        localStorage.setItem('moocs_claude_key', KEY);
    }

    // ── 建立面板 ──────────────────────────────────
    document.getElementById('moocs-v3')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v3';
    panel.style.cssText = [
        'position:fixed', 'bottom:20px', 'right:20px', 'width:290px',
        'z-index:999999', 'background:#13151f', 'color:#e2e8f0',
        'border-radius:14px', 'font-family:monospace', 'font-size:12px',
        'box-shadow:0 8px 32px rgba(0,0,0,.7)', 'border:1px solid #2a2d3e',
        'overflow:hidden'
    ].join(';');

    panel.innerHTML = `
        <div id="mv3-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);
            padding:12px 16px;display:flex;align-items:center;
            justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;font-size:13px;color:#4f8ef7">🎓 MOOCS 一鍵完課</span>
            <span id="mv3-close" style="cursor:pointer;opacity:.5;font-size:15px">✕</span>
        </div>
        <div id="mv3-status" style="padding:7px 16px;font-size:11px;
            color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">
            準備中...
        </div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv3-log" style="max-height:220px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:8px">
            <button id="mv3-stop" style="flex:1;padding:8px;background:#3d1a1a;
                color:#ef4444;border:none;border-radius:7px;cursor:pointer;font-size:12px">
                ⏹ 停止
            </button>
        </div>`;

    document.body.appendChild(panel);

    let stopped = false;
    document.getElementById('mv3-close').onclick = () => panel.remove();
    document.getElementById('mv3-stop').onclick = () => {
        stopped = true;
        log('⏹ 停止中...', '#f59e0b');
    };

    // 拖曳
    let drag = false, ox, oy;
    document.getElementById('mv3-hdr').onmousedown = e => {
        drag = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
    };
    document.onmousemove = e => {
        if (!drag) return;
        panel.style.left = (e.clientX - ox) + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
        panel.style.top = (e.clientY - oy) + 'px';
    };
    document.onmouseup = () => drag = false;

    // ── 工具函式 ──────────────────────────────────
    function log(msg, color = '#94a3b8') {
        const el = document.getElementById('mv3-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8">
            <span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }

    function setStatus(msg, color = '#64748b') {
        const el = document.getElementById('mv3-status');
        if (el) { el.textContent = msg; el.style.color = color; }
    }

    // ── Claude API ────────────────────────────────
    async function askClaude(question, type) {
        const isYesNo = type.includes('是非');
        const prompt = isYesNo
            ? `台灣教育訓練是非題，只回答數字 0（正確/是）或 1（錯誤/否），絕對不要解釋：\n${question}`
            : `台灣教育訓練選擇題，只回答正確選項數字（從0開始計算），絕對不要解釋：\n${question}`;

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
            const data = await res.json();
            if (res.status !== 200) {
                log(`❌ API錯誤 ${res.status}`, '#ef4444');
                return null;
            }
            return data.content?.[0]?.text?.trim();
        } catch (e) {
            log('❌ 網路錯誤: ' + e.message, '#ef4444');
            return null;
        }
    }

    // ── 等待影片播完 ──────────────────────────────
    async function waitForVideo() {
        // 等影片元素出現
        let video = null;
        for (let i = 0; i < 20; i++) {
            video = document.querySelector('video');
            if (video) break;
            await sleep(500);
        }
        if (!video) return false;

        const dur = video.duration;
        if (!dur || !isFinite(dur)) {
            log('  ⚠️ 無法取得影片長度，等待 30 秒...');
            await sleep(30000);
            return true;
        }

        log(`  ▶️ 影片長度 ${Math.round(dur)} 秒，開始播放...`);

        // 確保靜音播放（避免打擾）
        video.muted = true;
        try { await video.play(); } catch (e) {}

        // 等待播完
        await new Promise(resolve => {
            if (video.ended) { resolve(); return; }

            const check = setInterval(() => {
                if (stopped || video.ended || video.currentTime >= video.duration - 0.5) {
                    clearInterval(check);
                    resolve();
                }
            }, 1000);

            // 最長等 60 分鐘
            setTimeout(() => { clearInterval(check); resolve(); }, 60 * 60 * 1000);
        });

        log('  ✅ 影片播放完成', '#22c55e');
        return true;
    }

    // ── 處理單一章節 ──────────────────────────────
    async function processChapter(header, index, total) {
        if (stopped) return;

        const title = header.querySelector('.syllabus__title')?.innerText?.trim() || `章節${index + 1}`;
        log(`📌 [${index + 1}/${total}] ${title}`, '#60a5fa');
        setStatus(`章節 ${index + 1}/${total}：${title}`, '#4f8ef7');

        // 點擊章節
        header.click();
        await sleep(2000);

        // 等待影片
        const hasVideo = await waitForVideo();
        if (!hasVideo) {
            log('  ℹ️ 無影片，繼續下一章節');
        }

        await sleep(1000);
    }

    // ── 處理測驗 ──────────────────────────────────
    async function doQuiz() {
        // 找進入測驗按鈕
        const enterBtn = [...document.querySelectorAll('button, a')]
            .find(b => /進入測驗|開始測驗/.test(b.textContent));
        if (enterBtn) {
            log('📝 進入測驗...', '#a78bfa');
            enterBtn.click();
            await sleep(2500);
        }

        let count = 0;
        for (let i = 0; i < 30; i++) {
            if (stopped) return;

            const qEl    = document.querySelector('.question__title');
            const typeEl = document.querySelector('.quesiton__type-and-index');
            if (!qEl) break;

            count++;
            const question = qEl.innerText.trim();
            const type     = typeEl?.innerText?.trim() || '';

            log(`📝 第 ${count} 題 [${type}]`, '#a78bfa');
            setStatus(`測驗第 ${count} 題`, '#6c63ff');

            const answer = await askClaude(question, type);
            if (answer !== null) {
                const idx  = parseInt(answer);
                const opts = document.querySelectorAll(
                    '.question-wrap label, moocs-question label, .show-quiz-answer label'
                );
                if (!isNaN(idx) && opts[idx]) {
                    opts[idx].click();
                    log(`  ✅ 選第 ${idx} 項（Claude: ${answer}）`, '#22c55e');
                } else {
                    log(`  ⚠️ 找不到選項 ${idx}`, '#f59e0b');
                }
            }

            await sleep(1200);

            // 下一題
            const next = [...document.querySelectorAll('button')]
                .find(b => /下一|next/i.test(b.textContent));
            if (next) { next.click(); await sleep(1500); }
            else break;
        }

        // 送出
        await sleep(500);
        const submit = [...document.querySelectorAll('button')]
            .find(b => /送出|提交|完成|結束/i.test(b.textContent));
        if (submit) {
            submit.click();
            log('📤 測驗已送出！', '#22c55e');
        }
    }

    // ── 主流程 ────────────────────────────────────
    log('▶ 開始執行...', '#4f8ef7');

    // 取得所有章節
    const headers = [...document.querySelectorAll('mat-expansion-panel-header')];
    if (!headers.length) {
        log('❌ 找不到章節，請確認已進入課程頁面', '#ef4444');
        setStatus('❌ 找不到章節', '#ef4444');
        return;
    }

    log(`📚 找到 ${headers.length} 個章節`);

    // 逐一處理章節（含等待影片）
    for (let i = 0; i < headers.length; i++) {
        if (stopped) break;
        await processChapter(headers[i], i, headers.length);
    }

    if (!stopped) {
        log('─────────────────────', '#334155');
        log('開始處理測驗...', '#a78bfa');
        await doQuiz();
        setStatus('🎉 全部完成！', '#22c55e');
        log('🎉 全部完成！', '#22c55e');
    } else {
        setStatus('已停止', '#ef4444');
    }

})();
