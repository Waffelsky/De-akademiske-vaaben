from sqlalchemy.orm import Session

from app.models import Anomaly, DomainEvent, Notification, Sensor, SensorReading


def process_reading(db: Session, sensor: Sensor, value: float) -> dict:
    reading = SensorReading(sensor_id=sensor.id, value=value, unit=sensor.unit)
    db.add(reading)
    db.flush()

    received_event = DomainEvent(
        event_type="Sensor Value Received",
        sensor_id=sensor.id,
        reading_id=reading.id,
        payload={"sensor_code": sensor.sensor_code, "value": value, "unit": sensor.unit},
    )
    db.add(received_event)

    response = {
        "status": "normal",
        "sensor_code": sensor.sensor_code,
        "reading_id": reading.id,
        "value": value,
        "unit": sensor.unit,
        "anomaly_detected": False,
        "notification_created": False,
    }

    threshold_type = None
    threshold_value = None
    if value < sensor.min_threshold:
        threshold_type = "minimum"
        threshold_value = sensor.min_threshold
    elif value > sensor.max_threshold:
        threshold_type = "maximum"
        threshold_value = sensor.max_threshold

    if threshold_type:
        description = (
            f"Value {value} {sensor.unit} is outside the "
            f"{threshold_type} threshold ({threshold_value} {sensor.unit})."
        )
        anomaly = Anomaly(
            sensor_id=sensor.id,
            reading_id=reading.id,
            value=value,
            threshold_type=threshold_type,
            threshold_value=threshold_value,
            description=description,
        )
        db.add(anomaly)
        db.flush()

        db.add(DomainEvent(
            event_type="Anomaly Detected",
            sensor_id=sensor.id,
            reading_id=reading.id,
            payload={
                "sensor_code": sensor.sensor_code,
                "value": value,
                "unit": sensor.unit,
                "threshold_type": threshold_type,
                "threshold_value": threshold_value,
            },
        ))

        notification = Notification(
            anomaly_id=anomaly.id,
            title=f"Anomaly detected: {sensor.name}",
            message=description,
            severity="critical",
        )
        db.add(notification)
        db.flush()

        response.update({
            "status": "anomaly_detected",
            "anomaly_detected": True,
            "anomaly_id": anomaly.id,
            "notification_created": True,
            "notification_id": notification.id,
        })

    db.commit()
    return response
