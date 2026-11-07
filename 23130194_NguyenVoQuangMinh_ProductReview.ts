import { test, expect, Page, BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// BẬT CHẾ ĐỘ SUBMIT THẬT MẶC ĐỊNH CHO MỌI LẦN CHẠY
process.env.REAL_SUBMIT = '1';

/**
 * ==============================================================================
 * BỘ AUTOMATION TEST CHỨC NĂNG: ĐÁNH GIÁ SẢN PHẨM (REVIEW) (ĐIỆN MÁY XANH)
 * File: tests/Review.spec.ts
 * Sinh viên thực hiện: Nguyễn Võ Quang Minh (MSSV: 23130194)
 * Môn học / Bài tập: Assignment 7 - Triển khai Script Automation cho Chức Năng Cá Nhân
 * Bộ Test Case: 30 Test Cases theo tài liệu DMX_TestCase_TestDesign_TestReport_V0.4.xlsx
 * Website kiểm thử: 100% THUẦN TRỰC TIẾP TRÊN https://www.dienmayxanh.com
 * Tự động ghi hình: Toàn bộ quá trình chạy được lưu video .webm vào thư mục test-results/
 * ==============================================================================
 */

const STORAGE_STATE_PATH = path.join(
  __dirname,
  "../auth/dmx_storageState.json",
);
const HAS_AUTH = fs.existsSync(STORAGE_STATE_PATH);
const TEST_PHONE = "0978173770";
const TEST_NAME = "Minh";

// URL và thông tin sản phẩm mục tiêu khảo sát theo Test Case Specification
const PRODUCT_URL =
  "https://www.dienmayxanh.com/noi-com-dien/noi-com-dien-tu-kangaroo-18-lit-kgrc18d3g";
const PRODUCT_NAME = "Nồi cơm điện tử Kangaroo 1.8 lít KGRC18D3G";

// Đường dẫn fixture phục vụ kiểm thử tải file ảnh
const FIXTURES_DIR = path.join(__dirname, "../fixtures");
const IMG_1 = path.join(FIXTURES_DIR, "img_1.jpg");
const IMG_2 = path.join(FIXTURES_DIR, "img_2.jpg");
const IMG_3 = path.join(FIXTURES_DIR, "img_3.jpg");
const IMG_4 = path.join(FIXTURES_DIR, "img_4.jpg");
const FILE_TXT = path.join(FIXTURES_DIR, "sample.txt");
const FILE_FAKE_JPG = path.join(FIXTURES_DIR, "fake_image.jpg");
const FILE_HEAVY_10MB = path.join(FIXTURES_DIR, "heavy_10mb.jpg");

test.use(HAS_AUTH ? { storageState: STORAGE_STATE_PATH } : {});

// ==============================================================================
// HÀM TIỆN ÍCH DÙNG CHUNG (HELPER FUNCTIONS)
// ==============================================================================

/** Chụp ảnh màn hình đính kèm vào báo cáo Playwright HTML */
const shot = async (page: Page, name: string) =>
  test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

/** Đính kèm text thông tin vào báo cáo */
const attachText = async (name: string, text: string) =>
  test.info().attach(name, { body: text, contentType: "text/plain" });

/** Ghi chú (annotation) vào báo cáo */
const note = (type: string, description: string) => {
  console.warn(`[${type.toUpperCase()}]: ${description}`);
  test.info().annotations.push({ type, description });
};

/** Tắt các popup banner quảng cáo che màn hình nếu xuất hiện */
async function dismissPopups(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => {});
  const closeButtons = page.locator(
    [
      '[class*="popup" i] [class*="close" i]',
      '[class*="modal" i] [class*="close" i]',
      '[class*="banner" i] [class*="close" i]',
      'button[aria-label*="close" i]',
      'button[aria-label*="đóng" i]',
      ".btn-close",
      ".close-popup",
      ".close",
    ].join(", "),
  );

  for (const btn of await closeButtons.all()) {
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

/** Cuộn trang xuống khu vực Đánh giá sản phẩm */
async function scrollToReviewSection(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let i = 0; i < 8; i++) {
      window.scrollBy(0, 700);
      await new Promise((r) => setTimeout(r, 200));
    }
  });

  const writeBtn = page.locator('button:has-text("Viết đánh giá")').first();
  if (await writeBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await writeBtn.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(1000);
}

/** Mở popup Viết đánh giá sản phẩm và trả về locator popup */
async function openReviewModal(page: Page) {
  await scrollToReviewSection(page);
  const writeBtn = page.locator('button:has-text("Viết đánh giá")').first();
  await expect(writeBtn, "Phải có nút [Viết đánh giá] trên trang").toBeVisible({
    timeout: 15000,
  });
  await writeBtn.click();
  await page.waitForTimeout(1000);

  const modal = page.locator('.fixed:has-text("Đánh giá sản phẩm")').last();
  await expect(modal, "Popup [Đánh giá sản phẩm] phải hiển thị").toBeVisible({
    timeout: 10000,
  });
  return modal;
}

/** Đóng popup đánh giá bằng nút ✕ (có dự phòng khi nút nằm ngoài vùng nhìn thấy do popup cao) */
async function closeReviewModal(page: Page): Promise<void> {
  const modal = page.locator('.fixed:has-text("Đánh giá sản phẩm")').last();
  if (await modal.isVisible().catch(() => false)) {
    const closeBtn = modal
      .locator('button:has(span:has-text("✕")), button:has-text("✕")')
      .first();
    if (await closeBtn.isVisible().catch(() => false)) {
      let closed = true;
      await closeBtn.click({ timeout: 3000 }).catch(() => { closed = false; });
      if (!closed) {
        // Dự phòng: gọi click trực tiếp trên DOM, không phụ thuộc vị trí trong khung nhìn
        await closeBtn.evaluate((el) => (el as HTMLElement).click()).catch(() => {});
      }
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(800);
  }
}

/** Tick/bỏ tick checkbox chính sách (checkbox của web bị biểu tượng dấu tick đè nên check() thường sẽ treo) */
async function setAgree(modal: Locator, page: Page, want: boolean): Promise<void> {
  const agree = modal.locator('input#agree, input[name="agree"]');
  if ((await agree.isChecked().catch(() => !want)) === want) return;
  await agree.click({ force: true, timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  if ((await agree.isChecked().catch(() => !want)) !== want) {
    await agree.dispatchEvent('click');   // dự phòng: bắn sự kiện click trực tiếp
    await page.waitForTimeout(300);
  }
}

/** Mở trang sản phẩm, cuộn tới khu vực đánh giá và trả về các hàm đọc/bấm [Hữu ích] của đúng 1 người đánh giá */
async function prepareLikeContext(
  page: Page,
  reviewer: string,
  opts: { skipGoto?: boolean } = {},
) {
  if (!opts.skipGoto) {
    await page.goto(PRODUCT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  }
  await dismissPopups(page);

  const header = page
    .getByText(/Đánh giá Nồi cơm điện tử Kangaroo 1\.8 lít KGRC18D3G/i)
    .first();

  await page.evaluate(async () => {
    for (let i = 0; i < 8; i++) {
      window.scrollBy(0, 700);
      await new Promise((r) => setTimeout(r, 200));
    }
  });
  await header.waitFor({ state: "attached", timeout: 15000 });
  await header.scrollIntoViewIfNeeded();
  await dismissPopups(page);

  // Bấm "Xem thêm ... đánh giá" để tải đủ danh sách (chỉ đọc)
  for (let i = 0; i < 5; i++) {
    const moreBtn = page
      .getByRole("button", { name: /Xem thêm.*đánh giá/i })
      .first();
    if (!(await moreBtn.isVisible().catch(() => false))) break;
    await moreBtn.click().catch(() => {});
    await page.waitForTimeout(800);
  }

  const block = header.locator(
    'xpath=ancestor::div[contains(., "khách hài lòng")][1]',
  );
  await expect(block, "Phải xác định được thẻ khối đánh giá").toBeVisible({
    timeout: 15000,
  });

  // Đánh giá = div nhỏ nhất chứa tên người đánh giá và nút [Hữu ích]
  const item = block
    .locator(
      `xpath=.//*[normalize-space(text())="${reviewer}"]/ancestor::div[.//*[contains(text(),"Hữu ích")]][1]`,
    )
    .first();
  await expect(
    item,
    `Phải có đánh giá của "${reviewer}" trong danh sách`,
  ).toBeVisible({ timeout: 15000 });
  await item.scrollIntoViewIfNeeded();
  await dismissPopups(page);

  const likeBtn = item.getByText(/^\s*Hữu ích/i).first();
  await expect(
    likeBtn,
    `Đánh giá của "${reviewer}" phải có nút [Hữu ích]`,
  ).toBeVisible({ timeout: 10000 });

  // Số lượng "Hữu ích (139)" hoặc "Hữu ích" + "(139)" ở dòng kế
  const readCount = async (): Promise<number> => {
    const t = ((await item.innerText()) || "").replace(/\u00a0/g, " ");
    const m = t.match(/Hữu ích\s*\(?\s*(\d+)\s*\)?/i);
    return m ? parseInt(m[1], 10) : NaN;
  };

  // Chữ ký hiển thị của cụm nút (thẻ chữ + tối đa 3 cấp cha, gồm cả biểu tượng), không tính chữ
  const readState = (): Promise<string> =>
    likeBtn.evaluate((el: HTMLElement, name: string) => {
      let top: HTMLElement = el.parentElement ?? el;
      for (let i = 0; i < 2 && top.parentElement; i++) {
        if ((top.parentElement.innerText || "").includes(name)) break;
        top = top.parentElement;
      }
      const chain: Element[] = [];
      for (
        let n: Element | null = el;
        n && n !== top.parentElement;
        n = n.parentElement
      )
        chain.push(n);
      const nodes = [...chain, ...Array.from(top.querySelectorAll("*"))];
      return Array.from(new Set(nodes))
        .map((n) => {
          const cs = getComputedStyle(n);
          return [
            n.tagName,
            n.getAttribute("class") ?? "",
            n.getAttribute("aria-pressed") ?? "",
            n.getAttribute("fill") ?? "",
            n.getAttribute("src") ?? "",
            n.getAttribute("d") ?? "",
            cs.color,
            cs.backgroundColor,
            cs.fill,
            cs.stroke,
            cs.borderColor,
            cs.fontWeight,
            cs.opacity,
            cs.filter,
          ].join("|");
        })
        .join("||");
    }, reviewer);

  const readHtml = (): Promise<string> =>
    likeBtn.evaluate((el: HTMLElement, name: string) => {
      let top: HTMLElement = el.parentElement ?? el;
      for (let i = 0; i < 2 && top.parentElement; i++) {
        if ((top.parentElement.innerText || "").includes(name)) break;
        top = top.parentElement;
      }
      return top.outerHTML.slice(0, 2000);
    }, reviewer);

  return { item, likeBtn, readCount, readState, readHtml };
}

// ==============================================================================
// PHẦN 1: KHỐI TỔNG QUAN VÀ HIỂN THỊ ĐÁNH GIÁ (VIEW - 5 TEST CASES)
// ==============================================================================
test.describe("PHẦN 1: KHỐI TỔNG QUAN VÀ HIỂN THỊ ĐÁNH GIÁ (VIEW)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Review_View_01: Kiểm tra khối tổng quan đánh giá của sản phẩm", async ({
    page,
  }) => {
    test.setTimeout(120000); // tránh bị cắt ngang khi có nhiều soft-assert
    const SOFT = { timeout: 3000 }; // mỗi soft-assert chỉ chờ tối đa 3 giây

    // Pre-condition: chưa đăng nhập -> thêm vào đầu describe (hoặc đầu file cho nhóm VIEW):
    // test.use({ storageState: { cookies: [], origins: [] } });

    // ------------------------------------------------------------------
    // Step 1 / Expected 1: mở trang sản phẩm, trang hiển thị đầy đủ
    // ------------------------------------------------------------------
    await test.step("Step 1: Mở trang sản phẩm", async () => {
      const response = await page.goto(PRODUCT_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      expect(response, "Phải nhận được phản hồi từ server").not.toBeNull();
      expect(
        response!.status(),
        "Trang sản phẩm không được trả về lỗi 4xx/5xx",
      ).toBeLessThan(400);

      await expect(page).toHaveTitle(
        /Nồi cơm điện tử Kangaroo 1\.8 lít KGRC18D3G/i,
      );
      await dismissPopups(page);

      await expect(
        page.getByText(PRODUCT_NAME, { exact: false }).first(),
        "Tên sản phẩm phải hiển thị trên trang",
      ).toBeVisible({ timeout: 15000 });
    });

    // ------------------------------------------------------------------
    // Step 2: cuộn tới khu vực [Đánh giá ...]
    // ------------------------------------------------------------------
    const header = page
      .getByText(/Đánh giá Nồi cơm điện tử Kangaroo 1\.8 lít KGRC18D3G/i)
      .first();

    await test.step("Step 2: Cuộn tới khu vực [Đánh giá ...]", async () => {
      await page.evaluate(async () => {
        for (let i = 0; i < 8; i++) {
          window.scrollBy(0, 700);
          await new Promise((r) => setTimeout(r, 200));
        }
      });
      await header.waitFor({ state: "attached", timeout: 15000 });
      await header.scrollIntoViewIfNeeded();
      await dismissPopups(page);
      await page.waitForTimeout(500);
    });

    // Thẻ đánh giá = div cha gần nhất của tiêu đề có chứa dòng "khách hài lòng"
    const block = header.locator(
      'xpath=ancestor::div[contains(., "khách hài lòng")][1]',
    );
    await expect(block, "Phải xác định được thẻ khối đánh giá").toBeVisible({
      timeout: 15000,
    });

    // Lấy toàn bộ chữ hiển thị trong thẻ để đối chiếu (không phụ thuộc cấu trúc DOM)
    const cardText = ((await block.innerText()) || "").replace(/\u00a0/g, " ");
    const observed: Record<string, unknown> = {};
    await attachText("Review_View_01_card_text", cardText);

    // ------------------------------------------------------------------
    // Expected 2: kiểm tra từng thành phần
    // ------------------------------------------------------------------
    await test.step("Expected 2.1: Tiêu đề khu vực đánh giá", async () => {
      await expect
        .soft(header, "Tiêu đề khu vực đánh giá phải hiển thị")
        .toBeVisible(SOFT);
    });

    await test.step('Expected 2.2: Điểm trung bình "X.X/5" kèm ngôi sao', async () => {
      const m = cardText.match(/(\d+(?:[.,]\d+)?)\s*\/\s*5(?!\d)/);
      observed.avgScore = m ? m[0] : null;
      expect.soft(m, 'Phải có điểm trung bình dạng "X.X/5"').not.toBeNull();
      if (m) {
        const v = parseFloat(m[1].replace(",", "."));
        expect
          .soft(v, `Điểm trung bình phải nằm trong [0, 5], thực tế: ${m[1]}`)
          .toBeGreaterThanOrEqual(0);
        expect
          .soft(v, `Điểm trung bình phải nằm trong [0, 5], thực tế: ${m[1]}`)
          .toBeLessThanOrEqual(5);
      }

      // Ngôi sao: 1 sao cạnh điểm + 5 sao ở biểu đồ => tối thiểu 6 biểu tượng trong thẻ
      const starCount = await block
        .locator(
          'svg, img, i, [class*="star" i], [class*="rating" i], [class*="icon" i]',
        )
        .count();
      observed.starIconCount = starCount;
      expect
        .soft(
          starCount,
          "Phải có biểu tượng ngôi sao kèm điểm và biểu đồ (>= 6)",
        )
        .toBeGreaterThanOrEqual(6);
      await attachText(
        "Review_View_01_card_html",
        (await block.evaluate((el) => el.outerHTML)).slice(0, 6000),
      );
    });

    await test.step('Expected 2.3: Số "khách hài lòng"', async () => {
      await expect
        .soft(
          block.getByText(/khách hài lòng/i).first(),
          'Dòng "khách hài lòng" phải hiển thị',
        )
        .toBeVisible(SOFT);
      const m = cardText.match(/\d+(?:[.,]\d+)?\s*k?\s*khách hài lòng/i);
      observed.satisfied = m ? m[0] : null;
      expect
        .soft(m, 'Định dạng phải là "<số>[k] khách hài lòng"')
        .not.toBeNull();
    });

    await test.step('Expected 2.4: Tổng số "N đánh giá"', async () => {
      // Lưu ý: KHÔNG dùng \b sau "giá" vì \b của JS chỉ hiểu ký tự ASCII
      const m = cardText.match(/(\d+)\s+đánh giá/i);
      observed.totalReviews = m ? m[0] : null;
      expect.soft(m, 'Phải có dòng "<số> đánh giá"').not.toBeNull();
    });

    await test.step("Expected 2.5: Biểu đồ phân bố 5 -> 1 sao kèm tỷ lệ %", async () => {
      const dist: Record<string, string | null> = {};
      for (const star of [5, 4, 3, 2, 1]) {
        // Mỗi mức sao: nhãn "5" (có thể kèm ký tự ★) rồi tới tỷ lệ "99.9%"
        const re = new RegExp(
          `(?:^|\\n)\\s*[★☆⭐]?\\s*${star}\\s*[★☆⭐]?\\s*\\n?\\s*(\\d+(?:[.,]\\d+)?)\\s*%`,
        );
        const m = cardText.match(re);
        dist[`${star}_sao`] = m ? `${m[1]}%` : null;
        expect
          .soft(m, `Mức ${star} sao phải có tỷ lệ % trong biểu đồ phân bố`)
          .not.toBeNull();
        if (m) {
          const v = parseFloat(m[1].replace(",", "."));
          expect
            .soft(
              v,
              `Tỷ lệ mức ${star} sao phải nằm trong [0, 100], thực tế: ${m[1]}`,
            )
            .toBeGreaterThanOrEqual(0);
          expect
            .soft(
              v,
              `Tỷ lệ mức ${star} sao phải nằm trong [0, 100], thực tế: ${m[1]}`,
            )
            .toBeLessThanOrEqual(100);
        }
      }
      observed.distribution = dist;
      // (Tổng % = 100 và khớp danh sách đánh giá được kiểm tra ở Review_View_02.)
    });

    await test.step("Expected 2.6: Nút [Viết đánh giá]", async () => {
      const writeBtn = page.getByText(/Viết đánh giá/i).first();
      await writeBtn.scrollIntoViewIfNeeded().catch(() => {});
      await expect
        .soft(writeBtn, "Nút [Viết đánh giá] phải hiển thị")
        .toBeVisible(SOFT);
      await expect
        .soft(writeBtn, "Nút [Viết đánh giá] phải bấm được (không bị vô hiệu)")
        .toBeEnabled(SOFT);
    });

    // ------------------------------------------------------------------
    // Đính kèm bằng chứng vào báo cáo
    // ------------------------------------------------------------------
    await attachText(
      "Review_View_01_so_lieu_ghi_nhan",
      JSON.stringify(observed, null, 2),
    );
    console.log("[Review_View_01] Số liệu ghi nhận:", JSON.stringify(observed));
    await shot(page, "Review_View_01_khoi_tong_quan");
  });

  test("Review_View_02: Kiểm tra tính nhất quán của số liệu thống kê đánh giá", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const TOL = 0.1 + 1e-9; // sai số làm tròn cho phép theo test case (<= 0,1%)

    // Pre-condition: chưa đăng nhập -> đặt ở đầu describe nhóm VIEW:
    // test.use({ storageState: { cookies: [], origins: [] } });

    // ------------------------------------------------------------------
    // Mở trang + cuộn tới khu vực đánh giá
    // ------------------------------------------------------------------
    await page.goto(PRODUCT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await dismissPopups(page);

    const header = page
      .getByText(/Đánh giá Nồi cơm điện tử Kangaroo 1\.8 lít KGRC18D3G/i)
      .first();

    await page.evaluate(async () => {
      for (let i = 0; i < 8; i++) {
        window.scrollBy(0, 700);
        await new Promise((r) => setTimeout(r, 200));
      }
    });
    await header.waitFor({ state: "attached", timeout: 15000 });
    await header.scrollIntoViewIfNeeded();
    await dismissPopups(page);

    // Nếu danh sách có nút "Xem thêm ... đánh giá" thì bấm để tải đủ (chỉ đọc, không đổi dữ liệu)
    for (let i = 0; i < 5; i++) {
      const moreBtn = page
        .getByRole("button", { name: /Xem thêm.*đánh giá/i })
        .first();
      if (!(await moreBtn.isVisible().catch(() => false))) break;
      await moreBtn.click().catch(() => {});
      await page.waitForTimeout(800);
    }

    const block = header.locator(
      'xpath=ancestor::div[contains(., "khách hài lòng")][1]',
    );
    await expect(block, "Phải xác định được thẻ khối đánh giá").toBeVisible({
      timeout: 15000,
    });

    const cardText = ((await block.innerText()) || "").replace(/\u00a0/g, " ");
    await attachText("Review_View_02_card_text", cardText);

    // ------------------------------------------------------------------
    // Step 1 / Expected 1: Ghi lại điểm trung bình, số đánh giá, % từng mức sao
    // ------------------------------------------------------------------
    let avgScore = NaN;
    let totalReviews = NaN;
    let pct: number[] = []; // pct[0] = 5 sao, ..., pct[4] = 1 sao (đúng thứ tự hiển thị)

    await test.step("Step 1: Ghi lại điểm trung bình, số đánh giá, % từng mức sao", async () => {
      const mScore = cardText.match(/(\d+(?:[.,]\d+)?)\s*\/\s*5(?!\d)/);
      avgScore = mScore ? parseFloat(mScore[1].replace(",", ".")) : NaN;
      expect
        .soft(
          Number.isNaN(avgScore),
          'Phải ghi nhận được điểm trung bình "X.X/5"',
        )
        .toBe(false);

      // Không dùng \b sau "giá" vì \b của JS chỉ hiểu ký tự ASCII
      const mTotal = cardText.match(/(\d+)\s+đánh giá/i);
      totalReviews = mTotal ? parseInt(mTotal[1], 10) : NaN;
      expect
        .soft(Number.isNaN(totalReviews), 'Phải ghi nhận được số "N đánh giá"')
        .toBe(false);

      // Tỷ lệ % của biểu đồ nằm trước đánh giá đầu tiên (trước chữ "Hữu ích" đầu tiên)
      const summaryPart = cardText.split(/Hữu ích/i)[0];
      const percents = summaryPart.match(/\d+(?:[.,]\d+)?\s*%/g) ?? [];
      pct = percents
        .slice(0, 5)
        .map((p) => parseFloat(p.replace("%", "").replace(",", ".")));
      expect
        .soft(
          pct.length,
          `Phải ghi nhận đủ 5 tỷ lệ % (5→1 sao), thực tế: [${percents.join(", ")}]`,
        )
        .toBe(5);
    });

    // ------------------------------------------------------------------
    // Step 2: Đếm số đánh giá trong danh sách và đối chiếu số sao từng đánh giá
    // ------------------------------------------------------------------
    type ListReview = { name: string; stars: number; rowHtml: string };
    let reviews: ListReview[] = [];

    await test.step("Step 2: Đọc danh sách đánh giá và số sao từng đánh giá", async () => {
      reviews = await block.evaluate((root): ListReview[] => {
        // Chữ ký hiển thị của 1 ngôi sao: sao tô màu và sao xám có chữ ký khác nhau
        const sig = (el: Element) => {
          const cs = getComputedStyle(el);
          const child = el.firstElementChild
            ? getComputedStyle(el.firstElementChild).fill
            : "";
          const isSvg = el.tagName.toLowerCase() === "svg";
          return [
            el.tagName,
            el.getAttribute("class") ?? "",
            el.getAttribute("src") ?? "",
            el.getAttribute("data-src") ?? "",
            el.getAttribute("fill") ?? "",
            (el.textContent ?? "").trim().slice(0, 2),
            cs.color,
            cs.fill,
            cs.backgroundColor,
            cs.backgroundImage,
            cs.opacity,
            cs.filter,
            child,
            isSvg ? el.innerHTML.slice(0, 300) : "",
          ].join("|");
        };

        // Hàng 5 ngôi sao: phần tử có đúng 5 con, mỗi con gần như không có chữ
        const isStarRow = (el: Element) => {
          const kids = Array.from(el.children);
          return (
            kids.length === 5 &&
            kids.every((k) => (k.textContent ?? "").trim().length <= 1)
          );
        };

        // Các nút/nhãn "Hữu ích" (mỗi đánh giá có 1 nút)
        const isHelpful = (e: Element) =>
          /^\s*Hữu ích(\s*\(\d+\))?\s*$/i.test(e.textContent ?? "");
        const helpfuls = Array.from(root.querySelectorAll("*")).filter(
          (e) => isHelpful(e) && !Array.from(e.children).some(isHelpful),
        );

        // Từ mỗi nút [Hữu ích] đi ngược lên container nhỏ nhất có chứa hàng 5 sao => 1 đánh giá
        const items = new Map<Element, Element>();
        for (const h of helpfuls) {
          let cur: Element | null = h.parentElement;
          for (let i = 0; i < 10 && cur && cur !== root.parentElement; i++) {
            const row = Array.from(cur.querySelectorAll("*")).find(isStarRow);
            if (row) {
              if (!items.has(cur)) items.set(cur, row);
              break;
            }
            cur = cur.parentElement;
          }
        }

        return Array.from(items.entries()).map(([item, row]) => {
          const kids = Array.from(row.children);
          const first = sig(kids[0]);
          let stars = 0; // sao tô màu luôn nằm liên tiếp từ sao thứ 1
          for (const k of kids) {
            if (sig(k) === first) stars++;
            else break;
          }
          const name =
            ((item as HTMLElement).innerText || "")
              .split("\n")
              .map((s) => s.trim())
              .find(Boolean) ?? "";
          return { name, stars, rowHtml: row.outerHTML.slice(0, 600) };
        });
      });

      await attachText(
        "Review_View_02_danh_sach_danh_gia",
        JSON.stringify(reviews, null, 2),
      );
      expect
        .soft(
          reviews.length,
          "Phải đọc được ít nhất 1 đánh giá trong danh sách",
        )
        .toBeGreaterThan(0);
    });

    const countInList: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const r of reviews)
      if (r.stars >= 1 && r.stars <= 5) countInList[r.stars]++;

    // ------------------------------------------------------------------
    // Expected 2: số đánh giá và phân bố sao khớp với danh sách đánh giá hiển thị
    // ------------------------------------------------------------------
    await test.step("Expected 2a: Số đánh giá hiển thị khớp số đánh giá trong danh sách", async () => {
      expect
        .soft(
          reviews.length,
          `Số đánh giá trong danh sách (${reviews.length}) phải bằng số "N đánh giá" hiển thị (${totalReviews})`,
        )
        .toBe(totalReviews);
    });

    await test.step("Expected 2b: Có đánh giá X sao thì mức X sao phải > 0%", async () => {
      if (pct.length !== 5) return;
      for (const star of [5, 4, 3, 2, 1]) {
        if (countInList[star] > 0) {
          expect
            .soft(
              pct[5 - star],
              `Danh sách có ${countInList[star]} đánh giá ${star} sao nhưng biểu đồ hiển thị mức ${star} sao = ${pct[5 - star]}%`,
            )
            .toBeGreaterThan(0);
        }
      }
    });

    // ------------------------------------------------------------------
    // Step 3 / Expected 3: Tổng % = 100% (sai số <= 0,1%); điểm trung bình khớp phân bố
    // ------------------------------------------------------------------
    await test.step("Expected 3a: Tổng % các mức sao = 100% (sai số <= 0,1%)", async () => {
      const sum = pct.reduce((a, b) => a + b, 0);
      expect
        .soft(
          Math.abs(sum - 100),
          `Tổng % = ${sum.toFixed(2)}%, phải bằng 100% (sai số <= 0,1%)`,
        )
        .toBeLessThanOrEqual(TOL);
    });

    await test.step("Expected 3b: Điểm trung bình khớp với phân bố sao", async () => {
      if (pct.length !== 5 || Number.isNaN(avgScore)) return;
      const fromChart =
        [5, 4, 3, 2, 1].reduce((acc, s) => acc + s * pct[5 - s], 0) / 100;
      expect
        .soft(
          Math.abs(fromChart - avgScore),
          `Điểm hiển thị ${avgScore} khác điểm tính từ phân bố ${fromChart.toFixed(2)} (sai số cho phép 0,1)`,
        )
        .toBeLessThanOrEqual(TOL);
    });

    // ------------------------------------------------------------------
    // Đính kèm số liệu ghi nhận + ảnh chụp
    // ------------------------------------------------------------------
    const summary = {
      avgScore,
      totalReviews,
      percentByStar: {
        "5": pct[0],
        "4": pct[1],
        "3": pct[2],
        "2": pct[3],
        "1": pct[4],
      },
      sumPercent: pct.reduce((a, b) => a + b, 0),
      reviewsInList: reviews.length,
      countInList,
    };
    await attachText(
      "Review_View_02_thong_ke",
      JSON.stringify(summary, null, 2),
    );
    console.log("[Review_View_02] Số liệu ghi nhận:", JSON.stringify(summary));
    await shot(page, "Review_View_02_tinh_nhat_quan");
  });

  test("Review_View_03: Kiểm tra nội dung hiển thị của mỗi đánh giá", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Pre-condition: chưa đăng nhập -> đặt ở đầu describe nhóm VIEW:
    // test.use({ storageState: { cookies: [], origins: [] } });

    // ------------------------------------------------------------------
    // Mở trang + cuộn tới khu vực đánh giá
    // ------------------------------------------------------------------
    await page.goto(PRODUCT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await dismissPopups(page);

    const header = page
      .getByText(/Đánh giá Nồi cơm điện tử Kangaroo 1\.8 lít KGRC18D3G/i)
      .first();

    await page.evaluate(async () => {
      for (let i = 0; i < 8; i++) {
        window.scrollBy(0, 700);
        await new Promise((r) => setTimeout(r, 200));
      }
    });
    await header.waitFor({ state: "attached", timeout: 15000 });
    await header.scrollIntoViewIfNeeded();
    await dismissPopups(page);

    // Nếu danh sách có nút "Xem thêm ... đánh giá" thì bấm để tải đủ (chỉ đọc, không đổi dữ liệu)
    for (let i = 0; i < 5; i++) {
      const moreBtn = page
        .getByRole("button", { name: /Xem thêm.*đánh giá/i })
        .first();
      if (!(await moreBtn.isVisible().catch(() => false))) break;
      await moreBtn.click().catch(() => {});
      await page.waitForTimeout(800);
    }

    const block = header.locator(
      'xpath=ancestor::div[contains(., "khách hài lòng")][1]',
    );
    await expect(block, "Phải xác định được thẻ khối đánh giá").toBeVisible({
      timeout: 15000,
    });

    // ------------------------------------------------------------------
    // Step 1: Đọc lần lượt từng đánh giá trong danh sách
    // ------------------------------------------------------------------
    type ReviewData = {
      text: string;
      filledMask: boolean[];
      iconCount: number;
      rowHtml: string;
    };
    let reviews: ReviewData[] = [];

    await test.step("Step 1: Đọc lần lượt từng đánh giá trong danh sách", async () => {
      reviews = await block.evaluate((root): ReviewData[] => {
        // Chữ ký hiển thị của 1 ngôi sao: sao tô màu và sao xám có chữ ký khác nhau
        const sig = (el: Element) => {
          const cs = getComputedStyle(el);
          const child = el.firstElementChild
            ? getComputedStyle(el.firstElementChild).fill
            : "";
          const isSvg = el.tagName.toLowerCase() === "svg";
          return [
            el.tagName,
            el.getAttribute("class") ?? "",
            el.getAttribute("src") ?? "",
            el.getAttribute("data-src") ?? "",
            el.getAttribute("fill") ?? "",
            (el.textContent ?? "").trim().slice(0, 2),
            cs.color,
            cs.fill,
            cs.backgroundColor,
            cs.backgroundImage,
            cs.opacity,
            cs.filter,
            child,
            isSvg ? el.innerHTML.slice(0, 300) : "",
          ].join("|");
        };

        // Hàng 5 ngôi sao: phần tử có đúng 5 con, mỗi con gần như không có chữ
        const isStarRow = (el: Element) => {
          const kids = Array.from(el.children);
          return (
            kids.length === 5 &&
            kids.every((k) => (k.textContent ?? "").trim().length <= 1)
          );
        };

        // Mỗi đánh giá có 1 nút/nhãn "Hữu ích" -> dùng làm mốc nhận diện từng đánh giá
        const isHelpful = (e: Element) =>
          /^\s*Hữu ích(\s*\(\d+\))?\s*$/i.test(e.textContent ?? "");
        const helpfuls = Array.from(root.querySelectorAll("*")).filter(
          (e) => isHelpful(e) && !Array.from(e.children).some(isHelpful),
        );

        // Từ mỗi nút [Hữu ích] đi ngược lên container nhỏ nhất có chứa hàng 5 sao => 1 đánh giá
        const items = new Map<Element, Element>();
        for (const h of helpfuls) {
          let cur: Element | null = h.parentElement;
          for (let i = 0; i < 10 && cur && cur !== root.parentElement; i++) {
            const row = Array.from(cur.querySelectorAll("*")).find(isStarRow);
            if (row) {
              if (!items.has(cur)) items.set(cur, row);
              break;
            }
            cur = cur.parentElement;
          }
        }

        return Array.from(items.entries()).map(([item, row]) => {
          const kids = Array.from(row.children);
          const first = sig(kids[0]);
          const filledMask = kids.map((k) => sig(k) === first); // sao tô màu = giống sao thứ 1
          return {
            text: ((item as HTMLElement).innerText || "").replace(
              /\u00a0/g,
              " ",
            ),
            filledMask,
            iconCount: kids.length,
            rowHtml: row.outerHTML.slice(0, 400),
          };
        });
      });

      await attachText(
        "Review_View_03_danh_sach_tho",
        JSON.stringify(reviews, null, 2),
      );
      expect(
        reviews.length,
        "Phải đọc được ít nhất 1 đánh giá trong danh sách",
      ).toBeGreaterThan(0);
    });

    // ------------------------------------------------------------------
    // Expected: kiểm tra nội dung hiển thị của MỖI đánh giá
    // ------------------------------------------------------------------
    const observed: Record<string, unknown>[] = [];

    for (let i = 0; i < reviews.length; i++) {
      const r = reviews[i];
      const lines = r.text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      // --- Phân loại từng dòng của đánh giá ---
      const name = lines[0] ?? "";
      const reTag = /^Đã mua tại ĐMX$/i;
      const reHelpful = /^Hữu ích$/i;
      const reCount = /^\(\s*\d+\s*\)$/;
      const reUsage = /^Đã dùng\b.*/i;
      const reResponse =
        /(chuyển tới bộ phận|Bộ phận .*(liên hệ|hỗ trợ)|phản hồi)/i;
      const reMore = /^Xem thêm$/i;

      const bought = lines.some((l) => reTag.test(l));
      const usageLine = lines.find((l) => reUsage.test(l)) ?? "";
      const responseLines = lines.filter(
        (l) => reResponse.test(l) && !reUsage.test(l),
      );
      const contentLines = lines
        .slice(1)
        .filter(
          (l) =>
            !reTag.test(l) &&
            !reHelpful.test(l) &&
            !reCount.test(l) &&
            !reUsage.test(l) &&
            !reResponse.test(l) &&
            !reMore.test(l),
        );
      const content = contentLines.join(" ");
      const helpfulOk = /Hữu ích\s*\(\s*\d+\s*\)/i.test(r.text);
      const helpfulText = (r.text.match(/Hữu ích\s*\(\s*\d+\s*\)/i) ?? [
        "",
      ])[0].replace(/\s+/g, " ");

      // Số sao: các sao tô màu phải liền nhau bắt đầu từ sao thứ 1
      const stars = r.filledMask.filter(Boolean).length;
      const expectedMask = r.filledMask.map((_, idx) => idx < stars);
      const contiguous = r.filledMask.every(
        (v, idx) => v === expectedMask[idx],
      );

      observed.push({
        stt: i + 1,
        name,
        bought,
        stars,
        content,
        usageLine,
        helpfulText,
        hasResponse: responseLines.length > 0,
        responseLines,
      });

      await test.step(`Đánh giá #${i + 1}: ${name || "(không có tên)"}`, async () => {
        // 1. Tên người đánh giá
        expect
          .soft(name.length, `Đánh giá #${i + 1}: phải có tên người đánh giá`)
          .toBeGreaterThan(0);

        // 2. Nhãn "Đã mua tại ĐMX" (nếu đã mua) -> nếu có thì phải hiển thị
        if (bought) {
          await expect
            .soft(
              block.getByText(/Đã mua tại ĐMX/i).nth(i),
              `Đánh giá #${i + 1} (${name}): nhãn [Đã mua tại ĐMX] phải hiển thị`,
            )
            .toBeVisible({ timeout: 3000 });
        }

        // 3. Số sao: có đủ 5 biểu tượng, ít nhất 1 sao tô màu, sao tô màu liền nhau từ sao thứ 1
        expect
          .soft(
            r.iconCount,
            `Đánh giá #${i + 1} (${name}): phải có 5 biểu tượng ngôi sao`,
          )
          .toBe(5);
        expect
          .soft(
            stars,
            `Đánh giá #${i + 1} (${name}): phải có ít nhất 1 sao được tô màu`,
          )
          .toBeGreaterThanOrEqual(1);
        expect
          .soft(
            contiguous,
            `Đánh giá #${i + 1} (${name}): các sao tô màu phải liền nhau từ sao thứ 1`,
          )
          .toBe(true);

        // 4. Nội dung đánh giá
        expect
          .soft(
            content.length,
            `Đánh giá #${i + 1} (${name}): phải có nội dung đánh giá`,
          )
          .toBeGreaterThan(0);

        // 5. Thời gian sử dụng (ví dụ "Đã dùng khoảng 1 tuần")
        expect
          .soft(
            usageLine,
            `Đánh giá #${i + 1} (${name}): phải có dòng thời gian sử dụng "Đã dùng ..."`,
          )
          .not.toBe("");

        // 6. Nút [Hữu ích] kèm số lượng
        expect
          .soft(
            helpfulOk,
            `Đánh giá #${i + 1} (${name}): phải có nút [Hữu ích] kèm số lượng dạng "Hữu ích (n)"`,
          )
          .toBe(true);

        // 7. Nếu có phản hồi thì hiển thị dòng phản hồi
        for (const line of responseLines) {
          await expect
            .soft(
              block.getByText(line, { exact: false }).first(),
              `Đánh giá #${i + 1} (${name}): dòng phản hồi "${line}" phải hiển thị`,
            )
            .toBeVisible({ timeout: 3000 });
        }
      });
    }

    // ------------------------------------------------------------------
    // Đính kèm số liệu ghi nhận + ảnh chụp
    // ------------------------------------------------------------------
    await attachText(
      "Review_View_03_noi_dung_tung_danh_gia",
      JSON.stringify(observed, null, 2),
    );
    console.log(
      "[Review_View_03] Đã kiểm tra",
      reviews.length,
      "đánh giá:",
      JSON.stringify(observed),
    );
    await shot(page, "Review_View_03_chi_tiet_danh_gia");
  });

  test("Review_View_04: Kiểm tra hiển thị đánh giá có nội dung dài", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const REVIEWER = "Trương Quyết";

    // Pre-condition: chưa đăng nhập -> đặt ở đầu describe nhóm VIEW:
    // test.use({ storageState: { cookies: [], origins: [] } });

    // ------------------------------------------------------------------
    // Mở trang + cuộn tới khu vực đánh giá
    // ------------------------------------------------------------------
    await page.goto(PRODUCT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await dismissPopups(page);

    const header = page
      .getByText(/Đánh giá Nồi cơm điện tử Kangaroo 1\.8 lít KGRC18D3G/i)
      .first();

    await page.evaluate(async () => {
      for (let i = 0; i < 8; i++) {
        window.scrollBy(0, 700);
        await new Promise((r) => setTimeout(r, 200));
      }
    });
    await header.waitFor({ state: "attached", timeout: 15000 });
    await header.scrollIntoViewIfNeeded();
    await dismissPopups(page);

    // Nếu danh sách có nút "Xem thêm ... đánh giá" thì bấm để tải đủ (chỉ đọc, không đổi dữ liệu)
    for (let i = 0; i < 5; i++) {
      const moreBtn = page
        .getByRole("button", { name: /Xem thêm.*đánh giá/i })
        .first();
      if (!(await moreBtn.isVisible().catch(() => false))) break;
      await moreBtn.click().catch(() => {});
      await page.waitForTimeout(800);
    }

    const block = header.locator(
      'xpath=ancestor::div[contains(., "khách hài lòng")][1]',
    );
    await expect(block, "Phải xác định được thẻ khối đánh giá").toBeVisible({
      timeout: 15000,
    });

    // ------------------------------------------------------------------
    // Step 1: Xem đánh giá của "Trương Quyết" (nội dung dài ~300 ký tự)
    // ------------------------------------------------------------------
    // Đánh giá = div nhỏ nhất chứa tên người đánh giá và nút [Hữu ích]
    const item = block
      .locator(
        `xpath=.//*[normalize-space(text())="${REVIEWER}"]/ancestor::div[.//*[contains(text(),"Hữu ích")]][1]`,
      )
      .first();

    await test.step(`Step 1: Tìm đánh giá của "${REVIEWER}"`, async () => {
      await expect(
        item,
        `Phải có đánh giá của "${REVIEWER}" trong danh sách`,
      ).toBeVisible({ timeout: 15000 });
      await item.scrollIntoViewIfNeeded();
    });

    // Đo hiển thị của đánh giá (kích thước, tràn khung, đè nút...) ngay trên trình duyệt
    type Metrics = {
      found: boolean;
      text: string;
      length: number;
      clamped: boolean; // nội dung bị cắt bớt bởi chiều cao (line-clamp / max-height)
      overflowX: boolean; // chữ tràn ngang bên trong chính ô nội dung
      whiteSpace: string;
      lines: number; // số dòng hiển thị (ước lượng)
      insideFrame: boolean; // ô nội dung nằm trọn trong khung đánh giá / thẻ đánh giá
      overlapsHelpful: boolean; // ô nội dung đè lên nút [Hữu ích]
      helpfulFound: boolean;
      helpfulVisible: boolean;
    };

    const measure = (): Promise<Metrics> =>
      item.evaluate((el: HTMLElement, name: string): Metrics => {
        const R = (e: Element) => e.getBoundingClientRect();
        const skip = [
          /^Đã mua tại ĐMX$/i,
          /^Hữu ích/i,
          /^\(\s*\d+\s*\)$/,
          /^Đã dùng\b/i,
          /(chuyển tới bộ phận|Bộ phận .*(liên hệ|hỗ trợ))/i,
          /^Xem thêm$/i,
        ];
        const inlineTags = [
          "BR",
          "SPAN",
          "B",
          "I",
          "EM",
          "STRONG",
          "A",
          "SMALL",
          "U",
        ];

        // Ô nội dung = phần tử chỉ chứa chữ/inline, có đoạn chữ dài nhất (bỏ tên, nhãn, hữu ích, thời gian dùng, phản hồi)
        let best: HTMLElement | null = null;
        let bestLen = 0;
        for (const e of Array.from(el.querySelectorAll<HTMLElement>("*"))) {
          if (
            !Array.from(e.children).every((k) => inlineTags.includes(k.tagName))
          )
            continue;
          const t = (e.innerText || "").replace(/\u00a0/g, " ").trim();
          if (!t || t === name || skip.some((re) => re.test(t))) continue;
          const len = t.replace(/\s*Xem thêm\s*$/i, "").trim().length;
          if (len > bestLen) {
            best = e;
            bestLen = len;
          }
        }

        const empty: Metrics = {
          found: false,
          text: "",
          length: 0,
          clamped: false,
          overflowX: false,
          whiteSpace: "",
          lines: 0,
          insideFrame: false,
          overlapsHelpful: false,
          helpfulFound: false,
          helpfulVisible: false,
        };
        if (!best) return empty;

        const cs = getComputedStyle(best);
        const cr = R(best);
        const lh =
          parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4 || 20;

        // Khung: chính đánh giá và thẻ đánh giá tổng (ancestor chứa "khách hài lòng")
        const itemR = R(el);
        let card: Element | null = el.parentElement;
        while (card && !/khách hài lòng/i.test(card.textContent || ""))
          card = card.parentElement;
        const cardR = card ? R(card) : itemR;
        const tol = 1;
        const within = (outer: DOMRect, inner: DOMRect) =>
          inner.left >= outer.left - tol && inner.right <= outer.right + tol;
        const insideFrame = within(itemR, cr) && within(cardR, cr);

        // Nút [Hữu ích] (phần tử nhỏ nhất có chữ "Hữu ích", ưu tiên thẻ button bao ngoài)
        const isH = (e: Element) =>
          /^\s*Hữu ích(\s*\(\s*\d+\s*\))?\s*$/i.test(
            (e as HTMLElement).innerText || "",
          );
        const hs = Array.from(el.querySelectorAll("*")).filter(
          (e) => isH(e) && !Array.from(e.children).some(isH),
        );
        const hEl = hs.length ? (hs[0].closest("button") ?? hs[0]) : null;
        let overlaps = false;
        let hVisible = false;
        if (hEl) {
          const hr = R(hEl);
          hVisible = hr.width > 0 && hr.height > 0;
          overlaps = !(
            cr.right <= hr.left + tol ||
            cr.left >= hr.right - tol ||
            cr.bottom <= hr.top + tol ||
            cr.top >= hr.bottom - tol
          );
        }

        return {
          found: true,
          text: (best.innerText || "").replace(/\u00a0/g, " ").trim(),
          length: bestLen,
          clamped: best.scrollHeight > best.clientHeight + 1,
          overflowX: best.scrollWidth > best.clientWidth + 1,
          whiteSpace: cs.whiteSpace,
          lines: Math.max(1, Math.round(cr.height / lh)),
          insideFrame,
          overlapsHelpful: overlaps,
          helpfulFound: !!hEl,
          helpfulVisible: hVisible,
        };
      }, REVIEWER);

    // ------------------------------------------------------------------
    // Expected: Nội dung hiển thị đầy đủ hoặc có [Xem thêm]
    // ------------------------------------------------------------------
    let m: Metrics = await measure();
    await attachText(
      "Review_View_04_truoc_khi_xem_them",
      JSON.stringify(m, null, 2),
    );
    await shot(page, "Review_View_04_noi_dung_dai");

    await test.step("Expected 1: Nội dung hiển thị đầy đủ hoặc có [Xem thêm]", async () => {
      expect
        .soft(m.found, `Phải đọc được nội dung đánh giá của "${REVIEWER}"`)
        .toBe(true);
      expect
        .soft(
          m.length,
          `Nội dung của "${REVIEWER}" phải là nội dung dài (~300 ký tự), thực tế: ${m.length}`,
        )
        .toBeGreaterThanOrEqual(200);

      const moreLink = item.getByText(/^\s*Xem thêm\s*$/i).first();
      const hasMore = await moreLink.isVisible().catch(() => false);

      if (hasMore) {
        // Trường hợp có [Xem thêm]: bấm để mở rộng và nội dung phải hiển thị đầy đủ hơn
        const lenBefore = m.length;
        await moreLink.click().catch(() => {});
        await page.waitForTimeout(600);
        m = await measure();
        await attachText(
          "Review_View_04_sau_khi_xem_them",
          JSON.stringify(m, null, 2),
        );
        expect
          .soft(
            m.length > lenBefore || !m.clamped,
            "Sau khi bấm [Xem thêm], nội dung phải được mở rộng đầy đủ hơn",
          )
          .toBe(true);
      }

      // Không có [Xem thêm] (hoặc đã mở rộng) -> nội dung phải hiển thị trọn vẹn, không bị cắt
      expect
        .soft(
          m.clamped,
          "Nội dung không được bị cắt bớt (cao hơn khung hiển thị)",
        )
        .toBe(false);
      expect
        .soft(
          /(\.\.\.|…)\s*$/.test(m.text.replace(/\s*Xem thêm\s*$/i, "")),
          'Nội dung đã hiển thị không được kết thúc bằng dấu "..." (bị cắt)',
        )
        .toBe(false);
    });

    // ------------------------------------------------------------------
    // Expected: xuống dòng đúng, không tràn khỏi khung
    // ------------------------------------------------------------------
    await test.step("Expected 2: Xuống dòng đúng, không tràn khỏi khung", async () => {
      expect
        .soft(
          m.whiteSpace,
          "Nội dung không được cấu hình không xuống dòng (nowrap)",
        )
        .not.toBe("nowrap");
      expect
        .soft(
          m.lines,
          `Nội dung dài phải được xuống dòng thành nhiều dòng, thực tế: ${m.lines} dòng`,
        )
        .toBeGreaterThan(1);
      expect
        .soft(m.overflowX, "Chữ không được tràn ngang ra ngoài ô nội dung")
        .toBe(false);
      expect
        .soft(m.insideFrame, "Nội dung không được tràn ra ngoài khung đánh giá")
        .toBe(true);
    });

    // ------------------------------------------------------------------
    // Expected: không đè lên nút [Hữu ích]
    // ------------------------------------------------------------------
    await test.step("Expected 3: Không đè lên nút [Hữu ích]", async () => {
      expect
        .soft(m.helpfulFound, "Phải có nút [Hữu ích] trong đánh giá")
        .toBe(true);
      expect
        .soft(m.helpfulVisible, "Nút [Hữu ích] phải hiển thị (có kích thước)")
        .toBe(true);
      expect
        .soft(m.overlapsHelpful, "Nội dung không được đè lên nút [Hữu ích]")
        .toBe(false);
      await expect
        .soft(
          item.getByText(/Hữu ích/i).first(),
          "Nút [Hữu ích] phải nhìn thấy được, không bị che",
        )
        .toBeVisible({ timeout: 3000 });
    });

    // ------------------------------------------------------------------
    // Đính kèm số liệu ghi nhận + ảnh chụp
    // ------------------------------------------------------------------
    await attachText(
      "Review_View_04_so_lieu_ghi_nhan",
      JSON.stringify(m, null, 2),
    );
    console.log(
      "[Review_View_04] Số liệu ghi nhận:",
      JSON.stringify({ ...m, text: m.text.slice(0, 80) + "..." }),
    );
    await shot(page, "Review_View_04_sau_kiem_tra");
  });

  test("Review_View_05: Kiểm tra sản phẩm chưa có đánh giá nào", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Pre-condition: chưa đăng nhập -> đặt ở đầu describe nhóm VIEW:
    // test.use({ storageState: { cookies: [], origins: [] } });

    // Pre-condition: sản phẩm chưa có đánh giá nào (đã xác định thủ công)
    const NO_REVIEW_URL =
      "https://www.dienmayxanh.com/tui-chong-soc/balo-laptop-15-inch-jansport-cool-student-34l-xanh-navy";
    const NO_REVIEW_NAME =
      "Balo Laptop 15 inch Jansport Cool Student 34L Xanh Navy";

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // ------------------------------------------------------------------
    // Step 1: Mở trang sản phẩm chưa có đánh giá
    // ------------------------------------------------------------------
    let status = 0;

    await test.step("Step 1: Mở trang sản phẩm chưa có đánh giá", async () => {
      const res = await page.goto(NO_REVIEW_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      status = res?.status() ?? 0;
      expect(
        status,
        "Trang sản phẩm không được trả về lỗi 4xx/5xx",
      ).toBeLessThan(400);
      await dismissPopups(page);
    });

    // ------------------------------------------------------------------
    // Step 1 (tiếp): Cuộn dần tới hết trang để kích hoạt lazy-load khu vực đánh giá
    // ------------------------------------------------------------------
    await test.step("Step 1: Cuộn tới khu vực đánh giá", async () => {
      await page.evaluate(async () => {
        let lastHeight = -1;
        for (let i = 0; i < 60; i++) {
          window.scrollBy(0, 600);
          await new Promise((r) => setTimeout(r, 250));
          const h = document.documentElement.scrollHeight;
          const atBottom = window.scrollY + window.innerHeight >= h - 5;
          if (atBottom) {
            if (h === lastHeight) break;
            lastHeight = h;
            await new Promise((r) => setTimeout(r, 800));
          }
        }
      });
      await page.waitForTimeout(1500);
      await dismissPopups(page);
    });

    // ------------------------------------------------------------------
    // Đọc nội dung khu vực đánh giá từ chữ hiển thị của trang
    // ------------------------------------------------------------------
    const bodyText = ((await page.locator("body").innerText()) || "").replace(
      /\u00a0/g,
      " ",
    );
    const lines = bodyText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    // Tiêu đề khu vực: "Đánh giá <tên sản phẩm>" (có đánh giá) hoặc "Đánh giá sản phẩm này" (chưa có đánh giá)
    let start = -1;
    lines.forEach((l, i) => {
      if (/^Đánh giá\s+\S+/.test(l)) start = i;
    });

    // Vùng đọc dừng ở nhãn sao cuối "Rất tốt" (dải chọn sao khi chưa có đánh giá),
    // hoặc nút "Viết đánh giá", hoặc mục khác của trang (giá, hỏi đáp, ...) -> không lấy nhầm số % của phần giá
    const region: string[] = [];
    if (start >= 0) {
      for (let i = start; i < Math.min(lines.length, start + 40); i++) {
        if (
          i > start &&
          /^(Hỏi đáp|Bình luận|Sản phẩm liên quan|Có thể bạn|Giá tại)/i.test(
            lines[i],
          )
        )
          break;
        region.push(lines[i]);
        if (/^(Viết đánh giá|Rất tốt)$/i.test(lines[i])) break;
      }
    }
    const regionText = region.join("\n");
    const hasSection = start >= 0;

    await attachText(
      "Review_View_05_cac_dong_chua_danh_gia",
      lines.filter((l) => /đánh giá/i.test(l)).join("\n") ||
        "(không có dòng nào)",
    );
    await attachText(
      "Review_View_05_noi_dung_khu_vuc_danh_gia",
      regionText || "(không tìm thấy khu vực đánh giá)",
    );

    // Phân tích khu vực đánh giá
    const hasReviewItems =
      /Hữu ích/i.test(regionText) || /Đã mua tại ĐMX/i.test(regionText);
    const hasScore = /\d+(?:[.,]\d+)?\s*\/\s*5(?!\d)/.test(regionText);
    const hasPercentChart = /\d+(?:[.,]\d+)?\s*%/.test(regionText);
    const hasSatisfied = /khách hài lòng/i.test(regionText);
    const hasStats = hasScore || hasPercentChart || hasSatisfied;
    const hasEmptyWording =
      /chưa có (đánh giá|nhận xét)|hãy là người (đầu tiên|đánh giá)|hãy đánh giá ngay|không có đánh giá|nếu đã mua|0\s+đánh giá/i.test(
        regionText,
      );

    // Trang chưa có đánh giá hiện dải chọn sao (Rất tệ, Tệ, Tạm ổn, Tốt, Rất tốt) làm lối vào viết đánh giá
    const starLabels = ["Rất tệ", "Tệ", "Tạm ổn", "Tốt", "Rất tốt"];
    const starPromptFound = starLabels.every((l) =>
      new RegExp(`(^|\\n)${l}(\\n|$)`).test(regionText),
    );

    // Lối vào viết đánh giá: nút chữ [Viết đánh giá] hoặc dải chọn sao
    const writeBtn = page
      .getByRole("button", { name: /Viết đánh giá/i })
      .first();
    const writeBtnFound = (await writeBtn.count()) > 0;
    const entryFound = writeBtnFound || starPromptFound;

    // ------------------------------------------------------------------
    // Expected 1: Hiển thị trạng thái chưa có đánh giá
    // ------------------------------------------------------------------
    await test.step("Expected 1: Hiển thị trạng thái chưa có đánh giá", async () => {
      expect.soft(hasSection, "Phải có khu vực đánh giá trên trang").toBe(true);
      expect
        .soft(
          hasReviewItems,
          "Không được hiển thị đánh giá nào trong danh sách (không có nút [Hữu ích], nhãn [Đã mua tại ĐMX])",
        )
        .toBe(false);
      expect
        .soft(
          hasEmptyWording || !hasStats,
          `Phải hiển thị trạng thái chưa có đánh giá (câu mời đánh giá hoặc không có số liệu). Nội dung khu vực: "${regionText.replace(/\s+/g, " ").slice(0, 250)}"`,
        )
        .toBe(true);
    });

    // ------------------------------------------------------------------
    // Expected 2: Không hiển thị điểm/biểu đồ sai như NaN, 0/5
    // ------------------------------------------------------------------
    await test.step("Expected 2: Không hiển thị điểm/biểu đồ sai (NaN, 0/5...)", async () => {
      const scope = regionText || bodyText;
      expect
        .soft(/\bNaN\b/.test(scope), 'Không được hiển thị "NaN"')
        .toBe(false);
      expect
        .soft(
          /\bundefined\b|\bnull\b|\[object Object\]|Infinity/i.test(scope),
          'Không được hiển thị "undefined"/"null"/"Infinity"',
        )
        .toBe(false);
      expect
        .soft(
          /(^|[^\d.])0(?:\.0+)?\s*\/\s*5(?!\d)/.test(scope),
          'Không được hiển thị điểm "0/5"',
        )
        .toBe(false);
      expect
        .soft(
          hasScore || hasPercentChart,
          `Chưa có đánh giá nào nên không được hiển thị điểm trung bình hoặc biểu đồ phân bố (hiện: điểm=${hasScore}, biểu đồ %=${hasPercentChart})`,
        )
        .toBe(false);
    });

    // ------------------------------------------------------------------
    // Expected 3: Vẫn có lối vào viết đánh giá (nút [Viết đánh giá] hoặc dải chọn sao)
    //             -> bấm vào thì mở được popup [Đánh giá sản phẩm]
    // ------------------------------------------------------------------
    let modalOpened = false;
    let modalText = "";

    await test.step("Expected 3: Vẫn có lối vào viết đánh giá", async () => {
      expect
        .soft(
          entryFound,
          'Sản phẩm chưa có đánh giá phải có lối vào viết đánh giá (nút [Viết đánh giá] hoặc dải chọn sao "Rất tệ → Rất tốt")',
        )
        .toBe(true);
      if (!entryFound) return;

      // Ưu tiên nút [Viết đánh giá]; nếu không có thì bấm vào sao "Rất tốt" của dải chọn sao
      const entry = writeBtnFound
        ? writeBtn
        : page.getByText("Rất tốt", { exact: true }).first();
      await entry.scrollIntoViewIfNeeded().catch(() => {});
      await expect
        .soft(entry, "Lối vào viết đánh giá phải hiển thị")
        .toBeVisible({ timeout: 5000 });
      if (!writeBtnFound) {
        // Cả 5 nhãn sao đều phải hiển thị trong dải chọn sao
        for (const l of starLabels) {
          await expect
            .soft(
              page.getByText(l, { exact: true }).first(),
              `Dải chọn sao phải có nhãn "${l}"`,
            )
            .toBeVisible({ timeout: 3000 });
        }
      }
      await shot(page, "Review_View_05_loi_vao_viet_danh_gia");

      // Bấm vào lối vào -> popup [Đánh giá sản phẩm] phải mở ra
      await entry.click({ timeout: 10000 }).catch(async () => {
        await entry.click({ force: true }).catch(() => {});
      });

      const modal = page.locator('.fixed:has-text("Đánh giá sản phẩm")').last();
      modalOpened = await modal.isVisible({ timeout: 8000 }).catch(() => false);
      expect
        .soft(
          modalOpened,
          `Bấm chọn sao phải mở popup [Đánh giá sản phẩm]. URL hiện tại: ${page.url()}`,
        )
        .toBe(true);

      if (modalOpened) {
        modalText = ((await modal.innerText()) || "").replace(/\u00a0/g, " ");
        await attachText("Review_View_05_noi_dung_popup", modalText);
        await shot(page, "Review_View_05_popup_viet_danh_gia");

        // Nội dung popup theo thực tế: tên sản phẩm, 5 sao, ô nhận xét, nút [Gửi đánh giá]
        await expect
          .soft(
            modal.getByText(NO_REVIEW_NAME, { exact: false }).first(),
            "Popup phải hiển thị tên sản phẩm đang đánh giá",
          )
          .toBeVisible({ timeout: 3000 });
        for (const l of starLabels) {
          await expect
            .soft(
              modal.getByText(l, { exact: true }).first(),
              `Popup phải có nhãn sao "${l}"`,
            )
            .toBeVisible({ timeout: 3000 });
        }
        await expect
          .soft(
            modal.locator("textarea").first(),
            "Popup phải có ô nhập nhận xét",
          )
          .toBeVisible({ timeout: 3000 });
        const submitBtn = modal
          .getByRole("button", { name: /Gửi đánh giá/i })
          .first();
        await expect
          .soft(submitBtn, "Popup phải có nút [Gửi đánh giá]")
          .toBeVisible({ timeout: 3000 });
        // Chưa nhập đủ thông tin/đồng ý chính sách -> nút [Gửi đánh giá] bị vô hiệu là hợp lý
        if (await submitBtn.isEnabled().catch(() => false)) {
          note(
            "ux-note",
            "Nút [Gửi đánh giá] đang bấm được dù chưa đồng ý Chính sách dữ liệu cá nhân, cần kiểm tra bằng mắt.",
          );
        }
        // KHÔNG bấm [Gửi đánh giá]: test chỉ đọc, không tạo dữ liệu đánh giá trên website thật
      } else if (
        /dang-nhap/i.test(page.url()) ||
        (await page
          .getByText(/Đăng nhập/i)
          .first()
          .isVisible()
          .catch(() => false))
      ) {
        note(
          "ux-note",
          "Bấm chọn sao khi chưa đăng nhập: website yêu cầu đăng nhập thay vì mở popup, cần đối chiếu với kỳ vọng.",
        );
      }

      // Đóng popup, không gửi gì
      await closeReviewModal(page);
      if (modalOpened) {
        await expect
          .soft(
            page.locator('.fixed:has-text("Đánh giá sản phẩm")').last(),
            "Sau khi bấm ✕, popup phải đóng lại",
          )
          .toBeHidden({ timeout: 5000 });
      }
    });

    // ------------------------------------------------------------------
    // Expected 4: Không lỗi
    // ------------------------------------------------------------------
    await test.step("Expected 4: Trang không lỗi", async () => {
      expect
        .soft(status, "Trang không được trả về lỗi 4xx/5xx")
        .toBeLessThan(400);
      expect
        .soft(
          pageErrors,
          `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(" | ")}`,
        )
        .toHaveLength(0);
    });

    // ------------------------------------------------------------------
    // Đính kèm số liệu ghi nhận + ảnh chụp
    // ------------------------------------------------------------------
    const summary = {
      url: NO_REVIEW_URL,
      status,
      hasSection,
      writeBtnFound,
      starPromptFound,
      modalOpened,
      hasReviewItems,
      hasScore,
      hasPercentChart,
      hasSatisfied,
      hasEmptyWording,
      pageErrors,
    };
    await attachText(
      "Review_View_05_so_lieu_ghi_nhan",
      JSON.stringify(summary, null, 2),
    );
    console.log("[Review_View_05] Số liệu ghi nhận:", JSON.stringify(summary));
    await shot(page, "Review_View_05_san_pham_chua_co_danh_gia");
  });
});

// ==============================================================================
// PHẦN 2: CHỨC NĂNG TƯƠNG TÁC HỮU ÍCH (LIKE - 4 TEST CASES)
// ==============================================================================
test.describe("PHẦN 2: CHỨC NĂNG TƯƠNG TÁC HỮU ÍCH (LIKE)", () => {
  test("Review_Like_01: Kiểm tra bấm [Hữu ích] khi đã đăng nhập", async ({
    page,
  }) => {
    test.skip(
      !HAS_AUTH,
      "Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json",
    );
    test.setTimeout(120000);
    const REVIEWER = "Trương Quyết";

    // [Tác động dữ liệu thật] Test này CỐ Ý không bỏ chọn sau khi bấm:
    // Review_Like_02 sẽ hoàn tác ngay sau đó (theo Excel). Nếu chạy lẻ Like_01, nhớ chạy Like_02 để khôi phục.

    // ------------------------------------------------------------------
    // Pre-condition: đã đăng nhập, mở trang sản phẩm, cuộn tới khu vực đánh giá
    // ------------------------------------------------------------------
    await page.goto(PRODUCT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await dismissPopups(page);

    const header = page
      .getByText(/Đánh giá Nồi cơm điện tử Kangaroo 1\.8 lít KGRC18D3G/i)
      .first();

    await page.evaluate(async () => {
      for (let i = 0; i < 8; i++) {
        window.scrollBy(0, 700);
        await new Promise((r) => setTimeout(r, 200));
      }
    });
    await header.waitFor({ state: "attached", timeout: 15000 });
    await header.scrollIntoViewIfNeeded();
    await dismissPopups(page);

    // Nếu danh sách có nút "Xem thêm ... đánh giá" thì bấm để tải đủ (chỉ đọc)
    for (let i = 0; i < 5; i++) {
      const moreBtn = page
        .getByRole("button", { name: /Xem thêm.*đánh giá/i })
        .first();
      if (!(await moreBtn.isVisible().catch(() => false))) break;
      await moreBtn.click().catch(() => {});
      await page.waitForTimeout(800);
    }

    const block = header.locator(
      'xpath=ancestor::div[contains(., "khách hài lòng")][1]',
    );
    await expect(block, "Phải xác định được thẻ khối đánh giá").toBeVisible({
      timeout: 15000,
    });

    // Đánh giá = div nhỏ nhất chứa tên người đánh giá và nút [Hữu ích]
    const item = block
      .locator(
        `xpath=.//*[normalize-space(text())="${REVIEWER}"]/ancestor::div[.//*[contains(text(),"Hữu ích")]][1]`,
      )
      .first();
    await expect(
      item,
      `Phải có đánh giá của "${REVIEWER}" trong danh sách`,
    ).toBeVisible({ timeout: 15000 });
    await item.scrollIntoViewIfNeeded();
    await dismissPopups(page);

    // Nút [Hữu ích] của đúng đánh giá này
    const likeBtn = item.getByText(/^\s*Hữu ích/i).first();
    await expect(
      likeBtn,
      `Đánh giá của "${REVIEWER}" phải có nút [Hữu ích]`,
    ).toBeVisible({ timeout: 10000 });

    // Đọc số lượng "Hữu ích (139)" hoặc "Hữu ích" + "(139)" ở dòng kế
    const readCount = async (): Promise<number> => {
      const t = ((await item.innerText()) || "").replace(/\u00a0/g, " ");
      const m = t.match(/Hữu ích\s*\(?\s*(\d+)\s*\)?/i);
      return m ? parseInt(m[1], 10) : NaN;
    };

    // "Chữ ký" hiển thị của nút (màu, nền, biểu tượng, class, aria) để phát hiện đổi trạng thái
    // Cụm nút [Hữu ích] = thẻ chữ + tối đa 3 cấp cha (chứa cả biểu tượng bên cạnh), không lấn sang tên người đánh giá
    const readState = (): Promise<string> =>
      likeBtn.evaluate((el: HTMLElement, reviewer: string) => {
        let top: HTMLElement = el.parentElement ?? el;
        for (let i = 0; i < 2 && top.parentElement; i++) {
          if ((top.parentElement.innerText || "").includes(reviewer)) break;
          top = top.parentElement;
        }
        const chain: Element[] = [];
        for (
          let n: Element | null = el;
          n && n !== top.parentElement;
          n = n.parentElement
        )
          chain.push(n);
        const nodes = [...chain, ...Array.from(top.querySelectorAll("*"))];
        return Array.from(new Set(nodes))
          .map((n) => {
            const cs = getComputedStyle(n);
            return [
              n.tagName,
              n.getAttribute("class") ?? "",
              n.getAttribute("aria-pressed") ?? "",
              n.getAttribute("fill") ?? "",
              n.getAttribute("src") ?? "",
              n.getAttribute("d") ?? "",
              cs.color,
              cs.backgroundColor,
              cs.fill,
              cs.stroke,
              cs.borderColor,
              cs.fontWeight,
              cs.opacity,
              cs.filter,
            ].join("|");
          })
          .join("||");
      }, REVIEWER);

    // HTML của cụm nút để đối chiếu khi cần (đính kèm vào báo cáo)
    const readHtml = (): Promise<string> =>
      likeBtn.evaluate((el: HTMLElement, reviewer: string) => {
        let top: HTMLElement = el.parentElement ?? el;
        for (let i = 0; i < 2 && top.parentElement; i++) {
          if ((top.parentElement.innerText || "").includes(reviewer)) break;
          top = top.parentElement;
        }
        return top.outerHTML.slice(0, 2000);
      }, REVIEWER);

    // ------------------------------------------------------------------
    // Step 1 / Expected 1: Ghi lại số lượng [Hữu ích] của đánh giá
    // ------------------------------------------------------------------
    let before = NaN;
    let stateBefore = "";

    await test.step(`Step 1: Ghi lại số lượng [Hữu ích] của "${REVIEWER}"`, async () => {
      before = await readCount();
      stateBefore = await readState();
      await attachText(
        "Review_Like_01_truoc_khi_bam",
        `Số lượng [Hữu ích]: ${before}\nTrạng thái nút: ${stateBefore.slice(0, 300)}`,
      );
      await attachText("Review_Like_01_html_nut_truoc", await readHtml());
      await shot(page, "Review_Like_01_buoc1_truoc_khi_bam");
      expect(
        Number.isNaN(before),
        "Expected 1: Phải ghi nhận được số lượng [Hữu ích]",
      ).toBe(false);
    });

    // Dấu hiệu để kiểm tra "không tải lại toàn bộ trang"
    let mainFrameNavigations = 0;
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) mainFrameNavigations++;
    });
    await page.evaluate(() => {
      (window as any).__likeMarker = "no-reload";
    });

    // ------------------------------------------------------------------
    // Step 2 / Expected 2: Click [Hữu ích]
    // ------------------------------------------------------------------
    let baseline = before; // số lượng khi CHƯA chọn
    let after = NaN;
    let stateAfter = "";

    await test.step("Step 2: Click [Hữu ích]", async () => {
      await likeBtn.click({ timeout: 10000 });

      // Chờ số lượng đổi (tự chờ, không dùng sleep cố định)
      await expect
        .poll(async () => await readCount(), {
          message: "Số lượng [Hữu ích] phải thay đổi sau khi click",
          timeout: 10000,
        })
        .not.toBe(before);
      after = await readCount();

      // Tự phục hồi: nếu số lượng GIẢM 1 nghĩa là đánh giá này đã được chọn từ lần chạy trước
      // -> vừa bỏ chọn, bấm lại để chọn đúng như kịch bản test
      if (after === before - 1) {
        note(
          "data-note",
          `Đánh giá đã ở trạng thái đã chọn từ trước (${before}); lần click đầu đã bỏ chọn (${after}). Bấm lại để chọn.`,
        );
        baseline = after;
        await likeBtn.click({ timeout: 10000 });
        await expect
          .poll(async () => await readCount(), { timeout: 10000 })
          .toBe(baseline + 1);
        after = await readCount();
      }

      stateAfter = await readState();
      await attachText(
        "Review_Like_01_sau_khi_bam",
        `Trước: ${baseline}\nSau: ${after}\nTrạng thái nút: ${stateAfter.slice(0, 300)}`,
      );
      await attachText("Review_Like_01_html_nut_sau", await readHtml());
      await shot(page, "Review_Like_01_buoc2_sau_khi_bam");
    });

    await test.step("Expected 2a: Số lượng tăng đúng 1", async () => {
      expect
        .soft(
          after,
          `Số lượng phải tăng đúng 1 (${baseline} → ${baseline + 1}), thực tế: ${after}`,
        )
        .toBe(baseline + 1);
    });

    await test.step("Expected 2b: Nút đổi sang trạng thái đã chọn (đổi màu/biểu tượng)", async () => {
      // Trạng thái "chưa chọn" của lần bấm lại tự phục hồi đã bị đổi -> so với trạng thái ngay trước lần click cuối
      expect
        .soft(
          stateAfter,
          "Nút [Hữu ích] phải đổi màu/biểu tượng sang trạng thái đã chọn",
        )
        .not.toBe(stateBefore);
    });

    await test.step("Expected 2c: Không tải lại toàn bộ trang", async () => {
      const marker = await page.evaluate(
        () => (window as any).__likeMarker ?? null,
      );
      expect
        .soft(
          marker,
          "Trang không được tải lại toàn bộ (biến đánh dấu phải còn nguyên)",
        )
        .toBe("no-reload");
      expect
        .soft(
          mainFrameNavigations,
          "Không được có điều hướng/tải lại trang chính khi bấm [Hữu ích]",
        )
        .toBe(0);
    });

    // ------------------------------------------------------------------
    // Đính kèm số liệu ghi nhận
    // ------------------------------------------------------------------
    const summary = {
      reviewer: REVIEWER,
      before,
      baseline,
      after,
      mainFrameNavigations,
      stateChanged: stateAfter !== stateBefore,
    };
    await attachText(
      "Review_Like_01_so_lieu_ghi_nhan",
      JSON.stringify(summary, null, 2),
    );
    console.log("[Review_Like_01] Số liệu ghi nhận:", JSON.stringify(summary));
    note(
      "data-note",
      "Đã làm tăng lượt [Hữu ích] thật của đánh giá. Chạy Review_Like_02 để hoàn tác.",
    );
  });

  test("Review_Like_02: Kiểm tra bấm [Hữu ích] lần 2 để bỏ chọn", async ({
    page,
  }) => {
    test.skip(
      !HAS_AUTH,
      "Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json",
    );
    test.setTimeout(120000);
    const REVIEWER = "Trương Quyết";

    // Pre-condition: nút [Hữu ích] đang CHƯA chọn thì test tự chọn (Step 0) rồi bỏ chọn (Step 1) trong cùng 1 lần mở trang.
    // Nếu nút đang ĐÃ chọn (từ lần chạy trước còn lưu) thì chỉ cần bỏ chọn.
    // Cuối test số lượng luôn về giá trị ban đầu -> không để lại lượt [Hữu ích] thật.
    const { likeBtn, readCount, readState, readHtml } =
      await prepareLikeContext(page, REVIEWER);

    const settle = async () => {
      await page.waitForTimeout(600);
    }; // chờ hiệu ứng đổi màu kết thúc trước khi đọc trạng thái
    const waitCount = (n: number) =>
      expect
        .poll(async () => await readCount(), {
          message: `Số lượng [Hữu ích] phải về ${n}`,
          timeout: 10000,
        })
        .toBe(n);

    // ------------------------------------------------------------------
    // Trạng thái ban đầu
    // ------------------------------------------------------------------
    const initial = await readCount();
    await settle();
    const stateInitial = await readState();
    await attachText(
      "Review_Like_02_ban_dau",
      `Số lượng [Hữu ích]: ${initial}\nTrạng thái nút: ${stateInitial.slice(0, 300)}`,
    );
    await attachText("Review_Like_02_html_nut_ban_dau", await readHtml());
    await shot(page, "Review_Like_02_ban_dau");
    expect(
      Number.isNaN(initial),
      "Phải ghi nhận được số lượng [Hữu ích] ban đầu",
    ).toBe(false);

    // ------------------------------------------------------------------
    // Click lần đầu: xác định đang ở trạng thái nào
    // ------------------------------------------------------------------
    await likeBtn.click({ timeout: 10000 });
    await expect
      .poll(async () => await readCount(), {
        message: "Số lượng [Hữu ích] phải thay đổi sau khi click",
        timeout: 10000,
      })
      .not.toBe(initial);
    const afterFirst = await readCount();
    await settle();
    const stateFirst = await readState();

    let wasSelected: boolean; // true: đánh giá đã ở trạng thái "đã chọn" trước khi click
    let afterUnselect = NaN; // số lượng sau khi bỏ chọn
    let stateUnselected = "";

    if (afterFirst === initial - 1) {
      // Đã chọn từ trước (còn lưu): click vừa rồi chính là bỏ chọn
      wasSelected = true;
      afterUnselect = afterFirst;
      stateUnselected = stateFirst;
    } else if (afterFirst === initial + 1) {
      // Chưa chọn: click vừa rồi là CHỌN (Step 0). Trạng thái từ Like_01 không còn sau khi tải lại trang
      wasSelected = false;
      note(
        "defect-note",
        `[Cần xác nhận] Sau khi tải lại trang, đánh giá của "${REVIEWER}" không còn ở trạng thái "đã chọn" ` +
          `(số lượng hiển thị ${initial}, nút chưa chọn). Có thể web không lưu lượt [Hữu ích] theo tài khoản -> đối chiếu với Review_Like_03.`,
      );
      await attachText(
        "Review_Like_02_html_nut_sau_khi_chon",
        await readHtml(),
      );
      await shot(page, "Review_Like_02_buoc0_da_chon");

      // Step 1 (theo Excel): click lại [Hữu ích] ở đánh giá đã chọn để bỏ chọn
      await test.step("Step 1: Click lại [Hữu ích] để bỏ chọn", async () => {
        await likeBtn.click({ timeout: 10000 });
        await waitCount(initial).catch(() => {});
      });
      afterUnselect = await readCount();
      await settle();
      stateUnselected = await readState();
    } else {
      throw new Error(
        `Số lượng sau click đầu bất thường: ${initial} → ${afterFirst} (chỉ chấp nhận ±1)`,
      );
    }

    await attachText(
      "Review_Like_02_sau_khi_bo_chon",
      `Ban đầu: ${initial}\nSau click đầu: ${afterFirst}\nSau khi bỏ chọn: ${afterUnselect}\nTrạng thái nút: ${stateUnselected.slice(0, 300)}`,
    );
    await attachText(
      "Review_Like_02_html_nut_sau_khi_bo_chon",
      await readHtml(),
    );
    await shot(page, "Review_Like_02_sau_khi_bo_chon");

    // ------------------------------------------------------------------
    // Expected: nút về chưa chọn; số lượng giảm đúng 1 (so với lúc đã chọn)
    // ------------------------------------------------------------------
    const selectedCount = wasSelected ? initial : afterFirst; // số lượng ở trạng thái "đã chọn"

    await test.step("Expected 1a: Hệ thống cho phép bỏ chọn, số lượng giảm đúng 1", async () => {
      expect
        .soft(
          afterUnselect,
          `Số lượng phải giảm đúng 1 (${selectedCount} → ${selectedCount - 1}), thực tế: ${afterUnselect}`,
        )
        .toBe(selectedCount - 1);
    });

    await test.step("Expected 1b: Nút trở về trạng thái chưa chọn", async () => {
      if (wasSelected) {
        // Không có mốc "chưa chọn" ban đầu để so sánh -> chỉ cần nút đã đổi so với trạng thái đã chọn
        expect
          .soft(
            stateUnselected,
            "Nút [Hữu ích] phải đổi màu/biểu tượng về trạng thái chưa chọn",
          )
          .not.toBe(stateInitial);
      } else {
        expect
          .soft(
            stateUnselected,
            "Nút [Hữu ích] phải trở về đúng trạng thái chưa chọn ban đầu",
          )
          .toBe(stateInitial);
      }
    });

    // ------------------------------------------------------------------
    // Đính kèm số liệu ghi nhận
    // ------------------------------------------------------------------
    const summary = {
      reviewer: REVIEWER,
      initial,
      afterFirst,
      afterUnselect,
      wasSelected,
      backToInitialState: stateUnselected === stateInitial,
    };
    await attachText(
      "Review_Like_02_so_lieu_ghi_nhan",
      JSON.stringify(summary, null, 2),
    );
    console.log("[Review_Like_02] Số liệu ghi nhận:", JSON.stringify(summary));
  });

  test("Review_Like_03: Kiểm tra trạng thái [Hữu ích] được lưu sau khi tải lại trang/đăng nhập lại", async ({
    page,
    browser,
  }) => {
    test.skip(
      !HAS_AUTH,
      "Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json",
    );
    test.setTimeout(180000);
    const REVIEWER = "Trương Quyết";

    // [Tác động dữ liệu thật] Test chọn [Hữu ích] rồi bỏ chọn ở cuối (trong cùng phiên) để khôi phục số lượng.
    // Lưu ý: KHÔNG đăng xuất thật, vì sẽ làm hết hạn phiên trong dmx_storageState.json và hỏng các test khác (đăng nhập lại cần OTP).
    // Bước "đăng nhập lại" được mô phỏng bằng 1 browser context MỚI nạp lại cùng tài khoản (phiên mới).
    const settle = async (p: Page) => {
      await p.waitForTimeout(600);
    }; // chờ hiệu ứng đổi màu kết thúc trước khi đọc trạng thái

    // ------------------------------------------------------------------
    // Pre-condition + Step 1a: chọn [Hữu ích] ở đánh giá của "Trương Quyết"
    // ------------------------------------------------------------------
    const ctx1 = await prepareLikeContext(page, REVIEWER);
    const c0 = await ctx1.readCount();
    await settle(page);
    const stateInitial = await ctx1.readState();
    expect(
      Number.isNaN(c0),
      "Phải ghi nhận được số lượng [Hữu ích] ban đầu",
    ).toBe(false);
    await attachText(
      "Review_Like_03_ban_dau",
      `Số lượng: ${c0}\nTrạng thái nút: ${stateInitial.slice(0, 300)}`,
    );
    await attachText("Review_Like_03_html_nut_ban_dau", await ctx1.readHtml());

    let baseCount = c0; // số lượng khi CHƯA chọn
    let selectedCount = NaN; // số lượng khi ĐÃ chọn
    let stateSelected = "";
    let clicked = false;         // đã bấm [Hữu ích] chưa, để biết có cần hoàn tác không

    try {
      await test.step("Step 1a: Bấm [Hữu ích] để chọn", async () => {
        await ctx1.likeBtn.click({ timeout: 10000 });
        clicked = true;
        await expect
          .poll(() => ctx1.readCount(), {
            message: "Số lượng [Hữu ích] phải thay đổi sau khi click",
            timeout: 10000,
          })
          .not.toBe(c0);
        const afterFirst = await ctx1.readCount();

        if (afterFirst === c0 - 1) {
          // Đã chọn từ trước -> click vừa rồi là bỏ chọn, bấm lại để chọn
          note(
            "data-note",
            `Đánh giá đã ở trạng thái đã chọn từ trước (${c0}); bấm lại để chọn.`,
          );
          baseCount = afterFirst;
          await ctx1.likeBtn.click({ timeout: 10000 });
          await expect
            .poll(() => ctx1.readCount(), { timeout: 10000 })
            .toBe(baseCount + 1);
        } else {
          expect(
            afterFirst,
            `Số lượng sau click đầu phải tăng đúng 1 (${c0} → ${c0 + 1})`,
          ).toBe(c0 + 1);
        }
        selectedCount = baseCount + 1;
        await settle(page);
        stateSelected = await ctx1.readState();
        await attachText(
          "Review_Like_03_sau_khi_chon",
          `Số lượng: ${selectedCount}\nTrạng thái nút: ${stateSelected.slice(0, 300)}`,
        );
        await attachText(
          "Review_Like_03_html_nut_da_chon",
          await ctx1.readHtml(),
        );
        await shot(page, "Review_Like_03_buoc1a_da_chon");
      });
    
      // ------------------------------------------------------------------
      // Step 1b / Expected 1: nhấn F5 -> nút vẫn ở trạng thái đã chọn, số lượng đúng
      // ------------------------------------------------------------------
      let countF5 = NaN;
      let stateF5 = "";

      await test.step("Step 1b: Nhấn F5 (tải lại trang)", async () => {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
        await page.evaluate(async () => {
          for (let i = 0; i < 8; i++) {
            window.scrollBy(0, 700);
            await new Promise((r) => setTimeout(r, 200));
          }
        });
        const ctxF5 = await prepareLikeContext(page, REVIEWER, { skipGoto: true });
        countF5 = await ctxF5.readCount();
        await settle(page);
        stateF5 = await ctxF5.readState();
        await attachText(
          "Review_Like_03_sau_F5",
          `Số lượng: ${countF5}\nTrạng thái nút: ${stateF5.slice(0, 300)}`,
        );
        await attachText(
          "Review_Like_03_html_nut_sau_F5",
          await ctxF5.readHtml(),
        );
        await shot(page, "Review_Like_03_buoc1b_sau_F5");
      });

      await test.step("Expected 1a: Sau F5 số lượng không mất lượt vừa bấm", async () => {
        // Số lượng thật có thể đổi do người khác bấm -> chỉ yêu cầu không thấp hơn số lượng ngay sau khi chọn
        expect
          .soft(
            countF5,
            `Sau F5 số lượng phải >= ${selectedCount} (đã chọn), thực tế: ${countF5} (ban đầu: ${baseCount})`,
          )
          .toBeGreaterThanOrEqual(selectedCount);
      });

      await test.step("Expected 1b: Sau F5 nút vẫn ở trạng thái đã chọn", async () => {
        expect
          .soft(
            stateF5 === stateSelected,
            "Sau F5 nút [Hữu ích] phải vẫn ở trạng thái đã chọn (giống trạng thái ngay sau khi bấm)",
          )
          .toBe(true);
      });

      // ------------------------------------------------------------------
      // Step 2 / Expected 2: "đăng nhập lại" (phiên mới của cùng tài khoản) -> mở lại trang sản phẩm
      // ------------------------------------------------------------------
      let countB = NaN;
      let stateB = "";

      await test.step("Step 2: Mở lại trang sản phẩm bằng phiên mới của cùng tài khoản", async () => {
        const ctxB = await browser.newContext({
          storageState: STORAGE_STATE_PATH,
        });
        try {
          const pageB = await ctxB.newPage();
          const like = await prepareLikeContext(pageB, REVIEWER);
          countB = await like.readCount();
          await settle(pageB);
          stateB = await like.readState();
          await attachText(
            "Review_Like_03_phien_moi",
            `Số lượng: ${countB}\nTrạng thái nút: ${stateB.slice(0, 300)}`,
          );
          await attachText(
            "Review_Like_03_html_nut_phien_moi",
            await like.readHtml(),
          );
          await test.info().attach("Review_Like_03_buoc2_phien_moi", {
            body: await pageB.screenshot({ fullPage: true }),
            contentType: "image/png",
          });
        } finally {
          await ctxB.close().catch(() => {});
        }
      });

      await test.step("Expected 2a: Phiên mới số lượng không thấp hơn lúc đã chọn", async () => {
        expect
          .soft(
            countB,
            `Phiên mới phải thấy số lượng >= ${selectedCount}, thực tế: ${countB}`,
          )
          .toBeGreaterThanOrEqual(selectedCount);
      });

      await test.step("Expected 2b: Phiên mới nút vẫn ở trạng thái đã chọn (đúng với tài khoản này)", async () => {
        expect
          .soft(
            stateB === stateSelected,
            "Phiên mới của cùng tài khoản phải thấy nút [Hữu ích] ở trạng thái đã chọn",
          )
          .toBe(true);
      });

      // ------------------------------------------------------------------
      // Đính kèm số liệu ghi nhận + ghi chú lỗi (nếu có)
      // ------------------------------------------------------------------
      const persistedAfterF5 =
        countF5 >= selectedCount && stateF5 === stateSelected;
      const persistedInNewSession = stateB === stateSelected;
      const summary = {
        reviewer: REVIEWER,
        baseCount,
        selectedCount,
        countF5,
        countB,
        persistedAfterF5,
        persistedInNewSession,
      };
      await attachText(
        "Review_Like_03_so_lieu_ghi_nhan",
        JSON.stringify(summary, null, 2),
      );
      console.log(
        "[Review_Like_03] Số liệu ghi nhận:",
        JSON.stringify(summary),
      );

      if (!persistedAfterF5) {
        note(
          "defect-note",
          `[Cần xác nhận] Trạng thái [Hữu ích] KHÔNG được giữ sau khi tải lại trang (F5): đã chọn ở ${selectedCount}, sau F5 hiển thị ${countF5}.`,
        );
      }
      if (persistedAfterF5 && !persistedInNewSession) {
        note(
          "defect-note",
          '[Cần xác nhận] Trạng thái [Hữu ích] chỉ giữ được trong cùng trình duyệt (sau F5); phiên mới của cùng tài khoản không thấy nút "đã chọn" ' +
            "-> trạng thái có vẻ gắn với thiết bị/trình duyệt, không gắn với tài khoản.",
        );
      }
    } finally {
      // Khôi phục dữ liệu: đưa nút về đúng trạng thái ban đầu, dù test dừng ở bước nào
      if (clicked) {
        try {
          const restore = await prepareLikeContext(page, REVIEWER);   // tải lại trang để thấy trạng thái thật
          await settle(page);
          const ref = Number.isNaN(selectedCount) ? c0 : selectedCount;
          const countNow = await restore.readCount();

          if (Math.abs(countNow - ref) > 5) {
            // Số lượng lệch nhiều so với đánh giá đã bấm: có thể là đánh giá khác cùng tên, không bấm để tránh sai dữ liệu
            note('data-note', `KHÔNG hoàn tác tự động: số lượng đọc được (${countNow}) lệch nhiều so với đánh giá đã bấm (~${ref}), có thể là đánh giá khác cùng tên. Kiểm tra bằng tay.`);
          } else if ((await restore.readState()) !== stateInitial) {
            await restore.likeBtn.click({ timeout: 10000 });
            await expect.poll(() => restore.readState(), { timeout: 10000 }).toBe(stateInitial);
            note('data-note', `Đã hoàn tác [Hữu ích] (${countNow} → ${await restore.readCount()}).`);
          } else {
            note('data-note', `Sau khi tải lại nút đã ở trạng thái ban đầu nên không bấm hoàn tác. Nếu nghi web vẫn giữ lượt vừa bấm, kiểm tra số lượng [Hữu ích] của "${REVIEWER}" bằng tay (ban đầu: ${baseCount}).`);
          }
        } catch (e) {
          note('data-note', `Không hoàn tác được tự động (${(e as Error).message.split('\n')[0]}): kiểm tra số lượng [Hữu ích] của "${REVIEWER}" bằng tay.`);
        }
      }
    }
  });

  test('Review_Like_04: Kiểm tra bấm [Hữu ích] khi chưa đăng nhập', async ({ browser }) => {
    test.setTimeout(150000);
    const REVIEWER = 'Trương Quyết';
    const settle = async (p: Page) => { await p.waitForTimeout(600); };

    // [Tác động dữ liệu thật] nếu web ghi nhận lượt bấm của khách, test bấm lại để hoàn tác ở cuối.
    // Pre-condition: phiên sạch, chưa đăng nhập (tương đương cửa sổ ẩn danh)
    const guestContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const guestPage = await guestContext.newPage();

    let clicked = false;
    let c0 = NaN;
    let stateInitial = '';
    let afterCount = NaN;

    try {
      // Cùng đánh giá "Trương Quyết" như các test Like khác để số liệu so sánh được
      const ctx = await prepareLikeContext(guestPage, REVIEWER);
      // Xác nhận đúng là khách: header còn nút [Đăng nhập]
      await expect(
        guestPage.locator('a[href*="dang-nhap"]').first(),
        'Phải đang ở trạng thái chưa đăng nhập (header có nút [Đăng nhập])'
      ).toBeVisible({ timeout: 15000 });

      c0 = await ctx.readCount();
      await settle(guestPage);
      stateInitial = await ctx.readState();
      expect(Number.isNaN(c0), 'Phải ghi nhận được số lượng [Hữu ích] ban đầu').toBe(false);
      await attachText('Review_Like_04_ban_dau', `Số lượng: ${c0}\nTrạng thái nút: ${stateInitial.slice(0, 300)}`);
      await shot(guestPage, 'Review_Like_04_buoc0_truoc_khi_bam');

      // Dấu hiệu của popup yêu cầu đăng nhập: ô nhập số điện thoại hiện thêm
      const visiblePhoneInputs = () =>
        guestPage
          .locator('input[type="tel"], input[placeholder*="điện thoại" i]')
          .evaluateAll((els) => els.filter((e) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight)).length);
      const phoneBefore = await visiblePhoneInputs();
      const urlBefore = guestPage.url();

      // ---------- Bước 1: click [Hữu ích] ở một đánh giá ----------
      await ctx.likeBtn.click({ timeout: 10000 });
      clicked = true;

      // Chờ tối đa 6s để thấy web phản ứng: yêu cầu đăng nhập, hoặc số lượng đổi
      let outcome = 'KHONG_PHAN_HOI';
      for (let i = 0; i < 12; i++) {
        await guestPage.waitForTimeout(500);
        if (/dang-nhap/i.test(guestPage.url()) && guestPage.url() !== urlBefore) { outcome = 'CHUYEN_SANG_TRANG_DANG_NHAP'; break; }
        if ((await visiblePhoneInputs()) > phoneBefore) { outcome = 'HIEN_POPUP_DANG_NHAP'; break; }
        if ((await ctx.readCount().catch(() => NaN)) !== c0) { outcome = 'GHI_NHAN_CHO_KHACH'; break; }
      }
      await settle(guestPage);
      await shot(guestPage, 'Review_Like_04_buoc1_sau_khi_bam');

      // Nếu web chuyển sang trang đăng nhập thì không còn gì để đọc trên trang sản phẩm
      const onProductPage = guestPage.url().includes('noi-com-dien-tu-kangaroo');
      afterCount = onProductPage ? await ctx.readCount().catch(() => NaN) : NaN;
      const stateAfter = onProductPage ? await ctx.readState().catch(() => '') : '';
      await attachText(
        'Review_Like_04_ket_qua',
        `Cách web xử lý: ${outcome}\nSố lượng: ${c0} -> ${afterCount}\nTrạng thái nút đổi: ${stateAfter !== stateInitial}\nURL: ${guestPage.url()}`
      );

      // ---------- Kết quả mong đợi ----------
      // 1. Không lỗi, không crash trang
      const bodyText = ((await guestPage.evaluate(() => document.body.innerText).catch(() => '')) || '').replace(/\s+/g, ' ');
      expect(bodyText.length, 'Trang không được trắng sau khi bấm').toBeGreaterThan(200);
      expect(bodyText, 'Không được hiện lỗi hệ thống sau khi khách bấm [Hữu ích]')
        .not.toMatch(/đã xảy ra lỗi|có lỗi xảy ra|không thể tải|lỗi hệ thống|Something went wrong/i);

      // 2. Không làm số lượng thay đổi sai: chỉ được giữ nguyên hoặc tăng đúng 1
      if (onProductPage) {
        expect(Number.isNaN(afterCount), 'Phải đọc được số lượng sau khi bấm').toBe(false);
        expect(
          [c0, c0 + 1],
          `Số lượng sau khi khách bấm phải giữ nguyên (${c0}) hoặc tăng đúng 1, thực tế: ${afterCount}`
        ).toContain(afterCount);
      }

      // 3. Xử lý nhất quán
      if (outcome === 'KHONG_PHAN_HOI') {
        note('ux-note', 'Khách bấm [Hữu ích] không có phản hồi nào (không popup đăng nhập, số lượng không đổi). Xem ảnh Review_Like_04_buoc1_sau_khi_bam để xác nhận.');
      }
      if (outcome === 'GHI_NHAN_CHO_KHACH') {
        // Web ghi nhận lượt bấm của khách (theo thiết bị): nút phải đổi trạng thái và kết quả phải giữ sau khi tải lại
        expect(stateAfter !== stateInitial, 'Khi số lượng tăng, nút [Hữu ích] phải đổi sang trạng thái đã chọn').toBe(true);

        await guestPage.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
        const ctxReload = await prepareLikeContext(guestPage, REVIEWER, { skipGoto: true });
        await settle(guestPage);
        const stateReload = await ctxReload.readState();
        const countReload = await ctxReload.readCount();
        await attachText('Review_Like_04_sau_F5', `Số lượng: ${countReload}\nGiữ trạng thái đã chọn: ${stateReload === stateAfter}`);
        expect(countReload, `Sau F5 số lượng phải >= ${c0 + 1}`).toBeGreaterThanOrEqual(c0 + 1);
        expect(stateReload === stateAfter, 'Sau F5 trạng thái đã chọn của khách phải được giữ (xử lý nhất quán)').toBe(true);
      }
      note('data-note', `Cách web xử lý khi khách bấm [Hữu ích]: ${outcome}.`);
    } finally {
      // Khôi phục dữ liệu: nếu lượt bấm của khách đã được ghi nhận thì bấm lại để về trạng thái ban đầu
      if (clicked && !Number.isNaN(c0)) {
        try {
          if (guestPage.url().includes('noi-com-dien-tu-kangaroo')) {
            const restore = await prepareLikeContext(guestPage, REVIEWER);
            await settle(guestPage);
            const ref = Number.isNaN(afterCount) ? c0 : afterCount;
            const countNow = await restore.readCount();
            if (Math.abs(countNow - ref) > 5) {
              note('data-note', `KHÔNG hoàn tác tự động: số lượng đọc được (${countNow}) lệch nhiều so với đánh giá đã bấm (~${ref}). Kiểm tra bằng tay.`);
            } else if ((await restore.readState()) !== stateInitial) {
              await restore.likeBtn.click({ timeout: 10000 });
              await expect.poll(() => restore.readState(), { timeout: 10000 }).toBe(stateInitial);
              note('data-note', `Đã hoàn tác lượt [Hữu ích] của khách (${countNow} → ${await restore.readCount()}).`);
            }
          }
        } catch (e) {
          note('data-note', `Không hoàn tác được tự động (${(e as Error).message.split('\n')[0]}): kiểm tra số lượng [Hữu ích] của "${REVIEWER}" bằng tay.`);
        }
      }
      await guestContext.close().catch(() => {});
    }
  });
});

// ==============================================================================
// PHẦN 3: FORM ĐÁNH GIÁ SẢN PHẨM (FORM - 18 TEST CASES)
// ==============================================================================
test.describe("PHẦN 3: FORM ĐÁNH GIÁ SẢN PHẨM (FORM)", () => {
  test('Review_Form_01: Kiểm tra mở popup [Đánh giá sản phẩm] khi đã đăng nhập', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(120000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây

    // ---------- Pre-condition + Step 1: mở trang sản phẩm, cuộn tới khu vực đánh giá, click [Viết đánh giá] ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);
    await shot(page, 'Review_Form_01_buoc1_popup_vua_mo');
    await attachText('Review_Form_01_html_popup_ban_dau', (await modal.evaluate((el) => el.outerHTML)).slice(0, 20000));

    // Các phần tử của form mở rộng (chỉ hiện sau khi chọn sao)
    const textarea = modal.locator('textarea').first();
    const introduct = modal.locator('input#introduct, input[name="introduct"]');
    const nameInput = modal.locator('input#fullName, input[name="fullName"]');
    const phoneInput = modal.locator('input#phone, input[name="phone"]');
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');

    // ---------- Expected 1: popup vừa mở ----------
    await test.step('Expected 1: Popup vừa mở có ảnh, tên sản phẩm, 5 sao chưa chọn, nút đóng', async () => {
      await expect.soft(modal.getByText('Đánh giá sản phẩm').first(), 'Phải có tiêu đề "Đánh giá sản phẩm"').toBeVisible(SOFT);
      await expect.soft(modal.getByText(PRODUCT_NAME).first(), `Phải có tên sản phẩm "${PRODUCT_NAME}"`).toBeVisible(SOFT);

      const productImg = modal.locator('img').first();
      await expect.soft(productImg, 'Phải có ảnh sản phẩm trong popup').toBeVisible(SOFT);
      const natural = await productImg.evaluate((el) => (el as HTMLImageElement).naturalWidth).catch(() => 0);
      expect.soft(natural, 'Ảnh sản phẩm phải tải được (không bị lỗi)').toBeGreaterThan(0);

      for (const label of ['Rất tệ', 'Tệ', 'Tạm ổn', 'Tốt', 'Rất tốt']) {
        await expect.soft(modal.getByText(label, { exact: true }).first(), `Phải có nhãn sao "${label}"`).toBeVisible(SOFT);
      }

      // Nút đóng (X) ở góc phải
      const closeBtn = modal.locator('button:has(span:has-text("✕")), button:has-text("✕"), button[aria-label*="close" i], button[aria-label*="đóng" i]').first();
      await expect.soft(closeBtn, 'Phải có nút đóng (X) của popup').toBeVisible(SOFT);

      // Chưa chọn sao thì chưa hiển thị form mở rộng
      await expect.soft(textarea, 'Chưa chọn sao thì chưa hiển thị ô nhận xét').toBeHidden(SOFT);
      await expect.soft(nameInput, 'Chưa chọn sao thì chưa hiển thị ô Họ tên').toBeHidden(SOFT);
      await expect.soft(submit, 'Chưa chọn sao thì chưa hiển thị nút [Gửi đánh giá]').toBeHidden(SOFT);
    });

    // ---------- Step 2: chọn sao thứ 3 "Tạm ổn" (chỉ chọn, không gửi) ----------
    await modal.getByText('Tạm ổn', { exact: true }).click();
    await page.waitForTimeout(800);
    await shot(page, 'Review_Form_01_buoc2_sau_khi_chon_sao');
    await attachText('Review_Form_01_html_popup_sau_khi_chon_sao', (await modal.evaluate((el) => el.outerHTML)).slice(0, 20000));

    const placeholders = await modal.locator('[placeholder]').evaluateAll((els) => els.map((e) => e.getAttribute('placeholder') || ''));
    const modalText = (((await modal.innerText()) || '') + ' ' + placeholders.join(' ')).replace(/\s+/g, ' ');

    // ---------- Expected 2: form mở rộng ----------
    await test.step('Ô nhận xét trống với gợi ý "Mời bạn chia sẻ thêm cảm nhận..."', async () => {
      await expect.soft(textarea, 'Sau khi chọn sao phải hiển thị ô nhận xét').toBeVisible(SOFT);
      await expect.soft(textarea, 'Ô nhận xét phải trống').toHaveValue('', SOFT);
      await expect.soft(textarea, 'Ô nhận xét phải có gợi ý "chia sẻ thêm cảm nhận"').toHaveAttribute('placeholder', /chia sẻ thêm cảm nhận/i, SOFT);
    });

    await test.step('Checkbox giới thiệu sản phẩm và liên kết [Gửi ảnh thực tế] (tối đa 3 ảnh)', async () => {
      await expect.soft(introduct, 'Phải có checkbox giới thiệu sản phẩm').toBeVisible(SOFT);
      await expect.soft(modal.getByText('Tôi sẽ giới thiệu sản phẩm cho bạn bè, người thân'), 'Phải có nhãn của checkbox giới thiệu').toBeVisible(SOFT);
      await expect.soft(modal.getByText(/Gửi ảnh thực tế/i).first(), 'Phải có liên kết [Gửi ảnh thực tế]').toBeVisible(SOFT);
      expect.soft(modalText, 'Phải ghi chú tối đa 3 ảnh').toMatch(/tối đa\s*3|3\s*ảnh/i);
    });

    await test.step('Họ tên và Số điện thoại (bắt buộc), điền sẵn từ tài khoản', async () => {
      await expect.soft(nameInput, 'Phải có ô Họ tên').toBeVisible(SOFT);
      await expect.soft(phoneInput, 'Phải có ô Số điện thoại').toBeVisible(SOFT);
      expect.soft(modalText, 'Ô Họ tên phải ghi "(bắt buộc)"').toMatch(/Họ tên[\s\S]{0,40}bắt buộc/i);
      expect.soft(modalText, 'Ô Số điện thoại phải ghi "(bắt buộc)"').toMatch(/Số điện thoại[\s\S]{0,40}bắt buộc/i);

      const nameVal = await nameInput.inputValue().catch(() => '');
      const phoneVal = await phoneInput.inputValue().catch(() => '');
      await attachText('Review_Form_01_thong_tin_dien_san', `Họ tên: ${nameVal}\nSố điện thoại: ${phoneVal}`);
      expect.soft(nameVal.toLowerCase(), `Họ tên điền sẵn phải khớp tài khoản (chứa "${TEST_NAME}")`).toContain(TEST_NAME.toLowerCase());
      expect.soft(phoneVal.replace(/\D/g, ''), 'Số điện thoại điền sẵn phải khớp tài khoản').toBe(TEST_PHONE.replace(/\D/g, ''));
    });

    await test.step('Checkbox chính sách (chưa chọn) và nút [Gửi đánh giá] vô hiệu', async () => {
      await expect.soft(agree, 'Phải có checkbox đồng ý chính sách dữ liệu cá nhân').toBeVisible(SOFT);
      await expect.soft(agree, 'Checkbox chính sách mặc định chưa được tick').not.toBeChecked(SOFT);
      await expect.soft(submit, 'Phải có nút [Gửi đánh giá]').toBeVisible(SOFT);
      await expect.soft(submit, 'Nút [Gửi đánh giá] phải vẫn bị vô hiệu khi chưa đồng ý chính sách').toBeDisabled(SOFT);
    });

    await test.step('Liên kết [Quy định đánh giá], [Chính sách bảo mật thông tin]', async () => {
      await expect.soft(modal.getByText(/Quy định đánh giá/i).first(), 'Phải có liên kết [Quy định đánh giá]').toBeVisible(SOFT);
      await expect.soft(modal.getByText(/Chính sách bảo mật thông tin/i).first(), 'Phải có liên kết [Chính sách bảo mật thông tin]').toBeVisible(SOFT);
      for (const href of ['chinh-sach-xu-ly-du-lieu-ca-nhan', 'huong-dan-dang-binh-luan', 'dieu-khoan-su-dung']) {
        await expect.soft(modal.locator(`a[href*="${href}"]`).first(), `Phải có liên kết tới "${href}"`).toBeVisible(SOFT);
      }
    });

    // Không gửi gì lên web: chỉ đóng popup
    await closeReviewModal(page);
  });

  test('Review_Form_02: Kiểm tra click [Viết đánh giá] khi chưa đăng nhập', async ({ browser }) => {
    test.setTimeout(120000);
    const SOFT = { timeout: 3000 };

    // Pre-condition: phiên khách, không có cookie/đăng nhập
    const guestContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const guestPage = await guestContext.newPage();

    try {
      await guestPage.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissPopups(guestPage);
      await scrollToReviewSection(guestPage);

      // Step 1: click [Viết đánh giá]
      const writeBtn = guestPage.locator('button:has-text("Viết đánh giá")').first();
      await expect(writeBtn, 'Khách phải thấy nút [Viết đánh giá]').toBeVisible({ timeout: 15000 });
      await writeBtn.click();
      await guestPage.waitForTimeout(1500);
      await shot(guestPage, 'Review_Form_02_buoc1_sau_khi_click');

      const modal = guestPage.locator('.fixed:has-text("Đánh giá sản phẩm")').last();
      const loginPrompt = guestPage.locator(
        '.fixed:has-text("Đăng nhập"), [role="dialog"]:has-text("Đăng nhập"), input[type="tel"][placeholder*="điện thoại" i]'
      ).first();

      // Xác định web phản ứng theo cách nào
      let outcome: 'popup_danh_gia' | 'yeu_cau_dang_nhap' | 'khong_phan_hoi' = 'khong_phan_hoi';
      if (await modal.isVisible().catch(() => false)) outcome = 'popup_danh_gia';
      else if (/dang-nhap|login/i.test(guestPage.url()) || (await loginPrompt.isVisible().catch(() => false))) outcome = 'yeu_cau_dang_nhap';
      await attachText('Review_Form_02_ket_qua_quan_sat', `Phản ứng của web: ${outcome}\nURL: ${guestPage.url()}`);
      console.log(`[Review_Form_02] Phản ứng của web khi khách click: ${outcome}`);

      // Expected: web phải phản ứng rõ ràng (mở popup đánh giá HOẶC yêu cầu đăng nhập)
      expect(outcome, 'Khách click [Viết đánh giá] phải mở popup đánh giá hoặc yêu cầu đăng nhập, không được im lặng').not.toBe('khong_phan_hoi');

      if (outcome === 'popup_danh_gia') {
        // Step 2: chọn 1 sao để form mở rộng, rồi kiểm tra Họ tên/SĐT không bị điền sẵn
        await modal.getByText('Tạm ổn', { exact: true }).click();
        await guestPage.waitForTimeout(800);
        await shot(guestPage, 'Review_Form_02_buoc2_khach_chon_sao');

        const nameInput = modal.locator('input#fullName, input[name="fullName"]');
        const phoneInput = modal.locator('input#phone, input[name="phone"]');
        await expect.soft(nameInput, 'Khách phải thấy ô Họ tên').toBeVisible(SOFT);
        await expect.soft(phoneInput, 'Khách phải thấy ô Số điện thoại').toBeVisible(SOFT);
        await expect.soft(nameInput, 'Ô Họ tên của khách phải trống').toHaveValue('', SOFT);
        await expect.soft(phoneInput, 'Ô Số điện thoại của khách phải trống').toHaveValue('', SOFT);
        await expect.soft(modal.locator('button:has-text("Gửi đánh giá")'), 'Nút [Gửi đánh giá] phải vô hiệu khi chưa đồng ý chính sách').toBeDisabled(SOFT);
        await closeReviewModal(guestPage);
      } else {
        await attachText('Review_Form_02_ghi_chu', 'Web yêu cầu đăng nhập khi khách click [Viết đánh giá]; không có popup đánh giá.');
      }
    } finally {
      await guestContext.close().catch(() => {});
    }
  });

  test('Review_Form_03: Kiểm tra chọn từng mức sao và nhãn tương ứng', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(150000);

    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);

    const LABELS = ['Rất tệ', 'Tệ', 'Tạm ổn', 'Tốt', 'Rất tốt'];

    // Đọc trạng thái 5 sao: tìm đúng 5 phần tử nhãn (khớp CHÍNH XÁC chữ), lấy "ô sao" chứa từng nhãn
    // rồi ghi lại dấu hiệu hiển thị của biểu tượng sao + nhãn (class và style thực tế)
    const readStars = () => modal.evaluate((root, labels) => {
      const all = Array.from(root.querySelectorAll('*')) as HTMLElement[];
      const labelEls = labels.map((t) =>
        all.find((e) => e.children.length === 0 && (e.textContent || '').trim() === t) as HTMLElement | undefined);
      if (labelEls.some((e) => !e)) return null;

      // Hàng chứa cả 5 nhãn = tổ tiên chung thấp nhất
      let row: HTMLElement | null = labelEls[0]!;
      while (row && !labelEls.every((e) => row!.contains(e!))) row = row.parentElement;
      if (!row) return null;

      const sig = (e: HTMLElement) => {
        const cs = getComputedStyle(e);
        return [e.tagName, e.getAttribute('class') || '', e.getAttribute('src') || '',
          cs.color, cs.fill, cs.backgroundColor, cs.backgroundPosition, cs.fontWeight].join('|');
      };
      return labelEls.map((lab, i) => {
        let item: HTMLElement = lab!;
        while (item.parentElement && item.parentElement !== row) item = item.parentElement;
        const icons = Array.from(item.querySelectorAll('i, svg, img, path')) as HTMLElement[];
        return {
          label: labels[i],
          iconSig: icons.length ? icons.map(sig).join('||') : sig(item),
          labelSig: sig(lab!),
        };
      });
    }, LABELS);

    // Trạng thái ban đầu: chưa chọn sao nào
    const baseline = await readStars();
    expect(baseline, 'Phải tìm thấy đủ 5 nhãn sao (Rất tệ / Tệ / Tạm ổn / Tốt / Rất tốt) trong popup').not.toBeNull();
    await attachText('Review_Form_03_trang_thai_ban_dau', JSON.stringify(baseline, null, 2));
    const unselectedSig = baseline![0].iconSig;
    const unselectedLabelSig = baseline![0].labelSig;
    expect.soft(new Set(baseline!.map((s) => s.iconSig)).size, 'Ban đầu cả 5 sao phải cùng trạng thái (chưa chọn)').toBe(1);

    const summary: string[] = [];

    for (let level = 1; level <= 5; level++) {
      const text = LABELS[level - 1];

      await test.step(`Chọn ${level} sao: "${text}"`, async () => {
        await modal.getByText(text, { exact: true }).click();
        await page.waitForTimeout(700);

        const stars = await readStars();
        expect(stars, `Sau khi chọn "${text}" vẫn phải đọc được 5 sao`).not.toBeNull();

        // Sao nào khác trạng thái ban đầu = đang được tô
        const active = stars!.map((s) => s.iconSig !== unselectedSig);
        const activeCount = active.filter(Boolean).length;
        const expectedPattern = LABELS.map((_, i) => i < level);
        summary.push(`${level} sao "${text}": tô [${active.map((a) => (a ? '★' : '☆')).join('')}]`);
        console.log(`[Review_Form_03] ${summary[summary.length - 1]}`);

        expect.soft(activeCount, `Chọn "${text}" phải tô đúng ${level} sao`).toBe(level);
        expect.soft(active, `Các sao được tô phải liên tiếp từ sao thứ 1 đến sao thứ ${level}`).toEqual(expectedPattern);

        // Nhãn tương ứng phải nổi bật, 4 nhãn còn lại giữ trạng thái thường
        const chosen = stars![level - 1];
        expect.soft(chosen.labelSig, `Nhãn "${text}" phải nổi bật khác trạng thái ban đầu`).not.toBe(unselectedLabelSig);
        stars!.forEach((s, i) => {
          if (i !== level - 1) {
            expect.soft(s.labelSig, `Nhãn "${s.label}" không được nổi bật khi đang chọn "${text}"`).toBe(unselectedLabelSig);
          }
        });

        await shot(page, `Review_Form_03_chon_${level}_sao`);
      });
    }

    await attachText('Review_Form_03_tong_hop', summary.join('\n'));

    // Đổi lại mức thấp hơn: chọn 2 sao sau khi đang 5 sao -> chỉ còn 2 sao được tô
    await test.step('Đổi từ 5 sao về 2 sao', async () => {
      await modal.getByText('Tệ', { exact: true }).click();
      await page.waitForTimeout(700);
      const stars = await readStars();
      const activeCount = stars!.filter((s) => s.iconSig !== unselectedSig).length;
      expect.soft(activeCount, 'Đổi về "Tệ" thì chỉ còn 2 sao được tô').toBe(2);
    });

    // Không gửi đánh giá: chỉ đóng popup
    await closeReviewModal(page);
  });

  test('Review_Form_04: Kiểm tra nút [Gửi đánh giá] khi chỉ chọn sao, chưa đồng ý chính sách', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(120000);
    const SOFT = { timeout: 3000 };

    // Theo dõi request gửi đánh giá: chỉ đếm khi cờ bật (trong lúc ép bấm nút), chỉ tính API của web
    let watching = false;
    const postRequests: string[] = [];
    page.on('request', (req) => {
      if (watching && req.method() === 'POST' && /api\.dienmayxanh\.com/i.test(req.url())) postRequests.push(req.url());
    });

    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);

    const nameInput = modal.locator('input#fullName, input[name="fullName"]');
    const phoneInput = modal.locator('input#phone, input[name="phone"]');
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');

    // Step 1: chọn 3 sao (Tạm ổn), giữ nguyên Họ tên/SĐT điền sẵn, KHÔNG tick chính sách
    await modal.getByText('Tạm ổn', { exact: true }).click();
    await page.waitForTimeout(800);
    await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });

    await test.step('Điều kiện: Họ tên/SĐT đã có giá trị, chính sách chưa tick', async () => {
      await expect.soft(nameInput, 'Họ tên phải đã có giá trị').not.toHaveValue('', SOFT);
      await expect.soft(phoneInput, 'Số điện thoại phải đã có giá trị').not.toHaveValue('', SOFT);
      await expect.soft(agree, 'Checkbox chính sách mặc định chưa tick').not.toBeChecked(SOFT);
    });

    // Expected: nút [Gửi đánh giá] bị vô hiệu
    await test.step('Expected: nút [Gửi đánh giá] bị vô hiệu khi chưa đồng ý chính sách', async () => {
      await expect.soft(submit, 'Phải có nút [Gửi đánh giá]').toBeVisible(SOFT);
      await expect.soft(submit, 'Nút Gửi phải bị vô hiệu khi chưa đồng ý chính sách').toBeDisabled(SOFT);
    });
    await shot(page, 'Review_Form_04_chua_dong_y_chinh_sach');

    await test.step('Ép bấm nút bị vô hiệu: không gửi được', async () => {
      watching = true;
      await submit.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2000);
      watching = false;
      await attachText('Review_Form_04_request_khi_ep_bam', postRequests.join('\n') || '(không có request nào)');
      await expect.soft(modal, 'Popup vẫn phải mở (không gửi được)').toBeVisible(SOFT);
      expect.soft(postRequests, 'Không được có request gửi đánh giá nào khi bấm nút bị vô hiệu').toEqual([]);
    });

    // Đối chứng: tick rồi bỏ tick -> nút lại bị vô hiệu
    await test.step('Đối chứng: tick rồi bỏ tick chính sách', async () => {
      await setAgree(modal, page, true);
      await expect.soft(agree, 'Sau khi tick checkbox phải ở trạng thái đã chọn').toBeChecked(SOFT);
      const enabledWhenChecked = await submit.isEnabled().catch(() => false);
      await attachText('Review_Form_04_doi_chung', `Nút Gửi sau khi tick chính sách: ${enabledWhenChecked ? 'bật' : 'vẫn vô hiệu (có thể cần thêm nhận xét)'}`);
      console.log(`[Review_Form_04] Sau khi tick chính sách, nút Gửi: ${enabledWhenChecked ? 'bật' : 'vẫn vô hiệu'}`);
      await shot(page, 'Review_Form_04_sau_khi_tick');

      await setAgree(modal, page, false);
      await expect.soft(agree, 'Sau khi bỏ tick checkbox phải chưa chọn').not.toBeChecked(SOFT);
      await expect.soft(submit, 'Bỏ tick chính sách thì nút Gửi phải vô hiệu trở lại').toBeDisabled(SOFT);
    });

    // Không gửi gì: chỉ đóng popup
    await closeReviewModal(page);
  });

  test('Review_Form_05: Kiểm tra nút [Gửi đánh giá] khi đã đồng ý chính sách nhưng chưa chọn sao', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(120000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const COMMENT = 'Sản phẩm rất đáng tiền';
    const LABELS = ['Rất tệ', 'Tệ', 'Tạm ổn', 'Tốt', 'Rất tốt'];
    const observed: Record<string, unknown> = {};
 
    // Theo dõi request gửi đánh giá: chỉ đếm khi cờ bật (trong lúc ép bấm nút bị vô hiệu), chỉ tính API của web
    let watching = false;
    const postRequests: string[] = [];
    page.on('request', (req) => {
      if (watching && req.method() === 'POST' && /api\.dienmayxanh\.com/i.test(req.url())) postRequests.push(req.url());
    });
 
    // ---------- Pre-condition: đã đăng nhập, mở trang sản phẩm, click [Viết đánh giá] -> popup mở ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);
 
    const textarea = modal.locator('textarea#feeling, textarea').first();
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');
 
    // Nút "bật" = đang hiển thị VÀ không bị vô hiệu
    const isEnabled = async (loc: Locator): Promise<boolean> =>
      (await loc.isVisible().catch(() => false)) && (await loc.isEnabled().catch(() => false));
 
    // Chữ ký hiển thị của dải 5 sao (class + màu + biểu tượng): dùng để biết đang CHƯA chọn sao hay không
    const readStarSig = (): Promise<string> =>
      modal.evaluate((root, labels) => {
        const all = Array.from(root.querySelectorAll('*')) as HTMLElement[];
        const find = (t: string) => all.find((e) => e.children.length === 0 && (e.textContent || '').trim() === t);
        const first = find(labels[0]);
        const last = find(labels[labels.length - 1]);
        if (!first || !last) return '';
        let row: HTMLElement | null = first;
        while (row && !row.contains(last)) row = row.parentElement;
        if (!row) return '';
        return Array.from(row.querySelectorAll('*'))
          .map((n) => {
            const cs = getComputedStyle(n);
            return [n.tagName, n.getAttribute('class') || '', n.getAttribute('src') || '', n.getAttribute('fill') || '',
              cs.color, cs.fill, cs.backgroundColor, cs.backgroundPosition, cs.fontWeight].join('|');
          })
          .join('||');
      }, LABELS);
 
    // Ép bấm nút [Gửi đánh giá] CHỈ KHI nút đang bị vô hiệu (an toàn, không thể tạo đánh giá thật).
    // Nếu nút lại đang BẬT (lỗi) -> tuyệt đối KHÔNG bấm, chỉ ghi nhận.
    const tryForceSubmit = async (where: string): Promise<string> => {
      if (!(await submit.isVisible().catch(() => false))) return 'nut_gui_dang_an';
      if (await submit.isEnabled().catch(() => false)) {
        note('defect-note', `[Review_Form_05] ${where}: nút [Gửi đánh giá] đang BẬT dù chưa chọn sao -> KHÔNG bấm để tránh tạo đánh giá thật.`);
        return 'nut_dang_bat_khong_bam';
      }
      watching = true;
      await submit.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2000);
      watching = false;
      return 'da_ep_bam_nut_vo_hieu';
    };
 
    // ---------- Trạng thái ban đầu: KHÔNG chọn bất kỳ ngôi sao nào ----------
    const sigBefore = await readStarSig();
    expect(sigBefore, 'Phải đọc được dải 5 sao (Rất tệ → Rất tốt) trong popup').not.toBe('');
    const textareaVisibleBefore = await textarea.isVisible().catch(() => false);
    const agreeVisibleBefore = await agree.isVisible().catch(() => false);
    observed.truocKhiChonSao = {
      oNhanXetHienThi: textareaVisibleBefore,
      checkboxChinhSachHienThi: agreeVisibleBefore,
      nutGuiHienThi: await submit.isVisible().catch(() => false),
      nutGuiBat: await isEnabled(submit),
    };
    await shot(page, 'Review_Form_05_buoc0_chua_chon_sao');
 
    // ---------- Step 1 (theo Excel): tick đồng ý chính sách, nhập nhận xét, KHÔNG chọn sao ----------
    await test.step('Step 1: Tick đồng ý, nhập nhận xét khi CHƯA chọn sao', async () => {
      if (textareaVisibleBefore || agreeVisibleBefore) {
        // Giao diện cho thao tác khi chưa chọn sao -> làm đúng kịch bản của test case
        if (textareaVisibleBefore) await textarea.fill(COMMENT);
        if (agreeVisibleBefore) await setAgree(modal, page, true);
        await page.waitForTimeout(500);
        await shot(page, 'Review_Form_05_buoc1_da_tick_chua_chon_sao');
      } else {
        // Form mở rộng chỉ hiện SAU khi chọn sao (đúng như Review_Form_01) -> không thể tick/nhập khi chưa chọn sao
        note('rule-check', '[Review_Form_05] Chưa chọn sao thì ô nhận xét và checkbox chính sách chưa hiển thị -> không thể tick đồng ý/nhập nhận xét khi chưa chọn sao (bị chặn ngay từ giao diện).');
      }
    });
 
    // ---------- Expected 1: nút [Gửi đánh giá] vẫn bị vô hiệu (hoặc không gửi được) ----------
    await test.step('Expected 1: Chưa chọn sao thì nút [Gửi đánh giá] không được bật', async () => {
      const enabled = await isEnabled(submit);
      observed.nutGuiBatKhiChuaChonSao = enabled;
      expect.soft(enabled, 'Chưa chọn sao thì nút [Gửi đánh giá] phải bị vô hiệu hoặc không hiển thị').toBe(false);
 
      const how = await tryForceSubmit('khi chưa chọn sao');
      observed.epBamKhiChuaChonSao = how;
      await attachText('Review_Form_05_request_khi_chua_chon_sao', postRequests.join('\n') || '(không có request nào)');
      await expect.soft(modal, 'Popup vẫn phải mở (không gửi được)').toBeVisible(SOFT);
      expect.soft(postRequests, 'Không được có request gửi đánh giá nào khi chưa chọn sao').toEqual([]);
    });
 
    // ---------- Đối chứng: chọn sao -> tick + nhập nhận xét -> thử BỎ chọn sao bằng cách click lại đúng sao đó ----------
    // Mục đích: nếu web cho bỏ chọn sao mà form vẫn mở thì đây chính là trạng thái "đã đồng ý + có nhận xét + không có sao".
    await test.step('Đối chứng: chọn sao, tick đồng ý, nhập nhận xét rồi bỏ chọn sao (click lại cùng sao)', async () => {
      await modal.getByText('Tạm ổn', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });
 
      await textarea.fill(COMMENT);
      await setAgree(modal, page, true);
      await expect.soft(agree, 'Checkbox chính sách phải ở trạng thái đã chọn').toBeChecked(SOFT);
      const sigSelected = await readStarSig();
      expect.soft(sigSelected, 'Sau khi chọn sao, chữ ký dải sao phải khác trạng thái chưa chọn').not.toBe(sigBefore);
      await shot(page, 'Review_Form_05_doi_chung_da_chon_sao');
 
      // Click lại chính sao vừa chọn để thử bỏ chọn
      await modal.getByText('Tạm ổn', { exact: true }).click();
      await page.waitForTimeout(800);
      const sigAfter = await readStarSig();
      const deselected = sigAfter === sigBefore;
      observed.coTheBoChonSao = deselected;
      await shot(page, 'Review_Form_05_doi_chung_sau_khi_click_lai_sao');
 
      if (deselected) {
        // Đã về trạng thái "không có sao" -> kiểm tra nút Gửi
        const agreeStill = await agree.isVisible().catch(() => false) && (await agree.isChecked().catch(() => false));
        observed.chinhSachConTickSauKhiBoSao = agreeStill;
        const enabled = await isEnabled(submit);
        observed.nutGuiBatSauKhiBoSao = enabled;
        expect.soft(enabled, 'Đã đồng ý chính sách + có nhận xét nhưng không có sao thì nút [Gửi đánh giá] phải bị vô hiệu').toBe(false);
 
        postRequests.length = 0;
        observed.epBamSauKhiBoSao = await tryForceSubmit('sau khi bỏ chọn sao');
        await attachText('Review_Form_05_request_sau_khi_bo_sao', postRequests.join('\n') || '(không có request nào)');
        await expect.soft(modal, 'Popup vẫn phải mở (không gửi được)').toBeVisible(SOFT);
        expect.soft(postRequests, 'Không được có request gửi đánh giá nào khi không có sao').toEqual([]);
      } else {
        note('ux-note', '[Review_Form_05] Click lại đúng sao đang chọn không bỏ chọn được -> đã chọn sao thì luôn có sao; trạng thái "đồng ý chính sách nhưng chưa chọn sao" không thể xảy ra qua giao diện.');
      }
    });
 
    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_05_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_05] Số liệu ghi nhận:', JSON.stringify(observed));
    await shot(page, 'Review_Form_05_ket_thuc');
 
    // Không gửi gì lên web: chỉ đóng popup
    await closeReviewModal(page);
  });
 

  test('Review_Form_06: Kiểm tra nút [Gửi đánh giá] khi có sao + đồng ý nhưng không nhập nội dung', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(120000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const COMMENT = 'Nồi nấu cơm ngon, dễ dùng';
    const observed: Record<string, unknown> = {};

    // Theo dõi request gửi đánh giá: chỉ đếm khi cờ bật (trong lúc ép bấm nút bị vô hiệu), chỉ tính API của web
    let watching = false;
    const postRequests: string[] = [];
    page.on('request', (req) => {
      if (watching && req.method() === 'POST' && /api\.dienmayxanh\.com/i.test(req.url())) postRequests.push(req.url());
    });

    // ---------- Pre-condition: đã đăng nhập, mở trang sản phẩm, click [Viết đánh giá] -> popup mở ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);

    const textarea = modal.locator('textarea#feeling, textarea').first();
    const nameInput = modal.locator('input#fullName, input[name="fullName"]');
    const phoneInput = modal.locator('input#phone, input[name="phone"]');
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');

    // Nút "bật" = đang hiển thị VÀ không bị vô hiệu
    const isEnabled = async (): Promise<boolean> =>
      (await submit.isVisible().catch(() => false)) && (await submit.isEnabled().catch(() => false));

    // ---------- Step 1 (theo Excel): chọn 5 sao, tick đồng ý, để trống ô nhận xét ----------
    await test.step('Step 1: Chọn 5 sao (Rất tốt), tick đồng ý, để trống ô nhận xét', async () => {
      await modal.getByText('Rất tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });

      // Họ tên/SĐT phải hợp lệ để chỉ có "nội dung nhận xét" là biến đang được kiểm tra
      if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
      if (!(await phoneInput.inputValue())) await phoneInput.fill(TEST_PHONE);

      await textarea.fill('');
      await setAgree(modal, page, true);
      await page.waitForTimeout(500);

      await expect.soft(textarea, 'Ô nhận xét phải để trống').toHaveValue('', SOFT);
      await expect.soft(agree, 'Checkbox chính sách phải ở trạng thái đã chọn').toBeChecked(SOFT);
      await expect.soft(nameInput, 'Họ tên phải có giá trị').not.toHaveValue('', SOFT);
      await expect.soft(phoneInput, 'Số điện thoại phải có giá trị').not.toHaveValue('', SOFT);
      await shot(page, 'Review_Form_06_buoc1_de_trong_nhan_xet');
    });

    // ---------- Expected 1: xác định nội dung nhận xét có bắt buộc hay không ----------
    let contentRequired = false;

    await test.step('Expected 1: Xác định nội dung nhận xét có bắt buộc hay không', async () => {
      await expect.soft(submit, 'Phải có nút [Gửi đánh giá]').toBeVisible(SOFT);
      const enabled = await isEnabled();
      contentRequired = !enabled;
      observed.nutGuiBatKhiDeTrongNhanXet = enabled;
      observed.noiDungNhanXetBatBuoc = contentRequired;
      console.log(`[Review_Form_06] Để trống nhận xét -> nút Gửi ${enabled ? 'BẬT' : 'vô hiệu'} => nhận xét ${contentRequired ? 'BẮT BUỘC' : 'KHÔNG bắt buộc (tùy chọn)'}`);
      note('rule-check', `[Review_Form_06] Ô nhận xét là ${contentRequired ? 'BẮT BUỘC (nút Gửi bị vô hiệu khi để trống)' : 'TÙY CHỌN (nút Gửi vẫn bật khi để trống)'} -> cập nhật Expected Output/Note trong Excel.`);
    });

    // ---------- Nhánh A: nội dung BẮT BUỘC -> nút vô hiệu, không gửi được, nhập nội dung thì bật ----------
    // ---------- Nhánh B: nội dung TÙY CHỌN -> nút bật (TUYỆT ĐỐI không bấm để tránh tạo đánh giá thật) ----------
    if (contentRequired) {
      await test.step('Nhánh A: Nhận xét bắt buộc -> nút Gửi vô hiệu, ép bấm cũng không gửi được', async () => {
        await expect.soft(submit, 'Nhận xét bắt buộc thì nút Gửi phải bị vô hiệu khi để trống').toBeDisabled(SOFT);

        watching = true;
        await submit.click({ force: true, timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(2000);
        watching = false;
        await attachText('Review_Form_06_request_khi_ep_bam', postRequests.join('\n') || '(không có request nào)');
        await expect.soft(modal, 'Popup vẫn phải mở (không gửi được)').toBeVisible(SOFT);
        expect.soft(postRequests, 'Không được có request gửi đánh giá nào khi để trống nhận xét').toEqual([]);
      });

      await test.step('Đối chứng: nhập nhận xét -> nút Gửi bật (chứng minh nút bị khóa do thiếu nội dung)', async () => {
        await textarea.fill(COMMENT);
        await page.waitForTimeout(500);
        const enabledWithContent = await isEnabled();
        observed.nutGuiBatSauKhiNhapNoiDung = enabledWithContent;
        expect.soft(enabledWithContent, 'Có đủ sao + đồng ý + nhận xét + họ tên/SĐT thì nút Gửi phải bật').toBe(true);
        await shot(page, 'Review_Form_06_doi_chung_da_nhap_noi_dung');
        // Không bấm gửi
      });
    } else {
      await test.step('Nhánh B: Nhận xét tùy chọn -> nút Gửi bật khi để trống (KHÔNG bấm gửi)', async () => {
        await expect.soft(submit, 'Nhận xét tùy chọn thì nút Gửi phải được bật khi đủ sao + đồng ý').toBeEnabled(SOFT);
        await shot(page, 'Review_Form_06_nut_gui_bat_khi_de_trong');
      });

      await test.step('Đối chứng: bỏ tick đồng ý -> nút Gửi vô hiệu lại (chứng minh nút phụ thuộc đúng điều kiện)', async () => {
        await setAgree(modal, page, false);
        await expect.soft(agree, 'Sau khi bỏ tick checkbox phải chưa chọn').not.toBeChecked(SOFT);
        await expect.soft(submit, 'Bỏ tick đồng ý thì nút Gửi phải vô hiệu trở lại').toBeDisabled(SOFT);
        await setAgree(modal, page, true);
      });
    }

    // ---------- Biên: nhận xét chỉ toàn khoảng trắng (chỉ ghi nhận, không kết luận đúng/sai) ----------
    await test.step('Biên: nhận xét chỉ toàn khoảng trắng', async () => {
      await textarea.fill('     ');
      await page.waitForTimeout(500);
      const enabledWhitespace = await isEnabled();
      observed.nutGuiBatKhiNhanXetToanKhoangTrang = enabledWhitespace;
      console.log(`[Review_Form_06] Nhận xét toàn khoảng trắng -> nút Gửi ${enabledWhitespace ? 'BẬT' : 'vô hiệu'}`);
      if (contentRequired && enabledWhitespace) {
        note('defect-note', '[Review_Form_06] [Cần xác nhận] Nhận xét bắt buộc nhưng chuỗi toàn khoảng trắng vẫn làm nút Gửi bật -> có thể gửi đánh giá "trống" (cần trim).');
      }
      await shot(page, 'Review_Form_06_nhan_xet_toan_khoang_trang');
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_06_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_06] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: xóa dữ liệu đã nhập và đóng popup
    await textarea.fill('').catch(() => {});
    await closeReviewModal(page);
  });

  test('Review_Form_07: Kiểm tra nút [Gửi đánh giá] được bật khi nhập đủ thông tin hợp lệ', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(120000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const COMMENT = 'Nồi nấu cơm ngon, dễ dùng';
    const observed: Record<string, unknown> = {};

    // ---------- Pre-condition: đã đăng nhập, mở trang sản phẩm, click [Viết đánh giá] -> popup mở ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);

    const textarea = modal.locator('textarea#feeling, textarea').first();
    const nameInput = modal.locator('input#fullName, input[name="fullName"]');
    const phoneInput = modal.locator('input#phone, input[name="phone"]');
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');

    // Màu nền + màu chữ của nút: dùng để kiểm tra "màu xanh đậm" (bật) khác "màu nhạt" (vô hiệu)
    const readButtonColor = (): Promise<string> =>
      submit.evaluate((el) => {
        const cs = getComputedStyle(el);
        return `${cs.backgroundColor}|${cs.color}|${cs.opacity}`;
      }).catch(() => '');

    // ---------- Step 1 (theo Excel): chọn 4 sao (Tốt) ----------
    await test.step('Step 1: Chọn 4 sao (Tốt)', async () => {
      await modal.getByText('Tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });
    });

    // ---------- Step 2: nhập nhận xét hợp lệ ----------
    await test.step(`Step 2: Nhập nhận xét "${COMMENT}"`, async () => {
      await textarea.fill(COMMENT);
      await expect.soft(textarea, 'Ô nhận xét phải nhận đúng nội dung vừa nhập').toHaveValue(COMMENT, SOFT);
    });

    // ---------- Step 3: giữ Họ tên/SĐT hợp lệ (điền sẵn từ tài khoản; nếu trống thì điền) ----------
    await test.step('Step 3: Họ tên và SĐT hợp lệ', async () => {
      if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
      if (!(await phoneInput.inputValue())) await phoneInput.fill(TEST_PHONE);
      await expect.soft(nameInput, 'Họ tên phải có giá trị').not.toHaveValue('', SOFT);
      await expect.soft(phoneInput, 'Số điện thoại phải có giá trị').not.toHaveValue('', SOFT);
      observed.hoTen = await nameInput.inputValue();
      observed.sdtDaCo = (await phoneInput.inputValue()).replace(/\D/g, '').length;
    });

    // ---------- Đối chứng trước khi tick: chưa đồng ý chính sách thì nút phải vô hiệu ----------
    let colorDisabled = '';
    await test.step('Đối chứng: chưa tick đồng ý chính sách -> nút Gửi vô hiệu', async () => {
      await expect.soft(agree, 'Checkbox chính sách mặc định chưa tick').not.toBeChecked(SOFT);
      await expect.soft(submit, 'Phải có nút [Gửi đánh giá]').toBeVisible(SOFT);
      await expect.soft(submit, 'Chưa đồng ý chính sách thì nút Gửi phải vô hiệu').toBeDisabled(SOFT);
      colorDisabled = await readButtonColor();
      observed.mauNutKhiVoHieu = colorDisabled;
      await shot(page, 'Review_Form_07_truoc_khi_tick_dong_y');
    });

    // ---------- Step 4 / Expected 1: tick đồng ý -> nút [Gửi đánh giá] được bật ----------
    let colorEnabled = '';
    await test.step('Step 4: Tick đồng ý Chính sách dữ liệu cá nhân', async () => {
      await setAgree(modal, page, true);
      await page.waitForTimeout(500);
      await expect.soft(agree, 'Checkbox chính sách phải ở trạng thái đã chọn').toBeChecked(SOFT);
    });

    await test.step('Expected 1: Nút [Gửi đánh giá] được bật (màu xanh đậm)', async () => {
      await expect.soft(submit, 'Đủ sao + nhận xét + Họ tên/SĐT + đồng ý thì nút Gửi phải được bật').toBeEnabled(SOFT);
      colorEnabled = await readButtonColor();
      observed.mauNutKhiBat = colorEnabled;
      expect.soft(colorEnabled, 'Nút khi bật phải đổi màu so với lúc vô hiệu (xanh đậm thay vì màu nhạt)').not.toBe(colorDisabled);
      await shot(page, 'Review_Form_07_nut_gui_dang_bat');
      // TUYỆT ĐỐI không bấm [Gửi đánh giá]: tránh tạo đánh giá thật trên Production
    });

    // ---------- Expected 2: bỏ tick đồng ý -> nút bị vô hiệu lại ----------
    await test.step('Expected 2: Bỏ tick đồng ý -> nút Gửi vô hiệu trở lại', async () => {
      await setAgree(modal, page, false);
      await page.waitForTimeout(500);
      await expect.soft(agree, 'Sau khi bỏ tick checkbox phải chưa chọn').not.toBeChecked(SOFT);
      await expect.soft(submit, 'Bỏ tick đồng ý thì nút Gửi phải vô hiệu ngay').toBeDisabled(SOFT);
      const colorAfter = await readButtonColor();
      observed.mauNutSauKhiBoTick = colorAfter;
      expect.soft(colorAfter, 'Sau khi bỏ tick, màu nút phải trở về như lúc vô hiệu').toBe(colorDisabled);
      await shot(page, 'Review_Form_07_sau_khi_bo_tick');
    });

    // ---------- Đối chứng: tick lại -> nút bật lại (kiểm tra bật/tắt nhiều lần, không bị kẹt trạng thái) ----------
    await test.step('Đối chứng: tick lại -> nút Gửi bật lại', async () => {
      await setAgree(modal, page, true);
      await page.waitForTimeout(500);
      await expect.soft(submit, 'Tick lại thì nút Gửi phải bật lại').toBeEnabled(SOFT);
      await setAgree(modal, page, false);   // trả về trạng thái chưa đồng ý trước khi đóng popup
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_07_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_07] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: chỉ đóng popup
    await closeReviewModal(page);
  });

  test('Review_Form_08: Kiểm tra trường [Họ tên (bắt buộc)]', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(150000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const COMMENT = 'Nồi nấu cơm ngon, dễ dùng';
    const observed: Record<string, unknown> = {};

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Theo dõi request gửi đánh giá: chỉ đếm khi cờ bật (trong lúc ép bấm nút bị vô hiệu), chỉ tính API của web
    let watching = false;
    const postRequests: string[] = [];
    page.on('request', (req) => {
      if (watching && req.method() === 'POST' && /api\.dienmayxanh\.com/i.test(req.url())) postRequests.push(req.url());
    });

    // Dữ liệu thử theo từng bước của test case
    const NAME_50 = 'Nguyễn Võ Quang Minh '.repeat(3).slice(0, 50);   // tên có dấu, đúng 50 ký tự
    const NAME_LONG = 'Nguyễn Võ Quang Minh '.repeat(6);              // 126 ký tự (>= 100)
    const NAME_SPECIAL = 'Minh Tester @#$% 123';                       // có số và ký tự đặc biệt

    // ---------- Pre-condition: đã đăng nhập, mở trang sản phẩm, click [Viết đánh giá] -> popup mở ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);

    const textarea = modal.locator('textarea#feeling, textarea').first();
    const nameInput = modal.locator('input#fullName, input[name="fullName"]');
    const phoneInput = modal.locator('input#phone, input[name="phone"]');
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');

    const isEnabled = async (): Promise<boolean> =>
      (await submit.isVisible().catch(() => false)) && (await submit.isEnabled().catch(() => false));

    // Popup có bị tràn ngang không (tên quá dài làm vỡ giao diện)
    const readOverflow = () =>
      modal.evaluate((root) => {
        const input = root.querySelector('input#fullName, input[name="fullName"]') as HTMLInputElement | null;
        const m = root as HTMLElement;
        const mr = m.getBoundingClientRect();
        const ir = input ? input.getBoundingClientRect() : null;
        return {
          modalOverflowX: m.scrollWidth > m.clientWidth + 1,
          inputInsideModal: ir ? ir.left >= mr.left - 1 && ir.right <= mr.right + 1 : true,
          maxlength: input ? input.getAttribute('maxlength') : null,
        };
      });

    // Ép bấm nút CHỈ KHI nút đang bị vô hiệu (an toàn). Nút đang BẬT thì tuyệt đối KHÔNG bấm.
    const forceSubmitIfDisabled = async (where: string): Promise<string> => {
      if (await isEnabled()) return 'nut_dang_bat_khong_bam';
      postRequests.length = 0;
      watching = true;
      await submit.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1500);
      watching = false;
      await attachText(`Review_Form_08_request_${where}`, postRequests.join('\n') || '(không có request nào)');
      expect.soft(postRequests, `[${where}] Không được có request gửi đánh giá khi nút bị vô hiệu`).toEqual([]);
      return 'da_ep_bam_nut_vo_hieu';
    };

    // Nhập tên: dùng gõ từng phím để trình duyệt tự áp dụng maxlength (fill() có thể bỏ qua maxlength)
    const typeName = async (value: string, human = false) => {
      await nameInput.fill('');
      if (value) {
        if (human) await nameInput.pressSequentially(value);
        else await nameInput.fill(value);
      }
      await page.waitForTimeout(400);
    };

    // ---------- Điều kiện: đã chọn đủ sao, nhận xét, SĐT hợp lệ, tick đồng ý -> chỉ còn Họ tên là biến thử ----------
    await test.step('Điều kiện: chọn sao, nhập nhận xét, SĐT hợp lệ, tick đồng ý', async () => {
      await modal.getByText('Tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });
      await textarea.fill(COMMENT);
      if (!(await phoneInput.inputValue())) await phoneInput.fill(TEST_PHONE);
      await setAgree(modal, page, true);
      await expect.soft(agree, 'Checkbox chính sách phải ở trạng thái đã chọn').toBeChecked(SOFT);
    });

    // ---------- Đối chứng: Họ tên điền sẵn hợp lệ thì nút Gửi phải bật (để biết các lần vô hiệu sau là do Họ tên) ----------
    await test.step('Đối chứng: Họ tên điền sẵn hợp lệ -> nút Gửi bật', async () => {
      if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
      await page.waitForTimeout(400);
      const enabled = await isEnabled();
      observed.doiChung_nutBatKhiHoTenHopLe = enabled;
      expect.soft(enabled, 'Đủ sao + nhận xét + Họ tên + SĐT + đồng ý thì nút Gửi phải bật').toBe(true);
      await shot(page, 'Review_Form_08_doi_chung_ho_ten_hop_le');
    });

    // ---------- Step 1 / Expected 1: xóa trống Họ tên ----------
    await test.step('Step 1: Xóa trống Họ tên -> nút Gửi vô hiệu / báo bắt buộc', async () => {
      await typeName('');
      const enabled = await isEnabled();
      observed.buoc1_trong = { nutBat: enabled };
      await expect.soft(nameInput, 'Ô Họ tên phải trống').toHaveValue('', SOFT);
      expect.soft(enabled, 'Họ tên trống thì nút Gửi phải bị vô hiệu').toBe(false);
      (observed.buoc1_trong as any).epBam = await forceSubmitIfDisabled('ho_ten_trong');
      await shot(page, 'Review_Form_08_buoc1_ho_ten_trong');
    });

    // ---------- Step 2 / Expected 2: chỉ toàn khoảng trắng ----------
    await test.step('Step 2: Họ tên chỉ toàn khoảng trắng -> coi là trống', async () => {
      await typeName('     ');
      const enabled = await isEnabled();
      observed.buoc2_khoangTrang = { nutBat: enabled };
      expect.soft(enabled, 'Họ tên toàn khoảng trắng phải bị coi là trống (nút Gửi vô hiệu)').toBe(false);
      if (enabled) {
        note('defect-note', '[Review_Form_08] Họ tên chỉ toàn khoảng trắng nhưng nút [Gửi đánh giá] vẫn BẬT -> thiếu trim, có thể gửi đánh giá với tên trống. KHÔNG bấm gửi.');
      } else {
        (observed.buoc2_khoangTrang as any).epBam = await forceSubmitIfDisabled('ho_ten_khoang_trang');
      }
      await shot(page, 'Review_Form_08_buoc2_khoang_trang');
    });

    // ---------- Step 3 / Expected 3: tên có dấu dài 50 ký tự -> chấp nhận ----------
    await test.step('Step 3: Họ tên có dấu, 50 ký tự -> chấp nhận', async () => {
      await typeName(NAME_50);
      const val = await nameInput.inputValue();
      const enabled = await isEnabled();
      observed.buoc3_50kyTu = { gioTri: val, doDai: val.length, nutBat: enabled };
      expect.soft(val, 'Ô Họ tên phải giữ nguyên tên có dấu 50 ký tự').toBe(NAME_50);
      expect.soft(enabled, 'Họ tên hợp lệ 50 ký tự thì nút Gửi phải bật').toBe(true);
      await shot(page, 'Review_Form_08_buoc3_50_ky_tu');
    });

    // ---------- Step 4 / Expected 4: tên rất dài (>= 100 ký tự) -> giới hạn độ dài hoặc báo lỗi, không vỡ giao diện ----------
    await test.step('Step 4: Họ tên rất dài (>= 100 ký tự)', async () => {
      await typeName(NAME_LONG, true);
      const val = await nameInput.inputValue();
      const enabled = await isEnabled();
      const ov = await readOverflow();
      observed.buoc4_rat_dai = { daNhap: NAME_LONG.length, thucTe: val.length, nutBat: enabled, ...ov };
      console.log(`[Review_Form_08] Nhập ${NAME_LONG.length} ký tự -> nhận ${val.length} ký tự (maxlength=${ov.maxlength}), nút Gửi ${enabled ? 'BẬT' : 'vô hiệu'}`);

      // Hoặc bị cắt bớt (giới hạn độ dài), hoặc nút Gửi bị vô hiệu (báo lỗi)
      expect.soft(val.length < NAME_LONG.length || !enabled, `Tên ${NAME_LONG.length} ký tự phải bị giới hạn độ dài hoặc bị chặn gửi, thực tế nhận ${val.length} và nút ${enabled ? 'bật' : 'tắt'}`).toBe(true);
      expect.soft(ov.modalOverflowX, 'Tên dài không được làm popup tràn ngang').toBe(false);
      expect.soft(ov.inputInsideModal, 'Ô Họ tên phải nằm trọn trong popup').toBe(true);
      if (val.length >= NAME_LONG.length && enabled) {
        note('defect-note', `[Review_Form_08] [Cần xác nhận] Họ tên ${val.length} ký tự được chấp nhận hoàn toàn, không có giới hạn độ dài. KHÔNG bấm gửi.`);
      }
      await shot(page, 'Review_Form_08_buoc4_rat_dai');
    });

    // ---------- Step 5 / Expected 5: có số và ký tự đặc biệt (@#$%) ----------
    await test.step('Step 5: Họ tên chứa số và ký tự đặc biệt (@#$%)', async () => {
      await typeName(NAME_SPECIAL);
      const val = await nameInput.inputValue();
      const enabled = await isEnabled();
      observed.buoc5_kyTuDacBiet = { gioTri: val, nutBat: enabled, biLocKyTu: val !== NAME_SPECIAL };
      console.log(`[Review_Form_08] Họ tên "${NAME_SPECIAL}" -> giá trị "${val}", nút Gửi ${enabled ? 'BẬT' : 'vô hiệu'}`);
      note('rule-check', `[Review_Form_08] Họ tên có số/ký tự đặc biệt: ${val !== NAME_SPECIAL ? 'ký tự bị lọc khi nhập' : enabled ? 'được CHẤP NHẬN (nút Gửi bật)' : 'bị CHẶN (nút Gửi vô hiệu)'} -> cập nhật Expected Output trong Excel.`);
      await expect.soft(modal, 'Popup vẫn phải hiển thị, không lỗi').toBeVisible(SOFT);
      await shot(page, 'Review_Form_08_buoc5_ky_tu_dac_biet');
    });

    // ---------- Expected chung: không lỗi hệ thống ----------
    await test.step('Expected chung: Không phát sinh lỗi JavaScript', async () => {
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_08_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_08] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: trả Họ tên về giá trị hợp lệ rồi đóng popup
    await nameInput.fill(TEST_NAME).catch(() => {});
    await closeReviewModal(page);
  });

  test('Review_Form_09: Kiểm tra trường [Số điện thoại (bắt buộc)]', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(150000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const COMMENT = 'Nồi nấu cơm ngon, dễ dùng';
    const observed: Record<string, unknown> = {};

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Theo dõi request gửi đánh giá: chỉ đếm khi cờ bật (trong lúc ép bấm nút bị vô hiệu), chỉ tính API của web
    let watching = false;
    const postRequests: string[] = [];
    page.on('request', (req) => {
      if (watching && req.method() === 'POST' && /api\.dienmayxanh\.com/i.test(req.url())) postRequests.push(req.url());
    });

    // Dữ liệu thử theo từng bước của test case
    const PHONE_9 = '097817377';          // thiếu số
    const PHONE_10 = TEST_PHONE;           // 0978173770 - hợp lệ
    const PHONE_11 = '09781737701';        // thừa số
    const PHONE_LETTERS = '09781abc70';    // có chữ cái
    const PHONE_SPECIAL = '0978-173-770';  // có ký tự đặc biệt
    const PHONE_NO_ZERO = '9781737701';    // 10 số nhưng không bắt đầu bằng 0

    // ---------- Pre-condition: đã đăng nhập, mở trang sản phẩm, click [Viết đánh giá] -> popup mở ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);

    const textarea = modal.locator('textarea#feeling, textarea').first();
    const nameInput = modal.locator('input#fullName, input[name="fullName"]');
    const phoneInput = modal.locator('input#phone, input[name="phone"]');
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');

    const isEnabled = async (): Promise<boolean> =>
      (await submit.isVisible().catch(() => false)) && (await submit.isEnabled().catch(() => false));

    // Thông báo lỗi SĐT (nếu web có hiện): bỏ qua nhãn "(bắt buộc)" luôn có sẵn
    const readError = async (): Promise<string> => {
      const text = ((await modal.innerText().catch(() => '')) || '').replace(/\u00a0/g, ' ');
      const m = text.match(/[^\n]*(không hợp lệ|không đúng định dạng|sai định dạng|vui lòng nhập)[^\n]*/i);
      return m ? m[0].trim() : '';
    };

    // Ép bấm nút CHỈ KHI nút đang bị vô hiệu (an toàn). Nút đang BẬT thì tuyệt đối KHÔNG bấm.
    const forceSubmitIfDisabled = async (where: string): Promise<string> => {
      if (await isEnabled()) return 'nut_dang_bat_khong_bam';
      postRequests.length = 0;
      watching = true;
      await submit.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1500);
      watching = false;
      await attachText(`Review_Form_09_request_${where}`, postRequests.join('\n') || '(không có request nào)');
      expect.soft(postRequests, `[${where}] Không được có request gửi đánh giá khi nút bị vô hiệu`).toEqual([]);
      return 'da_ep_bam_nut_vo_hieu';
    };

    // Nhập SĐT bằng cách gõ từng phím để trình duyệt tự áp dụng maxlength/lọc ký tự (fill() có thể bỏ qua)
    const typePhone = async (value: string) => {
      await phoneInput.fill('');
      if (value) await phoneInput.pressSequentially(value);
      await page.waitForTimeout(500);
    };

    // Chạy 1 trường hợp: nhập -> đọc giá trị thực tế, trạng thái nút, thông báo lỗi
    const runCase = async (key: string, typed: string) => {
      await typePhone(typed);
      const val = await phoneInput.inputValue();
      const enabled = await isEnabled();
      const err = await readError();
      // "Bị từ chối" = ký tự bị lọc/cắt bớt, hoặc nút Gửi bị vô hiệu, hoặc có báo lỗi
      const rejected = val !== typed || !enabled || err !== '';
      const result = { nhap: typed, thucTe: val, nutBat: enabled, thongBaoLoi: err, biTuChoi: rejected };
      observed[key] = result;
      console.log(`[Review_Form_09] ${key}: nhập "${typed}" -> giá trị "${val}", nút ${enabled ? 'BẬT' : 'vô hiệu'}${err ? `, lỗi: ${err}` : ''}`);
      return result;
    };

    // ---------- Điều kiện: đã chọn đủ sao, nhận xét, Họ tên hợp lệ, tick đồng ý -> chỉ còn SĐT là biến thử ----------
    await test.step('Điều kiện: chọn sao, nhập nhận xét, Họ tên hợp lệ, tick đồng ý', async () => {
      await modal.getByText('Tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });
      await textarea.fill(COMMENT);
      if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
      await setAgree(modal, page, true);
      await expect.soft(agree, 'Checkbox chính sách phải ở trạng thái đã chọn').toBeChecked(SOFT);

      // Thuộc tính ô SĐT: gợi ý web có chủ động lọc/giới hạn hay không
      observed.thuocTinhOSdt = {
        type: await phoneInput.getAttribute('type'),
        inputmode: await phoneInput.getAttribute('inputmode'),
        maxlength: await phoneInput.getAttribute('maxlength'),
        pattern: await phoneInput.getAttribute('pattern'),
      };
    });

    // ---------- Đối chứng: SĐT điền sẵn hợp lệ thì nút Gửi phải bật (để biết các lần vô hiệu sau là do SĐT) ----------
    await test.step('Đối chứng: SĐT điền sẵn hợp lệ -> nút Gửi bật', async () => {
      if (!(await phoneInput.inputValue())) await phoneInput.fill(PHONE_10);
      await page.waitForTimeout(400);
      const enabled = await isEnabled();
      observed.doiChung_nutBatKhiSdtHopLe = enabled;
      expect.soft(enabled, 'Đủ sao + nhận xét + Họ tên + SĐT + đồng ý thì nút Gửi phải bật').toBe(true);
      await shot(page, 'Review_Form_09_doi_chung_sdt_hop_le');
    });

    // ---------- Step 1 / Expected 1: xóa trống SĐT ----------
    await test.step('Step 1: Xóa trống SĐT -> nút Gửi vô hiệu / báo bắt buộc', async () => {
      const r = await runCase('buoc1_trong', '');
      expect.soft(r.nutBat, 'SĐT trống thì nút Gửi phải bị vô hiệu').toBe(false);
      (observed.buoc1_trong as any).epBam = await forceSubmitIfDisabled('sdt_trong');
      await shot(page, 'Review_Form_09_buoc1_sdt_trong');
    });

    // ---------- Step 2 / Expected 2: 9 chữ số (097817377) -> không hợp lệ ----------
    await test.step('Step 2: Nhập 9 chữ số -> báo SĐT không hợp lệ', async () => {
      const r = await runCase('buoc2_9so', PHONE_9);
      expect.soft(r.nutBat || r.thongBaoLoi !== '' ? r.thongBaoLoi !== '' : true, '9 chữ số: nếu nút còn bật thì phải có thông báo SĐT không hợp lệ').toBe(true);
      expect.soft(r.nutBat, '9 chữ số (thiếu số) thì nút Gửi phải bị vô hiệu').toBe(false);
      if (r.nutBat) {
        note('defect-note', '[Review_Form_09] SĐT 9 chữ số nhưng nút [Gửi đánh giá] vẫn BẬT -> không kiểm tra độ dài SĐT. KHÔNG bấm gửi.');
      } else {
        (observed.buoc2_9so as any).epBam = await forceSubmitIfDisabled('sdt_9_so');
      }
      await shot(page, 'Review_Form_09_buoc2_9_so');
    });

    // ---------- Step 3 / Expected 3: 10 chữ số hợp lệ (0978173770) -> chấp nhận ----------
    await test.step('Step 3: Nhập 10 chữ số hợp lệ -> chấp nhận', async () => {
      const r = await runCase('buoc3_10so', PHONE_10);
      expect.soft(r.thucTe, 'Ô SĐT phải giữ nguyên SĐT 10 số hợp lệ').toBe(PHONE_10);
      expect.soft(r.nutBat, 'SĐT 10 số hợp lệ thì nút Gửi phải bật').toBe(true);
      expect.soft(r.thongBaoLoi, 'SĐT hợp lệ không được hiện thông báo lỗi').toBe('');
      await shot(page, 'Review_Form_09_buoc3_10_so_hop_le');
    });

    // ---------- Step 4 / Expected 4: 11 chữ số (09781737701) -> báo không hợp lệ hoặc không cho nhập thêm ----------
    await test.step('Step 4: Nhập 11 chữ số -> báo không hợp lệ hoặc không cho nhập thêm', async () => {
      const r = await runCase('buoc4_11so', PHONE_11);
      expect.soft(r.biTuChoi, `11 chữ số phải bị cắt bớt, bị chặn gửi hoặc báo lỗi, thực tế giá trị "${r.thucTe}", nút ${r.nutBat ? 'bật' : 'tắt'}`).toBe(true);
      if (!r.biTuChoi) {
        note('defect-note', '[Review_Form_09] SĐT 11 chữ số được chấp nhận hoàn toàn, nút Gửi vẫn bật. KHÔNG bấm gửi.');
      }
      await shot(page, 'Review_Form_09_buoc4_11_so');
    });

    // ---------- Step 5 / Expected 5: chữ cái và ký tự đặc biệt ----------
    await test.step('Step 5a: Nhập chữ cái (09781abc70) -> không chấp nhận chữ', async () => {
      const r = await runCase('buoc5a_chuCai', PHONE_LETTERS);
      const hasLetters = /[a-zA-Z]/.test(r.thucTe);
      // Chữ cái chỉ được tồn tại trong ô nếu web chặn gửi hoặc báo lỗi
      expect.soft(hasLetters ? (r.nutBat === false && r.thongBaoLoi !== '') : true,
        `SĐT có chữ cái "${r.thucTe}" thì nút Gửi phải bị vô hiệu và có báo lỗi, thực tế nút ${r.nutBat ? 'bật' : 'tắt'}, lỗi "${r.thongBaoLoi}"`).toBe(true);
      expect.soft(r.biTuChoi, 'SĐT có chữ cái phải bị lọc, chặn gửi hoặc báo lỗi').toBe(true);
      if (hasLetters && r.nutBat) {
        note('defect-note', `[Review_Form_09] SĐT chứa chữ cái "${r.thucTe}" nhưng nút [Gửi đánh giá] vẫn BẬT. KHÔNG bấm gửi.`);
      }
      await shot(page, 'Review_Form_09_buoc5a_chu_cai');
    });

    await test.step('Step 5b: Nhập ký tự đặc biệt (0978-173-770) -> bị chặn hoặc báo lỗi', async () => {
      const r = await runCase('buoc5b_kyTuDacBiet', PHONE_SPECIAL);
      expect.soft(/[^\d]/.test(r.thucTe) ? r.nutBat === false || r.thongBaoLoi !== '' : true, `Ký tự đặc biệt chỉ được tồn tại nếu nút Gửi bị vô hiệu hoặc có báo lỗi, thực tế "${r.thucTe}"`).toBe(true);
      if (/[^\d]/.test(r.thucTe) && r.nutBat) {
        note('defect-note', `[Review_Form_09] SĐT chứa ký tự đặc biệt "${r.thucTe}" nhưng nút [Gửi đánh giá] vẫn BẬT. KHÔNG bấm gửi.`);
      }
      await shot(page, 'Review_Form_09_buoc5b_ky_tu_dac_biet');
    });

    // ---------- Step 6 / Expected 6: 10 số không bắt đầu bằng 0 (9781737701) -> không hợp lệ ----------
    await test.step('Step 6: Nhập 10 số không bắt đầu bằng 0 -> báo SĐT không hợp lệ', async () => {
      const r = await runCase('buoc6_khongBatDauBang0', PHONE_NO_ZERO);
      expect.soft(r.nutBat, 'SĐT 10 số không bắt đầu bằng 0 thì nút Gửi phải bị vô hiệu (hoặc báo không hợp lệ)').toBe(false);
      if (r.nutBat) {
        note('defect-note', '[Review_Form_09] SĐT 10 số không bắt đầu bằng 0 vẫn được chấp nhận, nút Gửi BẬT -> không kiểm tra đầu số. KHÔNG bấm gửi.');
      } else {
        (observed.buoc6_khongBatDauBang0 as any).epBam = await forceSubmitIfDisabled('sdt_khong_bat_dau_0');
      }
      await shot(page, 'Review_Form_09_buoc6_khong_bat_dau_bang_0');
    });

    // ---------- Expected chung: không lỗi hệ thống ----------
    await test.step('Expected chung: Popup vẫn hiển thị, không phát sinh lỗi JavaScript', async () => {
      await expect.soft(modal, 'Popup vẫn phải hiển thị').toBeVisible(SOFT);
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_09_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_09] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: trả SĐT về giá trị hợp lệ rồi đóng popup
    await phoneInput.fill(PHONE_10).catch(() => {});
    await closeReviewModal(page);
  });

  test('Review_Form_10: Kiểm tra thông tin điền sẵn có chỉnh sửa được không', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(150000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const COMMENT = 'Nồi nấu cơm ngon, dễ dùng';
    const NEW_NAME = 'Người Dùng Mới';
    const NEW_PHONE = '0987654321';
    const observed: Record<string, unknown> = {};

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Theo dõi request gửi đánh giá: test này tuyệt đối không được gửi gì lên server.
    // Lưu ý: POST .../api/Comment/Product/Code là request TẢI danh sách đánh giá (chạy mỗi lần mở/tải lại trang) -> loại ra.
    const postRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (
        req.method() === 'POST' &&
        /api\.dienmayxanh\.com/i.test(url) &&
        /comment|review|danh-gia|rating/i.test(url) &&
        !/\/Comment\/Product\/Code/i.test(url)
      ) postRequests.push(url);
    });

    // Lấy các phần tử của form (tìm lại mỗi lần popup mở)
    const getFields = (modal: Locator) => ({
      textarea: modal.locator('textarea#feeling, textarea').first(),
      nameInput: modal.locator('input#fullName, input[name="fullName"]'),
      phoneInput: modal.locator('input#phone, input[name="phone"]'),
      agree: modal.locator('input#agree, input[name="agree"]'),
      submit: modal.locator('button:has-text("Gửi đánh giá")'),
    });

    // Đọc trạng thái của 1 ô nhập: giá trị, chỉ đọc, vô hiệu, có sửa được không
    const readField = async (input: Locator) => ({
      value: await input.inputValue().catch(() => ''),
      readOnly: await input.evaluate((el) => (el as HTMLInputElement).readOnly).catch(() => false),
      disabled: await input.isDisabled().catch(() => false),
      editable: await input.isEditable().catch(() => false),
    });

    // ---------- Pre-condition + mở popup + chọn sao để form mở rộng (Họ tên/SĐT chỉ hiện sau khi chọn sao) ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    let modal = await openReviewModal(page);
    let f = getFields(modal);

    await modal.getByText('Tốt', { exact: true }).click();
    await page.waitForTimeout(800);
    await expect(f.nameInput, 'Sau khi chọn sao phải hiện ô Họ tên').toBeVisible({ timeout: 10000 });
    await expect(f.phoneInput, 'Sau khi chọn sao phải hiện ô Số điện thoại').toBeVisible({ timeout: 10000 });

    // ---------- Ghi nhận thông tin điền sẵn ban đầu ----------
    const origName = await readField(f.nameInput);
    const origPhone = await readField(f.phoneInput);
    observed.banDau = { hoTen: origName, sdt: origPhone };
    await attachText('Review_Form_10_thong_tin_dien_san', JSON.stringify(observed.banDau, null, 2));
    await shot(page, 'Review_Form_10_thong_tin_dien_san');

    await test.step('Điều kiện: thông tin điền sẵn khớp tài khoản', async () => {
      expect.soft(origName.value.toLowerCase(), `Họ tên điền sẵn phải khớp tài khoản (chứa "${TEST_NAME}")`).toContain(TEST_NAME.toLowerCase());
      expect.soft(origPhone.value.replace(/\D/g, ''), 'SĐT điền sẵn phải khớp tài khoản').toBe(TEST_PHONE.replace(/\D/g, ''));
    });

    // ---------- Step 1 (theo Excel): sửa Họ tên và SĐT sang giá trị khác (hợp lệ) ----------
    let nameChanged = false;
    let phoneChanged = false;

    await test.step('Step 1: Sửa Họ tên và SĐT điền sẵn thành giá trị khác', async () => {
      // Chỉ thử sửa khi ô cho phép; nếu ô chỉ đọc/vô hiệu thì ghi nhận "không cho sửa"
      if (origName.editable) await f.nameInput.fill(NEW_NAME).catch(() => {});
      if (origPhone.editable) await f.phoneInput.fill(NEW_PHONE).catch(() => {});
      await page.waitForTimeout(500);

      const afterName = await readField(f.nameInput);
      const afterPhone = await readField(f.phoneInput);
      nameChanged = afterName.value === NEW_NAME;
      phoneChanged = afterPhone.value === NEW_PHONE;
      observed.sauKhiSua = { hoTen: afterName, sdt: afterPhone, hoTenDoiDuoc: nameChanged, sdtDoiDuoc: phoneChanged };
      console.log(`[Review_Form_10] Họ tên: ${origName.value} -> ${afterName.value} (${nameChanged ? 'sửa được' : 'KHÔNG sửa được'}); SĐT: ${origPhone.value} -> ${afterPhone.value} (${phoneChanged ? 'sửa được' : 'KHÔNG sửa được'})`);
      await shot(page, 'Review_Form_10_sau_khi_sua');
    });

    // ---------- Expected 1: hành vi nhất quán (cho sửa -> ô nhận giá trị mới; không cho sửa -> chỉ đọc, giữ nguyên) ----------
    await test.step('Expected 1: Họ tên - nhận giá trị mới nếu cho sửa, giữ nguyên + chỉ đọc nếu không cho sửa', async () => {
      if (origName.editable) {
        expect.soft(nameChanged, 'Ô Họ tên cho sửa thì phải nhận giá trị mới').toBe(true);
      } else {
        const now = await readField(f.nameInput);
        expect.soft(now.value, 'Ô Họ tên không cho sửa thì phải giữ nguyên giá trị tài khoản').toBe(origName.value);
        expect.soft(now.readOnly || now.disabled, 'Ô Họ tên không cho sửa thì phải ở trạng thái chỉ đọc/vô hiệu').toBe(true);
      }
    });

    await test.step('Expected 1: SĐT - nhận giá trị mới nếu cho sửa, giữ nguyên + chỉ đọc nếu không cho sửa', async () => {
      if (origPhone.editable) {
        expect.soft(phoneChanged, 'Ô SĐT cho sửa thì phải nhận giá trị mới').toBe(true);
      } else {
        const now = await readField(f.phoneInput);
        expect.soft(now.value, 'Ô SĐT không cho sửa thì phải giữ nguyên giá trị tài khoản').toBe(origPhone.value);
        expect.soft(now.readOnly || now.disabled, 'Ô SĐT không cho sửa thì phải ở trạng thái chỉ đọc/vô hiệu').toBe(true);
      }
    });

    note('rule-check', `[Review_Form_10] Họ tên điền sẵn ${origName.editable ? 'SỬA ĐƯỢC' : 'KHÔNG sửa được (chỉ đọc)'}; SĐT điền sẵn ${origPhone.editable ? 'SỬA ĐƯỢC' : 'KHÔNG sửa được (chỉ đọc)'} -> cập nhật Expected Output/Note trong Excel.`);

    // ---------- Đối chứng: giá trị mới hợp lệ thì form vẫn gửi được (nút Gửi bật), KHÔNG bấm ----------
    await test.step('Đối chứng: giá trị mới hợp lệ -> nút Gửi bật (không bấm gửi)', async () => {
      await f.textarea.fill(COMMENT);
      await setAgree(modal, page, true);
      await page.waitForTimeout(500);
      const enabled = await f.submit.isEnabled().catch(() => false);
      observed.nutGuiBatVoiGiaTriMoi = enabled;
      if (nameChanged || phoneChanged) {
        expect.soft(enabled, 'Họ tên/SĐT mới hợp lệ thì nút Gửi phải bật').toBe(true);
      }
      await shot(page, 'Review_Form_10_doi_chung_nut_gui');
      await setAgree(modal, page, false);   // trả về chưa đồng ý trước khi đóng popup
    });

    // ---------- Nhất quán với tài khoản: tải lại trang, mở lại popup -> thông tin điền sẵn vẫn là của tài khoản ----------
    await closeReviewModal(page);
    await test.step('Nhất quán: tải lại trang, mở lại popup -> thông tin điền sẵn không bị đổi theo giá trị đã sửa', async () => {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissPopups(page);
      modal = await openReviewModal(page);
      f = getFields(modal);
      await modal.getByText('Tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(f.nameInput, 'Sau khi mở lại popup và chọn sao phải hiện ô Họ tên').toBeVisible({ timeout: 10000 });

      const reName = await readField(f.nameInput);
      const rePhone = await readField(f.phoneInput);
      observed.sauKhiTaiLai = { hoTen: reName.value, sdt: rePhone.value };
      expect.soft(reName.value, 'Sau khi tải lại, Họ tên điền sẵn phải là thông tin gốc của tài khoản (không giữ giá trị đã sửa)').toBe(origName.value);
      expect.soft(rePhone.value, 'Sau khi tải lại, SĐT điền sẵn phải là thông tin gốc của tài khoản (không giữ giá trị đã sửa)').toBe(origPhone.value);
      await shot(page, 'Review_Form_10_sau_khi_tai_lai');
    });

    // ---------- Expected chung: không gửi gì, không lỗi ----------
    await test.step('Expected chung: Không có request gửi đánh giá, không lỗi JavaScript', async () => {
      expect.soft(postRequests, 'Test không được gửi bất kỳ đánh giá nào lên server').toEqual([]);
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_10_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_10] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: chỉ đóng popup
    await closeReviewModal(page);
  });

  test('Review_Form_11: Kiểm tra độ dài nội dung nhận xét', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(150000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const observed: Record<string, unknown> = {};

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Dữ liệu thử theo từng bước của test case
    const TEXT_1 = 'A';                                                   // 1 ký tự
    const TEXT_20 = 'Nồi nấu cơm rất ngon';                               // 20 ký tự
    const TEXT_5000 = 'Cơm nấu rất ngon. '.repeat(300).slice(0, 5000);    // 5000 ký tự (mô phỏng dán nội dung rất dài)
    const TYPED_LEN = 600;                                                 // số ký tự gõ tay để xác định giới hạn khi gõ

    // ---------- Pre-condition: đã đăng nhập, mở trang sản phẩm, click [Viết đánh giá] -> popup mở ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);

    const textarea = modal.locator('textarea#feeling, textarea').first();
    const nameInput = modal.locator('input#fullName, input[name="fullName"]');
    const phoneInput = modal.locator('input#phone, input[name="phone"]');
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');

    const isEnabled = async (): Promise<boolean> =>
      (await submit.isVisible().catch(() => false)) && (await submit.isEnabled().catch(() => false));

    // Bộ đếm ký tự (nếu web có): dạng "20/300" hoặc "... ký tự"
    const readCounter = async (): Promise<string> => {
      const text = ((await modal.innerText().catch(() => '')) || '').replace(/\u00a0/g, ' ');
      const m = text.match(/[^\n]*\b\d+\s*\/\s*\d{2,}[^\n]*/) || text.match(/[^\n]*\d+\s*ký tự[^\n]*/i);
      return m ? m[0].trim() : '';
    };

    // Giao diện có bị vỡ không khi nội dung dài: tràn ngang popup, ô nhận xét ra ngoài popup, nút Gửi bị đẩy mất
    const readLayout = () =>
      modal.evaluate((root) => {
        const m = root as HTMLElement;
        const mr = m.getBoundingClientRect();
        const ta = root.querySelector('textarea') as HTMLTextAreaElement | null;
        const tr = ta ? ta.getBoundingClientRect() : null;
        return {
          modalOverflowX: m.scrollWidth > m.clientWidth + 1,
          textareaInsideModal: tr ? tr.left >= mr.left - 1 && tr.right <= mr.right + 1 : true,
          textareaOverflowX: ta ? ta.scrollWidth > ta.clientWidth + 1 : false,
          maxlength: ta ? ta.getAttribute('maxlength') : null,
        };
      });

    // Nhập nội dung: kiểu "dán" (fill - gán cả chuỗi 1 lần) hoặc gõ từng phím (để trình duyệt áp dụng maxlength)
    const enter = async (value: string, mode: 'paste' | 'type' = 'paste') => {
      await textarea.fill('');
      if (mode === 'paste') await textarea.fill(value);
      else await textarea.pressSequentially(value);
      await page.waitForTimeout(600);
    };

    const snapshot = async (typed: string) => {
      const val = await textarea.inputValue();
      return { nhap: typed.length, thucTe: val.length, nutBat: await isEnabled(), boDem: await readCounter(), giongHet: val === typed };
    };

    // ---------- Điều kiện: chọn sao, Họ tên/SĐT hợp lệ, tick đồng ý -> chỉ còn độ dài nhận xét là biến thử ----------
    await test.step('Điều kiện: chọn sao, Họ tên/SĐT hợp lệ, tick đồng ý', async () => {
      await modal.getByText('Tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });
      if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
      if (!(await phoneInput.inputValue())) await phoneInput.fill(TEST_PHONE);
      await setAgree(modal, page, true);
      await expect.soft(agree, 'Checkbox chính sách phải ở trạng thái đã chọn').toBeChecked(SOFT);
      await expect(textarea, 'Phải có ô nhận xét').toBeVisible({ timeout: 10000 });
      observed.thuocTinhOuNhanXet = { maxlength: await textarea.getAttribute('maxlength'), boDemBanDau: await readCounter() };
    });

    // ---------- Step 1 / Expected 1: nhập 1 ký tự -> ghi nhận trạng thái nút Gửi/lỗi (có giới hạn tối thiểu hay không) ----------
    await test.step('Step 1: Nhập 1 ký tự -> ghi nhận có giới hạn tối thiểu hay không', async () => {
      await enter(TEXT_1);
      const r = await snapshot(TEXT_1);
      observed.buoc1_1kyTu = r;
      console.log(`[Review_Form_11] 1 ký tự -> nút Gửi ${r.nutBat ? 'BẬT' : 'vô hiệu'}${r.boDem ? `, bộ đếm: ${r.boDem}` : ''}`);
      expect.soft(r.giongHet, 'Ô nhận xét phải nhận đúng 1 ký tự đã nhập').toBe(true);
      note('rule-check', `[Review_Form_11] Nhận xét 1 ký tự -> nút Gửi ${r.nutBat ? 'BẬT (không có giới hạn tối thiểu)' : 'vô hiệu (có giới hạn tối thiểu)'} -> cập nhật Expected Output/Note trong Excel.`);
      await shot(page, 'Review_Form_11_buoc1_1_ky_tu');
    });

    // ---------- Step 2 / Expected 2: nhập 20 ký tự -> chấp nhận, nút Gửi bật nếu đủ điều kiện khác ----------
    await test.step('Step 2: Nhập nội dung 20 ký tự -> chấp nhận, nút Gửi bật', async () => {
      await enter(TEXT_20);
      const r = await snapshot(TEXT_20);
      observed.buoc2_20kyTu = r;
      console.log(`[Review_Form_11] 20 ký tự (thực tế ${r.thucTe}) -> nút Gửi ${r.nutBat ? 'BẬT' : 'vô hiệu'}`);
      expect.soft(r.giongHet, 'Ô nhận xét phải giữ nguyên nội dung 20 ký tự').toBe(true);
      expect.soft(r.nutBat, 'Đủ sao + Họ tên/SĐT + đồng ý + nhận xét 20 ký tự thì nút Gửi phải bật').toBe(true);
      await shot(page, 'Review_Form_11_buoc2_20_ky_tu');
    });

    // ---------- Step 3 / Expected 3: dán nội dung rất dài (5000 ký tự) ----------
    await test.step('Step 3: Dán nội dung rất dài (5000 ký tự)', async () => {
      await enter(TEXT_5000, 'paste');
      const r = await snapshot(TEXT_5000);
      const layout = await readLayout();
      observed.buoc3_dan5000 = { ...r, ...layout };
      console.log(`[Review_Form_11] Dán ${TEXT_5000.length} ký tự -> nhận ${r.thucTe} ký tự (maxlength=${layout.maxlength}), nút Gửi ${r.nutBat ? 'BẬT' : 'vô hiệu'}${r.boDem ? `, bộ đếm: ${r.boDem}` : ''}`);

      // Hoặc bị giới hạn tối đa (cắt bớt), hoặc nút Gửi bị vô hiệu (báo vượt)
      expect.soft(r.thucTe < TEXT_5000.length || !r.nutBat, `5000 ký tự phải bị giới hạn tối đa hoặc bị chặn gửi, thực tế nhận ${r.thucTe} ký tự và nút ${r.nutBat ? 'bật' : 'tắt'}`).toBe(true);
      // Giao diện không vỡ
      expect.soft(layout.modalOverflowX, 'Nội dung dài không được làm popup tràn ngang').toBe(false);
      expect.soft(layout.textareaInsideModal, 'Ô nhận xét phải nằm trọn trong popup').toBe(true);
      expect.soft(layout.textareaOverflowX, 'Chữ không được tràn ngang ra ngoài ô nhận xét').toBe(false);
      await expect.soft(modal, 'Popup vẫn phải hiển thị').toBeVisible(SOFT);
      await expect.soft(submit, 'Nút [Gửi đánh giá] vẫn phải nhìn thấy được (không bị đẩy mất)').toBeVisible(SOFT);

      if (r.thucTe >= TEXT_5000.length && r.nutBat) {
        note('defect-note', `[Review_Form_11] [Cần xác nhận] Nhận xét ${r.thucTe} ký tự được chấp nhận hoàn toàn, nút Gửi vẫn bật -> không có giới hạn tối đa. KHÔNG bấm gửi.`);
      }
      note('rule-check', `[Review_Form_11] Giới hạn tối đa: ${layout.maxlength ? `maxlength=${layout.maxlength}` : 'không có thuộc tính maxlength'}; dán ${TEXT_5000.length} ký tự -> nhận ${r.thucTe}; bộ đếm ký tự: ${r.boDem || 'không có'}.`);
      await shot(page, 'Review_Form_11_buoc3_dan_5000_ky_tu');
    });

    // ---------- Bổ sung: gõ tay từng phím để xác định giới hạn khi gõ (maxlength chỉ chặn khi gõ, không chặn khi gán chuỗi) ----------
    await test.step(`Bổ sung: Gõ tay ${TYPED_LEN} ký tự -> ghi nhận giới hạn khi gõ`, async () => {
      await enter(TEXT_5000.slice(0, TYPED_LEN), 'type');
      const r = await snapshot(TEXT_5000.slice(0, TYPED_LEN));
      observed.boSung_goTay = r;
      console.log(`[Review_Form_11] Gõ ${TYPED_LEN} ký tự -> nhận ${r.thucTe} ký tự, nút Gửi ${r.nutBat ? 'BẬT' : 'vô hiệu'}${r.boDem ? `, bộ đếm: ${r.boDem}` : ''}`);
      await shot(page, 'Review_Form_11_bo_sung_go_tay');
    });

    // ---------- Expected chung: không lỗi hệ thống ----------
    await test.step('Expected chung: Không phát sinh lỗi JavaScript', async () => {
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_11_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_11] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: xóa nội dung, bỏ tick đồng ý rồi đóng popup
    await textarea.fill('').catch(() => {});
    await setAgree(modal, page, false).catch(() => {});
    await closeReviewModal(page);
  });

  test('Review_Form_12: Kiểm tra nhập emoji, ký tự đặc biệt, nhiều dòng, HTML/script vào ô nhận xét', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(150000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const observed: Record<string, unknown> = {};

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Theo dõi hộp thoại alert/confirm/prompt: nếu script bị thực thi sẽ có dialog xuất hiện
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`);
      d.dismiss().catch(() => {});
    });

    // Theo dõi request gửi đánh giá: test này tuyệt đối không được gửi gì lên server.
    // POST .../api/Comment/Product/Code là request TẢI danh sách đánh giá (chạy mỗi lần mở trang) -> loại ra.
    const postRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (
        req.method() === 'POST' &&
        /api\.dienmayxanh\.com/i.test(url) &&
        /comment|review|danh-gia|rating/i.test(url) &&
        !/\/Comment\/Product\/Code/i.test(url)
      ) postRequests.push(url);
    });

    // Dữ liệu thử theo từng bước của test case
    const TEXT_EMOJI = 'Nồi cơm tuyệt vời! 👍🍲🍚 Giá tốt ⭐⭐⭐⭐⭐';
    const TEXT_SPECIAL = 'Ký tự đặc biệt: @#$%^&*()_+-={}[]|\\:;"\'<>,.?/~`';
    const LINES = ['Dòng 1: Cơm nấu dẻo thơm', 'Dòng 2: Giữ ấm lâu', 'Dòng 3: Dễ vệ sinh'];
    const XSS_PAYLOAD = '<b>test</b><script>alert(1)</script>';
    const XSS_MARKER_PAYLOAD = '<script>window.__xss=1</script><img src=x onerror="window.__xss=1">';

    // ---------- Pre-condition: đã đăng nhập, mở trang sản phẩm, click [Viết đánh giá] -> popup mở ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);

    const textarea = modal.locator('textarea#feeling, textarea').first();
    const nameInput = modal.locator('input#fullName, input[name="fullName"]');
    const phoneInput = modal.locator('input#phone, input[name="phone"]');
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');

    const isEnabled = async (): Promise<boolean> =>
      (await submit.isVisible().catch(() => false)) && (await submit.isEnabled().catch(() => false));

    // Số thẻ <script> của trang: dùng để biết có thẻ script lạ nào bị chèn vào DOM hay không
    const countScripts = () => page.evaluate(() => document.querySelectorAll('script').length);

    // ---------- Điều kiện: chọn sao, Họ tên/SĐT hợp lệ, tick đồng ý để form mở rộng đầy đủ ----------
    await test.step('Điều kiện: chọn sao, Họ tên/SĐT hợp lệ, tick đồng ý', async () => {
      await modal.getByText('Tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });
      if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
      if (!(await phoneInput.inputValue())) await phoneInput.fill(TEST_PHONE);
      await setAgree(modal, page, true);
      await expect(textarea, 'Phải có ô nhận xét').toBeVisible({ timeout: 10000 });
    });

    // ---------- Step 1 / Expected 1: emoji, tiếng Việt có dấu, ký tự đặc biệt -> nhập và hiển thị đúng ----------
    await test.step('Step 1a: Nhập emoji + tiếng Việt có dấu', async () => {
      await textarea.fill('');
      await textarea.fill(TEXT_EMOJI);
      await page.waitForTimeout(500);
      const val = await textarea.inputValue();
      observed.buoc1a_emoji = {
        nhap: TEXT_EMOJI,
        thucTe: val,
        giongHet: val === TEXT_EMOJI,
        soKyTuUnicode: Array.from(val).length,
        coKyTuLoi: /\uFFFD|\?{2,}/.test(val),
        nutBat: await isEnabled(),
      };
      expect.soft(val, 'Ô nhận xét phải giữ nguyên emoji và tiếng Việt có dấu').toBe(TEXT_EMOJI);
      expect.soft(/\uFFFD/.test(val), 'Emoji không được bị thay bằng ký tự lỗi �').toBe(false);
      expect.soft(Array.from(val).length, 'Số ký tự Unicode (mỗi emoji tính 1) phải khớp dữ liệu nhập').toBe(Array.from(TEXT_EMOJI).length);
      await shot(page, 'Review_Form_12_buoc1a_emoji');
    });

    await test.step('Step 1b: Nhập ký tự đặc biệt', async () => {
      await textarea.fill('');
      await textarea.fill(TEXT_SPECIAL);
      await page.waitForTimeout(500);
      const val = await textarea.inputValue();
      observed.buoc1b_kyTuDacBiet = { nhap: TEXT_SPECIAL, thucTe: val, giongHet: val === TEXT_SPECIAL, nutBat: await isEnabled() };
      expect.soft(val, 'Ô nhận xét phải giữ nguyên các ký tự đặc biệt').toBe(TEXT_SPECIAL);
      await shot(page, 'Review_Form_12_buoc1b_ky_tu_dac_biet');
    });

    // ---------- Step 2 / Expected 2: nhiều dòng (Enter xuống dòng) -> xuống dòng đúng ----------
    await test.step('Step 2: Nhập nhiều dòng (Enter xuống dòng)', async () => {
      await textarea.fill('');
      await textarea.click();
      for (let i = 0; i < LINES.length; i++) {
        await textarea.pressSequentially(LINES[i]);
        if (i < LINES.length - 1) await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(500);

      const val = (await textarea.inputValue()).replace(/\r\n/g, '\n');
      const lines = val.split('\n');
      const heightInfo = await textarea.evaluate((el) => ({ scrollHeight: (el as HTMLTextAreaElement).scrollHeight, clientHeight: (el as HTMLTextAreaElement).clientHeight }));
      observed.buoc2_nhieuDong = { soDong: lines.length, cacDong: lines, ...heightInfo, nutBat: await isEnabled() };

      expect.soft(val, 'Ô nhận xét phải giữ đúng 3 dòng đã nhập').toBe(LINES.join('\n'));
      expect.soft(lines.length, 'Phải có đúng 3 dòng').toBe(3);
      await expect.soft(modal, 'Nhấn Enter trong ô nhận xét chỉ xuống dòng, popup không được đóng/gửi').toBeVisible(SOFT);
      expect.soft(postRequests, 'Nhấn Enter trong ô nhận xét không được gửi đánh giá').toEqual([]);
      await shot(page, 'Review_Form_12_buoc2_nhieu_dong');
    });

    // ---------- Step 3 / Expected 3: HTML/script -> nhận như văn bản, không thực thi, không popup ----------
    await test.step('Step 3a: Nhập <b>test</b><script>alert(1)</script>', async () => {
      const scriptsBefore = await countScripts();
      await textarea.fill('');
      await textarea.fill(XSS_PAYLOAD);
      await page.waitForTimeout(1000);

      const val = await textarea.inputValue();
      const scriptsAfter = await countScripts();
      const renderedBold = await modal.locator('b:has-text("test")').count();   // nếu >0 nghĩa là chuỗi bị render thành HTML
      observed.buoc3a_xss = { nhap: XSS_PAYLOAD, thucTe: val, soHopThoai: dialogs.length, scriptTruoc: scriptsBefore, scriptSau: scriptsAfter, bBiRender: renderedBold };

      expect.soft(val, 'Ô nhận xét phải nhận chuỗi HTML/script như văn bản thường').toBe(XSS_PAYLOAD);
      expect.soft(dialogs, `Không được hiện popup alert (script không được thực thi): ${dialogs.join(' | ')}`).toEqual([]);
      expect.soft(scriptsAfter, 'Không được có thẻ <script> mới bị chèn vào trang').toBe(scriptsBefore);
      expect.soft(renderedBold, 'Chuỗi <b>test</b> không được bị render thành chữ in đậm trong popup').toBe(0);
      await shot(page, 'Review_Form_12_buoc3a_xss_alert');
    });

    await test.step('Step 3b: Đối chứng - payload dùng biến đánh dấu (script + onerror) để phát hiện thực thi không có alert', async () => {
      await page.evaluate(() => { (window as any).__xss = null; });
      await textarea.fill('');
      await textarea.fill(XSS_MARKER_PAYLOAD);
      await page.waitForTimeout(1000);

      const val = await textarea.inputValue();
      const marker = await page.evaluate(() => (window as any).__xss ?? null);
      observed.buoc3b_marker = { thucTe: val, marker, soHopThoai: dialogs.length };
      expect.soft(val, 'Ô nhận xét phải nhận chuỗi payload như văn bản thường').toBe(XSS_MARKER_PAYLOAD);
      expect.soft(marker, 'Payload không được thực thi (window.__xss phải còn null)').toBeNull();
      expect.soft(dialogs, 'Không được có hộp thoại nào xuất hiện').toEqual([]);
      await shot(page, 'Review_Form_12_buoc3b_xss_marker');
    });

    // ---------- Expected chung: không lỗi hệ thống, không gửi gì ----------
    await test.step('Expected chung: Popup còn hiển thị, không lỗi JavaScript, không gửi đánh giá', async () => {
      await expect.soft(modal, 'Popup vẫn phải hiển thị').toBeVisible(SOFT);
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
      expect.soft(postRequests, 'Test không được gửi bất kỳ đánh giá nào lên server').toEqual([]);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_12_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_12] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: xóa nội dung, bỏ tick đồng ý rồi đóng popup
    await textarea.fill('').catch(() => {});
    await setAgree(modal, page, false).catch(() => {});
    await closeReviewModal(page);
  });

  test('Review_Form_13: Kiểm tra chọn ảnh hợp lệ (1 đến 3 ảnh) và xóa ảnh', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.skip(
      ![IMG_1, IMG_2, IMG_3, IMG_4].every((p) => fs.existsSync(p)),
      'Bỏ qua: Thiếu ảnh mẫu fixtures/img_1.jpg ... img_4.jpg',
    );
    test.setTimeout(150000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const observed: Record<string, unknown> = {};

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Theo dõi request: tách riêng (a) tải ảnh lên (web tải ngay khi chọn ảnh) và (b) gửi đánh giá (không được xảy ra)
    const uploadRequests: string[] = [];
    const postRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (req.method() !== 'POST' || !/api\.dienmayxanh\.com/i.test(url)) return;
      if (/\/api\/Upload\/ProductRatings/i.test(url)) uploadRequests.push(url);
      else if (/comment|review|danh-gia|rating/i.test(url) && !/\/Comment\/Product\/Code/i.test(url)) postRequests.push(url);
    });

    // ---------- Pre-condition: đã đăng nhập, mở trang sản phẩm, click [Viết đánh giá] -> popup mở ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);

    const fileInput = modal.locator('input[type="file"]');
    const uploadLink = modal.getByText(/Gửi ảnh thực tế/i).first();

    // Ảnh thu nhỏ: ưu tiên ảnh xem trước dạng blob:/data:; dự phòng = số thẻ <img> tăng thêm so với trước khi chọn ảnh
    const thumbImgs = modal.locator('img[src^="blob:"], img[src^="data:"]');
    const allImgs = modal.locator('img');
    // Nút xóa ảnh (×) - không lấy nhầm nút đóng popup (✕)
    const deleteBtns = modal.locator(
      'button:text-is("×"), span:text-is("×"), [aria-label*="xóa" i], [aria-label*="remove" i], [class*="delete" i], [class*="remove" i]',
    );

    // ---------- Điều kiện: chọn sao để form mở rộng (liên kết [Gửi ảnh thực tế] chỉ hiện sau khi chọn sao) ----------
    await modal.getByText('Tốt', { exact: true }).click();
    await page.waitForTimeout(800);
    await expect(uploadLink, 'Sau khi chọn sao phải hiện liên kết [Gửi ảnh thực tế]').toBeVisible({ timeout: 10000 });
    await expect(fileInput, 'Phải có ô chọn tệp (input file)').toBeAttached();

    const baselineImgs = await allImgs.count();   // số <img> trước khi chọn ảnh (ảnh sản phẩm...)

    const readThumbs = async () => {
      const blob = await thumbImgs.count();
      const diff = Math.max(0, (await allImgs.count()) - baselineImgs);
      const srcs = await thumbImgs.evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src));
      const loaded = await thumbImgs.evaluateAll((els) => els.every((e) => (e as HTMLImageElement).naturalWidth > 0));
      return { count: blob || diff, blob, diff, srcs, loaded, nutXoa: await deleteBtns.count() };
    };
    const waitCount = (n: number) =>
      expect.poll(async () => (await readThumbs()).count, { timeout: 8000 }).toBe(n).catch(() => {});

    // Click [Gửi ảnh thực tế] -> hộp thoại chọn tệp -> chọn ảnh (dự phòng: gán thẳng vào input file nếu không bắt được hộp thoại)
    const addImages = async (files: string[]) => {
      try {
        const [chooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 5000 }),
          uploadLink.click(),
        ]);
        await chooser.setFiles(files);
      } catch {
        note('ux-note', '[Review_Form_13] Click [Gửi ảnh thực tế] không mở hộp thoại chọn tệp -> dùng setInputFiles trực tiếp trên input file.');
        await fileInput.first().setInputFiles(files);
      }
      await page.waitForTimeout(1000);
    };

    // ---------- Step 1 / Expected 1: chọn 1 ảnh JPG hợp lệ -> ảnh hiển thị dạng thu nhỏ kèm nút xóa ----------
    await test.step('Step 1: Click [Gửi ảnh thực tế], chọn 1 ảnh JPG hợp lệ', async () => {
      await addImages([IMG_1]);
      await waitCount(1);
      const r = await readThumbs();
      observed.buoc1_1anh = r;
      console.log(`[Review_Form_13] Sau khi chọn 1 ảnh: ${r.count} ảnh thu nhỏ (blob=${r.blob}, tăng thêm=${r.diff}), ${r.nutXoa} nút xóa`);
      await attachText('Review_Form_13_html_popup_sau_1_anh', (await modal.evaluate((el) => el.outerHTML)).slice(0, 20000));

      expect.soft(r.count, 'Chọn 1 ảnh thì phải hiển thị đúng 1 ảnh thu nhỏ').toBe(1);
      expect.soft(r.nutXoa, 'Ảnh thu nhỏ phải kèm nút xóa').toBeGreaterThanOrEqual(1);
      if (r.blob > 0) expect.soft(r.loaded, 'Ảnh thu nhỏ phải tải/hiển thị được (không bị ảnh hỏng)').toBe(true);
      await shot(page, 'Review_Form_13_buoc1_1_anh');
    });

    // ---------- Step 2 / Expected 2: chọn thêm đến đủ 3 ảnh -> hiển thị đủ 3 ảnh ----------
    await test.step('Step 2: Chọn thêm đến đủ 3 ảnh', async () => {
      await addImages([IMG_2]);
      await waitCount(2);
      const r2 = await readThumbs();
      observed.buoc2_2anh = r2;

      await addImages([IMG_3]);
      await waitCount(3);
      const r3 = await readThumbs();
      observed.buoc2_3anh = r3;
      console.log(`[Review_Form_13] Sau khi chọn thêm: 2 ảnh -> ${r2.count}; 3 ảnh -> ${r3.count} (nút xóa: ${r3.nutXoa})`);

      if (r2.count === 1) {
        note('defect-note', '[Review_Form_13] [Cần xác nhận] Chọn thêm ảnh thứ 2 nhưng vẫn chỉ có 1 ảnh -> web có thể THAY THẾ ảnh cũ thay vì thêm vào danh sách.');
      }
      expect.soft(r2.count, 'Chọn thêm ảnh thứ 2 thì phải có 2 ảnh').toBe(2);
      expect.soft(r3.count, 'Chọn đủ 3 ảnh thì phải hiển thị đủ 3 ảnh').toBe(3);
      expect.soft(r3.nutXoa, 'Mỗi ảnh thu nhỏ phải có nút xóa').toBeGreaterThanOrEqual(r3.count);
      if (r3.blob > 0) expect.soft(r3.loaded, 'Cả 3 ảnh thu nhỏ phải hiển thị được').toBe(true);
      await shot(page, 'Review_Form_13_buoc2_3_anh');
    });

    // ---------- Step 3 / Expected 3: xóa 1 ảnh -> ảnh bị xóa, còn 2 ảnh; có thể chọn thêm ảnh khác ----------
    await test.step('Step 3a: Xóa 1 ảnh đã chọn', async () => {
      const before = await readThumbs();
      await deleteBtns.first().click();
      await waitCount(before.count - 1);
      const after = await readThumbs();
      observed.buoc3a_sauKhiXoa = after;
      console.log(`[Review_Form_13] Sau khi xóa 1 ảnh: ${before.count} -> ${after.count}`);

      expect.soft(after.count, 'Sau khi xóa 1 ảnh thì chỉ còn 2 ảnh').toBe(2);
      if (before.srcs.length === 3 && after.srcs.length === 2) {
        expect.soft(after.srcs.includes(before.srcs[0]), 'Ảnh bị xóa (ảnh đầu tiên) không được còn trong danh sách').toBe(false);
      }
      await shot(page, 'Review_Form_13_buoc3a_sau_khi_xoa');
    });

    await test.step('Step 3b: Sau khi xóa vẫn chọn thêm được ảnh khác', async () => {
      await addImages([IMG_4]);
      await waitCount(3);
      const r = await readThumbs();
      observed.buoc3b_chonThem = r;
      console.log(`[Review_Form_13] Sau khi chọn thêm ảnh khác: ${r.count} ảnh`);
      expect.soft(r.count, 'Sau khi xóa còn 2 ảnh thì chọn thêm 1 ảnh khác phải lên lại 3 ảnh').toBe(3);
      await shot(page, 'Review_Form_13_buoc3b_chon_them');
    });

    // ---------- Expected chung: không lỗi hệ thống, không gửi gì ----------
    await test.step('Expected chung: Popup còn hiển thị, không lỗi JavaScript, không tải ảnh/gửi đánh giá lên server', async () => {
      await expect.soft(modal, 'Popup vẫn phải hiển thị').toBeVisible(SOFT);
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
      expect.soft(postRequests, 'Test không được gửi đánh giá lên server').toEqual([]);
      observed.soRequestTaiAnhLenServer = uploadRequests.length;
      note('data-note', `[Review_Form_13] Web tải ảnh lên server ngay khi chọn (POST /Upload/ProductRatings x${uploadRequests.length}) dù chưa gửi đánh giá.`);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_13_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_13] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: chỉ đóng popup (ảnh chỉ nằm trong bộ nhớ trình duyệt, bị hủy khi đóng)
    await closeReviewModal(page);
  });

  test('Review_Form_14: Kiểm tra giới hạn tối đa 3 ảnh', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.skip(
      ![IMG_1, IMG_2, IMG_3, IMG_4].every((p) => fs.existsSync(p)),
      'Bỏ qua: Thiếu ảnh mẫu fixtures/img_1.jpg ... img_4.jpg',
    );
    test.setTimeout(180000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const observed: Record<string, unknown> = {};

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Một số web báo giới hạn bằng hộp thoại alert -> ghi lại nội dung rồi đóng
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      d.dismiss().catch(() => {});
    });

    // Theo dõi request: tách riêng (a) tải ảnh lên (web tải ngay khi chọn ảnh) và (b) gửi đánh giá (không được xảy ra)
    const uploadRequests: string[] = [];
    const postRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (req.method() !== 'POST' || !/api\.dienmayxanh\.com/i.test(url)) return;
      if (/\/api\/Upload\/ProductRatings/i.test(url)) uploadRequests.push(url);
      else if (/comment|review|danh-gia|rating/i.test(url) && !/\/Comment\/Product\/Code/i.test(url)) postRequests.push(url);
    });

    // Đọc các dòng chữ đang hiển thị trên trang (thông báo giới hạn có thể là toast nằm ngoài popup)
    const readLines = async (): Promise<string[]> =>
      (((await page.locator('body').innerText().catch(() => '')) || '')
        .split('\n').map((s) => s.trim()).filter(Boolean));

    // Thu thập các dòng chữ MỚI xuất hiện (so với trước khi thao tác) có liên quan đến ảnh/giới hạn
    const collectNewMessages = async (baseline: Set<string>, ms = 4000): Promise<string[]> => {
      const found = new Set<string>();
      const end = Date.now() + ms;
      while (Date.now() < end) {
        for (const l of await readLines()) {
          if (!baseline.has(l) && l.length < 200 && /ảnh|hình|tối đa|vượt|giới hạn|quá/i.test(l)) found.add(l);
        }
        await page.waitForTimeout(300);
      }
      return [...found];
    };

    // Mở popup, chọn sao để form mở rộng, trả về các hàm thao tác ảnh (gọi lại được sau khi tải lại trang)
    const openForm = async () => {
      await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissPopups(page);
      const modal = await openReviewModal(page);
      const fileInput = modal.locator('input[type="file"]');
      const uploadLink = modal.getByText(/Gửi ảnh thực tế/i).first();

      await modal.getByText('Tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(uploadLink, 'Sau khi chọn sao phải hiện liên kết [Gửi ảnh thực tế]').toBeVisible({ timeout: 10000 });
      await expect(fileInput, 'Phải có ô chọn tệp (input file)').toBeAttached();

      const thumbImgs = modal.locator('img[src^="blob:"], img[src^="data:"]');
      const allImgs = modal.locator('img');
      const baselineImgs = await allImgs.count();
      const readThumbs = async () => {
        const blob = await thumbImgs.count();
        const diff = Math.max(0, (await allImgs.count()) - baselineImgs);
        return { count: blob || diff, blob, diff };
      };
      const waitCount = (n: number) =>
        expect.poll(async () => (await readThumbs()).count, { timeout: 8000 }).toBe(n).catch(() => {});

      // Click [Gửi ảnh thực tế] -> hộp thoại chọn tệp -> chọn ảnh. Trả về kết quả thay vì ném lỗi để ghi nhận.
      const addImages = async (files: string[]) => {
        try {
          const [chooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 5000 }),
            uploadLink.click({ timeout: 5000 }),
          ]);
          await chooser.setFiles(files);
          await page.waitForTimeout(1000);
          return { ok: true, error: '' };
        } catch (e) {
          return { ok: false, error: (e as Error).message.split('\n')[0] };
        }
      };

      const readLayout = () =>
        modal.evaluate((root) => {
          const m = root as HTMLElement;
          return { modalOverflowX: m.scrollWidth > m.clientWidth + 1 };
        });

      return { modal, fileInput, uploadLink, readThumbs, waitCount, addImages, readLayout };
    };

    // ============================================================================
    // Step 1: đã chọn 3 ảnh, chọn thêm ảnh thứ 4
    // ============================================================================
    let ctx = await openForm();

    await test.step('Điều kiện: đã chọn đủ 3 ảnh (chọn lần lượt từng ảnh)', async () => {
      observed.thuocTinhInputFile = {
        multiple: await ctx.fileInput.first().getAttribute('multiple'),
        accept: await ctx.fileInput.first().getAttribute('accept'),
      };
      for (const [i, img] of [IMG_1, IMG_2, IMG_3].entries()) {
        const r = await ctx.addImages([img]);
        expect.soft(r.ok, `Chọn ảnh thứ ${i + 1} phải thành công: ${r.error}`).toBe(true);
        await ctx.waitCount(i + 1);
      }
      const t = await ctx.readThumbs();
      observed.truocKhiThem = t;
      expect(t.count, 'Điều kiện: phải đang có đúng 3 ảnh trước khi chọn thêm ảnh thứ 4').toBe(3);
      await shot(page, 'Review_Form_14_buoc1_da_co_3_anh');
    });

    await test.step('Step 1: Đã chọn 3 ảnh, chọn thêm ảnh thứ 4 -> không nhận, có thông báo giới hạn tối đa 3 ảnh', async () => {
      const uploadsBefore = uploadRequests.length;
      const baseline = new Set(await readLines());
      dialogs.length = 0;

      // Liên kết/ô chọn ảnh có bị ẩn hoặc vô hiệu khi đã đủ 3 ảnh không (chặn ngay từ giao diện)
      const linkVisible = await ctx.uploadLink.isVisible().catch(() => false);
      const inputDisabled = await ctx.fileInput.first().isDisabled().catch(() => false);

      const msgPromise = collectNewMessages(baseline, 4000);
      const r = await ctx.addImages([IMG_4]);
      const newMessages = await msgPromise;

      await ctx.waitCount(3);
      const t = await ctx.readThumbs();
      const uploadsForFourth = uploadRequests.length - uploadsBefore;
      const blockedByUi = !linkVisible || inputDisabled || !r.ok;
      observed.buoc1_anhThu4 = {
        lienKetConHienThi: linkVisible, inputBiVoHieu: inputDisabled,
        mowDuocHopThoaiChonTep: r.ok, loiKhiChon: r.error,
        soAnhSau: t.count, thongBaoMoi: newMessages, hopThoai: [...dialogs], soRequestTaiAnhChoAnhThu4: uploadsForFourth,
      };
      console.log(`[Review_Form_14] Chọn ảnh thứ 4 -> ${t.count} ảnh; chặn từ giao diện: ${blockedByUi}; thông báo mới: ${JSON.stringify(newMessages)}; alert: ${JSON.stringify(dialogs)}; upload thêm: ${uploadsForFourth}`);

      expect.soft(t.count, 'Đã có 3 ảnh thì không được nhận ảnh thứ 4 (vẫn chỉ 3 ảnh)').toBe(3);
      const hasMessage = newMessages.length > 0 || dialogs.length > 0;
      expect.soft(hasMessage || blockedByUi, 'Phải có thông báo giới hạn tối đa 3 ảnh (hoặc chặn ngay từ giao diện)').toBe(true);
      if (!hasMessage && !blockedByUi) {
        note('defect-note', '[Review_Form_14] Chọn ảnh thứ 4 bị bỏ qua im lặng: không có thông báo giới hạn tối đa 3 ảnh.');
      }
      if (blockedByUi && !hasMessage) {
        note('ux-note', '[Review_Form_14] Khi đã đủ 3 ảnh, giao diện chặn chọn thêm (liên kết ẩn/vô hiệu hoặc không mở hộp thoại) nhưng không có thông báo.');
      }
      if (uploadsForFourth > 0) {
        note('data-note', `[Review_Form_14] Ảnh thứ 4 vẫn bị tải lên server (${uploadsForFourth} request /Upload/ProductRatings) dù không được nhận vào danh sách.`);
      }
      await shot(page, 'Review_Form_14_buoc1_sau_khi_chon_anh_thu_4');
    });

    await closeReviewModal(page);

    // ============================================================================
    // Step 2: chọn cùng lúc 4 ảnh từ hộp thoại chọn tệp (tải lại trang để popup trống ảnh)
    // ============================================================================
    ctx = await openForm();

    await test.step('Step 2: Chọn cùng lúc 4 ảnh từ hộp thoại chọn tệp -> chỉ nhận tối đa 3 ảnh hoặc báo lỗi', async () => {
      const uploadsBefore = uploadRequests.length;
      const baseline = new Set(await readLines());
      dialogs.length = 0;

      const msgPromise = collectNewMessages(baseline, 4000);
      const r = await ctx.addImages([IMG_1, IMG_2, IMG_3, IMG_4]);
      const newMessages = await msgPromise;

      await page.waitForTimeout(1000);
      const t = await ctx.readThumbs();
      const layout = await ctx.readLayout();
      const nonMultiple = /non-multiple/i.test(r.error);
      observed.buoc2_chon4CungLuc = {
        chonDuoc: r.ok, loi: r.error, hopThoaiChiChoPhepChon1Anh: nonMultiple,
        soAnhSau: t.count, thongBaoMoi: newMessages, hopThoai: [...dialogs],
        soRequestTaiAnh: uploadRequests.length - uploadsBefore, ...layout,
      };
      console.log(`[Review_Form_14] Chọn cùng lúc 4 ảnh -> ${t.count} ảnh; chọn được: ${r.ok}${r.error ? ` (${r.error})` : ''}; thông báo mới: ${JSON.stringify(newMessages)}; alert: ${JSON.stringify(dialogs)}`);

      if (nonMultiple) {
        note('rule-check', '[Review_Form_14] Hộp thoại chọn tệp CHỈ cho chọn 1 ảnh mỗi lần (input không có multiple) -> không thể chọn cùng lúc 4 ảnh; giới hạn được đảm bảo từ giao diện.');
      } else {
        expect.soft(t.count, 'Chọn cùng lúc 4 ảnh thì chỉ được nhận tối đa 3 ảnh (hoặc báo lỗi)').toBeLessThanOrEqual(3);
        if (t.count > 3) {
          note('defect-note', `[Review_Form_14] Chọn cùng lúc 4 ảnh nhưng web nhận ${t.count} ảnh -> vượt giới hạn tối đa 3 ảnh.`);
        }
        if (t.count === 3 && newMessages.length === 0 && dialogs.length === 0) {
          note('ux-note', '[Review_Form_14] Chọn 4 ảnh cùng lúc: chỉ nhận 3 ảnh nhưng không có thông báo cho người dùng.');
        }
      }
      // Không lỗi giao diện
      expect.soft(layout.modalOverflowX, 'Popup không được tràn ngang sau khi chọn ảnh').toBe(false);
      await expect.soft(ctx.modal, 'Popup vẫn phải hiển thị').toBeVisible(SOFT);
      await shot(page, 'Review_Form_14_buoc2_chon_4_anh_cung_luc');
    });

    // ---------- Expected chung: không lỗi hệ thống, không gửi đánh giá ----------
    await test.step('Expected chung: Không lỗi JavaScript, không gửi đánh giá', async () => {
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
      expect.soft(postRequests, 'Test không được gửi đánh giá lên server').toEqual([]);
      observed.tongSoRequestTaiAnhLenServer = uploadRequests.length;
      note('data-note', `[Review_Form_14] Web tải ảnh lên server ngay khi chọn (POST /Upload/ProductRatings x${uploadRequests.length}) dù chưa gửi đánh giá.`);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_14_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_14] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: chỉ đóng popup
    await closeReviewModal(page);
  });

  test('Review_Form_15: Kiểm tra chọn tệp không phải ảnh hoặc ảnh quá nặng', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.skip(
      ![FILE_TXT, FILE_FAKE_JPG, FILE_HEAVY_10MB].every((p) => fs.existsSync(p)),
      'Bỏ qua: Thiếu tệp mẫu fixtures/sample.txt, fake_image.jpg, heavy_10mb.jpg',
    );
    test.setTimeout(360000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const ABORT_UPLOAD = false;              // true: chặn request tải tệp lên server thật (kết quả chỉ phản ánh phía giao diện)
    const observed: Record<string, unknown> = {};

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Một số web báo lỗi bằng hộp thoại alert -> ghi lại nội dung rồi đóng
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      d.dismiss().catch(() => {});
    });

    // Theo dõi request/response: tách riêng (a) tải tệp lên (web tải ngay khi chọn) và (b) gửi đánh giá (không được xảy ra)
    const uploadRequests: string[] = [];
    const uploadStatuses: number[] = [];
    const postRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (req.method() !== 'POST' || !/api\.dienmayxanh\.com/i.test(url)) return;
      if (/\/api\/Upload\/ProductRatings/i.test(url)) uploadRequests.push(url);
      else if (/comment|review|danh-gia|rating/i.test(url) && !/\/Comment\/Product\/Code/i.test(url)) postRequests.push(url);
    });
    page.on('response', (res) => {
      if (res.request().method() === 'POST' && /\/api\/Upload\/ProductRatings/i.test(res.url())) uploadStatuses.push(res.status());
    });
    if (ABORT_UPLOAD) await page.route('**/api/Upload/ProductRatings', (route) => route.abort());

    // ---------- Chuẩn bị tệp mẫu (tạo tạm trong thư mục kết quả của test) ----------
    const b64 = (name: string, base64: string) => {
      const p = test.info().outputPath(name);
      fs.writeFileSync(p, Buffer.from(base64, 'base64'));
      return p;
    };
    const FILE_PDF = test.info().outputPath('sample.pdf');
    fs.writeFileSync(FILE_PDF, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    const FILE_PNG = b64('sample.png', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    const FILE_WEBP = b64('sample.webp', 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==');
    const FILE_GIF = b64('sample.gif', 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    // HEIC: không tạo được ảnh HEIC thật bằng code -> tệp chỉ có đuôi .heic và phần đầu "ftypheic" (chỉ để xem web xử lý đuôi .heic thế nào)
    const FILE_HEIC_STUB = test.info().outputPath('sample.heic');
    fs.writeFileSync(FILE_HEIC_STUB, Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(64)]));

    // Đọc các dòng chữ đang hiển thị trên trang (thông báo lỗi có thể là toast nằm ngoài popup)
    const readLines = async (): Promise<string[]> =>
      (((await page.locator('body').innerText().catch(() => '')) || '')
        .split('\n').map((s) => s.trim()).filter(Boolean));

    // Thu thập các dòng chữ MỚI xuất hiện (so với trước khi thao tác) có liên quan đến tệp/ảnh/lỗi
    const collectNewMessages = async (baseline: Set<string>, ms: number): Promise<string[]> => {
      const found = new Set<string>();
      const end = Date.now() + ms;
      while (Date.now() < end) {
        for (const l of await readLines()) {
          if (!baseline.has(l) && l.length < 200 && /ảnh|hình|định dạng|dung lượng|tệp|file|lỗi|tối đa|vượt|giới hạn|quá|\d\s*MB/.test(l)) found.add(l);
        }
        await page.waitForTimeout(300);
      }
      return [...found];
    };

    // Mở popup (trang tải mới -> chưa có ảnh nào), chọn sao để form mở rộng, trả về các hàm thao tác tệp
    const openForm = async () => {
      await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissPopups(page);
      const modal = await openReviewModal(page);
      const fileInput = modal.locator('input[type="file"]');
      const uploadLink = modal.getByText(/Gửi ảnh thực tế/i).first();

      await modal.getByText('Tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(uploadLink, 'Sau khi chọn sao phải hiện liên kết [Gửi ảnh thực tế]').toBeVisible({ timeout: 10000 });
      await expect(fileInput, 'Phải có ô chọn tệp (input file)').toBeAttached();

      const thumbImgs = modal.locator('img[src^="blob:"], img[src^="data:"]');
      const allImgs = modal.locator('img');
      const baselineImgs = await allImgs.count();
      const countBroken = () =>
        allImgs.evaluateAll((els) => els.filter((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth === 0).length);
      const baselineBroken = await countBroken();   // ảnh hỏng sẵn có trước khi chọn tệp (nếu có)
      const readThumbs = async () => {
        const blob = await thumbImgs.count();
        const diff = Math.max(0, (await allImgs.count()) - baselineImgs);
        const broken = Math.max(0, (await countBroken()) - baselineBroken);
        const srcs = await allImgs.evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src.slice(0, 80)));
        return { count: blob || diff, broken, srcs };
      };

      // Click [Gửi ảnh thực tế] -> hộp thoại chọn tệp -> chọn tệp. Trả về kết quả thay vì ném lỗi để ghi nhận.
      const addFiles = async (files: string[]) => {
        try {
          const [chooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 5000 }),
            uploadLink.click({ timeout: 5000 }),
          ]);
          await chooser.setFiles(files);
          return { ok: true, error: '' };
        } catch (e) {
          return { ok: false, error: (e as Error).message.split('\n')[0] };
        }
      };

      const readLayout = () => modal.evaluate((root) => ({ modalOverflowX: (root as HTMLElement).scrollWidth > (root as HTMLElement).clientWidth + 1 }));
      return { modal, fileInput, readThumbs, addFiles, readLayout };
    };

    // Chạy 1 trường hợp: mở popup mới -> chọn 1 tệp -> ghi nhận mọi phản ứng của web
    const runCase = async (key: string, file: string, waitMs = 4000) => {
      const ctx = await openForm();
      const baseline = new Set(await readLines());
      dialogs.length = 0;
      const upBefore = uploadRequests.length;
      const stBefore = uploadStatuses.length;

      const msgPromise = collectNewMessages(baseline, waitMs);
      const r = await ctx.addFiles([file]);
      const newMessages = await msgPromise;

      // Trình duyệt có bị treo không: gọi 1 lệnh đơn giản trong trang, quá 5 giây không trả lời = treo
      const ping = await Promise.race([
        page.evaluate(() => document.title).then(() => 'ok'),
        new Promise<string>((res) => setTimeout(() => res('timeout'), 5000)),
      ]);

      const t = await ctx.readThumbs();
      const layout = await ctx.readLayout();
      const result = {
        tep: file.split(/[\\/]/).pop(),
        kichThuocMB: +(fs.statSync(file).size / 1024 / 1024).toFixed(2),
        chonDuoc: r.ok, loi: r.error,
        soAnhThuNho: t.count, soAnhHong: t.broken,
        anhTrongPopup: t.srcs.slice(-3),
        thongBaoMoi: newMessages, hopThoai: [...dialogs],
        soRequestTaiLen: uploadRequests.length - upBefore,
        trangThaiTaiLen: uploadStatuses.slice(stBefore),
        trangPhanHoi: ping === 'ok', ...layout,
        coThongBao: newMessages.length > 0 || dialogs.length > 0,
      };
      observed[key] = result;
      console.log(`[Review_Form_15] ${key}: ${JSON.stringify(result)}`);
      await shot(page, `Review_Form_15_${key}`);
      return { ctx, result };
    };

    // ============================================================================
    // Step 1: tệp PDF/TXT -> không nhận, báo sai định dạng
    // ============================================================================
    for (const [key, file] of [['buoc1a_txt', FILE_TXT], ['buoc1b_pdf', FILE_PDF]] as const) {
      await test.step(`Step 1: Chọn tệp ${key.endsWith('txt') ? 'TXT' : 'PDF'} -> không nhận, báo sai định dạng`, async () => {
        const { result: r } = await runCase(key, file);
        expect.soft(r.soAnhThuNho, 'Tệp không phải ảnh thì không được nhận vào danh sách ảnh').toBe(0);
        expect.soft(r.coThongBao || !r.chonDuoc, 'Phải báo sai định dạng (hoặc chặn ngay từ giao diện)').toBe(true);
        expect.soft(r.trangPhanHoi, 'Trình duyệt không được bị treo').toBe(true);
        if (r.soAnhThuNho === 0 && !r.coThongBao && r.chonDuoc) {
          note('ux-note', `[Review_Form_15] Chọn tệp ${key}: bị bỏ qua im lặng, không có thông báo sai định dạng.`);
        }
        if (r.soRequestTaiLen > 0) {
          note('data-note', `[Review_Form_15] Tệp ${key} vẫn bị gửi lên server (${r.soRequestTaiLen} request, trạng thái ${JSON.stringify(r.trangThaiTaiLen)}).`);
        }
      });
    }

    // ============================================================================
    // Step 2: tệp đổi đuôi .jpg nhưng không phải ảnh -> không nhận hoặc báo lỗi, không hiển thị ảnh hỏng
    // ============================================================================
    await test.step('Step 2: Chọn tệp giả ảnh (đuôi .jpg nhưng không phải ảnh)', async () => {
      const { result: r } = await runCase('buoc2_gia_anh', FILE_FAKE_JPG);
      expect.soft(r.soAnhHong, 'Không được hiển thị ảnh thu nhỏ bị hỏng').toBe(0);
      expect.soft(r.soAnhThuNho === 0 || r.coThongBao, 'Tệp giả ảnh phải bị từ chối hoặc có báo lỗi').toBe(true);
      expect.soft(r.trangPhanHoi, 'Trình duyệt không được bị treo').toBe(true);
      if (r.soAnhThuNho > 0) {
        note('defect-note', `[Review_Form_15] Tệp giả ảnh (.jpg không phải ảnh) được nhận vào danh sách (${r.soAnhThuNho} ảnh, ${r.soAnhHong} ảnh hỏng) -> web chỉ kiểm tra đuôi tệp.`);
      }
      if (r.soRequestTaiLen > 0) {
        note('data-note', `[Review_Form_15] Tệp giả ảnh vẫn bị gửi lên server (trạng thái ${JSON.stringify(r.trangThaiTaiLen)}).`);
      }
    });

    // ============================================================================
    // Step 3: ảnh dung lượng lớn (>= 10MB) -> báo vượt dung lượng hoặc xử lý được; không treo trình duyệt
    // ============================================================================
    await test.step('Step 3: Chọn ảnh dung lượng lớn (>= 10MB)', async () => {
      const sizeMB = fs.statSync(FILE_HEAVY_10MB).size / 1024 / 1024;
      expect.soft(sizeMB, `Tệp mẫu phải >= 10MB, thực tế ${sizeMB.toFixed(2)}MB`).toBeGreaterThanOrEqual(10);

      const { result: r } = await runCase('buoc3_anh_nang', FILE_HEAVY_10MB, 8000);
      const processed = r.soAnhThuNho >= 1 && r.soAnhHong === 0;
      expect.soft(r.coThongBao || processed || !r.chonDuoc, 'Ảnh >= 10MB phải bị báo vượt dung lượng hoặc được xử lý (hiển thị ảnh bình thường)').toBe(true);
      expect.soft(r.trangPhanHoi, 'Trình duyệt không được bị treo khi chọn ảnh nặng').toBe(true);
      expect.soft(r.modalOverflowX, 'Popup không được tràn ngang').toBe(false);
      note('rule-check', `[Review_Form_15] Ảnh ${r.kichThuocMB}MB: ${r.coThongBao ? `có thông báo ${JSON.stringify(r.thongBaoMoi)}` : processed ? 'được nhận và xử lý bình thường' : 'bị bỏ qua/không hiển thị'}; tải lên server: ${r.soRequestTaiLen} request, trạng thái ${JSON.stringify(r.trangThaiTaiLen)}.`);
      if (!r.coThongBao && !processed) {
        note('defect-note', `[Review_Form_15] Ảnh ${r.kichThuocMB}MB không được nhận cũng không có thông báo vượt dung lượng.`);
      }
    });

    // ============================================================================
    // Step 4: ảnh định dạng khác (PNG, WEBP, GIF, HEIC) -> nhận hoặc báo rõ định dạng được hỗ trợ
    // ============================================================================
    for (const [key, label, file, real] of [
      ['buoc4a_png', 'PNG', FILE_PNG, true],
      ['buoc4b_webp', 'WEBP', FILE_WEBP, true],
      ['buoc4c_gif', 'GIF', FILE_GIF, true],
      ['buoc4d_heic', 'HEIC (tệp mô phỏng, không phải ảnh HEIC thật)', FILE_HEIC_STUB, false],
    ] as const) {
      await test.step(`Step 4: Chọn ảnh định dạng ${label}`, async () => {
        const { result: r } = await runCase(key, file);
        expect.soft(r.trangPhanHoi, 'Trình duyệt không được bị treo').toBe(true);
        if (real) {
          const accepted = r.soAnhThuNho >= 1 && r.soAnhHong === 0;
          expect.soft(accepted || r.coThongBao, `Ảnh ${label} phải được nhận hoặc có thông báo rõ định dạng được hỗ trợ`).toBe(true);
          note('rule-check', `[Review_Form_15] Định dạng ${label}: ${accepted ? 'được NHẬN' : r.coThongBao ? `bị TỪ CHỐI kèm thông báo ${JSON.stringify(r.thongBaoMoi)}` : 'bị bỏ qua im lặng'}.`);
        } else {
          // HEIC chỉ để ghi nhận: không tạo được ảnh HEIC thật nên không kết luận đúng/sai
          note('rule-check', `[Review_Form_15] Đuôi .heic (tệp mô phỏng): ${r.soAnhThuNho >= 1 ? 'được nhận vào danh sách' : r.coThongBao ? `bị từ chối: ${JSON.stringify(r.thongBaoMoi)}` : 'bị bỏ qua'}; cần thử bằng ảnh HEIC thật để kết luận.`);
        }
        if (r.soAnhHong > 0) {
          note('defect-note', `[Review_Form_15] Ảnh ${label} được nhận nhưng hiển thị ảnh thu nhỏ bị hỏng (${r.soAnhHong}).`);
        }
      });
    }

    // ---------- Expected chung: không lỗi hệ thống, không gửi đánh giá ----------
    await test.step('Expected chung: Không lỗi JavaScript, không gửi đánh giá', async () => {
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
      expect.soft(postRequests, 'Test không được gửi đánh giá lên server').toEqual([]);
      observed.tongSoRequestTaiLenServer = uploadRequests.length;
      note('data-note', `[Review_Form_15] ${ABORT_UPLOAD ? 'Đã chặn request tải tệp (ABORT_UPLOAD=true)' : `Web tải tệp lên server ngay khi chọn: ${uploadRequests.length} request /Upload/ProductRatings, trạng thái ${JSON.stringify(uploadStatuses)}`}.`);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_15_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_15] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: chỉ đóng popup
    await closeReviewModal(page);
  });

  test('Review_Form_16: Kiểm tra các liên kết [Chính sách dữ liệu cá nhân], [Quy định đánh giá], [Chính sách bảo mật thông tin]', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(300000);
    page.setDefaultTimeout(15000);
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const COMMENT = 'Đang nhập dở nhận xét để kiểm tra liên kết';
    const observed: Record<string, unknown> = {};

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Theo dõi request gửi đánh giá: test này tuyệt đối không được gửi gì lên server.
    // POST .../api/Comment/Product/Code là request TẢI danh sách đánh giá (chạy mỗi lần mở trang) -> loại ra.
    const postRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (
        req.method() === 'POST' &&
        /api\.dienmayxanh\.com/i.test(url) &&
        /comment|review|danh-gia|rating/i.test(url) &&
        !/\/Comment\/Product\/Code/i.test(url)
      ) postRequests.push(url);
    });

    // 3 liên kết cần kiểm tra: tên hiển thị, slug DỰ ĐOÁN của trang đích (chỉ để đối chiếu), dấu hiệu nội dung trang đích
    const LINKS = [
      { key: 'buoc1_chinh_sach_du_lieu_ca_nhan', label: 'Chính sách dữ liệu cá nhân', slug: 'chinh-sach-xu-ly-du-lieu-ca-nhan', content: /chính sách|dữ liệu cá nhân|xử lý dữ liệu/i },
      { key: 'buoc2_quy_dinh_danh_gia', label: 'Quy định đánh giá', slug: 'huong-dan-dang-binh-luan', content: /quy định|hướng dẫn|đánh giá|bình luận/i },
      { key: 'buoc3_chinh_sach_bao_mat', label: 'Chính sách bảo mật thông tin', slug: 'dieu-khoan-su-dung', content: /bảo mật|điều khoản|sử dụng/i },
    ];

    // Mở popup, chọn sao để form mở rộng, nhập dở một vài thông tin
    const openFilledForm = async () => {
      await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissPopups(page);
      const modal = await openReviewModal(page);
      const textarea = modal.locator('textarea#feeling, textarea').first();
      const nameInput = modal.locator('input#fullName, input[name="fullName"]');
      const phoneInput = modal.locator('input#phone, input[name="phone"]');
      const agree = modal.locator('input#agree, input[name="agree"]');

      await modal.getByText('Tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(textarea, 'Sau khi chọn sao phải hiện ô nhận xét').toBeVisible({ timeout: 10000 });
      if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
      if (!(await phoneInput.inputValue())) await phoneInput.fill(TEST_PHONE);
      await textarea.fill(COMMENT);
      await page.waitForTimeout(400);

      const readForm = async () => ({
        nhanXet: await textarea.inputValue().catch(() => ''),
        hoTen: await nameInput.inputValue().catch(() => ''),
        sdt: await phoneInput.inputValue().catch(() => ''),
        daDongY: await agree.isChecked().catch(() => false),
      });
      return { modal, readForm };
    };

    for (const L of LINKS) {
      await test.step(`${L.key}: Click [${L.label}]`, async () => {
        const t0 = Date.now();
        const { modal, readForm } = await openFilledForm();
        const link = modal.locator('a', { hasText: L.label }).first();
        await expect(link, `Phải có liên kết [${L.label}] trong popup`).toBeVisible({ timeout: 10000 });

        const href = (await link.getAttribute('href')) || '';
        const target = await link.getAttribute('target');
        const linkText = ((await link.innerText().catch(() => '')) || '').trim();
        const absUrl = new URL(href, PRODUCT_URL).toString();
        const formBefore = await readForm();

        // Liên kết có trả về trang thật không (không 404): gọi trực tiếp địa chỉ của liên kết
        const apiStatus = await page.request.get(absUrl, { timeout: 30000 }).then((r) => r.status()).catch(() => 0);

        // Click liên kết rồi xác định web mở TAB MỚI hay chuyển TRONG CÙNG TAB
        const urlBefore = page.url();
        const newTabPromise = page.context().waitForEvent('page', { timeout: 6000 }).catch(() => null);
        await link.click();
        const newTab = await newTabPromise;
        if (!newTab) {
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          await page.waitForTimeout(1000);
        }
        const dest: Page | null = newTab ?? (page.url() !== urlBefore ? page : null);
        const mode = newTab ? 'tab_moi' : dest ? 'cung_tab' : 'khong_mo_trang';

        let destInfo: Record<string, unknown> = {};
        if (dest) {
          await dest.waitForLoadState('domcontentloaded').catch(() => {});
          await dest.waitForTimeout(1000);
          const url = dest.url();
          const title = await dest.title().catch(() => '');
          const bodyText = (((await dest.locator('body').innerText().catch(() => '')) || '')).replace(/\u00a0/g, ' ');
          const h1 = ((await dest.locator('h1').first().innerText().catch(() => '')) || '').trim();
          const is404 = /\b404\b|không tìm thấy|trang không tồn tại|page not found/i.test(`${title}\n${bodyText.slice(0, 400)}`);
          destInfo = { url, title, h1, doDaiNoiDung: bodyText.length, is404, khopNoiDung: L.content.test(`${title}\n${h1}\n${bodyText.slice(0, 2000)}`), urlChuaSlug: url.includes(L.slug) };
          console.log(`[Review_Form_16] ${L.key}: trang đích (${mode}) = ${url}`);
          const destShot = await dest.screenshot({ fullPage: false, timeout: 10000, animations: 'disabled' }).catch(() => null);
          if (destShot) {
            await test.info().attach(`Review_Form_16_${L.key}_trang_dich`, { body: destShot, contentType: 'image/png' });
          } else {
            note('ux-note', `[Review_Form_16] [${L.label}] không chụp được ảnh trang đích trong 10 giây (trang đích tải chậm hoặc treo): ${url}`);
          }
        }

        // Trạng thái form trên trang gốc sau khi click (chỉ so sánh khi mở TAB MỚI, vì cùng tab thì trang gốc đã bị rời đi)
        let formAfter: Awaited<ReturnType<typeof readForm>> | null = null;
        let modalStillOpen = false;
        if (mode === 'tab_moi') {
          formAfter = await readForm();
          modalStillOpen = await modal.isVisible().catch(() => false);
        }

        // Khi chuyển cùng tab: quay lại để xem dữ liệu form còn không (chỉ ghi nhận)
        let formSauKhiQuayLai: unknown = null;
        if (mode === 'cung_tab' && L === LINKS[0]) {   // chỉ kiểm tra "quay lại" 1 lần: hành vi cùng tab giống nhau ở cả 3 liên kết
          await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
          await page.waitForTimeout(1500);
          const modalBack = page.locator('.fixed:has-text("Đánh giá sản phẩm")').last();
          const popupConMo = await modalBack.isVisible().catch(() => false);
          const commentBack = popupConMo ? await modalBack.locator('textarea').first().inputValue().catch(() => '') : '';
          formSauKhiQuayLai = { popupConMo, nhanXetConLai: commentBack };
        }

        observed[L.key] = { href, target, linkText, apiStatus, mode, formBefore, formAfter, modalStillOpen, formSauKhiQuayLai, ...destInfo };
        console.log(`[Review_Form_16] ${L.key}: ${JSON.stringify(observed[L.key])}`);

        // ---------- Expected ----------
        expect.soft(linkText.length, `Liên kết [${L.label}] phải có chữ hiển thị`).toBeGreaterThan(0);
        expect.soft(apiStatus, `Địa chỉ ${absUrl} phải trả về trang hợp lệ (không 4xx/5xx), thực tế: ${apiStatus}`).toBeLessThan(400);
        expect.soft(apiStatus, `Địa chỉ ${absUrl} không được lỗi kết nối`).toBeGreaterThan(0);
        expect.soft(mode, `Click [${L.label}] phải mở ra trang chính sách (tab mới hoặc cùng tab)`).not.toBe('khong_mo_trang');
        if (dest) {
          if (!destInfo.urlChuaSlug) note('rule-check', `[Review_Form_16] [${L.label}] địa chỉ trang đích "${destInfo.url}" không chứa "${L.slug}" (slug dự đoán, đối chiếu với DOM thật).`);
          expect.soft(destInfo.is404, `Trang [${L.label}] không được là trang 404/không tìm thấy`).toBe(false);
          expect.soft(destInfo.khopNoiDung, `Nội dung trang phải liên quan đến [${L.label}] (tiêu đề: "${destInfo.title}", h1: "${destInfo.h1}")`).toBe(true);
          expect.soft(destInfo.doDaiNoiDung as number, 'Trang đích không được trống').toBeGreaterThan(200);
        }
        if (mode === 'tab_moi') {
          expect.soft(modalStillOpen, 'Mở tab mới thì popup đánh giá ở trang gốc phải còn mở').toBe(true);
          expect.soft(formAfter, 'Mở tab mới thì dữ liệu form đã nhập phải được giữ nguyên').toEqual(formBefore);
        }
        note('rule-check', `[Review_Form_16] [${L.label}]: ${mode === 'tab_moi' ? 'mở TAB MỚI (form giữ nguyên)' : mode === 'cung_tab' ? 'chuyển TRONG CÙNG TAB (rời khỏi trang sản phẩm)' : 'KHÔNG mở trang nào'}; target="${target ?? ''}"; trang đích: ${destInfo.url ?? '-'}.`);
        if (mode === 'cung_tab') {
          note('ux-note', `[Review_Form_16] [${L.label}] mở trong cùng tab: người dùng rời trang sản phẩm khi đang nhập đánh giá, sau khi quay lại: ${JSON.stringify(formSauKhiQuayLai)}.`);
        }
        await shot(page, `Review_Form_16_${L.key}_trang_goc`);

        console.log(`[Review_Form_16] ${L.key}: xong sau ${Math.round((Date.now() - t0) / 1000)} giây`);

        if (newTab) await newTab.close().catch(() => {});
      });
    }

    // ---------- Expected chung: không lỗi hệ thống, không gửi gì ----------
    await test.step('Expected chung: Không lỗi JavaScript, không gửi đánh giá', async () => {
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
      expect.soft(postRequests, 'Test không được gửi đánh giá lên server').toEqual([]);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_16_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_16] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: chỉ đóng popup (nếu còn mở)
    await closeReviewModal(page);
  });

  test('Review_Form_17: Kiểm tra đóng popup đang nhập dở', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(240000);
    page.setDefaultTimeout(15000);           // mọi thao tác/chờ không tự đặt timeout đều tối đa 15 giây (tránh treo vô hạn)
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const COMMENT = 'Nhận xét đang nhập dở để kiểm tra đóng popup';
    const COMMENT_2 = 'Nhận xét lần hai để kiểm tra phím Esc và click ngoài';
    const observed: Record<string, unknown> = {};

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Hộp thoại gốc của trình duyệt (confirm/beforeunload): ghi lại nội dung rồi đóng
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`);
      d.dismiss().catch(() => {});
    });

    // Theo dõi request gửi đánh giá: test này tuyệt đối không được gửi gì lên server.
    // POST .../api/Comment/Product/Code là request TẢI danh sách đánh giá (chạy mỗi lần mở trang) -> loại ra.
    const postRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (
        req.method() === 'POST' &&
        /api\.dienmayxanh\.com/i.test(url) &&
        /comment|review|danh-gia|rating/i.test(url) &&
        !/\/Comment\/Product\/Code/i.test(url)
      ) postRequests.push(url);
    });

    // Popup đang mở = khung popup hiển thị VÀ có nút [Gửi đánh giá]
    const popupSel = page.locator('.fixed:has-text("Đánh giá sản phẩm")').last();
    const isOpen = async (): Promise<boolean> =>
      (await popupSel.isVisible().catch(() => false)) &&
      (await popupSel.locator('button:has-text("Gửi đánh giá")').isVisible().catch(() => false));

    // Đọc các dòng chữ đang hiển thị trên trang (hộp xác nhận có thể nằm ngoài popup)
    const readLines = async (): Promise<string[]> =>
      (((await page.locator('body').innerText().catch(() => '')) || '')
        .split('\n').map((s) => s.trim()).filter(Boolean));

    // Thu thập các dòng chữ MỚI xuất hiện có dạng hỏi xác nhận / cảnh báo mất dữ liệu
    const collectNewMessages = async (baseline: Set<string>, ms: number): Promise<string[]> => {
      const found = new Set<string>();
      const end = Date.now() + ms;
      while (Date.now() < end) {
        for (const l of await readLines()) {
          if (!baseline.has(l) && l.length < 250 && /xác nhận|có chắc|thoát|hủy|huỷ|mất|chưa lưu|bản nháp|rời/i.test(l)) found.add(l);
        }
        await page.waitForTimeout(300);
      }
      return [...found];
    };

    // Đọc trạng thái form hiện tại
    const readState = async (modal: Locator) => {
      const textarea = modal.locator('textarea#feeling, textarea').first();
      return {
        formDaMoRong: await textarea.isVisible().catch(() => false),   // form mở rộng chỉ hiện sau khi chọn sao
        nhanXet: await textarea.inputValue().catch(() => ''),
        hoTen: await modal.locator('input#fullName, input[name="fullName"]').inputValue().catch(() => ''),
        sdt: await modal.locator('input#phone, input[name="phone"]').inputValue().catch(() => ''),
      };
    };

    // Đảm bảo form đã mở rộng (chọn sao nếu cần), điền Họ tên/SĐT nếu trống, nhập nhận xét
    const fillForm = async (modal: Locator, text: string) => {
      const textarea = modal.locator('textarea#feeling, textarea').first();
      const nameInput = modal.locator('input#fullName, input[name="fullName"]');
      const phoneInput = modal.locator('input#phone, input[name="phone"]');
      if (!(await textarea.isVisible().catch(() => false))) {
        await modal.getByText('Tốt', { exact: true }).click();
        await page.waitForTimeout(800);
      }
      await expect(textarea, 'Phải có ô nhận xét').toBeVisible({ timeout: 10000 });
      if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
      if (!(await phoneInput.inputValue())) await phoneInput.fill(TEST_PHONE);
      await textarea.fill(text);
      await page.waitForTimeout(400);
      return textarea;
    };

    // Click nút ✕ (dự phòng click qua DOM khi nút nằm ngoài vùng nhìn thấy)
    const clickClose = async (): Promise<string> => {
      const closeBtn = popupSel.locator('button:has(span:has-text("✕")), button:has-text("✕")').first();
      if (!(await closeBtn.isVisible().catch(() => false))) return 'khong_thay_nut_x';
      let ok = true;
      await closeBtn.click({ timeout: 3000 }).catch(() => { ok = false; });
      if (!ok) await closeBtn.evaluate((el) => (el as HTMLElement).click()).catch(() => {});
      return ok ? 'click_thuong' : 'click_qua_dom';
    };

    // ---------- Pre-condition: đã đăng nhập, mở trang sản phẩm, click [Viết đánh giá] -> popup mở ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    let modal = await openReviewModal(page);
    await expect(modal, 'Popup phải mở trước khi bắt đầu').toBeVisible({ timeout: 10000 });

    // ============================================================================
    // Step 1 / Expected 1: chọn sao, nhập nội dung, click ✕ -> popup đóng (có thể hỏi xác nhận), không tạo đánh giá
    // ============================================================================
    await test.step('Step 1: Chọn sao, nhập nội dung, click ✕', async () => {
      await modal.getByText('Tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await fillForm(modal, COMMENT);
      const before = await readState(modal);
      observed.buoc1_truocKhiDong = before;
      await shot(page, 'Review_Form_17_buoc1_truoc_khi_dong');

      const baseline = new Set(await readLines());
      dialogs.length = 0;
      const how = await clickClose();
      const msgPromise = collectNewMessages(baseline, 2500);
      await page.waitForTimeout(600);
      const openRightAfter = await isOpen();
      const messages = await msgPromise;

      // Nếu popup còn mở và có lời nhắc xác nhận -> thử bấm nút xác nhận để đóng (chỉ bấm khi có lời nhắc)
      let confirmClicked = false;
      if (openRightAfter && messages.length > 0) {
        const confirmBtn = page.locator('.fixed button').filter({ hasText: /^(Thoát|Đóng|Đồng ý|Xác nhận|Có|OK)$/i }).last();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click({ timeout: 3000 }).catch(() => {});
          confirmClicked = true;
          await page.waitForTimeout(800);
        }
      }
      const openFinal = await isOpen();
      observed.buoc1_dongBangX = { cachClick: how, conMoNgaySauKhiClick: openRightAfter, loiNhacXacNhan: messages, hopThoaiGoc: [...dialogs], daBamXacNhan: confirmClicked, conMoCuoiCung: openFinal };
      console.log(`[Review_Form_17] Click ✕ (${how}): còn mở ngay sau đó=${openRightAfter}; lời nhắc=${JSON.stringify(messages)}; hộp thoại=${JSON.stringify(dialogs)}; đã bấm xác nhận=${confirmClicked}; còn mở cuối cùng=${openFinal}`);

      expect.soft(how, 'Phải có nút ✕ để đóng popup').not.toBe('khong_thay_nut_x');
      expect.soft(openFinal, 'Click ✕ thì popup phải đóng (kể cả khi có hỏi xác nhận)').toBe(false);
      expect.soft(postRequests, 'Đóng popup không được tạo đánh giá').toEqual([]);
      note('rule-check', `[Review_Form_17] Click ✕ khi đang nhập dở: ${openRightAfter ? `popup KHÔNG đóng ngay${messages.length ? ` (có lời nhắc: ${JSON.stringify(messages)})` : ' và không có lời nhắc nào'}` : 'popup đóng NGAY, không hỏi xác nhận'}.`);
      await shot(page, 'Review_Form_17_buoc1_sau_khi_dong');
    });

    // Nếu popup vẫn còn mở thì đóng bằng hàm dùng chung để các bước sau bắt đầu từ trạng thái sạch
    if (await isOpen()) await closeReviewModal(page);

    // ============================================================================
    // Step 2 / Expected 2: mở lại [Viết đánh giá] -> form trống hoặc giữ bản nháp theo thiết kế
    // ============================================================================
    await test.step('Step 2: Mở lại [Viết đánh giá]', async () => {
      modal = await openReviewModal(page);
      await expect(modal, 'Popup phải mở lại được').toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(800);
      const st = await readState(modal);
      const trong = st.nhanXet === '';
      const giuNhap = st.nhanXet === COMMENT;
      observed.buoc2_moLai = { ...st, formTrong: trong, giuBanNhap: giuNhap };
      console.log(`[Review_Form_17] Mở lại popup: nhận xét="${st.nhanXet}", form mở rộng=${st.formDaMoRong} -> ${giuNhap ? 'GIỮ bản nháp' : trong ? 'form TRỐNG' : 'nội dung LẠ'}`);

      // Chấp nhận cả 2 thiết kế (form trống / giữ bản nháp); không chấp nhận nội dung lạ
      expect.soft(trong || giuNhap, `Mở lại popup thì form phải trống hoặc giữ đúng bản nháp, thực tế nhận xét: "${st.nhanXet}"`).toBe(true);
      note('rule-check', `[Review_Form_17] Mở lại sau khi đóng bằng ✕: ${giuNhap ? 'GIỮ bản nháp (nhận xét còn nguyên)' : trong ? 'form TRỐNG (không lưu bản nháp)' : 'nội dung không xác định'}; Họ tên="${st.hoTen}", SĐT="${st.sdt}".`);
      await shot(page, 'Review_Form_17_buoc2_mo_lai');
    });

    // ============================================================================
    // Step 3 / Expected 3: nhập nội dung, nhấn Esc, rồi click ngoài vùng popup
    // ============================================================================
    await test.step('Step 3a: Nhập nội dung rồi nhấn phím Esc', async () => {
      const textarea = await fillForm(modal, COMMENT_2);
      await textarea.press('Escape');
      await page.waitForTimeout(1000);
      const escCloses = !(await isOpen());
      observed.buoc3a_esc = { popupDongBangEsc: escCloses, hopThoaiGoc: [...dialogs] };
      console.log(`[Review_Form_17] Nhấn Esc -> popup ${escCloses ? 'ĐÓNG' : 'vẫn MỞ'}`);
      note('rule-check', `[Review_Form_17] Phím Esc: popup ${escCloses ? 'ĐÓNG' : 'KHÔNG đóng'} (Excel: "nếu hỗ trợ").`);
      expect.soft(postRequests, 'Nhấn Esc không được gửi đánh giá').toEqual([]);
      await shot(page, 'Review_Form_17_buoc3a_sau_esc');
    });

    await test.step('Step 3b: Click ngoài vùng popup', async () => {
      if (!(await isOpen())) {
        // Esc đã đóng popup -> mở lại để thử click ngoài
        modal = await openReviewModal(page);
        await page.waitForTimeout(800);
      }
      await fillForm(modal, COMMENT_2);

      // Điểm click: góc trên-trái màn hình, nằm ngoài khung nội dung popup
      await page.mouse.click(5, 5);
      await page.waitForTimeout(1000);
      const outsideCloses = !(await isOpen());
      observed.buoc3b_clickNgoai = { popupDongKhiClickNgoai: outsideCloses, hopThoaiGoc: [...dialogs] };
      console.log(`[Review_Form_17] Click ngoài vùng popup -> popup ${outsideCloses ? 'ĐÓNG' : 'vẫn MỞ'}`);
      note('rule-check', `[Review_Form_17] Click ngoài vùng popup: popup ${outsideCloses ? 'ĐÓNG' : 'KHÔNG đóng'} (Excel: "nếu hỗ trợ").`);
      expect.soft(postRequests, 'Click ngoài popup không được gửi đánh giá').toEqual([]);
      await shot(page, 'Review_Form_17_buoc3b_sau_click_ngoai');
    });

    // ---------- Expected chung: không lỗi hệ thống, không gửi đánh giá ----------
    await test.step('Expected chung: Không lỗi JavaScript, không gửi đánh giá', async () => {
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
      expect.soft(postRequests, 'Test không được gửi đánh giá lên server').toEqual([]);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_17_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_17] Số liệu ghi nhận:', JSON.stringify(observed));

    // Không gửi gì lên web: đóng popup nếu còn mở
    if (await isOpen()) await closeReviewModal(page);
  });

  test('Review_Form_18: Kiểm tra thao tác bằng bàn phím trong form', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(240000);
    page.setDefaultTimeout(15000);           // mọi thao tác/chờ không tự đặt timeout đều tối đa 15 giây (tránh treo vô hạn)
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const COMMENT = 'Nồi nấu cơm ngon, dễ dùng';
    const MAX_TABS = 25;                     // số lần nhấn Tab tối đa cho mỗi lượt duyệt
    const observed: Record<string, unknown> = {};

    // Thứ tự focus mong đợi theo Excel: sao → nhận xét → checkbox → ảnh → họ tên → SĐT → đồng ý → nút Gửi
    const EXPECTED_ORDER = ['sao', 'nhan_xet', 'gioi_thieu', 'anh', 'ho_ten', 'sdt', 'dong_y', 'nut_gui'];

    // Gom lỗi JavaScript của trang để kiểm tra "không lỗi"
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Theo dõi request gửi đánh giá: test này tuyệt đối không được gửi gì lên server.
    // POST .../api/Comment/Product/Code là request TẢI danh sách đánh giá (chạy mỗi lần mở trang) -> loại ra.
    const postRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (
        req.method() === 'POST' &&
        /api\.dienmayxanh\.com/i.test(url) &&
        /comment|review|danh-gia|rating/i.test(url) &&
        !/\/Comment\/Product\/Code/i.test(url)
      ) postRequests.push(url);
    });

    // Popup đang mở = khung popup hiển thị VÀ có nút [Gửi đánh giá]
    const popupSel = page.locator('.fixed:has-text("Đánh giá sản phẩm")').last();
    const isOpen = async (): Promise<boolean> =>
      (await popupSel.isVisible().catch(() => false)) &&
      (await popupSel.locator('button:has-text("Gửi đánh giá")').isVisible().catch(() => false));

    // ---------- Pre-condition: đã đăng nhập, mở trang sản phẩm, click [Viết đánh giá] -> popup mở ----------
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    const modal = await openReviewModal(page);
    await expect(modal, 'Popup phải mở trước khi bắt đầu').toBeVisible({ timeout: 10000 });

    const textarea = modal.locator('textarea#feeling, textarea').first();
    const nameInput = modal.locator('input#fullName, input[name="fullName"]');
    const phoneInput = modal.locator('input#phone, input[name="phone"]');
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');

    // Mô tả phần tử đang giữ focus: loại phần tử, nằm trong popup không, có viền focus không
    type Focused = {
      tag: string; type: string; id: string; name: string; text: string; aria: string; placeholder: string;
      inPopup: boolean; disabled: boolean; outline: string; boxShadow: string; focusVisible: boolean; coVienFocus: boolean;
    } | null;
    const describeActive = (): Promise<Focused> =>
      modal.evaluate((root) => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const outlineVisible = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const shadow = cs.boxShadow !== 'none';
        const input = el as HTMLInputElement;
        return {
          tag: el.tagName.toLowerCase(),
          type: input.type || '',
          id: el.id || '',
          name: input.name || '',
          text: ((el.innerText || input.value || '') + '').trim().slice(0, 40),
          aria: el.getAttribute('aria-label') || el.getAttribute('title') || '',
          placeholder: input.placeholder || '',
          inPopup: root.contains(el),
          disabled: !!input.disabled,
          outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
          boxShadow: cs.boxShadow,
          focusVisible: el.matches(':focus-visible'),
          coVienFocus: outlineVisible || shadow,
        };
      });

    // Quy phần tử đang focus về thành phần của form
    const classify = (d: NonNullable<Focused>): string => {
      const t = `${d.id} ${d.name} ${d.text} ${d.aria} ${d.placeholder}`.toLowerCase();
      if (d.tag === 'textarea') return 'nhan_xet';
      if (d.id === 'fullName' || /fullname/.test(d.name)) return 'ho_ten';
      if (d.id === 'phone' || d.name === 'phone') return 'sdt';
      if (d.type === 'checkbox') return d.id === 'agree' || d.name === 'agree' ? 'dong_y' : 'gioi_thieu';
      if (d.type === 'file' || /ảnh/.test(t)) return 'anh';
      if (/gửi đánh giá/.test(t)) return 'nut_gui';
      if (/✕|đóng|close/.test(t)) return 'nut_dong';
      if (/rất tệ|tệ|tạm ổn|tốt|rất tốt/.test(t)) return 'sao';
      return 'khac';
    };

    // Duyệt bằng phím Tab từ đầu popup, ghi lại thứ tự focus
    const traverse = async (label: string) => {
      // Đặt điểm bắt đầu ở ĐẦU popup bằng 1 phần tử tạm (tabindex=0) chèn làm con đầu tiên rồi focus vào nó;
      // nhấn Tab từ đó sẽ đi lần lượt qua mọi thành phần trong popup theo đúng thứ tự trong DOM. Xóa phần tử tạm khi duyệt xong.
      await modal.evaluate((root) => {
        (document.activeElement as HTMLElement | null)?.blur?.();
        root.querySelector('[data-pw-sentinel]')?.remove();
        const s = document.createElement('span');
        s.tabIndex = 0;
        s.setAttribute('data-pw-sentinel', '1');
        root.insertBefore(s, root.firstChild);
        s.focus();
      });

      const steps: Array<{ buoc: number; thanhPhan: string; chiTiet: NonNullable<Focused> }> = [];
      const seen = new Set<string>();
      let insideSeen = false;
      let leftPopup = false;
      let cycled = false;

      for (let i = 1; i <= MAX_TABS; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(150);
        const d = await describeActive();
        if (!d) continue;
        if (!d.inPopup) {
          if (insideSeen) { leftPopup = true; break; }   // đã ở trong popup rồi focus thoát ra ngoài
          continue;                                       // chưa vào popup: bỏ qua phần tử bên ngoài
        }
        insideSeen = true;
        const key = `${d.tag}|${d.id}|${d.name}|${d.text}|${d.aria}`;
        if (seen.has(key)) { cycled = true; break; }      // quay lại phần tử đã duyệt = hết vòng
        seen.add(key);
        steps.push({ buoc: i, thanhPhan: classify(d), chiTiet: d });
      }

      await modal.evaluate((root) => root.querySelector('[data-pw-sentinel]')?.remove());

      const sequence = steps.map((s) => s.thanhPhan);
      const firstOccurrence = [...new Set(sequence)].filter((k) => EXPECTED_ORDER.includes(k));
      const expectedFiltered = EXPECTED_ORDER.filter((k) => firstOccurrence.includes(k));
      const missing = EXPECTED_ORDER.filter((k) => !sequence.includes(k));
      const noIndicator = steps.filter((s) => !s.chiTiet.coVienFocus && !s.chiTiet.focusVisible).map((s) => `${s.thanhPhan} (${s.chiTiet.tag}${s.chiTiet.id ? '#' + s.chiTiet.id : ''})`);

      const result = {
        soPhanTuDuyetDuoc: steps.length,
        thuTuThucTe: sequence,
        thuTuLanDauXuatHien: firstOccurrence,
        thuTuMongDoi: expectedFiltered,
        thanhPhanKhongDuyetDuocBangTab: missing,
        phanTuKhongCoVienFocus: noIndicator,
        focusThoatKhoiPopup: leftPopup,
        quayVongTrongPopup: cycled,
        chiTiet: steps,
      };
      observed[label] = result;
      console.log(`[Review_Form_18] ${label}: thứ tự=${JSON.stringify(sequence)}; không duyệt được=${JSON.stringify(missing)}; không có viền focus=${JSON.stringify(noIndicator)}; thoát khỏi popup=${leftPopup}; quay vòng=${cycled}`);
      return result;
    };

    // ---------- Điều kiện: chọn sao để form mở rộng đầy đủ, Họ tên/SĐT hợp lệ, nhận xét có sẵn, CHƯA tick đồng ý ----------
    await test.step('Điều kiện: chọn sao, Họ tên/SĐT hợp lệ, nhập nhận xét, chưa tick đồng ý (form chưa hợp lệ)', async () => {
      await modal.getByText('Tốt', { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });
      if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
      if (!(await phoneInput.inputValue())) await phoneInput.fill(TEST_PHONE);
      await textarea.fill(COMMENT);
      await expect.soft(agree, 'Checkbox chính sách mặc định chưa tick').not.toBeChecked(SOFT);
      await expect.soft(submit, 'Chưa đồng ý chính sách thì nút Gửi phải vô hiệu (form chưa hợp lệ)').toBeDisabled(SOFT);
    });

    // ============================================================================
    // Step 1 / Expected 1: dùng phím Tab đi qua các thành phần -> thứ tự focus hợp lý, có viền focus rõ
    // ============================================================================
    await test.step('Step 1a: Duyệt bằng phím Tab khi form chưa hợp lệ (nút Gửi đang vô hiệu)', async () => {
      const r = await traverse('buoc1a_tab_form_chua_hop_le');
      await shot(page, 'Review_Form_18_buoc1a_tab');

      expect.soft(r.soPhanTuDuyetDuoc, 'Phải duyệt được ít nhất 1 thành phần của form bằng phím Tab').toBeGreaterThan(0);
      expect.soft(r.thuTuLanDauXuatHien, `Thứ tự focus phải theo đúng thứ tự mong đợi ${JSON.stringify(r.thuTuMongDoi)}, thực tế ${JSON.stringify(r.thuTuLanDauXuatHien)}`).toEqual(r.thuTuMongDoi);
      if (r.focusThoatKhoiPopup) note('ux-note', '[Review_Form_18] Sau thành phần cuối của popup, phím Tab đưa focus ra ngoài popup (không có focus trap) - Excel không yêu cầu, chỉ ghi nhận.');
      expect.soft(r.phanTuKhongCoVienFocus, `Mọi thành phần nhận focus phải có viền/dấu hiệu focus rõ, thiếu ở: ${JSON.stringify(r.phanTuKhongCoVienFocus)}`).toEqual([]);

      // Các thành phần không đến được bằng Tab: ghi nhận để đánh giá khả năng sử dụng bằng bàn phím
      const missing = r.thanhPhanKhongDuyetDuocBangTab.filter((k) => k !== 'nut_gui');
      if (r.soPhanTuDuyetDuoc > 0 && missing.length > 0) {
        note('ux-note', `[Review_Form_18] Không đến được bằng phím Tab: ${JSON.stringify(missing)} -> người dùng chỉ dùng bàn phím không thao tác được các thành phần này.`);
      }
      if (r.thanhPhanKhongDuyetDuocBangTab.includes('nut_gui')) {
        note('rule-check', '[Review_Form_18] Nút [Gửi đánh giá] không nhận focus khi bị vô hiệu (form chưa hợp lệ) - hành vi bình thường của nút disabled.');
      }
    });

    // ============================================================================
    // Step 2 / Expected 2: nhấn Enter khi form chưa hợp lệ -> không gửi được, không lỗi
    // ============================================================================
    await test.step('Step 2: Nhấn Enter khi form chưa hợp lệ (đang focus ở nhận xét, Họ tên, SĐT)', async () => {
      await expect.soft(submit, 'Điều kiện: nút Gửi phải đang vô hiệu (form chưa hợp lệ)').toBeDisabled(SOFT);
      const results: Record<string, unknown> = {};

      for (const [key, field] of [['nhan_xet', textarea], ['ho_ten', nameInput], ['sdt', phoneInput]] as const) {
        const requestsBefore = postRequests.length;
        await field.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);

        const open = await isOpen();
        const value = await field.inputValue().catch(() => '');
        results[key] = {
          popupConMo: open,
          requestGuiDanhGiaMoi: postRequests.length - requestsBefore,
          giaTriSauEnter: key === 'nhan_xet' ? value : undefined,
          nhanXetXuongDong: key === 'nhan_xet' ? value.includes('\n') : undefined,
        };
        console.log(`[Review_Form_18] Enter ở ô ${key}: ${JSON.stringify(results[key])}`);

        expect.soft(postRequests.length - requestsBefore, `Nhấn Enter ở ô ${key} khi form chưa hợp lệ không được gửi đánh giá`).toBe(0);
        expect.soft(open, `Nhấn Enter ở ô ${key} khi form chưa hợp lệ thì popup phải còn mở`).toBe(true);
        await expect.soft(submit, 'Nút Gửi vẫn phải vô hiệu sau khi nhấn Enter').toBeDisabled(SOFT);

        // Khôi phục: bỏ xuống dòng vừa thêm vào ô nhận xét
        if (key === 'nhan_xet') await textarea.fill(COMMENT);
      }
      observed.buoc2_enterKhiChuaHopLe = results;
      await shot(page, 'Review_Form_18_buoc2_enter_chua_hop_le');
    });

    // ============================================================================
    // Bổ sung: duyệt Tab khi form đã hợp lệ để kiểm tra nút [Gửi đánh giá] nhận focus (KHÔNG nhấn Enter/Space)
    // ============================================================================
    await test.step('Bổ sung: Duyệt Tab khi form hợp lệ -> nút [Gửi đánh giá] nhận focus và có viền focus (không nhấn gửi)', async () => {
      await setAgree(modal, page, true);
      await page.waitForTimeout(500);
      await expect.soft(submit, 'Điều kiện: form hợp lệ thì nút Gửi phải bật').toBeEnabled(SOFT);

      const r = await traverse('boSung_tab_form_hop_le');
      await shot(page, 'Review_Form_18_bo_sung_tab_form_hop_le');
      expect.soft(r.thuTuLanDauXuatHien, `Thứ tự focus khi form hợp lệ phải đúng ${JSON.stringify(r.thuTuMongDoi)}, thực tế ${JSON.stringify(r.thuTuLanDauXuatHien)}`).toEqual(r.thuTuMongDoi);
      expect.soft(r.thuTuLanDauXuatHien.includes('nut_gui'), 'Form hợp lệ thì nút [Gửi đánh giá] phải nhận được focus bằng phím Tab').toBe(true);
      const gui = r.chiTiet.find((s) => s.thanhPhan === 'nut_gui');
      if (gui) expect.soft(gui.chiTiet.coVienFocus || gui.chiTiet.focusVisible, 'Nút [Gửi đánh giá] khi nhận focus phải có viền focus rõ').toBe(true);

      // TUYỆT ĐỐI không nhấn Enter/Space khi form hợp lệ: tránh tạo đánh giá thật
      await setAgree(modal, page, false);   // trả về chưa đồng ý trước khi đóng popup
    });

    // ---------- Expected chung: không lỗi hệ thống, không gửi đánh giá ----------
    await test.step('Expected chung: Không lỗi JavaScript, không gửi đánh giá', async () => {
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
      expect.soft(postRequests, 'Test không được gửi đánh giá lên server').toEqual([]);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Form_18_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Form_18] Số liệu ghi nhận (rút gọn):', JSON.stringify({
      tabChuaHopLe: (observed.buoc1a_tab_form_chua_hop_le as any)?.thuTuThucTe,
      tabHopLe: (observed.boSung_tab_form_hop_le as any)?.thuTuThucTe,
      enter: observed.buoc2_enterKhiChuaHopLe,
    }));

    // Không gửi gì lên web: chỉ đóng popup
    await closeReviewModal(page);
  });
});

// ==============================================================================
// PHẦN 4: GỬI ĐÁNH GIÁ VÀ XỬ LÝ BIÊN (SUBMIT - 3 TEST CASES)
// ==============================================================================
test.describe("PHẦN 4: GỬI ĐÁNH GIÁ VÀ XỬ LÝ BIÊN (SUBMIT)", () => {
  test('Review_Submit_01: Kiểm tra gửi đánh giá khi mất kết nối mạng', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    test.setTimeout(240000);
    page.setDefaultTimeout(15000);           // mọi thao tác/chờ không tự đặt timeout đều tối đa 15 giây (tránh treo vô hạn)
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const context = page.context();
    const MARKER = `KiemThuMatMang-${Date.now()}`;                 // nội dung nhận xét có dấu vết riêng để tìm lại trong danh sách đánh giá
    const COMMENT = `Nồi nấu cơm ngon, dễ dùng ${MARKER}`;
    const observed: Record<string, unknown> = {};

    // Gom lỗi JavaScript của trang và hộp thoại gốc của trình duyệt
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`);
      d.dismiss().catch(() => {});
    });

    // ============================================================================
    // LỚP BẢO VỆ: không bao giờ để request TẠO đánh giá chạm tới server thật (Production, đánh giá hiển thị công khai).
    // - Mọi POST tới api.dienmayxanh.com có địa chỉ chứa comment/review/danh-gia/rating đều bị chặn (abort),
    //   TRỪ request tải danh sách đánh giá (/Comment/Product/Code, chạy mỗi lần mở trang).
    // - Đếm các lần web CỐ GỬI theo từng giai đoạn để biết web có tự gửi lại khi có mạng hay không.
    // Lưu ý: nếu địa chỉ gửi đánh giá không chứa các từ trên thì lớp này không chặn được; khi đó chỉ còn trạng thái Offline bảo vệ.
    // ============================================================================
    type Phase = 'truoc_offline' | 'dang_offline' | 'sau_khi_online';
    let phase: Phase = 'truoc_offline';
    const attempts: Array<{ giaiDoan: Phase; url: string }> = [];
    const isReviewWrite = (method: string, url: string) =>
      method === 'POST' &&
      /api\.dienmayxanh\.com/i.test(url) &&
      (/\/Comment\/Product\/create/i.test(url) ||
        (/comment|review|danh-gia|rating/i.test(url) && !/\/Comment\/Product\/Code/i.test(url)));

    page.on('request', (req) => {
      if (isReviewWrite(req.method(), req.url())) attempts.push({ giaiDoan: phase, url: req.url() });
    });
    await page.route(/api\.dienmayxanh\.com/i, (route) => {
      const req = route.request();
      if (isReviewWrite(req.method(), req.url())) return route.abort('failed');
      return route.continue();
    });

    // Đọc các dòng chữ đang hiển thị trên trang (thông báo lỗi có thể là toast nằm ngoài popup)
    const readLines = async (): Promise<string[]> =>
      (((await page.locator('body').innerText().catch(() => '')) || '')
        .split('\n').map((s) => s.trim()).filter(Boolean));
    const collectNewMessages = async (baseline: Set<string>, ms: number, pattern: RegExp): Promise<string[]> => {
      const found = new Set<string>();
      const end = Date.now() + ms;
      while (Date.now() < end) {
        for (const l of await readLines()) {
          if (!baseline.has(l) && l.length < 250 && pattern.test(l)) found.add(l);
        }
        await page.waitForTimeout(300);
      }
      return [...found];
    };
    const ERROR_RE = /lỗi|thất bại|không thể|kết nối|mạng|thử lại|sự cố|xảy ra/i;
    const SUCCESS_RE = /thành công|cảm ơn|đã gửi|đã ghi nhận|chờ duyệt/i;

    // Popup đang mở = khung popup hiển thị VÀ có nút [Gửi đánh giá]
    const popupSel = page.locator('.fixed:has-text("Đánh giá sản phẩm")').last();
    const isOpen = async (): Promise<boolean> =>
      (await popupSel.isVisible().catch(() => false)) &&
      (await popupSel.locator('button:has-text("Gửi đánh giá")').isVisible().catch(() => false));

    try {
      // ---------- Pre-condition: đã đăng nhập, mở trang sản phẩm, click [Viết đánh giá] -> popup mở ----------
      await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissPopups(page);
      const modal = await openReviewModal(page);
      await expect(modal, 'Popup phải mở trước khi bắt đầu').toBeVisible({ timeout: 10000 });

      const textarea = modal.locator('textarea#feeling, textarea').first();
      const nameInput = modal.locator('input#fullName, input[name="fullName"]');
      const phoneInput = modal.locator('input#phone, input[name="phone"]');
      const agree = modal.locator('input#agree, input[name="agree"]');
      const submit = modal.locator('button:has-text("Gửi đánh giá")');

      const readForm = async () => ({
        nhanXet: await textarea.inputValue().catch(() => ''),
        hoTen: await nameInput.inputValue().catch(() => ''),
        sdt: await phoneInput.inputValue().catch(() => ''),
        daDongY: await agree.isChecked().catch(() => false),
      });

      // ============================================================================
      // Step 1 / Expected 1: điền đủ thông tin hợp lệ -> nút [Gửi đánh giá] được bật
      // ============================================================================
      let formBefore: Awaited<ReturnType<typeof readForm>>;
      await test.step('Step 1: Điền đủ thông tin hợp lệ để nút Gửi được bật', async () => {
        await modal.getByText('Tốt', { exact: true }).click();
        await page.waitForTimeout(800);
        await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });
        if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
        if (!(await phoneInput.inputValue())) await phoneInput.fill(TEST_PHONE);
        await textarea.fill(COMMENT);
        await setAgree(modal, page, true);
        await page.waitForTimeout(500);

        await expect(submit, 'Điền đủ thông tin hợp lệ thì nút [Gửi đánh giá] phải được bật').toBeEnabled({ timeout: 5000 });
        formBefore = await readForm();
        observed.buoc1_formTruocKhiGui = formBefore;
        await shot(page, 'Review_Submit_01_buoc1_nut_gui_bat');
      });

      // ============================================================================
      // Step 2 / Expected 2: bật Offline TRƯỚC khi bấm Gửi -> thông báo lỗi, popup và dữ liệu được giữ, không báo thành công sai
      // ============================================================================
      await test.step('Step 2: Bật Offline, click [Gửi đánh giá]', async () => {
        // BẮT BUỘC xác nhận mạng đã tắt thật sự TRƯỚC khi bấm Gửi (kiểm tra cứng, không phải soft)
        await context.setOffline(true);
        phase = 'dang_offline';
        await page.waitForTimeout(500);
        const onLine = await page.evaluate(() => navigator.onLine);
        const fetchFailed = await page.evaluate(() => fetch('/favicon.ico', { cache: 'no-store' }).then(() => false).catch(() => true));
        observed.xacNhanOffline = { navigatorOnLine: onLine, fetchBiLoi: fetchFailed };
        expect(onLine, 'Phải ở trạng thái Offline trước khi bấm [Gửi đánh giá] (navigator.onLine = false)').toBe(false);
        expect(fetchFailed, 'Phải ở trạng thái Offline trước khi bấm [Gửi đánh giá] (fetch phải bị lỗi)').toBe(true);

        const baseline = new Set(await readLines());
        dialogs.length = 0;
        const msgPromise = Promise.all([
          collectNewMessages(baseline, 5000, ERROR_RE),
          collectNewMessages(baseline, 5000, SUCCESS_RE),
        ]);
        await submit.click({ timeout: 5000 });
        const [errorMessages, successMessages] = await msgPromise;

        const formAfter = await readForm();
        const open = await isOpen();
        const submitEnabledAfter = await submit.isEnabled().catch(() => false);
        const attemptsOffline = attempts.filter((a) => a.giaiDoan === 'dang_offline');
        observed.buoc2_khiOffline = {
          thongBaoLoi: errorMessages, thongBaoThanhCong: successMessages, hopThoaiGoc: [...dialogs],
          popupConMo: open, formSauKhiGui: formAfter, nutGuiBatLai: submitEnabledAfter,
          soLanWebCoGuiRequest: attemptsOffline.length, requestBiChan: attemptsOffline.map((a) => a.url),
        };
        console.log(`[Review_Submit_01] Click Gửi khi Offline: lỗi=${JSON.stringify(errorMessages)}; thành công=${JSON.stringify(successMessages)}; hộp thoại=${JSON.stringify(dialogs)}; popup còn mở=${open}; web có thử gửi=${attemptsOffline.length} lần`);
        await shot(page, 'Review_Submit_01_buoc2_sau_khi_gui_offline');

        expect.soft(errorMessages.length > 0 || dialogs.length > 0, 'Mất mạng khi gửi thì phải hiển thị thông báo lỗi').toBe(true);
        expect.soft(successMessages, `Mất mạng thì không được hiện thông báo thành công sai: ${JSON.stringify(successMessages)}`).toEqual([]);
        expect.soft(open, 'Popup phải còn mở sau khi gửi thất bại').toBe(true);
        expect.soft(formAfter, 'Dữ liệu đã nhập phải được giữ nguyên sau khi gửi thất bại').toEqual(formBefore);
        if (errorMessages.length === 0 && dialogs.length === 0) {
          note('defect-note', '[Review_Submit_01] Gửi đánh giá khi Offline: KHÔNG có thông báo lỗi nào (web im lặng).');
        }
        note('rule-check', `[Review_Submit_01] Gửi khi Offline: ${errorMessages.length ? `lỗi hiển thị ${JSON.stringify(errorMessages)}` : 'không có thông báo lỗi'}; popup ${open ? 'còn mở' : 'ĐÃ ĐÓNG'}; dữ liệu form ${JSON.stringify(formAfter) === JSON.stringify(formBefore) ? 'được giữ nguyên' : 'BỊ THAY ĐỔI'}; nút Gửi ${submitEnabledAfter ? 'bật lại' : 'vẫn tắt/đang xoay'}.`);
      });

      // ============================================================================
      // Step 3 / Expected 3: tắt Offline, quan sát web có TỰ GỬI LẠI không, tải lại trang -> không có đánh giá mới
      // ============================================================================
      await test.step('Step 3: Tắt Offline, quan sát tự gửi lại, tải lại trang sản phẩm', async () => {
        await context.setOffline(false);
        phase = 'sau_khi_online';
        await page.waitForTimeout(10000);   // chờ để bắt hành vi tự gửi lại (nếu có)

        const attemptsOnline = attempts.filter((a) => a.giaiDoan === 'sau_khi_online');
        observed.buoc3_sauKhiOnline = { soLanWebTuGuiLai: attemptsOnline.length, requestBiChan: attemptsOnline.map((a) => a.url) };
        console.log(`[Review_Submit_01] Sau khi có mạng lại, web tự gửi lại: ${attemptsOnline.length} lần`);
        expect.soft(attemptsOnline.length, 'Web không được tự gửi lại đánh giá khi có mạng trở lại khi người dùng chưa bấm gửi lại').toBe(0);
        if (attemptsOnline.length > 0) {
          note('defect-note', `[Review_Submit_01] Web TỰ GỬI LẠI đánh giá khi có mạng trở lại (${attemptsOnline.length} request). Request đã bị test chặn nên KHÔNG tạo đánh giá thật. Đây là điểm cần báo lại.`);
        }

        // Tải lại trang sản phẩm và tìm nhận xét có dấu vết riêng trong khu vực đánh giá
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
        await dismissPopups(page);
        await page.waitForTimeout(3000);
        const found = await page.getByText(MARKER).count();
        observed.buoc3_timThayDanhGiaMoi = found;
        console.log(`[Review_Submit_01] Sau khi tải lại, tìm thấy nhận xét có dấu vết "${MARKER}": ${found}`);
        expect.soft(found, 'Sau khi tải lại, không được có đánh giá mới nào chứa nội dung đã nhập khi mất mạng').toBe(0);
        note('rule-check', `[Review_Submit_01] Sau khi có mạng lại: web ${attemptsOnline.length ? 'TỰ GỬI LẠI' : 'không tự gửi lại'}; đánh giá chứa dấu vết ${found ? 'XUẤT HIỆN' : 'không xuất hiện'} trong danh sách (lưu ý: danh sách chỉ hiển thị đánh giá đã duyệt).`);
        await shot(page, 'Review_Submit_01_buoc3_sau_khi_tai_lai');
      });

      // ---------- Expected chung: không lỗi hệ thống ----------
      await test.step('Expected chung: Không lỗi JavaScript', async () => {
        expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
      });
    } finally {
      // Luôn trả mạng về bình thường và gỡ lớp bảo vệ dù test thành công hay thất bại
      await context.setOffline(false).catch(() => {});
      observed.tatCaLanWebCoGuiRequest = attempts;
      await attachText('Review_Submit_01_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
      console.log('[Review_Submit_01] Số liệu ghi nhận:', JSON.stringify(observed));
      await page.unroute(/api\.dienmayxanh\.com/i).catch(() => {});
    }

    // Không gửi gì lên web: đóng popup nếu còn mở
    if (await isOpen().catch(() => false)) await closeReviewModal(page);
  });

  test('Review_Submit_02: Kiểm tra gửi đánh giá thành công bằng tài khoản đã mua sản phẩm', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    // TEST NÀY GỬI ĐÁNH GIÁ THẬT lên Production -> chỉ chạy khi chủ động bật biến môi trường REAL_SUBMIT=1
    // PowerShell: $env:REAL_SUBMIT=1; npx playwright test tests/Review.spec.ts -g "Review_Submit_02"
    test.skip(process.env.REAL_SUBMIT !== '1', 'Bỏ qua: test này gửi đánh giá THẬT, chỉ chạy khi đặt REAL_SUBMIT=1');
    test.setTimeout(240000);
    page.setDefaultTimeout(15000);           // mọi thao tác/chờ không tự đặt timeout đều tối đa 15 giây (tránh treo vô hạn)
    const SOFT = { timeout: 3000 };          // mỗi soft-assert chỉ chờ tối đa 3 giây
    const observed: Record<string, unknown> = {};

    // ---------- Dữ liệu test: sản phẩm ĐÃ MUA trong đơn #01967SO24090400320 ----------
    const PRODUCT_KEY = 'DS06C';                                       // dấu hiệu nhận diện sản phẩm cần đánh giá
    const PRODUCT_NAME = 'Cáp sạc và truyền dữ liệu USB-A - Type-C 15W 0.2m AVA+ DS06C';
    const CABLE_URL = 'https://www.dienmayxanh.com/cap-dien-thoai/cap-type-c-20cm-ava-ds06cb-tb'; // DÁN link trang sản phẩm vào đây; để trống thì test mở từ chi tiết đơn hàng
    const ORDER_URL = 'https://www.dienmayxanh.com/ca-nhan/lich-su-mua-hang/01967SO24090400320';
    // Nội dung sẽ được đăng CÔNG KHAI nếu qua kiểm duyệt: sửa thành nhận xét thật của bạn trước khi chạy
    const COMMENT = 'Cáp sạc ngắn gọn, tiện mang theo trong túi, sạc ổn định. Sử dụng được 4 năm vẫn còn hoạt động tốt.';
    const STAR_LABEL = 'Tốt';                                          // 4 sao

    // Gom lỗi JavaScript của trang và hộp thoại gốc của trình duyệt
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`);
      d.dismiss().catch(() => {});
    });

    // Đếm request TẠO đánh giá: phải đúng 1 lần (không được gửi trùng)
    const createRequests: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/Comment\/Product\/create/i.test(req.url())) createRequests.push(req.url());
    });

    // ---------- Pre-condition: đã đăng nhập tài khoản ĐÃ MUA sản phẩm, mở trang sản phẩm đó ----------
    await test.step('Pre-condition: Mở trang sản phẩm đã mua trong đơn #01967SO24090400320', async () => {
      if (CABLE_URL) {
        await page.goto(CABLE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      } else {
        await page.goto(ORDER_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const link = page.locator(`a:has-text("${PRODUCT_KEY}")`).first();
        await expect(link, `Không tìm thấy liên kết sản phẩm "${PRODUCT_KEY}" trong chi tiết đơn; hãy điền CABLE_URL ở đầu test`).toBeVisible({ timeout: 15000 });
        const href = (await link.getAttribute('href')) || '';
        expect(href, 'Liên kết sản phẩm trong đơn phải có địa chỉ').not.toBe('');
        await page.goto(new URL(href, ORDER_URL).toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
      await dismissPopups(page);
      observed.trangSanPham = page.url();

      // KIỂM TRA CỨNG: đúng sản phẩm cần đánh giá (vì test gửi thật, không được đánh giá nhầm sản phẩm khác)
      const heading = (await page.locator('h1').first().innerText().catch(() => '')).trim();
      observed.tieuDeSanPham = heading;
      expect(heading.toUpperCase(), `Trang đang mở phải là sản phẩm ${PRODUCT_KEY}, thực tế tiêu đề: "${heading}"`).toContain(PRODUCT_KEY);
    });

    const modal = await openReviewModal(page);
    await expect(modal, 'Popup đánh giá phải mở').toBeVisible({ timeout: 10000 });
    const textarea = modal.locator('textarea#feeling, textarea').first();
    const nameInput = modal.locator('input#fullName, input[name="fullName"]');
    const phoneInput = modal.locator('input#phone, input[name="phone"]');
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');

    // ============================================================================
    // Step 1: điền đủ thông tin hợp lệ (4 sao, nhận xét, Họ tên, SĐT, đồng ý chính sách)
    // ============================================================================
    await test.step('Step 1: Điền đủ thông tin hợp lệ', async () => {
      // KIỂM TRA CỨNG: popup phải nêu đúng sản phẩm
      const popupText = (await modal.innerText().catch(() => '')) || '';
      expect(popupText.toUpperCase(), `Popup phải đánh giá đúng sản phẩm ${PRODUCT_KEY}`).toContain(PRODUCT_KEY);

      await modal.getByText(STAR_LABEL, { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });
      await textarea.fill(COMMENT);
      if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
      if (!(await phoneInput.inputValue())) await phoneInput.fill(TEST_PHONE);
      await setAgree(modal, page, true);
      await page.waitForTimeout(500);

      await expect(submit, 'Điền đủ thông tin hợp lệ thì nút [Gửi đánh giá] phải được bật').toBeEnabled({ timeout: 5000 });
      observed.thongTinGui = { sao: STAR_LABEL, nhanXet: COMMENT, hoTen: await nameInput.inputValue(), sdt: await phoneInput.inputValue() };
      await shot(page, 'Review_Submit_02_buoc1_truoc_khi_gui');
    });

    // ============================================================================
    // Step 2 / Expected 1: click [Gửi đánh giá] ĐÚNG 1 LẦN -> hiện popup "Cảm ơn bạn đã đánh giá sản phẩm"
    // ============================================================================
    await test.step('Step 2: Click [Gửi đánh giá] (gửi thật, đúng 1 lần)', async () => {
      const createResponse = page.waitForResponse(
        (r) => r.request().method() === 'POST' && /\/api\/Comment\/Product\/create/i.test(r.url()),
        { timeout: 30000 },
      );
      await submit.click({ timeout: 5000 });   // CHỈ MỘT LẦN, không retry

      const resp = await createResponse.catch(() => null);
      const status = resp ? resp.status() : 0;
      const body = resp ? ((await resp.text().catch(() => '')) || '').slice(0, 500) : '';
      observed.phanHoiGuiDanhGia = { status, body };
      console.log(`[Review_Submit_02] POST /Comment/Product/create -> ${status}; nội dung: ${body}`);
      expect.soft(status, `Gửi đánh giá phải trả về thành công (2xx), thực tế: ${status}; ${body}`).toBeGreaterThanOrEqual(200);
      expect.soft(status, `Gửi đánh giá phải trả về thành công (2xx), thực tế: ${status}; ${body}`).toBeLessThan(300);

      // Popup cảm ơn
      const thanks = page.locator('.fixed:has-text("Cảm ơn bạn đã đánh giá sản phẩm")').last();
      await expect(thanks, 'Phải hiện popup "Cảm ơn bạn đã đánh giá sản phẩm"').toBeVisible({ timeout: 15000 });
      const thanksText = (((await thanks.innerText().catch(() => '')) || '')).replace(/\u00a0/g, ' ');
      const policyHref = (await thanks.locator('a:has-text("quy định đánh giá")').first().getAttribute('href').catch(() => '')) || '';
      observed.popupCamOn = { noiDung: thanksText, lienKetQuyDinh: policyHref };
      console.log(`[Review_Submit_02] Popup cảm ơn: ${JSON.stringify(thanksText)}; liên kết quy định: ${policyHref}`);
      await shot(page, 'Review_Submit_02_buoc2_popup_cam_on');

      expect.soft(thanksText, 'Popup phải nêu hệ thống sẽ kiểm duyệt đánh giá').toMatch(/kiểm duyệt/i);
      expect.soft(thanksText.toUpperCase(), `Popup phải nêu đúng sản phẩm ${PRODUCT_KEY}`).toContain(PRODUCT_KEY);
      expect.soft(thanksText, 'Popup phải nêu thời gian đăng sau 24h').toMatch(/24\s*h/i);
      expect.soft(policyHref, 'Popup phải có liên kết [quy định đánh giá]').not.toBe('');
      await expect.soft(thanks.getByRole('button', { name: 'Đóng' }), 'Popup phải có nút [Đóng]').toBeVisible(SOFT);
    });

    // ============================================================================
    // Expected 2: click [Đóng] -> popup đóng, đánh giá CHƯA hiển thị ngay (chờ kiểm duyệt)
    // ============================================================================
    await test.step('Step 3: Click [Đóng], xem lại khu vực đánh giá', async () => {
      const thanks = page.locator('.fixed:has-text("Cảm ơn bạn đã đánh giá sản phẩm")').last();
      await thanks.getByRole('button', { name: 'Đóng' }).click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      await expect.soft(thanks, 'Click [Đóng] thì popup cảm ơn phải đóng').toBeHidden(SOFT);
      await expect.soft(modal, 'Popup viết đánh giá cũng phải đã đóng').toBeHidden(SOFT);

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissPopups(page);
      await page.waitForTimeout(3000);
      const shownNow = await page.getByText(COMMENT, { exact: false }).count();
      observed.hienThiNgaySauKhiGui = shownNow;
      console.log(`[Review_Submit_02] Sau khi tải lại, đánh giá hiển thị ngay: ${shownNow} lần`);
      expect.soft(shownNow, 'Đánh giá phải chờ kiểm duyệt (24h), chưa được hiển thị công khai ngay').toBe(0);
      note('rule-check', `[Review_Submit_02] Sau khi gửi: ${shownNow ? 'đánh giá HIỂN THỊ NGAY (không chờ kiểm duyệt như popup nói)' : 'đánh giá chưa hiển thị (đang chờ kiểm duyệt)'}. Cần kiểm tra lại thủ công sau 24h: đánh giá hiển thị với nhãn "Đã mua tại ĐMX", đúng số sao, nội dung, tên.`);
      await shot(page, 'Review_Submit_02_buoc3_sau_khi_tai_lai');
    });

    // ---------- Expected chung: đúng 1 request tạo đánh giá, không lỗi hệ thống ----------
    await test.step('Expected chung: Chỉ gửi 1 lần, không lỗi JavaScript', async () => {
      expect.soft(createRequests.length, 'Phải có đúng 1 request tạo đánh giá (không gửi trùng)').toBe(1);
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });

    // ---------- Đính kèm số liệu ghi nhận ----------
    await attachText('Review_Submit_02_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Submit_02] Số liệu ghi nhận:', JSON.stringify(observed));
  });

  test('Review_Submit_03: Kiểm tra gửi đánh giá bằng tài khoản chưa mua sản phẩm', async ({ page }) => {
    test.skip(!HAS_AUTH, 'Bỏ qua: Cần session đăng nhập auth/dmx_storageState.json');
    // TEST NÀY GỬI ĐÁNH GIÁ THẬT lên Production -> chỉ chạy khi chủ động bật biến môi trường REAL_SUBMIT=1
    // PowerShell: $env:REAL_SUBMIT=1; npx playwright test tests/Review.spec.ts -g "Review_Submit_03"
    test.skip(process.env.REAL_SUBMIT !== '1', 'Bỏ qua: test này gửi đánh giá THẬT, chỉ chạy khi đặt REAL_SUBMIT=1');
    test.setTimeout(240000);
    page.setDefaultTimeout(15000);
    const SOFT = { timeout: 3000 };
    const observed: Record<string, unknown> = {};

    // ---------- Dữ liệu test: sản phẩm CHƯA MUA ----------
    const NP_KEY = 'KGRC18D3G';
    const NP_URL = 'https://www.dienmayxanh.com/noi-com-dien/noi-com-dien-tu-kangaroo-18-lit-kgrc18d3g?code=4844158000266';
    // Nội dung sẽ được đăng CÔNG KHAI nếu qua kiểm duyệt: sửa thành nhận xét của bạn trước khi chạy
    const COMMENT = 'Mình chưa mua sản phẩm này, nhận xét dựa trên thông tin và hình ảnh trên trang: thiết kế gọn, dung tích 1.8 lít phù hợp gia đình nhỏ.';
    const STAR_LABEL = 'Tốt';   // 4 sao

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`);
      d.dismiss().catch(() => {});
    });

    // Đếm request TẠO đánh giá: phải đúng 1 lần
    const createRequests: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/Comment\/Product\/create/i.test(req.url())) createRequests.push(req.url());
    });

    // ---------- Pre-condition: tài khoản chưa mua sản phẩm này, mở trang sản phẩm ----------
    await test.step('Pre-condition: Mở trang sản phẩm chưa mua', async () => {
      await page.goto(NP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissPopups(page);
      observed.trangSanPham = page.url();

      // KIỂM TRA CỨNG: đúng sản phẩm cần đánh giá (test gửi thật, không được đánh giá nhầm sản phẩm khác)
      const heading = (await page.locator('h1').first().innerText().catch(() => '')).trim();
      observed.tieuDeSanPham = heading;
      expect(heading.toUpperCase(), `Trang đang mở phải là sản phẩm ${NP_KEY}, thực tế tiêu đề: "${heading}"`).toContain(NP_KEY);
    });

    const modal = await openReviewModal(page);
    await expect(modal, 'Popup đánh giá phải mở').toBeVisible({ timeout: 10000 });
    const textarea = modal.locator('textarea#feeling, textarea').first();
    const nameInput = modal.locator('input#fullName, input[name="fullName"]');
    const phoneInput = modal.locator('input#phone, input[name="phone"]');
    const agree = modal.locator('input#agree, input[name="agree"]');
    const submit = modal.locator('button:has-text("Gửi đánh giá")');

    // ============================================================================
    // Step 1: điền đủ thông tin hợp lệ
    // ============================================================================
    await test.step('Step 1: Điền đủ thông tin hợp lệ', async () => {
      const popupText = (await modal.innerText().catch(() => '')) || '';
      expect(popupText.toUpperCase(), `Popup phải đánh giá đúng sản phẩm ${NP_KEY}`).toContain(NP_KEY);

      await modal.getByText(STAR_LABEL, { exact: true }).click();
      await page.waitForTimeout(800);
      await expect(agree, 'Sau khi chọn sao phải hiện checkbox đồng ý chính sách').toBeVisible({ timeout: 10000 });
      await textarea.fill(COMMENT);
      if (!(await nameInput.inputValue())) await nameInput.fill(TEST_NAME);
      if (!(await phoneInput.inputValue())) await phoneInput.fill(TEST_PHONE);
      await setAgree(modal, page, true);
      await page.waitForTimeout(500);

      await expect(submit, 'Điền đủ thông tin hợp lệ thì nút [Gửi đánh giá] phải được bật').toBeEnabled({ timeout: 5000 });
      observed.thongTinGui = { sao: STAR_LABEL, nhanXet: COMMENT, hoTen: await nameInput.inputValue(), sdt: await phoneInput.inputValue() };
      await shot(page, 'Review_Submit_03_buoc1_truoc_khi_gui');
    });

    // ============================================================================
    // Step 2: click [Gửi đánh giá] ĐÚNG 1 LẦN
    // ============================================================================
    let accepted = false;
    await test.step('Step 2: Click [Gửi đánh giá] (gửi thật, đúng 1 lần)', async () => {
      const createResponse = page.waitForResponse(
        (r) => r.request().method() === 'POST' && /\/api\/Comment\/Product\/create/i.test(r.url()),
        { timeout: 30000 },
      );
      await submit.click({ timeout: 5000 });   // CHỈ MỘT LẦN, không retry

      const resp = await createResponse.catch(() => null);
      const status = resp ? resp.status() : 0;
      const body = resp ? ((await resp.text().catch(() => '')) || '').slice(0, 500) : '';
      observed.phanHoiGuiDanhGia = { status, body };
      console.log(`[Review_Submit_03] POST /Comment/Product/create -> ${status}; nội dung: ${body}`);
      accepted = status >= 200 && status < 300;
      await page.waitForTimeout(1500);
      await shot(page, 'Review_Submit_03_buoc2_sau_khi_gui');

      const thanks = page.locator('.fixed:has-text("Cảm ơn bạn đã đánh giá sản phẩm")').last();
      const thanksVisible = await thanks.isVisible({ timeout: 15000 }).catch(() => false);
      const thanksText = thanksVisible ? (((await thanks.innerText().catch(() => '')) || '')).replace(/\u00a0/g, ' ') : '';
      // Nếu web từ chối: ghi lại thông báo lỗi đang hiển thị trong popup
      const modalText = (await modal.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 500);
      observed.ketQuaHienThi = { popupCamOn: thanksVisible, noiDung: thanksText, noiDungPopupGui: thanksVisible ? '' : modalText, hopThoai: dialogs };
      console.log(`[Review_Submit_03] Web ${accepted && thanksVisible ? 'CHẤP NHẬN' : 'KHÔNG chấp nhận'} đánh giá của tài khoản chưa mua; popup cảm ơn=${thanksVisible}; nội dung=${JSON.stringify(thanksText || modalText)}`);

      // Expected: tài khoản chưa mua vẫn gửi được -> 2xx + popup cảm ơn
      expect.soft(status, `Gửi đánh giá phải trả về thành công (2xx), thực tế: ${status}; ${body}`).toBeGreaterThanOrEqual(200);
      expect.soft(status, `Gửi đánh giá phải trả về thành công (2xx), thực tế: ${status}; ${body}`).toBeLessThan(300);
      expect.soft(thanksVisible, 'Phải hiện popup "Cảm ơn bạn đã đánh giá sản phẩm"').toBe(true);

      if (thanksVisible) {
        expect.soft(thanksText, 'Popup phải nêu hệ thống sẽ kiểm duyệt đánh giá').toMatch(/kiểm duyệt/i);
        expect.soft(thanksText.toUpperCase(), `Popup phải nêu đúng sản phẩm ${NP_KEY}`).toContain(NP_KEY);
        expect.soft(thanksText, 'Popup phải nêu thời gian đăng sau 24h').toMatch(/24\s*h/i);
        await expect.soft(thanks.getByRole('button', { name: 'Đóng' }), 'Popup phải có nút [Đóng]').toBeVisible(SOFT);
      } else {
        note('defect-note', `[Review_Submit_03] Web KHÔNG hiện popup cảm ơn khi tài khoản chưa mua gửi đánh giá (status ${status}). Nội dung hiển thị: ${modalText}`);
      }
    });

    // ============================================================================
    // Step 3: [Đóng], tải lại, kiểm tra đánh giá chưa hiển thị ngay
    // ============================================================================
    await test.step('Step 3: Click [Đóng], tải lại trang', async () => {
      const thanks = page.locator('.fixed:has-text("Cảm ơn bạn đã đánh giá sản phẩm")').last();
      if (await thanks.isVisible().catch(() => false)) {
        await thanks.getByRole('button', { name: 'Đóng' }).click({ timeout: 5000 });
        await page.waitForTimeout(1000);
        await expect.soft(thanks, 'Click [Đóng] thì popup cảm ơn phải đóng').toBeHidden(SOFT);
      }

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissPopups(page);
      await page.waitForTimeout(3000);
      const shownNow = await page.getByText(COMMENT, { exact: false }).count();
      observed.hienThiNgaySauKhiGui = shownNow;
      console.log(`[Review_Submit_03] Sau khi tải lại, đánh giá hiển thị ngay: ${shownNow} lần`);
      if (accepted) expect.soft(shownNow, 'Đánh giá phải chờ kiểm duyệt (24h), chưa được hiển thị công khai ngay').toBe(0);
      note('rule-check', `[Review_Submit_03] Sau khi gửi: ${shownNow ? 'đánh giá HIỂN THỊ NGAY (không chờ kiểm duyệt)' : 'đánh giá chưa hiển thị (đang chờ kiểm duyệt)'}. Cần kiểm tra lại thủ công sau 24h: đánh giá của tài khoản CHƯA MUA phải KHÔNG có nhãn "Đã mua tại ĐMX", đúng số sao, nội dung, tên.`);
      await shot(page, 'Review_Submit_03_buoc3_sau_khi_tai_lai');
    });

    // ---------- Expected chung ----------
    await test.step('Expected chung: Chỉ gửi 1 lần, không lỗi JavaScript', async () => {
      expect.soft(createRequests.length, 'Phải có đúng 1 request tạo đánh giá (không gửi trùng)').toBe(1);
      expect.soft(pageErrors, `Trang không được phát sinh lỗi JavaScript: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });

    await attachText('Review_Submit_03_so_lieu_ghi_nhan', JSON.stringify(observed, null, 2));
    console.log('[Review_Submit_03] Số liệu ghi nhận:', JSON.stringify(observed));
  });
});
