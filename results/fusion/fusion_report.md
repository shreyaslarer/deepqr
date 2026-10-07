# DeepQR Shield — Multimodal Decision-Level Fusion Report

## 1. Executive Summary & Design Rationale
In accordance with project constraints, the **QR image dataset** (visual threats and physical module tampering) and the **URL dataset** (textual phishing/malicious domains) are **unpaired**. 

To preserve scientific rigor without synthesizing artificial pairings, DeepQR Shield implements **transparent, rule-based decision-level fusion**. Neither model was retrained, no additional neural network was introduced, and no automated URL network resolution was performed.

---

## 2. Decision Logic & Baseline Fusion Formulation

### A. Modality Scoring
1. **Visual Score**:
   $$P_{\text{visual}}(\text{malicious}) + P_{\text{visual}}(\text{tampered})$$
   *When visual prediction is tampered, the probability contributes to suspicious alert generation.*
2. **URL Score** (active only when a valid URL is decoded):
   $$P_{\text{url}}(\text{malicious})$$

### B. Weighted Combination (When URL Decoded)
$$\text{final\_malicious\_score} = 0.5 \times \text{visual\_malicious\_score} + 0.5 \times \text{url\_malicious\_score}$$
*> **Note**: The 0.5 / 0.5 weighting represents a baseline academic fusion rule, not an empirically overfitted parameter.*

### C. Threshold Decision Rules
* If a URL is successfully decoded:
  * **Score $\ge 0.70$** $\rightarrow$ `MALICIOUS`
  * **$0.40 \le \text{Score} < 0.70$** $\rightarrow$ `SUSPICIOUS`
  * **Score $< 0.40$** $\rightarrow$ `SAFE`
* If no URL is decoded (or payload is non-URL):
  * **Visual Benign** $\rightarrow$ `SAFE`
  * **Visual Malicious** $\rightarrow$ `MALICIOUS`
  * **Visual Tampered** $\rightarrow$ `SUSPICIOUS`

---

## 3. Independent Branch Evaluations

### Branch 1 — Visual CNN (ResNet18)
* Evaluated on all **342 clean test QR images** (`data/clean_qr/test/`):
  * **Accuracy**: **100.00%** (342 / 342)
  * **Macro F1**: **1.0000**
  * **Benign Recall**: **100.00%** (103 / 103)
  * **Malicious Recall**: **100.00%** (119 / 119)
  * **Tampered Recall**: **100.00%** (120 / 120)

### Branch 2 — URL Character CNN (URLCharCNN)
* Evaluated on **7,500 held-out URL strings** (`data/url/` held-out test split):
  * **Accuracy**: **94.36%** (7,077 / 7,500)
  * **Macro F1**: **94.35%**
  * **Malicious Recall**: **97.55%** (3,658 / 3,750)
  * **Benign Recall**: **91.17%** (3,419 / 3,750)
  * **Critical Malicious False Negatives**: **92 / 3,750 (2.45%)**

---

## 4. Multimodal Fusion Demonstration on Test QR Codes (342 Images)

### Decoding & Payload Statistics
* **Total Test Images**: 342
* **Successfully Decoded by OpenCV**: **195 (57.02%)**
* **Not Decoded**: **147 (42.98%)**
* **Decoded URL Payloads**: **77**
* **Decoded Non-URL Payloads (VCARD, WiFi, Text, Corrupted noise)**: **118**

### Final Fusion Decision Distribution
| Final Class | Total Count | Percentage |
| :--- | :---: | :---: |
| **SAFE** | 98 | 28.65% |
| **SUSPICIOUS** | 128 | 37.43% |
| **MALICIOUS** | 116 | 33.92% |

### Ground-Truth Subgroup Analysis
* **Benign Test QR Codes (103 total)**:
  * 94 decoded (30 URLs, 64 non-URLs), 9 undecoded.
  * Final decisions: **98 SAFE**, **5 SUSPICIOUS**, **0 MALICIOUS**.
* **Malicious Test QR Codes (119 total)**:
  * 47 decoded (all 47 URLs), 72 undecoded.
  * Final decisions: **116 MALICIOUS**, **3 SUSPICIOUS**, **0 SAFE**.
* **Tampered Test QR Codes (120 total)**:
  * 54 decoded (all 54 corrupted non-URLs), 66 undecoded.
  * Final decisions: **120 SUSPICIOUS**, **0 MALICIOUS**, **0 SAFE**.

---

## 5. Critical Scientific Limitation
Because the visual QR code dataset and URL dataset originated from separate sources and were not paired with simultaneous ground-truth labels across both modalities:
1. The fusion pipeline is designed as an **operational decision engine** rather than a joint probabilistic model.
2. The final fusion distribution demonstrates that **the multi-tiered decision logic executes correctly** under all real-world conditions (decoder failure, non-URL payloads, and dual-modality agreement/disagreement).
3. No artificial "paired multimodal accuracy" metric is manufactured.
