import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmtDate, useFetch } from "@/src/api";
import { Btn, Card, H, Loading, Screen, Stat, T } from "@/src/ui";
import { Renewals } from "@/src/renewals";
import { useAuth } from "@/src/auth";

export default function Finance() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: d } = useFetch<any>("/dashboard");
  const clients = useFetch<any[]>("/clients");
  if (!d) return <Screen title="Finanze" back><Loading /></Screen>;
  const f = d.finance;
  return (
    <Screen title="Finanze" back>
      <Card accent testID="finance-summary">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stat label="Mensile stimato" value={`${Math.round(f.monthly_estimate)}€`} />
          <Stat label="Clienti paganti" value={f.paying_clients} />
          <Stat label="Rinnovi 30gg" value={`${f.renewals_30d_total}€`} />
        </View>
      </Card>
      <H>Prossimi rinnovi</H>
      {f.renewals_30d.length === 0 ? <T muted>Nessun rinnovo nei prossimi 30 giorni.</T> : null}
      {f.renewals_30d.map((r: any) => (
        <Card key={r.id} onPress={() => router.push(`/client/${r.id}`)}>
          <T style={{ fontWeight: "800" }}>{r.name} · {r.price}€</T>
          <T muted style={{ fontSize: 12 }}>{r.package} · {fmtDate(r.date)}</T>
        </Card>
      ))}
      {user?.role === "trainer" && clients.data ? <Renewals clients={clients.data} /> : null}
      <Btn testID="finance-packages" variant="dark" icon="pricetags" title="Gestisci listino" onPress={() => router.push("/packages")} />
    </Screen>
  );
}
