/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Giocatore {
  nome: string;
  saldo: number;
  gol: number;
  ammonizioni: number;
  ultimoRuolo: string;
  assist: number;
  espulsioni: number;
  golSubitiAzione: number;
  golSubitiRigore: number;
  golSubitiPiazzato: number;
  quotaIscrizione: number;
  attivo: boolean;
  numeroMaglia: number;
}

export interface RefertoGiocatore {
  nome: string;
  gol: number;
  assist: number;
  amm: number;
  rossi: number;
  subitiAzione: number;
  subitiRigore: number;
  subitiPiazzato: number;
  pagaQuota: boolean;
  quotaMaturata?: number;
  bonusAttivi?: string[];
  statoPresenza?: "giocato" | "assente" | "sostituito";
  sostitutoDa?: string;
  verifiedGeneric?: boolean;
  verifiedPersonal?: boolean;
  snapshotGiocatore?: Giocatore; // Data snapshot at match time
  malusBrt?: boolean; // Supplementar -1 Izycoin malus
}

export interface Formazione {
  titolari: string[];
  panchina: string[];
}

export interface Partita {
  id: string;
  dettagli: string;
  costo: number;
  convocati: string[];
  stato: "Aperta" | "Chiusa";
  risultato: string;
  referto: RefertoGiocatore[];
  formazione: Formazione;
  dataInserimento?: string;
  note?: string;
  inviatoFanta?: boolean;
  rosterSnapshot?: Record<string, string[]>;
}

export interface Fantasquadra {
  id: string;
  nomePartecipante: string;
  nomeFantasquadra: string;
  giocatoriSelezionati: string[];
  dataInserimento: string;
  pin?: string;
  email?: string;
  creditoResiduo?: number;
  valoriAcquisto?: Record<string, number>;
  ultimoCambioMatchId?: string;
  rosaOriginaria?: string[];
}

// Fanta point formula coefficients
export const GOAL_POINTS = 3;
export const ASSIST_POINTS = 1;
export const AMMO_POINTS = -1;
export const ESPU_POINTS = -3;
export const MAX_BUDGET = 60;

export const getPlayerBasePrice = (nome: string): number => {
  const n = (nome || "").toLowerCase().trim();
  if (n.includes("alimonda") || n.includes("lauro")) return 20;
  if (n.includes("conti")) return 19;
  if (n.includes("mulas")) return 17;
  if (n.includes("scarpellini")) return 16;
  if (n.includes("pittiu") || n.includes("mattana")) return 15;
  if (n.includes("pinna") || n.includes("orlandini")) return 14;
  if (n.includes("palmas") || n.includes("carrone") || n.includes("scattu") || n.includes("pippia")) return 13;
  if (n.includes("addis") || n.includes("bayre")) return 12;
  return 10;
};

export const getPlayerCurrentPrice = (
  nome: string,
  fantaScore: number,
  partiteChiuse?: Partita[],
  allBonuses: CustomBonusDef[] = DEFAULT_BONUSES,
  globalGiocatori: Giocatore[] = []
): number => {
  const base = getPlayerBasePrice(nome);
  
  if (!partiteChiuse || partiteChiuse.length === 0) {
    // Fallback if no individual match data is passed (e.g. static/initial rendering)
    let change = 0;
    if (fantaScore >= 20) change = 2;
    else if (fantaScore >= 16) change = 1;
    else if (fantaScore >= 10) change = 0;
    else if (fantaScore >= -5) change = -1;
    else if (fantaScore >= -10) change = -2;
    else change = -3;
    return Math.max(1, base + change);
  }

  let change = 0;
  const fallbackPlayerInfo = globalGiocatori.find(g => g.nome.toLowerCase() === nome.toLowerCase());

  for (const m of partiteChiuse) {
    const isAmichevole = m.dettagli ? m.dettagli.toLowerCase().includes("amichevole") : false;
    const inviatoFanta = m.inviatoFanta === true;

    if (!isAmichevole && inviatoFanta && m.referto) {
      const r = m.referto.find(x => (x.snapshotGiocatore?.nome || x.nome).toLowerCase() === nome.toLowerCase());
      const isPresente = r ? r.statoPresenza === "giocato" : false;
      let matchScore = 0;

      if (r) {
        const rGol = isPresente ? (Number(r.gol) || 0) : 0;
        const rAssist = isPresente ? (Number(r.assist) || 0) : 0;
        const rAmm = isPresente ? (Number(r.amm) || 0) : 0;
        const rEsp = isPresente ? (Number(r.rossi) || 0) : 0;
        const rBonusAttivi = r.bonusAttivi || [];

        const matchBonus = getPlayerBonusPointsForMatch(
          nome,
          rBonusAttivi,
          rGol,
          rAssist,
          allBonuses,
          r.snapshotGiocatore?.ultimoRuolo || fallbackPlayerInfo?.ultimoRuolo
        );

        matchScore = parseFloat(
          (
            rGol * GOAL_POINTS +
            rAssist * ASSIST_POINTS +
            rAmm * AMMO_POINTS +
            rEsp * ESPU_POINTS +
            matchBonus
          ).toFixed(1)
        );
      }

      let matchChange = 0;
      if (isPresente) {
        // Convocati (Presenti/Giocati)
        if (matchScore >= 20) {
          matchChange = 2;
        } else if (matchScore >= 16 && matchScore <= 19) {
          matchChange = 1;
        } else if (matchScore >= 10 && matchScore <= 15) {
          matchChange = 0;
        } else if (matchScore >= -5 && matchScore <= 9) {
          matchChange = -1;
        } else if (matchScore >= -10 && matchScore <= -6) {
          matchChange = -2;
        } else if (matchScore <= -11) {
          matchChange = -3;
        }
      } else {
        // Non Convocati (Assenti, Sostituti o non a referto)
        if (matchScore >= 15) {
          matchChange = 2;
        } else if (matchScore >= 7 && matchScore <= 14) {
          matchChange = 1;
        } else if (matchScore >= -1 && matchScore <= 6) {
          matchChange = 0;
        } else if (matchScore >= -5 && matchScore <= -2) {
          matchChange = -1;
        } else if (matchScore >= -10 && matchScore <= -6) {
          matchChange = -2;
        } else if (matchScore <= -11) {
          matchChange = -3;
        }
      }

      // Variazione supplementare di -1 Izycoin se Malus BRT e' spuntato
      if (r && r.malusBrt === true) {
        matchChange -= 1;
      }

      change += matchChange;
    }
  }

  return Math.max(1, base + change);
};

export interface PlayerChampionshipStats {
  gol: number;
  assist: number;
  ammonizioni: number;
  espulsioni: number;
  bonusPts: number;
  fantaScore: number;
}

export const calculatePlayerChampionshipStats = (nome: string, partiteChiuse: Partita[], allBonuses: CustomBonusDef[] = DEFAULT_BONUSES, globalGiocatori: Giocatore[] = []): PlayerChampionshipStats => {
  let gol = 0;
  let assist = 0;
  let ammonizioni = 0;
  let espulsioni = 0;
  let bonusPts = 0;

  const fallbackPlayerInfo = globalGiocatori.find(g => g.nome.toLowerCase() === nome.toLowerCase());

  for (const m of partiteChiuse || []) {
    const isAmichevole = m.dettagli ? m.dettagli.toLowerCase().includes("amichevole") : false;
    const inviatoFanta = m.inviatoFanta === true;
    
    if (!isAmichevole && inviatoFanta && m.referto) {
      const r = m.referto.find(x => (x.snapshotGiocatore?.nome || x.nome).toLowerCase() === nome.toLowerCase());
      if (r) {
        // If player didn't play ("assente"), exclude game points (goals, assists, cards)
        const isPresente = r.statoPresenza === "giocato";
        
        const rGol = isPresente ? (Number(r.gol) || 0) : 0;
        const rAssist = isPresente ? (Number(r.assist) || 0) : 0;
        const rAmm = isPresente ? (Number(r.amm) || 0) : 0;
        const rEsp = isPresente ? (Number(r.rossi) || 0) : 0;
        const rBonusAttivi = r.bonusAttivi || [];

        // Always include bonuses, but filter for game stats if not present
        const matchBonus = getPlayerBonusPointsForMatch(nome, rBonusAttivi, rGol, rAssist, allBonuses, r.snapshotGiocatore?.ultimoRuolo || fallbackPlayerInfo?.ultimoRuolo);

        gol += rGol;
        assist += rAssist;
        ammonizioni += rAmm;
        espulsioni += rEsp;
        bonusPts += matchBonus;
      }
    }
  }

  const fantaScore = parseFloat(((gol * GOAL_POINTS) + (assist * ASSIST_POINTS) + (ammonizioni * AMMO_POINTS) + (espulsioni * ESPU_POINTS) + bonusPts).toFixed(1));

  return {
    gol,
    assist,
    ammonizioni,
    espulsioni,
    bonusPts,
    fantaScore,
  };
};

export const getPlayerPriceForRoster = (nome: string, partiteChiuse: Partita[], allBonuses: CustomBonusDef[] = DEFAULT_BONUSES, globalGiocatori: Giocatore[] = []): number => {
  const stats = calculatePlayerChampionshipStats(nome, partiteChiuse, allBonuses, globalGiocatori);
  return getPlayerCurrentPrice(nome, stats.fantaScore);
};

export interface Consiglio {
  id: string;
  autore: string;
  testo: string;
  data: string;
  letto: boolean;
}

export interface DatabaseSchema {
  giocatori: Giocatore[];
  partite: Partita[];
  campi: string[];
  logs: {
    data: string;
    operazione: string;
    importo: string;
    dettagli: string;
    utente?: string;
  }[];
  fantasquadre?: Fantasquadra[];
  consigli?: Consiglio[];
  bonuses?: CustomBonusDef[];
  sessioneMercatoLibero?: boolean;
  scadenzaMercatoLibero?: string | null;
  portale1Bloccato?: boolean;
  backupsBozze?: any[];
}

export interface CustomBonusDef {
  id: string;
  nome: string;
  descrizione: string;
  punti: number;
  moltiplicatoreGol?: number;
  moltiplicatoreAssist?: number;
  isPersonale?: boolean;
  giocatoreId?: string;
  isAutomatic?: boolean;
}

export const getPlayerBonusKey = (nomeCompleto: string): string | null => {
  const n = (nomeCompleto || "").toLowerCase();
  if (n.includes("pinna")) return "Pinna";
  if (n.includes("orlandini")) return "Orlandini";
  if (n.includes("pittiu")) return "Pittiu";
  if (n.includes("pippia")) return "Pippia";
  if (n.includes("scarpellini")) return "Scarpellini";
  if (n.includes("palmas")) return "Palmas";
  if (n.includes("mulas")) return "Mulas";
  if (n.includes("alimonda")) return "Alimonda";
  if (n.includes("lauro")) return "Lauro";
  if (n.includes("addis")) return "Addis";
  if (n.includes("scattu")) return "Scattu";
  if (n.includes("bayre")) return "Bayre";
  if (n.includes("carrone")) return "Carrone";
  if (n.includes("conti")) return "Conti";
  if (n.includes("mattana")) return "Mattana";
  if (n.includes("garau")) return "Garau";
  return null;
};

export const getLastName = (fullName: string) => {
  const parts = fullName.trim().split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
};

export const PLAYER_CUSTOM_BONUSES: Record<string, CustomBonusDef[]> = {
  Pinna: [
    {
      id: "pinna_presidenziale",
      nome: "Bonus presidenziali 👑",
      descrizione: "I Gol e gli Assist dei Presidenti valgono il doppio (punti gol in base al ruolo)!",
      punti: 0,
      moltiplicatoreGol: 3,
      moltiplicatoreAssist: 1,
      isPersonale: true,
      giocatoreId: "Pinna"
    },
    {
      id: "pinna_lazzaro",
      nome: "Bonus Lazzaro 🩹",
      descrizione: "+5 punti se gioca almeno 1’ nonostante gli infortuni",
      punti: 5,
      isPersonale: true,
      giocatoreId: "Pinna"
    },
  ],
  Orlandini: [
    {
      id: "orlandini_leggenda",
      nome: "Bonus Leggende 🌟",
      descrizione: "Ogni Gol segnato da vere Leggende del calcetto vale il doppio (punti in base al ruolo)!",
      punti: 0,
      moltiplicatoreGol: 3,
      isPersonale: true,
      giocatoreId: "Orlandini"
    },
    {
      id: "orlandini_buon_pastore",
      nome: "Bonus buon pastore 🐑",
      descrizione: "+2 punti se ci degna della sua presenza al campo",
      punti: 2,
      isPersonale: true,
      giocatoreId: "Orlandini"
    },
  ],
  Pittiu: [
    {
      id: "pittiu_mcbonus",
      nome: "McBonus 🍟",
      descrizione: "+2 punti se posta foto in fast food nei giorni antecedenti la partita (tag alla squadra)",
      punti: 2,
      isPersonale: true,
      giocatoreId: "Pittiu"
    },
    {
      id: "pittiu_survivor",
      nome: "Bonus survivor 🛡️",
      descrizione: "+1 punto se conclude partita senza infortuni",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Pittiu"
    },
  ],
  Pippia: [
    {
      id: "pippia_papa",
      nome: "Bonus papà 🍼",
      descrizione: "+2 punti se si presenta al campo in qualsiasi veste dopo la nascita del figlio",
      punti: 2,
      isPersonale: true,
      giocatoreId: "Pippia"
    },
    {
      id: "pippia_baby_supporter",
      nome: "Bonus baby supporter 👶",
      descrizione: "+5 punti se pubblica story del figlio e tagga la società",
      punti: 5,
      isPersonale: true,
      giocatoreId: "Pippia"
    },
    {
      id: "pippia_baby_supporter_jersey",
      nome: "Bonus baby supporter + Maglia/Logo 👕👕",
      descrizione: "+10 punti se compaiono maglia o logo della squadra",
      punti: 10,
      isPersonale: true,
      giocatoreId: "Pippia"
    },
  ],
  Scarpellini: [
    {
      id: "scarpellini_tutela",
      nome: "Bonus tutela 🦵",
      descrizione: "+1 punto se si presenta al campo con ginocchiera",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Scarpellini"
    },
    {
      id: "scarpellini_trio",
      nome: "Bonus Tu lo conosci il trio 🎭",
      descrizione: "+1 punto se cita Aldo, Giovanni e Giacomo prima, durante o dopo la partita",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Scarpellini"
    },
  ],
  Palmas: [
    {
      id: "palmas_contabile",
      nome: "Bonus contabile 📊",
      descrizione: "+3 punti se i calcoli a fine partita sono corretti e corrispondono coi saldi",
      punti: 3,
      isPersonale: true,
      giocatoreId: "Palmas"
    },
    {
      id: "palmas_reietto",
      nome: "Bonus reietto 🥱",
      descrizione: "+1 punto se sta in panchina senza lamentarsi del minutaggio",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Palmas"
    },
  ],
  Mulas: [
    {
      id: "mulas_chiquita",
      nome: "Bonus Chiquita 🍌",
      descrizione: "+2 punti se addenta una banana durante la partita",
      punti: 2,
      isPersonale: true,
      giocatoreId: "Mulas"
    },
    {
      id: "mulas_levissima",
      nome: "Bonus Altissima, Purissima, Levissima 💧",
      descrizione: "+1 punto se si avvicina alla panchina per bere durante il match",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Mulas"
    },
  ],
  Alimonda: [
    {
      id: "alimonda_mediterraneo",
      nome: "Bonus Mediterraneo 🫂",
      descrizione: "+1 punto se abbraccia Mulas dopo il gol",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Alimonda"
    },
    {
      id: "alimonda_fabrillazione",
      nome: "Bonus Fabrillazione 💬",
      descrizione: "+1 punto se manda almeno 3 messaggi nella chat della squadra nel match day",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Alimonda"
    },
  ],
  Lauro: [
    {
      id: "lauro_bibitone",
      nome: "Bonus bibitone 🪣",
      descrizione: "+1 punto se porta in panchina la sua borraccia da 10 litri",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Lauro"
    },
    {
      id: "lauro_divo",
      nome: "Bonus divo della grigliata 😎",
      descrizione: "+1 punto se si presenta al campo con gli occhiali da sole",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Lauro"
    },
  ],
  Addis: [
    {
      id: "addis_coprifuoco",
      nome: "Bonus coprifuoco 🌃",
      descrizione: "+3 punti se si presenta al campo dopo le ore 21:00",
      punti: 3,
      isPersonale: true,
      giocatoreId: "Addis"
    },
    {
      id: "addis_rischiatutto",
      nome: "Bonus rischiatutto 🎲",
      descrizione: "+5 punti se si trattiene al campo dopo il match",
      punti: 5,
      isPersonale: true,
      giocatoreId: "Addis"
    },
  ],
  Scattu: [
    {
      id: "scattu_arrotino",
      nome: "Bonus È arrivato l'arrotino 📢",
      descrizione: "+1 punto se carica la squadra con un suo classico urlaccio prima, durante o dopo la partita",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Scattu"
    },
    {
      id: "scattu_sobrieta",
      nome: "Bonus sobrietà 🥛",
      descrizione: "+3 punti se si presenta al campo sobrio sorseggiando una bottiglietta d’acqua",
      punti: 3,
      isPersonale: true,
      giocatoreId: "Scattu"
    },
  ],
  Bayre: [
    {
      id: "bayre_jeff_turner",
      nome: "Bonus Jeff Turner 🍺",
      descrizione: "+5 punti se si presenta in panchina in qualsiasi veste con una birra in mano",
      punti: 5,
      isPersonale: true,
      giocatoreId: "Bayre"
    },
    {
      id: "bayre_redivivo",
      nome: "Bonus redivivo 🧟",
      descrizione: "+10 punti se gioca almeno 1’",
      punti: 10,
      isPersonale: true,
      giocatoreId: "Bayre"
    },
  ],
  Carrone: [
    {
      id: "carrone_polemichele",
      nome: "Bonus PoleMichele 🤬🚫",
      descrizione: "+7 punti se chiude una partita senza lamentarsi con l’arbitro",
      punti: 7,
      isPersonale: true,
      giocatoreId: "Carrone"
    },
    {
      id: "carrone_atleta",
      nome: "Bonus atleta provetto 🏃‍♂️",
      descrizione: "+1 punto se nel riscaldamento, anziché tirare, fa almeno 2 giri di campo di corsa",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Carrone"
    },
  ],
  Conti: [
    {
      id: "conti_memoria_ferro",
      nome: "Bonus memoria di ferro 🧠",
      descrizione: "+1 punto se chiude una partita senza sbagliare nomi dei compagni",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Conti"
    },
    {
      id: "conti_fedelta",
      nome: "Bonus fedeltà 🫡",
      descrizione: "+1 punto se nel match day conferma la sua presenza con messaggio in chat",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Conti"
    },
  ],
  Mattana: [
    {
      id: "mattana_pogacar",
      nome: "Bonus Pogačar 🚲",
      descrizione: "+1 punto se si presenta al campo in bicicletta",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Mattana"
    },
    {
      id: "mattana_optana",
      nome: "Bonus Opta(na) 📊",
      descrizione: "+1 punto se prima o dopo il match effettua un riepilogo delle sue statistiche",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Mattana"
    },
  ],
  Garau: [
    {
      id: "garau_piscina",
      nome: "Bonus Piscina 🏊‍♂️",
      descrizione: "+5 punti se invita un compagno a non 'buttarsi' o simulare in partita",
      punti: 5,
      isPersonale: true,
      giocatoreId: "Garau"
    },
    {
      id: "garau_fedelta",
      nome: "Bonus Fedeltà 🤝",
      descrizione: "+3 punti se dà la disponibilità a giocare, anche se c'è già l'adesione di Mulas",
      punti: 3,
      isPersonale: true,
      giocatoreId: "Garau"
    },
  ],
};

export const GENERIC_BONUSES: CustomBonusDef[] = [
  {
    id: "gen_gol_pivot",
    nome: "⚽ Gol Pivot 🎯",
    descrizione: "Il gol segnato in posizione di Pivot vale il punteggio base (+3 punti a gol)",
    punti: 0,
    moltiplicatoreGol: 0,
    isAutomatic: true
  },
  {
    id: "gen_gol_laterale",
    nome: "⚽ Gol Laterale 🚀",
    descrizione: "+1 punto extra per gol segnato dalla fascia laterale (+4 punti totali a gol)",
    punti: 0,
    moltiplicatoreGol: 1,
    isAutomatic: true
  },
  {
    id: "gen_gol_centrale",
    nome: "⚽ Gol Centrale 💣",
    descrizione: "+2 punti extra per gol segnato dalla zona centrale (+5 punti totali a gol)",
    punti: 0,
    moltiplicatoreGol: 2,
    isAutomatic: true
  },
  {
    id: "gen_gol_portiere",
    nome: "🧤 Gol Portiere 🥅🦅",
    descrizione: "+5 punti extra per gol segnato dal portiere (+8 punti totali a gol)",
    punti: 0,
    moltiplicatoreGol: 5,
    isAutomatic: true
  },
  {
    id: "gen_assist_extra",
    nome: "👟 Assist Extra ⭐",
    descrizione: "+1 punto per assist speciale o determinante",
    punti: 1
  },
  {
    id: "gen_assist_merda",
    nome: "💩 Assist per gol della merda 📉",
    descrizione: "+3 punti per assist per gol sporco o fortuito (\"gol della merda\")",
    punti: 3
  },
  {
    id: "gen_imbattuto",
    nome: "🧤 Portiere Imbattuto 🛑",
    descrizione: "+5 punti per rete inviolata (Clean Sheet)",
    punti: 5
  },
  {
    id: "gen_subisce_meno_3",
    nome: "🧤 Portiere subisce < 3 gol 🛡️",
    descrizione: "+3 punti se il portiere subisce meno di 3 gol nel match",
    punti: 3
  },
  {
    id: "gen_rigore_parato",
    nome: "🧤 Rigore Parato 🧤🥅",
    descrizione: "+5 punti per rigore parato dal portiere",
    punti: 5
  },
  {
    id: "gen_tiro_libero_parato",
    nome: "🧤 Tiro Libero Parato ⛔",
    descrizione: "+3 punti per tiro libero parato dal portiere",
    punti: 3
  },
  {
    id: "gen_mvp_uccheddu",
    nome: "👑 MVP Uccheddu 🥇",
    descrizione: "+3 punti come miglior giocatore eletto d'ufficio",
    punti: 3
  },
  {
    id: "gen_mvp_social",
    nome: "📱 MVP Social 🗳️",
    descrizione: "+5 punti come miglior giocatore votato sui canali social",
    punti: 5
  },
  {
    id: "gen_pagelle",
    nome: "📰 Nominato nelle Pagelle 📝",
    descrizione: "+1 punto per menzione d'onore o alta valutazione in pagella",
    punti: 1
  },
  {
    id: "gen_highlights",
    nome: "🎬 Nominato negli Highlights 📽️",
    descrizione: "+1 punto per presenza nelle azioni salienti del video",
    punti: 1
  },
  {
    id: "gen_porta_tifosi",
    nome: "👥 Porta tifosi alla partita 📢",
    descrizione: "+2 punti per aver portato amici o supporter sugli spalti",
    punti: 2
  },
  {
    id: "gen_porta_tifosa",
    nome: "👩 Porta tifosa alla partita 💖",
    descrizione: "+3 punti per aver portato supporter femminile al campo",
    punti: 3
  },
  {
    id: "gen_malus_quota",
    nome: "💸 Dimentica la Quota ❌",
    descrizione: "-5 punti per mancato pagamento della quota campo in giornata (Malus)",
    punti: -5
  },
  {
    id: "gen_malus_indumento",
    nome: "👕 Sbaglia completino (cumulativo) ⚠️",
    descrizione: "-5 punti per indumento scompagnato o errato (Malus)",
    punti: -5
  },
  {
    id: "gen_malus_ritardo",
    nome: "⏰ Ritardo > 5 minuti ⏳",
    descrizione: "-3 punti per arrivo in ritardo oltre l'orario di convocazione (Malus)",
    punti: -3
  },
  {
    id: "gen_malus_rigore_sbagliato",
    nome: "💥 Rigore Sbagliato 🥅❌",
    descrizione: "-5 punti per rigore calciato fuori o parato (Malus)",
    punti: -5
  },
  {
    id: "gen_malus_tiro_libero_sbagliato",
    nome: "💥 Tiro Libero Sbagliato ❌",
    descrizione: "-3 punti per tiro libero fallito o parato (Malus)",
    punti: -3
  },
  {
    id: "gen_protesta_arbitro",
    nome: "🗣️ Protesta con Arbitro 🦓",
    descrizione: "-2 punti per proteste plateali col direttore di gara (Malus)",
    punti: -2
  },
  {
    id: "gen_protesta_panchina",
    nome: "🤬 Protesta contro propria panchina 📣",
    descrizione: "-5 punti per scenate o tensioni con compagni/allenatore (Malus)",
    punti: -5
  },
  {
    id: "gen_comportamento_non_easy",
    nome: "🔨 Comportamento Non Easy 🚫🥊",
    descrizione: "-3 punti per gesti violenti, insolenze o danni (calci alle porte/panchine) (Malus)",
    punti: -3
  },
  {
    id: "gen_vecchio_cuore",
    nome: "❤️ Bonus Vecchio Cuore",
    descrizione: "+5 punti se viene a tifare a bordo campo anche se non è stato convocato.",
    punti: 5
  },
  {
    id: "gen_esultanza",
    nome: "🎉 Bonus Esultanza",
    descrizione: "+1 punto se festeggia dopo aver segnato un gol.",
    punti: 1
  },
  {
    id: "gen_esultanza_gruppo",
    nome: "🫂 Bonus Esultanza di Gruppo",
    descrizione: "+2 punti se abbraccia o dà il cinque a un compagno dopo un gol (cumulabile).",
    punti: 2
  },
  {
    id: "gen_social_reaction",
    nome: "👍 Bonus Reaction (Social)",
    descrizione: "+2 punti se mette like al post del Match Day.",
    punti: 2
  },
  {
    id: "gen_social_share",
    nome: "📤 Bonus Share Base (Social)",
    descrizione: "+3 punti se ricondivide il post del Match Day nelle proprie storie IG.",
    punti: 3
  },
  {
    id: "gen_social_motivation",
    nome: "🔥 Bonus Motivation (Social)",
    descrizione: "+5 punti se ricondivide il post nelle storie aggiungendo un dettaglio (testo, emoji o GIF).",
    punti: 5
  },
  {
    id: "gen_social_adv",
    nome: "🏷️ Bonus #Adv (Social)",
    descrizione: "+2 punti se pubblica una storia usando l'hashtag #FantaEasyRigging.",
    punti: 2
  },
  {
    id: "gen_social_highfive",
    nome: "🖐️ Bonus High Five (Social)",
    descrizione: "+3 punti se pubblica una storia in cui dà il cinque al Presidente Pinna (+1 pt extra al Presidente se reposta la storia).",
    punti: 3
  }
];

export const DEFAULT_BONUSES: CustomBonusDef[] = [
  ...GENERIC_BONUSES,
  ...Object.values(PLAYER_CUSTOM_BONUSES).flat()
];

export const getPlayerBonusPointsForMatch = (
  nomeCompleto: string,
  bonusAttivi: string[],
  gol: number,
  assist: number,
  allBonuses: CustomBonusDef[] = DEFAULT_BONUSES,
  ruolo?: string
): number => {
  let tot = 0;
  
  if (!allBonuses) return 0;
  
  // Inject automatic bonuses based on role if goals > 0
  const activeBonusIds = [...bonusAttivi];
  if (gol > 0 && ruolo) {
    const r = ruolo.toLowerCase();
    if (r === "pivot" && !activeBonusIds.includes("gen_gol_pivot")) activeBonusIds.push("gen_gol_pivot");
    else if (r === "laterale" && !activeBonusIds.includes("gen_gol_laterale")) activeBonusIds.push("gen_gol_laterale");
    else if (r === "centrale" && !activeBonusIds.includes("gen_gol_centrale")) activeBonusIds.push("gen_gol_centrale");
    else if (r === "portiere" && !activeBonusIds.includes("gen_gol_portiere")) activeBonusIds.push("gen_gol_portiere");
  }

  // Inject automatic assist bonus if assist > 0
  if (assist > 0 && !activeBonusIds.includes("gen_assist_merda") && !activeBonusIds.includes("gen_assist_extra")) {
    activeBonusIds.push("gen_assist_extra");
  }
  
  for (const bId of activeBonusIds) {
    const b = allBonuses.find(x => x.id === bId);
    if (b) {
      if (b.isPersonale && b.giocatoreId && getPlayerBonusKey(nomeCompleto) !== b.giocatoreId) {
        continue;
      }
      
      let pts = b.punti || 0;

      if ((b.id === "pinna_presidenziale" || b.id === "orlandini_leggenda") && ruolo) {
        const r = ruolo.toLowerCase();
        let val = 3;
        if (r === "laterale") val = 4;
        else if (r === "centrale") val = 5;
        else if (r === "portiere") val = 8;
        pts += val * gol;
      } else if (b.moltiplicatoreGol !== undefined) {
        pts += (b.moltiplicatoreGol * gol);
      }

      if (b.moltiplicatoreAssist !== undefined) {
        if (b.id === "pinna_presidenziale" && activeBonusIds.includes("gen_assist_merda")) {
          // Normal base=1, merda=3 -> subtotal 4. Pinna wants total 6, so we add 2 extra points per assist.
          pts += (2 * assist);
        } else {
          pts += (b.moltiplicatoreAssist * assist);
        }
      }
      
      tot += pts;
    }
  }

  return tot;
};

export const getPlayerBonusBreakdownForMatch = (
  nomeCompleto: string,
  bonusAttivi: string[],
  gol: number,
  assist: number,
  allBonuses: CustomBonusDef[] = DEFAULT_BONUSES,
  ruolo?: string
): { nome: string, puntiVal: number }[] => {
  const breakdown: { nome: string, puntiVal: number }[] = [];
  
  if (!allBonuses) return breakdown;

  const activeBonusIds = [...bonusAttivi];
  if (gol > 0 && ruolo) {
    const r = ruolo.toLowerCase();
    if (r === "pivot" && !activeBonusIds.includes("gen_gol_pivot")) activeBonusIds.push("gen_gol_pivot");
    else if (r === "laterale" && !activeBonusIds.includes("gen_gol_laterale")) activeBonusIds.push("gen_gol_laterale");
    else if (r === "centrale" && !activeBonusIds.includes("gen_gol_centrale")) activeBonusIds.push("gen_gol_centrale");
    else if (r === "portiere" && !activeBonusIds.includes("gen_gol_portiere")) activeBonusIds.push("gen_gol_portiere");
  }

  // Inject automatic assist bonus if assist > 0
  if (assist > 0 && !activeBonusIds.includes("gen_assist_merda") && !activeBonusIds.includes("gen_assist_extra")) {
    activeBonusIds.push("gen_assist_extra");
  }

  for (const bId of activeBonusIds) {
    const b = allBonuses.find(x => x.id === bId);
    if (b) {
      if (b.isPersonale && b.giocatoreId && getPlayerBonusKey(nomeCompleto) !== b.giocatoreId) {
        continue;
      }
      
      let pts = b.punti || 0;
      
      if ((b.id === "pinna_presidenziale" || b.id === "orlandini_leggenda") && ruolo) {
        const r = ruolo.toLowerCase();
        let val = 3;
        if (r === "laterale") val = 4;
        else if (r === "centrale") val = 5;
        else if (r === "portiere") val = 8;
        pts += val * gol;
      } else if (b.moltiplicatoreGol !== undefined) {
        pts += (b.moltiplicatoreGol * gol);
      }

      if (b.moltiplicatoreAssist !== undefined) {
        if (b.id === "pinna_presidenziale" && activeBonusIds.includes("gen_assist_merda")) {
          pts += (2 * assist);
        } else {
          pts += (b.moltiplicatoreAssist * assist);
        }
      }

      // Explicitly include base goal points (3) in the breakdown description for role-based goals
      if (
        b.id === "gen_gol_pivot" ||
        b.id === "gen_gol_laterale" ||
        b.id === "gen_gol_centrale" ||
        b.id === "gen_gol_portiere"
      ) {
        pts += gol * 3;
      }

      breakdown.push({ nome: b.nome, puntiVal: pts });
    }
  }

  return breakdown;
};

