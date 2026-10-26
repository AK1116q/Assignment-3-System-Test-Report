# Individual Test Cases

Website: https://opencart.abstracta.us/

These three cases cover three distinct functions. Use the group's final function
IDs in Section 2 of the report; the identifiers below are suggested names.
Add the tester's name in the group report. The recorded run on 26 October 2026
had 9 passes, 0 failures, and 0 errors.

## T004: Product Comparison

Function ID: F-COMP

Location: `https://opencart.abstracta.us/index.php?route=product/compare`

Source: [system-tests.js](system-tests.js), [source screenshot](code-evidence/T004-source.png)

| Scenario | Steps | Expected result | Actual result | Status | Screenshot |
| --- | --- | --- | --- | --- | --- |
| S1 Empty list | Open Product Comparison in a fresh browser session. | No product comparison table is shown. | The page opened without a product table. | PASS | [T004-S1](evidence/T004-S1.png) |
| S2 Two products | From Desktops, add iPhone and MacBook using their comparison buttons; open Product Comparison. | Both products appear with their prices in one table. | iPhone ($123.20) and MacBook ($602.00) appeared in the table. | PASS | [T004-S2](evidence/T004-S2.png) |
| S3 Remove one product | Add both products in a fresh session, open comparison, remove iPhone, and reopen the list. | iPhone disappears; MacBook remains. | Only MacBook remained, with one Remove link. | PASS | [T004-S3](evidence/T004-S3.png) |

## T005: Category Browsing

Function ID: F-CAT

Locations: `https://opencart.abstracta.us/index.php?route=product/category&path=20_27`,
`https://opencart.abstracta.us/index.php?route=product/category&path=20_26`, and
`https://opencart.abstracta.us/index.php?route=product/category&path=20`

Source: [system-tests.js](system-tests.js), [source screenshot](code-evidence/T005-source.png)

| Scenario | Steps | Expected result | Actual result | Status | Screenshot |
| --- | --- | --- | --- | --- | --- |
| S1 Populated category | Open Desktops > Mac. | The category contains one iMac. | One iMac product card appeared. | PASS | [T005-S1](evidence/T005-S1.png) |
| S2 Empty category | Open Desktops > PC. | No product cards appear. | The PC category had zero product cards. | PASS | [T005-S2](evidence/T005-S2.png) |
| S3 Sort order | Open Desktops and select Name (Z - A). | The selected sort is Z to A and product names descend. | The control selected Z to A; all 12 product names appeared in descending order. | PASS | [T005-S3](evidence/T005-S3.png) |

## T006: Contact Us

Function ID: F-CONTACT

Location: `https://opencart.abstracta.us/index.php?route=information/contact`

Source: [system-tests.js](system-tests.js), [source screenshot](code-evidence/T006-source.png)

| Scenario | Steps | Expected result | Actual result | Status | Screenshot |
| --- | --- | --- | --- | --- | --- |
| S1 Empty form | Submit the form with all fields blank. | Name, email, and enquiry validation errors appear. | All three errors appeared. | PASS | [T006-S1](evidence/T006-S1.png) |
| S2 Invalid email | Enter a valid name and enquiry but `invalid-email` as the address, then submit. | Only the email validation error appears. | One email error appeared. | PASS | [T006-S2](evidence/T006-S2.png) |
| S3 Valid form | Enter a test name, `coursework.test@example.com`, and a valid enquiry; submit. | The store redirects to its contact-success route. | The browser reached `information/contact/success`. | PASS | [T006-S3](evidence/T006-S3.png) |

## Observations for Analysis

- The empty comparison and PC category pages show the text "Your shopping cart is empty!" even though neither page is the cart. This is a context mismatch worth reporting.
- Some comparison, sorting, and contact-success links use HTTP even when the page was opened over HTTPS. The tests follow the action, then inspect the resulting page over HTTPS.
- The contact-success page has a heading and Continue button but no explicit confirmation sentence. The test verifies the success route; it does not claim that an email was delivered.

## Prompt Use

An assistant was prompted to draft Playwright tests for Product Comparison,
Category Browsing, and Contact Us on the specified OpenCart demo site. The
selectors, expected outcomes, and screenshots were then checked against the
live site. Include this disclosure with the individual test cases in the final
group report, as required by the assignment template.
