import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api, today, useFetch } from "@/src/api";
import { Btn, Card, Chip, ChipRow, ErrorText, H, T, Toggle } from "@/src/ui";

// Trainer-only controls: data visibility for the client, nutritionist assignment, active subscription.
export function ClientSettings({ client, onChange }: { client: any; onChange: () => void }) {
  const router = useRouter();
  const team = useFetch<any[]>("/team");
  const packages = useFetch<any[]>("/packages");
  const [err, setErr] = useState("");
  const vis = client.visibility || {};
  const nutris = (team.data || []).filter((t) => t.role === "nutritionist");

  const save = async (body: any) => {
    setErr("");
    try {
      await api(`/clients/${client.id}/settings`, { method: "PUT", body });
      onChange();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <H>Visibilità per il cliente</H>
      <Card testID="visibility-card">
        <T muted style={{ fontSize: 13 }}>Disattivato = dati visibili solo a te (consigliato per clienti con DCA).</T>
        <Toggle testID="visibility-measurements-toggle" label="Peso e misure" value={!!vis.measurements} onChange={(v) => save({ visibility: { ...vis, measurements: v } })} />
        <Toggle testID="visibility-photos-toggle" label="Foto check" hint="Il cliente può sempre caricarle" value={!!vis.photos} onChange={(v) => save({ visibility: { ...vis, photos: v } })} />
        <Toggle testID="visibility-nutrition-toggle" label="Calorie e macro" hint="Se spento il cliente registra i pasti senza vedere numeri" value={!!vis.nutrition} onChange={(v) => save({ visibility: { ...vis, nutrition: v } })} />
      </Card>

      <H>Nutrizionista</H>
      {nutris.length === 0 ? <T muted>Nessun nutrizionista nel team. Può registrarsi con il tuo codice invito scegliendo &quot;Nutrizionista&quot;.</T> : (
        <ChipRow>
          <Chip testID="nutri-chip-none" label="Nessuno" active={!client.nutritionist_id} onPress={() => save({ nutritionist_id: "" })} />
          {nutris.map((n) => <Chip key={n.id} testID={`nutri-chip-${n.id}`} label={n.name} active={client.nutritionist_id === n.id} onPress={() => save({ nutritionist_id: n.id })} />)}
        </ChipRow>
      )}

      <H>Abbonamento attivo</H>
      <T muted style={{ fontSize: 13 }}>{client.subscription ? `${client.subscription.name} · ${client.subscription.price}€ ${client.subscription.billing} · dal ${client.subscription.since}` : "Nessun abbonamento assegnato"}</T>
      <ChipRow>
        <Chip testID="sub-chip-none" label="Nessuno" active={!client.subscription} onPress={() => save({ subscription: {} })} />
        {(packages.data || []).map((p) => (
          <Chip key={p.id} testID={`sub-chip-${p.id}`} label={`${p.name} · ${p.billing}`} active={client.subscription?.package_id === p.id}
            onPress={() => save({ subscription: { package_id: p.id, name: p.name, price: p.price, billing: p.billing, video_limit: p.video_limit, since: client.subscription?.package_id === p.id ? client.subscription.since : today() } })} />
        ))}
      </ChipRow>
      <ErrorText text={err} />
      <Btn testID="team-notes-button" variant="dark" icon="lock-closed" title="Note private del team" onPress={() => router.push(`/team-notes/${client.id}`)} />
    </View>
  );
}
