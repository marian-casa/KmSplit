from rest_framework import permissions

from .models import GroupMembership


def get_membership(user, group):
    """Devuelve la membresía activa del usuario en ese grupo, o None."""
    return GroupMembership.objects.filter(group=group, user=user, is_active=True).first()


class CanEditTrip(permissions.BasePermission):
    """
    Un member solo puede editar sus propios viajes.
    Un admin/owner puede editar los viajes de cualquier integrante del grupo.
    (No se permite borrar viajes, solo editarlos — decisión de trazabilidad.)
    """

    def has_object_permission(self, request, view, obj):
        membership = get_membership(request.user, obj.vehicle.group)
        if membership is None:
            return False
        if membership.role in ("owner", "admin"):
            return True
        return obj.user_id == request.user.id
