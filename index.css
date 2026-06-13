/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Award, Shield, Sparkles, Trophy } from "lucide-react";
import { Giocatore, Partita } from "../types";

interface StatsDashboardProps {
  giocatori: Giocatore[];
  partiteChiuse?: Partita[];
}

export default function StatsDashboard({ giocatori, partiteChiuse = [] }: StatsDashboardProps) {
  const [activeType, setActiveType] = useState<"campionato" | "amichevole" | "totale">("campionato");

  // Compute stats separated by match type
  const computedPlayers = giocatori.map(g => {
    // 1. Start with overall totals
    const totalGol = g.gol || 0;
    const totalAssist = g.assist || 0;
    const totalAmm = g.ammonizioni || 0;
    const totalEsp = g.espulsioni || 0;
    const totalSubiti = (g.golSubitiAzione || 0) + (g.golSubitiRigore || 0) + (g.golSubitiPiazzato || 0);
    const totalMalus = totalAmm + totalEsp * 3;

    // 2. Count amichevole matches from database
    let amichevoleGol = 0;
    let amichevoleAssist = 0;
    let amichevoleAmm = 0;
    let amichevoleEsp = 0;
    let amichevoleSubitiAzione = 0;
    let amichevoleSubitiRigore = 0;
    let amichevoleSubitiPiazzato = 0;

    if (partiteChiuse && partiteChiuse.length > 0) {
      for (const m of partiteChiuse) {
        const isFriendly = m.dettagli ? m.dettagli.toLowerCase().includes("amichevole") : false;
        if (isFriendly && m.referto) {
          const r = m.referto.find(x => (x.snapshotGiocatore?.nome || x.nome).trim().toLowerCase() === g.nome.trim().toLowerCase());
          if (r) {
            amichevoleGol += Number(r.gol) || 0;
            amichevoleAssist += Number(r.assist) || 0;
            amichevoleAmm += Number(r.amm) || 0;
            amichevoleEsp += Number(r.rossi) || 0;
            amichevoleSubitiAzione += Number(r.subitiAzione) || 0;
            amichevoleSubitiRigore += Number(r.subitiRigore) || 0;
            amichevoleSubitiPiazzato += Number(r.subitiPiazzato) || 0;
          }
        }
      }
    }

    const amichevoleSubiti = amichevoleSubitiAzione + amichevoleSubitiRigore + amichevoleSubitiPiazzato;
    const amichevoleMalus = amichevoleAmm + amichevoleEsp * 3;

    // 3. Campionato = Totale - Amichevole
    const campionatoGol = Math.max(0, totalGol - amichevoleGol);
    const campionatoAssist = Math.max(0, totalAssist - amichevoleAssist);
    const campionatoAmm = Math.max(0, totalAmm - amichevoleAmm);
    const campionatoEsp = Math.max(0, totalEsp - amichevoleEsp);
    const campionatoSubitiAzione = Math.max(0, (g.golSubitiAzione || 0) - amichevoleSubitiAzione);
    const campionatoSubitiRigore = Math.max(0, (g.golSubitiRigore || 0) - amichevoleSubitiRigore);
    const campionatoSubitiPiazzato = Math.max(0, (g.golSubitiPiazzato || 0) - amichevoleSubitiPiazzato);
    const campionatoSubiti = campionatoSubitiAzione + campionatoSubitiRigore + campionatoSubitiPiazzato;
    const campionatoMalus = campionatoAmm + campionatoEsp * 3;

    return {
      nome: g.nome,
      numeroMaglia: g.numeroMaglia,
      ultimoRuolo: g.ultimoRuolo,
      campionato: {
        gol: campionatoGol,
        assist: campionatoAssist,
        ammonizioni: campionatoAmm,
        espulsioni: campionatoEsp,
        subitiAzione: campionatoSubitiAzione,
        subitiRigore: campionatoSubitiRigore,
        subitiPiazzato: campionatoSubitiPiazzato,
        subiti: campionatoSubiti,
        malus: campionatoMalus
      },
      amichevole: {
        gol: amichevoleGol,
        assist: amichevoleAssist,
        ammonizioni: amichevoleAmm,
        espulsioni: amichevoleEsp,
        subitiAzione: amichevoleSubitiAzione,
        subitiRigore: amichevoleSubitiRigore,
        subitiPiazzato: amichevoleSubitiPiazzato,
        subiti: amichevoleSubiti,
        malus: amichevoleMalus
      },
      totale: {
        gol: totalGol,
        assist: totalAssist,
        ammonizioni: totalAmm,
        espulsioni: totalEsp,
        subitiAzione: g.golSubitiAzione || 0,
        subitiRigore: g.golSubitiRigore || 0,
        subitiPiazzato: g.golSubitiPiazzato || 0,
        subiti: totalSubiti,
        malus: totalMalus
      }
    };
  });

  // Project active selection type
  const mappedPlayers = computedPlayers.map(p => {
    const activeStats = p[activeType];
    return {
      nome: p.nome,
      numeroMaglia: p.numeroMaglia,
      ultimoRuolo: p.ultimoRuolo,
      gol: activeStats.gol,
      assist: activeStats.assist,
      ammonizioni: activeStats.ammonizioni,
      espulsioni: activeStats.espulsioni,
      subiti: activeStats.subiti,
      golSubitiAzione: activeStats.subitiAzione,
      golSubitiRigore: activeStats.subitiRigore,
      golSubitiPiazzato: activeStats.subitiPiazzato,
      malus: activeStats.malus
    };
  });

  // Compute Top Scorer
  const topScorers = [...mappedPlayers]
    .filter(g => g.gol > 0)
    .sort((a, b) => b.gol - a.gol || b.nome.localeCompare(a.nome));

  // Compute Top Assists
  const topAssists = [...mappedPlayers]
    .filter(g => g.assist > 0)
    .sort((a, b) => b.assist - a.assist || b.nome.localeCompare(a.nome));

  // Compute Bad Boys
  const badBoys = [...mappedPlayers]
    .filter(g => g.malus > 0)
    .sort((a, b) => b.malus - a.malus || b.nome.localeCompare(a.nome));

  // Compute Goalkeepers
  const gks = [...mappedPlayers]
    .filter(g => g.subiti > 0 || g.ultimoRuolo === "Portiere")
    .sort((a, b) => a.subiti - b.subiti || b.nome.localeCompare(a.nome));

  return (
    <div className="space-y-4 mb-6">
      {/* Selector Row */}
      <div className="bg-white border border-slate-200 p-2.5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 pl-1.5 pt-0.5">
          <Trophy className="h-5 w-5 text-slate-700" />
          <div>
            <h2 className="text-xs font-bold uppercase text-slate-700 tracking-wider">Podio Statistiche</h2>
            <p className="text-xs text-slate-500">Filtra per tipologia di partita</p>
          </div>
        </div>
        <div className="flex bg-slate-150 p-1 rounded-xl items-center gap-1 self-start sm:self-auto shadow-sm border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveType("campionato")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeType === "campionato"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-250"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🏆</span> <span>Campionato</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveType("amichevole")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeType === "amichevole"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-250"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🤝</span> <span>Amichevoli</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveType("totale")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeType === "totale"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-250"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🌍</span> <span>Tutte</span>
          </button>
        </div>
      </div>

      {/* Grid of 4 categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Bomber (Top Scorer) */}
        <div className="bg-white border-t-4 border-t-amber-500 border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs uppercase font-bold text-amber-800 tracking-wider">
                Capocannoniere
              </span>
              <h3 className="text-sm font-semibold text-slate-900">Pichichi</h3>
            </div>
            <div className="bg-amber-50 p-1.5 rounded-lg text-amber-700">
              <Trophy className="h-4.5 w-4.5" />
            </div>
          </div>
          {topScorers.length > 0 ? (
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 font-mono">
                  {topScorers[0].gol}
                </span>
                <span className="text-xs font-semibold text-slate-600 uppercase">
                  Gol Fatti
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 mt-1 truncate flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250">
                  {topScorers[0].numeroMaglia}
                </span>
                <span>{topScorers[0].nome}</span>
              </p>
              {topScorers.length > 1 && (
                <p className="text-xs text-slate-500 mt-1 truncate">
                  Inseguono: {topScorers[1].nome} ({topScorers[1].gol})
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic mt-4">Nessun gol segnato</p>
          )}
        </div>

        {/* 2. Assistman */}
        <div className="bg-white border-t-4 border-t-sky-500 border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs uppercase font-bold text-sky-800 tracking-wider">
                Miglior Assistman
              </span>
              <h3 className="text-sm font-semibold text-slate-900">Rifinitore</h3>
            </div>
            <div className="bg-sky-50 p-1.5 rounded-lg text-sky-700">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
          </div>
          {topAssists.length > 0 ? (
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 font-mono">
                  {topAssists[0].assist}
                </span>
                <span className="text-xs font-semibold text-slate-600 uppercase">
                  Assist
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 mt-1 truncate flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-250">
                  {topAssists[0].numeroMaglia}
                </span>
                <span>{topAssists[0].nome}</span>
              </p>
              {topAssists.length > 1 && (
                <p className="text-xs text-slate-500 mt-1 truncate">
                  Inseguono: {topAssists[1].nome} ({topAssists[1].assist})
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic mt-4">Nessun assist registrato</p>
          )}
        </div>

        {/* 3. Goalkeepers (Zamora) */}
        <div className="bg-white border-t-4 border-t-teal-500 border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs uppercase font-bold text-teal-800 tracking-wider">
                Gol Subiti
              </span>
              <h3 className="text-sm font-semibold text-slate-900">Saracinesca</h3>
            </div>
            <div className="bg-teal-50 p-1.5 rounded-lg text-teal-700">
              <Shield className="h-4.5 w-4.5" />
            </div>
          </div>
          {gks.length > 0 ? (
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 font-mono">
                  {gks[0].subiti}
                </span>
                <span className="text-xs font-semibold text-slate-600 uppercase">
                  Subiti Tot
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 mt-1 truncate flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-250">
                  {gks[0].numeroMaglia}
                </span>
                <span>{gks[0].nome}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1 truncate">
                Az: {gks[0].golSubitiAzione} | Rig: {gks[0].golSubitiRigore} | Pun:{" "}
                {gks[0].golSubitiPiazzato}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic mt-4">Nessun portiere registrato</p>
          )}
        </div>

        {/* 4. Bad Boy / Cartellini */}
        <div className="bg-white border-t-4 border-t-red-500 border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs uppercase font-bold text-red-00 tracking-wider">
                Sanzioni
              </span>
              <h3 className="text-sm font-semibold text-slate-900">Cartellini</h3>
            </div>
            <div className="bg-red-50 p-1.5 rounded-lg text-red-700">
              <Award className="h-4.5 w-4.5" />
            </div>
          </div>
          {badBoys.length > 0 ? (
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 font-mono">
                  {badBoys[0].malus}
                </span>
                <span className="text-xs font-semibold text-slate-600 uppercase">
                  Punti (🟨1, 🟥3)
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 mt-1 truncate flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-red-800 bg-red-50 px-1.5 py-0.5 rounded border border-red-250">
                  {badBoys[0].numeroMaglia}
                </span>
                <span>{badBoys[0].nome}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1 truncate">
                🟨 {badBoys[0].ammonizioni} gialli | 🟥 {badBoys[0].espulsioni} rossi
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic mt-4">Nessuna sanzione disciplinare</p>
          )}
        </div>
      </div>
    </div>
  );
}
