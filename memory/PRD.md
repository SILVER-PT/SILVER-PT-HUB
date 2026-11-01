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

## Backlog
- P1: native date/time pickers, push reminders for appointments, photo side-by-side comparison
- P1: meal delete confirmation, trainer macro targets per client
- P2: chat trainer-client, PDF report export, subscription/payments for coaching packages
