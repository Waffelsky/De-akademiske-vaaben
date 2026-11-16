from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models import DomainEvent
from app.schemas.output import EventRead

router = APIRouter(prefix="/api/v1/events", tags=["Domain events"])


@router.get("", response_model=list[EventRead])
def list_events(event_type: str | None = None, limit: int = 100, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 500))
    query = db.query(DomainEvent)
    if event_type:
        query = query.filter(DomainEvent.event_type == event_type)
    return query.order_by(DomainEvent.id.desc()).limit(limit).all()
