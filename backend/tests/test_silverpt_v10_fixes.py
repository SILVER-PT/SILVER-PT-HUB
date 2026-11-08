# Iteration 10: retest of v9 fixes - nutritionist dashboard finance scoping, stricter trainer advice regex,
# daily_code Europe/Rome, E2E key backup endpoints.
import os
import uuid
import pytest
import requests
from datetime import datetime
from zoneinfo import ZoneInfo
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MDB = MongoClient(os.environ.get("MONGO_URL"))[os.environ.get("DB_NAME")]
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
    c = {"th": th, "tu": tu, "nh": nh, "nu": nu, "users": []}
    ncode = requests.get(f"{API}/auth/me", headers=nh).json().get("invite_code")
    em = f"test_v10_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": em, "password": "Test123!", "name": "TEST_V10 Client", "role": "client",
                                                    "invite_code": ncode, "consents": CLIENT_CONSENTS})
    assert r.status_code == 200, r.text
    c["cid"] = r.json()["user"]["id"]
    c["users"].append(c["cid"])
    c["xh"] = {"Authorization": f"Bearer {r.json()['access_token']}"}
    yield c
    for uid in c["users"]:
        MDB.notifications.delete_many({"link": {"$regex": uid}})
        MDB.notifications.delete_many({"user_id": uid})
        MDB.nutrition_plans.delete_many({"client_id": uid})
        MDB.users.delete_one({"_id": ObjectId(uid)})


# ---------- dashboard finance scoping ----------
class TestDashboardFinance:
    def test_nutri_finance_zero(self, ctx):
        d = requests.get(f"{API}/dashboard", headers=ctx["nh"]).json()
        f = d["finance"]
        assert d["clients"] >= 1
        assert f["monthly_estimate"] == 0 and f["paying_clients"] == 0 and f["renewals_30d"] == [] and f["renewals_30d_total"] == 0

    def test_trainer_finance_counts_marco(self, ctx):
        f = requests.get(f"{API}/dashboard", headers=ctx["th"]).json()["finance"]
        assert f["paying_clients"] >= 1 and f["monthly_estimate"] > 0

    def test_nutri_finance_counts_own_package(self, ctx):
        # temporarily give TEST client a subscription on a package owned by the nutritionist
        pid = MDB.packages.insert_one({"name": "TEST_V10 pkg", "owner_id": ctx["nu"]["id"], "team_id": ctx["nu"]["id"], "price": 120}).inserted_id
        try:
            MDB.users.update_one({"_id": ObjectId(ctx["cid"])}, {"$set": {"subscription": {"package_id": str(pid), "name": "TEST_V10 pkg", "price": 120,
                                                                                            "billing": "annuale", "since": "2026-01-05"}}})
            f = requests.get(f"{API}/dashboard", headers=ctx["nh"]).json()["finance"]
            assert f["paying_clients"] == 1 and f["monthly_estimate"] == 10.0
        finally:
            MDB.packages.delete_one({"_id": pid})
            MDB.users.update_one({"_id": ObjectId(ctx["cid"])}, {"$unset": {"subscription": ""}})


# ---------- trainer advice regex ----------
class TestAdvice:
    @pytest.mark.parametrize("txt", ["1 kg di pasta", "30% proteine", "Bilancia i macro", "200 ml di latte", "Mangia 100 g di riso", "1500 kcal al giorno"])
    def test_numeric_advice_rejected(self, ctx, txt):
        r = requests.put(f"{API}/clients/{ctx['cid']}/nutrition", headers=ctx["th"], json={"advice": txt})
        assert r.status_code == 400, (txt, r.text)

    def test_generic_advice_ok(self, ctx):
        r = requests.put(f"{API}/clients/{ctx['cid']}/nutrition", headers=ctx["th"], json={"advice": "TEST_ Più verdure, 2 frutti al giorno e acqua"})
        assert r.status_code == 200, r.text
        d = requests.get(f"{API}/clients/{ctx['cid']}/nutrition", headers=ctx["nh"]).json()
        assert d["advice"].startswith("TEST_ Più verdure")


# ---------- daily code Europe/Rome ----------
class TestDailyCode:
    def test_code_matches_rome_day(self, ctx):
        import sys
        sys.path.insert(0, "/app/backend")
        from server import daily_code  # noqa
        rome = datetime.now(ZoneInfo("Europe/Rome")).strftime("%Y-%m-%d")
        me = requests.get(f"{API}/auth/me", headers=ctx["th"]).json()
        assert me["invite_code"] == daily_code(ctx["tu"]["id"], rome)


# ---------- E2E key backup ----------
class TestKeyBackup:
    def test_put_and_get_backup(self, ctx):
        pk = "A" * 43 + "="
        r = requests.put(f"{API}/me/public-key", headers=ctx["xh"], json={"public_key": pk, "key_backup": "TESTnonce.TESTcipher"})
        assert r.status_code == 200
        d = requests.get(f"{API}/me/key-backup", headers=ctx["xh"]).json()
        assert d == {"public_key": pk, "key_backup": "TESTnonce.TESTcipher"}

    def test_put_without_backup_keeps_old(self, ctx):
        pk2 = "B" * 43 + "="
        r = requests.put(f"{API}/me/public-key", headers=ctx["xh"], json={"public_key": pk2})
        # v11: key_backup is mandatory -> pk-only PUT rejected, old pair kept
        assert r.status_code == 422
        d = requests.get(f"{API}/me/key-backup", headers=ctx["xh"]).json()
        assert d["public_key"] == "A" * 43 + "="

    def test_backup_requires_auth(self):
        assert requests.get(f"{API}/me/key-backup").status_code in (401, 403)

    def test_backup_too_long_rejected(self, ctx):
        r = requests.put(f"{API}/me/public-key", headers=ctx["xh"], json={"public_key": "C" * 44, "key_backup": "x" * 500})
        assert r.status_code == 422
