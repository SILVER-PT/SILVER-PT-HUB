# Iteration 6: manual payments (trainer marks renewal paid) + monthly income summary + client chat-unread
import os
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
TEST_PERIOD = "2099-01-05"  # far-future period so it never collides with the real current cycle


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d['access_token']}"}, d["user"]


@pytest.fixture(scope="module")
def ctx():
    th, tu = login("trainer@silverpt.it", "Trainer123!")
    ch, cu = login("cliente@silverpt.it", "Cliente123!")
    nh, _ = login("nutri@silverpt.it", "Nutri123!")
    created = []
    yield {"th": th, "ch": ch, "nh": nh, "cid": cu["id"], "created": created}
    for pid in created:
        requests.delete(f"{API}/payments/{pid}", headers=th)


def month_now():
    return datetime.now(timezone.utc).strftime("%Y-%m")


# --- summary shape
def test_summary_shape(ctx):
    r = requests.get(f"{API}/payments/summary", headers=ctx["th"])
    assert r.status_code == 200, r.text
    s = r.json()
    assert len(s) == 6
    assert s[-1]["month"] == month_now()
    assert all(set(m) >= {"month", "total", "count"} for m in s)
    assert [m["month"] for m in s] == sorted(m["month"] for m in s)


# --- create -> list -> summary -> duplicate 409 -> delete -> 404
def test_payment_lifecycle(ctx):
    th, cid = ctx["th"], ctx["cid"]
    before = requests.get(f"{API}/payments/summary", headers=th).json()[-1]
    r = requests.post(f"{API}/payments", headers=th, json={"client_id": cid, "amount": 714, "period": TEST_PERIOD})
    assert r.status_code == 200, r.text
    p = r.json()
    ctx["created"].append(p["id"])
    assert "_id" not in p and p["amount"] == 714 and p["period"] == TEST_PERIOD and p["client_id"] == cid
    assert p["paid_at"][:7] == month_now() and p["client_name"]

    lst = requests.get(f"{API}/payments", headers=th).json()
    assert any(x["id"] == p["id"] for x in lst)

    after = requests.get(f"{API}/payments/summary", headers=th).json()[-1]
    assert after["total"] == round(before["total"] + 714, 2)
    assert after["count"] == before["count"] + 1

    dup = requests.post(f"{API}/payments", headers=th, json={"client_id": cid, "amount": 714, "period": TEST_PERIOD})
    assert dup.status_code == 409

    d = requests.delete(f"{API}/payments/{p['id']}", headers=th)
    assert d.status_code == 200 and d.json()["ok"] is True
    ctx["created"].remove(p["id"])
    assert not any(x["id"] == p["id"] for x in requests.get(f"{API}/payments", headers=th).json())
    assert requests.get(f"{API}/payments/summary", headers=th).json()[-1]["total"] == before["total"]
    assert requests.delete(f"{API}/payments/{p['id']}", headers=th).status_code == 404


# --- permissions
@pytest.mark.parametrize("who", ["ch", "nh"])
def test_non_trainer_forbidden(ctx, who):
    h = ctx[who]
    assert requests.get(f"{API}/payments", headers=h).status_code == 403
    assert requests.get(f"{API}/payments/summary", headers=h).status_code == 403
    assert requests.post(f"{API}/payments", headers=h, json={"client_id": ctx["cid"], "amount": 1, "period": TEST_PERIOD}).status_code == 403
    assert requests.delete(f"{API}/payments/000000000000000000000000", headers=h).status_code == 403


def test_unauth_and_invalid(ctx):
    assert requests.get(f"{API}/payments").status_code in (401, 403)
    assert requests.delete(f"{API}/payments/not-an-id", headers=ctx["th"]).status_code == 404
    r = requests.post(f"{API}/payments", headers=ctx["th"], json={"client_id": ctx["cid"]})
    assert r.status_code == 422


def test_unknown_client_rejected(ctx):
    r = requests.post(f"{API}/payments", headers=ctx["th"], json={"client_id": "000000000000000000000000", "amount": 5, "period": TEST_PERIOD})
    assert r.status_code in (403, 404), r.text


# --- validation gaps (informational: expected to be rejected)
def test_negative_amount_rejected(ctx):
    r = requests.post(f"{API}/payments", headers=ctx["th"], json={"client_id": ctx["cid"], "amount": -50, "period": "2098-02-02"})
    if r.status_code == 200:
        ctx["created"].append(r.json()["id"])
    assert r.status_code in (400, 422), f"negative amount accepted: {r.status_code}"


def test_bad_period_rejected(ctx):
    r = requests.post(f"{API}/payments", headers=ctx["th"], json={"client_id": ctx["cid"], "amount": 5, "period": "garbage"})
    if r.status_code == 200:
        ctx["created"].append(r.json()["id"])
    assert r.status_code in (400, 422), f"invalid period accepted: {r.status_code}"


# --- client chat-unread counts trainer messages, cleared after client opens chat
def test_client_chat_unread(ctx):
    th, ch, cid = ctx["th"], ctx["ch"], ctx["cid"]
    base = requests.get(f"{API}/chat-unread", headers=ch).json().get(cid, 0)
    r = requests.post(f"{API}/chat/{cid}", headers=th, json={"text": "TEST_ v6 unread check"})
    assert r.status_code == 200, r.text
    assert requests.get(f"{API}/chat-unread", headers=ch).json().get(cid, 0) == base + 1
    assert requests.get(f"{API}/chat/{cid}", headers=ch).status_code == 200
    assert requests.get(f"{API}/chat-unread", headers=ch).json().get(cid, 0) == 0
