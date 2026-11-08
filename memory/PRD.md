# SILVER-PT — PRD

## Original problem statement
Personal trainer ISSA Europe: app to track and connect with clients. Appointments, profiles, ISSA measurements (circumferences + skinfolds), clients create profile & receive workout plans, start sessions, log planned vs done load/reps, charts of load/reps/execution/RIR progression, check photos (front, left side, back), posing photos for bodybuilding competitors, appointment comments, exercise video upload with trainer correction comments, nutrition diary with barcode and AI photo calorie/macro estimate. Black UI with red lasers and SILVER-PT logo.

## User choices
JWT email/password with roles (client registers with trainer invite code) · OpenAI GPT-5.5 vision (Emergent key) · Open Food Facts · Emergent Object Storage · full flow.

## Architecture
- Backend: FastAPI single `server.py`, MongoDB (users, appointments, comments, measurements, plans, sessions, photos, videos, files, meals), object storage proxy, emergentintegrations LLM.
- Frontend: Expo Router; tabs (Clienti/Home, Agenda, Video/Cibo, Profilo — role aware, NativeTabs on iOS 26+); screens client/[id], plans, plan-edit, session/[id], measurements, photos, videos, video/[id], progress (gifted-charts), nutrition, barcode (expo-camera), appointment/[id].

## Implemented (2026-11)
- Auth + roles + invite code; trainer client list & hub; profile (sex, birth, height, goal, competitor/category)
- Appointments (trainer create / client request, status, comments)
- ISSA measurements: 12 circumferences, 7 skinfolds, JP3/JP7 + Siri BF%, fat/lean mass, BMI
- Plans editor, live sessions (planned vs done kg/reps/RIR/execution, timer), session comments
- Progress charts (max load, reps, volume, RIR, execution) + weight/BF charts
- Check photos (front/side-left/back) + posing (competitors), videos with trainer comments & review inbox
- Nutrition: barcode (Open Food Facts), AI photo estimate (GPT-5.5), manual entry, daily totals
- Italian decimal comma support

## Implemented (2026-11) — batch 2
- Calendar + time chips for appointments/measurement date; photo comparison of two dates
- Visibility per client (measurements, photos, nutrition) default hidden — DCA-safe (no numbers, no meal plan shown)
- Nutritionist role (invite code), assignment per client, targets + meal plan with grams, diary comments per day, staff can complete/edit logged foods, private team notes coach↔nutritionist
- Subscription catalog (no end date, monthly/annual -15%), WhatsApp request, nutritionist tariffs, subscription assignment + video quota counter
- Measurements editable; food history; plans history with approach + archive; profile photos; client Q&A to coach

## Implemented — batch 3
- Birth date calendar with year chips; annual full-coaching chat (subscription.chat flag, /api/chat, polling); renewals card on coach dashboard (next renewal per monthly/annual); PDF progress report (expo-print + sharing) from client detail; measurement charts (weight, BF, lean/fat mass, Σ folds, BMI, each circumference)

## Implemented — batch 4
- Manual payments per renewal cycle (POST/GET/DELETE /api/payments, unique client+period), 6-month income summary card on coach dashboard, "Segna pagato"/undo on renewals
- Client chat tile red badge with unread coach messages (/api/chat-unread)
- Test data (TEST_ users/plans) cleaned

## Implemented — batch 5
- Flip coin logo (header, tap/hover reveals user avatar); PUT /api/auth/me (staff title/bio/WhatsApp + password change with bcrypt check) + profile banners
- Copilot AI chat for coach (GPT-5.5 via Emergent key, optional client context, soft-clear)
- Workout builder: AI/guided ISSA generator (/api/ai/plan), per-exercise type reps/time, intensity techniques, ISSA protocols (pyramids, waves, 5x5, GVT, rest-pause, drop set) adapted on estimated 1RM (/api/clients/{id}/maxes, Epley)
- Session player: time-based exercises, rest timer with audio beep + haptics, duration/time range on completed sessions
- Deferred: push notifications (needs google-services.json + native build)

## Backlog
- P1: native date/time pickers, push reminders for appointments, photo side-by-side comparison
- P1: meal delete confirmation, trainer macro targets per client
- P2: chat trainer-client, PDF report export, subscription/payments for coaching packages

## v8 (June 2026) — DONE (iteration_8 tested)
- Coin logo everywhere (login 1/3 screen, home, app icon/splash); header coin 50px → tap spins + opens Profile; notification bell (in-app + browser notifications on web)
- Backend module `backend/extra.py`: notifications + reminders (subscription expiry, check frequency per staff), exercise library (free-exercise-db), AI helpers (volume, nutrition label, blood scan, nutrition approach — uses OPENAI_API_KEY if set else Emergent key), session pause/resume/delete, plan delete with notify, plan comparison, meals summary, custom foods, staff public profile, nutritionist choice, nutri-owned clients, suggest coach, blood tests
- Plan builder: weekly/district volume + AI, exercise images, anamnesis/category reminder, notify confirm; client plan view with day tabs + images
- Session: pause/resume, save for later, stop sheet (save/delete), edit after save incl. date/time, 4s live sync
- Agenda: month calendar + scrollable upcoming list, kinds/durations, Jitsi or own video link; WhatsApp templates
- Derived ISSA indexes, anamnesis, BB categories, contest countdown/off season, blood tests screen, nutritionist approach
## Backlog
- Real push notifications (native) — postponed by user
- User will add own OpenAI key later (OPENAI_API_KEY)
- Refactor server.py into routers

## v9 (June 2026) — DONE (iterations 9-12 tested)
- Logos: HUB (login/app icon), Training coin, Nutrition coin per section; header coin 60px; on Profile stays on photo
- Silver chrome icons (SilverIcon), silver popup sheets
- Legal: backend/legal.py (terms, GDPR privacy, art.9 health consent, fitness waiver, nutrition disclaimer, media, optional marketing/media marketing, professional declaration, upload notice) with placeholders [TITOLARE]/[P.IVA]...; required at registration; ConsentGate at root for existing users; /legal/all page; upload notice in media picker
- Encryption: AES-256-GCM at rest (DATA_KEY in backend/.env) for profile anamnesis/health/injuries, blood tests, chat; E2E chat (tweetnacl box) with password-derived key backup (v2, v1 legacy fallback)
- Daily rotating invite code (HMAC, Europe/Rome)
- Dashboard tiles (clients live, appointments, finance, exercises library + coach videos); staff own workout/diet tab; client Training tab by period
- Body figure (android/gynoid, somatotype, critical zones); health/circadian fields + share toggles
- Diary: recent foods, plan items confirm/edit/remove, grams proportional scaling
- Nutrition: only nutritionist sets grams/macros (hide_numbers DCA mode); trainer only generic advice (backend rejects quantities)
- Plan editor: popup Select menus, volume modes total/upper-lower/district with AI split
## Backlog
- Health Connect / Apple Health / Garmin sync (native build)
- Trainer followed by another coach in-app
- Fill legal placeholders + lawyer review; push notifications; own OpenAI key; refactor server.py
