import { Platform } from "react-native";
import nacl from "tweetnacl";
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from "tweetnacl-util";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/src/api";

// End-to-end encrypted chat: each device keeps its secret key locally; the server only stores public keys and ciphertexts.
nacl.setPRNG((x: Uint8Array, n: number) => { x.set(Crypto.getRandomValues(new Uint8Array(n))); });

const KEY = (uid: string) => `silverpt_e2e_${uid}`;
const store = {
  get: (k: string) => (Platform.OS === "web" ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) => (Platform.OS === "web" ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v)),
  del: (k: string) => (Platform.OS === "web" ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k)),
};

let cache: { uid: string; pk: string; sk: Uint8Array } | null = null;
const WRAP = (uid: string) => `silverpt_e2e_wrap_${uid}`;
let pendingSecret: string | null = null;
let legacy: Uint8Array | null = null;

// Called at login/registration: derives the backup-protection key from the password and stores ONLY the derived key.
export function setPassphrase(email: string, password: string) {
  pendingSecret = `${email.trim().toLowerCase()}:${password}`;
  legacy = nacl.hash(decodeUTF8(`silverpt-e2e:${pendingSecret}`)).slice(0, nacl.secretbox.keyLength);
  cache = null;
}

export async function clearKeys(uid: string) {
  cache = null;
  await Promise.all([store.del(KEY(uid)), store.del(WRAP(uid))]).catch(() => {});
}
async function wrapKey(uid: string): Promise<Uint8Array | null> {
  if (pendingSecret) {
    const k = nacl.hash(decodeUTF8(`silverpt-e2e:v2:${uid}:${pendingSecret}`)).slice(0, nacl.secretbox.keyLength);
    pendingSecret = null;
    await store.set(WRAP(uid), encodeBase64(k));
    return k;
  }
  const s = await store.get(WRAP(uid));
  return s ? decodeBase64(s) : null;
}
const wrap = (sk: Uint8Array, k: Uint8Array) => {
  const n = nacl.randomBytes(nacl.secretbox.nonceLength);
  return encodeBase64(n) + "." + encodeBase64(nacl.secretbox(sk, n, k));
};
const unwrap = (b: string, k: Uint8Array) => {
  const [n, c] = b.split(".");
  return nacl.secretbox.open(decodeBase64(c), decodeBase64(n), k);
};

// Returns null when this device cannot (yet) take part in E2E: the app then falls back to server-side encryption.
let inflight: Promise<any> | null = null;
export function myKeys(uid: string, serverPk?: string | null) {
  if (cache?.uid === uid) return Promise.resolve(cache);
  if (!inflight) inflight = setupKeys(uid, serverPk).finally(() => { inflight = null; });
  return inflight;
}

async function setupKeys(uid: string, serverPk?: string | null) {
  if (cache?.uid === uid) return cache;
  const wk = await wrapKey(uid);
  let raw = await store.get(KEY(uid));
  if (!raw && wk) {
    const b = await api<any>("/me/key-backup").catch(() => null);
    let sk = b?.key_backup ? unwrap(b.key_backup, wk) : null;
    if (!sk && b?.key_backup && legacy) sk = unwrap(b.key_backup, legacy); // v1 backups: re-wrapped below with v2
    if (sk) {
      raw = JSON.stringify({ pk: encodeBase64(nacl.box.keyPair.fromSecretKey(sk).publicKey), sk: encodeBase64(sk) });
      await store.set(KEY(uid), raw);
      if (legacy) serverPk = null; // force upload of the v2 backup
    } else if (b?.key_backup) {
      return null; // backup exists but cannot be opened here: never overwrite the published key
    }
  }
  legacy = null;
  if (!raw) {
    if (!wk) return null; // no way to back up a new key: do not publish it
    const kp = nacl.box.keyPair();
    raw = JSON.stringify({ pk: encodeBase64(kp.publicKey), sk: encodeBase64(kp.secretKey) });
    await store.set(KEY(uid), raw);
  }
  const k = JSON.parse(raw);
  const sk = decodeBase64(k.sk);
  if (wk && serverPk !== k.pk) {
    await api("/me/public-key", { method: "PUT", body: { public_key: k.pk, key_backup: wrap(sk, wk) } }).catch(() => {});
  }
  cache = { uid, pk: k.pk, sk };
  return cache;
}

export function encryptFor(text: string, me: { uid: string; pk: string; sk: Uint8Array }, keys: Record<string, string | null>) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const msg = decodeUTF8(text);
  const boxes: Record<string, string> = {};
  for (const [uid, pk] of Object.entries(keys)) {
    const target = uid === me.uid ? me.pk : pk;
    if (target) boxes[uid] = encodeBase64(nacl.box(msg, nonce, decodeBase64(target), me.sk));
  }
  return { nonce: encodeBase64(nonce), sender_pk: me.pk, boxes };
}

export function decryptMsg(m: any, me: { uid: string; pk: string; sk: Uint8Array } | null): string | null {
  if (!m.e2e) return m.text;
  const box = me && m.e2e.boxes?.[me.uid];
  if (!box) return null;
  try {
    const senderPk = m.author_id === me!.uid ? me!.pk : m.e2e.sender_pk;
    const out = nacl.box.open(decodeBase64(box), decodeBase64(m.e2e.nonce), decodeBase64(senderPk), me!.sk);
    return out ? encodeUTF8(out) : null;
  } catch {
    return null;
  }
}
