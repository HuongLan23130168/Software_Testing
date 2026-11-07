/**
 * ============================================================================
 * ASSIGNMENT 7 - KIỂM THỬ TỰ ĐỘNG VỚI PLAYWRIGHT
 * Sinh viên: Trần Thị Mỹ Trâm
 * Mã sinh viên: 23130340
 * Chức năng kiểm thử: 6.5.1 Giỏ hàng (Module CART)
 * Website kiểm thử: https://www.dienmayxanh.com/
 * Framework: Playwright (JavaScript) - File chạy độc lập (Standalone Script)
 *
 * Script bám theo sheet "Giỏ hàng" trong Group11_23130340_TranThiMyTram.xlsx:
 * mỗi test = 1 Test Case ID, dùng đúng sản phẩm (SP A/B/C), các bước và kết quả mong đợi trong Excel.
 * Những bước KHÔNG tự động hóa được (nhìn bằng mắt, cần OTP, phụ thuộc dữ liệu thật) được ghi bằng
 * test.info().annotations (type "manual") và nêu rõ trong cột Note của Excel.
 * Nguyên tắc an toàn: không nhập mã SMS, không gửi đơn, không tạo đơn thật.
 * Không dùng DOM/cookie giả: test nào không thể kiểm tra trên website thật thì khai báo test.skip (Blocked).
 * ============================================================================
 */
 
const { test, expect, devices } = require('@playwright/test'); 
/* ============================================================================
 * 1. CẤU HÌNH DỮ LIỆU KIỂM THỬ (TEST DATA)
 * ============================================================================ */
const BASE_URL = 'https://www.dienmayxanh.com';
const CART_URL = `${BASE_URL}/gio-hang`;
const CATEGORY_URL = `${BASE_URL}/noi-com-dien`;
 
const PRODUCTS = {
  // SP A: Sản phẩm Flash sale
  A: { key: 'A', url: `${BASE_URL}/noi-com-dien/noi-com-dien-tu-sunhouse-18-lit-shd8911` },
  // SP B: Sản phẩm có giảm giá & quà tặng kèm
  B: { key: 'B', url: `${BASE_URL}/noi-com-dien/noi-com-dien-tu-kangaroo-18-lit-kgrc18d3g` },
  // SP C: Sản phẩm thông thường (không Flash sale, dùng cho đa số test để chạy ổn định)
  C: { key: 'C', url: `${BASE_URL}/pin/pin-aaa-2-vien-alkaline-panasonic-lr03t` },
};
 
/* ============================================================================
 * 2. ĐỊNH DANH PHẦN TỬ GIAO DIỆN (LOCATORS)
 * ============================================================================ */
const L = {
  // Header
  HEADER_CART: 'a[href="/gio-hang"]',
  HEADER_LOGIN: 'a[href*="/dang-nhap"]',
 
  // Trang chi tiết sản phẩm
  PRODUCT_TITLE: 'h1',
  PRODUCT_PRICE: 'span.text-24.font-700.text-red-5, .box-price-present, .price',
  ADD_TO_CART_BTN: 'button:has-text("Thêm vào giỏ")',
  BUY_NOW_BTN: 'button:has-text("Mua ngay")',
  TOAST_MSG: 'text=Đã thêm vào giỏ hàng',
 
  // Trang giỏ hàng
  EMPTY_TITLE: 'text="Giỏ hàng trống"',
  EMPTY_DESC: 'text="Không có sản phẩm nào trong giỏ hàng"',
  BACK_HOME_BUTTON: 'a:has-text("Về trang chủ")',
  ORDER_BUTTON: 'button:has-text("Đặt mua")',
  CART_ITEMS: 'input[name="item-cart-select"]',
  QTY_INPUT: 'input[inputmode="numeric"]',
 
  // Hộp thoại xác nhận xóa
  CONFIRM_DELETE_TEXT: 'Bạn chắc chắn muốn xóa sản phẩm này?',
 
  // Hộp thoại thông tin đặt hàng
  ORDER_DIALOG_TITLE: 'text="Thông tin đặt hàng"',
  PROVIDE_INFO_LINK: 'text="Vui lòng cung cấp thông tin nhận hàng"',
};
 
/* ============================================================================
 * 3. CÁC HÀM TIỆN ÍCH THAO TÁC (HELPER FUNCTIONS)
 * ============================================================================ */
 
/** Ghi chú bước cần làm thủ công vào báo cáo */
function manual(description) {
  test.info().annotations.push({ type: 'manual', description });
}
 
/**
 * Tự đóng popup quảng cáo (lớp nền tối bg-[#1E1E1E]) mỗi khi nó chặn thao tác.
 * Đã được gọi tự động cho `page` mặc định trong beforeEach (đầu describe).
 * Test nào tự tạo page mới (newPage / newContext) thì gọi thêm: await registerPopupHandler(pageMoi);
 */
async function registerPopupHandler(page) {
  const overlay = page.locator('div.cursor-pointer[class*="bg-[#1E1E1E]"]').first();
  await page.addLocatorHandler(
    overlay,
    async () => {
      await page.keyboard.press('Escape');
      if (await overlay.isVisible().catch(() => false)) {
        // click góc trên-trái của vùng tối, nằm ngoài popup ở giữa
        await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
      }
    },
    { noWaitAfter: true }
  );
}
 
/** 790000 -> "790.000" */
function fmt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
 
/** Mở trang chi tiết sản phẩm */
async function openProduct(page, key = 'C') {
  const prod = PRODUCTS[key] || { url: key };
  await page.goto(prod.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
}
 
/** Lấy tên sản phẩm trên trang chi tiết */
async function getProductName(page) {
  const el = page.locator(L.PRODUCT_TITLE).first();
  await el.waitFor({ state: 'visible', timeout: 10000 });
  return (await el.innerText()).trim();
}
 
/** Lấy đơn giá sản phẩm trên trang chi tiết (VND) */
async function getProductPrice(page) {
  const el = page.locator(L.PRODUCT_PRICE).first();
  await el.waitFor({ state: 'visible', timeout: 10000 });
  const text = await el.innerText();
  return parseInt(text.replace(/[^\d]/g, ''), 10);
}
 
/** Thêm sản phẩm vào giỏ từ trang chi tiết */
async function addToCart(page) {
  const btn = page.locator(L.ADD_TO_CART_BTN).first();
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  await btn.scrollIntoViewIfNeeded();
 
  await Promise.all([
    page.waitForResponse(
      res => res.url().includes('Cart/product/add') || res.url().includes('Cart/get-basic-info'),
      { timeout: 10000 }
    ).catch(() => {}),
    btn.click(),
  ]);
  await page.waitForTimeout(2000);
}
 
/** Mở trang chi tiết, ghi nhận tên + giá, rồi thêm vào giỏ. Trả về { key, name, price, model } */
async function addProductAndCollect(page, key) {
  await openProduct(page, key);
  const name = await getProductName(page);
  const price = await getProductPrice(page);
  await addToCart(page);
  return { key, name, price, model: name.trim().split(/\s+/).pop() };
}
 
/** Mở giỏ hàng bằng biểu tượng trên header */
async function openCartFromHeader(page) {
  const headerCart = page.locator(L.HEADER_CART).first();
  await headerCart.waitFor({ state: 'visible', timeout: 10000 });
  await Promise.all([
    page.waitForURL(/\/gio-hang(\?.*)?$/, { timeout: 15000 }).catch(() => {}),
    headerCart.click(),
  ]);
  await page.waitForTimeout(2500);
}
 
/** Mở giỏ hàng trực tiếp bằng URL */
async function openCartDirect(page) {
  await page.goto(CART_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
}
 
/** Đếm số dòng sản phẩm trong giỏ */
async function getCartItemCount(page) {
  await Promise.race([
    page.locator(L.QTY_INPUT).first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
    page.locator(L.EMPTY_TITLE).first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
  ]);
 
  const emptyCount = await page.locator(L.EMPTY_TITLE).count();
  if (emptyCount > 0 && (await page.locator(L.EMPTY_TITLE).first().isVisible())) {
    return 0;
  }
  const selectCheckboxes = await page.locator(L.CART_ITEMS).count();
  if (selectCheckboxes > 0) return selectCheckboxes;
  return await page.locator(L.QTY_INPUT).count();
}
 
/** Lấy số lượng của sản phẩm tại dòng index */
async function getCartQty(page, index = 0) {
  const input = page.locator(L.QTY_INPUT).nth(index);
  await input.waitFor({ state: 'visible', timeout: 10000 });
  return parseInt(await input.inputValue(), 10);
}
 
/** Văn bản của cả dòng sản phẩm tại index (đi lên các phần tử cha tới khi có ảnh và giá tiền) */
async function getCartRowText(page, index = 0) {
  const input = page.locator(L.QTY_INPUT).nth(index);
  return input.evaluate(el => {
    const money = /\d{1,3}(?:\.\d{3})+\s*[₫đ]/;
    let node = el.parentElement;
    while (node && node !== document.body) {
      if (node.querySelector('img') && money.test(node.innerText || '')) return node.innerText;
      node = node.parentElement;
    }
    return '';
  });
}
 
/** Tìm dòng trong giỏ theo mã model của sản phẩm (từ cuối tên), trả về index hoặc -1 */
async function findCartRow(page, product) {
  const n = await page.locator(L.QTY_INPUT).count();
  for (let i = 0; i < n; i++) {
    const text = (await getCartRowText(page, i)).toLowerCase();
    if (text.includes(product.model.toLowerCase())) return i;
  }
  return -1;
}
 
/** Lấy đơn giá của sản phẩm tại dòng index trong giỏ */
async function getCartUnitPrice(page, index = 0) {
  const text = await getCartRowText(page, index);
  const match = text.match(/(\d{1,3}(?:\.\d{3})+)\s*[₫đ]/);
  return match ? parseInt(match[1].replace(/\./g, ''), 10) : 0;
}
 
/** Lấy tổng tiền hiển thị trong giỏ */
async function getCartSubtotal(page) {
  const totalText = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('*')).filter(el => {
      const t = el.innerText || '';
      return el.children.length === 0 && (t.includes('Tổng thanh toán') || t.includes('Tổng tiền hàng'));
    });
    for (const el of candidates) {
      const parent = el.parentElement;
      if (parent) {
        const match = parent.innerText.match(/(\d{1,3}(?:\.\d{3})+)\s*[₫đ]/);
        if (match) return match[1];
      }
    }
    return '0';
  });
  return parseInt(totalText.replace(/[^\d]/g, ''), 10) || 0;
}
 
/** Lấy số lượng trên badge giỏ hàng ở header */
async function getHeaderCartBadge(page) {
  const headerCart = page.locator(L.HEADER_CART).first();
  await headerCart.waitFor({ state: 'visible', timeout: 10000 });
  const text = await headerCart.innerText();
  const digits = text.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
 
/** Nút bên trái ô số lượng ([−] khi SL>=2, thùng rác khi SL=1) */
function leftBtn(page, index = 0) {
  return page.locator(L.QTY_INPUT).nth(index).locator('..').locator('button').first();
}
 
/** Nút [+] bên phải ô số lượng */
function plusBtn(page, index = 0) {
  return page.locator(L.QTY_INPUT).nth(index).locator('..').locator('button').last();
}
 
/** Tăng số lượng (+) tại dòng index */
async function increaseCartQty(page, index = 0) {
  const current = await getCartQty(page, index);
 
  await page.waitForTimeout(1000);
  await plusBtn(page, index).click();
 
  const increased = await expect.poll(async () => getCartQty(page, index), { timeout: 3500 })
    .toBe(current + 1).then(() => true).catch(() => false);
 
  // Chỉ bấm lại khi số lượng THỰC SỰ chưa đổi (tránh tăng 2 lần)
  if (!increased && (await getCartQty(page, index)) === current) {
    await plusBtn(page, index).click({ force: true });
  }
  await expect.poll(async () => getCartQty(page, index), { timeout: 8000 }).toBe(current + 1);
  await page.waitForTimeout(1500);
}
 
/** Giảm số lượng (−) tại dòng index */
async function decreaseCartQty(page, index = 0) {
  const current = await getCartQty(page, index);
 
  await page.waitForTimeout(1000);
  await leftBtn(page, index).click();
 
  const decreased = await expect.poll(async () => getCartQty(page, index), { timeout: 3500 })
    .toBe(current - 1).then(() => true).catch(() => false);
 
  if (!decreased && (await getCartQty(page, index)) === current) {
    await leftBtn(page, index).click({ force: true });
  }
  await expect.poll(async () => getCartQty(page, index), { timeout: 8000 }).toBe(current - 1);
  await page.waitForTimeout(1500);
}
 
/** Bấm thùng rác -> hộp thoại xác nhận -> Xóa (confirm=true) hoặc Hủy (confirm=false) */
async function deleteCartItem(page, index = 0, confirm = true) {
  await leftBtn(page, index).click();
 
  const prompt = page.getByText(L.CONFIRM_DELETE_TEXT).first();
  await prompt.waitFor({ state: 'visible', timeout: 5000 });
 
  if (confirm) {
    const confirmBtn = page.locator('button').filter({ hasText: /^Xoá$|^Xóa$/ }).first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmBtn.click();
  } else {
    const cancelBtn = page.locator('button').filter({ hasText: /^Hủy$/ }).first();
    await cancelBtn.waitFor({ state: 'visible', timeout: 5000 });
    await cancelBtn.click();
  }
  await page.waitForTimeout(2000);
}
 
/** Nhập trực tiếp số lượng vào ô input */
async function typeCartQty(page, val, index = 0) {
  const input = page.locator(L.QTY_INPUT).nth(index);
  await input.click();
  await input.fill(String(val));
  await input.press('Enter');
  await page.evaluate(el => el.blur(), await input.elementHandle());
  await page.waitForTimeout(2000);
}
 
/**
 * Dò giới hạn số lượng tối đa của sản phẩm ở dòng index: nhập 99999 (website tự ép về mức tối đa),
 * đọc số lượng, rồi đặt lại 1. Sản phẩm Flash sale thường chỉ cho mua tối đa vài suất.
 */
async function probeMaxQty(page, index = 0) {
  await typeCartQty(page, '99999', index);
  const max = await getCartQty(page, index);
  await typeCartQty(page, '1', index);
  await expect.poll(async () => getCartQty(page, index), { timeout: 8000 }).toBe(1);
  test.info().annotations.push({ type: 'max-qty', description: `Giới hạn tối đa ở dòng ${index} = ${max}` });
  return max;
}
 
/** Nhập số lượng và đồng thời theo dõi thông báo (thông báo có thể tự ẩn trong lúc chờ) */
async function typeQtyAndWatchMessage(page, val, pattern, index = 0) {
  const watcher = page.getByText(pattern).filter({ visible: true }).first()
    .waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
  await typeCartQty(page, val, index);
  return watcher;
}
 
/** Thêm các sản phẩm vào giỏ, mở trang giỏ hàng. Trả về thông tin từng sản phẩm theo key */
async function seedCart(page, keys = ['C']) {
  const info = {};
  for (const k of keys) info[k] = await addProductAndCollect(page, k);
  await openCartDirect(page);
 
  const itemInput = page.locator(L.QTY_INPUT).first();
  const isLoaded = await itemInput.waitFor({ state: 'visible', timeout: 7000 }).then(() => true).catch(() => false);
  if (!isLoaded) {
    await page.waitForTimeout(2000);
    await openCartDirect(page);
    await itemInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  }
  return info;
}
 
/** Chiều rộng trang vượt khung nhìn (px). <= 1 nghĩa là không cuộn ngang */
async function horizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
 
/**
 * Đo mức độ thông báo "Đã thêm vào giỏ hàng" che các nút có chữ `label` đang nằm trong khung nhìn.
 * Trả về { found, ratios }: mỗi phần tử trong ratios là tỉ lệ diện tích một nút bị che (0 đến 1).
 */
async function toastOverlap(page, label) {
  return page.evaluate((text) => {
    const leaves = [...document.querySelectorAll('*')].filter(
      el => el.children.length === 0 && (el.textContent || '').includes('Đã thêm vào giỏ hàng'));
    if (!leaves.length) return { found: false, ratios: [] };
    let box = leaves[0];
    while (box && box !== document.body && !(box.textContent || '').includes('Xem giỏ hàng')) box = box.parentElement;
    const t = box.getBoundingClientRect();
    const ratios = [];
    for (const el of document.querySelectorAll('button, a')) {
      if (!(el.textContent || '').includes(text) || box.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom <= 0 || r.top >= window.innerHeight) continue;
      const w = Math.max(0, Math.min(r.right, t.right) - Math.max(r.left, t.left));
      const h = Math.max(0, Math.min(r.bottom, t.bottom) - Math.max(r.top, t.top));
      ratios.push(Number(((w * h) / (r.width * r.height)).toFixed(2)));
    }
    return { found: true, ratios };
  }, label);
}
 
/** Nút có thể bấm được (không bị che) không */
async function isClickable(locator) {
  return locator.click({ trial: true, timeout: 1500 }).then(() => true).catch(() => false);
}
 
/** Quy ước đếm của biểu tượng giỏ hàng: 'lines' (số dòng), 'qty' (tổng số lượng) hoặc 'unknown' */
function badgeConvention(badge, lines, totalQty) {
  if (lines === totalQty) return 'same';
  if (badge === lines) return 'lines';
  if (badge === totalQty) return 'qty';
  return 'unknown';
}
 
/* ============================================================================
 * 4. KỊCH BẢN KIỂM THỬ: 6.5.1 GIỎ HÀNG (MODULE CART)
 * ============================================================================ */
 
test.describe('6.5.1 Giỏ hàng - 23130340_TranThiMyTram_ASM7', () => {
 
  // Đóng popup quảng cáo tự động cho MỌI test trong describe (áp dụng cho `page` mặc định)
  test.beforeEach(async ({ page }) => {
    await registerPopupHandler(page);
  });
 
  /* --------------------------------------------------------------------------
   * PHẦN A: THÊM VÀO GIỎ HÀNG (CART_Add)
   * -------------------------------------------------------------------------- */
  test('CART_Add_01 - Thêm sản phẩm vào giỏ hàng thành công từ trang chi tiết', async ({ page }) => {
    // Bước 1: mở trang chi tiết SP C
    await openProduct(page, 'C');
    const name = await getProductName(page);
    const price = await getProductPrice(page);
    await expect(page.locator(L.ADD_TO_CART_BTN).first()).toBeVisible();
    await expect(page.locator(L.BUY_NOW_BTN).first()).toBeVisible();
    expect(name.length).toBeGreaterThan(0);
    expect(price).toBeGreaterThan(0);
    const productUrl = page.url();
 
    // Bước 2: click [Thêm vào giỏ] -> thông báo thành công, vẫn ở trang chi tiết
    await addToCart(page);
    await expect(page.locator(L.TOAST_MSG).first()).toBeVisible();
    expect(page.url()).toBe(productUrl);
 
    // Bước 3: click biểu tượng giỏ hàng -> 1 dòng SP C, SL = 1, đơn giá = c
    await openCartFromHeader(page);
    await expect(page).toHaveURL(/\/gio-hang(\?.*)?$/);
    expect(await getCartItemCount(page)).toBe(1);
    expect(await getCartQty(page, 0)).toBe(1);
    expect(await getCartUnitPrice(page, 0)).toBe(price);
  });
 
    test('CART_Add_02 - Hiển thị thông báo và liên kết [Xem giỏ hàng] sau khi thêm sản phẩm', async ({ page }) => {
    // Bước 1: mở trang chi tiết SP C, click [Thêm vào giỏ]
    await openProduct(page, 'C');
    const btn = page.locator(L.ADD_TO_CART_BTN).first();
    await btn.waitFor({ state: 'visible', timeout: 10000 });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
 
    // Bước 2: thông báo + liên kết [Xem giỏ hàng]
    await expect(page.locator(L.TOAST_MSG).first()).toBeVisible({ timeout: 10000 });
    const viewCartBtn = page.getByText('Xem giỏ hàng').first();
    await expect(viewCartBtn).toBeVisible({ timeout: 5000 });
    // Thông báo nằm ở góc dưới bên phải. Có che nút khác hay không phụ thuộc kích thước cửa sổ,
    // nên kiểm tra bằng mắt trên ảnh chụp đính kèm (không đo tự động).
    await test.info().attach('toast-buoc-2', { body: await page.screenshot(), contentType: 'image/png' });
    manual('Bước 2: xem ảnh đính kèm toast-buoc-2, kiểm tra thông báo có che nút [Thêm vào giỏ]/[Mua ngay] không');
 
    // Bước 3: click [Xem giỏ hàng] -> sang trang giỏ hàng có SP C (không dùng đường vòng)
    await viewCartBtn.click();
    await expect(page).toHaveURL(/\/gio-hang(\?.*)?$/, { timeout: 10000 });
    await expect.poll(async () => getCartItemCount(page), { timeout: 10000 }).toBe(1);
 
    // Bước 4: quay lại trang chi tiết, thêm SP C lần nữa -> thông báo hiển thị lại, không bị chồng nhiều thông báo
    await openProduct(page, 'C');
    await addToCart(page);
    await expect(page.locator(L.TOAST_MSG).first()).toBeVisible();
    const visibleToasts = await page.locator(L.TOAST_MSG).filter({ visible: true }).count();
    expect(visibleToasts, 'Thông báo bị lặp chồng nhau').toBeLessThanOrEqual(1);
  });
 
  test('CART_Add_03 - Nút [Mua ngay] chuyển sang trang mua ngay mà không thêm sản phẩm vào giỏ hàng', async ({ page }) => {
    // Bước 1: mở trang chi tiết SP C, click [Mua ngay]
    await openProduct(page, 'C');
    const price = await getProductPrice(page);
    const buyNowBtn = page.locator(L.BUY_NOW_BTN).first();
    await buyNowBtn.waitFor({ state: 'visible', timeout: 10000 });
    await buyNowBtn.scrollIntoViewIfNeeded();
    await Promise.all([
      page.waitForURL(/gio-hang-mua-ngay|checkout/, { timeout: 15000 }).catch(() => {}),
      buyNowBtn.click(),
    ]);
 
    // Bước 2: trang /gio-hang-mua-ngay, hiển thị SP C, SL 1, đơn giá = c
    await expect(page).toHaveURL(/gio-hang-mua-ngay|checkout/);
    await page.waitForTimeout(2500);
    await expect(page.getByText(fmt(price)).first()).toBeVisible();
    if (await page.locator(L.QTY_INPUT).count()) {
      expect(await getCartQty(page, 0)).toBe(1);
    }
 
    // Bước 3: click [Giỏ hàng] trên header -> /gio-hang trống, biểu tượng không tăng
    await openCartFromHeader(page);
    await expect(page).toHaveURL(/\/gio-hang(\?.*)?$/);
    await expect(page.locator(L.EMPTY_TITLE).first()).toBeVisible();
    expect(await getCartItemCount(page)).toBe(0);
    expect(await getHeaderCartBadge(page)).toBe(0);
  });
 
  test('CART_Add_04 - Thêm sản phẩm vào giỏ hàng khi chưa chọn khu vực nhận hàng', async ({ browser }) => {
    // Trình duyệt ẩn danh = context mới, chưa lưu khu vực
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await registerPopupHandler(freshPage);
 
    // Bước 1: mở trang chủ, trang tải bình thường (không trắng trang)
    await freshPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await freshPage.waitForTimeout(2500);
    expect((await freshPage.locator('body').innerText()).length).toBeGreaterThan(100);
 
    // Bước 2: mở trang chi tiết SP C -> giá hiển thị theo khu vực mặc định ("Giá tại <khu vực>")
    await openProduct(freshPage, 'C');
    await expect(freshPage.getByText(/Giá tại/).first()).toBeVisible();
    expect(await getProductPrice(freshPage)).toBeGreaterThan(0);
 
    // Bước 3: [Thêm vào giỏ] -> thêm thành công hoặc yêu cầu chọn địa chỉ
    await freshPage.locator(L.ADD_TO_CART_BTN).first().click();
    await expect(
      freshPage.locator(L.TOAST_MSG).or(freshPage.getByText(/chọn địa chỉ|Vui lòng chọn/i)).first()
    ).toBeVisible({ timeout: 10000 });
 
    await freshContext.close();
  });
 
  test('CART_Add_05 - Thêm sản phẩm vào giỏ hàng khi chưa đăng nhập', async ({ page }) => {
    // Bước 1: chưa đăng nhập, mở SP C, [Thêm vào giỏ] -> thành công, không bắt buộc đăng nhập
    await openProduct(page, 'C');
    await expect(page.locator(L.HEADER_LOGIN).first()).toBeVisible();
    await addToCart(page);
    await expect(page.locator(L.TOAST_MSG).first()).toBeVisible();
    await expect(page).not.toHaveURL(/dang-nhap/);
 
    // Bước 2: mở giỏ hàng -> có SP C, SL 1
    await openCartFromHeader(page);
    expect(await getCartItemCount(page)).toBe(1);
    expect(await getCartQty(page, 0)).toBe(1);
  });
 
  test('CART_Add_06 - Thêm cùng một sản phẩm hai lần thì số lượng tăng lên 2', async ({ page }) => {
    // Bước 1: thêm SP C lần 1
    await openProduct(page, 'C');
    const price = await getProductPrice(page);
    await addToCart(page);
    await expect(page.locator(L.TOAST_MSG).first()).toBeVisible();
 
    // Bước 2: thêm lần 2 -> thông báo hiển thị lại
    await addToCart(page);
    await expect(page.locator(L.TOAST_MSG).first()).toBeVisible();
 
    // Bước 3: giỏ hàng chỉ 1 dòng, SL = 2, thành tiền = 2 x c
    await openCartFromHeader(page);
    expect(await getCartItemCount(page)).toBe(1);
    expect(await getCartQty(page, 0)).toBe(2);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(price * 2);
  });
 
  test('CART_Add_07 - Thêm nhiều sản phẩm khác nhau vào giỏ hàng thành công', async ({ page }) => {
    // Bước 1-3: thêm SP A, B, C (mỗi lần thêm đều có thông báo thành công)
    const a = await addProductAndCollect(page, 'A');
    await expect(page.locator(L.TOAST_MSG).first()).toBeVisible();
    const b = await addProductAndCollect(page, 'B');
    await expect(page.locator(L.TOAST_MSG).first()).toBeVisible();
    const c = await addProductAndCollect(page, 'C');
    await expect(page.locator(L.TOAST_MSG).first()).toBeVisible();
 
    // Bước 4: giỏ có 3 dòng, mỗi dòng SL 1, tổng tiền = a + b + c
    await openCartDirect(page);
    expect(await getCartItemCount(page)).toBe(3);
    for (const p of [a, b, c]) {
      const i = await findCartRow(page, p);
      expect(i, `Không thấy ${p.key} trong giỏ`).toBeGreaterThanOrEqual(0);
      expect(await getCartQty(page, i)).toBe(1);
    }
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(a.price + b.price + c.price);
  });
 
  /* --------------------------------------------------------------------------
   * PHẦN B: HIỂN THỊ GIỎ HÀNG (CART_Display)
   * -------------------------------------------------------------------------- */
 
 test('CART_Display_01 - Mở trang giỏ hàng từ biểu tượng giỏ hàng trên header', async ({ page }) => {
  await openProduct(page, 'C');
  await addToCart(page);
 
  const entryPages = [
    ['trang chủ', BASE_URL],
    ['trang chi tiết sản phẩm', PRODUCTS.C.url],
    ['trang danh mục', CATEGORY_URL],
  ];
  const snapshots = [];
 
  for (const [label, url] of entryPages) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await openCartFromHeader(page);
 
    await expect(page, `Từ ${label}`).toHaveURL(/\/gio-hang(\?.*)?$/);
    await expect(page).not.toHaveURL(/dang-nhap/);
    expect(await getCartItemCount(page), `Từ ${label}`).toBe(1);
    snapshots.push(await getCartQty(page, 0));
 
    await expect(page.locator(L.HEADER_CART).first()).toBeVisible();
    await expect(page.locator('footer').first()).toBeAttached();
  }
  expect(new Set(snapshots).size, 'Nội dung giỏ hàng khác nhau giữa các điểm vào').toBe(1);
});
 
  test('CART_Display_02 - Hiển thị giỏ hàng trống khi chưa có sản phẩm', async ({ page }) => {
    // Bước 1: click [Giỏ hàng] trên header
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await openCartFromHeader(page);
    await expect(page).toHaveURL(/\/gio-hang(\?.*)?$/);
    await expect(page.locator(L.EMPTY_TITLE).first()).toBeVisible();
    await expect(page.locator(L.EMPTY_DESC).first()).toBeVisible();
    await expect(page.locator(L.ORDER_BUTTON)).toHaveCount(0);       // không có nút đặt hàng
    await expect(page.getByText('Tạm tính')).toHaveCount(0);          // không có tổng tiền
 
    // Bước 2: thông tin hỗ trợ phía dưới
    await expect(page.getByText(/1900\.232\.461/).first()).toBeVisible();
    await expect(page.getByText(/028\.3948\.6789/).first()).toBeVisible();
    await expect(page.getByText(/8h00 - 21h30/).first()).toBeVisible();
 
    // Bước 3: click [Về trang chủ]
    await page.locator(L.BACK_HOME_BUTTON).first().click();
    await expect(page).toHaveURL(new RegExp(`^${BASE_URL.replace(/\./g, '\\.')}/?$`));
  });
 
  test('CART_Display_03 - Hiển thị đầy đủ thông tin từng sản phẩm trong giỏ hàng', async ({ page }) => {
    // Pre-condition: giỏ có SP A (SL 1) và SP B (SL 1)
    const info = await seedCart(page, ['A', 'B']);
 
    // Bước 1: mỗi dòng có ảnh (không vỡ), tên, đơn giá, số lượng
    expect(await getCartItemCount(page)).toBe(2);
    for (const i of [0, 1]) {
      const row = await getCartRowText(page, i);
      expect(row, `Dòng ${i} không có đơn giá`).toMatch(/\d{1,3}(?:\.\d{3})+\s*[₫đ]/);
      expect(await getCartQty(page, i)).toBe(1);
      const imgLoaded = await page.locator(L.QTY_INPUT).nth(i).evaluate(el => {
        let node = el.parentElement;
        while (node && node !== document.body && !node.querySelector('img')) node = node.parentElement;
        const img = node && node.querySelector('img');
        return !!img && img.complete && img.naturalWidth > 0;
      });
      expect(imgLoaded, `Ảnh dòng ${i} bị vỡ hoặc không có`).toBe(true);
    }
 
    // Bước 2: tên và giá khớp trang chi tiết
    for (const p of [info.A, info.B]) {
      const i = await findCartRow(page, p);
      expect(i, `Không thấy ${p.key} trong giỏ`).toBeGreaterThanOrEqual(0);
      expect(await getCartUnitPrice(page, i)).toBe(p.price);
    }
 
    // Bước 3: click tên/ảnh -> sang trang chi tiết đúng sản phẩm (nếu giỏ cho phép)
    const slugA = new URL(PRODUCTS.A.url).pathname.split('/').pop();
    const link = page.locator(`a[href*="${slugA}"]`).filter({ visible: true }).first();
    if (await link.count()) {
      await link.click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(new RegExp(slugA));
    } else {
      manual('Bước 3: giỏ hàng không có liên kết sang trang chi tiết (Excel ghi "nếu giỏ cho phép")');
    }
  });
 
  test('CART_Display_04 - Hiển thị đúng số lượng trên biểu tượng giỏ hàng', async ({ page }) => {
    // Bước 1: giỏ trống -> không hiển thị số
    await openProduct(page, 'C');
    expect(await getHeaderCartBadge(page)).toBe(0);
    const c = { ...PRODUCTS.C, name: await getProductName(page) };
    c.model = c.name.trim().split(/\s+/).pop();
 
    // Bước 2: thêm SP C -> 1
    await addToCart(page);
    expect(await getHeaderCartBadge(page)).toBe(1);
 
    // Bước 3: thêm SP B -> 2
    const b = await addProductAndCollect(page, 'B');
    expect(await getHeaderCartBadge(page)).toBe(2);
 
    // Bước 4: vào giỏ, tăng SP C lên 2 -> theo quy ước của hệ thống (2 = số dòng hoặc 3 = tổng số lượng), nhất quán
    await openCartDirect(page);
    const iC = await findCartRow(page, c);
    const max = await probeMaxQty(page, iC);
    test.skip(max < 2, `SP C chỉ cho mua tối đa ${max} sản phẩm, không đủ để kiểm tra bước 4`);
    await increaseCartQty(page, iC);
    const badge4 = await getHeaderCartBadge(page);
    const convention = badgeConvention(badge4, 2, 3);
    expect(['lines', 'qty'], `Biểu tượng = ${badge4}, không khớp quy ước nào (2 dòng / 3 sản phẩm)`).toContain(convention);
    test.info().annotations.push({ type: 'badge-convention', description: convention === 'lines' ? 'đếm số dòng sản phẩm' : 'đếm tổng số lượng' });
 
    // Bước 5: xóa SP B -> biểu tượng giảm tương ứng
    const iB = await findCartRow(page, b);
    await deleteCartItem(page, iB, true);
    await expect.poll(async () => getHeaderCartBadge(page), { timeout: 8000 }).toBe(convention === 'lines' ? 1 : 2);
  });
 
  test('CART_Display_05 - Bố cục giỏ hàng hiển thị đúng trên desktop', async ({ page }) => {
    // Pre-condition: SP C + SP B, Chrome 1920x1080
    await page.setViewportSize({ width: 1920, height: 1080 });
    await seedCart(page, ['C', 'B']);
 
    // Bước 1: đủ thành phần hiển thị
    expect(await getCartItemCount(page)).toBe(2);
    await expect(page.locator(L.ORDER_BUTTON).first()).toBeVisible();
    expect(await getCartSubtotal(page)).toBeGreaterThan(0);
    expect(await horizontalOverflow(page), 'Cuộn ngang ở 1920x1080').toBeLessThanOrEqual(1);
 
    // Bước 2: thu/phóng cửa sổ 1366x768 và 1024x768 -> không vỡ giao diện, không cuộn ngang
    for (const [w, h] of [[1366, 768], [1024, 768]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(1000);
      expect(await horizontalOverflow(page), `Cuộn ngang ở ${w}x${h}`).toBeLessThanOrEqual(1);
      expect(await getCartItemCount(page)).toBe(2);
    }
 
    // Bước 3: cuộn trang -> tổng tiền và nút đặt hàng luôn truy cập được
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(500);
    await page.locator(L.ORDER_BUTTON).first().scrollIntoViewIfNeeded();
    await expect(page.locator(L.ORDER_BUTTON).first()).toBeVisible();
 
    manual('Căn chỉnh, không chồng chéo, đúng font và màu chung của website: kiểm tra bằng mắt');
  });
 
  test('CART_Display_06 - Bố cục giỏ hàng hiển thị đúng trên di động', async ({ page, context, browser }) => {
  // Seed giỏ ở trình duyệt desktop, rồi chuyển sang thiết bị di động với cùng cookie
  await seedCart(page, ['C', 'B']);
 
  const mobileContext = await browser.newContext({
    ...devices['iPhone 13'],                      // có UA di động, isMobile, hasTouch
    viewport: { width: 375, height: 812 },        // ghi đè để đúng 375x812
    storageState: await context.storageState(),
  });
  const m = await mobileContext.newPage();
 
  // Handler đóng popup quảng cáo cho page mobile
  await registerPopupHandler(m);
 
  // Bước 1: mở giỏ hàng
  await m.goto(CART_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await m.waitForTimeout(3000);
  expect(await getCartItemCount(m)).toBe(2);
 
  // Log phần tử gây tràn (nếu có) để làm bằng chứng
  const overflow = await horizontalOverflow(m);
  if (overflow > 1) {
    await m.screenshot({ path: 'mobile-cart-375.png', fullPage: true });
    console.log('Overflow 375px =', overflow, 'UA =', await m.evaluate(() => navigator.userAgent));
  }
  expect.soft(overflow, 'Cuộn ngang trên 375px').toBeLessThanOrEqual(1);
 
  // Nút +/−/xóa đủ lớn để bấm (>= 32px)
  // Nút +/−/xóa đủ lớn để bấm (>= 24px theo WCAG 2.2 AA)
for (const btn of [leftBtn(m, 0), plusBtn(m, 0)]) {
  const box = await btn.boundingBox();
  const minSide = box ? Math.round(Math.min(box.width, box.height)) : 0;
  expect.soft(minSide, 'Nút +/−/xóa nhỏ hơn 24px (WCAG 2.2 AA)').toBeGreaterThanOrEqual(24);
}
 
  // Bước 2: cuộn trang -> tổng tiền, nút đặt hàng hiển thị, không bị che
  await m.mouse.wheel(0, 3000);
  await m.waitForTimeout(500);
  await m.locator(L.ORDER_BUTTON).first().scrollIntoViewIfNeeded();
  await expect.soft(m.locator(L.ORDER_BUTTON).first()).toBeVisible();
 
  // Bước 3: xoay ngang màn hình
  await m.setViewportSize({ width: 812, height: 375 });
  await m.waitForTimeout(1000);
  expect.soft(await horizontalOverflow(m), 'Cuộn ngang khi xoay ngang').toBeLessThanOrEqual(1);
  expect.soft(await getCartItemCount(m)).toBe(2);
 
  manual('Bố cục dạng 1 cột, chữ đọc được, cuộn mượt: kiểm tra bằng mắt');
  await mobileContext.close();
});
 
  /* --------------------------------------------------------------------------
   * PHẦN C: CẬP NHẬT SỐ LƯỢNG VÀ XÓA (CART_Update)
   * -------------------------------------------------------------------------- */
  test('CART_Update_01 - Tăng số lượng sản phẩm thành công', async ({ page }) => {
    const { C } = await seedCart(page, ['C']);
    const c = C.price;
    const max = await probeMaxQty(page, 0);
    test.skip(max < 3, `SP C chỉ cho mua tối đa ${max} sản phẩm, không đủ để kiểm tra tăng lên 3`);
 
    // Bước 1: SL = 1 -> bên trái là thùng rác (không có chữ −), bên phải là [+]
    expect(await getCartQty(page, 0)).toBe(1);
    const leftAt1 = await leftBtn(page, 0).innerHTML();
    expect((await leftBtn(page, 0).innerText()).trim()).not.toMatch(/^[-−–]$/);
    expect((await plusBtn(page, 0).innerText()).trim()).toMatch(/^\+?$/);
 
    // Bước 2: [+] -> SL 2, thành tiền 2a, nút trái đổi thành [−]
    await increaseCartQty(page, 0);
    expect(await getCartQty(page, 0)).toBe(2);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(c * 2);
    expect(await leftBtn(page, 0).innerHTML(), 'Nút trái không đổi sang [−]').not.toBe(leftAt1);
 
    // Bước 3: [+] -> SL 3, thành tiền 3a
    await increaseCartQty(page, 0);
    expect(await getCartQty(page, 0)).toBe(3);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(c * 3);
 
    // Bước 4: nhập tay 5 (hoặc giới hạn tối đa nếu nhỏ hơn 5), Enter -> thành tiền = SL x c, biểu tượng giỏ hàng nhất quán
    const target = Math.min(5, max);
    await typeCartQty(page, target, 0);
    expect(await getCartQty(page, 0)).toBe(target);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(c * target);
    expect([1, target], 'Biểu tượng giỏ hàng không nhất quán').toContain(await getHeaderCartBadge(page));
  });
 
  test('CART_Update_02 - Giảm số lượng sản phẩm thành công', async ({ page }) => {
    const { C } = await seedCart(page, ['C']);
    const c = C.price;
 
    // Pre-condition: SL = 3
    const max = await probeMaxQty(page, 0);
    test.skip(max < 3, `SP C chỉ cho mua tối đa ${max} sản phẩm, không đủ để đặt SL = 3`);
    await typeCartQty(page, 3, 0);
    expect(await getCartQty(page, 0)).toBe(3);
    const minusHtml = await leftBtn(page, 0).innerHTML();
 
    // Bước 1: [−] -> SL 2, thành tiền 2a
    await decreaseCartQty(page, 0);
    expect(await getCartQty(page, 0)).toBe(2);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(c * 2);
 
    // Bước 2: [−] -> SL 1, thành tiền c
    await decreaseCartQty(page, 0);
    expect(await getCartQty(page, 0)).toBe(1);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(c);
 
    // Bước 3: SL = 1 -> nút [−] được thay bằng biểu tượng thùng rác
    expect(await leftBtn(page, 0).innerHTML(), 'Nút trái vẫn là [−] khi SL=1').not.toBe(minusHtml);
  });
 
  test('CART_Update_03 - Hiển thị biểu tượng thùng rác thay cho nút giảm khi số lượng là 1', async ({ page }) => {
    await seedCart(page, ['C']);
    expect(await getCartQty(page, 0)).toBe(1);
 
    // Bước 1: SL 1 -> bên trái là thùng rác, không còn nút [−]
    await expect(leftBtn(page, 0)).toBeVisible();
    expect((await leftBtn(page, 0).innerText()).trim()).not.toMatch(/^[-−–]$/);
 
    // Bước 2-3: click thùng rác -> hộp thoại xác nhận -> [Hủy] -> SP C vẫn còn, SL 1
    await deleteCartItem(page, 0, false);
    expect(await getCartItemCount(page)).toBe(1);
    expect(await getCartQty(page, 0)).toBe(1);
 
    // Bước 4: click thùng rác lần nữa -> xác nhận xóa -> giỏ trống
    await deleteCartItem(page, 0, true);
    await expect(page.locator(L.EMPTY_TITLE).first()).toBeVisible();
  });
 
  test('CART_Update_04 - Không thể nhập số lượng vượt giới hạn tối đa', async ({ page }) => {
    const { C } = await seedCart(page, ['C']);
    const c = C.price;
    const limitPattern = /tối đa|vượt quá|không đủ|giới hạn|chỉ còn/i;
 
    // Xác định giới hạn tối đa: nhập số rất lớn, hệ thống kẹp về mức tối đa
    await typeCartQty(page, '99999', 0);
    const max = await getCartQty(page, 0);
    expect(max, 'Hệ thống không giới hạn số lượng tối đa').toBeLessThan(99999);
    expect(max).toBeGreaterThanOrEqual(1);
    test.info().annotations.push({ type: 'max-qty', description: `Giới hạn tối đa của SP C = ${max}` });
 
    // Bước 1: nhập đúng giới hạn tối đa -> cập nhật thành công, thành tiền đúng
    await typeCartQty(page, max, 0);
    expect(await getCartQty(page, 0)).toBe(max);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(c * max);
 
    // Bước 2: nhập tối đa + 1 -> có thông báo, SL về mức tối đa hoặc giữ giá trị cũ
    const msg2 = await typeQtyAndWatchMessage(page, max + 1, limitPattern);
    expect(await getCartQty(page, 0)).toBeLessThanOrEqual(max);
    expect.soft(msg2, 'Không thấy thông báo vượt số lượng cho phép (tối đa + 1)').toBe(true);
 
    // Bước 3: nhập 99999 -> thông báo tương tự, không lỗi hệ thống, tổng tiền không sai
    const msg3 = await typeQtyAndWatchMessage(page, 99999, limitPattern);
    const qty3 = await getCartQty(page, 0);
    expect(qty3).toBeLessThanOrEqual(max);
    expect.soft(msg3, 'Không thấy thông báo vượt số lượng cho phép (99999)').toBe(true);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(c * qty3);
  });
 
  test('CART_Update_05 - Không thể nhập số lượng không hợp lệ', async ({ page }) => {
    await seedCart(page, ['C']);
    expect(await getCartQty(page, 0)).toBe(1);
 
    const cases = [
      ['abc', 'chữ'],
      ['-1', 'số âm'],
      ['0', 'số 0'],
      ['1.5', 'số thập phân'],
      ['@#$', 'ký tự đặc biệt'],
      ['', 'để trống'],
    ];
    for (const [bad, label] of cases) {
      await typeCartQty(page, bad, 0);
 
      // Nhập 0: chấp nhận cả trường hợp website hỏi xác nhận xóa sản phẩm (bấm [Hủy] để giữ nguyên)
      const prompt = page.getByText(L.CONFIRM_DELETE_TEXT).first();
      if (bad === '0' && (await prompt.isVisible().catch(() => false))) {
        await page.locator('button').filter({ hasText: /^Hủy$/ }).first().click();
        await page.waitForTimeout(1500);
      }
      const val = await page.locator(L.QTY_INPUT).first().inputValue();
      expect(val, `Nhập ${label} ("${bad}") phải trả về số lượng hợp lệ >= 1`).toMatch(/^[1-9]\d*$/);
    }
 
    // Bước 7: tổng tiền không NaN/âm, không lỗi hệ thống
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/NaN|-\d{1,3}(\.\d{3})+\s*[₫đ]/);
    expect(await getCartSubtotal(page)).toBeGreaterThan(0);
  });
 
  test('CART_Update_06 - Xóa một sản phẩm khỏi giỏ hàng sau khi xác nhận', async ({ page }) => {
    // Pre-condition: SP C (SL 1) và SP B (SL 1)
    const info = await seedCart(page, ['C', 'B']);
    const { C, B } = info;
    expect(await getCartItemCount(page)).toBe(2);
 
    // Bước 1-2: thùng rác ở dòng SP B -> hộp thoại xác nhận -> [Hủy] -> SP B vẫn còn, tổng = c + b
    const iB = await findCartRow(page, B);
    expect(iB).toBeGreaterThanOrEqual(0);
    await deleteCartItem(page, iB, false);
    expect(await getCartItemCount(page)).toBe(2);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(C.price + B.price);
 
    // Bước 3: thùng rác SP B lần nữa -> xác nhận xóa -> SP B biến mất, SP C giữ nguyên, tổng = c, biểu tượng cập nhật
    await deleteCartItem(page, await findCartRow(page, B), true);
    await expect.poll(() => getCartItemCount(page)).toBe(1);
    expect(await findCartRow(page, B)).toBe(-1);
    expect(await findCartRow(page, C)).toBeGreaterThanOrEqual(0);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(C.price);
    await expect.poll(async () => getHeaderCartBadge(page), { timeout: 8000 }).toBe(1);
  });
 
  test('CART_Update_07 - Xóa toàn bộ sản phẩm khỏi giỏ hàng sau khi xác nhận', async ({ page }) => {
    // Pre-condition: SP A, SP B, SP C, mỗi sản phẩm SL 1
    const info = await seedCart(page, ['A', 'B', 'C']);
    expect(await getCartItemCount(page)).toBe(3);
 
    // Bước 1: xóa từng sản phẩm bằng thùng rác, mỗi lần đều có hộp thoại xác nhận, tổng tiền cập nhật
    let remaining = [info.A, info.B, info.C];
    while (remaining.length > 0) {
      const target = remaining[0];
      await deleteCartItem(page, await findCartRow(page, target), true); // deleteCartItem đã kiểm hộp thoại xác nhận
      remaining = remaining.slice(1);
      if (remaining.length > 0) {
        await expect.poll(() => getCartItemCount(page)).toBe(remaining.length);
        await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 })
          .toBe(remaining.reduce((s, p) => s + p.price, 0));
      }
    }
 
    // Bước 2: giỏ hàng trống có nút [Về trang chủ], không có tổng tiền
    await expect(page.locator(L.EMPTY_TITLE).first()).toBeVisible();
    await expect(page.locator(L.BACK_HOME_BUTTON).first()).toBeVisible();
    await expect(page.getByText('Tạm tính')).toHaveCount(0);
 
    // Bước 3: tải lại trang (F5) -> vẫn trống
    await page.reload();
    await expect(page.locator(L.EMPTY_TITLE).first()).toBeVisible();
    expect(await getCartItemCount(page)).toBe(0);
  });
 
  test('CART_Update_08 - Xóa tất cả sản phẩm khỏi giỏ hàng bằng nút Xóa tất cả', async ({ page }) => {
  await seedCart(page, ['A', 'B', 'C']);
  expect(await getCartItemCount(page)).toBe(3);
 
  // Bước 1: link "Xóa tất cả sản phẩm"
  const deleteAllBtn = page.getByText(/x(óa|oá)\s+tất cả sản phẩm/i).first();
  await deleteAllBtn.scrollIntoViewIfNeeded();
  await expect(deleteAllBtn, 'Không thấy link [Xóa tất cả sản phẩm]').toBeVisible({ timeout: 5000 });
 
  const totalBefore = await getCartSubtotal(page);
 
  // Hộp thoại xác nhận: nhận diện bằng câu hỏi, nút [Hủy] và [Xoá]
  const question   = page.getByText(/bạn có chắc chắn muốn xóa tất cả sản phẩm/i);
  const cancelBtn  = page.getByRole('button', { name: /^\s*(hủy|huỷ)\s*$/i });
  const confirmBtn = page.getByRole('button', { name: /^\s*(xóa|xoá)\s*$/i });
 
  // Bước 2: bấm Xóa tất cả -> có hộp thoại -> Hủy -> giỏ giữ nguyên
  await deleteAllBtn.click();
  await expect(question, 'Không có hộp thoại xác nhận khi Xóa tất cả').toBeVisible({ timeout: 5000 });
  await expect(confirmBtn).toBeVisible();
  await cancelBtn.click();
  await expect(question).toBeHidden({ timeout: 5000 });
  expect(await getCartItemCount(page), 'Hủy xóa nhưng sản phẩm vẫn bị mất').toBe(3);
  expect(await getCartSubtotal(page)).toBe(totalBefore);
 
  // Bước 3: bấm lại -> chọn Xoá -> xóa luôn
  await deleteAllBtn.click();
  await expect(question).toBeVisible({ timeout: 5000 });
  await confirmBtn.click();
 
  // Bước 4: giỏ hàng trống
  await expect.poll(() => getCartItemCount(page), { timeout: 8000 }).toBe(0);
  await expect(page.getByText(/giỏ hàng trống|chưa có sản phẩm/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /về trang chủ/i }).first()).toBeVisible();
  expect.soft(await getHeaderCartBadge(page).catch(() => 0), 'Badge giỏ hàng chưa về 0').toBeLessThanOrEqual(0);
 
  // Bước 5: F5 vẫn trống
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  expect(await getCartItemCount(page)).toBe(0);
  await expect(page.getByText(/giỏ hàng trống|chưa có sản phẩm/i).first()).toBeVisible();
});
 
  /* --------------------------------------------------------------------------
   * PHẦN D: TÍNH TIỀN, LƯU TRỮ VÀ ĐẶT HÀNG (CART_Calc, Store, Checkout)
   * -------------------------------------------------------------------------- */
  test('CART_Calc_01 - Tổng tiền tính đúng theo đơn giá nhân số lượng', async ({ page }) => {
    // Pre-condition: SP C (SL 2) và SP B (SL 1)
    const { C, B } = await seedCart(page, ['C', 'B']);
    const iC = await findCartRow(page, C);
    const max = await probeMaxQty(page, iC);
    test.skip(max < 2, `SP C chỉ cho mua tối đa ${max} sản phẩm, không đủ để đặt SL = 2`);
    await increaseCartQty(page, iC);
 
    // Bước 1: thành tiền từng dòng
    const rowC = await findCartRow(page, C);
    const rowB = await findCartRow(page, B);
    expect(await getCartQty(page, rowC)).toBe(2);
    expect(await getCartQty(page, rowB)).toBe(1);
    expect(await getCartUnitPrice(page, rowC) * 2, 'SP C: c x 2').toBe(C.price * 2);
    expect(await getCartUnitPrice(page, rowB), 'SP B: b x 1').toBe(B.price);
 
    // Bước 2: tổng tiền = 2a + b
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(C.price * 2 + B.price);
 
    // Bước 3: định dạng số tiền (dấu chấm phân cách hàng nghìn + ký hiệu đ, nhất quán)
    // Bước 3: định dạng số tiền (dấu chấm phân cách hàng nghìn + ký hiệu đ, nhất quán)
const money = (await page.locator('body').innerText()).match(/[\d.,]+\s*[₫đ]/g) || [];
expect(money.length).toBeGreaterThan(0);
 
const validFormat = /^\d{1,3}(\.\d{3})*\s*[₫đ]$/;
const bad = [...new Set(money.map(m => m.trim()).filter(m => !validFormat.test(m)))];
if (bad.length) console.log('Số tiền sai định dạng:', bad);
expect.soft(bad, `Có ${bad.length} số tiền sai định dạng (dùng dấu phẩy thay vì dấu chấm): ${bad.join(' | ')}`).toEqual([]);
  });
 
  test('CART_Calc_02 - Tổng tiền tính theo giá đã giảm khi sản phẩm có khuyến mãi', async ({ page }) => {
    // Bước 1: thêm SP B vào giỏ (giỏ trống trước đó)
    const { B } = await seedCart(page, ['B']);
 
    // Bước 2: đơn giá trong giỏ = giá sau giảm trên trang chi tiết; có quà tặng kèm
    expect(await getCartItemCount(page)).toBe(1);
    const unit = await getCartUnitPrice(page, 0);
    expect(unit).toBeGreaterThan(0);
    expect(unit, 'Đơn giá trong giỏ khác giá hiển thị ở trang chi tiết').toBe(B.price);
    await expect(page.getByText(/Quà tặng cùng sản phẩm|Phiếu mua hàng|Tặng/).first()).toBeVisible();
 
    // Bước 3: tổng tiền = giá sau giảm x số lượng, quà tặng không làm đổi tổng tiền
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(B.price * (await getCartQty(page, 0)));
  });
 
  test('CART_Store_01 - Giữ nguyên giỏ hàng sau khi tải lại trang', async ({ page, context, browser }) => {
    // Pre-condition: SP C (SL 2), SP B (SL 1)
    const { C, B } = await seedCart(page, ['C', 'B']);
    const iC = await findCartRow(page, C);
    const max = await probeMaxQty(page, iC);
    test.skip(max < 2, `SP C chỉ cho mua tối đa ${max} sản phẩm, không đủ để đặt SL = 2`);
    await increaseCartQty(page, iC);
    const expectedTotal = C.price * 2 + B.price;
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(expectedTotal);
    await page.waitForTimeout(2000); // chờ server lưu giỏ hàng
 
    const verifyCart = async p => {
      expect(await getCartItemCount(p)).toBe(2);
      expect(await getCartQty(p, await findCartRow(p, C))).toBe(2);
      expect(await getCartQty(p, await findCartRow(p, B))).toBe(1);
      await expect.poll(async () => getCartSubtotal(p), { timeout: 8000 }).toBe(expectedTotal);
    };
 
    // Bước 1: tải lại trang (F5)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await verifyCart(page);
 
    // Bước 2: đóng tab, mở lại trang chủ rồi vào giỏ hàng
    await page.close();
    const tab2 = await context.newPage();
    await registerPopupHandler(tab2);
    await tab2.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await tab2.waitForTimeout(2500);
    await openCartFromHeader(tab2);
    await verifyCart(tab2);
 
    // Bước 3: đóng hoàn toàn trình duyệt, mở lại (mô phỏng: chỉ giữ cookie có hạn, bỏ cookie phiên)
    const state = await context.storageState();
    const persistent = {
      cookies: state.cookies.filter(c => c.expires && c.expires > Date.now() / 1000),
      origins: state.origins,
    };
    const reopened = await browser.newContext({ storageState: persistent });
    const p3 = await reopened.newPage();
    await registerPopupHandler(p3);
    await p3.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p3.waitForTimeout(2500);
    await openCartFromHeader(p3);
    if ((await getCartItemCount(p3)) === 0) {
      // Expected cho phép: "hoặc ghi nhận thời gian lưu giỏ nếu bị xóa"
      test.info().annotations.push({ type: 'cart-after-restart', description: 'Giỏ hàng bị xóa sau khi đóng hoàn toàn trình duyệt (cần ghi nhận thời gian lưu giỏ vào Note)' });
    } else {
      await verifyCart(p3);
    }
    await reopened.close();
  });
 
  test.skip('CART_Store_02 - Giữ nguyên giỏ hàng và số lượng trên biểu tượng khi đăng nhập và đăng xuất', async () => {
    // [FAILED - kiểm thủ công bước 2] Sau khi đăng nhập, giỏ hàng vẫn giữ sản phẩm đã thêm nhưng biểu tượng giỏ hàng KHÔNG hiển thị số lượng.
    // Các bước còn lại cần mã OTP SMS thật, không tự động đăng nhập để tránh gửi SMS.
  });
 
  test('CART_Store_03 - Đồng bộ giỏ hàng giữa hai tab', async ({ page, context }) => {
    // Pre-condition: giỏ có SP C, tab 1 và tab 2 đều đang ở trang giỏ hàng
    const { C } = await seedCart(page, ['C']);
    const tab2 = await context.newPage();
    await registerPopupHandler(tab2);
    await openCartDirect(tab2);
    expect(await getCartItemCount(tab2)).toBe(1);
 
    // Bước 1: tại tab 1, thêm SP B từ trang chi tiết
    const B = await addProductAndCollect(page, 'B');
    await expect(page.locator(L.TOAST_MSG).first()).toBeVisible();
 
    // Bước 2: chuyển sang tab 2, tải lại giỏ hàng -> có SP C và SP B
    await tab2.bringToFront();
    await tab2.reload({ waitUntil: 'domcontentloaded' });
    await tab2.waitForTimeout(2500);
    expect(await getCartItemCount(tab2)).toBe(2);
    expect(await findCartRow(tab2, C)).toBeGreaterThanOrEqual(0);
    expect(await findCartRow(tab2, B)).toBeGreaterThanOrEqual(0);
 
    // Bước 3: tại tab 2, xóa SP C; quay lại tab 1, tải lại -> chỉ còn SP B, tổng tiền đúng
    await deleteCartItem(tab2, await findCartRow(tab2, C), true);
    await page.bringToFront();
    await openCartDirect(page);
    expect(await getCartItemCount(page)).toBe(1);
    expect(await findCartRow(page, C), 'Dữ liệu cũ (SP C) vẫn còn ở tab 1').toBe(-1);
    expect(await findCartRow(page, B)).toBeGreaterThanOrEqual(0);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(B.price);
    await tab2.close();
  });
 
  test('CART_Checkout_01 - Chuyển sang bước đặt hàng với thông tin khớp giỏ hàng', async ({ page }) => {
    // Pre-condition: SP C, số lượng 2
    const { C } = await seedCart(page, ['C']);
    const max = await probeMaxQty(page, 0);
    test.skip(max < 2, `SP C chỉ cho mua tối đa ${max} sản phẩm, không đủ để đặt SL = 2`);
    await increaseCartQty(page, 0);
    expect(await getCartQty(page, 0)).toBe(2);
 
    // Bước 1: click nút đặt hàng -> mở hộp thoại thông tin đặt hàng (dừng ở đây, KHÔNG nhập thông tin, KHÔNG gửi đơn)
    const provideInfo = page.locator(L.PROVIDE_INFO_LINK).first();
    const orderBtn = page.locator(L.ORDER_BUTTON).first();
    if (await provideInfo.isVisible()) {
      await provideInfo.click();
    } else {
      await orderBtn.click();
    }
    await expect(page.locator(L.ORDER_DIALOG_TITLE).first()).toBeVisible({ timeout: 8000 });
 
    // Bước 2: đối chiếu tóm tắt đơn hàng: số lượng 2, tổng tiền = 2 x c (hiển thị ngay trong trang giỏ hàng)
    expect(await getCartQty(page, 0)).toBe(2);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(C.price * 2);
    manual('Bước 2: tóm tắt ở trang Thanh toán (/checkout-buy-now) cần nhập địa chỉ nên kiểm tra thủ công');
 
    // Bước 3: đóng hộp thoại, quay lại giỏ hàng -> nội dung không đổi
    const dialogTitle = page.locator(L.ORDER_DIALOG_TITLE).first();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    if (await dialogTitle.isVisible()) {
      await page.getByRole('button', { name: /đóng|close/i }).first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
    if (await dialogTitle.isVisible()) {
      manual('Không đóng được hộp thoại bằng Escape/nút đóng; script mở lại trang giỏ hàng để kiểm tra giỏ hàng không đổi');
      await openCartDirect(page);
    }
    await expect(dialogTitle).toBeHidden();
    expect(await getCartItemCount(page)).toBe(1);
    expect(await getCartQty(page, 0)).toBe(2);
    await expect.poll(async () => getCartSubtotal(page), { timeout: 8000 }).toBe(C.price * 2);
  });
});
 
