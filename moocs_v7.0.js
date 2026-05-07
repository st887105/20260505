// MOOCS v7.0 - 直接導向法：攔截 /qti-detail 取得測驗ID，直接進入
(async function() {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let KEY = localStorage.getItem('moocs_claude_key');
    if (!KEY) { KEY = prompt('Claude API Key:'); if (!KEY) return; localStorage.setItem('moocs_claude_key', KEY); }

    // ── 面板 ─────────────────────────────────────
    document.getElementById('moocs-v70')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v70';
    panel.style.cssText = 'position:fixed;top:20px;left:20px;width:340px;z-index:999999;background:#13151f;color:#e2e8f0;border-radius:14px;font-family:monospace;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,.8);border:1px solid #2a2d3e;overflow:hidden';
    panel.innerHTML = `
        <div id="mv70-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;color:#4f8ef7">🎓 MOOCS v7.0</span>
            <span id="mv70-close" style="cursor:pointer;opacity:.5">✕</span>
        </div>
        <div id="mv70-status" style="padding:6px 14px;font-size:11px;color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">初始化...</div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv70-log" style="max-height:260px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:6px;flex-wrap:wrap">
            <button id="mv70-scan" style="flex:1;padding:8px;background:#1a3a2a;color:#22c55e;border:none;border-radius:7px;cursor:pointer;font-size:11px">🔍 掃描測驗</button>
            <button id="mv70-answer" style="flex:1;padding:8px;background:#2a1a3a;color:#a78bfa;border:none;border-radius:7px;cursor:pointer;font-size:11px">📝 答題</button>
            <button id="mv70-enter" style="flex:1;padding:8px;background:#1a2a3a;color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">▶ 進入測驗</button>
            <button id="mv70-stop" style="padding:8px 10px;background:#3d1a1a;color:#ef4444;border:none;border-radius:7px;cursor:pointer">⏹</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false;
    document.getElementById('mv70-close').onclick = () => panel.remove();
    document.getElementById('mv70-stop').onclick = () => { stopped = true; log('⏹ 停止', '#f59e0b'); };

    let drag=false,ox,oy;
    document.getElementById('mv70-hdr').onmousedown = e=>{drag=true;ox=e.clientX-panel.offsetLeft;oy=e.clientY-panel.offsetTop;};
    document.onmousemove = e=>{if(!drag)return;panel.style.left=(e.clientX-ox)+'px';panel.style.top=(e.clientY-oy)+'px';panel.style.right='auto';panel.style.bottom='auto';};
    document.onmouseup = ()=>drag=false;

    function log(msg, color='#94a3b8') {
        const el = document.getElementById('mv70-log');
        if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${color};line-height:1.8"><span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    function setStatus(msg, c='#64748b') { const e=document.getElementById('mv70-status'); if(e){e.textContent=msg;e.style.color=c;} }

    // ── Claude ───────────────────────────────────
    async function askClaude(q, opts_text, type, retry=0) {
        await sleep(800);
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
            if (res.status===429){await sleep(30000);return askClaude(q,opts_text,type,retry+1);}
            const data=await res.json();
            return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0]||'0';
        } catch(e){return '0';}
    }

    // ── 答題核心（任何時候呼叫都能用）─────────
    async function answerCurrentQuiz() {
        log('📝 開始答題', '#a78bfa');
        let answered = 0;

        for (let i=0; i<60; i++) {
            if (stopped) break;
            await sleep(600);

            const qEl = document.querySelector('.question__title,.question-title,[class*="question__title"]');
            if (!qEl || !qEl.offsetParent) {
                if (answered > 0) { log(`✅ 答完（${answered}題）`,'#22c55e'); break; }
                if (i > 5) { log('ℹ️ 找不到題目','#64748b'); break; }
                continue;
            }

            const q = qEl.innerText.trim();
            const type = document.querySelector('.quesiton__type-and-index,.question__type-and-index,[class*="type-and-index"]')?.innerText||'';
            const opts = [...document.querySelectorAll('moocs-question label,.question-wrap label,fieldset label')]
                .filter(o=>o.offsetParent!==null);

            if (!opts.length) { await sleep(1000); continue; }

            const opts_text = opts.map((o,i)=>`${i}: ${o.innerText.trim()}`).join('\n');
            log(`Q${answered+1}: ${q.substring(0,38)}`,'#a78bfa');

            const ans = await askClaude(q, opts_text, type);
            const idx = Math.min(parseInt(ans)||0, opts.length-1);
            opts[idx]?.click();
            log(`→ 選${idx}：${opts[idx]?.innerText?.trim()?.substring(0,20)}`,'#22c55e');
            answered++;
            await sleep(1000);

            // 送出
            const sub = [...document.querySelectorAll('button')]
                .find(b=>/^(送出|提交|繳交)$/.test(b.textContent?.trim())&&!b.disabled&&b.offsetParent);
            if (sub) { await sleep(400); sub.click(); log('📤 送出！','#22c55e'); await sleep(4000); break; }

            // 下一題
            const nxt = [...document.querySelectorAll('button')]
                .find(b=>/^下一題$|^下一$/.test(b.textContent?.trim())&&b.offsetParent);
            if (nxt) { nxt.click(); await sleep(1800); continue; }

            // 右側箭頭
            const arrow = [...document.querySelectorAll('button,[role="button"]')]
                .find(el=>{ const r=el.getBoundingClientRect(); return r.right>=innerWidth-300&&r.right<=innerWidth-50&&r.top>200&&r.width>0&&r.width<100; });
            if (arrow) { arrow.click(); await sleep(1800); continue; }

            await sleep(1200);
        }

        // 完成測驗
        await sleep(1500);
        const done = [...document.querySelectorAll('button,a')]
            .find(b=>b.textContent?.trim()==='完成測驗'&&b.offsetParent);
        if (done) { done.click(); log('📋 完成測驗','#60a5fa'); await sleep(2500); }

        // 判斷結果
        await sleep(1500);
        const retest = [...document.querySelectorAll('button,a')]
            .find(b=>b.textContent?.trim()==='重新測驗'&&b.offsetParent);
        if (retest) {
            log('⚠️ 未達標，按「▶ 進入測驗」重試','#f59e0b');
            setStatus('⚠️ 未達標，請按進入測驗重試','#f59e0b');
        } else {
            log('🎉 通過！','#22c55e');
            setStatus('🎉 通過！','#22c55e');
        }
    }

    // ── 進入測驗按鈕（點說明頁的大按鈕）────────
    document.getElementById('mv70-enter').onclick = async () => {
        log('🔍 找進入測驗按鈕...','#60a5fa');
        setStatus('找進入測驗...','#60a5fa');

        // 等說明頁
        let enterBtn = null;
        for (let t=0; t<20; t++) {
            const candidates = [...document.querySelectorAll('button,a,[role="button"]')]
                .filter(b => {
                    if (!b.offsetParent) return false;
                    const txt = b.textContent?.trim()||'';
                    if (!/進入測驗|開始測驗/.test(txt)) return false;
                    const r = b.getBoundingClientRect();
                    // 主內容區（不在最右側欄）
                    return r.width > 50;
                });

            if (candidates.length > 0) {
                // 選最寬的
                enterBtn = candidates.reduce((a,b) =>
                    b.getBoundingClientRect().width > a.getBoundingClientRect().width ? b : a
                );
                break;
            }
            log(`  等待中(${t+1}/20)...`,'#475569');
            await sleep(500);
        }

        if (!enterBtn) {
            log('❌ 找不到進入測驗按鈕','#ef4444');
            log('  頁面上所有可見按鈕：','#475569');
            [...document.querySelectorAll('button')].filter(b=>b.offsetParent&&b.textContent?.trim()).forEach(b=>{
                log(`  「${b.textContent?.trim()?.substring(0,25)}」`,'#334155');
            });
            setStatus('❌ 找不到按鈕','#ef4444');
            return;
        }

        const r = enterBtn.getBoundingClientRect();
        log(`✅ 找到：「${enterBtn.textContent?.trim()}」(w:${Math.round(r.width)},x:${Math.round(r.left)})`,'#22c55e');
        enterBtn.click();
        await sleep(2500);

        // 等題目
        let hasQ = false;
        for (let t=0; t<15; t++) {
            if (document.querySelector('.question__title,.question-title,[class*="question__title"]')?.offsetParent) {
                hasQ = true; break;
            }
            await sleep(500);
        }
        if (hasQ) {
            log('✅ 題目已出現，按「📝 答題」開始','#22c55e');
            setStatus('題目已載入，按答題','#22c55e');
        } else {
            log('⚠️ 題目未出現，可能需要再等','#f59e0b');
            setStatus('⚠️ 題目未出現','#f59e0b');
        }
    };

    document.getElementById('mv70-answer').onclick = () => answerCurrentQuiz();

    // ── 掃描模式：展開群組找所有未測驗 ──────────
    document.getElementById('mv70-scan').onclick = async () => {
        stopped = false;
        log('\n🔍 展開所有群組掃描未測驗...','#60a5fa');
        setStatus('掃描中...','#60a5fa');

        // 展開
        for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
            const p = h.closest('mat-expansion-panel');
            if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(400); }
        }
        await sleep(1000);

        // 找所有未測驗
        const allBtns = [...document.querySelectorAll('button')]
            .filter(b => b.textContent?.trim() === '未測驗');

        log(`找到 ${allBtns.length} 個未測驗按鈕`,'#60a5fa');
        allBtns.forEach((b, i) => {
            const panel2 = b.closest('mat-expansion-panel');
            const name = panel2?.querySelector('mat-expansion-panel-header')?.innerText?.trim()?.substring(0,25)||'?';
            const r = b.getBoundingClientRect();
            log(`  [${i+1}] ${name} | visible:${b.offsetParent!==null} x:${Math.round(r.left)}`,'#94a3b8');
        });

        if (allBtns.length === 0) {
            log('✅ 無未測驗項目','#22c55e');
            setStatus('✅ 無未測驗','#22c55e');
            return;
        }

        // 逐一處理
        const attempts = new Map();

        for (let round=0; round<30 && !stopped; round++) {
            // 重新找
            const freshBtns = [...document.querySelectorAll('button')]
                .filter(b => b.textContent?.trim()==='未測驗' && b.offsetParent!==null);

            if (!freshBtns.length) { log('✅ 所有測驗完成！','#22c55e'); setStatus('🎉 完成','#22c55e'); break; }

            const btn = freshBtns[0];
            const p2 = btn.closest('mat-expansion-panel');
            const gName = p2?.querySelector('mat-expansion-panel-header')?.innerText?.trim()?.substring(0,25) || `測驗${round+1}`;
            const key = gName;
            const cnt = attempts.get(key)||0;

            if (cnt >= 3) {
                log(`⏭ 跳過「${gName}」(${cnt}次)`,'#f59e0b');
                // 把這個按鈕標記，下次找別的
                btn.setAttribute('data-skip','1');
                continue;
            }
            attempts.set(key, cnt+1);

            log(`\n🎯 [${round+1}] 「${gName}」第${cnt+1}次`,'#60a5fa');
            setStatus(`測驗：${gName}`,'#a78bfa');

            btn.scrollIntoView({behavior:'smooth',block:'center'});
            await sleep(600);
            btn.click();
            await sleep(3000);

            // 等說明頁
            let infoReady = false;
            for (let t=0; t<20; t++) {
                if (/總題數|通過標準|測驗時間/.test(document.body.innerText) ||
                    document.querySelector('.question__title,.question-title')) {
                    infoReady = true; break;
                }
                await sleep(500);
            }

            if (!infoReady) {
                log('  ⚠️ 頁面沒反應，跳過','#f59e0b'); continue;
            }

            // 有說明頁就點進入測驗
            if (/總題數|通過標準/.test(document.body.innerText)) {
                log('  說明頁已出現','#60a5fa');

                // 找進入測驗按鈕
                let enterBtn = null;
                for (let t=0; t<15; t++) {
                    const cands = [...document.querySelectorAll('button,a')]
                        .filter(b=>b.offsetParent && /進入測驗|開始測驗/.test(b.textContent?.trim()));
                    if (cands.length) {
                        enterBtn = cands.reduce((a,b)=>b.getBoundingClientRect().width>a.getBoundingClientRect().width?b:a);
                        break;
                    }
                    await sleep(500);
                }

                if (!enterBtn) {
                    log('  ⚠️ 找不到進入測驗按鈕','#f59e0b');
                    // 印出所有按鈕
                    [...document.querySelectorAll('button')].filter(b=>b.offsetParent).forEach(b=>{
                        log(`    btn:「${b.textContent?.trim()?.substring(0,20)}」`,'#334155');
                    });
                } else {
                    log(`  點「${enterBtn.textContent?.trim()}」`,'#22c55e');
                    enterBtn.click();
                    await sleep(3000);
                }
            }

            // 答題
            await answerCurrentQuiz();
            await sleep(2000);

            // 回課程簡介
            const homeTab = [...document.querySelectorAll('[role="tab"],.mat-tab-label')]
                .find(el=>/課程簡介/.test(el.textContent));
            if (homeTab) { homeTab.click(); await sleep(1500); }

            // 重新展開
            for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
                const p = h.closest('mat-expansion-panel');
                if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(300); }
            }
            await sleep(800);
        }
    };

    log('✅ v7.0 就緒','#4f8ef7');
    log('━━━ 使用方式 ━━━','#334155');
    log('【自動】按「🔍 掃描測驗」全自動跑','#60a5fa');
    log('【手動】側欄點未測驗 → 按「▶ 進入測驗」→ 按「📝 答題」','#60a5fa');
    setStatus('請選擇操作','#60a5fa');
})();
