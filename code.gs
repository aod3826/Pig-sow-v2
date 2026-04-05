// ============================================================
// นิพนธ์ฟาร์ม — Google Apps Script Backend v2.0
// แก้ไข: รองรับ GET request เพื่อแก้ปัญหา CORS
// ============================================================

const SHEETS = {
  SETTINGS: 'SETTINGS',
  SOWS: 'SOWS',
  BOARS: 'BOARS',
  CYCLES: 'CYCLES',
  EVENTS: 'EVENTS',
  USERS: 'USERS'
};

// ── CORS & Response Helper ──────────────────────────────────
function makeResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── รับ GET และ POST ทั้งคู่ ────────────────────────────────
// ใช้ GET เป็นหลักเพื่อหลีกเลี่ยงปัญหา CORS preflight
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const params = e.parameter || {};

    // ดึง action และ payload
    const action = params.action || '';
    let data = {};

    // รับข้อมูลจาก payload (GET) หรือ postData (POST)
    if (params.payload) {
      try { data = JSON.parse(decodeURIComponent(params.payload)); } catch(ex) { data = {}; }
    } else if (e.postData && e.postData.contents) {
      try { data = JSON.parse(e.postData.contents); } catch(ex) { data = {}; }
    }

    let result;
    switch (action) {
      case 'login':           result = login(data); break;
      case 'getDashboard':    result = getDashboard(); break;
      case 'getTasksToday':   result = getTasksToday(); break;
      case 'getSows':         result = getSows(data); break;
      case 'getSowDetail':    result = getSowDetail(data); break;
      case 'addSow':          result = addSow(data); break;
      case 'updateSow':       result = updateSow(data); break;
      case 'getBoars':        result = getBoars(); break;
      case 'recordService':   result = recordService(data); break;
      case 'recordPregCheck': result = recordPregCheck(data); break;
      case 'recordFarrowing': result = recordFarrowing(data); break;
      case 'recordWeaning':   result = recordWeaning(data); break;
      case 'getCycles':       result = getCycles(data); break;
      case 'getSettings':     result = getSettings(); break;
      case 'updateSettings':  result = updateSettings(data); break;
      case 'getReports':      result = getReports(data); break;
      case 'cullSow':         result = cullSow(data); break;
      case 'ping':            result = { success: true, message: 'pong', time: new Date().toISOString() }; break;
      default:                result = { success: false, error: 'Unknown action: ' + action };
    }

    return makeResponse(result);
  } catch (err) {
    return makeResponse({ success: false, error: err.message });
  }
}

// ── Helpers ──────────────────────────────────────────────────
function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function sheetToObjects(sheet) {
  if (!sheet) return [];
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
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
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

function getSettingsMap() {
  const sheet = getSheet(SHEETS.SETTINGS);
  const data = sheetToObjects(sheet);
  const map = {};
  data.forEach(r => { map[r.key] = r.value; });
  return map;
}

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

// ── AUTH ─────────────────────────────────────────────────────
function login(data) {
  const { username, password } = data;
  if (!username || !password) return { success: false, error: 'กรุณากรอก username และ password' };
  const sheet = getSheet(SHEETS.USERS);
  const users = sheetToObjects(sheet);
  const user = users.find(u =>
    String(u.username).trim() === String(username).trim() &&
    String(u.password).trim() === String(password).trim() &&
    (u.is_active === true || String(u.is_active).toUpperCase() === 'TRUE')
  );
  if (!user) return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  return {
    success: true,
    user: { username: user.username, role: user.role, display_name: user.display_name }
  };
}

// ── DASHBOARD ────────────────────────────────────────────────
function getDashboard() {
  const sows = sheetToObjects(getSheet(SHEETS.SOWS))
    .filter(s => s.is_active === true || String(s.is_active).toUpperCase() === 'TRUE');
  const cycles = sheetToObjects(getSheet(SHEETS.CYCLES));
  const settings = getSettingsMap();

  const statusCounts = { OPEN: 0, SERVED: 0, PREGNANT: 0, LACTATING: 0 };
  sows.forEach(s => { if (statusCounts[s.status] !== undefined) statusCounts[s.status]++; });

  const completedCycles = cycles.filter(c => c.cycle_status === 'COMPLETE' && Number(c.weaned_count) > 0);
  const avgLiveBorn = completedCycles.length > 0
    ? completedCycles.reduce((sum, c) => sum + Number(c.live_born || 0), 0) / completedCycles.length : 0;
  const avgWeaned = completedCycles.length > 0
    ? completedCycles.reduce((sum, c) => sum + Number(c.weaned_count || 0), 0) / completedCycles.length : 0;
  const wsiCycles = completedCycles.filter(c => Number(c.wsi_days) > 0);
  const avgWSI = wsiCycles.length > 0
    ? wsiCycles.reduce((sum, c) => sum + Number(c.wsi_days || 0), 0) / wsiCycles.length : 0;

  const littersPerYear = 365 / (
    Number(settings.GESTATION_DAYS || 114) +
    Number(settings.LACTATION_TARGET || 21) +
    Number(settings.WSI_TARGET || 7)
  );
  const psy = avgWeaned * littersPerYear;

  const recentCycles = completedCycles.slice(-12);
  const farrowingRateData = recentCycles.map(c => ({
    label: String(c.cycle_id),
    live_born: Number(c.live_born || 0),
    stillborn: Number(c.stillborn || 0),
    mummy: Number(c.mummy || 0)
  }));

  return {
    success: true,
    statusCounts,
    kpis: {
      total_sows: sows.length,
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
  const upcoming3 = addDays(today, 3);
  const cycles = sheetToObjects(getSheet(SHEETS.CYCLES)).filter(c => c.cycle_status === 'ACTIVE');
  const tasks = [];

  cycles.forEach(c => {
    const sowId = c.sow_id;
    const check1Due = formatDate(c.preg_check1_due);
    const check2Due = formatDate(c.preg_check2_due);
    const moveDue = formatDate(c.move_farrowing_due);
    const expectedFarrow = formatDate(c.expected_farrowing);

    if (!c.preg_check1_date && check1Due && check1Due <= upcoming3) {
      tasks.push({ type: 'PREG_CHECK_1', sow_id: sowId, cycle_id: c.cycle_id,
        due_date: check1Due, priority: check1Due <= today ? 'URGENT' : 'UPCOMING',
        label: 'ตรวจท้องรอบ 1 — ' + sowId });
    }
    if (c.preg_check1_result === 'POSITIVE' && !c.preg_check2_date && check2Due && check2Due <= upcoming3) {
      tasks.push({ type: 'PREG_CHECK_2', sow_id: sowId, cycle_id: c.cycle_id,
        due_date: check2Due, priority: check2Due <= today ? 'URGENT' : 'UPCOMING',
        label: 'ยืนยันการตั้งท้อง — ' + sowId });
    }
    if (!c.move_farrowing_date && moveDue && moveDue <= upcoming3) {
      tasks.push({ type: 'MOVE_FARROWING', sow_id: sowId, cycle_id: c.cycle_id,
        due_date: moveDue, priority: moveDue <= today ? 'URGENT' : 'UPCOMING',
        label: 'ย้ายเข้าเล้าคลอด — ' + sowId });
    }
    if (!c.actual_farrowing_date && expectedFarrow) {
      const daysToFarrow = daysBetween(today, expectedFarrow);
      if (daysToFarrow !== null && daysToFarrow >= 0 && daysToFarrow <= 7) {
        tasks.push({ type: 'NEAR_FARROWING', sow_id: sowId, cycle_id: c.cycle_id,
          due_date: expectedFarrow, priority: daysToFarrow <= 1 ? 'URGENT' : 'UPCOMING',
          label: 'ใกล้ถึงกำหนดคลอด (' + daysToFarrow + ' วัน) — ' + sowId });
      }
    }
  });

  const lactating = sheetToObjects(getSheet(SHEETS.CYCLES))
    .filter(c => c.actual_farrowing_date && !c.weaning_date && c.cycle_status === 'ACTIVE');
  lactating.forEach(c => {
    const lacDays = daysBetween(formatDate(c.actual_farrowing_date), today);
    if (lacDays !== null && lacDays >= 21) {
      tasks.push({ type: 'WEANING_DUE', sow_id: c.sow_id, cycle_id: c.cycle_id,
        due_date: formatDate(c.actual_farrowing_date),
        priority: lacDays >= 24 ? 'URGENT' : 'UPCOMING',
        label: 'ครบกำหนดหย่านม (เลี้ยง ' + lacDays + ' วัน) — ' + c.sow_id });
    }
  });

  tasks.sort((a, b) => (a.priority === 'URGENT' ? 0 : 1) - (b.priority === 'URGENT' ? 0 : 1));
  return { success: true, tasks, today };
}

// ── SOWS ─────────────────────────────────────────────────────
function getSows(data) {
  const sows = sheetToObjects(getSheet(SHEETS.SOWS));
  let filtered = sows.filter(s => s.is_active === true || String(s.is_active).toUpperCase() === 'TRUE');
  if (data && data.status) filtered = filtered.filter(s => s.status === data.status);
  return { success: true, sows: filtered };
}

function getSowDetail(data) {
  const { sow_id } = data;
  const sows = sheetToObjects(getSheet(SHEETS.SOWS));
  const sow = sows.find(s => s.sow_id === sow_id);
  if (!sow) return { success: false, error: 'ไม่พบแม่สุกร: ' + sow_id };

  const cycles = sheetToObjects(getSheet(SHEETS.CYCLES))
    .filter(c => c.sow_id === sow_id)
    .sort((a, b) => Number(b.parity) - Number(a.parity));

  const settings = getSettingsMap();
  const cullWarnings = [];
  if (Number(sow.current_parity) >= Number(settings.CULL_MAX_PARITY || 8)) {
    cullWarnings.push('ท้องที่ ' + sow.current_parity + ' เกินเกณฑ์ (max ' + settings.CULL_MAX_PARITY + ')');
  }
  const recent3 = cycles.slice(0, 3).filter(c => Number(c.live_born) > 0);
  if (recent3.length >= 2) {
    const avgLB = recent3.reduce((s, c) => s + Number(c.live_born), 0) / recent3.length;
    if (avgLB < Number(settings.CULL_MIN_LIVE_BORN || 10)) {
      cullWarnings.push('Live Born เฉลี่ย ' + avgLB.toFixed(1) + ' ตัว (ต่ำกว่าเกณฑ์ ' + settings.CULL_MIN_LIVE_BORN + ')');
    }
  }
  return { success: true, sow, cycles, cullWarnings };
}

function addSow(data) {
  const sheet = getSheet(SHEETS.SOWS);
  const { ear_tag, breed, birth_date, entry_date, source, notes } = data;
  if (!ear_tag) return { success: false, error: 'กรุณากรอกเบอร์หู' };
  const sows = sheetToObjects(sheet);
  const existing = sows.find(s => String(s.ear_tag) === String(ear_tag) &&
    (s.is_active === true || String(s.is_active).toUpperCase() === 'TRUE'));
  if (existing) return { success: false, error: 'เบอร์หู ' + ear_tag + ' มีในระบบแล้ว' };

  const paddedNum = String(sows.length + 1).padStart(3, '0');
  const sow_id = 'S' + paddedNum;
  const now = formatDate(new Date());
  sheet.appendRow([
    sow_id, ear_tag, breed || 'LW×L',
    birth_date || '', entry_date || now, source || '',
    'OPEN', 0, '', notes || '', now, now, true
  ]);
  return { success: true, sow_id, message: 'เพิ่มแม่สุกร เบอร์ ' + ear_tag + ' (' + sow_id + ') สำเร็จ' };
}

function updateSow(data) {
  const sheet = getSheet(SHEETS.SOWS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('sow_id')] === data.sow_id) {
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
    .filter(b => b.is_active === true || String(b.is_active).toUpperCase() === 'TRUE');
  return { success: true, boars };
}

// ── CYCLE RECORDING ──────────────────────────────────────────
function recordService(data) {
  const { sow_id, service_date, boar_id, technician, service_type, notes } = data;
  if (!sow_id || !service_date || !boar_id) return { success: false, error: 'ข้อมูลไม่ครบ' };

  const settings = getSettingsMap();
  const gestDays  = Number(settings.GESTATION_DAYS || 114);
  const check1Days = Number(settings.PREG_CHECK_DAY1 || 21);
  const check2Days = Number(settings.PREG_CHECK_DAY2 || 42);
  const moveFarrowDay = Number(settings.MOVE_FARROWING_DAY || 110);

  const sowSheet = getSheet(SHEETS.SOWS);
  const sowRows = sowSheet.getDataRange().getValues();
  const sowHeaders = sowRows[0];
  let currentParity = 0, sowRowIndex = -1;
  for (let i = 1; i < sowRows.length; i++) {
    if (sowRows[i][sowHeaders.indexOf('sow_id')] === sow_id) {
      currentParity = Number(sowRows[i][sowHeaders.indexOf('current_parity')]) + 1;
      sowRowIndex = i;
      break;
    }
  }
  if (sowRowIndex === -1) return { success: false, error: 'ไม่พบ sow_id: ' + sow_id };

  const cycle_id = sow_id + '-' + currentParity;
  const cycleSheet = getSheet(SHEETS.CYCLES);
  const existing = sheetToObjects(cycleSheet).find(c => c.cycle_id === cycle_id);
  if (existing) return { success: false, error: 'วงจร ' + cycle_id + ' มีอยู่แล้ว' };

  const expected_farrowing = addDays(service_date, gestDays);
  const preg_check1_due    = addDays(service_date, check1Days);
  const preg_check2_due    = addDays(service_date, check2Days);
  const move_farrowing_due = addDays(service_date, moveFarrowDay);
  const now = formatDate(new Date());

  cycleSheet.appendRow([
    cycle_id, sow_id, currentParity,
    service_date, boar_id, technician || '', service_type || 'AI',
    expected_farrowing, preg_check1_due, '', '', preg_check2_due, '', '',
    move_farrowing_due, '', '', '', '', '', '', '', '', 0, 0,
    '', '', '', 0, '', '', 'ACTIVE', notes || '', now
  ]);

  sowRows[sowRowIndex][sowHeaders.indexOf('current_parity')] = currentParity;
  sowRows[sowRowIndex][sowHeaders.indexOf('status')] = 'SERVED';
  sowRows[sowRowIndex][sowHeaders.indexOf('updated_at')] = now;
  sowSheet.getRange(sowRowIndex + 1, 1, 1, sowRows[sowRowIndex].length).setValues([sowRows[sowRowIndex]]);

  return { success: true, cycle_id, expected_farrowing, preg_check1_due, preg_check2_due, move_farrowing_due,
    message: 'บันทึกการผสม ' + sow_id + ' ท้องที่ ' + currentParity + ' สำเร็จ' };
}

function recordPregCheck(data) {
  const { cycle_id, check_round, check_date, result } = data;
  if (!cycle_id || !check_date || !result) return { success: false, error: 'ข้อมูลไม่ครบ' };
  const cycleSheet = getSheet(SHEETS.CYCLES);
  const rows = cycleSheet.getDataRange().getValues();
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('cycle_id')] === cycle_id) {
      const round = String(check_round);
      if (round === '1') {
        rows[i][headers.indexOf('preg_check1_date')] = check_date;
        rows[i][headers.indexOf('preg_check1_result')] = result;
      } else {
        rows[i][headers.indexOf('preg_check2_date')] = check_date;
        rows[i][headers.indexOf('preg_check2_result')] = result;
      }
      if (result === 'NEGATIVE') {
        rows[i][headers.indexOf('cycle_status')] = 'CULLED';
        updateSowStatus(rows[i][headers.indexOf('sow_id')], 'OPEN');
      } else if (result === 'CONFIRMED') {
        updateSowStatus(rows[i][headers.indexOf('sow_id')], 'PREGNANT');
      }
      cycleSheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);
      return { success: true, message: 'บันทึกผลตรวจท้องรอบ ' + check_round + ' สำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบ cycle_id: ' + cycle_id };
}

function recordFarrowing(data) {
  const { cycle_id, farrowing_date, live_born, stillborn, mummy, birth_weight_total, notes } = data;
  if (!cycle_id || !farrowing_date || live_born === undefined) return { success: false, error: 'ข้อมูลไม่ครบ' };
  const cycleSheet = getSheet(SHEETS.CYCLES);
  const rows = cycleSheet.getDataRange().getValues();
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('cycle_id')] === cycle_id) {
      const serviceDate = formatDate(rows[i][headers.indexOf('service_date')]);
      const gestLen = daysBetween(serviceDate, farrowing_date);
      const lb = Number(live_born) || 0;
      const sb = Number(stillborn) || 0;
      const mm = Number(mummy) || 0;
      rows[i][headers.indexOf('actual_farrowing_date')] = farrowing_date;
      rows[i][headers.indexOf('gestation_length')] = gestLen;
      rows[i][headers.indexOf('total_born')] = lb + sb + mm;
      rows[i][headers.indexOf('live_born')] = lb;
      rows[i][headers.indexOf('stillborn')] = sb;
      rows[i][headers.indexOf('mummy')] = mm;
      rows[i][headers.indexOf('birth_weight_total')] = Number(birth_weight_total) || 0;
      if (notes) rows[i][headers.indexOf('notes')] = notes;
      cycleSheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);
      updateSowStatus(rows[i][headers.indexOf('sow_id')], 'LACTATING');
      return { success: true, gestation_length: gestLen, total_born: lb + sb + mm,
        message: 'บันทึกการคลอด ' + cycle_id + ' สำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบ cycle_id: ' + cycle_id };
}

function recordWeaning(data) {
  const { cycle_id, weaning_date, weaned_count, weaning_weight_total } = data;
  if (!cycle_id || !weaning_date || weaned_count === undefined) return { success: false, error: 'ข้อมูลไม่ครบ' };
  const cycleSheet = getSheet(SHEETS.CYCLES);
  const rows = cycleSheet.getDataRange().getValues();
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('cycle_id')] === cycle_id) {
      const farrowDate = formatDate(rows[i][headers.indexOf('actual_farrowing_date')]);
      const lacDays = daysBetween(farrowDate, weaning_date);
      rows[i][headers.indexOf('weaning_date')] = weaning_date;
      rows[i][headers.indexOf('weaned_count')] = Number(weaned_count) || 0;
      rows[i][headers.indexOf('weaning_weight_total')] = Number(weaning_weight_total) || 0;
      rows[i][headers.indexOf('lactation_days')] = lacDays;
      rows[i][headers.indexOf('cycle_status')] = 'COMPLETE';
      cycleSheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);
      updateSowStatus(rows[i][headers.indexOf('sow_id')], 'OPEN');
      return { success: true, lactation_days: lacDays,
        message: 'บันทึกการหย่านม ' + cycle_id + ' สำเร็จ — เลี้ยงลูก ' + lacDays + ' วัน' };
    }
  }
  return { success: false, error: 'ไม่พบ cycle_id: ' + cycle_id };
}

function getCycles(data) {
  const cycles = sheetToObjects(getSheet(SHEETS.CYCLES));
  if (data && data.sow_id) return { success: true, cycles: cycles.filter(c => c.sow_id === data.sow_id) };
  if (data && data.status) return { success: true, cycles: cycles.filter(c => c.cycle_status === data.status) };
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
        sheet.getRange(i + 1, valIdx + 1).setValue(data.settings[key]);
        found = true; break;
      }
    }
    if (!found) sheet.appendRow([key, data.settings[key], '']);
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
    if (!technicianStats[c.technician]) technicianStats[c.technician] = { services: 0, farrowings: 0, total_live_born: 0 };
    technicianStats[c.technician].services++;
    if (c.actual_farrowing_date) {
      technicianStats[c.technician].farrowings++;
      technicianStats[c.technician].total_live_born += Number(c.live_born || 0);
    }
  });

  const settings = getSettingsMap();
  const pendingCull = sheetToObjects(getSheet(SHEETS.SOWS)).filter(s =>
    (s.is_active === true || String(s.is_active).toUpperCase() === 'TRUE') &&
    Number(s.current_parity) >= Number(settings.CULL_MAX_PARITY || 8)
  );

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
      cycle_id: c.cycle_id, sow_id: c.sow_id, parity: c.parity,
      live_born: c.live_born, weaned_count: c.weaned_count,
      lactation_days: c.lactation_days, wsi_days: c.wsi_days,
      weaning_date: formatDate(c.weaning_date)
    }))
  };
}

// ── CULL ─────────────────────────────────────────────────────
function cullSow(data) {
  const { sow_id, reason, recorded_by } = data;
  if (!sow_id) return { success: false, error: 'ไม่พบ sow_id' };
  const sheet = getSheet(SHEETS.SOWS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf('sow_id')] === sow_id) {
      rows[i][headers.indexOf('status')] = 'CULLED';
      rows[i][headers.indexOf('is_active')] = false;
      rows[i][headers.indexOf('notes')] = 'CULLED: ' + reason + ' (' + formatDate(new Date()) + ')';
      rows[i][headers.indexOf('updated_at')] = formatDate(new Date());
      sheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);
      try {
        getSheet(SHEETS.EVENTS).appendRow([
          'EVT-CULL-' + sow_id + '-' + Date.now(), sow_id,
          formatDate(new Date()), 'CULL', reason, recorded_by || 'system', ''
        ]);
      } catch(e) {}
      return { success: true, message: 'คัดทิ้ง ' + sow_id + ' สำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบ sow_id: ' + sow_id };
}

// ════════════════════════════════════════════════════════════════
// initSheets() — รันครั้งเดียวเพื่อสร้างฐานข้อมูล
// วิธีใช้: เลือก initSheets แล้วกด ▶ Run
// ════════════════════════════════════════════════════════════════
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = formatDate(new Date());

  function createOrClear(name) {
    let sheet = ss.getSheetByName(name);
    if (sheet) { sheet.clearContents(); } else { sheet = ss.insertSheet(name); }
    return sheet;
  }

  // SETTINGS
  const s1 = createOrClear('SETTINGS');
  s1.getRange(1,1,1,3).setValues([['key','value','label']]);
  s1.getRange(2,1,12,3).setValues([
    ['FARM_NAME','นิพนธ์ฟาร์ม','ชื่อฟาร์ม'],
    ['GESTATION_DAYS','114','วันอุ้มท้อง'],
    ['LACTATION_TARGET','21','เป้าหมายวันเลี้ยงลูก'],
    ['WSI_TARGET','7','เป้าหมาย WSI'],
    ['PREG_CHECK_DAY1','21','ตรวจท้องรอบ 1'],
    ['PREG_CHECK_DAY2','42','ตรวจท้องรอบ 2'],
    ['MOVE_FARROWING_DAY','110','ย้ายเข้าเล้าคลอด'],
    ['CULL_MAX_PARITY','8','คัดทิ้งเมื่อท้องที่ >='],
    ['CULL_MIN_LIVE_BORN','10','คัดทิ้งเมื่อ Live Born <'],
    ['CULL_MAX_RETURNS','3','กลับสัดเกิน N ครั้ง'],
    ['PSY_TARGET','28','เป้าหมาย PSY'],
    ['LINE_TOKEN','','LINE Notify Token'],
  ]);
  s1.getRange('A1:C1').setFontWeight('bold').setBackground('#d9ead3');

  // USERS
  const s2 = createOrClear('USERS');
  s2.getRange(1,1,1,5).setValues([['username','password','role','display_name','is_active']]);
  s2.getRange(2,1,3,5).setValues([
    ['aod','aod1234','ADMIN','คุณนิพนธ์ (เจ้าของ)',true],
    ['staff1','staff1234','STAFF','สมชาย (คนงาน)',true],
    ['staff2','staff1234','STAFF','สมหญิง (คนงาน)',true],
  ]);
  s2.getRange('A1:E1').setFontWeight('bold').setBackground('#fce5cd');

  // BOARS
  const s3 = createOrClear('BOARS');
  s3.getRange(1,1,1,6).setValues([['boar_id','ear_tag','breed','birth_date','entry_date','is_active']]);
  s3.getRange(2,1,3,6).setValues([
    ['B001','P001','Duroc','2021-01-15','2022-03-01',true],
    ['B002','P002','Duroc','2021-06-20','2022-08-01',true],
    ['B003','P003','Hampshire','2022-02-10','2023-01-01',true],
  ]);
  s3.getRange('A1:F1').setFontWeight('bold').setBackground('#d9ead3');

  // SOWS
  const s4 = createOrClear('SOWS');
  const sowH = ['sow_id','ear_tag','breed','birth_date','entry_date','source','status','current_parity','location','notes','created_at','updated_at','is_active'];
  s4.getRange(1,1,1,sowH.length).setValues([sowH]);
  s4.getRange(2,1,10,sowH.length).setValues([
    ['S001','001','LW×L','2021-03-10','2022-09-01','ฟาร์มA','PREGNANT',4,'G-A01','',today,today,true],
    ['S002','002','LW×L','2021-05-20','2022-11-01','ฟาร์มA','LACTATING',2,'F-B03','',today,today,true],
    ['S003','003','LW×L','2022-01-15','2023-07-01','ฟาร์มA','OPEN',1,'G-A05','',today,today,true],
    ['S004','004','LW×L','2020-08-05','2022-01-01','ฟาร์มB','SERVED',6,'G-B12','',today,today,true],
    ['S005','005','LW×L','2021-11-12','2023-05-01','ฟาร์มA','PREGNANT',3,'G-A08','',today,today,true],
    ['S006','006','LW×L','2022-04-20','2023-10-01','ฟาร์มB','OPEN',0,'G-C02','สุกรสาวรอผสม',today,today,true],
    ['S007','007','LW×L','2020-06-01','2021-12-01','ฟาร์มA','LACTATING',7,'F-B08','ใกล้เกณฑ์คัดทิ้ง',today,today,true],
    ['S008','008','LW×L','2021-09-15','2023-03-01','ฟาร์มB','OPEN',2,'G-D04','',today,today,true],
    ['S009','009','LW×L','2022-02-28','2023-08-01','ฟาร์มA','SERVED',1,'G-A10','',today,today,true],
    ['S010','010','LW×L','2019-11-01','2021-05-01','ฟาร์มA','OPEN',9,'G-E01','ควรคัดทิ้ง',today,today,true],
  ]);
  s4.getRange('A1:M1').setFontWeight('bold').setBackground('#cfe2f3');

  // CYCLES
  const s5 = createOrClear('CYCLES');
  const cycH = ['cycle_id','sow_id','parity','service_date','boar_id','technician','service_type',
    'expected_farrowing','preg_check1_due','preg_check1_date','preg_check1_result',
    'preg_check2_due','preg_check2_date','preg_check2_result',
    'move_farrowing_due','move_farrowing_date',
    'actual_farrowing_date','gestation_length',
    'total_born','live_born','stillborn','mummy','birth_weight_total',
    'fostered_in','fostered_out',
    'weaning_date','weaned_count','weaning_weight_total','lactation_days',
    'wsi_date','wsi_days','cycle_status','notes','created_at'];
  s5.getRange(1,1,1,cycH.length).setValues([cycH]);
  s5.getRange(2,1,5,cycH.length).setValues([
    ['S001-4','S001',4,'2024-03-01','B001','สมชาย','AI','2024-06-23','2024-03-22','2024-03-21','POSITIVE','2024-04-12','2024-04-11','CONFIRMED','2024-06-19','2024-06-18','','','','','','','',0,0,'','','','','','','ACTIVE','',today],
    ['S002-2','S002',2,'2024-01-05','B002','สมหญิง','AI','2024-04-29','2024-01-26','2024-01-25','POSITIVE','2024-02-16','2024-02-15','CONFIRMED','2024-04-25','2024-04-24','2024-04-28',113,13,12,1,0,16.2,0,0,'','','','','','','ACTIVE','คลอดปกติ',today],
    ['S001-3','S001',3,'2023-09-01','B001','สมชาย','AI','2023-12-24','2023-09-22','2023-09-21','POSITIVE','2023-10-13','2023-10-12','CONFIRMED','2023-12-20','2023-12-19','2023-12-22',112,14,13,1,0,17.5,0,0,'2024-01-13',12,84,22,'2024-01-18',5,'COMPLETE','',today],
    ['S007-7','S007',7,'2024-02-01','B001','สมชาย','AI','2024-05-26','2024-02-22','2024-02-21','POSITIVE','2024-03-14','2024-03-13','CONFIRMED','2024-05-22','2024-05-20','2024-05-24',113,11,9,2,0,11.3,0,0,'2024-06-14',8,48,21,'2024-06-19',5,'COMPLETE','',today],
    ['S010-9','S010',9,'2023-12-01','B002','สมหญิง','AI','2024-03-25','2023-12-22','2023-12-21','POSITIVE','2024-01-12','2024-01-11','CONFIRMED','2024-03-21','2024-03-20','2024-03-22',112,10,8,2,0,10.1,0,0,'2024-04-12',7,42,21,'2024-04-17',5,'COMPLETE','ผลผลิตต่ำ',today],
  ]);
  s5.getRange('A1:AH1').setFontWeight('bold').setBackground('#fff2cc');

  // EVENTS
  const s6 = createOrClear('EVENTS');
  s6.getRange(1,1,1,7).setValues([['event_id','sow_id','event_date','event_type','details','recorded_by','notes']]);
  s6.getRange('A1:G1').setFontWeight('bold').setBackground('#ead1dc');

  // ลบ Sheet default
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('แผ่น1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  [s1,s2,s3,s4,s5,s6].forEach(s => { try { s.autoResizeColumns(1, s.getLastColumn()); } catch(e){} });

  SpreadsheetApp.getUi().alert(
    '✅ initSheets สำเร็จ!',
    'สร้างฐานข้อมูลเรียบร้อย\n\n' +
    '👤 Login:\n   Admin: aod / aod1234\n   Staff: staff1 / staff1234\n\n' +
    '📌 ขั้นตอนถัดไป:\nDeploy > New deployment > Web App\nExecute as: Me | Access: Anyone',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
