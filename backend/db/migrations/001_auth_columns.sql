-- Auth support: date of birth and college ID on users.
-- Nullable so the seeded demo users still load; the API requires both at registration.
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob    DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS clg_id VARCHAR(15);
CREATE UNIQUE INDEX IF NOT EXISTS users_clg_id_key ON users (clg_id);
