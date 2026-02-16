#!/usr/bin/env python3
"""Simple local static file server for testing the app."""

from __future__ import annotations

import argparse
import os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Serve files with disabled cache to make frontend iteration easier."""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a simple static file server.")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    parser.add_argument(
        "--dir",
        default=".",
        help="Directory to serve (default: current directory)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    web_dir = os.path.abspath(args.dir)
    os.chdir(web_dir)

    server = ThreadingHTTPServer((args.host, args.port), NoCacheHandler)
    print(f"Serving {web_dir}")
    print(f"URL: http://{args.host}:{args.port}")
    print("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
