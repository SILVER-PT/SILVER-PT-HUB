import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Chip, ChipRow } from "@/src/ui";
import { makeStyles, useTheme } from "@/src/theme";

const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const WD = ["L", "M", "M", "G", "V", "S", "D"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Tap-to-pick month calendar. value: YYYY-MM-DD
export function DatePicker({ value, onChange, testID = "date-picker", yearNav }: { value: string; onChange: (v: string) => void; testID?: string; yearNav?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const init = value ? new Date(value + "T12:00:00") : new Date();
  const [y, setY] = useState(init.getFullYear());
  const [m, setM] = useState(init.getMonth());
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const t = new Date();
  const todayStr = ymd(t.getFullYear(), t.getMonth(), t.getDate());
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shift = (d: number) => {
    const nm = m + d;
    setY(y + Math.floor(nm / 12));
    setM(((nm % 12) + 12) % 12);
  };
  return (
    <View style={s.wrap} testID={testID}>
      {yearNav ? (
        <ChipRow>
          {Array.from({ length: 86 }, (_, i) => t.getFullYear() - 5 - i).map((yy) => (
            <Chip key={yy} testID={`${testID}-year-${yy}`} label={String(yy)} active={yy === y} onPress={() => setY(yy)} />
          ))}
        </ChipRow>
      ) : null}
      <View style={s.head}>
        <Pressable testID={`${testID}-prev`} onPress={() => shift(-1)} style={s.nav}><Ionicons name="chevron-back" size={20} color={colors.onSurface} /></Pressable>
        <Text style={s.month}>{MONTHS[m]} {y}</Text>
        <Pressable testID={`${testID}-next`} onPress={() => shift(1)} style={s.nav}><Ionicons name="chevron-forward" size={20} color={colors.onSurface} /></Pressable>
      </View>
      <View style={s.row}>{WD.map((w, i) => <Text key={i} style={s.wd}>{w}</Text>)}</View>
      <View style={s.grid}>
        {cells.map((d, i) => {
          const key = d ? ymd(y, m, d) : `e${i}`;
          const sel = d && key === value;
          return (
            <Pressable key={key} testID={d ? `${testID}-day-${d}` : undefined} disabled={!d} onPress={() => d && onChange(key)} style={s.cell}>
              {d ? (
                <View style={[s.day, key === todayStr && s.today, sel && s.sel]}>
                  <Text style={[s.dayText, sel && { color: colors.onBrandPrimary }]}>{d}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const TIMES = Array.from({ length: 33 }, (_, i) => `${pad(6 + Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);

export function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ChipRow>
      {TIMES.map((t) => <Chip key={t} testID={`time-chip-${t.replace(":", "")}`} label={t} active={t === value} onPress={() => onChange(t)} />)}
    </ChipRow>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { backgroundColor: c.surfaceTertiary, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nav: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  month: { color: c.onSurface, fontWeight: "900", fontSize: 15, textTransform: "uppercase", letterSpacing: 1 },
  row: { flexDirection: "row" },
  wd: { width: "14.28%", textAlign: "center", color: c.muted, fontSize: 12, fontWeight: "800", paddingVertical: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.28%", height: 42, alignItems: "center", justifyContent: "center" },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  today: { borderWidth: 1, borderColor: c.silver },
  sel: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  dayText: { color: c.onSurface, fontWeight: "700" },
}));
