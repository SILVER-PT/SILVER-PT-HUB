import os
import logging
import json
import urllib.request
import urllib.error
import secrets
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
import bcrypt

# Configurazione logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("silver-pt-backend")

app = FastAPI(title="SILVER-PT-HUB API", version="1.0.0")

# Configurazione CORS (per permettere le chiamate da Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connessione MongoDB (legge MONGO_URL e DB_NAME dalle variabili d'ambiente di Render)
MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "silver_pt")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
users_collection = db["users"]

# Modelli Pydantic
class LoginModel(BaseModel):
    email: EmailStr
    password: str

class RegisterModel(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    invite_code: str = None
    consents: list = []

class ForgotPasswordModel(BaseModel):
    email: EmailStr

class ResetPasswordModel(BaseModel):
    token: str
    new_password: str

@app.get("/")
def read_root():
    return {"status": "online", "message": "SILVER-PT-HUB Backend operativo"}

@app.post("/auth/login")
@app.post("/api/auth/login")
@app.post("/auth/login/")
@app.post("/api/auth/login/")
async def login(data: LoginModel):
    user = users_collection.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=400, detail="Credenziali non valide")
    
    # Verifica della password con bcrypt
    password_valida = bcrypt.checkpw(
        data.password.encode('utf-8'), 
        user["password"].encode('utf-8')
    )
    
    if not password_valida:
        raise HTTPException(status_code=400, detail="Credenziali non valide")
    
    # Restituisce il token e l'oggetto user con l'id atteso dal frontend
    return {
        "ok": True, 
        "token": "dummy-jwt-token", 
        "user": {
            "id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user["email"],
            "role": user.get("role", "client")
        },
        "message": "Login effettuato con successo"
    }

@app.post("/auth/register")
@app.post("/api/auth/register")
@app.post("/auth/register/")
@app.post("/api/auth/register/")
async def register(data: RegisterModel):
    existing = users_collection.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    hashed_password = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user_doc = {
        "name": data.name,
        "email": data.email,
        "password": hashed_password,
        "role": data.role,
        "invite_code": data.invite_code,
        "consents": data.consents
    }
    
    users_collection.insert_one(user_doc)
    return {"ok": True, "message": "Registrazione completata"}

@app.post("/auth/forgot-password")
@app.post("/api/auth/forgot-password")
@app.post("/auth/forgot-password/")
@app.post("/api/auth/forgot-password/")
async def forgot_password(data: ForgotPasswordModel):
    user = users_collection.find_one({"email": data.email})
    
    if user:
        reset_token = secrets.token_urlsafe(32)
        users_collection.update_one(
            {"email": data.email},
            {"$set": {"reset_token": reset_token}}
        )
        
        reset_link = f"https://silver-pt-training.vercel.app/reset-password?token={reset_token}"
        
        brevo_api_key = os.getenv("BREVO_API_KEY")
        sender_email = os.getenv("SMTP_EMAIL") or "noreply.silver.pt@gmail.com"
        
        if not brevo_api_key:
            logger.error("BREVO_API_KEY non trovata nelle variabili d'ambiente!")
            raise HTTPException(status_code=500, detail="Errore di configurazione del server email")

        try:
            url = "https://api.brevo.com/v3/smtp/email"
            payload = {
                "sender": {
                    "name": "SILVER-PT-HUB",
                    "email": sender_email.strip()
                },
                "to": [{"email": data.email}],
                "subject": "Reset della Password - SILVER-PT-HUB",
                "htmlContent": (
                    "<div style='font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;'>"
                    "<h2 style='color: #e60000;'>SILVER-PT-HUB</h2>"
                    "<h3>Richiesta di ripristino password</h3>"
                    "<p>Ciao,</p>"
                    "<p>Abbiamo ricevuto una richiesta per reimpostare la password del tuo account.</p>"
                    "<p>Clicca sul pulsante sottostante per impostare una nuova password:</p>"
                    "<div style='text-align: center; margin: 30px 0;'>"
                    f"<a href='{reset_link}' style='background-color: #e60000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;'>Reimposta Password</a>"
                    "</div>"
                    "<p>Se non hai richiesto tu il cambio password, puoi ignorare questa email in sicurezza.</p>"
                    "<br>"
                    "<p>Il team di <b>SILVER-PT</b></p>"
                    "</div>"
                )
            }
            
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    "api-key": brevo_api_key.strip(),
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0"
                },
                method="POST"
            )
            
            with urllib.request.urlopen(req) as response:
                logger.info(f"Email con link di reset inviata con successo a {data.email}")
                
        except Exception as e:
            logger.error(f"Errore durante l'invio dell'email via Brevo: {e}")
            raise HTTPException(status_code=500, detail="Impossibile inviare l'email di recupero al momento.")

    return {"ok": True, "message": "Se l'email è registrata, riceverai le istruzioni"}

@app.post("/auth/reset-password")
@app.post("/api/auth/reset-password")
@app.post("/auth/reset-password/")
@app.post("/api/auth/reset-password/")
async def reset_password(data: ResetPasswordModel):
    user = users_collection.find_one({"reset_token": data.token})
    if not user:
        raise HTTPException(status_code=400, detail="Token non valido o scaduto")
    
    hashed_password = bcrypt.hashpw(data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password": hashed_password},
            "$unset": {"reset_token": ""}
        }
    )
    
    logger.info(f"Password aggiornata con successo per l'utente {user.get('email')}")
    return {"ok": True, "message": "Password aggiornata con successo"}
