# DeepQR Shield: Dual-Channel Threat Detection for Malicious and Tampered QR Codes

## 1. Project Title
**DeepQR Shield: Multimodal Decision-Level Threat Detection for Quishing and QR Code Tampering**

---

## 2. Project Objective
Quick Response (QR) codes have become ubiquitous vectors for cybersecurity threats, specifically **Quishing** (QR phishing redirecting users to malicious domains) and **physical tampering** (adversarial overlays, splice modifications, or barcode ablation). Traditional defenses typically rely solely on post-decode URL reputation lookups or basic image-level heuristic checks. 

**DeepQR Shield** implements a dual-channel threat detection architecture:
1. **Visual Channel**: A convolutional neural network (ResNet18) trained directly on raw QR image pixels to detect visual artifacts and physical tampering.
2. **Lexical URL Channel**: A compact character-level 1D CNN trained on raw URL strings to identify phishing/malicious domains without querying external APIs.
3. **Multimodal Fusion Layer**: An offline, rule-based decision-level fusion engine that combines visual and lexical threat signals into a graded tri-state triage (`SAFE`, `SUSPICIOUS`, `MALICIOUS`).

---

## 3. Academic Scope
This project was developed as a focused, lightweight academic Deep Learning mini-project designed to operate within resource-constrained environments (specifically evaluated on an **NVIDIA GeForce RTX 3050 Laptop GPU with 4 GB VRAM**). It avoids heavy transformer architectures, large pre-trained language models, external threat intelligence APIs, and multi-gigabyte production scaffolding.

---

## 4. Dataset Summary
The project utilizes two distinct, specialized datasets:
* **Sanitized QR Image Dataset** (`data/clean_qr/`):
  * Total images: 2,284
  * Classes: `benign` (689), `malicious` (795), `tampered` (800)
  * Splits:
    * `train`: 1,600 images (483 benign, 557 malicious, 560 tampered)
    * `val`: 342 images (103 benign, 119 malicious, 120 tampered)
    * `test`: 342 images (103 benign, 119 malicious, 120 tampered)
* **Cleaned URL Dataset** (`data/url/url_train_50k.csv` / `url_train_50k.csv`):
  * Total unique URLs: 50,000 (exactly balanced: 25,000 benign, 25,000 malicious)
  * Splits (Stratified, Random Seed 42):
    * `train` (70%): 35,000 URLs (17,500 benign, 17,500 malicious)
    * `val` (15%): 7,500 URLs (3,750 benign, 3,750 malicious)
    * `test` (15% held-out): 7,500 URLs (3,750 benign, 3,750 malicious)

---

## 5. Data-Cleaning & Leakage Handling
In Step 02, exploratory analysis revealed a severe **resolution-to-class correlation leakage** in the raw source data:
* Tampered images were exclusively 256×256 pixels.
* Malicious images were predominantly 490×490 or 530×530 pixels.
* Benign images exhibited heterogeneous resolutions.

If uncorrected, CNN backbones would rapidly memorize input tensor aspect ratios rather than learning genuine barcode module features. To guarantee zero data leakage:
1. Every input image is normalized through a unified **224×224 RGB preprocessing pipeline** with standard ImageNet normalization (`mean=[0.485, 0.456, 0.406]`, `std=[0.229, 0.224, 0.225]`).
2. Source files were validated for uniqueness, duplicates were removed, and the held-out test split remained strictly untouched until final evaluation.

---

## 6. Visual Model (ResNet18)
* **Architecture**: ResNet18 pretrained on ImageNet.
* **Modification**: Final fully connected layer (`fc`) replaced with a 3-class linear head (`0: benign`, `1: malicious`, `2: tampered`).
* **Two-Stage Training Strategy**:
  * **Stage 1 (Head-only)**: Backbone frozen; trained `fc` (1,539 parameters) for 5 epochs using AdamW ($\text{LR} = 1\times 10^{-3}$).
  * **Stage 2 (Fine-tuning)**: Earlier layers (`conv1` through `layer3`) remained frozen; fine-tuned `layer4` and `fc` (8,395,267 parameters) for 10 epochs using AdamW ($\text{LR} = 1\times 10^{-4}$).
* **Peak GPU VRAM**: 312 MB.
* **Checkpoint**: `models/visual/resnet18_final.pt`.

---

## 7. URL Model (URLCharCNN)
* **Architecture**: Compact Character-Level 1D Convolutional Neural Network.
* **Layers**:
  * Embedding: 144 vocabulary tokens $\to$ 64-dimensional space (PAD=0, UNK=1).
  * Conv1D Block 1: 128 channels, kernel size 5, padding 2, ReLU, MaxPool1D(2).
  * Conv1D Block 2: 128 channels, kernel size 5, padding 2, ReLU.
  * Global Pooling: AdaptiveMaxPool1d(1).
  * Classification Head: Dropout(0.3) $\to$ Dense(128 $\to$ 64) $\to$ ReLU $\to$ Linear(64 $\to$ 2).
* **Parameters**: 140,738 parameters (~0.54 MB).
* **Sequence Length**: Fixed at 200 characters (captures 98.63% of URLs completely without truncation; only 1.37% truncated).
* **Checkpoint**: `models/url/url_cnn_final.pt`.

---

## 8. Multimodal Decision-Level Fusion
Because the QR image dataset and URL dataset are **unpaired**, fusion is implemented via transparent, rule-based decision logic rather than synthetic multimodal pairings.

```
                  QR Image Input
                        │
       ┌────────────────┴────────────────┐
       ▼                                 ▼
ResNet18 Visual Inference       OpenCV QRCodeDetector
[benign / malicious / tampered]        (Offline)
       │                                 │
       │                   ┌─────────────┴─────────────┐
       │                   ▼                           ▼
       │               Valid URL                  Non-URL / Fail
       │                   │                           │
       │            URLCharCNN                         │
       │        [benign / malicious]                   │
       │                   │                           │
       ▼                   ▼                           ▼
  Visual Threat Score + URL Threat Score         Visual Fallback
  (P_mal + P_tamp)       (P_mal)             (benign -> SAFE,
       │                   │                  mal -> MALICIOUS,
       └─────────┬─────────┘                  tamp -> SUSPICIOUS)
                 ▼                                     │
    Final Malicious Score                              │
  (0.5 * Visual + 0.5 * URL)                           │
                 │                                     │
     Threshold Decision                                │
 (>=0.70: MALICIOUS,                                   │
  >=0.40: SUSPICIOUS,                                  │
   <0.40: SAFE)                                        │
                 │                                     │
                 └──────────────────┬──────────────────┘
                                    ▼
                         Final Security Decision
                       [SAFE / SUSPICIOUS / MALICIOUS]
```

### Fusion Formulas & Baseline Rules
1. **Visual Score**: $\text{visual\_malicious\_score} = P_{\text{visual}}(\text{malicious}) + P_{\text{visual}}(\text{tampered})$
2. **URL Score**: $\text{url\_malicious\_score} = P_{\text{url}}(\text{malicious})$
3. **Combined Threat Score**: $\text{final\_malicious\_score} = 0.5 \times \text{visual\_malicious\_score} + 0.5 \times \text{url\_malicious\_score}$
4. **Baseline Thresholds**:
   * $\ge 0.70 \implies \mathbf{MALICIOUS}$
   * $\ge 0.40 \implies \mathbf{SUSPICIOUS}$
   * $< 0.40 \implies \mathbf{SAFE}$
5. **Fallback (No URL Decoded or Non-URL Payload)**:
   * Visual benign $\implies \mathbf{SAFE}$
   * Visual malicious $\implies \mathbf{MALICIOUS}$
   * Visual tampered $\implies \mathbf{SUSPICIOUS}$

---

## 9. Robustness Evaluation
The complete pipeline was evaluated across 14 conditions (1 clean baseline + 13 realistic distortions) on all 342 test QR images (4,788 evaluations):
* **Noise, JPEG Compression, and Brightness**: High resilience; visual accuracy remained $99.7\% - 100.0\%$, with 0 malicious escapes.
* **Geometric Distortion (Rotation $\ge 15^\circ$ & Perspective Warp)**: Significant degradation for standard OpenCV decoding (30° rotation decode rate dropped to 14.6%).
* **Safety Observation**: Rotated/warped modules were categorized by the visual CNN as `tampered`, automatically routing them to `SUSPICIOUS` and resulting in an overall malicious false-negative rate of $\le 5.88\%$ across all conditions.

---

## 10. Final Results Summary

| Component | Evaluation Dataset | Accuracy | Macro F1 | Malicious Recall | Malicious FNR | Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Visual (ResNet18)** | 342 Clean QR Test Images | **100.00%** | **1.0000** | **100.00%** | **0.00%** | 0 false negatives on clean test set |
| **URL (URLCharCNN)** | 7,500 Held-Out URLs | **94.36%** | **0.9435** | **97.55%** | **2.45%** | 92 false negatives out of 3,750 |
| **Multimodal Fusion** | 342 Clean QR Test Images | *N/A (unpaired)* | *N/A (unpaired)* | *N/A (unpaired)* | **0.00%** | 0 malicious QR codes escaped as SAFE |
| **Robustness** | 4,788 Evaluations (14 conditions) | 35.1% - 100% | 0.173 - 1.000 | 0.0% - 100% | 0.00% - 5.88% | Tilts degrade decoder; visual defaults to SUSPICIOUS |

---

## 11. Important Limitations
1. **Academic Scope**: DeepQR Shield is an educational/academic prototype, not a production endpoint scanner.
2. **Unpaired Datasets**: QR images and URL datasets originated from separate sources. Fusion is an architectural proof-of-concept rather than a joint representation.
3. **OpenCV Decoder Bottleneck**: OpenCV `cv2.QRCodeDetector` fails on stylized, low-contrast, or tilted codes compared to industrial multi-pass binarizers (e.g., ZXing or WeChat QR engine).
4. **Clean Test Accuracy Interpretation**: 100% clean test accuracy reflects high intra-dataset consistency after leakage cleaning; real-world open-set QR codes will exhibit lower baseline performance.

---

## 12. How to Run Inference Locally

### Single QR Code Inference
Run the standalone inference script from the project root:
```bash
python fusion_inference.py path/to/sample_qr.png
```

### Reproduce Final Evaluation
To run the full test evaluation and regenerate metrics:
```bash
python final_evaluation.py
```

### Reproduce Robustness Benchmarking
To run the 14-condition robustness experiment:
```bash
python evaluate_robustness.py
```

---

## 13. Hardware & Software Environment
* **Operating System**: Windows 11
* **GPU**: NVIDIA GeForce RTX 3050 Laptop GPU (4.00 GB VRAM)
* **Python Version**: 3.11.7
* **PyTorch Version**: 2.6.0+cu124
* **CUDA Version**: 12.4
* **Key Dependencies**: `torch`, `torchvision`, `opencv-python`, `pandas`, `scikit-learn`, `pillow`

---

## 14. Reproducibility Information
* **Global Random Seed**: `42`
* **Model Checkpoints**:
  * Visual: `models/visual/resnet18_final.pt`
  * URL: `models/url/url_cnn_final.pt`
  * Fusion: `models/fusion/fusion_config.json`
* **Experimental Metrics**: Preserved in `results/final_evaluation/` and `results/robustness/`.
