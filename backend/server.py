import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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
    
    # Legge correttamente SMTP_EMAIL e supporta sia SMTP_PASS che SMTP_PASSWORD
    gmail_user = os.getenv("SMTP_EMAIL")
    gmail_password = os.getenv("SMTP_PASS") or os.getenv("SMTP_PASSWORD")
    
    if gmail_user:
        gmail_user = gmail_user.strip()
    if gmail_password:
        gmail_password = gmail_password.strip()

    logger.info(f"CHECK SMTP -> EMAIL trovata: {bool(gmail_user)}, PASS trovata: {bool(gmail_password)}")

    if not gmail_user or not gmail_password:
        logger.error("Credenziali SMTP non trovate o vuote nelle variabili d'ambiente di Render!")
        raise HTTPException(status_code=500, detail="Errore di configurazione del server email")

    try:
        msg = MIMEMultipart()
        msg["From"] = gmail_user
        msg["To"] = data.email
        msg["Subject"] = "Recupero Password - SILVER-PT-HUB"
        
        body = (
            "Ciao,\n\n"
            "Abbiamo ricevuto una richiesta di recupero password per il tuo account SILVER-PT-HUB.\n"
            "Se non sei stato tu, puoi ignorare questa email.\n\n"
            "Il team di SILVER-PT"
        )
        msg.attach(MIMEText(body, "plain"))
        
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(gmail_user, gmail_password)
        server.sendmail(gmail_user, data.email, msg.as_string())
        server.quit()
        
        logger.info(f"Email di recupero inviata con successo a {data.email}")
        return {"ok": True, "message": "Istruzioni inviate via email"}
        
    except Exception as e:
        logger.error(f"Errore durante l'invio dell'email SMTP: {e}")
        raise HTTPException(status_code=500, detail=f"Errore SMTP: {str(e)}")
