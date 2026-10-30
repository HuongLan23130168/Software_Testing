import os
import re
import time
import unicodedata
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect
from playwright.sync_api import TimeoutError as PWTimeout


BASE_URL = "https://www.dienmayxanh.com"
PHONE = os.getenv("DMX_PHONE", "")
PASSWORD = os.getenv("DMX_PASSWORD", "")
PHONE_UNREG = os.getenv("DMX_PHONE_UNREG", "")
PERF_LIMIT = float(os.getenv("DMX_PERF_LIMIT", "5"))
RUN_LOCKOUT = os.getenv("DMX_RUN_LOCKOUT") == "1"
SCREENSHOT_DIR = Path("screenshots")

LOGIN_RE = re.compile(r"đăng nhập", re.I)
LOGIN_EXACT_RE = re.compile(r"^\s*đăng nhập\s*$", re.I)
ERROR_RE = re.compile(
    r"(không hợp lệ|không đúng|không tồn tại|chưa đăng ký|thất bại|\bsai\b|"
    r"vui lòng|bắt buộc|không được để trống|yêu cầu nhập|\blỗi\b)",
    re.I,
)


AUTH_MODE = os.getenv("DMX_AUTH_MODE", "otp").lower()

needs_account = pytest.mark.skipif(
    AUTH_MODE != "password" or not (PHONE and PASSWORD),
    reason="N/A: website đăng nhập bằng OTP (không có mật khẩu) - hoặc chưa đặt DMX_PHONE/DMX_PASSWORD",
)

needs_phone = pytest.mark.skipif(
    not PHONE,
    reason="Chưa đặt $env:DMX_PHONE (SĐT của bạn, sẽ nhận 1 SMS OTP mỗi test)",
)


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "viewport": {"width": 1920, "height": 1080},
        "locale": "vi-VN",
        "timezone_id": "Asia/Ho_Chi_Minh",
    }


@pytest.fixture(autouse=True)
def _screenshot_after_test(request, page):
    page.set_default_navigation_timeout(60000)
    page.set_default_timeout(20000)
    yield
    try:
        SCREENSHOT_DIR.mkdir(exist_ok=True)
        name = re.sub(r"[^\w\-]+", "_", request.node.name)
        page.screenshot(path=str(SCREENSHOT_DIR / f"{name}.png"))
    except Exception:
        pass


def phone_input(page: Page):

    return (
        page.get_by_role("textbox", name=re.compile(r"số điện thoại", re.I))
        .or_(page.locator(
            "input[type='tel'], input[name*='phone' i], input[id*='phone' i], "
            "input[name*='sdt' i], input[placeholder*='điện thoại' i], "
            "input[placeholder*='số điện' i]"
        ))
    ).filter(visible=True).first


def password_input(page: Page):
    return page.locator(
        "input[type='password'], input[name*='pass' i], input[id*='pass' i], "
        "input[placeholder*='mật khẩu' i]"
    ).filter(visible=True).first


def header_login_btn(page: Page):
    return (
        page.locator("header").get_by_text(LOGIN_EXACT_RE)
        .or_(page.get_by_role("link", name=LOGIN_EXACT_RE))
        .or_(page.get_by_role("button", name=LOGIN_EXACT_RE))
    ).filter(visible=True).first


CONTINUE_RE = re.compile(r"^\s*(tiếp tục|đăng nhập)\s*$", re.I)


def submit_btn(page: Page):
    return (
        page.get_by_role("button", name=CONTINUE_RE)
        .or_(page.locator("input[type='submit']"))
    ).filter(visible=True).last


def close_btn(page: Page):
    return page.locator(
        "[aria-label*='đóng' i], [aria-label*='close' i], "
        "[class*='popup' i] [class*='close' i], [class*='modal' i] [class*='close' i], "
        "[class*='login' i] [class*='close' i]"
    ).filter(visible=True).first


def eye_btn(page: Page):
    return page.locator(
        "[class*='eye' i], [class*='show-pass' i], [class*='toggle' i][class*='pass' i], "
        "[aria-label*='hiện mật khẩu' i]"
    ).filter(visible=True).first


def step(msg: str):
    print(f"   -> {msg}")


def dismiss_popups(page: Page):
    backdrop = page.locator("div.cursor-pointer[class*='opacity-50']").filter(visible=True)
    for _ in range(3):
        try:
            if backdrop.count() == 0:
                return
            step("Phát hiện popup/lớp phủ, đang đóng...")

            close = page.locator(
                "[aria-label*='đóng' i], [aria-label*='close' i], button:has-text('Đóng'), "
                "button:has-text('Để sau'), button:has-text('Bỏ qua')"
            ).filter(visible=True).first
            if close.count() and close.is_visible():
                close.click(timeout=2000)
            else:

                page.keyboard.press("Escape")
                page.wait_for_timeout(500)
                if backdrop.count():
                    backdrop.first.click(position={"x": 5, "y": 5}, force=True, timeout=2000)
            page.wait_for_timeout(800)
        except Exception:
            pass


def go_home(page: Page):
    step("Mở trang chủ")
    for attempt in (1, 2):
        try:

            page.goto(BASE_URL, wait_until="commit", timeout=60000)
            break
        except PWTimeout:
            step(f"Trang chủ tải chậm (lần {attempt}/2), thử lại...")
    expect(header_login_btn(page)).to_be_visible(timeout=45000)
    page.wait_for_timeout(2500)
    dismiss_popups(page)


def click_header_login(page: Page):
    step("Click nút [Đăng nhập] trên Header")
    btn = header_login_btn(page)
    try:
        btn.click(timeout=8000)
    except PWTimeout:

        step("Click thường bị chặn bởi lớp phủ -> dùng click JavaScript")
        btn.evaluate("el => el.click()")


def open_login_form(page: Page):
    go_home(page)
    click_header_login(page)

    expect(phone_input(page)).to_be_visible(timeout=30000)


def has_password_step(page: Page, timeout=8000) -> bool:
    try:
        expect(password_input(page)).to_be_visible(timeout=timeout)
        return True
    except AssertionError:
        return False


def fill_form(page: Page, phone, password=None):
    if phone is not None:
        phone_input(page).fill(phone)
    if password is not None and password_input(page).is_visible():
        password_input(page).fill(password)


def go_step2(page: Page, phone):
    phone_input(page).fill(phone)
    submit_btn(page).click()
    if not has_password_step(page):
        pytest.skip("Sau bước nhập SĐT website KHÔNG hiện ô mật khẩu "
                    "(có thể dùng OTP) - ghi nhận hành vi thực tế vào Note")


def submit(page: Page, use_enter=False):
    if use_enter:
        target = password_input(page) if password_input(page).is_visible() else phone_input(page)
        target.press("Enter")
    else:
        submit_btn(page).click()


def is_logged_in(page: Page, timeout=15000) -> bool:
    try:
        expect(phone_input(page)).to_be_hidden(timeout=timeout)
        expect(header_login_btn(page)).to_be_hidden(timeout=timeout)
        return True
    except AssertionError:
        return False


def login(page: Page, use_enter=False):
    open_login_form(page)
    step("Nhập SĐT hợp lệ -> [Tiếp tục] -> nhập mật khẩu -> submit")
    go_step2(page, PHONE)
    password_input(page).fill(PASSWORD)
    submit(page, use_enter)
    assert is_logged_in(page), "Đăng nhập không thành công với tài khoản hợp lệ"


def main_text(page: Page) -> str:
    try:
        return unicodedata.normalize("NFC", page.locator("main").inner_text(timeout=3000)).replace("\n", " | ")
    except Exception:
        return ""


def has_error(page: Page) -> bool:
    if ERROR_RE.search(main_text(page)):
        return True
    form = page.locator("form").filter(has=page.locator("input[type='password'], input[name*='pass' i]"))
    scope = form.first if form.count() else page
    try:
        expect(scope.get_by_text(ERROR_RE).filter(visible=True).first).to_be_visible(timeout=5000)
        return True
    except AssertionError:
        pass
    try:
        expect(
            page.locator("[role='alert'], [class*='toast' i], [class*='error' i], [class*='err-' i]")
            .filter(visible=True).filter(has_text=ERROR_RE).first
        ).to_be_visible(timeout=1500)
        return True
    except AssertionError:
        pass
    for loc in (phone_input(page), password_input(page)):
        try:
            if loc.evaluate("e => e.matches(':invalid')"):
                return True
        except Exception:
            pass
    return False


def assert_login_failed(page: Page, expect_error=True):
    assert not is_logged_in(page, timeout=3000), "Lỗi: đăng nhập lại thành công ngoài mong đợi"
    expect(header_login_btn(page)).to_be_visible()
    if expect_error:
        assert has_error(page), "Không thấy thông báo lỗi"


def open_account_menu(page: Page):
    cand = (
        page.locator("header").get_by_text(re.compile(r"(xin chào|tài khoản|\*{3}|\b0\d{3,})", re.I))
        .or_(page.locator("header [class*='user' i], header [class*='account' i], header [class*='login' i]"))
    )
    cand.filter(visible=True).first.click()


def test_Login_Open_01(page: Page):
    go_home(page)
    expect(header_login_btn(page)).to_be_visible()
    click_header_login(page)
    expect(phone_input(page)).to_be_visible(timeout=15000)
    expect(submit_btn(page)).to_be_visible()
    print(f"   URL sau khi mở form: {page.url}  (trang riêng, không phải popup)")


def test_Login_Open_02(page: Page):
    open_login_form(page)
    if "dang-nhap" in page.url.lower():
        pytest.skip("N/A: website dùng trang đăng nhập riêng (/dang-nhap), không phải popup")
    if not close_btn(page).count():
        pytest.skip("Không tìm thấy nút đóng [X] - kiểm tra lại selector close_btn()")
    close_btn(page).click()
    expect(phone_input(page)).to_be_hidden()


def test_Login_Display_02(page: Page):
    open_login_form(page)
    expect(phone_input(page)).to_be_visible()
    expect(submit_btn(page)).to_be_visible()
    for label, rx in (("Quên mật khẩu", r"quên mật khẩu"), ("Đăng ký", r"đăng ký|tạo tài khoản"),
                      ("Mạng xã hội", r"google|facebook|zalo")):
        shown = page.get_by_text(re.compile(rx, re.I)).filter(visible=True).count() > 0
        print(f"   Thành phần [{label}] hiển thị ở bước 1: {shown}")


@needs_account
def test_Login_Display_04(page: Page):
    open_login_form(page)
    go_step2(page, PHONE)
    password_input(page).fill("Test@12345")
    assert password_input(page).get_attribute("type") == "password", "Mật khẩu chưa được che"
    if not eye_btn(page).count():
        pytest.skip("Không có nút con mắt - chỉ kiểm tra bước che mật khẩu (đã PASS)")
    eye_btn(page).click()
    assert password_input(page).get_attribute("type") == "text", "Chưa hiện mật khẩu"
    eye_btn(page).click()
    assert password_input(page).get_attribute("type") == "password", "Chưa che lại mật khẩu"


@needs_account
def test_Login_Valid_01(page: Page):
    login(page, use_enter=False)


@needs_account
def test_Login_Valid_02(page: Page):
    login(page, use_enter=True)


@needs_account
def test_Login_Valid_03(page: Page):
    login(page)
    open_account_menu(page)
    page.wait_for_timeout(1500)
    body = page.inner_text("body")
    assert PHONE[-3:] in body, "Không thấy SĐT (3 số cuối) của tài khoản trong menu/trang tài khoản"


def test_Login_Phone_01(page: Page):
    open_login_form(page)
    fill_form(page, "abc123xyz")
    value = phone_input(page).input_value()
    step(f"Giá trị trong ô SĐT sau khi nhập 'abc123xyz': '{value}'")
    submit(page)
    assert_login_failed(page, expect_error=bool(re.search(r"[A-Za-z]", value)))
    expect(phone_input(page)).to_be_visible()


def test_Login_Phone_02(page: Page):
    open_login_form(page)
    fill_form(page, "090123")
    submit(page)
    assert_login_failed(page)
    expect(phone_input(page)).to_be_visible()


@pytest.mark.skipif(not PHONE_UNREG, reason="Đặt $env:DMX_PHONE_UNREG = SĐT CỦA BẠN chưa đăng ký tài khoản")
def test_Login_Phone_05(page: Page):
    open_login_form(page)
    fill_form(page, PHONE_UNREG)
    submit(page)
    page.wait_for_timeout(3000)
    assert not is_logged_in(page, timeout=3000), "Đăng nhập được bằng SĐT chưa đăng ký?!"
    print(f"   URL sau khi submit SĐT chưa đăng ký: {page.url}")
    print("   Nội dung chính:", page.locator("main").inner_text()[:300].replace("\n", " | "))


@needs_account
def test_Login_Pass_01(page: Page):
    open_login_form(page)
    go_step2(page, PHONE)
    password_input(page).fill("Sai@12345")
    submit(page)
    assert_login_failed(page)


@needs_account
def test_Login_Pass_02(page: Page):
    if PASSWORD.upper() == PASSWORD.lower():
        pytest.skip("Mật khẩu test không có chữ cái nên không đổi hoa/thường được")
    open_login_form(page)
    go_step2(page, PHONE)
    password_input(page).fill(PASSWORD.swapcase())
    submit(page)
    assert_login_failed(page)


def test_Login_Empty_01(page: Page):
    open_login_form(page)
    fill_form(page, "")
    submit(page)
    assert_login_failed(page)
    expect(phone_input(page)).to_be_visible()


def test_Login_Empty_02(page: Page):
    open_login_form(page)
    if not password_input(page).is_visible():
        pytest.skip("N/A: bước 1 của website không có ô mật khẩu")
    fill_form(page, "", "Test@12345")
    submit(page)
    assert_login_failed(page)


@needs_account
def test_Login_Empty_03(page: Page):
    open_login_form(page)
    go_step2(page, PHONE)
    password_input(page).fill("")
    submit(page)
    assert_login_failed(page)


def test_Login_Security_01(page: Page):
    open_login_form(page)
    fill_form(page, "' OR '1'='1")
    submit(page)
    assert not is_logged_in(page, timeout=3000), "NGHIÊM TRỌNG: đăng nhập được bằng SQL Injection"
    body = page.inner_text("body").lower()
    for bad in ("sql syntax", "stack trace", "exception", "odbc", "mysql", "ora-"):
        assert bad not in body, f"Lộ thông tin lỗi hệ thống: '{bad}'"


@pytest.mark.skipif(not (PHONE and RUN_LOCKOUT and AUTH_MODE == "password"),
                    reason="N/A với đăng nhập OTP (hoặc chưa đặt DMX_RUN_LOCKOUT=1)")
def test_Login_Security_04(page: Page):
    open_login_form(page)
    go_step2(page, PHONE)
    for i in range(1, 6):
        password_input(page).fill(f"Sai@{i}2345")
        submit(page)
        page.wait_for_timeout(1500)
        assert not is_logged_in(page, timeout=2000)
        step(f"Lần sai thứ {i}: có thông báo lỗi = {has_error(page)}")
    body = page.inner_text("body")
    warned = bool(re.search(r"(khóa|tạm khóa|captcha|quá nhiều|thử lại sau|xác thực)", body, re.I))
    print(f"   Sau 5 lần sai: có cảnh báo/khóa/captcha = {warned}")


@needs_account
def test_Login_Session_01(page: Page):
    login(page)
    page.reload(wait_until="domcontentloaded")
    expect(header_login_btn(page)).to_be_hidden(timeout=10000)
    page.goto(f"{BASE_URL}/tivi", wait_until="domcontentloaded")
    page.go_back(wait_until="domcontentloaded")
    expect(header_login_btn(page)).to_be_hidden(timeout=10000)


@needs_account
def test_Login_Logout_01(page: Page):
    login(page)
    open_account_menu(page)
    page.get_by_text(re.compile(r"đăng xuất", re.I)).filter(visible=True).first.click()
    expect(header_login_btn(page)).to_be_visible(timeout=15000)


def test_Login_Forgot_01(page: Page):
    open_login_form(page)
    link = page.get_by_text(re.compile(r"quên mật khẩu", re.I)).filter(visible=True)
    if not link.count() and PHONE and PASSWORD:
        go_step2(page, PHONE)
    if not link.count():
        pytest.skip("Không thấy liên kết [Quên mật khẩu] trên form (bước 1/2) - ghi nhận vào Note")
    link.first.click()
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(1500)
    body = page.inner_text("body")
    assert not re.search(r"\b(404|500)\b|not found", body, re.I), "Trang quên mật khẩu báo lỗi 404/500"
    assert re.search(r"(quên mật khẩu|khôi phục|lấy lại mật khẩu|đặt lại mật khẩu)", body, re.I)


def test_Login_Keyboard_01(page: Page):
    open_login_form(page)
    phone_input(page).focus()
    page.keyboard.press("Tab")
    focused = page.evaluate("(document.activeElement.innerText || document.activeElement.tagName || '').trim()")
    print(f"   Tab từ ô SĐT -> focus vào: '{focused}'")
    assert not phone_input(page).evaluate("e => e === document.activeElement"), "Tab không chuyển focus"
    page.keyboard.press("Shift+Tab")
    assert phone_input(page).evaluate("e => e === document.activeElement"), "Shift+Tab không quay lại ô SĐT"
    page.keyboard.press("Enter")
    page.wait_for_timeout(2000)
    print(f"   URL sau Enter: {page.url}")
    assert not is_logged_in(page, timeout=2000), "Enter với ô SĐT trống lại đăng nhập được?!"
    assert has_error(page), "Nhấn Enter khi ô SĐT trống không hiện thông báo lỗi"


@pytest.mark.parametrize("name,device_name", [("desktop", "none"), ("tablet", "iPad (gen 7)"), ("mobile", "iPhone 13")])
def test_Login_Device_01(browser, playwright, name, device_name):
    if device_name == "none":
        opts = {"viewport": {"width": 1920, "height": 1080}}
    else:
        opts = dict(playwright.devices[device_name])
        if name == "tablet":
            opts["viewport"] = {"width": 768, "height": 1024}
    ctx = browser.new_context(locale="vi-VN", timezone_id="Asia/Ho_Chi_Minh", **opts)
    page = ctx.new_page()
    page.set_default_navigation_timeout(60000)
    page.set_default_timeout(20000)
    try:
        go_home(page)
        if header_login_btn(page).is_visible():
            click_header_login(page)
        else:
            step("Header không có nút [Đăng nhập] (menu thu gọn) -> mở thẳng /dang-nhap")
            page.goto(f"{BASE_URL}/dang-nhap", wait_until="commit", timeout=60000)
        expect(phone_input(page)).to_be_visible(timeout=30000)
        expect(submit_btn(page)).to_be_visible()
        print(f"   [{name}] URL: {page.url} | viewport: {page.viewport_size}")
        overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        print(f"   [{name}] độ lệch cuộn ngang: {overflow}px")
        box = submit_btn(page).bounding_box()
        print(f"   [{name}] kích thước nút [Tiếp tục]: {box}")
        SCREENSHOT_DIR.mkdir(exist_ok=True)
        page.screenshot(path=str(SCREENSHOT_DIR / f"Login_Device_01_{name}.png"))
        assert overflow <= 1, f"[{name}] bị cuộn ngang {overflow}px"
        if name == "mobile":
            assert box and box["height"] >= 32, f"Nút quá nhỏ trên mobile: {box}"
    finally:
        ctx.close()


@needs_account
def test_Login_Browser_01(page: Page, browser_name):
    print(f"   Trình duyệt: {browser_name}")
    login(page)
    open_account_menu(page)
    page.get_by_text(re.compile(r"đăng xuất", re.I)).filter(visible=True).first.click()
    expect(header_login_btn(page)).to_be_visible(timeout=15000)


@needs_account
def test_Login_Perf_01(browser, browser_context_args):
    times = []
    for i in range(3):
        ctx = browser.new_context(**browser_context_args)
        pg = ctx.new_page()
        open_login_form(pg)
        go_step2(pg, PHONE)
        password_input(pg).fill(PASSWORD)
        t0 = time.perf_counter()
        submit_btn(pg).click()
        ok = is_logged_in(pg, timeout=20000)
        times.append(time.perf_counter() - t0)
        ctx.close()
        assert ok, f"Lần {i + 1}: đăng nhập thất bại"
    print(f"   Thời gian đăng nhập (s): {[round(t, 2) for t in times]}")
    assert max(times) <= PERF_LIMIT, f"Chậm hơn ngưỡng {PERF_LIMIT}s: {times}"


LIMIT_RE = re.compile(r"(quá nhiều|quá số lần|thử lại sau|giới hạn|vượt quá|tạm khóa|tạm thời)", re.I)
OTP_RE = re.compile(r"(otp|mã xác (nhận|thực)|nhập mã|gửi mã|mã gồm)", re.I)


def go_otp_step(page: Page):
    open_login_form(page)
    phone_input(page).fill(PHONE)
    submit_btn(page).click()
    for attempt in (1, 2):
        for _ in range(12):
            if OTP_RE.search(main_text(page)):
                return
            page.wait_for_timeout(1000)
        if attempt == 1:
            step("Chưa thấy màn hình OTP, bấm [Tiếp tục] lần nữa")
            if phone_input(page).count() and not phone_input(page).input_value():
                phone_input(page).fill(PHONE)
            submit_btn(page).click()
    body = unicodedata.normalize("NFC", page.inner_text("body")).replace("\n", " | ")
    if LIMIT_RE.search(body):
        found = LIMIT_RE.search(body).group(0)
        pytest.skip(f"Website giới hạn gửi OTP trong thời gian ngắn ('{found}') - thử lại sau vài phút")
    pytest.fail(f"Không thấy màn hình OTP sau [Tiếp tục]. Nội dung trang: {body[:400]}")


@needs_phone
def test_Login_OTP_01(page: Page):
    go_otp_step(page)
    assert not is_logged_in(page, timeout=2000), "Chưa nhập OTP mà đã đăng nhập?!"
    print("   Màn hình OTP:", main_text(page)[:300])


@needs_phone
def test_Login_OTP_02(page: Page):
    go_otp_step(page)
    inputs = page.locator("main input:not([type='hidden'])").filter(visible=True)
    n = inputs.count()
    if n == 0:
        pytest.skip("Không tìm thấy ô nhập OTP - kiểm tra lại selector")
    inputs.first.click()
    page.keyboard.type("000000", delay=150)
    btn = submit_btn(page)
    if btn.count():
        btn.click()
    page.wait_for_timeout(3000)
    assert not is_logged_in(page, timeout=2000), "Đăng nhập được với OTP sai?!"
    print(f"   Có thông báo lỗi OTP sai: {has_error(page)}")
