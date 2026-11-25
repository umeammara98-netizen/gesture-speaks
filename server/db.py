"""SQLite accounts for Gesture Speaks."""

import hashlib
import hmac
import os
import secrets
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "gesture.db"
_lock = threading.Lock()


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password, stored):
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    check = hash_password(password, salt)
    return hmac.compare_digest(check, f"{salt_hex}${digest_hex}")


def init():
    with _lock, connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                admin INTEGER NOT NULL DEFAULT 0,
                disabled INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL
            );
            """
        )
    email = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "admin@admin.com").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", "admin123")
    if email and password and not get_user_by_email(email):
        create_user(email, "Admin", password, admin=True)


def now():
    return datetime.now(timezone.utc).isoformat()


def public_user(row):
    return {
        "uid": str(row["id"]),
        "email": row["email"],
        "name": row["name"],
        "admin": bool(row["admin"]),
        "disabled": bool(row["disabled"]),
        "createdAt": row["created_at"],
    }


def get_user_by_email(email):
    with _lock, connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    return row


def get_user(uid):
    with _lock, connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    return row


def create_user(email, name, password, admin=False):
    with _lock, connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO users (email, name, password_hash, admin, disabled, created_at)
            VALUES (?, ?, ?, ?, 0, ?)
            """,
            (email, name, hash_password(password), 1 if admin else 0, now()),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return row


def list_users():
    with _lock, connect() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY email COLLATE NOCASE").fetchall()
    return rows


def update_user(uid, admin=None, disabled=None):
    row = get_user(uid)
    if row is None:
        return None
    next_admin = row["admin"] if admin is None else (1 if admin else 0)
    next_disabled = row["disabled"] if disabled is None else (1 if disabled else 0)
    with _lock, connect() as conn:
        conn.execute(
            "UPDATE users SET admin = ?, disabled = ? WHERE id = ?",
            (next_admin, next_disabled, uid),
        )
        if next_disabled:
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (uid,))
        row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    return row


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    with _lock, connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user_id, now()),
        )
    return token


def user_by_token(token):
    with _lock, connect() as conn:
        row = conn.execute(
            """
            SELECT users.* FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()
    return row


def delete_session(token):
    with _lock, connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
