from pathlib import Path
from typing import Any
import json

import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import load_img, img_to_array


BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "best_anemia_eye_mobilenetv2.keras"
LABEL_MAP_PATH = BASE_DIR / "models" / "anemia_eye_label_map.json"

IMG_SIZE = (224, 224)

CLASS_NAMES = ("non-anemic", "anemic")
CLASS_TO_IDX = {name: index for index, name in enumerate(CLASS_NAMES)}
IDX_TO_CLASS = {index: name for name, index in CLASS_TO_IDX.items()}

_MODEL = None
_LABEL_MAP = None
_PREPROCESS_INPUT = None


_MODEL_REGISTRY = {
    "mobilenetv2": {
        "preprocess_module": "tensorflow.keras.applications.mobilenet_v2",
    },
    "resnet50": {
        "preprocess_module": "tensorflow.keras.applications.resnet50",
    },
    "densenet201": {
        "preprocess_module": "tensorflow.keras.applications.densenet",
    },
}


def get_preprocess_input(model_name: str = "mobilenetv2"):
    """
    Lấy hàm preprocess_input tương ứng với model.
    Mặc định: MobileNetV2.
    """
    model_name = model_name.strip().lower()

    if model_name == "resnet50":
        from tensorflow.keras.applications.resnet50 import preprocess_input
        return preprocess_input

    if model_name == "densenet201":
        from tensorflow.keras.applications.densenet import preprocess_input
        return preprocess_input

    # Default MobileNetV2
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
    return preprocess_input


def load_label_map():
    """
    Load label map từ JSON file nếu tồn tại.
    Nếu không có sẽ dùng mặc định.
    """
    global _LABEL_MAP

    if _LABEL_MAP is not None:
        return _LABEL_MAP

    if LABEL_MAP_PATH.exists():
        with open(LABEL_MAP_PATH, "r", encoding="utf-8") as f:
            _LABEL_MAP = json.load(f)
    else:
        # Mặc định: {0: "non-anemic", 1: "anemic"}
        _LABEL_MAP = {
            "non-anemic": 0,
            "anemic": 1
        }

    return _LABEL_MAP


def load_model_once():
    """
    Load model một lần duy nhất khi API được gọi lần đầu.
    Sử dụng model .keras từ notebook training.
    """
    global _MODEL, _PREPROCESS_INPUT

    if _MODEL is not None:
        return _MODEL, _PREPROCESS_INPUT

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Không tìm thấy model: {MODEL_PATH}")

    # Load model Keras
    _MODEL = load_model(MODEL_PATH)
    _MODEL.summary()

    # Xác định model type từ tên file hoặc cấu trúc
    model_name = "mobilenetv2"  # mặc định
    if "resnet50" in MODEL_PATH.name:
        model_name = "resnet50"
    elif "densenet201" in MODEL_PATH.name:
        model_name = "densenet201"

    _PREPROCESS_INPUT = get_preprocess_input(model_name)

    return _MODEL, _PREPROCESS_INPUT



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
    Hàm chính được main.py gọi.
    Input: đường dẫn ảnh.
    Output: format tương thích với React hiện tại.
    
    Sử dụng model Keras được train từ notebook anemia_eye_conjuctiva_only_training.ipynb
    """
    model, preprocess_input = load_model_once()
    label_map = load_label_map()

    image_file = Path(image_path)

    if not image_file.exists():
        raise FileNotFoundError(f"Không tìm thấy ảnh: {image_file}")

    # Load và preprocess ảnh
    image = load_img(image_file, target_size=IMG_SIZE)
    image_array = img_to_array(image)
    image_array = np.expand_dims(image_array, axis=0)
    image_array = preprocess_input(image_array)

    # Inference
    predictions = model.predict(image_array, verbose=0)
    probabilities = predictions[0]  # lấy batch đầu tiên

    # Binary classification: [non-anemic_prob, anemic_prob]
    non_anemic_probability = float(probabilities[0])
    anemic_probability = float(probabilities[1])

    # Xác định prediction
    predicted_index = np.argmax(probabilities)
    confidence = float(probabilities[predicted_index])

    # Lấy tên class từ label map
    idx_to_class = {v: k for k, v in label_map.items()} if isinstance(label_map, dict) else {}
    
    if not idx_to_class:
        idx_to_class = {0: "non-anemic", 1: "anemic"}

    raw_label = idx_to_class.get(predicted_index, "non-anemic")
    prediction_label = normalize_prediction_label(raw_label)

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