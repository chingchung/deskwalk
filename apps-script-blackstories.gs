/**
 * Black Stories 題庫 — Google Sheets 後端（唯讀）
 * ---------------------------------------------------------------
 * 張表每行 = 一題。你直接喺 Google 試算表／Excel 度加行就得，
 * 網頁下次載入自動出到新題目，唔使改 code。
 *
 *   id   title   level  minutes  soup      base      note
 *   N2   新題目   5      10       湯面…      湯底…      （可留空）
 *
 *   id       隨便改，唯一就得（用嚟做 key，重複會蓋走前一條）
 *   level    1–10，數字。列表會由淺至深排
 *   minutes  預估解題分鐘，數字
 *   soup     湯面 — 講出嚟畀玩家聽嗰段
 *   base     湯底 — 撳「揭湯底」先見到
 *   note     製作備註，可留空。揭咗湯底先會見到
 *
 * 標題行一定要留喺第一行，欄名唔好改。行嘅次序唔緊要。
 * soup 或者 base 空白嘅行會被跳過。
 *
 * ── 安裝步驟 ──────────────────────────────────────────────────
 * 1. 開張試算表：Black Stories — 題庫
 * 2. 選單：擴充功能 → Apps Script
 * 3. 把成個檔案貼入去，覆蓋原本嗰段 myFunction
 * 4. 撳「部署 → 新增部署作業」
 *      類型   : 網頁應用程式
 *      執行身分: 我
 *      具存取權: 任何人           ← 一定要揀呢個，唔係個網頁連唔到
 * 5. copy 佢畀你嗰條 /exec 網址，貼入 tailstory.html 最上面個 API
 *
 * 改完呢個檔案要重新部署（部署 → 管理部署作業 → 鉛筆 → 版本：新版本）
 * 先會生效。淨係改試算表內容嘅話唔使重新部署。
 */

// 留空 = 用第一個工作表。想指定就填工作表名。
const SHEET_NAME = '';

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, puzzles: readPuzzles() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return (SHEET_NAME && ss.getSheetByName(SHEET_NAME)) || ss.getSheets()[0];
}

function readPuzzles() {
  const rows = sheet().getDataRange().getValues();
  if (!rows.length) return [];

  // 用標題行認欄，所以你搬欄位次序都唔會死
  const head = rows.shift().map(function (h) {
    return String(h || '').trim().toLowerCase();
  });
  const col = {};
  head.forEach(function (h, i) { col[h] = i; });

  const need = ['id', 'title', 'level', 'minutes', 'soup', 'base'];
  for (var i = 0; i < need.length; i++) {
    if (col[need[i]] === undefined) {
      throw new Error('試算表缺少欄位：' + need[i]);
    }
  }

  const out = [];
  rows.forEach(function (r) {
    const soup = text(r[col.soup]);
    const base = text(r[col.base]);
    if (!soup || !base) return;                 // 空行 / 未填完照跳

    out.push({
      id: text(r[col.id]),
      title: text(r[col.title]),
      level: clamp(Number(r[col.level]), 1, 10, 5),
      minutes: clamp(Number(r[col.minutes]), 1, 999, 10),
      soup: soup,
      base: base,
      note: col.note === undefined ? '' : text(r[col.note])
    });
  });

  out.sort(function (a, b) { return a.level - b.level || a.minutes - b.minutes; });
  return out;
}

function text(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

function clamp(n, lo, hi, dflt) {
  if (!isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}
