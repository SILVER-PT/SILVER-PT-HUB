import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, uploadFile } from "@/src/api";
import { Avatar, Btn, Card, Chip, ErrorText, Field, H, Screen, T, Toggle } from "@/src/ui";
import { AvatarCrop } from "@/src/avatar-crop";
import { MyNutritionist } from "@/src/my-nutri";
import { useMediaPicker } from "@/src/media";
import { DatePicker } from "@/src/calendar";
import { useTheme } from "@/src/theme";

export const EMPTY_PROFILE = { sex: "M", birth_date: "", height: "", phone: "", goal: "", competitor: false, category: "", off_season: false, contest_date: "", contest_name: "", activity: "1.55", injuries: "", notes: "", anamnesis: {} as Record<string, string> };
export const BB_CATEGORIES = ["Men's Physique", "Classic Physique", "Bodybuilding", "Bodybuilding Master", "Men's Wellness", "Bikini", "Wellness", "Figure", "Women's Physique", "Fit Model", "Body Fitness"];
const ACTIVITY = [["1.2", "Sedentario"], ["1.375", "Leggero"], ["1.55", "Moderato"], ["1.725", "Intenso"], ["1.9", "Atleta"]];
export const ANAMNESIS: [string, string][] = [
  ["chronic", "Patologie croniche"], ["temporary", "Patologie / disturbi temporanei"], ["injuries", "Infortuni e dolori"], ["surgery", "Interventi chirurgici"],
  ["medications", "Farmaci e integratori"], ["allergies", "Allergie e intolleranze"], ["family", "Familiarità (diabete, cardiopatie…)"],
  ["cycle", "Ciclo / ormoni"], ["lifestyle", "Stile di vita, sonno, stress, lavoro"], ["eating", "Abitudini alimentari / DCA"],
];
export const daysTo = (d?: string) => (d ? Math.ceil((new Date(d + "T12:00:00").getTime() - Date.now()) / 86400000) : null);

export function ProfileForm({ clientId, initial, name: initialName, onSaved }: { clientId: string; initial: any; name: string; onSaved?: () => void }) {
  const [p, setP] = useState<any>({ ...EMPTY_PROFILE, ...(initial || {}) });
  const [name, setName] = useState(initialName);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [birthOpen, setBirthOpen] = useState(false);
  const { colors } = useTheme();
  useEffect(() => setP({ ...EMPTY_PROFILE, ...(initial || {}) }), [initial]);
  const set = (k: string) => (v: any) => setP((x: any) => ({ ...x, [k]: v }));
  const setH = (k: string) => (v: any) => setP((x: any) => ({ ...x, health: { ...(x.health || {}), [k]: v } }));
  const save = async () => {
    setBusy(true);
    try {
      await api(`/clients/${clientId}/profile`, { method: "PUT", body: { name, profile: p } });
      setMsg("Profilo salvato");
      onSaved?.();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <Field testID="profile-name-input" label="Nome e cognome" value={name} onChangeText={setName} />
      <T muted>Sesso</T>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip testID="profile-sex-m" label="Uomo" active={p.sex === "M"} onPress={() => set("sex")("M")} />
        <Chip testID="profile-sex-f" label="Donna" active={p.sex === "F"} onPress={() => set("sex")("F")} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <Pressable testID="profile-birth-button" onPress={() => setBirthOpen(!birthOpen)} style={{ flex: 1, gap: 6 }}>
          <T muted style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>DATA DI NASCITA</T>
          <View style={{ minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: birthOpen ? colors.borderStrong : colors.border, backgroundColor: colors.surfaceTertiary, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="calendar" size={18} color={colors.brandPrimary} />
            <T testID="profile-birth-value">{p.birth_date ? new Date(p.birth_date + "T12:00:00").toLocaleDateString("it-IT") : "Seleziona"}</T>
          </View>
        </Pressable>
        <Field testID="profile-height-input" label="Altezza cm" keyboardType="decimal-pad" value={String(p.height)} onChangeText={set("height")} style={{ width: 110 }} />
      </View>
      {birthOpen ? <DatePicker yearNav testID="birth-date" value={p.birth_date || "1990-01-01"} onChange={(v) => { set("birth_date")(v); setBirthOpen(false); }} /> : null}
      <Field testID="profile-phone-input" label="Telefono" keyboardType="phone-pad" value={p.phone} onChangeText={set("phone")} />
      <Field testID="profile-goal-input" label="Obiettivo" value={p.goal} onChangeText={set("goal")} />
      <T muted>Livello di attività (per il metabolismo totale)</T>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {ACTIVITY.map(([v, l]) => <Chip key={v} testID={`profile-activity-${v}`} label={l} active={String(p.activity) === v} onPress={() => set("activity")(v)} />)}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip testID="profile-competitor-chip" label={p.competitor ? "✓ Atleta bodybuilding" : "Gareggio nel bodybuilding"} active={p.competitor} onPress={() => set("competitor")(!p.competitor)} />
      </View>
      {p.competitor ? (
        <>
          <T muted>Categoria</T>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {BB_CATEGORIES.map((c) => <Chip key={c} testID={`profile-category-${c}`} label={c} active={p.category === c} onPress={() => set("category")(c)} />)}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip testID="profile-offseason-chip" label="Off season" active={!!p.off_season} onPress={() => set("off_season")(true)} />
            <Chip testID="profile-contest-chip" label="Preparo una gara" active={!p.off_season} onPress={() => set("off_season")(false)} />
          </View>
          {!p.off_season ? (
            <>
              <Field testID="profile-contest-name" label="Gara" placeholder="es. IFBB Elite Pro Milano" value={p.contest_name} onChangeText={set("contest_name")} />
              <T muted>Data gara {p.contest_date ? `· ${new Date(p.contest_date + "T12:00:00").toLocaleDateString("it-IT")} (${daysTo(p.contest_date)} giorni)` : ""}</T>
              <DatePicker testID="contest-date" value={p.contest_date} onChange={set("contest_date")} />
            </>
          ) : null}
        </>
      ) : null}
      <H>Anamnesi</H>
      <T muted style={{ fontSize: 12 }}>Verrà ricordata al team quando crea schede e protocolli alimentari.</T>
      {ANAMNESIS.map(([k, l]) => (
        <Field key={k} testID={`anamnesis-${k}`} label={l} multiline value={p.anamnesis?.[k] || ""} onChangeText={(v) => setP((x: any) => ({ ...x, anamnesis: { ...(x.anamnesis || {}), [k]: v } }))} />
      ))}
      <H>Ritmo circadiano, sonno e attività</H>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field testID="health-wake" label="Sveglia (hh:mm)" value={p.health?.wake || ""} onChangeText={setH("wake")} style={{ flex: 1 }} />
        <Field testID="health-sleep" label="A letto (hh:mm)" value={p.health?.sleep || ""} onChangeText={setH("sleep")} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field testID="health-sleep-hours" label="Ore di sonno" keyboardType="decimal-pad" value={p.health?.sleep_hours || ""} onChangeText={setH("sleep_hours")} style={{ flex: 1 }} />
        <Field testID="health-steps" label="Passi medi/giorno" keyboardType="number-pad" value={p.health?.steps || ""} onChangeText={setH("steps")} style={{ flex: 1 }} />
      </View>
      <Toggle testID="health-shifts" label="Lavoro su turni" value={!!p.health?.shifts} onChange={(v) => setH("shifts")(v)} />
      {p.health?.shifts ? <Field testID="health-shifts-detail" label="Orari dei turni" multiline value={p.health?.shifts_detail || ""} onChangeText={setH("shifts_detail")} /> : null}
      <Field testID="health-other" label="Altri valori (FC a riposo, HRV, pressione…)" multiline value={p.health?.other || ""} onChangeText={setH("other")} />
      <Card>
        <T style={{ fontWeight: "800" }}>Collega app salute</T>
        <T muted style={{ fontSize: 12 }}>Google Health Connect, Apple Salute e Garmin Connect arriveranno con l&apos;app installata sul telefono. Per ora inserisci i valori a mano.</T>
      </Card>
      <H>Chi può vedere anamnesi e dati di salute</H>
      <Toggle testID="share-trainer" label="Il mio personal trainer" value={p.share?.trainer !== false} onChange={(v) => setP((x: any) => ({ ...x, share: { ...(x.share || {}), trainer: v } }))} />
      <Toggle testID="share-nutritionist" label="Il mio nutrizionista" value={p.share?.nutritionist !== false} onChange={(v) => setP((x: any) => ({ ...x, share: { ...(x.share || {}), nutritionist: v } }))} />
      {p.hidden_sensitive ? <T muted style={{ fontSize: 12 }}>🔒 Il cliente non condivide con te anamnesi e dati di salute.</T> : null}
      <Field testID="profile-notes-input" label="Note" multiline value={p.notes} onChangeText={set("notes")} />
      {msg ? <T testID="profile-save-message" style={{ color: msg === "Profilo salvato" ? colors.success : colors.error }}>{msg}</T> : null}
      <Btn testID="profile-save-button" title="Salva profilo" loading={busy} onPress={save} />
    </View>
  );
}

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState<any>({ whatsapp: user?.staff?.whatsapp || "", bio: user?.staff?.bio || "", title: user?.staff?.title || "", story: user?.staff?.story || "", story_public: !!user?.staff?.story_public });
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", repeat: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const picker = useMediaPicker();
  const [raw, setRaw] = useState<string | null>(null);
  const isStaff = user?.role !== "client";
  const out = async () => {
    await logout();
    router.replace("/login");
  };
  const changeAvatar = async () => {
    setErr("");
    const a = await picker.pick("images");
    if (a) setRaw(a.uri);
  };
  const uploadAvatar = async (asset: any) => {
    setRaw(null);
    setBusy(true);
    try {
      const path = await uploadFile(asset, "avatar.jpg");
      await api("/me", { method: "PUT", body: { avatar: path } });
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveStaff = async () => {
    setBanner(null);
    try {
      await api("/auth/me", { method: "PUT", body: { staff } });
      await refresh();
      setBanner({ ok: true, text: "Dati professionali salvati" });
    } catch (e: any) {
      setBanner({ ok: false, text: e.message });
    }
  };
  const changePassword = async () => {
    setBanner(null);
    if (pw.next.length < 6) return setBanner({ ok: false, text: "La nuova password deve avere almeno 6 caratteri" });
    if (pw.next !== pw.repeat) return setBanner({ ok: false, text: "Le due password non coincidono" });
    setPwBusy(true);
    try {
      await api("/auth/me", { method: "PUT", body: { current_password: pw.current, new_password: pw.next } });
      setPw({ current: "", next: "", repeat: "" });
      setBanner({ ok: true, text: "Password aggiornata" });
    } catch (e: any) {
      setBanner({ ok: false, text: e.message });
    } finally {
      setPwBusy(false);
    }
  };
  const roleLabel = user?.role === "trainer" ? "COACH · PFT ISSA EUROPE" : user?.role === "nutritionist" ? "NUTRIZIONISTA / DIETISTA" : "CLIENTE";
  return (
    <Screen title="Profilo" tab>
      <Card accent>
        <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
          <Pressable testID="avatar-change-button" onPress={changeAvatar} disabled={busy}>
            <Avatar path={user?.avatar} name={user?.name} size={72} testID="profile-avatar" />
            <View style={{ position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={busy ? "hourglass" : "camera"} size={14} color={colors.onBrandPrimary} />
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <T style={{ fontSize: 20, fontWeight: "900" }}>{user?.name}</T>
            <T muted>{user?.email}</T>
            <T style={{ color: colors.brandPrimary, fontWeight: "800", fontSize: 12 }}>{roleLabel}</T>
          </View>
        </View>
        {user?.role !== "client" ? <T testID="profile-invite-code">Codice invito: <T style={{ fontWeight: "900", letterSpacing: 3 }}>{user?.invite_code}</T></T> : null}
        {user?.role === "client" && user.subscription?.name ? <T testID="profile-subscription">Abbonamento: {user.subscription.name} · {user.subscription.billing}</T> : null}
      </Card>
      {isStaff ? (
        <>
          <H>Contatti per i clienti</H>
          <Field testID="staff-title-input" label="Titolo professionale" placeholder="es. Personal Trainer ISSA, Dietista" value={staff.title} onChangeText={(v) => setStaff({ ...staff, title: v })} />
          <Field testID="staff-whatsapp-input" label="Numero WhatsApp (con prefisso, es. 393331234567)" keyboardType="phone-pad" value={staff.whatsapp} onChangeText={(v) => setStaff({ ...staff, whatsapp: v })} />
          <Field testID="staff-bio-input" label="Bio" multiline value={staff.bio} onChangeText={(v) => setStaff({ ...staff, bio: v })} />
          <Field testID="staff-story-input" label="Racconto della tua attività" multiline placeholder="Percorso, metodo, risultati dei clienti…" value={staff.story} onChangeText={(v) => setStaff({ ...staff, story: v })} />
          <Toggle testID="staff-story-public" label="Mostra il racconto ai clienti" value={!!staff.story_public} onChange={(v) => setStaff({ ...staff, story_public: v })} />
          <Btn testID="profile-public-page" small variant="ghost" icon="eye" title="Vedi il mio profilo pubblico" onPress={() => router.push(`/staff/${user!.id}`)} />

          <Btn testID="staff-save-button" title="Salva contatti" onPress={saveStaff} />
          <Btn testID="profile-packages-button" variant="dark" icon="pricetags" title={user?.role === "trainer" ? "Gestisci abbonamenti" : "Prestazioni e tariffe"} onPress={() => router.push("/packages")} />
        </>
      ) : (
        <Btn testID="profile-packages-button" variant="dark" icon="pricetags" title="Abbonamenti" onPress={() => router.push("/packages")} />
      )}
      {user?.role === "client" ? (
        <>
          <MyNutritionist />
          <H>Dati personali</H>
          <ProfileForm clientId={user.id} initial={user.profile} name={user.name} onSaved={refresh} />
        </>
      ) : null}
      <H>Cambia password</H>
      <Field testID="pw-current-input" label="Password attuale" secureTextEntry value={pw.current} onChangeText={(v) => setPw({ ...pw, current: v })} />
      <Field testID="pw-new-input" label="Nuova password" secureTextEntry value={pw.next} onChangeText={(v) => setPw({ ...pw, next: v })} />
      <Field testID="pw-repeat-input" label="Ripeti nuova password" secureTextEntry value={pw.repeat} onChangeText={(v) => setPw({ ...pw, repeat: v })} />
      {pw.repeat && pw.next !== pw.repeat ? <T testID="pw-mismatch-text" style={{ color: colors.error, fontSize: 13 }}>Le password non coincidono</T> : null}
      <Btn testID="pw-save-button" variant="dark" icon="key" title="Aggiorna password" loading={pwBusy} disabled={!pw.current || !pw.next} onPress={changePassword} />
      {banner ? (
        <View testID="profile-banner" style={{ flexDirection: "row", gap: 8, alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: banner.ok ? colors.success : colors.error, backgroundColor: colors.surfaceSecondary }}>
          <Ionicons name={banner.ok ? "checkmark-circle" : "alert-circle"} size={20} color={banner.ok ? colors.success : colors.error} />
          <T testID="profile-banner-text" style={{ flex: 1, color: banner.ok ? colors.success : colors.error }}>{banner.text}</T>
          <Pressable testID="profile-banner-close" onPress={() => setBanner(null)} hitSlop={8}><Ionicons name="close" size={18} color={colors.muted} /></Pressable>
        </View>
      ) : null}
      <ErrorText text={err} />
      <Btn testID="privacy-docs-button" variant="dark" icon="shield-checkmark" title="Privacy e documenti" onPress={() => router.push("/legal/all")} />
      <Btn testID="logout-button" variant="ghost" icon="log-out-outline" title="Esci" onPress={out} />
      {picker.element}
      <AvatarCrop uri={raw} onCancel={() => setRaw(null)} onDone={uploadAvatar} />
    </Screen>
  );
}
