import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, useFetch } from "@/src/api";
import { Avatar, Btn, Card, Empty, ErrorText, H, Loading, Screen, Sheet, T } from "@/src/ui";
import { waOpen } from "@/src/whatsapp";
import { useTheme } from "@/src/theme";

function ChangeSheet({ target, onClose, current }: { target: any; onClose: () => void; current?: string | null }) {
  const { refresh } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const confirm = async () => {
    setBusy(true);
    try {
      await api("/me/nutritionist", { method: "PUT", body: { nutritionist_id: target.id } });
      await refresh();
      onClose();
      router.replace("/(tabs)/profile");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={!!target} onClose={onClose} title="Conferma cambio">
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <Ionicons name="warning" size={22} color={colors.warning} />
        <T style={{ flex: 1 }}>
          {current ? "Stai cambiando professionista. " : ""}Scegli {target?.name} come tuo nutrizionista? Una notifica arriverà {current ? "sia al professionista attuale sia" : ""} al nuovo professionista e al tuo coach.
        </T>
      </View>
      {current ? <T style={{ color: colors.warning, fontWeight: "700" }}>Attenzione: eventuali pacchetti già pagati al professionista attuale potrebbero non essere rimborsati.</T> : null}
      <ErrorText text={err} />
      <Btn testID="nutri-change-confirm" title="Confermo il cambio" loading={busy} onPress={confirm} />
      <Btn testID="nutri-change-cancel" variant="ghost" title="Annulla" onPress={onClose} />
    </Sheet>
  );
}

function Choose() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, loading } = useFetch<any[]>("/professionals?role=nutritionist");
  const [target, setTarget] = useState<any>(null);
  return (
    <Screen title="Nutrizionisti" back>
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <Empty icon="nutrition-outline" text="Nessun nutrizionista disponibile." /> : null}
      {data?.map((n) => (
        <Card key={n.id} testID={`nutri-option-${n.id}`} accent={user?.nutritionist_id === n.id} onPress={() => router.push(`/staff/${n.id}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Avatar path={n.avatar} name={n.name} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: "800" }}>{n.name}</T>
            <T muted style={{ fontSize: 13 }} numberOfLines={2}>{n.title || n.bio || "Nutrizionista"}</T>
          </View>
          {user?.nutritionist_id !== n.id ? <Btn testID={`nutri-choose-${n.id}`} small title="Scegli" onPress={() => setTarget(n)} /> : <T style={{ fontWeight: "800" }}>ATTUALE</T>}
        </Card>
      ))}
      <ChangeSheet target={target} current={user?.nutritionist_id} onClose={() => setTarget(null)} />
    </Screen>
  );
}

export default function StaffProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (id === "choose") return <Choose />;
  return <Profile id={id} />;
}

function Profile({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const { data: p, error } = useFetch<any>(`/staff/${id}`);
  const [target, setTarget] = useState<any>(null);
  if (!p) return <Screen title="Professionista" back>{error ? <ErrorText text={error} /> : <Loading />}</Screen>;
  const isMine = user?.nutritionist_id === id;
  return (
    <Screen title={p.role === "trainer" ? "Coach" : "Nutrizionista"} back>
      <Card accent testID="staff-profile-card" style={{ alignItems: "center", gap: 8 }}>
        <Avatar path={p.avatar} name={p.name} size={96} />
        <T style={{ fontSize: 22, fontWeight: "900" }}>{p.name}</T>
        {p.title ? <T style={{ color: colors.brandPrimary, fontWeight: "800" }}>{p.title}</T> : null}
        <T muted style={{ fontSize: 12 }}>{p.clients_count} clienti seguiti</T>
      </Card>
      {p.bio ? (<><H>Bio</H><Card><T testID="staff-bio">{p.bio}</T></Card></>) : null}
      {p.story ? (<><H>La mia attività</H><Card><T testID="staff-story">{p.story}</T></Card></>) : null}
      {p.packages?.length ? (
        <>
          <H>Prestazioni e tariffe</H>
          {p.packages.map((k: any) => (
            <Card key={k.id}>
              <T style={{ fontWeight: "800" }}>{k.name} · {k.price}€ {k.billing}</T>
              {k.description ? <T muted style={{ fontSize: 13 }}>{k.description}</T> : null}
            </Card>
          ))}
        </>
      ) : null}
      {user?.role !== "client" ? <H>{`Clienti in comune (${p.common_clients.length})`}</H> : null}
      {user?.role !== "client" && p.common_clients.length === 0 ? <T muted>Nessuno.</T> : null}
      {user?.role !== "client" ? p.common_clients.map((c: any) => (
        <Card key={c.id} onPress={() => router.push(`/client/${c.id}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Avatar path={c.avatar} name={c.name} size={36} />
          <T style={{ fontWeight: "700" }}>{c.name}</T>
        </Card>
      )) : null}
      {p.whatsapp ? <Btn testID="staff-whatsapp" variant="dark" icon="logo-whatsapp" title="Scrivi su WhatsApp" onPress={() => waOpen(p.whatsapp, `Ciao ${p.name}, ti scrivo dall'app SILVER-PT.`)} /> : null}
      {user?.role === "client" && p.role === "nutritionist" ? (
        isMine ? (
          <>
            <Btn testID="nutri-chat-button" icon="chatbubble-ellipses" title="Chat con il nutrizionista" onPress={() => router.push({ pathname: "/chat/[clientId]", params: { clientId: user.id, thread: "nutri" } })} />
            <Btn testID="nutri-change-button" variant="ghost" icon="swap-horizontal" title="Cambia nutrizionista" onPress={() => router.push("/staff/choose")} />
          </>
        ) : (
          <Btn testID="nutri-select-button" icon="checkmark" title="Scegli come mio nutrizionista" onPress={() => setTarget(p)} />
        )
      ) : null}
      <ChangeSheet target={target} current={user?.nutritionist_id} onClose={() => setTarget(null)} />
    </Screen>
  );
}
