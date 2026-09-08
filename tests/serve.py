from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/jj-trading-hub/'):
            self.path = self.path[len('/jj-trading-hub'):]
        super().do_GET()

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1] / 'dist'
    ThreadingHTTPServer(('127.0.0.1', 5174), partial(Handler, directory=str(root))).serve_forever()
