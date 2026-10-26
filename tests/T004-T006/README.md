# Assignment 3 System Tests

Website: https://opencart.abstracta.us/

This folder contains three Playwright test cases, each covering one function:

- T004 Product Comparison: empty list, two-product comparison, remove one product.
- T005 Category Browsing: populated subcategory, empty subcategory, name-descending sort.
- T006 Contact Us: empty form, invalid email, valid enquiry.

## Run

```bash
npm ci
npx playwright install chromium
npm test
```

The run writes screenshots and `results.json` to `run-output/`. Set `TEST_CASE`
to `T004`, `T005`, or `T006` to run one case only. The `evidence/` and
`code-evidence/` folders contain screenshots selected for the group report.

The demo store sends some links to HTTP. The tests follow the action, then
reopen the result over HTTPS where necessary. Check `run-output/results.json`
for the result of each fresh run.
