from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models import Anomaly, Notification
from app.schemas.output import AnomalyRead, NotificationRead

router = APIRouter(prefix="/api/v1", tags=["Anomalies and notifications"])


@router.get("/anomalies", response_model=list[AnomalyRead])
def list_anomalies(limit: int = 100, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 500))
    return db.query(Anomaly).order_by(Anomaly.id.desc()).limit(limit).all()


@router.get("/notifications", response_model=list[NotificationRead])
def list_notifications(acknowledged: bool | None = None, limit: int = 100, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 500))
    query = db.query(Notification)
    if acknowledged is not None:
        query = query.filter(Notification.acknowledged == acknowledged)
    return query.order_by(Notification.id.desc()).limit(limit).all()


@router.patch("/notifications/{notification_id}/acknowledge", response_model=NotificationRead)
def acknowledge_notification(notification_id: int, db: Session = Depends(get_db)):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found.")
    notification.acknowledged = True
    notification.acknowledged_at = datetime.utcnow()
    db.commit()
    db.refresh(notification)
    return notification
