/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Users,
  User,
  Shield,
  Search,
  CheckCircle,
  Copy,
  Trash2,
  Calendar,
  AlertCircle,
  Trophy,
  Award,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  ExternalLink,
  Lock,
  Unlock,
  BookOpen,
  HelpCircle,
  Info,
  X,
  Download,
  Instagram,
  Share2,
  Pencil,
  BarChart3,
} from "lucide-react";
import StatsHub from "./StatsHub";
import {
  Giocatore,
  Fantasquadra,
  Partita,
  CustomBonusDef,
  getPlayerBonusKey,
  getPlayerBonusPointsForMatch,
  getPlayerBonusBreakdownForMatch,
  DEFAULT_BONUSES,
  getPlayerPriceForRoster,
  getPlayerCurrentPrice,
  getPlayerBasePrice,
  MAX_BUDGET,
  getLastName,
} from "../types";

// (Keep everything else mostly the same)
// I will place the computation variables inside the component.

import { generateMatchPdf, generateGeneralReportPdf, generatePartitaGiocatoriPdf, generatePartitaSingoloGiocatorePdf, generatePartitaSquadraPdf } from "../lib/pdfHelper";
import BonusManager from "./BonusManager";
import PodioGraficoDinamico from "./PodioGraficoDinamico";

const MercatoCountdown = ({ targetDate }: { targetDate: string }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateCountdown = () => {
      const end = new Date(targetDate).getTime();
      const now = new Date().getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("SCADUTA");
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);

      const parts = [];
      if (d > 0) parts.push(`${d}g`);
      if (d > 0 || h > 0) parts.push(`${h}h`);
      parts.push(`${m}m`);
      parts.push(`${s}s`);
      setTimeLeft(parts.join(" "));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return <span className="font-mono bg-blue-950 px-1.5 py-0.5 rounded text-blue-300 ml-2">{timeLeft}</span>;
};

interface FantacalcettoProps {
  giocatori: Giocatore[];
  fantasquadre: Fantasquadra[];
  partiteChiuse?: Partita[];
  partiteAperte?: Partita[];
  bonuses?: CustomBonusDef[];
  sessioneMercatoLibero?: boolean;
  scadenzaMercatoLibero?: string | null;
  portale1Bloccato?: boolean;
  onIscriviFantasquadra: (
    nomePartecipante: string,
    nomeFantasquadra: string,
    giocatoriSelezionati: string[],
    pin: string,
    email?: string,
  ) => Promise<any>;
  onEliminaFantasquadra: (id: string) => Promise<any>;
  onRinominaFantasquadra: (id: string, nuovoNome: string) => Promise<any>;
  onCreaConsiglio?: (autore: string, testo: string) => Promise<any>;
  onUpdateBonuses?: (bonuses: CustomBonusDef[]) => Promise<any>;
  onToggleMercatoLibero?: (attivo: boolean, scadenza?: string | null) => Promise<any>;
  onTogglePortaleBlocco?: (bloccato: boolean) => Promise<any>;
  onMigrate?: () => void;
  consigli?: any[];
  isEditor: boolean;
  isAdminMode: boolean; // false if viewing as a public portal page
  onRefreshData?: () => Promise<void>;
}

// Fantasy Point Formula constants
const GOAL_POINTS = 0;
const ASSIST_POINTS = 0;
const AMMO_POINTS = 0;
const ESPU_POINTS = 0;

export default function Fantacalcetto({
  giocatori,
  fantasquadre = [],
  partiteChiuse = [],
  partiteAperte = [],
  bonuses = DEFAULT_BONUSES,
  sessioneMercatoLibero = false,
  scadenzaMercatoLibero = null,
  portale1Bloccato = false,
  onIscriviFantasquadra,
  onEliminaFantasquadra,
  onRinominaFantasquadra,
  onCreaConsiglio,
  onUpdateBonuses,
  onToggleMercatoLibero,
  onTogglePortaleBlocco,
  consigli = [],
  isEditor,
  isAdminMode,
  onRefreshData,
}: FantacalcettoProps) {
  // Public Portal state loaders
  const isMercatoLiberoValido = React.useMemo(() => {
    // Override manuale speciale mercato libero fino a 08.06.2026 23:59
    const manualMercatoLiberoEnd = new Date("2026-06-08T23:59:00+02:00");
    if (new Date() <= manualMercatoLiberoEnd) {
      return true;
    }

    if (!sessioneMercatoLibero) return false;
    if (scadenzaMercatoLibero) {
      if (new Date(scadenzaMercatoLibero).getTime() < new Date().getTime()) {
        return false;
      }
    }
    return true;
  }, [sessioneMercatoLibero, scadenzaMercatoLibero]);

  const [activePublicTab, setActivePublicTab] = useState<
    "classifica" | "partite" | "iscrizione" | "convocazioni" | "statistiche"
  >("classifica");
  const [showPodiumAnimation, setShowPodiumAnimation] = useState(false);
  const [podiumSquadraTarget, setPodiumSquadraTarget] = useState<string>("Tutte");
  const allPartite = React.useMemo(() => {
    return [...partiteAperte, ...partiteChiuse].filter(
      (m) => !(m.dettagli || "").toLowerCase().includes("amichevole"),
    );
  }, [partiteAperte, partiteChiuse]);
  const [nomePartecipante, setNomePartecipante] = useState("");
  const [nomeFantasquadra, setNomeFantasquadra] = useState("");
  const [pin, setPin] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterConvocati, setFilterConvocati] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showInstagramPopup, setShowInstagramPopup] = useState(() => {
    return localStorage.getItem("fantaInstagramFollowed_v1") !== "true";
  });
  const [instagramLinkCopied, setInstagramLinkCopied] = useState(false);

  const [showReRegistrationPopup, setShowReRegistrationPopup] = useState(() => {
    const now = new Date();
    // Active from now (June 3rd) through the end of Friday, June 5th, 2026
    const start = new Date("2026-06-03T00:00:00Z");
    const end = new Date("2026-06-06T02:00:00Z"); // Covered through midnight of Friday June 5th in Italy (UTC+2) plus a small safety buffer
    const isPeriod = now >= start && now <= end;
    if (!isPeriod) return false;
    return localStorage.getItem("fantaReRegistrationSkipped_v1") !== "true";
  });

  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [instructionsTab, setInstructionsTab] = useState<
    "guida" | "quotazioni"
  >("guida");

  // Custom dialog state for trade summary and locking warning
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [proposedTransfer, setProposedTransfer] = useState<{
    sold: string;
    bought: string;
    soldPrice: number;
    boughtPrice: number;
    remainingCredits: number;
  } | null>(null);

  // Security Authentication states for modifying existing rosters
  const [authenticatedTeamId, setAuthenticatedTeamId] = useState<string | null>(
    null,
  );
  const [enteredPin, setEnteredPin] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Consigli / Miglioramenti states
  const [consiglioAutore, setConsiglioAutore] = useState("");
  const [consiglioTesto, setConsiglioTesto] = useState("");
  const [consiglioInviatoConSuccesso, setConsiglioInviatoConSuccesso] =
    useState(false);
  const [invioConsiglioInCorso, setInvioConsiglioInCorso] = useState(false);
  const [consiglioError, setConsiglioError] = useState("");

  // Admin state loaders
  const [copied, setCopied] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Sincronizzazione automatica alla prima interazione e portale d'ingresso con Email e Password
  const [entryMode, setEntryMode] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regNomeSquadra, setRegNomeSquadra] = useState("");
  const [regNomePresidente, setRegNomePresidente] = useState("");
  const [localLoginError, setLocalLoginError] = useState<string | null>(null);

  const [hasInteracted, setHasInteracted] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState("");
  const [syncDone, setSyncDone] = useState(false);
  const [selectedMatchBreakdown, setSelectedMatchBreakdown] =
    useState<any>(null);
  const [showMercatoModal, setShowMercatoModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [nuovoNomeSquadra, setNuovoNomeSquadra] = useState("");
  const [mercatoDateString, setMercatoDateString] = useState("");
  const [showGeneralReportModal, setShowGeneralReportModal] = useState(false);
  const [matchForPlayerChoice, setMatchForPlayerChoice] = useState<Partita | null>(null);
  const [matchForTeamChoice, setMatchForTeamChoice] = useState<Partita | null>(null);

  // Auto-login all'avvio se già registrati in localStorage
  useEffect(() => {
    const cachedEmail = localStorage.getItem("fantaEmail");
    const cachedPassword = localStorage.getItem("fantaPassword");
    if (cachedEmail && cachedPassword && fantasquadre.length > 0) {
      const team = fantasquadre.find(
        (fs) =>
          (fs.email || "").toLowerCase().trim() ===
          cachedEmail.toLowerCase().trim(),
      );
      if (team) {
        const passMatch =
          (team.pin || "").trim().toLowerCase() ===
          cachedPassword.trim().toLowerCase();
        if (passMatch) {
          // Esegui sblocco automatico istantaneo
          setAuthenticatedTeamId(team.id);
          setNomeFantasquadra(team.nomeFantasquadra);
          setNomePartecipante(team.nomePartecipante);
          setPin((team.pin || "").trim());
          setSelectedPlayers(team.giocatoriSelezionati || []);
          setSyncDone(true);
          setHasInteracted(true);
        }
      }
    }
  }, [fantasquadre]);

  const handleCustomLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLocalLoginError("Inserisci email e password!");
      return;
    }
    setLocalLoginError(null);

    // Cerca la fantasquadra associata a questa email
    const team = fantasquadre.find(
      (fs) =>
        (fs.email || "").toLowerCase().trim() ===
        loginEmail.toLowerCase().trim(),
    );
    if (!team) {
      setLocalLoginError(
        "Nessuna fantasquadra associata a questa email. Effettua la registrazione.",
      );
      return;
    }

    const passMatch =
      (team.pin || "").trim().toLowerCase() ===
      loginPassword.trim().toLowerCase();
    if (!passMatch) {
      setLocalLoginError("Password non corretta!");
      return;
    }

    // Successo login!
    setLocalLoginError(null);
    setHasInteracted(true);
    setSyncProgress(0);

    const steps = [
      { prg: 25, text: "Sincronizzazione della formazione..." },
      { prg: 70, text: "Caricamento delle rose e dei saldi..." },
      { prg: 100, text: "Accesso autorizzato!" },
    ];

    // L'operazione è gestita dal wrapper executePostAction che invia i dati atomici aggiornati

    let currentPrg = 0;
    for (const step of steps) {
      setSyncStatusText(step.text);
      const targetPrg = step.prg;
      while (currentPrg < targetPrg) {
        await new Promise((resolve) =>
          setTimeout(resolve, 8 + Math.random() * 8),
        );
        currentPrg += 1;
        setSyncProgress(currentPrg);
      }
      if (step.prg === 70 && onRefreshData) {
        await onRefreshData();
      }
    }

    // Salva le info aggiornate del team dopo la sincronizzazione
    const refreshedTeam = fantasquadre.find((fs) => fs.id === team.id) || team;
    setAuthenticatedTeamId(refreshedTeam.id);
    setNomeFantasquadra(refreshedTeam.nomeFantasquadra);
    setNomePartecipante(refreshedTeam.nomePartecipante);
    setPin((refreshedTeam.pin || "").trim());
    setSelectedPlayers(refreshedTeam.giocatoriSelezionati || []);

    // Salva in localStorage
    localStorage.setItem("fantaEmail", loginEmail.trim());
    localStorage.setItem("fantaPassword", loginPassword.trim());

    setSyncProgress(100);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setSyncDone(true);
  };

  const handleCustomRegister = async () => {
    if (
      !regEmail.trim() ||
      !regPassword.trim() ||
      !regNomeSquadra.trim() ||
      !regNomePresidente.trim()
    ) {
      setLocalLoginError("Tutti i campi sono obbligatori!");
      return;
    }
    if (regPassword.trim().length < 8) {
      setLocalLoginError("La password deve contenere almeno 8 caratteri!");
      return;
    }
    setLocalLoginError(null);

    // Controlla se email o nome squadra sono già stati presi
    const emailDuplicata = fantasquadre.find(
      (fs) =>
        (fs.email || "").toLowerCase().trim() === regEmail.toLowerCase().trim(),
    );
    const nomeDuplicato = fantasquadre.find(
      (fs) =>
        fs.nomeFantasquadra.toLowerCase().trim() ===
        regNomeSquadra.toLowerCase().trim(),
    );
    if (emailDuplicata) {
      setLocalLoginError("Questa email è già associata a una fantasquadra.");
      return;
    }
    if (nomeDuplicato) {
      setLocalLoginError("Questo nome fantasquadra è già registrato.");
      return;
    }

    setHasInteracted(true);
    setSyncProgress(0);
    setSyncStatusText("Creazione della tua fantasquadra in corso...");

    try {
      // Sottoscrizione
      const updatedData = await onIscriviFantasquadra(
        regNomePresidente.trim(),
        regNomeSquadra.trim(),
        [],
        regPassword.trim(),
        regEmail.trim().toLowerCase(),
      );

      setSyncProgress(60);
      setSyncStatusText("Finalizzazione dell'iscrizione...");

      // Cerca la squadra appena creata per autenticarsi automaticamente
      const newTeam = (updatedData?.fantasquadre || fantasquadre).find(
        (fs: any) =>
          (fs.email || "").toLowerCase().trim() ===
          regEmail.trim().toLowerCase(),
      );

      if (newTeam) {
        setAuthenticatedTeamId(newTeam.id);
        setNomeFantasquadra(newTeam.nomeFantasquadra);
        setNomePartecipante(newTeam.nomePartecipante);
        setPin((newTeam.pin || "").trim());
        setSelectedPlayers(newTeam.giocatoriSelezionati || []);
      } else {
        // Fallback locale nel caso
        setAuthenticatedTeamId("new-registered");
        setNomeFantasquadra(regNomeSquadra.trim());
        setNomePartecipante(regNomePresidente.trim());
        setPin(regPassword.trim());
        setSelectedPlayers([]);
      }

      localStorage.setItem("fantaEmail", regEmail.trim().toLowerCase());
      localStorage.setItem("fantaPassword", regPassword.trim());

      setSyncProgress(100);
      setSyncStatusText("Iscrizione completata!");
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSyncDone(true);
    } catch (err: any) {
      console.error(err);
      setLocalLoginError(
        err.message || "Impossibile completare la registrazione.",
      );
      setHasInteracted(false);
      setSyncProgress(0);
    }
  };

  const matchedTeam = fantasquadre.find(
    (fs) =>
      fs.nomeFantasquadra.toLowerCase().trim() ===
      nomeFantasquadra.toLowerCase().trim(),
  );

  const isUnlocked =
    !matchedTeam || (matchedTeam && authenticatedTeamId === matchedTeam.id);

  // Filter only active players of real roster for pool selection
  const realPlayersPool = giocatori.filter((g) => g.attivo);

  // Helper to obtain detailed championship match summaries with individual fantasy point details for a team
  const getTeamMatchBreakdownList = (team: Fantasquadra) => {
    const list: {
      matchId: string;
      dettagli: string;
      risultato: string;
      puntiTotaliMatch: number;
      giocatoriKpi: {
        nome: string;
        gol: number;
        assist: number;
        amm: number;
        rossi: number;
        bonusPts: number;
        fantaScore: number;
      }[];
    }[] = [];

    const nonAmichevoleMatches = (partiteChiuse || []).filter(
      (m) =>
        m.stato === "Chiusa" &&
        m.inviatoFanta === true &&
        !(m.dettagli || "").toLowerCase().includes("amichevole"),
    );

    for (const m of nonAmichevoleMatches) {
      if (!m.referto) continue;

      const giocatoriKpi: {
        nome: string;
        gol: number;
        assist: number;
        amm: number;
        rossi: number;
        bonusPts: number;
        fantaScore: number;
      }[] = [];
      let puntiTotaliMatch = 0;

      const roster =
        m.rosterSnapshot && m.rosterSnapshot[team.id]
          ? m.rosterSnapshot[team.id]
          : team.giocatoriSelezionati;

      // Starters: up to 3 players. Substitute (Panchinaro): 4th player.
      const starters = roster.slice(0, 3);
      const benchPlayerName = roster[3];

      const getPlayerInfo = (pName: string) => {
        const r = m.referto.find(
          (x) => x.nome.toLowerCase() === pName.toLowerCase(),
        );

        let played = false;
        if (r) {
          if (r.statoPresenza) {
            played = r.statoPresenza === "giocato";
          } else {
            // fallback for backward compatibility
            played = !!(
              r.pagaQuota ||
              r.gol > 0 ||
              r.assist > 0 ||
              r.amm > 0 ||
              r.rossi > 0 ||
              r.subitiAzione > 0 ||
              r.subitiRigore > 0 ||
              r.subitiPiazzato > 0 ||
              (r.bonusAttivi && r.bonusAttivi.length > 0)
            );
          }
        }

        const rGol = r ? Number(r.gol) || 0 : 0;
        const rAssist = r ? Number(r.assist) || 0 : 0;
        const rAmm = r ? Number(r.amm) || 0 : 0;
        const rEsp = r ? Number(r.rossi) || 0 : 0;
        const rBonusAttivi = r ? r.bonusAttivi || [] : [];

        const gInfoFallback = giocatori.find(g => g.nome.toLowerCase() === pName.toLowerCase());
        const bonusPts = r
          ? getPlayerBonusPointsForMatch(
              pName,
              rBonusAttivi,
              rGol,
              rAssist,
              bonuses,
              r.snapshotGiocatore?.ultimoRuolo || gInfoFallback?.ultimoRuolo,
              rAmm,
              rEsp
            )
          : 0;

        let bonusBreakdownStr = "";
        if (r) {
          const breakdown = getPlayerBonusBreakdownForMatch(
            pName,
            rBonusAttivi,
            rGol,
            rAssist,
            bonuses,
            r.snapshotGiocatore?.ultimoRuolo || gInfoFallback?.ultimoRuolo,
            rAmm,
            rEsp
          );
          if (breakdown.length > 0) {
            bonusBreakdownStr =
              breakdown
                .map(
                  (b) =>
                    `${b.nome} (${b.puntiVal > 0 ? "+" : ""}${b.puntiVal})`,
                )
                .join(", ") + ` [Tot: ${bonusPts > 0 ? "+" : ""}${bonusPts}]`;
          }
        }

        const fantaScore = r
          ? parseFloat(
              (
                rGol * GOAL_POINTS +
                rAssist * ASSIST_POINTS +
                rAmm * AMMO_POINTS +
                rEsp * ESPU_POINTS +
                bonusPts
              ).toFixed(1),
            )
          : 0;

        return {
          nome: pName,
          gol: rGol,
          assist: rAssist,
          amm: rAmm,
          rossi: rEsp,
          bonusPts,
          bonusBreakdownStr,
          fantaScore,
          played: !!played,
        };
      };

      const startersInfo = starters.map((p) => getPlayerInfo(p));
      const benchInfo = benchPlayerName ? getPlayerInfo(benchPlayerName) : null;

      let subbedIn = false;
      const finalKpiList: any[] = [];

      for (let i = 0; i < startersInfo.length; i++) {
        const inf = startersInfo[i];
        if (!inf.played && benchInfo && benchInfo.played && !subbedIn) {
          // Starter did not play, substitute is available, performs substitution!
          subbedIn = true;
          finalKpiList.push({
            ...inf,
            ruolo: "Titolare",
            stato: "Sostituito",
            puntiConteggiati: inf.fantaScore,
          });
          puntiTotaliMatch += inf.fantaScore;
        } else {
          finalKpiList.push({
            ...inf,
            ruolo: "Titolare",
            stato: inf.played ? "Titolare" : "Assente",
            puntiConteggiati: inf.fantaScore,
          });
          puntiTotaliMatch += inf.fantaScore;
        }
      }

      if (benchInfo) {
        if (subbedIn) {
          finalKpiList.push({
            ...benchInfo,
            ruolo: "Panchina",
            stato: "Subentrato",
            puntiConteggiati: benchInfo.fantaScore,
          });
          puntiTotaliMatch += benchInfo.fantaScore;
        } else {
          finalKpiList.push({
            ...benchInfo,
            ruolo: "Panchina",
            stato: "Panchina",
            puntiConteggiati: benchInfo.bonusPts,
          });
          puntiTotaliMatch += benchInfo.bonusPts;
        }
      }

      puntiTotaliMatch = parseFloat(puntiTotaliMatch.toFixed(1));
      giocatoriKpi.push(...finalKpiList);

      list.push({
        matchId: m.id,
        dettagli: m.dettagli,
        risultato: m.risultato || "N.D.",
        puntiTotaliMatch: parseFloat(puntiTotaliMatch.toFixed(1)),
        giocatoriKpi,
      });
    }

    return list;
  };

  // Helper to parse "25/05/2026 21:00, Seminario" into Date
  const parseMatchDate = (dettagli: string): Date | null => {
    if (!dettagli) return null;
    const regex = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})[:.](\d{2})/;
    const match = dettagli.match(regex);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      const hour = parseInt(match[4], 10);
      const minute = parseInt(match[5], 10);
      return new Date(year, month, day, hour, minute);
    }
    return null;
  };

  const checkChampionshipLockStatus = () => {
    const openMatches = partiteAperte || [];
    const campMatches = openMatches.filter(
      (m) => !(m.dettagli || "").toLowerCase().includes("amichevole"),
    );
    const now = new Date();

    for (const m of campMatches) {
      const matchTime = parseMatchDate(m.dettagli);
      if (matchTime) {
        const lockoutTime = matchTime.getTime() - 60 * 60 * 1000; // 1 hour before
        if (now.getTime() >= lockoutTime) {
          return {
            isLocked: true,
            match: m,
            matchTime,
            deadline: new Date(lockoutTime),
            timeLeftString: "",
          };
        }
      }
    }

    // Also look for the most imminent future championship match
    let closestMatch: Partita | null = null;
    let closestTime = Infinity;

    for (const m of campMatches) {
      const matchTime = parseMatchDate(m.dettagli);
      if (matchTime) {
        const t = matchTime.getTime();
        if (t > now.getTime() && t < closestTime) {
          closestTime = t;
          closestMatch = m;
        }
      }
    }

    if (closestMatch) {
      const mTime = parseMatchDate(closestMatch.dettagli);
      if (mTime) {
        const deadline = new Date(mTime.getTime() - 60 * 60 * 1000);
        // Time left string
        const diffMs = deadline.getTime() - now.getTime();
        let timeLeftString = "";
        if (diffMs > 0) {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          timeLeftString = `${hours}h ${minutes}m`;
        }
        return {
          isLocked: false,
          match: closestMatch,
          matchTime: mTime,
          deadline,
          timeLeftString,
        };
      }
    }

    return {
      isLocked: false,
      match: null,
      matchTime: null,
      deadline: null,
      timeLeftString: "",
    };
  };

  const _actualLockStatus = checkChampionshipLockStatus();
  const lockStatus = {
    ..._actualLockStatus,
  };

  // Handle verification and login of an existing team
  const handleUnlockTeam = () => {
    if (!enteredPin.trim()) {
      setLoginError("Inserisci il codice PIN della tua squadra!");
      return;
    }
    const team = fantasquadre.find(
      (fs) =>
        fs.nomeFantasquadra.toLowerCase().trim() ===
        nomeFantasquadra.toLowerCase().trim(),
    );
    if (team) {
      if (team.pin && team.pin.trim() !== enteredPin.trim()) {
        setLoginError(
          "PIN Errato! Inserisci il codice corretto per questa squadra.",
        );
        return;
      }
      // PIN matched!
      setAuthenticatedTeamId(team.id);
      setSelectedPlayers(team.giocatoriSelezionati || []);
      setNomePartecipante(team.nomePartecipante);
      setPin(enteredPin.trim());
      setLoginError(null);
    }
  };

  // Handle Player select toggle
  const handleTogglePlayer = (nome: string) => {
    if (lockStatus.isLocked) {
      alert(
        "Operazione non consentita: le formazioni sono attualmente bloccate per l'imminente turno di campionato.",
      );
      return;
    }

    const selectedTeam = fantasquadre.find(
      (fs) =>
        fs.nomeFantasquadra.toLowerCase().trim() ===
        nomeFantasquadra.toLowerCase().trim(),
    );
    const economyPrevPlayers = selectedTeam
      ? selectedTeam.giocatoriSelezionati || []
      : [];
    const rulePrevPlayers = selectedTeam
      ? selectedTeam.rosaOriginaria || selectedTeam.giocatoriSelezionati || []
      : [];

    if (selectedTeam && economyPrevPlayers.length === 4) {
      // Modify existing roster check: MUST be authenticated!
      if (authenticatedTeamId !== selectedTeam.id) {
        alert(
          "Devi sbloccare la tua squadra con il PIN per poter modificare la formazione.",
        );
        return;
      }

      const isLegacy = !selectedTeam.valoriAcquisto;

      let teamValoriAcquisto = selectedTeam.valoriAcquisto || {};
      let teamCreditoResiduo = selectedTeam.creditoResiduo ?? 0;

      if (isLegacy) {
        teamValoriAcquisto = {};
        let totalCost = 0;
        economyPrevPlayers.forEach((pName) => {
          const ip = getPlayerPriceForRoster(
            pName,
            partiteChiuse || [],
            bonuses,
          );
          teamValoriAcquisto[pName] = ip;
          totalCost += ip;
        });
        teamCreditoResiduo = Math.max(0, MAX_BUDGET - totalCost);
      }

      // If deselecting a player:
      if (selectedPlayers.includes(nome)) {
        const nextPlayers = selectedPlayers.filter((p) => p !== nome);

        const keptFromOrigin = rulePrevPlayers.filter((p) =>
          nextPlayers.includes(p),
        );

        // Allow temporary 1+ deselections for exploration, will validate on Save.
        setSelectedPlayers(nextPlayers);
      } else {
        // If selecting a new player:
        if (selectedPlayers.length >= 4) {
          alert(
            "Hai già selezionato il numero massimo di 4 giocatori per la tua rosa! Rimuovine uno prima.",
          );
          return;
        }

        const nextPlayers = [...selectedPlayers, nome];
        const keptFromOrigin = rulePrevPlayers.filter((p) =>
          nextPlayers.includes(p),
        );

        // Allow temporary 1+ selections for exploration, will validate on Save.

        // Budget check with the new player added
        let soldPrice = 0;
        let boughtPrice = 0;

        const sold = economyPrevPlayers.filter((p) => !nextPlayers.includes(p));
        const bought = nextPlayers.filter(
          (p) => !economyPrevPlayers.includes(p),
        );

        sold.forEach((p) => {
          soldPrice += getPlayerPriceForRoster(p, partiteChiuse || [], bonuses);
        });
        bought.forEach((p) => {
          boughtPrice += getPlayerPriceForRoster(
            p,
            partiteChiuse || [],
            bonuses,
          );
        });

        const finalCredits = teamCreditoResiduo + soldPrice - boughtPrice;
        if (finalCredits < 0) {
          alert(
            `Credito non sufficiente! Ti costerebbe troppo di mercato: sforeresti di ${Math.abs(finalCredits)} Izycoin.`,
          );
          return;
        }

        setSelectedPlayers(nextPlayers);
      }
    } else {
      // New Team Enrollment flow or composing first-time roster (just keep max 4 players)
      if (selectedTeam && authenticatedTeamId !== selectedTeam.id) {
        alert(
          "Devi sbloccare la tua squadra con il PIN per poter completare la formazione.",
        );
        return;
      }

      if (selectedPlayers.includes(nome)) {
        setSelectedPlayers(selectedPlayers.filter((p) => p !== nome));
      } else {
        if (selectedPlayers.length >= 4) {
          alert(
            "Hai già selezionato il numero massimo di 4 giocatori per la tua rosa!",
          );
          return;
        }
        const nextPlayers = [...selectedPlayers, nome];
        // Check budget constraint for a new registration (max 60)
        let totalCost = 0;
        nextPlayers.forEach((pName) => {
          totalCost += getPlayerPriceForRoster(
            pName,
            partiteChiuse || [],
            bonuses,
          );
        });
        if (totalCost > MAX_BUDGET) {
          alert(
            `Sfora il budget! La rosa scelta sforerebbe il tetto di ${MAX_BUDGET} Izycoin (costerebbe ${totalCost} Izycoin).`,
          );
          return;
        }
        setSelectedPlayers(nextPlayers);
      }
    }
  };

  // Submit Registration logic
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (lockStatus.isLocked) {
      setErrorMsg(
        "Impossibile procedere: le iscrizioni e variazioni sono bloccate per l'imminente turno di campionato.",
      );
      return;
    }

    // Validate inputs
    if (!nomePartecipante.trim()) {
      setErrorMsg("Inserisci il tuo nome e cognome.");
      return;
    }
    if (!nomeFantasquadra.trim()) {
      setErrorMsg("Scegli un nome originale per la tua Fantasquadra.");
      return;
    }
    if (selectedPlayers.length === 0) {
      setErrorMsg("Seleziona i giocatori per comporre il tuo roster!");
      return;
    }
    if (selectedPlayers.length < 4) {
      setErrorMsg(
        `Devi selezionare esattamente 4 giocatori per la tua rosa (3 titolari e 1 panchinaro). Attualmente ne hai selezionati ${selectedPlayers.length}.`,
      );
      return;
    }
    if (selectedPlayers.length > 4) {
      setErrorMsg(
        `Puoi selezionare al massimo 4 giocatori. Attualmente ne hai selezionati ${selectedPlayers.length}.`,
      );
      return;
    }

    const trimmedPin = (pin ? pin.trim() : "") || "12345678";

    // Real-time market / budget & change limit validation
    const matchedTeam = fantasquadre.find(
      (fs) =>
        fs.nomeFantasquadra.toLowerCase().trim() ===
        nomeFantasquadra.toLowerCase().trim(),
    );

    if (!matchedTeam || (matchedTeam.giocatoriSelezionati || []).length < 4) {
      // NEW SQUAD CHECK
      let totalCost = 0;
      selectedPlayers.forEach((pName) => {
        totalCost += getPlayerPriceForRoster(
          pName,
          partiteChiuse || [],
          bonuses,
        );
      });
      if (totalCost > MAX_BUDGET) {
        setErrorMsg(
          `Il costo totale della rosa scelto (${totalCost} pinne 🐟) supera il limite consentito di ${MAX_BUDGET} pinne 🐟!`,
        );
        return;
      }
    } else {
      // MODIFYING EXISTING SQUAD
      const economyPrevPlayers = matchedTeam.giocatoriSelezionati || [];
      const rulePrevPlayers =
        matchedTeam.rosaOriginaria || matchedTeam.giocatoriSelezionati || [];

      const isLegacy = !matchedTeam.valoriAcquisto;

      let teamValoriAcquisto = matchedTeam.valoriAcquisto || {};
      let teamCreditoResiduo = matchedTeam.creditoResiduo ?? 0;

      if (isLegacy) {
        teamValoriAcquisto = {};
        let totalCost = 0;
        economyPrevPlayers.forEach((pName) => {
          const ip = getPlayerPriceForRoster(
            pName,
            partiteChiuse || [],
            bonuses,
          );
          teamValoriAcquisto[pName] = ip;
          totalCost += ip;
        });
        teamCreditoResiduo = Math.max(0, MAX_BUDGET - totalCost);
      }

      if (economyPrevPlayers.length === 4) {
        const keptFromOrigin = rulePrevPlayers.filter((p) =>
          selectedPlayers.includes(p),
        );
        const numChangesFromOrigin =
          rulePrevPlayers.length - keptFromOrigin.length;

        if (!isMercatoLiberoValido && numChangesFromOrigin > 1) {
          setErrorMsg(
            `Errore di mercato: puoi effettuare al massimo 1 cambio rispetto alla tua rosa originaria post-partita! (A meno di Sessione Speciale)`,
          );
          return;
        }

        const soldPlayers = economyPrevPlayers.filter(
          (p) => !selectedPlayers.includes(p),
        );
        const boughtPlayers = selectedPlayers.filter(
          (p) => !economyPrevPlayers.includes(p),
        );

        let soldPrice = 0;
        let boughtPrice = 0;

        soldPlayers.forEach((pName) => {
          soldPrice += getPlayerPriceForRoster(pName, partiteChiuse || [], bonuses);
        });

        boughtPlayers.forEach((pName) => {
          boughtPrice += getPlayerPriceForRoster(pName, partiteChiuse || [], bonuses);
        });

        const finalCredits = teamCreditoResiduo + soldPrice - boughtPrice;
        if (finalCredits < 0) {
          setErrorMsg(
            `Credito non sufficiente per l'operazione! Hai a disposizione ${teamCreditoResiduo} Izycoin residui. Cedendo ottenieni ${soldPrice} Izycoin, ma gli acquisti costano ${boughtPrice} Izycoin. Ti mancano ${Math.abs(finalCredits)} Izycoin.`,
          );
          return;
        }

        // Interrupt with confirmation popup
        if (
          soldPlayers.length > 0 &&
          boughtPlayers.length > 0 &&
          !showConfirmModal
        ) {
          setProposedTransfer({
            sold: soldPlayers.join(", "),
            bought: boughtPlayers.join(", "),
            soldPrice: soldPrice,
            boughtPrice: boughtPrice,
            remainingCredits: finalCredits,
          });
          setShowConfirmModal(true);
          return;
        }
      } else {
        // Initial composing from empty state (from 0 to 4 players)
        let totalCost = 0;
        selectedPlayers.forEach((pName) => {
          totalCost += getPlayerPriceForRoster(
            pName,
            partiteChiuse || [],
            bonuses,
          );
        });
        if (totalCost > MAX_BUDGET) {
          setErrorMsg(
            `Il costo totale della rosa scelto (${totalCost} Izycoin) supera il limite consentito di ${MAX_BUDGET} Izycoin!`,
          );
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const result = await onIscriviFantasquadra(
        nomePartecipante,
        nomeFantasquadra,
        selectedPlayers,
        trimmedPin,
        undefined,
      );
      setSubmitted(true);
      window.location.reload();
    } catch (err: any) {
      setErrorMsg(err.message || "Errore sconosciuto di convalida server.");
    } finally {
      setSubmitting(false);
    }
  };

  const executeRosterUpdate = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const trimmedPin = (pin ? pin.trim() : "") || "12345678";
      await onIscriviFantasquadra(
        nomePartecipante,
        nomeFantasquadra,
        selectedPlayers,
        trimmedPin,
        undefined,
      );
      setSubmitted(true);
      alert(
        "Operazione completata con successo! La formazione è stata modificata e il mercato è bloccato fino al termine del prossimo turno.",
      );
      window.location.reload();
    } catch (err: any) {
      setErrorMsg(err.message || "Errore sconosciuto di convalida server.");
    } finally {
      setSubmitting(false);
    }
  };

  // Copy private recruitment portal link
  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}${window.location.pathname}?portal=true`;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2500);
  };

  // Calculations of scores for each team (only Championship matches count!)
  const getPlayerStatsObj = (nome: string) => {
    // League Stats (Campionato)
    let campGol = 0;
    let campAssist = 0;
    let campAmm = 0;
    let campEsp = 0;
    let campBonusPts = 0;

    // Friendly Stats (Amichevoli)
    let amichGol = 0;
    let amichAssist = 0;
    let amichAmm = 0;
    let amichEsp = 0;
    let amichBonusPts = 0;

    const activeBonusDetails: {
      bName: string;
      bDesc: string;
      pts: number;
      matchDettagli: string;
    }[] = [];

    if (partiteChiuse && partiteChiuse.length > 0) {
      for (const m of partiteChiuse) {
        const isAmichevole = m.dettagli
          ? m.dettagli.toLowerCase().includes("amichevole")
          : false;
        if (m.referto) {
          const r = m.referto.find(
            (x) => x.nome.toLowerCase() === nome.toLowerCase(),
          );
          if (r) {
            const rGol = Number(r.gol) || 0;
            const rAssist = Number(r.assist) || 0;
            const rAmm = Number(r.amm) || 0;
            const rEsp = Number(r.rossi) || 0;
            const rBonusAttivi = r.bonusAttivi || [];

            const gInfo = giocatori.find(g => g.nome.toLowerCase() === nome.toLowerCase());
            const matchBonusPts = getPlayerBonusPointsForMatch(
              nome,
              rBonusAttivi,
              rGol,
              rAssist,
              bonuses,
              r.snapshotGiocatore?.ultimoRuolo || gInfo?.ultimoRuolo,
              rAmm,
              rEsp
            );

            if (isAmichevole || m.inviatoFanta === true) {
              const breakdown = getPlayerBonusBreakdownForMatch(
                nome,
                rBonusAttivi,
                rGol,
                rAssist,
                bonuses,
                r.snapshotGiocatore?.ultimoRuolo || gInfo?.ultimoRuolo,
                rAmm,
                rEsp
              );
              breakdown.forEach(b => {
                const foundBonusDef = bonuses.find(def => def.nome === b.nome);
                activeBonusDetails.push({
                   bName: b.nome,
                   bDesc: foundBonusDef ? foundBonusDef.descrizione : "",
                   pts: b.puntiVal,
                   matchDettagli: m.dettagli
                });
              });
            }

            if (isAmichevole) {
              amichGol += rGol;
              amichAssist += rAssist;
              amichAmm += rAmm;
              amichEsp += rEsp;
              amichBonusPts += matchBonusPts;
            } else if (m.inviatoFanta === true) {
              campGol += rGol;
              campAssist += rAssist;
              campAmm += rAmm;
              campEsp += rEsp;
              campBonusPts += matchBonusPts;
            }
          }
        }
      }
    } else {
      // Fallback: if matches are unavailable, read the default properties as Campionato baseline
      const realIdx = giocatori.find(
        (g) => g.nome.toLowerCase() === nome.toLowerCase(),
      );
      if (realIdx) {
        campGol = realIdx.gol || 0;
        campAssist = realIdx.assist || 0;
        campAmm = realIdx.ammonizioni || 0;
        campEsp = realIdx.espulsioni || 0;
      }
    }

    const fantaScore = parseFloat(
      (
        campGol * GOAL_POINTS +
        campAssist * ASSIST_POINTS +
        campAmm * AMMO_POINTS +
        campEsp * ESPU_POINTS +
        campBonusPts
      ).toFixed(1),
    );
    const amichFantaScore = parseFloat(
      (
        amichGol * GOAL_POINTS +
        amichAssist * ASSIST_POINTS +
        amichAmm * AMMO_POINTS +
        amichEsp * ESPU_POINTS +
        amichBonusPts
      ).toFixed(1),
    );

    return {
      gol: campGol,
      assist: campAssist,
      ammonizioni: campAmm,
      espulsioni: campEsp,
      fantaScore,
      campBonusPts,
      amichBonusPts,
      activeBonusDetails,
      campionato: {
        gol: campGol,
        assist: campAssist,
        ammonizioni: campAmm,
        espulsioni: campEsp,
        fantaScore,
        bonusPts: campBonusPts,
      },
      amichevole: {
        gol: amichGol,
        assist: amichAssist,
        ammonizioni: amichAmm,
        espulsioni: amichEsp,
        fantaScore: amichFantaScore,
        bonusPts: amichBonusPts,
      },
    };
  };

  const calculateTeamScore = (team: Fantasquadra) => {
    const list = getTeamMatchBreakdownList(team);
    const tot = list.reduce((acc, m) => acc + (m.puntiTotaliMatch || 0), 0);
    return parseFloat(tot.toFixed(1));
  };

  // Sort fantasy teams based on performance
  const rankedTeams = [...fantasquadre]
    .map((team) => ({
      ...team,
      score: calculateTeamScore(team),
    }))
    .sort((a, b) => b.score - a.score);

  // Search filter pool supporting Convocati filtering
  const currentConvocati = lockStatus.match?.convocati || [];
  const filteredPool = realPlayersPool.filter((player) => {
    const matchesSearch = player.nome
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    if (filterConvocati && currentConvocati.length > 0) {
      return (
        matchesSearch &&
        currentConvocati.some(
          (name) =>
            name.toLowerCase().trim() === player.nome.toLowerCase().trim(),
        )
      );
    }
    return matchesSearch;
  });

  const marketValuations = React.useMemo(() => {
    return [...realPlayersPool]
      .map((p) => ({
        ...p,
        price: getPlayerPriceForRoster(p.nome, partiteChiuse || [], bonuses),
      }))
      .sort((a, b) => b.price - a.price);
  }, [realPlayersPool, partiteChiuse]);

  // -------------------------------------------------------------
  // VIEW RENDER 1: PUBLIC REGISTRATION PORTAL
  // -------------------------------------------------------------
  if (!isAdminMode) {
    if (submitted) {
      return (
        <div className="min-h-screen bg-emerald-990 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-emerald-950 border border-emerald-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl animate-fade-in font-sans">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30 font-sans">
              <CheckCircle className="h-10 w-10 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-yellow-300 uppercase tracking-widest font-sans">
                SQUADRA REGISTRATA!
              </h2>
              <p className="text-sm text-emerald-300 font-sans">
                La tua fantasquadra per{" "}
                <strong className="font-extrabold text-white font-sans">
                  {nomeFantasquadra}
                </strong>{" "}
                è stata salvata con successo.
              </p>
            </div>

            <div className="bg-emerald-900/50 border border-emerald-800/60 rounded-2xl p-4 text-left max-h-56 overflow-y-auto space-y-2">
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 font-sans font-sans">
                La tua rosa selezionata:
              </p>
              <ol className="list-decimal list-inside text-xs font-semibold text-gray-200 space-y-1 font-sans">
                {selectedPlayers.map((player, idx) => (
                  <li
                    key={idx}
                    className="truncate border-b border-emerald-950/40 pb-1"
                  >
                    {player}
                  </li>
                ))}
              </ol>
            </div>

            <p className="text-xs text-emerald-400/80 leading-relaxed bg-emerald-900/20 py-2.5 px-4 rounded-xl font-sans">
              I tuoi dati sono stati trasmessi agli amministratori. In bocca al
              lupo! ⚽🚀
            </p>

            <button
              onClick={() => {
                setSubmitted(false);
                setSelectedPlayers([]);
                setNomePartecipante("");
                setNomeFantasquadra("");
                setPin("");
                setActivePublicTab("classifica");
              }}
              className="w-full bg-yellow-400 hover:bg-yellow-350 text-emerald-950 font-extrabold text-xs uppercase py-3 rounded-xl shadow-md transition-all cursor-pointer font-sans"
            >
              Vedi la Classifica Generale
            </button>
          </div>
        </div>
      );
    }

    if (!syncDone) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-emerald-990 text-white flex flex-col justify-center items-center p-4 sm:p-6 font-sans relative overflow-hidden">
          {/* Sfondo decorativo minimale */}
          <div className="absolute inset-0 select-none pointer-events-none overflow-hidden opacity-20">
            <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"></div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl"></div>
          </div>

          <div className="max-w-md w-full relative z-10 bg-emerald-950/90 border border-emerald-850 rounded-3xl p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl">
            <div className="space-y-1.5">
              <h2 className="font-extrabold text-2xl text-white uppercase tracking-tight font-sans leading-tight pointer-events-none">
                Vai a Fantacalcetto
              </h2>
            </div>

            {!hasInteracted ? (
              <div className="space-y-4">
                {/* Selettore Tab Login / Registrazione */}
                <div className="grid grid-cols-2 p-1 bg-emerald-900/60 rounded-xl border border-emerald-800/40">
                  <button
                    type="button"
                    onClick={() => {
                      setEntryMode("login");
                      setLocalLoginError(null);
                    }}
                    className={`py-2 px-3 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${
                      entryMode === "login"
                        ? "bg-yellow-400 text-emerald-950 shadow-sm"
                        : "text-emerald-300 hover:text-white"
                    }`}
                  >
                    Entra
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEntryMode("register");
                      setLocalLoginError(null);
                    }}
                    className={`py-2 px-3 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${
                      entryMode === "register"
                        ? "bg-yellow-400 text-emerald-950 shadow-sm"
                        : "text-emerald-300 hover:text-white"
                    }`}
                  >
                    Registrati
                  </button>
                </div>

                {entryMode === "login" ? (
                  <div className="space-y-3.5 text-left animate-fadeIn">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-350 block">
                        Indirizzo Email:
                      </label>
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="latuaemail@esempio.com"
                        value={loginEmail}
                        onChange={(e) => {
                          setLoginEmail(e.target.value);
                          setLocalLoginError(null);
                        }}
                        className="w-full bg-emerald-900 border border-emerald-800/70 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-350 block">
                        Password:
                      </label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Inserisci la password"
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          setLocalLoginError(null);
                        }}
                        className="w-full bg-emerald-900 border border-emerald-800/70 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400"
                      />
                    </div>

                    {localLoginError && (
                      <div className="bg-red-950/40 border border-red-900/40 text-red-200 text-[11px] p-3 rounded-xl font-semibold leading-relaxed animate-fadeIn">
                        ⚠️ {localLoginError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCustomLogin}
                      className="w-full bg-yellow-400 hover:bg-yellow-350 active:bg-yellow-450 text-emerald-950 font-black text-xs uppercase py-3.5 rounded-xl shadow-lg transition-all cursor-pointer font-sans tracking-wide mt-2"
                    >
                      Entra
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 text-left animate-fadeIn">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-350 block">
                        Nome Fantasquadra:
                      </label>
                      <input
                        type="text"
                        placeholder="Es. Real Madrink"
                        value={regNomeSquadra}
                        onChange={(e) => {
                          setRegNomeSquadra(e.target.value);
                          setLocalLoginError(null);
                        }}
                        className="w-full bg-emerald-900 border border-emerald-800/70 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-350 block">
                          Presidente:
                        </label>
                        <input
                          type="text"
                          placeholder="Es. Mario Rossi"
                          value={regNomePresidente}
                          onChange={(e) => {
                            setRegNomePresidente(e.target.value);
                            setLocalLoginError(null);
                          }}
                          className="w-full bg-emerald-900 border border-emerald-800/70 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-350 block">
                          Password (min. 8):
                        </label>
                        <input
                          type="password"
                          placeholder="Scegli password"
                          value={regPassword}
                          onChange={(e) => {
                            setRegPassword(e.target.value);
                            setLocalLoginError(null);
                          }}
                          className="w-full bg-emerald-900 border border-emerald-800/70 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-350 block">
                        Indirizzo Email:
                      </label>
                      <input
                        type="email"
                        placeholder="mario.rossi@email.com"
                        value={regEmail}
                        onChange={(e) => {
                          setRegEmail(e.target.value);
                          setLocalLoginError(null);
                        }}
                        className="w-full bg-emerald-900 border border-emerald-800/70 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      />
                    </div>

                    {localLoginError && (
                      <div className="bg-red-950/40 border border-red-900/40 text-red-200 text-[11px] p-3 rounded-xl font-semibold leading-relaxed animate-fadeIn">
                        ⚠️ {localLoginError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCustomRegister}
                      className="w-full bg-yellow-400 hover:bg-yellow-350 active:bg-yellow-450 text-emerald-950 font-black text-xs uppercase py-3.5 rounded-xl shadow-lg transition-all cursor-pointer font-sans tracking-wide mt-2"
                    >
                      Registrati ed Entra
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-2 space-y-4 animate-fadeIn">
                {/* Barra di avanzamento */}
                <div className="w-full bg-emerald-950 border border-emerald-900/55 rounded-full h-4 overflow-hidden relative shadow-inner">
                  <div
                    className="bg-gradient-to-r from-yellow-400 to-amber-400 h-full rounded-full transition-all duration-150 ease-out flex items-center justify-end px-1.5 animate-pulse"
                    style={{ width: `${syncProgress}%` }}
                  >
                    {syncProgress > 15 && (
                      <span className="text-[8px] font-black text-emerald-950 select-none">
                        {syncProgress}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Testo stato sincronizzazione */}
                <div className="space-y-1">
                  <p className="text-[11px] text-emerald-100 font-bold italic font-sans min-h-[32px] flex items-center justify-center leading-relaxed">
                    ⚙️ {syncStatusText}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-emerald-990 text-white p-4 sm:p-6 lg:p-8 flex flex-col justify-between font-sans relative">
        {showReRegistrationPopup && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-[9995] animate-fade-in font-sans">
            <div className="bg-emerald-950 border-2 border-red-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4 text-left">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/30">
                <Sparkles className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-black text-rose-400 uppercase tracking-widest leading-snug">
                  📢 RESET DATABASE SQUADRE!
                </h3>
                <p className="text-[12px] text-emerald-100 font-semibold leading-relaxed">
                  Ciao Presidente! A causa del nuovo importante aggiornamento
                  della piattaforma (che introduce il{" "}
                  <strong>4° giocatore obbligatorio</strong>, il nuovo calcolo
                  flessibile del valore dei giocatori e l'email/PIN
                  obbligatori),{" "}
                  <strong>
                    tutte le vecchie squadre esistenti sono state
                    definitivamente eliminate
                  </strong>{" "}
                  dal database.
                </p>
                <div className="bg-emerald-900/30 border border-emerald-800/40 rounded-2xl p-4.5 space-y-1.5 text-[11px] text-emerald-250 leading-relaxed font-sans">
                  <p>
                    • <strong>Nessun Import:</strong> Le vecchie squadre non
                    sono più compatibili. Per partecipare al torneo, ogni
                    Presidente deve effettuare una{" "}
                    <strong>nuova iscrizione da zero</strong>.
                  </p>
                  <p>
                    • <strong>Nuova Formula:</strong> Crea subito la tua
                    formazione con esattamente{" "}
                    <strong>3 Titolari + 1 Panchinaro</strong> rispettando il
                    budget massimo di 60 Izycoin!
                  </p>
                </div>
                <p className="text-[10px] text-amber-300 border-t border-emerald-800/30 pt-2 font-semibold leading-normal">
                  Se hai già provveduto a registrare la tua nuova fanta-squadra
                  a 4 giocatori dopo questo aggiornamento, ignora pure questo
                  avviso.
                </p>
              </div>
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReRegistrationPopup(false);
                    localStorage.setItem(
                      "fantaReRegistrationSkipped_v1",
                      "true",
                    );
                    setActivePublicTab("iscrizione");
                    setSubmitted(false);
                  }}
                  className="w-full bg-yellow-400 hover:bg-yellow-350 active:bg-yellow-450 text-emerald-950 font-black text-xs uppercase py-3 rounded-xl transition-all cursor-pointer shadow-md text-center"
                >
                  Vai all'Iscrizione/Registrazione ⚽
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReRegistrationPopup(false);
                    localStorage.setItem(
                      "fantaReRegistrationSkipped_v1",
                      "true",
                    );
                  }}
                  className="w-full bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 font-bold text-xs uppercase py-2.5 rounded-xl transition-all cursor-pointer border border-emerald-800/40 text-center"
                >
                  Salta, ho già provveduto / Nuova iscrizione 👍
                </button>
              </div>
            </div>
          </div>
        )}
        {showInstagramPopup && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[9990] animate-fade-in">
            <div className="bg-gradient-to-b from-purple-950 via-emerald-950/95 to-emerald-990 border border-pink-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4 text-center">
              <button
                type="button"
                onClick={() => setShowInstagramPopup(false)}
                className="absolute top-4 right-4 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors cursor-pointer"
                title="Chiudi"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-tr from-pink-600 via-red-500 to-yellow-500 text-white flex items-center justify-center border border-white/20 shadow-lg animate-bounce">
                <Instagram className="h-7 w-7" />
              </div>

              <div className="space-y-1.5 font-sans">
                <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-300 to-yellow-300 uppercase tracking-widest leading-snug">
                  Unisciti alla Community! 🚀
                </h3>
                <p className="text-[12px] text-emerald-100 font-semibold leading-relaxed">
                  Per non perderti gli <strong>highlight</strong> delle partite, le foto sul campo più belle, notizie calde, le pagelle interattive dei nostri tesserati e i meme più esilaranti, segui la pagina ufficiale di <strong>EasyRigging C5</strong>!
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <a
                  href="https://www.instagram.com/easyrigging_c5?igsh=MWJkbW40NWJnemFmOQ=="
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-pink-600 via-red-500 to-yellow-500 hover:from-pink-500 hover:to-yellow-400 active:from-pink-700 active:to-yellow-600 text-white font-extrabold uppercase text-xs py-3 rounded-xl transition-all shadow-md hover:scale-[1.02] duration-150 cursor-pointer"
                >
                  <Instagram className="h-4.5 w-4.5 animate-pulse" />
                  Segui @easyrigging_c5 su Instagram 📸
                </a>

                <div className="bg-emerald-900/30 border border-emerald-800/40 rounded-2xl p-4 space-y-3 text-left">
                  <p className="text-[10px] text-emerald-200/90 font-bold uppercase tracking-wider text-center">
                    📢 AIUTACI A FARE CRESCERE IL TORNEO!
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent("Segui EasyRigging C5 su Instagram per gli highlights, le foto ed i meme del torneo più caldo dell'anno! 🚀📷 https://www.instagram.com/easyrigging_c5?igsh=MWJkbW40NWJnemFmOQ==")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-550 active:bg-emerald-650 text-white font-extrabold text-[10.5px] uppercase py-2.5 px-3 rounded-lg transition-all cursor-pointer shadow-sm text-center"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Stato WhatsApp 💬
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("https://www.instagram.com/easyrigging_c5?igsh=MWJkbW40NWJnemFmOQ==");
                        setInstagramLinkCopied(true);
                        setTimeout(() => setInstagramLinkCopied(false), 2500);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-800/50 hover:border-emerald-700/60 font-extrabold text-[10.5px] uppercase py-2.5 px-3 rounded-lg transition-all cursor-pointer shadow-sm text-center"
                    >
                      {instagramLinkCopied ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 text-yellow-400 animate-pulse" />
                          Copiato! ✔
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copia Link 🔗
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInstagramPopup(false);
                      localStorage.setItem("fantaInstagramFollowed_v1", "true");
                    }}
                    className="w-full bg-yellow-400 hover:bg-yellow-350 active:bg-yellow-450 text-emerald-950 font-black text-xs uppercase py-3 rounded-xl transition-all cursor-pointer shadow-md text-center"
                  >
                    Ho già seguito / Non mostrare più 👍
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInstagramPopup(false)}
                    className="w-full text-emerald-300 hover:text-white text-[10.5px] font-bold uppercase transition-colors cursor-pointer py-1"
                  >
                    Ricordamelo più tardi ➔
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSuggestionModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in font-sans overflow-y-auto">
            <div className="bg-emerald-950 border-2 border-emerald-800 rounded-3xl max-w-lg w-full shadow-2xl relative my-8 overflow-hidden">
              {/* Modal Top Bar */}
              <div className="flex justify-between items-center bg-emerald-900/60 px-6 py-4 border-b border-emerald-800/40">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-300 animate-pulse" />
                  <span className="text-sm font-black text-white uppercase tracking-wider">
                    PROPONI UN MIGLIORAMENTO 💡
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSuggestionModal(false)}
                  className="p-1 rounded-lg hover:bg-emerald-800/50 text-emerald-300 hover:text-white transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4 text-left">
                <p className="text-[11px] text-emerald-300 font-medium leading-relaxed">
                  Hai un'idea per migliorare questa applicazione, implementare
                  nuove statistiche o ottimizzare le regole del torneo? Invia il
                  tuo suggerimento compilando i campi sottostanti.
                </p>

                {consiglioInviatoConSuccesso ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-2xl p-5 text-center leading-relaxed">
                    <p className="font-extrabold text-[13px] text-yellow-300 mb-1">
                      ✨ Inviato con Successo! ✨
                    </p>
                    Il tuo suggerimento è stato recapitato all'organizzatore del
                    Fantacalcetto. Grazie per il tuo prezioso contributo!
                    <button
                      type="button"
                      onClick={() => setConsiglioInviatoConSuccesso(false)}
                      className="block mx-auto text-yellow-400 hover:text-yellow-350 font-black mt-3 text-[10.5px] uppercase tracking-wider cursor-pointer underline"
                    >
                      Invia un'altra idea →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 font-sans">
                    {consiglioError && (
                      <div className="bg-red-950/40 border border-red-900/50 text-red-300 text-[10.5px] rounded-xl p-3 font-semibold text-center leading-tight">
                        ⚠️ {consiglioError}
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black uppercase tracking-wider text-emerald-400 leading-none">
                        Tuo Nome / Fantallenatore
                      </label>
                      <input
                        type="text"
                        value={consiglioAutore}
                        onChange={(e) => setConsiglioAutore(e.target.value)}
                        placeholder="Es. Stefano L."
                        className="w-full bg-emerald-900/45 border border-emerald-800 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 rounded-xl px-3.5 py-2.5 outline-none text-xs text-white placeholder-emerald-700 font-extrabold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black uppercase tracking-wider text-emerald-400 leading-none">
                        Dettaglio del Miglioramento Proposto
                      </label>
                      <textarea
                        value={consiglioTesto}
                        rows={4}
                        onChange={(e) => setConsiglioTesto(e.target.value)}
                        placeholder="Cose da aggiungere? Es: Mi piacerebbe inserire grafici dei prezzi storici o voti divisi per data..."
                        className="w-full bg-emerald-900/45 border border-emerald-800 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 rounded-xl px-3.5 py-2.5 outline-none text-xs text-white placeholder-emerald-700 font-medium leading-relaxed"
                      />
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowSuggestionModal(false)}
                        className="flex-1 bg-emerald-900/30 hover:bg-emerald-900/40 border border-emerald-800 text-emerald-300 font-extrabold text-[10.5px] uppercase py-3 rounded-xl transition-all cursor-pointer"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        disabled={invioConsiglioInCorso}
                        onClick={async () => {
                          if (
                            !consiglioAutore.trim() ||
                            !consiglioTesto.trim()
                          ) {
                            setConsiglioError(
                              "Compila sia il tuo nome sia la proposta di miglioramento!",
                            );
                            return;
                          }
                          setInvioConsiglioInCorso(true);
                          setConsiglioError("");
                          try {
                            if (onCreaConsiglio) {
                              await onCreaConsiglio(
                                consiglioAutore,
                                consiglioTesto,
                              );
                            } else {
                              const response = await fetch(
                                "/api/consigli/crea",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    autore: consiglioAutore,
                                    testo: consiglioTesto,
                                  }),
                                },
                              );
                              if (!response.ok)
                                throw new Error(
                                  "Errore nel salvataggio remoto",
                                );
                            }
                            setConsiglioAutore("");
                            setConsiglioTesto("");
                            setConsiglioInviatoConSuccesso(true);
                          } catch (err: any) {
                            setConsiglioError(
                              "Impossibile inviare la proposta: " + err.message,
                            );
                          } finally {
                            setInvioConsiglioInCorso(false);
                          }
                        }}
                        className="flex-1 bg-yellow-400 hover:bg-yellow-350 active:bg-yellow-450 disabled:bg-emerald-900 text-emerald-950 font-black text-[10.5px] uppercase py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {invioConsiglioInCorso
                          ? "Invio in corso..."
                          : "Invia Proposta 🚀"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showInstructionsModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in font-sans overflow-y-auto">
            <div className="bg-emerald-950 border-2 border-emerald-800 rounded-3xl max-w-lg w-full shadow-2xl relative my-8 overflow-hidden">
              {/* Modal Top Bar */}
              <div className="flex justify-between items-center bg-emerald-900/60 px-6 py-4 border-b border-emerald-800/40">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-yellow-300" />
                  <span className="text-sm font-black text-white uppercase tracking-wider">
                    GUIDA & REGOLAMENTO ARTIGIANALE
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstructionsModal(false)}
                  className="p-1 rounded-lg hover:bg-emerald-800/50 text-emerald-300 hover:text-white transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Sub-tabs with elegant gold active accent */}
              <div className="flex border-b border-emerald-800/20 bg-emerald-950/40">
                <button
                  type="button"
                  onClick={() => setInstructionsTab("guida")}
                  className={`flex-1 py-3 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 text-center cursor-pointer ${
                    instructionsTab === "guida"
                      ? "border-yellow-400 text-yellow-300 bg-emerald-900/20 font-black"
                      : "border-transparent text-emerald-400 hover:text-emerald-250 hover:bg-emerald-900/10 font-bold"
                  }`}
                >
                  📖 Come Funziona il Portale
                </button>
                <button
                  type="button"
                  onClick={() => setInstructionsTab("quotazioni")}
                  className={`flex-1 py-3 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 text-center cursor-pointer ${
                    instructionsTab === "quotazioni"
                      ? "border-yellow-400 text-yellow-300 bg-emerald-900/20 font-black"
                      : "border-transparent text-emerald-400 hover:text-emerald-250 hover:bg-emerald-900/10 font-bold"
                  }`}
                >
                  📈 Algoritmo Quotazioni
                </button>
              </div>

              {/* Modal Content container */}
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-5 text-left text-xs text-emerald-100 font-sans leading-relaxed">
                {instructionsTab === "guida" ? (
                  <>
                    <div className="space-y-3">
                      <h4 className="font-extrabold text-yellow-300 uppercase tracking-wide flex items-center gap-1.5 text-[12px]">
                        🎯 1. Iscrizione & Budget Iniziale
                      </h4>
                      <p>
                        Ogni fanta-squadra ha a disposizione un budget massimo
                        iniziale di <strong>60 Izycoin 🪙</strong> per comporre
                        la propria rosa inserendo esattamente{" "}
                        <strong>4 tesserati</strong> (3 Titolari + 1 Panchina).
                      </p>
                      <p className="bg-emerald-900/25 border border-emerald-800/40 rounded-xl p-3 text-[11px] text-yellow-250 font-sans">
                        💡 <strong>PIN di Sicurezza:</strong> All'iscrizione
                        indica un indirizzo email ed un PIN segreto personale.
                        Questo PIN ti servirà in futuro per sbloccare la tua
                        fanta-squadra e fare operazioni di mercato in piena
                        sicurezza!
                      </p>
                    </div>

                    <div className="space-y-3 border-t border-emerald-900/40 pt-4">
                      <h4 className="font-extrabold text-yellow-300 uppercase tracking-wide flex items-center gap-1.5 text-[12px]">
                        ⚽ 2. Titolari e Sostituzione Automatica
                      </h4>
                      <p>
                        In campo scenderanno i tuoi <strong>3 Titolari</strong>.
                        Se uno o più giocatori scelti tra i titolari dovessero
                        non giocare o non prendere voto,{" "}
                        <strong>subentreranno i voti del tuo Panchinaro</strong>{" "}
                        d'ufficio, salvando il punteggio della giornata.
                      </p>
                    </div>

                    <div className="space-y-3 border-t border-emerald-900/40 pt-4">
                      <h4 className="font-extrabold text-yellow-300 uppercase tracking-wide flex items-center gap-1.5 text-[12px]">
                        🔄 3. Mercato: Regola del Cambio Singolo e Slot
                        Flessibile
                      </h4>
                      <p>
                        Tra una partita refertata e l'altra puoi sostituire{" "}
                        <strong>
                          al massimo 1 giocatore in rosa (cambio singolo)
                        </strong>
                        . Tuttavia, prima della chiusura del mercato (fino a
                        un'ora dal calcio d'inizio), potrai cambiare idea e
                        sostituire nuovamente quel medesimo giocatore
                        (utilizzando l'unico slot "sbloccato") quante volte
                        vorrai. Gli altri 3 giocatori scelti resteranno invece
                        confermati e incedibili per l'intero turno.
                      </p>
                      <p>
                        Il saldo dell'operazione di mercato (l'Izycoin ricavato
                        dalla vendita, sommato al tuo credito residuo) deve
                        essere sempre sufficiente a coprire la quotazione di
                        acquisto del nuovo tesserato.
                      </p>
                    </div>

                    <div className="space-y-3 border-t border-emerald-900/40 pt-4">
                      <h4 className="font-extrabold text-yellow-400 uppercase tracking-wide flex items-center gap-1.5 text-[11.5px]">
                        ⏰ 4. Scadenza Ultima (Blocco Formazioni)
                      </h4>
                      <p className="bg-red-950/30 border border-red-900/40 rounded-xl p-3 text-[11px] text-red-200">
                        🔔 <strong>PRO-TIP:</strong> Le operazioni di mercato,
                        nuove iscrizioni e modifiche della formazione si{" "}
                        <strong>
                          bloccano rigorosamente alle 23:59 del giorno prima
                        </strong>{" "}
                        della partita controllata dall'Amministratore. Prepara la tua
                        mossa in tempo!
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3">
                      <h4 className="font-extrabold text-yellow-300 uppercase tracking-wide flex items-center gap-1.5 text-[12px]">
                        📊 Calcolo del FantaScore della Giornata
                      </h4>
                      <p>
                        Il punteggio delle partite ufficiali per ciascun
                        giocatore tesserato viene calcolato combinando
                        prestazioni reali e bonus:
                      </p>
                      <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-3.5 space-y-1 font-mono text-[10.5px]">
                        <div className="flex justify-between border-b border-emerald-800/40 pb-1">
                          <span>⚽ Gol Segnato:</span>
                          <span className="text-emerald-400 font-bold">
                            +3.0 pt
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-emerald-800/40 py-1">
                          <span>👟 Assist Vincente:</span>
                          <span className="text-emerald-400 font-bold">
                            +1.0 pt
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-emerald-800/40 py-1">
                          <span>🟨 Ammonizione:</span>
                          <span className="text-red-400 font-bold">
                            -0.5 pt
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>🟥 Espulsione:</span>
                          <span className="text-red-500 font-bold">
                            -1.0 pt
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <h5 className="font-bold text-emerald-300 text-[11px] uppercase tracking-wider mb-2">
                          🏅 Bonus Extra / Generici
                        </h5>
                        <div className="grid grid-cols-1 gap-1.5 font-mono text-[10px]">
                          {(() => {
                            const allB = bonuses || DEFAULT_BONUSES;
                            const currentGenericBonuses = allB.filter(
                              (b) => !b.isPersonale,
                            );
                            return currentGenericBonuses.map((b) => (
                              <div
                                key={b.id}
                                className="flex justify-between items-center bg-emerald-900/10 border border-emerald-800/20 rounded p-1.5 px-2"
                              >
                                <div className="pr-2">
                                  <span className="font-bold">{b.nome}</span>
                                  <div className="text-[8.5px] text-emerald-200/70 font-sans leading-tight mt-0.5">
                                    {b.descrizione}
                                  </div>
                                </div>
                                <span
                                  className={`font-bold whitespace-nowrap ${typeof b.punti === "number" && b.punti > 0 ? "text-emerald-400" : typeof b.punti === "number" && b.punti < 0 ? "text-red-400" : "text-amber-400"}`}
                                >
                                  {typeof b.punti === "number"
                                    ? b.punti > 0
                                      ? `+${b.punti}`
                                      : b.punti
                                    : "Variabile"}{" "}
                                  pt
                                </span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      <div className="mt-4">
                        <h5 className="font-bold text-amber-300 text-[11px] uppercase tracking-wider mb-2">
                          ⭐ Bonus Ad Personam
                        </h5>
                        <div className="space-y-3 font-mono text-[10px]">
                          {(() => {
                            const allB = bonuses || DEFAULT_BONUSES;
                            const currentPlayerBonuses = allB.filter(
                              (b) => b.isPersonale && b.giocatoreId,
                            );
                            const grouped = currentPlayerBonuses.reduce(
                              (acc, b) => {
                                if (b.giocatoreId) {
                                  if (!acc[b.giocatoreId])
                                    acc[b.giocatoreId] = [];
                                  acc[b.giocatoreId].push(b);
                                }
                                return acc;
                              },
                              {} as Record<string, CustomBonusDef[]>,
                            );

                            return Object.entries(grouped).map(
                              ([playerName, bns]) => (
                                <div key={playerName} className="space-y-1">
                                  <p className="font-bold text-emerald-250 border-b border-emerald-800/30 pb-0.5">
                                    {playerName}
                                  </p>
                                  <div className="grid grid-cols-1 gap-1">
                                    {bns.map((b) => (
                                      <div
                                        key={b.id}
                                        className="flex justify-between items-center bg-emerald-900/10 border border-amber-500/10 rounded p-1.5 px-2"
                                      >
                                        <div className="pr-2">
                                          <span className="font-bold">
                                            {b.nome}
                                          </span>
                                          <div className="text-[8.5px] text-emerald-200/70 font-sans leading-tight mt-0.5">
                                            {b.descrizione}
                                          </div>
                                        </div>
                                        <span
                                          className={`font-bold whitespace-nowrap ${typeof b.punti === "number" && b.punti > 0 ? "text-emerald-400" : typeof b.punti === "number" && b.punti < 0 ? "text-red-400" : "text-amber-400"}`}
                                        >
                                          {typeof b.punti === "number"
                                            ? b.punti > 0
                                              ? `+${b.punti}`
                                              : b.punti
                                            : "Variabile"}{" "}
                                          pt
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ),
                            );
                          })()}
                        </div>
                      </div>

                      <p className="text-[10px] text-emerald-300 mt-2">
                        * Possono essere conteggiati anche bonus personalizzati
                        ad hoc aggiunti dall'Amministratore del torneo per
                        premiare parate decisive, giocate formidabili o autogol.
                      </p>
                    </div>

                    <div className="space-y-3 border-t border-emerald-900/40 pt-4">
                      <h4 className="font-extrabold text-yellow-300 uppercase tracking-wide flex items-center gap-1.5 text-[12px]">
                        📈 Meccanismo di Rivalutazione Monetaria
                      </h4>
                      <p>
                        Le quotazioni dei giocatori non rimangono statiche, ma
                        fluttuano in modo semplice e trasparente in base ai
                        punti accumulati!
                      </p>

                      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3.5 rounded-xl font-medium leading-relaxed font-sans mb-3 text-[11px]">
                        🧠 <strong>Regola Base:</strong> Se un giocatore fa
                        esattamente <strong>3 punti</strong>, il suo valore
                        rimane invariato (variazione pari a 0 crediti), poiché
                        il punteggio di 3 rientra nella soglia neutra.
                      </div>

                      <div className="space-y-3 bg-emerald-900/30 border border-emerald-800/50 rounded-2xl p-4 text-[11px]">
                        <div>
                          <p className="font-extrabold text-yellow-300 uppercase tracking-wider text-[10.5px] mb-1.5 border-b border-emerald-800/20 pb-1">
                            📋 Riepilogo Completo delle Fasce di Valore:
                          </p>
                          <div className="space-y-4 mt-2">
                            <div>
                              <span className="text-yellow-400 font-extrabold text-xs uppercase block mb-1">🏃 Calciatori Convocati (In Campo/Giocato):</span>
                              <ul className="space-y-1.5 list-disc pl-4 text-emerald-200 text-[11px]">
                                <li><strong>Fascia Neutra (da +10 a +15 punti):</strong> Invariato 🪙 (0)</li>
                                <li><strong>Fascia Positiva (da +16 a +19 punti):</strong> Variazione di <strong>+1 Izycoin 🪙</strong></li>
                                <li><strong>Fascia Positiva (da +20 punti in poi):</strong> Variazione di <strong>+2 Izycoin 🪙</strong></li>
                                <li><strong>Fascia Negativa (da -5 a +9 punti):</strong> Variazione di <strong>-1 Izycoin 🪙</strong></li>
                                <li><strong>Fascia Negativa (da -6 a -10 punti):</strong> Variazione di <strong>-2 Izycoin 🪙</strong></li>
                                <li><strong>Fascia Negativa (da -11 punti in poi):</strong> Variazione di <strong>-3 Izycoin 🪙</strong></li>
                              </ul>
                            </div>
                            
                            <div className="border-t border-emerald-900/40 pt-2.5">
                              <span className="text-cyan-400 font-extrabold text-xs uppercase block mb-1">📢 Calciatori Non Convocati/Assenti:</span>
                              <ul className="space-y-1.5 list-disc pl-4 text-cyan-200 text-[11px]">
                                <li><strong>Fascia Neutra (da -1 a +6 punti):</strong> Invariato 🪙 (0)</li>
                                <li><strong>Fascia Positiva (da +7 a +14 punti):</strong> Variazione di <strong>+1 Izycoin 🪙</strong></li>
                                <li><strong>Fascia Positiva (da +15 punti in poi):</strong> Variazione di <strong>+2 Izycoin 🪙</strong></li>
                                <li><strong>Fascia Negativa (da -5 a -2 punti):</strong> Variazione di <strong>-1 Izycoin 🪙</strong></li>
                                <li><strong>Fascia Negativa (da -6 a -10 punti):</strong> Variazione di <strong>-2 Izycoin 🪙</strong></li>
                                <li><strong>Fascia Negativa (da -11 punti in poi):</strong> Variazione di <strong>-3 Izycoin 🪙</strong></li>
                              </ul>
                            </div>

                            <div className="border-t border-emerald-900/40 pt-2.5 bg-rose-955/20 p-2 rounded-lg border border-rose-900/30 text-[11px]">
                              <span className="text-rose-450 font-extrabold text-xs uppercase block mb-0.5">📦 Malus BRT:</span>
                              <span className="text-rose-200 leading-relaxed block">
                                Se attivo risulta spuntato <strong>Malus BRT</strong>: applica una variazione supplementare di <strong>-1 Izycoin 🪙</strong> per quella partita.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] bg-emerald-900/20 border border-emerald-800/40 text-emerald-300 p-3 rounded-xl font-medium leading-relaxed font-sans mt-3">
                        💵 <strong>Strategia Mercato:</strong> Vendendo un
                        calciatore la cui quotazione è cresciuta, incasserai la
                        nuova quotazione rivalutata sul mercato! Questo
                        incremento genera <em>Plusvalenze Reali</em>, aumentando
                        sistematicamente il budget totale della tua
                        fanta-squadra per acquistare altri top player.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-emerald-900/40 px-6 py-4 border-t border-emerald-800/40 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowInstructionsModal(false)}
                  className="bg-yellow-400 hover:bg-yellow-350 active:bg-yellow-450 text-emerald-950 font-black text-xs uppercase px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Ho Capito, grazie! 👍
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="max-w-4xl w-full mx-auto space-y-6 my-auto">
          {/* Header */}
          <div className="text-center space-y-2">
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] sm:text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full select-none font-sans">
              🏆 FANTACALCETTO ASD
            </span>
            <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-emerald-300 font-sans">
              Classifica & Portale Fantacalcetto
            </h1>
            <p className="text-xs sm:text-sm text-emerald-300 max-w-lg mx-auto font-medium leading-relaxed font-sans">
              Dedicato ai tornei del lunedì! Guarda i punteggi in tempo reale ed
              iscrivi la tua squadra.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setInstructionsTab("guida");
                  setShowInstructionsModal(true);
                }}
                className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-350 active:bg-yellow-450 text-emerald-950 px-4 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md hover:scale-[1.03] duration-150"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Regolamento & Istruzioni Gioco 📖
              </button>
              <button
                type="button"
                onClick={() => {
                  setConsiglioInviatoConSuccesso(false);
                  setConsiglioError("");
                  setShowSuggestionModal(true);
                }}
                className="inline-flex items-center gap-2 bg-emerald-900/60 hover:bg-emerald-850 border border-emerald-705 text-yellow-300 hover:text-yellow-250 px-4 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md hover:scale-[1.03] duration-150"
              >
                <Lightbulb className="h-3.5 w-3.5 text-yellow-400 animate-pulse" />
                Proponi Miglioramento 💡
              </button>
              <a
                href="https://www.instagram.com/easyrigging_c5?igsh=MWJkbW40NWJnemFmOQ=="
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-600 via-red-500 to-yellow-500 hover:from-pink-500 hover:to-yellow-400 active:from-pink-700 active:to-yellow-600 text-white px-4 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md hover:scale-[1.03] duration-150"
              >
                <Instagram className="h-4 w-4 text-white" />
                Instagram @easyrigging_c5 📸
              </a>
            </div>
          </div>

          {/* Instagram Follower Engagement Banner */}
          <div className="bg-gradient-to-r from-purple-950/60 via-pink-950/50 to-amber-950/40 border border-pink-500/20 rounded-2xl p-4 text-center space-y-2.5 max-w-lg mx-auto shadow-lg backdrop-blur-xs">
            <div className="flex items-center justify-center gap-1.5">
              <Instagram className="h-4.5 w-4.5 text-pink-400 animate-pulse" />
              <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-pink-300 font-sans">
                Segui @easyrigging_c5 su Instagram
              </span>
            </div>
            <p className="text-xs text-emerald-100 leading-relaxed max-w-sm mx-auto font-sans font-medium">
              Highlights esclusivi, meme del torneo, foto dal campo e pagelle interattive! Aiutaci a far crescere la community di <strong>EasyRigging C5</strong>. 🚀
            </p>
            <div>
              <a
                href="https://www.instagram.com/easyrigging_c5?igsh=MWJkbW40NWJnemFmOQ=="
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-550 active:bg-pink-650 text-white font-extrabold uppercase text-[10.5px] px-5 py-2 rounded-xl transition-all shadow-md cursor-pointer hover:shadow-pink-500/25 tracking-wider font-sans"
              >
                Diventa un Follower! ➔
              </a>
            </div>
          </div>

          {/* Navigation Tabs for Public Portal */}
          <div className="flex flex-wrap justify-center gap-1.5 max-w-sm sm:max-w-lg mx-auto bg-emerald-950/60 p-1.5 rounded-2xl border border-emerald-850 font-sans">
            <button
              type="button"
              onClick={() => setActivePublicTab("classifica")}
              className={`flex-1 min-w-[30%] py-1.5 rounded-xl text-[10.5px] font-extrabold uppercase transition-all tracking-wider cursor-pointer text-center font-sans ${
                activePublicTab === "classifica"
                  ? "bg-yellow-400 text-emerald-950 shadow-md font-extrabold"
                  : "text-emerald-300 hover:text-white hover:bg-emerald-900/30 font-bold"
              }`}
            >
              🏆 Classifica
            </button>
            <button
              type="button"
              onClick={() => setActivePublicTab("partite")}
              className={`flex-1 min-w-[30%] py-1.5 rounded-xl text-[10.5px] font-extrabold uppercase transition-all tracking-wider cursor-pointer text-center font-sans ${
                activePublicTab === "partite"
                  ? "bg-yellow-400 text-emerald-950 shadow-md font-extrabold"
                  : "text-emerald-300 hover:text-white hover:bg-emerald-900/30 font-bold"
              }`}
            >
              ⚽ Partite
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePublicTab("convocazioni");
                setSubmitted(false);
              }}
              className={`flex-1 min-w-[30%] py-1.5 rounded-xl text-[10.5px] font-extrabold uppercase transition-all tracking-wider cursor-pointer text-center font-sans ${
                activePublicTab === "convocazioni"
                  ? "bg-yellow-400 text-emerald-950 shadow-md font-extrabold"
                  : "text-emerald-300 hover:text-white hover:bg-emerald-900/30 font-bold"
              }`}
            >
              📋 Convocazioni
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePublicTab("iscrizione");
                setSubmitted(false);
              }}
              className={`flex-1 min-w-[30%] py-1.5 rounded-xl text-[10.5px] font-extrabold uppercase transition-all tracking-wider cursor-pointer text-center font-sans ${
                activePublicTab === "iscrizione"
                  ? "bg-yellow-400 text-emerald-950 shadow-md font-extrabold"
                  : "text-emerald-300 hover:text-white hover:bg-emerald-900/30 font-bold"
              }`}
            >
              📝 Iscrizione
            </button>
            <button
              type="button"
              onClick={() => setActivePublicTab("statistiche")}
              className={`flex-1 min-w-[30%] py-1.5 rounded-xl text-[10.5px] font-extrabold uppercase transition-all tracking-wider cursor-pointer text-center font-sans ${
                activePublicTab === "statistiche"
                  ? "bg-yellow-400 text-emerald-950 shadow-md font-extrabold"
                  : "text-emerald-300 hover:text-white hover:bg-emerald-900/30 font-bold"
              }`}
            >
              📊 Statistiche
            </button>
          </div>

          {isMercatoLiberoValido && (
            <div className="rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans shadow-lg bg-blue-900/40 border-blue-500 text-blue-100 animate-pulse-slow mb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl shrink-0 mt-0.5 bg-blue-800 text-blue-200">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">
                    ⭐ SESSIONE DI MERCATO SPECIALE ATTIVA
                    {scadenzaMercatoLibero && <MercatoCountdown targetDate={scadenzaMercatoLibero} />}
                  </h4>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    Il limite di <span className="font-extrabold text-white">1 solo cambio</span> è momentaneamente sospeso! Puoi modificare interamente la rosa per questo mercato.
                  </p>
                </div>
              </div>
              {isEditor && (
                <button
                  type="button"
                  onClick={() => {
                    let datePart = "";
                    if (scadenzaMercatoLibero) {
                      const d = new Date(scadenzaMercatoLibero);
                      datePart = ` fino al ${d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute:"2-digit" })}`;
                    }
                    const text = `🚨 *FANTACALCETTO FLASH* 🚨\n\nAttenzione Presidenti! È stata appena attivata una *Sessione di Mercato Speciale*! ⭐\n\nIl limite rigido di 1 solo cambio a settimana è stato temporaneamente SOSPESO${datePart}. Potete stravolgere interamente le vostre rose senza penalità!\n\nCorrete subito sul portale per approfittarne: https://Fantacalcetto...`;
                    navigator.clipboard.writeText(text);
                    alert("Messaggio copiato negli appunti! Ora puoi incollarlo su WhatsApp.");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-[10px] uppercase tracking-wide cursor-pointer ml-auto"
                >
                  <Copy className="h-3 w-3" />
                  Copia Avviso Wa
                </button>
              )}
            </div>
          )}

          {/* Lock Status Banner */}
          {lockStatus.match ? (
            <div
              className={`rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans shadow-lg ${
                lockStatus.isLocked
                  ? "bg-red-950/70 border-red-900 text-red-200"
                  : "bg-emerald-950/60 border-emerald-800/80 text-emerald-100"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    lockStatus.isLocked
                      ? "bg-red-900/30 text-red-400 animate-pulse"
                      : "bg-emerald-900/40 text-emerald-400"
                  }`}
                >
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    {lockStatus.isLocked
                      ? "🔒 Formazioni Bloccate"
                      : "🔓 Formazioni Aperte"}
                  </h4>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    {lockStatus.isLocked ? (
                      <>
                        Le iscrizioni e variazioni sono chiuse per questa
                        settimana. Prossimo turno di campionato:{" "}
                        <span className="font-extrabold text-white">
                          {lockStatus.match.dettagli.split(",")[0]}
                        </span>
                        . Rimangono in vigore le formazioni salvate
                        precedentemente!
                      </>
                    ) : (
                      <>
                        Puoi inserire o aggiornare la tua formazione per il
                        turno di campionato del{" "}
                        <span className="font-extrabold text-white">
                          {lockStatus.match.dettagli.split(",")[0]}
                        </span>
                        .
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <span
                  className={`text-[9px] uppercase font-black tracking-widest px-2.5 py-1 rounded-lg inline-block ${
                    lockStatus.isLocked
                      ? "bg-red-850 text-white"
                      : "bg-amber-500/10 text-amber-300 border border-amber-500/25"
                  }`}
                >
                  Scadenza: {lockStatus.deadline?.toLocaleDateString("it-IT")}{" "}
                  {lockStatus.deadline?.toLocaleTimeString("it-IT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {!lockStatus.isLocked && lockStatus.timeLeftString && (
                  <p className="text-[10px] text-yellow-300 font-extrabold uppercase tracking-wider mt-1.5 animate-pulse">
                    Mancano: {lockStatus.timeLeftString}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-4 border bg-emerald-950/40 border-emerald-900 text-emerald-300/80 text-xs flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>
                Nessuna gara di campionato attualmente programmata in bacheca.
                Le iscrizioni e formazioni sono aperte.
              </span>
            </div>
          )}

          {activePublicTab === "classifica" ? (
            <div className="space-y-6 animate-fade-in font-sans">
              <div className="bg-emerald-900/30 border-l-4 border-emerald-500 p-4 rounded-r-xl font-sans mt-2 shadow-sm">
                <p className="text-xs text-emerald-200 leading-relaxed font-medium">
                  <strong className="text-emerald-400">ℹ️ Punto Informativo:</strong> Qui puoi monitorare l'andamento del campionato. Clicca su ciascun team per vedere nel dettaglio il valore attuale della rosa, il tesoretto residuo e le scelte dei giocatori fatte dagli altri partecipanti!
                </p>
              </div>
              {/* Podium View if any */}
              {rankedTeams.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
                  {rankedTeams.slice(0, 3).map((item, index) => {
                    const badgeColor =
                      index === 0
                        ? "bg-yellow-400 text-emerald-950"
                        : index === 1
                          ? "bg-slate-300 text-emerald-950"
                          : "bg-amber-600 text-white";
                    const subtitleLabel =
                      index === 0
                        ? "🥇 Primo"
                        : index === 1
                          ? "🥈 Secondo"
                          : "🥉 Terzo";
                    return (
                      <div
                        key={item.id}
                        className="text-center bg-emerald-950/85 border border-emerald-800 p-5 rounded-3xl shadow-xl flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-md font-sans"
                      >
                        <span
                          className={`text-[9px] uppercase font-black px-2.5 py-1 rounded-full font-sans ${badgeColor}`}
                        >
                          {subtitleLabel}
                        </span>
                        <p
                          className="font-black text-sm text-yellow-300 mt-3 truncate max-w-full font-sans"
                          title={item.nomeFantasquadra}
                        >
                          {item.nomeFantasquadra}
                        </p>
                        <p className="text-[10px] text-emerald-400 truncate max-w-full font-medium font-sans">
                          Di:{" "}
                          <span className="font-extrabold text-white font-sans">
                            {item.nomePartecipante}
                          </span>
                        </p>
                        <span className="text-xl font-black font-mono text-white mt-2 flex items-baseline gap-1">
                          {item.score}{" "}
                          <span className="text-[10px] text-emerald-400 font-bold uppercase font-sans">
                            pt
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Leaderboard Table / Cards */}
              <div className="bg-emerald-950/80 border border-emerald-800 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4 font-sans">
                <div className="border-b border-emerald-900 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-sans">
                  <div>
                    <h3 className="font-extrabold text-xs text-white uppercase tracking-wider font-sans flex items-center gap-2">
                      Classifica Generale
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInstructionsTab("guida");
                          setShowInstructionsModal(true);
                        }}
                        className="text-emerald-400 hover:text-yellow-400 transition-colors"
                        title="Vedi info su come funziona il torneo"
                      >
                        <BookOpen className="h-4 w-4" />
                      </button>
                    </h3>
                    <p className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider font-sans mt-0.5">
                      Aggiornata ad ogni referto inserito dagli Amministratori
                    </p>
                  </div>
                  <div className="flex items-center gap-2 select-none">
                    {rankedTeams.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActivePublicTab("statistiche")}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition-transform hover:-translate-y-0.5"
                        title="Vedi referto, statistiche avanzate ed esporta per i social"
                      >
                        <span>📊 Filtra & Apri Statistiche</span>
                      </button>
                    )}
                    <span className="bg-emerald-900 text-emerald-200 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full font-mono shrink-0">
                      {rankedTeams.length} Team
                    </span>
                  </div>
                </div>

                {rankedTeams.length === 0 ? (
                  <div className="text-center py-16 text-emerald-500 font-medium font-sans">
                    <Trophy className="h-10 w-10 mx-auto text-emerald-700 mb-3 animate-pulse" />
                    Nessuna fantasquadra registrata nel Fantacalcetto.
                    <br />
                    Iscrivi la prima squadra cliccando sulla tab "Iscrizione"!
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 font-sans">
                    {rankedTeams.map((team, index) => {
                      const isExpanded = expandedTeamId === team.id;
                      return (
                        <div
                          key={team.id}
                          className={`border rounded-2xl transition-all font-sans ${
                            isExpanded
                              ? "border-yellow-400 bg-emerald-900/45"
                              : "border-emerald-850 bg-emerald-900/10 hover:bg-emerald-900/20"
                          }`}
                        >
                          {/* Card header */}
                          <div
                            onClick={() =>
                              setExpandedTeamId(isExpanded ? null : team.id)
                            }
                            className="p-3.5 flex items-center justify-between cursor-pointer select-none font-sans"
                          >
                            <div className="flex items-center gap-3 min-w-0 font-sans">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-black ${
                                  index === 0
                                    ? "bg-yellow-400 text-emerald-950 font-black h-6.5 w-6.5"
                                    : index === 1
                                      ? "bg-slate-300 text-emerald-950"
                                      : index === 2
                                        ? "bg-amber-600 text-white"
                                        : "text-emerald-300 bg-emerald-900/50"
                                }`}
                              >
                                {index + 1}
                              </span>
                              <div className="min-w-0 font-sans">
                                <p className="font-black text-xs text-white truncate font-sans">
                                  {team.nomeFantasquadra}
                                </p>
                                <p className="text-[10px] text-emerald-400 font-bold truncate font-sans">
                                  Presidente:{" "}
                                  <span className="text-gray-200 font-extrabold font-sans">
                                    {team.nomePartecipante}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 font-sans">
                              <div className="text-right font-sans">
                                <span className="text-xs font-black font-mono text-yellow-300 block leading-none font-sans">
                                  {team.score} pt
                                </span>
                                <span className="text-[8px] uppercase tracking-wider font-extrabold text-emerald-500 mt-0.5 block leading-none font-sans">
                                  Fantascore
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-emerald-400" />
                              )}
                            </div>
                          </div>

                          {/* Expansion list of players */}
                          {isExpanded && (
                            <div className="border-t border-emerald-900 p-4 bg-emerald-950/60 space-y-3.5 animate-fade-in text-xs font-sans">
                              {/* Financial/Roster values block */}
                              {(() => {
                                const currentTotalVal =
                                  team.giocatoriSelezionati.reduce(
                                    (sum, name) => {
                                      const stats = getPlayerStatsObj(name);
                                      return (
                                        sum +
                                        getPlayerCurrentPrice(
                                          name,
                                          stats.fantaScore,
                                          partiteChiuse,
                                          bonuses,
                                          giocatori
                                        )
                                      );
                                    },
                                    0,
                                  );
                                return (
                                  <div className="grid grid-cols-2 gap-3.5 bg-emerald-950/85 border border-emerald-900 p-3 rounded-xl text-left">
                                    <div>
                                      <p className="text-[7.5px] uppercase font-bold tracking-widest text-emerald-450 mb-0.5">
                                        Tesoretto Residuo
                                      </p>
                                      <p className="font-mono text-xs font-black text-yellow-300 leading-none">
                                        {team.creditoResiduo ?? 0} Izycoin 🪙
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[7.5px] uppercase font-bold tracking-widest text-emerald-450 mb-0.5">
                                        Valore Totale Rosa
                                      </p>
                                      <p className="font-mono text-xs font-black text-emerald-300 leading-none">
                                        {currentTotalVal} Izycoin 🪙
                                      </p>
                                    </div>
                                  </div>
                                );
                              })()}

                              <div>
                                <h4 className="text-[9px] uppercase font-black tracking-wider text-yellow-300 mb-2 font-sans">
                                  ROSTER ATTUALE –{" "}
                                  {team.giocatoriSelezionati.length} GIOCATORI
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans">
                                  {team.giocatoriSelezionati.map(
                                    (pName, pIdx) => {
                                      const originalPlayer = giocatori.find(
                                        (g) =>
                                          g.nome.toLowerCase() ===
                                          pName.toLowerCase(),
                                      );
                                      const isBench = pIdx === 3;

                                      return (
                                        <div
                                          key={pIdx}
                                          className={`border p-2.5 rounded-xl flex items-center justify-between font-sans ${
                                            isBench
                                              ? "bg-amber-950/30 border-amber-500/25 text-amber-200"
                                              : "bg-emerald-900/30 border-emerald-850 text-white"
                                          }`}
                                        >
                                          <div className="min-w-0 pr-1 flex-1 text-left">
                                            <p className="font-black text-[11px] truncate text-gray-100 font-sans">
                                              {pIdx + 1}. {getLastName(pName)}
                                            </p>
                                            <p className="text-[8px] text-emerald-400/80 font-extrabold uppercase mt-0.5 font-sans">
                                              #
                                              {originalPlayer?.numeroMaglia ||
                                                "??"}{" "}
                                              •{" "}
                                              {originalPlayer?.ultimoRuolo ||
                                                "Ruolo"}
                                            </p>
                                          </div>
                                          <span
                                            className={`text-[8px] px-1.5 py-0.5 rounded font-bold font-mono tracking-wider shadow-sm border ${isBench ? "bg-amber-900/40 text-amber-300 border-amber-500/50" : "bg-emerald-900/40 text-emerald-300 border-emerald-500/50"}`}
                                          >
                                            {isBench ? "PANCHINA" : "TITOLARE"}
                                          </span>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>

                              {/* Detailed Championship Match Reports & Player Scores */}
                              {(() => {
                                const matchBreakdown =
                                  getTeamMatchBreakdownList(team);
                                return (
                                  <div className="mt-4 border-t border-emerald-900/40 pt-3 space-y-2">
                                    <h4 className="text-[9px] uppercase font-black tracking-wider text-yellow-350 flex items-center gap-1.5 font-sans">
                                      📈 DETTAGLIO PARTITE REFERTATE (
                                      {matchBreakdown.length})
                                    </h4>
                                    {matchBreakdown.length === 0 ? (
                                      <p className="text-[10px] text-emerald-500 italic pb-1">
                                        Nessun match di campionato refertato
                                        finora per questa squadra.
                                      </p>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        {matchBreakdown.map((mb, mbIdx) => (
                                          <div
                                            key={mbIdx}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setSelectedMatchBreakdown({
                                                mb,
                                                teamName: team.nomeFantasquadra,
                                              });
                                            }}
                                            className="bg-emerald-950/40 hover:bg-emerald-900/60 transition-colors border border-emerald-900/50 rounded-xl p-3 flex items-center justify-between cursor-pointer group"
                                          >
                                            <div className="min-w-0 pr-2">
                                              <p
                                                className="text-[11px] font-extrabold text-white truncate group-hover:text-yellow-300 transition-colors"
                                                title={mb.dettagli}
                                              >
                                                ⚔️{" "}
                                                {mb.dettagli.split(" - ")[0] ||
                                                  mb.dettagli}
                                              </p>
                                              {mb.dettagli.includes(" - ") && (
                                                <p className="text-[8px] text-emerald-400 font-medium truncate mt-0.5">
                                                  {mb.dettagli
                                                    .split(" - ")
                                                    .slice(1)
                                                    .join(" - ")}
                                                </p>
                                              )}
                                            </div>
                                            <div className="text-right shrink-0 flex items-center gap-2">
                                              <span className="font-mono text-[10px] font-black bg-emerald-900 text-yellow-300 border border-emerald-800 px-1.5 py-0.5 rounded-lg shadow-xs group-hover:bg-yellow-400 group-hover:text-emerald-950 transition-colors">
                                                {mb.puntiTotaliMatch > 0
                                                  ? "+"
                                                  : ""}
                                                {mb.puntiTotaliMatch} pt
                                              </span>
                                              <span className="text-[10px] text-emerald-600 group-hover:text-yellow-400 font-bold transition-colors">
                                                ➔
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activePublicTab === "partite" ? (
            <div className="space-y-6 animate-fade-in font-sans">
              <div className="bg-emerald-900/30 border-l-4 border-emerald-500 p-4 rounded-r-xl font-sans mt-2 shadow-sm">
                <p className="text-xs text-emerald-200 leading-relaxed font-medium">
                  <strong className="text-emerald-400">ℹ️ Punto Informativo:</strong> Archivio delle prestazioni. Controlla qui i voti o i referti caricati dall'amministratore che hanno decretato il FantaScore dei tesserati, incluse pagelle, gol e bonus/malus generali.
                </p>
              </div>
              {/* Highlight Banner / Link to General Report */}
              <div className="bg-gradient-to-r from-emerald-950/90 to-emerald-900/60 border border-emerald-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4 font-sans">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-emerald-900/60 pb-4">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-black text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-md border border-yellow-400/10 tracking-wider">
                      Archivio Ufficiale
                    </span>
                    <h3 className="font-extrabold text-base text-white uppercase tracking-wider font-sans flex items-center gap-2">
                      Tabellone Partite & Referti
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInstructionsTab("guida");
                          setShowInstructionsModal(true);
                        }}
                        className="text-emerald-400 hover:text-yellow-400 transition-colors"
                        title="Vedi info sui calcoli dei punti"
                      >
                        <BookOpen className="h-5 w-5" />
                      </button>
                    </h3>
                    <p className="text-[10.5px] text-emerald-300 font-medium">
                      Consulta i risultati omologati dei match e scarica il
                      libretto dei voti.
                    </p>
                  </div>
                  {rankedTeams.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActivePublicTab("statistiche")}
                      className="bg-yellow-400 hover:bg-yellow-500 text-emerald-950 text-[10px] font-black uppercase px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 duration-200"
                    >
                      <span>📊 Apri Hub Statistiche</span>
                    </button>
                  )}
                </div>

                {/* Banner box directing to the general report */}
                <div className="bg-emerald-950/50 border border-emerald-800/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-left space-y-1">
                    <h4 className="text-xs font-bold text-emerald-250 uppercase tracking-wide">
                      Fascicolo Completo Voti
                    </h4>
                    <p className="text-[10.5px] text-emerald-400/90 leading-normal">
                      Il referto generale unisce la classifica ponderata, la
                      composizione delle rose e i dettagli di calcolo di tutte
                      le giornate disputate finora.
                    </p>
                  </div>
                  {rankedTeams.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActivePublicTab("statistiche")}
                      className="text-yellow-400 hover:text-yellow-300 font-black text-[10.5px] uppercase underline underline-offset-4 shrink-0 transition-opacity hover:opacity-90 block"
                    >
                      Vedi Hub Statistiche →
                    </button>
                  )}
                </div>

                {allPartite.length === 0 ? (
                  <div className="py-12 text-center bg-emerald-900/20 rounded-2xl border border-emerald-800/30">
                    <p className="text-emerald-400/80 font-bold text-xs uppercase tracking-wider">
                      Nessuna gara di campionato registrata nel tabellone.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5 font-sans pt-1">
                    {allPartite.map((m) => {
                      const isAperta = m.stato === "Aperta";
                      return (
                        <div
                          key={m.id}
                          className="bg-emerald-900/20 rounded-2xl border border-emerald-800/40 p-4.5 transition-all hover:bg-emerald-900/30 hover:border-emerald-700/50 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 text-left md:max-w-2xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${isAperta ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/25 animate-pulse" : "bg-gray-800/45 text-gray-400 border-gray-700/50"}`}
                              >
                                {isAperta
                                  ? "● In Corso / Aperta"
                                  : "✓ Conclusa"}
                              </span>
                              {m.dataInserimento && (
                                <span className="text-[10px] text-emerald-400/70 font-mono">
                                  {new Date(
                                    m.dataInserimento,
                                  ).toLocaleDateString("it-IT", {
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </span>
                              )}
                            </div>

                            <p className="font-extrabold text-white text-[13.5px] sm:text-sm tracking-wide leading-snug">
                              {m.dettagli || "Incontro di campionato"}
                            </p>

                            {m.risultato ? (
                              <div className="inline-flex items-center gap-2 bg-emerald-950/75 border border-emerald-900/60 rounded-lg px-2.5 py-1 mt-1 shadow-sm">
                                <span className="text-[9.5px] text-emerald-400 uppercase tracking-widest font-black">
                                  Risultato:
                                </span>
                                <span className="font-mono text-xs text-yellow-300 font-extrabold tracking-widest">
                                  {m.risultato}
                                </span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-emerald-500/70 italic">
                                Risultato ufficiale non ancora pubblicato.
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 self-start md:self-center shrink-0">
                            {m.referto && m.referto.length > 0 ? (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className="text-right hidden sm:block">
                                  <p className="text-[10.5px] text-emerald-300 font-bold">
                                    ✓ {m.referto.length} Voti Presenti
                                  </p>
                                  <p className="text-[8.5px] text-emerald-500/80 uppercase tracking-wider font-semibold">
                                    Dati refertati
                                  </p>
                                </div>
                                <div className="flex flex-col gap-1.5 border-t sm:border-t-0 sm:border-l border-emerald-800/40 pt-2 sm:pt-0 sm:pl-4">
                                  <span className="text-[8px] uppercase font-bold text-emerald-400 mb-0.5">Esporta PDF:</span>
                                  <button onClick={() => generatePartitaGiocatoriPdf(m)} className="text-left bg-emerald-950/50 hover:bg-yellow-400 hover:text-emerald-900 border border-emerald-800/50 text-emerald-200 text-[9px] font-bold uppercase py-1 px-2 rounded flex items-center justify-between gap-2 transition-colors shadow-sm w-36">
                                    Giocatori <Download className="w-3 h-3 shrink-0" />
                                  </button>
                                  <button onClick={() => setMatchForPlayerChoice(m)} className="text-left bg-emerald-950/50 hover:bg-yellow-400 hover:text-emerald-900 border border-emerald-800/50 text-emerald-200 text-[9px] font-bold uppercase py-1 px-2 rounded flex items-center justify-between gap-2 transition-colors shadow-sm w-36">
                                    Singolo <Download className="w-3 h-3 shrink-0" />
                                  </button>
                                  <button onClick={() => setMatchForTeamChoice(m)} className="text-left bg-emerald-950/50 hover:bg-yellow-400 hover:text-emerald-900 border border-emerald-800/50 text-emerald-200 text-[9px] font-bold uppercase py-1 px-2 rounded flex items-center justify-between gap-2 transition-colors shadow-sm w-36">
                                    Squadra <Download className="w-3 h-3 shrink-0" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-emerald-500/60 italic hidden sm:block">
                                Nessun voto caricato.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activePublicTab === "convocazioni" ? (
            <div className="space-y-6 animate-fade-in font-sans">
              <div className="bg-emerald-900/30 border-l-4 border-amber-500 p-4 rounded-r-xl font-sans mt-2 shadow-sm">
                <p className="text-xs text-emerald-200 leading-relaxed font-medium">
                  <strong className="text-amber-400">ℹ️ Come Schierare la Formazione:</strong> Assicurati di schierare i 4 giocatori ogni settimana (prima che scada il tempo indicato)! Se un tuo titolare non giocherà la partita prenderà s.v. e verrà sostituito in automatico dal voto del tuo giocatore in panchina.
                </p>
              </div>
              {(() => {
                const activeMatch =
                  lockStatus.match ||
                  (partiteAperte && partiteAperte[0]) ||
                  null;
                const matchConvocati = activeMatch?.convocati || [];
                const activeRoster = giocatori.filter((g) => g.attivo);

                const convocatiGiocatori = activeRoster.filter((g) =>
                  matchConvocati.some(
                    (name) =>
                      name.toLowerCase().trim() === g.nome.toLowerCase().trim(),
                  ),
                );

                const nonConvocatiGiocatori = activeRoster.filter(
                  (g) =>
                    !matchConvocati.some(
                      (name) =>
                        name.toLowerCase().trim() ===
                        g.nome.toLowerCase().trim(),
                    ),
                );

                const externalsConvocati = matchConvocati.filter(
                  (name) =>
                    !activeRoster.some(
                      (g) =>
                        g.nome.toLowerCase().trim() ===
                        name.toLowerCase().trim(),
                    ),
                );

                return (
                  <div className="space-y-6 animate-fade-in">
                    {/* Imminent Match details card */}
                    <div className="bg-emerald-950/80 border border-emerald-800 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-yellow-400/10 text-yellow-300 border border-yellow-500/20 rounded-2xl shrink-0">
                          <Calendar className="h-6 w-6 text-yellow-400" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <span className="text-[9px] uppercase font-black text-emerald-400 tracking-wider flex items-center gap-2">
                            Turno di Gioco Attivo
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInstructionsTab("guida");
                                setShowInstructionsModal(true);
                              }}
                              className="text-emerald-400 hover:text-yellow-400 transition-colors"
                              title="Vedi info su blocchi formazioni"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                            </button>
                          </span>
                          {activeMatch ? (
                            <>
                              <h2 className="text-base sm:text-lg font-black text-white mt-0.5 leading-tight truncate">
                                ⚔️{" "}
                                {activeMatch.dettagli.split(" - ")[0] ||
                                  activeMatch.dettagli}
                              </h2>
                              {activeMatch.dettagli.includes(" - ") && (
                                <p className="text-[10px] text-emerald-300 font-bold mt-1 uppercase tracking-wide">
                                  📍{" "}
                                  {activeMatch.dettagli
                                    .split(" - ")
                                    .slice(1)
                                    .join(" - ")}
                                </p>
                              )}
                              <div className="inline-flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-800 px-2.5 py-1 rounded-lg text-[10px] text-emerald-300 mt-2.5 font-bold uppercase">
                                <span>Stato:</span>
                                <span
                                  className={
                                    lockStatus.isLocked
                                      ? "text-red-400 font-extrabold"
                                      : "text-emerald-400 font-extrabold animate-pulse"
                                  }
                                >
                                  {lockStatus.isLocked
                                    ? "🔒 Formazioni Bloccate"
                                    : "🔓 Formazioni Aperte"}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <h2 className="text-base sm:text-lg font-black text-white mt-0.5 leading-tight">
                                Nessun turno programmato
                              </h2>
                              <p className="text-[10.5px] text-emerald-300/80 font-bold leading-relaxed mt-1">
                                Non ci sono partite imminenti attive. Contatta
                                gli amministratori per programmare il prossimo
                                incontro di campionato o amichevole!
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {activeMatch && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* CONVOCATI COLUMN */}
                        <div className="bg-emerald-950/85 border border-emerald-800 p-5 rounded-3xl shadow-xl flex flex-col space-y-4">
                          <div className="border-b border-emerald-900 pb-3 flex justify-between items-center text-left">
                            <div className="text-left">
                              <h3 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                                <span className="text-emerald-400 font-sans">
                                  🟢
                                </span>{" "}
                                GIOCATORI CONVOCATI
                              </h3>
                              <p className="text-[9px] text-emerald-400 font-black uppercase tracking-wider mt-0.5">
                                Disponibili per la partita
                              </p>
                            </div>
                            <span className="bg-emerald-900/65 border border-emerald-800 text-yellow-300 text-[11px] font-black px-3 py-1 rounded-xl shadow-inner font-mono">
                              {convocatiGiocatori.length +
                                externalsConvocati.length}
                            </span>
                          </div>

                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {convocatiGiocatori.length === 0 &&
                            externalsConvocati.length === 0 ? (
                              <div className="text-center py-10 text-emerald-500 text-xs italic font-medium">
                                Nessun giocatore attualmente convocato.
                              </div>
                            ) : (
                              <>
                                {convocatiGiocatori.map((p) => (
                                  <div
                                    key={p.nome}
                                    className="flex items-center justify-between bg-emerald-900/15 border border-emerald-850 p-3 rounded-2xl hover:bg-emerald-900/30 transition-all text-left animate-fadeIn"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-yellow-400 text-emerald-950 flex items-center justify-center font-black font-mono text-xs shadow-md">
                                        #{p.numeroMaglia || "N/A"}
                                      </div>
                                      <div>
                                        <p className="font-black text-xs text-gray-100">
                                          {getLastName(p.nome)}
                                        </p>
                                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-emerald-400/90 block mt-0.5 text-left">
                                          🛡️ {p.ultimoRuolo || "Calciatore"}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="bg-emerald-500/15 border border-emerald-500/25 text-emerald-350 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg">
                                      Attivo
                                    </span>
                                  </div>
                                ))}

                                {externalsConvocati.map((extName) => (
                                  <div
                                    key={extName}
                                    className="flex items-center justify-between bg-emerald-900/20 border border-amber-900/25 p-3 rounded-2xl transition-all text-left animate-fadeIn"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold font-mono text-xs shadow-md">
                                        EXT
                                      </div>
                                      <div>
                                        <p className="font-black text-xs text-amber-200">
                                          {getLastName(extName)}
                                        </p>
                                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-amber-400 block mt-0.5 text-left">
                                          👤 Esterno
                                        </span>
                                      </div>
                                    </div>
                                    <span className="bg-amber-500/15 border border-amber-500/25 text-amber-300 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg">
                                      Esterno
                                    </span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        </div>

                        {/* NON CONVOCATI COLUMN */}
                        <div className="bg-emerald-950/85 border border-emerald-800 p-5 rounded-3xl shadow-xl flex flex-col space-y-4">
                          <div className="border-b border-emerald-900 pb-3 flex justify-between items-center text-left">
                            <div className="text-left">
                              <h3 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                                <span className="text-red-400 font-sans">
                                  🚫
                                </span>{" "}
                                NON CONVOCATI / ASSENTI
                              </h3>
                              <p className="text-[9px] text-red-400 font-black uppercase tracking-wider mt-0.5">
                                Non selezionati o indisponibili
                              </p>
                            </div>
                            <span className="bg-emerald-900/65 border border-emerald-800 text-red-300 text-[11px] font-black px-3 py-1 rounded-xl shadow-inner font-mono">
                              {nonConvocatiGiocatori.length}
                            </span>
                          </div>

                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {nonConvocatiGiocatori.length === 0 ? (
                              <div className="text-center py-10 text-emerald-500 text-xs italic font-medium">
                                Tutti i tesserati della rosa risultano inseriti
                                convocati!
                              </div>
                            ) : (
                              nonConvocatiGiocatori.map((p) => (
                                <div
                                  key={p.nome}
                                  className="flex items-center justify-between bg-emerald-900/10 border border-emerald-850 p-3 rounded-2xl opacity-65 hover:opacity-100 transition-all hover:bg-emerald-900/20 text-left animate-fadeIn"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold font-mono text-xs border border-emerald-850">
                                      #{p.numeroMaglia || "N/A"}
                                    </div>
                                    <div>
                                      <p className="font-extrabold text-xs text-gray-300 line-through decoration-red-900">
                                        {getLastName(p.nome)}
                                      </p>
                                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-emerald-500 block mt-0.5 text-left">
                                        {p.ultimoRuolo || "Calciatore"}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="bg-red-500/10 border border-red-900/20 text-red-350 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg">
                                    Assente
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : activePublicTab === "statistiche" ? (
            <div className="mt-6 animate-fade-in">
              <StatsHub
                giocatori={giocatori}
                fantasquadre={fantasquadre}
                partiteChiuse={partiteChiuse || []}
                bonuses={bonuses}
                getTeamMatchBreakdownList={getTeamMatchBreakdownList}
              />
            </div>
          ) : (
            <form
              onSubmit={handleRegisterSubmit}
              className="grid grid-cols-1 lg:grid-cols-12 xl:grid-cols-12 gap-6 font-sans"
            >
              <div className="lg:col-span-12 xl:col-span-12">
                <div className="bg-emerald-900/30 border-l-4 border-yellow-500 p-4 rounded-r-xl font-sans shadow-sm mb-4">
                  <p className="text-xs text-emerald-200 leading-relaxed font-medium">
                    <strong className="text-yellow-400">ℹ️ Creazione Squadra / Mercato:</strong> Scegli un Nome per il Team, un indirizzo email ed un <strong>PIN segreto</strong> per proteggere la tua rosa. <br/>Il budget massimo al primo accesso è <strong>60 Izycoin</strong> per 4 giocatori. Successivamente potrai effettuare solo <strong>1 cambio a settimana</strong> per massimizzare le plusvalenze!
                  </p>
                </div>
              </div>
              {/* Left controls column */}
              <div className="lg:col-span-4 xl:col-span-3 space-y-4">
                <div className="bg-emerald-950/80 border border-emerald-800 rounded-2xl p-5 space-y-4 shadow-xl backdrop-blur-md">
                  <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-yellow-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="h-4.5 w-4.5 text-yellow-400" />{" "}
                      Informazioni Generali
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInstructionsTab("guida");
                        setShowInstructionsModal(true);
                      }}
                      className="text-emerald-400 hover:text-yellow-400 transition-colors bg-emerald-900/40 p-1.5 rounded-lg border border-emerald-800"
                      title="Vedi info su crediti e mercato"
                    >
                      <BookOpen className="h-4 w-4" />
                    </button>
                  </h3>

                  {errorMsg && (
                    <div className="bg-red-950/40 border border-red-900/50 text-red-250 text-[11px] p-3 rounded-lg font-bold leading-relaxed animate-fadeIn">
                      ⚠️ {errorMsg}
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Nome Fantasquadra Display */}
                    <div className="space-y-1 bg-emerald-900/40 border border-emerald-900 rounded-xl p-3.5 relative">
                      <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-[9px] text-emerald-300 font-extrabold uppercase tracking-wider">
                          Online
                        </span>
                      </div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-emerald-400">
                        La tua Fantasquadra
                      </label>
                      <div className="flex items-center justify-between py-0.5">
                        <p className="text-sm font-black text-white">
                          ⚽ {nomeFantasquadra || "Senza Nome"}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setNuovoNomeSquadra(nomeFantasquadra);
                            setShowRenameModal(true);
                          }}
                          className="bg-emerald-800/60 hover:bg-emerald-700/80 text-emerald-300 p-1.5 rounded-lg transition-colors"
                          title="Rinomina squadra"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Nome Presidente Display */}
                    <div className="space-y-1 bg-emerald-900/40 border border-emerald-900 rounded-xl p-3.5">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-emerald-400">
                        Presidente della Squadra
                      </label>
                      <p className="text-xs font-bold text-gray-200 py-0.5">
                        👤 {nomePartecipante || "Senza Presidente"}
                      </p>
                    </div>

                    {/* Email Associata */}
                    {(() => {
                      const matched = fantasquadre.find(
                        (fs) =>
                          fs.id === authenticatedTeamId ||
                          fs.nomeFantasquadra.toLowerCase().trim() ===
                            nomeFantasquadra.toLowerCase().trim(),
                      );
                      if (matched && matched.email) {
                        return (
                          <div className="space-y-1 bg-emerald-900/40 border border-emerald-900 rounded-xl p-3.5">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-emerald-400">
                              Email Associata
                            </label>
                            <p className="text-xs font-bold text-gray-300 font-mono py-0.5 truncate">
                              ✉️ {matched.email}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Disconnect Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            "Sei sicuro di voler effettuare la disconnessione dal portale? Potrai accedere nuovamente tramite login.",
                          )
                        ) {
                          // Clear active session and local cache coordinates
                          localStorage.removeItem("fantaEmail");
                          localStorage.removeItem("fantaPassword");
                          setAuthenticatedTeamId(null);
                          setNomeFantasquadra("");
                          setNomePartecipante("");
                          setPin("");
                          setSelectedPlayers([]);
                          setHasInteracted(false);
                          setSyncDone(false);
                          setSyncProgress(0);
                        }
                      }}
                      className="w-full bg-emerald-950/60 hover:bg-red-950/20 hover:text-red-400 border border-emerald-900 hover:border-red-900/40 text-[10px] text-emerald-300 font-extrabold uppercase py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                    >
                      🔌 Cambia Squadra / Esci
                    </button>
                  </div>

                  {/* Selected Players list */}
                  <div className="pt-2 border-t border-emerald-900 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                        Roster Selezionato
                      </span>
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-black font-mono transition-all ${
                          selectedPlayers.length === 4
                            ? "bg-emerald-500 text-emerald-950"
                            : "bg-emerald-800 text-emerald-200 animate-pulse"
                        }`}
                      >
                        {selectedPlayers.length}/4
                      </span>
                    </div>

                    <div className="bg-emerald-900/30 border border-emerald-900 rounded-xl p-3 min-h-[160px] max-h-[220px] overflow-y-auto space-y-1">
                      {selectedPlayers.length === 0 ? (
                        <div className="text-[10px] text-emerald-500 text-center py-10 font-medium leading-relaxed">
                          Seleziona esattamente 4 giocatori dalla lista sulla
                          destra toccando i pulsanti "+".
                          <br />
                          <span className="text-[9px] text-emerald-600 mt-1.5 block">
                            (3 Titolari + 1 Panchinaro)
                          </span>
                        </div>
                      ) : (
                        selectedPlayers.map((name, idx) => {
                          const isPanchinaro = idx === 3;
                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between px-2 py-1.5 rounded-lg border transition-all text-[11px] font-bold group ${
                                isPanchinaro
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse-slow"
                                  : "bg-emerald-900/40 hover:bg-emerald-900 border-emerald-805/40 text-gray-300"
                              }`}
                            >
                              <span className="truncate pr-1 flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`text-[9px] px-1 rounded font-black ${isPanchinaro ? "bg-amber-400 text-amber-950 font-mono" : "bg-emerald-900 text-emerald-300 font-mono"}`}
                                >
                                  {isPanchinaro ? "PAN" : `TIT`}
                                </span>
                                <span className="truncate">
                                  {getLastName(name)}
                                </span>
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {selectedPlayers.length === 4 &&
                                  !isPanchinaro && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Move this player to index 3 so they become panchinaro
                                        const others = selectedPlayers.filter(
                                          (p) => p !== name,
                                        );
                                        setSelectedPlayers([...others, name]);
                                      }}
                                      className="text-[8.5px] bg-emerald-950 hover:bg-emerald-800 hover:text-white border border-emerald-800 px-1.5 py-0.5 rounded-md text-emerald-400 transition-all font-bold cursor-pointer"
                                      title="Metti in panchina"
                                    >
                                      Metti in Panchina
                                    </button>
                                  )}
                                <button
                                  type="button"
                                  onClick={() => handleTogglePlayer(name)}
                                  className="bg-red-950/60 hover:bg-red-900/80 text-red-300 w-5 h-5 rounded-md flex items-center justify-center text-[10px] transition-colors font-black cursor-pointer"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* REAL-TIME COST & LEDGER CALCULATOR */}
                  {(() => {
                    const matchedTeam = fantasquadre.find(
                      (fs) =>
                        fs.id === authenticatedTeamId ||
                        fs.nomeFantasquadra.toLowerCase().trim() ===
                          nomeFantasquadra.toLowerCase().trim(),
                    );

                    if (
                      !matchedTeam ||
                      (matchedTeam.giocatoriSelezionati || []).length < 4
                    ) {
                      // NEW TEAM ENROLLMENT
                      let totalCost = 0;
                      selectedPlayers.forEach((pName) => {
                        totalCost += getPlayerPriceForRoster(
                          pName,
                          partiteChiuse || [],
                          bonuses,
                        );
                      });
                      const remaining = MAX_BUDGET - totalCost;
                      const overBudget = remaining < 0;

                      return (
                        <div className="bg-emerald-950/40 border border-emerald-900/60 rounded-xl p-3.5 space-y-2 mt-2 leading-tight">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-extrabold text-emerald-300">
                              Costo Roster Scelto:
                            </span>
                            <span
                              className={`font-mono font-black border px-2 py-0.5 rounded ${overBudget ? "text-red-400 bg-red-950/20 border-red-900/40" : "text-yellow-300 bg-emerald-950 border-emerald-900"}`}
                            >
                              {totalCost} / {MAX_BUDGET} Izycoin 🪙
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-extrabold text-emerald-300">
                              Monete Restanti:
                            </span>
                            <span
                              className={`font-mono font-black ${overBudget ? "text-red-400 animate-pulse font-extrabold" : "text-emerald-400"}`}
                            >
                              {remaining} Izycoin 🪙
                            </span>
                          </div>
                          {overBudget && (
                            <div className="text-[9px] text-red-300 font-medium border border-red-900/30 bg-red-950/20 p-2 rounded-lg text-left">
                              ⚠️ Attenzione: Hai superato il tetto salariale di{" "}
                              {MAX_BUDGET} Izycoin! Cambia alcuni campioni con
                              dei low-cost.
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      // MODIFYING EXISTING TEAM
                      const economyPrevPlayers =
                        matchedTeam.giocatoriSelezionati || [];
                      const rulePrevPlayers =
                        matchedTeam.rosaOriginaria ||
                        matchedTeam.giocatoriSelezionati ||
                        [];

                      const isLegacy = !matchedTeam.valoriAcquisto;

                      let teamValoriAcquisto = matchedTeam.valoriAcquisto || {};
                      let teamCreditoResiduo = matchedTeam.creditoResiduo ?? 0;

                      if (isLegacy) {
                        teamValoriAcquisto = {};
                        let totalCost = 0;
                        economyPrevPlayers.forEach((pName) => {
                          const ip = getPlayerPriceForRoster(
                            pName,
                            partiteChiuse || [],
                            bonuses,
                          );
                          teamValoriAcquisto[pName] = ip;
                          totalCost += ip;
                        });
                        teamCreditoResiduo = Math.max(
                          0,
                          MAX_BUDGET - totalCost,
                        );
                      }

                      const soldPlayers = economyPrevPlayers.filter(
                        (p) => !selectedPlayers.includes(p),
                      );
                      const boughtPlayers = selectedPlayers.filter(
                        (p) => !economyPrevPlayers.includes(p),
                      );

                      const keptFromOrigin = rulePrevPlayers.filter((p) =>
                        selectedPlayers.includes(p),
                      );
                      const numChangesFromOrigin =
                        rulePrevPlayers.length - keptFromOrigin.length;
                      const hasTooManyChanges =
                        !isMercatoLiberoValido &&
                        rulePrevPlayers.length === 4 &&
                        numChangesFromOrigin > 1;

                      let soldPrice = 0;
                      let boughtPrice = 0;
                      let plusvalenzaReale = 0;

                      soldPlayers.forEach((pName) => {
                        const price = getPlayerPriceForRoster(pName, partiteChiuse || [], bonuses);
                        soldPrice += price;
                        const buyCost = teamValoriAcquisto[pName] ?? price;
                        plusvalenzaReale += (price - buyCost);
                      });

                      boughtPlayers.forEach((pName) => {
                        boughtPrice += getPlayerPriceForRoster(pName, partiteChiuse || [], bonuses);
                      });

                      const finalCredits =
                        teamCreditoResiduo + soldPrice - boughtPrice;
                      const overBudget = finalCredits < 0;

                      return (
                        <div className="bg-emerald-950/45 border border-emerald-990 rounded-xl p-3.5 space-y-2.5 mt-2 leading-tight text-left">
                          <h5 className="text-[9px] font-black uppercase text-yellow-300 border-b border-emerald-900/60 pb-1">
                            📊 BILANCIO CAMBIO ROSA {isMercatoLiberoValido ? "(Mercato Libero)" : "(Max 1)"}
                          </h5>

                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <p className="text-emerald-400 font-bold">
                                Credito Residuo Iniziale:
                              </p>
                              <p className="font-mono font-black text-white">
                                {teamCreditoResiduo} Izycoin 🪙
                              </p>
                            </div>
                            <div>
                              <p className="text-emerald-400 font-bold">
                                Sostituzioni Rilevate:
                              </p>
                              <p
                                className={`font-black ${hasTooManyChanges ? "text-red-400 font-black animate-pulse" : "text-emerald-300"}`}
                              >
                                {numChangesFromOrigin} {isMercatoLiberoValido ? "cambi" : "/ 1 cambio"}
                              </p>
                            </div>
                          </div>

                          {/* Swap Details ledger */}
                          {numChangesFromOrigin > 0 && (
                            <div className="bg-emerald-950/60 border border-emerald-900 p-2.5 rounded-lg space-y-1 text-[9.5px]">
                              <div className="flex justify-between items-center">
                                <span className="text-red-400 font-extrabold truncate max-w-[65%]">
                                  🔴 Cessione: {soldPlayers.join(", ")}
                                </span>
                                <span className="font-mono text-red-450 font-black">
                                  +{soldPrice} 🪙
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-emerald-400 font-extrabold truncate max-w-[65%]">
                                  🟢 Acquisto: {boughtPlayers.join(", ")}
                                </span>
                                <span className="font-mono text-emerald-450 font-black font-black">
                                  -{boughtPrice} 🪙
                                </span>
                              </div>
                              {plusvalenzaReale !== 0 && (
                                <div className="flex justify-between border-t border-emerald-900/40 pt-1 text-[8.5px]">
                                  <span className="text-yellow-300 font-extrabold">
                                    📈 Plusvalenza Finanziaria:
                                  </span>
                                  <span
                                    className={`font-mono font-black ${plusvalenzaReale > 0 ? "text-emerald-450" : "text-red-450"}`}
                                  >
                                    {plusvalenzaReale > 0
                                      ? `+${plusvalenzaReale}`
                                      : plusvalenzaReale}{" "}
                                    Izycoin 🪙
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex justify-between items-center text-xs border-t border-emerald-900/40 pt-1.5">
                            <span className="font-extrabold text-emerald-300 font-sans">
                              Nuovo Tesoretto Residuo:
                            </span>
                            <span
                              className={`font-mono font-black text-sm px-2 py-0.5 rounded border ${overBudget ? "text-red-400 bg-red-950/20 border-red-900/40" : "text-emerald-350 bg-emerald-950 border-emerald-900"}`}
                            >
                              {finalCredits} Izycoin 🪙
                            </span>
                          </div>

                          {hasTooManyChanges && (
                            <p className="text-[9px] text-amber-300 font-semibold border border-amber-900/30 bg-amber-950/20 p-2 rounded-lg">
                              ⚠️ Errore: Puoi fare al massimo 1 cambio alla
                              volta rispetto alla rosa precedente! Ripristina i
                              giocatori originari.
                            </p>
                          )}

                          {overBudget && (
                            <p className="text-[9px] text-red-400 font-semibold border border-red-900/30 bg-red-950/20 p-2 rounded-lg">
                              ⚠️ Errore: Credito insufficiente! Non possiedi
                              abbastanza Izycoin 🪙 per concludere questa
                              operazione di mercato.
                            </p>
                          )}
                        </div>
                      );
                    }
                  })()}

                  <button
                    type="submit"
                    disabled={submitting || lockStatus.isLocked}
                    className="w-full bg-yellow-400 hover:bg-yellow-350 disabled:bg-emerald-900 font-extrabold text-xs uppercase text-emerald-950 py-3 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {submitting
                      ? "Invio della squadra..."
                      : lockStatus.isLocked
                        ? "🔒 Formazioni Bloccate"
                        : "Invia Iscrizione Roster"}
                  </button>
                </div>

                {/* Sezione Consigli/Miglioramenti per il Presidente o l'Amico */}
                <div className="bg-emerald-950/80 border border-emerald-800 rounded-2xl p-5 space-y-4 shadow-xl backdrop-blur-md">
                  <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-yellow-300 flex items-center gap-1.5">
                    <Lightbulb className="h-4.5 w-4.5 text-yellow-400 animate-pulse" />
                    💡 Proponi un Miglioramento
                  </h3>
                  <p className="text-[10px] text-emerald-300/90 font-medium leading-relaxed">
                    Hai idee per questa app o l'organizzazione del
                    Fantacalcetto? Invia una proposta! Comparirà direttamente
                    sulla bacheca dell'amministratore.
                  </p>

                  {consiglioInviatoConSuccesso ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10.5px] rounded-xl p-3.5 font-semibold text-center leading-relaxed">
                      ✨ Grazie! Il tuo suggerimento è stato inviato
                      all'organizzatore con successo.
                      <button
                        type="button"
                        onClick={() => setConsiglioInviatoConSuccesso(false)}
                        className="block mx-auto text-yellow-400 underline font-bold mt-1 text-[9.5px] cursor-pointer"
                      >
                        Invia un'altra proposta
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {consiglioError && (
                        <div className="bg-red-950/40 border border-red-900/50 text-red-300 text-[10px] rounded-xl p-2.5 font-semibold text-center leading-tight">
                          {consiglioError}
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="block text-[8.5px] font-black uppercase tracking-wider text-emerald-400 leading-none">
                          Tuo Nome / Mittente
                        </label>
                        <input
                          type="text"
                          value={consiglioAutore}
                          onChange={(e) => setConsiglioAutore(e.target.value)}
                          placeholder="Es. Marco R."
                          className="w-full bg-emerald-900/40 border border-emerald-850 focus:border-yellow-400 focus:ring-0 rounded-lg px-3 py-2 outline-none text-xs text-white placeholder-emerald-600 font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[8.5px] font-black uppercase tracking-wider text-emerald-400 leading-none">
                          La tua idea / consiglio
                        </label>
                        <textarea
                          value={consiglioTesto}
                          rows={3}
                          onChange={(e) => setConsiglioTesto(e.target.value)}
                          placeholder="Es. Vorrei poter vedere la media punti delle fantasquadre..."
                          className="w-full bg-emerald-900/40 border border-emerald-850 focus:border-yellow-400 focus:ring-0 rounded-lg px-3 py-2 outline-none text-xs text-white placeholder-emerald-600 font-medium"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={invioConsiglioInCorso}
                        onClick={async () => {
                          if (
                            !consiglioAutore.trim() ||
                            !consiglioTesto.trim()
                          ) {
                            setConsiglioError(
                              "Compila sia il nome che il consiglio!",
                            );
                            return;
                          }
                          setInvioConsiglioInCorso(true);
                          setConsiglioError("");
                          try {
                            if (onCreaConsiglio) {
                              await onCreaConsiglio(
                                consiglioAutore,
                                consiglioTesto,
                              );
                            } else {
                              // Fallback to fetch
                              const response = await fetch(
                                "/api/consigli/crea",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    autore: consiglioAutore,
                                    testo: consiglioTesto,
                                  }),
                                },
                              );
                              if (!response.ok)
                                throw new Error("Errore di rete");
                            }
                            setConsiglioAutore("");
                            setConsiglioTesto("");
                            setConsiglioInviatoConSuccesso(true);
                          } catch (err: any) {
                            setConsiglioError(
                              "Impossibile inviare: " + err.message,
                            );
                          } finally {
                            setInvioConsiglioInCorso(false);
                          }
                        }}
                        className="w-full bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-yellow-300 hover:text-white font-extrabold text-[10.5px] uppercase py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {invioConsiglioInCorso
                          ? "Invio..."
                          : "Invia Proposta ✨"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right pool selection Column */}
              <div className="lg:col-span-8 xl:col-span-6 flex flex-col space-y-4">
                <div className="bg-emerald-950/80 border border-emerald-800 rounded-3xl p-5 shadow-xl flex-1 flex flex-col min-h-[400px]">
                  {!isUnlocked ? (
                    <div className="flex-1 flex flex-col justify-center items-center py-10 text-center space-y-6 animate-fadeIn">
                      <div className="relative">
                        <div className="absolute inset-0 bg-yellow-400/10 rounded-full blur-xl animate-pulse"></div>
                        <div className="bg-emerald-900/40 border-2 border-yellow-400/30 p-5 rounded-full relative">
                          <Lock className="h-10 w-10 text-yellow-400" />
                        </div>
                      </div>

                      <div className="space-y-1.5 max-w-sm">
                        <h4 className="font-extrabold text-sm text-white uppercase tracking-wider font-sans">
                          Operazioni di Mercato Protette 🔒
                        </h4>
                        <p className="text-[10px] text-emerald-300 font-medium leading-relaxed font-sans px-2">
                          Per poter modificare la tua fantasquadra, rimpiazzare
                          i calciatori ed effettuare trasferimenti, effettua
                          prima l'accesso digitando il PIN segreto nel pannello
                          a sinistra.
                        </p>
                      </div>

                      {matchedTeam && (
                        <div className="w-full max-w-xs bg-emerald-900/20 border border-emerald-850 rounded-2xl p-4 space-y-3 text-left">
                          <div className="border-b border-emerald-900/50 pb-2 flex justify-between items-center">
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 font-sans">
                              Rosa Attualmente nel Database
                            </span>
                            <span className="text-[8px] font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-400/20">
                              Protetto
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {(matchedTeam.giocatoriSelezionati || []).map(
                              (pName, idx) => {
                                const isPanchinaro = idx === 3;
                                return (
                                  <div
                                    key={idx}
                                    className={`flex items-center justify-between px-3 py-1.5 rounded-xl border text-[11px] font-bold ${
                                      isPanchinaro
                                        ? "bg-amber-500/5 border-amber-500/20 text-amber-300/90"
                                        : "bg-emerald-900/30 border-emerald-850 text-white/95"
                                    }`}
                                  >
                                    <span>
                                      {idx + 1}. {getLastName(pName)}
                                    </span>
                                    <span className="text-[8px] font-bold uppercase tracking-wider opacity-60 text-emerald-400">
                                      {isPanchinaro ? "Panc." : "Titolare"}
                                    </span>
                                  </div>
                                );
                              },
                            )}

                            {(!matchedTeam.giocatoriSelezionati ||
                              matchedTeam.giocatoriSelezionati.length ===
                                0) && (
                              <p className="text-[10px] text-emerald-500 text-center py-4 italic font-medium">
                                Nessun giocatore registrato per questa squadra.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Search / filter bar */}
                      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between pb-4 border-b border-emerald-900">
                        <div className="space-y-0.5">
                          <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">
                            Scegli i tuoi Campioni (max 3)
                          </h4>
                          <p className="text-[10px] text-emerald-400 font-medium">
                            Pool dei giocatori reali attivi tesserati
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {lockStatus.match && currentConvocati.length > 0 && (
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[9px] font-black uppercase text-emerald-400 bg-emerald-900/40 border border-emerald-850 px-2.5 py-1.5 rounded-xl transition-all hover:bg-emerald-900/60">
                              <input
                                type="checkbox"
                                checked={filterConvocati}
                                onChange={(e) =>
                                  setFilterConvocati(e.target.checked)
                                }
                                className="rounded text-yellow-400 focus:ring-0 cursor-pointer accent-yellow-400 h-3 w-3"
                              />
                              <span>Solo Convocati</span>
                            </label>
                          )}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Cerca giocatore..."
                              className="pl-8.5 pr-4 py-1.5 bg-emerald-900/60 border border-emerald-850 rounded-xl text-xs font-semibold focus:border-yellow-400 outline-none w-full sm:w-40 text-white placeholder-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Convocati Quick Ref panel */}
                      {lockStatus.match && currentConvocati.length > 0 && (
                        <div className="mt-4 bg-emerald-900/15 border border-emerald-850/70 rounded-2xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-yellow-300 flex items-center gap-1">
                              🏃 CONVOCATI DELLA SETTIMANA (
                              {currentConvocati.length})
                            </span>
                            <span className="text-[9px] text-emerald-400/80 font-bold hidden sm:inline">
                              Tocca i giocatori sotto per selezionarli
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                            {currentConvocati.map((name, idx) => {
                              const isSelected = selectedPlayers.includes(name);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  disabled={lockStatus.isLocked}
                                  onClick={() => handleTogglePlayer(name)}
                                  className={`text-[10px] h-6 font-bold px-2.5 rounded-lg transition-all cursor-pointer select-none border ${
                                    isSelected
                                      ? "bg-yellow-400 border-yellow-300 text-emerald-950 font-black shadow-md scale-95"
                                      : "bg-emerald-950/60 border-emerald-850 text-emerald-200 hover:bg-emerald-900/50"
                                  }`}
                                >
                                  {getLastName(name)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Grid selectors */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto max-h-[460px] pt-4 pr-1">
                        {filteredPool.length === 0 ? (
                          <div className="col-span-2 text-center text-xs text-emerald-500 py-20 font-medium">
                            Nessun giocatore corrisponde alla ricerca ed ai
                            filtri attivi.
                          </div>
                        ) : (
                          filteredPool.map((p) => {
                            const isSelected = selectedPlayers.includes(p.nome);
                            const isConvocato = currentConvocati.some(
                              (name) =>
                                name.toLowerCase().trim() ===
                                p.nome.toLowerCase().trim(),
                            );
                            return (
                              <div
                                key={p.nome}
                                onClick={() => handleTogglePlayer(p.nome)}
                                className={`border rounded-2xl p-3 flex items-center justify-between cursor-pointer select-none transition-all ${
                                  isSelected
                                    ? "bg-yellow-450/15 border-yellow-400 text-white shadow-md ring-1 ring-yellow-400/50"
                                    : "bg-emerald-900/20 border-emerald-850 text-emerald-100 hover:bg-emerald-900/40"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {/* Maglia Jersey indicator */}
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                                      isSelected
                                        ? "bg-yellow-400 text-emerald-950"
                                        : "bg-emerald-800 text-emerald-300"
                                    }`}
                                  >
                                    #{p.numeroMaglia || "??"}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-black truncate text-left">
                                      {getLastName(p.nome)}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                      <span className="inline-block bg-emerald-950/60 text-[8px] uppercase font-bold tracking-widest text-emerald-450 px-1.5 py-0.5 rounded">
                                        {p.ultimoRuolo || "N/D"}
                                      </span>
                                      {lockStatus.match && (
                                        <span
                                          className={`inline-block text-[8px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded ${
                                            isConvocato
                                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                              : "bg-amber-550/15 text-amber-300 border border-amber-800/25 animate-pulse"
                                          }`}
                                        >
                                          {isConvocato
                                            ? "🟢 Convocato"
                                            : "🚫 Fuori Lista (Selezionabile)"}
                                        </span>
                                      )}
                                    </div>
                                    {(() => {
                                      const playerStats = getPlayerStatsObj(
                                        p.nome,
                                      );
                                      const pPrice = getPlayerCurrentPrice(
                                        p.nome,
                                        playerStats.fantaScore,
                                        partiteChiuse,
                                        bonuses,
                                        giocatori
                                      );
                                      const basePrice = getPlayerBasePrice(
                                        p.nome,
                                      );
                                      const diff = pPrice - basePrice;
                                      return (
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                          <span className="inline-flex items-center gap-0.5 bg-yellow-450/10 border border-yellow-400/20 text-[9.5px] font-black text-yellow-300 px-2 py-0.5 rounded-lg font-mono">
                                            🪙 {pPrice} Izycoin
                                          </span>
                                          <span
                                            className={`text-[8px] font-black font-semibold leading-none ${diff > 0 ? "text-emerald-400 font-mono" : diff < 0 ? "text-red-400 font-mono" : "text-gray-400/80 font-mono"}`}
                                          >
                                            {diff > 0
                                              ? `▲ +${diff}`
                                              : diff < 0
                                                ? `▼ ${diff}`
                                                : "➖ st."}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                    {(() => {
                                      const bonusKey = getPlayerBonusKey(
                                        p.nome,
                                      );
                                      const baseBonuses = bonusKey
                                        ? (bonuses || DEFAULT_BONUSES).filter(
                                            (b) =>
                                              b.isPersonale &&
                                              b.giocatoreId === bonusKey,
                                          )
                                        : [];
                                      if (
                                        !baseBonuses ||
                                        baseBonuses.length === 0
                                      )
                                        return null;
                                      return (
                                        <div className="mt-1.5 space-y-0.5 bg-yellow-950/35 border border-yellow-900/35 p-1.5 rounded-lg text-[9px]/tight text-yellow-300">
                                          <span className="font-extrabold text-[8px] uppercase tracking-wider block text-yellow-400 text-left">
                                            🎒 Bonus Personali:
                                          </span>
                                          {baseBonuses.map((b) => (
                                            <div
                                              key={b.id}
                                              className="leading-tight text-left"
                                            >
                                              ⭐{" "}
                                              <span className="font-bold text-yellow-250">
                                                {b.nome}
                                              </span>
                                              :{" "}
                                              <span className="text-emerald-200/90">
                                                {b.descrizione}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>

                                <div className="shrink-0 pl-1.5">
                                  {isSelected ? (
                                    <span className="w-6 h-6 rounded-full bg-yellow-400 text-emerald-950 flex items-center justify-center font-black text-xs shadow-sm">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="w-6 h-6 rounded-full bg-emerald-850 hover:bg-emerald-700 text-emerald-300 flex items-center justify-center font-black text-xs">
                                      +
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Market Values Column */}
              <div className="xl:col-span-3 lg:col-span-12 flex flex-col space-y-4">
                <div className="bg-emerald-950/80 border border-emerald-800 rounded-3xl p-5 shadow-xl flex-1 flex flex-col min-h-[400px]">
                  <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-yellow-300 flex items-center gap-1.5 mb-3 pb-3 border-b border-emerald-900">
                    💰 Tabellone Quotazioni
                  </h3>
                  <p className="text-[9px] text-emerald-400 font-medium mb-3 leading-tight">
                    Prezzo base (10) + Valore forma in base alla media degli
                    ultimi 3 voti e bonus passati.
                  </p>
                  <div className="flex-1 overflow-y-auto max-h-[440px] pr-1 space-y-2.5">
                    {marketValuations.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-emerald-900/20 border border-emerald-850 p-2 rounded-xl transition hover:bg-emerald-900/40"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-[10.5px] font-black text-white truncate">
                            {getLastName(p.nome)}
                          </span>
                          <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">
                            {p.ruolo || "N/D"}
                          </span>
                        </div>
                        <div className="font-mono text-yellow-400 text-[10px] font-black bg-yellow-450/10 px-2 py-1 rounded-lg border border-yellow-400/20 shrink-0">
                          {p.price} 🪙
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Custom Transfer Confirmation Modal */}
        {showConfirmModal && proposedTransfer && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-emerald-950 border-2 border-emerald-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-fadeIn relative">
              <div className="text-center space-y-2">
                <div className="bg-yellow-450/15 border border-yellow-500/30 p-3 rounded-full inline-block">
                  <AlertCircle className="h-8 w-8 text-yellow-400 animate-pulse" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wider text-yellow-300">
                  Riepilogo e Conferma Cambio
                </h3>
                <p className="text-[10px] text-emerald-300 font-bold leading-normal">
                  Controlla i dettagli del movimento di mercato prima di inviare
                  e bloccare la rosa.
                </p>
              </div>

              {/* Dettaglio Movimento */}
              <div className="bg-emerald-900/40 border border-emerald-800/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="bg-red-950/40 border border-red-900/30 rounded-xl p-3 shrink-1 flex-1 text-center">
                    <span className="block text-[8px] font-black uppercase text-red-400 tracking-wider">
                      Cessione
                    </span>
                    <span className="block text-xs font-bold text-white truncate">
                      {proposedTransfer.sold}
                    </span>
                    <span className="block text-[10px] text-red-300 font-mono mt-0.5">
                      +{proposedTransfer.soldPrice} Izycoin 🪙
                    </span>
                  </div>

                  <div className="font-black text-yellow-400 text-lg">➔</div>

                  <div className="bg-green-950/40 border border-green-900/30 rounded-xl p-3 shrink-1 flex-1 text-center">
                    <span className="block text-[8px] font-black uppercase text-green-400 tracking-wider">
                      Acquisto
                    </span>
                    <span className="block text-xs font-bold text-white truncate">
                      {proposedTransfer.bought}
                    </span>
                    <span className="block text-[10px] text-green-300 font-mono mt-0.5">
                      -{proposedTransfer.boughtPrice} Izycoin 🪙
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-900 flex justify-between items-center text-[11px] font-semibold text-emerald-300">
                  <span>Credito finale rimanente:</span>
                  <span className="text-yellow-400 font-mono font-bold text-xs">
                    {proposedTransfer.remainingCredits} Izycoin 🪙
                  </span>
                </div>
              </div>

              {/* Warning Block */}
              <div className="bg-emerald-950/40 border-2 border-emerald-900/50 rounded-2xl p-4 text-center space-y-1.5">
                <p className="text-[10.5px] text-emerald-300 font-extrabold leading-relaxed uppercase">
                  ATTENZIONE: Stai utilizzando il tuo slot di mercato
                </p>
                <p className="text-[9px] text-emerald-400/90 font-bold leading-normal">
                  Il regolamento prevede al massimo un solo cambio per turno di
                  gioco. I 3 giocatori non sostituiti resteranno bloccati,
                  mentre potrai eventualmente ripensarci su quest'ultimo slot
                  scambiandolo con altri svincolati fino ad un'ora dall'inizio
                  della partita.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setProposedTransfer(null);
                  }}
                  className="w-full bg-emerald-900/50 hover:bg-emerald-900 border border-emerald-800 hover:border-emerald-700 font-black text-[10.5px] uppercase text-emerald-300 py-3 rounded-lg transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={executeRosterUpdate}
                  className="w-full bg-yellow-450 hover:bg-yellow-400 disabled:bg-emerald-900 font-black text-[10.5px] uppercase text-emerald-950 py-3 rounded-lg shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  {submitting ? "Invio..." : "Sì, Conferma"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Foot footer info */}
        <div className="text-center text-[10px] text-emerald-600 font-bold select-none pt-6 shrink-0">
          Easy Rigging © {new Date().getFullYear()} • Portale protetto e
          criptato
        </div>

        {selectedMatchBreakdown && (
          <MatchBreakdownModal
            mb={selectedMatchBreakdown.mb}
            teamName={selectedMatchBreakdown.teamName}
            onClose={() => setSelectedMatchBreakdown(null)}
            generateMatchPdf={generateMatchPdf}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW RENDER 2: ADMINISTRATOR DASHBOARD & LEADERBOARD
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Visual Header card */}
      <div className="bg-emerald-900/10 border border-emerald-800/15 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-yellow-450/15 text-yellow-500 rounded-lg shrink-0">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-gray-900 uppercase tracking-tight">
                Pannello di Controllo Fantacalcetto
              </h2>
            </div>
            {isEditor && onToggleMercatoLibero && (
              <label className="flex items-center gap-2 cursor-pointer bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider transition-colors shadow-sm ml-4">
                <input
                  type="checkbox"
                  checked={sessioneMercatoLibero}
                  onChange={async (e) => {
                    const isEnabling = e.target.checked;
                    if (isEnabling) {
                      setShowMercatoModal(true);
                      setMercatoDateString("");
                    } else {
                      if (window.confirm("Disattivare la Sessione di Mercato Libero (ripristina limite 1 cambio)?")) {
                        await onToggleMercatoLibero(false, null);
                      }
                    }
                  }}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                Mercato Libero: {sessioneMercatoLibero ? (isMercatoLiberoValido ? "ATTIVO" : "SCADUTO") : "OFF"}
              </label>
            )}
          </div>
          <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-xl">
            Gestisci le tessere iscritte, monitora l'andamento in tempo reale,
            ottieni la classifica pesata con punteggio dinamico ricavato dai
            referti reali di campionato!
          </p>
        </div>

        {/* Private Sharing Link trigger widget */}
        <div className="bg-white border border-gray-150 p-4 rounded-2xl flex flex-col gap-2.5 shadow-xs shrink-0 w-full sm:w-auto">
          <div>
            <h4 className="text-[10px] uppercase font-black tracking-wider text-emerald-700 leading-none">
              Canale Pubblico
            </h4>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
              Accedi o condividi con i partecipanti
            </p>
          </div>
          
          {/* Link Primario */}
          <div className="space-y-2 mb-2 pb-2 border-b border-gray-100">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}${window.location.pathname}?portal=true`}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[10px] font-mono font-bold select-all outline-none text-gray-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyLink}
                className={`py-1.5 font-bold text-[10.5px] uppercase rounded-lg shadow-2xs cursor-pointer transition-all flex items-center justify-center gap-1 shrink-0 ${
                  copied
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 hover:bg-gray-150 text-gray-800 border border-gray-200"
                }`}
              >
                <Copy className="h-3 w-3" />
                <span>{copied ? "Copiato" : "Copia Link"}</span>
              </button>
              <a
                href={`${window.location.origin}${window.location.pathname}?portal=true`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 font-bold text-[10.5px] uppercase bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 text-center border border-emerald-950"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Apri Portale</span>
              </a>
            </div>
            {isEditor && (
              <button
                onClick={() => onTogglePortaleBlocco && onTogglePortaleBlocco(!portale1Bloccato)}
                className={`w-full mt-2 py-1.5 font-bold text-[10.5px] uppercase rounded-lg shadow-2xs cursor-pointer transition-all flex items-center justify-center gap-1 shrink-0 ${
                  portale1Bloccato
                    ? "bg-red-100 text-red-800 border border-red-200 hover:bg-red-200"
                    : "bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                {portale1Bloccato ? <Lock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 opacity-50" />}
                <span>{portale1Bloccato ? "Sblocca Portale" : "Blocca Portale"}</span>
              </button>
            )}
          </div>

          {/* Link Secondario: V2 */}
          <div className="space-y-2">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}${window.location.pathname}?portal=v2`}
              className="w-full bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 text-[10px] font-mono font-bold select-all outline-none text-indigo-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?portal=v2`);
                }}
                className={`py-1.5 font-bold text-[10.5px] uppercase rounded-lg shadow-2xs cursor-pointer transition-all flex items-center justify-center gap-1 shrink-0 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200`}
              >
                <Copy className="h-3 w-3" />
                <span>Copia V2</span>
              </button>
              <a
                href={`${window.location.origin}${window.location.pathname}?portal=v2`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 font-bold text-[10.5px] uppercase bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 text-center"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Fantacalcetto Prova (V2)</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Grid summarizing stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-150 rounded-2xl p-4.5 shadow-2xs flex items-center gap-4">
          <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-700">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-black text-gray-400 tracking-wider">
              Fantasquadre Iscritte
            </span>
            <span className="text-xl sm:text-2xl font-black text-gray-900 font-mono">
              {fantasquadre.length}
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-150 rounded-2xl p-4.5 shadow-2xs flex items-center gap-4">
          <div className="w-11 h-11 bg-yellow-50 rounded-xl flex items-center justify-center text-yellow-650">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-black text-gray-400 tracking-wider">
              Punteggio Massimo Reale
            </span>
            <span className="text-xl sm:text-2xl font-black text-gray-900 font-mono">
              {rankedTeams.length > 0 ? rankedTeams[0].score : 0} p.ti
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-150 rounded-2xl p-4.5 shadow-2xs flex items-center gap-4 col-span-1 sm:col-span-2 md:col-span-1">
          <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-amber-700">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-black text-gray-400 tracking-wider">
              Formula Fantacalcetto
            </span>
            <span className="text-xs font-bold text-gray-600">
              Punti base disattivati. Calcolo tramite Bonus/Malus Extra e Ruoli.
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Classification Table (Left) and Registrations listing (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Leaderboard classifications column */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Condivisore Animato */}
          <div className="bg-indigo-950/80 border border-indigo-700/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl mb-2">
            <div>
              <h3 className="text-white font-black text-sm flex items-center gap-2 mb-1"><Trophy className="w-5 h-5 text-yellow-400" /> Generatore Grafiche Podio</h3>
              <p className="text-indigo-200 text-xs font-medium leading-relaxed max-w-sm">Crea l'animazione del podio da condividere: scegli se calcolarla per il campionato o per i migliori giocatori di un singolo team.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
              <select 
                value={podiumSquadraTarget}
                onChange={(e) => setPodiumSquadraTarget(e.target.value)}
                className="bg-indigo-900 text-white text-xs border border-indigo-700 rounded-xl p-2.5 font-bold outline-none flex-1 sm:w-48 appearance-none"
              >
                <option value="Tutte">Tutte (Classifica FantaSquadre)</option>
                <option value="GiocatoriAssoluti">Tutti i Giocatori Fanta</option>
                {fantasquadre.map(f => (
                  <option key={f.id} value={f.id}>{f.nomeFantasquadra}</option>
                ))}
              </select>
              <button 
                onClick={() => setShowPodiumAnimation(true)}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-xs font-extrabold py-2.5 px-5 rounded-xl shadow-lg transition-all transform active:scale-95 whitespace-nowrap outline-none cursor-pointer"
              >
                PLAY ANIMAZIONE
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-150 rounded-2xl shadow-2xs overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-150 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wide">
                  Classifica Fantacalcetto
                </h3>
                <p className="text-[10px] text-gray-400 leading-tight">
                  Generata in tempo reale dalle statistiche della Rosa dei
                  giocatori
                </p>
              </div>
              <div className="flex items-center gap-2 select-none">
                {rankedTeams.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActivePublicTab("statistiche")}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase px-3.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition-transform hover:-translate-y-0.5"
                    title="Vedi referto, statistiche avanzate ed esporta per i social"
                  >
                    <span>📊 Hub Statistiche & Referti</span>
                  </button>
                )}
                <span className="bg-emerald-100 text-emerald-850 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0">
                  Ufficiale
                </span>
              </div>
            </div>

            {rankedTeams.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-medium">
                Nessun team iscritto al Fantacalcetto. Condividi il link di
                iscrizione per accumulare partecipanti!
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Podiums visuals for top 3 if available */}
                <div className="p-5 bg-gradient-to-b from-gray-50/50 to-white border-b border-gray-100 flex flex-wrap gap-4 items-center justify-around select-none">
                  {rankedTeams.slice(0, 3).map((item, index) => {
                    const badgeColor =
                      index === 0
                        ? "bg-yellow-100 text-yellow-800 border-yellow-250 animate-bounce"
                        : index === 1
                          ? "bg-slate-100 text-slate-800 border-slate-250"
                          : "bg-amber-100 text-amber-800 border-amber-250";
                    const subtitleLabel =
                      index === 0
                        ? "🥇 Primo"
                        : index === 1
                          ? "🥈 Secondo"
                          : "🥉 Terzo";
                    return (
                      <div
                        key={item.id}
                        className="text-center bg-white border border-gray-150 p-3 rounded-2xl shadow-3xs flex flex-col items-center justify-center min-w-[130px]"
                      >
                        <span
                          className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full border ${badgeColor}`}
                        >
                          {subtitleLabel}
                        </span>
                        <p
                          className="font-black text-xs text-gray-800 mt-2 truncate max-w-[110px]"
                          title={item.nomeFantasquadra}
                        >
                          {item.nomeFantasquadra}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate max-w-[115px]">
                          Da {item.nomePartecipante}
                        </p>
                        <span className="text-base font-black font-mono text-emerald-800 mt-1">
                          {item.score}{" "}
                          <span className="text-[10px] text-gray-400 font-bold">
                            pnt
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Classification standard listing table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-500 font-medium">
                    <thead className="bg-gray-55/60 text-[9px] font-black uppercase tracking-wider text-gray-450 border-b border-gray-150">
                      <tr>
                        <th className="px-5 py-2.5 text-center w-12">Pos</th>
                        <th className="px-3 py-2.5">
                          Fantasquadra & Presidente
                        </th>
                        <th className="px-3 py-2.5 text-right font-mono w-28">
                          Punteggio Totale
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-750">
                      {rankedTeams.map((team, index) => {
                        const isTop = index < 3;
                        return (
                          <tr key={team.id} className="hover:bg-gray-50/40">
                            <td className="px-5 py-3 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-mono text-xs font-bold ${
                                  index === 0
                                    ? "bg-yellow-400 text-yellow-950 font-black h-6.5 w-6.5"
                                    : index === 1
                                      ? "bg-slate-200 text-slate-800"
                                      : index === 2
                                        ? "bg-amber-650 text-white"
                                        : "text-gray-500 bg-gray-100"
                                }`}
                              >
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-extrabold text-gray-850 truncate max-w-[200px]">
                                {team.nomeFantasquadra}
                              </p>
                              <p className="text-[10px] text-gray-400 font-medium font-sans">
                                Presidente:{" "}
                                <strong className="font-bold text-gray-500">
                                  {team.nomePartecipante}
                                </strong>
                              </p>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-sm font-black font-mono text-emerald-700">
                                {team.score}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 ml-1">
                                p
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* List of Registrations and detail expansion Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-gray-150 rounded-2xl shadow-2xs overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-150 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wide">
                  Rose & Organigrammi
                </h3>
                <p className="text-[10px] text-gray-400 leading-tight">
                  Roster completati e opzioni ammnistrative
                </p>
              </div>
              <span className="text-[11px] font-black font-mono bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                {fantasquadre.length} Team
              </span>
            </div>

            {fantasquadre.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-medium">
                Nessuna fantasquadra registrata.
              </div>
            ) : (
              (() => {
                const sortedTeams = [...fantasquadre].sort((a, b) =>
                  a.nomeFantasquadra.localeCompare(b.nomeFantasquadra),
                );
                const selectedTeamToView =
                  sortedTeams.find((t) => t.id === expandedTeamId) ||
                  sortedTeams[0];
                const score = calculateTeamScore(selectedTeamToView);

                return (
                  <div className="p-4 space-y-4">
                    {/* DROPDOWN & GRID SELECTION FOR TEAM */}
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wide text-gray-500 pl-1">
                          <span>📋</span>
                          <span>
                            Seleziona Squadra Menu a Tendina (
                            {fantasquadre.length})
                          </span>
                        </div>
                        <div className="relative">
                          <select
                            id="team-select-dropdown"
                            value={selectedTeamToView.id}
                            onChange={(e) => setExpandedTeamId(e.target.value)}
                            className="w-full sm:w-64 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-extrabold text-blue-950 shadow-xs focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 cursor-pointer"
                          >
                            {sortedTeams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.nomeFantasquadra.toUpperCase()} —{" "}
                                {team.nomePartecipante}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wide text-gray-500 mb-2 pl-1">
                        <span>🏷️</span>
                        <span>
                          Squadre Iscritte (Griglia da 3 colonne con a capo
                          automatico)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pb-2">
                        {sortedTeams.map((team) => (
                          <button
                            id={`team-btn-${team.id}`}
                            key={team.id}
                            type="button"
                            onClick={() => setExpandedTeamId(team.id)}
                            className={`px-3.5 py-2.5 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                              selectedTeamToView.id === team.id
                                ? "bg-emerald-950 border-emerald-800 text-white shadow-md ring-2 ring-emerald-500/30 scale-100"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-emerald-50 hover:border-emerald-200 scale-95 opacity-80"
                            }`}
                          >
                            <span className="font-black text-xs uppercase tracking-wider truncate mb-0.5">
                              {team.nomeFantasquadra}
                            </span>
                            <span
                              className={`text-[9px] font-bold truncate ${selectedTeamToView.id === team.id ? "text-emerald-400" : "text-gray-400"}`}
                            >
                              👤 {team.nomePartecipante}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* MASTER DETAIL VIEW FOR SELECTED TEAM */}
                    <div className="border border-emerald-100 bg-emerald-50/40 rounded-2xl p-4 sm:p-5 space-y-5 animate-fadeIn shadow-sm">
                      {/* Header */}
                      <div className="flex justify-between items-start border-b border-emerald-100 pb-4">
                        <div className="min-w-0 pr-4">
                          <h2 className="text-base sm:text-lg font-black text-emerald-950 mb-1 truncate">
                            {selectedTeamToView.nomeFantasquadra}
                          </h2>
                          <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest flex items-center gap-2 flex-wrap">
                            <span>
                              👤 {selectedTeamToView.nomePartecipante}
                            </span>
                            <span className="text-emerald-300 hidden sm:inline">
                              •
                            </span>
                            <span className="bg-emerald-100/50 px-1.5 py-0.5 rounded text-emerald-800">
                              Iscritto il{" "}
                              {new Date(
                                selectedTeamToView.dataInserimento,
                              ).toLocaleDateString("it-IT")}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0 bg-white border border-emerald-100 rounded-xl px-3 py-2 shadow-xs">
                          <span className="text-xl font-black font-mono text-emerald-700 block leading-none">
                            {score}
                          </span>
                          <span className="text-[8px] uppercase tracking-wider font-extrabold text-emerald-500/80 block mt-1 leading-none">
                            Punti Fanta
                          </span>
                        </div>
                      </div>

                      {/* Roster & Bonuses */}
                      <div>
                        <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5 mb-3">
                          <h4 className="text-[10px] uppercase font-black tracking-widest text-emerald-800 flex items-center gap-1.5">
                            <span>👥</span> Roster & Statistiche
                          </h4>
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-200/50 px-2 py-0.5 rounded-full">
                            {selectedTeamToView.giocatoriSelezionati.length}/4
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-semibold text-gray-700 text-[11px]">
                          {selectedTeamToView.giocatoriSelezionati.map(
                            (pName, index) => {
                              const stats = getPlayerStatsObj(pName);
                              const isBench = index === 3;
                              const bKey = getPlayerBonusKey(pName);
                              const userBonuses = bKey
                                ? (bonuses || DEFAULT_BONUSES).filter(
                                    (b) =>
                                      b.isPersonale && b.giocatoreId === bKey,
                                  )
                                : [];

                              return (
                                <div
                                  key={index}
                                  className={`border p-3 rounded-xl flex flex-col gap-2 ${
                                    isBench
                                      ? "bg-amber-50/80 border-amber-200 shadow-xs"
                                      : "bg-white border-emerald-100 shadow-xs"
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="min-w-0 pr-2">
                                      <p className="truncate font-extrabold text-gray-800 text-xs flex items-center gap-2">
                                        <span>
                                          {index + 1}. {getLastName(pName)}
                                        </span>
                                        <span
                                          className={`text-[8px] px-1.5 py-0.5 rounded leading-none font-bold font-mono tracking-wide ${isBench ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}
                                        >
                                          {isBench ? "Panchina" : "Titolare"}
                                        </span>
                                      </p>
                                    </div>
                                    <span
                                      className="font-mono text-[10px] bg-emerald-900 text-yellow-300 border border-emerald-800 rounded-lg px-2 py-1 shrink-0 font-black shadow-xs"
                                      title="Fantascore campionato"
                                    >
                                      {stats.fantaScore > 0 ? "+" : ""}
                                      {stats.fantaScore} pt
                                    </span>
                                  </div>

                                  <div className="text-[9.5px] leading-relaxed">
                                    <p className="text-emerald-700 font-black mb-1.5">
                                      STATISTICHE GENERALI (
                                      {stats.campionato.gol +
                                        stats.campionato.assist +
                                        stats.campionato.ammonizioni +
                                        stats.campionato.espulsioni >
                                      0
                                        ? "Attive"
                                        : "Vuote"}
                                      )
                                    </p>
                                    <div className="grid grid-cols-4 gap-1 text-center bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                                      <div>
                                        <span className="block text-gray-400 font-bold uppercase text-[8px]">
                                          Gol
                                        </span>
                                        <span className="font-black text-emerald-600">
                                          {stats.campionato.gol}{" "}
                                          <span className="text-[8px] font-mono opacity-60">
                                            (+
                                            {stats.campionato.gol * GOAL_POINTS}
                                            )
                                          </span>
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-gray-400 font-bold uppercase text-[8px]">
                                          Assist
                                        </span>
                                        <span className="font-black text-emerald-600">
                                          {stats.campionato.assist}{" "}
                                          <span className="text-[8px] font-mono opacity-60">
                                            (+
                                            {stats.campionato.assist *
                                              ASSIST_POINTS}
                                            )
                                          </span>
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-gray-400 font-bold uppercase text-[8px]">
                                          Gialli
                                        </span>
                                        <span className="font-black text-amber-600">
                                          {stats.campionato.ammonizioni}{" "}
                                          <span className="text-[8px] font-mono opacity-60">
                                            (
                                            {stats.campionato.ammonizioni *
                                              AMMO_POINTS}
                                            )
                                          </span>
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-gray-400 font-bold uppercase text-[8px]">
                                          Rossi
                                        </span>
                                        <span className="font-black text-red-600">
                                          {stats.campionato.espulsioni}{" "}
                                          <span className="text-[8px] font-mono opacity-60">
                                            (
                                            {stats.campionato.espulsioni *
                                              ESPU_POINTS}
                                            )
                                          </span>
                                        </span>
                                      </div>
                                    </div>

                                    {/* Bonus Visibility Block */}
                                    {userBonuses.length > 0 ? (
                                      <div className="mt-2.5">
                                        <p className="text-amber-700 font-black mb-1 uppercase text-[8.5px] tracking-wider">
                                          🌟 Bonus Univoci Assegnati:
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                          {userBonuses.map((b, i) => (
                                            <div
                                              key={i}
                                              className="text-[8.5px] font-bold text-amber-900 bg-amber-100/60 px-1.5 py-1 rounded-md border border-amber-200/60 inline-flex items-center gap-1"
                                              title={b.descrizione}
                                            >
                                              <span>🎒</span>{" "}
                                              <span>{b.nome}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        <span className="text-[8.5px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 border border-gray-200">
                                          <span>🎒</span>{" "}
                                          <span>Nessun bonus dedicato</span>
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>

                      {/* Dettaglio Match Reports */}
                      {(() => {
                        const matchBreakdown =
                          getTeamMatchBreakdownList(selectedTeamToView);
                        return (
                          <div className="pt-2">
                            <h4 className="text-[10px] uppercase font-black tracking-widest text-emerald-800 flex items-center gap-1.5 border-b border-emerald-200 pb-1.5 mb-3">
                              <span>📈</span> DETTAGLIO PARTITE REFERTATE (
                              {matchBreakdown.length})
                            </h4>
                            {matchBreakdown.length === 0 ? (
                              <div className="bg-white border border-gray-150 rounded-xl p-5 text-center shadow-xs">
                                <p className="text-[10px] text-gray-400 font-medium">
                                  Nessun match di campionato refertato finora
                                  per questa squadra.
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
                                {matchBreakdown.map((mb, mbIdx) => (
                                  <div
                                    key={mbIdx}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedMatchBreakdown({
                                        mb,
                                        teamName:
                                          selectedTeamToView.nomeFantasquadra,
                                      });
                                    }}
                                    className="bg-white border border-emerald-100/60 rounded-xl p-3.5 flex items-center justify-between shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group"
                                  >
                                    <div className="min-w-0 pr-2">
                                      <p
                                        className="text-[11px] font-black text-emerald-950 truncate group-hover:text-emerald-700 transition-colors"
                                        title={mb.dettagli}
                                      >
                                        ⚔️{" "}
                                        {mb.dettagli.split(" - ")[0] ||
                                          mb.dettagli}
                                      </p>
                                      {mb.dettagli.includes(" - ") && (
                                        <p className="text-[8.5px] text-gray-400 font-extrabold truncate mt-0.5 text-left uppercase tracking-wide">
                                          {mb.dettagli
                                            .split(" - ")
                                            .slice(1)
                                            .join(" - ")}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right shrink-0 flex items-center gap-2.5">
                                      <span className="font-mono text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                        {mb.puntiTotaliMatch > 0 ? "+" : ""}
                                        {mb.puntiTotaliMatch} pt
                                      </span>
                                      <span className="text-[10px] text-gray-300 group-hover:text-emerald-500 font-bold transition-colors">
                                        ➔
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Delete Admin Action */}
                      {isEditor && (
                        <div className="flex justify-end pt-3 border-t border-emerald-200 mt-4">
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  `Sei sicuro di voler eliminare la fantasquadra '${selectedTeamToView.nomeFantasquadra}'? Questa azione è irreversibile.`,
                                )
                              ) {
                                try {
                                  await onEliminaFantasquadra(
                                    selectedTeamToView.id,
                                  );
                                  setExpandedTeamId(null);
                                } catch (err: any) {
                                  alert(err.message || "Errore rimozione.");
                                }
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 border border-red-300 rounded-lg text-red-800 font-extrabold text-[10px] uppercase cursor-pointer transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Rimuovi Fantasquadra</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </div>

      {selectedMatchBreakdown && (
        <MatchBreakdownModal
          mb={selectedMatchBreakdown.mb}
          teamName={selectedMatchBreakdown.teamName}
          onClose={() => setSelectedMatchBreakdown(null)}
          generateMatchPdf={generateMatchPdf}
        />
      )}

      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-emerald-950 border border-emerald-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4 font-sans text-center">
            <h3 className="text-lg font-black text-white uppercase tracking-wider">
              Rinomina Squadra
            </h3>
            <p className="text-xs text-emerald-200">
              Inserisci il nuovo nome da assegnare alla tua squadra. L'azione sarà immediata.
            </p>
            <input
              type="text"
              className="w-full bg-emerald-900 border border-emerald-700 rounded-xl px-4 py-3 text-white text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Es. Atletico Fanta"
              value={nuovoNomeSquadra}
              onChange={(e) => setNuovoNomeSquadra(e.target.value)}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="flex-1 bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 py-3 rounded-xl font-bold uppercase text-xs transition-colors"
                disabled={submitting}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!nuovoNomeSquadra.trim() || !authenticatedTeamId) return;
                  setSubmitting(true);
                  try {
                    await onRinominaFantasquadra(authenticatedTeamId, nuovoNomeSquadra);
                    // L'aggiornamento avverrà tramite stream o reload dati
                    setShowRenameModal(false);
                    // Sync the local state
                    setNomeFantasquadra(nuovoNomeSquadra);
                  } catch (e: any) {
                    alert(e.message || "Errore durante la rinominazione");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || !nuovoNomeSquadra.trim() || nuovoNomeSquadra.trim() === nomeFantasquadra}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 py-3 rounded-xl font-black uppercase text-xs transition-colors"
              >
                {submitting ? "Salvataggio..." : "Salva Nuove Info"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMercatoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-sm px-4">
          <div className="bg-white border-2 border-blue-900 rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl relative p-5 font-sans">
            <h3 className="text-lg font-black text-blue-900 uppercase mb-2">Attiva Sessione Libera</h3>
            <p className="text-xs text-gray-600 mb-4 font-medium leading-relaxed">
              Il mercato libero sospenderà temporaneamente i limiti ai cambi sulle rose.
              Puoi impostare una scadenza automatica (opzionale):
            </p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">Scadenza (Opzionale)</label>
              <input
                type="datetime-local"
                value={mercatoDateString}
                onChange={(e) => setMercatoDateString(e.target.value)}
                className="w-full text-xs font-bold p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-800"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowMercatoModal(false);
                  setMercatoDateString("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
               >
                Annulla
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onToggleMercatoLibero) {
                    let finalDate = null;
                    if (mercatoDateString) {
                      const d = new Date(mercatoDateString);
                      if (!isNaN(d.getTime())) {
                        finalDate = d.toISOString();
                      }
                    }
                    await onToggleMercatoLibero(true, finalDate);
                  }
                  setShowMercatoModal(false);
                  setMercatoDateString("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                Conferma Attivazione
               </button>
            </div>
          </div>
        </div>
      )}

      {showGeneralReportModal && (
        <GeneralReportModal
          rankedTeams={rankedTeams}
          partiteChiuse={partiteChiuse || []}
          getTeamMatchBreakdownList={getTeamMatchBreakdownList}
          onClose={() => setShowGeneralReportModal(false)}
          generateGeneralReportPdf={generateGeneralReportPdf}
        />
      )}

      {matchForPlayerChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-sm">
          <div className="bg-white border-2 border-emerald-900 rounded-2xl w-full max-w-sm p-5 shadow-2xl relative">
            <button onClick={() => setMatchForPlayerChoice(null)} className="absolute top-3 right-3 text-emerald-900 hover:text-red-600 bg-emerald-100 hover:bg-emerald-200 p-1.5 rounded-full transition-colors z-10"><X className="w-4 h-4" /></button>
            <h3 className="font-extrabold text-emerald-900 text-lg mb-3">Seleziona Giocatore</h3>
            <p className="text-xs text-gray-600 mb-4">Scegli per quale giocatore generare il report individuale in questa partita.</p>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {(matchForPlayerChoice.referto || []).map((r: any) => (
                <button
                  key={r.nome}
                  onClick={() => {
                    generatePartitaSingoloGiocatorePdf(matchForPlayerChoice, r.nome);
                    setMatchForPlayerChoice(null);
                  }}
                  className="w-full text-left bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 p-3 rounded-xl font-bold text-sm text-emerald-900 flex justify-between items-center transition-colors"
                >
                  {r.nome}
                  <Download className="w-4 h-4 text-emerald-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {matchForTeamChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-sm">
          <div className="bg-white border-2 border-emerald-900 rounded-2xl w-full max-w-sm p-5 shadow-2xl relative">
            <button onClick={() => setMatchForTeamChoice(null)} className="absolute top-3 right-3 text-emerald-900 hover:text-red-600 bg-emerald-100 hover:bg-emerald-200 p-1.5 rounded-full transition-colors z-10"><X className="w-4 h-4" /></button>
            <h3 className="font-extrabold text-emerald-900 text-lg mb-3">Seleziona Fantasquadra</h3>
            <p className="text-xs text-gray-600 mb-4">Scegli per quale fantasquadra generare il dettaglio punti di questa partita.</p>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {rankedTeams.map((team: any) => {
                const matchBreakdowns = getTeamMatchBreakdownList(team);
                const breakdown = matchBreakdowns.find((b: any) => b.matchId === matchForTeamChoice.id);
                if (!breakdown) return null;

                return (
                  <button
                    key={team.id}
                    onClick={() => {
                       generatePartitaSquadraPdf(matchForTeamChoice, team.nomeFantasquadra, breakdown);
                       setMatchForTeamChoice(null);
                    }}
                    className="w-full text-left bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 p-3 rounded-xl font-bold text-sm text-emerald-900 flex justify-between items-center transition-colors"
                  >
                    <div>
                      <span className="block truncate max-w-[220px]">{team.nomeFantasquadra}</span>
                      <span className="block text-[10px] text-gray-500 font-medium">({team.nomePartecipante})</span>
                    </div>
                    <Download className="w-4 h-4 text-emerald-500 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showPodiumAnimation && (
        <PodioGraficoDinamico
          giocatori={giocatori}
          fantasquadre={fantasquadre}
          partiteChiuse={partiteChiuse}
          bonuses={bonuses}
          rankedTeams={rankedTeams}
          targetId={podiumSquadraTarget}
          onClose={() => setShowPodiumAnimation(false)}
        />
      )}
    </div>
  );
}

function GeneralReportModal({ rankedTeams, getTeamMatchBreakdownList, onClose, generateGeneralReportPdf, partiteChiuse }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-sm px-4">
      <div className="bg-white border-2 border-emerald-900 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-emerald-900 hover:text-red-600 bg-emerald-100 hover:bg-emerald-200 p-1.5 rounded-full transition-colors z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 font-sans">
          <div className="border-b border-emerald-100 pb-4 mb-4 pr-6">
            <h3 className="text-lg font-black text-emerald-950 mb-1 leading-tight uppercase tracking-tight">
              📄 Referto Generale
            </h3>
            <p className="text-xs text-emerald-700 font-extrabold flex items-center justify-between">
              Classifica e Punteggi di tutte le squadre
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-black uppercase text-emerald-900 bg-emerald-100 px-2 py-1 rounded inline-block mb-3">1. Classifica Generale</h4>
              <div className="overflow-x-auto rounded-xl border border-emerald-200 shadow-sm">
                <table className="w-full text-[10px] text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-800 text-white font-extrabold uppercase tracking-wider">
                      <th className="p-2 border-b border-emerald-900">Pos</th>
                      <th className="p-2 border-b border-emerald-900">Squadra</th>
                      <th className="p-2 border-b border-emerald-900">Presidente</th>
                      <th className="p-2 border-b border-emerald-900 text-right">Punti Fanta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedTeams.map((team: any, idx: number) => (
                      <tr key={team.id} className="border-b border-emerald-100 hover:bg-emerald-50 text-gray-800">
                        <td className="p-2 font-black">{idx + 1}°</td>
                        <td className="p-2 font-extrabold truncate max-w-[120px]">{team.nomeFantasquadra}</td>
                        <td className="p-2 font-semibold truncate max-w-[100px]">{team.nomePartecipante}</td>
                        <td className="p-2 font-mono font-black text-right text-emerald-700">{team.score} pt</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-black uppercase text-emerald-900 bg-emerald-100 px-2 py-1 rounded inline-block mb-3">2. Dettagli per Squadra</h4>
              <div className="space-y-4">
                {rankedTeams.map((team: any) => {
                  const breakdowns = getTeamMatchBreakdownList(team);
                  return (
                    <div key={team.id} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <h5 className="font-extrabold text-[11px] text-emerald-900 uppercase border-b border-emerald-200 pb-1 mb-2">⚽ {team.nomeFantasquadra} ({team.score} pt)</h5>
                      {breakdowns.length === 0 ? (
                        <p className="text-[10px] italic text-emerald-600">Nessuna partita refertata</p>
                      ) : (
                        <div className="space-y-2">
                          {breakdowns.map((mb: any, mIdx: number) => (
                           <div key={mIdx} className="bg-white border border-emerald-100 rounded-lg p-2 text-[9px] flexflex-col gap-1">
                             <div className="flex justify-between items-center bg-gray-50 p-1 rounded font-bold mb-1 border-b border-gray-100">
                               <span className="text-gray-800 uppercase tracking-widest">{mb.dettagli.split(" - ")[0]}</span>
                               <span className="text-emerald-700 bg-emerald-100 px-1 rounded">+{mb.puntiTotaliMatch} pt</span>
                             </div>
                             <div className="flex flex-wrap gap-1.5">
                               {mb.giocatoriKpi.map((kpi: any, kIdx: number) => {
                                 const isOut = kpi.stato === "Sostituito" || kpi.stato === "Assente";
                                 return (
                                   <div key={kIdx} className={`px-1.5 py-0.5 rounded border ${isOut ? "bg-red-50 text-red-700 border-red-200 line-through opacity-70" : "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold"}`}>
                                      {kpi.nome}: {isOut ? "0" : kpi.fantaScore}pt
                                   </div>
                                 )
                               })}
                             </div>
                           </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); generateGeneralReportPdf(rankedTeams, partiteChiuse, getTeamMatchBreakdownList); }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-4 py-2 flex items-center justify-center gap-2 rounded-xl shadow w-full font-extrabold uppercase transition-transform hover:-translate-y-0.5"
            >
              <Download className="w-4 h-4" />
              Scarica PDF Ufficiale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchBreakdownModal({
  mb,
  onClose,
  generateMatchPdf,
  teamName,
}: {
  mb: any;
  onClose: () => void;
  generateMatchPdf: any;
  teamName: string;
}) {
  if (!mb) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-sm px-4">
      <div
        className="bg-white border-2 border-emerald-900 rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-emerald-900 hover:text-red-600 bg-emerald-100 hover:bg-emerald-200 p-1.5 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 font-sans">
          <div className="border-b border-emerald-100 pb-3 mb-4 pr-6">
            <h3 className="text-sm font-black text-emerald-950 mb-1 leading-tight uppercase tracking-tight">
              ⚔️ {mb.dettagli}
            </h3>
            <p className="text-xs text-emerald-700 font-extrabold flex items-center justify-between">
              <span>
                Risultato:{" "}
                <span className="text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded ml-1">
                  {mb.risultato}
                </span>
              </span>
              <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-lg border border-yellow-300 font-black">
                + {mb.puntiTotaliMatch} pt
              </span>
            </p>
          </div>

          <div className="space-y-2">
            {mb.giocatoriKpi.map((kpi: any, kIdx: number) => {
              const highlights: string[] = [];
              // Standard Gol and Assist are not added as standalone highlights on the card,
              // since they are already accounted for inside the role bonus list details with their correct values.
              if (kpi.amm > 0)
                highlights.push(`🟨 ${kpi.amm} Amm (-${kpi.amm * 0.5})`);
              if (kpi.rossi > 0)
                highlights.push(`🟥 ${kpi.rossi} Esp (-${kpi.rossi * 1})`);
              if (kpi.bonusBreakdownStr) {
                highlights.push(`🎒 Bonus: ${kpi.bonusBreakdownStr}`);
              } else if (kpi.bonusPts !== 0) {
                highlights.push(
                  `🎒 ${kpi.bonusPts > 0 ? "+" : ""}${kpi.bonusPts} Bonus`,
                );
              }

              const isSostituito = kpi.stato === "Sostituito";
              const isSubentrato = kpi.stato === "Subentrato";
              const isAssente = kpi.stato === "Assente";
              const displayPoints =
                isSostituito || isAssente ? "0.0" : kpi.fantaScore;

              let statusBadge = "";
              const isPanchina =
                kpi.stato === "Panchina" || kpi.ruolo === "Panchina";
              if (isSostituito) statusBadge = " 🔄 Uscito";
              else if (isSubentrato) statusBadge = " ➡️ Entrato";
              else if (isAssente) statusBadge = " ❌ Assente";
              else if (isPanchina && !isSubentrato) statusBadge = " 🎽 Pan.";

              return (
                <div
                  key={kIdx}
                  className={`p-3 rounded-xl border ${isSubentrato ? "bg-amber-50 border-amber-200" : isSostituito || isAssente ? "bg-red-50 border-red-200 opacity-60" : "bg-emerald-50 border-emerald-100"}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-extrabold text-xs text-gray-900 truncate pr-2">
                      {kpi.nome}{" "}
                      {statusBadge && (
                        <span className="font-bold text-[9px] text-gray-500 uppercase ml-1 tracking-wider">
                          {statusBadge}
                        </span>
                      )}
                    </span>
                    <span
                      className={`font-mono font-black text-sm ${isSubentrato ? "text-amber-700" : isSostituito || isAssente ? "text-red-700" : "text-emerald-700"}`}
                    >
                      {displayPoints} pt
                    </span>
                  </div>

                  {highlights.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2 transition-all">
                      {highlights.map((h, hIdx) => {
                        let colorClass =
                          "bg-gray-100 text-gray-700 border-gray-200";
                        if (h.includes("⚽"))
                          colorClass =
                            "bg-emerald-100 text-emerald-800 border-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.3)]";
                        if (h.includes("🤝"))
                          colorClass =
                            "bg-blue-100 text-blue-800 border-blue-300";
                        if (h.includes("🟨"))
                          colorClass =
                            "bg-yellow-100 text-yellow-800 border-yellow-300";
                        if (h.includes("🟥"))
                          colorClass = "bg-red-100 text-red-800 border-red-300";
                        if (h.includes("🎒"))
                          colorClass =
                            "bg-purple-100 text-purple-800 border-purple-300";

                        return (
                          <span
                            key={hIdx}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${colorClass}`}
                          >
                            {h}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    !isSostituito &&
                    !isAssente && (
                      <div className="text-[10px] text-gray-400 italic">
                        Nessun bonus/malus
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                generateMatchPdf(teamName, mb);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-4 py-2 rounded-xl shadow mt-1 font-extrabold uppercase transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-2 w-full cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Scarica Referto Completo PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
