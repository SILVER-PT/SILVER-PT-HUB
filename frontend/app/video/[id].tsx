import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { api, fileUrl, fmtDate, useFetch } from "@/src/api";
import { Card, Comments, Loading, Screen, T } from "@/src/ui";
import { useTheme } from "@/src/theme";

function Player({ path }: { path: string }) {
  const { colors } = useTheme();
  const player = useVideoPlayer(fileUrl(path), (p) => { p.loop = false; });
  return (
    <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.brandPrimary, backgroundColor: colors.surfaceSecondary }}>
      <VideoView testID="video-player" player={player} style={{ width: "100%", aspectRatio: 9 / 12 }} contentFit="contain" nativeControls allowsPictureInPicture={false} />
    </View>
  );
}

export default function VideoDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: v, reload } = useFetch<any>(`/videos/${id}`);
  return (
    <Screen title="Video" back>
      {!v ? <Loading /> : (
        <>
          <Player path={v.path} />
          <Card>
            <T style={{ fontWeight: "900", fontSize: 18 }}>{v.exercise}</T>
            <T muted>{v.client_name} · {fmtDate(v.created_at, true)}</T>
            {v.note ? <T>{v.note}</T> : null}
          </Card>
          <Comments items={v.comments} onSend={async (text) => { await api(`/videos/${id}/comments`, { method: "POST", body: { text } }); reload(); }} />
        </>
      )}
    </Screen>
  );
}
