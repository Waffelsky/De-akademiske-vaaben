def test_health_endpoint_returns_healthy(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_root_endpoint_returns_api_information(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"
    assert response.json()["health"] == "/health"
    assert response.json()["dashboard"] == "/dashboard"
