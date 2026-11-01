import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { api, fileUrl, fmtDate } from "@/src/api";

const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
const dl = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;

// Inline SVG line chart for the PDF.
function svgChart(points: { label: string; value: number }[], color = "#E10600") {
  if (points.length < 1) return "<p class='muted'>Nessun dato</p>";
  const W = 520, H = 140, P = 28;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i: number) => P + (points.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (points.length - 1));
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="#ccc"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="3"/>
    ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="3.5" fill="#111"/><text x="${x(i)}" y="${y(p.value) - 8}" font-size="10" text-anchor="middle">${p.value}</text><text x="${x(i)}" y="${H - 10}" font-size="9" text-anchor="middle" fill="#777">${esc(p.label)}</text>`).join("")}
  </svg>`;
}

export async function buildReportHtml(clientId: string) {
  const [c, meas, prog, photos] = await Promise.all([
    api(`/clients/${clientId}`),
    api<any[]>(`/measurements?client_id=${clientId}`).catch(() => []),
    api<Record<string, any[]>>(`/progress?client_id=${clientId}`).catch(() => ({} as Record<string, any[]>)),
    api<any[]>(`/photos?client_id=${clientId}`).catch(() => []),
  ]);
  const ms = [...meas].reverse();
  const first = ms[0], last = ms[ms.length - 1];
  const p = c.profile || {};
  const row = (l: string, a: any, b: any, u = "") => {
    const d = a != null && b != null && a !== "" && b !== "" ? Math.round((Number(b) - Number(a)) * 10) / 10 : "";
    return `<tr><td>${l}</td><td>${a ?? "—"} ${u}</td><td>${b ?? "—"} ${u}</td><td class="${Number(d) < 0 ? "neg" : "pos"}">${d === "" ? "" : (Number(d) > 0 ? "+" : "") + d}</td></tr>`;
  };
  const circKeys = Array.from(new Set(ms.flatMap((m) => Object.keys(m.circumferences || {}))));
  const checks = photos.filter((x) => x.kind !== "posing");
  const dates = Array.from(new Set(checks.map((x) => x.date))).sort();
  const photoRow = (d?: string) => !d ? "" : `<div class="ph"><b>${fmtDate(d)}</b><div class="phr">${["front", "side_left", "back"].map((k) => {
    const ph = checks.find((x) => x.date === d && x.kind === k);
    return ph ? `<img src="${fileUrl(ph.path)}"/>` : "<div class='noimg'>—</div>";
  }).join("")}</div></div>`;

  return `<html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,Helvetica,Arial;color:#111;padding:24px}
    .hd{background:#000;color:#fff;padding:18px;border-bottom:4px solid #E10600}
    .hd h1{margin:0;font-style:italic;letter-spacing:2px} .hd span{color:#E10600;font-weight:800}
    h2{border-left:5px solid #E10600;padding-left:8px;font-style:italic;text-transform:uppercase;font-size:16px;margin-top:26px}
    table{border-collapse:collapse;width:100%;font-size:12px} td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}
    .pos{color:#0a7a2f}.neg{color:#c00}.muted{color:#777;font-size:12px}
    .ph{margin:8px 0}.phr{display:flex;gap:8px}.ph img,.noimg{width:32%;height:220px;object-fit:cover;border-radius:6px;background:#eee}
    .ex{page-break-inside:avoid;margin-bottom:10px}
  </style></head><body>
  <div class="hd"><h1>SILVER-<span>PT</span></h1><div>Report progressi · ${esc(c.name)} · ${new Date().toLocaleDateString("it-IT")}</div></div>
  <p>${p.sex === "F" ? "Donna" : "Uomo"}${p.height ? ` · ${p.height} cm` : ""}${p.goal ? ` · Obiettivo: ${esc(p.goal)}` : ""}${c.subscription?.name ? ` · ${esc(c.subscription.name)}` : ""}</p>
  ${ms.length ? `<h2>Composizione corporea</h2>
    <table><tr><th></th><th>${fmtDate(first.date)}</th><th>${fmtDate(last.date)}</th><th>Δ</th></tr>
    ${row("Peso", first.weight, last.weight, "kg")}${row("% Grasso", first.body_fat, last.body_fat, "%")}${row("Massa magra", first.lean_mass, last.lean_mass, "kg")}${row("Σ Pliche", first.sum_folds, last.sum_folds, "mm")}
    ${circKeys.map((k) => row(k.replace("_", " "), first.circumferences?.[k], last.circumferences?.[k], "cm")).join("")}</table>
    <p class="muted">Peso</p>${svgChart(ms.filter((m) => m.weight).map((m) => ({ label: dl(m.date), value: m.weight })), "#555")}
    ${ms.some((m) => m.body_fat) ? `<p class="muted">% Massa grassa</p>${svgChart(ms.filter((m) => m.body_fat).map((m) => ({ label: dl(m.date), value: m.body_fat })))}` : ""}` : ""}
  ${Object.keys(prog).length ? `<h2>Progressione carichi</h2>${Object.entries(prog).map(([name, s]) => `<div class="ex"><b>${esc(name)}</b> — carico max ${s[0].max_load} → ${s[s.length - 1].max_load} kg · ripetizioni ${s[0].total_reps} → ${s[s.length - 1].total_reps} · RIR medio ${s[s.length - 1].avg_rir} · esecuzione ${s[s.length - 1].avg_execution}/10
    ${svgChart(s.map((x) => ({ label: dl(x.date), value: x.max_load })))}</div>`).join("")}` : ""}
  ${dates.length ? `<h2>Foto check</h2>${photoRow(dates[0])}${dates.length > 1 ? photoRow(dates[dates.length - 1]) : ""}` : ""}
  <p class="muted" style="margin-top:30px">PFT ISSA Europe · generato con SILVER-PT</p>
  </body></html>`;
}

export async function shareReport(clientId: string) {
  const html = await buildReportHtml(clientId);
  if (Platform.OS === "web") {
    // expo-print on web ignores html: print through a hidden iframe instead.
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentWindow!.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      setTimeout(() => frame.remove(), 1000);
    }, 800);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Report progressi" });
}
