"""
DeepQR Shield - Step 05: Character-Level 1D CNN URL Model Training

Academic Deep Learning mini-project:
Trains a lightweight character-level 1D CNN to classify raw URL strings:
0 = benign
1 = malicious

Data constraints:
- Uses ONLY data/url/url_train_50k.csv (50,000 unique URLs, 50% benign, 50% malicious).
- Stratified split: 70% train (35,000), 15% validation (7,500), 15% test (7,500).
- Vocabulary built strictly from training URLs.
- URL test split evaluated exactly once after training completion.
- Test split NEVER used for checkpoint selection or early stopping.

Output artifacts:
- models/url/url_cnn_final.pt
- results/url_final/training_history.csv
- results/url_final/validation_metrics.json
- results/url_final/test_metrics.json
- results/url_final/confusion_matrix.json
- results/url_final/split_metadata.json
"""

import os
import sys
import time
import json
import random
from typing import Dict, Any, Tuple, List

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    precision_recall_fscore_support,
    confusion_matrix
)

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader


def set_seed(seed: int = 42) -> None:
    """Set random seeds across libraries for strict reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


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


class URLCharDataset(Dataset):
    """Character-level tokenized dataset for URL strings."""
    def __init__(self, urls: List[str], labels: List[int], vocab: Dict[str, int], max_len: int = 200):
        self.urls = list(urls)
        self.labels = list(labels)
        self.vocab = vocab
        self.max_len = max_len
        self.pad_id = vocab["<PAD>"]
        self.unk_id = vocab["<UNK>"]

    def __len__(self) -> int:
        return len(self.urls)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        url = str(self.urls[idx])
        tokens = [self.vocab.get(c, self.unk_id) for c in url]
        if len(tokens) > self.max_len:
            tokens = tokens[:self.max_len]
        else:
            tokens = tokens + [self.pad_id] * (self.max_len - len(tokens))

        return torch.tensor(tokens, dtype=torch.long), torch.tensor(self.labels[idx], dtype=torch.long)


class URLCharCNN(nn.Module):
    """
    Compact character-level 1D CNN for URL classification.
    Raw URL -> Character tokens -> Embedding -> 1D Conv -> ReLU -> MaxPool -> 1D Conv -> ReLU -> Global Pool -> FC -> 2-class logits
    """
    def __init__(
        self,
        vocab_size: int,
        embed_dim: int = 64,
        conv1_channels: int = 128,
        conv1_kernel: int = 5,
        conv2_channels: int = 128,
        conv2_kernel: int = 5,
        fc_units: int = 64,
        num_classes: int = 2,
        dropout: float = 0.3
    ):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.conv1 = nn.Conv1d(embed_dim, conv1_channels, kernel_size=conv1_kernel, padding=conv1_kernel // 2)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool1d(kernel_size=2)

        self.conv2 = nn.Conv1d(conv1_channels, conv2_channels, kernel_size=conv2_kernel, padding=conv2_kernel // 2)
        self.relu2 = nn.ReLU()

        self.global_pool = nn.AdaptiveMaxPool1d(1)

        self.dropout = nn.Dropout(dropout)
        self.fc1 = nn.Linear(conv2_channels, fc_units)
        self.relu3 = nn.ReLU()
        self.fc2 = nn.Linear(fc_units, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, seq_len]
        emb = self.embedding(x).transpose(1, 2)  # [B, embed_dim, seq_len]
        c1 = self.pool1(self.relu1(self.conv1(emb)))
        c2 = self.relu2(self.conv2(c1))
        pooled = self.global_pool(c2).squeeze(-1)  # [B, conv2_channels]
        out = self.dropout(pooled)
        out = self.relu3(self.fc1(out))
        logits = self.fc2(out)                     # [B, num_classes]
        return logits


def evaluate_loader(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    class_names: List[str] = ["benign", "malicious"]
) -> Dict[str, Any]:
    """Runs evaluation on a DataLoader and computes metrics."""
    model.eval()
    running_loss = 0.0
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for inputs, targets in loader:
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
    p_binary = float(precision_score(y_true, y_pred, average="binary", zero_division=0))
    r_binary = float(recall_score(y_true, y_pred, average="binary", zero_division=0))
    f1_binary = float(f1_score(y_true, y_pred, average="binary", zero_division=0))

    macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0
    )
    p_per_class, r_per_class, f1_per_class, support_per_class = precision_recall_fscore_support(
        y_true, y_pred, average=None, labels=[0, 1], zero_division=0
    )

    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])

    # cm[0, 0]: benign correct, cm[0, 1]: benign -> malicious (FP)
    # cm[1, 0]: malicious -> benign (FN), cm[1, 1]: malicious correct (TP)
    benign_recall = float(r_per_class[0])
    malicious_recall = float(r_per_class[1])
    malicious_fn = int(cm[1, 0])
    malicious_fp = int(cm[0, 1])

    return {
        "loss": float(avg_loss),
        "accuracy": float(acc),
        "precision": p_binary,
        "recall": r_binary,
        "f1": f1_binary,
        "macro_precision": float(macro_p),
        "macro_recall": float(macro_r),
        "macro_f1": float(macro_f1),
        "benign_recall": benign_recall,
        "malicious_recall": malicious_recall,
        "confusion_matrix": cm.tolist(),
        "malicious_false_negatives": malicious_fn,
        "malicious_false_positives": malicious_fp,
        "per_class_metrics": {
            "benign": {
                "precision": float(p_per_class[0]),
                "recall": float(r_per_class[0]),
                "f1": float(f1_per_class[0]),
                "support": int(support_per_class[0])
            },
            "malicious": {
                "precision": float(p_per_class[1]),
                "recall": float(r_per_class[1]),
                "f1": float(f1_per_class[1]),
                "support": int(support_per_class[1])
            }
        }
    }


def main():
    print("=" * 70)
    print("DeepQR Shield - Step 05: Character-Level 1D CNN URL Model Training")
    print("=" * 70)

    # 1. Reproducibility
    seed = 42
    set_seed(seed)

    # 2. GPU Check
    device, gpu_name, total_vram = check_gpu()

    # 3. Directories
    models_dir = os.path.join("models", "url")
    results_dir = os.path.join("results", "url_final")
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(results_dir, exist_ok=True)

    # 4. Load Dataset
    data_path = os.path.join("data", "url", "url_train_50k.csv")
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Cleaned URL dataset not found at: {data_path}")

    df = pd.read_csv(data_path)
    print(f"\n[DATA LOAD] Total URL rows loaded: {len(df)}")
    print(f"[DATA LOAD] Columns: {df.columns.tolist()}")
    print(f"[DATA LOAD] Class distribution:\n{df['label'].value_counts().to_string()}")

    # 5. Stratified Data Split (70% Train, 15% Val, 15% Test)
    # Stratify by result column (0=benign, 1=malicious)
    train_df, temp_df = train_test_split(
        df,
        test_size=0.30,
        random_state=seed,
        stratify=df["result"]
    )
    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.50,
        random_state=seed,
        stratify=temp_df["result"]
    )

    train_df = train_df.reset_index(drop=True)
    val_df = val_df.reset_index(drop=True)
    test_df = test_df.reset_index(drop=True)

    split_meta = {
        "total_samples": len(df),
        "train_samples": len(train_df),
        "train_benign": int((train_df["result"] == 0).sum()),
        "train_malicious": int((train_df["result"] == 1).sum()),
        "val_samples": len(val_df),
        "val_benign": int((val_df["result"] == 0).sum()),
        "val_malicious": int((val_df["result"] == 1).sum()),
        "test_samples": len(test_df),
        "test_benign": int((test_df["result"] == 0).sum()),
        "test_malicious": int((test_df["result"] == 1).sum()),
        "random_seed": seed
    }

    with open(os.path.join(results_dir, "split_metadata.json"), "w") as f:
        json.dump(split_meta, f, indent=2)

    print(f"\n[DATA SPLIT] Train: {len(train_df)} ({split_meta['train_benign']} benign, {split_meta['train_malicious']} malicious)")
    print(f"[DATA SPLIT] Val:   {len(val_df)} ({split_meta['val_benign']} benign, {split_meta['val_malicious']} malicious)")
    print(f"[DATA SPLIT] Test:  {len(test_df)} ({split_meta['test_benign']} benign, {split_meta['test_malicious']} malicious) [HELD OUT]")

    # 6. URL Length Statistics (TRAIN ONLY)
    train_lens = train_df["url"].str.len()
    min_len = int(train_lens.min())
    max_len = int(train_lens.max())
    median_len = float(train_lens.median())
    mean_len = float(train_lens.mean())
    p90_len = float(np.percentile(train_lens, 90))
    p95_len = float(np.percentile(train_lens, 95))
    p99_len = float(np.percentile(train_lens, 99))

    chosen_max_len = 200
    truncated_count = int((train_lens > chosen_max_len).sum())
    truncated_pct = float((train_lens > chosen_max_len).mean() * 100)

    print("\n" + "=" * 70)
    print("URL LENGTH STATISTICS (TRAINING DATA ONLY)")
    print("=" * 70)
    print(f"Minimum Length:         {min_len}")
    print(f"Maximum Length:         {max_len}")
    print(f"Median Length:          {median_len:.1f}")
    print(f"Mean Length:            {mean_len:.2f}")
    print(f"90th Percentile:        {p90_len:.1f}")
    print(f"95th Percentile:        {p95_len:.1f}")
    print(f"99th Percentile:        {p99_len:.1f}")
    print(f"Chosen Max Seq Length:  {chosen_max_len}")
    print(f"Truncated URLs (Train): {truncated_count} / {len(train_df)} ({truncated_pct:.2f}%)")
    print(f"Intact URLs (Train):    {len(train_df) - truncated_count} / {len(train_df)} ({100 - truncated_pct:.2f}%)")
    print("=" * 70)

    # 7. Vocabulary Construction (TRAIN ONLY)
    vocab = {"<PAD>": 0, "<UNK>": 1}
    for url in train_df["url"]:
        for char in str(url):
            if char not in vocab:
                vocab[char] = len(vocab)

    vocab_size = len(vocab)
    print(f"\n[VOCABULARY] Total Vocabulary Size: {vocab_size} tokens (including <PAD>=0, <UNK>=1)")

    # 8. DataLoaders
    batch_size = 128
    num_workers = 0  # Stable on Windows

    train_dataset = URLCharDataset(train_df["url"], train_df["result"], vocab, max_len=chosen_max_len)
    val_dataset = URLCharDataset(val_df["url"], val_df["result"], vocab, max_len=chosen_max_len)
    test_dataset = URLCharDataset(test_df["url"], test_df["result"], vocab, max_len=chosen_max_len)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=num_workers, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers, pin_memory=True)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers, pin_memory=True)

    # 9. Model Instantiation
    model = URLCharCNN(
        vocab_size=vocab_size,
        embed_dim=64,
        conv1_channels=128,
        conv1_kernel=5,
        conv2_channels=128,
        conv2_kernel=5,
        fc_units=64,
        num_classes=2,
        dropout=0.3
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"\n[MODEL] URLCharCNN Architecture initialized.")
    print(f"[MODEL] Total Parameters: {total_params:,} (~{total_params * 4 / (1024**2):.2f} MB)")

    criterion = nn.CrossEntropyLoss()
    learning_rate = 1e-3
    weight_decay = 1e-4
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=weight_decay)
    scaler = torch.amp.GradScaler("cuda")

    # 10. Training Loop
    epochs = 10
    history: List[Dict[str, Any]] = []

    # Priority tuple for best checkpoint:
    # 1. malicious_recall (higher is better)
    # 2. macro_f1 (higher is better)
    # 3. -val_loss (lower val_loss is better)
    # 4. val_accuracy (higher is better)
    best_ranking_tuple = (-1.0, -1.0, -float("inf"), -1.0)
    best_epoch = -1
    best_model_state = None
    best_val_metrics = None

    print("\n" + "=" * 70)
    print(f"STARTING URL MODEL TRAINING ({epochs} Epochs, Batch Size={batch_size}, LR={learning_rate})")
    print("=" * 70)

    start_training_time = time.time()

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()
        model.train()
        running_train_loss = 0.0
        train_correct = 0
        total_train_samples = 0

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
            preds = torch.argmax(outputs, dim=1)
            train_correct += (preds == targets).sum().item()
            total_train_samples += inputs.size(0)

        train_loss = running_train_loss / total_train_samples
        train_acc = train_correct / total_train_samples
        val_eval = evaluate_loader(model, val_loader, criterion, device)
        epoch_duration = time.time() - epoch_start
        peak_vram_mb = torch.cuda.max_memory_allocated(0) / (1024 ** 2)

        record = {
            "epoch": epoch,
            "train_loss": float(train_loss),
            "train_accuracy": float(train_acc),
            "val_loss": val_eval["loss"],
            "val_accuracy": val_eval["accuracy"],
            "val_precision": val_eval["precision"],
            "val_recall": val_eval["recall"],
            "val_f1": val_eval["f1"],
            "macro_precision": val_eval["macro_precision"],
            "macro_recall": val_eval["macro_recall"],
            "macro_f1": val_eval["macro_f1"],
            "benign_recall": val_eval["benign_recall"],
            "malicious_recall": val_eval["malicious_recall"],
            "epoch_time_sec": float(epoch_duration),
            "peak_vram_mb": float(peak_vram_mb)
        }
        history.append(record)

        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] | "
            f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:.2f}% | "
            f"Val Loss: {val_eval['loss']:.4f} | Val Acc: {val_eval['accuracy']*100:.2f}% | "
            f"Macro F1: {val_eval['macro_f1']:.4f} | "
            f"Malicious Rec: {val_eval['malicious_recall']*100:.2f}% | "
            f"Benign Rec: {val_eval['benign_recall']*100:.2f}% | "
            f"Time: {epoch_duration:.1f}s"
        )

        current_ranking = (
            val_eval["malicious_recall"],
            val_eval["macro_f1"],
            -val_eval["loss"],
            val_eval["accuracy"]
        )
        if current_ranking > best_ranking_tuple:
            best_ranking_tuple = current_ranking
            best_epoch = epoch
            best_val_metrics = val_eval
            best_model_state = {k: v.cpu() for k, v in model.state_dict().items()}

    total_training_time = time.time() - start_training_time
    print("\n" + "=" * 70)
    print(f"URL MODEL TRAINING COMPLETE in {total_training_time:.2f} seconds.")
    print(f"Best Checkpoint: Epoch {best_epoch} (Val Loss: {best_val_metrics['loss']:.4f}, Macro F1: {best_val_metrics['macro_f1']:.4f}, Malicious Recall: {best_val_metrics['malicious_recall']*100:.2f}%)")
    print("=" * 70)

    # 11. Save Training History CSV
    history_df = pd.DataFrame(history)
    history_csv_path = os.path.join(results_dir, "training_history.csv")
    history_df.to_csv(history_csv_path, index=False)
    print(f"[SAVE] Training history CSV saved: {history_csv_path}")

    # 12. Save Final Model Checkpoint
    checkpoint_path = os.path.join(models_dir, "url_cnn_final.pt")
    checkpoint_data = {
        "model_architecture": {
            "model_type": "URLCharCNN",
            "vocab_size": vocab_size,
            "embed_dim": 64,
            "conv1_channels": 128,
            "conv1_kernel": 5,
            "conv2_channels": 128,
            "conv2_kernel": 5,
            "fc_units": 64,
            "num_classes": 2,
            "dropout": 0.3
        },
        "model_state_dict": best_model_state,
        "vocab": vocab,
        "pad_token_id": 0,
        "unk_token_id": 1,
        "max_seq_length": chosen_max_len,
        "class_names": ["benign", "malicious"],
        "class_to_idx": {"benign": 0, "malicious": 1},
        "training_config": {
            "epochs": epochs,
            "batch_size": batch_size,
            "learning_rate": learning_rate,
            "weight_decay": weight_decay,
            "optimizer": "AdamW",
            "loss_function": "CrossEntropyLoss",
            "device": "cuda",
            "mixed_precision": True
        },
        "random_seed": seed,
        "best_epoch": best_epoch,
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
    print(f"[SAVE] Final URL model checkpoint saved: {checkpoint_path}")

    # 13. Save Validation Metrics JSON
    val_metrics_json_path = os.path.join(results_dir, "validation_metrics.json")
    val_metrics_output = {
        "model": "URLCharCNN",
        "best_epoch": best_epoch,
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

    # 14. Evaluate on Held-out URL Test Set Exactly Once
    print("\n" + "=" * 70)
    print("EVALUATING BEST CHECKPOINT ON HELD-OUT URL TEST SET")
    print(f"Total URL Test Samples: {len(test_dataset)}")
    print("=" * 70)

    model.load_state_dict(best_model_state)
    test_eval = evaluate_loader(model, test_loader, criterion, device)

    # 15. Save Test Metrics JSON & Confusion Matrix JSON
    test_metrics_json_path = os.path.join(results_dir, "test_metrics.json")
    test_metrics_output = {
        "model": "URLCharCNN",
        "evaluated_epoch": best_epoch,
        "test_samples": len(test_dataset),
        "test_metrics": test_eval,
        "system_info": {
            "python_version": str(sys.version),
            "pytorch_version": str(torch.__version__),
            "cuda_version": str(torch.version.cuda),
            "gpu_name": str(gpu_name)
        }
    }
    with open(test_metrics_json_path, "w") as f:
        json.dump(test_metrics_output, f, indent=2)
    print(f"[SAVE] Test metrics JSON saved: {test_metrics_json_path}")

    confusion_matrix_json_path = os.path.join(results_dir, "confusion_matrix.json")
    cm_output = {
        "classes": ["benign", "malicious"],
        "class_to_idx": {"benign": 0, "malicious": 1},
        "test_confusion_matrix": test_eval["confusion_matrix"],
        "val_confusion_matrix": best_val_metrics["confusion_matrix"],
        "test_malicious_false_negatives": test_eval["malicious_false_negatives"],
        "test_malicious_false_positives": test_eval["malicious_false_positives"]
    }
    with open(confusion_matrix_json_path, "w") as f:
        json.dump(cm_output, f, indent=2)
    print(f"[SAVE] Confusion matrix JSON saved: {confusion_matrix_json_path}")

    # 16. Console Summary
    print("\n" + "=" * 70)
    print("HELD-OUT URL TEST SET RESULTS (BEST CHECKPOINT: EPOCH {})".format(best_epoch))
    print("=" * 70)
    print(f"Test Accuracy:               {test_eval['accuracy']*100:.2f}%")
    print(f"Test Loss:                   {test_eval['loss']:.4f}")
    print(f"Precision (Malicious):       {test_eval['precision']*100:.2f}%")
    print(f"Recall (Malicious):          {test_eval['recall']*100:.2f}%")
    print(f"F1-Score (Malicious):        {test_eval['f1']*100:.2f}%")
    print(f"Macro Precision:             {test_eval['macro_precision']*100:.2f}%")
    print(f"Macro Recall:                {test_eval['macro_recall']*100:.2f}%")
    print(f"Macro F1:                    {test_eval['macro_f1']*100:.2f}%")
    print(f"Benign Recall (Class 0):     {test_eval['benign_recall']*100:.2f}%")
    print(f"Malicious Recall (Class 1):  {test_eval['malicious_recall']*100:.2f}%")

    cm_test = test_eval["confusion_matrix"]
    print("\nTest Confusion Matrix [rows=True, cols=Pred]:")
    print(f"                 Predicted Benign   Predicted Malicious")
    print(f"  True Benign   :     {cm_test[0][0]:6d}              {cm_test[0][1]:6d}")
    print(f"  True Malicious:     {cm_test[1][0]:6d}              {cm_test[1][1]:6d}")

    print("\nError Breakdown:")
    print(f"  Malicious False Negatives (FN, Malicious -> Benign): {test_eval['malicious_false_negatives']}")
    print(f"  Malicious False Positives (FP, Benign -> Malicious): {test_eval['malicious_false_positives']}")
    print(f"  Total Test Samples:                                  {len(test_dataset)}")
    print("=" * 70)


if __name__ == "__main__":
    main()
