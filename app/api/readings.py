from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models import Sensor, SensorReading
from app.schemas.reading import ReadingCreate, ReadingRead
from app.services.monitoring_service import process_reading

router = APIRouter(prefix="/api/v1", tags=["Sensor readings"])


@router.post("/readings", status_code=status.HTTP_201_CREATED)
def receive_reading(data: ReadingCreate, db: Session = Depends(get_db)):
    sensor = (
        db.query(Sensor)
        .filter(
            Sensor.sensor_code == data.sensor_code,
            Sensor.is_active.is_(True),
        )
        .first()
    )
    if sensor is None:
        raise HTTPException(status_code=404, detail="Active sensor not found.")
    return process_reading(db, sensor, data.value)


@router.get("/readings", response_model=list[ReadingRead])
def list_readings(
    sensor_code: str | None = None, limit: int = 100, db: Session = Depends(get_db)
):
    limit = max(1, min(limit, 500))
    query = db.query(SensorReading)
    if sensor_code:
        sensor = db.query(Sensor).filter(Sensor.sensor_code == sensor_code).first()
        if sensor is None:
            raise HTTPException(status_code=404, detail="Sensor not found.")
        query = query.filter(SensorReading.sensor_id == sensor.id)
    return query.order_by(SensorReading.id.desc()).limit(limit).all()
