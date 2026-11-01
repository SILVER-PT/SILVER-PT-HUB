import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, num, useFetch } from "@/src/api";
import { Btn, Card, Chip, Empty, ErrorText, Field, H, Loading, Screen, Sheet, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

const EMPTY = { name: "", description: "", price: "", billing: "mensile", video_limit: "", min_months: "", features: "" };

export default function Packages() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const staff = user?.role !== "client";
  const { data, loading, reload } = useFetch<any[]>("/packages");
  const [billing, setBilling] = useState<"mensile" | "annuale">("mensile");
  const [form, setForm] = useState<any>(null);
  const [err, setErr] = useState("");

  const list = (data || []).filter((p) => p.billing === billing);
  const owners = [...new Map(list.map((p) => [p.owner_id, { id: p.owner_id, name: p.owner_name, role: p.owner_role }])).values()];

  const request = (p: any) => {
    const msg = `Ciao ${p.owner_name}, sono ${user?.name}. Vorrei informazioni sull'abbonamento "${p.name}" (${p.billing}, ${p.price}€).`;
    const phone = String(p.whatsapp || "").replace(/[^0-9]/g, "");
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
  };

  const save = async () => {
    setErr("");
    const body = { ...form, price: num(form.price), video_limit: Math.round(num(form.video_limit)), min_months: Math.round(num(form.min_months)),
      features: String(form.features).split("\n").map((x) => x.trim()).filter(Boolean) };
    try {
      if (form.id) await api(`/packages/${form.id}`, { method: "PUT", body });
      else await api("/packages", { method: "POST", body });
      setForm(null);
      reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const del = async (id: string) => {
    await api(`/packages/${id}`, { method: "DELETE" });
    setForm(null);
    reload();
  };

  return (
    <Screen title="Abbonamenti" back right={staff ? <Btn testID="new-package-button" small icon="add" title="Nuovo" onPress={() => setForm({ ...EMPTY, billing })} /> : null}>
      <Card accent>
        <T style={{ fontWeight: "900" }}>Un percorso senza scadenza</T>
        <T muted style={{ fontSize: 13 }}>Abbonamenti mensili o annuali, rinnovabili. L&apos;annuale fa sempre risparmiare il 15%.</T>
        {user?.role === "client" && user.subscription ? (
          <T testID="current-subscription" style={{ color: colors.brandPrimary, fontWeight: "800" }}>Il tuo abbonamento: {user.subscription.name} · {user.subscription.billing}</T>
        ) : null}
      </Card>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip testID="billing-mensile-chip" label="Mensile" active={billing === "mensile"} onPress={() => setBilling("mensile")} />
        <Chip testID="billing-annuale-chip" label="Annuale · -15%" active={billing === "annuale"} onPress={() => setBilling("annuale")} />
      </View>
      {loading && !data ? <Loading /> : null}
      {data && list.length === 0 ? <Empty icon="pricetags-outline" text="Nessun abbonamento disponibile." /> : null}
      {owners.map((o) => (
        <View key={o.id} style={{ gap: 12 }}>
          <H>{o.role === "trainer" ? `Coach · ${o.name}` : `Nutrizione · ${o.name}`}</H>
          {list.filter((p) => p.owner_id === o.id).map((p) => (
            <Card key={p.id} testID={`package-card-${p.id}`}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <T style={{ fontWeight: "900", fontSize: 16, flex: 1 }}>{p.name}</T>
                <T style={{ color: colors.brandPrimary, fontWeight: "900", fontSize: 20 }}>{p.price}€<T muted style={{ fontSize: 12 }}>/{p.billing === "mensile" ? "mese" : "anno"}</T></T>
              </View>
              {p.description ? <T muted style={{ fontSize: 13 }}>{p.description}</T> : null}
              {p.features?.map((f: string, i: number) => (
                <View key={i} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.brandPrimary} />
                  <T style={{ fontSize: 13 }}>{f}</T>
                </View>
              ))}
              {user?.role === "client" ? (
                <Btn testID={`package-request-${p.id}`} small icon="logo-whatsapp" title="Richiedi su WhatsApp" onPress={() => request(p)} disabled={!p.whatsapp} />
              ) : null}
              {user?.role === "client" && !p.whatsapp ? <T muted style={{ fontSize: 12 }}>Numero WhatsApp non ancora impostato.</T> : null}
              {p.owner_id === user?.id ? (
                <Pressable testID={`package-edit-${p.id}`} onPress={() => setForm({ ...p, price: String(p.price), video_limit: String(p.video_limit || ""), min_months: String(p.min_months || ""), features: (p.features || []).join("\n") })}>
                  <T style={{ color: colors.brandPrimary, fontWeight: "800" }}>Modifica</T>
                </Pressable>
              ) : null}
            </Card>
          ))}
        </View>
      ))}
      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? "Modifica abbonamento" : "Nuovo abbonamento"}>
        {form ? (
          <>
            <Field testID="package-name-input" label="Nome" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            <Field testID="package-desc-input" label="Descrizione" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Chip testID="package-billing-mensile" label="Mensile" active={form.billing === "mensile"} onPress={() => setForm({ ...form, billing: "mensile" })} />
              <Chip testID="package-billing-annuale" label="Annuale" active={form.billing === "annuale"} onPress={() => setForm({ ...form, billing: "annuale" })} />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Field testID="package-price-input" label="Prezzo €" keyboardType="decimal-pad" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} style={{ flex: 1 }} />
              <Field testID="package-videos-input" label="Video check" keyboardType="number-pad" value={form.video_limit} onChangeText={(v) => setForm({ ...form, video_limit: v })} style={{ flex: 1 }} />
              <Field testID="package-min-input" label="Min. mesi" keyboardType="number-pad" value={form.min_months} onChangeText={(v) => setForm({ ...form, min_months: v })} style={{ flex: 1 }} />
            </View>
            <Field testID="package-features-input" label="Cosa include (una riga per voce)" multiline value={form.features} onChangeText={(v) => setForm({ ...form, features: v })} />
            <ErrorText text={err} />
            <Btn testID="package-save-button" title="Salva" onPress={save} />
            {form.id ? <Btn testID="package-delete-button" variant="ghost" icon="trash" title="Elimina" onPress={() => del(form.id)} /> : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
