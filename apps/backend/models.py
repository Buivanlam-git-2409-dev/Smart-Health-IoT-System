from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text
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

class ImageResult(Base):
    __tablename__ = "image_results"

    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String)
    image_type = Column(String)
    prediction = Column(String)
    status = Column(String)
    confidence = Column(Float)
    message = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
class TongueResult(Base):
    __tablename__ = "tongue_results"

    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String)
    image_type = Column(String, default="tongue")
    status = Column(String)
    message = Column(String)
    abnormal_features = Column(String)
    abnormal_targets = Column(String)
    features_json = Column(Text)
    targets_json = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)