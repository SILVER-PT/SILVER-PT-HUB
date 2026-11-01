import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFetch } from "@/src/api";
import { Avatar, Btn, Card, H, Loading, Screen, T } from "@/src/ui";
import { ClientHub } from "@/src/client-hub";
import { ClientSettings } from "@/src/client-settings";
import { useAuth } from "@/src/auth";
import { ProfileForm } from "@/app/(tabs)/profile";
import { useTheme } from "@/src/theme";

const age = (b?: string) => (b ? Math.floor((Date.now() - new Date(b).getTime()) / 31557600000) : null);

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const trainer = user?.role === "trainer";
  const { data: c, reload } = useFetch<any>(`/clients/${id}`);
  const [edit, setEdit] = useState(false);
  if (!c) return <Screen title="Cliente" back><Loading /></Screen>;
  const p = c.profile || {};
  return (
    <Screen title={c.name} back>
      <Card accent testID="client-profile-card">
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Avatar path={c.avatar} name={c.name} size={56} />
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
        {p.injuries ? <T muted>Infortuni: {p.injuries}</T> : null}
        {p.competitor ? <T style={{ color: colors.brandPrimary, fontWeight: "800" }}>ATLETA BODYBUILDING{p.category ? ` · ${p.category}` : ""}</T> : null}
        {c.subscription ? <T muted style={{ fontSize: 13 }}>Abbonamento: {c.subscription.name} · {c.subscription.billing}</T> : null}
      </Card>
      <ClientHub clientId={id} trainer={trainer} nutri={!trainer} />
      {trainer ? <ClientSettings client={c} onChange={reload} /> : null}
      {trainer ? <H right={<Btn testID="client-edit-profile-button" small variant="dark" title={edit ? "Chiudi" : "Modifica"} onPress={() => setEdit(!edit)} />}>Profilo</H> : null}
      {edit && trainer ? <ProfileForm clientId={id} initial={c.profile} name={c.name} onSaved={() => { reload(); setEdit(false); }} /> : null}
    </Screen>
  );
}
