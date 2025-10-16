import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Valid user seed credentials from backend
USER_EMAIL = "validuser@example.com"
USER_PASSWORD = "ValidPassword123!"


def test_nfe_historico_should_return_list_of_nfes_with_status_200():
    login_url = f"{BASE_URL}/auth/login"
    historico_url = f"{BASE_URL}/nfe/historico"

    # Login to get JWT token
    login_payload = {
        "email": USER_EMAIL,
        "senha": USER_PASSWORD
    }
    try:
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"RequestException during login: {e}"

    assert login_resp.status_code == 200, f"Login failed with status code {login_resp.status_code}"
    try:
        login_json = login_resp.json()
    except ValueError:
        assert False, "Login response is not valid JSON"

    assert "token" in login_json, "Token not found in login response"
    token = login_json["token"]

    headers = {
        "Authorization": f"Bearer {token}"
    }
    try:
        response = requests.get(historico_url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"RequestException during /nfe/historico GET: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Backend nfe-service returns pagination object: { itens, total, pagina, totalPaginas }
    assert isinstance(data, dict), f"Response data is not a JSON object: {type(data)}"
    assert "itens" in data and isinstance(data["itens"], list), "Missing 'itens' list in response"
    assert "total" in data and isinstance(data["total"], int), "Missing numeric 'total' in response"
    assert "pagina" in data and isinstance(data["pagina"], int), "Missing numeric 'pagina' in response"
    assert "totalPaginas" in data and isinstance(data["totalPaginas"], int), "Missing numeric 'totalPaginas' in response"


test_nfe_historico_should_return_list_of_nfes_with_status_200()
