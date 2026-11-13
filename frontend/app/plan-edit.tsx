// Selettore Anatomico Interattivo in stile Workout.lol / Tavole Ufficiali
function InteractiveAnatomySelector({ selectedDistricts, onToggleDistrict }: { selectedDistricts: string[]; onToggleDistrict: (d: string) => void }) {
  const { colors } = useTheme();
  const [gender, setGender] = useState<"male" | "female">("male");
  const [viewMode, setViewMode] = useState<"fronte" | "retro">("fronte");

  const frontDistricts = [
    { id: "Petto", label: "Pettorali" },
    { id: "Spalle", label: "Spalle" },
    { id: "Bicipiti", label: "Bicipiti" },
    { id: "Addome", label: "Addominali" },
    { id: "Quadricipiti", label: "Quadricipiti" },
    { id: "Avambracci", label: "Avambracci" },
  ];

  const backDistricts = [
    { id: "Dorso", label: "Gran Dorsale" },
    { id: "Trapezio", label: "Trapezio" },
    { id: "Tricipiti", label: "Tricipiti" },
    { id: "Glutei", label: "Glutei" },
    { id: "Femorali", label: "Femorali" },
    { id: "Polpacci", label: "Polpacci" },
  ];

  const currentList = viewMode === "fronte" ? frontDistricts : backDistricts;

  // Immagini ufficiali caricate nel repository
  const anatomyImageSource = gender === "male" 
    ? require("../assets/images/male-districts.png") 
    : require("../assets/images/female-districts.png");

  return (
    <Card accent style={{ padding: 16, alignItems: "center" }}>
      <H style={{ marginBottom: 4, letterSpacing: 1 }}>MAPPA ANATOMICA INTERATTIVA</H>
      <T muted style={{ fontSize: 12, textAlign: "center", marginBottom: 14 }}>
        Tocca i distretti muscolari per attivarli. I gruppi selezionati si illuminano in rosso (<T style={{ color: "#e60000", fontWeight: "bold" }}>#e60000</T>).
      </T>

      {/* Switch Genere e Vista (Fronte / Retro) */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 6, flex: 1 }}>
          <Pressable 
            onPress={() => setGender("male")}
            style={{ flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: gender === "male" ? "#e60000" : "#333", backgroundColor: gender === "male" ? "#e60000" : "#111", alignItems: "center" }}
          >
            <T style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>UOMO</T>
          </Pressable>
          <Pressable 
            onPress={() => setGender("female")}
            style={{ flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: gender === "female" ? "#e60000" : "#333", backgroundColor: gender === "female" ? "#e60000" : "#111", alignItems: "center" }}
          >
            <T style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>DONNA</T>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 6, flex: 1 }}>
          <Pressable 
            onPress={() => setViewMode("fronte")}
            style={{ flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: viewMode === "fronte" ? "#e60000" : "#333", backgroundColor: viewMode === "fronte" ? "#e60000" : "#111", alignItems: "center" }}
          >
            <T style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>FRONTE</T>
          </Pressable>
          <Pressable 
            onPress={() => setViewMode("retro")}
            style={{ flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: viewMode === "retro" ? "#e60000" : "#333", backgroundColor: viewMode === "retro" ? "#e60000" : "#111", alignItems: "center" }}
          >
            <T style={{ color: "#fff", fontWeight: "bold", fontSize: 11 }}>RETRO</T>
          </Pressable>
        </View>
      </View>

      {/* Contenitore Immagine Anatomica in evidenza stile Workout.lol */}
      <View style={{
        width: "100%",
        maxWidth: 280,
        height: 280,
