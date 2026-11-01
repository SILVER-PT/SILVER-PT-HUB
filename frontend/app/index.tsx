import { Redirect } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/src/auth";
import { Loading } from "@/src/ui";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { user, ready } = useAuth();
  const { colors } = useTheme();
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><Loading /></View>;
  return <Redirect href={user ? "/(tabs)" : "/login"} />;
}
