# Iteration 9: legal docs/consents, daily invite code, encryption at rest (profile, blood tests, chat), E2E chat payloads,
# chat notifications, trainer dashboard, exercise library + coach exercises, recent foods, trainer advice vs nutritionist
# numbers (hide_numbers), staff own plans, AI volume.
import os
import uuid
import copy
import pytest
import requests
from datetime import date
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MDB = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]
TODAY = date.today().isoformat()
MARCO = "6ae7273ec8f277d3e820ac37"
CLIENT_CONSENTS = ["terms", "privacy", "health_data", "fitness_waiver", "nutrition_disclaimer", "media"]


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d['access_token']}"}, d["user"]


@pytest.fixture(scope="module")
def ctx():
    th, tu = login("trainer@silverpt.it", "Trainer123!")
    nh, nu = login("nutri@silverpt.it", "Nutri123!")
    ch, cu = login("cliente@silverpt.it", "Cliente123!")
    from datetime import datetime, timezone
    t0 = datetime.now(timezone.utc).isoformat()
    c = {"t0": t0, "th": th, "tu": tu, "nh": nh, "nu": nu, "ch": ch, "cu": cu, "users": [], "plans": [], "blood": [], "meals": [], "chat": [], "cex": []}
    tme = requests.get(f"{API}/auth/me", headers=th).json()
    nme = requests.get(f"{API}/auth/me", headers=nh).json()
    c["tcode"], c["ncode"] = tme.get("invite_code"), nme.get("invite_code")
    # TEST_ client registered with the nutritionist's daily code (-> nutritionist + coach of nutritionist)
    em = f"test_v9_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": em, "password": "Test123!", "name": "TEST_V9 Client", "role": "client",
                                                    "invite_code": c["ncode"], "consents": CLIENT_CONSENTS})
    assert r.status_code == 200, r.text
    c["cid"] = r.json()["user"]["id"]
    c["users"].append(c["cid"])
    c["xh"] = {"Authorization": f"Bearer {r.json()['access_token']}"}
    c["reg_user"] = r.json()["user"]
    yield c
    MDB.notifications.delete_many({"created_at": {"$gte": c["t0"]}, "body": {"$regex": "anamnesi di Marco Rossi"}})
    for uid in c["users"]:
        MDB.notifications.delete_many({"link": {"$regex": uid}})
        MDB.users.delete_one({"_id": ObjectId(uid)})
        MDB.notifications.delete_many({"user_id": uid})
        MDB.nutrition_plans.delete_many({"client_id": uid})
    for col, ids in (("plans", c["plans"]), ("blood_tests", c["blood"]), ("meals", c["meals"]), ("chat", c["chat"]), ("coach_exercises", c["cex"])):
        for i in ids:
            MDB[col].delete_one({"_id": ObjectId(i)})


# ---------- legal docs & registration ----------
class TestLegalRegister:
    def test_legal_docs_client(self):
        r = requests.get(f"{API}/legal/docs", params={"role": "client"})
        assert r.status_code == 200
        ids = {d["id"]: d for d in r.json()}
        for k in CLIENT_CONSENTS:
            assert k in ids and ids[k]["required"] is True
        assert "professional" not in ids
        assert ids["marketing"]["required"] is False

    def test_register_missing_consents_400(self, ctx):
        r = requests.post(f"{API}/auth/register", json={"email": f"test_v9_{uuid.uuid4().hex[:6]}@example.com", "password": "Test123!",
                                                        "name": "TEST_x", "role": "client", "invite_code": ctx["tcode"], "consents": ["terms"]})
        assert r.status_code == 400

    def test_register_random_code_fails(self):
        r = requests.post(f"{API}/auth/register", json={"email": f"test_v9_{uuid.uuid4().hex[:6]}@example.com", "password": "Test123!",
                                                        "name": "TEST_x", "role": "client", "invite_code": "ZZZZZZ", "consents": CLIENT_CONSENTS})
        assert r.status_code == 400

    def test_register_trainer_code_ok(self, ctx):
        assert ctx["tcode"] and len(ctx["tcode"]) == 6
        r = requests.post(f"{API}/auth/register", json={"email": f"test_v9_{uuid.uuid4().hex[:6]}@example.com", "password": "Test123!",
                                                        "name": "TEST_V9 T", "role": "client", "invite_code": ctx["tcode"].lower(), "consents": CLIENT_CONSENTS})
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        ctx["users"].append(u["id"])
        assert u["trainer_id"] == ctx["tu"]["id"]
        assert {x["id"] for x in u["consents"]} == set(CLIENT_CONSENTS)

    def test_nutri_code_registration_links(self, ctx):
        u = ctx["reg_user"]
        assert u["nutritionist_id"] == ctx["nu"]["id"]

    def test_consents_optional_and_required(self, ctx):
        r = requests.post(f"{API}/me/consents", headers=ctx["xh"], json={"id": "marketing", "accepted": True})
        assert r.status_code == 200 and "marketing" in {x["id"] for x in r.json()["consents"]}
        r = requests.post(f"{API}/me/consents", headers=ctx["xh"], json={"id": "marketing", "accepted": False})
        assert r.status_code == 200 and "marketing" not in {x["id"] for x in r.json()["consents"]}
        r = requests.post(f"{API}/me/consents", headers=ctx["xh"], json={"id": "privacy", "accepted": False})
        assert r.status_code == 400
        r = requests.post(f"{API}/me/consents", headers=ctx["xh"], json={"id": "nope", "accepted": True})
        assert r.status_code == 404


# ---------- encryption at rest: profile ----------
class TestProfileSealing:
    def test_profile_sealed_and_share(self, ctx):
        raw0 = MDB.users.find_one({"_id": ObjectId(MARCO)})
        orig_profile = copy.deepcopy(raw0.get("profile"))
        try:
            cur = requests.get(f"{API}/clients/{MARCO}", headers=ctx["ch"]).json()["profile"]
            p = {k: v for k, v in cur.items() if k != "hidden_sensitive"}
            p["anamnesis"] = {**(p.get("anamnesis") or {}), "TEST_note": "TEST_SECRET_ANAMNESIS"}
            p["share"] = {"trainer": True, "nutritionist": False}
            r = requests.put(f"{API}/clients/{MARCO}/profile", headers=ctx["ch"], json={"profile": p})
            assert r.status_code == 200, r.text
            raw = MDB.users.find_one({"_id": ObjectId(MARCO)})["profile"]
            assert "_sealed" in raw and "anamnesis" not in raw
            assert "TEST_SECRET_ANAMNESIS" not in str(raw)
            g = requests.get(f"{API}/clients/{MARCO}", headers=ctx["th"]).json()["profile"]
            assert g["anamnesis"]["TEST_note"] == "TEST_SECRET_ANAMNESIS"
            gn = requests.get(f"{API}/clients/{MARCO}", headers=ctx["nh"]).json()["profile"]
            assert gn.get("hidden_sensitive") is True and "anamnesis" not in gn
            # staff saving cannot wipe hidden data nor share choices
            gn2 = {**gn, "notes_TEST": "x"}
            r = requests.put(f"{API}/clients/{MARCO}/profile", headers=ctx["nh"], json={"profile": gn2})
            assert r.status_code == 200
            g = requests.get(f"{API}/clients/{MARCO}", headers=ctx["ch"]).json()["profile"]
            assert g["anamnesis"]["TEST_note"] == "TEST_SECRET_ANAMNESIS"
            assert g["share"]["nutritionist"] is False
        finally:
            MDB.users.update_one({"_id": ObjectId(MARCO)}, {"$set": {"profile": orig_profile}})
            # make sure sharing is ON for both after the test
            prof = requests.get(f"{API}/clients/{MARCO}", headers=ctx["ch"]).json()["profile"]
            prof["share"] = {"trainer": True, "nutritionist": True}
            requests.put(f"{API}/clients/{MARCO}/profile", headers=ctx["ch"], json={"profile": prof})
        fin = requests.get(f"{API}/clients/{MARCO}", headers=ctx["ch"]).json()["profile"]
        assert fin["share"] == {"trainer": True, "nutritionist": True}
        assert "TEST_note" not in (fin.get("anamnesis") or {})


# ---------- blood tests sealed ----------
class TestBloodSealed:
    def test_blood_sealed(self, ctx):
        r = requests.post(f"{API}/blood-tests", headers=ctx["xh"], json={"client_id": ctx["cid"], "date": TODAY, "lab": "TEST_lab",
                                                                         "values": [{"section": "Emo", "name": "TEST_Glicemia", "value": 87.5, "unit": "mg/dL"}],
                                                                         "notes": "TEST_bloodnote"})
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        ctx["blood"].append(bid)
        raw = MDB.blood_tests.find_one({"_id": ObjectId(bid)})
        assert "_sealed" in raw and "TEST_Glicemia" not in str(raw) and "TEST_bloodnote" not in str(raw)
        lst = requests.get(f"{API}/blood-tests", headers=ctx["nh"], params={"client_id": ctx["cid"]}).json()
        b = [x for x in lst if x["id"] == bid][0]
        assert b["values"][0]["name"] == "TEST_Glicemia" and b["values"][0]["value"] == 87.5 and b["notes"] == "TEST_bloodnote"


# ---------- chat sealed / e2e / keys / notification ----------
class TestChat:
    def test_chat_plain_sealed_and_notify(self, ctx):
        r = requests.post(f"{API}/chat/{ctx['cid']}", params={"thread": "nutri"}, headers=ctx["xh"], json={"text": "TEST_ciao_segreto"})
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        ctx["chat"].append(mid)
        assert r.json()["text"] == "TEST_ciao_segreto"
        raw = MDB.chat.find_one({"_id": ObjectId(mid)})
        assert "_sealed" in raw and "TEST_ciao_segreto" not in str(raw)
        msgs = requests.get(f"{API}/chat/{ctx['cid']}", params={"thread": "nutri"}, headers=ctx["nh"]).json()
        assert any(m["id"] == mid and m["text"] == "TEST_ciao_segreto" for m in msgs)
        n = MDB.notifications.find_one({"user_id": ctx["nu"]["id"], "link": {"$regex": ctx["cid"]}})
        assert n is not None
        MDB.notifications.delete_one({"_id": n["_id"]})

    def test_chat_e2e_and_keys(self, ctx):
        r = requests.put(f"{API}/me/public-key", headers=ctx["xh"], json={"public_key": "TESTpk" + "A" * 38})
        assert r.status_code == 200
        keys = requests.get(f"{API}/chat/{ctx['cid']}/keys", params={"thread": "nutri"}, headers=ctx["xh"]).json()
        assert keys[ctx["cid"]] == "TESTpk" + "A" * 38 and ctx["nu"]["id"] in keys
        e2e = {"nonce": "TESTnonce", "sender_pk": "TESTpk" + "A" * 38, "boxes": {ctx["cid"]: "CIPHER1", ctx["nu"]["id"]: "CIPHER2"}}
        r = requests.post(f"{API}/chat/{ctx['cid']}", params={"thread": "nutri"}, headers=ctx["xh"], json={"text": "", "e2e": e2e})
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        ctx["chat"].append(mid)
        raw = MDB.chat.find_one({"_id": ObjectId(mid)})
        assert raw["e2e"]["boxes"][ctx["nu"]["id"]] == "CIPHER2" and raw.get("text") == ""
        r = requests.post(f"{API}/chat/{ctx['cid']}", params={"thread": "nutri"}, headers=ctx["xh"], json={"text": "  "})
        assert r.status_code == 400
        MDB.notifications.delete_many({"user_id": ctx["nu"]["id"], "link": {"$regex": ctx["cid"]}})


# ---------- dashboard ----------
class TestDashboard:
    def test_dashboard_trainer(self, ctx):
        r = requests.get(f"{API}/dashboard", headers=ctx["th"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["clients"], int) and d["clients"] >= 1
        for k in ("online", "active_sessions", "next_appointments"):
            assert isinstance(d[k], list)
        assert isinstance(d["appointments_today"], int) and isinstance(d["appointments_week"], int)
        assert "monthly_estimate" in d["finance"] and "renewals_30d" in d["finance"]

    def test_dashboard_nutri_and_client_forbidden(self, ctx):
        assert requests.get(f"{API}/dashboard", headers=ctx["nh"]).status_code == 200
        assert requests.get(f"{API}/dashboard", headers=ctx["ch"]).status_code == 403


# ---------- exercise library ----------
class TestExercises:
    def test_library_tree_and_district(self, ctx):
        r = requests.get(f"{API}/exercises/library", headers=ctx["th"], timeout=60)
        assert r.status_code == 200, r.text
        assert "Petto" in r.json()["tree"]
        r = requests.get(f"{API}/exercises/library", headers=ctx["th"], params={"district": "Petto"}, timeout=60)
        items = r.json()["items"]
        assert len(items) > 0 and "name" in items[0]

    def test_mine_crud(self, ctx):
        r = requests.post(f"{API}/exercises/mine", headers=ctx["th"], json={"name": "TEST_Panca coach", "district": "Petto", "muscle": "chest"})
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        ctx["cex"].append(eid)
        mine = requests.get(f"{API}/exercises/library", headers=ctx["th"], params={"district": "Petto"}, timeout=60).json()["mine"]
        assert any(m["id"] == eid for m in mine)
        assert requests.post(f"{API}/exercises/mine", headers=ctx["ch"], json={"name": "TEST_x", "district": "Petto"}).status_code == 403
        assert requests.delete(f"{API}/exercises/mine/{eid}", headers=ctx["th"]).status_code == 200
        mine = requests.get(f"{API}/exercises/library", headers=ctx["th"], params={"district": "Petto"}, timeout=60).json()["mine"]
        assert not any(m["id"] == eid for m in mine)


# ---------- recent foods ----------
class TestRecentFoods:
    def test_recent_foods(self, ctx):
        for g in (200, 100):
            r = requests.post(f"{API}/meals", headers=ctx["xh"], json={"client_id": ctx["cid"], "date": TODAY, "meal_type": "pranzo",
                                                                     "name": "TEST_Riso", "grams": g, "kcal": 3.6 * g, "protein": 0.07 * g, "carbs": 0.8 * g, "fat": 0.01 * g})
            assert r.status_code == 200, r.text
            ctx["meals"].append(r.json()["id"])
        r = requests.get(f"{API}/foods/recent", headers=ctx["xh"], params={"client_id": ctx["cid"]})
        assert r.status_code == 200
        items = [x for x in r.json() if x["name"] == "TEST_Riso"]
        assert len(items) == 1 and items[0]["per100"]["kcal"] == 360


# ---------- nutrition: trainer advice vs nutritionist numbers ----------
class TestNutritionRoles:
    def test_trainer_advice_rules(self, ctx):
        cid = ctx["cid"]
        r = requests.put(f"{API}/clients/{cid}/nutrition", headers=ctx["nh"], json={"targets": {"kcal": 2000, "protein": 150},
                                                                                   "meal_plan": [{"meal": "Pranzo", "items": "Riso 100 g, pollo 150g"}]})
        assert r.status_code == 200, r.text
        r = requests.put(f"{API}/clients/{cid}/nutrition", headers=ctx["th"], json={"advice": "Mangia 100 g di riso"})
        assert r.status_code == 400
        r = requests.put(f"{API}/clients/{cid}/nutrition", headers=ctx["th"], json={"advice": "TEST_ Più verdure e acqua", "targets": {"kcal": 9999}})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["advice"] == "TEST_ Più verdure e acqua" and d["targets"].get("kcal") == 2000

    def test_hide_numbers_for_client(self, ctx):
        cid = ctx["cid"]
        r = requests.put(f"{API}/clients/{cid}/nutrition", headers=ctx["nh"], json={"targets": {"kcal": 2000}, "hide_numbers": True,
                                                                                   "meal_plan": [{"meal": "Pranzo", "items": "Riso 100 g, pollo 150g"}]})
        assert r.status_code == 200
        d = requests.get(f"{API}/clients/{cid}/nutrition", headers=ctx["xh"]).json()
        assert d["targets"] == {} and d["hide_numbers"] is True
        assert "100" not in d["meal_plan"][0]["items"] and "150" not in d["meal_plan"][0]["items"]
        assert requests.get(f"{API}/clients/{cid}/nutrition", headers=ctx["nh"]).json()["targets"]["kcal"] == 2000


# ---------- staff own plans ----------
class TestOwnPlans:
    def test_trainer_and_nutri_own_plan(self, ctx):
        for h, u in ((ctx["th"], ctx["tu"]), (ctx["nh"], ctx["nu"])):
            r = requests.post(f"{API}/plans", headers=h, json={"client_id": u["id"], "name": "TEST_own plan", "notify": False,
                                                               "days": [{"name": "A", "exercises": [{"name": "Squat", "sets": 3, "reps": "8"}]}]})
            assert r.status_code == 200, r.text
            ctx["plans"].append(r.json()["id"])
            lst = requests.get(f"{API}/plans", headers=h, params={"client_id": u["id"]}).json()
            assert any(p["id"] == r.json()["id"] for p in lst)

    def test_trainer_cannot_plan_random_user(self, ctx):
        r = requests.post(f"{API}/plans", headers=ctx["th"], json={"client_id": str(ObjectId()), "name": "TEST_x", "notify": False})
        assert r.status_code in (403, 404)
        r = requests.post(f"{API}/plans", headers=ctx["th"], json={"client_id": ctx["nu"]["id"], "name": "TEST_x", "notify": False})
        assert r.status_code in (403, 404)


# ---------- AI volume ----------
class TestAIVolume:
    def test_ai_volume_given_total(self, ctx):
        r = requests.post(f"{API}/ai/volume", headers=ctx["th"], timeout=120, json={"client_id": MARCO, "goal": "ipertrofia", "freq": "3",
                                                                                   "districts": ["Petto", "Dorso", "Gambe"], "given": {"totale": 14}})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "per_district" in d
        print("AI volume:", d)
