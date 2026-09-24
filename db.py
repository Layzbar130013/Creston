"""
CRESTON PREMIUM COLLECTIONS - Database Management & Schema
Motto: Quality, Style, Trust
Location: Nairobi, Kenya
"""

import sqlite3
import os
import json
import hashlib
import secrets
from datetime import datetime, date, timedelta

DB_PATH = os.environ.get(
    "CRESTON_DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "creston.db")
)

def get_db_connection():
    """Returns a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    """Hashes a password using PBKDF2-HMAC-SHA256 with a unique salt."""
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return hashed.hex(), salt

def verify_password(password: str, password_hash: str, salt: str) -> bool:
    """Verifies a password against the stored hash and salt."""
    expected_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(expected_hash, password_hash)

def init_db():
    """Initializes tables and seeds initial data if empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Store settings table (Branding, Logo, Motto, About Us)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS store_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            store_name TEXT NOT NULL,
            motto TEXT NOT NULL,
            logo_url TEXT NOT NULL,
            about_title TEXT NOT NULL,
            about_text TEXT NOT NULL,
            physical_address TEXT NOT NULL,
            phone_number TEXT NOT NULL,
            email_address TEXT NOT NULL,
            opening_hours TEXT NOT NULL,
            banner_text TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    # 2. Payment settings table (M-Pesa Till, Paybill, options)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS payment_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            till_number TEXT NOT NULL,
            till_name TEXT NOT NULL,
            paybill_number TEXT NOT NULL,
            paybill_account TEXT NOT NULL,
            stk_enabled INTEGER NOT NULL DEFAULT 1,
            till_enabled INTEGER NOT NULL DEFAULT 1,
            paybill_enabled INTEGER NOT NULL DEFAULT 1,
            cod_enabled INTEGER NOT NULL DEFAULT 1,
            instructions TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    # 3. Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user', -- 'user' or 'admin'
            delivery_county TEXT DEFAULT 'Nairobi',
            delivery_address TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
    """)

    # 4. User sessions for authentication
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # 5. Categories table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            slug TEXT NOT NULL UNIQUE,
            icon TEXT NOT NULL,
            description TEXT
        )
    """)

    # 6. Products table (Clothing items)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            category_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            price REAL NOT NULL,
            original_price REAL,
            cost_price REAL,
            stock_quantity INTEGER NOT NULL DEFAULT 0,
            sizes TEXT DEFAULT 'S, M, L, XL',
            colors TEXT DEFAULT 'Black, Navy, Grey',
            image_url TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            is_voided INTEGER NOT NULL DEFAULT 0,
            void_reason TEXT DEFAULT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )
    """)

    # 7. Orders table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number TEXT UNIQUE NOT NULL,
            user_id INTEGER,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            delivery_county TEXT NOT NULL,
            delivery_town TEXT NOT NULL,
            delivery_address TEXT NOT NULL,
            delivery_notes TEXT DEFAULT '',
            subtotal REAL NOT NULL,
            shipping_fee REAL NOT NULL,
            total_amount REAL NOT NULL,
            payment_method TEXT NOT NULL, -- 'mpesa_stk', 'mpesa_till', 'mpesa_paybill', 'cod'
            payment_status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Paid', 'Failed'
            mpesa_code TEXT DEFAULT '',
            order_status TEXT NOT NULL DEFAULT 'Processing', -- 'Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Voided'
            is_voided INTEGER NOT NULL DEFAULT 0,
            void_reason TEXT DEFAULT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    """)

    # 8. Order items table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER,
            product_name TEXT NOT NULL,
            size TEXT DEFAULT '',
            color TEXT DEFAULT '',
            unit_price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
        )
    """)

    conn.commit()

    # Seed data if not already seeded
    seed_data(conn)
    conn.close()

def seed_data(conn):
    """Populates store settings, payment settings, categories, products, and default accounts."""
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()

    # Check if store_settings already exists
    cursor.execute("SELECT COUNT(*) FROM store_settings")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO store_settings (
                id, store_name, motto, logo_url, about_title, about_text,
                physical_address, phone_number, email_address, opening_hours, banner_text, updated_at
            ) VALUES (
                1,
                'CRESTON PREMIUM COLLECTIONS',
                'Quality, Style, Trust',
                'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80',
                'Redefining East African Elegance',
                'CRESTON PREMIUM COLLECTIONS was founded on a commitment to sartorial excellence, bringing together the finest hand-selected fabrics, impeccable tailoring, and contemporary fashion designed for Kenya and the world. Every garment in our collection reflects our enduring motto: Quality, Style, Trust. From executive suits designed for the boardroom in Upper Hill and Nairobi CBD, to breathtaking evening wear and effortless weekend fashion, we curate pieces that make you stand out with quiet confidence.',
                'Creston Executive Arcade, 2nd Floor, Kimathi Street, Nairobi CBD, Kenya',
                '+254 712 345 678 / +254 733 987 654',
                'info@creston.co.ke',
                'Mon - Sat: 8:00 AM - 7:30 PM | Sun: 10:00 AM - 4:00 PM',
                '🇰🇪 Free Nairobi Express Delivery on orders above KSh 5,000 | Countrywide Delivery across all 47 Counties | Lipa na M-Pesa Available',
                ?
            )
        """, (now_str,))

    # Check if payment_settings already exists
    cursor.execute("SELECT COUNT(*) FROM payment_settings")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO payment_settings (
                id, till_number, till_name, paybill_number, paybill_account,
                stk_enabled, till_enabled, paybill_enabled, cod_enabled, instructions, updated_at
            ) VALUES (
                1,
                '5842910',
                'CRESTON PREMIUM COLLECTIONS',
                '400200',
                'CRESTON',
                1, 1, 1, 1,
                '1. Go to M-Pesa menu on your phone\n2. Select Lipa na M-Pesa\n3. Select Buy Goods and Services (or Paybill)\n4. Enter Till Number: 5842910\n5. Enter the exact total order amount\n6. Enter your M-Pesa PIN and confirm\n7. Paste or enter the M-Pesa confirmation code below to finish your order.',
                ?
            )
        """, (now_str,))

    # Check if users already exist
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        # 1. Admin User
        admin_hash, admin_salt = hash_password("Admin@123")
        cursor.execute("""
            INSERT INTO users (full_name, email, phone, password_hash, salt, role, delivery_county, delivery_address, created_at)
            VALUES (?, ?, ?, ?, ?, 'admin', 'Nairobi', 'Kimathi Street, Nairobi CBD', ?)
        """, ("Creston Admin", "admin@creston.co.ke", "+254700000001", admin_hash, admin_salt, now_str))

        # 2. Sample Customer
        user_hash, user_salt = hash_password("User@123")
        cursor.execute("""
            INSERT INTO users (full_name, email, phone, password_hash, salt, role, delivery_county, delivery_address, created_at)
            VALUES (?, ?, ?, ?, ?, 'user', 'Nairobi', 'Westlands, Rhapta Road, Court 12', ?)
        """, ("Wambui Kamau", "wambui@gmail.com", "+254712345678", user_hash, user_salt, now_str))

    # Check if categories already exist
    cursor.execute("SELECT COUNT(*) FROM categories")
    if cursor.fetchone()[0] == 0:
        categories = [
            ("Men's Suits & Blazers", "mens-suits", "👔", "Handcrafted two-piece & three-piece executive suits, bespoke blazers and tuxedos."),
            ("Women's Dresses & Gowns", "womens-dresses", "👗", "Luxury evening gowns, chic office dresses, wrap dresses, and stylish African prints."),
            ("Executive & Office Wear", "office-wear", "💼", "Crisp cotton formal shirts, pleated trousers, tailored skirts, and silk blouses."),
            ("Casual & Streetwear", "casual-streetwear", "👕", "Premium heavy-cotton tees, denim jackets, polo shirts, chinos, and stylish hoodies."),
            ("Footwear & Loafers", "footwear", "👞", "Genuine leather Oxford shoes, Italian handcrafted loafers, heels, and fashion boots."),
            ("Accessories & Belts", "accessories", "🕶️", "Italian leather belts, silk neckties, cufflinks, luxury leather wallets, and handbags.")
        ]
        cursor.executemany("""
            INSERT INTO categories (name, slug, icon, description)
            VALUES (?, ?, ?, ?)
        """, categories)

    # Check if products already exist
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        # Retrieve category IDs
        cursor.execute("SELECT id, slug FROM categories")
        cat_map = {row["slug"]: row["id"] for row in cursor.fetchall()}

        products = [
            (
                "Creston Royal Navy Executive Wool Suit",
                "creston-royal-navy-executive-wool-suit",
                cat_map.get("mens-suits", 1),
                "Handcrafted from 100% fine Italian merino wool. Double-vented back, modern slim silhouette, breathable inner lining. Ideal for executive boardrooms, keynote conferences, and formal celebrations.",
                12500.0, 15000.0, 7500.0, 18,
                "38R, 40R, 42R, 44R, 46R", "Navy Blue, Charcoal, Deep Black",
                "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80",
                now_str, now_str
            ),
            (
                "Emerald Satin Silhouette Evening Gown",
                "emerald-satin-silhouette-evening-gown",
                cat_map.get("womens-dresses", 2),
                "Luxurious heavyweight satin finish with an asymmetric drape, cowl neckline, and concealed rear zip. Designed to radiate poise and grace for galas, weddings, and formal dinner galas.",
                8800.0, 10500.0, 4800.0, 14,
                "XS, S, M, L, XL", "Emerald Green, Ruby Red, Champagne Gold",
                "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80",
                now_str, now_str
            ),
            (
                "Nairobi Slim-Fit Oxford Cotton Shirt",
                "nairobi-slim-fit-oxford-cotton-shirt",
                cat_map.get("office-wear", 3),
                "Woven with 100% Egyptian long-staple cotton with easy-iron technology. Button-down collar, reinforced mother-of-pearl buttons, and tailored cuffs.",
                3200.0, 3900.0, 1700.0, 35,
                "S, M, L, XL, XXL", "Crisp White, Sky Blue, Soft Pink",
                "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80",
                now_str, now_str
            ),
            (
                "Savannah Heritage Jacquard African Print Blazer",
                "savannah-heritage-jacquard-african-print-blazer",
                cat_map.get("mens-suits", 1),
                "A signature Creston piece fusing classic British tailoring with authentic African jacquard motifs. Silk lapel trim, double-breasted buttoning, and interior pocket embroidery.",
                9500.0, 11800.0, 5200.0, 12,
                "38R, 40R, 42R, 44R", "Gold/Black, Teal/Bronze",
                "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
                now_str, now_str
            ),
            (
                "Executive Pleated High-Waist Trousers",
                "executive-pleated-high-waist-trousers",
                cat_map.get("womens-dresses", 2),
                "Modern tailored silhouette with crisp pleats, belt loops, and an ultra-comfortable stretch blend. Elegant drape that pairs effortlessly with blouses and fitted blazers.",
                4500.0, 5500.0, 2200.0, 22,
                "UK 8, UK 10, UK 12, UK 14, UK 16", "Ivory, Camel, Midnight Black",
                "https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&w=800&q=80",
                now_str, now_str
            ),
            (
                "Signature Heavyweight Cotton Creston Tee",
                "signature-heavyweight-cotton-creston-tee",
                cat_map.get("casual-streetwear", 4),
                "280 GSM heavyweight combed cotton with ribbed crewneck collar and subtle embroidered Creston crest on chest. Pre-shrunk for an enduring fit wash after wash.",
                2200.0, 2700.0, 1100.0, 48,
                "S, M, L, XL, XXL", "Black, Heather Grey, Forest Green, Cream",
                "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
                now_str, now_str
            ),
            (
                "Handcrafted Italian Leather Penny Loafers",
                "handcrafted-italian-leather-penny-loafers",
                cat_map.get("footwear", 5),
                "Full-grain calfskin leather polished to a mirror shine. Goodyear welted leather soles with rubber grip inserts for maximum all-day boardroom comfort.",
                8500.0, 10200.0, 4600.0, 16,
                "40, 41, 42, 43, 44, 45", "Cognac Brown, Onyx Black, Oxblood",
                "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=800&q=80",
                now_str, now_str
            ),
            (
                "Full-Grain Reversible Leather Dress Belt",
                "full-grain-reversible-leather-dress-belt",
                cat_map.get("accessories", 6),
                "Genuine top-tier leather with a swiveling brushed alloy buckle. Reversible between Executive Black and Warm Saddle Brown for versatile styling.",
                2800.0, 3500.0, 1300.0, 30,
                "32-34, 36-38, 40-42", "Black/Brown Reversible",
                "https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=800&q=80",
                now_str, now_str
            )
        ]

        cursor.executemany("""
            INSERT INTO products (
                name, slug, category_id, description, price, original_price, cost_price,
                stock_quantity, sizes, colors, image_url, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, products)

    # Check if orders exist; seed a couple of sample orders for today's sales report
    cursor.execute("SELECT COUNT(*) FROM orders")
    if cursor.fetchone()[0] == 0:
        today_date = date.today().isoformat()
        # Seed 2 realistic orders today
        order_1 = (
            "CP-2026-8801", 2, "Wambui Kamau", "+254712345678", "wambui@gmail.com",
            "Nairobi", "Westlands", "Rhapta Road, Court 12", "Deliver at gate",
            12500.0, 200.0, 12700.0, "mpesa_till", "Paid", "SJE89201LK", "Processing",
            0, None, f"{today_date}T09:15:20"
        )
        cursor.execute("""
            INSERT INTO orders (
                order_number, user_id, customer_name, customer_phone, customer_email,
                delivery_county, delivery_town, delivery_address, delivery_notes,
                subtotal, shipping_fee, total_amount, payment_method, payment_status,
                mpesa_code, order_status, is_voided, void_reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, order_1)
        order_1_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO order_items (order_id, product_id, product_name, size, color, unit_price, quantity, subtotal)
            VALUES (?, 1, 'Creston Royal Navy Executive Wool Suit', '42R', 'Navy Blue', 12500.0, 1, 12500.0)
        """, (order_1_id,))

        order_2 = (
            "CP-2026-8802", None, "David Omondi", "+254722334455", "omondi.d@gmail.com",
            "Mombasa", "Nyali", "Links Road, Beachside Apts, Flat 3", "Call upon arrival",
            6400.0, 450.0, 6850.0, "mpesa_stk", "Paid", "SKK39012AA", "Processing",
            0, None, f"{today_date}T11:42:10"
        )
        cursor.execute("""
            INSERT INTO orders (
                order_number, user_id, customer_name, customer_phone, customer_email,
                delivery_county, delivery_town, delivery_address, delivery_notes,
                subtotal, shipping_fee, total_amount, payment_method, payment_status,
                mpesa_code, order_status, is_voided, void_reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, order_2)
        order_2_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO order_items (order_id, product_id, product_name, size, color, unit_price, quantity, subtotal)
            VALUES (?, 3, 'Nairobi Slim-Fit Oxford Cotton Shirt', 'L', 'Crisp White', 3200.0, 2, 6400.0)
        """, (order_2_id,))

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
