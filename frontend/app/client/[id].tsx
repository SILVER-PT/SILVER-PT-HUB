import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, useFetch } from "@/src/api";
import { Avatar, Btn, Card, Chip, ChipRow, ErrorText, Field, H, Loading, Screen, T } from "@/src/ui";
import { shareReport } from "@/src/report";
import { ClientHub } from "@/src/client-hub";
import { ClientSettings } from "@/src/client-settings";
import { useAuth } from "@/src/auth";
import { ProfileForm } from "@/app/(tabs)/profile";
import { Countdown } from "@/app/(tabs)/index";
import { ClientReminder } from "@/src/client-reminder";
import { WaTemplates } from "@/src/whatsapp";
import { useTheme } from "@/src/theme";

const age = (b?: string) => (b ? Math.floor((Date.now() - new Date(b).getTime()) / 31557600000) : null);
const FREQ = [0, 7, 14, 21, 28, 30, 60];

function CheckFrequency({ c, role, onChange }: { c: any; role: string; onChange: () => void }) {
  const cur = Number(c.checks?.[role] || 0);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  const set = async (n: number) => {
    setErr("");
    try {
      await api(`/clients/${c.id}/checks`, { method: "PUT", body: { every_days: n } });
      onChange();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <Card testID="check-frequency-card">
      <T style={{ fontWeight: "900" }}>Frequenza check</T>
      <T muted style={{ fontSize: 12 }}>Tu e il cliente riceverete un avviso quando è ora di foto e misure.</T>
      <ChipRow>
        {FREQ.map((n) => <Chip key={n} testID={`check-freq-${n}`} label={n ? `Ogni ${n} gg` : "Nessun avviso"} active={cur === n} onPress={() => set(n)} />)}
      </ChipRow>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <Field testID="check-freq-custom" label="Personalizzata (giorni)" keyboardType="number-pad" value={custom} onChangeText={setCustom} style={{ flex: 1 }} />
        <Btn small variant="dark" title="Imposta" onPress={() => Number(custom) > 0 && set(Number(custom))} />
      </View>
      <ErrorText text={err} />
    </Card>
  );
}

function SuggestCoach({ clientId }: { clientId: string }) {
  const router = useRouter();
  const { data } = useFetch<any[]>("/professionals?role=trainer");
  const [sent, setSent] = useState("");
  if (!data?.length) return null;
  return (
    <Card testID="suggest-coach-card">
      <T style={{ fontWeight: "900" }}>Cliente senza personal trainer</T>
      <T muted style={{ fontSize: 12 }}>Suggerisci un coach adatto: il cliente riceverà una notifica con il suo profilo e il codice invito.</T>
      {data.map((t) => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} key={t.id}>
          <Btn small variant="ghost" icon="person" title="" onPress={() => router.push(`/staff/${t.id}`)} />
          <Avatar path={t.avatar} name={t.name} size={36} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: "800" }}>{t.name}</T>
            <T muted style={{ fontSize: 12 }} numberOfLines={1}>{t.title || t.bio}</T>
          </View>
          <Btn testID={`suggest-coach-${t.id}`} small variant={sent === t.id ? "dark" : "primary"} title={sent === t.id ? "Inviato ✓" : "Suggerisci"}
            onPress={async () => { await api(`/clients/${clientId}/suggest-coach`, { method: "POST", body: { trainer_id: t.id } }); setSent(t.id); }} />
        </View>
      ))}
    </Card>
  );
}

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const trainer = user?.role === "trainer";
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState("");
  const makePdf = async () => {
    setPdfBusy(true);
    setPdfErr("");
    try {
      await shareReport(id);
    } catch (e: any) {
      setPdfErr(e.message || "Impossibile creare il PDF");
    } finally {
      setPdfBusy(false);
    }
  };
  const { data: c, reload } = useFetch<any>(`/clients/${id}`);
  const [edit, setEdit] = useState(false);
  if (!c) return <Screen title="Cliente" back><Loading /></Screen>;
  const p = c.profile || {};
  return (
    <Screen title={c.name} back>
      <Card accent testID="client-profile-card">
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Avatar path={c.avatar} name={c.name} size={72} />
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 20, fontWeight: "900" }}>{c.name}</T>
            <T muted>{c.email}{p.phone ? ` · ${p.phone}` : ""}</T>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
          <T>{p.sex === "F" ? "Donna" : "Uomo"}</T>
          {age(p.birth_date) ? <T>{age(p.birth_date)} anni</T> : null}
          {p.height ? <T>{p.height} cm</T> : null}
        </View>
        {p.goal ? <T>Obiettivo: {p.goal}</T> : null}
        {c.subscription && trainer ? <T muted style={{ fontSize: 13 }}>Abbonamento: {c.subscription.name} · {c.subscription.billing}</T> : null}
        {!trainer && c.nutritionist_id && c.trainer_id ? <T muted style={{ fontSize: 13 }}>Seguito anche dal personal trainer</T> : null}
      </Card>
      <Countdown profile={p} />
      <ClientReminder clientId={id} />
      <ClientHub clientId={id} trainer={trainer} nutri={!trainer} chat={!!c.subscription?.chat} nutriChat={!trainer && !!c.nutritionist_id} />
      <Btn testID="report-pdf-button" icon="document" variant="ghost" title="Report progressi PDF" loading={pdfBusy} onPress={makePdf} />
      <ErrorText text={pdfErr} />
      {!trainer && !c.trainer_id ? <SuggestCoach clientId={id} /> : null}
      <CheckFrequency c={c} role={user!.role} onChange={reload} />
      <H>Messaggi WhatsApp pronti</H>
      <WaTemplates phone={p.phone} name={c.name} staffName={user!.name} />
      <Btn testID="client-new-appointment" variant="dark" icon="calendar" title="Programma visita o videocall" onPress={() => router.push("/(tabs)/agenda")} />
      {trainer ? <ClientSettings client={c} onChange={reload} /> : null}
      <H right={<Btn testID="client-edit-profile-button" small variant="dark" title={edit ? "Chiudi" : "Modifica"} onPress={() => setEdit(!edit)} />}>Profilo e anamnesi</H>
      {edit ? <ProfileForm clientId={id} initial={c.profile} name={c.name} onSaved={() => { reload(); setEdit(false); }} /> : null}
      {!edit && !p.competitor ? null : null}
      <T muted style={{ fontSize: 11, color: colors.muted }}>Le modifiche al profilo vengono notificate al resto del team.</T>
    </Screen>
  );
}
