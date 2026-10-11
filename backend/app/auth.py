import os
import re
from datetime import date, datetime, timedelta, timezone

import bcrypt
import jwt
import psycopg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator, model_validator

from app.db import get_db, get_db_read

router = APIRouter(tags=["auth"])
# auto_error=False so a missing token gives 401 (not 403); the scheme still powers Swagger's Authorize button
bearer_scheme = HTTPBearer(auto_error=False)

JWT_ALGORITHM = "HS256"

# Only one college for now; the register form loads this list from GET /colleges.
COLLEGES = [{"college_id": 1, "name": "VIT", "email_domain": "vitstudent.ac.in"}]

_PHONE = re.compile(r"^\d{10,15}$")
_CLG_ID = re.compile(r"^[A-Z0-9]{5,15}$")
# valid bcrypt hash of a random string, used to equalise timing when the email is unknown
_DUMMY_HASH = bcrypt.hashpw(b"timing-equaliser", bcrypt.gensalt())


# ---------- helpers ----------

def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is not set; copy .env.example to .env and fill it in")
    return secret


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, pw_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), pw_hash.encode())
    except ValueError:  # malformed hash, e.g. the seed users' placeholder
        return False


def create_access_token(user_id: int) -> str:
    minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


_PROFILE_SQL = """
    SELECT u.user_id, u.name, u.email, u.phone, u.dob, u.clg_id, u.password_hash,
           (r.rider_id  IS NOT NULL) AS is_rider,
           (d.driver_id IS NOT NULL) AS is_driver,
           d.license_number, d.rating
    FROM users u
    LEFT JOIN riders r  ON r.rider_id  = u.user_id
    LEFT JOIN drivers d ON d.driver_id = u.user_id
"""


def _to_profile(row: dict) -> dict:
    """Public profile from a _PROFILE_SQL row: drops the hash, folds the role flags into `roles`."""
    row = dict(row)
    row.pop("password_hash")
    roles = [role for role, on in (("rider", row.pop("is_rider")), ("driver", row.pop("is_driver"))) if on]
    return {**row, "roles": roles}


def load_profile(db, user_id: int) -> dict | None:
    row = db.execute(_PROFILE_SQL + " WHERE u.user_id = %s", (user_id,)).fetchone()
    return _to_profile(row) if row else None


# ---------- dependencies ----------

def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db=Depends(get_db),
) -> dict:
    unauthorized = HTTPException(
        401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"}
    )
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(creds.credentials, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized
    user = load_profile(db, user_id)
    if user is None:
        raise unauthorized
    return user


def require_driver(user: dict = Depends(get_current_user)) -> dict:
    if "driver" not in user["roles"]:
        raise HTTPException(403, "Driver account required")
    return user


def require_rider(user: dict = Depends(get_current_user)) -> dict:
    if "rider" not in user["roles"]:
        raise HTTPException(403, "Rider account required")
    return user


# ---------- schemas ----------

class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=255)
    password: str = Field(min_length=8)
    dob: date
    clg_id: str
    college_id: int = 1
    roles: list[str] = Field(min_length=1)
    phone: str | None = None
    license_no: str | None = Field(None, max_length=20)  # required for drivers
    emergency_contact: str | None = None                  # required for riders (NOT NULL in schema)

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        v = v.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+", v):
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v):
        if len(v.encode()) > 72:  # bcrypt limit
            raise ValueError("Password must be at most 72 bytes")
        return v

    @field_validator("dob")
    @classmethod
    def _dob(cls, v):
        if v >= date.today():
            raise ValueError("Date of birth must be in the past")
        return v

    @field_validator("clg_id")
    @classmethod
    def _clg_id(cls, v):
        v = v.strip().upper()
        if not _CLG_ID.fullmatch(v):
            raise ValueError("College ID must be 5-15 letters/digits, e.g. 24BCE1001")
        return v

    @field_validator("phone", "emergency_contact")
    @classmethod
    def _digits(cls, v):
        if v is None or v.strip() == "":
            return None
        v = v.strip()
        if not _PHONE.fullmatch(v):
            raise ValueError("Enter 10-15 digits")
        return v

    @field_validator("roles")
    @classmethod
    def _roles(cls, v):
        if not set(v) <= {"rider", "driver"}:
            raise ValueError("Roles must be 'rider' and/or 'driver'")
        return sorted(set(v))

    @field_validator("license_no")
    @classmethod
    def _license(cls, v):
        return v.strip() or None if v else None

    @model_validator(mode="after")
    def _role_fields(self):
        if "driver" in self.roles and not self.license_no:
            raise ValueError("License number is required for drivers")
        if "rider" in self.roles and not self.emergency_contact:
            raise ValueError("Emergency contact is required for riders")
        return self


class LoginIn(BaseModel):
    email: str
    password: str


# ---------- routes ----------

@router.get("/colleges")
def list_colleges():
    return COLLEGES


def _token_response(profile: dict) -> dict:
    return {
        "access_token": create_access_token(profile["user_id"]),
        "token_type": "bearer",
        "user": profile,
    }


@router.post("/auth/register", status_code=201)
def register(body: RegisterIn, db=Depends(get_db)):
    college = next((c for c in COLLEGES if c["college_id"] == body.college_id), None)
    if college is None:
        raise HTTPException(422, "Unknown college")
    if not body.email.endswith("@" + college["email_domain"]):
        raise HTTPException(422, f"Email must end with @{college['email_domain']}")

    try:
        # One statement = one round trip, and one transaction: the user and the rider/driver
        # rows commit together or not at all. The rider/driver CTEs insert only when the role was chosen.
        row = db.execute(
            """
            WITH u AS (
                INSERT INTO users (name, email, password_hash, phone, dob, clg_id)
                VALUES (%(name)s, %(email)s, %(pw)s, %(phone)s, %(dob)s, %(clg)s)
                RETURNING user_id
            ), r AS (
                INSERT INTO riders (rider_id, reg_number, emergency_contact)
                SELECT user_id, %(clg)s, %(emergency)s FROM u WHERE %(is_rider)s
            ), d AS (
                INSERT INTO drivers (driver_id, license_number)
                SELECT user_id, %(license)s FROM u WHERE %(is_driver)s
                RETURNING rating
            )
            SELECT u.user_id, (SELECT rating FROM d) AS rating FROM u
            """,
            {
                "name": body.name, "email": body.email, "pw": hash_password(body.password),
                "phone": body.phone, "dob": body.dob, "clg": body.clg_id,
                "emergency": body.emergency_contact, "license": body.license_no,
                "is_rider": "rider" in body.roles, "is_driver": "driver" in body.roles,
            },
        ).fetchone()
    except psycopg.errors.UniqueViolation as e:
        constraint = e.diag.constraint_name or ""
        if "email" in constraint:
            detail = "Email already registered"
        elif "clg_id" in constraint or "reg_number" in constraint:
            detail = "College ID already registered"
        elif "license" in constraint:
            detail = "License number already registered"
        else:
            detail = "Account already exists"
        raise HTTPException(409, detail)  # get_db rolls the transaction back
    is_driver = "driver" in body.roles
    return _token_response({
        "user_id": row["user_id"], "name": body.name, "email": body.email, "phone": body.phone,
        "dob": body.dob, "clg_id": body.clg_id,
        "license_number": body.license_no if is_driver else None,
        "rating": row["rating"] if is_driver else None,
        "roles": body.roles,
    })


@router.post("/auth/login")
def login(body: LoginIn, db=Depends(get_db_read)):
    row = db.execute(
        _PROFILE_SQL + " WHERE u.email = %s", (body.email.strip().lower(),)
    ).fetchone()
    stored = row["password_hash"] if row else _DUMMY_HASH.decode()
    ok = verify_password(body.password, stored)
    if not row or not ok:
        raise HTTPException(401, "Invalid email or password")
    return _token_response(_to_profile(row))


@router.get("/auth/me")
def me(user: dict = Depends(get_current_user)):
    return user
