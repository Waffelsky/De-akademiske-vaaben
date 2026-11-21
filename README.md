# Intelligent IoT Solutions – Predictive Maintenance

IoT monitoring MVP built with FastAPI, MySQL and Docker.

The application receives sensor measurements through a REST API, checks values against configured thresholds, detects anomalies and generates maintenance notifications.

The project includes a web-based monitoring dashboard with sensor status, alarms, historical measurements and mathematical predictive maintenance forecasting.

## Requirements

- Windows 10/11
- Docker Desktop
- Docker Compose
- Git (if cloning the repository)

Docker Desktop must be running before starting the application.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Waffelsky/De-akademiske-vaaben.git
cd De-akademiske-vaaben
```

Alternatively, download the repository and open PowerShell in the project root folder.

### 2. Configure environment variables

Create your local `.env` file:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure the database passwords.

```env
APP_NAME=Predictive Maintenance API
APP_VERSION=0.2.0

DB_USER=iot_api
DB_PASSWORD=your_password
DB_ROOT_PASSWORD=your_root_password
DB_HOST=db
DB_PORT=3306
DB_NAME=iot_monitoring
```

Use your own passwords instead of the examples.

**Important:** Never commit the `.env` file to GitHub.

### 3. Start the application

Make sure Docker Desktop is running.

Open PowerShell in the project root and execute:

```powershell
.\start.ps1
```

The startup script automatically:

1. Starts the Docker Compose services.
2. Builds the API Docker image.
3. Starts the MySQL database.
4. Waits for the API health endpoint.
5. Displays the application URLs.

The first startup may take a little longer because Docker needs to download images and initialize the database.

If PowerShell blocks script execution:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then run:

```powershell
.\start.ps1
```

## Access the Application

Once the application is running:

| Service | URL |
|---|---|
| Dashboard | http://localhost:8000/dashboard |
| Swagger API Documentation | http://localhost:8000/docs |
| API Health | http://localhost:8000/health |
| Database Health | http://localhost:8000/health/database |

Swagger can be used to test the REST API directly from your browser.

## How the System Works

The application consists of two Docker services:

**API – FastAPI**
- Receives sensor measurements.
- Validates incoming data.
- Executes monitoring and threshold logic.
- Generates domain events.
- Creates anomalies and notifications.
- Serves the dashboard and REST API.

**Database – MySQL**
- Stores registered sensors.
- Stores sensor measurements.
- Stores domain events.
- Stores detected anomalies.
- Stores maintenance notifications.

SQLAlchemy is used to communicate with the MySQL database.

### Event Flow

```text
IoT Device / Postman
        |
        v
   REST API
        |
        v
Sensor Value Received
        |
        v
  Store Reading
        |
        v
 Threshold Check
        |
        +--------------------+
        |                    |
        v                    v
  Normal Value         Threshold Exceeded
        |                    |
        v                    v
   No Anomaly         Anomaly Detected
                             |
                             v
                    Create Notification
                             |
                             v
                       Store in MySQL
                             |
                             v
                    Monitoring Dashboard
```

The events are processed synchronously as part of the API request and persisted in the database.

## Predictive Maintenance

The dashboard includes a mathematical forecasting model that estimates the future development of sensor measurements.

The model is not based on AI or Machine Learning.

It uses historical measurements, weighted trends, changes in the trend and exponential damping to calculate future values.

The forecast is displayed as a green continuation of the historical measurement graph.

- Blue line: Historical measurements.
- Green line: Calculated forecast.
- Red line: Configured threshold.

The forecast contains eight future points, with 30 minutes between each point.

### Measurement Time Intervals

The dashboard uses a fixed 30-minute interval between historical measurement points.

This is intentional because the MVP uses manually submitted test measurements through the API. Their original timestamps can be very close together.

The original timestamps are preserved in the database. Only the visualization uses the standardized 30-minute intervals.

Machine Learning could be introduced in a future production solution using larger amounts of historical sensor data and known failure patterns.

## API Endpoints

All application endpoints use the `/api/v1` prefix.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/sensors` | Create a sensor |
| GET | `/api/v1/sensors` | List all sensors |
| GET | `/api/v1/sensors/{sensor_id}` | Get a specific sensor |
| POST | `/api/v1/readings` | Submit a sensor measurement |
| GET | `/api/v1/readings` | Retrieve measurements |
| GET | `/api/v1/events` | Retrieve domain events |
| GET | `/api/v1/anomalies` | Retrieve anomalies |
| GET | `/api/v1/notifications` | Retrieve notifications |
| PATCH | `/api/v1/notifications/{notification_id}/acknowledge` | Acknowledge a notification |

Health endpoints:

- `GET /health`
- `GET /health/database`

See Swagger for request schemas and additional parameters.

## Testing the API

Open Swagger:

http://localhost:8000/docs

### Create a sensor

`POST /api/v1/sensors`

Example JSON:

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

### Submit a normal measurement

`POST /api/v1/readings`

```json
{
  "sensor_code": "TEMP-001",
  "value": 65
}
```

### Trigger an anomaly

Submit a value above the configured threshold:

```json
{
  "sensor_code": "TEMP-001",
  "value": 95
}
```

The system will detect the anomaly and generate a maintenance notification.

Check the results using:

- `GET /api/v1/events`
- `GET /api/v1/anomalies`
- `GET /api/v1/notifications`

### Acknowledge a notification

`PATCH /api/v1/notifications/{notification_id}/acknowledge`

Replace `{notification_id}` with the ID of the notification.

## Useful Docker Commands

All commands below must be executed from the project root.

**Check running containers:**

```powershell
docker compose ps
```

**View API logs:**

```powershell
docker compose logs -f api
```

**View database logs:**

```powershell
docker compose logs -f db
```

**Stop the application:**

```powershell
docker compose down
```

**Start the application again:**

```powershell
.\start.ps1
```

**Rebuild and restart manually:**

```powershell
docker compose up -d --build
```

**Stop and delete all containers and database data:**

```powershell
docker compose down -v
```

Warning: `docker compose down -v` deletes the MySQL data volume. All persisted test data will be lost.

## Access from Another Computer

The API can be accessed from another computer on the same local network.

Find the host computer's IPv4 address:

```powershell
ipconfig
```

Use the IPv4 address of the active network adapter.

Example:

```text
http://192.168.1.25:8000/dashboard
http://192.168.1.25:8000/docs
```

Replace the example IP with the actual address.

Make sure both computers are connected to the same network and that the host firewall allows inbound traffic on port 8000.

MySQL port 3306 is not exposed to the local network.

## CI/CD

GitHub Actions automatically runs the CI pipeline when code is pushed or pull requests are created for the configured branches.

The pipeline includes:

- Dependency installation.
- Code formatting checks.
- Linting.
- Dependency vulnerability scanning.
- Automated tests.
- Docker image build.

Deployment to the local Docker host is performed manually after changes have been pulled:

```powershell
git pull
.\start.ps1
```

## Project Structure

```text
De-akademiske-vaaben/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── app/
│   ├── api/
│   ├── database/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── static/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── dashboard.js
│   └── main.py
│
├── tests/
│
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── requirements-dev.txt
├── start.ps1
└── README.md
```