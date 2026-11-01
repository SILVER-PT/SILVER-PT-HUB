import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { fmtDate, useFetch } from "@/src/api";
import { Card, Empty, Loading, Screen, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

export default function FoodHistory() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { data, loading } = useFetch<any[]>(`/meals/history?client_id=${clientId}`);
  const hide = user?.role === "client" && !user.visibility?.nutrition;
  return (
    <Screen title="Storico alimenti" back>
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <Empty icon="restaurant-outline" text="Nessun alimento registrato." /> : null}
      {data?.map((d) => (
        <Card key={d.date} testID={`history-day-${d.date}`}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <T style={{ fontWeight: "900", flex: 1, textTransform: "capitalize" }}>{fmtDate(d.date)}</T>
            {!hide ? <T style={{ color: colors.brandPrimary, fontWeight: "900" }}>{Math.round(d.kcal)} kcal</T> : null}
          </View>
          {!hide ? <T muted style={{ fontSize: 12 }}>P {Math.round(d.protein)}g · C {Math.round(d.carbs)}g · G {Math.round(d.fat)}g</T> : null}
          {d.items.map((x: any) => (
            <View key={x.id} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Ionicons name={x.source === "barcode" ? "barcode" : x.source === "ai" ? "sparkles" : "create"} size={14} color={colors.muted} />
              <T style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>
                <T muted style={{ fontSize: 13, textTransform: "capitalize" }}>{x.meal_type}: </T>{x.name}{!hide && x.grams ? ` · ${x.grams}g` : ""}
              </T>
              {!hide ? <T muted style={{ fontSize: 12 }}>{Math.round(x.kcal)} kcal</T> : null}
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
