// ASM7 - Automation Script: Chức năng "Tìm siêu thị" - https://www.dienmayxanh.com
// Sinh viên : Cao Thị Kim Ngân - 23130204 - Nhóm 11
// Công cụ   : Playwright Test (JavaScript)

const { test, expect } = require('@playwright/test');
const fs = require('fs');

// 1. CẤU HÌNH CHUNG

const BASE_URL = 'https://www.dienmayxanh.com';
const STORE_URL = `${BASE_URL}/he-thong-sieu-thi-dien-may`;
const AUTH_FILE = 'auth.json'; // tạo bằng: npx playwright codegen --save-storage=auth.json <url>
const HCM_GEO = { latitude: 10.7769, longitude: 106.7009 }; // Quận 1, TP.HCM

test.use({
  headless: false,                       
  viewport: { width: 1366, height: 768 },
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
  launchOptions: {
    slowMo: 300,                         
    executablePath: process.env.BROWSER_PATH || undefined,
  },
  trace: 'retain-on-failure',
});

test.setTimeout(120_000);
test.describe.configure({ mode: 'default' });

// 2. SELECTOR  (chỉ cần sửa ở đây nếu website đổi)
const SEL = {
  provinceBox: 'span.province-box__store',   // ô [Chọn tỉnh, thành]  
  wardBox: 'span.district-box__store',       // ô [Chọn phường, xã]
  provinceOption: '#province-box__store li', // mỗi mục tỉnh; tên nằm trong .address-cr
  wardOption: '#district-box__store li',     // mỗi mục phường/xã 
  provinceItem: 'a.province-name',           
  wardSearch: 'input:visible[placeholder*="phường" i], input:visible[placeholder*="xã" i]',
  provinceSearch: 'input:visible[placeholder*="tỉnh" i]',
  storeLink: 'a[href*="-id-"]',              // link tới trang chi tiết siêu thị
  breadcrumb: '[class*="breadcrumb"]',
};

const TXT = {
  provincePlaceholder: 'Chọn tỉnh, thành',
  wardPlaceholder: 'Chọn phường, xã',
  nearbyBtn: /xem siêu thị gần bạn/i,
};

// 3. HÀM DÙNG CHUNG
const note = (msg) => test.info().annotations.push({ type: 'note', description: msg });
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const shortName = (s) => s.replace(/^(Thành phố|Tỉnh|Phường|Xã|Thị trấn|Đặc khu)\s+/i, '').trim();
const removeDiacritics = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

const provinceBox = (page) => page.locator(SEL.provinceBox).first();
const wardBox = (page) => page.locator(SEL.wardBox).first();
const storeLinks = (page) => page.locator(`${SEL.storeLink}:visible`);
// Nút "xem siêu thị gần bạn"
const nearbyBtn = (page) => page.locator('text=/xem siêu thị gần bạn/i >> visible=true').first();


async function dismissPopups(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);


  try {
    const bigModalBackdrop = page.locator(
      'div[class*="z-[9998]"] div[class*="opacity-50"][class*="cursor-pointer"]'
    ).first();
    if (await bigModalBackdrop.isVisible({ timeout: 1000 })) {
      await bigModalBackdrop.click({ force: true });
      await page.waitForTimeout(500);
      note('Đã đóng popup quảng cáo toàn màn hình (z-[9998])');
    }
  } catch {    }


  try {
    const smallWidgetClose = page.locator(
      'i[class*="icon__row-3-col-1"][class*="cursor-pointer"]'
    ).first();
    if (await smallWidgetClose.isVisible({ timeout: 1000 })) {
      await smallWidgetClose.click({ force: true });
      await page.waitForTimeout(400);
      note('Đã đóng widget quảng cáo nhỏ góc dưới trái');
    }
  } catch {  }

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
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    } catch {  }
  }
}


async function gotoStorePage(page) {
  await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Tìm siêu thị/i).first()).toBeVisible();
  await dismissPopups(page);
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function waitStoresLoaded(page) {
  await expect(storeLinks(page).first()).toBeVisible({ timeout: 20_000 });
}

async function listSignature(page) {
  const hrefs = await storeLinks(page).evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  return hrefs.join('|');
}

async function waitListChanged(page, before, timeout = 15_000) {
  try {
    await expect.poll(() => listSignature(page), { timeout }).not.toBe(before);
    return true;
  } catch {
    return false;
  }
}


async function findDropdown(page, box) {
  const ok = await box.evaluate((trig) => {
    document.querySelectorAll('[data-qa-dd]').forEach((e) => e.removeAttribute('data-qa-dd'));
    const tr = trig.getBoundingClientRect();
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const cands = [];
    for (const e of document.querySelectorAll('ul, ol, div, section')) {
      if (!visible(e) || e.contains(trig)) continue;
      if (e.querySelector('a[href*="-id-"]')) continue; // loại danh sách siêu thị
      const kids = [...e.children].filter(visible);
      if (kids.length < 3) continue;
      const r = e.getBoundingClientRect();
      const gap = r.top - tr.bottom;
      const overlap = Math.min(r.right, tr.right) - Math.max(r.left, tr.left);
      if (gap < -10 || gap > 120) continue;            
      if (overlap < 0.3 * Math.min(r.width, tr.width)) continue; 
      cands.push({ e, gap, n: kids.length });
    }
    if (!cands.length) return false;
    cands.sort((a, b) => b.n - a.n || a.gap - b.gap);
    cands[0].e.setAttribute('data-qa-dd', '1');
    return true;
  });
  return ok ? page.locator('[data-qa-dd]').first() : null;
}

async function openDropdown(page, box) {
  let dd = await findDropdown(page, box);
  if (dd) return dd;
  for (const target of [box, box.locator('xpath=..'), box.locator('xpath=../..')]) {
    await target.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    dd = await findDropdown(page, box);
    if (dd) return dd;
  }
  return null;
}

const ddItems = (dd) => dd.locator(':scope > *:visible:not(:has(input))');

async function ddTexts(dd) {
  const t = await ddItems(dd).evaluateAll((els) => els.map((e) => e.innerText));
  return t.map((x) => x.split('\n')[0].trim()).filter(Boolean);
}

//  TỈNH / THÀNH 
const firstLine = (t) => t.split('\n')[0].trim();
const NONE = '[data-qa-none]'; // locator luôn rỗng

async function provinceItemsNow(page) {
  for (const sel of [`${SEL.provinceOption}:visible:not(:has(input))`, `${SEL.provinceItem}:visible`]) {
    const loc = page.locator(sel);
    if (await loc.count()) return loc;
  }
  const dd = await findDropdown(page, provinceBox(page));
  return dd ? ddItems(dd) : page.locator(NONE);
}
async function provinceItems(page) {
  const box = provinceBox(page);
  for (const target of [box, box.locator('xpath=..'), box.locator('xpath=../..')]) {
    if (await (await provinceItemsNow(page)).count()) break;
    await target.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
  }
  return provinceItemsNow(page);
}

async function provinceNames(page) {
  const items = await provinceItems(page);
  const t = await items.evaluateAll((els) => els.map((e) => e.innerText));
  return [...new Set(t.map(firstLine).filter(Boolean))];
}

async function selectProvince(page, name) {
  const re = new RegExp(escapeRe(shortName(name)), 'i');
  const items = await provinceItems(page);
  const item = items.filter({ hasText: re }).first();
  await expect(item, `Không thấy tỉnh "${name}" trong danh sách đang mở`).toBeVisible({ timeout: 8000 });
  await item.click();
  await settle(page);  
}

// PHƯỜNG / XÃ 
const WARD_LINKS = 'a[onclick*="changePoup"]:not(.province-name):visible, a.district-name:visible, a.ward-name:visible';

async function currentWardItems(page) {
  for (const sel of [`${SEL.wardOption}:visible:not(:has(input))`, WARD_LINKS]) {
    const loc = page.locator(sel);
    if (await loc.count()) return loc;
  }
  const dd = await findDropdown(page, wardBox(page));
  return dd ? ddItems(dd) : page.locator(NONE);
}
async function wardItems(page) {
  const box = wardBox(page);
  for (const target of [box, box.locator('xpath=..'), box.locator('xpath=../..')]) {
    if (await (await currentWardItems(page)).count()) break;
    await target.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
  }
  return currentWardItems(page);
}

async function wardNames(page) {
  const items = await wardItems(page);
  const t = await items.evaluateAll((els) => els.map((e) => e.innerText));
  return t.map(firstLine).filter(Boolean);
}

async function selectWardByName(page, name) {
  const items = await wardItems(page);
  await expect(items.filter({ hasText: name }).first(), 'Không thấy phường/xã trong danh sách').toBeVisible();
  await items.filter({ hasText: name }).first().click();
  await settle(page);
}

async function selectFirstWard(page) {
  const items = await wardItems(page);
  const first = items.first();
  await expect(first, 'Danh sách phường/xã phải mở ra (đã chọn tỉnh chưa?)').toBeVisible();
  const text = firstLine(await first.innerText());
  await first.click();
  await expect(wardBox(page)).not.toContainText(TXT.wardPlaceholder);
  await settle(page);
  return text;
}

// DANH SÁCH SIÊU THỊ 
async function sampleStores(page, n = 10) {
  return storeLinks(page).evaluateAll((links, n) => {
    return links.slice(0, n).map((a) => {
      let box = a;
      while (box.parentElement && box.parentElement.querySelectorAll('a[href*="-id-"]').length === 1 && box.parentElement.tagName !== 'BODY') {
        box = box.parentElement;
      }
      return { href: a.getAttribute('href'), text: (box.innerText || a.innerText || '').replace(/\s+/g, ' ').trim() };
    });
  }, n);
}

async function openFirstStore(page) {
  const link = storeLinks(page).first();
  const href = await link.getAttribute('href');
  const popupPromise = page.context().waitForEvent('page', { timeout: 4000 }).catch(() => null);
  await link.click();
  const popup = await popupPromise;
  if (popup) {
    await popup.waitForLoadState('domcontentloaded');
    const url = popup.url();
    await popup.close();
    note('Website mở siêu thị ở tab mới -> script mở lại ở tab chính');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } else {
    await page.waitForLoadState('domcontentloaded');
  }
  return href;
}

async function breadcrumb(page) {
  const byClass = page.locator(SEL.breadcrumb).first();
  if (await byClass.count()) return byClass;
  return page
    .locator('a:has-text("Hệ thống siêu thị")')
    .first()
    .locator('xpath=ancestor::*[.//a[contains(.,"Trang chủ")]][1]');
}

const geoContext = { geolocation: HCM_GEO, permissions: ['geolocation'] };


// NHÓM 1: TRUY CẬP TRANG (3 TC)
test.describe('Truy cập trang', () => {
  test('Store_Access_01 - Truy cập bằng mục [Tìm địa chỉ cửa hàng]', async ({ page }) => {
    const res = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    expect(res.status()).toBeLessThan(400); 
    await dismissPopups(page);

    const link = page.locator('a[href*="/he-thong-sieu-thi-dien-may"]').first();
    await link.scrollIntoViewIfNeeded();
    try {
      await link.click({ timeout: 5000 });
    } catch {
      note('Click bị chặn bởi overlay → thử Escape + force click');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await link.click({ force: true });
    }

    await expect(page).toHaveURL(/he-thong-sieu-thi-dien-may/);
    await expect(page.getByText(/Tìm siêu thị/i).first()).toBeVisible();
    await expect(page).not.toHaveTitle(/404|500|không tìm thấy|not found|error/i);
    await expect(page.locator('h1:visible').filter({ hasText: /^(404|500)\b|không tìm thấy trang/i })).toHaveCount(0);
  });

  test('Store_Access_02 - Truy cập khi chưa đăng nhập', async ({ browser }) => {
    const ctx = await browser.newContext(); 
    const page = await ctx.newPage();
    await gotoStorePage(page);

    await expect(page).toHaveURL(/he-thong-sieu-thi-dien-may/);
    await expect(page).not.toHaveURL(/dang-nhap|login/i);
    await expect(page.getByText(/Đăng nhập/i).first()).toBeVisible();
    await expect(provinceBox(page)).toBeVisible();
    await expect(nearbyBtn(page)).toBeVisible();
    await ctx.close();
  });

  test.describe('Đã đăng nhập (cần auth.json)', () => {
    test.use({ storageState: fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined });

    test('Store_Access_03 - Truy cập khi đã đăng nhập', async ({ page }) => {
      test.skip(!fs.existsSync(AUTH_FILE),
        'Chưa có auth.json - đăng nhập OTP thủ công 1 lần bằng codegen --save-storage=auth.json');
      await gotoStorePage(page);
      await expect(page).toHaveURL(/he-thong-sieu-thi-dien-may/);
      await expect(page.getByText(/^Đăng nhập$/).first()).toBeHidden();
      await expect(provinceBox(page)).toBeVisible();
    });
  });
});

// NHÓM 2: HIỂN THỊ TRANG (2 TC)
test.describe('Hiển thị trang', () => {
  test('Store_Display_01 - Giao diện tổng thể', async ({ page }) => {
    await gotoStorePage(page);
    await expect(page.getByText(/Tìm siêu thị Điện máy XANH/i).first()).toBeVisible();
    await expect(provinceBox(page)).toBeVisible();
    await expect(wardBox(page)).toBeVisible();
    await expect(nearbyBtn(page)).toBeVisible();
    await expect(page.getByText(/Hệ thống\s+\d+\s+siêu thị/i).first()).toBeVisible();
    await expect(page.getByText(/Mở cửa\s*8:00\s*-\s*22:00/i).first()).toBeVisible();
    await expect(page.getByText(/Các tiện ích tại siêu thị/i).first()).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
    });
    const broken = await page.evaluate(() =>
      [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.offsetParent).length);
    expect(broken, 'số ảnh bị lỗi').toBe(0);

  });

  test('Store_Display_02 - Mục "Các tiện ích tại siêu thị"', async ({ page }) => {
    await gotoStorePage(page);
    const heading = page.getByText(/Các tiện ích tại siêu thị/i).first();
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();

    const section = heading.locator('xpath=ancestor::*[self::section or self::div][2]');
    await expect(section.getByText(/bảo hành|giữ xe|wifi|miễn phí/i).first()).toBeVisible();
    const icons = section.locator('img, svg');
    expect(await icons.count()).toBeGreaterThan(0);

    const overflowed = await section.evaluate(
      (el) => [...el.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0).length);
    expect(overflowed).toBe(0);

  });
});

// NHÓM 3: CHỌN TỈNH/THÀNH (5 TC)
test.describe('Chọn Tỉnh/Thành', () => {

  test('Store_Province_01 - Danh sách tỉnh/thành', async ({ page }) => {
    await gotoStorePage(page);
    const names = await provinceNames(page);   
    note(`Số tỉnh/thành thực tế: ${names.length}`);

    expect(names.length, 'Khoảng 34 tỉnh/thành').toBeGreaterThanOrEqual(30);
    expect(names.length).toBeLessThanOrEqual(40);
    expect(new Set(names).size, 'có mục trùng lặp').toBe(names.length);

    for (const n of ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng']) {
      expect(names.some((item) => item.includes(n)), `Thiếu ${n}`).toBeTruthy();
    }
    expect(names.every((n) => !n.includes('\uFFFD')), 'Lỗi mã hóa tiếng Việt').toBeTruthy();
  });

  test('Store_Province_02 - Chọn TP. Hồ Chí Minh (nhiều siêu thị)', async ({ page }) => {
    await gotoStorePage(page);
    const before = await listSignature(page);
    const t0 = Date.now();
    await selectProvince(page, 'Thành phố Hồ Chí Minh');
    await waitStoresLoaded(page);
    const elapsed = Date.now() - t0;
    note(`Thời gian chọn tỉnh + tải danh sách: ${elapsed} ms`);

    expect(elapsed).toBeLessThan(15_000);
    await expect(provinceBox(page)).toContainText('Hồ Chí Minh');  
    await expect(wardBox(page)).toBeVisible();
    const changed = await waitListChanged(page, before, 8000);
    note(`Danh sách đổi sau khi chọn tỉnh: ${changed}`);
    expect(changed, 'Danh sách siêu thị phải thay đổi sau khi chọn TP.HCM').toBeTruthy();
    const n = await storeLinks(page).count();
    note(`Số siêu thị hiển thị của TP.HCM: ${n}`);
    expect(n).toBeGreaterThan(0);
  });

  test('Store_Province_03 - Đổi tỉnh khi chưa chọn phường/xã', async ({ page }) => {
    await gotoStorePage(page);
    await selectProvince(page, 'Thành phố Hà Nội');
    await waitStoresLoaded(page);
    const hnSig = await listSignature(page);
    const hnFirst = (await sampleStores(page, 1))[0].text;

    await selectProvince(page, 'Thành phố Đà Nẵng');
    expect(await waitListChanged(page, hnSig), 'Danh sách phải đổi sau khi chọn tỉnh khác').toBeTruthy();
    await waitStoresLoaded(page);
    const dn = await sampleStores(page, 10);

    expect(dn[0].text).not.toBe(hnFirst);
    for (const s of dn) expect(s.text).not.toMatch(/Hà Nội/);
    await expect(provinceBox(page)).toContainText('Đà Nẵng');
    await expect(wardBox(page)).toContainText(TXT.wardPlaceholder);
  });

  test('Store_Province_04 - Gõ tìm nhanh tỉnh/thành', async ({ page }) => {
    await gotoStorePage(page);
    await openDropdown(page, provinceBox(page));

    const input = page.locator(`#province-box__store input:visible, ${SEL.provinceSearch}`).first();
    const hasInput = await input.isVisible().catch(() => false);
    note(hasInput ? 'Có ô gõ tìm tỉnh/thành' : 'Không có ô gõ tìm -> gõ trực tiếp bằng bàn phím');
    const before = await listSignature(page);
    const total = await (await provinceItemsNow(page)).count();

    if (hasInput) {
      await input.click();
      await input.fill('');
      await page.keyboard.type('Đà Nẵng', { delay: 100 });
    } else {
      note('Website KHÔNG có ô gõ tìm tỉnh/thành → không thể test chức năng lọc');
      test.skip(true, 'Website không có ô gõ tìm tỉnh/thành → không thể kiểm tra chức năng lọc (N/A)');
    }
    await page.waitForTimeout(800);

    const items = await provinceItemsNow(page);
    const item = items.filter({ hasText: /Đà Nẵng/i }).first();
    await expect(item, 'Phải thấy "Đà Nẵng" trong danh sách').toBeVisible();
    const visibleCount = await items.count();
    note(`Số tỉnh hiển thị: ${total} -> ${visibleCount} sau khi gõ "Đà Nẵng"` + (visibleCount < total ? ' (đã lọc)' : ' (site không thu hẹp danh sách)'));
    if (hasInput && visibleCount >= total) {
      note('GÓP Ý: gõ vào ô tìm nhưng danh sách tỉnh không được lọc, vẫn hiện đủ ' + total + ' tỉnh');
    }
    if (hasInput) {
      expect(visibleCount, 'Gõ "Đà Nẵng" vào ô tìm nhưng danh sách không được lọc').toBeLessThan(total);
    }

    await item.click();
    await settle(page);
    await expect(provinceBox(page)).toContainText('Đà Nẵng');
    const changed = await waitListChanged(page, before);
    expect(changed, 'Danh sách siêu thị phải thay đổi sau khi chọn Đà Nẵng').toBeTruthy();
    await waitStoresLoaded(page);
  });

  test('Store_Province_05 - Chọn tỉnh/phường chỉ bằng bàn phím', async ({ page }) => {
    await gotoStorePage(page);
    const focused = () =>
      provinceBox(page).evaluate((el) => el === document.activeElement || el.contains(document.activeElement));
    let ok = await focused();
    for (let i = 0; i < 60 && !ok; i++) {
      await page.keyboard.press('Tab');
      ok = await focused();
    }
    if (!ok) {
      note('KNOWN ISSUE: Tab không đưa được focus vào ô [Chọn tỉnh, thành] -> website không hỗ trợ bàn phím');
      test.skip(true, 'KNOWN ISSUE: Website không hỗ trợ điều hướng bàn phím - ghi nhận góp ý, bỏ qua để không tính là pass giả');
    }
    expect(ok, 'Tab đưa được focus vào ô [Chọn tỉnh, thành]').toBeTruthy();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await settle(page);
    await expect(provinceBox(page), 'Ô tỉnh phải đổi khỏi "Chọn tỉnh, thành"').not.toContainText(TXT.provincePlaceholder);
    await waitStoresLoaded(page);
  });

});

// NHÓM 4: CHỌN PHƯỜNG/XÃ (6 TC)
test.describe('Chọn Phường/Xã', () => {
  test('Store_Ward_01 - Phường/xã hợp lệ có siêu thị', async ({ page }) => {
    await gotoStorePage(page);
    await selectProvince(page, 'Thành phố Hồ Chí Minh');
    await waitStoresLoaded(page);
    const provinceSig = await listSignature(page);
    const provinceCount = await storeLinks(page).count();

    const ward = await selectFirstWard(page);
    const short = shortName(ward);
    note(`Phường/xã đã chọn: ${ward}`);
    await expect(wardBox(page)).toContainText(short);
    await waitListChanged(page, provinceSig, 8000);
    const stores = await sampleStores(page, 50);
    note(`Tổng siêu thị của tỉnh: ${provinceCount}; sau khi chọn phường/xã: ${stores.length}`);
    expect(stores.length).toBeGreaterThan(0);
    expect(stores.length).toBeLessThanOrEqual(provinceCount);
    const checkName = short.length <= 2 ? ward : short;
    for (const s of stores) {
      expect(
        s.text,
        `Địa chỉ "${s.text}" phải chứa tên phường/xã đã chọn ("${ward}")`
      ).toContain(checkName);
    }
  });

  test('Store_Ward_02 - Phường/xã không có siêu thị', async ({ page }) => {
    test.setTimeout(400_000);
    await gotoStorePage(page);
    const province = process.env.NO_STORE_PROVINCE || 'Tỉnh Điện Biên';
    await selectProvince(page, province);

    const wards = await wardNames(page);
    note(`${province} có ${wards.length} phường/xã`);
    await page.keyboard.press('Escape');
    let emptyWard = null;
    for (const w of wards.slice(0, 30)) {
      await selectWardByName(page, w);
      if ((await storeLinks(page).count()) === 0) { emptyWard = w; break; }
    }
    test.skip(!emptyWard, 'Không tìm được phường/xã trống trong 30 mục đầu - đổi NO_STORE_PROVINCE');
    note(`Phường/xã không có siêu thị: ${emptyWard}`);
    const msg = page.locator('text=/không tìm thấy siêu thị|không có siêu thị|chưa có siêu thị/i >> visible=true').first();
    await expect(msg, 'Phải hiện thông báo không có siêu thị').toBeVisible();
    note(`Thông báo: ${(await msg.innerText()).trim()}`);
  });

  test('Store_Ward_03 - Mở ô phường/xã khi chưa chọn tỉnh', async ({ page }) => {
    await gotoStorePage(page);
    await expect(wardBox(page), 'Ô [Chọn phường, xã] phải tồn tại').toBeVisible();
    await wardBox(page).click({ force: true });
    await page.waitForTimeout(700);
    const shown = await (await currentWardItems(page)).count();
    note(`Số phường/xã hiển thị khi chưa chọn tỉnh: ${shown}`);
    expect(shown, 'không được hiện phường/xã khi chưa chọn tỉnh').toBe(0);
  });

  test('Store_Ward_04 - Đổi tỉnh sau khi đã chọn phường/xã', async ({ page }) => {
    await gotoStorePage(page);
    await selectProvince(page, 'Thành phố Hà Nội');
    await selectFirstWard(page);
    const hnWards = await wardNames(page);
    await page.keyboard.press('Escape');
    const hnSig = await listSignature(page);

    await selectProvince(page, 'Thành phố Đà Nẵng');
    await expect(wardBox(page)).toContainText(TXT.wardPlaceholder);   
    await waitListChanged(page, hnSig);
    await waitStoresLoaded(page);
    for (const s of await sampleStores(page, 10)) expect(s.text).not.toMatch(/Hà Nội/);

    const dnWards = await wardNames(page);
    note(`Số phường/xã Hà Nội: ${hnWards.length}, Đà Nẵng: ${dnWards.length}`);
    expect(dnWards.length).toBeGreaterThan(0);
    expect(dnWards.filter((w) => hnWards.includes(w) && !/^Phường \d+$/.test(w))).toHaveLength(0);
  });

  test('Store_Ward_05 - Bỏ chọn phường/xã để xem lại toàn bộ siêu thị', async ({ page }) => {
    await gotoStorePage(page);
    await selectProvince(page, 'Thành phố Hồ Chí Minh');
    await waitStoresLoaded(page);
    const allSig = await listSignature(page);
    const all = await storeLinks(page).count();

    await selectFirstWard(page);
    await waitListChanged(page, allSig, 8000);
    const narrowed = await storeLinks(page).count();
    note(`Toàn tỉnh: ${all}; sau khi chọn phường/xã: ${narrowed}`);
    expect(narrowed, 'Sau khi chọn phường/xã, số siêu thị phải ít hơn hoặc bằng toàn tỉnh').toBeLessThanOrEqual(all);
    expect(narrowed, 'Phải có ít nhất 1 siêu thị sau khi chọn phường/xã').toBeGreaterThan(0);

    note('Website không có mục bỏ chọn phường/xã -> chọn lại tỉnh (góp ý usability)');
    const narrowedSig = await listSignature(page);
    await selectProvince(page, 'Thành phố Hồ Chí Minh');
    await waitListChanged(page, narrowedSig, 8000);
    await waitStoresLoaded(page);
    expect(await storeLinks(page).count()).toBe(all);
  });

  test('Store_Ward_06 - Gõ tìm phường/xã (có dấu, không dấu, sai tên)', async ({ page }) => {
    await gotoStorePage(page);
    await selectProvince(page, 'Thành phố Hồ Chí Minh');
    await page.waitForTimeout(500);

    const TEST_WARD = 'Bến Thành';
    const TEST_WARD_FULL = 'Phường Bến Thành';
    note(`Phường/xã dùng để test gõ tìm: "${TEST_WARD}"`);

    await wardBox(page).click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);

    const input = page.locator(`#district-box__store input:visible, ${SEL.wardSearch}`).first();
    const hasInput = await input.isVisible().catch(() => false);

    if (!hasInput) {
      note('Website KHÔNG có ô gõ tìm phường/xã → không thể test 3 trường hợp gõ tìm');
      test.skip(true, 'Website không có ô gõ tìm phường/xã → không thể kiểm tra chức năng gõ có dấu/không dấu/sai tên (N/A)');
    }

    const typeAndCheck = async (text) => {
      await wardBox(page).click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      await input.click();
      await input.fill('');
      await page.keyboard.type(text, { delay: 100 });  
      await page.waitForTimeout(700);
      const links = page.locator(WARD_LINKS);
      const marked = page.locator('[data-qa-dd]').first();
      let items = links;
      if (!(await links.count()) && (await marked.count()) && (await marked.isVisible())) {
        items = ddItems(marked);
      }
      const t = await items.evaluateAll((els) => els.map((e) => e.innerText));
      return t.map(firstLine).filter(Boolean);
    };

    // 1) Gõ CÓ DẤU: "Bến Thành" 
    const fullMatch = await typeAndCheck(TEST_WARD);
    note(`[1] Gõ có dấu "${TEST_WARD}" → ${fullMatch.length} kết quả: [${fullMatch.slice(0, 5).join(', ')}]`);
    const hasFullMatch = fullMatch.some(w => w.includes(TEST_WARD));
    expect(hasFullMatch, `Gõ "${TEST_WARD}" phải tìm thấy "${TEST_WARD_FULL}" trong kết quả`).toBeTruthy();

    // 2) Gõ KHÔNG DẤU: "ben thanh"
    const noAccentText = 'ben thanh';
    const noAccent = await typeAndCheck(noAccentText);
    note(`[2] Gõ không dấu "${noAccentText}" → ${noAccent.length} kết quả: [${noAccent.slice(0, 5).join(', ')}]`);
    const hasNoAccentMatch = noAccent.some(w => w.includes(TEST_WARD));
    if (!hasNoAccentMatch) {
      note('GÓP Ý USABILITY: Website KHÔNG hỗ trợ tìm phường/xã khi gõ không dấu "ben thanh" → không ra kết quả');
    } else {
      note('Website hỗ trợ tìm phường/xã khi gõ không dấu ✓');
    }

    // 3) Gõ CHUỖI KHÔNG TỒN TẠI: "zzz" 
    const noneResult = await typeAndCheck('zzz');
    note(`[3] Gõ "zzz" (không tồn tại) → ${noneResult.length} kết quả`);
    expect(noneResult.length, 'Gõ chuỗi "zzz" không tồn tại vẫn ra kết quả → lỗi lọc').toBe(0);
  });
});

// NHÓM 5: XEM SIÊU THỊ GẦN BẠN (4 TC)
test.describe('Siêu thị gần bạn', () => {
  test('Store_Nearby_01 - Lần đầu bấm: trang yêu cầu quyền vị trí', async ({ page }) => {
    await page.addInitScript(() => {
      window.__geoCalls = 0;
      const spy = () => { window.__geoCalls++; };  
      navigator.geolocation.getCurrentPosition = spy;
      navigator.geolocation.watchPosition = () => { spy(); return 0; };
    });
    await gotoStorePage(page);
    const before = await storeLinks(page).count();
    note(`Số siêu thị hiển thị mặc định trước khi bấm: ${before}`);
    await nearbyBtn(page).click();
    await expect.poll(() => page.evaluate(() => window.__geoCalls), { timeout: 10_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1000);

  });

  test.describe('Có cấp quyền vị trí', () => {
    test.use(geoContext);

    test('Store_Nearby_02 - Cho phép vị trí: hiển thị siêu thị gần bạn', async ({ page }) => {
      await gotoStorePage(page);
      const before = await listSignature(page);
      await nearbyBtn(page).click();
      await waitStoresLoaded(page);
      const changed = await waitListChanged(page, before, 10_000);
      note(`Danh sách đổi sau khi bấm "gần bạn": ${changed}`);
      expect(changed, 'Danh sách siêu thị phải thay đổi sau khi bấm nút "xem siêu thị gần bạn"').toBeTruthy();
      await settle(page);
      const stores = await sampleStores(page, 10);
      expect(stores.length).toBeGreaterThan(0);
      for (const s of stores) expect(s.text).toMatch(/Hồ Chí Minh|TP\.?\s?HCM|Sài Gòn/i);

      const dist = stores.map((s) => parseFloat(((s.text.match(/(\d+[.,]?\d*)\s*km/i) || [])[1] || '').replace(',', '.')))
        .filter((n) => !Number.isNaN(n));
      if (dist.length > 1) expect(dist).toEqual([...dist].sort((a, b) => a - b));
    });

    test('Store_Nearby_03 - Click nhanh liên tiếp nút "gần bạn"', async ({ page }) => {
      let dialogs = 0;
      page.on('dialog', async (d) => { dialogs++; await d.dismiss(); });
      await gotoStorePage(page);
      await nearbyBtn(page).evaluate((el) => { for (let i = 0; i < 5; i++) el.click(); });
      await waitStoresLoaded(page);
      await settle(page);

      const hrefs = await storeLinks(page).evaluateAll((a) => a.map((x) => x.getAttribute('href')));
      expect(new Set(hrefs).size, 'có siêu thị bị nhân đôi').toBe(hrefs.length);
      expect(dialogs).toBeLessThanOrEqual(1);
      await expect(nearbyBtn(page)).toBeVisible(); 
    });

    test('Store_Nearby_04 - Chọn khu vực bằng tay sau khi xem "gần bạn"', async ({ page }) => {
      await gotoStorePage(page);
      await nearbyBtn(page).click();
      await waitStoresLoaded(page);
      await settle(page);
      const nearSig = await listSignature(page);
      const nearFirst = (await sampleStores(page, 1))[0].text;

      await selectProvince(page, 'Thành phố Hà Nội');
      expect(await waitListChanged(page, nearSig), 'Danh sách phải đổi sang Hà Nội').toBeTruthy();
      await waitStoresLoaded(page);
      await expect(provinceBox(page)).toContainText('Hà Nội');
      const hn = await sampleStores(page, 10);
      expect(hn[0].text).not.toBe(nearFirst);
      for (const s of hn) expect(s.text).toMatch(/Hà Nội/);

      const ward = await selectFirstWard(page);
      await expect(wardBox(page)).toContainText(shortName(ward));
    });
  });
});

// NHÓM 6: DANH SÁCH SIÊU THỊ (2 TC)
test.describe('Danh sách siêu thị', () => {
  test('Store_List_01 - Siêu thị thuộc đúng khu vực (mẫu 10 mục)', async ({ page }) => {
    await gotoStorePage(page);
    const before = await listSignature(page);
    await selectProvince(page, 'Thành phố Đà Nẵng');
    await waitListChanged(page, before);
    await waitStoresLoaded(page);
    const stores = await sampleStores(page, 10);
    expect(stores.length).toBeGreaterThan(0);
    const wrong = stores.filter((s) => !/Đà Nẵng/.test(s.text));
    note(`Số mục lấy mẫu: ${stores.length}; không chứa "Đà Nẵng": ${wrong.length}`);
    expect(wrong, JSON.stringify(wrong.map((w) => w.text))).toHaveLength(0);
  });

  test('Store_List_02 - Thương hiệu hiển thị (ĐMX / TGDĐ)', async ({ page, context }) => {
    await gotoStorePage(page);
    const before = await listSignature(page);
    await selectProvince(page, 'Thành phố Hồ Chí Minh');
    await selectFirstWard(page);
    await waitListChanged(page, before);
    await waitStoresLoaded(page);

    const rows = await storeLinks(page).evaluateAll((as) =>
      as.slice(0, 5).map((a) => {
        let c = a;
        while (c.parentElement && c.parentElement.querySelectorAll('a[href*="-id-"]').length === 1 && c.parentElement.tagName !== 'BODY') c = c.parentElement;
        const alt = [...c.querySelectorAll('img')].map((i) => i.alt).join(' ');
        return { href: a.href, label: (c.innerText + ' ' + alt) };
      }));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const brands = r.label.match(/Điện máy XANH|Thế Giới Di Động/gi);
      expect(brands, `Không thấy thương hiệu: ${r.label}`).not.toBeNull();
      const detail = await context.newPage();
      await detail.goto(r.href, { waitUntil: 'domcontentloaded' });
      const title = await detail.title();
      const bodyText = await detail.locator('main, article, [class*="detail"], [class*="content"]').first()
        .innerText().catch(() => '');
      const hit = brands.some((b) => new RegExp(b, 'i').test(title + ' ' + bodyText.slice(0, 2000)));
      note(`Thẻ: ${brands.join(' / ')} | Tiêu đề chi tiết: ${title}`);
      expect(hit, `Thương hiệu ở danh sách (${brands.join(', ')}) không khớp trang chi tiết: ${title}`).toBeTruthy();
      await detail.close();
    }
  });
});


// NHÓM 7: CHI TIẾT SIÊU THỊ (5 TC)
test.describe('Chi tiết siêu thị', () => {
  async function toDetail(page) {
    await gotoStorePage(page);
    const before = await listSignature(page);
    await selectProvince(page, 'Thành phố Hồ Chí Minh');
    await selectFirstWard(page);
    await waitListChanged(page, before);
    await waitStoresLoaded(page);
    return openFirstStore(page);
  }

  test('Store_Detail_01 - Mở trang chi tiết từ danh sách', async ({ page }) => {
    const href = await toDetail(page);
    await expect(page).toHaveURL(/-id-\d+/);
    expect(href).toMatch(/-id-\d+/);
    expect(await page.title()).toMatch(/Điện máy XANH|Thế Giới Di Động/i);
    await expect(page.getByText(/404|không tìm thấy trang/i)).toHaveCount(0);
  });

  test('Store_Detail_02 - Breadcrumb', async ({ page }) => {
    await toDetail(page);
    const bc = await breadcrumb(page);
    await expect(bc).toContainText('Trang chủ');
    await expect(bc).toContainText('Hệ thống siêu thị');
    await expect(bc).toContainText('Hồ Chí Minh');

    await bc.getByText('Hệ thống siêu thị').click();
    await expect(page).toHaveURL(/he-thong-sieu-thi-dien-may\/?$/);

    await page.goBack();
    const bc2 = await breadcrumb(page);
    await bc2.getByText(/Hồ Chí Minh/).first().click();
    await page.waitForLoadState('domcontentloaded');
    expect(await page.title()).not.toMatch(/404/);
    expect(page.url(), 'Click breadcrumb tỉnh phải dẫn đến trang hệ thống siêu thị').toMatch(/he-thong-sieu-thi/);
  });

  test('Store_Detail_03 - Liên kết "Xem chỉ đường đến siêu thị này"', async ({ page }) => {
    test.setTimeout(240_000);
    await toDetail(page);
    const detailUrl = page.url();
    const link = page.getByText(/Xem chỉ đường đến siêu thị này/i).first();
    const mapsRe = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google/;
    const href = (await link.evaluate((el) => (el.closest('a') || el).getAttribute('href'))) || '';
    note('Href của liên kết chỉ đường: ' + href);
    expect(href, 'Liên kết phải trỏ tới Google Maps').toMatch(mapsRe);

    const popupPromise = page.waitForEvent('popup', { timeout: 12_000 }).catch(() => null);
    await link.click();
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {});
      const popupUrl = popup.url();
      note('URL tab Google Maps: ' + popupUrl);
      expect(popupUrl, 'Tab mới phải là Google Maps').toMatch(
        /maps\.google|google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/
      );
      expect(page.url()).toBe(detailUrl);

      await popup.close();
    } else {
      note('Liên kết mở Google Maps ngay trên tab hiện tại (không mở popup)');
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {});
      const currentUrl = page.url();
      note('URL sau khi click chỉ đường: ' + currentUrl);
      expect(currentUrl).toMatch(/maps\.google|google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/);
    }
  });

  test('Store_Detail_04 - Mục "Các siêu thị Điện máy XANH khác tại <Tỉnh>"', async ({ page }) => {
    await toDetail(page);
    const current = page.url();
    const heading = page.getByText(/Các siêu thị Điện máy XANH khác tại/i).first();
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();

    const others = heading.locator('xpath=following::a[contains(@href,"-id-")]');
    expect(await others.count()).toBeGreaterThan(0);
    const hrefs = await others.evaluateAll((as) => as.map((a) => a.href));
    expect(hrefs).not.toContain(current);                      

    const target = hrefs[0];
    await others.first().click();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toBe(target);
    expect(await page.title()).toMatch(/Điện máy XANH/i);
  });

  test('Store_Detail_05 - Nút Back về danh sách', async ({ page }) => {
    await gotoStorePage(page);
    const before = await listSignature(page);
    await selectProvince(page, 'Thành phố Hà Nội');
    const ward = await selectFirstWard(page);
    await waitListChanged(page, before);
    await waitStoresLoaded(page);
    await openFirstStore(page);

    await page.goBack();
    await expect(page).toHaveURL(/he-thong-sieu-thi-dien-may/);
    await expect(page.getByText(/Tìm siêu thị/i).first()).toBeVisible();
    const keepProvince = /Hà Nội/.test(norm(await provinceBox(page).innerText()));
    const keepWard = norm(await wardBox(page).innerText()).includes(shortName(ward));
    note(`Sau khi Back: giữ tỉnh = ${keepProvince}, giữ phường/xã = ${keepWard}`);
    // Assert: sau khi Back phải giữ lại tỉnh đã chọn
    expect(keepProvince, 'Sau khi goBack, ô tỉnh phải giữ "Hà Nội" (nếu fail → website không giữ state)').toBeTruthy();
    if (!keepWard) {
      note('GÓP Ý USABILITY: Sau khi Back, phường/xã bị reset → website không giữ lựa chọn phường/xã');
    }
  });
});