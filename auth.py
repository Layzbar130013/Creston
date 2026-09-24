"""
CRESTON PREMIUM COLLECTIONS - Authentication and Session Management
Handles customer & admin authentication, registration, password hashing, and session tokens.
"""

import re
import secrets
from datetime import datetime, timedelta
from db import get_db_connection, hash_password, verify_password

def normalize_kenyan_phone(phone: str) -> str:
    """Normalizes various Kenyan phone number formats into +254XXXXXXXXX."""
    digits = re.sub(r"[^\d+]", "", phone.strip())
    if digits.startswith("+254") and len(digits) == 13:
        return digits
    if digits.startswith("254") and len(digits) == 12:
        return f"+{digits}"
    if digits.startswith("0") and len(digits) == 10:
        return f"+254{digits[1:]}"
    return digits

def validate_phone(phone: str) -> bool:
    """Checks if the phone is a valid Kenyan Safaricom/Airtel/Telkom number."""
    normalized = normalize_kenyan_phone(phone)
    # Valid Kenyan numbers: +254 followed by 7 or 1 and 8 digits
    return bool(re.match(r"^\+254[17]\d{8}$", normalized))

def validate_email(email: str) -> bool:
    """Basic email validation."""
    return bool(re.match(r"^[^@]+@[^@]+\.[^@]+$", email.strip()))

def register_user(full_name: str, email: str, phone: str, password: str, delivery_county: str = "Nairobi", delivery_address: str = "") -> dict:
    """Registers a new customer account."""
    if not full_name or len(full_name.strip()) < 2:
        return {"success": False, "error": "Full name must be at least 2 characters."}
    
    email = email.strip().lower()
    if not validate_email(email):
        return {"success": False, "error": "Please enter a valid email address."}
    
    if not validate_phone(phone):
        return {"success": False, "error": "Please enter a valid Kenyan phone number (e.g. 0712345678 or +254712345678)."}
    
    if len(password) < 6:
        return {"success": False, "error": "Password must be at least 6 characters long."}

    norm_phone = normalize_kenyan_phone(phone)
    pwd_hash, salt = hash_password(password)
    now_str = datetime.now().isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if email exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            return {"success": False, "error": "An account with this email address already exists."}

        cursor.execute("""
            INSERT INTO users (full_name, email, phone, password_hash, salt, role, delivery_county, delivery_address, created_at)
            VALUES (?, ?, ?, ?, ?, 'user', ?, ?, ?)
        """, (full_name.strip(), email, norm_phone, pwd_hash, salt, delivery_county or "Nairobi", delivery_address or "", now_str))
        user_id = cursor.lastrowid
        conn.commit()

        # Create session
        token = create_session(user_id, "user", conn)
        return {
            "success": True,
            "user": {
                "id": user_id,
                "full_name": full_name.strip(),
                "email": email,
                "phone": norm_phone,
                "role": "user",
                "delivery_county": delivery_county,
                "delivery_address": delivery_address
            },
            "token": token
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def login_user(identifier: str, password: str) -> dict:
    """Logs in either by email or phone number."""
    identifier = identifier.strip()
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        norm_phone = normalize_kenyan_phone(identifier)
        cursor.execute("""
            SELECT id, full_name, email, phone, password_hash, salt, role, delivery_county, delivery_address
            FROM users
            WHERE LOWER(email) = LOWER(?) OR phone = ? OR phone = ?
        """, (identifier, identifier, norm_phone))
        row = cursor.fetchone()

        if not row:
            return {"success": False, "error": "Invalid email/phone or password."}

        if not verify_password(password, row["password_hash"], row["salt"]):
            return {"success": False, "error": "Invalid email/phone or password."}

        user_id = row["id"]
        role = row["role"]
        token = create_session(user_id, role, conn)

        return {
            "success": True,
            "user": {
                "id": user_id,
                "full_name": row["full_name"],
                "email": row["email"],
                "phone": row["phone"],
                "role": role,
                "delivery_county": row["delivery_county"],
                "delivery_address": row["delivery_address"]
            },
            "token": token
        }
    finally:
        conn.close()

def create_session(user_id: int, role: str, conn = None) -> str:
    """Creates a new session token valid for 7 days."""
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    token = secrets.token_urlsafe(32)
    now = datetime.now()
    expires = now + timedelta(days=7)
    
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO sessions (token, user_id, role, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
    """, (token, user_id, role, now.isoformat(), expires.isoformat()))
    conn.commit()

    if should_close:
        conn.close()
    return token

def get_user_from_token(token: str) -> dict | None:
    """Retrieves authenticated user details from session token."""
    if not token:
        return None

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        now_str = datetime.now().isoformat()
        cursor.execute("""
            SELECT s.token, s.expires_at, u.id, u.full_name, u.email, u.phone, u.role, u.delivery_county, u.delivery_address
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > ?
        """, (token, now_str))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "full_name": row["full_name"],
            "email": row["email"],
            "phone": row["phone"],
            "role": row["role"],
            "delivery_county": row["delivery_county"],
            "delivery_address": row["delivery_address"]
        }
    finally:
        conn.close()

def delete_session(token: str):
    """Deletes a session token on logout."""
    if not token:
        return
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
    finally:
        conn.close()
