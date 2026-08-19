import time

from django.core.cache import cache
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .serializers import RegisterSerializer, UserSerializer

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 15* 60  # 15 minutos


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/ — alta de usuario. No requiere estar logueado."""

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"


class LockedLoginView(TokenObtainPairView):
    """
    POST /api/auth/login/ — igual al login normal de simplejwt, pero además
    bloquea una CUENTA puntual (por email) después de demasiados intentos
    fallidos seguidos, sin importar desde qué IP vengan.

    El 429 incluye "retry_after_seconds" para que el frontend le pueda
    mostrar al usuario cuánto falta, en vez de un bloqueo silencioso.

    Nota de diseño: este mecanismo se puede usar para molestar a otra
    persona (fallar a propósito su login 5 veces la bloquea a ELLA, no a
    vos) -- es un trade-off conocido de cualquier lockout por cuenta.
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
                # el timestamp ya venció -- limpiamos y dejamos pasar
                cache.delete(lockout_key)
                cache.delete(attempts_key)

        try:
            response = super().post(request, *args, **kwargs)
        except Exception:
            if email:
                attempts = cache.get(attempts_key, 0) + 1
                cache.set(attempts_key, attempts, timeout=LOCKOUT_SECONDS)
                if attempts >= MAX_LOGIN_ATTEMPTS:
                    # timestamp fijo de expiración -- así el "tiempo restante"
                    # se calcula siempre bien sin importar cuándo reintenten
                    cache.set(lockout_key, time.time() + LOCKOUT_SECONDS, timeout=LOCKOUT_SECONDS)
            raise

        if email:
            cache.delete(attempts_key)
            cache.delete(lockout_key)

        return response


class MeView(APIView):
    """GET /api/auth/me/ — perfil del usuario logueado (según el token)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
