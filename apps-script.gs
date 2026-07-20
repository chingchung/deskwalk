/**
 * deskwalk 積分榜 — Google Sheets 後端
 * ---------------------------------------------------------------
 * 張表每行 = 一個玩家喺一場嘅得分,所以你可以直接開張表改數字:
 *
 *   id          date        game    player   pts
 *   s-20260717  2026-07-17  Skout   Charles  3
 *   s-20260717  2026-07-17  Skout   Samuel   1.5
 *
 * id 係用嚟分開「同一日玩兩次同一隻遊戲」。你手動加行時可以留空,
 * 留空就當同 date + game 一樣嗰啲係同一場。
 *
 * ── 安裝步驟 ──────────────────────────────────────────────────
 * 1. 開一個新嘅 Google 試算表(或者把你個 .xlsx 另存為 Google 試算表)
 * 2. 選單:擴充功能 → Apps Script
 * 3. 把成個檔案嘅內容貼入去,覆蓋原本嗰段 myFunction
 * 4. 改下面個 PASSWORD 做你想要嘅密碼
 * 5. 撳「部署 → 新增部署作業」
 *      類型   : 網頁應用程式
 *      執行身分: 我
 *      具存取權: 任何人           ← 一定要揀呢個,唔係個網頁連唔到
 * 6. copy 佢畀你嗰條 /exec 網址,貼入 leaderboard.html 最上面個 API
 *
 * 改完呢個檔案要重新部署(部署 → 管理部署作業 → 鉛筆 → 版本:新版本)
 * 先會生效。
 */

const SHEET_NAME = 'sessions';
const PASSWORD = '2444';          // ← 改我。呢個密碼唔會出現喺網頁source入面

/** 讀:任何人開個網頁都會行呢個 */
function doGet() {
  return json({ ok: true, sessions: readSessions() });
}

/** 寫:要密碼啱先做得嘢 */
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'bad-request' });
  }

  if (body.pw !== PASSWORD) return json({ ok: false, error: 'bad-password' });
  if (body.action === 'auth') return json({ ok: true });

  if (body.action === 'save') {
    // 兩個人同時儲存會撞車,排隊做
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(20000);
      writeSessions(body.sessions || []);
      return json({ ok: true, sessions: readSessions() });
    } catch (err) {
      return json({ ok: false, error: 'busy' });
    } finally {
      lock.releaseLock();
    }
  }

  return json({ ok: false, error: 'unknown-action' });
}

/* ---------------------------------------------------------------- */

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['id', 'date', 'game', 'player', 'pts']);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** 逐行讀,按 id(冇就用 date+game)夾返做一場場 */
function readSessions() {
  const rows = sheet().getDataRange().getValues();
  rows.shift();                                   // 掉走標題行

  const byKey = {};
  const order = [];

  rows.forEach(function (r) {
    const id = String(r[0] || '').trim();
    const date = asDate(r[1]);
    const game = String(r[2] || '').trim();
    const player = String(r[3] || '').trim();
    const pts = Number(r[4]);
    if (!date || !game || !player || !isFinite(pts)) return;   // 空行 / 爛行照跳

    const key = id || (date + '|' + game);
    if (!byKey[key]) {
      byKey[key] = { id: key, date: date, game: game, scores: [] };
      order.push(key);
    }
    byKey[key].scores.push({ name: player, pts: pts });
  });

  return order.map(function (k) { return byKey[k]; });
}

/** 全表重寫。清內容而唔係 clear(),保留你落咗嘅格式 */
function writeSessions(sessions) {
  const rows = [['id', 'date', 'game', 'player', 'pts']];

  sessions.forEach(function (g) {
    const id = g.id || (g.date + '|' + g.game);
    (g.scores || []).forEach(function (s) {
      rows.push([id, g.date || '', g.game || '', s.name, s.pts]);
    });
  });

  const sh = sheet();
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 5).setValues(rows);
  sh.setFrozenRows(1);
}

/** 喺表度打日期會變 Date 物件,統一整返 yyyy-MM-dd */
function asDate(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '').trim();
}
