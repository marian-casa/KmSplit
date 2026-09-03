from rest_framework import serializers

from .models import FuelLoad, Group, GroupMembership, Settlement, SettlementDetail, Trip, Vehicle


class GroupMembershipSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = GroupMembership
        fields = ["id", "user", "user_name", "user_email", "role", "is_active", "joined_at"]
        read_only_fields = ["id", "joined_at", "is_active"]


class GroupSerializer(serializers.ModelSerializer):
    members = GroupMembershipSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = ["id", "name", "invite_code", "created_by", "created_at", "members"]
        read_only_fields = ["id", "invite_code", "created_by", "created_at"]

    def create(self, validated_data):
        user = self.context["request"].user
        group = Group.objects.create(created_by=user, **validated_data)
        # quien crea el grupo queda como owner automáticamente
        GroupMembership.objects.create(group=group, user=user, role="owner")
        return group


class JoinGroupSerializer(serializers.Serializer):
    invite_code = serializers.CharField()

    def validate_invite_code(self, value):
        try:
            self.group = Group.objects.get(invite_code=value)
        except Group.DoesNotExist:
            raise serializers.ValidationError("Código de invitación inválido")
        return value


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = [
            "id", "group", "name", "fuel_type", "photo_url",
            "current_km", "split_unassigned_km_all_members", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_photo_url(self, value):
        """La foto se guarda como data URI (base64). Vacío = sin foto.
        Acepta data:image/* (subida del usuario) o https:// (URL externa,
        para una integración futura). Todo lo demás se rechaza."""
        if not value:
            # vacío/None = sin foto (placeholder) o limpiar la foto
            return value
        if not isinstance(value, str):
            raise serializers.ValidationError("La foto debe ser un texto.")
        # Límite blando ~4 MB en base64 (~3 MB de imagen). Evita filas gigantes.
        max_len = 4 * 1024 * 1024
        if len(value) > max_len:
            raise serializers.ValidationError(
                "La foto es demasiado grande. Probá con una imagen más liviana."
            )
        if value.startswith("data:image/") or value.startswith("http://") or value.startswith("https://"):
            return value
        raise serializers.ValidationError(
            "La foto debe ser una imagen base64 (data:image/...) o una URL."
        )


class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = [
            "id", "vehicle", "user", "settlement", "trip_date",
            "start_km", "end_km", "km_traveled", "edited_by",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "user", "km_traveled", "settlement", "edited_by", "created_at", "updated_at"]

    def validate(self, data):
        vehicle = data.get("vehicle", getattr(self.instance, "vehicle", None))
        start_km = data.get("start_km", getattr(self.instance, "start_km", None))
        end_km = data.get("end_km", getattr(self.instance, "end_km", None))

        if start_km is not None and end_km is not None and end_km <= start_km:
            raise serializers.ValidationError("El km final debe ser mayor al km inicial")

        if vehicle and start_km is not None and end_km is not None:
            overlapping = Trip.objects.filter(
                vehicle=vehicle, start_km__lt=end_km, end_km__gt=start_km
            )
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)
            conflict = overlapping.select_related("user").first()
            if conflict:
                raise serializers.ValidationError(
                    f"Los km se superponen con un viaje de {conflict.user.name}"
                    f"({conflict.start_km}-{conflict.end_km} km). Revisá el historial."
                )
        
        return data


class FuelLoadSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelLoad
        fields = ["id", "vehicle", "loaded_by", "load_date", "odometer_km", "amount", "liters", "created_at"]
        read_only_fields = ["id", "loaded_by", "created_at"]


class SettlementDetailSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True)

    class Meta:
        model = SettlementDetail
        fields = [
            "id", "user", "user_name", "registered_km",
            "unassigned_km_share", "km_driven", "percentage", "amount_owed",
        ]


class SettlementSerializer(serializers.ModelSerializer):
    details = SettlementDetailSerializer(many=True, read_only=True)

    class Meta:
        model = Settlement
        fields = [
            "id", "vehicle", "fuel_load", "period_start_km", "period_end_km",
            "total_amount", "unassigned_km", "status", "status_updated_by",
            "created_at", "details",
        ]
        read_only_fields = fields
