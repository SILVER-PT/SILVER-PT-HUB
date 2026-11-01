import { Redirect, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { user } = useAuth();
  const { colors } = useTheme();
  if (!user) return <Redirect href="/login" />;
  const trainer = user.role === "trainer";
  const nutri = user.role === "nutritionist";
  const tabs = [
    { name: "index", label: trainer || nutri ? "Clienti" : "Home", icon: trainer || nutri ? "people" : "barbell", sf: trainer || nutri ? "person.2.fill" : "dumbbell.fill", hidden: false },
    { name: "agenda", label: "Agenda", icon: "calendar", sf: "calendar", hidden: nutri },
    { name: "feed", label: trainer ? "Video" : "Cibo", icon: trainer ? "videocam" : "nutrition", sf: trainer ? "video.fill" : "fork.knife", hidden: nutri },
    { name: "profile", label: "Profilo", icon: "person-circle", sf: "person.crop.circle.fill", hidden: false },
  ];

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        {tabs.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name} hidden={t.hidden}>
            <NativeTabs.Trigger.Icon sf={t.sf as any} />
            <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.brandPrimary,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontWeight: "700" },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            href: t.hidden ? null : undefined,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon as any} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
