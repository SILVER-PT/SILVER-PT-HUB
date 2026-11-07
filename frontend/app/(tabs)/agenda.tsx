import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, fmtDate, today, useFetch } from "@/src/api";
import { Btn, Card, Chip, ChipRow, Empty, ErrorText, Field, H, Loading, Screen, Sheet, T } from "@/src/ui";
import { makeStyles, useTheme } from "@/src/theme";
import { DatePicker, TimePicker } from "@/src/calendar";

export const STATUS: Record<string, string> = { requested: "Richiesto", confirmed: "Confermato", cancelled: "Annullato", done: "Completato" };
const KINDS: [string, number][] = [["Allenamento", 60], ["Visita", 60], ["Controllo", 30], ["Check misure", 30], ["Videocall", 30], ["Consulenza", 45]];
const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const jitsi = () => `https://meet.jit.si/SilverPT-${Math.random().toString(36).slice(2, 10)}`;

function MonthCalendar({ events, value, onChange }: { events: any[]; value: string; onChange: (d: string) => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const init = new Date(value + "T12:00:00");
  const [y, setY] = useState(init.getFullYear());
  const [m, setM] = useState(init.getMonth());
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const byDay: Record<string, number> = {};
  events.forEach((e) => { if (e.status !== "cancelled") { const k = localDay(e.start); byDay[k] = (byDay[k] || 0) + 1; } });
  const shift = (d: number) => { const nm = m + d; setY(y + Math.floor(nm / 12)); setM(((nm % 12) + 12) % 12); };
  return (
    <View style={s.wrap} testID="agenda-calendar">
      <View style={s.head}>
        <Pressable testID="cal-prev" onPress={() => shift(-1)} style={s.nav}><Ionicons name="chevron-back" size={20} color={colors.onSurface} /></Pressable>
        <Text style={s.month}>{MONTHS[m]} {y}</Text>
        <Pressable testID="cal-next" onPress={() => shift(1)} style={s.nav}><Ionicons name="chevron-forward" size={20} color={colors.onSurface} /></Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>{["L", "M", "M", "G", "V", "S", "D"].map((w, i) => <Text key={i} style={s.wd}>{w}</Text>)}</View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((d, i) => {
          const key = d ? `${y}-${pad(m + 1)}-${pad(d)}` : `e${i}`;
          const sel = key === value;
          const n = d ? byDay[key] : 0;
          return (
            <Pressable key={key} testID={d ? `cal-day-${key}` : undefined} disabled={!d} onPress={() => d && onChange(key)} style={s.cell}>
              {d ? (
                <View style={[s.day, key === today() && s.today, sel && s.sel]}>
                  <Text style={[s.dayText, sel && { color: colors.onBrandPrimary }]}>{d}</Text>
                  {n ? <View style={[s.dot, sel && { backgroundColor: colors.onBrandPrimary }]} /> : null}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function Agenda() {
  const { user } = useAuth();
  const staff = user?.role !== "client";
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading, reload } = useFetch<any[]>("/appointments");
  const clients = useFetch<any[]>(staff ? "/clients" : null);
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(today());
  const [f, setF] = useState({ client_id: "", title: "Allenamento", kind: "Allenamento", date: today(1), time: "18:00", duration_min: "60", location: "", notes: "", video_link: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const now = new Date().toISOString();
  const upcoming = (data || []).filter((a) => a.start >= now.slice(0, 16) && a.status !== "cancelled").sort((a, b) => a.start.localeCompare(b.start));
  const ofDay = (data || []).filter((a) => localDay(a.start) === day).sort((a, b) => a.start.localeCompare(b.start));

  const save = async () => {
    setErr("");
    const start = new Date(`${f.date}T${f.time}:00`);
    if (isNaN(start.getTime())) return setErr("Data o ora non valida");
    setBusy(true);
    try {
      await api("/appointments", { method: "POST", body: { ...f, start: start.toISOString(), duration_min: Number(f.duration_min) || 60 } });
      setOpen(false);
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const row = (a: any) => (
    <Card key={a.id} testID={`appointment-card-${a.id}`} onPress={() => router.push(`/appointment/${a.id}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: a.status === "confirmed" ? colors.brandPrimary : colors.muted }} />
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontWeight: "800" }}>{a.title}{staff ? ` · ${a.client_name}` : ""}</T>
        <T muted style={{ fontSize: 13 }}>{fmtDate(a.start, true)} · {a.duration_min} min{a.location ? ` · ${a.location}` : ""}</T>
      </View>
      {a.video_link ? <Ionicons name="videocam" size={18} color={colors.brandPrimary} /> : null}
      <T style={{ fontSize: 12, fontWeight: "800", color: a.status === "requested" ? colors.warning : colors.silver }}>{STATUS[a.status]}</T>
    </Card>
  );

  return (
    <Screen title="Agenda" tab right={<Btn testID="new-appointment-button" small icon="add" title={staff ? "Nuovo" : "Richiedi"} onPress={() => { setF((p) => ({ ...p, date: day >= today() ? day : today(1) })); setOpen(true); }} />}>
      {loading && !data ? <Loading /> : null}
      <H>{`Prossimi (${upcoming.length})`}</H>
      {data && upcoming.length === 0 ? <Empty icon="calendar-outline" text="Nessun appuntamento in programma." /> : null}
      {upcoming.length ? (
        <View style={{ maxHeight: 280, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          <ScrollView testID="upcoming-list" nestedScrollEnabled contentContainerStyle={{ padding: 8, gap: 8 }}>{upcoming.map(row)}</ScrollView>
        </View>
      ) : null}
      <MonthCalendar events={data || []} value={day} onChange={setDay} />
      <H>{fmtDate(day)}</H>
      {ofDay.length === 0 ? <T muted>Nessun evento in questo giorno.</T> : ofDay.map(row)}

      <Sheet visible={open} onClose={() => setOpen(false)} title={staff ? "Nuovo appuntamento" : "Richiedi appuntamento"}>
        {staff ? (
          <>
            <T muted>Cliente</T>
            <ChipRow>
              {(clients.data || []).map((c) => (
                <Chip key={c.id} testID={`appointment-client-chip-${c.id}`} label={c.name} active={f.client_id === c.id} onPress={() => set("client_id")(c.id)} />
              ))}
            </ChipRow>
          </>
        ) : null}
        <T muted>Tipo</T>
        <ChipRow>
          {KINDS.map(([k, d]) => <Chip key={k} testID={`appointment-kind-${k}`} label={`${k} · ${d}'`} active={f.kind === k} onPress={() => setF((p) => ({ ...p, kind: k, title: k, duration_min: String(d), video_link: k === "Videocall" && !p.video_link ? jitsi() : p.video_link }))} />)}
        </ChipRow>
        <Field testID="appointment-title-input" label="Titolo" value={f.title} onChangeText={set("title")} />
        <T muted>Data</T>
        <DatePicker testID="appointment-date" value={f.date} onChange={set("date")} />
        <T muted>Ora · {f.time}</T>
        <TimePicker value={f.time} onChange={set("time")} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field testID="appointment-duration-input" label="Durata (min)" keyboardType="numeric" value={f.duration_min} onChangeText={set("duration_min")} style={{ width: 120 }} />
          <Field testID="appointment-location-input" label="Luogo" value={f.location} onChangeText={set("location")} style={{ flex: 1 }} />
        </View>
        <T muted>Videochiamata</T>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Chip testID="video-auto-chip" label="Crea link automatico" active={f.video_link.includes("meet.jit.si")} onPress={() => set("video_link")(jitsi())} />
          <Chip testID="video-none-chip" label="Nessuna" active={!f.video_link} onPress={() => set("video_link")("")} />
        </View>
        <Field testID="appointment-video-input" placeholder="Oppure incolla il tuo link (Meet, Zoom…)" autoCapitalize="none" value={f.video_link} onChangeText={set("video_link")} />
        <Field testID="appointment-notes-input" label="Note" multiline value={f.notes} onChangeText={set("notes")} />
        <ErrorText text={err} />
        <Btn testID="appointment-save-button" title="Salva" onPress={save} loading={busy} />
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.brandPrimary, padding: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nav: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  month: { color: c.onSurface, fontWeight: "900", fontSize: 16, textTransform: "uppercase", letterSpacing: 1 },
  wd: { width: "14.28%", textAlign: "center", color: c.muted, fontSize: 12, fontWeight: "800", paddingVertical: 4 },
  cell: { width: "14.28%", height: 48, alignItems: "center", justifyContent: "center" },
  day: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  today: { borderWidth: 1, borderColor: c.silver },
  sel: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  dayText: { color: c.onSurface, fontWeight: "700" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.brandPrimary, marginTop: 2 },
}));
