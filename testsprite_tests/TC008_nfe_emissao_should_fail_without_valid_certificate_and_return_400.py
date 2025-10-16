import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_nfe_emissao_should_fail_without_valid_certificate_and_return_400():
    url = f"{BASE_URL}/nfe/emitir"
    headers = {
        "Content-Type": "application/json",
        # No valid certificate header included intentionally to test failure
    }
    payload = {
        # Assuming the endpoint expects some JSON data for NFe emission, 
        # but since the certificate is missing, actual payload details are irrelevant.
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to /nfe/emitir failed with exception: {e}"

    assert response.status_code == 400, (
        f"Expected status code 400 for request without valid certificate, "
        f"got {response.status_code} with response: {response.text}"
    )

test_nfe_emissao_should_fail_without_valid_certificate_and_return_400()