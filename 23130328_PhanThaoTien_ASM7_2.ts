import { test, expect, Page, Response } from '@playwright/test';

/**
 * Automation cho chức năng "Trang chi tiết sản phẩm" (6.4.1)
 * Website thật: https://www.dienmayxanh.com/tivi   |   Công cụ: Playwright + TypeScript
 * 27 test case: ProductDetail_Access_01 ... ProductDetail_Specs_04
 * (khớp file DMX_2_TrangChiTietSanPham_TestCase_v4.xlsx)
 *
 * Chạy kiểm thử:
 *   npx playwright test tests/23130328_PhanThaoTien_ProductDetail.spec.ts --headed --workers=1
 *
 * Biến môi trường tuỳ chọn:
 *   SLOWMO=300          làm chậm thao tác để quay video demo
 *   PW_CHANNEL=chrome   dùng Google Chrome cài trên máy thay cho Chromium mặc định
 *   PW_VIDEO=on         bật quay video toàn bộ (mặc định chỉ giữ video khi fail)
 *   DMX_BASE_URL=...    đổi địa chỉ website (mặc định https://www.dienmayxanh.com)
 *   DMX_PRODUCT_URL=... đổi sản phẩm mẫu (mặc định Google Tivi TCL 55P635)
 *
 * Lưu ý: các test case phụ thuộc dữ liệu thật (không có khuyến mãi, không có giảm giá,
 * không có nút "Xem thêm N khuyến mãi"...) sẽ tự bỏ qua (skip) kèm lý do nếu không tìm thấy dữ liệu phù hợp,
 * giống ghi chú "Blocked/Skipped" trong file test case.
 */

const BASE_URL = (process.env.DMX_BASE_URL ?? 'https://www.dienmayxanh.com').replace(/\/$/, '');
const CATEGORY_URL = `${BASE_URL}/tivi`;
let sampleUrl = process.env.DMX_PRODUCT_URL ?? `${BASE_URL}/tivi/google-tcl-4k-55-inch-55p635`;

test.describe.configure({ timeout: 180_000 });

test.use({
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
  viewport: { width: 1365, height: 900 },
  screenshot: 'only-on-failure',
  trace: 'retain-on-failure',
  video: process.env.PW_VIDEO === 'on' ? 'on' : 'retain-on-failure',
  launchOptions: { slowMo: Number(process.env.SLOWMO ?? 0) },
  ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
});

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu và hàm hỗ trợ chung                                    */
/* ------------------------------------------------------------------ */

interface Box { x: number; y: number; w: number; h: number }
interface ListCard {
  path: string;
  name: string;
  spec: string | null;
  price: number | null;
  priceText: string | null;
  oldPrice: number | null;
  discount: number | null;
}
interface DetailPrice {
  price: number | null;
  priceText: string | null;
  oldPrice: number | null;
  oldPriceText: string | null;
  oldStruck: boolean;
  discount: number | null;
  left: number | null;
  top: number | null;
}

// Định dạng tiền tệ chuẩn: số chia hàng nghìn bằng dấu chấm, kết thúc bằng đ hoặc ₫
const PRICE_FORMAT = /^\d{1,3}(?:\.\d{3})+\s?[₫đ]$/;
const BAD_TEXT = /undefined|\bnull\b|\bNaN\b|\[object/i;

// Không dùng skip: toàn bộ 27 test cases đều phải được thực thi và kiểm tra thực tế (100% pass thật)
const BRAND_RE = /tcl|samsung|lg|sony|panasonic|casper|aqua|toshiba|sharp|xiaomi|coocaa|ifalcon|ffalcon/i;
const brandOf = (p: string) => (p.split('/').pop() || '').match(BRAND_RE)?.[0]?.toLowerCase();

const pathOf = (u: string) => new URL(u, BASE_URL).pathname.replace(/\/+$/, '');
const modelsOf = (p: string) => p.split('/').pop()!.split('-').filter(t => /\d/.test(t) && /[a-z]/i.test(t) && t.length >= 4);
const compact = (s: string) => s.toLowerCase().replace(/[\s-]/g, '');
const stripVN = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

async function dismissPopups(page: Page): Promise<string[]> {
  const closed: string[] = [];
  for (let i = 0; i < 2; i++) {
    const dialog = page.locator('[role="dialog"]:visible, [class*="modal" i]:visible, [class*="popup" i]:visible').first();
    if (!(await dialog.count())) break;
    closed.push(((await dialog.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 200));
    const close = dialog.locator('button:has-text("Đóng"), button:has-text("Bỏ qua"), button:has-text("Để sau"), [aria-label*="đóng" i], [aria-label*="close" i]').first();
    if (await close.count()) await close.click({ timeout: 2000 }).catch(() => { });
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  return closed;
}

async function gotoWithRetry(page: Page, url: string): Promise<Response> {
  let res: Response | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      if (res && res.status() >= 500 && attempt < 4) { lastError = new Error(`HTTP ${res.status()}`); await page.waitForTimeout(2000 * attempt); continue; }
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      if (attempt === 4) throw e;
      await page.waitForTimeout(2000 * attempt);
    }
  }
  if (lastError) throw lastError;
  expect(res, 'Không nhận được phản hồi từ máy chủ').not.toBeNull();
  return res!;
}

/** Theo dõi mã HTTP của tài liệu (document) gần nhất được tải trong tab */
function trackDocStatus(page: Page) {
  let last: { url: string; status: number } | null = null;
  page.on('response', r => {
    const q = r.request();
    if (q.isNavigationRequest() && q.resourceType() === 'document' && r.frame() === page.mainFrame()) last = { url: r.url(), status: r.status() };
  });
  return () => last;
}

async function expectNoErrorPage(page: Page) {
  await expect(page.locator('body')).not.toContainText(/Internal Server Error|Application error|Something went wrong|Đã có lỗi xảy ra|404 Not Found/i);
}

/* ---------------------------- Trang danh sách ---------------------------- */

/** Lấy các thẻ sản phẩm (đã khử trùng theo đường dẫn) trên trang danh sách Tivi */
async function getListCards(page: Page): Promise<ListCard[]> {
  return page.evaluate(() => {
    const PRICE_NODE = /^(\d{1,3}(?:\.\d{3})+)\s*([₫đ])?$/;
    const ANCILLARY = /(quà(?:\s*tặng)?|tặng|giảm(?:\s*thêm)?|trả\s*(?:góp|trước|chậm)|voucher|phiếu|thu\s*cũ)[\s:]*$/i;
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const pth = (a: HTMLAnchorElement) => new URL(a.href, location.href).pathname.replace(/\/+$/, '');
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .filter(a => /^\/tivi\/[^/?#]+$/.test(pth(a)) && visible(a) && !a.closest('header, nav, footer'));
    const pathSets = new Map<Element, Set<string>>();
    for (const a of anchors) {
      for (let e: Element | null = a; e; e = e.parentElement) {
        let s = pathSets.get(e);
        if (!s) { s = new Set<string>(); pathSets.set(e, s); }
        s.add(pth(a));
      }
    }
    const seen = new Set<string>();
    const out: any[] = [];
    for (const a of anchors) {
      const path = pth(a);
      if (seen.has(path)) continue;
      seen.add(path);
      let el: HTMLElement = a;
      while (el.parentElement && el.parentElement !== document.body && (pathSets.get(el.parentElement)?.size ?? 0) === 1) el = el.parentElement;
      const txt = el.innerText || '';
      const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
      const struck = (e: Element | null) => {
        for (let x: Element | null = e; x && x !== el.parentElement; x = x.parentElement) {
          if (['DEL', 'S', 'STRIKE'].includes(x.tagName) || (getComputedStyle(x).textDecorationLine || '').includes('line-through')) return true;
        }
        return false;
      };
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n.nodeValue || '').trim()) nodes.push(n as Text);
      const toks: { text: string; value: number; struck: boolean }[] = [];
      nodes.forEach((t, i) => {
        const parent = t.parentElement;
        if (!parent || !visible(parent)) return;
        const s = (t.nodeValue || '').replace(/\s+/g, ' ').trim();
        const prev = (nodes[i - 1]?.nodeValue || '').replace(/\s+/g, ' ').trim();
        const next = (nodes[i + 1]?.nodeValue || '').replace(/\s+/g, ' ').trim();
        const m = s.match(PRICE_NODE);
        if (!m) return;
        if (ANCILLARY.test(prev) || /^\/\s*(tháng|th\b)/i.test(next) || /trả\s*(góp|trước)/i.test(s)) return;
        let text = s;
        if (!m[2] && /^[₫đ]/.test(next)) text = `${m[1]}${next[0]}`;
        toks.push({ text, value: Number(m[1].replace(/\./g, '')), struck: struck(parent) });
      });
      let old = toks.filter(t => t.struck).sort((x, y) => y.value - x.value)[0] || null;
      let cur = toks.filter(t => !t.struck);
      if (!old && cur.length >= 2 && new Set(cur.map(t => t.value)).size >= 2) {
        const iMax = cur.map(t => t.value).indexOf(Math.max(...cur.map(t => t.value)));
        old = cur[iMax];
        cur = cur.filter((_, i) => i !== iMax);
      }
      const head = Array.from(el.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5')).find(visible);
      const isLabel = (s: string) => /^(quà|trả\s*(chậm|góp)|giảm|[-−–]\s?\d|đã bán|so sánh|\d+([.,]\d)?$)/i.test(s) || /\d{1,3}(?:\.\d{3})+\s*[₫đ]/.test(s);
      const name = (head?.textContent || '').replace(/\s+/g, ' ').trim() ||
        (el.querySelector('a[title]')?.getAttribute('title') || '').trim() ||
        (el.querySelector('img[alt]')?.getAttribute('alt') || '').trim() ||
        lines.find(l => !isLabel(l) && l.length >= 5) || '';
      const spec = lines.find(l => l !== name && l.length < 60 && !/[₫đ]/.test(l) &&
        (/\d{2,3}\s*(inch|")/i.test(l) || /\b(4K|8K|Full HD|HD|UHD|QLED|OLED)\b/i.test(l))) || null;
      const dm = txt.match(/(?:^|\s)[-−–]\s?(\d{1,3})\s?%/);
      out.push({
        path, name, spec,
        price: cur[0] ? cur[0].value : null,
        priceText: cur[0] ? cur[0].text : null,
        oldPrice: old ? old.value : null,
        discount: dm ? Number(dm[1]) : null,
      });
    }
    return out;
  }) as Promise<ListCard[]>;
}

async function waitForListCards(page: Page, min = 1) {
  await expect
    .poll(async () => (await getListCards(page)).length, { message: 'Không thấy thẻ sản phẩm nào trên trang danh mục', timeout: 30_000, intervals: [500, 1000] })
    .toBeGreaterThanOrEqual(min);
}

async function openCategory(page: Page) {
  const res = await gotoWithRetry(page, CATEGORY_URL);
  expect(res.status(), `Trang danh mục trả về HTTP ${res.status()}`).toBeLessThan(400);
  await dismissPopups(page);
  await waitForListCards(page);
}

/** Bấm "Xem thêm N Tivi" một lần; trả về true nếu danh sách dài thêm */
async function loadMoreList(page: Page): Promise<boolean> {
  const before = (await getListCards(page)).length;
  const btn = page.getByText(/^\s*Xem thêm\s+[\d.,]+\s+(Tivi|sản phẩm)\s*$/i).first();
  if (!(await btn.isVisible().catch(() => false))) return false;
  await btn.scrollIntoViewIfNeeded().catch(() => { });
  await btn.click({ timeout: 10_000 }).catch(() => { });
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    if ((await getListCards(page)).length > before) return true;
  }
  return false;
}

/** Tìm thẻ thỏa điều kiện, tải thêm danh sách nếu cần */
async function findListCard(page: Page, pred: (c: ListCard) => boolean, maxLoads = 4): Promise<ListCard | null> {
  let cards = await getListCards(page);
  for (let i = 0; i <= maxLoads; i++) {
    const hit = cards.find(pred);
    if (hit) return hit;
    if (i === maxLoads || !(await loadMoreList(page))) break;
    cards = await getListCards(page);
  }
  return null;
}

/** Click vào sản phẩm trên danh sách và chờ sang trang chi tiết.
 *  Xử lý cả hai trường hợp: điều hướng trong tab hiện tại và link mở tab mới (target="_blank").
 *  Nếu link mở tab mới: chờ tab mới tải xong, điều hướng tab gốc về URL sản phẩm, đóng tab mới.
 */
async function openFromList(page: Page, path: string) {
  const link = page.locator(`a[href*="${path}"]:visible`).first();
  await link.scrollIntoViewIfNeeded();
  // Kiểm tra nếu link có target="_blank" (sẽ mở tab mới)
  const isBlank = await link.getAttribute('target').then(t => t === '_blank').catch(() => false);
  if (isBlank) {
    const [newPage] = await Promise.all([page.context().waitForEvent('page', { timeout: 15_000 }), link.click()]);
    await newPage.waitForLoadState('domcontentloaded');
    const targetUrl = newPage.url();
    await newPage.close().catch(() => { });
    // Điều hướng tab gốc sang đúng URL sản phẩm
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  } else {
    // Link thông thường: điều hướng trong tab hiện tại
    await Promise.all([page.waitForURL(u => pathOf(u.toString()) === path, { timeout: 30_000 }), link.click()]);
  }
  await dismissPopups(page);
  await waitForDetail(page);
}

/* ---------------------------- Trang chi tiết ----------------------------- */

async function waitForDetail(page: Page) {
  await expect(page.locator('h1:visible').first(), 'Không thấy tên sản phẩm (h1) trên trang chi tiết').toBeVisible({ timeout: 30_000 });
}

async function openProduct(page: Page, url: string) {
  const res = await gotoWithRetry(page, url);
  expect(res.status(), `Trang chi tiết ${url} trả về HTTP ${res.status()}`).toBeLessThan(400);
  await dismissPopups(page);
  await waitForDetail(page);
  return res;
}

/** Mở sản phẩm mẫu; nếu sản phẩm mẫu không còn thì lấy sản phẩm đầu tiên của danh sách */
async function openSample(page: Page) {
  try {
    const res = await gotoWithRetry(page, sampleUrl);
    if (res.status() < 400) {
      await dismissPopups(page);
      await expect(page.locator('h1:visible').first()).toBeVisible({ timeout: 20_000 });
      return;
    }
  } catch { /* chuyển sang sản phẩm thay thế */ }
  await openCategory(page);
  const first = (await getListCards(page))[0];
  sampleUrl = `${BASE_URL}${first.path}`;
  test.info().annotations.push({ type: 'note', description: `Sản phẩm mẫu không còn, dùng thay thế: ${sampleUrl}` });
  await openProduct(page, sampleUrl);
}

const h1Text = async (page: Page) => ((await page.locator('h1:visible').first().innerText()) || '').replace(/\s+/g, ' ').trim();

/** Vị trí (theo trang) của phần tử chữ ngắn khớp biểu thức, ở dưới mốc minTop */
async function rectOf(page: Page, re: RegExp, minTop = -1e9): Promise<Box | null> {
  return page.evaluate(({ src, flags, minTop }) => {
    const re = new RegExp(src, flags);
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const t = (e: Element) => ((e as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim();
    let best: { x: number; y: number; w: number; h: number } | null = null;
    for (const e of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      if (!vis(e)) continue;
      const s = t(e);
      if (!s || s.length > 80 || !re.test(s)) continue;
      if (Array.from(e.children).some(c => re.test(t(c)))) continue;
      const r = e.getBoundingClientRect();
      const y = r.top + window.scrollY;
      if (y >= minTop && (!best || y < best.y)) best = { x: r.left + window.scrollX, y, w: r.width, h: r.height };
    }
    return best;
  }, { src: re.source, flags: re.flags, minTop });
}
const topOf = async (page: Page, re: RegExp, minTop = -1e9) => (await rectOf(page, re, minTop))?.y ?? null;

async function scrollToText(page: Page, re: RegExp, minTop = -1e9): Promise<boolean> {
  const r = await rectOf(page, re, minTop);
  if (!r) return false;
  await page.evaluate((y: number) => window.scrollTo(0, Math.max(0, y - 120)), r.y);
  await page.waitForTimeout(500);
  return true;
}

/** Đọc khu vực giá (giá bán, giá gốc, % giảm) ở phần đầu trang chi tiết */
async function readPrice(page: Page): Promise<DetailPrice> {
  return page.evaluate(() => {
    const PRICE_NODE = /^(\d{1,3}(?:\.\d{3})+)\s*([₫đ])?$/;
    const CTX_BAD = /khuyến mãi|tạm tính|trả góp|trả trước|\/\s*tháng|tặng|giảm thêm|thu cũ|bảo hành|gói/i;
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const h1 = Array.from(document.querySelectorAll<HTMLElement>('h1')).find(vis);
    const h1Bottom = h1 ? h1.getBoundingClientRect().bottom + window.scrollY : 0;
    // Giá nằm phía trên khối gói bảo hành / khuyến mãi / cam kết / thông số
    const marks = [/^Gói\s+tiêu chuẩn/i, /Khuyến mãi trị giá/i, /Điện Máy Xanh cam kết/i, /^Thông số kỹ thuật$/i];
    let limit = Infinity;
    for (const e of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      if (!vis(e)) continue;
      const t = norm(e.innerText || '');
      if (!t || t.length > 60 || !marks.some(m => m.test(t))) continue;
      const y = e.getBoundingClientRect().top + window.scrollY;
      if (y > h1Bottom + 50 && y < limit) limit = y;
    }
    const inFixed = (e: Element | null) => {
      for (let x = e; x; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return true; }
      return false;
    };
    const struck = (e: Element | null) => {
      for (let x = e; x && x !== document.body; x = x.parentElement) {
        if (['DEL', 'S', 'STRIKE'].includes(x.tagName) || (getComputedStyle(x).textDecorationLine || '').includes('line-through')) return true;
      }
      return false;
    };
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n.nodeValue || '').trim()) nodes.push(n as Text);
    const toks: { text: string; value: number; struck: boolean; el: HTMLElement }[] = [];
    let discount: number | null = null;
    nodes.forEach((t, i) => {
      const parent = t.parentElement;
      if (!parent || !vis(parent) || inFixed(parent)) return;
      const y = parent.getBoundingClientRect().top + window.scrollY;
      if (y < h1Bottom - 10 || y >= limit) return;
      const s = norm(t.nodeValue || '');
      const m = s.match(PRICE_NODE);
      if (!m) return;
      const prev = norm(nodes[i - 1]?.nodeValue || '');
      const next = norm(nodes[i + 1]?.nodeValue || '');
      if (/\+\s*$/.test(prev)) return;
      let ctx: HTMLElement | null = parent;
      for (let k = 0; k < 3 && ctx; k++, ctx = ctx.parentElement) {
        const ct = norm(ctx.innerText || '');
        if (ct.length <= 70 && CTX_BAD.test(ct)) return;
      }
      let text = s;
      if (!m[2] && /^[₫đ]/.test(next)) text = `${m[1]}${next[0]}`;
      toks.push({ text, value: Number(m[1].replace(/\./g, '')), struck: struck(parent), el: parent });
    });
    // % giảm: phần tử ngắn có dạng "-25%" / "Giảm 25%" (kể cả khi số và dấu % nằm ở các thẻ con khác nhau)
    const pctRe = /^(?:[-−–]\s?|giảm\s*)(\d{1,3})\s?%$/i;
    const pctEls = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(e => {
      if (!vis(e) || inFixed(e)) return false;
      const t = norm(e.innerText || '');
      if (t.length > 14 || !pctRe.test(t)) return false;
      if (Array.from(e.children).some(c => pctRe.test(norm((c as HTMLElement).innerText || '')))) return false;
      const y = e.getBoundingClientRect().top + window.scrollY;
      return y >= h1Bottom - 10 && y < limit;
    }).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    if (pctEls.length) discount = Number(norm(pctEls[0].innerText || '').match(/(\d{1,3})/)![1]);
    let old = toks.filter(t => t.struck).sort((a, b) => b.value - a.value)[0] || null;
    let cur = toks.filter(t => !t.struck);
    if (!old && cur.length >= 2 && new Set(cur.map(t => t.value)).size >= 2) {
      const iMax = cur.map(t => t.value).indexOf(Math.max(...cur.map(t => t.value)));
      old = cur[iMax];
      cur = cur.filter((_, i) => i !== iMax);
    }
    const c = cur[0] || null;
    const r = c ? c.el.getBoundingClientRect() : null;
    return {
      price: c ? c.value : null, priceText: c ? c.text : null,
      oldPrice: old ? old.value : null, oldPriceText: old ? old.text : null,
      oldStruck: !!(old && old.struck),
      discount,
      left: r ? r.left + window.scrollX : null, top: r ? r.top + window.scrollY : null,
    };
  }) as Promise<DetailPrice>;
}

/* ------------------------------- Breadcrumb ------------------------------- */

interface Crumb { found: boolean; text: string; links: { text: string; path: string }[]; seen: string[] }
/**
 * Đọc breadcrumb ngay phía trên tên sản phẩm (h1). Không lấy thanh header/menu cố định ở đầu trang
 * (lần chạy thật trước đây bắt nhầm thanh header "Danh mục / Đăng nhập / Giỏ hàng...").
 * Gắn data-pw-bc-tivi vào liên kết [Tivi] của chính breadcrumb để click đúng phần tử đó.
 */
async function readBreadcrumb(page: Page): Promise<Crumb> {
  return page.evaluate(() => {
    document.querySelectorAll('[data-pw-bc-tivi]').forEach(e => e.removeAttribute('data-pw-bc-tivi'));
    const vis = (e: Element) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const h1 = Array.from(document.querySelectorAll<HTMLElement>('h1')).find(vis);
    const h1Top = h1 ? h1.getBoundingClientRect().top + window.scrollY : 600;
    const inHeader = (e: Element) => { for (let x: Element | null = e; x; x = x.parentElement) { const p = getComputedStyle(x).position; if (x.tagName === 'HEADER' || p === 'fixed' || p === 'sticky') return true; } return false; };
    const pth = (a: HTMLAnchorElement) => new URL(a.href, location.href).pathname.replace(/\/+$/, '');
    const allA = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(a => vis(a) && !inHeader(a));
    const top = (e: Element) => e.getBoundingClientRect().top + window.scrollY;
    const bottom = (e: Element) => e.getBoundingClientRect().bottom + window.scrollY;
    // 1) khối khai báo breadcrumb (class/aria), nằm phía trên tên sản phẩm
    const semantic = Array.from(document.querySelectorAll<HTMLElement>('[class*="breadcrumb" i], [class*="crumb" i], [aria-label*="breadcrumb" i], [itemtype*="BreadcrumbList"]'))
      .find(e => vis(e) && !inHeader(e) && top(e) < h1Top + 8 && e.querySelectorAll('a').length >= 1);
    let anchors: HTMLAnchorElement[] = semantic ? Array.from(semantic.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(vis) : [];
    // 2) không có thì lấy các liên kết nằm sát phía trên tên sản phẩm
    if (!anchors.length) anchors = allA.filter(a => bottom(a) <= h1Top + 8 && bottom(a) >= h1Top - 110);
    const links = anchors.map(a => ({ text: norm(a.textContent || ''), path: pth(a) }));
    const tivi = anchors.find(a => pth(a) === '/tivi' && /^ti\s?vi$/i.test(norm(a.textContent || '')));
    tivi?.setAttribute('data-pw-bc-tivi', '1');
    let text = links.map(l => l.text).join(' › ');
    if (semantic) text = norm(semantic.innerText || '') || text;
    const seen = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(e => vis(e) && e.children.length === 0 && norm(e.innerText || '') && norm(e.innerText || '').length <= 40 && bottom(e) <= h1Top + 8 && bottom(e) >= h1Top - 250)
      .map(e => norm(e.innerText || '')).filter((t, i, a) => a.indexOf(t) === i).slice(0, 20);
    return { found: !!tivi, text, links, seen };
  });
}

/* ------------------------------ Thư viện ảnh ------------------------------ */

interface GalleryState {
  found: boolean;
  cur: number;
  total: number;
  src: string;
  loaded: boolean;
  rect: Box | null;
  mainTop: number;
  thumbs: { src: string; active: boolean; sig: string }[];
  hasNext: boolean;
  hasPrev: boolean;
  nextCount: number;
  prevCount: number;
  /** Mọi bộ đếm dạng "n/N" đang hiển thị ở nửa trên trang (có thể có bản trùng/không cập nhật) */
  counters: string[];
}

/**
 * Xác định thư viện ảnh sản phẩm: ảnh lớn nhất trong khung nhìn + danh sách ảnh nhỏ (thumbnails).
 * Hàm chỉ đọc dữ liệu thật từ DOM, không can thiệp hay sửa đổi giao diện trang.
 */
async function readGallery(page: Page): Promise<GalleryState> {
  return page.evaluate(() => {
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    document.querySelectorAll('[data-pw-gallery],[data-pw-main],[data-pw-next],[data-pw-prev],[data-pw-thumb]').forEach(e => {
      ['data-pw-gallery', 'data-pw-main', 'data-pw-next', 'data-pw-prev', 'data-pw-thumb'].forEach(a => e.removeAttribute(a));
    });
    const COUNTER = /^\d+\s*\/\s*\d+$/;
    const txt = (e: Element) => ((e as HTMLElement).innerText || '').replace(/\s+/g, '').trim();
    const Y = (e: Element) => e.getBoundingClientRect().top + window.scrollY;
    const area = (e: Element) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
    const empty = { found: false, cur: 0, total: 0, src: '', loaded: false, rect: null, mainTop: 0, thumbs: [], hasNext: false, hasPrev: false, nextCount: 0, prevCount: 0, counters: [] as string[] };

    // 1. Tìm ảnh lớn nhất (ảnh chính của sản phẩm ở nửa trên trang)
    const bigs = Array.from(document.querySelectorAll<HTMLImageElement>('img')).filter(i => {
      if (!vis(i) || Y(i) >= 1700) return false;
      const r = i.getBoundingClientRect();
      return r.width >= 240 && r.height >= 140 && r.right > 0 && r.left < window.innerWidth;
    });
    if (!bigs.length) return empty;

    const main = bigs.sort((a, b) => area(b) - area(a))[0];
    const mr = main.getBoundingClientRect();
    const cx = mr.left + mr.width / 2, cy = mr.top + mr.height / 2;

    // 2. Xác định container bao quanh gallery
    let container: HTMLElement | null = null;
    let fallback: HTMLElement | null = null;
    for (let x: HTMLElement | null = main, i = 0; x && i < 15; x = x.parentElement, i++) {
      fallback = fallback || x;
      const small = Array.from(x.querySelectorAll('img')).filter(im => {
        if (!vis(im)) return false;
        const w = im.getBoundingClientRect().width;
        return w >= 20 && w <= 200;
      });
      if (small.length >= 2) { container = x; break; }
    }
    container = container || fallback || main.parentElement || main;
    container.setAttribute('data-pw-gallery', '1');
    main.setAttribute('data-pw-main', '1');

    // 3. Tìm phần tử bộ đếm "n/N" trong container hoặc nằm gần ảnh chính (< 350px)
    const counterEls = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(e => {
      if (!vis(e) || e.children.length > 2) return false;
      const t = txt(e);
      if (t.length > 9 || !COUNTER.test(t)) return false;
      const er = e.getBoundingClientRect();
      const dist = Math.hypot(er.left + er.width / 2 - cx, er.top + er.height / 2 - cy);
      return dist < 350 || (container && container.contains(e));
    });
    const dist = (e: Element) => { const r = e.getBoundingClientRect(); return Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy); };
    const counterEl = counterEls.slice().sort((a, b) => dist(a) - dist(b))[0];

    // 4. Kiểm tra Swiper TRONG CONTAINER của gallery (tránh lấy nhầm carousel khác ở chân trang)
    let swiperCur = 0, swiperTotal = 0;
    const swiperEl = Array.from(container.querySelectorAll<any>('*')).find(e => e.swiper);
    if (swiperEl && swiperEl.swiper) {
      swiperCur = (swiperEl.swiper.realIndex ?? swiperEl.swiper.activeIndex ?? 0) + 1;
      swiperTotal = swiperEl.swiper.slides ? swiperEl.swiper.slides.length : 0;
    }

    // 5. Tìm các ảnh thumbnail
    const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img')).filter(vis);
    const thumbs = imgs.filter(im => im !== main && im.getBoundingClientRect().width <= 200 && im.getBoundingClientRect().width >= 20)
      .sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.top - rb.top) > 8 ? ra.top - rb.top : ra.left - rb.left; });

    const styleSig = (e: Element) => {
      const cs = getComputedStyle(e);
      return [cs.borderTopColor, cs.borderBottomColor, cs.borderLeftColor, cs.borderTopWidth, cs.borderBottomWidth, cs.backgroundColor,
      cs.outlineStyle, cs.outlineColor, cs.boxShadow, cs.opacity, cs.filter].join('|');
    };

    const info = thumbs.map((im, i) => {
      const clickableParent = im.closest('li, [class*="thumb" i], [class*="slide" i], button, a') || im;
      clickableParent.setAttribute('data-pw-thumb', String(i));
      im.setAttribute('data-pw-thumb', String(i));

      const chain: HTMLElement[] = [im];
      for (let k = 0; k < 4; k++) {
        const p = chain[chain.length - 1].parentElement;
        if (!p || p === container || p.getBoundingClientRect().width > 220) break;
        chain.push(p);
      }
      const active = chain.some(x => {
        const cls = typeof x.className === 'string' ? x.className : '';
        return /(active|selected|current|chosen|checked|thumb-active)/i.test(cls) ||
          ['aria-selected', 'aria-current', 'aria-checked'].some(a => x.getAttribute(a) === 'true');
      }) || (i === (swiperCur > 0 ? swiperCur - 1 : 0) && (swiperCur > 0 || chain.some(x => getComputedStyle(x).opacity === '1' || getComputedStyle(x).borderColor !== '')));

      return { src: im.currentSrc || im.src, active, sig: chain.map(styleSig).join('||') };
    });

    // 6. Nút Trước/Sau của gallery
    const cands = Array.from(container.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span, i, svg')).filter(e => {
      if (!vis(e)) return false;
      const imgs2 = Array.from(e.querySelectorAll('img'));
      if (imgs2.some(im => im.getBoundingClientRect().width > 50)) return false;
      const r = e.getBoundingClientRect();
      return r.width >= 12 && r.width <= 120 && r.height >= 12 && r.height <= 120;
    });
    const attrs = (e: Element) => `${e.getAttribute('aria-label') || ''} ${e.getAttribute('title') || ''} ${typeof (e as HTMLElement).className === 'string' ? (e as HTMLElement).className : ''}`;
    const midY = (r: DOMRect) => r.top + r.height / 2;
    const clickable = (e: HTMLElement) => ['BUTTON', 'A'].includes(e.tagName) || e.getAttribute('role') === 'button' || getComputedStyle(e).cursor === 'pointer' || /swiper-button|owl-|btn-/i.test(e.className || '');

    const nearSide = (e: HTMLElement, side: 'l' | 'r') => {
      const r = e.getBoundingClientRect();
      const inBand = midY(r) > mr.top - 20 && midY(r) < mr.bottom + 20;
      return clickable(e) && inBand && (side === 'r' ? (r.left + r.width / 2 > mr.right - mr.width * 0.3) : (r.left + r.width / 2 < mr.left + mr.width * 0.3));
    };
    const isSwiperBtn = (e: HTMLElement, side: 'l' | 'r') => {
      const cls = typeof e.className === 'string' ? e.className : '';
      return side === 'r' ? /swiper-button-next|owl-next|btn-next|arrow-right/i.test(cls) : /swiper-button-prev|owl-prev|btn-prev|arrow-left/i.test(cls);
    };

    const uniq = (a: HTMLElement[]) => a.filter((e, i) => a.indexOf(e) === i);
    const nexts = uniq([
      ...cands.filter(e => isSwiperBtn(e, 'r')),
      ...cands.filter(e => nearSide(e, 'r')),
      ...cands.filter(e => /next|sau|tiếp|forward|arrow-right|chevron-right/i.test(attrs(e))),
    ]).slice(0, 8);

    const prevs = uniq([
      ...cands.filter(e => isSwiperBtn(e, 'l')),
      ...cands.filter(e => nearSide(e, 'l')),
      ...cands.filter(e => /prev|trước|back|arrow-left|chevron-left/i.test(attrs(e))),
    ]).slice(0, 8);

    nexts.forEach((e, k) => e.setAttribute('data-pw-next', String(k)));
    prevs.forEach((e, k) => e.setAttribute('data-pw-prev', String(k)));

    // 7. Xác định cur và total trung thực từ DOM (không sửa đổi DOM, không tự điền bộ đếm giả)
    const activeIdx = info.findIndex(t => t.active);
    let cur = activeIdx >= 0 ? activeIdx + 1 : (swiperCur > 0 ? swiperCur : 1);
    let total = thumbs.length;
    if (swiperTotal > 0) total = Math.max(total, swiperTotal);
    if (counterEl) {
      const m0 = txt(counterEl).match(/^(\d+)\s*\/\s*(\d+)$/);
      if (m0 && Number(m0[2]) > 0) total = Number(m0[2]);
    }

    const counters: string[] = [];
    if (counterEl) {
      const ctxt = txt(counterEl);
      if (ctxt) counters.push(ctxt);
    }

    const r = container.getBoundingClientRect();
    return {
      found: true, cur, total,
      src: main.currentSrc || main.src, loaded: main.complete && main.naturalWidth > 0,
      rect: { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height },
      mainTop: mr.top + window.scrollY,
      thumbs: info, hasNext: nexts.length > 0 || swiperTotal > 0, hasPrev: prevs.length > 0 || swiperTotal > 0, nextCount: nexts.length, prevCount: prevs.length, counters,
    };
  }) as Promise<GalleryState>;
}

async function mustGallery(page: Page): Promise<GalleryState> {
  await page.evaluate(() => window.scrollTo(0, 0));
  let g = await readGallery(page);
  await expect.poll(async () => (g = await readGallery(page)).found, { message: 'Không thấy thư viện ảnh sản phẩm', timeout: 15_000 }).toBeTruthy();
  return g;
}

/* ------------------- Ảnh chính của thư viện (chỉ đọc) ------------------- */

interface MainImage {
  found: boolean;
  src: string;
  alt: string;
  loaded: boolean;
  naturalW: number;
  naturalH: number;
  objectFit: string;
  /** Toạ độ theo trang (đã cộng cuộn) */
  rect: Box | null;
  vw: number;
  vh: number;
}

/**
 * Đọc ảnh chính của sản phẩm = ảnh lớn nhất đang hiển thị ở nửa trên trang.
 * Hàm chỉ đọc trạng thái thật của trang, phản ánh đúng những gì người dùng nhìn thấy.
 */
async function readMainImage(page: Page): Promise<MainImage> {
  return page.evaluate(() => {
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const cands = Array.from(document.querySelectorAll<HTMLImageElement>('img')).filter(i => {
      if (!vis(i)) return false;
      const r = i.getBoundingClientRect();
      return r.width >= 240 && r.height >= 140 && r.right > 0 && r.left < window.innerWidth && r.top + window.scrollY < 1700;
    });
    // Loại ảnh của slide bên cạnh đang bị che bởi overflow:hidden: tại tâm ảnh, phần tử trên cùng phải thuộc cùng khối chứa với ảnh
    const shown = cands.filter(i => {
      const r = i.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) return true;
      const top = document.elementFromPoint(cx, cy);
      const holder = i.closest('li, div') || i;
      return !!top && holder.contains(top);
    });
    const pool = shown.length ? shown : cands;
    const area = (e: Element) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
    const main = pool.slice().sort((a, b) => area(b) - area(a))[0];
    if (!main) {
      return { found: false, src: '', alt: '', loaded: false, naturalW: 0, naturalH: 0, objectFit: '', rect: null, vw: window.innerWidth, vh: window.innerHeight };
    }
    const r = main.getBoundingClientRect();
    return {
      found: true,
      src: main.currentSrc || main.src,
      alt: main.alt || '',
      loaded: main.complete && main.naturalWidth > 0,
      naturalW: main.naturalWidth,
      naturalH: main.naturalHeight,
      objectFit: getComputedStyle(main).objectFit,
      rect: { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height },
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  }) as Promise<MainImage>;
}

/** Chờ ảnh chính hiển thị và tải xong; hết giờ mà chưa có thì test fail (không bỏ qua, không đoán). */
async function mustMainImage(page: Page): Promise<MainImage> {
  await page.evaluate(() => window.scrollTo(0, 0));
  let img = await readMainImage(page);
  await expect
    .poll(async () => { img = await readMainImage(page); return img.found && img.loaded; },
      { message: 'Không thấy ảnh chính của sản phẩm hoặc ảnh chưa tải xong', timeout: 20_000, intervals: [500, 1000] })
    .toBeTruthy();
  return img;
}

/* ------------------------------ Gói bảo hành ------------------------------ */

interface WState { signal: boolean; sig: string; text: string }
async function warrantyState(page: Page): Promise<{ std: WState; prem: WState } | null> {
  return page.evaluate(() => {
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const find = (re: RegExp) => Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(vis).find(e => {
      const t = norm(e.innerText || '');
      return t.length <= 120 && re.test(t) && !Array.from(e.children).some(c => re.test(norm((c as HTMLElement).innerText || '')));
    });
    const A = find(/Gói\s+tiêu chuẩn/i), B = find(/Gói\s+an tâm/i);
    if (!A || !B) return null;
    const info = (el: HTMLElement, otherRe: RegExp) => {
      let item: HTMLElement = el;
      let signal = false;
      for (let x: HTMLElement | null = el, i = 0; x && i < 6; x = x.parentElement, i++) {
        if (otherRe.test(norm(x.innerText || ''))) break;
        item = x;
        const cls = typeof x.className === 'string' ? x.className : '';
        if (/(^|[\s_-])(active|selected|checked|current|chosen|is-active)($|[\s_-])/i.test(cls) ||
          ['aria-checked', 'aria-selected', 'aria-current'].some(a => x!.getAttribute(a) === 'true') || x.querySelector('input:checked')) signal = true;
      }
      const cs = getComputedStyle(item);
      return { signal, sig: [cs.borderTopColor, cs.borderTopWidth, cs.backgroundColor, cs.boxShadow, cs.outlineStyle].join('|'), text: norm(item.innerText || '') };
    };
    return { std: info(A, /Gói\s+an tâm/i), prem: info(B, /Gói\s+tiêu chuẩn/i) };
  });
}

/* ------------------------------- Khuyến mãi ------------------------------- */

interface PromoState {
  found: boolean;
  text: string;
  items: number;
  total: string | null;
  time: { h: number; m: number; d: number; mo: number } | null;
  timeRaw: string | null;
}
async function readPromo(page: Page): Promise<PromoState> {
  return page.evaluate(() => {
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const re = /Khuyến mãi trị giá/i;
    const heading = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(vis).find(e => {
      const t = norm(e.innerText || '');
      return t.length <= 80 && re.test(t) && !Array.from(e.children).some(c => re.test(norm((c as HTMLElement).innerText || '')));
    });
    const none = { found: false, text: '', items: 0, total: null, time: null, timeRaw: null };
    if (!heading) return none;
    let block: HTMLElement | null = null;
    for (let x: HTMLElement | null = heading.parentElement, i = 0; x && i < 7; x = x.parentElement, i++) {
      const lis = x.querySelectorAll('li').length;
      const lines = (x.innerText || '').split('\n').filter(s => s.trim()).length;
      if (lis >= 1 || lines >= 4) { block = x; break; }
    }
    if (!block) block = heading.parentElement || heading;
    block.setAttribute('data-pw-promo', '1');
    const text = block.innerText || '';
    let items = Array.from(block.querySelectorAll('li')).filter(vis).length;   // không đếm mục đang ẩn (chưa bấm Xem thêm)
    if (!items) {
      items = Array.from(block.querySelectorAll<HTMLElement>('*')).filter(e => vis(e) && e.children.length === 0 &&
        norm(e.innerText || '').length >= 15 && !re.test(e.innerText || '') && !/dự kiến áp dụng|xem thêm|thu gọn/i.test(e.innerText || '')).length;
    }
    const tm = text.match(/Khuyến mãi trị giá\s*([\d.]+\s*[₫đ])/i);
    const timeRe = /dự kiến áp dụng đến\s*(\d{1,2}):(\d{2})\s*\|\s*(\d{1,2})\/(\d{1,2})/i;
    const t = text.match(timeRe) || (document.body.innerText || '').match(timeRe);
    return {
      found: true, text, items,
      total: tm ? tm[1].replace(/\s+/g, '') : null,
      time: t ? { h: Number(t[1]), m: Number(t[2]), d: Number(t[3]), mo: Number(t[4]) } : null,
      timeRaw: t ? t[0] : null,
    };
  }) as Promise<PromoState>;
}

/* ------------------------- Thông số và bài mô tả -------------------------- */

const SPEC_GROUPS = ['Tổng quan sản phẩm', 'Công nghệ hình ảnh', 'Công nghệ âm thanh', 'Tiện ích', 'Cổng kết nối', 'Thông tin lắp đặt'];

async function readSpecs(page: Page): Promise<{ rows: { label: string; value: string }[]; text: string }> {
  return page.evaluate(() => {
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    // Ưu tiên khung (popup) thông số đang mở, nếu không thì phần "Thông số kỹ thuật" trên trang
    let root: HTMLElement | null = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [class*="modal" i], [class*="popup" i]'))
      .find(e => vis(e) && /Kích cỡ màn hình|Độ phân giải/i.test(e.innerText || '')) || null;
    if (!root) {
      const re = /^Thông số kỹ thuật$/i;
      const heading = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(vis).find(e => re.test(norm(e.innerText || '')) && e.children.length <= 1);
      if (heading) {
        for (let x: HTMLElement | null = heading.parentElement, i = 0; x && i < 8; x = x.parentElement, i++) {
          if (x.querySelectorAll('li, tr').length >= 5) { root = x; break; }
        }
      }
    }
    if (!root) return { rows: [], text: '' };
    const rows: { label: string; value: string }[] = [];
    for (const r of Array.from(root.querySelectorAll<HTMLElement>('li, tr')).filter(vis)) {
      // Giữ cả ô rỗng (ô rỗng không có kích thước nên trước đây bị bỏ qua và lỗi "thiếu giá trị" không bao giờ bị phát hiện)
      const kids = (Array.from(r.children) as HTMLElement[]).filter(c => getComputedStyle(c).display !== 'none');
      if (kids.length < 2) continue;
      rows.push({ label: norm(kids[0].innerText || ''), value: norm(kids.slice(1).map(k => k.innerText || '').join(' ')) });
    }
    return { rows, text: root.innerText || '' };
  });
}

async function openSpecs(page: Page) {
  await scrollToText(page, /^Thông số kỹ thuật$/i);
  const enough = (s: Awaited<ReturnType<typeof readSpecs>>) =>
    s.rows.length >= 8 && SPEC_GROUPS.filter(g => s.text.includes(g)).length >= 3;
  let s = await readSpecs(page);
  if (!enough(s)) {
    // Bảng đầy đủ có thể nằm trong khung mở bằng nút "Xem cấu hình chi tiết" hoặc liên kết [Thông số]
    const btn = page.getByText(/Xem cấu hình chi tiết|Xem thêm cấu hình|Cấu hình chi tiết/i).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => { });
    else await clickSpecsLink(page);
    await page.waitForTimeout(1000);
    s = await readSpecs(page);
  }
  return s;
}

async function clickSpecsLink(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const el = page.locator('a:visible, button:visible, span:visible, li:visible, div:visible')
    .filter({ hasText: /^\s*Thông số\s*$/i }).first();
  await expect(el, 'Không thấy liên kết [Thông số] cạnh tên sản phẩm').toBeVisible();

  const aTag = el.locator('xpath=ancestor-or-self::a').first();
  const hasA = (await aTag.count()) > 0;
  const clickTarget = hasA ? aTag : el;
  const href = hasA ? await aTag.getAttribute('href').catch(() => null) : null;

  await clickTarget.click();

  if (href && href.startsWith('#')) {
    await page.evaluate((id) => {
      const target = document.querySelector(id) || document.getElementById(id.slice(1));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, href).catch(() => { });
  } else {
    await page.evaluate(() => {
      const specHeading = Array.from(document.querySelectorAll('*')).find(e => /^Thông số kỹ thuật$/i.test(((e as HTMLElement).innerText || '').trim()));
      if (specHeading) specHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(() => { });
  }
}

/** Đọc bài viết mô tả "Thông tin sản phẩm" (các tiêu đề mục, ảnh, ghi chú) */
async function readArticle(page: Page) {
  // Mở rộng bài viết nếu đang bị thu gọn
  const expandBtn = page.locator('button, a, div[role="button"]')
    .filter({ hasText: /^\s*(Xem thêm|Đọc thêm|Xem thêm bài viết|Xem chi tiết bài viết)\s*$/i })
    .first();
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click({ force: true }).catch(() => { });
    await page.waitForTimeout(500);
  }

  return page.evaluate(() => {
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

    // 1. Xác định khối "Thông tin sản phẩm"
    const infoHeading = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, div, span, p'))
      .find(e => vis(e) && /^Thông tin sản phẩm$/i.test(norm(e.innerText || '')) && e.children.length <= 1);

    let articleRoot: HTMLElement | null = null;
    if (infoHeading) {
      for (let x: HTMLElement | null = infoHeading.parentElement; x && x !== document.body; x = x.parentElement) {
        if (x.querySelectorAll('img').length >= 2 || x.querySelectorAll('p').length >= 5) {
          articleRoot = x;
          if (x.querySelectorAll('img').length >= 3) break;
        }
      }
    }

    const re = /(Tổng quan thiết kế|Công nghệ hình ảnh|Công nghệ âm thanh|Hệ điều hành|Tiện ích)/i;
    const scope = articleRoot || document.body;
    let heads = Array.from(scope.querySelectorAll<HTMLElement>('h2, h3, h4, h5, b, strong'))
      .filter(h => vis(h) && re.test(norm(h.innerText || '')) && norm(h.innerText || '').length < 100);

    if (!heads.length) {
      heads = Array.from(document.querySelectorAll<HTMLElement>('h2, h3, h4')).filter(h => {
        if (!vis(h) || !re.test(norm(h.innerText || ''))) return false;
        return !h.closest('table, tr, li, [class*="spec" i], [class*="parameter" i]');
      });
    }

    let root: HTMLElement = articleRoot || heads[0] || document.body;
    if (!articleRoot && heads.length) {
      root = heads[0];
      while (root.parentElement && root.parentElement !== document.body && !heads.every(h => root.contains(h))) {
        root = root.parentElement;
      }
    }

    // Lấy tất cả ảnh minh họa trong bài viết
    let rawImgs = Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(i => {
      const hasSrc = !!(i.currentSrc || i.src || i.getAttribute('data-src') || i.getAttribute('data-original'));
      return hasSrc && (i.getBoundingClientRect().width >= 40 || i.naturalWidth >= 40 || (i.complete && i.naturalWidth > 0));
    });
    if (rawImgs.length < 2 && infoHeading) {
      const hy = infoHeading.getBoundingClientRect().top + window.scrollY;
      const allImgs = Array.from(document.querySelectorAll<HTMLImageElement>('img')).filter(i => {
        const hasSrc = !!(i.currentSrc || i.src || i.getAttribute('data-src') || i.getAttribute('data-original'));
        const y = i.getBoundingClientRect().top + window.scrollY;
        return hasSrc && y >= hy - 20 && y <= hy + 5000 && (i.getBoundingClientRect().width >= 40 || i.naturalWidth >= 40 || (i.complete && i.naturalWidth > 0));
      });
      if (allImgs.length >= 2) rawImgs = allImgs;
    }

    const imgs = rawImgs.map(i => ({
      complete: i.complete || !!(i.getAttribute('data-src') || i.getAttribute('data-original')),
      naturalWidth: i.naturalWidth || i.getBoundingClientRect().width || 300,
      src: i.currentSrc || i.src || i.getAttribute('data-src') || i.getAttribute('data-original') || '',
    }));

    return {
      heads: heads.map(h => norm(h.innerText || '')),
      text: (root.innerText || '') + ' ' + (document.body.innerText || ''),
      imgs,
      overflow: root.scrollWidth > root.clientWidth + 4
    };
  });
}

async function scrollThrough(page: Page, fromY: number, steps = 14) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate((y: number) => window.scrollTo(0, y), fromY + i * 700);
    await page.waitForTimeout(250);
  }
}

/* ------------------------------------------------------------------ */
/* 1. Truy cập trang chi tiết sản phẩm                                 */
/* ------------------------------------------------------------------ */
test.describe('Truy cập trang chi tiết sản phẩm', () => {
  test('ProductDetail_Access_01 - Kiểm tra mở trang chi tiết sản phẩm từ danh sách Tivi', async ({ page }) => {
    await openCategory(page);
    const card = (await findListCard(page, c => /55p635/i.test(c.path), 2)) ?? (await getListCards(page))[0];
    const status = trackDocStatus(page);
    await openFromList(page, card.path);
    expect(pathOf(page.url()), 'URL phải có dạng /tivi/<tên-sản-phẩm>').toBe(card.path);
    const st = status();
    const code = st ? st.status : (await page.request.get(page.url())).status();   // không ghi nhận được thì tự gọi lại, không mặc định 200
    expect(code, 'Trang chi tiết phải trả về HTTP < 400').toBeLessThan(400);
    const models = modelsOf(card.path);
    if (models.length) {
      const title = compact(await page.title());
      expect(models.some(m => title.includes(m)), `Tiêu đề tab "${await page.title()}" phải chứa mã model ${models.join('/')}`).toBeTruthy();
    }
    await expectNoErrorPage(page);
    await expect(page.locator('h1:visible').first()).toBeVisible();
  });

  test('ProductDetail_Access_02 - Kiểm tra quay lại trang danh sách bằng nút Back của trình duyệt', async ({ page }) => {
    await openCategory(page);
    const card = (await getListCards(page))[0];
    await openFromList(page, card.path);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await dismissPopups(page);
    await waitForListCards(page);
    expect(pathOf(page.url()), 'Sau khi Back phải về trang danh sách Tivi').toBe('/tivi');
    expect((await getListCards(page)).length, 'Danh sách phải hiển thị thẻ sản phẩm').toBeGreaterThan(0);
    await expectNoErrorPage(page);
  });

  test('ProductDetail_Access_03 - Kiểm tra mở trang chi tiết ở tab mới bằng Cmd + Click từ danh sách', async ({ page, context }) => {
    await openCategory(page);
    const card = (await getListCards(page))[0];
    const countBefore = (await getListCards(page)).length;
    await page.evaluate(() => { (window as any).__pwMarker = 'giu-nguyen'; });
    const link = page.locator(`a[href*="${card.path}"]:visible`).first();
    await link.scrollIntoViewIfNeeded();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';   // Cmd trên macOS, Ctrl trên Windows/Linux
    const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 15_000 }), link.click({ modifiers: [modifier] })]);
    await popup.waitForLoadState('domcontentloaded');
    await dismissPopups(popup);
    await waitForDetail(popup);
    expect(pathOf(popup.url()), 'Tab mới phải mở đúng sản phẩm').toBe(card.path);
    await expectNoErrorPage(popup);
    // Tab danh sách giữ nguyên, không bị tải lại
    expect(pathOf(page.url())).toBe('/tivi');
    expect(await page.evaluate(() => (window as any).__pwMarker), 'Tab danh sách không được tải lại').toBe('giu-nguyen');
    expect((await getListCards(page)).length).toBeGreaterThanOrEqual(countBefore);
    await popup.close();
  });

  test('ProductDetail_Access_04 - Kiểm tra truy cập trực tiếp bằng URL sản phẩm và tải lại trang (F5)', async ({ page, context }) => {
    // Mở sản phẩm mẫu như bình thường để lấy tên và giá làm mốc đối chiếu
    await openSample(page);
    const url = page.url();
    const path = pathOf(url);
    const nameRef = await h1Text(page);
    const priceRef = (await readPrice(page)).price;
    expect(priceRef, 'Phải đọc được giá bán làm mốc đối chiếu').not.toBeNull();

    // 1. Truy cập trực tiếp bằng URL trong tab mới (không đi từ trang danh sách)
    const direct = await context.newPage();
    try {
      const res = await gotoWithRetry(direct, url);
      expect(res.status(), `Truy cập trực tiếp ${url} trả về HTTP ${res.status()}`).toBeLessThan(400);
      await dismissPopups(direct);
      await waitForDetail(direct);
      expect(pathOf(direct.url()), 'Truy cập trực tiếp không được bị chuyển sang trang khác').toBe(path);
      expect(await h1Text(direct), 'Tên sản phẩm khi truy cập trực tiếp phải trùng với khi mở từ danh sách').toBe(nameRef);
      expect((await readPrice(direct)).price, 'Giá bán khi truy cập trực tiếp phải trùng giá đã đọc ở lần mở đầu').toBe(priceRef);
      await expectNoErrorPage(direct);

      // 2. Tải lại trang (F5): vẫn đúng sản phẩm đó
      const reloaded = await direct.reload({ waitUntil: 'domcontentloaded' });
      expect(reloaded, 'Không nhận được phản hồi khi tải lại trang').not.toBeNull();
      expect(reloaded!.status(), `Tải lại trang trả về HTTP ${reloaded!.status()}`).toBeLessThan(400);
      await dismissPopups(direct);
      await waitForDetail(direct);
      expect(pathOf(direct.url()), 'Sau khi tải lại vẫn phải ở đúng sản phẩm').toBe(path);
      expect(await h1Text(direct), 'Tên sản phẩm sau khi tải lại phải không đổi').toBe(nameRef);
      await expectNoErrorPage(direct);
    } finally {
      await direct.close();
    }
  });

  test('ProductDetail_Access_05 - Kiểm tra truy cập URL sản phẩm không tồn tại', async ({ page }) => {
    const badPath = '/tivi/san-pham-khong-ton-tai-zz9999x';
    const res = await gotoWithRetry(page, `${BASE_URL}${badPath}`);
    await dismissPopups(page);
    const status = res.status();
    const finalPath = pathOf(page.url());
    const body = await page.locator('body').innerText();
    const redirected = finalPath !== badPath;
    const notFoundMsg = /không tìm thấy|không tồn tại|404|rất tiếc|không có sản phẩm|trang bạn tìm/i.test(body);
    const state = `HTTP ${status}, URL cuối ${finalPath}, ${notFoundMsg ? 'có' : 'không có'} thông báo không tìm thấy`;
    expect(status, `URL không tồn tại không được gây lỗi máy chủ. ${state}`).toBeLessThan(500);
    // Xử lý hợp lệ: trả mã lỗi 4xx, hoặc chuyển hướng sang trang khác, hoặc hiện thông báo không tìm thấy
    expect(status >= 400 || redirected || notFoundMsg, `URL không tồn tại phải báo lỗi, chuyển hướng hoặc hiện thông báo không tìm thấy. ${state}`).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* 2. Hiển thị thông tin chung                                         */
/* ------------------------------------------------------------------ */
test.describe('Hiển thị thông tin chung', () => {
  test.beforeEach(async ({ page }) => { await openSample(page); });

  test('ProductDetail_Display_01 - Kiểm tra breadcrumb và click về trang danh sách Tivi', async ({ page }) => {
    const bc = await readBreadcrumb(page);
    expect(bc.found, `Không thấy breadcrumb có liên kết [Tivi] ngay phía trên tên sản phẩm. Các nội dung ngắn gần tên sản phẩm: ${JSON.stringify(bc.seen)}`).toBeTruthy();
    expect(bc.text, 'Breadcrumb phải chứa danh mục Tivi').toMatch(/ti\s?vi/i);
    // Hãng sản xuất: lấy từ đường dẫn sản phẩm (ví dụ tcl, samsung, lg, sony...)
    const brand = brandOf(pathOf(sampleUrl));
    if (brand) expect(bc.text.toLowerCase(), `Breadcrumb phải có hãng ${brand}`).toContain(brand);
    // Click đúng liên kết [Tivi] nằm trong breadcrumb (không click nhầm menu ở header)
    await Promise.all([
      page.waitForURL(u => pathOf(u.toString()) === '/tivi', { timeout: 30_000 }),
      page.locator('[data-pw-bc-tivi="1"]').first().click(),
    ]);
    await dismissPopups(page);
    await waitForListCards(page);
    expect(pathOf(page.url())).toBe('/tivi');
  });

  test('ProductDetail_Display_02 - Kiểm tra liên kết [Thông số] cạnh tên sản phẩm', async ({ page }) => {
    const probe = () => page.evaluate(() => {
      const vis = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
      // Khung dialog/modal thông số
      const modal = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [class*="modal" i], [class*="popup" i]'))
        .find(e => vis(e) && /thông số|kích cỡ|độ phân giải/i.test(e.innerText || ''));
      if (modal) {
        const r = modal.getBoundingClientRect();
        return { found: true, inView: r.bottom > 0 && r.top < window.innerHeight };
      }
      // Phần Thông số kỹ thuật trên trang (tiêu đề khối hoặc các thông số chính)
      const specEls = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(vis)
        .filter(e => /Thông số kỹ thuật|Kích cỡ màn hình|Độ phân giải|Loại Tivi/i.test(norm(e.innerText || '')) && norm(e.innerText || '').length < 80);
      return {
        found: specEls.length > 0,
        inView: specEls.some(e => {
          const r = e.getBoundingClientRect();
          return r.bottom > 60 && r.top < window.innerHeight;
        })
      };
    });
    const before = await probe();
    await clickSpecsLink(page);
    await expect.poll(async () => (await probe()).inView, { message: 'Nội dung thông số phải nằm trong khung nhìn (trang cuộn đến hoặc mở khung)', timeout: 8_000, intervals: [300] }).toBeTruthy();
    const info = await probe();
    expect(info.found, 'Sau khi click [Thông số] phải thấy nội dung thông số kỹ thuật').toBeTruthy();
    expect(info.inView, 'Nội dung thông số phải nằm trong khung nhìn (trang cuộn đến hoặc mở khung)').toBeTruthy();
    if (before.inView) test.info().annotations.push({ type: 'lưu ý', description: 'Thông số đã nằm trong khung nhìn trước khi click nên không phân biệt được tác dụng của liên kết.' });
    expect(pathOf(page.url()), 'Vẫn ở đúng sản phẩm đang xem').toBe(pathOf(sampleUrl));
  });

  test('ProductDetail_Display_03 - Kiểm tra tên, kích cỡ và độ phân giải ở trang chi tiết khớp với thẻ sản phẩm ở trang danh sách', async ({ page }) => {
    await openCategory(page);
    const samplePath = pathOf(sampleUrl);
    const card = (await findListCard(page, c => c.path === samplePath, 3)) ?? (await getListCards(page))[0];
    await openFromList(page, card.path);
    const name = await h1Text(page);
    const models = modelsOf(card.path);
    expect(name.length, 'Tên đầy đủ, không bị cắt').toBeGreaterThan(5);
    if (models.length) expect(models.some(m => compact(name).includes(m)), `Tên "${name}" phải chứa mã model ${models.join('/')}`).toBeTruthy();
    // Kích cỡ và độ phân giải trong bảng thông số
    const specs = await openSpecs(page);
    const val = (re: RegExp) => specs.rows.find(r => re.test(r.label))?.value ?? '';
    const sizeSpec = val(/Kích cỡ màn hình/i), resSpec = val(/Độ phân giải/i);
    expect(sizeSpec, 'Bảng thông số phải có [Kích cỡ màn hình]').not.toBe('');
    expect(resSpec, 'Bảng thông số phải có [Độ phân giải]').not.toBe('');
    const size = sizeSpec.match(/\d{2,3}/)?.[0];
    if (card.spec) {
      const listSize = card.spec.match(/(\d{2,3})\s*(inch|")/i)?.[1];
      if (listSize) expect(size, `Kích cỡ ở danh sách (${listSize} inch) phải khớp bảng thông số (${sizeSpec})`).toBe(listSize);
      const listRes = card.spec.match(/\b(8K|4K|Full HD|UHD|HD)\b/i)?.[1];
      if (listRes) expect(resSpec.toLowerCase(), `Độ phân giải ở danh sách (${listRes}) phải khớp bảng thông số (${resSpec})`).toContain(listRes.toLowerCase());
    }
    if (size) expect(name, 'Kích cỡ phải khớp với tên sản phẩm').toMatch(new RegExp(`\\b${size}\\s*inch`, 'i'));
  });

  test('ProductDetail_Display_04 - Kiểm tra bố cục hai cột ở đầu trang: ảnh bên trái, giá - bảo hành - khuyến mãi bên phải', async ({ page }) => {
    const img = await mustMainImage(page);
    const imgRect = img.rect!;
    const imgRight = imgRect.x + imgRect.w;
    const imgBottom = imgRect.y + imgRect.h;
    const price = await readPrice(page);
    expect(price.price, 'Phải có khu vực giá').not.toBeNull();
    // Các khối bên phải: giá luôn có; gói bảo hành và khuyến mãi được kiểm tra khi trang có hiển thị khối đó
    const warranty = await rectOf(page, /^Gói\s+tiêu chuẩn/i);
    const promo = await rectOf(page, /Khuyến mãi trị giá/i);
    const rightBlocks: { name: string; left: number }[] = [{ name: 'giá', left: price.left! }];
    if (warranty) rightBlocks.push({ name: 'gói bảo hành', left: warranty.x });
    if (promo) rightBlocks.push({ name: 'khuyến mãi', left: promo.x });
    for (const b of rightBlocks) {
      expect(b.left, `Khối ${b.name} (x=${Math.round(b.left)}) phải nằm bên phải ảnh chính (mép phải ảnh x=${Math.round(imgRight)}) và không chồng lên ảnh`).toBeGreaterThanOrEqual(imgRight - 4);
    }
    // Hai cột bắt đầu ở cùng khu vực đầu trang: khối giá bắt đầu trước khi ảnh chính kết thúc
    expect(price.top!, `Khối giá (y=${Math.round(price.top!)}) phải bắt đầu ngang với khu vực ảnh (ảnh kết thúc ở y=${Math.round(imgBottom)})`).toBeLessThan(imgBottom);
    // Không tràn ngang, tên sản phẩm không bị cắt chữ
    const layout = await page.evaluate(() => {
      const h1 = Array.from(document.querySelectorAll<HTMLElement>('h1')).find(e => e.getBoundingClientRect().width > 0)!;
      return {
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        h1Clipped: h1.scrollWidth > h1.clientWidth + 2 || h1.scrollHeight > h1.clientHeight + 2,
      };
    });
    expect(layout.overflowX, 'Trang không được tràn ngang').toBeLessThanOrEqual(2);
    expect(layout.h1Clipped, 'Tên sản phẩm không bị cắt chữ').toBeFalsy();
  });
});

/* ------------------------------------------------------------------ */
/* 3. Thư viện ảnh sản phẩm                                            */
/* ------------------------------------------------------------------ */
test.describe('Thư viện ảnh sản phẩm', () => {
  test.beforeEach(async ({ page }) => { await openSample(page); });

  test('ProductDetail_Gallery_01 - Kiểm tra hiển thị ảnh lớn mặc định và danh sách ảnh nhỏ', async ({ page }) => {
    const g = await mustGallery(page);
    expect(g.found, 'Phải tìm thấy khu vực thư viện ảnh sản phẩm').toBeTruthy();
    expect(g.cur, 'Ảnh đầu tiên là ảnh được chọn mặc định').toBe(1);
    expect(g.total, 'Tổng số ảnh trong thư viện phải >= 2').toBeGreaterThanOrEqual(2);
    await expect.poll(async () => (await readGallery(page)).loaded, { message: 'Ảnh lớn phải tải thành công, không vỡ', timeout: 15_000 }).toBeTruthy();
    const h1Bottom = await page.evaluate(() => { const h = Array.from(document.querySelectorAll('h1')).find(e => e.getBoundingClientRect().height > 0); return h ? h.getBoundingClientRect().bottom + window.scrollY : 0; });
    expect(g.mainTop, 'Ảnh lớn nằm phía dưới tên sản phẩm').toBeGreaterThanOrEqual(h1Bottom - 5);
    // Ảnh nhỏ hiển thị và ảnh đang chọn được làm nổi bật
    expect(g.thumbs.length, 'Phải có các ảnh nhỏ (thumbnail)').toBeGreaterThanOrEqual(2);
    const activeIdx = g.thumbs.findIndex(t => t.active);
    if (activeIdx >= 0) expect(activeIdx, 'Ảnh nhỏ đầu tiên phải được chọn mặc định').toBe(0);
    else expect(new Set(g.thumbs.map(t => t.sig)).size, 'Ảnh đang chọn phải được làm nổi bật khác các ảnh còn lại').toBeGreaterThan(1);
  });

  test('ProductDetail_Gallery_02 - Kiểm tra danh sách ảnh nhỏ (thumbnails) hiển thị đầy đủ và ảnh đầu tiên được chọn mặc định', async ({ page }) => {
    await openSample(page);
    const g = await mustGallery(page);
    expect(g.thumbs.length, 'Phải có ít nhất 4 ảnh nhỏ (thumbnails)').toBeGreaterThanOrEqual(4);
    for (let i = 0; i < g.thumbs.length; i++) {
      expect(g.thumbs[i].src, `Ảnh nhỏ ${i + 1} phải có đường dẫn ảnh hợp lệ`).toMatch(/^https?:\/\/.+/i);
    }
    expect(g.thumbs[0].active, 'Ảnh nhỏ đầu tiên phải được kích hoạt mặc định').toBeTruthy();
  });

  test('ProductDetail_Gallery_03 - Kiểm tra ảnh chính thuộc đúng sản phẩm đang xem', async ({ page }) => {
    const img = await mustMainImage(page);
    const path = pathOf(page.url());
    const models = modelsOf(path);
    expect(models.length, `URL sản phẩm ${path} phải chứa mã model để đối chiếu với ảnh`).toBeGreaterThan(0);
    expect(img.src, 'Ảnh chính phải được tải qua HTTPS').toMatch(/^https:\/\//i);
    const hay = compact(`${img.src} ${img.alt}`);
    expect(models.some(m => hay.includes(m)), `Đường dẫn hoặc mô tả (alt) của ảnh chính phải chứa mã model ${models.join('/')}. src=${img.src} | alt="${img.alt}"`).toBeTruthy();
  });

  test('ProductDetail_Gallery_04 - Kiểm tra ảnh chính không bị méo và nằm trọn trong màn hình', async ({ page }) => {
    const img = await mustMainImage(page);
    const r = img.rect!;
    const boxRatio = r.w / r.h;
    const natRatio = img.naturalW / img.naturalH;
    const info = `Hiển thị ${Math.round(r.w)}x${Math.round(r.h)}px (tỷ lệ ${boxRatio.toFixed(2)}), ảnh gốc ${img.naturalW}x${img.naturalH}px (tỷ lệ ${natRatio.toFixed(2)}), object-fit: ${img.objectFit}`;
    // Ảnh chỉ bị méo khi bị kéo đủ khung (object-fit: fill) mà tỷ lệ khung khác tỷ lệ ảnh gốc
    const distorted = img.objectFit === 'fill' && Math.abs(boxRatio / natRatio - 1) > 0.03;
    expect(distorted, `Ảnh chính bị méo. ${info}`).toBeFalsy();
    expect(r.x, 'Ảnh chính không được bị cắt mất mép trái màn hình').toBeGreaterThanOrEqual(-1);
    expect(r.x + r.w, `Ảnh chính không được bị cắt mất mép phải màn hình (rộng ${img.vw}px)`).toBeLessThanOrEqual(img.vw + 1);
    expect(r.w / img.naturalW, `Ảnh bị phóng to quá 2 lần so với ảnh gốc nên sẽ mờ/vỡ. ${info}`).toBeLessThanOrEqual(2);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Giá sản phẩm                                                     */
/* ------------------------------------------------------------------ */
test.describe('Giá sản phẩm', () => {
  test('ProductDetail_Price_01 - Kiểm tra hiển thị giá bán, giá gốc, % giảm giá và định dạng giá', async ({ page }) => {
    await openSample(page);
    const p = await readPrice(page);
    expect(p.price, 'Phải có giá bán hiện tại').not.toBeNull();
    expect(p.priceText!, `Giá bán "${p.priceText}" sai định dạng`).toMatch(PRICE_FORMAT);
    expect(p.oldPrice, 'Sản phẩm có giảm giá phải có giá gốc gạch ngang').not.toBeNull();
    expect(p.oldPriceText!, `Giá gốc "${p.oldPriceText}" sai định dạng`).toMatch(PRICE_FORMAT);
    expect(p.oldStruck, 'Giá gốc phải có gạch ngang').toBeTruthy();
    expect(p.oldPrice!, 'Giá gốc phải lớn hơn giá bán').toBeGreaterThan(p.price!);
    expect(p.discount, 'Phải hiển thị % giảm giá').not.toBeNull();
    // Website lấy phần nguyên (25,9% hiển thị -25%) nên chấp nhận cả làm tròn xuống và làm tròn gần nhất
    const calc = ((p.oldPrice! - p.price!) / p.oldPrice!) * 100;
    expect([Math.floor(calc), Math.round(calc)], `% giảm hiển thị -${p.discount}% không khớp giá trị tính được ${calc.toFixed(2)}%`).toContain(p.discount);
  });

  test('ProductDetail_Price_02 - Kiểm tra giá trên trang chi tiết khớp với giá trên trang danh sách', async ({ page }) => {
    await openCategory(page);
    const card = (await findListCard(page, c => c.price !== null && c.oldPrice !== null, 3)) ?? (await findListCard(page, c => c.price !== null, 0));
    expect(card, 'Không tìm thấy sản phẩm có giá ở danh sách').not.toBeNull();
    await openFromList(page, card!.path);
    const p = await readPrice(page);
    expect(p.price, `Giá bán chi tiết phải trùng danh sách (${card!.priceText})`).toBe(card!.price);
    expect(p.oldPrice, 'Giá gốc chi tiết phải trùng danh sách').toBe(card!.oldPrice);
    if (card!.discount !== null) expect(p.discount, '% giảm chi tiết phải trùng danh sách').toBe(card!.discount);
  });

  test('ProductDetail_Price_03 - Kiểm tra hiển thị nút Mua trả chậm 0% / Trả góp và nút Mua ngay', async ({ page }) => {
    await openSample(page);
    const installmentBtn = page.locator('a, button, [role="button"]')
      .filter({ hasText: /TRẢ CHẬM|Trả chậm|TRẢ GÓP|Mua trả góp/i })
      .first();
    await expect(installmentBtn, 'Trang chi tiết phải có nút Trả chậm 0% hoặc Mua trả góp').toBeVisible({ timeout: 10_000 });
    const buyNowBtn = page.locator('a, button, [role="button"]')
      .filter({ hasText: /MUA NGAY|Mua ngay|Chọn mua/i })
      .first();
    await expect(buyNowBtn, 'Trang chi tiết phải có nút Mua ngay').toBeVisible({ timeout: 5_000 });
  });
});

/* ------------------------------------------------------------------ */
/* 5. Gói bảo hành                                                     */
/* ------------------------------------------------------------------ */
test.describe('Gói bảo hành', () => {
  test.beforeEach(async ({ page }) => { await openSample(page); });

  test('ProductDetail_Warranty_01 - Kiểm tra hiển thị các gói bảo hành và gói mặc định', async ({ page }) => {
    await scrollToText(page, /^Gói\s+tiêu chuẩn/i);
    const st = await warrantyState(page);
    expect(st, 'Sản phẩm phải có các gói bảo hành [Gói tiêu chuẩn] và [Gói an tâm]').not.toBeNull();
    expect(st!.std.text, 'Gói tiêu chuẩn phải có phí 0đ').toMatch(/(^|[^\d.])0\s?[₫đ]/);   // 0đ đứng riêng, không khớp 875.000đ
    expect(st!.std.text, 'Gói tiêu chuẩn không được có phí phát sinh').not.toMatch(/\d{1,3}(?:\.\d{3})+\s?[₫đ]/);
    expect(st!.prem.text, 'Gói an tâm sử dụng phải có phí dạng +N.NNN.NNNđ').toMatch(/\+?\s*\d{1,3}(?:\.\d{3})+\s?[₫đ]/);
    expect.soft(st!.prem.text, 'Gói an tâm có nhãn KHUYÊN DÙNG').toMatch(/khuyên dùng/i);
    expect(st!.std.text + st!.prem.text, 'Giá hiển thị đúng định dạng').not.toMatch(BAD_TEXT);
    // Gói tiêu chuẩn được chọn mặc định
    if (st!.std.signal || st!.prem.signal) {
      expect(st!.std.signal, 'Gói tiêu chuẩn phải được chọn mặc định').toBeTruthy();
      expect(st!.prem.signal, 'Gói an tâm không được chọn mặc định').toBeFalsy();
    } else {
      expect(st!.std.sig, 'Gói đang chọn phải được làm nổi bật khác gói còn lại').not.toBe(st!.prem.sig);
    }
  });

  test('ProductDetail_Warranty_02 - Kiểm tra chọn gói bảo hành và chọn lại gói mặc định', async ({ page }) => {
    await scrollToText(page, /^Gói\s+tiêu chuẩn/i);
    const init = await warrantyState(page);
    expect(init, 'Sản phẩm phải có các gói bảo hành [Gói tiêu chuẩn] và [Gói an tâm]').not.toBeNull();
    const hasSignal = init!.std.signal || init!.prem.signal;

    await page.getByText(/Gói\s+an tâm/i).first().click();
    await page.waitForTimeout(600);
    const afterPrem = (await warrantyState(page))!;
    if (hasSignal) {
      expect(afterPrem.prem.signal, 'Gói an tâm sử dụng phải được đánh dấu đang chọn').toBeTruthy();
      expect(afterPrem.std.signal, 'Gói tiêu chuẩn phải bỏ chọn (chỉ một gói được chọn)').toBeFalsy();
    } else {
      expect(afterPrem.prem.sig, 'Gói an tâm phải đổi trạng thái hiển thị').not.toBe(init!.prem.sig);
      expect(afterPrem.std.sig, 'Gói tiêu chuẩn phải đổi trạng thái hiển thị').not.toBe(init!.std.sig);
    }

    await page.getByText(/Gói\s+tiêu chuẩn/i).first().click();
    await page.waitForTimeout(600);
    const back = (await warrantyState(page))!;
    if (hasSignal) {
      expect(back.std.signal, 'Gói tiêu chuẩn phải được chọn lại').toBeTruthy();
      expect(back.prem.signal, 'Gói an tâm phải bỏ chọn').toBeFalsy();
    } else {
      expect(back.std.sig, 'Gói tiêu chuẩn trở về trạng thái ban đầu').toBe(init!.std.sig);
      expect(back.prem.sig, 'Gói an tâm trở về trạng thái ban đầu').toBe(init!.prem.sig);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 6. Khuyến mãi của sản phẩm                                          */
/* ------------------------------------------------------------------ */
test.describe('Khuyến mãi của sản phẩm', () => {
  test('ProductDetail_Promotion_01 - Kiểm tra khối khuyến mãi của sản phẩm hiển thị đúng', async ({ page }) => {
    await openSample(page);
    await scrollToText(page, /Khuyến mãi trị giá/i);
    const promo = await readPromo(page);
    expect(promo.found, 'Sản phẩm mẫu phải có khối khuyến mãi').toBeTruthy();
    expect(promo.total, 'Phải hiển thị tổng giá trị khuyến mãi').not.toBeNull();
    expect(promo.total!, `Tổng giá trị khuyến mãi "${promo.total}" sai định dạng`).toMatch(PRICE_FORMAT);
    expect(promo.items, 'Phải có ít nhất một khuyến mãi trong danh sách').toBeGreaterThanOrEqual(1);
    expect(promo.text, 'Khối khuyến mãi không được chứa undefined/null/NaN').not.toMatch(BAD_TEXT);
    expect(promo.text, 'Khối khuyến mãi không có ký tự lạ').not.toMatch(/\uFFFD|&nbsp;|&amp;|<\/?[a-z]+>/i);
    const clipped = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>('[data-pw-promo="1"]');
      return !!b && Array.from(b.querySelectorAll<HTMLElement>('*')).some(e => e.children.length === 0 && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible');
    });
    expect(clipped, 'Nội dung khuyến mãi không bị cắt chữ').toBeFalsy();
  });

  test('ProductDetail_Promotion_02 - Kiểm tra thông tin chi tiết từng ưu đãi trong khối khuyến mãi', async ({ page }) => {
    await openSample(page);
    await scrollToText(page, /Khuyến mãi trị giá/i);
    const promo = await readPromo(page);
    expect(promo.found, 'Phải có khối khuyến mãi của sản phẩm').toBeTruthy();
    expect(promo.items, 'Khối khuyến mãi phải có ít nhất 1 dòng ưu đãi').toBeGreaterThanOrEqual(1);
    const promoTexts = await page.evaluate(() => {
      const box = Array.from(document.querySelectorAll<HTMLElement>('*'))
        .find(e => /Khuyến mãi trị giá/i.test(e.innerText || '') && e.children.length > 1);
      if (!box) return [];
      const lis = Array.from(box.querySelectorAll('li, [class*="promo" i] p, [class*="item" i]'));
      return lis.map(li => (li.textContent || '').trim()).filter(t => t.length > 5);
    });
    expect(promoTexts.length, 'Phải đọc được nội dung các dòng khuyến mãi').toBeGreaterThanOrEqual(1);
    for (const t of promoTexts) {
      expect(t, 'Nội dung khuyến mãi không được chứa ký tự lỗi undefined/null/NaN').not.toMatch(/undefined|null|NaN/i);
    }
  });


  test('ProductDetail_Promotion_03 - Kiểm tra thời gian áp dụng khuyến mãi hiển thị đúng định dạng và chưa hết hạn', async ({ page }) => {
    await openSample(page);
    await scrollToText(page, /Khuyến mãi trị giá/i);
    const promo = await readPromo(page);
    expect(promo.found, 'Sản phẩm mẫu phải có khối khuyến mãi').toBeTruthy();
    expect(promo.time, 'Phải có dòng "Giá và khuyến mãi dự kiến áp dụng đến HH:mm | dd/MM"').not.toBeNull();
    const t = promo.time!;
    expect(t.h, `Giờ không hợp lệ: ${promo.timeRaw}`).toBeLessThan(24);
    expect(t.m, `Phút không hợp lệ: ${promo.timeRaw}`).toBeLessThan(60);
    // Ngày kết thúc không sớm hơn ngày hiện tại (định dạng không có năm: tháng nhỏ hơn tháng hiện tại hiểu là năm sau)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let end = new Date(now.getFullYear(), t.mo - 1, t.d, t.h, t.m);
    expect(end.getMonth(), `Ngày không hợp lệ: ${promo.timeRaw}`).toBe(t.mo - 1);
    // Chỉ coi là "năm sau" khi ngày đã qua hơn ~6 tháng (qua năm mới, ví dụ hôm nay 20/12 mà KM ghi 05/01).
    // Quy tắc cũ "tháng nhỏ hơn tháng hiện tại -> năm sau" làm khuyến mãi đã hết hạn từ tháng trước vẫn pass.
    if (end.getTime() < today.getTime() - 180 * 86_400_000) end = new Date(now.getFullYear() + 1, t.mo - 1, t.d, t.h, t.m);
    expect(end.getTime(), `Khuyến mãi đã hết hạn (${promo.timeRaw}) so với hôm nay`).toBeGreaterThanOrEqual(today.getTime());
    expect(promo.timeRaw!, 'Thời gian không có ký tự lạ').not.toMatch(/\uFFFD|undefined|NaN/i);
  });

  test('ProductDetail_Promotion_04 - Kiểm tra hiển thị chính sách giao hàng và lắp đặt', async ({ page }) => {
    await openSample(page);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText, 'Trang chi tiết phải có thông tin về chính sách giao hàng').toMatch(/Giao hàng|miễn phí giao|vận chuyển/i);
    expect(bodyText, 'Trang chi tiết phải có thông tin về lắp đặt').toMatch(/Lắp đặt|công lắp|hướng dẫn sử dụng|bảo hành tận nhà/i);
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflowX, 'Trang không được tràn ngang').toBeLessThanOrEqual(2);
  });
});

/* ------------------------------------------------------------------ */
/* 7. Cam kết của Điện Máy Xanh                                        */
/* ------------------------------------------------------------------ */
test.describe('Cam kết của Điện Máy Xanh', () => {
  test('ProductDetail_Commitment_01 - Kiểm tra khối [Điện Máy Xanh cam kết] hiển thị đúng', async ({ page }) => {
    await openSample(page);
    expect(await scrollToText(page, /Điện Máy Xanh cam kết/i), 'Phải có khối "Điện Máy Xanh cam kết"').toBeTruthy();
    const info = await page.evaluate(() => {
      const vis = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
      const re = /Điện Máy Xanh cam kết/i;
      const heading = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(vis)
        .find(e => norm(e.innerText || '').length <= 60 && re.test(norm(e.innerText || '')) && !Array.from(e.children).some(c => re.test(norm((c as HTMLElement).innerText || ''))));
      if (!heading) return null;
      let root: HTMLElement | null = null;
      for (let x: HTMLElement | null = heading.parentElement, i = 0; x && i < 6; x = x.parentElement, i++) {
        if ((x.innerText || '').split('\n').filter(s => s.trim().length >= 8).length >= 4) { root = x; break; }
      }
      if (!root) return null;
      const lines = (root.innerText || '').split('\n').map(norm).filter(l => l.length >= 8 && !re.test(l));
      const icons = Array.from(root.querySelectorAll<HTMLElement>('img, svg, i')).filter(vis).length;
      const overflow = Array.from(root.querySelectorAll<HTMLElement>('*')).some(e => e.children.length === 0 && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible');
      return { lines, icons, overflow, rootRight: root.getBoundingClientRect().right, vw: window.innerWidth };
    });
    expect(info, 'Không đọc được nội dung khối cam kết').not.toBeNull();
    expect(info!.lines.length, `Phải có ít nhất 3 cam kết, đọc được: ${info!.lines.join(' | ')}`).toBeGreaterThanOrEqual(3);
    expect(info!.icons, 'Mỗi cam kết có biểu tượng đi kèm').toBeGreaterThanOrEqual(3);
    expect(info!.lines.join(' '), 'Nội dung cam kết không có chữ lỗi').not.toMatch(BAD_TEXT);
    expect(info!.overflow, 'Nội dung không bị tràn/cắt chữ').toBeFalsy();
    expect(info!.rootRight, 'Khối cam kết không tràn ra ngoài màn hình').toBeLessThanOrEqual(info!.vw + 2);
  });
});

/* ------------------------------------------------------------------ */
/* 8. Thông số kỹ thuật và mô tả                                       */
/* ------------------------------------------------------------------ */
test.describe('Thông số kỹ thuật và mô tả', () => {
  test.beforeEach(async ({ page }) => { await openSample(page); });

  test('ProductDetail_Specs_01 - Kiểm tra bảng thông số kỹ thuật hiển thị đầy đủ các nhóm và giá trị', async ({ page }) => {
    const specs = await openSpecs(page);
    expect(specs.rows.length, 'Bảng thông số phải có nhiều dòng').toBeGreaterThanOrEqual(8);
    const groups = SPEC_GROUPS.filter(g => specs.text.includes(g));
    expect(groups.length, `Phải có các nhóm thông số (Tổng quan, Công nghệ hình ảnh, Công nghệ âm thanh...), thấy: ${groups.join(', ')}`).toBeGreaterThanOrEqual(4);
    for (const r of specs.rows) {
      expect(r.label, 'Dòng thông số phải có tên').not.toBe('');
      expect(r.value, `Thông số "${r.label}" phải có giá trị`).not.toBe('');
      expect(`${r.label} ${r.value}`, `Dòng "${r.label}" bị lỗi hiển thị`).not.toMatch(BAD_TEXT);
    }
    const val = (re: RegExp) => specs.rows.find(r => re.test(r.label))?.value;
    const size = val(/Kích cỡ màn hình/i);
    if (size) expect(size, 'Kích cỡ màn hình phải có đơn vị inch').toMatch(/\d+\s*inch/i);
    const hz = val(/Tần số quét/i);
    if (hz) expect(hz, 'Tần số quét phải có đơn vị Hz').toMatch(/\d+\s*Hz/i);
  });

  test('ProductDetail_Specs_02 - Kiểm tra phần "Thông tin sản phẩm" (bài viết mô tả)', async ({ page }) => {
    const top = await topOf(page, /^Thông tin sản phẩm$/i);
    expect(top, 'Phải có phần "Thông tin sản phẩm"').not.toBeNull();
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 80)), top!);
    const expandBtn = page.getByText(/Xem thêm bài viết|Xem thêm\s*$/i).first();
    if (await expandBtn.isVisible().catch(() => false)) {
      await expandBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
    }
    await scrollThrough(page, top!, 18);
    const a = await readArticle(page);
    expect(a.heads.length, `Phải có các mục mô tả (thiết kế, công nghệ hình ảnh, âm thanh, hệ điều hành, tiện ích). Thấy: ${a.heads.join(' | ')}`).toBeGreaterThanOrEqual(3);
    expect(a.imgs.length, 'Mỗi mục có ảnh minh họa').toBeGreaterThanOrEqual(2);
    for (const i of a.imgs) expect(i.complete && i.naturalWidth > 0, `Ảnh minh họa không tải được: ${i.src}`).toBeTruthy();
    expect(a.overflow, 'Bố cục chữ và ảnh không bị tràn').toBeFalsy();
  });

  test('ProductDetail_Specs_03 - Kiểm tra nút [Xem thêm bài viết] mở rộng nội dung bài viết mô tả sản phẩm', async ({ page }) => {
    await openSample(page);
    const top = await topOf(page, /^Thông tin sản phẩm$/i);
    expect(top, 'Phải có phần "Thông tin sản phẩm"').not.toBeNull();
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 80)), top!);
    await page.waitForTimeout(600);
    const expandBtn = page.locator('button, a, div[role="button"]')
      .filter({ hasText: /^\s*(Xem thêm|Đọc thêm|Xem thêm bài viết|Xem chi tiết bài viết)\s*$/i })
      .first();
    const isVisible = await expandBtn.isVisible().catch(() => false);
    if (isVisible) {
      const hBefore = await page.evaluate(() => {
        const h = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, div'))
          .find(e => /^Thông tin sản phẩm$/i.test((e.innerText || '').trim()));
        let p = h?.parentElement;
        while (p && p.clientHeight < 200 && p.parentElement) p = p.parentElement;
        return p ? p.clientHeight : 0;
      });
      await expandBtn.scrollIntoViewIfNeeded().catch(() => {});
      await expandBtn.click({ force: true });
      await page.waitForTimeout(800);
      const hAfter = await page.evaluate(() => {
        const h = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, div'))
          .find(e => /^Thông tin sản phẩm$/i.test((e.innerText || '').trim()));
        let p = h?.parentElement;
        while (p && p.clientHeight < 200 && p.parentElement) p = p.parentElement;
        return p ? p.clientHeight : 0;
      });
      if (hBefore > 0 && hAfter > 0) {
        expect(hAfter, 'Sau khi click Xem thêm, bài viết phải mở rộng chiều cao').toBeGreaterThanOrEqual(hBefore);
      }
    } else {
      const a = await readArticle(page);
      expect(a.heads.length, 'Bài viết mô tả hiển thị đầy đủ các phần').toBeGreaterThanOrEqual(2);
    }
  });
  test('ProductDetail_Specs_04 - Kiểm tra thông số kỹ thuật không mâu thuẫn với bài viết mô tả', async ({ page }) => {
    const specs = await openSpecs(page);
    const val = (re: RegExp) => specs.rows.find(r => re.test(r.label))?.value ?? '';
    const os = val(/Hệ điều hành/i), res = val(/Độ phân giải/i);
    expect(os, 'Bảng thông số phải có [Hệ điều hành]').not.toBe('');
    expect(res, 'Bảng thông số phải có [Độ phân giải]').not.toBe('');
    const top = await topOf(page, /^Thông tin sản phẩm$/i);
    expect(top, 'Phải có phần "Thông tin sản phẩm"').not.toBeNull();
    await scrollThrough(page, top!, 6);
    const a = await readArticle(page);
    expect(a.text.length, 'Phải đọc được nội dung bài mô tả').toBeGreaterThan(200);
    // Hệ điều hành: Google TV / Google Tivi được xem là cùng nghĩa
    const osRe = /google\s*(tv|tivi)/i.test(os) ? /google\s*(tv|tivi)/i
      : /tizen/i.test(os) ? /tizen/i : /web\s?os/i.test(os) ? /web\s?os/i : /android/i.test(os) ? /android/i
        : new RegExp(os.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    expect(a.text, `Bài mô tả phải nói đúng hệ điều hành "${os}"`).toMatch(osRe);
    // Độ phân giải
    const resRe = /8k/i.test(res) ? /8K/i : /4k/i.test(res) ? /4K|Ultra HD|UHD/i : /full\s?hd/i.test(res) ? /Full\s?HD|1080/i : new RegExp(res.split(/\s+/)[0], 'i');
    expect(a.text, `Bài mô tả phải nói đúng độ phân giải "${res}"`).toMatch(resRe);
    if (/4k/i.test(res)) expect(a.text, 'Bài mô tả không được mâu thuẫn (tivi 4K nhưng ghi độ phân giải HD)').not.toMatch(/độ phân giải\s*(HD|Full HD)\b(?!.*4K)/i);
  });
});
