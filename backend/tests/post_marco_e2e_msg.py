# Helper: post an "older" TEST E2E message as Marco (box sealed to his current published key) so the UI test can verify it's readable after a v1->v2 restore.
import os, sys, base64, hashlib, requests
from pymongo import MongoClient
from nacl.secret import SecretBox
from nacl.public import PrivateKey, PublicKey, Box
from nacl.utils import random

API = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
u = db.users.find_one({"email": "cliente@silverpt.it"})
secret = "cliente@silverpt.it:Cliente123!"
k1 = hashlib.sha512(f"silverpt-e2e:{secret}".encode()).digest()[:32]
n, c = u["key_backup"].split(".")
sk = PrivateKey(SecretBox(k1).decrypt(base64.b64decode(c), base64.b64decode(n)))
pk = base64.b64encode(bytes(sk.public_key)).decode()
assert pk == u["public_key"]
nonce = random(24)
text = sys.argv[1] if len(sys.argv) > 1 else "TEST_E2E_V12 messaggio segreto"
ct = Box(sk, sk.public_key).encrypt(text.encode(), nonce).ciphertext
tok = requests.post(f"{API}/auth/login", json={"email": "cliente@silverpt.it", "password": "Cliente123!"}).json()["access_token"]
r = requests.post(f"{API}/chat/{u['_id']}", headers={"Authorization": f"Bearer {tok}"},
                  json={"text": "", "e2e": {"nonce": base64.b64encode(nonce).decode(), "sender_pk": pk, "boxes": {str(u["_id"]): base64.b64encode(ct).decode()}}})
print(r.status_code, r.json().get("id"))
