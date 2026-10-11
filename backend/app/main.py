import os
from contextlib import asynccontextmanager
from datetime import date, datetime

import psycopg
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.auth import get_current_user, require_driver, require_rider, router as auth_router
from app.db import close_pool, get_db, get_pool


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_pool().wait()  # open the first connections at startup instead of on the first request
    yield
    close_pool()


app = FastAPI(lifespan=lifespan)

# ride times are stored as campus-local (naive) timestamps, so "now" must be campus-local too
LOCAL_NOW = "(NOW() AT TIME ZONE 'Asia/Kolkata')"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)


class BookingIn(BaseModel):
    ride_id: int
    seats_booked: int = Field(1, gt=0)


class VehicleIn(BaseModel):
    plate_number: str = Field(min_length=3, max_length=15)
    model: str = Field(min_length=1, max_length=50)
    vehicle_type: str = Field(pattern="^(car|bike|auto)$")
    capacity: int = Field(gt=0, le=8)


class RideIn(BaseModel):
    vehicle_id: int
    origin_id: int
    destination_id: int
    departure_time: datetime
    seats_offered: int = Field(gt=0)
    price_per_seat: float = Field(ge=0, le=100000)


class BookingStatusIn(BaseModel):
    status: str = Field(pattern="^(accepted|rejected|cancelled)$")


class PaymentIn(BaseModel):
    method: str = Field(pattern="^(UPI|CASH|CARD)$")


@app.get("/")
def read_root():
    return {"message": "Hello, World!"}


@app.get("/locations")
def list_locations(db=Depends(get_db)):
    return db.execute("SELECT location_id, name FROM locations ORDER BY name").fetchall()


@app.get("/vehicles")
def my_vehicles(db=Depends(get_db), user=Depends(require_driver)):
    return db.execute(
        "SELECT vehicle_id, plate_number, model, vehicle_type, capacity FROM vehicles WHERE driver_id = %s ORDER BY vehicle_id",
        (user["user_id"],),
    ).fetchall()


@app.post("/vehicles", status_code=201)
def add_vehicle(body: VehicleIn, db=Depends(get_db), user=Depends(require_driver)):
    try:
        return db.execute(
            """
            INSERT INTO vehicles (driver_id, plate_number, model, vehicle_type, capacity)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING vehicle_id, plate_number, model, vehicle_type, capacity
            """,
            (user["user_id"], body.plate_number.strip().upper().replace(" ", ""), body.model.strip(),
             body.vehicle_type, body.capacity),
        ).fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "A vehicle with this plate number already exists")


@app.post("/rides", status_code=201)
def post_ride(body: RideIn, db=Depends(get_db), user=Depends(require_driver)):
    vehicle = db.execute(
        "SELECT driver_id, capacity FROM vehicles WHERE vehicle_id = %s", (body.vehicle_id,)
    ).fetchone()
    if not vehicle or vehicle["driver_id"] != user["user_id"]:
        raise HTTPException(404, "Vehicle not found")
    if body.origin_id == body.destination_id:
        raise HTTPException(422, "Origin and destination must be different")
    if body.seats_offered > vehicle["capacity"]:
        raise HTTPException(422, f"This vehicle only has {vehicle['capacity']} passenger seat(s)")
    if body.departure_time.tzinfo is not None:
        raise HTTPException(422, "Send departure_time as local campus time without a timezone")
    if not db.execute(f"SELECT %s > {LOCAL_NOW} AS ok", (body.departure_time,)).fetchone()["ok"]:
        raise HTTPException(422, "Departure time must be in the future")
    try:
        return db.execute(
            """
            INSERT INTO rides (driver_id, vehicle_id, origin_id, destination_id, departure_time, seats_offered, price_per_seat)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *
            """,
            (user["user_id"], body.vehicle_id, body.origin_id, body.destination_id,
             body.departure_time, body.seats_offered, body.price_per_seat),
        ).fetchone()
    except psycopg.errors.ForeignKeyViolation:
        raise HTTPException(422, "Unknown origin or destination")


@app.get("/rides")
def search_rides(
    origin_id: int | None = None,
    destination_id: int | None = None,
    on_date: date | None = None,
    db=Depends(get_db),
    _user=Depends(get_current_user),
):
    """Upcoming rides with seats still available (accepted bookings count as taken)."""
    return db.execute(
        """
        SELECT r.ride_id, r.driver_id, u.name AS driver_name, d.rating,
               v.model, v.vehicle_type,
               o.name AS origin, de.name AS destination,
               r.departure_time, r.price_per_seat,
               r.seats_offered - COALESCE(SUM(b.seats_booked) FILTER (WHERE b.status = 'accepted'), 0)
                   AS seats_available
        FROM rides r
        JOIN drivers d    ON d.driver_id = r.driver_id
        JOIN users u      ON u.user_id = d.driver_id
        JOIN vehicles v   ON v.vehicle_id = r.vehicle_id
        JOIN locations o  ON o.location_id = r.origin_id
        JOIN locations de ON de.location_id = r.destination_id
        LEFT JOIN bookings b ON b.ride_id = r.ride_id
        WHERE r.departure_time > (NOW() AT TIME ZONE 'Asia/Kolkata')
          AND (%(o)s::int IS NULL OR r.origin_id = %(o)s)
          AND (%(d)s::int IS NULL OR r.destination_id = %(d)s)
          AND (%(day)s::date IS NULL OR r.departure_time::date = %(day)s)
        GROUP BY r.ride_id, u.name, d.rating, v.model, v.vehicle_type, o.name, de.name
        HAVING r.seats_offered - COALESCE(SUM(b.seats_booked) FILTER (WHERE b.status = 'accepted'), 0) > 0
        ORDER BY r.departure_time
        """,
        {"o": origin_id, "d": destination_id, "day": on_date},
    ).fetchall()


@app.get("/rides/{ride_id}/bookings")
def ride_bookings(ride_id: int, db=Depends(get_db), user=Depends(require_driver)):
    """Booking requests for a ride (driver's view)."""
    ride = db.execute("SELECT driver_id FROM rides WHERE ride_id = %s", (ride_id,)).fetchone()
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride["driver_id"] != user["user_id"]:
        raise HTTPException(403, "Not your ride")
    return db.execute(
        """
        SELECT b.booking_id, u.name AS rider_name, u.phone, b.seats_booked, b.status, b.requested_at
        FROM bookings b
        JOIN users u ON u.user_id = b.rider_id
        WHERE b.ride_id = %s
        ORDER BY b.requested_at
        """,
        (ride_id,),
    ).fetchall()


@app.post("/bookings", status_code=201)
def create_booking(body: BookingIn, db=Depends(get_db), user=Depends(require_rider)):
    rider_id = user["user_id"]
    ride = db.execute(
        "SELECT seats_offered, driver_id, departure_time > " + LOCAL_NOW + " AS upcoming FROM rides WHERE ride_id = %s FOR UPDATE",
        (body.ride_id,),
    ).fetchone()
    if not ride or not ride["upcoming"]:
        raise HTTPException(404, "Ride not found or already departed")
    if ride["driver_id"] == rider_id:
        raise HTTPException(400, "You cannot book your own ride")
    if body.seats_booked > ride["seats_offered"]:
        raise HTTPException(400, "Requested more seats than the ride offers")
    try:
        return db.execute(
            "INSERT INTO bookings (ride_id, rider_id, seats_booked) VALUES (%s, %s, %s) RETURNING *",
            (body.ride_id, rider_id, body.seats_booked),
        ).fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "You have already requested this ride")


@app.patch("/bookings/{booking_id}")
def update_booking(
    booking_id: int, body: BookingStatusIn, db=Depends(get_db), user=Depends(get_current_user)
):
    # lock the ride row so concurrent accepts can't oversell seats
    row = db.execute(
        """
        SELECT r.ride_id, r.driver_id, r.seats_offered, b.rider_id, b.seats_booked
        FROM bookings b JOIN rides r ON r.ride_id = b.ride_id
        WHERE b.booking_id = %s FOR UPDATE OF r
        """,
        (booking_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Booking not found")
    # the driver decides on requests; the rider can only cancel their own
    if body.status == "cancelled":
        if row["rider_id"] != user["user_id"]:
            raise HTTPException(403, "Only the rider can cancel a booking")
    elif row["driver_id"] != user["user_id"]:
        raise HTTPException(403, "Only the driver can accept or reject requests")
    if body.status == "accepted":
        taken = db.execute(
            "SELECT COALESCE(SUM(seats_booked), 0) AS n FROM bookings WHERE ride_id = %s AND status = 'accepted'",
            (row["ride_id"],),
        ).fetchone()["n"]
        if taken + row["seats_booked"] > row["seats_offered"]:
            raise HTTPException(409, "Not enough seats left on this ride")
    return db.execute(
        "UPDATE bookings SET status = %s WHERE booking_id = %s RETURNING *",
        (body.status, booking_id),
    ).fetchone()


@app.get("/riders/{rider_id}/bookings")
def rider_bookings(rider_id: int, db=Depends(get_db), user=Depends(require_rider)):
    if rider_id != user["user_id"]:
        raise HTTPException(403, "You can only view your own bookings")
    return db.execute(
        """
        SELECT b.booking_id, b.status, b.seats_booked,
               o.name AS origin, de.name AS destination, r.departure_time,
               r.price_per_seat * b.seats_booked AS total_price,
               p.status AS payment_status
        FROM bookings b
        JOIN rides r      ON r.ride_id = b.ride_id
        JOIN locations o  ON o.location_id = r.origin_id
        JOIN locations de ON de.location_id = r.destination_id
        LEFT JOIN payments p ON p.booking_id = b.booking_id
        WHERE b.rider_id = %s
        ORDER BY r.departure_time DESC
        """,
        (rider_id,),
    ).fetchall()


@app.get("/drivers/{driver_id}/rides")
def driver_rides(driver_id: int, db=Depends(get_db), user=Depends(require_driver)):
    if driver_id != user["user_id"]:
        raise HTTPException(403, "You can only view your own rides")
    return db.execute(
        """
        SELECT r.ride_id, o.name AS origin, de.name AS destination, r.departure_time,
               r.seats_offered, r.price_per_seat,
               COUNT(b.booking_id) FILTER (WHERE b.status = 'pending')  AS pending_requests,
               COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0) AS earnings
        FROM rides r
        JOIN locations o  ON o.location_id = r.origin_id
        JOIN locations de ON de.location_id = r.destination_id
        LEFT JOIN bookings b ON b.ride_id = r.ride_id
        LEFT JOIN payments p ON p.booking_id = b.booking_id
        WHERE r.driver_id = %s
        GROUP BY r.ride_id, o.name, de.name
        ORDER BY r.departure_time
        """,
        (driver_id,),
    ).fetchall()


@app.post("/bookings/{booking_id}/payment", status_code=201)
def pay_for_booking(booking_id: int, body: PaymentIn, db=Depends(get_db), user=Depends(require_rider)):
    booking = db.execute(
        """
        SELECT r.price_per_seat * b.seats_booked AS amount, b.status, b.rider_id
        FROM bookings b JOIN rides r ON r.ride_id = b.ride_id
        WHERE b.booking_id = %s
        """,
        (booking_id,),
    ).fetchone()
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking["rider_id"] != user["user_id"]:
        raise HTTPException(403, "Not your booking")
    if booking["status"] != "accepted":
        raise HTTPException(400, "Only accepted bookings can be paid")
    paid = body.method != "CASH"  # cash is settled in person
    try:
        return db.execute(
            """
            INSERT INTO payments (booking_id, amount, method, status, paid_at)
            VALUES (%s, %s, %s, %s, CASE WHEN %s THEN NOW() END) RETURNING *
            """,
            (booking_id, booking["amount"], body.method, "paid" if paid else "pending", paid),
        ).fetchone()
    except Exception:
        db.rollback()
        raise HTTPException(409, "Payment already exists for this booking")
