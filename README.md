# Predictive Maintenance API – Docker MVP

FastAPI service for IoT sensor readings, threshold checks, domain events, anomaly records and notifications.

This repository is designed to run with **Docker Compose on both Windows (Docker Desktop with Linux containers) and macOS (Docker Desktop)**. The API and MySQL run as separate containers. No Python or MySQL installation is required on the host computer.

## Architecture

- FastAPI exposes the REST API and Swagger documentation.
- SQLAlchemy maps Python models to MySQL tables.
- MySQL persists sensors, readings, domain events, anomalies and notifications.
- A reading creates `Sensor Value Received`.
- Values outside that sensor's individual minimum/maximum threshold also create `Anomaly Detected` and a notification.
- Docker Compose creates a private network between the API and database.
- MySQL data is stored in a named Docker volume (`mysql_data`) and survives container recreation.

## Requirements

- Windows 10/11 with Docker Desktop configured for Linux containers, or macOS with Docker Desktop.
- Docker Compose v2 (`docker compose` command).
- Git (to clone or update the repository).

## 1. Get the project

Clone the repository:

```bash
git clone https://github.com/Waffelsky/De-akademiske-vaaben.git
cd De-akademiske-vaaben
```

If you already have the project folder, open a terminal in its root (the folder containing `docker-compose.yml`).

## 2. Create local environment configuration

Create `.env` from the example.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS Terminal:**

```bash
cp .env.example .env
```

Open `.env` in VS Code and replace both placeholder passwords with strong, unique passwords:

- `DB_PASSWORD`: password for the API's MySQL user.
- `DB_ROOT_PASSWORD`: MySQL administrator password.

Do not commit or share `.env`. It is excluded by `.gitignore`. Never paste its contents into screenshots or chat.

The `DB_HOST` value in `.env.example` is `db`, which is the Docker Compose service name. The API service also explicitly receives `DB_HOST=db` and `DB_PORT=3306`.

## 3. Start the complete application

Run this command from the project root on either Windows or macOS:

```bash
docker compose up --build -d
```

Check that both containers are running:

```bash
docker compose ps
```

View logs if needed:

```bash
docker compose logs -f api
docker compose logs -f db
```

The API waits for MySQL's health check before starting. On the first start, MySQL may need a little time to initialize.

## 4. Test locally on the host computer

Open these addresses in a browser:

- Swagger UI: http://localhost:8000/docs
- API health: http://localhost:8000/health
- Database health: http://localhost:8000/health/database

The API creates missing tables on startup. Existing tables are not migrated automatically; use Alembic before changing deployed schemas.

## 5. Allow another computer on the same local network to access the API

The API port is published on the Docker host as port `8000`. MySQL port `3306` is **not** published to the host or local network.

Find the host computer's local IP address:

**Windows PowerShell:**

```powershell
ipconfig
```

Look for the IPv4 address of the active Wi-Fi or Ethernet adapter.

**macOS Terminal (Wi-Fi, commonly en0):**

```bash
ipconfig getifaddr en0
```

From another computer connected to the same trusted LAN, open:

```text
http://HOST_LOCAL_IP:8000/docs
```

Replace `HOST_LOCAL_IP` with the host computer's local IP address. For example, if the host IP is `192.168.1.25`, use `http://192.168.1.25:8000/docs`.

If it does not connect:
- Confirm both computers are on the same LAN.
- Confirm Docker Desktop is running and `docker compose ps` shows both services running.
- Allow inbound TCP port `8000` in the host operating system's firewall, restricted to the trusted private/local network.
- Do not expose MySQL port `3306`.
- Some guest Wi-Fi networks enable client isolation and prevent devices from communicating.

**Scope:** this setup provides access from the host itself and other devices on the same local network. It does not make the API publicly available over the internet. Public internet access would require additional networking and HTTPS/security configuration and is outside this local Docker setup.

## 6. Stop and restart

Stop containers but keep database data:

```bash
docker compose down
```

Start again:

```bash
docker compose up -d
```

To stop and permanently delete the database volume and its data, use:

```bash
docker compose down -v
```

**Warning:** `down -v` deletes the persisted MySQL data. Do not use it if you need to keep test/demo data.

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

## CI/CD and deployment

GitHub Actions runs the automated test suite on pushes and pull requests to `main` and `develop`. This validates changes before they are merged.

For this local-host deployment model, a GitHub-hosted Actions runner normally cannot directly reach a developer's private LAN computer. Therefore, deployment to the local Docker host is performed by the host operator after tests pass:

```bash
git pull
docker compose up --build -d
```

This keeps CI automated and makes the local deployment repeatable without exposing the host to the public internet or storing remote-host credentials in GitHub.

## Notes and limitations

- Thresholds are individual per sensor.
- The MVP uses synchronous event processing inside the API request; the events are persisted for traceability. A message broker/queue can be added later.
- Notifications are persisted records, not email/SMS delivery.
- `create_all()` is convenient for an MVP. Use Alembic migrations for production schema changes.
- This is a local-network Docker deployment, not a public cloud-hosted service.
