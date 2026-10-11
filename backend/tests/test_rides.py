import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.db import get_conn
from app.main import app
from tests.test_auth import PREFIX, payload


@pytest.fixture(scope="module")
def client():
    yield TestClient(app)
    with get_conn() as conn:  # rides/vehicles/bookings cascade from the users
        conn.execute("DELETE FROM rides WHERE driver_id IN (SELECT user_id FROM users WHERE email LIKE %s)", (PREFIX + "%",))
        conn.execute("DELETE FROM users WHERE email LIKE %s", (PREFIX + "%",))


def signup(client, **over):
    r = client.post("/auth/register", json=payload(**over))
    assert r.status_code == 201, r.text
    return {"Authorization": "Bearer " + r.json()["access_token"]}


def future(hours=30):
    return (datetime.now() + timedelta(hours=hours)).replace(microsecond=0).isoformat()


def vehicle_body():
    return {"plate_number": "T" + uuid.uuid4().hex[:8], "model": "Test Car", "vehicle_type": "car", "capacity": 3}


def test_driver_posts_ride_and_rider_finds_and_books_it(client):
    driver = signup(client, roles=["driver"], emergency_contact=None)
    rider = signup(client, roles=["rider"], license_no=None)

    v = client.post("/vehicles", json=vehicle_body(), headers=driver)
    assert v.status_code == 201, v.text
    assert client.get("/vehicles", headers=driver).json()[0]["vehicle_id"] == v.json()["vehicle_id"]

    ride = {"vehicle_id": v.json()["vehicle_id"], "origin_id": 1, "destination_id": 4,
            "departure_time": future(), "seats_offered": 2, "price_per_seat": 99.5}
    r = client.post("/rides", json=ride, headers=driver)
    assert r.status_code == 201, r.text
    ride_id = r.json()["ride_id"]

    found = client.get("/rides", params={"origin_id": 1, "destination_id": 4}, headers=rider).json()
    mine = [x for x in found if x["ride_id"] == ride_id]
    assert mine and mine[0]["seats_available"] == 2 and mine[0]["price_per_seat"] == 99.5
    day = ride["departure_time"][:10]
    assert any(x["ride_id"] == ride_id for x in client.get("/rides", params={"on_date": day}, headers=rider).json())
    assert not client.get("/rides", params={"destination_id": 7}, headers=rider).json() or \
        all(x["ride_id"] != ride_id for x in client.get("/rides", params={"destination_id": 7}, headers=rider).json())

    b = client.post("/bookings", json={"ride_id": ride_id, "seats_booked": 1}, headers=rider)
    assert b.status_code == 201, b.text
    assert client.post("/bookings", json={"ride_id": ride_id}, headers=rider).status_code == 409


def test_ride_validation(client):
    driver = signup(client, roles=["driver"], emergency_contact=None)
    vid = client.post("/vehicles", json=vehicle_body(), headers=driver).json()["vehicle_id"]
    base = {"vehicle_id": vid, "origin_id": 1, "destination_id": 4,
            "departure_time": future(), "seats_offered": 2, "price_per_seat": 50}
    post = lambda **o: client.post("/rides", json={**base, **o}, headers=driver).status_code
    assert post(departure_time=future(-5)) == 422        # in the past
    assert post(seats_offered=4) == 422                   # more than capacity
    assert post(destination_id=1) == 422                  # same origin/destination
    assert post(price_per_seat=-1) == 422
    assert post(vehicle_id=999999) == 404


def test_cannot_use_someone_elses_vehicle_and_riders_cannot_post(client):
    owner = signup(client, roles=["driver"], emergency_contact=None)
    other = signup(client, roles=["driver"], emergency_contact=None)
    rider = signup(client, roles=["rider"], license_no=None)
    vid = client.post("/vehicles", json=vehicle_body(), headers=owner).json()["vehicle_id"]
    ride = {"vehicle_id": vid, "origin_id": 1, "destination_id": 4,
            "departure_time": future(), "seats_offered": 1, "price_per_seat": 10}
    assert client.post("/rides", json=ride, headers=other).status_code == 404
    assert client.post("/rides", json=ride, headers=rider).status_code == 403
    assert client.post("/vehicles", json=vehicle_body(), headers=rider).status_code == 403
    assert client.post("/rides", json=ride).status_code == 401
