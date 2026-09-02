import socket

from django.core.mail.backends.smtp import EmailBackend as BaseSMTPEmailBackend


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