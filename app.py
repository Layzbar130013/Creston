"""
CRESTON PREMIUM COLLECTIONS - Application Server
Multi-threaded Python HTTP Server serving REST API and responsive frontend assets.
Motto: Quality, Style, Trust
"""

import sys
import os
import json
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs

# Ensure server package can import local modules
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")

if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from db import init_db
from api import handle_api_request

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handles HTTP requests asynchronously in separate threads."""
    daemon_threads = True

class CrestonRequestHandler(SimpleHTTPRequestHandler):
    """Custom HTTP request handler for Creston Premium Collections."""

    def __init__(self, *args, **kwargs):
        # Override directory for serving static files
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def _set_cors_headers(self):
        """Sets standard CORS headers."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Auth-Token")

    def do_OPTIONS(self):
        """Handles CORS preflight requests."""
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # If it's an API route, delegate to handle_api_request
        if path.startswith("/api/"):
            self._handle_api("GET", parsed)
            return

        # URL Rewrite: /admin routes to /admin.html
        if path == "/admin" or path == "/admin/":
            self.path = "/admin.html"
        elif path == "/" or path == "":
            self.path = "/index.html"

        # Serve static file
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._handle_api("POST", parsed)
        else:
            self.send_error(405, "Method Not Allowed")

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._handle_api("PUT", parsed)
        else:
            self.send_error(405, "Method Not Allowed")

    def do_PATCH(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._handle_api("PATCH", parsed)
        else:
            self.send_error(405, "Method Not Allowed")

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._handle_api("DELETE", parsed)
        else:
            self.send_error(405, "Method Not Allowed")

    def _handle_api(self, method: str, parsed):
        path = parsed.path
        query_params = parse_qs(parsed.query)

        # Parse request body
        content_length = int(self.headers.get("Content-Length", 0))
        body = {}
        if content_length > 0:
            raw_body = self.rfile.read(content_length).decode("utf-8")
            try:
                body = json.loads(raw_body)
            except Exception:
                body = {}

        # Extract Auth Token
        auth_header = self.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        elif self.headers.get("X-Auth-Token"):
            token = self.headers.get("X-Auth-Token").strip()

        # Call API controller
        status_code, headers, response_data = handle_api_request(
            method=method,
            path=path,
            query_params=query_params,
            body=body,
            auth_token=token
        )

        self.send_response(status_code)
        self._set_cors_headers()
        for k, v in headers.items():
            self.send_header(k, v)
        self.end_headers()

        if isinstance(response_data, str):
            self.wfile.write(response_data.encode("utf-8"))
        elif isinstance(response_data, bytes):
            self.wfile.write(response_data)

def run_server(port: int = 8000, host: str = "0.0.0.0"):
    """Starts the CRESTON server."""
    init_db()
    server_address = (host, port)
    httpd = ThreadedHTTPServer(server_address, CrestonRequestHandler)
    print(f"==================================================")
    print(f"  CRESTON PREMIUM COLLECTIONS - STORE ENGINE")
    print(f"  Motto: Quality, Style, Trust")
    print(f"  Customer Storefront: http://localhost:{port}/")
    print(f"  Admin Management:    http://localhost:{port}/admin.html")
    print(f"  Default Admin:       admin@creston.co.ke / Admin@123")
    print(f"  Default Customer:    wambui@gmail.com / User@123")
    print(f"==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down gracefully...")
        httpd.shutdown()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    if len(sys.argv) > 2:
        host = sys.argv[2]
    run_server(port, host)
