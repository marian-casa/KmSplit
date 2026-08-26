import time

from django.conf import settings
from django.core.cache import cache
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User
from .serializers import RegisterSerializer, UserSerializer

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60  # 15 minutos
REFRESH_COOKIE_NAME = "kmsplit_refresh"


def _set_refresh_cookie(response, refresh_token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="Lax",
        path="/api/auth/",
    )


def _clear_refresh_cookie(response) -> None:
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/auth/")


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/ — alta de usuario. No requiere estar logueado."""

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"


class LockedLoginView(TokenObtainPairView):
    """
    POST /api/auth/login/ — devuelve el access token en el body como
    siempre, pero el refresh token ya NO viaja en el JSON: se manda como
    cookie httpOnly, invisible para JavaScript. También sigue teniendo el
    bloqueo de cuenta tras intentos fallidos que ya teníamos.
    """

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        email = (request.data.get("email") or "").strip().lower()
        attempts_key = f"login_attempts:{email}"
        lockout_key = f"login_lockout_until:{email}"

        if email:
            lockout_until = cache.get(lockout_key)
            if lockout_until:
                remaining = max(0, int(lockout_until - time.time()))
                if remaining > 0:
                    return Response(
                        {
                            "detail": "Demasiados intentos fallidos. Probá de nuevo más tarde.",
                            "retry_after_seconds": remaining,
                        },
                        status=status.HTTP_429_TOO_MANY_REQUESTS,
                    )
                cache.delete(lockout_key)
                cache.delete(attempts_key)

        try:
            response = super().post(request, *args, **kwargs)
        except Exception:
            if email:
                attempts = cache.get(attempts_key, 0) + 1
                cache.set(attempts_key, attempts, timeout=LOCKOUT_SECONDS)
                if attempts >= MAX_LOGIN_ATTEMPTS:
                    cache.set(lockout_key, time.time() + LOCKOUT_SECONDS, timeout=LOCKOUT_SECONDS)
            raise

        if email:
            cache.delete(attempts_key)
            cache.delete(lockout_key)

        # sacar el refresh del body y ponerlo como cookie httpOnly en su lugar
        refresh_token = response.data.pop("refresh", None)
        if refresh_token:
            _set_refresh_cookie(response, refresh_token)

        return response


class CookieTokenRefreshView(TokenRefreshView):
    """
    POST /api/auth/refresh/ — a diferencia del original de simplejwt, NO
    espera el refresh token en el body del request: lo lee de la cookie
    httpOnly. Como ROTATE_REFRESH_TOKENS está activado, cada refresh exitoso
    invalida el token viejo y pone uno nuevo en la cookie.
    """

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not refresh_token:
            return Response({"detail": "No hay sesión activa."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            response = Response(
                {"detail": "La sesión expiró. Volvé a iniciar sesión."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_refresh_cookie(response)
            return response

        data = serializer.validated_data
        response = Response({"access": data["access"]})

        new_refresh = data.get("refresh")  # presente porque ROTATE_REFRESH_TOKENS=True
        if new_refresh:
            _set_refresh_cookie(response, new_refresh)

        return response


class LogoutView(APIView):
    """
    POST /api/auth/logout/ — invalida el refresh token actual (blacklist) y
    borra la cookie. Se permite sin estar autenticado con JWT porque, en
    este punto, lo único que nos importa es la cookie -- si no hay sesión
    real, simplemente no hay nada que invalidar.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass  # ya estaba vencido o ya en blacklist, no importa

        response = Response({"detail": "Sesión cerrada."})
        _clear_refresh_cookie(response)
        return response


class MeView(APIView):
    """GET /api/auth/me/ — perfil del usuario logueado (según el token)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
