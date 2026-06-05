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
  bonusAttivi?: string[];
  statoPresenza?: "giocato" | "assente" | "sostituito";
  sostitutoDa?: string;
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
  if (n.includes("pinna") || n.includes("orlandini")) return 14;
  if (n.includes("palmas") || n.includes("carrone") || n.includes("scattu") || n.includes("pippia")) return 13;
  if (n.includes("addis") || n.includes("bayre")) return 12;
  return 10;
};

export const getPlayerCurrentPrice = (nome: string, fantaScore: number): number => {
  const base = getPlayerBasePrice(nome);
  let change = 0;
  if (fantaScore >= 4) {
    change = Math.floor((fantaScore - 4) / 6) + 1;
  } else if (fantaScore <= -4) {
    change = -(Math.floor((-fantaScore - 4) / 6) + 1);
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

export const calculatePlayerChampionshipStats = (nome: string, partiteChiuse: Partita[]): PlayerChampionshipStats => {
  let gol = 0;
  let assist = 0;
  let ammonizioni = 0;
  let espulsioni = 0;
  let bonusPts = 0;

  for (const m of partiteChiuse || []) {
    const isAmichevole = m.dettagli ? m.dettagli.toLowerCase().includes("amichevole") : false;
    const inviatoFanta = m.inviatoFanta === true;
    
    if (!isAmichevole && inviatoFanta && m.referto) {
      const r = m.referto.find(x => x.nome.toLowerCase() === nome.toLowerCase());
      if (r) {
        const rGol = Number(r.gol) || 0;
        const rAssist = Number(r.assist) || 0;
        const rAmm = Number(r.amm) || 0;
        const rEsp = Number(r.rossi) || 0;
        const rBonusAttivi = r.bonusAttivi || [];

        const matchBonus = getPlayerBonusPointsForMatch(nome, rBonusAttivi, rGol, rAssist);

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

export const getPlayerPriceForRoster = (nome: string, partiteChiuse: Partita[]): number => {
  const stats = calculatePlayerChampionshipStats(nome, partiteChiuse);
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
  }[];
  fantasquadre?: Fantasquadra[];
  consigli?: Consiglio[];
  syncError?: string | null;
  isGoogleSheetsSynced?: boolean;
}

export interface CustomBonusDef {
  id: string;
  nome: string;
  descrizione: string;
  punti: number | ((gol: number, assist: number) => number);
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
      descrizione: "I Gol (+3 pt extra) e gli Assist (+1 pt extra) dei Presidenti valgono il doppio!",
      punti: (gol: number, assist: number) => (gol * 3) + (assist * 1), // Standard is added, so adding same amount doubles it
    },
    {
      id: "pinna_lazzaro",
      nome: "Bonus Lazzaro 🩹",
      descrizione: "+5 punti se gioca almeno 1’ nonostante gli infortuni",
      punti: 5,
    },
  ],
  Orlandini: [
    {
      id: "orlandini_leggenda",
      nome: "Bonus Leggende 🌟",
      descrizione: "Ogni Gol segnato da vere Leggende del calcetto vale il doppio (+3 pt extra)",
      punti: (gol: number) => gol * 3, // Doubles goals by adding an extra 3 points per goal
    },
    {
      id: "orlandini_buon_pastore",
      nome: "Bonus buon pastore 🐑",
      descrizione: "+2 punti se ci degna della sua presenza al campo",
      punti: 2,
    },
  ],
  Pittiu: [
    {
      id: "pittiu_mcbonus",
      nome: "McBonus 🍟",
      descrizione: "+2 punti se posta foto in fast food nei giorni antecedenti la partita (tag alla squadra)",
      punti: 2,
    },
    {
      id: "pittiu_survivor",
      nome: "Bonus survivor 🛡️",
      descrizione: "+1 punto se conclude partita senza infortuni",
      punti: 1,
    },
  ],
  Pippia: [
    {
      id: "pippia_papa",
      nome: "Bonus papà 🍼",
      descrizione: "+2 punti se si presenta al campo in qualsiasi veste dopo la nascita del figlio",
      punti: 2,
    },
    {
      id: "pippia_baby_supporter",
      nome: "Bonus baby supporter 👶",
      descrizione: "+5 punti se pubblica story del figlio e tagga la società",
      punti: 5,
    },
    {
      id: "pippia_baby_supporter_jersey",
      nome: "Bonus baby supporter + Maglia/Logo 👕👕",
      descrizione: "+10 punti se compaiono maglia o logo della squadra",
      punti: 10,
    },
  ],
  Scarpellini: [
    {
      id: "scarpellini_tutela",
      nome: "Bonus tutela 🦵",
      descrizione: "+1 punto se si presenta al campo con ginocchiera",
      punti: 1,
    },
    {
      id: "scarpellini_trio",
      nome: "Bonus Tu lo conosci il trio 🎭",
      descrizione: "+1 punto se cita Aldo, Giovanni e Giacomo prima, durante o dopo la partita",
      punti: 1,
    },
  ],
  Palmas: [
    {
      id: "palmas_contabile",
      nome: "Bonus contabile 📊",
      descrizione: "+3 punti se i calcoli a fine partita sono corretti e corrispondono coi saldi",
      punti: 3,
    },
    {
      id: "palmas_reietto",
      nome: "Bonus reietto 🥱",
      descrizione: "+1 punto se sta in panchina senza lamentarsi del minutaggio",
      punti: 1,
    },
  ],
  Mulas: [
    {
      id: "mulas_chiquita",
      nome: "Bonus Chiquita 🍌",
      descrizione: "+2 punti se addenta una banana durante la partita",
      punti: 2,
    },
    {
      id: "mulas_levissima",
      nome: "Bonus Altissima, Purissima, Levissima 💧",
      descrizione: "+1 punto se si avvicina alla panchina per bere durante il match",
      punti: 1,
    },
  ],
  Alimonda: [
    {
      id: "alimonda_mediterraneo",
      nome: "Bonus Mediterraneo 🫂",
      descrizione: "+1 punto se abbraccia Mulas dopo il gol",
      punti: 1,
    },
    {
      id: "alimonda_fabrillazione",
      nome: "Bonus Fabrillazione 💬",
      descrizione: "+1 punto se manda almeno 3 messaggi nella chat della squadra nel match day",
      punti: 1,
    },
  ],
  Lauro: [
    {
      id: "lauro_bibitone",
      nome: "Bonus bibitone 🪣",
      descrizione: "+1 punto se porta in panchina la sua borraccia da 10 litri",
      punti: 1,
    },
    {
      id: "lauro_divo",
      nome: "Bonus divo della grigliata 😎",
      descrizione: "+1 punto se si presenta al campo con gli occhiali da sole",
      punti: 1,
    },
  ],
  Addis: [
    {
      id: "addis_coprifuoco",
      nome: "Bonus coprifuoco 🌃",
      descrizione: "+3 punti se si presenta al campo dopo le ore 21:00",
      punti: 3,
    },
    {
      id: "addis_rischiatutto",
      nome: "Bonus rischiatutto 🎲",
      descrizione: "+5 punti se si trattiene al campo dopo il match",
      punti: 5,
    },
  ],
  Scattu: [
    {
      id: "scattu_arrotino",
      nome: "Bonus È arrivato l'arrotino 📢",
      descrizione: "+1 punto se carica la squadra con un suo classico urlaccio prima, durante o dopo la partita",
      punti: 1,
    },
    {
      id: "scattu_sobrieta",
      nome: "Bonus sobrietà 🥛",
      descrizione: "+3 punti se si presenta al campo sobrio sorseggiando una bottiglietta d’acqua",
      punti: 3,
    },
  ],
  Bayre: [
    {
      id: "bayre_jeff_turner",
      nome: "Bonus Jeff Turner 🍺",
      descrizione: "+5 punti se si presenta in panchina in qualsiasi veste con una birra in mano",
      punti: 5,
    },
    {
      id: "bayre_redivivo",
      nome: "Bonus redivivo 🧟",
      descrizione: "+10 punti se gioca almeno 1’",
      punti: 10,
    },
  ],
  Carrone: [
    {
      id: "carrone_polemichele",
      nome: "Bonus PoleMichele 🤬🚫",
      descrizione: "+7 punti se chiude una partita senza lamentarsi con l’arbitro",
      punti: 7,
    },
    {
      id: "carrone_atleta",
      nome: "Bonus atleta provetto 🏃‍♂️",
      descrizione: "+1 punto se nel riscaldamento, anziché tirare, fa almeno 2 giri di campo di corsa",
      punti: 1,
    },
  ],
  Conti: [
    {
      id: "conti_memoria_ferro",
      nome: "Bonus memoria di ferro 🧠",
      descrizione: "+1 punto se chiude una partita senza sbagliare nomi dei compagni",
      punti: 1,
    },
    {
      id: "conti_fedelta",
      nome: "Bonus fedeltà 🫡",
      descrizione: "+1 punto se nel match day conferma la sua presenza con messaggio in chat",
      punti: 1,
    },
  ],
  Mattana: [
    {
      id: "mattana_pogacar",
      nome: "Bonus Pogačar 🚲",
      descrizione: "+1 punto se si presenta al campo in bicicletta",
      punti: 1,
    },
    {
      id: "mattana_optana",
      nome: "Bonus Opta(na) 📊",
      descrizione: "+1 punto se prima o dopo il match effettua un riepilogo delle sue statistiche",
      punti: 1,
    },
  ],
  Garau: [
    {
      id: "garau_piscina",
      nome: "Bonus Piscina 🏊‍♂️",
      descrizione: "+5 punti se invita un compagno a non 'buttarsi' o simulare in partita",
      punti: 5,
    },
    {
      id: "garau_fedelta",
      nome: "Bonus Fedeltà 🤝",
      descrizione: "+3 punti se dà la disponibilità a giocare, anche se c'è già l'adesione di Mulas",
      punti: 3,
    },
  ],
};

export const GENERIC_BONUSES: CustomBonusDef[] = [
  {
    id: "gen_gol_pivot",
    nome: "⚽ Gol Pivot 🎯",
    descrizione: "+3 punti per gol segnato in posizione di Pivot",
    punti: 3
  },
  {
    id: "gen_gol_laterale",
    nome: "⚽ Gol Laterale 🚀",
    descrizione: "+4 punti per gol segnato dalla fascia laterale",
    punti: 4
  },
  {
    id: "gen_gol_centrale",
    nome: "⚽ Gol Centrale 💣",
    descrizione: "+5 punti per gol segnato dalla zona centrale",
    punti: 5
  },
  {
    id: "gen_gol_portiere",
    nome: "🧤 Gol Portiere 🥅🦅",
    descrizione: "+8 punti per gol segnato dal portiere",
    punti: 8
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
    id: "gen_malus_ammonizione",
    nome: "🟨 Ammonizione Extra ⚠️",
    descrizione: "-1 punto per ammonizione (Malus addizionale/correttivo)",
    punti: -1
  },
  {
    id: "gen_malus_espulsione",
    nome: "🟥 Espulsione Extra 🔴",
    descrizione: "-3 punti per cartellino rosso diretto o doppia ammonizione (Malus addizionale/correttivo)",
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

export const getPlayerBonusPointsForMatch = (
  nomeCompleto: string,
  bonusAttivi: string[],
  gol: number,
  assist: number
): number => {
  let tot = 0;
  
  // 1. Controlla bonus personali
  const key = getPlayerBonusKey(nomeCompleto);
  if (key && PLAYER_CUSTOM_BONUSES[key]) {
    const list = PLAYER_CUSTOM_BONUSES[key];
    for (const bId of bonusAttivi) {
      const bonus = list.find(b => b.id === bId);
      if (bonus) {
        if (typeof bonus.punti === "function") {
          tot += bonus.punti(gol, assist);
        } else {
          tot += bonus.punti;
        }
      }
    }
  }

  // 2. Controlla bonus generici
  for (const bId of bonusAttivi) {
    const bonus = GENERIC_BONUSES.find(b => b.id === bId);
    if (bonus) {
      if (typeof bonus.punti === "function") {
        tot += bonus.punti(gol, assist);
      } else {
        tot += bonus.punti;
      }
    }
  }

  return tot;
};

