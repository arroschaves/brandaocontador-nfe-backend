import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def auth_login_should_reject_invalid_credentials_and_return_401():
    url = f"{BASE_URL}/auth/login"
    headers = {
        "Content-Type": "application/json"
    }
    # Using invalid credentials for test
    payload = {
        "email": "invalid_email@example.com",
        "senha": "wrongpassword123"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        # Handle possible connection errors gracefully since DB may be down
        assert False, f"Request failed due to network or server issue: {e}"
    # Assert that the response status code is 401 Unauthorized
    assert response.status_code == 401, f"Expected status 401, got {response.status_code}. Response body: {response.text}"

auth_login_should_reject_invalid_credentials_and_return_401()