export default function Obiettivi() {
  return (
    <main
      style={{
        background: "black",
        color: "white",
        padding: "60px 20px",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "40px" }}>Obiettivi</h1>

      <p style={{ marginTop: "20px", maxWidth: "800px" }}>
        Non sogni. Direzione.
      </p>

      <ul style={{ marginTop: "20px", maxWidth: "800px", lineHeight: "2" }}>
        <li>Raggiungere e mantenere 10.000€ al mese</li>
        <li>Creare sistemi sempre più efficienti</li>
        <li>Ridurre il tempo operativo grazie all’automazione</li>
        <li>Tornare in forma e recuperare energia</li>
        <li>Scrivere e pubblicare i miei libri</li>
      </ul>
    </main>
  );
}