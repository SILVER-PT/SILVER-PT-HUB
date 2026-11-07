import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, fmtDate, num, today, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Bar, Btn, Card, Chip, ChipRow, Comments, Empty, ErrorText, Field, H, Loading, Screen, Sheet, Stat, T } from "@/src/ui";
import { useMediaPicker } from "@/src/media";
import { useTheme } from "@/src/theme";

export const MEALS = ["colazione", "pranzo", "cena", "spuntino"];
const micros = (f: any) => Object.fromEntries(["sugars", "fiber", "salt", "sodium"].map((k) => [k, f[k] === "" || f[k] == null ? null : num(f[k])]));

// Day / week / month intake, recalculated after every food added or removed.
function PeriodSummary({ s }: { s: any }) {
  const { colors } = useTheme();
  const [p, setP] = useState<"week" | "month">("week");
  const x = s[p];
  const cell = (l: string, v: number, u: string) => (
    <View style={{ flex: 1, minWidth: 70 }}><T muted style={{ fontSize: 11 }}>{l}</T><T style={{ fontWeight: "900" }}>{Math.round(v)}<T muted style={{ fontSize: 11 }}> {u}</T></T></View>
  );
  return (
    <Card testID="nutrition-period-summary">
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <T style={{ flex: 1, fontWeight: "900" }}>Introito {p === "week" ? "settimana" : "mese"}</T>
        <Chip testID="summary-week" label="Settimana" active={p === "week"} onPress={() => setP("week")} />
        <Chip testID="summary-month" label="Mese" active={p === "month"} onPress={() => setP("month")} />
      </View>
      <T muted style={{ fontSize: 12 }}>Totale ({x.days} giorni registrati)</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {cell("Kcal", x.total.kcal, "")}{cell("Prot", x.total.protein, "g")}{cell("Carbo", x.total.carbs, "g")}{cell("Grassi", x.total.fat, "g")}
      </View>
      <T muted style={{ fontSize: 12 }}>Media giornaliera</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {cell("Kcal", x.avg.kcal, "")}{cell("Prot", x.avg.protein, "g")}{cell("Carbo", x.avg.carbs, "g")}{cell("Grassi", x.avg.fat, "g")}
      </View>
      <T style={{ fontSize: 12, color: colors.onSurfaceTertiary }}>Oggi: zuccheri {s.day.total.sugars}g · fibre {s.day.total.fiber}g · sale {s.day.total.salt}g · sodio {s.day.total.sodium}g</T>
    </Card>
  );
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function Nutrition({ clientId, tab, readOnly, title = "Alimentazione" }: { clientId: string; tab?: boolean; readOnly?: boolean; title?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const hide = user?.role === "client" && !user.visibility?.nutrition;
  const [offset, setOffset] = useState(0);
  const date = today(offset);
  const { data, loading, reload } = useFetch<any[]>(`/meals?client_id=${clientId}&date=${date}`);
  const plan = useFetch<any>(`/clients/${clientId}/nutrition`);
  const comments = useFetch<any[]>(`/diary/${clientId}/${date}/comments`);
  const summary = useFetch<any>(hide ? null : `/meals/summary?client_id=${clientId}&date=${date}`);
  const refresh = () => { reload(); summary.reload(); };
  const tg = plan.data?.targets || {};
  const [meal, setMeal] = useState("pranzo");
  const [form, setForm] = useState<any | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [err, setErr] = useState("");
  const picker = useMediaPicker();

  const tot = (data || []).reduce((a, m) => ({ kcal: a.kcal + (m.kcal || 0), protein: a.protein + (m.protein || 0), carbs: a.carbs + (m.carbs || 0), fat: a.fat + (m.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const analyze = async () => {
    setErr("");
    const asset = await picker.pick("images", { base64: true });
    if (!asset?.base64) return;
    setAiBusy(true);
    try {
      const r = await api("/food/analyze", { method: "POST", body: { image_base64: asset.base64 } });
      setForm({ name: r.name, kcal: String(r.kcal ?? 0), protein: String(r.protein ?? 0), carbs: String(r.carbs ?? 0), fat: String(r.fat ?? 0), grams: "", source: "ai",
        info: `${(r.items || []).map((i: any) => `${i.name} ~${i.grams}g`).join(", ")} · affidabilità ${r.confidence || "—"}` });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    try {
      if (form.id) {
        await api(`/meals/${form.id}`, { method: "PUT", body: { name: form.name, grams: num(form.grams) || null, kcal: num(form.kcal), protein: num(form.protein), carbs: num(form.carbs), fat: num(form.fat), ...micros(form) } });
        setForm(null);
        refresh();
        return;
      }
      await api("/meals", { method: "POST", body: { client_id: clientId, date, meal_type: meal, name: form.name || "Alimento", grams: num(form.grams) || null,
        kcal: num(form.kcal), protein: num(form.protein), carbs: num(form.carbs), fat: num(form.fat), ...micros(form), source: form.source } });
      setForm(null);
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const del = async (id: string) => {
    await api(`/meals/${id}`, { method: "DELETE" });
    refresh();
  };

  const setF = (k: string) => (v: string) => setForm((p: any) => ({ ...p, [k]: v }));
  const fv = (k: string) => (form?.[k] ?? "") as string;

  return (
    <Screen title={title} tab={tab} back={!tab}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable testID="nutrition-prev-day" onPress={() => setOffset(offset - 1)} style={{ padding: 10 }}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <T testID="nutrition-date" style={{ fontWeight: "900", textTransform: "uppercase" }}>{offset === 0 ? "Oggi" : fmtDate(date)}</T>
        <Pressable testID="nutrition-next-day" onPress={() => setOffset(offset + 1)} style={{ padding: 10 }}><Ionicons name="chevron-forward" size={22} color={colors.onSurface} /></Pressable>
      </View>
      {hide ? (
        <Card accent testID="nutrition-diary-card">
          <T style={{ fontWeight: "900" }}>Il tuo diario</T>
          <T muted style={{ fontSize: 13 }}>Registra cosa mangi: scansiona, scatta una foto o scrivi il nome. Il tuo team si occupa del resto.</T>
        </Card>
      ) : (
        <Card accent testID="nutrition-totals">
          <T muted style={{ fontSize: 12, fontWeight: "700" }}>TOTALE GIORNATA</T>
          <T testID="nutrition-total-kcal" style={{ fontSize: 34, fontWeight: "900", color: colors.brandPrimary }}>{Math.round(tot.kcal)} <T muted>{tg.kcal ? `/ ${Math.round(tg.kcal)} kcal` : "kcal"}</T></T>
          {tg.kcal || tg.protein || tg.carbs || tg.fat ? (
            <View style={{ gap: 10 }} testID="nutrition-target-bars">
              {tg.kcal ? <Bar label="Calorie" value={tot.kcal} target={tg.kcal} unit="kcal" /> : null}
              <Bar label="Proteine" value={tot.protein} target={tg.protein} />
              <Bar label="Carboidrati" value={tot.carbs} target={tg.carbs} />
              <Bar label="Grassi" value={tot.fat} target={tg.fat} />
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Stat label="Proteine" value={Math.round(tot.protein)} unit="g" />
              <Stat label="Carbo" value={Math.round(tot.carbs)} unit="g" />
              <Stat label="Grassi" value={Math.round(tot.fat)} unit="g" />
            </View>
          )}
        </Card>
      )}
      {summary.data && !summary.data.hidden ? <PeriodSummary s={summary.data} /> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn testID="nutrition-plan-button" small variant="dark" icon="document-text" title={user?.role === "client" ? "Piano" : "Obiettivi e piano"} style={{ flex: 1 }} onPress={() => router.push(`/nutrition-plan/${clientId}`)} />
        <Btn testID="food-history-button" small variant="dark" icon="time" title="Storico" style={{ flex: 1 }} onPress={() => router.push(`/food-history/${clientId}`)} />
      </View>
      {!readOnly && (
        <>
          <ChipRow>
            {MEALS.map((m) => <Chip key={m} testID={`meal-type-${m}`} label={cap(m)} active={meal === m} onPress={() => setMeal(m)} />)}
          </ChipRow>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn testID="scan-barcode-button" icon="barcode" title="Scansiona" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/barcode", params: { date, meal } })} />
            <Btn testID="ai-photo-button" icon="sparkles" variant="ghost" title="Foto AI" style={{ flex: 1 }} loading={aiBusy} onPress={analyze} />
          </View>
          <Btn testID="manual-food-button" icon="create" variant="dark" title="Inserisci a mano" onPress={() => setForm({ name: "", kcal: "", protein: "", carbs: "", fat: "", grams: "", source: "manual" })} />
          {aiBusy ? <T muted>L&apos;AI sta analizzando il piatto…</T> : null}
          <ErrorText text={err} />
        </>
      )}
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <Empty icon="restaurant-outline" text="Nessun alimento registrato in questa giornata." /> : null}
      {MEALS.filter((m) => data?.some((x) => x.meal_type === m)).map((m) => (
        <View key={m} style={{ gap: 8 }}>
          <H>{cap(m)}</H>
          {data!.filter((x) => x.meal_type === m).map((x) => (
            <Card key={x.id} testID={`meal-item-${x.id}`} onPress={user?.role !== "client" ? () => setForm({ id: x.id, name: x.name, grams: x.grams ? String(x.grams) : "", kcal: String(x.kcal ?? ""), protein: String(x.protein ?? ""), carbs: String(x.carbs ?? ""), fat: String(x.fat ?? ""), sugars: String(x.sugars ?? ""), fiber: String(x.fiber ?? ""), salt: String(x.salt ?? ""), sodium: String(x.sodium ?? ""), source: x.source }) : undefined} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name={x.source === "barcode" ? "barcode" : x.source === "ai" ? "sparkles" : "create"} size={18} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: "800" }} numberOfLines={1}>{x.name}{!hide && x.grams ? ` · ${x.grams}g` : ""}</T>
                {!hide ? <T muted style={{ fontSize: 13 }}>{Math.round(x.kcal)} kcal · P {Math.round(x.protein)} · C {Math.round(x.carbs)} · G {Math.round(x.fat)}</T> : null}
              </View>
              {!readOnly && <Pressable testID={`meal-delete-${x.id}`} onPress={() => del(x.id)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="trash-outline" size={20} color={colors.muted} /></Pressable>}
            </Card>
          ))}
        </View>
      ))}
      {comments.data ? (
        <Comments items={comments.data} onSend={async (text) => { await api(`/diary/${clientId}/${date}/comments`, { method: "POST", body: { text } }); comments.reload(); }} />
      ) : null}
      {picker.element}
      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? "Completa alimento" : form?.source === "ai" ? (hide ? "Piatto riconosciuto" : "Stima AI") : "Nuovo alimento"}>
        {form?.info && !hide ? <T muted>{form.info}</T> : null}
        <Field testID="food-name-input" label="Nome" value={fv("name")} onChangeText={setF("name")} />
        {!hide ? (<>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field testID="food-grams-input" label="Grammi" keyboardType="decimal-pad" value={fv("grams")} onChangeText={setF("grams")} style={{ flex: 1 }} />
          <Field testID="food-kcal-input" label="Kcal" keyboardType="decimal-pad" value={fv("kcal")} onChangeText={setF("kcal")} style={{ flex: 1 }} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field testID="food-protein-input" label="Prot g" keyboardType="decimal-pad" value={fv("protein")} onChangeText={setF("protein")} style={{ flex: 1 }} />
          <Field testID="food-carbs-input" label="Carbo g" keyboardType="decimal-pad" value={fv("carbs")} onChangeText={setF("carbs")} style={{ flex: 1 }} />
          <Field testID="food-fat-input" label="Grassi g" keyboardType="decimal-pad" value={fv("fat")} onChangeText={setF("fat")} style={{ flex: 1 }} />
        </View>
        <T muted style={{ fontSize: 12 }}>Facoltativi</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field testID="food-sugars-input" label="di cui zuccheri g" keyboardType="decimal-pad" value={fv("sugars")} onChangeText={setF("sugars")} style={{ flex: 1 }} />
          <Field testID="food-fiber-input" label="Fibre g" keyboardType="decimal-pad" value={fv("fiber")} onChangeText={setF("fiber")} style={{ flex: 1 }} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Field testID="food-salt-input" label="Sale g" keyboardType="decimal-pad" value={fv("salt")} onChangeText={setF("salt")} style={{ flex: 1 }} />
          <Field testID="food-sodium-input" label="Sodio g" keyboardType="decimal-pad" value={fv("sodium")} onChangeText={setF("sodium")} style={{ flex: 1 }} />
        </View>
        </>) : null}
        <Btn testID="food-save-button" title={form?.id ? "Salva modifiche" : `Aggiungi a ${meal}`} onPress={save} />
      </Sheet>
    </Screen>
  );
}
