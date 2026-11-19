
def test_readings_limit_is_capped_at_500(client):
    response = client.get("/api/v1/readings", params={"limit": 1000})

    assert response.status_code == 200
    assert len(response.json()) <= 500


def test_readings_limit_is_at_least_one(client):
    response = client.get("/api/v1/readings", params={"limit": 0})

    assert response.status_code == 200
    assert len(response.json()) <= 1


def test_events_limit_is_capped_at_500(client):
    response = client.get("/api/v1/events", params={"limit": 1000})

    assert response.status_code == 200
    assert len(response.json()) <= 500


def test_events_limit_is_at_least_one(client):
    response = client.get("/api/v1/events", params={"limit": 0})

    assert response.status_code == 200
    assert len(response.json()) <= 1


def test_anomalies_limit_is_capped_at_500(client):
    response = client.get("/api/v1/anomalies", params={"limit": 1000})

    assert response.status_code == 200
    assert len(response.json()) <= 500


def test_anomalies_limit_is_at_least_one(client):
    response = client.get("/api/v1/anomalies", params={"limit": 0})

    assert response.status_code == 200
    assert len(response.json()) <= 1


def test_notifications_limit_is_capped_at_500(client):
    response = client.get("/api/v1/notifications", params={"limit": 1000})

    assert response.status_code == 200
    assert len(response.json()) <= 500


def test_notifications_limit_is_at_least_one(client):
    response = client.get("/api/v1/notifications", params={"limit": 0})

    assert response.status_code == 200
    assert len(response.json()) <= 1
