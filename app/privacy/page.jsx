// app/privacy/page.jsx — informativa privacy richiesta da Google per l'app OAuth "Lucy ProfitTracker"
export const metadata = { title: "Privacy – Sergio Apicella" };

export default function PrivacyPage() {
  const box = { maxWidth: 760, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6, color: "#1e293b" };
  return (
    <main style={box}>
      <h1>Informativa sulla privacy</h1>
      <p>Ultimo aggiornamento: 30 settembre 2026</p>

      <h2>Chi gestisce il servizio</h2>
      <p>Il sito sergioapicella.it e l'applicazione interna "Lucy ProfitTracker" sono gestiti da Sergio Apicella per uso esclusivamente personale e professionale.</p>

      <h2>Quali dati usiamo</h2>
      <p>Con l'autorizzazione del titolare dell'account, l'applicazione legge in sola lettura (permesso gmail.readonly) le email di una casella Gmail di servizio. I messaggi vengono archiviati in un database privato per essere classificati e consultati dal titolare.</p>

      <h2>Come li usiamo</h2>
      <p>I dati servono solo a individuare comunicazioni operative e promozioni rilevanti. Non vengono venduti, ceduti a terzi né usati per pubblicità. Il testo delle email può essere elaborato da un servizio di intelligenza artificiale esclusivamente per la classificazione.</p>

      <h2>Conservazione e revoca</h2>
      <p>L'accesso può essere revocato in qualsiasi momento da myaccount.google.com/permissions. Su richiesta, i dati archiviati vengono cancellati.</p>

      <h2>Contatti</h2>
      <p>Per qualsiasi richiesta: lucyserver52@gmail.com</p>
    </main>
  );
}
