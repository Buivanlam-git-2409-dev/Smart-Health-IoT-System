from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime
from datetime import datetime
from database import Base


class SensorLog(Base):
    __tablename__ = "sensor_logs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    heart_rate = Column(Integer)
    spo2 = Column(Integer)
    skin_temp = Column(Float)
    warning = Column(Boolean, default=False)
    reason = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)