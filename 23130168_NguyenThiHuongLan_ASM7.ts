// npx playwright test tests/test-1.spec.ts --headed --workers=1
// npx playwright test tests/test-1.spec.ts -g "Mega_Open_01" --headed --workers=1

import { test, expect, Page } from "@playwright/test";

async function openHomeAndCloseVoucher(page: Page) {
  await page.goto("https://www.dienmayxanh.com/");
  const closeVoucher = page.locator(".h-32px.w-32px.sm\\:h-36px");
  if (await closeVoucher.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closeVoucher.click();
    console.log("Đã đóng popup voucher.");
  } else {
    console.log("Không có popup voucher, tiếp tục test.");
  }
}

async function hoverDanhMuc(page: Page) {
  const danhMuc = page
    .getByText("Danh mục", {
      exact: true,
    })
    .first();
  await danhMuc.hover({ timeout: 15000 });
}

async function waitMenu(page: Page) {
  await page.waitForTimeout(15000);
}

async function hoverCategory(page: Page, categoryName: string) {
  const category = page.getByText(categoryName).first();

  await expect(category).toBeVisible({ timeout: 15000 });
  await category.hover({ timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function moveMouseOutside(page: Page) {
  await page.mouse.move(10, 700);
  await page.waitForTimeout(2000);
}

async function checkShortcutNavigation(
  page: Page,
  name: string,
  expectedPath: string,
  testCase: string,
) {
  await openHomeAndCloseVoucher(page);

  // Tìm Shortcut
  const shortcut = page.getByText(name, { exact: true }).first();

  await expect(
    shortcut,
    `Không tìm thấy Shortcut ${name} trên trang chủ`,
  ).toBeVisible({ timeout: 15000 });

  // Lấy liên kết
  const shortcutLink = shortcut.locator("xpath=ancestor-or-self::a[1]");

  await expect(
    shortcutLink,
    `Shortcut ${name} không có liên kết`,
  ).toBeVisible();

  const href = await shortcutLink.getAttribute("href");

  expect(href, `Shortcut ${name} không có URL`).toBeTruthy();

  const targetUrl = new URL(href!, page.url());
  const actualPath = targetUrl.pathname.replace(/\/+$/, "");

  // Kiểm tra URL mong đợi
  expect(actualPath, `URL của ${name} không đúng`).toBe(expectedPath);

  // Click và chờ chuyển trang
  await Promise.all([
    page.waitForURL(
      (url) => url.pathname.replace(/\/+$/, "") === expectedPath,
      { timeout: 15000 },
    ),
    shortcutLink.click(),
  ]);

  await expect(page).toHaveURL(targetUrl.href);
  await page.waitForLoadState("domcontentloaded");

  console.log(`${testCase}: ${name} -> ${page.url()}`);
}

test("Mega_Open_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);
  await hoverDanhMuc(page);
  await waitMenu(page);
});

test("Mega_Open_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);
  await hoverDanhMuc(page);
  const categories = [
    "Chương trình hot",
    "Hàng chuẩn, giá mê",
    "Điện lạnh, điện máy",
    "Điện gia dụng",
    "Máy lọc nước",
    "Đồ gia dụng",
  ];

  for (const name of categories) {
    console.log("Đang hover:", name);
    await hoverCategory(page, name);
    await page.waitForTimeout(3000);
  }
  await page.waitForTimeout(5000);
});

test("Mega_Close_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);
  await hoverDanhMuc(page);
  await moveMouseOutside(page);
  await waitMenu(page);
});

test("Mega_Close_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);
  await hoverDanhMuc(page);
  const chuongTrinhHot = page.getByText("Chương trình hot", { exact: true });
  await expect(chuongTrinhHot).toBeVisible({ timeout: 15000 });
  await chuongTrinhHot.hover();
  await page.waitForTimeout(1000);
  const contentRight = page
    .locator("div")
    .filter({ hasText: /^CHƯƠNG TRÌNH HOT$/ })
    .first();
  await expect(contentRight).toBeVisible({ timeout: 15000 });
  await contentRight.hover();
  await page.waitForTimeout(2000);
  await expect(chuongTrinhHot).toBeVisible();
  await expect(contentRight).toBeVisible();
});

test("Mega_GUI_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);
  await hoverDanhMuc(page);
  await page.waitForTimeout(2000);
  const danhMuc = page
    .getByText("Danh mục", {
      exact: true,
    })
    .first();
  await expect(danhMuc).toBeVisible();
  const chuongTrinhHot = page
    .getByText("Chương trình hot", {
      exact: true,
    })
    .first();
  await expect(chuongTrinhHot).toBeVisible({
    timeout: 15000,
  });

  const megaMenu = page
    .locator("div")
    .filter({
      has: chuongTrinhHot,
    })
    .filter({
      has: page.getByText("Hàng chuẩn, giá mê", { exact: true }),
    })
    .filter({
      has: page.getByText("Điện lạnh, điện máy", { exact: true }),
    })
    .last();

  await expect(megaMenu).toBeVisible({
    timeout: 15000,
  });
  const danhMucBox = await danhMuc.boundingBox();
  const menuBox = await megaMenu.boundingBox();

  const headerBox = await danhMuc.evaluate((el) => {
    const rect = el.getBoundingClientRect();

    return {
      x: rect.x,
      y: 0,
      width: window.innerWidth,
      height: rect.bottom,
    };
  });

  expect(headerBox).not.toBeNull();
  expect(danhMucBox).not.toBeNull();
  expect(menuBox).not.toBeNull();

  if (!headerBox || !danhMucBox || !menuBox) {
    throw new Error("Không lấy được kích thước hoặc vị trí Mega Menu.");
  }

  console.log("========== MEGA MENU LAYOUT ==========");
  console.log("Header:", headerBox);
  console.log("Danh mục:", danhMucBox);
  console.log("Mega Menu:", menuBox);

  expect(menuBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 5);

  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(menuBox.x).toBeGreaterThanOrEqual(0);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewportWidth);

  expect(menuBox.width).toBeGreaterThan(0);
  expect(menuBox.height).toBeGreaterThan(0);

  const categories = [
    "Chương trình hot",
    "Hàng chuẩn, giá mê",
    "Điện lạnh, điện máy",
    "Điện gia dụng",
    "Máy lọc nước",
    "Đồ gia dụng",
  ];

  for (const name of categories) {
    const category = page
      .getByText(name, {
        exact: true,
      })
      .first();

    await expect(category).toBeVisible();
  }

  console.log("Mega Menu có kích thước hợp lệ và các danh mục hiển thị.");
});

test("Mega_GUI_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  await hoverDanhMuc(page);
  await page.waitForTimeout(2000);

  const chuongTrinhHot = page
    .getByText("Chương trình hot", { exact: true })
    .first();

  await expect(chuongTrinhHot).toBeVisible({
    timeout: 15000,
  });

  const overlay = page.locator(
    '[class*="overlay"], [class*="backdrop"], [class*="modal-backdrop"]',
  );

  const overlayCount = await overlay.count();
  let visibleOverlayCount = 0;

  for (let i = 0; i < overlayCount; i++) {
    const item = overlay.nth(i);

    if (await item.isVisible().catch(() => false)) {
      visibleOverlayCount++;
    }
  }

  console.log("Tổng số lớp phủ tìm thấy:", overlayCount);
  console.log("Số lớp phủ đang hiển thị:", visibleOverlayCount);

  const menuBox = await chuongTrinhHot.boundingBox();

  expect(menuBox).not.toBeNull();

  if (!menuBox) {
    throw new Error("Không xác định được vị trí Mega Menu.");
  }

  const menuIsOnTop = await chuongTrinhHot.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const topElement = document.elementFromPoint(x, y);

    return topElement === element || element.contains(topElement);
  });

  console.log("Mega Menu có nằm phía trước không:", menuIsOnTop);

  expect(menuIsOnTop, "Mega Menu bị phần tử khác che khuất.").toBe(true);

  await expect(chuongTrinhHot).toBeVisible();

  console.log("Mega Menu hiển thị phía trước, không bị che khuất.");
});

test("Mega_List_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  await hoverDanhMuc(page);

  await page.waitForTimeout(2000);

  const expectedCategories = [
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

  expect(expectedCategories.length).toBe(11);

  const uniqueCategories = [...new Set(expectedCategories)];

  expect(uniqueCategories.length).toBe(11);

  for (const name of expectedCategories) {
    const category = page
      .getByText(name, {
        exact: true,
      })
      .first();

    console.log("Đang kiểm tra danh mục:", name);

    await expect(category).toBeVisible({
      timeout: 15000,
    });
  }

  console.log("Đã kiểm tra đầy đủ 11 nhóm danh mục chính.");
});

test("Mega_List_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  await hoverDanhMuc(page);

  await page.waitForTimeout(2000);

  const expectedCategories = [
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

  expect(expectedCategories.length).toBe(11);

  expect(new Set(expectedCategories).size).toBe(11);

  for (const name of expectedCategories) {
    const category = page
      .getByText(name, {
        exact: true,
      })
      .first();

    console.log("Đang kiểm tra tên danh mục:", name);

    await expect(category).toBeVisible({
      timeout: 15000,
    });

    const actualText = await category.textContent();

    expect(actualText?.trim()).toBe(name);

    const textInfo = await category.evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        text: element.textContent?.trim(),
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
      };
    });

    console.log(`Thông tin hiển thị "${name}":`, textInfo);

    expect(textInfo.scrollWidth).toBeLessThanOrEqual(textInfo.clientWidth);

    expect(textInfo.scrollHeight).toBeLessThanOrEqual(textInfo.clientHeight);
  }

  console.log("Kiểm tra tên và cách hiển thị danh mục hoàn tất.");
});

test("Mega_Select_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);
  await hoverDanhMuc(page);
  await page.waitForTimeout(1000);

  const category1 = page.getByText("Chương trình hot", { exact: true }).first();
  const category2 = page
    .getByText("Hàng chuẩn, giá mê", { exact: true })
    .first();

  await expect(category1).toBeVisible();
  await expect(category2).toBeVisible();

  async function getCategoryStyle(category: typeof category1) {
    return await category.evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        fontWeight: style.fontWeight,
      };
    });
  }

  await category2.hover();
  await page.waitForTimeout(500);

  const normalStyle = await getCategoryStyle(category1);
  const category2Hover = await getCategoryStyle(category2);

  console.log("CSS bình thường:", normalStyle);
  console.log("Nhóm 2 khi hover:", category2Hover);

  expect(category2Hover).not.toEqual(normalStyle);

  await category1.hover();
  await page.waitForTimeout(500);

  const category1Hover = await getCategoryStyle(category1);
  const category2AfterMove = await getCategoryStyle(category2);

  console.log("Nhóm 1 khi hover:", category1Hover);
  console.log("Nhóm 2 sau khi chuyển chuột:", category2AfterMove);

  expect(category1Hover).not.toEqual(normalStyle);

  expect(category2AfterMove).toEqual(normalStyle);

  console.log("Kiểm tra highlight danh mục hoàn tất.");
});

test("Mega_Content_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);
  await hoverDanhMuc(page);
  await page.waitForTimeout(1000);

  const category1 = page.getByText("Chương trình hot", { exact: true }).first();
  const category2 = page.getByText("Sản phẩm khác", { exact: true }).first();

  await expect(category1).toBeVisible({ timeout: 15000 });
  await expect(category2).toBeVisible({ timeout: 15000 });

  await category1.hover();
  await page.waitForTimeout(1000);

  const content1 = await page.locator("body").innerText();

  console.log("Nội dung khi chọn Chương trình hot:");
  console.log(content1);

  await category2.hover();
  await page.waitForTimeout(1000);

  const content2 = await page.locator("body").innerText();

  console.log("Nội dung khi chọn Sản phẩm khác:");
  console.log(content2);

  expect(content2).not.toBe(content1);

  expect(content2).toContain("SẢN PHẨM KHÁC");

  console.log("Nội dung bên phải đã thay đổi theo nhóm danh mục được chọn.");
});

test("Mega_Content_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);
  await hoverDanhMuc(page);
  await page.waitForTimeout(1000);

  const testCases = [
    {
      category: "Điện gia dụng",
      expectedTitle: "BẾP NÚC",
    },
    {
      category: "Sản phẩm khác",
      expectedTitle: "SẢN PHẨM KHÁC",
    },
  ];

  for (const item of testCases) {
    const category = page.getByText(item.category, { exact: true }).first();

    await expect(category).toBeVisible();
    await category.hover();
    await page.waitForTimeout(1000);

    const heading = page.getByText(item.expectedTitle, { exact: true }).first();

    await expect(heading).toBeVisible({ timeout: 15000 });

    console.log(
      `Nhóm: ${item.category} | Tiêu đề: ${await heading.innerText()}`,
    );
  }
});

test("Mega_Content_03", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  await hoverDanhMuc(page);
  await waitMenu(page);

  await hoverCategory(page, "Điện gia dụng");

  await page.waitForTimeout(1500);

  const menuTitle = page
    .getByText("BẾP NÚC", {
      exact: true,
    })
    .first();

  await expect(menuTitle).toBeVisible({
    timeout: 10000,
  });

  console.log("Tiêu đề danh mục hiển thị:", await menuTitle.innerText());

  const categoryContent = page
    .getByText("Điện gia dụng", {
      exact: true,
    })
    .first();

  await expect(categoryContent).toBeVisible();

  console.log("Danh mục Điện gia dụng hiển thị thành công");

  const links = page.locator("a:visible");
  const linkCount = await links.count();

  console.log("Tổng số liên kết đang hiển thị:", linkCount);

  expect(linkCount).toBeGreaterThan(0);

  const images = page.locator("img:visible");
  const imageCount = await images.count();

  console.log("Tổng số hình ảnh đang hiển thị:", imageCount);

  expect(imageCount).toBeGreaterThan(0);

  let loadedImages = 0;
  let failedImages = 0;

  for (let i = 0; i < imageCount; i++) {
    const img = images.nth(i);

    await img.evaluate(async (element: HTMLImageElement) => {
      if (element.complete) {
        return;
      }

      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5000);

        element.addEventListener(
          "load",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );

        element.addEventListener(
          "error",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
    });

    const imageInfo = await img.evaluate((element: HTMLImageElement) => ({
      src: element.currentSrc || element.src,
      complete: element.complete,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
    }));

    if (
      imageInfo.complete &&
      imageInfo.naturalWidth > 0 &&
      imageInfo.naturalHeight > 0
    ) {
      loadedImages++;

      console.log(`Ảnh ${i + 1}: Tải thành công`);
    } else {
      failedImages++;

      console.log(`Ảnh ${i + 1}: Tải thất bại`, imageInfo);
    }
  }

  console.log("--------------------------------");
  console.log("Tổng số liên kết:", linkCount);
  console.log("Tổng số hình ảnh:", imageCount);
  console.log("Ảnh tải thành công:", loadedImages);
  console.log("Ảnh tải thất bại:", failedImages);
  console.log("--------------------------------");

  expect(loadedImages).toBeGreaterThan(0);
});

test("Mega_Content_04", async ({ page }) => {
  await openHomeAndCloseVoucher(page);
  await hoverDanhMuc(page);
  await page.waitForTimeout(1000);

  const categoryNames = [
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

  const categories = categoryNames.map((name) =>
    page.getByText(name, { exact: true }).first(),
  );

  for (let i = 0; i < categories.length; i++) {
    await expect(categories[i]).toBeVisible({ timeout: 15000 });

    await categories[i].hover();
    await page.waitForTimeout(300);

    console.log(`Đang hover nhóm: ${categoryNames[i]}`);
  }

  const lastCategory = categories[categories.length - 1];

  await lastCategory.hover();
  await page.waitForTimeout(1000);

  const bodyText = await page.locator("body").innerText();

  expect(bodyText.trim().length).toBeGreaterThan(0);

  await expect(lastCategory).toBeVisible();

  const images = page.locator("img:visible");
  const imageCount = await images.count();

  console.log("Số hình ảnh đang hiển thị:", imageCount);

  expect(imageCount).toBeGreaterThan(0);

  console.log("Đã chuyển liên tục qua các nhóm danh mục.");
  console.log("Khung nội dung vẫn hiển thị sau khi dừng chuột ở nhóm cuối.");
});

test("Mega_Content_05", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  await hoverDanhMuc(page);
  await waitMenu(page);

  const categories = [
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

  let checkedCount = 0;

  for (const categoryName of categories) {
    const category = page
      .getByText(categoryName, {
        exact: true,
      })
      .first();

    if (!(await category.isVisible().catch(() => false))) {
      console.log(`Không tìm thấy danh mục: ${categoryName}`);
      continue;
    }

    await category.hover();
    await page.waitForTimeout(1000);

    await expect(category).toBeVisible();

    const pageContent = await page.locator("body").innerText();

    expect(
      pageContent.trim().length,
      `Nội dung bị trống khi chọn ${categoryName}`,
    ).toBeGreaterThan(0);

    expect(
      pageContent.toLowerCase(),
      `Phát hiện dữ liệu null khi chọn ${categoryName}`,
    ).not.toContain("null");

    expect(
      pageContent.toLowerCase(),
      `Phát hiện dữ liệu undefined khi chọn ${categoryName}`,
    ).not.toContain("undefined");

    expect(
      pageContent.toLowerCase(),
      `Phát hiện thông báo lỗi khi chọn ${categoryName}`,
    ).not.toContain("error");

    checkedCount++;

    console.log(`Đã kiểm tra nội dung danh mục: ${categoryName}`);
  }

  console.log("--------------------------------");
  console.log("Số danh mục đã kiểm tra:", checkedCount);
  console.log("--------------------------------");

  expect(checkedCount).toBeGreaterThan(0);
});

test("Mega_Link_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  await hoverDanhMuc(page);
  await waitMenu(page);

  await hoverCategory(page, "Điện lạnh, điện máy");

  await page.waitForTimeout(1000);

  const mayGiat = page
    .getByText("Máy giặt", {
      exact: true,
    })
    .first();

  await expect(mayGiat).toBeVisible({
    timeout: 10000,
  });

  await mayGiat.click();

  await expect(page).toHaveURL(/may-giat|máy-giặt/i, { timeout: 15000 });

  console.log("URL sau khi nhấn Máy giặt:", page.url());

  await expect(page.locator("body")).not.toBeEmpty();

  console.log("Điều hướng đến trang Máy giặt thành công");
});

test("Mega_GUI_03", async ({ page }) => {
  await page.setViewportSize({
    width: 1366,
    height: 768,
  });

  await openHomeAndCloseVoucher(page);

  const zoomLevels = ["80%", "100%", "125%"];

  for (const zoom of zoomLevels) {
    console.log(`Đang kiểm tra Mega Menu ở mức Zoom ${zoom}`);

    await page.evaluate((value) => {
      document.documentElement.style.zoom = value;
    }, zoom);

    await page.waitForTimeout(1000);

    await hoverDanhMuc(page);
    await waitMenu(page);

    const categories = [
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

    const viewport = page.viewportSize();

    expect(viewport).not.toBeNull();

    let visibleCount = 0;

    for (const name of categories) {
      const item = page
        .getByText(name, {
          exact: true,
        })
        .first();

      if (!(await item.isVisible().catch(() => false))) {
        console.log(`Không hiển thị: ${name}`);
        continue;
      }

      const box = await item.boundingBox();

      expect(
        box,
        `Không lấy được vị trí của ${name} ở Zoom ${zoom}`,
      ).not.toBeNull();

      expect(
        box!.x,
        `${name} bị tràn cạnh trái ở Zoom ${zoom}`,
      ).toBeGreaterThanOrEqual(0);

      expect(
        box!.y,
        `${name} bị cắt phía trên ở Zoom ${zoom}`,
      ).toBeGreaterThanOrEqual(0);

      expect(
        box!.x + box!.width,
        `${name} bị tràn cạnh phải ở Zoom ${zoom}`,
      ).toBeLessThanOrEqual(viewport!.width + 2);

      expect(
        box!.y + box!.height,
        `${name} bị cắt phía dưới ở Zoom ${zoom}`,
      ).toBeLessThanOrEqual(viewport!.height + 2);

      visibleCount++;

      console.log(`Đã kiểm tra: ${name}`);
    }

    expect(
      visibleCount,
      `Không có danh mục nào hiển thị ở Zoom ${zoom}`,
    ).toBeGreaterThan(0);

    console.log(
      `Zoom ${zoom}: kiểm tra thành công ${visibleCount} nhóm danh mục`,
    );

    await page.mouse.move(5, 5);
    await page.waitForTimeout(500);
  }

  await page.evaluate(() => {
    document.documentElement.style.zoom = "100%";
  });

  console.log("Hoàn thành kiểm tra Mega Menu ở 3 mức Zoom");
});

test("Shortcut_Display_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  const shortcuts = [
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

  const visibleItems = [];

  for (const name of shortcuts) {
    const item = page.getByText(name, { exact: true }).first();

    if (await item.isVisible().catch(() => false)) {
      const box = await item.boundingBox();

      if (box) {
        visibleItems.push({
          name,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        });

        console.log(`Đã hiển thị: ${name}`);
      }
    } else {
      console.log(`Không hiển thị: ${name}`);
    }
  }

  expect(
    visibleItems.length,
    "Không tìm thấy danh mục sản phẩm nổi bật",
  ).toBeGreaterThan(0);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const minX = Math.min(...visibleItems.map((item) => item.x));
  const maxX = Math.max(...visibleItems.map((item) => item.x + item.width));

  const gridCenter = (minX + maxX) / 2;
  const screenCenter = viewport!.width / 2;

  console.log("Số danh mục hiển thị:", visibleItems.length);
  console.log("Tâm khu vực danh mục:", gridCenter);
  console.log("Tâm màn hình:", screenCenter);

  expect(
    Math.abs(gridCenter - screenCenter),
    "Khu vực danh mục không nằm gần trung tâm màn hình",
  ).toBeLessThanOrEqual(100);
});

test("Shortcut_Display_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  const shortcuts = [
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

  let passedCount = 0;

  for (const name of shortcuts) {
    console.log(`Đang kiểm tra danh mục: ${name}`);

    const item = page.getByText(name, { exact: true }).first();

    await expect(item, `Tên danh mục "${name}" không hiển thị`).toBeVisible({
      timeout: 10000,
    });

    const imageInfo = await item.evaluate((element) => {
      let parent = element.parentElement;

      for (let i = 0; i < 6 && parent; i++) {
        const img = parent.querySelector("img");

        if (img) {
          const rect = img.getBoundingClientRect();
          const style = window.getComputedStyle(img);

          return {
            found: true,
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden",
            loaded: img.complete && img.naturalWidth > 0,
            src: img.currentSrc || img.src,
            width: rect.width,
            height: rect.height,
          };
        }

        parent = parent.parentElement;
      }

      return {
        found: false,
        visible: false,
        loaded: false,
        src: "",
        width: 0,
        height: 0,
      };
    });

    console.log(`Thông tin "${name}":`, imageInfo);

    expect(imageInfo.found, `Không tìm thấy icon của danh mục "${name}"`).toBe(
      true,
    );

    expect(
      imageInfo.visible,
      `Icon của danh mục "${name}" không hiển thị`,
    ).toBe(true);

    expect(
      imageInfo.loaded,
      `Icon của danh mục "${name}" tải không thành công`,
    ).toBe(true);

    expect(imageInfo.width).toBeGreaterThan(0);
    expect(imageInfo.height).toBeGreaterThan(0);

    passedCount++;

    console.log(`Danh mục "${name}": Đạt yêu cầu`);
  }

  console.log("--------------------------------");
  console.log("Tổng số danh mục:", shortcuts.length);
  console.log("Số danh mục đạt:", passedCount);
  console.log("Số danh mục không đạt:", shortcuts.length - passedCount);
  console.log("--------------------------------");

  expect(passedCount).toBe(shortcuts.length);
});

test("Shortcut_GUI_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  const shortcuts = [
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

  let checkedCount = 0;

  for (const name of shortcuts) {
    console.log(`Đang đối chiếu icon với: ${name}`);

    const label = page.getByText(name, { exact: true }).first();

    await expect(label).toBeVisible({
      timeout: 10000,
    });

    const iconInfo = await label.evaluate((element) => {
      let parent = element.parentElement;

      for (let i = 0; i < 6 && parent; i++) {
        const img = parent.querySelector("img");

        if (img) {
          return {
            found: true,
            src: img.currentSrc || img.src,
            alt: img.alt,
            loaded: img.complete && img.naturalWidth > 0,
          };
        }

        parent = parent.parentElement;
      }

      return {
        found: false,
        src: "",
        alt: "",
        loaded: false,
      };
    });

    console.log(`Nhãn: ${name}`);
    console.log("Thông tin icon:", iconInfo);

    expect(iconInfo.found, `Không tìm thấy icon của "${name}"`).toBe(true);

    expect(iconInfo.loaded, `Icon của "${name}" chưa tải thành công`).toBe(
      true,
    );

    if (iconInfo.alt.trim() !== "") {
      console.log(`Alt của icon: ${iconInfo.alt}`);
    }

    checkedCount++;
  }

  console.log("--------------------------------");
  console.log("Tổng số danh mục đã đối chiếu:", checkedCount);
  console.log("--------------------------------");

  expect(checkedCount).toBe(shortcuts.length);
});

test("Shortcut_GUI_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  const shortcuts = [
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

  const positions: {
    name: string;
    x: number;
    y: number;
  }[] = [];

  for (const name of shortcuts) {
    const item = page.getByText(name, { exact: true }).first();

    await expect(item).toBeVisible({ timeout: 15000 });

    const box = await item.boundingBox();

    expect(box, `Không lấy được vị trí danh mục: ${name}`).not.toBeNull();

    positions.push({
      name,
      x: box!.x,
      y: box!.y,
    });
  }

  for (let i = 0; i < positions.length - 1; i++) {
    const current = positions[i];
    const next = positions[i + 1];

    const sameRow = Math.abs(current.y - next.y) < 30;

    if (sameRow) {
      expect(
        current.x,
        `${current.name} phải nằm bên trái ${next.name}`,
      ).toBeLessThan(next.x);
    } else {
      expect(
        current.y,
        `${next.name} phải nằm ở hàng dưới ${current.name}`,
      ).toBeLessThan(next.y);
    }
  }

  const allCategories = page
    .getByText("Tất cả danh mục", { exact: true })
    .first();

  await expect(allCategories).toBeVisible({ timeout: 15000 });

  const allBox = await allCategories.boundingBox();
  expect(allBox).not.toBeNull();

  const lastItem = positions[positions.length - 1];

  console.log("Vị trí các danh mục:", positions);
  console.log("Vị trí Tất cả danh mục:", allBox);

  expect(
    allBox!.y > lastItem.y ||
      (Math.abs(allBox!.y - lastItem.y) < 30 && allBox!.x > lastItem.x),
    "Nút Tất cả danh mục chưa nằm ở vị trí cuối theo thiết kế",
  ).toBeTruthy();
});

test("Shortcut_Badge_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  const shortcuts = [
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

  const badgePattern = /^(HOT|-\s?\d+%|\d{1,3}(?:\.\d{3})*k)$/i;

  let totalBadges = 0;

  for (const name of shortcuts) {
    const label = page.getByText(name, { exact: true }).first();

    await expect(label).toBeVisible({ timeout: 15000 });

    const labelBox = await label.boundingBox();
    expect(
      labelBox,
      `Không lấy được vị trí tên danh mục ${name}`,
    ).not.toBeNull();

    const badges = await label.evaluate((element) => {
      const result: {
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }[] = [];

      const pattern = /^(HOT|-\s?\d+%|\d{1,3}(?:\.\d{3})*k)$/i;

      let parent = element.parentElement;

      for (let level = 0; level < 6 && parent; level++) {
        const children = parent.querySelectorAll("*");

        for (const child of Array.from(children)) {
          const text = child.textContent?.trim() ?? "";

          if (!pattern.test(text)) continue;

          const rect = child.getBoundingClientRect();
          const style = window.getComputedStyle(child);

          if (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          ) {
            result.push({
              text,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            });
          }
        }

        if (result.length > 0) break;

        parent = parent.parentElement;
      }

      return result;
    });

    for (const badge of badges) {
      totalBadges++;

      const badgeBox = {
        x: badge.x,
        y: badge.y,
        width: badge.width,
        height: badge.height,
      };

      const noOverlap =
        badgeBox.x + badgeBox.width <= labelBox!.x ||
        labelBox!.x + labelBox!.width <= badgeBox.x ||
        badgeBox.y + badgeBox.height <= labelBox!.y ||
        labelBox!.y + labelBox!.height <= badgeBox.y;

      expect(
        noOverlap,
        `Nhãn "${badge.text}" bị chồng lên tên danh mục "${name}"`,
      ).toBeTruthy();

      console.log(
        `Danh mục: ${name} | Nhãn: ${badge.text} | Vị trí: (${badge.x}, ${badge.y})`,
      );
    }
  }

  expect(
    totalBadges,
    "Không tìm thấy nhãn HOT, giảm giá hoặc nhãn giá trong các ô Shortcut",
  ).toBeGreaterThan(0);

  console.log(`Tổng số nhãn ưu đãi tìm thấy: ${totalBadges}`);
});

test("Shortcut_Image_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  const shortcuts = [
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

  const originalImages: { name: string; src: string }[] = [];

  for (const name of shortcuts) {
    const label = page.getByText(name, { exact: true }).first();

    await expect(
      label,
      `Không tìm thấy danh mục "${name}" trước khi giả lập lỗi ảnh`,
    ).toBeVisible({ timeout: 15000 });

    const imageInfo = await label.evaluate((element) => {
      let parent = element.parentElement;

      for (let i = 0; i < 6 && parent; i++) {
        const image = parent.querySelector("img");

        if (image) {
          return {
            src: image.currentSrc || image.src,
          };
        }

        parent = parent.parentElement;
      }

      return null;
    });

    expect(
      imageInfo?.src,
      `Không tìm thấy đường dẫn ảnh gốc của "${name}"`,
    ).toBeTruthy();

    originalImages.push({
      name,
      src: imageInfo!.src,
    });
  }

  for (const image of originalImages) {
    await page.route(image.src, async (route) => {
      await route.abort();
    });
  }

  await page.reload({ waitUntil: "domcontentloaded" });

  const closeVoucher = page.locator(".h-32px.w-32px.sm\\:h-36px");

  if (await closeVoucher.isVisible().catch(() => false)) {
    await closeVoucher.click();
  }

  let checkedCount = 0;

  for (const item of originalImages) {
    const label = page.getByText(item.name, { exact: true }).first();

    await expect(
      label,
      `Tên danh mục "${item.name}" không còn hiển thị`,
    ).toBeVisible({ timeout: 15000 });

    await label.scrollIntoViewIfNeeded();

    const imageLocator = label.locator("xpath=..").locator("img").first();

    const imageData = await label.evaluate((element) => {
      let parent = element.parentElement;

      for (let i = 0; i < 6 && parent; i++) {
        const image = parent.querySelector("img");

        if (image) {
          const rect = image.getBoundingClientRect();
          const style = window.getComputedStyle(image);

          return {
            exists: true,
            src: image.currentSrc || image.src,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            width: rect.width,
            height: rect.height,
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden",
          };
        }

        parent = parent.parentElement;
      }

      return null;
    });

    expect(
      imageData,
      `Không tìm thấy ảnh Placeholder của "${item.name}"`,
    ).not.toBeNull();

    await expect
      .poll(
        async () => {
          return await label.evaluate((element) => {
            let parent = element.parentElement;

            for (let i = 0; i < 6 && parent; i++) {
              const image = parent.querySelector("img");

              if (image) {
                return (
                  image.complete &&
                  image.naturalWidth > 0 &&
                  image.naturalHeight > 0
                );
              }

              parent = parent.parentElement;
            }

            return false;
          });
        },
        {
          message: `Ảnh Placeholder của "${item.name}" không tải thành công`,
          timeout: 10000,
        },
      )
      .toBeTruthy();

    const finalImageData = await label.evaluate((element) => {
      let parent = element.parentElement;

      for (let i = 0; i < 6 && parent; i++) {
        const image = parent.querySelector("img");

        if (image) {
          const rect = image.getBoundingClientRect();

          return {
            src: image.currentSrc || image.src,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            width: rect.width,
            height: rect.height,
          };
        }

        parent = parent.parentElement;
      }

      return null;
    });

    expect(finalImageData).not.toBeNull();

    expect(
      finalImageData!.src,
      `Ảnh "${item.name}" vẫn sử dụng đường dẫn ảnh gốc bị lỗi`,
    ).not.toBe(item.src);

    expect(finalImageData!.naturalWidth).toBeGreaterThan(0);
    expect(finalImageData!.naturalHeight).toBeGreaterThan(0);
    expect(finalImageData!.width).toBeGreaterThan(0);
    expect(finalImageData!.height).toBeGreaterThan(0);

    await expect(label).toBeVisible();

    checkedCount++;

    console.log(
      `${item.name}: Ảnh gốc bị chặn, Placeholder đã tải thành công.`,
    );
  }

  expect(checkedCount).toBe(shortcuts.length);

  console.log(
    `Shortcut_Image_01: Đã kiểm tra thành công ${checkedCount} danh mục.`,
  );
});

test("Shortcut_Nav_01", async ({ page }) => {
  await checkShortcutNavigation(
    page,
    "Máy giặt",
    "/may-giat",
    "Shortcut_Nav_01",
  );
});

test("Shortcut_Nav_02", async ({ page }) => {
  await checkShortcutNavigation(
    page,
    "Máy nước nóng",
    "/may-nuoc-nong",
    "Shortcut_Nav_02",
  );
});

test("Shortcut_Nav_03", async ({ page }) => {
  await checkShortcutNavigation(page, "Tivi", "/tivi", "Shortcut_Nav_03");
});

test("Shortcut_Nav_04", async ({ page }) => {
  await checkShortcutNavigation(
    page,
    "Máy lọc nước",
    "/may-loc-nuoc",
    "Shortcut_Nav_04",
  );
});

test("Shortcut_Nav_05", async ({ page }) => {
  await checkShortcutNavigation(
    page,
    "Tủ đông mát",
    "/tu-dong-mat",
    "Shortcut_Nav_05",
  );
});

test("Shortcut_Nav_06", async ({ page }) => {
  const shortcuts = [
    { name: "Quạt", url: "/quat" },
    { name: "Loa", url: "/loa" },
    { name: "Bếp điện âm", url: "/bep-dien" },
    { name: "Tủ lạnh", url: "/tu-lanh" },
    { name: "Gia dụng", url: "/gia-dung" },
    { name: "Máy lạnh", url: "/dieu-hoa" },
    { name: "Máy sấy quần áo", url: "/may-say-quan-ao" },
    { name: "Robot hút bụi", url: "/robot-hut-bui" },
    { name: "Nồi cơm điện", url: "/noi-com-dien" },
    { name: "Sức khỏe & Làm đẹp", url: "/suc-khoe-lam-dep" },
  ];

  for (const shortcut of shortcuts) {
    await checkShortcutNavigation(
      page,
      shortcut.name,
      shortcut.url,
      "Shortcut_Nav_06",
    );
  }
});

test("Shortcut_Nav_07", async ({ page }) => {
  await checkShortcutNavigation(
    page,
    "Tất cả danh mục",
    "/danh-muc-nhom-hang",
    "Shortcut_Nav_07",
  );
});

test("AllGroups_Nav_01", async ({ page }) => {
  await page.goto("https://www.dienmayxanh.com/danh-muc-nhom-hang");

  await page.waitForLoadState("domcontentloaded");

  const banUi = page.getByText("Bàn ủi", { exact: true }).first();

  await expect(banUi, "Không tìm thấy nhóm hàng Bàn ủi").toBeVisible({
    timeout: 15000,
  });

  const banUiLink = banUi.locator("xpath=ancestor-or-self::a[1]");

  await expect(banUiLink, "Nhóm hàng Bàn ủi không có liên kết").toBeVisible();

  const href = await banUiLink.getAttribute("href");

  expect(href, "Không tìm thấy URL danh mục Bàn ủi").toBeTruthy();

  const expectedUrl = new URL(href!, page.url());

  await Promise.all([
    page.waitForURL((url) => url.href === expectedUrl.href, { timeout: 15000 }),
    banUiLink.click(),
  ]);

  await expect(page).toHaveURL(expectedUrl.href);

  await page.waitForLoadState("domcontentloaded");

  console.log("URL danh mục Bàn ủi:", page.url());
  console.log("AllGroups_Nav_01: Đã chuyển đến danh mục Bàn ủi.");
});

test("AllGroups_Display_01", async ({ page }) => {
  await page.goto("https://www.dienmayxanh.com/danh-muc-nhom-hang");

  await page.waitForLoadState("domcontentloaded");

  await page.waitForTimeout(2000);

  const body = page.locator("body");

  await expect(
    body,
    "Trang Tất cả nhóm hàng không hiển thị nội dung",
  ).not.toBeEmpty();

  const groupLinks = page.locator("a[href]:visible");

  const linkCount = await groupLinks.count();

  expect(
    linkCount,
    "Trang không có liên kết nhóm hàng nào hiển thị",
  ).toBeGreaterThan(0);

  const groupNames: string[] = [];

  for (let i = 0; i < linkCount; i++) {
    const link = groupLinks.nth(i);
    const text = (await link.innerText().catch(() => "")).trim();

    if (text.length > 0) {
      groupNames.push(text);
    }
  }

  expect(
    groupNames.length,
    "Không tìm thấy tên nhóm hàng hiển thị trên trang",
  ).toBeGreaterThan(0);

  console.log("Số liên kết có nội dung:", groupNames.length);
  console.log("Danh sách nội dung tìm thấy:", groupNames);

  console.log(
    "AllGroups_Display_01: Trang Tất cả nhóm hàng có hiển thị danh sách liên kết.",
  );
});

test("AllGroups_Display_02", async ({ page }) => {
  await page.goto("https://www.dienmayxanh.com/danh-muc-nhom-hang");
  await page.waitForLoadState("domcontentloaded");

  await page.waitForTimeout(2000);

  const links = page.locator("a[href]:visible");
  const linkCount = await links.count();

  const categories: {
    name: string;
    x: number;
    y: number;
    href: string;
  }[] = [];

  for (let i = 0; i < linkCount; i++) {
    const link = links.nth(i);
    const name = (await link.innerText().catch(() => "")).trim();
    const box = await link.boundingBox();

    if (!name || !box) continue;

    if (box.x < 400 && box.y > 100) {
      categories.push({
        name,
        x: box.x,
        y: box.y,
        href: (await link.getAttribute("href")) ?? "",
      });
    }
  }

  expect(
    categories.length,
    "Không tìm thấy danh mục nào ở khu vực bên trái",
  ).toBeGreaterThan(0);

  console.log("========== DANH MỤC BÊN TRÁI ==========");

  categories.forEach((category, index) => {
    console.log(
      `${index + 1}. ${category.name} | X: ${category.x} | Y: ${category.y} | URL: ${category.href}`,
    );
  });

  console.log("Tổng số danh mục tìm thấy:", categories.length);
  console.log("AllGroups_Display_02: Đã kiểm tra danh sách bên trái.");
});

test("AllGroups_Search_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  await page.goto("https://www.dienmayxanh.com/danh-muc-nhom-hang");
  await page.waitForLoadState("domcontentloaded");

  const searchInput = page.getByRole("textbox", {
    name: "Nhập nhóm hàng cần tìm",
  });

  await expect(searchInput, "Không tìm thấy ô tìm kiếm nhóm hàng").toBeVisible({
    timeout: 15000,
  });

  await searchInput.fill("Tủ lạnh");

  await expect(searchInput).toHaveValue("Tủ lạnh");

  console.log("Đã nhập từ khóa tìm kiếm: Tủ lạnh");

  await searchInput.press("Enter");
  await page.waitForTimeout(2000);

  const searchResult = page
    .getByText("Tủ lạnh", {
      exact: true,
    })
    .last();

  await expect(
    searchResult,
    "Không tìm thấy nhóm hàng Tủ lạnh trong kết quả tìm kiếm",
  ).toBeVisible({ timeout: 15000 });

  console.log("Từ khóa tìm kiếm: Tủ lạnh");
  console.log("Kết quả tìm kiếm Tủ lạnh được hiển thị.");
  console.log("AllGroups_Search_01: Kiểm tra tìm kiếm hoàn tất.");
});

test("AllGroups_Search_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  await page.goto("https://www.dienmayxanh.com/danh-muc-nhom-hang");
  await page.waitForLoadState("domcontentloaded");

  const searchInput = page.getByRole("textbox", {
    name: "Nhập nhóm hàng cần tìm",
  });

  await expect(searchInput, "Không tìm thấy ô tìm kiếm nhóm hàng").toBeVisible({
    timeout: 15000,
  });

  await searchInput.fill("xyz123");

  await expect(searchInput).toHaveValue("xyz123");

  console.log("Đã nhập từ khóa tìm kiếm: xyz123");

  await page.waitForTimeout(2000);

  const noResultMessage = page.getByText("Không tìm thấy kết quả phù hợp", {
    exact: true,
  });

  await expect(
    noResultMessage,
    "Không hiển thị thông báo khi không tìm thấy nhóm hàng",
  ).toBeVisible({ timeout: 15000 });

  await expect(searchInput).toBeVisible();
  await expect(searchInput).toBeEditable();

  console.log("Thông báo: Không tìm thấy kết quả phù hợp");
  console.log("Ô tìm kiếm vẫn hoạt động bình thường.");
  console.log("AllGroups_Search_02: Kiểm tra hoàn tất.");
});

test("AllGroups_Alpha_01", async ({ page }) => {
  // Bước 1: Mở trang Tất cả nhóm hàng
  await page.goto("https://www.dienmayxanh.com/danh-muc-nhom-hang");
  await page.waitForLoadState("domcontentloaded");

  // Bước 2: Tìm chữ B trên thanh bảng chữ cái
  const letterB = page.getByText("B", { exact: true }).first();

  await expect(
    letterB,
    "Không tìm thấy chữ B trên thanh bảng chữ cái",
  ).toBeVisible({ timeout: 15000 });

  // Lấy vị trí danh sách nhóm hàng bắt đầu bằng chữ B
  const banUi = page.getByText("Bàn ủi", { exact: true }).last();

  await expect(
    banUi,
    "Không tìm thấy nhóm hàng bắt đầu bằng chữ B",
  ).toBeVisible({ timeout: 15000 });

  // Bước 3: Nhấn chữ B
  await letterB.click();

  await page.waitForTimeout(1000);

  // Bước 4: Kiểm tra trang đã cuộn đến nhóm hàng chữ B
  const letterPosition = await banUi.evaluate(
    (element) => element.getBoundingClientRect().top,
  );

  expect(
    letterPosition,
    "Trang chưa cuộn đến danh sách nhóm hàng chữ B",
  ).toBeLessThan(500);

  console.log("Vị trí nhóm hàng B sau khi nhấn:", letterPosition);
  console.log("AllGroups_Alpha_01: Đã kiểm tra chức năng chọn chữ cái B.");
});

test("Mega_Hover_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);
  await hoverDanhMuc(page);
  await waitMenu(page);

  const categories = [
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

  for (const categoryName of categories) {
    const category = page.getByText(categoryName).first();

    await expect(
      category,
      `Không tìm thấy danh mục ${categoryName}`,
    ).toBeVisible({ timeout: 15000 });

    const beforeHover = await category.evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });

    await hoverCategory(page, categoryName);

    const afterHover = await category.evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });

    console.log(`Danh mục: ${categoryName}`);
    console.log("Trước hover:", beforeHover);
    console.log("Sau hover:", afterHover);

    const hasHoverEffect =
      beforeHover.color !== afterHover.color ||
      beforeHover.backgroundColor !== afterHover.backgroundColor;

    expect(
      hasHoverEffect,
      `Danh mục "${categoryName}" không thay đổi màu khi hover`,
    ).toBeTruthy();
  }

  console.log("--------------------------------");
  console.log("Đã kiểm tra 11 nhóm danh mục chính.");
  console.log("Mega_Hover_01: Kiểm tra hoàn tất.");
  console.log("--------------------------------");
});

test("Category_Click_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  const item = page.getByText("Máy giặt", { exact: true }).first();

  await expect(item, "Không tìm thấy danh mục Máy giặt").toBeVisible({
    timeout: 15000,
  });

  const itemLink = item.locator("xpath=ancestor-or-self::a[1]");

  await expect(itemLink, "Danh mục Máy giặt không có liên kết").toBeVisible();

  const href = await itemLink.getAttribute("href");

  expect(href, "Không tìm thấy URL danh mục Máy giặt").toBeTruthy();

  const expectedUrl = new URL(href!, page.url());

  const icon = itemLink.locator("img").first();

  await expect(icon, "Không tìm thấy hình ảnh icon Máy giặt").toBeVisible();

  const imageBox = await icon.boundingBox();

  expect(imageBox, "Không lấy được vị trí hình ảnh icon").toBeTruthy();

  await Promise.all([
    page.waitForURL(expectedUrl.href, { timeout: 15000 }),
    page.mouse.click(imageBox!.x + 3, imageBox!.y + 3),
  ]);

  await expect(page).toHaveURL(expectedUrl.href);

  console.log("Nhấn vào hình ảnh icon: Thành công.");
  console.log("URL sau khi nhấn hình ảnh:", page.url());

  await openHomeAndCloseVoucher(page);

  const itemAgain = page
    .getByText("Máy giặt", {
      exact: true,
    })
    .first();

  await expect(itemAgain).toBeVisible({ timeout: 15000 });

  const itemLinkAgain = itemAgain.locator("xpath=ancestor-or-self::a[1]");

  await Promise.all([
    page.waitForURL(expectedUrl.href, { timeout: 15000 }),
    itemAgain.click(),
  ]);

  await expect(page).toHaveURL(expectedUrl.href);

  console.log("Nhấn vào tên danh mục: Thành công.");
  console.log("URL sau khi nhấn tên:", page.url());

  console.log("--------------------------------");
  console.log("Danh mục kiểm tra: Máy giặt");
  console.log("Nhấn hình ảnh icon: Đạt");
  console.log("Nhấn chữ tên danh mục: Đạt");
  console.log("Category_Click_01: Kiểm tra hoàn tất.");
  console.log("--------------------------------");
});

test("Category_Click_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  const tivi = page
    .getByText("Tivi", {
      exact: true,
    })
    .first();

  await expect(tivi, "Không tìm thấy danh mục Tivi trên trang chủ").toBeVisible(
    { timeout: 15000 },
  );

  const tiviLink = tivi.locator("xpath=ancestor-or-self::a[1]");

  await expect(tiviLink, "Danh mục Tivi không có liên kết").toBeVisible();

  const href = await tiviLink.getAttribute("href");

  expect(href, "Không tìm thấy URL danh mục Tivi").toBeTruthy();

  const expectedUrl = new URL(href!, page.url());

  console.log("URL dự kiến của danh mục Tivi:", expectedUrl.href);

  await Promise.all([
    page.waitForURL(expectedUrl.href, { timeout: 15000 }),
    tivi.click(),
  ]);

  await expect(
    page,
    "Trình duyệt điều hướng sai danh mục sau khi nhấn Tivi",
  ).toHaveURL(expectedUrl.href);

  console.log("URL thực tế:", page.url());
  console.log("Đã nhấn đúng danh mục Tivi.");
  console.log("Category_Click_02: Kiểm tra hoàn tất.");
});

test("Mega_Keyboard_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);
  await hoverDanhMuc(page);
  await waitMenu(page);

  const category = page
    .getByText("Máy lạnh", {
      exact: true,
    })
    .first();

  await expect(category, "Không tìm thấy danh mục Máy lạnh").toBeVisible({
    timeout: 15000,
  });

  const categoryLink = category.locator("xpath=ancestor-or-self::a[1]");

  await expect(
    categoryLink,
    "Danh mục Máy lạnh không có liên kết",
  ).toBeVisible();

  const href = await categoryLink.getAttribute("href");

  expect(href, "Không tìm thấy URL danh mục Máy lạnh").toBeTruthy();

  const expectedUrl = new URL(href!, page.url());

  let isFocused = false;

  for (let i = 0; i < 50; i++) {
    await page.keyboard.press("Tab");

    isFocused = await categoryLink.evaluate((element) => {
      return (
        document.activeElement === element ||
        element.contains(document.activeElement)
      );
    });

    if (isFocused) {
      break;
    }
  }

  expect(
    isFocused,
    "Không thể di chuyển focus bằng phím Tab đến danh mục Máy lạnh",
  ).toBeTruthy();

  const focusStyle = await categoryLink.evaluate((element) => {
    const activeElement = document.activeElement as HTMLElement;
    const style = window.getComputedStyle(activeElement);

    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
      focusVisible: activeElement.matches(":focus-visible"),
    };
  });

  console.log("Trạng thái focus:", focusStyle);

  const hasFocusIndicator =
    focusStyle.focusVisible ||
    (focusStyle.outlineStyle !== "none" && focusStyle.outlineWidth !== "0px") ||
    focusStyle.boxShadow !== "none";

  expect(
    hasFocusIndicator,
    "Danh mục Máy lạnh không hiển thị trạng thái focus",
  ).toBeTruthy();

  await Promise.all([
    page.waitForURL(expectedUrl.href, { timeout: 15000 }),
    page.keyboard.press("Enter"),
  ]);

  await expect(page).toHaveURL(expectedUrl.href);

  console.log("URL danh mục Máy lạnh:", page.url());
  console.log("Focus bằng bàn phím: Thành công.");
  console.log("Nhấn Enter điều hướng đúng trang.");
  console.log("Mega_Keyboard_01: Kiểm tra hoàn tất.");
});

test("Mega_Perf_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  const danhMuc = page
    .getByText("Danh mục", {
      exact: true,
    })
    .first();

  await expect(danhMuc).toBeVisible({ timeout: 15000 });

  const startTime = Date.now();

  await danhMuc.hover();

  const menuContent = page
    .getByText("Điện lạnh, điện máy", {
      exact: true,
    })
    .first();

  await expect(menuContent, "Mega Menu không hiển thị nội dung").toBeVisible({
    timeout: 15000,
  });

  const additionalContent = page
    .getByText("Điện gia dụng", {
      exact: true,
    })
    .first();

  await expect(
    additionalContent,
    "Nội dung Mega Menu chưa cập nhật đầy đủ",
  ).toBeVisible({ timeout: 15000 });

  const endTime = Date.now();
  const responseTime = endTime - startTime;

  console.log("--------------------------------");
  console.log("Thời gian mở Mega Menu:", responseTime, "ms");
  console.log("SLA yêu cầu: < 1500 ms");

  expect(
    responseTime,
    `Mega Menu mở quá chậm: ${responseTime} ms (SLA < 1500 ms)`,
  ).toBeLessThan(1500);

  console.log("Mega_Perf_01: Đạt yêu cầu hiệu năng.");
  console.log("--------------------------------");
});

test("Mega_Perf_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  const cdp = await page.context().newCDPSession(page);

  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (500 * 1024) / 8,
    uploadThroughput: (500 * 1024) / 8,
    connectionType: "cellular3g",
  });

  console.log("Đã giả lập mạng Slow 3G.");

  await hoverDanhMuc(page);

  const menuContent = page.getByText("Điện lạnh, điện máy").first();

  await expect(
    menuContent,
    "Mega Menu không hiển thị khi sử dụng mạng chậm",
  ).toBeVisible({ timeout: 15000 });

  const categories = [
    "Điện lạnh, điện máy",
    "Điện gia dụng",
    "Máy lọc nước",
    "Đồ gia dụng",
    "Làm đẹp, chăm sóc cá nhân",
    "Điện tử, Laptop, Công nghệ",
    "Phụ kiện",
  ];

  for (const category of categories) {
    await hoverCategory(page, category);

    await expect(
      page.locator("body"),
      `Trang không phản hồi khi hover danh mục: ${category}`,
    ).toBeVisible();

    console.log(`Đã hover danh mục: ${category}`);
  }

  await expect(page.locator("body")).toBeVisible();

  console.log("--------------------------------");
  console.log("Mega_Perf_02: Mega Menu vẫn phản hồi khi mạng Slow 3G.");
  console.log("--------------------------------");

  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  await cdp.detach();
});

test("Responsive_01", async ({ page }) => {
  const viewports = [
    { name: "Desktop", width: 1440, height: 900 },
    { name: "Tablet", width: 768, height: 1024 },
    { name: "Mobile", width: 390, height: 844 },
  ];

  const shortcutNames = [
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

  const results: string[] = [];

  for (const viewport of viewports) {
    console.log("\n--------------------------------");
    console.log(`Đang kiểm tra ${viewport.name}`);

    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    await openHomeAndCloseVoucher(page);

    const pageWidth = await page.evaluate(() => ({
      screenWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));

    const noHorizontalOverflow =
      pageWidth.documentWidth <= pageWidth.screenWidth;

    console.log(
      `${viewport.name}: Màn hình ${pageWidth.screenWidth}px, nội dung ${pageWidth.documentWidth}px`,
    );

    if (!noHorizontalOverflow) {
      console.log(`${viewport.name}: PHÁT HIỆN TRÀN NGANG`);

      const overflowElements = await page.evaluate(() => {
        const screenWidth = document.documentElement.clientWidth;

        return Array.from(document.querySelectorAll("body *"))
          .map((element) => {
            const rect = element.getBoundingClientRect();

            return {
              tag: element.tagName,
              className:
                typeof element.className === "string" ? element.className : "",
              text: element.textContent?.trim().slice(0, 40),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            };
          })
          .filter(
            (element) =>
              element.width > 0 &&
              (element.left < 0 || element.right > screenWidth),
          )
          .slice(0, 20);
      });

      console.log("Các phần tử nghi ngờ gây tràn:", overflowElements);
    }

    let visibleShortcuts = 0;

    for (const name of shortcutNames) {
      const shortcut = page.getByText(name, { exact: true }).first();

      if (await shortcut.isVisible().catch(() => false)) {
        visibleShortcuts++;
      }
    }

    console.log(
      `${viewport.name}: Tìm thấy ${visibleShortcuts}/15 Quick Links`,
    );

    const shortcutAvailable = visibleShortcuts > 0;

    const danhMuc = page.getByText("Danh mục", { exact: true }).first();

    const menuButtonAvailable = await danhMuc.isVisible().catch(() => false);

    let menuAvailable = false;

    if (menuButtonAvailable) {
      if (viewport.width > 1024) {
        await hoverDanhMuc(page);
      } else {
        await danhMuc.click();
      }

      const categoryContent = page
        .getByText("Điện lạnh, điện máy", { exact: true })
        .first();

      menuAvailable = await categoryContent
        .isVisible({ timeout: 5000 })
        .catch(() => false);
    }

    console.log(
      `${viewport.name}: Menu ${menuAvailable ? "hiển thị" : "không hiển thị"}`,
    );

    const passed =
      noHorizontalOverflow &&
      shortcutAvailable &&
      menuButtonAvailable &&
      menuAvailable;

    results.push(`${viewport.name}: ${passed ? "PASSED" : "FAILED"}`);

    console.log(results[results.length - 1]);
  }

  console.log("\n========== TỔNG KẾT RESPONSIVE_01 ==========");

  for (const result of results) {
    console.log(result);
  }

  expect(
    results.every((result) => result.endsWith("PASSED")),
    "Responsive_01: Có viewport không đạt yêu cầu.",
  ).toBe(true);
});

test("Responsive_02", async ({ page }) => {
  const viewports = [
    { name: "Desktop", width: 1440, height: 900 },
    { name: "Tablet", width: 768, height: 1024 },
    { name: "Mobile", width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    console.log("--------------------------------");
    console.log(`Kiểm tra ${viewport.name}`);

    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    await openHomeAndCloseVoucher(page);

    const quickLinks = [
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

    for (const name of quickLinks) {
      const item = page.getByText(name, { exact: true }).first();

      if (await item.isVisible().catch(() => false)) {
        const textInfo = await item.evaluate((element) => {
          const rect = element.getBoundingClientRect();

          return {
            width: rect.width,
            height: rect.height,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
          };
        });

        expect(
          textInfo.scrollWidth,
          `${viewport.name}: Tên danh mục "${name}" bị tràn ngang`,
        ).toBeLessThanOrEqual(textInfo.clientWidth);

        expect(
          textInfo.scrollHeight,
          `${viewport.name}: Tên danh mục "${name}" bị tràn dọc`,
        ).toBeLessThanOrEqual(textInfo.clientHeight);

        console.log(`${viewport.name}: Đã kiểm tra tên "${name}".`);
      }
    }

    const images = page.locator("img:visible");
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);

      const imageInfo = await img.evaluate((element: HTMLImageElement) => {
        const rect = element.getBoundingClientRect();

        return {
          complete: element.complete,
          naturalWidth: element.naturalWidth,
          naturalHeight: element.naturalHeight,
          width: rect.width,
          height: rect.height,
        };
      });

      if (imageInfo.width > 0 && imageInfo.height > 0 && imageInfo.complete) {
        expect(
          imageInfo.naturalWidth,
          `${viewport.name}: Có hình ảnh không tải được`,
        ).toBeGreaterThan(0);

        expect(
          imageInfo.naturalHeight,
          `${viewport.name}: Hình ảnh không có chiều cao hợp lệ`,
        ).toBeGreaterThan(0);

        console.log(`${viewport.name}: Đã kiểm tra ảnh ${i + 1}.`);
      }
    }

    if (viewport.width > 1024) {
      await hoverDanhMuc(page);

      const menuCategories = [
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

      for (const name of menuCategories) {
        const category = page.getByText(name).first();

        await expect(
          category,
          `${viewport.name}: Không hiển thị danh mục "${name}"`,
        ).toBeVisible({ timeout: 10000 });

        const categoryInfo = await category.evaluate((element) => {
          const rect = element.getBoundingClientRect();

          return {
            width: rect.width,
            height: rect.height,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        });

        expect(
          categoryInfo.width,
          `${viewport.name}: Danh mục "${name}" không có chiều rộng`,
        ).toBeGreaterThan(0);

        expect(
          categoryInfo.height,
          `${viewport.name}: Danh mục "${name}" không có chiều cao`,
        ).toBeGreaterThan(0);

        console.log(`${viewport.name}: Đã kiểm tra "${name}".`);
      }
    } else {
      console.log(
        `${viewport.name}: Bỏ qua Mega Menu desktop, cần kiểm tra menu thay thế theo thiết kế mobile/tablet.`,
      );
    }

    const pageWidth = await page.evaluate(() => ({
      screenWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));

    expect(
      pageWidth.documentWidth,
      `${viewport.name}: Giao diện bị tràn ngang`,
    ).toBeLessThanOrEqual(pageWidth.screenWidth);

    console.log(`${viewport.name}: Hoàn thành kiểm tra.`);
  }

  console.log("--------------------------------");
  console.log("Responsive_02: Hoàn thành kiểm tra.");
  console.log("--------------------------------");
});
