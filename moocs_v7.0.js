// MOOCS v7.1 - 修正：排除側欄按鈕（x > innerWidth-300 的都是側欄）
(async function() {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let KEY = localStorage.getItem('moocs_claude_key');
    if (!KEY) { KEY = prompt('Claude API Key:'); if (!KEY) return; localStorage.setItem('moocs_claude_key', KEY); }

    document.getElementById('moocs-v71')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v71';
    panel.style.cssText = 'position:fixed;top:20px;left:20px;width:340px;z-index:999999;background:#13151f;color:#e2e8f0;border-radius:14px;font-family:monospace;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,.8);border:1px solid #2a2d3e;overflow:hidden';
    panel.innerHTML = `
        <div id="mv71-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;color:#4f8ef7">🎓 MOOCS v7.1 🛡️</span>
            <span id="mv71-close" style="cursor:pointer;opacity:.5">✕</span>
        </div>
        <div id="mv71-status" style="padding:6px 14px;font-size:11px;color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">初始化...</div>
        <div id="mv71-timer" style="padding:3px 14px;font-size:10px;color:#22c55e;background:#0a0f0a;border-bottom:1px solid #1a1d27">⏳ 等待</div>
        <div style="background:#0a0c14;padding:6px 0">
            <div id="mv71-log" style="max-height:250px;overflow-y:auto;padding:4px 14px"></div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:6px;flex-wrap:wrap">
            <button id="mv71-auto" style="flex:1;padding:8px;background:#1a3a2a;color:#22c55e;border:none;border-radius:7px;cursor:pointer;font-size:11px">🚀 全自動</button>
            <button id="mv71-enter" style="flex:1;padding:8px;background:#1a2a3a;color:#60a5fa;border:none;border-radius:7px;cursor:pointer;font-size:11px">▶ 進入測驗</button>
            <button id="mv71-answer" style="flex:1;padding:8px;background:#2a1a3a;color:#a78bfa;border:none;border-radius:7px;cursor:pointer;font-size:11px">📝 答題</button>
            <button id="mv71-stop" style="padding:8px 10px;background:#3d1a1a;color:#ef4444;border:none;border-radius:7px;cursor:pointer">⏹</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false;
    document.getElementById('mv71-close').onclick = () => panel.remove();
    document.getElementById('mv71-stop').onclick = () => { stopped = true; log('⏹ 停止', '#f59e0b'); };

    let drag=false,ox,oy;
    document.getElementById('mv71-hdr').onmousedown=e=>{drag=true;ox=e.clientX-panel.offsetLeft;oy=e.clientY-panel.offsetTop;};
    document.onmousemove=e=>{if(!drag)return;panel.style.left=(e.clientX-ox)+'px';panel.style.top=(e.clientY-oy)+'px';panel.style.right='auto';panel.style.bottom='auto';};
    document.onmouseup=()=>drag=false;

    function log(msg,color='#94a3b8'){
        const el=document.getElementById('mv71-log');if(!el)return;
        const t=new Date().toLocaleTimeString('zh-TW');
        el.innerHTML+=`<div style="color:${color};line-height:1.8"><span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop=el.scrollHeight;
    }
    function setStatus(msg,c='#64748b'){const e=document.getElementById('mv71-status');if(e){e.textContent=msg;e.style.color=c;}}
    function setTimer(msg,c='#22c55e'){const e=document.getElementById('mv71-timer');if(e){e.textContent=msg;e.style.color=c;}}

    function startCountdown(label, sec) {
        let r=sec; setTimer(`⏱ ${label}：${r}秒`,'#22c55e');
        const tid=setInterval(()=>{if(stopped||r<=0){clearInterval(tid);return;}r--;setTimer(`⏱ ${label}：${r}秒`,r<10?'#f59e0b':'#22c55e');},1000);
        return tid;
    }

    // ── Claude ───────────────────────────────────
    async function askClaude(q,opts_text,type,retry=0){
        await sleep(800);
        const isYN=type?.includes('是非');
        const prompt=isYN
            ?`台灣教育訓練是非題，只回答0（正確）或1（錯誤），不要解釋：\n${q}`
            :`台灣教育訓練單選題，選最正確答案，只回答數字（從0開始），不要解釋：\n題目：${q}\n選項：\n${opts_text}`;
        try{
            const res=await fetch('https://api.anthropic.com/v1/messages',{
                method:'POST',
                headers:{'Content-Type':'application/json','x-api-key':KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
                body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:10,messages:[{role:'user',content:prompt}]})
            });
            if(res.status===429){await sleep(30000);return askClaude(q,opts_text,type,retry+1);}
            const data=await res.json();
            return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0]||'0';
        }catch(e){return '0';}
    }

    // ══════════════════════════════════════════════
    // 核心：找說明頁的「進入測驗」大按鈕
    // 側欄寬約 200px，位置在右側 innerWidth-700 ~ innerWidth
    // 主內容區的按鈕 x 應該在 100 ~ innerWidth-700 之間
    // ══════════════════════════════════════════════
    function findMainEnterBtn() {
        const sidebarStartX = window.innerWidth - 750; // 側欄左緣估計

        const candidates = [...document.querySelectorAll('button,a,[role="button"]')]
            .filter(b => {
                if (!b.offsetParent) return false;
                const txt = b.textContent?.trim() || '';
                if (!/^進入測驗$|^開始測驗$/.test(txt)) return false;
                const r = b.getBoundingClientRect();
                // 排除側欄（右側）的按鈕
                const isInSidebar = r.left > sidebarStartX;
                // 排除面板自己的按鈕
                const isOurPanel = b.closest('#moocs-v71') !== null;
                return !isInSidebar && !isOurPanel && r.width > 30;
            });

        if (!candidates.length) return null;

        // log 所有候選
        candidates.forEach((b,i) => {
            const r = b.getBoundingClientRect();
            log(`  候選[${i}]「${b.textContent?.trim()}」w:${Math.round(r.width)} x:${Math.round(r.left)}`,'#475569');
        });

        // 選最寬的（通常是主內容的大按鈕）
        return candidates.reduce((a,b) =>
            b.getBoundingClientRect().width > a.getBoundingClientRect().width ? b : a
        );
    }

    // ── 等說明頁出現 ─────────────────────────────
    async function waitForQuizInfoPage(ms=15000) {
        const start = Date.now();
        while (Date.now()-start < ms) {
            // 偵測說明頁：有「總題數」或「通過標準」
            if (/總題數|通過標準|測驗時間|測驗次數/.test(document.body.innerText)) return 'info';
            // 或直接有題目
            if (document.querySelector('.question__title,.question-title')?.offsetParent) return 'question';
            await sleep(400);
        }
        return 'timeout';
    }

    // ── 等題目出現 ───────────────────────────────
    async function waitForQuestion(ms=12000) {
        const start = Date.now();
        while (Date.now()-start < ms) {
            if (document.querySelector('.question__title,.question-title,[class*="question__title"]')?.offsetParent) return true;
            await sleep(400);
        }
        return false;
    }

    // ── 答題核心 ─────────────────────────────────
    async function answerCurrentQuiz(name='') {
        log(`📝 答題開始${name?'：'+name:''}`,'#a78bfa');
        setStatus(`答題中：${name}`,'#a78bfa');
        let answered=0, noQCount=0;

        for (let i=0; i<60; i++) {
            if (stopped) break;
            await sleep(500);

            const qEl=document.querySelector('.question__title,.question-title,[class*="question__title"]');
            if (!qEl||!qEl.offsetParent) {
                noQCount++;
                if (answered>0 && noQCount>=4){log(`✅ 答完（${answered}題）`,'#22c55e');break;}
                if (i>8 && noQCount>=4){log('ℹ️ 無題目','#64748b');break;}
                continue;
            }
            noQCount=0;

            const q=qEl.innerText.trim();
            const type=document.querySelector('.quesiton__type-and-index,.question__type-and-index,[class*="type-and-index"]')?.innerText||'';
            const opts=[...document.querySelectorAll('moocs-question label,.question-wrap label,fieldset label')]
                .filter(o=>o.offsetParent!==null);

            if (!opts.length){await sleep(1000);continue;}

            const opts_text=opts.map((o,i)=>`${i}: ${o.innerText.trim()}`).join('\n');
            log(`Q${answered+1}[${type.includes('是非')?'是非':'單選'}]: ${q.substring(0,40)}`,'#a78bfa');

            const ans=await askClaude(q,opts_text,type);
            const idx=Math.min(parseInt(ans)||0,opts.length-1);
            opts[idx]?.click();
            log(`→ 選${idx}：${opts[idx]?.innerText?.trim()?.substring(0,20)}`,'#22c55e');
            answered++;
            await sleep(1000);

            // 送出
            const sub=[...document.querySelectorAll('button')]
                .find(b=>/^(送出|提交|繳交)$/.test(b.textContent?.trim())&&!b.disabled&&b.offsetParent&&!b.closest('#moocs-v71'));
            if(sub){await sleep(400);sub.click();log('📤 送出！','#22c55e');await sleep(4000);break;}

            // 下一題
            const nxt=[...document.querySelectorAll('button')]
                .find(b=>/^下一題$|^下一$/.test(b.textContent?.trim())&&b.offsetParent&&!b.closest('#moocs-v71'));
            if(nxt){nxt.click();await sleep(1800);continue;}

            // 右側箭頭（排除側欄區域外的）
            const arrow=[...document.querySelectorAll('button,[role="button"]')]
                .find(el=>{
                    if(el.closest('#moocs-v71'))return false;
                    const r=el.getBoundingClientRect();
                    // 翻頁箭頭：在主內容區右側，不在側欄
                    return r.right>=innerWidth-750&&r.right<=innerWidth-180
                        &&r.top>200&&r.top<innerHeight-100&&r.width>0&&r.width<80;
                });
            if(arrow){arrow.click();await sleep(1800);continue;}

            await sleep(1200);
        }

        // 完成測驗
        await sleep(1500);
        const done=[...document.querySelectorAll('button,a')]
            .find(b=>b.textContent?.trim()==='完成測驗'&&b.offsetParent&&!b.closest('#moocs-v71'));
        if(done){done.click();log('📋 完成測驗','#60a5fa');await sleep(2500);}

        // 結果
        await sleep(1500);
        const retest=[...document.querySelectorAll('button,a')]
            .find(b=>b.textContent?.trim()==='重新測驗'&&b.offsetParent);
        if(retest){
            log('⚠️ 未達標','#f59e0b');
            setStatus('⚠️ 未達標，重試中...','#f59e0b');
            retest.click();await sleep(2500);
            return 'retest';
        }
        log('🎉 通過！','#22c55e');
        setStatus('🎉 通過','#22c55e');
        return 'passed';
    }

    // ── 進入測驗流程（說明頁 → 答題）───────────
    async function enterAndAnswer(name='') {
        // 等說明頁或題目
        log('  ⏳ 等待頁面載入...','#475569');
        const pageType = await waitForQuizInfoPage(15000);
        log(`  頁面類型：${pageType}`,'#475569');

        if (pageType === 'timeout') {
            log('  ❌ 頁面沒反應','#ef4444');
            return 'timeout';
        }

        if (pageType === 'info') {
            // 說明頁：讀資訊
            const txt = document.body.innerText;
            const totalQ = txt.match(/總題數[：:]\s*(\d+)/)?.[1]||'?';
            const passScore = txt.match(/通過標準[：:]\s*(\d+)/)?.[1]||'?';
            log(`  說明頁：共${totalQ}題，通過${passScore}分`,'#60a5fa');

            // 找主內容區的進入測驗按鈕
            let enterBtn = null;
            for (let t=0; t<20; t++) {
                enterBtn = findMainEnterBtn();
                if (enterBtn) break;
                if (t%5===4) log(`  等按鈕(${t+1}/20)...`,'#475569');
                await sleep(400);
            }

            if (!enterBtn) {
                log('  ❌ 主內容區找不到進入測驗按鈕','#ef4444');
                log('  側欄寬度估計：'+(window.innerWidth-750)+'px 以右為側欄','#475569');
                // 印出所有進入測驗按鈕
                [...document.querySelectorAll('button,a')].filter(b=>b.offsetParent&&/進入測驗|開始測驗/.test(b.textContent)).forEach(b=>{
                    const r=b.getBoundingClientRect();
                    log(`  所有「進入測驗」：x:${Math.round(r.left)} w:${Math.round(r.width)}`,'#334155');
                });
                return 'no_enter_btn';
            }

            log(`  ✅ 點進入測驗（x:${Math.round(enterBtn.getBoundingClientRect().left)},w:${Math.round(enterBtn.getBoundingClientRect().width)}）`,'#22c55e');
            enterBtn.click();
            await sleep(3000);

            const hasQ = await waitForQuestion(10000);
            if (!hasQ) { log('  ⚠️ 題目未出現','#f59e0b'); }
        }

        // 答題（可能需要多次重試）
        let result = '';
        for (let attempt=1; attempt<=5; attempt++) {
            if (stopped) return 'stopped';
            result = await answerCurrentQuiz(name);
            if (result !== 'retest') break;
            log(`  第${attempt+1}次重測`,'#f59e0b');
            // 重測：等說明頁再次進入
            const pt = await waitForQuizInfoPage(10000);
            if (pt==='info') {
                const btn = findMainEnterBtn();
                if (btn) { btn.click(); await sleep(3000); }
            }
        }
        return result;
    }

    // ── 手動按鈕 ─────────────────────────────────
    document.getElementById('mv71-enter').onclick = async () => {
        log('\n▶ 手動點進入測驗','#60a5fa');
        const btn = findMainEnterBtn();
        if (!btn) {
            log('❌ 找不到主內容區按鈕（x < '+(window.innerWidth-750)+'）','#ef4444');
            log('所有「進入測驗」按鈕：','#475569');
            [...document.querySelectorAll('button,a')].filter(b=>b.offsetParent&&/進入測驗|開始測驗/.test(b.textContent)).forEach(b=>{
                const r=b.getBoundingClientRect();
                log(`  x:${Math.round(r.left)} y:${Math.round(r.top)} w:${Math.round(r.width)}`,'#334155');
            });
            return;
        }
        log(`✅ 點擊（x:${Math.round(btn.getBoundingClientRect().left)}）`,'#22c55e');
        btn.click();
        await sleep(2500);
        const ok = await waitForQuestion(8000);
        log(ok ? '✅ 題目已出現，按「📝 答題」' : '⚠️ 題目未出現，請等待','#22c55e');
    };

    document.getElementById('mv71-answer').onclick = () => { stopped=false; answerCurrentQuiz('手動'); };

    // ── 全自動 ───────────────────────────────────
    document.getElementById('mv71-auto').onclick = async () => {
        stopped = false;
        log('\n🚀 全自動掃描開始','#4f8ef7');
        setStatus('全自動掃描...','#4f8ef7');

        // 展開所有群組
        for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
            const p=h.closest('mat-expansion-panel');
            if (!p?.classList.contains('mat-expanded')){h.click();await sleep(400);}
        }
        await sleep(1200);

        const attempts = new Map();
        let round = 0;

        while (!stopped && round<40) {
            round++;

            // 確認在課程頁
            if (!location.href.includes('/learning/')) {
                log('⚠️ 頁面跑掉，停止','#ef4444'); break;
            }

            // 找未測驗
            const freshBtns=[...document.querySelectorAll('button')]
                .filter(b=>b.textContent?.trim()==='未測驗'&&b.offsetParent!==null&&!b.dataset.skip);

            if (!freshBtns.length){log('✅ 全部完成！','#22c55e');setStatus('🎉 全部完成','#22c55e');break;}

            const btn = freshBtns[0];
            const p2=btn.closest('mat-expansion-panel');
            const gName=p2?.querySelector('mat-expansion-panel-header')?.innerText?.trim()?.substring(0,25)||`測驗${round}`;
            const cnt=attempts.get(gName)||0;

            if (cnt>=3){
                log(`⏭ 跳過「${gName}」`,'#f59e0b');
                btn.dataset.skip='1'; continue;
            }
            attempts.set(gName,cnt+1);

            log(`\n🎯 [${round}]「${gName}」(第${cnt+1}次)`,'#60a5fa');
            setStatus(`測驗：${gName}`,'#a78bfa');

            btn.scrollIntoView({behavior:'smooth',block:'center'});
            await sleep(600);
            btn.click();
            await sleep(3500);

            const result = await enterAndAnswer(gName);
            log(`  結果：${result}`,result==='passed'?'#22c55e':'#f59e0b');

            await sleep(1500);

            // 回課程簡介
            const homeTab=[...document.querySelectorAll('[role="tab"],.mat-tab-label')]
                .find(el=>/課程簡介/.test(el.textContent));
            if(homeTab){homeTab.click();await sleep(1500);}

            // 重新展開
            for(const h of document.querySelectorAll('mat-expansion-panel-header')){
                const p=h.closest('mat-expansion-panel');
                if(!p?.classList.contains('mat-expanded')){h.click();await sleep(300);}
            }
            await sleep(800);
        }
    };

    log('✅ v7.1 就緒 - 修正側欄誤點問題','#4f8ef7');
    log('側欄 x > '+(window.innerWidth-750)+' 的按鈕會被排除','#60a5fa');
    log('━━━','#334155');
    log('【全自動】按「🚀 全自動」','#60a5fa');
    log('【手動】側欄點「未測驗」→「▶ 進入測驗」→「📝 答題」','#60a5fa');
    setStatus('請選擇操作','#60a5fa');
})();
