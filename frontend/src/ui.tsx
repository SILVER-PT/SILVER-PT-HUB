import React, { useState } from "react";
import {
  ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, TextInputProps, View, ViewStyle, StyleProp,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { fileUrl, fmtDate } from "@/src/api";
import { FlipLogo } from "@/src/flip-logo";
import { Image } from "expo-image";

export function Laser({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ height: 2, shadowColor: colors.laser, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }, style]}>
      <LinearGradient
        colors={["transparent", colors.laser, colors.onBrand, colors.laser, "transparent"]}
        locations={[0, 0.3, 0.5, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

export function Header({ title, back, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.surface }}>
      <View style={s.headerRow}>
        {back ? (
          <Pressable testID="header-back-button" onPress={() => router.back()} style={s.iconBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>
        ) : null}
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        {right}
        <FlipLogo />
      </View>
      <Laser />
    </View>
  );
}

export function Screen({
  title, back, right, children, tab, scroll = true, onRefreshing,
}: {
  title: string; back?: boolean; right?: React.ReactNode; children: React.ReactNode; tab?: boolean; scroll?: boolean; onRefreshing?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = tab ? (usesNativeTabs ? insets.bottom : 0) + 24 : insets.bottom + 24;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={title} back={back} right={right} />
      {scroll ? (
        <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: 16, paddingBottom: bottom, gap: 16 }} keyboardShouldPersistTaps="handled">
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View style={{ flex: 1, paddingBottom: tab ? (usesNativeTabs ? insets.bottom : 0) : insets.bottom }}>{children}</View>
      )}
    </View>
  );
}

export function Btn({
  title, onPress, variant = "primary", icon, loading, testID, small, disabled, style,
}: {
  title: string; onPress?: () => void; variant?: "primary" | "ghost" | "dark"; icon?: any; loading?: boolean; testID?: string; small?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const fg = variant === "primary" ? colors.onBrandPrimary : variant === "ghost" ? colors.brandPrimary : colors.onBrandSecondary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        variant === "primary" && s.btnPrimary,
        variant === "ghost" && s.btnGhost,
        variant === "dark" && s.btnDark,
        (pressed || disabled) && { opacity: 0.7, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[s.btnText, small && { fontSize: 13 }, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6 }, style as any]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[s.input, focus && { borderColor: colors.borderStrong }, props.multiline && { minHeight: 80, textAlignVertical: "top", paddingTop: 12 }]}
        {...props}
      />
    </View>
  );
}

export function Card({ children, style, onPress, testID, accent }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string; accent?: boolean }) {
  const s = useStyles();
  const inner = <View style={[s.card, accent && s.cardAccent, style]}>{children}</View>;
  if (!onPress) return <View testID={testID}>{inner}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }}>
      {inner}
    </Pressable>
  );
}

export function H({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.hRow}>
      <View style={s.hBar} />
      <Text style={s.h}>{children}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

export function T({ children, muted, style, testID, numberOfLines }: { children: React.ReactNode; muted?: boolean; style?: any; testID?: string; numberOfLines?: number }) {
  const { colors } = useTheme();
  return <Text testID={testID} numberOfLines={numberOfLines} style={[{ color: muted ? colors.muted : colors.onSurface, fontSize: 15 }, style]}>{children}</Text>;
}

export function Empty({ icon = "albums-outline", text }: { icon?: any; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: 32, gap: 8 }}>
      <Ionicons name={icon} size={36} color={colors.brandPrimary} />
      <T muted style={{ textAlign: "center" }}>{text}</T>
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return <ActivityIndicator testID="loading-indicator" color={colors.brandPrimary} style={{ marginTop: 32 }} />;
}

export function ErrorText({ text }: { text?: string }) {
  const { colors } = useTheme();
  if (!text) return null;
  return <Text testID="error-message" style={{ color: colors.error, fontSize: 14 }}>{text}</Text>;
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const s = useStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: 44 }} contentContainerStyle={{ gap: 8, alignItems: "center" }}>
      {children}
    </ScrollView>
  );
}

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} testID="sheet-backdrop" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Laser />
          <View style={s.sheetHead}>
            <Text style={s.headerTitle}>{title}</Text>
            <Pressable testID="sheet-close-button" onPress={onClose} hitSlop={8} style={s.iconBtn}>
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Comments({ items, onSend }: { items: any[]; onSend: (t: string) => Promise<void> }) {
  const s = useStyles();
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSend(text.trim());
      setText("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 12 }} testID="comments-section">
      <H>Commenti</H>
      {items.length === 0 ? <T muted>Nessun commento ancora.</T> : null}
      {items.map((c) => (
        <View key={c.id} style={[s.comment, c.author_role !== "client" && { borderLeftColor: colors.brandPrimary }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Avatar path={c.author_avatar} name={c.author_name} size={24} />
            <Text style={s.commentAuthor}>{c.author_name}{c.author_role === "trainer" ? " · COACH" : c.author_role === "nutritionist" ? " · NUTRIZIONISTA" : ""}</Text>
          </View>
          <T>{c.text}</T>
          <T muted style={{ fontSize: 12 }}>{fmtDate(c.created_at, true)}</T>
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <Field testID="comment-input" placeholder="Scrivi un commento..." value={text} onChangeText={setText} style={{ flex: 1 }} multiline />
        <Pressable testID="comment-send-button" onPress={send} style={s.sendBtn} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Ionicons name="send" size={18} color={colors.onBrandPrimary} />}
        </Pressable>
      </View>
    </View>
  );
}

export function Stat({ label, value, unit, testID }: { label: string; value: any; unit?: string; testID?: string }) {
  const s = useStyles();
  return (
    <View style={s.stat} testID={testID}>
      <Text style={s.statValue}>{value ?? "—"}<Text style={s.statUnit}>{unit ? ` ${unit}` : ""}</Text></Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

export function Avatar({ path, name, size = 44, testID }: { path?: string | null; name?: string; size?: number; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {path ? (
        <Image source={{ uri: fileUrl(path) }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ color: colors.onBrandTertiary, fontWeight: "900", fontSize: size * 0.4 }}>{(name || "?").slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

export function Bar({ label, value, target, unit = "g", testID }: { label: string; value: number; target?: number; unit?: string; testID?: string }) {
  const { colors } = useTheme();
  const pct = target ? Math.min(value / target, 1) : 0;
  const over = !!target && value > target * 1.05;
  return (
    <View style={{ gap: 4 }} testID={testID}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.onSurfaceSecondary, fontWeight: "700", fontSize: 13 }}>{label}</Text>
        <Text style={{ color: over ? colors.warning : colors.muted, fontSize: 13, fontWeight: "700" }}>{Math.round(value)}{target ? ` / ${Math.round(target)}` : ""} {unit}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceTertiary, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: 8, borderRadius: 4, backgroundColor: over ? colors.warning : colors.brandPrimary }} />
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange, testID, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={() => onChange(!value)} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 15 }}>{label}</Text>
        {hint ? <Text style={{ color: colors.muted, fontSize: 12 }}>{hint}</Text> : null}
      </View>
      <View style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: value ? colors.brandPrimary : colors.surfaceTertiary, borderWidth: 1, borderColor: value ? colors.brandPrimary : colors.border }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.onBrandPrimary, transform: [{ translateX: value ? 20 : 0 }] }} />
      </View>
    </Pressable>
  );
}

export const useStyles = makeStyles((c) => ({
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 56, gap: 8 },
  headerTitle: { flex: 1, color: c.onSurface, fontSize: 20, fontWeight: "900", fontStyle: "italic", letterSpacing: 1, textTransform: "uppercase" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  btn: { height: 50, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18 },
  btnSmall: { height: 40, paddingHorizontal: 12, borderRadius: 10 },
  btnPrimary: { backgroundColor: c.brandPrimary, shadowColor: c.laser, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  btnGhost: { borderWidth: 1, borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  btnDark: { backgroundColor: c.brandSecondary, borderWidth: 1, borderColor: c.border },
  btnText: { fontSize: 15, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  label: { color: c.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  input: { backgroundColor: c.surfaceTertiary, color: c.onSurface, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, gap: 8 },
  cardAccent: { borderColor: c.brandPrimary, shadowColor: c.laser, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  hRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hBar: { width: 4, height: 18, borderRadius: 2, backgroundColor: c.brandPrimary },
  h: { color: c.silver, fontSize: 15, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase", fontStyle: "italic" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, justifyContent: "center", flexShrink: 0 },
  chipActive: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  chipText: { color: c.onSurfaceTertiary, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: c.onBrandTertiary },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%", overflow: "hidden" },
  sheetHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
  comment: { backgroundColor: c.surfaceTertiary, borderRadius: 12, padding: 12, gap: 4, borderLeftWidth: 3, borderLeftColor: c.silver },
  commentAuthor: { color: c.silver, fontWeight: "800", fontSize: 13 },
  sendBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  stat: { flex: 1, backgroundColor: c.surfaceTertiary, borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: c.border },
  statValue: { color: c.onSurface, fontSize: 20, fontWeight: "900" },
  statUnit: { color: c.muted, fontSize: 12, fontWeight: "600" },
}));
