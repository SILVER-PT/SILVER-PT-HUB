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

## Backlog
- P1: native date/time pickers, push reminders for appointments, photo side-by-side comparison
- P1: meal delete confirmation, trainer macro targets per client
- P2: chat trainer-client, PDF report export, subscription/payments for coaching packages
