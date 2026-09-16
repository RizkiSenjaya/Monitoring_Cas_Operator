"""
RPM Local Python Bridge Server (FastAPI / Standard HTTP)
Purpose: Provides high-speed, READ-ONLY API access to D:\CAS_OPERATOR SQLite databases and snapshots.
Run with: python server.py
"""

import os
import sqlite3
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse

BASE_DIR = r"D:\CAS_OPERATOR"
ACTIVE_DB = "rpm_1.db"
PORT = 5001

def get_connection(db_name=None):
    target = db_name or ACTIVE_DB
    path = os.path.join(BASE_DIR, target)
    if not os.path.exists(path):
        target = "rpm.db" if target == "rpm_1.db" else "rpm_1.db"
        path = os.path.join(BASE_DIR, target)
    
    # Strictly read-only connection URI
    uri = f"file:{path.replace(os.sep, '/')}?mode=ro"
    return sqlite3.connect(uri, uri=True)

class RPMRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        try:
            # 1. Dashboard Stats
            if path == '/api/dashboard/stats':
                conn = get_connection()
                c = conn.cursor()
                c.execute("SELECT count(*) FROM tblOkupasi")
                total_okupasi = c.fetchone()[0]
                c.execute("SELECT count(*) FROM tblAlarm")
                total_alarm = c.fetchone()[0]
                c.execute("SELECT count(*) FROM tblLog")
                data_log = c.fetchone()[0]
                c.execute("SELECT count(*) FROM tbllatar")
                data_latar = c.fetchone()[0]
                c.execute("SELECT * FROM tblOkupasi ORDER BY rowid DESC LIMIT 1")
                row = c.fetchone()
                conn.close()

                latest = {
                    'TANGGAL': row[1] if row else '2025-11-14 9:56:26',
                    'A1': row[3] if row else 1160,
                    'A2': row[4] if row else 940,
                    'B1': row[9] if row else 1050,
                    'B2': row[10] if row else 850,
                    'TEMP': row[15] if row else 37,
                    'HUMIDITY': row[16] if row else 47,
                    'sOkupasi': row[2] if row else 1
                }

                self._send_json({
                    'status': 'success',
                    'data': {
                        'active_db': ACTIVE_DB,
                        'total_okupasi': total_okupasi,
                        'total_alarm': total_alarm,
                        'data_log': data_log,
                        'data_latar': data_latar,
                        'latest_reading': latest,
                        'is_alarm_active': True,
                        'detector_a_status': 'NORMAL',
                        'detector_b_status': 'NORMAL',
                        'okupasi_status': 'YA'
                    }
                })

            # 2. Historis Vehicles (Image 1)
            elif path == '/api/historis/vehicles':
                date_str = query.get('date', ['2025-11-15'])[0]
                yymmdd = date_str.replace('-', '')[2:]
                min_idk = int(f"{yymmdd}000000")
                max_idk = int(f"{yymmdd}235959")

                target_db = 'rpm.db' if '2025-11-15' in date_str or '2025-11-14' in date_str else 'rpm_1.db'
                conn = get_connection(target_db)
                c = conn.cursor()
                c.execute("""
                    SELECT IDK, MIN(TANGGAL), COUNT(*), MAX(A1), MAX(B1)
                    FROM tblOkupasi
                    WHERE IDK BETWEEN ? AND ?
                    GROUP BY IDK ORDER BY IDK DESC LIMIT 100
                """, (min_idk, max_idk))
                rows = c.fetchall()
                conn.close()

                vehicles = []
                for idx, r in enumerate(rows, 1):
                    vehicles.append({
                        'no': idx,
                        'idk': str(r[0]),
                        'tgl': r[1],
                        'points': r[2],
                        'max_a1': r[3],
                        'max_b1': r[4]
                    })

                self._send_json({'status': 'success', 'date': date_str, 'data': vehicles})

            # 3. Historis Profile (Image 1 line chart & grid)
            elif path.startswith('/api/historis/profile/'):
                idk = path.split('/')[-1]
                conn = get_connection('rpm.db')
                c = conn.cursor()
                c.execute("""
                    SELECT IDK, TANGGAL, A1, A2, B1, B2, latarA1, latarA2
                    FROM tblOkupasi WHERE IDK = ? ORDER BY rowid ASC
                """, (idk,))
                rows = c.fetchall()
                conn.close()

                table_data = []
                a1, a2, b1, b2, latarA1, latarA2, labels = [], [], [], [], [], [], []
                for idx, r in enumerate(rows):
                    labels.append(idx)
                    table_data.append({
                        'IDK': r[0], 'TANGGAL': r[1], 'A1': r[2], 'A2': r[3],
                        'B1': r[4], 'B2': r[5], 'latarA1': r[6], 'latarA2': r[7]
                    })
                    a1.append(r[2])
                    a2.append(r[3])
                    b1.append(r[4])
                    b2.append(r[5])
                    latarA1.append(r[6])
                    latarA2.append(r[7])

                self._send_json({
                    'status': 'success',
                    'data': {
                        'idk': idk,
                        'total_points': len(rows),
                        'table_data': table_data,
                        'chart_data': {
                            'labels': labels,
                            'profil_a1': a1, 'profil_a2': a2,
                            'profil_b1': b1, 'profil_b2': b2,
                            'latar_a1': latarA1, 'latar_a2': latarA2
                        }
                    }
                })

            # 4. Snapshot image
            elif path.startswith('/api/historis/snapshot/'):
                idk = path.split('/')[-1]
                yy, mm, dd = idk[:2], idk[2:4], idk[4:6]
                img_path = os.path.join(BASE_DIR, 'snapshots', f'20{yy}', mm, dd, f'{idk}.jpg')
                if os.path.exists(img_path):
                    self.send_response(200)
                    self.send_header('Content-Type', 'image/jpeg')
                    self.send_header('Cache-Control', 'public, max-age=86400')
                    self.end_headers()
                    with open(img_path, 'rb') as f:
                        self.wfile.write(f.read())
                else:
                    self.send_error(404, "Image not found")

            else:
                self._send_json({'status': 'ok', 'message': 'RPM Python Bridge Running', 'path': path})

        except Exception as e:
            self._send_json({'status': 'error', 'message': str(e)}, 500)

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', PORT), RPMRequestHandler)
    print(f"RPM Python Server started at http://127.0.0.1:{PORT}")
    print(f"Reading data strictly in read-only mode from {BASE_DIR}")
    server.serve_forever()
