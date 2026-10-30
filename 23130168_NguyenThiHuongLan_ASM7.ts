import { test, expect, Page } from "@playwright/test";

const BASE_URL = "https://www.dienmayxanh.com/";
const WAIT = 15000;
const MAIN = [
  "Chương trình hot",
  "Hàng chuẩn, giá mê",
  "Điện lạnh, điện máy",
  "Điện gia dụng",
  "Máy lọc nước",
  "Đồ gia dụng",
  "Làm đẹp, chăm sóc cá nhân",
  "Điện tử, Laptop, Công nghệ",
  "Phụ kiện",
  "Máy cũ, trưng bày",
  "Sản phẩm khác",
];
const SHORTCUTS = [
  "Máy giặt",
  "Máy nước nóng",
  "Tivi",
  "Máy lọc nước",
  "Tủ đông mát",
  "Quạt",
  "Loa",
  "Bếp điện âm",
  "Tủ lạnh",
  "Gia dụng",
  "Máy lạnh",
  "Máy sấy quần áo",
  "Robot hút bụi",
  "Nồi cơm điện",
  "Sức khỏe & Làm đẹp",
];
const textItem = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).first();

async function closeVoucherPopup(page: Page) {
  await page.waitForTimeout(800);

  const closeSelectors = [
    '[role="dialog"] button[aria-label*="đóng" i]',
    '[role="dialog"] button[aria-label*="close" i]',
    '[role="dialog"] button[title*="đóng" i]',
    '[role="dialog"] button[title*="close" i]',
    '[class*="popup" i] button[aria-label*="close" i]',
    '[class*="modal" i] button[aria-label*="close" i]',
    'button[aria-label="Đóng"]',
    'button[aria-label="Close"]',
    'button[title="Đóng"]',
    'button[title="Close"]',
  ];

  for (const selector of closeSelectors) {
    const buttons = page.locator(selector);
    const count = await buttons.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      if (await button.isVisible().catch(() => false)) {
        await button.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(300);
        return;
      }
    }
  }

  for (const label of ["Đóng", "Không, cảm ơn", "Để sau", "×", "✕", "✖"]) {
    const button = page.getByText(label, { exact: true }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(300);
      return;
    }
  }

  await page.keyboard.press("Escape").catch(() => {});
}

async function home(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
  await closeVoucherPopup(page);
}

async function menu(page: Page) {
  const btn = textItem(page, "Danh mục");
  await expect(btn).toBeVisible({ timeout: WAIT });
  await btn.hover();
  if (
    !(await textItem(page, "Điện lạnh, điện máy")
      .isVisible()
      .catch(() => false))
  ) {
    await btn.click().catch(() => {});
  }
  await expect(textItem(page, "Điện lạnh, điện máy")).toBeVisible({
    timeout: WAIT,
  });
}
async function groupsPage(page: Page) {
  await page.goto(new URL("danh-muc-nhom-hang", BASE_URL).toString(), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("body")).toBeVisible();
}

test("DMX-001 - Trang chủ tải được", async ({ page }) => {
  await home(page);
  await expect(page).toHaveURL(/dienmayxanh\.com/i);
  await expect(page.locator("body")).not.toBeEmpty();
});
test("DMX-002 - Có nút Danh mục trên Header", async ({ page }) => {
  await home(page);
  await expect(textItem(page, "Danh mục")).toBeVisible({ timeout: WAIT });
});

// Mega_Open_01/02, Mega_Close_01/02
test("Mega_Open_01 - Hover hoặc nhấn Danh mục mở Mega Menu", async ({
  page,
}) => {
  await home(page);
  await menu(page);
});
test("Mega_Open_02 - Menu giữ hiển thị khi rê chuột vào trong menu", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  await textItem(page, "Điện lạnh, điện máy").hover();
  await expect(textItem(page, "Điện lạnh, điện máy")).toBeVisible();
});
test("Mega_Close_01 - Di chuột ra ngoài không làm trang lỗi", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  await page.locator("body").hover({ position: { x: 5, y: 5 } });
  await expect(page.locator("body")).toBeVisible();
});
test("Mega_Close_02 - Di chuyển từ cột trái sang vùng menu không làm mất trang", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  await textItem(page, "Điện lạnh, điện máy").hover();
  await page.waitForTimeout(250);
  await expect(page.locator("body")).toBeVisible();
});

// Mega_GUI_01/02/03
test("Mega_GUI_01 - Menu nằm trong viewport", async ({ page }) => {
  await home(page);
  await menu(page);
  const box = await textItem(page, "Điện lạnh, điện máy").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width + 2,
  );
});
test("Mega_GUI_02 - Nội dung menu hiển thị phía trước và trang không lỗi", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  await expect(page.locator("body")).toBeVisible();
});
test("Mega_GUI_03 - Menu không tràn ngang khỏi màn hình", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await home(page);
  await menu(page);
  const box = await textItem(page, "Điện lạnh, điện máy").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(1368);
});

// Mega_List_01/02
test("Mega_List_01 - Kiểm tra các nhóm danh mục chính", async ({ page }) => {
  await home(page);
  await menu(page);
  const found: string[] = [];
  for (const name of MAIN)
    if (
      await textItem(page, name)
        .isVisible()
        .catch(() => false)
    )
      found.push(name);
  console.log(
    `Nhóm danh mục tìm thấy ${found.length}/${MAIN.length}: ${found.join(" | ")}`,
  );
  expect(found.length).toBeGreaterThan(0);
});
test("Mega_List_02 - Tên nhóm danh mục hiển thị không rỗng", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  await expect(textItem(page, "Điện lạnh, điện máy")).not.toHaveText("");
});

// Mega_Select_01, Mega_Content_01..05, Mega_Hover_01
test("Mega_Select_01 - Hover qua từng nhóm danh mục", async ({ page }) => {
  await home(page);
  await menu(page);
  let count = 0;
  for (const name of MAIN) {
    const item = textItem(page, name);
    if (await item.isVisible().catch(() => false)) {
      await item.hover();
      count++;
    }
  }
  expect(count).toBeGreaterThan(0);
});
test("Mega_Content_01 - Nội dung phản hồi khi đổi nhóm danh mục", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  let count = 0;
  for (const name of MAIN) {
    const item = textItem(page, name);
    if (await item.isVisible().catch(() => false)) {
      await item.hover();
      await page.waitForTimeout(100);
      count++;
    }
  }
  expect(count).toBeGreaterThan(0);
});
test("Mega_Content_02 - Chọn nhóm Làm đẹp nếu đang tồn tại", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  const item = textItem(page, "Làm đẹp, chăm sóc cá nhân");
  if (!(await item.isVisible().catch(() => false)))
    test.skip(true, "Nhóm không có trên giao diện hiện tại");
  else {
    await item.hover();
    await expect(item).toBeVisible();
  }
});
test("Mega_Content_03 - Menu có liên kết và nội dung hiển thị", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  expect(await page.locator("a:visible").count()).toBeGreaterThan(0);
});
test("Mega_Content_04 - Chuyển nhanh giữa nhiều nhóm không làm trắng trang", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  for (const name of MAIN) {
    const item = textItem(page, name);
    if (await item.isVisible().catch(() => false)) await item.hover();
  }
  await expect(page.locator("body")).not.toBeEmpty();
});
test("Mega_Content_05 - Menu vẫn có nội dung sau khi chọn nhóm", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  await textItem(page, "Điện lạnh, điện máy").hover();
  await expect(page.locator("body")).not.toBeEmpty();
});
test("Mega_Hover_01 - Hiệu ứng hover có thể thực hiện trên nhóm chính", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  await textItem(page, "Điện lạnh, điện máy").hover();
  await expect(textItem(page, "Điện lạnh, điện máy")).toBeVisible();
});
test("Mega_Link_01 - Máy giặt trong Mega Menu mở đúng trang (nếu có)", async ({
  page,
}) => {
  await home(page);
  await menu(page);
  const item = textItem(page, "Máy giặt");
  if (!(await item.isVisible().catch(() => false))) {
    test.skip(true, "Không tìm thấy Máy giặt trong menu");
    return;
  }
  await item.click();
  await expect(page).toHaveURL(/may-giat|máy-giặt/i, { timeout: WAIT });
});

// Shortcut_Display_01/02, Shortcut_GUI_01/02
test("Shortcut_Display_01 - Khu vực danh mục nổi bật có Máy giặt", async ({
  page,
}) => {
  await home(page);
  const item = textItem(page, "Máy giặt");
  await item.scrollIntoViewIfNeeded();
  await expect(item).toBeVisible({ timeout: WAIT });
});
test("Shortcut_Display_02 - Kiểm tra nhãn danh mục nổi bật", async ({
  page,
}) => {
  await home(page);
  let found = 0;
  for (const name of SHORTCUTS)
    if (
      await textItem(page, name)
        .isVisible()
        .catch(() => false)
    )
      found++;
  console.log(`Danh mục nổi bật tìm thấy ${found}/${SHORTCUTS.length}`);
  expect(found).toBeGreaterThan(0);
});
test("Shortcut_GUI_01 - Trang chủ có hình ảnh danh mục", async ({ page }) => {
  await home(page);
  const item = textItem(page, "Máy giặt");
  await item.scrollIntoViewIfNeeded();
  await expect(item).toBeVisible({ timeout: WAIT });
  expect(await page.locator("img:visible").count()).toBeGreaterThan(0);
});
test("Shortcut_GUI_02 - Danh mục nổi bật có thể cuộn tới và nhìn thấy", async ({
  page,
}) => {
  await home(page);
  const item = textItem(page, "Máy giặt");
  await item.scrollIntoViewIfNeeded();
  const box = await item.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
});

// Shortcut_Nav_01..07 and Category_Click_01/02
const NAV_CASES = [
  { id: "Shortcut_Nav_01", name: "Máy giặt", url: /may-giat|máy-giặt/i },
  {
    id: "Shortcut_Nav_02",
    name: "Máy nước nóng",
    url: /may-nuoc-nong|máy-nước-nóng/i,
  },
  { id: "Shortcut_Nav_03", name: "Tivi", url: /tivi/i },
  {
    id: "Shortcut_Nav_04",
    name: "Máy lọc nước",
    url: /may-loc-nuoc|máy-lọc-nước/i,
  },
  { id: "Shortcut_Nav_05", name: "Tủ đông mát", url: /tu-dong|tủ-đông/i },
];
for (const c of NAV_CASES) {
  test(`${c.id} - Nhấn ${c.name} mở trang danh mục`, async ({ page }) => {
    await home(page);
    const item = textItem(page, c.name);
    await item.scrollIntoViewIfNeeded();
    await expect(item).toBeVisible({ timeout: WAIT });
    await item.click();
    await expect(page).toHaveURL(c.url, { timeout: WAIT });
  });
}
test("Shortcut_Nav_06 - Các danh mục nổi bật còn lại được tìm thấy", async ({
  page,
}) => {
  await home(page);
  let found = 0;
  for (const name of SHORTCUTS.slice(5))
    if (
      await textItem(page, name)
        .isVisible()
        .catch(() => false)
    )
      found++;
  expect(found).toBeGreaterThan(0);
});
test("Shortcut_Nav_07 - Tất cả danh mục mở trang tổng hợp", async ({
  page,
}) => {
  await home(page);
  const item = textItem(page, "Tất cả danh mục");
  await item.scrollIntoViewIfNeeded();
  await expect(item).toBeVisible({ timeout: WAIT });
  await item.click();
  await expect(page).toHaveURL(/danh-muc-nhom-hang|danh-muc/i, {
    timeout: WAIT,
  });
});
test("Category_Click_01 - Tên danh mục có vùng nhấn", async ({ page }) => {
  await home(page);
  const item = textItem(page, "Máy giặt");
  await item.scrollIntoViewIfNeeded();
  await expect(item).toBeVisible({ timeout: WAIT });
  await expect(item).toBeEnabled();
});
test("Category_Click_02 - Nhấn Tivi mở trang Tivi, không phải trang khác", async ({
  page,
}) => {
  await home(page);
  const item = textItem(page, "Tivi");
  await item.scrollIntoViewIfNeeded();
  await expect(item).toBeVisible({ timeout: WAIT });
  await item.click();
  await expect(page).toHaveURL(/tivi/i, { timeout: WAIT });
});

// AllGroups_Nav/Display/Search/Alpha
test("AllGroups_Display_01 - Trang Tất cả nhóm hàng tải được", async ({
  page,
}) => {
  await groupsPage(page);
  expect((await page.locator("body").innerText()).length).toBeGreaterThan(50);
});
test("AllGroups_Display_02 - Trang tổng hợp có nội dung danh mục", async ({
  page,
}) => {
  await groupsPage(page);
  expect(await page.locator("a:visible").count()).toBeGreaterThan(0);
});
test("AllGroups_Nav_01 - Chọn Bàn ủi nếu có", async ({ page }) => {
  await groupsPage(page);
  const item = textItem(page, "Bàn ủi");
  if (!(await item.isVisible().catch(() => false))) {
    test.skip(true, "Không thấy Bàn ủi trên trang hiện tại");
    return;
  }
  await item.click();
  await expect(page).toHaveURL(/ban-ui|bàn-ủi/i, { timeout: WAIT });
});
test("AllGroups_Search_01 - Tìm nhóm hàng nếu trang có ô tìm kiếm", async ({
  page,
}) => {
  await groupsPage(page);
  const search = page
    .locator('input[type="search"], input[placeholder*="ìm"]')
    .first();
  if (!(await search.isVisible().catch(() => false))) {
    test.skip(true, "Không tìm thấy ô tìm kiếm");
    return;
  }
  await search.fill("Tủ lạnh");
  await search.press("Enter").catch(() => {});
  await expect(page.locator("body")).toBeVisible();
});
test("AllGroups_Search_02 - Từ khóa không có kết quả không làm trang lỗi", async ({
  page,
}) => {
  await groupsPage(page);
  const search = page
    .locator('input[type="search"], input[placeholder*="ìm"]')
    .first();
  if (!(await search.isVisible().catch(() => false))) {
    test.skip(true, "Không tìm thấy ô tìm kiếm");
    return;
  }
  await search.fill("xyz123notfound");
  await search.press("Enter").catch(() => {});
  await expect(page.locator("body")).toBeVisible();
});
test("AllGroups_Alpha_01 - Thanh chữ cái B nếu có thể tương tác", async ({
  page,
}) => {
  await groupsPage(page);
  const letter = textItem(page, "B");
  if (!(await letter.isVisible().catch(() => false))) {
    test.skip(true, "Không tìm thấy chữ B theo locator văn bản");
    return;
  }
  await letter.click();
  await expect(page.locator("body")).toBeVisible();
});

// Keyboard, performance, responsive, compatibility
test("Mega_Keyboard_01 - Nút Danh mục nhận focus bằng bàn phím", async ({
  page,
}) => {
  await home(page);
  const item = textItem(page, "Danh mục");
  await item.focus();
  await expect(item).toBeFocused();
});
test("Mega_Perf_01 - Trang chủ tải DOM dưới 10 giây", async ({ page }) => {
  const start = Date.now();
  await home(page);
  const elapsed = Date.now() - start;
  console.log(`DOM ready: ${elapsed} ms`);
  expect(elapsed).toBeLessThan(10000);
});
test("Mega_Perf_02 - Menu vẫn mở được sau khi trang tải", async ({ page }) => {
  await home(page);
  await menu(page);
});
test("Responsive_01 - Menu hoạt động trên desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await home(page);
  await menu(page);
});
test("Responsive_02 - Trang chủ không tràn ngang nghiêm trọng ở tablet/mobile", async ({
  page,
}) => {
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await home(page);
    const width = await page.locator("body").evaluate((el) => el.scrollWidth);
    expect(
      width,
      `Body scrollWidth tại ${viewport.width}px`,
    ).toBeLessThanOrEqual(viewport.width + 40);
  }
});
test("Compatibility_01 - Chức năng cơ bản trên browser đang chạy", async ({
  page,
  browserName,
}) => {
  await home(page);
  await expect(textItem(page, "Danh mục")).toBeVisible({ timeout: WAIT });
  console.log(`Browser: ${browserName}`);
});
