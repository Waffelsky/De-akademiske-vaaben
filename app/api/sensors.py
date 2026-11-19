from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models import Sensor
from app.schemas.sensor import SensorCreate, SensorRead

router = APIRouter(prefix="/api/v1/sensors", tags=["Sensors"])


@router.post("", response_model=SensorRead, status_code=status.HTTP_201_CREATED)
def create_sensor(data: SensorCreate, db: Session = Depends(get_db)):
    sensor = Sensor(**data.model_dump())
    db.add(sensor)
    try:
        db.commit()
        db.refresh(sensor)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="A sensor with this sensor_code already exists."
        )
    return sensor


@router.get("", response_model=list[SensorRead])
def list_sensors(db: Session = Depends(get_db)):
    return db.query(Sensor).order_by(Sensor.id).all()


@router.get("/{sensor_id}", response_model=SensorRead)
def get_sensor(sensor_id: int, db: Session = Depends(get_db)):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if sensor is None:
        raise HTTPException(status_code=404, detail="Sensor not found.")
    return sensor
