"""
DeepQR Shield - Minimal Offline Python HTTP Backend
Step 10B + Step 12B-RN: Exposes DeepQRShieldFusion engine via local HTTP endpoint
and provides an in-memory ephemeral session manager for React Native mobile companion pairing.

Endpoints:
- POST /api/analyze               : Receives multipart/form-data image, runs multimodal fusion, returns JSON.
- GET  /api/health                : Health check returning engine status and device.
- POST /api/session/create        : Creates temporary 5-min pairing session with QR metadata & OpenCV data URI.
- GET  /api/session/<id>          : Retrieves session status (WAITING, PAIRED, UPLOADED, CONSUMED, EXPIRED).
- POST /api/session/<id>/pair     : Handshake to mark session PAIRED.
- POST /api/session/<id>/upload   : Receives captured QR image from React Native mobile companion.
- GET  /api/session/<id>/image    : Retrieves staged image for desktop UI and consumes/deletes session memory.
- OPTIONS *                       : Preflight CORS handler for desktop and mobile integrations.

Constraints:
- Strictly offline ML inference (no outbound network calls, no crawling, no fetching decoded URLs).
- In-memory processing via BytesIO + PIL.Image (no persistent file storage).
- Binds to 0.0.0.0:8000 for LAN accessibility from mobile device on local Wi-Fi.
- Ephemeral session memory: 5-minute TTL, single-use upload, zero persistence.
- Preserves DeepQRShieldFusion inference result structure exactly.
"""

import os
import sys
import json
import logging
import argparse
import time
import secrets
import threading
import socket
import base64
from pathlib import Path
from io import BytesIO
import email
import email.parser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from typing import Optional, Tuple, Dict, Any

import cv2
from PIL import Image, UnidentifiedImageError

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Import canonical fusion inference engine
from fusion_inference import DeepQRShieldFusion

# =============================================================================
# Logging Configuration
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("DeepQRBackend")

# =============================================================================
# Configuration & Constants
# =============================================================================
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB limit
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
SESSION_TTL_SECONDS = 300  # 5 minutes

# Initialize Fusion Engine singleton (loaded once at server startup)
engine: Optional[DeepQRShieldFusion] = None


def init_engine(
    visual_path: Optional[str] = None,
    url_path: Optional[str] = None,
    config_path: Optional[str] = None
) -> DeepQRShieldFusion:
    """Instantiates the DeepQRShieldFusion engine with resolved paths."""
    v_path = visual_path or str(PROJECT_ROOT / "models" / "visual" / "resnet18_final.pt")
    u_path = url_path or str(PROJECT_ROOT / "models" / "url" / "url_cnn_final.pt")
    c_path = config_path or str(PROJECT_ROOT / "models" / "fusion" / "fusion_config.json")

    logger.info("Initializing DeepQRShieldFusion engine singleton...")
    logger.info(f"  Visual model checkpoint: {v_path}")
    logger.info(f"  URL model checkpoint:    {u_path}")
    logger.info(f"  Fusion configuration:    {c_path}")

    loaded_engine = DeepQRShieldFusion(
        visual_model_path=v_path,
        url_model_path=u_path,
        config_path=c_path
    )
    logger.info(f"DeepQRShieldFusion initialized successfully on device: {loaded_engine.device}")
    return loaded_engine


def get_lan_ip() -> str:
    """Best-effort discovery of local LAN IPv4 address for mobile pairing."""
    env_ip = os.environ.get("DEEPQR_LAN_IP")
    if env_ip:
        return env_ip
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def generate_qr_data_url(text: str) -> str:
    """Generates a high-contrast pairing QR code data URI using OpenCV."""
    try:
        enc = cv2.QRCodeEncoder_create()
        raw = enc.encode(text)
        # Add a 4-module quiet zone (white border)
        bordered = cv2.copyMakeBorder(raw, 4, 4, 4, 4, cv2.BORDER_CONSTANT, value=255)
        # Scale to crisp 320x320
        upscaled = cv2.resize(bordered, (320, 320), interpolation=cv2.INTER_NEAREST)
        success, buf = cv2.imencode(".png", upscaled)
        if success:
            b64 = base64.b64encode(buf.tobytes()).decode("ascii")
            return f"data:image/png;base64,{b64}"
    except Exception as e:
        logger.error(f"Failed to generate QR data URI with OpenCV: {e}")
    return ""


# =============================================================================
# In-Memory Session Manager
# =============================================================================
class SessionManager:
    """Thread-safe in-memory ephemeral session store for mobile companion pairing."""

    def __init__(self, ttl_seconds: int = SESSION_TTL_SECONDS):
        self.ttl_seconds = ttl_seconds
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._recently_expired: Dict[str, float] = {}
        self._lock = threading.Lock()

    def _cleanup_expired_locked(self):
        """Removes expired sessions from memory. Must be called while holding self._lock."""
        now = time.time()
        expired = [sid for sid, s in self._sessions.items() if s["expires_at"] < now]
        for sid in expired:
            logger.info(f"[SESSION CLEANUP] Expired session {sid} removed from memory")
            del self._sessions[sid]
            self._recently_expired[sid] = now
        # Keep _recently_expired bounded to entries within last 10 minutes
        cutoff = now - 600
        self._recently_expired = {sid: ts for sid, ts in self._recently_expired.items() if ts > cutoff}

    def create_session(self, host: str, port: int, ttl: Optional[int] = None) -> dict:
        """Creates a new ephemeral pairing session."""
        with self._lock:
            self._cleanup_expired_locked()
            session_ttl = ttl if (ttl is not None and 1 <= ttl <= 600) else self.ttl_seconds
            session_id = f"s_{secrets.token_urlsafe(8)}"
            token = secrets.token_urlsafe(16)
            created_at = time.time()
            expires_at = created_at + session_ttl

            endpoint = f"http://{host}:{port}/api/session/{session_id}"
            qr_meta = {
                "protocol": "deepqr-companion-v1",
                "endpoint": endpoint,
                "sessionId": session_id,
                "token": token,
                "expires": int(expires_at),
            }
            qr_payload = json.dumps(qr_meta)
            qr_data_url = generate_qr_data_url(qr_payload)

            self._sessions[session_id] = {
                "session_id": session_id,
                "token": token,
                "created_at": created_at,
                "expires_at": expires_at,
                "status": "WAITING",
                "image_bytes": None,
                "content_type": None,
                "filename": None,
                "consumed": False,
            }

            logger.info(f"[SESSION CREATE] Created session {session_id} (TTL: {session_ttl}s)")
            return {
                "session_id": session_id,
                "token": token,
                "endpoint": endpoint,
                "expires_at": int(expires_at),
                "expires_in": int(session_ttl),
                "qr_payload": qr_meta,
                "qr_data_url": qr_data_url,
                "status": "WAITING",
            }

    def get_session(self, session_id: str) -> Tuple[int, dict]:
        """Returns the current status of a session."""
        with self._lock:
            self._cleanup_expired_locked()
            if session_id in self._recently_expired:
                return 410, {"error": "Session expired", "status": "EXPIRED"}

            s = self._sessions.get(session_id)
            if not s:
                return 404, {"error": "Session not found", "status": "NOT_FOUND"}

            now = time.time()
            if now > s["expires_at"]:
                del self._sessions[session_id]
                self._recently_expired[session_id] = now
                return 410, {"error": "Session expired", "status": "EXPIRED"}

            return 200, {
                "session_id": session_id,
                "status": s["status"],
                "expires_in": max(0, int(s["expires_at"] - now)),
                "has_image": s["image_bytes"] is not None,
            }

    def get_latest_waiting_session(self) -> Tuple[int, dict]:
        """Returns the most recent active waiting session."""
        with self._lock:
            self._cleanup_expired_locked()
            waiting = [s for s in self._sessions.values() if s["status"] in ("WAITING", "PAIRED")]
            if not waiting:
                return 404, {"error": "No active waiting session found"}
            latest = max(waiting, key=lambda x: x["created_at"])
            return 200, {
                "session_id": latest["session_id"],
                "token": latest["token"],
                "status": latest["status"],
                "expires_in": max(0, int(latest["expires_at"] - time.time())),
            }

    def mark_paired(self, session_id: str, token: Optional[str] = None) -> Tuple[int, dict]:
        """Transitions session to PAIRED status."""
        with self._lock:
            self._cleanup_expired_locked()
            if session_id in self._recently_expired:
                return 410, {"error": "Session expired", "status": "EXPIRED"}

            s = self._sessions.get(session_id)
            if not s:
                return 404, {"error": "Session not found", "status": "NOT_FOUND"}
            if time.time() > s["expires_at"]:
                del self._sessions[session_id]
                self._recently_expired[session_id] = time.time()
                return 410, {"error": "Session expired", "status": "EXPIRED"}
            if token and s["token"] != token:
                return 403, {"error": "Invalid session token"}

            if s["status"] == "WAITING":
                s["status"] = "PAIRED"
                logger.info(f"[SESSION PAIRED] Session {session_id} marked as PAIRED")
            return 200, {
                "session_id": session_id,
                "status": s["status"],
                "expires_in": max(0, int(s["expires_at"] - time.time())),
            }

    def upload_image(
        self,
        session_id: str,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        token: Optional[str] = None
    ) -> Tuple[int, dict]:
        """Stores captured image bytes in session memory. Enforces single-use."""
        with self._lock:
            self._cleanup_expired_locked()
            if session_id in self._recently_expired:
                return 410, {"error": "Session expired", "status": "EXPIRED"}

            s = self._sessions.get(session_id)
            if not s:
                return 404, {"error": "Session not found", "status": "NOT_FOUND"}

            if time.time() > s["expires_at"]:
                del self._sessions[session_id]
                self._recently_expired[session_id] = time.time()
                return 410, {"error": "Session expired", "status": "EXPIRED"}

            if token and s["token"] != token:
                logger.warning(f"[SESSION UPLOAD] Token mismatch for {session_id}")
                return 403, {"error": "Invalid session token"}

            if s["status"] == "UPLOADED" or s["image_bytes"] is not None:
                logger.warning(f"[SESSION UPLOAD] Duplicate upload rejected for {session_id}")
                return 409, {"error": "Single-use session: Image already uploaded", "status": "UPLOADED"}

            if s["consumed"]:
                return 410, {"error": "Session already consumed", "status": "CONSUMED"}

            s["image_bytes"] = file_bytes
            s["filename"] = filename or "mobile_qr.png"
            s["content_type"] = content_type or "image/png"
            s["status"] = "UPLOADED"
            logger.info(f"[SESSION UPLOAD] Uploaded {len(file_bytes)} bytes to session {session_id}")
            return 200, {
                "success": True,
                "session_id": session_id,
                "status": "UPLOADED",
                "bytes_received": len(file_bytes)
            }

    def consume_image(self, session_id: str) -> Tuple[int, Optional[bytes], Optional[str], Optional[str], Optional[dict]]:
        """Retrieves and immediately discards the staged image bytes, freeing memory."""
        with self._lock:
            self._cleanup_expired_locked()
            s = self._sessions.get(session_id)
            if not s:
                return 404, None, None, None, {"error": "Session not found"}

            if time.time() > s["expires_at"]:
                del self._sessions[session_id]
                return 410, None, None, None, {"error": "Session expired"}

            if s["status"] != "UPLOADED" or s["image_bytes"] is None:
                if s["consumed"]:
                    return 410, None, None, None, {"error": "Image already consumed"}
                return 404, None, None, None, {"error": "No image uploaded yet"}

            image_bytes = s["image_bytes"]
            filename = s["filename"]
            content_type = s["content_type"]

            # Remove session completely from memory to guarantee zero persistence
            del self._sessions[session_id]
            logger.info(f"[SESSION CONSUME] Image consumed and memory freed for {session_id}")
            return 200, image_bytes, filename, content_type, None


# Session manager singleton
session_manager = SessionManager(ttl_seconds=SESSION_TTL_SECONDS)


# =============================================================================
# HTTP Request Handler
# =============================================================================
class DeepQRRequestHandler(BaseHTTPRequestHandler):
    """Minimal HTTP request handler for DeepQR Shield inference & mobile companion pairing."""

    server_version = "DeepQRShield/1.1"

    def log_message(self, format, *args):
        """Route standard HTTP server logs to custom logger."""
        logger.debug(f"{self.address_string()} - {format % args}")

    def send_json(self, status_code: int, data: dict, close_connection: bool = False):
        """Sends a JSON response with appropriate headers and status code."""
        response_bytes = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        if close_connection:
            self.send_header("Connection", "close")
        # CORS headers for local Vite and React Native companion integration
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Session-Token")
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_OPTIONS(self):
        """Handles CORS preflight requests."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Session-Token")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        """Handles GET requests (health check, session status, and staged image retrieval)."""
        clean_path = self.path.split("?")[0].rstrip("/")

        # Health endpoint
        if clean_path in ("/api/health", ""):
            health_data = {
                "status": "healthy",
                "service": "DeepQR Shield Backend",
                "engine_ready": engine is not None,
                "device": str(engine.device) if engine else "none"
            }
            self.send_json(200, health_data)
            return

        # Latest active session query for USB companion pairing
        if clean_path == "/api/session/latest":
            status_code, data = session_manager.get_latest_waiting_session()
            self.send_json(status_code, data)
            return

        # Session status or image retrieval
        if clean_path.startswith("/api/session/"):
            parts = clean_path.strip("/").split("/")
            # GET /api/session/<session_id>
            if len(parts) == 3:
                session_id = parts[2]
                status_code, data = session_manager.get_session(session_id)
                self.send_json(status_code, data)
                return

            # GET /api/session/<session_id>/image
            if len(parts) == 4 and parts[3] == "image":
                session_id = parts[2]
                status_code, img_bytes, filename, c_type, err_data = session_manager.consume_image(session_id)
                if status_code != 200:
                    self.send_json(status_code, err_data or {"error": "Image retrieval failed"})
                    return

                self.send_response(200)
                self.send_header("Content-Type", c_type or "image/png")
                self.send_header("Content-Length", str(len(img_bytes)))
                self.send_header("Content-Disposition", f'inline; filename="{filename}"')
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
                self.end_headers()
                self.wfile.write(img_bytes)
                return

        self.send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        """Handles POST requests (/api/analyze, /api/session/create, /api/session/<id>/upload, /api/session/<id>/pair)."""
        clean_path = self.path.split("?")[0].rstrip("/")

        # Create session
        if clean_path == "/api/session/create":
            lan_ip = get_lan_ip()
            ttl_header = self.headers.get("X-Session-TTL")
            ttl_val = None
            if ttl_header:
                try:
                    ttl_val = int(ttl_header)
                except ValueError:
                    pass
            session_info = session_manager.create_session(host=lan_ip, port=DEFAULT_PORT, ttl=ttl_val)
            self.send_json(201, session_info)
            return

        # Session actions
        if clean_path.startswith("/api/session/"):
            parts = clean_path.strip("/").split("/")
            if len(parts) == 4 and parts[3] == "pair":
                session_id = parts[2]
                token = self.headers.get("X-Session-Token")
                status_code, data = session_manager.mark_paired(session_id, token)
                self.send_json(status_code, data)
                return

            if len(parts) == 4 and parts[3] == "upload":
                session_id = parts[2]
                self._handle_session_upload(session_id)
                return

            self.send_json(404, {"error": "Session endpoint not found"})
            return

        # Canonical analysis endpoint
        if clean_path == "/api/analyze":
            self._handle_analyze()
            return

        self.send_json(404, {"error": "Endpoint not found"})

    def _handle_session_upload(self, session_id: str):
        """Handles image upload from mobile companion into the active session."""
        content_length_header = self.headers.get("Content-Length")
        if not content_length_header:
            logger.warning("[SESSION UPLOAD REJECT] Missing Content-Length")
            self.send_json(411, {"error": "Length Required: Missing Content-Length header"})
            return

        try:
            content_length = int(content_length_header)
        except ValueError:
            logger.warning("[SESSION UPLOAD REJECT] Invalid Content-Length")
            self.send_json(400, {"error": "Bad Request: Invalid Content-Length header"})
            return

        if content_length <= 0:
            logger.warning("[SESSION UPLOAD REJECT] Empty request body")
            self.send_json(400, {"error": "Bad Request: Request body is empty"})
            return

        if content_length > MAX_UPLOAD_SIZE:
            logger.warning(f"[SESSION UPLOAD REJECT] File too large: {content_length} bytes > {MAX_UPLOAD_SIZE} limit")
            try:
                remaining = content_length
                while remaining > 0:
                    chunk = self.rfile.read(min(remaining, 65536))
                    if not chunk:
                        break
                    remaining -= len(chunk)
            except Exception:
                pass
            self.send_json(413, {
                "error": f"Payload Too Large: File exceeds maximum allowed size of {MAX_UPLOAD_SIZE // (1024 * 1024)} MB"
            }, close_connection=True)
            return

        # Check session status before parsing
        status_code, session_check = session_manager.get_session(session_id)
        if status_code != 200:
            try:
                self.rfile.read(content_length)
            except Exception:
                pass
            self.send_json(status_code, session_check)
            return

        # Read body
        try:
            body_bytes = self.rfile.read(content_length)
        except Exception as e:
            logger.error(f"Error reading upload payload: {e}")
            self.send_json(500, {"error": "Internal Server Error reading payload"})
            return

        content_type_header = self.headers.get("Content-Type", "")
        token = self.headers.get("X-Session-Token")
        filename = "mobile_qr.png"
        file_bytes = None
        c_type = "image/png"

        if content_type_header.startswith("multipart/form-data"):
            extracted_filename, extracted_bytes, extracted_token, parse_err = self._extract_file_from_multipart(
                content_type_header, body_bytes
            )
            if parse_err:
                self.send_json(400, {"error": f"Bad Request: {parse_err}"})
                return
            filename = extracted_filename or "mobile_qr.png"
            file_bytes = extracted_bytes
            if extracted_token and not token:
                token = extracted_token
        elif any(content_type_header.startswith(ct) for ct in ("image/png", "image/jpeg", "image/jpg", "image/webp")):
            file_bytes = body_bytes
            c_type = content_type_header.split(";")[0].strip()
            ext = ".jpg" if "jpeg" in c_type or "jpg" in c_type else ".webp" if "webp" in c_type else ".png"
            filename = f"mobile_capture{ext}"
        else:
            self.send_json(400, {
                "error": "Bad Request: Content-Type must be 'multipart/form-data' or image type (image/png, image/jpeg, image/webp)"
            })
            return

        # Extension check
        ext = os.path.splitext(filename)[1].lower() if filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            self.send_json(400, {
                "error": f"Unsupported file type '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            })
            return

        if not file_bytes or len(file_bytes) == 0:
            self.send_json(400, {"error": "Bad Request: Uploaded image file is empty"})
            return

        # Verify actual image content with PIL
        try:
            pil_img = Image.open(BytesIO(file_bytes))
            pil_img.verify()
            # Reopen to test decoding
            pil_img = Image.open(BytesIO(file_bytes))
            pil_img = pil_img.convert("RGB")
        except (UnidentifiedImageError, Exception) as e:
            logger.warning(f"[SESSION UPLOAD REJECT] Malformed image data: {e}")
            self.send_json(400, {
                "error": "Bad Request: Could not parse image. The file content is invalid or corrupted."
            })
            return

        upload_code, resp_data = session_manager.upload_image(
            session_id=session_id,
            file_bytes=file_bytes,
            filename=filename,
            content_type=c_type,
            token=token
        )
        self.send_json(upload_code, resp_data)

    def _handle_analyze(self):
        """Handles POST /api/analyze: existing multimodal ML inference pipeline."""
        content_length_header = self.headers.get("Content-Length")
        if not content_length_header:
            logger.warning("[REJECT] Missing Content-Length header")
            self.send_json(411, {"error": "Length Required: Missing Content-Length header"})
            return

        try:
            content_length = int(content_length_header)
        except ValueError:
            logger.warning("[REJECT] Invalid Content-Length header")
            self.send_json(400, {"error": "Bad Request: Invalid Content-Length header"})
            return

        if content_length <= 0:
            logger.warning("[REJECT] Empty request body")
            self.send_json(400, {"error": "Bad Request: Request body is empty"})
            return

        if content_length > MAX_UPLOAD_SIZE:
            logger.warning(f"[REJECT] Payload too large: {content_length} bytes > {MAX_UPLOAD_SIZE} limit")
            try:
                remaining = content_length
                while remaining > 0:
                    chunk = self.rfile.read(min(remaining, 65536))
                    if not chunk:
                        break
                    remaining -= len(chunk)
            except Exception:
                pass
            self.send_json(413, {
                "error": f"Payload Too Large: File exceeds maximum allowed size of {MAX_UPLOAD_SIZE // (1024 * 1024)} MB"
            }, close_connection=True)
            return

        content_type_header = self.headers.get("Content-Type", "")
        if not content_type_header.startswith("multipart/form-data"):
            logger.warning(f"[REJECT] Unsupported Content-Type: {content_type_header}")
            self.send_json(400, {
                "error": "Bad Request: Content-Type must be 'multipart/form-data'"
            })
            return

        try:
            body_bytes = self.rfile.read(content_length)
        except Exception as e:
            logger.error(f"Error reading request body: {e}")
            self.send_json(500, {"error": "Internal Server Error reading payload"})
            return

        filename, file_bytes, _, parse_error = self._extract_file_from_multipart(
            content_type_header, body_bytes
        )
        if parse_error:
            logger.warning(f"[REJECT] Multipart parsing error: {parse_error}")
            self.send_json(400, {"error": f"Bad Request: {parse_error}"})
            return

        ext = os.path.splitext(filename)[1].lower() if filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            logger.warning(f"[REJECT] Disallowed file extension: '{ext}' for file '{filename}'")
            self.send_json(400, {
                "error": f"Unsupported file type '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            })
            return

        if not file_bytes or len(file_bytes) == 0:
            logger.warning(f"[REJECT] Empty file payload for file '{filename}'")
            self.send_json(400, {"error": "Bad Request: Uploaded image file is empty"})
            return

        try:
            pil_image = Image.open(BytesIO(file_bytes))
            pil_image = pil_image.convert("RGB")
        except (UnidentifiedImageError, Exception) as e:
            logger.warning(f"[REJECT] Malformed image data for '{filename}': {e}")
            self.send_json(400, {
                "error": "Bad Request: Could not parse image. The file content is invalid or corrupted."
            })
            return

        if engine is None:
            logger.error("Engine singleton not initialized")
            self.send_json(500, {"error": "Internal Server Error: Inference engine not ready"})
            return

        try:
            inference_result = engine.analyze_image(pil_image, image_name=filename)
        except Exception as e:
            logger.error(f"Inference execution failed on '{filename}': {e}", exc_info=True)
            self.send_json(500, {"error": f"Inference processing error: {str(e)}"})
            return

        decoded = inference_result.get("qr_decoded", False)
        payload = inference_result.get("decoded_payload")
        if decoded and payload:
            payload_log = payload[:24] + ("..." if len(payload) > 24 else "")
        else:
            payload_log = "none"

        logger.info(
            f"[ANALYZE OK] file='{filename}' visual={inference_result['visual_class']} "
            f"decoded={decoded} payload_preview='{payload_log}' "
            f"final={inference_result['final_class']} risk_score={inference_result['risk_score']}"
        )

        self.send_json(200, inference_result)

    def _extract_file_from_multipart(
        self, content_type_header: str, body_bytes: bytes
    ) -> Tuple[Optional[str], Optional[bytes], Optional[str], Optional[str]]:
        """
        Extracts uploaded file bytes, filename, and token from multipart/form-data.
        Returns: (filename, file_bytes, token, error_message)
        """
        try:
            headers = f"Content-Type: {content_type_header}\r\n\r\n".encode("utf-8")
            msg = email.parser.BytesParser().parsebytes(headers + body_bytes)
        except Exception as e:
            return None, None, None, f"Failed to parse multipart data: {str(e)}"

        if not msg.is_multipart():
            return None, None, None, "Payload is not a valid multipart message"

        found_file = None
        found_bytes = None
        found_token = None

        for part in msg.get_payload():
            disp = part.get("Content-Disposition", "")
            filename = part.get_filename()
            if 'name="token"' in disp:
                try:
                    found_token = part.get_payload(decode=True).decode("utf-8").strip()
                except Exception:
                    pass
            elif filename:
                found_file = filename
                found_bytes = part.get_payload(decode=True)
            elif 'name="file"' in disp or 'name="image"' in disp:
                c_type = part.get_content_type()
                ext = ".png" if "png" in c_type else ".jpg" if "jpeg" in c_type else ".webp"
                found_file = f"upload{ext}"
                found_bytes = part.get_payload(decode=True)

        if found_bytes is not None:
            return found_file, found_bytes, found_token, None

        return None, None, found_token, "No image file part found in multipart request"


# =============================================================================
# Server Entrypoint
# =============================================================================
def run_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT):
    """Initializes models and runs the local HTTP server."""
    global engine

    print("=" * 70)
    print("DeepQR Shield - Local Inference Backend Server")
    print("=" * 70)

    # Initialize model singleton ONCE before binding server
    engine = init_engine()

    lan_ip = get_lan_ip()
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, DeepQRRequestHandler)

    print(f"\n[SERVER READY] Listening on http://{host}:{port}")
    print(f"[LOCAL ACCESS] http://127.0.0.1:{port}")
    print(f"[LAN ACCESS]   http://{lan_ip}:{port}")
    print(f"[ENDPOINT]     POST http://{host}:{port}/api/analyze")
    print(f"[SESSION]      POST http://{host}:{port}/api/session/create")
    print(f"[HEALTH]       GET  http://{host}:{port}/api/health")
    print("[SECURITY]     Offline inference active. Mobile pairing active.")
    print("Press Ctrl+C to terminate server.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[SERVER STOPPED] Shutting down cleanly.")
        httpd.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DeepQR Shield Local HTTP Backend")
    parser.add_argument("--host", type=str, default=DEFAULT_HOST, help="Host to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to bind (default: 8000)")
    args = parser.parse_args()

    run_server(host=args.host, port=args.port)
