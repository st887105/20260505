// MOOCS v5.5 - 攔截平台請求判斷換頁時機 + 只跑測驗修正
(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let KEY = localStorage.getItem('moocs_claude_key');
    if (!KEY) {
        KEY = prompt('請輸入 Claude API Key：');
        if (!KEY) return;
        localStorage.setItem('moocs_claude_key', KEY);
    }

    document.getElementById('moocs-v55')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v55';
    panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:320px;z-index:999999;background:#13151f;color:#e2e8f0;border-radius:14px;font-family:monospace;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,.7);border:1px solid #2a2d3e;overflow:hidden';
    panel.innerHTML = `
        <div id="mv55-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;font-size:13px;color:#4f8ef7">🎓 MOOCS v5.5</span>
            <span id="mv55-close" style="cursor:pointer;opacity:.5;font-size:15px">✕</span>
        </div>
        <div id="mv55-status" style="padding:7px 16px;font-size:11px;color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">請選擇模式</div>
        <div id="mv55-timer" style="padding:4px 16px;font-size:10px;color:#22c55e;background:#0a0f0a;border-bottom:1px solid #1a1d27">⏳ 等待開始</div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv55-log" style="max-height:230px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:6px">
            <button id="mv55-full" style="flex:1;padding:8px;background:#1a3a1a;color:#22c55e;border:none;border-radius:7px;cursor:pointer;font-size:11px">▶ 完整執行</button>
            <button id="mv55-quiz" style="flex:1;padding:8px;background:#2a1a3a;color:#a78bfa;border:none;border-radius:7px;cursor:pointer;font-size:11px">📝 只跑測驗</button>
            <button id="mv55-stop" style="padding:8px 12px;background:#3d1a1a;color:#ef4444;border:none;border-radius:7px;cursor:pointer;font-size:11px">⏹</button>
            <button id="mv55-key" style="padding:8px 10px;background:#1a2a3d;color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">🔑</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false, running = false;
    document.getElementById('mv55-close').onclick = () => { stopped = true; panel.remove(); };
    document.getElementById('mv55-stop').onclick = () => { stopped = true; log('⏹ 已停止', '#f59e0b'); setStatus('已停止', '#ef4444'); };
    document.getElementById('mv55-key').onclick = () => { localStorage.removeItem('moocs_claude_key'); log('🔑 Key 已清除', '#f59e0b'); };
    document.getElementById('mv55-full').onclick = () => startMain(false);
    document.getElementById('mv55-quiz').onclick = () => startMain(true);

    let drag = false, ox, oy;
    document.getElementById('mv55-hdr').onmousedown = e => { drag = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop; };
    document.onmousemove = e => { if (!drag) return; panel.style.left = (e.clientX - ox) + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.top = (e.clientY - oy) + 'px'; };
    document.onmouseup = () => drag = false;

    function log(msg, color = '#94a3b8') {
        const el = document.getElementById('mv55-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8"><span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    function setStatus(msg, color = '#64748b') {
        const el = document.getElementById('mv55-status');
        if (el) { el.textContent = msg; el.style.color = color; }
    }
    function setTimer(msg, color = '#22c55e') {
        const el = document.getElementById('mv55-timer');
        if (el) { el.textContent = msg; el.style.color = color; }
    }

    // ── 防閒置 ───────────────────────────────────
    let lastActive = Date.now();
    const aliveTimer = setInterval(() => {
        if (stopped) { clearInterval(aliveTimer); return; }
        document.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true, clientX: Math.random() * window.innerWidth, clientY: Math.random() * window.innerHeight
        }));
    }, 90 * 1000);

    // ── 核心：攔截平台請求，等 200 OK 後才換頁 ──
    // 攔截策略：
    //   成功 (2xx)  → resolve('ok')
    //   400 Bad Req → 代表停留不足，等10秒再重試點擊
    //   timeout     → 90秒無請求，強制繼續
    function waitForReadingRecord(timeoutMs = 90000) {
        return new Promise(resolve => {
            let done = false;
            const origFetch = window.fetch;

            const timer = setTimeout(() => {
                if (!done) {
                    done = true; window.fetch = origFetch;
                    log('  ⚠️ 等待記錄逾時90秒，強制繼續', '#f59e0b');
                    resolve('timeout');
                }
            }, timeoutMs);

            window.fetch = async function (...args) {
                const url = args[0]?.toString() || '';
                const result = origFetch.apply(this, args);

                if (/add-course-reading-record/.test(url) && !done) {
                    try {
                        const res = await result;
                        if (res.ok) {
                            done = true; clearTimeout(timer); window.fetch = origFetch;
                            log('  ✅ 記錄成功 (2xx)', '#22c55e');
                            setTimeout(resolve, 500, 'ok');
                        } else if (res.status === 400) {
                            log(`  ⚠️ 400 Bad Request（停留不足），等15秒...`, '#f59e0b');
                            // 不 resolve，繼續等下次請求
                        } else {
                            log(`  ℹ️ 記錄回傳 ${res.status}`, '#94a3b8');
                        }
                        return res;
                    } catch (e) {
                        return result;
                    }
                }
                return result;
            };
        });
    }

    // ── 倒數顯示 ─────────────────────────────────
    function startCountdown(label, seconds) {
        let remain = seconds;
        const tid = setInterval(() => {
            if (stopped || remain <= 0) { clearInterval(tid); return; }
            setTimer(`⏱ ${label}：剩 ${remain--} 秒`, remain < 10 ? '#f59e0b' : '#22c55e');
        }, 1000);
        return tid;
    }

    // ── Claude API ───────────────────────────────
    async function askClaude(q, opts_text, type, retry = 0) {
        await sleep(1000);
        const isYN = type && type.includes('是非');
        const prompt = isYN
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
                body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: prompt }] })
            });
            if (res.status === 429) {
                const w = [20, 40, 80][retry] || 80;
                log(`  ⏳ 429限流，等${w}秒`, '#f59e0b');
                await sleep(w * 1000);
                return askClaude(q, opts_text, type, retry + 1);
            }
            const data = await res.json();
            if (!res.ok) { log(`  ❌ API ${res.status}`, '#ef4444'); return '0'; }
            return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0] || '0';
        } catch (e) { log('  ❌ ' + e.message, '#ef4444'); return '0'; }
    }

    function findRightArrow() {
        return [...document.querySelectorAll('button,[role="button"]')]
            .find(el => {
                const r = el.getBoundingClientRect();
                return r.right >= window.innerWidth - 300 && r.right <= window.innerWidth - 50
                    && r.top > 200 && r.top < window.innerHeight - 100
                    && r.width > 0 && r.width < 100;
            });
    }

    // ── 跑測驗 ───────────────────────────────────
    async function doQuiz(name, attempt = 1) {
        if (stopped) return false;
        if (attempt > 10) { log('  ❌ 超過10次重試', '#ef4444'); return false; }
        log(`  📝「${name}」第${attempt}次`, '#a78bfa');

        let enterBtn = null;
        for (let t = 0; t < 20; t++) {
            enterBtn = [...document.querySelectorAll('button,a')]
                .find(b => /進入測驗|開始測驗/.test(b.textContent?.trim()));
            if (enterBtn) break;
            await sleep(500);
        }
        if (!enterBtn) { log('  ℹ️ 無進入測驗按鈕', '#64748b'); return false; }

        enterBtn.click();
        await sleep(3000);

        let answered = 0;
        for (let i = 0; i < 60; i++) {
            if (stopped) return false;
            const qEl = document.querySelector('.question__title,.question-title,[class*="question__title"]');
            if (!qEl) { log(`  ✅ 題目結束（共${answered}題）`, '#22c55e'); break; }

            const q = qEl.innerText.trim();
            const type = document.querySelector('.quesiton__type-and-index,.question__type-and-index,[class*="type-and-index"]')?.innerText || '';
            const opts = document.querySelectorAll('moocs-question label,.question-wrap label,[class*="option"] label,fieldset label');

            if (!opts.length) { await sleep(1500); continue; }

            const opts_text = [...opts].map((o, i) => `${i}: ${o.innerText.trim()}`).join('\n');
            log(`  Q${i+1}: ${q.substring(0, 35)}`, '#a78bfa');
            const ans = await askClaude(q, opts_text, type);
            const idx = Math.min(parseInt(ans) || 0, opts.length - 1);
            opts[idx]?.click();
            log(`  → 選第${idx}項`, '#22c55e');
            answered++;
            await sleep(1000);

            const subBtn = [...document.querySelectorAll('button')]
                .find(b => /^(送出|提交|繳交)/.test(b.textContent?.trim()) && !b.disabled);
            if (subBtn) { await sleep(400); subBtn.click(); log('  📤 送出', '#22c55e'); await sleep(4000); break; }

            const nextBtn = [...document.querySelectorAll('button')].find(b => /下一題|下一/i.test(b.textContent));
            if (nextBtn) { nextBtn.click(); await sleep(2000); continue; }

            const arrow = findRightArrow();
            if (arrow) { arrow.click(); await sleep(2000); continue; }
            log('  ⚠️ 找不到下一題', '#f59e0b'); break;
        }

        await sleep(2000);
        const doneBtn = [...document.querySelectorAll('button,a')].find(b => /完成測驗/.test(b.textContent));
        if (doneBtn) { doneBtn.click(); await sleep(3000); }

        await sleep(2000);
        const retestBtn = [...document.querySelectorAll('button,a')].find(b => /重新測驗/.test(b.textContent));
        if (retestBtn) {
            log(`  ⚠️ 未達標，重測`, '#f59e0b');
            retestBtn.click(); await sleep(2000);
            return doQuiz(name, attempt + 1);
        }
        log('  🎉 通過！', '#22c55e');
        return true;
    }

    // ── 掃描並執行所有未測驗 ─────────────────────
    async function runAllPendingQuizzes() {
        log('\n🔍 掃描未測驗...', '#60a5fa');

        const courseTab = [...document.querySelectorAll('[role="tab"],.mat-tab-label')]
            .find(el => /課程簡介/.test(el.textContent));
        if (courseTab) { courseTab.click(); await sleep(1500); }

        // 展開所有群組
        for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
            const p = h.closest('mat-expansion-panel');
            if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(600); }
        }
        await sleep(1500);

        let round = 0;
        while (!stopped && round < 20) {
            round++;
            const quizBtns = [...document.querySelectorAll('button')]
                .filter(b => /未測驗/.test(b.textContent?.trim()));
            if (!quizBtns.length) { log('  ✅ 所有測驗完成！', '#22c55e'); break; }

            log(`\n🎯 第${round}輪：${quizBtns.length}個未測驗`, '#60a5fa');
            const btn = quizBtns[0];
            const groupName = btn.closest('mat-expansion-panel')
                ?.querySelector('mat-expansion-panel-header')
                ?.innerText?.trim()?.substring(0, 25) || `測驗${round}`;

            log(`  → ${groupName}`, '#60a5fa');
            setStatus(`測驗：${groupName}`, '#a78bfa');
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(500);
            btn.click();
            await sleep(2500);

            await doQuiz(groupName);
            await sleep(2000);
            if (courseTab) { courseTab.click(); await sleep(1500); }
        }
    }

    // ── 閱讀子單元（等平台成功記錄才換頁）───────
    async function processGroup(groupHeader, gIdx, total) {
        if (stopped) return;
        const groupTitle = groupHeader.innerText?.trim()?.substring(0, 25) || `群組${gIdx+1}`;
        log(`\n📂 [${gIdx+1}/${total}] ${groupTitle}`, '#60a5fa');
        setStatus(`閱讀 ${gIdx+1}/${total}：${groupTitle}`, '#4f8ef7');
        lastActive = Date.now();

        const panel2 = groupHeader.closest('mat-expansion-panel');
        if (!panel2?.classList.contains('mat-expanded')) { groupHeader.click(); await sleep(1500); }

        const links = [...(panel2?.querySelectorAll('a.syllabus__item-content') || [])];
        log(`  ${links.length} 個子單元`);

        for (let s = 0; s < links.length; s++) {
            if (stopped) return;
            const freshLinks = [...(panel2?.querySelectorAll('a.syllabus__item-content') || [])];
            const link = freshLinks[s];
            if (!link) continue;

            const title = link.innerText?.trim()?.substring(0, 25) || `子單元${s+1}`;
            log(`\n  📌 [${s+1}/${links.length}] ${title}`, '#60a5fa');
            setStatus(`${groupTitle} → ${title}`, '#4f8ef7');
            lastActive = Date.now();

            // 設定攔截，等平台確認成功記錄
            const recPromise = waitForReadingRecord(90000);

            // 點擊子單元
            link.click();
            await sleep(1500);

            // 開始倒數顯示（讓使用者知道在等）
            const cdTid = startCountdown(`等待 ${title.substring(0,10)}`, 90);

            const result = await recPromise;
            clearInterval(cdTid);

            if (result === 'ok') {
                setTimer(`✅ 記錄成功：${title.substring(0,15)}`, '#22c55e');
                await sleep(800);
            } else {
                setTimer(`⚠️ 逾時跳過：${title.substring(0,15)}`, '#f59e0b');
                await sleep(500);
            }
        }
    }

    // ── 發表討論 ─────────────────────────────────
    async function postDiscussion() {
        log('\n💬 討論區...', '#60a5fa');
        const tab = [...document.querySelectorAll('[role="tab"],.mat-tab-label,a')]
            .find(el => /討論/.test(el.textContent));
        if (!tab) { log('  ⚠️ 找不到討論tab', '#f59e0b'); return; }
        tab.click(); await sleep(2000);
        if (document.querySelector('[class*="my-post"],[class*="mine"],[class*="owner"]')) {
            log('  ℹ️ 已有發文', '#64748b'); return;
        }
        const postBtn = [...document.querySelectorAll('button,a')].find(b => /發表主題|新增討論/.test(b.textContent));
        if (!postBtn) { log('  ⚠️ 找不到發表按鈕', '#f59e0b'); return; }
        postBtn.click(); await sleep(2000);

        const titleInput = document.querySelector('input[placeholder*="標題"],input[name*="title"]');
        if (titleInput) { titleInput.focus(); titleInput.value = '課程心得分享'; titleInput.dispatchEvent(new Event('input', { bubbles: true })); await sleep(400); }

        const contentEl = document.querySelector('textarea,[contenteditable="true"],.ql-editor');
        if (contentEl) {
            contentEl.focus();
            const text = '這門課程內容豐富，涵蓋重要知識，對工作很有幫助，推薦給大家。';
            if (contentEl.tagName === 'TEXTAREA') { contentEl.value = text; } else { contentEl.innerText = text; }
            contentEl.dispatchEvent(new Event('input', { bubbles: true })); await sleep(400);
        }
        const submitBtn = [...document.querySelectorAll('button')].find(b => /送出|發表|提交|確認/.test(b.textContent) && !/取消|關閉/.test(b.textContent));
        if (submitBtn) { submitBtn.click(); log('  ✅ 討論已發表！', '#22c55e'); }
        else { log('  ⚠️ 找不到送出，請手動發表', '#f59e0b'); }
    }

    // ── 主流程 ───────────────────────────────────
    async function startMain(quizOnly) {
        if (running) { log('⚠️ 已在執行中', '#f59e0b'); return; }
        running = true; stopped = false;
        ['mv55-full', 'mv55-quiz'].forEach(id => document.getElementById(id).disabled = true);

        log(`\n▶ v5.5 開始（${quizOnly ? '只跑測驗' : '完整模式'}）`, '#4f8ef7');
        log('💡 攔截平台記錄請求，確認成功後才換頁', '#60a5fa');

        if (!quizOnly) {
            const groups = [...document.querySelectorAll('mat-expansion-panel-header')];
            if (!groups.length) {
                log('❌ 找不到群組，請確認已進入課程頁面', '#ef4444');
                setStatus('❌ 找不到群組', '#ef4444');
                running = false; return;
            }
            log(`📚 ${groups.length} 個群組`);
            for (let g = 0; g < groups.length; g++) {
                if (stopped) break;
                await processGroup(groups[g], g, groups.length);
            }
        }

        if (!stopped) await runAllPendingQuizzes();
        if (!stopped) {
            await postDiscussion();
            clearInterval(aliveTimer);
            setStatus('🎉 全部完成！', '#22c55e');
            setTimer('✅ 執行完畢', '#22c55e');
            log('\n🎉 完成！請至「我修的課」確認', '#22c55e');
        } else {
            clearInterval(aliveTimer);
            setStatus('已停止', '#ef4444');
        }

        running = false;
        ['mv55-full', 'mv55-quiz'].forEach(id => document.getElementById(id).disabled = false);
    }

    log('✅ v5.5 就緒，請選擇模式', '#4f8ef7');
    log('💡 閱讀已100% → 點「只跑測驗」', '#60a5fa');
    setStatus('請選擇模式', '#60a5fa');
})();
