# Iteration 4: coach chat permission/unread, subscription chat flag, profile birth_date, measurements for charts
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d['access_token']}"}, d["user"]


@pytest.fixture(scope="module")
def ctx():
    th, tu = login("trainer@silverpt.it", "Trainer123!")
    ch, cu = login("cliente@silverpt.it", "Cliente123!")
    nh, nu = login("nutri@silverpt.it", "Nutri123!")
    client = requests.get(f"{API}/clients/{cu['id']}", headers=th).json()
    orig_sub = client.get("subscription")
    orig_profile = client.get("profile") or {}
    mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]
    yield {"th": th, "ch": ch, "nh": nh, "cid": cu["id"], "orig_sub": orig_sub, "orig_profile": orig_profile, "name": client["name"], "db": mongo}
    # restore state
    if orig_sub:
        requests.put(f"{API}/clients/{cu['id']}/settings", headers=th, json={"subscription": orig_sub})
    requests.put(f"{API}/clients/{cu['id']}/profile", headers=th, json={"name": client["name"], "profile": orig_profile})
    mongo.chat.delete_many({"client_id": cu["id"], "text": {"$regex": "^TEST_"}})
    mongo.measurements.delete_many({"client_id": cu["id"], "notes": {"$regex": "^TEST_"}})


# Chat: subscription chat flag
class TestChat:
    def test_orig_sub_has_chat(self, ctx):
        assert ctx["orig_sub"] and ctx["orig_sub"].get("chat") is True
        assert ctx["orig_sub"]["billing"] == "annuale"

    def test_client_send_and_trainer_unread(self, ctx):
        r = requests.post(f"{API}/chat/{ctx['cid']}", headers=ctx["ch"], json={"text": "TEST_ ciao coach"})
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["author_role"] == "client" and m["text"] == "TEST_ ciao coach" and "_id" not in m
        u = requests.get(f"{API}/chat-unread", headers=ctx["th"]).json()
        assert u.get(ctx["cid"], 0) >= 1

    def test_trainer_reads_marks_read(self, ctx):
        r = requests.get(f"{API}/chat/{ctx['cid']}", headers=ctx["th"])
        assert r.status_code == 200
        assert any(x["text"] == "TEST_ ciao coach" for x in r.json())
        u = requests.get(f"{API}/chat-unread", headers=ctx["th"]).json()
        assert u.get(ctx["cid"], 0) == 0

    def test_trainer_reply_client_unread(self, ctx):
        r = requests.post(f"{API}/chat/{ctx['cid']}", headers=ctx["th"], json={"text": "TEST_ risposta coach"})
        assert r.status_code == 200 and r.json()["author_role"] == "trainer"
        u = requests.get(f"{API}/chat-unread", headers=ctx["ch"]).json()
        assert u.get(ctx["cid"], 0) >= 1
        requests.get(f"{API}/chat/{ctx['cid']}", headers=ctx["ch"])
        u = requests.get(f"{API}/chat-unread", headers=ctx["ch"]).json()
        assert u.get(ctx["cid"], 0) == 0

    def test_empty_message_400(self, ctx):
        r = requests.post(f"{API}/chat/{ctx['cid']}", headers=ctx["ch"], json={"text": "   "})
        assert r.status_code in (400, 422)

    def test_nutritionist_forbidden(self, ctx):
        r = requests.get(f"{API}/chat/{ctx['cid']}", headers=ctx["nh"])
        assert r.status_code == 403

    def test_after_filter(self, ctx):
        msgs = requests.get(f"{API}/chat/{ctx['cid']}", headers=ctx["ch"]).json()
        last = msgs[-1]["created_at"]
        r = requests.get(f"{API}/chat/{ctx['cid']}", headers=ctx["ch"], params={"after": last})
        assert r.status_code == 200 and r.json() == []

    def test_no_chat_subscription_403(self, ctx):
        pkgs = requests.get(f"{API}/packages", headers=ctx["th"]).json()
        nochat = next(p for p in pkgs if not any("chat" in f.lower() for f in p.get("features", [])))
        # try to spoof chat flag: server must override
        sub = {"package_id": nochat["id"], "name": nochat["name"], "price": nochat["price"], "billing": nochat["billing"], "since": "2026-01-10", "chat": True}
        r = requests.put(f"{API}/clients/{ctx['cid']}/settings", headers=ctx["th"], json={"subscription": sub})
        assert r.status_code == 200
        assert r.json()["subscription"]["chat"] is False
        for h in (ctx["ch"], ctx["th"]):
            assert requests.get(f"{API}/chat/{ctx['cid']}", headers=h).status_code == 403
            assert requests.post(f"{API}/chat/{ctx['cid']}", headers=h, json={"text": "TEST_x"}).status_code == 403
        # restore
        r = requests.put(f"{API}/clients/{ctx['cid']}/settings", headers=ctx["th"], json={"subscription": ctx["orig_sub"]})
        assert r.json()["subscription"]["chat"] is True
        assert r.json()["subscription"]["since"] == ctx["orig_sub"]["since"]
        assert requests.get(f"{API}/chat/{ctx['cid']}", headers=ctx["ch"]).status_code == 200


# Profile birth date
class TestBirthDate:
    def test_birth_date_saves(self, ctx):
        prof = {**ctx["orig_profile"], "birth_date": "1985-03-15"}
        r = requests.put(f"{API}/clients/{ctx['cid']}/profile", headers=ctx["ch"], json={"name": ctx["name"], "profile": prof})
        assert r.status_code == 200
        g = requests.get(f"{API}/clients/{ctx['cid']}", headers=ctx["th"]).json()
        assert g["profile"]["birth_date"] == "1985-03-15"


# Measurements used by progress charts
class TestMeasurements:
    def test_create_two_measurements(self, ctx):
        for d, w, v in (("2025-12-01", 82.0, 90), ("2026-01-10", 80.5, 87)):
            r = requests.post(f"{API}/measurements", headers=ctx["th"], json={
                "client_id": ctx["cid"], "date": d, "weight": w, "height": 180, "circumferences": {"vita": v},
                "skinfolds": {"pettorale": 10, "addominale": 20, "coscia": 15}, "notes": "TEST_chart"})
            assert r.status_code == 200, r.text
            assert r.json()["body_fat"] > 0 and r.json()["bmi"] > 0
        lst = requests.get(f"{API}/measurements", headers=ctx["th"], params={"client_id": ctx["cid"]}).json()
        assert len([m for m in lst if m.get("notes") == "TEST_chart"]) == 2
