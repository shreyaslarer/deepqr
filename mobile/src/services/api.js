/**
 * DeepQR Shield - Mobile Companion API Service
 * Step 12B-RN: Minimal network communication for mobile pairing and image upload.
 *
 * Rules:
 * - Uses standard fetch & FormData (zero external HTTP libraries).
 * - Only connects to the verified local DeepQR session endpoint.
 * - NEVER opens, navigates to, or fetches scanned QR content destinations.
 * - Ephemeral transmission only; zero persistent local storage.
 */

/**
 * Validates the paired session against the local Python backend.
 * @param {string} endpoint - The session endpoint URL from the pairing QR (e.g., http://172.20.10.5:8000/api/session/s_xyz)
 * @param {string} token - The session security token
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function validateSession(endpoint, token) {
  const tryEndpoint = async (url) => {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (response.status === 410) {
      return { success: false, error: 'Session has expired on desktop. Please generate a new pairing QR.' };
    }
    if (!response.ok) {
      return { success: false, error: `Backend returned error (HTTP ${response.status})` };
    }
    const data = await response.json();
    try {
      await fetch(`${url}/pair`, {
        method: 'POST',
        headers: { 'X-Session-Token': token },
      });
    } catch {}
    return { success: true, data, workingEndpoint: url };
  };

  try {
    return await tryEndpoint(endpoint);
  } catch (err) {
    // If LAN IP failed, attempt USB reverse port forwarded localhost:8000
    try {
      const usbUrl = endpoint.replace(/http:\/\/[^:]+:8000/, 'http://localhost:8000');
      if (usbUrl !== endpoint) {
        return await tryEndpoint(usbUrl);
      }
    } catch {}

    return {
      success: false,
      error: `Cannot reach desktop backend. Ensure phone is connected via USB cable or on the same Wi-Fi.`,
    };
  }
}

/**
 * Uploads captured photographic QR image to the active desktop session.
 * @param {string} endpoint - Session endpoint URL (e.g. http://172.20.10.5:8000/api/session/s_xyz)
 * @param {string} imageUri - Local temporary file URI from expo-camera
 * @param {string} token - Session security token
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function uploadQRImage(endpoint, imageUri, token) {
  try {
    const uploadUrl = `${endpoint}/upload`;

    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: 'mobile_capture.jpg',
      type: 'image/jpeg',
    });

    if (token) {
      formData.append('token', token);
    }

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Session-Token': token || '',
      },
    });

    if (response.status === 409) {
      return { success: false, error: 'Single-use session: Image already uploaded to this session.' };
    }

    if (response.status === 410) {
      return { success: false, error: 'Session expired on desktop. Please re-pair.' };
    }

    if (response.status === 413) {
      return { success: false, error: 'Image exceeds maximum 10 MB payload limit.' };
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      return {
        success: false,
        error: errJson?.error || `Upload failed with HTTP status ${response.status}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: `Network failure during upload: ${err.message || 'Unable to connect to desktop server'}.`,
    };
  }
}
