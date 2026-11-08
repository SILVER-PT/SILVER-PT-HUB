# Helper: create/delete TEST clients for UI tests. usage: create <n> [missing_consent] | delete <id...>
import os, sys, uuid, requests
from pymongo import MongoClient
from bson import ObjectId

API = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
CONS = ["terms", "privacy", "health_data", "fitness_waiver", "nutrition_disclaimer", "media"]
if sys.argv[1] == "create":
    t = requests.post(f"{API}/auth/login", json={"email": "trainer@silverpt.it", "password": "Trainer123!"}).json()
    code = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {t['access_token']}"}).json()["invite_code"]
    for i in range(int(sys.argv[2])):
        em = f"test_v12ui_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"email": em, "password": "Test123!", "name": f"TEST_V12UI {i}", "role": "client", "invite_code": code, "consents": CONS})
        uid = r.json()["user"]["id"]
        upd = {"$set": {"subscription": {"name": "TEST", "chat": True}}}
        if len(sys.argv) > 3:
            upd["$pull"] = {"consents": {"id": sys.argv[3]}}
        db.users.update_one({"_id": ObjectId(uid)}, upd)
        print(em, uid)
else:
    for uid in sys.argv[2:]:
        db.chat.delete_many({"client_id": uid})
        db.notifications.delete_many({"user_id": uid})
        db.notifications.delete_many({"link": {"$regex": uid}})
        print(uid, db.users.delete_one({"_id": ObjectId(uid)}).deleted_count)
