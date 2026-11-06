import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { Image } from "expo-image";
import { useAuth } from "@/src/auth";
import { fileUrl } from "@/src/api";
import { useTheme } from "@/src/theme";

// Brand coin: tap (or hover on web) spins 360° like a coin, showing the user's photo on the back halfway.
export function FlipLogo({ size = 40 }: { size?: number }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const rot = useSharedValue(0);
  const [busy, setBusy] = useState(false);
  const spin = (to: number) => { rot.value = withTiming(to, { duration: 700, easing: Easing.inOut(Easing.cubic) }); };
  const onTap = () => {
    if (busy) return;
    setBusy(true);
    spin(180);
    setTimeout(() => { spin(360); setTimeout(() => { rot.value = 0; setBusy(false); }, 720); }, 1400);
  };
  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${rot.value}deg` }],
  }));
  const back = useAnimatedStyle(() => {
    const r = rot.value % 360;
    return { transform: [{ perspective: 600 }, { rotateY: `${rot.value + 180}deg` }], opacity: r > 90 && r < 270 ? 1 : 0 };
  });
  const frontVis = useAnimatedStyle(() => {
    const r = rot.value % 360;
    return { opacity: r > 90 && r < 270 ? 0 : 1 };
  });
  const circle = { width: size, height: size, borderRadius: size / 2, position: "absolute" as const, overflow: "hidden" as const, borderWidth: 1, borderColor: colors.brandPrimary, backgroundColor: colors.surface };
  return (
    <Pressable testID="flip-logo" onPress={onTap} onHoverIn={() => !busy && spin(180)} onHoverOut={() => { if (!busy) { spin(360); setTimeout(() => { rot.value = 0; }, 720); } }} hitSlop={6} style={{ width: size, height: size }}>
      <Animated.View style={[circle, front, frontVis]}>
        <Image source={require("../assets/images/logo-round.png")} style={{ width: size, height: size }} contentFit="cover" />
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
