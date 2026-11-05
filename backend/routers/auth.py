# backend/routers/auth.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import secrets
import resend
import os


router = APIRouter(prefix="/api/auth", tags=["Auth"])

API_KEY = os.getenv("RESEND_API_KEY")
if not API_KEY:
    print("⚠️ ATTENZIONE: RESEND_API_KEY non impostata!")
else:
    resend.api_key = API_KEY


class ResetPasswordRequest(BaseModel):
    email: EmailStr


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    if not API_KEY:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY mancante sul server.")

    temp_password = secrets.token_urlsafe(8)

    try:
        params = {
            "from": "SILVER-PT <onboarding@resend.dev>",
            "to": [data.email],
            "subject": "Reset Password - SILVER-PT",
            "html": f"""
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2>Richiesta Reset Password</h2>
                    <p>La tua password temporanea per accedere a <b>SILVER-PT</b> è:</p>
                    <h3 style="background: #f4f4f4; padding: 10px; display: inline-block; color: #ff0000;">{temp_password}</h3>
                    <p>Ti consigliamo di cambiarla subito dopo aver effettuato l'accesso.</p>
                </div>
            """,
        }

        response = resend.Emails.send(params)
        print(f"✅ Email inviata a {data.email} — ID: {response}")
        return {"success": True, "message": "Password temporanea inviata con successo."}

    except Exception as e:
        print(f"❌ Errore Resend: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Errore nell'invio dell'email: {str(e)}")
