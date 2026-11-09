"""SILVER-PT v8: notifications, reminders, exercise library, AI helpers, nutritionist features, blood tests."""
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import os, json, re, uuid, time, httpx, bcrypt

from server import (api, db, ser, oid, now_iso, num, logger, current_user, require_trainer, require_staff,
                    assert_access, seal, daily_code)


# ---------- AI (uses the coach's own OpenAI key when set, otherwise the Emergent key) ----------
def ai_key() -> str:
    return (os.environ.get("OPENAI_API_KEY") or "").strip() or EMERGENT_KEY


async def ai_json(system: str, prompt: str, image_b64: Optional[str] = None) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone
    chat = LlmChat(api_key=ai_key(), session_id=f"x-{uuid.uuid4()}", system_message=system + " Rispondi SOLO con JSON valido.").with_model("openai", "gpt-5.5")
    files = [ImageContent(image_base64=image_b64.split(",", 1)[-1])] if image_b64 else None
    text = ""
    try:
        async for ev in chat.stream_message(UserMessage(text=prompt, file_contents=files) if files else UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
        return json.loads(re.search(r"\{.*\}", text, re.S).group(0))
    except Exception as e:
        logger.error(f"AI failed: {e}")
        raise HTTPException(502, "Funzione AI non disponibile al momento, riprova")


# ---------- notifications ----------
async def notify(user_id: Optional[str], title: str, body: str = "", link: str = "", key: Optional[str] = None):
    if not user_id:
        return
    doc = {"user_id": user_id, "title": title, "body": body, "link": link, "read": False, "created_at": now_iso()}
    if key:
        doc["key"] = key
        await db.notifications.update_one({"user_id": user_id, "key": key}, {"$setOnInsert": doc}, upsert=True)
    else:
        await db.notifications.insert_one(doc)


async def notify_team(c: dict, title: str, body: str = "", link: str = "", exclude: str = ""):
    for uid in {c.get("trainer_id"), c.get("nutritionist_id")} - {None, "", exclude}:
        await notify(uid, title, body, link)


def add_months(d: datetime, n: int) -> datetime:
    m = d.month - 1 + n
    y, m = d.year + m // 12, m % 12 + 1
    day = min(d.day, [31, 29 if y % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
    return d.replace(year=y, month=m, day=day)


def next_renewal(sub: dict) -> Optional[datetime]:
    try:
        since = datetime.fromisoformat(sub["since"][:10])
    except (KeyError, ValueError, TypeError):
        return None
    step = 12 if sub.get("billing") == "annuale" else 1
    d, today = since, datetime.now()
    n = 0
    while d.date() < today.date():
        n += step
        d = add_months(since, n)
    return d


async def last_check(cid: str) -> Optional[str]:
    p = await db.photos.find_one({"client_id": cid}, sort=[("date", -1)])
    m = await db.measurements.find_one({"client_id": cid}, sort=[("date", -1)])
    dates = [x["date"][:10] for x in (p, m) if x]
    return max(dates) if dates else None


_rem_last: dict = {}


async def run_reminders(user: dict):
    """Idempotent reminders: subscription expiry (7 days) and due checks (per staff frequency). Throttled per user."""
    uid = str(user["_id"])
    if time.time() - _rem_last.get(uid, 0) < 600:
        return
    _rem_last[uid] = time.time()
    if user["role"] == "client":
        clients = [user]
    else:
        f = {"trainer_id": uid} if user["role"] == "trainer" else {"nutritionist_id": uid}
        clients = await db.users.find({"role": "client", **f}).to_list(1000)
    today = datetime.now().date()
    for c in clients:
        cid = str(c["_id"])
        sub = c.get("subscription") or {}
        nr = next_renewal(sub) if sub else None
        if nr and 0 <= (nr.date() - today).days <= 7:
            ds = nr.strftime("%d/%m/%Y")
            if user["role"] == "client":
                await notify(uid, "Abbonamento in scadenza", f"{sub.get('name', '')} si rinnova il {ds}", "/packages", key=f"sub:{cid}:{nr.date()}")
            elif user["role"] == "trainer":
                await notify(uid, f"Scadenza: {c['name']}", f"{sub.get('name', '')} · rinnovo il {ds}", f"/client/{cid}", key=f"sub:{cid}:{nr.date()}")
        checks = c.get("checks") or {}
        last = await last_check(cid)
        for role in ("trainer", "nutritionist"):
            every = int(num(checks.get(role)) or 0)
            if not every:
                continue
            due = (datetime.fromisoformat(last).date() + timedelta(days=every)) if last else today
            if due <= today:
                k = f"check:{role}:{cid}:{due}"
                if user["role"] == "client":
                    await notify(uid, "È ora del check", "Carica le foto check e le misure richieste dal tuo team", f"/photos/{cid}", key=k)
                elif user["role"] == role:
                    await notify(uid, f"Check da fare: {c['name']}", f"Ultimo check: {last or 'mai'}", f"/client/{cid}", key=k)


@api.get("/notifications")
async def list_notifications(user=Depends(current_user)):
    await run_reminders(user)
    docs = await db.notifications.find({"user_id": str(user["_id"])}).sort("created_at", -1).to_list(200)
    return [ser(d) for d in docs]


@api.get("/notifications/unread")
async def unread_notifications(user=Depends(current_user)):
    await run_reminders(user)
    docs = await db.notifications.find({"user_id": str(user["_id"]), "read": False}).sort("created_at", -1).to_list(50)
    return {"count": len(docs), "latest": [ser(d) for d in docs[:5]]}


@api.post("/notifications/read")
async def read_notifications(user=Depends(current_user)):
    await db.notifications.update_many({"user_id": str(user["_id"])}, {"$set": {"read": True}})
    return {"ok": True}


class ChecksIn(BaseModel):
    every_days: int = Field(ge=0, le=365)


@api.put("/clients/{client_id}/checks")
async def set_checks(client_id: str, body: ChecksIn, user=Depends(require_staff)):
    await assert_access(user, client_id)
    await db.users.update_one({"_id": oid(client_id)}, {"$set": {f"checks.{user['role']}": body.every_days}})
    _rem_last.clear()
    return ser(await db.users.find_one({"_id": oid(client_id)}))


# ---------- exercise library (free-exercise-db, public domain) ----------
EX_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
EX_IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"
_ex_cache: dict = {"t": 0, "data": []}
IT_EN = {"panca": "bench press", "piana": "bench press", "inclinata": "incline", "declinata": "decline", "squat": "squat",
         "stacco": "deadlift", "rumeno": "romanian", "rematore": "row", "lat machine": "pulldown", "lat": "pulldown",
         "trazioni": "pull-up", "trazione": "pull-up", "curl": "curl", "martello": "hammer", "spinte": "press", "lento": "shoulder press",
         "military": "military press", "alzate laterali": "lateral raise", "alzate": "raise", "croci": "fly", "affondi": "lunge",
         "pressa": "leg press", "leg extension": "leg extension", "leg curl": "leg curl", "polpacci": "calf", "calf": "calf",
         "dip": "dip", "parallele": "dip", "french press": "triceps extension", "push down": "pushdown", "pushdown": "pushdown",
         "crunch": "crunch", "plank": "plank", "hip thrust": "hip thrust", "ponte": "glute bridge", "manubri": "dumbbell",
         "manubrio": "dumbbell", "bilanciere": "barbell", "cavi": "cable", "cavo": "cable", "macchina": "machine",
         "face pull": "face pull", "scrollate": "shrug", "pulley": "seated cable row", "addome": "abs", "glutei": "glute",
         "tricipiti": "triceps", "bicipiti": "biceps", "petto": "chest", "spalle": "shoulder", "dorso": "back"}


async def exercises_db() -> list:
    if _ex_cache["data"] and time.time() - _ex_cache["t"] < 86400:
        return _ex_cache["data"]
    async with httpx.AsyncClient(timeout=30) as hc:
        r = await hc.get(EX_URL)
    r.raise_for_status()
    _ex_cache.update(t=time.time(), data=r.json())
    return _ex_cache["data"]


def ex_out(e: dict) -> dict:
    return {"id": e["id"], "name": e["name"], "images": [EX_IMG + i for i in e.get("images", [])[:2]],
            "muscles": e.get("primaryMuscles", []), "equipment": e.get("equipment"), "category": e.get("category")}


def s_bonus(name: str, q: str) -> bool:
    """Prefer barbell variants unless the query names other equipment."""
    return "barbell" in name and not any(k in q for k in ("dumbbell", "machine", "cable"))


@api.get("/exercises/search")
async def exercise_search(q: str, user=Depends(current_user)):
    try:
        data = await exercises_db()
    except Exception:
        raise HTTPException(502, "Archivio esercizi non raggiungibile")
    ql = q.strip().lower()
    for it, en in sorted(IT_EN.items(), key=lambda x: -len(x[0])):
        if it in ql:
            ql = ql.replace(it, en)
    words = [w for w in re.split(r"\s+", ql) if w]
    scored = []
    for e in data:
        n = e["name"].lower()
        s = sum(1 for w in words if w in n) + (0.5 if s_bonus(n, ql) else 0)
        if s >= 1:
            scored.append((s, -len(n), e))
    scored.sort(key=lambda x: (-x[0], -x[1]))
    return [ex_out(e) for _, _, e in scored[:20]]


# ---------- AI helpers ----------
class VolumeIn(BaseModel):
    client_id: str
    goal: Optional[str] = ""
    freq: Optional[str] = ""
    districts: List[str] = []
    given: dict = {}  # values the coach fixed (totale / upper / lower / per distretto); AI fills the rest


@api.post("/ai/volume")
async def ai_volume(body: VolumeIn, user=Depends(require_trainer)):
    from server import client_context
    await assert_access(user, body.client_id)
    ctx = await client_context(body.client_id)
    return await ai_json("Sei un preparatore ISSA esperto di programmazione del volume allenante.",
                         f"Dati cliente: {ctx}\nObiettivo: {body.goal}\nFrequenza: {body.freq}\nDistretti: {', '.join(body.districts)}\n"
                         f"Valori già fissati dal coach (rispettali esattamente e suddividi il resto): {json.dumps({k: v for k, v in body.given.items() if str(v).strip()})}\n"
                         'Proponi le serie allenanti settimanali. Formato: {"weekly_total": number, "per_district": {"Petto": number, ...}, "rationale": "breve spiegazione"}')


class ImageIn(BaseModel):
    image_base64: str


@api.post("/ai/nutrition-label")
async def ai_label(body: ImageIn, user=Depends(current_user)):
    return await ai_json("Leggi tabelle nutrizionali di etichette alimentari.",
                         'Leggi la tabella nutrizionale nella foto e restituisci i valori PER 100 g: {"name": "nome prodotto se visibile o vuoto", '
                         '"per100": {"kcal": n, "protein": n, "carbs": n, "sugars": n, "fat": n, "fiber": n, "salt": n, "sodium": n}}. Usa 0 se assente; '
                         "se c'è solo il sale calcola sodio = sale/2.5 (g).", body.image_base64)


@api.post("/ai/blood-scan")
async def ai_blood(body: ImageIn, user=Depends(current_user)):
    return await ai_json("Leggi referti di analisi del sangue italiani.",
                         'Estrai tutti i valori dal referto: {"date": "AAAA-MM-GG o vuoto", "lab": "laboratorio o vuoto", "values": [{"section": "es. Emocromo, '
                         'Lipidi, Tiroide", "name": str, "value": number, "unit": str, "ref_min": number|null, "ref_max": number|null}]}', body.image_base64)


class ApproachIn(BaseModel):
    client_id: str
    notes: Optional[str] = ""


@api.post("/ai/nutrition-approach")
async def ai_approach(body: ApproachIn, user=Depends(require_staff)):
    from server import client_context
    await assert_access(user, body.client_id)
    ctx = await client_context(body.client_id)
    return await ai_json("Sei un dietista esperto. Suggerisci l'approccio nutrizionale più adatto, tenendo conto di anamnesi e patologie.",
                         f"Dati cliente: {ctx}\nNote del professionista: {body.notes}\n"
                         'Formato: {"approach": "nome approccio", "kcal": n, "protein": n, "carbs": n, "fat": n, "rationale": "motivazione", "cautions": "attenzioni cliniche"}')


# ---------- sessions: pause / resume / delete ----------
class SessionStateIn(BaseModel):
    action: str  # pause | resume


@api.put("/sessions/{sid}/state")
async def session_state(sid: str, body: SessionStateIn, user=Depends(current_user)):
    s = await db.sessions.find_one({"_id": oid(sid)})
    if not s:
        raise HTTPException(404, "Sessione non trovata")
    await assert_access(user, s["client_id"])
    if s.get("status") == "completed":
        raise HTTPException(400, "Sessione già salvata")
    now = datetime.fromisoformat(now_iso())
    if body.action == "pause" and s["status"] == "in_progress":
        upd = {"status": "paused", "paused_at": now_iso()}
    elif body.action == "resume" and s["status"] == "paused":
        extra = (now - datetime.fromisoformat(s["paused_at"])).total_seconds() if s.get("paused_at") else 0
        upd = {"status": "in_progress", "paused_at": None, "paused_total": int((s.get("paused_total") or 0) + extra)}
    else:
        raise HTTPException(400, "Azione non valida")
    await db.sessions.update_one({"_id": oid(sid)}, {"$set": {**upd, "updated_at": now_iso()}})
    return ser(await db.sessions.find_one({"_id": oid(sid)}))


@api.delete("/sessions/{sid}")
async def session_delete(sid: str, user=Depends(current_user)):
    s = await db.sessions.find_one({"_id": oid(sid)})
    if not s:
        raise HTTPException(404, "Sessione non trovata")
    await assert_access(user, s["client_id"])
    await db.sessions.delete_one({"_id": oid(sid)})
    return {"ok": True}


# ---------- plans: delete + comparison ----------
@api.delete("/plans/{plan_id}")
async def plan_delete(plan_id: str, notify_client: bool = False, user=Depends(require_trainer)):
    p = await db.plans.find_one({"_id": oid(plan_id)})
    if not p:
        raise HTTPException(404, "Scheda non trovata")
    await assert_access(user, p["client_id"])
    await db.plans.delete_one({"_id": oid(plan_id)})
    if notify_client:
        await notify(p["client_id"], "Scheda rimossa", f"Il coach ha eliminato la scheda «{p['name']}»", "/")
    return {"ok": True}


@api.get("/progress/plans")
async def progress_plans(client_id: str, user=Depends(current_user)):
    await assert_access(user, client_id)
    plans = await db.plans.find({"client_id": client_id}).sort("created_at", 1).to_list(200)
    out = []
    for p in plans:
        pid = str(p["_id"])
        sess = await db.sessions.find({"plan_id": pid, "status": "completed"}).to_list(1000)
        sets = [st for s in sess for ex in s.get("exercises", []) for st in ex.get("sets", []) if st.get("completed")]
        loads = [num(st.get("done_load")) for st in sets if num(st.get("done_load"))]
        reps = [num(st.get("done_reps")) or 0 for st in sets]
        rirs = [num(st.get("done_rir")) for st in sets if num(st.get("done_rir")) is not None]
        exe = [num(st.get("execution")) for st in sets if num(st.get("execution")) is not None]
        per_ex: dict = {}
        for s in sess:
            for ex in s.get("exercises", []):
                for st in ex.get("sets", []):
                    if st.get("completed"):
                        e = per_ex.setdefault(ex["name"], {"max_load": 0, "max_reps": 0, "volume": 0})
                        w, r = num(st.get("done_load")) or 0, num(st.get("done_reps")) or 0
                        e["max_load"] = max(e["max_load"], w)
                        e["max_reps"] = max(e["max_reps"], r)
                        e["volume"] = round(e["volume"] + w * r, 1)
        n = len(sess) or 1
        out.append({"id": pid, "name": p["name"], "created_at": p.get("created_at"), "sessions": len(sess), "sets": len(sets),
                    "total_reps": sum(reps), "volume": round(sum((num(st.get("done_load")) or 0) * (num(st.get("done_reps")) or 0) for st in sets), 1),
                    "volume_per_session": round(sum((num(st.get("done_load")) or 0) * (num(st.get("done_reps")) or 0) for st in sets) / n, 1),
                    "avg_load": round(sum(loads) / len(loads), 1) if loads else 0, "max_load": max(loads) if loads else 0,
                    "avg_rir": round(sum(rirs) / len(rirs), 1) if rirs else None,
                    "avg_execution": round(sum(exe) / len(exe), 1) if exe else None, "exercises": per_ex})
    return out


# ---------- nutrition summary + custom foods ----------
MACROS = ("kcal", "protein", "carbs", "fat", "sugars", "fiber", "salt", "sodium")


@api.get("/meals/summary")
async def meals_summary(client_id: str, date: str, user=Depends(current_user)):
    from server import visible
    c = await assert_access(user, client_id)
    if user["role"] == "client" and not visible(c, "nutrition"):
        return {"hidden": True}
    d = datetime.fromisoformat(date[:10])
    week_start = (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d")
    month_start = d.strftime("%Y-%m-01")
    docs = await db.meals.find({"client_id": client_id, "date": {"$gte": min(week_start, month_start), "$lte": date[:10]}}).to_list(5000)

    def agg(fr: str):
        sel = [m for m in docs if fr <= m["date"] <= date[:10]]
        days = len({m["date"] for m in sel}) or 1
        tot = {k: round(sum(num(m.get(k)) or 0 for m in sel), 1) for k in MACROS}
        return {"total": tot, "avg": {k: round(v / days, 1) for k, v in tot.items()}, "days": len({m["date"] for m in sel})}
    return {"day": agg(date[:10]), "week": agg(week_start), "month": agg(month_start)}


class CustomFoodIn(BaseModel):
    barcode: Optional[str] = ""
    name: str
    brand: Optional[str] = ""
    per100: dict


@api.post("/foods/custom")
async def save_custom_food(body: CustomFoodIn, user=Depends(current_user)):
    per = {k: num(body.per100.get(k)) or 0 for k in MACROS}
    key = {"owner_id": str(user["_id"]), "barcode": body.barcode or None, "name": body.name}
    if body.barcode:
        key = {"owner_id": str(user["_id"]), "barcode": body.barcode}
    await db.custom_foods.update_one(key, {"$set": {**key, "name": body.name, "brand": body.brand, "per100": per, "updated_at": now_iso()}}, upsert=True)
    return {"ok": True}


@api.get("/foods/custom")
async def list_custom_foods(user=Depends(current_user)):
    return [ser(d) for d in await db.custom_foods.find({"owner_id": str(user["_id"])}).sort("updated_at", -1).to_list(500)]


# ---------- staff public profile, nutritionist choice ----------
def staff_public(d: dict) -> dict:
    st = d.get("staff") or {}
    return {"id": str(d["_id"]), "name": d["name"], "role": d["role"], "avatar": d.get("avatar"), "title": st.get("title", ""),
            "bio": st.get("bio", ""), "whatsapp": st.get("whatsapp", ""), "story": st.get("story", "") if st.get("story_public") else ""}


@api.get("/staff/{sid}")
async def staff_profile(sid: str, user=Depends(current_user)):
    d = await db.users.find_one({"_id": oid(sid), "role": {"$in": ["trainer", "nutritionist"]}})
    if not d:
        raise HTTPException(404, "Professionista non trovato")
    out = staff_public(d)
    field = "nutritionist_id" if d["role"] == "nutritionist" else "trainer_id"
    f = {"role": "client", field: sid}
    if user["role"] == "trainer":
        f["trainer_id"] = str(user["_id"])
    elif user["role"] == "nutritionist":
        f["nutritionist_id"] = str(user["_id"])
    else:
        f["_id"] = user["_id"]
    common = await db.users.find(f).to_list(500)
    out["common_clients"] = [{"id": str(c["_id"]), "name": c["name"], "avatar": c.get("avatar")} for c in common]
    out["clients_count"] = await db.users.count_documents({"role": "client", field: sid})
    out["packages"] = [ser(p) for p in await db.packages.find({"owner_id": sid}).sort("order", 1).to_list(100)]
    return out


@api.get("/professionals")
async def professionals(role: str = "nutritionist", user=Depends(current_user)):
    docs = await db.users.find({"role": role}).sort("name", 1).to_list(500)
    return [staff_public(d) for d in docs]


class ChooseNutriIn(BaseModel):
    nutritionist_id: str  # "" to remove


@api.put("/me/nutritionist")
async def choose_nutritionist(body: ChooseNutriIn, user=Depends(current_user)):
    if user["role"] != "client":
        raise HTTPException(403, "Solo per i clienti")
    if body.nutritionist_id and not await db.users.find_one({"_id": oid(body.nutritionist_id), "role": "nutritionist"}):
        raise HTTPException(404, "Nutrizionista non trovato")
    old = user.get("nutritionist_id")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"nutritionist_id": body.nutritionist_id or None}})
    if old and old != body.nutritionist_id:
        await notify(old, "Cliente non più seguito", f"{user['name']} ha scelto un altro professionista", "/")
    if body.nutritionist_id and old != body.nutritionist_id:
        await notify(body.nutritionist_id, "Nuovo cliente", f"{user['name']} ti ha scelto come nutrizionista", f"/client/{user['_id']}")
    if old != (body.nutritionist_id or None):
        await notify(user.get("trainer_id"), "Cambio nutrizionista", f"{user['name']} ha cambiato nutrizionista", f"/client/{user['_id']}")
    return ser(await db.users.find_one({"_id": user["_id"]}))


class SuggestCoachIn(BaseModel):
    trainer_id: str


@api.post("/clients/{client_id}/suggest-coach")
async def suggest_coach(client_id: str, body: SuggestCoachIn, user=Depends(require_staff)):
    await assert_access(user, client_id)
    t = await db.users.find_one({"_id": oid(body.trainer_id), "role": "trainer"})
    if not t:
        raise HTTPException(404, "Coach non trovato")
    await notify(client_id, "Coach consigliato", f"{user['name']} ti consiglia {t['name']} (codice invito di oggi {daily_code(body.trainer_id)})", f"/staff/{body.trainer_id}")
    return {"ok": True}


class NutriClientIn(BaseModel):
    name: str = Field(min_length=1)
    email: str
    password: str = Field(min_length=6)


@api.post("/nutri/clients")
async def nutri_add_client(body: NutriClientIn, user=Depends(require_staff)):
    if user["role"] != "nutritionist":
        raise HTTPException(403, "Solo per il nutrizionista")
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email già registrata")
    doc = {"email": email, "name": body.name.strip(), "role": "client", "trainer_id": "",
           "nutritionist_id": str(user["_id"]), "profile": {}, "visibility": {"measurements": False, "photos": False, "nutrition": True},
           "password_hash": bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(), "created_at": now_iso()}
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return ser(doc)


# ---------- blood tests ----------
class BloodIn(BaseModel):
    client_id: str
    date: str
    lab: Optional[str] = ""
    file_path: Optional[str] = None
    values: List[dict] = []  # {section, name, value, unit, ref_min, ref_max}
    notes: Optional[str] = ""


def clean_values(vals: List[dict]) -> List[dict]:
    out = []
    for v in vals:
        if not str(v.get("name", "")).strip():
            continue
        out.append({"section": str(v.get("section") or "Altro").strip(), "name": str(v["name"]).strip(), "value": num(v.get("value")),
                    "unit": str(v.get("unit") or ""), "ref_min": num(v.get("ref_min")), "ref_max": num(v.get("ref_max"))})
    return out


@api.post("/blood-tests")
async def blood_create(body: BloodIn, user=Depends(current_user)):
    c = await assert_access(user, body.client_id)
    doc = {"client_id": body.client_id, "date": body.date, "lab": body.lab, "file_path": body.file_path,
           "_sealed": seal({"values": clean_values(body.values), "notes": body.notes or ""}), "created_by": user["name"], "created_at": now_iso()}
    await db.blood_tests.insert_one(doc)
    if user["role"] == "client":
        await notify_team(c, "Nuove analisi del sangue", f"{c['name']} ha caricato un referto", f"/blood/{body.client_id}")
    return ser(doc)


@api.put("/blood-tests/{bid}")
async def blood_update(bid: str, body: BloodIn, user=Depends(current_user)):
    b = await db.blood_tests.find_one({"_id": oid(bid)})
    if not b or b["client_id"] != body.client_id:
        raise HTTPException(404, "Referto non trovato")
    await assert_access(user, body.client_id)
    await db.blood_tests.update_one({"_id": oid(bid)}, {"$set": {"date": body.date, "lab": body.lab, "file_path": body.file_path, "values": None, "notes": None,
                                                                 "_sealed": seal({"values": clean_values(body.values), "notes": body.notes or ""}), "updated_at": now_iso()}})
    return ser(await db.blood_tests.find_one({"_id": oid(bid)}))


@api.delete("/blood-tests/{bid}")
async def blood_delete(bid: str, user=Depends(current_user)):
    b = await db.blood_tests.find_one({"_id": oid(bid)})
    if not b:
        raise HTTPException(404, "Referto non trovato")
    await assert_access(user, b["client_id"])
    await db.blood_tests.delete_one({"_id": oid(bid)})
    return {"ok": True}


@api.get("/blood-tests")
async def blood_list(client_id: str, user=Depends(current_user)):
    await assert_access(user, client_id)
    return [ser(d) for d in await db.blood_tests.find({"client_id": client_id}).sort("date", -1).to_list(200)]


# ---------- legal documents & consents ----------
@api.get("/legal/docs")
async def legal_docs(role: Optional[str] = None):
    from legal import DOCS
    return [d for d in DOCS if not role or role in d["roles"]]


class ConsentIn(BaseModel):
    id: str
    accepted: bool = True


@api.post("/me/consents")
async def set_consent(body: ConsentIn, user=Depends(current_user)):
    from legal import BY_ID, consent_records, required_for
    if body.id not in BY_ID:
        raise HTTPException(404, "Documento non trovato")
    if not body.accepted and body.id in required_for(user["role"]):
        raise HTTPException(400, "Documento obbligatorio: per revocarlo chiedi la chiusura dell'account")
    rest = [c for c in (user.get("consents") or []) if c["id"] != body.id]
    if body.accepted:
        rest += consent_records([body.id])
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"consents": rest}})
    return ser(await db.users.find_one({"_id": user["_id"]}))


# ---------- trainer dashboard ----------
@api.get("/dashboard")
async def dashboard(user=Depends(require_staff)):
    uid = str(user["_id"])
    fld = "trainer_id" if user["role"] == "trainer" else "nutritionist_id"
    clients = await db.users.find({"role": "client", fld: uid}).to_list(2000)
    ids = [str(c["_id"]) for c in clients]
    limit = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    sess = await db.sessions.find({"client_id": {"$in": ids}, "status": {"$in": ["in_progress", "paused"]}}).to_list(500)
    online = [c for c in clients if (c.get("last_seen") or "") >= limit]
    now = datetime.now(timezone.utc)
    day0 = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week0 = day0 - timedelta(days=day0.weekday())
    appts = await db.appointments.find({("staff_id" if user["role"] == "nutritionist" else "trainer_id"): uid, "status": {"$ne": "cancelled"},
                                        "start": {"$gte": week0.isoformat()[:16], "$lt": (week0 + timedelta(days=7)).isoformat()[:16]}}).to_list(1000)
    today = [a for a in appts if a["start"][:10] == day0.strftime("%Y-%m-%d")]
    monthly = 0.0
    due = []
    own_pkgs = None
    if user["role"] == "nutritionist":
        own_pkgs = {str(p["_id"]) for p in await db.packages.find({"owner_id": uid}, {"_id": 1}).to_list(500)}
    for c in clients:
        sub = c.get("subscription") or {}
        if own_pkgs is not None and sub.get("package_id") not in own_pkgs:
            continue
        price = num(sub.get("price")) or 0
        monthly += price / 12 if sub.get("billing") == "annuale" else price
        nr = next_renewal(sub) if sub else None
        if nr and 0 <= (nr.date() - now.date()).days <= 30:
            due.append({"id": str(c["_id"]), "name": c["name"], "date": nr.strftime("%Y-%m-%d"), "price": price, "package": sub.get("name")})
    by_client = {str(c["_id"]): c for c in clients}
    return {"clients": len(clients),
            "online": [{"id": str(c["_id"]), "name": c["name"], "avatar": c.get("avatar"), "last_seen": c.get("last_seen")} for c in online],
            "active_sessions": [{"id": str(s["_id"]), "client_id": s["client_id"], "client_name": by_client[s["client_id"]]["name"],
                                 "avatar": by_client[s["client_id"]].get("avatar"), "day_name": s.get("day_name"), "status": s["status"], "started_at": s["started_at"]} for s in sess],
            "appointments_today": len(today), "appointments_week": len(appts),
            "next_appointments": [ser(a) for a in sorted([a for a in appts if a["start"] >= now.isoformat()[:16]], key=lambda a: a["start"])[:5]],
            "finance": {"monthly_estimate": round(monthly, 2), "renewals_30d": sorted(due, key=lambda x: x["date"]),
                        "renewals_30d_total": round(sum(x["price"] for x in due), 2),
                        "paying_clients": sum(1 for c in clients if c.get("subscription") and (own_pkgs is None or c["subscription"].get("package_id") in own_pkgs))}}


# ---------- exercise library by district/muscle + coach's own videos ----------
MUSCLE_IT = {"chest": "Petto", "lats": "Dorso", "middle back": "Dorso", "lower back": "Dorso", "traps": "Dorso", "shoulders": "Spalle",
             "biceps": "Bicipiti", "forearms": "Avambracci", "triceps": "Tricipiti", "quadriceps": "Quadricipiti", "hamstrings": "Femorali",
             "glutes": "Glutei", "abductors": "Glutei", "adductors": "Adduttori", "calves": "Polpacci", "abdominals": "Addome", "neck": "Collo"}


@api.get("/exercises/library")
async def exercise_library(district: Optional[str] = None, muscle: Optional[str] = None, user=Depends(current_user)):
    try:
        data = await exercises_db()
    except Exception:
        raise HTTPException(502, "Archivio esercizi non raggiungibile")
    tree: dict = {}
    for e in data:
        for m in e.get("primaryMuscles", [])[:1]:
            tree.setdefault(MUSCLE_IT.get(m, "Altro"), {}).setdefault(m, 0)
            tree[MUSCLE_IT.get(m, "Altro")][m] += 1
    items = []
    if district or muscle:
        for e in data:
            pm = (e.get("primaryMuscles") or [""])[0]
            if (muscle and pm == muscle) or (not muscle and MUSCLE_IT.get(pm, "Altro") == district):
                items.append(ex_out(e))
    mine = [ser(d) for d in await db.coach_exercises.find({"owner_id": str(user.get("trainer_id") or user["_id"]) if user["role"] == "client" else str(user["_id"]),
                                                            **({"district": district} if district else {})}).sort("name", 1).to_list(500)]
    return {"tree": tree, "items": items[:150], "mine": mine}


class CoachExIn(BaseModel):
    name: str = Field(min_length=1)
    district: str
    muscle: Optional[str] = ""
    video_path: Optional[str] = None
    images: List[str] = []
    notes: Optional[str] = ""


@api.post("/exercises/mine")
async def add_my_exercise(body: CoachExIn, user=Depends(require_staff)):
    doc = {**body.model_dump(), "owner_id": str(user["_id"]), "created_at": now_iso()}
    await db.coach_exercises.insert_one(doc)
    return ser(doc)


@api.delete("/exercises/mine/{eid}")
async def del_my_exercise(eid: str, user=Depends(require_staff)):
    await db.coach_exercises.delete_one({"_id": oid(eid), "owner_id": str(user["_id"])})
    return {"ok": True}


# ---------- recent foods (manual entry memory) ----------
@api.get("/foods/recent")
async def recent_foods(client_id: str, user=Depends(current_user)):
    await assert_access(user, client_id)
    docs = await db.meals.find({"client_id": client_id}).sort("created_at", -1).to_list(600)
    seen, out = set(), []
    for m in docs:
        k = (m.get("name") or "").strip().lower()
        if not k or k in seen:
            continue
        seen.add(k)
        g = num(m.get("grams"))
        per100 = {x: round((num(m.get(x)) or 0) * 100 / g, 2) for x in MACROS} if g else None
        out.append({"name": m["name"], "grams": g, "per100": per100, **{x: m.get(x) for x in MACROS}})
        if len(out) >= 60:
            break
    return out
