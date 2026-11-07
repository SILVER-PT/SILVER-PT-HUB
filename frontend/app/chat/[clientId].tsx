import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth";
import { api, useFetch } from "@/src/api";
import { Empty, ErrorText, Header, Loading } from "@/src/ui";
import { makeStyles, useTheme } from "@/src/theme";

export default function Chat() {
  const { clientId, thread } = useLocalSearchParams<{ clientId: string; thread?: string }>();
  const q = thread === "nutri" ? "?thread=nutri" : "";
  const { user } = useAuth();
  const client = useFetch<any>(user?.role !== "client" ? `/clients/${clientId}` : null);
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<any[] | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const list = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      setMsgs(await api(`/chat/${clientId}${q}`));
      setErr("");
    } catch (e: any) {
      setErr(e.message);
      setMsgs((p) => p || []);
    }
  }, [clientId, q]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const v = text.trim();
    if (!v) return;
    setText("");
    try {
      const m = await api(`/chat/${clientId}${q}`, { method: "POST", body: { text: v } });
      setMsgs((p) => [...(p || []), m]);
      setErr("");
    } catch (e: any) {
      setText(v);
      setErr(e.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={client.data ? `Chat · ${client.data.name}` : thread === "nutri" ? "Chat nutrizionista" : "Chat coaching"} back />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {!msgs ? <Loading /> : (
          <FlatList
            ref={list}
            testID="chat-list"
            data={msgs}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={err ? <View style={{ padding: 16 }}><ErrorText text={err} /></View> : <Empty icon="chatbubbles-outline" text="Scrivi il primo messaggio." />}
            renderItem={({ item: m }) => {
              const mine = m.author_id === user?.id;
              return (
                <View style={[s.bubble, mine ? s.mine : s.theirs]} testID={`chat-msg-${m.id}`}>
                  <Text style={[s.text, mine && { color: colors.onBrandPrimary }]}>{m.text}</Text>
                  <Text style={[s.time, mine && { color: colors.onBrandPrimary }]}>{new Date(m.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
              );
            }}
          />
        )}
        {err && msgs?.length ? <View style={{ paddingHorizontal: 16 }}><ErrorText text={err} /></View> : null}
        {!(err && !msgs?.length) ? (
          <View style={[s.bar, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput testID="chat-input" value={text} onChangeText={setText} placeholder="Scrivi un messaggio..." placeholderTextColor={colors.muted} style={s.input} multiline />
            <Pressable testID="chat-send-button" onPress={send} style={s.send}>
              <Ionicons name="send" size={18} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 12, gap: 4 },
  mine: { alignSelf: "flex-end", backgroundColor: c.brandPrimary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: c.surfaceTertiary, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
  text: { color: c.onSurface, fontSize: 15 },
  time: { color: c.muted, fontSize: 11, alignSelf: "flex-end" },
  bar: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.brandPrimary, backgroundColor: c.surface, alignItems: "flex-end" },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: c.surfaceTertiary, color: c.onSurface, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
