import json
import logging
import socket
import urllib.error
import urllib.request

from django.conf import settings
from django.core.mail.backends.smtp import EmailBackend as BaseSMTPEmailBackend

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


class SmtpEmailBackend(BaseSMTPEmailBackend):
    """Backend SMTP que fuerza conexiones IPv4.

    En entornos como Railway, `smtp.gmail.com` resuelve también a IPv6 (AAAA)
    pero la red del contenedor no rutea IPv6: `sock.connect()` falla con
    [Errno 101] Network is unreachable. Al forzar AF_INET usamos la ruta IPv4,
    que sí existe.
    """

    def open(self):
        original_getaddrinfo = socket.getaddrinfo

        def ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
            return original_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)

        socket.getaddrinfo = ipv4_getaddrinfo
        try:
            return super().open()
        finally:
            socket.getaddrinfo = original_getaddrinfo


def send_brevo_email(*, subject, body, to_email, from_email, from_name):
    """Envía un mail usando la API REST de Brevo (HTTPS/443).

    Es el camino recomendado para producción: el SMTP saliente suele estar
    bloqueado en redes de los proveedores (Railway), mientras que HTTPS hacia
    api.brevo.com sale sin problemas.
    """
    api_key = getattr(settings, "BREVO_API_KEY", "")
    if not api_key:
        raise RuntimeError("BREVO_API_KEY no está configurada")

    payload = json.dumps(
        {
            "sender": {"email": from_email, "name": from_name},
            "to": [{"email": to_email}],
            "subject": subject,
            "textContent": body,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        BREVO_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "accept": "application/json",
            "api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.error("Brevo API respondió %s: %s", exc.code, detail)
        raise