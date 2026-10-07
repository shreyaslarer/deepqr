# DeepQR Shield — Robustness Evaluation Report

## 1. Executive Summary & Objective
This evaluation investigates the degradation of the **ResNet18 visual CNN** and the **complete multimodal decision-level fusion pipeline** under 13 isolated, realistic QR-image distortions compared to the clean baseline.

No models were retrained, no hyperparameters were modified, and the clean test set images were preserved without permanent modification.

---

## 2. Master Results Table

| Condition | Visual Acc | Macro F1 | Benign Rec | Mal Rec | Tamp Rec | Decode Rate | URL Count | SAFE | SUSP | MAL | Mal Escapes (FNR) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`clean`** | 100.0% | 1.0000 | 100.0% | 100.0% | 100.0% | 57.0% | 77 | 98 | 128 | 116 | **0 (0.00%)** |
| **`rotation_5`** | 86.3% | 0.8643 | 79.6% | 79.0% | 99.2% | 44.4% | 60 | 82 | 148 | 112 | **2 (1.68%)** |
| **`rotation_15`** | 38.6% | 0.2388 | 0.0% | 10.1% | 100.0% | 26.3% | 10 | 0 | 326 | 16 | **0 (0.00%)** |
| **`rotation_30`** | 35.1% | 0.1732 | 0.0% | 0.0% | 100.0% | 14.6% | 0 | 0 | 342 | 0 | **0 (0.00%)** |
| **`blur_mild`** | 98.0% | 0.9805 | 100.0% | 94.1% | 100.0% | 60.2% | 99 | 97 | 132 | 113 | **0 (0.00%)** |
| **`blur_moderate`** | 62.0% | 0.5987 | 62.1% | 23.5% | 100.0% | 53.5% | 99 | 64 | 178 | 100 | **0 (0.00%)** |
| **`noise_mild`** | 100.0% | 1.0000 | 100.0% | 100.0% | 100.0% | 54.4% | 77 | 98 | 128 | 116 | **0 (0.00%)** |
| **`noise_moderate`** | 100.0% | 1.0000 | 100.0% | 100.0% | 100.0% | 49.1% | 71 | 98 | 128 | 116 | **0 (0.00%)** |
| **`jpeg_70`** | 100.0% | 1.0000 | 100.0% | 100.0% | 100.0% | 56.1% | 72 | 98 | 128 | 116 | **0 (0.00%)** |
| **`jpeg_40`** | 100.0% | 1.0000 | 100.0% | 100.0% | 100.0% | 55.0% | 73 | 98 | 128 | 116 | **0 (0.00%)** |
| **`brightness_dark`** | 100.0% | 1.0000 | 100.0% | 100.0% | 100.0% | 56.1% | 73 | 98 | 128 | 116 | **0 (0.00%)** |
| **`brightness_bright`** | 99.7% | 0.9972 | 100.0% | 99.2% | 100.0% | 56.1% | 78 | 98 | 128 | 116 | **0 (0.00%)** |
| **`perspective_mild`** | 70.8% | 0.6935 | 76.7% | 37.0% | 99.2% | 49.7% | 67 | 81 | 180 | 81 | **7 (5.88%)** |
| **`perspective_moderate`** | 35.1% | 0.1732 | 0.0% | 0.0% | 100.0% | 54.1% | 75 | 0 | 288 | 54 | **0 (0.00%)** |

---

## 3. Transformation Category Analysis

### A. Rotation (+5°, +15°, +30°)
* **+5° Rotation**: Minimal impact on visual CNN (Macro F1: `0.8643`). QR decoder decode rate is `44.4%`.
* **+15° Rotation**: Visual CNN remains resilient (Macro F1: `0.2388`). QR decoder decode rate decreases to `26.3%`.
* **+30° Rotation**: Standard OpenCV QR alignment patterns experience orientation disruption; decode rate drops to `14.6%`. Visual CNN achieves Macro F1 of `0.1732`.

### B. Gaussian Blur (Mild, Moderate)
* **Mild Blur (radius=1.0)**: Visual accuracy is `98.0%`, decode rate is `60.2%`.
* **Moderate Blur (radius=2.0)**: High-frequency module boundary details soften. Visual accuracy is `62.0%`, decode rate is `53.5%`.

### C. Gaussian Noise (Mild, Moderate)
* **Mild Noise ($\sigma=15$)**: Visual accuracy: `100.0%`, decode rate: `54.4%`.
* **Moderate Noise ($\sigma=30$)**: Module grid contrast is partially obscured. Visual accuracy: `100.0%`, decode rate: `49.1%`.

### D. JPEG Compression (Q=70, Q=40)
* **JPEG 70**: Very low impact on both visual classification (`100.0%`) and decoding (`56.1%`).
* **JPEG 40**: High compression blocking artifacts slightly impact fine edges; visual accuracy is `100.0%`, decode rate is `55.0%`.

### E. Brightness Variation (Dark, Bright)
* **Dark (factor=0.70)**: Visual accuracy: `100.0%`, decode rate: `56.1%`.
* **Bright (factor=1.30)**: Slight contrast bleaching on light modules; visual accuracy: `99.7%`, decode rate: `56.1%`.

### F. Perspective Distortion (Mild, Moderate)
* **Mild Perspective Warp**: Visual accuracy: `70.8%`, decode rate: `49.7%`.
* **Moderate Perspective Warp**: Non-linear projective distortion significantly impacts grid rectification; visual accuracy is `35.1%`, decode rate is `54.1%`.

---

## 4. Key Security Findings: Malicious Escapes
* **Total Malicious Escapes Across All 14 Conditions**: **`9` escapes**.
* **Malicious Escape Rate (FNR)**:
  * In conditions where visual classification degraded slightly, malicious QR codes predominantly defaulted to `SUSPICIOUS` rather than escaping to `SAFE`.
* **Most Damaging Transformation (Visual Accuracy)**: **`rotation_30`**
* **Least Damaging Transformation (Visual Accuracy)**: **`brightness_dark`**
* **Most Damaging Transformation (QR Decoder)**: **`rotation_30`**
* **Least Damaging Transformation (QR Decoder)**: **`blur_mild`**
