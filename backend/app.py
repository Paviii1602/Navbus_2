import os, math, time, json, hashlib
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash,check_password_hash
from flask_jwt_extended import (JWTManager, create_access_token,jwt_required, get_jwt_identity )

# ── App Setup ─────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, 'static_frontend')

app = Flask(__name__)
app.config['JWT_SECRET_KEY']                  = os.getenv('JWT_SECRET_KEY', 'navbus-super-secret-2024')
app.config['SQLALCHEMY_DATABASE_URI']     = f"sqlite:///{os.path.join(BASE_DIR, 'navbus.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app, resources={r"/api/*": {"origins": "*"}})
db       = SQLAlchemy(app)
socketio = SocketIO(app,
                    cors_allowed_origins="*",
                    async_mode='eventlet',
                    ping_timeout=20,
                    ping_interval=10,
                    logger=False,
                    engineio_logger=False)
jwt = JWTManager(app)

def get_db_connection():
    db_path = os.getenv('DATABASE_URL', 'database.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

# ── Models ────────────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = 'users'
    id         = db.Column(db.Integer, primary_key=True)
    username   = db.Column(db.String(80), unique=True, nullable=False)
    password   = db.Column(db.String(200), nullable=False)
    role       = db.Column(db.String(20), default='passenger')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Route(db.Model):
    __tablename__ = 'routes'
    id          = db.Column(db.Integer, primary_key=True)
    route_name  = db.Column(db.String(200), nullable=False)
    start_point = db.Column(db.String(100), nullable=False)
    end_point   = db.Column(db.String(100), nullable=False)
    stops       = db.relationship('Stop', backref='route', lazy=True,
                                  order_by='Stop.order')
    buses       = db.relationship('Bus', backref='route', lazy=True)

class Stop(db.Model):
    __tablename__ = 'stops'
    id       = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=False)
    name     = db.Column(db.String(100), nullable=False)
    lat      = db.Column(db.Float, nullable=False)
    lng      = db.Column(db.Float, nullable=False)
    order    = db.Column(db.Integer, nullable=False)

class Bus(db.Model):
    __tablename__ = 'buses'
    id              = db.Column(db.Integer, primary_key=True)
    name            = db.Column(db.String(100), nullable=False)
    bus_number      = db.Column(db.String(50),  nullable=False)
    route_id        = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=False)
    operating_hours = db.Column(db.String(50),  default='5:00 - 21:00')
    schedule_json   = db.Column(db.Text, default='[]')
    live_lat        = db.Column(db.Float,    nullable=True)
    live_lng        = db.Column(db.Float,    nullable=True)
    live_speed      = db.Column(db.Float,    nullable=True)
    live_updated_at = db.Column(db.DateTime, nullable=True)
    source_type     = db.Column(db.String(20), default='schedule')
    is_active       = db.Column(db.Boolean,  default=False)

    def get_schedule(self):
        return json.loads(self.schedule_json)

class ActiveTrip(db.Model):
    __tablename__ = 'active_trips'
    id          = db.Column(db.Integer, primary_key=True)
    driver_id   = db.Column(db.Integer, db.ForeignKey('users.id'),   nullable=False)
    bus_id      = db.Column(db.Integer, db.ForeignKey('buses.id'),   nullable=False)
    route_id    = db.Column(db.Integer, db.ForeignKey('routes.id'),  nullable=False)
    started_at  = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at    = db.Column(db.DateTime, nullable=True)
    is_active   = db.Column(db.Boolean,  default=True)
    current_lat = db.Column(db.Float,    nullable=True)
    current_lng = db.Column(db.Float,    nullable=True)
    current_speed = db.Column(db.Float,  nullable=True)

# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_pw(p):
    return hashlib.sha256(p.encode()).hexdigest()

def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    d1 = math.radians(lat2 - lat1)
    d2 = math.radians(lng2 - lng1)
    a  = math.sin(d1/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d2/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def nearest_stop_idx(stops, bus_lat, bus_lng):
    """Return index of the stop physically closest to the bus GPS position."""
    if not bus_lat or not bus_lng or not stops:
        return -1
    best, best_d = 0, float('inf')
    for i, s in enumerate(stops):
        d = haversine(bus_lat, bus_lng, s.lat, s.lng)
        if d < best_d:
            best, best_d = i, d
    return best

def route_eta(stops, bus_lat, bus_lng, bus_speed, cur_idx):
    """
    Build the ETA list for all stops.
    - Stops before cur_idx  → status='passed'
    - Stop at cur_idx       → status='arriving'
    - Stops after cur_idx   → status='upcoming', ETA from along-route distance
    """
    speed = bus_speed if bus_speed and bus_speed > 2 else 20
    result = []
    for i, s in enumerate(stops):
        if i < cur_idx:
            result.append({'order': s.order, 'name': s.name,
                           'lat': s.lat, 'lng': s.lng,
                           'status': 'passed', 'eta_minutes': None, 'distance_km': None})
        elif i == cur_idx:
            d = haversine(bus_lat, bus_lng, s.lat, s.lng)
            result.append({'order': s.order, 'name': s.name,
                           'lat': s.lat, 'lng': s.lng,
                           'status': 'arriving', 'eta_minutes': 0, 'distance_km': round(d, 2)})
        else:
            # sum segment distances along route from bus → cur_stop → this stop
            d = haversine(bus_lat, bus_lng, stops[cur_idx].lat, stops[cur_idx].lng)
            for j in range(cur_idx, i):
                d += haversine(stops[j].lat, stops[j].lng, stops[j+1].lat, stops[j+1].lng)
            eta = max(1, round(d / speed * 60))
            result.append({'order': s.order, 'name': s.name,
                           'lat': s.lat, 'lng': s.lng,
                           'status': 'upcoming', 'eta_minutes': eta, 'distance_km': round(d, 2)})
    return result

def get_next_departure(schedule):
    now_m = datetime.now().hour * 60 + datetime.now().minute
    for t in schedule:
        h, m = map(int, t.split(':'))
        if h * 60 + m > now_m:
            return t
    return schedule[0] if schedule else None

def schedule_with_status(schedule):
    now_m = datetime.now().hour * 60 + datetime.now().minute
    result, found_next = [], False
    for t in schedule:
        h, m = map(int, t.split(':'))
        dep  = h * 60 + m
        if dep < now_m:
            result.append({'time': t, 'status': 'past'})
        elif not found_next:
            result.append({'time': t, 'status': 'next'})
            found_next = True
        else:
            result.append({'time': t, 'status': 'future'})
    return result

def bus_is_live(bus):
    """True only when a driver/passenger updated GPS in the last 5 minutes."""
    if not bus.is_active or not bus.live_lat or not bus.live_lng:
        return False
    if not bus.live_updated_at:
        return False
    age = (datetime.utcnow() - bus.live_updated_at).total_seconds()
    return age < 300   # 5 minutes

def push_bus_update(bus_id, payload):
    """Emit a real-time update to all passengers watching this bus."""
    socketio.emit('bus_update', payload, room=f'bus_{bus_id}')

# ── AUTH ──────────────────────────────────────────────────────────────────────

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    role     = data.get('role')

    if not username or not password or not role:
        return jsonify({'error': 'Missing fields'}), 400

    conn = get_db_connection()
    try:
        conn.execute(
           "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            (username,generate_password_hash(password), role)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Username already exists. Please choose a different one.'}), 400
    conn.close()
    return jsonify({'message': 'User registered successfully'})

@app.route('/api/login', methods=['POST'])
def login():
    data     = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    conn = get_db_connection()
    user = conn.execute(
        "SELECT * FROM users WHERE username = ?",
        (username,)
    ).fetchone()
    if user and not check_password_hash(user['password'], password):
        user = None
        conn.close()

    if user:
        token = create_access_token(identity={
            'username': user['username'],
            'role':     user['role']
        })
        return jsonify({'message':  'Login successful',
                        'username': user['username'],
                        'role':     user['role'],
                        'token':    token})    
    return jsonify({'error': 'Invalid credentials'}), 401

# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.route('/api/routes', methods=['GET'])
def get_routes():
    return jsonify([{'id': r.id, 'route_name': r.route_name,
                     'start_point': r.start_point, 'end_point': r.end_point,
                     'stop_count': len(r.stops)} for r in Route.query.all()])

@app.route('/api/routes/<int:rid>', methods=['GET'])
def get_route(rid):
    r = db.session.get(Route, rid)
    if not r:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({
        'id': r.id, 'route_name': r.route_name,
        'start_point': r.start_point, 'end_point': r.end_point,
        'stops': [{'id': s.id, 'name': s.name, 'lat': s.lat,
                   'lng': s.lng, 'order': s.order} for s in r.stops],
        'buses': [{'id': b.id, 'name': b.name, 'bus_number': b.bus_number,
                   'is_active': bus_is_live(b),
                   'source_type': b.source_type} for b in r.buses],
    })

# ── STOPS ─────────────────────────────────────────────────────────────────────

@app.route('/api/stops/all', methods=['GET'])
def all_stops():
    names = sorted({s.name for s in Stop.query.all()})
    return jsonify(names)

@app.route('/api/stops/search', methods=['GET'])
def search_stops():
    frm = request.args.get('from', '').lower()
    to  = request.args.get('to',   '').lower()
    results = []
    for route in Route.query.all():
        names = [s.name.lower() for s in route.stops]
        fi    = next((i for i, n in enumerate(names) if frm in n), None)
        ti    = next((i for i, n in enumerate(names) if to  in n), None)
        if fi is not None and ti is not None and fi < ti:
            seg   = route.stops[fi:ti+1]
            buses = []
            for b in route.buses:
                live  = bus_is_live(b)
                sched = b.get_schedule()
                buses.append({
                    'id': b.id, 'name': b.name, 'bus_number': b.bus_number,
                    'is_active': live,
                    'source_type': b.source_type,
                    'live_lat':  b.live_lat  if live else None,
                    'live_lng':  b.live_lng  if live else None,
                    'next_departure': get_next_departure(sched),
                })
            results.append({
                'route_id':   route.id,
                'route_name': route.route_name,
                'stops':   [{'id': s.id, 'name': s.name, 'lat': s.lat,
                              'lng': s.lng, 'order': s.order} for s in seg],
                'all_stops': [{'id': s.id, 'name': s.name, 'lat': s.lat,
                               'lng': s.lng, 'order': s.order} for s in route.stops],
                'buses': buses,
            })
    return jsonify(results)

# ── BUSES ─────────────────────────────────────────────────────────────────────

@app.route('/api/buses', methods=['GET'])
def get_buses():
    buses, seen = [], set()
    for b in Bus.query.all():
        if b.name in seen:
            continue
        seen.add(b.name)
        sched = b.get_schedule()
        buses.append({
            'id': b.id, 'name': b.name, 'bus_number': b.bus_number,
            'route_id': b.route_id, 'operating_hours': b.operating_hours,
            'is_active': bus_is_live(b), 'source_type': b.source_type,
            'next_departure': get_next_departure(sched),
        })
    return jsonify(buses)

@app.route('/api/buses/<int:bid>', methods=['GET'])
def get_bus(bid):
    b = db.session.get(Bus, bid)
    if not b:
        return jsonify({'error': 'Not found'}), 404
    route  = db.session.get(Route, b.route_id)
    stops  = list(route.stops) if route else []
    live   = bus_is_live(b)
    sched  = b.get_schedule()
    cur_idx = nearest_stop_idx(stops, b.live_lat, b.live_lng) if live else -1
    etas    = route_eta(stops, b.live_lat, b.live_lng, b.live_speed, cur_idx) if live else []
    return jsonify({
        'id': b.id, 'name': b.name, 'bus_number': b.bus_number,
        'route_id': b.route_id,
        'route_name':  route.route_name  if route else '',
        'start_point': route.start_point if route else '',
        'end_point':   route.end_point   if route else '',
        'operating_hours': b.operating_hours,
        'schedule':   schedule_with_status(sched),
        'next_departure': get_next_departure(sched),
        'is_active':   live,
        'source_type': b.source_type,
        'live_lat':    b.live_lat  if live else None,
        'live_lng':    b.live_lng  if live else None,
        'live_speed':  b.live_speed if live else None,
        'stops':  [{'id': s.id, 'name': s.name, 'lat': s.lat,
                    'lng': s.lng, 'order': s.order} for s in stops],
        'eta': etas,
        'current_stop': stops[cur_idx].name if live and cur_idx >= 0 else None,
    })

# Passenger crowdsource location update (REST fallback)
@app.route('/api/buses/<int:bid>/location', methods=['POST'])
def update_location(bid):
    d   = request.json
    bus = db.session.get(Bus, bid)
    if not bus:
        return jsonify({'error': 'Not found'}), 404
    bus.live_lat        = d['lat']
    bus.live_lng        = d['lng']
    bus.live_speed      = d.get('speed', 0)
    bus.live_updated_at = datetime.utcnow()
    bus.source_type     = d.get('source_type', 'crowdsourced')
    bus.is_active       = True
    db.session.commit()
    # Push to WebSocket room
    push_bus_update(bid, {'bus_id': bid, 'lat': bus.live_lat,
                          'lng': bus.live_lng, 'speed': bus.live_speed,
                          'source_type': bus.source_type,
                          'ts': datetime.utcnow().isoformat()})
    return jsonify({'message': 'Updated'})

# ── DRIVER TRIP ───────────────────────────────────────────────────────────────

@app.route('/api/driver/start-trip', methods=['POST'])
def start_trip():
    d   = request.json
    bus = db.session.get(Bus, d['bus_id'])
    if bus:
        bus.is_active   = True
        bus.source_type = 'driver_live'
    trip = ActiveTrip(driver_id=d['driver_id'],
                      bus_id=d['bus_id'], route_id=d['route_id'])
    db.session.add(trip)
    db.session.commit()
    return jsonify({'trip_id': trip.id})

@app.route('/api/driver/update-location', methods=['POST'])
def driver_update():
    d    = request.json
    trip = ActiveTrip.query.filter_by(id=d['trip_id'], is_active=True).first()
    if not trip:
        return jsonify({'error': 'No active trip'}), 404
    trip.current_lat   = d['lat']
    trip.current_lng   = d['lng']
    trip.current_speed = d.get('speed', 0)
    bus = db.session.get(Bus, trip.bus_id)
    if bus:
        bus.live_lat        = d['lat']
        bus.live_lng        = d['lng']
        bus.live_speed      = d.get('speed', 0)
        bus.live_updated_at = datetime.utcnow()
        bus.source_type     = 'driver_live'
        bus.is_active       = True
    db.session.commit()
    push_bus_update(trip.bus_id, {
        'bus_id': trip.bus_id, 'lat': d['lat'], 'lng': d['lng'],
        'speed': d.get('speed', 0), 'source_type': 'driver_live',
        'ts': datetime.utcnow().isoformat()
    })
    return jsonify({'message': 'Updated'})

@app.route('/api/driver/end-trip', methods=['POST'])
def end_trip():
    d    = request.json
    trip = ActiveTrip.query.filter_by(id=d['trip_id'], is_active=True).first()
    if not trip:
        return jsonify({'error': 'Not found'}), 404
    trip.is_active = False
    trip.ended_at  = datetime.utcnow()
    bus = db.session.get(Bus, trip.bus_id)
    if bus:
        bus.is_active       = False
        bus.source_type     = 'schedule'
        bus.live_lat        = None
        bus.live_lng        = None
        bus.live_speed      = None
        bus.live_updated_at = None
    db.session.commit()
    push_bus_update(trip.bus_id, {'bus_id': trip.bus_id, 'source_type': 'schedule',
                                   'is_active': False})
    return jsonify({'message': 'Trip ended'})

# ── WEBSOCKET EVENTS ──────────────────────────────────────────────────────────

@socketio.on('connect')
def on_connect():
    emit('connected', {'msg': 'NavBus live'})

@socketio.on('watch_bus')
def on_watch(data):
    """Passenger joins a room to receive live updates for one bus."""
    bus_id = data.get('bus_id')
    if bus_id:
        join_room(f'bus_{bus_id}')
        # Immediately send current state
        bus = db.session.get(Bus, int(bus_id))
        if bus and bus_is_live(bus):
            emit('bus_update', {
                'bus_id': bus_id, 'lat': bus.live_lat, 'lng': bus.live_lng,
                'speed': bus.live_speed, 'source_type': bus.source_type,
                'ts': bus.live_updated_at.isoformat() if bus.live_updated_at else None,
            })

@socketio.on('driver_location')
def on_driver_location(data):
    """Driver sends GPS via WebSocket — faster than REST."""
    bus_id = data.get('bus_id')
    lat    = data.get('lat')
    lng    = data.get('lng')
    speed  = data.get('speed', 0)
    if not all([bus_id, lat, lng]):
        return
    with app.app_context():
        bus = db.session.get(Bus, int(bus_id))
        if bus:
            bus.live_lat        = lat
            bus.live_lng        = lng
            bus.live_speed      = speed
            bus.live_updated_at = datetime.utcnow()
            bus.source_type     = 'driver_live'
            bus.is_active       = True
            db.session.commit()
    # Broadcast to all passengers watching this bus
    emit('bus_update', {'bus_id': bus_id, 'lat': lat, 'lng': lng,
                        'speed': speed, 'source_type': 'driver_live',
                        'ts': datetime.utcnow().isoformat()},
         room=f'bus_{bus_id}')

@socketio.on('unwatch_bus')
def on_unwatch(data):
    bus_id = data.get('bus_id')
    if bus_id:
        leave_room(f'bus_{bus_id}')

@socketio.on('disconnect')
def on_disconnect():
    pass

# ── HEALTH ────────────────────────────────────────────────────────────────────

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'time': datetime.utcnow().isoformat()})

# ── SPA FRONTEND ──────────────────────────────────────────────────────────────

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def spa(path):
    full = os.path.join(FRONTEND_DIR, path)
    if path and os.path.exists(full):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, 'index.html')

# ── DB INIT ───────────────────────────────────────────────────────────────────

def init_db():
    from seed_data import ROUTES, STOPS, BUSES
    db.create_all()
    if Route.query.count() > 0:
        return
    for r in ROUTES:
        db.session.add(Route(**r))
    db.session.commit()
    for route_id, stop_list in STOPS.items():
        for s in stop_list:
            db.session.add(Stop(route_id=s[0], name=s[1],
                                lat=s[2], lng=s[3], order=s[4]))
    db.session.commit()
    for b in BUSES:
        db.session.add(Bus(name=b['name'], bus_number=b['bus_number'],
                           route_id=b['route_id'],
                           operating_hours=b['operating_hours'],
                           schedule_json=json.dumps(b['schedule'])))
    db.session.commit()
    import hashlib
    for username, pw, role in [('passenger','pass123','passenger'),
                                ('driver','driver123','driver')]:
        db.session.add(User(username=username,
                            password=hashlib.sha256(pw.encode()).hexdigest(),
                            role=role))
    db.session.commit()
    print('✅ Database seeded')

if __name__ == '__main__':
    with app.app_context():
        init_db()
    port = int(os.environ.get('PORT', 5000))
    print(f'🚌 NavBus → http://0.0.0.0:{port}')
    socketio.run(app, host='0.0.0.0', port=port,
                 debug=False, allow_unsafe_werkzeug=True)
