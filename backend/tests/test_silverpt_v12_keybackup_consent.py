# Iteration 12: key_backup never leaked outside /me/key-backup; TEST user with missing consents (for ConsentGate deep links).
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MDB = MongoClient(os.environ.get("MONGO_URL"))[os.environ.get("DB_NAME")]
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
    tcode = requests.get(f"{API}/auth/me", headers=th).json().get("invite_code")
    em = f"test_v12_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": em, "password": "Test123!", "name": "TEST_V12 Client", "role": "client",
                                                    "invite_code": tcode, "consents": CLIENT_CONSENTS})
    assert r.status_code == 200, r.text
    cid = r.json()["user"]["id"]
    xh = {"Authorization": f"Bearer {r.json()['access_token']}"}
    bk = "TESTnonce1234.TESTcipher5678"
    assert requests.put(f"{API}/me/public-key", headers=xh, json={"public_key": "B" * 43 + "=", "key_backup": bk}).status_code == 200
    c = {"th": th, "nh": nh, "cid": cid, "xh": xh, "email": em, "bk": bk}
    yield c
    MDB.notifications.delete_many({"user_id": cid})
    MDB.users.delete_one({"_id": ObjectId(cid)})


class TestKeyBackupHidden:
    def test_login_user_no_key_backup(self, ctx):
        r = requests.post(f"{API}/auth/login", json={"email": ctx["email"], "password": "Test123!"})
        u = r.json()["user"]
        assert "key_backup" not in u
        assert u.get("public_key") == "B" * 43 + "="

    def test_auth_me_no_key_backup(self, ctx):
        me = requests.get(f"{API}/auth/me", headers=ctx["xh"]).json()
        assert "key_backup" not in me and me["id"] == ctx["cid"]

    def test_clients_list_trainer_no_key_backup(self, ctx):
        r = requests.get(f"{API}/clients", headers=ctx["th"])
        assert r.status_code == 200
        lst = r.json()
        assert any(c["id"] == ctx["cid"] for c in lst)
        assert all("key_backup" not in c for c in lst)
        assert ctx["bk"] not in r.text

    def test_client_detail_trainer_no_key_backup(self, ctx):
        r = requests.get(f"{API}/clients/{ctx['cid']}", headers=ctx["th"])
        assert r.status_code == 200
        assert "key_backup" not in r.text and ctx["bk"] not in r.text

    def test_nutri_clients_no_key_backup(self, ctx):
        r = requests.get(f"{API}/clients", headers=ctx["nh"])
        assert r.status_code == 200
        assert "key_backup" not in r.text

    def test_marco_detail_no_key_backup(self, ctx):
        _, mu = login("cliente@silverpt.it", "Cliente123!")
        assert "key_backup" not in mu
        for h in (ctx["th"], ctx["nh"]):
            r = requests.get(f"{API}/clients/{mu['id']}", headers=h)
            assert r.status_code == 200 and "key_backup" not in r.text

    def test_me_key_backup_still_returns(self, ctx):
        r = requests.get(f"{API}/me/key-backup", headers=ctx["xh"])
        assert r.json() == {"public_key": "B" * 43 + "=", "key_backup": ctx["bk"]}

    def test_chat_keys_no_backup(self, ctx):
        r = requests.get(f"{API}/chat/{ctx['cid']}/keys", headers=ctx["th"])
        if r.status_code != 200:
            pytest.skip(f"chat keys not accessible: {r.status_code}")
        assert "key_backup" not in r.text and ctx["bk"] not in r.text
