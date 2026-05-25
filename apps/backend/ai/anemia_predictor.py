from pathlib import Path
from typing import Any

import torch
from torch import nn
from torchvision import transforms
from torchvision.models import (
    EfficientNet_B0_Weights,
    EfficientNet_B3_Weights,
    efficientnet_b0,
    efficientnet_b3,
)
from PIL import Image


BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "anemia_model.pth"

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

CLASS_NAMES = ("non-anemic", "anemic")
CLASS_TO_IDX = {name: index for index, name in enumerate(CLASS_NAMES)}
IDX_TO_CLASS = {index: name for name, index in CLASS_TO_IDX.items()}

_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_MODEL = None
_CHECKPOINT = None
_TRANSFORM = None


_MODEL_REGISTRY = {
    "efficientnet_b0": {
        "builder": efficientnet_b0,
        "weights": EfficientNet_B0_Weights.IMAGENET1K_V1,
        "classifier_features": 1280,
    },
    "efficientnet_b3": {
        "builder": efficientnet_b3,
        "weights": EfficientNet_B3_Weights.IMAGENET1K_V1,
        "classifier_features": 1536,
    },
}


def build_model(
    num_classes: int = 2,
    pretrained: bool = False,
    architecture: str = "efficientnet_b3",
) -> nn.Module:
    """
    Build model theo cấu trúc của repo anemia-detection.
    """
    architecture = architecture.strip().lower()

    if architecture not in _MODEL_REGISTRY:
        architecture = "efficientnet_b3"

    spec = _MODEL_REGISTRY[architecture]
    weights = spec["weights"] if pretrained else None

    model = spec["builder"](weights=weights)

    classifier_in_features = spec["classifier_features"]

    model.avgpool = nn.AdaptiveAvgPool2d(output_size=1)
    model.classifier = nn.Sequential(
        nn.Flatten(),
        nn.Linear(classifier_in_features, 512),
        nn.BatchNorm1d(512),
        nn.GELU(),
        nn.Dropout(p=0.45),
        nn.Linear(512, 256),
        nn.BatchNorm1d(256),
        nn.GELU(),
        nn.Dropout(p=0.35),
        nn.Linear(256, num_classes),
    )

    return model


def get_image_size_from_checkpoint(checkpoint: dict[str, Any]) -> tuple[int, int]:
    """
    Ưu tiên lấy image_size từ checkpoint.
    Nếu không có thì dùng 300x300.
    """
    default_size = (300, 300)

    config_snapshot = checkpoint.get("config", {})
    if not isinstance(config_snapshot, dict):
        return default_size

    training_snapshot = config_snapshot.get("training", {})
    if not isinstance(training_snapshot, dict):
        return default_size

    image_size = training_snapshot.get("image_size")

    if isinstance(image_size, (list, tuple)) and len(image_size) == 2:
        return int(image_size[0]), int(image_size[1])

    return default_size


def load_model_once():
    """
    Load model một lần duy nhất khi API được gọi lần đầu.
    """
    global _MODEL, _CHECKPOINT, _TRANSFORM

    if _MODEL is not None:
        return _MODEL, _CHECKPOINT, _TRANSFORM

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Không tìm thấy model: {MODEL_PATH}")

    # PyTorch mới cần weights_only=False để đọc checkpoint cũ.
    checkpoint = torch.load(
        MODEL_PATH,
        map_location=_DEVICE,
        weights_only=False,
    )

    architecture = checkpoint.get("architecture", "efficientnet_b3")
    state_dict = checkpoint["model_state_dict"]

    class_names = checkpoint.get("class_names", list(CLASS_NAMES))
    num_classes = len(class_names)

    model = build_model(
        num_classes=num_classes,
        pretrained=False,
        architecture=architecture,
    )

    model.load_state_dict(state_dict)
    model.to(_DEVICE)
    model.eval()

    image_size = get_image_size_from_checkpoint(checkpoint)

    transform = transforms.Compose(
        [
            transforms.Resize(image_size),
            transforms.CenterCrop(image_size),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )

    _MODEL = model
    _CHECKPOINT = checkpoint
    _TRANSFORM = transform

    return _MODEL, _CHECKPOINT, _TRANSFORM


def normalize_prediction_label(raw_label: str) -> str:
    """
    Đổi label nội bộ thành label dễ hiểu.
    """
    token = raw_label.strip().lower()

    if token.startswith("non"):
        return "Non-Anemic"

    return "Anemic"


def build_message(prediction: str, confidence: float) -> tuple[str, str]:
    """
    Trả về status và message cho dashboard của project mình.
    """
    confidence_percent = confidence * 100

    if prediction == "Anemic":
        status = "abnormal"

        if confidence_percent >= 85:
            message = (
                "AI phát hiện dấu hiệu nghi ngờ thiếu máu ở mức cao. "
                "Nên theo dõi thêm và kiểm tra y tế nếu có triệu chứng."
            )
        elif confidence_percent >= 70:
            message = (
                "AI phát hiện một số dấu hiệu liên quan đến thiếu máu. "
                "Nên chụp lại ảnh rõ hơn hoặc kiểm tra thêm."
            )
        else:
            message = (
                "AI nghi ngờ thiếu máu nhưng độ tin cậy chưa cao. "
                "Kết quả chỉ mang tính tham khảo."
            )

        return status, message

    status = "normal"

    if confidence_percent >= 85:
        message = "AI chưa phát hiện dấu hiệu thiếu máu rõ ràng từ ảnh."
    else:
        message = (
            "AI nghiêng về bình thường nhưng độ tin cậy chưa cao. "
            "Nên chụp lại ảnh rõ hơn nếu cần."
        )

    return status, message


def estimate_risk_level(prediction: str, confidence: float) -> str:
    confidence_percent = confidence * 100

    if prediction == "Anemic":
        if confidence_percent >= 85:
            return "High Risk"
        if confidence_percent >= 70:
            return "Medium Risk"
        return "Possible Anemia"

    if confidence_percent >= 85:
        return "Low Risk"
    if confidence_percent >= 70:
        return "Low-Medium Risk"
    return "Uncertain"


def predict_anemia(image_path: str) -> dict:
    """
    Hàm chính đang được main.py gọi.
    Input: đường dẫn ảnh.
    Output: format tương thích với React hiện tại.
    """
    model, checkpoint, transform = load_model_once()

    image_file = Path(image_path)

    if not image_file.exists():
        raise FileNotFoundError(f"Không tìm thấy ảnh: {image_file}")

    with Image.open(image_file) as image:
        image = image.convert("RGB")
        input_tensor = transform(image).unsqueeze(0).to(_DEVICE)

    with torch.no_grad():
        logits = model(input_tensor)
        probabilities = torch.softmax(logits, dim=1).squeeze(0).cpu()

    predicted_index = int(torch.argmax(probabilities).item())

    class_names = checkpoint.get("class_names", list(CLASS_NAMES))
    raw_label = class_names[predicted_index]

    prediction_label = normalize_prediction_label(raw_label)
    confidence = float(probabilities[predicted_index].item())

    anemic_index = class_names.index("anemic") if "anemic" in class_names else 1
    non_anemic_index = class_names.index("non-anemic") if "non-anemic" in class_names else 0

    anemic_probability = float(probabilities[anemic_index].item())
    non_anemic_probability = float(probabilities[non_anemic_index].item())

    status, message = build_message(prediction_label, confidence)
    risk_level = estimate_risk_level(prediction_label, confidence)

    return {
        "image_name": image_file.name,
        "image_type": "eye",
        "prediction": "anemia_risk" if prediction_label == "Anemic" else "non_anemic",
        "display_prediction": prediction_label,
        "status": status,
        "confidence": round(confidence, 4),
        "anemic_probability": round(anemic_probability, 4),
        "non_anemic_probability": round(non_anemic_probability, 4),
        "risk_level": risk_level,
        "message": message,
    }