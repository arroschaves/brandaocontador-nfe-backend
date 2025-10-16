import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Admin credentials from seed
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "adminpassword"


def get_admin_token():
    url = f"{BASE_URL}/auth/login"
    payload = {
        "email": ADMIN_EMAIL,
        "senha": ADMIN_PASSWORD,
    }
    try:
        resp = requests.post(url, json=payload, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"

    assert resp.status_code == 200, f"Login failed with status {resp.status_code}"
    try:
        data = resp.json()
    except ValueError:
        assert False, "Login response is not valid JSON"

    assert "token" in data, "Login response missing 'token'"
    return data["token"]


def test_admin_health_endpoint_should_return_status_200_and_detailed_system_metrics():
    token = get_admin_token()
    url = f"{BASE_URL}/admin/health"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to /admin/health failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not in JSON format"

    # The backend returns { sucesso: true, health: { ... } }
    assert isinstance(data, dict), "Response is not a JSON object"
    assert data.get("sucesso") is True, "'sucesso' should be true"
    assert "health" in data and isinstance(data["health"], dict), "Missing 'health' object in response"

    health = data["health"]
    # Validate detailed metrics inside health
    assert "memoria" in health and isinstance(health["memoria"], dict), "Missing 'memoria' object in health"
    assert "uptime" in health and isinstance(health["uptime"], (int, float)), "Missing numeric 'uptime' in health"
    assert "status" in health and isinstance(health["status"], str), "Missing 'status' in health"
    assert "timestamp" in health and isinstance(health["timestamp"], str), "Missing 'timestamp' in health"
    assert "versao" in health and isinstance(health["versao"], str), "Missing 'versao' in health"


test_admin_health_endpoint_should_return_status_200_and_detailed_system_metrics()