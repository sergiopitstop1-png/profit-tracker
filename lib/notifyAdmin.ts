// Salva questo file come: lib/notifyAdmin.ts
// Helper condiviso, richiamabile da qualunque route (iscrizione,
// disiscrizione, cancellazione account) per avvisare Sergio via email.
//
// Richiede la variabile d'ambiente ADMIN_NOTIFY_EMAIL (il tuo indirizzo)
// oltre alla RESEND_API_KEY che usi già per la digest.

export async function notifyAdmin(event: "iscrizione" | "disiscrizione" | "cancellazione", email: string) {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
  if (!adminEmail) return; // se non configurato, non blocchiamo il flusso principale

  const labels = {
    iscrizione: { emoji: "🟢", title: "Nuova iscrizione a PronoX" },
    disiscrizione: { emoji: "🟡", title: "Disiscrizione dalla mail PronoX" },
    cancellazione: { emoji: "🔴", title: "Account PronoX cancellato" },
  };
  const { emoji, title } = labels[event];

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PronoX · Notifiche <noreply@sergioapicella.it>",
        to: adminEmail,
        subject: `${emoji} ${title}`,
        html: `<p style="font-family:system-ui,sans-serif;">${title}: <strong>${email}</strong></p>
               <p style="font-family:system-ui,sans-serif;color:#888;font-size:12px;">${new Date().toLocaleString("it-IT")}</p>`,
      }),
    });
  } catch (e) {
    // Un fallimento nella notifica non deve mai bloccare l'azione
    // principale dell'utente (iscriversi/disiscriversi/cancellarsi) —
    // qui ci limitiamo a ignorare l'errore.
    console.error("[notifyAdmin] invio fallito:", e);
  }
}
