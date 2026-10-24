# Assignment 3 System Tests

Website: https://opencart.abstracta.us/

This folder contains three Playwright test cases:

- T001 Product Search: iPhone, partial Mac keyword, and no matching product.
- T002 Shopping Cart: add an iPhone, update quantity, and remove it.
- T003 Registration: valid account, duplicate email, and missing required fields.

## Run

```bash
npm install
npx playwright install chromium
npm test
```

The run writes screenshots and `results.json` to `evidence-abstracta/`.
The `evidence/` and `code-evidence/` folders contain selected screenshots for
the group report. The demo site can time out, so check `results.json` after each run.
Registration uses a new test email on every run. The store currently redirects
successful registration to an HTTP page that may not finish loading; T003-S1
checks the success URL, and T003-S2 checks that the same email is then rejected.

To run one function only, set `TEST_CASE` to `T001`, `T002`, or `T003` before
running `npm test`.
