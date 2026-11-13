// Module : Chinh sach huong dan lien he (6.7.3)
// ID     : Policy_Footer_01, Policy_Footer_02, Policy_Page_01, Policy_Page_02, Policy_Page_03, Policy_Page_04, Policy_Page_05, Policy_Page_06, Policy_Warranty_01, Policy_Warranty_02, Policy_Warranty_03, Policy_Warranty_04, Policy_Warranty_05, Policy_Warranty_06, Policy_Warranty_07, Policy_Warranty_08, Policy_Warranty_09, Policy_Warranty_11, Policy_Warranty_12, Policy_Warranty_13, Policy_Warranty_14, Policy_Contact_01, Policy_Form_01, Policy_Form_02, Policy_Coop_01, Policy_Coop_02
// Tester : Cao Thị Kim Ngân - 23130204
// ASM7 - Automation Script: "Chính sách, hướng dẫn và liên hệ góp ý" (6.7.3) - https://www.dienmayxanh.com
// Sinh viên : Cao Thị Kim Ngân - 23130204 - Nhóm 11
// Công cụ   : Playwright Test (JavaScript)
// Phạm vi   : CHỈ kiểm tra trên trình duyệt desktop của laptop Lenovo ThinkBook (không giả lập tablet/mobile)
// Trình duyệt: đặt biến môi trường BROWSER_PATH trỏ tới Cốc Cốc (browser.exe); nếu không đặt, Playwright dùng Chromium mặc định
//              ví dụ (PowerShell): $env:BROWSER_PATH="C:\Program Files\CocCoc\Browser\Application\browser.exe"

const { test, expect } = require('@playwright/test');

// 1. CẤU HÌNH CHUNG
const BASE_URL = 'https://www.dienmayxanh.com';
const DESKTOP_VIEWPORT = { width: 1366, height: 768 }; // laptop Lenovo ThinkBook

// Độ trễ mỗi thao tác (ms). Chạy riêng Policy_Warranty_02 thì tự giảm còn 40 để nhanh hơn một chút; muốn đổi tay: $env:SLOWMO=50
const SLOW_MO = process.env.SLOWMO !== undefined
  ? Number(process.env.SLOWMO)
  : (process.argv.some((a) => /Policy_Warranty_02/.test(a)) ? 40 : (process.argv.some((a) => /Policy_Contact_0/.test(a)) ? 30 : 100));

test.use({
  headless: false,
  viewport: DESKTOP_VIEWPORT,
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
  launchOptions: {
    slowMo: SLOW_MO,
    executablePath: process.env.BROWSER_PATH || undefined, // đường dẫn Cốc Cốc nếu cần
  },
  trace: 'retain-on-failure',
});

test.setTimeout(120_000);
test.describe.configure({ mode: 'default' });

// 2. HÀM DÙNG CHUNG
const note = (msg) => test.info().annotations.push({ type: 'note', description: msg });

// page.evaluate có giới hạn thời gian: trang bị đơ thì trả về fallback thay vì treo đến hết timeout của test
async function evalWithTimeout(page, fn, fallback = null, ms = 8000) {
  return Promise.race([
    page.evaluate(fn).catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Đóng popup/quảng cáo
async function dismissPopups(page) {
  await page.keyboard.press('Escape').catch(() => { });
  await page.waitForTimeout(200);

  // Popup quảng cáo toàn màn hình
  try {
    const bigModalBackdrop = page.locator(
      'div[class*="z-[9998]"] div[class*="opacity-50"][class*="cursor-pointer"]'
    ).first();
    if (await bigModalBackdrop.isVisible({ timeout: 300 })) {
      await bigModalBackdrop.click({ force: true });
      await page.waitForTimeout(500);
      note('Đã đóng popup quảng cáo toàn màn hình (z-[9998])');
    }
  } catch { /* không có popup */ }

  // Widget quảng cáo nhỏ góc dưới trái
  try {
    const smallWidgetClose = page.locator(
      'i[class*="icon__row-3-col-1"][class*="cursor-pointer"]'
    ).first();
    if (await smallWidgetClose.isVisible({ timeout: 300 })) {
      await smallWidgetClose.click({ force: true });
      await page.waitForTimeout(400);
      note('Đã đóng widget quảng cáo nhỏ góc dưới trái');
    }
  } catch { /* không có widget */ }

  // Các nút đóng phổ biến khác (cookie, thông báo...)
  const candidates = [
    'button:has-text("Đóng")',
    'button:has-text("Đồng ý")',
    '[aria-label="Close"]:visible',
    '[aria-label="Đóng"]:visible',
    '[class*="btn-close"]:visible',
    '[class*="close-btn"]:visible',
    '[class*="cookie"] button:visible',
  ];
  for (const sel of candidates) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 150 })) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    } catch { /* bỏ qua */ }
  }

  // Cách chắc ăn cuối cùng: ẩn thẳng các lớp phủ quảng cáo còn sót lại
  await hideOverlays(page);
}

// Ẩn thẳng popup quảng cáo / tooltip chọn khu vực bằng DOM (khi nút đóng không bấm được)
async function hideOverlays(page) {
  const hidden = await evalWithTimeout(page, () => {
    let count = 0;
    const hide = (el) => { el.style.setProperty('display', 'none', 'important'); count++; };

    // 1. Popup quảng cáo toàn màn hình
    document.querySelectorAll('div[class*="z-[9998]"], div[class*="z-[9999]"]').forEach(hide);

    // 2. Tooltip "Bạn đang ở tại ..." (nổi lên, che nội dung)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (/Bạn đang ở tại/i.test(walker.currentNode.nodeValue || '')) {
        let el = walker.currentNode.parentElement;
        for (let i = 0; i < 8 && el && el !== document.body; i++, el = el.parentElement) {
          const pos = getComputedStyle(el).position;
          if (pos === 'absolute' || pos === 'fixed') { hide(el); break; }
        }
      }
    }
    return count;
  }, 0, 5000);
  if (hidden > 0) note(`Đã ẩn ${hidden} lớp quảng cáo/tooltip bằng DOM`);
}

// Chặn popup quảng cáo ngay từ lúc trang tải (áp dụng cho mọi trang sau khi điều hướng)
async function installAdBlocker(page) {
  await page.addInitScript(() => {
    const css = 'div[class*="z-[9998]"], div[class*="z-[9999]"] { display: none !important; }';
    const s = document.createElement('style');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  });
}

// Mở trang chủ + đóng quảng cáo
async function gotoHome(page) {
  await installAdBlocker(page);
  const res = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  expect(res.status(), 'Trang chủ phải tải được').toBeLessThan(400);
  await dismissPopups(page);
}

// Nhảy thẳng xuống cuối trang (trang chủ DMX lazy-load, scrollHeight tăng dần nên chỉ lặp tối đa 6 lần)
async function scrollToFooter(page) {
  let last = 0;
  for (let i = 0; i < 6; i++) {
    const h = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return document.documentElement.scrollHeight;
    });
    await page.waitForTimeout(400);
    if (h === last) break;
    last = h;
  }
  await dismissPopups(page); // quảng cáo có thể bật lên khi cuộn
}

// Cuộn từ từ để ảnh lazy-load tải đủ (điều khiển từng bước từ Playwright, có giới hạn số bước + thời gian)
// Không dùng setInterval trong trang: khi cửa sổ ở nền/bị che, Chrome làm chậm timer -> treo đến hết timeout
async function scrollToBottom(page) {
  const deadline = Date.now() + 20_000;
  let atBottomCount = 0;
  for (let i = 0; i < 60 && Date.now() < deadline; i++) {
    const t0 = Date.now();
    // [CHẨN ĐOÁN] nếu một lệnh evaluate không phản hồi sau 8s thì báo rõ thay vì treo đến hết timeout
    const evalPromise = page.evaluate(() => {
      window.scrollBy(0, 900);
      return {
        atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 5,
        y: Math.round(window.scrollY), h: document.documentElement.scrollHeight,
      };
    });
    const r = await Promise.race([
      evalPromise,
      new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (!r) {
      throw new Error(`[CHẨN ĐOÁN] page.evaluate không phản hồi sau 8s ở bước cuộn #${i} (url=${page.url()}). Trang đang bị kẹt/đơ khi Playwright cuộn.`);
    }
    console.log(`[scroll #${i}] y=${r.y} h=${r.h} (${Date.now() - t0}ms)`);
    await page.waitForTimeout(80);
    atBottomCount = r.atBottom ? atBottomCount + 1 : 0;
    if (atBottomCount >= 2) break; // chạm đáy 2 lần liên tiếp (trang lazy-load có thể dài thêm)
  }
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => { });
  await dismissPopups(page); // quảng cáo có thể bật lên trong lúc cuộn
}

// ---------- Footer ----------
// Footer desktop có 3 cột; footer DMX không nằm trong thẻ <footer> -> tìm tiêu đề theo chữ hiển thị
const FOOTER_COLS = ['Tổng đài hỗ trợ', 'Về công ty', 'Thông tin khác'];

function colHeading(page, name) {
  return page.locator(`:text-matches("^\\s*${name}", "i"):visible`).last();
}

// Mở rộng cột "Thông tin khác" nếu đang thu gọn (nút "Xem thêm"), trả về cột chứa link
// Giữ cách bấm như Policy_Footer_02 (đã chạy ổn); chỉ thêm cách bấm dự phòng có giới hạn thời gian để không bị đứng chờ
async function expandInfoColumn(page) {
  const heading = colHeading(page, 'Thông tin khác');
  await heading.scrollIntoViewIfNeeded();
  const column = heading.locator(
    'xpath=ancestor::*[.//a[contains(normalize-space(.),"Tích điểm")]][1]'
  );
  const more = column.getByText(/^\s*Xem thêm\s*$/i).first();
  const less = column.getByText(/^\s*Rút gọn\s*$/i).first();
  if (await more.isVisible().catch(() => false)) {
    await dismissPopups(page);
    const tries = [
      () => more.click({ timeout: 4000 }),
      () => more.click({ force: true, timeout: 3000 }),
      () => more.evaluate((el) => el.click()),
    ];
    for (const t of tries) {
      await t().catch(() => { });
      if (await less.isVisible().catch(() => false)) break;
      await page.waitForTimeout(400);
    }
    await expect(less, 'Sau khi bấm "Xem thêm" phải hiện nút "Rút gọn"').toBeVisible({ timeout: 5000 });
  }
  return column;
}

// Mở trang chọn hãng bảo hành: trang chủ -> footer -> "Chính sách bảo hành" (dùng cho các case tìm hãng)
async function gotoWarrantyPage(page) {
  await gotoHome(page);
  await scrollToFooter(page);
  const column = await expandInfoColumn(page);
  const warrantyLink = column.getByRole('link', { name: /^\s*Chính sách bảo hành\s*$/i }).first();
  await warrantyLink.scrollIntoViewIfNeeded();
  await expect(warrantyLink, 'Footer phải có liên kết "Chính sách bảo hành"').toBeVisible();
  await Promise.all([page.waitForLoadState('domcontentloaded'), warrantyLink.click()]);
  await dismissPopups(page);
  await page.waitForTimeout(1000);
  await dismissPopups(page);
  await expect(page, 'Phải vào trang bảo hành (/bao-hanh)').toHaveURL(/\/bao-hanh/i);
}

// Các logo hãng đang hiển thị trên trang chọn hãng (link dạng /bao-hanh/<hãng>, bỏ phần tử bị ẩn)
function visibleBrandTiles(page) {
  return evalWithTimeout(page, () => Array.from(document.querySelectorAll('a[href*="/bao-hanh/"]'))
    .filter((a) => /\/bao-hanh\/[^\/?#]+\/?$/i.test(a.getAttribute('href') || ''))
    .filter((a) => { const r = a.getBoundingClientRect(); const st = getComputedStyle(a); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; })
    .map((a) => ({
      href: a.getAttribute('href') || '',
      text: (a.innerText || '').replace(/\s+/g, ' ').trim(),
      alt: (a.querySelector('img')?.getAttribute('alt') || '').trim(),
    })), [], 5000);
}

// Tra cứu bảo hành theo SĐT (dùng cho các case tra cứu SĐT): chọn tab SĐT, nhập SĐT, bấm "Kiểm tra". Trả về nội dung trang trước khi bấm
const LOOKUP_RE = {
  systemErr: /\b404\b|lỗi\s*hệ\s*thống|internal\s*server|undefined|\[object|exception/i,
  notFound: /không\s*(tìm\s*thấy|có\s*thông\s*tin|có\s*dữ\s*liệu|có\s*kết\s*quả)/i,
  otp: /(mã\s*(xác\s*(thực|nhận|minh)|otp)|otp|gửi\s*(mã\s*)?(về|đến|tới)|xác\s*(thực|nhận)\s*(số\s*điện\s*thoại|sđt))/i,
  info: /(thời\s*hạn|hạn\s*bảo\s*hành|ngày\s*(mua|kích\s*hoạt)|còn\s*bảo\s*hành|hết\s*bảo\s*hành|trạng\s*thái|sản\s*phẩm|imei|jobcard)/i,
};

async function addedSince(page, before) {
  const beforeLines = new Set(before.split('\n').map((l) => l.trim()));
  const body = await page.locator('body').innerText().catch(() => '');
  return body.split('\n').map((l) => l.trim()).filter((l) => l && !beforeLines.has(l)).join('\n');
}

// Các cách bấm nút "Kiểm tra" (dùng chung cho pressLookup và case ô trống)
function lookupStrategies(page, input, lookupBtn) {
  return [
    ['hover rồi click chậm bằng chuột', async () => { await lookupBtn.hover(); await page.waitForTimeout(300); await lookupBtn.click({ delay: 150 }); }],
    ['nhấn Enter trong ô nhập', async () => { await input.click(); await input.press('Enter'); }],
    ['focus nút rồi nhấn Enter', async () => { await lookupBtn.focus(); await page.keyboard.press('Enter'); }],
    ['click bằng JavaScript (el.click())', async () => { await lookupBtn.evaluate((el) => el.click()); }],
  ];
}

// Bấm nút "Kiểm tra" và đợi trang phản hồi (popup "XÁC NHẬN SỐ ĐIỆN THOẠI"...). Nút có thể không nhận cú click tự động nên thử lần lượt nhiều cách, dừng ngay khi trang có phản hồi.
// LƯU Ý: KHÔNG gọi dismissPopups() ngay sau khi bấm, vì nó nhấn Escape/ẩn lớp phủ và có thể đóng luôn popup của chính trang trước khi script kịp đọc.
async function pressLookup(page, input, lookupBtn, before) {
  const responded = async (ms) => {
    for (let waited = 0; waited < ms; waited += 300) {
      await page.waitForTimeout(300);
      if ((await addedSince(page, before)).trim()) return true;
    }
    return false;
  };
  const strategies = lookupStrategies(page, input, lookupBtn);
  for (const [name, run] of strategies) {
    await run().catch(() => { });
    if (await responded(3000)) { note(`Kích hoạt nút "Kiểm tra" bằng cách: ${name}`); return name; }
  }
  note('Đã thử 4 cách bấm nút "Kiểm tra" nhưng trang không phản hồi (có thể trang chặn thao tác tự động hoặc reCAPTCHA); nếu vậy tester tự bấm nút trên trình duyệt đang mở');
  return null;
}

async function submitPhoneLookup(page, phone) {
  await expect(page.getByRole('heading', { name: /Tra cứu thông tin bảo hành/i }), 'Phải có mục "Tra cứu thông tin bảo hành"').toBeVisible();
  const phoneTab = page.getByText(/^\s*Tra theo số điện thoại\s*$/i).first();
  await phoneTab.scrollIntoViewIfNeeded();
  await expect(phoneTab, 'Phải có tab "Tra theo số điện thoại"').toBeVisible();
  await phoneTab.click();
  await page.waitForTimeout(600);
  await dismissPopups(page);
  const input = page.getByPlaceholder(/nhập số điện thoại hoặc imei/i).first();
  await input.scrollIntoViewIfNeeded();
  await expect(input, 'Phải có ô nhập tra cứu thông tin bảo hành').toBeVisible();
  await input.click();
  await input.fill('');
  await input.pressSequentially(phone, { delay: 100 });
  await expect(input, 'Ô tra cứu phải giữ đúng SĐT vừa nhập').toHaveValue(phone);
  const before = await page.locator('body').innerText().catch(() => '');
  const lookupBtn = page.getByRole('button', { name: /^\s*Kiểm tra\s*$/i }).first();
  await expect(lookupBtn, 'Phải có nút "Kiểm tra" ở mục tra cứu bảo hành').toBeVisible();
  await pressLookup(page, input, lookupBtn, before);
  return before;
}

// Chờ tester tự nhập mã xác thực (SMS) + reCAPTCHA trên trình duyệt đang mở; xong khi thấy thông tin bảo hành hoặc thông báo không tìm thấy
async function waitForManualOtpResult(page, before, label, ms = 120_000) {
  console.log(`\n>>> [${label}] Hãy NHẬP MÃ XÁC THỰC gửi về điện thoại (và giải reCAPTCHA nếu có) NGAY TRÊN TRÌNH DUYỆT ĐANG MỞ rồi bấm xác nhận (có thể phải bấm nhiều lần). Script chờ tối đa ${ms / 1000} giây...\n`);
  await test.step(`Chờ tester tự nhập mã xác thực (tối đa ${ms / 1000}s)`, async () => {
    await expect.poll(async () => {
      const a = await addedSince(page, before);
      return LOOKUP_RE.info.test(a) || LOOKUP_RE.notFound.test(a);
    }, { timeout: ms, intervals: [1000] }).toBeTruthy().catch(() => { });
  });
  await page.waitForTimeout(1500);
}

// ---------- Tổng đài hỗ trợ: bấm số tel: và điều khiển hộp thoại "Open Pick an app?" của trình duyệt ----------
// Hộp thoại này là giao diện của trình duyệt (không nằm trong trang) nên Playwright không bấm được -> gửi phím ở mức hệ điều hành (Windows, PowerShell SendKeys).
// Hộp thoại có 3 phần tử theo thứ tự Tab: ô tick "Always allow ...", nút "Open Pick an app", nút "Cancel" (mặc định đang chọn "Cancel").
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const IS_WIN = process.platform === 'win32';
const SUPPORT_LINES = [
  { label: 'Gọi mua', digits: '1900232461' },
  { label: 'Khiếu nại', digits: '18001063' },
  { label: 'Hỗ trợ kỹ thuật & Bảo hành', digits: '1900232465' },
];

function runPowerShell(script) {
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-STA', '-Command', script], { windowsHide: true }, (err) => resolve(!err));
  });
}

// Gửi phím tới cửa sổ đang được chọn (cú pháp SendKeys: {ENTER}, {TAB}, +{TAB} = Shift+Tab, ' ' = phím cách)
async function sendKeys(page, keys) {
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')`);
  await page.waitForTimeout(150);
}

// Chụp cả màn hình (hộp thoại của trình duyệt không chụp được bằng page.screenshot)
async function screenShot(file) {
  fs.mkdirSync('test-results', { recursive: true });
  const full = path.resolve(file).replace(/'/g, "''");
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $bmp.Save('${full}'); $g.Dispose(); $bmp.Dispose()`);
}

// So sánh 2 ảnh chụp màn hình trong vùng giữa-trên (nơi hộp thoại hiện): trả về tỉ lệ điểm ảnh thay đổi (0..1).
// Hộp thoại hiện -> trang phía sau bị làm tối nên gần như toàn vùng đổi (tỉ lệ cao); hộp thoại đóng -> tỉ lệ thấp (chỉ banner tự chuyển có thể đổi chút).
const DIALOG_ON = 0.5;   // tỉ lệ thay đổi từ mức này trở lên = hộp thoại đang hiện
const DIALOG_OFF = 0.35; // tỉ lệ thay đổi từ mức này trở xuống = hộp thoại đã đóng
function screenDiffRatio(fileA, fileB) {
  const A = path.resolve(fileA).replace(/'/g, "''");
  const B = path.resolve(fileB).replace(/'/g, "''");
  const ps = `Add-Type -AssemblyName System.Drawing; $a=New-Object System.Drawing.Bitmap '${A}'; $b=New-Object System.Drawing.Bitmap '${B}'; $w=[Math]::Min($a.Width,$b.Width); $h=[Math]::Min($a.Height,$b.Height); $x0=[int]($w*0.05); $x1=[int]($w*0.65); $y0=[int]($h*0.15); $y1=[int]($h*0.7); $n=0; $d=0; for($y=$y0;$y -lt $y1;$y+=12){ for($x=$x0;$x -lt $x1;$x+=12){ $p=$a.GetPixel($x,$y); $q=$b.GetPixel($x,$y); $n++; if(([Math]::Abs($p.R-$q.R)+[Math]::Abs($p.G-$q.G)+[Math]::Abs($p.B-$q.B)) -gt 60){$d++} } }; $a.Dispose(); $b.Dispose(); ($d/$n).ToString('0.000',[Globalization.CultureInfo]::InvariantCulture)`;
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-STA', '-Command', ps], { windowsHide: true }, (err, stdout) => resolve(err ? -1 : parseFloat(String(stdout).trim())));
  });
}

// Chụp màn hình nền (hộp thoại đang đóng), bấm số, chụp lại và kiểm tra hộp thoại "Open Pick an app?" đã hiện. Trả về đường dẫn ảnh nền
async function clickAndExpectDialog(page, column, line, tag, check, knownBase = null) {
  const base = knownBase || `test-results/${tag}_base.png`;
  const shot = `test-results/${tag}_dialog.png`;
  if (!knownBase) await screenShot(base); // đã có ảnh nền (ảnh sau khi đóng hộp thoại lần trước) thì khỏi chụp lại
  await clickSupportNumber(page, column, line);
  await screenShot(shot);
  const r = await screenDiffRatio(base, shot);
  note(`[${tag}] bấm "${line.label}": mức thay đổi màn hình ${r} (>= ${DIALOG_ON} là hộp thoại đã hiện)`);
  check(r >= DIALOG_ON, `[${tag}] Không thấy hộp thoại "Open Pick an app?" sau khi bấm số "${line.label}" (mức thay đổi ${r})`);
  return base;
}

// Chụp lại màn hình và kiểm tra hộp thoại đã đóng (giống ảnh nền)
async function expectDialogClosed(page, base, tag, check) {
  const after = `test-results/${tag}_closed.png`;
  await page.waitForTimeout(300);
  await screenShot(after);
  const r = await screenDiffRatio(base, after);
  note(`[${tag}] sau khi đóng hộp thoại: mức thay đổi so với ảnh nền ${r} (<= ${DIALOG_OFF} là đã đóng)`);
  check(r >= 0 && r <= DIALOG_OFF, `[${tag}] Hộp thoại vẫn còn hiện sau khi bấm nút (mức thay đổi ${r})`);
  return after;
}

// Chạy lần lượt các vòng: mỗi vòng bấm từng số tổng đài rồi xử lý hộp thoại theo lựa chọn (tick "Always allow" hay không, Cancel hay Open Pick an app)
async function runDialogRounds(page, column, urlBefore, rounds, prefix, failures, check) {
  let lastBase = null; // ảnh nền (hộp thoại đóng) dùng lại cho lần bấm kế tiếp
  for (const [ri, round] of rounds.entries()) {
    const lines = round.onlyFirst ? [SUPPORT_LINES[0]] : SUPPORT_LINES;
    for (const [i, line] of lines.entries()) {
      const tag = `${prefix}_v${ri + 1}_so${i + 1}`;
      await test.step(`Vòng ${ri + 1} (${round.name}): bấm số "${line.label}"`, async () => {
        const base = await clickAndExpectDialog(page, column, line, tag, check, lastBase);

        if (round.tick) {
          await sendKeys(page, '+{TAB}+{TAB} '); // Cancel -> "Open Pick an app" -> ô tick, rồi phím cách để tick
          await screenShot(`test-results/${tag}_ticked.png`); // bằng chứng ô đã được tick
        }

        if (round.action === 'cancel') {
          await sendKeys(page, round.tick ? '{TAB}{TAB}{ENTER}' : '{ENTER}'); // tới "Cancel" rồi Enter
          lastBase = await expectDialogClosed(page, base, tag, check);
        } else {
          await sendKeys(page, round.tick ? '{TAB}{ENTER}' : '+{TAB}{ENTER}'); // tới "Open Pick an app" rồi Enter
          await page.waitForTimeout(2500); // chờ Windows mở ứng dụng/cửa sổ chọn ứng dụng
          await screenShot(`test-results/${tag}_after_open.png`); // kết quả thực tế: xem ảnh này
          await sendKeys(page, '{ESC}'); // đóng cửa sổ vừa mở (nếu có)
          await page.bringToFront();
          await page.waitForTimeout(500);
          lastBase = null; // cửa sổ ngoài có thể làm đổi màn hình -> chụp ảnh nền mới ở lần bấm sau
        }
        await expectStillOnPage(page, urlBefore, failures, check);
      });
    }
  }
}

// Mở trang chủ, cuộn xuống footer, trả về cột "Tổng đài hỗ trợ"
async function openSupportColumn(page) {
  await gotoHome(page);
  await scrollToFooter(page);
  const heading = colHeading(page, 'Tổng đài hỗ trợ');
  await heading.scrollIntoViewIfNeeded();
  await expect(heading, 'Footer phải có cột "Tổng đài hỗ trợ"').toBeVisible();
  const column = heading.locator('xpath=ancestor::*[contains(normalize-space(.),"Gọi mua") and contains(normalize-space(.),"Khiếu nại")][1]');
  await expect(column, 'Cột "Tổng đài hỗ trợ" phải có dòng "Gọi mua" và "Khiếu nại"').toBeVisible();
  return column;
}

// Bấm vào số tổng đài (liên kết tel:) có chữ số khớp, chờ hộp thoại của trình duyệt hiện ra
async function clickSupportNumber(page, column, line) {
  const links = column.locator('a[href^="tel:"]');
  const n = await links.count();
  let target = null;
  for (let i = 0; i < n; i++) {
    const href = (await links.nth(i).getAttribute('href')) || '';
    if (href.replace(/\D/g, '') === line.digits) { target = links.nth(i); note(`Số "${line.label}": liên kết ${href}`); break; }
  }
  expect(target, `Phải có liên kết tel: cho số "${line.label}"`).not.toBeNull();
  await target.scrollIntoViewIfNeeded();
  await page.bringToFront();
  await target.click({ delay: 100 });
  await page.waitForTimeout(900); // chờ hộp thoại "Open Pick an app?" hiện
}

// Sau khi xử lý hộp thoại: vẫn ở trang chủ, không lỗi hệ thống
async function expectStillOnPage(page, urlBefore, failures, check) {
  check(page.url() === urlBefore, `Bấm số làm chuyển trang: ${page.url()}`);
  const body = await page.locator('body').innerText().catch(() => '');
  check(!LOOKUP_RE.systemErr.test(body.slice(0, 3000)), 'Trang hiện chữ báo lỗi hệ thống/404 sau khi xử lý hộp thoại');
}

// ---------- Trang [Gửi góp ý, khiếu nại] (cột "Về công ty" ở footer) ----------
// Mở trang góp ý từ footer: trang chủ -> footer -> cột "Về công ty" -> "Gửi góp ý, khiếu nại". Liên kết có thể mở cùng tab hoặc tab mới.
async function gotoFeedbackPage(page) {
  await gotoHome(page);
  await scrollToFooter(page);
  const heading = colHeading(page, 'Về công ty');
  await heading.scrollIntoViewIfNeeded();
  await expect(heading, 'Footer phải có cột "Về công ty"').toBeVisible();
  const column = heading.locator('xpath=ancestor::*[.//a[contains(normalize-space(.),"góp ý")]][1]');
  const link = column.getByRole('link', { name: /Gửi\s*góp\s*ý/i }).first();
  await link.scrollIntoViewIfNeeded();
  await expect(link, 'Cột "Về công ty" phải có liên kết "Gửi góp ý, khiếu nại"').toBeVisible();
  const linkText = (await link.innerText()).trim();
  const linkHref = await link.getAttribute('href');
  note(`Bấm link: "${linkText}" -> ${linkHref}`);

  const newTabPromise = page.context().waitForEvent('page', { timeout: 3000 }).catch(() => null);
  await link.click({ noWaitAfter: true });
  const newTab = await newTabPromise;
  const target = newTab || page;
  await target.waitForLoadState('domcontentloaded').catch(() => { });
  await target.waitForTimeout(1500);
  await dismissPopups(target);
  await target.waitForTimeout(800);
  await dismissPopups(target);
  if (!/lien-he|gop-y|khieu-nai|contact/i.test(target.url()) && linkHref) {
    // Cú bấm có thể trượt (widget nổi che link, vd URL thành /#ma-giam) -> mở thẳng href của liên kết
    note(`Bấm link chưa vào trang góp ý (URL: ${target.url()}), mở thẳng ${linkHref}`);
    await target.goto(new URL(linkHref, BASE_URL).href, { waitUntil: 'domcontentloaded' });
    await dismissPopups(target);
    await target.waitForTimeout(800);
    await dismissPopups(target);
  }
  note(`URL sau khi bấm: ${target.url()}${newTab ? ' (mở tab mới)' : ''} (href ban đầu: ${linkHref})`);
  return { target, newTab, linkText, linkHref };
}

// Các ô nhập đang hiển thị của form (bỏ ô ẩn, checkbox, radio, nút, file)
const FORM_FIELD_SEL = 'input:visible:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea:visible, select:visible';

// Mô tả từng ô: nhãn / placeholder / name, có thuộc tính bắt buộc không, giá trị hiện tại
async function describeFormFields(target) {
  const inputs = target.locator(FORM_FIELD_SEL);
  const n = await inputs.count();
  const fields = [];
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    const placeholder = (await el.getAttribute('placeholder').catch(() => '')) || '';
    const name = (await el.getAttribute('name').catch(() => '')) || '';
    const ariaLabel = (await el.getAttribute('aria-label').catch(() => '')) || '';
    const id = await el.getAttribute('id').catch(() => null);
    const tag = await el.evaluate((e) => e.tagName.toLowerCase()).catch(() => 'input');
    const required = await el.evaluate((e) => e.required || e.getAttribute('aria-required') === 'true').catch(() => false);
    let label = '';
    if (id) label = ((await target.locator(`label[for="${id}"]`).first().innerText({ timeout: 500 }).catch(() => '')) || '').trim();
    const display = label || placeholder || ariaLabel || name || '(không có nhãn)';
    fields.push({ el, tag, name, display, required, text: `${label} ${placeholder} ${ariaLabel} ${name}` });
  }
  return fields;
}

// ---------- Dùng chung cho Policy_Form_02 ----------
// Tìm nút gửi của form góp ý
async function findFeedbackSubmit(target) {
  const sendRe = /^\s*(gửi(\s*(góp\s*ý|khiếu\s*nại|ý\s*kiến|đi|ngay))?|send|submit)\s*$/i;
  const candidates = [
    target.locator('input[type="submit"]:visible').first(),
    target.locator('button[type="submit"]:visible').first(),
    target.locator('button:visible, input[type="button"]:visible, a[role="button"]:visible, a.btn:visible').filter({ hasText: sendRe }).first(),
    target.locator('button:visible, a[role="button"]:visible, a.btn:visible').filter({ hasText: /gửi/i }).first(),
  ];
  for (const c of candidates) {
    if (await c.isVisible().catch(() => false)) return c;
  }
  return null;
}

// Điền form góp ý. Ô tìm theo name thật của trang (username, phone, email, content); không thấy thì tìm theo nhãn/placeholder
async function fillFeedbackForm(target, data) {
  const fields = await describeFormFields(target);
  const pick = (name, re) => fields.find((f) => f.name === name) || fields.find((f) => re.test(f.text));
  const map = {
    username: pick('username', /họ\s*tên|họ\s*và\s*tên|tên|name/i),
    phone: pick('phone', /điện\s*thoại|sđt|phone/i),
    email: pick('email', /e-?mail/i),
    content: pick('content', /nội\s*dung|góp\s*ý|ý\s*kiến|content|message/i),
  };
  for (const [key, f] of Object.entries(map)) {
    if (data[key] === undefined) continue;
    expect(f, `Form phải có ô nhập "${key}"`).toBeTruthy();
    await f.el.scrollIntoViewIfNeeded().catch(() => { });
    await f.el.click();
    await f.el.fill('');
    await f.el.pressSequentially(data[key], { delay: 60 });
    await expect(f.el, `Ô "${f.display}" phải giữ đúng giá trị vừa nhập`).toHaveValue(data[key]);
  }
  return map;
}

// ---------- Form hợp tác bán hàng (Google Form) - cột "Về công ty" ở footer -> "Hợp tác bán hàng" ----------
// Dùng chung cho nhóm Policy_Coop_xx: mỗi case bỏ trống đúng 1 trường bắt buộc, điền hợp lệ các trường còn lại rồi bấm Gửi
const COOP_Q = {
  company: /Tên\s*Doanh\s*nghiệp/i,
  address: /Địa\s*chỉ\s*văn\s*phòng/i,
  contact: /Họ\s*(&|và)\s*Tên\s*người\s*liên\s*hệ/i,
  phone: /Số\s*điện\s*thoại\s*người\s*liên\s*hệ/i,
  goods: /Mặt\s*hàng\s*kinh\s*doanh/i,
};
const COOP_DATA = {
  company: 'Công ty Kiểm thử ABC',
  address: '123 Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh',
  contact: 'Nguyễn Văn Test',
  phone: '0912345678',
};
const COOP_LABEL = { company: 'Tên Doanh nghiệp của bạn?', address: 'Địa chỉ văn phòng đại diện', contact: 'Họ & Tên người liên hệ?', phone: 'Số điện thoại người liên hệ?' };

// Mỗi câu hỏi của Google Form là một div[role="listitem"]; tìm câu theo tiêu đề
const coopItem = (target, re) => target.locator('div[role="listitem"]').filter({ hasText: re }).first();

// Mở form từ footer: trang chủ -> footer -> cột "Về công ty" -> "Hợp tác bán hàng". Liên kết có thể mở cùng tab hoặc tab mới
async function gotoCoopForm(page) {
  await gotoHome(page);
  await scrollToFooter(page);
  // Link "Hợp tác bán hàng" có thể nằm ở cột "Thông tin khác" (chỉ hiện sau khi bấm "Xem thêm") -> luôn mở rộng cột này trước,
  // rồi tìm link trong toàn bộ footer (contentinfo) để không phụ thuộc link nằm ở cột nào
  await expandInfoColumn(page);
  const footer = page.getByRole('contentinfo');
  const link = footer.getByRole('link', { name: /Hợp\s*tác\s*bán\s*hàng/i }).first();
  const found = await link.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
  if (!found) {
    const links = await footer.getByRole('link').allInnerTexts().catch(() => []);
    note(`Không thấy link "Hợp tác bán hàng" trong footer. Các link đang có: ${links.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 40).join(' | ')}`);
  }
  await expect(link, 'Footer phải có liên kết "Hợp tác bán hàng" (sau khi bấm "Xem thêm" ở cột "Thông tin khác")').toBeVisible({ timeout: 1000 });
  await link.scrollIntoViewIfNeeded({ timeout: 5000 });
  const linkHref = await link.getAttribute('href');
  note(`Bấm link: "${(await link.innerText()).trim()}" -> ${linkHref}`);

  const newTabPromise = page.context().waitForEvent('page', { timeout: 4000 }).catch(() => null);
  await link.click({ noWaitAfter: true });
  const newTab = await newTabPromise;
  const target = newTab || page;
  await target.waitForLoadState('domcontentloaded').catch(() => { });
  await target.waitForTimeout(2500);
  await dismissPopups(target);
  if (!/google\.com|forms\.gle/i.test(target.url()) && linkHref) {
    note(`Bấm link chưa vào Google Form (URL: ${target.url()}), mở thẳng ${linkHref}`);
    await target.goto(new URL(linkHref, BASE_URL).href, { waitUntil: 'domcontentloaded' });
    await target.waitForTimeout(2500);
  }
  note(`URL biểu mẫu: ${target.url()}${newTab ? ' (mở tab mới)' : ''}`);
  return { target, newTab, linkHref };
}

// Tìm nút "Gửi" của Google Form. Nút này là <div role="button" jsname="M2UYVd">, có thể render chậm / chữ "Gửi" ở dạng Unicode tổ hợp
// -> thử lần lượt nhiều cách định vị, chờ tối đa ~15s, và ghi log các nút đang có trên trang để chẩn đoán
async function findCoopSubmit(target) {
  const SUBMIT_RE = /^\s*(G(?:\u1EED|\u01B0\u0309)i|Submit)\s*$/i;
  const candidates = [
    ['role=button "Gửi/Submit"', () => target.getByRole('button', { name: SUBMIT_RE })],
    ['div[role=button][jsname=M2UYVd]', () => target.locator('div[role="button"][jsname="M2UYVd"]')],
    ['button/div[role=button]/input có chữ Gửi', () => target.locator('div[role="button"], button, input[type="submit"]').filter({ hasText: SUBMIT_RE })],
    ['span chữ Gửi', () => target.locator('span').filter({ hasText: SUBMIT_RE })],
  ];
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    for (const [name, make] of candidates) {
      const loc = make().first();
      if (await loc.isVisible().catch(() => false)) {
        note(`Tìm thấy nút Gửi bằng: ${name}`);
        return loc;
      }
    }
    // Nút có thể nằm dưới cùng form -> cuộn xuống để Google Form render
    await target.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => { });
    await target.waitForTimeout(500);
  }
  const buttons = await target.locator('div[role="button"], button, input[type="submit"]').evaluateAll(
    (els) => els.map((e) => (e.innerText || e.value || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  ).catch(() => []);
  note(`KHÔNG tìm thấy nút Gửi. URL: ${target.url()}; các nút đang có: ${buttons.join(' | ') || '(không có)'}`);
  await target.screenshot({ path: 'test-results/Policy_Coop_khong_thay_nut_gui.png', fullPage: true }).catch(() => { });
  return candidates[0][1]().first(); // trả về locator rỗng để expect báo lỗi rõ ràng
}

// Chạy 1 case "bỏ trống 1 trường bắt buộc rồi Gửi" (Step 1-6 trong Excel)
async function runCoopMissingFieldCase(page, tag, missingKey, opts = {}) {
  const failures = [];
  const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };
  const missingLabel = COOP_LABEL[missingKey];

  // Step 1 + 2: trang chủ -> footer -> "Hợp tác bán hàng" -> Google Form
  const { target } = await gotoCoopForm(page);
  if (/accounts\.google\.com|ServiceLogin/i.test(target.url())) {
    note('Google Form yêu cầu đăng nhập tài khoản Google nên không mở được biểu mẫu; không nhập/gửi dữ liệu');
    expect(false, 'Google Form yêu cầu đăng nhập, không mở được biểu mẫu để kiểm thử').toBeTruthy();
  }
  const firstItem = target.locator('div[role="listitem"]').first();
  await expect(firstItem, 'Phải mở được biểu mẫu Google Form (có các câu hỏi)').toBeVisible({ timeout: 20_000 });
  const formBody = (await target.locator('body').innerText().catch(() => '')) || '';
  note(`Tiêu đề tab: "${await target.title().catch(() => '')}"; có tiêu đề "THÔNG TIN HỢP TÁC": ${/THÔNG\s*TIN\s*HỢP\s*TÁC/i.test(formBody) ? 'CÓ' : 'KHÔNG'}`);
  const formUrl = target.url();

  // Step 3: điền các trường bắt buộc hợp lệ, trừ trường cần bỏ trống
  const filled = {};
  for (const key of ['company', 'address', 'contact', 'phone']) {
    const item = coopItem(target, COOP_Q[key]);
    await expect(item, `Form phải có câu "${COOP_LABEL[key]}"`).toBeVisible();
    if (key === missingKey) continue;
    const input = item.locator('input:not([type="hidden"]), textarea').first();
    await input.scrollIntoViewIfNeeded().catch(() => { });
    await input.click();
    await input.fill('');
    await input.pressSequentially(COOP_DATA[key], { delay: 40 });
    await expect(input, `Ô "${COOP_LABEL[key]}" phải giữ đúng giá trị vừa nhập`).toHaveValue(COOP_DATA[key]);
    filled[key] = input;
  }
  note(`Đã điền: ${Object.keys(filled).map((k) => COOP_LABEL[k]).join(' | ')}; bỏ trống: ${missingLabel}`);

  // Step 4: chọn ít nhất một mặt hàng kinh doanh
  const goods = coopItem(target, COOP_Q.goods);
  await expect(goods, 'Form phải có câu "Mặt hàng kinh doanh của bạn là gì?"').toBeVisible();
  const option = goods.locator('[role="checkbox"], [role="radio"]').first();
  await option.scrollIntoViewIfNeeded().catch(() => { });
  const optionLabel = (await option.getAttribute('aria-label').catch(() => '')) || (await option.innerText().catch(() => '')) || '(không rõ)';
  await option.click();
  await expect(option, 'Mặt hàng vừa chọn phải được đánh dấu').toHaveAttribute('aria-checked', 'true');
  note(`Đã chọn mặt hàng: "${optionLabel.trim()}"`);
  // Step 5: câu "Link website công ty?" (không bắt buộc) để trống - không thao tác

  // Step 6: bấm Gửi
  const submitBtn = await findCoopSubmit(target);
  await expect(submitBtn, 'Form phải có nút "Gửi"').toBeVisible();
  await submitBtn.scrollIntoViewIfNeeded().catch(() => { });
  await target.screenshot({ path: `test-results/${tag}_truoc_gui.png`, fullPage: true }).catch(() => { });
  await submitBtn.click();
  await target.waitForTimeout(2500);

  // Quan sát sau khi gửi
  const bodyAfter = (await target.locator('body').innerText().catch(() => '')) || '';
  const urlAfter = target.url();
  const missItem = coopItem(target, COOP_Q[missingKey]);
  const missText = ((await missItem.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const alertTexts = (await target.locator('[role="alert"]').allInnerTexts().catch(() => [])).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  note(`Sau khi bấm Gửi: URL ${urlAfter}; câu "${missingLabel}": ${missText.slice(0, 200)}; thông báo (role=alert): ${alertTexts.join(' | ').slice(0, 300) || '(không có)'}`);

  // Expected 1: form không được gửi, không có xác nhận gửi thành công
  const successRe = /câu\s*trả\s*lời\s*của\s*bạn\s*đã\s*được\s*ghi\s*lại|phản\s*hồi\s*của\s*bạn\s*đã\s*được\s*ghi|your\s*response\s*has\s*been\s*recorded|gửi\s*phản\s*hồi\s*khác|submit\s*another\s*response/i;
  check(!successRe.test(bodyAfter), `Thiếu "${missingLabel}" nhưng form báo đã gửi thành công`);
  check(!/formResponse/i.test(urlAfter), `Thiếu "${missingLabel}" nhưng URL chuyển sang trang gửi (formResponse): ${urlAfter}`);
  // Expected 2: báo trường bắt buộc bị bỏ trống và giữ người dùng ở biểu mẫu
  const requiredRe = /câu\s*hỏi\s*bắt\s*buộc|required\s*question|bắt\s*buộc/i;
  check(requiredRe.test(missText) || alertTexts.some((a) => requiredRe.test(a)), `Không thấy báo trường bắt buộc ở câu "${missingLabel}" (nội dung câu: ${missText.slice(0, 120)})`);
  check(await firstItem.isVisible().catch(() => false), 'Sau khi bấm Gửi không còn ở biểu mẫu');
  // Các trường đã điền không bị báo lỗi
  for (const key of Object.keys(filled)) {
    const txt = ((await coopItem(target, COOP_Q[key]).innerText().catch(() => '')) || '');
    check(!/câu\s*hỏi\s*bắt\s*buộc|required\s*question/i.test(txt), `Câu "${COOP_LABEL[key]}" đã điền nhưng vẫn bị báo bắt buộc`);
  }
  // Expected 3: các giá trị đã nhập được giữ lại
  for (const [key, input] of Object.entries(filled)) {
    check((await input.inputValue().catch(() => '')) === COOP_DATA[key], `Giá trị đã nhập ở "${COOP_LABEL[key]}" không được giữ lại sau khi bấm Gửi`);
  }
  check((await option.getAttribute('aria-checked').catch(() => '')) === 'true', `Mặt hàng đã chọn ("${optionLabel.trim()}") không được giữ lại sau khi bấm Gửi`);
  check(!LOOKUP_RE.systemErr.test(bodyAfter.slice(0, 3000)), 'Trang hiện chữ báo lỗi hệ thống/404 sau khi bấm Gửi');

  // (Tùy chọn) Bước tiếp: nhập luôn trường vừa bị báo đỏ rồi bấm Gửi lần 2 -> quan sát form có gửi được không
  if (opts.thenFix) {
    await target.screenshot({ path: `test-results/${tag}_bao_do.png`, fullPage: true }).catch(() => { });
    const missInput = missItem.locator('input:not([type="hidden"]), textarea').first();
    await missInput.scrollIntoViewIfNeeded().catch(() => { });
    await missInput.click();
    await missInput.fill('');
    await missInput.pressSequentially(COOP_DATA[missingKey], { delay: 40 });
    await expect(missInput, `Ô "${missingLabel}" phải giữ đúng giá trị vừa nhập`).toHaveValue(COOP_DATA[missingKey]);
    await missInput.press('Tab').catch(() => { }); // rời ô để Google Form kiểm tra lại
    await target.waitForTimeout(600);
    const missTextFixed = ((await missItem.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    note(`Đã nhập "${COOP_DATA[missingKey]}" vào ô "${missingLabel}"; nội dung câu sau khi nhập: ${missTextFixed.slice(0, 200)}`);
    check(!requiredRe.test(missTextFixed), `Đã nhập "${missingLabel}" nhưng form vẫn báo trường bắt buộc/lỗi đỏ`);

    const submit2 = await findCoopSubmit(target);
    await submit2.scrollIntoViewIfNeeded().catch(() => { });
    await target.screenshot({ path: `test-results/${tag}_truoc_gui_lan2.png`, fullPage: true }).catch(() => { });
    await submit2.click();
    await expect.poll(async () => successRe.test((await target.locator('body').innerText().catch(() => '')) || ''), { timeout: 15_000, intervals: [500] }).toBeTruthy().catch(() => { });
    const body2 = (await target.locator('body').innerText().catch(() => '')) || '';
    const url2 = target.url();
    const ok2 = successRe.test(body2);
    const alerts2 = (await target.locator('[role="alert"]').allInnerTexts().catch(() => [])).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    note(`Gửi lần 2 (đã điền đủ): ${ok2 ? 'GỬI THÀNH CÔNG (có xác nhận đã ghi lại câu trả lời)' : 'CHƯA thấy xác nhận gửi thành công'}; URL: ${url2}; thông báo lỗi: ${alerts2.join(' | ') || '(không có)'}; nội dung: ${body2.replace(/\s+/g, ' ').slice(0, 200)}`);
    check(ok2, 'Đã điền đủ các trường bắt buộc nhưng bấm Gửi lần 2 không thấy xác nhận gửi thành công');
    check(!requiredRe.test(alerts2.join(' ')), 'Gửi lần 2 vẫn còn thông báo trường bắt buộc');
    check(!LOOKUP_RE.systemErr.test(body2.slice(0, 3000)), 'Trang hiện chữ báo lỗi hệ thống/404 sau khi gửi lần 2');
    await target.screenshot({ path: `test-results/${tag}_sau_gui_lan2.png`, fullPage: true }).catch(() => { });
  }

  await target.screenshot({ path: `test-results/${tag}.png`, fullPage: true }).catch(() => { });
  note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : `Thiếu "${missingLabel}": form không gửi, báo trường bắt buộc, giữ người dùng ở biểu mẫu và giữ các giá trị đã nhập (biểu mẫu: ${formUrl})`);
}

// 3. TEST CASE
test.describe('6.7.3 - Chính sách, hướng dẫn và liên hệ góp ý', () => {

  // Policy_Footer_01 - Bố cục footer trên máy tính (laptop Lenovo ThinkBook) - chỉ quan sát, không bấm link
  test('Policy_Footer_01 - Kiểm tra bố cục footer trên máy tính', async ({ page }) => {
    await test.step('Step 1: Truy cập trang chủ', async () => {
      await gotoHome(page);
    });

    await test.step('Step 2: Cuộn xuống footer, quan sát bố cục', async () => {
      await scrollToFooter(page);

      // Expected 1: đủ 3 cột, chữ tiếng Việt có dấu đúng
      const boxes = [];
      for (const name of FOOTER_COLS) {
        const h = colHeading(page, name);
        await h.scrollIntoViewIfNeeded();
        await expect(h, `Footer phải có cột "${name}"`).toBeVisible();
        boxes.push({ name, box: await h.boundingBox() });
      }

      // Các cột xếp cạnh nhau: cùng hàng, khác vị trí ngang
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect.soft(Math.abs(boxes[i].box.y - boxes[j].box.y),
            `"${boxes[i].name}" và "${boxes[j].name}" không cùng hàng trên desktop`).toBeLessThan(40);
          expect.soft(Math.abs(boxes[i].box.x - boxes[j].box.x),
            `"${boxes[i].name}" và "${boxes[j].name}" bị chồng cột`).toBeGreaterThan(50);
        }
      }

      // Expected 2: không vỡ bố cục, không tràn ngang, không lỗi font
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect.soft(overflow, `Desktop bị tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);
      const bodyText = await page.locator('body').innerText();
      expect.soft(bodyText.includes('\uFFFD'), 'Có ký tự lỗi font (�) trên trang').toBeFalsy();

      await page.screenshot({ path: 'test-results/Policy_Footer_01_desktop.png' });
    });
  });

  // Policy_Footer_02 - Nút "Xem thêm"/"Rút gọn" ở cột Thông tin khác (mặc định thu gọn)
  test('Policy_Footer_02 - Kiểm tra nút "Xem thêm"/"Rút gọn" ở cột Thông tin khác', async ({ page }) => {
    await gotoHome(page);
    await scrollToFooter(page);

    const heading = colHeading(page, 'Thông tin khác');
    await heading.scrollIntoViewIfNeeded();
    await expect(heading, 'Phải thấy cột "Thông tin khác"').toBeVisible();

    const column = heading.locator(
      'xpath=ancestor::*[.//a[contains(normalize-space(.),"Tích điểm")]][1]'
    );
    const links = column.getByRole('link');
    const moreBtn = column.getByText(/^\s*Xem thêm\s*$/i).first();
    const lessBtn = column.getByText(/^\s*Rút gọn\s*$/i).first();
    const urlBefore = page.url();

    // Trạng thái ban đầu: thu gọn
    await expect(moreBtn, 'Mặc định phải có nút "Xem thêm"').toBeVisible();
    const countCollapsed = await links.count();
    const policyLink = column.getByRole('link', { name: /Chính sách đổi trả/i }).first();
    await expect(policyLink, 'Khi thu gọn, "Chính sách đổi trả" phải ẩn').toBeHidden();

    // Bấm "Xem thêm" -> mở rộng
    const scrollYBefore = await page.evaluate(() => window.scrollY);
    await moreBtn.click();
    await expect(lessBtn, 'Sau khi mở rộng phải có nút "Rút gọn"').toBeVisible();
    await expect(policyLink, 'Sau khi mở rộng phải thấy "Chính sách đổi trả"').toBeVisible();
    const countExpanded = await links.count();
    expect(countExpanded, 'Mở rộng phải nhiều link hơn').toBeGreaterThan(countCollapsed);

    // Không điều hướng, không nhảy cuộn
    expect(page.url(), 'Bấm nút không được điều hướng').toBe(urlBefore);
    expect.soft(await page.evaluate(() => window.scrollY),
      'Vị trí cuộn bị nhảy').toBeGreaterThan(scrollYBefore * 0.5);

    // Bấm "Rút gọn" -> về trạng thái ban đầu
    await lessBtn.click();
    await expect(moreBtn, 'Sau "Rút gọn" phải đổi lại "Xem thêm"').toBeVisible();
    await expect(policyLink).toBeHidden();
    expect(await links.count(), 'Số link phải về như ban đầu').toBe(countCollapsed);

    // Kết thúc: chụp ảnh trạng thái thu gọn (không bấm vào link nào)
    await page.screenshot({ path: 'test-results/Policy_Footer_02_final.png' });
  });

  // Policy_Page_01 - Nội dung chính sách đổi trả, bảo hành
  test('Policy_Page_01 - Kiểm tra nội dung chính sách đổi trả, bảo hành cho khách hàng DMX', async ({ page }) => {
    // Step 1
    await gotoHome(page);

    // Step 2: Cuộn xuống footer, mục "Thông tin khác" -> mở rộng -> bấm "Chính sách đổi trả"
    await scrollToFooter(page);
    const column = await expandInfoColumn(page);
    const policyLink = column.getByRole('link', { name: /Chính sách đổi trả/i }).first();
    await policyLink.scrollIntoViewIfNeeded();
    await expect(policyLink, 'Footer phải có liên kết "Chính sách đổi trả"').toBeVisible();
    await Promise.all([page.waitForLoadState('domcontentloaded'), policyLink.click()]);
    // Trang chính sách hay bật quảng cáo/tooltip muộn -> đợi rồi đóng 2 lần
    await dismissPopups(page);
    await page.waitForTimeout(1000);
    await dismissPopups(page);

    // Expected 1: Trang Chính sách đổi trả mở được
    await expect(page).not.toHaveURL(BASE_URL + '/');
    await expect(page.locator('body')).not.toContainText(/404|không tìm thấy trang/i);
    await expect(
      page.getByRole('heading', { name: /Chính sách.*đổi trả/i }).first(),
      'Tiêu đề trang phải là "Chính sách bảo hành - đổi trả"'
    ).toBeVisible();

    // Step 3: Đọc nội dung, cuộn hết trang
    await scrollToBottom(page);

    // Expected 2a: Có tiêu đề từng phần
    const headingCount = await page.locator('h1, h2, h3, h4').count();
    expect(headingCount, 'Phải có tiêu đề cho từng phần').toBeGreaterThanOrEqual(2);

    // Expected 2b: Nội dung nêu rõ điều kiện, thời hạn, trường hợp áp dụng
    const bodyText = (await page.locator('body').innerText()).toLowerCase();
    expect(bodyText.length, 'Nội dung trang không được rỗng/quá ngắn').toBeGreaterThan(1000);
    const keywords = {
      'đổi trả': /đổi\s*trả/,
      'bảo hành': /bảo\s*hành/,
      'điều kiện': /điều\s*kiện/,
      'thời hạn': /thời\s*hạn|thời\s*gian|\d+\s*ngày/,
      'trường hợp áp dụng': /trường\s*hợp|áp\s*dụng/,
    };
    for (const [label, regex] of Object.entries(keywords)) {
      expect.soft(regex.test(bodyText), `Nội dung phải đề cập "${label}"`).toBeTruthy();
    }

    // Expected 2c: Hình ảnh tải đủ
    const brokenImages = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main img, article img, .content img'))
        .filter((img) => img.complete && img.naturalWidth === 0 && (img.currentSrc || img.src))
        .map((img) => img.currentSrc || img.src)
    );
    expect.soft(brokenImages, `Có ảnh tải lỗi: ${brokenImages.join(', ')}`).toHaveLength(0);

    // Expected 2d: Chính tả / thiếu đoạn -> đối chiếu thủ công, chụp ảnh làm bằng chứng
    await page.screenshot({ path: 'test-results/Policy_Page_01_full.png', fullPage: true });
  });

  // Policy_Page_02 - Bấm "Chính sách bảo hành" ở footer mở đúng trang tra cứu, thấy danh sách hãng và chọn được hãng realme
  // (chọn hãng realme chỉ để xác nhận danh sách hãng bấm được; kiểm tra sâu từng hãng ở Policy_Warranty_01)
  test('Policy_Page_02 - Kiểm tra bấm "Chính sách bảo hành" ở footer mở đúng trang tra cứu và chọn hãng', async ({ page }) => {
    // Step 1: Truy cập trang chủ
    await gotoHome(page);

    // Step 2: Cuộn xuống footer, mục "Thông tin khác" -> mở rộng -> bấm "Chính sách bảo hành"
    await scrollToFooter(page);
    const column = await expandInfoColumn(page);
    const warrantyLink = column.getByRole('link', { name: /^\s*Chính sách bảo hành\s*$/i }).first();
    await warrantyLink.scrollIntoViewIfNeeded();
    await expect(warrantyLink, 'Footer phải có liên kết "Chính sách bảo hành"').toBeVisible();

    const linkText = (await warrantyLink.innerText()).trim();
    const linkHref = await warrantyLink.getAttribute('href');
    note(`Bấm link: "${linkText}" -> ${linkHref}`);

    await Promise.all([page.waitForLoadState('domcontentloaded'), warrantyLink.click()]);
    // Trang hay bật quảng cáo/tooltip muộn -> đợi rồi đóng 2 lần
    await dismissPopups(page);
    await page.waitForTimeout(1000);
    await dismissPopups(page);

    // Step 3 + Expected 1: mở đúng trang Chính sách bảo hành, tiêu đề đúng tên liên kết, không 404
    await expect(page, 'Phải chuyển sang trang khác trang chủ').not.toHaveURL(BASE_URL + '/');
    await expect(page.locator('body')).not.toContainText(/404|không tìm thấy trang/i);
    await expect(
      page.getByRole('heading', { name: /bảo hành/i }).first(),
      'Tiêu đề trang phải chứa "bảo hành"'
    ).toBeVisible();
    // Link footer "Chính sách bảo hành" mở trang /bao-hanh có tiêu đề "Trung tâm bảo hành sản phẩm ..."
    // -> chấp nhận tiêu đề (tab hoặc heading) chứa "Trung tâm bảo hành" hoặc "Chính sách bảo hành"
    await expect(page, 'URL phải là trang bảo hành (/bao-hanh)').toHaveURL(/\/bao-hanh/i);
    const titleRe = /(Trung tâm|Chính sách)\s*bảo hành/i;
    const pageTitle = await page.title();
    const headingHit = await page.getByRole('heading', { name: titleRe }).count();
    note(`Tiêu đề tab: "${pageTitle}"; số heading khớp: ${headingHit}`);
    expect.soft(titleRe.test(pageTitle) || headingHit > 0,
      'Tiêu đề trang phải là "Trung tâm bảo hành" hoặc "Chính sách bảo hành"').toBeTruthy();

    // Expected 2a: có ô tra cứu thông tin bảo hành (ô "Mời nhập số điện thoại hoặc IMEI để tra cứu")
    const lookupBox = page.getByPlaceholder(/số điện thoại|imei|tra cứu/i).first();
    await lookupBox.scrollIntoViewIfNeeded().catch(() => { });
    expect.soft(await lookupBox.isVisible().catch(() => false),
      'Trang phải có ô tra cứu thông tin bảo hành').toBeTruthy();

    // Expected 2b: có mục "Chọn Hãng Cần Tìm Điểm Bảo Hành" với danh sách hãng (logo + tên hãng)
    const brandHeading = page.getByText(/Chọn Hãng Cần Tìm Điểm Bảo Hành/i).first();
    await brandHeading.scrollIntoViewIfNeeded();
    await expect(brandHeading, 'Trang phải có mục "Chọn Hãng Cần Tìm Điểm Bảo Hành"').toBeVisible();

    // Logo hãng tải lười (lazy-load) -> đếm theo TÊN hãng hiển thị dưới logo, không đếm thẻ <img>
    const knownBrands = ['OPPO', 'Motorola', 'Realme', 'Royal', 'GIGABYTE', 'Microlab', 'CHUWI', 'ViVo'];
    let visibleBrands = 0;
    for (const b of knownBrands) {
      const el = page.getByText(new RegExp(`^\\s*${b}\\s*$`, 'i')).first();
      if (await el.isVisible().catch(() => false)) visibleBrands++;
    }
    note(`Số hãng thấy được trong danh sách mẫu: ${visibleBrands}/${knownBrands.length}`);
    expect.soft(visibleBrands, 'Danh sách hãng phải hiển thị >= 3 hãng').toBeGreaterThanOrEqual(3);

    // Step 4: Chọn hãng "realme" - CHỈ bấm ô realme nằm trong lưới hãng, ngay dưới thanh tìm kiếm
    // "Mời nhập tên hãng đã tìm" (ô logo realme + chữ "Realme", link /bao-hanh/realme).
    // Giới hạn trong khối chứa ô tìm hãng để không bấm nhầm chữ/link "realme" ở chỗ khác trên trang.
    const brandBlock = page
      .getByPlaceholder(/nhập tên hãng/i)
      .locator('xpath=ancestor::*[.//a[contains(@href,"/bao-hanh/realme")]][1]');
    const realmeTile = brandBlock
      .locator('a[href*="/bao-hanh/realme"]')
      .filter({ hasText: /^\s*realme\s*$/i })
      .first();
    await expect(realmeTile, 'Lưới hãng (dưới thanh tìm kiếm) phải có ô "Realme"').toHaveCount(1);
    await realmeTile.evaluate((el) => el.scrollIntoView({ block: 'center' })); // tránh bị header dính che
    await dismissPopups(page);
    await expect(realmeTile, 'Ô "Realme" phải hiển thị').toBeVisible();
    note(`Ô realme: href=${await realmeTile.getAttribute('href')}`);

    const urlBeforeBrand = page.url();
    const textBeforeBrand = (await page.locator('body').innerText()).length;
    // Bấm hãng có thể mở cùng tab hoặc tab mới -> bắt cả hai trường hợp
    const newTabPromise = page.context().waitForEvent('page', { timeout: 1500 }).catch(() => null);
    await realmeTile.click();
    const newTab = await newTabPromise;
    const target = newTab || page;
    await target.waitForLoadState('domcontentloaded').catch(() => { });
    await target.waitForTimeout(1000);
    await dismissPopups(target);
    note(`Đã chọn realme -> ${target.url()}${newTab ? ' (mở tab mới)' : ''}`);

    // Expected 3 (URL phải là /bao-hanh/realme): chọn realme có phản hồi đúng hãng (URL đổi sang realme, hoặc nội dung trang đổi theo realme), không 404
    await expect(target, 'URL phải chuyển sang trang hãng realme').toHaveURL(/\/bao-hanh\/realme/i);
    await expect(target.locator('body')).not.toContainText(/404|không tìm thấy trang/i);
    await expect.poll(async () => {
      const urlOk = /realme/i.test(target.url()) && target.url() !== urlBeforeBrand;
      const bodyText = await target.locator('body').innerText().catch(() => '');
      const contentOk = /realme/i.test(bodyText) && (newTab || bodyText.length !== textBeforeBrand);
      return urlOk || contentOk;
    }, {
      message: 'Sau khi chọn "realme" trang phải chuyển/hiển thị đúng hãng realme',
      timeout: 10_000,
    }).toBeTruthy();

    // Bằng chứng
    await target.screenshot({ path: 'test-results/Policy_Page_02.png', fullPage: true });
  });

  // Policy_Page_03 - Bấm "Chính sách đổi trả" ở footer mở đúng trang (chỉ kiểm tra điều hướng, không đọc nội dung - nội dung ở Policy_Page_01)
  test('Policy_Page_03 - Kiểm tra bấm "Chính sách đổi trả" ở footer mở đúng trang', async ({ page }) => {
    // Step 1: Truy cập trang chủ
    await gotoHome(page);

    // Step 2: Cuộn xuống footer, mục "Thông tin khác" -> mở rộng -> bấm "Chính sách đổi trả"
    await scrollToFooter(page);
    const column = await expandInfoColumn(page);
    const returnLink = column.getByRole('link', { name: /^\s*Chính sách đổi trả\s*$/i }).first();
    await returnLink.scrollIntoViewIfNeeded();
    await expect(returnLink, 'Footer phải có liên kết "Chính sách đổi trả"').toBeVisible();

    const linkText = (await returnLink.innerText()).trim();
    const linkHref = await returnLink.getAttribute('href');
    note(`Bấm link: "${linkText}" -> ${linkHref}`);

    await Promise.all([page.waitForLoadState('domcontentloaded'), returnLink.click()]);
    // Trang hay bật quảng cáo/tooltip muộn -> đợi rồi đóng 2 lần
    await dismissPopups(page);
    await page.waitForTimeout(1000);
    await dismissPopups(page);

    // Expected 1: mở đúng trang Chính sách đổi trả, tiêu đề chứa tên liên kết, không lỗi 404
    await expect(page, 'Phải chuyển sang trang khác trang chủ').not.toHaveURL(BASE_URL + '/');
    // Link footer có thể được site chuyển hướng sang URL khác (vd /bao-hanh-doi-tra -> /chinh-sach-bao-hanh-san-pham)
    // -> không đòi URL trùng href, chỉ ghi lại để đối chiếu; nội dung đúng trang được kiểm tra bằng tiêu đề bên dưới
    note(`URL sau khi bấm: ${page.url()} (href ban đầu: ${linkHref})`);
    await expect(page.locator('body')).not.toContainText(/404|không tìm thấy trang/i);
    // Tiêu đề thực tế: "Chính sách bảo hành - đổi trả" (chứa tên liên kết "Chính sách đổi trả")
    await expect(
      page.getByRole('heading', { name: /Chính sách.*đổi trả/i }).first(),
      'Tiêu đề trang phải chứa "Chính sách ... đổi trả"'
    ).toBeVisible();

    // Expected 2: trang hiển thị bình thường, không trắng trang, không tự quay về trang chủ
    const bodyLen = (await page.locator('body').innerText()).trim().length;
    expect(bodyLen, 'Trang không được trắng/quá ít nội dung').toBeGreaterThan(300);
    const urlAfterClick = page.url();
    await page.waitForTimeout(1500); // đợi xem có bị tự chuyển hướng về trang chủ không
    expect(page.url(), 'Trang không được tự quay về trang chủ/chuyển hướng ngoài ý muốn').toBe(urlAfterClick);
    expect.soft(await page.locator('body').innerText().then((t) => t.includes('\uFFFD')),
      'Có ký tự lỗi font (�) trên trang').toBeFalsy();

    // Bằng chứng
    await page.screenshot({ path: 'test-results/Policy_Page_03.png' });
  });

  // Policy_Page_04 - Bấm "Hướng dẫn mua hàng online" ở footer: hiển thị đủ các bước đặt hàng và hình thức thanh toán
  test('Policy_Page_04 - Kiểm tra bấm "Hướng dẫn mua hàng online" hiển thị đủ các bước đặt hàng và hình thức thanh toán', async ({ page }) => {
    // Step 1: Truy cập trang chủ
    await gotoHome(page);

    // Step 2: Cuộn xuống footer, mục "Thông tin khác" -> mở rộng -> bấm "Hướng dẫn mua hàng online"
    await scrollToFooter(page);
    const column = await expandInfoColumn(page);
    const guideLink = column.getByRole('link', { name: /Hướng dẫn mua.*online/i }).first();
    await guideLink.scrollIntoViewIfNeeded();
    await expect(guideLink, 'Footer phải có liên kết "Hướng dẫn mua hàng online"').toBeVisible();

    const linkText = (await guideLink.innerText()).trim();
    const linkHref = await guideLink.getAttribute('href');
    note(`Bấm link: "${linkText}" -> ${linkHref}`);

    await Promise.all([page.waitForLoadState('domcontentloaded'), guideLink.click()]);
    // Trang hay bật quảng cáo/tooltip muộn -> đợi rồi đóng 2 lần
    await dismissPopups(page);
    await page.waitForTimeout(1000);
    await dismissPopups(page);
    note(`URL sau khi bấm: ${page.url()} (href ban đầu: ${linkHref})`);

    // Expected 1: mở đúng trang Hướng dẫn mua hàng online, không lỗi 404
    await expect(page, 'Phải chuyển sang trang khác trang chủ').not.toHaveURL(BASE_URL + '/');
    await expect(page.locator('body')).not.toContainText(/404|không tìm thấy trang/i);
    // Trang thật: /huong-dan-mua-hang, tab "Hướng dẫn mua hàng trực tuyến...", h1 "Cách thức mua hàng trên website..."
    await expect(page, 'URL phải là trang hướng dẫn mua hàng').toHaveURL(/huong-dan-mua-hang/i);
    const guideRe = /Hướng dẫn mua hàng|Cách thức mua hàng/i;
    const pageTitle = await page.title();
    const h1Text = (await page.locator('h1').first().innerText().catch(() => '')).trim();
    note(`Tiêu đề tab: "${pageTitle}"; h1: "${h1Text}"`);
    expect(guideRe.test(pageTitle) || guideRe.test(h1Text),
      'Tiêu đề trang (tab hoặc h1) phải nói về hướng dẫn mua hàng').toBeTruthy();

    // Step 3: Đọc nội dung trang.
    // KHÔNG cuộn bằng Playwright ở test này: trang /huong-dan-mua-hang bị đơ ở lệnh cuộn đầu tiên khi chạy tự động
    // (cuộn tay vẫn bình thường). Nội dung chữ đọc từ DOM; việc cuộn hết trang xem ảnh làm thủ công.

    // Expected 2a: nội dung có đủ phần các bước đặt hàng
    // Chỉ xét phần bài viết (khối chứa h1 + "Bước 1"), KHÔNG tính menu bên phải (menu có sẵn chữ "Hình thức thanh toán")
    const articleText = await page.evaluate(() => {
      let el = document.querySelector('h1');
      while (el && el !== document.body && !/Bước\s*1/i.test(el.innerText)) el = el.parentElement;
      return (el && el !== document.body ? el : document.body).innerText;
    });
    const bodyText = articleText.toLowerCase();
    note(`Độ dài phần bài viết: ${bodyText.length} ký tự`);
    expect(bodyText.length, 'Nội dung bài viết không được rỗng/quá ngắn').toBeGreaterThan(1000);
    const keywords = {
      'các bước đặt hàng': /bước\s*1|bước\s*2|đặt\s*hàng/,
      'hình thức thanh toán': /thanh\s*toán/,
      'thanh toán khi nhận hàng (COD)': /nhận\s*hàng|cod/,
      'thanh toán online (thẻ/ví/chuyển khoản)': /thẻ|ví\s|chuyển\s*khoản|qr|momo|zalopay|vnpay/,
    };
    for (const [label, regex] of Object.entries(keywords)) {
      expect.soft(regex.test(bodyText), `Nội dung phải đề cập "${label}"`).toBeTruthy();
    }

    // Expected 2b: có tiêu đề từng phần
    const headingCount = await page.locator('h1, h2, h3, h4').count();
    expect.soft(headingCount, 'Phải có tiêu đề cho từng phần').toBeGreaterThanOrEqual(2);

    // Expected 2c: hình minh họa đã tải mà bị lỗi (ảnh lazy-load chưa cuộn tới thì chưa được kiểm tra)
    const brokenImages = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main img, article img, .content img'))
        .filter((img) => img.complete && img.naturalWidth === 0 && (img.currentSrc || img.src))
        .map((img) => img.currentSrc || img.src)
    );
    expect.soft(brokenImages, `Có ảnh tải lỗi: ${brokenImages.join(', ')}`).toHaveLength(0);

    // Expected 2d: không vỡ bố cục, không lỗi font
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect.soft(overflow, `Bị tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);
    expect.soft((await page.locator('body').innerText()).includes('\uFFFD'), 'Có ký tự lỗi font (�) trên trang').toBeFalsy();

    // Bằng chứng (đọc đối chiếu thủ công: đủ bước, đủ hình thức thanh toán)
    await page.screenshot({ path: 'test-results/Policy_Page_04_full.png', fullPage: true });
  });

  // Policy_Page_05 - Bấm "In hóa đơn điện tử" ở footer: mở đúng form và đủ các trường nhập (bước nhập dữ liệu: SĐT hợp lệ + mã không hợp lệ, KHÔNG tạo/in hóa đơn thật)
  // Danh sách trường thực tế chưa xác nhận trước -> script ghi lại từng trường (nhãn/placeholder) vào annotation "note"
  // để đối chiếu và cập nhật Expected Output trong Excel.
  test('Policy_Page_05 - Kiểm tra bấm "In hóa đơn điện tử" mở đúng form và đủ các trường nhập', async ({ page }) => {
    // Step 1: Truy cập trang chủ
    await gotoHome(page);

    // Step 2: Cuộn xuống footer, mục "Thông tin khác" -> mở rộng -> bấm "In hóa đơn điện tử"
    await scrollToFooter(page);
    const column = await expandInfoColumn(page);
    const invoiceLink = column.getByRole('link', { name: /In\s*hóa\s*đơn(\s*điện\s*tử)?/i }).first();
    await invoiceLink.scrollIntoViewIfNeeded();
    await expect(invoiceLink, 'Footer phải có liên kết "In hóa đơn điện tử"').toBeVisible();

    const linkText = (await invoiceLink.innerText()).trim();
    const linkHref = await invoiceLink.getAttribute('href');
    note(`Bấm link: "${linkText}" -> ${linkHref}`);

    // Liên kết có thể mở cùng tab hoặc tab mới -> bắt cả hai trường hợp
    const newTabPromise = page.context().waitForEvent('page', { timeout: 3000 }).catch(() => null);
    await invoiceLink.click();
    const newTab = await newTabPromise;
    const target = newTab || page;
    await target.waitForLoadState('domcontentloaded').catch(() => { });
    await target.waitForTimeout(1500);
    await dismissPopups(target);
    await target.waitForTimeout(800);
    await dismissPopups(target);
    note(`URL sau khi bấm: ${target.url()}${newTab ? ' (mở tab mới)' : ''} (href ban đầu: ${linkHref})`);

    // Expected 1: mở đúng trang/form In hóa đơn điện tử, không lỗi 404
    await expect(target, 'Phải chuyển sang trang khác trang chủ').not.toHaveURL(BASE_URL + '/');
    await expect(target.locator('body')).not.toContainText(/404|không tìm thấy trang/i);
    const pageTitle = await target.title();
    note(`Tiêu đề tab: "${pageTitle}"`);
    const invoiceRe = /hóa\s*đơn/i;
    const headingHit = await target.getByRole('heading', { name: invoiceRe }).count();
    expect.soft(invoiceRe.test(pageTitle) || headingHit > 0,
      'Tiêu đề trang (tab hoặc heading) phải nói về hóa đơn').toBeTruthy();

    // Expected 2a: form hiển thị đủ các trường nhập -> ghi lại từng trường thực tế
    const inputs = target.locator(
      'input:visible:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea:visible, select:visible'
    );
    await expect(inputs.first(), 'Trang phải có ít nhất 1 ô nhập của form').toBeVisible({ timeout: 10_000 });
    const fieldCount = await inputs.count();
    const fields = [];
    const fieldInfos = [];
    for (let i = 0; i < fieldCount; i++) {
      const el = inputs.nth(i);
      const placeholder = (await el.getAttribute('placeholder').catch(() => '')) || '';
      const name = (await el.getAttribute('name').catch(() => '')) || '';
      const ariaLabel = (await el.getAttribute('aria-label').catch(() => '')) || '';
      const id = await el.getAttribute('id').catch(() => null);
      let label = '';
      if (id) label = ((await target.locator(`label[for="${id}"]`).first().innerText({ timeout: 500 }).catch(() => '')) || '').trim();
      const display = label || placeholder || ariaLabel || name || '(không có nhãn)';
      fields.push(display);
      fieldInfos.push({ el, name, text: `${label} ${placeholder} ${ariaLabel} ${name}` });
      if (/captcha/i.test(name) && !(label || placeholder || ariaLabel)) {
        // Ô nhập mã Captcha nhận biết qua ảnh mã bên cạnh nên không bắt buộc có nhãn/placeholder -> chỉ ghi nhận
        note(`Trường #${i + 1} (name="${name}") là ô Captcha, không có nhãn/placeholder (nhận biết qua ảnh mã)`);
        continue;
      }
      expect.soft(label || placeholder || ariaLabel,
        `Trường #${i + 1} (name="${name}") phải có nhãn hoặc placeholder`).toBeTruthy();
    }
    note(`Số trường nhập thấy được: ${fieldCount} -> ${fields.join(' | ')}`);
    expect.soft(fieldCount, 'Form phải có từ 2 trường nhập trở lên').toBeGreaterThanOrEqual(2);

    // Expected 2b: có nút thực hiện (tra cứu/in/gửi...) hiển thị rõ
    const actionBtn = target.locator('button:visible, input[type="submit"]:visible, a[role="button"]:visible')
      .filter({ hasText: /tra\s*cứu|in\s*hóa\s*đơn|xuất|tìm|gửi|xác\s*nhận|tiếp\s*tục|lấy\s*hóa\s*đơn/i }).first();
    const hasActionBtn = await actionBtn.isVisible().catch(() => false);
    if (hasActionBtn) note(`Nút thực hiện: "${(await actionBtn.innerText()).trim()}"`);
    expect.soft(hasActionBtn, 'Form phải có nút thực hiện (tra cứu/in/gửi) hiển thị rõ').toBeTruthy();

    // Expected 2c: nhãn tiếng Việt có dấu đúng, không lỗi font
    const text = await target.locator('body').innerText();
    expect.soft(text.includes('\uFFFD'), 'Có ký tự lỗi font (�) trên trang').toBeFalsy();

    // Step 3: Nhập SĐT hợp lệ + mã không hợp lệ, rồi tra cứu (dữ liệu thử nghiệm của tester, KHÔNG tạo/in hóa đơn thật)
    // Ô SĐT/ô mã được tìm theo nhãn/placeholder/name; nếu không nhận ra thì lấy theo thứ tự (trừ ô Captcha).
    // Captcha không tự giải được, có 2 chế độ:
    //  - MANUAL_CAPTCHA=1: script điền sẵn SĐT + số hóa đơn, tester TỰ GÕ mã xác nhận và TỰ BẤM [TRA CỨU HÓA ĐƠN] ngay trong
    //    cửa sổ trình duyệt do Playwright mở (Captcha đổi theo từng phiên nên không gõ ở trình duyệt khác được).
    //    Script chờ tối đa 5 phút cho đến khi có phản hồi rồi mới kiểm tra, không cần Inspector/Resume.
    //  - Không đặt biến: để trống Captcha, script tự bấm và chỉ kiểm tra site có phản hồi yêu cầu nhập mã.
    const MANUAL = process.env.MANUAL_CAPTCHA === '1';
    if (MANUAL) test.setTimeout(0); // không giới hạn giờ trong lúc tester nhập Captcha
    const VALID_PHONE = '0985098199';
    const INVALID_CODE = '#00664SH26060903504';
    const nonCaptcha = fieldInfos.filter((f) => !/captcha/i.test(f.name));
    const phoneField = nonCaptcha.find((f) => /điện\s*thoại|sđt|phone|mobile|tel/i.test(f.text)) || nonCaptcha[0];
    const codeField = nonCaptcha.find((f) => f !== phoneField && /mã|đơn|order|code|hóa\s*đơn|invoice/i.test(f.text))
      || nonCaptcha.find((f) => f !== phoneField);
    const captchaField = fieldInfos.find((f) => /captcha/i.test(f.name))
      || fieldInfos.find((f) => f !== phoneField && f !== codeField);
    note(`Ô SĐT: ${phoneField ? phoneField.text.trim() : 'không tìm thấy'}; ô mã: ${codeField ? codeField.text.trim() : 'không tìm thấy'}`);
    expect.soft(phoneField && codeField, 'Phải tìm được ô nhập SĐT và ô nhập mã để thực hiện bước nhập dữ liệu').toBeTruthy();

    if (phoneField && codeField && hasActionBtn) {
      // Site có thể báo lỗi Captcha bằng hộp thoại alert (không nằm trong body) -> phải bắt lại, nếu không sẽ tưởng "im lặng"
      const dialogs = [];
      target.on('dialog', async (d) => {
        dialogs.push(d.message());
        await d.dismiss().catch(() => { });
      });

      await phoneField.el.fill(VALID_PHONE);
      await codeField.el.fill(INVALID_CODE);
      await expect(phoneField.el, 'Ô SĐT phải giữ giá trị đã nhập').toHaveValue(VALID_PHONE);
      await expect(codeField.el, 'Ô mã phải giữ giá trị đã nhập').toHaveValue(INVALID_CODE);

      // Chụp nội dung TRƯỚC khi tra cứu (lúc chưa có thông báo kết quả) để so sánh đúng
      const linesBefore = new Set((await target.locator('body').innerText()).split('\n').map((l) => l.trim()));
      const urlBeforeSubmit = target.url();
      const readNewLines = async () => {
        const t = (await target.locator('body').innerText().catch(() => '')) || '';
        return { text: t, lines: t.split('\n').map((l) => l.trim()).filter((l) => l && l.length < 250 && !linesBefore.has(l)) };
      };

      if (MANUAL) {
        if (captchaField) await captchaField.el.focus().catch(() => { });
        console.log('\n>>> NHẬP TAY: trong cửa sổ trình duyệt này hãy gõ mã xác nhận rồi bấm [TRA CỨU HÓA ĐƠN] (script chờ tối đa 5 phút).\n');
        note('Chế độ MANUAL_CAPTCHA: tester tự gõ mã xác nhận và tự bấm [TRA CỨU HÓA ĐƠN]');
      } else {
        // Bấm đúng nút "TRA CỨU HÓA ĐƠN" (nếu không có nút tên đúng như vậy thì dùng nút thực hiện tìm được ở trên)
        const searchBtn = target.locator('button:visible, input[type="submit"]:visible, input[type="button"]:visible, a[role="button"]:visible')
          .filter({ hasText: /^\s*tra\s*cứu(\s*hóa\s*đơn)?\s*$/i }).first();
        const submitBtn = (await searchBtn.isVisible().catch(() => false)) ? searchBtn : actionBtn;
        note(`Bấm nút: "${((await submitBtn.innerText().catch(() => '')) || (await submitBtn.getAttribute('value').catch(() => '')) || '').trim()}"`);
        await submitBtn.click();
      }

      // Chờ phản hồi bằng polling (thay cho waitForTimeout cố định): nội dung mới, hộp thoại alert hoặc đổi URL
      try {
        await expect.poll(async () => {
          const { lines } = await readNewLines();
          return lines.length + dialogs.length + (target.url() !== urlBeforeSubmit ? 1 : 0);
        }, { timeout: MANUAL ? 300_000 : 10_000, intervals: [500, 1000] }).toBeGreaterThan(0);
      } catch { /* không có phản hồi -> expect.soft bên dưới sẽ báo lỗi */ }
      await dismissPopups(target);

      // Step 4 / Expected 3: không tra cứu/in được hóa đơn với mã sai; có thông báo tiếng Việt rõ ràng, không lỗi hệ thống
      const { text: afterText, lines: newLines } = await readNewLines();
      const feedback = [...newLines, ...dialogs.map((m) => `[alert] ${m}`)].join(' | ');
      note(`URL sau khi tra cứu: ${target.url()} (trước: ${urlBeforeSubmit})`);
      note(`Nội dung mới xuất hiện sau khi tra cứu: ${feedback || '(không có)'}`);
      if (dialogs.length) note(`Hộp thoại alert của site: ${dialogs.join(' | ')}`);
      expect.soft(feedback.length > 0 || target.url() !== urlBeforeSubmit,
        'Tra cứu phải có phản hồi (thông báo lỗi, hộp thoại hoặc chuyển trang), không im lặng').toBeTruthy();
      expect.soft(/không\s*hợp\s*lệ|không\s*tìm\s*thấy|không\s*tồn\s*tại|không\s*đúng|sai\s*mã|bắt\s*buộc|nhập\s*mã\s*xác\s*nhận/i
        .test(feedback), 'Phải hiển thị thông báo lỗi bằng tiếng Việt (mã không hợp lệ/không tìm thấy hoặc yêu cầu Captcha)').toBeTruthy();
      if (MANUAL) {
        // Thông báo thật (đã quan sát): "Không tìm thấy thông tin hóa đơn theo số hóa đơn <mã>, số điện thoại <SĐT>"
        // Nếu fail ở đây, xem annotation "Nội dung mới xuất hiện" / "Hộp thoại alert": nhiều khả năng gõ sai mã xác nhận.
        expect.soft(/không\s*tìm\s*thấy\s*thông\s*tin\s*hóa\s*đơn/i.test(afterText),
          'Phải báo "Không tìm thấy thông tin hóa đơn" khi mã hóa đơn không tồn tại').toBeTruthy();
        expect.soft(afterText.includes(INVALID_CODE) && afterText.includes(VALID_PHONE),
          'Thông báo phải nêu đúng số hóa đơn và số điện thoại đã nhập').toBeTruthy();
      } else {
        note('Không bật MANUAL_CAPTCHA: chỉ kiểm tra site phản hồi khi để trống Captcha; thông báo "Không tìm thấy thông tin hóa đơn" cần chạy với MANUAL_CAPTCHA=1');
      }
      expect.soft(/internal server error|lỗi\s*hệ\s*thống|something went wrong|\b500\b/i.test(afterText),
        'Không được báo lỗi hệ thống').toBeFalsy();
      expect.soft(afterText.includes('\uFFFD'), 'Có ký tự lỗi font (�) sau khi tra cứu').toBeFalsy();
      await target.screenshot({ path: 'test-results/Policy_Page_05_after_submit.png', fullPage: true }).catch(() => { });
    }


    // Bằng chứng (đối chiếu thủ công danh sách trường với yêu cầu)
    await target.screenshot({ path: 'test-results/Policy_Page_05.png', fullPage: true }).catch(() => { });
  });

  // Policy_Page_06 - Điều hướng 9 trang văn bản tĩnh ở footer "Thông tin khác" (gộp 1 test case, mỗi liên kết là 1 dòng dữ liệu)
  // Mỗi liên kết: mở đúng trang, tiêu đề đúng tên liên kết, không 404, nội dung hiển thị, không vỡ bố cục -> rồi quay về trang chủ.
  // Lỗi của từng liên kết được gom lại (expect.soft) để một liên kết lỗi không che các liên kết sau; cuối test ghi tổng hợp vào note.
  test('Policy_Page_06 - Kiểm tra điều hướng các trang văn bản tĩnh ở footer', async ({ page }) => {
    test.setTimeout(360_000); // 9 liên kết x (tải trang + đóng quảng cáo) > 120s mặc định

    const STATIC_LINKS = [
      { name: 'Giao hàng, lắp đặt', link: /Giao\s*hàng.*lắp\s*đặt/i, title: /giao\s*hàng|lắp\s*đặt/i },
      { name: 'Phiếu mua hàng', link: /Phiếu\s*mua\s*hàng/i, title: /phiếu\s*mua\s*hàng/i },
      { name: 'Quy chế hoạt động', link: /^\s*Quy\s*chế\s*hoạt\s*động\s*$/i, title: /quy\s*chế/i },
      { name: 'Quy chế hoạt động sàn TMĐT DMX', link: /Quy\s*chế.*sàn\s*TMĐT/i, title: /quy\s*chế|sàn|tmđt/i },
      { name: 'Chính sách xử lý dữ liệu cá nhân', link: /xử\s*lý\s*dữ\s*liệu\s*cá\s*nhân/i, title: /dữ\s*liệu\s*cá\s*nhân|xử\s*lý\s*dữ\s*liệu|bảo\s*vệ/i },
      { name: 'Nội quy cửa hàng', link: /Nội\s*quy\s*cửa\s*hàng/i, title: /nội\s*quy/i },
      { name: 'Chất lượng phục vụ', link: /Chất\s*lượng\s*phục\s*vụ/i, title: /chất\s*lượng/i },
      { name: 'Cảnh báo giả mạo', link: /Cảnh\s*báo\s*giả\s*mạo/i, title: /cảnh\s*báo|giả\s*mạo/i },
      { name: 'Chính sách khui hộp sản phẩm Apple', link: /khui\s*hộp.*Apple|Apple.*khui\s*hộp/i, title: /khui\s*hộp|apple/i },
    ];
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };

    // Step 1: Truy cập trang chủ
    await gotoHome(page);

    for (const [i, item] of STATIC_LINKS.entries()) {
      await test.step(`Liên kết ${i + 1}/${STATIC_LINKS.length}: ${item.name}`, async () => {
        // Quay lại trang chủ cho mỗi liên kết (từ liên kết thứ 2 trở đi)
        if (i > 0) {
          await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
          await dismissPopups(page);
        }

        // Step 2: Cuộn xuống footer, mục "Thông tin khác" -> mở rộng -> tìm liên kết
        await scrollToFooter(page);
        const column = await expandInfoColumn(page);
        const link = column.getByRole('link', { name: item.link }).first();
        if (!(await link.count())) {
          check(false, `[${item.name}] Footer không có liên kết này`);
          return;
        }
        await link.scrollIntoViewIfNeeded();
        const linkText = (await link.innerText().catch(() => '')).trim();
        const linkHref = await link.getAttribute('href').catch(() => null);
        note(`[${i + 1}] Bấm "${linkText}" -> ${linkHref}`);

        // Liên kết có thể mở cùng tab hoặc tab mới -> bắt cả hai trường hợp
        const newTabPromise = page.context().waitForEvent('page', { timeout: 3000 }).catch(() => null);
        await link.click();
        const newTab = await newTabPromise;
        const target = newTab || page;
        await target.waitForLoadState('domcontentloaded').catch(() => { });
        await target.waitForTimeout(1000);
        await dismissPopups(target);

        // Step 3 + Expected 1: mở đúng trang, tiêu đề đúng tên liên kết, không lỗi 404
        const url = target.url();
        const pageTitle = await target.title().catch(() => '');
        const headings = (await target.locator('h1, h2').allInnerTexts().catch(() => [])).join(' | ');
        note(`[${i + 1}] URL: ${url}${newTab ? ' (tab mới)' : ''}; tab: "${pageTitle}"; heading: "${headings.slice(0, 120)}"`);
        check(url !== BASE_URL + '/' && url !== BASE_URL, `[${item.name}] Không chuyển khỏi trang chủ (${url})`);
        const bodyText = (await target.locator('body').innerText().catch(() => '')) || '';
        check(!/\b404\b|không\s*tìm\s*thấy\s*trang|page\s*not\s*found/i.test(bodyText.slice(0, 1500)),
          `[${item.name}] Trang báo lỗi 404/không tìm thấy (${url})`);
        check(item.title.test(pageTitle) || item.title.test(headings),
          `[${item.name}] Tiêu đề (tab: "${pageTitle}"; heading: "${headings.slice(0, 80)}") không khớp tên liên kết; URL: ${url}; phần đầu nội dung ${item.title.test(bodyText.slice(0, 3000)) ? 'CÓ' : 'KHÔNG'} nhắc tên liên kết`);

        // Expected 2: nội dung văn bản hiển thị đầy đủ, không vỡ bố cục
        check(bodyText.trim().length > 300, `[${item.name}] Nội dung quá ít/trang trắng (${bodyText.trim().length} ký tự)`);
        const overflow = await evalWithTimeout(target, () => document.documentElement.scrollWidth - window.innerWidth, 0, 5000);
        check(overflow <= 1, `[${item.name}] Bị tràn ngang ${overflow}px`);
        check(!bodyText.includes('\uFFFD'), `[${item.name}] Có ký tự lỗi font (�)`);

        // Bằng chứng từng trang (đọc đối chiếu thủ công nội dung văn bản)
        await target.screenshot({ path: `test-results/Policy_Page_06_${i + 1}.png`, fullPage: true }).catch(() => { });

        // Đóng tab mới (nếu có) để quay về trang chủ ở tab gốc
        if (newTab) await newTab.close().catch(() => { });
      });
    }

    // Tổng hợp: liên kết nào lỗi thì ghi vào cột Note của Excel
    note(failures.length
      ? `Liên kết lỗi (${failures.length}): ${failures.join(' || ')}`
      : `Cả ${STATIC_LINKS.length}/${STATIC_LINKS.length} liên kết đều mở đúng trang, không lỗi`);
  });

  // Policy_Warranty_01 - Chọn hãng JBL ở trang bảo hành, vào chính sách bảo hành của hãng và "Trung tâm bảo hành"
  // Lỗi từng bước được gom lại (expect.soft) để bước sau vẫn được kiểm tra, cuối test ghi tổng hợp vào note.
  test('Policy_Warranty_01 - Kiểm tra chọn hãng JBL, vào trung tâm bảo hành và chính sách bảo hành của hãng', async ({ page }) => {
    test.setTimeout(300_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };

    // Bấm một phần tử, bắt cả trường hợp mở cùng tab hoặc tab mới
    const clickGetTarget = async (locator) => {
      const newTabPromise = page.context().waitForEvent('page', { timeout: 2000 }).catch(() => null);
      await locator.click();
      const newTab = await newTabPromise;
      const target = newTab || page;
      await target.waitForLoadState('domcontentloaded').catch(() => { });
      await target.waitForTimeout(1000);
      await dismissPopups(target);
      return { target, newTab };
    };
    const headingsOf = async (t) => (await t.locator('h1, h2, h3').allInnerTexts().catch(() => [])).join(' | ');
    const bodyOf = async (t) => (await t.locator('body').innerText().catch(() => '')) || '';
    const is404 = (txt) => /\b404\b|không\s*tìm\s*thấy\s*trang|page\s*not\s*found/i.test(txt.slice(0, 1500));

    // Step 1 + 2: trang chủ -> footer -> "Chính sách bảo hành" (trang chọn hãng)
    await gotoHome(page);
    await scrollToFooter(page);
    const column = await expandInfoColumn(page);
    const warrantyLink = column.getByRole('link', { name: /^\s*Chính sách bảo hành\s*$/i }).first();
    await warrantyLink.scrollIntoViewIfNeeded();
    await expect(warrantyLink, 'Footer phải có liên kết "Chính sách bảo hành"').toBeVisible();
    await Promise.all([page.waitForLoadState('domcontentloaded'), warrantyLink.click()]);
    await dismissPopups(page);
    await page.waitForTimeout(1000);
    await dismissPopups(page);
    await expect(page, 'Phải vào trang bảo hành (/bao-hanh)').toHaveURL(/\/bao-hanh/i);
    const listUrl = page.url();
    note(`Trang chọn hãng: ${listUrl}`);

    const brands = [
      { name: 'JBL', other: /realme/i, extra: true },
    ];

    for (const b of brands) {
      await test.step(`Hãng ${b.name}`, async () => {
        // Step 3: chọn hãng (quay lại trang chọn hãng nếu đang ở trang khác)
        if (page.url() !== listUrl) {
          await page.goto(listUrl, { waitUntil: 'domcontentloaded' });
          await dismissPopups(page);
        }
        const nameRe = new RegExp(`^\\s*${b.name}\\s*$`, 'i');
        const brandSlug = b.name.toLowerCase();

        // Step 3a: lướt xuống mục chọn hãng, xác định KHỐI lưới hãng (ancestor của ô "Mời nhập tên hãng" có chứa link /bao-hanh/<hãng>)
        // -> mọi thao tác "Xem thêm" và lướt logo chỉ diễn ra TRONG khối này, không bấm nhầm "Xem thêm" ở footer/bài viết
        const brandHeading = page.getByText(/Chọn\s*Hãng\s*Cần\s*Tìm/i).first();
        await brandHeading.scrollIntoViewIfNeeded().catch(() => { });
        await page.waitForTimeout(600);
        await dismissPopups(page);
        const brandBlock = page
          .getByPlaceholder(/nhập tên hãng/i)
          .locator('xpath=ancestor::*[.//a[contains(@href,"/bao-hanh/")]][1]');
        if (!(await brandBlock.count())) {
          check(false, `[${b.name}] Không tìm thấy khối lưới hãng (ô "Mời nhập tên hãng") trên ${page.url()}`);
          return;
        }
        const urlBeforeMore = page.url();

        // Step 3b: tự bấm nút xem thêm hãng NẰM TRONG khối lưới hãng (lặp đến khi hết nút)
        const clickMore = () => brandBlock.evaluate((block) => {
          const re = /^(xem\s*thêm|xem\s*tất\s*cả|xem\s*hãng|hãng\s*khác|thêm\s*hãng)/i;
          const cands = Array.from(block.querySelectorAll('a,button,div,span,p,li'))
            .filter((e) => {
              const t = (e.innerText || '').replace(/\s+/g, ' ').trim();
              if (!re.test(t) || t.length > 40) return false;
              const r = e.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
            })
            .filter((e, _, arr) => !arr.some((o) => o !== e && e.contains(o)));
          const el = cands[0];
          if (!el) return null;
          el.scrollIntoView({ block: 'center' });
          el.click();
          return (el.innerText || '').replace(/\s+/g, ' ').trim();
        }).catch(() => null);
        for (let i = 0; i < 5; i++) {
          const clicked = await clickMore();
          if (!clicked) {
            if (i === 0) {
              const texts = await brandBlock.evaluate((blk) => Array.from(blk.querySelectorAll('a,button,[role="button"]'))
                .map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 40).slice(-12)).catch(() => []);
              note(`[${b.name}] Không thấy nút xem thêm trong khối hãng. Các nút/link cuối khối: ${texts.join(' | ')}`);
            }
            break;
          }
          note(`[${b.name}] Đã tự bấm "${clicked}" (lần ${i + 1})`);
          await page.waitForTimeout(600);
          await dismissPopups(page);
          if (page.url() !== urlBeforeMore) {
            note(`[${b.name}] Nút "${clicked}" làm đổi trang sang ${page.url()} -> quay lại`);
            await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => { });
            break;
          }
        }

        // Step 3c: lướt qua từng logo TRONG khối lưới hãng cho tới khi gặp JBL (chạy trong trình duyệt nên nhanh)
        const scan = await brandBlock.evaluate(async (block, { slug, name }) => {
          const tiles = Array.from(block.querySelectorAll('a[href*="/bao-hanh/"]'))
            .filter((a) => /\/bao-hanh\/[^\/?#]+\/?$/i.test(a.getAttribute('href') || ''));
          const nameRe = new RegExp(`^\\s*${name}\\s*$`, 'i');
          for (let i = 0; i < tiles.length; i++) {
            const a = tiles[i];
            a.scrollIntoView({ block: 'center' });
            await new Promise((r) => setTimeout(r, 60)); // dừng rất ngắn để vẫn thấy logo lướt qua
            const href = (a.getAttribute('href') || '').toLowerCase();
            const alt = (a.querySelector('img')?.getAttribute('alt') || '').trim();
            if (new RegExp(`/bao-hanh/${slug}/?$`).test(href) || nameRe.test(alt) || nameRe.test((a.innerText || '').trim())) return { idx: i, total: tiles.length };
          }
          return { idx: -1, total: tiles.length };
        }, { slug: brandSlug, name: b.name }).catch(() => ({ idx: -1, total: 0 }));
        const foundIdx = scan.idx;
        const total = scan.total;
        let tile = null;
        if (foundIdx >= 0) {
          tile = brandBlock.locator(`a[href*="/bao-hanh/${brandSlug}" i]`).first();
          note(`[${b.name}] Đã gặp logo ${b.name} ở vị trí ${foundIdx + 1}/${total}`);
        }
        if (!tile) {
          // Dự phòng: tìm bằng ô "Mời nhập tên hãng"
          const search = page.getByPlaceholder(/nhập tên hãng/i).first();
          if (await search.isVisible().catch(() => false)) {
            await search.fill(b.name);
            await page.waitForTimeout(1000);
            const t2 = page.locator(`a[href*="/bao-hanh/${brandSlug}" i]`).first();
            if (await t2.count()) tile = t2;
          }
        }
        if (!tile) {
          const sample = await page.evaluate(() => Array.from(document.querySelectorAll('a[href*="bao-hanh"]')).slice(0, 15).map((a) => (a.getAttribute('href') || '') + ' [' + (a.innerText || '').trim().slice(0, 20) + ']')).catch(() => []);
          check(false, `[${b.name}] Đã bấm "Xem thêm" và lướt hết ${total} logo nhưng không thấy hãng ${b.name}. Link mẫu trên trang: ${sample.join(' ; ')}`);
          return;
        }
        // Step 4: bấm vào logo JBL rồi kết thúc test (không đợi tải hết trang để tránh treo)
        const tileHref = await tile.getAttribute('href');
        const expectedPath = new URL(tileHref, BASE_URL).pathname.replace(/\/$/, '');
        note(`[${b.name}] Bấm logo hãng -> ${tileHref}`);
        await tile.click({ noWaitAfter: true });
        // Chỉ kiểm tra URL đã chuyển sang trang hãng JBL
        await expect(page, `Bấm logo ${b.name} phải chuyển sang ${expectedPath}`)
          .toHaveURL(new RegExp(expectedPath.replace(/\//g, '\\/'), 'i'), { timeout: 15000 });
        note(`[${b.name}] Đã vào trang hãng: ${page.url()}`);
      });
    }

    note(failures.length
      ? `Lỗi (${failures.length}): ${failures.join(' || ')}`
      : 'Tìm thấy logo JBL, bấm vào và chuyển đúng sang trang hãng JBL');
  });

  // Policy_Warranty_02 - Từ trang hãng JBL, mở ô chọn tỉnh/thành và lần lượt chọn đủ 4 lựa chọn trong dropdown
  // Lỗi từng bước được gom lại (expect.soft) để bước sau vẫn được kiểm tra, cuối test ghi tổng hợp vào note.
  test('Policy_Warranty_02 - Kiểm tra chọn lần lượt 4 lựa chọn trong dropdown tỉnh/thành ở trang bảo hành hãng JBL', async ({ page }) => {
    test.setTimeout(300_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };

    // Bấm một phần tử, bắt cả trường hợp mở cùng tab hoặc tab mới
    const clickGetTarget = async (locator) => {
      const newTabPromise = page.context().waitForEvent('page', { timeout: 2000 }).catch(() => null);
      await locator.click();
      const newTab = await newTabPromise;
      const target = newTab || page;
      await target.waitForLoadState('domcontentloaded').catch(() => { });
      await target.waitForTimeout(1000);
      await dismissPopups(target);
      return { target, newTab };
    };
    const headingsOf = async (t) => (await t.locator('h1, h2, h3').allInnerTexts().catch(() => [])).join(' | ');
    const bodyOf = async (t) => (await t.locator('body').innerText().catch(() => '')) || '';
    const is404 = (txt) => /\b404\b|không\s*tìm\s*thấy\s*trang|page\s*not\s*found/i.test(txt.slice(0, 1500));

    // Step 1 + 2: trang chủ -> footer -> "Chính sách bảo hành" (trang chọn hãng)
    await gotoHome(page);
    await scrollToFooter(page);
    const column = await expandInfoColumn(page);
    const warrantyLink = column.getByRole('link', { name: /^\s*Chính sách bảo hành\s*$/i }).first();
    await warrantyLink.scrollIntoViewIfNeeded();
    await expect(warrantyLink, 'Footer phải có liên kết "Chính sách bảo hành"').toBeVisible();
    await Promise.all([page.waitForLoadState('domcontentloaded'), warrantyLink.click()]);
    await dismissPopups(page);
    await page.waitForTimeout(1000);
    await dismissPopups(page);
    await expect(page, 'Phải vào trang bảo hành (/bao-hanh)').toHaveURL(/\/bao-hanh/i);
    const listUrl = page.url();
    note(`Trang chọn hãng: ${listUrl}`);

    const brands = [
      { name: 'JBL', other: /realme/i, extra: true },
    ];

    for (const b of brands) {
      await test.step(`Hãng ${b.name}`, async () => {
        // Step 3: chọn hãng (quay lại trang chọn hãng nếu đang ở trang khác)
        if (page.url() !== listUrl) {
          await page.goto(listUrl, { waitUntil: 'domcontentloaded' });
          await dismissPopups(page);
        }
        const nameRe = new RegExp(`^\\s*${b.name}\\s*$`, 'i');
        const brandSlug = b.name.toLowerCase();

        // Step 3a: lướt xuống mục chọn hãng, xác định KHỐI lưới hãng (ancestor của ô "Mời nhập tên hãng" có chứa link /bao-hanh/<hãng>)
        // -> mọi thao tác "Xem thêm" và lướt logo chỉ diễn ra TRONG khối này, không bấm nhầm "Xem thêm" ở footer/bài viết
        const brandHeading = page.getByText(/Chọn\s*Hãng\s*Cần\s*Tìm/i).first();
        await brandHeading.scrollIntoViewIfNeeded().catch(() => { });
        await page.waitForTimeout(600);
        await dismissPopups(page);
        const brandBlock = page
          .getByPlaceholder(/nhập tên hãng/i)
          .locator('xpath=ancestor::*[.//a[contains(@href,"/bao-hanh/")]][1]');
        if (!(await brandBlock.count())) {
          check(false, `[${b.name}] Không tìm thấy khối lưới hãng (ô "Mời nhập tên hãng") trên ${page.url()}`);
          return;
        }
        const urlBeforeMore = page.url();

        // Step 3b: tự bấm nút xem thêm hãng NẰM TRONG khối lưới hãng (lặp đến khi hết nút)
        const clickMore = () => brandBlock.evaluate((block) => {
          const re = /^(xem\s*thêm|xem\s*tất\s*cả|xem\s*hãng|hãng\s*khác|thêm\s*hãng)/i;
          const cands = Array.from(block.querySelectorAll('a,button,div,span,p,li'))
            .filter((e) => {
              const t = (e.innerText || '').replace(/\s+/g, ' ').trim();
              if (!re.test(t) || t.length > 40) return false;
              const r = e.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
            })
            .filter((e, _, arr) => !arr.some((o) => o !== e && e.contains(o)));
          const el = cands[0];
          if (!el) return null;
          el.scrollIntoView({ block: 'center' });
          el.click();
          return (el.innerText || '').replace(/\s+/g, ' ').trim();
        }).catch(() => null);
        for (let i = 0; i < 5; i++) {
          const clicked = await clickMore();
          if (!clicked) {
            if (i === 0) {
              const texts = await brandBlock.evaluate((blk) => Array.from(blk.querySelectorAll('a,button,[role="button"]'))
                .map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 40).slice(-12)).catch(() => []);
              note(`[${b.name}] Không thấy nút xem thêm trong khối hãng. Các nút/link cuối khối: ${texts.join(' | ')}`);
            }
            break;
          }
          note(`[${b.name}] Đã tự bấm "${clicked}" (lần ${i + 1})`);
          await page.waitForTimeout(600);
          await dismissPopups(page);
          if (page.url() !== urlBeforeMore) {
            note(`[${b.name}] Nút "${clicked}" làm đổi trang sang ${page.url()} -> quay lại`);
            await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => { });
            break;
          }
        }

        // Step 3c: lướt qua từng logo TRONG khối lưới hãng cho tới khi gặp JBL (chạy trong trình duyệt nên nhanh)
        const scan = await brandBlock.evaluate(async (block, { slug, name }) => {
          const tiles = Array.from(block.querySelectorAll('a[href*="/bao-hanh/"]'))
            .filter((a) => /\/bao-hanh\/[^\/?#]+\/?$/i.test(a.getAttribute('href') || ''));
          const nameRe = new RegExp(`^\\s*${name}\\s*$`, 'i');
          for (let i = 0; i < tiles.length; i++) {
            const a = tiles[i];
            a.scrollIntoView({ block: 'center' });
            await new Promise((r) => setTimeout(r, 25)); // dừng rất ngắn để vẫn thấy logo lướt qua
            const href = (a.getAttribute('href') || '').toLowerCase();
            const alt = (a.querySelector('img')?.getAttribute('alt') || '').trim();
            if (new RegExp(`/bao-hanh/${slug}/?$`).test(href) || nameRe.test(alt) || nameRe.test((a.innerText || '').trim())) return { idx: i, total: tiles.length };
          }
          return { idx: -1, total: tiles.length };
        }, { slug: brandSlug, name: b.name }).catch(() => ({ idx: -1, total: 0 }));
        const foundIdx = scan.idx;
        const total = scan.total;
        let tile = null;
        if (foundIdx >= 0) {
          tile = brandBlock.locator(`a[href*="/bao-hanh/${brandSlug}" i]`).first();
          note(`[${b.name}] Đã gặp logo ${b.name} ở vị trí ${foundIdx + 1}/${total}`);
        }
        if (!tile) {
          // Dự phòng: tìm bằng ô "Mời nhập tên hãng"
          const search = page.getByPlaceholder(/nhập tên hãng/i).first();
          if (await search.isVisible().catch(() => false)) {
            await search.fill(b.name);
            await page.waitForTimeout(1000);
            const t2 = page.locator(`a[href*="/bao-hanh/${brandSlug}" i]`).first();
            if (await t2.count()) tile = t2;
          }
        }
        if (!tile) {
          const sample = await page.evaluate(() => Array.from(document.querySelectorAll('a[href*="bao-hanh"]')).slice(0, 15).map((a) => (a.getAttribute('href') || '') + ' [' + (a.innerText || '').trim().slice(0, 20) + ']')).catch(() => []);
          check(false, `[${b.name}] Đã bấm "Xem thêm" và lướt hết ${total} logo nhưng không thấy hãng ${b.name}. Link mẫu trên trang: ${sample.join(' ; ')}`);
          return;
        }
        // Step 4: bấm vào logo JBL rồi kết thúc test (không đợi tải hết trang để tránh treo)
        const tileHref = await tile.getAttribute('href');
        const expectedPath = new URL(tileHref, BASE_URL).pathname.replace(/\/$/, '');
        note(`[${b.name}] Bấm logo hãng -> ${tileHref}`);
        await tile.click({ noWaitAfter: true });
        // Chỉ kiểm tra URL đã chuyển sang trang hãng JBL
        await expect(page, `Bấm logo ${b.name} phải chuyển sang ${expectedPath}`)
          .toHaveURL(new RegExp(expectedPath.replace(/\//g, '\\/'), 'i'), { timeout: 15000 });
        note(`[${b.name}] Đã vào trang hãng: ${page.url()}`);
        await page.waitForLoadState('domcontentloaded').catch(() => { });
        await page.waitForTimeout(1500);
        await dismissPopups(page);

        // Step 5: ô chọn tỉnh/thành. Lần lượt chọn đủ 4 lựa chọn: "Tỉnh thành" -> Hồ Chí Minh -> Hà Nội -> Đà Nẵng
        const provinces = [
          { label: 'Chọn tỉnh thành', re: /^\s*(Chọn\s*)?Tỉnh\s*thành\s*$/i },
          { label: 'Thành phố Hồ Chí Minh', re: /Hồ\s*Chí\s*Minh/i, addr: /Hồ\s*Chí\s*Minh|\bTP\.?\s*HCM\b|\bHCM\b|Sài\s*Gòn/i, slug: /jbl-tai-.*ho-chi-minh/i },
          { label: 'Thành phố Hà Nội', re: /Hà\s*Nội/i, addr: /Hà\s*Nội|\bTP\.?\s*HN\b|\bHN\b/i, slug: /jbl-tai-.*ha-noi/i },
          { label: 'Thành phố Đà Nẵng', re: /Đà\s*Nẵng/i, addr: /Đà\s*Nẵng|\bTP\.?\s*ĐN\b|\bĐN\b/i, slug: /jbl-tai-.*da-nang/i },
        ];

        // Tìm ô dropdown: ưu tiên <select> có đủ 3 thành phố; nếu không có thì tìm ô tùy biến hiển thị chữ "Tỉnh thành"
        const findSelect = async () => {
          const sels = page.locator('select');
          const n = await sels.count();
          for (let i = 0; i < n; i++) {
            const txt = await sels.nth(i).innerText().catch(() => '');
            if (/Hồ\s*Chí\s*Minh/i.test(txt) && /Hà\s*Nội/i.test(txt) && /Đà\s*Nẵng/i.test(txt)) return sels.nth(i);
          }
          return null;
        };
        const nativeSelect = await findSelect();
        let customTrigger = null;
        if (!nativeSelect) {
          customTrigger = page
            .locator('div, button, span, p, a, li')
            .filter({ hasText: /^\s*((Chọn\s*)?Tỉnh\s*thành|Thành phố Hồ Chí Minh|Thành phố Hà Nội|Thành phố Đà Nẵng|Hồ Chí Minh|Hà Nội|Đà Nẵng)\s*$/i })
            .filter({ visible: true })
            .first();
        }
        if (!nativeSelect && !(await customTrigger.count())) {
          check(false, `[${b.name}] Không tìm thấy ô chọn tỉnh/thành trên ${page.url()}`);
          return;
        }
        if (nativeSelect) await nativeSelect.scrollIntoViewIfNeeded().catch(() => { });
        else await customTrigger.scrollIntoViewIfNeeded().catch(() => { });
        note(`[${b.name}] Dạng ô tỉnh/thành: ${nativeSelect ? '<select> gốc' : 'dropdown tùy biến'}`);

        const picked = [];
        for (const p of provinces) {
          await test.step(`Chọn "${p.label}"`, async () => {
            await dismissPopups(page);
            if (nativeSelect) {
              // Lấy đúng option theo tên rồi chọn
              const opts = await nativeSelect.locator('option').evaluateAll((os) => os.map((o) => ({ value: o.value, text: (o.textContent || '').trim() })));
              const opt = opts.find((o) => p.re.test(o.text));
              if (!opt) { check(false, `[${b.name}] Dropdown không có lựa chọn "${p.label}". Các lựa chọn thực tế: ${opts.map((o) => o.text).join(' | ')}`); return; }
              // Bấm mở dropdown để danh sách xổ ra, dừng cho nhìn thấy, rồi dùng phím mũi tên + Enter để chọn (popup của <select> gốc không bấm chuột trực tiếp được)
              const curIdx = await nativeSelect.evaluate((el) => el.selectedIndex);
              const tgtIdx = opts.findIndex((o) => o.value === opt.value && o.text === opt.text);
              await nativeSelect.click();
              await page.waitForTimeout(1200); // thấy danh sách đang mở
              const key = tgtIdx >= curIdx ? 'ArrowDown' : 'ArrowUp';
              for (let k = 0; k < Math.abs(tgtIdx - curIdx); k++) {
                await page.keyboard.press(key);
                await page.waitForTimeout(500); // thấy highlight chạy qua từng lựa chọn
              }
              await page.keyboard.press('Enter');
              // Dự phòng: nếu phím không đổi được lựa chọn thì chọn trực tiếp
              const afterKey = await nativeSelect.evaluate((el) => el.selectedIndex);
              if (afterKey !== tgtIdx) {
                note(`[${b.name}] Chọn bằng phím chưa được cho "${p.label}", dùng selectOption dự phòng`);
                await nativeSelect.selectOption({ value: opt.value });
              }
              await page.waitForTimeout(1200);
              const shown = await nativeSelect.evaluate((s) => (s.options[s.selectedIndex]?.textContent || '').trim());
              check(p.re.test(shown), `[${b.name}] Sau khi chọn "${p.label}", ô dropdown đang hiện "${shown}"`);
              picked.push(shown);
            } else {
              // Mở dropdown rồi bấm đúng lựa chọn trong danh sách vừa xổ ra
              const trigger = page
                .locator('div, button, span, p, a, li')
                .filter({ hasText: /^\s*((Chọn\s*)?Tỉnh\s*thành|Thành phố Hồ Chí Minh|Thành phố Hà Nội|Thành phố Đà Nẵng|Hồ Chí Minh|Hà Nội|Đà Nẵng)\s*$/i })
                .filter({ visible: true })
                .first();
              await trigger.click();
              await page.waitForTimeout(600);
              const option = page
                .locator('li, div, span, a, p, [role="option"]')
                .filter({ hasText: p.re })
                .filter({ visible: true })
                .last(); // phần tử sâu nhất, nằm trong danh sách vừa xổ ra
              if (!(await option.count())) { check(false, `[${b.name}] Mở dropdown nhưng không thấy lựa chọn "${p.label}"`); return; }
              await option.click();
              await page.waitForTimeout(1200);
              await dismissPopups(page);
              const shown = ((await trigger.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
              check(p.re.test(shown), `[${b.name}] Sau khi chọn "${p.label}", ô dropdown đang hiện "${shown}"`);
              picked.push(shown);
            }
            // Với 3 thành phố: trang phải chuyển sang danh sách trung tâm bảo hành của đúng thành phố đó
            // (URL dạng /bao-hanh/jbl-tai-thanh-pho-<tên>, tiêu đề "N Trung Tâm Bảo Hành JBL Tại <thành phố>", địa chỉ trong bảng thuộc thành phố đó)
            if (p.slug) {
              await page.waitForURL(p.slug, { timeout: 10000 }).catch(() => { });
              check(p.slug.test(page.url()), `[${b.name}] Chọn "${p.label}" nhưng URL không đổi sang trang của thành phố đó: ${page.url()}`);
              await page.waitForLoadState('domcontentloaded').catch(() => { });
              await page.waitForTimeout(1000);
              await dismissPopups(page);

              // Tiêu đề: "<N> Trung Tâm Bảo Hành JBL Tại Thành Phố ..."
              const heading = page.locator('h1, h2').filter({ hasText: /Trung\s*Tâm\s*Bảo\s*Hành/i }).first();
              const headText = ((await heading.innerText({ timeout: 5000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
              check(/Trung\s*Tâm\s*Bảo\s*Hành/i.test(headText) && /JBL/i.test(headText) && p.re.test(headText),
                `[${b.name}] Sau khi chọn "${p.label}", tiêu đề trang là "${headText}" (phải có "Trung Tâm Bảo Hành JBL Tại ${p.label}")`);
              const countM = headText.match(/^\s*(\d+)\s*Trung/i);
              const centerCount = countM ? Number(countM[1]) : null;
              check(centerCount !== null && centerCount >= 1, `[${b.name}] Tiêu đề không có số trung tâm hợp lệ: "${headText}"`);

              // Bảng danh sách: <select> nằm ở hàng tiêu đề của bảng ngoài; các dòng trung tâm nằm trong bảng con ở hàng dưới.
              // Chỉ lấy các dòng trung tâm (tr không chứa <select> và không chứa bảng con) để không đọc nhầm chữ trong các <option> của dropdown.
              const rowsText = await evalWithTimeout(page, () => {
                const sel = Array.from(document.querySelectorAll('select')).find((s) => /Hà\s*Nội/i.test(s.innerText));
                const table = sel && sel.closest('table');
                if (!table) return null;
                return Array.from(table.querySelectorAll('tr'))
                  .filter((tr) => !tr.querySelector('select') && !tr.querySelector('table'))
                  .map((tr) => (tr.innerText || '').replace(/[ \t]+/g, ' ').trim())
                  .filter(Boolean);
              }, null, 5000);
              check(Array.isArray(rowsText) && rowsText.length >= 1, `[${b.name}] Không tìm thấy dòng trung tâm nào trong bảng sau khi chọn "${p.label}"`);
              if (Array.isArray(rowsText) && rowsText.length) {
                if (centerCount !== null) check(rowsText.length === centerCount, `[${b.name}] Tiêu đề ghi ${centerCount} trung tâm nhưng bảng "${p.label}" có ${rowsText.length} dòng`);
                rowsText.forEach((r, i) => {
                  check(p.addr.test(r), `[${b.name}] Dòng ${i + 1} của "${p.label}" không có địa chỉ thuộc ${p.label}: ${r.slice(0, 120)}`);
                  check(/Hotline|\d{3}[\s.]?\d{3,5}[\s.]?\d{3,4}/i.test(r), `[${b.name}] Dòng ${i + 1} của "${p.label}" không hiện số điện thoại: ${r.slice(0, 120)}`);
                  for (const other of provinces.filter((o) => o.slug && o !== p)) {
                    check(!other.addr.test(r), `[${b.name}] Dòng ${i + 1} của "${p.label}" lại có địa chỉ ${other.label}: ${r.slice(0, 120)}`);
                  }
                });
                note(`[${b.name}] "${p.label}" - dòng đầu: ${rowsText[0].slice(0, 150)}`);
              }
              note(`[${b.name}] "${p.label}": ${centerCount} trung tâm, tiêu đề "${headText}"`);
            }
            // Trang vẫn phải bình thường sau mỗi lần chọn (không 404, vẫn ở trang hãng JBL)
            const body = await bodyOf(page);
            check(!is404(body), `[${b.name}] Chọn "${p.label}" làm trang báo lỗi 404`);
            check(/\/bao-hanh\/jbl/i.test(page.url()), `[${b.name}] Chọn "${p.label}" làm trang rời khỏi trang bảo hành JBL: ${page.url()}`);
            note(`[${b.name}] Đã chọn "${p.label}" -> ô hiện "${picked[picked.length - 1] || ''}", URL: ${page.url()}`);
          });
        }
        // Kết thúc test sau khi đã chọn hết 4 lựa chọn
        check(picked.length === provinces.length, `[${b.name}] Chỉ chọn được ${picked.length}/${provinces.length} lựa chọn trong dropdown`);
      });
    }

    note(failures.length
      ? `Lỗi (${failures.length}): ${failures.join(' || ')}`
      : 'Vào trang hãng JBL, chọn lần lượt đủ 4 lựa chọn trong dropdown tỉnh/thành (Tỉnh thành, Hồ Chí Minh, Hà Nội, Đà Nẵng); mỗi thành phố đổi đúng URL, tiêu đề, địa chỉ trung tâm, trang không lỗi');
  });

  // Policy_Warranty_03 - Ở trang trung tâm bảo hành của một hãng, bấm "Xem thêm chính sách đổi trả" -> mở đúng trang Chính sách đổi trả
  // (chỉ kiểm tra điều hướng; nội dung trang đã kiểm tra ở Policy_Page_01, đối chiếu cùng trang với Policy_Page_03)
  test('Policy_Warranty_03 - Kiểm tra bấm "Xem thêm chính sách đổi trả" ở trang trung tâm bảo hành', async ({ page }) => {
    test.setTimeout(180_000);

    // Step 1 + 2: trang chủ -> footer -> "Chính sách bảo hành"
    await gotoHome(page);
    await scrollToFooter(page);
    const column = await expandInfoColumn(page);
    const warrantyLink = column.getByRole('link', { name: /^\s*Chính sách bảo hành\s*$/i }).first();
    await warrantyLink.scrollIntoViewIfNeeded();
    await expect(warrantyLink, 'Footer phải có liên kết "Chính sách bảo hành"').toBeVisible();
    await Promise.all([page.waitForLoadState('domcontentloaded'), warrantyLink.click()]);
    await dismissPopups(page);
    await page.waitForTimeout(1000);
    await dismissPopups(page);
    await expect(page, 'Phải vào trang bảo hành (/bao-hanh)').toHaveURL(/\/bao-hanh/i);

    // Step 3: chọn một hãng bất kỳ (logo hãng đầu tiên trong lưới) -> vào trang trung tâm bảo hành của hãng đó
    const brandTile = page.locator('a[href^="/bao-hanh/"]:visible').first();
    await brandTile.scrollIntoViewIfNeeded();
    await expect(brandTile, 'Phải có ít nhất một logo hãng để chọn').toBeVisible();
    const brandHref = await brandTile.getAttribute('href');
    note(`Chọn hãng: ${brandHref}`);
    await brandTile.click({ noWaitAfter: true });
    await expect(page, 'Bấm logo hãng phải chuyển sang trang trung tâm bảo hành của hãng').toHaveURL(
      new RegExp(brandHref.replace(/\//g, '\\/'), 'i'), { timeout: 15000 });
    await page.waitForLoadState('domcontentloaded').catch(() => { });
    await page.waitForTimeout(1000);
    await dismissPopups(page);
    const brandUrl = page.url();

    // Step 4: bấm "Xem thêm chính sách đổi trả"
    const moreLink = page.getByRole('link', { name: /Xem thêm chính sách đổi trả/i }).first();
    await moreLink.scrollIntoViewIfNeeded();
    await expect(moreLink, 'Trang trung tâm bảo hành phải có liên kết "Xem thêm chính sách đổi trả"').toBeVisible();
    const moreHref = await moreLink.getAttribute('href');
    note(`Bấm "Xem thêm chính sách đổi trả" -> ${moreHref}`);

    // Liên kết có thể mở cùng tab hoặc tab mới
    const newTabPromise = page.context().waitForEvent('page', { timeout: 3000 }).catch(() => null);
    await moreLink.click({ noWaitAfter: true });
    const newTab = await newTabPromise;
    const target = newTab || page;
    await target.waitForLoadState('domcontentloaded').catch(() => { });
    await target.waitForTimeout(1500);
    await dismissPopups(target);
    note(`URL sau khi bấm: ${target.url()}${newTab ? ' (mở tab mới)' : ''}`);

    // Expected 1: sang trang Chính sách đổi trả (site có thể chuyển hướng URL, nên đối chiếu bằng tiêu đề), không lỗi 404
    expect(target.url(), 'Phải rời khỏi trang trung tâm bảo hành').not.toBe(brandUrl);
    await expect(target.locator('body')).not.toContainText(/\b404\b|không tìm thấy trang/i);
    await expect(
      target.getByRole('heading', { name: /Chính sách.*đổi trả/i }).first(),
      'Tiêu đề trang phải chứa "Chính sách ... đổi trả" (cùng trang với Policy_Page_03)'
    ).toBeVisible({ timeout: 10000 });

    // Expected 2: trang hiển thị bình thường, không trắng trang, không tự chuyển hướng ngoài ý muốn
    const bodyLen = (await target.locator('body').innerText()).trim().length;
    expect(bodyLen, 'Trang không được trắng/quá ít nội dung').toBeGreaterThan(300);
    const urlAfter = target.url();
    await target.waitForTimeout(1500);
    expect(target.url(), 'Trang không được tự chuyển hướng ngoài ý muốn').toBe(urlAfter);
    expect.soft(await target.locator('body').innerText().then((t) => t.includes('\uFFFD')),
      'Có ký tự lỗi font (�) trên trang').toBeFalsy();

    await target.screenshot({ path: 'test-results/Policy_Warranty_03.png' });
  });

  // Policy_Warranty_04 - Ô "Mời nhập tên hãng để tìm" ở trang chọn hãng: nhập đúng tên đầy đủ "JBL" -> kết quả khớp, không có hãng không liên quan
  test('Policy_Warranty_04 - Kiểm tra nhập tên bảo hành đúng', async ({ page }) => {
    test.setTimeout(180_000);
    const KEYWORD = 'JBL';

    // Step 1 + 2: trang chủ -> footer -> "Chính sách bảo hành"
    await gotoHome(page);
    await scrollToFooter(page);
    const column = await expandInfoColumn(page);
    const warrantyLink = column.getByRole('link', { name: /^\s*Chính sách bảo hành\s*$/i }).first();
    await warrantyLink.scrollIntoViewIfNeeded();
    await expect(warrantyLink, 'Footer phải có liên kết "Chính sách bảo hành"').toBeVisible();
    await Promise.all([page.waitForLoadState('domcontentloaded'), warrantyLink.click()]);
    await dismissPopups(page);
    await page.waitForTimeout(1000);
    await dismissPopups(page);
    await expect(page, 'Phải vào trang bảo hành (/bao-hanh)').toHaveURL(/\/bao-hanh/i);

    // Các logo hãng đang hiển thị (chỉ lấy link dạng /bao-hanh/<hãng>, bỏ qua phần tử bị ẩn)
    const visibleBrands = () => evalWithTimeout(page, () => Array.from(document.querySelectorAll('a[href*="/bao-hanh/"]'))
      .filter((a) => /\/bao-hanh\/[^\/?#]+\/?$/i.test(a.getAttribute('href') || ''))
      .filter((a) => { const r = a.getBoundingClientRect(); const st = getComputedStyle(a); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; })
      .map((a) => ({
        href: a.getAttribute('href') || '',
        text: (a.innerText || '').replace(/\s+/g, ' ').trim(),
        alt: (a.querySelector('img')?.getAttribute('alt') || '').trim(),
      })), [], 5000);
    const isJbl = (b) => /jbl/i.test(`${b.href} ${b.text} ${b.alt}`);

    const before = await visibleBrands();
    note(`Trước khi nhập: ${before.length} hãng đang hiển thị`);

    // Step 3: nhập đúng tên đầy đủ vào ô tìm hãng
    const search = page.getByPlaceholder(/nhập tên hãng/i).first();
    await search.scrollIntoViewIfNeeded();
    await expect(search, 'Phải có ô "Mời nhập tên hãng để tìm"').toBeVisible();
    await search.click();
    await search.fill('');
    await search.pressSequentially(KEYWORD, { delay: 120 });
    await expect(search, 'Ô tìm phải giữ đúng chữ vừa nhập').toHaveValue(KEYWORD);
    await page.waitForTimeout(1200); // trang có thể lọc ngay khi gõ

    // Step 4: bấm tìm kiếm (Enter); nếu chưa thấy kết quả thì bấm nút tìm cạnh ô nhập
    let shown = await visibleBrands();
    if (!shown.some(isJbl) || shown.length === before.length) {
      await search.press('Enter');
      await page.waitForTimeout(1200);
      shown = await visibleBrands();
    }
    if (!shown.some(isJbl)) {
      // Nút tìm nằm cùng khối với ô nhập (trong snapshot: <button> đứng trước ô textbox)
      const searchBtn = search.locator('xpath=ancestor::*[.//button][1]').locator('button').first();
      if (await searchBtn.count()) {
        await searchBtn.click({ timeout: 3000 }).catch(() => { });
        await page.waitForTimeout(1200);
        shown = await visibleBrands();
      }
    }
    await dismissPopups(page);
    note(`Sau khi nhập "${KEYWORD}": ${shown.length} hãng hiển thị: ${shown.map((b) => b.alt || b.text || b.href).join(' | ')}`);

    // Expected 1: có kết quả khớp tên đã nhập (hãng JBL)
    expect(shown.some(isJbl), `Nhập "${KEYWORD}" phải thấy hãng JBL trong kết quả`).toBeTruthy();

    // Expected 2: không hiển thị hãng không liên quan
    const unrelated = shown.filter((b) => !isJbl(b));
    expect.soft(unrelated.map((b) => b.alt || b.text || b.href),
      `Kết quả có hãng không liên quan tới "${KEYWORD}"`).toEqual([]);

    // Trang vẫn bình thường
    await expect(page.locator('body')).not.toContainText(/\b404\b|không\s*tìm\s*thấy\s*trang/i);
    expect(page.url(), 'Tìm hãng không được làm rời trang bảo hành').toMatch(/\/bao-hanh/i);

    await page.screenshot({ path: 'test-results/Policy_Warranty_04.png' });
  });

  // Policy_Warranty_05 - Ô "Mời nhập tên hãng để tìm": nhập giá trị không hợp lệ -> không có kết quả sai, không lỗi hệ thống, không treo trang
  test('Policy_Warranty_05 - Kiểm tra nhập tên bảo hành không hợp lệ', async ({ page }) => {
    test.setTimeout(180_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };

    await gotoWarrantyPage(page); // Step 1 + 2
    const total = (await visibleBrandTiles(page)).length;
    note(`Trước khi nhập: ${total} hãng đang hiển thị`);

    const search = page.getByPlaceholder(/nhập tên hãng/i).first();
    await search.scrollIntoViewIfNeeded();
    await expect(search, 'Phải có ô "Mời nhập tên hãng để tìm"').toBeVisible();

    const notFoundRe = /không\s*(tìm\s*thấy|có\s*kết\s*quả|có\s*hãng)|no\s*results?/i;
    const systemErrRe = /\b404\b|lỗi\s*hệ\s*thống|internal\s*server|undefined|\[object|exception/i;
    const inputs = [
      { label: 'xyzxyz123', value: 'xyzxyz123', blank: false },
      { label: 'Policy_Warranty_##$$', value: 'Policy_Warranty_##$$', blank: false },
      { label: '"   " (chỉ khoảng trắng)', value: '   ', blank: true },
    ];

    for (const inp of inputs) {
      await test.step(`Nhập ${inp.label}`, async () => {
        // Step 3: nhập giá trị không hợp lệ
        await search.click();
        await search.fill('');
        await search.pressSequentially(inp.value, { delay: 100 });
        await page.waitForTimeout(1000);
        // Step 4: bấm tìm (Enter) sau mỗi lần nhập
        await search.press('Enter');
        await page.waitForTimeout(1200);
        await dismissPopups(page);

        const shown = await visibleBrandTiles(page);
        const body = await page.locator('body').innerText().catch(() => '');
        const hasNotFoundMsg = notFoundRe.test(body);
        note(`[${inp.label}] ${shown.length} hãng hiển thị${hasNotFoundMsg ? ', có thông báo không tìm thấy' : ''}`);

        // Expected 2: không lỗi hệ thống, không treo trang, vẫn ở trang bảo hành, ô nhập còn dùng được
        check(!systemErrRe.test(body.slice(0, 3000)), `[${inp.label}] Trang hiện chữ báo lỗi hệ thống/404`);
        check(/\/bao-hanh/i.test(page.url()), `[${inp.label}] Trang rời khỏi trang bảo hành: ${page.url()}`);
        check(await search.isEnabled().catch(() => false), `[${inp.label}] Ô nhập bị khóa/treo sau khi tìm`);

        // Expected 1: giá trị rác (không phải khoảng trắng) -> không hãng nào hiển thị sai, hoặc có thông báo không tìm thấy
        if (!inp.blank) {
          const wrong = shown.filter((b) => !b.href.toLowerCase().includes(inp.value.trim().toLowerCase()) && !(b.alt + b.text).toLowerCase().includes(inp.value.trim().toLowerCase()));
          check(shown.length === 0 || hasNotFoundMsg,
            `[${inp.label}] Giá trị không hợp lệ nhưng vẫn hiển thị ${wrong.length} hãng: ${wrong.slice(0, 5).map((b) => b.alt || b.text || b.href).join(' | ')} và không có thông báo không tìm thấy`);
        } else {
          // Chỉ khoảng trắng: chấp nhận không cho tìm (giữ nguyên danh sách) hoặc báo không tìm thấy; không được lỗi
          note(`[${inp.label}] Hành vi thực tế: ${shown.length === total ? 'giữ nguyên danh sách đầy đủ' : shown.length === 0 ? 'không hiển thị hãng nào' : `hiển thị ${shown.length}/${total} hãng`}`);
        }
        await page.screenshot({ path: `test-results/Policy_Warranty_05_${inputs.indexOf(inp) + 1}.png` });
      });
    }

    // Sau cùng: xóa ô nhập -> danh sách hãng phải hiện lại (chứng tỏ trang không treo/kẹt trạng thái lỗi)
    await search.fill('');
    await search.press('Enter');
    await page.waitForTimeout(1200);
    const after = await visibleBrandTiles(page);
    check(after.length > 0, 'Sau khi xóa ô nhập, danh sách hãng không hiện lại');

    note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : 'Nhập 3 giá trị không hợp lệ (xyzxyz123, Policy_Warranty_##$$, khoảng trắng): trang không lỗi, không có kết quả sai, xóa ô nhập thì danh sách hiện lại');
  });

  // Policy_Warranty_06 - Ô "Mời nhập tên hãng để tìm": nhập một phần tên ("real" -> realme, "JB" -> JBL) -> gợi ý/kết quả liên quan, chọn đi đúng hãng
  test('Policy_Warranty_06 - Kiểm tra nhập tên bảo hành với một phần của từ', async ({ page }) => {
    test.setTimeout(240_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };

    await gotoWarrantyPage(page); // Step 1 + 2
    const listUrl = page.url();

    const cases = [
      { partial: 'real', slug: 'realme', name: 'realme' },
      { partial: 'JB', slug: 'jbl', name: 'JBL' },
      // "io": không biết trước hãng nào; chỉ kiểm tra tìm ra các hãng có chữ "io" (không bấm vào hãng nào)
      { partial: 'io', slug: null, name: 'hãng chứa "io"' },
    ];
    const hit = (b, kw) => `${b.href} ${b.text} ${b.alt}`.toLowerCase().includes(kw.toLowerCase());

    for (const c of cases) {
      await test.step(`Nhập một phần tên "${c.partial}" (${c.name})`, async () => {
        if (page.url() !== listUrl) {
          await page.goto(listUrl, { waitUntil: 'domcontentloaded' });
          await dismissPopups(page);
        }
        // Step 3: nhập một phần tên hãng
        const search = page.getByPlaceholder(/nhập tên hãng/i).first();
        await search.scrollIntoViewIfNeeded();
        await expect(search, 'Phải có ô "Mời nhập tên hãng để tìm"').toBeVisible();
        await search.click();
        await search.fill('');
        await search.pressSequentially(c.partial, { delay: 120 });
        await expect(search, 'Ô tìm phải giữ đúng chữ vừa nhập').toHaveValue(c.partial);
        await page.waitForTimeout(1200); // trang có thể lọc/gợi ý ngay khi gõ

        // Step 4: quan sát gợi ý; nếu chưa thấy kết quả thì bấm tìm (Enter)
        let shown = await visibleBrandTiles(page);
        const matchesTarget = (b) => (c.slug ? hit(b, c.slug) : hit(b, c.partial));
        if (!shown.some(matchesTarget)) {
          await search.press('Enter');
          await page.waitForTimeout(1200);
          shown = await visibleBrandTiles(page);
        }
        await dismissPopups(page);
        note(`["${c.partial}"] ${shown.length} hãng hiển thị: ${shown.map((b) => b.alt || b.text || b.href).join(' | ')}`);

        // Expected 1: có gợi ý/kết quả liên quan chứa phần từ đã nhập (đúng hãng cần tìm)
        check(shown.some(matchesTarget), `Nhập "${c.partial}" phải thấy ${c.name} trong kết quả/gợi ý`);
        const unrelated = shown.filter((b) => !hit(b, c.partial));
        expect.soft(unrelated.map((b) => b.alt || b.text || b.href),
          `Nhập "${c.partial}" nhưng có hãng không chứa phần từ này`).toEqual([]);

        // "io": chỉ cần tìm ra các hãng có chữ "io" (không bấm vào hãng nào)
        if (!c.slug) {
          const found = shown.filter(matchesTarget).map((b) => b.alt || b.text || b.href);
          note(`["${c.partial}"] Tìm ra ${found.length} hãng có chữ "${c.partial}": ${found.join(' | ')}`);
          await page.screenshot({ path: 'test-results/Policy_Warranty_06_io.png' });
          return;
        }

        // Expected 2: bấm kết quả đi đúng hãng tương ứng
        // Hãng cần bấm: hãng chỉ định, hoặc (với "io") hãng đầu tiên chứa "io" trong kết quả
        const targetBrand = c.slug ? null : shown.find(matchesTarget);
        const targetSlug = c.slug || (targetBrand ? (targetBrand.href.match(/\/bao-hanh\/([^\/?#]+)/i) || [])[1] : null);
        if (!targetSlug) { check(false, `Không có hãng nào để bấm sau khi nhập "${c.partial}"`); return; }
        const tile = page.locator(`a[href*="/bao-hanh/${targetSlug}" i]:visible`).first();
        if (!(await tile.count())) { check(false, `Không có link ${c.name} để bấm sau khi nhập "${c.partial}"`); return; }
        const slugRe = new RegExp(`/bao-hanh/${targetSlug}`, 'i');
        const tileHref = await tile.getAttribute('href');
        const tileTarget = await tile.getAttribute('target');
        note(`["${c.partial}"] Bấm ${targetSlug}: href=${tileHref}${tileTarget ? `, target=${tileTarget}` : ''}`);
        await tile.scrollIntoViewIfNeeded().catch(() => { });
        // Bỏ focus khỏi ô nhập trước khi bấm (danh sách có thể đổi bố cục khi ô nhập mất focus làm lần bấm đầu trượt)
        await page.locator('body').click({ position: { x: 5, y: 5 }, force: true }).catch(() => { });
        await page.waitForTimeout(400);
        let target = page;
        for (let attempt = 1; attempt <= 2 && !slugRe.test(target.url()); attempt++) {
          // Liên kết có thể mở cùng tab hoặc tab mới
          const newTabPromise = page.context().waitForEvent('page', { timeout: 4000 }).catch(() => null);
          await page.locator(`a[href*="/bao-hanh/${targetSlug}" i]:visible`).first().click({ noWaitAfter: true });
          const newTab = await newTabPromise;
          target = newTab || page;
          await target.waitForURL(slugRe, { timeout: 10000 }).catch(() => { });
          if (attempt === 2 || slugRe.test(target.url())) {
            if (attempt === 2 && slugRe.test(target.url())) note(`["${c.partial}"] Lần bấm đầu chưa chuyển trang, bấm lại lần 2 mới chuyển`);
            if (newTab) note(`["${c.partial}"] ${targetSlug} mở ở tab mới`);
          }
        }
        check(slugRe.test(target.url()), `Bấm ${c.name} sau khi nhập "${c.partial}" nhưng URL là ${target.url()} (phải chứa /bao-hanh/${targetSlug})`);
        await target.waitForLoadState('domcontentloaded').catch(() => { });
        await dismissPopups(target);
        check(!/\b404\b|không\s*tìm\s*thấy\s*trang/i.test((await target.locator('body').innerText().catch(() => '')).slice(0, 1500)), `Trang hãng ${targetSlug} báo lỗi 404`);
        note(`["${c.partial}"] Bấm ${targetSlug} -> ${target.url()}`);
        await target.screenshot({ path: `test-results/Policy_Warranty_06_${targetSlug}.png` });
        if (target !== page) await target.close().catch(() => { });
      });
    }

    note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : 'Nhập "real" thấy realme, "JB" thấy JBL (bấm vào đi đúng hãng); nhập "io" tìm ra các hãng có chữ "io"');
  });

  // Policy_Warranty_07 - Tra cứu thông tin bảo hành theo số điện thoại hợp lệ (SĐT của tester đã có dữ liệu bảo hành) -> hiển thị thông tin bảo hành đúng
  // SĐT tester có dữ liệu bảo hành dùng cho case hợp lệ 07/08.
  test('Policy_Warranty_07 - Kiểm tra tra cứu thông tin bảo hành theo số điện thoại hợp lệ', async ({ page }) => {
    test.setTimeout(300_000); // có bước chờ tester tự nhập mã xác thực
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };

    const PHONE = '0374138333';
    expect(PHONE, 'SĐT tra cứu phải gồm 10 số, bắt đầu bằng 0').toMatch(/^0\d{9}$/);

    await gotoWarrantyPage(page); // Step 1 + 2

    // Step 3: chọn tab "Tra theo số điện thoại" (mục "Tra cứu thông tin bảo hành" có 3 tab: số điện thoại / mã IMEI / mã jobcard)
    await expect(page.getByRole('heading', { name: /Tra cứu thông tin bảo hành/i }), 'Phải có mục "Tra cứu thông tin bảo hành"').toBeVisible();
    const phoneTab = page.getByText(/^\s*Tra theo số điện thoại\s*$/i).first();
    await phoneTab.scrollIntoViewIfNeeded();
    await expect(phoneTab, 'Phải có tab "Tra theo số điện thoại"').toBeVisible();
    await phoneTab.click();
    await page.waitForTimeout(600);
    await dismissPopups(page);

    // Ô nhập tra cứu: placeholder "Mời nhập số điện thoại hoặc imei để tra cứu"
    const input = page.getByPlaceholder(/nhập số điện thoại hoặc imei/i).first();
    await input.scrollIntoViewIfNeeded();
    await expect(input, 'Phải có ô nhập tra cứu thông tin bảo hành').toBeVisible();
    await input.click();
    await input.fill('');
    await input.pressSequentially(PHONE, { delay: 100 });
    await expect(input, 'Ô tra cứu phải giữ đúng SĐT vừa nhập').toHaveValue(PHONE);
    note(`Đã nhập SĐT tester: ${PHONE.slice(0, 3)}****${PHONE.slice(-3)}`);

    // Step 5: bấm nút "Kiểm tra" (nút tra cứu của form)
    const before = await page.locator('body').innerText().catch(() => '');
    const lookupBtn = page.getByRole('button', { name: /^\s*Kiểm tra\s*$/i }).first();
    await expect(lookupBtn, 'Phải có nút "Kiểm tra" ở mục tra cứu bảo hành').toBeVisible();
    await pressLookup(page, input, lookupBtn, before);

    const systemErrRe = /\b404\b|lỗi\s*hệ\s*thống|internal\s*server|undefined|\[object|exception/i;
    const invalidRe = /không\s*hợp\s*lệ|vui\s*lòng\s*nhập\s*(đúng|lại)|sai\s*định\s*dạng/i;
    const notFoundRe = /không\s*(tìm\s*thấy|có\s*thông\s*tin|có\s*dữ\s*liệu|có\s*kết\s*quả)/i;
    const otpRe = /(mã\s*(xác\s*(thực|nhận|minh)|otp)|otp|gửi\s*(mã\s*)?(về|đến|tới)|xác\s*(thực|nhận)\s*(số\s*điện\s*thoại|sđt))/i;
    // Dấu hiệu có thông tin bảo hành: thời hạn / trạng thái / ngày mua... (chỉ xét phần chữ MỚI xuất hiện sau khi bấm Kiểm tra)
    const infoRe = /(thời\s*hạn|hạn\s*bảo\s*hành|ngày\s*(mua|kích\s*hoạt)|còn\s*bảo\s*hành|hết\s*bảo\s*hành|trạng\s*thái|sản\s*phẩm|imei|jobcard)/i;
    const beforeLines = new Set(before.split('\n').map((l) => l.trim()));
    const getAdded = async () => {
      const b = await page.locator('body').innerText().catch(() => '');
      return b.split('\n').map((l) => l.trim()).filter((l) => l && !beforeLines.has(l)).join('\n');
    };

    // Step 5b: trang yêu cầu xác thực bằng mã gửi về điện thoại (và reCAPTCHA) -> script KHÔNG tự đọc được SMS, tester tự nhập mã trên trình duyệt đang mở
    let added = await getAdded();
    note(`Nội dung mới sau khi bấm Kiểm tra: ${added ? added.replace(/\n/g, ' | ').slice(0, 400) : '(không có nội dung mới)'}`);
    const askedOtp = otpRe.test(added);
    note(askedOtp ? 'Trang yêu cầu nhập mã xác thực gửi về điện thoại' : 'Chưa thấy chữ yêu cầu mã xác thực (có thể đã hiện kết quả luôn hoặc nội dung khác)');

    if (!infoRe.test(added)) {
      console.log('\n>>> [Policy_Warranty_07] Hãy NHẬP MÃ XÁC THỰC gửi về điện thoại (và giải reCAPTCHA nếu có) NGAY TRÊN TRÌNH DUYỆT ĐANG MỞ rồi xác nhận. Script chờ tối đa 120 giây...\n');
      await test.step('Chờ tester tự nhập mã xác thực trên điện thoại (tối đa 120s)', async () => {
        await expect.poll(async () => infoRe.test(await getAdded()) || notFoundRe.test(await getAdded()), {
          timeout: 120_000, intervals: [1000],
          message: 'Hết 120s mà chưa thấy kết quả tra cứu (chưa nhập mã xác thực hoặc nhập sai mã)',
        }).toBeTruthy().catch(() => { });
      });
      await page.waitForTimeout(1500);
      added = await getAdded();
    }
    const body = await page.locator('body').innerText().catch(() => '');
    note(`Kết quả sau xác thực: ${added ? added.replace(/\n/g, ' | ').slice(0, 500) : '(không có nội dung mới)'}`);
    note(`Sau khi tra cứu: ${invalidRe.test(added) ? 'có báo SĐT không hợp lệ; ' : ''}${notFoundRe.test(added) ? 'có thông báo không tìm thấy; ' : ''}${infoRe.test(added) ? 'có từ khóa thông tin bảo hành' : 'chưa thấy từ khóa thông tin bảo hành'}`);

    // Expected 1: SĐT hợp lệ được chấp nhận; sau khi xác thực đúng mã thì hiển thị thông tin bảo hành gắn với SĐT
    check(!invalidRe.test(added), 'SĐT 10 số hợp lệ nhưng bị báo không hợp lệ');
    check(!notFoundRe.test(added), 'SĐT của tester (đã có dữ liệu bảo hành) nhưng trang báo không tìm thấy thông tin');
    check(infoRe.test(added), 'Không thấy thông tin bảo hành (sản phẩm, thời hạn, trạng thái) sau khi nhập mã xác thực');

    // Expected 2: không hiển thị dữ liệu của số khác (số điện thoại đầy đủ hiển thị trong kết quả phải trùng SĐT đã nhập; số bị che bằng * được bỏ qua)
    const shownPhones = Array.from(new Set((added.match(/\b0\d{9}\b/g) || []))).filter((n) => n !== PHONE);
    const footerPhones = ['1900232461', '1800 1063', '1900232465'];
    const otherPhones = shownPhones.filter((n) => !footerPhones.includes(n));
    check(otherPhones.length === 0, `Kết quả hiển thị SĐT khác với SĐT đã nhập: ${otherPhones.join(', ')}`);

    // Trang vẫn bình thường
    check(!systemErrRe.test(body.slice(0, 3000)), 'Trang hiện chữ báo lỗi hệ thống/404 sau khi tra cứu');
    check(/\/bao-hanh/i.test(page.url()), `Tra cứu làm rời trang bảo hành: ${page.url()}`);

    await page.screenshot({ path: 'test-results/Policy_Warranty_07.png' });
    note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : 'Tra cứu theo SĐT hợp lệ của tester: hiển thị thông tin bảo hành, không lỗi, không lẫn dữ liệu số khác');
  });

  // Policy_Warranty_08 - Tra cứu lại SĐT 0374138333 sau khi xác thực ở Warranty_07 rồi quay về trang chính sách
  // Bán tự động: tester nhập mã SMS đúng ở lần 1; lần 2 dùng lại SĐT 0374138333.
  test('Policy_Warranty_08 - Kiểm tra tra cứu lại cùng số điện thoại sau khi đã xác thực và quay lại trang chính sách', async ({ page }) => {
    test.setTimeout(480_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };
    const PHONE = '0374138333'; // Dùng cùng SĐT hợp lệ với Policy_Warranty_07
    const masked = `${PHONE.slice(0, 3)}****${PHONE.slice(-3)}`;

    // Lần 1: Step 1-6 giống Policy_Warranty_07
    await gotoWarrantyPage(page);
    let before = await submitPhoneLookup(page, PHONE);
    let added = await addedSince(page, before);
    note(`Lần 1 (${masked}) sau khi bấm Kiểm tra: ${added ? added.replace(/\n/g, ' | ').slice(0, 300) : '(không có nội dung mới)'}`);
    if (!LOOKUP_RE.info.test(added)) {
      await waitForManualOtpResult(page, before, 'Lần 1');
      added = await addedSince(page, before);
    }
    note(`Lần 1 kết quả: ${added ? added.replace(/\n/g, ' | ').slice(0, 400) : '(không có nội dung mới)'}`);
    // Không có kết quả lần 1 thì không có gì để so sánh lần 2
    expect(LOOKUP_RE.info.test(added), 'Lần 1: sau khi nhập mã xác thực phải hiện thông tin bảo hành (cần có kết quả lần 1 để làm lần 2)').toBeTruthy();
    await page.screenshot({ path: 'test-results/Policy_Warranty_08_lan1.png' });

    // Step 7: về trang chủ -> cuộn footer -> "Thông tin khác" -> "Chính sách bảo hành"
    await test.step('Quay về trang chủ, xuống footer, vào lại Chính sách bảo hành', async () => {
      await gotoWarrantyPage(page);
      note(`Đã quay lại trang chính sách bảo hành: ${page.url()}`);
    });

    // Step 8: tra cứu lại đúng SĐT đó -> kỳ vọng hiện luôn thông tin, không hỏi lại mã xác thực
    before = await submitPhoneLookup(page, PHONE);
    await expect.poll(async () => LOOKUP_RE.info.test(await addedSince(page, before)), { timeout: 10_000, intervals: [500] }).toBeTruthy().catch(() => { });
    const added2 = await addedSince(page, before);
    const directResult = LOOKUP_RE.info.test(added2);
    const askedAgain = !directResult && LOOKUP_RE.otp.test(added2);
    note(`Lần 2 (${masked}): ${directResult ? 'HIỆN LUÔN thông tin bảo hành, không hỏi lại mã xác thực' : askedAgain ? 'YÊU CẦU XÁC THỰC LẠI bằng mã' : 'chưa thấy thông tin bảo hành'} -> ${added2 ? added2.replace(/\n/g, ' | ').slice(0, 400) : '(không có nội dung mới)'}`);

    // Expected: không cần nhập lại mã, hiện ngay thông tin bảo hành của đúng số đó
    check(!askedAgain, 'Lần 2: trang yêu cầu xác thực lại bằng mã (đã xác thực ở lần 1 nhưng vẫn bị hỏi lại)');
    check(directResult, 'Lần 2: không thấy thông tin bảo hành hiện ngay sau khi nhập lại SĐT (phải hiện luôn, không cần nhập mã)');
    check(!LOOKUP_RE.notFound.test(added2), 'Lần 2: SĐT đã tra cứu được ở lần 1 nhưng lần 2 báo không tìm thấy thông tin');
    const otherPhones = Array.from(new Set(added2.match(/\b0\d{9}\b/g) || [])).filter((n) => n !== PHONE);
    check(otherPhones.length === 0, `Lần 2: hiển thị SĐT khác với SĐT đã nhập: ${otherPhones.join(', ')}`);
    const body = await page.locator('body').innerText().catch(() => '');
    check(!LOOKUP_RE.systemErr.test(body.slice(0, 3000)), 'Lần 2: trang hiện chữ báo lỗi hệ thống/404');
    check(/\/bao-hanh/i.test(page.url()), `Lần 2: rời khỏi trang bảo hành: ${page.url()}`);
    await page.screenshot({ path: 'test-results/Policy_Warranty_08_lan2.png' });

    const behavior = directResult ? 'hiện luôn thông tin, không hỏi lại mã xác thực' : askedAgain ? 'yêu cầu xác thực lại bằng mã' : 'không thấy thông tin';
    note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : `Lần 1 ra thông tin sau xác thực; về trang chủ -> footer -> chính sách bảo hành, tra lại cùng SĐT: ${behavior}; đúng số, không lỗi`);
  });

  // Policy_Warranty_09 - Tra cứu bằng SĐT 0985098199, tự nhập OTP sai 111111 rồi Enter
  // Hệ thống phải từ chối mã sai, không hiện thông tin bảo hành.
  test('Policy_Warranty_09 - Kiểm tra nhập sai mã xác thực (OTP) khi tra cứu bảo hành theo số điện thoại', async ({ page }) => {
    test.setTimeout(120_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };
    const PHONE = '0985098199';
    const masked = `${PHONE.slice(0, 3)}****${PHONE.slice(-3)}`;
    // Popup thật báo: "Nhập mã xác nhận không đúng, vui lòng thử lại."
    const wrongOtpRe = /(mã|otp).{0,40}(sai|không\s*(đúng|hợp\s*lệ)|không\s*chính\s*xác|hết\s*hạn)|(sai|không\s*(đúng|hợp\s*lệ|chính\s*xác)).{0,40}(mã|otp)/i;
    const alertMessages = [];
    const onDialog = async (dialog) => { alertMessages.push(dialog.message()); await dialog.dismiss().catch(() => { }); };
    page.on('dialog', onDialog);

    // Step 1-5: giống Policy_Warranty_08 (vào trang bảo hành, chọn tab SĐT, nhập SĐT, bấm "Kiểm tra")
    await gotoWarrantyPage(page);
    const before = await submitPhoneLookup(page, PHONE);
    let added = await addedSince(page, before);
    note(`Sau khi bấm Kiểm tra (${masked}): ${added ? added.replace(/\n/g, ' | ').slice(0, 300) : '(không có nội dung mới)'}`);
    await page.screenshot({ path: 'test-results/Policy_Warranty_09_truoc_nhap_otp.png' });

    // Step 6: tự nhập mã sai cố định 111111 và gửi bằng Enter.
    const otpInputs = page.locator('input:visible');
    const otpInputIndex = await otpInputs.evaluateAll((nodes) => nodes.findIndex((node) => {
      const input = node;
      const hint = `${input.getAttribute('placeholder') || ''} ${input.getAttribute('aria-label') || ''} ${input.getAttribute('name') || ''} ${input.id || ''}`;
      return /mã|otp|verification|verify|code|xác nhận/i.test(hint) || Number(input.getAttribute('maxlength')) === 6;
    }));
    expect(otpInputIndex, 'Không tìm thấy ô nhập OTP hiển thị trong popup xác nhận số điện thoại').toBeGreaterThanOrEqual(0);
    const otpInput = otpInputs.nth(otpInputIndex);
    await expect(otpInput, 'Ô OTP phải hiển thị').toBeVisible();
    await otpInput.fill('111111');
    await otpInput.press('Enter');
    note('Đã tự nhập OTP sai 111111 và nhấn Enter.');
    await expect.poll(async () => {
      const a = await addedSince(page, before);
      const text = `${a}\n${alertMessages.join('\n')}`;
      return wrongOtpRe.test(text) || LOOKUP_RE.info.test(a) || LOOKUP_RE.notFound.test(a);
    }, { timeout: 30_000, intervals: [500] }).toBeTruthy().catch(() => { });
    await page.waitForTimeout(1500);
    page.off('dialog', onDialog);

    added = await addedSince(page, before);
    const response = `${added}\n${alertMessages.join('\n')}`;
    const body = await page.locator('body').innerText().catch(() => '');
    note(`Sau khi nhập mã sai: ${response.replace(/\s+/g, ' ').trim().slice(0, 400) || '(không có nội dung mới)'}`);

    // Expected: mã sai bị từ chối, không lộ thông tin bảo hành, không lỗi hệ thống, vẫn ở trang bảo hành
    const wrongRejected = wrongOtpRe.test(response);
    check(wrongRejected, `Không thấy thông báo từ chối mã xác thực sai (phản hồi: ${response.replace(/\s+/g, ' ').slice(0, 300) || 'không có'})`);
    check(!LOOKUP_RE.info.test(added), 'Sau khi nhập mã sai vẫn xuất hiện thông tin bảo hành');
    check(!LOOKUP_RE.notFound.test(added), 'Sau khi nhập mã sai hệ thống báo không tìm thấy dữ liệu thay vì từ chối mã');
    check(!LOOKUP_RE.systemErr.test(body.slice(0, 3000)), 'Trang hiện chữ báo lỗi hệ thống/404 sau khi nhập mã sai');
    check(/\/bao-hanh/i.test(page.url()), `Luồng tra cứu rời trang bảo hành: ${page.url()}`);
    await page.screenshot({ path: 'test-results/Policy_Warranty_09_sau_nhap_otp.png' });

    note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : `SĐT ${masked}, tự nhập OTP sai 111111 và nhấn Enter: hệ thống từ chối mã, không hiện thông tin bảo hành, không lỗi hệ thống, vẫn ở trang bảo hành`);
  });

  // Policy_Warranty_11 - Ô tra cứu theo SĐT: nhập SĐT sai định dạng / văn bản -> báo không hợp lệ, không tra cứu, không gửi mã xác thực, không lỗi hệ thống
  test('Policy_Warranty_11 - Kiểm tra nhập số điện thoại không hợp lệ hoặc văn bản vào ô tra cứu', async ({ page }) => {
    test.setTimeout(300_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };

    await gotoWarrantyPage(page); // Step 1 + 2
    const warrantyUrl = page.url();

    const inputs = [
      { label: '"090123" (thiếu số)', value: '090123' },
      { label: '"090123456789" (thừa số)', value: '090123456789' },
      { label: '"abcdefghij" (văn bản)', value: 'abcdefghij' },
      { label: '"09@#123456" (ký tự đặc biệt)', value: '09@#123456' },
    ];
    const feedbackRe = /không\s*hợp\s*lệ|sai|vui\s*lòng|định\s*dạng|10\s*(số|chữ\s*số)|nhập\s*(đúng|lại)|lỗi/i;
    const summary = [];

    for (const [idx, inp] of inputs.entries()) {
      await test.step(`Nhập ${inp.label}`, async () => {
        // mỗi giá trị tải lại trang để thông báo của lần trước không lẫn sang lần sau
        if (idx > 0) {
          await page.goto(warrantyUrl, { waitUntil: 'domcontentloaded' });
          await dismissPopups(page);
        }
        // Step 3: chọn tab "Tra theo số điện thoại"
        await expect(page.getByRole('heading', { name: /Tra cứu thông tin bảo hành/i }), 'Phải có mục "Tra cứu thông tin bảo hành"').toBeVisible();
        const phoneTab = page.getByText(/^\s*Tra theo số điện thoại\s*$/i).first();
        await phoneTab.scrollIntoViewIfNeeded();
        await expect(phoneTab, 'Phải có tab "Tra theo số điện thoại"').toBeVisible();
        await phoneTab.click();
        await page.waitForTimeout(600);
        await dismissPopups(page);

        // Step 4: nhập giá trị không hợp lệ (ô nhập có thể tự chặn/cắt ký tự -> ghi lại giá trị thực tế còn trong ô)
        const input = page.getByPlaceholder(/nhập số điện thoại hoặc imei/i).first();
        await input.scrollIntoViewIfNeeded();
        await expect(input, 'Phải có ô nhập tra cứu').toBeVisible();
        await input.click();
        await input.fill('');
        await input.pressSequentially(inp.value, { delay: 100 });
        const actual = await input.inputValue().catch(() => '');
        note(`[${inp.label}] Giá trị thực tế trong ô sau khi gõ: "${actual}"${actual !== inp.value ? ' (ô nhập tự lọc/cắt ký tự)' : ''}`);

        // Step 5: bấm "Kiểm tra" (thử lần lượt vài cách kích hoạt nút cho đến khi trang phản hồi)
        const before = await page.locator('body').innerText().catch(() => '');
        const lookupBtn = page.getByRole('button', { name: /^\s*Kiểm tra\s*$/i }).first();
        await expect(lookupBtn, 'Phải có nút "Kiểm tra"').toBeVisible();
        const reqs = [];
        const onReq = (r) => { if (r.method() === 'POST') reqs.push(`${r.method()} ${r.url().slice(0, 100)}`); };
        page.on('request', onReq);
        const how = await pressLookup(page, input, lookupBtn, before);
        page.off('request', onReq);
        await page.screenshot({ path: `test-results/Policy_Warranty_11_${idx + 1}_ngay_sau_khi_bam.png` }); // chụp ngay, chưa đóng popup nào

        const added = await addedSince(page, before);
        const body = await page.locator('body').innerText().catch(() => '');
        // Popup "XÁC NHẬN SỐ ĐIỆN THOẠI" dùng chung cho cả báo lỗi (chữ đỏ "Số điện thoại không hợp lệ!") và nhập mã xác thực -> chỉ coi là yêu cầu mã khi KHÔNG có chữ không hợp lệ
        const hasFeedback = feedbackRe.test(added);
        const asked = LOOKUP_RE.otp.test(added) && !/không\s*hợp\s*lệ/i.test(added);
        const gotInfo = LOOKUP_RE.info.test(added);
        note(`[${inp.label}] Sau khi bấm Kiểm tra: ${added ? added.replace(/\n/g, ' | ').slice(0, 300) : '(không có nội dung mới)'}${reqs.length ? ` | yêu cầu POST: ${reqs.join(', ')}` : ''}`);
        summary.push(`${inp.value}: ${hasFeedback ? 'có báo lỗi' : added ? 'có nội dung mới' : 'không phản hồi'}`);

        // Expected 1: có thông báo (số điện thoại không hợp lệ / yêu cầu nhập đúng) và không tra cứu
        check(how !== null || actual !== inp.value, `[${inp.label}] Script không kích hoạt được nút "Kiểm tra" (trang không phản hồi sau 4 cách bấm)`);
        check(hasFeedback || actual !== inp.value, `[${inp.label}] Không thấy thông báo số điện thoại không hợp lệ (nội dung mới: ${added ? added.replace(/\n/g, ' | ').slice(0, 150) : 'không có'})`);
        check(!asked, `[${inp.label}] Giá trị không hợp lệ nhưng trang vẫn yêu cầu nhập mã xác thực (coi như đã chấp nhận và gửi mã)`);
        check(!gotInfo, `[${inp.label}] Giá trị không hợp lệ nhưng trang hiển thị thông tin bảo hành`);
        // Expected 2: không lỗi hệ thống, vẫn ở trang bảo hành, ô nhập còn dùng được
        check(!LOOKUP_RE.systemErr.test(body.slice(0, 3000)), `[${inp.label}] Trang hiện chữ báo lỗi hệ thống/404`);
        check(/\/bao-hanh/i.test(page.url()), `[${inp.label}] Trang rời khỏi trang bảo hành: ${page.url()}`);
        check(await input.isEnabled().catch(() => false), `[${inp.label}] Ô nhập bị khóa/treo sau khi bấm Kiểm tra`);
        await page.screenshot({ path: `test-results/Policy_Warranty_11_${idx + 1}.png` });
      });
    }

    note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : `Nhập 4 giá trị không hợp lệ: không tra cứu, không gửi mã xác thực, không lỗi hệ thống (${summary.join('; ')})`);
  });

  // Policy_Warranty_12 - Nhập "777" rồi xóa hết ký tự, ô nhập trống rồi bấm "Kiểm tra" -> trên web thật KHÔNG có phản ứng nào (không popup, không gửi mã, không thông tin)
  test('Policy_Warranty_12 - Kiểm tra bấm tra cứu khi để trống ô nhập', async ({ page }) => {
    test.setTimeout(180_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };

    await gotoWarrantyPage(page); // Step 1 + 2

    // Step 3: chọn tab "Tra theo số điện thoại"
    await expect(page.getByRole('heading', { name: /Tra cứu thông tin bảo hành/i }), 'Phải có mục "Tra cứu thông tin bảo hành"').toBeVisible();
    const phoneTab = page.getByText(/^\s*Tra theo số điện thoại\s*$/i).first();
    await phoneTab.scrollIntoViewIfNeeded();
    await expect(phoneTab, 'Phải có tab "Tra theo số điện thoại"').toBeVisible();
    await phoneTab.click();
    await page.waitForTimeout(600);
    await dismissPopups(page);
    const input = page.getByPlaceholder(/nhập số điện thoại hoặc imei/i).first();
    await input.scrollIntoViewIfNeeded();
    await expect(input, 'Phải có ô nhập tra cứu').toBeVisible();

    // Step 4: nhập "777" (chưa bấm Kiểm tra)
    await input.click();
    await input.fill('');
    await input.pressSequentially('777', { delay: 100 });
    await expect(input, 'Ô nhập phải giữ "777" vừa gõ').toHaveValue('777');

    // Step 5: xóa hết ký tự -> ô nhập trống
    await input.press('Control+A');
    await input.press('Backspace');
    await expect(input, 'Sau khi xóa hết ký tự, ô nhập phải trống').toHaveValue('');

    // Step 6: bấm "Kiểm tra" khi ô đang trống (thử lần lượt các cách bấm, dừng ngay nếu trang có phản hồi)
    const before = await page.locator('body').innerText().catch(() => '');
    const lookupBtn = page.getByRole('button', { name: /^\s*Kiểm tra\s*$/i }).first();
    await expect(lookupBtn, 'Phải có nút "Kiểm tra"').toBeVisible();
    const reqs = [];   // POST giống yêu cầu tra cứu bảo hành/gửi mã xác thực
    const noise = [];  // POST nền khác (reCAPTCHA, thống kê, khung gợi ý AI...) -> chỉ ghi chú, không tính lỗi
    const lookupUrlRe = /bao-?hanh|warranty|tra-?cuu|lookup|otp|sms|verify|xac-?thuc|imei|jobcard|phone/i;
    const onReq = (r) => {
      if (r.method() !== 'POST') return;
      const line = `${r.method()} ${r.url().slice(0, 100)}`;
      (lookupUrlRe.test(r.url()) && !/recaptcha|google|gstatic|\/metrics\//i.test(r.url()) ? reqs : noise).push(line);
    };
    page.on('request', onReq);
    const tried = [];
    for (const [name, run] of lookupStrategies(page, input, lookupBtn)) {
      await run().catch(() => { });
      tried.push(name);
      await page.waitForTimeout(2500);
      if ((await addedSince(page, before)).trim()) break;
    }
    page.off('request', onReq);
    await page.screenshot({ path: 'test-results/Policy_Warranty_12_ngay_sau_khi_bam.png' }); // chụp ngay, chưa đóng popup nào

    const added = await addedSince(page, before);
    const body = await page.locator('body').innerText().catch(() => '');
    const warrantyInfoRe = /(thời\s*hạn|hạn\s*bảo\s*hành|ngày\s*(mua|kích\s*hoạt)|còn\s*bảo\s*hành|hết\s*bảo\s*hành|trạng\s*thái|sản\s*phẩm)/i;
    note(`Nhập "777" rồi xóa hết, bấm Kiểm tra (đã thử: ${tried.join('; ')}). Nội dung mới: ${added ? added.replace(/\n/g, ' | ').slice(0, 300) : '(không có nội dung mới)'}${reqs.length ? ` | yêu cầu POST: ${reqs.join(', ')}` : ' | không có yêu cầu POST tra cứu nào'}${noise.length ? ` | POST nền không liên quan tra cứu (bỏ qua): ${noise.join(', ')}` : ''}`);

    // Expected 1: không có phản ứng nào - không popup/thông báo, không hỏi mã, không thông tin bảo hành, không gửi yêu cầu
    check(!added.trim(), `Ô trống nhưng trang có phản ứng (nội dung mới: ${added.replace(/\n/g, ' | ').slice(0, 150)})`);
    check(!LOOKUP_RE.otp.test(added), 'Ô trống nhưng trang yêu cầu nhập mã xác thực (coi như đã chấp nhận và gửi mã)');
    check(!warrantyInfoRe.test(added), 'Ô trống nhưng trang hiển thị thông tin bảo hành');
    check(reqs.length === 0, `Ô trống nhưng trang vẫn gửi yêu cầu POST tra cứu: ${reqs.join(', ')}`);
    // Expected 2: không lỗi hệ thống, vẫn ở trang bảo hành, ô nhập còn dùng được và vẫn trống
    check(!LOOKUP_RE.systemErr.test(body.slice(0, 3000)), 'Trang hiện chữ báo lỗi hệ thống/404');
    check(/\/bao-hanh/i.test(page.url()), `Trang rời khỏi trang bảo hành: ${page.url()}`);
    check(await input.isEnabled().catch(() => false), 'Ô nhập bị khóa/treo sau khi bấm Kiểm tra');
    check((await input.inputValue().catch(() => 'x')) === '', 'Ô nhập không còn trống sau khi bấm Kiểm tra');

    note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : 'Nhập "777" rồi xóa hết, bấm Kiểm tra: không có phản ứng nào (không popup, không gửi mã, không thông tin bảo hành), không lỗi hệ thống, ô nhập vẫn dùng được');
  });

  // Policy_Warranty_13 - Tra cứu theo mã IMEI hợp lệ (15 số) -> mã được chấp nhận; hiện thông tin bảo hành hoặc thông báo không tìm thấy, không báo lỗi định dạng
  test('Policy_Warranty_13 - Kiểm tra tra cứu theo mã IMEI hợp lệ (351942834952242)', async ({ page }) => {
    test.setTimeout(300_000); // phòng khi trang yêu cầu xác thực mã
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };
    const IMEI = '351942834952242';

    await gotoWarrantyPage(page); // Step 1 + 2

    // Step 3: chọn tab "Tra theo mã IMEI"
    await expect(page.getByRole('heading', { name: /Tra cứu thông tin bảo hành/i }), 'Phải có mục "Tra cứu thông tin bảo hành"').toBeVisible();
    const imeiTab = page.getByText(/^\s*Tra theo mã IMEI\s*$/i).first();
    await imeiTab.scrollIntoViewIfNeeded();
    await expect(imeiTab, 'Phải có tab "Tra theo mã IMEI"').toBeVisible();
    await imeiTab.click();
    await page.waitForTimeout(600);
    await dismissPopups(page);

    // Step 4: nhập mã IMEI (placeholder có thể đổi theo tab -> tìm ô nhập đang hiện có chữ imei/số điện thoại)
    const input = page.getByPlaceholder(/imei|số điện thoại/i).locator('visible=true').first();
    await input.scrollIntoViewIfNeeded();
    await expect(input, 'Phải có ô nhập tra cứu theo IMEI').toBeVisible();
    await input.click();
    await input.fill('');
    // Chẩn đoán: ô nhập có giới hạn độ dài (maxlength) không, tab IMEI đã được chọn chưa
    const maxLen = await input.getAttribute('maxlength').catch(() => null);
    const tabInfo = await imeiTab.evaluate((el) => { const li = el.closest('li') || el; return `class="${li.className}" aria-selected="${li.getAttribute('aria-selected')}"`; }).catch(() => '(không đọc được)');
    note(`Trước khi gõ: maxlength của ô = ${maxLen === null ? '(không đặt)' : maxLen}; tab IMEI ${tabInfo}`);
    await input.pressSequentially(IMEI, { delay: 100 });
    const actual = await input.inputValue().catch(() => '');
    note(`Giá trị trong ô sau khi gõ: "${actual}" (${actual.length}/${IMEI.length} số)`);
    await page.screenshot({ path: 'test-results/Policy_Warranty_13_sau_khi_go.png' });
    check(actual === IMEI, `Ô tra cứu IMEI không giữ đủ 15 số: gõ "${IMEI}" nhưng chỉ còn "${actual}" (${actual.length} số, maxlength=${maxLen})`);
    if (actual !== IMEI) { note(`Lỗi (${failures.length}): ${failures.join(' || ')}`); return; } // ô nhập đã cắt mã, không bấm tra cứu với mã sai

    // Step 5: bấm "Kiểm tra"
    const before = await page.locator('body').innerText().catch(() => '');
    const lookupBtn = page.getByRole('button', { name: /^\s*Kiểm tra\s*$/i }).first();
    await expect(lookupBtn, 'Phải có nút "Kiểm tra" ở mục tra cứu bảo hành').toBeVisible();
    await pressLookup(page, input, lookupBtn, before);

    let added = await addedSince(page, before);
    note(`Nội dung mới sau khi bấm Kiểm tra: ${added ? added.replace(/\n/g, ' | ').slice(0, 400) : '(không có nội dung mới)'}`);

    // Nếu trang chưa có kết quả mà đang hỏi mã xác thực -> tester tự nhập mã trên trình duyệt đang mở
    if (!LOOKUP_RE.info.test(added) && !LOOKUP_RE.notFound.test(added) && LOOKUP_RE.otp.test(added)) {
      note('Trang yêu cầu mã xác thực khi tra cứu IMEI');
      await waitForManualOtpResult(page, before, 'Policy_Warranty_13');
      added = await addedSince(page, before);
    } else {
      await page.waitForTimeout(2000);
      added = await addedSince(page, before);
    }
    const body = await page.locator('body').innerText().catch(() => '');
    const gotInfo = LOOKUP_RE.info.test(added);
    const notFound = LOOKUP_RE.notFound.test(added);
    note(`Kết quả: ${added ? added.replace(/\n/g, ' | ').slice(0, 500) : '(không có nội dung mới)'} => ${gotInfo ? 'có thông tin bảo hành' : notFound ? 'báo không tìm thấy dữ liệu' : 'chưa thấy kết quả'}`);

    // Expected 1: IMEI 15 số được chấp nhận, không báo lỗi định dạng
    check(!/không\s*hợp\s*lệ|sai\s*định\s*dạng|vui\s*lòng\s*nhập\s*(đúng|lại)/i.test(added), 'IMEI 15 số hợp lệ nhưng bị báo không hợp lệ/sai định dạng');
    // Expected 2: hiển thị thông tin bảo hành hoặc thông báo không tìm thấy dữ liệu
    check(gotInfo || notFound, `Không thấy thông tin bảo hành hoặc thông báo không tìm thấy sau khi tra cứu IMEI (nội dung mới: ${added ? added.replace(/\n/g, ' | ').slice(0, 150) : 'không có'})`);
    // Không lỗi hệ thống, vẫn ở trang bảo hành
    check(!LOOKUP_RE.systemErr.test(body.slice(0, 3000)), 'Trang hiện chữ báo lỗi hệ thống/404 sau khi tra cứu');
    check(/\/bao-hanh/i.test(page.url()), `Tra cứu làm rời trang bảo hành: ${page.url()}`);

    await page.screenshot({ path: 'test-results/Policy_Warranty_13.png' });
    note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : `Tra cứu IMEI hợp lệ: được chấp nhận, ${gotInfo ? 'hiển thị thông tin bảo hành' : 'báo không tìm thấy dữ liệu'}, không lỗi hệ thống`);
  });

  // Policy_Warranty_14 - Tra cứu theo mã IMEI không tồn tại: "3519428349522422" và "abc" -> hiển thị thông báo không tìm thấy thông tin bảo hành
  test('Policy_Warranty_14 - Kiểm tra tra cứu theo mã IMEI không tồn tại (3519428349522422 và abc)', async ({ page }) => {
    test.setTimeout(240_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };

    await gotoWarrantyPage(page); // Step 1 + 2
    const warrantyUrl = page.url();

    const inputs = ['3519428349522422', 'abc'];
    const results = [];

    for (const [idx, value] of inputs.entries()) {
      await test.step(`Nhập "${value}"`, async () => {
        // mỗi giá trị tải lại trang để kết quả của lần trước không lẫn sang lần sau
        if (idx > 0) {
          await page.goto(warrantyUrl, { waitUntil: 'domcontentloaded' });
          await dismissPopups(page);
        }
        // Step 3: chọn tab "Tra theo mã IMEI"
        await expect(page.getByRole('heading', { name: /Tra cứu thông tin bảo hành/i }), 'Phải có mục "Tra cứu thông tin bảo hành"').toBeVisible();
        const imeiTab = page.getByText(/^\s*Tra theo mã IMEI\s*$/i).first();
        await imeiTab.scrollIntoViewIfNeeded();
        await expect(imeiTab, 'Phải có tab "Tra theo mã IMEI"').toBeVisible();
        await imeiTab.click();
        await page.waitForTimeout(600);
        await dismissPopups(page);

        // Step 4: nhập mã
        const input = page.getByPlaceholder(/imei|số điện thoại/i).locator('visible=true').first();
        await input.scrollIntoViewIfNeeded();
        await expect(input, 'Phải có ô nhập tra cứu theo IMEI').toBeVisible();
        await input.click();
        await input.fill('');
        await input.pressSequentially(value, { delay: 100 });
        const actual = await input.inputValue().catch(() => '');
        note(`[${value}] Giá trị thực tế trong ô sau khi gõ: "${actual}"`);

        // Step 5: bấm "Kiểm tra"
        const before = await page.locator('body').innerText().catch(() => '');
        const lookupBtn = page.getByRole('button', { name: /^\s*Kiểm tra\s*$/i }).first();
        await expect(lookupBtn, 'Phải có nút "Kiểm tra"').toBeVisible();
        await pressLookup(page, input, lookupBtn, before);
        await page.waitForTimeout(1500);

        const added = await addedSince(page, before);
        const msg = added.replace(/\s+/g, ' ').trim();
        results.push(msg);
        note(`[${value}] Sau khi bấm Kiểm tra: ${msg ? msg.slice(0, 300) : '(không có nội dung mới)'}`);

        // Expected: hiển thị thông báo không tìm thấy thông tin bảo hành
        check(LOOKUP_RE.notFound.test(added), `[${value}] Không thấy thông báo không tìm thấy thông tin bảo hành (nội dung mới: ${msg ? msg.slice(0, 150) : 'không có'})`);
        await page.screenshot({ path: `test-results/Policy_Warranty_14_${idx + 1}.png` });
      });
    }

    note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : 'Cả 2 mã (3519428349522422, abc): hiển thị thông báo không tìm thấy thông tin bảo hành');
  });

  // Policy_Contact_01 - vòng 1: Open từng số; vòng 2: tick + Open số Gọi mua; cuối cùng bấm Khiếu nại để ghi nhận hộp thoại còn hiện không.
  test('Policy_Contact_01 - Kiểm tra bấm số tổng đài chọn "Open Pick an app" (Open, tick + Open) ở hộp thoại "Open Pick an app?"', async ({ page }) => {
    test.skip(!IS_WIN, 'Case này gửi phím tới hộp thoại của trình duyệt, chỉ chạy trên Windows');
    test.setTimeout(300_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };

    const column = await openSupportColumn(page);
    const urlBefore = page.url();

    await runDialogRounds(page, column, urlBefore, [
      { name: 'Open Pick an app', tick: false, action: 'open' },
      { name: 'tick "Always allow" + Open Pick an app', tick: true, action: 'open', onlyFirst: true },
    ], 'Policy_Contact_01', failures, check);

    // Ghi nhận trạng thái hộp thoại sau khi đã tick "Always allow" + Open.
    await test.step('Ghi nhận hộp thoại: bấm số Khiếu nại sau khi đã tick "Always allow" + Open', async () => {
      await screenShot('test-results/Policy_Contact_01_quansat_base.png');
      await clickSupportNumber(page, column, SUPPORT_LINES[1]);
      await screenShot('test-results/Policy_Contact_01_quansat_after.png');
      const r = await screenDiffRatio('test-results/Policy_Contact_01_quansat_base.png', 'test-results/Policy_Contact_01_quansat_after.png');
      note(`Sau khi tick "Always allow" + Open, bấm số Khiếu nại: ${r >= DIALOG_ON ? 'hộp thoại còn hiện' : 'hộp thoại không còn hiện hoặc đã mở thẳng ứng dụng'} (mức thay đổi ${r}; ngưỡng ${DIALOG_ON}) - xem ảnh Policy_Contact_01_quansat_after.png`);
      await sendKeys(page, '{ESC}');
      await page.bringToFront();
    });
    await expectStillOnPage(page, urlBefore, failures, check);

    note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : 'Luồng Open: vòng 1 đã Open cả 3 số; vòng 2 tick "Always allow" + Open số Gọi mua; đã ghi nhận trạng thái hộp thoại khi bấm Khiếu nại; trang không chuyển, không lỗi');
  });

  // Policy_Form_01 - Trang [Gửi góp ý, khiếu nại]: không nhập gì, bấm gửi -> không gửi được, có thông báo lỗi tiếng Việt, không ghi nhận góp ý rỗng
  // Danh sách trường bắt buộc thực tế chưa xác nhận trước -> script ghi lại từng trường (nhãn/placeholder/bắt buộc) và mọi phản hồi của trang
  // (nội dung mới, hộp thoại alert, thông báo native của trình duyệt, yêu cầu POST) vào annotation "note" để đối chiếu và cập nhật Expected Output trong Excel.
  test('Policy_Form_01 - Kiểm tra bấm gửi khi chưa nhập thông tin ở trang [Gửi góp ý, khiếu nại]', async ({ page }) => {
    test.setTimeout(180_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };

    // Step 1 + 2: trang chủ -> footer -> cột "Về công ty" -> "Gửi góp ý, khiếu nại"
    const { target, linkHref } = await gotoFeedbackPage(page);

    // Expected 1: mở đúng trang Gửi góp ý, khiếu nại, không lỗi 404
    await expect(target, 'Phải chuyển sang trang khác trang chủ').not.toHaveURL(BASE_URL + '/');
    const pageTitle = await target.title().catch(() => '');
    const headings = (await target.locator('h1, h2, h3').allInnerTexts().catch(() => [])).join(' | ');
    note(`Tiêu đề tab: "${pageTitle}"; heading: "${headings.slice(0, 150)}"`);
    const bodyOpen = (await target.locator('body').innerText().catch(() => '')) || '';
    check(!/\b404\b|không\s*tìm\s*thấy\s*trang|page\s*not\s*found/i.test(bodyOpen.slice(0, 1500)), `Trang góp ý báo lỗi 404 (${target.url()})`);
    const titleRe = /góp\s*ý|khiếu\s*nại|liên\s*hệ/i;
    check(titleRe.test(pageTitle) || titleRe.test(headings), `Tiêu đề trang (tab: "${pageTitle}"; heading: "${headings.slice(0, 80)}") không nói về góp ý/khiếu nại; URL: ${target.url()}`);

    // Quan sát form: ghi lại danh sách trường thực tế
    const fields = await describeFormFields(target);
    const requiredFields = fields.filter((f) => f.required);
    note(`Số trường nhập thấy được: ${fields.length} -> ${fields.map((f) => `${f.display}${f.required ? ' (*)' : ''}`).join(' | ')}`);
    note(`Trường có thuộc tính bắt buộc (required): ${requiredFields.length ? requiredFields.map((f) => f.display).join(' | ') : '(không có - trang có thể tự kiểm tra bằng JavaScript)'}`);
    expect(fields.length, 'Trang phải có ít nhất 1 ô nhập của form góp ý').toBeGreaterThanOrEqual(1);

    // Nút gửi: ưu tiên nút/ô submit, nếu không có thì tìm nút có chữ "Gửi"
    const sendRe = /^\s*(gửi(\s*(góp\s*ý|khiếu\s*nại|ý\s*kiến|đi|ngay))?|send|submit)\s*$/i;
    const submitCandidates = [
      target.locator('input[type="submit"]:visible').first(),
      target.locator('button[type="submit"]:visible').first(),
      target.locator('button:visible, input[type="button"]:visible, a[role="button"]:visible, a.btn:visible').filter({ hasText: sendRe }).first(),
      target.locator('button:visible, a[role="button"]:visible, a.btn:visible').filter({ hasText: /gửi/i }).first(),
    ];
    let submitBtn = null;
    for (const c of submitCandidates) {
      if (await c.isVisible().catch(() => false)) { submitBtn = c; break; }
    }
    check(submitBtn !== null, 'Form phải có nút gửi hiển thị rõ');
    if (!submitBtn) { note(`Lỗi (${failures.length}): ${failures.join(' || ')}`); return; }
    const btnLabel = ((await submitBtn.innerText().catch(() => '')) || (await submitBtn.getAttribute('value').catch(() => '')) || '').trim();
    note(`Nút gửi: "${btnLabel}"`);
    await submitBtn.scrollIntoViewIfNeeded().catch(() => { });

    // Step 3: KHÔNG nhập ký tự nào -> xác nhận mọi ô văn bản đang trống rồi mới bấm gửi
    for (const f of fields.filter((x) => x.tag !== 'select')) {
      const v = await f.el.inputValue().catch(() => '');
      check(v.trim() === '', `Ô "${f.display}" không trống trước khi bấm gửi (giá trị: "${v}") - điều kiện "chưa nhập thông tin" không đúng`);
    }

    // Chuẩn bị bắt phản hồi: hộp thoại alert, yêu cầu POST, nội dung mới, trạng thái kiểm tra hợp lệ của từng ô
    const dialogs = [];
    target.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss().catch(() => { }); });
    const posts = [];   // POST có thể là gửi góp ý
    const noise = [];   // POST nền (reCAPTCHA, thống kê...) -> chỉ ghi chú, không tính lỗi
    const onResponse = async (res) => {
      const req = res.request();
      if (req.method() !== 'POST') return;
      const line = `POST ${req.url().slice(0, 100)} -> ${res.status()}`;
      if (/recaptcha|google|gstatic|doubleclick|\/metrics\/|analytics|facebook|tiktok/i.test(req.url())) { noise.push(line); return; }
      const body = await res.text().catch(() => '');
      posts.push({ line, status: res.status(), body: body.slice(0, 200) });
    };
    target.on('response', onResponse);

    const readStates = () => evalWithTimeout(target, () => Array.from(document.querySelectorAll('input, textarea, select'))
      .filter((e) => !['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].includes(e.type))
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map((e) => ({
        name: e.name || e.id || e.placeholder || '',
        required: !!e.required,
        valueMissing: !!(e.validity && e.validity.valueMissing),
        nativeMsg: e.validationMessage || '',
        ariaInvalid: e.getAttribute('aria-invalid') === 'true',
        errClass: /error|invalid|is-danger|has-error/i.test(`${e.className} ${(e.parentElement && e.parentElement.className) || ''}`),
        focused: document.activeElement === e,
      })), [], 5000);

    // Chỉ so sánh phần NẰM TRONG form (và các thông báo lỗi hiện ra) - nội dung ngoài form (banner giá, "Tìm siêu thị (n shop)"...) tự đổi liên tục, không phải phản hồi của form
    const scope = (await submitBtn.locator('xpath=ancestor::form[1]').count()) > 0
      ? submitBtn.locator('xpath=ancestor::form[1]')
      : submitBtn.locator('xpath=ancestor::*[.//input or .//textarea][1]');
    const scopeText = async () => (await scope.innerText().catch(() => '')) || '';
    const errTexts = async () => (await target.locator('[class*="error" i]:visible, [class*="invalid" i]:visible, [role="alert"]:visible').allInnerTexts().catch(() => []))
      .flatMap((x) => x.split('\n')).map((l) => l.trim()).filter(Boolean);
    const beforeBody = await target.locator('body').innerText().catch(() => '');
    const before = await scopeText();
    const errBefore = new Set(await errTexts());
    const scopedAdded = async () => {
      const seen = new Set(before.split('\n').map((l) => l.trim()));
      const lines = (await scopeText()).split('\n').map((l) => l.trim()).filter((l) => l && !seen.has(l));
      for (const e of await errTexts()) if (!errBefore.has(e) && !lines.includes(e)) lines.push(e);
      return lines.join('\n');
    };
    const urlBefore = target.url();
    const statesBefore = await readStates();

    // Step 3 (tiếp): bấm nút gửi
    await submitBtn.click().catch(() => { });
    const react = async () => {
      const added = (await scopedAdded()).trim();
      const st = await readStates();
      const nativeFlag = st.some((s) => s.valueMissing && s.required);
      const flagged = st.some((s, i) => (s.ariaInvalid && !(statesBefore[i] && statesBefore[i].ariaInvalid)) || (s.errClass && !(statesBefore[i] && statesBefore[i].errClass)));
      return { added, st, signal: added.length > 0 || dialogs.length > 0 || nativeFlag || flagged || target.url() !== urlBefore };
    };
    let r = await react();
    for (let waited = 0; !r.signal && waited < 4000; waited += 500) { await target.waitForTimeout(500); r = await react(); }
    if (!r.signal) {
      // nút có thể không nhận cú click tự động -> thử bấm bằng JavaScript một lần rồi đợi tiếp
      note('Bấm chuột chưa thấy phản hồi, thử bấm lại bằng JavaScript (el.click())');
      await submitBtn.evaluate((el) => el.click()).catch(() => { });
      for (let waited = 0; !r.signal && waited < 4000; waited += 500) { await target.waitForTimeout(500); r = await react(); }
    }
    target.off('response', onResponse);
    await target.waitForTimeout(500);

    const body = (await target.locator('body').innerText().catch(() => '')) || '';
    const added = r.added;
    const nativeMsgs = Array.from(new Set(r.st.filter((s) => s.nativeMsg).map((s) => `${s.name}: ${s.nativeMsg}`)));
    const missingFields = r.st.filter((s) => s.valueMissing).map((s) => s.name || '(không tên)');
    const ariaFields = r.st.filter((s) => s.ariaInvalid || s.errClass).map((s) => s.name || '(không tên)');
    const feedback = [added.replace(/\n/g, ' | '), ...dialogs.map((m) => `[alert] ${m}`)].filter(Boolean).join(' | ');
    note(`Nội dung mới trong form sau khi bấm gửi: ${feedback ? feedback.slice(0, 500) : '(không có)'}`);
    const outside = (await addedSince(target, beforeBody)).split('\n').filter((l) => !added.includes(l)).join(' | ');
    if (outside) note(`Nội dung đổi NGOÀI form (banner/tìm siêu thị..., không tính là phản hồi của form): ${outside.slice(0, 300)}`);
    if (nativeMsgs.length) note(`Thông báo native của trình duyệt (trường bỏ trống): ${nativeMsgs.join(' ; ').slice(0, 400)}`);
    if (ariaFields.length) note(`Trường được đánh dấu lỗi (aria-invalid/class lỗi): ${ariaFields.join(', ')}`);
    note(posts.length ? `Yêu cầu POST sau khi bấm gửi: ${posts.map((p) => p.line).join(' ; ')}` : 'Không có yêu cầu POST gửi góp ý nào');
    if (noise.length) note(`POST nền không liên quan góp ý (bỏ qua): ${noise.join(' ; ').slice(0, 300)}`);
    note(`URL sau khi bấm gửi: ${target.url()} (trước: ${urlBefore})`);

    // Expected 2: không gửi được; có thông báo lỗi (ở từng trường bắt buộc còn trống hoặc thông báo chung)
    const hasFeedback = feedback.length > 0 || nativeMsgs.length > 0 || missingFields.length > 0 || ariaFields.length > 0;
    check(hasFeedback, 'Bấm gửi khi chưa nhập gì nhưng trang không có phản hồi nào (không thông báo lỗi, không đánh dấu trường bắt buộc) - im lặng');
    // Thông báo chữ (nếu có) phải bằng tiếng Việt, nêu rõ phải nhập/bắt buộc
    const viErrRe = /bắt\s*buộc|vui\s*lòng|không\s*được\s*(để\s*)?trống|chưa\s*(nhập|điền)|nhập\s*(họ|tên|số|nội|email|thông)|không\s*hợp\s*lệ|thiếu|điền/i;
    if (feedback) check(viErrRe.test(feedback), `Thông báo lỗi không rõ ràng/không phải tiếng Việt (nội dung mới: ${feedback.slice(0, 150)})`);
    if (nativeMsgs.length && !feedback) note('Chỉ có thông báo native của trình duyệt (có thể hiển thị bằng ngôn ngữ giao diện trình duyệt, không phải tiếng Việt): cần đối chiếu bằng mắt');
    // Có trường required bỏ trống -> mỗi trường bắt buộc đều phải được báo (native hoặc đánh dấu lỗi), hoặc có thông báo chung
    if (requiredFields.length > 1 && !feedback && !ariaFields.length) {
      note(`Chỉ báo trường đầu tiên thiếu (cách báo native của trình duyệt): ${missingFields.slice(0, 1).join('')}; còn ${Math.max(missingFields.length - 1, 0)} trường bắt buộc khác chưa được báo riêng`);
    }

    // Expected 3: không ghi nhận góp ý rỗng -> không có thông báo thành công, không chuyển sang trang cảm ơn, không POST thành công
    const successRe = /gửi\s*(góp\s*ý\s*|khiếu\s*nại\s*)?thành\s*công|cảm\s*ơn\s*(bạn|quý\s*khách)|đã\s*(ghi\s*nhận|tiếp\s*nhận|gửi)/i;
    check(!successRe.test(added) && !dialogs.some((m) => successRe.test(m)), `Góp ý rỗng nhưng trang báo gửi thành công/cảm ơn (nội dung mới: ${feedback.slice(0, 150)})`);
    check(!/thank|cam-on|thanh-cong|success/i.test(target.url().replace(urlBefore, '')), `Góp ý rỗng nhưng trang chuyển sang trang cảm ơn/thành công: ${target.url()}`);
    for (const p of posts) {
      check(!/"?success"?\s*[:=]\s*true|"?status"?\s*[:=]\s*"?(ok|success)|thành\s*công/i.test(p.body), `Góp ý rỗng nhưng máy chủ trả về kết quả thành công: ${p.line} ${p.body.slice(0, 100)}`);
      check(p.status < 500, `Góp ý rỗng làm máy chủ lỗi: ${p.line}`);
    }
    // Nếu có gửi POST lên máy chủ thì thông báo lỗi phải đến từ máy chủ -> ghi để đối chiếu (trang nên chặn ngay từ phía người dùng)
    if (posts.length) note('Trang đã gửi yêu cầu POST lên máy chủ dù các ô đang trống (kiểm tra phía máy chủ trả lỗi); cần đối chiếu có ghi nhận góp ý rỗng hay không');

    // Form vẫn dùng được, các ô vẫn trống, không lỗi hệ thống, không treo trang, vẫn ở trang góp ý
    check(!LOOKUP_RE.systemErr.test(body.slice(0, 3000)), 'Trang hiện chữ báo lỗi hệ thống/404 sau khi bấm gửi');
    check(!body.includes('\uFFFD'), 'Có ký tự lỗi font (�) trên trang');
    const pathOf = (u) => new URL(u).pathname.replace(/\/$/, '');
    check(pathOf(target.url()) === pathOf(urlBefore), `Trang rời khỏi trang góp ý sau khi bấm gửi: ${target.url()}`);
    if (target.url() !== urlBefore) note(`Form gửi bằng GET: bấm gửi làm URL thêm tham số (${target.url()}) nhưng vẫn ở cùng trang ${pathOf(target.url())}`);
    for (const f of fields.filter((x) => x.tag !== 'select')) {
      check((await f.el.inputValue().catch(() => 'x')).trim() === '', `Ô "${f.display}" không còn trống sau khi bấm gửi`);
      check(await f.el.isEnabled().catch(() => false), `Ô "${f.display}" bị khóa/treo sau khi bấm gửi`);
    }
    check(await submitBtn.isVisible().catch(() => false), 'Nút gửi biến mất sau khi bấm (có thể form đã bị khóa/gửi đi)');

    await target.screenshot({ path: 'test-results/Policy_Form_01.png', fullPage: true }).catch(() => { });
    note(failures.length
      ? `Lỗi (${failures.length}): ${failures.join(' || ')}`
      : `Bấm gửi khi chưa nhập gì: không gửi được, ${hasFeedback ? 'có thông báo/đánh dấu trường bắt buộc' : ''}, không báo thành công, form vẫn dùng được, không lỗi hệ thống (liên kết: ${linkHref})`);
  });

  // Policy_Form_02 - Điền đủ họ tên, SĐT, email, nội dung (dữ liệu thử nghiệm ghi rõ "Test") và gửi
  // Expected theo Excel (giống tinh thần Policy_Form_01: kiểm tra hành vi ĐÚNG, web sai thì case Failed): gửi thành công có thông báo xác nhận (hoặc trang cảm ơn); form được làm mới hoặc khóa; không lỗi hệ thống; không gửi trùng.
  // Hành vi thực tế ghi vào Note khi chạy để đối chiếu (đã quan sát trước đó: form gửi GET, trang tải lại ở /lien-he, dữ liệu nằm trên URL, không có thông báo xác nhận).
  test('Policy_Form_02 - Kiểm tra điền đầy đủ thông tin và gửi góp ý/khiếu nại', async ({ page }) => {
    test.setTimeout(180_000);
    const failures = [];
    const check = (ok, msg) => { if (!ok) failures.push(msg); expect.soft(ok, msg).toBeTruthy(); };
    const PHONE = /^0\d{9}$/.test((process.env.WARRANTY_PHONE || '').trim()) ? process.env.WARRANTY_PHONE.trim() : '0985098199'; // SĐT của tester
    const DATA = { username: 'Test', phone: PHONE, email: 'test@gmail.com', content: 'Test góp ý' };

    const { target } = await gotoFeedbackPage(page); // Step 1 + 2
    await expect(target, 'Phải vào trang góp ý (/lien-he)').toHaveURL(/lien-he/i);
    const formPath = new URL(target.url()).pathname.replace(/\/$/, '');

    // Step 3: nhập đầy đủ các trường
    const map = await fillFeedbackForm(target, DATA);
    note(`Đã nhập: ${Object.keys(map).map((k) => (map[k] ? map[k].display : `${k}: không thấy ô`)).join(' | ')}`);

    // Step 4: bấm gửi (đếm yêu cầu POST và số lần gửi để kiểm tra không gửi trùng)
    const submitBtn = await findFeedbackSubmit(target);
    expect(submitBtn, 'Form phải có nút gửi hiển thị rõ').not.toBeNull();
    const dialogs = [];
    target.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss().catch(() => { }); });
    const posts = [];
    const navs = [];
    const onReq = (r) => {
      if (/recaptcha|google|gstatic|\/metrics\/|facebook|tiktok|conversionsapigateway|doubleclick|analytics|\/api\/Store\//i.test(r.url())) return; // bỏ yêu cầu nền (thống kê, quảng cáo, lấy danh sách siêu thị), không phải gửi form
      if (r.method() === 'POST') posts.push(`POST ${r.url().slice(0, 120)}`);
      if (r.resourceType() === 'document' && /username=|phone=|email=|content=/i.test(r.url())) navs.push(r.url());
    };
    target.on('request', onReq);
    const bodyBefore = await target.locator('body').innerText().catch(() => '');
    const urlBefore = target.url();
    await submitBtn.click().catch(() => { });
    await target.waitForLoadState('domcontentloaded').catch(() => { });
    await target.waitForTimeout(2500);
    await dismissPopups(target);
    target.off('request', onReq);

    const body = (await target.locator('body').innerText().catch(() => '')) || '';
    const added = (await addedSince(target, bodyBefore)).trim();
    const successRe = /gửi\s*(góp\s*ý\s*|khiếu\s*nại\s*)?thành\s*công|cảm\s*ơn\s*(bạn|quý\s*khách)|đã\s*(ghi\s*nhận|tiếp\s*nhận)/i;
    const hasConfirm = successRe.test(added) || dialogs.some((m) => successRe.test(m));
    const url = new URL(target.url());
    note(`URL sau khi gửi: ${target.url()} (trước: ${urlBefore})`);
    note(`Thông báo xác nhận gửi thành công: ${hasConfirm ? 'CÓ' : 'KHÔNG CÓ'}; nội dung mới: ${added ? added.replace(/\n/g, ' | ').slice(0, 300) : '(không có)'}; hộp thoại alert: ${dialogs.join(' | ') || '(không)'}; POST: ${posts.join(' ; ') || '(không có)'}`);
    if (url.searchParams.get('username') || url.searchParams.get('email')) note('Form gửi bằng GET: dữ liệu đã nhập nằm trên URL (họ tên, SĐT, email, nội dung)');

    // Trạng thái form sau khi gửi: làm mới (các ô trống) hoặc khóa (các ô bị vô hiệu hóa)
    const after = await describeFormFields(target);
    const textFields = after.filter((x) => x.tag !== 'select');
    const leftover = [];
    for (const f of textFields) { const v = await f.el.inputValue().catch(() => ''); if (v) leftover.push(`${f.display}="${v}"`); }
    const enabledStates = await Promise.all(textFields.map((f) => f.el.isEnabled().catch(() => false)));
    const locked = textFields.length > 0 && enabledStates.every((en) => !en);
    note(`Các ô sau khi gửi: ${leftover.length ? `còn dữ liệu: ${leftover.join(', ')}` : 'đã trống (làm mới)'}${locked ? '; form bị khóa' : ''}`);

    // Expected 1: gửi thành công, hiển thị thông báo xác nhận (hoặc trang cảm ơn)
    check(hasConfirm, `Gửi đủ thông tin nhưng trang không hiển thị thông báo xác nhận gửi thành công/trang cảm ơn (nội dung mới: ${added ? added.replace(/\n/g, ' | ').slice(0, 150) : 'không có'})`);
    // Expected 2: form được làm mới hoặc khóa, không lỗi hệ thống, không gửi trùng
    check(leftover.length === 0 || locked, `Sau khi gửi form không được làm mới cũng không bị khóa (còn dữ liệu: ${leftover.join(', ')})`);
    check(!LOOKUP_RE.systemErr.test(body.slice(0, 3000)), 'Trang hiện chữ báo lỗi hệ thống/404 sau khi gửi');
    check(!body.includes('\uFFFD'), 'Có ký tự lỗi font (�) trên trang');
    check(navs.length <= 1 && posts.length <= 1, `Có thể gửi trùng: ghi nhận ${navs.length} lần gửi (GET) và ${posts.length} yêu cầu POST: ${[...navs, ...posts].join(' ; ')}`);

    await target.screenshot({ path: 'test-results/Policy_Form_02.png', fullPage: true }).catch(() => { });
    note(failures.length ? `Lỗi (${failures.length}): ${failures.join(' || ')}` : 'Gửi đủ thông tin: có thông báo xác nhận, form được làm mới/khóa, không lỗi hệ thống, không gửi trùng');
  });

  // Policy_Coop_01 - Form hợp tác bán hàng (Google Form): bỏ trống "Tên Doanh nghiệp của bạn?", điền hợp lệ các trường còn lại, bấm Gửi -> không gửi được, báo trường bắt buộc, giữ giá trị đã nhập
  test('Policy_Coop_01 - Gửi form hợp tác khi thiếu tên doanh nghiệp', async ({ page }) => {
    test.setTimeout(180_000);
    await runCoopMissingFieldCase(page, 'Policy_Coop_01', 'company');
  });

  // Policy_Coop_02 - Form hợp tác bán hàng (Google Form): bỏ trống "Địa chỉ văn phòng đại diện", bấm Gửi -> báo trường bắt buộc, giữ giá trị đã nhập; sau đó nhập luôn trường bị báo đỏ và bấm Gửi lần 2 -> quan sát gửi thành công
  test('Policy_Coop_02 - Gửi form hợp tác khi thiếu địa chỉ văn phòng đại diện', async ({ page }) => {
    test.setTimeout(180_000);
    await runCoopMissingFieldCase(page, 'Policy_Coop_02', 'address', { thenFix: true });
  });
});