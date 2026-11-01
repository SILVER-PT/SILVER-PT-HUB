# SILVER-PT iteration 3: visibility, nutritionist role, nutrition plan, diary/team notes, packages, questions, plans history, measurements edit, /me
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
NUTRI = {"email": "nutri@silverpt.it", "password": "Nutri123!"}
TODAY = "2026-01-15"


def login(creds):
    r = requests.post(f"{BASE}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def ctx():
    t, c, n = login(TRAINER), login(CLIENT), login(NUTRI)
    d = {"t": t["access_token"], "c": c["access_token"], "n": n["access_token"], "trainer": t["user"],
         "client": c["user"], "nutri": n["user"], "cid": c["user"]["id"]}
    orig = requests.get(f"{BASE}/clients/{d['cid']}", headers=H(d["t"])).json()
    d["orig"] = {"visibility": orig.get("visibility") or {}, "nutritionist_id": orig.get("nutritionist_id") or "",
                 "subscription": orig.get("subscription") or {}}
    d["orig_nut"] = requests.get(f"{BASE}/clients/{d['cid']}/nutrition", headers=H(d["t"])).json()
    # other client not assigned to nutri
    r = requests.post(f"{BASE}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:6]}@x.it", "password": "Test123!",
                                                     "name": "TEST_Other", "role": "client",
                                                     "invite_code": t["user"]["invite_code"]})
    d["other"] = r.json()["user"]["id"]
    d["cleanup"] = []
    yield d
    # restore client settings and nutrition plan
    requests.put(f"{BASE}/clients/{d['cid']}/settings", headers=H(d["t"]), json=d["orig"])
    on = d["orig_nut"]
    requests.put(f"{BASE}/clients/{d['cid']}/nutrition", headers=H(d["t"]),
                 json={"targets": on.get("targets") or {}, "meal_plan": on.get("meal_plan") or [], "notes": on.get("notes") or ""})
    for kind, _id in d["cleanup"]:
        requests.delete(f"{BASE}/{kind}/{_id}", headers=H(d["t"] if kind != "packages-n" else d["n"]))


def set_vis(ctx, **vis):
    v = {"measurements": False, "photos": False, "nutrition": False, **vis}
    r = requests.put(f"{BASE}/clients/{ctx['cid']}/settings", headers=H(ctx["t"]), json={"visibility": v})
    assert r.status_code == 200 and r.json()["visibility"] == v


# Visibility toggles
class TestVisibility:
    def test_client_cannot_set_settings(self, ctx):
        r = requests.put(f"{BASE}/clients/{ctx['cid']}/settings", headers=H(ctx["c"]), json={"visibility": {"measurements": True}})
        assert r.status_code == 403

    def test_hidden_measurements_photos_403(self, ctx):
        set_vis(ctx)
        assert requests.get(f"{BASE}/measurements", params={"client_id": ctx["cid"]}, headers=H(ctx["c"])).status_code == 403
        assert requests.get(f"{BASE}/photos", params={"client_id": ctx["cid"]}, headers=H(ctx["c"])).status_code == 403
        assert requests.get(f"{BASE}/measurements", params={"client_id": ctx["cid"]}, headers=H(ctx["t"])).status_code == 200

    def test_visible_measurements_photos_200(self, ctx):
        set_vis(ctx, measurements=True, photos=True)
        assert requests.get(f"{BASE}/measurements", params={"client_id": ctx["cid"]}, headers=H(ctx["c"])).status_code == 200
        assert requests.get(f"{BASE}/photos", params={"client_id": ctx["cid"]}, headers=H(ctx["c"])).status_code == 200
        set_vis(ctx)

    def test_meals_stripped_when_nutrition_hidden(self, ctx):
        set_vis(ctx)
        r = requests.post(f"{BASE}/meals", headers=H(ctx["c"]), json={"date": TODAY, "meal_type": "pranzo", "name": "TEST_Pasta",
                                                                      "grams": 120, "kcal": 450, "protein": 15, "carbs": 80, "fat": 6})
        assert r.status_code == 200
        ctx["meal_id"] = r.json()["id"]
        m = requests.get(f"{BASE}/meals", params={"client_id": ctx["cid"], "date": TODAY}, headers=H(ctx["c"])).json()
        mine = [x for x in m if x["id"] == ctx["meal_id"]][0]
        assert all(k not in mine for k in ("kcal", "protein", "carbs", "fat", "grams"))
        h = requests.get(f"{BASE}/meals/history", params={"client_id": ctx["cid"]}, headers=H(ctx["c"])).json()
        day = [x for x in h if x["date"] == TODAY][0]
        assert "kcal" not in day and all("kcal" not in i for i in day["items"])
        # trainer sees numbers
        tm = requests.get(f"{BASE}/meals", params={"client_id": ctx["cid"], "date": TODAY}, headers=H(ctx["t"])).json()
        assert [x for x in tm if x["id"] == ctx["meal_id"]][0]["kcal"] == 450
        th = requests.get(f"{BASE}/meals/history", params={"client_id": ctx["cid"]}, headers=H(ctx["t"])).json()
        assert [x for x in th if x["date"] == TODAY][0]["kcal"] >= 450

    def test_meals_numbers_when_visible(self, ctx):
        set_vis(ctx, nutrition=True)
        m = requests.get(f"{BASE}/meals", params={"client_id": ctx["cid"], "date": TODAY}, headers=H(ctx["c"])).json()
        assert [x for x in m if x["id"] == ctx["meal_id"]][0]["kcal"] == 450
        set_vis(ctx)
        requests.delete(f"{BASE}/meals/{ctx['meal_id']}", headers=H(ctx["c"]))


# Nutritionist role & assignment
class TestNutritionist:
    def test_nutri_register_requires_invite(self):
        r = requests.post(f"{BASE}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:6]}@x.it", "password": "Test123!",
                                                         "name": "TEST_N", "role": "nutritionist", "invite_code": "XXXXXX"})
        assert r.status_code == 400

    def test_assign_and_list(self, ctx):
        r = requests.put(f"{BASE}/clients/{ctx['cid']}/settings", headers=H(ctx["t"]), json={"nutritionist_id": ctx["nutri"]["id"]})
        assert r.status_code == 200 and r.json()["nutritionist_id"] == ctx["nutri"]["id"]
        ids = [c["id"] for c in requests.get(f"{BASE}/clients", headers=H(ctx["n"])).json()]
        assert ctx["cid"] in ids and ctx["other"] not in ids

    def test_assign_invalid_nutri_404(self, ctx):
        r = requests.put(f"{BASE}/clients/{ctx['cid']}/settings", headers=H(ctx["t"]), json={"nutritionist_id": ctx["other"]})
        assert r.status_code == 404

    def test_nutri_unassigned_client_403(self, ctx):
        assert requests.get(f"{BASE}/clients/{ctx['other']}", headers=H(ctx["n"])).status_code == 403
        assert requests.get(f"{BASE}/clients/{ctx['other']}/nutrition", headers=H(ctx["n"])).status_code == 403
        assert requests.get(f"{BASE}/meals/history", params={"client_id": ctx["other"]}, headers=H(ctx["n"])).status_code == 403

    def test_nutri_sets_plan(self, ctx):
        body = {"targets": {"kcal": 2000, "protein": 140, "carbs": 220, "fat": 60},
                "meal_plan": [{"meal": "colazione", "items": [{"name": "Avena", "grams": 60}]}], "notes": "TEST_notes"}
        r = requests.put(f"{BASE}/clients/{ctx['cid']}/nutrition", headers=H(ctx["n"]), json=body)
        assert r.status_code == 200 and r.json()["targets"]["kcal"] == 2000
        g = requests.get(f"{BASE}/clients/{ctx['cid']}/nutrition", headers=H(ctx["t"])).json()
        assert g["targets"]["protein"] == 140 and g["meal_plan"][0]["meal"] == "colazione" and g["updated_by"]

    def test_client_cannot_set_plan_and_targets_hidden(self, ctx):
        assert requests.put(f"{BASE}/clients/{ctx['cid']}/nutrition", headers=H(ctx["c"]), json={"targets": {"kcal": 1}}).status_code == 403
        set_vis(ctx)
        g = requests.get(f"{BASE}/clients/{ctx['cid']}/nutrition", headers=H(ctx["c"])).json()
        assert g["targets"] == {}
        ctx["meal_plan_leak"] = g["meal_plan"]

    def test_diary_comments(self, ctx):
        r = requests.post(f"{BASE}/diary/{ctx['cid']}/{TODAY}/comments", headers=H(ctx["n"]), json={"text": "TEST_ottimo"})
        assert r.status_code == 200 and r.json()["author_role"] == "nutritionist"
        cs = requests.get(f"{BASE}/diary/{ctx['cid']}/{TODAY}/comments", headers=H(ctx["c"])).json()
        assert any(c["text"] == "TEST_ottimo" for c in cs)

    def test_team_notes_staff_only(self, ctx):
        r = requests.post(f"{BASE}/clients/{ctx['cid']}/team-notes", headers=H(ctx["t"]), json={"text": "TEST_note coach"})
        assert r.status_code == 200
        assert requests.post(f"{BASE}/clients/{ctx['cid']}/team-notes", headers=H(ctx["n"]), json={"text": "TEST_note nutri"}).status_code == 200
        notes = requests.get(f"{BASE}/clients/{ctx['cid']}/team-notes", headers=H(ctx["n"])).json()
        assert {"TEST_note coach", "TEST_note nutri"} <= {x["text"] for x in notes}
        assert requests.get(f"{BASE}/clients/{ctx['cid']}/team-notes", headers=H(ctx["c"])).status_code == 403
        assert requests.post(f"{BASE}/clients/{ctx['cid']}/team-notes", headers=H(ctx["c"]), json={"text": "x"}).status_code == 403

    def test_nutri_measurements_and_questions(self, ctx):
        assert requests.get(f"{BASE}/measurements", params={"client_id": ctx["cid"]}, headers=H(ctx["n"])).status_code == 200
        assert requests.get(f"{BASE}/questions", headers=H(ctx["n"])).status_code == 403


# Packages
class TestPackages:
    def test_defaults_seeded(self, ctx):
        ps = requests.get(f"{BASE}/packages", headers=H(ctx["c"])).json()
        by = {(p["name"], p["billing"]): p for p in ps}
        assert by[("Aiuto esecuzione online", "mensile")]["price"] == 25 and by[("Aiuto esecuzione online", "mensile")]["video_limit"] == 8
        assert by[("Aiuto esecuzione online", "annuale")]["price"] == 255 and by[("Aiuto esecuzione online", "annuale")]["video_limit"] == 100
        assert by[("Esecuzione di persona · 1 lezione", "mensile")]["price"] == 40
        assert by[("Esecuzione di persona · 2 lezioni", "mensile")]["price"] == 70
        assert by[("Coaching completo · 1 lezione", "mensile")]["price"] == 70
        assert by[("Coaching completo · 2 lezioni", "mensile")]["price"] == 120
        assert "Supporto via chat" in by[("Coaching completo · 1 lezione", "annuale")]["features"]
        assert all("whatsapp" in p and "owner_name" in p for p in ps)

    def test_nutri_creates_own_and_owner_only_edit(self, ctx):
        r = requests.post(f"{BASE}/packages", headers=H(ctx["n"]), json={"name": "TEST_Piano alimentare", "price": 50, "billing": "mensile"})
        assert r.status_code == 200 and r.json()["owner_role"] == "nutritionist"
        pid = r.json()["id"]
        assert pid in [p["id"] for p in requests.get(f"{BASE}/packages", headers=H(ctx["c"])).json()]
        assert requests.put(f"{BASE}/packages/{pid}", headers=H(ctx["t"]), json={"name": "hack", "price": 1}).status_code == 404
        assert requests.delete(f"{BASE}/packages/{pid}", headers=H(ctx["t"])).status_code == 404
        u = requests.put(f"{BASE}/packages/{pid}", headers=H(ctx["n"]), json={"name": "TEST_Piano 2", "price": 55})
        assert u.status_code == 200 and u.json()["price"] == 55
        assert requests.post(f"{BASE}/packages", headers=H(ctx["c"]), json={"name": "x", "price": 1}).status_code == 403
        assert requests.delete(f"{BASE}/packages/{pid}", headers=H(ctx["n"])).status_code == 200

    def test_assign_subscription(self, ctx):
        p = requests.get(f"{BASE}/packages", headers=H(ctx["t"])).json()[0]
        sub = {"package_id": p["id"], "name": p["name"], "price": p["price"], "billing": p["billing"], "video_limit": p["video_limit"], "since": TODAY}
        r = requests.put(f"{BASE}/clients/{ctx['cid']}/settings", headers=H(ctx["t"]), json={"subscription": sub})
        assert r.status_code == 200 and r.json()["subscription"]["package_id"] == p["id"]
        me = requests.get(f"{BASE}/auth/me", headers=H(ctx["c"])).json()
        assert me["subscription"]["name"] == p["name"]


# Questions
class TestQuestions:
    def test_flow(self, ctx):
        r = requests.post(f"{BASE}/questions", headers=H(ctx["c"]), json={"subject": "TEST_Dolore", "text": "Ho dolore al ginocchio"})
        assert r.status_code == 200 and r.json()["status"] == "open"
        qid = r.json()["id"]
        assert qid in [q["id"] for q in requests.get(f"{BASE}/questions", headers=H(ctx["t"])).json()]
        assert requests.post(f"{BASE}/questions", headers=H(ctx["t"]), json={"subject": "x", "text": "y"}).status_code == 403
        assert requests.post(f"{BASE}/questions", headers=H(ctx["c"]), json={"subject": "", "text": "y"}).status_code == 422
        requests.post(f"{BASE}/questions/{qid}/comments", headers=H(ctx["t"]), json={"text": "TEST_risposta"})
        d = requests.get(f"{BASE}/questions/{qid}", headers=H(ctx["c"])).json()
        assert d["status"] == "answered" and d["comments"][0]["text"] == "TEST_risposta"
        assert requests.put(f"{BASE}/questions/{qid}/status", headers=H(ctx["c"]), json={"status": "closed"}).status_code == 200
        assert requests.get(f"{BASE}/questions/{qid}", headers=H(ctx["t"])).json()["status"] == "closed"
        assert requests.put(f"{BASE}/questions/{qid}/status", headers=H(ctx["c"]), json={"status": "bad"}).status_code == 400


# Plans history + approach/active, measurements edit, /me
class TestMisc:
    def test_plans_history(self, ctx):
        r = requests.post(f"{BASE}/plans", headers=H(ctx["t"]), json={"client_id": ctx["other"], "name": "TEST_Plan", "approach": "forza",
                                                                      "active": True, "days": [{"name": "A", "exercises": []}]})
        assert r.status_code == 200
        pid = r.json()["id"]
        u = requests.put(f"{BASE}/plans/{pid}", headers=H(ctx["t"]), json={"client_id": ctx["other"], "name": "TEST_Plan", "approach": "ipertrofia", "active": False, "days": []})
        assert u.status_code == 200 and u.json()["active"] is False and u.json()["approach"] == "ipertrofia"
        h = requests.get(f"{BASE}/plans/history", headers=H(ctx["t"])).json()
        x = [p for p in h if p["id"] == pid][0]
        assert x["client_name"] == "TEST_Other" and x["active"] is False and "sessions_done" in x and "days" not in x
        assert requests.get(f"{BASE}/plans/history", headers=H(ctx["c"])).status_code == 403

    def test_measurement_edit(self, ctx):
        r = requests.post(f"{BASE}/measurements", headers=H(ctx["t"]), json={"client_id": ctx["other"], "date": "2026-01-10", "weight": 80, "height": 180})
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        u = requests.put(f"{BASE}/measurements/{mid}", headers=H(ctx["t"]), json={"client_id": ctx["other"], "date": "2026-01-11", "weight": 78, "height": 180})
        assert u.status_code == 200 and u.json()["weight"] == 78 and u.json()["date"] == "2026-01-11" and u.json()["bmi"] == 24.1
        ms = requests.get(f"{BASE}/measurements", params={"client_id": ctx["other"]}, headers=H(ctx["t"])).json()
        assert [m for m in ms if m["id"] == mid][0]["weight"] == 78
        # wrong client id -> 404, nutri on unassigned -> 403
        assert requests.put(f"{BASE}/measurements/{mid}", headers=H(ctx["t"]), json={"client_id": ctx["cid"], "date": "2026-01-11", "weight": 1}).status_code == 404
        assert requests.put(f"{BASE}/measurements/{mid}", headers=H(ctx["n"]), json={"client_id": ctx["other"], "date": "2026-01-11", "weight": 1}).status_code == 403

    def test_update_me(self, ctx):
        orig = requests.get(f"{BASE}/auth/me", headers=H(ctx["c"])).json()
        r = requests.put(f"{BASE}/me", headers=H(ctx["c"]), json={"avatar": "uploads/test.jpg", "staff": {"whatsapp": "123"}})
        assert r.status_code == 200 and r.json()["avatar"] == "uploads/test.jpg" and not (r.json().get("staff") or {}).get("whatsapp") == "123"
        requests.put(f"{BASE}/me", headers=H(ctx["c"]), json={"avatar": orig.get("avatar") or ""})
        torig = requests.get(f"{BASE}/auth/me", headers=H(ctx["t"])).json().get("staff") or {}
        t = requests.put(f"{BASE}/me", headers=H(ctx["t"]), json={"staff": {**torig, "bio": "TEST_bio"}})
        assert t.json()["staff"]["bio"] == "TEST_bio"
        requests.put(f"{BASE}/me", headers=H(ctx["t"]), json={"staff": torig})
