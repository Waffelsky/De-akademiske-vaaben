from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class SensorCreate(BaseModel):
    sensor_code: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=2, max_length=100)
    measurement_type: Literal["temperature", "vibration"]
    unit: Literal["celsius", "mm/s"]
    min_threshold: float
    max_threshold: float

    @model_validator(mode="after")
    def validate_unit_for_type(self):
        expected = {"temperature": "celsius", "vibration": "mm/s"}
        if self.unit != expected[self.measurement_type]:
            raise ValueError(
                f"{self.measurement_type} requires unit {expected[self.measurement_type]}"
            )
        if self.min_threshold >= self.max_threshold:
            raise ValueError("min_threshold must be lower than max_threshold")
        return self


class SensorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sensor_code: str
    name: str
    measurement_type: str
    unit: str
    min_threshold: float
    max_threshold: float
    is_active: bool
    created_at: datetime
