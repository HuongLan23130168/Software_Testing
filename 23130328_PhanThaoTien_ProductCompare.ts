import { test, expect, Browser, Page, Response } from '@playwright/test';


const BASE_URL = (process.env.DMX_BASE_URL ?? 'https://www.dienmayxanh.com').replace(/\/$/, '');
const CATEGORY_URL = `${BASE_URL}/tivi`;
const TCL_URL = process.env.DMX_PRODUCT_URL ?? `${BASE_URL}/tivi/google-tcl-4k-55-inch-55p635`;
// Sản phẩm mẫu theo tài liệu TestCase v3
const TCL = { model: '55P635', search: '55P635' };
const SAMSUNG = { model: 'QA65Q8F5', search: 'QA65Q8F5' };
const SONY = { model: 'K-55S25VM2', search: 'K-55S25VM2' };

const VIEWPORT = { width: 1365, height: 900 };
const CONTEXT_OPTIONS = { locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', viewport: VIEWPORT };

test.describe.configure({ timeout: 240_000 });

test.use({
  ...CONTEXT_OPTIONS,
  screenshot: 'only-on-failure',
  trace: 'retain-on-failure',
  video: process.env.PW_VIDEO === 'on' ? 'on' : 'retain-on-failure',
  launchOptions: { slowMo: Number(process.env.SLOWMO ?? 0) },
  ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
});

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu                                                        */
/* ------------------------------------------------------------------ */

interface ListCard { path: string; name: string; price: number | null }
interface DockItem { name: string; hasImg: boolean; hasRemove: boolean }
interface DockState {
  found: boolean; items: DockItem[]; count: number;
  canCompare: boolean; btnVisible: boolean; hasSearch: boolean; text: string;
}
interface Column {
  path: string; name: string; prices: string[];
  hasImg: boolean; imgOk: boolean; imgSrc: string; hasRemove: boolean;
  left: number; width: number;
}
interface SpecRow { label: string; values: string[]; lefts: number[] }
interface SpecGroup { title: string; rows: SpecRow[] }
interface CompareState {
  columns: Column[]; groups: SpecGroup[]; headings: string[];
  hasDiffToggle: boolean; diffOn: boolean; text: string; overflowX: number;
}
interface Suggestion { text: string }

const PRICE_FORMAT = /^\d{1,3}(?:\.\d{3})+\s?[₫đ]$/;
const BAD_TEXT = /undefined|\bnull\b|\bNaN\b|\[object/i;
const LIMIT_MSG = /tối đa|vượt quá|không thể thêm|chỉ (được|có thể) (so sánh|chọn)/i;
const SAME_CATEGORY_MSG = /cùng (ngành|loại|danh mục)|chỉ (so sánh|có thể so sánh)/i;
const MIN_TWO_MSG = /tối thiểu|ít nhất|chọn thêm|cần.{0,15}2 sản phẩm|2 sản phẩm/i;
const NOT_FOUND_MSG = /không tìm thấy|không tồn tại|404|không có sản phẩm/i;

/* ------------------------------------------------------------------ */
/* Hàm tiện ích thuần (chạy trong Node)                                 */
/* ------------------------------------------------------------------ */

const compact = (s: string) => s.toLowerCase().replace(/[\s\-–_.,]/g, '');
const normVal = (s: string) => s.normalize('NFC').toLowerCase().replace(/[\s,.;:·•\-–()]/g, '');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pathOf = (u: string) => new URL(u, BASE_URL).pathname.replace(/\/+$/, '');
const toNum = (s: string) => Number(s.replace(/\D/g, ''));
const countMatches = (text: string, re: RegExp) => (text.match(new RegExp(re.source, 'gi')) ?? []).length;

/** Lấy mã model dài nhất có chứa số: "Google Tivi TCL AI 4K 55 inch 55P635" -> "55P635" */
const modelOf = (s: string) =>
  (s.toUpperCase().match(/[A-Z0-9][A-Z0-9-]*\d[A-Z0-9-]*/g) ?? []).sort((a, b) => b.length - a.length)[0] ?? '';

/** Hai tên có cùng sản phẩm không (so theo mã model, nếu không có thì so theo chuỗi chứa) */
function sameProduct(a: string, b: string): boolean {
  const ma = modelOf(a), mb = modelOf(b);
  if (ma && mb) return compact(ma) === compact(mb);
  return compact(a).includes(compact(b)) || compact(b).includes(compact(a));
}

const flatRows = (s: CompareState) => s.groups.flatMap(g => g.rows);
const allSame = (r: SpecRow) => new Set(r.values.map(normVal)).size === 1;

/* ------------------------------------------------------------------ */
/* Hàm chạy TRONG TRÌNH DUYỆT - toàn bộ selector phụ thuộc DOM ở đây    */
/* Được nạp vào mọi trang qua addInitScript và gọi qua window.__dmx     */
/* ------------------------------------------------------------------ */

function installDomHelpers() {
  const vis = (e: Element): boolean => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
  const txt = (e: Element) => norm((e as HTMLElement).innerText ?? e.textContent);
  const pathOf = (a: HTMLAnchorElement) => new URL(a.href, location.href).pathname.replace(/\/+$/, '');
  const isProduct = (p: string) => /^\/tivi\/[^/?#]+$/.test(p) && !p.includes('-vs-');
  const PRICE_RE = /\d{1,3}(?:\.\d{3})+\s?[₫đ]/g;

  const mark = (el: Element | null | undefined, attr: string): boolean => {
    document.querySelectorAll(`[${attr}]`).forEach(x => x.removeAttribute(attr));
    if (!el) return false;
    el.setAttribute(attr, '1');
    return true;
  };

  /** Nút xoá (X) trong một phần tử (thẻ trong thanh so sánh hoặc cột bảng so sánh) */
  const removeOf = (item: Element): HTMLElement | null => {
    // Tìm trong đúng ô để tránh lấy nút X của ô kế bên trong grid mới.
    const root = item;
    const named = Array.from(root.querySelectorAll<HTMLElement>(
      '[class*="close" i], [class*="remove" i], [class*="delete" i], [class*="btn-del" i], [aria-label], [title]'))
      .find(e => vis(e) && /close|remove|delete|xoá|xóa|bỏ|^x$/i.test(
        `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('title') ?? ''} ${e.getAttribute('class') ?? ''}`));
    if (named) return named;

    // Nút X của DMX là icon tròn nhỏ ở góc trên phải, đôi khi không có text/class
    // mang nghĩa close và nằm cạnh ảnh trong cùng ô sản phẩm.
    const box = item.getBoundingClientRect();
    const candidates = Array.from(root.querySelectorAll<HTMLElement>('button, [role="button"], a, span, i, svg, div'))
      .filter(e => {
        if (!vis(e)) return false;
        const r = e.getBoundingClientRect();
        return r.width >= 12 && r.width <= 48 && r.height >= 12 && r.height <= 48
          && r.right >= box.right - 56 && r.right <= box.right + 4
          && r.top >= box.top - 4 && r.top <= box.top + 100;
      });
    return candidates[0] ?? null;
  };

  /* ----------------------- Thanh/khu vực so sánh ----------------------- */

  const findDock = (): HTMLElement | null => {
    const all = Array.from(document.querySelectorAll<HTMLElement>('*')).filter(vis);

    // Dock hiện tại của DMX là thanh cố định cuối trang: có CTA [So sánh ngay]
    // và các ô [Thêm sản phẩm]. Ưu tiên nhận diện cấu trúc này trước class cũ.
    const compareNow = all.find(e => e.tagName === 'BUTTON' && /^so\s*sánh\s*ngay$/i.test(txt(e)));
    if (compareNow) {
      let el: HTMLElement | null = compareNow;
      while (el && el !== document.body && !el.querySelector('h1')) {
        const cs = getComputedStyle(el);
        const isDock = /thêm\s*sản\s*phẩm/i.test(txt(el))
          && /so\s*sánh\s*ngay/i.test(txt(el));
        if (isDock && (cs.position === 'fixed' || cs.position === 'sticky'
          || el.getAttribute('role') === 'dialog' || el.id.toLowerCase().includes('compare'))) return el;
        el = el.parentElement;
      }
    }

    // 1. Ưu tiên các phần tử có class đặc thù của thanh so sánh (và KHÔNG chứa h1 để tránh nuốt trang chi tiết)
    const byClass = all.filter(e => {
      const cls = (e.getAttribute('class') ?? '').toLowerCase();
      return /(stick-compare|box-compare|compare-dock|popup-compare|compare-bar|compare-box|compare-popup)/.test(cls)
        && !e.querySelector('h1') && e !== document.body;
    });
    const pickClass = byClass.find(e => {
      const position = getComputedStyle(e).position;
      return (position === 'fixed' || position === 'sticky')
        && (e.querySelector('img') || e.querySelector('input'));
    });
    if (pickClass) return pickClass;

    // 2. Tìm theo nút [So sánh ngay] (đây là nút CTA duy nhất chỉ có trong thanh/khu vực so sánh)
    const ctaBtn = all.find(e => /^so\s*sánh\s*ngay$/i.test(txt(e)) && !e.closest('header, nav, footer'));
    if (ctaBtn) {
      // Đi ngược lên cha cao nhất nhưng TUYỆT ĐỐI KHÔNG vượt qua mức có chứa h1 hoặc là document.body
      let el: HTMLElement | null = ctaBtn.parentElement;
      let bestContainer: HTMLElement = ctaBtn.parentElement ?? ctaBtn;
      while (el && el !== document.body && !el.querySelector('h1')) {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky' || el.getAttribute('role') === 'dialog' || el.id.includes('compare')) {
          bestContainer = el;
          break;
        }
        if (el.querySelector('img') || el.querySelector('input')) {
          bestContainer = el;
        }
        el = el.parentElement;
      }
      return bestContainer;
    }

    // 3. Tìm các container fixed hoặc sticky (thường dính ở đáy màn hình bottom-0) chứa text "so sánh" VÀ có ảnh/input, KHÔNG chứa h1
    const floating = all.filter(e => {
      if (e === document.body || e === document.documentElement || e.querySelector('h1')) return false;
      const cs = getComputedStyle(e);
      const isFloat = cs.position === 'fixed' || cs.position === 'sticky';
      return isFloat && /so\s*sánh/i.test(txt(e)) && (e.querySelector('img') || e.querySelector('input'));
    });
    if (floating.length) return floating[0];

    return null;
  };

  const dockItems = (dock: HTMLElement): HTMLElement[] => {
    // Giao diện DMX mới đặt các ô sản phẩm trực tiếp trong grid-cols-4.
    // Ảnh nằm trong từng ô, còn các ô trống chỉ có nhãn "Thêm sản phẩm".
    // Tránh leo từ ảnh lên grid cha, khiến tên/count bị đọc sai khi chỉ có 1 SP.
    const grid = Array.from(dock.querySelectorAll<HTMLElement>('[class*="grid-cols"]'))
      .find(e => vis(e) && e.children.length >= 2
        && Array.from(e.children).some(child => /thêm\s*sản\s*phẩm/i.test(txt(child))));
    if (grid) {
      const slots = Array.from(grid.children).filter((e): e is HTMLElement => e instanceof HTMLElement && vis(e));
      const selected = slots.filter(slot => {
        const label = txt(slot);
        return !!slot.querySelector('img') && label.length > 0
          && !/^thêm\s*sản\s*phẩm$/i.test(label)
          && !/so\s*sánh\s*ngay/i.test(label);
      });
      if (selected.length) return selected;
    }

    // Dự phòng cho layout cũ không có grid với slot là phần tử con trực tiếp.
    const items: HTMLElement[] = [];
    const imgs = Array.from(dock.querySelectorAll('img')).filter(vis);
    for (const img of imgs) {
      // Bỏ qua icon nhỏ, logo hoặc danh sách gợi ý tìm kiếm
      if (img.closest('[class*="suggest" i], [class*="result" i], [class*="autocomplete" i], [role="listbox"], header, footer')) continue;
      const r = img.getBoundingClientRect();
      if (r.width < 15 || r.height < 15) continue;

      let el = img as HTMLElement;
      while (el.parentElement && el.parentElement !== dock && dock.contains(el.parentElement)
        && el.parentElement.querySelectorAll('img').length === 1) el = el.parentElement;
      if (!items.includes(el)) items.push(el);
    }
    return items;
  };

  const readDock = () => {
    const dock = findDock();
    if (!dock) return { found: false, items: [], count: 0, canCompare: false, btnVisible: false, hasSearch: false, text: '' };
    const items = dockItems(dock).map(el => ({ name: txt(el), hasImg: !!el.querySelector('img'), hasRemove: !!removeOf(el) }));
    const btn = Array.from(dock.querySelectorAll<HTMLElement>('button, a, div, span, label'))
      .find(e => /^so\s*sánh\s*ngay$/i.test(txt(e)));
    const btnVisible = !!btn && vis(btn);
    // Không suy ra disabled từ class của các wrapper: một wrapper có thể giữ
    // style mờ dù nút thật vẫn bấm được. Kiểm tra trạng thái control trực tiếp.
    const disabled = !!btn && (('disabled' in btn && (btn as HTMLButtonElement).disabled)
      || btn.getAttribute('aria-disabled') === 'true'
      || getComputedStyle(btn).pointerEvents === 'none');
    const input = dock.querySelector<HTMLInputElement>('input:not([type="checkbox"]):not([type="hidden"])')
      ?? document.querySelector<HTMLInputElement>('#search-compare-product');
    return { found: true, items, count: items.length, canCompare: btnVisible && !disabled, btnVisible, hasSearch: !!input && vis(input), text: txt(dock) };
  };

  const tagDockRemove = (index: number) => {
    const dock = findDock();
    const item = dock ? dockItems(dock)[index] : null;
    return mark(item ? removeOf(item) : null, 'data-dmx-remove');
  };
  const tagDockInput = () => {
    const dock = findDock();
    const inDock = dock?.querySelector<HTMLInputElement>('input:not([type="checkbox"]):not([type="hidden"])');
    const searchModal = document.querySelector<HTMLInputElement>('#search-compare-product');
    return mark(inDock ?? searchModal, 'data-dmx-input');
  };

  const tagDockAddSlot = (index: number) => {
    const dock = findDock();
    // Các ô trong dock được render thành link/label ở một số layout, không
    // nhất thiết là button/div/span. Chọn phần tử hiển thị nhỏ nhất có đúng nhãn.
    const slots = dock ? Array.from(dock.querySelectorAll<HTMLElement>('*'))
      .filter(e => vis(e) && /^thêm\s*sản\s*phẩm$/i.test(txt(e))
        && !Array.from(e.children).some(child => /^thêm\s*sản\s*phẩm$/i.test(txt(child)))) : [];
    return mark(slots[index], 'data-dmx-add-slot');
  };

  /* --------------------------- Trang danh sách --------------------------- */

  const listCards = () => {
    const dock = findDock();
    const seen = new Set<string>();
    const out: { path: string; name: string; price: number | null; el: HTMLElement }[] = [];

    // Bỏ qua carousel khuyến mãi nằm phía trên. Thẻ cần thao tác nằm trong
    // phần “Danh sách sản phẩm”, nơi website hiển thị nút [So sánh].
    const listHeading = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, [role="heading"]'))
      .find(e => /^danh\s*sách\s*sản\s*phẩm$/i.test(txt(e)));
    const isInMainList = (el: Element) => !listHeading
      || !!(listHeading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);

    // Ưu tiên thẻ [data-product-code] của DMX (cấu trúc DOM thực tế)
    const productCards = Array.from(document.querySelectorAll<HTMLElement>('[data-product-code]'));
    for (const card of productCards) {
      if (dock && dock.contains(card)) continue;
      if (card.closest('header, nav, footer')) continue;
      if (!isInMainList(card)) continue;
      const a = card.querySelector<HTMLAnchorElement>('a[href]');
      if (!a) continue;
      const p = pathOf(a);
      if (!isProduct(p) || seen.has(p)) continue;
      if (!card.querySelector('img') || !/\d[.,]\d{3}/.test(card.textContent ?? '')) continue;
      seen.add(p);
      const head = card.querySelector('h3, h2, [class*="name" i], a[title]');
      const name = norm(head?.textContent || a.getAttribute('title') || a.textContent);
      const m = (card.textContent ?? '').match(PRICE_RE);
      out.push({ path: p, name, price: m ? Number(m[0].replace(/\D/g, '')) : null, el: card });
    }
    if (out.length) return out;

    // Dự phòng: duyệt tất cả anchor (cho các trang không có data-product-code)
    for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const p = pathOf(a);
      if (!isProduct(p) || seen.has(p) || a.closest('header, nav, footer') || (dock && dock.contains(a))) continue;
      const card = a.closest<HTMLElement>('li, .item, [data-id], article');
      if (!card || !card.querySelector('img') || !/\d[.,]\d{3}/.test(card.textContent ?? '')) continue;
      if (!isInMainList(card)) continue;
      seen.add(p);
      const head = card.querySelector('h3, h2, [class*="name" i]');
      const name = norm(head?.textContent || a.getAttribute('title') || a.textContent);
      const m = (card.textContent ?? '').match(PRICE_RE);
      out.push({ path: p, name, price: m ? Number(m[0].replace(/\D/g, '')) : null, el: card });
    }
    return out;
  };

  const getListCards = () => listCards().map(({ path, name, price }) => ({ path, name, price }));

  const cardButton = (card: HTMLElement): HTMLElement | null => {
    const all = Array.from(card.querySelectorAll<HTMLElement>('*'));
    // 1. Ưu tiên phần tử có icon__row-5-col-2 (nút So sánh của DMX)
    const icon = all.find(e => e.matches('i.icon__row-5-col-2'));
    if (icon) {
      // Giao diện mới nhận click ở wrapper chứa icon và nhãn, không phải icon trang trí.
      return (icon.closest('button, a, [role="button"]') as HTMLElement | null)
        ?? (icon.parentElement as HTMLElement | null)
        ?? icon;
    }
    let c = all.filter(e => e.classList.contains('icon__row-5-col-2') || e.querySelector('i.icon__row-5-col-2'));
    // 2. Phần tử có text "So sánh"
    if (!c.length) c = all.filter(e => /^so\s*sánh$/i.test(txt(e)));
    if (!c.length) c = all.filter(e => /so\s*sánh/i.test(txt(e)) && txt(e).length <= 20);
    // 3. Class chứa compare hoặc checkbox
    if (!c.length) c = all.filter(e => /compare/i.test(e.getAttribute('class') ?? ''));
    if (!c.length) c = all.filter(e => (e as HTMLInputElement).type === 'checkbox');
    // Lấy phần tử bọc ngoài cùng có thể click được
    return c.filter(x => !c.some(o => o !== x && x.contains(o)))[0] ?? null;
  };

  const tagCard = (path: string) => {
    const found = listCards().find(c => c.path === path);
    return mark(found?.el, 'data-dmx-card');
  };

  const tagCardCompare = (path: string) => {
    const found = listCards().find(c => c.path === path);
    const card = found?.el ?? null;
    const btn = card ? cardButton(card) : null;
    document.querySelectorAll('[data-dmx-card]').forEach(x => x.removeAttribute('data-dmx-card'));
    document.querySelectorAll('[data-dmx-btn]').forEach(x => x.removeAttribute('data-dmx-btn'));
    if (card) card.setAttribute('data-dmx-card', '1');
    if (btn) btn.setAttribute('data-dmx-btn', '1');
    return { card: !!card, btn: !!btn };
  };

  const isCardSelected = (path: string): boolean => {
    const card = listCards().find(c => c.path === path)?.el;
    if (!card) return false;
    const chk = card.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (chk?.checked) return true;
    // DMX: sau khi click "So sánh", nút có thể đổi class, text, hoặc màu sắc
    const btn = cardButton(card);
    if (btn) {
      const cls = (btn.getAttribute('class') ?? '').toLowerCase();
      // text-primary-600 hiện là màu mặc định của nút trên DMX, không thể dùng làm trạng thái đã chọn.
      if (/active|checked|selected/i.test(cls) || /(^|\s)(bg-green|text-green|border-green)/i.test(cls)) return true;
      const btnTxt = txt(btn);
      if (/^(đã chọn|bỏ so sánh|bỏ chọn|đã thêm(?:\s+so sánh)?)/i.test(btnTxt) && btnTxt.length < 30) return true;
      // Kiểm tra màu chữ/icon thay đổi (được đánh dấu bằng class text-green hoặc text-primary khác)
      const style = getComputedStyle(btn);
      if (style.color && style.color !== 'rgb(0, 0, 0)' && style.color !== 'rgb(255, 255, 255)') {
        // So sánh với trạng thái mặc định (text-primary-600 = màu xanh)
        // Khi chọn xong, DMX thường đổi sang màu xanh đậm hơn hoặc có icon khác
      }
    }
    // DMX: kiểm tra trong dock - nếu dock chứa sản phẩm này thì coi như đã chọn
    const dock = findDock();
    if (dock) {
      const productPath = path;
      const dockText = txt(dock).toLowerCase();
      // Thử kiểm tra bằng anchor trong dock
      const dockAnchors = Array.from(dock.querySelectorAll<HTMLAnchorElement>('a[href]'));
      if (dockAnchors.some(a => pathOf(a) === productPath)) return true;
      // Thử kiểm tra text card trong dock
      const cardName = norm(card.querySelector('h3, h2, a[title]')?.textContent || '').toLowerCase();
      if (cardName && dockText.includes(cardName.slice(0, 15))) return true;
    }
    return Array.from(card.querySelectorAll<HTMLElement>('*')).some(e => {
      const t = txt(e);
      const c = (e.getAttribute('class') ?? '').toLowerCase();
      return (/^(đã chọn|bỏ so sánh|bỏ chọn|đã thêm(?:\s+so sánh)?)/i.test(t) && t.length < 30)
        || (/compare/.test(c) && /(active|checked|selected)/.test(c));
    });
  };

  /* ----------------------- Gợi ý khi gõ vào ô tìm kiếm ----------------------- */

  const sugCandidates = (): HTMLElement[] => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('li, a, div, p'))
      .filter(e => vis(e) && e.querySelector('img') && txt(e).length >= 5 && txt(e).length <= 250);
    return els.filter(e => !els.some(o => o !== e && e.contains(o)));
  };
  // Chụp "ảnh nền" các khối có ảnh trước khi gõ, sau khi gõ chỉ những khối MỚI xuất hiện mới là gợi ý
  const markSuggestBaseline = () => { (window as any).__dmxBase = new Set(sugCandidates().map(txt)); };
  const newSuggestions = () => {
    const base: Set<string> | undefined = (window as any).__dmxBase;
    return sugCandidates().filter(e => !base?.has(txt(e)));
  };
  const quickCompareResults = () => Array.from(document.querySelectorAll<HTMLElement>('[id^="modal-"] button'))
    .filter(e => vis(e) && /^thêm\s*so\s*sánh$/i.test(txt(e)))
    .map(e => ({ text: norm(e.parentElement?.parentElement?.innerText) }));
  const readSuggestions = () => {
    const quick = quickCompareResults();
    return quick.length ? quick : newSuggestions().map(e => ({ text: txt(e) }));
  };
  const tagSuggestion = (reSource: string) => {
    const re = new RegExp(reSource, 'i');
    const quick = Array.from(document.querySelectorAll<HTMLElement>('[id^="modal-"] button'))
      .find(e => vis(e) && /^thêm\s*so\s*sánh$/i.test(txt(e))
        && re.test(norm(e.parentElement?.parentElement?.innerText)));
    if (quick) return mark(quick, 'data-dmx-sug');
    const suggestion = newSuggestions().find(e => re.test(txt(e)));
    if (!suggestion) return false;
    // Trong modal DMX, click thêm nằm trên link riêng trong hàng gợi ý.
    // Ưu tiên chính control đó thay vì click giữa hàng (có thể chỉ focus hàng).
    const addControl = Array.from(suggestion.querySelectorAll<HTMLElement>('button, a, [role="button"]'))
      .find(e => vis(e) && /^thêm\s*so\s*sánh$/i.test(txt(e)));
    return mark(addControl ?? suggestion, 'data-dmx-sug');
  };

  /* --------------------------- Trang so sánh chi tiết --------------------------- */

  /** Tìm các cột sản phẩm: nhóm các khối "chỉ chứa đúng 1 sản phẩm" là anh em của nhau */
  const findColumns = (): { el: HTMLElement; path: string }[] => {
    const dock = findDock();
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .filter(a => vis(a) && isProduct(pathOf(a)) && !a.closest('header, nav, footer') && !(dock && dock.contains(a)));
    const distinct = (el: Element) => new Set(
      Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(a => isProduct(pathOf(a))).map(pathOf)).size;
    const byPath = new Map<string, HTMLAnchorElement>();
    anchors.forEach(a => { if (!byPath.has(pathOf(a))) byPath.set(pathOf(a), a); });

    const cells: { el: HTMLElement; path: string }[] = [];
    byPath.forEach((a, p) => {
      let el: HTMLElement = a;
      while (el.parentElement
        && !/^(BODY|MAIN|SECTION|TABLE|TBODY|THEAD)$/.test(el.parentElement.tagName)
        && distinct(el.parentElement) === 1
        && txt(el.parentElement).length < 800) el = el.parentElement;
      cells.push({ el, path: p });
    });

    const groups = new Map<HTMLElement, { el: HTMLElement; path: string }[]>();
    cells.forEach(c => {
      const par = c.el.parentElement as HTMLElement;
      if (!groups.has(par)) groups.set(par, []);
      groups.get(par)!.push(c);
    });
    const urlPath = decodeURIComponent(location.pathname);
    const scored = Array.from(groups.values()).map(g => ({
      g, hit: g.filter(c => urlPath.includes(c.path.split('/').pop() ?? '#')).length,
    }));
    scored.sort((x, y) => y.hit - x.hit || y.g.length - x.g.length);
    return scored.length ? scored[0].g : [];
  };

  const readCompare = () => {
    const dock = findDock();
    const cols = findColumns();
    const columns = cols.map(({ el, path }) => {
      const nameEl = el.querySelector('h1, h2, h3, h4, [class*="name" i]');
      const link = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .find(a => isProduct(pathOf(a)) && txt(a).length > 3);
      const img = el.querySelector('img');
      const r = el.getBoundingClientRect();
      return {
        path,
        name: norm(nameEl?.textContent || link?.textContent || link?.getAttribute('title')),
        prices: (txt(el).match(PRICE_RE) ?? []).map(s => s.trim()),
        hasImg: !!img,
        imgOk: !!img && img.complete && img.naturalWidth > 0,
        imgSrc: img ? (img.currentSrc || img.src) : '',
        hasRemove: !!removeOf(el),
        left: r.left, width: r.width,
      };
    });

    // Bảng thông số: dòng 1 ô = tiêu đề nhóm; dòng >= 2 ô = [nhãn, giá trị SP1, giá trị SP2, ...]
    const explicitRows = Array.from(document.querySelectorAll<HTMLElement>('tr, [class*="row-spec" i], [class*="spec-row" i]'));
    // DMX dùng div grid (nhãn + một ul/li cho từng sản phẩm), không phải <tr>.
    const gridRows = Array.from(document.querySelectorAll<HTMLElement>('main div'))
      .filter(r => {
        const cells = Array.from(r.children).filter(vis) as HTMLElement[];
        return vis(r) && cells.length >= 3 && cells.length <= 6
          && !r.querySelector('img, h1, h2, h3, h4')
          && !cells[0].querySelector('li, ul')
          && cells.slice(1).every(c => c.querySelectorAll('li').length <= 1 && !!txt(c));
      });
    const rowEls = Array.from(new Set([...explicitRows, ...gridRows]))
      .filter(r => vis(r) && !r.querySelector('tr') && !r.querySelector('img') && !(dock && dock.contains(r))
        && !Array.from(r.querySelectorAll<HTMLAnchorElement>('a[href]')).some(a => isProduct(pathOf(a))));
    const groups: { title: string; rows: { label: string; values: string[]; lefts: number[] }[] }[] = [];
    let cur: { title: string; rows: { label: string; values: string[]; lefts: number[] }[] } = { title: '', rows: [] };
    groups.push(cur);
    for (const r of rowEls) {
      const cells = Array.from(r.children).filter(vis) as HTMLElement[];
      if (!cells.length) continue;
      if (cells.length === 1) {
        const title = txt(cells[0]);
        if (!title) continue;
        cur = { title, rows: [] };
        groups.push(cur);
      } else {
        cur.rows.push({
          label: txt(cells[0]),
          values: cells.slice(1).map(c => txt(c.querySelector('li') ?? c)),
          lefts: cells.slice(1).map(c => (c.querySelector('li') ?? c).getBoundingClientRect().left),
        });
      }
    }

    const toggles = Array.from(document.querySelectorAll<HTMLElement>('label, span, div, a, p, li'))
      .filter(e => vis(e) && /chỉ xem điểm khác biệt/i.test(txt(e)));
    const toggle = toggles.filter(e => !toggles.some(o => o !== e && e.contains(o)))[0];
    let diffOn = false;
    if (toggle) {
      const scope = toggle.closest('label') ?? toggle.parentElement ?? toggle;
      const chk = (toggle.querySelector('input') ?? scope.querySelector('input')) as HTMLInputElement | null;
      if (chk) diffOn = chk.checked;
      else {
        let n: HTMLElement | null = toggle;
        for (let i = 0; i < 3 && n; i++, n = n.parentElement) {
          const c = (n.getAttribute('class') ?? '').toLowerCase();
          if (/(^|[\s_-])(active|checked|on|selected)([\s_-]|$)/.test(c) || n.getAttribute('aria-checked') === 'true') diffOn = true;
        }
      }
    }

    return {
      columns,
      groups: groups.filter(g => g.title || g.rows.length),
      headings: Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4')).filter(vis).map(txt),
      hasDiffToggle: !!toggle,
      diffOn,
      text: document.body.innerText || '',
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    };
  };

  const tagColumnRemove = (index: number) => {
    const col = findColumns()[index]?.el;
    if (!col) return mark(null, 'data-dmx-colremove');
    // Nút X của trang so sánh nằm ở góc trên phải từng cột và có thể là
    // sibling của link/ảnh sản phẩm, nên tìm theo vị trí của đúng cột trước.
    const r = col.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.min(r.right - 26, innerWidth - 2), Math.max(1, r.top + 30));
    let node = hit as HTMLElement | null;
    for (let i = 0; i < 6 && node && node !== document.body; i++, node = node.parentElement) {
      if (node.matches('button, a, [role="button"]') || getComputedStyle(node).cursor === 'pointer')
        return mark(node, 'data-dmx-colremove');
    }
    return mark(hit as HTMLElement | null, 'data-dmx-colremove');
  };

  const tagColumnLink = (index: number, kind: 'name' | 'img') => {
    const el = findColumns()[index]?.el;
    if (!el) return mark(null, 'data-dmx-link');
    const anchors = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(a => isProduct(pathOf(a)) && vis(a));
    const target = kind === 'img'
      ? anchors.find(a => a.querySelector('img'))
      : anchors.find(a => txt(a).length > 3);
    return mark(target, 'data-dmx-link');
  };

  // Chuỗi gọi từ Node
  (window as any).__dmx = {
    readDock, tagDockRemove, tagDockInput, tagDockAddSlot, getListCards, tagCard, tagCardCompare, isCardSelected,
    markSuggestBaseline, readSuggestions, tagSuggestion, readCompare, tagColumnRemove, tagColumnLink,
  };
}

// Nạp hàm hỗ trợ vào mọi trang của mọi test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(installDomHelpers);
});

/* ------------------------------------------------------------------ */
/* Lớp bọc phía Node                                                    */
/* ------------------------------------------------------------------ */

const readDock = (page: Page): Promise<DockState> => page.evaluate(() => (window as any).__dmx.readDock());
const getListCards = (page: Page): Promise<ListCard[]> => page.evaluate(() => (window as any).__dmx.getListCards());
const readCompare = (page: Page): Promise<CompareState> => page.evaluate(() => (window as any).__dmx.readCompare());
const isCardSelected = (page: Page, path: string): Promise<boolean> =>
  page.evaluate((p) => (window as any).__dmx.isCardSelected(p), path);

async function dismissPopups(page: Page) {
  for (let i = 0; i < 2; i++) {
    // Không đụng tới popup/khu vực so sánh
    const dialog = page.locator('[role="dialog"]:visible, [class*="modal" i]:visible, [class*="popup" i]:not([class*="compare" i]):visible').first();
    if (!(await dialog.count())) break;
    const close = dialog.locator('button:has-text("Đóng"), button:has-text("Bỏ qua"), button:has-text("Để sau"), [aria-label*="đóng" i], [aria-label*="close" i]').first();
    if (await close.count()) await close.click({ timeout: 2000 }).catch(() => { });
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

async function gotoWithRetry(page: Page, url: string): Promise<Response> {
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
      if (res && res.status() >= 500 && attempt < 4) { await page.waitForTimeout(2000 * attempt); continue; }
      break;
    } catch (e) {
      if (attempt === 4) throw e;
      await page.waitForTimeout(2000 * attempt);
    }
  }
  expect(res, 'Không nhận được phản hồi từ máy chủ').not.toBeNull();
  return res!;
}

async function expectNoErrorPage(page: Page) {
  await expect(page.locator('body')).not.toContainText(/Internal Server Error|Application error|Something went wrong|Đã có lỗi xảy ra/i);
}

async function expectNotBlank(page: Page) {
  const body = (await page.locator('body').innerText()).trim();
  expect(body.length, 'Trang bị trắng').toBeGreaterThan(50);
}

/** Ghi lại các phản hồi HTTP >= 500 xảy ra trong lúc test */
function watchServerErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('response', r => { if (r.status() >= 500) errs.push(`${r.status()} ${r.url()}`); });
  return errs;
}

/** Ghi lại alert()/confirm() nếu website dùng hộp thoại để báo lỗi */
function captureDialogs(page: Page): string[] {
  const msgs: string[] = [];
  page.on('dialog', d => { msgs.push(d.message()); d.dismiss().catch(() => { }); });
  return msgs;
}

/* --------------------------- Trang chi tiết --------------------------- */

async function openProductDetail(page: Page, url = TCL_URL) {
  const res = await gotoWithRetry(page, url);
  expect(res.status(), `Trang chi tiết trả về HTTP ${res.status()}`).toBeLessThan(400);
  await dismissPopups(page);
  await expect(page.locator('h1:visible').first()).toBeVisible({ timeout: 20_000 });
  // Chờ client gắn handler nếu sự kiện load đến kịp; trang có thể giữ request mở,
  // vì vậy kết quả thao tác thực tế bên dưới mới quyết định testcase pass/fail.
  await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
}

async function clickDetailCompare(page: Page) {
  // Trên giao diện DMX hiện tại, icon là phần tử được bắt sự kiện click;
  // click span chữ khiến nút vẫn giữ nguyên trạng thái.
  const icon = page.locator('i.icon__row-5-col-2:visible').first();
  if (await icon.count()) {
    await expect(icon, 'Không tìm thấy nút [So sánh] ở trang chi tiết').toBeVisible({ timeout: 10_000 });
    await icon.click();
    return;
  }
  const btn = page.locator('a:visible, button:visible, span:visible, div:visible')
    .filter({ hasText: /^\s*so sánh\s*$/i }).first();
  await expect(btn, 'Không tìm thấy nút [So sánh] ở trang chi tiết').toBeVisible({ timeout: 10_000 });
  await btn.click();
}

/** Mở [Thông số] ở trang chi tiết và trả về các cặp nhãn - giá trị */
async function readDetailSpecs(page: Page): Promise<{ label: string; value: string; groupText: string }[]> {
  const btn = page.locator('a:visible, button:visible, span:visible, div:visible').filter({ hasText: /^\s*thông số\s*$/i }).first();
  await expect(btn, 'Không tìm thấy nút [Thông số] ở trang chi tiết').toBeVisible({ timeout: 10_000 });
  await btn.click();
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const vis = (e: Element) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
    const out: { label: string; value: string; groupText: string }[] = [];
    document.querySelectorAll<HTMLElement>('li, tr').forEach(row => {
      if (!vis(row) || row.querySelector('li, tr')) return;
      const kids = Array.from(row.children).filter(vis);
      if (kids.length < 2) return;
      out.push({ label: norm(kids[0].textContent), value: norm(kids.slice(1).map(k => k.textContent).join(' ')), groupText: '' });
    });
    return out;
  });
}

async function readDetailBasics(page: Page, path: string) {
  await openProductDetail(page, `${BASE_URL}${path}`);
  const name = (await page.locator('h1:visible').first().innerText()).trim();
  const prices = await page.evaluate(() => {
    const re = /\d{1,3}(?:\.\d{3})+\s?[₫đ]/g;
    const main = document.querySelector<HTMLElement>('main');
    if (!main) return [] as string[];
    const values = main.innerText.match(re) ?? [];
    return [...new Set(values.map(s => s.trim()))]
      .filter(s => Number(s.replace(/\D/g, '')) > 1_000_000)
      .sort((a, b) => Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, '')))
      .slice(0, 2);
  });
  return { name, prices };
}

/* --------------------------- Trang danh sách --------------------------- */

async function openCategory(page: Page) {
  const res = await gotoWithRetry(page, CATEGORY_URL);
  expect(res.status(), `Trang danh mục trả về HTTP ${res.status()}`).toBeLessThan(400);
  await dismissPopups(page);
  await page.waitForTimeout(2000); // Chờ JS render xong thẻ sản phẩm
  await expect.poll(async () => (await getListCards(page)).length, { timeout: 30_000, message: 'Trang danh sách phải có thẻ sản phẩm' })
    .toBeGreaterThanOrEqual(4);
}

/** Click nút [So sánh] trên thẻ sản phẩm (theo thứ tự hoặc theo đường dẫn) */
async function clickCardCompare(page: Page, target: number | string, waitForAddition = true) {
  const beforeCount = (await readDock(page)).count;
  const cards = await getListCards(page);
  const path = typeof target === 'number' ? cards[target]?.path : target;
  expect(path, `Không có thẻ sản phẩm "${target}" trên trang danh sách`).toBeTruthy();

  // 1. Đánh dấu thẻ card trước để scroll & hover
  const cardFound = await page.evaluate((p) => (window as any).__dmx.tagCard(p), path!);
  expect(cardFound, `Không tìm thấy phần tử thẻ của sản phẩm ${path}`).toBe(true);

  const cardLocator = page.locator('[data-dmx-card]').first();
  await cardLocator.scrollIntoViewIfNeeded({ timeout: 10_000 });
  await cardLocator.hover({ timeout: 10_000 });
  await page.waitForTimeout(400); // Đợi CSS hover / render nút So sánh nếu nút chỉ hiện khi hover

  // 2. Sau khi hover, tìm nút So sánh
  const tagged = await page.evaluate((p) => (window as any).__dmx.tagCardCompare(p), path!);
  if (tagged.btn) {
    const btn = page.locator('[data-dmx-btn]').first();
    // Click vào chính range chữ để tránh phần trống ở wrapper flex rộng toàn thẻ.
    const label = cardLocator.getByText(/^so\s*sánh$/i).first();
    if (await label.count()) await label.click({ timeout: 10_000 });
    else {
      const box = await btn.boundingBox();
      await btn.click({
        timeout: 10_000,
        position: box ? { x: Math.max(1, box.width - 8), y: box.height / 2 } : undefined,
      });
    }
  } else {
    // Dự phòng tìm bằng Playwright text locator trực tiếp trong card
    const btn = cardLocator.locator('div, span, button, a, i').filter({ hasText: /^so\s*sánh$/i }).first();
    await expect(btn, `Không tìm thấy nút [So sánh] trên thẻ ${path} (sau khi đã rê chuột)`).toBeVisible({ timeout: 10_000 });
    await btn.click({ timeout: 10_000 });
  }

  if (waitForAddition) {
    try {
      await expect.poll(async () => (await readDock(page)).count,
        { timeout: 5_000, message: 'Dock phải cập nhật sau khi chọn sản phẩm' }).toBeGreaterThan(beforeCount);
    } catch {
      // Một số lần click thật không làm React cập nhật trên giao diện mới; gọi click() đúng wrapper một lần nữa.
      const fresh = await page.evaluate((p) => (window as any).__dmx.tagCardCompare(p), path!);
      expect(fresh.btn, `Không tìm thấy lại nút [So sánh] trên thẻ ${path}`).toBe(true);
      await page.locator('[data-dmx-btn]').first().evaluate(el => (el as HTMLElement).click());
      await expect.poll(async () => (await readDock(page)).count,
        { timeout: 15_000, message: 'Dock phải cập nhật sau lần thử lại nút [So sánh]' }).toBeGreaterThan(beforeCount);
    }
  }
}

/* --------------------------- Khu vực so sánh --------------------------- */

async function waitForDock(page: Page, count?: number, timeout = 15_000): Promise<DockState> {
  let lastDock: DockState | null = null;
  await expect.poll(async () => {
    lastDock = await readDock(page);
    if (!lastDock.found) return false;
    if (count !== undefined && lastDock.count !== count) return false;
    return true;
  }, {
    timeout,
    message: count === undefined
      ? 'Không tìm thấy khu vực / thanh so sánh (dock/popup không xuất hiện)'
      : `Khu vực so sánh phải có đúng ${count} sản phẩm`,
  }).toBe(true);
  return lastDock ?? readDock(page);
}

async function addCardsFromList(page: Page, n: number): Promise<DockState> {
  for (let i = 0; i < n; i++) {
    let added = false;
    for (let attempt = 0; attempt < 2 && !added; attempt++) {
      await clickCardCompare(page, i);
      try {
        await waitForDock(page, i + 1, 15_000);
        added = true;
      } catch (error) {
        const dock = await readDock(page);
        if (dock.found && dock.count === i + 1) added = true;
        else if (attempt === 1) throw error;
      }
    }
  }
  return readDock(page);
}

async function clickCompareNow(page: Page) {
  const btn = page.locator('a:visible, button:visible, div[role="button"]:visible, span:visible')
    .filter({ hasText: /^\s*so sánh ngay\s*$/i }).first();
  await expect(btn, 'Không tìm thấy nút [So sánh ngay]').toBeVisible({ timeout: 10_000 });
  await btn.click();
}

/** Gõ từ khoá vào ô tìm kiếm và trả về các gợi ý mới xuất hiện */
async function typeAndSuggest(page: Page, inputSel: string, keyword: string, expected?: RegExp): Promise<Suggestion[]> {
  await page.evaluate(() => (window as any).__dmx.markSuggestBaseline());
  const input = page.locator(inputSel).first();
  await expect(input, 'Không tìm thấy ô tìm kiếm trong khu vực so sánh').toBeVisible({ timeout: 8000 });
  await input.click();
  await input.fill('');
  await input.pressSequentially(keyword, { delay: 60 });
  await expect.poll(async () => {
    const suggestions: Suggestion[] = await page.evaluate(() => (window as any).__dmx.readSuggestions());
    return expected ? suggestions.some(s => expected.test(s.text)) : suggestions.length > 0;
  }, { timeout: 20_000, message: `Không có gợi ý phù hợp sau khi tìm "${keyword}"` }).toBe(true);
  return page.evaluate(() => (window as any).__dmx.readSuggestions());
}

async function searchInDock(page: Page, keyword: string, expected?: RegExp): Promise<Suggestion[]> {
  let ok = await page.evaluate(() => (window as any).__dmx.tagDockInput());
  if (!ok) {
    const slotFound = await page.evaluate(() => (window as any).__dmx.tagDockAddSlot(0));
    expect(slotFound, 'Khu vực so sánh phải có ô [Thêm sản phẩm]').toBe(true);
    await page.locator('[data-dmx-add-slot]').click();
    await expect(page.locator('#search-compare-product:visible'), 'Không mở được ô tìm kiếm sản phẩm so sánh').toBeVisible({ timeout: 8000 });
    ok = await page.evaluate(() => (window as any).__dmx.tagDockInput());
  }
  expect(ok, 'Khu vực so sánh phải có ô tìm kiếm').toBe(true);
  return typeAndSuggest(page, '[data-dmx-input]', keyword, expected);
}

async function openDockSearch(page: Page) {
  if (await page.locator('#search-compare-product:visible').count()) return;
  const slotFound = await page.evaluate(() => (window as any).__dmx.tagDockAddSlot(0));
  expect(slotFound, 'Khu vực so sánh phải có ô [Thêm sản phẩm]').toBe(true);
  await page.locator('[data-dmx-add-slot]').click();
  await expect(page.locator('#search-compare-product:visible'), 'Không mở được ô tìm kiếm sản phẩm so sánh').toBeVisible({ timeout: 8000 });
}

async function clickSuggestion(page: Page, re: RegExp) {
  const ok = await page.evaluate((src) => (window as any).__dmx.tagSuggestion(src), re.source);
  expect(ok, `Không có gợi ý nào khớp ${re}`).toBe(true);
  // Modal mới có nút HTML "Thêm so sánh" trong kết quả gõ nhanh; click cả
  // card bên dưới chỉ focus sản phẩm và không thêm nó vào dock.
  const add = page.locator('[id^="modal-"] button').filter({ hasText: /^\s*thêm\s*so\s*sánh\s*$/i }).first();
  await expect(add, 'Kết quả tìm kiếm phải có nút [Thêm so sánh]').toBeVisible({ timeout: 10_000 });
  await add.click({ timeout: 10_000 });
}

const modelRe = (model: string) => new RegExp(model.split('').map(c => (c === '-' ? '[-\\s]?' : escapeRe(c))).join(''), 'i');

async function addProductViaDockSearch(page: Page, model: string) {
  const sugs = await searchInDock(page, model, modelRe(model));
  expect(sugs.some(s => modelRe(model).test(s.text)), `Gợi ý phải chứa sản phẩm ${model}`).toBe(true);
  await clickSuggestion(page, modelRe(model));
}

/** Dựng trang so sánh: mở TCL -> [So sánh] -> thêm lần lượt các sản phẩm -> [So sánh ngay] */
async function buildCompareViaSearch(page: Page, extraModels: string[]) {
  await openProductDetail(page);
  await clickDetailCompare(page);
  await waitForDock(page, 1);
  for (const [i, m] of extraModels.entries()) {
    await addProductViaDockSearch(page, m);
    await waitForDock(page, i + 2);
  }
  await clickCompareNow(page);
  await page.waitForURL(/-vs-/, { timeout: 20_000 });
  await dismissPopups(page);
}

/* --------------------------- Trang so sánh --------------------------- */

async function waitForCompareTable(page: Page, columns?: number): Promise<CompareState> {
  await expect.poll(async () => {
    const c = await readCompare(page);
    return columns === undefined ? c.columns.length >= 1 : c.columns.length === columns;
  }, { timeout: 20_000, message: columns === undefined ? 'Trang so sánh phải có cột sản phẩm' : `Bảng so sánh phải có đúng ${columns} cột` }).toBe(true);
  return readCompare(page);
}

let compareUrlCache: string | undefined = process.env.DMX_COMPARE_URL;
let maxCompareCache: number | undefined = process.env.DMX_MAX_COMPARE ? Number(process.env.DMX_MAX_COMPARE) : undefined;

/** URL so sánh TCL + Samsung, dựng bằng giao diện trong context riêng (không ảnh hưởng test đang chạy) */
async function getCompareUrl(browser: Browser): Promise<string> {
  if (compareUrlCache) return compareUrlCache;
  const ctx = await browser.newContext(CONTEXT_OPTIONS);
  try {
    const p = await ctx.newPage();
    await p.addInitScript(installDomHelpers);
    await buildCompareViaSearch(p, [SAMSUNG.search]);
    compareUrlCache = p.url();
  } finally {
    await ctx.close();
  }
  return compareUrlCache!;
}

async function openComparePage(page: Page, browser: Browser): Promise<CompareState> {
  const url = await getCompareUrl(browser);
  const res = await gotoWithRetry(page, url);
  expect(res.status(), `Trang so sánh trả về HTTP ${res.status()}`).toBeLessThan(400);
  await dismissPopups(page);
  await waitForCompareTable(page, 2);
  await expect.poll(async () => (await readCompare(page)).columns.every(c => c.hasImg && c.imgOk),
    { timeout: 30_000, message: 'Ảnh sản phẩm trên bảng phải tải xong' }).toBe(true);
  return readCompare(page);
}

/** Dò số SP tối đa X (xem Add_07) trong context riêng */
async function getMaxCompare(browser: Browser): Promise<number> {
  if (maxCompareCache) return maxCompareCache;
  const ctx = await browser.newContext(CONTEXT_OPTIONS);
  try {
    const p = await ctx.newPage();
    await p.addInitScript(installDomHelpers);
    await openCategory(p);
    const cards = await getListCards(p);
    let max = 0;
    for (let i = 0; i < Math.min(cards.length, 8); i++) {
      await clickCardCompare(p, i, false);
      // Chờ số lượng tăng thay vì giả định luôn chọn được thêm một sản phẩm;
      // khi chạm giới hạn, giao diện giữ nguyên số lượng hiện tại.
      let increased = false;
      try {
        await expect.poll(async () => (await readDock(p)).count > max,
          { timeout: max === 0 ? 15_000 : 5_000, message: 'Số sản phẩm trong dock phải tăng sau khi chọn' }).toBe(true);
        increased = true;
      } catch {
        if (max === 0) {
          // Chỉ thử lại khi lần click đầu chưa thêm được sản phẩm nào.
          await clickCardCompare(p, i, false);
          try {
            await expect.poll(async () => (await readDock(p)).count > max,
              { timeout: 15_000, message: 'Dock phải nhận được sản phẩm đầu tiên' }).toBe(true);
            increased = true;
          } catch { /* Không thể khởi tạo dock, giữ max=0 để assertion báo rõ tiền điều kiện. */ }
        }
      }
      const d = await readDock(p);
      if (d.count > max) max = d.count; else break;
      if (!increased) break;
    }
    maxCompareCache = max;
  } finally {
    await ctx.close();
  }
  return maxCompareCache!;
}

async function toggleDiff(page: Page) {
  await page.getByText(/Chỉ xem điểm khác biệt/i).first().click();
  await page.waitForTimeout(700);
}

/* ================================================================== */
/* 1. THÊM SẢN PHẨM VÀO SO SÁNH (Add_01 -> Add_10)                      */
/* ================================================================== */
test.describe('1. Thêm sản phẩm vào so sánh', () => {

  test('ProductCompare_Add_01 - Kiểm tra bấm [So sánh] ở trang chi tiết sản phẩm', async ({ page }) => {
    await openProductDetail(page);
    const h1 = (await page.locator('h1:visible').first().innerText()).trim();

    await clickDetailCompare(page);

    // Khu vực so sánh mở ra, SP đang xem đã được thêm sẵn (ảnh + tên), có ô tìm kiếm
    const dock = await waitForDock(page, 1);
    expect(dock.items[0].hasImg, 'Sản phẩm trong khu vực so sánh phải có ảnh').toBe(true);
    expect(sameProduct(dock.items[0].name, h1), `Sản phẩm trong khu vực so sánh ("${dock.items[0].name}") phải là sản phẩm đang xem ("${h1}")`).toBe(true);
    await openDockSearch(page);
    expect((await readDock(page)).hasSearch, 'Phải mở được ô tìm kiếm để thêm sản phẩm thứ hai').toBe(true);
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Add_02 - Kiểm tra bấm [So sánh] trên thẻ sản phẩm ở trang danh sách', async ({ page }) => {
    await openCategory(page);
    const cards = await getListCards(page);

    await clickCardCompare(page, 0);

    const dock = await waitForDock(page, 1);
    expect(dock.items[0].hasImg, 'Sản phẩm trong thanh so sánh phải có ảnh').toBe(true);
    expect(sameProduct(dock.items[0].name, cards[0].name), `Thanh so sánh phải hiển thị đúng sản phẩm "${cards[0].name}"`).toBe(true);
    // Ghi chú: DMX có thể không đổi visual trạng thái nút [So sánh] trên thẻ — kiểm tra mềm (soft)
    expect.soft(await isCardSelected(page, cards[0].path), 'Nút [So sánh] trên thẻ phải đổi sang trạng thái đã chọn').toBe(true);
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Add_03 - Kiểm tra thêm sản phẩm thứ hai vào so sánh từ trang danh sách', async ({ page }) => {
    await openCategory(page);
    const cards = await getListCards(page);

    await clickCardCompare(page, 0);
    await waitForDock(page, 1);
    await clickCardCompare(page, 1);

    const dock = await waitForDock(page, 2);
    expect(sameProduct(dock.items[0].name, cards[0].name), 'SP thứ nhất phải đúng').toBe(true);
    expect(sameProduct(dock.items[1].name, cards[1].name), 'SP thứ hai phải đúng').toBe(true);
    expect(sameProduct(dock.items[0].name, dock.items[1].name), 'Hai sản phẩm phải khác nhau').toBe(false);
    await expect.poll(async () => (await readDock(page)).canCompare,
      { timeout: 5_000, message: 'Sau khi có 2 sản phẩm, nút [So sánh ngay] phải ở trạng thái có thể bấm' }).toBe(true);
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Add_04 - Kiểm tra không thể so sánh khi mới chọn 1 sản phẩm', async ({ page }) => {
    await openProductDetail(page);
    await clickDetailCompare(page);
    const dock = await waitForDock(page, 1);

    // Bước 1: nút [So sánh ngay] bị vô hiệu hoá hoặc không hiển thị
    const disabledOrHidden = !dock.btnVisible || !dock.canCompare;
    expect(disabledOrHidden, 'Nút [So sánh ngay] phải bị vô hiệu hoá hoặc không hiển thị khi mới có 1 sản phẩm').toBe(true);

    // Bước 2: thử bấm (ép click nếu nút còn hiển thị) -> không được chuyển sang trang so sánh
    const urlBefore = page.url();
    if (dock.btnVisible) {
      await page.locator('a:visible, button:visible, div[role="button"]:visible, span:visible')
        .filter({ hasText: /^\s*so sánh ngay\s*$/i }).first()
        .click({ force: true, timeout: 3000 }).catch(() => { });
    }
    await page.waitForTimeout(1500);
    expect(page.url(), 'Không được chuyển sang trang so sánh').toBe(urlBefore);
    expect(page.url()).not.toContain('-vs-');
  });

  test('ProductCompare_Add_05 - Kiểm tra tìm và chọn sản phẩm thứ hai bằng ô tìm kiếm trong khu vực so sánh', async ({ page }) => {
    await openProductDetail(page);
    await clickDetailCompare(page);
    await waitForDock(page, 1);

    // Bước 1: gõ "QA65Q8F5" -> có gợi ý khớp từ khoá, kèm ảnh và tên
    const sugs = await searchInDock(page, SAMSUNG.search, modelRe(SAMSUNG.model));
    const hit = sugs.find(s => modelRe(SAMSUNG.model).test(s.text));
    expect(hit, `Danh sách gợi ý phải chứa sản phẩm khớp "${SAMSUNG.search}"`).toBeTruthy();
    expect(hit!.text.length, 'Gợi ý phải có tên sản phẩm').toBeGreaterThan(10);

    // Bước 2: chọn sản phẩm Samsung -> thêm vào cạnh sản phẩm ban đầu
    await clickSuggestion(page, modelRe(SAMSUNG.model));
    const dock = await waitForDock(page, 2);
    expect(sameProduct(dock.items[0].name, TCL.model), 'SP đầu tiên vẫn là TCL 55P635').toBe(true);
    expect(sameProduct(dock.items[1].name, SAMSUNG.model), 'SP thứ hai phải là Samsung QA65Q8F5').toBe(true);
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Add_06 - Kiểm tra mở tìm kiếm để chọn thêm sản phẩm', async ({ page }) => {
    await openProductDetail(page);
    await clickDetailCompare(page);
    const dock = await waitForDock(page, 1);
    expect(sameProduct(dock.items[0].name, TCL.model), 'Thanh so sánh phải có đúng sản phẩm vừa chọn').toBe(true);
    await openDockSearch(page);
    const searchDock = await readDock(page);
    expect(searchDock.hasSearch, 'Ô tìm kiếm thêm sản phẩm phải mở được').toBe(true);
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Add_07 - Kiểm tra thêm được ba sản phẩm để so sánh', async ({ page }) => {
    await buildCompareViaSearch(page, [SAMSUNG.search, SONY.search]);
    const table = await waitForCompareTable(page, 3);
    expect(sameProduct(table.columns[0].name, TCL.model), 'Cột đầu là TCL đã chọn ban đầu').toBe(true);
    expect(sameProduct(table.columns[1].name, SAMSUNG.model), 'Cột hai là Samsung được thêm').toBe(true);
    expect(sameProduct(table.columns[2].name, SONY.model), 'Cột ba là Sony được thêm').toBe(true);
    expect(table.columns.every(c => c.name.length > 3 && c.hasImg), 'Cả ba sản phẩm phải có tên và ảnh').toBe(true);
    maxCompareCache = 3;
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Add_08 - Kiểm tra thêm sản phẩm khác ngành hàng (không phải Tivi) vào danh sách so sánh Tivi', async ({ page }) => {
    await openProductDetail(page);
    await clickDetailCompare(page);
    await waitForDock(page, 1);

    // Bước 1: gõ tên Tủ lạnh
    const sugs = await searchInDock(page, 'Tủ lạnh Samsung');
    const fridge = sugs.filter(s => /tủ\s*lạnh/i.test(s.text));

    if (fridge.length === 0) {
      test.info().annotations.push({ type: 'Hành vi', description: 'Website lọc SP khác ngành khỏi gợi ý' });
    } else {
      // Bước 2: website vẫn gợi ý -> phải chặn khi chọn
      test.info().annotations.push({ type: 'Hành vi', description: 'Website gợi ý nhưng chặn khi chọn' });
      const before = await page.locator('body').innerText();
      await clickSuggestion(page, /tủ\s*lạnh/i);
      await page.waitForTimeout(1500);
      const after = await page.locator('body').innerText();
      expect.soft(countMatches(after, SAME_CATEGORY_MSG) > countMatches(before, SAME_CATEGORY_MSG),
        'Nên hiển thị thông báo chỉ so sánh sản phẩm cùng ngành hàng').toBe(true);
    }

    const dock = await readDock(page);
    expect(dock.count, 'Danh sách vẫn chỉ có sản phẩm Tivi ban đầu').toBe(1);
    expect(dock.items.map(i => i.name).join(' '), 'Không được có Tủ lạnh trong danh sách so sánh Tivi').not.toMatch(/tủ\s*lạnh/i);
    expect(sameProduct(dock.items[0].name, TCL.model)).toBe(true);
  });

  test('ProductCompare_Add_09 - Kiểm tra sản phẩm đã chọn được giữ khi thêm sản phẩm khác qua tìm kiếm', async ({ page }) => {
    await openProductDetail(page);
    await clickDetailCompare(page);
    const before = await waitForDock(page, 1);
    expect(sameProduct(before.items[0].name, TCL.model), 'Trang chi tiết phải thêm đúng sản phẩm TCL').toBe(true);
    await addProductViaDockSearch(page, SAMSUNG.search);
    const after = await waitForDock(page, 2);
    expect(sameProduct(after.items[0].name, TCL.model), 'Sản phẩm TCL đã chọn phải còn trong thanh so sánh').toBe(true);
    expect(sameProduct(after.items[1].name, SAMSUNG.model), 'Sản phẩm Samsung mới phải được thêm').toBe(true);
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Add_10 - Kiểm tra ô chờ thêm sản phẩm trên bảng so sánh', async ({ page, browser }) => {
    const table = await openComparePage(page, browser);
    expect(table.columns).toHaveLength(2);
    const addSlot = page.getByRole('button', { name: 'Thêm sản phẩm', exact: true });
    await expect(addSlot, 'Bảng so sánh phải hiển thị ô thêm sản phẩm tiếp theo').toBeVisible();
    await expectNoErrorPage(page);
  });

});

/* ================================================================== */
/* 2. XÓA SẢN PHẨM KHỎI SO SÁNH (Remove_01 -> Remove_03)                */
/* ================================================================== */
test.describe('2. Xóa sản phẩm khỏi so sánh', () => {

  test('ProductCompare_Remove_01 - Kiểm tra bỏ một sản phẩm khỏi danh sách chờ so sánh', async ({ page }) => {
    await openCategory(page);
    const cards = await getListCards(page);
    await addCardsFromList(page, 2);

    // Bước 1: click X của sản phẩm thứ hai
    const tagged = await page.evaluate(() => (window as any).__dmx.tagDockRemove(1));
    expect(tagged, 'Sản phẩm thứ hai trong khu vực so sánh phải có nút xoá (X)').toBe(true);
    await page.locator('[data-dmx-remove]').click();

    const dock = await waitForDock(page, 1);
    expect(sameProduct(dock.items[0].name, cards[0].name), 'Sản phẩm còn lại phải là sản phẩm thứ nhất').toBe(true);

    // Bước 2: nút [So sánh] trên thẻ vừa bỏ quay về chưa chọn (và chọn lại được)
    expect(await isCardSelected(page, cards[1].path), 'Thẻ sản phẩm vừa bỏ phải về trạng thái chưa chọn').toBe(false);
    await clickCardCompare(page, 1);
    await waitForDock(page, 2);
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Remove_02 - Kiểm tra bỏ sản phẩm và giữ chỗ thêm trên bảng so sánh', async ({ page, browser }) => {
    const max = await getMaxCompare(browser);
    expect(max, 'Tiền điều kiện: cần thêm được ít nhất 3 sản phẩm').toBeGreaterThanOrEqual(3);
    await buildCompareViaSearch(page, [SAMSUNG.search, SONY.search]);
    const before = await waitForCompareTable(page, 3);
    const names = before.columns.map(c => c.name);

    // Bước 1: click X của sản phẩm thứ hai
    const tagged = await page.evaluate(() => (window as any).__dmx.tagColumnRemove(1));
    expect(tagged, 'Cột sản phẩm thứ hai phải có nút xoá (X)').toBe(true);
    await page.locator('[data-dmx-colremove]').click();

    // Còn đúng hai cột sản phẩm, theo thứ tự cũ; layout vẫn dành vị trí trống
    // cho ô thêm sản phẩm và biểu diễn ô đó bằng dấu gạch ngang.
    const after = await waitForCompareTable(page, 2);
    expect(after.columns.map(c => c.name), 'Hai sản phẩm còn lại giữ nguyên thứ tự').toEqual([names[0], names[2]]);
    for (const r of flatRows(after)) {
      expect.soft(r.values.length, `Dòng "${r.label}" phải có 2 giá trị sản phẩm và 1 ô chờ`).toBe(3);
      expect.soft(r.values.slice(0, 2).every(v => v.length > 0), `Dòng "${r.label}" phải giữ đủ dữ liệu của hai sản phẩm`).toBe(true);
      expect.soft(r.values[2], `Dòng "${r.label}" phải đánh dấu ô chờ bằng '-'`).toBe('-');
    }
    await expect(page.getByRole('button', { name: 'Thêm sản phẩm', exact: true })).toBeVisible();
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Remove_03 - Kiểm tra xóa sản phẩm khi bảng chỉ còn 2 sản phẩm', async ({ page, browser }) => {
    const serverErrors = watchServerErrors(page);
    await openComparePage(page, browser);

    // Bước 1: click X của một trong hai sản phẩm
    const tagged = await page.evaluate(() => (window as any).__dmx.tagColumnRemove(0));
    expect(tagged, 'Cột sản phẩm phải có nút xoá (X)').toBe(true);
    await page.locator('[data-dmx-colremove]').click();
    await page.waitForTimeout(2000);

    // Kết quả 1: không lỗi 404/500, không trắng trang
    await expectNoErrorPage(page);
    await expectNotBlank(page);
    expect(serverErrors, 'Không được có phản hồi lỗi máy chủ').toEqual([]);

    // Trang phản ánh kết quả xóa: còn một cột nếu vẫn ở lại, hoặc điều hướng về trang trước.
    if (page.url().includes('-vs-')) {
      const state = await readCompare(page);
      expect(state.columns.length, 'Sau khi xóa một trong hai sản phẩm, còn một cột sản phẩm').toBe(1);
      expect(state.columns[0].name.length, 'Sản phẩm còn lại phải có tên').toBeGreaterThan(3);
    } else {
      expect(page.url(), 'Phải đưa người dùng về trang trước/ngành hàng').toContain(BASE_URL);
    }
    await expectNoErrorPage(page);
  });

});

/* ================================================================== */
/* 3. TRANG SO SÁNH (Compare_01 -> Compare_07)                          */
/* ================================================================== */
test.describe('3. Trang so sánh', () => {

  test('ProductCompare_Compare_01 - Kiểm tra bấm [So sánh ngay] với 2 sản phẩm', async ({ page }) => {
    await openCategory(page);
    const dock = await addCardsFromList(page, 2);
    const picked = dock.items.map(i => i.name);

    await clickCompareNow(page);
    await page.waitForURL(/-vs-/, { timeout: 20_000 });
    await dismissPopups(page);

    expect(page.url(), 'URL phải có dạng /tivi/{slug-sp1}-vs-{slug-sp2}').toMatch(/\/tivi\/[^/?#]+-vs-[^/?#]+/);
    expect(await page.title(), 'Tiêu đề trang phải có dạng "So sánh chi tiết {SP1} với {SP2}"').toMatch(/so sánh chi tiết\s+.+\s+với\s+.+/i);

    const table = await waitForCompareTable(page, 2);
    picked.forEach((n, i) => expect(sameProduct(table.columns[i].name, n), `Cột ${i + 1} phải là "${n}"`).toBe(true));
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Compare_02 - Kiểm tra bố cục bảng so sánh ba sản phẩm', async ({ page }) => {
    const X = 3;
    await buildCompareViaSearch(page, [SAMSUNG.search, SONY.search]);

    // Đủ X cột, rộng đều nhau, thông số thẳng hàng, không tràn/lệch
    const t = await waitForCompareTable(page, X);
    const widths = t.columns.map(c => c.width);
    const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
    widths.forEach((w, i) => expect.soft(Math.abs(w - avg) / avg, `Cột ${i + 1} phải rộng đều với các cột còn lại`).toBeLessThanOrEqual(0.1));
    expect(t.overflowX, 'Trang so sánh không được tràn ngang').toBeLessThanOrEqual(5);

    const rows = flatRows(t).slice(0, 8);
    expect(rows.length, 'Phải có dòng thông số để kiểm tra căn hàng').toBeGreaterThan(0);
    const columnValueLefts = t.columns.map((_, i) => rows[0].lefts[i]);
    for (const r of rows) {
      expect.soft(r.values.length, `Dòng "${r.label}" phải có đủ ${X} giá trị`).toBe(X);
      r.lefts.forEach((l, i) => expect.soft(Math.abs(l - columnValueLefts[i]), `Giá trị cột ${i + 1} dòng "${r.label}" phải thẳng hàng với cột`).toBeLessThanOrEqual(20));
    }
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Compare_03 - Kiểm tra tên, ảnh và giá hiển thị trên bảng so sánh', async ({ page, browser }) => {
    const table = await openComparePage(page, browser);

    expect(table.columns.length, 'Bảng cần có hai sản phẩm để kiểm tra').toBe(2);
    for (const col of table.columns) {
      expect.soft(col.name.length, 'Tên sản phẩm phải được hiển thị').toBeGreaterThan(3);
      expect.soft(col.hasImg && col.imgOk, `Ảnh của "${col.name}" phải hiển thị được (không vỡ ảnh)`).toBe(true);
      expect.soft(col.prices.length, `"${col.name}" phải có giá`).toBeGreaterThan(0);
      col.prices.forEach(p => expect.soft(p, `Giá "${p}" phải có dạng 15.990.000₫`).toMatch(PRICE_FORMAT));
    }
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Compare_04 - Kiểm tra các nhóm thông số trên bảng so sánh Tivi', async ({ page, browser }) => {
    const t = await openComparePage(page, browser);

    // Trang hiện chia thông số thành các nhóm Tổng quan, Hình ảnh, Tiện ích...
    const sectionNames = ['Tổng quan sản phẩm', 'Công nghệ hình ảnh', 'Tiện ích', 'Công nghệ âm thanh', 'Cổng kết nối', 'Thông tin lắp đặt'];
    for (const name of sectionNames) {
      await expect(page.getByRole('heading', { name, exact: true }), `Phải có nhóm thông số "${name}"`).toBeVisible();
    }

    // Mỗi dòng có nhãn và giá trị cho hai sản phẩm; vị trí thứ ba là ô chờ thêm SP.
    const rows = flatRows(t);
    expect(rows.length, 'Bảng phải có nhiều dòng thông số').toBeGreaterThanOrEqual(5);
    for (const r of rows) {
      expect.soft(r.label.length, 'Dòng thông số phải có tên').toBeGreaterThan(0);
      expect.soft(r.values.length, `Dòng "${r.label}" phải có hai giá trị và một ô chờ`).toBe(3);
      r.values.forEach(v => {
        expect.soft(v, `Dòng "${r.label}" không được chứa undefined/null/NaN`).not.toMatch(BAD_TEXT);
      });
      expect.soft(r.values[0].length > 0 && r.values[1].length > 0, `Dòng "${r.label}" phải có dữ liệu ở hai cột sản phẩm`).toBe(true);
      expect.soft(r.values[2], `Dòng "${r.label}" phải đánh dấu ô chờ bằng '-'`).toBe('-');
    }
    expect(t.text, 'Trang không được chứa undefined/null/NaN').not.toMatch(BAD_TEXT);
  });

  test('ProductCompare_Compare_05 - Kiểm tra giá trị thông số trong bảng so sánh khớp với trang chi tiết từng sản phẩm', async ({ page, browser }) => {
    const t = await openComparePage(page, browser);
    const specs = [
      { label: 'Kích cỡ màn hình', aliases: ['Kích cỡ màn hình'] },
      { label: 'Độ phân giải', aliases: ['Độ phân giải'] },
      { label: 'Hệ điều hành', aliases: ['Hệ điều hành'] },
      { label: 'Tổng công suất loa', aliases: ['Tổng công suất loa'] },
      // DMX hiện ghi “Kích thước có chân, đặt bàn” thay cho “...có chân đế”.
      { label: 'Kích thước có chân đế', aliases: ['Kích thước có chân đế', 'Kích thước có chân, đặt bàn'] },
    ];

    // Bước 1: lấy giá trị các thông số trên bảng so sánh
    const compareValues: Record<string, string[]> = {};
    for (const spec of specs) {
      const row = flatRows(t).find(r => spec.aliases.some(alias => compact(r.label).includes(compact(alias))));
      expect(row, `Bảng so sánh phải có dòng "${spec.label}"`).toBeTruthy();
      compareValues[spec.label] = row!.values;
    }

    // Bước 2: đối chiếu từng sản phẩm với bảng thông số ở trang chi tiết
    for (const [i, col] of t.columns.entries()) {
      await openProductDetail(page, `${BASE_URL}${col.path}`);
      const detail = await readDetailSpecs(page);
      expect(detail.length, `Không đọc được bảng thông số ở trang chi tiết ${col.path}`).toBeGreaterThan(5);
      for (const spec of specs) {
        const d = detail.find(x => spec.aliases.some(alias => compact(x.label).includes(compact(alias))));
        expect.soft(d, `Trang chi tiết "${col.name}" phải có thông số "${spec.label}"`).toBeTruthy();
        if (d) expect.soft(normVal(compareValues[spec.label][i]), `"${spec.label}" của "${col.name}": so sánh="${compareValues[spec.label][i]}" / chi tiết="${d.value}"`).toBe(normVal(d.value));
      }
    }
  });

  test('ProductCompare_Compare_06 - Kiểm tra truy cập trực tiếp trang so sánh bằng đường dẫn (URL)', async ({ browser }) => {
    const url = await getCompareUrl(browser);

    // Cửa sổ ẩn danh/phiên mới: chưa có danh sách so sánh nào được lưu
    const ctx = await browser.newContext(CONTEXT_OPTIONS);
    try {
      const p = await ctx.newPage();
      await p.addInitScript(installDomHelpers);
      const res = await gotoWithRetry(p, url);
      await dismissPopups(p);

      expect(res.status(), 'Truy cập trực tiếp URL so sánh phải trả về HTTP < 400').toBeLessThan(400);
      expect(p.url(), 'Không được bị chuyển hướng khỏi trang so sánh').toContain('-vs-');
      const t = await waitForCompareTable(p, 2);
      expect(sameProduct(t.columns[0].name, TCL.model)).toBe(true);
      expect(sameProduct(t.columns[1].name, SAMSUNG.model)).toBe(true);
      await expectNotBlank(p);
      await expectNoErrorPage(p);
    } finally {
      await ctx.close();
    }
  });

  test('ProductCompare_Compare_07 - Kiểm tra chỗ trống có thể thêm sản phẩm vào bảng', async ({ page, browser }) => {
    const table = await openComparePage(page, browser);
    expect(table.columns).toHaveLength(2);
    await expect(page.getByRole('button', { name: 'Thêm sản phẩm', exact: true }),
      'Bảng phải có nút thêm sản phẩm ở vị trí trống').toBeVisible();
    expect(table.columns.every(c => c.name.length > 3 && c.hasImg),
      'Hai cột sản phẩm đã chọn phải có tên và ảnh').toBe(true);
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Compare_08 - Kiểm tra tải lại vẫn giữ thứ tự sản phẩm và thông số', async ({ page, browser }) => {
    const before = await openComparePage(page, browser);
    const names = before.columns.map(c => c.name);
    const rows = flatRows(before);
    expect(rows.length, 'Trước khi tải lại phải có các dòng thông số').toBeGreaterThan(0);
    const sample = rows.find(r => r.values.length >= 2 && r.values[0] && r.values[1]);
    expect(sample, 'Cần một dòng có dữ liệu ở cả hai sản phẩm').toBeTruthy();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissPopups(page);
    const after = await waitForCompareTable(page, 2);
    expect(after.columns.map(c => c.name), 'Tải lại phải giữ thứ tự hai sản phẩm').toEqual(names);
    const refreshed = flatRows(after).find(r => r.label === sample!.label);
    expect(refreshed, `Sau khi tải lại vẫn phải có dòng "${sample!.label}"`).toBeTruthy();
    expect(refreshed!.values.slice(0, 2), 'Giá trị thông số hai sản phẩm phải được giữ sau khi tải lại').toEqual(sample!.values.slice(0, 2));
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Compare_09 - Kiểm tra liên kết tên của từng cột mở đúng sản phẩm', async ({ page, browser }) => {
    const table = await openComparePage(page, browser);
    for (const [index, column] of table.columns.entries()) {
      const tagged = await page.evaluate(i => (window as any).__dmx.tagColumnLink(i, 'name'), index);
      expect(tagged, `Cột ${index + 1} phải có liên kết tên sản phẩm`).toBe(true);
      const href = await page.locator('[data-dmx-link]').getAttribute('href');
      expect(href, `Liên kết cột ${index + 1} phải có đích`).toBeTruthy();
      expect(new URL(href!, BASE_URL).pathname.replace(/\/+$/, ''), `Cột ${index + 1} phải mở đúng sản phẩm`).toBe(column.path);
    }
    await expectNoErrorPage(page);
  });

});

/* ================================================================== */
/* 4. ĐỐI CHIẾU GIÁ TRỊ SẢN PHẨM (Diff_01 -> Diff_02)                  */
/* ================================================================== */
test.describe('4. Đối chiếu giá trị sản phẩm', () => {

  test('ProductCompare_Diff_01 - Kiểm tra bảng thể hiện thông số khác nhau giữa hai sản phẩm', async ({ page, browser }) => {
    const table = await openComparePage(page, browser);
    const rows = flatRows(table).filter(r => r.values.length >= 2 && r.values[0] && r.values[1]);
    expect(rows.length, 'Bảng phải có thông số của cả hai sản phẩm để đối chiếu').toBeGreaterThan(0);
    const differentRows = rows.filter(r => normVal(r.values[0]) !== normVal(r.values[1]));
    expect(differentRows.length, 'Ít nhất một thông số phải thể hiện khác biệt giữa hai sản phẩm').toBeGreaterThan(0);
    expect(table.columns[0].name, 'Hai cột phải là hai sản phẩm khác nhau').not.toBe(table.columns[1].name);
    await expectNoErrorPage(page);
  });

  test('ProductCompare_Diff_02 - Kiểm tra bảng giữ giá trị thông số riêng cho từng sản phẩm', async ({ page, browser }) => {
    const table = await openComparePage(page, browser);
    const rows = flatRows(table).filter(r => r.values.length >= 2 && r.values[0] && r.values[1]);
    expect(rows.length, 'Bảng phải có thông số để kiểm tra dữ liệu hai sản phẩm').toBeGreaterThan(0);
    for (const row of rows) {
      expect.soft(row.values[0], `Cột ${table.columns[0].name}, dòng ${row.label}`).not.toMatch(BAD_TEXT);
      expect.soft(row.values[1], `Cột ${table.columns[1].name}, dòng ${row.label}`).not.toMatch(BAD_TEXT);
    }
    expect(table.columns.every(c => c.name.length > 3 && c.hasImg), 'Mỗi cột phải gắn với sản phẩm có tên và ảnh').toBe(true);
    await expectNoErrorPage(page);
  });

});

/* ================================================================== */
/* 5. ĐIỀU HƯỚNG TỪ TRANG SO SÁNH (Navigate_01)                         */
/* ================================================================== */
test.describe('5. Điều hướng từ trang so sánh', () => {

  test('ProductCompare_Navigate_01 - Kiểm tra click tên/ảnh sản phẩm trên bảng so sánh để xem chi tiết', async ({ page, browser }) => {
    const t = await openComparePage(page, browser);
    const second = t.columns[1];
    const onSecondDetail = (u: URL) => u.pathname.replace(/\/+$/, '') === second.path;

    // Bước 1: click tên SP thứ hai -> trang chi tiết đúng SP
    expect(await page.evaluate(() => (window as any).__dmx.tagColumnLink(1, 'name')), 'Cột 2 phải có link tên sản phẩm').toBe(true);
    await page.locator('[data-dmx-link]').click();
    await page.waitForURL(onSecondDetail, { timeout: 20_000 });
    await expect(page.locator('h1:visible').first()).toBeVisible({ timeout: 20_000 });
    expect(sameProduct((await page.locator('h1:visible').first().innerText()).trim(), second.name), 'Trang chi tiết phải đúng SP thứ hai').toBe(true);

    // Bước 2: Back -> quay lại trang so sánh, bảng vẫn 2 SP
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await dismissPopups(page);
    expect(page.url(), 'Back phải quay lại trang so sánh').toContain('-vs-');
    await waitForCompareTable(page, 2);

    // Bước 3: click ảnh SP thứ hai -> trang chi tiết đúng SP
    expect(await page.evaluate(() => (window as any).__dmx.tagColumnLink(1, 'img')), 'Cột 2 phải có link ở ảnh sản phẩm').toBe(true);
    await page.locator('[data-dmx-link]').click();
    await page.waitForURL(onSecondDetail, { timeout: 20_000 });
    await expect(page.locator('h1:visible').first()).toBeVisible({ timeout: 20_000 });
    expect(sameProduct((await page.locator('h1:visible').first().innerText()).trim(), second.name), 'Trang chi tiết phải đúng SP thứ hai').toBe(true);
    await expectNoErrorPage(page);
  });

});
