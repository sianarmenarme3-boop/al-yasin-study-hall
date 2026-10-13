import os, sqlite3, secrets
from datetime import datetime
from functools import wraps
from flask import Flask, g, jsonify, request, session, send_from_directory

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DATA_DIR", ROOT)
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "al_yasin.db")
app = Flask(__name__, static_folder="static")
app.secret_key = os.environ.get("SESSION_SECRET", secrets.token_hex(32))
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE","0")=="1")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(_):
    conn = g.pop("db", None)
    if conn: conn.close()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS tables_status(number INTEGER PRIMARY KEY, occupied INTEGER NOT NULL DEFAULT 0)")
    conn.execute("CREATE TABLE IF NOT EXISTS lockers(number INTEGER PRIMARY KEY, occupied INTEGER NOT NULL DEFAULT 0, person TEXT NOT NULL DEFAULT '')")
    conn.execute("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    conn.execute("CREATE TABLE IF NOT EXISTS notices(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, created_at TEXT NOT NULL)")
    conn.executemany("INSERT OR IGNORE INTO tables_status(number,occupied) VALUES (?,0)", [(i,) for i in range(1,31)])
    conn.executemany("INSERT OR IGNORE INTO lockers(number,occupied,person) VALUES (?,0,'')", [(i,) for i in range(1,90)])
    conn.execute("INSERT OR IGNORE INTO settings(key,value) VALUES('power','on')")
    conn.execute("INSERT OR IGNORE INTO settings(key,value) VALUES('power_note','')")
    conn.commit(); conn.close()

def admin_required(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not session.get("admin"): return jsonify(error="ابتدا وارد پنل مدیر شوید."), 401
        return fn(*args, **kwargs)
    return wrapped

@app.get("/")
def index(): return send_from_directory("static", "index.html")

@app.get("/api/status")
def status():
    conn = get_db()
    tables = [dict(r) for r in conn.execute("SELECT number,occupied FROM tables_status ORDER BY number")]
    # Public visitors only see locker availability, never names.
    lockers = [dict(r) for r in conn.execute("SELECT number,occupied FROM lockers ORDER BY number")]
    settings = {r["key"]:r["value"] for r in conn.execute("SELECT key,value FROM settings")}
    notices = [dict(r) for r in conn.execute("SELECT id,text,created_at FROM notices ORDER BY id DESC LIMIT 5")]
    return jsonify(tables=tables, lockers=lockers, power=settings.get("power","on"),
                   power_note=settings.get("power_note",""), notices=notices,
                   updated=datetime.now().astimezone().isoformat(timespec="minutes"))

@app.post("/api/login")
def login():
    if not ADMIN_PASSWORD: return jsonify(error="مدیر سایت هنوز رمز را در متغیر محیطی ADMIN_PASSWORD تنظیم نکرده است."), 503
    data=request.get_json(silent=True) or {}
    if secrets.compare_digest(str(data.get("password","")), ADMIN_PASSWORD):
        session.clear(); session["admin"]=True
        return jsonify(ok=True)
    return jsonify(error="رمز ورود اشتباه است."), 403

@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)

@app.get("/api/admin/lockers")
@admin_required
def admin_lockers():
    return jsonify(lockers=[dict(r) for r in get_db().execute("SELECT number,occupied,person FROM lockers ORDER BY number")])

@app.post("/api/tables")
@admin_required
def set_table():
    data=request.get_json(silent=True) or {}
    try: number=int(data["number"]); occupied=int(bool(data["occupied"]))
    except (KeyError,ValueError,TypeError): return jsonify(error="اطلاعات میز معتبر نیست."),400
    if not 1<=number<=30: return jsonify(error="شماره میز باید بین ۱ تا ۳۰ باشد."),400
    get_db().execute("UPDATE tables_status SET occupied=? WHERE number=?",(occupied,number)); get_db().commit()
    return jsonify(ok=True)

@app.post("/api/lockers")
@admin_required
def set_locker():
    data=request.get_json(silent=True) or {}
    try: number=int(data["number"]); occupied=int(bool(data["occupied"])); person=str(data.get("person","")).strip()
    except (KeyError,ValueError,TypeError): return jsonify(error="اطلاعات کمد معتبر نیست."),400
    if not 1<=number<=89: return jsonify(error="شماره کمد باید بین ۱ تا ۸۹ باشد."),400
    if len(person)>100: return jsonify(error="نام بیش از حد طولانی است."),400
    if not occupied: person=""
    get_db().execute("UPDATE lockers SET occupied=?,person=? WHERE number=?",(occupied,person,number)); get_db().commit()
    return jsonify(ok=True)

@app.post("/api/power")
@admin_required
def set_power():
    data=request.get_json(silent=True) or {}
    power="on" if data.get("power")=="on" else "off"
    note=str(data.get("note","")).strip()[:300]
    conn=get_db(); conn.execute("UPDATE settings SET value=? WHERE key='power'",(power,))
    conn.execute("UPDATE settings SET value=? WHERE key='power_note'",(note,)); conn.commit()
    return jsonify(ok=True)

@app.post("/api/notices")
@admin_required
def add_notice():
    data=request.get_json(silent=True) or {}; message=str(data.get("text","")).strip()
    if not message or len(message)>500: return jsonify(error="متن اطلاعیه باید بین ۱ تا ۵۰۰ نویسه باشد."),400
    conn=get_db(); conn.execute("INSERT INTO notices(text,created_at) VALUES(?,?)",(message,datetime.now().astimezone().isoformat(timespec="minutes"))); conn.commit()
    return jsonify(ok=True)

@app.delete("/api/notices/<int:notice_id>")
@admin_required
def delete_notice(notice_id):
    conn=get_db(); conn.execute("DELETE FROM notices WHERE id=?",(notice_id,)); conn.commit()
    return jsonify(ok=True)

init_db()
if __name__=="__main__":
    app.run(host="0.0.0.0",port=int(os.environ.get("PORT","10000")),debug=False)
