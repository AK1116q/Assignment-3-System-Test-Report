# Selenium System Tests

This folder contains Junhao Kong's T004-T006 tests for https://opencart.abstracta.us/.
Each test case has three scenarios. Chrome is required; Selenium Manager installs
the matching driver when needed.

Run from this folder on Windows:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe system_tests.py
```

Use `.\.venv\Scripts\python.exe system_tests.py T004` (or T005/T006) to run
one case. The script writes screenshots and `results.json` to `run-output/`.
Every scenario starts with a fresh browser session. The `evidence/` and
`code-evidence/` folders contain screenshots selected for the group report.
