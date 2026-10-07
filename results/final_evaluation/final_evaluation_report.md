# DeepQR Shield — Final ML Evaluation & Ablation Report

## 1. Executive Summary
This document synthesizes the final evaluations across all three constituent machine learning components of the **DeepQR Shield** mini-project:
1. **Visual Model**: ResNet18 trained on sanitized QR codes (`data/clean_qr/`).
2. **URL Model**: Compact Character-level 1D CNN trained on offline URL strings (`data/url/url_train_50k.csv`).
3. **Multimodal Decision Fusion**: Rule-based decision-level fusion layer combining visual and lexical indicators.
4. **Distortion Robustness**: Synthesis of behavioral degradation under 13 realistic physical transformations.

No models were retrained, no weights or thresholds were tuned, and the evaluation reflects strict held-out test splits.

---

## 2. Component 1: Visual-Only Evaluation (ResNet18)

* **Evaluation Split**: Clean QR test set (`data/clean_qr/test/`, 342 total images)
  * Benign: 103 images
  * Malicious: 119 images
  * Tampered: 120 images
* **Visual Accuracy**: **100.00%** (342 / 342)
* **Macro Precision / Recall / F1**: **1.0000 / 1.0000 / 1.0000**
* **Per-Class Breakdown**:
  * **Benign**: Precision: 1.0000 | Recall: 1.0000 | F1: 1.0000 (103/103)
  * **Malicious**: Precision: 1.0000 | Recall: 1.0000 | F1: 1.0000 (119/119)
  * **Tampered**: Precision: 1.0000 | Recall: 1.0000 | F1: 1.0000 (120/120)
* **Confusion Matrix**:
```
                 Predicted Benign   Predicted Malicious   Predicted Tampered
True Benign            103                   0                    0
True Malicious           0                 119                    0
True Tampered            0                   0                  120
```
* **Malicious False Negatives**: **0** (FNR: **0.00%**)

---

## 3. Component 2: URL-Only Evaluation (URLCharCNN)

* **Evaluation Split**: Independent held-out 15% URL test split (7,500 total URLs from `url_train_50k.csv`)
  * Benign: 3,750 URLs
  * Malicious: 3,750 URLs
* **URL Accuracy**: **94.36%** (7,077 / 7,500)
* **Macro Precision / Recall / F1**: **0.9454 / 0.9436 / 0.9435**
* **Per-Class Breakdown**:
  * **Benign**: Precision: 0.9738 | Recall: 0.9117 | F1: 0.9417
  * **Malicious**: Precision: 0.9170 | Recall: 0.9755 | F1: 0.9453 (3,658 / 3,750)
* **Confusion Matrix**:
```
                 Predicted Benign   Predicted Malicious   Total
True Benign           3,419                 331           3,750
True Malicious           92               3,658           3,750
```
* **Malicious False Negatives**: **92** (FNR: **2.45%**)

---

## 4. Component 3: Multimodal Decision-Level Fusion Evaluation

> [!IMPORTANT]
> **Dataset Pairing Limitation Statement**:  
> "The fusion evaluation demonstrates pipeline behavior on the QR test set but does not constitute a conventional paired multimodal classification benchmark."

* **Evaluation Set**: All 342 clean test QR images evaluated through the complete end-to-end pipeline:
  * ResNet18 $ightarrow$ OpenCV QRCodeDetector $ightarrow$ URLCharCNN (if URL decoded) $ightarrow$ Decision Fusion
* **QR Decoding Metrics**:
  * Decode Success Rate: **57.02%** (195 / 342)
  * Decode Failures: **42.98%** (147 / 342)
  * URL Payloads Identified: **77**
  * Non-URL Payloads Identified (VCARD, WiFi, Plain Text, Scrambled): **118**
* **Final Fusion Decision Distribution**:
  * **`SAFE`**: **98** (28.65%)
  * **`SUSPICIOUS`**: **128** (37.43%)
  * **`MALICIOUS`**: **116** (33.92%)
* **Security Transition Audit**:
  * **Malicious $ightarrow$ SAFE Escapes**: **0** (0.00% FNR; 116 marked MALICIOUS, 3 marked SUSPICIOUS)
  * **Benign $ightarrow$ MALICIOUS False Alarms**: **0** (0.00%; 98 marked SAFE, 5 marked SUSPICIOUS)
  * **Tampered $ightarrow$ SAFE False Escapes**: **0** (0.00%; 120 marked SUSPICIOUS)

---

## 5. Ablation Comparison

The following table contrasts the capabilities and limitations of each isolated component:

| Metric | Visual Model (ResNet18) | URL Model (URLCharCNN) | Fusion Pipeline |
| :--- | :--- | :--- | :--- |
| **Evaluation Dataset** | 342 Clean QR Test Images | 7,500 Held-Out URL Strings | 342 Clean QR Test Images |
| **Input Modality** | 224×224 RGB Image | Raw URL Character String | QR Image + Decoded URL (if available) |
| **Accuracy** | 100.00% | 94.36% | *N/A — different evaluation set (unpaired)* |
| **Macro F1** | 1.0000 | 0.9435 | *N/A — different evaluation set (unpaired)* |
| **Malicious Recall** | 100.00% (119/119) | 97.55% (3,658/3,750) | *N/A — different evaluation set (116 MAL, 3 SUSP)* |
| **Malicious FNR** | 0.00% (0/119) | 2.45% (92/3,750) | **0.00%** (0/119 malicious QRs received SAFE) |
| **Malicious FN** | 0 | 92 | **0** (0 escapes to SAFE) |
| **Benign Recall** | 100.00% (103/103) | 91.17% (3,419/3,750) | *N/A — different evaluation set (98 SAFE, 5 SUSP)* |

---

## 6. Security-Focused Interpretation

### A. Which component has the strongest malicious recall?
On its respective domain, the **fine-tuned ResNet18 visual model** achieved 100.00% malicious recall on the clean QR dataset, while the **URL model** achieved 97.55% malicious recall across 3,750 malicious URLs.

### B. Which component has the lowest malicious false-negative rate?
Both the **visual model** and the **multimodal fusion pipeline** achieved a **0.00% malicious FNR** (zero malicious escapes to `SAFE`) on the clean test set. The standalone URL model had an FNR of 2.45% (92 false negatives out of 3,750).

### C. What does the URL model contribute?
The URL model provides a dedicated, lightweight textual lexical defense. In real-world quishing scenarios where an attacker uses an ordinary, pristine QR code (visually indistinguishable from benign) that encodes a phishing URL, visual analysis alone would fail. The URL model inspects the decoded string to detect token-level phishing patterns (e.g., suspicious subdomains, typosquatting, credential harvesting paths).

### D. What does the visual model contribute?
The visual model provides direct physical perception of the QR code itself. It detects:
1. Physical tampering / overlay attacks (pasted modules, stickers, barcode splice).
2. Visual artifacts associated with malicious QR generation pipelines.
3. Rapid triage when the QR code is unreadable or non-functional.

### E. What does fusion contribute?
Fusion bridges perception and content. By combining visual threat probability ($P_{\text{vis}}(\text{mal}) + P_{\text{vis}}(\text{tamp})$) with lexical threat probability ($P_{\text{url}}(\text{mal})$) via a 0.5/0.5 weighted rule and dual thresholds (0.40 / 0.70):
* It generates a graded tri-state triage (`SAFE`, `SUSPICIOUS`, `MALICIOUS`).
* It prevents conflicting signals from blindly trusting a single sensor.
* It safely defaults suspicious/tampered cases without letting threats slip to `SAFE`.

### F. What happens when a QR cannot be decoded?
When the OpenCV QRCodeDetector fails (which occurred on 42.98% of clean test QRs and up to 85.38% under 30° rotation), the system gracefully falls back to the **visual prediction**:
* Visual benign $ightarrow$ `SAFE`
* Visual malicious $ightarrow$ `MALICIOUS`
* Visual tampered $ightarrow$ `SUSPICIOUS`  
The URL model is bypassed without crashing or producing synthetic hallucinated scores.

### G. What happens when the payload is not a URL?
When a QR code encodes non-URL data (e.g., vCard contact, Wi-Fi configuration, plain text, or scrambled noise from module corruption), the offline regex filter identifies it as non-URL. The URL CNN is not called, avoiding out-of-distribution textual errors, and the system relies on the visual classification.

### H. What is the most important robustness limitation discovered in Step 07?
The most critical vulnerability is **geometric distortion (especially rotation $\ge 15^\circ$ and perspective warp)**:
* Standard QR decoders rely on orthogonal finder pattern alignments; at 30° rotation, OpenCV decode rate collapsed by 42.4% down to 14.6%.
* While the visual CNN shifted predictions to `tampered`/`SUSPICIOUS` (preventing false-negative escapes), genuine benign QR codes also get classified as `SUSPICIOUS` when heavily rotated.

---

## 7. Consolidated Experiment Summary Table

| Dataset / Component | Samples | Model | Accuracy | Macro F1 | Malicious Recall | Malicious FNR | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Visual Model** | 342 images | ResNet18 | 100.00% | 1.0000 | 100.00% | 0.00% | Fine-tuned `layer4` + `fc`; tested on clean QR test set |
| **URL Model** | 7,500 URLs | URLCharCNN | 94.36% | 0.9435 | 97.55% | 2.45% | Compact 1D CNN; tested on held-out 15% URL split |
| **Multimodal Fusion** | 342 images | Rule Fusion | *N/A (unpaired)* | *N/A (unpaired)* | *N/A (unpaired)* | **0.00%** | Baseline 0.5/0.5 weights; 0 malicious escapes to `SAFE` |
| **Robustness (Step 07)**| 4,788 evaluations | Full Pipeline | 35.1% - 100.0% | 0.1732 - 1.0000 | 0.0% - 100.0% | 0.00% - 5.88% | High resilience to noise/JPEG/brightness; geometric tilts trigger decoder failure and shift predictions to `SUSPICIOUS` |

---

## 8. Honest Academic Conclusions & Realistic Limitations
1. **Academic Prototype**: DeepQR Shield is a small academic deep learning mini-project. It is not an enterprise-grade endpoint security client.
2. **Unpaired Data Reality**: Because images and URLs were not captured concurrently in a live telemetry honeypot, the fusion logic represents an architectural proof-of-concept rather than a joint multi-task trained representation.
3. **OpenCV Decoder Bottleneck**: Real-world QR scanner apps utilize multi-pass binarization (e.g., ZXing, ZBar, WeChat QR engine) which out-perform baseline OpenCV on stylized or rotated codes.
