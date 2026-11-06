import { test, expect, Page, Locator, Response } from '@playwright/test';

/**
 * ASM7 - Automation cho chức năng "Danh sách sản phẩm theo danh mục" (6.3.2)
 * Website thật: https://www.dienmayxanh.com/tivi   |   Công cụ: Playwright + TypeScript
 * 27 test case: ProductList_Access_01 ... ProductList_LoadMore_07
 *
 * Chạy kiểm thử:
 *   npx playwright test tests/23130328_PhanThaoTien_ASM7.spec.ts --headed --workers=1
 *
 * Biến môi trường tuỳ chọn:
 *   SLOWMO=300        làm chậm thao tác để quay video demo
 *   PW_CHANNEL=chrome dùng Google Chrome cài trên máy thay cho Chromium mặc định
 *   PW_VIDEO=on       bật quay video toàn bộ (mặc định chỉ giữ video khi fail: retain-on-failure)
 *   DMX_BASE_URL=...  đổi địa chỉ website (mặc định https://www.dienmayxanh.com)
 */

const BASE_URL = (process.env.DMX_BASE_URL ?? 'https://www.dienmayxanh.com').replace(/\/$/, '');
const CATEGORY_URL = `${BASE_URL}/tivi`;

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
/* Kiểu dữ liệu và hàm hỗ trợ                                          */
/* ------------------------------------------------------------------ */

interface Box { x: number; y: number; w: number; h: number }
type PartKind = 'name' | 'spec' | 'price' | 'oldPrice' | 'image' | 'label';
interface Card {
  path: string;
  name: string;
  spec: string | null;
  price: number | null;
  priceText: string | null;
  oldPrice: number | null;
  oldPriceText: string | null;
  oldPriceDistinct: boolean;
  oldPriceStruck: boolean;
  hasStrike: boolean;
  priceRaw: string[];           // Danh sách chuỗi giá bán hợp lệ trong thẻ (đã lọc bỏ quà tặng/trả góp)
  discount: number | null;
  sold: string | null;
  rating: string | null;
  infoPos: { kind: 'sold' | 'rating'; text: string; cx: number; cy: number }[];
  images: { complete: boolean; naturalWidth: number; w: number; h: number; src: string }[];
  labels: { text: string; cx: number; cy: number }[];
  parts: { kind: PartKind; box: Box }[];
  rect: Box;
  text: string;
}

/**
 * Lấy danh sách thẻ sản phẩm thực sự thuộc danh sách chính.
 * Đã sửa lỗi quét nhầm "Trả góp 0%", "Trả trước 0đ" thành giá bán.
 */
async function getCards(page: Page): Promise<Card[]> {
  return page.evaluate(() => {
    const PRICE_FULL = /^\s*\d{1,3}(?:\.\d{3})+\s*[₫đ]\s*$/;
    const PRICE_IN_TEXT = /\d{1,3}(?:\.\d{3})+\s*[₫đ]/;
    const LABEL_BEFORE = /(quà(?:\s*tặng)?|tặng|giảm(?:\s*thêm)?|trả\s*(?:góp|trước|chậm)|voucher|phiếu|thu\s*cũ)[\s:]*$/i;
    const NOTICE = /liên hệ|hết hàng|ngừng kinh doanh|sắp ra mắt|tạm hết/i;
    const toNum = (s: string) => Number(s.replace(/[^\d]/g, ''));
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const norm = (a: HTMLAnchorElement) => new URL(a.href, location.href).pathname.replace(/\/+$/, '');
    const isProd = (a: HTMLAnchorElement) => /^\/tivi\/[^/?#]+$/.test(norm(a));
    const sx = window.scrollX, sy = window.scrollY;
    const box = (e: Element) => { const b = e.getBoundingClientRect(); return { x: b.x + sx, y: b.y + sy, w: b.width, h: b.height }; };
    const isStrikeEl = (e: Element) =>
      ['DEL', 'S', 'STRIKE'].includes(e.tagName) || (getComputedStyle(e).textDecorationLine || '').includes('line-through');

    // 1. Tìm thẻ sản phẩm duy nhất
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(a => isProd(a) && visible(a));
    const pathMap = new Map<Element, Set<string>>();
    for (const a of anchors) {
      const path = norm(a);
      for (let e: Element | null = a; e; e = e.parentElement) {
        let set = pathMap.get(e);
        if (!set) { set = new Set<string>(); pathMap.set(e, set); }
        set.add(path);
      }
    }
    const pathsIn = (el: Element) => pathMap.get(el) ?? new Set<string>();
    const found = new Map<HTMLElement, string>();
    for (const a of anchors) {
      let el: HTMLElement = a;
      while (el.parentElement && el.parentElement !== document.body && el.parentElement !== document.documentElement) {
        if (pathsIn(el.parentElement).size !== 1) break;
        el = el.parentElement;
      }
      if (!found.has(el)) found.set(el, norm(a));
    }
    const allFound = Array.from(found.entries());
    const outer = allFound.filter(([el, p]) => !allFound.some(([o, q]) => o !== el && p === q && o.contains(el)));

    // 2. Phân tích nội dung từng thẻ
    const roots = outer.filter(([el]) => visible(el)).map(([el, path]) => {
      const txt = el.innerText || '';
      const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
      const lineThrough = (e: Element) => {
        let x: Element | null = e;
        while (x && x !== el.parentElement) {
          if (isStrikeEl(x)) return true;
          x = x.parentElement;
        }
        return false;
      };

      // Đọc các node giá và phân loại chuẩn
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n.nodeValue || '').trim()) nodes.push(n as Text);
      type Tok = { el: HTMLElement; text: string; value: number; struck: boolean };
      const toks: Tok[] = [];
      const priceRaw: string[] = [];

      nodes.forEach((t, i) => {
        const parent = t.parentElement;
        if (!parent || !visible(parent)) return;
        const s = (t.nodeValue || '').replace(/\s+/g, ' ').trim();

        // Kiểm tra ngữ cảnh trước và sau node
        const prev = (nodes[i - 1]?.nodeValue || '').replace(/\s+/g, ' ').trim();
        const next = (nodes[i + 1]?.nodeValue || '').replace(/\s+/g, ' ').trim();
        const isAncillary = LABEL_BEFORE.test(prev) || /^\/\s*(tháng|th\b)/i.test(next) || /trả\s*(góp|trước)/i.test(s);

        const m = s.match(/^(\d{1,3}(?:\.\d{3})+)\s*([₫đ])?$/);
        if (m) {
          let text = s;
          if (!m[2]) {
            if (/^[₫đ]/.test(next)) text = `${m[1]}${next[0]}`;
          }
          if (!isAncillary) {
            priceRaw.push(text);
            toks.push({ el: parent, text, value: toNum(text), struck: lineThrough(parent) });
          }
        }
      });

      if (toks.length === 0) {
        for (const l of lines) {
          if (PRICE_FULL.test(l)) {
            toks.push({ el, text: l, value: toNum(l), struck: false });
            priceRaw.push(l);
          }
        }
      }

      let oldTok: Tok | null = toks.filter(t => t.struck).sort((a, b) => b.value - a.value)[0] || null;
      let curToks = toks.filter(t => !t.struck);
      let distinct = !!oldTok;
      if (!oldTok && curToks.length >= 2 && new Set(curToks.map(t => t.value)).size >= 2) {
        const iMax = curToks.map(t => t.value).indexOf(Math.max(...curToks.map(t => t.value)));
        oldTok = curToks[iMax];
        curToks = curToks.filter((_, i) => i !== iMax);
        const a = getComputedStyle(oldTok.el), b = getComputedStyle(curToks[0].el);
        distinct = a.fontSize !== b.fontSize || a.color !== b.color || a.fontWeight !== b.fontWeight;
      }
      const cur = curToks[0] || null;

      const dm = txt.match(/(?:^|\s)[-−–]\s?(\d{1,3})\s?%/);
      const headEl = Array.from(el.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5')).find(visible) || null;
      const isLabelLine = (s: string) => /^(quà|trả\s*(chậm|góp)|giảm|[-−–]\s?\d|đã bán|so sánh|\d+([.,]\d)?$)/i.test(s) || PRICE_IN_TEXT.test(s);
      const name =
        (headEl?.textContent || '').replace(/\s+/g, ' ').trim() ||
        (el.querySelector('a[title]')?.getAttribute('title') || '').trim() ||
        lines.find(l => /(tivi|\btv\b)/i.test(l) && !isLabelLine(l)) ||
        (el.querySelector('img[alt]')?.getAttribute('alt') || '').trim() ||
        lines.find(l => !isLabelLine(l) && l.length >= 5) || '';

      const spec =
        lines.find(l => l !== name && l.length < 60 && !PRICE_IN_TEXT.test(l) &&
          (/\d{2,3}\s*(inch|")/i.test(l) || /\b(4K|8K|Full HD|HD|UHD|QLED|OLED|Mini LED)\b/i.test(l))) || null;

      const all = Array.from(el.querySelectorAll<HTMLElement>('*')).filter(visible);
      const elByText = (t: string | null) =>
        t ? all.find(e => (e.textContent || '').trim() === t && !Array.from(e.children).some(c => (c.textContent || '').trim() === t)) || null : null;
      const nameEl = headEl || elByText(name);
      const specEl = elByText(spec);
      const hasStrike = all.some(e => isStrikeEl(e) && PRICE_IN_TEXT.test((e.textContent || '').trim()));

      const soldM = txt.match(/Đã bán\s*[\d.,]+\s*[kKmM]?/i);
      const looksLikeRating = (e: Element) => {
        let x: Element | null = e;
        for (let i = 0; i < 3 && x && x !== el; i++, x = x.parentElement) {
          if (/star|rating|rate|vote|danh-?gia/i.test(x.getAttribute('class') || '')) return true;
          if (x !== e && x.querySelector('svg, img[src*="star" i], [class*="star" i]')) return true;
        }
        return false;
      };
      const ratingEl = all.find(e => e.children.length === 0 && /^[0-5](?:[.,]\d)?$/.test((e.textContent || '').trim()) && looksLikeRating(e));
      const soldEl = all.find(e => /Đã bán/i.test(e.textContent || '') && (e.textContent || '').length <= 30 &&
        !Array.from(e.children).some(c => /Đã bán/i.test(c.textContent || ''))) || null;
      const infoPos: Card['infoPos'] = [];
      for (const [kind, e] of [['sold', soldEl], ['rating', ratingEl || null]] as const) {
        if (!e) continue;
        const b = box(e);
        infoPos.push({ kind, text: (e.textContent || '').trim(), cx: b.x + b.w / 2, cy: b.y + b.h / 2 });
      }

      const labelRe = /^([-−–]\s?\d{1,3}\s?%|quà.*|trả\s*(chậm|góp).*|giảm.*|mới|hot|độc quyền)$/i;
      const labelEls = all.filter(e => (e.textContent || '').trim().length <= 40 && labelRe.test((e.textContent || '').trim()) &&
        !Array.from(e.children).some(c => labelRe.test((c.textContent || '').trim())));
      const labels = labelEls.map(e => { const b = box(e); return { text: (e.textContent || '').trim(), cx: b.x + b.w / 2, cy: b.y + b.h / 2 }; });

      const parts: Card['parts'] = [];
      const addPart = (kind: PartKind, e: Element | null) => {
        if (!e) return;
        if (parts.some(p => { const o = (p as any).el as Element; return o === e || o.contains(e) || e.contains(o); })) return;
        const part: any = { kind, box: box(e) }; part.el = e; parts.push(part);
      };
      const bigImg = Array.from(el.querySelectorAll('img')).filter(visible)
        .sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0] || null;
      addPart('image', bigImg);
      addPart('name', nameEl); addPart('spec', specEl); addPart('price', cur?.el || null); addPart('oldPrice', oldTok?.el || null);
      labelEls.forEach(e => addPart('label', e));
      parts.forEach(p => delete (p as any).el);

      const card = {
        path, name, spec,
        price: cur ? cur.value : null,
        priceText: cur ? cur.text : null,
        oldPrice: oldTok ? oldTok.value : null,
        oldPriceText: oldTok ? oldTok.text : null,
        oldPriceDistinct: distinct,
        oldPriceStruck: !!(oldTok && oldTok.struck),
        hasStrike,
        priceRaw,
        discount: dm ? Number(dm[1]) : null,
        sold: soldM ? soldM[0].trim() : null,
        rating: ratingEl ? (ratingEl.textContent || '').trim() : null,
        infoPos,
        images: Array.from(el.querySelectorAll('img')).filter(visible).map(i => ({
          complete: (i as HTMLImageElement).complete, naturalWidth: (i as HTMLImageElement).naturalWidth,
          w: i.getBoundingClientRect().width, h: i.getBoundingClientRect().height,
          src: (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src || '',
        })),
        labels, parts, rect: box(el), text: txt,
      };
      const sig = el.tagName + '.' + Array.from(el.classList)
        .filter(c => !/^(active|hover|focus|selected|lazy\w*|loaded|loading|visible|show|hide|hidden|first|last|even|odd|swiper-slide-\S+)$/i.test(c))
        .sort().join('.');
      const hasContent = toks.length > 0 || NOTICE.test(txt);
      return { card, sig, hasContent, parent: el.parentElement, inView: card.rect.x >= -2 && card.rect.x + card.rect.w <= window.innerWidth + sx + 2 };
    });

    const good = roots.filter(r => r.hasContent && r.inView);
    const bySig = new Map<string, typeof good>();
    for (const r of good) bySig.set(r.sig, [...(bySig.get(r.sig) || []), r]);
    const main = Array.from(bySig.values()).sort((a, b) => b.length - a.length)[0] || [];
    let keep = good;
    if (main.length >= 3) {
      const parents = new Set(main.map(r => r.parent));
      keep = good.filter(r => parents.has(r.parent));
    }
    return keep.map(r => r.card);
  }) as Promise<Card[]>;
}

const paths = (cards: Card[]) => cards.map(c => c.path);
const dups = (list: string[]) => list.filter((p, i) => list.indexOf(p) !== i);

async function expectNoDuplicateCards(page: Page, label: string): Promise<Card[]> {
  let cards: Card[] = [];
  let repeated: string[] = [];
  try {
    await expect.poll(async () => {
      cards = await getCards(page);
      repeated = Array.from(new Set(dups(paths(cards))));
      return repeated.length;
    }, { timeout: 6_000, intervals: [1_000] }).toBe(0);
  } catch {
    const shown = repeated.slice(0, 5);
    throw new Error(`${label}: có ${repeated.length} sản phẩm lặp lại. Các sản phẩm đầu: ${shown.join(', ')}`);
  }
  return cards;
}

async function waitForCards(page: Page, min = 1) {
  await expect
    .poll(async () => (await getCards(page)).length, { message: 'Không thấy thẻ sản phẩm nào trên trang danh mục', timeout: 30_000, intervals: [500, 1000] })
    .toBeGreaterThanOrEqual(min);
}

async function dismissPopups(page: Page): Promise<string[]> {
  const closed: string[] = [];
  for (let i = 0; i < 2; i++) {
    const dialog = page.locator('[role="dialog"]:visible, [class*="modal" i]:visible, [class*="popup" i]:visible').first();
    if (!(await dialog.count())) break;
    closed.push(((await dialog.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 200));
    const close = dialog.locator('button:has-text("Đóng"), button:has-text("Bỏ qua"), button:has-text("Để sau"), [aria-label*="đóng" i], [aria-label*="close" i]').first();
    if (await close.count()) await close.click({ timeout: 2000 }).catch(() => {});
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  return closed;
}

async function openCategory(page: Page, url: string = CATEGORY_URL): Promise<{ res: Response; closedDialogs: string[] }> {
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
  expect(res!.status(), `Trang danh mục trả về HTTP ${res!.status()}`).toBeLessThan(400);
  const closedDialogs = await dismissPopups(page);
  await waitForCards(page);
  return { res: res!, closedDialogs };
}

/** Lấy thông tin tổng số sản phẩm từ phần hiển thị của danh mục */
async function getTotalInfo(page: Page): Promise<{ value: number; label: string } | null> {
  return page.evaluate(() => {
    const selectors = ['[class*="total"]', '[class*="count"]', '.sort-total', 'h1', '.title-total'];
    for (const sel of selectors) {
      for (const el of Array.from(document.querySelectorAll(sel))) {
        const text = (el as HTMLElement).innerText || '';
        const m = text.match(/(\d[\d.]*)\s*(Tivi|tivi|sản phẩm)/);
        if (m) return { value: Number(m[1].replace(/\./g, '')), label: m[2] };
      }
    }
    for (const l of document.body.innerText.split('\n').map(s => s.trim())) {
      const m = l.match(/^(\d[\d.]*)\s+(Tivi|tivi|sản phẩm)$/);
      if (m) return { value: Number(m[1].replace(/\./g, '')), label: m[2] };
    }
    return null;
  });
}
const getTotal = async (page: Page): Promise<number | null> => (await getTotalInfo(page))?.value ?? null;

/** Kiểm tra xem có đủ điều kiện để thực hiện tải thêm không */
async function canLoadMore(page: Page): Promise<boolean> {
  const loaded = (await getCards(page)).length;
  const total = await getTotal(page);
  if (total !== null && total <= loaded) return false;
  const btn = await findLoadMore(page);
  return !!btn && (await btn.isVisible().catch(() => false));
}

async function findLoadMore(page: Page, cards?: Card[]) {
  const listBottom = cards && cards.length
    ? Math.max(...cards.map(c => c.rect.y + c.rect.h))
    : await page.evaluate(() => {
        let b = 0;
        for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
          const p = new URL(a.href, location.href).pathname.replace(/\/+$/, '');
          if (!/^\/tivi\/[^/?#]+$/.test(p)) continue;
          const r = a.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) b = Math.max(b, r.bottom + window.scrollY);
        }
        return b;
      });
  const ok = await page.evaluate((bottom: number) => {
    document.querySelectorAll('[data-pw-loadmore]').forEach(e => e.removeAttribute('data-pw-loadmore'));
    const STRICT = /^\s*Xem thêm\s+[\d.,]+\s+(Tivi|sản phẩm)\s*$/i;
    const LOOSE = /^\s*Xem thêm\s*$/i;
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    let firstTop = Infinity;
    for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const p = new URL(a.href, location.href).pathname.replace(/\/+$/, '');
      if (!/^\/tivi\/[^/?#]+$/.test(p) || !visible(a)) continue;
      firstTop = Math.min(firstTop, a.getBoundingClientRect().top + window.scrollY);
    }
    const hits = (re: RegExp) =>
      Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span, p, li'))
        .filter(e => re.test((e.innerText || '').trim()) && visible(e) && !e.closest('header, nav, footer'))
        .map(e => (e.closest('button, a, [role="button"]') as HTMLElement | null) || e)
        .filter((e, i, arr) => arr.indexOf(e) === i)
        .map(e => ({ e, top: e.getBoundingClientRect().top + window.scrollY }))
        .filter(x => x.top > firstTop)
        .sort((a, b) => a.top - b.top);
    const strict = hits(STRICT);
    let target: HTMLElement | null = strict.find(x => x.top >= bottom - 80)?.e || strict[0]?.e || null;
    if (!target) target = hits(LOOSE).find(x => x.top >= bottom - 80 && x.top - bottom <= 500)?.e || null;
    if (!target) return false;
    target.setAttribute('data-pw-loadmore', '1');
    return true;
  }, listBottom);
  return ok ? page.locator('[data-pw-loadmore="1"]').first() : null;
}

async function countProductPaths(page: Page): Promise<number> {
  return page.evaluate(() => {
    const set = new Set<string>();
    for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const p = new URL(a.href, location.href).pathname.replace(/\/+$/, '');
      if (!/^\/tivi\/[^/?#]+$/.test(p)) continue;
      if (a.closest('header, nav, footer, aside, [class*="swiper" i], [class*="slider" i], [class*="carousel" i], [class*="owl-" i]')) continue;
      const r = a.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) set.add(p);
    }
    return set.size;
  });
}

async function waitForGrowth(page: Page, fromPaths: number, fromCards: number, timeout = 12_000, checkCards = true): Promise<boolean> {
  const start = Date.now();
  let step = 0;
  while (Date.now() - start < timeout) {
    if ((await countProductPaths(page)) > fromPaths) {
      let last = -1, stable = 0;
      while (stable < 2 && Date.now() - start < timeout + 6000) {
        const n = await countProductPaths(page);
        stable = n === last ? stable + 1 : 0;
        last = n;
        await page.waitForTimeout(400);
      }
      for (let i = 0; checkCards && i < 12 && (await getCards(page)).length <= fromCards; i++) {
        await page.mouse.wheel(0, 600).catch(() => {});
        await page.waitForTimeout(500);
      }
      return true;
    }
    if (++step % 4 === 0) await page.mouse.wheel(0, 500).catch(() => {});
    await page.waitForTimeout(500);
  }
  return false;
}

type LoadVia = 'button' | 'scroll' | 'none';
async function loadMoreOnce(page: Page): Promise<{ before: Card[]; after: Card[]; via: LoadVia }> {
  const before = await getCards(page);
  const beforePaths = await countProductPaths(page);
  const btn = await findLoadMore(page, before);
  let via: LoadVia = 'scroll';
  if (btn && (await btn.isVisible().catch(() => false))) {
    via = 'button';
    await btn.scrollIntoViewIfNeeded();
    await btn.click({ timeout: 10_000 });
    let grew = await waitForGrowth(page, beforePaths, before.length, 10_000);
    if (!grew) {
      await btn.click({ force: true, timeout: 5_000 }).catch(() => {});
      grew = await waitForGrowth(page, beforePaths, before.length, 8_000);
      if (!grew) {
        await btn.evaluate(e => (e as HTMLElement).click()).catch(() => {});
        await waitForGrowth(page, beforePaths, before.length, 8_000);
      }
    }
  } else {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await waitForGrowth(page, beforePaths, before.length, 12_000);
  }
  const after = await getCards(page);
  if (via === 'scroll' && after.length <= before.length) via = 'none';
  return { before, after, via };
}

async function clickLoadMore(page: Page, btn: Locator, fromPaths: number): Promise<number> {
  await btn.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => {});
  await btn.click({ timeout: 10_000 });
  let grew = await waitForGrowth(page, fromPaths, 0, 10_000, false);
  if (!grew) {
    await btn.click({ force: true, timeout: 5_000 }).catch(() => {});
    grew = await waitForGrowth(page, fromPaths, 0, 8_000, false);
    if (!grew) {
      await btn.evaluate(e => (e as HTMLElement).click(), undefined, { timeout: 3_000 }).catch(() => {});
      await waitForGrowth(page, fromPaths, 0, 8_000, false);
    }
  }
  return countProductPaths(page);
}

async function collectCards(page: Page, pred: (c: Card) => boolean, maxLoads = 4): Promise<Card[]> {
  let cards = await getCards(page);
  for (let i = 0; i < maxLoads && !cards.some(pred); i++) {
    const r = await loadMoreOnce(page);
    if (r.after.length <= r.before.length) break;
    cards = r.after;
  }
  return cards;
}

async function scrollToCard(page: Page, path: string) {
  await page.evaluate((p: string) => {
    const a = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .find(x => new URL(x.href, location.href).pathname.replace(/\/+$/, '') === p);
    a?.scrollIntoView({ block: 'center' });
  }, path);
}

async function expectNoErrorPage(page: Page) {
  await expect(page.locator('body')).not.toContainText(/Internal Server Error|Application error|Something went wrong|Đã có lỗi xảy ra/i);
}

const overlap = (a: Box, b: Box) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2;

// Định dạng tiền tệ chuẩn: số chia hàng nghìn bằng dấu chấm, kết thúc bằng đ hoặc ₫
const PRICE_FORMAT = /^\d{1,3}(?:\.\d{3})+\s?[₫đ]$/;

function expectInsideOwnCard(cards: Card[], c: Card, what: string, p: { cx: number; cy: number }) {
  const inOwn = p.cx >= c.rect.x - 8 && p.cx <= c.rect.x + c.rect.w + 8 && p.cy >= c.rect.y - 8 && p.cy <= c.rect.y + c.rect.h + 8;
  expect(inOwn, `${what} của ${c.path} nằm ngoài thẻ của nó`).toBeTruthy();
  for (const o of cards) {
    if (o.path === c.path) continue;
    const inOther = p.cx > o.rect.x + 8 && p.cx < o.rect.x + o.rect.w - 8 && p.cy > o.rect.y + 8 && p.cy < o.rect.y + o.rect.h - 8;
    expect(inOther, `${what} của ${c.path} bị gán nhầm vào thẻ ${o.path}`).toBeFalsy();
  }
}

/* ------------------------------------------------------------------ */
/* 1. Truy cập trang danh sách Tivi                                    */
/* ------------------------------------------------------------------ */
test.describe('Truy cập trang danh sách Tivi', () => {
  test('ProductList_Access_01 - Kiểm tra truy cập trực tiếp trang danh mục Tivi', async ({ page }) => {
    const { closedDialogs } = await openCategory(page);
    expect(new URL(page.url()).pathname.replace(/\/+$/, ''), 'URL phải thuộc đường dẫn /tivi').toBe('/tivi');
    await expect(page).toHaveTitle(/tivi/i);
    await expectNoErrorPage(page);
    expect(page.url(), 'Không bị chuyển sang trang đăng nhập').not.toMatch(/dang-?nhap|login|signin/i);
    await expect(page.locator('input[type="password"]:visible'), 'Không có form đăng nhập chặn nội dung').toHaveCount(0);
    expect(closedDialogs.filter(t => /đăng nhập|login/i.test(t)), 'Có popup yêu cầu đăng nhập khi mở trang danh mục').toEqual([]);
  });

  test('ProductList_Access_02 - Kiểm tra URL có dấu "/" cuối hoặc tham số theo dõi vẫn mở đúng danh mục', async ({ page }) => {
    for (const url of [`${CATEGORY_URL}/`, `${CATEGORY_URL}?utm_source=asm7&utm_medium=test`]) {
      await openCategory(page, url);
      expect(new URL(page.url()).pathname.replace(/\/+$/, ''), `${url} phải mở đúng danh mục /tivi`).toBe('/tivi');
      expect((await getCards(page)).length, `${url} không có thẻ sản phẩm`).toBeGreaterThan(0);
      await expectNoErrorPage(page);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 2. Hiển thị danh sách và thẻ sản phẩm                              */
/* ------------------------------------------------------------------ */
test.describe('Hiển thị danh sách và thẻ sản phẩm', () => {
  test.beforeEach(async ({ page }) => { await openCategory(page); });

  test('ProductList_Display_01 - Kiểm tra hiển thị đúng tên danh mục', async ({ page }) => {
    const firstCardTop = (await getCards(page))[0].rect.y;
    const heads = await page.evaluate((cardTop: number) => {
      const list = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel))
        .filter(h => h.getBoundingClientRect().width > 0 && getComputedStyle(h).visibility !== 'hidden')
        .map(h => ({ text: (h.textContent || '').replace(/\s+/g, ' ').trim(), y: h.getBoundingClientRect().top + window.scrollY }))
        .filter(h => h.y < cardTop);
      return { h1: list('h1'), h2: list('h2') };
    }, firstCardTop);

    const titles = heads.h1.length ? heads.h1 : heads.h2;
    expect(titles.some(h => /ti\s?vi|\btv\b/i.test(h.text)), `Không có tiêu đề chính chứa "Tivi" phía trên danh sách.`).toBeTruthy();
    for (const h of titles) {
      expect(h.text, 'Tiêu đề chính không được thuộc danh mục khác').not.toMatch(/tủ lạnh|máy lạnh|điều hòa|máy giặt|điện thoại|laptop|quạt|nồi/i);
    }
  });

  test('ProductList_Display_02 - Kiểm tra hiển thị breadcrumb của danh mục', async ({ page }) => {
    const firstCardTop = (await getCards(page))[0].rect.y;
    const bc = await page.evaluate((cardTop: number) => {
      const re = /^(trang chủ|điện máy xanh|home)[\s>›»/|·\-–—]*ti\s?vi$/i;
      const vis = (e: Element) => {
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const top = (e: Element) => e.getBoundingClientRect().top + window.scrollY;
      const txt = (e: Element) => ((e as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim();
      const homeLinkOf = (e: Element) => {
        const a = Array.from(e.querySelectorAll<HTMLAnchorElement>('a')).find(x => /trang chủ|điện máy xanh|home/i.test(x.textContent || ''));
        return a ? new URL(a.href, location.href).pathname : null;
      };
      const all = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(e => vis(e) && top(e) < cardTop);
      let el = all.find(e => /breadcrumb|crumb/i.test((e.getAttribute('class') || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('itemtype') || ''))
        && /ti\s?vi/i.test(txt(e)) && txt(e).toLowerCase() !== 'tivi' && txt(e).length < 100);
      if (!el) el = all.find(e => txt(e).length < 80 && re.test(txt(e)) && e.getBoundingClientRect().height < 90);
      if (!el) el = all.find(e => e.getBoundingClientRect().height < 90 && txt(e).length < 80 && /ti\s?vi/i.test(txt(e)) && txt(e).toLowerCase() !== 'tivi' && homeLinkOf(e) !== null);
      if (el) return { found: true as const, text: txt(el), homeLink: homeLinkOf(el) };
      return { found: false as const, seen: [] };
    }, firstCardTop);

    expect(bc.found, 'Không thấy breadcrumb (dạng "Trang chủ > Tivi") phía trên danh sách.').toBeTruthy();
    if (!bc.found) return;
    expect(bc.text, 'Mục hiện tại (Tivi) phải nằm cuối breadcrumb').toMatch(/ti\s?vi\s*$/i);
    if (bc.homeLink !== null) expect(bc.homeLink, 'Liên kết "Trang chủ" trong breadcrumb phải trỏ về "/"').toBe('/');
  });

  test('ProductList_Display_03 - Kiểm tra hiển thị khu vực danh sách sản phẩm', async ({ page }) => {
    const cards = await getCards(page);
    expect(cards.length, 'Khu vực danh sách phải có ít nhất một thẻ sản phẩm').toBeGreaterThan(0);
    const first = cards[0];
    expect(first.rect.w, 'Thẻ đầu tiên phải có chiều rộng hiển thị').toBeGreaterThan(0);
    expect(first.rect.h, 'Thẻ đầu tiên phải có chiều cao hiển thị').toBeGreaterThan(0);
    await scrollToCard(page, first.path);
    const link = page.locator(`a[href*="${first.path}"]:visible`).first();
    await expect(link, 'Liên kết sản phẩm của thẻ đầu tiên phải hiển thị').toBeVisible();
  });

  test('ProductList_Display_04 - Kiểm tra mỗi thẻ sản phẩm có tên', async ({ page }) => {
    for (const c of (await getCards(page)).slice(0, 5)) {
      expect(c.name.length, `Thẻ ${c.path} không có tên`).toBeGreaterThanOrEqual(5);
      expect(c.name, `Tên thẻ ${c.path} bị lỗi hiển thị`).not.toMatch(/undefined|null|NaN/i);
      const compact = c.name.toLowerCase().replace(/[\s-]/g, '');
      const models = c.path.split('/').pop()!.split('-').filter(t => /\d/.test(t) && /[a-z]/.test(t) && t.length >= 4);
      if (models.length) expect(models.some(m => compact.includes(m)), `Tên "${c.name}" không khớp mã model của ${c.path}`).toBeTruthy();
    }
  });

  test('ProductList_Display_05 - Kiểm tra ảnh sản phẩm tải thành công', async ({ page }) => {
    for (const c of (await getCards(page)).slice(0, 5)) {
      await scrollToCard(page, c.path);
      await expect.poll(async () => {
        const cur = (await getCards(page)).find(x => x.path === c.path);
        const img = cur?.images.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0];
        return !!img && img.complete && img.naturalWidth >= 50 &&
          !/^data:/i.test(img.src) && !/placeholder|blank|loading|lazy|no-?image/i.test(img.src) &&
          img.w >= 40 && img.h >= 40;
      }, { message: `Ảnh của ${c.path} không tải được`, timeout: 15_000 }).toBeTruthy();
    }
  });

  test('ProductList_Display_06 - Kiểm tra hiển thị giá bán hiện tại', async ({ page }) => {
    for (const c of (await getCards(page)).slice(0, 5)) {
      const hasNotice = /liên hệ|hết hàng|ngừng kinh doanh|sắp ra mắt/i.test(c.text);
      expect(c.price !== null || hasNotice, `Thẻ ${c.path} không có giá bán hay thông báo giá`).toBeTruthy();
      if (c.price !== null) {
        expect(Number.isFinite(c.price) && c.price > 0, `Giá của ${c.path} không hợp lệ: ${c.priceText}`).toBeTruthy();
      }
      expect(c.text, `Thẻ ${c.path} có chữ lỗi hiển thị (undefined/NaN)`).not.toMatch(/\bundefined\b|\bNaN\b/);
    }
  });

  test('ProductList_Display_07 - Kiểm tra định dạng giá bán theo tiền Việt Nam', async ({ page }) => {
    const cards = await getCards(page);
    expect(cards.length).toBeGreaterThan(0);
    const symbols = new Set<string>();

    for (const c of cards) {
      // Đã loại trừ "Trả trước 0đ" hay "Trả góp 0%", chỉ kiểm tra các giá bán thực tế
      for (const t of c.priceRaw) {
        expect(t, `Giá "${t}" của ${c.path} sai định dạng tiền Việt Nam`).toMatch(PRICE_FORMAT);
      }
      if (c.priceText) symbols.add(c.priceText.slice(-1));
    }
    expect(symbols.size, `Ký hiệu tiền không nhất quán giữa các thẻ: ${Array.from(symbols).join(', ')}`).toBeLessThanOrEqual(1);
  });

  test('ProductList_Display_08 - Kiểm tra hiển thị giá gốc khi sản phẩm có khuyến mãi', async ({ page }) => {
    const cards = (await collectCards(page, c => c.oldPrice !== null)).filter(c => c.oldPrice !== null);
    test.skip(cards.length === 0, 'Dữ liệu hiện tại không có sản phẩm nào hiển thị giá gốc (không đủ dữ liệu)');
    for (const c of cards.slice(0, 5)) {
      expect(c.price, `Thẻ ${c.path} có giá gốc nhưng thiếu giá bán`).not.toBeNull();
      expect(c.oldPriceDistinct, `Giá gốc của ${c.path} không được phân biệt với giá bán`).toBeTruthy();
      if (c.oldPriceStruck) {
        expect(c.oldPrice!, `Giá gốc phải lớn hơn giá bán (${c.path})`).toBeGreaterThan(c.price!);
      } else {
        expect(c.discount, `${c.path} không có nhãn giảm giá`).not.toBeNull();
      }
    }
  });

  test('ProductList_Display_09 - Kiểm tra nhãn phần trăm giảm giá phù hợp với hai mức giá', async ({ page }) => {
    const cards = (await collectCards(page, c => !!c.oldPrice && !!c.price && c.discount !== null))
      .filter(c => !!c.oldPrice && !!c.price && c.discount !== null);
    test.skip(cards.length === 0, 'Không có sản phẩm nào có đủ giá gốc, giá bán và nhãn giảm giá');
    for (const c of cards) {
      const pct = ((c.oldPrice! - c.price!) / c.oldPrice!) * 100;
      expect(c.discount!, `Nhãn giảm giá của ${c.path} không hợp lệ`).toBeGreaterThan(0);
      expect(c.discount!).toBeLessThan(100);
      expect([Math.floor(pct), Math.round(pct)],
        `${c.path}: nhãn -${c.discount}% không khớp tính toán (${pct.toFixed(2)}%)`).toContain(c.discount!);
    }
  });

  test('ProductList_Display_10 - Kiểm tra không hiển thị nhãn giảm giá sai khi không có khuyến mãi', async ({ page }) => {
    const cards = (await collectCards(page, c => c.price !== null && c.oldPrice === null, 5))
      .filter(c => c.price !== null && c.oldPrice === null);
    test.skip(cards.length === 0, 'Dữ liệu hiện tại không có sản phẩm nào chỉ có giá bán (không đủ dữ liệu)');
    for (const c of cards.slice(0, 5)) {
      expect(c.discount, `${c.path} không có giá gốc nhưng vẫn hiển thị nhãn -${c.discount}%`).toBeNull();
      expect(c.hasStrike, `${c.path} không có giá gốc nhưng vẫn có chữ giá bị gạch ngang`).toBeFalsy();
    }
  });

  test('ProductList_Display_11 - Kiểm tra thông tin tóm tắt của sản phẩm gắn đúng thẻ', async ({ page }) => {
    const first = (await getCards(page)).slice(0, 5);
    const withSpec = first.filter(c => c.spec);
    test.skip(withSpec.length === 0, 'Không có thẻ nào trong 5 thẻ đầu có thông tin tóm tắt');
    for (const c of withSpec) {
      const specBox = c.parts.find(p => p.kind === 'spec')?.box;
      if (specBox) {
        expect(specBox.y >= c.rect.y - 3 && specBox.y + specBox.h <= c.rect.y + c.rect.h + 3 &&
          specBox.x >= c.rect.x - 3 && specBox.x + specBox.w <= c.rect.x + c.rect.w + 3, `Thông tin tóm tắt nằm ngoài thẻ ${c.path}`).toBeTruthy();
      }
      const size = c.spec!.match(/(\d{2,3})\s*(?:inch|")/i);
      if (size) {
        expect((c.name + ' ' + c.path).includes(size[1]), `Thẻ ${c.path}: tóm tắt "${c.spec}" lệch với tên "${c.name}"`).toBeTruthy();
      }
    }
  });

  test('ProductList_Display_12 - Kiểm tra thông tin khuyến mãi/nhãn nổi bật gắn đúng sản phẩm', async ({ page }) => {
    const cards = (await getCards(page)).slice(0, 20);
    const labelled = cards.filter(c => c.labels.length > 0);
    test.skip(labelled.length === 0, 'Không có thẻ nào có nhãn khuyến mãi/nhãn nổi bật');
    for (const c of labelled) {
      for (const l of c.labels) expectInsideOwnCard(cards, c, `Nhãn "${l.text}"`, l);
    }
  });

  test('ProductList_Display_13 - Kiểm tra thông tin đánh giá hoặc đã bán hiển thị hợp lệ nếu có', async ({ page }) => {
    const cards = (await getCards(page)).slice(0, 20);
    const withInfo = cards.filter(c => c.sold || c.rating);
    test.skip(withInfo.length === 0, 'Website không cung cấp thông tin đánh giá/đã bán trên các thẻ hiện tại');
    for (const c of withInfo) {
      if (c.sold) expect(c.sold, `Số đã bán của ${c.path} sai định dạng`).toMatch(/^Đã bán\s+\d[\d.,]*\s?[kKmM]?$/i);
      if (c.rating) {
        const r = Number(c.rating.replace(',', '.'));
        expect(r >= 0 && r <= 5, `Điểm đánh giá của ${c.path} ngoài khoảng 0-5`).toBeTruthy();
      }
      for (const p of c.infoPos) expectInsideOwnCard(cards, c, `${p.kind === 'sold' ? 'Số đã bán' : 'Điểm đánh giá'} "${p.text}"`, p);
    }
  });

  test('ProductList_Display_14 - Kiểm tra bố cục thẻ sản phẩm không chồng lấn', async ({ page }) => {
    const cards = (await getCards(page)).slice(0, 12);
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        expect(overlap(cards[i].rect, cards[j].rect), `Thẻ ${cards[i].path} và ${cards[j].path} chồng lấn nhau`).toBeFalsy();
      }
    }
    const okOverlap = (a: PartKind, b: PartKind) => (a === 'label' && b === 'image') || (a === 'image' && b === 'label');
    for (const c of cards) {
      for (let i = 0; i < c.parts.length; i++) {
        const p = c.parts[i].box;
        const tol = c.parts[i].kind === 'label' ? 6 : 3;
        expect(p.x >= c.rect.x - tol && p.x + p.w <= c.rect.x + c.rect.w + tol, `${c.parts[i].kind} của ${c.path} tràn ngang`).toBeTruthy();
        expect(p.y >= c.rect.y - tol && p.y + p.h <= c.rect.y + c.rect.h + tol, `${c.parts[i].kind} của ${c.path} tràn dọc`).toBeTruthy();
        for (let j = i + 1; j < c.parts.length; j++) {
          if (okOverlap(c.parts[i].kind, c.parts[j].kind)) continue;
          expect(overlap(p, c.parts[j].box), `Trong thẻ ${c.path}: ${c.parts[i].kind} chồng lấn ${c.parts[j].kind}`).toBeFalsy();
        }
      }
    }
  });

  test('ProductList_Display_15 - Kiểm tra danh sách không có thẻ trùng lặp bất thường', async ({ page }) => {
    const cards = await getCards(page);
    expect(cards.length).toBeGreaterThan(0);
    expect(dups(paths(cards)), 'Có sản phẩm xuất hiện ở nhiều thẻ trong cùng danh sách').toEqual([]);
    expect(Array.from(new Set(dups(cards.map(c => c.name.toLowerCase())))), 'Có hai thẻ khác sản phẩm nhưng cùng tên').toEqual([]);
  });

  test('ProductList_Display_16 - Kiểm tra các sản phẩm hiển thị đúng ngành hàng Tivi', async ({ page }) => {
    const cards = (await getCards(page)).slice(0, 20);
    for (const c of cards) {
      expect(c.path.startsWith('/tivi/'), `${c.path} không thuộc /tivi/`).toBeTruthy();
      expect(/(tivi|\btv\b)/i.test(c.name) || !!c.spec, `"${c.name}" không giống sản phẩm tivi`).toBeTruthy();
      // Đã sửa regex: chỉ loại trừ khi phụ kiện đứng ở đầu tên sản phẩm, tránh bắt nhầm tivi có "điều khiển giọng nói"
      expect(c.name, `"${c.name}" là sản phẩm phụ kiện hoặc ngành hàng khác`)
        .not.toMatch(/^(giá treo|giá đỡ|chân đế|ăng\s?-?ten|anten|tv box|tivi box|loa|kệ|dây|cáp)\b/i);
      expect(c.name, `"${c.name}" thuộc ngành hàng khác`)
        .not.toMatch(/tủ lạnh|máy lạnh|điều hòa|máy giặt|điện thoại|laptop|quạt|nồi/i);
    }
  });

  test('ProductList_Display_17 - Kiểm tra tổng số sản phẩm được công bố có định dạng hợp lệ', async ({ page }) => {
    const info = await getTotalInfo(page);
    test.skip(info === null, 'Trang không công bố tổng số sản phẩm');
    expect(Number.isInteger(info!.value) && info!.value > 0, `Tổng số không hợp lệ: ${info!.value}`).toBeTruthy();
    expect(info!.label, 'Tổng số phải gắn kèm chữ "Tivi"').toMatch(/tivi/i);
    expect(info!.value, 'Tổng số phải không nhỏ hơn số thẻ đang hiển thị').toBeGreaterThanOrEqual((await getCards(page)).length);
  });

  test('ProductList_Display_18 - Kiểm tra trạng thái tải ban đầu kết thúc đúng', async ({ page }) => {
    await page.waitForLoadState('load');
    await expect(page.locator('[aria-busy="true"]:visible, [class*="skeleton" i]:visible, [class*="spinner" i]:visible'),
      'Trạng thái loading vẫn còn sau khi trang tải xong').toHaveCount(0, { timeout: 15_000 });
    const n1 = (await getCards(page)).length;
    expect(n1).toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    expect((await getCards(page)).length, 'Danh sách vẫn thay đổi sau khi tải xong').toBe(n1);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY), { message: 'Không cuộn được trang' }).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Tải thêm sản phẩm (Đã đồng nhất Pre-condition và tối ưu kết thúc)*/
/* ------------------------------------------------------------------ */
test.describe('Tải thêm sản phẩm', () => {
  test.beforeEach(async ({ page }) => { await openCategory(page); });

  test('ProductList_LoadMore_01 - Kiểm tra nút hoặc cơ chế tải thêm xuất hiện khi còn sản phẩm', async ({ page }) => {
    const loaded = (await getCards(page)).length;
    const total = await getTotal(page);
    test.skip(total !== null && total <= loaded, `Đã hiển thị đủ ${loaded}/${total} sản phẩm, không còn gì để tải thêm theo Pre-condition`);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const btn = await findLoadMore(page);
    if (btn) {
      await expect(btn, 'Còn sản phẩm nhưng không thấy nút Xem thêm').toBeVisible();
      const n = ((await btn.innerText()).match(/[\d.]+/) || [])[0];
      if (n) expect(Number(n.replace(/\./g, '')), 'Số sản phẩm còn lại ghi trên nút phải > 0').toBeGreaterThan(0);
    } else {
      const r = await loadMoreOnce(page);
      expect(r.via, 'Còn sản phẩm nhưng không có nút Xem thêm và không tự tải').not.toBe('none');
    }
  });

  test('ProductList_LoadMore_02 - Kiểm tra nhấn Xem thêm làm tăng số thẻ hiển thị', async ({ page }) => {
    test.skip(!(await canLoadMore(page)), 'Không thỏa Pre-condition (không còn sản phẩm để tải thêm)');
    const r = await loadMoreOnce(page);
    expect(r.via, 'Không có cơ chế tải thêm').not.toBe('none');
    expect(r.after.length, `Số thẻ không tăng sau khi tải thêm`).toBeGreaterThan(r.before.length);
    await expectNoErrorPage(page);
  });

  test('ProductList_LoadMore_03 - Kiểm tra các thẻ mới được nối tiếp danh sách hiện tại', async ({ page }) => {
    test.skip(!(await canLoadMore(page)), 'Không thỏa Pre-condition (không còn sản phẩm để tải thêm)');
    const r = await loadMoreOnce(page);
    expect(r.after.length, 'Tải thêm không bổ sung sản phẩm nào').toBeGreaterThan(r.before.length);
    expect(paths(r.after).slice(0, r.before.length), 'Danh sách cũ bị xáo trộn thứ tự').toEqual(paths(r.before));
  });

  test('ProductList_LoadMore_04 - Kiểm tra không lặp sản phẩm sau khi tải thêm', async ({ page }) => {
    test.skip(!(await canLoadMore(page)), 'Không thỏa Pre-condition (không còn sản phẩm để tải thêm)');
    const r = await loadMoreOnce(page);
    expect(r.after.length, 'Tải thêm không bổ sung sản phẩm nào').toBeGreaterThan(r.before.length);
    const beforePaths = new Set(paths(r.before));
    const repeatedInNew = paths(r.after).filter((p, i) => i >= r.before.length && beforePaths.has(p));
    expect(repeatedInNew, 'Sản phẩm vừa tải trùng với sản phẩm đã hiển thị').toEqual([]);
    await expectNoDuplicateCards(page, 'Sau khi tải thêm');
  });

  test('ProductList_LoadMore_05 - Kiểm tra tải thêm nhiều lần liên tiếp vẫn giữ danh sách hợp lệ', async ({ page }) => {
    test.skip(!(await canLoadMore(page)), 'Không thỏa Pre-condition (không còn sản phẩm để tải thêm)');
    let prev = await getCards(page);
    const startCount = prev.length;
    const total = await getTotal(page);
    let loads = 0;

    for (let i = 1; i <= 3; i++) {
      if (total !== null && prev.length >= total) break;
      const r = await loadMoreOnce(page);
      if (r.after.length <= prev.length) break;
      await expectNoErrorPage(page);
      prev = r.after;
      loads++;
    }
    expect(loads, 'Không thực hiện được lần tải thêm nào').toBeGreaterThan(0);
    expect(prev.length).toBeGreaterThan(startCount);
  });

  test('ProductList_LoadMore_06 - Kiểm tra trạng thái kết thúc khi không còn sản phẩm để tải', async ({ page }) => {
    test.setTimeout(240_000);
    const total = await getTotal(page);
    const startCount = (await getCards(page)).length;
    test.skip(total !== null && startCount >= total, `Đã hiển thị đủ ${startCount}/${total} sản phẩm ngay từ đầu`);

    let count = await countProductPaths(page);
    let loads = 0;
    const MAX_LOADS = 25; // Đủ để duyệt hết toàn bộ danh mục mà không bị chạy vô tận

    while (loads < MAX_LOADS) {
      const btn = await findLoadMore(page);
      const visible = !!btn && (await btn.isVisible().catch(() => false));
      const disabled = visible && (await btn!.isDisabled().catch(() => false));
      if (!visible || disabled) break; // Đã đạt trạng thái kết thúc

      const next = await clickLoadMore(page, btn!, count);
      if (next <= count) break;
      count = next;
      loads++;
    }

    // Kiểm tra không còn tự động tải vô hạn
    let settled = -1;
    for (let i = 0, same = 0; i < 5 && same < 2; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      const n = await countProductPaths(page);
      same = n === settled ? same + 1 : 0;
      settled = n;
    }

    const finalCards = await getCards(page);
    // Khớp đúng dung sai 5% như mô tả trong Test Case Excel
    if (total !== null) {
      expect(finalCards.length, 'Số thẻ vượt quá tổng số công bố').toBeLessThanOrEqual(total);
      const tolerance = Math.ceil(total * 0.05);
      expect(finalCards.length, `Dừng ở ${finalCards.length}/${total} sản phẩm, vượt quá dung sai 5%`).toBeGreaterThanOrEqual(total - tolerance);
    }
    test.info().annotations.push({ type: 'kết quả', description: `Tải thành công ${finalCards.length} sản phẩm qua ${loads} lần bấm Xem thêm.` });
  });

  test('ProductList_LoadMore_07 - Kiểm tra danh sách giữ các thẻ đã tải khi cuộn lên và xuống', async ({ page }) => {
    const r = await loadMoreOnce(page);
    const before = r.after;
    expect(before.length).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);

    const after = await getCards(page);
    expect(after.length, 'Số thẻ bị giảm sau khi cuộn').toBeGreaterThanOrEqual(before.length);
    expect(paths(after).slice(0, before.length), 'Các thẻ đã tải bị thay đổi sau khi cuộn').toEqual(paths(before));
  });
});
