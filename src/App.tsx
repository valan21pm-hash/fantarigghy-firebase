/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileText,
  Loader2,
  Sparkles,
  Trophy,
  Users,
  Lock,
  User,
  X,
  Shield,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import ActivityLog from "./components/ActivityLog";
import ArchivioMatches from "./components/ArchivioMatches";
import Convocations from "./components/Convocations";
import LineupEditor from "./components/LineupEditor";
import MatchReport from "./components/MatchReport";
import Navbar from "./components/Navbar";
import PlayerList from "./components/PlayerList";
import StatsDashboard from "./components/StatsDashboard";
import Iscrizioni from "./components/Iscrizioni";
import Fantacalcetto from "./components/Fantacalcetto";
import ConsigliRicevuti from "./components/ConsigliRicevuti";
import { DatabaseSchema, Formazione, Giocatore, RefertoGiocatore } from "./types";
import { initAuth, googleSignIn, logout } from "./lib/firebase";

export default function App() {
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainSection, setMainSection] = useState<"gare" | "club">("club");
  const [activeTab, setActiveTab] = useState<
    "rosa" | "convocazioni" | "formazione" | "referto" | "archivio" | "iscrizioni" | "fantacalcetto"
  >("rosa");
  const [isPublicPortal, setIsPublicPortal] = useState(() => {
    return typeof window !== "undefined" && window.location.search.includes("portal=true");
  });
  const [showLogsMenu, setShowLogsMenu] = useState(false);
  const [showConsigliMenu, setShowConsigliMenu] = useState(false);
  const [selectedRefertoMatchId, setSelectedRefertoMatchId] = useState<string>("");
  const [systemSA, setSystemSA] = useState<string | null>(null);
  const [dismissedSABanner, setDismissedSABanner] = useState(() => {
    return typeof window !== "undefined" && localStorage.getItem("dismissedSABanner") === "true";
  });
  const [dismissedSyncErrorBanner, setDismissedSyncErrorBanner] = useState(() => {
    return typeof window !== "undefined" && localStorage.getItem("dismissedSyncErrorBanner") === "true";
  });

  // Authentication State
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // Load initial database records
  const fetchDatabase = async (currentToken?: string | null, bypassCache: boolean = false) => {
    try {
      const activeToken = currentToken === undefined ? token : currentToken;
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers["Authorization"] = `Bearer ${activeToken}`;
      }
      const url = bypassCache ? "/api/dati?bypassCache=true" : "/api/dati";
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error("Connessione di rete fallita.");
      const json = await response.json();
      setData(json);
      
      // Also fetch service account email in background
      fetch("/api/system-info").then(r => r.json()).then(data => {
        if(data.serviceAccountEmail) setSystemSA(data.serviceAccountEmail);
      }).catch(() => {});
      
    } catch (err: any) {
      console.error("Errore caricamento dati:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Ricarica automaticamente l'app ogni 58 minuti per prevenire la scadenza del token Google (1 ora)
    // Usiamo anche visibilitychange per gestire il caso in cui il browser metta in sleep il tab
    const loadTime = Date.now();
    const intervalTime = 58 * 60 * 1000;

    const checkAndReload = () => {
      if (Date.now() - loadTime >= intervalTime) {
        window.location.reload();
      }
    };

    const interval = setInterval(checkAndReload, 60 * 1000); // Check ogni minuto invece di un timer lungo soggetto a throttling

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndReload();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      async (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        
        if (currentUser && currentToken) {
          try {
            await fetch("/api/save-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: currentToken })
            });
          } catch (e) {
            console.error("Errore salvataggio token automatico sul server:", e);
          }
        }
        await fetchDatabase(currentToken);
      },
      () => {
        setUser(null);
        setToken(null);
        fetchDatabase(null); // Fallback to local DB on server
      }
    );
    return () => unsubscribe();
  }, []);

  const isEditor = true; // Chiunque ha il link privato dell'app è amministratore e può modificare!

  const handleLogin = async () => {
    try {
      setLoading(true);
      const res = await googleSignIn();
      if (res) {
        const authorizedEmails = ["valan21pm@gmail.com", "10roby1985@gmail.com"];
        const resEmail = (res.user.email || "").toLowerCase().trim();
        if (!authorizedEmails.includes(resEmail)) {
          await logout();
          alert(`L'account Google selezionato (${resEmail}) non è autorizzato.`);
          return;
        }

        // Imposta subito lo stato utente locale così l'app si sblocca all'istante
        setUser(res.user);
        setToken(res.accessToken);

        // Salva il token a livello globale sul server
        const saveRes = await fetch("/api/save-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: res.accessToken })
        });
        if (!saveRes.ok) {
          throw new Error("Impossibile salvare il token sul server.");
        }
        
        const freshData = await saveRes.json();
        setData(freshData);
        alert("Collegamento Google Sheets attivato con successo! Sincronizzazione automatica attiva su tutti i dispositivi.");
      }
    } catch (err: any) {
      console.error("Errore collegamento Google Sheets:", err);
      alert(`Errore di collegamento: ${err.message || err.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
      setUser(null);
      setToken(null);
      await fetchDatabase(null);
    } catch (err: any) {
      console.error("Logout fallito:", err);
    } finally {
      setLoading(false);
    }
  };

  // API Call Wrapper mapping to express endpoints
  const executePostAction = async (endpoint: string, payload: Record<string, any>) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const activeToken = token;
      if (activeToken) {
        headers["Authorization"] = `Bearer ${activeToken}`;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.err || "Si è verificato un errore.");
      }
      const updatedData = await res.json();
      setData(updatedData);
      return updatedData;
    } catch (error: any) {
      alert(`Errore: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 1. Rosa Operations
  const handleAddPlayer = async (nome: string) => {
    await executePostAction("/api/giocatori", { nome });
  };

  const handleDeletePlayer = async (nome: string) => {
    await executePostAction("/api/giocatori/delete", { nome });
  };

  const handleVersaQuota = async (nome: string, importo: number) => {
    await executePostAction("/api/giocatori/versa", { nome, importo });
  };

  const handleVersaQuotaMassivo = async (ricariche: { nome: string; importo: number }[]) => {
    await executePostAction("/api/giocatori/versa-massivo", { ricariche });
  };

  const handleVersaIscrizione = async (nome: string, importo: number) => {
    await executePostAction("/api/giocatori/versa-iscrizione", { nome, importo });
  };

  const handleCambiaStatoGiocatore = async (nome: string, nuovoStato: boolean) => {
    await executePostAction("/api/giocatori/stato", { nome, nuovoStato });
  };

  const handleDisattivaTutti = async () => {
    await executePostAction("/api/giocatori/disattiva-tutti", {});
  };

  const handleEditPlayer = async (nomeOriginale: string, dati: Partial<Giocatore>) => {
    await executePostAction("/api/giocatori/modifica", { nomeOriginale, datiAggiornati: dati });
  };

  // 2. Convocazioni & Matches Operations
  const handleCreaPartita = async (
    costo: number,
    convocati: string[],
    dettagli: string,
    campo: string,
    mappaRuoli: Record<string, string>
  ) => {
    await executePostAction("/api/partite/crea", {
      costo,
      convocati,
      dettagli,
      campo,
      mappaRuoli,
    });
    // Move immediately to lineup panel
    setMainSection("gare");
    setActiveTab("formazione");
  };

  const handleSalvaFormazione = async (idPartita: string, formazione: Formazione) => {
    await executePostAction("/api/partite/formazione", { idPartita, formazione });
  };

  const handleChiudiPartita = async (
    idPartita: string,
    costoFinale: number,
    presenti: string[],
    risultato: string,
    referto: RefertoGiocatore[],
    note?: string
  ) => {
    await executePostAction("/api/partite/chiudi", {
      idPartita,
      costoFinale,
      presenti,
      risultato,
      referto,
      note,
    });
    // Move immediately to archive panel
    setMainSection("gare");
    setActiveTab("archivio");
  };

  const handleAnnullaPartita = async (idPartita: string) => {
    await executePostAction("/api/partite/annulla", { idPartita });
  };

  // 3. Historical report modifications (including proper stats rollbacks)
  const handleModificaChiusa = async (
    idPartita: string,
    dettagli: string,
    costo: number,
    risultato: string,
    referto: RefertoGiocatore[],
    note?: string
  ) => {
    await executePostAction("/api/partite/modifica-chiusa", {
      idPartita,
      dettagli,
      costo,
      risultato,
      referto,
      note,
    });
  };

  const handleRiapriPartita = async (idPartita: string, conservaDati?: boolean) => {
    await executePostAction("/api/partite/riapri", { idPartita, conservaDati });
    setSelectedRefertoMatchId(idPartita);
    setMainSection("gare");
    setActiveTab("referto");
  };

  const handleEliminaChiusa = async (idPartita: string) => {
    await executePostAction("/api/partite/elimina-chiusa", { idPartita });
  };

  const handleInviaFanta = async (idPartita: string) => {
    await executePostAction("/api/partite/invia-fanta", { idPartita });
  };

  // 4. Shared Expenses
  const handleDividiSpesa = async (importoTotale: number, causale: string, giocatoriSelezionati: string[]) => {
    await executePostAction("/api/finanze/spesa-condivisa", {
      importoTotale,
      causale,
      giocatoriSelezionati,
    });
  };

  // 5. Fantacalcetto callbacks
  const handleIscriviFantasquadra = async (nomePartecipante: string, nomeFantasquadra: string, giocatoriSelezionati: string[], pin: string, email?: string, adminBypassLock?: boolean) => {
    return await executePostAction("/api/fantasquadre/iscrivi", {
      nomePartecipante,
      nomeFantasquadra,
      giocatoriSelezionati,
      pin,
      email,
      adminBypassLock
    });
  };

  const handleEliminaFantasquadra = async (id: string) => {
    return await executePostAction("/api/fantasquadre/elimina", { id });
  };

  // 6. Consigli/Miglioramenti callbacks
  const handleCreaConsiglio = async (autore: string, testo: string) => {
    return await executePostAction("/api/consigli/crea", { autore, testo });
  };

  const handleSegnaLettoConsiglio = async (id: string) => {
    return await executePostAction("/api/consigli/segna-letto", { id });
  };

  const handleEliminaConsiglio = async (id: string) => {
    return await executePostAction("/api/consigli/elimina", { id });
  };

  if (!data && loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 text-slate-700 animate-spin mb-4" />
        <p className="text-gray-600 font-bold text-sm animate-pulse">
          Sincronizzazione dei dati con il server di gioco...
        </p>
      </div>
    );
  }

  const authorizedEmails = ["valan21pm@gmail.com", "10roby1985@gmail.com"];
  const userEmail = (user?.email || "").toLowerCase().trim();
  const isAdminAuthenticated = user && authorizedEmails.includes(userEmail);

  if (isPublicPortal) {
    const giocatori = data?.giocatori || [];
    const partiteChiuse = data?.partiteChiuse || [];
    const partiteAperte = data?.partiteAperte || [];
    return (
      <Fantacalcetto
        giocatori={giocatori}
        fantasquadre={data?.fantasquadre || []}
        partiteChiuse={partiteChiuse}
        partiteAperte={partiteAperte}
        onIscriviFantasquadra={handleIscriviFantasquadra}
        onEliminaFantasquadra={handleEliminaFantasquadra}
        onCreaConsiglio={handleCreaConsiglio}
        consigli={data?.consigli || []}
        isEditor={isEditor}
        isAdminMode={false}
        onRefreshData={() => fetchDatabase(undefined, true)}
        isGoogleSheetsSynced={data?.isGoogleSheetsSynced}
      />
    );
  }

  // ====================================================================================
  // ⚠️ ATTENZIONE: BLOCCO LOGIN PRINCIPALE INTOCCABILE
  // NON DEVE ESSERE MAI RIMOSSO O TOCCATO SENZA ESPLICITA RICHIESTA DELL'UTENTE.
  // Protegge l'accesso al gestionale tramite Google Auth (solo email autorizzate).
  // ====================================================================================
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4 sm:p-6 font-sans relative overflow-hidden">
        {/* Elementi di sfondo decorativi */}
        <div className="absolute inset-0 select-none pointer-events-none overflow-hidden opacity-20">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl"></div>
          <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"></div>
        </div>

        <div className="max-w-md w-full relative z-10 bg-slate-900/95 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-yellow-400/10 rounded-full blur-xl animate-pulse"></div>
            <div className="bg-slate-950 border border-slate-850 p-5 rounded-3xl inline-block relative">
              <Shield className="h-12 w-12 text-yellow-400 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <span className="bg-slate-850 border border-slate-800 text-yellow-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full animate-pulse">
              ACCESSO RISERVATO SQUADRA
            </span>
            <h3 className="font-extrabold text-2xl text-white uppercase tracking-tight">
              Autenticazione Richiesta
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Per accedere alla pagina principale del portale gestionale e alle sue sotto-sezioni, è necessario effettuare prima l'accesso con un account Google autorizzato.
            </p>
          </div>

          {user && (
            <div className="p-4 bg-red-950/45 border border-red-900/40 text-red-300 rounded-2xl text-[11px] leading-relaxed text-left space-y-1">
              <span className="font-black text-red-200 block">🛑 ACCESSO NEGATO</span>
              L'account collegato <strong className="font-bold text-red-200">{user.email}</strong> non risulta abilitato nell'elenco di sicurezza. Riprova con una casella email autorizzata.
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={handleLogin}
              className="w-full bg-yellow-400 hover:bg-yellow-350 active:bg-yellow-450 text-slate-950 font-black text-xs uppercase py-3.5 rounded-xl shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2 font-sans"
            >
              🔑 Accedi con Google
            </button>
            <button
              onClick={() => setIsPublicPortal(true)}
              className="w-full bg-slate-950 border border-emerald-900/50 hover:bg-slate-900 active:bg-slate-800 text-emerald-400 font-bold text-xs uppercase py-3.5 rounded-xl shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2 font-sans mt-2"
            >
              🌐 Vai al Portale Fanta-Calcetto
            </button>
          </div>

          <p className="text-[9.5px] text-slate-500 font-semibold mt-4">
            Easy Rigging © {new Date().getFullYear()} • Modulo protetto da Firebase Authentication
          </p>
        </div>
      </div>
    );
  }
  // ====================================================================================


  const giocatori = data?.giocatori || [];
  const fondoCassa = data?.fondoCassa || 0;
  const partiteAperte = data?.partiteAperte || [];
  const partiteChiuse = data?.partiteChiuse || [];
  const campi = data?.campi || [];
  const logs = data?.logs || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Sync Backdrop spinner during background writes */}
      {loading && (
        <div className="fixed inset-0 bg-black/10 select-none pointer-events-none z-50 flex items-start justify-end p-4">
          <div className="bg-slate-900 text-white rounded-lg shadow-lg py-2 px-3 flex items-center gap-2 border border-slate-700 pointer-events-auto">
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Applicazione in scrittura...</span>
          </div>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        fondoCassa={fondoCassa}
        onOpenLogs={() => setShowLogsMenu(true)}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isGoogleSheetsSynced={data?.isGoogleSheetsSynced}
        syncError={data?.syncError}
        unreadConsigliCount={data?.consigli?.filter(c => !c.letto).length || 0}
        onOpenConsigli={() => setShowConsigliMenu(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* Informazione Servizio in background */}
        {user && systemSA && !dismissedSABanner && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm text-blue-900 text-sm relative">
            <button 
              onClick={() => {
                setDismissedSABanner(true);
                localStorage.setItem("dismissedSABanner", "true");
              }}
              className="absolute top-4 right-4 text-blue-500 hover:text-blue-700 hover:bg-blue-100 p-1.5 rounded-full transition-colors cursor-pointer"
              title="Nascondi questa notifica permanentemente"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold flex items-center gap-2 text-blue-950 mb-1">
              <span className="text-lg">ℹ️</span> Sincronizzazione Permanente
            </h3>
            <p>
              Per garantire che il Fantacalcetto funzioni e comunichi con Google Sheets 24 ore su 24 (anche quando questo pannello amministrativo è chiuso o il login cade), condividi il documento Sheets ("Gestione Calcetto") con questa email di sistema come <strong className="font-bold whitespace-nowrap">Editor</strong>:
            </p>
            <div className="bg-white mt-2 p-3 font-mono text-xs border border-blue-100 rounded-lg select-all bg-white/80">
              {systemSA}
            </div>
            <p className="mt-2 text-xs opacity-90">
              Fino a quando non inserisci questo indirizzo nei permessi del foglio Google, l'app continuerà a usare la sessione passeggera del tuo account admin, che purtroppo scade ogni ora.
            </p>
          </div>
        )}

        {/* Google Sync Error Educational Banner -> Removed since data is now 24/7 on Firestore */}

        {/* Quick Podiums */}
        <StatsDashboard giocatori={giocatori} partiteChiuse={partiteChiuse} />

        {/* Segmented Control: Macro Area Toggle */}
        <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 grid grid-cols-2 max-w-xl mx-auto shadow-sm">
          <button
            onClick={() => {
              setMainSection("gare");
              setActiveTab("convocazioni");
            }}
            className={`py-2 rounded-lg font-bold text-xs uppercase tracking-wider text-center flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
              mainSection === "gare"
                ? "bg-slate-800 text-white shadow-sm font-black"
                : "text-slate-650 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Calendar className={`h-4.5 w-4.5 ${mainSection === "gare" ? "text-amber-400" : "text-slate-500"}`} />
            <span>⚽ Gare e Calendario</span>
          </button>

          <button
            onClick={() => {
              setMainSection("club");
              setActiveTab("rosa");
            }}
            className={`py-2 rounded-lg font-bold text-xs uppercase tracking-wider text-center flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
              mainSection === "club"
                ? "bg-slate-800 text-white shadow-sm font-black"
                : "text-slate-650 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Users className={`h-4.5 w-4.5 ${mainSection === "club" ? "text-amber-400" : "text-slate-500"}`} />
            <span>👥 Club e Fantacalcetto</span>
          </button>
        </div>

        {/* Tab Selection Row - Conditionally render sub-tabs based on active macro navigation */}
        <div className="bg-white border border-slate-200 p-2 rounded-xl flex flex-wrap gap-1.5 shadow-xs shrink-0 justify-center">
          {mainSection === "gare" ? (
            <>
              <button
                onClick={() => setActiveTab("convocazioni")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === "convocazioni"
                    ? "bg-slate-100 text-slate-900 border border-slate-300 shadow-3xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Calendar className="h-4 w-4 text-slate-700" /> <span>Convocazioni</span>
              </button>

              <button
                onClick={() => setActiveTab("formazione")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === "formazione"
                    ? "bg-slate-100 text-slate-900 border border-slate-300 shadow-3xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <ClipboardCheck className="h-4 w-4 text-slate-700" /> <span>Formazioni</span>
              </button>

              <button
                onClick={() => setActiveTab("referto")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs text-center flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
                  activeTab === "referto"
                    ? "bg-slate-100 text-slate-900 border border-slate-300 shadow-3xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <ClipboardList className="h-4 w-4 text-slate-700" /> <span>Inserisci Referto</span>
                {partiteAperte.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black h-4.5 w-4.5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                    {partiteAperte.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("archivio")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === "archivio"
                    ? "bg-slate-100 text-slate-900 border border-slate-300 shadow-3xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <FileText className="h-4 w-4 text-slate-700" /> <span>Archivio</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab("rosa")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === "rosa"
                    ? "bg-slate-100 text-slate-900 border border-slate-300 shadow-3xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Users className="h-4 w-4 text-slate-700" /> <span>Rosa & Cassa</span>
              </button>

              <button
                onClick={() => setActiveTab("iscrizioni")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === "iscrizioni"
                    ? "bg-slate-100 text-slate-900 border border-slate-300 shadow-3xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Trophy className="h-4 w-4 text-slate-700" /> <span>Tessere & Iscrizioni</span>
              </button>

              <button
                onClick={() => setActiveTab("fantacalcetto")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === "fantacalcetto"
                    ? "bg-slate-100 text-slate-900 border border-slate-300 shadow-3xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Fantacalcetto</span>
              </button>
            </>
          )}
        </div>

        {/* Dynamic Tab Pane Render */}
        <div className="focus-outline-none transition-all duration-300">
          {activeTab === "rosa" && (
            <PlayerList
              giocatori={giocatori}
              partiteAperte={partiteAperte}
              partiteChiuse={partiteChiuse}
              onAddPlayer={handleAddPlayer}
              onDeletePlayer={handleDeletePlayer}
              onVersaQuota={handleVersaQuota}
              onVersaQuotaMassivo={handleVersaQuotaMassivo}
              onDividiSpesa={handleDividiSpesa}
              onEditPlayer={handleEditPlayer}
              isEditor={isEditor}
            />
          )}

          {activeTab === "convocazioni" && (
            <Convocations
              giocatori={giocatori}
              campi={campi}
              onCreaPartita={handleCreaPartita}
              isEditor={isEditor}
            />
          )}

          {activeTab === "formazione" && (
            <LineupEditor
              giocatori={giocatori}
              partiteAperte={partiteAperte}
              onSalvaFormazione={handleSalvaFormazione}
              isEditor={isEditor}
            />
          )}

          {activeTab === "referto" && (
            <MatchReport
              giocatori={giocatori}
              partiteAperte={partiteAperte}
              onChiudiPartita={handleChiudiPartita}
              onAnnullaPartita={handleAnnullaPartita}
              isEditor={isEditor}
              selectedMatchId={selectedRefertoMatchId}
              onSelectMatchId={setSelectedRefertoMatchId}
            />
          )}

          {activeTab === "archivio" && (
            <ArchivioMatches
              giocatori={giocatori}
              partiteChiuse={partiteChiuse}
              onModificaChiusa={handleModificaChiusa}
              onRiapriPartita={handleRiapriPartita}
              onEliminaChiusa={handleEliminaChiusa}
              isEditor={isEditor}
              onInviaFanta={handleInviaFanta}
            />
          )}

          {activeTab === "iscrizioni" && (
            <Iscrizioni
              giocatori={giocatori}
              onVersaIscrizione={handleVersaIscrizione}
              onCambiaStatoGiocatore={handleCambiaStatoGiocatore}
              onDisattivaTutti={handleDisattivaTutti}
              isEditor={isEditor}
            />
          )}

          {activeTab === "fantacalcetto" && (
            <Fantacalcetto
              giocatori={giocatori}
              fantasquadre={data?.fantasquadre || []}
              partiteChiuse={partiteChiuse}
              partiteAperte={partiteAperte}
              onIscriviFantasquadra={handleIscriviFantasquadra}
              onEliminaFantasquadra={handleEliminaFantasquadra}
              onCreaConsiglio={handleCreaConsiglio}
              consigli={data?.consigli || []}
              isEditor={isEditor}
              isAdminMode={true}
              onRefreshData={() => fetchDatabase(undefined, true)}
              isGoogleSheetsSynced={data?.isGoogleSheetsSynced}
            />
          )}
        </div>
      </main>

      {/* Pop-up: System logs auditor */}
      {showLogsMenu && <ActivityLog logs={logs} onClose={() => setShowLogsMenu(false)} />}

      {/* Pop-up: Consigli / Miglioramenti */}
      {showConsigliMenu && (
        <ConsigliRicevuti
          consigli={data?.consigli || []}
          onSegnaLetto={handleSegnaLettoConsiglio}
          onElimina={handleEliminaConsiglio}
          onClose={() => setShowConsigliMenu(false)}
        />
      )}
    </div>
  );
}
