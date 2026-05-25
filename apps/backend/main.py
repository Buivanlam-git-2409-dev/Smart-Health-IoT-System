import shutil
from unittest import result
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from gitdb import db
from sqlalchemy.orm import Session
from fastapi import UploadFile, File, Form
from sqlalchemy.orm import Session
from database import Base, engine, get_db
from models import SensorLog
from schemas import SensorLogResponse
from mqtt_client import start_mqtt_in_background
from schemas import SensorLogResponse, DeviceControlRequest
from mqtt_client import start_mqtt_in_background, publish_device_command
from pathlib import Path
from fastapi import UploadFile, File, Form
from ai.anemia_predictor import predict_anemia
from models import ImageResult
Base.metadata.create_all(bind=engine)

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

UPLOAD_DIR = Path("uploads/anemia")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.post("/api/anemia/predict")
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

    # Gọi AI mock/model để lấy kết quả
    result = predict_anemia(str(save_path))
    result["image_type"] = image_type

    # Lưu kết quả vào database
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