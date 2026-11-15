import { Redirect } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/src/auth";
import { Loading } from "@/src/ui";
import { useTheme } from "@/src/theme";
import { registerPushNotifications } from "@/src/utils/push";

// Dentro il tuo pulsante o quando l'app si carica:
<Button title="Attiva Notifiche" onPress={registerPushNotifications} />

export default function Index() {
  const { user, ready } = useAuth();
  const { colors } = useTheme();
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><Loading /></View>;
  return <Redirect href={user ? "/(tabs)" : "/login"} />;
}
