import pytest
from django.contrib.auth import get_user_model

from core.models import Group, GroupMembership, Vehicle

User = get_user_model()


@pytest.fixture
def make_user(db):
    def _make(name, email, password="testpass123"):
        return User.objects.create_user(email=email, name=name, password=password)

    return _make


@pytest.fixture
def family(make_user):
    """
    Grupo con 3 integrantes con los 3 roles posibles — el mismo escenario
    real del proyecto (Mariano=owner, Cami=admin, Meli=member).
    """
    owner = make_user("Mariano", "mariano@test.com")
    admin = make_user("Cami", "cami@test.com")
    member = make_user("Meli", "meli@test.com")

    group = Group.objects.create(name="Familia Test", created_by=owner)
    GroupMembership.objects.create(group=group, user=owner, role="owner")
    GroupMembership.objects.create(group=group, user=admin, role="admin")
    GroupMembership.objects.create(group=group, user=member, role="member")

    return {"group": group, "owner": owner, "admin": admin, "member": member}


@pytest.fixture
def vehicle(family):
    return Vehicle.objects.create(
        group=family["group"], name="Fiesta Test", current_km=1000,
    )
