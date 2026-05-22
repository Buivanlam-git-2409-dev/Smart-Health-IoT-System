from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import SensorLog
from schemas import SensorLogResponse
from mqtt_client import start_mqtt_in_background
from schemas import SensorLogResponse, DeviceControlRequest
from mqtt_client import start_mqtt_in_background, publish_device_command

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