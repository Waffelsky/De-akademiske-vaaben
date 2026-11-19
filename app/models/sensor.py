from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    func,
)
from app.database.connection import Base


class Sensor(Base):
    __tablename__ = "sensors"
    __table_args__ = (
        CheckConstraint(
            "min_threshold < max_threshold", name="check_sensor_thresholds"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    sensor_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    measurement_type = Column(String(30), nullable=False)
    unit = Column(String(20), nullable=False)
    min_threshold = Column(Float, nullable=False)
    max_threshold = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
