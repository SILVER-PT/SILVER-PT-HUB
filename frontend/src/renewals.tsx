import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { api, useFetch } from "@/src/api";
import { Btn, Card, ErrorText, H, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

// Next renewal date from subscription start: monthly -> same day each month, annual -> anniversary.
export function nextRenewal(since: string, billing: string) {
  const s = new Date(since + "T12:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(s);
  while (d < now) {
    if (billing === "annuale") d.setFullYear(d.getFullYear() + 1);
    else {
      const day = s.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    }
  }
  return { date: d, days: Math.round((d.getTime() - now.getTime()) / 86400000) };
}

function addCycle(d: Date, s: Date, billing: string) {
  const n = new Date(d);
  if (billing === "annuale") n.setFullYear(n.getFullYear() + 1);
  else {
    n.setDate(1);
    n.setMonth(n.getMonth() + 1);
    n.setDate(Math.min(s.getDate(), new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()));
  }
  return n;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Start date (YYYY-MM-DD) of the billing cycle currently running, or null if the subscription hasn't started.
export function currentCycle(since: string, billing: string) {
  const s = new Date(since + "T12:00:00");
  const end = new Date();
  end.setHours(23, 59, 59, 0);
  if (s > end) return null;
  let d = new Date(s);
  while (addCycle(d, s, billing) <= end) d = addCycle(d, s, billing);
  return ymd(d);
}

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

function Income({ summary }: { summary: any[] }) {
  const { colors } = useTheme();
  const cur = summary[summary.length - 1];
  const prev = summary[summary.length - 2];
  const max = Math.max(...summary.map((m) => m.total), 1);
  return (
    <Card accent testID="income-card">
      <T muted style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>INCASSI DEL MESE</T>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <T testID="income-month-total" style={{ fontSize: 32, fontWeight: "900", color: colors.brandPrimary }}>{cur.total.toLocaleString("it-IT")}€</T>
        <T muted style={{ fontSize: 13, marginBottom: 6 }}>{cur.count} {cur.count === 1 ? "pagamento" : "pagamenti"}{prev ? ` · mese scorso ${prev.total.toLocaleString("it-IT")}€` : ""}</T>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 90, marginTop: 4 }}>
        {summary.map((m, i) => (
          <View key={m.month} style={{ flex: 1, alignItems: "center", gap: 4 }} testID={`income-bar-${m.month}`}>
            <T muted style={{ fontSize: 9 }}>{m.total ? Math.round(m.total) : ""}</T>
            <View style={{ width: "70%", height: Math.max(4, (m.total / max) * 56), borderRadius: 4, backgroundColor: i === summary.length - 1 ? colors.brandPrimary : colors.surfaceTertiary, borderWidth: 1, borderColor: i === summary.length - 1 ? colors.brandPrimary : colors.border }} />
            <T muted style={{ fontSize: 10 }}>{MONTHS[Number(m.month.slice(5)) - 1]}</T>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function Renewals({ clients }: { clients: any[] }) {
  const router = useRouter();
  const { colors } = useTheme();
  const payments = useFetch<any[]>("/payments");
  const summary = useFetch<any[]>("/payments/summary");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const rows = clients
    .filter((c) => c.subscription?.since)
    .map((c) => {
      const cycle = currentCycle(c.subscription.since, c.subscription.billing);
      const pay = (payments.data || []).find((p) => p.client_id === c.id && p.period === cycle);
      return { c, cycle, pay, ...nextRenewal(c.subscription.since, c.subscription.billing) };
    })
    .sort((a, b) => Number(!!a.pay) - Number(!!b.pay) || a.days - b.days);
  const reload = () => { payments.reload(); summary.reload(); };

  const markPaid = async (c: any, cycle: string) => {
    setBusy(c.id);
    setErr("");
    try {
      await api("/payments", { method: "POST", body: { client_id: c.id, amount: Number(c.subscription.price) || 0, period: cycle } });
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };
  const undo = async (pid: string) => {
    if (confirm !== pid) {
      setConfirm(pid);
      setTimeout(() => setConfirm((c) => (c === pid ? "" : c)), 3000);
      return;
    }
    if (busy) return;
    setConfirm("");
    setBusy(pid);
    await api(`/payments/${pid}`, { method: "DELETE" }).catch((e) => setErr(e.message));
    setBusy("");
    reload();
  };

  const unpaid = rows.filter((r) => r.cycle && !r.pay).length;
  return (
    <View style={{ gap: 8 }}>
      {summary.data?.length ? <Income summary={summary.data} /> : null}
      {rows.length ? <H>{`Rinnovi${unpaid ? ` · ${unpaid} da incassare` : ""}`}</H> : null}
      <ErrorText text={err} />
      {rows.length ? (
        <Card testID="renewals-card">
          {rows.map(({ c, date, days, cycle, pay }) => (
            <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52 }}>
              <Pressable testID={`renewal-row-${c.id}`} onPress={() => router.push(`/client/${c.id}`)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cycle && !pay ? colors.brandPrimary : days <= 7 ? colors.warning : colors.success }} />
                <View style={{ flex: 1 }}>
                  <T testID={`renewal-${c.id}`} style={{ fontWeight: "800", fontSize: 14 }} numberOfLines={1}>{c.name}</T>
                  <T muted style={{ fontSize: 12 }} numberOfLines={1}>{c.subscription.price}€ {c.subscription.billing} · prossimo {days === 0 ? "oggi" : `tra ${days} gg (${date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })})`}</T>
                </View>
              </Pressable>
              {!cycle ? <T muted style={{ fontSize: 12 }}>Non iniziato</T> : pay ? (
                <Pressable testID={`renewal-paid-${c.id}`} onPress={() => undo(pay.id)} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 22, justifyContent: "center", borderWidth: 1, borderColor: colors.success }}>
                  <T style={{ color: colors.success, fontSize: 12, fontWeight: "800" }}>{confirm === pay.id ? "Annulla?" : "✓ Pagato"}</T>
                </Pressable>
              ) : (
                <Btn testID={`renewal-mark-paid-${c.id}`} small icon="cash" title="Segna pagato" loading={busy === c.id} onPress={() => markPaid(c, cycle)} />
              )}
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}
