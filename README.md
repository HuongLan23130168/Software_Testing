# Automation Testing Project – Group 11

Kiểm thử tự động website **https://www.dienmayxanh.com** bằng **Playwright Test + TypeScript**.
Đây là project đã tích hợp script của cả 6 thành viên, chạy chung trong một Test Suite và xuất một báo cáo duy nhất.

## 1. Cấu trúc repository

```
.
├── README.md
├── Automation Testing Project - Group 11/   # source code, chạy lệnh trong thư mục này
│   ├── playwright.config.ts                 # cấu hình chung (timeout, reporter, screenshot, video, trace)
│   ├── package.json / tsconfig.json
│   ├── auth/                                # storageState đăng nhập (KHÔNG commit, đã .gitignore)
│   └── tests/
│       ├── login/          23130377_TietThiKimTuyen_ASM7.spec.ts
│       ├── mega-menu/      23130168_NguyenThiHuongLan_ASM7.spec.ts
│       ├── flash-sale/     23130168_NguyenThiHuongLan_ASM7_2.spec.ts
│       ├── product-list/   23130328_PhanThaoTien_ASM7.spec.ts
│       ├── voucher/        23130194_NguyenVoQuangMinh_ASM7.spec.ts
│       ├── store-locator/  23130204_CaoThiKimNgan_ASM7.spec.ts
│       └── cart/           23130340_TranThiMyTram_ASM7.spec.ts
├── Test Report - Group 11/                  # báo cáo tự sinh: html/, junit-results.xml, results.json
└── Envidence - Group11/                     # screenshot, video, trace của từng test (test-results/)
```

**Quy ước đặt tên**

- Thư mục theo chức năng (`kebab-case`), mỗi chức năng một file `<MSSV>_<HoTen>.<chuc-nang>.spec.ts`.
- Mã test case dạng `<Module>_<Nhóm>_<STT>` (ví dụ `Cart_Add_01`, `Store_Province_02`) – giữ nguyên theo file Excel Test Case.
- Cấu hình dùng chung nằm trong `playwright.config.ts`; script chỉ giữ cấu hình riêng của chức năng đó (viewport, timeout).

| MSSV     | Họ tên               | Chức năng                                      | Số test |
| -------- | -------------------- | ---------------------------------------------- | ------- |
| 23130377 | Tiết Thị Kim Tuyền   | Đăng nhập                                      | 28      |
| 23130168 | Nguyễn Thị Hương Lan | Mega menu, Shortcut danh mục, Tất cả nhóm hàng | 40      |
| 23130328 | Phan Thảo Tiên       | Danh sách sản phẩm theo danh mục               | 27      |
| 23130194 | Nguyễn Võ Quang Minh | Voucher / mã giảm giá                          | 29      |
| 23130204 | Cao Thị Kim Ngân     | Tìm siêu thị                                   | 27      |
| 23130340 | Trần Thị Mỹ Trâm     | Giỏ hàng                                       | 30      |
|          |                      | **Tổng**                                       | **181** |

## 2. Cài đặt

Yêu cầu: Node.js ≥ 18.

```bash
cd "Automation Testing Project - Group 11"
npm install
npx playwright install chromium      # tải trình duyệt (lần đầu)
```

## 3. Chạy kiểm thử

```bash
npm test                    # toàn bộ Test Suite (181 test)
npm run test:login          # riêng từng chức năng
npm run test:mega-menu
npm run test:product-list
npm run test:voucher
npm run test:store-locator
npm run test:cart
npx playwright test -g "Cart_Add_01"      # một test case
npm run test:headed         # có giao diện trình duyệt
npm run report              # mở báo cáo HTML
```

Mỗi file chạy độc lập được (`npx playwright test tests/cart`) và chạy chung (`npm test`).

## 4. Cấu hình

Biến môi trường (PowerShell: `$env:TEN="gia tri"`; bash: `export TEN=...`):

| Biến                                                                                                                      | Tác dụng                                                        | Mặc định                    |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------- |
| `HEADED=1`                                                                                                                | Hiện trình duyệt                                                | tắt                         |
| `SLOWMO=300`                                                                                                              | Làm chậm thao tác (ms) để quay demo                             | 0                           |
| `PW_CHANNEL=chrome`                                                                                                       | Dùng Google Chrome cài sẵn                                      | Chromium                    |
| `BROWSER_PATH`                                                                                                            | Đường dẫn trình duyệt tuỳ chọn                                  | –                           |
| `RETRIES`                                                                                                                 | Số lần chạy lại khi fail (phát hiện flaky)                      | 1                           |
| `WORKERS`                                                                                                                 | Số worker                                                       | 1                           |
| `PW_VIDEO=on`                                                                                                             | Quay video mọi test (mặc định chỉ khi fail)                     | –                           |
| `DMX_PHONE`, `DMX_PASSWORD`, `DMX_AUTH_MODE` (`otp`/`password`), `DMX_PHONE_UNREG`, `DMX_RUN_LOCKOUT=1`, `DMX_PERF_LIMIT` | Dữ liệu cho nhóm test Đăng nhập                                 | –                           |
| `DMX_BASE_URL`                                                                                                            | Đổi địa chỉ website (chỉ dùng cho chức năng Danh sách sản phẩm) | https://www.dienmayxanh.com |
| `NO_STORE_PROVINCE`                                                                                                       | Tỉnh dùng cho `Store_Ward_02`                                   | Tỉnh Điện Biên              |

**Đăng nhập (OTP):** website đăng nhập bằng OTP nên các test cần tài khoản (Voucher, Store_Access_03) đọc file `auth/dmx_storageState.json`.
Tạo một lần bằng `npm run auth`, đăng nhập thủ công trong cửa sổ mở ra rồi đóng cửa sổ. Không có file này, các test đó tự **Skipped**.
Không commit file auth và không ghi số điện thoại/mật khẩu vào source.

## 5. Kết quả

- `Test Report - Group 11/html/` – báo cáo HTML (mở `index.html` hoặc `npm run report`).
- `Test Report - Group 11/junit-results.xml`, `results.json` – báo cáo XML/JSON.
- `Envidence - Group11/test-results/` – screenshot mọi test, video/trace của test fail.
- Test pass sau khi retry được báo cáo là **flaky**.

## 6. Lưu ý khi chạy

- Test chạy trên website thật nên kết quả phụ thuộc dữ liệu, khuyến mãi và mạng tại thời điểm chạy.
- Bộ Voucher thao tác trên tài khoản thật (lấy mã); các test trong cùng nhóm chạy tuần tự và có thể làm thay đổi số voucher còn lại.
- Chạy `WORKERS=1` (mặc định) để tránh bị website chặn vì quá nhiều request đồng thời.
