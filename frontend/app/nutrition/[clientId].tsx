import { useLocalSearchParams } from "expo-router";
import { Nutrition } from "@/src/nutrition";

export default function ClientNutrition() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  return <Nutrition clientId={clientId} readOnly title="Diario alimentare" />;
}
