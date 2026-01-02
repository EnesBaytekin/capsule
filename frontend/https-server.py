#!/usr/bin/env python3
import ssl
import http.server
import socketserver
import os
from pathlib import Path

PORT = 3443
CERT_FILE = Path(__file__).parent / 'certs' / 'cert.pem'
KEY_FILE = Path(__file__).parent / 'certs' / 'key.pem'
DIRECTORY = Path(__file__).parent / 'static'

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Disable CSP to allow crypto API
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline';")
        super().end_headers()

ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(CERT_FILE, KEY_FILE)

with socketserver.TCPServer(("0.0.0.0", PORT), MyHTTPRequestHandler) as httpd:
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print(f"Frontend running on https://localhost:{PORT}")
    print(f"Access from other machines: https://<YOUR_IP>:{PORT}")
    print("Accept the self-signed certificate warning in your browser!")
    httpd.serve_forever()
