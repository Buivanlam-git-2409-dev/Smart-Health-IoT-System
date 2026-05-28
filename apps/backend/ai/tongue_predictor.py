from pathlib import Path
from typing import Any

import torch
from torch import nn
from torchvision import transforms
from torchvision.models import efficientnet_b0
from PIL import Image


BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "tonguedx_multitask_best.pt"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_MODEL = None
_CHECKPOINT = None
_TRANSFORM = None


class TongueMultiTaskModel(nn.Module):
    def __init__(self, num_features: int, num_targets: int):
        super().__init__()

        self.backbone = efficientnet_b0(weights=None)

        # EfficientNet-B0 output feature size = 1280
        self.backbone.classifier = nn.Identity()

        self.feature_head = nn.Sequential(
            nn.Dropout(p=0.2),
            nn.Linear(1280, num_features)
        )

        self.target_head = nn.Sequential(
            nn.Dropout(p=0.2),
            nn.Linear(1280, num_targets)
        )

    def forward(self, x):
        x = self.backbone(x)
        feature_logits = self.feature_head(x)
        target_logits = self.target_head(x)

        return feature_logits, target_logits


def load_tongue_model_once():
    global _MODEL, _CHECKPOINT, _TRANSFORM

    if _MODEL is not None:
        return _MODEL, _CHECKPOINT, _TRANSFORM

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Không tìm thấy model lưỡi: {MODEL_PATH}")

    checkpoint = torch.load(
        MODEL_PATH,
        map_location=DEVICE,
        weights_only=False
    )

    features = checkpoint["features"]
    targets = checkpoint["targets"]
    img_size = int(checkpoint.get("img_size", 224))

    model = TongueMultiTaskModel(
        num_features=len(features),
        num_targets=len(targets)
    )

    model.load_state_dict(checkpoint["model_state"])
    model.to(DEVICE)
    model.eval()

    transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=(0.485, 0.456, 0.406),
            std=(0.229, 0.224, 0.225)
        )
    ])

    _MODEL = model
    _CHECKPOINT = checkpoint
    _TRANSFORM = transform

    print("TongueDx model loaded successfully")
    print("Features:", features)
    print("Targets:", targets)
    print("Image size:", img_size)

    return _MODEL, _CHECKPOINT, _TRANSFORM


def build_status(feature_results: dict, target_results: dict) -> tuple[str, str]:
    abnormal_features = [
        name for name, item in feature_results.items()
        if item["detected"] is True
    ]

    abnormal_targets = [
        name for name, item in target_results.items()
        if item["detected"] is True
    ]

    if len(abnormal_features) >= 3 or len(abnormal_targets) >= 2:
        return (
            "abnormal",
            "Ảnh lưỡi có nhiều đặc điểm bất thường, nên theo dõi thêm."
        )

    if "TonguePale" in abnormal_features:
        return (
            "warning",
            "Phát hiện đặc điểm lưỡi nhợt. Đây có thể là dấu hiệu cần theo dõi thêm."
        )

    if len(abnormal_features) > 0 or len(abnormal_targets) > 0:
        return (
            "warning",
            "Ảnh lưỡi có một số đặc điểm bất thường nhẹ."
        )

    return (
        "normal",
        "Chưa phát hiện đặc điểm bất thường rõ ràng trên ảnh lưỡi."
    )


def predict_tongue(image_path: str) -> dict[str, Any]:
    model, checkpoint, transform = load_tongue_model_once()

    image_file = Path(image_path)

    if not image_file.exists():
        raise FileNotFoundError(f"Không tìm thấy ảnh: {image_file}")

    features = checkpoint["features"]
    targets = checkpoint["targets"]

    feature_thresholds = checkpoint.get("feature_thresholds", None)
    target_thresholds = checkpoint.get("target_thresholds", None)

    if feature_thresholds is None:
        feature_thresholds = [0.5] * len(features)

    if target_thresholds is None:
        target_thresholds = [0.5] * len(targets)

    with Image.open(image_file) as image:
        image = image.convert("RGB")
        input_tensor = transform(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        feature_logits, target_logits = model(input_tensor)

        feature_probs = torch.sigmoid(feature_logits).squeeze(0).cpu().numpy()
        target_probs = torch.sigmoid(target_logits).squeeze(0).cpu().numpy()

    feature_results = {}
    for i, name in enumerate(features):
        probability = float(feature_probs[i])
        threshold = float(feature_thresholds[i])
        detected = probability >= threshold

        feature_results[name] = {
            "probability": round(probability, 4),
            "threshold": round(threshold, 4),
            "detected": bool(detected)
        }

    target_results = {}
    for i, name in enumerate(targets):
        probability = float(target_probs[i])
        threshold = float(target_thresholds[i])
        detected = probability >= threshold

        target_results[name] = {
            "probability": round(probability, 4),
            "threshold": round(threshold, 4),
            "detected": bool(detected)
        }

    status, message = build_status(feature_results, target_results)

    abnormal_features = [
        name for name, item in feature_results.items()
        if item["detected"] is True
    ]

    abnormal_targets = [
        name for name, item in target_results.items()
        if item["detected"] is True
    ]

    return {
        "image_name": image_file.name,
        "image_type": "tongue",
        "status": status,
        "message": message,
        "features": feature_results,
        "targets": target_results,
        "abnormal_features": abnormal_features,
        "abnormal_targets": abnormal_targets
    }