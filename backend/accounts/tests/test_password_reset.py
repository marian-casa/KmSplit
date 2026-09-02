import pytest
from django.core import mail
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import PasswordReset, User

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


def _request_code(client, email):
    return client.post("/api/auth/password-reset/request/", {"email": email})


def _latest_code(test_user):
    return PasswordReset.objects.filter(user=test_user).latest("created_at")


class TestPasswordResetRequest:
    def test_sends_email_with_six_digit_code(self, test_user, settings):
        settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
        client = APIClient()

        response = _request_code(client, test_user.email)
        assert response.status_code == 200

        reset = _latest_code(test_user)
        assert len(reset.code) == 6
        assert reset.code.isdigit()

        assert len(mail.outbox) == 1
        assert reset.code in mail.outbox[0].body

    def test_unregistered_email_returns_same_message(self):
        client = APIClient()
        response = client.post(
            "/api/auth/password-reset/request/", {"email": "nadie@test.com"}
        )
        assert response.status_code == 200
        assert "Si el email existe" in response.data["detail"]
        # no se crea ningún reset ni se manda mail
        assert PasswordReset.objects.count() == 0
        assert len(mail.outbox) == 0

    def test_new_request_invalidates_old_unused_code(self, test_user):
        client = APIClient()
        _request_code(client, test_user.email)
        first = _latest_code(test_user)

        _request_code(client, test_user.email)
        second = _latest_code(test_user)

        first.refresh_from_db()
        assert first.is_used is True
        assert second.is_used is False
        assert second.id != first.id


class TestPasswordResetVerify:
    def test_valid_code_passes(self, test_user):
        client = APIClient()
        _request_code(client, test_user.email)
        code = _latest_code(test_user).code

        response = client.post(
            "/api/auth/password-reset/verify/",
            {"email": test_user.email, "code": code},
        )
        assert response.status_code == 200
        assert response.data["valid"] is True

    def test_wrong_code_rejected(self, test_user):
        client = APIClient()
        _request_code(client, test_user.email)

        response = client.post(
            "/api/auth/password-reset/verify/",
            {"email": test_user.email, "code": "000000"},
        )
        assert response.status_code == 400

    def test_expired_code_rejected(self, test_user):
        client = APIClient()
        _request_code(client, test_user.email)
        reset = _latest_code(test_user)
        reset.expires_at = timezone.now() - timezone.timedelta(minutes=1)
        reset.save(update_fields=["expires_at"])

        response = client.post(
            "/api/auth/password-reset/verify/",
            {"email": test_user.email, "code": reset.code},
        )
        assert response.status_code == 400

    def test_too_many_attempts_locks(self, test_user, settings):
        settings.PASSWORD_RESET_MAX_ATTEMPTS = 2
        client = APIClient()
        _request_code(client, test_user.email)

        for _ in range(2):
            client.post(
                "/api/auth/password-reset/verify/",
                {"email": test_user.email, "code": "000000"},
            )

        response = client.post(
            "/api/auth/password-reset/verify/",
            {"email": test_user.email, "code": "000000"},
        )
        assert response.status_code == 429


class TestPasswordResetConfirm:
    def test_sets_new_password_and_consumes_code(self, test_user):
        client = APIClient()
        _request_code(client, test_user.email)
        code = _latest_code(test_user).code

        response = client.post(
            "/api/auth/password-reset/confirm/",
            {
                "email": test_user.email,
                "code": code,
                "new_password": "NuevaClave$123",
                "confirm_password": "NuevaClave$123",
            },
        )
        assert response.status_code == 200

        test_user.refresh_from_db()
        assert test_user.check_password("NuevaClave$123") is True

        reset = _latest_code(test_user)
        reset.refresh_from_db()
        assert reset.is_used is True

    def test_mismatched_passwords_rejected(self, test_user):
        client = APIClient()
        _request_code(client, test_user.email)
        code = _latest_code(test_user).code

        response = client.post(
            "/api/auth/password-reset/confirm/",
            {
                "email": test_user.email,
                "code": code,
                "new_password": "P@ssword1",
                "confirm_password": "P@ssword2",
            },
        )
        assert response.status_code == 400

    def test_weak_password_rejected(self, test_user):
        client = APIClient()
        _request_code(client, test_user.email)
        code = _latest_code(test_user).code

        response = client.post(
            "/api/auth/password-reset/confirm/",
            {
                "email": test_user.email,
                "code": code,
                "new_password": "12345678",
                "confirm_password": "12345678",
            },
        )
        assert response.status_code == 400

    def test_code_cannot_be_reused(self, test_user):
        client = APIClient()
        _request_code(client, test_user.email)
        code = _latest_code(test_user).code

        payload = {
            "email": test_user.email,
            "code": code,
            "new_password": "Primera$1",
            "confirm_password": "Primera$1",
        }
        assert client.post("/api/auth/password-reset/confirm/", payload).status_code == 200
        # segunda vez, el código ya está consumido
        response = client.post(
            "/api/auth/password-reset/confirm/",
            {**payload, "new_password": "Segunda$2", "confirm_password": "Segunda$2"},
        )
        assert response.status_code == 400
