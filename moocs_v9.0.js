// MOOCS v9.0 - 雙 AI 引擎（Gemini / Claude）+ 可行性全面修正
(async function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ══════════════════════════════════════════════
    // API 設定面板（首次執行選擇引擎）
    // ══════════════════════════════════════════════
    let AI_ENGINE  = localStorage.getItem('moocs_ai_engine') || '';   // 'gemini' | 'claude'
    let GEMINI_KEY = localStorage.getItem('moocs_gemini_key') || '';
    let CLAUDE_KEY = localStorage.getItem('moocs_claude_key') || '';

    // 如果沒有選擇引擎，先顯示設定視窗
    if (!AI_ENGINE || (AI_ENGINE === 'gemini' && !GEMINI_KEY) || (AI_ENGINE === 'claude' && !CLAUDE_KEY)) {
        const result = await showSetupDialog();
        if (!result) return;
        AI_ENGINE  = result.engine;
        GEMINI_KEY = result.geminiKey;
        CLAUDE_KEY = result.claudeKey;
        localStorage.setItem('moocs_ai_engine',  AI_ENGINE);
        localStorage.setItem('moocs_gemini_key', GEMINI_KEY);
        localStorage.setItem('moocs_claude_key', CLAUDE_KEY);
    }

    function showSetupDialog() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:9999998;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center';

            const savedEngine = localStorage.getItem('moocs_ai_engine') || 'gemini';
            const savedGemini = localStorage.getItem('moocs_gemini_key') || '';
            const savedClaude = localStorage.getItem('moocs_claude_key') || '';

            overlay.innerHTML = `
            <div style="background:#13151f;border:1px solid #2a2d3e;border-radius:16px;padding:28px 32px;width:480px;max-width:95vw;color:#e2e8f0;font-family:monospace">
              <div style="font-size:16px;font-weight:bold;color:#4f8ef7;margin-bottom:18px">🎓 MOOCS v9.0 ─ AI 引擎設定</div>

              <!-- 引擎選擇 -->
              <div style="margin-bottom:16px">
                <div style="font-size:11px;color:#64748b;margin-bottom:8px">選擇 AI 引擎</div>
                <div style="display:flex;gap:10px">
                  <label id="lbl-gemini" style="flex:1;border:2px solid #22c55e;border-radius:10px;padding:12px;cursor:pointer;background:#0a1f0a;text-align:center">
                    <input type="radio" name="engine" value="gemini" ${savedEngine==='gemini'?'checked':''} style="display:none">
                    <div style="font-size:18px">🌟</div>
                    <div style="font-size:13px;font-weight:bold;color:#22c55e;margin-top:4px">Google Gemini</div>
                    <div style="font-size:10px;color:#64748b;margin-top:3px">免費額度大・速度快</div>
                  </label>
                  <label id="lbl-claude" style="flex:1;border:2px solid #2a2d3e;border-radius:10px;padding:12px;cursor:pointer;background:#0d0a1f;text-align:center">
                    <input type="radio" name="engine" value="claude" ${savedEngine==='claude'?'checked':''} style="display:none">
                    <div style="font-size:18px">🤖</div>
                    <div style="font-size:13px;font-weight:bold;color:#a78bfa;margin-top:4px">Anthropic Claude</div>
                    <div style="font-size:10px;color:#64748b;margin-top:3px">回答精準・繁體優</div>
                  </label>
                </div>
              </div>

              <!-- Gemini Key 欄位 -->
              <div id="block-gemini" style="margin-bottom:14px;${savedEngine==='claude'?'display:none':''}">
                <div style="font-size:11px;color:#22c55e;margin-bottom:5px">🌟 Gemini API Key</div>
                <input id="inp-gemini" type="password" placeholder="AIza..." value="${savedGemini}"
                  style="width:100%;box-sizing:border-box;background:#0a0c14;border:1px solid #2a2d3e;border-radius:7px;padding:9px 12px;color:#e2e8f0;font-size:12px;font-family:monospace">
                <div style="margin-top:6px;font-size:10px;color:#475569">
                  💡 免費申請：
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#22c55e">aistudio.google.com/app/apikey</a>
                  → 登入 Google → 「Get API key」→ 「Create API key」→ 複製貼上
                </div>
                <div style="margin-top:4px;font-size:10px;color:#334155">
                  ✅ 免費額度：Gemini 2.0 Flash 每分鐘 15 次・每天 1500 次（足夠日常使用）
                </div>
              </div>

              <!-- Claude Key 欄位 -->
              <div id="block-claude" style="margin-bottom:14px;${savedEngine==='gemini'?'display:none':''}">
                <div style="font-size:11px;color:#a78bfa;margin-bottom:5px">🤖 Claude API Key</div>
                <input id="inp-claude" type="password" placeholder="sk-ant-..." value="${savedClaude}"
                  style="width:100%;box-sizing:border-box;background:#0a0c14;border:1px solid #2a2d3e;border-radius:7px;padding:9px 12px;color:#e2e8f0;font-size:12px;font-family:monospace">
                <div style="margin-top:6px;font-size:10px;color:#475569">
                  💡 申請：<a href="https://console.anthropic.com" target="_blank" style="color:#a78bfa">console.anthropic.com</a>
                  → 登入 → API Keys → Create Key
                </div>
                <div style="margin-top:4px;font-size:10px;color:#334155">
                  ⚠️ Claude 為付費 API，需先加值才能使用
                </div>
              </div>

              <!-- 按鈕 -->
              <div style="display:flex;gap:8px;margin-top:18px">
                <button id="btn-save" style="flex:1;padding:11px;background:#1a3a1a;color:#22c55e;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold">✅ 儲存並開始</button>
                <button id="btn-cancel" style="padding:11px 18px;background:#2a1a1a;color:#ef4444;border:none;border-radius:8px;cursor:pointer;font-size:12px">✕ 取消</button>
              </div>
            </div>`;

            document.body.appendChild(overlay);

            // 引擎切換動態效果
            const radios = overlay.querySelectorAll('input[name="engine"]');
            const lblGemini = overlay.querySelector('#lbl-gemini');
            const lblClaude = overlay.querySelector('#lbl-claude');
            const blockGemini = overlay.querySelector('#block-gemini');
            const blockClaude = overlay.querySelector('#block-claude');

            function updateEngineUI() {
                const sel = overlay.querySelector('input[name="engine"]:checked')?.value || 'gemini';
                lblGemini.style.borderColor  = sel==='gemini' ? '#22c55e' : '#2a2d3e';
                lblGemini.style.background   = sel==='gemini' ? '#0a1f0a' : '#0d0d14';
                lblClaude.style.borderColor  = sel==='claude' ? '#a78bfa' : '#2a2d3e';
                lblClaude.style.background   = sel==='claude' ? '#0d0a1f' : '#0d0d14';
                blockGemini.style.display    = sel==='gemini' ? '' : 'none';
                blockClaude.style.display    = sel==='claude' ? '' : 'none';
            }

            radios.forEach(r => r.addEventListener('change', updateEngineUI));
            // 點 label 也觸發
            [lblGemini, lblClaude].forEach(lbl => lbl.addEventListener('click', () => {
                const r = lbl.querySelector('input');
                r.checked = true;
                updateEngineUI();
            }));
            updateEngineUI();

            overlay.querySelector('#btn-save').addEventListener('click', () => {
                const engine    = overlay.querySelector('input[name="engine"]:checked')?.value || 'gemini';
                const geminiKey = overlay.querySelector('#inp-gemini').value.trim();
                const claudeKey = overlay.querySelector('#inp-claude').value.trim();
                const needKey   = engine==='gemini' ? geminiKey : claudeKey;
                if (!needKey) {
                    const inp = engine==='gemini'
                        ? overlay.querySelector('#inp-gemini')
                        : overlay.querySelector('#inp-claude');
                    inp.style.borderColor = '#ef4444';
                    inp.placeholder = '⚠️ 請輸入 API Key！';
                    return;
                }
                overlay.remove();
                resolve({ engine, geminiKey, claudeKey });
            });

            overlay.querySelector('#btn-cancel').addEventListener('click', () => {
                overlay.remove();
                resolve(null);
            });
        });
    }

    // ══════════════════════════════════════════════
    // 主面板
    // ══════════════════════════════════════════════
    document.getElementById('moocs-v90')?.remove();
    const panel = document.createElement('div');
    panel.id = 'moocs-v90';
    panel.style.cssText = 'position:fixed;top:80px;left:20px;width:340px;z-index:999999;background:#13151f;color:#e2e8f0;border-radius:14px;font-family:monospace;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,.8);border:1px solid #2a2d3e;overflow:hidden';

    const engineLabel = AI_ENGINE === 'gemini'
        ? '<span style="color:#22c55e">🌟 Gemini</span>'
        : '<span style="color:#a78bfa">🤖 Claude</span>';

    panel.innerHTML = `
        <div id="mv90-hdr" style="background:linear-gradient(135deg,#1e2130,#252840);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:move;border-bottom:1px solid #2a2d3e">
            <span style="font-weight:bold;color:#4f8ef7">🎓 MOOCS v9.0 ${engineLabel}</span>
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
            <button id="mv90-now" style="flex:1;padding:8px;background:#2a1a3a;color:#a78bfa;border:none;border-radius:7px;cursor:pointer;font-size:11px">📝 現在答題</button>
            <button id="mv90-stop" style="padding:8px 10px;background:#3d1a1a;color:#ef4444;border:none;border-radius:7px;cursor:pointer">⏹</button>
        </div>`;
    document.body.appendChild(panel);

    let stopped = false;
    document.getElementById('mv90-close').onclick = () => panel.remove();
    document.getElementById('mv90-stop').onclick  = () => { stopped = true; log('⏹ 停止', '#f59e0b'); };
    document.getElementById('mv90-auto').onclick  = () => { stopped = false; runAll(); };
    document.getElementById('mv90-now').onclick   = () => { stopped = false; doQuizFromInfoPage('手動'); };
    document.getElementById('mv90-cfg').onclick   = async () => {
        // 重新設定引擎
        localStorage.removeItem('moocs_ai_engine');
        const result = await showSetupDialog();
        if (result) {
            AI_ENGINE  = result.engine;
            GEMINI_KEY = result.geminiKey;
            CLAUDE_KEY = result.claudeKey;
            localStorage.setItem('moocs_ai_engine',  AI_ENGINE);
            localStorage.setItem('moocs_gemini_key', GEMINI_KEY);
            localStorage.setItem('moocs_claude_key', CLAUDE_KEY);
            // 更新標籤
            panel.querySelector('#mv90-hdr span').innerHTML =
                '🎓 MOOCS v9.0 ' + (AI_ENGINE==='gemini'
                    ? '<span style="color:#22c55e">🌟 Gemini</span>'
                    : '<span style="color:#a78bfa">🤖 Claude</span>');
            log(`✅ 已切換至 ${AI_ENGINE}`, '#4f8ef7');
        }
    };

    let drag=false, ox, oy;
    document.getElementById('mv90-hdr').onmousedown = e => { drag=true; ox=e.clientX-panel.offsetLeft; oy=e.clientY-panel.offsetTop; };
    document.onmousemove = e => { if(!drag)return; panel.style.left=(e.clientX-ox)+'px'; panel.style.top=(e.clientY-oy)+'px'; panel.style.right='auto'; panel.style.bottom='auto'; };
    document.onmouseup  = () => drag=false;

    function log(msg, c='#94a3b8') {
        const el = document.getElementById('mv90-log'); if (!el) return;
        const t = new Date().toLocaleTimeString('zh-TW');
        el.innerHTML += `<div style="color:${c};line-height:1.8"><span style="color:#334155">[${t}]</span> ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    function setStatus(msg, c='#64748b') { const e=document.getElementById('mv90-status'); if(e){e.textContent=msg;e.style.color=c;} }
    function setTimer(msg, c='#22c55e') { const e=document.getElementById('mv90-timer'); if(e){e.textContent=msg;e.style.color=c;} }

    function startCountdown(label, sec) {
        let r = sec; setTimer(`⏱ ${label}：${r}秒`, '#22c55e');
        const tid = setInterval(() => { if(stopped||r<=0){clearInterval(tid);return;} r--; setTimer(`⏱ ${label}：${r}秒`, r<10?'#f59e0b':'#22c55e'); }, 1000);
        return tid;
    }

    // ══════════════════════════════════════════════
    // 偵測說明頁
    // ══════════════════════════════════════════════
    function isInfoPageVisible() {
        const btns = [...document.querySelectorAll('button,a')]
            .filter(b => {
                if (b.closest('#moocs-v90')) return false;
                if (!b.offsetParent) return false;
                return /^進入測驗$|^開始測驗$/.test(b.textContent?.trim() || '');
            });
        if (!btns.length) return false;
        return /總題數|測驗時間|通過標準|測驗次數/.test(document.body.innerText || '');
    }

    async function waitForInfoPage(timeoutMs=15000) {
        for (let i=0; i < timeoutMs/300; i++) {
            if (stopped) return 'stopped';
            if (isInfoPageVisible()) return 'ok';
            await sleep(300);
        }
        return 'timeout';
    }

    // ══════════════════════════════════════════════
    // AI 詢問（自動選 Gemini / Claude）
    // ══════════════════════════════════════════════
    async function askAI(q, opts_text, type, retry=0) {
        await sleep(1200);
        return AI_ENGINE === 'gemini'
            ? askGemini(q, opts_text, type, retry)
            : askClaude(q, opts_text, type, retry);
    }

    // Gemini API
    async function askGemini(q, opts_text, type, retry=0) {
        const isYN = type?.includes('是非');
        const prompt = isYN
            ? `台灣教育訓練是非題，只回答0（正確）或1（錯誤），不要解釋：\n${q}`
            : `台灣教育訓練單選題，選最正確答案，只回答數字（從0開始），不要解釋：\n題目：${q}\n選項：\n${opts_text}`;
        try {
            // 優先用 gemini-2.0-flash，免費額度充足
            const model = 'gemini-2.0-flash';
            const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
            const res   = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 10, temperature: 0 } })
            });
            if (res.status === 429) {
                const w = [20,40,80][retry] || 80;
                log(`  ⚠️ Gemini 429，等 ${w}s`, '#f59e0b');
                await sleep(w * 1000);
                return askGemini(q, opts_text, type, retry+1);
            }
            const data = await res.json();
            // Gemini 回傳結構：candidates[0].content.parts[last].text
            const parts = data?.candidates?.[0]?.content?.parts;
            const text  = parts ? parts[parts.length-1]?.text?.trim() : '';
            return text?.match(/\d/)?.[0] || '0';
        } catch(e) {
            log('❌ Gemini：' + e.message, '#ef4444');
            return '0';
        }
    }

    // Claude API
    async function askClaude(q, opts_text, type, retry=0) {
        const isYN = type?.includes('是非');
        const prompt = isYN
            ? `台灣教育訓練是非題，只回答0（正確）或1（錯誤），不要解釋：\n${q}`
            : `台灣教育訓練單選題，選最正確答案，只回答數字（從0開始），不要解釋：\n題目：${q}\n選項：\n${opts_text}`;
        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': CLAUDE_KEY,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:10, messages:[{role:'user',content:prompt}] })
            });
            if (res.status === 429) {
                const w = [20,40,80][retry] || 80;
                log(`  ⚠️ Claude 429，等 ${w}s`, '#f59e0b');
                await sleep(w * 1000);
                return askClaude(q, opts_text, type, retry+1);
            }
            const data = await res.json();
            return data?.content?.[0]?.text?.trim()?.match(/\d/)?.[0] || '0';
        } catch(e) {
            log('❌ Claude：' + e.message, '#ef4444');
            return '0';
        }
    }

    // ══════════════════════════════════════════════
    // 找「下一題」按鈕（v9.0 精準版）
    // ══════════════════════════════════════════════
    function findNextBtn() {
        // 策略1：文字精確比對
        const byText = [...document.querySelectorAll('button')]
            .find(b => /^下一題$|^下一$|^Next$/.test(b.textContent?.trim())
                && b.offsetParent && !b.closest('#moocs-v90') && !b.disabled);
        if (byText) return byText;

        // 策略2：右側小型圓形箭頭（更嚴格的條件）
        const halfW = innerWidth / 2;
        const candidates = [...document.querySelectorAll('button,[role="button"]')]
            .filter(el => {
                if (el.closest('#moocs-v90')) return false;
                if (!el.offsetParent || el.disabled) return false;
                const r = el.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) return false;
                // 在頁面右半部
                if (r.left < halfW) return false;
                // 嚴格限制尺寸：圓形箭頭通常 20-60px
                if (r.width > 80 || r.height > 80) return false;
                if (r.width < 20 || r.height < 20) return false;
                // 垂直範圍：頁面中段（排除頁頭頁尾、固定工具列）
                if (r.top < 120 || r.top > innerHeight - 80) return false;
                // 必須有明確箭頭特徵
                const txt = (el.textContent?.trim() || '').toLowerCase();
                const html = (el.innerHTML || '').toLowerCase();
                return (
                    txt === '' ||
                    txt === '>' || txt === '›' || txt === '→' || txt === '❯' ||
                    html.includes('chevron') || html.includes('arrow-right') ||
                    html.includes('next') || html.includes('forward') ||
                    // MOOCS 常用 SVG path 或 i 標籤箭頭
                    html.includes('<svg') || html.includes('<i ')
                );
            });

        if (!candidates.length) return null;

        // 取最靠右且靠下的按鈕（避開左箭頭）
        return candidates.sort((a, b) => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            // 優先選最右邊的
            return (rb.left + rb.right) - (ra.left + ra.right);
        })[0];
    }

    // 找「進入測驗」按鈕
    function findInfoPageEnterBtn() {
        const all = [...document.querySelectorAll('button,a')]
            .filter(b => {
                if (b.closest('#moocs-v90')) return false;
                if (!b.offsetParent) return false;
                return /^進入測驗$|^開始測驗$/.test(b.textContent?.trim() || '');
            });
        if (!all.length) return null;
        return all.reduce((a, b) => b.getBoundingClientRect().width > a.getBoundingClientRect().width ? b : a);
    }

    // 找送出按鈕（排除假按鈕）
    function findSubmitBtn() {
        return [...document.querySelectorAll('button')]
            .find(b =>
                /^(送出|提交|繳交|Submit)$/.test(b.textContent?.trim()) &&
                !b.disabled && b.offsetParent && !b.closest('#moocs-v90')
            );
    }

    // 取得題目選項（支援 label / radio 兩種結構）
    function getOptions() {
        // 優先找帶文字的 label
        let opts = [...document.querySelectorAll('moocs-question label, .question-wrap label, fieldset label')]
            .filter(o => o.offsetParent !== null && o.innerText?.trim());
        if (opts.length) return opts;

        // 備援：找 radio input 的父 li / div
        opts = [...document.querySelectorAll('input[type="radio"]')]
            .filter(r => r.offsetParent !== null)
            .map(r => r.closest('li,div,label') || r.parentElement)
            .filter(Boolean);
        return opts;
    }

    // ══════════════════════════════════════════════
    // 答題主流程（v9.0 修正版）
    // ══════════════════════════════════════════════
    async function doQuizFromInfoPage(name, attempt=1) {
        if (stopped) return 'stopped';
        if (attempt > 6) { log('❌ 超過6次', '#ef4444'); return 'failed'; }

        log(`\n📝「${name}」第${attempt}次`, '#a78bfa');
        setStatus(`測驗：${name}（${attempt}次）`, '#a78bfa');

        // 等進入測驗按鈕
        let enterBtn = null;
        const tid0 = startCountdown('等說明頁', 15);
        for (let t=0; t<50; t++) {
            enterBtn = findInfoPageEnterBtn();
            if (enterBtn) break;
            await sleep(300);
        }
        clearInterval(tid0);

        if (!enterBtn) { log('  ❌ 找不到進入測驗按鈕', '#ef4444'); return 'no_enter'; }

        const r = enterBtn.getBoundingClientRect();
        log(`  ✅ 點進入測驗（x:${Math.round(r.left)} w:${Math.round(r.width)}）`, '#22c55e');
        enterBtn.click();
        await sleep(3000);

        // 等第一題出現（多個選擇器）
        const Q_SELECTORS = '.question__title,.question-title,[class*="question__title"],[class*="questionTitle"]';
        let hasQ = false;
        for (let t=0; t<20; t++) {
            if (document.querySelector(Q_SELECTORS)?.offsetParent) { hasQ=true; break; }
            await sleep(500);
        }
        if (!hasQ) { log('  ⚠️ 題目未出現，可能為單頁多題模式', '#f59e0b'); }

        // 答題迴圈
        let answered=0, noQCount=0, prevQ='', sameQRepeat=0;

        for (let i=0; i<80; i++) {
            if (stopped) return 'stopped';

            const qEl = document.querySelector(Q_SELECTORS);

            // 沒有題目
            if (!qEl || !qEl.offsetParent) {
                noQCount++;
                if (answered > 0 && noQCount >= 5) { log(`  ✅ 答完（${answered}題）`, '#22c55e'); break; }
                if (i > 15 && noQCount >= 5) { log('  ℹ️ 無題目', '#64748b'); break; }
                await sleep(600);
                continue;
            }
            noQCount = 0;

            const q = qEl.innerText.trim();

            // 題目重複偵測
            if (q === prevQ) {
                sameQRepeat++;
                if (sameQRepeat >= 3) {
                    // 3次相同，強制嘗試翻頁或送出
                    log('  ⚠️ 題目卡住，強制處理', '#f59e0b');
                    const sub = findSubmitBtn();
                    if (sub) { sub.click(); log('  📤 強制送出', '#22c55e'); await sleep(4000); break; }
                    const nxt = findNextBtn();
                    if (nxt) { nxt.click(); await sleep(1800); }
                    else { await sleep(1000); }
                    sameQRepeat = 0;
                    continue;
                }
                await sleep(800);
                continue;
            }
            prevQ = q;
            sameQRepeat = 0;

            const typeEl = document.querySelector('.quesiton__type-and-index,.question__type-and-index,[class*="type-and-index"]');
            const type   = typeEl?.innerText || '';
            const opts   = getOptions();

            if (!opts.length) { await sleep(800); continue; }

            const opts_text = opts.map((o, idx) => `${idx}: ${o.innerText?.trim() || o.value || ''}`).join('\n');
            const isYN = type.includes('是非');
            log(`  Q${answered+1}[${isYN?'是非':'單選'}]: ${q.substring(0,42)}`, '#a78bfa');

            const ans = await askAI(q, opts_text, type);
            const idx = Math.min(parseInt(ans) || 0, opts.length-1);

            // 點選答案（優先 click label，備援 click radio）
            const target = opts[idx];
            const radio  = target?.querySelector?.('input[type="radio"]') || (target?.tagName==='INPUT' ? target : null);
            if (radio) radio.click();
            target?.click();

            log(`  → 選${idx}：${(opts[idx]?.innerText||opts[idx]?.value||'').trim().substring(0,20)}`, '#22c55e');
            answered++;
            await sleep(600);

            // ⭐ 核心修正：先找下一題，送出是最後才考慮
            // 單題模式：每題後有「下一題」按鈕
            const nxt = findNextBtn();
            if (nxt) {
                log(`  → 下一題：「${nxt.textContent?.trim()||'(箭頭)'}」`, '#60a5fa');
                nxt.click();
                await sleep(1800);
                continue;
            }

            // 找不到下一題，才考慮送出
            await sleep(500);
            const sub = findSubmitBtn();
            if (sub) {
                log('  📤 送出答案', '#22c55e');
                sub.click();
                await sleep(4000);
                break;
            }

            // 都找不到，印診斷資訊繼續等
            log('  ⚠️ 找不到下一題/送出，診斷中...', '#f59e0b');
            [...document.querySelectorAll('button,[role="button"]')]
                .filter(b => b.offsetParent && !b.closest('#moocs-v90'))
                .forEach(b => {
                    const rb = b.getBoundingClientRect();
                    if (rb.width > 0 && rb.height > 0)
                        log(`  btn:"${b.textContent?.trim()?.substring(0,15)}" x:${Math.round(rb.left)} y:${Math.round(rb.top)} ${Math.round(rb.width)}×${Math.round(rb.height)}`, '#334155');
                });
            await sleep(1500);
        }

        // 完成測驗按鈕
        await sleep(2000);
        const done = [...document.querySelectorAll('button,a')]
            .find(b => b.textContent?.trim()==='完成測驗' && b.offsetParent && !b.closest('#moocs-v90'));
        if (done) { done.click(); log('  📋 完成測驗', '#60a5fa'); await sleep(3000); }

        // 判斷是否通過
        await sleep(2000);
        const retest = [...document.querySelectorAll('button,a')]
            .find(b => b.textContent?.trim()==='重新測驗' && b.offsetParent);
        if (retest) {
            log(`  ⚠️ 未達標，重測`, '#f59e0b');
            retest.click();
            await sleep(2500);
            return doQuizFromInfoPage(name, attempt+1);
        }

        log('  🎉 通過！', '#22c55e');
        setStatus('🎉 通過', '#22c55e');
        return 'passed';
    }

    // ══════════════════════════════════════════════
    // 全自動流程
    // ══════════════════════════════════════════════
    async function runAll() {
        log('\n🚀 全自動開始', '#4f8ef7');
        setStatus('全自動掃描...', '#4f8ef7');

        const goHome = async () => {
            const tab = [...document.querySelectorAll('[role="tab"],.mat-tab-label')]
                .find(el => /課程簡介/.test(el.textContent));
            if (tab) { tab.click(); await sleep(1500); }
            for (const h of document.querySelectorAll('mat-expansion-panel-header')) {
                const p = h.closest('mat-expansion-panel');
                if (!p?.classList.contains('mat-expanded')) { h.click(); await sleep(400); }
            }
            await sleep(1000);
        };

        await goHome();
        const attempts = new Map();
        let round = 0;

        while (!stopped && round < 40) {
            round++;
            if (!location.href.includes('/learning/')) { log('⚠️ 頁面跑掉', '#ef4444'); break; }

            const quizBtns = [...document.querySelectorAll('button')]
                .filter(b => b.textContent?.trim()==='未測驗' && b.offsetParent && !b.dataset.skip);

            if (!quizBtns.length) { log('\n✅ 全部完成！', '#22c55e'); setStatus('🎉 完成', '#22c55e'); break; }

            const btn   = quizBtns[0];
            const p2    = btn.closest('mat-expansion-panel');
            const gName = p2?.querySelector('mat-expansion-panel-header')?.innerText?.trim()?.substring(0,25) || `測驗${round}`;
            const cnt   = attempts.get(gName) || 0;

            if (cnt >= 3) { log(`⏭ 跳過「${gName}」`, '#f59e0b'); btn.dataset.skip='1'; continue; }
            attempts.set(gName, cnt+1);

            log(`\n🎯 [${round}]「${gName}」(第${cnt+1}次)`, '#60a5fa');
            setStatus(`點擊：${gName}`, '#a78bfa');

            btn.scrollIntoView({ behavior:'smooth', block:'center' });
            await sleep(500);
            btn.click();

            const tid2  = startCountdown('等說明頁', 15);
            const info  = await waitForInfoPage(15000);
            clearInterval(tid2);

            if (info === 'stopped') break;
            if (info === 'timeout') { log('  ⚠️ 說明頁未出現，跳過', '#f59e0b'); continue; }

            log('  ✅ 說明頁已出現', '#22c55e');
            await sleep(500);

            const result = await doQuizFromInfoPage(gName);
            log(`  結果：${result}`, result==='passed'?'#22c55e':'#f59e0b');

            await sleep(1500);
            await goHome();
        }
    }

    const engineStr = AI_ENGINE === 'gemini' ? '🌟 Gemini 2.0 Flash' : '🤖 Claude Haiku';
    log(`✅ v9.0 就緒｜引擎：${engineStr}`, '#4f8ef7');
    log('【🚀 全自動測驗】掃描所有未測驗', '#60a5fa');
    log('【📝 現在答題】在說明頁時直接答題', '#60a5fa');
    log('【⚙️ 切換引擎】隨時更換 AI 引擎', '#60a5fa');
    setStatus('請選擇操作', '#60a5fa');
})();
