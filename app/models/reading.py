from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func
from app.database.connection import Base


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=False, index=True)
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    received_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
