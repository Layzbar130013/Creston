"""
CRESTON PREMIUM COLLECTIONS - REST API Router and Handlers
Handles all business logic for public storefront and admin portal.
"""

import json
import csv
import io
import os
import re
import time
import base64
import secrets
from datetime import datetime, date
from urllib.parse import parse_qs, urlparse

from db import get_db_connection
from auth import (
    register_user, login_user, get_user_from_token, delete_session,
    normalize_kenyan_phone, validate_phone, validate_email
)

def get_shipping_fee(county: str, subtotal: float) -> float:
    """Calculates shipping fee in KSh based on Kenyan counties."""
    if subtotal >= 5000:
        return 0.0  # Free shipping promotion for orders KSh 5,000 and above
    
    county_clean = county.strip().lower()
    if county_clean == "nairobi":
        return 200.0
    elif county_clean in ["kiambu", "machakos", "kajiado"]:
        return 300.0
    elif county_clean in ["mombasa", "nakuru", "kisumu", "eldoret", "uasin gishu"]:
        return 400.0
    else:
        return 500.0

def handle_api_request(method: str, path: str, query_params: dict, body: dict, auth_token: str) -> tuple[int, dict, str]:
    """
    Main API router.
    Returns: (status_code, headers_dict, response_body_string)
    """
    current_user = get_user_from_token(auth_token) if auth_token else None
    is_admin = current_user and current_user.get("role") == "admin"

    # Default JSON headers
    json_headers = {"Content-Type": "application/json; charset=utf-8"}

    # -------------------------------------------------------------
    # 1. AUTH ENDPOINTS
    # -------------------------------------------------------------
    if path == "/api/auth/register" and method == "POST":
        res = register_user(
            full_name=body.get("full_name", ""),
            email=body.get("email", ""),
            phone=body.get("phone", ""),
            password=body.get("password", ""),
            delivery_county=body.get("delivery_county", "Nairobi"),
            delivery_address=body.get("delivery_address", "")
        )
        return (201 if res["success"] else 400, json_headers, json.dumps(res))

    if path == "/api/auth/login" and method == "POST":
        res = login_user(body.get("identifier", ""), body.get("password", ""))
        return (200 if res["success"] else 401, json_headers, json.dumps(res))

    if path == "/api/auth/me" and method == "GET":
        if not current_user:
            return (401, json_headers, json.dumps({"success": False, "error": "Not authenticated"}))
        return (200, json_headers, json.dumps({"success": True, "user": current_user}))

    if path == "/api/auth/logout" and method == "POST":
        if auth_token:
            delete_session(auth_token)
        return (200, json_headers, json.dumps({"success": True, "message": "Logged out successfully"}))

    # -------------------------------------------------------------
    # 2. STORE BRANDING & SETTINGS (LOGO & ABOUT DETAILS)
    # -------------------------------------------------------------
    if path == "/api/store/settings" and method == "GET":
        conn = get_db_connection()
        try:
            row = conn.execute("SELECT * FROM store_settings WHERE id = 1").fetchone()
            if not row:
                return (404, json_headers, json.dumps({"success": False, "error": "Settings not found"}))
            return (200, json_headers, json.dumps({"success": True, "settings": dict(row)}))
        finally:
            conn.close()

    if path == "/api/admin/store/settings" and method == "PUT":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        conn = get_db_connection()
        try:
            # Update store settings: logo, motto, about info, address, contacts
            now_str = datetime.now().isoformat()
            conn.execute("""
                UPDATE store_settings
                SET store_name = COALESCE(?, store_name),
                    motto = COALESCE(?, motto),
                    logo_url = COALESCE(?, logo_url),
                    about_title = COALESCE(?, about_title),
                    about_text = COALESCE(?, about_text),
                    physical_address = COALESCE(?, physical_address),
                    phone_number = COALESCE(?, phone_number),
                    email_address = COALESCE(?, email_address),
                    opening_hours = COALESCE(?, opening_hours),
                    banner_text = COALESCE(?, banner_text),
                    updated_at = ?
                WHERE id = 1
            """, (
                body.get("store_name"),
                body.get("motto"),
                body.get("logo_url"),
                body.get("about_title"),
                body.get("about_text"),
                body.get("physical_address"),
                body.get("phone_number"),
                body.get("email_address"),
                body.get("opening_hours"),
                body.get("banner_text"),
                now_str
            ))
            conn.commit()
            updated = conn.execute("SELECT * FROM store_settings WHERE id = 1").fetchone()
            return (200, json_headers, json.dumps({"success": True, "settings": dict(updated)}))
        finally:
            conn.close()

    # -------------------------------------------------------------
    # 3. PAYMENT SETTINGS & M-PESA CONFIGURATION
    # -------------------------------------------------------------
    if path == "/api/payment-settings" and method == "GET":
        conn = get_db_connection()
        try:
            row = conn.execute("SELECT * FROM payment_settings WHERE id = 1").fetchone()
            if not row:
                return (404, json_headers, json.dumps({"success": False, "error": "Payment settings not found"}))
            return (200, json_headers, json.dumps({"success": True, "payment_settings": dict(row)}))
        finally:
            conn.close()

    if path == "/api/admin/payment-settings" and method == "PUT":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        conn = get_db_connection()
        try:
            now_str = datetime.now().isoformat()
            conn.execute("""
                UPDATE payment_settings
                SET till_number = COALESCE(?, till_number),
                    till_name = COALESCE(?, till_name),
                    paybill_number = COALESCE(?, paybill_number),
                    paybill_account = COALESCE(?, paybill_account),
                    stk_enabled = COALESCE(?, stk_enabled),
                    till_enabled = COALESCE(?, till_enabled),
                    paybill_enabled = COALESCE(?, paybill_enabled),
                    cod_enabled = COALESCE(?, cod_enabled),
                    instructions = COALESCE(?, instructions),
                    updated_at = ?
                WHERE id = 1
            """, (
                body.get("till_number"),
                body.get("till_name"),
                body.get("paybill_number"),
                body.get("paybill_account"),
                body.get("stk_enabled"),
                body.get("till_enabled"),
                body.get("paybill_enabled"),
                body.get("cod_enabled"),
                body.get("instructions"),
                now_str
            ))
            conn.commit()
            updated = conn.execute("SELECT * FROM payment_settings WHERE id = 1").fetchone()
            return (200, json_headers, json.dumps({"success": True, "payment_settings": dict(updated)}))
        finally:
            conn.close()

    # -------------------------------------------------------------
    # 4. CATEGORIES
    # -------------------------------------------------------------
    if path == "/api/categories" and method == "GET":
        conn = get_db_connection()
        try:
            cursor = conn.execute("SELECT * FROM categories ORDER BY id ASC")
            categories = [dict(r) for r in cursor.fetchall()]
            return (200, json_headers, json.dumps({"success": True, "categories": categories}))
        finally:
            conn.close()

    # -------------------------------------------------------------
    # 5. PRODUCTS (PUBLIC & ADMIN)
    # -------------------------------------------------------------
    if path == "/api/products" and method == "GET":
        category_slug = query_params.get("category", [None])[0]
        search_query = query_params.get("q", [None])[0]
        sort_by = query_params.get("sort", ["newest"])[0]

        conn = get_db_connection()
        try:
            query = """
                SELECT p.*, c.name as category_name, c.slug as category_slug
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = 1 AND p.is_voided = 0
            """
            params = []

            if category_slug and category_slug != "all":
                query += " AND c.slug = ?"
                params.append(category_slug)

            if search_query:
                query += " AND (p.name LIKE ? OR p.description LIKE ?)"
                search_param = f"%{search_query.strip()}%"
                params.extend([search_param, search_param])

            if sort_by == "price_asc":
                query += " ORDER BY p.price ASC"
            elif sort_by == "price_desc":
                query += " ORDER BY p.price DESC"
            elif sort_by == "name":
                query += " ORDER BY p.name ASC"
            else:
                query += " ORDER BY p.id DESC"

            cursor = conn.execute(query, params)
            products = [dict(r) for r in cursor.fetchall()]
            return (200, json_headers, json.dumps({"success": True, "products": products}))
        finally:
            conn.close()

    # Admin Products (includes voided and all items)
    if path == "/api/admin/products" and method == "GET":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        conn = get_db_connection()
        try:
            cursor = conn.execute("""
                SELECT p.*, c.name as category_name, c.slug as category_slug
                FROM products p
                JOIN categories c ON p.category_id = c.id
                ORDER BY p.id DESC
            """)
            products = [dict(r) for r in cursor.fetchall()]
            return (200, json_headers, json.dumps({"success": True, "products": products}))
        finally:
            conn.close()

    # Product detail
    match_product = re.match(r"^/api/products/(\d+)$", path)
    if match_product and method == "GET":
        product_id = int(match_product.group(1))
        conn = get_db_connection()
        try:
            row = conn.execute("""
                SELECT p.*, c.name as category_name, c.slug as category_slug
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE p.id = ?
            """, (product_id,)).fetchone()
            if not row:
                return (404, json_headers, json.dumps({"success": False, "error": "Product not found"}))
            return (200, json_headers, json.dumps({"success": True, "product": dict(row)}))
        finally:
            conn.close()

    # Admin Upload Local Image File from PC
    if path == "/api/admin/upload" and method == "POST":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        data_url = body.get("data")
        filename = body.get("filename", "upload.jpg")
        if not data_url:
            return (400, json_headers, json.dumps({"success": False, "error": "No image data received"}))
        
        try:
            if "," in data_url:
                header, encoded = data_url.split(",", 1)
            else:
                encoded = data_url
            
            file_bytes = base64.b64decode(encoded)
            ext = os.path.splitext(filename)[1].lower() or ".jpg"
            if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
                ext = ".jpg"
            
            safe_name = f"creston_{int(time.time())}_{secrets.token_hex(4)}{ext}"
            upload_dir = os.environ.get(
                "CRESTON_UPLOAD_DIR",
                os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "uploads")
            )
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, safe_name)
            
            with open(file_path, "wb") as f:
                f.write(file_bytes)
            
            image_url = f"/uploads/{safe_name}"
            return (200, json_headers, json.dumps({
                "success": True,
                "url": image_url,
                "filename": safe_name
            }))
        except Exception as e:
            return (500, json_headers, json.dumps({"success": False, "error": f"Upload failed: {str(e)}"}))

    # Admin Create Product
    if path == "/api/admin/products" and method == "POST":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        name = body.get("name", "").strip()
        if not name:
            return (400, json_headers, json.dumps({"success": False, "error": "Product name is required"}))

        category_id = body.get("category_id")
        price = float(body.get("price", 0.0))
        original_price = float(body.get("original_price") or price)
        cost_price = float(body.get("cost_price") or (price * 0.5))
        stock_quantity = int(body.get("stock_quantity", 0))
        sizes = body.get("sizes", "S, M, L, XL")
        colors = body.get("colors", "Black, Navy")
        description = body.get("description", "")
        image_url = body.get("image_url", "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80")
        slug = re.sub(r"[^\w\-]", "-", name.lower()) + "-" + secrets.token_hex(3)
        now_str = datetime.now().isoformat()

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO products (
                    name, slug, category_id, description, price, original_price, cost_price,
                    stock_quantity, sizes, colors, image_url, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, slug, category_id, description, price, original_price, cost_price, stock_quantity, sizes, colors, image_url, now_str, now_str))
            product_id = cursor.lastrowid
            conn.commit()

            created = conn.execute("SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = ?", (product_id,)).fetchone()
            return (201, json_headers, json.dumps({"success": True, "product": dict(created)}))
        finally:
            conn.close()

    # Admin Quick Price & Stock Update
    match_price_stock = re.match(r"^/api/admin/products/(\d+)/price-stock$", path)
    if match_price_stock and method == "PATCH":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        product_id = int(match_price_stock.group(1))
        new_price = body.get("price")
        new_stock = body.get("stock_quantity")
        cost_price = body.get("cost_price")
        now_str = datetime.now().isoformat()

        conn = get_db_connection()
        try:
            conn.execute("""
                UPDATE products
                SET price = COALESCE(?, price),
                    stock_quantity = COALESCE(?, stock_quantity),
                    cost_price = COALESCE(?, cost_price),
                    updated_at = ?
                WHERE id = ?
            """, (new_price, new_stock, cost_price, now_str, product_id))
            conn.commit()

            updated = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
            if not updated:
                return (404, json_headers, json.dumps({"success": False, "error": "Product not found"}))
            return (200, json_headers, json.dumps({"success": True, "product": dict(updated)}))
        finally:
            conn.close()

    # Admin Update Entire Product
    match_product_admin = re.match(r"^/api/admin/products/(\d+)$", path)
    if match_product_admin and method == "PUT":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        product_id = int(match_product_admin.group(1))
        now_str = datetime.now().isoformat()

        conn = get_db_connection()
        try:
            conn.execute("""
                UPDATE products
                SET name = COALESCE(?, name),
                    category_id = COALESCE(?, category_id),
                    description = COALESCE(?, description),
                    price = COALESCE(?, price),
                    original_price = COALESCE(?, original_price),
                    cost_price = COALESCE(?, cost_price),
                    stock_quantity = COALESCE(?, stock_quantity),
                    sizes = COALESCE(?, sizes),
                    colors = COALESCE(?, colors),
                    image_url = COALESCE(?, image_url),
                    updated_at = ?
                WHERE id = ?
            """, (
                body.get("name"),
                body.get("category_id"),
                body.get("description"),
                body.get("price"),
                body.get("original_price"),
                body.get("cost_price"),
                body.get("stock_quantity"),
                body.get("sizes"),
                body.get("colors"),
                body.get("image_url"),
                now_str,
                product_id
            ))
            conn.commit()
            updated = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
            if not updated:
                return (404, json_headers, json.dumps({"success": False, "error": "Product not found"}))
            return (200, json_headers, json.dumps({"success": True, "product": dict(updated)}))
        finally:
            conn.close()

    # Admin Void Product
    match_void_product = re.match(r"^/api/admin/products/(\d+)/void$", path)
    if match_void_product and method == "POST":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        product_id = int(match_void_product.group(1))
        reason = body.get("reason", "Voided by administrator")
        unvoid = body.get("unvoid", False)
        now_str = datetime.now().isoformat()

        conn = get_db_connection()
        try:
            if unvoid:
                conn.execute("""
                    UPDATE products
                    SET is_voided = 0, void_reason = NULL, updated_at = ?
                    WHERE id = ?
                """, (now_str, product_id))
            else:
                conn.execute("""
                    UPDATE products
                    SET is_voided = 1, void_reason = ?, updated_at = ?
                    WHERE id = ?
                """, (reason, now_str, product_id))
            conn.commit()

            updated = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
            if not updated:
                return (404, json_headers, json.dumps({"success": False, "error": "Product not found"}))
            return (200, json_headers, json.dumps({"success": True, "product": dict(updated)}))
        finally:
            conn.close()

    # Admin Delete / Remove Product
    match_delete_product = re.match(r"^/api/admin/products/(\d+)$", path)
    if match_delete_product and method == "DELETE":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        product_id = int(match_delete_product.group(1))
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            existing = cursor.execute("SELECT id, name FROM products WHERE id = ?", (product_id,)).fetchone()
            if not existing:
                return (404, json_headers, json.dumps({"success": False, "error": "Product not found"}))
            
            # Detach from order_items gracefully to preserve historical order logs
            cursor.execute("UPDATE order_items SET product_id = NULL WHERE product_id = ?", (product_id,))
            cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
            conn.commit()

            return (200, json_headers, json.dumps({
                "success": True,
                "message": f"Product '{existing['name']}' has been permanently removed.",
                "deleted_id": product_id
            }))
        finally:
            conn.close()

    # -------------------------------------------------------------
    # 6. ORDERS & CHECKOUT (CUSTOMER & GUEST)
    # -------------------------------------------------------------
    if path == "/api/orders/checkout" and method == "POST":
        items = body.get("items", [])
        if not items:
            return (400, json_headers, json.dumps({"success": False, "error": "Your shopping cart is empty"}))

        customer_name = body.get("customer_name", "").strip()
        customer_phone = body.get("customer_phone", "").strip()
        customer_email = body.get("customer_email", "").strip()
        delivery_county = body.get("delivery_county", "Nairobi").strip()
        delivery_town = body.get("delivery_town", "").strip()
        delivery_address = body.get("delivery_address", "").strip()
        delivery_notes = body.get("delivery_notes", "").strip()
        payment_method = body.get("payment_method", "mpesa_stk")  # mpesa_stk, mpesa_till, mpesa_paybill, cod
        mpesa_code = body.get("mpesa_code", "").strip()

        if not customer_name:
            return (400, json_headers, json.dumps({"success": False, "error": "Full name is required for delivery"}))
        if not validate_phone(customer_phone):
            return (400, json_headers, json.dumps({"success": False, "error": "Please enter a valid Kenyan phone number (e.g. 0712345678)"}))
        if not delivery_address:
            return (400, json_headers, json.dumps({"success": False, "error": "Please specify your physical delivery address / street / building"}))

        norm_phone = normalize_kenyan_phone(customer_phone)

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            # Calculate subtotal and verify stock
            subtotal = 0.0
            order_items_to_insert = []

            for item in items:
                prod_id = item.get("product_id")
                qty = int(item.get("quantity", 1))
                if qty <= 0:
                    continue

                prod_row = cursor.execute("SELECT id, name, price, stock_quantity, is_voided FROM products WHERE id = ?", (prod_id,)).fetchone()
                if not prod_row:
                    return (400, json_headers, json.dumps({"success": False, "error": f"Item {prod_id} not found."}))
                if prod_row["is_voided"]:
                    return (400, json_headers, json.dumps({"success": False, "error": f"Item '{prod_row['name']}' is discontinued/voided."}))
                if prod_row["stock_quantity"] < qty:
                    return (400, json_headers, json.dumps({"success": False, "error": f"Insufficient stock for '{prod_row['name']}'. Only {prod_row['stock_quantity']} available."}))

                item_subtotal = prod_row["price"] * qty
                subtotal += item_subtotal

                order_items_to_insert.append({
                    "product_id": prod_row["id"],
                    "product_name": prod_row["name"],
                    "size": item.get("size", ""),
                    "color": item.get("color", ""),
                    "unit_price": prod_row["price"],
                    "quantity": qty,
                    "subtotal": item_subtotal
                })

            shipping_fee = get_shipping_fee(delivery_county, subtotal)
            total_amount = subtotal + shipping_fee

            # Decrement stock
            for item in order_items_to_insert:
                cursor.execute("""
                    UPDATE products
                    SET stock_quantity = stock_quantity - ?
                    WHERE id = ?
                """, (item["quantity"], item["product_id"]))

            order_number = f"CP-{datetime.now().year}-{secrets.randbelow(9000) + 1000}"
            now_str = datetime.now().isoformat()
            user_id = current_user["id"] if current_user else None

            # Payment status initial determination
            payment_status = "Pending"
            if payment_method == "cod":
                payment_status = "Pending (Cash On Delivery)"
            elif mpesa_code:
                payment_status = "Paid"

            cursor.execute("""
                INSERT INTO orders (
                    order_number, user_id, customer_name, customer_phone, customer_email,
                    delivery_county, delivery_town, delivery_address, delivery_notes,
                    subtotal, shipping_fee, total_amount, payment_method, payment_status,
                    mpesa_code, order_status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Processing', ?)
            """, (
                order_number, user_id, customer_name, norm_phone, customer_email,
                delivery_county, delivery_town, delivery_address, delivery_notes,
                subtotal, shipping_fee, total_amount, payment_method, payment_status,
                mpesa_code, now_str
            ))
            order_id = cursor.lastrowid

            # Insert order items
            for oi in order_items_to_insert:
                cursor.execute("""
                    INSERT INTO order_items (order_id, product_id, product_name, size, color, unit_price, quantity, subtotal)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (order_id, oi["product_id"], oi["product_name"], oi["size"], oi["color"], oi["unit_price"], oi["quantity"], oi["subtotal"]))

            conn.commit()

            return (201, json_headers, json.dumps({
                "success": True,
                "order_number": order_number,
                "order_id": order_id,
                "subtotal": subtotal,
                "shipping_fee": shipping_fee,
                "total_amount": total_amount,
                "customer_phone": norm_phone,
                "payment_method": payment_method,
                "payment_status": payment_status,
                "message": "Order placed successfully!"
            }))
        finally:
            conn.close()

    # M-Pesa STK Push Simulation Trigger
    if path == "/api/orders/mpesa-stk-push" and method == "POST":
        order_number = body.get("order_number")
        phone = body.get("phone", "")
        amount = body.get("amount")

        if not order_number or not phone:
            return (400, json_headers, json.dumps({"success": False, "error": "Order number and phone required"}))

        norm_phone = normalize_kenyan_phone(phone)
        checkout_request_id = f"ws_CO_{datetime.now().strftime('%Y%m%d%H%M%S')}_{secrets.randbelow(999999)}"

        return (200, json_headers, json.dumps({
            "success": True,
            "ResponseCode": "0",
            "ResponseDescription": "Success. Request accepted for processing",
            "MerchantRequestID": f"MR_{secrets.token_hex(6)}",
            "CheckoutRequestID": checkout_request_id,
            "CustomerMessage": f"Success. STK Push PIN prompt sent to {norm_phone}. Enter your M-Pesa PIN to authorize payment."
        }))

    # M-Pesa STK Push / Confirmation completion
    if path == "/api/orders/confirm-mpesa" and method == "POST":
        order_number = body.get("order_number")
        mpesa_code = body.get("mpesa_code", "").strip() or f"SK{secrets.token_hex(4).upper()}"

        if not order_number:
            return (400, json_headers, json.dumps({"success": False, "error": "Order number required"}))

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE orders
                SET payment_status = 'Paid',
                    mpesa_code = ?,
                    order_status = 'Processing'
                WHERE order_number = ?
            """, (mpesa_code, order_number))
            conn.commit()

            order = cursor.execute("SELECT * FROM orders WHERE order_number = ?", (order_number,)).fetchone()
            if not order:
                return (404, json_headers, json.dumps({"success": False, "error": "Order not found"}))

            return (200, json_headers, json.dumps({
                "success": True,
                "order_number": order_number,
                "mpesa_code": mpesa_code,
                "payment_status": "Paid",
                "message": f"M-Pesa payment {mpesa_code} confirmed successfully!"
            }))
        finally:
            conn.close()

    # Customer My Orders
    if path == "/api/orders/my-orders" and method == "GET":
        if not current_user:
            return (401, json_headers, json.dumps({"success": False, "error": "Authentication required"}))
        
        conn = get_db_connection()
        try:
            cursor = conn.execute("""
                SELECT o.*, COUNT(oi.id) as item_count
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.user_id = ?
                GROUP BY o.id
                ORDER BY o.id DESC
            """, (current_user["id"],))
            orders = [dict(r) for r in cursor.fetchall()]
            return (200, json_headers, json.dumps({"success": True, "orders": orders}))
        finally:
            conn.close()

    # Track order publicly
    match_track = re.match(r"^/api/orders/track/([A-Za-z0-9\-]+)$", path)
    if match_track and method == "GET":
        order_number = match_track.group(1)
        conn = get_db_connection()
        try:
            order = conn.execute("SELECT * FROM orders WHERE order_number = ?", (order_number,)).fetchone()
            if not order:
                return (404, json_headers, json.dumps({"success": False, "error": "Order not found"}))
            
            items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (order["id"],)).fetchall()
            return (200, json_headers, json.dumps({
                "success": True,
                "order": dict(order),
                "items": [dict(i) for i in items]
            }))
        finally:
            conn.close()

    # -------------------------------------------------------------
    # 7. ADMIN ORDERS & VOIDING
    # -------------------------------------------------------------
    if path == "/api/admin/orders" and method == "GET":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        status_filter = query_params.get("status", [None])[0]
        date_filter = query_params.get("date", [None])[0]

        conn = get_db_connection()
        try:
            query = "SELECT * FROM orders WHERE 1=1"
            params = []
            if status_filter and status_filter != "all":
                query += " AND order_status = ?"
                params.append(status_filter)
            if date_filter:
                query += " AND DATE(created_at) = ?"
                params.append(date_filter)

            query += " ORDER BY id DESC"
            orders = [dict(r) for r in conn.execute(query, params).fetchall()]

            # Attach items for each order
            for o in orders:
                items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (o["id"],)).fetchall()
                o["items"] = [dict(i) for i in items]

            return (200, json_headers, json.dumps({"success": True, "orders": orders}))
        finally:
            conn.close()

    # Update order status
    match_order_status = re.match(r"^/api/admin/orders/(\d+)/status$", path)
    if match_order_status and method == "PATCH":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        order_id = int(match_order_status.group(1))
        new_status = body.get("order_status")
        payment_status = body.get("payment_status")

        conn = get_db_connection()
        try:
            conn.execute("""
                UPDATE orders
                SET order_status = COALESCE(?, order_status),
                    payment_status = COALESCE(?, payment_status)
                WHERE id = ?
            """, (new_status, payment_status, order_id))
            conn.commit()

            order = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
            return (200, json_headers, json.dumps({"success": True, "order": dict(order)}))
        finally:
            conn.close()

    # Void order with inventory restock
    match_order_void = re.match(r"^/api/admin/orders/(\d+)/void$", path)
    if match_order_void and method == "POST":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        order_id = int(match_order_void.group(1))
        void_reason = body.get("reason", "Cancelled by admin")

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            order = cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
            if not order:
                return (404, json_headers, json.dumps({"success": False, "error": "Order not found"}))
            
            if order["is_voided"]:
                return (400, json_headers, json.dumps({"success": False, "error": "Order is already voided"}))

            # Restock items
            order_items = cursor.execute("SELECT product_id, quantity FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
            for oi in order_items:
                if oi["product_id"]:
                    cursor.execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", (oi["quantity"], oi["product_id"]))

            cursor.execute("""
                UPDATE orders
                SET is_voided = 1,
                    void_reason = ?,
                    order_status = 'Voided'
                WHERE id = ?
            """, (void_reason, order_id))
            conn.commit()

            updated = cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
            return (200, json_headers, json.dumps({"success": True, "order": dict(updated), "message": "Order voided and stock restocked."}))
        finally:
            conn.close()

    # -------------------------------------------------------------
    # 8. ADMIN DAILY REPORT OF SALES
    # -------------------------------------------------------------
    if path == "/api/admin/reports/daily" and method == "GET":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        target_date_str = query_params.get("date", [date.today().isoformat()])[0]

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            # Summary metrics for target date (excluding voided orders)
            cursor.execute("""
                SELECT 
                    COUNT(id) as total_orders,
                    COALESCE(SUM(total_amount), 0.0) as gross_sales,
                    COALESCE(SUM(subtotal), 0.0) as product_sales,
                    COALESCE(SUM(shipping_fee), 0.0) as delivery_fees
                FROM orders
                WHERE DATE(created_at) = ? AND is_voided = 0
            """, (target_date_str,))
            summary_row = cursor.fetchone()
            total_orders = summary_row["total_orders"]
            gross_sales = summary_row["gross_sales"]
            product_sales = summary_row["product_sales"]
            delivery_fees = summary_row["delivery_fees"]

            # Units sold
            cursor.execute("""
                SELECT COALESCE(SUM(oi.quantity), 0) as units_sold
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE DATE(o.created_at) = ? AND o.is_voided = 0
            """, (target_date_str,))
            units_sold = cursor.fetchone()["units_sold"]

            # Average Order Value
            aov = (gross_sales / total_orders) if total_orders > 0 else 0.0

            # Product breakdown for target date
            cursor.execute("""
                SELECT 
                    oi.product_name,
                    p.id as product_id,
                    p.price as current_price,
                    p.stock_quantity as current_stock,
                    c.name as category_name,
                    SUM(oi.quantity) as units_sold,
                    SUM(oi.subtotal) as total_revenue
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                LEFT JOIN products p ON oi.product_id = p.id
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE DATE(o.created_at) = ? AND o.is_voided = 0
                GROUP BY oi.product_name
                ORDER BY total_revenue DESC
            """, (target_date_str,))
            product_breakdown = [dict(r) for r in cursor.fetchall()]

            # Payment method breakdown
            cursor.execute("""
                SELECT 
                    payment_method,
                    COUNT(id) as order_count,
                    COALESCE(SUM(total_amount), 0.0) as total_amount
                FROM orders
                WHERE DATE(created_at) = ? AND is_voided = 0
                GROUP BY payment_method
            """, (target_date_str,))
            payment_breakdown = [dict(r) for r in cursor.fetchall()]

            # County distribution
            cursor.execute("""
                SELECT 
                    delivery_county,
                    COUNT(id) as order_count,
                    COALESCE(SUM(total_amount), 0.0) as total_amount
                FROM orders
                WHERE DATE(created_at) = ? AND is_voided = 0
                GROUP BY delivery_county
                ORDER BY total_amount DESC
            """, (target_date_str,))
            county_breakdown = [dict(r) for r in cursor.fetchall()]

            # Hourly distribution
            cursor.execute("""
                SELECT 
                    strftime('%H:00', created_at) as hour,
                    COUNT(id) as order_count,
                    COALESCE(SUM(total_amount), 0.0) as total_amount
                FROM orders
                WHERE DATE(created_at) = ? AND is_voided = 0
                GROUP BY hour
                ORDER BY hour ASC
            """, (target_date_str,))
            hourly_breakdown = [dict(r) for r in cursor.fetchall()]

            return (200, json_headers, json.dumps({
                "success": True,
                "date": target_date_str,
                "summary": {
                    "total_orders": total_orders,
                    "gross_sales": gross_sales,
                    "product_sales": product_sales,
                    "delivery_fees": delivery_fees,
                    "units_sold": units_sold,
                    "aov": round(aov, 2)
                },
                "product_breakdown": product_breakdown,
                "payment_breakdown": payment_breakdown,
                "county_breakdown": county_breakdown,
                "hourly_breakdown": hourly_breakdown
            }))
        finally:
            conn.close()

    # Export Daily Report as CSV
    if path == "/api/admin/reports/export" and method == "GET":
        if not is_admin:
            return (403, json_headers, json.dumps({"success": False, "error": "Admin access required"}))
        
        target_date_str = query_params.get("date", [date.today().isoformat()])[0]

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    o.order_number,
                    o.created_at,
                    o.customer_name,
                    o.customer_phone,
                    o.delivery_county,
                    o.delivery_town,
                    o.delivery_address,
                    o.payment_method,
                    o.payment_status,
                    o.mpesa_code,
                    o.subtotal,
                    o.shipping_fee,
                    o.total_amount,
                    o.order_status,
                    o.is_voided
                FROM orders o
                WHERE DATE(o.created_at) = ?
                ORDER BY o.id ASC
            """, (target_date_str,))
            orders = cursor.fetchall()

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow([
                "Order Number", "Date & Time", "Customer Name", "Customer Phone",
                "County", "Town", "Delivery Address", "Payment Method",
                "Payment Status", "M-Pesa Code", "Subtotal (KSh)", "Delivery Fee (KSh)",
                "Total Amount (KSh)", "Order Status", "Voided"
            ])

            for row in orders:
                writer.writerow([
                    row["order_number"],
                    row["created_at"],
                    row["customer_name"],
                    row["customer_phone"],
                    row["delivery_county"],
                    row["delivery_town"],
                    row["delivery_address"],
                    row["payment_method"],
                    row["payment_status"],
                    row["mpesa_code"],
                    f"{row['subtotal']:.2f}",
                    f"{row['shipping_fee']:.2f}",
                    f"{row['total_amount']:.2f}",
                    row["order_status"],
                    "YES" if row["is_voided"] else "NO"
                ])

            csv_data = output.getvalue()
            csv_headers = {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": f'attachment; filename="Creston_Sales_Report_{target_date_str}.csv"'
            }
            return (200, csv_headers, csv_data)
        finally:
            conn.close()

    # 404 for unknown endpoints
    return (404, json_headers, json.dumps({"success": False, "error": f"Endpoint {method} {path} not found"}))
