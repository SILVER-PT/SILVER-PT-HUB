# Iteration 5: DELETE /api/measurements/{id} permissions + /api/chat-unread per-client counts
import os
import uuid
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
    th, _ = login("trainer@silverpt.it", "Trainer123!")
    _, cu = login("cliente@silverpt.it", "Cliente123!")
    nh, _ = login("nutri@silverpt.it", "Nutri123!")
    # fresh TEST_ client so visibility toggles never race with other suites on the seeded client
    me = requests.get(f"{API}/auth/me", headers=th).json()
    r = requests.post(f"{API}/auth/register", json={"email": f"test_v5_{uuid.uuid4().hex[:6]}@x.it", "password": "Test123!",
                                                    "name": "TEST_V5", "role": "client", "invite_code": me["invite_code"]})
    assert r.status_code == 200, r.text
    tmp = r.json()
    ch = {"Authorization": f"Bearer {tmp['access_token']}"}
    db = MongoClient(os.environ.get("MONGO_URL"))[os.environ.get("DB_NAME")]
    count_before = db.measurements.count_documents({"client_id": cu["id"]})
    yield {"th": th, "ch": ch, "nh": nh, "cid": cu["id"], "tmp": tmp["user"]["id"], "db": db}
    # restore state
    from bson import ObjectId
    db.measurements.delete_many({"client_id": tmp["user"]["id"]})
    db.users.delete_one({"_id": ObjectId(tmp["user"]["id"])})
    db.measurements.delete_many({"client_id": cu["id"], "notes": {"$regex": "^TEST_"}})
    db.chat.delete_many({"client_id": cu["id"], "text": {"$regex": "^TEST_"}})
    assert db.measurements.count_documents({"client_id": cu["id"]}) == count_before


def make_meas(ctx, note, cid=None):
    r = requests.post(f"{API}/measurements", headers=ctx["th"], json={"client_id": cid or ctx["cid"], "date": "2025-01-05", "weight": 80, "notes": note, "circumferences": {}, "skinfolds": {}})
    assert r.status_code == 200, r.text
    return r.json()["id"]


# Measurement deletion
class TestMeasurementDelete:
    def test_trainer_delete_then_gone(self, ctx):
        mid = make_meas(ctx, "TEST_del_trainer")
        r = requests.delete(f"{API}/measurements/{mid}", headers=ctx["th"])
        assert r.status_code == 200 and r.json() == {"ok": True}
        lst = requests.get(f"{API}/measurements?client_id={ctx['cid']}", headers=ctx["th"]).json()
        assert mid not in [m["id"] for m in lst]
        r2 = requests.delete(f"{API}/measurements/{mid}", headers=ctx["th"])
        assert r2.status_code == 404

    def test_client_hidden_403(self, ctx):
        requests.put(f"{API}/clients/{ctx['tmp']}/settings", headers=ctx["th"], json={"visibility": {"measurements": False}})
        mid = make_meas(ctx, "TEST_del_client_hidden", ctx["tmp"])
        r = requests.delete(f"{API}/measurements/{mid}", headers=ctx["ch"])
        assert r.status_code == 403
        lst = requests.get(f"{API}/measurements?client_id={ctx['tmp']}", headers=ctx["th"]).json()
        assert mid in [m["id"] for m in lst]

    def test_client_visible_ok(self, ctx):
        requests.put(f"{API}/clients/{ctx['tmp']}/settings", headers=ctx["th"], json={"visibility": {"measurements": True}})
        mid = make_meas(ctx, "TEST_del_client_visible", ctx["tmp"])
        r = requests.delete(f"{API}/measurements/{mid}", headers=ctx["ch"])
        assert r.status_code == 200

    def test_nutritionist_forbidden(self, ctx):
        mid = make_meas(ctx, "TEST_del_nutri")
        r = requests.delete(f"{API}/measurements/{mid}", headers=ctx["nh"])
        assert r.status_code == 403

    def test_invalid_id(self, ctx):
        r = requests.delete(f"{API}/measurements/notanid", headers=ctx["th"])
        assert r.status_code in (400, 404, 422)

    def test_unauth(self, ctx):
        r = requests.delete(f"{API}/measurements/000000000000000000000000")
        assert r.status_code in (401, 403)


# Chat unread counts
class TestUnread:
    def test_unread_counts(self, ctx):
        requests.get(f"{API}/chat/{ctx['cid']}", headers=ctx["th"])  # mark read
        ch, _ = login("cliente@silverpt.it", "Cliente123!")
        for i in range(2):
            assert requests.post(f"{API}/chat/{ctx['cid']}", headers=ch, json={"text": f"TEST_unread_{i}"}).status_code == 200
        u = requests.get(f"{API}/chat-unread", headers=ctx["th"]).json()
        assert u.get(ctx["cid"]) == 2
        requests.get(f"{API}/chat/{ctx['cid']}", headers=ctx["th"])
        u = requests.get(f"{API}/chat-unread", headers=ctx["th"]).json()
        assert ctx["cid"] not in u
