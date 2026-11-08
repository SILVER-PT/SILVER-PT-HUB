import { useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Sheet, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

// Pop-up picker replacing horizontally scrolling chip rows for multiple-choice fields.
export function Select({ label, value, options, onChange, testID, placeholder = "Scegli…", allowClear = true }:
  { label: string; value?: string; options: string[]; onChange: (v: string) => void; testID?: string; placeholder?: string; allowClear?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <T muted style={{ fontSize: 11, fontWeight: "700" }}>{label.toUpperCase()}</T>
      <Pressable testID={testID} onPress={() => setOpen(true)} style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: value ? colors.silver : colors.border, backgroundColor: colors.surfaceTertiary, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <T style={{ flex: 1, fontWeight: value ? "800" : "400", color: value ? colors.onSurface : colors.muted }} numberOfLines={1}>{value || placeholder}</T>
        <Ionicons name="chevron-down" size={18} color={colors.silver} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {allowClear && value ? (
          <Pressable testID={testID ? `${testID}-clear` : undefined} onPress={() => { onChange(""); setOpen(false); }} style={{ paddingVertical: 12 }}>
            <T muted>— Nessuno</T>
          </Pressable>
        ) : null}
        {options.map((o) => (
          <Pressable key={o} testID={testID ? `${testID}-opt-${o}` : undefined} onPress={() => { onChange(o); setOpen(false); }}
            style={{ paddingVertical: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <T style={{ flex: 1, fontWeight: o === value ? "900" : "500", color: o === value ? colors.brandPrimary : colors.onSurface }}>{o}</T>
            {o === value ? <Ionicons name="checkmark" size={20} color={colors.brandPrimary} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
