# Helper: report which derivation (v1/v2) opens Marco's key_backup and whether derived pk matches the stored public_key.
import os, base64, hashlib
from pymongo import MongoClient
from nacl.secret import SecretBox
from nacl.public import PrivateKey

u = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]].users.find_one({"email": "cliente@silverpt.it"})
secret = "cliente@silverpt.it:Cliente123!"
keys = {"v1": hashlib.sha512(f"silverpt-e2e:{secret}".encode()).digest()[:32],
        "v2": hashlib.sha512(f"silverpt-e2e:v2:{u['_id']}:{secret}".encode()).digest()[:32]}
n, c = u["key_backup"].split(".")
for name, k in keys.items():
    try:
        sk = SecretBox(k).decrypt(base64.b64decode(c), base64.b64decode(n))
        pk = base64.b64encode(bytes(PrivateKey(sk).public_key)).decode()
        print(name, "OPENS; pk match:", pk == u["public_key"], pk)
    except Exception as e:
        print(name, "fails")
print("stored pk", u["public_key"])
