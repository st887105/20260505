// MOOCS v9.4 - 架構修正：說明頁不存在，點連結直接進作答頁
// v9.1 問題：waitForInfoPage 一直等說明頁，但說明頁根本不會出現
// v9.4 修正：點連結 → 直接等 div.question-wrap 出現 → 答題
(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let AI_ENGINE  = localStorage.getItem('moocs_ai_engine') || '';
    let GEMINI_KEY = localStorage.getItem('moocs_gemini_key') || '';
    let CLAUDE_KEY = localStorage.getItem('moocs_claude_key') || '';

    if (!AI_ENGINE || (AI_ENGINE==='gemini'&&!GEMINI_KEY) || (AI_ENGINE==='claude'&&!CLAUDE_KEY)) {
        const result = await showSetupDialog();
        if (!result) return;
        AI_ENGINE=result.engine; GEMINI_KEY=result.geminiKey; CLAUDE_KEY=result.claudeKey;
        localStorage.setItem('moocs_ai_engine',AI_ENGINE);
        localStorage.setItem('moocs_gemini_key',GEMINI_KEY);
        localStorage.setItem('moocs_claude_key',CLAUDE_KEY);
    }

    function showSetupDialog() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.style.cssText='position:fixed;inset:0;z-index:9999998;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center';
            const sE=localStorage.getItem('moocs_ai_engine')||'gemini';
            const sG=localStorage.getItem('moocs_gemini_key')||'';
            const sC=localStorage.getItem('moocs_claude_key')||'';
            overlay.innerHTML=`<div style="background:#13151f;border:1px solid #2a2d3e;border-radius:16px;padding:28px 32px;width:480px;max-width:95vw;color:#e2e8f0;font-family:monospace">
              <div style="font-size:16px;font-weight:bold;color:#4f8ef7;margin-bottom:18px">🎓 MOOCS v9.4 ─ AI 引擎設定</div>
              <div style="margin-bottom:16px"><div style="font-size:11px;color:#64748b;margin-bottom:8px">選擇 AI 引擎</div>
              <div style="display:flex;gap:10px">
                <label id="lbl-g" style="flex:1;border:2px solid #22c55e;border-radius:10px;padding:12px;cursor:pointer;background:#0a1f0a;text-align:center">
                  <input type="radio" name="engine" value="gemini" ${sE==='gemini'?'checked':''} style="display:none">
                  <div style="font-size:18px">🌟</div><div style="font-size:13px;font-weight:bold;color:#22c55e;margin-top:4px">Google Gemini</div>
                  <div style="font-size:10px;color:#64748b;margin-top:3px">免費額度大・速度快</div></label>
                <label id="lbl-c" style="flex:1;border:2px solid #2a2d3e;border-radius:10px;padding:12px;cursor:pointer;background:#0d0a1f;text-align:center">
                  <input type="radio" name="engine" value="claude" ${sE==='claude'?'checked':''} style="display:none">
                  <div style="font-size:18px">🤖</div><div style="font-size:13px;font-weight:bold;color:#a78bfa;margin-top:4px">Anthropic Claude</div>
                  <div style="font-size:10px;color:#64748b;margin-top:3px">回答精準・繁體優</div></label>
              </div></div>
              <div id="bg" style="margin-bottom:14px;${sE==='claude'?'display:none':''}">
                <div style="font-size:11px;color:#22c55e;margin-bottom:5px">🌟 Gemini API Key</div>
                <input id="ig" type="password" placeholder="AIza..." value="${sG}" style="width:100%;box-sizing:border-box;background:#0a0c14;border:1px solid #2a2d3e;border-radius:7px;padding:9px 12px;color:#e2e8f0;font-size:12px;font-family:monospace">
                <div style="margin-top:6px;font-size:10px;color:#475569">💡 <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#22c55e">aistudio.google.com/app/apikey</a></div></div>
              <div id="bc" style="margin-bottom:14px;${sE==='gemini'?'display:none':''}">
                <div style="font-size:11px;color:#a78bfa;margin-bottom:5px">🤖 Claude API Key</div>
                <input id="ic" type="password" placeholder="sk-ant-..." value="${sC}" style="width:100%;box-sizing:border-box;background:#0a0c14;border:1px solid #2a2d3e;border-radius:7px;padding:9px 12px;color:#e2e8f0;font-size:12px;font-family:monospace">
                <div style="margin-top:6px;font-size:10px;color:#475569">💡 <a href="https://console.anthropic.com" target="_blank" style="color:#a78bfa">console.anthropic.com</a></div></div>
              <div style="display:flex;gap:8px;margin-top:18px">
                <button id="bs" style="flex:1;padding:11px;background:#1a3a1a;color:#22c55e;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold">✅ 儲存並開始</button>
                <button id="bc2" style="padding:11px 18px;background:#2a1a1a;color:#ef4444;border:none;border-radius:8px;cursor:pointer;font-size:12px">✕ 取消</button>
              </div></div>`;
            document.body.appendChild(overlay);
            const lgEl=overlay.querySelector('#lbl-g'),lcEl=overlay.querySelector('#lbl-c');
            const bgEl=overlay.querySelector('#bg'),bcEl=overlay.querySelector('#bc');
            function upd(){
                const s=overlay.querySelector('input[name="engine"]:checked')?.value||'gemini';
                lgEl.style.borderColor=s==='gemini'?'#22c55e':'#2a2d3e'; lgEl.style.background=s==='gemini'?'#0a1f0a':'#0d0d14';
                lcEl.style.borderColor=s==='claude'?'#a78bfa':'#2a2d3e'; lcEl.style.background=s==='claude'?'#0d0a1f':'#0d0d14';
                bgEl.style.display=s==='gemini'?'':'none'; bcEl.style.display=s==='claude'?'':'none';
            }
            overlay.querySelectorAll('input[name="engine"]').forEach(r=>r.addEventListener('change',upd));
            [lgEl,lcEl].forEach(l=>l.addEventListener('click',()=>{l.querySelector('input').checked=true;upd();}));
            upd();
            overlay.querySelector('#bs').addEventListener('click',()=>{
                const e=overlay.querySelector('input[name="engine"]:checked')?.value||'gemini';
                const g=overlay.querySelector('#ig').value.trim(),c=overlay.querySelector('#ic').value.trim();
                const nk=e==='gemini'?g:c;
                if(!nk){const i=e==='gemini'?overlay.querySelector('#ig'):overlay.querySelector('#ic');i.style.borderColor='#ef4444';i.placeholder='⚠️ 請輸入 API Key！';return;}
                overlay.remove();resolve({engine:e,geminiKey:g,claudeKey:c});
            });
            overlay.querySelector('#bc2').addEventListener('click',()=>{overlay.remove();resolve(null);});
        });
    }

    document.getElementById('moocs-v90')?.remove();
    const panel=document.createElement('div');
    panel.id='moocs-v90';
    panel.style.cssText='position:fixed;top:80px;left:20px;width:340px;z-index:999999;background:#13151f;color:#e2e8f0;border-radius:14px;font-family:monospace;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,.8);border:1px solid #2a2d3e;overflow:hidden';
    const el2=AI_ENGINE==='gemini'?'<span style="color:#22c55e">🌟 Gemini</span>':'<span style="color:#a78bfa">🤖 Claude</span>';
    panel.innerHTML=`
        <div id="mv90-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;color:#4f8ef7">🎓 MOOCS v9.4 ${el2}</span>
            <div style="display:flex;gap:8px;align-items:center">
                <span id="mv90-cfg" style="cursor:pointer;font-size:10px;color:#64748b;border:1px solid #2a2d3e;padding:2px 6px;border-radius:4px">⚙️ 切換引擎</span>
                <span id="mv90-close" style="cursor:pointer;opacity:.5">✕</span>
            </div>
        </div>
        <div id="mv90-status" style="padding:6px 14px;font-size:11px;color:#64748b;background:#0f1117;border-bottom:1px solid #1a1d27">等待操作</div>
        <div id="mv90-timer" style="padding:3px 14px;font-size:10px;color:#22c55e;background:#0a0f0a;border-bottom:1px solid #1a1d27">⏳ 等待</div>
        <div style="background:#0a0c14"><div id="mv90-log" style="max-height:240px;overflow-y:auto;padding:4px 14px"></div></div>
        <div style="padding:10px 14px;border-top:1px solid #1a1d27;display:flex;gap:6px">
            <button id="mv90-auto" style="flex:1;padding:8px;background:#1a3a1a;color:#22c55e;border:none;border-radius:7px;cursor:pointer;font-size:11px">🚀 全自動測驗</button>
            <button id="mv90-now"  style="flex:1;padding:8px;background:#2a1a3a;color:#a78bfa;border:none;border-radius:7px;cursor:pointer;font-size:11px">📝 現在答題</button>
            <button id="mv90-stop" style="padding:8px 10px;background:#3d1a1a;color:#ef4444;border:none;border-radius:7px;cursor:pointer">⏹</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped=false;
    document.getElementById('mv90-close').onclick=()=>panel.remove();
    document.getElementById('mv90-stop').onclick=()=>{stopped=true;log('⏹ 停止','#f59e0b');};
    document.getElementById('mv90-auto').onclick=()=>{stopped=false;runAll();};
    document.getElementById('mv90-now').onclick=()=>{stopped=false;doQuiz('手動');};
    document.getElementById('mv90-cfg').onclick=async()=>{
        localStorage.removeItem('moocs_ai_engine');
        const r=await showSetupDialog();
        if(r){AI_ENGINE=r.engine;GEMINI_KEY=r.geminiKey;CLAUDE_KEY=r.claudeKey;
            localStorage.setItem('moocs_ai_engine',AI_ENGINE);localStorage.setItem('moocs_gemini_key',GEMINI_KEY);localStorage.setItem('moocs_claude_key',CLAUDE_KEY);
            panel.querySelector('#mv90-hdr span').innerHTML='🎓 MOOCS v9.4 '+(AI_ENGINE==='gemini'?'<span style="color:#22c55e">🌟 Gemini</span>':'<span style="color:#a78bfa">🤖 Claude</span>');
            log('✅ 已切換至 '+AI_ENGINE,'#4f8ef7');}
    };
    let drag=false,ox,oy;
    document.getElementById('mv90-hdr').onmousedown=e=>{drag=true;ox=e.clientX-panel.offsetLeft;oy=e.clientY-panel.offsetTop;};
    document.onmousemove=e=>{if(!drag)return;panel.style.left=(e.clientX-ox)+'px';panel.style.top=(e.clientY-oy)+'px';panel.style.right='auto';panel.style.bottom='auto';};
    document.onmouseup=()=>drag=false;

    function log(msg,c='#94a3b8'){
        const el=document.getElementById('mv90-log');if(!el)return;
        const t=new Date().toLocaleTimeString('zh-TW');
        el.innerHTML+=`<div style="color:${c};line-height:1.8"><span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop=el.scrollHeight;
    }
    function setStatus(msg,c='#64748b'){const e=document.getElementById('mv90-status');if(e){e.textContent=msg;e.style.color=c;}}
    function setTimer(msg,c='#22c55e'){const e=document.getElementById('mv90-timer');if(e){e.textContent=msg;e.style.color=c;}}
    function startCountdown(label,sec){
        let r=sec;setTimer(`⏱ ${label}：${r}秒`,'#22c55e');
        const tid=setInterval(()=>{if(stopped||r<=0){clearInterval(tid);return;}r--;setTimer(`⏱ ${label}：${r}秒`,r<5?'#f59e0b':'#22c55e');},1000);
        return tid;
    }

    // ── Selector 工具（全部已用瀏覽器 debug 確認）──
    // ✅ v9.4 修正：說明頁按鈕真實 class = button.qs-btn.qs-btn--primary
    function findEnterBtn(){
        // 策略1：真實 class（MutationObserver 實測確認）
        const b = document.querySelector('button.qs-btn.qs-btn--primary, button.qs-btn--primary');
        if(b&&b.offsetWidth>0&&!b.closest('#moocs-v90'))return b;
        // 策略2：備援 — 任何含「進入測驗/開始測驗」且可見的按鈕
        return [...document.querySelectorAll('button')]
            .find(b=>/進入測驗|開始測驗/.test(b.textContent?.trim())&&b.offsetWidth>0&&!b.closest('#moocs-v90'))||null;
    }
    // 作答頁偵測
    function isAnswerPageVisible(){
        const w=document.querySelector('div.question-wrap');
        return !!(w&&w.offsetParent);
    }
    // 說明頁偵測
    function isInfoPageVisible(){
        return !!findEnterBtn();
    }
    // 等說明頁或作答頁，若說明頁出現就自動點「進入測驗」
    async function waitForAnswerPage(ms=15000){
        for(let i=0;i<ms/300;i++){
            if(stopped)return'stopped';
            // 說明頁出現：自動點進入測驗
            const enterBtn=findEnterBtn();
            if(enterBtn){
                log('  📋 說明頁出現，點進入測驗','#22c55e');
                enterBtn.click();
                await sleep(2000);
                // 等作答頁
                for(let j=0;j<30;j++){
                    if(isAnswerPageVisible())return'ok';
                    await sleep(300);
                }
            }
            if(isAnswerPageVisible())return'ok';
            await sleep(300);
        }
        return'timeout';
    }
    // 下一題：button.btn-control.--right
    function findNextBtn(){
        const b=document.querySelector('button.btn-control.--right,button[class*="btn-control"][class*="--right"]');
        if(b&&!b.disabled&&b.offsetParent)return b;
        return[...document.querySelectorAll('button')].find(b=>/^下一題$|^下一$|^Next$/.test(b.textContent?.trim())&&b.offsetParent&&!b.closest('#moocs-v90')&&!b.disabled)||null;
    }
    // 送出按鈕
    function findSubmitBtn(){
        return[...document.querySelectorAll('button')].find(b=>/^(送出|提交|繳交|Submit)$/.test(b.textContent?.trim())&&!b.disabled&&b.offsetParent&&!b.closest('#moocs-v90'))||null;
    }
    // 選項：label.question__option
    function getOptions(){
        const a=[...document.querySelectorAll('label.question__option')].filter(o=>o.offsetParent&&o.innerText?.trim());
        if(a.length)return a;
        const b=[...document.querySelectorAll('li.question__option-wrap label')].filter(o=>o.offsetParent&&o.innerText?.trim());
        if(b.length)return b;
        return[...document.querySelectorAll('input[type="radio"]')].filter(r=>r.offsetParent).map(r=>r.closest('li,div,label')||r.parentElement).filter(Boolean);
    }
    // 題目容器：div.question-wrap
    function getQuestionEl(){
        const w=document.querySelector('div.question-wrap');
        return(w&&w.offsetParent)?w:null;
    }
    // 萃取題幹（去掉前綴和選項）
    function getQuestionText(el){
        if(!el)return'';
        const opts=[...document.querySelectorAll('label.question__option')].map(o=>o.innerText?.trim()).filter(Boolean);
        let txt=el.innerText?.trim()||'';
        // 取第一個選項文字之前的部分
        if(opts.length){const idx=txt.indexOf(opts[0]);if(idx>0)txt=txt.slice(0,idx);}
        return txt.replace(/^Q\d+\s*[\/｜]\s*(單選題|是非題|多選題)\s*\d+\s*分\s*/i,'').trim();
    }

    // ── AI 詢問 ──
    async function askAI(q,opts_text,type,retry=0){
        await sleep(800);
        return AI_ENGINE==='gemini'?askGemini(q,opts_text,type,retry):askClaude(q,opts_text,type,retry);
    }
    async function askGemini(q,opts_text,type,retry=0){
        const isYN=type?.includes('是非');
        const prompt=isYN?`台灣教育訓練是非題，只回答0（正確）或1（錯誤），不要解釋：\n${q}`:`台灣教育訓練單選題，選最正確答案，只回答數字（從0開始），不要解釋：\n題目：${q}\n選項：\n${opts_text}`;
        try{
            const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:10,temperature:0}})});
            if(res.status===429){const w=[20,40,80][retry]||80;log(`  ⚠️ Gemini 429，等${w}s`,'#f59e0b');await sleep(w*1000);return askGemini(q,opts_text,type,retry+1);}
            const data=await res.json();const parts=data?.candidates?.[0]?.content?.parts;
            return(parts?parts[parts.length-1]?.text?.trim():'')?.match(/\d/)?.[0]||'0';
        }catch(e){log('❌ Gemini：'+e.message,'#ef4444');return'0';}
    }
    async function askClaude(q,opts_text,type,retry=0){
        const isYN=type?.includes('是非');
        const prompt=isYN?`台灣教育訓練是非題，只回答0（正確）或1（錯誤），不要解釋：\n${q}`:`台灣教育訓練單選題，選最正確答案，只回答數字（從0開始），不要解釋：\n題目：${q}\n選項：\n${opts_text}`;
        try{
            const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':CLAUDE_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:10,messages:[{role:'user',content:prompt}]})});
            if(res.status===429){const w=[20,40,80][retry]||80;log(`  ⚠️ Claude 429，等${w}s`,'#f59e0b');await sleep(w*1000);return askClaude(q,opts_text,type,retry+1);}
            const data=await res.json();return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0]||'0';
        }catch(e){log('❌ Claude：'+e.message,'#ef4444');return'0';}
    }

    // ── 核心答題迴圈（直接對作答頁，無說明頁邏輯）──
    async function doQuiz(name){
        if(stopped)return'stopped';
        log(`\n📝 答題：「${name}」`,'#a78bfa');
        setStatus(`答題中：${name}`,'#a78bfa');
        let answered=0,noQCount=0,prevQ='',sameQRepeat=0;
        for(let i=0;i<80;i++){
            if(stopped)return'stopped';
            const qEl=getQuestionEl();
            if(!qEl){
                noQCount++;
                if(answered>0&&noQCount>=5){log(`  ✅ 答完（${answered}題）`,'#22c55e');break;}
                if(i>10&&noQCount>=5){log('  ℹ️ 無題目，結束','#64748b');break;}
                await sleep(500);continue;
            }
            noQCount=0;
            const q=getQuestionText(qEl);
            if(!q){await sleep(500);continue;}
            if(q===prevQ){
                sameQRepeat++;
                if(sameQRepeat>=4){
                    log('  ⚠️ 題目卡住，強制','#f59e0b');
                    const sub=findSubmitBtn();
                    if(sub){sub.click();log('  📤 強制送出','#22c55e');await sleep(3000);break;}
                    const nxt=findNextBtn();if(nxt){nxt.click();await sleep(1500);}
                    sameQRepeat=0;continue;
                }
                await sleep(600);continue;
            }
            prevQ=q;sameQRepeat=0;
            const typeMatch=(qEl.innerText||'').match(/(單選題|是非題|多選題)/);
            const type=typeMatch?.[1]||'';
            const opts=getOptions();
            if(!opts.length){await sleep(600);continue;}
            const opts_text=opts.map((o,i)=>`${i}: ${o.innerText?.trim()||o.value||''}`).join('\n');
            log(`  Q${answered+1}[${type||'單選'}]: ${q.substring(0,45)}`,'#a78bfa');
            const ans=await askAI(q,opts_text,type);
            const idx=Math.min(parseInt(ans)||0,opts.length-1);
            const target=opts[idx];
            const radio=target?.querySelector?.('input[type="radio"]')||(target?.tagName==='INPUT'?target:null);
            if(radio)radio.click();
            target?.click();
            log(`  → 選${idx}：${(target?.innerText||'').trim().substring(0,20)}`,'#22c55e');
            answered++;
            await sleep(500);
            const nxt=findNextBtn();
            if(nxt){log('  → ▶ 下一題','#60a5fa');nxt.click();await sleep(1500);continue;}
            await sleep(400);
            const sub=findSubmitBtn();
            if(sub){log('  📤 送出','#22c55e');sub.click();await sleep(3000);break;}
            log('  ⚠️ 找不到翻頁/送出，診斷：','#f59e0b');
            [...document.querySelectorAll('button')].filter(b=>b.offsetParent&&!b.closest('#moocs-v90'))
                .forEach(b=>log(`    btn:"${b.textContent?.trim().slice(0,15)}" cls:"${b.className.slice(0,35)}"` ,'#334155'));
            await sleep(1500);
        }
        await sleep(2000);
        const done=[...document.querySelectorAll('button,a')].find(b=>/完成測驗/.test(b.textContent?.trim())&&b.offsetParent&&!b.closest('#moocs-v90'));
        if(done){done.click();log('  📋 完成測驗','#60a5fa');await sleep(3000);}
        await sleep(1500);
        const retest=[...document.querySelectorAll('button,a')].find(b=>/重新測驗/.test(b.textContent?.trim())&&b.offsetParent);
        if(retest){log('  ⚠️ 未達標，重測','#f59e0b');return'retest';}
        log('  🎉 通過！','#22c55e');setStatus('🎉 通過','#22c55e');return'passed';
    }

    // ── 全自動流程（v9.2：點連結→等作答頁→答題）──
    async function runAll(){
        log('\n🚀 全自動開始','#4f8ef7');setStatus('掃描中...','#4f8ef7');
        const expandAll=async()=>{
            for(const h of document.querySelectorAll('mat-expansion-panel-header')){
                const p=h.closest('mat-expansion-panel');
                if(!p?.classList.contains('mat-expanded')){h.click();await sleep(300);}
            }
            await sleep(800);
        };
        await expandAll();
        const skipSet=new Set(),attemptMap=new Map();let round=0;
        while(!stopped&&round<50){
            round++;
            if(!location.href.includes('/learning/')){log('⚠️ 頁面離開','#ef4444');break;}
            const quizBtns=[...document.querySelectorAll('button')].filter(b=>b.textContent?.trim()==='未測驗'&&b.offsetParent);
            const pending=quizBtns.filter(b=>!skipSet.has(b));
            if(!pending.length){log('\n✅ 全部完成！','#22c55e');setStatus('🎉 完成','#22c55e');break;}
            const btn=pending[0];
            const titleEl=btn.closest('.syllabus__list-item,li')?.querySelector('.course-node__title,p,[class*="title"]');
            const gName=titleEl?.innerText?.trim().slice(0,30)||btn.closest('mat-expansion-panel')?.querySelector('mat-expansion-panel-header')?.innerText?.trim().slice(0,30)||`測驗${round}`;
            const cnt=attemptMap.get(gName)||0;
            if(cnt>=3){log(`⏭ 跳過「${gName}」（已試${cnt}次）`,'#f59e0b');skipSet.add(btn);continue;}
            attemptMap.set(gName,cnt+1);
            log(`\n🎯 [${round}]「${gName}」第${cnt+1}次`,'#60a5fa');
            setStatus(`點擊：${gName}`,'#a78bfa');
            // ✅ 點父層 <a>（直接進作答頁，無說明頁）
            const link=btn.closest('a.syllabus__item-content,a.course-node,a')||btn;
            link.scrollIntoView({behavior:'smooth',block:'center'});
            await sleep(600);
            link.click();
            // ✅ 等作答頁（div.question-wrap 出現）
            const tid=startCountdown('等作答頁',12);
            const state=await waitForAnswerPage(12000);
            clearInterval(tid);
            if(state==='stopped')break;
            if(state==='timeout'){
                log('  ⚠️ 作答頁未出現，跳過','#f59e0b');
                skipSet.add(btn);history.back();await sleep(2000);await expandAll();continue;
            }
            log('  ✅ 作答頁已出現，答題中','#22c55e');
            await sleep(500);
            const result=await doQuiz(gName);
            log(`  結果：${result}`,result==='passed'?'#22c55e':'#f59e0b');
            await sleep(1000);
            history.back();await sleep(2500);await expandAll();
        }
    }

    const eStr=AI_ENGINE==='gemini'?'🌟 Gemini 2.0 Flash':'🤖 Claude Haiku';
    log(`✅ v9.4 就緒｜引擎：${eStr}`,'#4f8ef7');
    log('【🚀 全自動測驗】掃描所有未測驗並自動答題','#60a5fa');
    log('【📝 現在答題】對當前作答頁直接答題','#60a5fa');
    log('v9.4 修正：說明頁不存在，直接等作答頁','#334155');
    setStatus('請選擇操作','#60a5fa');
})();
