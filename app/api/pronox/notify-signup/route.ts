// Salva questo file come: app/api/pronox/notify-signup/route.ts
// (sostituisce quello che hai già — aggiunge solo la mail di benvenuto)

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { notifyAdmin } from "@/lib/notifyAdmin"; // alias assoluto: se il tuo progetto non ha "@/*" configurato in tsconfig.json, usa il percorso relativo corretto

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function welcomeEmailHtml(name: string) {
  const greeting = name ? `Ciao ${name},` : "";
  const section = (emoji: string, title: string, body: string) => `
    <div style="margin-bottom:22px;">
      <div style="font-size:13px;font-weight:800;color:#c8f135;letter-spacing:0.03em;margin-bottom:8px;">
        ${emoji} ${title}
      </div>
      <p style="color:#e8ecf5;font-size:14px;line-height:1.7;margin:0;">${body}</p>
    </div>`;

  return `
  <div style="background:#0d0f14;padding:32px 20px;font-family:system-ui,sans-serif;">
    <div style="max-width:520px;margin:0 auto;">
      <h1 style="color:#e8ecf5;font-size:24px;margin-bottom:4px;">PRONO<span style="color:#c8f135;">X</span></h1>
      ${greeting ? `<p style="color:#6b7490;font-size:14px;margin-top:0;">${greeting}</p>` : ""}

      <div style="background:#161920;border:1px solid #2a2f3f;border-radius:14px;padding:24px;margin-top:16px;">
        <p style="color:#e8ecf5;font-size:16px;line-height:1.7;margin-top:0;margin-bottom:20px;">
          Benvenuto in PronoX.<br/><br/>
          Se sei qui, probabilmente stai cercando qualcosa di diverso dal solito elenco di pronostici,
          quote e percentuali. PronoX nasce con un'idea molto semplice: trasformare l'analisi sportiva
          in un metodo.<br/><br/>
          Non cerchiamo la giocata spettacolare.<br/>
          Non inseguiamo quote impossibili.<br/>
          E soprattutto, non promettiamo vincite facili.<br/><br/>
          Ogni pronostico viene elaborato attraverso l'analisi di numerosi parametri: statistiche,
          andamento recente delle squadre o degli atleti, rendimento casa/trasferta o sulle diverse
          superfici, precedenti, forma, caratteristiche dell'evento e altri indicatori utili a
          individuare le situazioni statisticamente più interessanti.
        </p>

        ${section("⚽🎾", "CALCIO E TENNIS", "PronoX analizza quotidianamente eventi di calcio e tennis, selezionando esclusivamente quelli che superano i criteri previsti dal sistema. Questo significa una cosa importante: non dobbiamo necessariamente avere un pronostico su ogni partita. A volte, la scelta migliore è semplicemente non giocare.")}

        ${section("📊", "COME LEGGERE I PRONOSTICI", "Per ogni evento troverai informazioni chiare che ti permetteranno di valutare rapidamente la previsione proposta. L'obiettivo non è sommergerti di numeri, ma offrirti una lettura immediata dell'evento e della forza statistica del pronostico. PronoX è quindi uno strumento di supporto alle decisioni: il sistema individua le opportunità, ma la decisione finale rimane sempre tua.")}

        ${section("🧠", "IL METODO PRIMA DEL SINGOLO RISULTATO", "Questo è probabilmente il concetto più importante di PronoX. Un pronostico può perdere. Anche un pronostico con indicatori molto favorevoli può perdere. Nello sport esiste sempre una componente imprevedibile ed è proprio per questo che un servizio serio non si giudica dalla singola giocata, ma dai risultati ottenuti su un campione sufficientemente ampio. La differenza la fanno il metodo, la selezione e soprattutto la gestione del capitale.")}

        ${section("💰", "GESTIONE DEL BANKROLL", "Evita di aumentare drasticamente la puntata dopo una perdita e non cercare di recuperare immediatamente. Stabilisci un capitale dedicato e utilizza stake proporzionati al tuo bankroll, mantenendo una strategia costante nel tempo.<br/><br/>Niente rincorse. Niente all-in. Niente \"questa non può perdere\".<br/><br/>Disciplina batte istinto.")}

        ${section("🔍", "TRASPARENZA", "PronoX vuole essere prima di tutto misurabile. Per questo motivo risultati, andamento e performance devono essere valutati nel tempo, comprese inevitabilmente le giornate negative. Perché mostrare soltanto le vittorie è facile. Mostrare l'intero percorso è ciò che permette davvero di valutare un metodo.")}

        ${section("🚀", "LA FILOSOFIA PRONOX", "PronoX non nasce per indovinare il futuro. Nasce per cercare, dentro migliaia di dati ed eventi, quelle situazioni in cui numeri, statistiche e condizioni convergono nella stessa direzione.<br/><br/>Non cerchiamo certezze. Cerchiamo un vantaggio statistico. E quando quel vantaggio non c'è, semplicemente non giochiamo.")}

        <p style="color:#e8ecf5;font-size:15px;line-height:1.7;text-align:center;margin-top:24px;margin-bottom:0;font-weight:700;">
          Benvenuto in PronoX.<br/>
          <span style="color:#c8f135;">Analisi. Metodo. Disciplina.</span><br/>
          Il resto lo decide il campo. ⚽🎾
        </p>
      </div>

      <div style="text-align:center;margin-top:24px;">
        <a href="https://sergioapicella.it/oggi" style="display:inline-block;padding:12px 28px;background:#c8f135;color:#0d0f14;font-weight:800;border-radius:10px;text-decoration:none;font-size:14px;">
          Vai ai pronostici di oggi →
        </a>
      </div>

      <p style="text-align:center;color:#4a4f5c;font-size:11px;margin-top:24px;line-height:1.6;">
        Gioca responsabilmente. I pronostici rappresentano analisi statistiche e non costituiscono
        garanzia di vincita. Il gioco comporta il rischio di perdita del capitale impiegato ed è
        riservato ai maggiorenni.

        ® 2026 Sergio Apicella — Tutti i diritti riservati
      </p>
    </div>
  </div>`;
}

async function sendWelcomeEmail(email: string, name: string) {
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
        subject: "🎉 Benvenuto su PronoX",
        html: welcomeEmailHtml(name),
      }),
    });
    if (!res.ok) {
      console.error(`[notify-signup] Invio mail di benvenuto fallito a ${email}:`, await res.text());
    }
  } catch (e) {
    console.error(`[notify-signup] Errore invio mail di benvenuto a ${email}:`, e);
  }
}

export async function POST(request: Request) {
  const { email, name } = await request.json();
  if (!email) {
    return NextResponse.json({ error: "Email mancante" }, { status: 400 });
  }

  // Controllo minimo anti-abuso: procediamo solo se esiste davvero un
  // profilo con questa email (creato dal trigger al momento della
  // registrazione), così questa route non può essere usata per spammare
  // notifiche o mail di benvenuto finte con email a caso.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ ok: true, notified: false });
  }

  // Le due mail sono indipendenti — un fallimento nell'una non deve
  // bloccare l'altra.
  await Promise.all([
    notifyAdmin("iscrizione", email),
    sendWelcomeEmail(email, name || ""),
  ]);

  return NextResponse.json({ ok: true, notified: true });
}
