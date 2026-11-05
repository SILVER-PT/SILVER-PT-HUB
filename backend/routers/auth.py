# backend/routers/auth.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import secrets
import smtplib
from email.mime.text import MIMEText

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class ResetPasswordRequest(BaseModel):
    email: EmailStr

@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    temp_password = secrets.token_urlsafe(8)
    
    try:
        msg = MIMEText(f"La tua password temporanea per SILVER-PT è: {temp_password}\nConsigliamo di cambiarla subito dopo l'accesso.")
        msg['Subject'] = 'Reset Password - SILVER-PT'
        msg['From'] = 'noreply@silverpt.com'
        msg['To'] = data.email

        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login("tuo-email@gmail.com", "tua-password-app")
            server.sendmail(msg['From'], [msg['To']], msg.as_string())

        return {"success": True, "message": "Password temporanea inviata per email."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nell'invio dell'email: {str(e)}")
