from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Query, Header
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os, logging, uuid, json, re, math, secrets as pysecrets
import bcrypt, jwt, requests, httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ['JWT_SECRET']
EMERGENT_KEY = os.environ['EMERGENT_LLM_KEY']
APP_NAME = os.environ.get('APP_NAME', 'silver-pt')
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}

api = APIRouter(prefix="/api")


# ---------- helpers ----------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def ser(doc: Optional[dict]) -> Optional[dict]:
    """Mongo document -> JSON-safe dict with `id`."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v)
        elif k == "password_hash":
            continue
        elif isinstance(v, ObjectId):
            out[k] = str(v)
        else:
            out[k] = v
    return out


def oid(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(404, "Non trovato")


# ---------- storage ----------
storage_key = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    r.raise_for_status()
    storage_key = r.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=300)
    r.raise_for_status()
    return r.json()


def get_object(path: str):
    key = init_storage()
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=120)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# ---------- auth ----------
def make_token(user_id: str, role: str) -> str:
    n = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "role": role, "iat": n, "exp": n + timedelta(days=30)}, JWT_SECRET, algorithm="HS256")


async def user_from_token(token: str) -> dict:
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Sessione scaduta")
    user = await db.users.find_one({"_id": oid(claims["sub"])})
    if not user:
        raise HTTPException(401, "Utente non trovato")
    return user


async def current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Non autenticato")
    return await user_from_token(authorization.split(" ", 1)[1])


async def require_trainer(user=Depends(current_user)):
    if user["role"] != "trainer":
        raise HTTPException(403, "Solo per il trainer")
    return user


async def assert_access(user: dict, client_id: str) -> dict:
    """Trainer can access own clients, client only themselves. Returns client user doc."""
    c = await db.users.find_one({"_id": oid(client_id), "role": "client"})
    if not c:
        raise HTTPException(404, "Cliente non trovato")
    if user["role"] == "client" and str(user["_id"]) != client_id:
        raise HTTPException(403, "Accesso negato")
    if user["role"] == "trainer" and c.get("trainer_id") != str(user["_id"]):
        raise HTTPException(403, "Accesso negato")
    return c


class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=6)
    name: str
    role: str = "client"
    invite_code: Optional[str] = None


class LoginIn(BaseModel):
    email: str
    password: str


@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email già registrata")
    doc = {"email": email, "name": body.name.strip(), "role": body.role,
           "password_hash": bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(),
           "created_at": now_iso()}
    if body.role == "trainer":
        doc["invite_code"] = pysecrets.token_hex(3).upper()
    elif body.role == "client":
        code = (body.invite_code or "").strip().upper()
        trainer = await db.users.find_one({"role": "trainer", "invite_code": code}) if code else None
        if not trainer:
            raise HTTPException(400, "Codice invito non valido")
        doc["trainer_id"] = str(trainer["_id"])
        doc["profile"] = {}
    else:
        raise HTTPException(400, "Ruolo non valido")
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"access_token": make_token(str(res.inserted_id), doc["role"]), "user": ser(doc)}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.strip().lower()})
    if not user or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "Email o password errati")
    return {"access_token": make_token(str(user["_id"]), user["role"]), "user": ser(user)}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return ser(user)


# ---------- profile / clients ----------
class ProfileIn(BaseModel):
    name: Optional[str] = None
    profile: dict = {}


@api.put("/clients/{client_id}/profile")
async def update_profile(client_id: str, body: ProfileIn, user=Depends(current_user)):
    await assert_access(user, client_id)
    upd = {"profile": body.profile}
    if body.name:
        upd["name"] = body.name
    await db.users.update_one({"_id": oid(client_id)}, {"$set": upd})
    return ser(await db.users.find_one({"_id": oid(client_id)}))


@api.get("/clients")
async def list_clients(user=Depends(require_trainer)):
    docs = await db.users.find({"role": "client", "trainer_id": str(user["_id"])}).sort("name", 1).to_list(1000)
    return [ser(d) for d in docs]


@api.get("/clients/{client_id}")
async def get_client(client_id: str, user=Depends(current_user)):
    return ser(await assert_access(user, client_id))


async def owner_ids(user: dict, client_id: Optional[str]) -> dict:
    """Mongo filter for docs belonging to a client the user may see."""
    if user["role"] == "client":
        return {"client_id": str(user["_id"])}
    if client_id:
        await assert_access(user, client_id)
        return {"client_id": client_id}
    return {"trainer_id": str(user["_id"])}


async def trainer_of(user: dict, client_id: str) -> str:
    c = await assert_access(user, client_id)
    return c["trainer_id"]


# ---------- comments (generic) ----------
class CommentIn(BaseModel):
    text: str


async def add_comment(target: str, target_id: str, user: dict, text: str):
    doc = {"target": target, "target_id": target_id, "author_id": str(user["_id"]), "author_name": user["name"],
           "author_role": user["role"], "text": text, "created_at": now_iso()}
    await db.comments.insert_one(doc)
    return ser(doc)


async def get_comments(target: str, target_id: str):
    docs = await db.comments.find({"target": target, "target_id": target_id}).sort("created_at", 1).to_list(500)
    return [ser(d) for d in docs]


# ---------- appointments ----------
class AppointmentIn(BaseModel):
    client_id: Optional[str] = None
    title: str
    start: str  # ISO
    duration_min: int = 60
    location: Optional[str] = ""
    notes: Optional[str] = ""


@api.post("/appointments")
async def create_appointment(body: AppointmentIn, user=Depends(current_user)):
    cid = str(user["_id"]) if user["role"] == "client" else body.client_id
    if not cid:
        raise HTTPException(400, "Seleziona un cliente")
    c = await assert_access(user, cid)
    doc = body.model_dump()
    doc.update({"client_id": cid, "client_name": c["name"], "trainer_id": c["trainer_id"],
                "status": "confirmed" if user["role"] == "trainer" else "requested", "created_at": now_iso()})
    await db.appointments.insert_one(doc)
    return ser(doc)


@api.get("/appointments")
async def list_appointments(client_id: Optional[str] = None, user=Depends(current_user)):
    f = await owner_ids(user, client_id)
    docs = await db.appointments.find(f).sort("start", 1).to_list(1000)
    return [ser(d) for d in docs]


async def get_appt(appt_id: str, user: dict) -> dict:
    a = await db.appointments.find_one({"_id": oid(appt_id)})
    if not a:
        raise HTTPException(404, "Appuntamento non trovato")
    await assert_access(user, a["client_id"])
    return a


@api.get("/appointments/{appt_id}")
async def appointment_detail(appt_id: str, user=Depends(current_user)):
    a = ser(await get_appt(appt_id, user))
    a["comments"] = await get_comments("appointment", appt_id)
    return a


class StatusIn(BaseModel):
    status: str


@api.put("/appointments/{appt_id}/status")
async def appointment_status(appt_id: str, body: StatusIn, user=Depends(current_user)):
    await get_appt(appt_id, user)
    if body.status not in ("requested", "confirmed", "cancelled", "done"):
        raise HTTPException(400, "Stato non valido")
    await db.appointments.update_one({"_id": oid(appt_id)}, {"$set": {"status": body.status}})
    return {"ok": True}


@api.post("/appointments/{appt_id}/comments")
async def appointment_comment(appt_id: str, body: CommentIn, user=Depends(current_user)):
    await get_appt(appt_id, user)
    return await add_comment("appointment", appt_id, user, body.text)


# ---------- measurements (ISSA) ----------
CIRC_KEYS = ["collo", "spalle", "torace", "braccio_dx", "braccio_sx", "vita", "addome", "fianchi", "coscia_dx", "coscia_sx", "polpaccio_dx", "polpaccio_sx"]
FOLD_KEYS = ["pettorale", "ascellare", "tricipite", "sottoscapolare", "addominale", "soprailiaca", "coscia"]


def body_fat(folds: dict, sex: str, age: float) -> Optional[dict]:
    """Jackson-Pollock 7 or 3 sites + Siri equation (ISSA standard)."""
    f = {}
    for k, v in folds.items():
        try:
            x = float(str(v).replace(",", "."))
        except (TypeError, ValueError):
            raise HTTPException(400, f"Valore plica non valido: {k}")
        if x > 0:
            f[k] = x
    male = sex != "F"
    if not age:
        return None
    if all(k in f for k in FOLD_KEYS):
        s = sum(f[k] for k in FOLD_KEYS)
        d = (1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * age) if male else \
            (1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * age)
        method = "Jackson-Pollock 7 pliche"
    else:
        keys = ["pettorale", "addominale", "coscia"] if male else ["tricipite", "soprailiaca", "coscia"]
        if not all(k in f for k in keys):
            return None
        s = sum(f[k] for k in keys)
        d = (1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * age) if male else \
            (1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * age)
        method = "Jackson-Pollock 3 pliche"
    bf = round((495 / d) - 450, 1)
    return {"body_fat": bf, "sum_folds": round(s, 1), "method": method}


class MeasurementIn(BaseModel):
    client_id: str
    date: str
    weight: Optional[float] = None
    height: Optional[float] = None
    circumferences: dict = {}
    skinfolds: dict = {}
    notes: Optional[str] = ""


@api.post("/measurements")
async def create_measurement(body: MeasurementIn, user=Depends(current_user)):
    c = await assert_access(user, body.client_id)
    prof = c.get("profile") or {}
    age = 0
    if prof.get("birth_date"):
        try:
            age = (datetime.now() - datetime.fromisoformat(prof["birth_date"][:10])).days / 365.25
        except ValueError:
            age = 0
    doc = body.model_dump()
    doc.update({"trainer_id": c["trainer_id"], "created_at": now_iso()})
    bf = body_fat(body.skinfolds, prof.get("sex", "M"), age)
    if bf:
        doc.update(bf)
        if body.weight:
            doc["fat_mass"] = round(body.weight * bf["body_fat"] / 100, 1)
            doc["lean_mass"] = round(body.weight - doc["fat_mass"], 1)
    if body.weight and body.height:
        doc["bmi"] = round(body.weight / ((body.height / 100) ** 2), 1)
    await db.measurements.insert_one(doc)
    return ser(doc)


@api.get("/measurements")
async def list_measurements(client_id: str, user=Depends(current_user)):
    await assert_access(user, client_id)
    docs = await db.measurements.find({"client_id": client_id}).sort([("date", -1), ("created_at", -1)]).to_list(500)
    return [ser(d) for d in docs]


# ---------- workout plans ----------
class PlanIn(BaseModel):
    client_id: str
    name: str = Field(min_length=1)
    notes: Optional[str] = ""
    days: List[dict] = []  # [{name, exercises:[{name, sets, reps, load, rir, rest, notes}]}]


@api.post("/plans")
async def create_plan(body: PlanIn, user=Depends(require_trainer)):
    c = await assert_access(user, body.client_id)
    doc = body.model_dump()
    doc.update({"trainer_id": c["trainer_id"], "active": True, "created_at": now_iso()})
    await db.plans.insert_one(doc)
    return ser(doc)


@api.put("/plans/{plan_id}")
async def update_plan(plan_id: str, body: PlanIn, user=Depends(require_trainer)):
    p = await db.plans.find_one({"_id": oid(plan_id)})
    if not p:
        raise HTTPException(404, "Scheda non trovata")
    await assert_access(user, p["client_id"])
    await db.plans.update_one({"_id": oid(plan_id)}, {"$set": {"name": body.name, "notes": body.notes, "days": body.days}})
    return ser(await db.plans.find_one({"_id": oid(plan_id)}))


@api.get("/plans")
async def list_plans(client_id: str, user=Depends(current_user)):
    await assert_access(user, client_id)
    docs = await db.plans.find({"client_id": client_id}).sort("created_at", -1).to_list(200)
    return [ser(d) for d in docs]


@api.get("/plans/{plan_id}")
async def get_plan(plan_id: str, user=Depends(current_user)):
    p = await db.plans.find_one({"_id": oid(plan_id)})
    if not p:
        raise HTTPException(404, "Scheda non trovata")
    await assert_access(user, p["client_id"])
    return ser(p)


# ---------- sessions ----------
class SessionStartIn(BaseModel):
    plan_id: str
    day_index: int


@api.post("/sessions")
async def start_session(body: SessionStartIn, user=Depends(current_user)):
    p = await db.plans.find_one({"_id": oid(body.plan_id)})
    if not p:
        raise HTTPException(404, "Scheda non trovata")
    await assert_access(user, p["client_id"])
    if not 0 <= body.day_index < len(p.get("days", [])):
        raise HTTPException(400, "Giorno non valido")
    day = p["days"][body.day_index]
    exercises = []
    for ex in day.get("exercises", []):
        n = int(ex.get("sets") or 1)
        exercises.append({"name": ex.get("name", ""), "notes": ex.get("notes", ""), "rest": ex.get("rest", ""),
                          "sets": [{"planned_reps": ex.get("reps", ""), "planned_load": ex.get("load", ""),
                                    "planned_rir": ex.get("rir", ""), "done_reps": None, "done_load": None,
                                    "done_rir": None, "execution": None, "completed": False} for _ in range(n)]})
    doc = {"client_id": p["client_id"], "trainer_id": p["trainer_id"], "plan_id": body.plan_id, "plan_name": p["name"],
           "day_name": day.get("name", f"Giorno {body.day_index + 1}"), "exercises": exercises,
           "status": "in_progress", "started_at": now_iso(), "finished_at": None, "notes": ""}
    await db.sessions.insert_one(doc)
    return ser(doc)


class SessionUpdateIn(BaseModel):
    exercises: List[dict]
    notes: Optional[str] = ""
    finish: bool = False


async def get_sess(sid: str, user: dict):
    s = await db.sessions.find_one({"_id": oid(sid)})
    if not s:
        raise HTTPException(404, "Sessione non trovata")
    await assert_access(user, s["client_id"])
    return s


@api.put("/sessions/{sid}")
async def update_session(sid: str, body: SessionUpdateIn, user=Depends(current_user)):
    await get_sess(sid, user)
    upd = {"exercises": body.exercises, "notes": body.notes}
    if body.finish:
        upd.update({"status": "completed", "finished_at": now_iso()})
    await db.sessions.update_one({"_id": oid(sid)}, {"$set": upd})
    return ser(await db.sessions.find_one({"_id": oid(sid)}))


@api.get("/sessions/{sid}")
async def session_detail(sid: str, user=Depends(current_user)):
    s = ser(await get_sess(sid, user))
    s["comments"] = await get_comments("session", sid)
    return s


@api.post("/sessions/{sid}/comments")
async def session_comment(sid: str, body: CommentIn, user=Depends(current_user)):
    await get_sess(sid, user)
    return await add_comment("session", sid, user, body.text)


@api.get("/sessions")
async def list_sessions(client_id: str, user=Depends(current_user)):
    await assert_access(user, client_id)
    docs = await db.sessions.find({"client_id": client_id}).sort("started_at", -1).to_list(300)
    return [ser(d) for d in docs]


def num(v) -> Optional[float]:
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


@api.get("/progress")
async def progress(client_id: str, user=Depends(current_user)):
    """Per exercise time series: max load, total reps, avg RIR, avg execution."""
    await assert_access(user, client_id)
    docs = await db.sessions.find({"client_id": client_id, "status": "completed"}).sort("started_at", 1).to_list(1000)
    series: dict = {}
    for s in docs:
        for ex in s.get("exercises", []):
            sets = [st for st in ex.get("sets", []) if st.get("completed")]
            if not sets:
                continue
            loads = [num(st.get("done_load")) for st in sets if num(st.get("done_load")) is not None]
            reps = [num(st.get("done_reps")) for st in sets if num(st.get("done_reps")) is not None]
            rirs = [num(st.get("done_rir")) for st in sets if num(st.get("done_rir")) is not None]
            exe = [num(st.get("execution")) for st in sets if num(st.get("execution")) is not None]
            series.setdefault(ex["name"], []).append({
                "date": s["started_at"][:10],
                "max_load": max(loads) if loads else 0,
                "total_reps": sum(reps) if reps else 0,
                "avg_rir": round(sum(rirs) / len(rirs), 1) if rirs else 0,
                "avg_execution": round(sum(exe) / len(exe), 1) if exe else 0,
                "volume": round(sum((num(st.get("done_load")) or 0) * (num(st.get("done_reps")) or 0) for st in sets), 1),
            })
    return series


# ---------- uploads / media ----------
@api.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(current_user)):
    data = await file.read()
    if len(data) > 150 * 1024 * 1024:
        raise HTTPException(413, "File troppo grande (max 150MB)")
    ext = (file.filename or "file").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    path = f"{APP_NAME}/uploads/{user['_id']}/{uuid.uuid4()}.{ext}"
    ctype = file.content_type or "application/octet-stream"
    try:
        res = await run_in_threadpool(put_object, path, data, ctype)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 402:
            raise HTTPException(402, "Spazio di archiviazione esaurito")
        raise HTTPException(502, "Errore di caricamento")
    await db.files.insert_one({"path": res["path"], "owner_id": str(user["_id"]), "content_type": ctype,
                               "size": len(data), "created_at": now_iso(), "is_deleted": False})
    return {"path": res["path"], "content_type": ctype}


@api.get("/files/{path:path}")
async def download(path: str, token: Optional[str] = None, authorization: str = Header(None)):
    if token:
        user = await user_from_token(token)
    else:
        user = await current_user(authorization)
    rec = await db.files.find_one({"path": path, "is_deleted": False})
    if not rec:
        raise HTTPException(404, "File non trovato")
    owner = await db.users.find_one({"_id": oid(rec["owner_id"])})
    uid = str(user["_id"])
    allowed = uid == rec["owner_id"] or (owner and (owner.get("trainer_id") == uid or str(owner["_id"]) == user.get("trainer_id")))
    if not allowed:
        raise HTTPException(403, "Accesso negato")
    data, ctype = await run_in_threadpool(get_object, path)
    return Response(content=data, media_type=rec.get("content_type") or ctype, headers={"Cache-Control": "private, max-age=86400"})


class PhotoIn(BaseModel):
    client_id: str
    kind: str  # front | side_left | back | posing
    path: str
    date: str
    pose_name: Optional[str] = ""


@api.post("/photos")
async def create_photo(body: PhotoIn, user=Depends(current_user)):
    tid = await trainer_of(user, body.client_id)
    doc = body.model_dump()
    doc.update({"trainer_id": tid, "created_at": now_iso()})
    await db.photos.insert_one(doc)
    return ser(doc)


@api.get("/photos")
async def list_photos(client_id: str, user=Depends(current_user)):
    await assert_access(user, client_id)
    docs = await db.photos.find({"client_id": client_id}).sort("date", -1).to_list(1000)
    return [ser(d) for d in docs]


class VideoIn(BaseModel):
    client_id: str
    path: str
    exercise: str
    note: Optional[str] = ""


@api.post("/videos")
async def create_video(body: VideoIn, user=Depends(current_user)):
    c = await assert_access(user, body.client_id)
    doc = body.model_dump()
    doc.update({"trainer_id": c["trainer_id"], "client_name": c["name"], "reviewed": False, "created_at": now_iso()})
    await db.videos.insert_one(doc)
    return ser(doc)


@api.get("/videos")
async def list_videos(client_id: Optional[str] = None, user=Depends(current_user)):
    f = await owner_ids(user, client_id)
    docs = await db.videos.find(f).sort("created_at", -1).to_list(500)
    return [ser(d) for d in docs]


async def get_video(vid: str, user: dict):
    v = await db.videos.find_one({"_id": oid(vid)})
    if not v:
        raise HTTPException(404, "Video non trovato")
    await assert_access(user, v["client_id"])
    return v


@api.get("/videos/{vid}")
async def video_detail(vid: str, user=Depends(current_user)):
    v = ser(await get_video(vid, user))
    v["comments"] = await get_comments("video", vid)
    return v


@api.post("/videos/{vid}/comments")
async def video_comment(vid: str, body: CommentIn, user=Depends(current_user)):
    await get_video(vid, user)
    if user["role"] == "trainer":
        await db.videos.update_one({"_id": oid(vid)}, {"$set": {"reviewed": True}})
    return await add_comment("video", vid, user, body.text)


# ---------- nutrition ----------
@api.get("/food/barcode/{code}")
async def barcode_lookup(code: str, user=Depends(current_user)):
    url = f"https://world.openfoodfacts.org/api/v2/product/{re.sub(r'[^0-9]', '', code)}.json"
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "SilverPT/1.0 (trainer app)"}) as hc:
        r = await hc.get(url, params={"fields": "product_name,brands,nutriments,image_front_small_url,serving_quantity"})
    data = r.json() if r.status_code == 200 else {}
    p = data.get("product")
    if not p:
        raise HTTPException(404, "Prodotto non trovato")
    n = p.get("nutriments", {})
    return {"name": p.get("product_name") or "Prodotto", "brand": p.get("brands", ""),
            "image": p.get("image_front_small_url"), "serving_g": p.get("serving_quantity") or 100,
            "per100": {"kcal": round(n.get("energy-kcal_100g") or 0, 1), "protein": round(n.get("proteins_100g") or 0, 1),
                       "carbs": round(n.get("carbohydrates_100g") or 0, 1), "fat": round(n.get("fat_100g") or 0, 1)}}


class AnalyzeIn(BaseModel):
    image_base64: str


@api.post("/food/analyze")
async def analyze_food(body: AnalyzeIn, user=Depends(current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"food-{uuid.uuid4()}",
                   system_message="Sei un nutrizionista esperto. Stimi porzioni e valori nutrizionali da foto di piatti. Rispondi SOLO con JSON valido.").with_model("openai", "gpt-5.5")
    prompt = ('Analizza il piatto nella foto. Restituisci SOLO JSON: {"name": "nome piatto in italiano", '
              '"items": [{"name": str, "grams": number}], "kcal": number, "protein": number, "carbs": number, "fat": number, '
              '"confidence": "alta|media|bassa"}. Valori totali per la porzione visibile.')
    b64 = body.image_base64.split(",", 1)[-1]
    text = ""
    async for ev in chat.stream_message(UserMessage(text=prompt, file_contents=[ImageContent(image_base64=b64)])):
        if isinstance(ev, TextDelta):
            text += ev.content
        elif isinstance(ev, StreamDone):
            break
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise HTTPException(502, "Analisi non riuscita, riprova")
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        raise HTTPException(502, "Analisi non riuscita, riprova")


class MealIn(BaseModel):
    client_id: Optional[str] = None
    date: str
    meal_type: str  # colazione, pranzo, cena, spuntino
    name: str
    grams: Optional[float] = None
    kcal: float = 0
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    source: str = "manual"  # barcode | ai | manual
    photo_path: Optional[str] = None


@api.post("/meals")
async def create_meal(body: MealIn, user=Depends(current_user)):
    cid = str(user["_id"]) if user["role"] == "client" else body.client_id
    tid = await trainer_of(user, cid)
    doc = body.model_dump()
    doc.update({"client_id": cid, "trainer_id": tid, "created_at": now_iso()})
    await db.meals.insert_one(doc)
    return ser(doc)


@api.get("/meals")
async def list_meals(client_id: str, date: str, user=Depends(current_user)):
    await assert_access(user, client_id)
    docs = await db.meals.find({"client_id": client_id, "date": date}).sort("created_at", 1).to_list(200)
    return [ser(d) for d in docs]


@api.delete("/meals/{meal_id}")
async def delete_meal(meal_id: str, user=Depends(current_user)):
    m = await db.meals.find_one({"_id": oid(meal_id)})
    if not m:
        raise HTTPException(404, "Pasto non trovato")
    await assert_access(user, m["client_id"])
    await db.meals.delete_one({"_id": oid(meal_id)})
    return {"ok": True}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    try:
        init_storage()
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
