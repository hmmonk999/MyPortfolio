"""Static file server for the portfolio preview.

Serves the repo root on the port given by the PORT environment variable so the
preview harness can assign a free port (falls back to 8010 when run by hand).

Uses ThreadingHTTPServer -- a single-threaded server deadlocks on the browser's
keep-alive connection and stylesheets never load. Responses are sent no-store so
a reset or edit is never masked by a stale cached copy.
"""

import functools
import http.server
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8010"))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


http.server.ThreadingHTTPServer.allow_reuse_address = True
handler = functools.partial(Handler, directory=ROOT)

with http.server.ThreadingHTTPServer(("", PORT), handler) as httpd:
    print("serving {} at http://localhost:{}".format(ROOT, PORT), flush=True)
    httpd.serve_forever()
