// MOOCS v5.8 - 安全版：防誤觸退選 + 保守點擊策略
(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let KEY = localStorage.getItem('moocs_claude_key');
    if (!KEY) {
        KEY = prompt('請輸入 Claude API Key：');
        if (!KEY) return;
        localStorage.setItem('moocs_claude_key', KEY);
    }

    // ══════════════════════════════════════════
    // 危險按鈕黑名單：絕對不能點
    // ══════════════════════════════════════════
    const DANGER_PATTERNS = /退選|取消修課|leave|刪除|delete|登出|logout|取消報名/i;

    function isSafeToClick(el) {
        if (!el) return false;
        const txt = (el.textContent || el.innerText || el.value || '').trim();
        const html = el.outerHTML || '';
        if (DANGER_PATTERNS.test(txt) || DANGER_PATTERNS.test(html)) {
            log(`🚨 阻止危險點擊：${txt.substring(0, 30)}`, '#ef4444');
            return false;
        }
        return true;
    }

    function safeClick(el) {
        if (!isSafeToClick(el)) return false;
        el.click();
        return true;
    }

    // ══════════════════════════════════════════════
    // 面板
    // ══════════════════════════════════════════════
    document.getElementById('moocs-v58')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v58';
    panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:330px;z-index:999999;background:#13151f;color:#e2e8f0;border-radius:14px;font-family:monospace;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,.7);border:1px solid #2a2d3e;overflow:hidden';
    panel.innerHTML = `
        <div id="mv58-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;font-size:13px;color:#4f8ef7">🎓 MOOCS v5.8 🛡️</span>
            <span id="mv58-close" style="cursor:pointer;opacity:.5;font-size:15px">✕</span>
        </div>
        <div id="mv58-status" style="padding:7px 16px;font-size:11px;color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">請選擇模式</div>
        <div id="mv58-timer" style="padding:4px 16px;font-size:10px;color:#22c55e;background:#0a0f0a;border-bottom:1px solid #1a1d27">⏳ 等待開始</div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv58-log" style="max-height:230px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:6px">
            <button id="mv58-full" style="flex:1;padding:8px;background:#1a3a1a;color:#22c55e;border:none;border-radius:7px;cursor:pointer;font-size:11px">▶ 完整執行</button>
            <button id="mv58-quiz" style="flex:1;padding:8px;background:#2a1a3a;color:#a78bfa;border:none;border-radius:7px;cursor:pointer;font-size:11px">📝 只跑測驗</button>
            <button id="mv58-stop" style="padding:8px 10px;background:#3d1a1a;color:#ef4444;border:none;border-radius:7px;cursor:pointer;font-size:11px">⏹</button>
            <button id="mv58-key" style="padding:8px 8px;background:#1a2a3d;color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">🔑</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false, running = false;
    document.getElementById('mv58-close').onclick = () => { stopped = true; panel.remove(); };
    document.getElementById('mv58-stop').onclick = () => { stopped = true; log('⏹ 已停止', '#f59e0b'); setStatus('已停止', '#ef4444'); };
    document.getElementById('mv58-key').onclick = () => { localStorage.removeItem('moocs_claude_key'); log('🔑 Key 已清除', '#f59e0b'); };
    document.getElementById('mv58-full').onclick = () => startMain(false);
    document.getElementById('mv58-quiz').onclick = () => startMain(true);

    let drag = false, ox, oy;
    document.getElementById('mv58-hdr').onmousedown = e => { drag = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop; };
    document.onmousemove = e => { if (!drag) return; panel.style.left = (e.clientX - ox) + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.top = (e.clientY - oy) + 'px'; };
    document.onmouseup = () => drag = false;

    function log(msg, color = '#94a3b8') {
        const el = document.getElementById('mv58-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8"><span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    function setStatus(msg, color = '#64748b') { const el = document.getElementById('mv58-status'); if (el) { el.textContent = msg; el.style.color = color; } }
    function setTimer(msg, color = '#22c55e') { const el = document.getElementById('mv58-timer'); if (el) { el.textContent = msg; el.style.color = color; } }

    const aliveTimer = setInterval(() => {
        if (stopped) { clearInterval(aliveTimer); return; }
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: Math.random() * window.innerWidth, clientY: Math.random() * window.innerHeight }));
    }, 90 * 1000);

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

    // ══════════════════════════════════════════
    // 確認目前在課程頁面（防止誤操作後繼續）
    // ══════════════════════════════════════════
    function isOnCoursePage() {
        return location.href.includes('/learning/') || location.href.includes('/course/');
    }

    async function ensureOnCoursePage(courseUrl) {
        if (!isOnCoursePage()) {
            log('⚠️ 頁面跑掉了！嘗試返回課程...', '#ef4444');
            location.href = courseUrl;
            await sleep(5000);
            return isOnCoursePage();
        }
        return true;
    }

    // ══════════════════════════════════════════
    // 等待記錄 API
    // ══════════════════════════════════════════
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
                            log('  ⚠️ 400 停留不足，繼續等', '#f59e0b');
                        }
                        return clone;
                    } catch (e) { return promise; }
                }
                return promise;
            };
        });
    }

    // ══════════════════════════════════════════
    // Claude API
    // ══════════════════════════════════════════
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

    // ══════════════════════════════════════════
    // 安全找按鈕（排除危險文字）
    // ══════════════════════════════════════════
    function findSafeButton(patterns) {
        return [...document.querySelectorAll('button,a,[role="button"]')]
            .find(b => {
                const txt = b.textContent?.trim() || '';
                const isTarget = patterns.some(p => (typeof p === 'string' ? txt.includes(p) : p.test(txt)));
                const isDanger = DANGER_PATTERNS.test(txt);
                const isVisible = b.offsetParent !== null;
                return isTarget && !isDanger && isVisible;
            });
    }

    function findRightArrow() {
        return [...document.querySelectorAll('button,[role="button"]')]
            .find(el => {
                if (DANGER_PATTERNS.test(el.textContent || '')) return false;
                const r = el.getBoundingClientRect();
                return r.right >= window.innerWidth - 300 && r.right <= window.innerWidth - 50
                    && r.top > 200 && r.top < window.innerHeight - 100 && r.width > 0 && r.width < 100;
            });
    }

    // ══════════════════════════════════════════
    // 測驗流程
    // ══════════════════════════════════════════
    async function doQuiz(name, attempt = 1) {
        if (stopped) return 'stopped';
        if (attempt > 5) { log(`  ❌ 超過5次，跳過`, '#ef4444'); return 'failed'; }

        log(`  📝「${name}」第${attempt}次`, '#a78bfa');
        setStatus(`測驗：${name}（${attempt}次）`, '#a78bfa');

        // 等「進入測驗」按鈕，嚴格比對文字
        let enterBtn = null;
        for (let t = 0; t < 20; t++) {
            enterBtn = findSafeButton([/^進入測驗$/, /^開始測驗$/]);
            if (enterBtn) break;
            await sleep(600);
        }

        if (enterBtn) {
            log(`  ✅ 點擊進入測驗`, '#22c55e');
            safeClick(enterBtn);
            await sleep(3000);
        } else {
            // 檢查是否已在題目頁
            const directQ = document.querySelector('.question__title,.question-title');
            if (!directQ) { log(`  ℹ️ 無測驗按鈕也無題目，跳過`, '#64748b'); return 'no_quiz'; }
            log(`  ℹ️ 直接在題目頁`, '#64748b');
        }

        // 答題
        let answered = 0;
        let emptyRounds = 0;
        for (let i = 0; i < 50; i++) {
            if (stopped) return 'stopped';

            const qEl = document.querySelector('.question__title,.question-title,[class*="question__title"]');
            if (!qEl) {
                emptyRounds++;
                if (emptyRounds >= 4) { log(`  ✅ 題目結束（${answered}題）`, '#22c55e'); break; }
                await sleep(800);
                continue;
            }
            emptyRounds = 0;

            const q = qEl.innerText.trim();
            const type = document.querySelector('.quesiton__type-and-index,.question__type-and-index,[class*="type-and-index"]')?.innerText || '';
            const opts = [...document.querySelectorAll('moocs-question label,.question-wrap label,fieldset label')]
                .filter(o => o.offsetParent !== null);

            if (!opts.length) { await sleep(1200); continue; }

            const opts_text = opts.map((o, i) => `${i}: ${o.innerText.trim()}`).join('\n');
            log(`  Q${i+1}: ${q.substring(0, 40)}`, '#a78bfa');
            const ans = await askClaude(q, opts_text, type);
            const idx = Math.min(parseInt(ans) || 0, opts.length - 1);
            opts[idx]?.click();
            log(`  → 選${idx}`, '#22c55e');
            answered++;
            await sleep(1000);

            // 送出（嚴格比對，排除危險）
            const subBtn = findSafeButton([/^送出$/, /^提交$/, /^繳交$/]);
            if (subBtn && !subBtn.disabled) {
                await sleep(400); safeClick(subBtn);
                log('  📤 送出', '#22c55e'); await sleep(4000); break;
            }

            const nextBtn = findSafeButton([/下一題/, /^下一$/]);
            if (nextBtn) { safeClick(nextBtn); await sleep(2000); continue; }

            const arrow = findRightArrow();
            if (arrow) { arrow.click(); await sleep(2000); continue; }

            await sleep(1500);
        }

        // 完成測驗（嚴格比對）
        await sleep(2000);
        const doneBtn = findSafeButton([/^完成測驗$/]);
        if (doneBtn) { safeClick(doneBtn); log('  📋 完成測驗', '#60a5fa'); await sleep(3000); }

        // 判斷通過
        await sleep(2000);
        const retestBtn = findSafeButton([/^重新測驗$/]);
        if (retestBtn) {
            log(`  ⚠️ 未達標，重測`, '#f59e0b');
            safeClick(retestBtn); await sleep(2500);
            return doQuiz(name, attempt + 1);
        }

        log('  🎉 通過！', '#22c55e');
        return 'passed';
    }

    // ══════════════════════════════════════════
    // 掃描測驗（安全版，用群組索引追蹤）
    // ══════════════════════════════════════════
    async function runAllPendingQuizzes(courseUrl) {
        log('\n🔍 掃描未測驗...', '#60a5fa');
        const attempts = new Map();

        // 回到課程簡介
        const goToCourseTab = async () => {
            const tab = [...document.querySelectorAll('[role="tab"],.mat-tab-label')]
                .find(el => /課程簡介/.test(el.textContent));
            if (tab) { tab.click(); await sleep(1500); }
        };

        await goToCourseTab();

        // 展開所有群組
        for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
            if (DANGER_PATTERNS.test(h.textContent || '')) continue;
            const p = h.closest('mat-expansion-panel');
            if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(500); }
        }
        await sleep(1500);

        let round = 0;
        while (!stopped && round < 30) {
            round++;

            // 確認還在課程頁
            if (!isOnCoursePage()) {
                log('⚠️ 頁面跑掉，停止測驗掃描', '#ef4444');
                break;
            }

            // 逐一掃描群組
            const allPanels = [...document.querySelectorAll('mat-expansion-panel')];
            let foundAny = false;

            for (let gi = 0; gi < allPanels.length; gi++) {
                if (stopped) return;

                const panel2 = allPanels[gi];
                const header = panel2.querySelector('mat-expansion-panel-header');

                // 跳過危險群組
                if (DANGER_PATTERNS.test(header?.textContent || '')) continue;

                // 找未測驗按鈕（嚴格：只找文字完全是「未測驗」的）
                const quizBtn = [...panel2.querySelectorAll('button')]
                    .find(b => b.textContent?.trim() === '未測驗' && b.offsetParent !== null);
                if (!quizBtn) continue;

                const groupName = header?.innerText?.trim()?.substring(0, 30) || `群組${gi}`;
                const key = `${gi}::${groupName}`;
                const cnt = attempts.get(key) || 0;

                if (cnt >= 3) {
                    log(`  ⏭ 跳過「${groupName}」（已試${cnt}次）`, '#f59e0b');
                    continue;
                }

                foundAny = true;
                attempts.set(key, cnt + 1);

                log(`\n🎯 [群組${gi+1}]「${groupName}」（第${cnt+1}次）`, '#60a5fa');
                setStatus(`測驗：${groupName}`, '#a78bfa');

                // 安全點擊未測驗按鈕
                quizBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(600);

                if (!isSafeToClick(quizBtn)) {
                    log(`  🚨 未測驗按鈕被黑名單擋住！`, '#ef4444');
                    continue;
                }

                quizBtn.click();
                await sleep(3000);

                const result = await doQuiz(groupName);
                log(`  結果：${result}`, result === 'passed' ? '#22c55e' : '#f59e0b');

                await sleep(1500);
                await goToCourseTab();

                // 重新展開
                for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
                    if (DANGER_PATTERNS.test(h.textContent || '')) continue;
                    const p = h.closest('mat-expansion-panel');
                    if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(400); }
                }
                await sleep(800);
                break;
            }

            if (!foundAny) { log('  ✅ 所有測驗完成！', '#22c55e'); break; }
        }
    }

    // ══════════════════════════════════════════
    // 閱讀群組
    // ══════════════════════════════════════════
    async function processGroup(groupHeader, gIdx, total) {
        if (stopped) return;
        if (DANGER_PATTERNS.test(groupHeader.textContent || '')) {
            log(`  🚨 跳過危險群組：${groupHeader.innerText?.substring(0,20)}`, '#ef4444');
            return;
        }

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
            if (!link || !isSafeToClick(link)) continue;

            const title = link.innerText?.trim()?.substring(0, 25) || `子單元${s+1}`;
            log(`\n  📌 [${s+1}/${links.length}] ${title}`, '#60a5fa');
            setStatus(`${groupTitle} → ${title}`, '#4f8ef7');

            const isPDF = /pdf|\.pdf|fa-file-pdf/i.test(link.outerHTML + (link.closest('li')?.innerHTML || ''));

            if (isPDF) {
                log(`  📄 PDF，等60秒`, '#60a5fa');
                link.click();
                const tid = startCountdown(`PDF ${title.substring(0,10)}`, 60);
                await sleep(60000);
                clearInterval(tid);
            } else {
                const recPromise = waitForReadingRecord(120000);
                link.click();
                await sleep(1500);
                const tid = startCountdown(`等記錄`, 120);
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
            await sleep(600);
        }
    }

    // ══════════════════════════════════════════
    // 主流程
    // ══════════════════════════════════════════
    async function startMain(quizOnly) {
        if (running) { log('⚠️ 已在執行中', '#f59e0b'); return; }
        running = true; stopped = false;
        ['mv58-full', 'mv58-quiz'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });

        const courseUrl = location.href;
        log(`\n▶ v5.8 安全版（${quizOnly ? '只跑測驗' : '完整模式'}）`, '#4f8ef7');
        log('🛡️ 黑名單：退選/取消修課/登出 等危險按鈕已封鎖', '#22c55e');

        if (!quizOnly) {
            const groups = [...document.querySelectorAll('mat-expansion-panel-header')];
            if (!groups.length) { log('❌ 找不到群組', '#ef4444'); running = false; return; }
            log(`📚 ${groups.length} 個群組`);
            for (let g = 0; g < groups.length; g++) {
                if (stopped) break;
                await processGroup(groups[g], g, groups.length);
            }
        }

        if (!stopped) await runAllPendingQuizzes(courseUrl);

        if (!stopped) {
            // 不自動發討論（太危險，改提示手動）
            clearInterval(aliveTimer);
            setStatus('🎉 完成！', '#22c55e');
            setTimer('✅ 執行完畢', '#22c55e');
            log('\n🎉 完成！', '#22c55e');
            log('💬 請手動前往討論區發表心得', '#60a5fa');
            log('📋 請至「我修的課」確認通過狀態', '#60a5fa');
        } else {
            clearInterval(aliveTimer);
            setStatus('已停止', '#ef4444');
        }

        running = false;
        ['mv58-full', 'mv58-quiz'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
    }

    log('✅ v5.8 就緒 🛡️', '#4f8ef7');
    log('🚨 已封鎖：退選/取消修課/登出等危險按鈕', '#22c55e');
    log('💡 閱讀已100% → 點「只跑測驗」', '#60a5fa');
    setStatus('請選擇模式', '#60a5fa');
})();
