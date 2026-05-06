// MOOCS 一鍵完課 v5.1
// 完整流程：展開群組→點單元→等記錄→測驗→發討論→確認完成

(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let KEY = localStorage.getItem('moocs_claude_key');
    if (!KEY) {
        KEY = prompt('請輸入 Claude API Key：');
        if (!KEY) return;
        localStorage.setItem('moocs_claude_key', KEY);
    }

    // ── 面板 ─────────────────────────────────────
    document.getElementById('moocs-v51')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v51';
    panel.style.cssText = [
        'position:fixed','bottom:20px','right:20px','width:310px',
        'z-index:999999','background:#13151f','color:#e2e8f0',
        'border-radius:14px','font-family:monospace','font-size:12px',
        'box-shadow:0 8px 32px rgba(0,0,0,.7)','border:1px solid #2a2d3e',
        'overflow:hidden'
    ].join(';');
    panel.innerHTML = `
        <div id="mv51-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);
            padding:12px 16px;display:flex;align-items:center;
            justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;font-size:13px;color:#4f8ef7">🎓 MOOCS v5.1</span>
            <span id="mv51-close" style="cursor:pointer;opacity:.5;font-size:15px">✕</span>
        </div>
        <div id="mv51-status" style="padding:7px 16px;font-size:11px;
            color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">準備中...</div>
        <div id="mv51-alive" style="padding:4px 16px;font-size:10px;
            color:#22c55e;background:#0a0f0a;border-bottom:1px solid #1a1d27">
            🟢 防閒置：啟動中...</div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv51-log" style="max-height:220px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:8px">
            <button id="mv51-stop" style="flex:1;padding:8px;background:#3d1a1a;
                color:#ef4444;border:none;border-radius:7px;cursor:pointer;font-size:12px">⏹ 停止</button>
            <button id="mv51-key" style="padding:8px 10px;background:#1a2a3d;
                color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">🔑 換Key</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false;
    document.getElementById('mv51-close').onclick = () => { stopped = true; panel.remove(); };
    document.getElementById('mv51-stop').onclick = () => { stopped = true; log('⏹ 停止中...', '#f59e0b'); };
    document.getElementById('mv51-key').onclick = () => {
        localStorage.removeItem('moocs_claude_key');
        log('🔑 Key 已清除', '#f59e0b');
    };

    let drag = false, ox, oy;
    document.getElementById('mv51-hdr').onmousedown = e => {
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
        const el = document.getElementById('mv51-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8">
            <span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    function setStatus(msg, color = '#64748b') {
        const el = document.getElementById('mv51-status');
        if (el) { el.textContent = msg; el.style.color = color; }
    }
    function setAlive(msg, color = '#22c55e') {
        const el = document.getElementById('mv51-alive');
        if (el) { el.textContent = msg; el.style.color = color; }
    }

    // ── 防閒置 ───────────────────────────────────
    let lastActive = Date.now();
    const aliveTimer = setInterval(() => {
        if (stopped) { clearInterval(aliveTimer); return; }
        const idle = Math.round((Date.now() - lastActive) / 60000);
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true,
            clientX: Math.random() * window.innerWidth,
            clientY: Math.random() * window.innerHeight }));
        if (idle >= 25) {
            const tabs = document.querySelectorAll('[role="tab"],.mat-tab-label');
            if (tabs.length) { tabs[0].click(); setTimeout(() => tabs[Math.min(1,tabs.length-1)]?.click(), 500); }
            setAlive(`🟡 防閒置：已觸發（閒置${idle}分）`, '#f59e0b');
        } else {
            setAlive(`🟢 防閒置：正常（閒置${idle}分/上限25分）`, '#22c55e');
        }
    }, 2 * 60 * 1000);

    // ── 監聽平台記錄完成 ─────────────────────────
    function waitForRecord(timeoutMs = 20 * 60 * 1000) {
        return new Promise(resolve => {
            const orig = window.fetch;
            let done = false;
            window.fetch = function (...args) {
                const url = args[0]?.toString() || '';
                if (url.includes('add-course-reading-record') && !done) {
                    done = true; window.fetch = orig;
                    log('  ✅ 平台記錄完成', '#22c55e');
                    setTimeout(resolve, 1500);
                }
                return orig.apply(this, args);
            };
            setTimeout(() => {
                if (!done) { done = true; window.fetch = orig;
                    log('  ⏰ 等待超時，繼續', '#f59e0b'); resolve(); }
            }, timeoutMs);
        });
    }

    // ── Claude API ───────────────────────────────
    async function askClaude(q, opts_text, type, retry = 0) {
        await sleep(2000);
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
                log(`  ⏳ 429，等${w}秒...`, '#f59e0b');
                await sleep(w * 1000);
                return askClaude(q, opts_text, type, retry + 1);
            }
            const data = await res.json();
            if (!res.ok) { log(`  ❌ API ${res.status}`, '#ef4444'); return '0'; }
            return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0] || '0';
        } catch (e) { log('  ❌ ' + e.message, '#ef4444'); return '0'; }
    }

    // ── 找右側翻頁圓形箭頭 ───────────────────────
    function findRightArrow() {
        return [...document.querySelectorAll('button,[role="button"]')]
            .find(el => {
                const r = el.getBoundingClientRect();
                return r.right >= window.innerWidth - 80
                    && r.top > 200
                    && r.top < window.innerHeight - 100
                    && r.width > 0 && r.width < 120;
            });
    }

    // ── 跑測驗 ───────────────────────────────────
    async function doQuiz(name) {
        let enterBtn = null;
        for (let t = 0; t < 20; t++) {
            enterBtn = [...document.querySelectorAll('button,a')]
                .find(b => /進入測驗|開始測驗|重新測驗/.test(b.textContent));
            if (enterBtn) break;
            await sleep(500);
        }
        if (!enterBtn) { log(`  ℹ️ 無測驗`, '#64748b'); return; }

        log(`  📝 進入測驗`, '#a78bfa');
        enterBtn.click();
        await sleep(3000);

        for (let i = 0; i < 30; i++) {
            if (stopped) return;
            const qEl = document.querySelector('.question__title');
            if (!qEl) { log('  ✅ 題目結束', '#22c55e'); break; }

            const q = qEl.innerText.trim();
            const type = document.querySelector(
                '.quesiton__type-and-index,.question__type-and-index'
            )?.innerText || '';
            const opts = document.querySelectorAll('.question-wrap label,moocs-question label');
            const opts_text = [...opts].map((o, i) => `${i}: ${o.innerText.trim()}`).join('\n');

            log(`  Q${i+1}: ${q.substring(0, 35)}`, '#a78bfa');
            const ans = await askClaude(q, opts_text, type);
            const idx = parseInt(ans) || 0;
            (opts[idx] || opts[0])?.click();
            log(`  ✅ 選第${idx}項`, '#22c55e');
            await sleep(1500);

            // 送出
            const sub = [...document.querySelectorAll('button')]
                .find(b => /送出|提交|繳交/i.test(b.textContent));
            if (sub) { await sleep(800); sub.click(); log('  📤 送出！', '#22c55e'); await sleep(3000); break; }

            // 文字下一題
            const next = [...document.querySelectorAll('button')]
                .find(b => /下一|next/i.test(b.textContent));
            if (next) { next.click(); await sleep(2000); continue; }

            // 右側圓形箭頭
            const arrow = findRightArrow();
            if (arrow) { arrow.click(); await sleep(2000); continue; }

            log('  ⚠️ 找不到下一題', '#f59e0b'); break;
        }

        // 點「完成測驗」
        await sleep(1000);
        const doneBtn = [...document.querySelectorAll('button,a')]
            .find(b => /完成測驗/.test(b.textContent));
        if (doneBtn) { doneBtn.click(); log('  🏁 完成測驗', '#22c55e'); await sleep(2000); }

        // 若分數不足，重測
        await sleep(1000);
        const retestBtn = [...document.querySelectorAll('button,a')]
            .find(b => /重新測驗/.test(b.textContent));
        if (retestBtn) {
            log(`  ⚠️ 未達標，重測...`, '#f59e0b');
            retestBtn.click();
            await sleep(3000);
            await doQuiz(name);
        }
    }

    // ── 發表討論 ─────────────────────────────────
    async function postDiscussion() {
        log('💬 前往討論區...', '#60a5fa');
        setStatus('發表討論中...', '#60a5fa');

        // 點討論區 tab
        const discussTab = [...document.querySelectorAll('[role="tab"],.mat-tab-label,a')]
            .find(el => /討論/.test(el.textContent));
        if (!discussTab) { log('  ⚠️ 找不到討論區', '#f59e0b'); return; }
        discussTab.click();
        await sleep(2000);

        // 確認是否已發文（避免重複發）
        const myPosts = [...document.querySelectorAll('.board-subject-title, [class*="post-title"]')]
            .filter(el => el.closest('[class*="mine"], [class*="my-post"]'));
        if (myPosts.length > 0) {
            log('  ℹ️ 已有發文，跳過', '#64748b');
            return;
        }

        // 點「發表主題」
        const postBtn = [...document.querySelectorAll('button,a')]
            .find(b => /發表主題|新增討論/.test(b.textContent));
        if (!postBtn) { log('  ⚠️ 找不到發表按鈕', '#f59e0b'); return; }
        postBtn.click();
        await sleep(2000);

        // 填標題
        const titleInput = document.querySelector(
            'input[placeholder*="標題"], input[name*="title"], .title-input input'
        );
        if (titleInput) {
            titleInput.focus();
            titleInput.value = '課程心得';
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(500);
        }

        // 填內容
        const contentInput = document.querySelector(
            'textarea, [contenteditable="true"], .ql-editor, [class*="content"] textarea'
        );
        if (contentInput) {
            contentInput.focus();
            const text = '課程內容豐富，收穫良多，對相關知識有更深入的了解。';
            if (contentInput.tagName === 'TEXTAREA' || contentInput.tagName === 'INPUT') {
                contentInput.value = text;
                contentInput.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                contentInput.innerText = text;
                contentInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            await sleep(500);
        }

        // 送出
        const submitBtn = [...document.querySelectorAll('button')]
            .find(b => /送出|發表|提交|確認/.test(b.textContent) && !(/取消|關閉/.test(b.textContent)));
        if (submitBtn) {
            submitBtn.click();
            log('  ✅ 討論已發表！', '#22c55e');
            await sleep(2000);
        } else {
            log('  ⚠️ 找不到送出按鈕，請手動發表', '#f59e0b');
        }
    }

    // ── 主流程 ───────────────────────────────────
    log('▶ 開始執行 v5.1', '#4f8ef7');
    log('🛡️ 防閒置已啟動', '#22c55e');

    const groups = [...document.querySelectorAll('mat-expansion-panel-header')];
    if (!groups.length) {
        log('❌ 找不到群組，請確認已進入課程頁面', '#ef4444');
        setStatus('❌ 找不到群組', '#ef4444');
        return;
    }
    log(`📚 找到 ${groups.length} 個群組`);

    for (let g = 0; g < groups.length; g++) {
        if (stopped) break;

        const groupTitle = groups[g].innerText?.trim()?.substring(0, 25) || `群組${g+1}`;
        log(`\n📂 [${g+1}/${groups.length}] ${groupTitle}`, '#60a5fa');
        setStatus(`群組 ${g+1}/${groups.length}：${groupTitle}`, '#4f8ef7');
        lastActive = Date.now();

        // 展開群組
        const panel2 = groups[g].closest('mat-expansion-panel');
        if (!panel2?.classList.contains('mat-expanded')) {
            groups[g].click(); await sleep(1500);
        }

        // 取得子單元連結
        const links = [...(panel2?.querySelectorAll('a.syllabus__item-content') || [])];
        log(`  找到 ${links.length} 個單元`);

        for (let s = 0; s < links.length; s++) {
            if (stopped) break;

            const title = links[s].innerText?.trim()?.substring(0, 25) || `單元${s+1}`;
            log(`\n  📌 [${s+1}/${links.length}] ${title}`, '#60a5fa');
            setStatus(`${groupTitle} → ${title}`, '#4f8ef7');
            lastActive = Date.now();

            // 先掛監聽再點擊
            const recordDone = waitForRecord();
            links[s].click();
            await sleep(2000);

            log('  ⏳ 等待平台記錄...', '#475569');
            await recordDone;

            // 跑測驗
            await doQuiz(title);
            await sleep(2000);
        }
    }

    if (!stopped) {
        // 發表討論
        await postDiscussion();
        await sleep(2000);

        clearInterval(aliveTimer);
        setStatus('🎉 全部完成！', '#22c55e');
        setAlive('🔵 防閒置：已結束', '#60a5fa');
        log('\n🎉 全部完成！', '#22c55e');
        log('📋 請手動前往「我修的課」確認狀態', '#60a5fa');
        log('🔗 https://moocs.moe.edu.tw/moocs/#/my-course', '#4f8ef7');
    } else {
        clearInterval(aliveTimer);
        setStatus('已停止', '#ef4444');
    }
})();
