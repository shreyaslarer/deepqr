"""
DeepQR Shield - Step 10B Backend Smoke Test Suite
Executes Tests A through G against the local HTTP backend server.
"""

import os
import sys
import json
import time
import requests
from io import BytesIO

BASE_URL = "http://127.0.0.1:8000"
ANALYZE_URL = f"{BASE_URL}/api/analyze"
HEALTH_URL = f"{BASE_URL}/api/health"

passed_tests = []
failed_tests = []


def record_result(test_name: str, passed: bool, details: str = ""):
    if passed:
        passed_tests.append(test_name)
        print(f"[PASS] {test_name}: {details}")
    else:
        failed_tests.append(test_name)
        print(f"[FAIL] {test_name}: {details}")


def run_tests():
    print("=" * 70)
    print("DeepQR Shield - Step 10B Automated Smoke Test Suite")
    print(f"Target URL: {BASE_URL}")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # TEST A: Server Health and Engine Initialization
    # -------------------------------------------------------------------------
    try:
        resp = requests.get(HEALTH_URL, timeout=5)
        data = resp.json()
        is_ok = (
            resp.status_code == 200
            and data.get("status") == "healthy"
            and data.get("engine_ready") is True
        )
        record_result(
            "Test A (Health & Engine Ready)",
            is_ok,
            f"HTTP {resp.status_code}, device='{data.get('device')}'"
        )
    except Exception as e:
        record_result("Test A (Health & Engine Ready)", False, f"Connection error: {e}")
        print("\nAborting further tests since backend is unreachable.")
        return

    # -------------------------------------------------------------------------
    # TEST B: Known Clean QR Code (Benign URL)
    # -------------------------------------------------------------------------
    clean_path = "data/clean_qr/test/benign/qr_test_benign_0019.png"
    if not os.path.exists(clean_path):
        record_result("Test B (Clean QR Test)", False, f"File not found: {clean_path}")
    else:
        with open(clean_path, "rb") as f:
            files = {"file": ("qr_test_benign_0019.png", f, "image/png")}
            resp = requests.post(ANALYZE_URL, files=files, timeout=10)

        try:
            data = resp.json()
            passed = (
                resp.status_code == 200
                and data.get("qr_decoded") is True
                and data.get("final_class") == "SAFE"
                and data.get("risk_score", 100) < 20
                and "visual_probabilities" in data
                and "url_probabilities" in data
                and data.get("url_model_used") is True
            )
            # Redact payload for logging
            raw_payload = data.get("decoded_payload", "")
            redacted = (raw_payload[:15] + "...") if raw_payload else "None"
            record_result(
                "Test B (Clean QR Test)",
                passed,
                f"HTTP {resp.status_code}, final_class='{data.get('final_class')}', "
                f"risk_score={data.get('risk_score')}, payload='{redacted}'"
            )
        except Exception as e:
            record_result("Test B (Clean QR Test)", False, f"Parse error: {e}")

    # -------------------------------------------------------------------------
    # TEST C: Malicious QR Code
    # -------------------------------------------------------------------------
    mal_path = "data/clean_qr/test/malicious/qr_test_mal_0007.png"
    if not os.path.exists(mal_path):
        record_result("Test C (Malicious QR Test)", False, f"File not found: {mal_path}")
    else:
        with open(mal_path, "rb") as f:
            files = {"file": ("qr_test_mal_0007.png", f, "image/png")}
            resp = requests.post(ANALYZE_URL, files=files, timeout=10)

        try:
            data = resp.json()
            passed = (
                resp.status_code == 200
                and "final_class" in data
                and data.get("final_class") == "MALICIOUS"
                and "risk_score" in data
            )
            record_result(
                "Test C (Malicious QR Test)",
                passed,
                f"HTTP {resp.status_code}, final_class='{data.get('final_class')}', "
                f"risk_score={data.get('risk_score')}"
            )
        except Exception as e:
            record_result("Test C (Malicious QR Test)", False, f"Parse error: {e}")

    # -------------------------------------------------------------------------
    # TEST D: Tampered QR Code
    # -------------------------------------------------------------------------
    tamp_path = "data/clean_qr/test/tampered/qr_test_tamp_0012.png"
    if not os.path.exists(tamp_path):
        record_result("Test D (Tampered QR Test)", False, f"File not found: {tamp_path}")
    else:
        with open(tamp_path, "rb") as f:
            files = {"file": ("qr_test_tamp_0012.png", f, "image/png")}
            resp = requests.post(ANALYZE_URL, files=files, timeout=10)

        try:
            data = resp.json()
            passed = (
                resp.status_code == 200
                and "final_class" in data
                and data.get("final_class") in ("SUSPICIOUS", "MALICIOUS")
                and "risk_score" in data
            )
            record_result(
                "Test D (Tampered QR Test)",
                passed,
                f"HTTP {resp.status_code}, final_class='{data.get('final_class')}', "
                f"visual_class='{data.get('visual_class')}', risk_score={data.get('risk_score')}"
            )
        except Exception as e:
            record_result("Test D (Tampered QR Test)", False, f"Parse error: {e}")

    # -------------------------------------------------------------------------
    # TEST E: Invalid / Non-Image File
    # -------------------------------------------------------------------------
    # Send text file with .txt extension
    fake_txt = ("fake.txt", b"This is plain text, not an image.", "text/plain")
    resp_e1 = requests.post(ANALYZE_URL, files={"file": fake_txt}, timeout=5)
    e1_ok = (resp_e1.status_code == 400 and "error" in resp_e1.json())

    # Send corrupted file with .png extension
    fake_png = ("corrupt.png", b"NOT_A_REAL_PNG_HEADER", "image/png")
    resp_e2 = requests.post(ANALYZE_URL, files={"file": fake_png}, timeout=5)
    e2_ok = (resp_e2.status_code == 400 and "error" in resp_e2.json())

    test_e_passed = e1_ok and e2_ok
    record_result(
        "Test E (Invalid/Non-Image Rejection)",
        test_e_passed,
        f".txt rejection={resp_e1.status_code} ({resp_e1.json().get('error')}), "
        f"corrupt PNG rejection={resp_e2.status_code} ({resp_e2.json().get('error')})"
    )

    # -------------------------------------------------------------------------
    # TEST F: Request Without Image
    # -------------------------------------------------------------------------
    # Send empty multipart
    resp_f = requests.post(ANALYZE_URL, data={"key": "value_without_file"}, timeout=5)
    test_f_passed = (resp_f.status_code == 400 and "error" in resp_f.json())
    record_result(
        "Test F (Missing Image Rejection)",
        test_f_passed,
        f"HTTP {resp_f.status_code}, error='{resp_f.json().get('error')}'"
    )

    # -------------------------------------------------------------------------
    # TEST G: Oversized Payload Rejection (> 10 MB)
    # -------------------------------------------------------------------------
    large_payload_bytes = b"\x00" * (11 * 1024 * 1024)  # 11 MB
    large_file = ("oversized.png", large_payload_bytes, "image/png")
    try:
        resp_g = requests.post(ANALYZE_URL, files={"file": large_file}, timeout=10)
        test_g_passed = (resp_g.status_code == 413 and "error" in resp_g.json())
        record_result(
            "Test G (Oversized Payload Rejection)",
            test_g_passed,
            f"HTTP {resp_g.status_code}, error='{resp_g.json().get('error')}'"
        )
    except Exception as e:
        record_result("Test G (Oversized Payload Rejection)", False, f"Error: {e}")

    # -------------------------------------------------------------------------
    # SUMMARY
    # -------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print(f"Smoke Test Suite Summary: {len(passed_tests)} PASSED, {len(failed_tests)} FAILED")
    print("=" * 70)
    if failed_tests:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
