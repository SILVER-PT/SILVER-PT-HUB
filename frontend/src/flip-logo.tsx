import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { fileUrl } from "@/src/api";
import { useTheme } from "@/src/theme";

export const COIN = require("../assets/images/logo-coin.png");

// Brand coin: tap spins 360° (user's photo on the back halfway) and opens the profile page.
export function FlipLogo({ size = 50 }: { size?: number }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const rot = useSharedValue(0);
  const [busy, setBusy] = useState(false);
  const spin = (to: number, ms = 700) => { rot.value = withTiming(to, { duration: ms, easing: Easing.inOut(Easing.cubic) }); };
  const onTap = () => {
    if (busy) return;
    setBusy(true);
    spin(360, 900);
    setTimeout(() => { rot.value = 0; setBusy(false); router.push("/(tabs)/profile"); }, 920);
  };
  const front = useAnimatedStyle(() => {
    const r = rot.value % 360;
    return { transform: [{ perspective: 600 }, { rotateY: `${rot.value}deg` }], opacity: r > 90 && r < 270 ? 0 : 1 };
  });
  const back = useAnimatedStyle(() => {
    const r = rot.value % 360;
    return { transform: [{ perspective: 600 }, { rotateY: `${rot.value + 180}deg` }], opacity: r > 90 && r < 270 ? 1 : 0 };
  });
  const circle = { width: size, height: size, borderRadius: size / 2, position: "absolute" as const, overflow: "hidden" as const, backgroundColor: colors.surface, shadowColor: colors.laser, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } };
  return (
    <Pressable testID="flip-logo" onPress={onTap} hitSlop={6} style={{ width: size, height: size }} accessibilityLabel="Apri profilo">
      <Animated.View style={[circle, front]}>
        <Image source={COIN} style={{ width: size, height: size }} contentFit="cover" />
      </Animated.View>
      <Animated.View style={[circle, back, { borderWidth: 1, borderColor: colors.brandPrimary }]} testID="flip-logo-back">
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
