
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import text

from app.api.routes import router as health_router
from app.api.sensors import router as sensors_router
from app.api.readings import router as readings_router
from app.api.events import router as events_router
from app.api.monitoring import router as monitoring_router
from app.config import settings
from app.database.connection import Base, engine
from app import models  # noqa: F401 - registers all SQLAlchemy models


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "MVP for IoT sensor monitoring, threshold-based anomaly detection, "
        "domain event persistence and maintenance notifications."
    ),
)

# Serve dashboard frontend files
app.mount(
    "/static",
    StaticFiles(directory="app/static"),
    name="static"
)


@app.get("/dashboard", include_in_schema=False)
def dashboard():
    return FileResponse("app/static/index.html")


# Register API routers
app.include_router(health_router)
app.include_router(sensors_router)
app.include_router(readings_router)
app.include_router(events_router)
app.include_router(monitoring_router)


@app.on_event("startup")
def create_database_tables():
    # MVP convenience: create missing tables on startup.
    # For production, replace with Alembic migrations.
    Base.metadata.create_all(bind=engine)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Predictive Maintenance API is running",
        "docs": "/docs",
        "health": "/health",
        "dashboard": "/dashboard",
    }


@app.get("/health/database", tags=["Health"])
def database_health():
    with engine.connect() as connection:
        database_name = connection.execute(
            text("SELECT DATABASE()")
        ).scalar()

    return {
        "status": "healthy",
        "database": database_name,
    }
