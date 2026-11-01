# SILVER-PT backend regression tests: auth, clients, appointments, measurements, plans/sessions/progress, media, nutrition
import base64
import os
import uuid
import pytest
import requests


def _base():
    url = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
    return url.rstrip("/")


BASE = _base() + "/api"
TRAINER = {"email": "trainer@silverpt.it", "password": "Trainer123!"}
CLIENT = {"email": "cliente@silverpt.it", "password": "Cliente123!"}


def login(creds):
    r = requests.post(f"{BASE}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def ctx():
    t = login(TRAINER)
    c = login(CLIENT)
    d = {"t": t["access_token"], "c": c["access_token"], "trainer": t["user"], "client": c["user"]}
    d["cid"] = c["user"]["id"]
    # second client of same trainer (for cross-access test)
    r = requests.post(f"{BASE}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:6]}@x.it", "password": "Test123!",
                                                     "name": "TEST_Other", "role": "client",
                                                     "invite_code": t["user"]["invite_code"]})
    assert r.status_code == 200, r.text
    d["other_tok"] = r.json()["access_token"]
    d["other_id"] = r.json()["user"]["id"]
    # second trainer
    r = requests.post(f"{BASE}/auth/register", json={"email": f"test_tr_{uuid.uuid4().hex[:6]}@x.it", "password": "Test123!",
                                                     "name": "TEST_Trainer2", "role": "trainer"})
    assert r.status_code == 200
    d["t2"] = r.json()["access_token"]
    return d


# --- auth
class TestAuth:
    def test_login_and_me(self, ctx):
        assert ctx["trainer"]["role"] == "trainer" and ctx["trainer"].get("invite_code")
        assert "_id" not in ctx["trainer"] and "password_hash" not in ctx["trainer"]
        r = requests.get(f"{BASE}/auth/me", headers=H(ctx["c"]))
        assert r.status_code == 200 and r.json()["email"] == CLIENT["email"]
        assert r.json()["trainer_id"] == ctx["trainer"]["id"]

    def test_bad_login_and_invalid_invite(self):
        assert requests.post(f"{BASE}/auth/login", json={"email": TRAINER["email"], "password": "x"}).status_code == 401
        r = requests.post(f"{BASE}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:6]}@x.it", "password": "Test123!",
                                                         "name": "X", "role": "client", "invite_code": "ZZZZZZ"})
        assert r.status_code == 400
        assert requests.get(f"{BASE}/auth/me").status_code == 401

    def test_duplicate_email(self):
        r = requests.post(f"{BASE}/auth/register", json={**TRAINER, "name": "dup", "role": "trainer"})
        assert r.status_code == 409


# --- clients & access control
class TestClients:
    def test_list_clients_trainer_only(self, ctx):
        r = requests.get(f"{BASE}/clients", headers=H(ctx["t"]))
        assert r.status_code == 200 and any(c["id"] == ctx["cid"] for c in r.json())
        assert requests.get(f"{BASE}/clients", headers=H(ctx["c"])).status_code == 403

    def test_access_control(self, ctx):
        assert requests.get(f"{BASE}/clients/{ctx['cid']}", headers=H(ctx["t"])).status_code == 200
        assert requests.get(f"{BASE}/clients/{ctx['other_id']}", headers=H(ctx["c"])).status_code == 403
        assert requests.get(f"{BASE}/clients/{ctx['cid']}", headers=H(ctx["t2"])).status_code == 403

    def test_profile_update(self, ctx):
        r = requests.put(f"{BASE}/clients/{ctx['cid']}/profile", headers=H(ctx["t"]),
                         json={"profile": {"sex": "M", "birth_date": "1990-05-10", "goal": "TEST"}})
        assert r.status_code == 200 and r.json()["profile"]["sex"] == "M"
        g = requests.get(f"{BASE}/clients/{ctx['cid']}", headers=H(ctx["c"])).json()
        assert g["profile"]["birth_date"] == "1990-05-10"


# --- appointments
class TestAppointments:
    def test_crud_status_comments(self, ctx):
        r = requests.post(f"{BASE}/appointments", headers=H(ctx["t"]),
                          json={"client_id": ctx["cid"], "title": "TEST_Allenamento", "start": "2026-02-01T10:00:00"})
        assert r.status_code == 200 and r.json()["status"] == "confirmed"
        aid = r.json()["id"]
        rc = requests.post(f"{BASE}/appointments", headers=H(ctx["c"]), json={"title": "TEST_Req", "start": "2026-02-02T10:00:00"})
        assert rc.status_code == 200 and rc.json()["status"] == "requested"
        lst = requests.get(f"{BASE}/appointments", headers=H(ctx["c"])).json()
        assert any(a["id"] == aid for a in lst)
        assert requests.put(f"{BASE}/appointments/{aid}/status", headers=H(ctx["t"]), json={"status": "done"}).status_code == 200
        assert requests.put(f"{BASE}/appointments/{aid}/status", headers=H(ctx["t"]), json={"status": "xx"}).status_code == 400
        assert requests.post(f"{BASE}/appointments/{aid}/comments", headers=H(ctx["c"]), json={"text": "ok"}).status_code == 200
        d = requests.get(f"{BASE}/appointments/{aid}", headers=H(ctx["t"])).json()
        assert d["status"] == "done" and d["comments"][-1]["text"] == "ok"
        assert requests.get(f"{BASE}/appointments/{aid}", headers=H(ctx["other_tok"])).status_code == 403


# --- measurements JP3 + Siri
class TestMeasurements:
    def test_jp3_bodyfat(self, ctx):
        requests.put(f"{BASE}/clients/{ctx['cid']}/profile", headers=H(ctx["t"]),
                     json={"profile": {"sex": "M", "birth_date": "1990-05-10"}})
        r = requests.post(f"{BASE}/measurements", headers=H(ctx["t"]), json={
            "client_id": ctx["cid"], "date": "2026-01-10", "weight": 80, "height": 180,
            "circumferences": {"vita": 85}, "skinfolds": {"pettorale": 10, "addominale": 20, "coscia": 15}})
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["method"] == "Jackson-Pollock 3 pliche" and m["sum_folds"] == 45
        assert 10 < m["body_fat"] < 16, m["body_fat"]
        assert m["bmi"] == 24.7 and abs(m["fat_mass"] + m["lean_mass"] - 80) < 0.2
        lst = requests.get(f"{BASE}/measurements", params={"client_id": ctx["cid"]}, headers=H(ctx["t"])).json()  # trainer: client measurements hidden by default since v3
        assert any(x["id"] == m["id"] for x in lst)
        ctx.setdefault("mids", []).append(m["id"])

    # iteration 2: invalid skinfold -> 400, comma decimals accepted
    def test_invalid_skinfold_400(self, ctx):
        r = requests.post(f"{BASE}/measurements", headers=H(ctx["t"]), json={
            "client_id": ctx["cid"], "date": "2026-01-11", "skinfolds": {"pettorale": "abc", "addominale": 20, "coscia": 15}})
        assert r.status_code == 400, f"got {r.status_code} {r.text}"

    def test_comma_skinfold_ok(self, ctx):
        r = requests.post(f"{BASE}/measurements", headers=H(ctx["t"]), json={
            "client_id": ctx["cid"], "date": "2026-01-11", "weight": 79.5,
            "skinfolds": {"pettorale": "10,5", "addominale": "20", "coscia": 15}})
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["sum_folds"] == 45.5, m
        assert m["weight"] == 79.5
        ctx.setdefault("mids", []).append(m["id"])


# --- plans, sessions, progress
class TestPlansSessions:
    def test_full_flow(self, ctx):
        plan = {"client_id": ctx["cid"], "name": "TEST_Scheda", "days": [
            {"name": "Giorno A", "exercises": [{"name": "TEST_Panca", "sets": 2, "reps": "8", "load": "60", "rir": "2"}]}]}
        assert requests.post(f"{BASE}/plans", headers=H(ctx["c"]), json=plan).status_code == 403
        r = requests.post(f"{BASE}/plans", headers=H(ctx["t"]), json=plan)
        assert r.status_code == 200
        pid = r.json()["id"]
        plan["name"] = "TEST_Scheda2"
        u = requests.put(f"{BASE}/plans/{pid}", headers=H(ctx["t"]), json=plan)
        assert u.status_code == 200 and u.json()["name"] == "TEST_Scheda2"
        assert any(p["id"] == pid for p in requests.get(f"{BASE}/plans", params={"client_id": ctx["cid"]}, headers=H(ctx["c"])).json())
        s = requests.post(f"{BASE}/sessions", headers=H(ctx["c"]), json={"plan_id": pid, "day_index": 0})
        assert s.status_code == 200 and len(s.json()["exercises"][0]["sets"]) == 2
        sess = s.json()
        for st in sess["exercises"][0]["sets"]:
            st.update({"done_reps": 8, "done_load": 62.5, "done_rir": 1, "execution": 8, "completed": True})
        f = requests.put(f"{BASE}/sessions/{sess['id']}", headers=H(ctx["c"]), json={"exercises": sess["exercises"], "finish": True})
        assert f.status_code == 200 and f.json()["status"] == "completed"
        pr = requests.get(f"{BASE}/progress", params={"client_id": ctx["cid"]}, headers=H(ctx["t"])).json()
        pt = pr["TEST_Panca"][-1]
        assert pt["max_load"] == 62.5 and pt["total_reps"] == 16 and pt["volume"] == 1000
        assert requests.post(f"{BASE}/sessions/{sess['id']}/comments", headers=H(ctx["t"]), json={"text": "bravo"}).status_code == 200
        assert requests.get(f"{BASE}/sessions/{sess['id']}", headers=H(ctx["c"])).json()["comments"][-1]["text"] == "bravo"
        ctx["pid"] = pid

    def test_session_bad_day_index(self, ctx):
        r = requests.post(f"{BASE}/sessions", headers=H(ctx["c"]), json={"plan_id": ctx["pid"], "day_index": 9})
        assert r.status_code == 400, f"got {r.status_code}"
        r = requests.post(f"{BASE}/sessions", headers=H(ctx["c"]), json={"plan_id": ctx["pid"], "day_index": -1})
        assert r.status_code == 400, f"negative day_index got {r.status_code}"

    def test_other_trainer_cannot_update_plan(self, ctx):
        # trainer2 registers own client and tries to overwrite trainer1's plan
        t2me = requests.get(f"{BASE}/auth/me", headers=H(ctx["t2"])).json()
        r = requests.post(f"{BASE}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:6]}@x.it", "password": "Test123!",
                                                         "name": "TEST_C2", "role": "client", "invite_code": t2me["invite_code"]})
        c2 = r.json()["user"]["id"]
        u = requests.put(f"{BASE}/plans/{ctx['pid']}", headers=H(ctx["t2"]),
                         json={"client_id": c2, "name": "HACKED", "days": []})
        assert u.status_code == 403, f"got {u.status_code}"
        # also without client_id override
        u2 = requests.put(f"{BASE}/plans/{ctx['pid']}", headers=H(ctx["t2"]), json={"client_id": ctx["cid"], "name": "HACKED", "days": []})
        assert u2.status_code == 403, f"got {u2.status_code}"
        p = requests.get(f"{BASE}/plans/{ctx['pid']}", headers=H(ctx["t"])).json()
        assert p["name"] != "HACKED", "IDOR: other trainer overwrote plan"


# --- media
class TestMedia:
    def test_upload_photo_video_comments(self, ctx):
        img = open("/tmp/food.jpg", "rb").read()
        r = requests.post(f"{BASE}/upload", headers=H(ctx["c"]), files={"file": ("front.jpg", img, "image/jpeg")}, timeout=60)
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        g = requests.get(f"{BASE}/files/{path}", params={"token": ctx["t"]}, timeout=60)
        assert g.status_code == 200 and len(g.content) == len(img)
        assert requests.get(f"{BASE}/files/{path}", params={"token": ctx["other_tok"]}).status_code == 403
        p = requests.post(f"{BASE}/photos", headers=H(ctx["c"]), json={"client_id": ctx["cid"], "kind": "front", "path": path, "date": "2026-01-10"})
        assert p.status_code == 200
        assert any(x["id"] == p.json()["id"] for x in requests.get(f"{BASE}/photos", params={"client_id": ctx["cid"]}, headers=H(ctx["t"])).json())
        v = requests.post(f"{BASE}/videos", headers=H(ctx["c"]), json={"client_id": ctx["cid"], "path": path, "exercise": "TEST_Squat"})
        assert v.status_code == 200 and v.json()["reviewed"] is False
        vid = v.json()["id"]
        assert requests.post(f"{BASE}/videos/{vid}/comments", headers=H(ctx["t"]), json={"text": "scendi di più"}).status_code == 200
        d = requests.get(f"{BASE}/videos/{vid}", headers=H(ctx["c"])).json()
        assert d["reviewed"] is True and d["comments"][-1]["author_role"] == "trainer"
        assert any(x["id"] == vid for x in requests.get(f"{BASE}/videos", headers=H(ctx["t"])).json())


# --- nutrition
class TestNutrition:
    def test_barcode(self, ctx):
        r = requests.get(f"{BASE}/food/barcode/8076809513753", headers=H(ctx["c"]), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["per100"]["kcal"] > 0
        assert requests.get(f"{BASE}/food/barcode/0000000000000", headers=H(ctx["c"]), timeout=30).status_code == 404

    def test_analyze_ai(self, ctx):
        b64 = base64.b64encode(open("/tmp/food.jpg", "rb").read()).decode()
        r = requests.post(f"{BASE}/food/analyze", headers=H(ctx["c"]), json={"image_base64": b64}, timeout=180)
        assert r.status_code == 200, r.text
        j = r.json()
        print("AI:", j)
        assert j.get("name") and float(j.get("kcal", 0)) > 0

    def test_meals_crud(self, ctx):
        r = requests.post(f"{BASE}/meals", headers=H(ctx["c"]), json={"date": "2026-01-10", "meal_type": "pranzo", "name": "TEST_Pasta", "kcal": 350, "protein": 12})
        assert r.status_code == 200
        mid = r.json()["id"]
        lst = requests.get(f"{BASE}/meals", params={"client_id": ctx["cid"], "date": "2026-01-10"}, headers=H(ctx["t"])).json()
        assert any(m["id"] == mid for m in lst)
        assert requests.delete(f"{BASE}/meals/{mid}", headers=H(ctx["other_tok"])).status_code == 403
        assert requests.delete(f"{BASE}/meals/{mid}", headers=H(ctx["c"])).status_code == 200
        lst = requests.get(f"{BASE}/meals", params={"client_id": ctx["cid"], "date": "2026-01-10"}, headers=H(ctx["c"])).json()
        assert not any(m["id"] == mid for m in lst)

    def test_invalid_object_id(self, ctx):
        r = requests.get(f"{BASE}/plans/notanid", headers=H(ctx["c"]))
        assert r.status_code in (400, 404), f"got {r.status_code}"
