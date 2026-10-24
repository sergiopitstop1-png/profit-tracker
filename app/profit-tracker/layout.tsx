import PulsanteRegistraEsterno from "../components/PulsanteRegistraEsterno";

// 24/10/2026: il pulsante "Registra al volo" compare su tutte le pagine del Profit Tracker.
export default function ProfitTrackerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PulsanteRegistraEsterno />
    </>
  );
}
