// 14/10/2026 · pagina "Oggi da fare": si apre in una nuova scheda dal tastino 📋 Oggi della Dashboard.
// Sta sotto /profit-tracker, quindi il middleware la lascia vedere solo a vip e admin come le altre pagine del Profit Tracker.
import DaFareClient from './DaFareClient'

export const metadata = { title: 'Oggi da fare · Profit Tracker' }

export default function DaFarePage() {
  return <DaFareClient />
}
