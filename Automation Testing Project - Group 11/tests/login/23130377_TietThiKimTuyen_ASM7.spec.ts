import {
  test,
  expect,
  Page,
  Locator,
  Browser,
  BrowserContext,
} from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * ==============================================================================
 * BỘ AUTOMATION TEST CHỨC NĂNG: ĐĂNG NHẬP (ĐIỆN MÁY XANH)
 * File: tests/23130377_TietThiKimTuyen_ASM7.ts
 * Sinh viên thực hiện: Tiết Thị Kim Tuyên (MSSV: 23130377) - Nhóm 11
 * Môn học / Bài tập: Assignment 7 - Triển khai Script Automation cho Chức Năng Cá Nhân
 * Bộ Test Case: 25 Test Cases theo file Group11_23130377_TietThiKimTuyen.xlsx
 * Website kiểm thử: 100% THUẦN TRỰC TIẾP TRÊN https://www.dienmayxanh.com
 * Tự động ghi hình: video .webm lưu vào thư mục test-results/videos
 *
 * ------------------------------------------------------------------------------
 * LƯU Ý QUAN TRỌNG (đọc trước khi chạy)
 * ------------------------------------------------------------------------------
 * 1. Điện Máy Xanh đăng nhập bằng SĐT -> bấm [TIẾP TỤC] -> mã OTP gửi qua SMS
 *    (KHÔNG có ô mật khẩu). Các test case trong Excel viết theo "SĐT + mật khẩu"
 *    nên script xử lý như sau:
 *      - Nếu form CÓ ô mật khẩu  -> chạy đúng theo Excel (dùng TEST_PASSWORD).
 *      - Nếu form KHÔNG có ô mật khẩu -> test ghi nhận hành vi thực tế (annotation
 *        'actual-behavior') và chạy phiên bản tương đương (OTP) hoặc Skipped (N/A)
 *        đúng như phần Note trong Excel ("nếu không có thì ghi N/A").
 * 2. Không thể tự động nhập OTP thật. Các test đăng nhập thành công dùng cách
 *    "thiết bị tin cậy": mở context mang cookie thiết bị từ auth/dmx_storageState.json
 *    nhưng BỎ accessToken/refreshToken -> nhập SĐT thì web không đòi OTP
 *    (cùng cách Voucher_Access_04).
 * 3. Test nào BẮT BUỘC gửi SMS OTP thật (Login_Pass_01, Login_Security_04 khi web
 *    không có ô mật khẩu) chỉ chạy khi đặt biến môi trường ALLOW_SEND_OTP=1.
 *    Mặc định -> Skipped để tránh gửi SMS thật ngoài ý muốn.
 * 4. Login_Phone_05 cần một SĐT hợp lệ CHƯA đăng ký (UNREGISTERED_PHONE). Không
 *    tự bịa số để tránh gửi SMS tới người lạ -> để trống thì Skipped.
 * 5. Login_Logout_01 và Login_Browser_01 có đăng xuất thật; nếu server thu hồi
 *    token thì cần tạo lại auth/dmx_storageState.json cho lần chạy sau.
 * 6. Cần thêm testMatch vào playwright.config.ts vì tên file không có đuôi .spec:
 *      testMatch: /.*_ASM7\.ts/,
 *
 * Chạy:  npx playwright test tests/23130377_TietThiKimTuyen_ASM7.ts --project=chromium
 *        ALLOW_SEND_OTP=1 npx playwright test ... -g "Pass_01"   (chủ động gửi OTP)
 * ==============================================================================
 */

// ==============================================================================
// CẤU HÌNH
// ==============================================================================
const HOME = "https://www.dienmayxanh.com";
const FALLBACK_LOGIN_URL = `${HOME}/lich-su-mua-hang/dang-nhap`;
const STORAGE_STATE_PATH = path.join(
  __dirname,
  "../auth/dmx_storageState.json",
);
const VIDEO_DIR = path.join(__dirname, "../test-results/videos");
const HAS_AUTH = fs.existsSync(STORAGE_STATE_PATH);

// [BẢN SỬA 2] Cùng User-Agent với auth/login-save.js (lúc tạo storageState)
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// [BẢN SỬA 2] SĐT của tài khoản đã đăng nhập khi tạo storageState (cookie dmx_phone)
const STORED_PHONE: string = (() => {
  try {
    const raw = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, "utf8"));
    const c = (raw.cookies || []).find((x: any) => x.name === "dmx_phone");
    return c ? decodeURIComponent(c.value) : "";
  } catch {
    return "";
  }
})();
const ENV_PHONE = process.env.DMX_PHONE || "";
const TEST_PHONE =
  process.env.DMX_FORCE_PHONE === "1"
    ? ENV_PHONE
    : STORED_PHONE || ENV_PHONE || "09xxxxxxxx"; // SĐT tài khoản test
if (
  STORED_PHONE &&
  ENV_PHONE &&
  STORED_PHONE !== ENV_PHONE &&
  process.env.DMX_FORCE_PHONE !== "1"
) {
  console.warn(
    `[CẢNH BÁO] DMX_PHONE (${ENV_PHONE}) khác SĐT trong auth/dmx_storageState.json (${STORED_PHONE}). ` +
      `Script dùng SĐT trong storageState. Muốn ép dùng DMX_PHONE: đặt thêm DMX_FORCE_PHONE=1.`,
  );
}

const TEST_NAME = process.env.DMX_NAME || "Tuyên"; // điền đúng tên như hiển thị trên web
const TEST_PASSWORD = process.env.DMX_PASSWORD || ""; // chỉ dùng nếu form có ô mật khẩu
const UNREGISTERED_PHONE = process.env.DMX_UNREGISTERED_PHONE || ""; // SĐT hợp lệ nhưng CHƯA đăng ký
const ALLOW_OTP = process.env.ALLOW_SEND_OTP === "1"; // cho phép gửi SMS OTP thật
const HAS_PHONE = /^0\d{9}$/.test(TEST_PHONE);
const PERF_LIMIT_MS = 3000; // ngưỡng Login_Perf_01 (nhóm thống nhất)

const AUTH_COOKIE = /access.?token|refresh.?token/i;
const ERROR_RE =
  /không hợp lệ|không đúng|không chính xác|sai |vui lòng nhập|bắt buộc|không được để trống|định dạng|thất bại|không tồn tại|không thể|thử lại|quá nhiều|khóa|captcha/i;
const LEAK_RE =
  /Internal Server Error|Stack ?trace|Exception|SQLException|SQL syntax|mysql_|ORA-\d+|PG::|Unclosed quotation|at System\.|at com\./i;

// Lớp phủ đen mờ (backdrop popup) hay chặn click trên dienmayxanh.com
const BACKDROP =
  'div.cursor-pointer[class*="bg-[#1E1E1E]"][class*="opacity-50"]';

// Trang rất nặng nên cho mỗi test 3 phút; click kẹt thì báo lỗi sau 15s thay vì chờ cả 2 phút
test.describe.configure({ timeout: 180_000 });
test.use({ actionTimeout: 15_000, navigationTimeout: 45_000 });

type Kind = "guest" | "trusted" | "logged-in";
type Outcome = "logged-in" | "otp" | "error" | "none";
type CtxOptions = Parameters<Browser["newContext"]>[0];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ==============================================================================
// HÀM DÙNG CHUNG
// ==============================================================================

/**
 * guest     : cửa sổ sạch hoàn toàn (khách vãng lai)
 * trusted   : có cookie thiết bị nhưng KHÔNG có accessToken/refreshToken -> nhập SĐT không cần OTP
 * logged-in : dùng nguyên storageState (đã đăng nhập)
 */
async function makeContext(
  browser: Browser,
  kind: Kind,
  extra: CtxOptions = {},
): Promise<BrowserContext> {
  let storageState: any = { cookies: [], origins: [] };
  if (kind !== "guest") {
    const raw = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, "utf8"));
    storageState =
      kind === "logged-in"
        ? raw
        : {
            cookies: raw.cookies.filter((c: any) => !AUTH_COOKIE.test(c.name)),
            origins: raw.origins,
          };
  }
  return browser.newContext({
    storageState,
    viewport: { width: 1920, height: 1080 },
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    recordVideo: { dir: VIDEO_DIR },
    // [BẢN SỬA 2] thiết bị tin cậy / đã đăng nhập phải dùng cùng User-Agent với lúc lưu phiên
    ...(kind !== "guest" ? { userAgent: DESKTOP_UA } : {}),
    ...extra,
  });
}

async function withPage(
  browser: Browser,
  kind: Kind,
  fn: (page: Page, ctx: BrowserContext) => Promise<void>,
  extra: CtxOptions = {},
) {
  test.skip(
    kind !== "guest" && !HAS_AUTH,
    "Bỏ qua: không tìm thấy auth/dmx_storageState.json",
  );
  const ctx = await makeContext(browser, kind, extra);
  const page = await ctx.newPage();
  try {
    await fn(page, ctx);
  } finally {
    await ctx.close().catch(() => {});
  }
}

const requirePhone = () =>
  test.skip(
    !HAS_PHONE,
    "Bỏ qua: chưa có SĐT test hợp lệ (cookie dmx_phone trong storageState hoặc biến môi trường DMX_PHONE)",
  );

const note = (tag: string, type: string, description: string) => {
  console.warn(`[${tag}] ⚠ ${type.toUpperCase()}: ${description}`);
  test.info().annotations.push({ type, description });
};

// Chụp ảnh không bao giờ được làm hỏng test (trang nặng hay treo khi fullPage)
const shot = async (page: Page, name: string) => {
  try {
    const body = await page.screenshot({ fullPage: false, timeout: 10_000 });
    await test.info().attach(name, { body, contentType: "image/png" });
  } catch (e) {
    console.warn(
      `[shot] Bỏ qua ảnh "${name}": ${(e as Error).message.split("\n")[0]}`,
    );
  }
};
const attachText = async (name: string, text: string) =>
  test.info().attach(name, { body: text, contentType: "text/plain" });

// ---------- Xử lý popup / lớp phủ chặn click ----------

/** Đóng popup có lớp phủ đen mờ. Thử: nút đóng -> Escape -> click backdrop -> gỡ khỏi DOM. */
async function dismissOverlays(page: Page) {
  for (let i = 0; i < 3; i++) {
    const backdrop = page.locator(BACKDROP).filter({ visible: true }).first();
    if (!(await backdrop.isVisible({ timeout: 1500 }).catch(() => false)))
      return;

    const closeBtn = page
      .locator(
        '[aria-label*="óng" i], [aria-label*="close" i], button:has-text("Đóng"), button:has-text("Bỏ qua"), button:has-text("Để sau"), button:has-text("Không, cảm ơn")',
      )
      .filter({ visible: true })
      .first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ timeout: 2000 }).catch(() => {});
    } else {
      await page.keyboard.press("Escape").catch(() => {});
    }
    await page.waitForTimeout(500);

    if (await backdrop.isVisible().catch(() => false)) {
      await backdrop
        .click({ position: { x: 5, y: 5 }, timeout: 2000 })
        .catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  // Cách cuối: gỡ hẳn popup khỏi DOM nếu vẫn còn
  await page
    .evaluate((sel) => {
      document
        .querySelectorAll(sel)
        .forEach((e) =>
          (e.parentElement?.parentElement ?? e.parentElement ?? e).remove(),
        );
    }, BACKDROP)
    .catch(() => {});
}

/** Click có dọn overlay trước; nếu vẫn bị chặn thì bắn sự kiện click thẳng vào phần tử. */
async function safeClick(page: Page, loc: Locator) {
  for (let i = 0; i < 3; i++) {
    await dismissOverlays(page);
    try {
      await loc.click({ timeout: 5000 });
      return;
    } catch {
      /* thử lại */
    }
  }
  await loc.evaluate((el) => (el as HTMLElement).click());
}

// ---------- Locator ----------
const phoneInput = (p: Page) =>
  p
    .locator(
      'input[type="tel"], input[name="phone"], input[placeholder*="điện thoại" i]',
    )
    .filter({ visible: true })
    .first();
const passwordInput = (p: Page) =>
  p.locator('input[type="password"]').filter({ visible: true }).first();
const submitBtn = (p: Page) =>
  p
    .locator(
      'button:has-text("TIẾP TỤC"), button:has-text("ĐĂNG NHẬP"), button[type="submit"]',
    )
    .filter({ visible: true })
    .first();
// Nút [Đăng nhập] trên header (loại trừ nút Voucher cũng có href chứa dang-nhap)
const loginHeaderBtn = (p: Page) =>
  p
    .locator('a[href*="dang-nhap"]')
    .filter({ hasText: /^\s*Đăng nhập\s*$/i })
    .filter({ visible: true })
    .first();
const accountLink = (p: Page) =>
  p
    .locator('a[href*="/ca-nhan"]')
    .or(p.getByRole("link", { name: new RegExp(esc(TEST_NAME), "i") }))
    .filter({ visible: true })
    .first();
// [BẢN SỬA 2] nhận diện bước OTP rộng hơn: chữ "gửi lại" hoặc ô nhập mã một lần
const otpPrompt = (p: Page) =>
  p
    .getByText(
      /Mã xác (nhận|thực)|nhập mã|mã OTP|gửi lại|Thay đổi số điện thoại/i,
    )
    .or(p.locator('input[autocomplete="one-time-code"]'))
    .filter({ visible: true })
    .first();

const hasPassword = (p: Page) =>
  passwordInput(p)
    .isVisible()
    .catch(() => false);

// ---------- Đọc chữ trên trang ----------
async function bodyLines(page: Page): Promise<string[]> {
  return (
    (await page.evaluate(() => document.body.innerText).catch(() => "")) || ""
  )
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}
async function newErrorLine(
  page: Page,
  before: string[],
): Promise<string | undefined> {
  const now = await bodyLines(page);
  return now
    .filter((l) => !before.includes(l))
    .find((l) => ERROR_RE.test(l) && l.length < 200);
}
const nativeMessage = (input: Locator) =>
  input
    .evaluate((el) => (el as HTMLInputElement).validationMessage || "")
    .catch(() => "");

/** [BẢN SỬA 2] In + đính kèm thông tin để biết trang đang ở trạng thái nào khi kết quả là 'none'. */
async function diagnose(page: Page, tag: string, api: string[] = []) {
  const url = page.url();
  const text = (await bodyLines(page)).slice(0, 60).join("\n");
  const cookies = (
    await page
      .context()
      .cookies()
      .catch(() => [])
  )
    .map((c) => c.name)
    .filter((n) => /dmx_/i.test(n))
    .join(", ");
  const report = `URL: ${url}\nCookie dmx_*: ${cookies}\n--- API không phải GET ---\n${api.join("\n") || "(không có)"}\n--- Nội dung trang ---\n${text}`;
  console.log(`[${tag}] CHẨN ĐOÁN:\n${report}`);
  await attachText(`${tag}_chan_doan`, report);
  await shot(page, `${tag}_chan_doan`);
}

/** Thu thập phản hồi cho người dùng sau khi submit sai: thông báo lỗi / lỗi HTML5 / nút bị vô hiệu hóa. */
async function collectFeedback(
  page: Page,
  before: string[],
  ms = 4000,
): Promise<string> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const line = await newErrorLine(page, before);
    if (line) return `thông báo: "${line}"`;
    const native = await nativeMessage(phoneInput(page));
    if (native) return `lỗi HTML5: "${native}"`;
    const disabled = await submitBtn(page)
      .isDisabled()
      .catch(() => false);
    if (disabled) return "nút TIẾP TỤC bị vô hiệu hóa";
    await page.waitForTimeout(400);
  }
  return "";
}

// ---------- Mở form đăng nhập ----------
async function openLoginForm(
  page: Page,
  strict = true,
): Promise<{ dedicated: boolean; usedFallback: boolean }> {
  await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 45000 });
  const btn = loginHeaderBtn(page);
  let usedFallback = false;
  if (await btn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await safeClick(page, btn); // đóng popup chắn trước khi click
  } else {
    expect(strict, "Header phải có nút [Đăng nhập]").toBe(false);
    usedFallback = true;
    await page.goto(FALLBACK_LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
  }
  await expect(
    phoneInput(page),
    "Form đăng nhập phải hiển thị ô nhập SĐT",
  ).toBeVisible({ timeout: 15000 });
  return { dedicated: /dang-nhap/i.test(page.url()), usedFallback };
}

// ---------- Kết quả sau khi submit ----------
async function waitLoginOutcome(
  page: Page,
  before: string[],
  timeoutMs = 15000,
  net?: { api: string[] },
): Promise<Outcome> {
  // [BẢN SỬA 2] cookie accessToken xuất hiện = server đã cấp phiên (tín hiệu đáng tin hơn giao diện)
  const hasToken = async () =>
    (
      await page
        .context()
        .cookies()
        .catch(() => [])
    ).some((c) => /access.?token/i.test(c.name) && !!c.value);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await hasToken()) return "logged-in";
    if (
      await otpPrompt(page)
        .isVisible()
        .catch(() => false)
    )
      return "otp";
    const phoneVisible = await phoneInput(page)
      .isVisible()
      .catch(() => false);
    const loginVisible = await loginHeaderBtn(page)
      .isVisible()
      .catch(() => false);
    const accVisible = await accountLink(page)
      .isVisible()
      .catch(() => false);
    if (!phoneVisible && !loginVisible && accVisible) return "logged-in";
    if (await newErrorLine(page, before)) return "error";
    await page.waitForTimeout(400);
  }
  await diagnose(page, "Outcome_none", net?.api ?? []);
  return "none";
}

/** Xác nhận đã đăng nhập: header không còn nút [Đăng nhập], có link tài khoản. */
async function expectLoggedInHeader(page: Page, label = "") {
  if (/dang-nhap/i.test(page.url())) {
    await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  await expect(
    loginHeaderBtn(page),
    `${label} Header không được còn nút [Đăng nhập]`,
  ).toBeHidden({ timeout: 20000 });
  await expect(
    accountLink(page),
    `${label} Header phải hiển thị tên/SĐT/biểu tượng tài khoản`,
  ).toBeVisible({ timeout: 15000 });
}

async function expectGuestHeader(page: Page, label = "") {
  await expect(
    loginHeaderBtn(page),
    `${label} Header phải hiển thị lại nút [Đăng nhập]`,
  ).toBeVisible({ timeout: 20000 });
}

/** Nhập SĐT (+ mật khẩu nếu form có ô mật khẩu) rồi gửi. Trả về outcome. */
async function doLogin(
  page: Page,
  opts: { phone?: string; password?: string; submit?: "click" | "enter" } = {},
): Promise<Outcome> {
  const phone = opts.phone ?? TEST_PHONE;
  const net = watchNetwork(page);
  await phoneInput(page).fill(phone);
  const pw = await hasPassword(page);
  if (pw) await passwordInput(page).fill(opts.password ?? TEST_PASSWORD);
  const before = await bodyLines(page);
  if (opts.submit === "enter") {
    await (pw ? passwordInput(page) : phoneInput(page)).press("Enter");
  } else {
    await safeClick(page, submitBtn(page));
  }
  return waitLoginOutcome(page, before, 15000, net);
}

/** Điền mã OTP (hỗ trợ ô đơn hoặc nhiều ô 1 ký tự). */
async function fillOtp(page: Page, code: string): Promise<boolean> {
  const boxes = page.locator('input[maxlength="1"]').filter({ visible: true });
  const n = await boxes.count();
  if (n >= 4) {
    for (let i = 0; i < n; i++) await boxes.nth(i).fill(code[i] ?? "");
  } else {
    const single = page
      .locator(
        'input[autocomplete="one-time-code"], input[name*="otp" i], input[placeholder*="mã" i], input[inputmode="numeric"]',
      )
      .filter({ visible: true })
      .first();
    if (!(await single.isVisible().catch(() => false))) return false;
    await single.fill(code);
  }
  const confirm = page
    .locator(
      'button:has-text("XÁC NHẬN"), button:has-text("TIẾP TỤC"), button:has-text("ĐĂNG NHẬP")',
    )
    .filter({ visible: true })
    .first();
  if (await confirm.isVisible().catch(() => false))
    await confirm.click({ timeout: 3000 }).catch(() => {});
  return true;
}

async function logout(page: Page) {
  await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 45000 });
  const acc = accountLink(page);
  await expect(acc, "Phải có tên/biểu tượng tài khoản trên Header").toBeVisible(
    { timeout: 15000 },
  );
  await acc.hover().catch(() => {});
  await safeClick(page, acc);
  page.once("dialog", (d) => d.accept().catch(() => {}));
  const out = page
    .getByText(/^\s*Đăng xuất\s*$/i)
    .filter({ visible: true })
    .first();
  await expect(out, "Phải có mục [Đăng xuất]").toBeVisible({ timeout: 15000 });
  await out.click();
  const confirm = page
    .getByText(/^\s*(Đồng ý|Xác nhận|Có)\s*$/i)
    .filter({ visible: true })
    .last();
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false))
    await confirm.click({ timeout: 3000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
}

/** Ghi lại request không phải GET + response 5xx để kiểm tra gửi trùng / lỗi server. */
function watchNetwork(page: Page) {
  const posts: string[] = [];
  const serverErrors: string[] = [];
  const bodies: string[] = [];
  const api: string[] = []; // [BẢN SỬA 2] mọi phản hồi của request không phải GET (phục vụ chẩn đoán)
  page.on("request", (r) => {
    if (
      r.method() !== "GET" &&
      /dienmayxanh|thegioididong|tgdd/i.test(r.url())
    ) {
      posts.push(
        `${r.method()} ${r.url()} ${(r.postData() || "").slice(0, 200)}`,
      );
    }
  });
  page.on("response", (r) => {
    if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
    if (["xhr", "fetch"].includes(r.request().resourceType())) {
      r.text()
        .then((t) => bodies.push(t.slice(0, 500)))
        .catch(() => {});
    }
    if (
      r.request().method() !== "GET" &&
      /dienmayxanh|thegioididong|tgdd/i.test(r.url())
    ) {
      r.text()
        .then((t) =>
          api.push(
            `${r.status()} ${r.request().method()} ${r.url()} -> ${t.slice(0, 200)}`,
          ),
        )
        .catch(() =>
          api.push(`${r.status()} ${r.request().method()} ${r.url()}`),
        );
    }
  });
  return { posts, serverErrors, bodies, api };
}

// ==============================================================================
// PHẦN 1: MỞ / ĐÓNG FORM ĐĂNG NHẬP (OPEN - 2 TEST CASES)
// ==============================================================================
test.describe("PHẦN 1: MỞ / ĐÓNG FORM ĐĂNG NHẬP (OPEN)", () => {
  test("Login_Open_01: Kiểm tra mở form đăng nhập khi nhấn nút [Đăng nhập] trên Header", async ({
    browser,
  }) => {
    await withPage(browser, "guest", async (page) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      // Bước 1: Trang chủ hiển thị bình thường, Header có nút [Đăng nhập]
      await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 45000 });
      await expect(page).toHaveTitle(/Điện máy XANH/i);
      const btn = loginHeaderBtn(page);
      await expect(
        btn,
        "Header phải có nút [Đăng nhập] (khách vãng lai)",
      ).toBeVisible({ timeout: 15000 });

      // Đặt dấu vào window để biết trang chủ có bị tải lại ngoài ý muốn không
      await page.evaluate(() => {
        (window as any).__pwMarker = 1;
      });

      // Bước 2: Click nút [Đăng nhập]
      await btn.scrollIntoViewIfNeeded();
      await safeClick(page, btn);
      await expect(
        phoneInput(page),
        "Phải mở đúng form/trang đăng nhập (có ô nhập SĐT)",
      ).toBeVisible({ timeout: 15000 });
      await expect(
        submitBtn(page),
        "Form đăng nhập phải có nút gửi",
      ).toBeVisible({ timeout: 15000 });

      const dedicated = /dang-nhap/i.test(page.url());
      note(
        "Open_01",
        "actual-behavior",
        dedicated
          ? `Website mở TRANG đăng nhập riêng: ${page.url()}`
          : "Website mở POPUP đăng nhập ngay trên trang chủ",
      );
      if (!dedicated) {
        const marker = await page
          .evaluate(() => (window as any).__pwMarker)
          .catch(() => undefined);
        expect(marker, "Popup mở ra thì trang chủ không được bị tải lại").toBe(
          1,
        );
      }
      expect(pageErrors, "Không được có lỗi JavaScript khi mở form").toEqual(
        [],
      );

      await shot(page, "Open_01_form_dang_nhap");
      await page.waitForTimeout(2000);
    });
  });

  test("Login_Open_02: Kiểm tra đóng form đăng nhập khi nhấn nút đóng [X] hoặc nhấn ra ngoài vùng form", async ({
    browser,
  }) => {
    await withPage(browser, "guest", async (page) => {
      const { dedicated } = await openLoginForm(page);
      if (dedicated) {
        note(
          "Open_02",
          "actual-behavior",
          `Website dùng trang đăng nhập riêng (${page.url()}) nên không có popup để đóng`,
        );
        test.skip(
          true,
          "Login_Open_02: N/A - website mở trang đăng nhập riêng (đúng Note trong Excel)",
        );
      }

      const closer = () =>
        page
          .locator(
            '[aria-label*="óng" i], [aria-label*="close" i], button:has-text("×"), button:has-text("✕"), [class*="close" i]',
          )
          .filter({ visible: true })
          .first();

      // Bước 2: click [X]
      await expect(closer(), "Popup phải có nút đóng [X]").toBeVisible({
        timeout: 10000,
      });
      await closer().click();
      await expect(phoneInput(page), "Bấm [X] thì form phải đóng").toBeHidden({
        timeout: 10000,
      });
      await expectGuestHeader(page, "Sau khi đóng form:");
      await shot(page, "Open_02_sau_khi_dong_X");

      // Bước 3: mở lại, click vùng trống ngoài form
      await safeClick(page, loginHeaderBtn(page));
      await expect(phoneInput(page)).toBeVisible({ timeout: 15000 });
      await page.mouse.click(5, 300);
      await page.waitForTimeout(1500);
      const stillOpen = await phoneInput(page)
        .isVisible()
        .catch(() => false);
      note(
        "Open_02",
        "actual-behavior",
        `Click ngoài vùng form: form ${stillOpen ? "GIỮ NGUYÊN" : "ĐÃ ĐÓNG"} (cả hai đều chấp nhận theo thiết kế)`,
      );
      await shot(page, "Open_02_sau_khi_click_ngoai");
      await page.waitForTimeout(1500);
    });
  });
});

// ==============================================================================
// PHẦN 2: GIAO DIỆN VÀ HIỂN THỊ (DISPLAY - 3 TEST CASES)
// ==============================================================================
test.describe("PHẦN 2: GIAO DIỆN VÀ HIỂN THỊ (DISPLAY)", () => {
  test("Login_Display_01: Kiểm tra bố cục, vị trí và kích thước của form đăng nhập theo thiết kế", async ({
    browser,
  }) => {
    await withPage(browser, "guest", async (page) => {
      const { dedicated } = await openLoginForm(page);

      const input = phoneInput(page);
      const form = page.locator("form").filter({ has: input }).first();
      const container =
        (await form.count()) > 0
          ? form
          : input.locator("xpath=ancestor::div[3]");
      await expect(
        container,
        "Phải xác định được khối form đăng nhập",
      ).toBeVisible();

      const vp = page.viewportSize()!;
      const box = (await container.boundingBox())!;
      console.log(
        `[Display_01] Khối form: x=${box.x} y=${box.y} w=${box.width} h=${box.height} | viewport ${vp.width}x${vp.height}`,
      );

      // Không tràn khỏi màn hình, không có cuộn ngang
      expect(
        box.x,
        "Form không được lệch ra ngoài mép trái",
      ).toBeGreaterThanOrEqual(0);
      expect(
        box.x + box.width,
        "Form không được tràn ra ngoài mép phải",
      ).toBeLessThanOrEqual(vp.width + 1);
      const hScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hScroll, "Không được có cuộn ngang").toBe(false);

      // Căn giữa theo chiều ngang (chỉ đánh giá mềm vì cần mockup để đối chiếu)
      const centerDiff = Math.abs(box.x + box.width / 2 - vp.width / 2);
      if (!dedicated || centerDiff > 120) {
        note(
          "Display_01",
          "ux-note",
          `Form lệch tâm ngang ${Math.round(centerDiff)}px so với màn hình (đối chiếu mockup bằng ảnh đính kèm).`,
        );
      }

      // Các thành phần bên trong không chồng lấn, không tràn khỏi khung
      const issues = await container.evaluate((root) => {
        const visible = (e: Element) => {
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return (
            r.width > 0 &&
            r.height > 0 &&
            cs.display !== "none" &&
            cs.visibility !== "hidden"
          );
        };
        const hasOwnText = (e: Element) =>
          Array.from(e.childNodes).some(
            (n) => n.nodeType === 3 && (n.textContent || "").trim() !== "",
          );
        const parts = Array.from(
          root.querySelectorAll(
            "input, button, a, label, h1, h2, h3, p, span, img, svg",
          ),
        ).filter(
          (e) =>
            visible(e) &&
            (hasOwnText(e) || e.matches("input, button, img, svg")),
        );
        const rr = root.getBoundingClientRect();
        const overlaps: string[] = [];
        const overflow: string[] = [];
        for (let i = 0; i < parts.length; i++) {
          const ra = parts[i].getBoundingClientRect();
          if (ra.left < rr.left - 1 || ra.right > rr.right + 1) {
            overflow.push(
              (parts[i].textContent || parts[i].tagName).trim().slice(0, 30),
            );
          }
          for (let j = i + 1; j < parts.length; j++) {
            const a = parts[i],
              b = parts[j];
            if (a.contains(b) || b.contains(a)) continue;
            const rb = b.getBoundingClientRect();
            const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
            const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
            if (w > 2 && h > 2) {
              overlaps.push(
                `"${(a.textContent || a.tagName).trim().slice(0, 20)}" đè "${(b.textContent || b.tagName).trim().slice(0, 20)}"`,
              );
            }
          }
        }
        return { overlaps, overflow };
      });
      expect
        .soft(issues.overlaps, "Các thành phần trong form bị chồng lấn")
        .toEqual([]);
      expect
        .soft(issues.overflow, "Có thành phần tràn khỏi khung form")
        .toEqual([]);

      // Tiếng Việt có dấu hiển thị đúng (không lỗi font / mã hóa)
      const text = ((await container.innerText()) || "").trim();
      await attachText("Display_01_noi_dung_form", text);
      expect.soft(text, "Tiếng Việt bị lỗi mã hóa").not.toMatch(/�|Ã.|Ä.|áº/);
      const pageText =
        (await page.evaluate(() => document.body.innerText).catch(() => "")) ||
        "";
      expect
        .soft(pageText, 'Trang đăng nhập phải có chữ "Đăng nhập" đúng dấu')
        .toMatch(/Đăng nhập/i);

      // Font / màu: đối chiếu bằng mắt với mockup qua ảnh đính kèm
      const fontInfo = await submitBtn(page).evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          font: cs.fontFamily,
          size: cs.fontSize,
          color: cs.color,
          bg: cs.backgroundColor,
        };
      });
      console.log("[Display_01] Nút gửi:", fontInfo);
      await shot(page, "Display_01_toan_trang");
      await page.waitForTimeout(3000);
    });
  });

  test("Login_Display_02: Kiểm tra hiển thị đầy đủ các thành phần trên form đăng nhập", async ({
    browser,
  }) => {
    await withPage(browser, "guest", async (page) => {
      await openLoginForm(page);

      // Thành phần BẮT BUỘC (cứng)
      await expect(phoneInput(page), "Thiếu ô nhập SĐT").toBeVisible();
      await expect(
        submitBtn(page),
        "Thiếu nút gửi (TIẾP TỤC / ĐĂNG NHẬP)",
      ).toBeVisible();
      expect(
        await phoneInput(page).count(),
        "Không được trùng lặp ô SĐT",
      ).toBeGreaterThan(0);
      const phoneBoxes = await page
        .locator('input[type="tel"]')
        .filter({ visible: true })
        .count();
      expect(phoneBoxes, "Không được có nhiều hơn 1 ô SĐT hiển thị").toBe(1);

      const placeholder =
        (await phoneInput(page).getAttribute("placeholder")) || "";
      console.log(`[Display_02] Placeholder ô SĐT: "${placeholder}"`);
      expect
        .soft(
          placeholder,
          "Placeholder ô SĐT phải có chữ tiếng Việt đúng chính tả",
        )
        .toMatch(/điện thoại|SĐT|số/i);

      // Thành phần theo Excel nhưng có thể KHÔNG có trên website thật -> ghi nhận thực tế
      const checks: [string, Locator][] = [
        ["ô mật khẩu", passwordInput(page)],
        [
          "liên kết [Quên mật khẩu]",
          page
            .getByText(/Quên mật khẩu/i)
            .filter({ visible: true })
            .first(),
        ],
        [
          "liên kết [Đăng ký]",
          page
            .getByText(/Đăng ký/i)
            .filter({ visible: true })
            .first(),
        ],
        [
          "đăng nhập bằng Facebook",
          page
            .getByText(/Facebook/i)
            .filter({ visible: true })
            .first(),
        ],
        [
          "đăng nhập bằng Google",
          page
            .getByText(/Google/i)
            .filter({ visible: true })
            .first(),
        ],
        [
          "dòng lưu ý gửi tin nhắn xác thực",
          page
            .getByText(/gửi tin nhắn xác thực/i)
            .filter({ visible: true })
            .first(),
        ],
      ];
      const report: string[] = [];
      for (const [name, loc] of checks) {
        const present = await loc.isVisible().catch(() => false);
        report.push(`${present ? "CÓ   " : "KHÔNG "} ${name}`);
      }
      console.log("[Display_02] Thành phần thực tế:\n" + report.join("\n"));
      await attachText("Display_02_thanh_phan_thuc_te", report.join("\n"));
      const missing = report.filter((r) => r.startsWith("KHÔNG"));
      if (missing.length > 0) {
        note(
          "Display_02",
          "actual-behavior",
          `Thành phần không có trên website thật: ${missing.map((m) => m.slice(6)).join(", ")}`,
        );
      }

      await shot(page, "Display_02_thanh_phan_form");
      await page.waitForTimeout(3000);
    });
  });

  test("Login_Display_04: Kiểm tra mật khẩu được che bằng dấu chấm và nút ẩn/hiện mật khẩu hoạt động đúng", async ({
    browser,
  }) => {
    await withPage(browser, "guest", async (page) => {
      await openLoginForm(page);

      if (!(await hasPassword(page))) {
        note(
          "Display_04",
          "actual-behavior",
          "Form đăng nhập KHÔNG có ô mật khẩu (xác thực bằng SĐT + OTP).",
        );
        await shot(page, "Display_04_khong_co_o_mat_khau");
        test.skip(
          true,
          "Login_Display_04: N/A - website không có ô mật khẩu (đăng nhập bằng OTP)",
        );
      }

      const pw = passwordInput(page);
      // Bước 3: nhập mật khẩu -> hiển thị dạng che
      await pw.fill("Mk@12345");
      expect(
        await pw.getAttribute("type"),
        "Mật khẩu phải được che (type=password)",
      ).toBe("password");

      // Bước 4-5: nút con mắt (nếu có)
      const eye = page
        .locator(
          '[class*="eye" i], [aria-label*="hiện" i], [aria-label*="show" i], button:has(svg), i[class*="eye" i]',
        )
        .filter({ visible: true })
        .first();
      if (await eye.isVisible().catch(() => false)) {
        await eye.click();
        expect(
          await page
            .locator('input[value="Mk@12345"]')
            .first()
            .getAttribute("type"),
          "Bấm con mắt thì mật khẩu phải hiện rõ",
        ).toBe("text");
        await eye.click();
        expect(
          await page
            .locator('input[value="Mk@12345"]')
            .first()
            .getAttribute("type"),
          "Bấm lần nữa thì mật khẩu phải được che lại",
        ).toBe("password");
      } else {
        note(
          "Display_04",
          "actual-behavior",
          "Không có nút ẩn/hiện mật khẩu -> chỉ kiểm tra bước 3 (đúng Note trong Excel).",
        );
      }
      await shot(page, "Display_04_mat_khau");
      await page.waitForTimeout(2000);
    });
  });
});

// ==============================================================================
// PHẦN 3: ĐĂNG NHẬP THÀNH CÔNG (VALID - 3 TEST CASES)
// ==============================================================================
test.describe("PHẦN 3: ĐĂNG NHẬP THÀNH CÔNG (VALID)", () => {
  test("Login_Valid_01: Kiểm tra đăng nhập thành công với SĐT hợp lệ", async ({
    browser,
  }) => {
    requirePhone();
    await withPage(browser, "trusted", async (page) => {
      await openLoginForm(page);
      const pw = await hasPassword(page);
      test.skip(
        pw && !TEST_PASSWORD,
        "Bỏ qua: form có ô mật khẩu nhưng chưa điền TEST_PASSWORD",
      );

      // Bước 3-4: dữ liệu nhập hiển thị đúng
      await phoneInput(page).fill(TEST_PHONE);
      await expect(
        phoneInput(page),
        "SĐT nhập vào phải hiển thị đúng",
      ).toHaveValue(TEST_PHONE);
      if (pw) await passwordInput(page).fill(TEST_PASSWORD);
      await shot(page, "Valid_01_truoc_khi_dang_nhap");

      // Bước 5: gửi
      const before = await bodyLines(page);
      const net = watchNetwork(page);
      await safeClick(page, submitBtn(page));
      const outcome = await waitLoginOutcome(page, before, 15000, net);
      console.log(
        `[Valid_01] Kết quả: ${outcome} | request: ${net.posts.length}`,
      );
      await attachText(
        "Valid_01_api",
        net.api.join("\n") || "(không có request API)",
      );
      expect(
        outcome,
        outcome === "otp"
          ? 'Web đòi OTP: thiết bị không còn "tin cậy" -> đăng nhập tay 1 lần và tạo lại auth/dmx_storageState.json'
          : "Đăng nhập phải thành công",
      ).toBe("logged-in");

      await expectLoggedInHeader(page, "Sau khi đăng nhập:");
      expect(net.serverErrors, "Không được có lỗi server 5xx").toEqual([]);
      await shot(page, "Valid_01_sau_khi_dang_nhap");
      await page.waitForTimeout(2000);
    });
  });

  test("Login_Valid_02: Kiểm tra đăng nhập thành công bằng phím Enter", async ({
    browser,
  }) => {
    requirePhone();
    await withPage(browser, "trusted", async (page) => {
      await openLoginForm(page);
      const pw = await hasPassword(page);
      test.skip(
        pw && !TEST_PASSWORD,
        "Bỏ qua: form có ô mật khẩu nhưng chưa điền TEST_PASSWORD",
      );

      const net = watchNetwork(page);
      const outcome = await doLogin(page, { submit: "enter" });
      console.log(`[Valid_02] Kết quả: ${outcome}`);
      expect(
        outcome,
        outcome === "otp"
          ? 'Web đòi OTP: thiết bị không còn "tin cậy" (tạo lại storageState)'
          : "Nhấn Enter phải đăng nhập thành công",
      ).toBe("logged-in");
      await expectLoggedInHeader(page, "Sau khi Enter:");

      // Không gửi trùng yêu cầu: không có request POST giống hệt nhau
      const dup = net.posts.filter((p, i) => net.posts.indexOf(p) !== i);
      console.log("[Valid_02] Request không phải GET:", net.posts);
      expect.soft(dup, "Nhấn Enter không được gửi trùng yêu cầu").toEqual([]);
      await shot(page, "Valid_02_sau_khi_enter");
      await page.waitForTimeout(2000);
    });
  });

  test("Login_Valid_03: Kiểm tra sau khi đăng nhập thành công, thông tin tài khoản hiển thị đúng", async ({
    browser,
  }) => {
    requirePhone();
    await withPage(browser, "logged-in", async (page) => {
      // Bước 1: đã đăng nhập (storageState)
      await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 45000 });
      await expectLoggedInHeader(page, "Pre-condition:");

      // Bước 2: click tên/biểu tượng tài khoản
      const acc = accountLink(page);
      await acc.hover().catch(() => {});
      await safeClick(page, acc);
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(2000);
      if (!/ca-nhan/i.test(page.url())) {
        await page.goto(`${HOME}/ca-nhan`, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
      }

      // Bước 3: họ tên, SĐT khớp tài khoản
      const body = page.locator("body");
      await expect(
        body,
        "Phải hiển thị SĐT của tài khoản đã đăng nhập",
      ).toContainText(TEST_PHONE, { timeout: 15000 });
      await expect
        .soft(body, "Phải hiển thị họ tên của tài khoản")
        .toContainText(new RegExp(esc(TEST_NAME), "i"));

      // Không hiển thị SĐT của người khác (quét các SĐT 10 số trong khối tài khoản)
      const text = (await body.innerText()) || "";
      const others = Array.from(
        new Set(text.match(/\b0\d{9}\b/g) || []),
      ).filter((n) => n !== TEST_PHONE);
      if (others.length > 0) {
        note(
          "Valid_03",
          "known-issue",
          `Trang có SĐT khác SĐT đăng nhập (có thể là hotline/footer, cần kiểm tra bằng mắt): ${others.join(", ")}`,
        );
      }
      await shot(page, "Valid_03_thong_tin_tai_khoan");
      await page.waitForTimeout(2000);
    });
  });
});

// ==============================================================================
// PHẦN 4: SĐT KHÔNG HỢP LỆ (PHONE - 3 TEST CASES)
// ==============================================================================
test.describe("PHẦN 4: SĐT KHÔNG HỢP LỆ (PHONE)", () => {
  /** Nhập SĐT sai bằng cách gõ từng phím, bấm gửi, kiểm tra bị từ chối + có phản hồi cho người dùng. */
  async function runInvalidPhone(page: Page, tag: string, rawPhone: string) {
    await openLoginForm(page);
    const input = phoneInput(page);
    await input.click();
    await input.pressSequentially(rawPhone, { delay: 30 });
    const actual = await input.inputValue();
    console.log(`[${tag}] Nhập "${rawPhone}" -> ô SĐT hiển thị "${actual}"`);
    if (actual !== rawPhone) {
      note(
        tag,
        "actual-behavior",
        `Ô SĐT tự lọc ký tự: nhập "${rawPhone}" chỉ còn "${actual}" (đúng Excel: "ô SĐT chỉ nhận số")`,
      );
    }
    if (await hasPassword(page))
      await passwordInput(page).fill(TEST_PASSWORD || "Mk@12345");

    const before = await bodyLines(page);
    const net = watchNetwork(page);
    const btn = submitBtn(page);
    if (await btn.isEnabled().catch(() => true))
      await btn.click({ timeout: 5000 }).catch(() => {});
    const feedback = await collectFeedback(page, before);
    console.log(
      `[${tag}] Phản hồi cho người dùng: ${feedback || "(không có)"}`,
    );
    await shot(page, `${tag}_sau_khi_gui`);

    // Đăng nhập không thành công, không chuyển sang bước OTP, không lỗi hệ thống
    expect(
      await otpPrompt(page)
        .isVisible()
        .catch(() => false),
      "SĐT sai không được chuyển sang bước nhập OTP",
    ).toBe(false);
    await expect(
      loginHeaderBtn(page).or(phoneInput(page)).first(),
      "Không được đăng nhập thành công",
    ).toBeVisible();
    expect(
      await accountLink(page)
        .isVisible()
        .catch(() => false),
      "Không được hiển thị trạng thái đã đăng nhập",
    ).toBe(false);
    expect(net.serverErrors, "Không được có lỗi hệ thống 5xx").toEqual([]);
    expect(
      feedback,
      "Phải có thông báo lỗi định dạng SĐT cho người dùng",
    ).not.toBe("");
    await page.waitForTimeout(2000);
  }

  test("Login_Phone_01: Kiểm tra báo lỗi khi nhập SĐT sai định dạng (chứa chữ cái)", async ({
    browser,
  }) => {
    await withPage(browser, "guest", (page) =>
      runInvalidPhone(page, "Phone_01", "abc123xyz"),
    );
  });

  test("Login_Phone_02: Kiểm tra báo lỗi khi nhập SĐT thiếu số (ít hơn 10 số)", async ({
    browser,
  }) => {
    await withPage(browser, "guest", (page) =>
      runInvalidPhone(page, "Phone_02", "090123"),
    );
  });

  test("Login_Phone_05: Kiểm tra đăng nhập với SĐT hợp lệ về định dạng nhưng chưa đăng ký tài khoản", async ({
    browser,
  }) => {
    test.skip(
      !/^0\d{9}$/.test(UNREGISTERED_PHONE),
      "Login_Phone_05: Skipped - chưa cấu hình DMX_UNREGISTERED_PHONE (SĐT hợp lệ chưa đăng ký). Không tự bịa số để tránh gửi SMS tới người lạ.",
    );
    test.skip(
      !ALLOW_OTP,
      "Login_Phone_05: Skipped - bước này có thể gửi SMS thật, cần ALLOW_SEND_OTP=1",
    );
    await withPage(browser, "guest", async (page) => {
      await openLoginForm(page);
      const net = watchNetwork(page);
      const outcome = await doLogin(page, {
        phone: UNREGISTERED_PHONE,
        password: "Bat@Ky123",
      });
      console.log(`[Phone_05] Kết quả: ${outcome}`);
      await shot(page, "Phone_05_sau_khi_gui");

      expect(
        outcome,
        "SĐT chưa đăng ký không được đăng nhập thành công",
      ).not.toBe("logged-in");
      expect(net.serverErrors, "Không được lỗi server 5xx").toEqual([]);
      if (outcome === "otp") {
        note(
          "Phone_05",
          "actual-behavior",
          "Website coi SĐT mới là đăng ký/đăng nhập bằng OTP (gửi OTP thay vì báo tài khoản không tồn tại).",
        );
      } else {
        const line = await newErrorLine(page, []);
        expect
          .soft(
            line,
            "Phải có thông báo chung chung (không lộ chi tiết nhạy cảm)",
          )
          .toBeTruthy();
        expect
          .soft(line || "", "Thông báo không nên nêu rõ SĐT chưa đăng ký")
          .not.toMatch(/chưa (được )?đăng ký|không tồn tại số/i);
      }
      await page.waitForTimeout(2000);
    });
  });
});

// ==============================================================================
// PHẦN 5: MẬT KHẨU (PASS - 2 TEST CASES)
// ==============================================================================
test.describe("PHẦN 5: MẬT KHẨU / MÃ XÁC THỰC SAI (PASS)", () => {
  test("Login_Pass_01: Kiểm tra đăng nhập với SĐT đúng nhưng mật khẩu (mã xác thực) sai", async ({
    browser,
  }) => {
    requirePhone();
    // Dùng thiết bị "guest" để chắc chắn web đòi bước xác thực thứ hai
    await withPage(browser, "guest", async (page) => {
      await openLoginForm(page);
      const pw = await hasPassword(page);
      if (!pw) {
        test.skip(
          !ALLOW_OTP,
          "Login_Pass_01: Skipped - web không có ô mật khẩu; bản tương đương (OTP sai) sẽ gửi 1 SMS thật, cần ALLOW_SEND_OTP=1",
        );
        note(
          "Pass_01",
          "actual-behavior",
          'Web không có ô mật khẩu -> kiểm tra phiên bản tương đương: nhập OTP sai "000000".',
        );
      }

      const net = watchNetwork(page);
      await phoneInput(page).fill(TEST_PHONE);
      if (pw) await passwordInput(page).fill("Sai@12345");
      let before = await bodyLines(page);
      await safeClick(page, submitBtn(page));

      if (!pw) {
        await expect(
          otpPrompt(page),
          "Phải chuyển sang bước nhập OTP",
        ).toBeVisible({ timeout: 20000 });
        // Giữ lại SĐT đã nhập: hiển thị ở màn OTP
        await expect
          .soft(page.locator("body"), "Màn OTP nên hiển thị lại SĐT đã nhập")
          .toContainText(TEST_PHONE.slice(-4));
        before = await bodyLines(page);
        const ok = await fillOtp(page, "000000");
        expect(
          ok,
          "Không tìm thấy ô nhập OTP (cần chỉnh selector trong fillOtp)",
        ).toBe(true);
      }

      const feedback = await collectFeedback(page, before, 8000);
      console.log(`[Pass_01] Phản hồi: ${feedback || "(không có)"}`);
      await shot(page, "Pass_01_sau_khi_gui");

      expect(
        await accountLink(page)
          .isVisible()
          .catch(() => false),
        "Sai thông tin xác thực thì không được đăng nhập",
      ).toBe(false);
      expect(feedback, "Phải có thông báo sai thông tin xác thực").not.toBe("");
      expect(net.serverErrors).toEqual([]);
      await page.waitForTimeout(2000);
    });
  });

  test("Login_Pass_02: Kiểm tra mật khẩu phân biệt chữ hoa/chữ thường", async ({
    browser,
  }) => {
    requirePhone();
    await withPage(browser, "guest", async (page) => {
      await openLoginForm(page);
      if (!(await hasPassword(page))) {
        note(
          "Pass_02",
          "actual-behavior",
          "Web không có ô mật khẩu (xác thực bằng OTP chỉ gồm chữ số) nên không có khái niệm hoa/thường.",
        );
        test.skip(
          true,
          "Login_Pass_02: N/A - website không có mật khẩu (đăng nhập bằng OTP)",
        );
      }
      test.skip(!TEST_PASSWORD, "Bỏ qua: chưa điền TEST_PASSWORD");
      expect(
        TEST_PASSWORD.toUpperCase(),
        "TEST_PASSWORD phải có chữ thường để đổi hoa/thường",
      ).not.toBe(TEST_PASSWORD);

      const outcome = await doLogin(page, {
        password: TEST_PASSWORD.toUpperCase(),
      });
      console.log(`[Pass_02] Kết quả: ${outcome}`);
      await shot(page, "Pass_02_mat_khau_viet_hoa");
      expect(
        outcome,
        "Mật khẩu sai hoa/thường thì không được đăng nhập",
      ).not.toBe("logged-in");
      expect(
        await accountLink(page)
          .isVisible()
          .catch(() => false),
      ).toBe(false);
    });
  });
});

// ==============================================================================
// PHẦN 6: BỎ TRỐNG (EMPTY - 3 TEST CASES)
// ==============================================================================
test.describe("PHẦN 6: BỎ TRỐNG THÔNG TIN (EMPTY)", () => {
  test("Login_Empty_01: Kiểm tra đăng nhập khi bỏ trống cả SĐT và mật khẩu", async ({
    browser,
  }) => {
    await withPage(browser, "guest", async (page) => {
      await openLoginForm(page);
      await expect(phoneInput(page), "Bước 3: ô SĐT phải trống").toHaveValue(
        "",
      );

      const before = await bodyLines(page);
      const net = watchNetwork(page);
      const btn = submitBtn(page);
      const wasDisabled = await btn.isDisabled().catch(() => false);
      if (!wasDisabled) await btn.click();
      const feedback = await collectFeedback(page, before);
      console.log(`[Empty_01] Phản hồi: ${feedback || "(không có)"}`);
      await shot(page, "Empty_01_sau_khi_gui");

      expect(
        await otpPrompt(page)
          .isVisible()
          .catch(() => false),
        "Bỏ trống thì không được chuyển sang bước OTP",
      ).toBe(false);
      expect(
        await accountLink(page)
          .isVisible()
          .catch(() => false),
        "Không được đăng nhập",
      ).toBe(false);
      expect(
        feedback,
        "Phải có thông báo yêu cầu nhập SĐT (hoặc nút bị vô hiệu hóa)",
      ).not.toBe("");
      const sent = net.posts.filter((p) =>
        /login|dang-nhap|otp|auth|verify/i.test(p),
      );
      expect
        .soft(sent, "Bỏ trống thì không được gửi yêu cầu đăng nhập lên server")
        .toEqual([]);
      await page.waitForTimeout(2000);
    });
  });

  test("Login_Empty_02: Kiểm tra đăng nhập khi bỏ trống SĐT, chỉ nhập mật khẩu", async ({
    browser,
  }) => {
    await withPage(browser, "guest", async (page) => {
      await openLoginForm(page);
      if (!(await hasPassword(page))) {
        note(
          "Empty_02",
          "actual-behavior",
          'Web không có ô mật khẩu -> không thể "chỉ nhập mật khẩu"; trường hợp bỏ trống SĐT đã kiểm tra ở Login_Empty_01.',
        );
        test.skip(true, "Login_Empty_02: N/A - website không có ô mật khẩu");
      }
      await passwordInput(page).fill(TEST_PASSWORD || "Mk@12345");
      const before = await bodyLines(page);
      const btn = submitBtn(page);
      if (!(await btn.isDisabled().catch(() => false))) await btn.click();
      const feedback = await collectFeedback(page, before);
      await shot(page, "Empty_02_sau_khi_gui");
      expect(
        await accountLink(page)
          .isVisible()
          .catch(() => false),
        "Không được đăng nhập",
      ).toBe(false);
      expect(feedback, "Phải báo lỗi yêu cầu nhập SĐT").not.toBe("");
    });
  });

  test("Login_Empty_03: Kiểm tra đăng nhập khi bỏ trống mật khẩu, chỉ nhập SĐT", async ({
    browser,
  }) => {
    requirePhone();
    await withPage(browser, "guest", async (page) => {
      await openLoginForm(page);
      if (!(await hasPassword(page))) {
        note(
          "Empty_03",
          "actual-behavior",
          "Web không có ô mật khẩu: chỉ nhập SĐT là luồng đăng nhập bình thường (gửi OTP), không phải lỗi.",
        );
        test.skip(true, "Login_Empty_03: N/A - website không có ô mật khẩu");
      }
      await phoneInput(page).fill(TEST_PHONE);
      const before = await bodyLines(page);
      await safeClick(page, submitBtn(page));
      const feedback = await collectFeedback(page, before);
      await shot(page, "Empty_03_sau_khi_gui");
      expect(
        await accountLink(page)
          .isVisible()
          .catch(() => false),
        "Không được đăng nhập",
      ).toBe(false);
      expect(feedback, "Phải báo lỗi yêu cầu nhập mật khẩu").not.toBe("");
    });
  });
});

// ==============================================================================
// PHẦN 7: BẢO MẬT (SECURITY - 2 TEST CASES)
// ==============================================================================
test.describe("PHẦN 7: BẢO MẬT (SECURITY)", () => {
  test("Login_Security_01: Kiểm tra chống SQL Injection ở ô SĐT/mật khẩu", async ({
    browser,
  }) => {
    await withPage(browser, "guest", async (page) => {
      const SQLI = "' OR '1'='1";
      let dialogFired = "";
      page.on("dialog", async (d) => {
        dialogFired = d.message();
        await d.dismiss().catch(() => {});
      });

      await openLoginForm(page);
      const net = watchNetwork(page);

      const input = phoneInput(page);
      await input.click();
      await input.pressSequentially(SQLI, { delay: 20 });
      const actual = await input.inputValue();
      console.log(`[Security_01] Ô SĐT hiển thị: "${actual}"`);
      if (actual !== SQLI)
        note(
          "Security_01",
          "actual-behavior",
          `Ô SĐT lọc ký tự đặc biệt: "${SQLI}" -> "${actual}"`,
        );
      if (await hasPassword(page)) await passwordInput(page).fill(SQLI);

      const before = await bodyLines(page);
      const btn = submitBtn(page);
      if (!(await btn.isDisabled().catch(() => false)))
        await btn.click({ timeout: 5000 }).catch(() => {});
      const feedback = await collectFeedback(page, before);
      await page.waitForTimeout(1500);
      await shot(page, "Security_01_sau_khi_gui");

      // Không đăng nhập được, không sang bước OTP
      expect(
        await accountLink(page)
          .isVisible()
          .catch(() => false),
        "SQLi không được đăng nhập thành công",
      ).toBe(false);
      expect(
        await otpPrompt(page)
          .isVisible()
          .catch(() => false),
        "Chuỗi SQLi không được chuyển sang bước OTP",
      ).toBe(false);

      // Không lộ lỗi CSDL / stack trace; không lỗi 5xx; không chạy script
      const text =
        (await page.evaluate(() => document.body.innerText).catch(() => "")) ||
        "";
      expect(text, "Trang không được lộ lỗi CSDL / stack trace").not.toMatch(
        LEAK_RE,
      );
      expect(
        net.bodies.join("\n"),
        "Phản hồi API không được lộ lỗi CSDL / stack trace",
      ).not.toMatch(LEAK_RE);
      expect(net.serverErrors, "Server không được trả lỗi 5xx").toEqual([]);
      expect(dialogFired, "Không được bật hộp thoại bất thường").toBe("");
      console.log(`[Security_01] Phản hồi: ${feedback || "(không có)"}`);
      await page.waitForTimeout(2000);
    });
  });

  test("Login_Security_04: Kiểm tra khóa tạm thời/cảnh báo khi nhập sai nhiều lần liên tiếp", async ({
    browser,
  }) => {
    requirePhone();
    const ATTEMPTS = 5;
    await withPage(browser, "guest", async (page) => {
      await openLoginForm(page);
      const pw = await hasPassword(page);
      if (!pw) {
        test.skip(
          !ALLOW_OTP,
          "Login_Security_04: Skipped - web không có ô mật khẩu; bản tương đương (OTP sai nhiều lần) cần gửi SMS thật, đặt ALLOW_SEND_OTP=1",
        );
        note(
          "Security_04",
          "actual-behavior",
          "Web không có ô mật khẩu -> kiểm tra phiên bản tương đương: nhập OTP sai nhiều lần liên tiếp.",
        );
      }

      const log: string[] = [];
      let lockSeen = "";
      const LOCK_RE =
        /khóa|quá nhiều|tạm thời|captcha|giới hạn|thử lại sau|robot/i;

      await phoneInput(page).fill(TEST_PHONE);
      if (!pw) {
        await safeClick(page, submitBtn(page));
        await expect(
          otpPrompt(page),
          "Phải chuyển sang bước nhập OTP",
        ).toBeVisible({ timeout: 20000 });
      }

      for (let i = 1; i <= ATTEMPTS && !lockSeen; i++) {
        const before = await bodyLines(page);
        if (pw) {
          await passwordInput(page).fill(`Sai@${i}2345`);
          await safeClick(page, submitBtn(page));
        } else {
          const ok = await fillOtp(page, "000000");
          expect(
            ok,
            "Không tìm thấy ô nhập OTP (cần chỉnh selector trong fillOtp)",
          ).toBe(true);
        }
        const fb = await collectFeedback(page, before, 5000);
        log.push(`Lần ${i}: ${fb || "(không có phản hồi)"}`);
        console.log(`[Security_04] ${log[log.length - 1]}`);
        const now = (await bodyLines(page)).join(" ");
        if (LOCK_RE.test(fb) || LOCK_RE.test(now))
          lockSeen = `Lần ${i}: ${fb || "có cảnh báo khóa/captcha"}`;
        await shot(page, `Security_04_lan_${i}`);
        await page.waitForTimeout(800);
      }

      await attachText("Security_04_nhat_ky", log.join("\n"));
      expect(
        await accountLink(page)
          .isVisible()
          .catch(() => false),
        "Nhập sai nhiều lần không được đăng nhập",
      ).toBe(false);
      if (lockSeen) {
        note(
          "Security_04",
          "actual-behavior",
          `Hệ thống có cảnh báo/khóa/captcha: ${lockSeen}`,
        );
      } else {
        note(
          "Security_04",
          "known-issue",
          `Sau ${ATTEMPTS} lần sai liên tiếp web KHÔNG hiển thị cảnh báo/khóa/captcha nào (ghi nhận số lần thực tế).`,
        );
      }
      expect
        .soft(
          lockSeen,
          `Sau ${ATTEMPTS} lần sai phải có cảnh báo / captcha / khóa tạm thời theo chính sách bảo mật`,
        )
        .not.toBe("");
      await page.waitForTimeout(2000);
    });
  });
});

// ==============================================================================
// PHẦN 8: PHIÊN ĐĂNG NHẬP & ĐĂNG XUẤT (SESSION / LOGOUT - 2 TEST CASES)
// ==============================================================================
test.describe("PHẦN 8: PHIÊN ĐĂNG NHẬP & ĐĂNG XUẤT (SESSION / LOGOUT)", () => {
  test("Login_Session_01: Kiểm tra giữ trạng thái đăng nhập sau khi tải lại trang (F5)", async ({
    browser,
  }) => {
    await withPage(browser, "logged-in", async (page) => {
      // Pre-condition
      await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 45000 });
      await expectLoggedInHeader(page, "Pre-condition:");

      // Bước 1: F5
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await expectLoggedInHeader(page, "Sau F5:");
      await shot(page, "Session_01_sau_F5");

      // Bước 2: sang trang danh mục rồi Back
      await page.goto(`${HOME}/tivi`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await expectLoggedInHeader(page, "Ở trang danh mục:");
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
      await expectLoggedInHeader(page, "Sau Back:");

      if (HAS_PHONE) {
        const headerText =
          (await page
            .locator("header, #header")
            .first()
            .innerText()
            .catch(() => "")) || "";
        console.log(
          `[Session_01] Header: ${headerText.replace(/\s+/g, " ").slice(0, 150)}`,
        );
      }
      await shot(page, "Session_01_sau_Back");
      await page.waitForTimeout(2000);
    });
  });

  test("Login_Logout_01: Kiểm tra đăng xuất thành công", async ({
    browser,
  }) => {
    await withPage(browser, "logged-in", async (page, ctx) => {
      await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 45000 });
      await expectLoggedInHeader(page, "Pre-condition:");
      await shot(page, "Logout_01_truoc_khi_dang_xuat");

      // Bước 1-2: mở menu tài khoản, bấm [Đăng xuất]
      await logout(page);

      // Header hiển thị lại nút [Đăng nhập]
      await expectGuestHeader(page, "Sau khi đăng xuất:");
      await shot(page, "Logout_01_sau_khi_dang_xuat");

      // Không còn thông tin cá nhân
      if (HAS_PHONE) {
        const text =
          (await page
            .evaluate(() => document.body.innerText)
            .catch(() => "")) || "";
        expect(
          text,
          "Sau đăng xuất không được còn SĐT tài khoản",
        ).not.toContain(TEST_PHONE);
      }
      const leftover = (await ctx.cookies()).filter(
        (c) => AUTH_COOKIE.test(c.name) && c.value,
      );
      if (leftover.length > 0) {
        note(
          "Logout_01",
          "ux-note",
          `Sau đăng xuất vẫn còn cookie xác thực: ${leftover.map((c) => c.name).join(", ")} (cần kiểm tra token đã bị vô hiệu hóa ở server chưa).`,
        );
      }

      // Vào lại trang cá nhân -> phải ở trạng thái khách
      await page.goto(`${HOME}/ca-nhan`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await page.waitForTimeout(1500);
      await expectGuestHeader(page, "Vào lại /ca-nhan:");
      await page.waitForTimeout(2000);
    });
  });
});

// ==============================================================================
// PHẦN 9: QUÊN MẬT KHẨU & BÀN PHÍM (FORGOT / KEYBOARD - 2 TEST CASES)
// ==============================================================================
test.describe("PHẦN 9: QUÊN MẬT KHẨU & BÀN PHÍM (FORGOT / KEYBOARD)", () => {
  test("Login_Forgot_01: Kiểm tra liên kết [Quên mật khẩu] điều hướng đúng", async ({
    browser,
  }) => {
    await withPage(browser, "guest", async (page) => {
      await openLoginForm(page);
      const link = page
        .getByText(/Quên mật khẩu/i)
        .filter({ visible: true })
        .first();
      if (!(await link.isVisible({ timeout: 3000 }).catch(() => false))) {
        note(
          "Forgot_01",
          "actual-behavior",
          "Form đăng nhập KHÔNG có liên kết [Quên mật khẩu] (xác thực bằng OTP, không dùng mật khẩu).",
        );
        await shot(page, "Forgot_01_khong_co_lien_ket");
        test.skip(
          true,
          "Login_Forgot_01: N/A - website không có liên kết [Quên mật khẩu]",
        );
      }
      await link.click();
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(1500);
      await expect(page).not.toHaveTitle(/404|500|Not Found|Error|Lỗi/i);
      await expect(page.locator("body")).not.toContainText(
        /404|Không tìm thấy trang|Internal Server Error/i,
      );
      await expect(
        page
          .getByText(/khôi phục|lấy lại|đặt lại|quên mật khẩu/i)
          .filter({ visible: true })
          .first(),
        "Phải mở đúng form khôi phục mật khẩu",
      ).toBeVisible({ timeout: 15000 });
      await shot(page, "Forgot_01_form_khoi_phuc");
    });
  });

  test("Login_Keyboard_01: Kiểm tra thao tác form đăng nhập bằng bàn phím (Tab, Shift+Tab, Enter)", async ({
    browser,
  }) => {
    // Dùng thiết bị tin cậy (nếu có) để bước 5 (Enter) đăng nhập được không cần OTP
    const kind: Kind = HAS_AUTH && HAS_PHONE ? "trusted" : "guest";
    await withPage(browser, kind, async (page) => {
      await openLoginForm(page);

      const describeFocus = () =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return null;
          const cs = getComputedStyle(el);
          const outline =
            cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
          const shadow = cs.boxShadow && cs.boxShadow !== "none";
          return {
            tag: el.tagName,
            type: (el as HTMLInputElement).type || "",
            text: (el.innerText || (el as HTMLInputElement).placeholder || "")
              .trim()
              .slice(0, 30),
            visibleFocus: outline || !!shadow || cs.borderColor !== "",
            outline,
            shadow: !!shadow,
          };
        });

      // Bước 3: focus ô SĐT rồi Tab qua các phần tử
      await phoneInput(page).focus();
      const first = await describeFocus();
      expect(first?.tag, "Ô SĐT phải nhận focus").toBe("INPUT");
      if (!(first?.outline || first?.shadow)) {
        note(
          "Keyboard_01",
          "ux-note",
          "Ô SĐT khi focus không có viền outline/box-shadow rõ ràng (cần xem ảnh đính kèm).",
        );
      }
      await shot(page, "Keyboard_01_focus_o_SDT");

      const trail: string[] = [`${first?.tag}:${first?.type}`];
      let reachedSubmit = false;
      for (let i = 0; i < 5 && !reachedSubmit; i++) {
        await page.keyboard.press("Tab");
        const f = await describeFocus();
        trail.push(`${f?.tag}:${f?.type}:${f?.text}`);
        reachedSubmit = !!f && /TIẾP TỤC|ĐĂNG NHẬP/i.test(f.text);
      }
      console.log("[Keyboard_01] Thứ tự focus (Tab):", trail.join(" -> "));
      await attachText("Keyboard_01_thu_tu_focus", trail.join("\n"));
      expect
        .soft(
          reachedSubmit,
          "Phải Tab tới nút gửi trong vài lần bấm (thứ tự focus hợp lý)",
        )
        .toBe(true);
      await shot(page, "Keyboard_01_focus_nut_gui");

      // Bước 4: Shift+Tab quay lại
      for (let i = 0; i < trail.length - 1; i++)
        await page.keyboard.press("Shift+Tab");
      const back = await describeFocus();
      expect
        .soft(back?.tag, "Shift+Tab phải quay lại đúng ô SĐT")
        .toBe("INPUT");

      // Bước 5: nhập hợp lệ + Enter
      if (kind === "guest") {
        note(
          "Keyboard_01",
          "actual-behavior",
          "Chưa có storageState/SĐT hợp lệ nên bỏ qua bước 5 (đăng nhập bằng Enter).",
        );
        return;
      }
      const pw = await hasPassword(page);
      if (pw && !TEST_PASSWORD) {
        note(
          "Keyboard_01",
          "actual-behavior",
          "Form có ô mật khẩu nhưng chưa điền TEST_PASSWORD nên bỏ qua bước 5.",
        );
        return;
      }
      const outcome = await doLogin(page, { submit: "enter" });
      console.log(`[Keyboard_01] Bước 5: ${outcome}`);
      expect(
        outcome,
        outcome === "otp"
          ? "Web đòi OTP: tạo lại storageState"
          : "Nhấn Enter phải đăng nhập thành công",
      ).toBe("logged-in");
      await shot(page, "Keyboard_01_sau_enter");
      await page.waitForTimeout(2000);
    });
  });
});

// ==============================================================================
// PHẦN 10: THIẾT BỊ, TRÌNH DUYỆT, HIỆU NĂNG (DEVICE / BROWSER / PERF - 3 TEST CASES)
// (Device_01 và Browser_01 cũng được playwright.config chạy trên Firefox & WebKit)
// ==============================================================================
test.describe("PHẦN 10: THIẾT BỊ, TRÌNH DUYỆT, HIỆU NĂNG (DEVICE / BROWSER / PERF)", () => {
  test("Login_Device_01: Kiểm tra bố cục và khả năng sử dụng form đăng nhập trên máy tính, máy tính bảng và điện thoại", async ({
    browser,
  }) => {
    const sizes = [
      { name: "Máy tính 1920x1080", width: 1920, height: 1080 },
      { name: "Máy tính bảng 768x1024", width: 768, height: 1024 },
      { name: "Điện thoại 390x844", width: 390, height: 844 },
    ];
    const summary: string[] = [];

    for (const s of sizes) {
      await withPage(
        browser,
        "guest",
        async (page) => {
          const { usedFallback } = await openLoginForm(page, false);
          if (usedFallback) {
            note(
              "Device_01",
              "actual-behavior",
              `${s.name}: không thấy nút [Đăng nhập] trên header, mở trang đăng nhập trực tiếp.`,
            );
          }

          const input = phoneInput(page);
          const btn = submitBtn(page);
          await expect(input, `${s.name}: phải thấy ô SĐT`).toBeVisible();
          await expect(btn, `${s.name}: phải thấy nút gửi`).toBeVisible();

          const m = await page.evaluate(() => ({
            hScroll:
              document.documentElement.scrollWidth > window.innerWidth + 1,
            vw: window.innerWidth,
          }));
          const ib = (await input.boundingBox())!;
          const bb = (await btn.boundingBox())!;
          console.log(
            `[Device_01] ${s.name}: ô SĐT ${Math.round(ib.width)}x${Math.round(ib.height)} | nút ${Math.round(bb.width)}x${Math.round(bb.height)} | cuộn ngang=${m.hScroll}`,
          );
          summary.push(
            `${s.name}: input ${Math.round(ib.width)}x${Math.round(ib.height)}, nút ${Math.round(bb.width)}x${Math.round(bb.height)}, cuộn ngang=${m.hScroll}`,
          );

          if (m.hScroll) {
            const culprits = await page.evaluate(() => {
              const vw = window.innerWidth;
              return Array.from(document.querySelectorAll("body *"))
                .filter((e) => e.getBoundingClientRect().right > vw + 1)
                .slice(0, 8)
                .map((e) =>
                  `${e.tagName}.${String((e as HTMLElement).className)}`.slice(
                    0,
                    80,
                  ),
                );
            });
            console.log(`[Device_01] ${s.name} phần tử tràn:`, culprits);
            note(
              "Device_01",
              "known-issue",
              `${s.name}: trang bị cuộn ngang (phần tử tràn: ${culprits.join(" | ")})`,
            );
          }
          expect
            .soft(m.hScroll, `${s.name}: không được cuộn ngang`)
            .toBe(false);
          expect
            .soft(
              ib.x,
              `${s.name}: ô SĐT không được lệch ngoài màn hình (trái)`,
            )
            .toBeGreaterThanOrEqual(0);
          expect
            .soft(
              ib.x + ib.width,
              `${s.name}: ô SĐT không được tràn ngoài màn hình (phải)`,
            )
            .toBeLessThanOrEqual(m.vw + 1);
          expect
            .soft(
              bb.x + bb.width,
              `${s.name}: nút gửi không được tràn ngoài màn hình`,
            )
            .toBeLessThanOrEqual(m.vw + 1);
          if (s.width <= 480) {
            // Điện thoại: nút đủ lớn để bấm (khuyến nghị >= 40px)
            expect
              .soft(
                bb.height,
                `${s.name}: nút gửi phải đủ lớn để bấm (>= 40px)`,
              )
              .toBeGreaterThanOrEqual(40);
            // Ô nhập phải nằm trong vùng nhìn thấy (bàn phím ảo giả lập: chiếm ~ nửa dưới màn hình)
            expect
              .soft(
                ib.y + ib.height,
                `${s.name}: ô SĐT nên nằm ở nửa trên màn hình để không bị bàn phím ảo che`,
              )
              .toBeLessThanOrEqual(s.height * 0.6);
          }

          // Dùng được: nhập được SĐT
          await input.fill("0901234567");
          await expect(input).toHaveValue("0901234567");
          await shot(page, `Device_01_${s.width}x${s.height}`);
          await page.waitForTimeout(1500);
        },
        {
          viewport: { width: s.width, height: s.height },
          ...(s.width <= 480 ? { isMobile: true, hasTouch: true } : {}),
        },
      );
    }
    await attachText("Device_01_tong_ket", summary.join("\n"));
  });

  test("Login_Browser_01: Kiểm tra đăng nhập tương thích trên các trình duyệt được hỗ trợ", async ({
    browser,
    browserName,
  }) => {
    requirePhone();
    await withPage(browser, "trusted", async (page) => {
      const tag = `Browser_01 [${browserName}]`;
      note(
        "Browser_01",
        "browser",
        `Trình duyệt chạy test: ${browserName} ${browser.version()}`,
      );

      // Bước 1: mở trang chủ, nhấn [Đăng nhập] -> form hiển thị bình thường
      await openLoginForm(page, false);
      await expect(
        phoneInput(page),
        `${tag}: form phải hiển thị ô SĐT`,
      ).toBeVisible();
      await expect(
        submitBtn(page),
        `${tag}: form phải hiển thị nút gửi`,
      ).toBeVisible();
      await shot(page, `Browser_01_${browserName}_form`);

      // Bước 2: nhập thông tin hợp lệ
      const pw = await hasPassword(page);
      test.skip(
        pw && !TEST_PASSWORD,
        "Bỏ qua: form có ô mật khẩu nhưng chưa điền TEST_PASSWORD",
      );
      const outcome = await doLogin(page);
      console.log(`[${tag}] Kết quả đăng nhập: ${outcome}`);
      expect(
        outcome,
        outcome === "otp"
          ? `${tag}: web đòi OTP (thiết bị không còn tin cậy)`
          : `${tag}: đăng nhập phải thành công`,
      ).toBe("logged-in");
      await expectLoggedInHeader(page, `${tag}:`);
      await shot(page, `Browser_01_${browserName}_da_dang_nhap`);

      // Bước 3: đăng xuất
      await logout(page);
      await expectGuestHeader(page, `${tag}: sau khi đăng xuất`);
      await shot(page, `Browser_01_${browserName}_da_dang_xuat`);
      await page.waitForTimeout(1500);
    });
  });

  test("Login_Perf_01: Kiểm tra thời gian phản hồi khi đăng nhập", async ({
    browser,
  }) => {
    requirePhone();
    const RUNS = 3;
    const times: number[] = [];

    for (let i = 1; i <= RUNS; i++) {
      await withPage(browser, "trusted", async (page) => {
        await openLoginForm(page);
        const pw = await hasPassword(page);
        test.skip(
          pw && !TEST_PASSWORD,
          "Bỏ qua: form có ô mật khẩu nhưng chưa điền TEST_PASSWORD",
        );

        await phoneInput(page).fill(TEST_PHONE);
        if (pw) await passwordInput(page).fill(TEST_PASSWORD);
        const before = await bodyLines(page);
        const net = watchNetwork(page);

        const t0 = Date.now();
        await safeClick(page, submitBtn(page));

        // Chỉ báo đang xử lý (spinner / nút bị khóa) ngay sau khi click
        const busy = await page
          .evaluate(() => {
            const sp = document.querySelector(
              '[class*="loading" i], [class*="spinner" i], [class*="loader" i], [aria-busy="true"]',
            );
            const btn = document.querySelector("button[disabled]");
            return !!sp || !!btn;
          })
          .catch(() => false);

        const outcome = await waitLoginOutcome(page, before, 20000, net);
        const ms = Date.now() - t0;
        times.push(ms);
        console.log(
          `[Perf_01] Lần ${i}/${RUNS}: ${outcome} sau ${ms} ms | chỉ báo đang xử lý: ${busy}`,
        );
        expect(
          outcome,
          outcome === "otp"
            ? "Web đòi OTP: tạo lại storageState"
            : "Đăng nhập phải thành công",
        ).toBe("logged-in");
        if (!busy)
          note(
            "Perf_01",
            "ux-note",
            `Lần ${i}: không phát hiện chỉ báo đang xử lý (spinner / nút bị khóa) sau khi click.`,
          );
        await page.waitForTimeout(1000);
      });
    }

    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const max = Math.max(...times);
    const report = `Số đo (ms): ${times.join(", ")} | trung bình ${avg} ms | lớn nhất ${max} ms | ngưỡng ${PERF_LIMIT_MS} ms`;
    console.log(`[Perf_01] ${report}`);
    await attachText("Perf_01_so_do", report);
    test.info().annotations.push({ type: "perf", description: report });
    expect
      .soft(
        avg,
        `Thời gian đăng nhập trung bình ${avg} ms vượt ngưỡng ${PERF_LIMIT_MS} ms`,
      )
      .toBeLessThanOrEqual(PERF_LIMIT_MS);
  });
});
