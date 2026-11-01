import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qs

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait


STORE = "https://opencart.abstracta.us"
OUTPUT = Path(__file__).parent / "run-output"


def page_url(route, **parameters):
    return f"{STORE}/index.php?{urlencode({'route': route, **parameters})}"


def open_page(driver, route, **parameters):
    url = page_url(route, **parameters)
    for attempt in range(2):
        try:
            driver.get(url)
            WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, "content")))
            return
        except TimeoutException:
            if attempt == 1:
                raise


def new_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,900")
    options.page_load_strategy = "eager"
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(45)
    return driver


def screenshot(driver, path):
    height = driver.execute_script("return document.documentElement.scrollHeight")
    driver.set_window_size(1440, min(max(height + 100, 900), 3200))
    driver.execute_script("window.scrollTo(0, 0)")
    driver.save_screenshot(str(path))


def add_to_comparison(driver, product_name):
    open_page(driver, "product/category", path="20")
    cards = driver.find_elements(By.CSS_SELECTOR, ".product-thumb")
    card = next((item for item in cards if item.find_element(By.CSS_SELECTOR, "h4 a").text == product_name), None)
    assert card is not None, f"{product_name} was not listed in Desktops"
    card.find_element(By.CSS_SELECTOR, 'button[data-original-title="Compare this Product"]').click()
    WebDriverWait(driver, 20).until(
        lambda page: any(product_name.lower() in alert.text.lower()
                         for alert in page.find_elements(By.CSS_SELECTOR, ".alert-success"))
    )


# T004: Product Comparison
def t004_s1(driver):
    open_page(driver, "product/compare")
    assert driver.find_element(By.CSS_SELECTOR, "#content h1").text == "Product Comparison"
    assert not driver.find_elements(By.CSS_SELECTOR, "#content table")
    return "The comparison page opened without a product table."


def t004_s2(driver):
    add_to_comparison(driver, "iPhone")
    add_to_comparison(driver, "MacBook")
    open_page(driver, "product/compare")
    table = driver.find_element(By.CSS_SELECTOR, "#content table").text
    assert "iPhone" in table and "MacBook" in table
    assert "$123.20" in table and "$602.00" in table
    assert len(driver.find_elements(By.LINK_TEXT, "Remove")) == 2
    return "iPhone and MacBook appeared with both prices."


def t004_s3(driver):
    add_to_comparison(driver, "iPhone")
    add_to_comparison(driver, "MacBook")
    open_page(driver, "product/compare")
    remove_iphone = driver.find_element(By.CSS_SELECTOR, '#content a[href*="remove=40"]')
    remove_iphone.click()
    open_page(driver, "product/compare")
    table = driver.find_element(By.CSS_SELECTOR, "#content table").text
    assert "iPhone" not in table and "MacBook" in table
    assert len(driver.find_elements(By.LINK_TEXT, "Remove")) == 1
    return "Only MacBook remained in the comparison table."


# T005: Category Browsing
def t005_s1(driver):
    open_page(driver, "product/category", path="20_27")
    assert driver.find_element(By.CSS_SELECTOR, "#content h2").text == "Mac"
    names = [link.text for link in driver.find_elements(By.CSS_SELECTOR, ".product-thumb h4 a")]
    assert names == ["iMac"], names
    return "The Mac category listed one iMac."


def t005_s2(driver):
    open_page(driver, "product/category", path="20_26")
    assert driver.find_element(By.CSS_SELECTOR, "#content h2").text == "PC"
    assert not driver.find_elements(By.CSS_SELECTOR, ".product-thumb")
    return "The PC category had no product cards."


def t005_s3(driver):
    open_page(driver, "product/category", path="20")
    Select(driver.find_element(By.ID, "input-sort")).select_by_visible_text("Name (Z - A)")
    WebDriverWait(driver, 20).until(lambda page: parse_qs(urlparse(page.current_url).query).get("order") == ["DESC"])
    open_page(driver, "product/category", path="20", sort="pd.name", order="DESC")
    assert Select(driver.find_element(By.ID, "input-sort")).first_selected_option.text == "Name (Z - A)"
    names = [link.text for link in driver.find_elements(By.CSS_SELECTOR, ".product-thumb h4 a")]
    assert len(names) > 1 and names == sorted(names, key=str.casefold, reverse=True), names
    return f"{len(names)} desktop products appeared in name-descending order."


def submit_contact(driver):
    driver.find_element(By.CSS_SELECTOR, '#content input[type="submit"]').click()


def contact_errors(driver):
    WebDriverWait(driver, 20).until(lambda page: page.find_elements(By.CSS_SELECTOR, "#content .text-danger"))
    return [item.text for item in driver.find_elements(By.CSS_SELECTOR, "#content .text-danger")]


# T006: Contact Us
def t006_s1(driver):
    open_page(driver, "information/contact")
    submit_contact(driver)
    errors = contact_errors(driver)
    assert len(errors) == 3, errors
    assert any("Name must be between" in error for error in errors)
    assert any("E-Mail Address does not appear to be valid" in error for error in errors)
    assert any("Enquiry must be between" in error for error in errors)
    return "The form displayed all three required-field errors."


def t006_s2(driver):
    open_page(driver, "information/contact")
    driver.find_element(By.ID, "input-name").send_keys("Test Student")
    driver.find_element(By.ID, "input-email").send_keys("invalid-email")
    driver.find_element(By.ID, "input-enquiry").send_keys("This is a coursework system-test enquiry.")
    submit_contact(driver)
    errors = contact_errors(driver)
    assert len(errors) == 1 and "E-Mail Address does not appear to be valid" in errors[0], errors
    return "Only the invalid-email message was displayed."


def t006_s3(driver):
    open_page(driver, "information/contact")
    driver.find_element(By.ID, "input-name").send_keys("Test Student")
    driver.find_element(By.ID, "input-email").send_keys("coursework.test@example.com")
    driver.find_element(By.ID, "input-enquiry").send_keys("This is a coursework system-test enquiry.")
    submit_contact(driver)
    WebDriverWait(driver, 30).until(EC.url_contains("route=information/contact/success"))
    open_page(driver, "information/contact/success")
    assert "Contact Us" in driver.find_element(By.ID, "content").text
    return "The form reached the contact-success page."


CASES = {
    "T004": [
        ("S1", "No product table is displayed.", t004_s1),
        ("S2", "Both products and prices appear in one comparison table.", t004_s2),
        ("S3", "Removing iPhone leaves MacBook in the table.", t004_s3),
    ],
    "T005": [
        ("S1", "The Mac category displays one iMac.", t005_s1),
        ("S2", "The PC category displays no product cards.", t005_s2),
        ("S3", "The desktop products appear in descending name order.", t005_s3),
    ],
    "T006": [
        ("S1", "The empty form shows three validation errors.", t006_s1),
        ("S2", "Only the invalid-email error appears.", t006_s2),
        ("S3", "A valid enquiry reaches the contact-success page.", t006_s3),
    ],
}


def main():
    selected = sys.argv[1] if len(sys.argv) > 1 else None
    if selected and selected not in CASES:
        raise SystemExit("Choose T004, T005, or T006.")
    OUTPUT.mkdir(exist_ok=True)
    results = []
    for case_id, scenarios in CASES.items():
        if selected and selected != case_id:
            continue
        for scenario_id, expected, action in scenarios:
            driver = None
            status = "PASS"
            actual = ""
            image = f"{case_id}-{scenario_id}.png"
            try:
                driver = new_driver()
                actual = action(driver)
            except AssertionError as error:
                status, actual = "FAIL", str(error)
            except Exception as error:
                status, actual = "ERROR", f"{type(error).__name__}: {error}"
            finally:
                if driver:
                    try:
                        screenshot(driver, OUTPUT / image)
                    except Exception as error:
                        actual += f" Screenshot unavailable: {error}"
                        image = None
                    driver.quit()
            results.append({"testCase": case_id, "scenario": scenario_id,
                            "expected": expected, "actual": actual,
                            "status": status, "screenshot": image})
            print(f"{case_id}-{scenario_id}: {status} - {actual}")
    report = {"website": STORE, "executedAt": datetime.now(timezone.utc).isoformat(),
              "total": len(results), "passed": sum(item["status"] == "PASS" for item in results),
              "failed": sum(item["status"] == "FAIL" for item in results),
              "errors": sum(item["status"] == "ERROR" for item in results), "results": results}
    (OUTPUT / "results.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Completed: {report['passed']}/{report['total']} passed; "
          f"{report['failed']} failed; {report['errors']} errors.")
    return 1 if report["failed"] or report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
