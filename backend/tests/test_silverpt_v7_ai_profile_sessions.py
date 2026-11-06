# Iteration 7: PUT /api/auth/me (profile + password), AI copilot chat, AI plan generator, maxes (Epley), scheme sessions
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MDB = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d['access_token']}"}, d["user"]


@pytest.fixture(scope="module")
def ctx():
    th, tu = login("trainer@silverpt.it", "Trainer123!")
    ch, cu = login("cliente@silverpt.it", "Cliente123!")
    me = requests.get(f"{API}/auth/me", headers=th).json()
    c = {"th": th, "ch": ch, "cid": cu["id"], "tid": tu["id"], "staff0": me.get("staff") or {}, "name0": me["name"],
         "invite": me.get("invite_code"), "users": [], "plans": [], "sessions": [], "ai_ids": []}
    c["ai_pre"] = [d["_id"] for d in MDB.ai_chats.find({"trainer_id": tu["id"], "archived": {"$ne": True}}, {"_id": 1})]
    yield c
    # restore trainer staff/name, cleanup created docs by id
    requests.put(f"{API}/auth/me", headers=th, json={"name": c["name0"], "staff": c["staff0"]})
    for uid in c["users"]:
        MDB.users.delete_one({"_id": ObjectId(uid)})
    for pid in c["plans"]:
        MDB.plans.delete_one({"_id": ObjectId(pid)})
    for sid in c["sessions"]:
        MDB.sessions.delete_one({"_id": ObjectId(sid)})
    MDB.ai_chats.delete_many({"_id": {"$in": c["ai_ids"]}})
    if c["ai_pre"]:
        MDB.ai_chats.update_many({"_id": {"$in": c["ai_pre"]}}, {"$set": {"archived": False}})
    # sanity: trainer password still works
    login("trainer@silverpt.it", "Trainer123!")


# --- PUT /auth/me profile fields
def test_auth_me_staff_update(ctx):
    staff = {**ctx["staff0"], "title": "TEST_Coach ISSA"}
    r = requests.put(f"{API}/auth/me", headers=ctx["th"], json={"staff": staff})
    assert r.status_code == 200, r.text
    g = requests.get(f"{API}/auth/me", headers=ctx["th"]).json()
    assert g["staff"]["title"] == "TEST_Coach ISSA"
    assert g["staff"].get("bio", "") == ctx["staff0"].get("bio", "")


def test_auth_me_blank_name_400(ctx):
    r = requests.put(f"{API}/auth/me", headers=ctx["th"], json={"name": "   "})
    assert r.status_code == 400


# --- password change errors on trainer (no change happens)
def test_pw_wrong_current_400(ctx):
    r = requests.put(f"{API}/auth/me", headers=ctx["th"], json={"current_password": "WRONG_pw1", "new_password": "Whatever123"})
    assert r.status_code == 400
    assert "errata" in r.json()["detail"].lower()


def test_pw_too_short_400(ctx):
    r = requests.put(f"{API}/auth/me", headers=ctx["th"], json={"current_password": "Trainer123!", "new_password": "abc"})
    assert r.status_code == 400
    login("trainer@silverpt.it", "Trainer123!")


# --- password change happy path on a TEST_ user
def test_pw_change_happy_path(ctx):
    email = f"test_{uuid.uuid4().hex[:8]}@silverpt.it"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Start123!", "name": "TEST_PwUser",
                                                    "role": "client", "invite_code": ctx["invite"]})
    assert r.status_code == 200, r.text
    d = r.json()
    ctx["users"].append(d["user"]["id"])
    h = {"Authorization": f"Bearer {d['access_token']}"}
    r = requests.put(f"{API}/auth/me", headers=h, json={"current_password": "Start123!", "new_password": "NewPass123"})
    assert r.status_code == 200, r.text
    assert requests.post(f"{API}/auth/login", json={"email": email, "password": "Start123!"}).status_code == 401
    login(email, "NewPass123")


def test_pw_change_trainer_roundtrip(ctx):
    r = requests.put(f"{API}/auth/me", headers=ctx["th"], json={"current_password": "Trainer123!", "new_password": "TmpTrainer9!"})
    assert r.status_code == 200, r.text
    h, _ = login("trainer@silverpt.it", "TmpTrainer9!")
    r = requests.put(f"{API}/auth/me", headers=h, json={"current_password": "TmpTrainer9!", "new_password": "Trainer123!"})
    assert r.status_code == 200, r.text
    login("trainer@silverpt.it", "Trainer123!")


# --- maxes + scheme sessions
def test_scheme_session_and_maxes(ctx):
    ex = {"name": "TEST_Panca piana", "sets": "4", "reps": "12", "load": "50", "rir": "2", "rest": "90s", "type": "reps",
          "protocol": "Piramidale crescente",
          "scheme": [{"reps": "12", "load": "50", "rir": "2"}, {"reps": "10", "load": "55", "rir": "2"},
                     {"reps": "8", "load": "60", "rir": "2"}, {"reps": "6", "load": "65", "rir": "2"}]}
    plank = {"name": "TEST_Plank", "sets": "2", "reps": "60", "type": "time", "rest": "1:30"}
    r = requests.post(f"{API}/plans", headers=ctx["th"], json={"client_id": ctx["cid"], "name": "TEST_Scheme plan", "active": False,
                                                               "days": [{"name": "A", "exercises": [ex, plank]}]})
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    ctx["plans"].append(pid)
    r = requests.post(f"{API}/sessions", headers=ctx["th"], json={"plan_id": pid, "day_index": 0})
    assert r.status_code == 200, r.text
    s = r.json()
    ctx["sessions"].append(s["id"])
    sets = s["exercises"][0]["sets"]
    assert [x["planned_reps"] for x in sets] == ["12", "10", "8", "6"]
    assert [x["planned_load"] for x in sets] == ["50", "55", "60", "65"]
    assert s["exercises"][1]["type"] == "time" and len(s["exercises"][1]["sets"]) == 2
    assert s["exercises"][0]["rest"] == "90s"
    exs = s["exercises"]
    for st in exs[0]["sets"]:
        st.update({"done_reps": st["planned_reps"], "done_load": st["planned_load"], "completed": True})
    r = requests.put(f"{API}/sessions/{s['id']}", headers=ctx["th"], json={"exercises": exs, "notes": "", "finish": True})
    assert r.status_code == 200 and r.json()["status"] == "completed" and r.json()["finished_at"]
    m = requests.get(f"{API}/clients/{ctx['cid']}/maxes", headers=ctx["th"])
    assert m.status_code == 200
    # best Epley: 65*(1+6/30)=78.0 ; 60*(1+8/30)=76.0
    assert m.json()["TEST_Panca piana"] == 78.0


# regression: completed set with empty / non-numeric load must not 500 the maxes (was TypeError None > 0)
def test_maxes_empty_load_no_500(ctx):
    r = requests.post(f"{API}/plans", headers=ctx["th"], json={"client_id": ctx["cid"], "name": "TEST_EmptyLoad", "active": False,
                      "days": [{"name": "A", "exercises": [{"name": "TEST_Plank", "sets": "1", "reps": "60", "load": "", "type": "time"},
                                                           {"name": "TEST_Pct", "sets": "1", "reps": "5", "load": "80%"}]}]})
    pid = r.json()["id"]
    ctx["plans"].append(pid)
    s = requests.post(f"{API}/sessions", headers=ctx["th"], json={"plan_id": pid, "day_index": 0}).json()
    ctx["sessions"].append(s["id"])
    ex = s["exercises"]
    ex[0]["sets"][0].update({"done_reps": "60", "done_load": "", "completed": True})
    ex[1]["sets"][0].update({"done_reps": "5", "done_load": "80%", "completed": True})
    requests.put(f"{API}/sessions/{s['id']}", headers=ctx["th"], json={"exercises": ex, "finish": True})
    m = requests.get(f"{API}/clients/{ctx['cid']}/maxes", headers=ctx["th"])
    assert m.status_code == 200, m.text
    assert "TEST_Plank" not in m.json() and "TEST_Pct" not in m.json()


def test_maxes_client_forbidden(ctx):
    assert requests.get(f"{API}/clients/{ctx['cid']}/maxes", headers=ctx["ch"]).status_code == 403


# --- AI copilot chat
def test_ai_chat_validation_and_auth(ctx):
    assert requests.post(f"{API}/ai/chat", headers=ctx["th"], json={"message": ""}).status_code == 422
    assert requests.post(f"{API}/ai/chat", headers=ctx["ch"], json={"message": "ciao"}).status_code == 403


def test_ai_chat_send(ctx):
    r = requests.post(f"{API}/ai/chat", headers=ctx["th"], timeout=180,
                      json={"message": "TEST_ Dammi 2 esercizi per i glutei, in breve.", "client_id": ctx["cid"]})
    assert r.status_code == 200, r.text
    assert len(r.json()["reply"]) > 10
    docs = list(MDB.ai_chats.find({"trainer_id": ctx["tid"], "text": {"$regex": "^TEST_ Dammi"}}, {"_id": 1, "created_at": 1}))
    for d in docs:
        ctx["ai_ids"].append(d["_id"])
        ctx["ai_ids"].extend([x["_id"] for x in MDB.ai_chats.find({"trainer_id": ctx["tid"], "role": "assistant", "created_at": {"$gte": d["created_at"]}}).sort("created_at", 1).limit(1)])
    h = requests.get(f"{API}/ai/chat", headers=ctx["th"]).json()
    assert h[-1]["role"] == "assistant" and h[-2]["text"].startswith("TEST_")


def test_ai_chat_clear(ctx):
    r = requests.delete(f"{API}/ai/chat", headers=ctx["th"])
    assert r.status_code == 200
    assert requests.get(f"{API}/ai/chat", headers=ctx["th"]).json() == []


# --- AI plan generator
def test_ai_plan_generate(ctx):
    r = requests.post(f"{API}/ai/plan", headers=ctx["th"], timeout=240, json={
        "client_id": ctx["cid"], "prompt": "2 giorni, max 4 esercizi per giorno, includi un plank",
        "params": {"goal": "Ipertrofia", "split": "Full body", "freq": "2", "frequenza_settimanale": "2"}})
    assert r.status_code == 200, r.text
    p = r.json()
    assert p.get("name") and isinstance(p.get("days"), list) and len(p["days"]) >= 1
    for d in p["days"]:
        assert d["exercises"]
        for e in d["exercises"]:
            assert e["name"] and isinstance(e["sets"], str) and isinstance(e["reps"], str)
    print("AI PLAN:", p["name"], [len(d["exercises"]) for d in p["days"]], [e.get("type") for d in p["days"] for e in d["exercises"]])
