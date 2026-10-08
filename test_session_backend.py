"""
DeepQR Shield - Step 12B-RN Backend Session & Companion Test Suite
Validates the ephemeral session manager and all 13 test requirements:
1. Create session
2. Retrieve waiting session
3. Valid image upload
4. Session becomes uploaded
5. Retrieve image (consumption & memory wipe)
6. Second upload rejected (single-use enforcement)
7. Invalid session rejected
8. Expired session rejected
9. Invalid/malformed image rejected
10. Oversized image rejected (> 10MB)
11. Concurrent upload protection (thread-safety)
12. Existing /api/analyze still works
13. Existing health endpoint still works
"""

import io
import sys
import time
import json
import threading
import requests
from PIL import Image

BASE_URL = "http://127.0.0.1:8000"
passed = []
failed = []

def record(test_num, name, ok, details=""):
    msg = f"TEST {test_num} - {name}: {details}"
    if ok:
        passed.append(name)
        print(f"[PASS] {msg}")
    else:
        failed.append(name)
        print(f"[FAIL] {msg}")

def make_test_image(size=(100, 100), color="blue", format="PNG"):
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()

def run_tests():
    print("=" * 70)
    print("DeepQR Shield - Phase 2 Session Backend Test Suite")
    print(f"Target: {BASE_URL}")
    print("=" * 70)

    # 13. Existing health endpoint still works
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=5)
        d = r.json()
        ok13 = r.status_code == 200 and d.get("status") == "healthy" and d.get("engine_ready") is True
        record(13, "Health Endpoint", ok13, f"HTTP {r.status_code}, device={d.get('device')}")
    except Exception as e:
        record(13, "Health Endpoint", False, str(e))
        return

    # 1. Create session
    create_resp = requests.post(f"{BASE_URL}/api/session/create", timeout=5)
    s_data = create_resp.json()
    session_id = s_data.get("session_id")
    token = s_data.get("token")
    qr_data_url = s_data.get("qr_data_url", "")
    ok1 = (
        create_resp.status_code == 201
        and session_id is not None
        and session_id.startswith("s_")
        and token is not None
        and s_data.get("status") == "WAITING"
        and qr_data_url.startswith("data:image/png;base64,")
    )
    record(1, "Create Session", ok1, f"sessionId={session_id}, qr_data_url_len={len(qr_data_url)}")

    # 2. Retrieve waiting session
    get_resp = requests.get(f"{BASE_URL}/api/session/{session_id}", timeout=5)
    get_data = get_resp.json()
    ok2 = (
        get_resp.status_code == 200
        and get_data.get("session_id") == session_id
        and get_data.get("status") == "WAITING"
        and get_data.get("has_image") is False
        and get_data.get("expires_in") > 280
    )
    record(2, "Retrieve Waiting Session", ok2, f"status={get_data.get('status')}, expires_in={get_data.get('expires_in')}s")

    # 3. Valid image upload
    test_img_bytes = make_test_image(size=(120, 120), color="green", format="PNG")
    files = {"file": ("mobile_scan.png", test_img_bytes, "image/png")}
    headers = {"X-Session-Token": token}
    up_resp = requests.post(f"{BASE_URL}/api/session/{session_id}/upload", files=files, headers=headers, timeout=5)
    up_data = up_resp.json()
    ok3 = (
        up_resp.status_code == 200
        and up_data.get("success") is True
        and up_data.get("status") == "UPLOADED"
        and up_data.get("bytes_received") == len(test_img_bytes)
    )
    record(3, "Valid Image Upload", ok3, f"HTTP {up_resp.status_code}, bytes={up_data.get('bytes_received')}")

    # 4. Session becomes uploaded
    get2_resp = requests.get(f"{BASE_URL}/api/session/{session_id}", timeout=5)
    get2_data = get2_resp.json()
    ok4 = (
        get2_resp.status_code == 200
        and get2_data.get("status") == "UPLOADED"
        and get2_data.get("has_image") is True
    )
    record(4, "Session Status UPLOADED", ok4, f"status={get2_data.get('status')}, has_image={get2_data.get('has_image')}")

    # 5. Retrieve image (consumption & immediate memory wipe)
    img_resp = requests.get(f"{BASE_URL}/api/session/{session_id}/image", timeout=5)
    ok5 = (
        img_resp.status_code == 200
        and img_resp.headers.get("Content-Type") == "image/png"
        and len(img_resp.content) == len(test_img_bytes)
        and img_resp.content == test_img_bytes
    )
    # Check that session is now consumed and purged from memory
    after_resp = requests.get(f"{BASE_URL}/api/session/{session_id}", timeout=5)
    ok5_purged = after_resp.status_code in (404, 410)
    record(5, "Retrieve & Consume Image", ok5 and ok5_purged, f"HTTP {img_resp.status_code}, len={len(img_resp.content)}, subsequent_status={after_resp.status_code}")

    # 6. Second upload rejected (Single-use enforcement)
    # Create fresh session, upload once, then attempt second upload
    s2 = requests.post(f"{BASE_URL}/api/session/create").json()
    sid2, tok2 = s2["session_id"], s2["token"]
    requests.post(f"{BASE_URL}/api/session/{sid2}/upload", files={"file": ("img1.png", test_img_bytes, "image/png")}, headers={"X-Session-Token": tok2})
    # Attempt second upload on same session
    dup_resp = requests.post(f"{BASE_URL}/api/session/{sid2}/upload", files={"file": ("img2.png", test_img_bytes, "image/png")}, headers={"X-Session-Token": tok2})
    ok6 = dup_resp.status_code == 409
    record(6, "Second Upload Rejected (409)", ok6, f"HTTP {dup_resp.status_code}, msg={dup_resp.json().get('error')}")

    # 7. Invalid session rejected
    bad_sid_resp = requests.get(f"{BASE_URL}/api/session/nonexistent_session_id", timeout=5)
    bad_up_resp = requests.post(f"{BASE_URL}/api/session/nonexistent_session_id/upload", files={"file": ("img.png", test_img_bytes, "image/png")})
    ok7 = bad_sid_resp.status_code == 404 and bad_up_resp.status_code == 404
    record(7, "Invalid Session Rejected (404)", ok7, f"GET={bad_sid_resp.status_code}, POST={bad_up_resp.status_code}")

    # 8. Expired session rejected
    # Create session with 1-second TTL, wait 1.2s, test GET and POST both return HTTP 410
    exp_create = requests.post(f"{BASE_URL}/api/session/create", headers={"X-Session-TTL": "1"}, timeout=5).json()
    exp_sid = exp_create["session_id"]
    exp_tok = exp_create["token"]
    time.sleep(1.2)  # Wait for TTL to elapse
    exp_get = requests.get(f"{BASE_URL}/api/session/{exp_sid}")
    exp_post = requests.post(
        f"{BASE_URL}/api/session/{exp_sid}/upload",
        files={"file": ("img.png", test_img_bytes, "image/png")},
        headers={"X-Session-Token": exp_tok}
    )
    ok8 = exp_get.status_code == 410 and exp_post.status_code == 410
    record(8, "Expired Session Rejected (410)", ok8, f"GET={exp_get.status_code}, POST={exp_post.status_code}")

    # 9. Invalid/malformed image rejected
    s9 = requests.post(f"{BASE_URL}/api/session/create").json()
    sid9, tok9 = s9["session_id"], s9["token"]
    corrupt_bytes = b"NOT_AN_IMAGE_RANDOM_TEXT_CORRUPTED"
    corrupt_resp = requests.post(
        f"{BASE_URL}/api/session/{sid9}/upload",
        files={"file": ("fake.png", corrupt_bytes, "image/png")},
        headers={"X-Session-Token": tok9}
    )
    ok9 = corrupt_resp.status_code == 400
    record(9, "Invalid Image Rejected (400)", ok9, f"HTTP {corrupt_resp.status_code}, msg={corrupt_resp.json().get('error')}")

    # 10. Oversized image rejected (> 10MB)
    s10 = requests.post(f"{BASE_URL}/api/session/create").json()
    sid10, tok10 = s10["session_id"], s10["token"]
    oversized_bytes = b"X" * (10 * 1024 * 1024 + 1024) # 10MB + 1KB
    try:
        over_resp = requests.post(
            f"{BASE_URL}/api/session/{sid10}/upload",
            files={"file": ("huge.png", oversized_bytes, "image/png")},
            headers={"X-Session-Token": tok10},
            timeout=10
        )
        ok10 = over_resp.status_code == 413
        details10 = f"HTTP {over_resp.status_code}"
    except requests.exceptions.ConnectionError:
        # Client disconnected by server closing oversized payload
        ok10 = True
        details10 = "Connection cleanly terminated on oversized payload"
    record(10, "Oversized Image Rejected (413)", ok10, details10)

    # 11. Concurrent upload protection
    s11 = requests.post(f"{BASE_URL}/api/session/create").json()
    sid11, tok11 = s11["session_id"], s11["token"]
    results11 = []

    def concurrent_worker(worker_id):
        img_b = make_test_image(size=(50, 50), color="red" if worker_id == 1 else "yellow")
        try:
            r = requests.post(
                f"{BASE_URL}/api/session/{sid11}/upload",
                files={"file": (f"worker_{worker_id}.png", img_b, "image/png")},
                headers={"X-Session-Token": tok11},
                timeout=5
            )
            results11.append(r.status_code)
        except Exception as e:
            results11.append(str(e))

    t1 = threading.Thread(target=concurrent_worker, args=(1,))
    t2 = threading.Thread(target=concurrent_worker, args=(2,))
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    # Exactly one must succeed (200) and one must be rejected (409)
    ok11 = (200 in results11 and 409 in results11 and len(results11) == 2)
    record(11, "Concurrent Upload Protection", ok11, f"Results: {results11}")

    # 12. Existing /api/analyze still works
    sample_qr = "data/clean_qr/test/benign/qr_test_benign_0019.png"
    with open(sample_qr, "rb") as f:
        an_resp = requests.post(f"{BASE_URL}/api/analyze", files={"file": ("sample.png", f, "image/png")}, timeout=10)
    an_data = an_resp.json()
    ok12 = (
        an_resp.status_code == 200
        and an_data.get("qr_decoded") is True
        and an_data.get("final_class") == "SAFE"
        and "risk_score" in an_data
        and "visual_probabilities" in an_data
        and "url_probabilities" in an_data
    )
    record(12, "Existing /api/analyze Works", ok12, f"HTTP {an_resp.status_code}, final={an_data.get('final_class')}, risk={an_data.get('risk_score')}")

    print("=" * 70)
    print(f"RESULTS: {len(passed)} PASSED, {len(failed)} FAILED")
    print("=" * 70)
    if failed:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
