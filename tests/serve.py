from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/jj-trading-hub/'):
            self.path = self.path[len('/jj-trading-hub'):]
        super().do_GET()

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1] / 'dist'
    port = int(os.environ.get('PORT', '5174'))
    ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory=str(root))).serve_forever()
