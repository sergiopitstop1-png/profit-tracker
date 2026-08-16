// Salva questo file come: lib/sendFarewellEmail.ts

export async function sendFarewellEmail(email: string) {
  const html = `
  <div style="background:#0d0f14;padding:32px 20px;font-family:system-ui,sans-serif;">
    <div style="max-width:520px;margin:0 auto;">
      <h1 style="color:#e8ecf5;font-size:24px;margin-bottom:4px;">PRONO<span style="color:#c8f135;">X</span></h1>
      <p style="color:#6b7490;font-size:13px;margin-top:0;">Account cancellato</p>

      <div style="background:#161920;border:1px solid #2a2f3f;border-radius:14px;padding:24px;margin-top:16px;">
        <p style="color:#e8ecf5;font-size:15px;line-height:1.7;margin-top:0;">
          Ciao,<br/><br/>
          Ti confermiamo che il tuo account PronoX (<strong>${email}</strong>) è stato cancellato
          correttamente. Non riceverai più nessuna comunicazione da parte nostra, e i tuoi dati
          legati a questo account sono stati rimossi.
        </p>
        <p style="color:#6b7490;font-size:14px;line-height:1.7;">
          Se hai cambiato idea, o vuoi semplicemente tornare in futuro, questa email resta libera:
          potrai registrarti di nuovo quando vuoi, da zero.
        </p>
        <p style="color:#6b7490;font-size:14px;line-height:1.7;margin-bottom:0;">
          Grazie per aver provato PronoX.
        </p>
      </div>

      <div style="text-align:center;margin-top:24px;">
        <a href="https://sergioapicella.it/register" style="display:inline-block;padding:12px 28px;background:transparent;border:1px solid #2a2f3f;color:#e8ecf5;font-weight:700;border-radius:10px;text-decoration:none;font-size:14px;">
          Registrati di nuovo, quando vuoi →
        </a>
      </div>
    </div>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PronoX · Sergio Apicella <noreply@sergioapicella.it>",
        to: email,
        subject: "Il tuo account PronoX è stato cancellato",
        html,
      }),
    });
    if (!res.ok) {
      console.error(`[sendFarewellEmail] Invio fallito a ${email}:`, await res.text());
    }
  } catch (e) {
    console.error(`[sendFarewellEmail] Errore invio a ${email}:`, e);
  }
}
