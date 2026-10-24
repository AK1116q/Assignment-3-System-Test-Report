const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const STORE_URL = 'https://opencart.abstracta.us';
const EVIDENCE_DIR = path.join(__dirname, 'evidence-abstracta');
const results = [];

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function pageUrl(route, parameters = {}) {
  const query = new URLSearchParams({ route, ...parameters });
  return `${STORE_URL}/index.php?${query}`;
}

async function openPage(page, url) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

async function newTestPage(browser) {
  // Each function starts with its own browser session.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  return { context, page };
}

async function runScenario(testCase, scenario, description, expected, page, action, captureScreenshot = true) {
  const started = Date.now();
  const screenshot = `${testCase}-${scenario}.png`;
  let status = 'PASS';
  let actual;

  try {
    actual = await action();
    if (captureScreenshot) {
      await page.screenshot({ path: path.join(EVIDENCE_DIR, screenshot), fullPage: true });
    }
  } catch (error) {
    status = 'FAIL';
    actual = error.message;
  }

  results.push({
    testCase,
    scenario,
    description,
    expected,
    actual,
    status,
    screenshot: status === 'PASS' && captureScreenshot ? screenshot : null,
    durationMs: Date.now() - started,
  });
  console.log(`${testCase}-${scenario}: ${status} - ${actual}`);
}

async function testProductSearch(browser) {
  const { context, page } = await newTestPage(browser);
  try {
    await runScenario(
      'T001', 'S1', 'Search for iPhone',
      'An iPhone product is displayed.', page,
      async () => {
        await openPage(page, pageUrl('product/search', { search: 'iPhone' }));
        const names = await page.locator('.product-thumb h4 a').allTextContents();
        assert(names.includes('iPhone'), 'The iPhone product was not found.');
        return `Found ${names.length} result(s), including iPhone.`;
      }
    );

    await runScenario(
      'T001', 'S2', 'Search using the partial keyword Mac',
      'One or more Mac-related products are displayed.', page,
      async () => {
        await openPage(page, pageUrl('product/search', { search: 'Mac' }));
        const names = await page.locator('.product-thumb h4 a').allTextContents();
        assert(names.length > 0, 'The search returned no products.');
        assert(names.every((name) => /mac/i.test(name)), 'A result did not match Mac.');
        return `Found ${names.length} Mac-related products: ${names.join(', ')}.`;
      }
    );

    await runScenario(
      'T001', 'S3', 'Search for a product that does not exist',
      'No product cards are displayed.', page,
      async () => {
        await openPage(page, pageUrl('product/search', { search: 'zzzz-no-product-2026' }));
        const count = await page.locator('.product-thumb').count();
        assert.equal(count, 0, `Expected no products, found ${count}.`);
        return 'The result list contained no products.';
      }
    );
  } finally {
    await context.close();
  }
}

async function testShoppingCart(browser) {
  const { context, page } = await newTestPage(browser);
  const quantity = page.locator('#content input[name^="quantity"]');

  try {
    await runScenario(
      'T002', 'S1', 'Add one iPhone to an empty cart',
      'The cart contains one iPhone with a $123.20 total.', page,
      async () => {
        await openPage(page, pageUrl('product/product', { product_id: '40' }));
        // Wait for the AJAX update before opening the cart page.
        const added = page.waitForResponse((response) =>
          response.url().includes('route=checkout/cart/add')
        );
        await page.locator('#button-cart').click();
        const response = await added;
        assert.equal(response.status(), 200);
        assert.match((await response.json()).success || '', /added.*iPhone/i);

        await openPage(page, pageUrl('checkout/cart'));
        assert.equal(await quantity.inputValue(), '1');
        const content = await page.locator('#content').innerText();
        assert.match(content, /iPhone/);
        assert.match(content, /\$123\.20/);
        return 'The cart showed one iPhone and a $123.20 total.';
      }
    );

    await runScenario(
      'T002', 'S2', 'Change the iPhone quantity to two',
      'The cart shows quantity two and a $246.40 total.', page,
      async () => {
        await quantity.fill('2');
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'commit', timeout: 60000 }),
          page.locator('#content button[data-original-title="Update"]').click(),
        ]);
        await openPage(page, pageUrl('checkout/cart'));
        assert.equal(await quantity.inputValue(), '2');
        assert.match(await page.locator('#content').innerText(), /\$246\.40/);
        return 'The cart showed quantity two and a $246.40 total.';
      }
    );

    await runScenario(
      'T002', 'S3', 'Remove the iPhone from the cart',
      'The cart becomes empty.', page,
      async () => {
        const removed = page.waitForResponse((response) =>
          response.url().includes('route=checkout/cart/remove')
        );
        await page.locator('#content button[data-original-title="Remove"]').click();
        const response = await removed;
        assert.equal(response.status(), 200);
        await openPage(page, pageUrl('checkout/cart'));
        await page.locator('#content').getByText('Your shopping cart is empty!').waitFor();
        assert.equal(await quantity.count(), 0);
        return 'The empty-cart message appeared and no quantity field remained.';
      }
    );
  } finally {
    await context.close();
  }
}

async function fillRegistration(page, email) {
  await page.locator('#input-firstname').fill('Test');
  await page.locator('#input-lastname').fill('Student');
  await page.locator('#input-email').fill(email);
  await page.locator('#input-telephone').fill('0400000000');
  await page.locator('#input-password').fill('StudyTest123!');
  await page.locator('#input-confirm').fill('StudyTest123!');
  await page.locator('input[name="agree"]').check();
}

async function submitRegistration(page, waitForPage = true) {
  const submit = page.locator('input[type="submit"][value="Continue"]');
  if (waitForPage) {
    const response = page.waitForResponse((result) =>
      result.request().method() === 'POST' &&
      new URL(result.url()).searchParams.get('route') === 'account/register',
      { timeout: 60000 }
    );
    await submit.click({ noWaitAfter: true });
    await response;
  } else {
    await submit.click({ noWaitAfter: true });
  }
}

async function testRegistration(browser) {
  const { context, page } = await newTestPage(browser);
  // The demo store keeps registered emails, so every run needs a new address.
  const email = `assignment3.${Date.now()}.${randomUUID().slice(0, 8)}@example.com`;

  try {
    await runScenario(
      'T003', 'S1', 'Register with valid information',
      'The store creates a new account.', page,
      async () => {
        await openPage(page, pageUrl('account/register'));
        await fillRegistration(page, email);
        await submitRegistration(page, false);
        // This demo redirects to an HTTP success page that may not finish loading.
        await page.waitForURL(/route=account\/success/, { waitUntil: 'commit', timeout: 60000 });
        return `Registration redirected to account/success for ${email}.`;
      }, false
    );

    await runScenario(
      'T003', 'S2', 'Register again with the same email',
      'The store rejects the duplicate email.', page,
      async () => {
        await openPage(page, pageUrl('account/logout'));
        await openPage(page, pageUrl('account/register'));
        await fillRegistration(page, email);
        await submitRegistration(page);
        const warning = page.locator('.alert-danger');
        await warning.waitFor();
        assert.match(await warning.innerText(), /E-Mail Address is already registered/i);
        return 'The duplicate-email warning was displayed.';
      }
    );

    await runScenario(
      'T003', 'S3', 'Submit the form with required fields blank',
      'Five field-validation messages are displayed.', page,
      async () => {
        await openPage(page, pageUrl('account/register'));
        await page.locator('input[name="agree"]').check();
        await submitRegistration(page);
        await page.locator('#content .text-danger').first().waitFor();
        const errors = await page.locator('#content .text-danger').allTextContents();
        assert.equal(errors.length, 5, `Expected five field errors, found ${errors.length}.`);
        return `${errors.length} field-validation messages were displayed.`;
      }
    );
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const tests = {
    T001: testProductSearch,
    T002: testShoppingCart,
    T003: testRegistration,
  };
  const selected = process.env.TEST_CASE;
  if (selected && !tests[selected]) throw new Error(`Unknown TEST_CASE: ${selected}`);
  try {
    for (const [id, test] of Object.entries(tests)) {
      if (!selected || selected === id) await test(browser);
    }
  } finally {
    await browser.close();
  }

  const report = {
    website: STORE_URL,
    executedAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((result) => result.status === 'PASS').length,
    failed: results.filter((result) => result.status === 'FAIL').length,
    results,
  };
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Completed: ${report.passed}/${report.total} passed.`);
  if (report.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
