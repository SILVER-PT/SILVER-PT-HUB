import { View } from "react-native";
import Svg, { Ellipse, Rect, Circle, G, Text as SvgText } from "react-native-svg";
import { Card, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

// Body silhouette that adapts to the client's measures: zone width ~ circumference, colour ~ skinfold / risk.
// Fat distribution (android vs gynoid) from waist/hip ratio, approximate somatotype from BF% and FFMI.
export function BodyFigure({ m, sex }: { m: any; sex?: string }) {
  const { colors } = useTheme();
  if (!m) return null;
  const female = sex === "F";
  const c = m.circumferences || {};
  const f = m.skinfolds || {};
  const d = m.derived || {};
  const whr = d.whr;
  const androidLim = female ? 0.85 : 0.95;
  const distribution = whr ? (whr >= androidLim ? "Androide (a mela)" : whr <= androidLim - 0.12 ? "Ginoide (a pera)" : "Intermedia") : "—";
  const bf = d.fm_pct ?? m.body_fat;
  const ffmi = d.ffm_index;
  const highBf = bf != null && bf > (female ? 30 : 20);
  const lowBf = bf != null && bf < (female ? 20 : 12);
  const somato = bf == null ? "—" : highBf ? (ffmi && ffmi > (female ? 17 : 20) ? "Endo-mesomorfo" : "Endomorfo") : ffmi && ffmi > (female ? 16.5 : 19.5) ? (lowBf ? "Mesomorfo" : "Meso-endomorfo") : "Ectomorfo";
  const fold = (k: string) => Number(f[k]) || 0;
  const risk = (v: number, lim: number) => (v >= lim * 1.5 ? colors.brandPrimary : v >= lim ? colors.warning : colors.silver);
  const w = (cm: number | undefined, base: number, ref: number) => Math.max(base * 0.6, Math.min(base * 1.6, base * ((Number(cm) || ref) / ref)));
  const waist = w(c.vita, 30, female ? 72 : 84);
  const hips = w(c.fianchi, 36, female ? 98 : 96);
  const chest = w(c.torace || c.petto, 40, female ? 88 : 100);
  const arm = w(c.braccio_dx || c.braccio_sx, 9, female ? 28 : 34);
  const thigh = w(c.coscia_dx || c.coscia_sx, 15, female ? 56 : 56);
  const abdRisk = whr && whr >= androidLim ? colors.brandPrimary : risk(fold("addominale") || fold("soprailiaca"), female ? 20 : 18);
  const hipRisk = whr && whr <= androidLim - 0.12 ? colors.warning : risk(fold("soprailiaca"), 16);
  const armRisk = risk(fold("tricipite"), female ? 22 : 12);
  const thighRisk = risk(fold("coscia"), female ? 28 : 16);
  return (
    <Card accent testID="body-figure">
      <T style={{ fontWeight: "900" }}>Mappa corporea</T>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Svg width={140} height={260} viewBox="0 0 140 260">
          <G opacity={0.95}>
            <Circle cx={70} cy={22} r={16} fill={colors.surfaceTertiary} stroke={colors.silver} />
            <Rect x={64} y={36} width={12} height={10} fill={colors.surfaceTertiary} />
            <Ellipse cx={70} cy={72} rx={chest} ry={28} fill={colors.surfaceTertiary} stroke={colors.silver} />
            <Ellipse cx={70 - chest - arm + 4} cy={88} rx={arm} ry={36} fill={armRisk} opacity={0.85} />
            <Ellipse cx={70 + chest + arm - 4} cy={88} rx={arm} ry={36} fill={armRisk} opacity={0.85} />
            <Ellipse cx={70} cy={112} rx={waist} ry={20} fill={abdRisk} opacity={0.9} />
            <Ellipse cx={70} cy={140} rx={hips} ry={18} fill={hipRisk} opacity={0.9} />
            <Ellipse cx={70 - thigh + 2} cy={190} rx={thigh} ry={40} fill={thighRisk} opacity={0.85} />
            <Ellipse cx={70 + thigh - 2} cy={190} rx={thigh} ry={40} fill={thighRisk} opacity={0.85} />
            <Rect x={70 - thigh - 4} y={228} width={12} height={28} rx={6} fill={colors.surfaceTertiary} stroke={colors.silver} />
            <Rect x={70 + thigh - 8} y={228} width={12} height={28} rx={6} fill={colors.surfaceTertiary} stroke={colors.silver} />
            <SvgText x={70} y={116} fontSize={9} fill={colors.onSurface} textAnchor="middle">{c.vita ? `${c.vita}` : ""}</SvgText>
            <SvgText x={70} y={144} fontSize={9} fill={colors.onSurface} textAnchor="middle">{c.fianchi ? `${c.fianchi}` : ""}</SvgText>
          </G>
        </Svg>
        <View style={{ flex: 1, gap: 6 }}>
          <T style={{ fontSize: 13 }}><T muted style={{ fontSize: 13 }}>Distribuzione: </T>{distribution}</T>
          <T style={{ fontSize: 13 }}><T muted style={{ fontSize: 13 }}>Somatotipo stimato: </T>{somato}</T>
          {whr ? <T style={{ fontSize: 13 }}><T muted style={{ fontSize: 13 }}>Vita/fianchi: </T>{whr}</T> : null}
          {bf != null ? <T style={{ fontSize: 13 }}><T muted style={{ fontSize: 13 }}>Massa grassa: </T>{bf}%</T> : null}
          <View style={{ gap: 2, marginTop: 4 }}>
            <T style={{ fontSize: 11, color: colors.brandPrimary }}>● zona critica</T>
            <T style={{ fontSize: 11, color: colors.warning }}>● da monitorare</T>
            <T style={{ fontSize: 11, color: colors.silver }}>● nella norma</T>
          </View>
          <T muted style={{ fontSize: 10 }}>Stima indicativa da circonferenze e pliche, non diagnostica.</T>
        </View>
      </View>
    </Card>
  );
}
