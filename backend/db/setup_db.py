"""Load schema.sql (tables + seed data) into the Supabase Postgres database.

Run from the backend folder:  python db/setup_db.py [--reset]
--reset drops the app's tables first so the schema is rebuilt from scratch.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.db import get_conn  # noqa: E402

SCHEMA = Path(__file__).with_name("schema.sql")
MIGRATIONS = sorted(Path(__file__).with_name("migrations").glob("*.sql"))
TABLES = ["payments", "bookings", "rides", "locations", "vehicles", "riders", "drivers", "users"]


def main() -> None:
    reset = "--reset" in sys.argv
    with get_conn() as conn:
        exists = conn.execute("SELECT to_regclass('public.users') AS t").fetchone()["t"]
        if reset:
            conn.execute(f"DROP TABLE IF EXISTS {', '.join(TABLES)} CASCADE")
            exists = None
        if exists:
            print("Tables already exist; skipping schema (use --reset to rebuild)")
        else:
            conn.execute(SCHEMA.read_text(encoding="utf-8"))
            print("Schema and seed data loaded")
        for m in MIGRATIONS:  # idempotent, safe to re-run
            conn.execute(m.read_text(encoding="utf-8"))
            print(f"Applied {m.name}")


if __name__ == "__main__":
    main()
