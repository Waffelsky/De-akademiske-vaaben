from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func

from app.database.connection import Base


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=False, index=True)
    reading_id = Column(
        Integer, ForeignKey("sensor_readings.id"), nullable=False, unique=True
    )
    value = Column(Float, nullable=False)
    threshold_type = Column(String(10), nullable=False)
    threshold_value = Column(Float, nullable=False)
    description = Column(String(255), nullable=False)
    detected_at = Column(DateTime, server_default=func.now(), nullable=False)
