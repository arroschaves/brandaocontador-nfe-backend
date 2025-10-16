import requests
import uuid

BASE_URL = "http://localhost:3001"
REGISTER_ENDPOINT = "/auth/register"
DELETE_USER_ENDPOINT = "/admin/usuarios"

def test_auth_register_should_create_user_with_valid_data_and_return_201():
    # Generate unique user data for registration
    unique_suffix = str(uuid.uuid4())
    user_data = {
        "nome": f"Teste Usuario {unique_suffix}",
        "email": f"teste.user.{unique_suffix}@example.com",
        "senha": "SenhaSegura123!"
    }
    headers = {
        "Content-Type": "application/json"
    }
    timeout = 30
    user_id = None
    try:
        # Send POST request to /auth/register to create a new user
        response = requests.post(
            f"{BASE_URL}{REGISTER_ENDPOINT}",
            json=user_data,
            headers=headers,
            timeout=timeout
        )
    except requests.RequestException as e:
        # If there's connection or other request error, fail test with message
        assert False, f"Request to register user failed: {e}"

    # Assert that the response status code is 201 Created
    assert response.status_code == 201, f"Expected status code 201, got {response.status_code}"

    # Try to obtain user ID from response or fetch it from admin users list for cleanup
    # Because PRD does not specify the response body on successful register, we fetch users to find and delete after.
    try:
        admin_users_response = requests.get(
            f"{BASE_URL}{DELETE_USER_ENDPOINT}",
            timeout=timeout
        )
        assert admin_users_response.status_code == 200, f"Expected 200 on fetching users, got {admin_users_response.status_code}"
        users = admin_users_response.json()
        # Find the registered user by email
        for user in users:
            if user.get("email") == user_data["email"]:
                user_id = user.get("_id") or user.get("id")
                break
    except requests.RequestException:
        # Could not fetch users, skip deletion but note it
        user_id = None

    # Cleanup: delete created user if possible
    if user_id:
        try:
            delete_response = requests.delete(
                f"{BASE_URL}{DELETE_USER_ENDPOINT}/{user_id}",
                timeout=timeout
            )
            # Accept 200 or 204 for delete success, else ignore
            assert delete_response.status_code in (200, 204), f"Failed to delete user on cleanup: {delete_response.status_code}"
        except requests.RequestException:
            # Ignore cleanup failures
            pass

test_auth_register_should_create_user_with_valid_data_and_return_201()