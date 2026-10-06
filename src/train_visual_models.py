"""
DeepQR Shield - Step 03: Visual Model Comparison Experiment

Compares three lightweight pretrained CNN backbones for QR image threat detection:
1. MobileNetV3-Small
2. EfficientNet-B0
3. ResNet18

Task constraint highlights:
- Uses ONLY data/clean_qr/ (train and val splits).
- Test set is strictly untouched.
- Input size 224x224 RGB.
- Freezes backbone; replaces classification head with 3-class classifier.
- AdamW optimizer, CrossEntropyLoss, mixed precision (FP16).
- 5 epochs per model.
- Saves results strictly into results/visual_model_selection/.
"""

import os
import sys
import time
import json
import random
from typing import Dict, Any, Tuple, List

import numpy as np
import pandas as pd
from PIL import Image
import matplotlib.pyplot as plt
import seaborn as sns

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix


def set_seed(seed: int = 42) -> None:
    """Set random seeds across libraries for strict reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def pil_rgb_loader(path: str) -> Image.Image:
    """Explicitly loads an image and converts to RGB to avoid greyscale/RGBA mismatches."""
    with open(path, "rb") as f:
        img = Image.open(f)
        return img.convert("RGB")


def check_gpu() -> Tuple[torch.device, str, float]:
    """Verify CUDA availability and report GPU details."""
    if not torch.cuda.is_available():
        raise SystemError(
            "CUDA is NOT available! As per project instructions, CUDA must be used "
            "and training must not proceed silently on CPU."
        )
    device = torch.device("cuda")
    gpu_name = torch.cuda.get_device_name(0)
    total_mem_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    allocated_mb = torch.cuda.memory_allocated(0) / (1024 ** 2)
    print(f"[GPU CHECK] Device: {device}")
    print(f"[GPU CHECK] GPU Name: {gpu_name}")
    print(f"[GPU CHECK] Total VRAM: {total_mem_gb:.2f} GB")
    print(f"[GPU CHECK] Initial Allocated VRAM: {allocated_mb:.2f} MB")
    return device, gpu_name, total_mem_gb


def build_candidate_model(model_name: str, num_classes: int = 3) -> nn.Module:
    """
    Instantiates candidate architecture with pretrained ImageNet weights,
    freezes the backbone, and replaces only the final classification layer.
    """
    if model_name == "mobileNetV3_small":
        model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        for param in model.parameters():
            param.requires_grad = False
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Linear(in_features, num_classes)

    elif model_name == "efficientNet_b0":
        model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
        for param in model.parameters():
            param.requires_grad = False
        in_features = model.classifier[1].in_features
        model.classifier[1] = nn.Linear(in_features, num_classes)

    elif model_name == "resNet18":
        model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        for param in model.parameters():
            param.requires_grad = False
        in_features = model.fc.in_features
        model.fc = nn.Linear(in_features, num_classes)

    else:
        raise ValueError(f"Unsupported model architecture: {model_name}")

    return model


def evaluate_model(
    model: nn.Module,
    val_loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    class_names: List[str]
) -> Dict[str, Any]:
    """Runs evaluation on the validation set and returns comprehensive metrics."""
    model.eval()
    running_loss = 0.0
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for inputs, targets in val_loader:
            inputs = inputs.to(device)
            targets = targets.to(device)

            with torch.amp.autocast("cuda"):
                outputs = model(inputs)
                loss = criterion(outputs, targets)

            running_loss += loss.item() * inputs.size(0)
            preds = torch.argmax(outputs, dim=1)
            all_preds.extend(preds.cpu().numpy())
            all_targets.extend(targets.cpu().numpy())

    total_samples = len(all_targets)
    avg_loss = running_loss / total_samples

    y_true = np.array(all_targets)
    y_pred = np.array(all_preds)

    acc = float(accuracy_score(y_true, y_pred))
    macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0
    )
    p_per_class, r_per_class, f1_per_class, support_per_class = precision_recall_fscore_support(
        y_true, y_pred, average=None, labels=list(range(len(class_names))), zero_division=0
    )

    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(class_names))))

    per_class_metrics = {}
    for i, cls in enumerate(class_names):
        per_class_metrics[cls] = {
            "precision": float(p_per_class[i]),
            "recall": float(r_per_class[i]),
            "f1_score": float(f1_per_class[i]),
            "support": int(support_per_class[i])
        }

    return {
        "val_loss": float(avg_loss),
        "val_accuracy": float(acc),
        "macro_precision": float(macro_p),
        "macro_recall": float(macro_r),
        "macro_f1": float(macro_f1),
        "benign_recall": float(per_class_metrics["benign"]["recall"]),
        "malicious_recall": float(per_class_metrics["malicious"]["recall"]),
        "tampered_recall": float(per_class_metrics["tampered"]["recall"]),
        "per_class_metrics": per_class_metrics,
        "confusion_matrix": cm.tolist()
    }


def train_single_model(
    model_name: str,
    train_loader: DataLoader,
    val_loader: DataLoader,
    class_names: List[str],
    device: torch.device,
    epochs: int = 5,
    lr: float = 1e-3,
    weight_decay: float = 1e-2,
    output_dir: str = "results/visual_model_selection"
) -> Dict[str, Any]:
    """Trains a candidate model for specified epochs and saves all required artifacts."""
    print(f"\n{'='*70}")
    print(f"STARTING EXPERIMENT: {model_name}")
    print(f"{'='*70}")

    set_seed(42)
    torch.cuda.reset_peak_memory_stats(0)

    model = build_candidate_model(model_name, num_classes=len(class_names)).to(device)

    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"[{model_name}] Total Parameters: {total_params:,}")
    print(f"[{model_name}] Trainable Parameters: {trainable_params:,}")

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=lr,
        weight_decay=weight_decay
    )
    scaler = torch.amp.GradScaler("cuda")

    model_dir = os.path.join(output_dir, model_name)
    os.makedirs(model_dir, exist_ok=True)

    history = []
    best_macro_f1 = -1.0
    best_epoch = -1
    best_val_loss = float("inf")
    best_model_state = None
    best_metrics = None

    start_time = time.time()

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()
        model.train()
        running_train_loss = 0.0

        for inputs, targets in train_loader:
            inputs = inputs.to(device)
            targets = targets.to(device)

            optimizer.zero_grad()
            with torch.amp.autocast("cuda"):
                outputs = model(inputs)
                loss = criterion(outputs, targets)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            running_train_loss += loss.item() * inputs.size(0)

        train_loss = running_train_loss / len(train_loader.dataset)
        val_eval = evaluate_model(model, val_loader, criterion, device, class_names)
        epoch_duration = time.time() - epoch_start
        peak_vram_mb = torch.cuda.max_memory_allocated(0) / (1024 ** 2)

        epoch_record = {
            "epoch": epoch,
            "train_loss": float(train_loss),
            "val_loss": val_eval["val_loss"],
            "val_accuracy": val_eval["val_accuracy"],
            "macro_precision": val_eval["macro_precision"],
            "macro_recall": val_eval["macro_recall"],
            "macro_f1": val_eval["macro_f1"],
            "benign_recall": val_eval["benign_recall"],
            "malicious_recall": val_eval["malicious_recall"],
            "tampered_recall": val_eval["tampered_recall"],
            "epoch_time_sec": float(epoch_duration),
            "peak_vram_mb": float(peak_vram_mb)
        }
        history.append(epoch_record)

        print(
            f"Epoch [{epoch}/{epochs}] - "
            f"Train Loss: {train_loss:.4f} | "
            f"Val Loss: {val_eval['val_loss']:.4f} | "
            f"Val Acc: {val_eval['val_accuracy']*100:.2f}% | "
            f"Macro F1: {val_eval['macro_f1']:.4f} | "
            f"Malicious Recall: {val_eval['malicious_recall']*100:.2f}% | "
            f"Tampered Recall: {val_eval['tampered_recall']*100:.2f}% | "
            f"Time: {epoch_duration:.1f}s | "
            f"Peak VRAM: {peak_vram_mb:.1f}MB"
        )

        # Checkpoint selection: primary criterion is Macro F1, tie-breaker is lower Val Loss
        is_better = False
        if val_eval["macro_f1"] > best_macro_f1:
            is_better = True
        elif abs(val_eval["macro_f1"] - best_macro_f1) < 1e-5 and val_eval["val_loss"] < best_val_loss:
            is_better = True

        if is_better:
            best_macro_f1 = val_eval["macro_f1"]
            best_val_loss = val_eval["val_loss"]
            best_epoch = epoch
            best_metrics = val_eval
            best_model_state = {k: v.cpu() for k, v in model.state_dict().items()}

    total_training_time = time.time() - start_time
    print(f"[{model_name}] Training finished in {total_training_time:.2f}s. Best Epoch: {best_epoch} (Macro F1: {best_macro_f1:.4f})")

    # 1. Save training history
    history_df = pd.DataFrame(history)
    history_df.to_csv(os.path.join(model_dir, "training_history.csv"), index=False)
    with open(os.path.join(model_dir, "training_history.json"), "w") as f:
        json.dump(history, f, indent=2)

    # 2. Save best comparison checkpoint
    checkpoint_path = os.path.join(model_dir, "best_checkpoint.pt")
    torch.save(
        {
            "model_name": model_name,
            "best_epoch": best_epoch,
            "state_dict": best_model_state,
            "class_names": class_names,
            "metrics": best_metrics,
            "training_time": total_training_time
        },
        checkpoint_path
    )

    # 3. Save validation metrics
    validation_metrics_output = {
        "model": model_name,
        "best_epoch": best_epoch,
        "total_training_time_sec": float(total_training_time),
        "peak_vram_mb": float(torch.cuda.max_memory_allocated(0) / (1024 ** 2)),
        "metrics": best_metrics
    }
    with open(os.path.join(model_dir, "validation_metrics.json"), "w") as f:
        json.dump(validation_metrics_output, f, indent=2)

    # 4. Save confusion matrix (JSON and PNG heatmap)
    cm_data = {
        "classes": class_names,
        "confusion_matrix": best_metrics["confusion_matrix"]
    }
    with open(os.path.join(model_dir, "confusion_matrix.json"), "w") as f:
        json.dump(cm_data, f, indent=2)

    # Plot Confusion Matrix
    cm_array = np.array(best_metrics["confusion_matrix"])
    plt.figure(figsize=(6, 5))
    sns.heatmap(
        cm_array,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=class_names,
        yticklabels=class_names,
        cbar=True
    )
    plt.title(f"Confusion Matrix: {model_name} (Epoch {best_epoch})", fontsize=12)
    plt.xlabel("Predicted Label", fontsize=10)
    plt.ylabel("True Label", fontsize=10)
    plt.tight_layout()
    plt.savefig(os.path.join(model_dir, "confusion_matrix.png"), dpi=200)
    plt.close()

    summary_result = {
        "model": model_name,
        "best_epoch": best_epoch,
        "val_accuracy": round(best_metrics["val_accuracy"], 4),
        "macro_precision": round(best_metrics["macro_precision"], 4),
        "macro_recall": round(best_metrics["macro_recall"], 4),
        "macro_f1": round(best_metrics["macro_f1"], 4),
        "benign_recall": round(best_metrics["benign_recall"], 4),
        "malicious_recall": round(best_metrics["malicious_recall"], 4),
        "tampered_recall": round(best_metrics["tampered_recall"], 4),
        "best_val_loss": round(best_metrics["val_loss"], 4),
        "training_time": round(total_training_time, 2)
    }

    return summary_result


def main():
    print("="*70)
    print("DeepQR Shield - Step 03: Visual Model Selection Experiment")
    print("="*70)

    # 1. GPU Check
    device, gpu_name, total_vram = check_gpu()

    # 2. Dataset Paths
    train_dir = os.path.join("data", "clean_qr", "train")
    val_dir = os.path.join("data", "clean_qr", "val")
    output_dir = os.path.join("results", "visual_model_selection")
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.exists(train_dir) or not os.path.exists(val_dir):
        raise FileNotFoundError(f"Cleaned dataset paths not found: {train_dir} or {val_dir}")

    # 3. Preprocessing and Augmentation Pipelines
    # 224x224 RGB input, ImageNet normalization
    # Random lightweight augmentation applied ONLY to TRAIN
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ColorJitter(brightness=0.1, contrast=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    # Validation pipeline: deterministic resize + normalization only
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    train_dataset = datasets.ImageFolder(train_dir, transform=train_transform, loader=pil_rgb_loader)
    val_dataset = datasets.ImageFolder(val_dir, transform=val_transform, loader=pil_rgb_loader)

    class_names = train_dataset.classes
    print(f"\n[DATA INFO] Classes: {class_names} ({train_dataset.class_to_idx})")
    print(f"[DATA INFO] Train samples: {len(train_dataset)}")
    print(f"[DATA INFO] Validation samples: {len(val_dataset)}")
    print("[DATA INFO] Test split is NOT loaded and remains untouched.")

    batch_size = 32
    num_workers = 0  # Conservative DataLoader workers for Windows stability

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True
    )

    # 4. Candidate Models to compare
    candidate_models = [
        "mobileNetV3_small",
        "efficientNet_b0",
        "resNet18"
    ]

    results = []

    for model_name in candidate_models:
        try:
            summary = train_single_model(
                model_name=model_name,
                train_loader=train_loader,
                val_loader=val_loader,
                class_names=class_names,
                device=device,
                epochs=5,
                lr=1e-3,
                weight_decay=1e-2,
                output_dir=output_dir
            )
            results.append(summary)
        except torch.cuda.OutOfMemoryError as oom_err:
            print(f"[ERROR] CUDA OutOfMemoryError on {model_name} with batch_size={batch_size}: {oom_err}")
            raise oom_err

    # 5. Save Comparison Summary CSV
    comparison_df = pd.DataFrame(results)
    comparison_csv_path = os.path.join(output_dir, "comparison.csv")
    comparison_df.to_csv(comparison_csv_path, index=False)
    print(f"\n[SUCCESS] Comparison CSV saved to: {comparison_csv_path}")

    # 6. Display Summary Table
    print("\n" + "="*80)
    print("VISUAL MODEL SELECTION - COMPARISON TABLE")
    print("="*80)
    print(comparison_df.to_string(index=False))
    print("="*80)

    # 7. Model Selection Analysis
    # Priority:
    # 1. Malicious recall
    # 2. Macro F1
    # 3. Tampered recall
    # 4. Overall validation accuracy
    # 5. Training efficiency / VRAM suitability
    sorted_df = comparison_df.sort_values(
        by=["malicious_recall", "macro_f1", "tampered_recall", "val_accuracy", "training_time"],
        ascending=[False, False, False, False, True]
    )
    best_candidate = sorted_df.iloc[0]["model"]
    print(f"\n[RECOMMENDATION] Based on the prioritized criteria, the best model is: {best_candidate}")


if __name__ == "__main__":
    main()
