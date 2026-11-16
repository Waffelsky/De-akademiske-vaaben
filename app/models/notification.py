from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from app.database.connection import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("anomalies.id"), nullable=False, unique=True)
    title = Column(String(150), nullable=False)
    message = Column(String(500), nullable=False)
    severity = Column(String(20), nullable=False, default="warning")
    acknowledged = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)
