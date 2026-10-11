

CREATE TABLE users (
  user_id       SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL CHECK (email LIKE '%@vitstudent.ac.in'),
  password_hash TEXT NOT NULL,
  phone         VARCHAR(15)
);

-- A user can be a driver, a rider, or both
CREATE TABLE drivers (
  driver_id      INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  license_number VARCHAR(20) UNIQUE NOT NULL,
  rating         NUMERIC(2,1) DEFAULT 5.0 CHECK (rating BETWEEN 0 AND 5)
);

CREATE TABLE riders (
  rider_id          INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  reg_number        VARCHAR(15) UNIQUE NOT NULL,
  emergency_contact VARCHAR(15) NOT NULL
);

CREATE TABLE vehicles (
  vehicle_id   SERIAL PRIMARY KEY,
  driver_id    INT NOT NULL REFERENCES drivers(driver_id) ON DELETE CASCADE,
  plate_number VARCHAR(15) UNIQUE NOT NULL,
  model        VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(10) NOT NULL CHECK (vehicle_type IN ('car','bike','auto')),
  capacity     INT NOT NULL CHECK (capacity > 0),   -- passenger seats
  UNIQUE (vehicle_id, driver_id)                    -- needed for the composite FK below
);

CREATE TABLE locations (
  location_id SERIAL PRIMARY KEY,
  name        VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE rides (
  ride_id        SERIAL PRIMARY KEY,
  driver_id      INT NOT NULL,
  vehicle_id     INT NOT NULL,
  origin_id      INT NOT NULL REFERENCES locations(location_id),
  destination_id INT NOT NULL REFERENCES locations(location_id),
  departure_time TIMESTAMP NOT NULL,
  seats_offered  INT NOT NULL CHECK (seats_offered > 0),
  price_per_seat NUMERIC(8,2) NOT NULL CHECK (price_per_seat >= 0),
  CHECK (origin_id <> destination_id),
  -- guarantees the vehicle actually belongs to the driver posting the ride
  FOREIGN KEY (vehicle_id, driver_id) REFERENCES vehicles(vehicle_id, driver_id)
);

CREATE TABLE bookings (
  booking_id   SERIAL PRIMARY KEY,
  ride_id      INT NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
  rider_id     INT NOT NULL REFERENCES riders(rider_id) ON DELETE CASCADE,
  seats_booked INT NOT NULL DEFAULT 1 CHECK (seats_booked > 0),
  status       VARCHAR(10) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','rejected','cancelled')),
  requested_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (ride_id, rider_id)
  --we can add a check constraint to ensure that the total seats booked for a ride does not exceed the seats offered, but this would require a trigger or a more complex constraint that checks against the rides table.
);

CREATE TABLE payments (
  payment_id SERIAL PRIMARY KEY,
  booking_id INT UNIQUE NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  amount     NUMERIC(8,2) NOT NULL CHECK (amount >= 0),
  method     VARCHAR(10) NOT NULL CHECK (method IN ('UPI','CASH','CARD')),
  status     VARCHAR(10) NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','paid','refunded')),
  paid_at    TIMESTAMP
);

--add data
INSERT INTO users (name, email, password_hash, phone) VALUES
('Arjun Kumar',  'arjun@vitstudent.ac.in',   'placeholder_hash', '9876500001'),
('Priya Sharma', 'priya@vitstudent.ac.in',   'placeholder_hash', '9876500002'),
('Rahul Verma',  'rahul@vitstudent.ac.in',   'placeholder_hash', '9876500003'),
('Sneha Iyer',   'sneha@vitstudent.ac.in',   'placeholder_hash', '9876500004'),
('Karthik Raj',  'karthik@vitstudent.ac.in', 'placeholder_hash', '9876500005'),
('Meera Nair',   'meera@vitstudent.ac.in',   'placeholder_hash', '9876500006'),
('Dev Patel',    'dev@vitstudent.ac.in',     'placeholder_hash', '9876500007');

INSERT INTO drivers (driver_id, license_number, rating) VALUES
(1, 'DL-TN-0001', 4.8),
(2, 'DL-TN-0002', 4.5),
(3, 'DL-TN-0003', 4.9),
(4, 'DL-TN-0004', 4.2),
(5, 'DL-TN-0005', 4.7),
(6, 'DL-TN-0006', 4.6);

INSERT INTO riders (rider_id, reg_number, emergency_contact) VALUES
(1, '24BCE1001', '9812300001'),
(2, '24BCE1002', '9812300002'),
(3, '24BCE1003', '9812300003'),
(4, '24BCE1004', '9812300004'),
(5, '24BCE1005', '9812300005'),
(6, '24BCE1006', '9812300006'),
(7, '24BCE1007', '9812300007');

INSERT INTO vehicles (driver_id, plate_number, model, vehicle_type, capacity) VALUES
(1, 'TN01AB1234', 'Maruti Swift',          'car',  3),
(2, 'TN02CD5678', 'Hyundai i20',           'car',  3),
(3, 'TN03EF9012', 'Honda Activa',          'bike', 1),
(4, 'TN04GH3456', 'Honda City',            'car',  3),
(5, 'TN05JK7890', 'Royal Enfield Classic', 'bike', 1),
(6, 'TN06LM2345', 'Tata Nexon',            'car',  3);

INSERT INTO locations (name) VALUES
('Campus Main Gate'), ('Boys Hostel'), ('Girls Hostel'),
('Chennai Airport'), ('Railway Station'), ('City Mall'), ('Bus Terminus');

INSERT INTO rides (driver_id, vehicle_id, origin_id, destination_id, departure_time, seats_offered, price_per_seat) VALUES
(1, 1, 1, 4, NOW() + INTERVAL '1 day 6 hours', 3, 350.00),
(2, 2, 1, 5, NOW() + INTERVAL '1 day 9 hours', 2, 120.00),
(3, 3, 2, 6, NOW() + INTERVAL '2 days 4 hours', 1,  60.00),
(4, 4, 3, 4, NOW() + INTERVAL '2 days 8 hours', 1, 400.00),
(5, 5, 1, 7, NOW() + INTERVAL '3 days 2 hours', 1,  80.00),
(1, 1, 5, 1, NOW() + INTERVAL '3 days 7 hours', 2, 120.00),
(6, 6, 6, 2, NOW() + INTERVAL '4 days 3 hours', 3,  60.00),
(2, 2, 4, 1, NOW() + INTERVAL '5 days 5 hours', 2, 350.00);

INSERT INTO bookings (ride_id, rider_id, seats_booked, status) VALUES
(1, 2, 1, 'accepted'),
(1, 3, 1, 'accepted'),
(1, 4, 1, 'pending'),
(2, 1, 1, 'accepted'),
(2, 5, 1, 'pending'),
(3, 6, 1, 'rejected'),
(4, 2, 1, 'accepted'),   -- ride 4 is now full
(5, 1, 1, 'pending'),
(6, 3, 1, 'accepted'),
(8, 4, 1, 'cancelled');

INSERT INTO payments (booking_id, amount, method, status, paid_at) VALUES
(1,  350.00, 'UPI',  'paid',     NOW()),
(2,  350.00, 'CASH', 'pending',  NULL),
(4,  120.00, 'UPI',  'paid',     NOW()),
(7,  400.00, 'CARD', 'paid',     NOW()),
(9,  120.00, 'UPI',  'paid',     NOW()),
(10, 350.00, 'UPI',  'refunded', NOW());