import pytest
from fastapi.testclient import TestClient

from app.main import app

NGROK = "https://womanless-gravitate-expensive.ngrok-free.dev"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize("origin", [NGROK, "http://localhost:3000", "http://127.0.0.1:3001"])
def test_allowed_origins(client, origin):
    res = client.get("/api/health", headers={"Origin": origin})
    assert res.headers.get("access-control-allow-origin") == origin


def test_preflight_from_ngrok(client):
    res = client.options(
        "/api/minimum/summary",
        headers={
            "Origin": NGROK,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "ngrok-skip-browser-warning",
        },
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == NGROK


@pytest.mark.parametrize("origin", ["https://evil.example", "http://womanless-gravitate-expensive.ngrok-free.dev"])
def test_other_origins_rejected(client, origin):
    res = client.get("/api/health", headers={"Origin": origin})
    assert "access-control-allow-origin" not in res.headers
