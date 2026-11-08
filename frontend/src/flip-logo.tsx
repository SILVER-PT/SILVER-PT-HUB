import { useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useAuth } from "@/src/auth";
import { fileUrl } from "@/src/api";
import { useTheme } from "@/src/theme";

export const COIN = require("../assets/images/logo-coin.png"); // SILVER-PT Training
export const HUB = require("../assets/images/logo-hub.png");
export const NUTRI = require("../assets/images/logo-nutrition.png");

const NUTRI_ROUTES = ["/nutrition", "/nutrition-plan", "/food-history", "/barcode", "/staff"];
const NUTRI_ROLE_ROUTES = ["/finance", "/team-live", "/packages", "/(tabs)/agenda", "/agenda"];

// Section-aware coin: Nutrition logo in diet / dietitian pages, Training elsewhere.
// Tap = spin and open Profile. On the Profile page the coin stays on the profile photo.
export function FlipLogo({ size = 60 }: { size?: number }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const path = usePathname();
  const onProfile = path === "/profile";
  const nutri = NUTRI_ROUTES.some((r) => path.startsWith(r)) || (path === "/feed" && user?.role === "client") ||
    (user?.role === "nutritionist" && (path === "/" || NUTRI_ROLE_ROUTES.some((r) => path.startsWith(r))));
  const rot = useSharedValue(onProfile ? 180 : 0);
  const [busy, setBusy] = useState(false);
  const onTap = () => {
    if (busy) return;
    setBusy(true);
    const to = rot.value + (onProfile ? 360 : 180);
    rot.value = withTiming(to, { duration: 700, easing: Easing.inOut(Easing.cubic) });
    setTimeout(() => {
      setBusy(false);
      if (!onProfile) {
        rot.value = 0;
        router.push("/(tabs)/profile");
      }
    }, 720);
  };
  const front = useAnimatedStyle(() => {
    const r = ((rot.value % 360) + 360) % 360;
    return { transform: [{ perspective: 600 }, { rotateY: `${rot.value}deg` }], opacity: r > 90 && r < 270 ? 0 : 1 };
  });
  const back = useAnimatedStyle(() => {
    const r = ((rot.value % 360) + 360) % 360;
    return { transform: [{ perspective: 600 }, { rotateY: `${rot.value + 180}deg` }], opacity: r > 90 && r < 270 ? 1 : 0 };
  });
  const circle = { width: size, height: size, borderRadius: size / 2, position: "absolute" as const, overflow: "hidden" as const, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.silver };
  return (
    <Pressable testID="flip-logo" onPress={onTap} hitSlop={6} style={{ width: size, height: size }} accessibilityLabel="Apri profilo">
      <Animated.View style={[circle, front]}>
        <Image testID={nutri ? "flip-logo-nutrition" : "flip-logo-training"} source={nutri ? NUTRI : COIN} style={{ width: size, height: size }} contentFit="cover" />
      </Animated.View>
      <Animated.View style={[circle, back]} testID="flip-logo-back">
        {user?.avatar ? (
          <Image source={{ uri: fileUrl(user.avatar) }} style={{ width: size, height: size }} contentFit="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }}>
            <Animated.Text style={{ color: colors.onBrandTertiary, fontWeight: "900", fontSize: size * 0.4 }}>{(user?.name || "?").slice(0, 1).toUpperCase()}</Animated.Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
