// ============================================================
// นิพนธ์ฟาร์ม — Google Apps Script Backend
// Smart Sow Productivity System v1.0
// Deploy: Extensions > Apps Script > Deploy > Web App
// Execute as: Me | Access: Anyone
// ============================================================

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

const SHEETS = {
  SETTINGS: 'SETTINGS',
  SOWS: 'SOWS',
  BOARS: 'BOARS',
  CYCLES: 'CYCLES',
  EVENTS: 'EVENTS',
  USERS: 'USERS'
};

// ── CORS Helper ──────────────────────────────────────────────
function setCORSHeaders(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const params = e.parameter;
    const postData = e.postData ? JSON.parse(e.postData.contents || '{}') : {};
    const action = params.action || postData.action;

    let result;
    switch (action) {
      case 'login':            result = login(postData); break;
      case 'getDashboard':     result = getDashboard(postData); break;
      case 'getTasksToday':    result = getTasksToday(postData); break;
      case 'getSows':          result = getSows(postData); break;
      case 'getSowDetail':     result = getSowDetail(postData); break;
      case 'addSow':           result = addSow(postData); break;
      case 'updateSow':        result = updateSow(postData); break;
      case 'getBoars':         result = getBoars(); break;
      case 'recordService':    result = recordService(postData); break;
      case 'recordPregCheck':  result = recordPregCheck(postData); break;
      case 'recordFarrowing':  result = recordFarrowing(postData); break;
      case 'recordWeaning':    result = recordWeaning(postData); break;
      case 'getCycles':        result = getCycles(postData); break;
      case 'getSettings':      result = getSettings(); break;
      case 'updateSettings':   result = updateSettings(postData); break;
      case 'getReports':       result = getReports(postData); break;
      case 'cullSow':          result = cullSow(postData); break;
      default:                 result = { success: false, error: 'Unknown action: ' + action };
    }

    return setCORSHeaders(ContentService.createTextOutput(JSON.stringify(result)));
  } catch (err) {
    return setCORSHeaders(ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message })
    ));
  }
}

// ── Helpers ──────────────────────────────────────────────────
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name);
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function formatDate(date) {
  if (!date || date === '') return '';
  if (typeof date === 'string') return date;
  const d = new Date(date);
  return Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
}

function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function daysBetween(d1, d2) {
  if (!d1 || !d2) return null;
  const ms = new Date(d2) - new Date(d1);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function getSettingsMap() {
  const sheet = getSheet(SHEETS.SETTINGS);
  const data = sheetToObjects(sheet);
  const map = {};
  data.forEach(r => { map[r.key] = r.value; });
  return map;
}

// ── AUTH ─────────────────────────────────────────────────────
// v1: เปรียบรหัสผ่านตรงๆ (plain text) ง่ายต่อการทดสอบ
// ภายหลังสามารถเปลี่ยนมาใช้ hash ได้โดยแทน u.password === password
function login(data) {
  const { username, password } = data;
  const sheet = getSheet(SHEETS.USERS);
  const users = sheetToObjects(sheet);
  const user = users.find(u =>
    u.username === username &&
    u.password === password &&
    (u.is_active === true || u.is_active === 'TRUE')
  );
  if (!user) return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  return {
    success: true,
    user: { username: user.username, role: user.role, display_name: user.display_name }
  };
}

// ── DASHBOARD ────────────────────────────────────────────────
function getDashboard() {
  const sows = sheetToObjects(getSheet(SHEETS.SOWS)).filter(s => s.is_active == true);
  const cycles = sheetToObjects(getSheet(SHEETS.CYCLES));
  const settings = getSettingsMap();

  const statusCounts = { OPEN: 0, SERVED: 0, PREGNANT: 0, LACTATING: 0 };
  sows.forEach(s => { if (statusCounts[s.status] !== undefined) statusCounts[s.status]++; });

  const completedCycles = cycles.filter(c => c.cycle_status === 'COMPLETE' && c.weaned_count > 0);
  const avgLiveBorn = completedCycles.length > 0
    ? completedCycles.reduce((sum, c) => sum + Number(c.live_born || 0), 0) / completedCycles.length : 0;
  const avgWeaned = completedCycles.length > 0
    ? completedCycles.reduce((sum, c) => sum + Number(c.weaned_count || 0), 0) / completedCycles.length : 0;

  const wsiCycles = completedCycles.filter(c => c.wsi_days > 0);
  const avgWSI = wsiCycles.length > 0
    ? wsiCycles.reduce((sum, c) => sum + Number(c.wsi_days || 0), 0) / wsiCycles.length : 0;

  const activeSows = sows.length;
  const littersPerYear = 365 / (Number(settings.GESTATION_DAYS || 114) + Number(settings.LACTATION_TARGET || 21) + Number(settings.WSI_TARGET || 7));
  const psy = avgWeaned * littersPerYear;

  const recentCycles = completedCycles.slice(-20);
  const farrowingRateData = recentCycles.map(c => ({
    label: c.cycle_id,
    live_born: Number(c.live_born || 0),
    stillborn: Number(c.stillborn || 0),
    mummy: Number(c.mummy || 0)
  }));

  return {
    success: true,
    statusCounts,
    kpis: {
      total_sows: activeSows,
      avg_live_born: Math.round(avgLiveBorn * 10) / 10,
      avg_weaned: Math.round(avgWeaned * 10) / 10,
      avg_wsi: Math.round(avgWSI * 10) / 10,
      psy: Math.round(psy * 10) / 10,
      total_cycles: completedCycles.length
    },
    chartData: { farrowingRateData }
  };
}

// ── TASKS TODAY ───────────────────────────────────────────────
function getTasksToday() {
  const today = formatDate(new Date());
  const tomorrow = addDays(today, 1);
  const upcoming3 = addDays(today, 3);

  const cycles = sheetToObjects(getSheet(SHEETS.CYCLES)).filter(c => c.cycle_status === 'ACTIVE');
  const tasks = [];

  cycles.forEach(c => {
    const sowId = c.sow_id;

    // ตรวจท้องรอบ 1 (วันที่ 21)
    if (!c.preg_check1_date && c.preg_check1_due && c.preg_check1_due <= upcoming3) {
      tasks.push({
        type: 'PREG_CHECK_1',
        sow_id: sowId, cycle_id: c.cycle_id,
        due_date: formatDate(c.preg_check1_due),
        priority: c.preg_check1_due <= today ? 'URGENT' : 'UPCOMING',
        label: `ตรวจท้องรอบ 1 — ${sowId}`
      });
    }

    // ตรวจท้องรอบ 2 (วันที่ 42)
    if (c.preg_check1_result === 'POSITIVE' && !c.preg_check2_date &&
        c.preg_check2_due && c.preg_check2_due <= upcoming3) {
      tasks.push({
        type: 'PREG_CHECK_2',
        sow_id: sowId, cycle_id: c.cycle_id,
        due_date: formatDate(c.preg_check2_due),
        priority: c.preg_check2_due <= today ? 'URGENT' : 'UPCOMING',
        label: `ยืนยันการตั้งท้อง — ${sowId}`
      });
    }

    // ย้ายเข้าเล้าคลอด (วันที่ 110)
    if (!c.move_farrowing_date && c.move_farrowing_due && c.move_farrowing_due <= upcoming3) {
      tasks.push({
        type: 'MOVE_FARROWING',
        sow_id: sowId, cycle_id: c.cycle_id,
        due_date: formatDate(c.move_farrowing_due),
        priority: c.move_farrowing_due <= today ? 'URGENT' : 'UPCOMING',
        label: `ย้ายเข้าเล้าคลอด — ${sowId}`
      });
    }

    // แจ้งเตือนใกล้คลอด (7 วันก่อน)
    if (!c.actual_farrowing_date && c.expected_farrowing) {
      const daysToFarrow = daysBetween(today, formatDate(c.expected_farrowing));
      if (daysToFarrow !== null && daysToFarrow >= 0 && daysToFarrow <= 7) {
        tasks.push({
          type: 'NEAR_FARROWING',
          sow_id: sowId, cycle_id: c.cycle_id,
          due_date: formatDate(c.expected_farrowing),
          priority: daysToFarrow <= 1 ? 'URGENT' : 'UPCOMING',
          label: `ใกล้ถึงกำหนดคลอด (${daysToFarrow} วัน) — ${sowId}`
        });
      }
    }
  });

  // ตรวจสอบแม่สุกรที่ควรหย่านม (lactation > 23 วัน)
  const lactatingCycles = sheetToObjects(getSheet(SHEETS.CYCLES))
    .filter(c => c.actual_farrowing_date && !c.weaning_date && c.cycle_status === 'ACTIVE');
  lactatingCycles.forEach(c => {
    const lacDays = daysBetween(formatDate(c.actual_farrowing_date), today);
    if (lacDays >= 21) {
      tasks.push({
        type: 'WEANING_DUE',
        sow_id: c.sow_id, cycle_id: c.cycle_id,
        due_date: formatDate(c.actual_farrowing_date),
        priority: lacDays >= 24 ? 'URGENT' : 'UPCOMING',
        label: `ครบกำหนดหย่านม (เลี้ยง ${lacDays} วัน) — ${c.sow_id}`
      });
    }
  });

  tasks.sort((a, b) => {
    const p = { URGENT: 0, UPCOMING: 1 };
    return p[a.priority] - p[b.priority];
  });

  return { success: true, tasks, today };
}

// ── SOWS ─────────────────────────────────────────────────────
function getSows(data) {
  const sows = sheetToObjects(getSheet(SHEETS.SOWS));
  let filtered = sows.filter(s => s.is_active == true || s.is_active === 'TRUE');
  if (data && data.status) filtered = filtered.filter(s => s.status === data.status);
  return { success: true, sows: filtered };
}

function getSowDetail(data) {
  const { sow_id } = data;
  const sows = sheetToObjects(getSheet(SHEETS.SOWS));
  const sow = sows.find(s => s.sow_id === sow_id);
  if (!sow) return { success: false, error: 'ไม่พบข้อมูลแม่สุกร: ' + sow_id };

  const cycles = sheetToObjects(getSheet(SHEETS.CYCLES))
    .filter(c => c.sow_id === sow_id)
    .sort((a, b) => Number(b.parity) - Number(a.parity));

  const settings = getSettingsMap();
  const cullWarnings = [];

  if (Number(sow.current_parity) >= Number(settings.CULL_MAX_PARITY || 8)) {
    cullWarnings.push(`ท้องที่ ${sow.current_parity} เกินเกณฑ์ (${settings.CULL_MAX_PARITY})`);
  }

  const recent3 = cycles.slice(0, 3).filter(c => c.live_born > 0);
  if (recent3.length >= 2) {
    const avgLB = recent3.reduce((s, c) => s + Number(c.live_born), 0) / recent3.length;
    if (avgLB < Number(settings.CULL_MIN_LIVE_BORN || 10)) {
      cullWarnings.push(`ลูกมีชีวิตเฉลี่ย 3 ท้องล่าสุด: ${avgLB.toFixed(1)} ตัว (ต่ำกว่า ${settings.CULL_MIN_LIVE_BORN})`);
    }
  }

  return { success: true, sow, cycles, cullWarnings };
}

function addSow(data) {
  const sheet = getSheet(SHEETS.SOWS);
  const { ear_tag, breed, birth_date, entry_date, source, notes } = data;
  const sows = sheetToObjects(sheet);

  const existing = sows.find(s => s.ear_tag === ear_tag && s.is_active == true);
  if (existing) return { success: false, error: `เบอร์หู ${ear_tag} มีในระบบแล้ว` };

  const paddedNum = String(sows.length + 1).padStart(3, '0');
  const sow_id = 'S' + paddedNum;
  const now = formatDate(new Date());

  sheet.appendRow([
    sow_id, ear_tag, breed || 'Landrace x Yorkshire',
    birth_date || '', entry_date || now,
    source || '', 'OPEN', 0, '', notes || '', now, now, true
  ]);

  return { success: true, sow_id, message: `เพิ่มแม่สุกร ${ear_tag} (${sow_id}) สำเร็จ` };
}

function updateSow(data) {
  const sheet = getSheet(SHEETS.SOWS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const sowIdIdx = headers.indexOf('sow_id');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][sowIdIdx] === data.sow_id) {
      if (data.location !== undefined) rows[i][headers.indexOf('location')] = data.location;
      if (data.notes !== undefined) rows[i][headers.indexOf('notes')] = data.notes;
      if (data.status !== undefined) rows[i][headers.indexOf('status')] = data.status;
      rows[i][headers.indexOf('updated_at')] = formatDate(new Date());
      sheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);
      return { success: true, message: 'อัปเดตข้อมูลสำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบ sow_id: ' + data.sow_id };
}

// ── BOARS ────────────────────────────────────────────────────
function getBoars() {
  const boars = sheetToObjects(getSheet(SHEETS.BOARS))
    .filter(b => b.is_active == true || b.is_active === 'TRUE');
  return { success: true, boars };
}

// ── CYCLE RECORDING ──────────────────────────────────────────
function recordService(data) {
  const { sow_id, service_date, boar_id, technician, service_type, notes } = data;
  const settings = getSettingsMap();
  const gestDays = Number(settings.GESTATION_DAYS || 114);
  const check1Days = Number(settings.PREG_CHECK_DAY1 || 21);
  const check2Days = Number(settings.PREG_CHECK_DAY2 || 42);
  const moveFarrowDay = Number(settings.MOVE_FARROWING_DAY || 110);

  const sowSheet = getSheet(SHEETS.SOWS);
  const sowRows = sowSheet.getDataRange().getValues();
  const sowHeaders = sowRows[0];
  const sowIdIdx = sowHeaders.indexOf('sow_id');
  const parityIdx = sowHeaders.indexOf('current_parity');
  const statusIdx = sowHeaders.indexOf('status');
  const updatedIdx = sowHeaders.indexOf('updated_at');

  let currentParity = 0;
  let sowRowIndex = -1;

  for (let i = 1; i < sowRows.length; i++) {
    if (sowRows[i][sowIdIdx] === sow_id) {
      currentParity = Number(sowRows[i][parityIdx]) + 1;
      sowRowIndex = i;
      break;
    }
  }
  if (sowRowIndex === -1) return { success: false, error: 'ไม่พบ sow_id: ' + sow_id };

  const cycle_id = `${sow_id}-${currentParity}`;
  const cycleSheet = getSheet(SHEETS.CYCLES);
  const existing = sheetToObjects(cycleSheet).find(c => c.cycle_id === cycle_id);
  if (existing) return { success: false, error: `วงจร ${cycle_id} มีอยู่แล้ว` };

  const expected_farrowing = addDays(service_date, gestDays);
  const preg_check1_due = addDays(service_date, check1Days);
  const preg_check2_due = addDays(service_date, check2Days);
  const move_farrowing_due = addDays(service_date, moveFarrowDay);
  const now = formatDate(new Date());

  cycleSheet.appendRow([
    cycle_id, sow_id, currentParity,
    service_date, boar_id, technician, service_type || 'AI',
    expected_farrowing, preg_check1_due, '', '', preg_check2_due, '', '',
    move_farrowing_due, '', '', '', '', '', '', '', '', 0, 0,
    '', '', '', 0, '', '', 'ACTIVE', notes || '', now
  ]);

  // อัปเดตสถานะแม่สุกร
  sowRows[sowRowIndex][parityIdx] = currentParity;
  sowRows[sowRowIndex][statusIdx] = 'SERVED';
  sowRows[sowRowIndex][updatedIdx] = now;
  sowSheet.getRange(sowRowIndex + 1, 1, 1, sowRows[sowRowIndex].length).setValues([sowRows[sowRowIndex]]);

  return {
    success: true, cycle_id,
    expected_farrowing, preg_check1_due, preg_check2_due, move_farrowing_due,
    message: `บันทึกการผสม ${sow_id} ท้องที่ ${currentParity} สำเร็จ`
  };
}

function recordPregCheck(data) {
  const { cycle_id, check_round, check_date, result } = data;
  const cycleSheet = getSheet(SHEETS.CYCLES);
  const rows = cycleSheet.getDataRange().getValues();
  const headers = rows[0];
  const cycleIdIdx = headers.indexOf('cycle_id');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][cycleIdIdx] === cycle_id) {
      if (check_round === 1 || check_round === '1') {
        rows[i][headers.indexOf('preg_check1_date')] = check_date;
        rows[i][headers.indexOf('preg_check1_result')] = result;
      } else {
        rows[i][headers.indexOf('preg_check2_date')] = check_date;
        rows[i][headers.indexOf('preg_check2_result')] = result;
      }

      if (result === 'NEGATIVE') {
        updateSowStatus(rows[i][headers.indexOf('sow_id')], 'OPEN');
        rows[i][headers.indexOf('cycle_status')] = 'CULLED';
      } else if (result === 'CONFIRMED') {
        updateSowStatus(rows[i][headers.indexOf('sow_id')], 'PREGNANT');
      }

      cycleSheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);
      return { success: true, message: `บันทึกผลตรวจท้องรอบ ${check_round} สำเร็จ` };
    }
  }
  return { success: false, error: 'ไม่พบ cycle_id: ' + cycle_id };
}

function recordFarrowing(data) {
  const { cycle_id, farrowing_date, live_born, stillborn, mummy, birth_weight_total, notes } = data;
  const cycleSheet = getSheet(SHEETS.CYCLES);
  const rows = cycleSheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('cycle_id')] === cycle_id) {
      const serviceDate = formatDate(rows[i][headers.indexOf('service_date')]);
      const gestLen = daysBetween(serviceDate, farrowing_date);

      rows[i][headers.indexOf('actual_farrowing_date')] = farrowing_date;
      rows[i][headers.indexOf('gestation_length')] = gestLen;
      rows[i][headers.indexOf('total_born')] = Number(live_born) + Number(stillborn) + Number(mummy);
      rows[i][headers.indexOf('live_born')] = Number(live_born);
      rows[i][headers.indexOf('stillborn')] = Number(stillborn || 0);
      rows[i][headers.indexOf('mummy')] = Number(mummy || 0);
      rows[i][headers.indexOf('birth_weight_total')] = Number(birth_weight_total || 0);
      if (notes) rows[i][headers.indexOf('notes')] = notes;

      cycleSheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);
      updateSowStatus(rows[i][headers.indexOf('sow_id')], 'LACTATING');

      return {
        success: true,
        gestation_length: gestLen,
        total_born: Number(live_born) + Number(stillborn) + Number(mummy),
        message: `บันทึกการคลอด ${cycle_id} สำเร็จ`
      };
    }
  }
  return { success: false, error: 'ไม่พบ cycle_id: ' + cycle_id };
}

function recordWeaning(data) {
  const { cycle_id, weaning_date, weaned_count, weaning_weight_total } = data;
  const cycleSheet = getSheet(SHEETS.CYCLES);
  const rows = cycleSheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('cycle_id')] === cycle_id) {
      const farrowDate = formatDate(rows[i][headers.indexOf('actual_farrowing_date')]);
      const lacDays = daysBetween(farrowDate, weaning_date);

      rows[i][headers.indexOf('weaning_date')] = weaning_date;
      rows[i][headers.indexOf('weaned_count')] = Number(weaned_count);
      rows[i][headers.indexOf('weaning_weight_total')] = Number(weaning_weight_total || 0);
      rows[i][headers.indexOf('lactation_days')] = lacDays;
      rows[i][headers.indexOf('cycle_status')] = 'COMPLETE';

      cycleSheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);
      updateSowStatus(rows[i][headers.indexOf('sow_id')], 'OPEN');

      return {
        success: true,
        lactation_days: lacDays,
        message: `บันทึกการหย่านม ${cycle_id} สำเร็จ — เลี้ยงลูก ${lacDays} วัน`
      };
    }
  }
  return { success: false, error: 'ไม่พบ cycle_id: ' + cycle_id };
}

function getCycles(data) {
  const cycles = sheetToObjects(getSheet(SHEETS.CYCLES));
  if (data && data.sow_id) {
    return { success: true, cycles: cycles.filter(c => c.sow_id === data.sow_id) };
  }
  if (data && data.status) {
    return { success: true, cycles: cycles.filter(c => c.cycle_status === data.status) };
  }
  return { success: true, cycles };
}

// ── SETTINGS ─────────────────────────────────────────────────
function getSettings() {
  return { success: true, settings: sheetToObjects(getSheet(SHEETS.SETTINGS)) };
}

function updateSettings(data) {
  const sheet = getSheet(SHEETS.SETTINGS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const keyIdx = headers.indexOf('key');
  const valIdx = headers.indexOf('value');

  Object.keys(data.settings || {}).forEach(key => {
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][keyIdx] === key) {
        rows[i][valIdx] = data.settings[key];
        sheet.getRange(i + 1, valIdx + 1).setValue(data.settings[key]);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, data.settings[key], '']);
    }
  });
  return { success: true, message: 'บันทึกการตั้งค่าสำเร็จ' };
}

// ── REPORTS ──────────────────────────────────────────────────
function getReports(data) {
  const cycles = sheetToObjects(getSheet(SHEETS.CYCLES));
  const completed = cycles.filter(c => c.cycle_status === 'COMPLETE');

  const month = data && data.month ? data.month : null;
  const filtered = month
    ? completed.filter(c => formatDate(c.weaning_date).startsWith(month))
    : completed;

  const technicianStats = {};
  cycles.forEach(c => {
    if (!c.technician) return;
    if (!technicianStats[c.technician]) {
      technicianStats[c.technician] = { services: 0, farrowings: 0, total_live_born: 0 };
    }
    technicianStats[c.technician].services++;
    if (c.actual_farrowing_date) {
      technicianStats[c.technician].farrowings++;
      technicianStats[c.technician].total_live_born += Number(c.live_born || 0);
    }
  });

  const pendingCull = sheetToObjects(getSheet(SHEETS.SOWS)).filter(s => {
    const settings = getSettingsMap();
    return s.is_active == true &&
      (Number(s.current_parity) >= Number(settings.CULL_MAX_PARITY || 8));
  });

  return {
    success: true,
    summary: {
      total_farrowings: filtered.length,
      avg_live_born: filtered.length > 0
        ? Math.round(filtered.reduce((s, c) => s + Number(c.live_born || 0), 0) / filtered.length * 10) / 10 : 0,
      avg_weaned: filtered.length > 0
        ? Math.round(filtered.reduce((s, c) => s + Number(c.weaned_count || 0), 0) / filtered.length * 10) / 10 : 0,
      total_live_born: filtered.reduce((s, c) => s + Number(c.live_born || 0), 0),
      total_weaned: filtered.reduce((s, c) => s + Number(c.weaned_count || 0), 0)
    },
    technicianStats,
    pendingCull,
    recentCycles: filtered.slice(-30).map(c => ({
      cycle_id: c.cycle_id,
      sow_id: c.sow_id,
      parity: c.parity,
      live_born: c.live_born,
      weaned_count: c.weaned_count,
      lactation_days: c.lactation_days,
      wsi_days: c.wsi_days,
      weaning_date: formatDate(c.weaning_date)
    }))
  };
}

// ── CULL ─────────────────────────────────────────────────────
function cullSow(data) {
  const { sow_id, reason, recorded_by } = data;
  const sheet = getSheet(SHEETS.SOWS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('sow_id')] === sow_id) {
      rows[i][headers.indexOf('status')] = 'CULLED';
      rows[i][headers.indexOf('is_active')] = false;
      rows[i][headers.indexOf('notes')] = `CULLED: ${reason} (${formatDate(new Date())})`;
      rows[i][headers.indexOf('updated_at')] = formatDate(new Date());
      sheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);

      getSheet(SHEETS.EVENTS).appendRow([
        `EVT-CULL-${sow_id}-${Date.now()}`, sow_id, formatDate(new Date()),
        'CULL', reason, recorded_by || 'system', ''
      ]);

      return { success: true, message: `คัดทิ้ง ${sow_id} สำเร็จ` };
    }
  }
  return { success: false, error: 'ไม่พบ sow_id: ' + sow_id };
}

// ── Internal Helper ───────────────────────────────────────────
function updateSowStatus(sow_id, status) {
  const sheet = getSheet(SHEETS.SOWS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('sow_id')] === sow_id) {
      rows[i][headers.indexOf('status')] = status;
      rows[i][headers.indexOf('updated_at')] = formatDate(new Date());
      sheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);
      return;
    }
  }
}

// ════════════════════════════════════════════════════════════════
// 🚀 initSheets() — รันครั้งเดียวเพื่อตั้งค่าฐานข้อมูลทั้งหมด
// วิธีใช้: Apps Script Editor > เลือก initSheets > กด ▶ Run
// ════════════════════════════════════════════════════════════════
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const today = formatDate(new Date());

  Logger.log('🚀 เริ่ม initSheets สำหรับนิพนธ์ฟาร์ม...');

  // ── ฟังก์ชันช่วย: สร้าง Sheet ใหม่หรือล้างของเดิม ──────────
  function createOrClearSheet(name) {
    let sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.clearContents();
      Logger.log(`  ♻️  ล้าง Sheet: ${name}`);
    } else {
      sheet = ss.insertSheet(name);
      Logger.log(`  ✅ สร้าง Sheet: ${name}`);
    }
    return sheet;
  }

  // ── 1. SETTINGS ─────────────────────────────────────────────
  const settingsSheet = createOrClearSheet('SETTINGS');
  settingsSheet.getRange(1, 1, 1, 3).setValues([['key', 'value', 'label']]);
  settingsSheet.getRange(2, 1, 12, 3).setValues([
    ['FARM_NAME',           'นิพนธ์ฟาร์ม',  'ชื่อฟาร์ม'],
    ['GESTATION_DAYS',      '114',           'วันอุ้มท้องมาตรฐาน'],
    ['LACTATION_TARGET',    '21',            'เป้าหมายวันเลี้ยงลูก'],
    ['WSI_TARGET',          '7',             'เป้าหมาย WSI (วัน)'],
    ['PREG_CHECK_DAY1',     '21',            'ตรวจท้องรอบ 1 (วันที่นับจากผสม)'],
    ['PREG_CHECK_DAY2',     '42',            'ตรวจท้องรอบ 2 (วันที่นับจากผสม)'],
    ['MOVE_FARROWING_DAY',  '110',           'ย้ายเข้าเล้าคลอด (วันที่นับจากผสม)'],
    ['CULL_MAX_PARITY',     '8',             'คัดทิ้งเมื่อท้องที่ >= ค่านี้'],
    ['CULL_MIN_LIVE_BORN',  '10',            'คัดทิ้งเมื่อ Live Born เฉลี่ย < ค่านี้'],
    ['CULL_MAX_RETURNS',    '3',             'คัดทิ้งเมื่อกลับสัดเกิน N ครั้ง'],
    ['PSY_TARGET',          '28',            'เป้าหมาย PSY (ลูก/แม่/ปี)'],
    ['LINE_TOKEN',          '',              'LINE Notify Token (ถ้ามี)'],
  ]);
  settingsSheet.getRange('A1:C1').setFontWeight('bold').setBackground('#d9ead3');
  settingsSheet.setColumnWidth(1, 180);
  settingsSheet.setColumnWidth(2, 140);
  settingsSheet.setColumnWidth(3, 240);

  // ── 2. USERS ────────────────────────────────────────────────
  // password เก็บเป็น plain text (v1 ทดสอบ) — เปลี่ยนได้ภายหลัง
  const usersSheet = createOrClearSheet('USERS');
  usersSheet.getRange(1, 1, 1, 5).setValues([['username', 'password', 'role', 'display_name', 'is_active']]);
  usersSheet.getRange(2, 1, 3, 5).setValues([
    ['aod',    'aod1234',   'ADMIN', 'คุณนิพนธ์ (เจ้าของ)',  true],
    ['staff1', 'staff1234', 'STAFF', 'สมชาย (คนงาน)',        true],
    ['staff2', 'staff1234', 'STAFF', 'สมหญิง (คนงาน)',       true],
  ]);
  usersSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#fce5cd');
  Logger.log('  👤 สร้างผู้ใช้: aod/aod1234 (Admin), staff1/staff1234, staff2/staff1234');

  // ── 3. BOARS ────────────────────────────────────────────────
  const boarsSheet = createOrClearSheet('BOARS');
  boarsSheet.getRange(1, 1, 1, 6).setValues([['boar_id', 'ear_tag', 'breed', 'birth_date', 'entry_date', 'is_active']]);
  boarsSheet.getRange(2, 1, 3, 6).setValues([
    ['B001', 'P001', 'Duroc',      '2021-01-15', '2022-03-01', true],
    ['B002', 'P002', 'Duroc',      '2021-06-20', '2022-08-01', true],
    ['B003', 'P003', 'Hampshire',  '2022-02-10', '2023-01-01', true],
  ]);
  boarsSheet.getRange('A1:F1').setFontWeight('bold').setBackground('#d9ead3');

  // ── 4. SOWS ─────────────────────────────────────────────────
  const sowsSheet = createOrClearSheet('SOWS');
  const sowHeaders = ['sow_id','ear_tag','breed','birth_date','entry_date','source','status','current_parity','location','notes','created_at','updated_at','is_active'];
  sowsSheet.getRange(1, 1, 1, sowHeaders.length).setValues([sowHeaders]);

  // สร้างแม่สุกรตัวอย่าง 10 ตัว หลากหลายสถานะ
  const sampleSows = [
    ['S001','001','LW×L','2021-03-10','2022-09-01','ฟาร์มพ่อแม่พันธุ์A','PREGNANT',  4,'G-A01','',today,today,true],
    ['S002','002','LW×L','2021-05-20','2022-11-01','ฟาร์มพ่อแม่พันธุ์A','LACTATING', 2,'F-B03','',today,today,true],
    ['S003','003','LW×L','2022-01-15','2023-07-01','ฟาร์มพ่อแม่พันธุ์A','OPEN',      1,'G-A05','',today,today,true],
    ['S004','004','LW×L','2020-08-05','2022-01-01','ฟาร์มพ่อแม่พันธุ์B','SERVED',    6,'G-B12','',today,today,true],
    ['S005','005','LW×L','2021-11-12','2023-05-01','ฟาร์มพ่อแม่พันธุ์A','PREGNANT',  3,'G-A08','',today,today,true],
    ['S006','006','LW×L','2022-04-20','2023-10-01','ฟาร์มพ่อแม่พันธุ์B','OPEN',      0,'G-C02','สุกรสาวรอผสม',today,today,true],
    ['S007','007','LW×L','2020-06-01','2021-12-01','ฟาร์มพ่อแม่พันธุ์A','LACTATING', 7,'F-B08','ใกล้ถึงเกณฑ์คัดทิ้ง',today,today,true],
    ['S008','008','LW×L','2021-09-15','2023-03-01','ฟาร์มพ่อแม่พันธุ์B','OPEN',      2,'G-D04','',today,today,true],
    ['S009','009','LW×L','2022-02-28','2023-08-01','ฟาร์มพ่อแม่พันธุ์A','SERVED',    1,'G-A10','',today,today,true],
    ['S010','010','LW×L','2019-11-01','2021-05-01','ฟาร์มพ่อแม่พันธุ์A','OPEN',      9,'G-E01','ควรคัดทิ้ง',today,today,true],
  ];
  sowsSheet.getRange(2, 1, sampleSows.length, sowHeaders.length).setValues(sampleSows);
  sowsSheet.getRange('A1:M1').setFontWeight('bold').setBackground('#cfe2f3');
  Logger.log(`  🐷 สร้างแม่สุกรตัวอย่าง ${sampleSows.length} ตัว`);

  // ── 5. CYCLES ───────────────────────────────────────────────
  const cyclesSheet = createOrClearSheet('CYCLES');
  const cycleHeaders = [
    'cycle_id','sow_id','parity','service_date','boar_id','technician','service_type',
    'expected_farrowing','preg_check1_due','preg_check1_date','preg_check1_result',
    'preg_check2_due','preg_check2_date','preg_check2_result',
    'move_farrowing_due','move_farrowing_date',
    'actual_farrowing_date','gestation_length',
    'total_born','live_born','stillborn','mummy','birth_weight_total',
    'fostered_in','fostered_out',
    'weaning_date','weaned_count','weaning_weight_total','lactation_days',
    'wsi_date','wsi_days','cycle_status','notes','created_at'
  ];
  cyclesSheet.getRange(1, 1, 1, cycleHeaders.length).setValues([cycleHeaders]);

  // วงจรตัวอย่าง: ครอบคลุมทุกสถานะ (COMPLETE, ACTIVE)
  const sampleCycles = [
    // S001 ท้องที่ 4 (ACTIVE - กำลังท้อง)
    ['S001-4','S001',4,'2024-03-01','B001','สมชาย','AI',
     '2024-06-23','2024-03-22','2024-03-21','POSITIVE',
     '2024-04-12','2024-04-11','CONFIRMED',
     '2024-06-19','2024-06-18',
     '','','','','','','',0,0,'','','','','','','ACTIVE','',today],

    // S002 ท้องที่ 2 (ACTIVE - กำลังเลี้ยงลูก คลอดแล้ว)
    ['S002-2','S002',2,'2024-01-05','B002','สมหญิง','AI',
     '2024-04-29','2024-01-26','2024-01-25','POSITIVE',
     '2024-02-16','2024-02-15','CONFIRMED',
     '2024-04-25','2024-04-24',
     '2024-04-28',113,13,12,1,0,16.2,0,0,'','','','','','','ACTIVE','คลอดปกติ',today],

    // S004 ท้องที่ 6 (ACTIVE - ผสมใหม่)
    ['S004-6','S004',6,'2024-05-10','B003','สมชาย','AI',
     '2024-09-01','2024-05-31','','',
     '2024-06-21','','',
     '2024-08-28','',
     '','','','','','','',0,0,'','','','','','','ACTIVE','',today],

    // S009 ท้องที่ 1 (ACTIVE - ผสมใหม่)
    ['S009-1','S009',1,'2024-05-20','B001','สมชาย','AI',
     '2024-09-11','2024-06-10','','',
     '2024-07-01','','',
     '2024-09-07','',
     '','','','','','','',0,0,'','','','','','','ACTIVE','สุกรสาวท้องแรก',today],

    // S001 ท้องที่ 3 (COMPLETE)
    ['S001-3','S001',3,'2023-09-01','B001','สมชาย','AI',
     '2023-12-24','2023-09-22','2023-09-21','POSITIVE',
     '2023-10-13','2023-10-12','CONFIRMED',
     '2023-12-20','2023-12-19',
     '2023-12-22',112,14,13,1,0,17.5,0,0,
     '2024-01-13',12,84,22,'2024-01-18',5,'COMPLETE','',today],

    // S001 ท้องที่ 2 (COMPLETE)
    ['S001-2','S001',2,'2023-03-15','B002','สมหญิง','AI',
     '2023-07-07','2023-04-05','2023-04-04','POSITIVE',
     '2023-04-26','2023-04-25','CONFIRMED',
     '2023-07-03','2023-07-02',
     '2023-07-05',112,13,12,1,0,15.8,0,0,
     '2023-07-27',11,77,22,'2023-08-01',5,'COMPLETE','',today],

    // S007 ท้องที่ 7 (COMPLETE — เข้าเกณฑ์คัดทิ้ง)
    ['S007-7','S007',7,'2024-02-01','B001','สมชาย','AI',
     '2024-05-26','2024-02-22','2024-02-21','POSITIVE',
     '2024-03-14','2024-03-13','CONFIRMED',
     '2024-05-22','2024-05-20',
     '2024-05-24',113,11,9,2,0,11.3,0,0,
     '2024-06-14',8,48,21,'2024-06-19',5,'COMPLETE','ผลผลิตลดลง',today],

    // S010 ท้องที่ 9 (COMPLETE — เกินเกณฑ์คัดทิ้ง)
    ['S010-9','S010',9,'2023-12-01','B002','สมหญิง','AI',
     '2024-03-25','2023-12-22','2023-12-21','POSITIVE',
     '2024-01-12','2024-01-11','CONFIRMED',
     '2024-03-21','2024-03-20',
     '2024-03-22',112,10,8,2,0,10.1,0,0,
     '2024-04-12',7,42,21,'2024-04-17',5,'COMPLETE','ท้องที่ 9 ผลผลิตต่ำมาก',today],
  ];
  cyclesSheet.getRange(2, 1, sampleCycles.length, cycleHeaders.length).setValues(sampleCycles);
  cyclesSheet.getRange('A1:AH1').setFontWeight('bold').setBackground('#fff2cc');
  Logger.log(`  🔄 สร้างวงจรตัวอย่าง ${sampleCycles.length} รายการ`);

  // ── 6. EVENTS ───────────────────────────────────────────────
  const eventsSheet = createOrClearSheet('EVENTS');
  eventsSheet.getRange(1, 1, 1, 7).setValues([['event_id','sow_id','event_date','event_type','details','recorded_by','notes']]);
  eventsSheet.getRange(2, 1, 3, 7).setValues([
    ['EVT-001','S001', today, 'VACCINE',   'วัคซีน PRRS + PCV2',     'สมชาย', ''],
    ['EVT-002','S007', today, 'BCS',       'BCS 2.5 — ต่ำกว่าเกณฑ์', 'สมหญิง','ควรพิจารณาคัดทิ้ง'],
    ['EVT-003','S010', today, 'TREATMENT', 'รักษาขาเจ็บ',            'สมชาย', ''],
  ]);
  eventsSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#ead1dc');

  // ── ปรับ column width อัตโนมัติทุก Sheet ──────────────────
  [settingsSheet, usersSheet, boarsSheet, sowsSheet, cyclesSheet, eventsSheet].forEach(s => {
    try { s.autoResizeColumns(1, s.getLastColumn()); } catch(e) {}
  });

  // ── ลบ Sheet1 default ถ้ายังมีอยู่ ───────────────────────
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('แผ่น1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
    Logger.log('  🗑️  ลบ Sheet1 (default) แล้ว');
  }

  Logger.log('');
  Logger.log('════════════════════════════════════════');
  Logger.log('✅ initSheets เสร็จสมบูรณ์!');
  Logger.log('');
  Logger.log('👤 Login ได้ทันที:');
  Logger.log('   Admin : aod / aod1234');
  Logger.log('   Staff : staff1 / staff1234');
  Logger.log('');
  Logger.log('📌 ขั้นตอนถัดไป:');
  Logger.log('   1. Deploy > New deployment > Web App');
  Logger.log('   2. Execute as: Me | Access: Anyone');
  Logger.log('   3. Copy Web App URL ไปใส่ใน API_URL ของ index.html');
  Logger.log('════════════════════════════════════════');

  // แสดง popup สรุปผล
  ui.alert(
    '✅ initSheets สำเร็จ!',
    'สร้างฐานข้อมูลเรียบร้อยแล้ว\n\n' +
    '📋 Sheet ที่สร้าง: SETTINGS, USERS, BOARS, SOWS, CYCLES, EVENTS\n' +
    '🐷 แม่สุกรตัวอย่าง: 10 ตัว (หลากหลายสถานะ)\n' +
    '🔄 วงจรตัวอย่าง: 8 รายการ\n\n' +
    '👤 Login:\n' +
    '   Admin : aod / aod1234\n' +
    '   Staff : staff1 / staff1234\n\n' +
    '📌 ถัดไป: Deploy > New deployment > Web App\n' +
    '   Execute as: Me | Access: Anyone',
    ui.ButtonSet.OK
  );
}
