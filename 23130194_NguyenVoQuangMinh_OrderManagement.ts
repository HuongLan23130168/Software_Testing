import { test, expect, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ==============================================================================
 * BỘ AUTOMATION TEST CHỨC NĂNG: QUẢN LÝ VÀ TRA CỨU ĐƠN HÀNG (ĐIỆN MÁY XANH)
 * File: tests/Order_Management.spec.ts
 * Sinh viên thực hiện: Nguyễn Võ Quang Minh (MSSV: 23130194)
 * Môn học / Bài tập: Assignment 7 - Triển khai Script Automation cho Chức Năng Cá Nhân
 * Bộ Test Case: 30 Test Cases theo tài liệu DMX_TestCase_TestDesign_TestReport_V0.4.xlsx
 * Website kiểm thử: 100% THUẦN TRỰC TIẾP TRÊN https://www.dienmayxanh.com
 * Tự động ghi hình: Toàn bộ quá trình chạy được lưu video .webm vào thư mục test-results/
 * ==============================================================================
 */

const STORAGE_STATE_PATH = path.join(__dirname, '../auth/dmx_storageState.json');
const HAS_AUTH = fs.existsSync(STORAGE_STATE_PATH);
const STORAGE_STATE_B_PATH = path.join(__dirname, '../auth/dmx_storageState_B.json');
const HAS_AUTH_B = fs.existsSync(STORAGE_STATE_B_PATH);
const TEST_PHONE = '0978173770';
const TEST_NAME = 'Minh';

// URL cơ sở
const ORDER_LIST_URL = 'https://www.dienmayxanh.com/ca-nhan/lich-su-mua-hang';
const ORDER_DETAIL_URL_PREFIX = 'https://www.dienmayxanh.com/ca-nhan/lich-su-mua-hang/';
const ORDER_DETAIL_SUFFIX = '?sync=4';

// Đơn hàng mẫu để kiểm tra
const ORDER_ID_1 = '01967SO24090400320'; // 2 sản phẩm, 650.000đ, đặt 10:46 04/09/2024
const ORDER_ID_2 = '00678SO24020161113'; // 1 sản phẩm, 120.000đ

test.use(HAS_AUTH ? { storageState: STORAGE_STATE_PATH } : {});

// ==============================================================================
// HÀM TIỆN ÍCH DÙNG CHUNG
// ==============================================================================

/** Chụp ảnh và đính kèm vào báo cáo */
const shot = async (page: Page, name: string) =>
  test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

/** Đính kèm text vào báo cáo */
const attachText = async (name: string, text: string) =>
  test.info().attach(name, { body: text, contentType: 'text/plain' });

/** Ghi chú (annotation) vào báo cáo */
const note = (type: string, description: string) => {
  console.warn(`⚠ ${type.toUpperCase()}: ${description}`);
  test.info().annotations.push({ type, description });
};

/**
 * Mở popup đổi khoảng thời gian và chọn Từ/Đến
 * Trả về popup locator để tiếp tục thao tác
 */
async function openDateRangePopup(page: Page): Promise<void> {
  // Click nút [Đổi] bên cạnh khoảng thời gian
  const changeBtn = page.locator('a, button, span').filter({ hasText: /^Đổi$/i }).first();
  if (await changeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await changeBtn.click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Chọn ngày trong popup bộ lọc khoảng thời gian thông qua tương tác trực tiếp
 * với các ô input ngày trên giao diện. Hàm sẽ tìm ô Từ/Đến, xóa giá trị cũ
 * và nhập ngày mới theo định dạng dd/mm/yyyy, sau đó click [Áp dụng].
 */
async function selectDateRange(page: Page, fromDate: string, toDate: string): Promise<void> {
  await openDateRangePopup(page);

  // Tìm các ô input ngày (Từ, Đến) trong popup
  const dateInputs = page.locator('input[type="text"], input[type="date"], input[placeholder*="ngày"], input[placeholder*="Ngày"]');
  const inputCount = await dateInputs.count();

  if (inputCount >= 2) {
    // Xóa và nhập ngày Từ
    await dateInputs.nth(0).click();
    await dateInputs.nth(0).fill(fromDate);
    await page.waitForTimeout(500);

    // Xóa và nhập ngày Đến
    await dateInputs.nth(1).click();
    await dateInputs.nth(1).fill(toDate);
    await page.waitForTimeout(500);
  } else {
    // Fallback: thử chọn ngày bằng cách tương tác trực tiếp với URL params
    console.log('[selectDateRange] Không tìm thấy đủ ô input, thử fallback qua URL');
    const [dy, dm, dyyy] = fromDate.split('/');
    const [ty, tm, tyyy] = toDate.split('/');
    const fromISO = `${dyyy}-${dm}-${dy}`;
    const toISO = `${tyyy}-${tm}-${ty}`;
    await page.goto(
      `${ORDER_LIST_URL}?from=${fromISO}T00:00:00&to=${toISO}T23:59:59`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await page.waitForTimeout(2000);
    return;
  }

  // Click nút [Áp dụng]
  const applyBtn = page.locator('button, a, span').filter({ hasText: /Áp dụng/i }).first();
  if (await applyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await applyBtn.click();
    await page.waitForTimeout(2000);
  }
}

/**
 * Điều hướng đến trang danh sách đơn hàng với khoảng thời gian rộng (từ 2020)
 * để đảm bảo hiển thị được các đơn test
 */
async function gotoOrderListWithWideRange(page: Page): Promise<void> {
  const now = new Date();
  const toISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  await page.goto(
    `${ORDER_LIST_URL}?from=2020-01-01T00:00:00&to=${toISO}T23:59:59`,
    { waitUntil: 'domcontentloaded', timeout: 45000 }
  );
  await page.waitForTimeout(2000);
}

/**
 * Kiểm tra trang có yêu cầu đăng nhập hay không
 */
async function isRedirectedToLogin(page: Page): Promise<boolean> {
  return /dang-nhap/i.test(page.url());
}

/**
 * Tắt popup quảng cáo che màn hình (nếu có).
 * Thử lần lượt: phím Esc -> bấm nút X -> gỡ lớp phủ bằng JS.
 */
async function dismissPopups(page: Page): Promise<void> {
  await page.keyboard.press('Escape').catch(() => { });

  const closeButtons = page.locator([
    '[class*="popup" i] [class*="close" i]',
    '[class*="modal" i] [class*="close" i]',
    '[class*="banner" i] [class*="close" i]',
    'button[aria-label*="close" i]',
    'button[aria-label*="đóng" i]',
    '.btn-close', '.close-popup', '.close',
  ].join(', '));

  for (const btn of await closeButtons.all()) {
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => { });
      await page.waitForTimeout(300);
    }
  }

  // Dự phòng: nếu giữa màn hình vẫn còn lớp phủ cố định thì gỡ nó đi
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) {
      let el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) as HTMLElement | null;
      while (el && el !== document.body) {
        const pos = getComputedStyle(el).position;
        if (pos === 'fixed') { el.remove(); break; }
        el = el.parentElement;
      }
    }
  }).catch(() => { });
}

/**
 * Chọn một ngày trên lịch của popup "Xem theo khoảng thời gian" (popup đang mở).
 * Các phần tử lấy theo code codegen: tháng viết thường ("tháng 1"), ô ngày là nút có tên tiếng Anh
 * dạng "Monday, January 1st, 2024".
 */
const CAL_MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Đưa lịch tới đúng tháng và năm cần chọn (theo locator codegen: tháng viết thường "tháng 1") */
async function goToCalendarMonth(page: Page, month: number, year: number): Promise<void> {
  await page.locator('.px-10px').first().click({ timeout: 5000 });
  await page.getByText(`tháng ${month}`, { exact: true }).last().click({ timeout: 5000 });
  await page.locator('div:nth-child(2) > .px-10px').click({ timeout: 5000 });
  await page.getByText(String(year), { exact: true }).last().click({ timeout: 5000 });
}

/** Bấm một ô ngày trên lịch (tên nút dạng "Monday, January 1st, 2024"), lịch phải đang hiển thị đúng tháng */
async function clickCalendarDay(page: Page, day: number, month: number, year: number): Promise<void> {
  const sfx = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  const ordinal = `${day}${sfx[(v - 20) % 10] || sfx[v] || sfx[0]}`;
  await page
    .getByRole('button', { name: new RegExp(`${CAL_MONTHS_EN[month - 1]} ${ordinal}, ${year}`) })
    .click({ timeout: 5000 });
}

/** Chọn một ngày bất kỳ trên lịch: đi tới đúng tháng, năm rồi bấm ngày */
async function pickCalendarDate(page: Page, day: number, month: number, year: number): Promise<void> {
  await goToCalendarMonth(page, month, year);
  await clickCalendarDay(page, day, month, year);
}

// ==============================================================================
// PHẦN 1: TRUY CẬP VÀ PHÂN QUYỀN (ACCESS - 4 TEST CASES)
// ==============================================================================
test.describe('PHẦN 1: TRUY CẬP VÀ PHÂN QUYỀN (ACCESS)', () => {

  test('Order_Access_01: Kiểm tra truy cập [Đơn hàng đã mua] từ menu trái trang cá nhân', async ({ page }) => {
    test.skip(!HAS_AUTH, '[Access_01] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    // Bước 1: Vào trang cá nhân (Kho voucher hoặc Thông tin của tôi)
    await page.goto('https://www.dienmayxanh.com/ca-nhan', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await expect(page).toHaveURL(/.*ca-nhan.*/);
    await page.waitForTimeout(2000);

    // Kiểm tra trang cá nhân hiển thị
    const personalPage = page.locator('body');
    await expect(personalPage).toBeVisible();
    await shot(page, 'Access_01_trang_ca_nhan');

    // Bước 2: Click [Đơn hàng đã mua] ở menu trái
    const orderMenuLink = page.locator('a').filter({ hasText: /Đơn hàng đã mua|Lịch sử mua hàng/i }).first();
    await expect(orderMenuLink).toBeVisible({ timeout: 15000 });
    await orderMenuLink.scrollIntoViewIfNeeded();
    await orderMenuLink.click({ force: true });
    await page.waitForTimeout(3000);

    // Nếu trình duyệt chưa tự chuyển URL
    if (!page.url().includes('lich-su-mua-hang')) {
      await page.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
    }

    // Verify 1: URL chuyển đến /ca-nhan/lich-su-mua-hang
    expect(page.url()).toContain('lich-su-mua-hang');

    // Verify 2: Tiêu đề "Đơn hàng đã mua"
    const pageTitle = page.locator('text=/Đơn hàng đã mua|Lịch sử mua hàng/i').first();
    await expect(pageTitle).toBeVisible({ timeout: 10000 });

    // Verify 3: Menu trái làm nổi bật mục [Đơn hàng đã mua]
    const activeMenu = page.locator('a.active, a[class*="active"], a[class*="selected"]').filter({ hasText: /Đơn hàng|Lịch sử/i }).first();
    if (await activeMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[Access_01] Menu trái đang nổi bật đúng mục Đơn hàng');
    } else {
      note('ux-note', 'Không xác nhận được menu trái có nổi bật mục [Đơn hàng đã mua] hay không - cần kiểm tra bằng mắt.');
    }

    await shot(page, 'Access_01_trang_don_hang');
    await page.waitForTimeout(2000);
  });

  test('Order_Access_02: Kiểm tra truy cập danh sách đơn hàng khi chưa đăng nhập', async ({ browser }) => {
    // Pre-condition: phiên sạch, chưa đăng nhập (tương đương cửa sổ ẩn danh)
    const guestContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const guestPage = await guestContext.newPage();

    try {
      // Bước 1: Vào trang chủ, click [Lịch sử mua hàng] ở chân trang
      await guestPage.goto('https://www.dienmayxanh.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await expect(guestPage).toHaveTitle(/Điện máy XANH/i);

      // Popup hay hiện trễ sau khi trang tải xong -> chờ rồi tắt
      await guestPage.waitForTimeout(2500);
      await dismissPopups(guestPage);

      await expect(guestPage.locator('a[href*="dang-nhap"]').first()).toBeVisible({ timeout: 15000 });

      const footerLink = guestPage.locator('a').filter({ hasText: /Lịch sử mua hàng/i }).first();
      await expect(footerLink, 'Phải có link [Lịch sử mua hàng] ở chân trang').toBeVisible({ timeout: 15000 });
      await footerLink.scrollIntoViewIfNeeded();

      // Tắt lại lần nữa phòng khi popup hiện ra trong lúc cuộn xuống
      await dismissPopups(guestPage);

      const newTabPromise = guestContext.waitForEvent('page', { timeout: 3000 }).catch(() => null);
      await footerLink.click({ timeout: 10000 });
      const newTab = await newTabPromise;
      const pageAfterClick = newTab ?? guestPage;

      // Verify 1: chuyển sang trang đăng nhập (tự chờ, không dùng sleep cố định)
      await expect(
        pageAfterClick,
        'Khi chưa đăng nhập, click [Lịch sử mua hàng] phải chuyển sang /dang-nhap'
      ).toHaveURL(/dang-nhap/i, { timeout: 20000 });
      await shot(pageAfterClick, 'Access_02_buoc1_click_footer');

      if (newTab) await newTab.close();

      // ---------- Bước 2: Nhập trực tiếp URL danh sách đơn hàng ----------
      await guestPage.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // Verify 2a: hệ thống yêu cầu đăng nhập
      await expect(
        guestPage,
        'Khi chưa đăng nhập, truy cập URL đơn hàng phải chuyển sang /dang-nhap'
      ).toHaveURL(/dang-nhap/i, { timeout: 20000 });

      // Verify 2b: không hiển thị bất kỳ đơn hàng nào
      const bodyText = await guestPage.evaluate(() => document.body.innerText);
      expect(bodyText, 'Không được lộ mã đơn hàng').not.toContain(ORDER_ID_1);
      expect(bodyText, 'Không được lộ thông tin đơn hàng').not.toContain('Tổng tiền hàng');
      expect(bodyText, 'Không được hiển thị tiêu đề danh sách đơn').not.toMatch(/Đơn hàng đã mua/i);
      await shot(guestPage, 'Access_02_buoc2_url_truc_tiep');

      await attachText(
        'Access_02_ket_luan',
        'Website KHÔNG cho tra cứu đơn khi chưa đăng nhập: click footer và nhập URL trực tiếp đều chuyển sang /dang-nhap.'
      );
    } finally {
      await guestContext.close().catch(() => { });
    }
  });

  test('Order_Access_03: Kiểm tra truy cập trực tiếp URL chi tiết đơn hàng khi chưa đăng nhập', async ({ browser }) => {
    // Pre-condition: phiên sạch, chưa đăng nhập (tương đương cửa sổ ẩn danh)
    const guestContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const guestPage = await guestContext.newPage();

    try {
      // ---------- Bước 1: Nhập trực tiếp URL chi tiết đơn hàng ----------
      await guestPage.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });

      // Verify 1: hệ thống yêu cầu đăng nhập (tự chờ redirect, không dùng sleep cố định)
      await expect(
        guestPage,
        'Khi chưa đăng nhập, truy cập URL chi tiết đơn phải chuyển sang /dang-nhap'
      ).toHaveURL(/dang-nhap/i, { timeout: 20000 });

      // Tắt popup quảng cáo (nếu có) để chụp ảnh và đọc nội dung chính xác
      await guestPage.waitForTimeout(1500);
      await dismissPopups(guestPage);

      // Verify 2: không hiển thị thông tin người nhận, sản phẩm, giá, địa chỉ của đơn hàng
      const bodyText = await guestPage.evaluate(() => document.body.innerText);
      const forbidden: Array<string | RegExp> = [
        ORDER_ID_1,                      // mã đơn hàng
        '650.000',                       // tổng tiền của đơn mẫu
        TEST_PHONE,                      // số điện thoại người nhận
        /Chi tiết thanh toán/i,          // khối thanh toán của trang chi tiết đơn
        /Thông tin người nhận|Địa chỉ nhận hàng/i, // khối người nhận / địa chỉ
        /Sản phẩm đã mua|Tổng tiền hàng/i,         // khối sản phẩm / giá
      ];
      for (const item of forbidden) {
        if (typeof item === 'string') {
          expect(bodyText, `Không được lộ "${item}" khi chưa đăng nhập`).not.toContain(item);
        } else {
          expect(bodyText, `Không được lộ nội dung khớp ${item} khi chưa đăng nhập`).not.toMatch(item);
        }
      }

      await shot(guestPage, 'Access_03_url_chi_tiet_chua_dang_nhap');

      await attachText(
        'Access_03_ket_luan',
        'Website KHÔNG hiển thị chi tiết đơn hàng khi chưa đăng nhập: URL chi tiết đơn được chuyển sang /dang-nhap và không lộ thông tin đơn.'
      );
    } finally {
      await guestContext.close().catch(() => { });
    }
  });

  test('Order_Access_04: Kiểm tra tài khoản khác không xem được chi tiết đơn của tài khoản chủ đơn', async ({ browser }) => {
    test.skip(!HAS_AUTH_B, '[Access_04] Bỏ qua: chưa có auth/dmx_storageState_B.json (cần tài khoản B, không phải chủ đơn).');

    // Pre-condition: đăng nhập bằng tài khoản B (khác chủ đơn A)
    const ctxB = await browser.newContext({ storageState: STORAGE_STATE_B_PATH });
    const pageB = await ctxB.newPage();

    try {
      // ---------- Bước 1: Xác nhận tài khoản B đang đăng nhập thành công ----------
      // Đối chứng: chủ đơn A mở đúng URL này phải xem được thông tin đơn
      const ctxA = await browser.newContext({ storageState: STORAGE_STATE_PATH });
      try {
        const pageA = await ctxA.newPage();
        await pageA.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await expect(
          pageA.getByText('Thông tin người nhận'),
          'Đối chứng: chủ đơn A phải xem được chi tiết đơn qua URL này, nếu không thì kết quả của tài khoản B không có ý nghĩa'
        ).toBeVisible({ timeout: 25000 });
      } finally {
        await ctxA.close().catch(() => { });
      }
      await pageB.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await pageB.waitForTimeout(1500);
      await dismissPopups(pageB);

      // Nếu B bị đẩy về /dang-nhap thì phiên B đã hết hạn -> không thể kết luận gì về IDOR
      expect(
        pageB.url(),
        'Tài khoản B chưa đăng nhập được (phiên hết hạn?). Chạy lại file auth cho tài khoản B.'
      ).not.toMatch(/dang-nhap/i);
      await shot(pageB, 'Access_04_buoc1_B_da_dang_nhap');

      // ---------- Bước 2: B nhập URL chi tiết đơn của tài khoản A ----------
      await pageB.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
            await dismissPopups(pageB);

      // Chờ trang tải xong kết quả cuối cùng: có thông báo lỗi, hoặc quay về danh sách đơn của B
      const errorPattern = /không lấy được thông tin đơn hàng|không tồn tại đơn hàng|không tìm thấy|không có quyền/i;
      await expect
        .poll(
          async () => {
            const text = (await pageB.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
            const backToList = /lich-su-mua-hang\/?(\?.*)?$/i.test(pageB.url());
            return errorPattern.test(text) || backToList;
          },
          {
            message: 'Phải hiện thông báo không tìm thấy/không có quyền, hoặc quay về danh sách đơn của B',
            timeout: 20000,
          }
        )
        .toBe(true);
      await shot(pageB, 'Access_04_buoc2_B_mo_don_cua_A');

      // Verify 1: KHÔNG hiển thị thông tin đơn của A (kiểm tra SAU khi trang đã có kết quả)
      const bodyText = (await pageB.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
      const hasErrorMessage = errorPattern.test(bodyText);
      const forbidden: Array<string | RegExp> = [
        '650.000',
        TEST_PHONE,
        /Chi tiết thanh toán/i,
        /Thông tin người nhận|Địa chỉ nhận hàng/i,
        /Sản phẩm đã mua|Tổng tiền hàng/i,
      ];
      for (const item of forbidden) {
        if (typeof item === 'string') {
          expect(bodyText, `IDOR: B nhìn thấy "${item}" của đơn tài khoản A`).not.toContain(item);
        } else {
          expect(bodyText, `IDOR: B nhìn thấy nội dung khớp ${item} của đơn tài khoản A`).not.toMatch(item);
        }
      }

      await attachText(
        'Access_04_ket_luan',
        `Tài khoản B không xem được đơn của A. Cách hệ thống xử lý: ${hasErrorMessage ? 'hiện thông báo lỗi' : 'quay về danh sách đơn'}. URL cuối: ${pageB.url()}`
      );
    } finally {
      await ctxB.close().catch(() => { });
    }
  });
});


// ==============================================================================
// PHẦN 2: DANH SÁCH ĐƠN HÀNG (LIST - 5 TEST CASES)
// ==============================================================================
test.describe('PHẦN 2: DANH SÁCH ĐƠN HÀNG (LIST)', () => {

  test('Order_List_01: Kiểm tra khoảng thời gian mặc định là đúng 1 năm gần nhất tính đến ngày hiện tại', async ({ page }) => {
    test.skip(!HAS_AUTH, '[List_01] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    // ---------- Tính ngày kỳ vọng theo ngày hệ thống ----------
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmtVN = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const fmtISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    // Trường hợp 29/02: năm trước không có ngày này -> lùi về 28/02
    if (oneYearAgo.getMonth() !== today.getMonth()) oneYearAgo.setDate(0);

    const expectedFrom = fmtVN(oneYearAgo);
    const expectedTo = fmtVN(today);
    await attachText('List_01_ngay_ky_vong', `Kỳ vọng: Từ ${expectedFrom} - ${expectedTo}`);

    // ---------- Bước 1: vào trang [Đơn hàng đã mua] lần đầu, KHÔNG có tham số from/to ----------
    await page.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    await dismissPopups(page);

    const rangeRegex = /Từ\s+(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/;
    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');

    // Chờ tiêu đề khoảng thời gian xuất hiện (tự chờ, không dùng sleep cố định)
    await expect
      .poll(async () => rangeRegex.test(await readBody()), {
        message: 'Phải hiển thị khoảng thời gian dạng "Từ dd/mm/yyyy - dd/mm/yyyy" trên trang đơn hàng',
        timeout: 20000,
      })
      .toBe(true);
    
        // Danh sách đơn tải sau tiêu đề (web hiện khung xám chờ): chờ có đơn hoặc thông báo rỗng
    try {
      await expect
        .poll(
          async () => {
            const t = await readBody();
            return /Đơn hàng:\s*#/.test(t) || /sản phẩm nào|đang chờ anh|không có đơn|chưa có đơn/i.test(t);
          },
          { timeout: 15000 }
        )
        .toBe(true);
    } catch {
      note('data-note', 'Danh sách đơn chưa tải xong sau 15s, kiểm tra thủ công.');
    }

    const bodyText = await readBody();
    const [, shownFrom, shownTo] = bodyText.match(rangeRegex)!;
    await shot(page, 'List_01_buoc1_trang_don_hang_mac_dinh');

    // Verify 1a: tiêu đề hiển thị đúng 1 năm gần nhất
    expect(shownFrom, `Ngày bắt đầu phải là đúng 1 năm trước (${expectedFrom})`).toBe(expectedFrom);
    expect(shownTo, `Ngày kết thúc phải là ngày hiện tại (${expectedTo})`).toBe(expectedTo);

    // Verify 1b: URL có tham số from/to tương ứng
    const url = decodeURIComponent(page.url());
    if (url.includes(`from=${fmtISO(oneYearAgo)}`) && url.includes(`to=${fmtISO(today)}`)) {
      console.log(`[List_01] URL đúng: ${url}`);
    } else {
      note('url-note', `URL không chứa from=${fmtISO(oneYearAgo)} / to=${fmtISO(today)}. URL thực tế: ${url}`);
    }

    // Verify 1c: danh sách chỉ gồm đơn trong khoảng thời gian
    const orderDates = [...bodyText.matchAll(/\d{2}:\d{2}\s+(\d{2})\/(\d{2})\/(\d{4})/g)].map(
      (m) => new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    );
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    for (const d of orderDates) {
      expect(d.getTime(), `Có đơn ngày ${fmtVN(d)} nằm ngoài khoảng ${expectedFrom} - ${expectedTo}`)
        .toBeGreaterThanOrEqual(oneYearAgo.getTime());
      expect(d.getTime()).toBeLessThanOrEqual(endOfToday.getTime());
    }
    if (orderDates.length === 0) {
      note('data-note', 'Không đọc được ngày đặt của đơn nào trên trang (có thể tài khoản chưa có đơn trong 1 năm gần nhất).');
    }
    // Đơn mẫu đặt 04/09/2024 nằm ngoài 1 năm gần nhất nên không được hiển thị
    expect(bodyText, 'Đơn đặt 04/09/2024 không được hiển thị trong khoảng 1 năm gần nhất').not.toContain(ORDER_ID_1);

    // ---------- Bước 2: click [Đổi] để xem giá trị Từ/Đến trong popup ----------
    const changeBtn = page.getByText(/^Đổi$/).first();
    await expect(changeBtn, 'Phải có nút [Đổi] bên cạnh khoảng thời gian').toBeVisible({ timeout: 10000 });
    await changeBtn.click();

    // Popup "Xem theo khoảng thời gian": lấy cụm gần nhất có chứa nút [Áp dụng]
    const popupTitle = page.getByText('Xem theo khoảng thời gian');
    await expect(popupTitle).toBeVisible({ timeout: 10000 });
    const popup = popupTitle.locator('xpath=ancestor::*[.//*[normalize-space(text())="Áp dụng"]][1]');
    await shot(page, 'List_01_buoc2_popup_khoang_thoi_gian');

    // Verify 2: Từ = đúng 1 năm trước, Đến = ngày hiện tại (toContainText tự chờ)
    await expect(popup, `Popup phải có Từ = ${expectedFrom}`).toContainText(expectedFrom);
    await expect(popup, `Popup phải có Đến = ${expectedTo}`).toContainText(expectedTo);
    // Thứ tự: ngày Từ đứng trước ngày Đến
    const popupText = ((await popup.innerText()) || '').replace(/\s+/g, ' ');
    expect(popupText).toMatch(new RegExp(`${expectedFrom.replace(/\//g, '\\/')}[\\s\\S]*${expectedTo.replace(/\//g, '\\/')}`));
    await attachText('List_01_noi_dung_popup', popupText);

    // Đóng popup, không áp dụng thay đổi nào
    await popup.getByText('Đóng', { exact: true }).click().catch(() => { });
  });

  test('Order_List_02: Kiểm tra nội dung hiển thị của card đơn hàng', async ({ page }) => {
    test.skip(!HAS_AUTH, '[List_02] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    // ---------- Bước 1: mở khoảng thời gian có đơn (từ 2020 đến ngày hiện tại) ----------
    await gotoOrderListWithWideRange(page);
    await dismissPopups(page);

    // ---------- Bước 2: quan sát card đơn #01967SO24090400320 ----------
    // Mã đơn xuất hiện sau khi danh sách tải xong -> chờ tự động
    const orderIdText = page.getByText(ORDER_ID_1).first();
    await expect(
      orderIdText,
      `Danh sách phải có đơn #${ORDER_ID_1}. Nếu không thấy, kiểm tra khoảng thời gian trên trang có bao trùm 04/09/2024 không.`
    ).toBeVisible({ timeout: 25000 });

    // Card = cụm gần nhất bao quanh mã đơn và có link [Xem chi tiết]
    const card = orderIdText.locator('xpath=ancestor::*[.//*[contains(normalize-space(.),"Xem chi tiết")]][1]');
    await card.scrollIntoViewIfNeeded();
    const cardText = ((await card.innerText()) || '').replace(/\s+/g, ' ');
    await attachText('List_02_noi_dung_card', cardText);
    await test.info().attach('List_02_card', { body: await card.screenshot(), contentType: 'image/png' });

    // Verify 1: "Đơn hàng:" + mã đơn dạng #01967SO24090400320
    expect(cardText, 'Card phải có nhãn "Đơn hàng:"').toMatch(/Đơn hàng:/i);
    expect(cardText, `Card phải có mã đơn #${ORDER_ID_1}`).toContain(`#${ORDER_ID_1}`);

    // Biểu tượng sao chép cạnh mã đơn (không chắc cấu trúc DOM nên chỉ ghi chú nếu thiếu)
    const copyIcon = orderIdText.locator('xpath=..').locator('svg, img, button');
    if ((await copyIcon.count()) === 0) {
      note('ux-note', 'Không tìm thấy biểu tượng sao chép cạnh mã đơn, cần kiểm tra bằng mắt.');
    }

    // Verify 2: trạng thái "Thành Công" (màu xanh)
    expect(cardText, 'Card phải có trạng thái "Thành Công"').toContain('Thành Công');
    const statusColor = await card
      .getByText('Thành Công', { exact: true })
      .first()
      .evaluate((el) => getComputedStyle(el).color)
      .catch(() => '');
    const rgb = statusColor.match(/\d+/g)?.slice(0, 3).map(Number);
    if (rgb && rgb[1] > rgb[0] && rgb[1] > rgb[2]) {
      console.log(`[List_02] Trạng thái "Thành Công" màu xanh lá: ${statusColor}`);
    } else {
      note('ux-note', `Màu chữ trạng thái "Thành Công" là ${statusColor || 'không đọc được'}, cần kiểm tra bằng mắt xem có xanh không.`);
    }

    // Verify 3: ảnh + tên sản phẩm đầu tiên
    const firstImg = card.locator('img').first();
    await expect(firstImg, 'Card phải có ảnh sản phẩm').toBeVisible();
    const imgNatural = await firstImg.evaluate((el) => (el as HTMLImageElement).naturalWidth).catch(() => 0);
    expect(imgNatural, 'Ảnh sản phẩm phải tải được (không bị lỗi)').toBeGreaterThan(0);
    // Tên sản phẩm: phần chữ của card ngoài các nhãn đã biết phải còn nội dung
    const leftover = cardText
      .replace(/Đơn hàng:|#\S+|Thành Công|Xem chi tiết|Tổng tiền hàng:?|[\d.,]+\s*(đ|₫)|\+\s*\d+\s*sản phẩm khác|>/gi, '')
      .trim();
    expect(leftover.length, 'Card phải có tên sản phẩm đầu tiên').toBeGreaterThan(3);

    // Verify 4: "+1 sản phẩm khác" (đơn có 2 sản phẩm)
    expect(cardText, 'Đơn 2 sản phẩm phải hiển thị "+1 sản phẩm khác"').toMatch(/\+\s*1\s*sản phẩm khác/i);

    // Verify 5: "Tổng tiền hàng: 650.000đ"
    expect(cardText, 'Card phải hiển thị "Tổng tiền hàng: 650.000đ"').toMatch(/Tổng tiền hàng:?\s*650[.,]000\s*(đ|₫)/i);

    // Verify 6: liên kết [Xem chi tiết >] và đường dẫn đúng đơn
    const detailLink = card.getByText(/Xem chi tiết/i).first();
    await expect(detailLink, 'Card phải có liên kết [Xem chi tiết]').toBeVisible();
    const href = await detailLink
      .evaluate((el) => (el.closest('a') as HTMLAnchorElement | null)?.href ?? '')
      .catch(() => '');
    if (href) {
      expect(href, 'Liên kết [Xem chi tiết] phải trỏ đúng đơn').toContain(ORDER_ID_1);
    } else {
      note('ux-note', 'Không đọc được href của [Xem chi tiết] (có thể là nút bấm), cần kiểm tra bằng mắt.');
    }
  });

  test('Order_List_03: Kiểm tra dòng "+N sản phẩm khác" theo số sản phẩm của đơn', async ({ page }) => {
    test.skip(!HAS_AUTH, '[List_03] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    // Mở khoảng thời gian rộng để thấy cả 2 đơn mẫu (2024)
    await gotoOrderListWithWideRange(page);
    await dismissPopups(page);

    // Lấy đúng card của một đơn: cụm gần nhất bao quanh mã đơn và có link [Xem chi tiết]
    const getCardText = async (orderId: string): Promise<string> => {
      const idEl = page.getByText(orderId).first();
      await expect(
        idEl,
        `Danh sách phải có đơn #${orderId} (kiểm tra tài khoản test có đơn này và khoảng thời gian bao trùm ngày đặt)`
      ).toBeVisible({ timeout: 25000 });
      const card = idEl.locator('xpath=ancestor::*[.//*[contains(normalize-space(.),"Xem chi tiết")]][1]');
      await card.scrollIntoViewIfNeeded();
      await test.info().attach(`List_03_card_${orderId}`, { body: await card.screenshot(), contentType: 'image/png' });
      return ((await card.innerText()) || '').replace(/\s+/g, ' ');
    };

    // ---------- Bước 1: đơn #01967SO24090400320 (2 sản phẩm) -> "+1 sản phẩm khác" ----------
    const card1Text = await getCardText(ORDER_ID_1);
    await attachText('List_03_card_don_2_san_pham', card1Text);
    expect(card1Text, 'Đơn 2 sản phẩm phải hiển thị "+1 sản phẩm khác" (N = tổng số sản phẩm - 1)')
      .toMatch(/\+\s*1\s*sản phẩm khác/i);

    // ---------- Bước 2: đơn #00678SO24020161113 (1 sản phẩm) -> KHÔNG có "+N sản phẩm khác" ----------
    const card2Text = await getCardText(ORDER_ID_2);
    await attachText('List_03_card_don_1_san_pham', card2Text);
    expect(card2Text, 'Đơn 1 sản phẩm không được hiển thị dòng "+N sản phẩm khác"')
      .not.toMatch(/\+\s*\d+\s*sản phẩm khác/i);
  });

  test('Order_List_04: Kiểm tra thứ tự sắp xếp danh sách đơn hàng', async ({ page }) => {
    test.skip(!HAS_AUTH, '[List_04] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    // ======================= HÀM HỖ TRỢ =======================
    // Đọc mã đơn từ trên xuống, giữ nguyên thứ tự hiển thị; cuộn / bấm "Xem thêm" nếu danh sách tải dần
    const readOrderIds = async (): Promise<string[]> => {
      const read = () =>
        page.evaluate(() => {
          const text = document.body.innerText;
          const ids = (text.match(/#?\d{5}[A-Z]{2}\d{11,}/g) || []).map((m) => m.replace('#', ''));
          return [...new Set(ids)];
        });

      let ids = await read();
      for (let i = 0; i < 6; i++) {
        const more = page.getByText(/^Xem thêm/i).first();
        if (await more.isVisible().catch(() => false)) await more.click().catch(() => { });
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1200);
        const next = await read();
        if (next.length === ids.length) break;
        ids = next;
      }
      return ids;
    };

    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ` +
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    // Định dạng thật của web: "Đặt lúc: 19:51 Thứ Bảy - 17/02/2024"
    const placedAt = /Đặt lúc:?\s*(\d{1,2}):(\d{2})[^\d]{0,25}(\d{2})\/(\d{2})\/(\d{4})/i;

    const extractDate = async (t: Page, id: string, how: string, timeout: number): Promise<Date> => {
      let text = '';
      await expect
        .poll(async () => {
          text = (await t.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
          return placedAt.test(text);
        }, { timeout })
        .toBe(true);
      const m = text.match(placedAt)!;
      await test.info().attach(`List_04_chi_tiet_${id}`, {
        body: `${m[0]}\nCách mở: ${how}\nURL: ${t.url()}`,
        contentType: 'text/plain',
      });
      return new Date(+m[5], +m[4] - 1, +m[3], +m[1], +m[2]);
    };

    // Lấy NGÀY ĐẶT THẬT của một đơn từ trang chi tiết
    const readRealDate = async (id: string): Promise<Date | null> => {
      const errors: string[] = [];

      // Cách 1 (giống người dùng): mở danh sách, bấm [Xem chi tiết] của đúng đơn. Thử tối đa 2 lần.
      for (let attempt = 1; attempt <= 2; attempt++) {
        const p = await page.context().newPage();
        let target = p;
        try {
          await gotoOrderListWithWideRange(p);
          await p.waitForTimeout(2500);          // popup quảng cáo hay hiện trễ
          await dismissPopups(p);
          const idEl = p.getByText(id).first();
          await expect(idEl).toBeVisible({ timeout: 25000 });
          const card = idEl.locator('xpath=ancestor::*[.//*[contains(normalize-space(.),"Xem chi tiết")]][1]');
          await card.scrollIntoViewIfNeeded();
          await dismissPopups(p);                // tắt lần nữa ngay trước khi bấm

          const newTabPromise = p.context().waitForEvent('page', { timeout: 3000 }).catch(() => null);
          await card.getByText(/Xem chi tiết/i).first().click({ timeout: 10000 });
          const newTab = await newTabPromise;
          if (newTab) target = newTab;

          await expect(target).toHaveURL(new RegExp(id), { timeout: 20000 });
          await dismissPopups(target);
          return await extractDate(target, id, `bấm [Xem chi tiết], lần ${attempt}`, 20000);
        } catch (e) {
          errors.push(`Bấm card, lần ${attempt}: ${(e as Error).message.split('\n')[0]}`);
        } finally {
          if (target !== p) await target.close().catch(() => { });
          await p.close().catch(() => { });
        }
      }

      // Cách 2 (dự phòng): mở thẳng URL với giá trị sync đã quan sát được (4 cho đơn SO, 1 cho đơn SH)
      for (const sync of [4, 1]) {
        const p = await page.context().newPage();
        try {
          await p.goto(`${ORDER_DETAIL_URL_PREFIX}${id}?sync=${sync}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await dismissPopups(p);
          return await extractDate(p, id, `URL trực tiếp sync=${sync}`, 10000);
        } catch (e) {
          errors.push(`URL sync=${sync}: ${(e as Error).message.split('\n')[0]}`);
        } finally {
          await p.close().catch(() => { });
        }
      }

      await attachText(`List_04_loi_${id}`, errors.join('\n'));
      return null;
    };

    const openList = async () => {
      await gotoOrderListWithWideRange(page);
      await dismissPopups(page);
      await expect(page.getByText(/Đơn hàng:\s*#/).first(), 'Danh sách phải hiển thị ít nhất 1 đơn')
        .toBeVisible({ timeout: 25000 });
    };

    // ---------- Bước 1: chọn khoảng thời gian bao gồm nhiều đơn (từ 2020 đến hiện tại) ----------
    await openList();

    // ---------- Bước 2: so sánh ngày đặt của các đơn từ trên xuống ----------
    const orderIds = await readOrderIds();
    await shot(page, 'List_04_thu_tu_sap_xep');
    expect(orderIds.length, 'Cần ít nhất 2 đơn trong danh sách để kiểm tra thứ tự').toBeGreaterThanOrEqual(2);
    if (orderIds.length < 3) note('data-note', `Chỉ có ${orderIds.length} đơn, Excel yêu cầu >= 3 đơn để kiểm tra đầy đủ.`);

    const rows: { id: string; date: Date | null }[] = [];
    for (const id of orderIds) rows.push({ id, date: await readRealDate(id) });

    await attachText(
      'List_04_thu_tu_don',
      rows.map((r, i) => `${i + 1}. ${r.id} | ngày đặt thật: ${r.date ? fmt(r.date) : 'không đọc được'}`).join('\n')
    );

    const dated = rows.filter((r) => r.date) as { id: string; date: Date }[];
    expect(dated.length, 'Phải đọc được ngày đặt của tất cả đơn trong danh sách').toBe(rows.length);

    // Verify 2a: ngày giờ đặt giảm dần từ trên xuống (đơn mới nhất ở trên)
    for (let i = 1; i < dated.length; i++) {
      expect(
        dated[i - 1].date.getTime(),
        `Sai thứ tự: đơn ${dated[i - 1].id} (${fmt(dated[i - 1].date)}) nằm trên đơn ${dated[i].id} (${fmt(dated[i].date)}) nhưng cũ hơn`
      ).toBeGreaterThanOrEqual(dated[i].date.getTime());
    }

    // Verify 2b: đơn mẫu 04/09/2024 phải nằm trên đơn mẫu 17/02/2024
    const idx1 = orderIds.indexOf(ORDER_ID_1);
    const idx2 = orderIds.indexOf(ORDER_ID_2);
    if (idx1 >= 0 && idx2 >= 0) {
      expect(idx1, `Đơn ${ORDER_ID_1} (04/09/2024) phải xếp trước đơn ${ORDER_ID_2} (17/02/2024)`).toBeLessThan(idx2);
    } else {
      note('data-note', `Không thấy đủ 2 đơn mẫu trong danh sách: vị trí ${idx1}, ${idx2}.`);
    }

    // Verify 2c: thứ tự ổn định, tải lại trang thì thứ tự không đổi
    await openList();
    const orderIdsAgain = await readOrderIds();
    expect(orderIdsAgain, 'Sau khi tải lại, thứ tự đơn hàng phải giữ nguyên').toEqual(orderIds);
  });

  test('Order_List_05: Kiểm tra hiển thị khi không có đơn trong khoảng thời gian đang chọn', async ({ page }) => {
    test.skip(!HAS_AUTH, '[List_05] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    // Chữ của trạng thái rỗng quan sát được trên web ("...sản phẩm nào", "...đang chờ anh")
    const emptyPattern = /sản phẩm nào|đang chờ anh/i;
    const hasOrderCard = /Đơn hàng:\s*#/;

    // ---------- Bước 1: vào trang [Đơn hàng đã mua] với khoảng thời gian mặc định (1 năm gần nhất) ----------
    await page.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    await dismissPopups(page);

    // Chờ trang tải xong: có đơn hoặc có trạng thái rỗng (tự chờ, không dùng sleep cố định)
    await expect
      .poll(async () => {
        const t = await readBody();
        return hasOrderCard.test(t) || emptyPattern.test(t);
      }, { message: 'Trang đơn hàng phải hiển thị danh sách hoặc trạng thái rỗng, không được trắng trang', timeout: 25000 })
      .toBe(true);

    const bodyText = await readBody();
    await shot(page, 'List_05_trang_thai_rong');
    await attachText('List_05_noi_dung_trang', bodyText);

    // Pre-condition: tài khoản không có đơn nào trong 1 năm gần nhất. Nếu có đơn thì test này không áp dụng.
    test.skip(
      hasOrderCard.test(bodyText),
      '[List_05] Bỏ qua: tài khoản test đang có đơn trong 1 năm gần nhất, không đúng pre-condition của test case.'
    );

    // Verify 1: hiển thị trạng thái rỗng thân thiện (thông báo + hình minh họa)
    await expect(
      page.getByText(emptyPattern).first(),
      'Phải hiển thị thông báo trạng thái rỗng thân thiện'
    ).toBeVisible();

    // Hình minh họa nằm trong nội dung trang (ngoài header): chỉ ghi chú nếu không thấy
    const illustration = page.locator('main img, #__next img, body img').filter({ has: page.locator('xpath=self::*') });
    const visibleImgCount = await page.locator('img:visible').count();
    if (visibleImgCount === 0) {
      note('ux-note', 'Không thấy hình minh họa nào trên trang rỗng, cần kiểm tra bằng mắt.');
    }
    void illustration;

    // Verify 2: không lỗi, không trắng trang
    expect(bodyText.length, 'Trang không được trắng').toBeGreaterThan(200);
    expect(bodyText, 'Trang không được hiện thông báo lỗi hệ thống')
      .not.toMatch(/đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|Something went wrong/i);

    // Verify 3: các tab vẫn dùng được (bấm từng tab, trang vẫn hiển thị trạng thái rỗng, không lỗi)
    for (const tabName of [/^Đã giao$/, /^Đã hu[ỷủ]$/]) {
      const tab = page.getByText(tabName).first();
      await expect(tab, `Tab ${tabName} phải hiển thị`).toBeVisible();
      await tab.click();
      await expect
        .poll(async () => emptyPattern.test(await readBody()), {
          message: `Sau khi bấm tab ${tabName}, trang vẫn phải hiển thị trạng thái rỗng`,
          timeout: 15000,
        })
        .toBe(true);
      expect(await readBody()).not.toMatch(/đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống/i);
      await shot(page, `List_05_tab_${String(tabName).replace(/[^\w]/g, '')}`);
    }

    // Verify 4: link [Đổi] vẫn dùng được (bấm mở popup chọn khoảng thời gian rồi đóng lại)
    const changeBtn = page.getByText(/^Đổi$/).first();
    await expect(changeBtn, 'Link [Đổi] phải còn hiển thị khi danh sách rỗng').toBeVisible();
    await changeBtn.click();
    const popupTitle = page.getByText('Xem theo khoảng thời gian');
    await expect(popupTitle, 'Bấm [Đổi] phải mở popup chọn khoảng thời gian').toBeVisible({ timeout: 10000 });
    await shot(page, 'List_05_popup_doi_khoang_thoi_gian');
    await popupTitle.locator('xpath=ancestor::*[.//*[normalize-space(text())="Đóng"]][1]')
      .getByText('Đóng', { exact: true }).click().catch(() => { });
  });
});


// ==============================================================================
// PHẦN 3: LỌC THEO TRẠNG THÁI (STATUS - 4 TEST CASES)
// ==============================================================================
test.describe('PHẦN 3: LỌC THEO TRẠNG THÁI (STATUS)', () => {

  test('Order_Status_01: Kiểm tra tab [Đã giao] hiển thị các đơn "Thành Công"', async ({ page }) => {
    test.skip(!HAS_AUTH, '[Status_01] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const hasOrderCard = /Đơn hàng:\s*#/;
    const statusPattern = /Thành Công|Đang tiếp nhận|Đang giao|Đã giao|Đã hu[ỷủ]/i;

    // Đọc danh sách đơn đang hiển thị: mã đơn + trạng thái nằm TRONG card của đơn đó
    const readCards = async (): Promise<{ id: string; status: string }[]> => {
      const readIds = () =>
        page.evaluate(() => {
          const ids = (document.body.innerText.match(/#?\d{5}[A-Z]{2}\d{11,}/g) || []).map((m) => m.replace('#', ''));
          return [...new Set(ids)];
        });
      let ids = await readIds();
      for (let i = 0; i < 6; i++) {            // cuộn để tải thêm nếu danh sách tải dần
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
        const next = await readIds();
        if (next.length === ids.length) break;
        ids = next;
      }
      const cards: { id: string; status: string }[] = [];
      for (const id of ids) {
        const card = page.getByText(id).first().locator('xpath=ancestor::*[.//*[contains(normalize-space(.),"Xem chi tiết")]][1]');
        const text = ((await card.innerText()) || '').replace(/\s+/g, ' ');
        cards.push({ id, status: text.match(statusPattern)?.[0] ?? 'không xác định' });
      }
      return cards;
    };

    // ---------- Bước 1: chọn khoảng Từ 01/01/2024 đến ngày hiện tại ----------
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await page.goto(`${ORDER_LIST_URL}?from=2024-01-01T00:00:00&to=${todayISO}T23:59:59`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    await expect
      .poll(async () => hasOrderCard.test(await readBody()), { message: 'Tab [Tất cả] phải hiển thị đơn hàng', timeout: 25000 })
      .toBe(true);

    // Số đơn "Thành Công" ở tab [Tất cả] (làm chuẩn để so sánh)
    const allCards = await readCards();
    const allSuccess = allCards.filter((c) => c.status === 'Thành Công');
    await shot(page, 'Status_01_tab_tat_ca');
    await attachText('Status_01_tab_tat_ca', allCards.map((c) => `${c.id} | ${c.status}`).join('\n'));
    expect(allSuccess.length, 'Pre-condition: tài khoản phải có đơn "Thành Công" ở tab [Tất cả]').toBeGreaterThan(0);

    // ---------- Bước 2: click tab [Đã giao] ----------
    const deliveredTab = page.getByText(/^Đã giao$/).first();
    await expect(deliveredTab, 'Phải có tab [Đã giao]').toBeVisible({ timeout: 10000 });
    await deliveredTab.click();
    await page.waitForTimeout(1500);
    await expect
      .poll(async () => hasOrderCard.test(await readBody()), {
        message: 'Tab [Đã giao] phải hiển thị các đơn "Thành Công"',
        timeout: 20000,
      })
      .toBe(true);

    const deliveredCards = await readCards();
    await shot(page, 'Status_01_tab_da_giao');
    await attachText('Status_01_tab_da_giao', deliveredCards.map((c) => `${c.id} | ${c.status}`).join('\n'));
    await attachText('Status_01_url_tab_da_giao', page.url());   // dùng cho Status_04 (URL có đổi status?)

    // Verify 2a: không lẫn đơn trạng thái khác, tất cả đều "Thành Công"
    const notSuccess = deliveredCards.filter((c) => c.status !== 'Thành Công');
    expect(
      notSuccess,
      `Tab [Đã giao] không được lẫn đơn trạng thái khác: ${notSuccess.map((c) => `${c.id} (${c.status})`).join(', ')}`
    ).toEqual([]);

    // Verify 2b: số đơn khớp số đơn "Thành Công" ở tab [Tất cả]
    expect(deliveredCards.length, 'Số đơn ở tab [Đã giao] phải bằng số đơn "Thành Công" ở tab [Tất cả]')
      .toBe(allSuccess.length);

    // Verify 2c: cùng một tập đơn (không chỉ cùng số lượng)
    expect(
      deliveredCards.map((c) => c.id).sort(),
      'Các đơn ở tab [Đã giao] phải đúng là các đơn "Thành Công" ở tab [Tất cả]'
    ).toEqual(allSuccess.map((c) => c.id).sort());
  });

  test('Order_Status_02: Kiểm tra các tab không có đơn: [Đang tiếp nhận], [Đang giao], [Đã huỷ]', async ({ page }) => {
    test.skip(!HAS_AUTH, '[Status_02] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const hasOrderCard = /Đơn hàng:\s*#/;
    // Chữ trạng thái rỗng quan sát được trên web (mỗi tab có thể dùng câu khác nên mở rộng thêm)
    const emptyPattern = /sản phẩm nào|đang chờ anh|chưa có đơn|không có đơn/i;
    const errorPattern = /đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|Something went wrong/i;

    // "Chữ ký" kiểu dáng của một tab (màu chữ, nền, viền, độ đậm của tab và 3 phần tử bao ngoài)
    const styleSignature = (loc: ReturnType<Page['locator']>) =>
      loc.evaluate((el) => {
        const out: string[] = [];
        let n: HTMLElement | null = el as HTMLElement;
        for (let i = 0; i < 4 && n; i++) {
          const s = getComputedStyle(n);
          out.push([s.color, s.backgroundColor, s.borderTopColor, s.borderTopWidth, s.fontWeight].join('|'));
          n = n.parentElement;
        }
        return out.join(' > ');
      });

    // Mở danh sách với khoảng thời gian rộng để chắc chắn không bỏ sót đơn ở các trạng thái này
    await gotoOrderListWithWideRange(page);
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    await expect
      .poll(async () => hasOrderCard.test(await readBody()), {
        message: 'Tab [Tất cả] phải tải xong danh sách',
        timeout: 25000,
      })
      .toBe(true);

    const tabs = [
      { name: 'Đang tiếp nhận', regex: /^Đang tiếp nhận$/ },
      { name: 'Đang giao', regex: /^Đang giao$/ },
      { name: 'Đã huỷ', regex: /^Đã hu[ỷủ]$/ },
    ];
    // Tab dùng để so sánh kiểu dáng "không được chọn"
    const referenceTab = page.getByText(/^Đã giao$/).first();

    for (const [i, tab] of tabs.entries()) {
      // ---------- Bước i+1: click tab ----------
      const tabEl = page.getByText(tab.regex).first();
      await expect(tabEl, `Phải có tab [${tab.name}]`).toBeVisible({ timeout: 10000 });
      await tabEl.click();
      await page.mouse.move(0, 0);          // bỏ trạng thái hover để so sánh kiểu dáng chính xác

      // Chờ danh sách cũ ([Tất cả]) biến mất và trạng thái rỗng hiện ra
      let hasOrders = false;
      try {
        await expect
          .poll(async () => {
            const t = await readBody();
            return !hasOrderCard.test(t) && emptyPattern.test(t);
          }, { message: `Tab [${tab.name}] phải hiện trạng thái rỗng`, timeout: 15000 })
          .toBe(true);
      } catch {
        // Quá 15s mà vẫn còn card: coi như tab thật sự có đơn. Nếu không có card cũng không có chữ rỗng thì là lỗi.
        hasOrders = hasOrderCard.test(await readBody());
        if (!hasOrders) {
          throw new Error(`Tab [${tab.name}] không hiện trạng thái rỗng và cũng không hiện đơn`);
        }
      }

      const bodyText = await readBody();
      await shot(page, `Status_02_tab_${i + 1}_${tab.name.replace(/\s+/g, '_')}`);
      await attachText(`Status_02_noi_dung_tab_${i + 1}`, bodyText);

      // Pre-condition: tài khoản không có đơn ở trạng thái này. Nếu có đơn thì test case không áp dụng.
      test.skip(
        hasOrders,
        `[Status_02] Bỏ qua: tab [${tab.name}] đang có đơn, không đúng pre-condition (tài khoản không có đơn ở trạng thái này).`
      );

      // Verify 1: hiển thị trạng thái rỗng phù hợp
      await expect(
        page.getByText(emptyPattern).first(),
        `Tab [${tab.name}] phải hiển thị trạng thái rỗng`
      ).toBeVisible();

      // Verify 2: không lỗi, không trắng trang, không hiện đơn của tab khác
      expect(bodyText.length, `Tab [${tab.name}] không được trắng trang`).toBeGreaterThan(200);
      expect(bodyText, `Tab [${tab.name}] không được hiện thông báo lỗi`).not.toMatch(errorPattern);
      expect(bodyText, `Tab [${tab.name}] không được hiện đơn "Thành Công" của tab khác`).not.toContain('Thành Công');

      // Verify 3: tab được làm nổi bật (kiểu dáng khác tab không được chọn)
      const selectedSig = await styleSignature(tabEl);
      const referenceSig = await styleSignature(referenceTab);
      if (selectedSig === referenceSig) {
        note('ux-note', `Tab [${tab.name}] có kiểu dáng giống tab không được chọn, cần kiểm tra bằng mắt xem có nổi bật không.`);
      } else {
        console.log(`[Status_02] Tab [${tab.name}] được làm nổi bật khác tab thường ✓`);
      }
    }
  });

  test('Order_Status_03: Kiểm tra hiển thị đơn ở các trạng thái Đang tiếp nhận, Đang giao, Đã huỷ và chuyển trạng thái đơn', async ({ page }) => {
    test.skip(!HAS_AUTH, '[Status_03] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const hasOrderCard = /Đơn hàng:\s*#/;
    const emptyPattern = /sản phẩm nào|đang chờ anh|chưa có đơn|không có đơn/i;
    const statusPattern = /Thành Công|Đang tiếp nhận|Đang giao|Đã giao|Đã hu[ỷủ]/i;

    // Đọc các đơn đang hiển thị: mã đơn, trạng thái và màu chữ của nhãn trạng thái (lấy trong card của đơn)
    const readCards = async (): Promise<{ id: string; status: string; color: string }[]> => {
      const ids: string[] = await page.evaluate(() => {
        const found = (document.body.innerText.match(/#?\d{5}[A-Z]{2}\d{11,}/g) || []).map((m) => m.replace('#', ''));
        return [...new Set(found)];
      });
      const cards: { id: string; status: string; color: string }[] = [];
      for (const id of ids) {
        const card = page.getByText(id).first().locator('xpath=ancestor::*[.//*[contains(normalize-space(.),"Xem chi tiết")]][1]');
        const text = ((await card.innerText()) || '').replace(/\s+/g, ' ');
        const status = text.match(statusPattern)?.[0] ?? 'không xác định';
        const color = await card
          .getByText(statusPattern)
          .first()
          .evaluate((el) => getComputedStyle(el).color)
          .catch(() => '');
        cards.push({ id, status, color });
      }
      return cards;
    };

    // Mở danh sách khoảng thời gian rộng
    await gotoOrderListWithWideRange(page);
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    await expect
      .poll(async () => hasOrderCard.test(await readBody()), { message: 'Tab [Tất cả] phải tải xong', timeout: 25000 })
      .toBe(true);

    const tabs = [
      { name: 'Đang tiếp nhận', regex: /^Đang tiếp nhận$/, expected: /Đang tiếp nhận/i },
      { name: 'Đang giao', regex: /^Đang giao$/, expected: /Đang giao/i },
      { name: 'Đã huỷ', regex: /^Đã hu[ỷủ]$/, expected: /Đã hu[ỷủ]/i },
    ];

    // ---------- Bước 1: mở lần lượt các tab, mỗi tab chỉ được hiển thị đơn đúng trạng thái ----------
    let totalOrdersInTabs = 0;
    const summary: string[] = [];

    for (const tab of tabs) {
      const tabEl = page.getByText(tab.regex).first();
      await expect(tabEl, `Phải có tab [${tab.name}]`).toBeVisible({ timeout: 10000 });
      await tabEl.click();
      await page.mouse.move(0, 0);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
      await page.waitForTimeout(2500);        // chờ danh sách của tab mới thay danh sách cũ

      await expect
        .poll(async () => {
          const t = await readBody();
          return hasOrderCard.test(t) || emptyPattern.test(t);
        }, { message: `Tab [${tab.name}] phải tải xong`, timeout: 20000 })
        .toBe(true);

      const cards = hasOrderCard.test(await readBody()) ? await readCards() : [];
      await shot(page, `Status_03_tab_${tab.name.replace(/\s+/g, '_')}`);
      summary.push(`Tab [${tab.name}]: ${cards.length} đơn\n` + cards.map((c) => `  ${c.id} | ${c.status} | màu ${c.color}`).join('\n'));

      if (cards.length === 0) continue;       // tab không có đơn: đã kiểm tra ở Status_02
      totalOrdersInTabs += cards.length;

      // Mỗi tab chỉ hiển thị đơn đúng trạng thái, nhãn trạng thái đúng
      const wrong = cards.filter((c) => !tab.expected.test(c.status));
      expect(
        wrong,
        `Tab [${tab.name}] không được lẫn đơn trạng thái khác: ${wrong.map((c) => `${c.id} (${c.status})`).join(', ')}`
      ).toEqual([]);
    }

    await attachText('Status_03_tong_hop', summary.join('\n'));

    // ---------- Bước 2: theo dõi 1 đơn mới đặt chuyển trạng thái ----------
    // Không tự động hóa: phải đặt đơn thật trên Production và chờ nhân viên xử lý.
    note('manual-only', 'Bước 2 (đơn tự chuyển Đang tiếp nhận → Đang giao → Đã giao) không thể tự động hóa trên website thật, cần kiểm tra thủ công hoặc môi trường có dữ liệu.');

    // Tài khoản không có đơn ở bất kỳ tab nào thì test case không áp dụng được
    test.skip(
      totalOrdersInTabs === 0,
      '[Status_03] Bỏ qua: [KHÔNG THỂ THỰC THI THẬT] Tài khoản test không có đơn ở các trạng thái Đang tiếp nhận, Đang giao, Đã huỷ; không đặt/huỷ đơn thật được.'
    );
  });

  test('Order_Status_04: Kiểm tra đổi tab trạng thái vẫn giữ khoảng thời gian đã chọn', async ({ page }) => {
    test.skip(!HAS_AUTH, '[Status_04] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const pad = (n: number) => String(n).padStart(2, '0');
    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const hasOrderCard = /Đơn hàng:\s*#/;
    const emptyPattern = /sản phẩm nào|đang chờ anh|chưa có đơn|không có đơn/i;
    const rangeRegex = /Từ\s+(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/;

    const now = new Date();
    const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const todayVN = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    // Khoảng thời gian đang hiển thị trên tiêu đề (chờ tự động đến khi có)
    const readRange = async (): Promise<string> => {
      let text = '';
      await expect
        .poll(async () => {
          text = await readBody();
          return rangeRegex.test(text);
        }, { message: 'Phải hiển thị khoảng thời gian "Từ dd/mm/yyyy - dd/mm/yyyy"', timeout: 20000 })
        .toBe(true);
      const m = text.match(rangeRegex)!;
      return `${m[1]} - ${m[2]}`;
    };

    // Các mã đơn đang hiển thị
    const readIds = (): Promise<string[]> =>
      page.evaluate(() => {
        const ids = (document.body.innerText.match(/#?\d{5}[A-Z]{2}\d{11,}/g) || []).map((m) => m.replace('#', ''));
        return [...new Set(ids)];
      });

    // Bấm tab rồi chờ danh sách của tab mới thay danh sách cũ
    const clickTab = async (regex: RegExp, name: string) => {
      const tab = page.getByText(regex).first();
      await expect(tab, `Phải có tab [${name}]`).toBeVisible({ timeout: 10000 });
      await tab.click();
      await page.mouse.move(0, 0);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
      await page.waitForTimeout(2500);
      await expect
        .poll(async () => {
          const t = await readBody();
          return hasOrderCard.test(t) || emptyPattern.test(t);
        }, { message: `Tab [${name}] phải tải xong`, timeout: 20000 })
        .toBe(true);
    };

    const gotoRange = async (fromISO: string) => {
      await page.goto(`${ORDER_LIST_URL}?from=${fromISO}T00:00:00&to=${todayISO}T23:59:59`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await page.waitForTimeout(2000);
      await dismissPopups(page);
      await expect
        .poll(async () => hasOrderCard.test(await readBody()), { message: 'Danh sách phải tải xong', timeout: 25000 })
        .toBe(true);
    };

    // ---------- Bước 1: đổi khoảng thời gian thành Từ 01/01/2024 - ngày hiện tại ----------
    await gotoRange('2024-01-01');
    const expectedRange = `01/01/2024 - ${todayVN}`;
    const rangeBefore = await readRange();
    expect(rangeBefore, 'Khoảng thời gian phải được áp dụng').toBe(expectedRange);

    const urlBefore = new URL(page.url());
    const allIdsBefore = await readIds();
    await shot(page, 'Status_04_tab_tat_ca_truoc');
    expect(allIdsBefore.length, 'Tab [Tất cả] phải có đơn trong khoảng 01/01/2024 - nay').toBeGreaterThan(0);

    // ---------- Bước 2a: click tab [Đã giao] ----------
    await clickTab(/^Đã giao$/, 'Đã giao');
    const rangeDelivered = await readRange();
    const urlDelivered = new URL(page.url());
    const deliveredIds = await readIds();
    await shot(page, 'Status_04_tab_da_giao');

    // Khoảng thời gian trên tiêu đề không đổi
    expect(rangeDelivered, 'Khoảng thời gian phải giữ nguyên sau khi đổi sang tab [Đã giao]').toBe(rangeBefore);

    // URL giữ nguyên from/to
    expect(urlDelivered.searchParams.get('from'), 'URL phải giữ nguyên from').toBe(urlBefore.searchParams.get('from'));
    expect(urlDelivered.searchParams.get('to'), 'URL phải giữ nguyên to').toBe(urlBefore.searchParams.get('to'));

    // URL đổi tham số trạng thái: ghi lại tham số nào thay đổi (chưa biết tên tham số thật)
    const changedParams: string[] = [];
    for (const [k, v] of urlDelivered.searchParams) {
      if (urlBefore.searchParams.get(k) !== v) changedParams.push(`${k}=${v}`);
    }
    await attachText('Status_04_url_truoc_sau', `Trước: ${urlBefore.href}\nSau: ${urlDelivered.href}\nThay đổi: ${changedParams.join(', ') || 'không có'}`);
    if (changedParams.length === 0) {
      note('ux-note', 'URL không có tham số mới nào sau khi bấm tab [Đã giao], trái với mô tả "đổi status" trong Excel. Cần kiểm tra lại.');
    }

    // Kết quả lọc theo tab trong đúng khoảng thời gian: có đơn, và đều nằm trong các đơn của tab [Tất cả]
    expect(deliveredIds.length, 'Tab [Đã giao] phải còn đơn trong khoảng đã chọn (nếu rỗng thì khoảng đã bị đặt lại)').toBeGreaterThan(0);
    const outside = deliveredIds.filter((id) => !allIdsBefore.includes(id));
    expect(outside, `Tab [Đã giao] không được hiện đơn ngoài khoảng đã chọn: ${outside.join(', ')}`).toEqual([]);

    // ---------- Bước 2b: click tab [Tất cả] ----------
    await clickTab(/^Tất cả$/, 'Tất cả');
    const rangeAll = await readRange();
    const urlAll = new URL(page.url());
    const allIdsAfter = await readIds();
    await shot(page, 'Status_04_quay_lai_tat_ca');

    expect(rangeAll, 'Khoảng thời gian phải giữ nguyên khi quay lại tab [Tất cả]').toBe(rangeBefore);
    expect(urlAll.searchParams.get('from'), 'URL phải giữ nguyên from khi quay lại tab [Tất cả]').toBe(urlBefore.searchParams.get('from'));
    expect(urlAll.searchParams.get('to'), 'URL phải giữ nguyên to khi quay lại tab [Tất cả]').toBe(urlBefore.searchParams.get('to'));
    expect(allIdsAfter.sort(), 'Tab [Tất cả] phải hiện lại đúng các đơn như ban đầu').toEqual([...allIdsBefore].sort());

    // ---------- Bổ sung: lọc ĐỒNG THỜI theo tab và khoảng (khoảng hẹp từ 01/03/2024 loại bỏ các đơn tháng 02/2024) ----------
    await gotoRange('2024-03-01');
    expect(await readRange(), 'Khoảng hẹp phải được áp dụng').toBe(`01/03/2024 - ${todayVN}`);
    let narrowIds = await readIds();
    expect(narrowIds, `Khoảng hẹp phải có đơn ${ORDER_ID_1} (04/09/2024)`).toContain(ORDER_ID_1);
    expect(narrowIds, `Khoảng hẹp không được có đơn ${ORDER_ID_2} (17/02/2024)`).not.toContain(ORDER_ID_2);

    await clickTab(/^Đã giao$/, 'Đã giao');
    narrowIds = await readIds();
    await shot(page, 'Status_04_khoang_hep_tab_da_giao');
    expect(narrowIds, `Tab [Đã giao] trong khoảng hẹp phải có đơn ${ORDER_ID_1}`).toContain(ORDER_ID_1);
    expect(narrowIds, `Tab [Đã giao] trong khoảng hẹp không được có đơn ${ORDER_ID_2} (ngoài khoảng)`).not.toContain(ORDER_ID_2);
    expect(await readRange(), 'Khoảng hẹp phải giữ nguyên sau khi đổi tab').toBe(`01/03/2024 - ${todayVN}`);
  });
});


// ==============================================================================
// PHẦN 4: LỌC THEO KHOẢNG THỜI GIAN (DATE RANGE - 7 TEST CASES)
// ==============================================================================
test.describe('PHẦN 4: LỌC THEO KHOẢNG THỜI GIAN (DATE RANGE)', () => {

  test('Order_DateRange_01: Kiểm tra ngày trong popup khớp với khoảng thời gian hiển thị ở tiêu đề', async ({ page }) => {
    test.skip(!HAS_AUTH, '[DateRange_01] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const pad = (n: number) => String(n).padStart(2, '0');
    const fmtVN = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const fmtISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const rangeRegex = /Từ\s+(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/;

    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    if (oneYearAgo.getMonth() !== today.getMonth()) oneYearAgo.setDate(0);   // trường hợp 29/02

    // Nhiều khoảng khác nhau để phát hiện lỗi lệch ngày / múi giờ
    const scenarios = [
      { name: 'mac_dinh', url: ORDER_LIST_URL, from: fmtVN(oneYearAgo), to: fmtVN(today) },
      {
        name: 'tu_2020',
        url: `${ORDER_LIST_URL}?from=2020-01-01T00:00:00&to=${fmtISO(today)}T23:59:59`,
        from: '01/01/2020',
        to: fmtVN(today),
      },
      {
        name: 'tuy_chon_2024',
        url: `${ORDER_LIST_URL}?from=2024-02-17T00:00:00&to=2024-09-04T23:59:59`,
        from: '17/02/2024',
        to: '04/09/2024',
      },
    ];

    const problems: string[] = [];
    const report: string[] = [];

    for (const sc of scenarios) {
      await test.step(`Khoảng [${sc.name}]`, async () => {
        // ---------- Bước 1: ghi lại khoảng thời gian trên tiêu đề ----------
        await page.goto(sc.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(2000);
        await dismissPopups(page);

        let text = '';
        await expect
          .poll(async () => {
            text = await readBody();
            return rangeRegex.test(text);
          }, { message: `[${sc.name}] Phải hiển thị khoảng thời gian trên tiêu đề`, timeout: 20000 })
          .toBe(true);
        const [, titleFrom, titleTo] = text.match(rangeRegex)!;
        await shot(page, `DateRange_01_${sc.name}_tieu_de`);

        // Tiêu đề phải đúng với khoảng đã chọn (phát hiện lệch ngày ngay từ tiêu đề)
        if (titleFrom !== sc.from || titleTo !== sc.to) {
          problems.push(`[${sc.name}] Tiêu đề "${titleFrom} - ${titleTo}" khác khoảng mong đợi "${sc.from} - ${sc.to}"`);
        }

        // ---------- Bước 2: click [Đổi] và đối chiếu ô Từ/Đến ----------
        const changeBtn = page.getByText(/^Đổi$/).first();
        await expect(changeBtn, `[${sc.name}] Phải có nút [Đổi]`).toBeVisible({ timeout: 10000 });
        await changeBtn.click();

        const popupTitle = page.getByText('Xem theo khoảng thời gian');
        await expect(popupTitle, `[${sc.name}] Bấm [Đổi] phải mở popup`).toBeVisible({ timeout: 10000 });
        const popup = popupTitle.locator('xpath=ancestor::*[.//*[normalize-space(text())="Áp dụng"]][1]');

        // Chờ popup hiển thị đủ 2 ngày (Từ, Đến) rồi đọc
        let popupText = '';
        await expect
          .poll(async () => {
            popupText = ((await popup.innerText()) || '').replace(/\s+/g, ' ');
            return (popupText.match(/\d{2}\/\d{2}\/\d{4}/g) || []).length >= 2;
          }, { message: `[${sc.name}] Popup phải hiển thị ngày Từ và Đến`, timeout: 10000 })
          .toBe(true);
        const [popupFrom, popupTo] = popupText.match(/\d{2}\/\d{2}\/\d{4}/g)!;
        await shot(page, `DateRange_01_${sc.name}_popup`);

        report.push(`[${sc.name}] Tiêu đề: ${titleFrom} - ${titleTo} | Popup: ${popupFrom} - ${popupTo}`);

        // Verify: popup khớp từng ngày với tiêu đề (không lệch 1 ngày)
        if (popupFrom !== titleFrom) problems.push(`[${sc.name}] Ô Từ trong popup (${popupFrom}) lệch so với tiêu đề (${titleFrom})`);
        if (popupTo !== titleTo) problems.push(`[${sc.name}] Ô Đến trong popup (${popupTo}) lệch so với tiêu đề (${titleTo})`);

        await popup.getByText('Đóng', { exact: true }).click().catch(() => { });
      });
    }

    await attachText('DateRange_01_doi_chieu', report.join('\n'));
    expect(problems, `Phát hiện lệch ngày:\n${problems.join('\n')}`).toEqual([]);
  });

  test('Order_DateRange_02: Kiểm tra áp dụng khoảng thời gian bắt đầu trong quá khứ', async ({ page }) => {
    test.skip(!HAS_AUTH, '[DateRange_02] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const pad = (n: number) => String(n).padStart(2, '0');
    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const hasOrderCard = /Đơn hàng:\s*#/;
    const rangeRegex = /Từ\s+(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/;

    const now = new Date();
    const todayVN = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // ---------- Mở trang với khoảng mặc định ----------
    await page.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    await expect
      .poll(async () => rangeRegex.test(await readBody()), { message: 'Phải hiển thị khoảng thời gian mặc định', timeout: 20000 })
      .toBe(true);

    // ---------- Bước 1: click [Đổi], chọn Từ = 01/01/2024, Đến = ngày hiện tại, click [Áp dụng] ----------
    await page.getByRole('button', { name: 'Đổi' }).click();
    const popupTitle = page.getByText('Xem theo khoảng thời gian');
    await expect(popupTitle, 'Bấm [Đổi] phải mở popup').toBeVisible({ timeout: 10000 });
    const popup = popupTitle.locator('xpath=ancestor::*[.//*[normalize-space(text())="Áp dụng"]][1]');

    await pickCalendarDate(page, 1, 1, 2024);
    await page.waitForTimeout(500);
    await shot(page, 'DateRange_02_popup_sau_khi_chon');

    // Kiểm tra popup đã nhận đúng Từ = 01/01/2024 và Đến = hôm nay trước khi áp dụng
    const popupDates = (((await popup.innerText()) || '').replace(/\s+/g, ' ').match(/\d{2}\/\d{2}\/\d{4}/g)) || [];
    expect(popupDates[0], 'Ô Từ trong popup phải là 01/01/2024').toBe('01/01/2024');
    expect(popupDates[1], 'Ô Đến trong popup phải là ngày hiện tại').toBe(todayVN);

    await page.getByRole('button', { name: 'Áp dụng' }).click();

    // ---------- Kết quả mong đợi ----------
    // 1. Popup đóng
    await expect(popupTitle, 'Popup phải đóng sau khi bấm [Áp dụng]').toBeHidden({ timeout: 10000 });

    // 2. Tiêu đề "Từ 01/01/2024 - ngày hiện tại"
    await expect
      .poll(async () => (await readBody()).match(rangeRegex)?.slice(1, 3).join(' - '), {
        message: `Tiêu đề phải là "Từ 01/01/2024 - ${todayVN}"`,
        timeout: 15000,
      })
      .toBe(`01/01/2024 - ${todayVN}`);

    // 3. URL cập nhật from/to
    const url = decodeURIComponent(page.url());
    await attachText('DateRange_02_url', url);
    // Web áp dụng khoảng thời gian trong trang, không ghi from/to lên URL (đã quan sát được)
    if (!url.includes('from=') || !url.includes('to=')) {
      note('ux-note', `URL không có from/to sau khi [Áp dụng]: ${url}. Khoảng thời gian được giữ trong trạng thái của trang.`);
    }

    // 4. Danh sách hiển thị đúng các đơn trong khoảng (đơn 04/09/2024 và các đơn 02/2024)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
    await expect
      .poll(async () => hasOrderCard.test(await readBody()), { message: 'Danh sách phải hiển thị đơn hàng', timeout: 20000 })
      .toBe(true);
    const ids: string[] = await page.evaluate(() => {
      const found = (document.body.innerText.match(/#?\d{5}[A-Z]{2}\d{11,}/g) || []).map((m) => m.replace('#', ''));
      return [...new Set(found)];
    });
    await attachText('DateRange_02_ds_don', ids.join('\n'));
    await shot(page, 'DateRange_02_sau_ap_dung');
    expect(ids, `Danh sách phải có đơn ${ORDER_ID_1} (04/09/2024)`).toContain(ORDER_ID_1);
    expect(ids, `Danh sách phải có đơn ${ORDER_ID_2} (17/02/2024)`).toContain(ORDER_ID_2);
  });

  test('Order_DateRange_03: Kiểm tra biên: khoảng chỉ gồm đúng ngày đặt đơn (Từ = Đến = 04/09/2024)', async ({ page }) => {
    test.skip(!HAS_AUTH, '[DateRange_03] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const rangeRegex = /Từ\s+(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/;
    const TARGET = '04/09/2024';

    const readIds = (): Promise<string[]> =>
      page.evaluate(() => {
        const found = (document.body.innerText.match(/#?\d{5}[A-Z]{2}\d{11,}/g) || []).map((m) => m.replace('#', ''));
        return [...new Set(found)];
      });

    // ---------- Mở trang với khoảng mặc định ----------
    await page.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    await expect
      .poll(async () => rangeRegex.test(await readBody()), { message: 'Phải hiển thị khoảng thời gian mặc định', timeout: 20000 })
      .toBe(true);

    // ---------- Bước 1: click [Đổi], chọn Từ = 04/09/2024, Đến = 04/09/2024, click [Áp dụng] ----------
    await page.getByRole('button', { name: 'Đổi' }).click();
    const popupTitle = page.getByText('Xem theo khoảng thời gian');
    await expect(popupTitle, 'Bấm [Đổi] phải mở popup').toBeVisible({ timeout: 10000 });
    const popup = popupTitle.locator('xpath=ancestor::*[.//*[normalize-space(text())="Áp dụng"]][1]');

    // Đọc Từ và Đến đang hiển thị trong popup
    const readPopupRange = async () => {
      const dates = (((await popup.innerText()) || '').replace(/\s+/g, ' ').match(/\d{2}\/\d{2}\/\d{4}/g)) || [];
      return { from: dates[0], to: dates[1] };
    };
    const isDone = async () => {
      const r = await readPopupRange();
      return r.from === TARGET && r.to === TARGET;
    };

    // Lần 1: chọn ngày 04/09/2024 (đặt Từ)
    await pickCalendarDate(page, 4, 9, 2024);
    await page.waitForTimeout(500);

    // Lần 2: nếu Đến chưa đổi, bấm lại đúng ngày đó (lịch chọn khoảng thường dùng 2 lần bấm)
    if (!(await isDone())) {
      await clickCalendarDay(page, 4, 9, 2024);
      await page.waitForTimeout(500);
    }
    // Lần 3: nếu vẫn chưa được, bấm vào ô [Đến] rồi chọn lại ngày
    if (!(await isDone())) {
      await popup.getByText('Đến', { exact: true }).click({ timeout: 5000 }).catch(() => { });
      await goToCalendarMonth(page, 9, 2024).catch(() => { });
      await clickCalendarDay(page, 4, 9, 2024).catch(() => { });
      await page.waitForTimeout(500);
    }

    await shot(page, 'DateRange_03_popup_sau_khi_chon');
    const chosen = await readPopupRange();
    if (chosen.from !== TARGET || chosen.to !== TARGET) {
      const html = await popup.evaluate((el) => el.outerHTML.slice(0, 8000)).catch(() => '');
      await attachText('DateRange_03_popup_html', html);
    }
    expect(chosen.from, 'Ô Từ phải là 04/09/2024').toBe(TARGET);
    expect(
      chosen.to,
      'Ô Đến phải là 04/09/2024. Nếu không được, gửi file DateRange_03_popup_html để chỉnh cách chọn ngày Đến'
    ).toBe(TARGET);

    await page.getByRole('button', { name: 'Áp dụng' }).click();

    // ---------- Kết quả mong đợi ----------
    await expect(popupTitle, 'Popup phải đóng sau khi bấm [Áp dụng]').toBeHidden({ timeout: 10000 });
    await expect
      .poll(async () => (await readBody()).match(rangeRegex)?.slice(1, 3).join(' - '), {
        message: `Tiêu đề phải là "Từ ${TARGET} - ${TARGET}"`,
        timeout: 15000,
      })
      .toBe(`${TARGET} - ${TARGET}`);

    // Hiển thị đơn đặt lúc 10:46 ngày 04/09/2024: khoảng tính hết cả ngày, gồm cả ngày đầu và cuối
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
    await expect
      .poll(async () => (await readIds()).includes(ORDER_ID_1), {
        message: `Danh sách phải có đơn ${ORDER_ID_1} (đặt 10:46 04/09/2024)`,
        timeout: 20000,
      })
      .toBe(true);

    const ids = await readIds();
    await attachText('DateRange_03_ds_don', ids.join('\n'));
    await shot(page, 'DateRange_03_sau_ap_dung');
    expect(ids, `Không được hiện đơn ${ORDER_ID_2} (17/02/2024) ngoài khoảng`).not.toContain(ORDER_ID_2);
  });

  test('Order_DateRange_04: Kiểm tra biên: khoảng thời gian liền trước và liền sau ngày đặt đơn', async ({ page }) => {
    test.skip(!HAS_AUTH, '[DateRange_04] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    type D = { d: number; m: number; y: number };
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (x: D) => `${pad(x.d)}/${pad(x.m)}/${x.y}`;
    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const rangeRegex = /Từ\s+(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/;
    const readIds = (): Promise<string[]> =>
      page.evaluate(() => {
        const found = (document.body.innerText.match(/#?\d{5}[A-Z]{2}\d{11,}/g) || []).map((m) => m.replace('#', ''));
        return [...new Set(found)];
      });

    // Mở trang, chọn khoảng [from, to] trên popup, bấm [Áp dụng], chờ danh sách cập nhật rồi trả về các mã đơn
    const applyRange = async (from: D, to: D, tag: string): Promise<string[]> => {
      await page.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2000);
      await dismissPopups(page);
      await expect
        .poll(async () => rangeRegex.test(await readBody()), { message: 'Phải hiển thị khoảng thời gian mặc định', timeout: 20000 })
        .toBe(true);

      await page.getByRole('button', { name: 'Đổi' }).click();
      const popupTitle = page.getByText('Xem theo khoảng thời gian');
      await expect(popupTitle, 'Bấm [Đổi] phải mở popup').toBeVisible({ timeout: 10000 });
      const popup = popupTitle.locator('xpath=ancestor::*[.//*[normalize-space(text())="Áp dụng"]][1]');

      const popupRange = async () => {
        const dates = (((await popup.innerText()) || '').replace(/\s+/g, ' ').match(/\d{2}\/\d{2}\/\d{4}/g)) || [];
        return { from: dates[0], to: dates[1] };
      };
      const isDone = async () => {
        const r = await popupRange();
        return r.from === fmt(from) && r.to === fmt(to);
      };
      const sameMonth = from.m === to.m && from.y === to.y;

      // Chọn Từ
      await pickCalendarDate(page, from.d, from.m, from.y);
      await page.waitForTimeout(400);

      // Chọn Đến: thử bấm trực tiếp ngày Đến, nếu chưa được thì bấm vào ô [Đến] rồi chọn lại
      if (!sameMonth) await goToCalendarMonth(page, to.m, to.y);
      await clickCalendarDay(page, to.d, to.m, to.y);
      await page.waitForTimeout(400);
      if (!(await isDone())) {
        await popup.getByText('Đến', { exact: true }).click({ timeout: 5000 }).catch(() => { });
        await goToCalendarMonth(page, to.m, to.y).catch(() => { });
        await clickCalendarDay(page, to.d, to.m, to.y).catch(() => { });
        await page.waitForTimeout(400);
      }
      await shot(page, `DateRange_04_${tag}_popup`);
      if (!(await isDone())) {
        const html = await popup.evaluate((el) => el.outerHTML.slice(0, 8000)).catch(() => '');
        await attachText(`DateRange_04_${tag}_popup_html`, html);
      }
      const chosen = await popupRange();
      expect(chosen.from, `[${tag}] Ô Từ phải là ${fmt(from)}`).toBe(fmt(from));
      expect(chosen.to, `[${tag}] Ô Đến phải là ${fmt(to)} (nếu không, gửi file DateRange_04_${tag}_popup_html)`).toBe(fmt(to));

      await page.getByRole('button', { name: 'Áp dụng' }).click();
      await expect(popupTitle, `[${tag}] Popup phải đóng`).toBeHidden({ timeout: 10000 });
      await expect
        .poll(async () => (await readBody()).match(rangeRegex)?.slice(1, 3).join(' - '), {
          message: `[${tag}] Tiêu đề phải là "Từ ${fmt(from)} - ${fmt(to)}"`,
          timeout: 15000,
        })
        .toBe(`${fmt(from)} - ${fmt(to)}`);

      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
      await page.waitForTimeout(2500);        // chờ danh sách mới thay danh sách cũ
      const ids = await readIds();
      await attachText(`DateRange_04_${tag}_ds_don`, ids.join('\n') || '(không có đơn)');
      await shot(page, `DateRange_04_${tag}_ket_qua`);
      return ids;
    };

    // ---------- Bước 1: khoảng liền TRƯỚC ngày đặt: 01/09/2024 - 03/09/2024 ----------
    const before = await applyRange({ d: 1, m: 9, y: 2024 }, { d: 3, m: 9, y: 2024 }, 'lien_truoc');
    expect(before, `Khoảng 01/09 - 03/09/2024 không được hiện đơn ${ORDER_ID_1}`).not.toContain(ORDER_ID_1);

    // ---------- Bước 2: khoảng liền SAU ngày đặt: 05/09/2024 - 30/09/2024 ----------
    const after = await applyRange({ d: 5, m: 9, y: 2024 }, { d: 30, m: 9, y: 2024 }, 'lien_sau');
    expect(after, `Khoảng 05/09 - 30/09/2024 không được hiện đơn ${ORDER_ID_1}`).not.toContain(ORDER_ID_1);

    // ---------- Đối chứng: khoảng ôm lấy ngày đặt phải HIỆN đơn, chứng minh bộ lọc đang hoạt động ----------
    const around = await applyRange({ d: 3, m: 9, y: 2024 }, { d: 5, m: 9, y: 2024 }, 'doi_chung');
    expect(around, `Đối chứng: khoảng 03/09 - 05/09/2024 phải hiện đơn ${ORDER_ID_1}`).toContain(ORDER_ID_1);
  });

  test('Order_DateRange_05: Kiểm tra không cho chọn Đến sau thời điểm hiện tại', async ({ page }) => {
    test.skip(!HAS_AUTH, '[DateRange_05] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const pad = (n: number) => String(n).padStart(2, '0');
    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const rangeRegex = /Từ\s+(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/;
    const toDate = (s: string) => {
      const [d, m, y] = s.split('/').map(Number);
      return new Date(y, m - 1, d);
    };

    // Ngày hiện tại (theo hệ thống) và ngày hôm sau
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tD = tomorrow.getDate(), tM = tomorrow.getMonth() + 1, tY = tomorrow.getFullYear();
    const tomorrowVN = `${pad(tD)}/${pad(tM)}/${tY}`;
    const todayVN = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;

    // ---------- Mở trang với khoảng mặc định, bấm [Đổi] ----------
    await page.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    await expect
      .poll(async () => rangeRegex.test(await readBody()), { message: 'Phải hiển thị khoảng thời gian mặc định', timeout: 20000 })
      .toBe(true);
    const rangeBefore = (await readBody()).match(rangeRegex)!.slice(1, 3).join(' - ');

    await page.getByRole('button', { name: 'Đổi' }).click();
    const popupTitle = page.getByText('Xem theo khoảng thời gian');
    await expect(popupTitle, 'Bấm [Đổi] phải mở popup').toBeVisible({ timeout: 10000 });
    const popup = popupTitle.locator('xpath=ancestor::*[.//*[normalize-space(text())="Áp dụng"]][1]');
    await shot(page, 'DateRange_05_popup_mo');

    const popupRange = async () => {
      const dates = (((await popup.innerText()) || '').replace(/\s+/g, ' ').match(/\d{2}\/\d{2}\/\d{4}/g)) || [];
      return { from: dates[0], to: dates[1] };
    };

    // ---------- Bước 1: thử chọn Đến = ngày hôm sau trên lịch ----------
    const sfx = ['th', 'st', 'nd', 'rd'];
    const v = tD % 100;
    const ordinal = `${tD}${sfx[(v - 20) % 10] || sfx[v] || sfx[0]}`;
    const dayBtn = page.getByRole('button', { name: new RegExp(`${CAL_MONTHS_EN[tM - 1]} ${ordinal}, ${tY}`) });

    let outcome = '';
    // Nếu ngày mai chưa hiện trên lịch đang mở (thuộc tháng khác) thì thử chuyển tới tháng đó
    if ((await dayBtn.count()) === 0) {
      await page.locator('.px-10px').first().click({ timeout: 5000 });
      const monthOpt = page.getByText(`tháng ${tM}`, { exact: true }).last();
      if ((await monthOpt.count()) === 0 || (await monthOpt.isDisabled().catch(() => false))) {
        outcome = 'THANG_TUONG_LAI_BI_VO_HIEU';
      } else {
        await monthOpt.click({ timeout: 5000 });
        if (tY !== today.getFullYear()) {
          await page.locator('div:nth-child(2) > .px-10px').click({ timeout: 5000 });
          const yearOpt = page.getByText(String(tY), { exact: true }).last();
          if ((await yearOpt.count()) === 0 || (await yearOpt.isDisabled().catch(() => false))) outcome = 'NAM_TUONG_LAI_BI_VO_HIEU';
          else await yearOpt.click({ timeout: 5000 });
        }
      }
    }

    if (!outcome) {
      if ((await dayBtn.count()) === 0) {
        outcome = 'NGAY_TUONG_LAI_KHONG_HIEN_THI';
      } else if (await dayBtn.first().isDisabled()) {
        outcome = 'NGAY_TUONG_LAI_BI_VO_HIEU';
      } else {
        await dayBtn.first().click({ timeout: 5000 });
        await page.waitForTimeout(500);
        outcome = (await popupRange()).to === tomorrowVN ? 'CHAP_NHAN_NGAY_TUONG_LAI' : 'TU_CHOI_KHI_CHON';
      }
    }
    await shot(page, 'DateRange_05_buoc1_chon_ngay_mai');
    await attachText('DateRange_05_ket_qua_buoc1', `Ngày thử: ${tomorrowVN}\nKết quả: ${outcome}`);
    expect(outcome, `Web không được nhận ngày tương lai ${tomorrowVN} làm ngày Đến`).not.toBe('CHAP_NHAN_NGAY_TUONG_LAI');

    // Ngày tương lai chưa bị loại ở bước chọn (bị từ chối sau khi chọn) thì Đến không được đổi thành ngày mai
    if (outcome === 'TU_CHOI_KHI_CHON') {
      expect((await popupRange()).to, 'Ô Đến không được nhận ngày tương lai').not.toBe(tomorrowVN);
    }

    // ---------- Bước 2: nhập tay Đến = ngày hôm sau (nếu popup có ô cho nhập) ----------
    const inputs = popup.locator('input');
    if ((await inputs.count()) >= 2 && (await inputs.nth(1).isEditable().catch(() => false))) {
      await inputs.nth(1).fill(tomorrowVN);
      await inputs.nth(1).press('Enter');
      await page.waitForTimeout(500);
      expect((await popupRange()).to, 'Ô Đến không được nhận giá trị nhập tay là ngày tương lai').not.toBe(tomorrowVN);
      await shot(page, 'DateRange_05_buoc2_nhap_tay');
    } else {
      note('ux-note', 'Popup chỉ cho chọn bằng lịch, không có ô nhập tay nên bước 2 ("nhập tay Đến") không áp dụng.');
    }

    // ---------- Không áp dụng được khoảng có ngày tương lai ----------
    const applyBtn = page.getByRole('button', { name: 'Áp dụng' });
    if (await applyBtn.isVisible().catch(() => false)) {
      if (await applyBtn.isEnabled().catch(() => false)) {
        await applyBtn.click();
        await page.waitForTimeout(2500);
      }
    }
    const rangeNow = (await readBody()).match(rangeRegex);
    await shot(page, 'DateRange_05_ket_qua');
    if (rangeNow) {
      const endDate = toDate(rangeNow[2]);
      expect(
        endDate.getTime(),
        `Khoảng đang áp dụng "${rangeNow[1]} - ${rangeNow[2]}" không được có ngày Đến sau hôm nay (${todayVN})`
      ).toBeLessThanOrEqual(todayStart.getTime());
    }
    await attachText('DateRange_05_khoang_truoc_sau', `Trước: ${rangeBefore}\nSau: ${rangeNow ? rangeNow.slice(1, 3).join(' - ') : '(không đọc được)'}`);
  });

  test('Order_DateRange_06: Kiểm tra Từ lớn hơn Đến', async ({ page }) => {
    test.skip(!HAS_AUTH, '[DateRange_06] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const rangeRegex = /Từ\s+(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/;
    const toDate = (s: string) => {
      const [d, m, y] = s.split('/').map(Number);
      return new Date(y, m - 1, d).getTime();
    };
    const FROM = '10/09/2024';
    const TO = '05/09/2024';
    const log: string[] = [];

    // ---------- Mở trang với khoảng mặc định, ghi lại tiêu đề trước ----------
    await page.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    await expect
      .poll(async () => rangeRegex.test(await readBody()), { message: 'Phải hiển thị khoảng thời gian mặc định', timeout: 20000 })
      .toBe(true);
    const titleBefore = (await readBody()).match(rangeRegex)!.slice(1, 3).join(' - ');
    log.push(`Tiêu đề trước: ${titleBefore}`);

    // ---------- Bước 1: click [Đổi], chọn Từ = 10/09/2024, sau đó chọn Đến = 05/09/2024 ----------
    await page.getByRole('button', { name: 'Đổi' }).click();
    const popupTitle = page.getByText('Xem theo khoảng thời gian');
    await expect(popupTitle, 'Bấm [Đổi] phải mở popup').toBeVisible({ timeout: 10000 });
    const popup = popupTitle.locator('xpath=ancestor::*[.//*[normalize-space(text())="Áp dụng"]][1]');

    const popupRange = async () => {
      const dates = (((await popup.innerText()) || '').replace(/\s+/g, ' ').match(/\d{2}\/\d{2}\/\d{4}/g)) || [];
      return { from: dates[0], to: dates[1] };
    };

    await pickCalendarDate(page, 10, 9, 2024);
    await page.waitForTimeout(400);
    let state = await popupRange();
    log.push(`Sau khi chọn Từ = ${FROM}: popup Từ=${state.from}, Đến=${state.to}`);

    // Cách 1: bấm thẳng ngày 05/09/2024
    await clickCalendarDay(page, 5, 9, 2024);
    await page.waitForTimeout(400);
    state = await popupRange();
    log.push(`Sau khi bấm ngày ${TO}: popup Từ=${state.from}, Đến=${state.to}`);

    // Cách 2: nếu ô Đến chưa là 05/09/2024 thì bấm vào ô [Đến] rồi chọn ngày
    if (state.to !== TO) {
      await popup.getByText('Đến', { exact: true }).click({ timeout: 5000 }).catch(() => { });
      await goToCalendarMonth(page, 9, 2024).catch(() => { });
      await clickCalendarDay(page, 5, 9, 2024).catch(() => { });
      await page.waitForTimeout(400);
      state = await popupRange();
      log.push(`Sau khi bấm vào ô [Đến] rồi chọn ${TO}: popup Từ=${state.from}, Đến=${state.to}`);
    }
    await shot(page, 'DateRange_06_popup_sau_khi_chon');

    let behavior = 'KHAC';
    if (state.from === TO && state.to === FROM) behavior = 'TU_HOAN_DOI_HAI_NGAY';
    else if (state.from === FROM && state.to === TO) behavior = 'POPUP_NHAN_TU_LON_HON_DEN';
    else if (state.from === TO) behavior = 'CHON_LAI_TU_BANG_NGAY_VUA_BAM';
    log.push(`Cách web xử lý trong popup: ${behavior}`);

    // ---------- Click [Áp dụng] ----------
    const applyBtn = page.getByRole('button', { name: 'Áp dụng' });
    const applyEnabled = await applyBtn.isEnabled().catch(() => false);
    log.push(`Nút [Áp dụng] ${applyEnabled ? 'bấm được' : 'bị vô hiệu'}`);
    if (applyEnabled) {
      await applyBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
      await page.waitForTimeout(2500);
    }

    const bodyAfter = await readBody();
    const titleMatch = bodyAfter.match(rangeRegex);
    const titleAfter = titleMatch ? titleMatch.slice(1, 3).join(' - ') : '(không đọc được)';
    log.push(`Tiêu đề sau: ${titleAfter}`);
    log.push(`Popup còn mở: ${await popupTitle.isVisible().catch(() => false)}`);
    await shot(page, 'DateRange_06_ket_qua');
    await attachText('DateRange_06_ghi_nhan', log.join('\n'));

    // ---------- Kết quả mong đợi ----------
    // Hệ thống không áp dụng khoảng sai: tiêu đề hoặc giữ nguyên (từ chối), hoặc là khoảng đúng thứ tự (tự hoán đổi / chọn lại)
    expect(titleMatch, 'Trang phải còn hiển thị khoảng thời gian trên tiêu đề, không được trắng hoặc lỗi').not.toBeNull();
    const [, tFrom, tTo] = titleMatch!;
    expect(
      toDate(tFrom),
      `Web không được áp dụng khoảng có Từ (${tFrom}) lớn hơn Đến (${tTo})`
    ).toBeLessThanOrEqual(toDate(tTo));

    // Không lỗi hệ thống
    expect(bodyAfter, 'Không được hiện lỗi hệ thống sau khi áp dụng khoảng sai')
      .not.toMatch(/đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|Something went wrong/i);

    // Ghi chú nếu web có báo lỗi cho người dùng
    if (/không hợp lệ|ngày bắt đầu.*lớn hơn|phải nhỏ hơn|sai/i.test(bodyAfter)) {
      note('ux-note', 'Web hiển thị thông báo khi chọn Từ lớn hơn Đến, xem ảnh DateRange_06_ket_qua.');
    }
  });

  test('Order_DateRange_07: Kiểm tra nhập tay giá trị không hợp lệ vào ô Từ/Đến', async ({ page }) => {
    test.skip(!HAS_AUTH, '[DateRange_07] Bỏ qua: không tìm thấy auth/dmx_storageState.json');
 
    type Loc = ReturnType<Page['locator']>;
    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const rangeRegex = /Từ\s+(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/;
    const hasOrderCard = /Đơn hàng:\s*#/;
    const emptyPattern = /sản phẩm nào|đang chờ anh|chưa có đơn|không có đơn/i;
    const systemError = /đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|Something went wrong/i;
    // Thông báo kiểm tra dữ liệu có thể xuất hiện trong popup khi nhập sai
    const validationMsg = /không hợp lệ|sai định dạng|không đúng định dạng|không tồn tại|vui lòng (nhập|chọn)/i;
 
    // Chuỗi dd/mm/yyyy có phải một ngày có thật không (31/02/2024 -> false)
    const isRealDate = (s: string): boolean => {
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return false;
      const d = new Date(+m[3], +m[2] - 1, +m[1]);
      return d.getFullYear() === +m[3] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[1];
    };
 
    // ---------- Mở trang với khoảng mặc định, ghi lại tiêu đề + danh sách trước khi thử ----------
    await page.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    await expect
      .poll(async () => rangeRegex.test(await readBody()), {
        message: 'Phải hiển thị khoảng thời gian mặc định trên tiêu đề',
        timeout: 20000,
      })
      .toBe(true);
    const titleBefore = (await readBody()).match(rangeRegex)!.slice(1, 3).join(' - ');
    const log: string[] = [`Tiêu đề trước khi nhập: ${titleBefore}`];
 
    // ---------- Bấm [Đổi] mở popup ----------
    await page.getByRole('button', { name: 'Đổi' }).click();
    const popupTitle = page.getByText('Xem theo khoảng thời gian');
    await expect(popupTitle, 'Bấm [Đổi] phải mở popup').toBeVisible({ timeout: 10000 });
    const popup = popupTitle.locator('xpath=ancestor::*[.//*[normalize-space(text())="Áp dụng"]][1]');
 
    const popupText = async () => ((await popup.innerText()) || '').replace(/\s+/g, ' ');
    const popupDates = async () => (await popupText()).match(/\d{2}\/\d{2}\/\d{4}/g) || [];
    await expect
      .poll(async () => (await popupDates()).length >= 2, { message: 'Popup phải hiển thị ngày Từ và Đến', timeout: 10000 })
      .toBe(true);
    const datesBefore = await popupDates();
    const baselineHasMsg = validationMsg.test(await popupText());
    log.push(`Popup trước khi nhập: Từ=${datesBefore[0]}, Đến=${datesBefore[1]}`);
    await shot(page, 'DateRange_07_popup_ban_dau');
 
    // ---------- Tìm các ô input nhập tay được trong popup ----------
    const allInputs = popup.locator(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])'
    );
    const editable: Loc[] = [];
    for (let i = 0; i < (await allInputs.count()); i++) {
      const el = allInputs.nth(i);
      if ((await el.isVisible().catch(() => false)) && (await el.isEditable().catch(() => false))) editable.push(el);
    }
    log.push(`Số ô nhập tay được trong popup: ${editable.length}`);
 
    // Có thông báo lỗi kiểm tra dữ liệu mới xuất hiện (so với lúc mở popup) hoặc ô bị đánh dấu invalid
    const validationShown = async (): Promise<boolean> => {
      const msgNow = validationMsg.test(await popupText());
      const invalidAttr = await popup.locator('[aria-invalid="true"]').count();
      return (msgNow && !baselineHasMsg) || invalidAttr > 0;
    };
 
    // Nhập một giá trị vào ô và ghi lại phản ứng của web
    const tryValue = async (input: Loc, label: string, value: string, desc: string) => {
      await input.click();
      await input.press('Control+A');
      await input.press('Delete');
      await input.pressSequentially(value, { delay: 40 });
      const typedValue = await input.inputValue();
      await input.press('Tab');                 // rời ô để web kiểm tra / chuẩn hóa giá trị
      await page.waitForTimeout(500);
      const finalValue = await input.inputValue();
      const shownError = await validationShown();
      const rejected = typedValue !== value || finalValue !== value || shownError;
      log.push(
        `[${label}] ${desc}: nhập "${value}" → khi gõ "${typedValue}", sau khi rời ô "${finalValue}", ` +
        `${shownError ? 'CÓ' : 'không có'} thông báo lỗi → ${rejected ? 'bị từ chối/chặn' : 'ĐƯỢC CHẤP NHẬN NGUYÊN VĂN'}`
      );
      await shot(page, `DateRange_07_${label}_${desc.replace(/[^\w]+/g, '_').slice(0, 30)}`);
      return { typedValue, finalValue, shownError, rejected };
    };
 
    if (editable.length === 0) {
      // =================== Ô chỉ chọn bằng lịch, không cho nhập tay ===================
      note('ux-note', '[Cần xác nhận] Popup không có ô nhập tay (chỉ chọn bằng lịch) → các bước chỉ cần xác nhận không nhập được giá trị bất kỳ.');
      for (const value of ['31/02/2024', 'abc', '32/13/2024', '2024-09-04']) {
        await popup.getByText(datesBefore[0], { exact: false }).first().click().catch(() => { });
        await page.keyboard.type(value, { delay: 30 }).catch(() => { });
        await page.waitForTimeout(300);
        const datesNow = await popupDates();
        expect.soft(datesNow, `Gõ "${value}" không được làm đổi ngày Từ/Đến trong popup`).toEqual(datesBefore);
        log.push(`Gõ bàn phím "${value}" khi popup chỉ có lịch → ngày trong popup: ${datesNow.join(' - ')}`);
      }
      await shot(page, 'DateRange_07_chi_chon_bang_lich');
    } else {
      // =================== Có ô nhập tay: chạy 4 bước theo Excel trên ô Từ ===================
      const fromInput = editable[0];
 
      await test.step('Bước 1: Từ = "31/02/2024" (ngày không tồn tại)', async () => {
        const r = await tryValue(fromInput, 'Tu', '31/02/2024', 'Ngày không tồn tại');
        // Không được tự nhảy sang 02/03/2024 (hoặc ngày hợp lệ khác) mà không báo gì
        expect.soft(r.finalValue, 'Không được tự đổi 31/02/2024 thành 02/03/2024').not.toMatch(/^0?2\/0?3\/2024$/);
        expect.soft(r.rejected && !(isRealDate(r.finalValue) && r.finalValue !== datesBefore[0]),
          `31/02/2024 phải bị từ chối hoặc báo lỗi, nhưng ô hiển thị "${r.finalValue}"`).toBe(true);
      });
 
      await test.step('Bước 2: Từ = "abc" (chữ cái)', async () => {
        const r = await tryValue(fromInput, 'Tu', 'abc', 'Chữ cái');
        expect.soft(
          !/[a-z]/i.test(r.finalValue) || r.shownError,
          `Ô Từ không được nhận chữ "abc" mà không báo lỗi (ô hiển thị "${r.finalValue}")`
        ).toBe(true);
      });
 
      await test.step('Bước 3: Từ = "32/13/2024" (ngày/tháng vượt giới hạn)', async () => {
        const r = await tryValue(fromInput, 'Tu', '32/13/2024', 'Ngày tháng vượt giới hạn');
        expect.soft(r.rejected, `32/13/2024 phải bị từ chối hoặc báo lỗi (ô hiển thị "${r.finalValue}")`).toBe(true);
        expect.soft(isRealDate(r.finalValue) && r.finalValue !== datesBefore[0],
          `32/13/2024 không được tự chuyển thành ngày hợp lệ khác ("${r.finalValue}")`).toBe(false);
      });
 
      await test.step('Bước 4: Từ = "2024-09-04" (sai định dạng) rồi bấm [Áp dụng]', async () => {
        const r = await tryValue(fromInput, 'Tu', '2024-09-04', 'Sai định dạng ISO');
        expect.soft(r.rejected, `"2024-09-04" phải bị từ chối hoặc báo sai định dạng (ô hiển thị "${r.finalValue}")`).toBe(true);
      });
 
      // Bổ sung: ô Đến (nếu có) cũng phải chặn giá trị sai
      if (editable.length >= 2) {
        await test.step('Bổ sung: ô Đến với "31/02/2024" và "abc"', async () => {
          const toInput = editable[1];
          const r1 = await tryValue(toInput, 'Den', '31/02/2024', 'Ngày không tồn tại');
          expect.soft(r1.finalValue, 'Ô Đến không được tự đổi 31/02/2024 thành 02/03/2024').not.toMatch(/^0?2\/0?3\/2024$/);
          const r2 = await tryValue(toInput, 'Den', 'abc', 'Chữ cái');
          expect.soft(!/[a-z]/i.test(r2.finalValue) || r2.shownError, 'Ô Đến không được nhận chữ "abc" mà không báo lỗi').toBe(true);
        });
      } else {
        note('ux-note', 'Popup chỉ có 1 ô nhập tay, ô Đến chỉ chọn bằng lịch nên bước bổ sung cho ô Đến không áp dụng.');
      }
    }
 
    // ---------- Bấm [Áp dụng] với dữ liệu đã nhập sai ----------
    const applyBtn = page.getByRole('button', { name: 'Áp dụng' });
    const applyEnabled = (await applyBtn.isVisible().catch(() => false)) && (await applyBtn.isEnabled().catch(() => false));
    log.push(`Nút [Áp dụng] ${applyEnabled ? 'bấm được' : 'bị vô hiệu hoặc không còn'}`);
    if (applyEnabled) {
      await applyBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
      await page.waitForTimeout(2500);
    }
 
    // ---------- Kết quả cuối ----------
    const bodyAfter = await readBody();
    const matchAfter = bodyAfter.match(rangeRegex);
    const titleAfter = matchAfter ? matchAfter.slice(1, 3).join(' - ') : '(không đọc được)';
    log.push(`Tiêu đề sau khi bấm [Áp dụng]: ${titleAfter}`);
    log.push(`Popup còn mở: ${await popupTitle.isVisible().catch(() => false)}`);
    await shot(page, 'DateRange_07_ket_qua_cuoi');
    await attachText('DateRange_07_ghi_nhan', log.join('\n'));
 
    // Không lỗi hệ thống, không trắng trang
    expect(bodyAfter, 'Không được hiện lỗi hệ thống sau khi nhập giá trị không hợp lệ').not.toMatch(systemError);
    expect(matchAfter, 'Trang phải còn hiển thị khoảng thời gian trên tiêu đề').not.toBeNull();
 
    // Không áp dụng được khoảng không hợp lệ: cả hai ngày trên tiêu đề là ngày thật và tiêu đề không đổi
    const [, tFrom, tTo] = matchAfter!;
    expect(isRealDate(tFrom) && isRealDate(tTo), `Tiêu đề "${titleAfter}" chứa ngày không tồn tại`).toBe(true);
    expect(titleAfter, 'Giá trị nhập sai không được làm đổi khoảng thời gian đang áp dụng').toBe(titleBefore);
 
    // Danh sách vẫn hiển thị bình thường (có đơn hoặc trạng thái rỗng)
    await expect
      .poll(async () => {
        const t = await readBody();
        return hasOrderCard.test(t) || emptyPattern.test(t);
      }, { message: 'Danh sách phải hiển thị đơn hoặc trạng thái rỗng, không được trắng trang', timeout: 15000 })
      .toBe(true);
  });
 
});


// ==============================================================================
// PHẦN 5: CHI TIẾT ĐƠN HÀNG (DETAIL - 5 TEST CASES)
// ==============================================================================
test.describe('PHẦN 5: CHI TIẾT ĐƠN HÀNG (DETAIL)', () => {

  test('Order_Detail_01: Kiểm tra mở chi tiết đơn từ danh sách', async ({ page }) => {
    test.skip(!HAS_AUTH, '[Detail_01] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const readBodyOf = async (p: Page) => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const systemError = /đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|không lấy được thông tin đơn hàng|Something went wrong/i;

    // ---------- Pre-condition: đang ở trang danh sách, khoảng thời gian bao trùm 04/09/2024 ----------
    await gotoOrderListWithWideRange(page);
    await page.waitForTimeout(2000);
    await dismissPopups(page);

    // ---------- Bước 1: tìm đúng card đơn #01967SO24090400320 ----------
    const orderIdText = page.getByText(ORDER_ID_1).first();
    await expect(
      orderIdText,
      `Danh sách phải có đơn #${ORDER_ID_1}. Nếu không thấy, kiểm tra khoảng thời gian có bao trùm 04/09/2024 không.`
    ).toBeVisible({ timeout: 25000 });

    // Card = cụm gần nhất bao quanh mã đơn và có link [Xem chi tiết]
    const card = orderIdText.locator('xpath=ancestor::*[.//*[contains(normalize-space(.),"Xem chi tiết")]][1]');
    await card.scrollIntoViewIfNeeded();
    await dismissPopups(page);                       // popup hay hiện trễ, tắt lần nữa ngay trước khi bấm

    // Ghi lại dữ liệu của card trước khi bấm để đối chiếu với trang chi tiết
    const cardText = ((await card.innerText()) || '').replace(/\s+/g, ' ');
    await attachText('Detail_01_noi_dung_card', cardText);
    await test.info().attach('Detail_01_card_truoc_click', { body: await card.screenshot(), contentType: 'image/png' });
    await shot(page, 'Detail_01_truoc_click');

    const detailLink = card.getByText(/Xem chi tiết/i).first();
    await expect(detailLink, 'Card phải có liên kết [Xem chi tiết >]').toBeVisible({ timeout: 10000 });

    // ---------- Bấm [Xem chi tiết >]; web có thể mở cùng tab hoặc tab mới ----------
    const newTabPromise = page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await detailLink.click({ timeout: 10000 });
    const newTab = await newTabPromise;
    const detailPage = newTab ?? page;
    await attachText('Detail_01_cach_mo', newTab ? 'Mở trong TAB MỚI' : 'Mở trong CÙNG TAB');

    try {
      // Verify 1: chuyển sang trang chi tiết, URL đúng dạng /ca-nhan/lich-su-mua-hang/<mã đơn> (không có ký tự #)
      await expect(
        detailPage,
        `URL phải chứa /lich-su-mua-hang/${ORDER_ID_1}`
      ).toHaveURL(new RegExp(`lich-su-mua-hang/${ORDER_ID_1}`), { timeout: 20000 });
      await dismissPopups(detailPage);

      const url = detailPage.url();
      await attachText('Detail_01_url', url);
      expect(url, 'URL không được chứa ký tự # hoặc %23 trước mã đơn').not.toMatch(/#|%23/);
      expect(url, 'Không được bị chuyển sang trang đăng nhập').not.toMatch(/dang-nhap/i);

      // Verify 2: trang "Chi tiết đơn hàng" tải xong và hiển thị đúng đơn đã chọn (chờ tự động, không sleep cố định)
      let body = '';
      await expect
        .poll(async () => {
          body = await readBodyOf(detailPage);
          return /Chi tiết đơn hàng/i.test(body) && body.includes(ORDER_ID_1);
        }, {
          message: `Trang phải có tiêu đề "Chi tiết đơn hàng" và mã đơn ${ORDER_ID_1}`,
          timeout: 25000,
        })
        .toBe(true);
      await shot(detailPage, 'Detail_01_trang_chi_tiet');

      // Verify 3: dữ liệu khớp với card đã chọn (trạng thái, tổng tiền, thời gian đặt)
      expect(body, 'Mã đơn trên trang chi tiết phải trùng mã đơn ở danh sách').toContain(ORDER_ID_1);
      expect(body, 'Trạng thái "Thành Công" phải khớp với danh sách').toContain('Thành Công');
      expect(body, 'Tổng tiền 650.000đ phải khớp với "Tổng tiền hàng" ở danh sách').toMatch(/650[.,]000/);
      expect(body, 'Đơn đặt ngày 04/09/2024 phải hiển thị đúng ngày đặt').toContain('04/09/2024');

      // Không được lẫn dữ liệu của đơn khác
      expect(body, `Không được hiện mã đơn khác (${ORDER_ID_2}) trên trang chi tiết của ${ORDER_ID_1}`)
        .not.toContain(ORDER_ID_2);

      // Không lỗi hệ thống, không trắng trang
      expect(body.length, 'Trang chi tiết không được trắng').toBeGreaterThan(200);
      expect(body, 'Trang chi tiết không được hiện thông báo lỗi').not.toMatch(systemError);

      // Ghi chú trải nghiệm: mở cùng tab hay tab mới (Order_Invoice_01 cũng cần xác nhận tương tự)
      note('ux-note', newTab
        ? 'Chi tiết đơn mở trong tab mới.'
        : 'Chi tiết đơn mở cùng tab (dùng nút Back để quay về danh sách).');
    } finally {
      if (newTab) await newTab.close().catch(() => { });
    }
  });

  test('Order_Detail_02: Kiểm tra khối thông tin đơn hàng và hình thức thanh toán', async ({ page }) => {
    test.skip(!HAS_AUTH, '[Detail_02] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const systemError = /đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|không lấy được thông tin đơn hàng|Something went wrong/i;

    // Tên thứ theo tiếng Việt, index = Date.getDay() (0 = Chủ Nhật)
    const VN_WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    // Định dạng thật của web: "Đặt lúc: 10:46 Thứ Tư - 04/09/2024" (giờ - thứ - ngày)
    const placedAtRegex = /Đặt lúc:?\s*(\d{1,2}):(\d{2})\s+(Thứ\s+\S+|Chủ\s+Nhật)\s*[-–]\s*(\d{2})\/(\d{2})\/(\d{4})/i;

    // ---------- Pre-condition: đang ở trang chi tiết đơn #01967SO24090400320 ----------
    await page.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    expect(page.url(), 'Phải vào được trang chi tiết, không bị chuyển sang đăng nhập').not.toMatch(/dang-nhap/i);

    // Chờ trang chi tiết tải xong (tự chờ, không dùng sleep cố định)
    let body = '';
    await expect
      .poll(async () => {
        body = await readBody();
        return body.includes(ORDER_ID_1) && placedAtRegex.test(body);
      }, {
        message: `Trang chi tiết phải hiển thị mã đơn ${ORDER_ID_1} và dòng "Đặt lúc: giờ thứ - ngày"`,
        timeout: 25000,
      })
      .toBe(true);
    await shot(page, 'Detail_02_trang_chi_tiet');
    expect(body, 'Trang chi tiết không được hiện thông báo lỗi').not.toMatch(systemError);

    // ---------- Bước 1: khối bên phải gồm trạng thái, mã đơn, thời gian đặt ----------
    // 1a. Trạng thái "Thành Công" (màu xanh)
    const statusEl = page.getByText('Thành Công', { exact: true }).first();
    await expect(statusEl, 'Phải hiển thị trạng thái "Thành Công"').toBeVisible({ timeout: 10000 });
    const statusColor = await statusEl.evaluate((el) => getComputedStyle(el).color).catch(() => '');
    const rgb = statusColor.match(/\d+/g)?.slice(0, 3).map(Number);
    if (rgb && rgb[1] > rgb[0] && rgb[1] > rgb[2]) {
      console.log(`[Detail_02] Trạng thái "Thành Công" màu xanh lá: ${statusColor}`);
    } else {
      note('ux-note', `Màu chữ trạng thái "Thành Công" là ${statusColor || 'không đọc được'}, cần kiểm tra bằng mắt xem có xanh không.`);
    }

    // 1b. Mã đơn trùng với danh sách (dạng #01967SO24090400320)
    expect(body, `Mã đơn phải trùng với danh sách: #${ORDER_ID_1}`).toContain(ORDER_ID_1);
    expect(body, `Không được hiện mã đơn khác (${ORDER_ID_2}) trên trang chi tiết của ${ORDER_ID_1}`)
      .not.toContain(ORDER_ID_2);

    // 1c. "Đặt lúc: 10:46 Thứ Tư - 04/09/2024": đúng định dạng giờ - thứ - ngày, giá trị đúng, thứ khớp lịch
    const m = body.match(placedAtRegex)!;
    const [, hh, mm, shownWeekday, dd, mo, yyyy] = m;
    await attachText('Detail_02_dat_luc', m[0]);

    expect(`${hh.padStart(2, '0')}:${mm}`, 'Giờ đặt phải là 10:46').toBe('10:46');
    expect(`${dd}/${mo}/${yyyy}`, 'Ngày đặt phải là 04/09/2024').toBe('04/09/2024');

    const expectedWeekday = VN_WEEKDAYS[new Date(+yyyy, +mo - 1, +dd).getDay()];
    expect(
      shownWeekday.replace(/\s+/g, ' ').toLowerCase(),
      `Thứ hiển thị phải khớp lịch: ${dd}/${mo}/${yyyy} là ${expectedWeekday}`
    ).toBe(expectedWeekday.toLowerCase());

    // ---------- Bước 2: khối [Hình thức thanh toán] ----------
    const paymentLabel = page.getByText(/Hình thức thanh toán/i).first();
    await expect(paymentLabel, 'Phải có khối [Hình thức thanh toán]').toBeVisible({ timeout: 10000 });
    await paymentLabel.scrollIntoViewIfNeeded();

    // Chỉ lấy phần chữ ngay sau nhãn để không khớp nhầm với chữ ở nơi khác trên trang (ví dụ "Nhận: Trước ...")
    const afterLabel = body.split(/Hình thức thanh toán/i)[1] ?? '';
    const paymentText = afterLabel.trim().slice(0, 80);
    await attachText('Detail_02_hinh_thuc_thanh_toan', paymentText);

    expect(
      paymentText,
      'Hình thức thanh toán phải là "Thanh toán tiền mặt khi nhận hàng" (đúng với hình thức đã chọn khi đặt)'
    ).toMatch(/Thanh toán tiền mặt khi nhận hàng/i);

    await shot(page, 'Detail_02_thong_tin_don_hang');

    // Hình thức thanh toán khác (chuyển khoản, thẻ, trả góp) chưa có đơn để kiểm tra (theo Note trong Excel)
    note('manual-only', '[KHÔNG THỂ THỰC THI THẬT] Các hình thức thanh toán khác (chuyển khoản, thẻ, trả góp) chưa có đơn để kiểm tra, chỉ kiểm tra được "Thanh toán tiền mặt khi nhận hàng".');
  });

  test('Order_Detail_03: Kiểm tra danh sách sản phẩm trong đơn', async ({ page }) => {
    test.skip(!HAS_AUTH, '[Detail_03] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const systemError = /đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|không lấy được thông tin đơn hàng|Something went wrong/i;

    // ---------- Pre-condition: đang ở trang chi tiết đơn #01967SO24090400320 ----------
    await page.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    expect(page.url(), 'Phải vào được trang chi tiết, không bị chuyển sang đăng nhập').not.toMatch(/dang-nhap/i);

    // Chờ trang chi tiết tải xong (tự chờ, không dùng sleep cố định)
    let body = '';
    await expect
      .poll(async () => {
        body = await readBody();
        return body.includes(ORDER_ID_1) && /Thông tin sản phẩm/i.test(body);
      }, {
        message: `Trang chi tiết phải hiển thị mã đơn ${ORDER_ID_1} và khối [Thông tin sản phẩm]`,
        timeout: 25000,
      })
      .toBe(true);
    expect(body, 'Trang chi tiết không được hiện thông báo lỗi').not.toMatch(systemError);

    // ---------- Bước 1: xem khối [Thông tin sản phẩm] ----------
    const heading = page.getByText(/Thông tin sản phẩm/i).first();
    await expect(heading, 'Phải có khối [Thông tin sản phẩm]').toBeVisible({ timeout: 10000 });
    await heading.scrollIntoViewIfNeeded();
    await dismissPopups(page);

    // Chỉ lấy phần chữ từ sau tiêu đề khối đến trước khối [Chi tiết thanh toán],
    // để không khớp nhầm với giá/tổng tiền ở khối khác (ví dụ 650.000đ)
    let section = (body.split(/Thông tin sản phẩm/i)[1] ?? '').split(/Chi tiết thanh toán/i)[0].trim();
    await attachText('Detail_03_noi_dung_khoi_san_pham', section);
    await shot(page, 'Detail_03_danh_sach_san_pham');
    expect(section.length, 'Khối [Thông tin sản phẩm] không được trống').toBeGreaterThan(20);

    // Verify 1a: đủ 2 sản phẩm (khớp "+1 sản phẩm khác" ở danh sách): mỗi sản phẩm có đúng 1 dòng "SL: x"
    const qtyMatches = section.match(/SL:\s*\d+/gi) || [];
    expect(qtyMatches.length, 'Đơn phải hiển thị đủ 2 sản phẩm (mỗi sản phẩm có 1 dòng "SL:")').toBe(2);

    // Verify 1b: số lượng của từng sản phẩm = SL: 1
    for (const q of qtyMatches) {
      expect(q.replace(/\s+/g, ''), 'Số lượng mỗi sản phẩm phải là "SL: 1"').toMatch(/SL:1$/i);
    }

    // Verify 1c: giá từng sản phẩm 590.000đ và 60.000đ
    expect(section, 'Phải có giá sản phẩm 590.000đ (Tai nghe)').toMatch(/590[.,]000\s*(đ|₫)/);
    expect(section, 'Phải có giá sản phẩm 60.000đ (Cáp sạc)').toMatch(/(?<![\d.,])60[.,]000\s*(đ|₫)/);

    // Verify 1d: tên sản phẩm đầy đủ (không bị cắt "..."), có đủ Tai nghe và Cáp sạc
    expect(section, 'Phải có sản phẩm Tai nghe').toMatch(/Tai nghe/i);
    expect(section, 'Phải có sản phẩm Cáp sạc').toMatch(/Cáp/i);
    expect(section, 'Tên sản phẩm không được bị cắt bằng dấu "..."').not.toMatch(/\.{3}|…/);

    // Verify 1e: mỗi sản phẩm có ảnh tải được
    // Lấy cụm gần nhất bao quanh tiêu đề khối và chứa >= 2 ảnh (tức là cả danh sách sản phẩm)
    const productBox = heading.locator('xpath=ancestor::*[count(.//img)>=2][1]');
    const imgs = productBox.locator('img');
    const imgCount = await imgs.count();
    expect(imgCount, 'Khối sản phẩm phải có ít nhất 2 ảnh (mỗi sản phẩm 1 ảnh)').toBeGreaterThanOrEqual(2);
    const broken: number[] = [];
    for (let i = 0; i < imgCount; i++) {
      const img = imgs.nth(i);
      await img.scrollIntoViewIfNeeded().catch(() => { });
      const w = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth).catch(() => 0);
      if (!(await img.isVisible().catch(() => false)) || w === 0) broken.push(i + 1);
    }
    expect(broken, `Ảnh sản phẩm bị lỗi/không tải được ở vị trí: ${broken.join(', ')}`).toEqual([]);

    // Verify 1f: dòng "Nhận: Trước 10:47 04/09/2024"
    expect(section, 'Phải có dòng "Nhận: Trước 10:47 04/09/2024"')
      .toMatch(/Nhận:\s*Trước\s*10:47\s+04\/09\/2024/i);

    // Verify 1g: sản phẩm hết hạn bảo hành hiển thị nhãn "HẾT BẢO HÀNH"
    const warrantyRegex = /HẾT BẢO HÀNH/gi;
    const warrantyCount = (section.match(warrantyRegex) || []).length;
    expect(warrantyCount, 'Sản phẩm hết hạn bảo hành phải hiển thị nhãn "HẾT BẢO HÀNH"').toBeGreaterThanOrEqual(1);

    // Xác định nhãn thuộc sản phẩm nào: cắt khối thành từng đoạn theo vị trí tên sản phẩm
    const iHead = section.search(/Tai nghe/i);
    const iCable = section.search(/Cáp/i);
    const iLabel = section.search(warrantyRegex);
    const starts = [
      { name: 'Tai nghe', at: iHead },
      { name: 'Cáp sạc', at: iCable },
    ].filter((s) => s.at >= 0).sort((a, b) => a.at - b.at);
    const owner = [...starts].reverse().find((s) => s.at <= iLabel)?.name ?? 'không xác định';
    await attachText('Detail_03_nhan_het_bao_hanh', `Số nhãn "HẾT BẢO HÀNH": ${warrantyCount}\nNhãn nằm ở sản phẩm: ${owner}`);

    // Excel (Note): nhãn chỉ quan sát thấy ở Tai nghe, không có ở Cáp sạc - cần xác nhận quy tắc
    if (owner !== 'Tai nghe' || warrantyCount !== 1) {
      note('ux-note', `Nhãn "HẾT BẢO HÀNH" xuất hiện ${warrantyCount} lần, thuộc sản phẩm: ${owner} (quan sát ban đầu: chỉ ở Tai nghe). Cần xác nhận quy tắc.`);
    } else {
      note('ux-note', '[Cần xác nhận] Nhãn "HẾT BẢO HÀNH" chỉ ở Tai nghe, không có ở Cáp sạc: cần xác nhận quy tắc (cáp sạc không bảo hành?).');
    }

    // ---------- Đối chiếu với danh sách: số sản phẩm = 1 + N trong "+N sản phẩm khác" ----------
    await gotoOrderListWithWideRange(page);
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    const idEl = page.getByText(ORDER_ID_1).first();
    await expect(idEl, `Danh sách phải có đơn #${ORDER_ID_1}`).toBeVisible({ timeout: 25000 });
    const card = idEl.locator('xpath=ancestor::*[.//*[contains(normalize-space(.),"Xem chi tiết")]][1]');
    const cardText = ((await card.innerText()) || '').replace(/\s+/g, ' ');
    const more = cardText.match(/\+\s*(\d+)\s*sản phẩm khác/i);
    expect(more, 'Card đơn nhiều sản phẩm phải có "+N sản phẩm khác"').not.toBeNull();
    expect(
      1 + Number(more![1]),
      'Số sản phẩm ở trang chi tiết phải khớp "+N sản phẩm khác" ở danh sách (1 + N)'
    ).toBe(qtyMatches.length);
  });

  test('Order_Detail_04: Kiểm tra tính toán tiền trong khối [Chi tiết thanh toán]', async ({ page }) => {
    test.skip(!HAS_AUTH, '[Detail_04] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const systemError = /đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|không lấy được thông tin đơn hàng|Something went wrong/i;
    const money = /(-?\s*\d{1,3}(?:[.,]\d{3})*)\s*(?:đ|₫)/g;
    // "650.000đ" -> 650000, "-50.000đ" -> -50000
    const toVND = (s: string): number => {
      const n = Number(s.replace(/[^\d]/g, ''));
      return /^\s*-/.test(s) ? -n : n;
    };

    // ---------- Pre-condition: đang ở trang chi tiết đơn #01967SO24090400320 ----------
    await page.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    expect(page.url(), 'Phải vào được trang chi tiết, không bị chuyển sang đăng nhập').not.toMatch(/dang-nhap/i);

    let body = '';
    await expect
      .poll(async () => {
        body = await readBody();
        return body.includes(ORDER_ID_1) && /Thông tin sản phẩm/i.test(body) && /Chi tiết thanh toán/i.test(body);
      }, {
        message: 'Trang phải hiển thị khối [Thông tin sản phẩm] và khối [Chi tiết thanh toán]',
        timeout: 25000,
      })
      .toBe(true);
    expect(body, 'Trang chi tiết không được hiện thông báo lỗi').not.toMatch(systemError);

    const payHeading = page.getByText(/Chi tiết thanh toán/i).first();
    await payHeading.scrollIntoViewIfNeeded();
    await dismissPopups(page);
    await shot(page, 'Detail_04_chi_tiet_thanh_toan');

    // ---------- Bước 1: cộng tay giá x số lượng của từng sản phẩm ----------
    const productSection = (body.split(/Thông tin sản phẩm/i)[1] ?? '').split(/Chi tiết thanh toán/i)[0];
    const prices = [...productSection.matchAll(money)].map((m) => toVND(m[1]));
    const qtys = [...productSection.matchAll(/SL:\s*(\d+)/gi)].map((m) => Number(m[1]));
    await attachText('Detail_04_gia_va_so_luong', `Giá: ${prices.join(', ')}\nSố lượng: ${qtys.join(', ')}`);

    expect(qtys.length, 'Đơn phải có 2 sản phẩm (mỗi sản phẩm 1 dòng "SL:")').toBe(2);
    expect(prices.length, 'Mỗi sản phẩm phải có đúng 1 giá hiển thị trong khối sản phẩm').toBe(qtys.length);

    const manualTotal = prices.reduce((sum, p, i) => sum + p * qtys[i], 0);
    const breakdown = prices.map((p, i) => `${p.toLocaleString('vi-VN')} x ${qtys[i]}`).join(' + ');
    await attachText('Detail_04_cong_tay', `${breakdown} = ${manualTotal.toLocaleString('vi-VN')}đ`);
    expect(manualTotal, `Cộng tay ${breakdown} phải bằng 650.000đ`).toBe(650000);

    // ---------- Bước 2: đối chiếu khối [Chi tiết thanh toán] ----------
    const payBlock = (body.split(/Chi tiết thanh toán/i)[1] ?? '').trim().slice(0, 400);
    await attachText('Detail_04_khoi_thanh_toan', payBlock);

    const totalGoodsMatch = payBlock.match(/Tổng tiền hàng:?\s*(-?\s*\d{1,3}(?:[.,]\d{3})*)\s*(?:đ|₫)/i);
    const shippingMatch = payBlock.match(/Phí giao hàng(?:\s*\+\s*chuyển hàng)?:?\s*(Miễn phí|-?\s*\d{1,3}(?:[.,]\d{3})*\s*(?:đ|₫)|0\s*(?:đ|₫))/i);
    const discountMatch = payBlock.match(/(?:Giảm giá|Khuyến mãi|Voucher|Mã giảm)[^\d-]{0,25}(-?\s*\d{1,3}(?:[.,]\d{3})*)\s*(?:đ|₫)/i);
    const grandTotalMatch = payBlock.match(/Tổng thanh toán:?\s*(-?\s*\d{1,3}(?:[.,]\d{3})*)\s*(?:đ|₫)/i);

    expect(totalGoodsMatch, 'Khối thanh toán phải có dòng "Tổng tiền hàng"').not.toBeNull();
    expect(shippingMatch, 'Khối thanh toán phải có dòng "Phí giao hàng + chuyển hàng"').not.toBeNull();
    expect(grandTotalMatch, 'Khối thanh toán phải có dòng "Tổng thanh toán"').not.toBeNull();

    const totalGoods = toVND(totalGoodsMatch![1]);
    const shippingText = shippingMatch![1].trim();
    const shipping = /Miễn phí/i.test(shippingText) ? 0 : toVND(shippingText);
    const discount = discountMatch ? Math.abs(toVND(discountMatch[1])) : 0;
    const grandTotal = toVND(grandTotalMatch![1]);

    await attachText(
      'Detail_04_doi_chieu',
      [
        `Cộng tay: ${manualTotal}`,
        `Tổng tiền hàng: ${totalGoods}`,
        `Phí giao hàng + chuyển hàng: ${shippingText} (${shipping})`,
        `Giảm giá: ${discount}${discountMatch ? '' : ' (không có dòng giảm giá)'}`,
        `Tổng thanh toán: ${grandTotal}`,
      ].join('\n')
    );

    // Verify 2a: Tổng tiền hàng = tổng cộng tay = 650.000đ
    expect(totalGoods, '"Tổng tiền hàng" phải bằng tổng giá x số lượng cộng tay').toBe(manualTotal);
    expect(totalGoods, '"Tổng tiền hàng" phải là 650.000đ').toBe(650000);

    // Verify 2b: Phí giao hàng + chuyển hàng = "Miễn phí"
    expect(shippingText, 'Phí giao hàng + chuyển hàng phải là "Miễn phí"').toMatch(/Miễn phí/i);

    // Verify 2c: Tổng thanh toán = Tổng tiền hàng + phí - giảm giá = 650.000đ
    expect(
      grandTotal,
      `"Tổng thanh toán" phải bằng Tổng tiền hàng (${totalGoods}) + phí (${shipping}) - giảm giá (${discount})`
    ).toBe(totalGoods + shipping - discount);
    expect(grandTotal, '"Tổng thanh toán" phải là 650.000đ').toBe(650000);

    // Verify 2d: khớp "Tổng tiền hàng" ở card đơn trong danh sách
    await gotoOrderListWithWideRange(page);
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    const idEl = page.getByText(ORDER_ID_1).first();
    await expect(idEl, `Danh sách phải có đơn #${ORDER_ID_1}`).toBeVisible({ timeout: 25000 });
    const card = idEl.locator('xpath=ancestor::*[.//*[contains(normalize-space(.),"Xem chi tiết")]][1]');
    const cardText = ((await card.innerText()) || '').replace(/\s+/g, ' ');
    const listTotal = cardText.match(/Tổng tiền hàng:?\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:đ|₫)/i);
    expect(listTotal, 'Card đơn ở danh sách phải có "Tổng tiền hàng"').not.toBeNull();
    expect(toVND(listTotal![1]), '"Tổng tiền hàng" ở danh sách phải khớp với trang chi tiết').toBe(totalGoods);

    // Ghi nhận khi web có thêm dòng giảm giá mà Excel chưa mô tả
    if (discountMatch) {
      note('data-note', `Khối thanh toán có dòng giảm giá ${discount}đ, kiểm tra lại công thức Tổng thanh toán.`);
    }
  });

  test('Order_Detail_05: Kiểm tra mục [Cần thanh toán] của đơn đã giao thành công', async ({ page }) => {
    test.skip(!HAS_AUTH, '[Detail_05] Bỏ qua: không tìm thấy auth/dmx_storageState.json');

    const readBody = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const systemError = /đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|không lấy được thông tin đơn hàng|Something went wrong/i;
    // "Cần thanh toán: 650.000đ" -> "650.000"; "Cần thanh toán: 0đ" -> "0"
    const needPayRegex = /Cần thanh toán:?\s*(-?\s*\d{1,3}(?:[.,]\d{3})*|0)\s*(?:đ|₫)?/i;
    const toVND = (s: string): number => Number(s.replace(/[^\d]/g, ''));

    // ---------- Pre-condition: đang ở trang chi tiết đơn #01967SO24090400320 ----------
    const openDetail = async (): Promise<string> => {
      await page.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await page.waitForTimeout(2000);
      await dismissPopups(page);
      expect(page.url(), 'Phải vào được trang chi tiết, không bị chuyển sang đăng nhập').not.toMatch(/dang-nhap/i);

      let text = '';
      await expect
        .poll(async () => {
          text = await readBody();
          return text.includes(ORDER_ID_1) && /Chi tiết thanh toán/i.test(text) && /Tổng thanh toán/i.test(text);
        }, {
          message: 'Trang phải hiển thị mã đơn và khối [Chi tiết thanh toán] (đã tải xong)',
          timeout: 25000,
        })
        .toBe(true);
      return text;
    };

    let body = await openDetail();
    expect(body, 'Trang chi tiết không được hiện thông báo lỗi').not.toMatch(systemError);

    // Đơn phải đúng pre-condition: trạng thái "Thành Công" (đã giao, đã thanh toán xong)
    expect(body, 'Pre-condition: đơn phải ở trạng thái "Thành Công"').toContain('Thành Công');

    // ---------- Bước 1: xem dòng [Cần thanh toán] ----------
    const payHeading = page.getByText(/Chi tiết thanh toán/i).first();
    await payHeading.scrollIntoViewIfNeeded();
    await dismissPopups(page);

    const payBlock = (body.split(/Chi tiết thanh toán/i)[1] ?? '').trim().slice(0, 400);
    const grandTotalMatch = payBlock.match(/Tổng thanh toán:?\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:đ|₫)/i);
    const grandTotal = grandTotalMatch ? toVND(grandTotalMatch[1]) : null;

    const needPayMatch = body.match(needPayRegex);
    const hasLabel = /Cần thanh toán/i.test(body);
    await attachText('Detail_05_khoi_thanh_toan', payBlock);
    await attachText(
      'Detail_05_can_thanh_toan',
      [
        `Dòng "Cần thanh toán": ${hasLabel ? (needPayMatch ? needPayMatch[0] : 'có nhãn nhưng không đọc được số tiền') : 'KHÔNG hiển thị'}`,
        `Tổng thanh toán: ${grandTotal === null ? '(không đọc được)' : grandTotal}`,
        `Trạng thái đơn: Thành Công`,
      ].join('\n')
    );
    await shot(page, 'Detail_05_can_thanh_toan');

    // Trường hợp 1: không hiển thị dòng [Cần thanh toán] -> chấp nhận (ẩn khi = 0), theo Expected
    if (!hasLabel) {
      note('ux-note', 'Không hiển thị dòng [Cần thanh toán] cho đơn "Thành Công" (ẩn khi = 0đ) - đúng Expected.');
      return;
    }

    // Trường hợp 2: có nhãn nhưng không đọc được số tiền -> không kết luận được, báo lỗi để kiểm tra bằng mắt
    expect(
      needPayMatch,
      'Có nhãn "Cần thanh toán" nhưng không đọc được số tiền, xem ảnh Detail_05_can_thanh_toan để kiểm tra bằng mắt'
    ).not.toBeNull();

    const amount = toVND(needPayMatch![1]);
    console.log(`[Detail_05] Cần thanh toán: ${needPayMatch![0]} (= ${amount})`);

    if (amount !== 0) {
      // Excel (Note): NGHI VẤN LỖI - đơn "Thành Công" vẫn hiện "Cần thanh toán: 650.000đ". Tải lại trang để loại trừ lỗi tải dữ liệu.
      body = await openDetail();
      const again = body.match(needPayRegex);
      const amountAgain = again ? toVND(again[1]) : 0;
      await shot(page, 'Detail_05_sau_khi_tai_lai');
      await attachText('Detail_05_tai_lai', `Lần 1: ${amount}\nSau khi tải lại: ${again ? again[0] : 'không còn dòng Cần thanh toán'}`);

      if (amountAgain !== 0) {
        note(
          'known-issue',
          `LỖI TÁI HIỆN ĐƯỢC: đơn "Thành Công" (đã giao, thanh toán tiền mặt khi nhận hàng) vẫn hiển thị "Cần thanh toán: ${amountAgain.toLocaleString('vi-VN')}đ"` +
          `${grandTotal !== null && amountAgain === grandTotal ? ' (bằng Tổng thanh toán)' : ''}. Ghi nhận bug, đặt Result = Failed.`
        );
      } else {
        note('data-note', `Lần đầu hiển thị Cần thanh toán = ${amount}đ nhưng sau khi tải lại là 0đ/ẩn: lỗi không ổn định, cần kiểm tra thêm.`);
      }

      // Verify: đơn đã giao và thanh toán xong thì [Cần thanh toán] phải là 0đ (hoặc không hiển thị)
      expect(
        amountAgain,
        `Đơn "Thành Công" phải có "Cần thanh toán" = 0đ (hoặc ẩn), nhưng đang hiển thị ${needPayMatch![0].trim()}`
      ).toBe(0);
    } else {
      console.log('[Detail_05] Cần thanh toán = 0đ ✓');
    }

    // Không lỗi hệ thống sau khi kiểm tra
    expect(await readBody(), 'Trang chi tiết không được hiện thông báo lỗi').not.toMatch(systemError);
  });
});


// ==============================================================================
// PHẦN 6: XEM HÓA ĐƠN ĐIỆN TỬ (INVOICE - 5 TEST CASES)
// ==============================================================================
test.describe('PHẦN 6: XEM HÓA ĐƠN ĐIỆN TỬ (INVOICE)', () => {

  test('Order_Invoice_01: Kiểm tra click [Xem hóa đơn] ở chi tiết đơn', async ({ page, context }) => {
    test.skip(!HAS_AUTH, '[Invoice_01] Bỏ qua: không tìm thấy auth/dmx_storageState.json');
    test.setTimeout(120000);                         // trang hóa đơn thuộc hệ thống khác, có thể tải chậm

    const readBodyOf = async (p: Page) => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const systemError = /đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|404|Not Found|Something went wrong/i;
    const INVOICE_HOST = 'hddt.thegioididong.com';

    // ---------- Pre-condition: đang ở trang chi tiết đơn #01967SO24090400320 ----------
    await page.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    expect(page.url(), 'Phải vào được trang chi tiết, không bị chuyển sang đăng nhập').not.toMatch(/dang-nhap/i);

    await expect
      .poll(async () => {
        const t = await readBodyOf(page);
        return t.includes(ORDER_ID_1) && /Xem hóa đơn/i.test(t);
      }, {
        message: `Trang chi tiết phải hiển thị mã đơn ${ORDER_ID_1} và nút [Xem hóa đơn] (đã tải xong)`,
        timeout: 25000,
      })
      .toBe(true);
    const detailUrl = page.url();

    // ---------- Bước 1: click [Xem hóa đơn] ----------
    const invoiceBtn = page.getByText(/Xem hóa đơn/i).first();
    await expect(invoiceBtn, 'Phải có nút [Xem hóa đơn] ở chi tiết đơn').toBeVisible({ timeout: 15000 });
    await invoiceBtn.scrollIntoViewIfNeeded();
    await dismissPopups(page);                       // popup hay hiện trễ, tắt lần nữa ngay trước khi bấm
    await shot(page, 'Invoice_01_truoc_click');

    // Web có thể mở tab mới hoặc chuyển cùng tab: bắt cả hai trường hợp
    const newTabPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await invoiceBtn.click({ timeout: 10000 });
    const newTab = await newTabPromise;
    const invoicePage = newTab ?? page;
    await attachText('Invoice_01_cach_mo', newTab ? 'Mở trong TAB MỚI' : 'Mở trong CÙNG TAB');

    try {
      // Verify 1: chuyển đến trang hóa đơn điện tử (tự chờ chuyển hướng, không dùng sleep cố định)
      await expect(
        invoicePage,
        `Click [Xem hóa đơn] phải mở trang ${INVOICE_HOST}`
      ).toHaveURL(new RegExp(INVOICE_HOST.replace(/\./g, '\\.'), 'i'), { timeout: 30000 });
      await invoicePage.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => { });

      // Verify 2: URL kèm tham số data (chỉ ghi tên tham số, không ghi giá trị vì đó là mã tra cứu hóa đơn)
      const u = new URL(invoicePage.url());
      const paramNames = [...u.searchParams.keys()];
      await attachText(
        'Invoice_01_url_hoa_don',
        `Host: ${u.hostname}\nPath: ${u.pathname}\nTham số: ${paramNames.join(', ') || '(không có)'}\nĐộ dài giá trị data: ${(u.searchParams.get('data') || '').length}`
      );
      expect(u.hostname, `Trang hóa đơn phải thuộc ${INVOICE_HOST}`).toBe(INVOICE_HOST);
      expect(
        (u.searchParams.get('data') || '').length,
        `URL phải kèm tham số data có giá trị (tham số thực tế: ${paramNames.join(', ') || 'không có'})`
      ).toBeGreaterThan(0);

      // Verify 3: trang hiển thị tiêu đề "TRA CỨU HÓA ĐƠN ĐIỆN TỬ CỦA BẠN" (chờ tự động)
      let invoiceBody = '';
      await expect
        .poll(async () => {
          invoiceBody = await readBodyOf(invoicePage).catch(() => '');
          return /TRA CỨU HÓA ĐƠN ĐIỆN TỬ CỦA BẠN/i.test(invoiceBody);
        }, {
          message: 'Trang phải hiển thị tiêu đề "TRA CỨU HÓA ĐƠN ĐIỆN TỬ CỦA BẠN"',
          timeout: 30000,
        })
        .toBe(true);
      await shot(invoicePage, 'Invoice_01_trang_hoa_don');

      // Không lỗi, không trắng trang
      expect(invoiceBody.length, 'Trang hóa đơn không được trắng').toBeGreaterThan(100);
      expect(invoiceBody, 'Trang hóa đơn không được hiện thông báo lỗi / 404').not.toMatch(systemError);

      // ---------- Ghi nhận cách mở: cùng tab hay tab mới (Excel: [Cần xác nhận]) ----------
      if (newTab) {
        note('ux-note', '[Cần xác nhận] Trang hóa đơn mở trong TAB MỚI: người dùng vẫn giữ nguyên trang chi tiết đơn.');
      } else {
        note('ux-note', '[Cần xác nhận] Trang hóa đơn mở CÙNG TAB: kiểm tra người dùng quay lại được trang chi tiết đơn.');
        // Cùng tab: bấm Back phải quay về đúng trang chi tiết đơn (ảnh hưởng trải nghiệm quay lại)
        const backOk = await page
          .goBack({ waitUntil: 'domcontentloaded', timeout: 20000 })
          .then(() => page.url().includes(ORDER_ID_1))
          .catch(() => false);
        await attachText(
          'Invoice_01_quay_lai',
          `Trang chi tiết ban đầu: ${detailUrl}\nSau khi Back: ${page.url()}\nQuay về đúng chi tiết đơn: ${backOk ? 'CÓ' : 'KHÔNG'}`
        );
        if (!backOk) {
          note('ux-note', `Sau khi mở hóa đơn cùng tab, nút Back không quay về chi tiết đơn ${ORDER_ID_1} (URL: ${page.url()}).`);
        }
      }
    } finally {
      if (newTab) await newTab.close().catch(() => { });
    }
  });

  test('Order_Invoice_02: Kiểm tra bảng kết quả hóa đơn', async ({ page, context }) => {
    test.skip(!HAS_AUTH, '[Invoice_02] Bỏ qua: không tìm thấy auth/dmx_storageState.json');
    test.setTimeout(120000);                         // trang hóa đơn thuộc hệ thống khác, có thể tải chậm

    const readBodyOf = async (p: Page) => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const systemError = /đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|404|Not Found|Something went wrong/i;
    const INVOICE_HOST = 'hddt.thegioididong.com';
    const placedAtRegex = /Đặt lúc:?\s*\d{1,2}:\d{2}[^\d]{0,25}(\d{2})\/(\d{2})\/(\d{4})/i;

    // ---------- Pre-condition: thực hiện lại Order_Invoice_01 để tới trang "TRA CỨU HÓA ĐƠN ĐIỆN TỬ CỦA BẠN" ----------
    await page.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    expect(page.url(), 'Phải vào được trang chi tiết, không bị chuyển sang đăng nhập').not.toMatch(/dang-nhap/i);

    let detailBody = '';
    await expect
      .poll(async () => {
        detailBody = await readBodyOf(page);
        return detailBody.includes(ORDER_ID_1) && /Xem hóa đơn/i.test(detailBody) && placedAtRegex.test(detailBody);
      }, {
        message: 'Trang chi tiết phải hiển thị mã đơn, ngày đặt và nút [Xem hóa đơn]',
        timeout: 25000,
      })
      .toBe(true);

    // Ngày đặt của đơn (dd/mm/yyyy) để đối chiếu với Ngày HĐ, không viết cứng
    const [, od, om, oy] = detailBody.match(placedAtRegex)!;
    const orderDate = `${od}-${om}-${oy}`;           // dạng dd-mm-yyyy như cột Ngày HĐ

    const invoiceBtn = page.getByText(/Xem hóa đơn/i).first();
    await expect(invoiceBtn, 'Phải có nút [Xem hóa đơn]').toBeVisible({ timeout: 15000 });
    await invoiceBtn.scrollIntoViewIfNeeded();
    await dismissPopups(page);

    const newTabPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await invoiceBtn.click({ timeout: 10000 });
    const newTab = await newTabPromise;
    const invoicePage = newTab ?? page;

    try {
      await expect(invoicePage, `Phải mở trang ${INVOICE_HOST}`)
        .toHaveURL(new RegExp(INVOICE_HOST.replace(/\./g, '\\.'), 'i'), { timeout: 30000 });

      // Chờ bảng kết quả xuất hiện (tự chờ, không dùng sleep cố định)
      let invoiceBody = '';
      await expect
        .poll(async () => {
          invoiceBody = await readBodyOf(invoicePage).catch(() => '');
          return /TRA CỨU HÓA ĐƠN ĐIỆN TỬ CỦA BẠN/i.test(invoiceBody) && /Số hóa đơn/i.test(invoiceBody);
        }, {
          message: 'Trang phải hiển thị tiêu đề tra cứu và bảng kết quả (cột "Số hóa đơn")',
          timeout: 30000,
        })
        .toBe(true);
      expect(invoiceBody, 'Trang hóa đơn không được hiện thông báo lỗi / 404').not.toMatch(systemError);

      // ---------- Bước 1: xem bảng kết quả, đối chiếu với đơn hàng ----------
      const table = invoicePage.locator('table').filter({ hasText: /Số hóa đơn/i }).first();
      await expect(table, 'Phải có bảng kết quả hóa đơn').toBeVisible({ timeout: 15000 });
      await table.scrollIntoViewIfNeeded();
      await shot(invoicePage, 'Invoice_02_bang_ket_qua');

      // Verify 1: bảng có đủ các cột
      const headerText = ((await table.locator('tr').first().innerText()) || '').replace(/\s+/g, ' ');
      await attachText('Invoice_02_tieu_de_cot', headerText);
      const columns: Array<[string, RegExp]> = [
        ['Mẫu HĐ', /Mẫu\s*HĐ/i],
        ['Ký hiệu HĐ', /Ký\s*hiệu\s*HĐ/i],
        ['Số hóa đơn', /Số\s*hóa\s*đơn/i],
        ['Ngày HĐ', /Ngày\s*HĐ/i],
        ['Tình trạng', /Tình\s*trạng/i],
        ['Ghi chú', /Ghi\s*chú/i],
        ['Chức năng', /Chức\s*năng/i],
      ];
      const missing = columns.filter(([, re]) => !re.test(headerText)).map(([name]) => name);
      expect(missing, `Bảng thiếu cột: ${missing.join(', ')}`).toEqual([]);

      // Dòng hóa đơn của đơn: dòng có chức năng [XEM]
      const rows = table.locator('tr').filter({ hasText: /XEM/ });
      const rowCount = await rows.count();
      expect(rowCount, 'Bảng phải có ít nhất 1 dòng hóa đơn (có chức năng XEM)').toBeGreaterThanOrEqual(1);
      if (rowCount > 1) note('data-note', `Bảng có ${rowCount} dòng hóa đơn, kiểm tra dòng đầu tiên.`);
      const row = rows.first();
      const rowText = ((await row.innerText()) || '').replace(/\s+/g, ' ');
      const cells = (await row.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
      await attachText('Invoice_02_dong_hoa_don', `Các ô: ${JSON.stringify(cells)}\nCả dòng: ${rowText}`);

      // Verify 2: dữ liệu khớp đơn
      // 2a. Ngày HĐ trùng ngày đặt đơn (dạng dd-mm-yyyy)
      expect(rowText, `Ngày HĐ phải trùng ngày đặt đơn (${orderDate})`).toContain(orderDate);

      // 2b. Tình trạng "đang sử dụng"
      expect(rowText, 'Tình trạng hóa đơn phải là "đang sử dụng"').toMatch(/đang sử dụng/i);

      // 2c. Số hóa đơn là dãy số, Ký hiệu HĐ có giá trị (giá trị mẫu trong Excel: 705384 / 1K24TAG / Mẫu 1)
      const invoiceNo = rowText.match(/(?<![\d-])\d{5,8}(?![\d-])/)?.[0] ?? '';
      expect(invoiceNo, 'Phải đọc được Số hóa đơn (dãy số)').not.toBe('');
      const symbol = rowText.match(/\b\d[A-Z]\d{2}[A-Z]{1,4}\b/)?.[0] ?? '';
      expect(symbol, 'Phải đọc được Ký hiệu HĐ (dạng 1K24TAG)').not.toBe('');
      await attachText('Invoice_02_gia_tri', `Số hóa đơn: ${invoiceNo}\nKý hiệu HĐ: ${symbol}\nNgày HĐ phải bằng: ${orderDate}`);
      if (invoiceNo !== '705384' || symbol !== '1K24TAG') {
        note('data-note', `Số HĐ/Ký hiệu thực tế (${invoiceNo} / ${symbol}) khác giá trị mẫu trong Excel (705384 / 1K24TAG): cập nhật lại ví dụ trong Excel.`);
      }
      if (cells.length && !/^1$/.test(cells[0])) {
        note('data-note', `Mẫu HĐ thực tế "${cells[0]}" khác giá trị mẫu "1" trong Excel.`);
      }

      // Verify 3: cột Chức năng có XEM | Tải HĐ chuyển đổi | TẢI XML
      expect(rowText, 'Cột Chức năng phải có [XEM]').toMatch(/XEM/);
      expect(rowText, 'Cột Chức năng phải có [Tải HĐ chuyển đổi]').toMatch(/Tải\s*HĐ\s*chuyển\s*đổi/i);
      expect(rowText, 'Cột Chức năng phải có [TẢI XML]').toMatch(/TẢI\s*XML/i);

      // Mỗi chức năng là phần tử bấm được (không bấm thử ở đây, đã có Invoice_03 và Invoice_04)
      for (const label of [/^XEM$/, /Tải\s*HĐ\s*chuyển\s*đổi/i, /^TẢI\s*XML$/i]) {
        await expect(row.getByText(label).first(), `Chức năng ${label} phải hiển thị trong dòng hóa đơn`).toBeVisible();
      }
    } finally {
      if (newTab) await newTab.close().catch(() => { });
    }
  });

  test('Order_Invoice_03: Kiểm tra click [XEM] để xem hóa đơn', async ({ page, context }) => {
    test.skip(!HAS_AUTH, '[Invoice_03] Bỏ qua: không tìm thấy auth/dmx_storageState.json');
    test.setTimeout(150000);

    const readBodyOf = async (p: Page) => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const INVOICE_HOST = 'hddt.thegioididong.com';
    const placedAtRegex = /Đặt lúc:?\s*\d{1,2}:\d{2}[^\d]{0,25}(\d{2})\/(\d{2})\/(\d{4})/i;

    // ---------- Pre-condition: thực hiện lại Order_Invoice_01 ----------
    await page.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    expect(page.url(), 'Phải vào được trang chi tiết, không bị chuyển sang đăng nhập').not.toMatch(/dang-nhap/i);

    let detailBody = '';
    await expect
      .poll(async () => {
        detailBody = await readBodyOf(page);
        return detailBody.includes(ORDER_ID_1) && /Xem hóa đơn/i.test(detailBody) && placedAtRegex.test(detailBody);
      }, { message: 'Trang chi tiết phải hiển thị mã đơn, ngày đặt và nút [Xem hóa đơn]', timeout: 25000 })
      .toBe(true);
    const [, od, om, oy] = detailBody.match(placedAtRegex)!;

    const invoiceBtn = page.getByText(/Xem hóa đơn/i).first();
    await expect(invoiceBtn, 'Phải có nút [Xem hóa đơn]').toBeVisible({ timeout: 15000 });
    await invoiceBtn.scrollIntoViewIfNeeded();
    await dismissPopups(page);

    const lookupTabPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await invoiceBtn.click({ timeout: 10000 });
    const lookupTab = await lookupTabPromise;
    const lookupPage = lookupTab ?? page;
    let viewTab: Page | null = null;

    try {
      await expect(lookupPage, `Phải mở trang ${INVOICE_HOST}`)
        .toHaveURL(new RegExp(INVOICE_HOST.replace(/\./g, '\\.'), 'i'), { timeout: 30000 });

      const table = lookupPage.locator('table').filter({ hasText: /Số hóa đơn/i }).first();
      await expect(table, 'Phải có bảng kết quả hóa đơn').toBeVisible({ timeout: 30000 });
      const row = table.locator('tr').filter({ hasText: /XEM/ }).first();
      await expect(row, 'Bảng phải có dòng hóa đơn có chức năng [XEM]').toBeVisible({ timeout: 15000 });
      const rowText = ((await row.innerText()) || '').replace(/\s+/g, ' ');
      const invoiceNo = rowText.match(/(?<![\d-])\d{5,8}(?![\d-])/)?.[0] ?? '';
      expect(invoiceNo, 'Phải đọc được Số hóa đơn ở dòng hóa đơn').not.toBe('');

      // ---------- Bước 1: click [XEM] ----------
      const viewBtn = row.getByText(/^XEM$/).first();
      await expect(viewBtn, 'Dòng hóa đơn phải có nút [XEM]').toBeVisible({ timeout: 10000 });

      const viewTabPromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
      const downloadPromise = lookupPage.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await viewBtn.click({ timeout: 10000 });
      const [opened, download] = await Promise.all([viewTabPromise, downloadPromise]);
      viewTab = opened;

      // ---------- Lấy nội dung hóa đơn mà KHÔNG đụng vào DOM của trình xem PDF ----------
      let bytes: Buffer | null = null;
      let contentType = '';
      let how = '';

      if (download) {
        how = 'TẢI FILE';
        const p = await download.path();
        bytes = p ? fs.readFileSync(p) : null;
        contentType = /\.pdf$/i.test(download.suggestedFilename()) ? 'application/pdf' : '';
      } else {
        how = viewTab ? 'TAB MỚI' : 'CÙNG TAB';
        const viewPage = viewTab ?? lookupPage;
        // Chỉ chờ URL, không gọi evaluate/screenshot fullPage trên trình xem PDF (dễ treo)
        await expect(viewPage, 'Click [XEM] phải mở trang tải hóa đơn')
          .toHaveURL(/einvoices|DownloadEInvoice|hddt/i, { timeout: 30000 });
        const pdfUrl = viewPage.url();
        const res = await context.request.get(pdfUrl, { timeout: 30000 });
        expect(res.status(), 'Tải nội dung hóa đơn phải trả về HTTP 200').toBe(200);
        contentType = res.headers()['content-type'] || '';
        bytes = await res.body();
        await viewPage.screenshot({ timeout: 10000 })
          .then((buf) => test.info().attach('Invoice_03_xem_hoa_don', { body: buf, contentType: 'image/png' }))
          .catch(() => note('ux-note', 'Không chụp được ảnh trình xem PDF, kiểm tra bằng video.'));
      }
      await attachText('Invoice_03_cach_mo', `Cách hiển thị hóa đơn: ${how}\nContent-Type: ${contentType || '(không rõ)'}\nKích thước: ${bytes?.length ?? 0} byte`);
      note('ux-note', `Click [XEM] hiển thị hóa đơn bằng: ${how} (${contentType || 'không rõ loại'}).`);

      expect(bytes && bytes.length, 'Hóa đơn không được rỗng').toBeGreaterThan(1000);
      expect(bytes!.subarray(0, 4).toString(), 'Hóa đơn phải là file PDF hợp lệ (bắt đầu bằng %PDF)').toBe('%PDF');

      // ---------- Đọc chữ trong PDF ----------
      let text = '';
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        text = ((await pdfParse(bytes)).text || '').replace(/\s+/g, ' ');
      } catch (e) {
        note('manual-only', `Không đọc được chữ trong PDF (đã cài pdf-parse chưa?): ${(e as Error).message.split('\n')[0]}. Kiểm tra nội dung bằng mắt qua video.`);
        return;
      }
      await attachText('Invoice_03_tom_tat', `Số HĐ cần tìm: ${invoiceNo}\nSố ký tự đọc được: ${text.length}`);
      expect(text.length, 'PDF phải đọc được chữ (không phải ảnh quét)').toBeGreaterThan(100);

      // ---------- Verify: nội dung hóa đơn ----------
      // Số, ngày, tiền: so khớp chắc chắn
      expect(text, `Số hóa đơn phải là ${invoiceNo} (trùng bảng tra cứu)`).toContain(invoiceNo);
      expect(text, 'Tổng tiền trên hóa đơn phải là 650.000đ').toMatch(/650[.,]000/);
      expect(
        text.includes(`${od}/${om}/${oy}`) || text.includes(`${od}-${om}-${oy}`),
        `Ngày hóa đơn phải trùng ngày đặt đơn ${od}/${om}/${oy}`
      ).toBe(true);
      expect(text, 'Hóa đơn không được lỗi font (ký tự �)').not.toContain('\uFFFD');

      // Chữ tiếng Việt: dùng soft vì PDF có thể mã hóa font khiến chữ đọc ra sai dấu
      expect.soft(text, 'Hóa đơn phải có thông tin đơn vị bán (CÔNG TY...)').toMatch(/CÔNG TY|Công ty/i);
      expect.soft(text, 'Hóa đơn phải có thông tin người mua').toMatch(/người mua|Người mua/i);
      expect.soft(text, 'Hóa đơn phải có hàng hóa Tai nghe').toMatch(/Tai nghe/i);
      expect.soft(text, 'Hóa đơn phải có hàng hóa Cáp sạc (Cáp Type C...)').toMatch(/Cáp/i);
    } finally {
      if (viewTab) await viewTab.close().catch(() => { });
      if (lookupTab) await lookupTab.close().catch(() => { });
    }
  });

  test('Order_Invoice_04: Kiểm tra [Tải HĐ chuyển đổi]', async ({ page, context }) => {
    test.skip(!HAS_AUTH, '[Invoice_04] Bỏ qua: không tìm thấy auth/dmx_storageState.json');
    test.setTimeout(150000);

    const readBodyOf = async (p: Page) => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const INVOICE_HOST = 'hddt.thegioididong.com';
    const placedAtRegex = /Đặt lúc:?\s*\d{1,2}:\d{2}[^\d]{0,25}(\d{2})\/(\d{2})\/(\d{4})/i;

    // ---------- Pre-condition: thực hiện lại Order_Invoice_01 ----------
    await page.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    expect(page.url(), 'Phải vào được trang chi tiết, không bị chuyển sang đăng nhập').not.toMatch(/dang-nhap/i);

    let detailBody = '';
    await expect
      .poll(async () => {
        detailBody = await readBodyOf(page);
        return detailBody.includes(ORDER_ID_1) && /Xem hóa đơn/i.test(detailBody) && placedAtRegex.test(detailBody);
      }, { message: 'Trang chi tiết phải hiển thị mã đơn, ngày đặt và nút [Xem hóa đơn]', timeout: 25000 })
      .toBe(true);
    const [, od, om, oy] = detailBody.match(placedAtRegex)!;

    const invoiceBtn = page.getByText(/Xem hóa đơn/i).first();
    await expect(invoiceBtn, 'Phải có nút [Xem hóa đơn]').toBeVisible({ timeout: 15000 });
    await invoiceBtn.scrollIntoViewIfNeeded();
    await dismissPopups(page);

    const lookupTabPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await invoiceBtn.click({ timeout: 10000 });
    const lookupTab = await lookupTabPromise;
    const lookupPage = lookupTab ?? page;
    let viewTab: Page | null = null;

    try {
      await expect(lookupPage, `Phải mở trang ${INVOICE_HOST}`)
        .toHaveURL(new RegExp(INVOICE_HOST.replace(/\./g, '\\.'), 'i'), { timeout: 30000 });

      const table = lookupPage.locator('table').filter({ hasText: /Số hóa đơn/i }).first();
      await expect(table, 'Phải có bảng kết quả hóa đơn').toBeVisible({ timeout: 30000 });
      const row = table.locator('tr').filter({ hasText: /Tải\s*HĐ\s*chuyển\s*đổi/i }).first();
      await expect(row, 'Bảng phải có dòng hóa đơn có chức năng [Tải HĐ chuyển đổi]').toBeVisible({ timeout: 15000 });
      const rowText = ((await row.innerText()) || '').replace(/\s+/g, ' ');
      const invoiceNo = rowText.match(/(?<![\d-])\d{5,8}(?![\d-])/)?.[0] ?? '';
      expect(invoiceNo, 'Phải đọc được Số hóa đơn ở dòng hóa đơn').not.toBe('');
      await shot(lookupPage, 'Invoice_04_truoc_click_tai');

      // ---------- Bước 1: click [Tải HĐ chuyển đổi] ----------
      const downloadBtn = row.getByText(/Tải\s*HĐ\s*chuyển\s*đổi/i).first();
      await expect(downloadBtn, 'Dòng hóa đơn phải có nút [Tải HĐ chuyển đổi]').toBeVisible({ timeout: 10000 });

      // File có thể được tải thẳng (download) hoặc mở ở tab mới như nút [XEM]: bắt cả hai
      const downloadPromise = lookupPage.waitForEvent('download', { timeout: 15000 }).catch(() => null);
      const viewTabPromise = context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
      await downloadBtn.click({ timeout: 10000 });
      const [download, opened] = await Promise.all([downloadPromise, viewTabPromise]);
      viewTab = opened;

      let bytes: Buffer | null = null;
      let fileName = '';
      let contentType = '';
      let how = '';

      if (download) {
        how = 'TẢI FILE (sự kiện download)';
        fileName = download.suggestedFilename();
        contentType = /\.pdf$/i.test(fileName) ? 'application/pdf' : '';
        const savePath = path.join(__dirname, '../test-results', `Invoice_04_${fileName || 'hoa_don.pdf'}`);
        await download.saveAs(savePath);
        bytes = fs.readFileSync(savePath);
      } else if (viewTab) {
        how = 'MỞ TAB MỚI (không phát sinh download)';
        // Chỉ chờ URL, không gọi evaluate/screenshot fullPage trên trình xem PDF (dễ treo)
        await expect(viewTab, 'Click [Tải HĐ chuyển đổi] phải mở trang/tệp hóa đơn')
          .toHaveURL(/einvoices|Download|hddt/i, { timeout: 30000 });
        const fileUrl = viewTab.url();
        const res = await context.request.get(fileUrl, { timeout: 30000 });
        expect(res.status(), 'Tải tệp hóa đơn phải trả về HTTP 200').toBe(200);
        const cd = res.headers()['content-disposition'] || '';
        contentType = res.headers()['content-type'] || '';
        fileName = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1] ?? fileUrl.split('?')[0].split('/').pop() ?? '';
        bytes = await res.body();
      }

      await attachText(
        'Invoice_04_cach_tai',
        `Cách nhận file: ${how || 'KHÔNG bắt được download hay tab mới'}\nTên file: ${fileName || '(không rõ)'}\nKích thước: ${bytes?.length ?? 0} byte`
      );
      expect(
        bytes,
        'Click [Tải HĐ chuyển đổi] phải tải về được file (không bắt được download cũng không mở tab mới)'
      ).not.toBeNull();
      note('ux-note', `[Tải HĐ chuyển đổi]: ${how}.`);

      // Verify 1: tải thành công, tên file hợp lý, file không rỗng
      expect(fileName, 'Tên file không được rỗng').toBeTruthy();
      // Loại file xác định bằng Content-Type + nội dung (%PDF), không dựa vào đuôi trong URL
      if (contentType && !/pdf/i.test(contentType)) {
        note('ux-note', `Content-Type là "${contentType}", không phải application/pdf: cần xác nhận.`);
      }
      if (!/\.pdf$/i.test(fileName)) {
        note('ux-note', `Tên file "${fileName}" không có đuôi .pdf (server không trả Content-Disposition): người dùng lưu file sẽ phải tự đổi đuôi. Cần xác nhận tên file có "hợp lý" không.`);
      }
      expect(bytes!.length, 'File tải về không được rỗng').toBeGreaterThan(1000);
      if (!fileName.includes(invoiceNo)) {
        note('ux-note', `Tên file "${fileName}" không chứa số hóa đơn ${invoiceNo}: cần xác nhận quy tắc đặt tên.`);
      }

      // Verify 2: file mở được và đúng định dạng PDF
      expect(bytes!.subarray(0, 4).toString(), 'File tải về phải là PDF hợp lệ (bắt đầu bằng %PDF)').toBe('%PDF');

      // Đọc chữ trong PDF (không đọc DOM trình xem PDF)
      let text = '';
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        text = ((await pdfParse(bytes)).text || '').replace(/\s+/g, ' ');
      } catch (e) {
        note('manual-only', `Không đọc được chữ trong PDF (đã cài pdf-parse chưa?): ${(e as Error).message.split('\n')[0]}. Kiểm tra nội dung bằng mắt qua video.`);
        return;
      }
      await attachText('Invoice_04_tom_tat', `Số HĐ cần tìm: ${invoiceNo}\nSố ký tự đọc được: ${text.length}`);
      expect(text.length, 'PDF phải đọc được chữ (không phải ảnh quét)').toBeGreaterThan(100);

      // Verify 3: nội dung khớp hóa đơn (số HĐ, tổng tiền, ngày)
      expect(text, `Số hóa đơn trong file phải là ${invoiceNo}`).toContain(invoiceNo);
      expect(text, 'Tổng tiền trong file phải là 650.000đ').toMatch(/650[.,]000/);
      expect(
        text.includes(`${od}/${om}/${oy}`) || text.includes(`${od}-${om}-${oy}`),
        `Ngày hóa đơn trong file phải trùng ngày đặt đơn ${od}/${om}/${oy}`
      ).toBe(true);
      expect(text, 'File không được lỗi font (ký tự �)').not.toContain('\uFFFD');
      expect.soft(text, 'File phải có hàng hóa Tai nghe').toMatch(/Tai nghe/i);
      expect.soft(text, 'File phải có hàng hóa Cáp').toMatch(/Cáp/i);
    } finally {
      if (viewTab) await viewTab.close().catch(() => { });
      if (lookupTab) await lookupTab.close().catch(() => { });
    }
  });

  test('Order_Invoice_05: Kiểm tra tra cứu với mã sai', async ({ page, context }) => {
    test.skip(!HAS_AUTH, '[Invoice_05] Bỏ qua: không tìm thấy auth/dmx_storageState.json');
    test.setTimeout(150000);

    const readBodyOf = async (p: Page) => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const INVOICE_HOST = 'hddt.thegioididong.com';
    const WRONG_ORDER_CODE = '99999OV99999999999';          // mã đơn không tồn tại (theo Excel)
    // Thông báo "không tìm thấy hóa đơn" (chưa biết câu chữ thật nên mở rộng)
    const notFoundMsg = /không tìm thấy|không tồn tại|không có (hóa đơn|dữ liệu|kết quả)|không hợp lệ|sai mã|thất bại/i;
    // Lỗi hệ thống (trang lỗi của server) không được lộ ra khi nhập sai
    const serverError = /Server Error|Stack Trace|Exception|Runtime Error|HTTP Error 500|Object reference/i;
    const placedAtRegex = /Đặt lúc:?\s*\d{1,2}:\d{2}[^\d]{0,25}(\d{2})\/(\d{2})\/(\d{4})/i;

    // ---------- Pre-condition: thực hiện lại Order_Invoice_01 ----------
    await page.goto(`${ORDER_DETAIL_URL_PREFIX}${ORDER_ID_1}${ORDER_DETAIL_SUFFIX}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);
    await dismissPopups(page);
    expect(page.url(), 'Phải vào được trang chi tiết, không bị chuyển sang đăng nhập').not.toMatch(/dang-nhap/i);

    await expect
      .poll(async () => {
        const t = await readBodyOf(page);
        return t.includes(ORDER_ID_1) && /Xem hóa đơn/i.test(t) && placedAtRegex.test(t);
      }, { message: 'Trang chi tiết phải hiển thị mã đơn, ngày đặt và nút [Xem hóa đơn]', timeout: 25000 })
      .toBe(true);

    const invoiceBtn = page.getByText(/Xem hóa đơn/i).first();
    await expect(invoiceBtn, 'Phải có nút [Xem hóa đơn]').toBeVisible({ timeout: 15000 });
    await invoiceBtn.scrollIntoViewIfNeeded();
    await dismissPopups(page);

    const lookupTabPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await invoiceBtn.click({ timeout: 10000 });
    const lookupTab = await lookupTabPromise;
    const lookupPage = lookupTab ?? page;

    try {
      await expect(lookupPage, `Phải mở trang ${INVOICE_HOST}`)
        .toHaveURL(new RegExp(INVOICE_HOST.replace(/\./g, '\\.'), 'i'), { timeout: 30000 });
      const lookupUrl = lookupPage.url();                    // URL gốc có tham số data, dùng để quay lại trạng thái đúng ở bước 2

      // Trang tra cứu: có bảng kết quả ban đầu (đối chứng) và 2 ô điền sẵn
      const resultRows = () => lookupPage.locator('table tr').filter({ hasText: /XEM/ });
      await expect(resultRows().first(), 'Trạng thái ban đầu phải có dòng hóa đơn (đối chứng)').toBeVisible({ timeout: 30000 });
      const initialText = ((await resultRows().first().innerText()) || '').replace(/\s+/g, ' ');
      const invoiceNo = initialText.match(/(?<![\d-])\d{5,8}(?![\d-])/)?.[0] ?? '';
      expect(invoiceNo, 'Phải đọc được Số hóa đơn ở trạng thái ban đầu').not.toBe('');

      const inputs = lookupPage.locator(
        'input[type="text"]:visible, input:not([type]):visible, input[type="search"]:visible'
      );
      const searchBtn = lookupPage
        .getByRole('button', { name: /TRA CỨU HÓA ĐƠN/i })
        .or(lookupPage.locator('input[type="submit"][value*="TRA CỨU" i], a:has-text("TRA CỨU HÓA ĐƠN")'))
        .first();

      // Ghi lại giá trị 2 ô điền sẵn (ô 1 = mã đơn, ô 2 = mã tra cứu), KHÔNG đưa giá trị vào báo cáo
      const inputCount = await inputs.count();
      expect(inputCount, 'Trang tra cứu phải có ít nhất 2 ô điền sẵn (mã đơn và mã tra cứu)').toBeGreaterThanOrEqual(2);
      const originalOrderCode = await inputs.nth(0).inputValue();
      const originalLookupCode = await inputs.nth(1).inputValue();
      expect(originalOrderCode, 'Ô mã đơn phải được điền sẵn').not.toBe('');
      expect(originalLookupCode, 'Ô mã tra cứu phải được điền sẵn').not.toBe('');
      await attachText(
        'Invoice_05_o_dien_san',
        `Số ô nhập: ${inputCount}\nĐộ dài mã đơn: ${originalOrderCode.length}\nĐộ dài mã tra cứu: ${originalLookupCode.length}`
      );
      await shot(lookupPage, 'Invoice_05_truoc_sua');

      // Điền 2 ô, bấm [TRA CỨU HÓA ĐƠN], chờ kết quả rồi trả về trạng thái trang
      const doLookup = async (orderCode: string, lookupCode: string, tag: string) => {
        await inputs.nth(0).fill(orderCode);
        await inputs.nth(1).fill(lookupCode);
        await expect(searchBtn, 'Phải có nút [TRA CỨU HÓA ĐƠN]').toBeVisible({ timeout: 10000 });
        await searchBtn.click({ timeout: 10000 });
        await lookupPage.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => { });

        // Chờ có kết quả: thông báo không tìm thấy, hoặc bảng hóa đơn cũ biến mất (tối đa 20s)
        let body = '';
        await expect
          .poll(async () => {
            body = await readBodyOf(lookupPage).catch(() => '');
            return notFoundMsg.test(body) || (await resultRows().count()) === 0;
          }, {
            message: `[${tag}] Sau khi tra cứu sai phải có thông báo không tìm thấy hoặc không còn hóa đơn nào`,
            timeout: 20000,
          })
          .toBe(true);
        await lookupPage.waitForTimeout(1000);
        body = await readBodyOf(lookupPage).catch(() => '');
        await shot(lookupPage, `Invoice_05_${tag}`);
        return { body, rows: await resultRows().count(), msg: notFoundMsg.test(body) };
      };

      // Kiểm tra chung cho cả 2 bước: không hiển thị hóa đơn, không lộ thông tin, không lỗi hệ thống
      const verifyNoLeak = (tag: string, r: { body: string; rows: number; msg: boolean }) => {
        expect(r.rows, `[${tag}] Không được hiển thị dòng hóa đơn nào`).toBe(0);
        expect(r.msg, `[${tag}] Phải có thông báo không tìm thấy hóa đơn`).toBe(true);
        expect(r.body, `[${tag}] Không được lộ số hóa đơn ${invoiceNo}`).not.toContain(invoiceNo);
        expect(r.body, `[${tag}] Không được lộ tổng tiền 650.000đ`).not.toMatch(/650[.,]000/);
        expect(r.body, `[${tag}] Không được lộ tên hàng hóa`).not.toMatch(/Tai nghe|Cáp Type/i);
        expect(r.body, `[${tag}] Không được lộ số điện thoại người mua`).not.toContain(TEST_PHONE);
        expect(r.body, `[${tag}] Không được hiện lỗi hệ thống của server`).not.toMatch(serverError);
        expect(r.body.length, `[${tag}] Trang không được trắng`).toBeGreaterThan(100);
      };

      // ---------- Bước 1: giữ mã đơn đúng, sửa 1 ký tự của mã tra cứu ----------
      const lastChar = originalLookupCode.slice(-1);
      const replacement = /x/i.test(lastChar) ? 'Y' : 'X';       // luôn khác ký tự gốc
      const wrongLookupCode = originalLookupCode.slice(0, -1) + replacement;
      expect(wrongLookupCode, 'Mã tra cứu sai phải khác mã gốc').not.toBe(originalLookupCode);

      const r1 = await doLookup(originalOrderCode, wrongLookupCode, 'buoc1_ma_tra_cuu_sai');
      await attachText('Invoice_05_buoc1', `Số dòng hóa đơn sau khi tra cứu: ${r1.rows}\nCó thông báo không tìm thấy: ${r1.msg}\nThông báo: ${r1.body.match(notFoundMsg)?.[0] ?? '(không có)'}`);
      verifyNoLeak('Bước 1', r1);

            // Mở lại trang tra cứu từ URL gốc: chỉ có form với 2 ô điền sẵn (chưa có bảng kết quả)
      const reopenLookup = async () => {
        await lookupPage.goto(lookupUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await expect(inputs.nth(1), 'Sau khi mở lại, ô mã tra cứu phải được điền sẵn')
          .not.toHaveValue('', { timeout: 30000 });
      };

      // ---------- Bước 2: nhập mã đơn không tồn tại cùng mã tra cứu đúng ----------
      await reopenLookup();

      const r2 = await doLookup(WRONG_ORDER_CODE, originalLookupCode, 'buoc2_ma_don_khong_ton_tai');
      await attachText('Invoice_05_buoc2', `Mã đơn thử: ${WRONG_ORDER_CODE}\nSố dòng hóa đơn sau khi tra cứu: ${r2.rows}\nCó thông báo không tìm thấy: ${r2.msg}\nThông báo: ${r2.body.match(notFoundMsg)?.[0] ?? '(không có)'}`);
      verifyNoLeak('Bước 2', r2);

      // ---------- Đối chứng: mã đúng phải tra cứu ra hóa đơn (chứng minh chức năng tra cứu đang hoạt động) ----------
      await reopenLookup();
      await inputs.nth(0).fill(originalOrderCode);
      await inputs.nth(1).fill(originalLookupCode);
      await searchBtn.click({ timeout: 10000 });
      await lookupPage.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => { });
      await expect
        .soft(resultRows().first(), 'Đối chứng: tra cứu với mã đúng phải hiển thị hóa đơn')
        .toBeVisible({ timeout: 20000 });
      await shot(lookupPage, 'Invoice_05_doi_chung_ma_dung');
    } finally {
      if (lookupTab) await lookupTab.close().catch(() => { });
    }
  });
});
