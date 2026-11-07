import { Linking, View } from "react-native";
import { Chip, T } from "@/src/ui";
import { fmtDate } from "@/src/api";

export const waOpen = (phone: string | undefined, text: string) => {
  const p = String(phone || "").replace(/[^0-9]/g, "");
  Linking.openURL(`https://wa.me/${p}?text=${encodeURIComponent(text)}`);
};

export function waTemplates(name: string, staffName: string, appt?: any) {
  const first = (name || "").split(" ")[0];
  const when = appt ? fmtDate(appt.start, true) : "";
  return [
    ["Promemoria appuntamento", `Ciao ${first}, ti ricordo il nostro appuntamento${appt ? ` «${appt.title}» di ${when}` : ""}.${appt?.video_link ? ` Link videochiamata: ${appt.video_link}` : ""} A presto! ${staffName}`],
    ["Promemoria check", `Ciao ${first}, è il momento del check: carica le foto (frontale, laterale sinistra, posteriore) e le misure nell'app SILVER-PT. Grazie! ${staffName}`],
    ["Nuova scheda / piano", `Ciao ${first}, ti ho caricato il nuovo programma nell'app SILVER-PT. Dagli un'occhiata e scrivimi per qualsiasi dubbio. ${staffName}`],
    ["Diario alimentare", `Ciao ${first}, ricordati di registrare i pasti nel diario dell'app: mi serve per seguirti al meglio. ${staffName}`],
    ["Rinnovo abbonamento", `Ciao ${first}, il tuo abbonamento è in scadenza. Fammi sapere se vuoi rinnovarlo così continuiamo il percorso! ${staffName}`],
    ["Analisi del sangue", `Ciao ${first}, quando hai i nuovi esami del sangue caricali nella sezione Analisi dell'app, così li confrontiamo con i precedenti. ${staffName}`],
  ];
}

export function WaTemplates({ phone, name, staffName, appt }: { phone?: string; name: string; staffName: string; appt?: any }) {
  return (
    <View style={{ gap: 8 }} testID="wa-templates">
      {!phone ? <T muted style={{ fontSize: 12 }}>Aggiungi il telefono nel profilo del cliente per inviare direttamente.</T> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {waTemplates(name, staffName, appt).map(([label, text]) => (
          <Chip key={label} testID={`wa-${label}`} label={`💬 ${label}`} onPress={() => waOpen(phone, text)} />
        ))}
      </View>
    </View>
  );
}
