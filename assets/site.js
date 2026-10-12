'use strict';
/* TU:bit V2 機器人課程網站｜共用頁首、頁尾、版本紀錄
   改版時只改 APP_VERSION 與 CHANGELOG 兩個常數。 */
const APP_VERSION = 'v1.9.12';
const CHANGELOG = [
  { version: 'v1.9.12', date: '2026-10-12', desc: '全國賽路徑規劃器 v1.9.21：路線離隔板至少 4 cm、轉角弧線預設關閉（實測弧線方向相反撞到隔板）、BNO 轉正誤差至少 1.5°。' },
  { version: 'v1.9.11', date: '2026-10-12', desc: '全國賽路徑規劃器 v1.9.20：IR 靠牆改為限距校正（每次 0.5 cm、最多 4 cm，跨過目標值才修正該方向座標），不再推牆、不再用錯的位置重設座標。' },
  { version: 'v1.9.10', date: '2026-10-09', desc: '全國賽路徑規劃器 v1.9.19：外框鋁擠條不當 IR 校正面；放置改從盒子側邊靠近（左側 IR 對倉儲牆＋前方 IR 對盒子）；BNO 轉正容許 1.5°、減少轉正次數；IR 校正新增「沒有牆」讀數，黑色隔板讀數差不夠的 IR 自動不用。' },
  { version: 'v1.9.9', date: '2026-10-09', desc: '全國賽路徑規劃器 v1.9.18：自動流程再省時（手臂動作與起步同時、轉向與移動合併、校正確認縮短），估算約 18.9 秒。' },
  { version: 'v1.9.8', date: '2026-10-09', desc: '全國賽路徑規劃器 v1.9.17：手臂不旋轉——夾取車頭正對齒輪、放置車頭正對放置盒直接張爪，前方 IR 確認盒子距離；路線重新最佳化。' },
  { version: 'v1.9.7', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.16：移動加減速更平順（減速放慢停得準）、手臂邊走邊轉、手動手臂升降加快。' },
  { version: 'v1.9.6', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.15：修正藍方出發原地轉半圈（BNO 以出發時車頭為 0°）；自動移動加速、BNO 轉正逾時縮短、轉角改弧線一次走完。' },
  { version: 'v1.9.5', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.14：IR 改為座標為主、IR 為輔（看到牆才靠牆，沒有隔板不亂轉）；手臂順序改為先抬起張開再移動、到點下降合爪抬起、放置先降再張開；新增藍方對應座標可自訂；新增出發前按 SELECT 選紅／藍方、再按 START 自動，做完自動回手動。' },
  { version: 'v1.9.4', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.13：IR 校正後只直走、用手臂旋轉補左右偏差（不橫移）；IR 校正成功才重設座標；移動加速；開機畫面顯示出發點與 BNO／IR 狀態；新增 A 出發點欄位。' },
  { version: 'v1.9.3', date: '2026-10-07', desc: '程式產生器與全國賽路徑規劃器 v1.9.12：新增「開啟兔比積木」線上平台連結；程式碼與設定頁提醒 BNO 啟動前先歸零方向（含 BNO 接線）、使用手臂／發射器時伺服電源跳帽往上移插 1、2。' },
  { version: 'v1.9.2', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.11：出發點改為實測 (50, 280)／藍方 (250, 20)；放置改為到定位再轉手臂、張開；沒做過 IR 校正時自動略過 IR 靠牆校正，避免車子轉歪。' },
  { version: 'v1.9.1', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.10：自動規劃按鈕旁可直接輸入 PS3 手把 MAC，自動整理格式，賽規檢查提醒格式錯誤或仍是範例值。' },
  { version: 'v1.9.0', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.9／程式產生器：BNO055 開機偵測等 3 秒，找不到時序列埠與 OLED 列出 I2C 位址（判斷沒接好或 ADR 位址 0x29）。' },
  { version: 'v1.8.9', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.8／程式產生器：修正手臂與發射器同時引入、定點移動 headDeg 與 PPGUN.h 衝突的編譯錯誤；自動規劃自動改用手臂。' },
  { version: 'v1.8.8', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.7：自動車 A 固定在出發區右側（紅方 57,282；藍方對稱 243,18），「從紅方／藍方出發」直接放回標準位置並重新規劃；舊方案 A 在左時自動改回。' },
  { version: 'v1.8.7', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.6：交換 A／B 位置或換紅藍方後自動重新規劃路線（A 在左側時走左側通道，不再穿過 B 車）。' },
  { version: 'v1.8.6', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.5：省時規劃（約 30 秒 → 22 秒，夾取與放置的最後一段仍慢速到位）；自動規劃用到 IR 時自動開啟現場微調與校正；修正微調復原時序，避免掃到剛放好的齒輪。' },
  { version: 'v1.8.5', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.4：預設自動出發點 (57, 282)；新增自動任務位置（夾取點 78,172、放置點 6,103，絕對座標）；新增從紅方／藍方出發，180° 對稱換算，兩邊程式相同。' },
  { version: 'v1.8.4', date: '2026-10-07', desc: '全國賽路徑規劃器 v1.9.3：自動規劃一定會放到觸發閘門裝置（自動放寬容許誤差到齒輪仍在裝置上的範圍）；改成感測輔助路線（夾取、放置前各做一次 BNO 轉正＋IR 靠牆校正＋座標同步，再短距離定點）；BNO 轉正係數改用上傳的校正.tb（1.25，可調）。' },
  { version: 'v1.8.3', date: '2026-10-06', desc: '全國賽路徑規劃器 v1.9.2：新增「A ⇄ B 交換位置」按鈕；物資能源預設改為 A（自動）在出發區右側、B（手動）在左側，A 直接走右側通道，夾取只需 1 個路徑點（約 9 秒），完整夾取＋放置約 20 秒；範例路線同步更新。' },
  { version: 'v1.8.2', date: '2026-10-06', desc: '全國賽路徑規劃器 v1.9.1：車身預設值更正為實測（車寬 20 cm、車長 20 cm、夾爪中心離車心 15 cm、輪徑 6 cm，機器人 B 也是 20×20 cm），舊預設值的方案自動更正；新增「放置容許誤差」（預設 2 cm），自動規劃放置時會顯示實際偏差，放不到時說明要多長的夾爪或放寬多少誤差。' },
  { version: 'v1.8.1', date: '2026-10-06', desc: '全國賽路徑規劃器 v1.9.0：① 兩台同時出發——新增機器人 B（手動）出發位置，可拖曳、旋轉、設定尺寸；碰撞檢查與自動規劃會避開它，賽規檢查確認 A、B 都在出發區且不重疊。② 自動規劃最佳路徑——自動找本方黃色齒輪與觸發閘門裝置，試每 15° 車頭與手臂旋轉角度找夾取／放置姿態，用格點 A* 找最短無碰撞路線，產生移動與到點動作；放不到時算出夾爪中心至少要離車心幾公分（預設車體 28×28 cm 時觸發閘門裝置至少需約 23 cm）。' },
  { version: 'v1.8.0', date: '2026-10-05', desc: '新增「現場微調與校正」（程式產生器、路徑規劃器共用，數值存在 ESP32 快閃記憶體 Preferences，斷電不會消失，比賽現場不用改程式）：① IR 校正模式：開機按住控制板 A，依序把前（33）、後（32）、左（35／34）、右（39／36）面放在離牆 10 cm，每面按 A 取 20 次平均存成 IR 目標值（B 跳過）；② BNO 校正模式：開機按住 B，靜置顯示角度與每分鐘漂移，A＝目前方向設為 0°，B＝離開；③ 現場微調：PS3 手動模式按住 START＋L1／L2 前後、R1／R2 雲台（手臂或砲台旋轉），START＋SELECT 歸零，可設定每按一下幾 cm／幾度，套用在夾取點、放置點或兩者（trimBefore／trimAfter，夾好或放好後自動復原）；單按 START 放開才啟動自動，按住 START 的組合鍵不會誤啟動。路徑規劃器 v1.8.0 同步。' },
  { version: 'v1.7.2', date: '2026-10-05', desc: '修正遙控設定陷阱：① 勾選 PS3／V7RC 時，自動／手動鍵會改成該遙控的預設（PS3：START／SELECT；V7RC：按鈕 5／控制板 B），不再沿用上一種遙控的按鍵（原本從 V7RC 範本改成 PS3 時，手動鍵會停在控制板 B，導致 SELECT 不能切回手動）。② 按鍵對應中 ↑／↓、←／→ 同一個累加動作卻同號（例如 ↓ 也填正數）時顯示警告；累加欄位標示「負數＝反方向」。③ 手動鍵不是 PS3 按鍵時提醒。④ 改按鍵對應的數字後離開欄位，警告立即更新。（路徑規劃器 v1.7.2 同步①）' },
  { version: 'v1.7.1', date: '2026-10-05', desc: '修正 BNO055 偵測：bnoFound() 原本開機只檢查一次，BNO055 上電約 0.65 秒後才回應 I2C，太早檢查會誤判「沒有 BNO055」而略過初始化；改為最多重試 1.5 秒。檢查結果：主機板初始化 tubit.init() 在程式產生器（基礎、進階、競賽）與路徑規劃器（四種機器人）都一定會產生；勾選 BNO055 時一定會產生 BNO055 初始化。（路徑規劃器 v1.7.1 同步）' },
  { version: 'v1.7.0', date: '2026-10-05', desc: '程式產生器 OLED 中文改用「精簡字型」：只把程式用到的中文字打包成 tubitZhFont（例如 4 個字約 1.5 KB），取代約 212 KB 的 u8g2_font_unifont_t_chinese1。解決 PS3／V7RC 藍牙＋中文顯示時「Sketch too big（106%）」無法編譯的問題（同一支程式降到約 89%）。字形與原字型完全相同；字型檔放在 assets/fonts/，第一次開啟產生器時載入。' },
  { version: 'v1.6.9', date: '2026-10-05', desc: '程式產生器（競賽自動化）新增「設定定點原點」「前往定點（座標）＋到點動作（夾取、放置、開爪、合爪、升降）」「前進／後退指定距離」「感測距離移動（超音波，太遠前進、太近後退、越近越慢）」；勾 BNO055 時前往定點用新版 MTC V3 的 moveSCurveBno 鎖定場地方向，到點更準。預設動作為零：一開始沒有任何動作，新動作的距離與座標預設為 0。全國賽路徑規劃器 v1.7.0：新增「BNO 精準定點」（預設開啟），每個路徑點改用 goTo() 以起點為原點的座標前往，校正／撞牆／超音波後自動同步座標；新增「感測距離移動」步驟；新方案預設沒有步驟，範例路線改放在快速範本。' },
  { version: 'v1.6.8', date: '2026-10-05', desc: '程式產生器與全國賽路徑規劃器 v1.6.3：PS3 預設配置更正：手臂車為方向鍵 ↑↓ 手臂升降、←→ 雲台轉動、△ 開爪、○ 合爪；發射車為方向鍵 ↑↓ 砲管升降、←→ 雲台轉動、△ 發射；START 自動、SELECT 手動。舊配置（12 鍵版、△／○ 組合鍵版）開啟時自動換新。路徑規劃器：物資能源爭霸戰場地依新版規則「場地規格圖」重新布置：出發區含膠帶外框 75×40、迷宮隔板（出發區下方 x35、L 形距上 60、左牆隔板距上 100、T 形距左 80 與 12.5 偏移）、齒輪物資（迷宮參考點）距左 78／距上 128、倉儲牆 5 cm 與閘門 x60～95、觸發閘門裝置緊貼倉儲上緣；藍方為 180° 對稱。舊的官方場地開啟時自動換新，自己改過的場地不動。競賽專區補上迷宮參考點位置。' },
  { version: 'v1.6.7', date: '2026-10-05', desc: '程式產生器與全國賽路徑規劃器 v1.6.2：PS3 預設配置簡化：手臂車為按住 △＋←→ 轉雲台、按住 ○＋↑↓ 手臂升降、□ 開爪、✕ 合爪；發射車為按住 △＋←→ 轉雲台、按住 ○＋↑↓ 砲管升降、□ 發射；START 自動、SELECT 手動。其他按鍵與搖桿、速度設定收進「更多手把設定」。水平雲台與手臂／發射器的旋轉是同一顆伺服（S0），兩者改為擇一；舊版 12 鍵官方配置會自動換成新配置。' },
  { version: 'v1.6.6', date: '2026-10-04', desc: '程式範例新增兩支 BNO 範例：01_BNO精準移動（BNO 移動起點＋BNO 移動，邊走邊轉的 50 cm 正方形）與 02_MTC_BNO_PS3無頭模式控制（以開機方向為準的 PS3 遙控）；附文字版積木、逐塊說明、產生的 Arduino 程式碼（已在兔比積木線上 Arduino IDE 編譯成功）與 .tb 下載。新增共用「複製程式碼」按鈕。' },
  { version: 'v1.6.5', date: '2026-10-04', desc: '每頁頁尾與路徑規劃器下方加上「車城國小資訊老師徐吉德整理製作@2026」。' },
  { version: 'v1.6.4', date: '2026-10-04', desc: '水平雲台可微調：程式產生器與路徑規劃器勾選後可設定腳位、回正角度、微調（±45°）與可轉範圍，程式碼產生 GIMBAL_TRIM 與 gimbalTo()。路徑規劃器 v1.6.0：畫路徑時預計碰撞會提示，可一鍵加繞行點（自動找繞過障礙的最少轉折點）或移到最近可通過位置。' },
  { version: 'v1.6.3', date: '2026-10-04', desc: '程式產生器（競賽自動化）與路徑規劃器 v1.5.0 新增「自動移動速度 %」：規劃好路線後改一個數字，所有 MTC 自動移動一起變快或變慢；程式碼產生 AUTO_SPEED 常數與 autoV()，燒錄前也能直接改。' },
  { version: 'v1.6.2', date: '2026-10-04', desc: '修正：程式產生器與路徑規劃器勾選 BNO055 但感測器沒接好時，bno.start() 會讓程式卡在開機（OLED 白屏、PS3 連不上）。現在開機先偵測 I2C 0x28，找不到就略過 BNO055，轉正改為跳過，其他功能照常。路徑規劃器更新到 v1.4.1。' },
  { version: 'v1.6.1', date: '2026-10-04', desc: '2026全國競賽路徑規劃器更新到 v1.4.0：程式碼改用程式產生器的共用核心產生，套件與感測器、遙控、一鍵自動／手動模式設定與程式產生器相同；新增撞牆校正、超音波接近、連續發射與快速範本。程式產生器競賽自動化 7 個範本全部重新編譯檢查，BNO 轉正欄位補上「順時針增加」說明。' },
  { version: 'v1.6.0', date: '2026-10-04', desc: '程式產生器：PS3 與 V7RC 的「搖桿控制」與「方向鍵控制」分開設定，各自可選移動車子、調整瞄準（手臂／砲台／雲台伺服）或不使用；新增瞄準速度參數與 aimPan()／aimTilt()；V7RC 右側 8 方向鍵也可選旋轉（官方）、移動、瞄準；方向鍵與按鍵對應重複時提醒。' },
  { version: 'v1.5.0', date: '2026-10-04', desc: '程式產生器：PS3 加入組合鍵（例如按住 ○ 時方向鍵改調雲台、砲台或手臂，一鍵套用），按鍵對應每列可設「按住」鍵、新增「伺服累加（雲台）」動作；PS3 按鍵觸發增為 4 組、可設組合鍵並等放開才結束；一鍵自動做完後可選停在 AUTO OK 等手動鍵、重複執行直到按手動鍵、或立刻回手動。' },
  { version: 'v1.4.0', date: '2026-10-03', desc: '程式產生器：PS3／V7RC 勾選後自動產生遙控程式（前進後退、左右平移、旋轉直接對應搖桿或方向鍵，速度／旋轉速度／死區可調），按鍵對應表可一鍵套用官方手臂車、發射車配置並逐鍵修改；新增一鍵自動／手動模式（自動鍵、手動鍵可選 PS3 START／SELECT、V7RC 按鈕或控制板 A／B，自動途中可中止、做完停在 AUTO OK 等裁判確認、OLED 顯示模式、手把震動提示）與兩個全國賽範本；修正 L2 說明為「MTC 角度移動」（依官方 .tb）。' },
  { version: 'v1.3.1', date: '2026-10-03', desc: '擴充模組加入圖解：PS3 連線五步驟（官方講義圖片：輸入 MAC、上傳、長按 PS 鈕連線、搖桿按鈕、序列埠確認）與 V7RC 設定（控制中心選 GAME ADV、GAME ADV 通道 1～4 說明）；BNO055 I2C 接線圖依實車線色確認排針順序為 SCL、SDA、V、G；程式產生器 V7RC 按鈕加上方向箭頭與 GAME ADV 提醒。' },
  { version: 'v1.3.0', date: '2026-10-03', desc: '首頁加入「兔比積木 TU:bitBlock 線上積木」入口；程式產生器進階篇新增 BNO055（顯示角度、轉正）、PS3 手把（搖桿遙控、按鍵觸發、震動）、V7RC（藍牙／Wi-Fi 遙控、按鈕觸發）、MTC Robot（X Y 旋轉、角度移動、弧線、車體參數）、IR 靠牆校正（新版積木：MTC 模式、腳位 前33 後32 左前35 左後34 右前39 右後36），皆依兔比積木擴充原始碼並以線上 Arduino IDE 編譯通過；組裝與接線新增 BNO055 I2C 接線（VIN 接 V、GND 接 G，接反會燒毀）與 IR 靠牆校正接線。' },
  { version: 'v1.2.0', date: '2026-10-03', desc: '控制板與接線改以鴻兔科技 TU Wiki 官方圖片為主（電源、按鈕、GPIO、OLED、馬達、編碼器、伺服、超音波、紅外線），並新增編碼器馬達、伺服馬達、套件腳位接線示意圖；程式產生器分為基礎篇、進階篇（水平雲台、手臂 ATARM、發射器 PPGUN、超音波）、競賽自動化（撞牆校正、BNO 轉正、超音波接近、夾取／放置組合、連續發射）；原路徑規劃器更名為「TU:bit V2 2026全國競賽路徑規劃器」移到競賽專區（race-planner/），舊 planner/ 網址導向程式產生器。' },
  { version: 'v1.1.0', date: '2026-10-03', desc: '新增「程式產生器」：勾選按鈕 A／B、開機、重複執行等觸發條件與馬達、MTC 移動、伺服、OLED、等待動作，自動產生 TubitBlock（OpenBlock）格式的 Arduino 程式碼；新增「資料下載」頁，整理官方講義與範例 .tb 並附雲端備份連結；首頁移除重要日期公告。程式碼寫法依兔比積木擴充原始碼（TuBitCore、TuMTC、Adafruit_SH110X）。' },
  { version: 'v1.0.0', date: '2026-10-03', desc: '首版：開始使用、組裝與接線、擴充模組（PS3、V7RC、手臂、發射器、BNO055、超音波）、程式範例、2026 全國 AI 智創機器人競賽專區（含計分試算），並收錄競賽路徑規劃器 v1.3.2。內容已對照鴻兔科技官網、官方講義與 2026 全國賽實施計畫。' }
];

const NAV = [
  { href: 'index.html', key: 'home', label: '首頁' },
  { href: 'start.html', key: 'start', label: '開始使用' },
  { href: 'wiring.html', key: 'wiring', label: '組裝與接線' },
  { href: 'modules.html', key: 'modules', label: '擴充模組' },
  { href: 'code.html', key: 'code', label: '程式範例' },
  { href: 'generator.html', key: 'generator', label: '程式產生器' },
  { href: 'resources.html', key: 'resources', label: '資料下載' },
  { href: 'competition.html', key: 'competition', label: '競賽專區' },
  { href: 'race-planner/', key: 'planner', label: '全國賽路徑規劃' }
];

function esc(v) {
  return (v === null || v === undefined ? '' : String(v))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function applyTheme(t) {
  try { if (t) localStorage.setItem('tubit-site-theme', t); } catch (e) {}
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}
(function initTheme() {
  let t = null;
  try { t = localStorage.getItem('tubit-site-theme'); } catch (e) {}
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
})();

function renderChrome() {
  const page = document.body.dataset.page || '';
  const header = document.getElementById('site-header');
  if (header) {
    header.className = 'topbar';
    header.innerHTML =
      '<div class="topbar-in">' +
        '<a class="brand" href="index.html"><span class="brand-mark">TU</span>TU:bit V2 機器人課程</a>' +
        '<button class="version-badge" type="button" id="verBtn" title="更新紀錄">' + esc(APP_VERSION) + '</button>' +
        '<button class="theme-btn" type="button" id="themeBtn" title="切換深色／淺色">◐</button>' +
        '<button class="nav-toggle" type="button" id="navToggle" aria-expanded="false" aria-controls="mainNav">選單</button>' +
        '<nav class="nav" id="mainNav" aria-label="主選單">' +
          NAV.map(n => '<a href="' + n.href + '"' + (n.key === page ? ' aria-current="page"' : '') + '>' + esc(n.label) + '</a>').join('') +
        '</nav>' +
      '</div>';
  }
  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.className = 'footer';
    const onPages = /github\.io$/.test(location.hostname);
    footer.innerHTML =
      '<div class="footer-in">' +
        '<span>TU:bit V2 機器人課程 ' + esc(APP_VERSION) + '｜車城國小資訊教育　教學與競賽練習用</span>' +
        '<span class="env">' + (onPages ? '✅ 目前運行於 GitHub Pages 正式環境（' + esc(APP_VERSION) + '）' : '本機預覽（' + esc(APP_VERSION) + '）') + '</span>' +
        '<span>官方資源：<a href="https://trgreat.com/" target="_blank" rel="noopener">東業創新 × 鴻兔科技</a></span>' +
        '<span class="credit">車城國小資訊老師徐吉德整理製作@2026</span>' +
      '</div>';
  }
  const dlg = document.createElement('dialog');
  dlg.id = 'logDlg';
  dlg.innerHTML = '<h3>更新紀錄</h3>' +
    CHANGELOG.map((c, i) => '<div class="log-item"><b>' + esc(c.version) + '</b>' + (i === 0 ? '<span class="newest">最新</span>' : '') +
      ' <span class="muted">（' + esc(c.date) + '）</span><div>' + esc(c.desc) + '</div></div>').join('') +
    '<div class="btns"><button class="btn" type="button" id="logClose">關閉</button></div>';
  document.body.appendChild(dlg);

  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
  on('verBtn', 'click', () => dlg.showModal());
  on('logClose', 'click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  on('navToggle', 'click', e => {
    const nav = document.getElementById('mainNav');
    const open = nav.classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  on('themeBtn', 'click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const dark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(dark ? 'light' : 'dark');
  });
}

/* 分頁切換：<div class="tabs" data-tabs="group"> 內的 button[data-tab] 對應 [data-panel] */
function initTabs() {
  document.querySelectorAll('.tabs[data-tabs]').forEach(bar => {
    const group = bar.dataset.tabs;
    const btns = [...bar.querySelectorAll('button[data-tab]')];
    const show = key => {
      btns.forEach(b => b.setAttribute('aria-selected', b.dataset.tab === key ? 'true' : 'false'));
      document.querySelectorAll('[data-panel-group="' + group + '"]').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== key));
    };
    btns.forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
    if (btns[0]) show(btns[0].dataset.tab);
  });
}

/* 複製按鈕：<button data-copy="元素id">，複製該元素的文字（共用，任何頁面都可用） */
function initCopy() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const el = document.getElementById(b.dataset.copy); if (!el) return;
    const label = b.dataset.label || b.textContent;
    b.dataset.label = label;
    const done = msg => { b.textContent = msg; setTimeout(() => { b.textContent = label; }, 1500); };
    const text = el.textContent;
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => done('已複製 ✓'), () => fallback());
    else fallback();
    function fallback() {
      const r = document.createRange(); r.selectNodeContents(el);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      done('已選取，請按 Ctrl+C');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderChrome();
  initTabs();
  initCopy();
});
