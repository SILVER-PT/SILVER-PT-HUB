import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { Btn, Card, Chip, ErrorText, Field, H, Screen, T } from "@/src/ui";
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
  const [err] = useState("");
  const out = async () => {
    await logout();
    router.replace("/login");
  };
  return (
    <Screen title="Profilo" tab>
      <Card accent>
        <T style={{ fontSize: 20, fontWeight: "900" }}>{user?.name}</T>
        <T muted>{user?.email}</T>
        <T style={{ color: colors.brandPrimary, fontWeight: "800" }}>{user?.role === "trainer" ? "COACH · PFT ISSA EUROPE" : "CLIENTE"}</T>
        {user?.role === "trainer" ? <T testID="profile-invite-code">Codice invito: <T style={{ fontWeight: "900", letterSpacing: 3 }}>{user.invite_code}</T></T> : null}
      </Card>
      {user?.role === "client" ? (
        <>
          <H>Dati personali</H>
          <ProfileForm clientId={user.id} initial={user.profile} name={user.name} onSaved={refresh} />
        </>
      ) : null}
      <ErrorText text={err} />
      <Btn testID="logout-button" variant="ghost" icon="log-out-outline" title="Esci" onPress={out} />
    </Screen>
  );
}
