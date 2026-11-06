from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
import secrets
import os
import bcrypt
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from jose import jwt, JWTError
from datetime import datetime, timedelta
from bson import ObjectId

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Connessione a MongoDB Atlas
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.silver_pt

# Configurazione Brevo API (per l'invio email)
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.getenv("SMTP_EMAIL", "noreply.silver.pt@gmail.com")
BREVO_SENDER_NAME = "SILVER-PT"

# Configurazione JWT
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key")
ALGORITHM = "HS256"

# Dependency per ricavare l'utente corrente dal Token JWT Bearer
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token di autenticazione mancante o non valido.")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token non valido.")
        
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="Utente non trovato.")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token scaduto o non valido.")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr

class StaffUpdate(BaseModel):
    whatsapp: str | None = None
    title: str | None = None
    bio: str | None = None

class UserUpdate(BaseModel):
    name: str | None = None
    current_password: str | None = None
    new_password: str | None = None
    staff: StaffUpdate | None = None


# --- ENDPOINT: LOGIN ---
@router.post("/login")
async def login(data: LoginRequest):
    user = await db.users.find_one({"email": data.email})
    if not user or not bcrypt.checkpw(data.password.encode('utf-8'), user["password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Credenziali non valide.")
    
    user_id_str = str(user["_id"])
    
    # Genera il token JWT (valido 30 giorni)
    expire = datetime.utcnow() + timedelta(days=30)
    to_encode = {"sub": user_id_str, "role": user.get("role", "trainer"), "exp": expire}
    access_token = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

    user_response = {
        "id": user_id_str,
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "trainer"),
        "created_at": user
