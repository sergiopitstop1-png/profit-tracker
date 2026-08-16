// Salva questo file come: lib/sendFarewellEmail.ts

export async function sendFarewellEmail(email: string) {
  const html = `
  <div style="background:#0d0f14;padding:32px 20px;font-family:system-ui,sans-serif;">
    <div style="max-width:520px;margin:0 auto;">
      <h1 style="color:#e8ecf5;font-size:24px;margin-bottom:4px;">PRONO<span style="color:#c8f135;">X</span></h1>

      <div style="background:#161920;border:1px solid #2a2f3f;border-radius:14px;padding:24px;margin-top:16px;">
        <p style="color:#e8ecf5;font-size:15px;line-height:1.8;margin-top:0;">
          Ciao,<br/><br/>
          abbiamo ricevuto la tua richiesta e la tua iscrizione a PronoX è stata annullata.<br/><br/>
          Ci dispiace un po' vederti andare, inutile fingere il contrario. 🙂<br/><br/>
          Speriamo comunque che il tempo trascorso con noi ti sia stato utile e che PronoX ti
          abbia offerto qualche spunto interessante per affrontare i pronostici con un approccio
          più ragionato e consapevole.<br/><br/>
          Le porte di PronoX resteranno comunque sempre aperte. Se in futuro vorrai tornare a dare
          un'occhiata alle nostre analisi, sai dove trovarci.<br/><br/>
          Nel frattempo, grazie per aver fatto parte di PronoX, anche solo per un tratto di strada.<br/><br/>
          Ti auguriamo il meglio e, naturalmente… buona fortuna per le tue prossime giocate! 🍀
        </p>
      </div>

      <p style="text-align:center;color:#e8ecf5;font-size:14px;line-height:1.8;margin-top:24px;font-weight:700;">
        Il team PronoX<br/>
        <span style="color:#c8f135;font-weight:400;font-size:13px;">Analisi. Metodo. Disciplina.</span><br/>
        <span style="color:#6b7490;font-weight:400;font-size:13px;">Il resto lo decide il campo.</span><br/><br/>
        <span style="font-weight:400;font-size:13px;color:#6b7490;">Sergio Apicella</span>
      </p>

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
        subject: "La tua iscrizione a PronoX è stata annullata",
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
