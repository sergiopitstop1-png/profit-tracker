// =====================================================================
// Betfair · Test collegamento API
// 06/10/2026: prova Fase 1 - login con certificato + conteggio eventi calcio.
// Non restituisce mai session token, password, App Key o certificati.
// =====================================================================

import { NextResponse } from "next/server";
import https from "https";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_URL = "https://identitysso-cert.betfair.com/api/certlogin";
const BETTING_HOST = "api.betfair.com";
const BETTING_PATH = "/exchange/betting/json-rpc/v1";

function env(nome) {
  const valore = process.env[nome];
  if (!valore) throw new Error(`Variabile mancante: ${nome}`);
  return valore;
}

function postHttps({ hostname, path, headers, body, cert, key }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        port: 443,
        path,
        method: "POST",
        headers: {
          ...headers,
          "Content-Length": Buffer.byteLength(body),
        },
        cert,
        key,
        timeout: 15000,
      },
      (res) => {
        let dati = "";
        res.setEncoding("utf8");
        res.on("data", (pezzo) => { dati += pezzo; });
        res.on("end", () => resolve({ status: res.statusCode || 0, dati }));
      }
    );

    req.on("timeout", () => req.destroy(new Error("Timeout Betfair (15s)")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function loginBetfair() {
  const appKey = env("BETFAIR_APP_KEY");
  const username = env("BETFAIR_USERNAME");
  const password = env("BETFAIR_PASSWORD");
  const cert = Buffer.from(env("BETFAIR_CERT_B64"), "base64");
  const key = Buffer.from(env("BETFAIR_KEY_B64"), "base64");

  const body = new URLSearchParams({ username, password }).toString();
  const risposta = await postHttps({
    hostname: "identitysso-cert.betfair.com",
    path: "/api/certlogin",
    headers: {
      "X-Application": appKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cert,
    key,
  });

  let json;
  try { json = JSON.parse(risposta.dati); }
  catch { throw new Error(`Login Betfair: risposta non JSON (HTTP ${risposta.status})`); }

  if (risposta.status < 200 || risposta.status >= 300 || json.loginStatus !== "SUCCESS" || !json.sessionToken) {
    throw new Error(`Login Betfair fallito: ${json.loginStatus || `HTTP ${risposta.status}`}`);
  }

  return json.sessionToken;
}

async function contaEventiCalcio(sessionToken) {
  const ora = new Date();
  const fine = new Date(ora.getTime() + 24 * 60 * 60 * 1000);

  const rpc = JSON.stringify({
    jsonrpc: "2.0",
    method: "SportsAPING/v1.0/listEvents",
    params: {
      filter: {
        eventTypeIds: ["1"],
        marketStartTime: { from: ora.toISOString(), to: fine.toISOString() },
      },
    },
    id: 1,
  });

  const risposta = await postHttps({
    hostname: BETTING_HOST,
    path: BETTING_PATH,
    headers: {
      "X-Application": env("BETFAIR_APP_KEY"),
      "X-Authentication": sessionToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: rpc,
  });

  let json;
  try { json = JSON.parse(risposta.dati); }
  catch { throw new Error(`Betting API: risposta non JSON (HTTP ${risposta.status})`); }

  if (risposta.status < 200 || risposta.status >= 300 || json.error) {
    const codice = json?.error?.data?.APINGException?.errorCode || json?.error?.message || `HTTP ${risposta.status}`;
    throw new Error(`Betting API fallita: ${codice}`);
  }

  return Array.isArray(json.result) ? json.result.length : 0;
}

export async function GET(req) {
  try {
    const cronSecret = env("CRON_SECRET");
    const auth = req.headers.get("authorization");
    const querySecret = new URL(req.url).searchParams.get("secret");

    if (auth !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ ok: false, error: "non autorizzato" }, { status: 401 });
    }

    const sessionToken = await loginBetfair();
    const eventi = await contaEventiCalcio(sessionToken);

    return NextResponse.json({ ok: true, eventi_calcio_oggi: eventi });
  } catch (errore) {
    console.error("06/10/2026 Betfair test:", errore instanceof Error ? errore.message : "errore sconosciuto");
    return NextResponse.json(
      { ok: false, error: errore instanceof Error ? errore.message : "errore Betfair" },
      { status: 500 }
    );
  }
}
