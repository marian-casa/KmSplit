"""
Lógica de negocio para la liquidación de gastos (settlements).

Dos puntos de entrada:
- create_settlement_for_fuel_load(fuel_load): se llama al registrar una carga nueva.
- assign_and_recalculate_trip(trip): se llama al crear o editar un viaje, por si
  cae dentro del rango de un settlement ya existente y hay que recalcularlo.
"""

from decimal import ROUND_HALF_UP, Decimal

from .models import FuelLoad, GroupMembership, Settlement, SettlementDetail, Trip


def _quantize(value):
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def find_settlement_for_trip(trip):
    """
    Devuelve el Settlement existente cuyo rango de km contiene por completo a
    este viaje, o None si el viaje todavía cae en el período abierto (sin
    liquidar) o no encaja en ningún período conocido.
    """
    return Settlement.objects.filter(
        vehicle=trip.vehicle,
        period_start_km__lte=trip.start_km,
        period_end_km__gte=trip.end_km,
    ).first()


def recalculate_settlement(settlement):
    """
    Recalcula desde cero el reparto de un settlement: vuelve a sumar los km de
    cada integrante, recalcula km_sin_asignar, y regenera los SettlementDetail.
    Se usa tanto al crear un settlement nuevo como al editar/agregar un viaje
    que cae dentro de un período ya liquidado.
    """
    vehicle = settlement.vehicle
    period_start = settlement.period_start_km
    period_end = settlement.period_end_km
    period_total_km = period_end - period_start

    # 1. "Adoptar" viajes sueltos (todavía sin settlement) que caen en este rango
    #    -- cubre el caso de un viaje cargado tarde, después de que ya se liquidó
    #    el período al que pertenece.
    Trip.objects.filter(
        vehicle=vehicle,
        settlement__isnull=True,
        start_km__gte=period_start,
        end_km__lte=period_end,
    ).update(settlement=settlement)

    trips = list(Trip.objects.filter(vehicle=vehicle, settlement=settlement))

    trips_by_user = {}
    for trip in trips:
        trips_by_user.setdefault(trip.user_id, []).append(trip)

    registered_km_total = sum(t.km_traveled for t in trips)
    # clamp a 0: si hay viajes superpuestos que suman más que el período real,
    # no dejamos que unassigned_km quede negativo. La prevención de solapamiento
    # se hace en TripSerializer.validate; esto es solo una red de seguridad.
    unassigned_km = max(period_total_km - registered_km_total, 0)

    settlement.unassigned_km = unassigned_km
    settlement.save(update_fields=["unassigned_km"])

    active_memberships = list(
        GroupMembership.objects.filter(group=vehicle.group, is_active=True)
    )

    if vehicle.split_unassigned_km_all_members:
        split_user_ids = {m.user_id for m in active_memberships}
    else:
        # solo entre quienes efectivamente manejaron en este período
        split_user_ids = set(trips_by_user.keys())

    share_count = len(split_user_ids) or 1  # evita división por cero
    unassigned_share = Decimal(unassigned_km) / Decimal(share_count)

    settlement.details.all().delete()

    details = []
    for membership in active_memberships:
        user_trips = trips_by_user.get(membership.user_id, [])
        registered_km = sum(t.km_traveled for t in user_trips)
        share = unassigned_share if membership.user_id in split_user_ids else Decimal("0")
        km_driven = Decimal(registered_km) + share

        if period_total_km > 0:
            percentage = (km_driven / Decimal(period_total_km)) * Decimal("100")
        else:
            percentage = Decimal("0")

        amount_owed = (percentage / Decimal("100")) * settlement.total_amount

        details.append(
            SettlementDetail(
                settlement=settlement,
                user_id=membership.user_id,
                registered_km=registered_km,
                unassigned_km_share=_quantize(share),
                km_driven=_quantize(km_driven),
                percentage=_quantize(percentage),
                amount_owed=_quantize(amount_owed),
            )
        )

    SettlementDetail.objects.bulk_create(details)
    return settlement


def create_settlement_for_fuel_load(fuel_load: FuelLoad) -> Settlement:
    """
    Se dispara al registrar una carga de combustible nueva. Cierra el período
    desde el último checkpoint conocido (vehicle.current_km) hasta el km de
    esta carga, y arma la liquidación completa.
    """
    vehicle = fuel_load.vehicle
    period_start_km = vehicle.current_km
    period_end_km = fuel_load.odometer_km

    settlement = Settlement.objects.create(
        vehicle=vehicle,
        fuel_load=fuel_load,
        period_start_km=period_start_km,
        period_end_km=period_end_km,
        total_amount=fuel_load.amount,
        unassigned_km=0,  # se recalcula abajo, placeholder inicial
    )

    # el checkpoint del vehículo avanza al km de esta carga, listo para el
    # próximo período
    vehicle.current_km = period_end_km
    vehicle.save(update_fields=["current_km"])

    recalculate_settlement(settlement)
    return settlement


def assign_and_recalculate_trip(trip: Trip) -> Trip:
    """
    Se llama después de crear o editar un Trip. Si el viaje encaja dentro de
    un settlement ya existente, lo asigna y dispara el recálculo de ese
    settlement (y del anterior, si el viaje se "mudó" de período al editarlo).
    """
    old_settlement = trip.settlement
    new_settlement = find_settlement_for_trip(trip)

    if old_settlement != new_settlement:
        trip.settlement = new_settlement
        trip.save(update_fields=["settlement"])

        if old_settlement:
            recalculate_settlement(old_settlement)

    if new_settlement:
        recalculate_settlement(new_settlement)

    return trip
