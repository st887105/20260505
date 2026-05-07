// MOOCS 測驗測試版 - 基於 v5.2 測驗邏輯，加詳細診斷
(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let KEY = localStorage.getItem('moocs_claude_key');
    if (!KEY) { KEY = prompt('Claude API Key：'); if (!KEY) return; localStorage.setItem('moocs_claude_key', KEY); }

    document.getElementById('moocs-test')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-test';
    panel.style.cssText = 'position:fixed;top:80px;left:20px;width:350px;z-index:999999;background:#13151f;color:#e2e8f0;border-radius:14px;font-family:monospace;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,.8);border:1px solid #2a2d3e;overflow:hidden';
    panel.innerHTML = `
        <div id="mt-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;color:#4f8ef7">🧪 測驗測試版</span>
            <span id="mt-close" style="cursor:pointer;opacity:.5">✕</span>
        </div>
        <div id="mt-status" style="padding:6px 14px;font-size:11px;color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">等待指令</div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mt-log" style="max-height:300px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:6px;flex-wrap:wrap">
            <button id="mt-run" style="flex:1;padding:8px;background:#1a3a1a;color:#22c55e;border:none;border-radius:7px;cursor:pointer;font-size:11px">▶ 跑所有測驗</button>
            <button id="mt-one" style="flex:1;padding:8px;background:#1a2a3a;color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">🎯 跑一個測驗</button>
            <button id="mt-stop" style="padding:8px 10px;background:#3d1a1a;color:#ef4444;border:none;border-radius:7px;cursor:pointer">⏹</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false;
    document.getElementById('mt-close').onclick = () => panel.remove();
    document.getElementById('mt-stop').onclick = () => { stopped = true; log('⏹ 停止', '#f59e0b'); };
    document.getElementById('mt-run').onclick = () => { stopped = false; runAll(); };
    document.getElementById('mt-one').onclick = () => { stopped = false; runOne(); };

    let drag=false,ox,oy;
    document.getElementById('mt-hdr').onmousedown=e=>{drag=true;ox=e.clientX-panel.offsetLeft;oy=e.clientY-panel.offsetTop;};
    document.onmousemove=e=>{if(!drag)return;panel.style.left=(e.clientX-ox)+'px';panel.style.top=(e.clientY-oy)+'px';panel.style.right='auto';panel.style.bottom='auto';};
    document.onmouseup=()=>drag=false;

    function log(msg, c='#94a3b8') {
        const el=document.getElementById('mt-log'); if(!el) return;
        const t=new Date().toLocaleTimeString('zh-TW');
        el.innerHTML+=`<div style="color:${c};line-height:1.8"><span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop=el.scrollHeight;
    }
    function setStatus(msg,c='#64748b'){const e=document.getElementById('mt-status');if(e){e.textContent=msg;e.style.color=c;}}

    // ── Claude（與 v5.2 相同）────────────────────
    async function askClaude(q, opts_text, type, retry=0) {
        await sleep(2000);
        const isYN = type?.includes('是非');
        const prompt = isYN
            ? `台灣教育訓練是非題，只回答0（正確）或1（錯誤），不要解釋：\n${q}`
            : `台灣教育訓練單選題，選最正確答案，只回答數字（從0開始），不要解釋：\n題目：${q}\n選項：\n${opts_text}`;
        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method:'POST',
                headers:{'Content-Type':'application/json','x-api-key':KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
                body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:10,messages:[{role:'user',content:prompt}]})
            });
            if(res.status===429){const w=[20,40,80][retry]||80;log(`⏳ 429 等${w}秒`,'#f59e0b');await sleep(w*1000);return askClaude(q,opts_text,type,retry+1);}
            const data=await res.json();
            if(!res.ok){log(`❌ API ${res.status}`,'#ef4444');return '0';}
            return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0]||'0';
        } catch(e){log('❌ '+e.message,'#ef4444');return '0';}
    }

    // ── 右側翻頁（v5.2 原版邏輯）────────────────
    function findRightArrow() {
        return [...document.querySelectorAll('button,[role="button"]')]
            .find(el => {
                const r = el.getBoundingClientRect();
                return r.right >= window.innerWidth - 300
                    && r.right <= window.innerWidth - 50
                    && r.top > 200 && r.top < window.innerHeight - 100
                    && r.width > 0 && r.width < 100;
            });
    }

    // ══════════════════════════════════════════════
    // doQuiz：完全基於 v5.2，加詳細 log
    // ══════════════════════════════════════════════
    async function doQuiz(name, attempt=1) {
        if (stopped) return 'stopped';
        if (attempt > 8) { log('❌ 超過8次，放棄', '#ef4444'); return 'failed'; }

        log(`\n📝 測驗「${name}」第${attempt}次`, '#a78bfa');
        setStatus(`測驗：${name} (${attempt}次)`, '#a78bfa');

        // v5.2 原版：直接找「進入測驗|開始測驗|重新測驗」
        // 此時應該已在說明頁，按鈕是可見的
        let enterBtn = null;
        log('  🔍 找進入/開始/重新測驗按鈕...', '#475569');

        for (let t=0; t<20; t++) {
            // 找所有符合的按鈕並 log
            const allMatch = [...document.querySelectorAll('button,a')]
                .filter(b => /進入測驗|開始測驗|重新測驗/.test(b.textContent));

            if (allMatch.length > 0) {
                allMatch.forEach((b,i) => {
                    const r = b.getBoundingClientRect();
                    const vis = b.offsetParent !== null;
                    log(`  [${i}]「${b.textContent?.trim()?.substring(0,15)}」x:${Math.round(r.left)} w:${Math.round(r.width)} 可見:${vis}`, '#475569');
                });
                // 選第一個可見的
                enterBtn = allMatch.find(b => b.offsetParent !== null) || allMatch[0];
                break;
            }
            await sleep(500);
        }

        if (!enterBtn) {
            log('  ❌ 找不到進入測驗按鈕！', '#ef4444');
            log('  頁面文字片段：'+document.body.innerText.substring(0,150).replace(/\n/g,' '), '#334155');
            return 'no_btn';
        }

        log(`  ✅ 點擊「${enterBtn.textContent?.trim()}」`, '#22c55e');
        enterBtn.click();
        await sleep(3000);

        // 答題迴圈
        let answered = 0;
        for (let i=0; i<30; i++) {
            if (stopped) return 'stopped';

            const qEl = document.querySelector('.question__title');
            if (!qEl) {
                log(`  題目消失（已答${answered}題）`, '#22c55e');
                break;
            }

            const q = qEl.innerText.trim();
            const type = document.querySelector('.quesiton__type-and-index,.question__type-and-index')?.innerText || '';
            const opts = document.querySelectorAll('.question-wrap label,moocs-question label');
            const opts_text = [...opts].map((o,i)=>`${i}: ${o.innerText.trim()}`).join('\n');

            log(`  Q${i+1}[${type.includes('是非')?'是非':'單選'}]: ${q.substring(0,40)}`, '#a78bfa');

            if (!opts.length) {
                log('  ⚠️ 無選項，跳過', '#f59e0b');
                await sleep(1000); continue;
            }

            const ans = await askClaude(q, opts_text, type);
            const idx = parseInt(ans)||0;
            const safeIdx = Math.min(idx, opts.length-1);
            opts[safeIdx]?.click();
            log(`  → 選${safeIdx}：${[...opts][safeIdx]?.innerText?.trim()?.substring(0,20)}`, '#22c55e');
            answered++;
            await sleep(1500);

            // 送出
            const sub = [...document.querySelectorAll('button')]
                .find(b => /送出|提交|繳交/i.test(b.textContent) && b.offsetParent);
            if (sub) { await sleep(800); sub.click(); log('  📤 送出！','#22c55e'); await sleep(3000); break; }

            // 下一題
            const nxt = [...document.querySelectorAll('button')]
                .find(b => /下一|next/i.test(b.textContent) && b.offsetParent);
            if (nxt) { nxt.click(); await sleep(2000); continue; }

            // 右側箭頭
            const arrow = findRightArrow();
            if (arrow) { arrow.click(); await sleep(2000); continue; }

            log('  ⚠️ 找不到下一題/送出', '#f59e0b'); break;
        }

        // 完成測驗
        await sleep(1000);
        const doneBtn = [...document.querySelectorAll('button,a')]
            .find(b => /完成測驗/.test(b.textContent) && b.offsetParent);
        if (doneBtn) { doneBtn.click(); log('  📋 完成測驗','#60a5fa'); await sleep(2000); }

        // 判斷通過
        await sleep(1500);
        const retestBtn = [...document.querySelectorAll('button,a')]
            .find(b => /重新測驗/.test(b.textContent) && b.offsetParent);
        if (retestBtn) {
            log(`  ⚠️ 未達標，第${attempt+1}次重測`, '#f59e0b');
            await sleep(1000);
            return doQuiz(name, attempt+1);
        }

        log('  🎉 測驗通過！', '#22c55e');
        setStatus('🎉 通過', '#22c55e');
        return 'passed';
    }

    // ── 跑一個：找第一個未測驗按鈕，點後進測驗 ──
    async function runOne() {
        log('\n🎯 跑一個測驗', '#4f8ef7');

        // 展開所有群組
        for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
            const p = h.closest('mat-expansion-panel');
            if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(400); }
        }
        await sleep(1000);

        // 找第一個未測驗
        const quizBtns = [...document.querySelectorAll('button')]
            .filter(b => b.textContent?.trim() === '未測驗' && b.offsetParent);

        log(`找到 ${quizBtns.length} 個未測驗按鈕`);
        if (!quizBtns.length) { log('✅ 無未測驗', '#22c55e'); return; }

        const btn = quizBtns[0];
        const gName = btn.closest('mat-expansion-panel')
            ?.querySelector('mat-expansion-panel-header')?.innerText?.trim()?.substring(0,25) || '測驗1';

        log(`點擊「${gName}」的未測驗按鈕`, '#60a5fa');
        btn.scrollIntoView({behavior:'smooth',block:'center'});
        await sleep(600);
        btn.click();

        // 等說明頁（觀察頁面變化）
        log('等待說明頁載入...', '#475569');
        for (let t=0; t<20; t++) {
            await sleep(500);
            const txt = document.body.innerText;
            const hasInfo = /總題數|通過標準|測驗時間/.test(txt);
            const hasEnter = [...document.querySelectorAll('button,a')]
                .some(b => /進入測驗|開始測驗/.test(b.textContent) && b.offsetParent);
            log(`  ${(t+1)*0.5}秒 | 說明頁:${hasInfo} 進入按鈕:${hasEnter}`, '#334155');
            if (hasInfo || hasEnter) {
                log('  說明頁已出現！', '#22c55e');
                break;
            }
        }

        await doQuiz(gName);
    }

    // ── 跑所有：逐一處理所有未測驗 ──────────────
    async function runAll() {
        log('\n🚀 跑所有測驗（基於v5.2邏輯）', '#4f8ef7');

        // 先回課程簡介
        const homeTab = [...document.querySelectorAll('[role="tab"],.mat-tab-label')]
            .find(el => /課程簡介/.test(el.textContent));
        if (homeTab) { homeTab.click(); await sleep(1500); }

        // 展開所有群組
        for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
            const p = h.closest('mat-expansion-panel');
            if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(400); }
        }
        await sleep(1200);

        const attempts = new Map();
        let round = 0;

        while (!stopped && round < 40) {
            round++;

            const quizBtns = [...document.querySelectorAll('button')]
                .filter(b => b.textContent?.trim()==='未測驗' && b.offsetParent);

            if (!quizBtns.length) { log('\n✅ 所有測驗完成！', '#22c55e'); setStatus('🎉 完成', '#22c55e'); break; }

            const btn = quizBtns[0];
            const p2 = btn.closest('mat-expansion-panel');
            const gName = p2?.querySelector('mat-expansion-panel-header')?.innerText?.trim()?.substring(0,25) || `測驗${round}`;
            const cnt = attempts.get(gName) || 0;

            if (cnt >= 3) {
                log(`⏭ 跳過「${gName}」(已試${cnt}次)`, '#f59e0b');
                btn.setAttribute('data-done','1');
                // 重新掃描時排除
                continue;
            }
            attempts.set(gName, cnt+1);

            log(`\n[${round}] 「${gName}」(第${cnt+1}次嘗試)`, '#60a5fa');
            btn.scrollIntoView({behavior:'smooth',block:'center'});
            await sleep(600);
            btn.click();

            // 等說明頁（最多10秒）
            let ready = false;
            for (let t=0; t<20; t++) {
                await sleep(500);
                const hasInfo = /總題數|通過標準|測驗時間/.test(document.body.innerText);
                const hasEnter = [...document.querySelectorAll('button,a')]
                    .some(b=>/進入測驗|開始測驗/.test(b.textContent)&&b.offsetParent);
                if (hasInfo || hasEnter) { ready=true; break; }
            }

            if (!ready) { log('  ⚠️ 說明頁未出現，跳過', '#f59e0b'); continue; }

            const result = await doQuiz(gName);
            log(`  結果：${result}`, result==='passed'?'#22c55e':'#f59e0b');

            await sleep(1500);

            // 回課程簡介
            if (homeTab) { homeTab.click(); await sleep(1500); }

            // 重新展開
            for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
                const p = h.closest('mat-expansion-panel');
                if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(300); }
            }
            await sleep(800);
        }
    }

    log('✅ 測試版就緒', '#4f8ef7');
    log('━━━ 操作說明 ━━━', '#334155');
    log('【🎯 跑一個測驗】點第一個未測驗，有詳細 log', '#60a5fa');
    log('【▶ 跑所有測驗】自動處理所有未測驗群組', '#60a5fa');
    setStatus('請選擇操作', '#60a5fa');
})();
