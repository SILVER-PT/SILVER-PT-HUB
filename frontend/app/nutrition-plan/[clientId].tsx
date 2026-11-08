import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, fmtDate, useFetch } from "@/src/api";
import { Btn, Card, Chip, ChipRow, Empty, ErrorText, Field, H, Loading, Screen, Stat, T, Toggle } from "@/src/ui";
import { useTheme } from "@/src/theme";
import { ClientReminder } from "@/src/client-reminder";

function AdviceCard({ data }: { data: any }) {
  return (
    <Card testID="advice-card">
      <H>Consigli alimentari del coach</H>
      <T>{data.advice}</T>
      <T muted style={{ fontSize: 11 }}>Indicazioni generali secondo OMS e PubMed{data.advice_by ? ` · ${data.advice_by}` : ""}. Non sostituiscono una dieta di un professionista abilitato.</T>
    </Card>
  );
}

const APPROACHES = ["Mediterranea", "Low carb", "Chetogenica", "Carb cycling", "Digiuno intermittente", "Flessibile (IIFYM)", "Ipocalorica", "Reverse diet", "Peak week"];

const DEFAULT_MEALS = ["Colazione", "Spuntino", "Pranzo", "Merenda", "Cena"];

export default function NutritionPlan() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const staff = user?.role !== "client";
  const { data, loading } = useFetch<any>(`/clients/${clientId}/nutrition`);
  const [f, setF] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<any>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const askAi = async () => {
    setAiBusy(true);
    setAiErr("");
    try {
      setAi(await api("/ai/nutrition-approach", { method: "POST", body: { client_id: clientId, notes: f?.notes || "" } }));
    } catch (e: any) {
      setAiErr(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  useEffect(() => {
    if (data && !f) {
      const t = data.targets || {};
      setF({
        targets: { kcal: String(t.kcal ?? ""), protein: String(t.protein ?? ""), carbs: String(t.carbs ?? ""), fat: String(t.fat ?? "") },
        meal_plan: data.meal_plan?.length ? data.meal_plan : DEFAULT_MEALS.map((meal) => ({ meal, items: "" })),
        notes: data.notes || "",
        approach: data.approach || "",
        hide_numbers: !!data.hide_numbers,
        advice: data.advice || "",
      });
    }
  }, [data, f]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await api(`/clients/${clientId}/nutrition`, { method: "PUT", body: { ...f, targets: Object.fromEntries(Object.entries(f.targets).map(([k, v]) => [k, String(v).replace(",", ".")])), meal_plan: f.meal_plan.filter((m: any) => m.meal.trim()) } });
      setMsg("Piano salvato");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Screen title="Piano alimentare" back><Loading /></Screen>;

  if (!staff) {
    const t = data?.targets || {};
    return (
      <Screen title="Piano alimentare" back>
        {t.kcal ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Stat label="Kcal" value={t.kcal} /><Stat label="Prot" value={t.protein} unit="g" /><Stat label="Carb" value={t.carbs} unit="g" /><Stat label="Gras" value={t.fat} unit="g" />
          </View>
        ) : null}
        {data?.approach && !data?.hidden ? <T style={{ fontWeight: "800", color: colors.brandPrimary }}>Approccio: {data.approach}</T> : null}
        {data?.hidden ? <Card testID="meal-plan-hidden"><T muted>Il tuo piano alimentare viene seguito direttamente dal tuo team.</T></Card> : null}
        {!data?.hidden && !data?.meal_plan?.length ? <Empty icon="document-text-outline" text="Il piano alimentare non è ancora stato inserito." /> : null}
        {data?.meal_plan?.map((m: any, i: number) => (
          <Card key={i} testID={`meal-plan-view-${i}`}>
            <H>{m.meal}</H>
            <T>{m.items || "—"}</T>
          </Card>
        ))}
        {data?.notes ? <Card><T muted>{data.notes}</T></Card> : null}
        {data?.advice ? <AdviceCard data={data} /> : null}
        {data?.updated_by ? <T muted style={{ fontSize: 12 }}>Aggiornato da {data.updated_by} · {fmtDate(data.updated_at)}</T> : null}
      </Screen>
    );
  }

  if (!f) return <Screen title="Piano alimentare" back><Loading /></Screen>;

  if (user?.role === "trainer" && user.id !== clientId) {
    return (
      <Screen title="Consigli alimentari" back>
        <ClientReminder clientId={clientId} />
        <Card testID="trainer-advice-legal" style={{ borderColor: colors.warning }}>
          <T style={{ fontWeight: "900", color: colors.warning }}>Solo consigli alimentari</T>
          <T muted style={{ fontSize: 12 }}>Per legge il personal trainer può dare indicazioni generali su alimenti e abitudini secondo OMS e letteratura scientifica (PubMed), ma non diete, grammature, kcal o macro: queste spettano a nutrizionista, dietista o medico.</T>
        </Card>
        <Field testID="trainer-advice-input" label="Consigli per il cliente" multiline placeholder="es. Verdura a ogni pasto, legumi 3 volte a settimana, acqua durante la giornata…" value={f.advice} onChangeText={(v) => setF({ ...f, advice: v })} />
        <ErrorText text={msg && msg !== "Piano salvato" ? msg : ""} />
        {msg === "Piano salvato" ? <T style={{ color: colors.success }}>Consigli salvati</T> : null}
        <Btn testID="trainer-advice-save" icon="save" title="Salva consigli" loading={busy} onPress={async () => {
          setBusy(true);
          setMsg("");
          try { await api(`/clients/${clientId}/nutrition`, { method: "PUT", body: { advice: f.advice } }); setMsg("Piano salvato"); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
        }} />
        {data?.meal_plan?.length ? <T muted style={{ fontSize: 12 }}>Il cliente ha un piano del nutrizionista: puoi consultarlo ma non modificarlo.</T> : null}
        {data?.meal_plan?.map((m: any, i: number) => <Card key={i}><H>{m.meal}</H><T>{m.items || "—"}</T></Card>)}
      </Screen>
    );
  }
  const setT = (k: string) => (v: string) => setF({ ...f, targets: { ...f.targets, [k]: v } });
  const setMeal = (i: number, k: string, v: string) => setF({ ...f, meal_plan: f.meal_plan.map((m: any, j: number) => (j === i ? { ...m, [k]: v } : m)) });

  return (
    <Screen title="Piano alimentare" back>
      <ClientReminder clientId={clientId} />
      <H>Approccio</H>
      <ChipRow>
        {APPROACHES.map((a) => <Chip key={a} testID={`nutri-approach-${a}`} label={a} active={f.approach === a} onPress={() => setF({ ...f, approach: f.approach === a ? "" : a })} />)}
      </ChipRow>
      <Field testID="nutri-approach-input" placeholder="Oppure scrivi l'approccio" value={f.approach} onChangeText={(v) => setF({ ...f, approach: v })} />
      <Btn testID="nutri-approach-ai" small variant="ghost" icon="sparkles" title="Fai scegliere l'approccio all'AI" loading={aiBusy} onPress={askAi} />
      {ai ? (
        <Card accent testID="nutri-approach-ai-result">
          <T style={{ fontWeight: "900" }}>{ai.approach}</T>
          <T muted style={{ fontSize: 13 }}>{ai.kcal} kcal · P {ai.protein}g · C {ai.carbs}g · G {ai.fat}g</T>
          {ai.rationale ? <T style={{ fontSize: 13 }}>{ai.rationale}</T> : null}
          {ai.cautions ? <T style={{ fontSize: 13, color: colors.warning }}>⚠ {ai.cautions}</T> : null}
          <Btn testID="nutri-approach-apply" small icon="checkmark" title="Applica approccio e obiettivi" onPress={() => { setF({ ...f, approach: ai.approach, targets: { kcal: String(ai.kcal ?? ""), protein: String(ai.protein ?? ""), carbs: String(ai.carbs ?? ""), fat: String(ai.fat ?? "") } }); setAi(null); }} />
        </Card>
      ) : null}
      <ErrorText text={aiErr} />
      <H>Obiettivi giornalieri</H>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field testID="target-kcal-input" label="Kcal" keyboardType="decimal-pad" value={f.targets.kcal} onChangeText={setT("kcal")} style={{ flex: 1 }} />
        <Field testID="target-protein-input" label="Prot g" keyboardType="decimal-pad" value={f.targets.protein} onChangeText={setT("protein")} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field testID="target-carbs-input" label="Carbo g" keyboardType="decimal-pad" value={f.targets.carbs} onChangeText={setT("carbs")} style={{ flex: 1 }} />
        <Field testID="target-fat-input" label="Grassi g" keyboardType="decimal-pad" value={f.targets.fat} onChangeText={setT("fat")} style={{ flex: 1 }} />
      </View>
      <H>Pasti e grammature</H>
      {f.meal_plan.map((m: any, i: number) => (
        <Card key={i} testID={`meal-plan-edit-${i}`}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <Field testID={`meal-plan-name-${i}`} label="Pasto" value={m.meal} onChangeText={(v) => setMeal(i, "meal", v)} style={{ flex: 1 }} />
            <Pressable testID={`meal-plan-remove-${i}`} onPress={() => setF({ ...f, meal_plan: f.meal_plan.filter((_: any, j: number) => j !== i) })} style={{ padding: 12 }}>
              <Ionicons name="trash-outline" size={20} color={colors.muted} />
            </Pressable>
          </View>
          <Field testID={`meal-plan-items-${i}`} multiline placeholder={"es. 80g fiocchi d'avena\n200ml latte"} value={m.items} onChangeText={(v) => setMeal(i, "items", v)} />
        </Card>
      ))}
      <Btn testID="meal-plan-add-button" small variant="ghost" icon="add" title="Pasto" onPress={() => setF({ ...f, meal_plan: [...f.meal_plan, { meal: "", items: "" }] })} />
      <Field testID="meal-plan-notes-input" label="Indicazioni generali" multiline value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} />
      {user?.role === "trainer" ? <T muted style={{ fontSize: 12 }}>Le grammature dovrebbero essere inserite dal nutrizionista/dietista del team.</T> : null}
      {msg ? <T testID="meal-plan-message" style={{ color: colors.success }}>{msg}</T> : null}
      <ErrorText text="" />
      <Toggle testID="hide-numbers-toggle" label="Nascondi kcal, macro e grammature al cliente" hint="Modalità sicura per pazienti con disturbi del comportamento alimentare" value={!!f.hide_numbers} onChange={(v) => setF({ ...f, hide_numbers: v })} />
      <Btn testID="meal-plan-save-button" icon="save" title="Salva piano" loading={busy} onPress={save} />
    </Screen>
  );
}
