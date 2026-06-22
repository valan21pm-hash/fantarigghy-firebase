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
  bonusGolAccreditati?: Record<string, number>;
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
  bonusesSnapshot?: CustomBonusDef[];
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
export const AMMO_POINTS = -0.5;
export const ESPU_POINTS = -1;
export const MAX_BUDGET = 60;

export const getPlayerBasePrice = (nome: string): number => {
  const n = (nome || "").toLowerCase().trim();
  if (n.includes("alimonda") || n.includes("lauro")) return 20;
  if (n.includes("conti")) return 19;
  if (n.includes("mulas")) return 17;
  if (n.includes("scarpellini")) return 16;
  if (n.includes("pittiu") || n.includes("mattana")) return 15;
  if (n.includes("pinna") || n.includes("orlandini") || n.includes("cuccu") || n.includes("nordio")) return 14;
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
      const r = m.referto.find(x => (x.snapshotGiocatore?.nome || x.nome).toLowerCase().trim() === nome.toLowerCase().trim());
      const isPresente = r ? r.statoPresenza === "giocato" : false;
      let matchScore = 0;

      if (r) {
        const rGol = isPresente ? (Number(r.gol) || 0) : 0;
        const rAssist = isPresente ? (Number(r.assist) || 0) : 0;
        const rAmm = isPresente ? (Number(r.amm) || 0) : 0;
        const rEsp = isPresente ? (Number(r.rossi) || 0) : 0;
        const rBonusAttivi = r.bonusAttivi || [];

        const effectiveBonuses = m.bonusesSnapshot || allBonuses;
        const matchBonus = getPlayerBonusPointsForMatch(
          nome,
          rBonusAttivi,
          rGol,
          rAssist,
          effectiveBonuses,
          r.snapshotGiocatore?.ultimoRuolo || fallbackPlayerInfo?.ultimoRuolo,
          rAmm,
          rEsp,
          r.bonusGolAccreditati
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
        } else if (matchScore >= 16) {
          matchChange = 1;
        } else if (matchScore >= 10) {
          matchChange = 0;
        } else if (matchScore >= -5) {
          matchChange = -1;
        } else if (matchScore >= -10) {
          matchChange = -2;
        } else {
          matchChange = -3;
        }
      } else {
        // Non Convocati (Assenti, Sostituti o non a referto)
        if (matchScore >= 15) {
          matchChange = 2;
        } else if (matchScore >= 7) {
          matchChange = 1;
        } else if (matchScore >= -1) {
          matchChange = 0;
        } else if (matchScore >= -5) {
          matchChange = -1;
        } else if (matchScore >= -10) {
          matchChange = -2;
        } else {
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
      const r = m.referto.find(x => (x.snapshotGiocatore?.nome || x.nome).toLowerCase().trim() === nome.toLowerCase().trim());
      if (r) {
        // If player didn't play ("assente"), exclude game points (goals, assists, cards)
        const isPresente = r.statoPresenza === "giocato";
        
        const rGol = isPresente ? (Number(r.gol) || 0) : 0;
        const rAssist = isPresente ? (Number(r.assist) || 0) : 0;
        const rAmm = isPresente ? (Number(r.amm) || 0) : 0;
        const rEsp = isPresente ? (Number(r.rossi) || 0) : 0;
        const rBonusAttivi = r.bonusAttivi || [];

        // Always include bonuses, but filter for game stats if not present
        const effectiveBonuses = m.bonusesSnapshot || allBonuses;
        const matchBonus = getPlayerBonusPointsForMatch(nome, rBonusAttivi, rGol, rAssist, effectiveBonuses, r.snapshotGiocatore?.ultimoRuolo || fallbackPlayerInfo?.ultimoRuolo, rAmm, rEsp, r.bonusGolAccreditati);

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
  return getPlayerCurrentPrice(nome, stats.fantaScore, partiteChiuse, allBonuses, globalGiocatori);
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
  hasResetCambiJune16?: boolean;
}

export interface CustomBonusDef {
  id: string;
  nome: string;
  descrizione: string;
  punti: number;
  moltiplicatoreGol?: number;
  moltiplicatoreAssist?: number;
  moltiplicatoreAmm?: number;
  moltiplicatoreEsp?: number;
  isPersonale?: boolean;
  giocatoreId?: string;
  isAutomatic?: boolean;
  isManuale?: boolean;
  richiedeIngressoInCampo?: boolean;
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
  if (n.includes("cuccu")) return "Cuccu";
  if (n.includes("nordio")) return "Nordio";
  return null;
};

export const getLastName = (fullName: string) => {
  const parts = fullName.trim().split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
};

export const isBonusManuale = (b: CustomBonusDef): boolean => {
  const id = b.id;
  return id === "gen_gol_portiere" ||
         id === "gen_gol_centrale" ||
         id === "gen_gol_laterale" ||
         id === "gen_assist_merda" ||
         id === "pinna_presidenziale" ||
         id === "orlandini_leggenda";
};

export const PLAYER_CUSTOM_BONUSES: Record<string, CustomBonusDef[]> = {
  Pinna: [
    {
      id: "pinna_presidenziale",
      nome: "Bonus presidenziali 👑",
      descrizione: "+3 punti. I Gol o gli Assist speciali presidenziali",
      punti: 3,
      isPersonale: true,
      isManuale: true,
      giocatoreId: "Pinna"
    },
    {
      id: "pinna_lazzaro",
      nome: "Bonus Lazzaro 🩹",
      descrizione: "+5 punti se gioca almeno 1’ nonostante gli infortuni",
      punti: 5,
      isPersonale: true,
      giocatoreId: "Pinna",
      richiedeIngressoInCampo: true
    },
  ],
  Orlandini: [
    {
      id: "orlandini_leggenda",
      nome: "Bonus Leggende 🌟",
      descrizione: "+3 punti per ogni Gol segnato",
      punti: 3,
      isPersonale: true,
      isManuale: true,
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
      giocatoreId: "Pittiu",
      richiedeIngressoInCampo: true
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
      giocatoreId: "Bayre",
      richiedeIngressoInCampo: true
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
  Cuccu: [
    {
      id: "cuccu_chi_cumanna_ca",
      nome: "Bonus Chi cumanna ca' 👑",
      descrizione: "+4 punti se a fine partita ha fatto più bonus in classifica generale di Alimonda",
      punti: 4,
      isPersonale: true,
      giocatoreId: "Cuccu"
    },
    {
      id: "cuccu_colori_sociali",
      nome: "Bonus colori sociali 👕",
      descrizione: "+1 punto se riesce a giocare con la maglia ufficiale della squadra",
      punti: 1,
      isPersonale: true,
      giocatoreId: "Cuccu"
    },
  ],
  Nordio: [
    {
      id: "nordio_gymbro",
      nome: "Bonus Gymbro 💪",
      descrizione: "+4 punti bonus Gymbro",
      punti: 4,
      isPersonale: true,
      giocatoreId: "Nordio"
    },
    {
      id: "nordio_in_ginocchio",
      nome: "In ginocchio da te 🩹",
      descrizione: "+2 punti se chiude la partita senza infortuni",
      punti: 2,
      isPersonale: true,
      giocatoreId: "Nordio"
    }
  ],
};

export const GENERIC_BONUSES: CustomBonusDef[] = [
  {
    id: "gen_gol_pivot",
    nome: "⚽ Gol Pivot 🎯",
    descrizione: "+3 punti per gol segnato in posizione di Pivot",
    punti: 3,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_gol_laterale",
    nome: "⚽ Gol Laterale 🚀",
    descrizione: "+1 punto extra per gol segnato dalla fascia laterale",
    punti: 1,
    isManuale: true,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_gol_centrale",
    nome: "⚽ Gol Centrale 💣",
    descrizione: "+2 punti extra per gol segnato dalla zona centrale",
    punti: 2,
    isManuale: true,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_gol_portiere",
    nome: "🧤 Gol Portiere 🥅🦅",
    descrizione: "+5 punti extra per gol segnato dal portiere",
    punti: 5,
    isManuale: true,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_assist_extra",
    nome: "👟 Assist Extra ⭐",
    descrizione: "+1 punto per assist speciale o determinante",
    punti: 1,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_assist_merda",
    nome: "💩 Assist per gol facile 📉",
    descrizione: "+3 punti per assist per gol facile, sporco o fortuito",
    punti: 3,
    isManuale: true,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_amm_extra",
    nome: "🟨 Ammonizione Extra ⚠️",
    descrizione: "-1 punto per ammonizione (Malus addizionale/correttivo)",
    punti: 0,
    moltiplicatoreAmm: -1,
    isAutomatic: true,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_esp_extra",
    nome: "🟥 Espulsione Extra 🔴",
    descrizione: "-3 punti per cartellino rosso diretto o doppia ammonizione (Malus addizionale/correttivo)",
    punti: 0,
    moltiplicatoreEsp: -3,
    isAutomatic: true,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_imbattuto",
    nome: "🧤 Portiere Imbattuto 🛑",
    descrizione: "+5 punti per rete inviolata (Clean Sheet)",
    punti: 5,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_subisce_meno_3",
    nome: "🧤 Portiere subisce < 3 gol 🛡️",
    descrizione: "+3 punti se il portiere subisce meno di 3 gol nel match",
    punti: 3,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_rigore_parato",
    nome: "🧤 Rigore Parato 🧤🥅",
    descrizione: "+5 punti per rigore parato dal portiere",
    punti: 5,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_tiro_libero_parato",
    nome: "🧤 Tiro Libero Parato ⛔",
    descrizione: "+3 punti per tiro libero parato dal portiere",
    punti: 3,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_mvp_uccheddu",
    nome: "👑 MVP Uccheddu 🥇",
    descrizione: "+3 punti come miglior giocatore eletto d'ufficio",
    punti: 3,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_mvp_social",
    nome: "📱 MVP Social 🗳️",
    descrizione: "+5 punti come miglior giocatore votato sui canali social",
    punti: 5,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_pagelle",
    nome: "📰 Nominato nelle Pagelle 📝",
    descrizione: "+1 punto per menzione d'onore o alta valutazione in pagella",
    punti: 1,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_highlights",
    nome: "🎬 Nominato negli Highlights 📽️",
    descrizione: "+1 punto per presenza nelle azioni salienti del video",
    punti: 1,
    richiedeIngressoInCampo: true
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
    punti: -5,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_malus_tiro_libero_sbagliato",
    nome: "💥 Tiro Libero Sbagliato ❌",
    descrizione: "-3 punti per tiro libero fallito o parato (Malus)",
    punti: -3,
    richiedeIngressoInCampo: true
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
    punti: 1,
    richiedeIngressoInCampo: true
  },
  {
    id: "gen_esultanza_gruppo",
    nome: "🫂 Bonus Esultanza di Gruppo",
    descrizione: "+2 punti se abbraccia o dà il cinque a un compagno dopo un gol (cumulabile).",
    punti: 2,
    richiedeIngressoInCampo: true
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
  ruolo?: string,
  amm: number = 0,
  rossi: number = 0,
  bonusGolAccreditati?: Record<string, number>
): number => {
  let tot = 0;
  
  if (!allBonuses) return 0;
  
  // Inject automatic bonuses based on role if goals > 0
  const activeBonusIds = [...bonusAttivi];
  /*
  if (gol > 0 && ruolo) {
    const r = ruolo.toLowerCase();
    if (r === "pivot" && !activeBonusIds.includes("gen_gol_pivot")) activeBonusIds.push("gen_gol_pivot");
    else if (r === "laterale" && !activeBonusIds.includes("gen_gol_laterale")) activeBonusIds.push("gen_gol_laterale");
    else if (r === "centrale" && !activeBonusIds.includes("gen_gol_centrale")) activeBonusIds.push("gen_gol_centrale");
    else if (r === "portiere" && !activeBonusIds.includes("gen_gol_portiere")) activeBonusIds.push("gen_gol_portiere");
  }
  */

  // Inject automatic card bonuses if amm > 0 or rossi > 0
  if (amm > 0 && !activeBonusIds.includes("gen_amm_extra")) {
    activeBonusIds.push("gen_amm_extra");
  }
  if (rossi > 0 && !activeBonusIds.includes("gen_esp_extra")) {
    activeBonusIds.push("gen_esp_extra");
  }

  for (const bId of activeBonusIds) {
    const b = allBonuses.find(x => x.id === bId);
    if (b) {
      const key = getPlayerBonusKey(nomeCompleto);
      const isPersonaleMatch = b.isPersonale && b.giocatoreId && (
        key === b.giocatoreId ||
        key?.toLowerCase() === b.giocatoreId?.toLowerCase() ||
        b.giocatoreId?.toLowerCase().includes(key?.toLowerCase() || "_not_matched_") ||
        key?.toLowerCase().includes(b.giocatoreId?.toLowerCase() || "_not_matched_")
      );
      if (b.isPersonale && b.giocatoreId && !isPersonaleMatch) {
        continue;
      }
      
      let pts = b.punti || 0;
      
      if (isBonusManuale(b)) {
        const val = bonusGolAccreditati?.[b.id] || 1;
        let basePts = b.punti;
        if (basePts === 0) {
          const defaultB = DEFAULT_BONUSES.find(x => x.id === b.id);
          if (defaultB) basePts = defaultB.punti;
        }
        pts = basePts * val;
      } else if (b.id === "gen_amm_extra") {
        const mult = b.moltiplicatoreAmm ?? -1;
        pts = b.punti + (mult * amm);
      } else if (b.id === "gen_esp_extra") {
        const mult = b.moltiplicatoreEsp ?? -3;
        pts = b.punti + (mult * rossi);
      } else {
        if (b.moltiplicatoreGol !== undefined) {
          pts += (b.moltiplicatoreGol * gol);
        }
        if (b.moltiplicatoreAssist !== undefined) {
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
  ruolo?: string,
  amm: number = 0,
  rossi: number = 0,
  bonusGolAccreditati?: Record<string, number>
): { nome: string, puntiVal: number }[] => {
  const breakdown: { nome: string, puntiVal: number }[] = [];
  
  if (!allBonuses) return breakdown;

  const activeBonusIds = [...bonusAttivi];
  /*
  if (gol > 0 && ruolo) {
    const r = ruolo.toLowerCase();
    if (r === "pivot" && !activeBonusIds.includes("gen_gol_pivot")) activeBonusIds.push("gen_gol_pivot");
    else if (r === "laterale" && !activeBonusIds.includes("gen_gol_laterale")) activeBonusIds.push("gen_gol_laterale");
    else if (r === "centrale" && !activeBonusIds.includes("gen_gol_centrale")) activeBonusIds.push("gen_gol_centrale");
    else if (r === "portiere" && !activeBonusIds.includes("gen_gol_portiere")) activeBonusIds.push("gen_gol_portiere");
  }
  */

  // Inject automatic card bonuses if amm > 0 or rossi > 0
  if (amm > 0 && !activeBonusIds.includes("gen_amm_extra")) {
    activeBonusIds.push("gen_amm_extra");
  }
  if (rossi > 0 && !activeBonusIds.includes("gen_esp_extra")) {
    activeBonusIds.push("gen_esp_extra");
  }

  for (const bId of activeBonusIds) {
    const b = allBonuses.find(x => x.id === bId);
    if (b) {
      const key = getPlayerBonusKey(nomeCompleto);
      const isPersonaleMatch = b.isPersonale && b.giocatoreId && (
        key === b.giocatoreId ||
        key?.toLowerCase() === b.giocatoreId?.toLowerCase() ||
        b.giocatoreId?.toLowerCase().includes(key?.toLowerCase() || "_not_matched_") ||
        key?.toLowerCase().includes(b.giocatoreId?.toLowerCase() || "_not_matched_")
      );
      if (b.isPersonale && b.giocatoreId && !isPersonaleMatch) {
        continue;
      }
      
      let pts = b.punti || 0;
      
      if (isBonusManuale(b)) {
        const val = bonusGolAccreditati?.[b.id] || 1;
        let basePts = b.punti;
        if (basePts === 0) {
          const defaultB = DEFAULT_BONUSES.find(x => x.id === b.id);
          if (defaultB) basePts = defaultB.punti;
        }
        pts = basePts * val;
      } else if (b.id === "gen_amm_extra") {
        const mult = b.moltiplicatoreAmm ?? -1;
        pts = b.punti + (mult * amm);
      } else if (b.id === "gen_esp_extra") {
        const mult = b.moltiplicatoreEsp ?? -3;
        pts = b.punti + (mult * rossi);
      } else {
        if (b.moltiplicatoreGol !== undefined) {
          pts += (b.moltiplicatoreGol * gol);
        }
        if (b.moltiplicatoreAssist !== undefined) {
          pts += (b.moltiplicatoreAssist * assist);
        }
      }

      breakdown.push({ nome: b.nome, puntiVal: pts });
    }
  }

  return breakdown;
};

export const getTeamMatchBreakdownList = (
  team: Fantasquadra,
  partiteChiuse: Partita[],
  giocatori: Giocatore[],
  bonuses: CustomBonusDef[] = DEFAULT_BONUSES
) => {
  const list: {
    matchId: string;
    dettagli: string;
    risultato: string;
    note?: string;
    puntiTotaliMatch: number;
    giocatoriKpi: {
      nome: string;
      gol: number;
      assist: number;
      amm: number;
      rossi: number;
      bonusPts: number;
      fantaScore: number;
      ruolo?: string;
      stato?: string;
      originalFantaScore?: number;
      originalBonusPts?: number;
      originalBonusBreakdownStr?: string;
      bonusPtsNonManuali?: number;
      bonusBreakdownStrNonManuali?: string;
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
      ruolo?: string;
      stato?: string;
      originalFantaScore?: number;
      originalBonusPts?: number;
      originalBonusBreakdownStr?: string;
      bonusPtsNonManuali?: number;
      bonusBreakdownStrNonManuali?: string;
    }[] = [];
    let puntiTotaliMatch = 0;

    const roster =
      m.rosterSnapshot && m.rosterSnapshot[team.id]
        ? m.rosterSnapshot[team.id]
        : team.giocatoriSelezionati;

    const starters = roster.slice(0, 3);
    const benchPlayerName = roster[3];

    const effectiveBonuses = m.bonusesSnapshot || bonuses;

    const getPlayerInfo = (pName: string) => {
      const r = m.referto!.find(
        (x) => (x.snapshotGiocatore?.nome || x.nome).trim().toLowerCase() === pName.trim().toLowerCase(),
      );

      let played = false;
      if (r) {
        if (r.statoPresenza) {
          played = r.statoPresenza === "giocato";
        } else {
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

      const rSubitiAzione = r ? Number(r.subitiAzione) || 0 : 0;
      const rSubitiRigore = r ? Number(r.subitiRigore) || 0 : 0;
      const rSubitiPiazzato = r ? Number(r.subitiPiazzato) || 0 : 0;

      const effectiveBonuses = m.bonusesSnapshot || bonuses;
      const gInfoFallback = giocatori.find(g => g.nome.toLowerCase() === pName.toLowerCase());
      const bonusPts = r
        ? getPlayerBonusPointsForMatch(
            pName,
            rBonusAttivi,
            rGol,
            rAssist,
            effectiveBonuses,
            r.snapshotGiocatore?.ultimoRuolo || gInfoFallback?.ultimoRuolo,
            rAmm,
            rEsp,
            r.bonusGolAccreditati
          )
        : 0;

      const rBonusAttiviNonManuali = rBonusAttivi.filter(bId => {
        const bDef = (effectiveBonuses || DEFAULT_BONUSES).find(x => x.id === bId);
        return bDef ? (!isBonusManuale(bDef) && !bDef.richiedeIngressoInCampo) : true;
      });
      const bonusPtsNonManuali = r
        ? getPlayerBonusPointsForMatch(
            pName,
            rBonusAttiviNonManuali,
            rGol,
            rAssist,
            effectiveBonuses,
            r.snapshotGiocatore?.ultimoRuolo || gInfoFallback?.ultimoRuolo,
            rAmm,
            rEsp,
            r.bonusGolAccreditati
          )
        : 0;

      let bonusBreakdownStr = "";
      let bonusBreakdownStrNonManuali = "";

      if (r) {
        const breakdown = getPlayerBonusBreakdownForMatch(
          pName,
          rBonusAttivi,
          rGol,
          rAssist,
          effectiveBonuses,
          r.snapshotGiocatore?.ultimoRuolo || gInfoFallback?.ultimoRuolo,
          rAmm,
          rEsp,
          r.bonusGolAccreditati
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

        const breakdownNonManuali = getPlayerBonusBreakdownForMatch(
          pName,
          rBonusAttiviNonManuali,
          rGol,
          rAssist,
          effectiveBonuses,
          r.snapshotGiocatore?.ultimoRuolo || gInfoFallback?.ultimoRuolo,
          rAmm,
          rEsp,
          r.bonusGolAccreditati
        );
        if (breakdownNonManuali.length > 0) {
          bonusBreakdownStrNonManuali =
            breakdownNonManuali
              .map(
                (b) =>
                  `${b.nome} (${b.puntiVal > 0 ? "+" : ""}${b.puntiVal})`,
              )
              .join(", ") + ` [Tot Panchina: ${bonusPtsNonManuali > 0 ? "+" : ""}${bonusPtsNonManuali}]`;
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

      let matchChange = 0;
      if (played) {
        if (fantaScore >= 20) matchChange = 2;
        else if (fantaScore >= 16) matchChange = 1;
        else if (fantaScore >= 10) matchChange = 0;
        else if (fantaScore >= -5) matchChange = -1;
        else if (fantaScore >= -10) matchChange = -2;
        else matchChange = -3;
      } else {
        if (fantaScore >= 15) matchChange = 2;
        else if (fantaScore >= 7) matchChange = 1;
        else if (fantaScore >= -1) matchChange = 0;
        else if (fantaScore >= -5) matchChange = -1;
        else if (fantaScore >= -10) matchChange = -2;
        else matchChange = -3;
      }

      if (r && r.malusBrt === true) {
        matchChange -= 1;
      }

      return {
        nome: pName,
        gol: rGol,
        assist: rAssist,
        amm: rAmm,
        rossi: rEsp,
        subitiAzione: rSubitiAzione,
        subitiRigore: rSubitiRigore,
        subitiPiazzato: rSubitiPiazzato,
        bonusPts,
        bonusBreakdownStr,
        fantaScore,
        matchChange,
        played: !!played,
        malusBrt: r ? !!r.malusBrt : false,
        bonusPtsNonManuali,
        bonusBreakdownStrNonManuali,
      };
    };

    const startersInfo = starters.map((p) => getPlayerInfo(p));
    const benchInfo = benchPlayerName ? getPlayerInfo(benchPlayerName) : null;

    let subbedIn = false;
    const finalKpiList: any[] = [];

    for (let i = 0; i < startersInfo.length; i++) {
      const inf = startersInfo[i];
      if (!inf.played && benchInfo && benchInfo.played && !subbedIn) {
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
        const unassignedList: string[] = [];
        if (benchInfo.gol > 0) {
          unassignedList.push(`${benchInfo.gol} Gol (+${benchInfo.gol * GOAL_POINTS} pt)`);
        }
        if (benchInfo.assist > 0) {
          unassignedList.push(`${benchInfo.assist} Assist (+${benchInfo.assist * ASSIST_POINTS} pt)`);
        }
        const bRef = m.referto?.find((ref) => ref.nome === benchPlayerName);
        if (bRef && bRef.bonusAttivi) {
          bRef.bonusAttivi.forEach((bId) => {
            const bDef = (effectiveBonuses || DEFAULT_BONUSES).find((x) => x.id === bId);
            if (bDef && isBonusManuale(bDef)) {
              unassignedList.push(`${bDef.nome} (+${bDef.punti} pt)`);
            }
          });
        }

        finalKpiList.push({
          ...benchInfo,
          ruolo: "Panchina",
          stato: "Panchina",
          originalFantaScore: benchInfo.fantaScore,
          originalBonusPts: benchInfo.bonusPts,
          originalBonusBreakdownStr: benchInfo.bonusBreakdownStr,
          bonusPts: benchInfo.bonusPtsNonManuali,
          bonusBreakdownStr: benchInfo.bonusBreakdownStrNonManuali,
          fantaScore: benchInfo.bonusPtsNonManuali,
          puntiConteggiati: benchInfo.bonusPtsNonManuali,
          unassignedBonuses: unassignedList,
        });
        puntiTotaliMatch += benchInfo.bonusPtsNonManuali;
      }
    }

    puntiTotaliMatch = parseFloat(puntiTotaliMatch.toFixed(1));
    giocatoriKpi.push(...finalKpiList);

    list.push({
      matchId: m.id,
      dettagli: m.dettagli,
      risultato: m.risultato || "N.D.",
      note: m.note,
      puntiTotaliMatch: parseFloat(puntiTotaliMatch.toFixed(1)),
      giocatoriKpi,
    });
  }

  return list;
};

