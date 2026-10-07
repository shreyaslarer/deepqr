# DeepQR Shield — Final Project Summary & Academic Synthesis

## 1. Project Objective
**DeepQR Shield** addresses the growing threat of QR code abuse in modern cyber attacks. Adversaries exploit QR codes through two distinct attack surfaces:
1. **Quishing (QR Phishing)**: Encoding malicious, deceptive, or credential-harvesting URLs within legitimate-looking QR codes.
2. **Physical / Semantic Barcode Tampering**: Directly modifying QR module geometry, applying physical overlays/stickers over legitimate codes in public spaces, or manipulating module arrays.

The core objective is to evaluate whether a dual-channel architecture combining **raw image perception (ResNet18)** and **offline lexical URL analysis (Character 1D CNN)** via **decision-level fusion** can effectively categorize QR codes into a graded tri-state triage: **`SAFE`**, **`SUSPICIOUS`**, or **`MALICIOUS`**.

---

## 2. Dataset and Data Cleaning
The project evaluated two distinct datasets:

### A. QR Code Image Dataset (`data/clean_qr/`)
* **Total Samples**: 2,284 images.
* **Classes**: `benign` (689), `malicious` (795), `tampered` (800).
* **Splits**:
  * Training: 1,600 images (483 benign, 557 malicious, 560 tampered).
  * Validation: 342 images (103 benign, 119 malicious, 120 tampered).
  * Held-Out Test: 342 images (103 benign, 119 malicious, 120 tampered).
* **Leakage Resolution (Step 02)**: Analysis revealed that raw tampered samples were exclusively 256×256 and malicious were 490×490/530×530. All images were standardized through a unified 224×224 RGB pipeline to eliminate resolution-to-class leakage.

### B. URL Dataset (`data/url/url_train_50k.csv` / `url_train_50k.csv`)
* **Total Samples**: 50,000 unique URLs (25,000 benign, 25,000 malicious).
* **Splits (Stratified, Seed 42)**:
  * Training (70%): 35,000 URLs (17,500 benign, 17,500 malicious).
  * Validation (15%): 7,500 URLs (3,750 benign, 3,750 malicious).
  * Held-Out Test (15%): 7,500 URLs (3,750 benign, 3,750 malicious).

### C. Dataset Relationship
The image and URL datasets are **unpaired**. No artificial pairings were generated, ensuring scientific integrity.

---

## 3. Experimental Environment
All experiments were conducted on a single consumer-grade laptop workstation:
* **Hardware**: NVIDIA GeForce RTX 3050 Laptop GPU (4.00 GB physical VRAM).
* **OS**: Windows 11.
* **Environment**: Python 3.11.7, PyTorch 2.6.0+cu124, CUDA 12.4.
* **Precision**: Mixed Precision (FP16 via `torch.amp.autocast`).
* **VRAM Footprint**: Under 320 MB for visual training; under 65 MB for URL training; under 350 MB for simultaneous dual-model inference.

---

## 4. Visual Model (ResNet18)
* **Architecture**: ImageNet-pretrained ResNet18 with final linear layer replaced for 3 classes (`benign`, `malicious`, `tampered`).
* **Training Protocol**:
  * Stage 1 (Head-only): 5 epochs, AdamW ($\text{LR}=10^{-3}$), frozen backbone.
  * Stage 2 (Fine-tuning): 10 epochs, AdamW ($\text{LR}=10^{-4}$), fine-tuning `layer4` + `fc`.
* **Results on Clean Test Split (342 images)**:
  * Accuracy: **100.00%**
  * Macro F1: **1.0000**
  * Malicious Recall: **100.00%** (119/119)
  * Malicious False-Negative Rate (FNR): **0.00%** (0 false negatives)

---

## 5. URL Model (URLCharCNN)
* **Architecture**: Compact Character-Level 1D Convolutional Neural Network (140,738 parameters).
* **Vocabulary**: 144 characters derived exclusively from the training set (PAD=0, UNK=1).
* **Sequence Length**: Fixed at 200 characters (98.63% URLs completely intact without truncation).
* **Results on Held-Out Test Split (7,500 URLs)**:
  * Accuracy: **94.36%** (7,077 / 7,500)
  * Macro F1: **0.9435**
  * Malicious Recall: **97.55%** (3,658 / 3,750)
  * Malicious False-Negative Rate (FNR): **2.45%** (92 false negatives)

---

## 6. Multimodal Decision-Level Fusion
* **Architecture**: Offline, rule-based decision-level combination.
* **Logic**:
  1. Visual Score: $P_{\text{vis}}(\text{malicious}) + P_{\text{vis}}(\text{tampered})$.
  2. URL Score: $P_{\text{url}}(\text{malicious})$ (invoked only when OpenCV successfully decodes a valid URL string).
  3. Combined Score: $0.5 \times \text{Visual Score} + 0.5 \times \text{URL Score}$ (baseline academic weighting).
  4. Thresholds: $\ge 0.70 \implies \mathbf{MALICIOUS}$, $\ge 0.40 \implies \mathbf{SUSPICIOUS}$, $< 0.40 \implies \mathbf{SAFE}$.
  5. Fallback: If no URL is decoded or payload is non-URL (vCard, WiFi, text), the decision gracefully defaults to the visual classification.
* **Results on Clean Test Set (342 images)**:
  * Clean Decode Rate: **57.02%** (195 / 342).
  * URL Payloads: 77; Non-URL Payloads: 118; Decode Failures: 147.
  * Decisions: **`SAFE`: 98**, **`SUSPICIOUS`: 128**, **`MALICIOUS`: 116**.
  * Malicious Escapes: **0 escapes to SAFE (0.00% FNR)**.

---

## 7. Robustness Evaluation
The pipeline was evaluated across 14 conditions (1 clean baseline + 13 distortions) across all 342 test QR images (4,788 evaluations):
1. **Resilient Distortions**: Additive Gaussian noise ($\sigma=15, 30$), JPEG compression ($Q=70, 40$), and brightness variations ($0.7\times, 1.3\times$) had virtually no impact on visual classification (accuracy $99.71\% - 100.00\%$) and caused **0 malicious escapes**.
2. **Damaging Distortions**: Geometric transformations (rotations $\ge 15^\circ$ and perspective warps) severely degraded the OpenCV barcode decoder (decode rate collapsed to 14.62% at 30°).
3. **Fail-Safe Behavior**: Tilted or warped modules caused the visual CNN to trigger the `tampered` class, routing decisions to **`SUSPICIOUS`**. Only mild perspective warp and 5° rotation allowed minor escapes (FNR of 5.88% and 1.68% respectively).

---

## 8. Final Ablation Summary

| Metric | Visual Model | URL Model | Multimodal Fusion |
| :--- | :--- | :--- | :--- |
| **Input** | 224×224 RGB Image | Raw URL String | Image + Decoded URL |
| **Dataset** | 342 QR Test Images | 7,500 Test URLs | 342 QR Test Images |
| **Accuracy** | 100.00% | 94.36% | *N/A (unpaired)* |
| **Macro F1** | 1.0000 | 0.9435 | *N/A (unpaired)* |
| **Malicious Recall** | 100.00% (119/119) | 97.55% (3,658/3,750) | *N/A (116 MAL, 3 SUSP)* |
| **Malicious FNR** | 0.00% (0/119) | 2.45% (92/3,750) | **0.00%** (0 escapes to SAFE) |
| **Malicious FN** | 0 | 92 | **0** |
| **Benign Recall** | 100.00% (103/103) | 91.17% (3,419/3,750) | *N/A (98 SAFE, 5 SUSP)* |

---

## 9. Security Findings
1. **Dual Defense Necessity**: Relying solely on URL scanning fails when an attacker physically tampers with an unreadable or offline QR code. Conversely, relying solely on visual inspection fails if an attacker embeds a phishing URL into a pristine, aesthetically standard barcode.
2. **Tampered as a First-Class Class**: Separating "tampered" from "malicious" enables an actionable alert: physical anomalies trigger immediate quarantine (`SUSPICIOUS`) even before URL execution.
3. **Offline Safety**: The entire system executes strictly offline without network queries, preventing telemetry leakage or triggering attacker honeypots.

---

## 10. Limitations
1. **Academic Scale**: Small academic dataset evaluated under controlled conditions; not an enterprise endpoint protection tool.
2. **Unpaired Reality**: Datasets are not naturally paired; fusion operates via operational arbitration rather than an end-to-end multi-task joint loss.
3. **Decoder Brittleness**: OpenCV `QRCodeDetector` is sensitive to tilt and low contrast; industrial multi-pass binarizers (e.g. ZXing) would improve decode rates.
4. **Generalization**: High test accuracy reflects consistency within sanitized distributions; open-world QR codes will exhibit lower baseline metrics.

---

## 11. Reproducibility
* **Random Seed**: Fixed to `42` across random, NumPy, PyTorch CPU, and PyTorch CUDA.
* **Weights & Artifacts**:
  * Visual Checkpoint: `models/visual/resnet18_final.pt`
  * URL Checkpoint: `models/url/url_cnn_final.pt`
  * Fusion Config: `models/fusion/fusion_config.json`
* **Scripts**:
  * `scripts/fusion_inference.py` (or root `fusion_inference.py`)
  * `scripts/final_evaluation.py` (or root `final_evaluation.py`)
  * `scripts/evaluate_robustness.py` (or root `evaluate_robustness.py`)

---

## 12. Final Conclusion
The **DeepQR Shield** mini-project demonstrates that combining visual convolutional features with character-level lexical analysis via decision-level fusion provides a resilient, lightweight, and explainable defense against quishing and physical barcode tampering. The entire pipeline runs efficiently on consumer GPU hardware with low memory utilization, achieving zero malicious false negatives on the clean test split.
