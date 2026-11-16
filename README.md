# Predictive Maintenance API – MVP

FastAPI service for IoT sensor readings, threshold checks, domain events, anomaly records and notifications.

## Architecture

- FastAPI exposes the REST API and Swagger documentation.
- SQLAlchemy maps Python models to MySQL tables.
- MySQL persists sensors, readings, domain events, anomalies and notifications.
- A reading creates `Sensor Value Received`.
- Values outside that sensor's individual minimum/maximum threshold also create `Anomaly Detected` and a notification.

## Requirements

- Python 3.10+
- MySQL Server 8.x
- MySQL database `iot_monitoring`
- A MySQL application user with privileges on `iot_monitoring.*`

## Local setup – Windows PowerShell

Run commands from the repository root (the folder containing `requirements.txt`).

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and set the MySQL username and password locally. Never commit `.env`.

Example `.env`:

```ini
APP_NAME=Predictive Maintenance API
APP_VERSION=0.2.0
DB_USER=iot_app
DB_PASSWORD=your-local-password
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=iot_monitoring
```

Create the database and application user in MySQL Workbench (run as an administrator/root account):

```sql
CREATE DATABASE IF NOT EXISTS iot_monitoring;
CREATE USER IF NOT EXISTS 'iot_app'@'localhost' IDENTIFIED BY 'choose-a-strong-local-password';
GRANT ALL PRIVILEGES ON iot_monitoring.* TO 'iot_app'@'localhost';
```

Use the same application-user password in `.env`. If you already created the database/user, do not run `CREATE USER` again with a different password; update the password in MySQL deliberately if needed.

## Start the API

```powershell
uvicorn app.main:app --reload
```

Open:

- Swagger: http://127.0.0.1:8000/docs
- API health: http://127.0.0.1:8000/health
- Database health: http://127.0.0.1:8000/health/database

On first startup, the MVP creates missing tables automatically. Existing tables are not migrated automatically; use Alembic before changing deployed schemas.

## Demo flow

1. `POST /api/v1/sensors` – create a temperature sensor.
2. `POST /api/v1/sensors` – create a vibration sensor.
3. `POST /api/v1/readings` – submit a normal reading.
4. `POST /api/v1/readings` – submit an out-of-range reading.
5. Inspect `/api/v1/events`, `/api/v1/anomalies`, `/api/v1/notifications`.
6. Acknowledge a notification with `PATCH /api/v1/notifications/{id}/acknowledge`.

Example temperature sensor:

```json
{
  "sensor_code": "TEMP-001",
  "name": "Bearing temperature",
  "measurement_type": "temperature",
  "unit": "celsius",
  "min_threshold": 0,
  "max_threshold": 80
}
```

Example vibration sensor:

```json
{
  "sensor_code": "VIB-001",
  "name": "Motor vibration",
  "measurement_type": "vibration",
  "unit": "mm/s",
  "min_threshold": 0,
  "max_threshold": 10
}
```

Example reading:

```json
{
  "sensor_code": "TEMP-001",
  "value": 95
}
```

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | API health |
| GET | `/health/database` | Database health |
| POST | `/api/v1/sensors` | Create sensor |
| GET | `/api/v1/sensors` | List sensors |
| GET | `/api/v1/sensors/{sensor_id}` | Get sensor |
| POST | `/api/v1/readings` | Receive and process sensor reading |
| GET | `/api/v1/readings` | List readings; optional `sensor_code` and `limit` |
| GET | `/api/v1/events` | List domain events; optional `event_type` and `limit` |
| GET | `/api/v1/anomalies` | List anomalies |
| GET | `/api/v1/notifications` | List notifications |
| PATCH | `/api/v1/notifications/{notification_id}/acknowledge` | Acknowledge notification |

## Show tables SQL

USE iot_monitoring;

SELECT * FROM sensors;
SELECT * FROM sensor_readings;
SELECT * FROM domain_events;
SELECT * FROM anomalies;
SELECT * FROM notifications;

## Notes

- Thresholds are individual per sensor.
- The MVP uses synchronous event processing inside the API request; the events are persisted for traceability. A message broker/queue can be added later.
- Notifications are persisted records, not email/SMS delivery.
- `create_all()` is convenient for an MVP. Use Alembic migrations for a production deployment.
- For the next deployment stage, Docker Compose is the simplest reproducible option for this small API and MySQL stack. Azure can be considered if cloud hosting is explicitly preferred.
