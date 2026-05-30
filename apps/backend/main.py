import shutil
from unittest import result
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import json
from gitdb import db
from sqlalchemy.orm import Session
from fastapi import UploadFile, File, Form
from sqlalchemy.orm import Session
from database import Base, engine, get_db
from models import SensorLog, TongueResult
from schemas import SensorLogResponse
from mqtt_client import start_mqtt_in_background
from schemas import SensorLogResponse, DeviceControlRequest
from mqtt_client import start_mqtt_in_background, publish_device_command
from pathlib import Path
from fastapi import UploadFile, File, Form
from ai.anemia_predictor import predict_anemia
from models import ImageResult
Base.metadata.create_all(bind=engine)
from mqtt_client import publish_device_command
from ai.tongue_predictor import predict_tongue

UPLOAD_DIR = Path("uploads/anemia")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

TONGUE_UPLOAD_DIR = Path("uploads/tongue")
TONGUE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app = FastAPI(
    title="Smart Health IoT Backend",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.on_event("startup")
def startup_event():
    start_mqtt_in_background()


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "Smart Health IoT Backend is running"
    }


@app.get("/api/latest-data", response_model=SensorLogResponse | None)
def get_latest_data(db: Session = Depends(get_db)):
    latest = (
        db.query(SensorLog)
        .order_by(SensorLog.created_at.desc())
        .first()
    )

    return latest


@app.get("/api/history", response_model=list[SensorLogResponse])
def get_history(db: Session = Depends(get_db)):
    history = (
        db.query(SensorLog)
        .order_by(SensorLog.created_at.desc())
        .limit(50)
        .all()
    )

    return history

@app.post("/api/device/control")
def control_device(command: DeviceControlRequest):
    # command_data = command.dict(exclude_none=True) -- old version
    command_data = command.model_dump(exclude_none=True)

    publish_device_command(command_data)

    return {
        "status": "success",
        "message": "Device command published",
        "command": command_data
    }
def trigger_ai_alert_device():
    command = {
        "led": True,
        "buzzer": True,
        "relay": True,
        "source": "ai",
        "reason": "anemia_risk"
    }

    publish_device_command(command)



@app.post("/api/anemia/predict")
async def anemia_predict(
    file: UploadFile = File(...),
    image_type: str = Form("eye"),
    db: Session = Depends(get_db)
):
    allowed_extensions = [".jpg", ".jpeg", ".png", ".webp"]
    file_ext = Path(file.filename).suffix.lower()

    if file_ext not in allowed_extensions:
        return {
            "success": False,
            "message": "Chỉ hỗ trợ ảnh JPG, JPEG, PNG hoặc WEBP."
        }

    save_path = UPLOAD_DIR / file.filename

    with save_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = predict_anemia(str(save_path))
    result["image_type"] = image_type

    image_result = ImageResult(
        image_path=str(save_path),
        image_type=result["image_type"],
        prediction=result["prediction"],
        status=result["status"],
        confidence=result["confidence"],
        message=result["message"],
    )

    db.add(image_result)
    db.commit()
    db.refresh(image_result)

    result["id"] = image_result.id

    if result["status"] == "abnormal":
        trigger_ai_alert_device()

    return {
        "success": True,
        "data": result
    }

@app.get("/api/anemia/history")
def get_anemia_history(db: Session = Depends(get_db)):
    results = (
        db.query(ImageResult)
        .order_by(ImageResult.created_at.desc())
        .limit(20)
        .all()
    )

    return {
        "success": True,
        "data": results
    }

@app.post("/api/tongue/predict")
async def tongue_predict(
    file: UploadFile = File(...),
    image_type: str = Form("tongue"),
    db: Session = Depends(get_db)
):
    allowed_extensions = [".jpg", ".jpeg", ".png", ".webp"]
    file_ext = Path(file.filename).suffix.lower()

    if file_ext not in allowed_extensions:
        return {
            "success": False,
            "message": "Chỉ hỗ trợ ảnh JPG, JPEG, PNG hoặc WEBP."
        }

    save_path = TONGUE_UPLOAD_DIR / file.filename

    with save_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = predict_tongue(str(save_path))
    result["image_type"] = image_type

    tongue_result = TongueResult(
        image_path=str(save_path),
        image_type=result["image_type"],
        status=result["status"],
        message=result["message"],
        abnormal_features=",".join(result["abnormal_features"]),
        abnormal_targets=",".join(result["abnormal_targets"]),
        features_json=json.dumps(result["features"], ensure_ascii=False),
        targets_json=json.dumps(result["targets"], ensure_ascii=False),
    )

    db.add(tongue_result)
    db.commit()
    db.refresh(tongue_result)

    result["id"] = tongue_result.id

    return {
        "success": True,
        "data": result
    }

@app.get("/api/tongue/history")
def get_tongue_history(db: Session = Depends(get_db)):
    results = (
        db.query(TongueResult)
        .order_by(TongueResult.created_at.desc())
        .limit(20)
        .all()
    )

    data = []

    for item in results:
        data.append({
            "id": item.id,
            "image_path": item.image_path,
            "image_type": item.image_type,
            "status": item.status,
            "message": item.message,
            "abnormal_features": item.abnormal_features.split(",") if item.abnormal_features else [],
            "abnormal_targets": item.abnormal_targets.split(",") if item.abnormal_targets else [],
            "features": json.loads(item.features_json) if item.features_json else {},
            "targets": json.loads(item.targets_json) if item.targets_json else {},
            "created_at": item.created_at,
        })

    return {
        "success": True,
        "data": data
    }

@app.get("/api/health/summary")
def get_health_summary(db: Session = Depends(get_db)):
    latest_sensor = (
        db.query(SensorLog)
        .order_by(SensorLog.created_at.desc())
        .first()
    )

    latest_anemia = (
        db.query(ImageResult)
        .order_by(ImageResult.created_at.desc())
        .first()
    )

    latest_tongue = (
        db.query(TongueResult)
        .order_by(TongueResult.created_at.desc())
        .first()
    )

    risk_score = 0
    reasons = []

    # ======================
    # 1. Sensor rules
    # ======================
    if latest_sensor:
        if latest_sensor.heart_rate > 110:
            risk_score += 1
            reasons.append("Nhịp tim cao")

        if latest_sensor.spo2 < 94:
            risk_score += 2
            reasons.append("SpO2 thấp")

        if latest_sensor.skin_temp > 37.8:
            risk_score += 1
            reasons.append("Nhiệt độ cao")

        if latest_sensor.warning:
            risk_score += 1
            if latest_sensor.reason:
                reasons.append(f"Cảm biến cảnh báo: {latest_sensor.reason}")

    # ======================
    # 2. Eye/anemia AI rules
    # ======================
    if latest_anemia:
        if latest_anemia.status == "abnormal":
            risk_score += 3
            reasons.append("AI ảnh mắt nghi ngờ nguy cơ thiếu máu")
        elif latest_anemia.status == "warning":
            risk_score += 1
            reasons.append("AI ảnh mắt có dấu hiệu cần theo dõi")

    # ======================
    # 3. Tongue AI rules
    # ======================
    if latest_tongue:
        abnormal_features = (
            latest_tongue.abnormal_features.split(",")
            if latest_tongue.abnormal_features
            else []
        )

        abnormal_targets = (
            latest_tongue.abnormal_targets.split(",")
            if latest_tongue.abnormal_targets
            else []
        )

        if latest_tongue.status == "abnormal":
            risk_score += 2
            reasons.append("AI ảnh lưỡi phát hiện nhiều đặc điểm bất thường")
        elif latest_tongue.status == "warning":
            risk_score += 1
            reasons.append("AI ảnh lưỡi có dấu hiệu cần theo dõi")

        if "TonguePale" in abnormal_features:
            risk_score += 2
            reasons.append("Phát hiện đặc điểm lưỡi nhợt")

        if len(abnormal_features) >= 3:
            risk_score += 1
            reasons.append("Có nhiều đặc điểm bất thường trên lưỡi")

        if len(abnormal_targets) >= 2:
            risk_score += 1
            reasons.append("Có nhiều nhóm target bất thường từ ảnh lưỡi")

    # ======================
    # 4. Final level
    # ======================
    if risk_score >= 5:
        level = "high"
        status = "high_risk"
        message = "Hệ thống phát hiện nhiều dấu hiệu bất thường. Cần theo dõi kỹ và nên kiểm tra y tế nếu có triệu chứng."
    elif risk_score >= 2:
        level = "warning"
        status = "warning"
        message = "Hệ thống phát hiện một số dấu hiệu cần theo dõi thêm."
    else:
        level = "normal"
        status = "normal"
        message = "Chưa phát hiện dấu hiệu bất thường rõ ràng."

    return {
        "success": True,
        "data": {
            "status": status,
            "level": level,
            "risk_score": risk_score,
            "message": message,
            "reasons": reasons,
            "latest_sensor": {
                "heart_rate": latest_sensor.heart_rate,
                "spo2": latest_sensor.spo2,
                "skin_temp": latest_sensor.skin_temp,
                "warning": latest_sensor.warning,
                "reason": latest_sensor.reason,
                "created_at": latest_sensor.created_at,
            } if latest_sensor else None,
            "latest_anemia": {
                "id": latest_anemia.id,
                "prediction": latest_anemia.prediction,
                "status": latest_anemia.status,
                "confidence": latest_anemia.confidence,
                "message": latest_anemia.message,
                "created_at": latest_anemia.created_at,
            } if latest_anemia else None,
            "latest_tongue": {
                "id": latest_tongue.id,
                "status": latest_tongue.status,
                "message": latest_tongue.message,
                "abnormal_features": (
                    latest_tongue.abnormal_features.split(",")
                    if latest_tongue.abnormal_features
                    else []
                ),
                "abnormal_targets": (
                    latest_tongue.abnormal_targets.split(",")
                    if latest_tongue.abnormal_targets
                    else []
                ),
                "created_at": latest_tongue.created_at,
            } if latest_tongue else None,
        }
    }