
def test_create_sensor(client):
    payload = {
        "sensor_code": "TEMP-TEST-001",
        "name": "Test Temperature Sensor",
        "measurement_type": "temperature",
        "unit": "celsius",
        "min_threshold": 10,
        "max_threshold": 40,
    }

    response = client.post("/api/v1/sensors", json=payload)

    assert response.status_code == 201

    data = response.json()
    assert data["sensor_code"] == "TEMP-TEST-001"
    assert data["name"] == "Test Temperature Sensor"
    assert data["min_threshold"] == 10
    assert data["max_threshold"] == 40
    assert data["is_active"] is True


def test_list_sensors(client):
    payload = {
        "sensor_code": "TEMP-TEST-002",
        "name": "Another Test Sensor",
        "measurement_type": "temperature",
        "unit": "celsius",
        "min_threshold": 5,
        "max_threshold": 35,
    }

    client.post("/api/v1/sensors", json=payload)

    response = client.get("/api/v1/sensors")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["sensor_code"] == "TEMP-TEST-002"


def test_get_sensor(client):
    payload = {
        "sensor_code": "TEMP-TEST-003",
        "name": "Sensor Detail Test",
        "measurement_type": "temperature",
        "unit": "celsius",
        "min_threshold": 0,
        "max_threshold": 50,
    }

    created = client.post("/api/v1/sensors", json=payload)
    sensor_id = created.json()["id"]

    response = client.get(f"/api/v1/sensors/{sensor_id}")

    assert response.status_code == 200
    assert response.json()["sensor_code"] == "TEMP-TEST-003"


def test_duplicate_sensor_returns_conflict(client):
    payload = {
        "sensor_code": "TEMP-DUPLICATE",
        "name": "Duplicate Test Sensor",
        "measurement_type": "temperature",
        "unit": "celsius",
        "min_threshold": 10,
        "max_threshold": 40,
    }

    first_response = client.post("/api/v1/sensors", json=payload)
    second_response = client.post("/api/v1/sensors", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 409


def test_get_nonexistent_sensor_returns_404(client):
    response = client.get("/api/v1/sensors/99999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Sensor not found."


def test_invalid_sensor_unit_returns_422(client):
    payload = {
        "sensor_code": "TEMP-INVALID",
        "name": "Invalid Sensor",
        "measurement_type": "temperature",
        "unit": "mm/s",
        "min_threshold": 10,
        "max_threshold": 40,
    }

    response = client.post("/api/v1/sensors", json=payload)

    assert response.status_code == 422
