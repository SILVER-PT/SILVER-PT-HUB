import { useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, useFetch } from "@/src/api";
import { Chip, ChipRow, Empty, ErrorText, Header, Loading } from "@/src/ui";
import { makeStyles, useTheme } from "@/src/theme";

export default function Copilot() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const hist = useFetch<any[]>("/ai/chat");
  const clients = useFetch<any[]>("/clients");
  const [clientId, setClientId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const list = useRef<FlatList>(null);
  const msgs = hist.data || [];

  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setText("");
    setErr("");
    setBusy(true);
    hist.setData([...msgs, { id: `tmp-${Date.now()}`, role: "user", text: v }]);
    try {
      await api("/ai/chat", { method: "POST", body: { message: v, client_id: clientId } });
      await hist.reload();
    } catch (e: any) {
      setErr(e.message);
      setText(v);
    } finally {
      setBusy(false);
    }
  };

  const [confirmClear, setConfirmClear] = useState(false);
  const clear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setConfirmClear(false);
    await api("/ai/chat", { method: "DELETE" });
    hist.reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Copilot AI" back right={<Pressable testID="copilot-clear-button" onPress={clear} style={{ padding: 8 }}><Ionicons name={confirmClear ? "alert-circle" : "trash-outline"} size={20} color={confirmClear ? colors.brandPrimary : colors.muted} /></Pressable>} />
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <ChipRow>
          <Chip testID="copilot-client-none" label="Generale" active={!clientId} onPress={() => setClientId(null)} />
          {(clients.data || []).map((c) => <Chip key={c.id} testID={`copilot-client-${c.id}`} label={c.name} active={clientId === c.id} onPress={() => setClientId(c.id)} />)}
        </ChipRow>
      </View>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {!hist.data ? <Loading /> : (
          <FlatList
            ref={list}
            testID="copilot-list"
            data={msgs}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={<Empty icon="sparkles-outline" text="Chiedimi idee di programmazione, un'analisi dei dati di un cliente (selezionalo sopra) o una risposta rapida da inviare." />}
            renderItem={({ item: m }) => (
              <View style={[s.bubble, m.role === "user" ? s.mine : s.theirs]} testID={`copilot-msg-${m.id}`}>
                <Text selectable style={[s.text, m.role === "user" && { color: colors.onBrandPrimary }]}>{String(m.text).replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/gm, "")}</Text>
              </View>
            )}
            ListFooterComponent={busy ? <Text style={[s.text, { color: colors.muted, padding: 8 }]}>Copilot sta scrivendo…</Text> : undefined}
          />
        )}
        {err ? <View style={{ paddingHorizontal: 16 }}><ErrorText text={err} /></View> : null}
        <View style={[s.bar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput testID="copilot-input" value={text} onChangeText={setText} placeholder={clientId ? "Chiedi sul cliente selezionato..." : "Scrivi al copilot..."} placeholderTextColor={colors.muted} style={s.input} multiline />
          <Pressable testID="copilot-send-button" onPress={send} style={[s.send, busy && { opacity: 0.5 }]} disabled={busy}>
            <Ionicons name="sparkles" size={18} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  bubble: { maxWidth: "88%", borderRadius: 16, padding: 12 },
  mine: { alignSelf: "flex-end", backgroundColor: c.brandPrimary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: c.surfaceTertiary, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
  text: { color: c.onSurface, fontSize: 15, lineHeight: 21 },
  bar: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.brandPrimary, backgroundColor: c.surface, alignItems: "flex-end" },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: c.surfaceTertiary, color: c.onSurface, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
