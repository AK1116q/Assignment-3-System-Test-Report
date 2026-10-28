const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const STORE_URL = 'https://opencart.abstracta.us';
const OUTPUT_DIR = path.join(__dirname, 'run-output');
const results = [];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Build a store URL from an OpenCart route and its query parameters.
function pageUrl(route, parameters = {}) {
  return `${STORE_URL}/index.php?${new URLSearchParams({ route, ...parameters })}`;
}

// Retry once when the demo site does not load its main content.
async function openPage(page, route, parameters = {}) {
  const url = pageUrl(route, parameters);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.locator('#content').waitFor({ timeout: 20000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  }
}

// Give each scenario a fresh session and save its status and screenshot.
async function runScenario(browser, testCase, scenario, description, expected, action) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const started = Date.now();
  let status = 'PASS';
  let actual = '';
  let screenshot = null;

  try {
    actual = await action(page);
  } catch (error) {
    status = error.code === 'ERR_ASSERTION' ? 'FAIL' : 'ERROR';
    actual = error.message;
  }

  try {
    const filename = `${testCase}-${scenario}${status === 'PASS' ? '' : '-error'}.png`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: true, timeout: 10000 });
    screenshot = filename;
  } catch (error) {
    actual += ` Screenshot unavailable: ${error.message}`;
  }

  await context.close();
  const result = {
    testCase,
    scenario,
    description,
    expected,
    actual,
    status,
    screenshot,
    durationMs: Date.now() - started,
  };
  results.push(result);
  console.log(`${testCase}-${scenario}: ${status} - ${actual}`);
}

// Add a product using the Compare button on its category card.
async function addToComparison(page, productName) {
  await openPage(page, 'product/category', { path: '20' });
  const card = page.locator('.product-thumb').filter({
    has: page.locator('h4 a', { hasText: productName }),
  }).first();
  assert.equal(await card.count(), 1, `${productName} was not listed in Desktops.`);

  const added = page.waitForResponse((response) =>
    new URL(response.url()).searchParams.get('route') === 'product/compare/add',
    { timeout: 30000 }
  );
  await card.locator('button[data-original-title="Compare this Product"]').click();
  const response = await added;
  assert.equal(response.status(), 200);
  const data = await response.json();
  assert.match(data.success || '', /product comparison/i);
  assert.match(data.success, new RegExp(productName, 'i'));
}

// T004: check an empty list, compare two products, then remove one.
async function testComparison(browser) {
  await runScenario(
    browser, 'T004', 'S1', 'Open an empty comparison list',
    'The comparison page contains no product table.',
    async (page) => {
      await openPage(page, 'product/compare');
      await page.getByRole('heading', { name: 'Product Comparison' }).waitFor();
      assert.equal(await page.locator('#content table').count(), 0);
      return 'The comparison page opened with no product table.';
    }
  );

  await runScenario(
    browser, 'T004', 'S2', 'Compare iPhone with MacBook',
    'Both products and their prices appear in one comparison table.',
    async (page) => {
      await addToComparison(page, 'iPhone');
      await addToComparison(page, 'MacBook');
      await openPage(page, 'product/compare');
      const table = await page.locator('#content table').innerText();
      assert.match(table, /iPhone/);
      assert.match(table, /MacBook/);
      assert.match(table, /\$123\.20/);
      assert.match(table, /\$602\.00/);
      assert.equal(await page.locator('#content a', { hasText: 'Remove' }).count(), 2);
      return 'The table compared iPhone and MacBook with both prices.';
    }
  );

  await runScenario(
    browser, 'T004', 'S3', 'Remove iPhone from the comparison list',
    'MacBook remains and iPhone is no longer compared.',
    async (page) => {
      await addToComparison(page, 'iPhone');
      await addToComparison(page, 'MacBook');
      await openPage(page, 'product/compare');
      const remove = page.locator('#content a', { hasText: 'Remove' }).first();
      assert.match(await remove.getAttribute('href'), /remove=40/);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'commit', timeout: 60000 }),
        remove.click({ noWaitAfter: true }),
      ]);
      // The store's remove link uses HTTP, so reopen the resulting list over HTTPS.
      await openPage(page, 'product/compare');
      const table = await page.locator('#content table').innerText();
      assert.doesNotMatch(table, /iPhone/);
      assert.match(table, /MacBook/);
      assert.equal(await page.locator('#content a', { hasText: 'Remove' }).count(), 1);
      return 'Only MacBook remained in the comparison table.';
    }
  );
}

// T005: check populated and empty categories, then check the sort order.
async function testCategories(browser) {
  await runScenario(
    browser, 'T005', 'S1', 'Browse the Mac desktop subcategory',
    'The Mac category displays one iMac.',
    async (page) => {
      await openPage(page, 'product/category', { path: '20_27' });
      assert.equal((await page.locator('#content h2').innerText()).trim(), 'Mac');
      assert.deepEqual(await page.locator('.product-thumb h4 a').allTextContents(), ['iMac']);
      return 'The Mac category listed one iMac.';
    }
  );

  await runScenario(
    browser, 'T005', 'S2', 'Browse the empty PC desktop subcategory',
    'The PC category displays no product cards.',
    async (page) => {
      await openPage(page, 'product/category', { path: '20_26' });
      assert.equal((await page.locator('#content h2').innerText()).trim(), 'PC');
      assert.equal(await page.locator('.product-thumb').count(), 0);
      return 'The PC category had no product cards.';
    }
  );

  await runScenario(
    browser, 'T005', 'S3', 'Sort desktop products by name descending',
    'The sorting control selects Z to A and the products appear in descending order.',
    async (page) => {
      await openPage(page, 'product/category', { path: '20' });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'commit', timeout: 60000 }),
        page.locator('#input-sort').selectOption({ label: 'Name (Z - A)' }, { noWaitAfter: true }),
      ]);
      const selected = new URL(page.url());
      assert.equal(selected.searchParams.get('sort'), 'pd.name');
      assert.equal(selected.searchParams.get('order'), 'DESC');
      // The control generates an HTTP URL; inspect the same sorted result over HTTPS.
      await openPage(page, 'product/category', { path: '20', sort: 'pd.name', order: 'DESC' });
      assert.equal((await page.locator('#input-sort option:checked').innerText()).trim(), 'Name (Z - A)');
      const names = await page.locator('.product-thumb h4 a').allTextContents();
      assert(names.length > 1, 'The category did not contain enough products to sort.');
      for (let index = 1; index < names.length; index += 1) {
        assert(names[index - 1].localeCompare(names[index], 'en', { sensitivity: 'base' }) >= 0,
          `${names[index - 1]} appeared before ${names[index]} in a descending list.`);
      }
      return `${names.length} desktop products appeared in name-descending order.`;
    }
  );
}

// Wait for the contact form submission before checking the page result.
async function submitContact(page) {
  const submitted = page.waitForResponse((response) =>
    response.request().method() === 'POST' &&
    new URL(response.url()).searchParams.get('route') === 'information/contact',
    { timeout: 60000 }
  );
  await page.locator('#content input[type="submit"]').click({ noWaitAfter: true });
  return submitted;
}

// T006: check required fields, an invalid email, and a valid enquiry.
async function testContact(browser) {
  await runScenario(
    browser, 'T006', 'S1', 'Submit an empty contact form',
    'The form displays name, email, and enquiry errors.',
    async (page) => {
      await openPage(page, 'information/contact');
      await submitContact(page);
      await page.locator('#content .text-danger').first().waitFor({ timeout: 60000 });
      const errors = await page.locator('#content .text-danger').allTextContents();
      assert.equal(errors.length, 3);
      assert.match(errors.join(' '), /Name must be between/);
      assert.match(errors.join(' '), /E-Mail Address does not appear to be valid/);
      assert.match(errors.join(' '), /Enquiry must be between/);
      return 'The form displayed all three required-field errors.';
    }
  );

  await runScenario(
    browser, 'T006', 'S2', 'Submit a contact form with an invalid email',
    'Only the email validation error appears.',
    async (page) => {
      await openPage(page, 'information/contact');
      await page.locator('#input-name').fill('Test Student');
      await page.locator('#input-email').fill('invalid-email');
      await page.locator('#input-enquiry').fill('This is a coursework system-test enquiry.');
      await submitContact(page);
      await page.locator('#content .text-danger').first().waitFor({ timeout: 60000 });
      const errors = await page.locator('#content .text-danger').allTextContents();
      assert.equal(errors.length, 1);
      assert.match(errors[0], /E-Mail Address does not appear to be valid/);
      return 'Only the invalid-email message was displayed.';
    }
  );

  await runScenario(
    browser, 'T006', 'S3', 'Submit a valid contact enquiry',
    'The store redirects to its contact-success page.',
    async (page) => {
      await openPage(page, 'information/contact');
      await page.locator('#input-name').fill('Test Student');
      await page.locator('#input-email').fill('coursework.test@example.com');
      await page.locator('#input-enquiry').fill('This is a coursework system-test enquiry.');
      await submitContact(page);
      await page.waitForURL(/route=information\/contact\/success/, {
        waitUntil: 'commit', timeout: 60000,
      });
      const redirectUrl = page.url();
      await openPage(page, 'information/contact/success');
      assert.match(await page.locator('#content').innerText(), /Contact Us/);
      return `The form redirected to ${redirectUrl}.`;
    }
  );
}

// Run every test group unless TEST_CASE selects one group.
async function main() {
  const tests = {
    T004: testComparison,
    T005: testCategories,
    T006: testContact,
  };
  const selected = process.env.TEST_CASE;
  if (selected && !tests[selected]) throw new Error(`Unknown TEST_CASE: ${selected}`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const [id, test] of Object.entries(tests)) {
      if (!selected || id === selected) await test(browser);
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
    errors: results.filter((result) => result.status === 'ERROR').length,
    results,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Completed: ${report.passed}/${report.total} passed; ${report.failed} failed; ${report.errors} errors.`);
  if (report.failed || report.errors) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
