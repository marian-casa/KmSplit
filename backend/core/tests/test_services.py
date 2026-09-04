from decimal import Decimal

import pytest

from core import services
from core.models import FuelLoad, GroupMembership, Trip

pytestmark = pytest.mark.django_db


def _create_trip(vehicle, user, date, start_km, end_km):
    trip = Trip.objects.create(
        vehicle=vehicle, user=user, trip_date=date, start_km=start_km, end_km=end_km,
    )
    services.assign_and_recalculate_trip(trip)
    return trip


def _create_fuel_load_and_settle(vehicle, user, date, odometer_km, amount):
    fuel_load = FuelLoad.objects.create(
        vehicle=vehicle, loaded_by=user, load_date=date,
        odometer_km=odometer_km, amount=amount,
    )
    return services.create_settlement_for_fuel_load(fuel_load)


class TestSettlementMath:
    def test_no_unassigned_km_when_trips_cover_full_period(self, family, vehicle):
        owner, admin, member = family["owner"], family["admin"], family["member"]

        _create_trip(vehicle, owner, "2026-07-01", 1000, 1040)   # 40 km
        _create_trip(vehicle, admin, "2026-07-02", 1040, 1090)   # 50 km
        _create_trip(vehicle, member, "2026-07-03", 1090, 1100)  # 10 km

        settlement = _create_fuel_load_and_settle(
            vehicle, owner, "2026-07-04", odometer_km=1100, amount=Decimal("10000.00")
        )

        assert settlement.unassigned_km == 0
        details = {d.user_id: d for d in settlement.details.all()}

        assert details[owner.id].registered_km == 40
        assert details[admin.id].registered_km == 50
        assert details[member.id].registered_km == 10

        # la plata repartida tiene que sumar exacto el total de la carga
        total_paid = sum(d.amount_owed for d in settlement.details.all())
        assert total_paid == Decimal("10000.00")

    def test_unassigned_km_split_equally_among_all_active_members(self, family, vehicle):
        owner, admin, member = family["owner"], family["admin"], family["member"]
        assert vehicle.split_unassigned_km_all_members is True  # default del modelo

        # solo se registraron 90 de 100 km -> 10 km sin asignar
        _create_trip(vehicle, owner, "2026-07-01", 1000, 1090)

        settlement = _create_fuel_load_and_settle(
            vehicle, owner, "2026-07-02", odometer_km=1100, amount=Decimal("3000.00")
        )

        assert settlement.unassigned_km == 10
        details = {d.user_id: d for d in settlement.details.all()}

        # los 10 km sin asignar se reparten entre los 3, aunque 2 no manejaron nada
        for user in (owner, admin, member):
            assert details[user.id].unassigned_km_share == Decimal("3.33")

        assert details[member.id].registered_km == 0
        assert details[member.id].km_driven == Decimal("3.33")  # "derecho de piso"

    def test_unassigned_km_split_only_among_drivers(self, family, vehicle):
        owner, admin, member = family["owner"], family["admin"], family["member"]
        vehicle.split_unassigned_km_all_members = False
        vehicle.save()

        _create_trip(vehicle, owner, "2026-07-01", 1000, 1090)  # solo owner manejó

        settlement = _create_fuel_load_and_settle(
            vehicle, owner, "2026-07-02", odometer_km=1100, amount=Decimal("3000.00")
        )

        details = {d.user_id: d for d in settlement.details.all()}

        assert details[owner.id].unassigned_km_share == Decimal("10.00")
        assert details[admin.id].unassigned_km_share == Decimal("0.00")
        assert details[member.id].unassigned_km_share == Decimal("0.00")
        assert details[admin.id].amount_owed == Decimal("0.00")

    def test_deactivated_member_excluded_from_future_split(self, family, vehicle):
        owner, admin, member = family["owner"], family["admin"], family["member"]

        # Meli maneja el auto ANTES de irse del grupo
        _create_trip(vehicle, member, "2026-07-01", 1000, 1030)  # 30 km

        membership = GroupMembership.objects.get(group=family["group"], user=member)
        membership.is_active = False
        membership.save()

        _create_trip(vehicle, owner, "2026-07-02", 1030, 1080)  # 50 km

        settlement = _create_fuel_load_and_settle(
            vehicle, owner, "2026-07-03", odometer_km=1100, amount=Decimal("8000.00")
        )

        # el km que manejó Meli sigue contando para reducir el km sin asignar...
        assert settlement.unassigned_km == 20  # 100 - 30 - 50

        # ...pero ella ya no aparece en el detalle: no cobra ni paga nada
        user_ids_in_detail = {d.user_id for d in settlement.details.all()}
        assert member.id not in user_ids_in_detail
        assert owner.id in user_ids_in_detail
        assert admin.id in user_ids_in_detail


class TestTripProrationAcrossBoundaries:
    """
    Una carga siempre captura la parte del viaje que cae dentro de SU período,
    aunque el viaje cruce el límite hacia la liquidación siguiente.
    """

    def test_trip_crossing_a_settlement_boundary_is_prorated(self, family, vehicle):
        owner = family["owner"]
        assert vehicle.current_km == 1000

        # viaje registrado 1000 -> 1200 (atraviesa el futuro límite de 1100)
        _create_trip(vehicle, owner, "2026-07-01", 1000, 1200)

        # carga en 1100 -> cierra [1000, 1100] tomando los 100 km del viaje
        first = _create_fuel_load_and_settle(
            vehicle, owner, "2026-07-02", odometer_km=1100, amount=Decimal("1000.00")
        )
        assert first.period_start_km == 1000
        assert first.period_end_km == 1100
        details_first = {d.user_id: d for d in first.details.all()}
        assert details_first[owner.id].registered_km == 100
        assert first.unassigned_km == 0

        # siguiente carga en 1200 -> cierra [1100, 1200] tomando los otros 100 km
        second = _create_fuel_load_and_settle(
            vehicle, owner, "2026-07-03", odometer_km=1200, amount=Decimal("2000.00")
        )
        assert second.period_start_km == 1100
        assert second.period_end_km == 1200
        details_second = {d.user_id: d for d in second.details.all()}
        assert details_second[owner.id].registered_km == 100
        assert second.unassigned_km == 0


class TestLateTripsAndEdits:
    def test_late_trip_gets_picked_up_by_existing_settlement(self, family, vehicle):
        owner, admin, _ = family["owner"], family["admin"], family["member"]

        _create_trip(vehicle, owner, "2026-07-01", 1000, 1050)  # 50 km

        settlement = _create_fuel_load_and_settle(
            vehicle, owner, "2026-07-02", odometer_km=1100, amount=Decimal("5000.00")
        )
        assert settlement.unassigned_km == 50

        # se habían olvidado de cargar un viaje de Cami; lo cargan tarde y
        # cae dentro del rango de km de un settlement que ya existe
        _create_trip(vehicle, admin, "2026-07-01", 1050, 1080)  # 30 km

        settlement.refresh_from_db()
        assert settlement.unassigned_km == 20  # 50 - 30

        details = {d.user_id: d for d in settlement.details.all()}
        assert details[admin.id].registered_km == 30

    def test_editing_a_trip_moves_it_to_the_correct_settlement(self, family, vehicle):
        owner = family["owner"]

        settlement_1 = _create_fuel_load_and_settle(
            vehicle, owner, "2026-07-01", odometer_km=1050, amount=Decimal("1000.00")
        )
        settlement_2 = _create_fuel_load_and_settle(
            vehicle, owner, "2026-07-02", odometer_km=1150, amount=Decimal("2000.00")
        )

        # viaje cargado con el km mal tipeado: cae (por error) en el período 1
        trip = _create_trip(vehicle, owner, "2026-07-01", 1000, 1030)
        assert trip.settlement_id == settlement_1.id

        settlement_1.refresh_from_db()
        assert settlement_1.unassigned_km == 20  # 50 - 30

        # se corrige el km: en realidad el viaje fue en el período 2
        trip.start_km = 1060
        trip.end_km = 1090
        trip.save()
        services.assign_and_recalculate_trip(trip)

        trip.refresh_from_db()
        assert trip.settlement_id == settlement_2.id

        settlement_1.refresh_from_db()
        settlement_2.refresh_from_db()
        assert settlement_1.unassigned_km == 50  # se le devolvieron los 30 km
        assert settlement_2.unassigned_km == 70  # 100 - 30
