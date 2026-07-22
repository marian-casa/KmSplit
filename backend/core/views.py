from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import FuelLoad, Group, GroupMembership, Settlement, Trip, Vehicle
from .permissions import CanEditTrip, get_membership
from .serializers import (
    FuelLoadSerializer,
    GroupMembershipSerializer,
    GroupSerializer,
    JoinGroupSerializer,
    SettlementSerializer,
    TripSerializer,
    VehicleSerializer,
)


class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Group.objects.filter(
            members__user=self.request.user, members__is_active=True
        ).distinct()

    @action(detail=False, methods=["post"])
    def join(self, request):
        """POST /api/groups/join/  body: {"invite_code": "A3F91B2C"}"""
        serializer = JoinGroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.group

        membership, created = GroupMembership.objects.get_or_create(
            group=group, user=request.user, defaults={"role": "member"}
        )
        if not created and not membership.is_active:
            # ya había sido miembro y fue dado de baja -> lo reactiva como member
            membership.is_active = True
            membership.removed_at = None
            membership.save()

        return Response(GroupSerializer(group).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], url_path="members/(?P<user_id>[^/.]+)")
    def update_member(self, request, pk=None, user_id=None):
        """
        PATCH /api/groups/{id}/members/{user_id}/
        body: {"role": "admin"}  -> solo owner puede cambiar roles
        body: {"remove": true}   -> owner o admin puede dar de baja a un miembro
        """
        group = self.get_object()
        acting_membership = get_membership(request.user, group)
        if acting_membership is None or acting_membership.role not in ("owner", "admin"):
            return Response(
                {"detail": "No tenés permiso para modificar miembros de este grupo"},
                status=status.HTTP_403_FORBIDDEN,
            )

        target = GroupMembership.objects.filter(group=group, user_id=user_id, is_active=True).first()
        if target is None:
            return Response({"detail": "Miembro no encontrado"}, status=status.HTTP_404_NOT_FOUND)

        new_role = request.data.get("role")
        if new_role:
            if acting_membership.role != "owner":
                return Response(
                    {"detail": "Solo el owner puede cambiar roles"}, status=status.HTTP_403_FORBIDDEN
                )
            if new_role not in ("admin", "member"):
                return Response({"detail": "Rol inválido"}, status=status.HTTP_400_BAD_REQUEST)
            target.role = new_role

        if request.data.get("remove"):
            target.is_active = False
            target.removed_at = timezone.now()

        target.save()
        return Response(GroupMembershipSerializer(target).data)


class VehicleViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Vehicle.objects.filter(
            group__members__user=self.request.user, group__members__is_active=True
        ).distinct()

    def perform_create(self, serializer):
        group = serializer.validated_data["group"]
        membership = get_membership(self.request.user, group)
        if membership is None or membership.role not in ("owner", "admin"):
            raise PermissionDenied("Solo el owner o admin puede crear vehículos")
        serializer.save()


class TripViewSet(viewsets.ModelViewSet):
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]  # sin delete: no se borran viajes

    def get_queryset(self):
        qs = Trip.objects.filter(
            vehicle__group__members__user=self.request.user,
            vehicle__group__members__is_active=True,
        ).distinct()
        vehicle_id = self.request.query_params.get("vehicle")
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        return qs.order_by("-trip_date")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(edited_by=self.request.user)
        # TODO Fase 3: si el viaje cae en el rango km de un settlement existente,
        # asignarle ese settlement_id y disparar el recálculo.

    def get_permissions(self):
        if self.action in ("update", "partial_update"):
            return [permissions.IsAuthenticated(), CanEditTrip()]
        return [permissions.IsAuthenticated()]


class FuelLoadViewSet(viewsets.ModelViewSet):
    serializer_class = FuelLoadSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]  # no se editan ni borran cargas

    def get_queryset(self):
        qs = FuelLoad.objects.filter(
            vehicle__group__members__user=self.request.user,
            vehicle__group__members__is_active=True,
        ).distinct()
        vehicle_id = self.request.query_params.get("vehicle")
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        return qs.order_by("-load_date")

    def perform_create(self, serializer):
        fuel_load = serializer.save(loaded_by=self.request.user)
        # TODO Fase 3: acá se dispara automáticamente el cálculo del Settlement
        # (buscar trips sin settlement en el rango de km, repartir gasto, etc.)
        return fuel_load


class SettlementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SettlementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Settlement.objects.filter(
            vehicle__group__members__user=self.request.user,
            vehicle__group__members__is_active=True,
        ).distinct()
        vehicle_id = self.request.query_params.get("vehicle")
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        return qs.order_by("-created_at")

    @action(detail=True, methods=["patch"])
    def mark_status(self, request, pk=None):
        """PATCH /api/settlements/{id}/mark_status/  body: {"status": "pagado"}"""
        settlement = self.get_object()
        membership = get_membership(request.user, settlement.vehicle.group)
        if membership is None or membership.role not in ("owner", "admin"):
            return Response(
                {"detail": "Solo el owner o admin puede cambiar el estado"},
                status=status.HTTP_403_FORBIDDEN,
            )
        new_status = request.data.get("status")
        if new_status not in ("pendiente", "pagado"):
            return Response({"detail": "Estado inválido"}, status=status.HTTP_400_BAD_REQUEST)
        settlement.status = new_status
        settlement.status_updated_by = request.user
        settlement.save()
        return Response(SettlementSerializer(settlement).data)
