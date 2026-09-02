import pytest
from rest_framework.test import APIClient

from core.models import Group, GroupMembership

pytestmark = pytest.mark.django_db


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class TestLeaveGroup:
    def test_member_leaves_group(self, family, vehicle):
        custom = family["member"]
        response = auth_client(custom).post(f"/api/groups/{family['group'].id}/leave/")
        assert response.status_code == 200

        membership = GroupMembership.objects.get(
            group=family["group"], user=custom
        )
        assert membership.is_active is False

        # el grupo ya no aparece en la lista del usuario
        groups = auth_client(custom).get("/api/groups/").json()
        assert len(groups) == 0

    def test_ex_member_cannot_see_group_vehicles(self, family, vehicle):
        custom = family["member"]
        client = auth_client(custom)
        client.post(f"/api/groups/{family['group'].id}/leave/")

        vehicles = client.get("/api/vehicles/").json()
        assert len(vehicles) == 0

    def test_rejoin_after_leaving_reactivates_membership(self, family, vehicle):
        custom = family["member"]
        client = auth_client(custom)
        group_id = family["group"].id
        client.post(f"/api/groups/{group_id}/leave/")

        response = auth_client(custom).post(
            "/api/groups/join/", {"invite_code": family["group"].invite_code}
        )
        assert response.status_code == 200

        membership = GroupMembership.objects.get(group=family["group"], user=custom)
        assert membership.is_active is True
        assert membership.removed_at is None

    def test_owner_leaving_transfers_ownership_to_oldest_member(self, family):
        group = family["group"]
        response = auth_client(family["owner"]).post(f"/api/groups/{group.id}/leave/")
        assert response.status_code == 200

        owner_membership = GroupMembership.objects.get(group=group, user=family["owner"])
        admin_membership = GroupMembership.objects.get(group=group, user=family["admin"])
        assert owner_membership.is_active is False
        # el integrante más antiguo después del owner era admin -> ahora es dueño
        assert admin_membership.is_active is True
        assert admin_membership.role == "owner"

        # el grupo sigue vivo para los que quedaron
        assert Group.objects.filter(pk=group.id).exists()

    def test_sole_owner_leaving_deletes_group(self, make_user):
        owner = make_user("Solo", "solo@test.com")
        group = Group.objects.create(name="Grupo Solitario", created_by=owner)
        GroupMembership.objects.create(group=group, user=owner, role="owner")

        response = auth_client(owner).post(f"/api/groups/{group.id}/leave/")
        assert response.status_code == 200
        assert not Group.objects.filter(pk=group.id).exists()

    def test_non_member_cannot_leave(self, family, make_user):
        outsider = make_user("Afuera", "afuera@test.com")
        response = auth_client(outsider).post(f"/api/groups/{family['group'].id}/leave/")
        # el get_queryset filtra por memberships activas -> 404 para no-miembros
        assert response.status_code == 404