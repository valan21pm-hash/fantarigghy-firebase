/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import fs from "fs/promises";
import path from "path";
import { GoogleAuth } from "google-auth-library";
import { DatabaseSchema, Giocatore, Partita, RefertoGiocatore, Fantasquadra, Consiglio, getPlayerPriceForRoster, MAX_BUDGET } from "./src/types";
import { dbServer, doc, getDoc, setDoc } from "./src/lib/firestore-server";
import { fetchFromFirestore, saveToFirestore } from "./src/lib/syncFirestore";

// Setup DB path
const DB_PATH = path.join(process.cwd(), "src", "db.json");

// Helper to ensure database directory exists and write/read safely
async function safeReadDb(): Promise<string> {
  const dir = path.dirname(DB_PATH);
  await fs.mkdir(dir, { recursive: true });
  return await fs.readFile(DB_PATH, "utf-8");
}

async function safeWriteDb(content: string): Promise<void> {
  const dir = path.dirname(DB_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DB_PATH, content, "utf-8");
}


// Cache of resolved spreadsheet IDs to prevent searching Google Drive on every call
const spreadsheetIdCache = new Map<string, string>();

// Retrieve an authenticated client
async function getAuthClient() {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.readonly"]
  });
  return await auth.getClient();
}

// Update functions to use getAuthClient inside to get an access token
async function getOrUpdateSpreadsheetId(token?: string): Promise<string> {
  let activeToken = token;
  if (!activeToken) {
    activeToken = await getStoredGoogleToken();
  }
  if (!activeToken) {
    const client = await getAuthClient();
    const tokenResponse = await client.getAccessToken();
    activeToken = tokenResponse.token!;
  }
  
  const cached = spreadsheetIdCache.get(activeToken);
  if (cached) return cached;

  const targetSpreadsheetId = "1Bt6RZkR0Qmn6_8TBl4xBqLtc7qxk_NMR2uehVQe1V2o";

  try {
    // 2. Controllo diretto accesso al foglio
    console.log(`[Google Sheets] Controllo diretto accesso al foglio ${targetSpreadsheetId}...`);
    const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}`;
    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${activeToken}` }
    });

    if (checkRes.ok) {
      console.log(`[Google Sheets] Foglio esistente '${targetSpreadsheetId}' accessibile con successo!`);
      spreadsheetIdCache.set(activeToken, targetSpreadsheetId);
      return targetSpreadsheetId;
    } 
    
    // ... (rest of implementation adapted to not rely on 'userEmail' from OAuth userInfo)
    throw new Error(`Google Sheets access failed: ${checkRes.status}`);

  } catch (err: any) {
    console.error("Error in getOrUpdateSpreadsheetId:", err);
    throw err;
  }
}

import { Formazione } from "./src/types";

function parseGiocatori(values: any[][]): Giocatore[] {
  if (!values || values.length <= 1) return [];
  const rows = values.slice(1);
  return rows.map((row) => {
    const nome = String(row[0] || "").trim();
    const saldo = parseFloat(row[1] as string) || 0;
    const gol = parseInt(row[2] as string) || 0;
    const ammonizioni = parseInt(row[3] as string) || 0;
    const ultimoRuolo = String(row[4] || "").trim();
    const assist = parseInt(row[5] as string) || 0;
    const espulsioni = parseInt(row[6] as string) || 0;
    const golSubitiAzione = parseInt(row[7] as string) || 0;
    const golSubitiRigore = parseInt(row[8] as string) || 0;
    const golSubitiPiazzato = parseInt(row[9] as string) || 0;
    const quotaIscrizione = parseFloat(row[10] as string) || 0;
    
    const attivoVal = row[11];
    const attivo = (attivoVal === true || attivoVal === "true" || attivoVal === "TRUE" || attivoVal === "Vero" || attivoVal === "VERO");

    const numeroMaglia = parseInt(row[12] as string) || 99;

    return {
      nome,
      saldo,
      gol,
      ammonizioni,
      ultimoRuolo,
      assist,
      espulsioni,
      golSubitiAzione,
      golSubitiRigore,
      golSubitiPiazzato,
      quotaIscrizione,
      attivo,
      numeroMaglia
    };
  }).filter(g => g.nome !== "");
}

function parseCampi(values: any[][]): string[] {
  if (!values || values.length <= 1) return [];
  return values.slice(1)
    .map(row => String(row[0] || "").trim())
    .filter(name => name !== "");
}

function parsePartite(values: any[][]): Partita[] {
  if (!values || values.length <= 1) return [];
  const rows = values.slice(1);
  return rows.map((row) => {
    const id = String(row[0] || "").trim();
    const dataInserimento = String(row[1] || "").trim();
    const dettagli = String(row[2] || "").trim();
    const costo = parseFloat(row[3] as string) || 0;
    
    let convocati: string[] = [];
    try {
      if (row[4]) {
        convocati = JSON.parse(row[4] as string);
      }
    } catch (e) {
      convocati = [];
    }
    
    const stato = (row[5] === "Chiusa" ? "Chiusa" : "Aperta") as "Aperta" | "Chiusa";
    const risultato = String(row[6] || "").trim();
    
    let referto: RefertoGiocatore[] = [];
    try {
      if (row[7]) {
        referto = JSON.parse(row[7] as string);
      }
    } catch (e) {
      referto = [];
    }

    let formazione: Formazione = { titolari: [], panchina: [] };
    try {
      if (row[8]) {
        formazione = JSON.parse(row[8] as string);
      }
    } catch (e) {
      formazione = { titolari: [], panchina: [] };
    }

    const inviatoFanta = row[9] === "TRUE";
    
    let rosterSnapshot: Record<string, string[]> = {};
    try {
      if (row[10]) {
        rosterSnapshot = JSON.parse(row[10] as string);
      }
    } catch (e) {
      rosterSnapshot = {};
    }

    return {
      id,
      dataInserimento,
      dettagli,
      costo,
      convocati,
      stato,
      risultato,
      referto,
      formazione,
      inviatoFanta,
      rosterSnapshot
    };
  }).filter(p => p.id !== "");
}

function parseLogs(values: any[][]): any[] {
  if (!values || values.length <= 1) return [];
  const rows = values.slice(1);
  return rows.map((row) => {
    return {
      data: String(row[0] || "").trim(),
      operazione: String(row[1] || "").trim(),
      importo: String(row[2] || "").trim(),
      dettagli: String(row[3] || "").trim()
    };
  }).filter(l => l.data !== "");
}

// NOTE: Function removed. Please use the new getOrUpdateSpreadsheetId() which uses Application Default Credentials.

async function ensureFantasquadreSheetExists(token: string, spreadsheetId: string): Promise<void> {
  try {
    // Try to check if the range exists
    const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Fantasquadre!A1:J1`;
    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (checkRes.ok) return; // Tab already exists!

    console.log("[Google Sheets] Tab 'Fantasquadre' not found, creating it dynamically...");
    // Tab does not exist, let's add it
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const addRes = await fetch(updateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: "Fantasquadre"
              }
            }
          }
        ]
      })
    });

    if (addRes.ok) {
      // Write headers including PIN, Email, Credito Residuo, Valori Acquisto, and Ultimo Cambio Match ID
      const initUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Fantasquadre!A1:J1?valueInputOption=USER_ENTERED`;
      await fetch(initUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          values: [["ID", "Nome Partecipante", "Nome Fantasquadra", "Giocatori Selezionati", "Data Inserimento", "PIN", "Email", "Credito Residuo", "Valori Acquisto", "Ultimo Cambio Match ID"]]
        })
      });
      console.log("[Google Sheets] Tab 'Fantasquadre' created and initialized with extended columns (H, I, J).");
    }
  } catch (err) {
    console.error("Failed to ensure Fantasquadre sheet exists:", err);
  }
}

async function fetchFantasquadreFromSheets(token: string, spreadsheetId: string): Promise<Fantasquadra[]> {
  try {
    await ensureFantasquadreSheetExists(token, spreadsheetId);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Fantasquadre!A:J`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Sheets Fantasquadre fetch failed: ${res.status} - ${text}`);
    }
    const data = await res.json() as any;
    const values = data.values || [];
    if (values.length <= 1) return [];
    return values.slice(1).map((row: any[]) => {
      let selected: string[] = [];
      try {
        if (row[3]) selected = JSON.parse(row[3]);
      } catch {
        selected = [];
      }

      let valoriAcquisto: Record<string, number> = {};
      try {
        if (row[8]) valoriAcquisto = JSON.parse(row[8]);
      } catch {
        valoriAcquisto = {};
      }

      return {
        id: String(row[0] || ""),
        nomePartecipante: String(row[1] || ""),
        nomeFantasquadra: String(row[2] || ""),
        giocatoriSelezionati: selected,
        dataInserimento: String(row[4] || ""),
        pin: String(row[5] || ""),
        email: String(row[6] || "").toLowerCase().trim(),
        creditoResiduo: row[7] !== undefined ? Number(row[7]) : undefined,
        valoriAcquisto: valoriAcquisto,
        ultimoCambioMatchId: String(row[9] || "")
      };
    });
  } catch (err: any) {
    console.error("Errore fetchFantasquadreFromSheets:", err.message);
    throw err;
  }
}

async function ensureConsigliSheetExists(token: string, spreadsheetId: string): Promise<void> {
  try {
    const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Consigli!A1:E1`;
    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (checkRes.ok) return; // Tab already exists!

    console.log("[Google Sheets] Tab 'Consigli' not found, creating it dynamically...");
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const addRes = await fetch(updateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: "Consigli"
              }
            }
          }
        ]
      })
    });

    if (addRes.ok) {
      const initUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Consigli!A1:E1?valueInputOption=USER_ENTERED`;
      await fetch(initUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          values: [["ID", "Autore", "Testo", "Data", "Letto"]]
        })
      });
      console.log("[Google Sheets] Tab 'Consigli' created and initialized.");
    }
  } catch (err) {
    console.error("Failed to ensure Consigli sheet exists:", err);
  }
}

async function fetchConsigliFromSheets(token: string, spreadsheetId: string): Promise<Consiglio[]> {
  try {
    await ensureConsigliSheetExists(token, spreadsheetId);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Consigli!A:E`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Sheets Consigli fetch failed: ${res.status} - ${text}`);
    }
    const data = await res.json() as any;
    const values = data.values || [];
    if (values.length <= 1) return [];
    return values.slice(1).map((row: any[]) => {
      return {
        id: String(row[0] || ""),
        autore: String(row[1] || ""),
        testo: String(row[2] || ""),
        data: String(row[3] || ""),
        letto: String(row[4] || "").toUpperCase() === "TRUE"
      };
    });
  } catch (err: any) {
    console.error("Errore fetchConsigliFromSheets:", err.message);
    throw err;
  }
}

async function fetchFromSheets(token: string, spreadsheetId: string): Promise<DatabaseSchema> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Giocatori!A:M&ranges=Campi!A:A&ranges=Partite!A:K&ranges=Log!A:D`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Google Sheets fetch failed: ${response.status} - ${txt}`);
  }
  const data = await response.json() as any;
  const valueRanges = data.valueRanges || [];

  const giocatoriValues = valueRanges[0]?.values || [];
  const campiValues = valueRanges[1]?.values || [];
  const partiteValues = valueRanges[2]?.values || [];
  const logValues = valueRanges[3]?.values || [];

  return {
    giocatori: parseGiocatori(giocatoriValues),
    campi: parseCampi(campiValues),
    partite: parsePartite(partiteValues),
    logs: parseLogs(logValues)
  };
}

async function saveToSheets(token: string, db: DatabaseSchema): Promise<void> {
  const spreadsheetId = await getOrUpdateSpreadsheetId(token);
  await saveToSheetsInternal(token, spreadsheetId, db);
}

async function saveToSheetsInternal(token: string, spreadsheetId: string, db: DatabaseSchema): Promise<void> {
  // Ensure both Fantasquadre and Consigli sheets exist
  await ensureFantasquadreSheetExists(token, spreadsheetId);
  await ensureConsigliSheetExists(token, spreadsheetId);

  // First, batchClear ranges to prevent stale trailing rows
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`;
  const clearRes = await fetch(clearUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      ranges: [
        "Giocatori!A2:M",
        "Campi!A2:A",
        "Partite!A2:K",
        "Log!A2:D",
        "Fantasquadre!A2:J",
        "Consigli!A2:E"
      ]
    })
  });
  if (!clearRes.ok) {
    const errorTxt = await clearRes.text();
    console.error("Failed to clear ranges on Google Sheets:", errorTxt);
  }

  // Pre-process rows
  const giocatoriRows = db.giocatori.map(g => [
    g.nome || "",
    g.saldo ?? 0,
    g.gol ?? 0,
    g.ammonizioni ?? 0,
    g.ultimoRuolo || "",
    g.assist ?? 0,
    g.espulsioni ?? 0,
    g.golSubitiAzione ?? 0,
    g.golSubitiRigore ?? 0,
    g.golSubitiPiazzato ?? 0,
    g.quotaIscrizione ?? 0,
    g.attivo ? "TRUE" : "FALSE",
    g.numeroMaglia ?? 99
  ]);

  const campiRows = (db.campi || []).map(c => [c]);

  const partiteRows = db.partite.map(p => [
    p.id || "",
    p.dataInserimento || new Date().toISOString(),
    p.dettagli || "",
    p.costo ?? 0,
    JSON.stringify(p.convocati || []),
    p.stato || "Aperta",
    p.risultato || "",
    JSON.stringify(p.referto || []),
    JSON.stringify(p.formazione || { titolari: [], panchina: [] }),
    p.inviatoFanta ? "TRUE" : "FALSE",
    JSON.stringify(p.rosterSnapshot || {})
  ]);

  const logsRows = (db.logs || []).map(l => [
    l.data || "",
    l.operazione || "",
    l.importo || "",
    l.dettagli || ""
  ]);

  const fantasquadreRows = (db.fantasquadre || []).map(fs => [
    fs.id || "",
    fs.nomePartecipante || "",
    fs.nomeFantasquadra || "",
    JSON.stringify(fs.giocatoriSelezionati || []),
    fs.dataInserimento || "",
    fs.pin || "",
    fs.email || "",
    fs.creditoResiduo ?? 50,
    JSON.stringify(fs.valoriAcquisto || {}),
    fs.ultimoCambioMatchId || ""
  ]);

  const consigliRows = (db.consigli || []).map(c => [
    c.id || "",
    c.autore || "",
    c.testo || "",
    c.data || "",
    c.letto ? "TRUE" : "FALSE"
  ]);

  const dataPayload: any[] = [];
  if (giocatoriRows.length > 0) {
    dataPayload.push({ range: "Giocatori!A2", values: giocatoriRows });
  }
  if (campiRows.length > 0) {
    dataPayload.push({ range: "Campi!A2", values: campiRows });
  }
  if (partiteRows.length > 0) {
    dataPayload.push({ range: "Partite!A2", values: partiteRows });
  }
  if (logsRows.length > 0) {
    dataPayload.push({ range: "Log!A2", values: logsRows });
  }
  if (fantasquadreRows.length > 0) {
    dataPayload.push({ range: "Fantasquadre!A2", values: fantasquadreRows });
  }
  if (consigliRows.length > 0) {
    dataPayload.push({ range: "Consigli!A2", values: consigliRows });
  }

  if (dataPayload.length > 0) {
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
    const updateRes = await fetch(updateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: dataPayload
      })
    });
    if (!updateRes.ok) {
      const errorTxt = await updateRes.text();
      throw new Error(`Google Sheets update failed: ${updateRes.status} - ${errorTxt}`);
    }
  }
}

const STORED_TOKEN_PATH = path.join(process.cwd(), "src", "google-token.json");

let cachedSaToken: string | null = null;
let cachedSaTokenExpiry: number = 0;
let isSaDisabled: boolean = false;

async function getServiceAccountToken(): Promise<string | undefined> {
  if (isSaDisabled) {
    return undefined;
  }
  // If we have a cached token that's valid for at least 5 more minutes, use it
  if (cachedSaToken && Date.now() < cachedSaTokenExpiry - 300000) {
    return cachedSaToken;
  }
  
  try {
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.readonly"] });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    
    if (tokenResponse.token) {
      cachedSaToken = tokenResponse.token;
      cachedSaTokenExpiry = Date.now() + 3500000; // valid for ~1 hour
      console.log("[Google Sheets] Service Account token refreshed successfully!");
      return cachedSaToken;
    }
  } catch (error: any) {
    console.error("[Google Sheets] Failed to retrieve Service Account token:", error.message);
  }
  return undefined;
}

async function getStoredGoogleToken(): Promise<string | undefined> {
  // Try to use the logged-in human user token first so their Sheet settings and permissions are fully respected
  try {
    const raw = await fs.readFile(STORED_TOKEN_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token) {
      return parsed.token;
    }
  } catch {
    // If no human token exists, we can fall back to the Service Account token underneath
  }

  const saToken = await getServiceAccountToken();
  if (saToken) {
    return saToken;
  }
  return undefined;
}

async function saveStoredGoogleToken(token: string): Promise<void> {
  const data = {
    token,
    savedAt: new Date().toISOString()
  };
  await fs.writeFile(STORED_TOKEN_PATH, JSON.stringify(data, null, 2), "utf-8");
}

async function deleteStoredGoogleToken(): Promise<void> {
  try {
    await fs.unlink(STORED_TOKEN_PATH);
    console.log("[Google Sheets] Stored credentials reset successfully to allow clean session re-authentication.");
  } catch {
    // Ignora se già rimosso
  }
}

// Utility state parameters for Caching & Concurrency optimization (safe up to 100+ concurrent teams)
let memoryCache: DatabaseSchema | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 25000; // Cache TTL to protect Google Sheets read limits under parallel load

interface SyncTask {
  db: DatabaseSchema;
  token: string;
}

let pendingSyncTask: SyncTask | null = null;
let sheetsSyncTimeout: NodeJS.Timeout | null = null;
let sheetsSyncInProgress = false;
let globalSyncError: string | null = null;

// Debounced background backup mechanism
function triggerBackgroundSaveToSheets(db: DatabaseSchema, token: string) {
  pendingSyncTask = { db, token };

  if (sheetsSyncTimeout) {
    clearTimeout(sheetsSyncTimeout);
  }

  // Schedule background write in 6 seconds to accumulate consecutive client operations
  sheetsSyncTimeout = setTimeout(async () => {
    sheetsSyncTimeout = null;
    await processPendingSync();
  }, 6000);
}

async function processPendingSync() {
  if (sheetsSyncInProgress || !pendingSyncTask) return;

  sheetsSyncInProgress = true;
  const currentTask = pendingSyncTask;
  pendingSyncTask = null; // Clear so subsequent updates can schedule a new write

  try {
    console.log(`[Google Sheets Async Sync] Avvio salvataggio in background per ${currentTask.db.fantasquadre.length} squadre...`);
    await saveToSheets(currentTask.token, currentTask.db);
    console.log("[Google Sheets Async Sync] Backup completato ed allineato con successo!");
    globalSyncError = null;
    if (memoryCache) {
      // Removed sync status logic
    }
  } catch (err: any) {
    const errMsg = (err.message || "").toLowerCase();
    const isAuthError = errMsg.includes("401") || 
                        errMsg.includes("unauthenticated") || 
                        errMsg.includes("invalid authentication credentials") ||
                        errMsg.includes("request had invalid authentication credentials");
    
    const isSa = cachedSaToken && currentTask.token === cachedSaToken;
    const isSaDisabledError = isSa && (errMsg.includes("403") || errMsg.includes("disabled") || errMsg.includes("permission_denied") || errMsg.includes("user_project_denied"));
    if (isSaDisabledError) {
      console.log("[Google Sheets] Service Account Sheets API is disabled on project 289516009831. Silently disabling Service Account fallback.");
      isSaDisabled = true;
      pendingSyncTask = null;
      if (sheetsSyncTimeout) {
        clearTimeout(sheetsSyncTimeout);
        sheetsSyncTimeout = null;
      }
      return; // Terminate task cleanly without retrying
    }
    
    const isApiDisabled = errMsg.includes("disabled") || errMsg.includes("abilitata");

    if (!isAuthError && !isApiDisabled) {
      console.error("[Google Sheets Async Sync] Errore critico durante la scrittura asincrona:", err.message);
    }
    
    if (isAuthError) {
      if (!isSa) {
        console.log("[Google Sheets Async Sync] Access token expired (401/403). Resetting saved credentials.");
        deleteStoredGoogleToken().catch(() => {});
        globalSyncError = "Token Google scaduto. Ri-effettua l'accesso.";
      } else {
        console.log("[Google Sheets Async Sync] Service Account access status: Sheet requires direct sharing or permissions verification.");
        globalSyncError = "Errore di accesso dell'Account di Servizio sul foglio. Verifica che l'email del Service Account sia Editor sul file condiviso.";
      }
      if (memoryCache) {
        // Removed sync status logic
      }
      pendingSyncTask = null;
      if (sheetsSyncTimeout) {
        clearTimeout(sheetsSyncTimeout);
        sheetsSyncTimeout = null;
      }
    } else {
      if (isApiDisabled) {
        console.log("[Google Sheets Async Sync] Sheets API is disabled. Skipped writing directly.");
        globalSyncError = null;
        if (memoryCache) {
          // Removed sync status logic
        }
        pendingSyncTask = null;
        if (sheetsSyncTimeout) {
          clearTimeout(sheetsSyncTimeout);
          sheetsSyncTimeout = null;
        }
      } else {
        globalSyncError = err.message;
        if (memoryCache) {
          // Removed sync status logic
        }
        
        // Put task back for another retry in 10s if no newer updates came in
        if (!pendingSyncTask) {
          pendingSyncTask = currentTask;
          sheetsSyncTimeout = setTimeout(() => {
            sheetsSyncTimeout = null;
            processPendingSync();
          }, 10000);
        }
      }
    }
  } finally {
    sheetsSyncInProgress = false;
    // Sequential fallback: if updates came in while this sync was processing, execute them next
    if (pendingSyncTask) {
      sheetsSyncTimeout = setTimeout(() => {
        sheetsSyncTimeout = null;
        processPendingSync();
      }, 2000); // Wait 2 seconds to avoid exceeding instant Google write quotas
    }
  }
}

// Utility to read DB - Concurrency-Optimized with 25s local cache
async function getDb(token?: string, bypassCache: boolean = false): Promise<DatabaseSchema> {
  const now = Date.now();

  // If memory cache exists and is fresh OR we have a newer local update pending sync,
  // serve the local write state immediately (essential to prevent data race loops)
  if (memoryCache && !bypassCache && (now - lastCacheFetchTime < CACHE_TTL_MS || pendingSyncTask !== null)) {
    return memoryCache;
  }

  // 1. PRIMARY: Fetch from Firestore (24/7 availability)
  let firestoreDb = await fetchFromFirestore();

  let localDb: DatabaseSchema;
  try {
    const raw = await safeReadDb();
    localDb = JSON.parse(raw) as DatabaseSchema;
  } catch (err) {
    localDb = { giocatori: [], partite: [], campi: [], logs: [] };
  }
  if (!localDb.fantasquadre) localDb.fantasquadre = [];
  if (!localDb.consigli) localDb.consigli = [];

    // Integrate Firestore data into localDb as the baseline source of truth
    if (firestoreDb) {
      if (firestoreDb.giocatori.length > 0) localDb.giocatori = firestoreDb.giocatori;
      if (firestoreDb.partite.length > 0) localDb.partite = firestoreDb.partite;
      if (firestoreDb.campi.length > 0) localDb.campi = firestoreDb.campi;
      if (firestoreDb.logs && firestoreDb.logs.length > 0) localDb.logs = firestoreDb.logs;
      if (firestoreDb.bonuses) localDb.bonuses = firestoreDb.bonuses;
      
      // For arrays, merge to prevent data loss
    const fantaMap = new Map<string, Fantasquadra>();
    for (const fs of localDb.fantasquadre) fantaMap.set(fs.id || fs.nomeFantasquadra, fs);
    for (const fs of firestoreDb.fantasquadre || []) fantaMap.set(fs.id || fs.nomeFantasquadra, Object.assign({}, fantaMap.get(fs.id || fs.nomeFantasquadra), fs));
    localDb.fantasquadre = Array.from(fantaMap.values());

    const consigliMap = new Map<string, Consiglio>();
    for (const c of localDb.consigli) consigliMap.set(c.id, c);
    for (const c of firestoreDb.consigli || []) consigliMap.set(c.id, Object.assign({}, consigliMap.get(c.id), c));
    localDb.consigli = Array.from(consigliMap.values());
  }

  let activeToken = token;
  if (!activeToken || activeToken.startsWith("local-admin-")) {
    activeToken = await getStoredGoogleToken();
  }

  // Reload from sheets only if we have active auth token and NO writes are currently pending / running
  if (activeToken && !activeToken.startsWith("local-admin-") && !pendingSyncTask && !sheetsSyncInProgress) {
    try {
      const spreadsheetId = await getOrUpdateSpreadsheetId(activeToken);
      let sheetsDb = await fetchFromSheets(activeToken, spreadsheetId);
      
      let fetchedFantasquadre: Fantasquadra[] = [];
      try {
        fetchedFantasquadre = await fetchFantasquadreFromSheets(activeToken, spreadsheetId);
      } catch (fantaErr: any) {
        console.error("[Google Sheets Sync] Failed to fetch Fantasquadre, retaining local:", fantaErr.message);
        fetchedFantasquadre = localDb.fantasquadre || [];
      }
       // Hardened Anti-Wiping Logic (Previene crolli o perdite di dati accidentali)
      if (sheetsDb.giocatori.length === 0 && localDb.giocatori.length > 0) {
        console.warn("[Google Sheets Anti-Wipe] Rilevato foglio giocatori vuoto. Conservazione dati locali!");
        sheetsDb.giocatori = localDb.giocatori;
      }
      if (sheetsDb.partite.length === 0 && localDb.partite.length > 0) {
        console.warn("[Google Sheets Anti-Wipe] Rilevato foglio partite vuoto. Conservazione dati locali!");
        sheetsDb.partite = localDb.partite;
      }

      // Merge fantasquadre combining local registrations and spreadsheet ones
      const localFantasquadre = localDb.fantasquadre || [];
      const fantaMap = new Map<string, Fantasquadra>();
      
      // Seed with Google Sheets' data (as it is the shared single source of truth)
      for (const fs of fetchedFantasquadre) {
        fantaMap.set(fs.nomeFantasquadra.toLowerCase().trim(), fs);
      }
      // Merge local ones if they are missing or have more players selected
      for (const fs of localFantasquadre) {
        const key = fs.nomeFantasquadra.toLowerCase().trim();
        if (!fantaMap.has(key)) {
          console.log(`[Google Sheets Merge] Ripristinato team locale: '${fs.nomeFantasquadra}' di ${fs.nomePartecipante}`);
          fantaMap.set(key, fs);
        } else {
          // If both exist, keep the one with most players selected
          const sheetFs = fantaMap.get(key)!;
          const sheetRoster = sheetFs.giocatoriSelezionati || [];
          const localRoster = fs.giocatoriSelezionati || [];
          if (localRoster.length > sheetRoster.length) {
            console.log(`[Google Sheets Merge] Sostituito team '${fs.nomeFantasquadra}' con versione locale (più completa)`);
            fantaMap.set(key, fs);
          }
        }
      }
      sheetsDb.fantasquadre = Array.from(fantaMap.values());

      let fetchedConsigli: Consiglio[] = [];
      try {
        fetchedConsigli = await fetchConsigliFromSheets(activeToken, spreadsheetId);
      } catch (consigliErr: any) {
        console.error("[Google Sheets Sync] Failed to fetch Consigli, retaining local:", consigliErr.message);
        fetchedConsigli = localDb.consigli || [];
      }

      // Merge consigli combining local items and spreadsheet ones
      const localConsigli = localDb.consigli || [];
      const consigliMap = new Map<string, Consiglio>();
      for (const c of fetchedConsigli) {
        consigliMap.set(c.id, c);
      }
      for (const c of localConsigli) {
        if (!consigliMap.has(c.id)) {
          consigliMap.set(c.id, c);
        }
      }
      sheetsDb.consigli = Array.from(consigliMap.values());

      // If the merged lists have more entries than Sheets, trigger background sync back to Sheets
      if (
        sheetsDb.fantasquadre.length > fetchedFantasquadre.length ||
        sheetsDb.consigli.length > fetchedConsigli.length
      ) {
        console.log(`[Google Sheets Auto-Sync] Rilevati dati locali non ancora sincronizzati su Sheets. Richiesta backup di riadeguamento...`);
        triggerBackgroundSaveToSheets(sheetsDb, activeToken);
      }
      
      // Upload local db to sheets if sheets is fully empty
      if (
        (sheetsDb.giocatori.length === 0 && sheetsDb.partite.length === 0) &&
        (localDb.giocatori.length > 0 || localDb.partite.length > 0)
      ) {
        console.log("Il foglio Google Sheets è vuoto ma il db locale contiene dati. Sincronizzazione asincrona...");
        await saveToSheetsInternal(activeToken, spreadsheetId, localDb);
        sheetsDb = localDb;
      } else {
        if (localDb.bonuses) sheetsDb.bonuses = localDb.bonuses;
        await safeWriteDb(JSON.stringify(sheetsDb, null, 2));
      }

      globalSyncError = null;

      memoryCache = sheetsDb;
      lastCacheFetchTime = now;
      return sheetsDb;
    } catch (err: any) {
      const errMsg = (err.message || "").toLowerCase();
      const isAuthError = errMsg.includes("401") || 
                          errMsg.includes("unauthenticated") || 
                          errMsg.includes("invalid authentication credentials") ||
                          errMsg.includes("request had invalid authentication credentials");
      
      const isSa = cachedSaToken && activeToken === cachedSaToken;
      const isSaDisabledError = isSa && (errMsg.includes("403") || errMsg.includes("disabled") || errMsg.includes("permission_denied") || errMsg.includes("user_project_denied"));
      if (isSaDisabledError) {
        console.log("[Google Sheets Sync] Service Account Sheets API is disabled on project 289516009831. Silently disabling Service Account fallback.");
        isSaDisabled = true;
      }
      const isApiDisabled = errMsg.includes("disabled") || errMsg.includes("abilitata");

      if (!isAuthError && !isSaDisabledError && !isApiDisabled) {
        console.error("Error reading from Google Sheets, falling back to local file:", err.message);
      }
      
      if (isAuthError) {
        if (!isSa) {
          console.log("[Google Sheets Sync] Read token expired (401/403). Invoking credentials reset for fresh user sign-in.");
          await deleteStoredGoogleToken();
          activeToken = undefined;
          globalSyncError = "Token Google scaduto. Effettua nuovamente il login per sincronizzare.";
        } else {
          console.log("[Google Sheets Sync] Service Account credentials check completed. Sharing configuration check recommended.");
          globalSyncError = "Errore permessi Account di Servizio. Verifica la condivisione come Editor.";
        }
      } else {
        if (isSaDisabledError) {
          globalSyncError = "Servizio Google Sheets non attivo sull'Account di Servizio del Sandbox. Connettiti tramite Login.";
        } else if (isApiDisabled) {
          console.log("[Google Sheets Sync] Sheets API is disabled. Storing data locally only without displaying error.");
          globalSyncError = null; // Do not show an error banner, just fallback silently to local db
        } else {
          globalSyncError = err.message;
        }
      }
      
      memoryCache = localDb;
      lastCacheFetchTime = now;
      return localDb;
    }
  }

  memoryCache = localDb;
  lastCacheFetchTime = now;
  return localDb;
}

// Utility to write DB - Writes instantly locally (2ms response time) and debounces Google Sheets backup in background
async function saveDb(db: DatabaseSchema, token?: string): Promise<void> {
  if (!db.fantasquadre) db.fantasquadre = [];
  if (!db.consigli) db.consigli = [];

  // 1. Immediately cache state so read actions instantly serve this newest state
  memoryCache = db;
  lastCacheFetchTime = Date.now();

  // 2. Persist instantly to container file so we never lose database changes on restarts
  await safeWriteDb(JSON.stringify(db, null, 2));

  // 3. Persist instantly to Firestore (24/7 availability)
  saveToFirestore(db).catch(err => console.error("Firestore async save error:", err));

  let activeToken = token;
  if (!activeToken || activeToken.startsWith("local-admin-")) {
    activeToken = await getStoredGoogleToken();
  }

  // 3. Queue non-blocking Google Sheets backup
  if (activeToken && !activeToken.startsWith("local-admin-")) {
    triggerBackgroundSaveToSheets(db, activeToken);
  }
}

function sendDbResponse(res: express.Response, db: DatabaseSchema) {
  let fondoCassa = 0;
  for (const g of db.giocatori) {
    fondoCassa += g.saldo;
  }
  
  const partiteAperte = db.partite.filter(p => p.stato === "Aperta");
  const partiteChiuse = db.partite.filter(p => p.stato === "Chiusa");

  res.json({
    giocatori: db.giocatori,
    fondoCassa,
    partiteAperte,
    partiteChiuse,
    campi: db.campi,
    logs: db.logs || [],
    fantasquadre: db.fantasquadre || [],
    consigli: db.consigli || [],
  });
}

// Generate unique ID in Node
function generateUuid() {
  return Math.random().toString(36).substring(2, 9) + "-" + Date.now().toString(36);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Helper to extract access token from Authorization header
  const getAuthToken = (req: express.Request): string | undefined => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    return undefined;
  };

  // Middleware di Sicurezza: Qualsiasi utente che possiede il link privato può fare modifiche (Ritorno alle origini richiesto)
  app.use(async (req, res, next) => {
    // Nessun blocco di sicurezza di scrittura - chi ha il link può gestire liberamente l'app!
    next();
  });

  // API ROUTES

  // Salvataggio token Google Drive globale sul server
  app.post("/api/save-token", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ err: "Token mancante" });
      await saveStoredGoogleToken(token);
      console.log("[Server] Token Google Sheets globale aggiornato con successo dall'amministratore.");
      
      const db = await getDb(token);
      sendDbResponse(res, db);
    } catch (err: any) {
      res.status(500).json({ err: "Errore salvataggio token: " + err.message });
    }
  });

  // Endpoints per Fantacalcetto
  // Iscrizione di una nuova fantasquadra (Public/One-way API)
  app.post("/api/fantasquadre/iscrivi", async (req, res) => {
    try {
      const { nomePartecipante, nomeFantasquadra, giocatoriSelezionati, pin, email, adminBypassLock } = req.body;
      if (!nomeFantasquadra || !nomeFantasquadra.trim()) {
        return res.status(400).json({ err: "Nome della fantasquadra obbligatorio" });
      }

      const trimmedPin = pin ? String(pin).trim() : "";
      if (!trimmedPin || trimmedPin.length < 8) {
        return res.status(400).json({ err: "La password deve contenere almeno 8 caratteri!" });
      }

      const token = getAuthToken(req);
      const db = await getDb(token);

      if (!db.fantasquadre) {
        db.fantasquadre = [];
      }

      // Check if team already exists by name
      const targetTeamIndex = db.fantasquadre.findIndex(
        fs => fs.nomeFantasquadra.toLowerCase().trim() === nomeFantasquadra.toLowerCase().trim()
      );
      const isExistingTeam = targetTeamIndex !== -1;

      const trimmedEmail = email ? String(email).trim().toLowerCase() : "";
      
      if (!isExistingTeam) {
        if (!trimmedEmail) {
          return res.status(400).json({ err: "Indirizzo email obbligatorio per la registrazione!" });
        }
        if (!nomePartecipante || !nomePartecipante.trim()) {
          return res.status(400).json({ err: "Nome del partecipante (Presidente) obbligatorio per la nuova iscrizione!" });
        }
        // Check if email belongs to some OTHER existing team
        const emailInUse = db.fantasquadre.some(fs => fs.email && fs.email.toLowerCase().trim() === trimmedEmail);
        if (emailInUse) {
          return res.status(400).json({ err: "Questa email è già associata a un'altra fantasquadra!" });
        }
      }

      // Check for Championship match lockout (locked starting from 1 hour before kickoff)
      const lockoutReg = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})[:.](\d{2})/;
      const openMatches = (db.partite || []).filter((p: any) => p.stato === "Aperta");
      const campMatches = openMatches.filter((m: any) => !(m.dettagli || "").toLowerCase().includes("amichevole"));
      const now = new Date();

      for (const m of campMatches) {
        const matchRes = (m.dettagli || "").match(lockoutReg);
        if (matchRes) {
          const day = parseInt(matchRes[1], 10);
          const month = parseInt(matchRes[2], 10) - 1;
          const year = parseInt(matchRes[3], 10);
          const hour = parseInt(matchRes[4], 10);
          const minute = parseInt(matchRes[5], 10);
          const matchTime = new Date(year, month, day, hour, minute);

          const lockoutTime = matchTime.getTime() - (60 * 60 * 1000); // 1 hour before
          if (now.getTime() >= lockoutTime) {
            return res.status(400).json({
              err: `Modifiche bloccate! Mancano meno di un'ora all'inizio della partita di campionato del ${matchRes[1]}/${matchRes[2]} alle ${matchRes[4]}:${matchRes[5]} (o il match è già in corso).`
            });
          }
        }
      }

      // Check for duplications or allow updating if it matches and PIN is correct
      const fanteDuplicato = db.fantasquadre.find(
        fs => fs.nomeFantasquadra.toLowerCase().trim() === nomeFantasquadra.toLowerCase().trim() ||
              (trimmedEmail && fs.email && fs.email.toLowerCase().trim() === trimmedEmail)
      );

      const targetRoster = Array.isArray(giocatoriSelezionati) ? giocatoriSelezionati : [];

      if (fanteDuplicato) {
        // MUST be exactly 4 when writing/saving an active roster
        if (targetRoster.length !== 4) {
          return res.status(400).json({ err: "Devi selezionare esattamente 4 giocatori per il tuo roster (3 titolari e 1 panchinaro)!" });
        }

        // If the duplicated team has a PIN, verify it
        if (fanteDuplicato.pin) {
          if (fanteDuplicato.pin.trim() !== trimmedPin) {
            return res.status(403).json({
              err: `PIN Errato! Inserisci il codice PIN/Password corretto associato alla fantasquadra '${fanteDuplicato.nomeFantasquadra}' per modificarne la formazione.`
            });
          }
        } else {
          // Backward compatibility: If the team didn't have a PIN, lock/secure it now with the set PIN
          fanteDuplicato.pin = trimmedPin;
        }

        // Backward compatibility: Initialize values if absent
        if (!fanteDuplicato.valoriAcquisto) {
          fanteDuplicato.valoriAcquisto = {};
        }

        const prevPlayers = fanteDuplicato.giocatoriSelezionati || [];

        let newCreditoResiduo = fanteDuplicato.creditoResiduo ?? MAX_BUDGET;
        const newValoriAcquisto = { ...(fanteDuplicato.valoriAcquisto || {}) };

        if (prevPlayers.length === 4) {
          // Normal Transfer (max 1 change allowed)
          const soldPlayers = prevPlayers.filter(p => !targetRoster.includes(p));
          const boughtPlayers = targetRoster.filter(p => !prevPlayers.includes(p));

          if (!adminBypassLock && soldPlayers.length > 1) {
            return res.status(400).json({ err: `Puoi effettuare al massimo 1 cambio di giocatore alla volta! Hai provato a cambiare ${soldPlayers.length} giocatori.` });
          }

          if (soldPlayers.length > 0 && boughtPlayers.length > 0) {
            // Check if they've already made a trade since the last match played and closed
            const closedCampMatches = (db.partite || [])
              .filter((p: any) => p.stato === "Chiusa" && !(p.dettagli || "").toLowerCase().includes("amichevole"));
            const latestClosedMatchId = closedCampMatches.length > 0 ? closedCampMatches[closedCampMatches.length - 1].id : "no-match-closed";

            if (!adminBypassLock && fanteDuplicato.ultimoCambioMatchId === latestClosedMatchId) {
              return res.status(400).json({
                err: "Hai già effettuato il cambio giocatore consentito per questa giornata di mercato! Potrai farne uno nuovo solo dopo che la prossima partita sarà conclusa e refertata dall'amministratore."
              });
            }

            let totalSoldPrice = 0;
            let totalBoughtPrice = 0;

            for (const soldPlayerName of soldPlayers) {
              totalSoldPrice += getPlayerPriceForRoster(soldPlayerName, db.partite || []);
              delete newValoriAcquisto[soldPlayerName];
            }

            for (const boughtPlayerName of boughtPlayers) {
              const boughtPrice = getPlayerPriceForRoster(boughtPlayerName, db.partite || []);
              totalBoughtPrice += boughtPrice;
              newValoriAcquisto[boughtPlayerName] = boughtPrice;
            }

            newCreditoResiduo = (fanteDuplicato.creditoResiduo ?? 0) + totalSoldPrice - totalBoughtPrice;

            if (newCreditoResiduo < 0) {
              return res.status(400).json({
                err: `Crediti insufficienti! Operazione di mercato respinta (Credito Mancante: ${Math.abs(newCreditoResiduo)} Izycoin).`
              });
            }

            // Save transfer match milestone block
            fanteDuplicato.ultimoCambioMatchId = latestClosedMatchId;
          }
        } else {
          // Composing first-time active roster (from 0/empty to 4 players)
          let totalCost = 0;
          const freshValoriAcquisto: Record<string, number> = {};
          for (const pName of targetRoster) {
            const pPrice = getPlayerPriceForRoster(pName, db.partite || []);
            freshValoriAcquisto[pName] = pPrice;
            totalCost += pPrice;
          }

          if (totalCost > MAX_BUDGET) {
            return res.status(400).json({
              err: `Budget iniziale massimo superato! Il limite è di ${MAX_BUDGET} Izycoin, ma la rosa scelta costa complessivamente ${totalCost} Izycoin.`
            });
          }

          // Reset and recreate valuations
          Object.keys(newValoriAcquisto).forEach(k => delete newValoriAcquisto[k]);
          Object.assign(newValoriAcquisto, freshValoriAcquisto);
          newCreditoResiduo = MAX_BUDGET - totalCost;
        }

        // Keep or update details
        if (nomePartecipante && nomePartecipante.trim()) {
          fanteDuplicato.nomePartecipante = nomePartecipante.trim();
        }
        fanteDuplicato.giocatoriSelezionati = targetRoster;
        fanteDuplicato.creditoResiduo = newCreditoResiduo;
        fanteDuplicato.valoriAcquisto = newValoriAcquisto;
        fanteDuplicato.dataInserimento = new Date().toISOString();

        db.logs.push({
          data: new Date().toLocaleString("it-IT"),
          operazione: "Fantacalcetto",
          importo: "-",
          dettagli: `Formazione modificata per fanta-squadra '${fanteDuplicato.nomeFantasquadra}' di ${fanteDuplicato.nomePartecipante} (Izycoin residui: ${newCreditoResiduo})`
        });

        await saveDb(db, token);
        return sendDbResponse(res, db);
      }

      // New registration (targetRoster is allowed to be empty or less than 4 initially)
      let totalInitialCost = 0;
      const initialValoriAcquisto: Record<string, number> = {};

      for (const pName of targetRoster) {
        const pPrice = getPlayerPriceForRoster(pName, db.partite || []);
        initialValoriAcquisto[pName] = pPrice;
        totalInitialCost += pPrice;
      }

      if (totalInitialCost > MAX_BUDGET) {
        return res.status(400).json({
          err: `Budget iniziale massimo superato! Il limite è di ${MAX_BUDGET} Izycoin, ma la rosa scelta costa complessivamente ${totalInitialCost} Izycoin.`
        });
      }

      const nuovaIscrizione: Fantasquadra = {
        id: "fs-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        nomePartecipante: nomePartecipante.trim(),
        nomeFantasquadra: nomeFantasquadra.trim(),
        giocatoriSelezionati: targetRoster,
        dataInserimento: new Date().toISOString(),
        pin: trimmedPin,
        email: trimmedEmail,
        creditoResiduo: MAX_BUDGET - totalInitialCost,
        valoriAcquisto: initialValoriAcquisto
      };

      db.fantasquadre.push(nuovaIscrizione);

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Fantacalcetto",
        importo: "-",
        dettagli: `Nuova fantasquadra iscritta con PIN di sicurezza: ${nuovaIscrizione.nomeFantasquadra} da parte di ${nuovaIscrizione.nomePartecipante}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (err: any) {
      res.status(500).json({ err: "Errore durante l'iscrizione: " + err.message });
    }
  });

  // Eliminazione di una fantasquadra (Admin API)
  app.post("/api/fantasquadre/elimina", async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ err: "ID fantasquadra mancante" });

      const token = getAuthToken(req);
      const db = await getDb(token);

      if (!db.fantasquadre) {
        db.fantasquadre = [];
      }

      const fantaDaTogliere = db.fantasquadre.find(fs => fs.id === id);
      if (!fantaDaTogliere) {
        return res.status(404).json({ err: "Fantasquadra non trovata" });
      }

      db.fantasquadre = db.fantasquadre.filter(fs => fs.id !== id);

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Fantacalcetto",
        importo: "-",
        dettagli: `Fantasquadra rimossa: ${fantaDaTogliere.nomeFantasquadra} (${fantaDaTogliere.nomePartecipante})`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (err: any) {
      res.status(500).json({ err: "Errore eliminazione fantasquadra: " + err.message });
    }
  });

  // Endpoints per Consigli/Miglioramenti Proposti (Public & Admin toggles)
  app.post("/api/consigli/crea", async (req, res) => {
    try {
      const { autore, testo } = req.body;
      if (!autore || !autore.trim()) {
        return res.status(400).json({ err: "Completa il campo Autore/Tuo Nome" });
      }
      if (!testo || !testo.trim()) {
        return res.status(400).json({ err: "Inserisci un testo per la tua proposta" });
      }

      const token = getAuthToken(req);
      const db = await getDb(token);

      if (!db.consigli) {
        db.consigli = [];
      }

      const nuovoConsiglio = {
        id: "c-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
        autore: autore.trim(),
        testo: testo.trim(),
        data: new Date().toLocaleString("it-IT"),
        letto: false
      };

      db.consigli.push(nuovoConsiglio);

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Sondaggi/Consigli",
        importo: "-",
        dettagli: `Proposta di ${nuovoConsiglio.autore}: "${nuovoConsiglio.testo.substring(0, 40)}${nuovoConsiglio.testo.length > 40 ? "..." : ""}"`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (err: any) {
      res.status(500).json({ err: "Errore durante l'invio del suggerimento: " + err.message });
    }
  });

  app.post("/api/consigli/segna-letto", async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ err: "ID consiglio mancante" });

      const token = getAuthToken(req);
      const db = await getDb(token);

      if (!db.consigli) db.consigli = [];

      const consiglio = db.consigli.find((c: any) => c.id === id);
      if (consiglio) {
        consiglio.letto = true;
      }

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (err: any) {
      res.status(500).json({ err: "Errore: " + err.message });
    }
  });

  app.post("/api/consigli/elimina", async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ err: "ID consiglio mancante" });

      const token = getAuthToken(req);
      const db = await getDb(token);

      if (!db.consigli) db.consigli = [];

      db.consigli = db.consigli.filter((c: any) => c.id !== id);

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (err: any) {
      res.status(500).json({ err: "Errore: " + err.message });
    }
  });

  // 1. OTTENI DATI
  app.get("/api/dati", async (req, res) => {
    try {
      const token = getAuthToken(req);
      const bypassCache = req.query.bypassCache === "true";
      const db = await getDb(token, bypassCache);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: "Errore dal server: " + error.message });
    }
  });

  // Endpoints for system info
  app.get("/api/system-info", async (req, res) => {
    try {
      const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
      const credentials = await auth.getCredentials();
      res.json({ serviceAccountEmail: credentials.client_email });
    } catch(err: any) {
      res.json({ serviceAccountEmail: null });
    }
  });

  // 2. AGGIUNGI GIOCATORE
  app.post("/api/giocatori", async (req, res) => {
    try {
      const { nome } = req.body;
      if (!nome) return res.status(400).json({ err: "Nome mancante" });

      const token = getAuthToken(req);
      const db = await getDb(token);
      
      // Check if team already has this name
      if (db.giocatori.some(x => x.nome.toLowerCase() === nome.trim().toLowerCase())) {
        return res.status(400).json({ err: "Un giocatore con questo nome esiste già!" });
      }

      const nuovo: Giocatore = {
        nome: nome.trim(),
        saldo: 0,
        gol: 0,
        ammonizioni: 0,
        ultimoRuolo: "",
        assist: 0,
        espulsioni: 0,
        golSubitiAzione: 0,
        golSubitiRigore: 0,
        golSubitiPiazzato: 0,
        quotaIscrizione: 0,
        attivo: false,
        numeroMaglia: 99
      };

      db.giocatori.push(nuovo);
      
      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Rosa",
        importo: "-",
        dettagli: `Aggiunto giocatore: ${nuovo.nome}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 3. ELIMINA GIOCATORE
  app.post("/api/giocatori/delete", async (req, res) => {
    try {
      const { nome } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);
      
      db.giocatori = db.giocatori.filter(g => g.nome !== nome);
      
      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Rosa",
        importo: "-",
        dettagli: `Eliminato giocatore: ${nome}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 4. VERSA QUOTA
  app.post("/api/giocatori/versa", async (req, res) => {
    try {
      const { nome, importo } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);
      const importoNum = parseFloat(importo) || 0;

      for (const g of db.giocatori) {
        if (g.nome === nome) {
          g.saldo = parseFloat((g.saldo + importoNum).toFixed(2));
          break;
        }
      }

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Ricarica",
        importo: importoNum.toString(),
        dettagli: `Versamento saldo base da: ${nome}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 4b. VERSA QUOTE MASSIVO (BATCH RECHARGE ON THE FIELD)
  app.post("/api/giocatori/versa-massivo", async (req, res) => {
    try {
      const { ricariche } = req.body;
      if (!ricariche || !Array.isArray(ricariche)) {
        return res.status(400).json({ err: "Struttura delle ricariche non valida" });
      }

      const token = getAuthToken(req);
      const db = await getDb(token);
      const ricaricateInfo: string[] = [];
      let importoTotaleMassivo = 0;

      for (const r of ricariche) {
        const importoNum = parseFloat(r.importo) || 0;
        if (importoNum <= 0) continue;

        const giocatore = db.giocatori.find(g => g.nome === r.nome);
        if (giocatore) {
          giocatore.saldo = parseFloat((giocatore.saldo + importoNum).toFixed(2));
          ricaricateInfo.push(`${r.nome} (${importoNum}€)`);
          importoTotaleMassivo += importoNum;
        }
      }

      if (ricaricateInfo.length > 0) {
        db.logs.push({
          data: new Date().toLocaleString("it-IT"),
          operazione: "Ricarica Massiva",
          importo: importoTotaleMassivo.toFixed(2),
          dettagli: `Ricarica di gruppo effettuata al campo: ${ricaricateInfo.join(", ")}`
        });
      }

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 5. VERSA QUOTA ISCRIZIONE
  app.post("/api/giocatori/versa-iscrizione", async (req, res) => {
    try {
      const { nome, importo } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);
      const importoNum = parseFloat(importo) || 0;

      for (const g of db.giocatori) {
        if (g.nome === nome) {
          g.quotaIscrizione = g.quotaIscrizione + importoNum;
          break;
        }
      }

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Quota Iscrizione",
        importo: importoNum.toString(),
        dettagli: `Versamento quota iscrizione da: ${nome}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 6. CAMBIA STATO GIOCATORE
  app.post("/api/giocatori/stato", async (req, res) => {
    try {
      const { nome, nuovoStato } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);

      for (const g of db.giocatori) {
        if (g.nome === nome) {
          g.attivo = nuovoStato === true;
          break;
        }
      }

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Stato Giocatore",
        importo: "-",
        dettagli: `Giocatore ${nome} impostato come: ${nuovoStato ? "Attivato" : "Disattivato"}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 7. DISATTIVA TUTTI
  app.post("/api/giocatori/disattiva-tutti", async (req, res) => {
    try {
      const token = getAuthToken(req);
      const db = await getDb(token);
      for (const g of db.giocatori) {
        g.attivo = false;
      }

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Stato Giocatore",
        importo: "-",
        dettagli: "Tutti i giocatori sono stati disattivati"
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 8. MODIFICA GIOCATORE (FULL PROFILE UPDATE)
  app.post("/api/giocatori/modifica", async (req, res) => {
    try {
      const { nomeOriginale, datiAggiornati } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);

      const index = db.giocatori.findIndex(g => g.nome === nomeOriginale);
      if (index !== -1) {
        db.giocatori[index] = {
          nome: datiAggiornati.nome || nomeOriginale,
          saldo: parseFloat(datiAggiornati.saldo) ?? 0,
          gol: parseInt(datiAggiornati.gol) ?? 0,
          ammonizioni: parseInt(datiAggiornati.ammonizioni) ?? 0,
          ultimoRuolo: datiAggiornati.ultimoRuolo || "",
          assist: parseInt(datiAggiornati.assist) ?? 0,
          espulsioni: parseInt(datiAggiornati.espulsioni) ?? 0,
          golSubitiAzione: parseInt(datiAggiornati.golSubitiAzione) ?? 0,
          golSubitiRigore: parseInt(datiAggiornati.golSubitiRigore) ?? 0,
          golSubitiPiazzato: parseInt(datiAggiornati.golSubitiPiazzato) ?? 0,
          quotaIscrizione: parseFloat(datiAggiornati.quotaIscrizione) ?? 0,
          attivo: datiAggiornati.attivo === true,
          numeroMaglia: parseInt(datiAggiornati.numeroMaglia) ?? 99
        };
      }

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 9. CREA PARTITA (INVITATION)
  app.post("/api/partite/crea", async (req, res) => {
    try {
      const { costo, convocati, dettagli, campo, mappaRuoli } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);

      // Check if new field should be created
      if (campo && !db.campi.includes(campo)) {
        db.campi.push(campo);
      }

      const idPartita = generateUuid();
      const nuovaPartita: Partita = {
        id: idPartita,
        dettagli: dettagli,
        costo: parseFloat(costo) || 0,
        convocati: convocati,
        stato: "Aperta",
        risultato: "",
        referto: [],
        formazione: { titolari: [], panchina: [] }
      };

      db.partite.push(nuovaPartita);

      // Save roles if map is passed
      if (mappaRuoli) {
        for (const g of db.giocatori) {
          if (mappaRuoli[g.nome]) {
            g.ultimoRuolo = mappaRuoli[g.nome];
          }
        }
      }

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Partite",
        importo: costo.toString(),
        dettagli: `Creata partita convocazione: ${dettagli}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 10. SALVA FORMAZIONE (LINEUP)
  app.post("/api/partite/formazione", async (req, res) => {
    try {
      const { idPartita, formazione } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);

      const index = db.partite.findIndex(p => p.id === idPartita);
      if (index !== -1) {
        db.partite[index].formazione = formazione;
      }

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 11. MODIFICA PARTITA APERTA
  app.post("/api/partite/modifica-aperta", async (req, res) => {
    try {
      const { id, dettagli, costo } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);

      const index = db.partite.findIndex(p => p.id === id);
      if (index !== -1) {
        db.partite[index].dettagli = dettagli;
        db.partite[index].costo = parseFloat(costo) || 0;
      }

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 12. SALVA MODIFICHE PARTITA CHIUSA (ROLLBACK AND APPLY)
  app.post("/api/partite/modifica-chiusa", async (req, res) => {
    try {
      const { idPartita, dettagli, costo, risultato, referto, note } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);

      const rigaPartita = db.partite.find(p => p.id === idPartita && p.stato === "Chiusa");
      if (!rigaPartita) return res.status(404).json({ err: "Partita non trovata o non chiusa" });

      const vecchioReferto: RefertoGiocatore[] = rigaPartita.referto || [];
      const vecchioCosto = rigaPartita.costo || 0;

      // Old quota individual
      let vecchiPaganti = 0;
      for (const r of vecchioReferto) {
        if (r.pagaQuota) vecchiPaganti++;
      }
      const vecchiaQuotaInd = vecchiPaganti > 0 ? vecchioCosto / vecchiPaganti : 0;

      // Exact individual cost calculation handling remainder cents for updated referto
      let nuoviPaganti = 0;
      for (const r of referto) {
        if (r.pagaQuota) nuoviPaganti++;
      }
      const totaleEuro = parseFloat(costo) || 0;
      let baseQuota = 0;
      let remainderCents = 0;
      
      if (nuoviPaganti > 0) {
        const totaleCents = Math.round(totaleEuro * 100);
        baseQuota = Math.floor(totaleCents / nuoviPaganti) / 100;
        remainderCents = totaleCents % nuoviPaganti;
      }
      
      let distributedCents = 0;
      for (const r of referto) {
        if (r.pagaQuota) {
          let quotaToDeduct = baseQuota;
          if (distributedCents < remainderCents) {
            quotaToDeduct = parseFloat((quotaToDeduct + 0.01).toFixed(2));
            distributedCents++;
          }
          r.quotaMaturata = quotaToDeduct;
        } else {
          r.quotaMaturata = 0;
        }
      }

      // Re-apply delta to each player in db (revert old stats / money, apply new stats / money)
      for (const g of db.giocatori) {
        const vRef = vecchioReferto.find(r => r.nome === g.nome);
        const nRef = referto.find((r: any) => r.nome === g.nome);

        let deltaQuota = 0;
        // Old quota to add back
        if (vRef && vRef.pagaQuota) {
          deltaQuota += (vRef.quotaMaturata !== undefined ? vRef.quotaMaturata : vecchiaQuotaInd);
        }
        // New quota to subtract
        if (nRef && nRef.pagaQuota) {
          deltaQuota -= (nRef.quotaMaturata || 0);
        }

        const deltaGol = (nRef ? (nRef.gol || 0) : 0) - (vRef ? (vRef.gol || 0) : 0);
        const deltaAmm = (nRef ? (nRef.amm || 0) : 0) - (vRef ? (vRef.amm || 0) : 0);
        const deltaAss = (nRef ? (nRef.assist || 0) : 0) - (vRef ? (vRef.assist || 0) : 0);
        const deltaRos = (nRef ? (nRef.rossi || 0) : 0) - (vRef ? (vRef.rossi || 0) : 0);
        const deltaSubA = (nRef ? (nRef.subitiAzione || 0) : 0) - (vRef ? (vRef.subitiAzione || 0) : 0);
        const deltaSubR = (nRef ? (nRef.subitiRigore || 0) : 0) - (vRef ? (vRef.subitiRigore || 0) : 0);
        const deltaSubP = (nRef ? (nRef.subitiPiazzato || 0) : 0) - (vRef ? (vRef.subitiPiazzato || 0) : 0);

        if (
          deltaQuota !== 0 ||
          deltaGol !== 0 ||
          deltaAmm !== 0 ||
          deltaAss !== 0 ||
          deltaRos !== 0 ||
          deltaSubA !== 0 ||
          deltaSubR !== 0 ||
          deltaSubP !== 0
        ) {
          g.saldo = parseFloat((g.saldo + deltaQuota).toFixed(2));
          g.gol = Math.max(0, g.gol + deltaGol);
          g.ammonizioni = Math.max(0, g.ammonizioni + deltaAmm);
          g.assist = Math.max(0, g.assist + deltaAss);
          g.espulsioni = Math.max(0, g.espulsioni + deltaRos);
          g.golSubitiAzione = Math.max(0, g.golSubitiAzione + deltaSubA);
          g.golSubitiRigore = Math.max(0, g.golSubitiRigore + deltaSubR);
          g.golSubitiPiazzato = Math.max(0, g.golSubitiPiazzato + deltaSubP);
        }
      }

      // Update match row
      rigaPartita.dettagli = dettagli;
      rigaPartita.costo = parseFloat(costo) || 0;
      rigaPartita.risultato = risultato;
      rigaPartita.referto = referto;
      if (note !== undefined) {
        rigaPartita.note = note || "";
      }

      // Initialize snapshot if missing (backwards compatibility)
      if (!rigaPartita.rosterSnapshot && db.fantasquadre && Array.isArray(db.fantasquadre)) {
        const snapshot: Record<string, string[]> = {};
        for (const fs of db.fantasquadre) {
          snapshot[fs.id] = [...(fs.giocatoriSelezionati || [])];
        }
        rigaPartita.rosterSnapshot = snapshot;
      }

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Partite",
        importo: costo.toString(),
        dettagli: `Modificato referto partita chiusa: ${dettagli}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 12b. INVIA A FANTACALCETTO (MARK GAME REPORT AS TRANSMITTED TO FANTACALCETTO)
  app.post("/api/partite/invia-fanta", async (req, res) => {
    try {
      const { idPartita } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);

      const rigaPartita = db.partite.find(p => p.id === idPartita && p.stato === "Chiusa");
      if (!rigaPartita) return res.status(404).json({ err: "Partita non trovata o non chiusa" });

      rigaPartita.inviatoFanta = true;

      // Initialize snapshot if missing (backwards compatibility)
      if (!rigaPartita.rosterSnapshot && db.fantasquadre && Array.isArray(db.fantasquadre)) {
        const snapshot: Record<string, string[]> = {};
        for (const fs of db.fantasquadre) {
          snapshot[fs.id] = [...(fs.giocatoriSelezionati || [])];
        }
        rigaPartita.rosterSnapshot = snapshot;
      }

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Fantacalcetto",
        importo: "-",
        dettagli: `Referto della partita inviato a Fantacalcetto: ${rigaPartita.dettagli}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 13. RIAPRI PARTITA (CANCEL DEBITS AND RESTORE OPEN STATUS)
  app.post("/api/partite/riapri", async (req, res) => {
    try {
      const { idPartita, conservaDati } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);

      const rigaPartita = db.partite.find(p => p.id === idPartita && p.stato === "Chiusa");
      if (!rigaPartita) return res.status(404).json({ err: "Partita non trovata o non chiusa" });

      const referto = rigaPartita.referto || [];
      const costoFinale = rigaPartita.costo || 0;

      let paganti = 0;
      for (const r of referto) {
        if (r.pagaQuota === true) paganti++;
      }
      
      const totaleEuro = typeof costoFinale === "string" ? parseFloat(costoFinale) : Number(costoFinale || 0);
      let baseQuota = 0;
      let remainderCents = 0;
      
      if (paganti > 0) {
        const totaleCents = Math.round(totaleEuro * 100);
        baseQuota = Math.floor(totaleCents / paganti) / 100;
        remainderCents = totaleCents % paganti;
      }
      
      let distributedCents = 0;

      // Revert player's balances and statistics
      for (const g of db.giocatori) {
        const dRef = referto.find(r => r.nome === g.nome);
        if (dRef) {
          if (dRef.pagaQuota) {
            let qToRestore = baseQuota;
            if (dRef.quotaMaturata !== undefined) {
               qToRestore = dRef.quotaMaturata;
            } else {
               if (distributedCents < remainderCents) {
                 qToRestore = parseFloat((qToRestore + 0.01).toFixed(2));
                 distributedCents++;
               }
            }
            g.saldo = parseFloat((g.saldo + qToRestore).toFixed(2));
          }
          g.gol = Math.max(0, g.gol - (dRef.gol || 0));
          g.ammonizioni = Math.max(0, g.ammonizioni - (dRef.amm || 0));
          g.assist = Math.max(0, g.assist - (dRef.assist || 0));
          g.espulsioni = Math.max(0, g.espulsioni - (dRef.rossi || 0));
          g.golSubitiAzione = Math.max(0, g.golSubitiAzione - (dRef.subitiAzione || 0));
          g.golSubitiRigore = Math.max(0, g.golSubitiRigore - (dRef.subitiRigore || 0));
          g.golSubitiPiazzato = Math.max(0, g.golSubitiPiazzato - (dRef.subitiPiazzato || 0));
        }
      }

      // Convert back to open status
      rigaPartita.stato = "Aperta";
      rigaPartita.inviatoFanta = false;
      if (!conservaDati) {
        rigaPartita.risultato = "";
        rigaPartita.referto = [];
      }

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Partite",
        importo: "-",
        dettagli: `Riaperta partita${conservaDati ? " (conservando i dati del referto come bozza)" : ""}: ${rigaPartita.dettagli}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 14. ELIMINA PARTITA CHIUSA (CANCEL DEBITS AND HARD DELETE)
  app.post("/api/partite/elimina-chiusa", async (req, res) => {
    try {
      const { idPartita } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);

      const rigaPartita = db.partite.find(p => p.id === idPartita && p.stato === "Chiusa");
      if (!rigaPartita) return res.status(404).json({ err: "Partita non trovata o non chiusa" });

      const referto = rigaPartita.referto || [];
      const costoFinale = rigaPartita.costo || 0;

      let paganti = 0;
      for (const r of referto) {
        if (r.pagaQuota === true) paganti++;
      }
      
      const totaleEuro = typeof costoFinale === "string" ? parseFloat(costoFinale) : Number(costoFinale || 0);
      let baseQuota = 0;
      let remainderCents = 0;
      
      if (paganti > 0) {
        const totaleCents = Math.round(totaleEuro * 100);
        baseQuota = Math.floor(totaleCents / paganti) / 100;
        remainderCents = totaleCents % paganti;
      }
      
      let distributedCents = 0;

      // Revert player's balance and statistics
      for (const g of db.giocatori) {
        const dRef = referto.find(r => r.nome === g.nome);
        if (dRef) {
          if (dRef.pagaQuota) {
            let qToRestore = baseQuota;
            if (dRef.quotaMaturata !== undefined) {
               qToRestore = dRef.quotaMaturata;
            } else {
               if (distributedCents < remainderCents) {
                 qToRestore = parseFloat((qToRestore + 0.01).toFixed(2));
                 distributedCents++;
               }
            }
            g.saldo = parseFloat((g.saldo + qToRestore).toFixed(2));
          }
          g.gol = Math.max(0, g.gol - (dRef.gol || 0));
          g.ammonizioni = Math.max(0, g.ammonizioni - (dRef.amm || 0));
          g.assist = Math.max(0, g.assist - (dRef.assist || 0));
          g.espulsioni = Math.max(0, g.espulsioni - (dRef.rossi || 0));
          g.golSubitiAzione = Math.max(0, g.golSubitiAzione - (dRef.subitiAzione || 0));
          g.golSubitiRigore = Math.max(0, g.golSubitiRigore - (dRef.subitiRigore || 0));
          g.golSubitiPiazzato = Math.max(0, g.golSubitiPiazzato - (dRef.subitiPiazzato || 0));
        }
      }

      // Hard delete
      db.partite = db.partite.filter(p => p.id !== idPartita);

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Partite",
        importo: "-",
        dettagli: `Eliminata definitivamente partita chiusa: ${rigaPartita.dettagli}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 15. CHIUDI PARTITA (DEBIT BALANCES AND APPLY FINAL REPORT STATES)
  app.post("/api/partite/chiudi", async (req, res) => {
    try {
      const { idPartita, costoFinale, presenti, risultato, referto, note } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);

      const rigaPartita = db.partite.find(p => p.id === idPartita);
      if (!rigaPartita) return res.status(404).json({ err: "Partita non trovata" });

      rigaPartita.stato = "Chiusa";
      rigaPartita.risultato = risultato;
      rigaPartita.referto = referto;
      rigaPartita.costo = typeof costoFinale === "string" ? parseFloat(costoFinale) : Number(costoFinale || 0);
      rigaPartita.note = note || "";
      rigaPartita.inviatoFanta = false;

      // Take a snapshot of all current fantasquadre rosters at the point of closing this match report
      const snapshot: Record<string, string[]> = {};
      if (db.fantasquadre && Array.isArray(db.fantasquadre)) {
        for (const fs of db.fantasquadre) {
          snapshot[fs.id] = [...(fs.giocatoriSelezionati || [])];
        }
      }
      rigaPartita.rosterSnapshot = snapshot;

      // Exact individual cost calculation handling remainder cents
      let paganti = 0;
      for (const r of referto) {
        if (presenti.includes(r.nome) && r.pagaQuota === true) paganti++;
      }
      
      const totaleEuro = typeof costoFinale === "string" ? parseFloat(costoFinale) : Number(costoFinale || 0);
      let baseQuota = 0;
      let remainderCents = 0;
      
      if (paganti > 0) {
        const totaleCents = Math.round(totaleEuro * 100);
        baseQuota = Math.floor(totaleCents / paganti) / 100;
        remainderCents = totaleCents % paganti;
      }
      
      let distributedCents = 0;
      for (const r of referto) {
        if (presenti.includes(r.nome) && r.pagaQuota) {
          let quotaToDeduct = baseQuota;
          if (distributedCents < remainderCents) {
            quotaToDeduct = parseFloat((quotaToDeduct + 0.01).toFixed(2));
            distributedCents++;
          }
          r.quotaMaturata = quotaToDeduct;
        } else {
          r.quotaMaturata = 0;
        }
      }

      for (const g of db.giocatori) {
        if (presenti.includes(g.nome)) {
          const dRef = referto.find((r: any) => r.nome === g.nome);
          if (dRef) {
            if (dRef.pagaQuota) {
              const q = dRef.quotaMaturata || 0;
              g.saldo = parseFloat((g.saldo - q).toFixed(2));
            }
            g.gol += Number(dRef.gol) || 0;
            g.ammonizioni += Number(dRef.amm) || 0;
            g.assist += Number(dRef.assist) || 0;
            g.espulsioni += Number(dRef.rossi) || 0;
            g.golSubitiAzione += Number(dRef.subitiAzione) || 0;
            g.golSubitiRigore += Number(dRef.subitiRigore) || 0;
            g.golSubitiPiazzato += Number(dRef.subitiPiazzato) || 0;
          }
        }
      }

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Chiusura Partita",
        importo: String(costoFinale ?? 0),
        dettagli: `Chiusa partita (${rigaPartita.dettagli}), addebitati ~${baseQuota.toFixed(2)}€ a ${paganti} giocatori.`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 16. ANNULLA PARTITA (DELETE OPEN / UPCOMING MATCH)
  app.post("/api/partite/annulla", async (req, res) => {
    try {
      const { idPartita } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);

      const match = db.partite.find(p => p.id === idPartita);
      db.partite = db.partite.filter(p => p.id !== idPartita);

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Partite",
        importo: "-",
        dettagli: `Annullata partita aperta: ${match ? match.dettagli : idPartita}`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 17. REGISTRA SPESA CONDIVISA
  app.post("/api/finanze/spesa-condivisa", async (req, res) => {
    try {
      const { importoTotale, causale, giocatoriSelezionati } = req.body;
      if (!giocatoriSelezionati || giocatoriSelezionati.length === 0) {
        return res.status(400).json({ err: "Nessun giocatore selezionato" });
      }

      const token = getAuthToken(req);
      const db = await getDb(token);
      const totaleEuro = parseFloat(importoTotale);
      const totaleCents = Math.round(totaleEuro * 100);
      const paganti = giocatoriSelezionati.length;
      
      const baseQuota = paganti > 0 ? Math.floor(totaleCents / paganti) / 100 : 0;
      const remainderCents = paganti > 0 ? totaleCents % paganti : 0;

      let distributedCents = 0;

      for (const g of db.giocatori) {
        if (giocatoriSelezionati.includes(g.nome)) {
          let quotaToDeduct = baseQuota;
          if (distributedCents < remainderCents) {
            quotaToDeduct = parseFloat((quotaToDeduct + 0.01).toFixed(2));
            distributedCents++;
          }
          g.saldo = parseFloat((g.saldo - quotaToDeduct).toFixed(2));
        }
      }

      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Spesa Condivisa",
        importo: importoTotale.toString(),
        dettagli: `Dividi spesa '${causale}' (${importoTotale}€), addebitati ~${baseQuota.toFixed(2)}€ a ${giocatoriSelezionati.length} persone`
      });

      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });

  // 18. GESTIONE BONUS E MALUS
  app.post("/api/update_bonuses", async (req, res) => {
    try {
      const { bonuses } = req.body;
      const token = getAuthToken(req);
      const db = await getDb(token);
      db.bonuses = bonuses;
      
      db.logs.push({
        data: new Date().toLocaleString("it-IT"),
        operazione: "Gestione Bonus/Malus",
        importo: "-",
        dettagli: "Aggiornato il regolamento dei Bonus e Malus nel Database."
      });
      
      await saveDb(db, token);
      sendDbResponse(res, db);
    } catch (error: any) {
      res.status(500).json({ erroreCritico: error.message });
    }
  });


  // Serve static UI assets and Vite Dev Middleware
  if (process.env.NODE_ENV !== "production") {
    const viteModule = await import("vite");
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running at HTTP host 0.0.0.0 and port ${PORT}`);
  });
}

startServer();
