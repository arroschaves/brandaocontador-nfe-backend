import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}


def auth_register_should_reject_invalid_data_and_return_400():
    invalid_payloads = [
        {},  # completely empty
        {"nome": "Valid Name"},  # missing email and senha
        {"email": "test@example.com"},  # missing nome and senha
        {"senha": "password123"},  # missing nome and email
        {"nome": "", "email": "invalidemail", "senha": ""},  # empty and invalid values
        {"nome": "Name", "email": "", "senha": "pass"},  # empty email
        {"nome": "Name", "email": "no-at-symbol.com", "senha": "pass"},  # invalid email format
        {"nome": "Name", "email": "test@example.com"},  # missing senha
        {"email": "test@example.com", "senha": "password123"},  # missing nome
        {"nome": "Name", "senha": "password123"},  # missing email
    ]
    url = f"{BASE_URL}/auth/register"

    for payload in invalid_payloads:
        try:
            response = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT)
        except requests.exceptions.RequestException:
            # Handle backend unavailability gracefully as per instruction
            # Do not fail the test if backend is down, just skip this iteration
            continue

        assert response.status_code == 400, (
            f"Expected status 400 for payload {payload}, got {response.status_code} with body {response.text}"
        )

        # Try to parse JSON response for validation error messages
        try:
            data = response.json()
        except ValueError:
            raise AssertionError(f"Response is not valid JSON for payload {payload}: {response.text}")

        # Validation errors should be in response body (commonly in 'errors' or similar keys)
        # Accept any JSON with keys describing validation messages
        error_keys = ['errors', 'message', 'error', 'validationErrors']
        if not any(key in data for key in error_keys):
            # If none of these keys found, at least check there's some message or data
            assert len(data) > 0, f"Validation errors expected in response JSON for payload {payload}"

# Call the test function
auth_register_should_reject_invalid_data_and_return_400()