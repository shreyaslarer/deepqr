"""
DeepQR Shield - Step 10C Frontend/Proxy Integration Test Suite
Tests API proxy at http://localhost:5173/api/analyze and http://127.0.0.1:8000/api/analyze.
"""

import os
import sys
import json
import requests

VITE_PROXY_URL = "http://localhost:5173/api/analyze"
BACKEND_DIRECT_URL = "http://127.0.0.1:8000/api/analyze"

passed = []
failed = []

def record(test_name, ok, msg=""):
    if ok:
        passed.append(test_name)
        print(f"[PASS] {test_name}: {msg}")
    else:
        failed.append(test_name)
        print(f"[FAIL] {test_name}: {msg}")

def test_suite():
    print("=" * 70)
    print("DeepQR Shield Step 10C Integration Test Suite (via Vite Proxy)")
    print(f"Target: {VITE_PROXY_URL}")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # TEST 1: Known Benign QR
    # -------------------------------------------------------------------------
    p1 = "data/clean_qr/test/benign/qr_test_benign_0019.png"
    with open(p1, "rb") as f:
        r1 = requests.post(VITE_PROXY_URL, files={"file": ("qr_test_benign_0019.png", f, "image/png")})
    d1 = r1.json()
    t1_ok = (
        r1.status_code == 200
        and d1.get("qr_decoded") is True
        and d1.get("final_class") == "SAFE"
        and d1.get("risk_score") <= 10
        and d1.get("url_model_used") is True
        and "visual_probabilities" in d1
        and "url_probabilities" in d1
    )
    record("TEST 1 - Benign QR via Proxy", t1_ok, f"final_class={d1.get('final_class')}, risk_score={d1.get('risk_score')}, url_model_used={d1.get('url_model_used')}")

    # -------------------------------------------------------------------------
    # TEST 2: Known Malicious QR
    # -------------------------------------------------------------------------
    p2 = "data/clean_qr/test/malicious/qr_test_mal_0007.png"
    with open(p2, "rb") as f:
        r2 = requests.post(VITE_PROXY_URL, files={"file": ("qr_test_mal_0007.png", f, "image/png")})
    d2 = r2.json()
    t2_ok = (
        r2.status_code == 200
        and d2.get("final_class") == "MALICIOUS"
        and d2.get("risk_score") == 100
        and d2.get("visual_class") == "malicious"
    )
    record("TEST 2 - Malicious QR via Proxy", t2_ok, f"final_class={d2.get('final_class')}, risk_score={d2.get('risk_score')}")

    # -------------------------------------------------------------------------
    # TEST 3: Known Tampered QR
    # -------------------------------------------------------------------------
    p3 = "data/clean_qr/test/tampered/qr_test_tamp_0012.png"
    with open(p3, "rb") as f:
        r3 = requests.post(VITE_PROXY_URL, files={"file": ("qr_test_tamp_0012.png", f, "image/png")})
    d3 = r3.json()
    t3_ok = (
        r3.status_code == 200
        and d3.get("visual_class") == "tampered"
        and d3.get("final_class") in ("SUSPICIOUS", "MALICIOUS")
    )
    record("TEST 3 - Tampered QR via Proxy", t3_ok, f"visual_class={d3.get('visual_class')}, final_class={d3.get('final_class')}, risk_score={d3.get('risk_score')}")

    # -------------------------------------------------------------------------
    # TEST 4: Decode Failure
    # -------------------------------------------------------------------------
    # qr_test_mal_0007.png produced qr_decoded = False
    t4_ok = (
        d2.get("qr_decoded") is False
        and d2.get("decoded_payload") is None
        and d2.get("payload_type") == "none"
        and d2.get("url_model_used") is False
    )
    record("TEST 4 - Decode Failure Handled", t4_ok, f"qr_decoded={d2.get('qr_decoded')}, payload={d2.get('decoded_payload')}, payload_type={d2.get('payload_type')}")

    # -------------------------------------------------------------------------
    # TEST 5: Non-URL QR
    # -------------------------------------------------------------------------
    p5 = "results/robustness/sample_images/sample_clean.png"
    with open(p5, "rb") as f:
        r5 = requests.post(VITE_PROXY_URL, files={"file": ("sample_clean.png", f, "image/png")})
    d5 = r5.json()
    t5_ok = (
        r5.status_code == 200
        and d5.get("qr_decoded") is True
        and d5.get("payload_type") == "text"
        and d5.get("url_model_used") is False
        and d5.get("decoded_payload") is not None
    )
    record("TEST 5 - Non-URL Text QR", t5_ok, f"payload_type={d5.get('payload_type')}, url_model_used={d5.get('url_model_used')}")

    # -------------------------------------------------------------------------
    # TEST 6: Invalid File Upload
    # -------------------------------------------------------------------------
    r6_txt = requests.post(VITE_PROXY_URL, files={"file": ("invalid.txt", b"plain text", "text/plain")})
    t6_txt_ok = (r6_txt.status_code == 400 and "error" in r6_txt.json())

    r6_corrupt = requests.post(VITE_PROXY_URL, files={"file": ("corrupt.png", b"corrupt bytes", "image/png")})
    t6_corrupt_ok = (r6_corrupt.status_code == 400 and "error" in r6_corrupt.json())

    record("TEST 6 - Invalid File Rejection", t6_txt_ok and t6_corrupt_ok, f"txt={r6_txt.status_code}, corrupt={r6_corrupt.status_code}")

    # -------------------------------------------------------------------------
    # TEST 7: Oversized File Upload
    # -------------------------------------------------------------------------
    large_payload = b"\x00" * (11 * 1024 * 1024)
    r7 = requests.post(VITE_PROXY_URL, files={"file": ("large.png", large_payload, "image/png")})
    t7_ok = (r7.status_code == 413 and "error" in r7.json())
    record("TEST 7 - Oversized File Rejection", t7_ok, f"HTTP {r7.status_code}: {r7.json().get('error')}")

    # -------------------------------------------------------------------------
    # TEST 9: Sequential Repeated Analysis
    # -------------------------------------------------------------------------
    # Run benign, then malicious, then benign again to verify state independence
    with open(p1, "rb") as f:
        seq1 = requests.post(VITE_PROXY_URL, files={"file": ("qr_test_benign_0019.png", f, "image/png")}).json()
    with open(p2, "rb") as f:
        seq2 = requests.post(VITE_PROXY_URL, files={"file": ("qr_test_mal_0007.png", f, "image/png")}).json()
    with open(p1, "rb") as f:
        seq3 = requests.post(VITE_PROXY_URL, files={"file": ("qr_test_benign_0019.png", f, "image/png")}).json()

    t9_ok = (
        seq1["final_class"] == "SAFE"
        and seq2["final_class"] == "MALICIOUS"
        and seq3["final_class"] == "SAFE"
        and seq1["risk_score"] == seq3["risk_score"]
    )
    record("TEST 9 - Repeated Analysis State Independence", t9_ok, f"seq1={seq1['final_class']}, seq2={seq2['final_class']}, seq3={seq3['final_class']}")

    print("\n" + "=" * 70)
    print(f"Integration Summary: {len(passed)} PASSED, {len(failed)} FAILED")
    print("=" * 70)

if __name__ == "__main__":
    test_suite()
