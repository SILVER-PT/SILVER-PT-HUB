import os
import logging
import json
import urllib.request
import urllib.error
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

@app.get("/")
def read_root():
    return {"status": "online", "message": "SILVER-PT-HUB Backend operativo"}

@app.post("/auth/login")
async def login(data: LoginModel):
    user = users_collection.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=400, detail="Credenziali non valide")
    
    return {"ok": True, "token": "dummy-jwt-token", "message": "Login effettuato con successo"}

@app.post("/auth/register")
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
    if not user:
        logger.info(f"Richiesta di recupero per email non registrata: {data.email}")
    
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
            "to": [
                {
                    "email": data.email
                }
            ],
            "subject": "Recupero Password - SILVER-PT-HUB",
            "htmlContent": (
                "<div style='font-family: Arial, sans-serif; color: #333;'>"
                "<h2>Recupero Password - SILVER-PT-HUB</h2>"
                "<p>Ciao,</p>"
                "<p>Abbiamo ricevuto una richiesta di recupero password per il tuo account SILVER-PT-HUB.</p>"
                "<p>Se non sei stato tu, puoi tranquillamente ignorare questa email.</p>"
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
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            method="POST"
        )
        
        with urllib.request.urlopen(req) as response:
            response_body = response.read().decode('utf-8')
            logger.info(f"Email inviata con successo tramite Brevo (mittente: {sender_email}) a {data.email}")
            return {"ok": True, "message": "Istruzioni inviate via email"}
            
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='ignore')
        logger.error(f"Errore Brevo API HTTP {e.code}: {error_body}")
        raise HTTPException(status_code=500, detail="Impossibile inviare l'email di recupero al momento.")
    except Exception as e:
        logger.error(f"Errore imprevisto durante l'invio dell'email: {e}")
        raise HTTPException(status_code=500, detail="Errore interno durante l'invio dell'email.")
