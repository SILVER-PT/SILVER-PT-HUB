import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { api, fmtDate, today, useFetch } from "@/src/api";
import { Btn, Card, Chip, ChipRow, Empty, ErrorText, Field, H, Loading, Screen, Sheet, T } from "@/src/ui";
import { useTheme } from "@/src/theme";
import { DatePicker, TimePicker } from "@/src/calendar";

export const STATUS: Record<string, string> = { requested: "Richiesto", confirmed: "Confermato", cancelled: "Annullato", done: "Completato" };

export default function Agenda() {
  const { user } = useAuth();
  const trainer = user?.role === "trainer";
  const router = useRouter();
  const { colors } = useTheme();
  const { data, loading, reload } = useFetch<any[]>("/appointments");
  const clients = useFetch<any[]>(trainer ? "/clients" : null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ client_id: "", title: "Allenamento", date: today(1), time: "18:00", duration_min: "60", location: "", notes: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const now = new Date().toISOString();
  const upcoming = (data || []).filter((a) => a.start >= now.slice(0, 16) && a.status !== "cancelled");
  const past = (data || []).filter((a) => !upcoming.includes(a)).reverse();

  const save = async () => {
    setErr("");
    const start = new Date(`${f.date}T${f.time}:00`);
    if (isNaN(start.getTime())) return setErr("Data o ora non valida (AAAA-MM-GG, HH:MM)");
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
        <T style={{ fontWeight: "800" }}>{a.title}{trainer ? ` · ${a.client_name}` : ""}</T>
        <T muted style={{ fontSize: 13 }}>{fmtDate(a.start, true)} · {a.duration_min} min{a.location ? ` · ${a.location}` : ""}</T>
      </View>
      <T style={{ fontSize: 12, fontWeight: "800", color: a.status === "requested" ? colors.warning : colors.silver }}>{STATUS[a.status]}</T>
    </Card>
  );

  return (
    <Screen title="Agenda" tab right={<Btn testID="new-appointment-button" small icon="add" title={trainer ? "Nuovo" : "Richiedi"} onPress={() => setOpen(true)} />}>
      {loading && !data ? <Loading /> : null}
      <H>In programma</H>
      {data && upcoming.length === 0 ? <Empty icon="calendar-outline" text="Nessun appuntamento in programma." /> : null}
      {upcoming.map(row)}
      {past.length ? <H>Passati / annullati</H> : null}
      {past.map(row)}

      <Sheet visible={open} onClose={() => setOpen(false)} title={trainer ? "Nuovo appuntamento" : "Richiedi appuntamento"}>
        {trainer ? (
          <>
            <T muted>Cliente</T>
            <ChipRow>
              {(clients.data || []).map((c) => (
                <Chip key={c.id} testID={`appointment-client-chip-${c.id}`} label={c.name} active={f.client_id === c.id} onPress={() => set("client_id")(c.id)} />
              ))}
            </ChipRow>
          </>
        ) : null}
        <Field testID="appointment-title-input" label="Titolo" value={f.title} onChangeText={set("title")} />
        <T muted>Data</T>
        <DatePicker testID="appointment-date" value={f.date} onChange={set("date")} />
        <T muted>Ora · {f.time}</T>
        <TimePicker value={f.time} onChange={set("time")} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field testID="appointment-duration-input" label="Durata (min)" keyboardType="numeric" value={f.duration_min} onChangeText={set("duration_min")} style={{ width: 120 }} />
          <Field testID="appointment-location-input" label="Luogo" value={f.location} onChangeText={set("location")} style={{ flex: 1 }} />
        </View>
        <Field testID="appointment-notes-input" label="Note" multiline value={f.notes} onChangeText={set("notes")} />
        <ErrorText text={err} />
        <Btn testID="appointment-save-button" title="Salva" onPress={save} loading={busy} />
      </Sheet>
    </Screen>
  );
}
