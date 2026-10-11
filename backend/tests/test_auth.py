import uuid

import pytest
from fastapi.testclient import TestClient

from app.db import get_conn
from app.main import app

PREFIX = "pytest_"


def payload(**over):
    tag = uuid.uuid4().hex[:8]
    base = {
        "name": "Test User",
        "email": f"{PREFIX}{tag}@vitstudent.ac.in",
        "password": "supersecret1",
        "dob": "2004-05-17",
        "clg_id": f"T{tag}".upper()[:12],
        "roles": ["rider", "driver"],
        "phone": "9876543210",
        "license_no": f"L{tag}".upper(),
        "emergency_contact": "9812345678",
    }
    base.update(over)
    return base


@pytest.fixture(scope="module")
def client():
    yield TestClient(app)
    # tests write to the real database, so remove everything they created
    with get_conn() as conn:
        conn.execute("DELETE FROM users WHERE email LIKE %s", (PREFIX + "%",))


def test_register_success(client):
    body = payload()
    r = client.post("/auth/register", json=body)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["access_token"]
    assert data["user"]["email"] == body["email"]
    assert sorted(data["user"]["roles"]) == ["driver", "rider"]
    assert "password" not in str(data) and "password_hash" not in str(data)


def test_register_rider_only_has_no_driver_role(client):
    r = client.post("/auth/register", json=payload(roles=["rider"], license_no=None))
    assert r.status_code == 201, r.text
    assert r.json()["user"]["roles"] == ["rider"]


def test_register_duplicate_email(client):
    body = payload()
    assert client.post("/auth/register", json=body).status_code == 201
    again = payload(email=body["email"])
    r = client.post("/auth/register", json=again)
    assert r.status_code == 409
    assert "Email" in r.json()["detail"]
    # the failed attempt must not leave a half-created user behind
    with get_conn() as conn:
        n = conn.execute("SELECT COUNT(*) AS n FROM users WHERE clg_id = %s", (again["clg_id"],)).fetchone()["n"]
    assert n == 0


def test_register_wrong_domain(client):
    r = client.post("/auth/register", json=payload(email="someone@gmail.com"))
    assert r.status_code == 422


def test_register_short_password(client):
    assert client.post("/auth/register", json=payload(password="short")).status_code == 422


def test_register_driver_needs_license(client):
    assert client.post("/auth/register", json=payload(license_no=None)).status_code == 422


def test_login_success_and_me(client):
    body = payload()
    client.post("/auth/register", json=body)
    r = client.post("/auth/login", json={"email": body["email"].upper(), "password": body["password"]})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == body["email"]


def test_login_wrong_password_and_unknown_email_look_the_same(client):
    body = payload()
    client.post("/auth/register", json=body)
    bad_pw = client.post("/auth/login", json={"email": body["email"], "password": "wrongpassword"})
    unknown = client.post("/auth/login", json={"email": f"{PREFIX}nobody@vitstudent.ac.in", "password": "whatever123"})
    assert bad_pw.status_code == unknown.status_code == 401
    assert bad_pw.json() == unknown.json()


def test_me_without_token(client):
    assert client.get("/auth/me").status_code == 401


def test_me_with_bad_token(client):
    assert client.get("/auth/me", headers={"Authorization": "Bearer not.a.token"}).status_code == 401


def test_rider_only_cannot_use_driver_endpoint(client):
    r = client.post("/auth/register", json=payload(roles=["rider"], license_no=None))
    token, uid = r.json()["access_token"], r.json()["user"]["user_id"]
    h = {"Authorization": f"Bearer {token}"}
    assert client.get(f"/drivers/{uid}/rides", headers=h).status_code == 403
    assert client.get(f"/riders/{uid}/bookings", headers=h).status_code == 200
    assert client.get("/rides").status_code == 401  # protected
