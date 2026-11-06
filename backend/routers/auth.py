from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import secrets
import os
import bcrypt
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Connessione a MongoDB Atlas
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.silver_pt

# Configurazione Server SMTP Gmail
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "noreply.silver.pt@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

class ResetPasswordRequest(BaseModel):
    email: EmailStr

@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    # 1. Verifica se l'utente esiste nel database MongoDB
    user = await db.users.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=404, detail="Email non trovata nel sistema.")

    # 2. Genera una password temporanea sicura e la cifra con bcrypt
    temp_password = secrets.token_urlsafe(8)
    hashed_password = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # 3. Aggiorna la password dell'utente sul database
    await db.users.update_one(
        {"email": data.email},
        {"$set": {"password": hashed_password}}
    )

    # 4. Costruisce ed invia l'email tramite il server SMTP di Gmail
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Reset Password - SILVER-PT"
        msg["From"] = f"SILVER-PT <{SMTP_EMAIL}>"
        msg["To"] = data.email

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
        msg.attach(MIMEText(html_content, "html"))

        # Connessione SSL/TLS sicura con Gmail
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, data.email, msg.as_string())

        return {"success": True, "message": "Password temporanea inviata con successo."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante l'invio dell'email: {str(e)}")
