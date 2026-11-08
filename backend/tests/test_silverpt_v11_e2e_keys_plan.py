# Iteration 11: E2E public key now requires key_backup; key data exposure; nutrition plan (hide_numbers) item format.
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
    nh, nu = login("nutri@silverpt.it", "Nutri123!")
    th, tu = login("trainer@silverpt.it", "Trainer123!")
    ncode = requests.get(f"{API}/auth/me", headers=nh).json().get("invite_code")
    em = f"test_v11_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": em, "password": "Test123!", "name": "TEST_V11 Client", "role": "client",
                                                    "invite_code": ncode, "consents": CLIENT_CONSENTS})
    assert r.status_code == 200, r.text
    c = {"nh": nh, "th": th, "cid": r.json()["user"]["id"], "xh": {"Authorization": f"Bearer {r.json()['access_token']}"}}
    yield c
    MDB.notifications.delete_many({"user_id": c["cid"]})
    MDB.nutrition_plans.delete_many({"client_id": c["cid"]})
    MDB.users.delete_one({"_id": ObjectId(c["cid"])})


# ---------- E2E key: public key always with backup ----------
class TestPublicKey:
    def test_put_without_backup_422(self, ctx):
        r = requests.put(f"{API}/me/public-key", headers=ctx["xh"], json={"public_key": "A" * 43 + "="})
        assert r.status_code == 422
        assert requests.get(f"{API}/me/key-backup", headers=ctx["xh"]).json()["public_key"] is None

    def test_put_with_backup_persists(self, ctx):
        pk = "B" * 43 + "="
        r = requests.put(f"{API}/me/public-key", headers=ctx["xh"], json={"public_key": pk, "key_backup": "TESTnonce1234.TESTcipher5678"})
        assert r.status_code == 200
        assert requests.get(f"{API}/me/key-backup", headers=ctx["xh"]).json() == {"public_key": pk, "key_backup": "TESTnonce1234.TESTcipher5678"}

    def test_empty_backup_422(self, ctx):
        r = requests.put(f"{API}/me/public-key", headers=ctx["xh"], json={"public_key": "C" * 43 + "=", "key_backup": ""})
        assert r.status_code == 422

    def test_auth_me_exposes_own_pk(self, ctx):
        me = requests.get(f"{API}/auth/me", headers=ctx["xh"]).json()
        assert me.get("public_key") == "B" * 43 + "="
        print("auth/me contains key_backup:", "key_backup" in me)

    def test_staff_cannot_see_client_key_backup(self, ctx):
        # nutritionist views the client -> backup (encrypted secret key) should not be exposed to others
        r = requests.get(f"{API}/clients/{ctx['cid']}", headers=ctx["nh"])
        assert r.status_code == 200, r.text
        body = r.text
        assert "TESTcipher5678" not in body, "key_backup leaked in /clients/{id}"

    def test_staff_clients_list_no_backup(self, ctx):
        r = requests.get(f"{API}/clients", headers=ctx["nh"])
        assert r.status_code == 200
        assert "TESTcipher5678" not in r.text, "key_backup leaked in /clients"


# ---------- nutrition plan: hide_numbers strips grams, multiple 'colazione' meals ----------
class TestPlanItems:
    def test_hide_numbers_item_format(self, ctx):
        plan = {"targets": {"kcal": 2000}, "meal_plan": [{"meal": "Colazione", "items": "100g di insalata, 1,5 mele"},
                                                           {"meal": "Seconda colazione", "items": "100g d'orzo"}],
                "notes": "", "hide_numbers": True}
        r = requests.put(f"{API}/clients/{ctx['cid']}/nutrition", headers=ctx["nh"], json=plan)
        assert r.status_code == 200, r.text
        d = requests.get(f"{API}/clients/{ctx['cid']}/nutrition", headers=ctx["xh"]).json()
        print("client view:", d["meal_plan"])
        assert d["targets"] == {}
        assert len(d["meal_plan"]) == 2
        assert "100g" not in d["meal_plan"][0]["items"]
        assert "insalata" in d["meal_plan"][0]["items"]
