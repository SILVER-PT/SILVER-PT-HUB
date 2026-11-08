"""Legal documents (Italian law / GDPR) accepted at registration and inside the app.
Placeholders in [BRACKETS] must be completed by the data controller and reviewed by a lawyer."""
from datetime import datetime, timezone

CONTROLLER = "[TITOLARE: nome/ragione sociale] · P.IVA [P.IVA] · [INDIRIZZO] · [EMAIL] · PEC [PEC]"

DOCS = [
    {"id": "terms", "version": "1.0", "title": "Termini e condizioni d'uso", "roles": ["client", "trainer", "nutritionist"], "required": True, "text": f"""
Titolare del servizio: {CONTROLLER}.
1. Oggetto. SILVER-PT HUB è una piattaforma che mette in contatto clienti, personal trainer e professionisti della nutrizione per gestire programmi di allenamento, appuntamenti, misurazioni, comunicazioni e documenti.
2. Account. L'utente è responsabile della veridicità dei dati inseriti e della custodia delle credenziali. È vietato cedere l'account a terzi. L'uso è riservato ai maggiorenni; i minori possono usare l'app solo con il consenso scritto di chi esercita la responsabilità genitoriale.
3. Ruoli professionali. Il personal trainer fornisce programmi di allenamento e consigli alimentari generici basati sulle linee guida OMS e sulla letteratura scientifica (PubMed); non prescrive diete, grammature o apporti calorici. Le diete e i piani con grammature e macronutrienti sono elaborati esclusivamente da professionisti abilitati (biologo nutrizionista, dietista, medico) iscritti al rispettivo albo.
4. Nessuna prestazione medica. I contenuti dell'app non sostituiscono diagnosi, terapie o pareri medici. In caso di sintomi, patologie o dubbi l'utente deve rivolgersi al proprio medico.
5. Pagamenti e pacchetti. Prezzi, durata e modalità di rinnovo dei pacchetti sono indicati da ciascun professionista. Il cambio di professionista non comporta automaticamente il rimborso di quanto già pagato, salvo diverso accordo o diritti inderogabili previsti dal Codice del Consumo (D.Lgs. 206/2005), incluso il diritto di recesso entro 14 giorni ove applicabile.
6. Contenuti caricati. L'utente garantisce di avere i diritti su foto, video e documenti caricati e si impegna a non caricare contenuti illeciti o di terzi senza autorizzazione.
7. Responsabilità. Il titolare non risponde di danni derivanti da uso improprio dell'app, da informazioni inesatte fornite dall'utente o dal mancato rispetto delle indicazioni dei professionisti. Restano salvi i casi di dolo o colpa grave.
8. Recesso e cancellazione. L'utente può chiudere l'account in qualsiasi momento scrivendo a [EMAIL]; i dati saranno cancellati salvo obblighi di conservazione di legge.
9. Legge applicabile e foro. Legge italiana. Per i consumatori è competente il foro di residenza del consumatore.
"""},
    {"id": "privacy", "version": "1.0", "title": "Informativa privacy (art. 13 GDPR)", "roles": ["client", "trainer", "nutritionist"], "required": True, "text": f"""
Titolare del trattamento: {CONTROLLER}. Contatto privacy/DPO: [EMAIL DPO].
Dati trattati: dati anagrafici e di contatto; foto profilo; dati di allenamento (schede, carichi, ripetizioni, sessioni); misure antropometriche e plicometria; foto check e posing; video di esecuzione; diario alimentare e foto dei pasti; anamnesi, patologie, farmaci, analisi del sangue, sonno e attività (dati relativi alla salute - art. 9 GDPR); messaggi in chat; dati di pagamento dei pacchetti.
Finalità e basi giuridiche: (a) erogazione del servizio e del rapporto con i professionisti - esecuzione del contratto (art. 6.1.b); (b) trattamento dei dati relativi alla salute per personalizzare allenamento e alimentazione - consenso esplicito (art. 9.2.a); (c) adempimenti fiscali e contabili - obbligo legale (art. 6.1.c); (d) sicurezza della piattaforma - legittimo interesse (art. 6.1.f); (e) comunicazioni promozionali - consenso facoltativo.
Destinatari: solo i professionisti che l'utente sceglie (personal trainer e/o nutrizionista), che agiscono come titolari autonomi o responsabili del trattamento; fornitori tecnici (hosting, archiviazione cifrata, servizi di intelligenza artificiale per le funzioni richieste dall'utente) nominati responsabili ex art. 28. I dati non sono venduti né diffusi.
Trasferimenti extra UE: alcuni fornitori tecnici possono trovarsi fuori dallo SEE; in tal caso il trasferimento avviene sulla base di decisioni di adeguatezza o Clausole Contrattuali Standard.
Sicurezza: connessioni HTTPS; dati sanitari, anamnesi, analisi e messaggi cifrati nel database con AES-256; chat con crittografia end-to-end tra i partecipanti; accesso consentito solo agli utenti autorizzati. L'utente sceglie con chi condividere anamnesi e dati di salute.
Conservazione: per la durata del rapporto e fino a 24 mesi dalla chiusura dell'account, salvo obblighi di legge (10 anni per i documenti fiscali).
Diritti: accesso, rettifica, cancellazione, limitazione, portabilità, opposizione e revoca del consenso in ogni momento (artt. 15-22 GDPR), scrivendo a [EMAIL]. Reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).
"""},
    {"id": "health_data", "version": "1.0", "title": "Consenso al trattamento dei dati relativi alla salute (art. 9 GDPR)", "roles": ["client"], "required": True, "text": """
Acconsento in modo esplicito al trattamento dei miei dati relativi alla salute (anamnesi, patologie, farmaci, allergie, misure corporee, plicometria, analisi del sangue, foto check, sonno e attività, diario alimentare) da parte dei professionisti che scelgo all'interno dell'app, al solo fine di personalizzare il programma di allenamento e/o alimentare e di monitorare i miei progressi.
So che posso scegliere con quali professionisti condividere anamnesi e dati di salute e revocare il consenso in qualsiasi momento; la revoca non pregiudica la liceità del trattamento precedente, ma può impedire ai professionisti di seguirmi in sicurezza.
"""},
    {"id": "fitness_waiver", "version": "1.0", "title": "Dichiarazione di idoneità e assunzione del rischio", "roles": ["client"], "required": True, "text": """
Dichiaro: (1) di essere in possesso di certificato medico di idoneità all'attività sportiva non agonistica in corso di validità (o agonistica se partecipo a competizioni), come previsto dal D.M. 24/04/2013 e successive modifiche, e di consegnarlo al trainer su richiesta; (2) di aver comunicato in modo veritiero e completo nell'anamnesi patologie, infortuni, interventi, farmaci, gravidanza e ogni condizione rilevante, e di aggiornarla tempestivamente; (3) di essere consapevole che l'attività fisica comporta rischi (es. traumi, affaticamento, eventi cardiovascolari) e di accettarli; (4) di interrompere l'allenamento e consultare un medico in caso di dolore, malessere, vertigini o sintomi anomali; (5) di eseguire gli esercizi secondo le indicazioni ricevute, anche quando mi alleno da solo con la scheda dell'app.
Il trainer è sollevato da responsabilità per danni derivanti da dichiarazioni false o incomplete, dal mancato rispetto delle indicazioni o da condizioni di salute non comunicate, fermo restando quanto inderogabilmente previsto dalla legge (art. 1229 c.c.).
"""},
    {"id": "nutrition_disclaimer", "version": "1.0", "title": "Avvertenze sull'alimentazione", "roles": ["client"], "required": True, "text": """
Prendo atto che: i consigli alimentari del personal trainer sono indicazioni generali basate sulle linee guida OMS e sulla letteratura scientifica (PubMed) e non costituiscono una dieta; solo un professionista abilitato (biologo nutrizionista, dietista o medico) può elaborare una dieta con grammature, calorie e macronutrienti; le stime di calorie e macro ottenute da foto dei piatti, codici a barre o etichette tramite intelligenza artificiale sono approssimative e vanno verificate; in presenza di patologie, disturbi del comportamento alimentare, gravidanza o allattamento devo seguire esclusivamente le indicazioni del medico o del professionista abilitato.
"""},
    {"id": "media", "version": "1.0", "title": "Consenso foto e video (uso interno)", "roles": ["client"], "required": True, "text": """
Acconsento che le foto check (frontale, laterale, posteriore), le foto di posing, la foto profilo e i video di esecuzione che carico siano conservati in archivio cifrato e visibili solo a me e ai professionisti che ho scelto, per valutare progressi e tecnica. Non saranno pubblicati né usati per altri scopi senza un mio ulteriore consenso specifico. Posso eliminarli in qualsiasi momento.
"""},
    {"id": "media_marketing", "version": "1.0", "title": "Uso promozionale di foto e risultati (facoltativo)", "roles": ["client"], "required": False, "text": """
Facoltativo: acconsento che il mio professionista possa pubblicare foto prima/dopo e risultati, anche in forma anonimizzata, sui propri canali, previa conferma di volta in volta. Ai sensi degli artt. 10 c.c. e 96-97 L. 633/1941 posso revocare il consenso in qualsiasi momento.
"""},
    {"id": "marketing", "version": "1.0", "title": "Comunicazioni promozionali (facoltativo)", "roles": ["client", "trainer", "nutritionist"], "required": False, "text": """
Facoltativo: acconsento a ricevere novità, offerte e comunicazioni promozionali via email, notifiche o WhatsApp. Posso revocare il consenso in ogni momento dal profilo.
"""},
    {"id": "professional", "version": "1.0", "title": "Dichiarazioni e obblighi del professionista", "roles": ["trainer", "nutritionist"], "required": True, "text": """
Dichiaro: (1) di possedere le qualifiche dichiarate nel profilo (per i personal trainer: certificazioni riconosciute, es. ISSA; per i nutrizionisti: iscrizione all'Albo dei Biologi, dei Dietisti o dei Medici, indicandone il numero) e una polizza di responsabilità civile professionale adeguata; (2) di operare entro i limiti della mia professione: il personal trainer non prescrive diete, grammature o calorie e non effettua diagnosi; il nutrizionista non prescrive farmaci ove non abilitato; (3) di trattare i dati dei clienti, in particolare quelli relativi alla salute, solo per le finalità della prestazione, nel rispetto del GDPR e del segreto professionale, come titolare autonomo del trattamento per i miei clienti; (4) di non scaricare, copiare o diffondere dati, foto e documenti dei clienti fuori dalla piattaforma senza il loro consenso; (5) di emettere regolare documento fiscale per i compensi ricevuti; (6) di richiedere ai clienti il certificato medico di idoneità prima di iniziare l'attività.
"""},
    {"id": "upload_media", "version": "1.0", "title": "Informativa caricamento documenti, foto e video", "roles": ["client", "trainer", "nutritionist"], "required": False, "text": """
I file che carichi (foto check, posing, video di esecuzione, foto dei pasti, etichette, referti e analisi, foto profilo) sono trasmessi con connessione cifrata e conservati in un archivio privato accessibile solo tramite il tuo account e quelli dei professionisti che hai scelto. Referti e analisi del sangue sono dati relativi alla salute: carica solo documenti che ti riguardano. Le foto di pasti, etichette e referti possono essere elaborate da un servizio di intelligenza artificiale solo per estrarre i valori richiesti, senza essere usate per altri scopi. Puoi eliminare i tuoi file in qualsiasi momento.
"""},
]

BY_ID = {d["id"]: d for d in DOCS}


def required_for(role: str):
    return [d["id"] for d in DOCS if d["required"] and role in d["roles"]]


def consent_records(ids):
    at = datetime.now(timezone.utc).isoformat()
    return [{"id": i, "version": BY_ID[i]["version"], "accepted_at": at} for i in ids if i in BY_ID]
