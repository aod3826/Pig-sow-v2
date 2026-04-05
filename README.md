🐷
นิพนธ์ฟาร์ม
Smart Sow Productivity System
v2.0 — Technical Documentation for Developers


Stack
Google Apps Script + Google Sheets + GitHub Pages
ภาษา
JavaScript (GAS), HTML, CSS
สถานะ
Production-ready v2.0



1. ภาพรวมระบบ (System Overview)


▌ 1.1 สถาปัตยกรรม (Architecture)
ระบบทำงานแบบ Serverless ทั้งหมด ไม่มี hosting ค่าใช้จ่ายเป็นศูนย์ ประกอบด้วย 3 ชั้น:

ชั้น
เทคโนโลยี
หน้าที่
Frontend
index.html (HTML/CSS/JS)
UI บนมือถือและคอมพิวเตอร์ — ไม่มี framework ใช้ Vanilla JS
Backend
Google Apps Script (code.gs)
API endpoint รับ GET request, ประมวลผล, ตอบกลับ JSON
Database
Google Sheets (6 Sheets)
เก็บข้อมูลทั้งหมด: แม่สุกร, วงจร, ผู้ใช้, ตั้งค่า


⚠️ จุดสำคัญ: วิธีเชื่อมต่อ (แก้ปัญหา CORS)
ระบบใช้ GET request + URL parameter แทน POST เพื่อหลีกเลี่ยงปัญหา CORS preflight ของ browser
URL pattern: API_URL?action=ACTION_NAME&payload=JSON_ENCODED_DATA
Google Apps Script ตอบกลับเป็น JSON เสมอ ทั้ง GET และ POST ใช้ doGet() เป็นหลัก


▌ 1.2 Data Flow
มือถือ/Browser → fetch(GET) → Google Apps Script → Google Sheets
                 ← JSON response ←                ← อ่าน/เขียน ←



2. โครงสร้างไฟล์และ Google Sheets


▌ 2.1 ไฟล์ในโปรเจกต์
ไฟล์
คำอธิบาย
code.gs
Google Apps Script Backend ทั้งหมด ติดตั้งใน Google Sheets
index.html
Frontend ไฟล์เดียว ครบทุก UI รวม CSS และ JS ไว้ใน file เดียว


▌ 2.2 โครงสร้าง Google Sheets (6 Sheets)
SETTINGS — การตั้งค่าฟาร์ม
key
ตัวอย่างค่า
ความหมาย
GESTATION_DAYS
114
จำนวนวันอุ้มท้องมาตรฐาน
LACTATION_TARGET
21
เป้าหมายวันเลี้ยงลูก
WSI_TARGET
7
เป้าหมาย Wean to Service Interval (วัน)
PREG_CHECK_DAY1
21
ตรวจท้องรอบ 1 (วันที่นับจากผสม)
PREG_CHECK_DAY2
42
ตรวจท้องรอบ 2 (วันที่นับจากผสม)
MOVE_FARROWING_DAY
110
ย้ายเข้าเล้าคลอด (วันที่นับจากผสม)
CULL_MAX_PARITY
8
คัดทิ้งเมื่อท้องที่ ≥ ค่านี้
CULL_MIN_LIVE_BORN
10
คัดทิ้งเมื่อ Live Born เฉลี่ย < ค่านี้
PSY_TARGET
28
เป้าหมาย Pigs Sold per Sow per Year


USERS — ผู้ใช้งาน
username
password
role
display_name
is_active
aod
aod1234
ADMIN
คุณนิพนธ์ (เจ้าของ)
TRUE
staff1
staff1234
STAFF
สมชาย (คนงาน)
TRUE
staff2
staff1234
STAFF
สมหญิง (คนงาน)
TRUE

⚠️ Password เก็บเป็น plain text (v1) — ควรเปลี่ยนเป็น hash ในอนาคต

SOWS — ทะเบียนแม่สุกร
Column
Type
คำอธิบาย
sow_id
String
รหัสแม่สุกร เช่น S001, S002 (Auto-generated)
ear_tag
String
เบอร์หูจริง (user กรอก)
breed
String
สายพันธุ์ เช่น LW×L
birth_date
Date (yyyy-MM-dd)
วันเกิด
entry_date
Date (yyyy-MM-dd)
วันที่เข้าฟาร์ม
status
Enum
OPEN | SERVED | PREGNANT | LACTATING | CULLED
current_parity
Number
ท้องปัจจุบัน (เพิ่มขึ้นอัตโนมัติตอน recordService)
location
String
ตำแหน่งคอก เช่น G-A01
is_active
Boolean
TRUE = ยังอยู่ฟาร์ม | FALSE = คัดทิ้งแล้ว


CYCLES — วงจรการผลิต (ตารางหลัก)
cycle_id สร้างจาก sow_id + parity เช่น S001-4 หมายถึง แม่สุกร S001 ท้องที่ 4
Column
Type
คำอธิบาย
cycle_id
String
sow_id + "-" + parity เช่น S001-4
sow_id
String
FK → SOWS.sow_id
parity
Number
ลำดับท้อง
service_date
Date
วันที่ผสมพันธุ์
boar_id
String
FK → BOARS.boar_id
technician
String
ชื่อผู้ผสม
expected_farrowing
Date
กำหนดคลอด = service_date + GESTATION_DAYS
preg_check1_due / _date / _result
Date/String
วันกำหนด / วันตรวจจริง / ผล (POSITIVE|NEGATIVE)
preg_check2_due / _date / _result
Date/String
ยืนยันท้อง (POSITIVE|NEGATIVE|CONFIRMED)
actual_farrowing_date
Date
วันคลอดจริง
live_born / stillborn / mummy
Number
จำนวนลูกมีชีวิต / ตายโคม / มัมมี่
weaning_date / weaned_count
Date/Number
วันหย่านม / จำนวนลูกหย่านม
lactation_days
Number
จำนวนวันเลี้ยงลูก (คำนวณอัตโนมัติ)
wsi_days
Number
Wean-to-Service Interval (คำนวณอัตโนมัติ)
cycle_status
Enum
ACTIVE | COMPLETE | CULLED



3. API Reference (Google Apps Script)


▌ 3.1 วิธีเรียก API
ทุก request ใช้ GET method เพื่อหลีกเลี่ยง CORS:
GET https://script.google.com/.../exec?action=ACTION&payload=JSON_STRING
ตัวอย่าง JavaScript ใน Frontend:
const url = API + '?action=' + encodeURIComponent(action)
           + '&payload=' + encodeURIComponent(JSON.stringify(data));
const res = await fetch(url, { method:'GET', redirect:'follow' });
return JSON.parse(await res.text());

▌ 3.2 รายการ Actions ทั้งหมด
Action
Payload (JSON)
Response สำคัญ
ping
{}
{ success, time } — ทดสอบการเชื่อมต่อ
login
{ username, password }
{ success, user:{username,role,display_name} }
getDashboard
{}
{ statusCounts, kpis, chartData }
getTasksToday
{}
{ tasks:[{type,sow_id,cycle_id,due_date,priority,label}] }
getSows
{ status? }
{ sows:[...] } — filter ด้วย status ได้
getSowDetail
{ sow_id }
{ sow, cycles, cullWarnings }
addSow
{ ear_tag, breed?, birth_date?, entry_date?, source? }
{ sow_id, message }
getBoars
{}
{ boars:[{boar_id,ear_tag,breed}] }
recordService
{ sow_id, service_date, boar_id, technician?, service_type?, notes? }
{ cycle_id, expected_farrowing, preg_check1_due, ... }
recordPregCheck
{ cycle_id, check_round, check_date, result }
{ message } — result: POSITIVE|NEGATIVE|CONFIRMED
recordFarrowing
{ cycle_id, farrowing_date, live_born, stillborn?, mummy?, birth_weight_total?, notes? }
{ gestation_length, total_born, message }
recordWeaning
{ cycle_id, weaning_date, weaned_count, weaning_weight_total? }
{ lactation_days, message }
getReports
{ month? }
{ summary, technicianStats, pendingCull, recentCycles }
getSettings
{}
{ settings:[{key,value,label}] }
updateSettings
{ settings:{key:value,...} }
{ message }
cullSow
{ sow_id, reason, recorded_by? }
{ message }


▌ 3.3 Response Format มาตรฐาน
// สำเร็จ
{ "success": true, "data": ..., "message": "..." }


// ล้มเหลว
{ "success": false, "error": "รายละเอียดข้อผิดพลาด" }


4. Frontend Architecture (index.html)


▌ 4.1 โครงสร้าง HTML
ไฟล์เดียวประกอบด้วย:
screen-login: หน้าเลือกผู้ใช้ + แสดงสถานะการเชื่อมต่อ
screen-app: แอปหลัก มี 5 หน้า (pages) และ Bottom Navigation
page-dashboard: KPI, งานวันนี้, กราฟ Live Born
page-sows: ทะเบียนแม่สุกร + ค้นหา + filter
page-sow-detail: ประวัติแม่สุกรรายตัว
page-record: ฟอร์มบันทึก 4 แบบ (ผสม/ตรวจท้อง/คลอด/หย่านม)
page-reports: รายงานสรุปรายเดือน
page-settings: ตั้งค่าฟาร์ม

▌ 4.2 State Management
ใช้ Global Object ชื่อ ST (State) เก็บข้อมูลในหน่วยความจำ:
const ST = {
  user: null,           // ข้อมูล user ที่ login อยู่
  sows: [],             // รายชื่อแม่สุกรทั้งหมด (cache)
  boars: [],            // รายชื่อพ่อพันธุ์ (cache)
  settings: {},         // การตั้งค่าฟาร์ม (key:value)
  filterStatus: "ALL",  // filter ปัจจุบันในหน้า Sows
  cullSowId: null,      // sow_id ที่รอคัดทิ้ง
};
⚠️ ไม่มี persistence — refresh หน้าต้อง login ใหม่ ข้อมูลจริงอยู่ใน Google Sheets เสมอ

▌ 4.3 CSS Variables ที่ใช้ทั่วทั้งแอป
Variable
ค่า (Hex)
ใช้สำหรับ
--g7 (green-700)
#3B6D11
Primary — ปุ่มหลัก, หัวข้อ, status bar
--g0 (green-50)
#EAF3DE
Background สีเขียวอ่อน
--a6 (amber-600)
#854F0B
Warning — WSI, การเตือน
--r6 (red-600)
#A32D2D
Danger — urgent tasks, cull
--t6 (teal-600)
#0F6E56
Accent — PSY, เลี้ยงลูก
--bg
#F0EDE4
Background หลักของหน้า
--card
#FFFFFF
พื้นหลัง Card
--text
#1C1B18
สีตัวอักษรหลัก
--muted
#5F5E5A
สีตัวอักษรรอง
--border
#D8D5CC
สีขอบ input, card



5. Business Logic สำคัญ


▌ 5.1 วงจรชีวิตแม่สุกร (Sow Status Flow)
จาก → ไป
Action
ฟังก์ชันที่เรียก
OPEN → SERVED
ผสม
recordService() → sow.status = SERVED, parity++
SERVED → PREGNANT
ตรวจท้อง
recordPregCheck(result=CONFIRMED) → sow.status = PREGNANT
SERVED → OPEN
ไม่ท้อง
recordPregCheck(result=NEGATIVE) → sow.status = OPEN, cycle.status = CULLED
PREGNANT → LACTATING
คลอด
recordFarrowing() → sow.status = LACTATING
LACTATING → OPEN
หย่านม
recordWeaning() → sow.status = OPEN, cycle.status = COMPLETE


▌ 5.2 การคำนวณวันสำคัญ (recordService)
เมื่อบันทึกการผสม ระบบคำนวณวันอัตโนมัติทั้งหมด:
expected_farrowing  = service_date + GESTATION_DAYS   (default: 114)
preg_check1_due     = service_date + PREG_CHECK_DAY1  (default: 21)
preg_check2_due     = service_date + PREG_CHECK_DAY2  (default: 42)
move_farrowing_due  = service_date + MOVE_FARROWING_DAY (default: 110)

▌ 5.3 การคำนวณ KPI
PSY = avg_weaned × (365 / (GESTATION_DAYS + LACTATION_TARGET + WSI_TARGET))
WSI = วันผสมครั้งถัดไป − วันหย่านม
lactation_days = weaning_date − actual_farrowing_date
gestation_length = actual_farrowing_date − service_date

▌ 5.4 เกณฑ์แนะนำคัดทิ้ง (cullWarnings)
current_parity ≥ CULL_MAX_PARITY (default: 8)
Live Born เฉลี่ย 3 ท้องล่าสุด < CULL_MIN_LIVE_BORN (default: 10)
การเตือนเหล่านี้แสดงในหน้าประวัติแม่สุกรเท่านั้น ไม่ได้คัดทิ้งอัตโนมัติ

▌ 5.5 Tasks Today — ระบบแจ้งเตือน (getTasksToday)
Task Type
เงื่อนไข
Priority
PREG_CHECK_1
ยังไม่ตรวจ + due ≤ 3 วัน
URGENT ถ้า due ≤ วันนี้
PREG_CHECK_2
check1=POSITIVE + ยังไม่ตรวจ + due ≤ 3 วัน
URGENT ถ้า due ≤ วันนี้
MOVE_FARROWING
ยังไม่ย้าย + due ≤ 3 วัน
URGENT ถ้า due ≤ วันนี้
NEAR_FARROWING
ยังไม่คลอด + คลอดใน ≤ 7 วัน
URGENT ถ้า ≤ 1 วัน
WEANING_DUE
เลี้ยงลูก ≥ 21 วัน
URGENT ถ้า ≥ 24 วัน



6. การ Deploy และติดตั้ง


▌ 6.1 ขั้นตอนติดตั้งครั้งแรก
#
ขั้นตอน
รายละเอียด
1
สร้าง Google Sheets
sheets.google.com → Blank → ตั้งชื่อ "นิพนธ์ฟาร์ม DB"
2
เพิ่ม Apps Script
Extensions → Apps Script → วาง code.gs → Ctrl+S
3
รัน initSheets()
เลือก initSheets → ▶ Run → Allow permission → รอ popup สำเร็จ
4
Deploy Web App
Deploy → New deployment → Web App → Execute as: Me → Access: Anyone → Copy URL
5
ใส่ URL ใน index.html
หาบรรทัด const API = "..." → แทน URL จากขั้นที่ 4
6
อัปโหลด index.html
GitHub Pages → upload index.html → Commit
7
ทดสอบ
เปิด GitHub Pages URL → รอ banner "✅ เชื่อมต่อสำเร็จ"


▌ 6.2 การอัปเดตโค้ดหลัง Deploy
⚠️ กฎสำคัญ: ทุกครั้งที่แก้ code.gs ต้อง Deploy ใหม่เสมอ
Deploy → Manage deployments → ✏️ Edit → Version: "New version" → Deploy
URL ยังคงเดิม ไม่ต้องแก้ไข index.html
ถ้าแก้แค่ index.html — upload ขึ้น GitHub ได้เลย ไม่ต้อง Deploy



7. แนวทางพัฒนาต่อ (Development Roadmap)


▌ 7.1 สิ่งที่ควรพัฒนาต่อ (แนะนำ)
🔐 ความปลอดภัย
เปลี่ยน password จาก plain text เป็น hash (SHA-256)
เพิ่ม session token แทนการ login ซ้ำทุกครั้ง
จำกัดสิทธิ์ STAFF ไม่ให้เข้า Settings และ Reports บางส่วน

📱 UX บนมือถือ
เพิ่ม PWA (Progressive Web App) — manifest.json + Service Worker
ให้ทำงาน offline ได้บางส่วน
ติดตั้งเป็น App จริงบนมือถือโดยไม่ต้อง App Store
เพิ่ม barcode/QR scanner สำหรับสแกนเบอร์หู
Swipe gesture สำหรับเปลี่ยนหน้า

📊 รายงานและวิเคราะห์
Export PDF และ Excel
กราฟเพิ่มเติม: trend PSY รายเดือน, Farrowing Rate, WSI trend
เปรียบเทียบ KPI กับค่ามาตรฐานอุตสาหกรรม
แจ้งเตือนผ่าน LINE Notify (field LINE_TOKEN ใน SETTINGS พร้อมแล้ว)

🗃️ ฐานข้อมูล
เพิ่มตาราง TREATMENTS — บันทึกการรักษา/วัคซีน
เพิ่มตาราง FEED — บันทึกอาหารและต้นทุน
เพิ่ม wsi_days calculation อัตโนมัติเมื่อบันทึกการผสมหลังหย่านม
Backup อัตโนมัติด้วย Google Apps Script trigger

▌ 7.2 สิ่งที่ห้ามเปลี่ยน (Breaking Changes)
🚫 อย่าเปลี่ยนสิ่งเหล่านี้โดยไม่ทดสอบให้ครบ
• ชื่อ Column ใน Google Sheets — ถ้าเปลี่ยนต้องแก้ code.gs ทุกจุดที่อ้างถึง
• รูปแบบ cycle_id (sow_id-parity) — ใช้เป็น FK ทั่วทั้งระบบ
• API URL ใน index.html — ถ้า Deploy ใหม่แบบ New Deployment จะได้ URL ใหม่
• วิธีเรียก API (GET + payload param) — แก้พร้อมกันทั้ง frontend และ backend
• ชื่อ action ใน switch-case ของ handleRequest() — frontend ต้องตรงกันเสมอ



8. การแก้ไขปัญหาที่พบบ่อย


อาการ
สาเหตุ
วิธีแก้
❌ เชื่อมต่อไม่ได้ / Failed to fetch
URL ผิด หรือยังไม่ Deploy
ตรวจ URL ใน index.html + Deploy ใหม่แบบ New version
Login สำเร็จ แต่ข้อมูลว่าง
initSheets ยังไม่ได้รัน
รัน initSheets() ใน Apps Script
บันทึกข้อมูลได้ แต่ไม่อัปเดตใน Sheet
Deploy ยังเป็น version เก่า
Deploy → New version → Deploy
Column ไม่ครบ / Index ผิด
แก้ initSheets แต่ยังไม่ได้รัน
รัน initSheets() ใหม่ (ข้อมูลเดิมจะหาย)
หน้าขาวใน GitHub Pages
JS error ใน index.html
กด F12 → Console ดู error
Login ไม่ผ่าน
username/password ไม่ตรง หรือ is_active=FALSE
ตรวจ Sheet USERS



9. ข้อมูลโปรเจกต์


รายการ
รายละเอียด
ชื่อโปรเจกต์
นิพนธ์ฟาร์ม — Smart Sow Productivity System
Version
v2.0 (CORS-fixed, GET-based API)
Google Sheets ID
(ดูจาก URL ของ Google Sheets ที่ใช้งาน)
Apps Script Web App URL
https://script.google.com/macros/s/AKfycbxojGj0LzZFLFFnUAO0A2wHYjaM1GewPPWhwKJ2eutwm3G4pM0tJwlMI8fk0-jJKgmrpQ/exec
Frontend URL (GitHub Pages)
(ใส่ลิงก์ GitHub Pages ของคุณ)
ค่าใช้จ่าย
ฟรี 100% — Google Sheets + Google Apps Script + GitHub Pages




เอกสารนี้สร้างอัตโนมัติ — อัปเดตล่าสุด: 5 เมษายน 2569

```
admin | (hash ของ admin1234) | ADMIN | คุณนิพนธ์ | TRUE
staff1 | (hash ของ staff1234) | STAFF | สมชาย | TRUE
```

---

## Sheet 7: DAILY_TASKS_LOG (บันทึกการทำงานรายวัน — auto generated)
ระบบจะ query จาก CYCLES แบบ dynamic ไม่ต้องกรอกเอง

---

