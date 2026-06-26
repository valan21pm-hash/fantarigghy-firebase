import React, { useState, useMemo } from "react";
import {
  BarChart3,
  Trophy,
  Users,
  User,
  Copy,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Search,
  Award,
  Shield,
  Activity,
  Check,
  Calendar,
  Layers,
  ArrowUpDown,
  Hash,
  Share2,
  Coins
} from "lucide-react";
import {
  Giocatore,
  Fantasquadra,
  Partita,
  CustomBonusDef,
  DEFAULT_BONUSES,
  calculatePlayerChampionshipStats,
  getPlayerCurrentPrice,
  getPlayerBasePrice,
  getPlayerBonusBreakdownForMatch,
  getPlayerBonusKey,
  GOAL_POINTS,
  ASSIST_POINTS,
  AMMO_POINTS,
  ESPU_POINTS,
  sortMatchesRecentFirst
} from "../types";

interface StatsHubProps {
  giocatori: Giocatore[];
  fantasquadre: Fantasquadra[];
  partiteChiuse: Partita[];
  bonuses?: CustomBonusDef[];
  getTeamMatchBreakdownList: (team: Fantasquadra) => any[];
}

export default function StatsHub({
  giocatori,
  fantasquadre,
  partiteChiuse,
  bonuses = DEFAULT_BONUSES,
  getTeamMatchBreakdownList
}: StatsHubProps) {
  // Hub States
  const [timeframe, setTimeframe] = useState<"global" | "giornata">("global");
  const [selectedGiornataId, setSelectedGiornataId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"giocatori" | "squadre" | "bonus">("giocatori");
  const [sortOrder, setSortOrder] = useState<"crescente" | "decrescente">("decrescente");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedClassifica, setCopiedClassifica] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("Tutte");
  const [selectedPlayerFilter, setSelectedPlayerFilter] = useState<string>("Tutti");
  const [selectedBonusFilter, setSelectedBonusFilter] = useState<string>("Tutti");
  const [exportType, setExportType] = useState<"standard" | "izycoin" | "punteggi">("standard");
  const [copiedIzycoin, setCopiedIzycoin] = useState(false);
  const [copiedPunteggi, setCopiedPunteggi] = useState(false);

  // Available valid Closed Matches for calculations (non-friendly)
  const validMatches = useMemo(() => {
    const list = (partiteChiuse || []).filter(
      (m) =>
        m.stato === "Chiusa" &&
        m.inviatoFanta === true &&
        !(m.dettagli || "").toLowerCase().includes("amichevole")
    );
    return sortMatchesRecentFirst(list);
  }, [partiteChiuse]);

  // Set default selected jornada if none is selected
  React.useEffect(() => {
    if (validMatches.length > 0 && !selectedGiornataId) {
      setSelectedGiornataId(validMatches[0].id);
    }
  }, [validMatches, selectedGiornataId]);

  const selectedGiornataObj = useMemo(() => {
    return validMatches.find((m) => m.id === selectedGiornataId);
  }, [validMatches, selectedGiornataId]);

  // Clean label/name for the selected jornada or global state
  const currentPeriodLabel = useMemo(() => {
    if (timeframe === "global") return "Torneo Completo";
    if (selectedGiornataObj) return selectedGiornataObj.dettagli || selectedGiornataObj.nome || "Giornata Selezionata";
    return "Nessuna Giornata";
  }, [timeframe, selectedGiornataObj]);

  // 1. ADVANCED PLAYER STATISTICS CALCULATION
  const playerStatsList = useMemo(() => {
    return giocatori.map((g) => {
      // Base info
      const basePrice = getPlayerBasePrice(g.nome);
      
      // Calculate overall stats
      let score = 0;
      let golCount = 0;
      let assistCount = 0;
      let ammCount = 0;
      let espCount = 0;
      let matchesPlayed = 0;

      // Track individual bonus counts
      const bonusCounts: Record<string, number> = {};
      const bonusImpacts: Record<string, number> = {};

      // Match-by-match pricing history
      let currentPrice = basePrice;
      let lastMatchChange = 0;

      // Filter matches depending on selected timeframe
      const targetMatches = timeframe === "global" 
        ? validMatches 
        : (selectedGiornataObj ? [selectedGiornataObj] : []);

      // Calculate state for player
      validMatches.forEach((m) => {
        if (!m.referto) return;
        const r = m.referto.find((x) => (x.snapshotGiocatore?.nome || x.nome).toLowerCase().trim() === g.nome.toLowerCase().trim());
        if (!r) return;

        const isPresente = r.statoPresenza === "giocato";
        const rGol = isPresente ? (Number(r.gol) || 0) : 0;
        const rAssist = isPresente ? (Number(r.assist) || 0) : 0;
        const rAmm = isPresente ? (Number(r.amm) || 0) : 0;
        const rEsp = isPresente ? (Number(r.rossi) || 0) : 0;
        const rBonusAttivi = r.bonusAttivi || [];

        // Pricing logic up to this match
        const breakdown = getPlayerBonusBreakdownForMatch(
          g.nome,
          rBonusAttivi,
          rGol,
          rAssist,
          m.bonusesSnapshot || bonuses,
          r.snapshotGiocatore?.ultimoRuolo || g.ultimoRuolo,
          rAmm,
          rEsp,
          r.bonusGolAccreditati,
          isPresente
        );

        let matchBonusVal = breakdown.reduce((acc, curr) => acc + curr.puntiVal, 0);
        const eventPointsVal = (rGol * GOAL_POINTS) + (rAssist * ASSIST_POINTS) + (rAmm * AMMO_POINTS) + (rEsp * ESPU_POINTS);
        let matchScore = parseFloat((matchBonusVal + eventPointsVal).toFixed(1));

        let change = 0;
        if (isPresente) {
          // Convocati (Presenti/Giocati)
          if (matchScore >= 20) {
            change = 2;
          } else if (matchScore >= 16) {
            change = 1;
          } else if (matchScore >= 10) {
            change = 0;
          } else if (matchScore >= -5) {
            change = -1;
          } else if (matchScore >= -10) {
            change = -2;
          } else {
            change = -3;
          }
        } else {
          // Non Convocati (Assenti, Sostituti o non a referto)
          if (matchScore >= 15) {
            change = 2;
          } else if (matchScore >= 7) {
            change = 1;
          } else if (matchScore >= -1) {
            change = 0;
          } else if (matchScore >= -5) {
            change = -1;
          } else if (matchScore >= -10) {
            change = -2;
          } else {
            change = -3;
          }
        }

        // Variazione supplementare di -1 Izycoin se Malus BRT e' spuntato
        if (r && r.malusBrt === true) {
          change -= 1;
        }

        // Apply accumulation if calculating values chronologically
        currentPrice = Math.max(1, currentPrice + change);

        // If this is the currently selected match for individual view
        if (timeframe === "giornata" && m.id === selectedGiornataId) {
          lastMatchChange = change;
        }
      });

      // Compute actual view score, stats & bonus frequencies for the selected period
      targetMatches.forEach((m) => {
        if (!m.referto) return;
        const r = m.referto.find((x) => (x.snapshotGiocatore?.nome || x.nome).toLowerCase().trim() === g.nome.toLowerCase().trim());
        if (!r) return;

        const isPresente = r.statoPresenza === "giocato";
        if (isPresente) {
          matchesPlayed++;
        }

        const rGol = isPresente ? (Number(r.gol) || 0) : 0;
        const rAssist = isPresente ? (Number(r.assist) || 0) : 0;
        const rAmm = isPresente ? (Number(r.amm) || 0) : 0;
        const rEsp = isPresente ? (Number(r.rossi) || 0) : 0;
        const rBonusAttivi = r.bonusAttivi || [];

        const breakdown = getPlayerBonusBreakdownForMatch(
          g.nome,
          rBonusAttivi,
          rGol,
          rAssist,
          m.bonusesSnapshot || bonuses,
          r.snapshotGiocatore?.ultimoRuolo || g.ultimoRuolo,
          rAmm,
          rEsp,
          r.bonusGolAccreditati,
          isPresente
        );

        let matchBonusVal = breakdown.reduce((acc, curr) => acc + curr.puntiVal, 0);
        const eventPointsVal = (rGol * GOAL_POINTS) + (rAssist * ASSIST_POINTS) + (rAmm * AMMO_POINTS) + (rEsp * ESPU_POINTS);
        let matchScore = parseFloat((matchBonusVal + eventPointsVal).toFixed(1));

        score += matchScore;
        golCount += rGol;
        assistCount += rAssist;
        ammCount += rAmm;
        espCount += rEsp;

        // Count report stats with points
        if (rGol > 0) {
          const key = "⚽ Gol Segnato";
          bonusImpacts[key] = parseFloat(((bonusImpacts[key] || 0) + (rGol * GOAL_POINTS)).toFixed(1));
          bonusCounts[key] = (bonusCounts[key] || 0) + rGol;
        }
        if (rAssist > 0) {
          const key = "🤝 Assist";
          bonusImpacts[key] = parseFloat(((bonusImpacts[key] || 0) + (rAssist * ASSIST_POINTS)).toFixed(1));
          bonusCounts[key] = (bonusCounts[key] || 0) + rAssist;
        }
        if (rAmm > 0) {
          const key = "🟨 Ammonito";
          bonusImpacts[key] = parseFloat(((bonusImpacts[key] || 0) + (rAmm * AMMO_POINTS)).toFixed(1));
          bonusCounts[key] = (bonusCounts[key] || 0) + rAmm;
        }
        if (rEsp > 0) {
          const key = "🟥 Espulso";
          bonusImpacts[key] = parseFloat(((bonusImpacts[key] || 0) + (rEsp * ESPU_POINTS)).toFixed(1));
          bonusCounts[key] = (bonusCounts[key] || 0) + rEsp;
        }

        // Count custom bonuses
        breakdown.forEach((b) => {
          bonusCounts[b.nome] = (bonusCounts[b.nome] || 0) + 1;
          bonusImpacts[b.nome] = parseFloat(((bonusImpacts[b.nome] || 0) + b.puntiVal).toFixed(1));
        });
      });

      // If timeframe is global, last change can be current total diff
      if (timeframe === "global") {
        lastMatchChange = currentPrice - basePrice;
      }

      return {
        nome: g.nome,
        ruolo: g.ultimoRuolo,
        score: parseFloat(score.toFixed(1)),
        gol: golCount,
        assist: assistCount,
        amm: ammCount,
        esp: espCount,
        matchesPlayed,
        basePrice,
        currentPrice,
        priceChange: lastMatchChange,
        bonusCounts,
        bonusImpacts
      };
    });
  }, [giocatori, validMatches, timeframe, selectedGiornataId, selectedGiornataObj, bonuses]);

  // Sorted & Filtered Player list
  const filteredPlayerStats = useMemo(() => {
    let list = playerStatsList;

    // Apply Team filter
    if (selectedTeamFilter !== "Tutte") {
      const targetTeam = fantasquadre.find(t => t.id === selectedTeamFilter);
      if (targetTeam) {
        list = list.filter(p => targetTeam.giocatoriSelezionati.includes(p.nome));
      }
    }

    // Apply Player name search
    if (searchQuery.trim() !== "") {
      list = list.filter((p) =>
        p.nome.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply Player filter
    if (selectedPlayerFilter !== "Tutti") {
      list = list.filter(p => p.nome === selectedPlayerFilter);
    }

    // Apply Bonus/Malus filter
    if (selectedBonusFilter !== "Tutti") {
      list = list.filter(p => p.bonusCounts[selectedBonusFilter] > 0);
    }

    list.sort((a, b) => {
      if (sortOrder === "crescente") {
        return a.score - b.score || a.nome.localeCompare(b.nome);
      } else {
        return b.score - a.score || a.nome.localeCompare(b.nome);
      }
    });

    return list;
  }, [playerStatsList, searchQuery, sortOrder, selectedTeamFilter, selectedPlayerFilter, selectedBonusFilter, fantasquadre]);


  // 2. ADVANCED FANTASQUADRA STATISTICS CALCULATION
  const teamStatsList = useMemo(() => {
    return fantasquadre.map((team) => {
      let score = 0;
      const bonusFrequencies: Record<string, number> = {};

      const breakdowns = getTeamMatchBreakdownList(team);

      // Filter based on timeframe selection
      const targetBreakdowns = timeframe === "global"
        ? breakdowns
        : breakdowns.filter((b) => b.matchId === selectedGiornataId);

      targetBreakdowns.forEach((m) => {
        score += m.puntiTotaliMatch || 0;

        // Aggregate player KPIs for the team
        if (m.giocatoriKpi) {
          m.giocatoriKpi.forEach((kpi: any) => {
            // Re-fetch individual match referto to see specific bonuses
            const matchObj = validMatches.find((v) => v.id === m.matchId);
            const r = matchObj?.referto?.find((x) => (x.snapshotGiocatore?.nome || x.nome).toLowerCase().trim() === kpi.nome.toLowerCase().trim());
            if (r) {
              const isPresente = r.statoPresenza === "giocato";
              const rGol = isPresente ? (Number(r.gol) || 0) : 0;
              const rAssist = isPresente ? (Number(r.assist) || 0) : 0;
              const rAmm = isPresente ? (Number(r.amm) || 0) : 0;
              const rEsp = isPresente ? (Number(r.rossi) || 0) : 0;
              const rBonusAttivi = r.bonusAttivi || [];

              const breakdown = getPlayerBonusBreakdownForMatch(
                kpi.nome,
                rBonusAttivi,
                rGol,
                rAssist,
                m.bonusesSnapshot || bonuses,
                r.snapshotGiocatore?.ultimoRuolo,
                rAmm,
                rEsp,
                r.bonusGolAccreditati,
                isPresente
              );

              breakdown.forEach((b) => {
                bonusFrequencies[b.nome] = (bonusFrequencies[b.nome] || 0) + 1;
              });
            }
          });
        }
      });

      return {
        ...team,
        score: parseFloat(score.toFixed(1)),
        bonusFrequencies,
        numMatches: targetBreakdowns.length
      };
    });
  }, [fantasquadre, validMatches, timeframe, selectedGiornataId, bonuses, getTeamMatchBreakdownList]);

  // Sorted team stats
  const sortedTeamStats = useMemo(() => {
    let list = [...teamStatsList];
    if (selectedTeamFilter !== "Tutte") {
      list = list.filter(t => t.id === selectedTeamFilter);
    }
    list.sort((a, b) => {
      if (sortOrder === "crescente") {
        return a.score - b.score || a.nomeFantasquadra.localeCompare(b.nomeFantasquadra);
      } else {
        return b.score - a.score || a.nomeFantasquadra.localeCompare(b.nomeFantasquadra);
      }
    });
    return list;
  }, [teamStatsList, sortOrder, selectedTeamFilter]);


  // 3. THEMATIC BONUS/MALUS CLASSIFY
  const bonusStatsList = useMemo(() => {
    // Collect all bonuses and malus activation counts
    const counts: Record<string, { definition: CustomBonusDef; activatedBy: Record<string, number>; totalCount: number }> = {};

    // Seed definitions
    bonuses.forEach((b) => {
      counts[b.nome] = {
        definition: b,
        activatedBy: {},
        totalCount: 0
      };
    });

    const targetMatches = timeframe === "global"
      ? validMatches
      : (selectedGiornataObj ? [selectedGiornataObj] : []);

    targetMatches.forEach((m) => {
      if (!m.referto) return;
      m.referto.forEach((r) => {
        const playerName = (r.snapshotGiocatore?.nome || r.nome).trim();
        const isPresente = r.statoPresenza === "giocato";
        const rGol = isPresente ? (Number(r.gol) || 0) : 0;
        const rAssist = isPresente ? (Number(r.assist) || 0) : 0;
        const rAmm = isPresente ? (Number(r.amm) || 0) : 0;
        const rEsp = isPresente ? (Number(r.rossi) || 0) : 0;
        const rBonusAttivi = r.bonusAttivi || [];

        const breakdown = getPlayerBonusBreakdownForMatch(
          playerName,
          rBonusAttivi,
          rGol,
          rAssist,
          m.bonusesSnapshot || bonuses,
          r.snapshotGiocatore?.ultimoRuolo,
          rAmm,
          rEsp,
          r.bonusGolAccreditati,
          isPresente
        );

        breakdown.forEach((b) => {
          if (!counts[b.nome]) {
            // Dynamically seed if not present
            counts[b.nome] = {
              definition: { id: "dyn", nome: b.nome, descrizione: "Bonus automatico", punti: b.puntiVal },
              activatedBy: {},
              totalCount: 0
            };
          }
          counts[b.nome].totalCount++;
          counts[b.nome].activatedBy[playerName] = (counts[b.nome].activatedBy[playerName] || 0) + 1;
        });
      });
    });

    const list = Object.values(counts);
    let filteredList = list;

    if (selectedBonusFilter !== "Tutti") {
      filteredList = filteredList.filter(b => b.definition.nome === selectedBonusFilter);
    }

    if (selectedPlayerFilter !== "Tutti") {
      filteredList = filteredList.map(b => {
        const pCnt = b.activatedBy[selectedPlayerFilter] || 0;
        return {
          ...b,
          totalCount: pCnt,
          activatedBy: pCnt > 0 ? { [selectedPlayerFilter]: pCnt } : {}
        };
      }).filter(b => b.totalCount > 0);
    }

    filteredList.sort((a, b) => {
      if (sortOrder === "crescente") {
        return a.totalCount - b.totalCount || a.definition.nome.localeCompare(b.definition.nome);
      } else {
        return b.totalCount - a.totalCount || a.definition.nome.localeCompare(b.definition.nome);
      }
    });

    return filteredList;
  }, [bonuses, validMatches, timeframe, selectedGiornataId, selectedGiornataObj, sortOrder, selectedBonusFilter, selectedPlayerFilter]);


  // If a single player is selected, let's assemble their match history breakdown
  const selectedPlayerMatchHistory = useMemo(() => {
    if (selectedPlayerFilter === "Tutti") return [];
    
    const history: any[] = [];
    validMatches.forEach((m) => {
      if (!m.referto) return;
      const r = m.referto.find((x) => (x.snapshotGiocatore?.nome || x.nome).toLowerCase().trim() === selectedPlayerFilter.toLowerCase().trim());
      if (!r) return;

      const isPresente = r.statoPresenza === "giocato";
      const rGol = isPresente ? (Number(r.gol) || 0) : 0;
      const rAssist = isPresente ? (Number(r.assist) || 0) : 0;
      const rAmm = isPresente ? (Number(r.amm) || 0) : 0;
      const rEsp = isPresente ? (Number(r.rossi) || 0) : 0;
      const rBonusAttivi = r.bonusAttivi || [];

      const breakdown = getPlayerBonusBreakdownForMatch(
        selectedPlayerFilter,
        rBonusAttivi,
        rGol,
        rAssist,
        m.bonusesSnapshot || bonuses,
        r.snapshotGiocatore?.ultimoRuolo,
        rAmm,
        rEsp,
        r.bonusGolAccreditati,
        isPresente
      );

      let matchBonusVal = breakdown.reduce((acc, curr) => acc + curr.puntiVal, 0);
      const eventPointsVal = (rGol * GOAL_POINTS) + (rAssist * ASSIST_POINTS) + (rAmm * AMMO_POINTS) + (rEsp * ESPU_POINTS);
      let matchScore = parseFloat((matchBonusVal + eventPointsVal).toFixed(1));

      let change = 0;
      if (isPresente) {
        if (matchScore >= 20) change = 2;
        else if (matchScore >= 16) change = 1;
        else if (matchScore >= 10) change = 0;
        else if (matchScore >= -5) change = -1;
        else if (matchScore >= -10) change = -2;
        else change = -3;
      } else {
        if (matchScore >= 15) change = 2;
        else if (matchScore >= 7) change = 1;
        else if (matchScore >= -1) change = 0;
        else if (matchScore >= -5) change = -1;
        else if (matchScore >= -10) change = -2;
        else change = -3;
      }

      if (r.malusBrt === true) {
        change -= 1;
      }

      history.push({
        matchId: m.id,
        matchNome: m.nome || m.dettagli || m.id,
        statoPresenza: r.statoPresenza,
        score: matchScore,
        priceChange: change,
        gol: rGol,
        assist: rAssist,
        amm: rAmm,
        esp: rEsp,
        bonuses: breakdown,
        malusBrt: r.malusBrt === true
      });
    });

    return history;
  }, [selectedPlayerFilter, validMatches, bonuses]);


  // 4. GENERATING COPYABLE SOCIAL EXPORT TEXT (formatted, beautiful, rich of emojis)
  const socialExportText = useMemo(() => {
    let titleEmoji = "📊";
    if (activeTab === "squadre") titleEmoji = "🏆";
    if (activeTab === "bonus") titleEmoji = "⚡";

    let textForCopy = `${titleEmoji} *REPORT FANTA-STATS* ${titleEmoji}\n`;
    textForCopy += `📅 _Periodo: ${currentPeriodLabel}_\n`;
    textForCopy += `📈 _Ordinamento: ${sortOrder === "crescente" ? "Crescente 📈" : "Decrescente 📉"}_\n\n`;

    if (activeTab === "giocatori") {
      textForCopy += `👤 *LEADERBOARD GIOCATORI:*\n`;
      filteredPlayerStats.forEach((p, idx) => {
        const rankNum = idx + 1;
        const changeSign = p.priceChange >= 0 ? `+${p.priceChange}` : `${p.priceChange}`;
        textForCopy += `${rankNum}. [${p.ruolo.toUpperCase()}] *${p.nome}* | *${p.score} pts*\n`;
        textForCopy += `   🪙 Valore: ${p.currentPrice} (${changeSign} Izycoin) | 👕 Presenze: ${p.matchesPlayed}\n`;
        
        const topBonusList = Object.entries(p.bonusImpacts || {})
          .sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number));
        if (topBonusList.length > 0) {
          const bonusStr = topBonusList.map(([bName, bPts]) => `${bName} (${(bPts as number) > 0 ? "+" : ""}${bPts} pt)`).join(", ");
          textForCopy += `   ✨ Eventi e Bonus: ${bonusStr}\n`;
        }
      });
    } else if (activeTab === "squadre") {
      textForCopy += `🏆 *CLASSIFICA FANTASQUADRE:*\n`;
      sortedTeamStats.forEach((t, idx) => {
        const rankNum = idx + 1;
        textForCopy += `${rankNum}. *${t.nomeFantasquadra}* (${t.nomePartecipante})\n`;
        textForCopy += `   ⚽ Punti: *${t.score} pts* in ${t.numMatches} G.\n`;

        const topBonusList = Object.entries(t.bonusFrequencies)
          .sort((a, b) => Number(b[1]) - Number(a[1]));
        if (topBonusList.length > 0) {
          const bonusStr = topBonusList.map(([bName, bCnt]) => `${bName} (x${bCnt})`).join(", ");
          textForCopy += `   📌 Bonus del Team: ${bonusStr}\n`;
        }
      });
    } else {
      textForCopy += `⚡ *FOCUS STATISTICHE BONUS/MALUS:*\n`;
      bonusStatsList.slice(0, 15).forEach((b, idx) => {
        const rankNum = idx + 1;
        textForCopy += `${rankNum}. *${b.definition.nome}*\n`;
        textForCopy += `   🎯 Attivazioni: *${b.totalCount} volte*\n`;

        const playersAtt = Object.entries(b.activatedBy)
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .slice(0, 3)
          .map(([pName, pCnt]) => `${pName} (${pCnt})`)
          .join(", ");
        if (playersAtt) {
          textForCopy += `   🏃 Top Giocatori: ${playersAtt}\n`;
        }
      });
    }

    textForCopy += `\n⚽ #FantaEasyRigging #Fantacalcetto #Izycoin 🪙`;
    return textForCopy;
  }, [activeTab, currentPeriodLabel, sortOrder, filteredPlayerStats, sortedTeamStats, bonusStatsList]);

  const handleCopyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(socialExportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Copia non riuscita, per favore copia manualmente la casella di testo.");
    }
  };

  // 5. GENERATING COPYABLE IZYCOIN VARIATIONS TEXT (no custom bonuses listed, only changes and values)
  const izycoinExportText = useMemo(() => {
    let textForCopy = `🪙 *VARIAZIONI IZYCOIN* 🪙\n`;
    textForCopy += `📅 _Periodo: ${currentPeriodLabel}_\n`;
    textForCopy += `📈 _Ordinamento: ${sortOrder === "crescente" ? "Crescente 📈" : "Decrescente 📉"}_\n\n`;

    textForCopy += `👤 *VARIAZIONI VALORI GIOCATORI:*\n`;
    filteredPlayerStats.forEach((p, idx) => {
      const rankNum = idx + 1;
      const changeSign = p.priceChange >= 0 ? `+${p.priceChange}` : `${p.priceChange}`;
      textForCopy += `${rankNum}. *${p.nome}* (${p.ruolo.toUpperCase()})\n`;
      textForCopy += `   🪙 Valore: *${p.currentPrice} cr.* (Variazione: *${changeSign} Izycoin*)\n`;
    });

    textForCopy += `\n⚽ #FantaEasyRigging #Izycoin #Quotazioni 🪙`;
    return textForCopy;
  }, [currentPeriodLabel, sortOrder, filteredPlayerStats]);

  const handleCopyIzycoin = async () => {
    try {
      await navigator.clipboard.writeText(izycoinExportText);
      setCopiedIzycoin(true);
      setTimeout(() => setCopiedIzycoin(false), 2000);
    } catch (err) {
      alert("Copia non riuscita, per favore copia manualmente la casella di testo.");
    }
  };

  // 6. GENERATING COPYABLE BONUS POINTS SYNTHESIS TEXT (only total points and bonus points)
  const punteggiExportText = useMemo(() => {
    let textForCopy = `✨ *SINTESI PUNTEGGI & BONUS GIOCATORI* ✨\n`;
    textForCopy += `📅 _Periodo: ${currentPeriodLabel}_\n`;
    textForCopy += `📈 _Ordinamento: ${sortOrder === "crescente" ? "Crescente 📈" : "Decrescente 📉"}_\n\n`;

    textForCopy += `👤 *SINTESI PUNTI E BONUS:*\n`;
    filteredPlayerStats.forEach((p, idx) => {
      const rankNum = idx + 1;
      // Calculate sum of positive bonus points
      const positiveBonusSum = Object.entries(p.bonusImpacts || {}).reduce((acc, [bName, bPts]) => {
        const pts = bPts as number;
        if (pts > 0) {
          return acc + pts;
        }
        return acc;
      }, 0);

      textForCopy += `${rankNum}. *${p.nome}* (${p.ruolo.toUpperCase()})\n`;
      textForCopy += `   ⭐ Punti Totali: *${p.score} pts* | 🎁 Di cui da Bonus: *+${positiveBonusSum.toFixed(1)} pts* (👕 Presenze: ${p.matchesPlayed})\n`;
    });

    textForCopy += `\n⚽ #FantaEasyRigging #Fantacalcetto #BonusSintesi 🎁`;
    return textForCopy;
  }, [currentPeriodLabel, sortOrder, filteredPlayerStats]);

  const handleCopyPunteggi = async () => {
    try {
      await navigator.clipboard.writeText(punteggiExportText);
      setCopiedPunteggi(true);
      setTimeout(() => setCopiedPunteggi(false), 2000);
    } catch (err) {
      alert("Copia non riuscita, per favore copia manualmente la casella di testo.");
    }
  };

  const handleExportClassifica = async () => {
    let text = `🏆 *CLASSIFICA FANTASQUADRE* 🏆\n\n`;
    sortedTeamStats.forEach((t, idx) => {
      const medal = idx === 0 ? "🥇 " : idx === 1 ? "🥈 " : idx === 2 ? "🥉 " : "📋 ";
      text += `${medal}*${idx + 1}° ${t.nomeFantasquadra}* - *${t.score} pts*\n`;
    });
    text += `\n⚽ #FantaEasyRigging #Fantacalcetto`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedClassifica(true);
      setTimeout(() => setCopiedClassifica(false), 2500);
    } catch (err) {
      alert("Copia non riuscita, impossibile copiare negli appunti.");
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 text-white shadow-xl space-y-6 font-sans">
      
      {/* 🚀 Header unico centralizzato */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-650/20 text-indigo-400 rounded-2xl border border-indigo-500/20 shadow-inner">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-1.5">
              Hub Statistiche & Social Export
              <span className="text-[10px] bg-indigo-900 text-indigo-300 font-bold px-2 py-0.5 rounded-full uppercase">
                Unificato
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Resoconti dettagliati per giocatori, fantasquadre, variazioni di valore e conteggio dei bonus.
            </p>
          </div>
        </div>

        <button
          id="btn-export-classifica"
          onClick={handleExportClassifica}
          className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-xs uppercase px-4.5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md select-none shrink-0"
        >
          {copiedClassifica ? (
            <>
              <Check className="h-4 w-4" /> Classifica Copiata! 🚀
            </>
          ) : (
            <>
              <Trophy className="h-4 w-4" /> Esporta Classifica Attuale 🏆
            </>
          )}
        </button>
      </div>

      {/* 🛠️ FILTRO CENTRALE DI CONTROLLO */}
      <div className="bg-slate-950/60 p-4.5 rounded-2xl border border-slate-850/80 grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Selettore Tab Principale */}
        <div className="md:col-span-4 space-y-1.5 col-span-1">
          <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-indigo-400" /> Seleziona Report
          </label>
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => { setActiveTab("giocatori"); setSearchQuery(""); }}
              className={`flex-1 text-center py-2 text-xs font-black rounded-lg transition-all uppercase flex items-center justify-center gap-1.5 ${
                activeTab === "giocatori" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <User className="h-3.5 w-3.5" /> Giocatori
            </button>
            <button
              onClick={() => { setActiveTab("squadre"); setSearchQuery(""); }}
              className={`flex-1 text-center py-2 text-xs font-black rounded-lg transition-all uppercase flex items-center justify-center gap-1.5 ${
                activeTab === "squadre" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <Trophy className="h-3.5 w-3.5" /> Squadre
            </button>
            <button
              onClick={() => { setActiveTab("bonus"); setSearchQuery(""); }}
              className={`flex-1 text-center py-2 text-xs font-black rounded-lg transition-all uppercase flex items-center justify-center gap-1.5 ${
                activeTab === "bonus" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> Bonus Info
            </button>
          </div>
        </div>

        {/* Selettore Temporale (Giornata vs Global) */}
        <div className="md:col-span-5 space-y-1.5 col-span-1">
          <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-indigo-400" /> Orizzonte Temporale
          </label>
          <div className="flex gap-2">
            <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-850 flex-1">
              <button
                onClick={() => setTimeframe("global")}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                  timeframe === "global" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Campionato Totale
              </button>
              <button
                onClick={() => setTimeframe("giornata")}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                  timeframe === "giornata" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Singola Giornata
              </button>
            </div>

            {timeframe === "giornata" && validMatches.length > 0 && (
              <select
                value={selectedGiornataId}
                onChange={(e) => setSelectedGiornataId(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32 shrink-0 cursor-pointer"
              >
                {validMatches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome || m.dettagli || m.id}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Ordinamento (Crescente default / Decrescente) */}
        <div className="md:col-span-3 space-y-1.5 col-span-1">
          <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1.5">
            <ArrowUpDown className="h-3 w-3 text-indigo-400" /> Ordinamento Classifiche
          </label>
          <button
            onClick={() => setSortOrder(sortOrder === "crescente" ? "decrescente" : "crescente")}
            className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer text-indigo-300 hover:text-indigo-100"
          >
            {sortOrder === "crescente" ? (
              <>
                <TrendingUp className="h-4 w-4" />
                <span>Crescente 📈 (Ascendente)</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4" />
                <span>Decrescente 📉 (Discendente)</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* 🔮 FILTRI MULTI-LIVELLO AVANZATI */}
      <div className="bg-slate-950/45 p-4 rounded-2xl border border-slate-800/80 flex flex-col md:flex-row gap-4 items-stretch md:items-end justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          {/* A. Filtra per Squadra */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <Trophy className="h-3 w-3 text-indigo-400" /> Filtra Squadra
            </label>
            <select
              value={selectedTeamFilter}
              onChange={(e) => {
                setSelectedTeamFilter(e.target.value);
                // Reset player filter if changing team
                setSelectedPlayerFilter("Tutti");
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="Tutte">⚽ Tutte le Squadre</option>
              {fantasquadre.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.nomeFantasquadra}
                </option>
              ))}
            </select>
          </div>

          {/* B. Filtra per Giocatore */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="h-3 w-3 text-indigo-400" /> Filtra Giocatore
            </label>
            <select
              value={selectedPlayerFilter}
              onChange={(e) => setSelectedPlayerFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="Tutti">🏃 Tutti i Giocatori</option>
              {giocatori
                .filter((g) => {
                  if (selectedTeamFilter === "Tutte") return true;
                  const t = fantasquadre.find((x) => x.id === selectedTeamFilter);
                  return t?.giocatoriSelezionati.includes(g.nome);
                })
                .sort((a,b) => a.nome.localeCompare(b.nome))
                .map((g) => (
                  <option key={g.nome} value={g.nome}>
                    {g.nome} ({g.ultimoRuolo})
                  </option>
                ))}
            </select>
          </div>

          {/* C. Filtra per Bonus / Malus */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-indigo-400" /> Filtra Bonus/Malus
            </label>
            <select
              value={selectedBonusFilter}
              onChange={(e) => setSelectedBonusFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="Tutti">✨ Tutti i Bonus/Malus</option>
              {bonuses.map((b) => (
                <option key={`${b.id}_${b.nome}`} value={b.nome}>
                  {b.nome} ({b.punti > 0 ? `+${b.punti}` : b.punti} pt)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bottone Reset Filtri */}
        {(selectedTeamFilter !== "Tutte" || selectedPlayerFilter !== "Tutti" || selectedBonusFilter !== "Tutti") && (
          <button
            onClick={() => {
              setSelectedTeamFilter("Tutte");
              setSelectedPlayerFilter("Tutti");
              setSelectedBonusFilter("Tutti");
            }}
            className="text-[10px] uppercase font-black bg-slate-800 hover:bg-slate-750 text-red-400 hover:text-red-300 border border-slate-700 px-4 py-2.5 rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            Reset Filtri ❌
          </button>
        )}
      </div>

      {/* 📱 SOCIAL-READY EXPORT COMPONENT */}
      <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-850 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase text-indigo-400 flex items-center gap-1.5">
              <Share2 className="h-4 w-4 text-indigo-400" /> Esportatore Social (WhatsApp / IG Stories)
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Formatta e copia il testo per condividerlo sui gruppi o canali social!
            </p>
          </div>

          {/* Tab Selector for Export Type */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-855 self-start xl:self-auto gap-1">
            <button
              onClick={() => setExportType("standard")}
              className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase flex items-center gap-1.5 cursor-pointer ${
                exportType === "standard"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Share2 className="h-3 w-3" /> Fanta-Stats & Bonus
            </button>
            <button
              onClick={() => setExportType("izycoin")}
              className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase flex items-center gap-1.5 cursor-pointer ${
                exportType === "izycoin"
                  ? "bg-amber-550 text-slate-950 shadow-sm font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Coins className="h-3 w-3 text-amber-500" /> Variazioni Izycoin 🪙
            </button>
            <button
              onClick={() => setExportType("punteggi")}
              className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase flex items-center gap-1.5 cursor-pointer ${
                exportType === "punteggi"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Award className="h-3 w-3 text-emerald-300" /> Sintesi Punti & Bonus 🎁
            </button>
          </div>

          {/* Copy Button corresponding to current selection */}
          {exportType === "standard" ? (
            <button
              onClick={handleCopyClipboard}
              className="bg-yellow-400 hover:bg-yellow-350 active:bg-yellow-450 text-indigo-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md w-full xl:w-auto"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Copiato! 🚀
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copia Report Completo 📋
                </>
              )}
            </button>
          ) : exportType === "izycoin" ? (
            <button
              onClick={handleCopyIzycoin}
              className="bg-amber-500 hover:bg-amber-440 active:bg-amber-600 text-slate-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md w-full xl:w-auto"
            >
              {copiedIzycoin ? (
                <>
                  <Check className="h-4 w-4" /> Variazioni Copiate! 🚀
                </>
              ) : (
                <>
                  <Coins className="h-4 w-4" /> Copia Variazioni Izycoin 🪙
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleCopyPunteggi}
              className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md w-full xl:w-auto"
            >
              {copiedPunteggi ? (
                <>
                  <Check className="h-4 w-4" /> Sintesi Copiata! 🚀
                </>
              ) : (
                <>
                  <Award className="h-4 w-4" /> Copia Sintesi Punti &amp; Bonus 📋
                </>
              )}
            </button>
          )}
        </div>

        {/* Plain-text display area using elegant monospace alignment */}
        <pre className="bg-slate-900 border border-slate-850 rounded-xl p-4 text-[11px] leading-relaxed text-indigo-200 overflow-x-auto font-mono max-h-72 overflow-y-auto whitespace-pre-wrap select-all">
          {exportType === "standard" ? socialExportText : exportType === "izycoin" ? izycoinExportText : punteggiExportText}
        </pre>
      </div>

      {/* 🔴 PANNELLO DETTAGLIO TIMELINE SINGOLO GIOCATORE */}
      {selectedPlayerFilter !== "Tutti" && selectedPlayerMatchHistory.length > 0 && (
        <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
            <div>
              <h3 className="text-sm font-black uppercase text-yellow-400 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-yellow-400 animate-pulse" /> Zoom Prestazioni: {selectedPlayerFilter}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Rapporto cronologico dettagliato partita per partita (Fasce Izycoin, Voto, Bonus e Malus BRT).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Statistiche Totali del Giocatore Filtered */}
            {filteredPlayerStats.slice(0, 1).map((p) => (
              <div key={p.nome} className="md:col-span-4 bg-slate-900/80 p-4 rounded-xl border border-indigo-950 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-900/40 font-black px-2 py-0.5 rounded uppercase">
                      {p.ruolo}
                    </span>
                    <span className="text-xs font-bold text-slate-400">Total Score:</span>
                  </div>
                  <h4 className="text-2xl font-black text-white">{p.nome}</h4>
                  <div className="text-3xl font-black text-yellow-400 font-mono">
                    {p.score} <span className="text-sm font-bold text-slate-400">punti fanta</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-slate-850">
                  <div className="bg-slate-950/40 p-2 rounded">
                    <div className="text-[10px] font-bold text-slate-450 uppercase">Prezzo Base</div>
                    <div className="text-sm font-mono font-black text-slate-300">{p.basePrice} 🪙</div>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded">
                    <div className="text-[10px] font-bold text-slate-450 uppercase">Valore Attuale</div>
                    <div className="text-sm font-mono font-black text-emerald-400">{p.currentPrice} 🪙</div>
                  </div>
                </div>
              </div>
            ))}

            {/* Timeline dei Match */}
            <div className="md:col-span-8 bg-slate-900/60 rounded-xl border border-slate-800 p-4 max-h-[280px] overflow-y-auto space-y-2">
              {selectedPlayerMatchHistory.map((h, i) => {
                const diffColor = h.priceChange > 0 ? "text-green-400" : h.priceChange < 0 ? "text-red-400" : "text-slate-400";
                const diffPrefix = h.priceChange > 0 ? "+" : "";

                return (
                  <div key={i} className="bg-slate-950/50 p-3 rounded-lg border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <div className="text-xs font-black text-white flex items-center gap-1.5">
                        <span className="text-[9px] bg-slate-805 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                          {i+1}° Incontro
                        </span>
                        {h.matchNome}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-medium font-sans">
                        <span>Presenza:</span>
                        <span className={`font-bold uppercase ${h.statoPresenza === "giocato" ? "text-emerald-400" : "text-slate-500"}`}>
                          {h.statoPresenza}
                        </span>
                        <span>• Score:</span>
                        <span className="font-extrabold text-yellow-400 font-mono">{h.score} pts</span>
                        {h.malusBrt && (
                          <span className="bg-rose-955 text-rose-300 px-1.5 rounded font-black text-[8.5px]">
                            📦 MALUS BRT ATTIVO
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Event details */}
                      <div className="flex items-center gap-1.5 text-[10px] bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                        {h.gol > 0 && <span className="text-white font-extrabold">⚽ {h.gol}</span>}
                        {h.assist > 0 && <span className="text-cyan-400 font-extrabold">🎯 {h.assist}</span>}
                        {h.amm > 0 && <span className="text-yellow-400 font-bold">🟨 {h.amm}</span>}
                        {h.esp > 0 && <span className="text-red-500 font-bold">🟥 {h.esp}</span>}
                        {h.bonuses.length > 0 && (
                          <span className="text-indigo-400 font-extrabold">
                            ⚡ {h.bonuses.length} bonus
                          </span>
                        )}
                        {h.gol === 0 && h.assist === 0 && h.amm === 0 && h.esp === 0 && h.bonuses.length === 0 && (
                          <span className="text-slate-550 italic font-bold">Invariato</span>
                        )}
                      </div>

                      <div className="text-right font-mono text-xs w-20">
                        <div className="text-[9px] font-bold text-slate-500 uppercase leading-none">Variazione</div>
                        <div className={`${diffColor} font-black mt-0.5`}>
                          {diffPrefix}{h.priceChange} Izycoin 🪙
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 🔍 BARRA DI RICERCA GIOCATORI */}
      {activeTab === "giocatori" && (
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Cerca un giocatore..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
          />
        </div>
      )}

      {/* 🚀 RENDER DEI FILTRI DI VISUALIZZAZIONE */}
      <div className="overflow-x-auto rounded-2xl border border-slate-850 bg-slate-950/40">
        
        {/* A. VISTA GIOCATORI */}
        {activeTab === "giocatori" && (
          <table className="w-full text-left border-collapse font-sans min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400">
                <th className="py-3 px-4 w-12 text-center font-black">Piazz.</th>
                <th className="py-3 px-4">Giocatore</th>
                <th className="py-3 px-4 w-28 text-center">Ruolo</th>
                <th className="py-3 px-4 text-center">FantaScore</th>
                <th className="py-3 px-4 text-center">Presenze</th>
                <th className="py-3 px-4 text-center w-40">Quotazione Base / Attuale</th>
                <th className="py-3 px-4">Bonus Attivati nel Periodo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {filteredPlayerStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500 font-medium">
                    Nessun giocatore corrisponde alla ricerca.
                  </td>
                </tr>
              ) : (
                filteredPlayerStats.map((p, idx) => {
                  const pricingDiff = p.priceChange;
                  const diffColor = pricingDiff > 0 ? "text-green-400" : pricingDiff < 0 ? "text-red-400" : "text-slate-400";
                  const diffPrefix = pricingDiff > 0 ? "+" : "";

                  return (
                    <tr key={p.nome} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-extrabold text-slate-400 text-center">
                        {idx + 1}°
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {p.nome}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded ${
                          p.ruolo === "Portiere" ? "bg-amber-500/10 text-amber-400 border border-amber-500/15" :
                          p.ruolo === "Centrale" ? "bg-sky-500/10 text-sky-400 border border-sky-500/15" :
                          p.ruolo === "Laterale" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" :
                          "bg-rose-500/10 text-rose-400 border border-rose-500/15"
                        }`}>
                          {p.ruolo}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-black font-mono text-xs text-yellow-300">
                        {p.score} pt
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-300 font-bold">
                        {p.matchesPlayed} G.
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs">
                        <div className="flex items-center justify-center gap-1 text-slate-300 font-bold">
                          <span>{p.basePrice}</span>
                          <span>➜</span>
                          <span className="text-white font-extrabold">{p.currentPrice} 🪙</span>
                          <span className={`${diffColor} text-[10px] font-bold shrink-0 ml-1`}>
                            ({diffPrefix}{pricingDiff} 🪙)
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 w-[280px]">
                        <div className="flex flex-wrap gap-1.5 max-w-sm">
                          {Object.entries(p.bonusImpacts || {}).length === 0 ? (
                            <span className="text-[10px] text-slate-500 font-bold">-</span>
                          ) : (
                            Object.entries(p.bonusImpacts || {}).map(([bName, val]) => {
                              const bPts = val as number;
                              const isNegative = bPts < 0;
                              const formattedPts = `${bPts > 0 ? "+" : ""}${bPts}`;
                              return (
                                <span 
                                  key={bName} 
                                  className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1 border transition-all ${
                                    isNegative 
                                      ? "bg-rose-950/40 border-rose-900/30 text-rose-300" 
                                      : "bg-indigo-950/60 border-indigo-900/40 text-indigo-200"
                                  }`}
                                >
                                  <span>{bName}</span>
                                  <strong className={isNegative ? "text-rose-200 font-black" : "text-emerald-400 font-black"}>
                                    {formattedPts} pt
                                  </strong>
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* B. VISTA SQUADRE (FANTASQUADRE) */}
        {activeTab === "squadre" && (
          <table className="w-full text-left border-collapse font-sans min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400">
                <th className="py-3 px-4 w-12 text-center font-black">Piazz.</th>
                <th className="py-3 px-4">Nome Fantasquadra</th>
                <th className="py-3 px-4">Presidente / Partecipante</th>
                <th className="py-3 px-4 text-center">Giornate Calcolate</th>
                <th className="py-3 px-4 text-center">FantaScore Cumulativo</th>
                <th className="py-3 px-4">Conteggio Speciali del Team no-cap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {sortedTeamStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500 font-medium">
                    Nessuna fantasquadra trovata.
                  </td>
                </tr>
              ) : (
                sortedTeamStats.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-extrabold text-slate-400 text-center">
                      {idx + 1}°
                    </td>
                    <td className="py-3.5 px-4 font-bold text-yellow-300 uppercase tracking-tight">
                      {t.nomeFantasquadra}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-300">
                      {t.nomePartecipante}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-400">
                      {t.numMatches} Giornate
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-xs font-black text-white">
                      {t.score} pt
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {Object.entries(t.bonusFrequencies).length === 0 ? (
                          <span className="text-[10px] text-slate-500 font-semibold">-</span>
                        ) : (
                          Object.entries(t.bonusFrequencies)
                            .sort((a,b) => Number(b[1]) - Number(a[1]))
                            .map(([bName, bCnt]) => (
                              <span key={bName} className="text-[9px] font-bold bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-lg hover:border-slate-700 transition-colors">
                                {bName} <strong className="text-yellow-400">x{bCnt}</strong>
                              </span>
                            ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* C. FOCUS BONUS & MALUS */}
        {activeTab === "bonus" && (
          <table className="w-full text-left border-collapse font-sans min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400">
                <th className="py-3 px-4 w-12 text-center font-black">Rank.</th>
                <th className="py-3 px-4 w-60">Nome Bonus / Malus</th>
                <th className="py-3 px-4">Valore Fanta-Punti</th>
                <th className="py-3 px-4 text-center">Volte Attivato nel Periodo</th>
                <th className="py-3 px-4">Chi lo ha attivato maggiormente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {bonusStatsList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500 font-medium">
                    Nessun dato di attivazione disponibile.
                  </td>
                </tr>
              ) : (
                bonusStatsList.map((b, idx) => {
                  const ptsVal = b.definition.punti;
                  const ptsColor = ptsVal > 0 ? "text-green-400" : ptsVal < 0 ? "text-red-400" : "text-slate-400";
                  const ptsPrefix = ptsVal > 0 ? "+" : "";

                  return (
                    <tr key={`${b.definition.id || b.definition.nome}_${b.definition.nome}`} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-extrabold text-slate-400 text-center">
                        {idx + 1}°
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div>{b.definition.nome}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5 leading-relaxed">
                          {b.definition.descrizione}
                        </div>
                      </td>
                      <td className={`py-3.5 px-4 font-mono text-xs font-black ${ptsColor}`}>
                        {ptsPrefix}{ptsVal} pt
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs font-black text-white bg-slate-950/20">
                        {b.totalCount} volte
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-[11px] text-slate-300 font-bold space-x-1.5">
                          {Object.entries(b.activatedBy).length === 0 ? (
                            <span className="text-slate-500 font-semibold">-</span>
                          ) : (
                            Object.entries(b.activatedBy)
                              .sort((a,b) => Number(b[1]) - Number(a[1]))
                              .slice(0, 3)
                              .map(([pName, pCnt]) => (
                                <span key={pName} className="inline-block bg-slate-900 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">
                                  {pName} ({pCnt})
                                </span>
                              ))
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

      </div>

    </div>
  );
}
