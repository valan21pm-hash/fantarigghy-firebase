/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { CheckCircle2, Trophy, AlertTriangle } from "lucide-react";
import { Giocatore, Partita, RefertoGiocatore, PLAYER_CUSTOM_BONUSES, getPlayerBonusKey, GENERIC_BONUSES } from "../types";

interface MatchReportProps {
  giocatori: Giocatore[];
  partiteAperte: Partita[];
  onChiudiPartita: (
    idPartita: string,
    costoFinale: number,
    presenti: string[],
    risultato: string,
    referto: RefertoGiocatore[],
    note?: string
  ) => Promise<void>;
  onAnnullaPartita: (idPartita: string) => Promise<void>;
  isEditor?: boolean;
  selectedMatchId?: string;
  onSelectMatchId?: (id: string) => void;
}

export default function MatchReport({
  giocatori,
  partiteAperte,
  onChiudiPartita,
  onAnnullaPartita,
  isEditor = false,
  selectedMatchId: externalSelectedMatchId,
  onSelectMatchId,
}: MatchReportProps) {
  if (!isEditor) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" id="sezione-referto">
        <div className="bg-slate-900 px-6 py-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📝</span> Inserisci Referto
          </h2>
          <p className="text-xs text-slate-300">
            Chiudi partite e aggiorna statistiche
          </p>
        </div>
        <div className="p-12 text-center max-w-sm mx-auto space-y-4">
          <div className="text-4xl font-semibold">🔒</div>
          <h3 className="text-lg font-bold text-gray-800 tracking-tight">Area riservata agli amministratori</h3>
        </div>
      </div>
    );
  }

  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [risultato, setRisultato] = useState("");
  const [costo, setCosto] = useState("");
  const [note, setNote] = useState("");

  const activeMatch = partiteAperte.find(p => p.id === selectedMatchId);
  const isAmichevole = activeMatch ? activeMatch.dettagli.includes("[Amichevole]") : false;

  // Custom UI Modals & Notifications States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAnnullaModal, setShowAnnullaModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    risultato: string;
    costoTotale: number;
    pagantiConteggio: number;
    quotaSingola: number;
    refertoCompleto: RefertoGiocatore[];
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Stats input state
  // key of map: player name. Value: stats
  const [presents, setPresents] = useState<string[]>([]);
  const [payers, setPayers] = useState<string[]>([]);
  const [goals, setGoals] = useState<Record<string, string>>({});
  const [assists, setAssists] = useState<Record<string, string>>({});
  const [yellows, setYellows] = useState<Record<string, string>>({});
  const [reds, setReds] = useState<Record<string, string>>({});
  const [subAzione, setSubAzione] = useState<Record<string, string>>({});
  const [subRigore, setSubRigore] = useState<Record<string, string>>({});
  const [subPiazzato, setSubPiazzato] = useState<Record<string, string>>({});
  const [selectedBonuses, setSelectedBonuses] = useState<Record<string, string[]>>({});
  const [statoPresenza, setStatoPresenza] = useState<Record<string, "giocato" | "assente" | "sostituito">>({});
  const [sostitutoDa, setSostitutoDa] = useState<Record<string, string>>({});
  const [editingPlayerName, setEditingPlayerName] = useState<string | null>(null);

  // Initialize form state when match changes
  const handleSelectMatch = (id: string) => {
    setSelectedMatchId(id);
    if (onSelectMatchId) onSelectMatchId(id);
    setValidationError(null);
    setSuccessMessage(null);
    const m = partiteAperte.find(p => p.id === id);
    if (m) {
      const hasReferto = m.referto && m.referto.length > 0;
      setRisultato(hasReferto ? (m.risultato || "") : "");
      setCosto(m.costo.toString());
      setNote(hasReferto ? (m.note || "") : "");
      
      if (hasReferto) {
        const presentsList = m.referto.map(r => r.nome);
        const payersList = m.referto.filter(r => r.pagaQuota).map(r => r.nome);
        setPresents(presentsList);
        setPayers(payersList);

        const gMap: Record<string, string> = {};
        const aMap: Record<string, string> = {};
        const yMap: Record<string, string> = {};
        const rMap: Record<string, string> = {};
        const saMap: Record<string, string> = {};
        const srMap: Record<string, string> = {};
        const spMap: Record<string, string> = {};
        const bMap: Record<string, string[]> = {};
        const statoPresMap: Record<string, "giocato" | "assente" | "sostituito"> = {};
        const sostDaMap: Record<string, string> = {};

        m.referto.forEach(r => {
          if (r.gol > 0) gMap[r.nome] = r.gol.toString();
          if (r.assist > 0) aMap[r.nome] = r.assist.toString();
          if (r.amm > 0) yMap[r.nome] = r.amm.toString();
          if (r.rossi > 0) rMap[r.nome] = r.rossi.toString();
          if (r.subitiAzione > 0) saMap[r.nome] = r.subitiAzione.toString();
          if (r.subitiRigore > 0) srMap[r.nome] = r.subitiRigore.toString();
          if (r.subitiPiazzato > 0) spMap[r.nome] = r.subitiPiazzato.toString();
          if (r.bonusAttivi && r.bonusAttivi.length > 0) {
            bMap[r.nome] = r.bonusAttivi;
          }
          statoPresMap[r.nome] = r.statoPresenza || (presentsList.includes(r.nome) ? "giocato" : "assente");
          sostDaMap[r.nome] = r.sostitutoDa || "";
        });

        setGoals(gMap);
        setAssists(aMap);
        setYellows(yMap);
        setReds(rMap);
        setSubAzione(saMap);
        setSubRigore(srMap);
        setSubPiazzato(spMap);
        setSelectedBonuses(bMap);
        setStatoPresenza(statoPresMap);
        setSostitutoDa(sostDaMap);
      } else {
        setPresents(m.convocati);
        setPayers(m.convocati);
        // Empty stats maps
        setGoals({});
        setAssists({});
        setYellows({});
        setReds({});
        setSubAzione({});
        setSubRigore({});
        setSubPiazzato({});
        setSelectedBonuses({});

        const initialStatoPres: Record<string, "giocato" | "assente" | "sostituito"> = {};
        const initialSostDa: Record<string, string> = {};
        m.convocati.forEach(name => {
          initialStatoPres[name] = "giocato";
          initialSostDa[name] = "";
        });
        setStatoPresenza(initialStatoPres);
        setSostitutoDa(initialSostDa);
      }
    } else {
      setPresents([]);
      setPayers([]);
      setNote("");
      setSelectedBonuses({});
      setStatoPresenza({});
      setSostitutoDa({});
    }
  };

  useEffect(() => {
    if (externalSelectedMatchId !== undefined && externalSelectedMatchId !== selectedMatchId) {
      handleSelectMatch(externalSelectedMatchId);
    }
  }, [externalSelectedMatchId]);

  const handleToggleBonus = (player: string, bonusId: string) => {
    setSelectedBonuses(prev => {
      const current = prev[player] || [];
      const updated = current.includes(bonusId)
        ? current.filter(id => id !== bonusId)
        : [...current, bonusId];
      return { ...prev, [player]: updated };
    });
  };

  const handleTogglePresent = (nome: string) => {
    if (presents.includes(nome)) {
      setPresents(presents.filter(x => x !== nome));
      // Remove from payers too
      setPayers(payers.filter(x => x !== nome));
    } else {
      setPresents([...presents, nome]);
      setPayers([...payers, nome]);
    }
  };

  const handleTogglePayer = (nome: string) => {
    if (payers.includes(nome)) {
      setPayers(payers.filter(x => x !== nome));
    } else {
      setPayers([...payers, nome]);
    }
  };

  const handleStatNumberInput = (
    nome: string,
    val: string,
    setter: React.Dispatch<React.SetStateAction<Record<string, string>>>
  ) => {
    setter(prev => ({ ...prev, [nome]: val }));
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);
    if (!selectedMatchId || !activeMatch) return;
    
    if (!risultato.trim()) {
      setValidationError("Si prega di inserire il risultato finale (es. 5-3).");
      return;
    }

    // Build actual presents list for database (those who actually played)
    const presentsList: string[] = [];
    activeMatch.convocati.forEach(nome => {
      const state = statoPresenza[nome] || "giocato";
      if (state === "giocato") {
        presentsList.push(nome);
      } else if (state === "sostituito" && sostitutoDa[nome]) {
        presentsList.push(sostitutoDa[nome]);
      }
    });

    if (presentsList.length === 0) {
      setValidationError("Si prega di selezionare almeno un giocatore presente.");
      return;
    }

    const costNum = parseFloat(costo) || 0;
    const pagantiList = payers.filter(name => presentsList.includes(name));
    const pagantiConteggio = pagantiList.length;
    
    if (pagantiConteggio === 0 && costNum > 0) {
      setValidationError("La partita ha un costo ma non ci sono paganti selezionati!");
      return;
    }

    // Form accurate dynamic list of players to save in the report
    const activeSubstitutes = activeMatch.convocati
      .filter(nome => statoPresenza[nome] === "sostituito" && sostitutoDa[nome])
      .map(nome => sostitutoDa[nome]);

    const unconvokedPlayers = giocatori
      .filter(g => g.attivo)
      .filter(g => !activeMatch.convocati.includes(g.nome))
      .filter(g => !activeSubstitutes.includes(g.nome));

    const allPlayersInReport = [...activeMatch.convocati, ...activeSubstitutes, ...unconvokedPlayers.map(g => g.nome)];

    // Build referto list including original convocati, active substitutes, and unconvoked/benched players with active bonuses
    const refertoCompleto: RefertoGiocatore[] = allPlayersInReport.map(nome => {
      const isConvocato = activeMatch.convocati.includes(nome);
      const isSubstitute = activeSubstitutes.includes(nome);
      
      let pres: "giocato" | "assente" | "sostituito" = "giocato";
      if (isConvocato) {
        pres = statoPresenza[nome] || "giocato";
      } else if (isSubstitute) {
        pres = "giocato";
      } else {
        pres = "assente"; // Represent unconvoked as "assente" so they don't count towards presentsList but still hold bonuses
      }
      
      const isPresent = pres === "giocato";

      return {
        nome,
        gol: isPresent ? parseInt(goals[nome] || "0") : 0,
        assist: isPresent ? parseInt(assists[nome] || "0") : 0,
        amm: isPresent ? parseInt(yellows[nome] || "0") : 0,
        rossi: isPresent ? parseInt(reds[nome] || "0") : 0,
        subitiAzione: isPresent ? parseInt(subAzione[nome] || "0") : 0,
        subitiRigore: isPresent ? parseInt(subRigore[nome] || "0") : 0,
        subitiPiazzato: isPresent ? parseInt(subPiazzato[nome] || "0") : 0,
        pagaQuota: isPresent ? payers.includes(nome) : false,
        bonusAttivi: pres !== "sostituito" ? (selectedBonuses[nome] || []) : [],
        statoPresenza: pres,
        sostitutoDa: isConvocato ? (sostitutoDa[nome] || "") : "",
      };
    });

    const individualDebt = pagantiConteggio > 0 ? costNum / pagantiConteggio : 0;
    
    setConfirmModalData({
      risultato: risultato.trim(),
      costoTotale: costNum,
      pagantiConteggio,
      quotaSingola: individualDebt,
      refertoCompleto,
      presentsList
    });
    setShowConfirmModal(true);
  };

  const handleConfirmClose = async () => {
    if (!confirmModalData || !selectedMatchId) return;
    try {
      setValidationError(null);
      await onChiudiPartita(
        selectedMatchId,
        confirmModalData.costoTotale,
        confirmModalData.presentsList,
        confirmModalData.risultato,
        confirmModalData.refertoCompleto,
        note.trim()
      );
      
      setSuccessMessage("Partita refertata con successo! I saldi dei conti sono stati aggiornati.");
      
      // Clear states
      setSelectedMatchId("");
      setRisultato("");
      setCosto("");
      setNote("");
      setSelectedBonuses({});
      setShowConfirmModal(false);
      setConfirmModalData(null);
    } catch (err: any) {
      setValidationError(`Errore durante la chiusura: ${err.message || err}`);
      setShowConfirmModal(false);
    }
  };

  const handleAnnullaClick = () => {
    if (!selectedMatchId) return;
    setShowAnnullaModal(true);
  };

  const handleConfirmAnnulla = async () => {
    try {
      setValidationError(null);
      await onAnnullaPartita(selectedMatchId);
      setSuccessMessage("Partita annullata e rimossa con successo dal sistema.");
      setSelectedMatchId("");
      setShowAnnullaModal(false);
    } catch (err: any) {
      setValidationError(`Errore durante l'annullamento: ${err.message || err}`);
      setShowAnnullaModal(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" id="sezione-referto">
      <div className="bg-slate-900 px-6 py-4 border-b border-slate-850">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📝</span> Inserisci Referto Gara
        </h2>
        <p className="text-xs text-slate-300">
          Registra il punteggio, gol, assist e cartellini di ogni convocato per aggiornare le classifiche
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Inline Alerts for Sandbox Friendliness */}
        {successMessage && (
          <div className="p-4 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs font-bold animate-in fade-in duration-200">
            <CheckCircle2 className="h-5 w-5 text-slate-605 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-extrabold uppercase text-[10px] tracking-wider text-slate-950">Operazione Completata</p>
              <p className="text-[11px] font-semibold text-slate-900">{successMessage}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setSuccessMessage(null)}
              className="ml-auto text-slate-700 hover:text-slate-900 text-[11px] font-bold uppercase tracking-wide cursor-pointer"
            >
              chiudi
            </button>
          </div>
        )}

        {validationError && (
          <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs font-bold animate-in' fade-in duration-200">
            <AlertTriangle className="h-5 w-5 text-red-650 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-extrabold uppercase text-[10px] tracking-wider text-red-950">Attenzione / Errore</p>
              <p className="text-[11px] font-semibold text-red-900">{validationError}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setValidationError(null)}
              className="ml-auto text-red-750 hover:text-red-950 text-[11px] font-extrabold uppercase tracking-wide cursor-pointer"
            >
              chiudi
            </button>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Seleziona Partita da Chiudere</label>
          <select
            value={selectedMatchId}
            onChange={e => handleSelectMatch(e.target.value)}
            className="w-full text-sm p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
          >
            <option value="">-- Seleziona Gara --</option>
            {partiteAperte.map(p => (
              <option key={p.id} value={p.id}>
                {p.dettagli}
              </option>
            ))}
          </select>
        </div>

        {activeMatch && activeMatch.referto && activeMatch.referto.length > 0 && (
          <div className="p-3 bg-indigo-50 border border-indigo-250 rounded-xl text-indigo-900 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-200">
            <span className="text-sm shrink-0 mt-0.5">💡</span>
            <div>
              <p className="font-extrabold uppercase text-[10px] tracking-wider text-indigo-950">Referto Precompilato Caricato</p>
              <p className="text-[11.5px] font-medium text-indigo-800 leading-relaxed mt-0.5">
                Questa partita è stata riaperta conservando i dati del referto e il risultato. Modifica solo i dati che vuoi aggiornare qui sotto e infine clicca su <strong>Chiudi Partita &amp; Addebita Quote</strong> per salvare le modifiche definitive.
              </p>
            </div>
          </div>
        )}

        {activeMatch ? (
          <form onSubmit={handleSubmitReport} className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-900 uppercase mb-1">Risultato Finale Gara</label>
                  <input
                    type="text"
                    required
                    placeholder="es. 6-4"
                    value={risultato}
                    onChange={e => setRisultato(e.target.value)}
                    className="w-full text-sm p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 uppercase mb-1">Costo Finale Campo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="es. 60"
                    value={costo}
                    onChange={e => setCosto(e.target.value)}
                    className="w-full text-sm p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase mb-1 flex justify-between items-center">
                  <span>Note della partita</span>
                  <span className="text-[10px] text-gray-500 font-normal lowercase italic">Opzionale - premi invio o ignora se vuoto</span>
                </label>
                <textarea
                  placeholder="es. Arbitro impeccabile, gran gol di tacco di Mario, ammonizione per proteste..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  className="w-full text-sm p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none resize-none placeholder-gray-400 font-medium"
                />
              </div>
            </div>

            {/* Attendance & stats input list */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                  Referto Individuale Giocatori
                </h3>
                <span className="text-[10px] text-gray-400 font-bold uppercase">
                  Clicca un giocatore per modificare
                </span>
              </div>

              <div className="border border-gray-100 rounded-xl p-3.5 bg-gray-50 max-h-[500px] overflow-y-auto space-y-4">
                {(() => {
                  const activeSubstitutes = activeMatch.convocati
                    .filter(nome => statoPresenza[nome] === "sostituito" && sostitutoDa[nome])
                    .map(nome => sostitutoDa[nome]);

                  const convocatiAndSubs: { nome: string; parentConvocato?: string; isSubstitute?: boolean }[] = [];
                  activeMatch.convocati.forEach(nome => {
                    convocatiAndSubs.push({ nome });
                    const st = statoPresenza[nome] || "giocato";
                    if (st === "sostituito" && sostitutoDa[nome]) {
                      convocatiAndSubs.push({
                        nome: sostitutoDa[nome],
                        parentConvocato: nome,
                        isSubstitute: true
                      });
                    }
                  });

                  const unconvokedList = giocatori
                    .filter(g => g.attivo)
                    .filter(g => !activeMatch.convocati.includes(g.nome))
                    .filter(g => !activeSubstitutes.includes(g.nome));

                  return (
                    <>
                      {/* GRUPPO A: CONVOCATI IN CAMPO E ASSENTI */}
                      <div>
                        <div className="flex items-center gap-1.5 pb-2 mb-2.5 border-b border-gray-200">
                          <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">👕 Giocatori Convocati ({activeMatch.convocati.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {convocatiAndSubs.map((item, idx) => {
                            const { nome, parentConvocato, isSubstitute } = item;
                            const g = giocatori.find(x => x.nome === nome);
                            const isPortiere = g?.ultimoRuolo === "Portiere";

                            const state = isSubstitute ? "giocato" : (statoPresenza[nome] || "giocato");
                            const isPresent = state === "giocato";

                            // count active stats
                            const pGoals = Number(goals[nome]) || 0;
                            const pAssists = Number(assists[nome]) || 0;
                            const pYellows = Number(yellows[nome]) || 0;
                            const pReds = Number(reds[nome]) || 0;
                            const pSubAzione = Number(subAzione[nome]) || 0;
                            const pSubRigore = Number(subRigore[nome]) || 0;
                            const pSubPiazzato = Number(subPiazzato[nome]) || 0;
                            const pBonuses = selectedBonuses[nome] || [];

                            const pills = [];
                            if (pGoals > 0) pills.push(`⚽ ${pGoals}`);
                            if (pAssists > 0) pills.push(`👟 ${pAssists}`);
                            if (pYellows > 0) pills.push(`🟨 ${pYellows}`);
                            if (pReds > 0) pills.push(`🟥 ${pReds}`);
                            if (isPortiere && (pSubAzione > 0 || pSubRigore > 0 || pSubPiazzato > 0)) {
                              pills.push(`🧤 -${pSubAzione + pSubRigore + pSubPiazzato}`);
                            }
                            if (!isAmichevole && pBonuses.length > 0) pills.push(`🎒 +${pBonuses.length}`);

                            let cardClass = "";
                            let dotClass = "";
                            let subtitle = "";

                            if (isSubstitute) {
                              cardClass = "bg-emerald-50/50 border-emerald-250 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-350";
                              dotClass = "bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse";
                              subtitle = `#${g?.numeroMaglia || "??"} • 🔁 Subentrato per ${parentConvocato}`;
                            } else if (state === "giocato") {
                              cardClass = "bg-white border-slate-300 hover:border-slate-400 hover:shadow-md text-gray-900";
                              dotClass = "bg-slate-700 shadow-[0_0_8px_#334155]";
                              subtitle = `#${g?.numeroMaglia || "??"} • ${g?.ultimoRuolo || "Calciatore"}`;
                            } else if (state === "assente") {
                              cardClass = "bg-red-50/40 border-red-200 text-red-900 opacity-80 hover:bg-red-100/40 hover:border-red-300";
                              dotClass = "bg-red-400";
                              subtitle = `#${g?.numeroMaglia || "??"} • ❌ Non in Campo`;
                            } else if (state === "sostituito") {
                              cardClass = "bg-orange-50/40 border-orange-200 text-orange-950 opacity-80 hover:bg-orange-100/30 hover:border-orange-300";
                              dotClass = "bg-orange-400";
                              subtitle = `#${g?.numeroMaglia || "??"} • 🔁 Sostituto da: ${sostitutoDa[nome] || "Nessuno"}`;
                            }

                            return (
                              <button
                                type="button"
                                key={`${nome}-${idx}`}
                                onClick={() => setEditingPlayerName(nome)}
                                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex justify-between items-center group relative ${cardClass}`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-3 h-3 rounded-full shrink-0 ${dotClass}`} />
                                  <div className="min-w-0">
                                    <span className="font-extrabold text-sm block truncate group-hover:text-slate-900">
                                      {nome}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold block mt-0.5">
                                      {subtitle}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-1 items-center justify-end max-w-[50%] shrink-0">
                                  {pills.length > 0 ? (
                                    pills.map((p, pIdx) => (
                                      <span key={pIdx} className="bg-gray-150 text-gray-800 font-bold text-[9px] px-1.5 py-0.5 rounded border border-gray-200">
                                        {p}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-gray-400 group-hover:text-slate-700 transition-colors flex items-center gap-1 font-semibold uppercase">
                                      {isPresent ? "Dettagli ➔" : state === "assente" ? "Dettagli Extra" : "Reclutato"}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* GRUPPO B: NON CONVOCATI / PANCHINARI (BONUS ESTERNI/TIFO) */}
                      {unconvokedList.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 pb-2 mb-2.5 border-b border-gray-200 pt-2">
                            <span className="text-[11px] font-black text-indigo-750 uppercase tracking-wider">📢 Sostenitori e Panchinari (Non Convocati)</span>
                            <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded ml-auto uppercase tracking-wide">Bonus Esterni</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {unconvokedList.map((g, idx) => {
                              const nome = g.nome;
                              const pBonuses = selectedBonuses[nome] || [];
                              const pills = [];
                              if (pBonuses.length > 0) pills.push(`🎒 +${pBonuses.length}`);

                              const cardClass = "bg-indigo-50/30 border-indigo-150 hover:bg-indigo-100/40 hover:border-indigo-250 text-indigo-950";
                              const dotClass = pBonuses.length > 0 ? "bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)] animate-pulse" : "bg-indigo-400";
                              const subtitle = `#${g.numeroMaglia || "??"} • 📣 Non Convocato`;

                              return (
                                <button
                                  type="button"
                                  key={`unconvoked-${nome}-${idx}`}
                                  onClick={() => setEditingPlayerName(nome)}
                                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex justify-between items-center group relative ${cardClass}`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-3 h-3 rounded-full shrink-0 ${dotClass}`} />
                                    <div className="min-w-0">
                                      <span className="font-extrabold text-sm block truncate group-hover:text-slate-900">
                                        {nome}
                                      </span>
                                      <span className="text-[10px] font-mono font-bold block mt-0.5 text-indigo-600">
                                        {subtitle}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-1 items-center justify-end max-w-[50%] shrink-0">
                                    {pills.length > 0 ? (
                                      pills.map((p, pIdx) => (
                                        <span key={pIdx} className="bg-indigo-100 text-indigo-805 border border-indigo-200 font-bold text-[9px] px-1.5 py-0.5 rounded">
                                          {p}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-indigo-400 group-hover:text-indigo-750 transition-colors flex items-center gap-1 font-semibold uppercase">
                                        Assegna Bonus ➔
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* POPUP MODAL FOR INTERACTIVE PLAYER STATS & BONUSES */}
            {editingPlayerName && (() => {
              const nome = editingPlayerName;
              const g = giocatori.find(x => x.nome === nome);
              const isPortiere = g?.ultimoRuolo === "Portiere";
              const isConvocato = activeMatch.convocati.includes(nome);

              const activeSubstitutes = activeMatch.convocati
                .filter(nm => statoPresenza[nm] === "sostituito" && sostitutoDa[nm])
                .map(nm => sostitutoDa[nm]);
              const isSubstitute = activeSubstitutes.includes(nome);
              const isUnconvoked = !isConvocato && !isSubstitute;

              const currentStato = isConvocato 
                ? (statoPresenza[nome] || "giocato") 
                : (isSubstitute ? "giocato" : "assente");
              
              const isCurrentlyPlaying = currentStato === "giocato";
              const isPayer = payers.includes(nome);
              const bonusKey = getPlayerBonusKey(nome);
              const baseBonuses = bonusKey ? PLAYER_CUSTOM_BONUSES[bonusKey] : [];

              return (
                <div 
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity overflow-y-auto animate-fade-in"
                  onClick={() => setEditingPlayerName(null)}
                >
                  <div 
                    className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-lg my-8 relative text-left box-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setEditingPlayerName(null)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-gray-750 font-extrabold text-lg cursor-pointer"
                    >
                      ✕
                    </button>
                    
                    <div className="border-b pb-3 mb-4 space-y-1">
                      <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                        👤 Modifica Statistiche e Bonus
                      </h4>
                      <p className={`text-xs font-bold ${isUnconvoked ? "text-indigo-700" : "text-slate-800"}`}>
                        {nome} (Ruolo: {g?.ultimoRuolo || "Calciatore"} • Maglia #{g?.numeroMaglia || "??"} {
                          isUnconvoked 
                            ? "• 📢 Non Convocato" 
                            : isSubstitute 
                              ? "• 🔁 Sostituto Last-Minute" 
                              : ""
                        })
                      </p>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                      
                      {/* STATO PRESENZA CONVOCATO */}
                      {isConvocato && (
                        <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="block text-[10px] uppercase font-black tracking-wider text-slate-600">Presenza e Convocazione</span>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setStatoPresenza(prev => ({ ...prev, [nome]: "giocato" }));
                                if (!presents.includes(nome)) setPresents(prev => [...prev, nome]);
                                if (!payers.includes(nome)) setPayers(prev => [...prev, nome]);
                              }}
                              className={`px-2 py-2.5 rounded-xl border font-extrabold text-[11px] transition-all flex flex-col items-center gap-1 cursor-pointer ${
                                currentStato === "giocato"
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs"
                                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              <span>✅</span>
                              <span>Ha giocato</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setStatoPresenza(prev => ({ ...prev, [nome]: "assente" }));
                                setPresents(prev => prev.filter(x => x !== nome));
                                setPayers(prev => prev.filter(x => x !== nome));
                              }}
                              className={`px-2 py-2.5 rounded-xl border font-extrabold text-[11px] transition-all flex flex-col items-center gap-1 cursor-pointer ${
                                currentStato === "assente"
                                  ? "border-red-500 bg-red-50 text-red-900 shadow-xs"
                                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              <span>❌</span>
                              <span>Assente</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setStatoPresenza(prev => ({ ...prev, [nome]: "sostituito" }));
                                setPresents(prev => prev.filter(x => x !== nome));
                                setPayers(prev => prev.filter(x => x !== nome));
                              }}
                              className={`px-2 py-2.5 rounded-xl border font-extrabold text-[11px] transition-all flex flex-col items-center gap-1 cursor-pointer ${
                                currentStato === "sostituito"
                                  ? "border-orange-500 bg-orange-50 text-orange-900 shadow-xs"
                                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              <span>🔁</span>
                              <span>Sostituito</span>
                            </button>
                          </div>

                          {currentStato === "sostituito" && (
                            <div className="bg-white p-3 rounded-lg border border-orange-200 mt-2 space-y-1">
                              <label className="block text-[10px] font-black uppercase text-orange-950">Seleziona Sostituto alla Rosa</label>
                              <select
                                value={sostitutoDa[nome] || ""}
                                onChange={e => {
                                  const val = e.target.value;
                                  setSostitutoDa(prev => ({ ...prev, [nome]: val }));
                                  if (val) {
                                    if (!presents.includes(val)) setPresents(prev => [...prev, val]);
                                    if (!payers.includes(val)) setPayers(prev => [...prev, val]);
                                  }
                                }}
                                className="w-full text-xs p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 font-extrabold outline-none"
                              >
                                <option value="">-- Seleziona Sostituto --</option>
                                {giocatori
                                  .filter(gj => gj.attivo)
                                  .filter(gj => !activeMatch.convocati.includes(gj.nome))
                                  .map(nc => (
                                    <option key={nc.nome} value={nc.nome}>{nc.nome} (#{nc.numeroMaglia || "??"} • {nc.ultimoRuolo})</option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {/* STATO INFORMATIVO PER CHI NON GIOCA */}
                      {!isCurrentlyPlaying && (
                        <div className="p-3.5 bg-indigo-50 border border-indigo-150 rounded-xl text-xs font-bold text-indigo-900 leading-snug">
                          {isUnconvoked ? (
                            <span>📢 <strong>Sostenitore Non Convocato:</strong> Questo giocatore non prende parte all'incontro sul campo, ma può ricevere bonus personali ed esterni per la sua partecipazione o il tifo a bordo campo!</span>
                          ) : currentStato === "assente" ? (
                            <span>❌ <strong>Convocato Assente:</strong> Questo giocatore è registrato come Assente e non giocherà sul campo, ma può comunque ottenere bonus esterni/social!</span>
                          ) : (
                            <span>🔁 <strong>Sostituito:</strong> Questo giocatore è sostituito all'ultimo momento da <strong>{sostitutoDa[nome] || "Nessuno"}</strong>. I suoi bonus e statistiche sono registrati sulla scheda del sostituto.</span>
                          )}
                        </div>
                      )}

                      {/* QUOTA DI PAGAMENTO SE PRESENTE/GIOCANTE */}
                      {isCurrentlyPlaying && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-905">
                            <input
                              type="checkbox"
                              checked={isPayer}
                              onChange={() => handleTogglePayer(nome)}
                              className="w-4 h-4 text-slate-800 focus:ring-slate-500 rounded cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-950 text-sm">Paga Quota Campo</span>
                              <span className="text-[10px] text-gray-400 font-medium font-sans">Quota campo standard per la partita</span>
                            </div>
                          </label>
                        </div>
                      )}

                      {isCurrentlyPlaying && (
                        <>
                          {/* STATS BASE GRID */}
                          <div>
                            <span className="block text-[10px] uppercase font-black tracking-wider text-gray-400 mb-2">Statistiche Principali</span>
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <span className="block text-[9px] font-bold text-center mb-1 text-gray-500">⚽ Gol</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={goals[nome] || ""}
                                  onChange={e => handleStatNumberInput(nome, e.target.value, setGoals)}
                                  className="w-full text-xs p-2 text-center border rounded-lg font-bold bg-white"
                                />
                              </div>
                              <div>
                                <span className="block text-[9px] font-bold text-center mb-1 text-gray-500">👟 Assist</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={assists[nome] || ""}
                                  onChange={e => handleStatNumberInput(nome, e.target.value, setAssists)}
                                  className="w-full text-xs p-2 text-center border rounded-lg font-bold bg-white"
                                />
                              </div>
                              <div>
                                <span className="block text-[9px] font-bold text-center mb-1 text-yellow-650 font-mono">🟨 Gialli</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={yellows[nome] || ""}
                                  onChange={e => handleStatNumberInput(nome, e.target.value, setYellows)}
                                  className="w-full text-xs p-2 text-center border border-yellow-250 bg-yellow-50/20 rounded-lg font-extrabold"
                                />
                              </div>
                              <div>
                                <span className="block text-[9px] font-bold text-center mb-1 text-red-650 font-mono">🟥 Rossi</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={reds[nome] || ""}
                                  onChange={e => handleStatNumberInput(nome, e.target.value, setReds)}
                                  className="w-full text-xs p-2 text-center border border-red-250 bg-red-50/20 rounded-lg font-extrabold"
                                />
                              </div>
                            </div>
                          </div>

                          {/* PORTIERE STATS */}
                          {isPortiere && (
                            <div className="bg-sky-50/20 p-3 rounded-xl border border-sky-100">
                              <span className="block text-[9px] font-black uppercase text-sky-850 tracking-wider mb-2">🧤 Gol Subiti (Portiere)</span>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <span className="block text-[9px] font-bold text-gray-650 text-center mb-1">Azione</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={subAzione[nome] || ""}
                                    onChange={e => handleStatNumberInput(nome, e.target.value, setSubAzione)}
                                    className="w-full text-xs p-1.5 text-center border bg-white rounded-lg font-semibold"
                                  />
                                </div>
                                <div>
                                  <span className="block text-[9px] font-bold text-gray-650 text-center mb-1">Rigore</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={subRigore[nome] || ""}
                                    onChange={e => handleStatNumberInput(nome, e.target.value, setSubRigore)}
                                    className="w-full text-xs p-1.5 text-center border bg-white rounded-lg font-semibold"
                                  />
                                </div>
                                <div>
                                  <span className="block text-[9px] font-bold text-gray-650 text-center mb-1">Puniz.</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={subPiazzato[nome] || ""}
                                    onChange={e => handleStatNumberInput(nome, e.target.value, setSubPiazzato)}
                                    className="w-full text-xs p-1.5 text-center border bg-white rounded-lg font-semibold"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* BONUS E MALUS (MOSTRATI A TUTTI I GIOCATORI TRANNE A CHI E' STATO SOSTITUITO ALL'ULTIMO MOMENTO) */}
                      {currentStato !== "sostituito" && !isAmichevole && (
                        <div className="space-y-4">
                          {/* PERSONAL BONUSES */}
                          {baseBonuses.length > 0 && (
                            <div className="bg-yellow-50/15 p-3 rounded-xl border border-yellow-150">
                              <span className="block text-[9px] font-black text-yellow-850 uppercase tracking-wide mb-2">🎒 Bonus Personali Fantacalcetto</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {baseBonuses.map(b => {
                                  const isChecked = (selectedBonuses[nome] || []).includes(b.id);
                                  return (
                                    <label
                                      key={b.id}
                                      className={`flex items-start gap-2 p-2 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all ${
                                        isChecked
                                          ? "bg-yellow-105 border-yellow-350 text-yellow-950 shadow-xs"
                                          : "bg-white border-gray-150 hover:bg-gray-50 text-gray-700"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleBonus(nome, b.id)}
                                        className="w-4 h-4 mt-0.5 text-yellow-600 rounded cursor-pointer"
                                      />
                                      <div className="leading-snug">
                                        <span className="block font-black text-[11px] text-gray-900">{b.nome}</span>
                                        <span className="text-[8.5px] text-gray-400 font-medium block mt-0.5 leading-snug">{b.descrizione}</span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* GLOBAL BONUSES */}
                          <div className="bg-slate-50/50 p-3 rounded-xl border border-gray-150">
                            <span className="block text-[9px] font-black text-slate-800 uppercase tracking-wide mb-2">🛡️ Bonus e Malus Generici</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                              {GENERIC_BONUSES.map(b => {
                                const isChecked = (selectedBonuses[nome] || []).includes(b.id);
                                const isMalus = typeof b.punti === "number" && b.punti < 0;
                                return (
                                  <label
                                    key={b.id}
                                    className={`flex items-start gap-1.5 p-1.5 rounded-lg border text-[10px]/tight font-bold cursor-pointer transition-all ${
                                      isChecked
                                        ? isMalus
                                          ? "bg-red-50 border-red-250 text-red-950"
                                          : "bg-slate-50 border-slate-300 text-slate-950"
                                        : "bg-white border-gray-150 hover:bg-gray-50 text-gray-700"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleBonus(nome, b.id)}
                                      className={`w-3.5 h-3.5 mt-0.5 rounded cursor-pointer ${
                                        isMalus ? "text-red-650" : "text-slate-700 focus:ring-slate-500"
                                      }`}
                                    />
                                    <div className="leading-none min-w-0">
                                      <span className="block font-black truncate">{b.nome}</span>
                                      <span className={`text-[8.5px] font-extrabold block mt-0.5 ${isMalus ? "text-red-650" : "text-slate-600"}`}>
                                        ({typeof b.punti === "number" && b.punti > 0 ? `+${b.punti}` : b.punti}pt)
                                      </span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-3.5 mt-4">
                      <button
                        type="button"
                        onClick={() => setEditingPlayerName(null)}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-sm rounded-xl cursor-pointer text-center"
                      >
                        Conferma e Salva
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t">
              <button
                type="submit"
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 rounded-xl text-white text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer font-bold"
              >
                <CheckCircle2 className="h-5 w-5" /> Chiudi Partita & Addebita Quote
              </button>
              <button
                type="button"
                onClick={handleAnnullaClick}
                className="py-3 px-4 bg-red-100 hover:bg-red-250 text-red-700 font-extrabold text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle className="h-5 w-5" /> Annulla Evento
              </button>
            </div>
          </form>
        ) : (
          <div className="py-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-gray-400 italic text-sm">
            Nessuna gara selezionata. Scegli un evento in cima per registrarne il referto finale.
          </div>
        )}
      </div>

      {/* Confirm Close Match Modal */}
      {showConfirmModal && confirmModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 text-left text-gray-905">
            <div className="bg-slate-800 p-4 font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
              <span>Conferma Chiusura Partita</span>
            </div>
            <div className="p-5 space-y-4 text-left">
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                Stai per salvare definitivamente il referto del match e addebitare le quote campo ai conti dei singoli giocatori presenti selezionati.
              </p>
              
              <div className="bg-gray-55 p-3.5 rounded-xl border border-gray-150 space-y-2 text-xs text-gray-700 font-mono">
                <div className="flex justify-between border-b pb-1.5 border-dashed border-gray-200">
                  <span className="font-bold text-gray-500 uppercase">🏆 Risultato:</span>
                  <span className="font-extrabold text-gray-900">{confirmModalData.risultato}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5 border-dashed border-gray-200">
                  <span className="font-bold text-gray-500 uppercase">💰 Costo totale:</span>
                  <span className="font-extrabold text-gray-900">{confirmModalData.costoTotale.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between border-b pb-1.5 border-dashed border-gray-200">
                  <span className="font-bold text-gray-500 uppercase">👥 Giocatori Paganti:</span>
                  <span className="font-extrabold text-gray-900">{confirmModalData.pagantiConteggio}</span>
                </div>
                <div className="flex justify-between pt-0.5 font-sans">
                  <span className="font-bold text-slate-800 uppercase text-[10.5px]">💸 Quota Singola Addebitata:</span>
                  <span className="font-black text-slate-700 text-sm">{confirmModalData.quotaSingola.toFixed(2)}€ / testa</span>
                </div>
              </div>

              <p className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                ⚠️ I saldi personali di ciascun pagante saranno ridotti di {confirmModalData.quotaSingola.toFixed(2)}€. Questa operazione aggiornerà l'archivio {isAmichevole ? "delle amichevoli" : "delle classifiche e i punti Fantacalcetto"} in tempo reale.
              </p>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmClose}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-colors cursor-pointer text-center"
                >
                  Sì, Conferma e Addebita
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Match Modal */}
      {showAnnullaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 text-left text-gray-905">
            <div className="bg-red-800 p-4 font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-200 shrink-0" />
              <span>Annulla Evento Partita</span>
            </div>
            <div className="p-5 space-y-4 text-left">
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                Sei sicuro di voler annullare e rimuovere questo evento partita aperta? Questa operazione è definitiva e rimuoverà la convocazione dal database corrente.
              </p>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmAnnulla}
                  className="flex-1 py-2.5 bg-red-650 hover:bg-red-550 text-white font-extrabold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  Sì, Rimuovi Partita
                </button>
                <button
                  type="button"
                  onClick={() => setShowAnnullaModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
