/**
 * ============================================================================
 * TEST AUTOMATION SUITE: 6.5.3 CHỨC NĂNG MUA TRẢ GÓP (MODULE INST)
 * Website kiểm thử: https://www.dienmayxanh.com/
 * Framework: Playwright Test (JavaScript)
 * File: tests/chucnang3.spec.js
 * Sinh viên thực hiện: Trần Thị Mỹ Trâm (MSSV: 23130340)
 * 
 * Toàn bộ 30 Test Case theo ma trận kiểm thử (Sheet "Mua trả góp"):
 * - Nhóm 1: INST_Display_01 đến INST_Display_06 (Hiển thị lựa chọn trả chậm & MWG Paylater)
 * - Nhóm 2: INST_Paylater_01 đến INST_Paylater_06 (Mua trước trả sau - BNPL)
 * - Nhóm 3: INST_Company_01 đến INST_Company_08 (Trả chậm qua công ty tài chính)
 * - Nhóm 4: INST_Card_01 đến INST_Card_06 (Trả chậm qua thẻ tín dụng)
 * - Nhóm 5: INST_GUI_01 (Kiểm tra bố cục giao diện trả chậm trên di động)
 * 
 * NGUYÊN TẮC AN TOÀN TRONG KIỂM THỬ TRẢ GÓP:
 * - KHÔNG tạo hồ sơ trả góp thật, KHÔNG nhập mã SMS OTP thật.
 * - KHÔNG nhập thông tin thẻ tín dụng/ví/CCCD thật của người khác.
 * - Dừng lại trước bước gửi dữ liệu nhạy cảm hoặc tại màn hình xác thực OTP SMS.
 * - Mỗi test case có assertion kiểm tra kết quả thực tế, bám sát hành vi live website.
 * ============================================================================
 */

const { test, expect, devices } = require('@playwright/test');

/* ============================================================================
 * 1. CẤU HÌNH DỮ LIỆU KIỂM THỬ (TEST DATA)
 * ============================================================================ */
const BASE_URL = 'https://www.dienmayxanh.com';
const CART_URL = `${BASE_URL}/gio-hang`;

const PRODUCTS = {
  // SP F: Sản phẩm giá cao hỗ trợ cả 3 hình thức trả chậm (Tivi > 15 triệu)
  F: {
    key: 'F',
    name: 'Smart Tivi QNED LG AI 4K 65 inch 65QNED70BSA',
    url: `${BASE_URL}/tivi/smart-tivi-qned-lg-ai-4k-65-inch-65qned70bsa`,
  },
  // SP C: Sản phẩm giá thấp (~790k), chỉ hỗ trợ Mua trước trả sau
  C: {
    key: 'C',
    name: 'Nồi cơm điện tử Sunhouse 1.8 lít SHD8911',
    url: `${BASE_URL}/noi-com-dien/noi-com-dien-tu-sunhouse-18-lit-shd8911`,
  },
  // SP G: Sản phẩm giá rẻ không hỗ trợ trả chậm (<50k, phụ kiện)
  G: {
    key: 'G',
    name: 'Pin AAA 2 viên Alkaline Panasonic LR03T',
    url: `${BASE_URL}/pin/pin-aaa-2-vien-alkaline-panasonic-lr03t`,
  },
  // SP A: Sản phẩm có khuyến mãi / Flash sale
  A: {
    key: 'A',
    name: 'Smart Tivi QNED LG AI 4K 65 inch 65QNED70BSA',
    url: `${BASE_URL}/tivi/smart-tivi-qned-lg-ai-4k-65-inch-65qned70bsa`,
  },
};

// Thông tin khách hàng mẫu hợp lệ (Khu vực Hồ Chí Minh)
const TEST_CUSTOMER = {
  gender: 'Anh',
  fullName: 'Trần Thị Mỹ Trâm',
  phone: '0987654332',
  idCard: '079199012345',
  birthday: '15/10/1998',
  city: 'Hồ Chí Minh',
  ward: 'An Đông',
  street: '11',
  
};

/* ============================================================================
 * 2. ĐỊNH DANH PHẦN TỬ GIAO DIỆN (LOCATORS)
 * ============================================================================ */
const L = {
  // Trang chi tiết sản phẩm
  ADD_TO_CART_BTN: 'button:has-text("Thêm vào giỏ"), a:has-text("Thêm vào giỏ")',
  BUY_NOW_BTN: 'button:has-text("Mua ngay"), a:has-text("Mua ngay")',
  INSTALLMENT_BTN: 'button:has-text("Trả chậm 0%"), a:has-text("Trả chậm 0%"), button:has-text("Trả chậm"), a:has-text("Trả chậm")',

  // Hộp thoại "Chọn hình thức trả chậm"
  DIALOG_TITLE: 'text="Chọn hình thức trả chậm"',
  DIALOG_CONTAINER: 'div:has-text("Chọn hình thức trả chậm"):not(#notify-popup), [role="dialog"], .modal-content',
  CLOSE_DIALOG_BTN: 'button:has-text("✕"), button:has-text("×"), [aria-label*="Close" i], button.close, .modal-close',

  // Các lựa chọn trong hộp thoại trả chậm
  OPTION_CARD: 'a[href*="/tra-cham?"], :text("Qua thẻ tín dụng")',
  OPTION_COMPANY: 'a[href*="/tra-cham-tai-chinh"], :text("Qua công ty tài chính")',
  OPTION_BNPL: 'a[href*="/tra-cham-bnpl"], :text("Mua trước trả sau")',

  // Trang Mua trước trả sau (/tra-cham-bnpl)
  BNPL_TITLE: 'text="Giỏ Hàng Mua Trước Trả Sau", text="Mua Trước Trả Sau"',
  BNPL_PARTNERS_SECTION: 'div:has-text("Chọn đối tác thanh toán")',
  BNPL_PARTNER_MWG: 'text="MWG Paylater", img[alt*="MWG" i], [class*="partner"]:has-text("MWG")',
  BNPL_PARTNER_KREDIVO: 'text="Kredivo", img[alt*="Kredivo" i], [class*="partner"]:has-text("Kredivo")',
  BNPL_PARTNER_HOMEPAYLATER: 'text="Home PayLater", img[alt*="Home" i], [class*="partner"]:has-text("Home")',
  BNPL_QTY_MINUS: 'div.bg-grey-200 button, button:has-text("-"), button:has-text("−")',
  BNPL_QTY_PLUS: 'div.bg-grey-200 button, button:has-text("+")',
  BNPL_QTY_INPUT: 'input[inputmode="numeric"]',
  BNPL_INFO_LINK: 'text="Vui lòng cung cấp thông tin nhận hàng"',
  BNPL_DELIVERY_HOME: 'label:has-text("Giao tận nơi"), text="Giao tận nơi"',
  BNPL_DELIVERY_STORE: 'label:has-text("Nhận tại siêu thị"), text="Nhận tại siêu thị"',
  BNPL_SUMMARY_SECTION: 'div:has-text("Chi tiết thanh toán")',
  BNPL_BACK_BTN: 'a[href*="/tivi/"], a:has(.icon__back), button:has(.icon__back)',
    // Hộp thoại "Thông tin đặt hàng" (dùng trong fillOrderInfo, lấy từ chucnang2)
  GENDER_MALE: 'text=Anh',
  GENDER_FEMALE: 'text=Chị',
  NAME_INPUT: 'input[placeholder*="Họ tên" i], input[placeholder*="Họ và tên" i], input[name*="fullname" i], input[name*="name" i], [aria-label*="Họ tên" i], [aria-label*="Họ và tên" i]',
  PHONE_INPUT: 'input[placeholder*="Số điện thoại" i], input[name*="phone" i], input[type="tel"], [aria-label*="Số điện thoại" i]',

  // Trang Trả chậm tài chính (/tra-cham-tai-chinh)
  TC_TITLE: 'text="Giỏ Hàng Trả Chậm Tài Chính", text="Trả Góp Tài Chính"',
  TC_PACKAGES_SECTION: 'div:has-text("Chọn gói trả chậm nổi bật")',
  TC_VIEW_MORE_BTN: 'button:has-text("Xem thêm"), a:has-text("Xem thêm")',
  TC_ALL_COMPANIES_BTN: 'button:has-text("Tất cả")',
  TC_COMPANY_TABS: 'div:has-text("Hoặc chọn gói trả chậm khác phù hợp") button, div:has-text("Hoặc chọn gói") button',
  TC_PREPAY_SECTION: 'div:has-text("Chọn số tiền trả trước")',
  TC_TERM_SECTION: 'div:has-text("Chọn kỳ hạn")',
  TC_IDCARD_INPUT: 'input#idCard, input[name="idCard"], input[placeholder*="Số thẻ căn cước" i]',
  TC_BIRTHDAY_INPUT: 'input#birthday, input[name="birthday"], input[placeholder*="DD / MM / YYYY" i]',
  TC_STORE_SELECT_BTN: 'button:has-text("Chọn siêu thị làm hồ sơ")',
  TC_CONSENT_CHECKBOX: 'input#consent-finance-policy',
  TC_SUBMIT_BTN: 'button:has-text("Đặt mua trả chậm")',

  // Trang Trả chậm thẻ tín dụng (/tra-cham)
  CARD_TITLE: 'text="Giỏ Hàng Trả Chậm Thẻ Tín Dụng", text="Giỏ Hàng Trả Góp Thẻ Tín Dụng"',
  CARD_BANK_SEARCH: 'input[placeholder*="Tìm ngân hàng?" i]',
  CARD_BANK_LIST: 'div:has-text("Chọn ngân hàng trả chậm") ~ div',
  CARD_STEP2_SECTION: 'div:has-text("Chọn loại thẻ")',
  CARD_CONSENT_CHECKBOX: 'input#consent-installment',
  CARD_SUBMIT_BTN: 'button:has-text("Thanh toán")',
};

/* ============================================================================
 * 3. CÁC HÀM TIỆN ÍCH THAO TÁC (HELPER FUNCTIONS)
 * ============================================================================ */

/** Ghi chú bước cần kiểm tra thủ công vào Playwright report */
function manual(description) {
  test.info().annotations.push({ type: 'manual', description });
}

/** Đăng ký tự động đóng banner quảng cáo nếu có */
async function registerPopupHandler(page) {
  const overlay = page.locator('div.cursor-pointer[class*="bg-[#1E1E1E]"]').first();
  await page.addLocatorHandler(
    overlay,
    async () => {
      await page.keyboard.press('Escape');
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
      }
    },
    { noWaitAfter: true }
  );
}

/** Mở trang chi tiết sản phẩm */
async function openProduct(page, key = 'F') {
  const prod = PRODUCTS[key] || { url: key };
  try {
    await page.goto(prod.url, { waitUntil: 'commit', timeout: 45000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  } catch (err) {
    await page.goto(prod.url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  }
  await page.waitForTimeout(2000);
}

/** Mở hộp thoại "Chọn hình thức trả chậm" từ trang chi tiết sản phẩm */
async function openInstallmentDialog(page, key = 'F') {
  await openProduct(page, key);
  const btn = page.locator(L.INSTALLMENT_BTN).first();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(1500);
}

/** Điều hướng trực tiếp hoặc qua click tới trang Mua trước trả sau */
async function goToBnplPage(page, key = 'F') {
  await openInstallmentDialog(page, key);
  const bnplOption = page.locator(L.OPTION_BNPL).first();
  await bnplOption.waitFor({ state: 'visible', timeout: 10000 });
  await Promise.all([
    page.waitForURL(/\/tra-cham-bnpl/, { timeout: 15000 }).catch(() => {}),
    bnplOption.click(),
  ]);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

/** Điều hướng trực tiếp hoặc qua click tới trang Trả chậm tài chính */
async function goToFinancialPage(page, key = 'F') {
  await openInstallmentDialog(page, key);
  const compOption = page.locator(L.OPTION_COMPANY).first();
  await compOption.waitFor({ state: 'visible', timeout: 10000 });
  await Promise.all([
    page.waitForURL(/\/tra-cham-tai-chinh/, { timeout: 15000 }).catch(() => {}),
    compOption.click(),
  ]);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

/** Điều hướng trực tiếp hoặc qua click tới trang Trả chậm thẻ tín dụng */
async function goToCardPage(page, key = 'F') {
  await openInstallmentDialog(page, key);
  const cardOption = page.locator(L.OPTION_CARD).first();
  await cardOption.waitFor({ state: 'visible', timeout: 10000 });
  await Promise.all([
    page.waitForURL(/\/tra-cham(\?|$)/, { timeout: 15000 }).catch(() => {}),
    cardOption.click(),
  ]);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

/**
 * Chọn địa chỉ (2 màn hình) - DÙNG CHUNG cho mọi test, cùng luồng với fillOrderInfo ở chucnang2:
 *  Màn 1 "Chọn khu vực": Tỉnh/Thành -> Phường/Xã (-> [Xác nhận] nếu có)
 *  Màn 2: số nhà, tên đường -> chọn 1 gợi ý -> [Xác nhận địa chỉ]
 * Dùng .first() cho mọi locator để không bị lỗi strict mode khi chữ xuất hiện nhiều chỗ.
 */
async function chooseAddressFlow(page) {
  const openModals = async () => (await page.locator('[id^="modal-"], [role="dialog"]').filter({ visible: true }).allInnerTexts().catch(() => []))
    .map((t) => t.replace(/\s+/g, ' ').slice(0, 160)).join(' || ');
  const step = async (name, fn) => {
    try { await fn(); } catch (e) {
      throw new Error(`Nhập địa chỉ lỗi ở bước "${name}": ${String(e.message).split('\n')[0]}. Hộp thoại đang mở: [${await openModals()}]`);
    }
  };
  const canSee = (loc, ms = 4000) => loc.first().waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);
  // Khung chứa danh sách Tỉnh/Phường: tìm từ chữ bên trong lên khung fixed/modal gần nhất
  const markPicker = (loc) => loc.first().evaluate((el) => {
    document.querySelectorAll('[data-qa-picker]').forEach((e) => e.removeAttribute('data-qa-picker'));
    let m = el.closest('[id^="modal-"], [role="dialog"]');
    for (let p = el, i = 0; !m && p && i < 12; i++, p = p.parentElement) if (getComputedStyle(p).position === 'fixed') m = p;
    if (!m) return false;
    m.setAttribute('data-qa-picker', '1');
    return true;
  });
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Mở màn "Chọn khu vực": chọn tỉnh rồi phường/xã; sau khi chọn phường trang quay về bước nhập địa chỉ chi tiết
  await step('mở Chọn địa chỉ', () => page.getByText('Chọn địa chỉ', { exact: true }).filter({ visible: true }).first().click({ timeout: 5000 }));
  const cityChoice = page.getByText(TEST_CUSTOMER.city, { exact: true }).filter({ visible: true });
  const wardChoice = page.getByText(TEST_CUSTOMER.ward, { exact: true }).filter({ visible: true });
  await step('xác định màn Chọn khu vực', async () => {
    const regionTitle = page.getByText('Chọn khu vực', { exact: true }).filter({ visible: true });
    const target = await canSee(regionTitle, 5000) ? regionTitle : (await canSee(cityChoice, 5000) ? cityChoice : wardChoice);
    if (!(await markPicker(target))) throw new Error('không tìm thấy màn Chọn khu vực');
  });
  const picker = page.locator('[data-qa-picker="1"]');
  if (await canSee(picker.getByText(TEST_CUSTOMER.city, { exact: true }), 1500)) {
    await step(`chọn ${TEST_CUSTOMER.city}`, () => picker.getByText(TEST_CUSTOMER.city, { exact: true }).first().click({ timeout: 8000 }));
  }
  await step(`chọn ${TEST_CUSTOMER.ward}`, () => picker.getByText(TEST_CUSTOMER.ward, { exact: true }).first().click({ timeout: 10000 }));
  // Biến thể trang vẫn yêu cầu xác nhận khu vực sau khi chọn phường
  const areaConfirm = picker.getByRole('button', { name: 'Xác nhận', exact: true });
  if (await canSee(areaConfirm, 1000)) await step('xác nhận khu vực', () => areaConfirm.first().click({ timeout: 5000 }));

  // Màn 2: số nhà, tên đường -> chọn 1 địa chỉ gợi ý -> [Xác nhận địa chỉ]
  await step('nhập số nhà, tên đường', async () => {
    const streetInput = page.getByRole('textbox', { name: /Số nhà tên đường|Số nhà, tên đường/i }).first();
    await streetInput.click({ timeout: 5000 });
    await streetInput.fill(TEST_CUSTOMER.street);
  });
  // Chọn gợi ý đầu tiên bắt đầu bằng số nhà vừa nhập; website có thể đề xuất địa chỉ khác nhau
  await step('chọn địa chỉ gợi ý', async () => {
    const firstSuggestion = page.getByText(new RegExp('^' + esc(TEST_CUSTOMER.street))).filter({ visible: true }).first();
    const flexRe = new RegExp(`^${esc(TEST_CUSTOMER.street)}\\b.*${esc(TEST_CUSTOMER.ward)}`, 'i');
    const flex = page.getByText(flexRe).filter({ visible: true }).first();
    const target = (await canSee(firstSuggestion, 2500)) ? firstSuggestion : flex;
    const chosen = await target.innerText({ timeout: 8000 });
    console.log('[chooseAddressFlow] Địa chỉ gợi ý được chọn:', chosen.replace(/\s+/g, ' ').trim());
    await target.click({ timeout: 8000 });
  });
  await step('xác nhận địa chỉ', () => page.getByRole('button', { name: 'Xác nhận địa chỉ' }).first().click({ timeout: 5000 }));
}

/** Điền thông tin giao nhận hàng tại popup Thông tin nhận hàng nếu có */
async function fillReceiverInfo(page, { fullName, phone, chooseAddress = true } = {}) {
  const provideInfo = page.locator(L.BNPL_INFO_LINK).first();
  if (await provideInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
    await provideInfo.click();
    await page.waitForTimeout(1000);
  }

  // Giao diện mới yêu cầu hoàn tất địa chỉ trước khi điền thông tin người nhận.
  if (chooseAddress) {
    await chooseAddressFlow(page);
  }

  const nameInput = page.getByRole('textbox', { name: /Họ và tên|Họ tên/i }).filter({ visible: true }).first();
  if (fullName) {
    await expect(nameInput, 'Không thấy ô Họ tên sau khi chọn địa chỉ').toBeVisible({ timeout: 5000 });
    await nameInput.fill(fullName);
    await expect(nameInput).toHaveValue(fullName);
  }

  const phoneInput = page.getByRole('textbox', { name: /Số điện thoại/i }).filter({ visible: true }).first();
  if (phone) {
    await expect(phoneInput, 'Không thấy ô Số điện thoại sau khi chọn địa chỉ').toBeVisible({ timeout: 5000 });
    await phoneInput.fill(phone);
    await expect(phoneInput).toHaveValue(phone);
  }

  const confirmBtn = page.getByRole('button', { name: 'Xác nhận' }).last();
  if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(1500);
  }
}

/* ============================================================================
 * 4. KỊCH BẢN KIỂM THỬ: 6.5.3 MUA TRẢ GÓP (MODULE INST)
 * ============================================================================ */

test.describe('6.5.3 Mua trả góp - Điện máy XANH (Module INST)', () => {

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await registerPopupHandler(page);
  });

  /* --------------------------------------------------------------------------
   * PHẦN 1: HIỂN THỊ LỰA CHỌN TRẢ CHẬM (INST_Display)
   * -------------------------------------------------------------------------- */

  // TC 01: Hiển thị nút [Trả chậm 0%] trên trang chi tiết sản phẩm
  test('INST_Display_01 - Hiển thị nút [Trả chậm 0%] trên trang chi tiết sản phẩm', async ({ page }) => {
    // Nhãn nút theo đúng Expected: [Thêm vào giỏ], [Mua ngay], [Trả chậm 0%]
    const LABELS = {
      add: /Thêm vào giỏ/i,
      buy: /Mua ngay/i,
      inst: /Trả chậm\s*0\s*%/i, // bắt buộc có "0%": chữ "Trả chậm" trơn hoặc "Trả góp" KHÔNG đạt
    };

    // Quét trang: đếm nút đang hiển thị theo từng nhãn và tìm "thanh mua hàng" chứa cả 3 nút.
    // Chỉ tính phần tử nhấn được (button / a / role=button) có chữ ngắn, để không nhầm với khối lớn bọc quanh.
    const scan = () => page.evaluate((src) => {
      const re = Object.fromEntries(Object.entries(src).map(([k, v]) => [k, new RegExp(v.source, v.flags)]));
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const label = (el) => norm(el.innerText) || norm(el.getAttribute('aria-label')) || norm(el.title);
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const clickable = () => [...document.querySelectorAll('button, a, [role="button"]')]
        .filter(visible).filter((el) => { const t = label(el); return t && t.length <= 60; });

      const all = clickable();
      const count = (k) => all.filter((el) => re[k].test(label(el))).length;

      // Thanh mua hàng: khối cha (tối đa 6 cấp) của nút [Mua ngay] chứa đủ 3 nút
      let bar = { found: false };
      for (const b of all.filter((el) => re.buy.test(label(el)))) {
        let p = b.parentElement;
        for (let i = 0; i < 6 && p && p !== document.body; i++, p = p.parentElement) {
          const labels = [...p.querySelectorAll('button, a, [role="button"]')].filter(visible).map(label).filter((t) => t && t.length <= 60);
          if (labels.some((t) => re.add.test(t)) && labels.some((t) => re.buy.test(t)) && labels.some((t) => re.inst.test(t))) {
            const r = p.getBoundingClientRect();
            bar = { found: true, height: Math.round(r.height), width: Math.round(r.width), position: getComputedStyle(p).position, labels };
            break;
          }
        }
        if (bar.found) break;
      }

      // Dữ liệu chẩn đoán khi thiếu nút
      const interesting = [...new Set(all.map(label).filter((t) => /thêm vào giỏ|mua ngay|trả chậm|trả góp|liên hệ|sắp về|hết hàng|ngừng kinh doanh/i.test(t)).map((t) => t.slice(0, 50)))].slice(0, 12);
      const body = norm(document.body.innerText);
      const stock = (body.match(/sắp về hàng|hàng sắp về|hết hàng|ngừng kinh doanh|tạm hết/i) || [null])[0];
      return { add: count('add'), buy: count('buy'), inst: count('inst'), bar, interesting, stock };
    }, { add: { source: LABELS.add.source, flags: LABELS.add.flags }, buy: { source: LABELS.buy.source, flags: LABELS.buy.flags }, inst: { source: LABELS.inst.source, flags: LABELS.inst.flags } });

    // ---- Bước 1: mở trang chi tiết SP F ----
    await openProduct(page, 'F');

    // Expected 1: đúng trang chi tiết SP F (không bị chuyển về trang danh mục/404)
    // - URL phải chứa mã sản phẩm: /tivi/ đơn thuần vẫn đúng khi bị đẩy về trang danh mục /tivi
    await expect(page, 'Phải ở đúng trang chi tiết SP F, không bị chuyển sang trang khác').toHaveURL(/65qned70bsa/i);
    await expect(page.locator('h1').first(), 'Tên sản phẩm (h1) phải chứa mã 65QNED70BSA').toContainText(/65QNED70BSA/i, { timeout: 10000 });
    const bodyText = (await page.locator('body').innerText()).replace(/\u00a0/g, ' ');
    expect.soft(bodyText, 'Trang không được báo lỗi / không tìm thấy').not.toMatch(/không tìm thấy trang|404/i);

    // Pre-condition: khu vực Hồ Chí Minh, chưa đăng nhập (chỉ kiểm tra mềm, ghi vào báo cáo)
    expect.soft(bodyText, 'Pre-condition: khu vực nhận hàng phải là Hồ Chí Minh').toMatch(/Hồ Chí Minh/i);
    expect.soft(bodyText, 'Pre-condition: phải ở trạng thái chưa đăng nhập').not.toMatch(/Đăng xuất/i);

    // ---- Bước 2: quan sát thanh mua hàng ----
    // Chờ tối đa ~12s cho đủ 3 nút; nếu thanh mua hàng chỉ hiện khi cuộn thì cuộn xuống 1 lần
    let r = await scan();
    for (let i = 0; i < 24 && !(r.add && r.buy && r.inst); i++) {
      if (i === 8) await page.mouse.wheel(0, 700);
      await page.waitForTimeout(500);
      r = await scan();
    }
    console.log(`[INST_Display_01] Thêm vào giỏ=${r.add} | Mua ngay=${r.buy} | Trả chậm 0%=${r.inst} | thanh mua hàng=${JSON.stringify(r.bar)} | nút liên quan: ${r.interesting.join(' | ')} | tình trạng: ${r.stock}`);
    await test.info().attach('thanh-mua-hang', { body: await page.screenshot(), contentType: 'image/png' });

    const hint = `Nút liên quan đang thấy: [${r.interesting.join(' | ') || 'không có'}]` +
      (r.stock ? `; trang có chữ "${r.stock}" (SP có thể chưa bán được, kiểm tra lại Pre-condition SP F)` : '');

    // Expected 2: hiển thị đủ 3 nút (soft: báo cáo đủ cả 3 nút thiếu, không dừng ở nút đầu tiên)
    expect.soft(r.add, `Nút [Thêm vào giỏ] phải hiển thị. ${hint}`).toBeGreaterThan(0);
    expect.soft(r.buy, `Nút [Mua ngay] phải hiển thị. ${hint}`).toBeGreaterThan(0);
    expect.soft(r.inst, `Nút [Trả chậm 0%] phải hiển thị (đúng nhãn có "0%"). ${hint}`).toBeGreaterThan(0);

    // Cả 3 nút phải nằm cùng một thanh mua hàng (tránh nhầm với nút "Thêm vào giỏ" của sản phẩm gợi ý bên dưới)
    expect.soft(r.bar.found, `Cả 3 nút phải nằm trong cùng một thanh mua hàng. ${hint}`).toBe(true);
    if (r.bar.found) {
      test.info().annotations.push({ type: 'thanh-mua-hang', description: `position=${r.bar.position}, ${r.bar.width}x${r.bar.height}px, nút: ${r.bar.labels.join(' | ')}` });
    }

    // KHÔNG click nút nào -> không mở hộp thoại trả chậm, không thêm giỏ hàng
  });

  // TC 02: Hiển thị đủ 3 hình thức trong hộp thoại chọn hình thức trả chậm
  test('INST_Display_02 - Hiển thị đủ 3 hình thức trong hộp thoại chọn hình thức trả chậm', async ({ page }) => {
    test.setTimeout(90000);

    // Mô tả 3 lựa chọn theo đúng Expected 2.
    //  - label : tên lựa chọn (bắt buộc có chữ)
    //  - texts : các chữ bắt buộc có trong khối lựa chọn (ví dụ "0%", "5 phút")
    //  - brands: tên thương hiệu/đối tác; có thể hiển thị bằng chữ hoặc bằng logo (đọc từ alt/title)
        const OPTIONS = [
      { key: 'card', name: 'Qua thẻ tín dụng (0%)', label: /Qua thẻ tín dụng/i,
        texts: [['0%', /0\s*%/]],
        brands: [['Visa', /Visa/i], ['Mastercard', /Master\s*card/i], ['JCB', /JCB/i], ['Amex', /Amex|American\s*Express/i]] },
      { key: 'company', name: 'Qua công ty tài chính', label: /Qua công ty tài chính/i,
        texts: [['duyệt hồ sơ trong 5 phút', /5\s*phút/i]], brands: [] },
      { key: 'bnpl', name: 'Mua trước trả sau (0%)', label: /Mua trước trả sau/i,
        texts: [['0%', /0\s*%/]],
        brands: [['MWG Paylater', /MWG\s*Pay\s*later/i], ['Kredivo', /Kredivo/i], ['Home Paylater', /Home\s*Pay\s*later/i]] },
    ];
    const reSrc = (re) => ({ source: re.source, flags: re.flags });

    // Đánh dấu nút [Trả chậm 0%] (nhấn được, chữ ngắn) để click chính xác; không dùng L.INSTALLMENT_BTN vì selector đó khớp cả chữ "Trả chậm" trơn
    const markInstallmentButton = () => page.evaluate(() => {
      document.querySelectorAll('[data-qa-inst-btn]').forEach((e) => e.removeAttribute('data-qa-inst-btn'));
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const label = (el) => norm(el.innerText) || norm(el.getAttribute('aria-label')) || norm(el.title);
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const btn = [...document.querySelectorAll('button, a, [role="button"]')]
        .find((el) => visible(el) && label(el).length <= 60 && /Trả chậm\s*0\s*%/i.test(label(el)));
      if (btn) btn.setAttribute('data-qa-inst-btn', '1');
      return !!btn;
    });

    // Đọc hộp thoại: tìm tiêu đề, lấy khối hộp thoại, rồi tìm khối của từng lựa chọn
    const scanDialog = () => page.evaluate((opts) => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const res = opts.map((o) => ({ key: o.key, re: new RegExp(o.label.source, o.label.flags) }));

      const title = [...document.querySelectorAll('*')].find((el) =>
        visible(el) && el.children.length === 0 && /^Chọn hình thức trả chậm/i.test(norm(el.textContent)));
      if (!title) return { dialog: false };

      // Khối hộp thoại = tổ tiên gần nhất của tiêu đề có chứa ít nhất 1 lựa chọn
      let root = title.parentElement, depth = 0;
      while (root && root !== document.body && depth < 10 &&
        !res.some((o) => o.re.test(norm(root.innerText)))) { root = root.parentElement; depth++; }
      if (!root || root === document.body) return { dialog: true, root: false, options: {} };

      const options = {};
      for (const o of res) {
        const others = res.filter((x) => x.key !== o.key);
        // Khối lựa chọn = phần tử ngoài cùng có chữ của lựa chọn này nhưng KHÔNG chứa chữ của lựa chọn khác
        const cands = [...root.querySelectorAll('*')].filter((el) => {
          const t = norm(el.innerText);
          return visible(el) && t.length > 0 && t.length <= 400 && o.re.test(t) && !others.some((x) => x.re.test(t));
        });
        const block = cands.find((el) => !cands.some((c) => c !== el && c.contains(el)));
        if (!block) { options[o.key] = { found: false }; continue; }
        const imgs = [...block.querySelectorAll('img, svg, [role="img"]')];
        const alts = [...block.querySelectorAll('[alt], [title], [aria-label]')]
          .map((e) => norm(e.getAttribute('alt') || e.getAttribute('title') || e.getAttribute('aria-label'))).filter(Boolean);
        const link = block.closest('a') || block.querySelector('a');
        const r = block.getBoundingClientRect();
        options[o.key] = {
          found: true, text: norm(block.innerText), alts, imgCount: imgs.length,
          href: link ? link.getAttribute('href') : null,
          top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height),
        };
      }
      // Số liên kết trả chậm trong hộp thoại (mỗi lựa chọn dẫn tới 1 trang /tra-cham...)
      const hrefs = [...new Set([...root.querySelectorAll('a[href*="/tra-cham"]')].map((a) => a.getAttribute('href')))];
      return { dialog: true, root: true, options, hrefs };
    }, OPTIONS.map((o) => ({ key: o.key, label: reSrc(o.label) })));

    // ---- Bước 1: mở trang chi tiết SP F, click [Trả chậm 0%] ----
    await openProduct(page, 'F');
    await expect(page, 'Phải ở đúng trang chi tiết SP F').toHaveURL(/65qned70bsa/i);

    let found = false;
    for (let i = 0; i < 24 && !found; i++) {
      found = await markInstallmentButton();
      if (!found) { if (i === 8) await page.mouse.wheel(0, 700); await page.waitForTimeout(500); }
    }
    if (!found) {
      const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      const stock = (bodyText.match(/sắp về hàng|hàng sắp về|hết hàng|ngừng kinh doanh|tạm hết/i) || [null])[0];
      expect(found, `Pre-condition: SP F phải có nút [Trả chậm 0%]${stock ? ` (trang có chữ "${stock}", SP có thể chưa bán được)` : ''}`).toBe(true);
    }
    const instBtn = page.locator('[data-qa-inst-btn]').first();
    await instBtn.scrollIntoViewIfNeeded();
    await instBtn.click();

    // ---- Expected 1: hiển thị hộp thoại "Chọn hình thức trả chậm" ----
    await expect(page.getByText('Chọn hình thức trả chậm').first(), 'Phải hiển thị hộp thoại "Chọn hình thức trả chậm"')
      .toBeVisible({ timeout: 10000 });

    // Chờ nội dung các lựa chọn hiện đủ (tối đa ~8s)
    let d = await scanDialog();
    for (let i = 0; i < 16 && !(d.root && OPTIONS.every((o) => d.options[o.key] && d.options[o.key].found)); i++) {
      await page.waitForTimeout(500);
      d = await scanDialog();
    }
    await test.info().attach('hop-thoai-tra-cham', { body: await page.screenshot(), contentType: 'image/png' });
    console.log('[INST_Display_02]', JSON.stringify(d));

    expect(d.dialog && d.root, 'Phải xác định được khối hộp thoại chứa các lựa chọn').toBe(true);

    // ---- Expected 2: có đủ 3 lựa chọn, mỗi lựa chọn đúng nội dung ----
    for (const o of OPTIONS) {
      const opt = d.options[o.key];
      expect.soft(opt && opt.found, `Phải có lựa chọn "${o.name}"`).toBe(true);
      if (!opt || !opt.found) continue;

      const haystack = `${opt.text} | ${opt.alts.join(' | ')}`;

      // Các chữ bắt buộc (0%, 5 phút, ...)
      for (const [txt, re] of o.texts) {
        expect.soft(opt.text, `"${o.name}" phải ghi "${txt}" (nội dung đang hiển thị: ${opt.text})`).toMatch(re);
      }

      // Thương hiệu/đối tác: chữ hoặc logo (alt/title). Thiếu thương hiệu nào -> fail, nêu rõ tên.
      if (o.brands.length) {
        const missing = o.brands.filter(([, re]) => !re.test(haystack)).map(([n]) => n);
        if (missing.length === o.brands.length && opt.imgCount >= o.brands.length) {
          // Logo không có alt/title: không đọc được bằng script -> kiểm bằng mắt, không kết luận fail
          manual(`"${o.name}": ${opt.imgCount} logo không có chữ/alt nên script không đọc được; kiểm tra bằng mắt có đủ ${o.brands.map(([n]) => n).join(', ')}.`);
        } else {
          expect.soft(missing, `"${o.name}" thiếu: ${missing.join(', ')} (chữ/alt đang có: ${haystack})`).toEqual([]);
        }
      }
    }

    // Mỗi lựa chọn dẫn tới một trang trả chậm riêng (nếu lựa chọn là liên kết)
    const blocks = OPTIONS.map((o) => d.options[o.key]).filter((x) => x && x.found);
    const optHrefs = blocks.map((b) => b.href).filter(Boolean);
    if (optHrefs.length) {
      expect.soft(new Set(optHrefs).size, `Mỗi lựa chọn phải dẫn tới một trang trả chậm khác nhau (đang có: ${optHrefs.join(', ')})`).toBe(blocks.length);
    }
    // Ghi nhận các liên kết trả chậm trong hộp thoại để đối chiếu trong báo cáo
    test.info().annotations.push({ type: 'lua-chon-tra-cham', description: `${blocks.length}/3 lựa chọn; liên kết: ${(d.hrefs || []).join(', ') || 'không có'}` });

    // KHÔNG click vào lựa chọn nào -> không sang trang trả chậm, không tạo hồ sơ
  });

  // TC 03: Sản phẩm giá thấp chỉ hiển thị hình thức Mua trước trả sau
  test('INST_Display_03 - Sản phẩm giá thấp chỉ hiển thị hình thức Mua trước trả sau', async ({ page }) => {
    test.setTimeout(90000);

    // Bước 1: mở trang chi tiết SP C, click [Trả chậm 0%]
    await openProduct(page, 'C');
    await expect(page, 'Phải ở đúng trang chi tiết SP C').toHaveURL(/shd8911/i);

    // Ghi lại giá hiện tại của SP C (SP C chỉ "giá thấp" khi còn khuyến mãi, giá có thể đã đổi)
    const priceText = await page.getByText('Tạm tính').first().locator('xpath=..').innerText().catch(() => '');
    const price = (priceText.match(/\d{1,3}(?:\.\d{3})+/) || ['không đọc được'])[0];
    test.info().annotations.push({ type: 'gia-sp-c', description: `Giá SP C lúc test: ${price}` });

    const instBtn = page.locator('button, a, [role="button"]')
      .filter({ hasText: /Trả chậm\s*0\s*%/ }).filter({ visible: true }).first();
    await expect(instBtn, 'Pre-condition: SP C phải có nút [Trả chậm 0%]').toBeVisible({ timeout: 15000 });
    await instBtn.scrollIntoViewIfNeeded();
    await instBtn.click();

    // Expected 1: hiển thị hộp thoại "Chọn hình thức trả chậm"
    const dialogTitle = page.getByText('Chọn hình thức trả chậm').first();
    await expect(dialogTitle, 'Phải hiển thị hộp thoại "Chọn hình thức trả chậm"').toBeVisible({ timeout: 10000 });

    // Đọc nội dung hộp thoại: đi từ tiêu đề lên khối cha gần nhất có chứa chữ của một lựa chọn
    let dialogText = '';
    for (let i = 0; i < 16 && !dialogText; i++) {
      dialogText = await dialogTitle.evaluate((el) => {
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
        let root = el.parentElement;
        for (let d = 0; d < 10 && root && root !== document.body; d++, root = root.parentElement) {
          if (/Mua trước trả sau|Qua thẻ tín dụng|Qua công ty tài chính/i.test(norm(root.innerText))) return norm(root.innerText);
        }
        return '';
      });
      if (!dialogText) await page.waitForTimeout(500);
    }
    console.log('[INST_Display_03] giá SP C:', price, '| nội dung hộp thoại:', dialogText);
    test.info().annotations.push({ type: 'hop-thoai', description: dialogText });
    await test.info().attach('hop-thoai-sp-c', { body: await page.screenshot(), contentType: 'image/png' });
    expect(dialogText, 'Phải đọc được nội dung các lựa chọn trong hộp thoại').not.toBe('');

    // Expected 2: chỉ có 1 lựa chọn "Mua trước trả sau (0%)" kèm MWG Paylater, Kredivo, Home Paylater
    const optionTitles = dialogText.match(/Qua thẻ tín dụng|Qua công ty tài chính|Mua trước trả sau/gi) || [];
    expect.soft(optionTitles.length, `Chỉ được có 1 lựa chọn, thực tế có ${optionTitles.length}: ${optionTitles.join(' | ')} (giá SP C: ${price})`).toBe(1);
    expect.soft(dialogText, 'Phải có lựa chọn "Mua trước trả sau"').toMatch(/Mua trước trả sau/i);
    expect.soft(dialogText, 'Lựa chọn "Mua trước trả sau" phải ghi 0%').toMatch(/0\s*%/);
    expect.soft(dialogText, 'Phải có MWG Paylater').toMatch(/MWG\s*Pay\s*later/i);
    expect.soft(dialogText, 'Phải có Kredivo').toMatch(/Kredivo/i);
    expect.soft(dialogText, 'Phải có Home Paylater').toMatch(/Home\s*Pay\s*later/i);

    // Không hiển thị "Qua thẻ tín dụng" và "Qua công ty tài chính"
    expect.soft(dialogText, `Không được có "Qua thẻ tín dụng" (giá SP C: ${price})`).not.toMatch(/Qua thẻ tín dụng/i);
    expect.soft(dialogText, `Không được có "Qua công ty tài chính" (giá SP C: ${price})`).not.toMatch(/Qua công ty tài chính/i);
    // Dừng tại đây: không click lựa chọn nào
  });

  // TC 04: Đóng hộp thoại chọn hình thức trả chậm không chuyển trang
  test('INST_Display_04 - Đóng hộp thoại chọn hình thức trả chậm không chuyển trang', async ({ page }) => {
    test.setTimeout(90000);

    // Bước 1: mở trang chi tiết SP F, click [Trả chậm 0%]
    await openProduct(page, 'F');
    await expect(page, 'Phải ở đúng trang chi tiết SP F').toHaveURL(/65qned70bsa/i);
    const urlBefore = page.url();

    const instBtn = page.locator('button, a, [role="button"]')
      .filter({ hasText: /Trả chậm\s*0\s*%/ }).filter({ visible: true }).first();
    await expect(instBtn, 'Pre-condition: SP F phải có nút [Trả chậm 0%]').toBeVisible({ timeout: 15000 });
    await instBtn.scrollIntoViewIfNeeded();
    await instBtn.click();

    // Expected 1: hiển thị hộp thoại chọn hình thức trả chậm
    const dialogTitle = page.getByText('Chọn hình thức trả chậm').first();
    await expect(dialogTitle, 'Phải hiển thị hộp thoại "Chọn hình thức trả chậm"').toBeVisible({ timeout: 10000 });
    await test.info().attach('buoc-1-hop-thoai-mo', { body: await page.screenshot(), contentType: 'image/png' });

    // Bước 2: click nút [X] của hộp thoại.
    // Nút [X] là biểu tượng (không có chữ), nên tìm theo vị trí: phần tử nhỏ, cùng hàng với tiêu đề,
    // nằm bên phải tiêu đề, trong khối hộp thoại. Chỉ đọc vị trí, rồi click chuột tại đó như người dùng.
        let closeXY = null;
    let diag = null;
    for (let i = 0; i < 10 && !closeXY; i++) {
      const found = await dialogTitle.evaluate((titleEl) => {
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const OPT = /Mua trước trả sau|Qua thẻ tín dụng|Qua công ty tài chính/i;
        const visible = (el) => {
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        };
        // Khối hộp thoại = khối cha gần nhất của tiêu đề có chứa chữ của một lựa chọn
        let root = titleEl.parentElement;
        for (let d = 0; d < 10 && root && root !== document.body; d++, root = root.parentElement) {
          if (OPT.test(norm(root.innerText))) break;
        }
        if (!root || root === document.body) return { xy: null, diag: { root: false } };
        const rr = root.getBoundingClientRect();
        // Vùng CHỮ của tiêu đề (thẻ tiêu đề có thể rộng cả hàng nên không dùng khung của thẻ)
        const range = document.createRange(); range.selectNodeContents(titleEl);
        const t = range.getBoundingClientRect();
        const tCy = t.top + t.height / 2;
        const rect = (el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
        const small = [...root.querySelectorAll('*')].filter((el) => {
          if (!visible(el)) return false;
          const r = el.getBoundingClientRect();
          return r.width >= 12 && r.width <= 64 && r.height >= 12 && r.height <= 64 && !OPT.test(el.innerText || '');
        });
        // Ưu tiên 1: cùng hàng với chữ tiêu đề và nằm bên phải chữ tiêu đề
        let cands = small.filter((el) => {
          const r = el.getBoundingClientRect();
          return Math.abs((r.top + r.height / 2) - tCy) <= 40 && (r.left + r.width / 2) > t.right;
        });
        // Ưu tiên 2: nằm ở góc trên bên phải của khối hộp thoại
        if (!cands.length) {
          cands = small.filter((el) => {
            const r = el.getBoundingClientRect();
            return r.top - rr.top <= 90 && rr.right - r.right <= 90;
          });
        }
        cands.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
        const diag = {
          root: rect(root), titleText: { l: Math.round(t.left), t: Math.round(t.top), w: Math.round(t.width), h: Math.round(t.height) },
          nhoTrongHopThoai: small.slice(0, 12).map((e) => ({ tag: e.tagName, cls: String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || '').slice(0, 40), ...rect(e) })),
        };
        const el = cands[0];
        if (!el) return { xy: null, diag };
        const r = el.getBoundingClientRect();
        return { xy: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height) }, diag };
      });
      closeXY = found.xy; diag = found.diag;
      if (!closeXY) await page.waitForTimeout(500);
    }
    console.log('[INST_Display_04] nút [X]:', JSON.stringify(closeXY));
    if (!closeXY) console.log('[INST_Display_04] chẩn đoán:', JSON.stringify(diag));
    expect(closeXY, 'Không tìm thấy nút [X] của hộp thoại (xem ảnh buoc-1-hop-thoai-mo và dòng "chẩn đoán" trong terminal)').not.toBeNull();
    await page.mouse.click(closeXY.x, closeXY.y);

    // Expected 2: hộp thoại đóng
    await expect(dialogTitle, 'Hộp thoại phải đóng sau khi bấm [X]').toBeHidden({ timeout: 5000 });
    await test.info().attach('buoc-2-hop-thoai-dong', { body: await page.screenshot(), contentType: 'image/png' });

    // Expected 3 (phần 1): vẫn ở trang chi tiết SP F, không chuyển sang trang trả chậm
    expect.soft(new URL(page.url()).pathname, 'Địa chỉ trang phải giữ nguyên').toBe(new URL(urlBefore).pathname);
    expect.soft(page.url(), 'Không được chuyển sang trang trả chậm').not.toMatch(/\/tra-cham/);
    await expect.soft(page.locator('h1').first(), 'Phải còn nội dung trang chi tiết SP F').toContainText(/65QNED70BSA/i);

    // Expected 3 (phần 2): giỏ hàng không có SP F (trình duyệt mới, giỏ vốn trống)
    const badgeText = await page.locator('a[href="/gio-hang"]').first().innerText().catch(() => '');
    expect.soft(badgeText.replace(/[^\d]/g, ''), 'Biểu tượng giỏ hàng không được hiển thị số').toBe('');
    await page.goto(CART_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await expect.soft(page.getByText('Giỏ hàng trống').first(), 'Giỏ hàng phải trống').toBeVisible({ timeout: 10000 });
    expect.soft(await page.locator('body').innerText(), 'Giỏ hàng không được có SP F').not.toMatch(/65QNED70BSA/i);
  });
  /* --------------------------------------------------------------------------
   * HÀM DÙNG CHUNG CHO CÁC TEST BÊN DƯỚI (thêm mới, không ảnh hưởng các test phía trên)
   * Nhập thông tin nhận hàng giống chucnang2.spec.js (openOrderDialog + fillOrderInfo).
   * -------------------------------------------------------------------------- */

  /** Mở hộp thoại "Thông tin đặt hàng" từ giỏ hàng / giỏ hàng mua ngay */
  async function openOrderDialog(page) {
    const dialogTitle = page.getByText('Thông tin đặt hàng').first();
    if (await dialogTitle.isVisible({ timeout: 1000 }).catch(() => false)) return;

    // 1. Click nút [Đặt mua] để kích hoạt kiểm tra thông tin nhận hàng
    const orderBtn = page.getByRole('button', { name: 'Đặt mua' })
      .or(page.locator('button:has-text("Đặt mua"), button:has-text("Mua ngay")')).first();
    if (await orderBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await orderBtn.click();
      await page.waitForTimeout(1000);
    }

    // 2. Click vào khối "Vui lòng cung cấp thông tin nhận hàng" để mở popup
    const provideInfo = page.getByText('Vui lòng cung cấp thông tin nhận hàng').first();
    if (await provideInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
      await provideInfo.click();
      await page.waitForTimeout(1500);
    }
  }

  /** Điền thông tin vào hộp thoại "Thông tin đặt hàng" (luồng địa chỉ ghi từ codegen, 2 màn hình) */
  async function fillOrderInfo(page, { gender, fullName, phone, chooseAddress = false } = {}) {
  // Phạm vi tìm ô nhập: đúng khung hộp thoại "Thông tin đặt hàng" nếu đang mở
  // (tổ tiên nhỏ nhất của tiêu đề có chứa nút [Xác nhận] đang hiển thị); không có thì dùng cả trang như hàm cũ.
  // Không dùng [id^="modal-"].last() vì trang có nhiều khung modal ẩn.
  const dialogTitle = page.getByText('Thông tin đặt hàng').first();
  let root = page;
  if (await dialogTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
    const marked = await dialogTitle.evaluate((el) => {
      document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
      let p = el;
      for (let i = 0; p && i < 15; i++, p = p.parentElement) {
        const hasConfirm = [...p.querySelectorAll('button')]
          .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
        if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
      }
      return false;
    });
    if (marked) root = page.locator('[data-qa-order="1"]');
  }

  // Chọn danh xưng Anh/Chị
  if (gender === 'Chị') {
    const femaleRadio = root.locator(L.GENDER_FEMALE).first();
    if (await femaleRadio.isVisible()) await femaleRadio.click();
  } else if (gender === 'Anh') {
    const maleRadio = root.locator(L.GENDER_MALE).first();
    if (await maleRadio.isVisible()) await maleRadio.click();
  }

  // Nhập họ và tên: không bỏ qua im lặng, nhập xong kiểm tra lại giá trị
  if (fullName !== undefined) {
    const nameInput = root.locator(L.NAME_INPUT).first();
    await expect(nameInput, 'fillOrderInfo: không thấy ô Họ và tên').toBeVisible({ timeout: 5000 });
    await nameInput.fill(fullName);
    await expect(nameInput).toHaveValue(fullName);
  }

  // Nhập số điện thoại: không bỏ qua im lặng, nhập xong kiểm tra lại giá trị
  if (phone !== undefined) {
    const phoneInput = root.locator(L.PHONE_INPUT).first();
    await expect(phoneInput, 'fillOrderInfo: không thấy ô Số điện thoại').toBeVisible({ timeout: 5000 });
    await phoneInput.fill(phone);
    await expect(phoneInput).toHaveValue(phone);
  }

  // Chọn địa chỉ nếu có yêu cầu (dùng chung chooseAddressFlow)
  if (chooseAddress) {
    await chooseAddressFlow(page);
    // Nút [Xác nhận] cuối của hộp thoại Thông tin đặt hàng do từng test tự bấm
  }
}
  /**
   * Từ trang chi tiết SP bấm [Mua ngay] -> /gio-hang-mua-ngay -> nhập thông tin + địa chỉ
   * -> [Xác nhận] -> [Đặt mua] -> trang Thanh toán (/checkout...). Dừng tại đó, không đặt hàng.
   */
  async function goToBuyNowCheckout(page, key = 'C') {
    await openProduct(page, key);
    const buyNowBtn = page.locator('button, a, [role="button"]')
      .filter({ hasText: /Mua ngay/i }).filter({ visible: true }).first();
    await expect(buyNowBtn, `Pre-condition: SP ${key} phải có nút [Mua ngay]`).toBeVisible({ timeout: 15000 });
    await buyNowBtn.scrollIntoViewIfNeeded();
    await buyNowBtn.click();
    await page.waitForURL(/\/checkout|\/gio-hang/, { timeout: 15000 }).catch(() => {});

    if (!/\/checkout/.test(page.url())) {
      await openOrderDialog(page);
      // Theo luồng mới: chọn địa chỉ trước, rồi mới nhập thông tin người nhận.
      await fillOrderInfo(page, { chooseAddress: true });
      await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone });
      await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
      await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
      await page.getByRole('button', { name: 'Đặt mua' }).first().click();
      await page.waitForURL(/\/checkout/, { timeout: 15000 }).catch(() => {});
    }
  }

  // TC 05: Hiển thị tùy chọn trả chậm trên sản phẩm không hỗ trợ
  test('INST_Display_05 - Hiển thị tùy chọn trả chậm trên sản phẩm không hỗ trợ', async ({ page }) => {
    test.setTimeout(90000);

    // Quét thanh mua hàng: tìm khối chứa [Thêm vào giỏ] + [Mua ngay], rồi tìm nút trả chậm TRONG khối đó
    // (không tính nút "Trả chậm 0%" của sản phẩm gợi ý ở phía dưới trang)
    const scan = () => page.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const label = (el) => norm(el.innerText) || norm(el.getAttribute('aria-label')) || norm(el.title);
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      document.querySelectorAll('[data-qa-inst-btn]').forEach((e) => e.removeAttribute('data-qa-inst-btn'));

      const clickable = [...document.querySelectorAll('button, a, [role="button"]')]
        .filter(visible).filter((el) => { const t = label(el); return t && t.length <= 60; });
      const buy = clickable.filter((el) => /Mua ngay/i.test(label(el)));
      const add = clickable.filter((el) => /Thêm vào giỏ/i.test(label(el)));

      let bar = null;
      for (const b of buy) {
        let p = b.parentElement;
        for (let i = 0; i < 6 && p && p !== document.body; i++, p = p.parentElement) {
          if (add.some((a) => p.contains(a))) { bar = p; break; }
        }
        if (bar) break;
      }

      const inBar = bar ? clickable.filter((el) => bar.contains(el)) : [];
      const inst = inBar.filter((el) => /Trả chậm|Trả góp/i.test(label(el)));
      const info = inst.map((el) => {
        const cs = getComputedStyle(el);
        return {
          text: label(el),
          disabled: el.disabled === true || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
            || cs.pointerEvents === 'none' || cs.cursor === 'not-allowed',
        };
      });
      if (inst[0]) inst[0].setAttribute('data-qa-inst-btn', '1');

      const body = norm(document.body.innerText);
      return {
        bar: !!bar, buy: buy.length, add: add.length,
        labels: inBar.map(label).slice(0, 12),
        inst: info,
        instAnywhere: clickable.filter((el) => /Trả chậm\s*0\s*%/i.test(label(el))).length,
        stock: (body.match(/sắp về hàng|hàng sắp về|hết hàng|ngừng kinh doanh|tạm hết/i) || [null])[0],
      };
    });

    // ---- Bước 1: mở trang chi tiết SP G ----
    await openProduct(page, 'G');

    // Expected 1: đúng trang chi tiết SP G (không bị chuyển về trang danh mục/404)
    await expect(page, 'Phải ở đúng trang chi tiết SP G, không bị chuyển sang trang khác').toHaveURL(/lr03t/i);
    await expect(page.locator('h1').first(), 'Tên sản phẩm (h1) phải chứa mã LR03T').toContainText(/LR03T/i, { timeout: 10000 });
    const bodyText = (await page.locator('body').innerText()).replace(/\u00a0/g, ' ');
    expect.soft(bodyText, 'Trang không được báo lỗi / không tìm thấy').not.toMatch(/không tìm thấy trang|404/i);

    // Pre-condition: khu vực Hồ Chí Minh, chưa đăng nhập (kiểm tra mềm, ghi vào báo cáo)
    expect.soft(bodyText, 'Pre-condition: khu vực nhận hàng phải là Hồ Chí Minh').toMatch(/Hồ Chí Minh/i);
    expect.soft(bodyText, 'Pre-condition: phải ở trạng thái chưa đăng nhập').not.toMatch(/Đăng xuất/i);

    // ---- Bước 2: quan sát thanh mua hàng ----
    // Phải chờ thanh mua hàng hiện ra rồi mới kết luận "không có nút", tránh pass giả khi trang chưa tải xong
    let r = await scan();
    for (let i = 0; i < 24 && !r.bar; i++) {
      if (i === 8) await page.mouse.wheel(0, 700);
      await page.waitForTimeout(500);
      r = await scan();
    }
    await page.waitForTimeout(2000); // chờ thêm để nút trả chậm (nếu có) kịp hiển thị
    r = await scan();
    console.log(`[INST_Display_05] thanh mua hàng=${r.bar} | Thêm vào giỏ=${r.add} | Mua ngay=${r.buy} | nút trả chậm trong thanh=${JSON.stringify(r.inst)} | nút "Trả chậm 0%" toàn trang=${r.instAnywhere} | nút trong thanh: ${r.labels.join(' | ')} | tình trạng: ${r.stock}`);
    await test.info().attach('thanh-mua-hang-sp-g', { body: await page.screenshot(), contentType: 'image/png' });

    const hint = `Nút trong thanh mua hàng: [${r.labels.join(' | ') || 'không có'}]` +
      (r.stock ? `; trang có chữ "${r.stock}" (SP có thể không còn bán, kiểm tra lại Pre-condition SP G)` : '');
    expect(r.bar, `Pre-condition: SP G phải có thanh mua hàng ([Thêm vào giỏ], [Mua ngay]) để kết luận được. ${hint}`).toBe(true);

    // Expected 2 (trường hợp 1): không có nút [Trả chậm 0%] trong thanh mua hàng
    if (r.inst.length === 0) {
      expect(r.inst, `Không được có nút [Trả chậm 0%] trên SP G. ${hint}`).toEqual([]);
      test.info().annotations.push({ type: 'ket-qua', description: 'SP G không có nút [Trả chậm 0%] trong thanh mua hàng.' });
      return;
    }

    // Expected 2 (trường hợp 2): có nút nhưng bị vô hiệu -> đạt
    const instInfo = r.inst[0];
    if (instInfo.disabled) {
      expect(instInfo.disabled, `Nút "${instInfo.text}" phải bị vô hiệu`).toBe(true);
      test.info().annotations.push({ type: 'ket-qua', description: `Nút "${instInfo.text}" hiển thị nhưng bị vô hiệu.` });
      return;
    }

    // Expected 2 (trường hợp 3): có nút, còn bấm được -> click rồi phải có thông báo SP không hỗ trợ trả chậm
    const instBtn = page.locator('[data-qa-inst-btn]').first();
    await instBtn.scrollIntoViewIfNeeded();
    await instBtn.click();
    await page.waitForTimeout(1500);
    await test.info().attach('sau-khi-click-nut-tra-cham', { body: await page.screenshot(), contentType: 'image/png' });

    const dialogShown = await page.getByText('Chọn hình thức trả chậm').first().isVisible().catch(() => false);
    const afterText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const notice = afterText.match(/không hỗ trợ trả (?:chậm|góp)|không áp dụng trả (?:chậm|góp)/i);
    expect.soft(dialogShown, 'SP G không hỗ trợ: không được mở hộp thoại "Chọn hình thức trả chậm"').toBe(false);
    expect.soft(page.url(), 'Không được chuyển sang trang trả chậm').not.toMatch(/\/tra-cham/);
    expect.soft(!!notice, 'Nút còn bấm được thì phải có thông báo sản phẩm không hỗ trợ trả chậm').toBe(true);
    // Dừng tại đây: không chọn hình thức trả chậm nào
  });

  // TC 06: Hiển thị MWG Paylater trong danh sách phương thức thanh toán
    test('INST_Display_06 - Hiển thị MWG Paylater trong danh sách phương thức thanh toán', async ({ page }) => {
    test.setTimeout(150000);
    page.setDefaultTimeout(15000);

    // Tự đóng popup quảng cáo (lớp nền tối) nếu nó chặn thao tác
    const overlay = page.locator('div.cursor-pointer[class*="bg-[#1E1E1E]"]').first();
    await page.addLocatorHandler(overlay, async () => {
      await page.keyboard.press('Escape');
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
      }
    }, { noWaitAfter: true });

    // ---- Pre-condition: SP C trong giỏ, chưa đăng nhập, nhập thông tin nhận hàng rồi vào trang Thanh toán ----
    // 1. Thêm SP C vào giỏ từ trang chi tiết
    await openProduct(page, 'C');
    await expect(page, 'Phải ở đúng trang chi tiết SP C (Nồi cơm điện tử Sunhouse SHD8911)').toHaveURL(/shd8911/i);
    const addBtn = page.getByRole('button', { name: /Thêm vào giỏ/i }).first();
    await addBtn.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();
    await expect(page.getByText(/Đã thêm vào giỏ/i).first(), 'SP C phải được thêm vào giỏ').toBeVisible({ timeout: 10000 });

    // 2. Mở trang giỏ hàng
    await page.goto(CART_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await expect(page.getByRole('button', { name: 'Đặt mua' }).first(), 'Giỏ hàng phải có SP C và nút [Đặt mua]')
      .toBeVisible({ timeout: 15000 });

    // 3. Đảm bảo đang ở hình thức [Giao tận nơi] (hộp thoại địa chỉ chỉ có ở Giao tận nơi)
    const deliveryHome = page.locator('label').filter({ hasText: 'Giao tận nơi' }).first();
    if (await deliveryHome.isVisible({ timeout: 3000 }).catch(() => false)
      && !(await deliveryHome.isChecked().catch(() => true))) {
      await deliveryHome.click();
      await page.waitForTimeout(1000);
    }

    // 4. Bấm [Đặt mua]. Web có thể mở thẳng hộp thoại, hoặc hiện khối "Vui lòng cung cấp thông tin nhận hàng" trước
    const dialogTitle = page.getByText('Thông tin đặt hàng').filter({ visible: true }).first();
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await page.waitForTimeout(1000);

    // Chỉ click khối nhắc khi hộp thoại CHƯA mở (nếu đã mở, lớp nền tối sẽ chặn click khối này)
    if (!(await dialogTitle.isVisible({ timeout: 2000 }).catch(() => false))) {
      const provideInfo = page.getByText('Vui lòng cung cấp thông tin nhận hàng').filter({ visible: true }).first();
      if (await provideInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
        await provideInfo.click();
        await page.waitForTimeout(1500);
      }
    }
    await test.info().attach('hop-thoai-thong-tin-dat-hang', { body: await page.screenshot(), contentType: 'image/png' });
    await expect(dialogTitle, `Hộp thoại "Thông tin đặt hàng" chưa mở (đang ở ${page.url()})`).toBeVisible({ timeout: 8000 });

    // Khung hộp thoại: tổ tiên nhỏ nhất của tiêu đề có chứa nút [Xác nhận] đang hiển thị
    const markOrderDialog = () => dialogTitle.evaluate((el) => {
      document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
      let p = el;
      for (let i = 0; p && i < 15; i++, p = p.parentElement) {
        const hasConfirm = [...p.querySelectorAll('button')]
          .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
        if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
      }
      return false;
    });
    const orderDialog = page.locator('[data-qa-order="1"]');
    expect(await markOrderDialog(), 'Không xác định được khung hộp thoại Thông tin đặt hàng').toBe(true);

    // 5. Chọn địa chỉ TRƯỚC (giống chức năng 2), rồi mới nhập họ tên và số điện thoại
    await chooseAddressFlow(page);
    await page.waitForTimeout(1000);
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi chọn địa chỉ').toBe(true);

    // 6. Họ tên, số điện thoại (điền trong đúng hộp thoại, có kiểm tra giá trị)
    const nameInput = orderDialog.getByRole('textbox', { name: /Họ tên|Họ và tên/i }).first();
    await expect(nameInput, 'Phải có ô Họ và tên').toBeVisible({ timeout: 5000 });
    await nameInput.fill(TEST_CUSTOMER.fullName);
    const phoneInput = orderDialog.getByRole('textbox', { name: /Số điện thoại/i }).first();
    await expect(phoneInput, 'Phải có ô Số điện thoại').toBeVisible({ timeout: 5000 });
    await phoneInput.fill(TEST_CUSTOMER.phone);
    await expect(nameInput).toHaveValue(TEST_CUSTOMER.fullName);
    await expect(phoneInput).toHaveValue(TEST_CUSTOMER.phone);
    await test.info().attach('truoc-khi-xac-nhan-thong-tin', { body: await page.screenshot(), contentType: 'image/png' });

    // 7. Bấm [Xác nhận] TRONG hộp thoại này -> [Đặt mua] để sang trang Thanh toán
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập thông tin').toBe(true);
    const confirmBtn = orderDialog.getByRole('button', { name: 'Xác nhận', exact: true }).last();
    await expect(confirmBtn, 'Nút [Xác nhận] của hộp thoại phải bấm được').toBeEnabled({ timeout: 5000 });
    await confirmBtn.click({ timeout: 5000 });
    await expect(dialogTitle, 'Hộp thoại Thông tin đặt hàng phải đóng sau khi xác nhận').toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await expect(page, `Phải vào được trang Thanh toán (đang ở ${page.url()})`).toHaveURL(/\/checkout/, { timeout: 15000 });
    await test.info().attach('trang-thanh-toan', { body: await page.screenshot(), contentType: 'image/png' });

    // ---- Bước 1: cuộn tới phần "Chọn phương thức thanh toán" ----
    const title = page.getByText('Chọn phương thức thanh toán').first();
    await title.scrollIntoViewIfNeeded();

    // Expected 1: hiển thị danh sách phương thức thanh toán
    await expect(title, 'Phải hiển thị tiêu đề "Chọn phương thức thanh toán"').toBeVisible({ timeout: 10000 });
    const section = title.locator('xpath=ancestor::*[.//input[@type="radio"]][1]');
    expect.soft(await section.locator('input[type="radio"]').count(), 'Danh sách phải có từ 3 phương thức trở lên').toBeGreaterThanOrEqual(3);
    await expect.soft(section.getByText('Chuyển khoản ngân hàng', { exact: true }).first(), 'Phải có phương thức Chuyển khoản ngân hàng').toBeVisible();

    // ---- Bước 2: quan sát mục MWG Paylater ----
    const mwgName = section.getByText(/MWG\s*Pay\s*later/i).filter({ visible: true }).first();
    await expect(mwgName, 'Phải có mục MWG Paylater trong danh sách phương thức thanh toán').toBeVisible({ timeout: 10000 });
    await mwgName.scrollIntoViewIfNeeded();

    // Lấy khối của mục MWG Paylater: tổ tiên lớn nhất chưa chứa mục kế tiếp (Chuyển khoản ngân hàng)
    const mwg = await mwgName.evaluate((el) => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      let block = el;
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        if (/Chuyển khoản ngân hàng/i.test(norm(p.innerText))) break;
        block = p;
      }
      const reg = [...block.querySelectorAll('*')].find((e) => e.children.length === 0 && /^Đăng ký ngay$/i.test(norm(e.textContent)));
      const clickable = reg ? reg.closest('a, button, [role="button"]') : null;
      return {
        text: norm(block.innerText),
        hasRegister: !!reg,
        registerIsLinkOrButton: !!clickable,
        href: clickable ? clickable.getAttribute('href') : null,
      };
    });
    console.log('[INST_Display_06] mục MWG Paylater:', JSON.stringify(mwg));
    test.info().annotations.push({ type: 'muc-mwg-paylater', description: mwg.text });
    await test.info().attach('muc-mwg-paylater', { body: await page.screenshot(), contentType: 'image/png' });

    // Expected 2: MWG Paylater có liên kết [Đăng ký ngay], mô tả hạn mức, lãi suất 0%
    expect.soft(mwg.hasRegister, `Mục MWG Paylater phải có "Đăng ký ngay". Nội dung: ${mwg.text}`).toBe(true);
    expect.soft(mwg.registerIsLinkOrButton, '"Đăng ký ngay" phải là liên kết/nút bấm được').toBe(true);
    expect.soft(mwg.text, `Phải có mô tả hạn mức. Nội dung: ${mwg.text}`).toMatch(/Hạn mức/i);
    expect.soft(mwg.text, `Phải ghi lãi suất 0%. Nội dung: ${mwg.text}`).toMatch(/lãi suất\s*0\s*%/i);

    // ---- Home PayLater: có thể nằm trong phần "N hình thức thanh toán khác" (đang thu gọn) -> mở rộng để quan sát ----
    const homeName = () => section.getByText(/Home\s*Pay\s*later/i).filter({ visible: true }).first()
      .or(section.locator('img[alt*="Home" i]').first());
    if (!(await homeName().isVisible().catch(() => false))) {
      const toggle = page.getByText(/hình thức thanh toán khác|Xem thêm/).filter({ visible: true }).first();
      if (await toggle.isVisible().catch(() => false)) {
        await toggle.click();
        await page.waitForTimeout(1000);
      }
    }
    const homeVisible = await homeName().isVisible().catch(() => false);
    if (homeVisible) await homeName().scrollIntoViewIfNeeded();
    await test.info().attach('muc-home-paylater', { body: await page.screenshot(), contentType: 'image/png' });
    expect.soft(homeVisible, 'Phải có mục Home PayLater trong danh sách phương thức thanh toán (kể cả sau khi mở rộng)').toBe(true);

    // Dừng tại đây: không bấm [Đăng ký ngay], không chọn phương thức, không đặt hàng
  });
  /* --------------------------------------------------------------------------
   * PHẦN 2: MUA TRƯỚC TRẢ SAU (INST_Paylater)
   * -------------------------------------------------------------------------- */

  // TC 07: Chọn Mua trước trả sau chuyển sang trang giỏ hàng Mua trước trả sau
  test('INST_Paylater_01 - Chọn Mua trước trả sau chuyển sang trang giỏ hàng Mua trước trả sau', async ({ page }) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(15000);

    // Pre-condition + Bước 1: mở hộp thoại "Chọn hình thức trả chậm" của SP F, click "Mua trước trả sau (0%)"
    await goToBnplPage(page, 'F');

    // Expected 1: chuyển sang trang /tra-cham-bnpl
    await expect(page, `Phải chuyển sang trang /tra-cham-bnpl (đang ở ${page.url()})`).toHaveURL(/\/tra-cham-bnpl/);

    // Bước 2 / Expected 2: tiêu đề, SP F số lượng 1, đơn giá, quà tặng (nếu có), các khối của trang
    await expect(page.getByText('Giỏ Hàng Mua Trước Trả Sau').first(), 'Phải có tiêu đề "Giỏ Hàng Mua Trước Trả Sau"')
      .toBeVisible({ timeout: 10000 });

    // SP F: tìm dòng tên sản phẩm, đọc đơn giá ở các dòng ngay bên dưới
    const lines = (await page.locator('body').innerText())
      .replace(/\u00a0/g, ' ').split('\n').map((s) => s.trim()).filter(Boolean);
    const idx = lines.findIndex((l) => /65QNED70BSA/i.test(l));
    expect(idx, 'Phải có SP F (65QNED70BSA) trên trang').toBeGreaterThanOrEqual(0);
    const price = lines.slice(idx + 1, idx + 12).find((l) => /^\d[\d.]*\s*[₫đ]$/.test(l));
    expect(price, `Phải có đơn giá của SP F. Nội dung gần tên SP: ${JSON.stringify(lines.slice(idx, idx + 12))}`).toBeTruthy();
    expect(parseInt(price.replace(/[^\d]/g, ''), 10), 'Đơn giá SP F phải lớn hơn 0').toBeGreaterThan(0);
    await expect(page.locator(L.BNPL_QTY_INPUT).first(), 'SP F phải có số lượng 1').toHaveValue('1');

    // Quà tặng cùng sản phẩm (nếu có): chỉ ghi nhận, không bắt buộc
    console.log('[INST_Paylater_01] Có khối quà tặng:', lines.some((l) => l === 'Quà tặng cùng sản phẩm'));

    // Các khối còn lại: chọn đối tác, giao hàng, mã giảm, chi tiết thanh toán
    await expect(page.getByText('Chọn đối tác thanh toán').first(), 'Phải có khối chọn đối tác').toBeVisible();
    await expect(page.getByText('Giao tận nơi').first(), 'Phải có phần giao hàng').toBeVisible();
    await expect(page.getByText('Mã giảm', { exact: true }).first(), 'Phải có dòng [Mã giảm]').toBeVisible();
    await expect(page.getByText('Chi tiết thanh toán').first(), 'Phải có khối chi tiết thanh toán').toBeVisible();

    // Bước 3 / Expected 3: click mũi tên quay lại -> về trang chi tiết SP F
    const backBtn = page.locator('.narrow-icon').first();   // mũi tên quay lại (ghi từ codegen)
    await expect(backBtn, 'Không thấy mũi tên quay lại cạnh tiêu đề').toBeVisible();
    await backBtn.click();
    await expect(page, `Phải quay về trang chi tiết SP F (đang ở ${page.url()})`).toHaveURL(/65qned70bsa/i, { timeout: 15000 });

    // Giỏ hàng không bị thêm SP F
    await page.goto(CART_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    const cartText = await page.locator('body').innerText();
    expect(cartText, 'Giỏ hàng không được có SP F').not.toMatch(/65QNED70BSA/i);

    // Dừng tại đây: không chọn đối tác, không tạo hồ sơ/đơn
  });

  // TC 08: Hiển thị 3 đối tác thanh toán ở bước chọn đối tác
  test('INST_Paylater_02 - Hiển thị 3 đối tác thanh toán ở bước chọn đối tác', async ({ page }) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(15000);

    // 3 đối tác theo Expected. Nhận diện bằng chữ, alt/title/aria-label hoặc tên file ảnh (logo thường không có chữ).
    const PARTNERS = [
      { key: 'mwg', name: 'MWG Paylater', re: /mwg/i },
      { key: 'kredivo', name: 'Kredivo', re: /kredivo/i },
      { key: 'home', name: 'Home PayLater', re: /home\s*-?\s*pay\s*-?\s*later|homepaylater|home\s*credit/i },
    ];
    const reSrc = (re) => ({ source: re.source, flags: re.flags });

    // Quét khối "Chọn đối tác thanh toán": tìm khối, từng đối tác, và chất lượng từng logo
    const scanPartners = () => page.evaluate((partners) => {
      document.querySelectorAll('[data-qa-partner-root]').forEach((e) => e.removeAttribute('data-qa-partner-root'));
      const P = partners.map((p) => ({ key: p.key, name: p.name, re: new RegExp(p.re.source, p.re.flags) }));
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      // Gom mọi dấu hiệu nhận diện của một phần tử: chữ + alt/title/aria-label + tên file ảnh
      const sig = (el) => {
        const parts = [el.innerText];
        for (const e of [el, ...el.querySelectorAll('img, svg, source, [alt], [title], [aria-label]')]) {
          parts.push(e.getAttribute && e.getAttribute('alt'), e.getAttribute && e.getAttribute('title'),
            e.getAttribute && e.getAttribute('aria-label'), e.currentSrc || (e.getAttribute && (e.getAttribute('src') || e.getAttribute('data-src'))));
        }
        return norm(parts.filter(Boolean).join(' '));
      };

      const heading = [...document.querySelectorAll('*')].find((el) =>
        visible(el) && el.children.length === 0 && /^Chọn đối tác thanh toán/i.test(norm(el.textContent)));
      if (!heading) return { heading: false };

      // Khối đối tác = tổ tiên gần nhất của tiêu đề có chứa đủ 3 đối tác (nếu không có: chứa nhiều đối tác nhất)
      let root = null, best = null, bestN = 0, p = heading.parentElement;
      for (let i = 0; i < 8 && p && p !== document.body; i++, p = p.parentElement) {
        const s = sig(p), n = P.filter((x) => x.re.test(s)).length;
        if (n === P.length) { root = p; break; }
        if (n > bestN) { best = p; bestN = n; }
      }
      root = root || best;
      if (!root) return { heading: true, root: false, partners: {} };
      root.setAttribute('data-qa-partner-root', '1');

      const partnersOut = {};
      for (const x of P) {
        const others = P.filter((y) => y.key !== x.key);
        // Khối đối tác = phần tử ngoài cùng có dấu hiệu của đối tác này nhưng KHÔNG có dấu hiệu của đối tác khác
        const cands = [...root.querySelectorAll('*')].filter((el) => {
          const s = sig(el);
          return visible(el) && x.re.test(s) && !others.some((y) => y.re.test(s)) && norm(el.innerText).length <= 300;
        });
        const card = cands.find((el) => !cands.some((c) => c !== el && c.contains(el)));
        if (!card) { partnersOut[x.key] = { found: false }; continue; }
        const cardRect = card.getBoundingClientRect();

        // Logo: <img>, <svg> hoặc phần tử có ảnh nền CSS (chỉ tính hình đủ lớn, bỏ icon nhỏ)
        const logos = [];
        for (const img of card.querySelectorAll('img')) {
          if (!visible(img)) continue;
          const r = img.getBoundingClientRect(), cs = getComputedStyle(img);
          const src = img.currentSrc || img.src || '';
          const isSvg = /\.svg(\?|$)|^data:image\/svg/i.test(src);
          logos.push({
            kind: 'img', src: src.slice(0, 120), alt: img.alt || '', complete: img.complete, nw: img.naturalWidth, nh: img.naturalHeight,
            w: Math.round(r.width), h: Math.round(r.height), isSvg, objectFit: cs.objectFit,
            outside: r.left < cardRect.left - 1 || r.right > cardRect.right + 1 || r.top < cardRect.top - 1 || r.bottom > cardRect.bottom + 1,
          });
        }
        for (const sv of card.querySelectorAll('svg')) {
          if (!visible(sv) || sv.closest('img')) continue;
          const r = sv.getBoundingClientRect();
          if (r.width >= 24 && r.height >= 12) logos.push({ kind: 'svg', w: Math.round(r.width), h: Math.round(r.height), complete: true });
        }
        for (const el of [card, ...card.querySelectorAll('*')]) {
          const bg = getComputedStyle(el).backgroundImage;
          if (bg && bg !== 'none' && /url\(/.test(bg) && visible(el)) {
            const r = el.getBoundingClientRect();
            if (r.width >= 24 && r.height >= 12) logos.push({ kind: 'bg', w: Math.round(r.width), h: Math.round(r.height), complete: true });
          }
        }
        partnersOut[x.key] = { found: true, text: norm(card.innerText), logos, cardW: Math.round(cardRect.width), cardH: Math.round(cardRect.height) };
      }
      return { heading: true, root: true, partners: partnersOut, rootText: norm(root.innerText).slice(0, 300), dpr: window.devicePixelRatio };
    }, PARTNERS.map((p) => ({ key: p.key, name: p.name, re: reSrc(p.re) })));

    // ---- Pre-condition: SP F, đang ở trang /tra-cham-bnpl ----
    await goToBnplPage(page, 'F');
    // Phải kiểm tra URL: tên 3 đối tác cũng xuất hiện trong hộp thoại ở trang SP, nên nếu chưa sang trang BNPL test sẽ pass sai
    await expect(page, `Pre-condition: phải ở trang /tra-cham-bnpl (đang ở ${page.url()})`).toHaveURL(/\/tra-cham-bnpl/);
    expect.soft(await page.locator('body').innerText(), 'Pre-condition: trang phải của SP F').toMatch(/65QNED70BSA/i);

    // ---- Bước 1: quan sát khối "Chọn đối tác thanh toán" ----
    const headingLoc = page.getByText('Chọn đối tác thanh toán').first();
    await expect(headingLoc, 'Phải có khối "Chọn đối tác thanh toán"').toBeVisible({ timeout: 10000 });
    await headingLoc.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 200); // kích hoạt ảnh tải chậm (lazy) nếu có
    await page.waitForTimeout(500);

    // Chờ logo tải xong (tối đa ~10s)
    let r = await scanPartners();
    const allLoaded = (x) => x.root && PARTNERS.every((p) => x.partners[p.key] && x.partners[p.key].found &&
      x.partners[p.key].logos.every((l) => l.complete));
    for (let i = 0; i < 20 && !allLoaded(r); i++) {
      await page.waitForTimeout(500);
      r = await scanPartners();
    }
    console.log('[INST_Paylater_02]', JSON.stringify(r));
    const rootLoc = page.locator('[data-qa-partner-root]').first();
    const shot = await rootLoc.screenshot().catch(() => page.screenshot());
    await test.info().attach('khoi-chon-doi-tac', { body: shot, contentType: 'image/png' });

    expect(r.heading && r.root, 'Phải xác định được khối chứa các đối tác thanh toán').toBe(true);

    // ---- Expected 1: hiển thị đủ 3 đối tác, logo rõ nét, không vỡ ----
    for (const p of PARTNERS) {
      const x = r.partners[p.key];
      expect.soft(x && x.found, `Phải hiển thị đối tác ${p.name}`).toBe(true);
      if (!x || !x.found) continue;

      expect.soft(x.logos.length, `Đối tác ${p.name} phải có logo (hiện chỉ thấy: "${x.text}")`).toBeGreaterThan(0);

      x.logos.forEach((l, i) => {
        const tag = `Logo ${p.name}${x.logos.length > 1 ? ` #${i + 1}` : ''} (${l.kind}${l.src ? `: ${l.src.slice(-60)}` : ''})`;
        // Không vỡ ảnh: tải thành công
        if (l.kind === 'img') {
          expect.soft(l.complete && l.nw > 0, `${tag} bị lỗi tải ảnh (complete=${l.complete}, naturalWidth=${l.nw})`).toBe(true);
          if (!(l.complete && l.nw > 0)) return;
        }
        // Đủ lớn để nhìn
        expect.soft(l.w >= 32 && l.h >= 16, `${tag} quá nhỏ (${l.w}x${l.h}px, cần >= 32x16)`).toBe(true);
        if (l.kind !== 'img') return;
        // Không tràn ra ngoài khối đối tác
        expect.soft(l.outside, `${tag} bị tràn/cắt ra ngoài khung đối tác`).toBe(false);
        if (l.isSvg) return; // ảnh vector luôn sắc nét
        // Rõ nét: độ phân giải gốc không được nhỏ hơn kích thước hiển thị (nếu nhỏ hơn là ảnh bị phóng to -> mờ)
        expect.soft(l.nw / l.w, `${tag} bị mờ: ảnh gốc ${l.nw}x${l.nh}px nhưng hiển thị ${l.w}x${l.h}px`).toBeGreaterThanOrEqual(0.95);
        // Không méo hình (chỉ kiểm khi ảnh bị kéo giãn theo khung)
        if (l.objectFit === 'fill' && l.nh > 0 && l.h > 0) {
          const distortion = Math.abs((l.w / l.h) / (l.nw / l.nh) - 1);
          expect.soft(distortion, `${tag} bị méo tỷ lệ (gốc ${l.nw}x${l.nh}, hiển thị ${l.w}x${l.h})`).toBeLessThanOrEqual(0.05);
        }
      });
    }

    if (r.partners && PARTNERS.some((p) => r.partners[p.key] && r.partners[p.key].logos.some((l) => l.kind === 'bg'))) {
      manual('Một số logo là ảnh nền CSS nên script không đo được độ nét; kiểm tra bằng mắt.');
    }
    manual('Logo rõ nét, không vỡ: đối chiếu thêm bằng mắt với ảnh đính kèm "khoi-chon-doi-tac".');

    // KHÔNG click đối tác nào -> không chuyển bước, không tạo hồ sơ
  });

  // TC 09: Chọn từng đối tác thanh toán chuyển sang bước tiếp theo
  test('INST_Paylater_03 - Chọn từng đối tác thanh toán chuyển sang bước tiếp theo', async ({ page }) => {
    test.setTimeout(240000);
    page.setDefaultTimeout(15000);
    manual('Chỉ kiểm tra chuyển sang giao diện đối tác, không tạo tài khoản hoặc vay thật');

    // 3 đối tác theo thứ tự trong Steps.
    //  - id   : nhận diện thẻ đối tác (chữ/alt/title/tên file logo)
    //  - title: tiêu đề hộp thoại hướng dẫn của ĐÚNG đối tác đó
    const PARTNERS = [
      { key: 'mwg', name: 'MWG Paylater', id: /mwg/i, title: /Hướng dẫn thanh toán qua\s*MWG\s*Pay\s*later/i },
      { key: 'kredivo', name: 'Kredivo', id: /kredivo/i, title: /Hướng dẫn thanh toán qua\s*Kredivo/i },
      { key: 'home', name: 'Home PayLater', id: /home\s*-?\s*pay\s*-?\s*later|homepaylater|home\s*credit/i,
        title: /Hướng dẫn thanh toán qua\s*Home\s*Pay\s*later/i },
    ];
    const reSrc = (re) => ({ source: re.source, flags: re.flags });
    const REMINDER = 'Vui lòng cung cấp thông tin nhận hàng';

    // Đánh dấu thẻ đối tác trong khối "Chọn đối tác thanh toán" để click chính xác
    const markPartner = (p) => page.evaluate(({ id, key }) => {
      document.querySelectorAll('[data-qa-partner-card]').forEach((e) => e.removeAttribute('data-qa-partner-card'));
      const idRe = new RegExp(id.source, id.flags);
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const sig = (el) => {
        const parts = [el.innerText];
        for (const e of [el, ...el.querySelectorAll('img, svg, [alt], [title], [aria-label]')]) {
          parts.push(e.getAttribute && e.getAttribute('alt'), e.getAttribute && e.getAttribute('title'),
            e.getAttribute && e.getAttribute('aria-label'), e.currentSrc || (e.getAttribute && e.getAttribute('src')));
        }
        return norm(parts.filter(Boolean).join(' '));
      };
      const heading = [...document.querySelectorAll('*')].find((el) =>
        visible(el) && el.children.length === 0 && /^Chọn đối tác thanh toán/i.test(norm(el.textContent)));
      if (!heading) return { ok: false, why: 'không thấy khối "Chọn đối tác thanh toán"' };
      let root = heading.parentElement;
      for (let i = 0; i < 8 && root && root !== document.body && !idRe.test(sig(root)); i++) root = root.parentElement;
      if (!root || root === document.body) return { ok: false, why: `không thấy đối tác ${key} trong khối` };
      const others = [/mwg/i, /kredivo/i, /home\s*-?\s*pay\s*-?\s*later|homepaylater|home\s*credit/i].filter((r) => r.source !== idRe.source);
      const cands = [...root.querySelectorAll('*')].filter((el) => {
        const s = sig(el);
        return visible(el) && idRe.test(s) && !others.some((r) => r.test(s)) && norm(el.innerText).length <= 300;
      });
      const card = cands.find((el) => !cands.some((c) => c !== el && c.contains(el)));
      if (!card) return { ok: false, why: `không xác định được thẻ đối tác ${key}` };
      card.setAttribute('data-qa-partner-card', key);
      return { ok: true };
    }, { id: reSrc(p.id), key: p.key });

    // Dấu hiệu "đã chọn" của thẻ đối tác: class/aria/viền/bóng/nền/dấu tick (svg, input) của thẻ và 2 lớp cha
    const selectedSignature = () => page.evaluate(() => {
      const card = document.querySelector('[data-qa-partner-card]');
      if (!card) return null;
      const cs = getComputedStyle(card);
      const anc = [card, card.parentElement, card.parentElement && card.parentElement.parentElement].filter(Boolean);
      return [...anc.map((e) => `${e.className}|${e.getAttribute('aria-selected')}|${e.getAttribute('aria-checked')}`),
        cs.borderColor, cs.boxShadow, cs.backgroundColor, cs.outlineStyle,
        card.querySelectorAll('svg, img').length, [...card.querySelectorAll('input')].map((i) => i.checked).join(',')].join('#');
    });

    // Cung cấp thông tin nhận hàng (Pre-condition)
    const provideReceiverInfo = async () => {
      const dialogTitle = page.getByText('Thông tin đặt hàng').filter({ visible: true }).first();
      const reminder = page.getByText(REMINDER).filter({ visible: true }).first();

      // Chỉ click dòng nhắc khi hộp thoại CHƯA mở (nếu đã mở, lớp nền tối sẽ chặn click dòng này)
      if (!(await dialogTitle.isVisible({ timeout: 1500 }).catch(() => false))) {
        if (!(await reminder.isVisible({ timeout: 3000 }).catch(() => false))) return;
        await reminder.click();
        await page.waitForTimeout(1500);
      }

      if (!(await dialogTitle.isVisible({ timeout: 4000 }).catch(() => false))) {
        // Giao diện popup "Thông tin nhận hàng" của trang BNPL (không phải hộp thoại Thông tin đặt hàng)
        await fillReceiverInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone });
      } else {
        const markOrderDialog = () => dialogTitle.evaluate((el) => {
          document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
          let p = el;
          for (let i = 0; p && i < 15; i++, p = p.parentElement) {
            const hasConfirm = [...p.querySelectorAll('button')]
              .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
            if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
          }
          return false;
        });
        expect(await markOrderDialog(), 'Không xác định được khung hộp thoại Thông tin đặt hàng').toBe(true);

        await chooseAddressFlow(page);                                                                   // địa chỉ TRƯỚC
        await page.waitForTimeout(1000);
        await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone });     // rồi họ tên + SĐT
        expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập thông tin').toBe(true);

        // Bấm [Xác nhận] TRONG hộp thoại này (không dùng nút "Xác nhận" ở chỗ khác trên trang)
        const confirmBtn = page.locator('[data-qa-order="1"]').getByRole('button', { name: 'Xác nhận', exact: true }).last();
        await expect(confirmBtn, 'Nút [Xác nhận] của hộp thoại phải bấm được').toBeEnabled({ timeout: 5000 });
        await confirmBtn.click({ timeout: 5000 });
        await expect(dialogTitle, 'Hộp thoại Thông tin đặt hàng phải đóng sau khi xác nhận').toBeHidden({ timeout: 10000 });
      }
      await page.waitForTimeout(1500);
    };
    const assertReceiverInfoProvided = async (where) => {
      const dlg = (await page.locator('[role="dialog"], [id^="modal-"]').filter({ visible: true }).allInnerTexts().catch(() => [])).join(' | ').slice(0, 200);
      await expect(page.getByText(REMINDER).first(),
        `Pre-condition (${where}): phải nhập được thông tin nhận hàng hợp lệ, dòng nhắc vẫn còn hiển thị. Hộp thoại đang mở: "${dlg}"`)
        .toBeHidden({ timeout: 8000 });
    };

    // ---- Pre-condition: SP F, đang ở trang /tra-cham-bnpl, đã nhập thông tin nhận hàng hợp lệ ----
    await goToBnplPage(page, 'F');
    await expect(page, `Pre-condition: phải ở trang /tra-cham-bnpl (đang ở ${page.url()})`).toHaveURL(/\/tra-cham-bnpl/);
    await provideReceiverInfo();
    await assertReceiverInfoProvided('trang /tra-cham-bnpl');
    await expect(page.getByText('Chọn đối tác thanh toán').first(), 'Phải có khối "Chọn đối tác thanh toán"').toBeVisible({ timeout: 10000 });
    const results = [];

    // ---- Steps 1-3: lần lượt click MWG Paylater, Kredivo, Home PayLater ----
    for (const [i, p] of PARTNERS.entries()) {
      const stepNo = i + 1;
      const mark = await markPartner(p);
      expect(mark.ok, `Bước ${stepNo}: phải tìm thấy đối tác ${p.name} (${mark.why || ''})`).toBe(true);
      const card = page.locator(`[data-qa-partner-card="${p.key}"]`).first();
      await card.scrollIntoViewIfNeeded();
      await expect(card, `Bước ${stepNo}: đối tác ${p.name} phải hiển thị để click`).toBeVisible();

      const selBefore = await selectedSignature();
      await card.click(); // chỉ click đối tác

      // Expected: hộp thoại "Hướng dẫn thanh toán qua <đối tác>" của ĐÚNG đối tác
      const guideTitle = page.getByText(p.title).filter({ visible: true }).first(); // chỉ lấy tiêu đề đang HIỂN THỊ (trang có thể giữ sẵn hộp thoại ẩn)
      const shown = await guideTitle.isVisible({ timeout: 10000 }).catch(() => false);
      const openDialogs = (await page.locator('[role="dialog"], [id^="modal-"]').filter({ visible: true }).allInnerTexts().catch(() => []))
        .map((t) => t.replace(/\s+/g, ' ').slice(0, 120)).join(' | ');
      await test.info().attach(`buoc-${stepNo}-${p.key}`, { body: await page.screenshot(), contentType: 'image/png' });
      expect.soft(shown, `Bước ${stepNo}: chọn ${p.name} phải hiện hộp thoại "Hướng dẫn thanh toán qua ${p.name}". Hộp thoại đang mở: [${openDialogs || 'không có'}]. URL: ${page.url()}`).toBe(true);

      // Đối tác được chọn: thẻ đổi trạng thái (viền xanh, dấu tick)
      const selAfter = await selectedSignature();
      expect.soft(selBefore !== null && selAfter !== null && selBefore !== selAfter,
        `Bước ${stepNo}: thẻ ${p.name} phải được đánh dấu "đã chọn" (viền xanh/dấu tick)`).toBe(true);

      let guideText = '', doneBtn = null;
      if (shown) {
        // Khối hộp thoại = tổ tiên gần nhất của tiêu đề có chứa nút [Xong]
        const dialog = guideTitle.locator('xpath=ancestor::*[.//button[normalize-space()="Xong"]][1]');
        guideText = ((await dialog.innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
        doneBtn = dialog.getByRole('button', { name: 'Xong', exact: true });
        const stepCount = (guideText.match(/Bước\s*\d/g) || []).length;
        expect.soft(stepCount, `Bước ${stepNo}: hướng dẫn của ${p.name} phải có các bước (Bước 1, 2, 3). Nội dung: ${guideText.slice(0, 200)}`).toBeGreaterThanOrEqual(2);
        expect.soft(guideText, `Bước ${stepNo}: hướng dẫn của ${p.name} phải nhắc tới ${p.name}`).toMatch(p.id);
        await expect.soft(doneBtn, `Bước ${stepNo}: hộp thoại phải có nút [Xong]`).toBeVisible();
      }
      expect.soft(page.url(), `Bước ${stepNo}: vẫn ở trang chọn đối tác /tra-cham-bnpl`).toMatch(/\/tra-cham-bnpl/);
      results.push(`${p.name}: ${shown ? 'có hướng dẫn' : 'KHÔNG có hướng dẫn'}`);
      console.log(`[INST_Paylater_03] ${p.name} | hướng dẫn=${shown} | đổi trạng thái chọn=${selBefore !== selAfter} | ${guideText.slice(0, 160)}`);

      // "Quay lại": đóng hộp thoại hướng dẫn bằng [Xong] (chỉ đóng, không thao tác gì khác) để chọn đối tác kế tiếp
      // Nếu hiện hộp thoại khác/sai tiêu đề thì vẫn đóng bằng [Xong] để không chặn click đối tác kế tiếp
      const anyDone = page.getByRole('button', { name: 'Xong', exact: true }).filter({ visible: true }).first();
      if (shown && doneBtn && await doneBtn.isVisible().catch(() => false)) await doneBtn.click();
      else if (await anyDone.isVisible().catch(() => false)) await anyDone.click();
      else await page.keyboard.press('Escape').catch(() => {});
      await expect(guideTitle, `Bước ${stepNo}: hộp thoại hướng dẫn phải đóng được sau khi bấm [Xong]`).toBeHidden({ timeout: 8000 });
      await expect(page.getByText('Chọn đối tác thanh toán').first(), 'Sau khi đóng hộp thoại phải thấy lại khối chọn đối tác').toBeVisible();
    }

    test.info().annotations.push({ type: 'ket-qua-doi-tac', description: results.join(' | ') });
    manual('Nội dung hướng dẫn của từng đối tác (tải ứng dụng, đăng ký, chờ duyệt hạn mức, thanh toán): xem ảnh đính kèm buoc-1..3. Không bấm link tải/đăng ký/vay thật.');
    // DỪNG ở hộp thoại hướng dẫn: không đăng ký, không nhập thông tin, không tạo hồ sơ.
  });

  // TC 10: Không thể tiếp tục khi chưa cung cấp thông tin nhận hàng
    test('INST_Paylater_04 - Không thể tiếp tục khi chưa cung cấp thông tin nhận hàng', async ({ page }) => {
    test.setTimeout(240000);
    page.setDefaultTimeout(15000);

    const REMINDER = 'Vui lòng cung cấp thông tin nhận hàng';
    const KREDIVO = { key: 'kredivo', name: 'Kredivo', id: /kredivo/i, title: /Hướng dẫn thanh toán qua\s*Kredivo/i };
    const reSrc = (re) => ({ source: re.source, flags: re.flags });

    // Đánh dấu thẻ đối tác trong khối "Chọn đối tác thanh toán" để click chính xác (giống INST_Paylater_03)
    const markPartner = (p) => page.evaluate(({ id, key }) => {
      document.querySelectorAll('[data-qa-partner-card]').forEach((e) => e.removeAttribute('data-qa-partner-card'));
      const idRe = new RegExp(id.source, id.flags);
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const sig = (el) => {
        const parts = [el.innerText];
        for (const e of [el, ...el.querySelectorAll('img, svg, [alt], [title], [aria-label]')]) {
          parts.push(e.getAttribute && e.getAttribute('alt'), e.getAttribute && e.getAttribute('title'),
            e.getAttribute && e.getAttribute('aria-label'), e.currentSrc || (e.getAttribute && e.getAttribute('src')));
        }
        return norm(parts.filter(Boolean).join(' '));
      };
      const heading = [...document.querySelectorAll('*')].find((el) =>
        visible(el) && el.children.length === 0 && /^Chọn đối tác thanh toán/i.test(norm(el.textContent)));
      if (!heading) return { ok: false, why: 'không thấy khối "Chọn đối tác thanh toán"' };
      let root = heading.parentElement;
      for (let i = 0; i < 8 && root && root !== document.body && !idRe.test(sig(root)); i++) root = root.parentElement;
      if (!root || root === document.body) return { ok: false, why: `không thấy đối tác ${key} trong khối` };
      const others = [/mwg/i, /kredivo/i, /home\s*-?\s*pay\s*-?\s*later|homepaylater|home\s*credit/i].filter((r) => r.source !== idRe.source);
      const cands = [...root.querySelectorAll('*')].filter((el) => {
        const s = sig(el);
        return visible(el) && idRe.test(s) && !others.some((r) => r.test(s)) && norm(el.innerText).length <= 300;
      });
      const card = cands.find((el) => !cands.some((c) => c !== el && c.contains(el)));
      if (!card) return { ok: false, why: `không xác định được thẻ đối tác ${key}` };
      card.setAttribute('data-qa-partner-card', key);
      return { ok: true };
    }, { id: reSrc(p.id), key: p.key });

    // Nhập địa chỉ (2 màn hình) giống INST_Paylater_03: không dùng `[id^="modal-"]`.last() vì trang BNPL còn hộp thoại ẩn khác
    const chooseAddress = () => chooseAddressFlow(page);

    // ---- Pre-condition: SP F, đang ở /tra-cham-bnpl, CHƯA nhập thông tin nhận hàng ----
    await goToBnplPage(page, 'F');
    await expect(page, `Pre-condition: phải ở trang /tra-cham-bnpl (đang ở ${page.url()})`).toHaveURL(/\/tra-cham-bnpl/);
    const bnplUrl = page.url();

    // ---- Bước 1: quan sát dòng "Vui lòng cung cấp thông tin nhận hàng" ----
    const infoRow = page.getByText(REMINDER).first();
    await expect(infoRow, 'Pre-condition: chưa nhập thông tin nên phải có dòng nhắc nhập thông tin nhận hàng')
      .toBeVisible({ timeout: 10000 });
    await infoRow.scrollIntoViewIfNeeded();
    await test.info().attach('buoc-1-dong-nhac', { body: await page.screenshot(), contentType: 'image/png' });

    // Expected 1: dòng nhắc hiển thị màu cam (đã chạy được: chữ rgb(252, 118, 0))
    const colorInfo = await infoRow.evaluate((el) => {
      const parse = (c) => {
        const m = (c || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
        if (!m) return null;
        return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
      };
      const isOrange = ({ r, g, b, a }) => {
        if (a < 0.2) return false;
        const rr = r / 255, gg = g / 255, bb = b / 255;
        const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
        if (d === 0) return false;
        const l = (max + min) / 2;
        const s = d / (1 - Math.abs(2 * l - 1));
        let h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
        h = (h * 60 + 360) % 360;
        return h >= 10 && h <= 50 && s >= 0.45 && l >= 0.25 && l <= 0.97;
      };
      const found = [];
      let node = el;
      for (let i = 0; i < 5 && node && node !== document.body; i++, node = node.parentElement) {
        const cs = getComputedStyle(node);
        const props = { 'chữ': cs.color, 'nền': cs.backgroundColor, 'viền': parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : null };
        for (const [k, v] of Object.entries(props)) {
          const c = v && parse(v);
          if (c) found.push({ cap: i, loai: k, mau: v, cam: isOrange(c) });
        }
        node.querySelectorAll('svg, svg *').forEach((s) => {
          const scs = getComputedStyle(s);
          for (const [k, v] of Object.entries({ 'icon-fill': scs.fill, 'icon-stroke': scs.stroke })) {
            const c = v && parse(v);
            if (c) found.push({ cap: i, loai: k, mau: v, cam: isOrange(c) });
          }
        });
      }
      return { anyOrange: found.some((f) => f.cam), found: found.filter((f) => f.cam).concat(found.slice(0, 6)) };
    });
    expect.soft(colorInfo.anyOrange, `Dòng nhắc nhập thông tin phải màu cam. Màu đọc được: ${JSON.stringify(colorInfo.found)}`).toBe(true);

    // ---- Bước 2: chọn đối tác thanh toán khi chưa nhập thông tin ----
    const snapshot = () => page.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const texts = [...document.querySelectorAll('body *')]
        .filter((e) => e.children.length === 0 && visible(e))
        .map((e) => norm(e.textContent)).filter((t) => t && t.length <= 200);
      const dialog = [...document.querySelectorAll('[id^="modal-"], [role="dialog"]')]
        .filter(visible).map((e) => norm(e.innerText)).filter(Boolean);
      return { texts, dialog, scrollY: Math.round(window.scrollY) };
    });
    const before = await snapshot();
    const beforeTexts = new Set(before.texts);

    const mark = await markPartner(KREDIVO);
    expect(mark.ok, `Phải tìm thấy đối tác ${KREDIVO.name} (${mark.why || ''})`).toBe(true);
    const card = page.locator(`[data-qa-partner-card="${KREDIVO.key}"]`).first();
    await card.scrollIntoViewIfNeeded();
    await expect(card, `Đối tác ${KREDIVO.name} phải hiển thị để click`).toBeVisible();
    await card.click();

    // Theo dõi 4 giây: gom mọi dòng chữ MỚI xuất hiện (toast có thể biến mất nhanh)
    const askRe = /thông tin|cung cấp|vui lòng|nhập|địa chỉ|nhận hàng/i;
    const newTexts = new Set();
    let after = before;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(100);
      after = await snapshot();
      after.texts.forEach((t) => { if (!beforeTexts.has(t)) newTexts.add(t); });
      if (after.dialog.length > before.dialog.length) break;
      if ([...newTexts].some((t) => askRe.test(t)) && i >= 5) break;
    }
    const newList = [...newTexts];
    const askInfo = newList.filter((t) => askRe.test(t));
    const dialogOpened = after.dialog.length > before.dialog.length;
    const guideShown = await page.getByText(KREDIVO.title).filter({ visible: true }).first().isVisible().catch(() => false);
    console.log('[INST_Paylater_05] chữ mới xuất hiện:', JSON.stringify(newList), '| mở hộp thoại:', dialogOpened,
      '| hiện hướng dẫn đối tác:', guideShown, '| trang cuộn:', after.scrollY !== before.scrollY, '| URL:', page.url());
    await test.info().attach('buoc-2-sau-khi-chon-doi-tac', { body: await page.screenshot(), contentType: 'image/png' });

    // Expected 2: không tiếp tục được (không mở hướng dẫn đối tác, vẫn ở /tra-cham-bnpl)
    expect(guideShown, 'Chưa có thông tin nhận hàng thì không được mở hộp thoại "Hướng dẫn thanh toán qua Kredivo"').toBe(false);
    expect(page.url(), 'Chưa có thông tin nhận hàng thì không được chuyển sang bước/đối tác tiếp theo').toBe(bnplUrl);
    // ... và có thông báo yêu cầu cung cấp thông tin nhận hàng (chữ thông báo mới, hoặc mở hộp thoại nhập thông tin)
    expect(askInfo.length > 0 || dialogOpened,
      `Phải có thông báo yêu cầu cung cấp thông tin nhận hàng. Chữ mới: ${JSON.stringify(newList)} | trang cuộn: ${after.scrollY !== before.scrollY}`).toBe(true);
    test.info().annotations.push({
      type: 'thong-bao',
      description: askInfo.length ? askInfo.join(' | ') : 'Web mở hộp thoại nhập thông tin nhận hàng',
    });

    // ---- Bước 3: click dòng thông tin nhận hàng, nhập họ tên, SĐT, địa chỉ hợp lệ, xác nhận ----
    const dialogTitle = page.getByText('Thông tin đặt hàng').first();
    if (!(await dialogTitle.isVisible({ timeout: 1500 }).catch(() => false))) {
      await infoRow.click();
      await page.waitForTimeout(1500);
    }
    await test.info().attach('buoc-3-hop-thoai', { body: await page.screenshot(), contentType: 'image/png' });
    await expect(dialogTitle, `Hộp thoại nhập thông tin nhận hàng chưa mở (đang ở ${page.url()})`).toBeVisible({ timeout: 5000 });

    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone }); // họ tên + SĐT
    await chooseAddress();                                                                          // địa chỉ
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
    await expect(dialogTitle).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await test.info().attach('buoc-3-sau-khi-xac-nhan', { body: await page.screenshot(), contentType: 'image/png' });
        // Expected 3: thông tin được lưu, dòng nhắc đổi thành thông tin nhận hàng đã nhập
    await expect(page.getByText(REMINDER), 'Dòng nhắc phải biến mất sau khi nhập thông tin').toHaveCount(0, { timeout: 10000 });
    await expect.soft(page.getByText(TEST_CUSTOMER.fullName).first(), 'Phải hiển thị họ tên đã nhập').toBeVisible();
    await expect.soft(page.getByText(TEST_CUSTOMER.phone).first(), 'Phải hiển thị số điện thoại đã nhập').toBeVisible();
    await expect.soft(page.getByText(TEST_CUSTOMER.ward).first(), 'Phải hiển thị địa chỉ đã nhập (Phường/Xã)').toBeVisible();
    // Dừng tại đây: không chọn đối tác, không tạo hồ sơ vay
  });

  // TC 11: Chọn hình thức nhận hàng trên trang Mua trước trả sau
    test('INST_Paylater_05 - Chọn hình thức nhận hàng trên trang Mua trước trả sau', async ({ page }) => {
    test.setTimeout(120000);

    const REMINDER = 'Vui lòng cung cấp thông tin nhận hàng';

    // ---- Pre-condition: SP F, đang ở /tra-cham-bnpl, chưa nhập thông tin nhận hàng ----
    await goToBnplPage(page, 'F');
    await expect(page, `Pre-condition: phải ở trang /tra-cham-bnpl (đang ở ${page.url()})`).toHaveURL(/\/tra-cham-bnpl/);

    const homeDelivery = page.locator('label').filter({ hasText: 'Giao tận nơi' }).first();
    const storePickup = page.locator('label').filter({ hasText: 'Nhận tại siêu thị' }).first();
    const reminder = page.getByText(REMINDER).filter({ visible: true }).first();
    const dialogTitle = page.getByText('Thông tin đặt hàng').filter({ visible: true }).first();

    await expect(reminder, `Pre-condition: phải đang hiển thị dòng "${REMINDER}"`).toBeVisible({ timeout: 10000 });

    // ---- Bước 1: quan sát lựa chọn mặc định ----
    await expect(homeDelivery, 'Phải có lựa chọn [Giao tận nơi]').toBeVisible({ timeout: 10000 });
    await expect(storePickup, 'Phải có lựa chọn [Nhận tại siêu thị]').toBeVisible({ timeout: 10000 });
    // Expected 1: mặc định chọn [Giao tận nơi]
    await expect(homeDelivery, 'Mặc định phải chọn Giao tận nơi').toBeChecked();
    await expect.soft(storePickup, 'Mặc định không được chọn Nhận tại siêu thị').not.toBeChecked();
    await test.info().attach('buoc-1-mac-dinh', { body: await page.screenshot(), contentType: 'image/png' });

    // ---- Bước 2: click [Nhận tại siêu thị] ----
    await storePickup.scrollIntoViewIfNeeded();
    await storePickup.click();
    await page.waitForTimeout(1500);

    // Expected 2: hiển thị phần chọn siêu thị nhận hàng ("Vui lòng cung cấp thông tin nhận hàng")
    await expect(storePickup, 'Phải chọn được Nhận tại siêu thị').toBeChecked();
    await expect.soft(homeDelivery, 'Giao tận nơi phải bỏ chọn').not.toBeChecked();

    const storeSectionTexts = await page.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      return [...document.querySelectorAll('body *')]
        .filter((e) => e.children.length === 0 && visible(e) && !e.closest('label'))
        .map((e) => norm(e.textContent)).filter((t) => /siêu thị/i.test(t) && t.length <= 150);
    });
    console.log('[INST_Paylater_06] chữ về siêu thị ngoài nhãn:', JSON.stringify(storeSectionTexts));

    await expect(reminder, `Phải hiển thị phần chọn siêu thị nhận hàng với dòng "${REMINDER}"`).toBeVisible({ timeout: 8000 });
    await reminder.scrollIntoViewIfNeeded();
    await test.info().attach('buoc-2-nhan-tai-sieu-thi', { body: await page.screenshot(), contentType: 'image/png' });

    // Nếu web tự mở sẵn hộp thoại sau bước 2 thì đóng lại để thực hiện đúng bước 3 (tự bấm)
    if (await dialogTitle.isVisible().catch(() => false)) {
      console.log('[INST_Paylater_06] Hộp thoại đã tự mở sau bước 2 -> đóng lại để bấm ở bước 3');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
    }

    // ---- Bước 3: bấm "Vui lòng cung cấp thông tin nhận hàng" (chọn siêu thị nhận hàng) ----
    await reminder.scrollIntoViewIfNeeded();
    await reminder.click({ timeout: 8000 });
    await page.waitForTimeout(1500);

    // Expected 3: hiển thị khung thông tin đặt hàng
    await expect(dialogTitle, 'Phải hiển thị khung "Thông tin đặt hàng"').toBeVisible({ timeout: 8000 });

    // Xác định khung chứa tiêu đề để kiểm tra nội dung bên trong
    const hasFrame = await dialogTitle.evaluate((el) => {
      document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
      let p = el;
      for (let i = 0; p && i < 15; i++, p = p.parentElement) {
        const hasConfirm = [...p.querySelectorAll('button')]
          .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
        if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
      }
      return false;
    });
    expect.soft(hasFrame, 'Khung Thông tin đặt hàng phải có nút [Xác nhận]').toBe(true);

    if (hasFrame) {
      const frame = page.locator('[data-qa-order="1"]');
      await expect.soft(
        frame.locator('input[placeholder*="Họ và tên" i], input[name*="name" i], [aria-label*="Họ và tên" i]').first(),
        'Khung Thông tin đặt hàng phải có ô Họ và tên',
      ).toBeVisible({ timeout: 5000 });
      await expect.soft(
        frame.locator('input[placeholder*="Số điện thoại" i], input[name*="phone" i], input[type="tel"], [aria-label*="Số điện thoại" i]').first(),
        'Khung Thông tin đặt hàng phải có ô Số điện thoại',
      ).toBeVisible({ timeout: 5000 });
    }
    await test.info().attach('buoc-3-khung-thong-tin-dat-hang', { body: await page.screenshot(), contentType: 'image/png' });

    // Dừng tại đây: không nhập thông tin, không chọn đối tác, không tạo hồ sơ vay
    await page.keyboard.press('Escape').catch(() => {});
  });


  /* --------------------------------------------------------------------------
   * PHẦN 3: TRẢ CHẬM QUA CÔNG TY TÀI CHÍNH (INST_Company)
   * -------------------------------------------------------------------------- */

  // TC 12: Chọn Qua công ty tài chính chuyển sang trang giỏ hàng trả chậm tài chính
  test('INST_Company_01 - Chọn Qua công ty tài chính chuyển sang trang giỏ hàng trả chậm tài chính', async ({ page }) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(15000);

    // Pre-condition + Bước 1: mở hộp thoại "Chọn hình thức trả chậm" của SP F, click "Qua công ty tài chính (0%)"
    await goToFinancialPage(page, 'F');

    // Expected 1: chuyển sang trang /tra-cham-tai-chinh, tiêu đề "Giỏ Hàng Trả Chậm Tài Chính"
    await expect(page, `Phải chuyển sang trang /tra-cham-tai-chinh (đang ở ${page.url()})`).toHaveURL(/\/tra-cham-tai-chinh/);
    await expect(page.getByText('Giỏ Hàng Trả Chậm Tài Chính').first(), 'Phải có tiêu đề "Giỏ Hàng Trả Chậm Tài Chính"')
      .toBeVisible({ timeout: 10000 });

    // Bước 2 / Expected 2: nội dung trang
    const lines = (await page.locator('body').innerText())
      .replace(/\u00a0/g, ' ').split('\n').map((s) => s.trim()).filter(Boolean);

    // SP F: tên, phiên bản (kích cỡ), số lượng 1, đơn giá
    const idx = lines.findIndex((l) => /65QNED70BSA/i.test(l));
    expect(idx, `Phải có SP F (65QNED70BSA) trên trang. Nội dung: ${JSON.stringify(lines.slice(0, 40))}`).toBeGreaterThanOrEqual(0);
    const near = lines.slice(Math.max(0, idx - 3), idx + 12);
    const price = near.find((l) => /^\d[\d.]*\s*[₫đ]$/.test(l));
    expect(price, `Phải có đơn giá của SP F. Nội dung gần tên SP: ${JSON.stringify(near)}`).toBeTruthy();
    expect(parseInt(price.replace(/[^\d]/g, ''), 10), 'Đơn giá SP F phải lớn hơn 0').toBeGreaterThan(0);
    expect.soft(near.join(' '), `Phải hiển thị phiên bản (kích cỡ, vd: 65 inch). Nội dung gần tên SP: ${JSON.stringify(near)}`)
      .toMatch(/\d{2,3}\s*inch/i);
    await expect(page.locator(L.BNPL_QTY_INPUT).first(), 'SP F phải có số lượng 1').toHaveValue('1');

    // "Dịch vụ đi kèm" và "Quà tặng cùng sản phẩm" có nút [Đổi] (nút nằm ngay sau tiêu đề khối)
    const hasChangeBtn = (title) => {
      const i = lines.findIndex((l) => l === title);
      if (i < 0) return null;                                  // không có khối này
      return lines.slice(i, i + 5).some((l) => /^Đổi$/i.test(l));
    };
    const service = hasChangeBtn('Dịch vụ đi kèm');
    const gift = hasChangeBtn('Quà tặng cùng sản phẩm');
    expect.soft(service, '"Dịch vụ đi kèm" phải có khối và nút [Đổi]').toBe(true);
    expect.soft(gift, '"Quà tặng cùng sản phẩm" phải có khối và nút [Đổi]').toBe(true);

    // Các khối chức năng còn lại
    await expect(page.getByText('Thông tin làm hồ sơ trả chậm').first(), 'Phải có khối "Thông tin làm hồ sơ trả chậm"').toBeVisible();
    await expect(page.getByText('Chọn gói trả chậm nổi bật').first(), 'Phải có khối "Chọn gói trả chậm nổi bật"').toBeVisible();

    // Các khối bên dưới (thấy trên trang thật): xem thêm gói, chọn gói khác, bộ lọc, tạm tính, chính sách
    await expect(page.getByText(/Xem thêm \d+ gói/).first(), 'Phải có [Xem thêm ... gói]').toBeVisible();
    await expect(page.getByText('Hoặc chọn gói trả chậm khác phù hợp').first(), 'Phải có khối chọn gói khác').toBeVisible();
    await expect(page.getByText('Chọn số tiền trả trước').first(), 'Phải có ô chọn số tiền trả trước').toBeVisible();
    await expect(page.getByText('Chọn kỳ hạn').first(), 'Phải có ô chọn kỳ hạn').toBeVisible();
    await expect(page.getByText('Tạm tính').first(), 'Phải có dòng Tạm tính').toBeVisible();
    await expect(page.getByText(/Chính sách xử lý dữ liệu cá nhân/).first(), 'Phải có ô đồng ý chính sách').toBeVisible();

    const submitBtn = page.getByRole('button', { name: 'Đặt mua trả chậm' }).first();
    await submitBtn.scrollIntoViewIfNeeded();
    await expect(submitBtn, 'Phải có nút [Đặt mua trả chậm]').toBeVisible();

    // Dừng tại đây: không bấm [Đặt mua trả chậm], không nhập thông tin cá nhân -> không tạo hồ sơ
  });


  // TC 13: Lọc gói theo công ty tài chính, tiền trả trước và kỳ hạn
    test('INST_Company_02 - Lọc gói theo công ty tài chính, tiền trả trước và kỳ hạn', async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultTimeout(15000);

    // Pre-condition: đang ở trang /tra-cham-tai-chinh của SP F
    await goToFinancialPage(page, 'F');
    await expect(page).toHaveURL(/\/tra-cham-tai-chinh/);
    const filterTitle = page.getByText('Hoặc chọn gói trả chậm khác phù hợp').first();
    await expect(filterTitle).toBeVisible({ timeout: 10000 });
    await filterTitle.scrollIntoViewIfNeeded();

    const COMPANIES = ['Home Credit', 'Shinhan Finance', 'FE Credit', 'Mcredit', 'Samsung Finance+'];
    const toNum = (s) => parseInt(String(s).replace(/[^\d]/g, ''), 10);

    // ---------- Đọc trang trong trình duyệt: gói phù hợp (kèm công ty theo logo), hàng nút lọc, toạ độ nút lọc ----------
    const snapshotFn = (opts) => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const companyOf = (s) => /home\s*-?_?\s*credit|homecredit/i.test(s) ? 'Home Credit'
        : /shinhan/i.test(s) ? 'Shinhan Finance'
        : /fe\s*-?_?\s*credit|fecredit/i.test(s) ? 'FE Credit'
        : /mcredit/i.test(s) ? 'Mcredit'
        : /samsung/i.test(s) ? 'Samsung Finance+' : null;
      const logoImgs = (root) => [...root.querySelectorAll('img')].filter((im) => companyOf(`${im.alt || ''} ${im.src || ''}`));
      const topOf = (el) => el.getBoundingClientRect().top + window.scrollY;
      const leaves = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0);
      const giaLeaves = leaves.filter((e) => /^Giá trả chậm/i.test(norm(e.textContent)));

      // Mỗi gói: tổ tiên lớn nhất chỉ chứa 1 chữ "Giá trả chậm" và đúng logo của gói đó
      const cards = giaLeaves.map((leaf) => {
        let el = leaf;
        while (el.parentElement && el.parentElement !== document.body) {
          const p = el.parentElement;
          if (giaLeaves.filter((g) => p.contains(g)).length > 1) break;
          const own = logoImgs(el).length;
          if (own > 0 && logoImgs(p).length > own) break;
          el = p;
        }
        const logo = logoImgs(el)[0];
        return { top: topOf(el), company: logo ? companyOf(`${logo.alt || ''} ${logo.src || ''}`) : null, text: el.innerText || el.textContent };
      });

      // Hàng nút lọc: tổ tiên nhỏ nhất của nút "Tất cả" chứa từ 4 logo công ty trở lên
      let tabs = [];
      let rowTop = null;
      let point = null;
      const allBtn = leaves.find((e) => norm(e.textContent) === 'Tất cả');
      if (allBtn) {
        let row = allBtn;
        while (row.parentElement && logoImgs(row).length < 4) row = row.parentElement;
        if (logoImgs(row).length >= 4) {
          rowTop = topOf(row);
          tabs = logoImgs(row).map((im) => ({ company: companyOf(`${im.alt || ''} ${im.src || ''}`), img: im }));
          if (opts && opts.pointFor) {
            const t = tabs.find((x) => x.company === opts.pointFor);
            if (t) {
              t.img.scrollIntoView({ block: 'center' });
              const r = t.img.getBoundingClientRect();
              point = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }
          }
        }
      }
      return { rowTop, tabs: tabs.map((t) => t.company), cards, point };
    };
    const snap = (opts) => page.evaluate(snapshotFn, opts || {});

    const parseCard = (c) => {
      const pick = (re) => { const m = c.text.match(re); return m ? m[1] : null; };
      return {
        company: c.company,
        giaTra: pick(/Giá trả chậm:?\s*(\d[\d.]*)\s*[₫đ]/),
        monthly: pick(/(\d[\d.]*)\s*[₫đ]\s*\/\s*tháng/),
        term: pick(/Kỳ hạn\s+(\d+)\s*tháng/),
        rate: pick(/Lãi suất\s+(\d+(?:[.,]\d+)?)\s*%/),
        prepay: pick(/Trả trước\s+(\d[\d.]*)\s*[₫đ]/),
        financed: pick(/Tổng tr\.?\s*chậm\s+(\d[\d.]*)\s*[₫đ]/),
        total: pick(/Tổng tiền\s+(\d[\d.]*)\s*[₫đ]/),
        diff: pick(/Chênh lệch\s+(\d[\d.]*)\s*[₫đ]/),
      };
    };
    // Thông báo khi không có gói: "Rất tiếc, không tìm thấy gói trả chậm phù hợp. Vui lòng chọn phương án trả chậm khác."
    const noResultShown = () => page.getByText(/Rất tiếc|không tìm thấy gói trả chậm phù hợp/i)
      .filter({ visible: true }).first().isVisible().catch(() => false);
    // Đọc ngay danh sách gói phù hợp: các gói nằm bên dưới hàng nút lọc (khác với các gói nổi bật ở phía trên)
    const readList = async () => {
      const s = await snap();
      // Không thấy hàng nút lọc thì không phân biệt được gói nổi bật và gói phù hợp -> báo lỗi rõ ràng, không đoán
      if (s.rowTop === null) throw new Error(`Không thấy hàng nút lọc công ty ([Tất cả] + logo các công ty) nên không đọc được danh sách gói. Số gói trên trang: ${s.cards.length}`);
      return s.cards.filter((c) => c.top > s.rowTop).map(parseCard);
    };
    // Đọc danh sách SAU KHI kết quả ổn định: có gói hoặc có thông báo, và hai lần đọc liên tiếp giống nhau (tối đa ~8 giây)
    const resultList = async () => {
      let last = null;
      for (let i = 0; i < 12; i++) {
        const list = await readList();
        const msg = await noResultShown();
        const sig = JSON.stringify(list) + msg;
        if ((list.length > 0 || msg) && sig === last) return list;
        last = sig;
        await page.waitForTimeout(700);
      }
      return readList();
    };
    // Phân loại công ty của các gói: gói của công ty khác, và gói KHÔNG nhận diện được công ty (logo không khớp tên)
    const companyIssues = (list, name) => ({
      others: [...new Set(list.map((c) => c.company).filter((c) => c !== null && c !== name))],
      unknown: list.filter((c) => c.company === null).length,
    });
    // Kiểm tra số liệu bên trong một gói
    const checkCard = (c, label) => {
      if (c.total != null && c.prepay != null && c.financed != null) {
        expect.soft(toNum(c.total), `${label}: tổng tiền phải bằng trả trước + tổng trả chậm`).toBe(toNum(c.prepay) + toNum(c.financed));
      }
      if (c.diff != null && c.total != null && c.giaTra != null) {
        expect.soft(toNum(c.diff), `${label}: chênh lệch phải bằng tổng tiền − giá trả chậm`).toBe(toNum(c.total) - toNum(c.giaTra));
      }
      if (c.monthly != null && c.term != null && c.financed != null) {
        const exp = toNum(c.financed) / toNum(c.term);
        // Tiền trả mỗi tháng được làm tròn nên chỉ xấp xỉ (cho phép lệch tối đa 1.000đ)
        expect.soft(Math.abs(toNum(c.monthly) - exp), `${label}: tiền mỗi tháng ${c.monthly} lệch so với ${c.financed} ÷ ${c.term}`).toBeLessThanOrEqual(1000);
      }
    };

    // ---------- Hai ô chọn "Số tiền trả trước" và "Kỳ hạn": dropdown TÙY BIẾN (div + span), bấm vào mới xổ danh sách ----------
    const DD = {
      prepay: { idx: 0, placeholder: 'Chọn số tiền trả trước', optRe: /^\d+\s*%/, triggerRe: /trả trước|^\d+\s*%/i },
      term: { idx: 1, placeholder: 'Chọn kỳ hạn', optRe: /^\d+\s*tháng$/i, triggerRe: /kỳ hạn|^\d+\s*tháng/i },
    };
    // Đánh dấu ô dropdown trong khối "Hoặc chọn gói trả chậm khác phù hợp". Nhận diện theo CHỮ trong ô
    // (đang là gợi ý "Chọn ..." hoặc giá trị đã chọn "x%" / "x tháng"), bỏ qua ô chứa logo (nút lọc công ty);
    // chỉ khi không nhận diện được theo chữ mới dùng vị trí (ô 1 = trả trước, ô 2 = kỳ hạn).
    const markTrigger = (kind) => page.evaluate(({ idx, trigSrc, trigFlags }) => {
      document.querySelectorAll('[data-qa-dd]').forEach((e) => e.removeAttribute('data-qa-dd'));
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const heading = [...document.querySelectorAll('body *')].find((e) => e.children.length === 0
        && norm(e.textContent) === 'Hoặc chọn gói trả chậm khác phù hợp');
      if (!heading) return { ok: false, why: 'không thấy tiêu đề khối' };
      const hTop = heading.getBoundingClientRect().top;
      const trigRe = new RegExp(trigSrc, trigFlags);
      let root = heading.parentElement;
      let trigs = [];
      for (let i = 0; i < 8 && root; i++, root = root.parentElement) {
        trigs = [...root.querySelectorAll('div.cursor-pointer.rounded-lg.border.justify-between')]
          .filter((t) => visible(t) && !t.querySelector('img') && t.getBoundingClientRect().top >= hTop - 2);
        if (trigs.length >= 2) break;
      }
      if (trigs.length < 2) return { ok: false, why: `chỉ thấy ${trigs.length} ô dropdown (không tính nút lọc công ty)` };
      const texts = trigs.map((t) => norm(t.textContent));
      const byText = trigs.filter((t) => trigRe.test(norm(t.textContent)));
      const pick = byText.length === 1 ? byText[0] : trigs[idx]; // nhận diện theo chữ; không chắc chắn thì theo vị trí
      pick.setAttribute('data-qa-dd', '1');
      return { ok: true, texts, by: byText.length === 1 ? 'chữ' : 'vị trí' };
    }, { idx: DD[kind].idx, trigSrc: DD[kind].triggerRe.source, trigFlags: DD[kind].triggerRe.flags });

    // Danh sách đang mở? (các mục được đánh dấu data-qa-opt ở lần mở gần nhất)
    const optionsOpen = () => page.locator('[data-qa-opt]').first().isVisible().catch(() => false);
    // Đóng danh sách đang mở (nếu có): Escape, rồi bấm vào vùng trống ở mép trái trang
    const closeDropdown = async () => {
      for (let i = 0; i < 3 && (await optionsOpen()); i++) {
        if (i === 0) await page.keyboard.press('Escape');
        else await page.mouse.click(5, 300);
        await page.waitForTimeout(400);
      }
    };

    // Mở dropdown, đánh dấu từng mục trong danh sách (data-qa-opt=0,1,2...) và trả về chữ của các mục
    const openDropdown = async (kind) => {
      await closeDropdown();   // bảo đảm danh sách của ô trước đã đóng, khỏi che ô này
      const mark = await markTrigger(kind);
      if (!mark.ok) throw new Error(`Không thấy ô chọn "${DD[kind].placeholder}" trong khối "Hoặc chọn gói trả chậm khác phù hợp": ${mark.why}`);
      const trigger = page.locator('[data-qa-dd]').first();
      // Đưa ô vào GIỮA màn hình để không bị thanh cố định che
      await trigger.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      const clicked = await trigger.click({ timeout: 4000 }).then(() => true).catch(() => false);
      if (!clicked) {
        // Ghi lại phần tử đang che ô để biết nguyên nhân
        const who = await trigger.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return t ? `${t.tagName}.${String(t.className).slice(0, 80)} | ${(t.innerText || '').replace(/\s+/g, ' ').slice(0, 120)}` : null;
        });
        console.log(`[INST_Company_03] Phần tử đang che ô "${kind}":`, who);
        await test.info().attach('o-bi-che-' + kind, { body: await page.screenshot(), contentType: 'image/png' });
        await page.mouse.click(5, 300);
        await page.waitForTimeout(400);
        await trigger.click({ timeout: 4000 });
      }
      await page.waitForTimeout(600);
      const res = await page.evaluate(({ src, flags }) => {
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const visible = (el) => {
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        };
        document.querySelectorAll('[data-qa-opt]').forEach((e) => e.removeAttribute('data-qa-opt'));
        const trig = document.querySelector('[data-qa-dd]');
        const tr = trig.getBoundingClientRect();
        const re = new RegExp(src, flags);
        const cands = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && visible(e)
          && !trig.contains(e) && re.test(norm(e.textContent)) && e.getBoundingClientRect().top >= tr.bottom - 2);
        // Các mục của danh sách cùng nằm trong một khối cha (cha hoặc ông); lấy khối có nhiều mục nhất
        let best = [];
        for (const level of [1, 2, 3]) {
          const groups = new Map();
          for (const e of cands) {
            let p = e;
            for (let i = 0; i < level && p; i++) p = p.parentElement;
            if (p) groups.set(p, [...(groups.get(p) || []), e]);
          }
          for (const g of groups.values()) if (g.length > best.length) best = g;
        }
        best.forEach((e, i) => e.setAttribute('data-qa-opt', String(i)));
        return { opts: best.map((e) => norm(e.textContent)), cands: cands.map((e) => norm(e.textContent)).slice(0, 12) };
      }, { src: DD[kind].optRe.source, flags: DD[kind].optRe.flags });
      if (res.opts.length < 3) {
        await page.keyboard.press('Escape');
        throw new Error(`Mở "${DD[kind].placeholder}" nhưng không thấy danh sách các mục. Chữ tìm được: ${JSON.stringify(res.cands)}`);
      }
      return res.opts;
    };

    // matcher: số thứ tự lựa chọn hoặc đối tượng có hàm test(); trả về chữ của lựa chọn đã chọn (null nếu không có mục khớp)
    const choose = async (kind, matcher) => {
      const opts = await openDropdown(kind);
      const idx = typeof matcher === 'number' ? matcher : opts.findIndex((t) => matcher.test(t));
      if (idx < 0) { await closeDropdown(); return null; }
      await page.locator(`[data-qa-opt="${idx}"]`).first().click();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1200);
      return opts[idx];
    };
    const clickCompany = async (name) => {
      const s0 = await snap({ pointFor: name });
      expect(s0.point, `Không thấy nút lọc "${name}". Các nút tìm được: ${JSON.stringify(s0.tabs)}`).toBeTruthy();
      await page.mouse.click(s0.point.x, s0.point.y);
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    };
    const clickAll = async () => {
      await page.getByText('Tất cả', { exact: true }).first().click();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    };

    // Bộ lọc CỐ ĐỊNH theo yêu cầu: trả trước 0%, kỳ hạn 4 tháng (không duyệt từng mức % / từng kỳ hạn)
    const FILTER_LABEL = '0% / 4 tháng';
    const applyFilter = async () => {
      const a = await choose('prepay', /^0\s*%/);
      const b = await choose('term', /^4\s*tháng$/i);
      expect(a, 'Dropdown "Chọn số tiền trả trước" phải có mức 0%').not.toBeNull();
      expect(b, 'Dropdown "Chọn kỳ hạn" phải có kỳ hạn 4 tháng').not.toBeNull();
    };
    // Gói ở bộ lọc 0% / 4 tháng: trả trước 0đ, kỳ hạn 4 tháng, số liệu khớp nhau
    const checkFiltered = (list, label) => list.forEach((c, i) => {
      const tag = `${label} gói ${i + 1}`;
      expect.soft(c.term, `${tag}: kỳ hạn của gói phải là 4 tháng`).toBe('4');
      if (c.prepay !== null) expect.soft(toNum(c.prepay), `${tag}: số tiền trả trước phải là 0 (mức 0%)`).toBe(0);
      checkCard(c, tag);
    });

    // ---------- Chuẩn bị: [Tất cả] với bộ lọc 0% / 4 tháng ----------
    await clickAll();
    await applyFilter();
    const baseList = await resultList();
    const baseMsg = await noResultShown();
    console.log(`[INST_Company_03] [Tất cả] / ${FILTER_LABEL}: ${baseList.length} gói | thông báo không có gói: ${baseMsg}`, JSON.stringify(baseList));
    await test.info().attach('tat-ca-0-4-thang', { body: await page.screenshot(), contentType: 'image/png' });
    if (baseList.length === 0) {
      expect.soft(baseMsg, `[Tất cả] / ${FILTER_LABEL}: không có gói thì phải hiện thông báo "không tìm thấy gói trả chậm phù hợp"`).toBe(true);
    } else {
      const unknownAll = baseList.filter((c) => c.company === null).length;
      expect.soft(unknownAll, `[Tất cả]: ${unknownAll} gói không nhận diện được công ty (alt/tên file logo không khớp tên công ty) nên không kiểm tra được "chỉ gói của công ty được chọn"`).toBe(0);
      expect.soft(baseMsg, '[Tất cả]: có gói thì không được hiện thông báo không tìm thấy').toBe(false);
      checkFiltered(baseList, `[Tất cả] ${FILTER_LABEL}`);
    }

    // ---------- Bước 1: click lần lượt từng công ty -> chỉ có gói của công ty đó (bộ lọc 0% / 4 tháng) ----------
    // Bước 3-4 (đã chọn mức trả trước và kỳ hạn): gói đúng 4 tháng, trả trước 0đ, số liệu khớp; không có gói thì có thông báo
    const resultsOf = {};
    for (const name of COMPANIES) {
      await clickCompany(name);
      await applyFilter();
      const list = await resultList();
      const noMsg = await noResultShown();
      resultsOf[name] = list;
      console.log(`[INST_Company_03] Bước 1: ${name} / ${FILTER_LABEL}: ${list.length} gói | thông báo không có gói: ${noMsg}`, JSON.stringify(list));
      if (list.length === 0) {
        expect.soft(noMsg, `${name} / ${FILTER_LABEL}: không có gói thì phải hiện thông báo "không tìm thấy gói trả chậm phù hợp"`).toBe(true);
        await test.info().attach('khong-co-goi-' + name.replace(/[^\w]/g, ''), { body: await page.screenshot(), contentType: 'image/png' });
      } else {
        const { others, unknown } = companyIssues(list, name);
        expect.soft(others, `Lọc "${name}": còn gói của công ty khác`).toEqual([]);
        expect.soft(unknown, `Lọc "${name}": ${unknown} gói không nhận diện được công ty (logo không khớp tên), không xác nhận được là gói của ${name}`).toBe(0);
        expect.soft(noMsg, `${name}: có gói thì không được hiện thông báo không tìm thấy`).toBe(false);
        checkFiltered(list, `${name} ${FILTER_LABEL}`);
        await test.info().attach('cong-ty-' + name.replace(/[^\w]/g, ''), { body: await page.screenshot(), contentType: 'image/png' });
      }
    }
    const withData = COMPANIES.filter((n) => resultsOf[n].length > 0);
    const sumPerCompany = COMPANIES.reduce((s, n) => s + resultsOf[n].length, 0);
    expect.soft(sumPerCompany, `Tổng số gói của từng công ty (${sumPerCompany}) phải bằng số gói ở [Tất cả] (${baseList.length}) với cùng bộ lọc ${FILTER_LABEL}`).toBe(baseList.length);
    if (withData.length === 0) {
      test.info().annotations.push({ type: 'note', description: `Không công ty nào có gói ở ${FILTER_LABEL}: chỉ kiểm tra được thông báo "không tìm thấy gói trả chậm phù hợp".` });
    }

    // ---------- Bước 2: click [Tất cả] -> hiển thị lại gói của tất cả công ty ----------
    await clickAll();
    await applyFilter();
    const allList = await resultList();
    const allMsg = await noResultShown();
    const shown = [...new Set(allList.map((c) => c.company).filter(Boolean))];
    console.log('[INST_Company_03] Bước 2 [Tất cả]:', allList.length, 'gói, công ty:', JSON.stringify(shown));
    for (const n of withData) expect.soft(shown, `Bước 2: [Tất cả] phải hiển thị lại gói của ${n}`).toContain(n);
    expect.soft(allList.length, 'Bước 2: [Tất cả] phải hiển thị ít nhất số gói của công ty nhiều gói nhất')
      .toBeGreaterThanOrEqual(Math.max(0, ...COMPANIES.map((n) => resultsOf[n].length)));
    if (allList.length === 0) expect.soft(allMsg, `Bước 2: [Tất cả] / ${FILTER_LABEL} không có gói thì phải hiện thông báo`).toBe(true);
    await test.info().attach('buoc-2-tat-ca', { body: await page.screenshot(), contentType: 'image/png' });

        // ---------- Bước 5: sau khi quan sát xong, bấm [Bỏ lọc] -> không còn nhìn thấy các gói sau khi lọc ----------
    // Trước khi bỏ lọc phải đang có kết quả lọc (gói hoặc thông báo không có kết quả) để việc "biến mất" có ý nghĩa
    expect.soft(allList.length > 0 || allMsg, 'Bước 5: trước khi bỏ lọc phải đang hiển thị kết quả lọc (gói hoặc thông báo không có kết quả)').toBe(true);
    const clearBtn = page.getByText(/^Bỏ lọc$/i).filter({ visible: true }).first();
    if (!(await clearBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      const seen = await page.evaluate(() => [...document.querySelectorAll('body *')]
        .filter((e) => e.children.length === 0 && /lọc|xóa|làm mới|reset/i.test(e.textContent || '') && e.getBoundingClientRect().width > 0)
        .map((e) => e.textContent.trim().slice(0, 60)).slice(0, 10));
      await test.info().attach('khong-thay-bo-loc', { body: await page.screenshot(), contentType: 'image/png' });
      throw new Error(`Bước 5: không thấy nút "Bỏ lọc" sau khi đã chọn bộ lọc. Chữ liên quan đang hiển thị: ${JSON.stringify(seen)}`);
    }
    await clearBtn.scrollIntoViewIfNeeded();
    await clearBtn.click();
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await expect.poll(async () => (await readList()).length, {
      message: 'Bước 5: sau khi bấm [Bỏ lọc] không còn được thấy các gói sau khi lọc',
      timeout: 8000,
    }).toBe(0);
    expect.soft(await noResultShown(), 'Bước 5: sau khi bỏ lọc không còn thông báo "không tìm thấy gói trả chậm phù hợp"').toBe(false);
    // Hai ô chọn trở về trạng thái chưa chọn
    await expect.soft(page.getByText('Chọn số tiền trả trước', { exact: true }).filter({ visible: true }).first(),
      'Bước 5: sau khi bỏ lọc ô "Số tiền trả trước" phải về trạng thái chưa chọn').toBeVisible();
    await expect.soft(page.getByText('Chọn kỳ hạn', { exact: true }).filter({ visible: true }).first(),
      'Bước 5: sau khi bỏ lọc ô "Kỳ hạn" phải về trạng thái chưa chọn').toBeVisible();
    console.log('[INST_Company_02] Bước 5: đã bấm [Bỏ lọc], số gói sau khi lọc còn thấy:', (await readList()).length);
    await test.info().attach('buoc-5-bo-loc', { body: await page.screenshot(), contentType: 'image/png' });

    // Dừng tại đây: không duyệt các mức trả trước / kỳ hạn khác, không chọn gói, không nhập thông tin, không đặt mua
  });

  // TC 14: Điền đủ thông tin hồ sơ trả chậm hợp lệ và đến bước xác thực SMS
  test('INST_Company_03 - Điền đủ thông tin hồ sơ trả chậm hợp lệ và đến bước xác thực SMS', async ({ page }) => {
    test.setTimeout(150000);
    manual('NGUYÊN TẮC AN TOÀN: Dừng tại màn hình nhập mã SMS, KHÔNG nhập mã, KHÔNG tạo hồ sơ');

    // Pre-condition: SP F, chưa đăng nhập, đang ở /tra-cham-tai-chinh
    await goToFinancialPage(page, 'F');
    await expect(page).toHaveURL(/\/tra-cham-tai-chinh/);
    await expect(page.getByText('Giỏ Hàng Trả Chậm Tài Chính').first()).toBeVisible({ timeout: 10000 });

    // ---- Bước 1: Chọn một gói của FE Credit (duyệt trong 5 phút) ----
    await expect(page.getByText('Chọn gói trả chậm nổi bật').first()).toBeVisible();
    await page.getByText('Chọn gói trả chậm nổi bật').first().scrollIntoViewIfNeeded();

    // Thẻ gói = tổ tiên lớn nhất chỉ chứa đúng 1 dòng "Giá trả chậm".
    // Ưu tiên: logo FE Credit + "Duyệt trong 5 phút" -> gói "Duyệt trong 5 phút" -> gói đầu tiên.
    const picked = await page.evaluate(() => {
      document.querySelectorAll('[data-pw-pkg]').forEach((e) => e.removeAttribute('data-pw-pkg'));
      const count = (el) => ((el.innerText || '').match(/Giá trả chậm/g) || []).length;
      const anchors = [...document.querySelectorAll('*')].filter(
        (el) => el.children.length === 0 && /^Giá trả chậm/.test((el.innerText || '').trim())
      );
      const cards = [];
      for (const a of anchors) {
        let card = a;
        while (card.parentElement && count(card.parentElement) === 1 && card.parentElement !== document.body) {
          card = card.parentElement;
        }
        if (!cards.includes(card)) cards.push(card);
      }
      const hasFE = (c) => [...c.querySelectorAll('img')].some((im) => /fe\s*-?\s*credit|\bfe\b/i.test(`${im.alt} ${im.src}`));
      const has5 = (c) => /Duyệt trong 5 phút/i.test(c.innerText);
      const target = cards.find((c) => hasFE(c) && has5(c)) || cards.find(has5) || cards[0];
      if (!target) return null;
      target.setAttribute('data-pw-pkg', '1');
      return { total: cards.length, isFE: hasFE(target), is5: has5(target), text: target.innerText.replace(/\n+/g, ' | ') };
    });
    console.log('[INST_Company_04] Gói được chọn:', JSON.stringify(picked));
    expect(picked, 'Phải tìm thấy ít nhất 1 gói trả chậm nổi bật').not.toBeNull();

    const fePackage = page.locator('[data-pw-pkg="1"]');
    await fePackage.scrollIntoViewIfNeeded();
    await expect(fePackage).toBeVisible();

    const snapshot = () => fePackage.evaluate((el) =>
      [el, ...el.querySelectorAll('*')].map((n) => `${n.className}|${n.getAttribute('aria-checked')}|${n.checked}`).join('#')
    );
    const before = await snapshot();

    const radio = fePackage.locator('input[type="radio"], input[type="checkbox"]').first();
    if (await radio.count()) {
      await radio.check({ force: true }).catch(async () => { await fePackage.click(); });
    } else {
      await fePackage.click();
    }
    await page.waitForTimeout(1000);

    // Expected 1: Gói được chọn nổi bật
    if (await radio.count()) {
      await expect(radio).toBeChecked();
    } else {
      expect(await snapshot(), 'Sau khi click, thẻ gói phải đổi trạng thái (nổi bật)').not.toBe(before);
    }

    // ---- Bước 2: Click dòng nhắc, nhập họ tên, SĐT, địa chỉ hợp lệ, xác nhận ----
    const REMINDER = 'Vui lòng cung cấp thông tin nhận hàng';

    // Nhập địa chỉ (2 màn hình) - giống INST_Paylater_05, không dùng [id^="modal-"].last()
    const chooseAddress = () => chooseAddressFlow(page);

    const dialogTitle = page.getByText('Thông tin đặt hàng').first();

    // Gắn nhãn container hộp thoại: tổ tiên nhỏ nhất của tiêu đề có chứa nút [Xác nhận] đang hiển thị
    const markOrderDialog = () => dialogTitle.evaluate((el) => {
      document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
      let p = el;
      for (let i = 0; p && i < 15; i++, p = p.parentElement) {
        const hasConfirm = [...p.querySelectorAll('button')]
          .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
        if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
      }
      return false;
    });
    const orderDialog = page.locator('[data-qa-order="1"]');

    const infoRow = page.getByText(REMINDER).first();
    await infoRow.scrollIntoViewIfNeeded();
    await expect(infoRow).toBeVisible({ timeout: 10000 });

    if (!(await dialogTitle.isVisible({ timeout: 1500 }).catch(() => false))) {
      await infoRow.click();
      await page.waitForTimeout(1500);
    }
    await expect(dialogTitle, 'Hộp thoại nhập thông tin nhận hàng chưa mở').toBeVisible({ timeout: 5000 });
    expect(await markOrderDialog(), 'Không xác định được khung hộp thoại Thông tin đặt hàng').toBe(true);
    await test.info().attach('buoc-2-hop-thoai-mo', { body: await page.screenshot(), contentType: 'image/png' });

    // Họ tên + SĐT (giới hạn trong hộp thoại, có kiểm tra giá trị)
    const nameInput = orderDialog.locator('input[placeholder*="Họ và tên" i], input[name*="name" i], [aria-label*="Họ và tên" i]').first();
    await expect(nameInput, 'Phải có ô Họ và tên').toBeVisible({ timeout: 5000 });
    await nameInput.fill(TEST_CUSTOMER.fullName);

    const phoneInput = orderDialog.locator('input[placeholder*="Số điện thoại" i], input[name*="phone" i], input[type="tel"], [aria-label*="Số điện thoại" i]').first();
    await expect(phoneInput, 'Phải có ô Số điện thoại').toBeVisible({ timeout: 5000 });
    await phoneInput.fill(TEST_CUSTOMER.phone);

    await expect(nameInput).toHaveValue(TEST_CUSTOMER.fullName);
    await expect(phoneInput).toHaveValue(TEST_CUSTOMER.phone);

    // Địa chỉ (2 màn hình)
    await chooseAddress();
    await page.waitForTimeout(1000);
    await test.info().attach('buoc-2-truoc-khi-xac-nhan', { body: await page.screenshot(), contentType: 'image/png' });

    // Gắn nhãn lại (sau khi nhập địa chỉ) rồi bấm [Xác nhận] CỦA HỘP THOẠI này
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập địa chỉ').toBe(true);
    const confirmBtn = orderDialog.getByRole('button', { name: 'Xác nhận', exact: true }).last();
    await expect(confirmBtn, 'Nút [Xác nhận] của hộp thoại phải bấm được').toBeEnabled({ timeout: 5000 });
    await confirmBtn.click({ timeout: 5000 });

    // Hộp thoại phải đóng; nếu không, in ra thông báo lỗi/nội dung để biết web đòi thêm gì
    const closed = await expect(dialogTitle).toBeHidden({ timeout: 10000 }).then(() => true).catch(() => false);
    if (!closed) {
      const dialogText = (await orderDialog.innerText().catch(() => '')).replace(/\s+/g, ' ');
      const errors = await orderDialog
        .locator('[class*="error" i], [class*="text-red" i], [class*="invalid" i], [role="alert"]')
        .allInnerTexts().catch(() => []);
      await test.info().attach('buoc-2-hop-thoai-khong-dong', { body: await page.screenshot(), contentType: 'image/png' });
      throw new Error(
        `Hộp thoại "Thông tin đặt hàng" không đóng sau khi bấm [Xác nhận]. ` +
        `Thông báo lỗi: ${JSON.stringify(errors.filter(Boolean))}. Nội dung hộp thoại: ${dialogText.slice(0, 500)}`
      );
    }
    await page.waitForTimeout(1500);

    // Expected 2: Thông tin được lưu, dòng nhắc đổi thành thông tin đã nhập
    await expect(page.getByText(REMINDER), 'Dòng nhắc phải biến mất sau khi nhập thông tin')
      .toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText(TEST_CUSTOMER.fullName).first()).toBeVisible();
    await expect(page.getByText(TEST_CUSTOMER.phone).first()).toBeVisible();
    await expect(page.getByText(TEST_CUSTOMER.ward).first()).toBeVisible();

    // ---- Bước 3: Nhập CCCD, ngày sinh, chọn siêu thị làm hồ sơ ----
    const idInput = page.locator(L.TC_IDCARD_INPUT).first();
    await idInput.scrollIntoViewIfNeeded();
    await expect(idInput).toBeVisible({ timeout: 10000 });
    await idInput.fill(TEST_CUSTOMER.idCard);

    const bdayInput = page.locator(L.TC_BIRTHDAY_INPUT).first();
    await expect(bdayInput).toBeVisible();
    await bdayInput.fill(TEST_CUSTOMER.birthday); // DD/MM/YYYY
    await bdayInput.blur();

    const storeBtn = page.locator(L.TC_STORE_SELECT_BTN).first();
    await storeBtn.scrollIntoViewIfNeeded();
    await storeBtn.click();
    await page.waitForTimeout(1000);

    // Hộp thoại "Chọn siêu thị làm hồ sơ": neo bằng chữ chỉ có trong hộp thoại ("Tìm siêu thị gần bạn"),
    // vì chữ "Chọn siêu thị làm hồ sơ" cũng là chữ của nút bên ngoài trang
    const storeAnchor = page.getByText('Tìm siêu thị gần bạn').first();
    await expect(storeAnchor, 'Hộp thoại chọn siêu thị chưa mở').toBeVisible({ timeout: 10000 });
    const storeMarked = await storeAnchor.evaluate((el) => {
      document.querySelectorAll('[data-qa-store]').forEach((e) => e.removeAttribute('data-qa-store'));
      let p = el;
      for (let i = 0; p && i < 15; i++, p = p.parentElement) {
        const hasConfirm = [...p.querySelectorAll('button')]
          .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
        if (hasConfirm) { p.setAttribute('data-qa-store', '1'); return true; }
      }
      return false;
    });
    expect(storeMarked, 'Không xác định được khung hộp thoại chọn siêu thị').toBe(true);
    const storeModal = page.locator('[data-qa-store="1"]');

    // Chọn siêu thị đầu tiên trong danh sách (tỉnh đã là TP Hồ Chí Minh)
    const firstStore = storeModal.getByText(/^Điện máy XANH\s/).first();
    await expect(firstStore, 'Phải có danh sách siêu thị').toBeVisible({ timeout: 10000 });
    const storeName = (await firstStore.innerText()).trim();
    console.log('[INST_Company_04] Siêu thị được chọn:', storeName);
    await firstStore.click();
    await page.waitForTimeout(500);

    // Nút [Xác nhận] chỉ bấm được sau khi chọn siêu thị
    const storeConfirm = storeModal.getByRole('button', { name: 'Xác nhận', exact: true }).last();
    await expect(storeConfirm, 'Sau khi chọn siêu thị nút [Xác nhận] phải bấm được').toBeEnabled({ timeout: 5000 });
    await storeConfirm.click();
    await expect(storeAnchor, 'Hộp thoại chọn siêu thị phải đóng sau khi xác nhận').toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Expected 3: Dữ liệu được nhận, không báo lỗi
    await expect(idInput).toHaveValue(TEST_CUSTOMER.idCard);
    const bdayVal = (await bdayInput.inputValue()).replace(/\s/g, '');
    expect(bdayVal).toBe(TEST_CUSTOMER.birthday);
    // Không dùng chữ "bắt buộc" vì nhãn "(bắt buộc)" của 2 ô đồng ý luôn hiển thị
    await expect(page.locator('text=/không hợp lệ|vui lòng nhập/i'), 'Không được có thông báo lỗi nhập liệu')
      .toHaveCount(0);
    await expect.soft(page.getByText(storeName).first(), 'Siêu thị đã chọn phải hiển thị trên form').toBeVisible();

    // ---- Bước 4: Tích đồng ý Chính sách xử lý dữ liệu cá nhân (có 2 ô đồng ý, đều bắt buộc) ----
    // Tìm checkbox theo chữ của từng ô: leo từ dòng chữ lên tổ tiên nhỏ nhất có chứa đúng 1 checkbox
    const markConsent = (reSrc, key) => page.evaluate(({ reSrc, key }) => {
      const re = new RegExp(reSrc, 'i');
      document.querySelectorAll(`[data-qa-consent="${key}"]`).forEach((e) => e.removeAttribute('data-qa-consent'));
      const leaf = [...document.querySelectorAll('*')]
        .filter((el) => el.children.length <= 3 && re.test(el.innerText || '') && (el.innerText || '').length < 400)
        .sort((a, b) => a.innerText.length - b.innerText.length)[0];
      if (!leaf) return false;
      let p = leaf;
      for (let i = 0; p && i < 8; i++, p = p.parentElement) {
        const boxes = p.querySelectorAll('input[type="checkbox"]');
        if (boxes.length === 1) { boxes[0].setAttribute('data-qa-consent', key); return true; }
        if (boxes.length > 1) return false; // leo quá cao, lẫn sang ô khác
      }
      return false;
    }, { reSrc, key });

    const consents = [
      { key: 'policy', name: 'Chính sách xử lý dữ liệu cá nhân', reSrc: 'Chính sách xử lý dữ liệu cá nhân cho' },
      { key: 'cccd', name: 'Cung cấp, chuyển giao CCCD và ngày sinh cho FE Credit', reSrc: 'cung cấp, chuyển giao số Căn cước' },
    ];
    for (const c of consents) {
      expect(await markConsent(c.reSrc, c.key), `Không tìm thấy ô đồng ý: ${c.name}`).toBe(true);
      const box = page.locator(`[data-qa-consent="${c.key}"]`);
      await box.scrollIntoViewIfNeeded();
      await box.check({ force: true }).catch(async () => { await box.click({ force: true }); });

      // Expected 4: Ô đồng ý được tích
      await expect(box, `Ô đồng ý "${c.name}" phải được tích`).toBeChecked();
    }

    // ---- Bước 5: Bấm [Đặt mua trả chậm], DỪNG tại hộp thoại nhập mã SMS ----
    const submitBtn = page.getByRole('button', { name: 'Đặt mua trả chậm' }).first();
    await submitBtn.scrollIntoViewIfNeeded();
    await expect(submitBtn).toBeEnabled();
    await test.info().attach('buoc-5-truoc-khi-dat-mua', { body: await page.screenshot(), contentType: 'image/png' });
    await submitBtn.click();

    // Expected 5: Hiển thị hộp thoại yêu cầu nhập mã xác thực.
    // Nhận diện rộng: theo chữ (xác thực / xác minh / OTP / mã SMS / nhập mã / tin nhắn)
    // HOẶC có ô nhập mã mới xuất hiện (trừ các ô CCCD, ngày sinh, họ tên, SĐT, tìm kiếm).
    const otpTextRe = /(xác thực|xác minh|\bOTP\b|mã SMS|nhập mã|mã gồm|tin nhắn|gửi (về|đến) số)/i;
    const otpByText = page.getByText(otpTextRe).filter({ visible: true }).first();
    const otpByInput = page
      .locator('input[autocomplete="one-time-code"], input[inputmode="numeric"][maxlength="4"], input[inputmode="numeric"][maxlength="5"], input[inputmode="numeric"][maxlength="6"], input[inputmode="numeric"][maxlength="8"]')
      .filter({ visible: true })
      .first();

    const otpShown = await Promise.any([
      otpByText.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'text'),
      otpByInput.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'input'),
    ]).catch(() => null);

    await page.waitForTimeout(1000);
    await test.info().attach('buoc-5-sau-khi-dat-mua', { body: await page.screenshot(), contentType: 'image/png' });

    if (!otpShown) {
      // Không thấy hộp thoại OTP: in ra những gì đang hiển thị để biết web phản hồi gì
      const dialogs = (await page.locator('[id^="modal-"], [role="dialog"], .modal-content').filter({ visible: true }).allInnerTexts().catch(() => []))
        .map((t) => t.replace(/\s+/g, ' ').slice(0, 300));
      const errors = (await page.locator('[class*="error" i], [class*="text-red" i], [class*="invalid" i], [role="alert"]').filter({ visible: true }).allInnerTexts().catch(() => []))
        .map((t) => t.replace(/\s+/g, ' ').slice(0, 200)).filter(Boolean);
      throw new Error(
        `Không thấy hộp thoại nhập mã OTP sau khi bấm [Đặt mua trả chậm] (URL: ${page.url()}). ` +
        `Hộp thoại đang mở: ${JSON.stringify(dialogs)}. Thông báo lỗi: ${JSON.stringify(errors)}`
      );
    }
    console.log('[INST_Company_04] Hộp thoại OTP nhận diện qua:', otpShown);

    // In nội dung hộp thoại OTP để đối chiếu (không ép khớp, vì chữ thật của web chưa biết)
    const otpDialogs = (await page.locator('[id^="modal-"], [role="dialog"], .modal-content').filter({ visible: true }).allInnerTexts().catch(() => []))
      .map((t) => t.replace(/\s+/g, ' ').slice(0, 300));
    console.log('[INST_Company_04] Nội dung hộp thoại:', JSON.stringify(otpDialogs));

    // SĐT đã nhập (có thể bị che) - chỉ kiểm tra mềm 3 số cuối
    await expect.soft(page.locator('body'), 'Hộp thoại nên nhắc SĐT đã nhập (3 số cuối)')
      .toContainText(TEST_CUSTOMER.phone.slice(-3));

    // Chưa tạo hồ sơ: không sang trang thành công, không có thông báo đã tạo hồ sơ
    await expect(page).not.toHaveURL(/dat-hang-thanh-cong|thanh-cong|order-success/i);
    await expect(page.getByText(/(đặt hàng thành công|hồ sơ.*đã được tạo)/i)).toHaveCount(0);

    // DỪNG tại đây: không nhập mã SMS, không bấm xác nhận
  });

  // TC 15: Không thể đặt mua khi để trống thông tin làm hồ sơ
  test('INST_Company_04 - Không thể đặt mua khi để trống thông tin làm hồ sơ', async ({ page }) => {
    test.setTimeout(420000);
    page.setDefaultTimeout(20000); // thao tác nào kẹt quá 20s sẽ báo lỗi rõ ràng, không đứng im
    manual('NGUYÊN TẮC AN TOÀN: Mọi bước đều phải bị chặn trước khi tới hộp thoại OTP, KHÔNG nhập mã, KHÔNG tạo hồ sơ');

    const REMINDER = 'Vui lòng cung cấp thông tin nhận hàng';

    /* ------------------------------------------------------------------
     * Các hàm dựng form (cùng cách làm với INST_Company_04 đã chạy được)
     * ------------------------------------------------------------------ */

    // Đọc mọi dòng báo lỗi đang hiển thị. Quét theo từng đoạn chữ (text node)
    // nên bắt được cả chữ nằm lẫn trong thẻ có nhiều phần tử con.
    const readErrors = () => page.evaluate(() => {
      const re = /(vui lòng|không được (để )?trống|chưa (nhập|chọn)|bắt buộc (nhập|chọn)|cần (nhập|chọn))/i;
      const out = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 150 || !re.test(t)) continue;
        const el = n.parentElement;
        if (!el) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (/^Tôi đồng ý/.test(t)) continue;
        out.add(t);
      }
      return [...out];
    });

    // Xóa mọi trạng thái đã lưu (cookie, localStorage, sessionStorage, IndexedDB)
    // để mỗi bước bắt đầu như trang mới: web nhớ thông tin nhận hàng, gói, siêu thị của bước trước
    const resetSite = async () => {
      await page.context().clearCookies();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await page.evaluate(async () => {
        try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* bỏ qua */ }
        try {
          const dbs = (await indexedDB.databases?.()) || [];
          dbs.forEach((d) => d.name && indexedDB.deleteDatabase(d.name));
        } catch (e) { /* bỏ qua */ }
      }).catch(() => {});
      await page.waitForTimeout(500);
    };

    // Bước chọn gói: ưu tiên gói FE Credit "Duyệt trong 5 phút"
    const pickPackage = async () => {
      await expect(page.getByText('Chọn gói trả chậm nổi bật').first()).toBeVisible({ timeout: 10000 });
      await page.getByText('Chọn gói trả chậm nổi bật').first().scrollIntoViewIfNeeded();
      const picked = await page.evaluate(() => {
        document.querySelectorAll('[data-pw-pkg]').forEach((e) => e.removeAttribute('data-pw-pkg'));
        const count = (el) => ((el.innerText || '').match(/Giá trả chậm/g) || []).length;
        const anchors = [...document.querySelectorAll('*')].filter(
          (el) => el.children.length === 0 && /^Giá trả chậm/.test((el.innerText || '').trim())
        );
        const cards = [];
        for (const a of anchors) {
          let card = a;
          while (card.parentElement && count(card.parentElement) === 1 && card.parentElement !== document.body) {
            card = card.parentElement;
          }
          if (!cards.includes(card)) cards.push(card);
        }
        const hasFE = (c) => [...c.querySelectorAll('img')].some((im) => /fe\s*-?\s*credit|\bfe\b/i.test(`${im.alt} ${im.src}`));
        const has5 = (c) => /Duyệt trong 5 phút/i.test(c.innerText);
        const target = cards.find((c) => hasFE(c) && has5(c)) || cards.find(has5) || cards[0];
        if (!target) return null;
        target.setAttribute('data-pw-pkg', '1');
        return { total: cards.length, isFE: hasFE(target), is5: has5(target) };
      });
      expect(picked, 'Phải tìm thấy ít nhất 1 gói trả chậm nổi bật').not.toBeNull();
      const pkg = page.locator('[data-pw-pkg="1"]');
      await pkg.scrollIntoViewIfNeeded();
      await expect(pkg).toBeVisible();
      const radio = pkg.locator('input[type="radio"], input[type="checkbox"]').first();
      if (await radio.count()) {
        await radio.check({ force: true }).catch(async () => { await pkg.click(); });
      } else {
        await pkg.click();
      }
      await page.waitForTimeout(1000);
    };

    // Nhập địa chỉ (2 màn hình) - giống INST_Paylater_05
    const chooseAddress = () => chooseAddressFlow(page);

    // Thông tin nhận hàng (Pre-condition: "Đã nhập thông tin nhận hàng")
    const fillReceiver = async () => {
      const dialogTitle = page.getByText('Thông tin đặt hàng').first();
      const markOrderDialog = () => dialogTitle.evaluate((el) => {
        document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
        let p = el;
        for (let i = 0; p && i < 15; i++, p = p.parentElement) {
          const hasConfirm = [...p.querySelectorAll('button')]
            .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
          if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
        }
        return false;
      });
      const orderDialog = page.locator('[data-qa-order="1"]');

      const infoRow = page.getByText(REMINDER).first();
      if (!(await infoRow.isVisible({ timeout: 4000 }).catch(() => false))) {
        console.log('[INST_Company_05] Không còn dòng nhắc nhập thông tin nhận hàng -> bỏ qua bước nhập');
        return;
      }
      await infoRow.scrollIntoViewIfNeeded();
      if (!(await dialogTitle.isVisible({ timeout: 1500 }).catch(() => false))) {
        await infoRow.click();
        await page.waitForTimeout(1500);
      }
      await expect(dialogTitle, 'Hộp thoại nhập thông tin nhận hàng chưa mở').toBeVisible({ timeout: 5000 });
      expect(await markOrderDialog(), 'Không xác định được khung hộp thoại Thông tin đặt hàng').toBe(true);

      const nameInput = orderDialog.locator('input[placeholder*="Họ và tên" i], input[name*="name" i], [aria-label*="Họ và tên" i]').first();
      await expect(nameInput, 'Phải có ô Họ và tên').toBeVisible({ timeout: 5000 });
      await nameInput.fill(TEST_CUSTOMER.fullName);
      const phoneInput = orderDialog.locator('input[placeholder*="Số điện thoại" i], input[name*="phone" i], input[type="tel"], [aria-label*="Số điện thoại" i]').first();
      await expect(phoneInput, 'Phải có ô Số điện thoại').toBeVisible({ timeout: 5000 });
      await phoneInput.fill(TEST_CUSTOMER.phone);
      await expect(nameInput).toHaveValue(TEST_CUSTOMER.fullName);
      await expect(phoneInput).toHaveValue(TEST_CUSTOMER.phone);

      await chooseAddress();
      await page.waitForTimeout(1000);

      expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập địa chỉ').toBe(true);
      const confirmBtn = orderDialog.getByRole('button', { name: 'Xác nhận', exact: true }).last();
      await expect(confirmBtn, 'Nút [Xác nhận] của hộp thoại phải bấm được').toBeEnabled({ timeout: 5000 });
      await confirmBtn.click({ timeout: 5000 });
      await expect(dialogTitle, 'Hộp thoại Thông tin đặt hàng phải đóng sau khi xác nhận').toBeHidden({ timeout: 10000 });
      await page.waitForTimeout(1500);
      await expect(page.getByText(REMINDER)).toHaveCount(0, { timeout: 10000 });
    };

    // Chọn siêu thị làm hồ sơ (siêu thị đầu danh sách). Bấm lại tối đa 3 lần nếu hộp thoại chưa mở.
    // required=false: hộp thoại không mở thì KHÔNG coi là lỗi, trả về các thông báo web hiện ra
    // (dùng cho bước 4: chưa chọn gói thì web báo "Vui lòng chọn gói trả chậm trước.").
    const pickStore = async ({ required = true } = {}) => {
      const storeBtn = page.locator(L.TC_STORE_SELECT_BTN).first();
      const storeAnchor = page.getByText('Tìm siêu thị gần bạn').first();
      const msgs = new Set();

      let opened = false;
      for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
        await storeBtn.scrollIntoViewIfNeeded();
        await storeBtn.click();
        opened = await storeAnchor.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[INST_Company_05] Mở hộp thoại siêu thị lần ${attempt}: ${opened ? 'được' : 'chưa mở'}`);
        if (!opened) {
          for (const m of await readErrors()) msgs.add(m); // thông báo web hiện ngay sau khi bấm (có thể là toast)
          await page.waitForTimeout(500);
        }
      }

      if (!opened) {
        await test.info().attach('hop-thoai-sieu-thi-khong-mo', { body: await page.screenshot(), contentType: 'image/png' });
        if (!required) {
          console.log('[INST_Company_05] Hộp thoại siêu thị không mở. Thông báo của web:', JSON.stringify([...msgs]));
          return { opened: false, msgs: [...msgs] };
        }
      }
      await expect(storeAnchor, 'Hộp thoại chọn siêu thị chưa mở').toBeVisible({ timeout: 5000 });

      const marked = await storeAnchor.evaluate((el) => {
        document.querySelectorAll('[data-qa-store]').forEach((e) => e.removeAttribute('data-qa-store'));
        let p = el;
        for (let i = 0; p && i < 15; i++, p = p.parentElement) {
          const hasConfirm = [...p.querySelectorAll('button')]
            .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
          if (hasConfirm) { p.setAttribute('data-qa-store', '1'); return true; }
        }
        return false;
      });
      expect(marked, 'Không xác định được khung hộp thoại chọn siêu thị').toBe(true);
      const storeModal = page.locator('[data-qa-store="1"]');

      const firstStore = storeModal.getByText(/^Điện máy XANH\s/).first();
      await expect(firstStore, 'Phải có danh sách siêu thị').toBeVisible({ timeout: 10000 });
      await firstStore.click();
      await page.waitForTimeout(500);
      const storeConfirm = storeModal.getByRole('button', { name: 'Xác nhận', exact: true }).last();
      await expect(storeConfirm).toBeEnabled({ timeout: 5000 });
      await storeConfirm.click();
      await expect(storeAnchor).toBeHidden({ timeout: 10000 });
      await page.waitForTimeout(1000);
      return { opened: true, msgs: [] };
    };

    // Tích các ô đồng ý (Pre-condition: "đã tích đồng ý chính sách").
    // optional=true (bước 4, chưa chọn gói): ô nào có trên trang thì tích, không có thì ghi log rồi bỏ qua
    // (ô "chuyển giao CCCD cho FE Credit" chỉ hiện sau khi chọn gói).
    const tickConsents = async ({ optional = false } = {}) => {
      const markConsent = (reSrc, key) => page.evaluate(({ reSrc, key }) => {
        const re = new RegExp(reSrc, 'i');
        document.querySelectorAll(`[data-qa-consent="${key}"]`).forEach((e) => e.removeAttribute('data-qa-consent'));
        const leaf = [...document.querySelectorAll('*')]
          .filter((el) => el.children.length <= 3 && re.test(el.innerText || '') && (el.innerText || '').length < 400)
          .sort((a, b) => a.innerText.length - b.innerText.length)[0];
        if (!leaf) return false;
        let p = leaf;
        for (let i = 0; p && i < 8; i++, p = p.parentElement) {
          const boxes = p.querySelectorAll('input[type="checkbox"]');
          if (boxes.length === 1) { boxes[0].setAttribute('data-qa-consent', key); return true; }
          if (boxes.length > 1) return false;
        }
        return false;
      }, { reSrc, key });

      const consents = [
        { key: 'policy', name: 'Chính sách xử lý dữ liệu cá nhân', reSrc: 'Chính sách xử lý dữ liệu cá nhân cho' },
        { key: 'cccd', name: 'Cung cấp, chuyển giao CCCD và ngày sinh cho FE Credit', reSrc: 'cung cấp, chuyển giao số Căn cước' },
      ];
      for (const c of consents) {
        const found = await markConsent(c.reSrc, c.key);
        if (!found && optional) {
          console.log(`[INST_Company_05] Không có ô đồng ý "${c.name}" trên trang (chưa chọn gói) -> bỏ qua`);
          continue;
        }
        expect(found, `Không tìm thấy ô đồng ý: ${c.name}`).toBe(true);
        const box = page.locator(`[data-qa-consent="${c.key}"]`);
        await box.scrollIntoViewIfNeeded();
        await box.check({ force: true }).catch(async () => { await box.click({ force: true }); });
        await expect(box, `Ô đồng ý "${c.name}" phải được tích`).toBeChecked();
      }
    };

    // Dựng form từ trạng thái sạch: trường nào cần BỎ TRỐNG thì KHÔNG đụng vào.
    // Không dùng fill('') vì ô ngày sinh có mặt nạ DD / MM / YYYY, fill('') có thể bị kẹt.
    // storeOptional=true: không chọn được siêu thị cũng không sao (bước 4: chưa chọn gói).
    // Trả về các thông báo web hiện ra trong lúc chuẩn bị (để bước kiểm tra tính cả vào).
    const prepare = async ({ pkg, idCard, birthday, store, storeOptional = false }) => {
      await resetSite();
      await goToFinancialPage(page, 'F');
      await expect(page).toHaveURL(/\/tra-cham-tai-chinh/);
      await expect(page.getByText('Giỏ Hàng Trả Chậm Tài Chính').first()).toBeVisible({ timeout: 10000 });

      if (pkg) await pickPackage();
      await fillReceiver();

      const idInput = page.locator(L.TC_IDCARD_INPUT).first();
      await idInput.scrollIntoViewIfNeeded();
      await expect(idInput).toBeVisible({ timeout: 10000 });
      if (idCard) await idInput.fill(TEST_CUSTOMER.idCard);
      else console.log('[INST_Company_05] Số thẻ căn cước để trống, giá trị hiện tại:', JSON.stringify(await idInput.inputValue()));

      const bdayInput = page.locator(L.TC_BIRTHDAY_INPUT).first();
      await expect(bdayInput).toBeVisible();
      if (birthday) {
        await bdayInput.fill(TEST_CUSTOMER.birthday);
        await bdayInput.blur();
      } else {
        console.log('[INST_Company_05] Ngày sinh để trống, giá trị hiện tại:', JSON.stringify(await bdayInput.inputValue()));
      }

      let prepMsgs = [];
      if (store) {
        const r = await pickStore({ required: !storeOptional });
        prepMsgs = r.msgs;
      }
      await tickConsents({ optional: !pkg });
      return { prepMsgs };
    };

    /* ------------------------------------------------------------------
     * Kiểm tra: bấm [Đặt mua trả chậm] -> bị chặn, có báo lỗi, KHÔNG tới OTP
     * ------------------------------------------------------------------ */
    const otpTextRe = /(\bOTP\b|mã xác thực|mã xác minh|nhập mã|mã SMS)/i;
    const otpSignal = async () => {
      const t = await page.getByText(otpTextRe).filter({ visible: true }).count();
      const i = await page
        .locator('input[autocomplete="one-time-code"], input[inputmode="numeric"][maxlength="4"], input[inputmode="numeric"][maxlength="5"], input[inputmode="numeric"][maxlength="6"], input[inputmode="numeric"][maxlength="8"]')
        .filter({ visible: true }).count();
      return t + i;
    };

    // allowNoSubmit=true (bước 4): nếu web không hiện nút [Đặt mua trả chậm] khi chưa chọn gói
    // thì coi như web đã chặn (không bấm được), chỉ kiểm tra không có OTP.
    const submitAndCheck = async (label, fieldRe, { extraMsgs = [], allowNoSubmit = false } = {}) => {
      const submitBtn = page.getByRole('button', { name: 'Đặt mua trả chậm' }).first();
      const hasSubmit = await submitBtn.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasSubmit) {
        console.log(`[INST_Company_05] ${label}: không thấy nút [Đặt mua trả chậm] trên trang`);
        if (!allowNoSubmit) {
          await expect(submitBtn, 'Phải có nút [Đặt mua trả chậm]').toBeVisible({ timeout: 5000 });
        }
      } else {
        await submitBtn.scrollIntoViewIfNeeded();
      }

      const otpBefore = await otpSignal();
      const errorsBefore = await readErrors();
      const disabled = hasSubmit ? await submitBtn.isDisabled().catch(() => false) : false;

      if (hasSubmit && !disabled) await submitBtn.click({ timeout: 5000 });

      // Gom thông báo trong ~3s (phòng toast tự biến mất)
      const seen = new Set();
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(400);
        for (const m of await readErrors()) seen.add(m);
      }
      const errors = [...seen];

      const invalidCount = await page.locator('[aria-invalid="true"]').count().catch(() => 0);
      const otpAfter = await otpSignal();
      await test.info().attach(`${label}-sau-khi-bam`, { body: await page.screenshot(), contentType: 'image/png' });
      console.log(`[INST_Company_05] ${label}: có nút=${hasSubmit} | nút bị khóa=${disabled} | OTP trước/sau=${otpBefore}/${otpAfter} | ô aria-invalid=${invalidCount}`);
      console.log(`[INST_Company_05] ${label}: báo lỗi trước khi bấm =`, JSON.stringify(errorsBefore));
      console.log(`[INST_Company_05] ${label}: báo lỗi sau khi bấm =`, JSON.stringify(errors));
      if (extraMsgs.length) console.log(`[INST_Company_05] ${label}: báo lỗi bắt được lúc chuẩn bị =`, JSON.stringify(extraMsgs));

      // Expected (cứng): không đặt mua được -> không tới hộp thoại OTP, không sang trang thành công
      expect(otpAfter, `${label}: KHÔNG được hiện hộp thoại nhập mã OTP khi còn thiếu thông tin`).toBeLessThanOrEqual(otpBefore);
      await expect(page).not.toHaveURL(/dat-hang-thanh-cong|thanh-cong|order-success/i);
      await expect(page).toHaveURL(/\/tra-cham-tai-chinh/);

      // Expected (mềm): có báo bắt buộc đúng trường (tính cả thông báo bắt được lúc chuẩn bị)
      const all = [...new Set([...errors, ...extraMsgs])];
      expect.soft(
        all.some((m) => fieldRe.test(m)),
        `${label}: phải báo bắt buộc đúng trường. Báo lỗi thấy được: ${JSON.stringify(all)}${disabled ? ' (nút [Đặt mua trả chậm] đang bị khóa)' : ''}`
      ).toBe(true);
    };

    /* ------------------------------------------------------------------
     * 4 bước: mỗi bước bỏ trống đúng 1 trường, các trường khác hợp lệ
     * ------------------------------------------------------------------ */

    await test.step('Bước 1: Để trống số thẻ căn cước', async () => {
      await prepare({ pkg: true, idCard: false, birthday: true, store: true });
      await submitAndCheck('buoc-1-trong-CCCD', /(căn cước|CCCD|CMND|giấy tờ)/i);
    });

    await test.step('Bước 2: Để trống ngày sinh', async () => {
      await prepare({ pkg: true, idCard: true, birthday: false, store: true });
      await submitAndCheck('buoc-2-trong-ngay-sinh', /sinh/i);
    });

    await test.step('Bước 3: Không chọn siêu thị làm hồ sơ', async () => {
      await prepare({ pkg: true, idCard: true, birthday: true, store: false });
      await submitAndCheck('buoc-3-khong-chon-sieu-thi', /siêu thị/i);
    });

    await test.step('Bước 4: Không chọn gói trả chậm', async () => {
      // Chưa chọn gói: web không cho chọn siêu thị (báo "Vui lòng chọn gói trả chậm trước.")
      // -> không coi là lỗi, ghi lại thông báo của web và tính vào kết quả kiểm tra
      const { prepMsgs } = await prepare({ pkg: false, idCard: true, birthday: true, store: true, storeOptional: true });
      await submitAndCheck('buoc-4-khong-chon-goi', /gói/i, { extraMsgs: prepMsgs, allowNoSubmit: true });
    });

    // DỪNG: không có bước nào được phép tới OTP, không tạo hồ sơ
  });

  // TC 16: Không thể đặt mua với số thẻ căn cước không hợp lệ
  test('INST_Company_05 - Không thể đặt mua với số thẻ căn cước không hợp lệ', async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultTimeout(20000); // thao tác nào kẹt quá 20s sẽ báo lỗi rõ ràng, không đứng im
    manual('NGUYÊN TẮC AN TOÀN: Mọi bước đều phải bị chặn trước khi tới hộp thoại OTP, KHÔNG nhập mã, KHÔNG tạo hồ sơ');

    const REMINDER = 'Vui lòng cung cấp thông tin nhận hàng';

    /* ------------------------------------------------------------------
     * Các hàm dựng form (cùng cách làm với INST_Company_04/05 đã chạy được)
     * ------------------------------------------------------------------ */

    // Đọc các dòng báo lỗi đang hiển thị (quét theo từng đoạn chữ).
    // Bỏ qua ghi chú cố định "Vui lòng chuẩn bị CCCD/Thẻ căn cước khi làm hồ sơ." và nhãn "Tôi đồng ý..."
    const readErrors = () => page.evaluate(() => {
      const re = /(vui lòng|không hợp lệ|không đúng|không chính xác|định dạng|ký tự|tối đa|tối thiểu|phải (có|gồm)|\d+ (số|chữ số)|không được (để )?trống|chưa (nhập|chọn)|bắt buộc (nhập|chọn))/i;
      const out = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 150 || !re.test(t)) continue;
        if (/chuẩn bị/i.test(t) || /^Tôi đồng ý/.test(t)) continue;
        const el = n.parentElement;
        if (!el) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
        out.add(t);
      }
      return [...out];
    });

    // Cuộn phần tử vào GIỮA màn hình (tránh bị thanh menu cố định trên đầu trang che)
    const scrollCenter = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));

    // Chọn gói: ưu tiên gói FE Credit "Duyệt trong 5 phút"
    const pickPackage = async () => {
      await expect(page.getByText('Chọn gói trả chậm nổi bật').first()).toBeVisible({ timeout: 10000 });
      await page.getByText('Chọn gói trả chậm nổi bật').first().scrollIntoViewIfNeeded();
      const picked = await page.evaluate(() => {
        document.querySelectorAll('[data-pw-pkg]').forEach((e) => e.removeAttribute('data-pw-pkg'));
        const count = (el) => ((el.innerText || '').match(/Giá trả chậm/g) || []).length;
        const anchors = [...document.querySelectorAll('*')].filter(
          (el) => el.children.length === 0 && /^Giá trả chậm/.test((el.innerText || '').trim())
        );
        const cards = [];
        for (const a of anchors) {
          let card = a;
          while (card.parentElement && count(card.parentElement) === 1 && card.parentElement !== document.body) {
            card = card.parentElement;
          }
          if (!cards.includes(card)) cards.push(card);
        }
        const hasFE = (c) => [...c.querySelectorAll('img')].some((im) => /fe\s*-?\s*credit|\bfe\b/i.test(`${im.alt} ${im.src}`));
        const has5 = (c) => /Duyệt trong 5 phút/i.test(c.innerText);
        const target = cards.find((c) => hasFE(c) && has5(c)) || cards.find(has5) || cards[0];
        if (!target) return null;
        target.setAttribute('data-pw-pkg', '1');
        return { total: cards.length, isFE: hasFE(target), is5: has5(target) };
      });
      expect(picked, 'Phải tìm thấy ít nhất 1 gói trả chậm nổi bật').not.toBeNull();
      console.log('[INST_Company_06] Gói được chọn:', JSON.stringify(picked));
      const pkg = page.locator('[data-pw-pkg="1"]');
      await pkg.scrollIntoViewIfNeeded();
      await expect(pkg).toBeVisible();
      const radio = pkg.locator('input[type="radio"], input[type="checkbox"]').first();
      if (await radio.count()) {
        await radio.check({ force: true }).catch(async () => { await pkg.click(); });
      } else {
        await pkg.click();
      }
      await page.waitForTimeout(1000);
    };

    // Nhập địa chỉ (2 màn hình) - giống INST_Paylater_05
    const chooseAddress = () => chooseAddressFlow(page);

    // Thông tin nhận hàng
    const fillReceiver = async () => {
      const dialogTitle = page.getByText('Thông tin đặt hàng').first();
      const markOrderDialog = () => dialogTitle.evaluate((el) => {
        document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
        let p = el;
        for (let i = 0; p && i < 15; i++, p = p.parentElement) {
          const hasConfirm = [...p.querySelectorAll('button')]
            .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
          if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
        }
        return false;
      });
      const orderDialog = page.locator('[data-qa-order="1"]');

      const infoRow = page.getByText(REMINDER).first();
      await infoRow.scrollIntoViewIfNeeded();
      await expect(infoRow).toBeVisible({ timeout: 10000 });
      if (!(await dialogTitle.isVisible({ timeout: 1500 }).catch(() => false))) {
        await infoRow.click();
        await page.waitForTimeout(1500);
      }
      await expect(dialogTitle, 'Hộp thoại nhập thông tin nhận hàng chưa mở').toBeVisible({ timeout: 5000 });
      expect(await markOrderDialog(), 'Không xác định được khung hộp thoại Thông tin đặt hàng').toBe(true);

      const nameInput = orderDialog.locator('input[placeholder*="Họ và tên" i], input[name*="name" i], [aria-label*="Họ và tên" i]').first();
      await expect(nameInput, 'Phải có ô Họ và tên').toBeVisible({ timeout: 5000 });
      await nameInput.fill(TEST_CUSTOMER.fullName);
      const phoneInput = orderDialog.locator('input[placeholder*="Số điện thoại" i], input[name*="phone" i], input[type="tel"], [aria-label*="Số điện thoại" i]').first();
      await expect(phoneInput, 'Phải có ô Số điện thoại').toBeVisible({ timeout: 5000 });
      await phoneInput.fill(TEST_CUSTOMER.phone);
      await expect(nameInput).toHaveValue(TEST_CUSTOMER.fullName);
      await expect(phoneInput).toHaveValue(TEST_CUSTOMER.phone);

      await chooseAddress();
      await page.waitForTimeout(1000);

      expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập địa chỉ').toBe(true);
      const confirmBtn = orderDialog.getByRole('button', { name: 'Xác nhận', exact: true }).last();
      await expect(confirmBtn, 'Nút [Xác nhận] của hộp thoại phải bấm được').toBeEnabled({ timeout: 5000 });
      await confirmBtn.click({ timeout: 5000 });
      await expect(dialogTitle, 'Hộp thoại Thông tin đặt hàng phải đóng sau khi xác nhận').toBeHidden({ timeout: 10000 });
      await page.waitForTimeout(1500);
      await expect(page.getByText(REMINDER)).toHaveCount(0, { timeout: 10000 });
    };

    // Chọn siêu thị làm hồ sơ (siêu thị đầu danh sách). Bấm lại tối đa 3 lần nếu hộp thoại chưa mở
    const pickStore = async () => {
      const storeBtn = page.locator(L.TC_STORE_SELECT_BTN).first();
      const storeAnchor = page.getByText('Tìm siêu thị gần bạn').first();

      let opened = false;
      for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
        await storeBtn.scrollIntoViewIfNeeded();
        await storeBtn.click();
        opened = await storeAnchor.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[INST_Company_06] Mở hộp thoại siêu thị lần ${attempt}: ${opened ? 'được' : 'chưa mở'}`);
        if (!opened) await page.waitForTimeout(500);
      }
      await expect(storeAnchor, 'Hộp thoại chọn siêu thị chưa mở').toBeVisible({ timeout: 5000 });

      const marked = await storeAnchor.evaluate((el) => {
        document.querySelectorAll('[data-qa-store]').forEach((e) => e.removeAttribute('data-qa-store'));
        let p = el;
        for (let i = 0; p && i < 15; i++, p = p.parentElement) {
          const hasConfirm = [...p.querySelectorAll('button')]
            .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
          if (hasConfirm) { p.setAttribute('data-qa-store', '1'); return true; }
        }
        return false;
      });
      expect(marked, 'Không xác định được khung hộp thoại chọn siêu thị').toBe(true);
      const storeModal = page.locator('[data-qa-store="1"]');

      const firstStore = storeModal.getByText(/^Điện máy XANH\s/).first();
      await expect(firstStore, 'Phải có danh sách siêu thị').toBeVisible({ timeout: 10000 });
      await firstStore.click();
      await page.waitForTimeout(500);
      const storeConfirm = storeModal.getByRole('button', { name: 'Xác nhận', exact: true }).last();
      await expect(storeConfirm).toBeEnabled({ timeout: 5000 });
      await storeConfirm.click();
      await expect(storeAnchor).toBeHidden({ timeout: 10000 });
      await page.waitForTimeout(1000);
    };

    // Tích cả 2 ô đồng ý
    const tickConsents = async () => {
      const markConsent = (reSrc, key) => page.evaluate(({ reSrc, key }) => {
        const re = new RegExp(reSrc, 'i');
        document.querySelectorAll(`[data-qa-consent="${key}"]`).forEach((e) => e.removeAttribute('data-qa-consent'));
        const leaf = [...document.querySelectorAll('*')]
          .filter((el) => el.children.length <= 3 && re.test(el.innerText || '') && (el.innerText || '').length < 400)
          .sort((a, b) => a.innerText.length - b.innerText.length)[0];
        if (!leaf) return false;
        let p = leaf;
        for (let i = 0; p && i < 8; i++, p = p.parentElement) {
          const boxes = p.querySelectorAll('input[type="checkbox"]');
          if (boxes.length === 1) { boxes[0].setAttribute('data-qa-consent', key); return true; }
          if (boxes.length > 1) return false;
        }
        return false;
      }, { reSrc, key });

      const consents = [
        { key: 'policy', name: 'Chính sách xử lý dữ liệu cá nhân', reSrc: 'Chính sách xử lý dữ liệu cá nhân cho' },
        { key: 'cccd', name: 'Cung cấp, chuyển giao CCCD và ngày sinh cho FE Credit', reSrc: 'cung cấp, chuyển giao số Căn cước' },
      ];
      for (const c of consents) {
        expect(await markConsent(c.reSrc, c.key), `Không tìm thấy ô đồng ý: ${c.name}`).toBe(true);
        const box = page.locator(`[data-qa-consent="${c.key}"]`);
        await box.scrollIntoViewIfNeeded();
        await box.check({ force: true }).catch(async () => { await box.click({ force: true }); });
        await expect(box, `Ô đồng ý "${c.name}" phải được tích`).toBeChecked();
      }
    };

    /* ------------------------------------------------------------------
     * Pre-condition: SP F, /tra-cham-tai-chinh, đã chọn gói, các trường khác hợp lệ
     * ------------------------------------------------------------------ */
    await goToFinancialPage(page, 'F');
    await expect(page).toHaveURL(/\/tra-cham-tai-chinh/);
    await expect(page.getByText('Giỏ Hàng Trả Chậm Tài Chính').first()).toBeVisible({ timeout: 10000 });

    await pickPackage();
    await fillReceiver();

    const idInput = page.locator(L.TC_IDCARD_INPUT).first();
    await scrollCenter(idInput);
    await expect(idInput).toBeVisible({ timeout: 10000 });
    console.log('[INST_Company_06] Ô CCCD: maxlength =', await idInput.getAttribute('maxlength'), '| type =', await idInput.getAttribute('type'));

    const bdayInput = page.locator(L.TC_BIRTHDAY_INPUT).first();
    await expect(bdayInput).toBeVisible();
    await bdayInput.fill(TEST_CUSTOMER.birthday); // DD/MM/YYYY
    await bdayInput.blur();

    await pickStore();
    await tickConsents();

    const baseline = await readErrors(); // chỉ để ghi log (khi ô CCCD còn trống web đã hiện sẵn "Vui lòng nhập số thẻ căn cước")
    console.log('[INST_Company_06] Thông báo có sẵn khi ô CCCD còn trống:', JSON.stringify(baseline));

    /* ------------------------------------------------------------------
     * Kiểm tra từng giá trị CCCD không hợp lệ
     * ------------------------------------------------------------------ */
    const otpTextRe = /(\bOTP\b|mã xác thực|mã xác minh|nhập mã|mã SMS)/i;
    const otpSignal = async () => {
      const t = await page.getByText(otpTextRe).filter({ visible: true }).count();
      const i = await page
        .locator('input[autocomplete="one-time-code"], input[inputmode="numeric"][maxlength="4"], input[inputmode="numeric"][maxlength="5"], input[inputmode="numeric"][maxlength="6"], input[inputmode="numeric"][maxlength="8"]')
        .filter({ visible: true }).count();
      return t + i;
    };

    // Gõ từng ký tự như người dùng thật (để bắt được bộ lọc ký tự / giới hạn độ dài của ô nhập).
    // Không dùng click(): nhãn nổi "Số thẻ căn cước" và thanh menu cố định chặn con trỏ -> dùng focus().
    const typeId = async (value) => {
      await scrollCenter(idInput);
      await idInput.focus();
      await idInput.fill('');                          // ô này không có mặt nạ nên fill('') an toàn
      await idInput.pressSequentially(value, { delay: 40 });
      await page.waitForTimeout(500);
      return idInput.inputValue();
    };

    const checkInvalidId = async ({ label, typed, allowBlocked, desc }) => {
      const valueAfterTyping = await typeId(typed);
      await idInput.blur();
      await page.waitForTimeout(800);

      const blocked = valueAfterTyping !== typed;
      const liveErrors = await readErrors();
      console.log(`[INST_Company_06] ${label}: gõ="${typed}" | giá trị trong ô="${valueAfterTyping}" | ô tự chặn/cắt ký tự=${blocked}`);
      console.log(`[INST_Company_06] ${label}: báo lỗi ngay khi nhập =`, JSON.stringify(liveErrors));

      // AN TOÀN: nếu sau khi ô tự lọc/cắt mà giá trị trông hợp lệ (9 hoặc 12 số) thì KHÔNG bấm đặt mua
      // vì có thể gửi SMS thật. Ô đã chặn ký tự sai nên đạt kỳ vọng "không cho nhập / giới hạn độ dài".
      const looksValid = /^(\d{9}|\d{12})$/.test(valueAfterTyping);
      let submitted = false;
      let errors = liveErrors;
      let otpBefore = 0, otpAfter = 0;

      if (looksValid) {
        console.log(`[INST_Company_06] ${label}: giá trị "${valueAfterTyping}" trông hợp lệ sau khi ô tự lọc/cắt -> KHÔNG bấm [Đặt mua trả chậm] để tránh gửi SMS thật`);
      } else {
        const submitBtn = page.getByRole('button', { name: 'Đặt mua trả chậm' }).first();
        await scrollCenter(submitBtn);
        await expect(submitBtn, 'Phải có nút [Đặt mua trả chậm]').toBeVisible({ timeout: 5000 });

        otpBefore = await otpSignal();
        const disabled = await submitBtn.isDisabled().catch(() => false);
        if (!disabled) {
          await submitBtn.click({ timeout: 5000 });
          submitted = true;
        }

        // Gom thông báo trong ~3s (phòng toast tự biến mất)
        const seen = new Set(liveErrors);
        for (let i = 0; i < 8; i++) {
          await page.waitForTimeout(400);
          for (const m of await readErrors()) seen.add(m);
        }
        errors = [...seen];
        otpAfter = await otpSignal();
        console.log(`[INST_Company_06] ${label}: nút bị khóa=${disabled} | đã bấm=${submitted} | OTP trước/sau=${otpBefore}/${otpAfter}`);
        console.log(`[INST_Company_06] ${label}: báo lỗi sau khi bấm =`, JSON.stringify(errors));
      }
      await test.info().attach(`${label}-ket-qua`, { body: await page.screenshot(), contentType: 'image/png' });

      // Expected (cứng): không đặt mua được -> không tới OTP, không sang trang thành công
      expect(otpAfter, `${label}: KHÔNG được hiện hộp thoại nhập mã OTP với CCCD không hợp lệ (${desc})`).toBeLessThanOrEqual(otpBefore);
      await expect(page).not.toHaveURL(/dat-hang-thanh-cong|thanh-cong|order-success/i);
      await expect(page).toHaveURL(/\/tra-cham-tai-chinh/);

      // Expected (mềm): báo lỗi, hoặc (bước 2, 4) ô không cho nhập / giới hạn độ dài
      expect.soft(
        errors.length > 0 || (allowBlocked && blocked),
        `${label}: phải báo số thẻ căn cước không hợp lệ${allowBlocked ? ' hoặc ô không cho nhập/giới hạn độ dài' : ''}. ` +
        `Báo lỗi thấy được: ${JSON.stringify(errors)} | giá trị trong ô: "${valueAfterTyping}"`
      ).toBe(true);
    };

    await test.step('Bước 1: CCCD thiếu số (12345)', async () => {
      await checkInvalidId({ label: 'buoc-1-thieu-so', typed: '12345', allowBlocked: false, desc: 'thiếu số' });
    });

    await test.step('Bước 2: CCCD chứa chữ (12345abc6789)', async () => {
      await checkInvalidId({ label: 'buoc-2-chua-chu', typed: '12345abc6789', allowBlocked: true, desc: 'chứa chữ' });
    });

    await test.step('Bước 3: CCCD chứa ký tự đặc biệt (0123@#456789)', async () => {
      await checkInvalidId({ label: 'buoc-3-ky-tu-dac-biet', typed: '0123@#456789', allowBlocked: false, desc: 'chứa ký tự đặc biệt' });
    });

    await test.step('Bước 4: CCCD dư số (0123456789012345)', async () => {
      await checkInvalidId({ label: 'buoc-4-du-so', typed: '0123456789012345', allowBlocked: true, desc: 'dư số' });
    });

    // DỪNG: không có bước nào được phép tới OTP, không tạo hồ sơ
  });

  // TC 17: Không thể đặt mua với ngày sinh không hợp lệ hoặc chưa đủ tuổi
  test('INST_Company_06 - Không thể đặt mua với ngày sinh không hợp lệ hoặc chưa đủ tuổi', async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultTimeout(20000); // thao tác nào kẹt quá 20s sẽ báo lỗi rõ ràng, không đứng im
    manual('NGUYÊN TẮC AN TOÀN: Các bước chặn phải dừng trước OTP. Bước cuối (đúng 20 tuổi, ngưỡng thật của web) đi tới hộp thoại OTP rồi DỪNG, KHÔNG nhập mã, KHÔNG tạo hồ sơ');

    const REMINDER = 'Vui lòng cung cấp thông tin nhận hàng';

    /* ------------------------------------------------------------------
     * Tính các ngày sinh theo NGÀY CHẠY TEST (định dạng DD/MM/YYYY)
     * ------------------------------------------------------------------ */
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    // Cùng ngày/tháng của "hôm nay" nhưng lệch `years` năm (nếu ngày 29/02 không tồn tại thì lùi về 28/02)
    const shiftYears = (years) => {
      const t = new Date();
      const d = new Date(t.getFullYear() + years, t.getMonth(), t.getDate());
      if (d.getMonth() !== t.getMonth()) return new Date(t.getFullYear() + years, t.getMonth(), 28);
      return d;
    };
    const DOB = {
      under18: fmt(shiftYears(-17)),   // 17 tuổi (chưa đủ 18, theo TC)
      future: fmt(shiftYears(+1)),     // 1 năm nữa (tương lai)
      notExist: '31/02/2000',          // ngày không tồn tại
      exact18: fmt(shiftYears(-18)),   // đúng 18 tuổi: theo Excel là biên đủ điều kiện, nhưng web báo "từ 20 - 60 tuổi"
      exact20: fmt(shiftYears(-20)),   // đúng 20 tuổi: biên dưới THẬT của web ("Độ tuổi trả chậm từ 20 - 60 tuổi")
    };
    console.log('[INST_Company_07] Ngày hôm nay:', fmt(new Date()), '| các ngày sinh dùng để test:', JSON.stringify(DOB));

    /* ------------------------------------------------------------------
     * Các hàm dựng form (cùng cách làm với INST_Company_04/05/06 đã chạy được)
     * ------------------------------------------------------------------ */

    // Đọc các dòng báo lỗi đang hiển thị (quét theo từng đoạn chữ).
    // Bỏ qua: nhãn ô "Ngày/tháng/năm sinh" (không phải lỗi), ghi chú cố định "Vui lòng chuẩn bị CCCD...", nhãn "Tôi đồng ý..."
    const readErrors = () => page.evaluate(() => {
      const re = /(vui lòng|không hợp lệ|không đúng|không chính xác|định dạng|tuổi|đủ \d+|ngày sinh|năm sinh|tối đa|tối thiểu|không được (để )?trống|chưa (nhập|chọn)|bắt buộc (nhập|chọn)|điều kiện)/i;
      const out = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 150 || !re.test(t)) continue;
        if (/chuẩn bị/i.test(t) || /^Tôi đồng ý/.test(t)) continue;
        if (/^Ngày\s*\/\s*tháng\s*\/\s*năm sinh$/i.test(t)) continue; // nhãn của ô, không phải thông báo lỗi
        const el = n.parentElement;
        if (!el) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
        out.add(t);
      }
      return [...out];
    });

    // Cuộn phần tử vào GIỮA màn hình (tránh bị thanh menu cố định trên đầu trang che)
    const scrollCenter = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));

    // Chọn gói: ưu tiên gói FE Credit "Duyệt trong 5 phút"
    const pickPackage = async () => {
      await expect(page.getByText('Chọn gói trả chậm nổi bật').first()).toBeVisible({ timeout: 10000 });
      await page.getByText('Chọn gói trả chậm nổi bật').first().scrollIntoViewIfNeeded();
      const picked = await page.evaluate(() => {
        document.querySelectorAll('[data-pw-pkg]').forEach((e) => e.removeAttribute('data-pw-pkg'));
        const count = (el) => ((el.innerText || '').match(/Giá trả chậm/g) || []).length;
        const anchors = [...document.querySelectorAll('*')].filter(
          (el) => el.children.length === 0 && /^Giá trả chậm/.test((el.innerText || '').trim())
        );
        const cards = [];
        for (const a of anchors) {
          let card = a;
          while (card.parentElement && count(card.parentElement) === 1 && card.parentElement !== document.body) {
            card = card.parentElement;
          }
          if (!cards.includes(card)) cards.push(card);
        }
        const hasFE = (c) => [...c.querySelectorAll('img')].some((im) => /fe\s*-?\s*credit|\bfe\b/i.test(`${im.alt} ${im.src}`));
        const has5 = (c) => /Duyệt trong 5 phút/i.test(c.innerText);
        const target = cards.find((c) => hasFE(c) && has5(c)) || cards.find(has5) || cards[0];
        if (!target) return null;
        target.setAttribute('data-pw-pkg', '1');
        return { total: cards.length, isFE: hasFE(target), is5: has5(target) };
      });
      expect(picked, 'Phải tìm thấy ít nhất 1 gói trả chậm nổi bật').not.toBeNull();
      console.log('[INST_Company_07] Gói được chọn:', JSON.stringify(picked));
      const pkg = page.locator('[data-pw-pkg="1"]');
      await pkg.scrollIntoViewIfNeeded();
      await expect(pkg).toBeVisible();
      const radio = pkg.locator('input[type="radio"], input[type="checkbox"]').first();
      if (await radio.count()) {
        await radio.check({ force: true }).catch(async () => { await pkg.click(); });
      } else {
        await pkg.click();
      }
      await page.waitForTimeout(1000);
    };

    // Nhập địa chỉ (2 màn hình) - giống INST_Paylater_05
    const chooseAddress = () => chooseAddressFlow(page);

    // Thông tin nhận hàng
    const fillReceiver = async () => {
      const dialogTitle = page.getByText('Thông tin đặt hàng').first();
      const markOrderDialog = () => dialogTitle.evaluate((el) => {
        document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
        let p = el;
        for (let i = 0; p && i < 15; i++, p = p.parentElement) {
          const hasConfirm = [...p.querySelectorAll('button')]
            .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
          if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
        }
        return false;
      });
      const orderDialog = page.locator('[data-qa-order="1"]');

      const infoRow = page.getByText(REMINDER).first();
      await infoRow.scrollIntoViewIfNeeded();
      await expect(infoRow).toBeVisible({ timeout: 10000 });
      if (!(await dialogTitle.isVisible({ timeout: 1500 }).catch(() => false))) {
        await infoRow.click();
        await page.waitForTimeout(1500);
      }
      await expect(dialogTitle, 'Hộp thoại nhập thông tin nhận hàng chưa mở').toBeVisible({ timeout: 5000 });
      expect(await markOrderDialog(), 'Không xác định được khung hộp thoại Thông tin đặt hàng').toBe(true);

      const nameInput = orderDialog.locator('input[placeholder*="Họ và tên" i], input[name*="name" i], [aria-label*="Họ và tên" i]').first();
      await expect(nameInput, 'Phải có ô Họ và tên').toBeVisible({ timeout: 5000 });
      await nameInput.fill(TEST_CUSTOMER.fullName);
      const phoneInput = orderDialog.locator('input[placeholder*="Số điện thoại" i], input[name*="phone" i], input[type="tel"], [aria-label*="Số điện thoại" i]').first();
      await expect(phoneInput, 'Phải có ô Số điện thoại').toBeVisible({ timeout: 5000 });
      await phoneInput.fill(TEST_CUSTOMER.phone);
      await expect(nameInput).toHaveValue(TEST_CUSTOMER.fullName);
      await expect(phoneInput).toHaveValue(TEST_CUSTOMER.phone);

      await chooseAddress();
      await page.waitForTimeout(1000);

      expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập địa chỉ').toBe(true);
      const confirmBtn = orderDialog.getByRole('button', { name: 'Xác nhận', exact: true }).last();
      await expect(confirmBtn, 'Nút [Xác nhận] của hộp thoại phải bấm được').toBeEnabled({ timeout: 5000 });
      await confirmBtn.click({ timeout: 5000 });
      await expect(dialogTitle, 'Hộp thoại Thông tin đặt hàng phải đóng sau khi xác nhận').toBeHidden({ timeout: 10000 });
      await page.waitForTimeout(1500);
      await expect(page.getByText(REMINDER)).toHaveCount(0, { timeout: 10000 });
    };

    // Chọn siêu thị làm hồ sơ (siêu thị đầu danh sách). Bấm lại tối đa 3 lần nếu hộp thoại chưa mở
    const pickStore = async () => {
      const storeBtn = page.locator(L.TC_STORE_SELECT_BTN).first();
      const storeAnchor = page.getByText('Tìm siêu thị gần bạn').first();

      let opened = false;
      for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
        await storeBtn.scrollIntoViewIfNeeded();
        await storeBtn.click();
        opened = await storeAnchor.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[INST_Company_07] Mở hộp thoại siêu thị lần ${attempt}: ${opened ? 'được' : 'chưa mở'}`);
        if (!opened) await page.waitForTimeout(500);
      }
      await expect(storeAnchor, 'Hộp thoại chọn siêu thị chưa mở').toBeVisible({ timeout: 5000 });

      const marked = await storeAnchor.evaluate((el) => {
        document.querySelectorAll('[data-qa-store]').forEach((e) => e.removeAttribute('data-qa-store'));
        let p = el;
        for (let i = 0; p && i < 15; i++, p = p.parentElement) {
          const hasConfirm = [...p.querySelectorAll('button')]
            .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
          if (hasConfirm) { p.setAttribute('data-qa-store', '1'); return true; }
        }
        return false;
      });
      expect(marked, 'Không xác định được khung hộp thoại chọn siêu thị').toBe(true);
      const storeModal = page.locator('[data-qa-store="1"]');

      const firstStore = storeModal.getByText(/^Điện máy XANH\s/).first();
      await expect(firstStore, 'Phải có danh sách siêu thị').toBeVisible({ timeout: 10000 });
      await firstStore.click();
      await page.waitForTimeout(500);
      const storeConfirm = storeModal.getByRole('button', { name: 'Xác nhận', exact: true }).last();
      await expect(storeConfirm).toBeEnabled({ timeout: 5000 });
      await storeConfirm.click();
      await expect(storeAnchor).toBeHidden({ timeout: 10000 });
      await page.waitForTimeout(1000);
    };

    // Tích cả 2 ô đồng ý
    const tickConsents = async () => {
      const markConsent = (reSrc, key) => page.evaluate(({ reSrc, key }) => {
        const re = new RegExp(reSrc, 'i');
        document.querySelectorAll(`[data-qa-consent="${key}"]`).forEach((e) => e.removeAttribute('data-qa-consent'));
        const leaf = [...document.querySelectorAll('*')]
          .filter((el) => el.children.length <= 3 && re.test(el.innerText || '') && (el.innerText || '').length < 400)
          .sort((a, b) => a.innerText.length - b.innerText.length)[0];
        if (!leaf) return false;
        let p = leaf;
        for (let i = 0; p && i < 8; i++, p = p.parentElement) {
          const boxes = p.querySelectorAll('input[type="checkbox"]');
          if (boxes.length === 1) { boxes[0].setAttribute('data-qa-consent', key); return true; }
          if (boxes.length > 1) return false;
        }
        return false;
      }, { reSrc, key });

      const consents = [
        { key: 'policy', name: 'Chính sách xử lý dữ liệu cá nhân', reSrc: 'Chính sách xử lý dữ liệu cá nhân cho' },
        { key: 'cccd', name: 'Cung cấp, chuyển giao CCCD và ngày sinh cho FE Credit', reSrc: 'cung cấp, chuyển giao số Căn cước' },
      ];
      for (const c of consents) {
        expect(await markConsent(c.reSrc, c.key), `Không tìm thấy ô đồng ý: ${c.name}`).toBe(true);
        const box = page.locator(`[data-qa-consent="${c.key}"]`);
        await box.scrollIntoViewIfNeeded();
        await box.check({ force: true }).catch(async () => { await box.click({ force: true }); });
        await expect(box, `Ô đồng ý "${c.name}" phải được tích`).toBeChecked();
      }
    };

    /* ------------------------------------------------------------------
     * Pre-condition: SP F, /tra-cham-tai-chinh, đã chọn gói, các trường khác hợp lệ
     * ------------------------------------------------------------------ */
    await goToFinancialPage(page, 'F');
    await expect(page).toHaveURL(/\/tra-cham-tai-chinh/);
    await expect(page.getByText('Giỏ Hàng Trả Chậm Tài Chính').first()).toBeVisible({ timeout: 10000 });

    await pickPackage();
    await fillReceiver();

    const idInput = page.locator(L.TC_IDCARD_INPUT).first();
    await scrollCenter(idInput);
    await expect(idInput).toBeVisible({ timeout: 10000 });
    await idInput.focus(); // không click(): nhãn nổi và thanh menu cố định chặn con trỏ
    await idInput.fill(TEST_CUSTOMER.idCard);
    await idInput.blur();

    const bdayInput = page.locator(L.TC_BIRTHDAY_INPUT).first();
    await scrollCenter(bdayInput);
    await expect(bdayInput).toBeVisible({ timeout: 10000 });

    await pickStore();
    await tickConsents();

    /* ------------------------------------------------------------------
     * Hàm nhập ngày sinh + kiểm tra
     * ------------------------------------------------------------------ */
    // Nhập ngày sinh (ô có mặt nạ DD / MM / YYYY): fill trực tiếp giá trị mới, nếu kẹt thì gõ từng số
    const setBirthday = async (value) => {
      await scrollCenter(bdayInput);
      await bdayInput.focus();
      try {
        await bdayInput.fill(value, { timeout: 5000 });
      } catch (e) {
        console.log('[INST_Company_07] fill() không được, chuyển sang gõ từng số:', String(e.message).split('\n')[0]);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await bdayInput.pressSequentially(value.replace(/\D/g, ''), { delay: 40 });
      }
      await bdayInput.blur();
      await page.waitForTimeout(800);
      return (await bdayInput.inputValue()).replace(/\s/g, '');
    };

    const otpTextRe = /(xác thực|xác minh|\bOTP\b|mã SMS|nhập mã|mã gồm|tin nhắn|gửi (về|đến) số)/i;
    const otpInputSel = 'input[autocomplete="one-time-code"], input[inputmode="numeric"][maxlength="4"], input[inputmode="numeric"][maxlength="5"], input[inputmode="numeric"][maxlength="6"], input[inputmode="numeric"][maxlength="8"]';
    const otpSignal = async () => {
      const t = await page.getByText(otpTextRe).filter({ visible: true }).count();
      const i = await page.locator(otpInputSel).filter({ visible: true }).count();
      return t + i;
    };

    const baseline = await readErrors(); // thông báo có sẵn lúc form chưa nhập ngày sinh (chỉ để ghi log)
    console.log('[INST_Company_07] Thông báo có sẵn trước khi nhập ngày sinh:', JSON.stringify(baseline));

    // Các bước chặn: bấm [Đặt mua trả chậm] -> phải bị chặn, báo lỗi, KHÔNG tới OTP
    const checkBlocked = async ({ label, dob, desc, fieldRe }) => {
      const valueInBox = await setBirthday(dob);
      const liveErrors = await readErrors();
      console.log(`[INST_Company_07] ${label}: nhập="${dob}" | giá trị trong ô="${valueInBox}"`);
      console.log(`[INST_Company_07] ${label}: báo lỗi ngay khi nhập =`, JSON.stringify(liveErrors));

      const submitBtn = page.getByRole('button', { name: 'Đặt mua trả chậm' }).first();
      await scrollCenter(submitBtn);
      await expect(submitBtn, 'Phải có nút [Đặt mua trả chậm]').toBeVisible({ timeout: 5000 });

      const otpBefore = await otpSignal();
      const disabled = await submitBtn.isDisabled().catch(() => false);
      if (!disabled) await submitBtn.click({ timeout: 5000 });

      // Gom thông báo trong ~3s (phòng toast tự biến mất)
      const seen = new Set(liveErrors);
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(400);
        for (const m of await readErrors()) seen.add(m);
      }
      const errors = [...seen];
      const otpAfter = await otpSignal();
      await test.info().attach(`${label}-ket-qua`, { body: await page.screenshot(), contentType: 'image/png' });
      console.log(`[INST_Company_07] ${label}: nút bị khóa=${disabled} | OTP trước/sau=${otpBefore}/${otpAfter}`);
      console.log(`[INST_Company_07] ${label}: báo lỗi sau khi bấm =`, JSON.stringify(errors));

      // Expected (cứng): không đặt mua được -> không tới OTP, không sang trang thành công
      expect(otpAfter, `${label}: KHÔNG được hiện hộp thoại nhập mã OTP với ngày sinh ${desc}`).toBeLessThanOrEqual(otpBefore);
      await expect(page).not.toHaveURL(/dat-hang-thanh-cong|thanh-cong|order-success/i);
      await expect(page).toHaveURL(/\/tra-cham-tai-chinh/);

      // Expected (mềm): có báo lỗi đúng nội dung (web: tuổi -> "Độ tuổi trả chậm từ 20 - 60 tuổi",
      // tương lai -> "Năm sinh không hợp lệ", không tồn tại -> "Ngày sinh không hợp lệ")
      expect.soft(
        errors.some((m) => fieldRe.test(m)),
        `${label}: phải báo lỗi (${desc}). Báo lỗi thấy được: ${JSON.stringify(errors)} | giá trị trong ô: "${valueInBox}"`
      ).toBe(true);
    };

    await test.step('Bước 1: Ngày sinh dưới 18 tuổi (17 tuổi)', async () => {
      await checkBlocked({
        label: 'buoc-1-duoi-18-tuoi', dob: DOB.under18, desc: 'dưới 18 tuổi',
        fieldRe: /(độ tuổi|20\s*-\s*60)/i,
      });
    });

    await test.step('Bước 2: Ngày sinh ở tương lai', async () => {
      await checkBlocked({
        label: 'buoc-2-tuong-lai', dob: DOB.future, desc: 'ở tương lai',
        fieldRe: /(năm sinh không hợp lệ|ngày sinh không hợp lệ|không hợp lệ)/i,
      });
    });

    await test.step('Bước 3: Ngày sinh không tồn tại (31/02/2000)', async () => {
      await checkBlocked({
        label: 'buoc-3-khong-ton-tai', dob: DOB.notExist, desc: 'không tồn tại',
        fieldRe: /(ngày sinh không hợp lệ|không hợp lệ)/i,
      });
    });

    // Bước 4a (theo Excel): đúng 18 tuổi. Web báo "Độ tuổi trả chậm từ 20 - 60 tuổi" -> bị chặn (không gửi SMS)
    // Ghi nhận để đối chiếu Excel (Excel ghi 18 là biên đủ điều kiện, web thật yêu cầu từ 20 tuổi)
    await test.step('Bước 4a: Đúng 18 tuổi (theo Excel) - web thực tế vẫn chặn vì ngưỡng là 20 tuổi', async () => {
      await checkBlocked({
        label: 'buoc-4a-dung-18-tuoi', dob: DOB.exact18, desc: 'đúng 18 tuổi',
        fieldRe: /(độ tuổi|20\s*-\s*60)/i,
      });
    });

    // Bước 4: đúng 20 tuổi (biên dưới thật của web) -> đủ điều kiện -> đi tiếp tới hộp thoại OTP, rồi DỪNG
    await test.step('Bước 4: Ngày sinh đúng 20 tuổi, dừng tại bước nhập mã SMS', async () => {
      const label = 'buoc-4-dung-20-tuoi';
      const valueInBox = await setBirthday(DOB.exact20);
      console.log(`[INST_Company_07] ${label}: nhập="${DOB.exact20}" | giá trị trong ô="${valueInBox}"`);

      const submitBtn = page.getByRole('button', { name: 'Đặt mua trả chậm' }).first();
      await scrollCenter(submitBtn);
      await expect(submitBtn).toBeVisible();
      await expect(submitBtn).toBeEnabled();
      await test.info().attach(`${label}-truoc-khi-bam`, { body: await page.screenshot(), contentType: 'image/png' });
      await submitBtn.click({ timeout: 5000 });

      // Expected: hiện hộp thoại nhập mã xác thực (nhận diện theo chữ HOẶC theo ô nhập mã)
      const otpByText = page.getByText(otpTextRe).filter({ visible: true }).first();
      const otpByInput = page.locator(otpInputSel).filter({ visible: true }).first();
      const otpShown = await Promise.any([
        otpByText.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'text'),
        otpByInput.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'input'),
      ]).catch(() => null);

      await page.waitForTimeout(1000);
      await test.info().attach(`${label}-sau-khi-bam`, { body: await page.screenshot(), contentType: 'image/png' });

      if (!otpShown) {
        const errors = await readErrors();
        const dialogs = (await page.locator('[id^="modal-"], [role="dialog"], .modal-content').filter({ visible: true }).allInnerTexts().catch(() => []))
          .map((t) => t.replace(/\s+/g, ' ').slice(0, 300));
        throw new Error(
          `Ngày sinh đúng 20 tuổi (${DOB.exact20}) phải đi tiếp được tới hộp thoại OTP nhưng không thấy (URL: ${page.url()}). ` +
          `Báo lỗi: ${JSON.stringify(errors)}. Hộp thoại đang mở: ${JSON.stringify(dialogs)}`
        );
      }
      console.log(`[INST_Company_07] ${label}: hộp thoại OTP nhận diện qua:`, otpShown);

      const otpDialogs = (await page.locator('[id^="modal-"], [role="dialog"], .modal-content').filter({ visible: true }).allInnerTexts().catch(() => []))
        .map((t) => t.replace(/\s+/g, ' ').slice(0, 300));
      console.log(`[INST_Company_07] ${label}: nội dung hộp thoại:`, JSON.stringify(otpDialogs));

      // Không có thông báo lỗi tuổi / ngày sinh
      const errs = (await readErrors()).filter((m) => /(độ tuổi|tuổi|ngày sinh|năm sinh|không hợp lệ|điều kiện)/i.test(m));
      expect.soft(errs, `${label}: 20 tuổi là biên đủ điều kiện, không được báo lỗi tuổi/ngày sinh`).toEqual([]);

      // Chưa tạo hồ sơ
      await expect(page).not.toHaveURL(/dat-hang-thanh-cong|thanh-cong|order-success/i);
      await expect(page.getByText(/(đặt hàng thành công|hồ sơ.*đã được tạo)/i)).toHaveCount(0);

      // DỪNG tại đây: không nhập mã SMS, không bấm xác nhận
    });
  });

  // TC 18: Không thể đặt mua khi chưa đồng ý chính sách xử lý dữ liệu cá nhân
  test('INST_Company_07 - Không thể đặt mua khi chưa đồng ý chính sách xử lý dữ liệu cá nhân', async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultTimeout(20000); // thao tác nào kẹt quá 20s sẽ báo lỗi rõ ràng, không đứng im
    manual('NGUYÊN TẮC AN TOÀN: Bước 1 phải bị chặn trước OTP. Bước 2 đi tới hộp thoại OTP rồi DỪNG, KHÔNG nhập mã, KHÔNG tạo hồ sơ');

    const REMINDER = 'Vui lòng cung cấp thông tin nhận hàng';

    // Ngày sinh hợp lệ (30 tuổi, nằm trong khoảng 20 - 60 tuổi của web), tính theo ngày chạy test
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const t0 = new Date();
    let dobDate = new Date(t0.getFullYear() - 30, t0.getMonth(), t0.getDate());
    if (dobDate.getMonth() !== t0.getMonth()) dobDate = new Date(t0.getFullYear() - 30, t0.getMonth(), 28);
    const VALID_DOB = fmt(dobDate);
    console.log('[INST_Company_08] Ngày sinh hợp lệ dùng để test:', VALID_DOB);

    /* ------------------------------------------------------------------
     * Các hàm dựng form (cùng cách làm với INST_Company_04..07 đã chạy được)
     * ------------------------------------------------------------------ */

    // Đọc các dòng báo lỗi đang hiển thị (quét theo từng đoạn chữ).
    // Bỏ qua ghi chú cố định "Vui lòng chuẩn bị CCCD..." và nhãn ô đồng ý "Tôi đồng ý..."
    const readErrors = () => page.evaluate(() => {
      const re = /(vui lòng|không hợp lệ|bắt buộc|đồng ý|chính sách|chưa (nhập|chọn|đồng ý)|không được (để )?trống)/i;
      const out = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 150 || !re.test(t)) continue;
        if (/chuẩn bị/i.test(t) || /^Tôi đồng ý/.test(t)) continue;
        const el = n.parentElement;
        if (!el) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
        out.add(t);
      }
      return [...out];
    });

    // Mọi đoạn chữ ngắn đang hiển thị (để so sánh trước/sau khi bấm, bắt cả thông báo lạ)
    const visibleTexts = () => page.evaluate(() => {
      const out = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 150) continue;
        const el = n.parentElement;
        if (!el) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
        out.add(t);
      }
      return [...out];
    });

    // Cuộn phần tử vào GIỮA màn hình (tránh bị thanh menu cố định trên đầu trang che)
    const scrollCenter = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));

    // Chọn gói: ưu tiên gói FE Credit "Duyệt trong 5 phút"
    const pickPackage = async () => {
      await expect(page.getByText('Chọn gói trả chậm nổi bật').first()).toBeVisible({ timeout: 10000 });
      await page.getByText('Chọn gói trả chậm nổi bật').first().scrollIntoViewIfNeeded();
      const picked = await page.evaluate(() => {
        document.querySelectorAll('[data-pw-pkg]').forEach((e) => e.removeAttribute('data-pw-pkg'));
        const count = (el) => ((el.innerText || '').match(/Giá trả chậm/g) || []).length;
        const anchors = [...document.querySelectorAll('*')].filter(
          (el) => el.children.length === 0 && /^Giá trả chậm/.test((el.innerText || '').trim())
        );
        const cards = [];
        for (const a of anchors) {
          let card = a;
          while (card.parentElement && count(card.parentElement) === 1 && card.parentElement !== document.body) {
            card = card.parentElement;
          }
          if (!cards.includes(card)) cards.push(card);
        }
        const hasFE = (c) => [...c.querySelectorAll('img')].some((im) => /fe\s*-?\s*credit|\bfe\b/i.test(`${im.alt} ${im.src}`));
        const has5 = (c) => /Duyệt trong 5 phút/i.test(c.innerText);
        const target = cards.find((c) => hasFE(c) && has5(c)) || cards.find(has5) || cards[0];
        if (!target) return null;
        target.setAttribute('data-pw-pkg', '1');
        return { total: cards.length, isFE: hasFE(target), is5: has5(target) };
      });
      expect(picked, 'Phải tìm thấy ít nhất 1 gói trả chậm nổi bật').not.toBeNull();
      console.log('[INST_Company_08] Gói được chọn:', JSON.stringify(picked));
      const pkg = page.locator('[data-pw-pkg="1"]');
      await pkg.scrollIntoViewIfNeeded();
      await expect(pkg).toBeVisible();
      const radio = pkg.locator('input[type="radio"], input[type="checkbox"]').first();
      if (await radio.count()) {
        await radio.check({ force: true }).catch(async () => { await pkg.click(); });
      } else {
        await pkg.click();
      }
      await page.waitForTimeout(1000);
    };

    // Nhập địa chỉ (2 màn hình) - giống INST_Paylater_05
    const chooseAddress = () => chooseAddressFlow(page);

    // Thông tin nhận hàng
    const fillReceiver = async () => {
      const dialogTitle = page.getByText('Thông tin đặt hàng').first();
      const markOrderDialog = () => dialogTitle.evaluate((el) => {
        document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
        let p = el;
        for (let i = 0; p && i < 15; i++, p = p.parentElement) {
          const hasConfirm = [...p.querySelectorAll('button')]
            .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
          if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
        }
        return false;
      });
      const orderDialog = page.locator('[data-qa-order="1"]');

      const infoRow = page.getByText(REMINDER).first();
      await infoRow.scrollIntoViewIfNeeded();
      await expect(infoRow).toBeVisible({ timeout: 10000 });
      if (!(await dialogTitle.isVisible({ timeout: 1500 }).catch(() => false))) {
        await infoRow.click();
        await page.waitForTimeout(1500);
      }
      await expect(dialogTitle, 'Hộp thoại nhập thông tin nhận hàng chưa mở').toBeVisible({ timeout: 5000 });
      expect(await markOrderDialog(), 'Không xác định được khung hộp thoại Thông tin đặt hàng').toBe(true);

      const nameInput = orderDialog.locator('input[placeholder*="Họ và tên" i], input[name*="name" i], [aria-label*="Họ và tên" i]').first();
      await expect(nameInput, 'Phải có ô Họ và tên').toBeVisible({ timeout: 5000 });
      await nameInput.fill(TEST_CUSTOMER.fullName);
      const phoneInput = orderDialog.locator('input[placeholder*="Số điện thoại" i], input[name*="phone" i], input[type="tel"], [aria-label*="Số điện thoại" i]').first();
      await expect(phoneInput, 'Phải có ô Số điện thoại').toBeVisible({ timeout: 5000 });
      await phoneInput.fill(TEST_CUSTOMER.phone);
      await expect(nameInput).toHaveValue(TEST_CUSTOMER.fullName);
      await expect(phoneInput).toHaveValue(TEST_CUSTOMER.phone);

      await chooseAddress();
      await page.waitForTimeout(1000);

      expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập địa chỉ').toBe(true);
      const confirmBtn = orderDialog.getByRole('button', { name: 'Xác nhận', exact: true }).last();
      await expect(confirmBtn, 'Nút [Xác nhận] của hộp thoại phải bấm được').toBeEnabled({ timeout: 5000 });
      await confirmBtn.click({ timeout: 5000 });
      await expect(dialogTitle, 'Hộp thoại Thông tin đặt hàng phải đóng sau khi xác nhận').toBeHidden({ timeout: 10000 });
      await page.waitForTimeout(1500);
      await expect(page.getByText(REMINDER)).toHaveCount(0, { timeout: 10000 });
    };

    // Chọn siêu thị làm hồ sơ (siêu thị đầu danh sách). Bấm lại tối đa 3 lần nếu hộp thoại chưa mở
    const pickStore = async () => {
      const storeBtn = page.locator(L.TC_STORE_SELECT_BTN).first();
      const storeAnchor = page.getByText('Tìm siêu thị gần bạn').first();

      let opened = false;
      for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
        await storeBtn.scrollIntoViewIfNeeded();
        await storeBtn.click();
        opened = await storeAnchor.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[INST_Company_08] Mở hộp thoại siêu thị lần ${attempt}: ${opened ? 'được' : 'chưa mở'}`);
        if (!opened) await page.waitForTimeout(500);
      }
      await expect(storeAnchor, 'Hộp thoại chọn siêu thị chưa mở').toBeVisible({ timeout: 5000 });

      const marked = await storeAnchor.evaluate((el) => {
        document.querySelectorAll('[data-qa-store]').forEach((e) => e.removeAttribute('data-qa-store'));
        let p = el;
        for (let i = 0; p && i < 15; i++, p = p.parentElement) {
          const hasConfirm = [...p.querySelectorAll('button')]
            .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
          if (hasConfirm) { p.setAttribute('data-qa-store', '1'); return true; }
        }
        return false;
      });
      expect(marked, 'Không xác định được khung hộp thoại chọn siêu thị').toBe(true);
      const storeModal = page.locator('[data-qa-store="1"]');

      const firstStore = storeModal.getByText(/^Điện máy XANH\s/).first();
      await expect(firstStore, 'Phải có danh sách siêu thị').toBeVisible({ timeout: 10000 });
      await firstStore.click();
      await page.waitForTimeout(500);
      const storeConfirm = storeModal.getByRole('button', { name: 'Xác nhận', exact: true }).last();
      await expect(storeConfirm).toBeEnabled({ timeout: 5000 });
      await storeConfirm.click();
      await expect(storeAnchor).toBeHidden({ timeout: 10000 });
      await page.waitForTimeout(1000);
    };

    // Tìm checkbox của từng ô đồng ý theo chữ (leo lên tổ tiên nhỏ nhất có đúng 1 checkbox)
    const CONSENTS = {
      policy: { name: 'Chính sách xử lý dữ liệu cá nhân', reSrc: 'Chính sách xử lý dữ liệu cá nhân cho' },
      cccd: { name: 'Cung cấp, chuyển giao CCCD và ngày sinh cho FE Credit', reSrc: 'cung cấp, chuyển giao số Căn cước' },
    };
    const getConsentBox = async (key) => {
      const c = CONSENTS[key];
      const ok = await page.evaluate(({ reSrc, key }) => {
        const re = new RegExp(reSrc, 'i');
        document.querySelectorAll(`[data-qa-consent="${key}"]`).forEach((e) => e.removeAttribute('data-qa-consent'));
        const leaf = [...document.querySelectorAll('*')]
          .filter((el) => el.children.length <= 3 && re.test(el.innerText || '') && (el.innerText || '').length < 400)
          .sort((a, b) => a.innerText.length - b.innerText.length)[0];
        if (!leaf) return false;
        let p = leaf;
        for (let i = 0; p && i < 8; i++, p = p.parentElement) {
          const boxes = p.querySelectorAll('input[type="checkbox"]');
          if (boxes.length === 1) { boxes[0].setAttribute('data-qa-consent', key); return true; }
          if (boxes.length > 1) return false;
        }
        return false;
      }, { reSrc: c.reSrc, key });
      expect(ok, `Không tìm thấy ô đồng ý: ${c.name}`).toBe(true);
      return page.locator(`[data-qa-consent="${key}"]`);
    };
    const tick = async (key) => {
      const box = await getConsentBox(key);
      await scrollCenter(box);
      await box.check({ force: true }).catch(async () => { await box.click({ force: true }); });
      await expect(box, `Ô đồng ý "${CONSENTS[key].name}" phải được tích`).toBeChecked();
      return box;
    };
    // Màu chữ/viền/nền của vùng ô đồng ý (để biết nhãn "(bắt buộc)" có đổi màu báo lỗi hay không)
    const consentLook = (key) => page.evaluate((key) => {
      const box = document.querySelector(`[data-qa-consent="${key}"]`);
      if (!box) return '';
      let c = box;
      for (let i = 0; i < 3 && c.parentElement; i++) c = c.parentElement;
      return [c, ...c.querySelectorAll('*')].map((el) => {
        const cs = getComputedStyle(el);
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
        return `${own ? cs.color : ''}|${cs.borderTopColor}|${cs.outlineColor}`;
      }).join(';');
    }, key);

    /* ------------------------------------------------------------------
     * Pre-condition: SP F, /tra-cham-tai-chinh, đã chọn gói, đã nhập đầy đủ thông tin hợp lệ
     * ------------------------------------------------------------------ */
    await goToFinancialPage(page, 'F');
    await expect(page).toHaveURL(/\/tra-cham-tai-chinh/);
    await expect(page.getByText('Giỏ Hàng Trả Chậm Tài Chính').first()).toBeVisible({ timeout: 10000 });

    await pickPackage();
    await fillReceiver();

    const idInput = page.locator(L.TC_IDCARD_INPUT).first();
    await scrollCenter(idInput);
    await expect(idInput).toBeVisible({ timeout: 10000 });
    await idInput.focus(); // không click(): nhãn nổi và thanh menu cố định chặn con trỏ
    await idInput.fill(TEST_CUSTOMER.idCard);
    await idInput.blur();

    const bdayInput = page.locator(L.TC_BIRTHDAY_INPUT).first();
    await scrollCenter(bdayInput);
    await expect(bdayInput).toBeVisible({ timeout: 10000 });
    await bdayInput.focus();
    await bdayInput.fill(VALID_DOB); // DD/MM/YYYY
    await bdayInput.blur();
    await page.waitForTimeout(500);

    await pickStore();

    // Ô "chuyển giao CCCD cho FE Credit" luôn tích (để chỉ còn ô chính sách là biến số của TC này)
    await tick('cccd');

    /* ------------------------------------------------------------------
     * Hàm kiểm tra
     * ------------------------------------------------------------------ */
    const otpTextRe = /(xác thực|xác minh|\bOTP\b|mã SMS|nhập mã|mã gồm|tin nhắn|gửi (về|đến) số)/i;
    const otpInputSel = 'input[autocomplete="one-time-code"], input[inputmode="numeric"][maxlength="4"], input[inputmode="numeric"][maxlength="5"], input[inputmode="numeric"][maxlength="6"], input[inputmode="numeric"][maxlength="8"]';
    const otpSignal = async () => {
      const t = await page.getByText(otpTextRe).filter({ visible: true }).count();
      const i = await page.locator(otpInputSel).filter({ visible: true }).count();
      return t + i;
    };
    const submitBtn = page.getByRole('button', { name: 'Đặt mua trả chậm' }).first();

    /* ------------------------------------------------------------------
     * Bước 1: để trống ô chính sách, bấm [Đặt mua trả chậm] -> bị chặn
     * ------------------------------------------------------------------ */
    await test.step('Bước 1: Để trống ô đồng ý Chính sách xử lý dữ liệu cá nhân, bấm [Đặt mua trả chậm]', async () => {
      const label = 'buoc-1-chua-dong-y-chinh-sach';
      const policyBox = await getConsentBox('policy');
      await scrollCenter(policyBox);
      await expect(policyBox, 'Pre-condition bước 1: ô chính sách phải đang để trống').not.toBeChecked();
      const cccdBox = await getConsentBox('cccd');
      await expect(cccdBox, 'Ô chuyển giao CCCD phải đang được tích').toBeChecked();

      await scrollCenter(submitBtn);
      await expect(submitBtn, 'Phải có nút [Đặt mua trả chậm]').toBeVisible({ timeout: 5000 });

      const otpBefore = await otpSignal();
      const textsBefore = await visibleTexts();
      const lookBefore = await consentLook('policy');
      const disabled = await submitBtn.isDisabled().catch(() => false);
      if (!disabled) await submitBtn.click({ timeout: 5000 });

      // Gom thông báo trong ~3s (phòng toast tự biến mất)
      const seenTexts = new Set();
      const seenErrors = new Set();
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(400);
        for (const t of await visibleTexts()) seenTexts.add(t);
        for (const m of await readErrors()) seenErrors.add(m);
      }
      const newTexts = [...seenTexts].filter((t) => !textsBefore.includes(t));
      const errors = [...seenErrors];
      const lookAfter = await consentLook('policy');
      const colorChanged = lookBefore !== lookAfter;
      const otpAfter = await otpSignal();
      await test.info().attach(`${label}-sau-khi-bam`, { body: await page.screenshot(), contentType: 'image/png' });
      console.log(`[INST_Company_08] ${label}: nút bị khóa=${disabled} | OTP trước/sau=${otpBefore}/${otpAfter} | vùng ô chính sách đổi màu=${colorChanged}`);
      console.log(`[INST_Company_08] ${label}: chữ mới xuất hiện sau khi bấm =`, JSON.stringify(newTexts.slice(0, 20)));
      console.log(`[INST_Company_08] ${label}: báo lỗi thấy được =`, JSON.stringify(errors));

      // Expected (cứng): không đặt mua được -> không tới OTP, không sang trang thành công
      expect(otpAfter, `${label}: KHÔNG được hiện hộp thoại nhập mã OTP khi chưa đồng ý chính sách`).toBeLessThanOrEqual(otpBefore);
      await expect(page).not.toHaveURL(/dat-hang-thanh-cong|thanh-cong|order-success/i);
      await expect(page).toHaveURL(/\/tra-cham-tai-chinh/);
      await expect(policyBox, 'Ô chính sách vẫn phải để trống').not.toBeChecked();

      // Expected (mềm): báo bắt buộc đồng ý chính sách (nội dung ghi "bắt buộc"):
      // hoặc có chữ mới nhắc đồng ý/bắt buộc/chính sách, hoặc vùng ô chính sách đổi màu báo lỗi
      const hasMsg = newTexts.some((t) => /(bắt buộc|đồng ý|chính sách)/i.test(t) && !/^Tôi đồng ý/.test(t))
        || errors.some((m) => /(bắt buộc|đồng ý|chính sách)/i.test(m));
      expect.soft(
        hasMsg || colorChanged,
        `${label}: phải báo bắt buộc đồng ý chính sách. Chữ mới: ${JSON.stringify(newTexts.slice(0, 10))} | báo lỗi: ${JSON.stringify(errors)} | đổi màu: ${colorChanged}${disabled ? ' (nút [Đặt mua trả chậm] đang bị khóa)' : ''}`
      ).toBe(true);
    });

    /* ------------------------------------------------------------------
     * Bước 2: tích ô chính sách, bấm [Đặt mua trả chậm] -> tới hộp thoại OTP, rồi DỪNG
     * ------------------------------------------------------------------ */
    await test.step('Bước 2: Tích ô đồng ý, bấm [Đặt mua trả chậm], dừng tại bước nhập mã SMS', async () => {
      const label = 'buoc-2-da-dong-y';
      await tick('policy');
      await page.waitForTimeout(500);

      await scrollCenter(submitBtn);
      await expect(submitBtn).toBeVisible();
      await expect(submitBtn).toBeEnabled();
      await test.info().attach(`${label}-truoc-khi-bam`, { body: await page.screenshot(), contentType: 'image/png' });
      await submitBtn.click({ timeout: 5000 });

      // Expected: hiện hộp thoại nhập mã xác thực (nhận diện theo chữ HOẶC theo ô nhập mã)
      const otpByText = page.getByText(otpTextRe).filter({ visible: true }).first();
      const otpByInput = page.locator(otpInputSel).filter({ visible: true }).first();
      const otpShown = await Promise.any([
        otpByText.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'text'),
        otpByInput.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'input'),
      ]).catch(() => null);

      await page.waitForTimeout(1000);
      await test.info().attach(`${label}-sau-khi-bam`, { body: await page.screenshot(), contentType: 'image/png' });

      if (!otpShown) {
        const errors = await readErrors();
        const dialogs = (await page.locator('[id^="modal-"], [role="dialog"], .modal-content').filter({ visible: true }).allInnerTexts().catch(() => []))
          .map((t) => t.replace(/\s+/g, ' ').slice(0, 300));
        throw new Error(
          `Đã đồng ý chính sách nhưng không đi tiếp được tới hộp thoại OTP (URL: ${page.url()}). ` +
          `Báo lỗi: ${JSON.stringify(errors)}. Hộp thoại đang mở: ${JSON.stringify(dialogs)}`
        );
      }
      console.log(`[INST_Company_08] ${label}: hộp thoại OTP nhận diện qua:`, otpShown);

      const otpDialogs = (await page.locator('[id^="modal-"], [role="dialog"], .modal-content').filter({ visible: true }).allInnerTexts().catch(() => []))
        .map((t) => t.replace(/\s+/g, ' ').slice(0, 300));
      console.log(`[INST_Company_08] ${label}: nội dung hộp thoại:`, JSON.stringify(otpDialogs));

      // Chưa tạo hồ sơ
      await expect(page).not.toHaveURL(/dat-hang-thanh-cong|thanh-cong|order-success/i);
      await expect(page.getByText(/(đặt hàng thành công|hồ sơ.*đã được tạo)/i)).toHaveCount(0);

      // DỪNG tại đây: không nhập mã SMS, không bấm xác nhận
    });
  });

  /* --------------------------------------------------------------------------
   * PHẦN 4: TRẢ CHẬM QUA THẺ TÍN DỤNG (INST_Card)
   * -------------------------------------------------------------------------- */

  // TC 19: Chọn Qua thẻ tín dụng hiển thị danh sách ngân hàng trả chậm
  test('INST_Card_01 - Chọn Qua thẻ tín dụng hiển thị danh sách ngân hàng trả chậm', async ({ page }) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(15000);

    // Các ngân hàng nêu trong Expected (dấu "..." nghĩa là còn thêm ngân hàng khác, không cần liệt kê hết).
    // Logo ngân hàng có thể không có chữ -> nhận diện bằng chữ, alt/title/aria-label hoặc tên file ảnh.
    const BANKS = [
      { name: 'VPBank', re: /vp\s*-?\s*bank|\bvpb\b|thịnh vượng/i },
      { name: 'LPBank', re: /lp\s*-?\s*bank|\blpb\b|liên việt|lienviet/i },
      { name: 'Techcombank', re: /techcom|\btcb\b|kỹ thương/i },
      { name: 'Nam A Bank', re: /nam\s*-?\s*a(?!\w)|namabank|\bnab\b|nam á/i },
      { name: 'Home Credit', re: /home\s*-?\s*credit|homecredit/i },
      { name: 'TPBank', re: /tp\s*-?\s*bank|\btpb\b|tienphong|tiên phong/i },
      { name: 'HSBC', re: /hsbc/i },
      { name: 'VIB', re: /\bvib\b/i },
      { name: 'Vietcombank', re: /vietcombank|\bvcb\b/i },
      { name: 'BIDV', re: /bidv/i },
    ];
    const reSrc = (re) => ({ source: re.source, flags: re.flags });

    // Đọc lưới ngân hàng. Vùng quét = các phần tử nằm SAU tiêu đề "Chọn ngân hàng trả chậm" và TRƯỚC tiêu đề "Chọn loại thẻ"
    // theo thứ tự trong DOM (không dùng toạ độ, vì lưới có thanh cuộn nên các hàng bị ẩn vẫn phải được tính).
    // Mỗi ô ngân hàng = khối nhỏ nhất bọc đúng 1 logo (kèm nhãn giảm giá). Tên ngân hàng nhận diện qua chữ, alt/title,
    // tên file ảnh; logo nào không có dấu hiệu tên thì xếp vào "chưa nhận diện" để kiểm bằng mắt.
    const scanBanks = () => page.evaluate((banks) => {
      document.querySelectorAll('[data-qa-bank-root]').forEach((e) => e.removeAttribute('data-qa-bank-root'));
      const B = banks.map((b) => ({ name: b.name, re: new RegExp(b.re.source, b.re.flags) }));
      const DISC = /giảm\s*\d[\d.,]*\s*(k|tr|triệu|nghìn|ngàn|đ|₫|%)/i;
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const srcOf = (img) => img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src') || '';
      const sig = (el) => {
        const parts = [el.innerText];
        for (const e of [el, ...el.querySelectorAll('img, svg, source, [alt], [title], [aria-label]')]) {
          parts.push(e.getAttribute && e.getAttribute('alt'), e.getAttribute && e.getAttribute('title'),
            e.getAttribute && e.getAttribute('aria-label'), e.tagName === 'IMG' ? srcOf(e) : '');
        }
        return norm(parts.filter(Boolean).join(' '));
      };
      const leaves = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && visible(e));
      const heading = leaves.find((el) => /^Chọn ngân hàng trả chậm/i.test(norm(el.textContent)));
      if (!heading) return { heading: false };
      const follows = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const step2 = leaves.find((el) => /^Chọn loại thẻ/i.test(norm(el.textContent)) && follows(heading, el));
      const inScope = (el) => visible(el) && follows(heading, el) && !el.contains(heading) && (!step2 || (follows(el, step2) && !el.contains(step2)));

      // Logo ngân hàng: ảnh đủ lớn (bỏ icon nhỏ như biểu tượng tìm kiếm)
      const imgs = [...document.querySelectorAll('img')].filter((im) => inScope(im) && im.getBoundingClientRect().width >= 40);
      const tiles = [];
      for (const im of imgs) {
        let t = im;
        while (t.parentElement && inScope(t.parentElement) && t.parentElement.querySelectorAll('img').length === 1) t = t.parentElement;
        if (!tiles.includes(t)) tiles.push(t);
      }

      const out = {};
      const unmatched = [];
      let matchedTiles = 0;
      for (const t of tiles) {
        const s = sig(t);
        const hit = B.find((b) => b.re.test(s));
        const label = (norm(t.innerText).match(DISC) || [null])[0];
        if (hit) {
          matchedTiles++;
          if (!out[hit.name]) out[hit.name] = { found: true, label };
        } else {
          const im = t.querySelector('img');
          unmatched.push({ label, alt: im ? (im.getAttribute('alt') || '') : '', src: im ? srcOf(im).slice(-70) : '', text: norm(t.innerText).slice(0, 40) });
        }
      }
      for (const b of B) if (!out[b.name]) out[b.name] = { found: false };

      // Tổ tiên chung của các ô: dùng để chụp ảnh lưới
      if (tiles.length) {
        let anc = tiles[0].parentElement;
        while (anc && anc !== document.body && !tiles.every((c) => anc.contains(c))) anc = anc.parentElement;
        if (anc && anc !== document.body) anc.setAttribute('data-qa-bank-root', '1');
      }
      const scope = [...document.querySelectorAll('body *')].filter(inScope);
      const anyLabels = [...new Set(scope.filter((e) => e.children.length === 0 && DISC.test(norm(e.textContent))).map((e) => norm(e.textContent)))];
      const discounts = B.filter((b) => out[b.name].found && out[b.name].label).map((b) => `${b.name}: ${out[b.name].label}`);
      return { heading: true, root: tiles.length > 0, banks: out, discounts, anyLabels: anyLabels.slice(0, 20),
        tileCount: tiles.length, matchedTiles, unmatched, hasStep2Heading: !!step2 };
    }, BANKS.map((b) => ({ name: b.name, re: reSrc(b.re) })));

    // ---- Pre-condition: SP F, đã mở hộp thoại "Chọn hình thức trả chậm" ----
    await openProduct(page, 'F');
    // Nút [Trả chậm 0%] (nhấn được, chữ ngắn); không dùng L.INSTALLMENT_BTN vì selector đó khớp cả chữ "Trả chậm" trơn
    let marked = false;
    for (let i = 0; i < 24 && !marked; i++) {
      marked = await page.evaluate(() => {
        document.querySelectorAll('[data-qa-inst-btn]').forEach((e) => e.removeAttribute('data-qa-inst-btn'));
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const label = (el) => norm(el.innerText) || norm(el.getAttribute('aria-label')) || norm(el.title);
        const visible = (el) => {
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        };
        const btn = [...document.querySelectorAll('button, a, [role="button"]')]
          .find((el) => visible(el) && label(el).length <= 60 && /Trả chậm\s*0\s*%/i.test(label(el)));
        if (btn) btn.setAttribute('data-qa-inst-btn', '1');
        return !!btn;
      });
      if (!marked) { if (i === 8) await page.mouse.wheel(0, 700); await page.waitForTimeout(500); }
    }
    expect(marked, 'Pre-condition: SP F phải có nút [Trả chậm 0%] (SP có thể đang hết hàng/sắp về)').toBe(true);
    const instBtn = page.locator('[data-qa-inst-btn]').first();
    await instBtn.scrollIntoViewIfNeeded();
    await instBtn.click();
    await expect(page.getByText('Chọn hình thức trả chậm').filter({ visible: true }).first(),
      'Pre-condition: phải mở được hộp thoại "Chọn hình thức trả chậm"').toBeVisible({ timeout: 10000 });

    // ---- Bước 1: click lựa chọn "Qua thẻ tín dụng" ----
    // Lựa chọn là liên kết /tra-cham?... (không phải /tra-cham-tai-chinh hay /tra-cham-bnpl)
    const cardOption = page.locator('a[href*="/tra-cham?"]').filter({ hasText: /Qua thẻ tín dụng/i })
      .or(page.getByText('Qua thẻ tín dụng')).filter({ visible: true }).first();
    await expect(cardOption, 'Phải có lựa chọn "Qua thẻ tín dụng" trong hộp thoại').toBeVisible({ timeout: 10000 });
    await Promise.all([
      page.waitForURL(/\/tra-cham(\?|$)/, { timeout: 20000 }).catch(() => {}),
      cardOption.click(),
    ]);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Expected 1: sang trang /tra-cham (không phải /tra-cham-tai-chinh, /tra-cham-bnpl)
    await expect(page, `Bước 1: phải chuyển sang trang /tra-cham (đang ở ${page.url()})`).toHaveURL(/\/tra-cham(\?|$)/);
    await expect(page.getByText(/Giỏ Hàng Trả Chậm Thẻ Tín Dụng/i).first(),
      'Bước 1: phải có tiêu đề "Giỏ Hàng Trả Chậm Thẻ Tín Dụng"').toBeVisible({ timeout: 15000 });
    const body = (await page.locator('body').innerText()).replace(/\u00a0/g, ' ');
    expect.soft(body, 'Bước 1: phải hiển thị SP F (65QNED70BSA)').toMatch(/65QNED70BSA/i);
    expect.soft(body, 'Bước 1: phải có khối dịch vụ đi kèm').toMatch(/dịch vụ|đi kèm|lắp đặt/i);
    expect.soft(body, 'Bước 1: phải có khối quà tặng/khuyến mãi').toMatch(/quà tặng|khuyến mãi|phiếu mua hàng|ưu đãi/i);
    expect.soft(body, 'Bước 1: phải có khối "Chi tiết thanh toán"').toMatch(/Chi tiết thanh toán/i);
    await expect.soft(page.getByRole('button', { name: 'Thanh toán', exact: true }).filter({ visible: true }).first(),
      'Bước 1: phải có nút [Thanh toán]').toBeVisible();
    await test.info().attach('buoc-1-trang-tra-cham', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // ---- Bước 2: quan sát "Chọn ngân hàng trả chậm" (Bước 1) và "Chọn loại thẻ" (Bước 2) ----
    const bankHeading = page.getByText('Chọn ngân hàng trả chậm').filter({ visible: true }).first();
    await expect(bankHeading, 'Phải có khối "Chọn ngân hàng trả chậm"').toBeVisible({ timeout: 10000 });
    await bankHeading.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 150); // kích hoạt ảnh tải chậm (lazy) nếu có
    await page.waitForTimeout(800);

    // Chờ lưới ngân hàng hiện đủ (tối đa ~10s)
    let r = await scanBanks();
    for (let i = 0; i < 20 && !(r.root && r.tileCount >= BANKS.length); i++) {
      await page.waitForTimeout(500);
      r = await scanBanks();
    }
    console.log('[INST_Card_01]', JSON.stringify(r));
    const rootLoc = page.locator('[data-qa-bank-root]').first();
    const gridShot = (await rootLoc.count()) ? await rootLoc.screenshot().catch(() => null) : null;
    await test.info().attach('buoc-2-luoi-ngan-hang', { body: gridShot || (await page.screenshot()), contentType: 'image/png' });
    expect(r.heading, 'Phải có khối "Chọn ngân hàng trả chậm"').toBe(true);
    expect.soft(r.root, `Bước 2: phải thấy các logo ngân hàng bên dưới tiêu đề "Chọn ngân hàng trả chậm" (${r.hasStep2Heading ? 'có' : 'không có'} tiêu đề "Chọn loại thẻ" làm mốc)`).toBe(true);
    expect.soft(r.tileCount, `Bước 2: lưới phải có ít nhất ${BANKS.length} ngân hàng (đang thấy ${r.tileCount} logo)`).toBeGreaterThanOrEqual(BANKS.length);

    // Expected 2a: lưới ngân hàng đủ các ngân hàng nêu trong Expected.
    // Logo không có chữ/alt/tên file chứa tên ngân hàng thì script không biết là logo nào ("chưa nhận diện").
    //  - Số logo chưa nhận diện >= số ngân hàng chưa thấy tên -> có thể là chính các ngân hàng đó: kiểm bằng mắt, không kết luận lỗi.
    //  - Số logo chưa nhận diện < số ngân hàng chưa thấy tên -> chắc chắn thiếu ngân hàng: báo lỗi.
    const missing = BANKS.filter((b) => !(r.banks[b.name] && r.banks[b.name].found)).map((b) => b.name);
    const unknownDesc = r.unmatched.map((u) => `${u.alt || u.src || u.text}${u.label ? ' [' + u.label + ']' : ''}`);
    if (missing.length > 0) console.log('[INST_Card_01] Chưa thấy tên:', JSON.stringify(missing), '| logo chưa nhận diện (alt/text/tên file):', JSON.stringify(r.unmatched));
    if (missing.length > 0 && r.unmatched.length >= missing.length) {
      manual(`Bước 2: ${missing.length} ngân hàng (${missing.join(', ')}) không đọc được tên từ logo (logo không có chữ/alt/tên file chứa tên). ` +
        `Có ${r.unmatched.length} logo chưa nhận diện; kiểm tra bằng mắt ảnh đính kèm "buoc-2-luoi-ngan-hang" có đủ các ngân hàng này.`);
      test.info().annotations.push({ type: 'logo-chua-nhan-dien', description: r.unmatched.map((u) => `${u.alt || '(không alt)'} | ${u.src}`).join(' ; ') });
    } else {
      expect.soft(missing, `Bước 2: lưới ngân hàng thiếu: ${missing.join(', ')} (tìm thấy ${BANKS.length - missing.length}/${BANKS.length} tên; ${r.tileCount} logo trong lưới, chưa nhận diện ${r.unmatched.length}: ${unknownDesc.join(', ') || 'không có'})`).toEqual([]);
    }

    // Expected 2b: nhãn giảm giá (vd: Giảm 500k, Giảm 600k)
    expect.soft(r.anyLabels.length, 'Bước 2: lưới ngân hàng phải có nhãn giảm giá (vd "Giảm 500k", "Giảm 600k")').toBeGreaterThan(0);
    expect.soft(r.discounts.length, `Bước 2: các ngân hàng trong Expected phải kèm nhãn giảm giá (nhãn tìm thấy: ${r.anyLabels.join(' | ') || 'không có'})`).toBeGreaterThan(0);
    test.info().annotations.push({ type: 'nhan-giam-gia', description: r.anyLabels.join(' | ') || 'không có' });

    // Expected 2c: bước 2 chưa chọn ngân hàng nên chỉ có hướng dẫn chọn ngân hàng
    const step2 = page.getByText('Chọn loại thẻ').filter({ visible: true }).first();
    await step2.scrollIntoViewIfNeeded();
    await expect.soft(step2, 'Bước 2: phải có khối "Chọn loại thẻ"').toBeVisible();
    await expect.soft(page.getByText(/Vui lòng chọn ngân hàng để xem loại thẻ/i).filter({ visible: true }).first(),
      'Bước 2: phải hiển thị "Vui lòng chọn ngân hàng để xem loại thẻ"').toBeVisible();
    await test.info().attach('buoc-2-chon-loai-the', { body: await page.screenshot(), contentType: 'image/png' });

    // KHÔNG chọn ngân hàng/loại thẻ, không bấm [Thanh toán]
  });

  // TC 20: Chọn ngân hàng hiển thị loại thẻ tương ứng
    test('INST_Card_02 - Chọn ngân hàng hiển thị loại thẻ tương ứng', async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);

    // Nhận diện ngân hàng qua chữ, alt/title/aria-label hoặc tên file ảnh của logo
    const BANKS = [
      { name: 'VPBank', re: /vp\s*-?\s*bank|\bvpb\b|thịnh vượng/i },
      { name: 'LPBank', re: /lp\s*-?\s*bank|\blpb\b|liên việt|lienviet/i },
      { name: 'Techcombank', re: /techcom|\btcb\b|kỹ thương/i },
      { name: 'Nam A Bank', re: /nam\s*-?\s*a(?!\w)|namabank|\bnab\b|nam á/i },
      { name: 'Home Credit', re: /home\s*-?\s*credit|homecredit/i },
      { name: 'TPBank', re: /tp\s*-?\s*bank|\btpb\b|tienphong|tiên phong/i },
      { name: 'HSBC', re: /hsbc/i },
      { name: 'VIB', re: /\bvib\b/i },
      { name: 'Vietcombank', re: /vietcombank|\bvcb\b/i },
      { name: 'BIDV', re: /bidv/i },
    ];
    const bankOf = (sig) => { const b = BANKS.find((x) => x.re.test(sig)); return b ? b.name : null; };
    // Nhận diện loại thẻ qua tên file/alt của logo
    const CARD_TYPES = [
      ['Visa', /visa/i], ['Mastercard', /master/i], ['JCB', /jcb/i], ['American Express', /amex|american/i],
    ];
    const cardNameOf = (sig) => { const c = CARD_TYPES.find(([, re]) => re.test(sig)); return c ? c[0] : null; };

    // ---- Pre-condition: đang ở trang /tra-cham (Giỏ Hàng Trả Chậm Thẻ Tín Dụng) của SP F ----
    await openProduct(page, 'F');
    let marked = false;
    for (let i = 0; i < 24 && !marked; i++) {
      marked = await page.evaluate(() => {
        document.querySelectorAll('[data-qa-inst-btn]').forEach((e) => e.removeAttribute('data-qa-inst-btn'));
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const label = (el) => norm(el.innerText) || norm(el.getAttribute('aria-label')) || norm(el.title);
        const visible = (el) => {
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        };
        const btn = [...document.querySelectorAll('button, a, [role="button"]')]
          .find((el) => visible(el) && label(el).length <= 60 && /Trả chậm\s*0\s*%/i.test(label(el)));
        if (btn) btn.setAttribute('data-qa-inst-btn', '1');
        return !!btn;
      });
      if (!marked) { if (i === 8) await page.mouse.wheel(0, 700); await page.waitForTimeout(500); }
    }
    expect(marked, 'Pre-condition: SP F phải có nút [Trả chậm 0%] (SP có thể đang hết hàng/sắp về)').toBe(true);
    const instBtn = page.locator('[data-qa-inst-btn]').first();
    await instBtn.scrollIntoViewIfNeeded();
    await instBtn.click();
    await expect(page.getByText('Chọn hình thức trả chậm').filter({ visible: true }).first(),
      'Pre-condition: phải mở được hộp thoại "Chọn hình thức trả chậm"').toBeVisible({ timeout: 10000 });
    const cardOption = page.locator('a[href*="/tra-cham?"]').filter({ hasText: /Qua thẻ tín dụng/i })
      .or(page.getByText('Qua thẻ tín dụng')).filter({ visible: true }).first();
    await expect(cardOption, 'Phải có lựa chọn "Qua thẻ tín dụng" trong hộp thoại').toBeVisible({ timeout: 10000 });
    await Promise.all([
      page.waitForURL(/\/tra-cham(\?|$)/, { timeout: 20000 }).catch(() => {}),
      cardOption.click(),
    ]);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await expect(page, `Pre-condition: phải ở trang /tra-cham (đang ở ${page.url()})`).toHaveURL(/\/tra-cham(\?|$)/);
    await expect(page.getByText(/Giỏ Hàng Trả Chậm Thẻ Tín Dụng/i).first(),
      'Pre-condition: phải có tiêu đề "Giỏ Hàng Trả Chậm Thẻ Tín Dụng"').toBeVisible({ timeout: 15000 });

    // ---------- Đọc lưới ngân hàng: đánh dấu từng ô (data-qa-bank-tile), lấy chữ/logo nhận diện và kiểu hiển thị ----------
    // Vùng quét = các phần tử SAU tiêu đề "Chọn ngân hàng trả chậm" và TRƯỚC tiêu đề "Chọn loại thẻ".
    const readTiles = () => page.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const srcOf = (img) => img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src') || '';
      const sig = (el) => {
        const parts = [el.innerText];
        for (const e of [el, ...el.querySelectorAll('img, svg, source, [alt], [title], [aria-label]')]) {
          parts.push(e.getAttribute && e.getAttribute('alt'), e.getAttribute && e.getAttribute('title'),
            e.getAttribute && e.getAttribute('aria-label'), e.tagName === 'IMG' ? srcOf(e) : '');
        }
        return norm(parts.filter(Boolean).join(' '));
      };
      // Kiểu hiển thị của ô: lớp CSS, viền, nền, bóng, dấu tích (svg) bên trong
      const style = (el) => {
        const cs = getComputedStyle(el);
        return [String(el.className), cs.borderColor, cs.borderWidth, cs.backgroundColor, cs.boxShadow, cs.outlineStyle,
          cs.opacity, el.querySelectorAll('svg').length, el.querySelectorAll('*').length].join('|');
      };
      document.querySelectorAll('[data-qa-bank-tile]').forEach((e) => e.removeAttribute('data-qa-bank-tile'));
      const leaves = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && visible(e));
      const heading = leaves.find((el) => /^Chọn ngân hàng trả chậm/i.test(norm(el.textContent)));
      if (!heading) return [];
      const follows = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const step2 = leaves.find((el) => /^Chọn loại thẻ/i.test(norm(el.textContent)) && follows(heading, el));
      const inScope = (el) => visible(el) && follows(heading, el) && !el.contains(heading) && (!step2 || (follows(el, step2) && !el.contains(step2)));
      const imgs = [...document.querySelectorAll('img')].filter((im) => inScope(im) && im.getBoundingClientRect().width >= 40);
      const tiles = [];
      for (const im of imgs) {
        let t = im;
        while (t.parentElement && inScope(t.parentElement) && t.parentElement.querySelectorAll('img').length === 1) t = t.parentElement;
        if (!tiles.includes(t)) tiles.push(t);
      }
      return tiles.map((t, i) => { t.setAttribute('data-qa-bank-tile', String(i)); return { sig: sig(t), style: style(t) }; });
    });

    // ---------- Đọc bước 2 "Chọn loại thẻ": logo và chữ nằm SAU tiêu đề, dừng khi gặp chân trang ----------
    const readStep2 = () => page.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const all = [...document.querySelectorAll('body *')];
      const heading = all.find((e) => e.children.length === 0 && visible(e) && /^Chọn loại thẻ/i.test(norm(e.textContent)));
      if (!heading) return { heading: false, imgs: [], texts: [] };
      const follows = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const stop = /^(Tổng đài hỗ trợ|Về công ty|Website cùng tập đoàn|Thông tin khác)/i;
      const imgs = [], texts = [];
      for (const el of all) {
        if (imgs.length + texts.length >= 80) break;
        if (!follows(heading, el) || !visible(el)) continue;
        if (el.tagName === 'IMG') {
          if (el.getBoundingClientRect().width >= 40) {
            imgs.push(norm(`${el.alt || ''} ${(el.currentSrc || el.src || '').split('/').pop()}`));
          }
          continue;
        }
        if (el.children.length === 0) {
          const t = norm(el.textContent);
          if (!t) continue;
          if (stop.test(t)) break;
          texts.push(t);
        }
      }
      return { heading: true, imgs, texts };
    });
    // Chờ nội dung ổn định (hai lần đọc liên tiếp giống nhau, tối đa ~7 giây)
    const settleStep2 = async () => {
      let last = null, cur = null;
      for (let i = 0; i < 12; i++) {
        cur = await readStep2();
        const s = JSON.stringify([cur.imgs, cur.texts]);
        if (s === last) return cur;
        last = s;
        await page.waitForTimeout(600);
      }
      return cur;
    };
    const describe = (s) => ({
      loaiThe: s.imgs.map((i) => cardNameOf(i) || i),
      kyHan: s.texts.filter((t) => /\d+\s*tháng/i.test(t)),
      chuKhac: s.texts,
    });

    // Chọn một ngân hàng: đưa ô vào giữa màn hình rồi bấm; trả về kiểu hiển thị của các ô trước/sau khi bấm
    const pickBank = async (bankName) => {
      const before = await readTiles();
      const names = before.map((t) => bankOf(t.sig));
      const idx = names.indexOf(bankName);
      expect(idx, `Không thấy ngân hàng ${bankName} trong lưới. Các ô nhận diện được: ${JSON.stringify(names)}`).toBeGreaterThanOrEqual(0);
      const tile = page.locator(`[data-qa-bank-tile="${idx}"]`).first();
      await tile.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      await tile.click();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const after = await readTiles();
      return { idx, names, before, after, afterNames: after.map((t) => bankOf(t.sig)) };
    };

    // ---- Trạng thái ban đầu: chưa chọn ngân hàng nào ----
    const base = await settleStep2();
    const baseD = describe(base);
    console.log('[INST_Card_03] Trước khi chọn ngân hàng: có "Chọn loại thẻ":', base.heading, '| loại thẻ:', JSON.stringify(baseD.loaiThe), '| kỳ hạn:', JSON.stringify(baseD.kyHan), '| chữ:', JSON.stringify(baseD.chuKhac));
    expect(base.heading, 'Phải có bước "Chọn loại thẻ" trên trang').toBe(true);
    const tiles0 = await readTiles();
    console.log('[INST_Card_03] Các ô ngân hàng:', JSON.stringify(tiles0.map((t) => bankOf(t.sig))));
    await test.info().attach('ban-dau', { body: await page.screenshot(), contentType: 'image/png' });

    // ---- Bước 1: click chọn ngân hàng VPBank -> VPBank được chọn nổi bật ----
    const v = await pickBank('VPBank');
    const vi = v.afterNames.indexOf('VPBank');
    const changed1 = v.after.map((t, i) => (v.before[i] && v.before[i].style !== t.style ? i : -1)).filter((i) => i >= 0);
    console.log(`[INST_Card_03] Bước 1: ô VPBank = ${vi} | các ô đổi kiểu hiển thị: ${JSON.stringify(changed1)}`);
    await test.info().attach('buoc-1-vpbank', { body: await page.screenshot(), contentType: 'image/png' });
    expect.soft(changed1.includes(vi), 'Bước 1: ô VPBank phải đổi kiểu hiển thị (viền xanh, dấu tích) khi được chọn').toBe(true);
    expect.soft(changed1.filter((i) => i !== vi), 'Bước 1: các ngân hàng khác phải giữ nguyên, chỉ VPBank được nổi bật').toEqual([]);
    const vpStyleSelected = v.after[vi] ? v.after[vi].style : null;
    const vpStyleNormal = v.before[vi] ? v.before[vi].style : null;
    manual('Bước 1: xem ảnh buoc-1-vpbank để xác nhận bằng mắt ô VPBank được làm nổi bật.');

    // ---- Bước 2: quan sát bước "Chọn loại thẻ" -> hiển thị các loại thẻ và kỳ hạn của VPBank ----
    const s1 = await settleStep2();
    const d1 = describe(s1);
    console.log('[INST_Card_03] Bước 2 (VPBank): loại thẻ:', JSON.stringify(d1.loaiThe), '| kỳ hạn:', JSON.stringify(d1.kyHan), '| chữ:', JSON.stringify(d1.chuKhac));
    await test.info().attach('buoc-2-the-vpbank', { body: await page.screenshot(), contentType: 'image/png' });
    expect.soft(s1.imgs.length, 'Bước 2: phải hiển thị các loại thẻ (logo Visa/Mastercard/JCB/American Express...) sau khi chọn VPBank').toBeGreaterThan(0);
    if (JSON.stringify(s1.imgs) === JSON.stringify(base.imgs) && JSON.stringify(s1.texts) === JSON.stringify(base.texts)) {
      test.info().annotations.push({ type: 'note', description: 'Bước 2: nội dung "Chọn loại thẻ" sau khi chọn VPBank giống lúc chưa chọn ngân hàng.' });
    }
    if (d1.kyHan.length === 0) {
      test.info().annotations.push({ type: 'note', description: 'Bước 2: chưa thấy kỳ hạn ngay sau khi chọn ngân hàng (có thể chỉ hiện sau khi chọn loại thẻ).' });
      manual('Bước 2: Excel ghi "các loại thẻ và kỳ hạn" nhưng sau khi chọn VPBank chỉ thấy các loại thẻ, chưa thấy kỳ hạn; kiểm tra bằng tay xem kỳ hạn hiện ở đâu (sau khi chọn loại thẻ?).');
    }

    // ---- Bước 3: chọn ngân hàng khác (Vietcombank) -> bước 2 cập nhật, không còn loại thẻ của ngân hàng cũ ----
    const c = await pickBank('Vietcombank');
    const ci = c.afterNames.indexOf('Vietcombank');
    const vpNow = c.afterNames.indexOf('VPBank');
    console.log(`[INST_Card_03] Bước 3: ô Vietcombank = ${ci} | ô VPBank = ${vpNow}`);
    await test.info().attach('buoc-3-vietcombank', { body: await page.screenshot(), contentType: 'image/png' });
    // VPBank trở về kiểu bình thường, Vietcombank được nổi bật
    if (vpNow >= 0 && vpStyleNormal) {
      expect.soft(c.after[vpNow].style, 'Bước 3: VPBank phải trở về kiểu bình thường (không còn nổi bật)').toBe(vpStyleNormal);
    }
    const vcbChanged = c.after[ci] && c.before[ci] && c.after[ci].style !== c.before[ci].style;
    expect.soft(vcbChanged, 'Bước 3: ô Vietcombank phải đổi kiểu hiển thị (nổi bật) khi được chọn').toBe(true);
    const s2 = await settleStep2();
    const d2 = describe(s2);
    console.log('[INST_Card_03] Bước 3 (Vietcombank): loại thẻ:', JSON.stringify(d2.loaiThe), '| kỳ hạn:', JSON.stringify(d2.kyHan), '| chữ:', JSON.stringify(d2.chuKhac));
    await test.info().attach('buoc-3-the-vietcombank', { body: await page.screenshot(), contentType: 'image/png' });
    expect.soft(s2.imgs.length, 'Bước 3: phải hiển thị các loại thẻ của Vietcombank').toBeGreaterThan(0);
    // Loại thẻ của VPBank mà Vietcombank không hỗ trợ thì không được còn hiển thị
    const sameCards = JSON.stringify(s2.imgs) === JSON.stringify(s1.imgs);
    test.info().annotations.push({ type: 'note', description: sameCards
      ? `Bước 3: Vietcombank và VPBank hiển thị cùng các loại thẻ (${d2.loaiThe.join(', ')}) nên không phân biệt được bằng tự động.`
      : `Bước 3: loại thẻ đổi từ [${d1.loaiThe.join(', ')}] sang [${d2.loaiThe.join(', ')}].` });
    if (sameCards) {
      manual('Bước 3: hai ngân hàng cùng hiển thị một danh sách loại thẻ; xác nhận bằng mắt rằng Vietcombank hỗ trợ đúng các loại thẻ này (ảnh buoc-3-the-vietcombank).');
    }
    if (d1.kyHan.length > 0 || d2.kyHan.length > 0) {
      expect.soft(JSON.stringify(d2.kyHan), 'Bước 3: kỳ hạn phải cập nhật theo ngân hàng mới').not.toBe(JSON.stringify(d1.kyHan));
    }

    // KHÔNG chọn loại thẻ/kỳ hạn, không bấm [Thanh toán]
  });

  // TC 21: Không thể thanh toán khi chưa chọn ngân hàng hoặc loại thẻ
    test('INST_Card_03 - Không thể thanh toán khi chưa chọn ngân hàng, loại thẻ hoặc gói trả chậm', async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);

    // Hộp thoại alert/confirm của trình duyệt (nếu website dùng): ghi lại nội dung rồi đóng
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss().catch(() => {}); });

    const REMINDER = 'Vui lòng cung cấp thông tin nhận hàng';

    // Cuộn phần tử vào GIỮA màn hình (tránh bị thanh menu cố định trên đầu trang che)
    const scrollCenter = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));

    /* ------------------------------------------------------------------
     * Pre-condition 1: đang ở trang /tra-cham (Giỏ Hàng Trả Chậm Thẻ Tín Dụng) của SP F
     * ------------------------------------------------------------------ */
    await openProduct(page, 'F');
    let marked = false;
    for (let i = 0; i < 24 && !marked; i++) {
      marked = await page.evaluate(() => {
        document.querySelectorAll('[data-qa-inst-btn]').forEach((e) => e.removeAttribute('data-qa-inst-btn'));
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const label = (el) => norm(el.innerText) || norm(el.getAttribute('aria-label')) || norm(el.title);
        const visible = (el) => {
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        };
        const btn = [...document.querySelectorAll('button, a, [role="button"]')]
          .find((el) => visible(el) && label(el).length <= 60 && /Trả chậm\s*0\s*%/i.test(label(el)));
        if (btn) btn.setAttribute('data-qa-inst-btn', '1');
        return !!btn;
      });
      if (!marked) { if (i === 8) await page.mouse.wheel(0, 700); await page.waitForTimeout(500); }
    }
    expect(marked, 'Pre-condition: SP F phải có nút [Trả chậm 0%] (SP có thể đang hết hàng/sắp về)').toBe(true);
    const instBtn = page.locator('[data-qa-inst-btn]').first();
    await instBtn.scrollIntoViewIfNeeded();
    await instBtn.click();
    await expect(page.getByText('Chọn hình thức trả chậm').filter({ visible: true }).first(),
      'Pre-condition: phải mở được hộp thoại "Chọn hình thức trả chậm"').toBeVisible({ timeout: 10000 });
    const cardOption = page.locator('a[href*="/tra-cham?"]').filter({ hasText: /Qua thẻ tín dụng/i })
      .or(page.getByText('Qua thẻ tín dụng')).filter({ visible: true }).first();
    await expect(cardOption, 'Phải có lựa chọn "Qua thẻ tín dụng" trong hộp thoại').toBeVisible({ timeout: 10000 });
    await Promise.all([
      page.waitForURL(/\/tra-cham(\?|$)/, { timeout: 20000 }).catch(() => {}),
      cardOption.click(),
    ]);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await expect(page, `Pre-condition: phải ở trang /tra-cham (đang ở ${page.url()})`).toHaveURL(/\/tra-cham(\?|$)/);
    await expect(page.getByText(/Giỏ Hàng Trả Chậm Thẻ Tín Dụng/i).first(),
      'Pre-condition: phải có tiêu đề "Giỏ Hàng Trả Chậm Thẻ Tín Dụng"').toBeVisible({ timeout: 15000 });
    const pathOnPage = new URL(page.url()).pathname;
    const pagesBefore = page.context().pages().length;

    /* ------------------------------------------------------------------
     * Pre-condition 2: đã nhập thông tin nhận hàng (địa chỉ TRƯỚC, rồi họ tên + SĐT, giống chức năng 2)
     * ------------------------------------------------------------------ */
    const fillReceiver = async () => {
      const dialogTitle = page.getByText('Thông tin đặt hàng').filter({ visible: true }).first();
      const markOrderDialog = () => dialogTitle.evaluate((el) => {
        document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
        let p = el;
        for (let i = 0; p && i < 15; i++, p = p.parentElement) {
          const hasConfirm = [...p.querySelectorAll('button')]
            .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
          if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
        }
        return false;
      });
      const orderDialog = page.locator('[data-qa-order="1"]');

      const infoRow = page.getByText(REMINDER).filter({ visible: true }).first();
      if (!(await infoRow.isVisible({ timeout: 4000 }).catch(() => false))) {
        console.log('[INST_Card_04] Không còn dòng nhắc nhập thông tin nhận hàng -> bỏ qua bước nhập');
        return;
      }
      await infoRow.scrollIntoViewIfNeeded();
      // Chỉ click dòng nhắc khi hộp thoại CHƯA mở (nếu đã mở, lớp nền tối sẽ chặn click)
      if (!(await dialogTitle.isVisible({ timeout: 1500 }).catch(() => false))) {
        await infoRow.click();
        await page.waitForTimeout(1500);
      }
      await expect(dialogTitle, 'Hộp thoại nhập thông tin nhận hàng chưa mở').toBeVisible({ timeout: 5000 });
      expect(await markOrderDialog(), 'Không xác định được khung hộp thoại Thông tin đặt hàng').toBe(true);

      // 1) Địa chỉ trước
      await chooseAddressFlow(page);
      await page.waitForTimeout(1000);
      expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi chọn địa chỉ').toBe(true);

      // 2) Họ tên, số điện thoại (có kiểm tra giá trị)
      const nameInput = orderDialog.getByRole('textbox', { name: /Họ tên|Họ và tên/i })
        .or(orderDialog.locator('input[placeholder*="Họ và tên" i], input[name*="name" i], [aria-label*="Họ và tên" i]')).first();
      await expect(nameInput, 'Phải có ô Họ và tên').toBeVisible({ timeout: 5000 });
      await nameInput.fill(TEST_CUSTOMER.fullName);
      const phoneInput = orderDialog.getByRole('textbox', { name: /Số điện thoại/i })
        .or(orderDialog.locator('input[placeholder*="Số điện thoại" i], input[name*="phone" i], input[type="tel"], [aria-label*="Số điện thoại" i]')).first();
      await expect(phoneInput, 'Phải có ô Số điện thoại').toBeVisible({ timeout: 5000 });
      await phoneInput.fill(TEST_CUSTOMER.phone);
      await expect(nameInput).toHaveValue(TEST_CUSTOMER.fullName);
      await expect(phoneInput).toHaveValue(TEST_CUSTOMER.phone);

      // 3) Xác nhận TRONG hộp thoại này
      expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập thông tin').toBe(true);
      const confirmBtn = orderDialog.getByRole('button', { name: 'Xác nhận', exact: true }).last();
      await expect(confirmBtn, 'Nút [Xác nhận] của hộp thoại phải bấm được').toBeEnabled({ timeout: 5000 });
      await confirmBtn.click({ timeout: 5000 });
      await expect(dialogTitle, 'Hộp thoại Thông tin đặt hàng phải đóng sau khi xác nhận').toBeHidden({ timeout: 10000 });
      await page.waitForTimeout(1500);
      await expect(page.getByText(REMINDER), 'Pre-condition: phải nhập được thông tin nhận hàng hợp lệ').toHaveCount(0, { timeout: 10000 });
    };
    await fillReceiver();

    // Không được còn hộp thoại nào đang mở đè lên trang
    if ((await page.locator('[id^="modal-"]').filter({ visible: true }).count()) > 0) {
      await test.info().attach('con-hop-thoai-dang-mo', { body: await page.screenshot(), contentType: 'image/png' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    await test.info().attach('thong-tin-nhan-hang', { body: await page.screenshot(), contentType: 'image/png' });

    /* ------------------------------------------------------------------
     * Pre-condition 3: tích đồng ý chính sách xử lý dữ liệu cá nhân
     * ------------------------------------------------------------------ */
    const markConsent = (reSrc, key) => page.evaluate(({ reSrc, key }) => {
      const re = new RegExp(reSrc, 'i');
      document.querySelectorAll(`[data-qa-consent="${key}"]`).forEach((e) => e.removeAttribute('data-qa-consent'));
      const leaf = [...document.querySelectorAll('*')]
        .filter((el) => el.children.length <= 3 && re.test(el.innerText || '') && (el.innerText || '').length < 400)
        .sort((a, b) => a.innerText.length - b.innerText.length)[0];
      if (!leaf) return false;
      let p = leaf;
      for (let i = 0; p && i < 8; i++, p = p.parentElement) {
        const boxes = p.querySelectorAll('input[type="checkbox"]');
        if (boxes.length === 1) { boxes[0].setAttribute('data-qa-consent', key); return true; }
        if (boxes.length > 1) return false;
      }
      return false;
    }, { reSrc, key });

    // Ô 1: chính sách xử lý dữ liệu cá nhân (bắt buộc)
    const policyFound = await markConsent('Chính sách xử lý dữ liệu cá nhân cho', 'policy');
    const consent = policyFound ? page.locator('[data-qa-consent="policy"]').first() : page.locator(L.CARD_CONSENT_CHECKBOX).first();
    await consent.scrollIntoViewIfNeeded().catch(() => {});
    await consent.check({ force: true }).catch(async () => { await consent.click({ force: true }).catch(() => {}); });
    if (!(await consent.isChecked().catch(() => false))) {
      // Ô vuông nằm ngay bên trái dòng đầu của đoạn "Tôi đồng ý với..."
      const agreeText = page.getByText(/Tôi đồng ý với/).first();
      await agreeText.scrollIntoViewIfNeeded();
      const t = await agreeText.boundingBox();
      await page.mouse.click(t.x - 16, t.y + 9);
    }
    await expect(consent, 'Pre-condition: phải tích được ô đồng ý chính sách').toBeChecked();

    // Ô 2 (nếu trang có): đồng ý cung cấp CCCD/ngày sinh cho công ty tài chính
    if (await markConsent('cung cấp, chuyển giao số Căn cước', 'cccd')) {
      const consent2 = page.locator('[data-qa-consent="cccd"]').first();
      await consent2.scrollIntoViewIfNeeded().catch(() => {});
      await consent2.check({ force: true }).catch(async () => { await consent2.click({ force: true }).catch(() => {}); });
      await expect(consent2, 'Ô đồng ý cung cấp số căn cước phải được tích').toBeChecked();
    }

    // Nút [Thanh toán]
    const submit = page.getByRole('button', { name: 'Thanh toán', exact: true }).last();
    await submit.scrollIntoViewIfNeeded();
    await expect(submit, 'Phải có nút [Thanh toán]').toBeVisible();

    /* ------------------------------------------------------------------
     * Các hàm dùng chung cho 3 bước
     * ------------------------------------------------------------------ */
    // Đọc mọi dòng báo lỗi/yêu cầu đang hiển thị (quét từng đoạn chữ)
    const readErrors = () => page.evaluate(() => {
      const re = /(vui lòng|không được (để )?trống|chưa (nhập|chọn)|bắt buộc (nhập|chọn)|cần (nhập|chọn))/i;
      const out = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 150 || !re.test(t)) continue;
        const el = n.parentElement;
        if (!el) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (/^Tôi đồng ý/.test(t)) continue;
        out.add(t);
      }
      return [...out];
    });

    // Bấm [Thanh toán] rồi gom các dòng báo lỗi trong ~3 giây (toast có thể tự biến mất)
    const clickAndCollect = async () => {
      await submit.scrollIntoViewIfNeeded();
      const errBefore = await readErrors();
      const dialogsBefore = dialogs.length;
      const disabled = await submit.isDisabled().catch(() => false);
      if (!disabled) await submit.click({ timeout: 5000 });
      const seen = new Set();
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(400);
        for (const m of await readErrors()) seen.add(m);
      }
      dialogs.slice(dialogsBefore).forEach((m) => seen.add(m));
      return { disabled, errBefore, errors: [...seen] };
    };

    // Không được chuyển sang cổng thanh toán / mở tab mới
    const noGateway = (label) => {
      const u = new URL(page.url());
      expect.soft(u.hostname, `${label}: không được chuyển sang cổng thanh toán (đang ở ${page.url()})`).toMatch(/dienmayxanh\.com$/);
      expect.soft(u.pathname, `${label}: phải ở lại trang /tra-cham (đang ở ${page.url()})`).toBe(pathOnPage);
      expect.soft(page.context().pages().length, `${label}: không được mở cửa sổ/tab cổng thanh toán mới`).toBe(pagesBefore);
    };

    // Kiểm tra chung cho mỗi bước: không sang cổng + có báo yêu cầu chọn đúng mục còn thiếu
    const checkBlocked = (stepNo, r, what, msgRe, skipReason) => {
      noGateway(`Bước ${stepNo}`);
      if (skipReason) { manual(`Bước ${stepNo}: ${skipReason}`); return; }
      if (r.disabled) {
        manual(`Bước ${stepNo}: nút [Thanh toán] bị khóa khi chưa chọn ${what} (không báo bằng thông báo); xem ảnh đính kèm của bước.`);
        return;
      }
      expect.soft([...r.errBefore, ...r.errors].join(' | '),
        `Bước ${stepNo}: thiếu thông báo yêu cầu chọn ${what} (báo trước khi bấm: ${JSON.stringify(r.errBefore)}; báo sau khi bấm: ${JSON.stringify(r.errors)})`)
        .toMatch(msgRe);
    };

    // Gắn nhãn 4 ô loại thẻ (VISA, Mastercard, JCB, Amex): ảnh nằm giữa tiêu đề "Chọn loại thẻ" và "Chọn số tiền trả chậm"
    const markCardTypes = () => page.evaluate(() => {
      document.querySelectorAll('[data-qa-cardtype]').forEach((e) => e.removeAttribute('data-qa-cardtype'));
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const leafHas = (re) => [...document.querySelectorAll('*')].find((el) => el.children.length === 0 && vis(el) && re.test((el.innerText || '').trim()));
      const h1 = leafHas(/^Chọn loại thẻ$/i);
      if (!h1) return [];
      const top = h1.getBoundingClientRect().bottom + window.scrollY;
      const h2 = leafHas(/^Chọn số tiền trả chậm/i);
      const bottom = h2 ? h2.getBoundingClientRect().top + window.scrollY : top + 400;
      const inRegion = [...document.querySelectorAll('img')].filter((im) => {
        const r = im.getBoundingClientRect(); const y = r.top + window.scrollY;
        return vis(im) && y >= top && y <= bottom;
      });
      const re = /visa|master|jcb|amex|american/i;
      const named = inRegion.filter((im) => re.test(`${im.alt || ''} ${im.currentSrc || im.src || ''}`));
      const imgs = named.length >= 2 ? named : inRegion;
      imgs.forEach((im, i) => {
        let tile = im;
        while (tile.parentElement && tile.parentElement !== document.body
          && imgs.filter((x) => tile.parentElement.contains(x)).length === 1) tile = tile.parentElement;
        tile.setAttribute('data-qa-cardtype', String(i));
      });
      return imgs.map((im) => (im.alt || (im.currentSrc || im.src || '').split('/').pop() || '').slice(0, 40));
    });

    // Ô nào đang được chọn: khác màu viền so với các ô còn lại, hoặc có input checked / aria-checked
    const tileState = (attr) => page.evaluate((attr) => {
      const tiles = [...document.querySelectorAll(`[${attr}]`)];
      const borders = tiles.map((t) => getComputedStyle(t).borderTopColor);
      const freq = {};
      borders.forEach((b) => { freq[b] = (freq[b] || 0) + 1; });
      const common = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
      const selected = [];
      tiles.forEach((t, i) => {
        const flag = !!t.querySelector('input:checked') || t.getAttribute('aria-checked') === 'true' || t.getAttribute('aria-selected') === 'true';
        const differs = Object.keys(freq).length > 1 && borders[i] !== common;
        if (flag || differs) selected.push(i);
      });
      return { total: tiles.length, selected };
    }, attr);

    // Gắn nhãn các ô gói trả chậm (mục 4): mỗi ô có dòng "x 3 tháng", "x 6 tháng"...
    const markPackages = () => page.evaluate(() => {
      document.querySelectorAll('[data-qa-pkgtile]').forEach((e) => e.removeAttribute('data-qa-pkgtile'));
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const leaves = [...document.querySelectorAll('*')]
        .filter((el) => el.children.length === 0 && vis(el) && /^x\s*\d+\s*tháng$/i.test((el.innerText || '').trim()));
      leaves.forEach((lf, i) => {
        let tile = lf;
        while (tile.parentElement && tile.parentElement !== document.body
          && leaves.filter((x) => tile.parentElement.contains(x)).length === 1) tile = tile.parentElement;
        tile.setAttribute('data-qa-pkgtile', String(i));
      });
      return leaves.map((l) => (l.innerText || '').trim());
    });

    /* ------------------------------------------------------------------
     * Step 1: chưa chọn ngân hàng, click [Thanh toán]
     * Expected 1: không chuyển sang cổng thanh toán, báo yêu cầu chọn ngân hàng
     * ------------------------------------------------------------------ */
    const r1 = await clickAndCollect();
    console.log('[INST_Card_04] Bước 1: nút bị khóa:', r1.disabled, '| báo trước khi bấm:', JSON.stringify(r1.errBefore), '| báo sau khi bấm:', JSON.stringify(r1.errors));
    await test.info().attach('buoc-1-chua-chon-ngan-hang', { body: await page.screenshot(), contentType: 'image/png' });
    checkBlocked(1, r1, 'ngân hàng', /(chọn|vui lòng).{0,30}ngân hàng|ngân hàng.{0,30}(chọn|bắt buộc)/i);

    /* ------------------------------------------------------------------
     * Step 2: chọn một ngân hàng (VPBank), chưa chọn loại thẻ, click [Thanh toán]
     * Expected 2: không chuyển sang cổng thanh toán, báo yêu cầu chọn loại thẻ
     * ------------------------------------------------------------------ */
    const bankFound = await page.evaluate(() => {
      document.querySelectorAll('[data-qa-bank-pick]').forEach((e) => e.removeAttribute('data-qa-bank-pick'));
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const img = [...document.querySelectorAll('img')].find((im) => visible(im) && im.getBoundingClientRect().width >= 40
        && /vp\s*-?\s*bank|\bvpb\b/i.test(`${im.alt || ''} ${im.currentSrc || im.src || ''}`));
      if (!img) return false;
      img.setAttribute('data-qa-bank-pick', '1');
      return true;
    });
    expect(bankFound, 'Phải có ngân hàng VPBank trong lưới "Chọn ngân hàng trả chậm"').toBe(true);
    const bankImg = page.locator('[data-qa-bank-pick]').first();
    await scrollCenter(bankImg);
    await page.waitForTimeout(300);
    await bankImg.click();
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await test.info().attach('da-chon-vpbank', { body: await page.screenshot(), contentType: 'image/png' });

    // Sau khi chọn ngân hàng: đã có loại thẻ nào được chọn sẵn chưa? (web có thể tự chọn VISA)
    const cardNames = await markCardTypes();
    expect(cardNames.length, `Sau khi chọn ngân hàng phải hiển thị các loại thẻ ở mục 2 (thấy: ${JSON.stringify(cardNames)})`).toBeGreaterThanOrEqual(2);
    const ct2 = await tileState('data-qa-cardtype');
    console.log('[INST_Card_04] Loại thẻ hiển thị:', JSON.stringify(cardNames), '| ô đã được chọn sẵn sau khi chọn ngân hàng:', JSON.stringify(ct2.selected));

    const r2 = await clickAndCollect();
    console.log('[INST_Card_04] Bước 2: nút bị khóa:', r2.disabled, '| báo trước khi bấm:', JSON.stringify(r2.errBefore), '| báo sau khi bấm:', JSON.stringify(r2.errors));
    await test.info().attach('buoc-2-chua-chon-loai-the', { body: await page.screenshot(), contentType: 'image/png' });
    checkBlocked(2, r2, 'loại thẻ', /(chọn|vui lòng).{0,30}(loại thẻ|thẻ)|(loại thẻ|thẻ).{0,30}(chọn|bắt buộc)/i,
      ct2.selected.length > 0
        ? 'web tự chọn sẵn một loại thẻ sau khi chọn ngân hàng nên không thực hiện được "chưa chọn loại thẻ"; xem ảnh buoc-2-chua-chon-loai-the.'
        : null);

    /* ------------------------------------------------------------------
     * Step 3: đã chọn ngân hàng + loại thẻ, chưa chọn gói trả chậm, click [Thanh toán]
     * Expected 3: không chuyển sang cổng thanh toán, báo yêu cầu chọn gói trả chậm
     * ------------------------------------------------------------------ */
    let ct3 = await tileState('data-qa-cardtype');
    if (ct3.selected.length === 0) {
      const firstCard = page.locator('[data-qa-cardtype="0"]').first();
      await scrollCenter(firstCard);
      await firstCard.click();
      await page.waitForTimeout(1000);
      ct3 = await tileState('data-qa-cardtype');
    }
    console.log('[INST_Card_04] Bước 3: loại thẻ đã chọn (chỉ số ô):', JSON.stringify(ct3.selected));
    expect.soft(ct3.selected.length, 'Bước 3: phải có 1 loại thẻ được chọn').toBe(1);

    // Gói trả chậm (mục 4) phải đang chưa chọn
    const pkgNames = await markPackages();
    const pk3 = await tileState('data-qa-pkgtile');
    console.log('[INST_Card_04] Bước 3: các gói trả chậm:', JSON.stringify(pkgNames), '| ô đã chọn:', JSON.stringify(pk3.selected));
    expect(pkgNames.length, `Sau khi chọn ngân hàng + loại thẻ phải hiển thị các gói trả chậm ở mục 4 (thấy: ${JSON.stringify(pkgNames)})`).toBeGreaterThanOrEqual(2);
    expect.soft(pk3.selected.length, 'Bước 3: pre-condition phải chưa chọn gói trả chậm').toBe(0);

    const r3 = await clickAndCollect();
    console.log('[INST_Card_04] Bước 3: nút bị khóa:', r3.disabled, '| báo trước khi bấm:', JSON.stringify(r3.errBefore), '| báo sau khi bấm:', JSON.stringify(r3.errors));
    await test.info().attach('buoc-3-chua-chon-goi-tra-cham', { body: await page.screenshot(), contentType: 'image/png' });
    checkBlocked(3, r3, 'gói trả chậm', /(chọn|vui lòng).{0,30}(gói|kỳ hạn|số tháng|thời hạn)|(gói|kỳ hạn|số tháng).{0,30}(chọn|bắt buộc)/i);

    // Dừng tại đây: không chọn gói, không bấm [Thanh toán] khi đã chọn đủ, không sang cổng thanh toán, không tạo giao dịch
  });

  // TC 22: Không thể thanh toán khi chưa đồng ý chính sách xử lý dữ liệu cá nhân
  test('INST_Card_04 - Không thể thanh toán khi chưa đồng ý chính sách xử lý dữ liệu cá nhân', async ({ page }) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  manual('NGUYÊN TẮC AN TOÀN: Chỉ kiểm tra khi CHƯA đồng ý chính sách. KHÔNG tích ô đồng ý, KHÔNG nhập OTP, KHÔNG thanh toán thật');

  const dialogs = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    await d.dismiss().catch(() => {});
  });

  const REMINDER = 'Vui lòng cung cấp thông tin nhận hàng';
  const scrollCenter = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const chooseAddress = () => chooseAddressFlow(page);

  const fillReceiver = async () => {
    const dialogTitle = page.getByText('Thông tin đặt hàng').first();
    const markOrderDialog = () => dialogTitle.evaluate((el) => {
      document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
      let p = el;
      for (let i = 0; p && i < 15; i++, p = p.parentElement) {
        const hasConfirm = [...p.querySelectorAll('button')]
          .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
        if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
      }
      return false;
    });
    const orderDialog = page.locator('[data-qa-order="1"]');
    const infoRow = page.getByText(REMINDER).first();

    if (!(await infoRow.isVisible({ timeout: 4000 }).catch(() => false))) {
      console.log('[INST_Card_05] Không còn dòng nhắc nhập thông tin nhận hàng -> bỏ qua bước nhập');
      return;
    }
    await infoRow.scrollIntoViewIfNeeded();
    if (!(await dialogTitle.isVisible({ timeout: 1500 }).catch(() => false))) {
      await infoRow.click();
      await page.waitForTimeout(1500);
    }
    await expect(dialogTitle, 'Hộp thoại nhập thông tin nhận hàng chưa mở').toBeVisible({ timeout: 5000 });
    expect(await markOrderDialog(), 'Không xác định được khung hộp thoại Thông tin đặt hàng').toBe(true);

    const nameInput = orderDialog.locator('input[placeholder*="Họ và tên" i], input[name*="name" i], [aria-label*="Họ và tên" i]').first();
    await expect(nameInput, 'Phải có ô Họ và tên').toBeVisible({ timeout: 5000 });
    await nameInput.fill(TEST_CUSTOMER.fullName);

    const phoneInput = orderDialog.locator('input[placeholder*="Số điện thoại" i], input[name*="phone" i], input[type="tel"], [aria-label*="Số điện thoại" i]').first();
    await expect(phoneInput, 'Phải có ô Số điện thoại').toBeVisible({ timeout: 5000 });
    await phoneInput.fill(TEST_CUSTOMER.phone);

    await expect(nameInput).toHaveValue(TEST_CUSTOMER.fullName);
    await expect(phoneInput).toHaveValue(TEST_CUSTOMER.phone);

    await chooseAddress();
    await page.waitForTimeout(1000);
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập địa chỉ').toBe(true);

    const confirmBtn = orderDialog.getByRole('button', { name: 'Xác nhận', exact: true }).last();
    await expect(confirmBtn, 'Nút [Xác nhận] phải bấm được').toBeEnabled({ timeout: 5000 });
    await confirmBtn.click({ timeout: 5000 });
    await expect(dialogTitle, 'Hộp thoại phải đóng sau khi xác nhận').toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await expect(page.getByText(REMINDER)).toHaveCount(0, { timeout: 10000 });
  };

  // ---- Pre-condition: /tra-cham của SP F ----
  await openProduct(page, 'F');

  let marked = false;
  for (let i = 0; i < 24 && !marked; i++) {
    marked = await page.evaluate(() => {
      document.querySelectorAll('[data-qa-inst-btn]').forEach((e) => e.removeAttribute('data-qa-inst-btn'));
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const label = (el) => norm(el.innerText) || norm(el.getAttribute('aria-label')) || norm(el.title);
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const btn = [...document.querySelectorAll('button, a, [role="button"]')]
        .find((el) => visible(el) && label(el).length <= 60 && /Trả chậm\s*0\s*%/i.test(label(el)));
      if (btn) btn.setAttribute('data-qa-inst-btn', '1');
      return !!btn;
    });
    if (!marked) { if (i === 8) await page.mouse.wheel(0, 700); await page.waitForTimeout(500); }
  }
  expect(marked, 'Pre-condition: SP F phải có nút [Trả chậm 0%]').toBe(true);

  const instBtn = page.locator('[data-qa-inst-btn]').first();
  await scrollCenter(instBtn);
  await page.waitForTimeout(300);
  await instBtn.click({ timeout: 10000 });

  await expect(page.getByText('Chọn hình thức trả chậm').filter({ visible: true }).first(),
    'Phải mở được hộp thoại "Chọn hình thức trả chậm"').toBeVisible({ timeout: 10000 });

  const cardOption = page.locator('a[href*="/tra-cham?"]').filter({ hasText: /Qua thẻ tín dụng/i })
    .or(page.getByText('Qua thẻ tín dụng')).filter({ visible: true }).first();
  await expect(cardOption, 'Phải có lựa chọn "Qua thẻ tín dụng"').toBeVisible({ timeout: 10000 });

  await Promise.all([
    page.waitForURL(/\/tra-cham(\?|$)/, { timeout: 20000 }),
    cardOption.click(),
  ]);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await page.waitForTimeout(1500);

  await expect(page, `Phải ở trang /tra-cham (đang ở ${page.url()})`).toHaveURL(/\/tra-cham(\?|$)/);
  await expect(page.getByText(/Giỏ Hàng Trả Chậm Thẻ Tín Dụng/i).first()).toBeVisible({ timeout: 15000 });

  const pathOnPage = new URL(page.url()).pathname;
  const pagesBefore = page.context().pages().length;

  await fillReceiver();

  const modalOpen = await page.locator('[id^="modal-"]').filter({ visible: true }).count();
  if (modalOpen > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  await test.info().attach('thong-tin-nhan-hang', { body: await page.screenshot(), contentType: 'image/png' });

  const markCardTypes = () => page.evaluate(() => {
    document.querySelectorAll('[data-qa-cardtype]').forEach((e) => e.removeAttribute('data-qa-cardtype'));
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const leafHas = (re) => [...document.querySelectorAll('*')].find((el) => el.children.length === 0 && vis(el) && re.test((el.innerText || '').trim()));
    const h1 = leafHas(/^Chọn loại thẻ$/i);
    if (!h1) return [];
    const top = h1.getBoundingClientRect().bottom + window.scrollY;
    const h2 = leafHas(/^Chọn số tiền trả chậm/i);
    const bottom = h2 ? h2.getBoundingClientRect().top + window.scrollY : top + 400;
    const inRegion = [...document.querySelectorAll('img')].filter((im) => {
      const r = im.getBoundingClientRect(); const y = r.top + window.scrollY;
      return vis(im) && y >= top && y <= bottom;
    });
    const re = /visa|master|jcb|amex|american/i;
    const named = inRegion.filter((im) => re.test(`${im.alt || ''} ${im.currentSrc || im.src || ''}`));
    const imgs = named.length >= 2 ? named : inRegion;
    imgs.forEach((im, i) => {
      let tile = im;
      while (tile.parentElement && tile.parentElement !== document.body
        && imgs.filter((x) => tile.parentElement.contains(x)).length === 1) tile = tile.parentElement;
      tile.setAttribute('data-qa-cardtype', String(i));
    });
    return imgs.map((im) => (im.alt || (im.currentSrc || im.src || '').split('/').pop() || '').slice(0, 40));
  });

  const tileState = (attr) => page.evaluate((attr) => {
    const tiles = [...document.querySelectorAll(`[${attr}]`)];
    const borders = tiles.map((t) => getComputedStyle(t).borderTopColor);
    const freq = {};
    borders.forEach((b) => { freq[b] = (freq[b] || 0) + 1; });
    const common = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
    const selected = [];
    tiles.forEach((t, i) => {
      const flag = !!t.querySelector('input:checked') || t.getAttribute('aria-checked') === 'true' || t.getAttribute('aria-selected') === 'true';
      const differs = Object.keys(freq).length > 1 && borders[i] !== common;
      if (flag || differs) selected.push(i);
    });
    return { total: tiles.length, selected };
  }, attr);

  const markPackages = () => page.evaluate(() => {
    document.querySelectorAll('[data-qa-pkgtile]').forEach((e) => e.removeAttribute('data-qa-pkgtile'));
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const leaves = [...document.querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && vis(el) && /^x\s*\d+\s*tháng$/i.test((el.innerText || '').trim()));
    leaves.forEach((lf, i) => {
      let tile = lf;
      while (tile.parentElement && tile.parentElement !== document.body
        && leaves.filter((x) => tile.parentElement.contains(x)).length === 1) tile = tile.parentElement;
      tile.setAttribute('data-qa-pkgtile', String(i));
    });
    return leaves.map((l) => (l.innerText || '').trim());
  });

  // Chọn VPBank
  const bank = await page.evaluate(() => {
    document.querySelectorAll('[data-qa-bank-pick]').forEach((e) => e.removeAttribute('data-qa-bank-pick'));
    const visible = (el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const img = [...document.querySelectorAll('img')].find((im) => visible(im) && im.getBoundingClientRect().width >= 40
      && /vp\s*-?\s*bank|\bvpb\b/i.test(`${im.alt || ''} ${im.currentSrc || im.src || ''}`));
    if (!img) return false;
    img.setAttribute('data-qa-bank-pick', '1');
    return true;
  });
  expect(bank, 'Phải có ngân hàng VPBank').toBe(true);

  const bankImg = page.locator('[data-qa-bank-pick]').first();
  await scrollCenter(bankImg);
  await page.waitForTimeout(300);
  await bankImg.click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  await test.info().attach('da-chon-vpbank', { body: await page.screenshot(), contentType: 'image/png' });

  // Chọn loại thẻ
  const cardNames = await markCardTypes();
  expect(cardNames.length, `Phải hiển thị loại thẻ (thấy: ${JSON.stringify(cardNames)})`).toBeGreaterThanOrEqual(2);

  let ct = await tileState('data-qa-cardtype');
  if (ct.selected.length === 0) {
    const firstCard = page.locator('[data-qa-cardtype="0"]').first();
    await scrollCenter(firstCard);
    await firstCard.click({ timeout: 8000 });
    await page.waitForTimeout(1000);
    ct = await tileState('data-qa-cardtype');
  }
  expect(ct.selected.length, 'Phải chọn được 1 loại thẻ').toBe(1);
  await test.info().attach('da-chon-loai-the', { body: await page.screenshot(), contentType: 'image/png' });

  // Chọn gói trả chậm
  let pkgNames = await markPackages();
  expect(pkgNames.length, `Phải hiển thị gói trả chậm (thấy: ${JSON.stringify(pkgNames)})`).toBeGreaterThanOrEqual(2);

  let pk = await tileState('data-qa-pkgtile');
  if (pk.selected.length === 0) {
    const firstPkg = page.locator('[data-qa-pkgtile="0"]').first();
    await scrollCenter(firstPkg);
    await firstPkg.click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    pkgNames = await markPackages();
    pk = await tileState('data-qa-pkgtile');
  }
  expect(pk.selected.length, 'Phải chọn được 1 gói trả chậm').toBe(1);
  await test.info().attach('da-chon-goi-tra-cham', { body: await page.screenshot(), contentType: 'image/png' });

  // Ô đồng ý chính sách – PHẢI để trống
  const markConsent = (reSrc, key) => page.evaluate(({ reSrc, key }) => {
    const re = new RegExp(reSrc, 'i');
    document.querySelectorAll(`[data-qa-consent="${key}"]`).forEach((e) => e.removeAttribute('data-qa-consent'));
    const leaf = [...document.querySelectorAll('*')]
      .filter((el) => el.children.length <= 3 && re.test(el.innerText || '') && (el.innerText || '').length < 400)
      .sort((a, b) => a.innerText.length - b.innerText.length)[0];
    if (!leaf) return false;
    let p = leaf;
    for (let i = 0; p && i < 8; i++, p = p.parentElement) {
      const boxes = p.querySelectorAll('input[type="checkbox"]');
      if (boxes.length === 1) { boxes[0].setAttribute('data-qa-consent', key); return true; }
      if (boxes.length > 1) return false;
    }
    return false;
  }, { reSrc, key });

  const policyFound = await markConsent('Chính sách xử lý dữ liệu cá nhân cho', 'policy');
  const consent = policyFound
    ? page.locator('[data-qa-consent="policy"]').first()
    : page.locator(L.CARD_CONSENT_CHECKBOX).first();

  // Ô CCCD (nếu có) – tích bình thường, không force
  if (await markConsent('cung cấp, chuyển giao số Căn cước', 'cccd')) {
    const consent2 = page.locator('[data-qa-consent="cccd"]').first();
    await consent2.scrollIntoViewIfNeeded();
    await consent2.check();
    await expect(consent2, 'Ô đồng ý cung cấp số căn cước phải được tích').toBeChecked();
  }

  await consent.scrollIntoViewIfNeeded();
  await expect(consent, 'Ô đồng ý Chính sách phải đang để trống').not.toBeChecked();

  const submit = page.getByRole('button', { name: 'Thanh toán', exact: true }).last();
  await submit.scrollIntoViewIfNeeded();
  await expect(submit, 'Phải có nút [Thanh toán]').toBeVisible();

  // ---- Đọc các thuộc tính màu ĐỎ trong vùng chính sách ----
  const readPolicyRed = () => page.evaluate(() => {
    const box = document.querySelector('[data-qa-consent="policy"]')
      || document.querySelector('input[type="checkbox"]');
    if (!box) return { found: false, red: [], colors: [] };

    let row = box.parentElement;
    for (let i = 0; row && i < 8; i++, row = row.parentElement) {
      if (/Chính sách xử lý dữ liệu cá nhân/i.test(row.innerText || '')) break;
    }
    if (!row) row = box.parentElement;

    // [SỬA] 1) Cho phép mở rộng lên tối đa 6 cấp cha, miễn là chưa chứa button
    //          và chưa quá dài -> bao được khung hồng chứa cả ô Chính sách lẫn ô CCCD
    for (let i = 0; i < 6 && row.parentElement; i++) {
      const p = row.parentElement;
      if (p.querySelector('button') || (p.innerText || '').length > 700) break;
      row = p;
    }
    document.querySelectorAll('[data-qa-policy-row]').forEach((e) => e.removeAttribute('data-qa-policy-row'));
    row.setAttribute('data-qa-policy-row', '1');

    const parse = (s) => {
      const m = (s || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
      return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
    };
    // [SỬA] 2) Nhận diện theo sắc đỏ (chấp nhận cả hồng nhạt như rgb(255,238,238))
    const isRed = (s) => {
      const c = parse(s);
      return !!c && c.a >= 0.3 && c.r >= 200
        && c.r - c.g >= 12 && c.r - c.b >= 12
        && Math.abs(c.g - c.b) <= 25;
    };

    const nodes = new Set([row, ...row.querySelectorAll('*')]);
    let up = box.parentElement;
    while (up && up !== row) { nodes.add(up); up = up.parentElement; }

    const red = [];
    const colors = [];
    nodes.forEach((el, idx) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return;
      const tag = `${el.tagName.toLowerCase()}${el.type ? '[' + el.type + ']' : ''}`;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.nodeValue || '').trim());
      const checks = [];
      if (hasText) checks.push(['color', cs.color]);
      ['Top', 'Right', 'Bottom', 'Left'].forEach((side) => {
        if (parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none') {
          checks.push([`border${side}`, cs[`border${side}Color`]]);
        }
      });
      if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) checks.push(['outline', cs.outlineColor]);
      checks.push(['background', cs.backgroundColor]);
      if (cs.boxShadow && cs.boxShadow !== 'none') checks.push(['boxShadow', cs.boxShadow]);
      if (el.tagName === 'INPUT') checks.push(['accentColor', cs.accentColor]);
      checks.forEach(([prop, val]) => {
        if (prop === 'boxShadow') {
          const found = (val.match(/rgba?\([^)]*\)/g) || []).some(isRed);
          if (found) red.push(`${tag}#${idx}.${prop}`);
        } else if (isRed(val)) {
          red.push(`${tag}#${idx}.${prop}`);
          colors.push(`${tag}.${prop}=${val}`);
        }
      });
    });
    return { found: true, red, colors };
  });

  const readErrors = () => page.evaluate(() => {
    const re = /(vui lòng|không được (để )?trống|chưa (nhập|chọn|đồng ý)|bắt buộc (nhập|chọn|đồng ý)|cần (nhập|chọn|đồng ý)|phải đồng ý|đồng ý.*chính sách|chính sách.*dữ liệu)/i;
    const out = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 180 || !re.test(t)) continue;
      const el = n.parentElement;
      if (!el) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (/^Tôi đồng ý/.test(t)) continue;
      out.add(t);
    }
    return [...out];
  });

  const hasOtpDialog = async () => {
    const textOtp = page.getByText(/mã\s*otp|nhập\s*mã\s*(otp|xác\s*thực)|xác\s*thực\s*(mã|otp)|mã\s*xác\s*(thực|nhận)/i).first();
    if (await textOtp.isVisible({ timeout: 600 }).catch(() => false)) return true;
    const modal = page.locator('[id^="modal-"], [role="dialog"], .modal, .popup, .ant-modal, .el-dialog')
      .filter({ hasText: /otp|xác\s*thực|mã\s*xác/i }).first();
    if (await modal.isVisible({ timeout: 600 }).catch(() => false)) return true;
    const otpInput = page.locator('input[placeholder*="OTP" i], input[placeholder*="mã xác" i], input[maxlength="6"], input[name*="otp" i]').first();
    if (await otpInput.isVisible({ timeout: 400 }).catch(() => false)) return true;
    return false;
  };

  const noProceed = async (label) => {
    const u = new URL(page.url());
    expect(u.hostname, `${label}: không được chuyển sang cổng thanh toán`).toMatch(/dienmayxanh\.com$/);
    expect(u.pathname, `${label}: phải ở lại trang /tra-cham`).toBe(pathOnPage);
    expect(page.context().pages().length, `${label}: không được mở tab cổng thanh toán mới`).toBe(pagesBefore);
    expect(await hasOtpDialog(), `${label}: không được hiện hộp thoại OTP khi chưa đồng ý chính sách`).toBe(false);
  };

  // ---- Trạng thái TRƯỚC khi bấm ----
  const before = await readPolicyRed();
  expect(before.found, 'Phải xác định được vùng chính sách xử lý dữ liệu cá nhân').toBe(true);
  console.log('[INST_Card_05] đỏ trước khi bấm:', JSON.stringify(before.red));
  await test.info().attach('chinh-sach-truoc-khi-bam', { body: await page.screenshot(), contentType: 'image/png' });

  // ---- Step 1: để trống ô chính sách, click [Thanh toán] ----
  const disabled = await submit.isDisabled().catch(() => false);
  if (!disabled) await submit.click({ timeout: 5000 });

  // Chờ vùng chính sách được tô đỏ (tối đa ~4s)
  let after = before;
  let newRed = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(400);
    after = await readPolicyRed();
    newRed = after.red.filter((k) => !before.red.includes(k));
    if (newRed.length > 0) break;
  }
  const errors = await readErrors();
  console.log('[INST_Card_05] nút bị khóa:', disabled,
    '| thuộc tính đỏ mới:', JSON.stringify(newRed),
    '| giá trị màu:', JSON.stringify(after.colors),
    '| text lỗi:', JSON.stringify(errors),
    '| dialog:', JSON.stringify(dialogs));

  const policyRow = page.locator('[data-qa-policy-row="1"]').first();
  await policyRow.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await test.info().attach('chua-dong-y-sau-khi-bam-thanh-toan', { body: await page.screenshot(), contentType: 'image/png' });
  await test.info().attach('vung-chinh-sach-sau-khi-bam', {
    body: await policyRow.screenshot().catch(async () => page.screenshot()),
    contentType: 'image/png',
  });

  // ---- Kết quả mong đợi ----
  // 1. Không được thanh toán: không chuyển cổng, không mở tab, không hiện OTP
  await noProceed('Khi chưa đồng ý chính sách');
  // Ô vẫn để trống
  await expect(consent, 'Ô đồng ý Chính sách vẫn phải để trống').not.toBeChecked();

  // 2. Vùng chính sách xử lý dữ liệu cá nhân được tô đỏ
  if (disabled) {
    manual('Nút [Thanh toán] bị khóa nên không thể click để kích hoạt tô đỏ. Xem ảnh chua-dong-y-sau-khi-bam-thanh-toan.');
  }
  expect(
    newRed.length,
    `Vùng chính sách xử lý dữ liệu cá nhân phải được tô đỏ sau khi bấm [Thanh toán] `
    + `(đỏ trước: ${JSON.stringify(before.red)}, đỏ sau: ${JSON.stringify(after.red)})`,
  ).toBeGreaterThan(0);
});

  // TC 23: Đến cổng thanh toán khi chọn đủ ngân hàng, loại thẻ và thông tin hợp lệ
 test('INST_Card_05 - Bấm thanh toán khi chọn đủ ngân hàng, loại thẻ và thông tin hợp lệ', async ({ page }) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  manual('NGUYÊN TẮC AN TOÀN: Chỉ kiểm tra có hiện hộp thoại yêu cầu nhập mã SMS/OTP. KHÔNG nhập mã, KHÔNG thanh toán thật');

  const dialogs = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    await d.dismiss().catch(() => {});
  });

  const REMINDER = 'Vui lòng cung cấp thông tin nhận hàng';
  const scrollCenter = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));

  const chooseAddress = () => chooseAddressFlow(page);

  const fillReceiver = async () => {
    const dialogTitle = page.getByText('Thông tin đặt hàng').first();
    const markOrderDialog = () => dialogTitle.evaluate((el) => {
      document.querySelectorAll('[data-qa-order]').forEach((e) => e.removeAttribute('data-qa-order'));
      let p = el;
      for (let i = 0; p && i < 15; i++, p = p.parentElement) {
        const hasConfirm = [...p.querySelectorAll('button')]
          .some((b) => (b.innerText || '').trim() === 'Xác nhận' && b.offsetParent !== null);
        if (hasConfirm) { p.setAttribute('data-qa-order', '1'); return true; }
      }
      return false;
    });
    const orderDialog = page.locator('[data-qa-order="1"]');
    const infoRow = page.getByText(REMINDER).first();

    if (!(await infoRow.isVisible({ timeout: 4000 }).catch(() => false))) {
      console.log('[INST_Card_06] Không còn dòng nhắc nhập thông tin nhận hàng -> bỏ qua bước nhập');
      return;
    }
    await infoRow.scrollIntoViewIfNeeded();
    if (!(await dialogTitle.isVisible({ timeout: 1500 }).catch(() => false))) {
      await infoRow.click();
      await page.waitForTimeout(1500);
    }
    await expect(dialogTitle, 'Hộp thoại nhập thông tin nhận hàng chưa mở').toBeVisible({ timeout: 5000 });
    expect(await markOrderDialog(), 'Không xác định được khung hộp thoại Thông tin đặt hàng').toBe(true);

    const nameInput = orderDialog.locator('input[placeholder*="Họ và tên" i], input[name*="name" i], [aria-label*="Họ và tên" i]').first();
    await expect(nameInput, 'Phải có ô Họ và tên').toBeVisible({ timeout: 5000 });
    await nameInput.fill(TEST_CUSTOMER.fullName);

    const phoneInput = orderDialog.locator('input[placeholder*="Số điện thoại" i], input[name*="phone" i], input[type="tel"], [aria-label*="Số điện thoại" i]').first();
    await expect(phoneInput, 'Phải có ô Số điện thoại').toBeVisible({ timeout: 5000 });
    await phoneInput.fill(TEST_CUSTOMER.phone);

    await expect(nameInput).toHaveValue(TEST_CUSTOMER.fullName);
    await expect(phoneInput).toHaveValue(TEST_CUSTOMER.phone);

    await chooseAddress();
    await page.waitForTimeout(1000);
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập địa chỉ').toBe(true);

    const confirmBtn = orderDialog.getByRole('button', { name: 'Xác nhận', exact: true }).last();
    await expect(confirmBtn, 'Nút [Xác nhận] phải bấm được').toBeEnabled({ timeout: 5000 });
    await confirmBtn.click({ timeout: 5000 });
    await expect(dialogTitle, 'Hộp thoại phải đóng sau khi xác nhận').toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await expect(page.getByText(REMINDER)).toHaveCount(0, { timeout: 10000 });
  };

  // ---- Pre-condition ----
  await openProduct(page, 'F');

  let marked = false;
  for (let i = 0; i < 24 && !marked; i++) {
    marked = await page.evaluate(() => {
      document.querySelectorAll('[data-qa-inst-btn]').forEach((e) => e.removeAttribute('data-qa-inst-btn'));
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const label = (el) => norm(el.innerText) || norm(el.getAttribute('aria-label')) || norm(el.title);
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const btn = [...document.querySelectorAll('button, a, [role="button"]')]
        .find((el) => visible(el) && label(el).length <= 60 && /Trả chậm\s*0\s*%/i.test(label(el)));
      if (btn) btn.setAttribute('data-qa-inst-btn', '1');
      return !!btn;
    });
    if (!marked) { if (i === 8) await page.mouse.wheel(0, 700); await page.waitForTimeout(500); }
  }
  expect(marked, 'Pre-condition: SP F phải có nút [Trả chậm 0%]').toBe(true);

  const instBtn = page.locator('[data-qa-inst-btn]').first();
  await scrollCenter(instBtn);
  await page.waitForTimeout(300);
  await instBtn.click({ timeout: 10000 });

  await expect(page.getByText('Chọn hình thức trả chậm').filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });

  const cardOption = page.locator('a[href*="/tra-cham?"]').filter({ hasText: /Qua thẻ tín dụng/i })
    .or(page.getByText('Qua thẻ tín dụng')).filter({ visible: true }).first();
  await expect(cardOption).toBeVisible({ timeout: 10000 });

  await Promise.all([
    page.waitForURL(/\/tra-cham(\?|$)/, { timeout: 20000 }),
    cardOption.click(),
  ]);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await page.waitForTimeout(1500);

  await expect(page).toHaveURL(/\/tra-cham(\?|$)/);
  await expect(page.getByText(/Giỏ Hàng Trả Chậm Thẻ Tín Dụng/i).first()).toBeVisible({ timeout: 15000 });

  await fillReceiver();

  const modalOpen = await page.locator('[id^="modal-"]').filter({ visible: true }).count();
  if (modalOpen > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  await test.info().attach('thong-tin-nhan-hang', { body: await page.screenshot(), contentType: 'image/png' });

  const markCardTypes = () => page.evaluate(() => {
    document.querySelectorAll('[data-qa-cardtype]').forEach((e) => e.removeAttribute('data-qa-cardtype'));
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const leafHas = (re) => [...document.querySelectorAll('*')].find((el) => el.children.length === 0 && vis(el) && re.test((el.innerText || '').trim()));
    const h1 = leafHas(/^Chọn loại thẻ$/i);
    if (!h1) return [];
    const top = h1.getBoundingClientRect().bottom + window.scrollY;
    const h2 = leafHas(/^Chọn số tiền trả chậm/i);
    const bottom = h2 ? h2.getBoundingClientRect().top + window.scrollY : top + 400;
    const inRegion = [...document.querySelectorAll('img')].filter((im) => {
      const r = im.getBoundingClientRect(); const y = r.top + window.scrollY;
      return vis(im) && y >= top && y <= bottom;
    });
    const re = /visa|master|jcb|amex|american/i;
    const named = inRegion.filter((im) => re.test(`${im.alt || ''} ${im.currentSrc || im.src || ''}`));
    const imgs = named.length >= 2 ? named : inRegion;
    imgs.forEach((im, i) => {
      let tile = im;
      while (tile.parentElement && tile.parentElement !== document.body
        && imgs.filter((x) => tile.parentElement.contains(x)).length === 1) tile = tile.parentElement;
      tile.setAttribute('data-qa-cardtype', String(i));
    });
    return imgs.map((im) => (im.alt || (im.currentSrc || im.src || '').split('/').pop() || '').slice(0, 40));
  });

  const tileState = (attr) => page.evaluate((attr) => {
    const tiles = [...document.querySelectorAll(`[${attr}]`)];
    const borders = tiles.map((t) => getComputedStyle(t).borderTopColor);
    const freq = {};
    borders.forEach((b) => { freq[b] = (freq[b] || 0) + 1; });
    const common = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
    const selected = [];
    tiles.forEach((t, i) => {
      const flag = !!t.querySelector('input:checked') || t.getAttribute('aria-checked') === 'true' || t.getAttribute('aria-selected') === 'true';
      const differs = Object.keys(freq).length > 1 && borders[i] !== common;
      if (flag || differs) selected.push(i);
    });
    return { total: tiles.length, selected };
  }, attr);

  const markPackages = () => page.evaluate(() => {
    document.querySelectorAll('[data-qa-pkgtile]').forEach((e) => e.removeAttribute('data-qa-pkgtile'));
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const leaves = [...document.querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && vis(el) && /^x\s*\d+\s*tháng$/i.test((el.innerText || '').trim()));
    leaves.forEach((lf, i) => {
      let tile = lf;
      while (tile.parentElement && tile.parentElement !== document.body
        && leaves.filter((x) => tile.parentElement.contains(x)).length === 1) tile = tile.parentElement;
      tile.setAttribute('data-qa-pkgtile', String(i));
    });
    return leaves.map((l) => (l.innerText || '').trim());
  });

  // Chọn VPBank
  const bank = await page.evaluate(() => {
    document.querySelectorAll('[data-qa-bank-pick]').forEach((e) => e.removeAttribute('data-qa-bank-pick'));
    const visible = (el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const img = [...document.querySelectorAll('img')].find((im) => visible(im) && im.getBoundingClientRect().width >= 40
      && /vp\s*-?\s*bank|\bvpb\b/i.test(`${im.alt || ''} ${im.currentSrc || im.src || ''}`));
    if (!img) return false;
    img.setAttribute('data-qa-bank-pick', '1');
    return true;
  });
  expect(bank, 'Phải có ngân hàng VPBank').toBe(true);

  const bankImg = page.locator('[data-qa-bank-pick]').first();
  await scrollCenter(bankImg);
  await page.waitForTimeout(300);
  await bankImg.click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  await test.info().attach('da-chon-vpbank', { body: await page.screenshot(), contentType: 'image/png' });

  // Chọn loại thẻ
  const cardNames = await markCardTypes();
  expect(cardNames.length).toBeGreaterThanOrEqual(2);

  let ct = await tileState('data-qa-cardtype');
  if (ct.selected.length === 0) {
    const firstCard = page.locator('[data-qa-cardtype="0"]').first();
    await scrollCenter(firstCard);
    await firstCard.click({ timeout: 8000 });
    await page.waitForTimeout(1000);
    ct = await tileState('data-qa-cardtype');
  }
  expect(ct.selected.length, 'Phải chọn được 1 loại thẻ').toBe(1);
  await test.info().attach('da-chon-loai-the', { body: await page.screenshot(), contentType: 'image/png' });

  // Chọn gói
  let pkgNames = await markPackages();
  expect(pkgNames.length).toBeGreaterThanOrEqual(2);

  let pk = await tileState('data-qa-pkgtile');
  if (pk.selected.length === 0) {
    const firstPkg = page.locator('[data-qa-pkgtile="0"]').first();
    await scrollCenter(firstPkg);
    await firstPkg.click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    pkgNames = await markPackages();
    pk = await tileState('data-qa-pkgtile');
  }
  expect(pk.selected.length, 'Phải chọn được 1 gói trả chậm').toBe(1);
  await test.info().attach('da-chon-goi-tra-cham', { body: await page.screenshot(), contentType: 'image/png' });

  // ---- Tích đồng ý chính sách ----
  const markConsent = (reSrc, key) => page.evaluate(({ reSrc, key }) => {
    const re = new RegExp(reSrc, 'i');
    document.querySelectorAll(`[data-qa-consent="${key}"]`).forEach((e) => e.removeAttribute('data-qa-consent'));
    const leaf = [...document.querySelectorAll('*')]
      .filter((el) => el.children.length <= 3 && re.test(el.innerText || '') && (el.innerText || '').length < 400)
      .sort((a, b) => a.innerText.length - b.innerText.length)[0];
    if (!leaf) return false;
    let p = leaf;
    for (let i = 0; p && i < 8; i++, p = p.parentElement) {
      const boxes = p.querySelectorAll('input[type="checkbox"]');
      if (boxes.length === 1) { boxes[0].setAttribute('data-qa-consent', key); return true; }
      if (boxes.length > 1) return false;
    }
    return false;
  }, { reSrc, key });

  const tickConsent = async () => {
    const found = await markConsent('Chính sách xử lý dữ liệu cá nhân cho', 'policy');
    const cb = found
      ? page.locator('[data-qa-consent="policy"]').first()
      : page.locator(L.CARD_CONSENT_CHECKBOX).first();

    await cb.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);

    // Cách 1: check() bình thường (không force)
    try {
      await cb.check({ timeout: 3000 });
    } catch {
      // Cách 2: click vào dòng chữ (đúng hành vi user, không force)
      const label = page.getByText(/Tôi đồng ý với.*Chính sách xử lý dữ liệu cá nhân/i).first();
      await expect(label, 'Phải thấy dòng chữ đồng ý chính sách').toBeVisible({ timeout: 5000 });
      await label.scrollIntoViewIfNeeded();
      await label.click({ timeout: 5000 });
    }

    // Bắt buộc phải checked – nếu không được thì TC fail
    await expect(cb, 'Ô đồng ý chính sách phải được tích thành công sau khi thao tác').toBeChecked({ timeout: 5000 });
  };

  // Ô CCCD (nếu có)
  if (await markConsent('cung cấp, chuyển giao số Căn cước', 'cccd')) {
    const consent2 = page.locator('[data-qa-consent="cccd"]').first();
    await consent2.scrollIntoViewIfNeeded();
    await consent2.check();
    await expect(consent2, 'Ô đồng ý cung cấp số căn cước phải được tích').toBeChecked();
  }

  await tickConsent();
  await test.info().attach('da-tich-dong-y-chinh-sach', { body: await page.screenshot(), contentType: 'image/png' });

  // ---- Click Thanh toán ----
  const submit = page.getByRole('button', { name: 'Thanh toán', exact: true }).last();
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click({ timeout: 5000 });

  // ---- Kiểm tra hiện OTP/SMS ----
  const hasOtpDialog = async () => {
    const textOtp = page.getByText(/mã\s*otp|nhập\s*mã\s*(otp|xác\s*thực|sms)|xác\s*thực\s*(mã|otp)|mã\s*xác\s*(thực|nhận)|mã\s*sms/i).first();
    if (await textOtp.isVisible({ timeout: 800 }).catch(() => false)) return true;

    const modal = page.locator('[id^="modal-"], [role="dialog"], .modal, .popup, .ant-modal, .el-dialog')
      .filter({ hasText: /otp|xác\s*thực|mã\s*xác|sms/i }).first();
    if (await modal.isVisible({ timeout: 800 }).catch(() => false)) return true;

    const otpInput = page.locator(
      'input[placeholder*="OTP" i], input[placeholder*="mã xác" i], input[placeholder*="mã sms" i], input[maxlength="6"], input[name*="otp" i]'
    ).first();
    if (await otpInput.isVisible({ timeout: 600 }).catch(() => false)) return true;

    return false;
  };

  let otpAppeared = false;
  for (let i = 0; i < 20 && !otpAppeared; i++) {
    await page.waitForTimeout(500);
    otpAppeared = await hasOtpDialog();
  }

  console.log('[INST_Card_06] OTP/SMS dialog:', otpAppeared, '| URL:', page.url());
  await test.info().attach('sau-khi-bam-thanh-toan', { body: await page.screenshot(), contentType: 'image/png' });

  expect(
    otpAppeared,
    `Đã chọn đủ + tích đồng ý thì phải hiện yêu cầu nhập mã SMS/OTP. Đang ở ${page.url()}`
  ).toBe(true);

  // Không nhập OTP, không thanh toán
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  const closeBtn = page.getByRole('button', { name: /đóng|hủy|cancel|close/i }).first();
  if (await closeBtn.isVisible({ timeout: 800 }).catch(() => false)) {
    await closeBtn.click().catch(() => {});
  }
});
  


  /* --------------------------------------------------------------------------
   * PHẦN 5: RÀNG BUỘC NGHIỆP VỤ & GIAO DIỆN (INST_Rule & INST_GUI)
   * -------------------------------------------------------------------------- */

  // TC 24: Kiểm tra giao diện trả chậm trên di động
 test('INST_GUI_01 - Giao diện trả chậm hiển thị đúng trên di động', async ({ page }) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  manual('TC GUI mobile: kiểm tra layout 1 cột, chữ đọc được, nút đủ lớn, không bị che. Không thanh toán. Không dùng force click / JS click để ép pass.');

  // ---- Pre-condition: viewport mobile 375x812 ----
  await page.setViewportSize({ width: 375, height: 812 });

  // Helper: kiểm tra element hiển thị và có kích thước hợp lý
  const isReadableAndVisible = async (locator, label) => {
    const el = locator.first();
    await expect(el, `${label} phải hiển thị`).toBeVisible({ timeout: 8000 });
    const box = await el.boundingBox();
    expect(box, `${label} phải có kích thước`).not.toBeNull();
    expect(box.width, `${label} không được quá hẹp (width=${box.width})`).toBeGreaterThan(40);
    expect(box.height, `${label} không được quá thấp (height=${box.height})`).toBeGreaterThan(12);
    return box;
  };

  // Helper: kiểm tra nút đủ lớn để bấm (touch target)
  const isTappable = async (locator, label, minSize = 40) => {
    const box = await isReadableAndVisible(locator, label);
    expect(
      Math.min(box.width, box.height),
      `${label} phải đủ lớn để bấm (min cạnh = ${Math.min(box.width, box.height).toFixed(0)}px, yêu cầu ≥ ${minSize}px)`
    ).toBeGreaterThanOrEqual(minSize);
    return box;
  };

  // Helper: kiểm tra không bị overflow ngang nghiêm trọng
  const checkNoHorizontalOverflow = async (contextLabel) => {
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
      };
    });
    const maxAllowed = overflow.clientWidth + 8;
    expect(
      overflow.scrollWidth,
      `${contextLabel}: trang bị tràn ngang (scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth})`
    ).toBeLessThanOrEqual(maxAllowed);
  };

  // Helper: kiểm tra element có nằm trong viewport không
  const isInViewport = async (locator) => {
    return locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      return r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw && r.width > 0 && r.height > 0;
    });
  };

  // ---- Pre-condition: mở SP F ----
  await openProduct(page, 'F');

  // Tìm nút [Trả chậm 0%]
  let marked = false;
  for (let i = 0; i < 24 && !marked; i++) {
    marked = await page.evaluate(() => {
      document.querySelectorAll('[data-qa-inst-btn]').forEach((e) => e.removeAttribute('data-qa-inst-btn'));
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const label = (el) => norm(el.innerText) || norm(el.getAttribute('aria-label')) || norm(el.title);
      const visible = (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const btn = [...document.querySelectorAll('button, a, [role="button"]')]
        .find((el) => visible(el) && label(el).length <= 60 && /Trả chậm\s*0\s*%/i.test(label(el)));
      if (btn) btn.setAttribute('data-qa-inst-btn', '1');
      return !!btn;
    });
    if (!marked) {
      if (i === 8) await page.mouse.wheel(0, 600);
      await page.waitForTimeout(400);
    }
  }
  expect(marked, 'Pre-condition: SP F phải có nút [Trả chậm 0%]').toBe(true);

  const instBtn = page.locator('[data-qa-inst-btn]').first();

  // ---- Cuộn đưa nút vào giữa viewport (không force) ----
  // Thử tối đa vài lần cuộn thật, giống user vuốt
  for (let attempt = 0; attempt < 5; attempt++) {
    await instBtn.evaluate((el) => {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    await page.waitForTimeout(350);

    if (await isInViewport(instBtn)) break;

    // Vuốt thêm một đoạn rồi thử lại
    await page.mouse.wheel(0, 280);
    await page.waitForTimeout(300);
  }

  // Nếu sau khi cuộn vẫn không vào viewport → coi là lỗi GUI trên kích thước này → để fail
  const finallyInView = await isInViewport(instBtn);
  expect(
    finallyInView,
    'Nút [Trả chậm 0%] không nằm trong viewport sau khi cuộn trên màn 375x812 → không thể tương tác bình thường (GUI mobile có vấn đề hoặc bị che)'
  ).toBe(true);

  // Click bình thường (không force, không evaluate click)
  await instBtn.click({ timeout: 10000 });

  // ---- Bước 1: Mở hộp thoại chọn hình thức trả chậm ----
  const dialogTitle = page.getByText('Chọn hình thức trả chậm').filter({ visible: true }).first();
  await expect(dialogTitle, 'Hộp thoại "Chọn hình thức trả chậm" phải mở').toBeVisible({ timeout: 10000 });
  await test.info().attach('hop-thoai-chon-hinh-thuc', { body: await page.screenshot(), contentType: 'image/png' });

  await checkNoHorizontalOverflow('Hộp thoại chọn hình thức');
  await isReadableAndVisible(dialogTitle, 'Tiêu đề hộp thoại');

  // Chọn vào trang trả chậm (ưu tiên BNPL nếu có)
  const bnplOption = page.locator('a[href*="/tra-cham-bnpl"], a[href*="bnpl"]')
    .filter({ hasText: /công ty tài chính|bnpl|trả chậm/i })
    .or(page.getByText(/Qua công ty tài chính|Công ty tài chính/i))
    .filter({ visible: true })
    .first();

  const targetOption = (await bnplOption.isVisible({ timeout: 3000 }).catch(() => false))
    ? bnplOption
    : page.locator('a[href*="/tra-cham"]').filter({ visible: true }).first();

  await expect(targetOption, 'Phải có lựa chọn dẫn tới trang trả chậm').toBeVisible({ timeout: 8000 });

  // Đảm bảo option nằm trong viewport trước khi click
  await targetOption.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  expect(
    await isInViewport(targetOption),
    'Lựa chọn hình thức trả chậm không nằm trong viewport trên màn 375x812'
  ).toBe(true);

  await targetOption.click({ timeout: 10000 });

  await page.waitForURL(/\/tra-cham|bnpl/i, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  await test.info().attach('trang-tra-cham-mobile', { body: await page.screenshot(), contentType: 'image/png' });

  // ---- Kiểm tra layout trang 1 cột, không vỡ ----
  await checkNoHorizontalOverflow('Trang /tra-cham (portrait)');

  const pageTitle = page.getByText(/Giỏ Hàng Trả Chậm|Trả chậm|Chọn.*trả chậm/i).first();
  await isReadableAndVisible(pageTitle, 'Tiêu đề trang trả chậm');

  // ---- Bước 2: Cuộn trang, quan sát khối chọn đối tác + chi tiết thanh toán ----
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(600);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(600);

  await test.info().attach('sau-khi-cuon-doi-tac', { body: await page.screenshot(), contentType: 'image/png' });

  // Logo / ảnh đối tác
  const partnerImgs = page.locator('img').filter({ visible: true });
  const partnerCount = await partnerImgs.count();
  expect(partnerCount, 'Phải có logo/ảnh đối tác hiển thị').toBeGreaterThanOrEqual(1);

  let checkedLogos = 0;
  for (let i = 0; i < Math.min(partnerCount, 6); i++) {
    const img = partnerImgs.nth(i);
    const box = await img.boundingBox().catch(() => null);
    if (!box || box.width < 30 || box.height < 20) continue;

    expect(box.x, `Logo #${i} không được nằm ngoài bên trái`).toBeGreaterThanOrEqual(-5);
    expect(box.x + box.width, `Logo #${i} không được tràn quá bên phải`).toBeLessThanOrEqual(375 + 10);
    checkedLogos++;
  }
  expect(checkedLogos, 'Phải kiểm tra được ít nhất 1 logo đối tác hợp lệ').toBeGreaterThanOrEqual(1);

  // Nút hành động chính
  const actionBtn = page.getByRole('button', { name: /Thêm vào giỏ|Mua ngay|Thanh toán/i }).first()
    .or(page.locator('button, a').filter({ hasText: /Thêm vào giỏ|Mua ngay|Thanh toán/i }).first());

  if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await actionBtn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);

    expect(
      await isInViewport(actionBtn),
      'Nút [Thêm vào giỏ]/[Mua ngay]/[Thanh toán] không nằm trong viewport trên màn 375x812'
    ).toBe(true);

    await isTappable(actionBtn, 'Nút hành động chính (Thêm vào giỏ / Mua ngay / Thanh toán)', 40);
  } else {
    const continueBtn = page.getByRole('button', { name: /Tiếp tục|Xác nhận|Chọn/i }).first();
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      expect(
        await isInViewport(continueBtn),
        'Nút tiếp tục / xác nhận không nằm trong viewport trên màn 375x812'
      ).toBe(true);
      await isTappable(continueBtn, 'Nút tiếp tục / xác nhận', 40);
    } else {
      // Không thấy nút → fail rõ, không bỏ qua
      expect(
        false,
        'Không tìm thấy nút [Thêm vào giỏ] / [Mua ngay] / [Thanh toán] / [Tiếp tục] trên viewport 375x812'
      ).toBe(true);
    }
  }

  // Kiểm tra font chữ không quá nhỏ
  const textSamples = await page.evaluate(() => {
    const texts = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n && texts.length < 30; n = walker.nextNode()) {
      const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (t.length < 8 || t.length > 80) continue;
      const el = n.parentElement;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width <= 0 || r.height <= 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      const fontSize = parseFloat(cs.fontSize) || 0;
      texts.push({ t: t.slice(0, 40), fontSize });
    }
    return texts;
  });

  const tooSmall = textSamples.filter((s) => s.fontSize > 0 && s.fontSize < 11);
  expect(
    tooSmall.length,
    `Có quá nhiều chữ quá nhỏ (<11px): ${JSON.stringify(tooSmall.slice(0, 3))}`
  ).toBeLessThan(5);

  await checkNoHorizontalOverflow('Sau khi cuộn khối đối tác (portrait)');

  // ---- Bước 3: Xoay ngang màn hình (landscape) ----
  await page.setViewportSize({ width: 812, height: 375 });
  await page.waitForTimeout(1000);
  await test.info().attach('xoay-ngang-landscape', { body: await page.screenshot(), contentType: 'image/png' });

  await checkNoHorizontalOverflow('Trang sau khi xoay ngang (landscape)');

  const titleAfterRotate = page.getByText(/Giỏ Hàng Trả Chậm|Trả chậm|Chọn.*trả chậm|hình thức/i).first();
  if (await titleAfterRotate.isVisible({ timeout: 4000 }).catch(() => false)) {
    await isReadableAndVisible(titleAfterRotate, 'Tiêu đề sau khi xoay ngang');
  }

  const actionBtnLandscape = page.getByRole('button', { name: /Thêm vào giỏ|Mua ngay|Thanh toán|Tiếp tục|Xác nhận/i }).first();
  if (await actionBtnLandscape.isVisible({ timeout: 3000 }).catch(() => false)) {
    await actionBtnLandscape.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
    await page.waitForTimeout(300);

    const inViewLand = await isInViewport(actionBtnLandscape);
    expect(
      inViewLand,
      'Nút hành động ở landscape không nằm trong viewport sau khi cuộn'
    ).toBe(true);

    const box = await actionBtnLandscape.boundingBox();
    if (box) {
      expect(
        Math.min(box.width, box.height),
        `Nút hành động ở landscape phải đủ lớn (min=${Math.min(box.width, box.height).toFixed(0)}px)`
      ).toBeGreaterThanOrEqual(36);
    }
  }

  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(500);
  await checkNoHorizontalOverflow('Sau khi cuộn ở landscape');

  await test.info().attach('landscape-sau-cuon', { body: await page.screenshot(), contentType: 'image/png' });

  // Trả về portrait
  await page.setViewportSize({ width: 375, height: 812 });
});

});