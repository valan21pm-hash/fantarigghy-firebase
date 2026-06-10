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
  Share2
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
  getPlayerBonusKey
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
  const [sortOrder, setSortOrder] = useState<"crescente" | "decrescente">("crescente");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Available valid Closed Matches for calculations (non-friendly)
  const validMatches = useMemo(() => {
    return (partiteChiuse || []).filter(
      (m) =>
        m.stato === "Chiusa" &&
        m.inviatoFanta === true &&
        !(m.dettagli || "").toLowerCase().includes("amichevole")
    );
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
        const r = m.referto.find((x) => x.nome.toLowerCase() === g.nome.toLowerCase());
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
          bonuses,
          r.snapshotGiocatore?.ultimoRuolo || g.ultimoRuolo
        );

        let matchBonusVal = breakdown.reduce((acc, curr) => acc + curr.puntiVal, 0);
        let matchScore = parseFloat(
          (
            rGol * 3 +
            rAssist * 1 +
            rAmm * -1 +
            rEsp * -3 +
            matchBonusVal
          ).toFixed(1)
        );

        let change = 0;
        if (isPresente) {
          if (matchScore >= 10 && matchScore <= 19) change = 1;
          else if (matchScore >= 20) change = 2;
          else if (matchScore >= -5 && matchScore <= -2) change = -1;
          else if (matchScore >= -10 && matchScore <= -6) change = -2;
          else if (matchScore <= -11) change = -3;
        } else {
          if (matchScore >= 7 && matchScore <= 13) change = 1;
          else if (matchScore >= 14) change = 2;
          else if (matchScore >= -5 && matchScore <= -2) change = -1;
          else if (matchScore >= -10 && matchScore <= -6) change = -2;
          else if (matchScore <= -11) change = -3;
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
        const r = m.referto.find((x) => x.nome.toLowerCase() === g.nome.toLowerCase());
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
          bonuses,
          r.snapshotGiocatore?.ultimoRuolo || g.ultimoRuolo
        );

        let matchBonusVal = breakdown.reduce((acc, curr) => acc + curr.puntiVal, 0);
        let matchScore = parseFloat(
          (
            rGol * 3 +
            rAssist * 1 +
            rAmm * -1 +
            rEsp * -3 +
            matchBonusVal
          ).toFixed(1)
        );

        score += matchScore;
        golCount += rGol;
        assistCount += rAssist;
        ammCount += rAmm;
        espCount += rEsp;

        // Count bonuses
        breakdown.forEach((b) => {
          bonusCounts[b.nome] = (bonusCounts[b.nome] || 0) + 1;
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
        bonusCounts
      };
    });
  }, [giocatori, validMatches, timeframe, selectedGiornataId, selectedGiornataObj, bonuses]);

  // Sorted & Filtered Player list
  const filteredPlayerStats = useMemo(() => {
    let list = playerStatsList.filter((p) =>
      p.nome.toLowerCase().includes(searchQuery.toLowerCase())
    );

    list.sort((a, b) => {
      if (sortOrder === "crescente") {
        return a.score - b.score || a.nome.localeCompare(b.nome);
      } else {
        return b.score - a.score || a.nome.localeCompare(b.nome);
      }
    });

    return list;
  }, [playerStatsList, searchQuery, sortOrder]);


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
            const r = matchObj?.referto?.find((x) => x.nome.toLowerCase() === kpi.nome.toLowerCase());
            if (r) {
              const rGol = r.statoPresenza === "giocato" ? (Number(r.gol) || 0) : 0;
              const rAssist = r.statoPresenza === "giocato" ? (Number(r.assist) || 0) : 0;
              const rBonusAttivi = r.bonusAttivi || [];

              const breakdown = getPlayerBonusBreakdownForMatch(
                kpi.nome,
                rBonusAttivi,
                rGol,
                rAssist,
                bonuses,
                r.snapshotGiocatore?.ultimoRuolo
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
    const list = [...teamStatsList];
    list.sort((a, b) => {
      if (sortOrder === "crescente") {
        return a.score - b.score || a.nomeFantasquadra.localeCompare(b.nomeFantasquadra);
      } else {
        return b.score - a.score || a.nomeFantasquadra.localeCompare(b.nomeFantasquadra);
      }
    });
    return list;
  }, [teamStatsList, sortOrder]);


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
        const isPresente = r.statoPresenza === "giocato";
        const rGol = isPresente ? (Number(r.gol) || 0) : 0;
        const rAssist = isPresente ? (Number(r.assist) || 0) : 0;
        const rBonusAttivi = r.bonusAttivi || [];

        const breakdown = getPlayerBonusBreakdownForMatch(
          r.nome,
          rBonusAttivi,
          rGol,
          rAssist,
          bonuses,
          r.snapshotGiocatore?.ultimoRuolo
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
          counts[b.nome].activatedBy[r.nome] = (counts[b.nome].activatedBy[r.nome] || 0) + 1;
        });
      });
    });

    const list = Object.values(counts);

    list.sort((a, b) => {
      if (sortOrder === "crescente") {
        return a.totalCount - b.totalCount || a.definition.nome.localeCompare(b.definition.nome);
      } else {
        return b.totalCount - a.totalCount || a.definition.nome.localeCompare(b.definition.nome);
      }
    });

    return list;
  }, [bonuses, validMatches, timeframe, selectedGiornataId, selectedGiornataObj]);


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
      filteredPlayerStats.slice(0, 15).forEach((p, idx) => {
        const rankNum = idx + 1;
        const changeSign = p.priceChange >= 0 ? `+${p.priceChange}` : `${p.priceChange}`;
        textForCopy += `${rankNum}. [${p.ruolo.toUpperCase()}] *${p.nome}* | *${p.score} pts*\n`;
        textForCopy += `   🪙 Valore: ${p.currentPrice} (${changeSign} Izycoin) | 👕 Presenze: ${p.matchesPlayed}\n`;
        
        const topBonusList = Object.entries(p.bonusCounts)
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .slice(0, 2);
        if (topBonusList.length > 0) {
          const bonusStr = topBonusList.map(([bName, bCnt]) => `${bName} (x${bCnt})`).join(", ");
          textForCopy += `   ✨ Top Bonus: ${bonusStr}\n`;
        }
      });
      if (filteredPlayerStats.length > 15) {
        textForCopy += `\n...e altri ${filteredPlayerStats.length - 15} giocatori!`;
      }
    } else if (activeTab === "squadre") {
      textForCopy += `🏆 *CLASSIFICA FANTASQUADRE:*\n`;
      sortedTeamStats.forEach((t, idx) => {
        const rankNum = idx + 1;
        textForCopy += `${rankNum}. *${t.nomeFantasquadra}* (${t.nomePartecipante})\n`;
        textForCopy += `   ⚽ Punti: *${t.score} pts* in ${t.numMatches} G.\n`;

        const topBonusList = Object.entries(t.bonusFrequencies)
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .slice(0, 3);
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
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-sm">
                          {Object.entries(p.bonusCounts).length === 0 ? (
                            <span className="text-[10px] text-slate-500 font-bold">-</span>
                          ) : (
                            Object.entries(p.bonusCounts).map(([bName, bCnt]) => (
                              <span key={bName} className="text-[9px] font-bold bg-indigo-950/60 border border-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-lg shrink-0">
                                {bName} <strong className="text-white">x{bCnt}</strong>
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
                    <tr key={b.definition.nome} className="hover:bg-slate-900/40 transition-colors">
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

      {/* 📱 SOCIAL-READY EXPORT COMPONENT */}
      <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase text-indigo-400 flex items-center gap-1.5">
              <Share2 className="h-4 w-4 text-indigo-400" /> Esportatore Social (WhatsApp / IG Stories)
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Copia il testo sotto, formattato in colonne perfette con emoji per pubblicarlo sui gruppi di gioco o canali social!
            </p>
          </div>
          <button
            onClick={handleCopyClipboard}
            className="bg-yellow-400 hover:bg-yellow-350 active:bg-yellow-450 text-indigo-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Copiato! 🚀
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copia Negli Appunti 📋
              </>
            )}
          </button>
        </div>

        {/* Plain-text display area using elegant monospace alignment */}
        <pre className="bg-slate-900 border border-slate-850 rounded-xl p-4 text-[11px] leading-relaxed text-indigo-200 overflow-x-auto font-mono max-h-72 overflow-y-auto whitespace-pre-wrap select-all">
          {socialExportText}
        </pre>
      </div>

    </div>
  );
}
