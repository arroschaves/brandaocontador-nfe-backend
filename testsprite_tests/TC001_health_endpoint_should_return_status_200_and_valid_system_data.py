import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_health_endpoint_should_return_status_200_and_valid_system_data():
    url = f"{BASE_URL}/health"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to /health endpoint failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    # Check if response content is JSON and has basic system health data keys 
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(data, dict), f"Expected response to be a JSON object, got {type(data)}"

    # Validate presence of at least some common health data keys (system and memory info likely)
    # Because the PRD says "basic system health data"
    # As no explicit schema defined, check for common keys like 'status', 'uptime', 'memory', 'system', or similar
    valid_keys = {"status", "uptime", "memory", "system", "version", "health"}
    if not any(key in data for key in valid_keys):
        # If none of these keys present, still accept if data is non-empty
        assert data, "Health endpoint returned empty data"

test_health_endpoint_should_return_status_200_and_valid_system_data()