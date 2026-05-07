// MOOCS v5.7 - 修正測驗無限循環 + 說明頁處理 + 空白頁偵測
(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let KEY = localStorage.getItem('moocs_claude_key');
    if (!KEY) {
        KEY = prompt('請輸入 Claude API Key：');
        if (!KEY) return;
        localStorage.setItem('moocs_claude_key', KEY);
    }

    document.getElementById('moocs-v57')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v57';
    panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:330px;z-index:999999;background:#13151f;color:#e2e8f0;border-radius:14px;font-family:monospace;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,.7);border:1px solid #2a2d3e;overflow:hidden';
    panel.innerHTML = `
        <div id="mv57-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;font-size:13px;color:#4f8ef7">🎓 MOOCS v5.7</span>
            <span id="mv57-close" style="cursor:pointer;opacity:.5;font-size:15px">✕</span>
        </div>
        <div id="mv57-status" style="padding:7px 16px;font-size:11px;color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">請選擇模式</div>
        <div id="mv57-timer" style="padding:4px 16px;font-size:10px;color:#22c55e;background:#0a0f0a;border-bottom:1px solid #1a1d27">⏳ 等待開始</div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv57-log" style="max-height:230px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:6px">
            <button id="mv57-full" style="flex:1;padding:8px;background:#1a3a1a;color:#22c55e;border:none;border-radius:7px;cursor:pointer;font-size:11px">▶ 完整執行</button>
            <button id="mv57-quiz" style="flex:1;padding:8px;background:#2a1a3a;color:#a78bfa;border:none;border-radius:7px;cursor:pointer;font-size:11px">📝 只跑測驗</button>
            <button id="mv57-stop" style="padding:8px 10px;background:#3d1a1a;color:#ef4444;border:none;border-radius:7px;cursor:pointer;font-size:11px">⏹</button>
            <button id="mv57-key" style="padding:8px 8px;background:#1a2a3d;color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">🔑</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false, running = false;
    document.getElementById('mv57-close').onclick = () => { stopped = true; panel.remove(); };
    document.getElementById('mv57-stop').onclick = () => { stopped = true; log('⏹ 已停止', '#f59e0b'); setStatus('已停止', '#ef4444'); };
    document.getElementById('mv57-key').onclick = () => { localStorage.removeItem('moocs_claude_key'); log('🔑 Key 已清除', '#f59e0b'); };
    document.getElementById('mv57-full').onclick = () => startMain(false);
    document.getElementById('mv57-quiz').onclick = () => startMain(true);

    let drag = false, ox, oy;
    document.getElementById('mv57-hdr').onmousedown = e => { drag = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop; };
    document.onmousemove = e => { if (!drag) return; panel.style.left = (e.clientX - ox) + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.top = (e.clientY - oy) + 'px'; };
    document.onmouseup = () => drag = false;

    function log(msg, color = '#94a3b8') {
        const el = document.getElementById('mv57-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8"><span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    function setStatus(msg, color = '#64748b') { const el = document.getElementById('mv57-status'); if (el) { el.textContent = msg; el.style.color = color; } }
    function setTimer(msg, color = '#22c55e') { const el = document.getElementById('mv57-timer'); if (el) { el.textContent = msg; el.style.color = color; } }

    // 防閒置
    const aliveTimer = setInterval(() => {
        if (stopped) { clearInterval(aliveTimer); return; }
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: Math.random() * window.innerWidth, clientY: Math.random() * window.innerHeight }));
    }, 90 * 1000);

    // 倒數
    function startCountdown(label, seconds) {
        let r = seconds;
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
            const origFetch = window.fetch;
            const timer = setTimeout(() => {
                if (!done) { done = true; window.fetch = origFetch; resolve('timeout'); }
            }, timeoutMs);
            window.fetch = async function (...args) {
                const url = args[0]?.toString() || '';
                const promise = origFetch.apply(this, args);
                if (/add-course-reading-record/.test(url) && !done) {
                    try {
                        const res = await promise;
                        const clone = res.clone();
                        if (res.ok) {
                            done = true; clearTimeout(timer); window.fetch = origFetch;
                            setTimeout(resolve, 400, 'ok');
                        } else if (res.status === 400) {
                            log('  ⚠️ 400 停留不足，繼續等...', '#f59e0b');
                        }
                        return clone;
                    } catch (e) { return promise; }
                }
                return promise;
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
            if (res.status === 429) {
                const w = [20, 40, 80][retry] || 80;
                log(`  ⏳ 429，等${w}秒`, '#f59e0b');
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
                    && r.top > 200 && r.top < window.innerHeight - 100 && r.width > 0 && r.width < 100;
            });
    }

    // ── 等待頁面有內容（防空白頁）───────────────
    async function waitForPageContent(timeoutMs = 15000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const hasContent = document.querySelector(
                '.question__title,.question-title,moocs-question,.quiz-content,[class*="question"],' +
                'youtube-player,video,.content-body,.article-content,pdf-viewer,ng2-pdf-viewer'
            );
            if (hasContent) return true;
            await sleep(500);
        }
        return false;
    }

    // ── 測驗核心：進入說明頁 → 進入測驗 → 答題 ─
    async function doQuiz(name, attempt = 1) {
        if (stopped) return 'stopped';
        if (attempt > 8) { log(`  ❌ 超過8次重試，跳過`, '#ef4444'); return 'failed'; }

        log(`  📝「${name}」第${attempt}次`, '#a78bfa');
        setStatus(`測驗：${name}（第${attempt}次）`, '#a78bfa');

        // ── 步驟1：在測驗說明頁找「進入測驗」──
        // 說明頁通常有分數標準、注意事項，需要捲動才看得到按鈕
        let enterBtn = null;
        for (let t = 0; t < 30; t++) {
            // 嘗試捲動找按鈕
            window.scrollBy(0, 100);
            enterBtn = [...document.querySelectorAll('button,a,[role="button"]')]
                .find(b => {
                    const txt = b.textContent?.trim() || '';
                    return /進入測驗|開始測驗|Start Quiz/i.test(txt) && b.offsetParent !== null;
                });
            if (enterBtn) break;
            await sleep(400);
        }

        if (!enterBtn) {
            log(`  ⚠️ 找不到「進入測驗」按鈕，嘗試直接找題目`, '#f59e0b');
            // 有時候直接跳到測驗頁，沒有說明頁
            const directQ = document.querySelector('.question__title,.question-title');
            if (!directQ) {
                log(`  ❌ 也找不到題目，跳過此測驗`, '#ef4444');
                return 'no_quiz';
            }
        } else {
            log(`  ✅ 找到進入測驗按鈕，點擊`, '#22c55e');
            enterBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(500);
            enterBtn.click();
            await sleep(3000);

            // 等題目出現
            const hasQ = await waitForPageContent(10000);
            if (!hasQ) {
                log(`  ⚠️ 等待題目逾時`, '#f59e0b');
            }
        }

        // ── 步驟2：答題迴圈 ──────────────────────
        let answered = 0;
        let noQuestionCount = 0;

        for (let i = 0; i < 60; i++) {
            if (stopped) return 'stopped';

            const qEl = document.querySelector(
                '.question__title,.question-title,moocs-question .title,[class*="question__title"]'
            );

            if (!qEl) {
                noQuestionCount++;
                if (noQuestionCount >= 3) {
                    log(`  ✅ 題目結束（共${answered}題）`, '#22c55e');
                    break;
                }
                await sleep(1000);
                continue;
            }
            noQuestionCount = 0;

            const q = qEl.innerText.trim();
            const type = document.querySelector(
                '.quesiton__type-and-index,.question__type-and-index,[class*="type-and-index"]'
            )?.innerText || '';

            const opts = [...document.querySelectorAll(
                'moocs-question label,.question-wrap label,[class*="option"] label,fieldset label'
            )].filter(o => o.offsetParent !== null); // 只選可見的

            if (!opts.length) {
                log(`  ⚠️ Q${i+1} 無可見選項，等待`, '#f59e0b');
                await sleep(1500);
                continue;
            }

            const opts_text = opts.map((o, i) => `${i}: ${o.innerText.trim()}`).join('\n');
            log(`  Q${i+1}: ${q.substring(0, 40)}`, '#a78bfa');

            const ans = await askClaude(q, opts_text, type);
            const idx = Math.min(parseInt(ans) || 0, opts.length - 1);
            opts[idx]?.click();
            log(`  → 選${idx}：${opts[idx]?.innerText?.trim()?.substring(0, 20)}`, '#22c55e');
            answered++;
            await sleep(1200);

            // 找送出
            const subBtn = [...document.querySelectorAll('button')]
                .find(b => /^(送出|提交|繳交|Submit)/i.test(b.textContent?.trim()) && !b.disabled && b.offsetParent !== null);
            if (subBtn) {
                await sleep(500);
                subBtn.click();
                log('  📤 送出！', '#22c55e');
                await sleep(4000);
                break;
            }

            // 找下一題
            const nextBtn = [...document.querySelectorAll('button')]
                .find(b => /下一題|下一|Next/i.test(b.textContent?.trim()) && b.offsetParent !== null);
            if (nextBtn) { nextBtn.click(); await sleep(2000); continue; }

            const arrow = findRightArrow();
            if (arrow) { arrow.click(); await sleep(2000); continue; }

            // 都找不到但有選項存在，可能是最後一題直接送出
            log('  ⚠️ 找不到下一題/送出，等待', '#f59e0b');
            await sleep(2000);
        }

        // ── 步驟3：完成測驗 ──────────────────────
        await sleep(2000);
        const doneBtn = [...document.querySelectorAll('button,a')]
            .find(b => /完成測驗/.test(b.textContent) && b.offsetParent !== null);
        if (doneBtn) {
            log('  📋 點完成測驗', '#60a5fa');
            doneBtn.click();
            await sleep(3000);
        }

        // ── 步驟4：判斷通過/未通過 ───────────────
        await sleep(2000);

        // 找重新測驗按鈕
        const retestBtn = [...document.querySelectorAll('button,a')]
            .find(b => /重新測驗/.test(b.textContent) && b.offsetParent !== null);

        if (retestBtn) {
            log(`  ⚠️ 未達標，第${attempt+1}次重測`, '#f59e0b');
            retestBtn.click();
            await sleep(2500);
            return doQuiz(name, attempt + 1);
        }

        // 找通過標誌
        const passSign = document.querySelector('[class*="pass"],[class*="success"],[class*="complete"]');
        const pageText = document.body.innerText;
        if (/通過|Pass|合格/.test(pageText)) {
            log('  🎉 通過！', '#22c55e');
            return 'passed';
        }

        log('  ✅ 測驗完成（未偵測到重測按鈕）', '#22c55e');
        return 'passed';
    }

    // ── 掃描並執行所有未測驗 ─────────────────────
    // 關鍵修正：用群組索引追蹤，避免重複點同一個
    async function runAllPendingQuizzes() {
        log('\n🔍 掃描未測驗...', '#60a5fa');

        const courseTab = [...document.querySelectorAll('[role="tab"],.mat-tab-label')]
            .find(el => /課程簡介/.test(el.textContent));
        if (courseTab) { courseTab.click(); await sleep(1500); }

        // 展開所有群組
        const allHeaders = [...document.querySelectorAll('mat-expansion-panel-header')];
        for (const h of allHeaders) {
            const p = h.closest('mat-expansion-panel');
            if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(600); }
        }
        await sleep(1500);

        // 收集所有「未測驗」按鈕的群組索引（避免重複）
        const processedGroups = new Set();
        let maxRounds = 30;

        while (!stopped && maxRounds-- > 0) {
            // 重新掃描（每次都重新找，DOM 可能更新）
            const allPanels = [...document.querySelectorAll('mat-expansion-panel')];
            let foundAny = false;

            for (let gi = 0; gi < allPanels.length; gi++) {
                if (stopped) return;

                const panel2 = allPanels[gi];
                const quizBtn = [...panel2.querySelectorAll('button')]
                    .find(b => /未測驗/.test(b.textContent?.trim()));

                if (!quizBtn) continue;

                // 取得群組名稱作為唯一識別
                const groupName = panel2.querySelector('mat-expansion-panel-header')
                    ?.innerText?.trim()?.substring(0, 30) || `群組${gi}`;

                // 已處理過且仍顯示未測驗 → 可能真的失敗，跳過避免無限循環
                const attemptKey = `${gi}_${groupName}`;
                const attemptCount = processedGroups.get ? (processedGroups.get(attemptKey) || 0) : 0;

                // 改用 Map 追蹤次數
                if (!runAllPendingQuizzes._attempts) runAllPendingQuizzes._attempts = new Map();
                const cnt = runAllPendingQuizzes._attempts.get(attemptKey) || 0;

                if (cnt >= 3) {
                    log(`  ⚠️ 群組「${groupName}」已嘗試${cnt}次，跳過`, '#f59e0b');
                    continue;
                }

                foundAny = true;
                runAllPendingQuizzes._attempts.set(attemptKey, cnt + 1);

                log(`\n🎯 群組[${gi+1}]「${groupName}」（第${cnt+1}次嘗試）`, '#60a5fa');
                setStatus(`測驗：${groupName}`, '#a78bfa');

                quizBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(600);
                quizBtn.click();
                await sleep(3000);

                // 等頁面有內容
                await waitForPageContent(8000);

                const result = await doQuiz(groupName);
                log(`  結果：${result}`, result === 'passed' ? '#22c55e' : '#f59e0b');

                await sleep(2000);

                // 回課程簡介
                const tab = [...document.querySelectorAll('[role="tab"],.mat-tab-label')]
                    .find(el => /課程簡介/.test(el.textContent));
                if (tab) { tab.click(); await sleep(1500); }

                // 重新展開所有群組
                for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
                    const p = h.closest('mat-expansion-panel');
                    if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(400); }
                }
                await sleep(1000);
                break; // 每輪只處理一個，然後重新掃描
            }

            if (!foundAny) {
                log('  ✅ 所有測驗完成！', '#22c55e');
                break;
            }
        }
    }

    // ── 閱讀群組 ─────────────────────────────────
    async function processGroup(groupHeader, gIdx, total) {
        if (stopped) return;
        const groupTitle = groupHeader.innerText?.trim()?.substring(0, 25) || `群組${gIdx+1}`;
        log(`\n📂 [${gIdx+1}/${total}] ${groupTitle}`, '#60a5fa');
        setStatus(`閱讀 ${gIdx+1}/${total}：${groupTitle}`, '#4f8ef7');

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

            // 偵測 PDF
            const linkHTML = link.outerHTML + (link.closest('li')?.innerHTML || '');
            const isPDF = /pdf|PDF|\.pdf|fa-file-pdf/i.test(linkHTML);

            if (isPDF) {
                log(`  📄 PDF，固定等60秒`, '#60a5fa');
                link.click();
                const tid = startCountdown(`PDF ${title.substring(0,10)}`, 60);
                await sleep(60000);
                clearInterval(tid);
            } else {
                const recPromise = waitForReadingRecord(120000);
                link.click();
                await sleep(1500);
                const tid = startCountdown(`等記錄 ${title.substring(0,8)}`, 120);
                const result = await recPromise;
                clearInterval(tid);
                if (result === 'ok') {
                    setTimer(`✅ 記錄成功`, '#22c55e');
                } else {
                    log(`  ⚠️ 逾時，補等20秒`, '#f59e0b');
                    const tid2 = startCountdown('補等', 20);
                    await sleep(20000);
                    clearInterval(tid2);
                }
            }
            await sleep(800);
        }
    }

    // ── 發表討論 ─────────────────────────────────
    async function postDiscussion() {
        log('\n💬 討論區...', '#60a5fa');
        const tab = [...document.querySelectorAll('[role="tab"],.mat-tab-label,a')].find(el => /討論/.test(el.textContent));
        if (!tab) { log('  ⚠️ 無討論tab', '#f59e0b'); return; }
        tab.click(); await sleep(2000);

        if (document.querySelector('[class*="my-post"],[class*="mine"],[class*="owner"]')) { log('  ℹ️ 已有發文', '#64748b'); return; }

        const postBtn = [...document.querySelectorAll('button,a')].find(b => /發表主題|新增討論/.test(b.textContent));
        if (!postBtn) { log('  ⚠️ 找不到發表按鈕', '#f59e0b'); return; }
        postBtn.click(); await sleep(2000);

        const titleInput = document.querySelector('input[placeholder*="標題"],input[name*="title"]');
        if (titleInput) { titleInput.focus(); titleInput.value = '課程心得分享'; titleInput.dispatchEvent(new Event('input', { bubbles: true })); await sleep(400); }

        const contentEl = document.querySelector('textarea,[contenteditable="true"],.ql-editor');
        if (contentEl) {
            contentEl.focus();
            const text = '這門課程內容豐富，涵蓋重要知識，對工作很有幫助，推薦給大家。';
            contentEl.tagName === 'TEXTAREA' ? (contentEl.value = text) : (contentEl.innerText = text);
            contentEl.dispatchEvent(new Event('input', { bubbles: true })); await sleep(400);
        }
        const submitBtn = [...document.querySelectorAll('button')].find(b => /送出|發表|提交|確認/.test(b.textContent) && !/取消|關閉/.test(b.textContent));
        if (submitBtn) { submitBtn.click(); log('  ✅ 討論已發表！', '#22c55e'); }
        else { log('  ⚠️ 找不到送出，請手動', '#f59e0b'); }
    }

    // ── 主流程 ───────────────────────────────────
    async function startMain(quizOnly) {
        if (running) { log('⚠️ 已在執行中', '#f59e0b'); return; }
        running = true; stopped = false;
        runAllPendingQuizzes._attempts = new Map(); // 重置嘗試計數
        ['mv57-full', 'mv57-quiz'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });

        log(`\n▶ v5.7（${quizOnly ? '只跑測驗' : '完整模式'}）`, '#4f8ef7');
        log('💡 測驗：每個群組最多嘗試3次，避免無限循環', '#60a5fa');

        if (!quizOnly) {
            const groups = [...document.querySelectorAll('mat-expansion-panel-header')];
            if (!groups.length) { log('❌ 找不到群組', '#ef4444'); setStatus('❌', '#ef4444'); running = false; return; }
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
        ['mv57-full', 'mv57-quiz'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
    }

    log('✅ v5.7 就緒', '#4f8ef7');
    log('💡 閱讀已100% → 點「只跑測驗」', '#60a5fa');
    setStatus('請選擇模式', '#60a5fa');
})();
