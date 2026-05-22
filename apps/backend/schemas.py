from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SensorLogResponse(BaseModel):
    id: int
    device_id: Optional[str]
    heart_rate: int
    spo2: int
    skin_temp: float
    warning: bool
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceControlRequest(BaseModel):
    led: Optional[bool] = None
    buzzer: Optional[bool] = None
    relay: Optional[bool] = None
    mode: Optional[str] = None