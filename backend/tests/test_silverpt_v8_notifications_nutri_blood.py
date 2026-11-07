# Iteration 8: notifications/reminders, exercise search, plans volume+notify, sessions pause/resume/edit/delete,
# progress plans comparison, meals summary, custom foods, staff profile, nutritionist change, nutri clients,
# suggest coach, blood tests, derived indexes, register rules, nutri chat thread, nutri appointments.
import os
import uuid
import pytest
import requests
from datetime import date
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MDB = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]
TODAY = date.today().isoformat()


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d['access_token']}"}, d["user"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def ctx():
    th, tu = login("trainer@silverpt.it", "Trainer123!")
    nh, nu = login("nutri@silverpt.it", "Nutri123!")
    c = {"th": th, "tid": tu["id"], "nh": nh, "nid": nu["id"], "users": [], "plans": [], "sessions": [], "blood": [],
         "meals": [], "meas": [], "appts": [], "chat_cids": []}
    # TEST_ client created by the nutritionist (also linked to the trainer through nutri.trainer_id)
    em = f"test_v8_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/nutri/clients", headers=nh, json={"name": "TEST_V8 Client", "email": em, "password": "Test123!"})
    assert r.status_code == 200, r.text
    c["cid"] = r.json()["id"]
    c["users"].append(c["cid"])
    c["ch"], _ = login(em, "Test123!")
    c["nutri_client_resp"] = r.json()
    yield c
    for uid in c["users"]:
        MDB.users.delete_one({"_id": ObjectId(uid)})
        MDB.notifications.delete_many({"user_id": uid})
        MDB.custom_foods.delete_many({"owner_id": uid})
    for col, ids in (("plans", c["plans"]), ("sessions", c["sessions"]), ("blood_tests", c["blood"]), ("meals", c["meals"]),
                     ("measurements", c["meas"]), ("appointments", c["appts"])):
        for i in ids:
            MDB[col].delete_one({"_id": ObjectId(i)})
    for cid in c["chat_cids"]:
        MDB.chat.delete_many({"client_id": cid})
    MDB.notifications.delete_many({"link": {"$regex": "|".join(c["users"])}})


# --- register rules + nutri clients
class TestRegisterAndNutri:
    def test_nutri_client_created(self, ctx):
        d = ctx["nutri_client_resp"]
        assert d["role"] == "client" and d["nutritionist_id"] == ctx["nid"]
        assert d["trainer_id"] == ctx["tid"]
        assert "password_hash" not in d, "password_hash leaked in /nutri/clients response"

    def test_nutri_register_without_code_and_client_with_nutri_code(self, ctx):
        em = f"test_v8n_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"email": em, "password": "Test123!", "name": "TEST_Nutri2", "role": "nutritionist"})
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        ctx["users"].append(u["id"])
        ctx["nutri2"] = u["id"]
        assert u["invite_code"] and u["trainer_id"] == ""
        r2 = requests.post(f"{API}/auth/register", json={"email": "c" + em, "password": "Test123!", "name": "TEST_C2", "role": "client",
                                                         "invite_code": u["invite_code"]})
        assert r2.status_code == 200, r2.text
        cu = r2.json()["user"]
        ctx["users"].append(cu["id"])
        assert cu["nutritionist_id"] == u["id"]
        bad = requests.post(f"{API}/auth/register", json={"email": "x" + em, "password": "Test123!", "name": "TEST_X", "role": "client",
                                                          "invite_code": "ZZZZZZ"})
        assert bad.status_code == 400

    def test_trainer_cannot_create_nutri_client(self, ctx):
        r = requests.post(f"{API}/nutri/clients", headers=ctx["th"], json={"name": "TEST_x", "email": "x@y.it", "password": "Test123!"})
        assert r.status_code == 403

    def test_staff_profile_and_professionals(self, ctx):
        r = requests.get(f"{API}/staff/{ctx['nid']}", headers=ctx["ch"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "nutritionist" and isinstance(d["common_clients"], list) and "packages" in d
        assert [x["id"] for x in d["common_clients"]] == [ctx["cid"]]
        pros = requests.get(f"{API}/professionals?role=nutritionist", headers=ctx["ch"]).json()
        assert any(p["id"] == ctx["nid"] for p in pros) and all(p["role"] == "nutritionist" for p in pros)

    def test_change_nutritionist_notifies(self, ctx):
        nid2 = ctx.get("nutri2")
        if not nid2:
            pytest.skip("nutri2 not created")
        r = requests.put(f"{API}/me/nutritionist", headers=ctx["ch"], json={"nutritionist_id": nid2})
        assert r.status_code == 200 and r.json()["nutritionist_id"] == nid2
        assert MDB.notifications.find_one({"user_id": ctx["nid"], "title": "Cliente non più seguito", "body": {"$regex": "TEST_V8"}})
        assert MDB.notifications.find_one({"user_id": nid2, "title": "Nuovo cliente"})
        assert MDB.notifications.find_one({"user_id": ctx["tid"], "title": "Cambio nutrizionista", "body": {"$regex": "TEST_V8"}})
        # revert to original nutri
        r = requests.put(f"{API}/me/nutritionist", headers=ctx["ch"], json={"nutritionist_id": ctx["nid"]})
        assert r.json()["nutritionist_id"] == ctx["nid"]
        MDB.notifications.delete_many({"user_id": {"$in": [ctx["nid"], ctx["tid"]]}, "body": {"$regex": "TEST_V8"}})

    def test_suggest_coach(self, ctx):
        r = requests.post(f"{API}/clients/{ctx['cid']}/suggest-coach", headers=ctx["nh"], json={"trainer_id": ctx["tid"]})
        assert r.status_code == 200
        assert MDB.notifications.find_one({"user_id": ctx["cid"], "title": "Coach consigliato"})


# --- notifications + check reminders
class TestNotifications:
    def test_checks_and_reminders(self, ctx):
        r = requests.put(f"{API}/clients/{ctx['cid']}/checks", headers=ctx["nh"], json={"every_days": 14})
        assert r.status_code == 200 and r.json()["checks"]["nutritionist"] == 14
        assert "password_hash" not in r.json()
        u = requests.get(f"{API}/notifications/unread", headers=ctx["ch"]).json()
        assert u["count"] >= 1 and any(n["title"] == "È ora del check" for n in u["latest"]) or \
            any(n["title"] == "È ora del check" for n in requests.get(f"{API}/notifications", headers=ctx["ch"]).json())
        nl = requests.get(f"{API}/notifications", headers=ctx["nh"]).json()
        mine = [n for n in nl if n["title"] == "Check da fare: TEST_V8 Client"]
        assert len(mine) == 1  # idempotent
        requests.get(f"{API}/notifications", headers=ctx["nh"])
        assert MDB.notifications.count_documents({"user_id": ctx["nid"], "title": "Check da fare: TEST_V8 Client"}) == 1
        MDB.notifications.delete_many({"user_id": ctx["nid"], "title": "Check da fare: TEST_V8 Client"})

    def test_mark_read(self, ctx):
        r = requests.post(f"{API}/notifications/read", headers=ctx["ch"])
        assert r.status_code == 200
        assert requests.get(f"{API}/notifications/unread", headers=ctx["ch"]).json()["count"] == 0

    def test_invalid_checks(self, ctx):
        r = requests.put(f"{API}/clients/{ctx['cid']}/checks", headers=ctx["nh"], json={"every_days": 999})
        assert r.status_code == 422


# --- exercises search
class TestExercises:
    def test_search_italian(self, ctx):
        r = requests.get(f"{API}/exercises/search", params={"q": "panca piana"}, headers=ctx["th"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d and any("bench press" in e["name"].lower() for e in d[:5])
        assert d[0]["images"] and d[0]["images"][0].startswith("https://")


# --- plans, sessions, progress
class TestPlansSessions:
    def _plan(self, ctx, notify):
        body = {"client_id": ctx["cid"], "name": "TEST_V8 Plan", "days": [{"name": "A", "exercises": [
            {"name": "Panca", "sets": 2, "reps": "8", "load": "60", "district": "Petto"}]}],
            "volume": {"weekly_total": 10, "per_district": {"Petto": 10}}, "notify": notify}
        return requests.post(f"{API}/plans", headers=ctx["th"], json=body)

    def test_plan_notify_flag(self, ctx):
        MDB.notifications.delete_many({"user_id": ctx["cid"], "title": {"$in": ["Nuova scheda", "Scheda aggiornata", "Scheda rimossa"]}})
        r = self._plan(ctx, False)
        assert r.status_code == 200 and r.json()["volume"]["weekly_total"] == 10
        p = r.json()
        ctx["plans"].append(p["id"])
        assert "notify" not in p
        assert MDB.notifications.count_documents({"user_id": ctx["cid"], "title": "Nuova scheda"}) == 0
        r2 = self._plan(ctx, True)
        ctx["plans"].append(r2.json()["id"])
        assert MDB.notifications.count_documents({"user_id": ctx["cid"], "title": "Nuova scheda"}) == 1
        body = {"client_id": ctx["cid"], "name": "TEST_V8 Plan edit", "days": p["days"], "volume": {"weekly_total": 12}, "notify": False}
        u = requests.put(f"{API}/plans/{p['id']}", headers=ctx["th"], json=body)
        assert u.status_code == 200 and u.json()["volume"]["weekly_total"] == 12 and u.json()["name"] == "TEST_V8 Plan edit"
        assert MDB.notifications.count_documents({"user_id": ctx["cid"], "title": "Scheda aggiornata"}) == 0
        body["notify"] = True
        requests.put(f"{API}/plans/{p['id']}", headers=ctx["th"], json=body)
        assert MDB.notifications.count_documents({"user_id": ctx["cid"], "title": "Scheda aggiornata"}) == 1

    def test_session_lifecycle(self, ctx):
        pid = ctx["plans"][0]
        r = requests.post(f"{API}/sessions", headers=ctx["th"], json={"plan_id": pid, "day_index": 0})
        assert r.status_code == 200, r.text
        s = r.json()
        ctx["sessions"].append(s["id"])
        assert MDB.notifications.find_one({"user_id": ctx["cid"], "title": "Sessione avviata dal coach"})
        p = requests.put(f"{API}/sessions/{s['id']}/state", headers=ctx["ch"], json={"action": "pause"})
        assert p.status_code == 200 and p.json()["status"] == "paused" and p.json()["paused_at"]
        bad = requests.put(f"{API}/sessions/{s['id']}/state", headers=ctx["ch"], json={"action": "pause"})
        assert bad.status_code == 400
        rs = requests.put(f"{API}/sessions/{s['id']}/state", headers=ctx["ch"], json={"action": "resume"})
        assert rs.status_code == 200 and rs.json()["status"] == "in_progress" and rs.json()["paused_total"] >= 0
        ex = s["exercises"]
        for st in ex[0]["sets"]:
            st.update(done_reps=8, done_load=60, done_rir=2, execution=8, completed=True)
        f = requests.put(f"{API}/sessions/{s['id']}", headers=ctx["ch"], json={"exercises": ex, "finish": True})
        assert f.status_code == 200 and f.json()["status"] == "completed" and f.json()["finished_at"]
        e = requests.put(f"{API}/sessions/{s['id']}", headers=ctx["th"], json={"exercises": ex, "started_at": "2026-01-10T09:00:00+00:00",
                                                                               "finished_at": "2026-01-10T10:05:00+00:00"})
        assert e.status_code == 200 and e.json()["started_at"].startswith("2026-01-10T09:00") and e.json()["status"] == "completed"
        g = requests.get(f"{API}/sessions/{s['id']}", headers=ctx["ch"]).json()
        assert g["finished_at"].startswith("2026-01-10T10:05")
        bd = requests.put(f"{API}/sessions/{s['id']}", headers=ctx["th"], json={"exercises": ex, "started_at": "not-a-date"})
        assert bd.status_code == 400
        st = requests.put(f"{API}/sessions/{s['id']}/state", headers=ctx["ch"], json={"action": "pause"})
        assert st.status_code == 400

    def test_progress_plans(self, ctx):
        r = requests.get(f"{API}/progress/plans", params={"client_id": ctx["cid"]}, headers=ctx["ch"])
        assert r.status_code == 200, r.text
        d = {x["id"]: x for x in r.json()}
        p = d[ctx["plans"][0]]
        assert p["sessions"] == 1 and p["sets"] == 2 and p["volume"] == 960 and p["max_load"] == 60
        assert p["exercises"]["Panca"]["volume"] == 960

    def test_finish_while_paused_and_delete(self, ctx):
        s = requests.post(f"{API}/sessions", headers=ctx["ch"], json={"plan_id": ctx["plans"][0], "day_index": 0}).json()
        ctx["sessions"].append(s["id"])
        requests.put(f"{API}/sessions/{s['id']}/state", headers=ctx["ch"], json={"action": "pause"})
        f = requests.put(f"{API}/sessions/{s['id']}", headers=ctx["ch"], json={"exercises": s["exercises"], "finish": True})
        assert f.status_code == 200 and f.json()["status"] == "completed"
        d = requests.delete(f"{API}/sessions/{s['id']}", headers=ctx["ch"])
        assert d.status_code == 200
        assert requests.get(f"{API}/sessions/{s['id']}", headers=ctx["ch"]).status_code == 404

    def test_plan_delete_notify(self, ctx):
        pid = ctx["plans"][1]
        assert requests.delete(f"{API}/plans/{pid}?notify_client=false", headers=ctx["ch"]).status_code == 403
        r = requests.delete(f"{API}/plans/{pid}?notify_client=true", headers=ctx["th"])
        assert r.status_code == 200
        assert requests.get(f"{API}/plans/{pid}", headers=ctx["th"]).status_code == 404
        assert MDB.notifications.count_documents({"user_id": ctx["cid"], "title": "Scheda rimossa"}) == 1
        p3 = self._plan(ctx, False).json()
        requests.delete(f"{API}/plans/{p3['id']}?notify_client=false", headers=ctx["th"])
        assert MDB.notifications.count_documents({"user_id": ctx["cid"], "title": "Scheda rimossa"}) == 1


# --- nutrition: meals summary + custom foods
class TestNutrition:
    def test_meals_summary(self, ctx):
        for k in (100, 200):
            m = requests.post(f"{API}/meals", headers=ctx["ch"], json={"date": TODAY, "meal_type": "pranzo", "name": "TEST_food", "kcal": k,
                                                                      "protein": 10, "carbs": 20, "fat": 5, "sugars": 3, "salt": 0.5, "sodium": 0.2})
            assert m.status_code == 200, m.text
            ctx["meals"].append(m.json()["id"])
        r = requests.get(f"{API}/meals/summary", params={"client_id": ctx["cid"], "date": TODAY}, headers=ctx["ch"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["day"]["total"]["kcal"] == 300 and d["day"]["total"]["sugars"] == 6 and d["day"]["total"]["salt"] == 1.0
        assert d["day"]["total"]["sodium"] == 0.4 and d["week"]["total"]["kcal"] == 300 and d["month"]["total"]["kcal"] == 300
        assert d["day"]["days"] == 1

    def test_custom_food_barcode(self, ctx):
        code = "8076809513753"
        r = requests.post(f"{API}/foods/custom", headers=ctx["ch"], json={"barcode": code, "name": "TEST_Pasta", "brand": "X",
                                                                         "per100": {"kcal": 999, "protein": 1}})
        assert r.status_code == 200
        lst = requests.get(f"{API}/foods/custom", headers=ctx["ch"]).json()
        assert lst and lst[0]["per100"]["kcal"] == 999
        b = requests.get(f"{API}/food/barcode/{code}", headers=ctx["ch"])
        assert b.status_code == 200 and b.json()["custom"] is True and b.json()["per100"]["kcal"] == 999
        o = requests.get(f"{API}/food/barcode/{code}", headers=ctx["th"])
        assert o.status_code in (200, 404) and not (o.status_code == 200 and o.json().get("custom"))


# --- blood tests + measurements derived
class TestBloodMeasures:
    def test_blood_crud(self, ctx):
        body = {"client_id": ctx["cid"], "date": "2026-01-05", "lab": "TEST_Lab", "values": [
            {"section": "Lipidi", "name": "Colesterolo", "value": "190", "unit": "mg/dL", "ref_max": 200}, {"name": ""}]}
        r = requests.post(f"{API}/blood-tests", headers=ctx["ch"], json=body)
        assert r.status_code == 200, r.text
        b = r.json()
        ctx["blood"].append(b["id"])
        assert len(b["values"]) == 1 and b["values"][0]["value"] == 190
        assert MDB.notifications.find_one({"user_id": ctx["nid"], "title": "Nuove analisi del sangue", "link": f"/blood/{ctx['cid']}"})
        body["values"][0]["value"] = 210
        u = requests.put(f"{API}/blood-tests/{b['id']}", headers=ctx["nh"], json=body)
        assert u.status_code == 200 and u.json()["values"][0]["value"] == 210
        lst = requests.get(f"{API}/blood-tests", params={"client_id": ctx["cid"]}, headers=ctx["th"]).json()
        assert [x["id"] for x in lst] == [b["id"]]
        assert requests.delete(f"{API}/blood-tests/{b['id']}", headers=ctx["nh"]).status_code == 200
        assert requests.get(f"{API}/blood-tests", params={"client_id": ctx["cid"]}, headers=ctx["th"]).json() == []

    def test_measurements_derived(self, ctx):
        r = requests.post(f"{API}/measurements", headers=ctx["th"], json={"client_id": ctx["cid"], "date": TODAY, "weight": 80, "height": 180,
                                                                          "circumferences": {"vita": 85, "fianchi": 100, "braccio": 35}})
        assert r.status_code == 200, r.text
        ctx["meas"].append(r.json()["id"])
        lst = requests.get(f"{API}/measurements", params={"client_id": ctx["cid"]}, headers=ctx["nh"]).json()
        d = lst[0]["derived"]
        assert d["bmi"] == round(80 / 1.8 ** 2, 2)
        ctx["derived_keys"] = sorted(d.keys())
        print("derived keys:", ctx["derived_keys"])


# --- nutri chat thread + appointments
class TestChatAppointments:
    def test_nutri_thread_separated(self, ctx):
        ctx["chat_cids"].append(ctx["cid"])
        r = requests.post(f"{API}/chat/{ctx['cid']}?thread=nutri", headers=ctx["nh"], json={"text": "TEST_nutri msg"})
        assert r.status_code == 200, r.text
        n = requests.get(f"{API}/chat/{ctx['cid']}?thread=nutri", headers=ctx["ch"]).json()
        assert [m["text"] for m in n] == ["TEST_nutri msg"]
        coach = requests.get(f"{API}/chat/{ctx['cid']}", headers=ctx["th"])
        assert coach.status_code in (200, 403)
        if coach.status_code == 200:
            assert all(m["text"] != "TEST_nutri msg" for m in coach.json())
        assert requests.get(f"{API}/chat/{ctx['cid']}", headers=ctx["nh"]).status_code == 403

    def test_nutri_appointment(self, ctx):
        r = requests.post(f"{API}/appointments", headers=ctx["nh"], json={"client_id": ctx["cid"], "title": "TEST_Visita", "start": "2026-02-01T10:00:00",
                                                                          "kind": "Videocall", "video_link": "https://meet.jit.si/test-v8"})
        assert r.status_code == 200, r.text
        a = r.json()
        ctx["appts"].append(a["id"])
        assert a["staff_id"] == ctx["nid"] and a["video_link"] == "https://meet.jit.si/test-v8"
        lst = requests.get(f"{API}/appointments", headers=ctx["nh"]).json()
        assert a["id"] in [x["id"] for x in lst]
        assert all(x.get("staff_id") == ctx["nid"] for x in lst)
