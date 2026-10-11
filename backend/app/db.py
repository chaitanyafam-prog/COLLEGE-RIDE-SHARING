import os

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row
from fastapi import Request
from psycopg_pool import ConnectionPool

load_dotenv()

# Supabase Postgres connection string (Dashboard > Connect > Connection string)
DATABASE_URL = os.environ.get("DATABASE_URL")

_pool: ConnectionPool | None = None


def _require_url() -> str:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set; copy .env.example to .env and fill it in")
    return DATABASE_URL


def get_conn() -> psycopg.Connection:
    """Standalone connection for scripts (setup_db, test cleanup). The API uses the pool."""
    return psycopg.connect(_require_url(), row_factory=dict_row)


def get_pool() -> ConnectionPool:
    """Created lazily so it also works when the app is used without lifespan (e.g. TestClient)."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            _require_url(),
            min_size=2,
            max_size=10,
            open=False,
            max_idle=120,
            # No per-checkout health check (it costs a full round trip to a remote DB). TCP keepalives
            # keep idle connections alive and let the OS notice a dead one instead.
            kwargs={
                "row_factory": dict_row,
                "keepalives": 1,
                "keepalives_idle": 30,
                "keepalives_interval": 10,
                "keepalives_count": 3,
            },
        )
        _pool.open()
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def _borrow(read_only: bool):
    with get_pool().connection() as conn:
        if read_only:
            conn.autocommit = True  # no BEGIN/COMMIT: each is a full round trip to the remote DB
        try:
            yield conn
        finally:
            if read_only:
                conn.autocommit = False


def get_db(request: Request):
    """FastAPI dependency: borrows a pooled connection for the request.

    Writes run in one transaction: committed on success, rolled back if the request raises.
    GET requests only read, so they use autocommit.
    """
    yield from _borrow(read_only=request.method == "GET")


def get_db_read():
    """Like get_db but always autocommit, for POST endpoints that never write (e.g. login)."""
    yield from _borrow(read_only=True)
