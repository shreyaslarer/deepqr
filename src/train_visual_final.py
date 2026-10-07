"""
DeepQR Shield - Step 04: Final Visual ResNet18 Model Training

Academic Deep Learning mini-project:
Trains the final ResNet18 visual classifier using a two-stage fine-tuning strategy:
- Stage 1: Freeze backbone, train 3-class classification head (5 epochs, LR=1e-3).
- Stage 2: Unfreeze layer4 + classification head, fine-tune (10 epochs, LR=1e-4).
- Backbone earlier layers (conv1, bn1, layer1, layer2, layer3) remain frozen.

Strict constraints:
- Input size 224x224 RGB.
- ImageNet normalization.
- Uses only data/clean_qr/ (train and val).
- Test split (data/clean_qr/test/) is strictly untouched.
- Output files:
  models/visual/resnet18_final.pt
  results/visual_final/training_history.csv
  results/visual_final/validation_metrics.json
  results/visual_final/confusion_matrix.json
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

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    precision_recall_fscore_support,
    confusion_matrix
)


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
            "and training must not proceed on CPU."
        )
    device = torch.device("cuda")
    gpu_name = torch.cuda.get_device_name(0)
    total_mem_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    allocated_mb = torch.cuda.memory_allocated(0) / (1024 ** 2)
    print("=" * 70)
    print("[GPU CHECK] CUDA is available.")
    print(f"[GPU CHECK] Device Name: {gpu_name}")
    print(f"[GPU CHECK] Total VRAM: {total_mem_gb:.2f} GB")
    print(f"[GPU CHECK] Initial Allocated VRAM: {allocated_mb:.2f} MB")
    print(f"[GPU CHECK] PyTorch Version: {torch.__version__}")
    print(f"[GPU CHECK] CUDA Version: {torch.version.cuda}")
    print("=" * 70)
    return device, gpu_name, total_mem_gb


def build_resnet18(num_classes: int = 3) -> nn.Module:
    """
    Instantiates ResNet18 with pretrained ImageNet weights
    and replaces the final linear layer (fc) with a 3-class classifier.
    """
    model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)
    return model


def evaluate_model(
    model: nn.Module,
    val_loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    class_names: List[str]
) -> Dict[str, Any]:
    """Evaluates the model on validation data and computes full evaluation metrics."""
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
    prec_weighted = float(precision_score(y_true, y_pred, average="weighted", zero_division=0))
    rec_weighted = float(recall_score(y_true, y_pred, average="weighted", zero_division=0))
    f1_weighted = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))

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

    # Extract specific error transitions
    # Class mapping: 0=benign, 1=malicious, 2=tampered
    # cm[true][pred]
    malicious_to_benign = int(cm[1, 0])
    malicious_to_tampered = int(cm[1, 2])
    tampered_to_benign = int(cm[2, 0])
    benign_to_malicious = int(cm[0, 1])

    return {
        "val_loss": float(avg_loss),
        "val_accuracy": float(acc),
        "precision_weighted": prec_weighted,
        "recall_weighted": rec_weighted,
        "f1_weighted": f1_weighted,
        "macro_precision": float(macro_p),
        "macro_recall": float(macro_r),
        "macro_f1": float(macro_f1),
        "benign_recall": float(per_class_metrics["benign"]["recall"]),
        "malicious_recall": float(per_class_metrics["malicious"]["recall"]),
        "tampered_recall": float(per_class_metrics["tampered"]["recall"]),
        "per_class_metrics": per_class_metrics,
        "confusion_matrix": cm.tolist(),
        "error_counts": {
            "malicious_to_benign": malicious_to_benign,
            "malicious_to_tampered": malicious_to_tampered,
            "tampered_to_benign": tampered_to_benign,
            "benign_to_malicious": benign_to_malicious
        }
    }


def main():
    print("=" * 70)
    print("DeepQR Shield - Step 04: Final Visual ResNet18 Model Training")
    print("=" * 70)

    # 1. Reproducibility
    seed = 42
    set_seed(seed)

    # 2. GPU Check
    device, gpu_name, total_vram = check_gpu()

    # 3. Output directories
    models_dir = os.path.join("models", "visual")
    results_dir = os.path.join("results", "visual_final")
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(results_dir, exist_ok=True)

    # 4. Data Loading Setup
    train_dir = os.path.join("data", "clean_qr", "train")
    val_dir = os.path.join("data", "clean_qr", "val")
    if not os.path.exists(train_dir) or not os.path.exists(val_dir):
        raise FileNotFoundError(f"Cleaned dataset paths not found: {train_dir} or {val_dir}")

    # ImageNet normalization values
    norm_mean = [0.485, 0.456, 0.406]
    norm_std = [0.229, 0.224, 0.225]

    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ColorJitter(brightness=0.1, contrast=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=norm_mean, std=norm_std),
    ])

    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=norm_mean, std=norm_std),
    ])

    train_dataset = datasets.ImageFolder(train_dir, transform=train_transform, loader=pil_rgb_loader)
    val_dataset = datasets.ImageFolder(val_dir, transform=val_transform, loader=pil_rgb_loader)

    class_names = train_dataset.classes
    class_to_idx = train_dataset.class_to_idx
    print(f"\n[DATASET] Classes: {class_names}")
    print(f"[DATASET] Class Indices: {class_to_idx}")
    assert class_to_idx == {"benign": 0, "malicious": 1, "tampered": 2}, "Class order mismatch!"

    print(f"[DATASET] Train samples: {len(train_dataset)}")
    print(f"[DATASET] Validation samples: {len(val_dataset)}")
    print("[DATASET] Test split remains strictly untouched.")

    batch_size = 32
    num_workers = 0  # Conservative for Windows stability

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

    # 5. Initialize Model
    model = build_resnet18(num_classes=len(class_names)).to(device)
    criterion = nn.CrossEntropyLoss()
    scaler = torch.amp.GradScaler("cuda")

    history: List[Dict[str, Any]] = []

    # Best checkpoint tracking state
    # Priority: (malicious_recall, macro_f1, -val_loss, val_accuracy)
    best_ranking_tuple = (-1.0, -1.0, -float("inf"), -1.0)
    best_epoch = -1
    best_stage = -1
    best_model_state = None
    best_val_metrics = None

    total_training_start = time.time()

    # =========================================================================
    # STAGE 1: Freeze backbone, train classification head only (5 epochs)
    # =========================================================================
    stage1_epochs = 5
    stage1_lr = 1e-3
    print("\n" + "=" * 70)
    print(f"STAGE 1: Training Classification Head ({stage1_epochs} Epochs, LR={stage1_lr})")
    print("Backbone layers (conv1, bn1, layer1, layer2, layer3, layer4) are FROZEN.")
    print("=" * 70)

    # Freeze all parameters
    for param in model.parameters():
        param.requires_grad = False
    # Unfreeze fc only
    for param in model.fc.parameters():
        param.requires_grad = True

    stage1_trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"[STAGE 1] Trainable Parameters: {stage1_trainable:,} / {total_params:,}")

    optimizer_stage1 = torch.optim.AdamW(
        model.fc.parameters(),
        lr=stage1_lr,
        weight_decay=1e-2
    )

    for epoch in range(1, stage1_epochs + 1):
        epoch_start = time.time()
        model.train()
        running_train_loss = 0.0
        train_correct = 0
        total_train_samples = 0

        for inputs, targets in train_loader:
            inputs = inputs.to(device)
            targets = targets.to(device)

            optimizer_stage1.zero_grad()
            with torch.amp.autocast("cuda"):
                outputs = model(inputs)
                loss = criterion(outputs, targets)

            scaler.scale(loss).backward()
            scaler.step(optimizer_stage1)
            scaler.update()

            running_train_loss += loss.item() * inputs.size(0)
            preds = torch.argmax(outputs, dim=1)
            train_correct += (preds == targets).sum().item()
            total_train_samples += inputs.size(0)

        train_loss = running_train_loss / total_train_samples
        train_acc = train_correct / total_train_samples
        val_eval = evaluate_model(model, val_loader, criterion, device, class_names)
        epoch_duration = time.time() - epoch_start
        peak_vram_mb = torch.cuda.max_memory_allocated(0) / (1024 ** 2)

        epoch_record = {
            "epoch": epoch,
            "stage": 1,
            "train_loss": float(train_loss),
            "train_accuracy": float(train_acc),
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
            f"Stage 1 - Epoch [{epoch:02d}/{stage1_epochs:02d}] | "
            f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:.2f}% | "
            f"Val Loss: {val_eval['val_loss']:.4f} | Val Acc: {val_eval['val_accuracy']*100:.2f}% | "
            f"Macro F1: {val_eval['macro_f1']:.4f} | "
            f"Malicious Rec: {val_eval['malicious_recall']*100:.2f}% | "
            f"Tampered Rec: {val_eval['tampered_recall']*100:.2f}% | "
            f"Time: {epoch_duration:.1f}s"
        )

        # Checkpoint selection ranking
        # Priority: (malicious_recall, macro_f1, -val_loss, val_accuracy)
        current_ranking = (
            val_eval["malicious_recall"],
            val_eval["macro_f1"],
            -val_eval["val_loss"],
            val_eval["val_accuracy"]
        )
        if current_ranking > best_ranking_tuple:
            best_ranking_tuple = current_ranking
            best_epoch = epoch
            best_stage = 1
            best_val_metrics = val_eval
            best_model_state = {k: v.cpu() for k, v in model.state_dict().items()}

    # =========================================================================
    # STAGE 2: Unfreeze layer4 + fc, fine-tune with lower LR (10 epochs)
    # =========================================================================
    stage2_epochs = 10
    stage2_lr = 1e-4
    print("\n" + "=" * 70)
    print(f"STAGE 2: Fine-Tuning layer4 + Head ({stage2_epochs} Epochs, LR={stage2_lr})")
    print("Backbone earlier layers (conv1, bn1, layer1, layer2, layer3) remain FROZEN.")
    print("=" * 70)

    # Unfreeze layer4
    for param in model.layer4.parameters():
        param.requires_grad = True

    stage2_trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[STAGE 2] Trainable Parameters: {stage2_trainable:,} / {total_params:,}")

    optimizer_stage2 = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=stage2_lr,
        weight_decay=1e-2
    )

    for epoch_idx in range(1, stage2_epochs + 1):
        epoch = stage1_epochs + epoch_idx
        epoch_start = time.time()
        model.train()
        running_train_loss = 0.0
        train_correct = 0
        total_train_samples = 0

        for inputs, targets in train_loader:
            inputs = inputs.to(device)
            targets = targets.to(device)

            optimizer_stage2.zero_grad()
            with torch.amp.autocast("cuda"):
                outputs = model(inputs)
                loss = criterion(outputs, targets)

            scaler.scale(loss).backward()
            scaler.step(optimizer_stage2)
            scaler.update()

            running_train_loss += loss.item() * inputs.size(0)
            preds = torch.argmax(outputs, dim=1)
            train_correct += (preds == targets).sum().item()
            total_train_samples += inputs.size(0)

        train_loss = running_train_loss / total_train_samples
        train_acc = train_correct / total_train_samples
        val_eval = evaluate_model(model, val_loader, criterion, device, class_names)
        epoch_duration = time.time() - epoch_start
        peak_vram_mb = torch.cuda.max_memory_allocated(0) / (1024 ** 2)

        epoch_record = {
            "epoch": epoch,
            "stage": 2,
            "train_loss": float(train_loss),
            "train_accuracy": float(train_acc),
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
            f"Stage 2 - Epoch [{epoch:02d}/{stage1_epochs + stage2_epochs:02d}] | "
            f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:.2f}% | "
            f"Val Loss: {val_eval['val_loss']:.4f} | Val Acc: {val_eval['val_accuracy']*100:.2f}% | "
            f"Macro F1: {val_eval['macro_f1']:.4f} | "
            f"Malicious Rec: {val_eval['malicious_recall']*100:.2f}% | "
            f"Tampered Rec: {val_eval['tampered_recall']*100:.2f}% | "
            f"Time: {epoch_duration:.1f}s"
        )

        current_ranking = (
            val_eval["malicious_recall"],
            val_eval["macro_f1"],
            -val_eval["val_loss"],
            val_eval["val_accuracy"]
        )
        if current_ranking > best_ranking_tuple:
            best_ranking_tuple = current_ranking
            best_epoch = epoch
            best_stage = 2
            best_val_metrics = val_eval
            best_model_state = {k: v.cpu() for k, v in model.state_dict().items()}

    total_training_time = time.time() - total_training_start
    print("\n" + "=" * 70)
    print(f"TRAINING COMPLETE in {total_training_time:.2f} seconds.")
    print(f"Best Checkpoint Selected: Epoch {best_epoch} (Stage {best_stage})")
    print(f"Best Malicious Recall: {best_val_metrics['malicious_recall']*100:.2f}% | Macro F1: {best_val_metrics['macro_f1']:.4f}")
    print("=" * 70)

    # 6. Save Training History
    history_df = pd.DataFrame(history)
    history_csv_path = os.path.join(results_dir, "training_history.csv")
    history_df.to_csv(history_csv_path, index=False)
    print(f"[SAVE] Training history CSV saved: {history_csv_path}")

    # 7. Save Final Model Checkpoint
    checkpoint_path = os.path.join(models_dir, "resnet18_final.pt")
    checkpoint_data = {
        "model_architecture": "resnet18",
        "model_state_dict": best_model_state,
        "class_names": class_names,
        "class_to_idx": class_to_idx,
        "input_size": [224, 224],
        "normalization": {
            "mean": norm_mean,
            "std": norm_std
        },
        "training_config": {
            "stage1_epochs": stage1_epochs,
            "stage1_lr": stage1_lr,
            "stage2_epochs": stage2_epochs,
            "stage2_lr": stage2_lr,
            "total_epochs": stage1_epochs + stage2_epochs,
            "batch_size": batch_size,
            "optimizer": "AdamW",
            "weight_decay": 1e-2,
            "loss_function": "CrossEntropyLoss",
            "device": "cuda",
            "mixed_precision": True,
            "fine_tuned_layers": ["layer4", "fc"],
            "frozen_layers": ["conv1", "bn1", "layer1", "layer2", "layer3"]
        },
        "random_seed": seed,
        "best_epoch": best_epoch,
        "best_stage": best_stage,
        "best_val_metrics": best_val_metrics,
        "selection_criteria": "Priority: 1. malicious_recall, 2. macro_f1, 3. val_loss, 4. val_accuracy",
        "system_info": {
            "python_version": str(sys.version),
            "pytorch_version": str(torch.__version__),
            "cuda_version": str(torch.version.cuda),
            "gpu_name": str(gpu_name)
        }
    }
    torch.save(checkpoint_data, checkpoint_path)
    print(f"[SAVE] Final model checkpoint saved: {checkpoint_path}")

    # 8. Save Validation Metrics JSON
    val_metrics_json_path = os.path.join(results_dir, "validation_metrics.json")
    val_metrics_output = {
        "model_architecture": "resnet18",
        "best_epoch": best_epoch,
        "best_stage": best_stage,
        "total_training_time_sec": float(total_training_time),
        "peak_vram_mb": float(torch.cuda.max_memory_allocated(0) / (1024 ** 2)),
        "selection_criteria": "1. malicious_recall, 2. macro_f1, 3. val_loss, 4. val_accuracy",
        "validation_metrics": best_val_metrics,
        "system_info": {
            "python_version": str(sys.version),
            "pytorch_version": str(torch.__version__),
            "cuda_version": str(torch.version.cuda),
            "gpu_name": str(gpu_name)
        }
    }
    with open(val_metrics_json_path, "w") as f:
        json.dump(val_metrics_output, f, indent=2)
    print(f"[SAVE] Validation metrics JSON saved: {val_metrics_json_path}")

    # 9. Save Confusion Matrix JSON
    confusion_matrix_json_path = os.path.join(results_dir, "confusion_matrix.json")
    cm_output = {
        "classes": class_names,
        "class_to_idx": class_to_idx,
        "best_epoch": best_epoch,
        "confusion_matrix": best_val_metrics["confusion_matrix"],
        "error_counts": best_val_metrics["error_counts"]
    }
    with open(confusion_matrix_json_path, "w") as f:
        json.dump(cm_output, f, indent=2)
    print(f"[SAVE] Confusion matrix JSON saved: {confusion_matrix_json_path}")

    print("\n" + "=" * 70)
    print("FINAL EVALUATION ON VALIDATION SET (BEST CHECKPOINT)")
    print("=" * 70)
    print(f"Best Checkpoint: Epoch {best_epoch} (Stage {best_stage})")
    print(f"Validation Accuracy: {best_val_metrics['val_accuracy']*100:.2f}%")
    print(f"Validation Loss:     {best_val_metrics['val_loss']:.4f}")
    print(f"Macro Precision:     {best_val_metrics['macro_precision']:.4f}")
    print(f"Macro Recall:        {best_val_metrics['macro_recall']:.4f}")
    print(f"Macro F1:            {best_val_metrics['macro_f1']:.4f}")
    print(f"Benign Recall:       {best_val_metrics['benign_recall']*100:.2f}%")
    print(f"Malicious Recall:    {best_val_metrics['malicious_recall']*100:.2f}%")
    print(f"Tampered Recall:     {best_val_metrics['tampered_recall']*100:.2f}%")
    print("\nConfusion Matrix [rows=True, cols=Pred]:")
    print(f"                 benign  malicious  tampered")
    for idx, cname in enumerate(class_names):
        row = best_val_metrics['confusion_matrix'][idx]
        print(f"  {cname:12s}: {row[0]:6d}  {row[1]:9d}  {row[2]:8d}")

    print("\nDetailed Error Transitions:")
    errs = best_val_metrics["error_counts"]
    print(f"  Malicious -> Benign (Critical False Negative): {errs['malicious_to_benign']}")
    print(f"  Malicious -> Tampered:                        {errs['malicious_to_tampered']}")
    print(f"  Tampered  -> Benign (False Negative):          {errs['tampered_to_benign']}")
    print(f"  Benign    -> Malicious (False Positive):       {errs['benign_to_malicious']}")
    print("=" * 70)


if __name__ == "__main__":
    main()
