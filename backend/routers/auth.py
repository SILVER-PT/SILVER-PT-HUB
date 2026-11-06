from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
import secrets
import os
import bcrypt
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from jose import jwt, JWTError

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Configurazione MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.silver_pt

# Configurazione Brevo API (per aggirare il blocco SMTP su Render)
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.getenv("SMTP_EMAIL", "noreply.silver.pt@gmail.com")
BREVO_SENDER_NAME = "SILVER-PT"

# Configurazione JWT (assicurati che corrisponda alla tua chiave segreta)
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
        
        from bson import ObjectId
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="Utente non trovato.")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token scaduto o non valido.")

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


# --- ENDPOINT: RESET PASSWORD (VIA BREVO API) ---
@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    user = await db.users.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=404, detail="Email non trovata nel sistema.")

    temp_password = secrets.token_urlsafe(8)
    hashed_password = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    await db.users.update_one(
        {"email": data.email},
        {"$set": {"password": hashed_password}}
    )

    html_content = f"""
    <div style="font-family: Arial, sans-serif; color: #ffffff; background-color: #111111; padding: 24px; border-radius: 8px; border: 1px solid #333333;">
        <h2 style="color: #ff0000; margin-bottom: 16px;">SILVER-PT</h2>
        <p style="font-size: 15px; color: #dddddd;">Hai richiesto di reimpostare la password per il tuo account.</p>
        <p style="font-size: 14px; color: #aaaaaa;">Usa la seguente password temporanea per accedere:</p>
        <div style="background-color: #222222; border: 1px solid #ff0000; padding: 14px; font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #ffffff; display: inline-block; border-radius: 6px; margin: 16px 0;">
            {temp_password}
        </div>
        <p style="font-size: 13px; color: #888888; margin-top: 20px;">Una volta effettuato l'accesso, ti consigliamo di modificare subito la password dalle impostazioni del tuo profilo.</p>
    </div>
    """

    payload = {
        "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "to": [{"email": data.email}],
        "subject": "Reset Password - SILVER-PT",
        "htmlContent": html_content
    }

    headers = {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient() as client_http:
            response = await client_http.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
            if response.status_code not in [200, 201, 202]:
                raise HTTPException(status_code=500, detail=f"Errore Brevo API: {response.text}")

        return {"success": True, "message": "Password temporanea inviata con successo via email."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante l'invio dell'email: {str(e)}")


# --- ENDPOINT: AGGIORNAMENTO PROFILO E CREDENZIALI ---
@router.put("/me")
async def update_profile(data: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}

    if data.name is not None:
        update_data["name"] = data.name

    if data.staff is not None:
        current_staff = current_user.get("staff", {})
        if data.staff.whatsapp is not None:
            current_staff["whatsapp"] = data.staff.whatsapp
        if data.staff.title is not None:
            current_staff["title"] = data.staff.title
        if data.staff.bio is not None:
            current_staff["bio"] = data.staff.bio
        update_data["staff"] = current_staff

    # Gestione cambio password
    if data.new_password:
        if not data.current_password:
            raise HTTPException(status_code=400, detail="Inserisci la password attuale per impostarne una nuova.")
        
        # Verifica la password corrente
        if not bcrypt.checkpw(data.current_password.encode('utf-8'), current_user["password"].encode('utf-8')):
            raise HTTPException(status_code=400, detail="La password attuale non è corretta.")
        
        # Cifra la nuova password
        update_data["password"] = bcrypt.hashpw(data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    if update_data:
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": update_data}
        )

    # Recupera l'utente aggiornato per restituirlo al frontend (senza password)
    updated_user = await db.users.find_one({"_id": current_user["_id"]})
    updated_user["id"] = str(updated_user["_id"])
    del updated_user["_id"]
    if "password" in updated_user:
        del updated_user["password"]

    return {"success": True, "user": updated_user}
