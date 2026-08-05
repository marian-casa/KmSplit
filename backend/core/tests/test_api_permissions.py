from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from core.models import Trip

pytestmark = pytest.mark.django_db


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class TestVehiclePermissions:
    def test_member_cannot_create_vehicle(self, family):
        client = auth_client(family["member"])
        response = client.post("/api/vehicles/", {
            "group": family["group"].id, "name": "Auto no autorizado",
        })
        assert response.status_code == 403

    def test_admin_can_create_vehicle(self, family):
        client = auth_client(family["admin"])
        response = client.post("/api/vehicles/", {
            "group": family["group"].id, "name": "Auto de la oficina", "current_km": 500,
        })
        assert response.status_code == 201


class TestTripPermissions:
    def test_member_cannot_edit_others_trip(self, family, vehicle):
        trip = Trip.objects.create(
            vehicle=vehicle, user=family["owner"], trip_date="2026-07-01",
            start_km=1000, end_km=1010,
        )
        client = auth_client(family["member"])
        response = client.patch(f"/api/trips/{trip.id}/", {"end_km": 1020})
        assert response.status_code == 403

    def test_admin_can_edit_others_trip(self, family, vehicle):
        trip = Trip.objects.create(
            vehicle=vehicle, user=family["owner"], trip_date="2026-07-01",
            start_km=1000, end_km=1010,
        )
        client = auth_client(family["admin"])
        response = client.patch(f"/api/trips/{trip.id}/", {"end_km": 1020})
        assert response.status_code == 200

    def test_member_can_edit_own_trip(self, family, vehicle):
        trip = Trip.objects.create(
            vehicle=vehicle, user=family["member"], trip_date="2026-07-01",
            start_km=1000, end_km=1010,
        )
        client = auth_client(family["member"])
        response = client.patch(f"/api/trips/{trip.id}/", {"end_km": 1020})
        assert response.status_code == 200

    def test_overlapping_trip_is_rejected(self, family, vehicle):
        Trip.objects.create(
            vehicle=vehicle, user=family["owner"], trip_date="2026-07-01",
            start_km=1000, end_km=1050,
        )
        client = auth_client(family["admin"])
        response = client.post("/api/trips/", {
            "vehicle": vehicle.id, "trip_date": "2026-07-01",
            "start_km": 1030, "end_km": 1070,
        })
        assert response.status_code == 400
        assert "superponen" in str(response.data)

    def test_end_km_must_be_greater_than_start_km(self, family, vehicle):
        client = auth_client(family["owner"])
        response = client.post("/api/trips/", {
            "vehicle": vehicle.id, "trip_date": "2026-07-01",
            "start_km": 1050, "end_km": 1000,
        })
        assert response.status_code == 400


class TestGroupRoles:
    def test_only_owner_can_change_roles(self, family):
        client = auth_client(family["admin"])
        response = client.patch(
            f"/api/groups/{family['group'].id}/members/{family['member'].id}/",
            {"role": "admin"},
        )
        assert response.status_code == 403

    def test_owner_can_promote_member(self, family):
        client = auth_client(family["owner"])
        response = client.patch(
            f"/api/groups/{family['group'].id}/members/{family['member'].id}/",
            {"role": "admin"},
        )
        assert response.status_code == 200
        assert response.data["role"] == "admin"

    def test_member_cannot_self_promote(self, family):
        client = auth_client(family["member"])
        response = client.patch(
            f"/api/groups/{family['group'].id}/members/{family['member'].id}/",
            {"role": "admin"},
        )
        assert response.status_code == 403


class TestFuelLoadTriggersSettlement:
    def test_creating_fuel_load_via_api_creates_settlement(self, family, vehicle):
        Trip.objects.create(
            vehicle=vehicle, user=family["owner"], trip_date="2026-07-01",
            start_km=1000, end_km=1050,
        )
        client = auth_client(family["owner"])
        response = client.post("/api/fuel-loads/", {
            "vehicle": vehicle.id, "load_date": "2026-07-02",
            "odometer_km": 1100, "amount": "5000.00",
        })
        assert response.status_code == 201

        settlements = client.get(f"/api/settlements/?vehicle={vehicle.id}")
        assert settlements.status_code == 200
        assert len(settlements.data) == 1
        assert settlements.data[0]["unassigned_km"] == 50

    def test_fuel_load_cannot_be_edited(self, family, vehicle):
        client = auth_client(family["owner"])
        create_response = client.post("/api/fuel-loads/", {
            "vehicle": vehicle.id, "load_date": "2026-07-02",
            "odometer_km": 1100, "amount": "5000.00",
        })
        fuel_load_id = create_response.data["id"]

        response = client.patch(f"/api/fuel-loads/{fuel_load_id}/", {"amount": "6000.00"})
        assert response.status_code == 405
