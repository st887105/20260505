// MOOCS 一鍵完課 v4.0
// 功能：真實等待影片播完 + Gemini Vision AI 自動作答測驗（支援圖片題）
// 使用：書籤一鍵執行

(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ── API Key（自動記住）────────────────────────
    let KEY = localStorage.getItem('moocs_gemini_key');
    if (!KEY) {
        KEY = prompt('請輸入 Gemini API Key（只需輸入一次，免費申請）：');
        if (!KEY) return;
        localStorage.setItem('moocs_gemini_key', KEY);
    }

    // ── 建立面板 ──────────────────────────────────
    document.getElementById('moocs-v4')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v4';
    panel.style.cssText = [
        'position:fixed', 'bottom:20px', 'right:20px', 'width:300px',
        'z-index:999999', 'background:#13151f', 'color:#e2e8f0',
        'border-radius:14px', 'font-family:monospace', 'font-size:12px',
        'box-shadow:0 8px 32px rgba(0,0,0,.7)', 'border:1px solid #2a2d3e',
        'overflow:hidden'
    ].join(';');

    panel.innerHTML = `
        <div id="mv4-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);
            padding:12px 16px;display:flex;align-items:center;
            justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;font-size:13px;color:#4f8ef7">🎓 MOOCS 一鍵完課 v4</span>
            <span id="mv4-close" style="cursor:pointer;opacity:.5;font-size:15px">✕</span>
        </div>
        <div id="mv4-status" style="padding:7px 16px;font-size:11px;
            color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">
            準備中...
        </div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv4-log" style="max-height:220px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:8px">
            <button id="mv4-stop" style="flex:1;padding:8px;background:#3d1a1a;
                color:#ef4444;border:none;border-radius:7px;cursor:pointer;font-size:12px">
                ⏹ 停止
            </button>
            <button id="mv4-key" style="padding:8px 10px;background:#1a2a3d;
                color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">
                🔑 換Key
            </button>
        </div>`;

    document.body.appendChild(panel);

    let stopped = false;
    document.getElementById('mv4-close').onclick = () => panel.remove();
    document.getElementById('mv4-stop').onclick = () => { stopped = true; log('⏹ 停止中...', '#f59e0b'); };
    document.getElementById('mv4-key').onclick = () => {
        localStorage.removeItem('moocs_gemini_key');
        log('🔑 API Key 已清除，重新整理頁面後重新輸入', '#f59e0b');
    };

    // 拖曳
    let drag = false, ox, oy;
    document.getElementById('mv4-hdr').onmousedown = e => {
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
        const el = document.getElementById('mv4-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8">
            <span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }

    function setStatus(msg, color = '#64748b') {
        const el = document.getElementById('mv4-status');
        if (el) { el.textContent = msg; el.style.color = color; }
    }

    // ── 截圖題目區塊（html2canvas 動態載入）────────
    async function captureQuestionImage() {
        // 動態載入 html2canvas
        if (!window.html2canvas) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }

        // 找題目容器（依優先順序嘗試）
        const qContainer =
            document.querySelector('.question-wrap') ||
            document.querySelector('moocs-question') ||
            document.querySelector('.question__title')?.closest('div') ||
            document.querySelector('.question__title');

        if (!qContainer) return null;

        try {
            const canvas = await html2canvas(qContainer, {
                useCORS: true,
                allowTaint: true,
                scale: 1.5,
                backgroundColor: '#ffffff',
                logging: false
            });
            return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]; // 回傳 base64
        } catch (e) {
            log('⚠️ 截圖失敗: ' + e.message, '#f59e0b');
            return null;
        }
    }

    // ── Gemini Vision API ─────────────────────────
    async function askGemini(imageBase64, questionText, type) {
        const isYesNo = type && type.includes('是非');

        const instruction = isYesNo
            ? `這是台灣教育訓練平台的是非題。
請判斷題目是否正確。
只回答一個數字：0（正確/是）或 1（錯誤/否）。
不要任何解釋，只要數字。`
            : `這是台灣教育訓練平台的選擇題。
請找出正確答案的選項編號（從0開始，第一個選項=0，第二個=1，以此類推）。
只回答一個數字，不要任何解釋。`;

        const parts = [];

        // 優先使用截圖
        if (imageBase64) {
            parts.push({
                inlineData: { mimeType: 'image/jpeg', data: imageBase64 }
            });
        }

        // 也附上文字（雙重保障）
        if (questionText) {
            parts.push({ text: `題目文字（參考）：${questionText}\n\n${instruction}` });
        } else {
            parts.push({ text: instruction });
        }

        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts }] })
                }
            );
            const data = await res.json();

            if (!res.ok) {
                const errMsg = data?.error?.message || res.status;
                log(`❌ Gemini API 錯誤: ${errMsg}`, '#ef4444');
                return null;
            }

            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!text) { log('⚠️ Gemini 無回應', '#f59e0b'); return null; }

            // 從回應中提取數字（容錯處理）
            const match = text.match(/\d/);
            return match ? match[0] : null;

        } catch (e) {
            log('❌ 網路錯誤: ' + e.message, '#ef4444');
            return null;
        }
    }

    // ── 等待影片播完 ──────────────────────────────
    async function waitForVideo() {
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
        video.muted = true;
        try { await video.play(); } catch (e) {}

        await new Promise(resolve => {
            if (video.ended) { resolve(); return; }
            const check = setInterval(() => {
                if (stopped || video.ended || video.currentTime >= video.duration - 0.5) {
                    clearInterval(check);
                    resolve();
                }
            }, 1000);
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
        header.click();
        await sleep(2000);
        const hasVideo = await waitForVideo();
        if (!hasVideo) log('  ℹ️ 無影片，繼續下一章節');
        await sleep(1000);
    }

    // ── 處理測驗 ──────────────────────────────────
    async function doQuiz() {
        const enterBtn = [...document.querySelectorAll('button, a')]
            .find(b => /進入測驗|開始測驗/.test(b.textContent));
        if (enterBtn) {
            log('📝 進入測驗...', '#a78bfa');
            enterBtn.click();
            await sleep(2500);
        }

        let count = 0;
        for (let i = 0; i < 50; i++) {
            if (stopped) return;

            const qEl    = document.querySelector('.question__title');
            const typeEl = document.querySelector('.quesiton__type-and-index, .question__type-and-index');
            if (!qEl) { log('ℹ️ 找不到題目，可能已結束', '#64748b'); break; }

            count++;
            const questionText = qEl.innerText.trim();
            const type = typeEl?.innerText?.trim() || '';

            log(`📝 第 ${count} 題 [${type || '未知'}] 截圖辨識中...`, '#a78bfa');
            setStatus(`測驗第 ${count} 題（Gemini Vision 分析中）`, '#6c63ff');

            // 截圖
            const imgBase64 = await captureQuestionImage();
            if (imgBase64) {
                log('  📷 截圖成功，送 Gemini 分析...', '#60a5fa');
            } else {
                log('  ⚠️ 截圖失敗，改用純文字模式', '#f59e0b');
            }

            // 呼叫 Gemini Vision
            const answer = await askGemini(imgBase64, questionText, type);

            if (answer !== null) {
                const idx = parseInt(answer);

                // 只抓「當前顯示」的選項
                const opts = document.querySelectorAll(
                    '.question-wrap .question__options label, ' +
                    '.question-wrap label, ' +
                    'moocs-question label'
                );

                if (!isNaN(idx) && opts[idx]) {
                    opts[idx].click();
                    log(`  ✅ 選第 ${idx} 項（Gemini: ${answer}）`, '#22c55e');
                } else {
                    log(`  ⚠️ 找不到選項 ${idx}（共 ${opts.length} 項）`, '#f59e0b');
                    // 找不到就選第 0 項當保底
                    if (opts[0]) { opts[0].click(); log('  🎲 保底選第 0 項', '#f59e0b'); }
                }
            } else {
                log('  ❌ AI 無法判斷，保底選第 0 項', '#ef4444');
                const opts = document.querySelectorAll('.question-wrap label, moocs-question label');
                if (opts[0]) opts[0].click();
            }

            await sleep(1200);

            // 下一題
            const next = [...document.querySelectorAll('button')]
                .find(b => /下一|next/i.test(b.textContent));
            if (next) { next.click(); await sleep(1800); }
            else break;
        }

        // 送出
        await sleep(800);
        const submit = [...document.querySelectorAll('button')]
            .find(b => /送出|提交|完成|結束/i.test(b.textContent));
        if (submit) {
            submit.click();
            log('📤 測驗已送出！', '#22c55e');
        } else {
            log('⚠️ 找不到送出按鈕，請手動點擊', '#f59e0b');
        }
    }

    // ── 主流程 ────────────────────────────────────
    log('▶ 開始執行（Gemini Vision 模式）...', '#4f8ef7');

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
        log('─────────────────────', '#334155');
        log('開始處理測驗...', '#a78bfa');
        await doQuiz();
        setStatus('🎉 全部完成！', '#22c55e');
        log('🎉 全部完成！', '#22c55e');
    } else {
        setStatus('已停止', '#ef4444');
    }
})();
