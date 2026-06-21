# 🐷 นิพนธ์ฟาร์ม PWA Implementation Guide

**Smart Sow Productivity System**  
Version: 2.1 with PWA Support

---

## 📦 PWA Setup Complete!

ระบบได้ถูกอัปเกรดให้เป็น **Progressive Web App (PWA)** แล้ว ซึ่งหมายถึง:

✅ **ติดตั้งเป็น App บนมือถือ** — ไม่ต้องผ่าน App Store  
✅ **ทำงาน Offline** — บางฟีเจอร์ยังทำงานได้เมื่อไม่มีอินเทอร์เน็ต  
✅ **Push Notifications** — ได้ (เตรียมพร้อมสำหรับอนาคต)  
✅ **ไอคอน Custom** — แสดงเหมือน App จริง  
✅ **บันทึกข้อมูลด่วน** — shortcuts บน Home Screen

---

## 📂 Files Generated

ไฟล์ที่ได้รับ:

```
/outputs/
├── icon-192x192.png           ← ไอคอน 192×192
├── icon-192x192-maskable.png  ← Maskable icon (Android)
├── icon-512x512.png           ← ไอคอน 512×512
├── icon-512x512-maskable.png  ← Maskable icon (Android)
├── manifest.json              ← PWA manifest
├── sw.js                       ← Service Worker
├── index-with-pwa.html        ← Updated HTML (with PWA support)
└── PWA_SETUP_GUIDE.md         ← This file
```

---

## 🚀 Installation Steps

### Step 1: Replace Your Files

```bash
# 1. Replace your index.html with index-with-pwa.html
cp index-with-pwa.html index.html

# 2. Copy all icon files to your project root
cp icon-*.png /your-github-pages-root/

# 3. Copy manifest.json to your project root
cp manifest.json /your-github-pages-root/

# 4. Copy service worker to your project root
cp sw.js /your-github-pages-root/
```

**Expected structure:**
```
your-github-pages-repo/
├── index.html
├── farm.css
├── sw.js                    ← NEW
├── manifest.json            ← NEW
├── icon-192x192.png         ← NEW
├── icon-192x192-maskable.png ← NEW
├── icon-512x512.png         ← NEW
├── icon-512x512-maskable.png ← NEW
└── README.md
```

### Step 2: Update Your Original index.html

ถ้าคุณต้องการเก็บการแก้ไขในไฟล์ index.html ของคุณเอง ให้เพิ่มบรรทัดเหล่านี้:

**ใน `<head>` section:**

```html
<!-- PWA Metadata -->
<meta name="theme-color" content="#28A444">
<meta name="description" content="นิพนธ์ฟาร์ม - Smart Sow Productivity System for pig farm management">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="นิพนธ์ฟาร์ม">
<link rel="apple-touch-icon" href="icon-192x192.png">
<link rel="manifest" href="manifest.json">

<!-- Viewport fix for PWA -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

**ใน `<body>` ตอนท้าย (ก่อน closing `</body>`):**

```html
<!-- PWA Install Banner HTML -->
<style>
  .install-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #28A444;
    color: white;
    padding: 1rem;
    display: none;
    flex-direction: column;
    gap: 0.75rem;
    z-index: 1000;
    border-top: 3px solid #8ED420;
    animation: slideUp 0.3s ease-out;
  }
  
  .install-banner.show { display: flex; }
  
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  
  .install-banner-buttons {
    display: flex;
    gap: 0.75rem;
  }
  
  .install-banner-buttons button {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }
  
  .install-btn {
    background: #8ED420;
    color: #0C4018;
  }
  
  .dismiss-btn {
    background: rgba(255,255,255,0.2);
    color: white;
  }
</style>

<div class="install-banner" id="install-banner">
  <div style="display: flex; align-items: center; gap: 0.75rem;">
    <span>📲 ติดตั้ง นิพนธ์ฟาร์ม เป็น App</span>
  </div>
  <p style="font-size: 0.85rem; margin: 0; opacity: 0.9;">เข้าใช้งานได้เหมือน App จริง บนมือถือของคุณ</p>
  <div class="install-banner-buttons">
    <button class="install-btn" id="install-btn">ติดตั้ง</button>
    <button class="dismiss-btn" id="dismiss-btn">ปิด</button>
  </div>
</div>

<!-- PWA Service Worker Registration & Install Script -->
<script>
window.addEventListener('load', () => {
  // 🔧 Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => {
        console.log('✅ Service Worker registered');
        setInterval(() => { reg.update(); }, 3600000);
      })
      .catch((err) => {
        console.warn('⚠️ Service Worker registration failed:', err);
      });
  }
  
  // 📱 PWA Install Prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-banner').classList.add('show');
    
    document.getElementById('install-btn').addEventListener('click', () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            document.getElementById('install-banner').classList.remove('show');
          }
          deferredPrompt = null;
        });
      }
    });
    
    document.getElementById('dismiss-btn').addEventListener('click', () => {
      document.getElementById('install-banner').classList.remove('show');
      deferredPrompt = null;
    });
  });
  
  window.addEventListener('appinstalled', () => {
    console.log('🎉 App was installed!');
    document.getElementById('install-banner').classList.remove('show');
  });
});
</script>
```

### Step 3: Deploy to GitHub Pages

```bash
# 1. Add all new files
git add .
git commit -m "chore: add PWA support with icons and service worker"

# 2. Push to GitHub
git push origin main

# 3. Wait ~1-2 minutes for GitHub Pages to deploy
```

### Step 4: Verify PWA Installation

**Desktop (Chrome):**
1. Open your GitHub Pages URL in Chrome
2. ไปที่ 3-dot menu (⋮)
3. Click "Install นิพนธ์ฟาร์ม"
4. หรือหา banner "Install" ที่ด้านล่างของหน้า

**Mobile (Android Chrome):**
1. เปิด URL ที่ Google Chrome
2. ส่วนใหญ่จะมี banner "Install" ที่ด้านล่าง
3. แตะ "Install"
4. App จะเพิ่มเข้าไปใน Home Screen

**iOS (Safari):**
1. เปิด URL ใน Safari
2. แตะ Share (↗)
3. เลือก "Add to Home Screen"
4. ตั้งชื่อแล้ว "Add"

---

## 🔍 Testing & Verification

### Chrome DevTools Inspection

```
1. เปิด DevTools (F12)
2. ไปที่ Application tab
3. ตรวจสอบ:
   ✓ Manifest — ต้องแสดงชื่อ, icons, theme_color
   ✓ Service Worker — ต้องแสดง "activated and running"
   ✓ Storage — Cache ควรมี assets
```

### Offline Testing

```
1. DevTools > Application > Service Workers
2. Check "Offline"
3. หน้าจอควรยังแสดง UI (บรรทัดหลักและลายออกแบบ)
4. API calls จะแสดง error (ปกติ เพราะต้อง login ใหม่)
```

### Lighthouse Audit

```
1. DevTools > Lighthouse
2. Click "Analyze page load"
3. ดูคะแนน PWA
4. ต้องผ่านข้อมูลเหล่านี้:
   ✓ Installable
   ✓ PWA Optimized
   ✓ Secure (HTTPS)
```

---

## 🎨 Icon Design Details

ไอคอนที่สร้างขึ้นมีสมบัติดังนี้:

```
Design: Orbital/Tech style with farm theme
├── Brand Green (#28A444) — Primary color
├── Lime Accent (#8ED420) — Secondary
├── 4 orbital points — Representing farm sectors
├── Center dot — Farm/pig symbol
└── Concentric rings — Productivity cycles

Safe Zone: Center 60% (for maskable icons)
Background: White (#FFFFFF)
Format: PNG-24 (transparent ready)
Sizes: 192×192, 512×512
```

---

## 📋 Manifest.json Explained

ไฟล์ `manifest.json` มี 3 ส่วนสำคัญ:

### 1. Basic Info
```json
{
  "name": "นิพนธ์ฟาร์ม - Smart Sow Productivity System",
  "short_name": "นิพนธ์ฟาร์ม",
  "start_url": "/index.html",
  "display": "standalone"
}
```

### 2. Icons (required for PWA)
```json
{
  "icons": [
    {
      "src": "icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icon-192x192-maskable.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### 3. Shortcuts (อปทุ่นสำคัญ)
```json
{
  "shortcuts": [
    {
      "name": "Dashboard",
      "short_name": "Dashboard",
      "url": "/index.html?page=dashboard",
      "icons": [{ "src": "icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "แม่สุกร",
      "url": "/index.html?page=sows"
    },
    {
      "name": "บันทึกข้อมูล",
      "url": "/index.html?page=record"
    }
  ]
}
```

---

## 🔌 Service Worker (sw.js)

Service Worker ทำหน้าที่:

1. **Caching Strategy:**
   - `Cache First` → CSS, JS, Fonts (เร็ว)
   - `Network First` → HTML (ล่าสุด)
   - `Network Only` → API calls ไม่เก็บ cache

2. **Offline Support:**
   - หน้าจะโหลดจาก cache ถ้าไม่มี internet
   - API calls จะ fallback error response
   - ไม่สามารถบันทึกข้อมูลใหม่ได้โดยไม่มี internet

3. **Update Check:**
   - Runs every 1 hour in background
   - Updates service worker โดยอัตโนมัติ

---

## 🚨 Important Notes

### ⚠️ HTTPS is Required
PWA **ต้อง** ใช้ HTTPS (SSL certificate)
```
✅ https://yourgithub.io/farm
❌ http://yourgithub.io/farm (won't work)
```

GitHub Pages ใช้ HTTPS โดยอัตโนมัติ ✅

### ⚠️ Service Worker Scope
Service Worker ทำงานได้เฉพาะภายใต้ path ที่บันทึก
```
sw.js ที่ /sw.js → ครอบ /index.html, /api/ ทั้งหมด
sw.js ที่ /app/sw.js → ครอบเฉพาะ /app/* เท่านั้น
```

### ⚠️ Cache Busting
ถ้าแก้ไข CSS/JS และอัปโหลด:
1. Service Worker อัปเดตจะสแกน assets ล่าสุด
2. ผู้ใช้อาจเห็น version เก่า (browser cache)
3. **วิธีแก้:** แสดง toast "Update available, refresh"

---

## 🔧 Troubleshooting

### ❌ "Install banner ไม่แสดง"
**สาเหตุ:**
- ยังไม่ deploy HTTPS
- manifest.json หาไม่เจอ
- Service Worker ล้มเหลว

**วิธีแก้:**
```
1. DevTools > Application > Manifest — ตรวจสอบ
2. DevTools > Application > Service Workers — ตรวจ error
3. Console ดูว่ามี error อะไร
```

### ❌ "Icons ไม่ปรากฏ"
**สาเหตุ:**
- ไฟล์ icon หาไม่เจอ
- Path ใน manifest.json ผิด
- ไฟล์ corrupt

**วิธีแก้:**
```
1. ตรวจ DevTools > Network ว่าโหลดได้ไหม
2. F12 > Application > Manifest > icons section
3. ลองสร้าง icons ใหม่
```

### ❌ "Service Worker ไม่ activate"
**สาเหตุ:**
- sw.js มี syntax error
- Path ผิด
- Browser cache

**วิธีแก้:**
```
1. DevTools > Console ดู error
2. DevTools > Application > Service Workers > Unregister
3. Refresh (Ctrl+Shift+R)
4. ตรวจ sw.js syntax
```

---

## 📚 Future Enhancements

พัฒนาต่อที่เสนอ:

### Phase 2: Offline Data Sync
```javascript
// Cache form submissions
POST /api/record → offline
       ↓ (sync when online)
       → Google Sheets
```

### Phase 3: Push Notifications
```javascript
// ใช้ LINE Notify API (มี field LINE_TOKEN แล้ว)
Daily tasks notification
Farm alerts
```

### Phase 4: Background Sync
```javascript
// บันทึกข้อมูล sync ยอม background
recordService() → queued (offline)
              → sync automatic (online)
```

### Phase 5: QR/Barcode Scanner
```javascript
// เปิด camera สแกน ear tag
navigator.mediaDevices.getUserMedia()
QRious library
```

---

## 📖 References

- [MDN PWA Documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [web.dev PWA Checklist](https://web.dev/pwa-checklist/)

---

## 👨‍💼 Support

หากมีปัญหา:

1. **ตรวจ Browser Console** (F12 > Console)
2. **ตรวจ DevTools Application tab**
3. **ลอง Hard Refresh** (Ctrl+Shift+R)
4. **Clear Site Data** (DevTools > Application > Clear storage)

---

**Generated:** 2024  
**PWA Version:** 1.0  
**App Name:** นิพนธ์ฟาร์ม - Smart Sow Productivity System v2.1
