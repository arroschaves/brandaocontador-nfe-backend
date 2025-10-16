import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Admin seed credentials from backend
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "adminpassword"


def get_auth_token():
    url = f"{BASE_URL}/auth/login"
    payload = {
        "email": ADMIN_EMAIL,
        "senha": ADMIN_PASSWORD
    }
    try:
        response = requests.post(url, json=payload, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"

    assert response.status_code == 200, f"Login failed with status {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Login response is not valid JSON"

    assert "token" in data, "Login response missing 'token' field"
    return data["token"]


def test_admin_usuarios_should_return_user_list_with_status_200():
    token = get_auth_token()
    url = f"{BASE_URL}/admin/usuarios"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Backend returns { sucesso: true, usuarios: [...] }
    assert isinstance(data, dict), f"Expected response to be a JSON object, got {type(data)}"
    assert data.get("sucesso") is True, "'sucesso' should be true"
    assert "usuarios" in data and isinstance(data["usuarios"], list), "Missing 'usuarios' list in response"
    if data["usuarios"]:
        assert isinstance(data["usuarios"][0], dict), "User list items should be dictionaries"


test_admin_usuarios_should_return_user_list_with_status_200()
