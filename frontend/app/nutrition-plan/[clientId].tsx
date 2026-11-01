import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, fmtDate, useFetch } from "@/src/api";
import { Btn, Card, Empty, ErrorText, Field, H, Loading, Screen, Stat, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

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

  useEffect(() => {
    if (data && !f) {
      const t = data.targets || {};
      setF({
        targets: { kcal: String(t.kcal ?? ""), protein: String(t.protein ?? ""), carbs: String(t.carbs ?? ""), fat: String(t.fat ?? "") },
        meal_plan: data.meal_plan?.length ? data.meal_plan : DEFAULT_MEALS.map((meal) => ({ meal, items: "" })),
        notes: data.notes || "",
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
        {data?.hidden ? <Card testID="meal-plan-hidden"><T muted>Il tuo piano alimentare viene seguito direttamente dal tuo team.</T></Card> : null}
        {!data?.hidden && !data?.meal_plan?.length ? <Empty icon="document-text-outline" text="Il piano alimentare non è ancora stato inserito." /> : null}
        {data?.meal_plan?.map((m: any, i: number) => (
          <Card key={i} testID={`meal-plan-view-${i}`}>
            <H>{m.meal}</H>
            <T>{m.items || "—"}</T>
          </Card>
        ))}
        {data?.notes ? <Card><T muted>{data.notes}</T></Card> : null}
        {data?.updated_by ? <T muted style={{ fontSize: 12 }}>Aggiornato da {data.updated_by} · {fmtDate(data.updated_at)}</T> : null}
      </Screen>
    );
  }

  if (!f) return <Screen title="Piano alimentare" back><Loading /></Screen>;
  const setT = (k: string) => (v: string) => setF({ ...f, targets: { ...f.targets, [k]: v } });
  const setMeal = (i: number, k: string, v: string) => setF({ ...f, meal_plan: f.meal_plan.map((m: any, j: number) => (j === i ? { ...m, [k]: v } : m)) });

  return (
    <Screen title="Piano alimentare" back>
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
      <Btn testID="meal-plan-save-button" icon="save" title="Salva piano" loading={busy} onPress={save} />
    </Screen>
  );
}
