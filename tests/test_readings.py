
def create_test_sensor(
    client,
    sensor_code,
    min_threshold=10,
    max_threshold=40,
):
    payload = {
        "sensor_code": sensor_code,
        "name": "Test Temperature Sensor",
        "measurement_type": "temperature",
        "unit": "celsius",
        "min_threshold": min_threshold,
        "max_threshold": max_threshold,
    }

    response = client.post("/api/v1/sensors", json=payload)
    assert response.status_code == 201
    return response.json()


def test_normal_reading(client):
    create_test_sensor(client, "TEMP-NORMAL")

    response = client.post(
        "/api/v1/readings",
        json={"sensor_code": "TEMP-NORMAL", "value": 25},
    )

    assert response.status_code == 201

    data = response.json()
    assert data["status"] == "normal"
    assert data["value"] == 25
    assert data["anomaly_detected"] is False
    assert data["notification_created"] is False

    readings = client.get(
        "/api/v1/readings",
        params={"sensor_code": "TEMP-NORMAL"},
    )

    assert readings.status_code == 200
    assert len(readings.json()) == 1
    assert readings.json()[0]["value"] == 25


def test_high_temperature_creates_anomaly_and_notification(client):
    create_test_sensor(client, "TEMP-HIGH")

    response = client.post(
        "/api/v1/readings",
        json={"sensor_code": "TEMP-HIGH", "value": 55},
    )

    assert response.status_code == 201

    data = response.json()
    assert data["status"] == "anomaly_detected"
    assert data["anomaly_detected"] is True
    assert data["notification_created"] is True
    assert data["value"] == 55
    assert data["anomaly_id"] is not None
    assert data["notification_id"] is not None


def test_low_temperature_creates_anomaly(client):
    create_test_sensor(client, "TEMP-LOW")

    response = client.post(
        "/api/v1/readings",
        json={"sensor_code": "TEMP-LOW", "value": 5},
    )

    assert response.status_code == 201

    data = response.json()
    assert data["status"] == "anomaly_detected"
    assert data["anomaly_detected"] is True
    assert data["notification_created"] is True
    assert data["value"] == 5
    assert data["anomaly_id"] is not None
    assert data["notification_id"] is not None


def test_reading_at_minimum_threshold_is_normal(client):
    create_test_sensor(client, "TEMP-AT-MIN")

    response = client.post(
        "/api/v1/readings",
        json={"sensor_code": "TEMP-AT-MIN", "value": 10},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "normal"
    assert response.json()["anomaly_detected"] is False
    assert response.json()["notification_created"] is False


def test_reading_at_maximum_threshold_is_normal(client):
    create_test_sensor(client, "TEMP-AT-MAX")

    response = client.post(
        "/api/v1/readings",
        json={"sensor_code": "TEMP-AT-MAX", "value": 40},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "normal"
    assert response.json()["anomaly_detected"] is False
    assert response.json()["notification_created"] is False


def test_reading_from_unknown_sensor_returns_404(client):
    response = client.post(
        "/api/v1/readings",
        json={"sensor_code": "UNKNOWN-SENSOR", "value": 25},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Active sensor not found."


def test_reading_from_inactive_sensor_returns_404(client, db_session):
    from app.models import Sensor

    create_test_sensor(client, "TEMP-INACTIVE")

    sensor = (
        db_session.query(Sensor)
        .filter(Sensor.sensor_code == "TEMP-INACTIVE")
        .first()
    )

    sensor.is_active = False
    db_session.commit()

    response = client.post(
        "/api/v1/readings",
        json={"sensor_code": "TEMP-INACTIVE", "value": 25},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Active sensor not found."


def test_reading_without_sensor_code_returns_422(client):
    response = client.post(
        "/api/v1/readings",
        json={"value": 25},
    )

    assert response.status_code == 422


def test_reading_without_value_returns_422(client):
    response = client.post(
        "/api/v1/readings",
        json={"sensor_code": "TEMP-MISSING"},
    )

    assert response.status_code == 422


def test_reading_with_text_value_returns_422(client):
    response = client.post(
        "/api/v1/readings",
        json={
            "sensor_code": "TEMP-TEXT",
            "value": "not-a-number",
        },
    )

    assert response.status_code == 422


def test_reading_with_null_value_returns_422(client):
    response = client.post(
        "/api/v1/readings",
        json={
            "sensor_code": "TEMP-NULL",
            "value": None,
        },
    )

    assert response.status_code == 422
