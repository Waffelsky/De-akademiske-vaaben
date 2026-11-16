from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_type: str
    sensor_id: int
    reading_id: int | None
    payload: dict[str, Any]
    occurred_at: datetime


class AnomalyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sensor_id: int
    reading_id: int
    value: float
    threshold_type: str
    threshold_value: float
    description: str
    detected_at: datetime


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    anomaly_id: int
    title: str
    message: str
    severity: str
    acknowledged: bool
    created_at: datetime
    acknowledged_at: datetime | None
