// MOOCS v8.0 - 最終版：確認說明頁載入機制
(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let KEY = localStorage.getItem('moocs_claude_key');
    if (!KEY) { KEY = prompt('Claude API Key：'); if (!KEY) return; localStorage.setItem('moocs_claude_key', KEY); }

    document.getElementById('moocs-v80')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v80';
    panel.style.cssText = 'position:fixed;top:80px;left:20px;width:340px;z-index:999999;background:#13151f;color:#e2e8f0;border-radius:14px;font-family:monospace;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,.8);border:1px solid #2a2d3e;overflow:hidden';
    panel.innerHTML = `
        <div id="mv80-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;color:#4f8ef7">🎓 MOOCS v8.0 ✅</span>
            <span id="mv80-close" style="cursor:pointer;opacity:.5">✕</span>
        </div>
        <div id="mv80-status" style="padding:6px 14px;font-size:11px;color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">等待操作</div>
        <div id="mv80-timer" style="padding:3px 14px;font-size:10px;color:#22c55e;background:#0a0f0a;border-bottom:1px solid #1a1d27">⏳ 等待</div>
        <div style="background:#0a0c14"><div id="mv80-log" style="max-height:260px;overflow-y:auto;padding:4px 14px"></div></div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:6px">
            <button id="mv80-auto" style="flex:1;padding:8px;background:#1a3a1a;color:#22c55e;border:none;border-radius:7px;cursor:pointer;font-size:11px">🚀 全自動測驗</button>
            <button id="mv80-now" style="flex:1;padding:8px;background:#2a1a3a;color:#a78bfa;border:none;border-radius:7px;cursor:pointer;font-size:11px">📝 現在答題</button>
            <button id="mv80-stop" style="padding:8px 10px;background:#3d1a1a;color:#ef4444;border:none;border-radius:7px;cursor:pointer">⏹</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false;
    document.getElementById('mv80-close').onclick = () => panel.remove();
    document.getElementById('mv80-stop').onclick = () => { stopped = true; log('⏹ 停止', '#f59e0b'); };
    document.getElementById('mv80-auto').onclick = () => { stopped = false; runAll(); };
    document.getElementById('mv80-now').onclick = () => { stopped = false; doQuizFromInfoPage('手動'); };

    let drag=false,ox,oy;
    document.getElementById('mv80-hdr').onmousedown=e=>{drag=true;ox=e.clientX-panel.offsetLeft;oy=e.clientY-panel.offsetTop;};
    document.onmousemove=e=>{if(!drag)return;panel.style.left=(e.clientX-ox)+'px';panel.style.top=(e.clientY-oy)+'px';panel.style.right='auto';panel.style.bottom='auto';};
    document.onmouseup=()=>drag=false;

    function log(msg,c='#94a3b8'){
        const el=document.getElementById('mv80-log');if(!el)return;
        const t=new Date().toLocaleTimeString('zh-TW');
        el.innerHTML+=`<div style="color:${c};line-height:1.8"><span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop=el.scrollHeight;
    }
    function setStatus(msg,c='#64748b'){const e=document.getElementById('mv80-status');if(e){e.textContent=msg;e.style.color=c;}}
    function setTimer(msg,c='#22c55e'){const e=document.getElementById('mv80-timer');if(e){e.textContent=msg;e.style.color=c;}}

    function startCountdown(label,sec){
        let r=sec; setTimer(`⏱ ${label}：${r}秒`,'#22c55e');
        const tid=setInterval(()=>{if(stopped||r<=0){clearInterval(tid);return;}r--;setTimer(`⏱ ${label}：${r}秒`,r<10?'#f59e0b':'#22c55e');},1000);
        return tid;
    }

    // ── 等待 /qti-detail 請求（說明頁載入的訊號）
    function waitForQtiDetail(timeoutMs=15000){
        return new Promise(resolve=>{
            let done=false;
            const orig=window.fetch;
            const timer=setTimeout(()=>{if(!done){done=true;window.fetch=orig;resolve('timeout');}},timeoutMs);
            window.fetch=async function(...args){
                const url=args[0]?.toString()||'';
                const p=orig.apply(this,args);
                if(/qti-detail|quiz-detail|exam-detail/.test(url)&&!done){
                    done=true;clearTimeout(timer);window.fetch=orig;
                    log('  ✅ 說明頁 API 觸發（qti-detail）','#22c55e');
                    setTimeout(resolve,800,'ok');
                }
                return p;
            };
        });
    }

    // ── Claude ───────────────────────────────────
    async function askClaude(q,opts_text,type,retry=0){
        await sleep(1500);
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
            if(res.status===429){const w=[20,40,80][retry]||80;await sleep(w*1000);return askClaude(q,opts_text,type,retry+1);}
            const data=await res.json();
            return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0]||'0';
        }catch(e){log('❌ '+e.message,'#ef4444');return '0';}
    }

    function findRightArrow(){
        return [...document.querySelectorAll('button,[role="button"]')]
            .find(el=>{
                if(el.closest('#moocs-v80'))return false;
                const r=el.getBoundingClientRect();
                return r.right>=innerWidth-300&&r.right<=innerWidth-50
                    &&r.top>200&&r.top<innerHeight-100&&r.width>0&&r.width<100;
            });
    }

    // ══════════════════════════════════════════════
    // 找說明頁的「進入測驗」大按鈕
    // 關鍵：說明頁在主內容區（左半部），按鈕 x < innerWidth-500
    // ══════════════════════════════════════════════
    function findInfoPageEnterBtn(){
        const mainLimit = innerWidth - 500; // 右側欄大約500px
        const all = [...document.querySelectorAll('button,a')]
            .filter(b=>{
                if(b.closest('#moocs-v80'))return false;
                if(!b.offsetParent)return false;
                const txt=b.textContent?.trim()||'';
                if(!/^進入測驗$|^開始測驗$/.test(txt))return false;
                const r=b.getBoundingClientRect();
                return r.left < mainLimit && r.width > 60;
            });
        if(!all.length)return null;
        // 選最寬的（主內容大按鈕）
        return all.reduce((a,b)=>b.getBoundingClientRect().width>a.getBoundingClientRect().width?b:a);
    }

    // ══════════════════════════════════════════════
    // 從說明頁開始：找進入測驗 → 答題 → 判斷結果
    // ══════════════════════════════════════════════
    async function doQuizFromInfoPage(name, attempt=1){
        if(stopped)return 'stopped';
        if(attempt>6){log('❌ 超過6次','#ef4444');return 'failed';}

        log(`\n📝「${name}」第${attempt}次`,'#a78bfa');
        setStatus(`測驗：${name}（${attempt}次）`,'#a78bfa');

        // 現在應該在說明頁，找進入測驗按鈕
        // 最多等 15 秒讓說明頁完整渲染
        let enterBtn=null;
        const tid=startCountdown('等說明頁按鈕',15);
        for(let t=0;t<30;t++){
            enterBtn=findInfoPageEnterBtn();
            if(enterBtn)break;
            await sleep(500);
        }
        clearInterval(tid);

        if(!enterBtn){
            log('  ❌ 主內容區找不到進入測驗','#ef4444');
            // 診斷：印出所有進入測驗按鈕
            [...document.querySelectorAll('button,a')]
                .filter(b=>/進入測驗|開始測驗/.test(b.textContent)&&b.offsetParent)
                .forEach(b=>{
                    const r=b.getBoundingClientRect();
                    log(`  診斷：「${b.textContent?.trim()}」x:${Math.round(r.left)} w:${Math.round(r.width)}`,'#334155');
                });
            return 'no_enter';
        }

        const r=enterBtn.getBoundingClientRect();
        log(`  ✅ 點進入測驗（x:${Math.round(r.left)} w:${Math.round(r.width)}）`,'#22c55e');
        enterBtn.click();
        await sleep(3000);

        // 等題目出現
        let hasQ=false;
        for(let t=0;t<20;t++){
            if(document.querySelector('.question__title,.question-title')?.offsetParent){hasQ=true;break;}
            await sleep(500);
        }
        if(!hasQ){log('  ⚠️ 題目未出現','#f59e0b');}

        // 答題迴圈
        let answered=0,noQ=0;
        for(let i=0;i<50;i++){
            if(stopped)return 'stopped';

            const qEl=document.querySelector('.question__title,.question-title,[class*="question__title"]');
            if(!qEl||!qEl.offsetParent){
                noQ++;
                if(answered>0&&noQ>=4){log(`  ✅ 答完（${answered}題）`,'#22c55e');break;}
                if(i>10&&noQ>=4){log('  ℹ️ 無題目','#64748b');break;}
                await sleep(700);continue;
            }
            noQ=0;

            const q=qEl.innerText.trim();
            const type=document.querySelector('.quesiton__type-and-index,.question__type-and-index,[class*="type-and-index"]')?.innerText||'';
            const opts=[...document.querySelectorAll('moocs-question label,.question-wrap label,fieldset label')]
                .filter(o=>o.offsetParent!==null);

            if(!opts.length){await sleep(1000);continue;}

            const opts_text=opts.map((o,i)=>`${i}: ${o.innerText.trim()}`).join('\n');
            log(`  Q${answered+1}[${type.includes('是非')?'是非':'單選'}]: ${q.substring(0,40)}`,'#a78bfa');

            const ans=await askClaude(q,opts_text,type);
            const idx=Math.min(parseInt(ans)||0,opts.length-1);
            opts[idx]?.click();
            log(`  → 選${idx}：${opts[idx]?.innerText?.trim()?.substring(0,20)}`,'#22c55e');
            answered++;
            await sleep(1000);

            // 送出
            const sub=[...document.querySelectorAll('button')]
                .find(b=>/^(送出|提交|繳交)$/.test(b.textContent?.trim())&&!b.disabled&&b.offsetParent&&!b.closest('#moocs-v80'));
            if(sub){await sleep(400);sub.click();log('  📤 送出！','#22c55e');await sleep(4000);break;}

            // 下一題
            const nxt=[...document.querySelectorAll('button')]
                .find(b=>/^下一題$|^下一$/.test(b.textContent?.trim())&&b.offsetParent&&!b.closest('#moocs-v80'));
            if(nxt){nxt.click();await sleep(1800);continue;}

            // 箭頭
            const arrow=findRightArrow();
            if(arrow){arrow.click();await sleep(1800);continue;}

            await sleep(1200);
        }

        // 完成測驗
        await sleep(2000);
        const done=[...document.querySelectorAll('button,a')]
            .find(b=>b.textContent?.trim()==='完成測驗'&&b.offsetParent&&!b.closest('#moocs-v80'));
        if(done){done.click();log('  📋 完成測驗','#60a5fa');await sleep(3000);}

        // 判斷通過
        await sleep(2000);
        const retest=[...document.querySelectorAll('button,a')]
            .find(b=>b.textContent?.trim()==='重新測驗'&&b.offsetParent);
        if(retest){
            log(`  ⚠️ 未達標，重測`,'#f59e0b');
            retest.click();await sleep(2500);
            // 重測時說明頁會再次出現
            await sleep(2000);
            return doQuizFromInfoPage(name,attempt+1);
        }

        log('  🎉 通過！','#22c55e');
        setStatus('🎉 通過','#22c55e');
        return 'passed';
    }

    // ══════════════════════════════════════════════
    // 全自動：點未測驗 → 等 qti-detail → 答題
    // ══════════════════════════════════════════════
    async function runAll(){
        log('\n🚀 全自動開始','#4f8ef7');
        setStatus('全自動掃描...','#4f8ef7');

        const goHome=async()=>{
            const tab=[...document.querySelectorAll('[role="tab"],.mat-tab-label')]
                .find(el=>/課程簡介/.test(el.textContent));
            if(tab){tab.click();await sleep(1500);}
            for(const h of document.querySelectorAll('mat-expansion-panel-header')){
                const p=h.closest('mat-expansion-panel');
                if(!p?.classList.contains('mat-expanded')){h.click();await sleep(400);}
            }
            await sleep(1000);
        };

        await goHome();

        const attempts=new Map();
        let round=0;

        while(!stopped&&round<40){
            round++;

            if(!location.href.includes('/learning/')){log('⚠️ 頁面跑掉','#ef4444');break;}

            const quizBtns=[...document.querySelectorAll('button')]
                .filter(b=>b.textContent?.trim()==='未測驗'&&b.offsetParent&&!b.dataset.skip);

            if(!quizBtns.length){log('\n✅ 全部完成！','#22c55e');setStatus('🎉 完成','#22c55e');break;}

            const btn=quizBtns[0];
            const p2=btn.closest('mat-expansion-panel');
            const gName=p2?.querySelector('mat-expansion-panel-header')?.innerText?.trim()?.substring(0,25)||`測驗${round}`;
            const cnt=attempts.get(gName)||0;

            if(cnt>=3){log(`⏭ 跳過「${gName}」`,'#f59e0b');btn.dataset.skip='1';continue;}
            attempts.set(gName,cnt+1);

            log(`\n🎯 [${round}]「${gName}」(第${cnt+1}次)`,'#60a5fa');
            setStatus(`點擊：${gName}`,'#a78bfa');

            // 設攔截，等 qti-detail
            const qtiPromise=waitForQtiDetail(12000);

            btn.scrollIntoView({behavior:'smooth',block:'center'});
            await sleep(500);
            btn.click();

            // 等說明頁 API
            log('  ⏳ 等待說明頁載入（qti-detail）...','#475569');
            const qtiResult=await qtiPromise;
            log(`  說明頁狀態：${qtiResult}`,'#475569');

            if(qtiResult==='timeout'){
                log('  ⚠️ 說明頁未觸發，跳過','#f59e0b');
                continue;
            }

            // 說明頁 API 已觸發，等 UI 渲染
            await sleep(1500);

            const result=await doQuizFromInfoPage(gName);
            log(`  結果：${result}`,result==='passed'?'#22c55e':'#f59e0b');

            await sleep(1500);
            await goHome();
        }
    }

    log('✅ v8.0 就緒','#4f8ef7');
    log('━━━ 操作 ━━━','#334155');
    log('【🚀 全自動測驗】掃描所有未測驗自動跑','#60a5fa');
    log('【📝 現在答題】在說明頁時直接點此答題','#60a5fa');
    log('💡 說明頁出現後可直接按「📝 現在答題」','#22c55e');
    setStatus('請選擇操作','#60a5fa');
})();
