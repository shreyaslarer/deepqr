"""
DeepQR Shield - Step 06: Multimodal Decision-Level Fusion Inference Module

Provides reusable offline inference for QR threat detection:
1. ResNet18 visual CNN analysis (benign / malicious / tampered)
2. Offline OpenCV QRCodeDetector decoding attempt
3. If valid URL decoded: Character-level 1D CNN URL threat analysis (benign / malicious)
4. Decision-level weighted fusion rule (0.5 visual + 0.5 URL) with academic thresholds:
   - >= 0.70: MALICIOUS
   - >= 0.40: SUSPICIOUS
   - < 0.40:  SAFE
5. If no URL decoded or non-URL: fallback to visual prediction rule:
   - benign:    SAFE
   - malicious: MALICIOUS
   - tampered:  SUSPICIOUS
"""

import os
import sys
import re
import json
import argparse
from typing import Dict, Any, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms, models


# =============================================================================
# URL Character CNN Architecture (Identical to Step 05)
# =============================================================================
class URLCharCNN(nn.Module):
    """Compact character-level 1D CNN for URL threat classification."""
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
        emb = self.embedding(x).transpose(1, 2)
        c1 = self.pool1(self.relu1(self.conv1(emb)))
        c2 = self.relu2(self.conv2(c1))
        pooled = self.global_pool(c2).squeeze(-1)
        out = self.dropout(pooled)
        out = self.relu3(self.fc1(out))
        return self.fc2(out)


# =============================================================================
# URL Identification Helper (Strictly Offline)
# =============================================================================
def is_url(payload: str) -> bool:
    """
    Offline check to determine if a decoded QR string represents a URL.
    Checks common web protocols or domain-like structures without network calls.
    """
    if not payload or not isinstance(payload, str):
        return False
    p = payload.strip()
    if p.startswith(("http://", "https://", "ftp://", "www.")):
        return True
    if any(c in p for c in [" ", "\n", "\r", "\t"]):
        return False
    non_url_schemes = ("tel:", "mailto:", "sms:", "wifi:", "begin:vcard", "mecard:", "geo:")
    if p.lower().startswith(non_url_schemes):
        return False
    domain_regex = re.compile(
        r"^(https?://|www\.)?"
        r"([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}"
        r"(:\d+)?(/.*)?$",
        re.IGNORECASE
    )
    return bool(domain_regex.match(p))


# =============================================================================
# Multimodal Decision-Level Fusion Engine
# =============================================================================
class DeepQRShieldFusion:
    """
    Loads pretrained visual and URL models and performs decision-level fusion.
    """
    def __init__(
        self,
        visual_model_path: str = "models/visual/resnet18_final.pt",
        url_model_path: str = "models/url/url_cnn_final.pt",
        config_path: str = "models/fusion/fusion_config.json",
        device: Optional[torch.device] = None
    ):
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Load Fusion Config
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                self.config = json.load(f)
        else:
            self.config = {
                "fusion_weights": {"visual_weight": 0.5, "url_weight": 0.5},
                "decision_thresholds": {"suspicious_threshold": 0.40, "malicious_threshold": 0.70}
            }

        self.suspicious_thresh = self.config["decision_thresholds"]["suspicious_threshold"]
        self.malicious_thresh = self.config["decision_thresholds"]["malicious_threshold"]
        self.visual_weight = self.config["fusion_weights"]["visual_weight"]
        self.url_weight = self.config["fusion_weights"]["url_weight"]

        # 1. Load Visual Model (ResNet18)
        if not os.path.exists(visual_model_path):
            raise FileNotFoundError(f"Visual model checkpoint not found: {visual_model_path}")
        v_ckpt = torch.load(visual_model_path, map_location="cpu")
        self.visual_classes = v_ckpt.get("class_names", ["benign", "malicious", "tampered"])
        self.visual_norm = v_ckpt.get("normalization", {
            "mean": [0.485, 0.456, 0.406],
            "std": [0.229, 0.224, 0.225]
        })

        self.visual_model = models.resnet18()
        self.visual_model.fc = nn.Linear(512, len(self.visual_classes))
        self.visual_model.load_state_dict(v_ckpt["model_state_dict"])
        self.visual_model.to(self.device)
        self.visual_model.eval()

        self.visual_transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=self.visual_norm["mean"], std=self.visual_norm["std"])
        ])

        # 2. Load URL Model (URLCharCNN)
        if not os.path.exists(url_model_path):
            raise FileNotFoundError(f"URL model checkpoint not found: {url_model_path}")
        u_ckpt = torch.load(url_model_path, map_location="cpu")
        self.url_classes = u_ckpt.get("class_names", ["benign", "malicious"])
        self.url_vocab = u_ckpt["vocab"]
        self.pad_id = u_ckpt.get("pad_token_id", 0)
        self.unk_id = u_ckpt.get("unk_token_id", 1)
        self.max_seq_len = u_ckpt.get("max_seq_length", 200)

        arch = u_ckpt.get("model_architecture", {})
        self.url_model = URLCharCNN(
            vocab_size=arch.get("vocab_size", len(self.url_vocab)),
            embed_dim=arch.get("embed_dim", 64),
            conv1_channels=arch.get("conv1_channels", 128),
            conv1_kernel=arch.get("conv1_kernel", 5),
            conv2_channels=arch.get("conv2_channels", 128),
            conv2_kernel=arch.get("conv2_kernel", 5),
            fc_units=arch.get("fc_units", 64),
            num_classes=arch.get("num_classes", 2),
            dropout=arch.get("dropout", 0.3)
        )
        self.url_model.load_state_dict(u_ckpt["model_state_dict"])
        self.url_model.to(self.device)
        self.url_model.eval()

        # 3. QR Code Detector
        self.qr_detector = cv2.QRCodeDetector()

    def _tokenize_url(self, url: str) -> torch.Tensor:
        """Converts raw URL string to token ID tensor padded to max_seq_len."""
        tokens = [self.url_vocab.get(c, self.unk_id) for c in str(url)]
        if len(tokens) > self.max_seq_len:
            tokens = tokens[:self.max_seq_len]
        else:
            tokens = tokens + [self.pad_id] * (self.max_seq_len - len(tokens))
        return torch.tensor([tokens], dtype=torch.long, device=self.device)

    def analyze_image(self, image_input, image_name: str = "") -> Dict[str, Any]:
        """
        Executes complete multimodal decision-level fusion analysis for a single QR image.
        Accepts either a file path (str) or a PIL Image object.
        """
        if isinstance(image_input, str):
            image_path = image_input
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"QR image not found: {image_path}")
            with open(image_path, "rb") as f:
                pil_img = Image.open(f).convert("RGB")
            cv_img = cv2.imread(image_path)
        elif isinstance(image_input, Image.Image):
            image_path = image_name or "in_memory_image"
            pil_img = image_input.convert("RGB")
            cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        else:
            raise TypeError(f"Unsupported image input type: {type(image_input)}")

        # Step 1: ResNet18 Visual Inference
        img_tensor = self.visual_transform(pil_img).unsqueeze(0).to(self.device)

        with torch.no_grad():
            vis_logits = self.visual_model(img_tensor)
            vis_probs = F.softmax(vis_logits, dim=1).cpu().numpy()[0]

        vis_pred_idx = int(np.argmax(vis_probs))
        visual_class = self.visual_classes[vis_pred_idx]
        vis_prob_dict = {
            self.visual_classes[i]: float(vis_probs[i]) for i in range(len(self.visual_classes))
        }

        # Visual malicious score includes malicious and tampered probabilities
        p_vis_mal = float(vis_prob_dict.get("malicious", 0.0))
        p_vis_tamp = float(vis_prob_dict.get("tampered", 0.0))
        visual_malicious_score = float(p_vis_mal + p_vis_tamp)

        # Step 2: Offline QR Code Decoding Attempt
        qr_decoded = False
        decoded_payload = None
        payload_type = "none"

        if cv_img is not None:
            decoded_text, _, _ = self.qr_detector.detectAndDecode(cv_img)
            if decoded_text and decoded_text.strip():
                qr_decoded = True
                decoded_payload = decoded_text.strip()
                payload_type = "url" if is_url(decoded_payload) else "text"

        # Step 3: URL Model Execution (Only if payload is a URL)
        url_model_used = False
        url_prediction = None
        url_prob_dict = None
        url_malicious_score = None

        if qr_decoded and payload_type == "url":
            url_model_used = True
            token_tensor = self._tokenize_url(decoded_payload)
            with torch.no_grad():
                url_logits = self.url_model(token_tensor)
                url_probs = F.softmax(url_logits, dim=1).cpu().numpy()[0]

            url_pred_idx = int(np.argmax(url_probs))
            url_prediction = self.url_classes[url_pred_idx]
            url_prob_dict = {
                self.url_classes[i]: float(url_probs[i]) for i in range(len(self.url_classes))
            }
            url_malicious_score = float(url_prob_dict.get("malicious", 0.0))

        # Step 4: Decision-Level Fusion Logic
        if url_model_used and url_malicious_score is not None:
            # Both modalities active
            final_malicious_score = (
                self.visual_weight * visual_malicious_score +
                self.url_weight * url_malicious_score
            )
            if final_malicious_score >= self.malicious_thresh:
                final_class = "MALICIOUS"
            elif final_malicious_score >= self.suspicious_thresh:
                final_class = "SUSPICIOUS"
            else:
                final_class = "SAFE"
        else:
            # Fallback to visual-only rule
            final_malicious_score = visual_malicious_score
            if visual_class == "benign":
                final_class = "SAFE"
            elif visual_class == "malicious":
                final_class = "MALICIOUS"
            elif visual_class == "tampered":
                final_class = "SUSPICIOUS"
            else:
                final_class = "SUSPICIOUS"

        risk_score = int(round(final_malicious_score * 100))
        risk_score = max(0, min(100, risk_score))

        return {
            "image_path": str(image_path),
            "qr_decoded": bool(qr_decoded),
            "decoded_payload": decoded_payload,
            "payload_type": payload_type,
            "visual_class": visual_class,
            "visual_probabilities": {
                k: round(v, 4) for k, v in vis_prob_dict.items()
            },
            "url_model_used": bool(url_model_used),
            "url_prediction": url_prediction,
            "url_probabilities": {
                k: round(v, 4) for k, v in url_prob_dict.items()
            } if url_prob_dict else None,
            "visual_malicious_score": round(visual_malicious_score, 4),
            "url_malicious_score": round(url_malicious_score, 4) if url_malicious_score is not None else None,
            "final_malicious_score": round(final_malicious_score, 4),
            "final_class": final_class,
            "risk_score": risk_score
        }


def main():
    parser = argparse.ArgumentParser(description="DeepQR Shield - Multimodal Decision Fusion Inference")
    parser.add_argument("image_path", type=str, help="Path to input QR code image")
    parser.add_argument("--visual_model", type=str, default="models/visual/resnet18_final.pt")
    parser.add_argument("--url_model", type=str, default="models/url/url_cnn_final.pt")
    parser.add_argument("--config", type=str, default="models/fusion/fusion_config.json")
    args = parser.parse_args()

    engine = DeepQRShieldFusion(
        visual_model_path=args.visual_model,
        url_model_path=args.url_model,
        config_path=args.config
    )
    result = engine.analyze_image(args.image_path)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
