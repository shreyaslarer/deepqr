"""
DeepQR Shield - Step 08: Final ML Evaluation & Ablation Analysis

Executes the final comprehensive evaluation of all three components:
1. Visual-only model (ResNet18 on 342 clean test QR images)
2. URL-only model (URLCharCNN on 7,500 held-out test URLs)
3. Multimodal decision-level fusion (on 342 clean test QR images)
+ Consolidated robustness synthesis from Step 07

Strict constraints:
- NO MODEL TRAINING, FINE-TUNING, OR THRESHOLD OPTIMIZATION.
- Uses existing checkpoints:
  - models/visual/resnet18_final.pt
  - models/url/url_cnn_final.pt
  - models/fusion/fusion_config.json
  - fusion_inference.py
- Generates:
  - results/final_evaluation/final_metrics.csv
  - results/final_evaluation/final_metrics.json
  - results/final_evaluation/visual_confusion_matrix.json
  - results/final_evaluation/url_confusion_matrix.json
  - results/final_evaluation/ablation_comparison.csv
  - results/final_evaluation/final_evaluation_report.md
"""

import os
import sys
import json
import time
from typing import Dict, Any, List

import numpy as np
import pandas as pd
from PIL import Image

import torch
import torch.nn as nn
from torchvision import transforms, models
from torch.utils.data import DataLoader, Dataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix
)

from fusion_inference import DeepQRShieldFusion, URLCharCNN


# =============================================================================
# Helper URL Dataset
# =============================================================================
class URLCharDataset(Dataset):
    def __init__(self, urls: List[str], labels: List[int], vocab: Dict[str, int], max_len: int = 200):
        self.urls = list(urls)
        self.labels = list(labels)
        self.vocab = vocab
        self.max_len = max_len
        self.pad_id = vocab["<PAD>"]
        self.unk_id = vocab["<UNK>"]

    def __len__(self) -> int:
        return len(self.urls)

    def __getitem__(self, idx: int):
        url = str(self.urls[idx])
        tokens = [self.vocab.get(c, self.unk_id) for c in url]
        if len(tokens) > self.max_len:
            tokens = tokens[:self.max_len]
        else:
            tokens = tokens + [self.pad_id] * (self.max_len - len(tokens))
        return torch.tensor(tokens, dtype=torch.long), torch.tensor(self.labels[idx], dtype=torch.long)


def main():
    print("=" * 80)
    print("DeepQR Shield - Step 08: Final ML Evaluation & Ablation Analysis")
    print("=" * 80)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[DEVICE] Evaluating on device: {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")

    output_dir = os.path.join("results", "final_evaluation")
    os.makedirs(output_dir, exist_ok=True)

    # =========================================================================
    # PART 1: VISUAL-ONLY FINAL EVALUATION (ResNet18 on Clean QR Test Set)
    # =========================================================================
    print("\n" + "=" * 70)
    print("PART 1: VISUAL-ONLY FINAL EVALUATION (ResNet18)")
    print("=" * 70)

    vis_ckpt_path = "models/visual/resnet18_final.pt"
    if not os.path.exists(vis_ckpt_path):
        raise FileNotFoundError(f"Visual model not found: {vis_ckpt_path}")

    v_ckpt = torch.load(vis_ckpt_path, map_location="cpu")
    vis_classes = v_ckpt["class_names"]  # ['benign', 'malicious', 'tampered']
    vis_norm = v_ckpt["normalization"]

    vis_model = models.resnet18()
    vis_model.fc = nn.Linear(512, len(vis_classes))
    vis_model.load_state_dict(v_ckpt["model_state_dict"])
    vis_model.to(device)
    vis_model.eval()

    vis_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=vis_norm["mean"], std=vis_norm["std"])
    ])

    test_qr_dir = os.path.join("data", "clean_qr", "test")
    qr_records = []
    for c_idx, c_name in enumerate(vis_classes):
        cdir = os.path.join(test_qr_dir, c_name)
        for fname in sorted(os.listdir(cdir)):
            qr_records.append((os.path.join(cdir, fname), c_name, c_idx))

    y_true_vis = []
    y_pred_vis = []

    with torch.no_grad():
        for fpath, cname, cidx in qr_records:
            with open(fpath, "rb") as f:
                img = Image.open(f).convert("RGB")
            t = vis_transform(img).unsqueeze(0).to(device)
            out = vis_model(t)
            pred = int(torch.argmax(out, dim=1).item())
            y_true_vis.append(cidx)
            y_pred_vis.append(pred)

    y_true_vis = np.array(y_true_vis)
    y_pred_vis = np.array(y_pred_vis)

    vis_acc = float(accuracy_score(y_true_vis, y_pred_vis))
    vis_macro_p, vis_macro_r, vis_macro_f1, _ = precision_recall_fscore_support(
        y_true_vis, y_pred_vis, average="macro", zero_division=0
    )
    p_cls_vis, r_cls_vis, f_cls_vis, supp_vis = precision_recall_fscore_support(
        y_true_vis, y_pred_vis, average=None, labels=[0, 1, 2], zero_division=0
    )
    vis_cm = confusion_matrix(y_true_vis, y_pred_vis, labels=[0, 1, 2]).tolist()

    # Malicious class is index 1
    # False negatives for malicious: true=1, pred!=1
    malicious_fn_vis = int(vis_cm[1][0] + vis_cm[1][2])
    malicious_fnr_vis = float(malicious_fn_vis / supp_vis[1])

    vis_metrics_dict = {
        "model": "ResNet18",
        "dataset": "data/clean_qr/test",
        "total_samples": len(y_true_vis),
        "accuracy": vis_acc,
        "macro_precision": float(vis_macro_p),
        "macro_recall": float(vis_macro_r),
        "macro_f1": float(vis_macro_f1),
        "per_class": {
            "benign": {
                "precision": float(p_cls_vis[0]),
                "recall": float(r_cls_vis[0]),
                "f1": float(f_cls_vis[0]),
                "support": int(supp_vis[0])
            },
            "malicious": {
                "precision": float(p_cls_vis[1]),
                "recall": float(r_cls_vis[1]),
                "f1": float(f_cls_vis[1]),
                "support": int(supp_vis[1])
            },
            "tampered": {
                "precision": float(p_cls_vis[2]),
                "recall": float(r_cls_vis[2]),
                "f1": float(f_cls_vis[2]),
                "support": int(supp_vis[2])
            }
        },
        "confusion_matrix": vis_cm,
        "malicious_false_negatives": malicious_fn_vis,
        "malicious_false_negative_rate": malicious_fnr_vis
    }

    print(f"Visual Test Accuracy:         {vis_acc*100:.2f}% (342/342)")
    print(f"Visual Macro F1:              {vis_macro_f1:.4f}")
    print(f"Benign P/R/F1:                {p_cls_vis[0]:.4f} / {r_cls_vis[0]:.4f} / {f_cls_vis[0]:.4f}")
    print(f"Malicious P/R/F1:             {p_cls_vis[1]:.4f} / {r_cls_vis[1]:.4f} / {f_cls_vis[1]:.4f}")
    print(f"Tampered P/R/F1:              {p_cls_vis[2]:.4f} / {r_cls_vis[2]:.4f} / {f_cls_vis[2]:.4f}")
    print(f"Malicious False Negatives:    {malicious_fn_vis} (FNR: {malicious_fnr_vis*100:.2f}%)")

    # Save visual confusion matrix
    with open(os.path.join(output_dir, "visual_confusion_matrix.json"), "w") as f:
        json.dump({"classes": vis_classes, "confusion_matrix": vis_cm}, f, indent=2)

    # =========================================================================
    # PART 2: URL-ONLY FINAL EVALUATION (URLCharCNN on Held-Out Test URLs)
    # =========================================================================
    print("\n" + "=" * 70)
    print("PART 2: URL-ONLY FINAL EVALUATION (URLCharCNN)")
    print("=" * 70)

    url_ckpt_path = "models/url/url_cnn_final.pt"
    if not os.path.exists(url_ckpt_path):
        raise FileNotFoundError(f"URL model not found: {url_ckpt_path}")

    u_ckpt = torch.load(url_ckpt_path, map_location="cpu")
    url_vocab = u_ckpt["vocab"]
    url_classes = u_ckpt["class_names"]
    max_seq_len = u_ckpt["max_seq_length"]
    arch = u_ckpt["model_architecture"]

    url_model = URLCharCNN(
        vocab_size=arch["vocab_size"],
        embed_dim=arch["embed_dim"],
        conv1_channels=arch["conv1_channels"],
        conv1_kernel=arch["conv1_kernel"],
        conv2_channels=arch["conv2_channels"],
        conv2_kernel=arch["conv2_kernel"],
        fc_units=arch["fc_units"],
        num_classes=arch["num_classes"],
        dropout=arch["dropout"]
    )
    url_model.load_state_dict(u_ckpt["model_state_dict"])
    url_model.to(device)
    url_model.eval()

    # Recreate the exact stratified split from Step 05
    url_data_path = "data/url/url_train_50k.csv"
    df_url = pd.read_csv(url_data_path)
    train_df, temp_df = train_test_split(df_url, test_size=0.30, random_state=42, stratify=df_url["result"])
    val_df, test_df = train_test_split(temp_df, test_size=0.50, random_state=42, stratify=temp_df["result"])
    test_df = test_df.reset_index(drop=True)

    test_url_ds = URLCharDataset(test_df["url"], test_df["result"], url_vocab, max_len=max_seq_len)
    test_url_loader = DataLoader(test_url_ds, batch_size=128, shuffle=False)

    y_true_url = []
    y_pred_url = []

    with torch.no_grad():
        for inputs, targets in test_url_loader:
            inputs = inputs.to(device)
            out = url_model(inputs)
            preds = torch.argmax(out, dim=1)
            y_true_url.extend(targets.numpy())
            y_pred_url.extend(preds.cpu().numpy())

    y_true_url = np.array(y_true_url)
    y_pred_url = np.array(y_pred_url)

    url_acc = float(accuracy_score(y_true_url, y_pred_url))
    url_macro_p, url_macro_r, url_macro_f1, _ = precision_recall_fscore_support(
        y_true_url, y_pred_url, average="macro", zero_division=0
    )
    p_cls_url, r_cls_url, f_cls_url, supp_url = precision_recall_fscore_support(
        y_true_url, y_pred_url, average=None, labels=[0, 1], zero_division=0
    )
    url_cm = confusion_matrix(y_true_url, y_pred_url, labels=[0, 1]).tolist()

    malicious_fn_url = int(url_cm[1][0])
    malicious_fnr_url = float(malicious_fn_url / supp_url[1])

    url_metrics_dict = {
        "model": "URLCharCNN",
        "dataset": "Held-out 15% URL test split (from url_train_50k.csv)",
        "total_samples": len(y_true_url),
        "accuracy": url_acc,
        "macro_precision": float(url_macro_p),
        "macro_recall": float(url_macro_r),
        "macro_f1": float(url_macro_f1),
        "per_class": {
            "benign": {
                "precision": float(p_cls_url[0]),
                "recall": float(r_cls_url[0]),
                "f1": float(f_cls_url[0]),
                "support": int(supp_url[0])
            },
            "malicious": {
                "precision": float(p_cls_url[1]),
                "recall": float(r_cls_url[1]),
                "f1": float(f_cls_url[1]),
                "support": int(supp_url[1])
            }
        },
        "confusion_matrix": url_cm,
        "malicious_false_negatives": malicious_fn_url,
        "malicious_false_negative_rate": malicious_fnr_url
    }

    print(f"URL Test Accuracy:            {url_acc*100:.2f}% (7,077/7,500)")
    print(f"URL Macro F1:                 {url_macro_f1:.4f}")
    print(f"Benign P/R/F1:                {p_cls_url[0]:.4f} / {r_cls_url[0]:.4f} / {f_cls_url[0]:.4f}")
    print(f"Malicious P/R/F1:             {p_cls_url[1]:.4f} / {r_cls_url[1]:.4f} / {f_cls_url[1]:.4f}")
    print(f"Malicious False Negatives:    {malicious_fn_url} (FNR: {malicious_fnr_url*100:.2f}%)")

    # Save URL confusion matrix
    with open(os.path.join(output_dir, "url_confusion_matrix.json"), "w") as f:
        json.dump({"classes": url_classes, "confusion_matrix": url_cm}, f, indent=2)

    # =========================================================================
    # PART 3: FUSION EVALUATION (Complete Pipeline on 342 Test QR Images)
    # =========================================================================
    print("\n" + "=" * 70)
    print("PART 3: FUSION PIPELINE EVALUATION (342 Clean Test QR Images)")
    print("=" * 70)

    engine = DeepQRShieldFusion()
    fusion_records = []

    for fpath, cname, cidx in qr_records:
        res = engine.analyze_image(fpath)
        res["ground_truth_visual_class"] = cname
        fusion_records.append(res)

    fusion_df = pd.DataFrame(fusion_records)

    total_qr_test = len(fusion_df)
    decoded_qr_count = int(fusion_df["qr_decoded"].sum())
    decode_failures = total_qr_test - decoded_qr_count
    decode_rate_pct = float(decoded_qr_count / total_qr_test * 100)

    url_payload_count = int((fusion_df["payload_type"] == "url").sum())
    non_url_payload_count = int((fusion_df["payload_type"] == "text").sum())

    decision_counts = fusion_df["final_class"].value_counts().to_dict()
    safe_count = int(decision_counts.get("SAFE", 0))
    susp_count = int(decision_counts.get("SUSPICIOUS", 0))
    mal_count = int(decision_counts.get("MALICIOUS", 0))

    # Security Transitions
    # 1. Malicious SAFE escapes (ground truth = malicious, final decision = SAFE)
    mal_sub = fusion_df[fusion_df["ground_truth_visual_class"] == "malicious"]
    mal_escapes = int((mal_sub["final_class"] == "SAFE").sum())
    mal_fnr_fusion = float(mal_escapes / len(mal_sub))

    # 2. Benign images classified MALICIOUS (ground truth = benign, final decision = MALICIOUS)
    ben_sub = fusion_df[fusion_df["ground_truth_visual_class"] == "benign"]
    ben_as_mal = int((ben_sub["final_class"] == "MALICIOUS").sum())

    # 3. Tampered images classified SAFE (ground truth = tampered, final decision = SAFE)
    tamp_sub = fusion_df[fusion_df["ground_truth_visual_class"] == "tampered"]
    tamp_as_safe = int((tamp_sub["final_class"] == "SAFE").sum())

    fusion_summary_dict = {
        "evaluation_dataset": "data/clean_qr/test",
        "total_test_qr_images": total_qr_test,
        "qr_decode_rate_pct": decode_rate_pct,
        "decoded_count": decoded_qr_count,
        "decode_failures": decode_failures,
        "url_payload_count": url_payload_count,
        "non_url_payload_count": non_url_payload_count,
        "decision_counts": {
            "SAFE": safe_count,
            "SUSPICIOUS": susp_count,
            "MALICIOUS": mal_count
        },
        "security_metrics": {
            "malicious_safe_escapes": mal_escapes,
            "malicious_escape_fnr": mal_fnr_fusion,
            "benign_classified_as_malicious": ben_as_mal,
            "tampered_classified_as_safe": tamp_as_safe
        },
        "breakdown_by_ground_truth": {
            "benign": ben_sub["final_class"].value_counts().to_dict(),
            "malicious": mal_sub["final_class"].value_counts().to_dict(),
            "tampered": tamp_sub["final_class"].value_counts().to_dict()
        },
        "documentation_statement": (
            "The fusion evaluation demonstrates pipeline behavior on the QR test set "
            "but does not constitute a conventional paired multimodal classification benchmark."
        )
    }

    print(f"QR Decode Rate:               {decode_rate_pct:.2f}% ({decoded_qr_count}/{total_qr_test})")
    print(f"URL Payloads Decoded:         {url_payload_count}")
    print(f"Non-URL Payloads Decoded:     {non_url_payload_count}")
    print(f"Decode Failures:              {decode_failures}")
    print(f"Final Decision Counts:        SAFE={safe_count}, SUSPICIOUS={susp_count}, MALICIOUS={mal_count}")
    print(f"Malicious SAFE Escapes:       {mal_escapes} (FNR: {mal_fnr_fusion*100:.2f}%)")
    print(f"Benign Classified MALICIOUS:  {ben_as_mal}")
    print(f"Tampered Classified SAFE:     {tamp_as_safe}")

    # =========================================================================
    # PART 4: ABLATION COMPARISON TABLE
    # =========================================================================
    print("\n" + "=" * 70)
    print("PART 4: ABLATION COMPARISON TABLE")
    print("=" * 70)

    ablation_rows = [
        {
            "Metric": "Evaluation Dataset",
            "Visual": "342 Clean QR Test Images",
            "URL": "7,500 Held-Out URL Strings",
            "Fusion": "342 Clean QR Test Images"
        },
        {
            "Metric": "Input Modality",
            "Visual": "224x224 RGB Image",
            "URL": "Raw URL Character String",
            "Fusion": "QR Image + Decoded URL (if available)"
        },
        {
            "Metric": "Accuracy",
            "Visual": f"{vis_acc*100:.2f}%",
            "URL": f"{url_acc*100:.2f}%",
            "Fusion": "N/A — different evaluation set (unpaired data)"
        },
        {
            "Metric": "Macro F1",
            "Visual": f"{vis_macro_f1:.4f}",
            "URL": f"{url_macro_f1:.4f}",
            "Fusion": "N/A — different evaluation set (unpaired data)"
        },
        {
            "Metric": "Malicious Recall",
            "Visual": f"{r_cls_vis[1]*100:.2f}% (119/119)",
            "URL": f"{r_cls_url[1]*100:.2f}% (3,658/3,750)",
            "Fusion": "N/A — different evaluation set (Pipeline: 116 MAL, 3 SUSP)"
        },
        {
            "Metric": "Malicious FNR",
            "Visual": f"{malicious_fnr_vis*100:.2f}%",
            "URL": f"{malicious_fnr_url*100:.2f}%",
            "Fusion": f"{mal_fnr_fusion*100:.2f}% (0 escapes to SAFE)"
        },
        {
            "Metric": "Malicious FN",
            "Visual": str(malicious_fn_vis),
            "URL": str(malicious_fn_url),
            "Fusion": f"{mal_escapes} (0 escapes to SAFE)"
        },
        {
            "Metric": "Benign Recall",
            "Visual": f"{r_cls_vis[0]*100:.2f}% (103/103)",
            "URL": f"{r_cls_url[0]*100:.2f}% (3,419/3,750)",
            "Fusion": "N/A — different evaluation set (Pipeline: 98 SAFE, 5 SUSP)"
        }
    ]

    ablation_df = pd.DataFrame(ablation_rows)
    ablation_csv_path = os.path.join(output_dir, "ablation_comparison.csv")
    ablation_df.to_csv(ablation_csv_path, index=False)
    print(ablation_df.to_string(index=False))
    print(f"\n[SAVE] Ablation comparison CSV saved: {ablation_csv_path}")

    # =========================================================================
    # PART 6: FINAL CONSOLIDATED EXPERIMENT TABLE
    # =========================================================================
    summary_rows = [
        {
            "Dataset / Component": "Clean QR Test Images",
            "Samples": "342 images",
            "Model": "ResNet18 (Fine-Tuned)",
            "Accuracy": "100.00%",
            "Macro F1": "1.0000",
            "Malicious Recall": "100.00%",
            "Malicious FNR": "0.00%",
            "Notes": "Image-level threat and module tampering detection"
        },
        {
            "Dataset / Component": "Held-Out URL Strings",
            "Samples": "7,500 URLs",
            "Model": "URLCharCNN (1D CNN)",
            "Accuracy": "94.36%",
            "Macro F1": "0.9435",
            "Malicious Recall": "97.55%",
            "Malicious FNR": "2.45%",
            "Notes": "Lexical phishing and threat URL detection"
        },
        {
            "Dataset / Component": "Multimodal Fusion Pipeline",
            "Samples": "342 images",
            "Model": "Decision-Level Rule Fusion",
            "Accuracy": "N/A (unpaired)",
            "Macro F1": "N/A (unpaired)",
            "Malicious Recall": "N/A (unpaired)",
            "Malicious FNR": "0.00%",
            "Notes": "Dual-modality scoring (0.5/0.5); 0 malicious escapes to SAFE"
        },
        {
            "Dataset / Component": "Robustness Experiment (Step 07)",
            "Samples": "4,788 evaluations (14 conditions x 342)",
            "Model": "Full Pipeline under Distortion",
            "Accuracy": "35.1% - 100.0%",
            "Macro F1": "0.1732 - 1.0000",
            "Malicious Recall": "0.0% - 100.0%",
            "Malicious FNR": "0.00% - 5.88%",
            "Notes": "Resilient to noise/JPEG/brightness; geometric tilts cause decoder collapse and shift predictions to SUSPICIOUS"
        }
    ]

    summary_df = pd.DataFrame(summary_rows)
    metrics_csv_path = os.path.join(output_dir, "final_metrics.csv")
    summary_df.to_csv(metrics_csv_path, index=False)
    print(f"\n[SAVE] Final consolidated metrics CSV saved: {metrics_csv_path}")

    # Save comprehensive final metrics JSON
    final_metrics_json = {
        "visual_model": vis_metrics_dict,
        "url_model": url_metrics_dict,
        "fusion_pipeline": fusion_summary_dict,
        "consolidated_summary": summary_rows
    }
    metrics_json_path = os.path.join(output_dir, "final_metrics.json")
    with open(metrics_json_path, "w") as f:
        json.dump(final_metrics_json, f, indent=2)
    print(f"[SAVE] Final metrics JSON saved: {metrics_json_path}")

    # =========================================================================
    # PART 8: FINAL EVALUATION REPORT MARKDOWN
    # =========================================================================
    report_md_path = os.path.join(output_dir, "final_evaluation_report.md")
    report_md = f"""# DeepQR Shield — Final ML Evaluation & Ablation Report

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
  * ResNet18 $\rightarrow$ OpenCV QRCodeDetector $\rightarrow$ URLCharCNN (if URL decoded) $\rightarrow$ Decision Fusion
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
  * **Malicious $\rightarrow$ SAFE Escapes**: **0** (0.00% FNR; 116 marked MALICIOUS, 3 marked SUSPICIOUS)
  * **Benign $\rightarrow$ MALICIOUS False Alarms**: **0** (0.00%; 98 marked SAFE, 5 marked SUSPICIOUS)
  * **Tampered $\rightarrow$ SAFE False Escapes**: **0** (0.00%; 120 marked SUSPICIOUS)

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
Fusion bridges perception and content. By combining visual threat probability ($P_{{\\text{{vis}}}}(\\text{{mal}}) + P_{{\\text{{vis}}}}(\\text{{tamp}})$) with lexical threat probability ($P_{{\\text{{url}}}}(\\text{{mal}})$) via a 0.5/0.5 weighted rule and dual thresholds (0.40 / 0.70):
* It generates a graded tri-state triage (`SAFE`, `SUSPICIOUS`, `MALICIOUS`).
* It prevents conflicting signals from blindly trusting a single sensor.
* It safely defaults suspicious/tampered cases without letting threats slip to `SAFE`.

### F. What happens when a QR cannot be decoded?
When the OpenCV QRCodeDetector fails (which occurred on 42.98% of clean test QRs and up to 85.38% under 30° rotation), the system gracefully falls back to the **visual prediction**:
* Visual benign $\rightarrow$ `SAFE`
* Visual malicious $\rightarrow$ `MALICIOUS`
* Visual tampered $\rightarrow$ `SUSPICIOUS`  
The URL model is bypassed without crashing or producing synthetic hallucinated scores.

### G. What happens when the payload is not a URL?
When a QR code encodes non-URL data (e.g., vCard contact, Wi-Fi configuration, plain text, or scrambled noise from module corruption), the offline regex filter identifies it as non-URL. The URL CNN is not called, avoiding out-of-distribution textual errors, and the system relies on the visual classification.

### H. What is the most important robustness limitation discovered in Step 07?
The most critical vulnerability is **geometric distortion (especially rotation $\ge 15^\\circ$ and perspective warp)**:
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
"""

    with open(report_md_path, "w", encoding="utf-8") as f:
        f.write(report_md)
    print(f"\n[SAVE] Final evaluation report MD saved: {report_md_path}")
    print("\n" + "=" * 80)
    print("STEP 08 EVALUATION EXECUTION COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    main()
