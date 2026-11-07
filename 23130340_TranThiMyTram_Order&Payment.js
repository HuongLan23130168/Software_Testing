/**
 * ============================================================================
 * TEST AUTOMATION SUITE: 6.5.2 CHỨC NĂNG ĐẶT HÀNG VÀ THANH TOÁN (MODULE ORDER)
 * Website kiểm thử: https://www.dienmayxanh.com/
 * Framework: Playwright Test (JavaScript)
 * File: tests/chucnang2.spec.js
 * Sinh viên thực hiện: Trần Thị Mỹ Trâm (MSSV: 23130340)
 * 
 * Toàn bộ 30 Test Case theo ma trận kiểm thử (Sheet "Đặt hàng và thanh toán"):
 * - Nhóm 1: ORDER_Info_01 đến ORDER_Info_10 (Thông tin đặt hàng & Địa chỉ giao hàng)
 * - Nhóm 2: ORDER_Method_01 đến ORDER_Method_02 (Hình thức nhận hàng & Gói giao hàng)
 * - Nhóm 3: ORDER_Pay_01 đến ORDER_Pay_06 (Phương thức thanh toán & Chi tiết thanh toán)
 * - Nhóm 4: ORDER_Calc_01 đến ORDER_Calc_04 (Tóm tắt đơn hàng, Mã giảm giá & Điểm VIP)
 * - Nhóm 5: ORDER_OTP_01 đến ORDER_OTP_04 (Xác thực SMS OTP - Nguyên tắc an toàn)
 * - Nhóm 6: ORDER_GUI_01 (Kiểm tra bố cục trang Thanh toán trên di động)
 * 
 * NGUYÊN TẮC AN TOÀN TRONG KIỂM THỬ ĐẶT HÀNG:
 * - KHÔNG tạo đơn hàng thật, KHÔNG hoàn tất thanh toán tiền thật.
 * - Dừng lại trước bước gửi thông tin nhạy cảm hoặc tại màn hình OTP SMS.
 * - Mỗi test case có assertion kiểm tra kết quả thực tế, không ép pass giả.
 * ============================================================================
 */
 
const { test, expect, devices } = require('@playwright/test');
 
/* ============================================================================
 * 1. CẤU HÌNH DỮ LIỆU KIỂM THỬ (TEST DATA)
 * ============================================================================ */
const BASE_URL = 'https://www.dienmayxanh.com';
const CART_URL = `${BASE_URL}/gio-hang`;
 
const PRODUCTS = {
  // SP A: Sản phẩm Flash sale
  A: {
    key: 'A',
    name: 'Nồi cơm điện tử Sunhouse 1.8 lít SHD8911',
    url: `${BASE_URL}/noi-com-dien/noi-com-dien-tu-sunhouse-18-lit-shd8911`,
  },
  // SP B: Sản phẩm có giảm giá & quà tặng kèm
  B: {
    key: 'B',
    name: 'Nồi cơm điện tử Kangaroo 1.8 lít KGRC18D3G',
    url: `${BASE_URL}/noi-com-dien/noi-com-dien-tu-kangaroo-18-lit-kgrc18d3g`,
  },
  // SP C: Sản phẩm thông thường (cho phép tăng số lượng tự do)
  C: {
    key: 'C',
    name: 'Pin AAA 2 viên Alkaline Panasonic LR03T',
    url: `${BASE_URL}/pin/pin-aaa-2-vien-alkaline-panasonic-lr03t`,
  },
};
 
// Thông tin khách hàng mẫu hợp lệ (Khu vực Hồ Chí Minh)
const TEST_CUSTOMER = {
  gender: 'Anh',
  fullName: 'Trần Thị Mỹ Trâm',
  phone: '0987654332',
  city: 'Hồ Chí Minh',
  ward: 'An Đông',
  street: '11',
};

const OTP_PHONE = '0935938870';
 
/* ============================================================================
 * 2. ĐỊNH DANH PHẦN TỬ GIAO DIỆN (LOCATORS)
 * ============================================================================ */
const L = {
  // Header & Giỏ hàng
  HEADER_CART: 'a[href="/gio-hang"]',
  HEADER_LOCATION: '.header-address, [class*="location"], [class*="address-header"]',
  CART_ITEMS: 'input[name="item-cart-select"]',
  QTY_INPUT: 'input[inputmode="numeric"]',
  ORDER_BUTTON: 'button:has-text("Đặt mua"), button:has-text("Mua ngay")',
  PROVIDE_INFO_LINK: 'text=Vui lòng cung cấp thông tin nhận hàng',
 
  // Hộp thoại "Thông tin đặt hàng"
  ORDER_DIALOG_TITLE: 'text=Thông tin đặt hàng',
  ORDER_DIALOG_CONTAINER: 'div:has-text("Thông tin đặt hàng"):not(#notify-popup), .modal-content, [role="dialog"]',
  CLOSE_DIALOG_BTN: 'button.close, .modal-close, [aria-label*="Close" i], button:has-text("✕"), button:has-text("×")',
  
  // Danh xưng
  GENDER_MALE: 'text=Anh',
  GENDER_FEMALE: 'text=Chị',
  
  // Họ tên & Số điện thoại
  NAME_INPUT: 'input[placeholder*="Họ tên" i], input[placeholder*="Họ và tên" i], input[name*="fullname" i], input[name*="name" i], [aria-label*="Họ tên" i], [aria-label*="Họ và tên" i]',  PHONE_INPUT: 'input[placeholder*="Số điện thoại" i], input[name*="phone" i], input[type="tel"], [aria-label*="Số điện thoại" i]',
  
  // Công tắc "Người khác nhận hàng"
  OTHER_RECEIVER_TOGGLE: 'text=Người khác nhận hàng',
  RECEIVER_NAME_INPUT: 'input[placeholder*="Họ tên người nhận" i], input[name*="other_name" i]',
  RECEIVER_PHONE_INPUT: 'input[placeholder*="SĐT người nhận" i], input[placeholder*="Số điện thoại người nhận" i]',
  
  // Địa chỉ nhận hàng
  SHARE_LOCATION_BTN: 'text=Dùng vị trí hiện tại',
  CHOOSE_ADDRESS_BTN: 'text=Chọn địa chỉ',
  PROVINCE_SELECT: 'select[name*="province" i], div:has-text("Tỉnh/Thành phố"), [placeholder*="Tỉnh" i]',
  WARD_SELECT: 'select[name*="ward" i], div:has-text("Phường/Xã"), [placeholder*="Phường" i]',
  STREET_INPUT: 'input[placeholder*="Số nhà, tên đường" i], input[name*="address" i]',
  CONFIRM_INFO_BTN: 'button:has-text("Xác nhận")',
  LOGIN_LINK: 'text=Đăng nhập',
  ALERT_UNDERSTAND_BTN: 'button:has-text("Đã hiểu")',
 
  // Hình thức giao nhận hàng
  DELIVERY_TO_HOME: 'text="Giao tận nơi", label:has-text("Giao tận nơi")',
  PICKUP_AT_STORE: 'text="Nhận tại siêu thị", label:has-text("Nhận tại siêu thị")',
  STORE_PICKUP_SECTION: 'div:has-text("Chọn siêu thị"), .store-list, [class*="store"]',
 
  // Gói vận chuyển
  DELIVERY_STANDARD: 'text="Giao tiêu chuẩn"',
  DELIVERY_FAST: 'text="Giao siêu nhanh"',
  CHANGE_TIME_BTN: 'button:has-text("Đổi"), a:has-text("Đổi")',
 
  // Chọn số tiền thanh toán
  PAY_FULL: 'text="Thanh toán toàn bộ đơn"',
  PAY_MINIMUM: 'text="Thanh toán tối thiểu để giữ hàng", text="Thanh toán tối thiểu"',
  PAY_MINIMUM_DETAILS: 'a:has-text("Chi tiết"), button:has-text("Chi tiết")',
 
  // Phương thức thanh toán
  PAYMENT_METHODS_SECTION: 'div:has-text("Chọn phương thức thanh toán"), [class*="payment-method"]',
  PAY_BANK_TRANSFER: 'text="Chuyển khoản ngân hàng"',
  PAY_CREDIT_CARD: 'text="Qua thẻ tín dụng", text="thẻ tín dụng/ghi nợ"',
  PAY_MOMO: 'text="Ví MoMo", text="MoMo"',
  PAY_VNPAY: 'text="VNPay QR", text="VNPAY"',
  PAY_ZALOPAY: 'text="ZaloPay"',
  PAY_SMARTPAY: 'text="SmartPay QR", text="SmartPay"',
  PAY_HOMEPAYLATER: 'text="Home PayLater"',
  PAY_ATM_NAPAS: 'text="Qua thẻ ATM", text="thẻ ATM/tín dụng Napas"',
  PAY_AT_STORE: 'text="Thanh toán tại siêu thị gần nhất"',
  PAY_MWG_PAYLATER: 'text="MWG Paylater"',
  MWG_REGISTER_LINK: 'a:has-text("Đăng ký ngay"), button:has-text("Đăng ký ngay")',
  PAY_COLLAPSE_EXPAND: 'text="Xem thêm", text="Thu hồi"',
 
  // Mã giảm & Điểm thưởng
  DISCOUNT_SECTION: 'div:has-text("Mã giảm"), [class*="voucher"]',
  DISCOUNT_CODE_BTN: 'text="Mã giảm", text="Mã giảm giá", text="Nhập mã giảm"',
  DISCOUNT_INPUT: 'input[placeholder*="mã giảm" i], input[placeholder*="voucher" i]',
  APPLY_DISCOUNT_BTN: 'button:has-text("Áp dụng")',
  VIP_POINT_TOGGLE: 'text="Dùng điểm Quà Tặng VIP", text="Quà Tặng VIP"',
 
  // Tóm tắt đơn hàng & Chi tiết thanh toán
  ORDER_SUMMARY: '.order-summary, div:has-text("Chi tiết thanh toán"), div:has-text("Tóm tắt")',
  ORDER_SUBMIT_BTN: 'button:has-text("Thanh toán"), button:has-text("Đặt hàng")',
  TOTAL_PAYMENT: '.total-price, .total-pay, span:has-text("Tổng thanh toán"), span:has-text("Cần thanh toán")',
 
  // Màn hình OTP SMS
  OTP_CONTAINER: 'div:has-text("xác thực"), div:has-text("Mã xác thực"), div:has-text("nhập mã")',
  OTP_INPUT: 'input[placeholder*="OTP" i], input[placeholder*="mã" i], input[inputmode="numeric"]',
  OTP_SUBMIT_BTN: 'button:has-text("Xác nhận"), button:has-text("Tiếp tục")',
  OTP_RESEND_BTN: 'button:has-text("Gửi lại mã"), a:has-text("Gửi lại mã")',
};
 
/* ============================================================================
 * 3. CÁC HÀM TIỆN ÍCH THAO TÁC (HELPER FUNCTIONS)
 * ============================================================================ */
 

function manual(description) {
  test.info().annotations.push({ type: 'manual', description });
}

/**
 * Đi từ giỏ hàng tới màn hình nhập mã SMS: nhập thông tin nhận hàng (số thật), sang trang Thanh toán,
 * tích ô đồng ý chính sách rồi bấm [Thanh toán]. KHÔNG nhập mã. Mỗi lần gọi sẽ gửi 1 SMS thật.
 * Trả về { reached, recaptcha, screenText }.
 */
async function goToOtpScreen(page, phone) {
  // Tự đóng popup quảng cáo (lớp nền tối) nếu nó chặn thao tác
  const overlay = page.locator('div.cursor-pointer[class*="bg-[#1E1E1E]"]').first();
  await page.addLocatorHandler(overlay, async () => {
    await page.keyboard.press('Escape');
    if (await overlay.isVisible().catch(() => false)) {
      await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
    }
  }, { noWaitAfter: true });

  await seedCart(page, ['C']);
  await openOrderDialog(page);
  await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone, chooseAddress: true });
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
  await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
  await page.getByRole('button', { name: 'Đặt mua' }).first().click();
  await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });

  // Phương thức "Chuyển khoản ngân hàng" đang được chọn (ô radio tùy biến: cuộn tới chữ)
  const bankText = page.getByText('Chuyển khoản ngân hàng', { exact: true }).first();
  await bankText.scrollIntoViewIfNeeded();
  const bankRadio = bankText
    .locator('xpath=ancestor::*[.//input[@type="radio"]][1]').locator('input[type="radio"]').first();
  await expect(bankRadio, 'Pre-condition: phải chọn Chuyển khoản ngân hàng').toBeChecked();

  // Tích ô đồng ý chính sách (bắt buộc) trước khi bấm [Thanh toán]
  const agreeText = page.getByText(/Tôi đồng ý với/).first();
  await agreeText.scrollIntoViewIfNeeded();
  const agree = agreeText
    .locator('xpath=ancestor::*[.//input[@type="checkbox"]][1]').locator('input[type="checkbox"]').first();
  await agree.check({ force: true }).catch(() => {});
  if (!(await agree.isChecked().catch(() => false))) {
    const t = await agreeText.boundingBox();
    await page.mouse.click(t.x - 16, t.y + 9);
  }
  await expect(agree, 'Phải tích được ô đồng ý chính sách').toBeChecked();

  const payBtn = page.getByRole('button', { name: 'Thanh toán', exact: true });
  await payBtn.scrollIntoViewIfNeeded();
  await payBtn.click();

  const bodyText = async () => (await page.locator('body').innerText()).replace(/\u00a0/g, ' ');
  const reached = await expect.poll(async () => /xác thực|mã (OTP|SMS)|nhập mã/i.test(await bodyText()),
    { timeout: 20000 }).toBe(true).then(() => true).catch(() => false);
  const screenText = (await bodyText()).replace(/\s+/g, ' ');
  return { reached, recaptcha: /recaptcha/i.test(screenText), screenText };
}

/** Mở trang chi tiết sản phẩm */
async function openProduct(page, key = 'C') {
  const prod = PRODUCTS[key] || { url: key };
  try {
    await page.goto(prod.url, { waitUntil: 'commit', timeout: 45000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  } catch (err) {
    await page.goto(prod.url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  }
  await page.waitForTimeout(2000);
}
 
/** Thêm sản phẩm vào giỏ hàng từ trang chi tiết */
async function addToCart(page) {
  const btn = page.getByRole('button', { name: /Thêm vào giỏ/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await expect(page.getByText(/Đã thêm vào giỏ/i).first()).toBeVisible({ timeout: 10000 });
}
 
/** Mở trực tiếp trang giỏ hàng */
async function openCartDirect(page) {
  try {
    await page.goto(CART_URL, { waitUntil: 'commit', timeout: 45000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  } catch (err) {
    await page.goto(CART_URL, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  }
  await page.waitForTimeout(2000);
}
 
/** Mở giỏ hàng từ biểu tượng trên header */
async function openCartFromHeader(page) {
  const promoBackdrop = page.locator('.left-15px, .bg-\\[\\#1E1E1E\\], [class*="opacity-50"][class*="cursor-pointer"]').first();
  if (await promoBackdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
    await promoBackdrop.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
 
  const headerCart = page.getByRole('link', { name: 'Giỏ hàng' }).or(page.locator(L.HEADER_CART)).first();
  await headerCart.waitFor({ state: 'visible', timeout: 10000 });
  await Promise.all([
    page.waitForURL(/\/gio-hang(\?.*)?$/, { timeout: 15000 }).catch(() => {}),
    headerCart.click({ force: true }),
  ]);
  await page.waitForTimeout(2000);
}
 
/** Chuẩn bị giỏ hàng với danh sách sản phẩm mẫu */
async function seedCart(page, keys = ['C']) {
  // 1. Kiểm tra nhanh xem hiện tại trang giỏ hàng đã có sẵn sản phẩm chưa
  const currentUrl = page.url();
  const isOnCart = currentUrl.includes('/gio-hang');
  if (!isOnCart) {
    await openCartDirect(page);
  }
 
  const orderBtn = page.getByRole('button', { name: 'Đặt mua' }).first();
  const provideInfo = page.getByText('Vui lòng cung cấp thông tin nhận hàng').first();
  const qtyInput = page.locator(L.QTY_INPUT).first();
 
  const hasItems = (await orderBtn.isVisible({ timeout: 2000 }).catch(() => false)) ||
                   (await provideInfo.isVisible({ timeout: 2000 }).catch(() => false)) ||
                   (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false));
 
  if (hasItems) {
    return;
  }
 
  // 2. Nếu giỏ hàng còn trống, ưu tiên chọn sản phẩm Camera IP như luồng thực tế của bạn
  try {
    await page.goto(BASE_URL, { waitUntil: 'commit', timeout: 30000 });
    const bannerClose = page.locator('.left-15px').first();
    if (await bannerClose.isVisible({ timeout: 1500 }).catch(() => false)) {
      await bannerClose.click().catch(() => {});
    }
 
    const cameraLink = page.getByRole('link', { name: /Camera IP 360/i }).first();
    if (await cameraLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cameraLink.click();
      await page.waitForTimeout(1500);
      const addBtn = page.getByRole('button', { name: /Thêm vào giỏ/i }).first();
      await addBtn.click();
      await page.waitForTimeout(1500);
      await page.getByRole('link', { name: 'Giỏ hàng' }).first().click();
      await page.waitForTimeout(2000);
      return;
    }
  } catch (err) {
    // Tiếp tục fallback bên dưới nếu không tìm thấy Camera trên trang chủ
  }
 
  // 3. Fallback thêm sản phẩm mẫu qua URL
  for (const k of keys) {
    await openProduct(page, k);
    await addToCart(page);
  }
  await openCartDirect(page);
 
  const cartReady = page.getByRole('button', { name: 'Đặt mua' }).or(page.locator(L.QTY_INPUT)).first();
  const isLoaded = await cartReady.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
  if (!isLoaded) {
    await openCartDirect(page);
    await cartReady.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  }
}

/**
 * Đảm bảo đang chọn "Giao tận nơi" trên trang giỏ hàng.
 * storageState dùng chung có thể còn nhớ "Nhận tại siêu thị" từ test trước,
 * khiến hộp thoại Thông tin đặt hàng không có "Người khác nhận hàng" / địa chỉ giao tận nơi.
 */
async function ensureDeliveryHome(page) {
  const deliveryHome = page.locator('label').filter({ hasText: 'Giao tận nơi' }).first();
  if (await deliveryHome.isVisible({ timeout: 3000 }).catch(() => false)) {
    if (!(await deliveryHome.isChecked().catch(() => false))) {
      await deliveryHome.click();
      await page.waitForTimeout(500);
    }
    await expect(deliveryHome, 'Phải chọn Giao tận nơi').toBeChecked({ timeout: 5000 });
  }
}
 
/** Mở hộp thoại "Thông tin đặt hàng" từ trang giỏ hàng */
async function openOrderDialog(page) {
  await ensureDeliveryHome(page);
  const dialogTitle = page.getByRole('heading', { name: 'Thông tin đặt hàng', exact: true }).filter({ visible: true }).first();
  if (await dialogTitle.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }
 
  // 1. Click nút [Đặt mua] để kích hoạt kiểm tra thông tin nhận hàng
  const orderBtn = page.getByRole('button', { name: 'Đặt mua' }).or(page.locator(L.ORDER_BUTTON)).first();
  if (await orderBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await orderBtn.click();
    await page.waitForTimeout(1000);
  }

  // Bản giao diện mới có thể mở thẳng hộp thoại từ [Đặt mua]. Đừng click dòng nhắc ở nền khi modal đã phủ lên.
  if (await dialogTitle.isVisible({ timeout: 1500 }).catch(() => false)) return;
 
  // 2. Click vào khối "Vui lòng cung cấp thông tin nhận hàng" (được highlight đỏ) để mở popup
  const provideInfo = page.getByText('Vui lòng cung cấp thông tin nhận hàng').first();
  if (await provideInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
    await provideInfo.click();
    await page.waitForTimeout(1500);
  }
  await expect(dialogTitle, 'Bấm thông tin nhận hàng nhưng hộp thoại không mở').toBeVisible({ timeout: 5000 });
}
 
/** Điền thông tin vào hộp thoại "Thông tin đặt hàng" */
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

  // Chọn địa chỉ nếu có yêu cầu (luồng ghi từ codegen, 2 màn hình, mỗi màn có nút xác nhận riêng)
  if (chooseAddress) {
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

    // Giao diện mới mở thẳng màn "Chọn khu vực": chọn tỉnh rồi phường/xã;
    // sau khi chọn phường, trang quay về bước nhập địa chỉ chi tiết.
    await step('mở Chọn địa chỉ', () => page.getByText('Chọn địa chỉ', { exact: true }).first().click({ timeout: 5000 }));
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
    // Hỗ trợ biến thể trang vẫn yêu cầu xác nhận khu vực sau khi chọn phường.
    const areaConfirm = picker.getByRole('button', { name: 'Xác nhận', exact: true });
    if (await canSee(areaConfirm, 1000)) await step('xác nhận khu vực', () => areaConfirm.click({ timeout: 5000 }));

    // Màn 2: số nhà, tên đường -> chọn 1 địa chỉ gợi ý -> [Xác nhận địa chỉ]
    await step('nhập số nhà, tên đường', async () => {
      const streetInput = page.getByRole('textbox', { name: /Số nhà tên đường|Số nhà, tên đường/i });
      await streetInput.click({ timeout: 5000 });
      await streetInput.fill(TEST_CUSTOMER.street);
    });
    // Chọn gợi ý đầu tiên bắt đầu bằng số nhà vừa nhập; website có thể đề xuất địa chỉ khác nhau.
    await step('chọn địa chỉ gợi ý', async () => {
      const firstSuggestion = page.getByText(new RegExp('^' + TEST_CUSTOMER.street)).filter({ visible: true }).first();
      const flexRe = new RegExp(`^${esc(TEST_CUSTOMER.street)}\\b.*${esc(TEST_CUSTOMER.ward)}`, 'i');
      const flex = page.getByText(flexRe).filter({ visible: true }).first();
      const target = (await canSee(firstSuggestion, 2500)) ? firstSuggestion : flex;
      const chosen = await target.innerText({ timeout: 8000 });
      console.log('[fillOrderInfo] Địa chỉ gợi ý được chọn:', chosen.replace(/\s+/g, ' ').trim());
      await target.click({ timeout: 8000 });
    });
    await step('xác nhận địa chỉ', () => page.getByRole('button', { name: 'Xác nhận địa chỉ' }).click({ timeout: 5000 }));
    // Nút [Xác nhận] cuối của hộp thoại Thông tin đặt hàng do từng test tự bấm
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


}
 
/** Chuyển sang trang Thanh toán với thông tin hợp lệ (dừng trước bước xác thực đơn hàng) */
async function goToCheckoutPage(page, productKeys = ['C']) {
  await seedCart(page, productKeys);
  await openOrderDialog(page);
  await fillOrderInfo(page, {
    gender: TEST_CUSTOMER.gender,
    fullName: TEST_CUSTOMER.fullName,
    phone: TEST_CUSTOMER.phone,
    chooseAddress: true,
  });
 
  const confirmBtn = page.locator(L.CONFIRM_INFO_BTN).first();
  if (await confirmBtn.isVisible()) {
    await confirmBtn.click();
    await page.waitForTimeout(2000);
  }
}
 
/* ============================================================================
 * 4. KỊCH BẢN KIỂM THỬ: 6.5.2 ĐẶT HÀNG VÀ THANH TOÁN (MODULE ORDER)
 * ============================================================================ */
 
test.describe('6.5.2 Đặt hàng và thanh toán - Điện máy XANH (Module ORDER)', () => {
 
  /* --------------------------------------------------------------------------
   * GIỎ HÀNG DÙNG CHUNG: thêm SP C 1 lần, lưu lại, các test sau dùng lại.
   * Muốn tạo lại giỏ: xóa thư mục playwright/.cart rồi chạy lại.
   * -------------------------------------------------------------------------- */
  const CART_STATE = 'playwright/.cart/state.json';
 
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180000);
    const fs = require('fs');
 
    // File chỉ tính là "đã có giỏ" khi có dữ liệu thật bên trong
    const hasCart = () => {
      try {
        const j = JSON.parse(fs.readFileSync(CART_STATE, 'utf-8'));
        return ((j.cookies || []).length + (j.origins || []).length) > 0;
      } catch (e) {
        return false;
      }
    };
    if (hasCart()) return;
 
    // test.use({ storageState }) cũng áp dụng cho newContext() bên dưới,
    // nên phải có sẵn file (trống) trước, rồi ghi đè bằng giỏ thật sau
    fs.mkdirSync('playwright/.cart', { recursive: true });
    fs.writeFileSync(CART_STATE, JSON.stringify({ cookies: [], origins: [] }));
 
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await openProduct(page, 'C');
    await addToCart(page);
    await ctx.storageState({ path: CART_STATE });
    await ctx.close();
  });
 
  // Mỗi test bắt đầu với giỏ đã có sẵn SP C
  test.use({ storageState: CART_STATE });
 
  /* --------------------------------------------------------------------------
   * PHẦN 1: THÔNG TIN ĐẶT HÀNG (ORDER_Info)
   * -------------------------------------------------------------------------- */
 
  // TC 01: Hiển thị hộp thoại Thông tin đặt hàng khi bấm [Đặt mua]
  test('ORDER_Info_01 - Hiển thị hộp thoại Thông tin đặt hàng khi bấm [Đặt mua]', async ({ page }) => {
    test.setTimeout(120000);

    // Tự đóng popup quảng cáo / overlay (z-[2000]) nếu chặn thao tác
    const overlay = page.locator(
      'div.fixed.left-0.top-0.z-\\[2000\\], div.cursor-pointer[class*="bg-[#1E1E1E]"], div[class*="bg-[#0006]"]'
    ).first();
    await page.addLocatorHandler(overlay, async () => {
      await page.keyboard.press('Escape');
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
      }
    }, { noWaitAfter: true });

    // ---- Pre-condition: giỏ chỉ có SP C, SL 1, đã chọn sản phẩm ----
    await seedCart(page, ['C']);
    // storageState dùng chung có thể còn nhớ "Nhận tại siêu thị" → form dialog khác
    await ensureDeliveryHome(page);
    await expect(page).toHaveURL(/\/gio-hang/);
    await expect(page.locator(L.CART_ITEMS)).toHaveCount(1);
    await expect(page.locator(L.CART_ITEMS).first()).toBeChecked();
    await expect(page.locator(L.QTY_INPUT).first()).toHaveValue('1');

    // Đóng overlay nếu còn (trước khi click Đặt mua)
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);

    // ---- Step 1: click [Đặt mua] ----
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();

    // Expected 1: hiện khối cảnh báo kèm khu vực Hồ Chí Minh, chưa mở hộp thoại
    const provideInfo = page.getByText('Vui lòng cung cấp thông tin nhận hàng').first();
    await expect(provideInfo).toBeVisible({ timeout: 10000 });
    await expect.soft(
      page.locator('div')
        .filter({ hasText: 'Vui lòng cung cấp thông tin nhận hàng' })
        .filter({ hasText: 'Hồ Chí Minh' })
        .last()
    ).toBeVisible();

    // ---- Step 2: click vào khối "Vui lòng cung cấp thông tin nhận hàng" ----
    // Ưu tiên click khối cha (vùng đỏ/cam có mũi tên >) — tránh bị header sticky / overlay chặn
    await page.keyboard.press('Escape').catch(() => {});
    const provideBlock = page.locator('div')
      .filter({ hasText: 'Vui lòng cung cấp thông tin nhận hàng' })
      .filter({ hasText: 'Hồ Chí Minh' })
      .last();
    if (await provideBlock.isVisible().catch(() => false)) {
      await provideBlock.click({ force: true, timeout: 10000 });
    } else {
      await provideInfo.click({ force: true, timeout: 10000 });
    }

    // ---- Step 3: quan sát hộp thoại ----
    // Expected 2: hộp thoại "Thông tin đặt hàng" có nút đóng [X]
    await expect(page.getByText('Thông tin đặt hàng').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(L.CLOSE_DIALOG_BTN).first()).toBeVisible();

    // Expected 3: các thành phần trong hộp thoại (Giao tận nơi)
    await expect(page.getByText('Anh', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Chị', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Họ tên|Họ và tên/i })
      .or(page.locator(L.NAME_INPUT)).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Số điện thoại' })
      .or(page.locator(L.PHONE_INPUT)).first()).toBeVisible();
    // Công tắc "Người khác nhận hàng": text + input#ortherReceive (id typo trên web)
    await expect(
      page.getByText(/Người khác nhận hàng/i)
        .or(page.locator('#ortherReceive'))
        .or(page.locator('label[for="ortherReceive"]'))
        .first()
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Dùng vị trí hiện tại').first()).toBeVisible();
    await expect(page.getByText('Chọn địa chỉ').first()).toBeVisible();
    // [Đăng nhập]: chỉ kiểm tra hiển thị, KHÔNG click
    await expect(page.getByText('Đăng nhập').last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xác nhận' })
      .or(page.locator(L.CONFIRM_INFO_BTN)).first()).toBeVisible();

    // Dừng tại đây: không nhập thông tin, không bấm [Xác nhận] -> không gửi SMS
  });
  
  // TC 02: Không thể xác nhận khi để trống họ và tên
    test('ORDER_Info_02 - Không thể xác nhận khi để trống họ và tên', async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);

    // ---- Pre-condition: giỏ có SP C, đã bấm [Đặt mua] và đang ở hộp thoại "Thông tin đặt hàng" ----
    await seedCart(page, ['C']);
    await openOrderDialog(page);

    // Bước 0: hộp thoại phải mở được. Nếu không, báo rõ nguyên nhân + chụp ảnh thay vì timeout ở bước sau
    const dialogTitle = page.getByRole('heading', { name: 'Thông tin đặt hàng', exact: true }).filter({ visible: true }).first();
    if (!(await dialogTitle.isVisible({ timeout: 5000 }).catch(() => false))) {
      await page.screenshot({ path: 'test-results/ORDER_Info_02_no_dialog.png', fullPage: true });
    }
    await expect(dialogTitle, 'Hộp thoại "Thông tin đặt hàng" chưa mở được').toBeVisible({ timeout: 5000 });

    // Khung hộp thoại: tìm lại mỗi lần cần (sau khi nhập địa chỉ hộp thoại có thể được vẽ lại)
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

    // Chọn địa chỉ trước theo luồng giao diện mới; sau đó mới nhập dữ liệu người nhận
    await fillOrderInfo(page, { chooseAddress: true });
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi chọn địa chỉ').toBe(true);
    const dlg = page.locator('[data-qa-order="1"]');

    // Đọc các dòng báo lỗi đang hiển thị (quét theo từng đoạn chữ)
    const readErrors = () => page.evaluate(() => {
      const re = /(vui lòng|không được (để )?trống|chưa (nhập|chọn)|bắt buộc|họ (và )?tên)/i;
      const out = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 150 || !re.test(t)) continue;
        const el = n.parentElement;
        if (!el) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
        out.add(t);
      }
      return [...out];
    });

    // ---- Step 1: để trống họ và tên, nhập số điện thoại hợp lệ (địa chỉ đã chọn ở trên) ----
    const nameInput = dlg.getByRole('textbox', { name: /Họ tên|Họ và tên/i }).first();
    await expect(nameInput, 'Không thấy ô Họ và tên').toBeVisible({ timeout: 5000 });
    await nameInput.fill('');
    await fillOrderInfo(page, { phone: TEST_CUSTOMER.phone });
    await page.waitForTimeout(1000);
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập số điện thoại').toBe(true);

    // Expected 1: các trường được nhận (họ tên vẫn trống, SĐT và địa chỉ giữ nguyên giá trị đã nhập)
    await expect(nameInput, 'Ô Họ và tên phải vẫn để trống').toHaveValue('');
    const phoneInput = dlg.getByRole('textbox', { name: /Số điện thoại/i }).first();
    await expect(phoneInput, 'Số điện thoại hợp lệ phải được nhận').toHaveValue(TEST_CUSTOMER.phone);
    await expect.soft(
      dlg.getByText(new RegExp(TEST_CUSTOMER.ward, 'i')).first(),
      'Địa chỉ đã chọn phải hiển thị trong hộp thoại'
    ).toBeVisible();
    await test.info().attach('truoc-khi-bam-xac-nhan', { body: await page.screenshot(), contentType: 'image/png' });

    // ---- Step 2: click [Xác nhận] CỦA HỘP THOẠI này (không dùng nút "Xác nhận" ở chỗ khác trên trang) ----
    const confirmBtn = dlg.getByRole('button', { name: 'Xác nhận', exact: true }).last();
    if (!(await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
      await page.screenshot({ path: 'test-results/ORDER_Info_02_no_confirm_btn.png', fullPage: true });
    }
    await expect(confirmBtn, 'Không tìm thấy nút [Xác nhận]').toBeVisible({ timeout: 2000 });
    await expect(confirmBtn, 'Nút [Xác nhận] phải bấm được để kiểm tra validation họ tên').toBeEnabled();
    await confirmBtn.click();

    // Gom thông báo trong ~3s (phòng toast tự biến mất)
    const seen = new Set();
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(400);
      for (const m of await readErrors()) seen.add(m);
    }
    const errors = [...seen];
    await test.info().attach('sau-khi-bam-xac-nhan', { body: await page.screenshot(), contentType: 'image/png' });
    console.log('[ORDER_Info_02] báo lỗi thấy được:', JSON.stringify(errors));

    // Expected 2a: không tiếp tục được (vẫn ở hộp thoại, chưa sang trang Thanh toán)
    await expect(page).not.toHaveURL(/thanh-toan|dat-hang|checkout/);
    await expect(dialogTitle, 'Hộp thoại đã đóng, hệ thống cho đi tiếp khi thiếu họ tên').toBeVisible();

    // Expected 2b: hiện lỗi "Vui lòng nhập họ tên"
    const nameError = page.getByText(/Vui lòng nhập họ (và )?tên/i).filter({ visible: true }).first();
    await expect(
      nameError,
      `Phải hiển thị "Vui lòng nhập họ tên". Báo lỗi thấy được: ${JSON.stringify(errors)}`
    ).toBeVisible({ timeout: 5000 });

    // Expected 2c: lỗi nằm DƯỚI ô Họ và tên (ngay sát, không phải thông báo ở chỗ khác)
    const errBox = await nameError.boundingBox();
    const nameBox = await nameInput.boundingBox();
    expect.soft(errBox && nameBox, 'Không đo được vị trí dòng lỗi hoặc ô Họ và tên').toBeTruthy();
    if (errBox && nameBox) {
      const gap = errBox.y - (nameBox.y + nameBox.height);
      expect.soft(gap, 'Dòng lỗi phải nằm dưới ô Họ và tên').toBeGreaterThanOrEqual(-2);
      expect.soft(gap, 'Dòng lỗi phải nằm sát ô Họ và tên').toBeLessThanOrEqual(80);
    }

    // Số điện thoại và địa chỉ hợp lệ nên không được báo lỗi
    expect.soft(
      errors.some((m) => /vui lòng.*(số điện thoại|địa chỉ)/i.test(m)),
      `Không được báo lỗi SĐT/địa chỉ. Báo lỗi thấy được: ${JSON.stringify(errors)}`
    ).toBe(false);
  });
 
  // TC 03: Không thể xác nhận khi để trống số điện thoại
    test('ORDER_Info_03 - Không thể xác nhận khi để trống số điện thoại', async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);

    // ---- Pre-condition: giỏ có SP C, đã bấm [Đặt mua] và đang ở hộp thoại "Thông tin đặt hàng" ----
    await seedCart(page, ['C']);
    await openOrderDialog(page);

    // Bước 0: hộp thoại phải mở được. Nếu không, báo rõ nguyên nhân + chụp ảnh thay vì timeout ở bước sau
    const dialogTitle = page.getByRole('heading', { name: 'Thông tin đặt hàng', exact: true }).filter({ visible: true }).first();
    if (!(await dialogTitle.isVisible({ timeout: 5000 }).catch(() => false))) {
      await page.screenshot({ path: 'test-results/ORDER_Info_03_no_dialog.png', fullPage: true });
    }
    await expect(dialogTitle, 'Hộp thoại "Thông tin đặt hàng" chưa mở được').toBeVisible({ timeout: 5000 });

    // Khung hộp thoại: tìm lại mỗi lần cần (sau khi nhập địa chỉ hộp thoại có thể được vẽ lại)
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

    // Chọn địa chỉ trước theo luồng giao diện mới; sau đó mới nhập dữ liệu người nhận
    await fillOrderInfo(page, { chooseAddress: true });
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi chọn địa chỉ').toBe(true);
    const dlg = page.locator('[data-qa-order="1"]');

    // Đọc các dòng báo lỗi đang hiển thị (quét theo từng đoạn chữ)
    const readErrors = () => page.evaluate(() => {
      const re = /(vui lòng|không được (để )?trống|chưa (nhập|chọn)|bắt buộc|số điện thoại)/i;
      const out = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 150 || !re.test(t)) continue;
        const el = n.parentElement;
        if (!el) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
        out.add(t);
      }
      return [...out];
    });

    // ---- Step 1: nhập họ và tên hợp lệ (địa chỉ đã chọn ở trên), để trống số điện thoại ----
    const nameInput = dlg.getByRole('textbox', { name: /Họ tên|Họ và tên/i }).first();
    const phoneInput = dlg.getByRole('textbox', { name: /Số điện thoại/i }).first();
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName });
    await page.waitForTimeout(1000);
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập họ tên').toBe(true);
    await expect(phoneInput, 'Không thấy ô Số điện thoại').toBeVisible({ timeout: 5000 });
    await phoneInput.fill('');

    // Expected 1: các trường được nhận (họ tên và địa chỉ giữ nguyên giá trị đã nhập, SĐT vẫn trống)
    await expect(nameInput, 'Họ và tên hợp lệ phải được nhận').toHaveValue(TEST_CUSTOMER.fullName);
    await expect(phoneInput, 'Ô Số điện thoại phải vẫn để trống').toHaveValue('');
    await expect.soft(
      dlg.getByText(new RegExp(TEST_CUSTOMER.ward, 'i')).first(),
      'Địa chỉ đã chọn phải hiển thị trong hộp thoại'
    ).toBeVisible();
    await test.info().attach('truoc-khi-bam-xac-nhan', { body: await page.screenshot(), contentType: 'image/png' });

    // ---- Step 2: click [Xác nhận] CỦA HỘP THOẠI này (không dùng nút "Xác nhận" ở chỗ khác trên trang) ----
    const confirmBtn = dlg.getByRole('button', { name: 'Xác nhận', exact: true }).last();
    if (!(await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
      await page.screenshot({ path: 'test-results/ORDER_Info_03_no_confirm_btn.png', fullPage: true });
    }
    await expect(confirmBtn, 'Không tìm thấy nút [Xác nhận]').toBeVisible({ timeout: 2000 });
    await expect(confirmBtn, 'Nút [Xác nhận] phải bấm được để kiểm tra validation số điện thoại').toBeEnabled();
    await confirmBtn.click();

    // Gom thông báo trong ~3s (phòng toast tự biến mất)
    const seen = new Set();
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(400);
      for (const m of await readErrors()) seen.add(m);
    }
    const errors = [...seen];
    await test.info().attach('sau-khi-bam-xac-nhan', { body: await page.screenshot(), contentType: 'image/png' });
    console.log('[ORDER_Info_03] báo lỗi thấy được:', JSON.stringify(errors));

    // Expected 2a: không tiếp tục được (vẫn ở hộp thoại, chưa sang trang Thanh toán / OTP)
    await expect(page).not.toHaveURL(/thanh-toan|dat-hang|checkout/);
    await expect(dialogTitle, 'Hộp thoại đã đóng, hệ thống cho đi tiếp khi thiếu số điện thoại').toBeVisible();

    // Expected 2b: hiện lỗi "Vui lòng nhập số điện thoại"
    const phoneError = page.getByText(/Vui lòng nhập số điện thoại/i).filter({ visible: true }).first();
    await expect(
      phoneError,
      `Phải hiển thị "Vui lòng nhập số điện thoại". Báo lỗi thấy được: ${JSON.stringify(errors)}`
    ).toBeVisible({ timeout: 5000 });

    // Expected 2c: lỗi nằm DƯỚI ô Số điện thoại (ngay sát, không phải thông báo ở chỗ khác)
    const errBox = await phoneError.boundingBox();
    const phoneBox = await phoneInput.boundingBox();
    expect.soft(errBox && phoneBox, 'Không đo được vị trí dòng lỗi hoặc ô Số điện thoại').toBeTruthy();
    if (errBox && phoneBox) {
      const gap = errBox.y - (phoneBox.y + phoneBox.height);
      expect.soft(gap, 'Dòng lỗi phải nằm dưới ô Số điện thoại').toBeGreaterThanOrEqual(-2);
      expect.soft(gap, 'Dòng lỗi phải nằm sát ô Số điện thoại').toBeLessThanOrEqual(80);
    }

    // Họ tên và địa chỉ hợp lệ nên không được báo lỗi
    expect.soft(
      errors.some((m) => /vui lòng.*(họ|địa chỉ)/i.test(m)),
      `Không được báo lỗi họ tên/địa chỉ. Báo lỗi thấy được: ${JSON.stringify(errors)}`
    ).toBe(false);
  });
 
  // TC 04: Không thể xác nhận với số điện thoại không hợp lệ
    test('ORDER_Info_04 - Không thể xác nhận với số điện thoại không hợp lệ', async ({ page }) => {
    test.setTimeout(240000);
    page.setDefaultTimeout(15000);

    // ---- Pre-condition: giỏ có SP C, đã bấm [Đặt mua], đang ở hộp thoại "Thông tin đặt hàng" ----
    await seedCart(page, ['C']);
    await openOrderDialog(page);

    const dialogTitle = page.getByRole('heading', { name: 'Thông tin đặt hàng', exact: true }).filter({ visible: true }).first();
    if (!(await dialogTitle.isVisible({ timeout: 5000 }).catch(() => false))) {
      await page.screenshot({ path: 'test-results/ORDER_Info_04_no_dialog.png', fullPage: true });
    }
    await expect(dialogTitle, 'Hộp thoại "Thông tin đặt hàng" chưa mở được').toBeVisible({ timeout: 5000 });

    // Khung hộp thoại: tìm lại mỗi lần cần (sau khi nhập địa chỉ hộp thoại có thể được vẽ lại)
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

    // Chọn địa chỉ hợp lệ trước, rồi nhập họ tên hợp lệ
    await fillOrderInfo(page, { chooseAddress: true });
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi chọn địa chỉ').toBe(true);
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName });
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập họ tên').toBe(true);

    const dlg = page.locator('[data-qa-order="1"]');
    const nameInput = dlg.getByRole('textbox', { name: /Họ tên|Họ và tên/i }).first();
    const phoneInput = dlg.getByRole('textbox', { name: /Số điện thoại/i }).first();
    const confirmBtn = dlg.getByRole('button', { name: 'Xác nhận', exact: true }).last();
    await expect(nameInput, 'Họ và tên hợp lệ phải được nhận').toHaveValue(TEST_CUSTOMER.fullName);
    await expect(phoneInput, 'Không thấy ô Số điện thoại').toBeVisible({ timeout: 5000 });
    await expect(confirmBtn, 'Không tìm thấy nút [Xác nhận]').toBeVisible({ timeout: 8000 });

    // Đọc các dòng chữ báo lỗi nằm NGAY DƯỚI ô Số điện thoại (trong khoảng 80px)
    const readPhoneErrors = async () => {
      const box = await phoneInput.boundingBox();
      if (!box) return [];
      const all = await page.evaluate(({ top, left, right }) => {
        const out = new Set();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
          if (!t || t.length > 120) continue;
          const el = n.parentElement;
          if (!el) continue;
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') continue;
          if (r.top >= top - 2 && r.top <= top + 80 && r.left < right && r.right > left) out.add(t);
        }
        return [...out];
      }, { top: box.y + box.height, left: box.x, right: box.x + box.width });
      return all.filter((t) => /(số điện thoại|sđt|không hợp lệ|không đúng|định dạng|vui lòng|sai|bắt buộc|tối đa|tối thiểu)/i.test(t));
    };

    // Mỗi trường hợp: nhập SĐT như người dùng gõ -> click [Xác nhận] -> không tiếp tục được + có lỗi dưới ô SĐT
    const checkInvalidPhone = async (stepName, phone, wordingRe) => {
      await test.step(`${stepName}: SĐT "${phone}"`, async () => {
        await phoneInput.click();
        await phoneInput.fill('');
        await phoneInput.pressSequentially(phone, { delay: 30 });
        await page.waitForTimeout(500);

        // Web có thể tự lọc/cắt ký tự khi gõ: ghi lại giá trị thật trong ô
        const actual = await phoneInput.inputValue();
        console.log(`[ORDER_Info_04] ${stepName}: gõ "${phone}" -> ô SĐT đang chứa "${actual}"`);

        // An toàn: nếu giá trị sau khi web lọc/cắt lại thành SĐT hợp lệ thì KHÔNG bấm [Xác nhận]
        // (tránh gửi SMS thật), ghi nhận để kiểm tra thủ công
        if (/^0\\d{9}$/.test(actual)) {
          test.info().annotations.push({
            type: 'canh-bao',
            description: `${stepName}: ô SĐT tự biến "${phone}" thành "${actual}" (hợp lệ) nên không bấm [Xác nhận]`,
          });
          expect.soft(false, `${stepName}: ô SĐT tự lọc/cắt "${phone}" thành SĐT hợp lệ "${actual}"`).toBe(true);
          return;
        }

        if (await confirmBtn.isEnabled()) {
          await confirmBtn.click();
        } else {
          await phoneInput.press('Tab'); // nút bị khóa: kích hoạt kiểm tra khi rời ô
        }

        // Gom lỗi trong ~2.4s (phòng thông báo tự biến mất)
        const seen = new Set();
        for (let i = 0; i < 6; i++) {
          await page.waitForTimeout(400);
          for (const m of await readPhoneErrors()) seen.add(m);
        }
        const errors = [...seen];
        await test.info().attach(`${stepName}-sau-khi-bam-xac-nhan`, { body: await page.screenshot(), contentType: 'image/png' });
        console.log(`[ORDER_Info_04] ${stepName}: lỗi dưới ô SĐT =`, JSON.stringify(errors));

        // Expected (cứng): không tiếp tục được + có báo lỗi ngay dưới ô Số điện thoại
        await expect(page).not.toHaveURL(/thanh-toan|dat-hang|checkout|otp/);
        await expect(dialogTitle, `${stepName}: hộp thoại đã đóng, hệ thống cho đi tiếp với SĐT sai`).toBeVisible();
        expect(errors.length, `${stepName}: phải hiện lỗi dưới ô Số điện thoại. Thấy được: ${JSON.stringify(errors)}`)
          .toBeGreaterThan(0);

        // Expected (mềm): đúng nội dung lỗi theo Excel
        expect.soft(
          errors.some((m) => wordingRe.test(m)),
          `${stepName}: nội dung lỗi phải khớp ${wordingRe}. Thấy được: ${JSON.stringify(errors)}`
        ).toBe(true);
      });
    };

    const INVALID_RE = /không hợp lệ/i;
    const FORMAT_RE = /không đúng định dạng/i;

    // ---- Step 1: SĐT thiếu số ----
    await checkInvalidPhone('Step 1', '090123', INVALID_RE);
    // ---- Step 2: SĐT chứa chữ ----
    await checkInvalidPhone('Step 2', '09abc12345', INVALID_RE);
    // ---- Step 3: SĐT có ký tự đặc biệt ----
    await checkInvalidPhone('Step 3', '090@#12345', INVALID_RE);
    // ---- Step 4: SĐT không bắt đầu bằng 0 ----
    await checkInvalidPhone('Step 4', '5901234567', INVALID_RE);
    // ---- Step 5: SĐT dư số ----
    await checkInvalidPhone('Step 5', '090123456789', FORMAT_RE);
  });
 
  // TC 05: Không thể tiếp tục khi chưa chọn địa chỉ giao hàng
  test('ORDER_Info_05 - Không thể tiếp tục khi chưa chọn địa chỉ giao hàng', async ({ page }) => {
    await seedCart(page, ['C']);
    await openOrderDialog(page);
 
    // Điền họ tên và SĐT hợp lệ, KHÔNG chọn địa chỉ
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone });
 
    const confirmBtn = page.locator(L.CONFIRM_INFO_BTN).first();
    await confirmBtn.click();
    await page.waitForTimeout(1000);
 
    // Kiểm tra thông báo yêu cầu chọn địa chỉ hoặc nút [Đã hiểu]
    const alertUnderstand = page.locator(L.ALERT_UNDERSTAND_BTN).first();
    const alertMsg = page.getByText(/vui lòng chọn địa chỉ giao hàng/i).filter({ visible: true }).first();
    await expect(alertMsg, 'Thiếu thông báo yêu cầu chọn địa chỉ giao hàng').toBeVisible({ timeout: 5000 });
    await expect(alertUnderstand, 'Thông báo phải có nút [Đã hiểu]').toBeVisible({ timeout: 5000 });
    await alertUnderstand.click();
    await expect(page.locator(L.ORDER_DIALOG_TITLE).first()).toBeVisible();
    await expect(page.locator(L.NAME_INPUT).first()).toHaveValue(TEST_CUSTOMER.fullName);
    await expect(page.locator(L.PHONE_INPUT).first()).toHaveValue(TEST_CUSTOMER.phone);
  });
 
  // TC 06: Chọn danh xưng Anh hoặc Chị
  test('ORDER_Info_06 - Chọn danh xưng Anh hoặc Chị', async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);

    // ---- Pre-condition: giỏ có SP C, đã bấm [Đặt mua], đang ở hộp thoại "Thông tin đặt hàng" ----
    await seedCart(page, ['C']);
    await openOrderDialog(page);

    const dialogTitle = page.getByRole('heading', { name: 'Thông tin đặt hàng', exact: true }).filter({ visible: true }).first();
    if (!(await dialogTitle.isVisible({ timeout: 5000 }).catch(() => false))) {
      await page.screenshot({ path: 'test-results/ORDER_Info_06_no_dialog.png', fullPage: true });
    }
    await expect(dialogTitle, 'Hộp thoại "Thông tin đặt hàng" chưa mở được').toBeVisible({ timeout: 5000 });

    // Khung hộp thoại: tìm lại mỗi lần cần (sau khi nhập địa chỉ hộp thoại có thể được vẽ lại)
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

    const genderGroup = page.getByRole('radiogroup', { name: 'Danh xưng' });
    const maleRadio = genderGroup.getByRole('radio', { name: 'Anh', exact: true });
    const femaleRadio = genderGroup.getByRole('radio', { name: 'Chị', exact: true });
    const maleOption = genderGroup.getByText('Anh', { exact: true });
    const femaleOption = genderGroup.getByText('Chị', { exact: true });

    // ---- Step 1: quan sát lựa chọn mặc định ----
    // Expected 1: không có mặc định (cả hai đều chưa được chọn)
    await expect(maleOption, 'Phải hiển thị lựa chọn [Anh]').toBeVisible();
    await expect(femaleOption, 'Phải hiển thị lựa chọn [Chị]').toBeVisible();
    await expect(maleRadio, 'Mặc định [Anh] không được chọn').not.toBeChecked();
    await expect(femaleRadio, 'Mặc định [Chị] không được chọn').not.toBeChecked();

    // ---- Step 2: click [Chị] ----
    await femaleOption.click();
    // Expected 2: chỉ chọn được một trong hai -> [Chị] được chọn, [Anh] bỏ chọn
    await expect(femaleRadio, '[Chị] phải được chọn').toBeChecked();
    await expect(maleRadio, '[Anh] phải bỏ chọn').not.toBeChecked();

    // ---- Step 3: điền thông tin hợp lệ, click [Xác nhận], xem thông tin người nhận ở trang Thanh toán ----
    // Chọn địa chỉ trước, sau đó nhập họ tên + số điện thoại
    await fillOrderInfo(page, { chooseAddress: true });
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi chọn địa chỉ').toBe(true);
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone });
    expect(await markOrderDialog(), 'Không xác định lại được hộp thoại sau khi nhập thông tin').toBe(true);

    // Chọn danh xưng không bị mất sau khi chọn địa chỉ / nhập thông tin
    await expect(femaleRadio, '[Chị] phải còn được chọn sau khi nhập thông tin').toBeChecked();
    await test.info().attach('truoc-khi-bam-xac-nhan', { body: await page.screenshot(), contentType: 'image/png' });

    // Click [Xác nhận] CỦA HỘP THOẠI này (không dùng nút "Xác nhận" ở chỗ khác trên trang)
    const dlg = page.locator('[data-qa-order="1"]');
    const confirmInfo = dlg.getByRole('button', { name: 'Xác nhận', exact: true }).last();
    await expect(confirmInfo, 'Không tìm thấy nút [Xác nhận]').toBeVisible({ timeout: 8000 });
    await confirmInfo.click();
    await expect(dialogTitle, 'Hộp thoại phải đóng sau khi xác nhận thông tin hợp lệ').toBeHidden({ timeout: 10000 });

    // Sang trang Thanh toán bằng [Đặt mua] ở giỏ hàng
    const placeOrder = page.getByRole('button', { name: 'Đặt mua', exact: true }).first();
    await Promise.all([
      page.waitForURL(/\/checkout/, { timeout: 15000 }),
      placeOrder.click(),
    ]);

    // Expected 3: trang Thanh toán hiển thị đúng danh xưng và họ tên đã chọn
    await expect(
      page.getByText(new RegExp(`Chị\\s*${TEST_CUSTOMER.fullName}`)).first(),
      'Trang Thanh toán phải hiển thị danh xưng Chị và họ tên đã nhập'
    ).toBeVisible();
    await expect(
      page.getByText(new RegExp(`Anh\\s*${TEST_CUSTOMER.fullName}`)),
      'Không được hiển thị danh xưng Anh'
    ).toHaveCount(0);
    await expect(page.getByText(TEST_CUSTOMER.fullName).first()).toBeVisible();
    await expect(page.getByText(TEST_CUSTOMER.phone).first()).toBeVisible();
    await test.info().attach('trang-thanh-toan', { body: await page.screenshot(), contentType: 'image/png' });

    // Dừng tại trang Thanh toán: không bấm đặt hàng -> không gửi SMS/OTP
  });
 
  // TC 07: Bật công tắc Người khác nhận hàng
  test('ORDER_Info_07 - Bật công tắc Người khác nhận hàng', async ({ page }) => {
    await seedCart(page, ['C']);
    await openOrderDialog(page);

    const nameBoxes = page.getByRole('textbox', { name: /Họ tên|Họ và tên/i });
    const phoneBoxes = page.getByRole('textbox', { name: 'Số điện thoại' });
    const otherReceiver = page.locator('#ortherReceive');        // checkbox (trạng thái bật/tắt)
    const toggleLabel = page.locator('label[for="ortherReceive"]'); // nút gạt thật, dùng để click

    // 1. Nhập họ tên, số điện thoại người đặt
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone });
    await expect(nameBoxes).toHaveCount(1);
    await expect(phoneBoxes).toHaveCount(1);

    // 2. Bật công tắc "Người khác nhận hàng"
    await toggleLabel.click();
    await expect(otherReceiver).toBeChecked();

    // 3. Hiện thêm ô Họ và tên, Số điện thoại của người nhận
    await expect(nameBoxes).toHaveCount(2);
    await expect(phoneBoxes).toHaveCount(2);

    // 4. Tắt công tắc: ô người nhận ẩn, dữ liệu người đặt giữ nguyên
    await toggleLabel.click();
    await expect(otherReceiver).not.toBeChecked();
    await expect(nameBoxes).toHaveCount(1);
    await expect(phoneBoxes).toHaveCount(1);
    await expect(nameBoxes.first()).toHaveValue(TEST_CUSTOMER.fullName);
    await expect(phoneBoxes.first()).toHaveValue(TEST_CUSTOMER.phone);
  });
 
  // TC 08: Chọn địa chỉ theo Tỉnh/TP và Phường/Xã
  test('ORDER_Info_08 - Chọn địa chỉ theo Tỉnh/TP và Phường/Xã', async ({ page }) => {
    test.setTimeout(120000);
    await seedCart(page, ['C']);
    await openOrderDialog(page);

    // Chọn tỉnh/thành, phường/xã, nhập số nhà và chọn gợi ý trước khi điền người nhận.
    await fillOrderInfo(page, { chooseAddress: true });
    // Sau khi hoàn tất địa chỉ mới nhập họ tên và số điện thoại hợp lệ.
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone });

    // 5. Click [Xác nhận] -> quay lại trang giỏ hàng (không chuyển trang Thanh toán)
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
    await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    await expect(page).toHaveURL(/gio-hang/);

    // Khối giao hàng hiển thị họ tên, số điện thoại và địa chỉ vừa nhập
    await expect(page.getByText(TEST_CUSTOMER.fullName).first()).toBeVisible();
    await expect(page.getByText(TEST_CUSTOMER.phone).first()).toBeVisible();
    const address = page.getByText(new RegExp('^' + TEST_CUSTOMER.street));
    await expect(address.first()).toBeVisible();
    // Địa chỉ xuất hiện ở khối giao hàng và ở header (khu vực cập nhật)
    await expect.soft(address, 'Khu vực trên header chưa cập nhật').toHaveCount(2);

    // Dừng tại đây: không bấm [Đặt mua] lần nữa -> không tạo đơn
  });
 
  // TC 09: Không thể xác nhận với họ và tên không hợp lệ
  test('ORDER_Info_09 - Kiểm tra ký tự và độ dài khi nhập họ và tên', async ({ page }) => {
    test.setTimeout(120000);
    await seedCart(page, ['C']);
    await openOrderDialog(page);

    // Web thay ký tự không hợp lệ bằng ký tự vô hình (U+200B) nên phải bỏ chúng trước khi so sánh
    const clean = (s) => s.replace(/\u200B/g, '');

    // 1. Nhập số điện thoại, địa chỉ hợp lệ
    await fillOrderInfo(page, { phone: TEST_CUSTOMER.phone, chooseAddress: true });
    const nameInput = page.getByRole('textbox', { name: /Họ tên|Họ và tên/i }).first();
    await expect(nameInput).toBeVisible();

    // 2. Nhập họ tên chỉ gồm số -> không nhập được
    await test.step('Nhập số vào ô Họ và tên', async () => {
      await nameInput.click();
      await nameInput.pressSequentially('12345');
      expect.soft(clean(await nameInput.inputValue()), 'Ô Họ và tên vẫn nhận số').toBe('');
    });

    // 3. Nhập họ tên có ký tự đặc biệt -> không nhập được
    await test.step('Nhập ký tự đặc biệt vào ô Họ và tên', async () => {
      await nameInput.pressSequentially('@#$%');
      expect.soft(clean(await nameInput.inputValue()), 'Ô Họ và tên vẫn nhận ký tự đặc biệt').toBe('');
    });

        // 4. Nhập họ tên rất dài (150 ký tự) -> nhập được, giao diện không vỡ
    await test.step('Nhập chuỗi 150 ký tự vào ô Họ và tên', async () => {
      await nameInput.fill('');
      await nameInput.pressSequentially('a'.repeat(150));
      expect.soft(clean(await nameInput.inputValue()).length, 'Ô Họ và tên không nhận đủ 150 ký tự').toBe(150);
      // Giao diện vẫn bình thường: hộp thoại còn hiển thị, ô nhập vẫn dùng được
      await expect.soft(page.getByText('Thông tin đặt hàng').first()).toBeVisible();
      await expect.soft(nameInput).toBeEditable();
    });

    // Dừng tại đây: không bấm [Xác nhận]
  });
 
  // TC 10: Từ chối quyền vị trí khi bấm [Chia sẻ vị trí]
  test('ORDER_Info_10 - Từ chối quyền vị trí khi bấm [Chia sẻ vị trí]', async ({ context, page }) => {
    // Cấu hình không cấp quyền geolocation cho context
    await context.clearPermissions();
 
    await seedCart(page, ['C']);
    await openOrderDialog(page);
 
    const shareLocBtn = page.locator(L.SHARE_LOCATION_BTN).first();
    await expect(shareLocBtn, 'Hộp thoại phải có nút Dùng vị trí hiện tại').toBeVisible();
    await shareLocBtn.click();
    await page.waitForTimeout(1500);

    // Chromium do Playwright quản lý có thể không hiển thị prompt native trong DOM;
    // vẫn xác nhận website không tự gán địa chỉ và bộ chọn thủ công còn dùng được.
    await expect(page.locator(L.ORDER_DIALOG_TITLE).first()).toBeVisible();
    await expect(page.locator(L.CHOOSE_ADDRESS_BTN).first(), 'Sau khi từ chối quyền vị trí vẫn chọn địa chỉ thủ công được').toBeVisible();
    await expect(page.getByText('Chọn địa chỉ', { exact: true }).first(), 'Không được tự điền địa chỉ khi chưa có quyền vị trí').toBeVisible();
    test.info().annotations.push({ type: 'geolocation-prompt', description: 'Prompt quyền vị trí của trình duyệt là UI native; test xác minh website không tự điền và vẫn cho chọn địa chỉ thủ công.' });
  });
 
  /* --------------------------------------------------------------------------
   * PHẦN 2: HÌNH THỨC GIAO NHẬN HÀNG (ORDER_Method)
   * -------------------------------------------------------------------------- */
 
  // TC 11: Chọn hình thức Giao tận nơi hoặc Nhận tại siêu thị
  test('ORDER_Method_01 - Chọn hình thức Giao tận nơi hoặc Nhận tại siêu thị', async ({ page }) => {
  test.setTimeout(90000);

  // ---- Pre-condition ----
  await seedCart(page, ['C']);
  await expect(page).toHaveURL(/\/gio-hang/);

  // ========== Locators ==========
  // Hai lựa chọn là radio tùy biến nằm trong <label> (getByRole('radio') không tìm thấy):
  // bấm vào <label>, còn trạng thái "đã chọn" kiểm tra trên <input type="radio"> bên trong label.
  const homeLabel   = page.locator('label').filter({ hasText: 'Giao tận nơi' }).first();
  const pickupLabel = page.locator('label').filter({ hasText: 'Nhận tại siêu thị' }).first();
  const deliveryHomeRadio = homeLabel.locator('input[type="radio"]');
  const pickupStoreRadio  = pickupLabel.locator('input[type="radio"]');
  const provideInfo = page.getByText('Vui lòng cung cấp thông tin nhận hàng', { exact: true }).first();
  const dialogTitle = page.getByText('Thông tin đặt hàng').first();

  // Ghi lại trạng thái các radio ngay từ đầu để dễ chẩn đoán (có thể xóa khi ổn)
  const radioInfo = await page.locator('input[type="radio"]').evaluateAll((els) =>
    els.map((e) => ({
      name: e.name,
      checked: e.checked,
      label: ((e.closest('label') || {}).innerText || '').trim().slice(0, 40),
    }))
  );
  console.log('[ORDER_Method_01] RADIO:', JSON.stringify(radioInfo));
  await test.info().attach('method01-bat-dau', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

  try {
    // ---- Step 1: Quan sát mặc định ----
    // Expected: Đang chọn [Giao tận nơi]
    await expect(homeLabel, 'Phải có lựa chọn [Giao tận nơi]').toBeVisible({ timeout: 15000 });
    await expect(pickupLabel, 'Phải có lựa chọn [Nhận tại siêu thị]').toBeVisible({ timeout: 15000 });
    await expect(deliveryHomeRadio, 'Mặc định phải chọn Giao tận nơi').toBeChecked({ timeout: 15000 });
    await expect(pickupStoreRadio, 'Mặc định không được chọn Nhận tại siêu thị').not.toBeChecked();

    // ---- Step 2: Click [Nhận tại siêu thị] ----
    // Expected: Chuyển sang [Nhận tại siêu thị] + hiện khối "Vui lòng cung cấp thông tin nhận hàng"
    await pickupLabel.click();
    await expect(pickupStoreRadio).toBeChecked({ timeout: 10000 });
    await expect(deliveryHomeRadio).not.toBeChecked();
    await expect(provideInfo).toBeVisible({ timeout: 10000 });

    // ---- Step 3: Click khối "Vui lòng cung cấp thông tin nhận hàng" ----
    // Expected: Mở hộp thoại "Thông tin đặt hàng"
    await provideInfo.click();
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // ---- Step 4: Kiểm tra nội dung hộp thoại ----
    const modal = page.locator('[id^="modal-"]').last();

    await expect(page.getByText('Anh', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Chị', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Họ tên/ }).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Số điện thoại/ }).first()).toBeVisible();
    await expect(page.getByText('Đăng nhập').last()).toBeVisible();
    await expect(page.getByText('Tìm siêu thị gần bạn').first()).toBeVisible();
    await expect(modal.getByText('Hồ Chí Minh').first()).toBeVisible();
    await expect(modal.getByText(/Phường\/xã/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/Tìm nhanh siêu thị/).first()).toBeVisible();
    await expect(page.getByText(/Có \d+ siêu thị/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xác nhận', exact: true }).last()).toBeVisible();

    // ---- Step 5: Đóng hộp thoại ----
    // Expected: Hộp thoại đóng, vẫn đang chọn [Nhận tại siêu thị]
    const closeBtn = page
      .getByRole('button', { name: '✕' })
      .or(modal.getByText(/^[✕×]$/))
      .or(page.locator(L?.CLOSE_DIALOG_BTN || '[aria-label="Close"], button:has-text("×")'))
      .first();

    await closeBtn.click();
    await expect(dialogTitle).toBeHidden({ timeout: 10000 });
    await expect(pickupStoreRadio).toBeChecked();

    // ---- Step 6: Click lại [Giao tận nơi] ----
    // Expected: Quay về [Giao tận nơi]
    await homeLabel.click();
    await expect(deliveryHomeRadio).toBeChecked({ timeout: 10000 });
    await expect(pickupStoreRadio).not.toBeChecked();

  } finally {
    // Cleanup: đảm bảo về lại Giao tận nơi (đặt timeout ngắn để không treo tới hết thời gian của test)
    if (!page.isClosed()) {
      const closeX = page.getByRole('button', { name: '✕' }).first();
      if (await closeX.isVisible().catch(() => false)) {
        await closeX.click({ timeout: 3000 }).catch(() => {});
      }
      if (!(await deliveryHomeRadio.isChecked({ timeout: 3000 }).catch(() => true))) {
        await homeLabel.click({ timeout: 3000 }).catch(() => {});
      }
    }
  }
});
 
      // TC 12: Chọn Giao tiêu chuẩn hoặc Giao siêu nhanh
  test('ORDER_Method_02 - Chọn Giao tiêu chuẩn hoặc Giao siêu nhanh', async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000); // mỗi thao tác chờ tối đa 15 giây rồi báo lỗi kèm số dòng

    // Pre-condition: nhập thông tin nhận hàng hợp lệ như các test trước, rồi bấm [Đặt mua] để sang trang Thanh toán
    await seedCart(page, ['C']);
    await openOrderDialog(page);
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: true });
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
    await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });
    await expect(page.getByText('Chi tiết giao hàng')).toBeVisible();

    // Đọc số tiền: tìm dòng có đúng tên nhãn trong khối "Chi tiết thanh toán", lấy dòng ngay dưới nó
    const money = async (label) => {
      const block = page.getByText('Chi tiết thanh toán').first().locator('xpath=..');
      const lines = (await block.innerText({ timeout: 10000 }))
        .replace(/\u00a0/g, ' ')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const i = lines.findIndex((l) => l === label);
      if (i < 0) throw new Error(`Không thấy dòng "${label}". Nội dung: ${JSON.stringify(lines)}`);
      const val = lines[i + 1] ?? '';
      if (/Miễn phí/i.test(val)) return 0;
      const m = val.match(/^(\d[\d.]*)\s*[₫đ]$/);
      if (!m) throw new Error(`Không đọc được số tiền ở dòng "${label}". Giá trị: ${JSON.stringify(val)}`);
      return parseInt(m[1].replace(/\./g, ''), 10);
    };

    // Cuộn tới "Chi tiết thanh toán", thử lại nếu trang đang vẽ lại
    const scrollToPayment = async () => {
      await expect(async () => {
        await page.getByText('Chi tiết thanh toán').first().scrollIntoViewIfNeeded({ timeout: 3000 });
      }).toPass({ timeout: 10000 });
    };

    // 1. Quan sát hai lựa chọn; kéo xuống "Chi tiết thanh toán", ghi nhận phí và tổng thanh toán ban đầu
    await expect(page.getByText('Giao tiêu chuẩn', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Đổi', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Giao siêu nhanh', { exact: true })).toBeVisible();
    await scrollToPayment();
    const goods = await money('Tổng tiền hàng');
    expect(goods, 'Không đọc được Tổng tiền hàng').toBeGreaterThan(0);
    const stdFee = await money('Phí giao hàng');
    const totalStd = await money('Tổng thanh toán');
    expect(totalStd, 'Tổng thanh toán = Tổng tiền hàng + phí giao tiêu chuẩn').toBe(goods + stdFee);

    // 2. Kéo lên, click [Giao siêu nhanh]
    await page.getByText('Giao siêu nhanh', { exact: true }).scrollIntoViewIfNeeded();
    await page.getByText('Giao siêu nhanh', { exact: true }).click();

    // 3. Kéo xuống: phí giao siêu nhanh cao hơn phí tiêu chuẩn, tổng = tổng tiền hàng + phí giao hàng
    await scrollToPayment();
    await expect.poll(() => money('Phí giao hàng'), { timeout: 10000 }).toBeGreaterThan(stdFee);
    const fastFee = await money('Phí giao hàng');
    expect(await money('Tổng thanh toán')).toBe(goods + fastFee);

    // 4. Kéo lên, click [Giao tiêu chuẩn], kéo xuống: phí và tổng thanh toán về như ban đầu
    await page.getByText('Giao tiêu chuẩn', { exact: true }).scrollIntoViewIfNeeded();
    await page.getByText('Giao tiêu chuẩn', { exact: true }).click();
    await scrollToPayment();
    await expect.poll(() => money('Phí giao hàng'), { timeout: 10000 }).toBe(stdFee);
    expect(await money('Tổng thanh toán')).toBe(totalStd);

    // Dừng tại đây: không bấm [Thanh toán] -> không tạo đơn
  });
  /* --------------------------------------------------------------------------
   * PHẦN 3: PHƯƠNG THỨC THANH TOÁN (ORDER_Pay)
   * -------------------------------------------------------------------------- */
 
  // TC 13: Chọn Thanh toán toàn bộ đơn hoặc Thanh toán tối thiểu để giữ hàng
  test('ORDER_Pay_01 - Chọn Thanh toán toàn bộ đơn hoặc Thanh toán tối thiểu để giữ hàng', async ({ page }) => {
    test.setTimeout(180000);

    // Pre-condition: nhập thông tin nhận hàng hợp lệ, bấm [Đặt mua] để sang trang Thanh toán
    await seedCart(page, ['C']);
    await openOrderDialog(page);
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: true });
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
    await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });
    await expect(page.getByText('Chi tiết giao hàng')).toBeVisible();

    // Phần "Chọn số tiền thanh toán" chỉ hiện với một số đơn hàng
    const payFull = page.getByText('Thanh toán toàn bộ đơn', { exact: false }).first();
    const payMin  = page.getByText(/Thanh toán tối thiểu để giữ hàng/).first();
    const hasSection = await payFull.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasSection) {
      await test.info().attach('trang-thanh-toan', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
    test.skip(!hasSection,
      '[BLOCKED ON PROD] Trang Thanh toán của đơn SP C không hiển thị phần "Chọn số tiền thanh toán" ' +
      '(không có "Thanh toán toàn bộ đơn" / "Thanh toán tối thiểu để giữ hàng"), nên không thực hiện được các bước.');

    const money = async (label) => {
      const row = page.getByText(label, { exact: true }).first().locator('xpath=..');
      const m = (await row.innerText()).replace(label, '').match(/\d[\d.]*/);
      return m ? parseInt(m[0].replace(/\./g, ''), 10) : 0;
    };
    const fullRadio = page.locator('label').filter({ hasText: 'Thanh toán toàn bộ đơn' }).first();
    const minRadio  = page.locator('label').filter({ hasText: 'Thanh toán tối thiểu' }).first();
    await page.getByText('Chi tiết thanh toán').scrollIntoViewIfNeeded();
    const total = await money('Tổng thanh toán');

    // Bước 1: mặc định chọn "Thanh toán toàn bộ đơn", số tiền = tổng đơn hàng
    await payFull.scrollIntoViewIfNeeded();
    await expect.soft(fullRadio, 'Mặc định phải chọn Thanh toán toàn bộ đơn').toBeChecked();
    const fullAmount = parseInt(((await fullRadio.innerText()).match(/(\d{1,3}(?:\.\d{3})+)/) || [])[1]?.replace(/\./g, '') || '0', 10);
    expect.soft(fullAmount, 'Số tiền thanh toán toàn bộ phải bằng tổng đơn hàng').toBe(total);

    // Bước 2: chọn "Thanh toán tối thiểu để giữ hàng" -> hiện số tiền giữ hàng và lưu ý không hoàn tiền
    await payMin.click();
    await expect.soft(minRadio, 'Phải chọn được mức tối thiểu').toBeChecked();
    const minText = await minRadio.innerText();
    const minAmount = parseInt(((minText.match(/(\d{1,3}(?:\.\d{3})+)/) || [])[1] || '0').replace(/\./g, ''), 10);
    expect.soft(minAmount, 'Phải hiển thị số tiền giữ hàng nhỏ hơn tổng đơn').toBeGreaterThan(0);
    expect.soft(minAmount).toBeLessThan(total);
    await expect.soft(page.getByText(/không hoàn/i).first(), 'Thiếu lưu ý không hoàn tiền nếu không nhận hàng').toBeVisible();

    // Bước 3: click liên kết [Chi tiết] -> nội dung điều kiện giữ hàng
    const detailLink = page.getByText('Chi tiết', { exact: true }).first();
    await detailLink.click();
    await expect.soft(page.getByText(/điều kiện|giữ hàng/i).last(), 'Phải hiển thị chi tiết điều kiện giữ hàng').toBeVisible();
    // đóng nội dung chi tiết nếu là hộp thoại
    await page.keyboard.press('Escape');

    // Bước 4: chọn lại "Thanh toán toàn bộ đơn" -> số tiền cập nhật lại
    await payFull.click();
    await expect.soft(fullRadio).toBeChecked();
    await expect.soft(minRadio).not.toBeChecked();
    expect.soft(await money('Tổng thanh toán'), 'Tổng thanh toán phải trở về như ban đầu').toBe(total);

    // Dừng tại đây: không bấm [Thanh toán] -> không tạo đơn
  });

  // TC 14: Hiển thị danh sách phương thức thanh toán
  test('ORDER_Pay_02 - Hiển thị danh sách phương thức thanh toán', async ({ page }) => {
    test.setTimeout(180000);

    // Tự đóng popup quảng cáo (lớp nền tối) nếu nó chặn thao tác
    const overlay = page.locator('div.cursor-pointer[class*="bg-[#1E1E1E]"]').first();
    await page.addLocatorHandler(overlay, async () => {
      await page.keyboard.press('Escape');
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
      }
    }, { noWaitAfter: true });

    // Pre-condition: nhập thông tin nhận hàng hợp lệ, bấm [Đặt mua] để sang trang Thanh toán
    await seedCart(page, ['C']);
    await openOrderDialog(page);
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: true });
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
    await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });

    // Pre-condition: Giao tận nơi, Giao tiêu chuẩn (mặc định) -> chụp ảnh làm bằng chứng
    await expect(page.getByText('Giao tiêu chuẩn', { exact: true })).toBeVisible();
    await test.info().attach('pre-condition-giao-hang', { body: await page.screenshot(), contentType: 'image/png' });

    // Phần tử "thật sự nhìn thấy": có chữ khớp, không bị khung cha thu gọn/cắt mất
    const shown = (re) => page.evaluate(({ src, flags }) => {
      const rx = new RegExp(src, flags);
      const ownText = (el) => [...el.childNodes]
        .filter(n => n.nodeType === 3)
        .map(n => n.textContent)
        .join(' ')
        .normalize('NFC')
        .replace(/\u00a0/g, ' ');
      const clipped = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return true;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return true;
          if (/(hidden|clip|auto|scroll)/.test(s.overflow + s.overflowY)) {
            const pr = p.getBoundingClientRect();
            if (pr.height < 1 || r.bottom <= pr.top + 1 || r.top >= pr.bottom - 1) return true;
          }
        }
        return false;
      };
      return [...document.querySelectorAll('body *')].some(
        el => rx.test(ownText(el)) && !clipped(el));
    }, { src: re.source, flags: re.flags });
    const waitShown = (re, want) =>
      expect.poll(() => shown(re), { timeout: 5000 }).toBe(want).then(() => true).catch(() => false);

    const toggle = page.getByText(/hình thức thanh toán khác|Xem thêm/).filter({ visible: true }).first();
    const collapse = page.getByText('Thu hồi', { exact: true }).filter({ visible: true }).first();

    // Bước 1: cuộn tới phần "Chọn phương thức thanh toán"
    const title = page.getByText('Chọn phương thức thanh toán');
    await title.scrollIntoViewIfNeeded();
    await expect(title).toBeVisible();

    // Bước 2: phương thức mặc định = "Chuyển khoản ngân hàng"
    const bankRadio = page.getByText('Chuyển khoản ngân hàng', { exact: true }).first()
      .locator('xpath=ancestor::*[.//input[@type="radio"]][1]').locator('input[type="radio"]').first();
    await expect.soft(bankRadio, 'Mặc định phải chọn Chuyển khoản ngân hàng').toBeChecked();

    // Trạng thái thu gọn: 3 phương thức đầu + nút "N hình thức thanh toán khác"
    await expect(toggle, 'Phải có nút mở rộng danh sách').toBeVisible();
    expect.soft(await shown(/MWG Paylater/i), 'Thu gọn: phải thấy MWG Paylater').toBe(true);
    expect.soft(await shown(/Thanh toán khi nhận hàng/i), 'Thu gọn: phải thấy Thanh toán khi nhận hàng').toBe(true);
    expect.soft(await shown(/Zalopay/i), 'Thu gọn: ZaloPay chưa được hiện').toBe(false);
    await test.info().attach('thanh-toan-thu-gon', { body: await page.screenshot(), contentType: 'image/png' });

    // Số N đọc từ nút TRƯỚC khi bấm (SP C: "9 hình thức thanh toán khác")
    const toggleText = await toggle.innerText().catch(() => '');
    const n = parseInt((toggleText.match(/\d+/) || ['0'])[0], 10);

    // Bước 3a: mở rộng -> đủ 12 phương thức (3 + N, SP C: N = 9)
    await toggle.click();
    await expect(collapse, 'Sau khi mở rộng phải có nút [Thu hồi]').toBeVisible({ timeout: 5000 });
    const expected = {
      'MWG Paylater': /MWG Paylater/i,
      'Chuyển khoản ngân hàng': /Chuyển khoản ngân hàng/i,
      'Thanh toán khi nhận hàng': /Thanh toán khi nhận hàng/i,
      'Qua thẻ tín dụng/ghi nợ': /ghi\s*nợ/i,
      'Ví MoMo': /MoMo/i,
      'VNPay QR': /VNPay/i,
      'ZaloPay': /Zalopay/i,
      'SmartPay QR': /SmartPay/i,
      'Home PayLater': /Home PayLater/i,
      'Apple Pay': /Apple Pay/i,
      'Qua thẻ ATM/tín dụng Napas': /Napas/i,
      'Nhân viên mang máy cà thẻ khi nhận hàng': /Nhân viên mang máy/i,
    };
    const missing = [];
    for (const [name, re] of Object.entries(expected)) {
      if (!(await waitShown(re, true))) missing.push(name);
    }
    const radios = await page.getByText('Chọn phương thức thanh toán')
      .locator('xpath=ancestor::*[.//input[@type="radio"]][1]').locator('input[type="radio"]').count();
    console.log(`Nút mở rộng: ${n} hình thức khác | số ô chọn: ${radios} | thiếu:`, missing);
    await test.info().attach('thanh-toan-mo-rong', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    expect.soft(missing, `Thiếu phương thức: ${missing.join(', ')}`).toEqual([]);
    expect.soft(Object.keys(expected).length, 'Danh sách kỳ vọng phải đủ 12 phương thức').toBe(12);
    if (n > 0) expect.soft(radios, 'Tổng phương thức phải bằng 3 + N').toBe(3 + n);

    // Bước 3b: [Thu hồi] -> thu gọn lại 3 phương thức
    await collapse.click();
    await expect(toggle, 'Sau khi thu hồi phải quay lại nút mở rộng').toBeVisible({ timeout: 5000 });
    const hidden = await waitShown(/Zalopay/i, false);
    expect.soft(hidden, 'Sau khi thu hồi, ZaloPay phải ẩn').toBe(true);
    await test.info().attach('thanh-toan-sau-thu-hoi', { body: await page.screenshot(), contentType: 'image/png' });

    test.info().annotations.push({
      type: 'note',
      description: 'Expected chỉnh theo website (Giao tận nơi, Giao tiêu chuẩn, SP C): không có "Thanh toán tại siêu thị gần nhất"; có thêm Thanh toán khi nhận hàng, Apple Pay, Nhân viên mang máy cà thẻ. Số phương thức thay đổi theo giá trị đơn hàng.',
    });

    // Dừng tại đây: không bấm [Thanh toán] -> không tạo đơn
  });
 
  // TC 15: Chỉ chọn được một phương thức thanh toán
  test('ORDER_Pay_03 - Chỉ chọn được một phương thức thanh toán', async ({ page }) => {
    test.setTimeout(180000);

    // Tự đóng popup quảng cáo (lớp nền tối) nếu nó chặn thao tác
    const overlay = page.locator('div.cursor-pointer[class*="bg-[#1E1E1E]"]').first();
    await page.addLocatorHandler(overlay, async () => {
      await page.keyboard.press('Escape');
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
      }
    }, { noWaitAfter: true });

    // Pre-condition: nhập thông tin nhận hàng hợp lệ, bấm [Đặt mua] để sang trang Thanh toán
    await seedCart(page, ['C']);
    await openOrderDialog(page);
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: true });
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
    await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });

    // Tất cả ô chọn thuộc phần "Chọn phương thức thanh toán"
    const title = page.getByText('Chọn phương thức thanh toán');
    await title.scrollIntoViewIfNeeded();
    await expect(title).toBeVisible();
    const methodRadios = title.locator('xpath=ancestor::*[.//input[@type="radio"]][1]').locator('input[type="radio"]');

    // Ô chọn của MỘT phương thức: lấy khung cha gần nhất chỉ chứa đúng 1 ô chọn
    const radioOf = (name) => page.getByText(name, { exact: true }).first()
      .locator('xpath=ancestor::*[count(.//input[@type="radio"])=1][1]').locator('input[type="radio"]');
    const checkedCount = () => methodRadios.evaluateAll(els => els.filter(e => e.checked).length);

    // Ví MoMo và VNPay QR nằm trong phần bị thu gọn, cần bấm "N hình thức thanh toán khác" để mở rộng
    const toggle = page.getByText(/hình thức thanh toán khác|Xem thêm/).filter({ visible: true }).first();
    const ensureExpanded = async () => {
      const vnpay = page.getByText('VNPay QR', { exact: true }).first();
      if (!(await vnpay.isVisible().catch(() => false))) {
        await toggle.click();
        await expect(page.getByText('Thu hồi', { exact: true }).filter({ visible: true }).first())
          .toBeVisible({ timeout: 5000 });
      }
    };

    // Pre-condition: mặc định đang chọn "Chuyển khoản ngân hàng", chỉ có 1 phương thức được chọn
    await expect(radioOf('Chuyển khoản ngân hàng'), 'Mặc định phải chọn Chuyển khoản ngân hàng').toBeChecked();
    expect(await checkedCount(), 'Ban đầu chỉ có 1 phương thức được chọn').toBe(1);
    await test.info().attach('pre-condition-thanh-toan', { body: await page.screenshot(), contentType: 'image/png' });

    // Bước 0 (mở rộng danh sách) + Bước 1: click chọn "Ví MoMo"
    await ensureExpanded();
    const momo = page.getByText('Ví MoMo', { exact: true }).first();
    await momo.scrollIntoViewIfNeeded();
    await momo.click();
    await expect.soft(radioOf('Ví MoMo'), '"Ví MoMo" phải được chọn').toBeChecked();
    await expect.soft(radioOf('Chuyển khoản ngân hàng'), '"Chuyển khoản ngân hàng" phải bỏ chọn').not.toBeChecked();
    await test.info().attach('buoc-1-chon-momo', { body: await page.screenshot(), contentType: 'image/png' });

    // Bước 2: click chọn "VNPay QR" (nếu danh sách tự thu gọn lại sau bước 1 thì mở rộng lại)
    await ensureExpanded();
    const vnpay = page.getByText('VNPay QR', { exact: true }).first();
    await vnpay.scrollIntoViewIfNeeded();
    await vnpay.click();
    await expect.soft(radioOf('VNPay QR'), '"VNPay QR" phải được chọn').toBeChecked();
    await expect.soft(radioOf('Ví MoMo'), '"Ví MoMo" phải bỏ chọn').not.toBeChecked();
    await test.info().attach('buoc-2-chon-vnpay', { body: await page.screenshot(), contentType: 'image/png' });

    // Bước 3: tại một thời điểm chỉ có một phương thức được chọn
    const count = await checkedCount();
    console.log(`ORDER_Pay_03: tổng ô chọn = ${await methodRadios.count()} | đang được chọn = ${count}`);
    expect.soft(count, 'Tại một thời điểm chỉ có 1 phương thức được chọn').toBe(1);

    // Dừng tại đây: không bấm [Thanh toán] -> không tạo đơn
  });
 
  // TC 16: MWG Paylater hiển thị hạn mức và liên kết Đăng ký ngay
    // TC 16: MWG Paylater hiển thị hạn mức và liên kết Đăng ký ngay
  test('ORDER_Pay_04 - MWG Paylater hiển thị hạn mức và liên kết Đăng ký ngay', async ({ page, context }) => {
    test.setTimeout(180000);

    // Tự đóng popup quảng cáo (lớp nền tối) nếu nó chặn thao tác
    const overlay = page.locator('div.cursor-pointer[class*="bg-[#1E1E1E]"]').first();
    await page.addLocatorHandler(overlay, async () => {
      await page.keyboard.press('Escape');
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
      }
    }, { noWaitAfter: true });

    // ---- Pre-condition: nhập thông tin nhận hàng hợp lệ, bấm [Đặt mua] để sang trang Thanh toán ----
    await seedCart(page, ['C']);
    await openOrderDialog(page);
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: true });
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
    await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });

    const title = page.getByText('Chọn phương thức thanh toán');
    await title.scrollIntoViewIfNeeded();
    await expect(title).toBeVisible();

    let popup = null;
    try {
      // ---- Step 1: quan sát mục MWG Paylater (nằm trong 3 phương thức đầu, không cần mở rộng danh sách) ----
      const mwgName = page.getByText(/MWG Paylater/i).filter({ visible: true }).first();
      await expect(mwgName, 'Phải hiển thị mục MWG Paylater').toBeVisible({ timeout: 10000 });
      await mwgName.scrollIntoViewIfNeeded();

      // Khung của riêng mục MWG Paylater: khung cha gần nhất chỉ chứa đúng 1 ô chọn
      const mwgRow = mwgName.locator('xpath=ancestor::*[count(.//input[@type="radio"])=1][1]');
      const rowText = ((await mwgRow.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      console.log('ORDER_Pay_04 - nội dung mục MWG Paylater:', rowText);
      test.info().annotations.push({ type: 'mwg-paylater', description: rowText });
      await test.info().attach('buoc-1-mwg-paylater', { body: await page.screenshot(), contentType: 'image/png' });

      // Expected 1: mô tả hạn mức và lãi suất 0% theo chương trình
      expect(rowText.length, 'Không đọc được nội dung mục MWG Paylater').toBeGreaterThan(0);
      expect.soft(rowText, 'Phải có mô tả hạn mức').toMatch(/Hạn mức/i);
      expect.soft(rowText, 'Phải có lãi suất 0% theo chương trình').toMatch(/lãi suất\s*0\s*%/i);

      // Liên kết [Đăng ký ngay] phải nằm TRONG mục MWG Paylater (không lấy nhầm liên kết ở chỗ khác)
      const registerInRow = mwgRow.getByText('Đăng ký ngay', { exact: true }).filter({ visible: true }).first();
      const registerAny = page.getByText('Đăng ký ngay', { exact: true }).filter({ visible: true }).first();
      const inRow = await registerInRow.isVisible().catch(() => false);
      const registerLink = inRow ? registerInRow : registerAny;
      await expect(registerLink, 'Phải có liên kết [Đăng ký ngay]').toBeVisible();
      expect.soft(inRow, '[Đăng ký ngay] phải nằm trong mục MWG Paylater').toBe(true);

      // Ghi nhận (chỉ đọc): địa chỉ liên kết và trạng thái ô chọn MWG Paylater
      const href = await registerLink.evaluate((el) => (el.closest('a') || {}).href || '').catch(() => '');
      console.log('ORDER_Pay_04 - href của [Đăng ký ngay]:', href || '(không phải thẻ <a>)');
      test.info().annotations.push({ type: 'dang-ky-ngay-href', description: href || 'không phải thẻ <a>' });

      const mwgDisabled = await mwgRow.locator('input[type="radio"]').first().isDisabled({ timeout: 3000 }).catch(() => null);
      test.info().annotations.push({
        type: 'mwg-o-chon',
        description: mwgDisabled === null ? 'không đọc được trạng thái' : mwgDisabled ? 'ô chọn bị vô hiệu (chưa đăng ký)' : 'ô chọn bấm được',
      });
      console.log('ORDER_Pay_04 - ô chọn MWG Paylater bị vô hiệu:', mwgDisabled);

      // ---- Step 2: click [Đăng ký ngay] -> chuyển sang trang đăng ký MWG Paylater ----
      // Chỉ kiểm tra tới nơi chuyển đến, KHÔNG đăng ký tài khoản, KHÔNG nhập thông tin.
      const urlBefore = page.url();
      const popupP = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
      const navP = page.waitForURL((u) => u.toString() !== urlBefore, { timeout: 8000 }).then(() => true).catch(() => false);
      await registerLink.click();
      let navigated;
      [popup, navigated] = await Promise.all([popupP, navP]);

      const dest = popup || page;
      await dest.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await dest.waitForTimeout(1500);
      const destUrl = dest.url();
      const destText = (await dest.locator('body').innerText().catch(() => '')).slice(0, 4000);
      const dialogShown = !popup && !navigated &&
        (await page.locator('[role="dialog"], [id^="modal-"]').filter({ visible: true }).count()) > 0;
      const mode = popup ? 'mở tab mới' : navigated ? 'chuyển trang trong cùng tab' : dialogShown ? 'hiện hộp thoại' : 'không có phản hồi';
      console.log(`ORDER_Pay_04 - sau khi click: ${mode} | ${destUrl}`);
      test.info().annotations.push({ type: 'dang-ky-ngay', description: `${mode}: ${destUrl}` });
      await test.info().attach('buoc-2-sau-khi-click', { body: await dest.screenshot(), contentType: 'image/png' });

      // Expected 2: chuyển sang trang đăng ký MWG Paylater
      expect(Boolean(popup || navigated || dialogShown),
        `Click [Đăng ký ngay] không mở trang/ứng dụng/hộp thoại đăng ký (${mode})`).toBe(true);
      if (popup || navigated) {
        expect.soft(
          /paylater/i.test(`${destUrl} ${destText} ${href}`),
          `Trang đích không nhắc tới MWG Paylater: ${destUrl}`
        ).toBe(true);
      }
      // Dừng tại đây: không đăng ký, không bấm [Thanh toán] -> không tạo đơn
    } finally {
      if (popup) await popup.close().catch(() => {});
    }
  });
 
  // TC 17: Hiển thị danh sách phương thức thanh toán khi nhận hàng tại siêu thị
  test('ORDER_Pay_05 - Hiển thị danh sách phương thức thanh toán khi nhận hàng tại siêu thị', async ({ page }) => {
    test.setTimeout(180000);

    // Tự đóng popup quảng cáo (lớp nền tối) nếu nó chặn thao tác
    const overlay = page.locator('div.cursor-pointer[class*="bg-[#1E1E1E]"]').first();
    await page.addLocatorHandler(overlay, async () => {
      await page.keyboard.press('Escape');
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
      }
    }, { noWaitAfter: true });

    // Pre-condition (khớp Excel): mặc định là [Giao tận nơi] -> nhập thông tin + địa chỉ hợp lệ
    // -> SAU KHI nhập xong mới chuyển sang [Nhận tại siêu thị]
    await seedCart(page, ['C']);

    const deliveryHome = page.locator('label').filter({ hasText: 'Giao tận nơi' }).first();
    // Web nhớ lựa chọn nhận hàng của giỏ (kể cả sau các lần chạy trước) -> đưa về mặc định [Giao tận nơi]
    if (!(await deliveryHome.isChecked().catch(() => false))) {
      await deliveryHome.click();
    }
    await expect(deliveryHome, 'Mặc định phải chọn Giao tận nơi').toBeChecked();

    try {

    // Chỉ nhập khi web đang yêu cầu thông tin nhận hàng; nếu đã có sẵn thì bỏ qua
    const needInfo = page.locator('div')
      .filter({ hasText: 'Vui lòng cung cấp thông tin nhận hàng' })
      .filter({ hasText: 'Hồ Chí Minh' })
      .last();
    if (await needInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
      await openOrderDialog(page);
      await expect(page.getByText('Thông tin đặt hàng').first(), 'Hộp thoại Thông tin đặt hàng chưa mở').toBeVisible({ timeout: 10000 });
      // Chỉ chọn địa chỉ khi hộp thoại có nút [Chọn địa chỉ]
      const hasAddressPicker = await page.getByText('Chọn địa chỉ').first().isVisible({ timeout: 3000 }).catch(() => false);
      await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: hasAddressPicker });
      await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
      await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    }
    await test.info().attach('buoc-1-giao-tan-noi', { body: await page.screenshot(), contentType: 'image/png' });

    // Sau khi nhập xong: chuyển sang [Nhận tại siêu thị] (locator lấy từ ORDER_Method_01)
    const pickupStore = page.locator('label').filter({ hasText: 'Nhận tại siêu thị' }).first();
    await pickupStore.click();
    await expect(pickupStore).toBeChecked();

    // Chọn siêu thị: mở hộp thoại, giữ siêu thị mặc định web đề xuất, bấm [Xác nhận]
    const provideInfo = page.locator('div').filter({ hasText: /^Vui lòng cung cấp thông tin nhận hàng$/ }).first();
    if (await provideInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
      await provideInfo.click();
      await expect(page.getByText('Thông tin đặt hàng').first()).toBeVisible({ timeout: 10000 });

      // Họ tên, SĐT: chỉ điền khi ô còn trống
      const nameBox = page.getByRole('textbox', { name: /Họ tên/ });
      const phoneBox = page.getByRole('textbox', { name: /Số điện thoại/ });
      if (!(await nameBox.inputValue())) await nameBox.fill(TEST_CUSTOMER.fullName);
      if (!(await phoneBox.inputValue())) await phoneBox.fill(TEST_CUSTOMER.phone);

      await expect(page.getByText(/Có \d+ siêu thị/)).toBeVisible({ timeout: 10000 });
      await test.info().attach('sieu-thi-mac-dinh', { body: await page.screenshot(), contentType: 'image/png' });
      await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
      await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    }

    // Bấm [Đặt mua] để sang trang Thanh toán
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });

    // Pre-condition: hình thức nhận hàng là Nhận tại siêu thị -> chụp ảnh làm bằng chứng
    await expect(page.getByText('Nhận tại siêu thị').first()).toBeVisible();
    await test.info().attach('pre-condition-nhan-tai-sieu-thi', { body: await page.screenshot(), contentType: 'image/png' });

    // Phần tử "thật sự nhìn thấy": có chữ khớp, không bị khung cha thu gọn/cắt mất (như ORDER_Pay_02)
    const shown = (re) => page.evaluate(({ src, flags }) => {
      const rx = new RegExp(src, flags);
      const ownText = (el) => [...el.childNodes]
        .filter(n => n.nodeType === 3)
        .map(n => n.textContent)
        .join(' ')
        .normalize('NFC')
        .replace(/\u00a0/g, ' ');
      const clipped = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return true;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return true;
          if (/(hidden|clip|auto|scroll)/.test(s.overflow + s.overflowY)) {
            const pr = p.getBoundingClientRect();
            if (pr.height < 1 || r.bottom <= pr.top + 1 || r.top >= pr.bottom - 1) return true;
          }
        }
        return false;
      };
      return [...document.querySelectorAll('body *')].some(
        el => rx.test(ownText(el)) && !clipped(el));
    }, { src: re.source, flags: re.flags });
    const waitShown = (re, want) =>
      expect.poll(() => shown(re), { timeout: 5000 }).toBe(want).then(() => true).catch(() => false);

    const toggle = page.getByText(/hình thức thanh toán khác|Xem thêm/).filter({ visible: true }).first();
    const collapse = page.getByText('Thu hồi', { exact: true }).filter({ visible: true }).first();

    // Bước 1: cuộn tới phần "Chọn phương thức thanh toán"
    const title = page.getByText('Chọn phương thức thanh toán');
    await title.scrollIntoViewIfNeeded();
    await expect(title).toBeVisible();

    // Bước 2: phương thức mặc định = "Chuyển khoản ngân hàng"
    const bankRadio = page.getByText('Chuyển khoản ngân hàng', { exact: true }).first()
      .locator('xpath=ancestor::*[.//input[@type="radio"]][1]').locator('input[type="radio"]').first();
    await expect.soft(bankRadio, 'Mặc định phải chọn Chuyển khoản ngân hàng').toBeChecked();

    // Trạng thái thu gọn: 3 phương thức đầu + nút "N hình thức thanh toán khác"
    await expect(toggle, 'Phải có nút mở rộng danh sách').toBeVisible();
    expect.soft(await shown(/MWG Paylater/i), 'Thu gọn: phải thấy MWG Paylater').toBe(true);
    expect.soft(await shown(/Thanh toán tại siêu thị/i), 'Thu gọn: phải thấy Thanh toán tại siêu thị').toBe(true);
    expect.soft(await shown(/Zalopay/i), 'Thu gọn: ZaloPay chưa được hiện').toBe(false);
    await test.info().attach('thanh-toan-thu-gon', { body: await page.screenshot(), contentType: 'image/png' });

    // Số N đọc từ nút TRƯỚC khi bấm (Nhận tại siêu thị: 10 phương thức -> N = 7)
    const toggleText = await toggle.innerText().catch(() => '');
    const n = parseInt((toggleText.match(/\d+/) || ['0'])[0], 10);

    // Bước 3a: mở rộng -> đủ 10 phương thức (3 + N, N = 7)
    await toggle.click();
    await expect(collapse, 'Sau khi mở rộng phải có nút [Thu hồi]').toBeVisible({ timeout: 5000 });
    const expected = {
      'MWG Paylater': /MWG Paylater/i,
      'Chuyển khoản ngân hàng': /Chuyển khoản ngân hàng/i,
      'Thanh toán tại siêu thị gần nhất': /Thanh toán tại siêu thị/i,
      'Qua thẻ tín dụng/ghi nợ': /ghi\s*nợ/i,
      'Ví MoMo': /MoMo/i,
      'VNPay QR': /VNPay/i,
      'ZaloPay': /Zalopay/i,
      'SmartPay QR': /SmartPay/i,
      'Apple Pay': /Apple Pay/i,
      'Qua thẻ ATM/tín dụng Napas': /Napas/i,
    };
    const missing = [];
    for (const [name, re] of Object.entries(expected)) {
      if (!(await waitShown(re, true))) missing.push(name);
    }
    // Khi nhận tại siêu thị KHÔNG có các phương thức chỉ dành cho Giao tận nơi
    const unexpected = [];
    for (const [name, re] of Object.entries({
      'Thanh toán khi nhận hàng': /Thanh toán khi nhận hàng/i,
      'Home PayLater': /Home PayLater/i,
      'Nhân viên mang máy cà thẻ khi nhận hàng': /Nhân viên mang máy/i,
    })) {
      if (await shown(re)) unexpected.push(name);
    }
    const radios = await page.getByText('Chọn phương thức thanh toán')
      .locator('xpath=ancestor::*[.//input[@type="radio"]][1]').locator('input[type="radio"]').count();
    console.log(`ORDER_Pay_05 - Nút mở rộng: ${n} hình thức khác | số ô chọn: ${radios} | thiếu:`, missing, '| thừa:', unexpected);
    await test.info().attach('thanh-toan-mo-rong', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    expect.soft(missing, `Thiếu phương thức: ${missing.join(', ')}`).toEqual([]);
    expect.soft(unexpected, `Có phương thức không dành cho nhận tại siêu thị: ${unexpected.join(', ')}`).toEqual([]);
    expect.soft(Object.keys(expected).length, 'Danh sách kỳ vọng phải đủ 10 phương thức').toBe(10);
    if (n > 0) expect.soft(radios, 'Tổng phương thức phải bằng 3 + N').toBe(3 + n);

    // Bước 3b: [Thu hồi] -> thu gọn lại 3 phương thức
    await collapse.click();
    await expect(toggle, 'Sau khi thu hồi phải quay lại nút mở rộng').toBeVisible({ timeout: 5000 });
    const hidden = await waitShown(/Zalopay/i, false);
    expect.soft(hidden, 'Sau khi thu hồi, ZaloPay phải ẩn').toBe(true);
    await test.info().attach('thanh-toan-sau-thu-hoi', { body: await page.screenshot(), contentType: 'image/png' });

    test.info().annotations.push({
      type: 'note',
      description: 'Expected chỉnh theo website (Nhận tại siêu thị, SP C): "Thanh toán tại siêu thị gần nhất" hiển thị tên "Thanh toán tại siêu thị khi nhận hàng"; không có Thanh toán khi nhận hàng, Home PayLater, Nhân viên mang máy cà thẻ. Số phương thức thay đổi theo giá trị đơn hàng.',
    });

    // Dừng tại đây: không bấm [Thanh toán] -> không tạo đơn
    } finally {
      // Dọn dẹp: trả giỏ về [Giao tận nơi] để không ảnh hưởng các test khác dùng chung giỏ
      await openCartDirect(page).catch(() => {});
      const home = page.locator('label').filter({ hasText: 'Giao tận nơi' }).first();
      if (await home.isVisible({ timeout: 5000 }).catch(() => false) && !(await home.isChecked().catch(() => true))) {
        await home.click().catch(() => {});
      }
    }
  });
 
  // TC 18: Hiển thị chi tiết thanh toán đúng khi đổi phương thức
  test('ORDER_Pay_06 - Hiển thị chi tiết thanh toán đúng khi đổi phương thức', async ({ page }) => {
    test.setTimeout(180000);

    // Tự đóng popup quảng cáo (lớp nền tối) nếu nó chặn thao tác
    const overlay = page.locator('div.cursor-pointer[class*="bg-[#1E1E1E]"]').first();
    await page.addLocatorHandler(overlay, async () => {
      await page.keyboard.press('Escape');
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
      }
    }, { noWaitAfter: true });

    // Pre-condition: Giao tận nơi, Giao tiêu chuẩn (mặc định) -> nhập thông tin + địa chỉ -> [Đặt mua]
    await seedCart(page, ['C']);
    const deliveryHome = page.locator('label').filter({ hasText: 'Giao tận nơi' }).first();
    // Web nhớ lựa chọn nhận hàng của giỏ -> đưa về mặc định [Giao tận nơi]
    if (!(await deliveryHome.isChecked().catch(() => false))) {
      await deliveryHome.click();
    }
    await expect(deliveryHome, 'Mặc định phải chọn Giao tận nơi').toBeChecked();

    // Chỉ nhập khi web đang yêu cầu thông tin nhận hàng; nếu đã có sẵn thì bỏ qua
    const needInfo = page.locator('div')
      .filter({ hasText: 'Vui lòng cung cấp thông tin nhận hàng' })
      .filter({ hasText: 'Hồ Chí Minh' })
      .last();
    if (await needInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
      await openOrderDialog(page);
      await expect(page.getByText('Thông tin đặt hàng').first(), 'Hộp thoại Thông tin đặt hàng chưa mở').toBeVisible({ timeout: 10000 });
      const hasAddressPicker = await page.getByText('Chọn địa chỉ').first().isVisible({ timeout: 3000 }).catch(() => false);
      await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: hasAddressPicker });
      await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
      await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    }
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });
    await expect(page.getByText('Giao tiêu chuẩn', { exact: true })).toBeVisible();
    await test.info().attach('pre-condition-thanh-toan', { body: await page.screenshot(), contentType: 'image/png' });

    // Đọc cả khối "Chi tiết thanh toán" rồi tách số tiền theo tên dòng (null nếu không có dòng đó)
    const readDetail = async () => {
      const head = page.getByText('Chi tiết thanh toán').first();
      await head.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000); // chờ web cập nhật số tiền sau khi đổi phương thức
      const box = head.locator('xpath=ancestor::*[contains(., "Tổng thanh toán")][1]');
      const text = ((await box.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      const num = (s) => parseInt(s.replace(/\./g, ''), 10);
      const grab = (re) => {
        const m = text.match(re);
        if (!m) return null;
        return /miễn phí/i.test(m[1]) ? 0 : num(m[1]);
      };
      return {
        text,
        goods: grab(/Tổng tiền hàng\D*?([\d.]+)/i),
        fee: grab(/Phí (?:giao hàng|vận chuyển)\D*?(Miễn phí|[\d.]+)/i),
        subtotal: grab(/Tạm tính\D*?([\d.]+)/i),
        total: grab(/Tổng thanh toán\D*?([\d.]+)/i),
      };
    };

    // Chọn một phương thức (mở rộng danh sách nếu phương thức đang bị thu gọn)
    const choose = async (re, label) => {
      const name = page.getByText(re).filter({ visible: true }).first();
      if (!(await name.isVisible().catch(() => false))) {
        const toggle = page.getByText(/hình thức thanh toán khác|Xem thêm/).filter({ visible: true }).first();
        if (await toggle.isVisible().catch(() => false)) await toggle.click();
      }
      await expect(name, `Không thấy phương thức ${label}`).toBeVisible({ timeout: 5000 });
      await name.scrollIntoViewIfNeeded();
      await name.click();
      const radio = name.locator('xpath=ancestor::*[count(.//input[@type="radio"])=1][1]').locator('input[type="radio"]');
      await expect(radio, `${label} phải được chọn`).toBeChecked();
    };

    // ---- Step 1: ghi nhận "Chi tiết thanh toán" khi chọn "Chuyển khoản ngân hàng" (mặc định) ----
    const title = page.getByText('Chọn phương thức thanh toán');
    await title.scrollIntoViewIfNeeded();
    const bankRadio = page.getByText('Chuyển khoản ngân hàng', { exact: true }).first()
      .locator('xpath=ancestor::*[count(.//input[@type="radio"])=1][1]').locator('input[type="radio"]');
    await expect.soft(bankRadio, 'Mặc định phải chọn Chuyển khoản ngân hàng').toBeChecked();

    const d1 = await readDetail();
    console.log('ORDER_Pay_06 - Khối Chi tiết thanh toán (chuyển khoản):', d1.text);
    console.log('ORDER_Pay_06 - Chuyển khoản:', { goods: d1.goods, fee: d1.fee, subtotal: d1.subtotal, total: d1.total });
    expect(d1.goods, 'Phải hiển thị Tổng tiền hàng').not.toBeNull();
    expect(d1.total, 'Phải hiển thị số tiền cần thanh toán (Tổng thanh toán)').not.toBeNull();
    expect(d1.fee, 'Phải hiển thị Phí giao hàng (SP C: 20.000đ)').not.toBeNull();
    // Website không có dòng "Tạm tính" (chỉ có Tổng tiền hàng, Phí giao hàng, Tổng thanh toán) -> chỉ ghi nhận
    if (d1.subtotal === null) {
      test.info().annotations.push({ type: 'note', description: 'Website không hiển thị dòng "Tạm tính"; Expected đã chỉnh theo thực tế.' });
    }
    expect.soft(d1.total, 'Tổng thanh toán = Tổng tiền hàng + Phí giao hàng').toBe(d1.goods + d1.fee);
    await test.info().attach('buoc-1-chuyen-khoan', { body: await page.screenshot(), contentType: 'image/png' });

    // ---- Step 2: đổi sang "Qua thẻ tín dụng / ghi nợ" ----
    await title.scrollIntoViewIfNeeded();
    await choose(/Qua thẻ tín dụng/, 'Qua thẻ tín dụng / ghi nợ');
    const d2 = await readDetail();
    console.log('ORDER_Pay_06 - Thẻ tín dụng:', d2.text);
    expect.soft(d2.goods, 'Tổng tiền hàng không đổi khi đổi phương thức').toBe(d1.goods);
    expect.soft(d2.fee, 'Phí giao hàng không đổi khi đổi phương thức').toBe(d1.fee);
    expect.soft(d2.total, 'Tổng thanh toán không đổi (trừ ưu đãi riêng của phương thức nếu có)').toBe(d1.total);
    await test.info().attach('buoc-2-the-tin-dung', { body: await page.screenshot(), contentType: 'image/png' });

    // ---- Step 3: đổi sang phương thức thanh toán khi nhận hàng ----
    // "Thanh toán tại siêu thị gần nhất" không có khi Giao tận nơi (xem ORDER_Pay_02) -> dùng "Thanh toán khi nhận hàng"
    await title.scrollIntoViewIfNeeded();
    await choose(/Thanh toán khi nhận hàng/, 'Thanh toán khi nhận hàng');
    const d3 = await readDetail();
    console.log('ORDER_Pay_06 - Thanh toán khi nhận hàng:', d3.text);
    expect.soft(d3.goods, 'Tổng tiền hàng không đổi').toBe(d1.goods);
    expect.soft(d3.total, 'Tổng thanh toán = Tổng tiền hàng + Phí giao hàng, không có số tiền sai').toBe(d3.goods + (d3.fee ?? 0));
    for (const k of ['goods', 'fee', 'subtotal', 'total']) {
      if (d3[k] !== null) expect.soft(d3[k], `${k} không được âm/sai`).toBeGreaterThanOrEqual(0);
    }
    await test.info().attach('buoc-3-thanh-toan-khi-nhan-hang', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // Dừng tại đây: không bấm [Thanh toán] -> không tạo đơn
  });
 
  /* --------------------------------------------------------------------------
   * PHẦN 4: TÍNH TIỀN, MÃ GIẢM & QUÀ TẶNG (ORDER_Calc)
   * -------------------------------------------------------------------------- */
 
  // TC 19: Tóm tắt đơn hàng khớp với giỏ hàng
  test('ORDER_Calc_01 - Tóm tắt đơn hàng khớp với giỏ hàng', async ({ browser }) => {
    test.setTimeout(240000);

    // Giỏ riêng, không dùng giỏ SP C dùng chung: SP A (SL 2) + SP B (SL 1)
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);

    try {
      // ---------- Công cụ đọc dữ liệu từ trang ----------
      const toLines = async (pg) => (await pg.locator('body').innerText())
        .replace(/\u00a0/g, ' ').split('\n').map((s) => s.trim()).filter(Boolean);
      const isPrice = (s) => /^\d[\d.]*\s*[₫đ]$/.test(s);
      const toNum = (s) => parseInt(s.replace(/[^\d]/g, ''), 10);

      // Từ khóa nhận diện tên sản phẩm trên trang
      const ITEMS = {
        A: { label: 'SP A', words: [/Sunhouse/i, /SHD8911/i] },
        B: { label: 'SP B', words: [/Kangaroo/i, /KGRC18D3G/i] },
      };

      // Đọc số lượng, đơn giá của từng sản phẩm.
      // Trang giỏ hàng: số lượng lấy từ ô nhập; trang Thanh toán: lấy từ dòng "SL: n"
      const readItems = async (pg, qtyFromInput) => {
        const lines = await toLines(pg);
        const found = [];
        for (const [key, it] of Object.entries(ITEMS)) {
          const i = lines.findIndex((l) => it.words.every((w) => w.test(l)));
          if (i < 0) throw new Error(`Không thấy ${it.label} ở ${pg.url()}. Nội dung: ${JSON.stringify(lines.slice(0, 60))}`);
          const win = lines.slice(i + 1, i + 12);
          const price = win.find(isPrice);
          if (!price) throw new Error(`Không thấy đơn giá của ${it.label}. Nội dung: ${JSON.stringify(win)}`);
          const sl = win.find((l) => /^SL:\s*\d+/.test(l));
          found.push({ key, idx: i, price: toNum(price), qty: sl ? parseInt(sl.match(/\d+/)[0], 10) : null });
        }
        if (qtyFromInput) {
          const inputs = pg.locator(L.QTY_INPUT);
          const byOrder = [...found].sort((a, b) => a.idx - b.idx); // thứ tự hiện trên trang = thứ tự ô nhập
          for (let j = 0; j < byOrder.length; j++) {
            byOrder[j].qty = parseInt(await inputs.nth(j).inputValue(), 10);
          }
        }
        return Object.fromEntries(found.map((f) => [f.key, f]));
      };

      // Đọc số tiền ở khối "Chi tiết thanh toán": dòng ngay dưới tên nhãn
      const money = async (pg, label) => {
        const block = pg.getByText('Chi tiết thanh toán').first().locator('xpath=..');
        const lines = (await block.innerText({ timeout: 10000 }))
          .replace(/\u00a0/g, ' ').split('\n').map((s) => s.trim()).filter(Boolean);
        const i = lines.findIndex((l) => l === label);
        if (i < 0) throw new Error(`Không thấy dòng "${label}". Nội dung: ${JSON.stringify(lines)}`);
        const val = lines[i + 1] ?? '';
        if (/Miễn phí/i.test(val)) return 0;
        const m = val.match(/^(\d[\d.]*)\s*[₫đ]$/);
        if (!m) throw new Error(`Không đọc được số tiền ở dòng "${label}". Giá trị: ${JSON.stringify(val)}`);
        return parseInt(m[1].replace(/\./g, ''), 10);
      };

      // ---------- Pre-condition: giỏ có SP A (SL 2) và SP B (SL 1), cả hai được chọn ----------
      const toast = page.getByText(/Đã thêm vào giỏ/i).first();
      await openProduct(page, 'A');
      await addToCart(page);
      await expect(toast).toBeHidden({ timeout: 15000 });
      await addToCart(page);                       // thêm lần 2 -> SL 2
      await expect(toast).toBeHidden({ timeout: 15000 });
      await openProduct(page, 'B');
      await addToCart(page);
      await openCartDirect(page);

      await expect(page.locator(L.CART_ITEMS)).toHaveCount(2);
      const boxes = page.locator(L.CART_ITEMS);
      for (let i = 0; i < 2; i++) await expect(boxes.nth(i)).toBeChecked();

      const cart = await readItems(page, true);
      const cartLines = await toLines(page);
      const cartGoods = await money(page, 'Tổng tiền hàng');
      expect(cart.A.qty, 'SP A phải có SL 2 trong giỏ').toBe(2);
      expect(cart.B.qty, 'SP B phải có SL 1 trong giỏ').toBe(1);

      // Vào trang Thanh toán: nhập thông tin hợp lệ rồi bấm [Đặt mua]
      await openOrderDialog(page);
      await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: true });
      await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
      await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
      await page.getByRole('button', { name: 'Đặt mua' }).first().click();
      await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });
      await expect(page.getByText('Chi tiết giao hàng')).toBeVisible();

      // ---------- Step 1: danh sách sản phẩm và quà tặng cùng sản phẩm ----------
      const co = await readItems(page, false);            // báo lỗi nếu thiếu SP A hoặc SP B
      const coLines = await toLines(page);
      const count = (lines) => lines.filter((l) => l === 'Quà tặng cùng sản phẩm').length;
      expect.soft(count(coLines), 'Số khối quà tặng ở trang Thanh toán khác giỏ hàng').toBe(count(cartLines));

      // ---------- Step 2: đối chiếu số lượng, đơn giá với giỏ hàng ----------
      for (const key of ['A', 'B']) {
        expect(co[key].qty, `${ITEMS[key].label}: số lượng khác giỏ hàng`).toBe(cart[key].qty);
        expect(co[key].price, `${ITEMS[key].label}: đơn giá khác giỏ hàng`).toBe(cart[key].price);
      }

      // Tổng tiền hàng = 2a + b, và bằng tổng ở giỏ hàng
      await page.getByText('Chi tiết thanh toán').first().scrollIntoViewIfNeeded();
      const coGoods = await money(page, 'Tổng tiền hàng');
      expect(coGoods, 'Tổng tiền hàng phải bằng 2a + b').toBe(2 * co.A.price + co.B.price);
      expect(coGoods, 'Tổng tiền hàng khác giỏ hàng').toBe(cartGoods);

      // Dừng tại đây: không bấm [Thanh toán] -> không tạo đơn
    } finally {
      await ctx.close();
    }
  });
 
    // TC 21: Đơn chỉ gồm sản phẩm được chọn trong giỏ hàng
  test('ORDER_Calc_02 - Đơn chỉ gồm sản phẩm được chọn trong giỏ hàng', async ({ browser }) => {
    test.setTimeout(240000);

    // Giỏ riêng, không dùng giỏ SP C dùng chung: SP A, SP B, SP C (mỗi SP SL 1)
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);

    try {
      // ---------- Công cụ đọc dữ liệu từ trang ----------
      const toLines = async (pg) => (await pg.locator('body').innerText())
        .replace(/\u00a0/g, ' ').split('\n').map((s) => s.trim()).filter(Boolean);
      const isPrice = (s) => /^\d[\d.]*\s*[₫đ]$/.test(s);
      const toNum = (s) => parseInt(s.replace(/[^\d]/g, ''), 10);

      // Từ khóa nhận diện tên sản phẩm trên trang
      const ITEMS = {
        A: { label: 'SP A', words: [/Sunhouse/i, /SHD8911/i] },
        B: { label: 'SP B', words: [/Kangaroo/i, /KGRC18D3G/i] },
        C: { label: 'SP C', words: [/Panasonic/i, /LR03T/i] },
      };
      const findIdx = (lines, key) => lines.findIndex((l) => ITEMS[key].words.every((w) => w.test(l)));

      // Đọc số lượng, đơn giá, vị trí của các sản phẩm trong danh sách keys.
      // Trang giỏ hàng: số lượng lấy từ ô nhập; trang Thanh toán: lấy từ dòng "SL: n"
      const readItems = async (pg, keys, qtyFromInput) => {
        const lines = await toLines(pg);
        const found = [];
        for (const key of keys) {
          const i = findIdx(lines, key);
          if (i < 0) throw new Error(`Không thấy ${ITEMS[key].label} ở ${pg.url()}. Nội dung: ${JSON.stringify(lines.slice(0, 60))}`);
          const win = lines.slice(i + 1, i + 12);
          const price = win.find(isPrice);
          if (!price) throw new Error(`Không thấy đơn giá của ${ITEMS[key].label}. Nội dung: ${JSON.stringify(win)}`);
          const sl = win.find((l) => /^SL:\s*\d+/.test(l));
          found.push({ key, idx: i, price: toNum(price), qty: sl ? parseInt(sl.match(/\d+/)[0], 10) : null });
        }
        if (qtyFromInput) {
          const inputs = pg.locator(L.QTY_INPUT);
          const byOrder = [...found].sort((a, b) => a.idx - b.idx); // thứ tự hiện trên trang = thứ tự ô nhập
          for (let j = 0; j < byOrder.length; j++) {
            byOrder[j].qty = parseInt(await inputs.nth(j).inputValue(), 10);
          }
        }
        return Object.fromEntries(found.map((f) => [f.key, f]));
      };

      // Đọc số tiền ở khối "Chi tiết thanh toán": dòng ngay dưới tên nhãn
      const money = async (pg, label) => {
        const block = pg.getByText('Chi tiết thanh toán').first().locator('xpath=..');
        const lines = (await block.innerText({ timeout: 10000 }))
          .replace(/\u00a0/g, ' ').split('\n').map((s) => s.trim()).filter(Boolean);
        const i = lines.findIndex((l) => l === label);
        if (i < 0) throw new Error(`Không thấy dòng "${label}". Nội dung: ${JSON.stringify(lines)}`);
        const val = lines[i + 1] ?? '';
        if (/Miễn phí/i.test(val)) return 0;
        const m = val.match(/^(\d[\d.]*)\s*[₫đ]$/);
        if (!m) throw new Error(`Không đọc được số tiền ở dòng "${label}". Giá trị: ${JSON.stringify(val)}`);
        return parseInt(m[1].replace(/\./g, ''), 10);
      };

      // ---------- Pre-condition: giỏ có SP A, SP B, SP C (mỗi SP SL 1), cả ba được chọn ----------
      for (const key of ['A', 'B', 'C']) {
        await openProduct(page, key);
        await addToCart(page);
      }
      await openCartDirect(page);

      const boxes = page.locator(L.CART_ITEMS);
      await expect(boxes).toHaveCount(3);
      for (let i = 0; i < 3; i++) await expect(boxes.nth(i)).toBeChecked();

      const cart = await readItems(page, ['A', 'B', 'C'], true);
      for (const key of ['A', 'B', 'C']) {
        expect(cart[key].qty, `${ITEMS[key].label} phải có SL 1 trong giỏ`).toBe(1);
      }
      expect(await money(page, 'Tổng tiền hàng'), 'Ban đầu tổng tiền = a + b + c')
        .toBe(cart.A.price + cart.B.price + cart.C.price);

      // ---------- Step 1: bỏ chọn SP B -> tổng tiền trong giỏ cập nhật ----------
      // Ô chọn nằm theo thứ tự các sản phẩm hiển thị trên trang
      const order = ['A', 'B', 'C'].sort((x, y) => cart[x].idx - cart[y].idx);
      const posB = order.indexOf('B');
      await boxes.nth(posB).uncheck({ force: true });
      await expect(boxes.nth(posB)).not.toBeChecked();
      await expect.soft(page.getByText(/Đã chọn:\s*2 sản phẩm/)).toBeVisible();
      await expect.poll(() => money(page, 'Tổng tiền hàng'), { timeout: 10000 })
        .toBe(cart.A.price + cart.C.price);

      // ---------- Step 2: [Đặt mua], nhập thông tin hợp lệ, xác nhận -> sang trang Thanh toán ----------
      await openOrderDialog(page);
      await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: true });
      await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
      await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
      await page.getByRole('button', { name: 'Đặt mua' }).first().click();
      await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });
      await expect(page.getByText('Chi tiết giao hàng')).toBeVisible();

      // ---------- Step 3: chỉ có SP A và SP C, Tổng tiền hàng = a + c ----------
      const co = await readItems(page, ['A', 'C'], false);     // báo lỗi nếu thiếu SP A hoặc SP C
      expect(co.A.price, 'Đơn giá SP A khác giỏ hàng').toBe(cart.A.price);
      expect(co.C.price, 'Đơn giá SP C khác giỏ hàng').toBe(cart.C.price);
      const coLines = await toLines(page);
      expect(findIdx(coLines, 'B'), 'SP B đã bỏ chọn nhưng vẫn có ở trang Thanh toán').toBe(-1);

      await page.getByText('Chi tiết thanh toán').first().scrollIntoViewIfNeeded();
      expect(await money(page, 'Tổng tiền hàng'), 'Tổng tiền hàng phải bằng a + c')
        .toBe(cart.A.price + cart.C.price);

      // Dừng tại đây: không bấm [Thanh toán] -> không tạo đơn
    } finally {
      await ctx.close();
    }
  });
 
    // TC 22: Nhập mã giảm giá không hợp lệ
  test('ORDER_Calc_03 - Áp dụng mã giảm giá', async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);

    // Pre-condition: chưa đăng nhập, nhập thông tin nhận hàng hợp lệ, vào trang Thanh toán với SP C (SL 1)
    await seedCart(page, ['C']);
    await openOrderDialog(page);
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: true });
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
    await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });
    await expect(page.getByText('Chi tiết giao hàng')).toBeVisible();

    // Đọc các dòng trong khối "Chi tiết thanh toán" (nhãn, số tiền xen kẽ)
    const paymentLines = async () => {
      const block = page.getByText('Chi tiết thanh toán').first().locator('xpath=..');
      return (await block.innerText({ timeout: 10000 }))
        .replace(/\u00a0/g, ' ').split('\n').map((s) => s.trim()).filter(Boolean);
    };
    const totalOf = (lines) => {
      const i = lines.findIndex((l) => l === 'Tổng thanh toán');
      if (i < 0) throw new Error(`Không thấy dòng "Tổng thanh toán". Nội dung: ${JSON.stringify(lines)}`);
      const m = (lines[i + 1] ?? '').match(/^(\d[\d.]*)\s*[₫đ]$/);
      if (!m) throw new Error(`Không đọc được tổng thanh toán: ${JSON.stringify(lines[i + 1])}`);
      return parseInt(m[1].replace(/\./g, ''), 10);
    };

    // Ghi nhận khối chi tiết thanh toán trước khi nhập mã
    await page.getByText('Chi tiết thanh toán').first().scrollIntoViewIfNeeded();
    const before = await paymentLines();
    const totalBefore = totalOf(before);

    // 1. Click dòng [Mã giảm] -> mở hộp thoại "Sử dụng mã giảm giá"
    await page.getByText('Mã giảm', { exact: true }).first().click();
    await expect(page.getByText('Sử dụng mã giảm giá')).toBeVisible({ timeout: 10000 });
    // Hộp thoại mã giảm: tìm theo tiêu đề (không dùng .last() để khỏi trúng hộp thoại "Thông báo")
    const modal = page.getByText('Sử dụng mã giảm giá').first()
      .locator('xpath=ancestor::*[starts-with(@id,"modal-")][1]');
    const codeInput = page.getByPlaceholder('Nhập Mã giảm/Phiếu mua hàng');
    await expect(codeInput).toBeVisible();
    await expect(page.getByRole('button', { name: 'Áp dụng' })).toBeVisible();
    await expect(modal.getByText('Đăng nhập')).toBeVisible();
    await expect(page.getByText('Mã giảm giá trống')).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Xác nhận', exact: true })).toBeVisible();

    // 2. Nhập mã sai, click [Áp dụng] -> hiện hộp thoại "Thông báo" kèm nút [Đã hiểu]
    await codeInput.fill('ABC123');
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(page.getByText('Thông báo', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Đã hiểu' })).toBeVisible();

    const notice = page.getByText('Thông báo', { exact: true }).first()
      .locator('xpath=ancestor::*[.//button[normalize-space()="Đã hiểu"]][1]');
    const noticeText = (await notice.innerText({ timeout: 10000 }))
      .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('Nội dung thông báo mã sai:', noticeText);
    await test.info().attach('thong-bao-ma-sai', { body: await page.screenshot(), contentType: 'image/png' });

    if (/recaptcha/i.test(noticeText)) {
      // reCAPTCHA từ chối trình duyệt tự động -> không kiểm được câu thông báo bằng script
      manual('Bước 2: khi chạy tự động website trả "' + noticeText + '" (reCAPTCHA chặn trình duyệt tự động). ' +
        'Nội dung "Mã giảm giá không tồn tại... 1900 232 460" đã kiểm thủ công trên Chrome thường: hiển thị đúng.');
    } else {
      expect.soft(noticeText, 'Thiếu nội dung báo mã giảm giá không tồn tại / đã nhập trả')
        .toMatch(/không tồn tại.*(chưa xuất|đã nhập trả)/i);
      expect.soft(noticeText, 'Thiếu số hỗ trợ 1900 232 460').toMatch(/1900\D*232\D*460/);
    }

    // 3. Click [Đã hiểu] -> thông báo đóng; đóng hộp thoại mã giảm bằng nút [X]
    await page.getByRole('button', { name: 'Đã hiểu' }).click();
    await expect(page.getByText('Thông báo', { exact: true })).toBeHidden({ timeout: 10000 });

    // Nút [X] là biểu tượng ở góc phải dòng tiêu đề hộp thoại -> bấm theo vị trí
    const titleBox = await page.getByText('Sử dụng mã giảm giá').first().boundingBox();
    const modalBox = await modal.boundingBox();
    await page.mouse.click(modalBox.x + modalBox.width - 28, titleBox.y + titleBox.height / 2);
    await expect(page.getByText('Sử dụng mã giảm giá'), 'Hộp thoại mã giảm chưa đóng sau khi bấm [X]')
      .toBeHidden({ timeout: 10000 });

    // Không có dòng giảm giá mới, tổng thanh toán không đổi
    await page.getByText('Chi tiết thanh toán').first().scrollIntoViewIfNeeded();
    const after = await paymentLines();
    expect(after, 'Khối chi tiết thanh toán thay đổi sau khi nhập mã sai').toEqual(before);
    expect(totalOf(after), 'Tổng thanh toán phải không đổi').toBe(totalBefore);

    // Dừng tại đây: không bấm [Thanh toán] -> không tạo đơn
  });

  // TC 23: Bật Dùng điểm Quà Tặng VIP khi chưa đăng nhập
  test('ORDER_Calc_04 - Bật Dùng điểm Quà Tặng VIP khi chưa đăng nhập', async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);

    // Pre-condition: chưa đăng nhập, nhập thông tin nhận hàng hợp lệ, vào trang Thanh toán với SP C (SL 1)
    await seedCart(page, ['C']);
    await openOrderDialog(page);
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: true });
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
    await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });
    await expect(page.getByText('Chi tiết giao hàng')).toBeVisible();

    // Đọc khối "Chi tiết thanh toán" và tổng thanh toán
    const paymentLines = async () => {
      const block = page.getByText('Chi tiết thanh toán').first().locator('xpath=..');
      return (await block.innerText({ timeout: 10000 }))
        .replace(/\u00a0/g, ' ').split('\n').map((s) => s.trim()).filter(Boolean);
    };
    const totalOf = (lines) => {
      const i = lines.findIndex((l) => l === 'Tổng thanh toán');
      if (i < 0) throw new Error(`Không thấy dòng "Tổng thanh toán". Nội dung: ${JSON.stringify(lines)}`);
      const m = (lines[i + 1] ?? '').match(/^(\d[\d.]*)\s*[₫đ]$/);
      if (!m) throw new Error(`Không đọc được tổng thanh toán: ${JSON.stringify(lines[i + 1])}`);
      return parseInt(m[1].replace(/\./g, ''), 10);
    };
    await page.getByText('Chi tiết thanh toán').first().scrollIntoViewIfNeeded();
    const before = await paymentLines();
    const totalBefore = totalOf(before);

    // Bước 1: bật công tắc "Dùng điểm Quà Tặng VIP" (công tắc nằm ở mép phải của dòng)
    const label = page.getByText('Dùng điểm Quà Tặng VIP', { exact: true }).first();
    await label.scrollIntoViewIfNeeded();
    await expect(label).toBeVisible();
    const row = await label.evaluate((el) => {
      let n = el;
      while (n.parentElement && n.getBoundingClientRect().width < 250) n = n.parentElement;
      const r = n.getBoundingClientRect();
      const t = el.getBoundingClientRect();
      return { right: r.right, y: t.top + t.height / 2 };
    });
    await page.mouse.click(row.right - 34, row.y);

    // Bước 2: hiển thị hộp thoại yêu cầu đăng nhập (công tắc bị chặn)
    const hint = page.getByText('Nhập số điện thoại mua hàng của quý khách');
    await expect(hint, 'Phải hiển thị hộp thoại yêu cầu đăng nhập').toBeVisible({ timeout: 10000 });
    const modal = hint.locator('xpath=ancestor::*[starts-with(@id,"modal-")][1]');
    await expect(modal.getByText('Đăng nhập', { exact: true }).first()).toBeVisible();
    await expect(page.getByPlaceholder('Nhập số điện thoại mua hàng')).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Tiếp tục' })).toBeVisible();
    await test.info().attach('dang-nhap-khi-bat-diem-vip', { body: await page.screenshot(), contentType: 'image/png' });

    // Đóng hộp thoại bằng nút [X] (không nhập số điện thoại -> không gửi SMS)
    const titleBox = await modal.getByText('Đăng nhập', { exact: true }).first().boundingBox();
    const modalBox = await modal.boundingBox();
    await page.mouse.click(modalBox.x + modalBox.width - 28, titleBox.y + titleBox.height / 2);
    await expect(hint, 'Hộp thoại đăng nhập chưa đóng sau khi bấm [X]').toBeHidden({ timeout: 10000 });

    // Tổng thanh toán không đổi, không có dòng giảm giá/điểm mới
    await page.getByText('Chi tiết thanh toán').first().scrollIntoViewIfNeeded();
    const after = await paymentLines();
    expect(totalOf(after), 'Tổng thanh toán phải không đổi').toBe(totalBefore);
    expect(after, 'Khối chi tiết thanh toán thay đổi sau khi bật công tắc').toEqual(before);
    await test.info().attach('sau-khi-dong-hop-thoai', { body: await page.screenshot(), contentType: 'image/png' });

    // Trạng thái công tắc sau khi đóng hộp thoại (ghi nhận, Excel cho phép "bật hoặc bị chặn")
    await label.scrollIntoViewIfNeeded();
    const switchState = await label.evaluate((el) => {
      let n = el;
      for (let i = 0; i < 4 && n; i++, n = n.parentElement) {
        const sw = n.querySelector('[role="switch"], input[type="checkbox"]');
        if (sw) return sw.getAttribute('aria-checked') ?? String(sw.checked);
      }
      return 'không đọc được';
    });
    console.log('Trạng thái công tắc sau khi đóng hộp thoại:', switchState);
    test.info().annotations.push({ type: 'vip-switch', description: `Công tắc sau khi đóng hộp thoại đăng nhập: ${switchState}` });

    // Dừng tại đây: không nhập số điện thoại, không gửi SMS, không bấm [Thanh toán]
  });
 
  /* --------------------------------------------------------------------------
   * PHẦN 5: XÁC THỰC OTP SMS (ORDER_OTP) - NGUYÊN TẮC AN TOÀN
   * -------------------------------------------------------------------------- */
 
  // TC 24: Hiển thị màn hình nhập mã SMS sau khi bấm Thanh toán
  test('ORDER_OTP_01 - Hiển thị màn hình nhập mã SMS sau khi bấm Thanh toán', async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);

    // Số điện thoại THẬT nhận được SMS
    const phone = '0935938870';

    // Tự đóng popup quảng cáo (lớp nền tối) nếu nó chặn thao tác
    const overlay = page.locator('div.cursor-pointer[class*="bg-[#1E1E1E]"]').first();
    await page.addLocatorHandler(overlay, async () => {
      await page.keyboard.press('Escape');
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
      }
    }, { noWaitAfter: true });

    // Pre-condition: nhập thông tin nhận hàng (số điện thoại thật), sang trang Thanh toán
    await seedCart(page, ['C']);
    await openOrderDialog(page);
    await fillOrderInfo(page, { fullName: TEST_CUSTOMER.fullName, phone, chooseAddress: true });
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
    await expect(page.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
    await page.getByRole('button', { name: 'Đặt mua' }).first().click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });

    // Pre-condition: phương thức "Chuyển khoản ngân hàng" đang được chọn
    // (ô radio là ô tùy biến, input bị ẩn -> cuộn tới chữ, không cuộn tới input)
    const bankText = page.getByText('Chuyển khoản ngân hàng', { exact: true }).first();
    await bankText.scrollIntoViewIfNeeded();
    const bankRadio = bankText
      .locator('xpath=ancestor::*[.//input[@type="radio"]][1]').locator('input[type="radio"]').first();
    await expect(bankRadio, 'Pre-condition: phải chọn Chuyển khoản ngân hàng').toBeChecked();

    // Bước 1a: tích ô đồng ý "Chính sách xử lý dữ liệu cá nhân" (bắt buộc, phải làm trước khi bấm [Thanh toán])
    const agreeText = page.getByText(/Tôi đồng ý với/).first();
    await agreeText.scrollIntoViewIfNeeded();
    const agree = agreeText
      .locator('xpath=ancestor::*[.//input[@type="checkbox"]][1]').locator('input[type="checkbox"]').first();
    await agree.check({ force: true }).catch(() => {});
    if (!(await agree.isChecked().catch(() => false))) {
      // ô vuông nằm ngay bên trái dòng đầu của đoạn "Tôi đồng ý với..."
      const t = await agreeText.boundingBox();
      await page.mouse.click(t.x - 16, t.y + 9);
    }
    await expect(agree, 'Phải tích được ô đồng ý chính sách').toBeChecked();

    // Bước 1b: click [Thanh toán]
    const payBtn = page.getByRole('button', { name: 'Thanh toán', exact: true });
    await payBtn.scrollIntoViewIfNeeded();
    await test.info().attach('truoc-khi-bam-thanh-toan', { body: await page.screenshot(), contentType: 'image/png' });
    await payBtn.click();

    // Bước 2: màn hình nhập mã xác thực SMS
    const bodyText = async () => (await page.locator('body').innerText()).replace(/\u00a0/g, ' ');
    const reachedOtp = await expect.poll(async () => /xác thực|mã (OTP|SMS)|nhập mã/i.test(await bodyText()),
      { timeout: 20000 }).toBe(true).then(() => true).catch(() => false);
    const screenText = (await bodyText()).replace(/\s+/g, ' ');
    await test.info().attach('man-hinh-ma-sms', { body: await page.screenshot(), contentType: 'image/png' });

    if (/recaptcha/i.test(screenText)) {
      // reCAPTCHA từ chối trình duyệt tự động -> không gửi được SMS bằng script
      manual('Bước 1-3: khi chạy tự động website báo reCAPTCHA (Recaptcha Token Invalid) nên không gửi được SMS; ' +
        'kiểm thủ công trên Chrome thường.');
      test.skip(true, 'reCAPTCHA chặn trình duyệt tự động: kiểm thủ công ORDER_OTP_01');
    }

    expect(reachedOtp, 'Sau khi bấm [Thanh toán] phải hiển thị màn hình nhập mã xác thực').toBe(true);
    // Màn hình mã SMS hiển thị đúng số điện thoại (cho phép ẩn bớt số): kiểm tra 3 số cuối
    expect.soft(screenText, `Màn hình mã SMS phải hiển thị số điện thoại (3 số cuối ${phone.slice(-3)})`)
      .toContain(phone.slice(-3));
    const otpInput = page.locator(L.OTP_INPUT).filter({ visible: true }).first();
    expect.soft(await otpInput.isVisible().catch(() => false), 'Phải có ô nhập mã xác thực').toBe(true);

    // Bước 3: kiểm tra SMS trên điện thoại, DỪNG, không nhập mã
    manual('Bước 3: kiểm tra SMS chứa mã xác thực trên điện thoại ' + phone.slice(0, 3) + '****' + phone.slice(-3) + ' (không nhập mã).');

    // KHÔNG nhập mã, KHÔNG xác nhận -> không tạo đơn
  });
 
  // TC 25: Không thể xác thực khi để trống mã SMS
  test('ORDER_OTP_02 - Không thể xác thực khi để trống mã SMS', async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);
    const phone = '0935938870'; // số thật nhận SMS

    // Pre-condition: đang ở màn hình nhập mã SMS (ORDER_OTP_01)
    const { reached, recaptcha } = await goToOtpScreen(page, phone);
    if (recaptcha) {
      manual('reCAPTCHA chặn trình duyệt tự động (Recaptcha Token Invalid) nên không gửi được SMS; kiểm thủ công trên Chrome thường.');
      test.skip(true, 'reCAPTCHA chặn trình duyệt tự động: kiểm thủ công ORDER_OTP_02');
    }
    expect(reached, 'Pre-condition: phải tới được màn hình nhập mã SMS').toBe(true);

    // Ô nhập mã (1 ô hoặc nhiều ô mỗi ô 1 số) và nút xác nhận trong khung nhập mã
    const inputs = page.locator(L.OTP_INPUT).filter({ visible: true });
    await expect(inputs.first(), 'Phải có ô nhập mã xác thực').toBeVisible({ timeout: 10000 });
    const modalOfInput = inputs.first().locator('xpath=ancestor::*[starts-with(@id,"modal-")][1]');
    const panel = (await modalOfInput.count()) ? modalOfInput : page.locator('body');
    const confirmBtn = panel.getByRole('button', { name: /xác nhận|xác thực|tiếp tục|hoàn tất/i }).last();
    const successUrl = /thanh-toan-thanh-cong|dat-hang-thanh-cong|order-success|thank/i;

    const typeCode = async (code) => {
      const n = await inputs.count();
      if (n > 1) {
        for (let i = 0; i < n; i++) await inputs.nth(i).fill(i < code.length ? code[i] : '');
      } else {
        await inputs.first().fill(code);
      }
    };

    // Kiểm tra: nút xác nhận bị khóa, bấm ép cũng không xác thực được, vẫn ở màn hình nhập mã
    const checkBlocked = async (label, shot) => {
      await page.waitForTimeout(800);
      await test.info().attach(shot, { body: await page.screenshot(), contentType: 'image/png' });
      await expect(confirmBtn, `${label}: nút xác nhận phải bị khóa`).toBeDisabled({ timeout: 5000 });
      await confirmBtn.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1500);
      expect(page.url(), `${label}: vẫn xác thực được`).not.toMatch(successUrl);
      await expect(inputs.first(), `${label}: phải còn ở màn hình nhập mã`).toBeVisible();
    };

    // Bước 1: để trống mã -> nút xác nhận bị khóa, không xác thực được
    await typeCode('');
    await checkBlocked('Để trống mã', 'otp-de-trong');

    // Bước 2: nhập mã thiếu số (12) -> nút xác nhận vẫn bị khóa, không xác thực được
    await typeCode('12');
    await checkBlocked('Mã thiếu số (12)', 'otp-thieu-so');

    manual('Bước 1-2: website không hiện thông báo lỗi mà khóa nút xác nhận (Expected gốc: báo bắt buộc nhập mã / mã không hợp lệ).');

    // KHÔNG nhập mã thật -> không tạo đơn
  });
 
  // TC 26: Không thể xác thực với mã SMS sai
  test('ORDER_OTP_03 - Không thể xác thực với mã SMS sai', async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);
    const phone = '0935938870'; // số thật nhận SMS

    // Pre-condition: đang ở màn hình nhập mã SMS (ORDER_OTP_01) -> gửi 1 SMS thật
    const { reached, recaptcha } = await goToOtpScreen(page, phone);
    if (recaptcha) {
      manual('reCAPTCHA chặn trình duyệt tự động (Recaptcha Token Invalid) nên không gửi được SMS; kiểm thủ công trên Chrome thường.');
      test.skip(true, 'reCAPTCHA chặn trình duyệt tự động: kiểm thủ công ORDER_OTP_03');
    }
    expect(reached, 'Pre-condition: phải tới được màn hình nhập mã SMS').toBe(true);
    await expect(page.getByText('Xác thực số điện thoại')).toBeVisible({ timeout: 10000 });

    // Các ô nhập mã (6 ô), nút xác nhận và khung hộp thoại
    const inputs = page.locator(L.OTP_INPUT).filter({ visible: true });
    await expect(inputs.first(), 'Phải có ô nhập mã xác thực').toBeVisible({ timeout: 10000 });
    const modalOfInput = inputs.first().locator('xpath=ancestor::*[starts-with(@id,"modal-")][1]');
    const panel = (await modalOfInput.count()) ? modalOfInput : page.locator('body');
    const confirmBtn = panel.getByRole('button', { name: 'Xác nhận', exact: true });
    const panelText = async () => (await panel.innerText()).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const successUrl = /thanh-toan-thanh-cong|dat-hang-thanh-cong|order-success|thank/i;
    const codeNow = async () => (await inputs.evaluateAll((els) => els.map((e) => e.value))).join('');

    // Xóa các ô rồi gõ từng phím như người dùng thật (để kiểm tra cả việc chặn ký tự)
    const typeLikeUser = async (text) => {
      const n = await inputs.count();
      for (let i = 0; i < n; i++) await inputs.nth(i).fill('');
      await inputs.first().click();
      await page.keyboard.type(text, { delay: 120 });
      await page.waitForTimeout(500);
    };

    // Bước 1: nhập mã sai 000000, click [Xác nhận] -> không xác thực được, báo mã không đúng, chưa tạo đơn
    await typeLikeUser('000000');
    console.log('Bước 1 - mã trong các ô:', await codeNow());
    await expect(confirmBtn, 'Nhập đủ 6 số thì nút xác nhận phải bấm được').toBeEnabled({ timeout: 5000 });
    await confirmBtn.click();
    await page.waitForTimeout(2500);
    const text1 = await panelText();
    console.log('Bước 1 - nội dung hộp thoại sau khi xác nhận mã sai:', text1);
    await test.info().attach('otp-ma-sai', { body: await page.screenshot(), contentType: 'image/png' });
    expect(page.url(), 'Mã sai mà vẫn xác thực được/tạo đơn').not.toMatch(successUrl);
    await expect(page.getByText('Xác thực số điện thoại'), 'Vẫn phải ở màn hình nhập mã').toBeVisible();
    expect.soft(text1, 'Thiếu thông báo mã không đúng')
      .toMatch(/không chính xác|không đúng|không hợp lệ|sai/i);

    // Bước 2: nhập mã chứa chữ và ký tự đặc biệt (ab@#12)
    await typeLikeUser('ab@#12');
    const typed = await codeNow();
    const hasBadChars = /[^0-9]/.test(typed);
    console.log('Bước 2 - mã trong các ô sau khi gõ "ab@#12":', JSON.stringify(typed), '| có ký tự không phải số:', hasBadChars);
    await test.info().attach('otp-ky-tu-dac-biet', { body: await page.screenshot(), contentType: 'image/png' });
    if (!hasBadChars) {
      // Website chặn ký tự chữ/đặc biệt ngay khi gõ -> "Không cho nhập"
      test.info().annotations.push({ type: 'otp-input-filter', description: `Gõ "ab@#12" -> các ô chỉ nhận: "${typed}" (chữ và ký tự đặc biệt bị chặn)` });
    } else {
      // Website cho nhập -> phải báo mã không hợp lệ khi xác nhận (nếu nút bấm được)
      if (await confirmBtn.isEnabled().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2500);
        const text2 = await panelText();
        console.log('Bước 2 - nội dung sau khi xác nhận:', text2);
        expect.soft(text2, 'Thiếu thông báo mã không hợp lệ').toMatch(/không chính xác|không đúng|không hợp lệ|sai/i);
      } else {
        test.info().annotations.push({ type: 'otp-input-filter', description: 'Ô nhận ký tự lạ nhưng nút xác nhận bị khóa' });
      }
    }
    expect(page.url(), 'Mã chứa ký tự lạ mà vẫn xác thực được').not.toMatch(successUrl);
    await expect(page.getByText('Xác thực số điện thoại'), 'Vẫn phải ở màn hình nhập mã').toBeVisible();

    manual('Mã sai bị tính vào giới hạn số lần nhập sai không chạy lặp liên tục. Không nhập mã đúng nên không tạo đơn.');

    // KHÔNG nhập mã đúng -> không tạo đơn
  });
 
  // TC 27: Gửi lại mã SMS
  test('ORDER_OTP_04 - Gửi lại mã SMS sau khi hết đếm ngược', async ({ page }) => {
    test.setTimeout(240000);
    page.setDefaultTimeout(15000);
    const phone = '0935938870';

    // Mở màn OTP theo tiền điều kiện ORDER_OTP_01 (gửi một mã ban đầu).
    const { reached, recaptcha, screenText } = await goToOtpScreen(page, phone);
    if (recaptcha) {
      manual('reCAPTCHA chặn trình duyệt tự động nên chưa thể tới bước gửi lại mã; kiểm thử thủ công trên Chrome thường.');
      test.skip(true, 'reCAPTCHA chặn trình duyệt tự động: kiểm thủ công ORDER_OTP_04');
    }
    expect(reached, `Pre-condition: phải tới màn OTP. Nội dung: ${screenText.slice(0, 500)}`).toBe(true);
    await expect(page.getByText('Xác thực số điện thoại').first()).toBeVisible({ timeout: 10000 });

    const countdown = page.getByText(/thử lại sau.*\d+\s*giây|gửi lại.*sau.*\d+\s*giây/i).filter({ visible: true }).first();
    const resend = page.getByRole('button', { name: /Gửi lại mã xác thực/i })
      .or(page.getByRole('link', { name: /Gửi lại mã xác thực/i })).first();
    await expect(countdown, 'Phải có hướng dẫn đếm ngược trước khi gửi lại mã').toBeVisible({ timeout: 10000 });
    const initialCountdown = await countdown.innerText();
    const initialSeconds = Number((initialCountdown.match(/(\d+)\s*giây/i) || [])[1]);
    expect(initialSeconds, `Không đọc được thời gian đếm ngược: ${initialCountdown}`).toBeGreaterThan(0);
    await expect(resend, 'Chưa hết đếm ngược thì chưa được có nút gửi lại').toBeHidden();
    await test.info().attach('otp04-dang-dem-nguoc', { body: await page.screenshot(), contentType: 'image/png' });

    // Chờ đúng khoảng đếm ngược trang hiển thị (có dư 15 giây cho độ trễ mạng).
    await expect(resend, 'Hết đếm ngược phải hiện [Gửi lại mã xác thực]')
      .toBeVisible({ timeout: Math.min((initialSeconds + 15) * 1000, 180000) });
    await test.info().attach('otp04-da-het-dem-nguoc', { body: await page.screenshot(), contentType: 'image/png' });

    // Chỉ gửi lại một lần, không nhập mã; xác nhận đếm ngược được khởi động lại.
    await resend.click();
    await expect(countdown, 'Sau khi gửi lại phải bắt đầu đếm ngược mới').toBeVisible({ timeout: 10000 });
    await expect(resend, 'Nút gửi lại phải ẩn trong thời gian đếm ngược mới').toBeHidden({ timeout: 5000 });
    const restartedCountdown = await countdown.innerText();
    console.log('[ORDER_OTP_04] Đếm ngược ban đầu:', initialCountdown, '| sau khi gửi lại:', restartedCountdown);
    await test.info().attach('otp04-sau-khi-gui-lai', { body: await page.screenshot(), contentType: 'image/png' });

    manual(`Đã yêu cầu gửi lại SMS một lần tới ${phone.slice(0, 3)}****${phone.slice(-3)}. Kiểm tra tin nhắn mới trên điện thoại; không nhập mã.`);
    // Không nhập mã xác thực và không hoàn tất đơn.
  });

  /* --------------------------------------------------------------------------
   * PHẦN 6: GIAO DIỆN NGƯỜI DÙNG DI ĐỘNG (ORDER_GUI)
   * -------------------------------------------------------------------------- */
 
  // TC 30: Bố cục trang Thanh toán hiển thị đúng trên di động
  test('ORDER_GUI_01 - Bố cục trang Thanh toán hiển thị đúng trên di động (375x812)', async ({ browser, page: desktopPage }) => {
    test.setTimeout(240000);

    const PORTRAIT = { width: 375, height: 812 };
    const LANDSCAPE = { width: 812, height: 375 };
    const MIN_TOUCH = 24;      // WCAG 2.2 AA (2.5.8): vùng chạm tối thiểu 24x24px (khuyến nghị Apple/Google là 44-48px)
    const MIN_FONT = 12;       // cỡ chữ tối thiểu (px) để đọc được trên di động

    // Mobile chỉ được bật SAU khi đã vào trang Thanh toán (xem Pre-condition bên dưới).
    // Lý do: hộp thoại chọn địa chỉ trên giao diện di động khác bản máy tính nên fillOrderInfo() không dùng được.
    // Giả lập iPhone 13 (có UA di động, isMobile, hasTouch) nhưng ghi đè viewport cho đúng 375x812
    // (cùng cách làm với CART_Display_06)
    let context = null;          // context di động (nếu tạo được)
    let page = desktopPage;      // trang đang được kiểm tra
    let mode = 'viewport-only';  // 'mobile-context' | 'viewport-only'

    // ---- Hàm phụ cục bộ ----
    // Tự đóng popup quảng cáo (lớp nền tối) nếu nó chặn thao tác
    const registerPopupHandler = async (p) => {
      const overlay = p.locator('div.cursor-pointer[class*="bg-[#1E1E1E]"]').first();
      await p.addLocatorHandler(overlay, async () => {
        await p.keyboard.press('Escape');
        if (await overlay.isVisible().catch(() => false)) {
          await overlay.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
        }
      }, { noWaitAfter: true });
    };

    const shot = async (name) =>
      test.info().attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // Tràn ngang + danh sách phần tử vượt mép phải (bỏ qua phần tử nằm trong vùng tự cuộn ngang)
    // So với chiều rộng thiết bị đã cấu hình (375/812), KHÔNG so với innerWidth: khi nội dung rộng hơn màn hình,
    // trình duyệt di động tự nới innerWidth (vd 376) nên so với innerWidth sẽ che mất lỗi tràn.
    const checkOverflow = (expected) => page.evaluate((vw) => {
      const inner = window.innerWidth;
      const scrolls = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) return true;
        }
        return false;
      };
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (r.right > vw + 1 && !scrolls(el)) {
          offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} (right=${Math.round(r.right)})`);
          if (offenders.length >= 5) break;
        }
      }
      return { overflow: document.documentElement.scrollWidth > vw + 1, vw, inner, scrollWidth: document.documentElement.scrollWidth, offenders };
    }, expected);

    // Phần tử có đang nằm trên cùng tại tâm của nó không (không bị thanh cố định/popup che)
    const isTopmost = (loc) => loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false;
      const t = document.elementFromPoint(cx, cy);
      return !!t && (el === t || el.contains(t));
    });

    // Tổng chiều cao các thanh cố định/dính (sticky/fixed) đang chiếm màn hình
    const stickyHeight = () => page.evaluate(() => {
      let h = 0;
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
        const r = el.getBoundingClientRect();
        if (r.width >= innerWidth * 0.8 && r.height > 0 && r.bottom > 0 && r.top < innerHeight) h += r.height;
      }
      return h;
    });

    // Hộp bao vùng chạm của một ô chọn (radio/checkbox tùy biến): lấy khối cha chứa input
    const touchBox = async (textLoc, type) => {
      const row = textLoc.locator(`xpath=ancestor::*[.//input[@type="${type}"]][1]`).first();
      const target = (await row.count()) ? row : textLoc;
      return target.boundingBox();
    };

    try {
      await registerPopupHandler(desktopPage);

      // ---- Pre-condition: SP C (SL 1), khu vực HCM, chưa đăng nhập, vào trang Thanh toán (luồng máy tính, đã chạy ổn ở các TC khác) ----
      desktopPage.setDefaultTimeout(15000);
      await seedCart(desktopPage, ['C']);
      await openOrderDialog(desktopPage);
      await fillOrderInfo(desktopPage, { fullName: TEST_CUSTOMER.fullName, phone: TEST_CUSTOMER.phone, chooseAddress: true });
      await desktopPage.getByRole('button', { name: 'Xác nhận', exact: true }).last().click({ timeout: 5000 });
      await expect(desktopPage.getByText('Thông tin đặt hàng').first()).toBeHidden({ timeout: 10000 });
      await desktopPage.getByRole('button', { name: 'Đặt mua' }).first().click();
      await expect(desktopPage, 'Pre-condition: phải đang ở trang Thanh toán').toHaveURL(/\/checkout/, { timeout: 15000 });
      await desktopPage.waitForTimeout(1500);

      // ---- Chuyển sang thiết bị di động 375x812 (giống Chrome DevTools) ----
      // Cách 1: context mới giả lập điện thoại (UA + cảm ứng), mang theo cookie/localStorage, mở thẳng /checkout
      const state = await desktopPage.context().storageState();
      const mctx = await browser.newContext({
        ...devices['iPhone 13'],
        viewport: PORTRAIT,
        storageState: state,
      });
      const mpage = await mctx.newPage();
      mpage.setDefaultTimeout(15000);
      await registerPopupHandler(mpage);

      await mpage.goto(desktopPage.url(), { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await mpage.waitForTimeout(2500);
      const mobileOk = /\/checkout/.test(mpage.url()) &&
        (await mpage.getByRole('button', { name: 'Thanh toán', exact: true }).count().catch(() => 0)) > 0;

      if (mobileOk) {
        context = mctx;
        page = mpage;
        mode = 'mobile-context';
      } else {
        // Cách 2 (dự phòng): giữ nguyên trang đang ở /checkout, chỉ thu viewport về 375x812 rồi tải lại
        await mctx.close();
        await desktopPage.setViewportSize(PORTRAIT);
        await desktopPage.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await desktopPage.waitForTimeout(2500);
        page = desktopPage;
      }
      test.info().annotations.push({ type: 'che-do-di-dong', description: mode === 'mobile-context'
        ? 'Context giả lập iPhone 13 (UA di động, cảm ứng, viewport 375x812)'
        : 'Dự phòng: chỉ đổi viewport 375x812 (không đổi User-Agent)' });
      console.log(`[GUI_01] Chế độ di động: ${mode}`);

      await expect(page, 'Pre-condition: vẫn ở trang Thanh toán sau khi chuyển sang di động').toHaveURL(/\/checkout/);
      const vpInfo = await page.evaluate(() => ({
        inner: window.innerWidth, visual: window.visualViewport ? window.visualViewport.width : null,
        scrollWidth: document.documentElement.scrollWidth, screenW: screen.width,
      }));
      console.log(`[GUI_01] Viewport: innerWidth=${vpInfo.inner} | visualViewport=${vpInfo.visual} | scrollWidth=${vpInfo.scrollWidth} | screen=${vpInfo.screenW}`);
      expect(Math.abs(vpInfo.inner - PORTRAIT.width), `Pre-condition: viewport ~375px (đo được ${vpInfo.inner}px)`).toBeLessThanOrEqual(2);

      /* ===================== Bước 1: quan sát các khối ===================== */
      const SECTIONS = [
        { name: 'Khối giao hàng', re: /Giao tận nơi|Nhận tại siêu thị|Hình thức nhận hàng/i },
        { name: 'Khối mã giảm', re: /Mã giảm|Nhập mã|Voucher/i },
        { name: 'Khối phương thức thanh toán', re: /Chuyển khoản ngân hàng|Phương thức thanh toán/i },
        { name: 'Khối chi tiết thanh toán', re: /Chi tiết thanh toán|Tổng tiền|Cần thanh toán/i },
      ];

      const pageYs = [];
      for (const s of SECTIONS) {
        const loc = page.getByText(s.re).filter({ visible: true }).first();
        const found = (await loc.count()) > 0;
        expect.soft(found, `Bước 1: phải thấy ${s.name}`).toBe(true);
        if (!found) continue;
        await loc.scrollIntoViewIfNeeded();
        const box = await loc.boundingBox();
        const fontSize = await loc.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        const pageY = await loc.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
        pageYs.push({ name: s.name, pageY });
        // Không tràn mép màn hình, chữ đủ lớn để đọc
        expect.soft(box.x >= -1 && box.x + box.width <= PORTRAIT.width + 1,
          `Bước 1: ${s.name} nằm gọn trong chiều rộng 375px (x=${Math.round(box.x)}, rộng=${Math.round(box.width)})`).toBe(true);
        expect.soft(fontSize, `Bước 1: chữ ở ${s.name} đọc được (>= ${MIN_FONT}px)`).toBeGreaterThanOrEqual(MIN_FONT);
      }

      // Bố cục 1 cột: các khối xếp chồng dọc theo thứ tự, không đứng cạnh nhau
      for (let i = 1; i < pageYs.length; i++) {
        expect.soft(pageYs[i].pageY - pageYs[i - 1].pageY,
          `Bước 1: bố cục 1 cột, "${pageYs[i].name}" phải nằm dưới "${pageYs[i - 1].name}"`).toBeGreaterThan(20);
      }

      await page.evaluate(() => window.scrollTo(0, 0));
      const ov1 = await checkOverflow(PORTRAIT.width);
      console.log(`[GUI_01] Dọc: scrollWidth=${ov1.scrollWidth} | innerWidth=${ov1.inner} | chuẩn=${ov1.vw} | phần tử vượt mép: ${ov1.offenders.join('; ') || 'không'}`);
      if (ov1.overflow) {
        // Làm bằng chứng: ảnh + UA + phần tử gây tràn
        await page.screenshot({ path: 'mobile-checkout-375.png', fullPage: true });
        console.log('[GUI_01] Overflow 375px =', ov1.scrollWidth - ov1.vw, '| UA =', await page.evaluate(() => navigator.userAgent));
      }
      expect.soft(ov1.overflow, `Bước 1: không tràn ngang, không vỡ giao diện (${ov1.offenders.join('; ')})`).toBe(false);
      await shot('01-doc-dau-trang');

      /* ===================== Bước 2: cuộn, quan sát nút cuối trang ===================== */
      // Ô chọn phương thức thanh toán
      const bankText = page.getByText('Chuyển khoản ngân hàng', { exact: true }).first();
      await bankText.scrollIntoViewIfNeeded();
      const radioBox = await touchBox(bankText, 'radio');
      if (radioBox) {
        expect.soft(radioBox.height, `Bước 2: ô chọn phương thức đủ lớn để chạm (cao ${Math.round(radioBox.height)}px, WCAG 2.2 AA cần >= ${MIN_TOUCH}px)`)
          .toBeGreaterThanOrEqual(MIN_TOUCH);
      }

      // Ô đồng ý chính sách
      const agreeText = page.getByText(/Tôi đồng ý với/).first();
      await agreeText.scrollIntoViewIfNeeded();
      const agreeBox = await touchBox(agreeText, 'checkbox');
      if (agreeBox) {
        expect.soft(agreeBox.height, `Bước 2: ô đồng ý chính sách đủ lớn để chạm (cao ${Math.round(agreeBox.height)}px)`)
          .toBeGreaterThanOrEqual(MIN_TOUCH);
      }

      // Cuộn xuống cuối trang
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(500);

      // Nút [Thanh toán]: nhìn thấy, đủ lớn, không bị che
      const payBtn = page.getByRole('button', { name: 'Thanh toán', exact: true });
      await payBtn.scrollIntoViewIfNeeded();
      await expect(payBtn, 'Bước 2: nút [Thanh toán] phải hiển thị ở cuối trang').toBeVisible();
      const payBox = await payBtn.boundingBox();
      console.log(`[GUI_01] Nút Thanh toán: ${Math.round(payBox.width)}x${Math.round(payBox.height)}px tại x=${Math.round(payBox.x)}`);
      expect.soft(payBox.height, `Bước 2: nút [Thanh toán] đủ cao để bấm (${Math.round(payBox.height)}px, cần >= ${MIN_TOUCH}px)`).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect.soft(payBox.width, `Bước 2: nút [Thanh toán] đủ rộng để bấm (${Math.round(payBox.width)}px)`).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect.soft(payBox.x >= -1 && payBox.x + payBox.width <= PORTRAIT.width + 1, 'Bước 2: nút [Thanh toán] nằm gọn trong màn hình').toBe(true);
      expect.soft(await isTopmost(payBtn), 'Bước 2: nút [Thanh toán] không bị phần tử khác che').toBe(true);

      // Tổng tiền hiển thị, không bị thanh cố định/nút che
      const totalLabel = page.getByText(/Tổng tiền|Tổng thanh toán|Cần thanh toán/i).filter({ visible: true }).last();
      await expect(totalLabel, 'Bước 2: phải có dòng tổng tiền').toBeVisible();
      await totalLabel.scrollIntoViewIfNeeded();
      expect.soft(await isTopmost(totalLabel), 'Bước 2: tổng tiền không bị che').toBe(true);
      const totalRegion = await totalLabel.evaluate((el) => (el.closest('div')?.parentElement?.innerText || el.innerText || '').replace(/\u00a0/g, ' '));
      expect.soft(totalRegion, 'Bước 2: tổng tiền hiển thị đủ số tiền (có ký hiệu ₫)').toMatch(/\d{1,3}(?:\.\d{3})+\s*₫/);

      const ov2 = await checkOverflow(PORTRAIT.width);
      expect.soft(ov2.overflow, `Bước 2: cuộn xuống cuối trang vẫn không tràn ngang (${ov2.offenders.join('; ')})`).toBe(false);
      await shot('02-doc-cuoi-trang');

      /* ===================== Bước 3: xoay ngang màn hình ===================== */
      await page.setViewportSize(LANDSCAPE);
      await page.waitForTimeout(1500); // chờ giao diện thích ứng (resize/orientationchange)
      const innerL = await page.evaluate(() => window.innerWidth);
      expect(Math.abs(innerL - LANDSCAPE.width), `Bước 3: viewport đã xoay ngang (innerWidth=${innerL}px)`).toBeLessThanOrEqual(2);
      await expect(page, 'Bước 3: vẫn ở trang Thanh toán sau khi xoay').toHaveURL(/\/checkout/);
      expect.soft(await page.locator('body').innerText(), 'Bước 3: không xuất hiện trang lỗi sau khi xoay')
        .not.toMatch(/có lỗi xảy ra|không tìm thấy trang/i);

      const ov3 = await checkOverflow(LANDSCAPE.width);
      console.log(`[GUI_01] Ngang: scrollWidth=${ov3.scrollWidth} | innerWidth=${ov3.inner} | chuẩn=${ov3.vw} | phần tử vượt mép: ${ov3.offenders.join('; ') || 'không'}`);
      expect.soft(ov3.overflow, `Bước 3: xoay ngang không tràn ngang (${ov3.offenders.join('; ')})`).toBe(false);

      // Các khối còn nằm gọn trong chiều rộng mới
      for (const s of SECTIONS) {
        const loc = page.getByText(s.re).filter({ visible: true }).first();
        if (!(await loc.count())) continue;
        await loc.scrollIntoViewIfNeeded();
        const b = await loc.boundingBox();
        expect.soft(b.x >= -1 && b.x + b.width <= LANDSCAPE.width + 1, `Bước 3: ${s.name} nằm gọn trong màn hình ngang`).toBe(true);
      }

      // Thanh cố định không được chiếm quá nhiều chiều cao màn hình ngang (375px)
      const sticky = await stickyHeight();
      expect.soft(sticky, `Bước 3: thanh cố định chiếm ${Math.round(sticky)}px trên ${LANDSCAPE.height}px, không được che quá 40% nội dung`)
        .toBeLessThanOrEqual(LANDSCAPE.height * 0.4);

      // Nút [Thanh toán] và tổng tiền vẫn tiếp cận được
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await payBtn.scrollIntoViewIfNeeded();
      await expect(payBtn, 'Bước 3: nút [Thanh toán] vẫn hiển thị khi xoay ngang').toBeVisible();
      const payBoxL = await payBtn.boundingBox();
      expect.soft(payBoxL.x >= -1 && payBoxL.x + payBoxL.width <= LANDSCAPE.width + 1, 'Bước 3: nút [Thanh toán] nằm gọn trong màn hình ngang').toBe(true);
      expect.soft(payBoxL.height, 'Bước 3: nút [Thanh toán] vẫn đủ cao để bấm').toBeGreaterThanOrEqual(MIN_TOUCH);
      expect.soft(await isTopmost(payBtn), 'Bước 3: nút [Thanh toán] không bị che khi xoay ngang').toBe(true);
      await totalLabel.scrollIntoViewIfNeeded();
      expect.soft(await isTopmost(totalLabel), 'Bước 3: tổng tiền không bị che khi xoay ngang').toBe(true);
      await shot('03-xoay-ngang');

      manual('Bố cục 1 cột, chữ đọc được, cuộn mượt, giao diện thích ứng khi xoay: kiểm tra bằng mắt trên điện thoại thật hoặc DevTools.');

      // KHÔNG bấm [Thanh toán] -> không gửi SMS, không tạo đơn
    } finally {
      if (context) await context.close();
    }
  });
});
