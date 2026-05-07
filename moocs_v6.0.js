// MOOCS v6.0 - 完全重寫測驗入口：確認說明頁載入後點中央進入測驗按鈕
(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let KEY = localStorage.getItem('moocs_claude_key');
    if (!KEY) {
        KEY = prompt('請輸入 Claude API Key：');
        if (!KEY) return;
        localStorage.setItem('moocs_claude_key', KEY);
    }

    const DANGER = /退選|取消修課|leave course|刪除|登出|logout|取消報名/i;
    function safeEl(el) { return el && !DANGER.test(el.textContent || ''); }

    // ── 面板 ─────────────────────────────────────
    document.getElementById('moocs-v60')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v60';
    panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:340px;z-index:999999;background:#13151f;color:#e2e8f0;border-radius:14px;font-family:monospace;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,.7);border:1px solid #2a2d3e;overflow:hidden';
    panel.innerHTML = `
        <div id="mv60-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;font-size:13px;color:#4f8ef7">🎓 MOOCS v6.0 🛡️</span>
            <span id="mv60-close" style="cursor:pointer;opacity:.5">✕</span>
        </div>
        <div id="mv60-status" style="padding:7px 16px;font-size:11px;color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">請選擇模式</div>
        <div id="mv60-timer" style="padding:4px 16px;font-size:10px;color:#22c55e;background:#0a0f0a;border-bottom:1px solid #1a1d27">⏳ 等待開始</div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv60-log" style="max-height:240px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:6px">
            <button id="mv60-full" style="flex:1;padding:8px;background:#1a3a1a;color:#22c55e;border:none;border-radius:7px;cursor:pointer;font-size:11px">▶ 完整執行</button>
            <button id="mv60-quiz" style="flex:1;padding:8px;background:#2a1a3a;color:#a78bfa;border:none;border-radius:7px;cursor:pointer;font-size:11px">📝 只跑測驗</button>
            <button id="mv60-stop" style="padding:8px 10px;background:#3d1a1a;color:#ef4444;border:none;border-radius:7px;cursor:pointer;font-size:11px">⏹</button>
            <button id="mv60-key" style="padding:8px 8px;background:#1a2a3d;color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">🔑</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false, running = false;
    document.getElementById('mv60-close').onclick = () => { stopped = true; panel.remove(); };
    document.getElementById('mv60-stop').onclick = () => { stopped = true; log('⏹ 停止', '#f59e0b'); setStatus('已停止', '#ef4444'); };
    document.getElementById('mv60-key').onclick = () => { localStorage.removeItem('moocs_claude_key'); log('🔑 Key 清除', '#f59e0b'); };
    document.getElementById('mv60-full').onclick = () => startMain(false);
    document.getElementById('mv60-quiz').onclick = () => startMain(true);

    let drag = false, ox, oy;
    document.getElementById('mv60-hdr').onmousedown = e => { drag = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop; };
    document.onmousemove = e => { if (!drag) return; panel.style.left = (e.clientX - ox) + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.top = (e.clientY - oy) + 'px'; };
    document.onmouseup = () => drag = false;

    function log(msg, color = '#94a3b8') {
        const el = document.getElementById('mv60-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8"><span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    function setStatus(msg, c = '#64748b') { const e = document.getElementById('mv60-status'); if (e) { e.textContent = msg; e.style.color = c; } }
    function setTimer(msg, c = '#22c55e') { const e = document.getElementById('mv60-timer'); if (e) { e.textContent = msg; e.style.color = c; } }

    const aliveTimer = setInterval(() => {
        if (stopped) { clearInterval(aliveTimer); return; }
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: Math.random() * innerWidth, clientY: Math.random() * innerHeight }));
    }, 90000);

    function startCountdown(label, sec) {
        let r = sec;
        setTimer(`⏱ ${label}：${r}秒`, '#22c55e');
        const tid = setInterval(() => {
            if (stopped || r <= 0) { clearInterval(tid); return; }
            r--;
            setTimer(`⏱ ${label}：${r}秒`, r < 15 ? '#f59e0b' : '#22c55e');
        }, 1000);
        return tid;
    }

    // ── 等待記錄 API ─────────────────────────────
    function waitForReadingRecord(timeoutMs = 120000) {
        return new Promise(resolve => {
            let done = false;
            const orig = window.fetch;
            const timer = setTimeout(() => { if (!done) { done = true; window.fetch = orig; resolve('timeout'); } }, timeoutMs);
            window.fetch = async function (...args) {
                const url = args[0]?.toString() || '';
                const p = orig.apply(this, args);
                if (/add-course-reading-record/.test(url) && !done) {
                    try {
                        const res = await p; const clone = res.clone();
                        if (res.ok) { done = true; clearTimeout(timer); window.fetch = orig; setTimeout(resolve, 400, 'ok'); }
                        else if (res.status === 400) { log('  ⚠️ 400 繼續等', '#f59e0b'); }
                        return clone;
                    } catch(e) { return p; }
                }
                return p;
            };
        });
    }

    // ── Claude API ───────────────────────────────
    async function askClaude(q, opts_text, type, retry = 0) {
        await sleep(1000);
        const isYN = type?.includes('是非');
        const prompt = isYN
            ? `台灣教育訓練是非題，只回答0（正確）或1（錯誤），不要解釋：\n${q}`
            : `台灣教育訓練單選題，選最正確答案，只回答數字（從0開始），不要解釋：\n題目：${q}\n選項：\n${opts_text}`;
        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
                body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: prompt }] })
            });
            if (res.status === 429) { const w = [20,40,80][retry]||80; await sleep(w*1000); return askClaude(q, opts_text, type, retry+1); }
            const data = await res.json();
            return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0] || '0';
        } catch(e) { log('  ❌ '+e.message, '#ef4444'); return '0'; }
    }

    // ── 等待說明頁載入（偵測關鍵元素）──────────
    // 說明頁特徵：有「總題數」「通過標準」「進入測驗」大按鈕
    async function waitForQuizInfoPage(timeoutMs = 15000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const hasInfo = document.querySelector(
                // 說明頁的資訊區塊
                '[class*="quiz-info"],[class*="exam-info"],[class*="test-info"]'
            );
            // 或直接找「進入測驗」大按鈕
            const enterBtn = findEnterQuizBtn();
            // 或找包含「總題數」「通過標準」的文字
            const infoText = document.body.innerText;
            const hasQuizInfo = /總題數|通過標準|測驗時間/.test(infoText);

            if (enterBtn || hasQuizInfo) return true;
            await sleep(400);
        }
        return false;
    }

    // ── 找「進入測驗」大按鈕（說明頁中央）──────
    // 關鍵：這個按鈕在主內容區，不在側欄，通常是綠色大按鈕
    function findEnterQuizBtn() {
        const candidates = [...document.querySelectorAll('button,a,[role="button"]')]
            .filter(b => {
                if (!safeEl(b)) return false;
                if (b.offsetParent === null) return false;
                const txt = b.textContent?.trim() || '';
                // 完全比對或包含
                return txt === '進入測驗' || txt === '開始測驗' || txt === '進入' && /測驗/.test(b.closest('[class]')?.textContent || '');
            });

        if (candidates.length === 0) return null;

        // 優先選位置在頁面中央的（說明頁的大按鈕）
        // 排除側欄（x < 500）的按鈕
        const mainAreaBtns = candidates.filter(b => {
            const r = b.getBoundingClientRect();
            return r.left > 100 && r.left < window.innerWidth - 300 && r.width > 80;
        });

        return mainAreaBtns[0] || candidates[0];
    }

    // ── 等待題目出現 ─────────────────────────────
    async function waitForQuestion(timeoutMs = 12000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const q = document.querySelector('.question__title,.question-title,[class*="question__title"]');
            if (q && q.offsetParent !== null) return true;
            await sleep(400);
        }
        return false;
    }

    // ── 右側翻頁箭頭 ─────────────────────────────
    function findRightArrow() {
        return [...document.querySelectorAll('button,[role="button"]')]
            .find(el => {
                if (!safeEl(el)) return false;
                const r = el.getBoundingClientRect();
                return r.right >= innerWidth - 300 && r.right <= innerWidth - 50
                    && r.top > 200 && r.top < innerHeight - 100 && r.width > 0 && r.width < 100;
            });
    }

    // ══════════════════════════════════════════════
    // 測驗主流程
    // ══════════════════════════════════════════════
    async function doQuiz(name, attempt = 1) {
        if (stopped) return 'stopped';
        if (attempt > 5) { log(`  ❌ 超過5次，放棄`, '#ef4444'); return 'failed'; }

        log(`  📝「${name}」第${attempt}次`, '#a78bfa');
        setStatus(`測驗：${name}（${attempt}次）`, '#a78bfa');

        // ── 階段1：等說明頁並點「進入測驗」────────
        log('  ⏳ 等待說明頁...', '#475569');
        const hasInfoPage = await waitForQuizInfoPage(15000);

        if (!hasInfoPage) {
            // 可能直接進題目頁
            const hasQ = await waitForQuestion(5000);
            if (!hasQ) {
                log('  ℹ️ 說明頁和題目都沒出現，跳過', '#64748b');
                return 'no_quiz';
            }
            log('  ℹ️ 直接在題目頁（無說明頁）', '#64748b');
        } else {
            // 在說明頁，記錄資訊
            const infoText = document.body.innerText;
            const totalQ = infoText.match(/總題數[：:]\s*(\d+)/)?.[1] || '?';
            const passScore = infoText.match(/通過標準[：:]\s*(\d+)/)?.[1] || '?';
            log(`  ℹ️ 說明頁：共${totalQ}題，通過${passScore}分`, '#60a5fa');

            // 找並點進入測驗按鈕
            const enterBtn = findEnterQuizBtn();
            if (!enterBtn) {
                log('  ⚠️ 找不到進入測驗按鈕！印出所有按鈕：', '#f59e0b');
                [...document.querySelectorAll('button,a')].forEach(b => {
                    const txt = b.textContent?.trim();
                    if (txt) log(`    按鈕：「${txt.substring(0,20)}」`, '#475569');
                });
                return 'no_enter_btn';
            }

            log(`  ✅ 點「${enterBtn.textContent?.trim()}」`, '#22c55e');
            enterBtn.click();
            await sleep(3000);

            // 等題目出現
            const hasQ = await waitForQuestion(10000);
            if (!hasQ) {
                log('  ⚠️ 點進入後等題目逾時', '#f59e0b');
                // 不放棄，繼續往下跑
            }
        }

        // ── 階段2：答題迴圈 ──────────────────────
        let answered = 0;
        let noQCount = 0;

        for (let i = 0; i < 60; i++) {
            if (stopped) return 'stopped';

            const qEl = document.querySelector('.question__title,.question-title,[class*="question__title"]');
            if (!qEl || qEl.offsetParent === null) {
                noQCount++;
                if (noQCount >= 4) { log(`  ✅ 答完（共${answered}題）`, '#22c55e'); break; }
                await sleep(800);
                continue;
            }
            noQCount = 0;

            const q = qEl.innerText.trim();
            const type = document.querySelector('.quesiton__type-and-index,.question__type-and-index,[class*="type-and-index"]')?.innerText || '';
            const opts = [...document.querySelectorAll('moocs-question label,.question-wrap label,fieldset label')]
                .filter(o => o.offsetParent !== null);

            if (!opts.length) { await sleep(1200); continue; }

            const opts_text = opts.map((o, i) => `${i}: ${o.innerText.trim()}`).join('\n');
            log(`  Q${i+1}[${type.includes('是非') ? '是非' : '單選'}]: ${q.substring(0,40)}`, '#a78bfa');

            const ans = await askClaude(q, opts_text, type);
            const idx = Math.min(parseInt(ans)||0, opts.length-1);
            opts[idx]?.click();
            log(`  → 選${idx}：${opts[idx]?.innerText?.trim()?.substring(0,20)}`, '#22c55e');
            answered++;
            await sleep(1000);

            // 送出（最高優先）
            const subBtn = [...document.querySelectorAll('button')]
                .find(b => safeEl(b) && /^(送出|提交|繳交)$/.test(b.textContent?.trim()) && !b.disabled && b.offsetParent !== null);
            if (subBtn) { await sleep(400); subBtn.click(); log('  📤 送出', '#22c55e'); await sleep(4000); break; }

            // 下一題
            const nextBtn = [...document.querySelectorAll('button')]
                .find(b => safeEl(b) && /^下一題$|^下一$/.test(b.textContent?.trim()) && b.offsetParent !== null);
            if (nextBtn) { nextBtn.click(); await sleep(2000); continue; }

            // 右側箭頭
            const arrow = findRightArrow();
            if (arrow) { arrow.click(); await sleep(2000); continue; }

            await sleep(1500);
        }

        // ── 階段3：完成測驗 ──────────────────────
        await sleep(2000);
        const doneBtn = [...document.querySelectorAll('button,a')]
            .find(b => safeEl(b) && b.textContent?.trim() === '完成測驗' && b.offsetParent !== null);
        if (doneBtn) { doneBtn.click(); log('  📋 完成測驗', '#60a5fa'); await sleep(3000); }

        // ── 階段4：判斷通過 ──────────────────────
        await sleep(2000);
        const retestBtn = [...document.querySelectorAll('button,a')]
            .find(b => safeEl(b) && b.textContent?.trim() === '重新測驗' && b.offsetParent !== null);

        if (retestBtn) {
            // 讀分數
            const scoreText = document.body.innerText.match(/(\d+)\s*分/)?.[0] || '';
            log(`  ⚠️ 未達標（${scoreText}），第${attempt+1}次`, '#f59e0b');
            retestBtn.click();
            await sleep(2500);
            return doQuiz(name, attempt + 1);
        }

        log('  🎉 通過！', '#22c55e');
        return 'passed';
    }

    // ══════════════════════════════════════════════
    // 掃描所有群組測驗
    // ══════════════════════════════════════════════
    async function runAllPendingQuizzes() {
        log('\n🔍 掃描未測驗...', '#60a5fa');

        const goHome = async () => {
            const tab = [...document.querySelectorAll('[role="tab"],.mat-tab-label')]
                .find(el => /課程簡介/.test(el.textContent));
            if (tab) { tab.click(); await sleep(1500); }
            // 展開所有群組
            for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
                if (DANGER.test(h.textContent || '')) continue;
                const p = h.closest('mat-expansion-panel');
                if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(400); }
            }
            await sleep(800);
        };

        await goHome();

        const attempts = new Map();
        let round = 0;

        while (!stopped && round < 40) {
            round++;

            // 確認還在課程頁
            if (!location.href.includes('/learning/')) {
                log('⚠️ 頁面跑掉，停止', '#ef4444'); break;
            }

            const allPanels = [...document.querySelectorAll('mat-expansion-panel')];
            let foundAny = false;

            for (let gi = 0; gi < allPanels.length; gi++) {
                if (stopped) return;
                const p2 = allPanels[gi];
                const header = p2.querySelector('mat-expansion-panel-header');
                if (DANGER.test(header?.textContent || '')) continue;

                // 找「未測驗」按鈕（文字完全相符）
                const quizBtn = [...p2.querySelectorAll('button')]
                    .find(b => b.textContent?.trim() === '未測驗' && b.offsetParent !== null && safeEl(b));
                if (!quizBtn) continue;

                const groupName = header?.innerText?.trim()?.substring(0, 30) || `群組${gi}`;
                const key = `${gi}`;
                const cnt = attempts.get(key) || 0;
                if (cnt >= 3) { log(`  ⏭ 跳過「${groupName}」(已試${cnt}次)`, '#f59e0b'); continue; }

                foundAny = true;
                attempts.set(key, cnt + 1);

                log(`\n🎯 [群組${gi+1}]「${groupName}」(第${cnt+1}次)`, '#60a5fa');
                setStatus(`測驗：${groupName}`, '#a78bfa');

                quizBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(500);
                quizBtn.click();
                await sleep(3500); // 等說明頁載入

                const result = await doQuiz(groupName);
                log(`  結果：${result}`, result === 'passed' ? '#22c55e' : '#f59e0b');

                await sleep(1500);
                await goHome();
                break; // 每輪一個，重新掃描
            }

            if (!foundAny) { log('  ✅ 所有測驗完成！', '#22c55e'); break; }
        }
    }

    // ── 閱讀群組 ─────────────────────────────────
    async function processGroup(groupHeader, gIdx, total) {
        if (stopped) return;
        if (DANGER.test(groupHeader.textContent || '')) return;

        const groupTitle = groupHeader.innerText?.trim()?.substring(0, 25) || `群組${gIdx+1}`;
        log(`\n📂 [${gIdx+1}/${total}] ${groupTitle}`, '#60a5fa');
        setStatus(`閱讀 ${gIdx+1}/${total}：${groupTitle}`, '#4f8ef7');

        const p2 = groupHeader.closest('mat-expansion-panel');
        if (!p2?.classList.contains('mat-expanded')) { groupHeader.click(); await sleep(1500); }

        const links = [...(p2?.querySelectorAll('a.syllabus__item-content') || [])];
        log(`  ${links.length} 個子單元`);

        for (let s = 0; s < links.length; s++) {
            if (stopped) return;
            const fresh = [...(p2?.querySelectorAll('a.syllabus__item-content') || [])];
            const link = fresh[s];
            if (!link || DANGER.test(link.textContent || '')) continue;

            const title = link.innerText?.trim()?.substring(0, 25) || `子單元${s+1}`;
            log(`\n  📌 [${s+1}/${links.length}] ${title}`, '#60a5fa');
            setStatus(`${groupTitle} → ${title}`, '#4f8ef7');

            const isPDF = /pdf|\.pdf|fa-file-pdf/i.test(link.outerHTML + (link.closest('li')?.innerHTML || ''));
            if (isPDF) {
                log(`  📄 PDF，等60秒`, '#60a5fa');
                link.click();
                const tid = startCountdown(`PDF`, 60);
                await sleep(60000);
                clearInterval(tid);
            } else {
                const rec = waitForReadingRecord(120000);
                link.click();
                await sleep(1500);
                const tid = startCountdown('等記錄', 120);
                const r = await rec;
                clearInterval(tid);
                if (r === 'ok') { setTimer('✅ 記錄成功', '#22c55e'); }
                else { log('  ⚠️ 逾時補等20秒', '#f59e0b'); const t2 = startCountdown('補等', 20); await sleep(20000); clearInterval(t2); }
            }
            await sleep(600);
        }
    }

    // ── 主流程 ───────────────────────────────────
    async function startMain(quizOnly) {
        if (running) { log('⚠️ 執行中', '#f59e0b'); return; }
        running = true; stopped = false;
        ['mv60-full','mv60-quiz'].forEach(id => { const e = document.getElementById(id); if(e) e.disabled=true; });

        log(`\n▶ v6.0（${quizOnly ? '只跑測驗' : '完整'}）`, '#4f8ef7');
        log('🛡️ 黑名單：退選/取消修課/登出 已封鎖', '#22c55e');
        log('💡 說明頁偵測：找頁面中央綠色進入測驗按鈕', '#60a5fa');

        if (!quizOnly) {
            const groups = [...document.querySelectorAll('mat-expansion-panel-header')];
            if (!groups.length) { log('❌ 找不到群組', '#ef4444'); running=false; return; }
            log(`📚 ${groups.length} 個群組`);
            for (let g = 0; g < groups.length; g++) {
                if (stopped) break;
                await processGroup(groups[g], g, groups.length);
            }
        }

        if (!stopped) await runAllPendingQuizzes();

        if (!stopped) {
            clearInterval(aliveTimer);
            setStatus('🎉 完成！', '#22c55e');
            setTimer('✅ 完畢', '#22c55e');
            log('\n🎉 完成！', '#22c55e');
            log('💬 請手動發表討論', '#60a5fa');
            log('📋 請至「我修的課」確認', '#60a5fa');
        } else {
            clearInterval(aliveTimer);
            setStatus('已停止', '#ef4444');
        }
        running = false;
        ['mv60-full','mv60-quiz'].forEach(id => { const e = document.getElementById(id); if(e) e.disabled=false; });
    }

    log('✅ v6.0 就緒', '#4f8ef7');
    log('💡 閱讀100% → 點「只跑測驗」', '#60a5fa');
    setStatus('請選擇模式', '#60a5fa');
})();
