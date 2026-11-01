import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, uploadFile } from "@/src/api";
import { Avatar, Btn, Card, Chip, ErrorText, Field, H, Screen, T } from "@/src/ui";
import { useMediaPicker } from "@/src/media";
import { useTheme } from "@/src/theme";

export const EMPTY_PROFILE = { sex: "M", birth_date: "", height: "", phone: "", goal: "", competitor: false, category: "", injuries: "", notes: "" };

export function ProfileForm({ clientId, initial, name: initialName, onSaved }: { clientId: string; initial: any; name: string; onSaved?: () => void }) {
  const [p, setP] = useState<any>({ ...EMPTY_PROFILE, ...(initial || {}) });
  const [name, setName] = useState(initialName);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();
  useEffect(() => setP({ ...EMPTY_PROFILE, ...(initial || {}) }), [initial]);
  const set = (k: string) => (v: any) => setP((x: any) => ({ ...x, [k]: v }));
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
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field testID="profile-birth-input" label="Nascita (AAAA-MM-GG)" value={p.birth_date} onChangeText={set("birth_date")} style={{ flex: 1 }} />
        <Field testID="profile-height-input" label="Altezza cm" keyboardType="decimal-pad" value={String(p.height)} onChangeText={set("height")} style={{ width: 110 }} />
      </View>
      <Field testID="profile-phone-input" label="Telefono" keyboardType="phone-pad" value={p.phone} onChangeText={set("phone")} />
      <Field testID="profile-goal-input" label="Obiettivo" value={p.goal} onChangeText={set("goal")} />
      <Field testID="profile-injuries-input" label="Infortuni / patologie" value={p.injuries} onChangeText={set("injuries")} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip testID="profile-competitor-chip" label={p.competitor ? "✓ Atleta bodybuilding" : "Gareggio nel bodybuilding"} active={p.competitor} onPress={() => set("competitor")(!p.competitor)} />
      </View>
      {p.competitor ? <Field testID="profile-category-input" label="Categoria (es. Men's Physique, Classic)" value={p.category} onChangeText={set("category")} /> : null}
      <Field testID="profile-notes-input" label="Note" multiline value={p.notes} onChangeText={set("notes")} />
      {msg ? <T testID="profile-save-message" style={{ color: colors.success }}>{msg}</T> : null}
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
  const [staff, setStaff] = useState({ whatsapp: user?.staff?.whatsapp || "", bio: user?.staff?.bio || "" });
  const [saved, setSaved] = useState("");
  const picker = useMediaPicker();
  const isStaff = user?.role !== "client";
  const out = async () => {
    await logout();
    router.replace("/login");
  };
  const changeAvatar = async () => {
    setErr("");
    const asset = await picker.pick("images");
    if (!asset) return;
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
    try {
      await api("/me", { method: "PUT", body: { staff } });
      await refresh();
      setSaved("Salvato");
    } catch (e: any) {
      setErr(e.message);
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
        {user?.role === "trainer" ? <T testID="profile-invite-code">Codice invito: <T style={{ fontWeight: "900", letterSpacing: 3 }}>{user.invite_code}</T></T> : null}
        {user?.role === "client" && user.subscription?.name ? <T testID="profile-subscription">Abbonamento: {user.subscription.name} · {user.subscription.billing}</T> : null}
      </Card>
      {isStaff ? (
        <>
          <H>Contatti per i clienti</H>
          <Field testID="staff-whatsapp-input" label="Numero WhatsApp (con prefisso, es. 393331234567)" keyboardType="phone-pad" value={staff.whatsapp} onChangeText={(v) => setStaff({ ...staff, whatsapp: v })} />
          <Field testID="staff-bio-input" label="Presentazione" multiline value={staff.bio} onChangeText={(v) => setStaff({ ...staff, bio: v })} />
          {saved ? <T style={{ color: colors.success }}>{saved}</T> : null}
          <Btn testID="staff-save-button" title="Salva contatti" onPress={saveStaff} />
          <Btn testID="profile-packages-button" variant="dark" icon="pricetags" title={user?.role === "trainer" ? "Gestisci abbonamenti" : "Il mio tariffario"} onPress={() => router.push("/packages")} />
        </>
      ) : (
        <Btn testID="profile-packages-button" variant="dark" icon="pricetags" title="Abbonamenti" onPress={() => router.push("/packages")} />
      )}
      {user?.role === "client" ? (
        <>
          <H>Dati personali</H>
          <ProfileForm clientId={user.id} initial={user.profile} name={user.name} onSaved={refresh} />
        </>
      ) : null}
      <ErrorText text={err} />
      <Btn testID="logout-button" variant="ghost" icon="log-out-outline" title="Esci" onPress={out} />
      {picker.element}
    </Screen>
  );
}
