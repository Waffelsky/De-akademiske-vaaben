from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ReadingCreate(BaseModel):
    sensor_code: str = Field(min_length=2, max_length=50)
    value: float


class ReadingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sensor_id: int
    value: float
    unit: str
    received_at: datetime
