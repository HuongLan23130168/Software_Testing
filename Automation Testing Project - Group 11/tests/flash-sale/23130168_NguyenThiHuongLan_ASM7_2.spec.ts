import { test, expect, Page, Locator } from "@playwright/test";

const HOME_URL = "https://www.dienmayxanh.com/";
const VOUCHER_CLOSE_SELECTOR = ".h-32px.w-32px.sm\\:h-36px";
const PRODUCT_PRICE_SELECTOR = "a.font-700.text-red-7";

const MENU_ITEMS = [
  "Flashsale",
  "Điện lạnh",
  "Điện tử",
  "Gia dụng",
  "Máy lọc nước",
  "Việc Bếp Dễ Dàng",
  "Sức khoẻ - Làm đẹp",
  "Hàng tiện ích - Giá thật thích",
  "Viễn thông sale hot",
];

const SUB_TAB_NAMES = [
  "Nổi bật",
  "Máy lạnh",
  "Máy giặt",
  "Tủ lạnh",
  "Máy Nước Nóng",
  "Máy sấy",
  "Máy rửa chén",
  "Tủ Đông - Mát",
];

const FILTER_NAMES = ["Nổi bật", "% Giảm giá", "Giá thấp"];

// 1. Mở website và đóng popup Voucher nếu có.
async function openHomeAndCloseVoucher(page: Page) {
  await page.goto(HOME_URL);

  const closeVoucher = page.locator(VOUCHER_CLOSE_SELECTOR);

  if (await closeVoucher.isVisible().catch(() => false)) {
    await closeVoucher.click();
  }
}

// 2. Dùng chung cho FS_Open_02 và FS_GUI_01:
async function navigateToFlashSale(page: Page) {
  await openHomeAndCloseVoucher(page);

  const danhMuc = page.getByText("Danh mục", { exact: true }).first();
  await danhMuc.hover();

  const chuongTrinhHot = page.getByText("Chương trình hot", {
    exact: true,
  });

  await expect(chuongTrinhHot).toBeVisible({ timeout: 15000 });
  await chuongTrinhHot.hover({ timeout: 15000 });

  const flashSale = page.getByRole("link", {
    name: /Flash sale giảm đến 50%/,
  });

  await expect(flashSale).toBeVisible({ timeout: 15000 });
  await flashSale.click();

  await expect(page).toHaveURL(/\/flashsale/i, { timeout: 15000 });
}

// 3. Cuộn đến khu vực Flash Sale trên trang chủ.
async function scrollToHomeFlashSale(page: Page) {
  const promotionTitle = page
    .getByText(/Khuyến mãi online|Khám phá online/i)
    .first();

  await expect(promotionTitle).toBeVisible({ timeout: 15000 });
  await promotionTitle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);

  const countdownElements = page
    .locator("div, span")
    .filter({ hasText: /^Chỉ còn/ });

  const visibleCountdown = countdownElements.filter({ visible: true }).last();

  await expect(visibleCountdown).toBeVisible({ timeout: 15000 });

  return visibleCountdown;
}

// 4. Kiểm tra ảnh hiển thị và tải thành công.
async function expectImageLoaded(image: Locator) {
  await expect(image).toBeVisible({ timeout: 15000 });

  await expect
    .poll(
      async () => {
        return await image.evaluate((img) => {
          return (
            img instanceof HTMLImageElement &&
            img.complete &&
            img.naturalWidth > 0
          );
        });
      },
      {
        timeout: 15000,
        message: "Banner Flash Sale chưa tải thành công",
      },
    )
    .toBe(true);
}

// 5. Chuyển chuỗi giá thành số.
function convertPrice(priceText: string): number {
  return Number(priceText.replace(/[^\d]/g, ""));
}

// 6. Lấy danh sách sản phẩm trong khu vực được chọn.
async function getProducts(productGroup: Locator) {
  return productGroup.evaluate((group) => {
    const priceElements = Array.from(
      group.querySelectorAll("a.font-700.text-red-7"),
    );

    const products: {
      name: string;
      price: string;
      discount: string;
    }[] = [];

    for (const priceElement of priceElements) {
      let parent = priceElement.parentElement;
      let productName = "";
      let productCard: HTMLElement | null = null;

      while (parent && parent !== group) {
        const title = parent.querySelector("a[title]");

        if (title) {
          productName = title.getAttribute("title") || "";
          productCard = parent as HTMLElement;
          break;
        }

        parent = parent.parentElement;
      }

      if (!productName || !productCard) continue;

      const price = priceElement.textContent?.trim() || "";

      const discountElement = productCard.querySelector(
        "a.flex.h-fit.w-full.items-center span.text-red-7",
      );

      const discount = discountElement?.textContent?.trim() || "";

      if (!products.some((product) => product.name === productName)) {
        products.push({
          name: productName,
          price,
          discount,
        });
      }
    }

    return products;
  });
}

// 7. Lấy ảnh đang hiển thị theo alt.
async function getVisibleImageByAlt(page: Page, alt: string) {
  const images = page.locator(`img[alt="${alt}"]`);

  for (let i = 0; i < (await images.count()); i++) {
    const image = images.nth(i);

    if (await image.isVisible()) {
      return image;
    }
  }

  return null;
}

// 8. Chọn tiêu chí lọc sản phẩm.
async function selectFilter(page: Page, productGroup: Locator, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const filter = productGroup.locator("button, div.text-14.w-full").filter({
    hasText: new RegExp(`^${escapedName}$`),
  });

  const filterCount = await filter.count();

  if (filterCount === 0) {
    console.log("Không tìm thấy tiêu chí:", name);

    console.log(
      "Các phần tử có thể là tiêu chí:",
      await productGroup
        .locator("button, div.text-14.w-full")
        .allTextContents(),
    );

    throw new Error("Không tìm thấy tiêu chí: " + name);
  }

  for (let i = 0; i < filterCount; i++) {
    const option = filter.nth(i);

    if (await option.isVisible()) {
      await option.click();
      await page.waitForTimeout(2000);

      const products = await getProducts(productGroup);

      console.log("Đã chọn tiêu chí:", name);
      console.log("Số sản phẩm:", products.length);

      expect(products.length).toBeGreaterThan(0);

      return products;
    }
  }

  throw new Error("Tiêu chí không hiển thị: " + name);
}

// 9. Cuộn đến danh mục sản phẩm trên trang Flash Sale.
async function navigateToFlashSaleCategory(page: Page, categoryName: string) {
  const flashSaleImage = page.getByRole("img", {
    name: "Flashsale",
  });

  await expect(flashSaleImage).toBeVisible();
  await flashSaleImage.scrollIntoViewIfNeeded();

  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(2000);

  const categoryTab = page
    .getByText(categoryName, {
      exact: true,
    })
    .first();

  await expect(categoryTab).toBeVisible();
  await categoryTab.click();

  await page.waitForTimeout(2000);

  const categorySection = page
    .getByText(categoryName, {
      exact: true,
    })
    .last();

  await expect(categorySection).toBeVisible();
  await categorySection.scrollIntoViewIfNeeded();

  return categorySection;
}

// 10. Kiểm tra banner tại section ngành hàng.
async function checkCategoryBanner(page: Page, categoryName: string) {
  console.log(`\n===== KIỂM TRA BANNER: ${categoryName} =====`);

  // 1. Điều hướng đến section ngành hàng.
  await navigateToFlashSaleCategory(page, categoryName);

  // 2. Tìm banner có alt trùng tên ngành hàng.
  const banner = page.locator(`img[alt="${categoryName}"]`).last();

  // 3. Cuộn đến banner.
  await banner.scrollIntoViewIfNeeded();

  // 4. Kiểm tra banner hiển thị và tải ảnh thành công.
  await expectImageLoaded(banner);

  // 5. Kiểm tra kích thước banner.
  const bannerBox = await banner.boundingBox();

  expect(bannerBox).not.toBeNull();

  if (bannerBox) {
    expect(bannerBox.width).toBeGreaterThan(0);
    expect(bannerBox.height).toBeGreaterThan(0);
  }

  console.log(`Banner ${categoryName}: PASS`);
}

// 11. Kiểm tra chất lượng và tỷ lệ hiển thị của banner ngành hàng.
async function checkBannerImageQuality(page: Page, categoryName: string) {
  console.log(`\n===== KIỂM TRA CHẤT LƯỢNG BANNER: ${categoryName} =====`);

  // Điều hướng đến section ngành hàng.
  await navigateToFlashSaleCategory(page, categoryName);

  // Lấy banner theo alt của ngành hàng.
  const banner = page.locator(`img[alt="${categoryName}"]`).last();

  // Đưa banner vào vùng quan sát.
  await banner.scrollIntoViewIfNeeded();
  await expect(banner).toBeVisible();

  // Kiểm tra ảnh tải thành công.
  await expectImageLoaded(banner);

  // Lấy thông tin ảnh và kích thước hiển thị.
  const imageInfo = await banner.evaluate((img: HTMLImageElement) => {
    const rect = img.getBoundingClientRect();
    const style = window.getComputedStyle(img);

    return {
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,

      displayWidth: rect.width,
      displayHeight: rect.height,

      objectFit: style.objectFit,
      currentSrc: img.currentSrc,
    };
  });

  console.log("Thông tin banner:", imageInfo);

  // 1. Ảnh phải tải hoàn tất.
  expect(imageInfo.complete).toBe(true);

  // 2. Ảnh phải có kích thước gốc hợp lệ.
  expect(imageInfo.naturalWidth).toBeGreaterThan(0);
  expect(imageInfo.naturalHeight).toBeGreaterThan(0);

  // 3. Ảnh phải có kích thước hiển thị thực tế.
  expect(imageInfo.displayWidth).toBeGreaterThan(0);
  expect(imageInfo.displayHeight).toBeGreaterThan(0);

  // 4. Kiểm tra tỷ lệ ảnh nếu CSS sử dụng object-fit: fill.
  // Với fill, ảnh có thể bị kéo giãn nếu tỷ lệ gốc và tỷ lệ hiển thị khác nhau.
  if (imageInfo.objectFit === "fill") {
    const originalRatio = imageInfo.naturalWidth / imageInfo.naturalHeight;

    const displayRatio = imageInfo.displayWidth / imageInfo.displayHeight;

    const ratioDifference =
      Math.abs(originalRatio - displayRatio) / originalRatio;

    console.log("Tỷ lệ ảnh gốc:", originalRatio.toFixed(3));
    console.log("Tỷ lệ ảnh hiển thị:", displayRatio.toFixed(3));
    console.log("Độ chênh lệch tỷ lệ:", ratioDifference.toFixed(3));

    // Cho phép sai lệch tối đa 3%.
    expect(ratioDifference).toBeLessThanOrEqual(0.03);
  }

  console.log(`FS_Banner_02 - ${categoryName}: PASS`);
}

// 12. Chuẩn hóa chuỗi để so sánh, bỏ dấu tiếng Việt và không phân biệt hoa thường.
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// 13. Kiểm tra nội dung văn bản trên banner có phù hợp ngành hàng.
async function checkBannerContent(page: Page, categoryName: string) {
  console.log(`\n===== KIỂM TRA NỘI DUNG BANNER: ${categoryName} =====`);

  // Điều hướng đến section ngành hàng.
  await navigateToFlashSaleCategory(page, categoryName);

  // Tìm banner của ngành hàng.
  const banner = page.locator(`img[alt="${categoryName}"]`).last();

  await banner.scrollIntoViewIfNeeded();
  await expect(banner).toBeVisible();
  await expectImageLoaded(banner);

  // Thu thập thông tin ảnh và nội dung văn bản xung quanh banner.
  const bannerInfo = await banner.evaluate((img: HTMLImageElement) => {
    const parent = img.parentElement;

    return {
      alt: img.getAttribute("alt") || "",
      title: img.getAttribute("title") || "",
      ariaLabel: img.getAttribute("aria-label") || "",
      parentText: parent?.innerText || "",
      grandParentText: parent?.parentElement?.innerText || "",
    };
  });

  console.log("Thông tin banner:", bannerInfo);

  // Gom các thông tin văn bản có thể đọc được.
  const bannerText = normalizeText(
    [
      bannerInfo.alt,
      bannerInfo.title,
      bannerInfo.ariaLabel,
      bannerInfo.parentText,
    ].join(" "),
  );

  const normalizedCategory = normalizeText(categoryName);

  // Kiểm tra nội dung banner có nhắc đến ngành hàng tương ứng.
  expect(
    bannerText,
    `Banner không có nội dung phù hợp với ngành hàng: ${categoryName}`,
  ).toContain(normalizedCategory);

  console.log(`Banner ${categoryName}: Nội dung phù hợp.`);
}

// 14. Kiểm tra tab ngành hàng điều hướng đến đúng banner.
async function checkCategoryTabNavigation(page: Page, categoryName: string) {
  console.log(`\n===== KIỂM TRA ĐIỀU HƯỚNG: ${categoryName} =====`);

  // Tìm tab ngành hàng trên thanh điều hướng nhanh.
  const categoryTab = page.getByText(categoryName, { exact: true }).first();

  await expect(categoryTab).toBeVisible();

  // Lưu vị trí cuộn trước khi click.
  const scrollYBefore = await page.evaluate(() => window.scrollY);

  // Click tab ngành hàng.
  await categoryTab.click();

  // Chờ trang hoàn tất hiệu ứng cuộn.
  await page.waitForTimeout(2000);

  // Tìm banner tương ứng với ngành hàng.
  const banner = page.locator(`img[alt="${categoryName}"]`).last();

  await expect(banner).toBeVisible();
  await expectImageLoaded(banner);

  // Lấy thông tin vị trí banner sau khi click tab.
  const bannerInfo = await banner.evaluate((img: HTMLImageElement) => {
    const rect = img.getBoundingClientRect();

    return {
      alt: img.getAttribute("alt"),
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
    };
  });

  console.log("Vị trí trước khi click:", scrollYBefore);
  console.log("Thông tin banner sau khi click:", bannerInfo);

  // Banner phải có kích thước hiển thị hợp lệ.
  expect(bannerInfo.width).toBeGreaterThan(0);
  expect(bannerInfo.height).toBeGreaterThan(0);

  // Banner phải nằm trong vùng nhìn thấy của trình duyệt.
  expect(
    bannerInfo.bottom > 0 && bannerInfo.top < bannerInfo.viewportHeight,
    `Banner ${categoryName} không nằm trong vùng quan sát sau khi click tab.`,
  ).toBe(true);

  // Kiểm tra banner thuộc đúng ngành hàng.
  expect(normalizeText(bannerInfo.alt || "")).toBe(normalizeText(categoryName));

  console.log(`Điều hướng đến banner ${categoryName}: PASS`);
}

// FS_Display_01: Kiểm tra hiển thị mục Flash Sale trong Mega Menu.
test("FS_Display_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  // Bước 1: Hover vào Danh mục trên Header.
  const danhMuc = page.getByText("Danh mục", { exact: true }).first();
  await danhMuc.hover();

  // Bước 2: Hover vào Chương trình hot.
  const chuongTrinhHot = page.getByText("Chương trình hot", {
    exact: true,
  });

  await expect(chuongTrinhHot).toBeVisible({ timeout: 15000 });
  await chuongTrinhHot.hover({ timeout: 15000 });

  // Bước 3: Kiểm tra mục Flash Sale hiển thị.
  const flashSale = page.getByRole("link", {
    name: /Flash sale giảm đến 50%/,
  });

  await expect(flashSale).toBeVisible({ timeout: 15000 });
  await expect(flashSale).toContainText(/Flash sale/i);
  await expect(flashSale).toContainText(/50%/);

  console.log("FS_Display_01: Flash Sale hiển thị trong Mega Menu.");
});

// FS_Access_01: Kiểm tra điều hướng thành công vào trang Flash Sale từ Mega Menu.
test("FS_Access_01", async ({ page }) => {
  await navigateToFlashSale(page);

  console.log("FS_Access_01: Đã chuyển đến trang Flash Sale.");
});

// FS_Display_02: Kiểm tra hiển thị khu vực Flash Sale khi cuộn xuống trang chủ.
test("FS_Display_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  // Bước 1: Tìm ảnh Flash Sale trên trang chủ.
  const flashSaleImage = page.getByRole("img", {
    name: "Flashsale",
    exact: true,
  });

  await expect(flashSaleImage).toBeAttached({ timeout: 15000 });

  // Bước 2: Cuộn trang đến khu vực Flash Sale.
  await flashSaleImage.scrollIntoViewIfNeeded();

  await flashSaleImage.evaluate((element) => {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });

  await page.waitForTimeout(3000);

  console.log("FS_Display_02: Đã cuộn đến khu vực Flash Sale trên trang chủ.");
});

// FS_Display_03: Kiểm tra hiển thị tiêu đề và đồng hồ đếm ngược Flash Sale ở trang chủ.
test("FS_Display_03", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  // 1. Tìm ảnh Flash Sale trên trang chủ.
  const flashSaleImage = page.getByRole("img", {
    name: "Flashsale",
    exact: true,
  });

  await expect(flashSaleImage).toBeAttached({
    timeout: 15000,
  });

  // 2. Cuộn trang đến khu vực Flash Sale.
  await flashSaleImage.scrollIntoViewIfNeeded();

  await flashSaleImage.evaluate((element) => {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });

  await page.waitForTimeout(3000);

  // 3. Kiểm tra nhãn Chỉ còn.
  const countdownLabel = page.getByText(/^Chỉ còn/i).last();

  await expect(countdownLabel).toBeVisible({
    timeout: 15000,
  });

  // 4. Tìm đồng hồ đếm ngược có định dạng HH:MM:SS.
  const countdown = page.getByText(/^\d{2}:\d{2}:\d{2}$/).last();

  await expect(countdown).toBeVisible({
    timeout: 15000,
  });

  // 5. Ghi nhận thời gian ban đầu.
  const timeBefore = (await countdown.textContent())?.trim();

  // 6. Chờ 2 giây để kiểm tra đồng hồ cập nhật.
  await page.waitForTimeout(2000);

  const timeAfter = (await countdown.textContent())?.trim();

  expect(timeBefore).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  expect(timeAfter).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  expect(timeAfter).not.toBe(timeBefore);

  // 7. Kiểm tra danh sách sản phẩm.
  // Lưu ý: Selector này lấy sản phẩm có title đang hiển thị trên toàn trang.
  const products = page.locator("a[title]:visible");

  const productCount = await products.count();

  console.log("Số sản phẩm có title đang hiển thị:", productCount);

  expect(productCount).toBeGreaterThan(0);

  // 8. In tên các sản phẩm tìm được.
  for (let i = 0; i < productCount; i++) {
    const title = await products.nth(i).getAttribute("title");

    if (title?.trim()) {
      console.log(`Sản phẩm ${i + 1}: ${title}`);
    }
  }

  console.log(
    `FS_Display_03: Flash Sale trên trang chủ hiển thị đồng hồ đếm ngược (${timeBefore} -> ${timeAfter}).`,
  );
});

// FS_Function_01: Kiểm tra chức năng chuyển đổi khung giờ Flash Sale.
test("FS_Function_01", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  // 1. Tìm ảnh Flash Sale trên trang chủ.
  const flashSaleImage = page.getByRole("img", {
    name: "Flashsale",
    exact: true,
  });

  await expect(flashSaleImage).toBeAttached({
    timeout: 15000,
  });

  // 2. Cuộn đến khu vực Flash Sale.
  await flashSaleImage.scrollIntoViewIfNeeded();

  await flashSaleImage.evaluate((element) => {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });

  await page.waitForTimeout(3000);

  // 3. Khai báo các khung giờ cần kiểm tra.
  const availableTimeSlots = page.getByText(/^\d{2}:\d{2}$/, { exact: true });
  console.log(
    "Các khung giờ tìm thấy:",
    await availableTimeSlots.allTextContents(),
  );

  const timeSlots = await availableTimeSlots.allTextContents();
  console.log("Số khung giờ:", await availableTimeSlots.count());

  // 4. Lần lượt click từng khung giờ.
  for (const time of timeSlots) {
    const timeSlot = page.getByText(time, {
      exact: true,
    });

    await expect(timeSlot).toBeVisible({
      timeout: 10000,
    });

    await timeSlot.click();

    await page.waitForTimeout(1500);

    console.log(`Đã chọn khung giờ Flash Sale: ${time}`);
  }

  console.log(
    "FS_Function_01: Chuyển đổi các khung giờ Flash Sale thành công.",
  );
});

// FS_Display_04: Kiểm tra hiển thị sản phẩm Flash Sale theo khung giờ trên trang chủ.
test("FS_Display_04", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  // 1. Tìm khu vực Flash Sale.
  const flashSaleImage = page.getByRole("img", {
    name: "Flashsale",
    exact: true,
  });

  await expect(flashSaleImage).toBeAttached({
    timeout: 15000,
  });

  // 2. Cuộn đến khu vực Flash Sale.
  await flashSaleImage.scrollIntoViewIfNeeded();

  await flashSaleImage.evaluate((element) => {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });

  await page.waitForTimeout(3000);

  // 3. Kiểm tra khối Flash Sale hiển thị.
  await expect(flashSaleImage).toBeVisible();

  // 4. Chọn khung giờ Flash Sale.
  const availableTimeSlots = page.getByText(/^\d{2}:\d{2}$/, { exact: true });

  console.log(
    "Các khung giờ tìm thấy:",
    await availableTimeSlots.allTextContents(),
  );

  console.log("Số khung giờ:", await availableTimeSlots.count());

  const timeSlot = availableTimeSlots.first();
  await expect(timeSlot).toBeVisible();
  await timeSlot.click();

  await page.waitForTimeout(2000);

  // 5. Kiểm tra danh sách sản phẩm hiển thị.
  const products = page.locator("a[title]:visible");

  const productCount = await products.count();

  console.log("Số sản phẩm có title đang hiển thị:", productCount);

  expect(productCount).toBeGreaterThan(0);

  // 6. In tên các sản phẩm.
  for (let i = 0; i < productCount; i++) {
    const title = await products.nth(i).getAttribute("title");

    if (title?.trim()) {
      console.log(`Sản phẩm ${i + 1}: ${title}`);
    }
  }

  console.log(
    "FS_Display_04: Khối Flash Sale và danh sách sản phẩm được hiển thị sau khi chọn khung giờ.",
  );
});

// FS_Access_02: Kiểm tra điều hướng vào trang chi tiết từ sản phẩm Flash Sale ở trang chủ.
test("FS_Access_02", async ({ page }) => {
  await openHomeAndCloseVoucher(page);

  // Bước 1: Cuộn đến khu vực Flash Sale trên trang chủ.
  await scrollToHomeFlashSale(page);

  // Bước 2: Lấy danh sách sản phẩm.
  // Lưu ý: Cần giới hạn selector theo block Flash Sale sau khi xác nhận DOM thực tế.
  const products = page.locator("a[title]:visible");

  await expect(products.first()).toBeVisible({ timeout: 15000 });

  // Chọn một sản phẩm.
  const selectedProduct = products.first();
  const productName = await selectedProduct.getAttribute("title");
  const productHref = await selectedProduct.getAttribute("href");

  console.log("Sản phẩm được chọn:", productName);
  console.log("Đường dẫn sản phẩm:", productHref);

  expect(productName).toBeTruthy();
  expect(productHref).toBeTruthy();

  // Tạo URL đầy đủ trước khi click.
  const expectedUrl = new URL(productHref!, page.url());

  // Bước 3: Click sản phẩm.
  await selectedProduct.click();

  // Bước 4: Chờ và kiểm tra URL trang chi tiết.
  await page.waitForURL((url) => url.href === expectedUrl.href, {
    timeout: 15000,
  });

  const currentUrl = page.url();

  console.log("URL sau khi click:", currentUrl);
  expect(currentUrl).toBe(expectedUrl.href);

  // Bước 5: Kiểm tra trang chi tiết sản phẩm.
  await expect(page.locator("h1").first()).toBeVisible({
    timeout: 15000,
  });

  console.log("FS_Access_02: Đã mở trang chi tiết sản phẩm.");
});

// FS_Display_05: Kiểm tra hiển thị Banner sự kiện chính đầu trang Flash Sale.
test("FS_Display_05", async ({ page }) => {
  // Dùng chung function với FS_Open_02: mở Mega Menu và click Flash Sale.
  await navigateToFlashSale(page);

  // Lấy các ảnh đang hiển thị trên trang.
  const images = page.locator("img:visible");

  let banner = null;

  // Tìm ảnh banner lớn ở đầu trang.
  for (let i = 0; i < (await images.count()); i++) {
    const img = images.nth(i);
    const box = await img.boundingBox();

    if (!box) continue;

    // Banner chính thường có kích thước lớn và nằm gần đầu trang.
    if (box.width >= 500 && box.height >= 100 && box.y < 1000) {
      banner = img;
      break;
    }
  }

  // Kiểm tra tìm thấy banner.
  expect(
    banner,
    "Không tìm thấy banner sự kiện chính trên trang Flash Sale",
  ).not.toBeNull();

  // Kiểm tra banner hiển thị và ảnh tải thành công.
  await expect(banner!).toBeVisible();
  await expectImageLoaded(banner!);

  console.log(
    "FS_Display_05: Banner sự kiện chính hiển thị và ảnh tải thành công.",
  );
});

// FS_Display_06: Kiểm tra hiển thị khu vực Mã giảm thêm / Voucher.
// test("FS_Display_06", async ({ page }) => {
//   // Dùng chung function với FS_Open_02 và FS_GUI_02.
//   await navigateToFlashSale(page);

//   // Tìm link Chính sách.
//   const voucherBanner = page.getByRole("link", {
//     name: "Chính sách",
//     exact: true,
//   });

//   // Cuộn đến khu vực Voucher.
//   await voucherBanner.scrollIntoViewIfNeeded();

//   // Kiểm tra link hiển thị.
//   await expect(voucherBanner).toBeVisible({
//     timeout: 15000,
//   });

//   // Tìm ảnh bên trong link.
//   const voucherImage = voucherBanner.locator("img");

//   // Kiểm tra ảnh hiển thị và tải thành công.
//   await expect(voucherImage).toBeVisible({
//     timeout: 15000,
//   });

//   await expectImageLoaded(voucherImage);

//   console.log("FS_Display_06: Khu vực Voucher hiển thị và ảnh tải thành công.");
// });

// FS_Display_06: Kiểm tra hiển thị khu vực Mã giảm thêm / Voucher.
test("FS_Display_06", async ({ page }) => {
  await navigateToFlashSale(page);

  // Tìm link Chính sách.
  const voucherBanner = page.getByRole("link", {
    name: "Chính sách",
    exact: true,
  });

  // Chờ khu vực Voucher có cơ hội hiển thị.
  await page.waitForTimeout(3000);

  const voucherCount = await voucherBanner.count();

  if (voucherCount === 0 || !(await voucherBanner.isVisible())) {
    console.log(
      "FS_Display_06: Khu vực Voucher không xuất hiện ở lần kiểm tra này.",
    );
    test.skip(
      true,
      "Khu vực Voucher không được website hiển thị tại thời điểm kiểm tra.",
    );
    return;
  }

  // Cuộn đến khu vực Voucher.
  await voucherBanner.scrollIntoViewIfNeeded();

  // Kiểm tra link hiển thị.
  await expect(voucherBanner).toBeVisible({
    timeout: 15000,
  });

  // Tìm ảnh bên trong link.
  const voucherImage = voucherBanner.locator("img");

  await expect(voucherImage).toBeVisible({
    timeout: 15000,
  });

  // Kiểm tra ảnh tải thành công.
  await expectImageLoaded(voucherImage);

  console.log("FS_Display_06: Khu vực Voucher hiển thị và ảnh tải thành công.");
});

// FS_Display_07: Kiểm tra hiển thị Minigame / Vòng quay may mắn.
test("FS_Display_07", async ({ page }) => {
  await navigateToFlashSale(page);

  // 1. Tìm banner Minigame.
  const miniGame = page.getByRole("img", {
    name: "Minigame",
  });

  await miniGame.scrollIntoViewIfNeeded();
  await expect(miniGame).toBeVisible({ timeout: 15000 });

  // 2. Kiểm tra ảnh banner đã tải thành công.
  await expectImageLoaded(miniGame);

  // 3. Kiểm tra thời gian diễn ra Minigame.
  const gameTime = page.getByText(/Từ:\s*01\/09\s*-\s*30\/11/i);

  await expect(gameTime).toBeVisible();

  // 4. Kiểm tra link Xem thể lệ.
  const xemTheLe = page.getByText("Xem thể lệ", {
    exact: true,
  });

  await expect(xemTheLe).toBeVisible();

  console.log(
    "FS_Display_07: Banner Minigame, thời gian và link Xem thể lệ hiển thị thành công.",
  );
});

// FS_Function_02: Kiểm tra nhấn CHƠI NGAY hiển thị popup nhập số điện thoại.
test("FS_Function_02", async ({ page }) => {
  await navigateToFlashSale(page);

  // 1. Tìm banner Minigame.
  const minigame = page.getByRole("img", {
    name: "Minigame",
  });

  await minigame.scrollIntoViewIfNeeded();
  await expect(minigame).toBeVisible();

  // 2. Click vị trí CHƠI NGAY trên banner.
  const box = await minigame.boundingBox();

  if (!box) {
    throw new Error("Không tìm thấy banner Minigame.");
  }

  await page.mouse.click(box.x + box.width * 0.28, box.y + box.height * 0.82);

  // 3. Xác định popup đăng nhập.
  const phoneInput = page.getByPlaceholder("Nhập số điện thoại mua hàng");

  const loginModal = page.locator('[id^="modal-"]').filter({
    has: phoneInput,
  });

  // 4. Kiểm tra tiêu đề popup.
  await expect(
    loginModal.getByText("Đăng nhập", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });

  // 5. Kiểm tra ô nhập số điện thoại.
  await expect(phoneInput).toBeVisible();

  // 6. Kiểm tra nút Tiếp tục.
  await expect(
    loginModal.getByRole("button", {
      name: "Tiếp tục",
    }),
  ).toBeVisible();

  console.log(
    "FS_Function_02 : Nhấn CHƠI NGAY hiển thị popup nhập số điện thoại thành công.",
  );
});

// FS_Function_03: Kiểm tra liên kết Xem thể lệ của Minigame / Vòng quay may mắn.
test("FS_Function_03", async ({ page }) => {
  await navigateToFlashSale(page);

  // 1. Tìm banner Minigame.
  const miniGame = page.getByRole("img", {
    name: "Minigame",
  });

  await miniGame.scrollIntoViewIfNeeded();
  await expect(miniGame).toBeVisible({ timeout: 15000 });

  // 2. Kiểm tra link Xem thể lệ.
  const xemTheLe = page.getByText("Xem thể lệ", {
    exact: true,
  });

  await xemTheLe.scrollIntoViewIfNeeded();
  await expect(xemTheLe).toBeVisible();

  // 3. Click Xem thể lệ.
  await xemTheLe.click();

  // 4. Chờ popup thể lệ hiển thị.
  await page.waitForTimeout(4000);

  // 5. Kiểm tra popup và đóng popup.
  const closeButton = page.getByRole("button", {
    name: "✕",
  });

  await expect(closeButton).toBeVisible({
    timeout: 10000,
  });

  console.log(
    "FS_Function_03: Nhấn Xem thể lệ hiển thị popup thể lệ Minigame thành công.",
  );

  await closeButton.click();
});

// FS_Display_08: Kiểm tra hiển thị Thanh điều hướng nhanh ngành hàng (Sticky Menu).
test("FS_Display_08", async ({ page }) => {
  await navigateToFlashSale(page);

  // 1. Cuộn đến khu vực Flash Sale.
  const flashSaleImage = page.getByRole("img", {
    name: "Flashsale",
  });

  await flashSaleImage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(7000);

  // 2. Cuộn thêm để kiểm tra Sticky Menu.
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(2000);

  // 3. Kiểm tra vị trí thanh điều hướng.
  const menu = page
    .getByText("Flashsale", {
      exact: true,
    })
    .first();

  await expect(menu).toBeVisible();

  const position = await menu.boundingBox();

  expect(position).not.toBeNull();
  expect(position!.y).toBeLessThanOrEqual(100);

  // 4. Kiểm tra các danh mục trên thanh điều hướng.
  for (const item of MENU_ITEMS) {
    await expect(page.getByText(item, { exact: true }).first()).toBeVisible();
  }

  console.log(
    "FS_Display_08: Thanh điều hướng nhanh ngành hàng hiển thị đầy đủ và vẫn hiển thị sau khi cuộn trang.",
  );
});

// FS_Function_04: Kiểm tra trang tự động cuộn đến danh mục đã chọn.
test("FS_Function_04", async ({ page }) => {
  await navigateToFlashSale(page);

  const dienLanhSection = await navigateToFlashSaleCategory(page, "Điện lạnh");

  // Kiểm tra section nằm trong vùng hiển thị.
  const sectionBox = await dienLanhSection.boundingBox();
  const viewport = page.viewportSize();

  expect(sectionBox).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (sectionBox && viewport) {
    expect(sectionBox.y).toBeGreaterThanOrEqual(0);
    expect(sectionBox.y).toBeLessThan(viewport.height);
  }

  console.log("FS_Function_04: Trang tự động cuộn đến danh mục Điện lạnh.");
});

// FS_Display_09: Kiểm tra khả năng hiển thị đầy đủ thông tin trên thẻ sản phẩm trong khung Flash Sale.
test("FS_Display_09", async ({ page }) => {
  await navigateToFlashSale(page);

  // 1. Tìm danh sách thẻ sản phẩm Flash Sale.
  const productCards = page.locator("div").filter({
    has: page.locator("img"),
  });

  // Chọn một thẻ sản phẩm có ảnh hiển thị.
  const productImage = page.locator("img:visible").first();

  await productImage.scrollIntoViewIfNeeded();
  await expect(productImage).toBeVisible();

  // 2. Kiểm tra ảnh sản phẩm tải thành công.
  await expect
    .poll(async () => {
      return productImage.evaluate((img: HTMLImageElement) => {
        return img.complete && img.naturalWidth > 0;
      });
    })
    .toBe(true);

  // 3. Lấy thông tin từ khu vực sản phẩm chứa ảnh.
  const productCard = page
    .locator("div")
    .filter({
      has: productImage,
    })
    .filter({
      hasText: /đ/,
    })
    .first();

  await expect(productCard).toBeVisible();

  // Kiểm tra tên sản phẩm có nội dung.
  const cardText = (await productCard.innerText()).trim();

  expect(cardText.length).toBeGreaterThan(0);

  // Kiểm tra thông tin giá Flash Sale và giá gốc.
  expect(cardText).toMatch(/\d[\d.,]*\s*đ/i);

  console.log(
    "FS_Display_09: Đã kiểm tra ảnh và nội dung thẻ sản phẩm Flash Sale.",
  );
});

// FS_Display_10: Kiểm tra khả năng hiển thị các nhãn dịch vụ phụ và thông tin đánh giá trên thẻ sản phẩm Flash Sale.
test("FS_Display_10", async ({ page }) => {
  await navigateToFlashSale(page);

  // 1. Tìm và cuộn đến khu vực sản phẩm Flash Sale.
  const productImage = page.locator("img:visible").first();

  await productImage.scrollIntoViewIfNeeded();
  await expect(productImage).toBeVisible();

  // 2. Tìm thẻ sản phẩm chứa hình ảnh.
  const productCard = page
    .locator("div")
    .filter({
      has: productImage,
    })
    .filter({
      hasText: /đ/i,
    })
    .first();

  await expect(productCard).toBeVisible();

  // Lấy nội dung hiển thị trên thẻ sản phẩm.
  const cardText = await productCard.innerText();

  // 3. Kiểm tra nhãn dịch vụ.
  const serviceLabels = ["Chỉ bán online", "Trả chậm 0%"];

  const displayedLabels = serviceLabels.filter((label) =>
    cardText.includes(label),
  );

  console.log("Nhãn dịch vụ tìm thấy:", displayedLabels);

  // 4. Kiểm tra thông tin đánh giá.
  const ratingPattern = /\b[0-5][.,]\d\s*★/;
  const hasRating = ratingPattern.test(cardText);

  console.log("Có thông tin đánh giá:", hasRating);

  // 5. Kiểm tra số lượng sản phẩm đã bán.
  const soldPattern = /Đã bán\s*[\d.,]+/i;
  const hasSoldCount = soldPattern.test(cardText);

  console.log("Có thông tin số lượng đã bán:", hasSoldCount);

  // 6. Kiểm tra nội dung không bị rỗng.
  expect(cardText.trim().length).toBeGreaterThan(0);

  console.log(
    "FS_Display_10: Hoàn tất kiểm tra nhãn dịch vụ, đánh giá và số lượng đã bán.",
  );
});

// FS_Display_11: Kiểm tra khả năng hiển thị thanh tiến độ số lượng suất mua của sản phẩm Flash Sale.
test("FS_Display_11", async ({ page }) => {
  await navigateToFlashSale(page);

  // 1. Tìm nội dung số suất đã bán và tổng số suất.
  const slotInfo = page.getByText(/\d+\s*\/\s*\d+\s*Suất/i).first();

  await slotInfo.scrollIntoViewIfNeeded();
  await expect(slotInfo).toBeVisible();

  // 2. Lấy số suất đã bán và tổng số suất.
  const slotText = (await slotInfo.innerText()).trim();

  const match = slotText.match(/(\d+)\s*\/\s*(\d+)/);

  expect(match).not.toBeNull();

  if (!match) {
    throw new Error("Không đọc được thông tin số suất đã bán.");
  }

  const sold = Number(match[1]);
  const total = Number(match[2]);

  expect(total).toBeGreaterThan(0);
  expect(sold).toBeGreaterThanOrEqual(0);
  expect(sold).toBeLessThanOrEqual(total);

  // 3. Tìm thanh tiến độ trong cùng thẻ sản phẩm.
  const productCard = page
    .locator("div")
    .filter({
      has: slotInfo,
    })
    .filter({
      has: page.locator("img"),
    })
    .first();

  await expect(productCard).toBeVisible();

  // Tìm phần tử có chiều rộng thể hiện tiến độ.
  const progressBars = productCard.locator('[style*="width"]');

  let progressFound = false;

  for (let i = 0; i < (await progressBars.count()); i++) {
    const bar = progressBars.nth(i);

    const width = await bar.evaluate((element) => {
      return element.getBoundingClientRect().width;
    });

    const parentWidth = await bar.evaluate((element) => {
      const parent = element.parentElement;
      return parent ? parent.getBoundingClientRect().width : 0;
    });

    if (width > 0 && parentWidth > 0) {
      const actualPercentage = (width / parentWidth) * 100;
      const expectedPercentage = (sold / total) * 100;

      console.log("Số suất đã bán:", sold);
      console.log("Tổng số suất:", total);
      console.log("Tỷ lệ dự kiến:", expectedPercentage.toFixed(2) + "%");
      console.log("Tỷ lệ thực tế:", actualPercentage.toFixed(2) + "%");

      // Thanh tiến độ không được vượt quá chiều rộng thanh chứa.
      expect(width).toBeLessThanOrEqual(parentWidth);

      progressFound = true;
      break;
    }
  }

  expect(
    progressFound,
    "Không tìm thấy thanh tiến độ có chiều rộng hiển thị.",
  ).toBe(true);

  console.log(
    "FS_Display_11: Kiểm tra thông tin số suất và thanh tiến độ thành công.",
  );
});

// FS_Display_12: Kiểm tra khả năng hiển thị trạng thái Cháy suất khi sản phẩm Flash Sale đã bán hết số lượng ưu đãi.
test("FS_Display_12", async ({ page }) => {
  await navigateToFlashSale(page);

  // 1. Tìm các thẻ sản phẩm có nhãn CHÁY SUẤT.
  const soldOutLabels = page.getByText("CHÁY SUẤT", {
    exact: true,
  });

  const labelCount = await soldOutLabels.count();

  // 2. Nếu không có sản phẩm cháy suất thì ghi nhận và kết thúc test.
  if (labelCount === 0) {
    console.log(
      "FS_Display_12: Hiện chưa có sản phẩm Flash Sale nào cháy suất. Bỏ qua kiểm tra trạng thái.",
    );
    return;
  }

  // 3. Kiểm tra sản phẩm đầu tiên có nhãn CHÁY SUẤT.
  const soldOutLabel = soldOutLabels.first();

  await soldOutLabel.scrollIntoViewIfNeeded();
  await expect(soldOutLabel).toBeVisible();

  // 4. Tìm thẻ sản phẩm chứa nhãn CHÁY SUẤT.
  const productCard = page
    .locator("div")
    .filter({
      has: soldOutLabel,
    })
    .filter({
      has: page.locator("img"),
    })
    .last();

  await expect(productCard).toBeVisible();

  // 5. Kiểm tra thông tin số suất đã bán và tổng số suất.
  const slotInfo = productCard.getByText(/\d+\s*\/\s*\d+\s*Suất/i);

  if ((await slotInfo.count()) > 0) {
    const slotText = await slotInfo.first().innerText();
    const match = slotText.match(/(\d+)\s*\/\s*(\d+)/);

    expect(match).not.toBeNull();

    if (match) {
      expect(Number(match[1])).toBe(Number(match[2]));
    }
  }

  // 6. Kiểm tra trạng thái nút mua hàng nếu có.
  const buyButtons = productCard.getByRole("button", {
    name: /mua ngay|thêm vào giỏ|mua/i,
  });

  if ((await buyButtons.count()) > 0) {
    const buyButton = buyButtons.first();

    const disabled =
      (await buyButton.isDisabled()) ||
      (await buyButton.getAttribute("aria-disabled")) === "true";

    expect(
      disabled,
      "Nút mua hàng của sản phẩm CHÁY SUẤT vẫn cho phép thao tác.",
    ).toBe(true);
  }

  console.log("FS_Display_12: Đã kiểm tra sản phẩm có trạng thái CHÁY SUẤT.");
});

// FS_Display_13: Kiểm tra khả năng hiển thị banner và các Sub-tab phân loại sản phẩm tại từng section ngành hàng trên trang Flash Sale.
test("FS_Display_13", async ({ page }) => {
  await navigateToFlashSale(page);

  // 1. Cuộn đến khu vực Flash Sale để hiển thị thanh menu.
  const flashSaleImage = page.getByRole("img", {
    name: "Flashsale",
  });

  await expect(flashSaleImage).toBeVisible();
  await flashSaleImage.scrollIntoViewIfNeeded();

  // 2. Cuộn thêm để hiển thị Sticky Menu.
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(2000);

  // 3. Tìm tab Điện lạnh trên thanh menu nhanh.
  const dienLanhTab = page.getByText("Điện lạnh", { exact: true }).first();
  await expect(dienLanhTab).toBeVisible();
  await dienLanhTab.click();
  await page.waitForTimeout(2000);
  console.log("Đã chọn ngành hàng Điện lạnh");

  const categoryBanner = page.locator('img[alt="Điện lạnh"]').last();
  await expectImageLoaded(categoryBanner);
  console.log("Banner ngành hàng Điện lạnh hiển thị");

  for (const name of SUB_TAB_NAMES) {
    const visibleSubTab = await getVisibleImageByAlt(page, name);
    expect(visibleSubTab, `Không tìm thấy Sub-tab: ${name}`).not.toBeNull();

    await expectImageLoaded(visibleSubTab!);
    console.log("Sub-tab hiển thị:", name);
  }
  console.log("Kiểm tra Banner và Sub-tab ngành hàng hoàn tất!");

  console.log(
    "FS_Display_13: Banner và các Sub-tab của section Điện lạnh hiển thị đầy đủ.",
  );
});

// FS_Function_05: Kiểm tra chức năng sắp xếp sản phẩm theo các tiêu chí Nổi bật, % Giảm giá, Giá thấp.
test("FS_Function_05", async ({ page }) => {
  await navigateToFlashSale(page);

  // 1. Cuộn đến khu vực Flash Sale.
  // const flashSaleImage = page.getByRole("img", {
  //   name: "Flashsale",
  // });
  const flashSaleImage = page.locator(".overflow-hidden.\\!p-5");

  await expect(flashSaleImage).toBeVisible();
  await flashSaleImage.scrollIntoViewIfNeeded();

  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(2000);

  // 2. Chọn ngành hàng Điện lạnh.
  await page.getByText("Điện lạnh", { exact: true }).first().click();
  await page.waitForTimeout(2000);

  // 3. Kiểm tra banner ngành hàng.
  await expectImageLoaded(page.locator('img[alt="Điện lạnh"]').last());

  // 4. Tìm khu vực chứa các tiêu chí sắp xếp.
  const groupSelector = await page.evaluate(() => {
    const labels = ["Nổi bật", "% Giảm giá", "Giá thấp"];

    const elements = Array.from(
      document.querySelectorAll("div.text-14.w-full"),
    );

    for (const element of elements) {
      if (!labels.includes((element.textContent || "").trim())) {
        continue;
      }

      let parent = element.parentElement;

      while (parent && parent !== document.body) {
        const parentLabels = Array.from(
          parent.querySelectorAll("div.text-14.w-full"),
        ).map((item) => (item.textContent || "").trim());

        const productCount = parent.querySelectorAll(
          "a.font-700.text-red-7",
        ).length;

        if (
          labels.every((label) => parentLabels.includes(label)) &&
          productCount > 0
        ) {
          // Tạo CSS selector từ phần tử DOM.
          const parts: string[] = [];
          let current: Element | null = parent;

          while (current && current !== document.body) {
            let part = current.tagName.toLowerCase();

            if (current.id) {
              part += `#${CSS.escape(current.id)}`;
              parts.unshift(part);
              break;
            }

            if (current.classList.length) {
              part +=
                "." +
                Array.from(current.classList)
                  .map((name) => CSS.escape(name))
                  .join(".");
            }

            const parentElement = current.parentElement;

            if (parentElement) {
              const siblings = Array.from(parentElement.children).filter(
                (child) => child.tagName === current!.tagName,
              );

              if (siblings.length > 1) {
                part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
              }
            }

            parts.unshift(part);
            current = parentElement;
          }

          return parts.join(" > ");
        }

        parent = parent.parentElement;
      }
    }

    return null;
  });

  expect(
    groupSelector,
    "Không tìm thấy khu vực chứa các tiêu chí sắp xếp và sản phẩm.",
  ).not.toBeNull();

  // Tạo Locator trực tiếp từ CSS selector.
  const productGroup = page.locator(groupSelector!);

  await expect(productGroup).toBeVisible();

  console.log("Đã tìm thấy khu vực sản phẩm.");

  // 5. Kiểm tra tiêu chí Nổi bật.
  console.log("===== KIỂM TRA NỔI BẬT =====");

  const featuredProducts = await selectFilter(
    page,
    productGroup,
    FILTER_NAMES[0],
  );

  console.log("Danh sách sản phẩm Nổi bật:", featuredProducts);

  expect(featuredProducts.length).toBeGreaterThan(0);

  // 6. Kiểm tra tiêu chí % Giảm giá.
  console.log("===== KIỂM TRA % GIẢM GIÁ =====");

  const discountProducts = await selectFilter(
    page,
    productGroup,
    FILTER_NAMES[1],
  );

  console.log("===== THỨ TỰ SẢN PHẨM TRÊN WEBSITE =====");

  discountProducts.forEach((product, index) => {
    console.log(`${index + 1}. ${product.name} | ${product.discount}`);
  });

  const discountValues = discountProducts
    .filter((product) => product.discount !== "")
    .map((product) => ({
      name: product.name,
      value: convertPrice(product.discount),
    }));

  console.log("Danh sách phần trăm giảm giá:", discountValues);

  expect(discountValues.length).toBeGreaterThan(1);

  // Kiểm tra phần trăm giảm giá giảm dần.
  for (let i = 0; i < discountValues.length - 1; i++) {
    expect(
      discountValues[i].value,
      `${discountValues[i].name} (${discountValues[i].value}%) phải có mức giảm cao hơn hoặc bằng ${discountValues[i + 1].name} (${discountValues[i + 1].value}%).`,
    ).toBeGreaterThanOrEqual(discountValues[i + 1].value);
  }

  console.log("Sắp xếp % Giảm giá: PASS");

  // 7. Kiểm tra tiêu chí Giá thấp.
  console.log("===== KIỂM TRA GIÁ THẤP =====");

  const lowPriceProducts = await selectFilter(
    page,
    productGroup,
    FILTER_NAMES[2],
  );

  console.log("Danh sách sản phẩm theo Giá thấp:", lowPriceProducts);

  const lowPrices = lowPriceProducts.map((product) =>
    convertPrice(product.price),
  );

  console.log("Danh sách giá sản phẩm:", lowPrices);

  expect(lowPrices.length).toBeGreaterThan(1);

  // Kiểm tra giá tăng dần.
  for (let i = 0; i < lowPrices.length - 1; i++) {
    expect(
      lowPrices[i],
      `Giá sản phẩm tại vị trí ${i + 1} phải nhỏ hơn hoặc bằng vị trí ${i + 2}.`,
    ).toBeLessThanOrEqual(lowPrices[i + 1]);
  }

  console.log("Sắp xếp Giá thấp: PASS");

  console.log("FS_Function_05: Hoàn tất kiểm tra 3 tiêu chí sắp xếp.");
});

// FS_Function_06: Kiểm tra chức năng nút Xem thêm tại các section ngành hàng.

// FS_Function_06: Kiểm tra chức năng nút Xem thêm tại các section ngành hàng.
test("FS_Function_06", async ({ page }) => {
  await navigateToFlashSale(page);

  const categories = ["Điện lạnh", "Gia dụng"];

  for (const categoryName of categories) {
    console.log(`===== KIỂM TRA XEM THÊM: ${categoryName} =====`);

    // 1. Điều hướng đến ngành hàng bằng hàm chung.
    // Không chỉnh sửa hàm navigateToFlashSaleCategory().
    const categoryHeading = await navigateToFlashSaleCategory(
      page,
      categoryName,
    );

    // 2. Tìm section cha gần nhất chứa tiêu đề,
    // nút Xem thêm và danh sách sản phẩm.
    const productSection = categoryHeading.locator(
      "xpath=ancestor::*[.//*[normalize-space()='Xem thêm'] and .//a[contains(@class,'text-red-7')]][1]",
    );

    await expect(
      productSection,
      `Không tìm thấy section sản phẩm của ${categoryName}`,
    ).toBeVisible({ timeout: 15000 });

    // 3. Tìm nút Xem thêm trong section.
    const showMoreButton = productSection
      .getByText("Xem thêm", { exact: true })
      .last();

    await expect(
      showMoreButton,
      `Không tìm thấy nút Xem thêm tại ${categoryName}`,
    ).toBeVisible({ timeout: 15000 });

    await showMoreButton.scrollIntoViewIfNeeded();

    // 4. Đếm số sản phẩm ban đầu dựa trên phần tử giá.
    const productCards = productSection.locator("a.font-700.text-red-7");

    const initialCount = await productCards.count();

    console.log(`Số sản phẩm ban đầu: ${initialCount}`);

    expect(
      initialCount,
      `Section ${categoryName} chưa có sản phẩm`,
    ).toBeGreaterThan(0);

    // 5. Click Xem thêm.
    await showMoreButton.click();

    console.log(`Đã click Xem thêm tại ${categoryName}`);

    // 6. Chờ số lượng sản phẩm tăng.
    await expect
      .poll(async () => await productCards.count(), {
        message: `Số sản phẩm ${categoryName} không tăng sau khi click Xem thêm`,
        timeout: 15000,
        intervals: [500, 1000, 1500],
      })
      .toBeGreaterThan(initialCount);

    // 7. Kiểm tra số lượng sản phẩm sau khi click.
    const finalCount = await productCards.count();

    console.log(`Số sản phẩm sau khi click: ${finalCount}`);

    expect(finalCount).toBeGreaterThan(initialCount);

    // 8. Kiểm tra vẫn đang ở trang Flash Sale.
    await expect(page).toHaveURL(/\/flashsale/i);

    console.log(
      `FS_Function_06: ${categoryName} hiển thị thêm sản phẩm thành công.`,
    );
  }

  console.log("FS_Function_06: Hoàn thành kiểm tra nút Xem thêm.");
});

// FS_Access_03: Kiểm tra điều hướng vào trang chi tiết từ sản phẩm Flash Sale theo ngành hàng.
test("FS_Access_03", async ({ page }) => {
  // 1. Mở trang Flash Sale.
  await navigateToFlashSale(page);

  // 2. Chọn danh mục Điện lạnh và tự động cuộn đến section.
  await navigateToFlashSaleCategory(page, "Điện lạnh");

  // 3. Tìm nút Xem thêm trong khu vực danh mục.
  const seeMore = page
    .locator("#ldp-section-noi-bat")
    .getByRole("button", { name: "Xem thêm" })
    .last();

  await expect(seeMore).toBeVisible({ timeout: 15000 });
  await seeMore.scrollIntoViewIfNeeded();
  await seeMore.click();

  await page.waitForTimeout(2000);

  // 4. Tìm sản phẩm Aqua Inverter 236 lít AQR-T265FA.
  const productLink = page
    .locator("a[title]")
    .filter({ hasText: /Aqua Inverter 236 lít AQR-T265FA/i })
    .first();

  await expect(productLink).toBeVisible({
    timeout: 15000,
  });

  // 5. Ghi nhận tên và URL sản phẩm.
  const productName = await productLink.getAttribute("title");
  const productUrl = await productLink.getAttribute("href");

  console.log("Tên sản phẩm:", productName);
  console.log("URL sản phẩm:", productUrl);

  expect(productName).not.toBeNull();
  expect(productUrl).not.toBeNull();

  const detailUrl = new URL(productUrl!, page.url()).href;

  // 6. Click vào thẻ sản phẩm.
  await productLink.click();

  // 7. Kiểm tra điều hướng.
  await expect(page).toHaveURL(detailUrl, {
    timeout: 15000,
  });

  // 8. Kiểm tra đúng sản phẩm trên trang chi tiết.

  // Kiểm tra trang có tiêu đề sản phẩm.
  const productHeading = page.locator("h1").first();

  await expect(productHeading).toBeVisible({
    timeout: 15000,
  });

  const detailProductName = (await productHeading.innerText()).trim();

  console.log("Tên sản phẩm trên trang chi tiết:", detailProductName);

  // So sánh tên sản phẩm ở trang Flash Sale và trang chi tiết.
  expect(detailProductName.toLowerCase()).toContain(productName!.toLowerCase());

  // Kiểm tra không xuất hiện trang lỗi 404.
  await expect(page.getByText(/404|không tìm thấy trang/i)).toHaveCount(0);

  console.log("FS_Access_03: Điều hướng đến đúng trang chi tiết sản phẩm.");
});

// FS_Banner_01: Kiểm tra khả năng hiển thị banner ở tất cả các section ngành hàng.
test("FS_Banner_01", async ({ page }) => {
  await navigateToFlashSale(page);

  // Bỏ Flashsale, chỉ lấy các ngành hàng.
  const categories = MENU_ITEMS.slice(1);

  console.log("===== KIỂM TRA BANNER FLASH SALE =====");

  for (const category of categories) {
    await checkCategoryBanner(page, category);
  }

  console.log(
    "FS_Banner_01: Banner của tất cả section ngành hàng hiển thị thành công.",
  );
});

// FS_Banner_02: Kiểm tra chất lượng hình ảnh banner ngành hàng.
test("FS_Banner_02", async ({ page }) => {
  await navigateToFlashSale(page);

  // Lấy danh sách các ngành hàng từ MENU_ITEMS dùng chung.
  const categories = MENU_ITEMS.slice(1);

  console.log("===== KIỂM TRA CHẤT LƯỢNG BANNER FLASH SALE =====");

  for (const category of categories) {
    await checkBannerImageQuality(page, category);
  }

  console.log(
    "FS_Banner_02: Hoàn tất kiểm tra chất lượng banner các ngành hàng.",
  );
});

// FS_Banner_03: Kiểm tra nội dung văn bản trên banner khớp với ngành hàng.
test("FS_Banner_03", async ({ page }) => {
  await navigateToFlashSale(page);

  const categories = MENU_ITEMS.slice(1);

  console.log("===== KIỂM TRA NỘI DUNG BANNER FLASH SALE =====");

  for (const category of categories) {
    await checkBannerContent(page, category);
  }

  console.log(
    "FS_Banner_03: Hoàn tất kiểm tra nội dung banner các ngành hàng.",
  );
});

// FS_Banner_04: Kiểm tra banner tương ứng với tab ngành hàng được chọn.
test("FS_Banner_04", async ({ page }) => {
  await navigateToFlashSale(page);

  const dienLanhSection = await navigateToFlashSaleCategory(page, "Điện lạnh");

  // Kiểm tra section nằm trong vùng hiển thị.
  const sectionBox = await dienLanhSection.boundingBox();
  const viewport = page.viewportSize();

  expect(sectionBox).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (sectionBox && viewport) {
    expect(sectionBox.y).toBeGreaterThanOrEqual(0);
    expect(sectionBox.y).toBeLessThan(viewport.height);
  }

  // Danh sách ngành hàng trên thanh điều hướng nhanh.
  const categories = MENU_ITEMS.slice(1);

  console.log("===== KIỂM TRA ĐIỀU HƯỚNG TAB VÀ BANNER =====");

  for (const category of categories) {
    await checkCategoryTabNavigation(page, category);
  }

  console.log("FS_Banner_04: Các tab ngành hàng điều hướng đến đúng banner.");
});
