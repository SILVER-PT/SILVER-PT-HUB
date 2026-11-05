from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Query, Header
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os, logging, uuid, json, re, math, asyncio, secrets as pysecrets
import bcrypt, jwt, requests, httpx
import resend
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

APP_NAME = os.environ.get('APP_NAME', 'silver-pt')
JWT_SECRET = os.environ.get('JWT_SECRET', 'secret-key-silver-pt')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

@app.on_event("startup")
async def startup_db_client():
    global db
    app.mongodb_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    app.db = app.mongodb_client[os.environ.get("DB_NAME", "silver_pt")]
    db = app.db

@app.on_event("shutdown")
async def shutdown_db_client():
    if hasattr(app, "mongodb_client"):
        app.mongodb_client.close()

@app.get("/")
async def root():
    return {"status": "online", "message": "SILVER-PT API is running"}

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

async def assert_access(user: dict, client_id: str, allow_nutri: bool = False) -> dict:
    """Trainer: own clients. Client: self. Nutritionist: assigned clients (only when allow_nutri)."""
    c = await db.users.find_one({"_id": oid(client_id), "role": "client"})
    if not c:
        raise HTTPException(404, "Cliente non trovato")
    uid = str(user["_id"])
    role = user["role"]
    ok = (role == "client" and uid == client_id) or (role == "trainer" and c.get("trainer_id") == uid) or \
         (role == "nutritionist" and allow_nutri and c.get("nutritionist_id") == uid)
    if not ok:
        raise HTTPException(403, "Accesso negato")
    return c

def team_id(u: dict) -> str:
    return str(u["_id"]) if u["role"] == "trainer" else u.get("trainer_id", "")

def visible(c: dict, key: str) -> bool:
    return bool((c.get("visibility") or {}).get(key, False))

async def require_staff(user=Depends(current_user)):
    if user["role"] not in ("trainer", "nutritionist"):
        raise HTTPException(403, "Solo per lo staff")
    return user

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
    elif body.role in ("client", "nutritionist"):
        code = (body.invite_code or "").strip().upper()
        trainer = await db.users.find_one({"role": "trainer", "invite_code": code}) if code else None
        if not trainer:
            raise HTTPException(400, "Codice invito non valido")
        doc["trainer_id"] = str(trainer["_id"])
        doc["profile"] = {}
        if body.role == "client":
            doc["visibility"] = {"measurements": False, "photos": False, "nutrition": False}
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
# ---------- reset password ----------
class ResetPasswordIn(BaseModel):
    email: str


@api.post("/auth/reset-password")
async def reset_password(body: ResetPasswordIn):
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Il servizio email non è configurato sul server."
        )

    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="Indirizzo email non valido.")

    # Risposta generica per non rivelare se un indirizzo è registrato.
    user = await db.users.find_one({"email": email})
    if not user:
        return {
            "success": True,
            "message": "Se l'indirizzo è associato a un account, riceverai un'email."
        }

    temp_password = pysecrets.token_urlsafe(8)
    sender = os.environ.get(
        "RESEND_FROM",
        "SILVER-PT <onboarding@resend.dev>"
    )

    try:
        resend.api_key = api_key

        # Invia prima l'email. La password nel database viene aggiornata
        # solo se Resend accetta l'invio.
        await run_in_threadpool(
            resend.Emails.send,
            {
                "from": sender,
                "to": [email],
                "subject": "Reset password - SILVER-PT",
                "html": f"""
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2>Richiesta di reset password</h2>
                        <p>La tua password temporanea per accedere a
                        <b>SILVER-PT</b> è:</p>
                        <p style="font-size: 20px; font-weight: bold;">
                            {temp_password}
                        </p>
                        <p>Ti consigliamo di cambiarla dopo aver effettuato
                        l'accesso.</p>
                    </div>
                """,
            },
        )

        password_hash = bcrypt.hashpw(
            temp_password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password_hash": password_hash}}
        )

        return {
            "success": True,
            "message": "Se l'indirizzo è associato a un account, riceverai un'email."
        }

    except Exception:
        logger.exception("Invio o aggiornamento della password temporanea non riuscito")
        raise HTTPException(
            status_code=502,
            detail="Non è stato possibile inviare l'email. Riprova più tardi."
        )
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
async def list_clients(user=Depends(require_staff)):
    f = {"role": "client", "trainer_id": str(user["_id"])} if user["role"] == "trainer" else {"role": "client", "nutritionist_id": str(user["_id"])}
    docs = await db.users.find(f).sort("name", 1).to_list(1000)
    return [ser(d) for d in docs]

@api.get("/clients/{client_id}")
async def get_client(client_id: str, user=Depends(current_user)):
    return ser(await assert_access(user, client_id, allow_nutri=True))

class MeIn(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    staff: Optional[dict] = None  # whatsapp, bio, title (staff only)

@api.put("/me")
async def update_me(body: MeIn, user=Depends(current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if upd.get("avatar") == "":
        upd["avatar"] = None
    if "staff" in upd:
        upd["staff"] = {k: str(upd["staff"].get(k, ""))[:500] for k in ("whatsapp", "bio", "title")}
    if "staff" in upd and user["role"] == "client":
        upd.pop("staff")
    if upd:
        await db.users.update_one({"_id": user["_id"]}, {"$set": upd})
    return ser(await db.users.find_one({"_id": user["_id"]}))

class SettingsIn(BaseModel):
    visibility: Optional[dict] = None
    nutritionist_id: Optional[str] = None  # "" to remove
    subscription: Optional[dict] = None  # {package_id, name, price, billing, since}

@api.put("/clients/{client_id}/settings")
async def client_settings(client_id: str, body: SettingsIn, user=Depends(require_trainer)):
    await assert_access(user, client_id)
    upd = {}
    if body.visibility is not None:
        upd["visibility"] = {k: bool(body.visibility.get(k)) for k in ("measurements", "photos", "nutrition")}
    if body.nutritionist_id is not None:
        if body.nutritionist_id:
            n = await db.users.find_one({"_id": oid(body.nutritionist_id), "role": "nutritionist", "trainer_id": str(user["_id"])})
            if not n:
                raise HTTPException(404, "Nutrizionista non trovato")
        upd["nutritionist_id"] = body.nutritionist_id or None
    if body.subscription is not None:
        if body.subscription:
            pk = await db.packages.find_one({"_id": oid(str(body.subscription.get("package_id", ""))), "team_id": str(user["_id"])})
            if not pk:
                raise HTTPException(404, "Pacchetto non trovato")
            body.subscription["chat"] = any("chat" in f.lower() for f in pk.get("features", []))
        upd["subscription"] = body.subscription or None
    if upd:
        await db.users.update_one({"_id": oid(client_id)}, {"$set": upd})
    return ser(await db.users.find_one({"_id": oid(client_id)}))

@api.get("/team")
async def team(user=Depends(current_user)):
    """Coach + nutritionists of the user's team (public staff info)."""
    tid = team_id(user)
    docs = await db.users.find({"$or": [{"_id": oid(tid)}, {"role": "nutritionist", "trainer_id": tid}]}).to_list(100)
    return [{"id": str(d["_id"]), "name": d["name"], "role": d["role"], "avatar": d.get("avatar"), "staff": d.get("staff") or {}} for d in docs]

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
           "author_role": user["role"], "author_avatar": user.get("avatar"), "text": text, "created_at": now_iso()}
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

async def build_measurement(body: MeasurementIn, user: dict) -> dict:
    c = await assert_access(user, body.client_id)
    if user["role"] == "client" and not visible(c, "measurements"):
        raise HTTPException(403, "Le misure sono gestite dal coach")
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
    return doc

@api.post("/measurements")
async def create_measurement(body: MeasurementIn, user=Depends(current_user)):
    doc = await build_measurement(body, user)
    await db.measurements.insert_one(doc)
    return ser(doc)

@api.put("/measurements/{mid}")
async def update_measurement(mid: str, body: MeasurementIn, user=Depends(current_user)):
    old = await db.measurements.find_one({"_id": oid(mid)})
    if not old or old["client_id"] != body.client_id:
        raise HTTPException(404, "Misurazione non trovata")
    doc = await build_measurement(body, user)
    doc["created_at"] = old.get("created_at", doc["created_at"])
    doc["updated_at"] = now_iso()
    for k in ("body_fat", "sum_folds", "method", "fat_mass", "lean_mass", "bmi"):
        doc.setdefault(k, None)
    await db.measurements.update_one({"_id": oid(mid)}, {"$set": doc})
    return ser(await db.measurements.find_one({"_id": oid(mid)}))

@api.delete("/measurements/{mid}")
async def delete_measurement(mid: str, user=Depends(current_user)):
    m = await db.measurements.find_one({"_id": oid(mid)})
    if not m:
        raise HTTPException(404, "Misurazione non trovata")
    c = await assert_access(user, m["client_id"])
    if user["role"] == "client" and not visible(c, "measurements"):
        raise HTTPException(403, "Le misure sono gestite dal coach")
    await db.measurements.delete_one({"_id": oid(mid)})
    return {"ok": True}

@api.get("/measurements")
async def list_measurements(client_id: str, user=Depends(current_user)):
    c = await assert_access(user, client_id, allow_nutri=True)
    if user["role"] == "client" and not visible(c, "measurements"):
        raise HTTPException(403, "Le misure sono visibili solo al coach")
    docs = await db.measurements.find({"client_id": client_id}).sort([("date", -1), ("created_at", -1)]).to_list(500)
    return [ser(d) for d in docs]

# ---------- workout plans ----------
class PlanIn(BaseModel):
    client_id: str
    name: str = Field(min_length=1)
    notes: Optional[str] = ""
    approach: Optional[str] = ""
    active: bool = True
    days: List[dict] = []  # [{name, exercises:[{name, sets, reps, load, rir, rest, notes}]}]

@api.post("/plans")
async def create_plan(body: PlanIn, user=Depends(require_trainer)):
    c = await assert_access(user, body.client_id)
    doc = body.model_dump()
    doc.update({"trainer_id": c["trainer_id"], "client_name": c["name"], "created_at": now_iso()})
    await db.plans.insert_one(doc)
    return ser(doc)

@api.get("/plans/history")
async def plans_history(user=Depends(require_trainer)):
    docs = await db.plans.find({"trainer_id": str(user["_id"])}).sort("created_at", -1).to_list(2000)
    names = {str(u["_id"]): u["name"] for u in await db.users.find({"role": "client", "trainer_id": str(user["_id"])}).to_list(1000)}
    counts = {}
    async for s in db.sessions.find({"trainer_id": str(user["_id"]), "status": "completed"}, {"plan_id": 1}):
        counts[s["plan_id"]] = counts.get(s["plan_id"], 0) + 1
    out = []
    for d in docs:
        x = ser(d)
        x["client_name"] = names.get(d["client_id"], d.get("client_name", ""))
        x["sessions_done"] = counts.get(x["id"], 0)
        x.pop("days", None)
        x["days_count"] = len(d.get("days", []))
        out.append(x)
    return out

@api.put("/plans/{plan_id}")
async def update_plan(plan_id: str, body: PlanIn, user=Depends(require_trainer)):
    p = await db.plans.find_one({"_id": oid(plan_id)})
    if not p:
        raise HTTPException(404, "Scheda non trovata")
    await assert_access(user, p["client_id"])
    await db.plans.update_one({"_id": oid(plan_id)}, {"$set": {"name": body.name, "notes": body.notes, "days": body.days,
                                                               "approach": body.approach, "active": body.active, "updated_at": now_iso()}})
    return ser(await db.plans.find_one({"_id": oid(plan_id)}))

@api.get("/plans")
async def list_plans(client_id: str, user=Depends(current_user)):
    await assert_access(user, client_id)
    f = {"client_id": client_id}
    if user["role"] == "client":
        f["active"] = {"$ne": False}
    docs = await db.plans.find(f).sort("created_at", -1).to_list(200)
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
    c = await assert_access(user, client_id)
    if user["role"] == "client" and not visible(c, "photos"):
        raise HTTPException(403, "Le foto sono visibili solo al coach")
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

NUM_KEYS = ("grams", "kcal", "protein", "carbs", "fat")

def strip_meal(m: dict, hide: bool) -> dict:
    x = ser(m)
    if hide:
        for k in NUM_KEYS:
            x.pop(k, None)
    return x

@api.get("/meals")
async def list_meals(client_id: str, date: str, user=Depends(current_user)):
    c = await assert_access(user, client_id, allow_nutri=True)
    hide = user["role"] == "client" and not visible(c, "nutrition")
    docs = await db.meals.find({"client_id": client_id, "date": date}).sort("created_at", 1).to_list(200)
    return [strip_meal(d, hide) for d in docs]

@api.get("/meals/history")
async def meals_history(client_id: str, user=Depends(current_user)):
    """All logged foods grouped by day, newest first, with daily totals."""
    c = await assert_access(user, client_id, allow_nutri=True)
    hide = user["role"] == "client" and not visible(c, "nutrition")
    docs = await db.meals.find({"client_id": client_id}).sort([("date", -1), ("created_at", 1)]).to_list(5000)
    days: dict = {}
    for d in docs:
        day = days.setdefault(d["date"], {"date": d["date"], "items": [], "kcal": 0, "protein": 0, "carbs": 0, "fat": 0})
        day["items"].append(strip_meal(d, hide))
        for k in ("kcal", "protein", "carbs", "fat"):
            day[k] = round(day[k] + (d.get(k) or 0), 1)
    out = list(days.values())
    if hide:
        for day in out:
            for k in ("kcal", "protein", "carbs", "fat"):
                day.pop(k)
    return out

class MealUpdateIn(BaseModel):
    name: Optional[str] = None
    grams: Optional[float] = None
    kcal: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None

@api.put("/meals/{meal_id}")
async def update_meal(meal_id: str, body: MealUpdateIn, user=Depends(require_staff)):
    """Staff completes/corrects a logged food (e.g. name-only entries of DCA clients)."""
    m = await db.meals.find_one({"_id": oid(meal_id)})
    if not m:
        raise HTTPException(404, "Pasto non trovato")
    await assert_access(user, m["client_id"], allow_nutri=True)
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    upd["edited_by"] = user["name"]
    await db.meals.update_one({"_id": oid(meal_id)}, {"$set": upd})
    return ser(await db.meals.find_one({"_id": oid(meal_id)}))

@api.delete("/meals/{meal_id}")
async def delete_meal(meal_id: str, user=Depends(current_user)):
    m = await db.meals.find_one({"_id": oid(meal_id)})
    if not m:
        raise HTTPException(404, "Pasto non trovato")
    await assert_access(user, m["client_id"])
    await db.meals.delete_one({"_id": oid(meal_id)})
    return {"ok": True}

# ---------- nutrition plan / targets / diary comments / team notes ----------
class NutritionPlanIn(BaseModel):
    targets: dict = {}  # kcal, protein, carbs, fat
    meal_plan: List[dict] = []  # [{meal, items}]
    notes: Optional[str] = ""

@api.get("/clients/{client_id}/nutrition")
async def get_nutrition_plan(client_id: str, user=Depends(current_user)):
    c = await assert_access(user, client_id, allow_nutri=True)
    doc = await db.nutrition_plans.find_one({"client_id": client_id}) or {}
    out = {"targets": doc.get("targets") or {}, "meal_plan": doc.get("meal_plan") or [], "notes": doc.get("notes", ""),
           "updated_by": doc.get("updated_by"), "updated_at": doc.get("updated_at")}
    if user["role"] == "client" and not visible(c, "nutrition"):
        out["targets"] = {}
        out["meal_plan"] = []
        out["notes"] = ""
        out["hidden"] = True
    return out

@api.put("/clients/{client_id}/nutrition")
async def set_nutrition_plan(client_id: str, body: NutritionPlanIn, user=Depends(require_staff)):
    await assert_access(user, client_id, allow_nutri=True)
    targets = {k: num(body.targets.get(k)) for k in ("kcal", "protein", "carbs", "fat") if num(body.targets.get(k))}
    await db.nutrition_plans.update_one({"client_id": client_id}, {"$set": {
        "client_id": client_id, "targets": targets, "meal_plan": body.meal_plan, "notes": body.notes,
        "updated_by": user["name"], "updated_at": now_iso()}}, upsert=True)
    return await get_nutrition_plan(client_id, user)

@api.get("/diary/{client_id}/{date}/comments")
async def diary_comments(client_id: str, date: str, user=Depends(current_user)):
    await assert_access(user, client_id, allow_nutri=True)
    return await get_comments("diary", f"{client_id}:{date}")

@api.post("/diary/{client_id}/{date}/comments")
async def diary_comment(client_id: str, date: str, body: CommentIn, user=Depends(current_user)):
    await assert_access(user, client_id, allow_nutri=True)
    return await add_comment("diary", f"{client_id}:{date}", user, body.text)

@api.get("/clients/{client_id}/team-notes")
async def team_notes(client_id: str, user=Depends(require_staff)):
    await assert_access(user, client_id, allow_nutri=True)
    return await get_comments("team", client_id)

@api.post("/clients/{client_id}/team-notes")
async def team_note(client_id: str, body: CommentIn, user=Depends(require_staff)):
    await assert_access(user, client_id, allow_nutri=True)
    return await add_comment("team", client_id, user, body.text)

# ---------- subscription packages ----------
DEFAULT_PACKAGES = [
    ("Aiuto esecuzione online", "Solo correzione tecnica, senza scheda.", 25, "mensile", 8, 0, ["8 video check al mese"]),
    ("Aiuto esecuzione online", "Solo correzione tecnica, senza scheda.", 255, "annuale", 100, 0, ["100 video check all'anno", "Risparmi il 15%"]),
    ("Esecuzione di persona · 1 lezione", "Prima lezione 20€, poi 1 lezione al mese.", 40, "mensile", 0, 3, ["1 lezione al mese", "Prima lezione 20€", "Percorso minimo 3 mesi"]),
    ("Esecuzione di persona · 1 lezione", "1 lezione al mese.", 408, "annuale", 0, 0, ["12 lezioni all'anno", "Prima lezione 20€", "Risparmi il 15%"]),
    ("Esecuzione di persona · 2 lezioni", "Prima lezione 20€, poi 2 lezioni al mese.", 70, "mensile", 0, 3, ["2 lezioni al mese", "Prima lezione 20€", "Percorso minimo 3 mesi"]),
    ("Esecuzione di persona · 2 lezioni", "2 lezioni al mese.", 714, "annuale", 0, 0, ["24 lezioni all'anno", "Prima lezione 20€", "Risparmi il 15%"]),
    ("Coaching completo · 1 lezione", "Scheda, monitoraggio, misure e 1 lezione al mese.", 70, "mensile", 0, 3, ["Schede personalizzate", "1 lezione al mese", "Percorso minimo 3 mesi"]),
    ("Coaching completo · 1 lezione", "Scheda, monitoraggio, misure e 1 lezione al mese.", 714, "annuale", 0, 0, ["Schede personalizzate", "12 lezioni all'anno", "Supporto via chat", "Risparmi il 15%"]),
    ("Coaching completo · 2 lezioni", "Scheda, monitoraggio, misure e 2 lezioni al mese.", 120, "mensile", 0, 3, ["Schede personalizzate", "2 lezioni al mese", "Percorso minimo 3 mesi"]),
    ("Coaching completo · 2 lezioni", "Scheda, monitoraggio, misure e 2 lezioni al mese.", 1224, "annuale", 0, 0, ["Schede personalizzate", "24 lezioni all'anno", "Supporto via chat", "Risparmi il 15%"]),
]

class PackageIn(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = ""
    price: float
    billing: str = "mensile"  # mensile | annuale
    video_limit: int = 0
    min_months: int = 0
    features: List[str] = []

PKG_LOCK = asyncio.Lock()

@api.get("/packages")
async def list_packages(user=Depends(current_user)):
    tid = team_id(user)
    async with PKG_LOCK:
        if not await db.packages.find_one({"owner_id": tid}):
            trainer = await db.users.find_one({"_id": oid(tid)})
            if trainer:
                await db.packages.insert_many([{"owner_id": tid, "owner_role": "trainer", "team_id": tid, "name": n, "description": d,
                                                "price": p, "billing": b, "video_limit": v, "min_months": m, "features": f,
                                                "order": i, "created_at": now_iso()} for i, (n, d, p, b, v, m, f) in enumerate(DEFAULT_PACKAGES)])
    docs = await db.packages.find({"team_id": tid}).sort([("owner_role", -1), ("order", 1), ("created_at", 1)]).to_list(500)
    staff = {s["id"]: s for s in await team(user)}
    out = []
    for d in docs:
        x = ser(d)
        st = staff.get(d["owner_id"], {})
        x["owner_name"] = st.get("name", "")
        x["whatsapp"] = (st.get("staff") or {}).get("whatsapp", "")
        out.append(x)
    return out

@api.post("/packages")
async def create_package(body: PackageIn, user=Depends(require_staff)):
    doc = body.model_dump()
    doc.update({"owner_id": str(user["_id"]), "owner_role": user["role"], "team_id": team_id(user), "order": 100, "created_at": now_iso()})
    await db.packages.insert_one(doc)
    return ser(doc)

async def own_package(pid: str, user: dict):
    p = await db.packages.find_one({"_id": oid(pid)})
    if not p or p["owner_id"] != str(user["_id"]):
        raise HTTPException(404, "Pacchetto non trovato")
    return p

@api.put("/packages/{pid}")
async def update_package(pid: str, body: PackageIn, user=Depends(require_staff)):
    await own_package(pid, user)
    await db.packages.update_one({"_id": oid(pid)}, {"$set": body.model_dump()})
    return ser(await db.packages.find_one({"_id": oid(pid)}))

@api.delete("/packages/{pid}")
async def delete_package(pid: str, user=Depends(require_staff)):
    await own_package(pid, user)
    await db.packages.delete_one({"_id": oid(pid)})
    return {"ok": True}

# ---------- coach chat ----------
async def chat_access(user: dict, client_id: str) -> dict:
    c = await assert_access(user, client_id)
    if not (c.get("subscription") or {}).get("chat"):
        raise HTTPException(403, "La chat è inclusa nel Coaching completo annuale")
    return c

@api.get("/chat/{client_id}")
async def chat_messages(client_id: str, after: Optional[str] = None, user=Depends(current_user)):
    await chat_access(user, client_id)
    f = {"client_id": client_id}
    if after:
        f["created_at"] = {"$gt": after}
    docs = await db.chat.find(f).sort("created_at", 1).to_list(1000)
    other = "client" if user["role"] == "trainer" else "trainer"
    await db.chat.update_many({"client_id": client_id, "author_role": other, "read": False}, {"$set": {"read": True}})
    return [ser(d) for d in docs]

@api.post("/chat/{client_id}")
async def chat_send(client_id: str, body: CommentIn, user=Depends(current_user)):
    await chat_access(user, client_id)
    if not body.text.strip():
        raise HTTPException(400, "Messaggio vuoto")
    doc = {"client_id": client_id, "author_id": str(user["_id"]), "author_name": user["name"], "author_role": user["role"],
           "text": body.text.strip()[:4000], "read": False, "created_at": now_iso()}
    await db.chat.insert_one(doc)
    return ser(doc)

@api.get("/chat-unread")
async def chat_unread(user=Depends(current_user)):
    """Unread counts per client for the trainer, or for the client itself."""
    if user["role"] == "trainer":
        ids = [str(u["_id"]) for u in await db.users.find({"trainer_id": str(user["_id"]), "role": "client"}, {"_id": 1}).to_list(1000)]
        f = {"client_id": {"$in": ids}, "author_role": "client", "read": False}
    else:
        f = {"client_id": str(user["_id"]), "author_role": "trainer", "read": False}
    out: dict = {}
    async for d in db.chat.find(f, {"client_id": 1}):
        out[d["client_id"]] = out.get(d["client_id"], 0) + 1
    return out

# ---------- payments ----------
class PaymentIn(BaseModel):
    client_id: str
    amount: float = Field(gt=0)
    period: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")  # cycle start date the payment covers
    note: Optional[str] = ""

@api.post("/payments")
async def create_payment(body: PaymentIn, user=Depends(require_trainer)):
    c = await assert_access(user, body.client_id)
    if await db.payments.find_one({"client_id": body.client_id, "period": body.period}):
        raise HTTPException(409, "Rinnovo già segnato come pagato")
    doc = body.model_dump()
    doc.update({"trainer_id": str(user["_id"]), "client_name": c["name"], "package": (c.get("subscription") or {}).get("name", ""),
                "paid_at": now_iso()})
    try:
        await db.payments.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Rinnovo già segnato come pagato")
    return ser(doc)

@api.delete("/payments/{pid}")
async def delete_payment(pid: str, user=Depends(require_trainer)):
    res = await db.payments.delete_one({"_id": oid(pid), "trainer_id": str(user["_id"])})
    if not res.deleted_count:
        raise HTTPException(404, "Pagamento non trovato")
    return {"ok": True}

@api.get("/payments")
async def list_payments(user=Depends(require_trainer)):
    docs = await db.payments.find({"trainer_id": str(user["_id"])}).sort("paid_at", -1).to_list(5000)
    return [ser(d) for d in docs]

@api.get("/payments/summary")
async def payments_summary(user=Depends(require_trainer)):
    """Income per month (by payment date) for the last 6 months."""
    now = datetime.now(timezone.utc)
    months = []
    y, m = now.year, now.month
    for _ in range(6):
        months.append(f"{y}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    totals = {k: {"month": k, "total": 0.0, "count": 0} for k in months}
    async for p in db.payments.find({"trainer_id": str(user["_id"]), "paid_at": {"$gte": months[-1]}}):
        k = p["paid_at"][:7]
        if k in totals:
            totals[k]["total"] = round(totals[k]["total"] + p["amount"], 2)
            totals[k]["count"] += 1
    return list(reversed([totals[k] for k in months]))

# ---------- questions (client -> coach) ----------
class QuestionIn(BaseModel):
    subject: str = Field(min_length=1)
    text: str = Field(min_length=1)

@api.post("/questions")
async def create_question(body: QuestionIn, user=Depends(current_user)):
    if user["role"] != "client":
        raise HTTPException(403, "Solo i clienti possono inviare domande")
    doc = {"client_id": str(user["_id"]), "client_name": user["name"], "trainer_id": user["trainer_id"], "subject": body.subject,
           "text": body.text, "status": "open", "created_at": now_iso(), "updated_at": now_iso()}
    await db.questions.insert_one(doc)
    return ser(doc)

@api.get("/questions")
async def list_questions(user=Depends(current_user)):
    if user["role"] == "client":
        f = {"client_id": str(user["_id"])}
    elif user["role"] == "trainer":
        f = {"trainer_id": str(user["_id"])}
    else:
        raise HTTPException(403, "Accesso negato")
    docs = await db.questions.find(f).sort("updated_at", -1).to_list(500)
    return [ser(d) for d in docs]

async def get_question(qid: str, user: dict):
    q = await db.questions.find_one({"_id": oid(qid)})
    if not q:
        raise HTTPException(404, "Domanda non trovata")
    await assert_access(user, q["client_id"])
    return q

@api.get("/questions/{qid}")
async def question_detail(qid: str, user=Depends(current_user)):
    q = ser(await get_question(qid, user))
    q["comments"] = await get_comments("question", qid)
    return q

@api.post("/questions/{qid}/comments")
async def question_comment(qid: str, body: CommentIn, user=Depends(current_user)):
    await get_question(qid, user)
    status = "answered" if user["role"] == "trainer" else "open"
    await db.questions.update_one({"_id": oid(qid)}, {"$set": {"status": status, "updated_at": now_iso()}})
    return await add_comment("question", qid, user, body.text)

@api.put("/questions/{qid}/status")
async def question_status(qid: str, body: StatusIn, user=Depends(current_user)):
    await get_question(qid, user)
    if body.status not in ("open", "answered", "closed"):
        raise HTTPException(400, "Stato non valido")
    await db.questions.update_one({"_id": oid(qid)}, {"$set": {"status": body.status}})
    return {"ok": True}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.payments.create_index([("client_id", 1), ("period", 1)], unique=True)
