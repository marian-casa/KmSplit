import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clear_cache():
    """
    El throttling y el bloqueo de cuenta usan el cache de Django -- sin
    limpiarlo entre tests, un test podría heredar el contador de intentos
    fallidos de otro y dar falsos positivos/negativos.
    """
    cache.clear()
    yield
    cache.clear()


class TestLoginLockout:
    def test_account_locks_after_too_many_failed_attempts(self, test_user):
        client = APIClient()

        for _ in range(5):
            client.post("/api/auth/login/", {"email": test_user.email, "password": "wrong-password"})

        response = client.post(
            "/api/auth/login/", {"email": test_user.email, "password": "wrong-password"}
        )
        assert response.status_code == 429
        assert "retry_after_seconds" in response.data
        assert 0 < response.data["retry_after_seconds"] <= 15 * 60

    def test_successful_login_resets_attempt_counter(self, test_user):
        client = APIClient()

        for _ in range(3):
            client.post("/api/auth/login/", {"email": test_user.email, "password": "wrong-password"})

        response = client.post(
            "/api/auth/login/", {"email": test_user.email, "password": "testpass123"}
        )
        assert response.status_code == 200

    def test_correct_password_still_works_when_under_the_limit(self, test_user):
        client = APIClient()

        client.post("/api/auth/login/", {"email": test_user.email, "password": "wrong-password"})
        client.post("/api/auth/login/", {"email": test_user.email, "password": "wrong-password"})

        response = client.post(
            "/api/auth/login/", {"email": test_user.email, "password": "testpass123"}
        )
        assert response.status_code == 200


class TestPasswordValidation:
    def test_common_password_is_rejected(self):
        client = APIClient()
        response = client.post(
            "/api/auth/register/",
            {"name": "Test", "email": "weakpass@test.com", "password": "password123"},
        )
        assert response.status_code == 400

    def test_fully_numeric_password_is_rejected(self):
        client = APIClient()
        response = client.post(
            "/api/auth/register/",
            {"name": "Test", "email": "numericpass@test.com", "password": "12345678"},
        )
        assert response.status_code == 400

    def test_strong_password_is_accepted(self):
        client = APIClient()
        response = client.post(
            "/api/auth/register/",
            {"name": "Test", "email": "strongpass@test.com", "password": "Xk9$mQ2vRp8Lw"},
        )
        assert response.status_code == 201

class TestCookieBasedRefresh:
    def test_login_sets_httponly_refresh_cookie_and_omits_it_from_body(self, test_user):
        client = APIClient()
        response = client.post(
            "/api/auth/login/", {"email": test_user.email, "password": "testpass123"}
        )

        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" not in response.data  # ya no viaja en el JSON

        cookie = response.cookies.get("kmsplit_refresh")
        assert cookie is not None
        assert cookie["httponly"] is True

    def test_refresh_works_using_cookie_without_sending_a_body(self, test_user):
        client = APIClient()
        client.post("/api/auth/login/", {"email": test_user.email, "password": "testpass123"})

        response = client.post("/api/auth/refresh/")
        assert response.status_code == 200
        assert "access" in response.data

    def test_refresh_fails_without_any_cookie(self):
        client = APIClient()
        response = client.post("/api/auth/refresh/")
        assert response.status_code == 401

    def test_logout_invalidates_the_session(self, test_user):
        client = APIClient()
        client.post("/api/auth/login/", {"email": test_user.email, "password": "testpass123"})

        logout_response = client.post("/api/auth/logout/")
        assert logout_response.status_code == 200

        # después del logout, ya no debería poder refrescar con ese cliente
        refresh_response = client.post("/api/auth/refresh/")
        assert refresh_response.status_code == 401