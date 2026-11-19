from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, func
from app.database.connection import Base


class DomainEvent(Base):
    __tablename__ = "domain_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(80), nullable=False, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=False, index=True)
    reading_id = Column(Integer, ForeignKey("sensor_readings.id"), nullable=True)
    payload = Column(JSON, nullable=False)
    occurred_at = Column(
        DateTime, server_default=func.now(), nullable=False, index=True
    )
