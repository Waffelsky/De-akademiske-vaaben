
def create_sensor_and_reading(client, sensor_code, value):
    sensor_payload = {
        "sensor_code": sensor_code,
        "name": "Monitoring Test Sensor",
        "measurement_type": "temperature",
        "unit": "celsius",
        "min_threshold": 10,
        "max_threshold": 40,
    }

    sensor_response = client.post(
        "/api/v1/sensors",
        json=sensor_payload,
    )

    assert sensor_response.status_code == 201

    reading_response = client.post(
        "/api/v1/readings",
        json={
            "sensor_code": sensor_code,
            "value": value,
        },
    )

    assert reading_response.status_code == 201
    return reading_response.json()


def test_normal_reading_creates_sensor_event(client):
    create_sensor_and_reading(client, "EVENT-NORMAL", 25)

    response = client.get(
        "/api/v1/events",
        params={"event_type": "Sensor Value Received"},
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["event_type"] == "Sensor Value Received"


def test_anomaly_creates_domain_event(client):
    create_sensor_and_reading(client, "EVENT-ANOMALY", 55)

    response = client.get(
        "/api/v1/events",
        params={"event_type": "Anomaly Detected"},
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["event_type"] == "Anomaly Detected"


def test_anomaly_is_available_through_api(client):
    create_sensor_and_reading(client, "MONITOR-ANOMALY", 55)

    response = client.get("/api/v1/anomalies")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["value"] == 55
    assert response.json()[0]["threshold_type"] == "maximum"
    assert response.json()[0]["threshold_value"] == 40


def test_notification_is_created_and_can_be_filtered(client):
    create_sensor_and_reading(client, "MONITOR-NOTIFICATION", 55)

    all_response = client.get("/api/v1/notifications")

    assert all_response.status_code == 200
    assert len(all_response.json()) == 1

    notification = all_response.json()[0]
    assert notification["severity"] == "critical"
    assert notification["acknowledged"] is False

    unacknowledged_response = client.get(
        "/api/v1/notifications",
        params={"acknowledged": False},
    )

    assert unacknowledged_response.status_code == 200
    assert len(unacknowledged_response.json()) == 1

    acknowledged_response = client.get(
        "/api/v1/notifications",
        params={"acknowledged": True},
    )

    assert acknowledged_response.status_code == 200
    assert len(acknowledged_response.json()) == 0


def test_notification_can_be_acknowledged(client):
    create_sensor_and_reading(client, "MONITOR-ACK", 55)

    notifications = client.get("/api/v1/notifications").json()
    notification_id = notifications[0]["id"]

    response = client.patch(
        f"/api/v1/notifications/{notification_id}/acknowledge"
    )

    assert response.status_code == 200
    assert response.json()["acknowledged"] is True
    assert response.json()["acknowledged_at"] is not None

    acknowledged = client.get(
        "/api/v1/notifications",
        params={"acknowledged": True},
    )

    assert len(acknowledged.json()) == 1


def test_acknowledging_nonexistent_notification_returns_404(client):
    response = client.patch(
        "/api/v1/notifications/99999/acknowledge"
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Notification not found."


def test_normal_reading_creates_consistent_database_records(
    client, db_session
):
    from app.models import DomainEvent, SensorReading

    reading = create_sensor_and_reading(
        client, "INTEGRITY-NORMAL", 25
    )

    stored_reading = (
        db_session.query(SensorReading)
        .filter(SensorReading.id == reading["reading_id"])
        .first()
    )

    assert stored_reading is not None
    assert stored_reading.value == 25
    assert stored_reading.unit == "celsius"

    events = (
        db_session.query(DomainEvent)
        .filter(DomainEvent.reading_id == stored_reading.id)
        .all()
    )

    assert len(events) == 1
    assert events[0].event_type == "Sensor Value Received"
    assert events[0].sensor_id == stored_reading.sensor_id


def test_anomaly_and_notification_have_consistent_references(
    client, db_session
):
    from app.models import Anomaly, DomainEvent, Notification, SensorReading

    result = create_sensor_and_reading(
        client, "INTEGRITY-ANOMALY", 55
    )

    reading = db_session.query(SensorReading).filter(
        SensorReading.id == result["reading_id"]
    ).first()

    anomaly = db_session.query(Anomaly).filter(
        Anomaly.id == result["anomaly_id"]
    ).first()

    notification = db_session.query(Notification).filter(
        Notification.id == result["notification_id"]
    ).first()

    assert reading is not None
    assert anomaly is not None
    assert notification is not None

    assert anomaly.reading_id == reading.id
    assert anomaly.sensor_id == reading.sensor_id
    assert anomaly.value == reading.value
    assert anomaly.threshold_type == "maximum"

    assert notification.anomaly_id == anomaly.id
    assert notification.severity == "critical"

    events = (
        db_session.query(DomainEvent)
        .filter(DomainEvent.reading_id == reading.id)
        .all()
    )

    assert len(events) == 2
    assert {event.event_type for event in events} == {
        "Sensor Value Received",
        "Anomaly Detected",
    }


def test_failed_commit_rolls_back_reading_and_related_records(
    client, db_session, monkeypatch
):
    import pytest
    from sqlalchemy.orm import Session

    from app.models import Anomaly, DomainEvent, Notification, Sensor, SensorReading

    sensor_payload = {
        "sensor_code": "ROLLBACK-TEST",
        "name": "Rollback Test Sensor",
        "measurement_type": "temperature",
        "unit": "celsius",
        "min_threshold": 10,
        "max_threshold": 40,
    }

    sensor_response = client.post(
        "/api/v1/sensors",
        json=sensor_payload,
    )

    assert sensor_response.status_code == 201

    sensor = db_session.query(Sensor).filter(
        Sensor.sensor_code == "ROLLBACK-TEST"
    ).first()

    def fail_commit(self):
        raise RuntimeError("Simulated database commit failure")

    monkeypatch.setattr(Session, "commit", fail_commit)

    with pytest.raises(RuntimeError, match="Simulated database commit failure"):
        client.post(
            "/api/v1/readings",
            json={
                "sensor_code": "ROLLBACK-TEST",
                "value": 55,
            },
        )

    db_session.expire_all()

    assert db_session.query(SensorReading).filter(
        SensorReading.sensor_id == sensor.id
    ).count() == 0

    assert db_session.query(Anomaly).filter(
        Anomaly.sensor_id == sensor.id
    ).count() == 0

    assert db_session.query(Notification).count() == 0

    assert db_session.query(DomainEvent).filter(
        DomainEvent.sensor_id == sensor.id
    ).count() == 0
