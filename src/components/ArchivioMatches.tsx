/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Calendar, Edit3, Trash2, Undo2, Award, Users, Share2, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import { Giocatore, Partita, RefertoGiocatore, getPlayerBonusKey, CustomBonusDef, DEFAULT_BONUSES, sortMatchesRecentFirst } from "../types";

interface ArchivioMatchesProps {
  giocatori: Giocatore[];
  partiteChiuse: Partita[];
  onModificaChiusa: (
    idPartita: string,
    dettagli: string,
    costo: number,
    risultato: string,
    referto: RefertoGiocatore[],
    note?: string
  ) => Promise<void>;
  onRiapriPartita: (idPartita: string, conservaDati?: boolean) => Promise<void>;
  onEliminaChiusa: (idPartita: string) => Promise<void>;
  isEditor?: boolean;
  onInviaFanta?: (idPartita: string) => Promise<void>;
  bonuses?: CustomBonusDef[];
}

export default function ArchivioMatches({
  giocatori,
  partiteChiuse,
  onModificaChiusa,
  onRiapriPartita,
  onEliminaChiusa,
  isEditor = false,
  onInviaFanta,
  bonuses
}: ArchivioMatchesProps) {
  // Modal states
  const [activeReviewMatch, setActiveReviewMatch] = useState<Partita | null>(null);
  const [editingMatch, setEditingMatch] = useState<Partita | null>(null);

  // Custom confirmation and message states
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reopenMatchId, setReopenMatchId] = useState<string | null>(null);
  const [conservaDati, setConservaDati] = useState(true);
  const [deleteMatchId, setDeleteMatchId] = useState<string | null>(null);

  // Stats edit form states (used in editingMatch form)
  const [editDettagli, setEditDettagli] = useState("");
  const [editRisultato, setEditRisultato] = useState("");
  const [editCosto, setEditCosto] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editReferto, setEditReferto] = useState<RefertoGiocatore[]>([]);

  // Open detailed match summary and prepare WhatsApp string
  const handleCopyWhatsApp = (p: Partita) => {
    // Split match details
    let dataOra = "";
    let campo = "";
    let avversario = "";

    const partiVs = p.dettagli.split(" vs ");
    if (partiVs.length > 1) {
      avversario = partiVs[1].trim();
    }

    const partiVirgola = partiVs[0].split(", ");
    dataOra = partiVirgola[0].trim();
    if (partiVirgola.length > 1) {
      campo = partiVirgola[1].trim();
    }

    const dataOraGrassetto = dataOra
      .split(" ")
      .map(blocco => {
        const pulito = blocco.replace(/[\/:]/g, match => "\u200B" + match);
        return `*${pulito}*`;
      })
      .join(" ");

    let txt = `🏆 *RISULTATO PARTITA* 🏆\n\n`;
    txt += `📅 *Dettagli:* ${dataOraGrassetto}\n`;
    txt += `🎯 *Risultato:* *${p.risultato || "N/D"}*\n`;
    if (campo) txt += `📍 *Campo:* ${campo}\n`;
    if (avversario) txt += `🆚 *Avversario:* ${avversario}\n`;
    txt += `\n📝 *REFERTO:*\n`;

    p.referto.forEach(r => {
      const g = giocatori.find(x => x.nome === r.nome);
      const isPort = g?.ultimoRuolo === "Portiere";
      const subTot = (r.subitiAzione || 0) + (r.subitiRigore || 0) + (r.subitiPiazzato || 0);

      const statsList: string[] = [];
      if (r.gol > 0) statsList.push(`${r.gol} Gol`);
      if (r.assist > 0) statsList.push(`${r.assist} Assist`);
      if (r.amm > 0) statsList.push(`${r.amm} Giallo`);
      if (r.rossi > 0) statsList.push(`${r.rossi} Rosso`);
      if (subTot > 0) {
        const dSub: string[] = [];
        if (r.subitiAzione > 0) dSub.push(`${r.subitiAzione} Azione`);
        if (r.subitiRigore > 0) dSub.push(`${r.subitiRigore} Rigore`);
        if (r.subitiPiazzato > 0) dSub.push(`${r.subitiPiazzato} Punizione`);
        statsList.push(`${subTot} Subiti (${dSub.join(", ")})`);
      }
      if (r.malusBrt) statsList.push(`📦 Malus BRT (-1)`);
      if (r.bonusAttivi && r.bonusAttivi.length > 0) {
        const allBonuses = bonuses || DEFAULT_BONUSES;
        const activeNames = r.bonusAttivi.map(id => {
          const b = allBonuses.find(x => x.id === id);
          if (b) {
            const pts = b.punti;
            const sign = pts >= 0 ? "+" : "";
            const isProg = r.bonusGolAccreditati?.[b.id];
            if (isProg && isProg > 1) {
              return `${b.nome} (${sign}${pts * isProg} pt, x${isProg})`;
            }
            return `${b.nome} (${sign}${pts} pt)`;
          }
          return null;
        }).filter((name): name is string => name !== null);
        if (activeNames.length > 0) {
          statsList.push(`✨ Bonus: ${activeNames.join(", ")}`);
        }
      }

      if (statsList.length > 0) {
        txt += `- *${r.nome}*: ${statsList.join(", ")}\n`;
      }
    });

    navigator.clipboard.writeText(txt.trim());
    alert("Referto formattato pronto! Incolla nella tua chat WhatsApp dei calciatori.");
  };

  const handleStartEdit = (p: Partita) => {
    setEditingMatch(p);
    setEditDettagli(p.dettagli);
    setEditRisultato(p.risultato);
    setEditCosto(p.costo.toString());
    setEditNote(p.note || "");
    setEditReferto(p.referto || []);
    setActiveReviewMatch(null); // Close review modal if open
  };

  const handleEditRefertoStat = (nome: string, field: keyof RefertoGiocatore, val: any) => {
    setEditReferto(
      editReferto.map(r => {
        if (r.nome === nome) {
          return { ...r, [field]: val };
        }
        return r;
      })
    );
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!editingMatch) return;

    const costNum = parseFloat(editCosto) || 0;
    const pagantiConteggio = editReferto.filter(r => r.pagaQuota).length;

    if (pagantiConteggio === 0 && costNum > 0) {
      setErrorMessage("La partita ha un costo ma non ci sono paganti selezionati nel referto modificato!");
      return;
    }

    try {
      await onModificaChiusa(
        editingMatch.id,
        editDettagli.trim(),
        costNum,
        editRisultato.trim(),
        editReferto,
        editNote.trim()
      );

      setSuccessMessage("Modifiche salvate ed elaborazioni contabili aggregate ricalcolate!");
      setEditingMatch(null);
    } catch (err: any) {
      setErrorMessage(`Errore durante il salvataggio: ${err.message || err}`);
    }
  };

  const handleReopen = (id: string) => {
    setReopenMatchId(id);
  };

  const handleConfirmReopen = async () => {
    if (!reopenMatchId) return;
    try {
      setErrorMessage(null);
      await onRiapriPartita(reopenMatchId, true);
      setSuccessMessage("Partita sbloccata per modifiche!");
      setEditingMatch(null);
      setReopenMatchId(null);
    } catch (err: any) {
      setErrorMessage(`Errore durante la riapertura: ${err.message || err}`);
      setReopenMatchId(null);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteMatchId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteMatchId) return;
    try {
      setErrorMessage(null);
      await onEliminaChiusa(deleteMatchId);
      setSuccessMessage("Partita rimossa con successo!");
      setEditingMatch(null);
      setDeleteMatchId(null);
    } catch (err: any) {
      setErrorMessage(`Errore durante l'eliminazione: ${err.message || err}`);
      setDeleteMatchId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" id="sezione-archivio">
      <div className="bg-slate-900 px-6 py-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📚</span> Archivio Risultati & Referti
        </h2>
        <p className="text-xs text-slate-300">
          Visualizza lo storico partite completate, condividi report sui social, o correggi referti passati
        </p>
      </div>

      <div className="p-6">
        {successMessage && (
          <div className="p-4 mb-4 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs font-bold animate-in fade-in duration-200 text-left">
            <CheckCircle2 className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
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

        {errorMessage && (
          <div className="p-4 mb-4 bg-red-50 text-red-800 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs font-bold animate-in fade-in duration-200 text-left">
            <AlertTriangle className="h-5 w-5 text-red-650 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-extrabold uppercase text-[10px] tracking-wider text-red-950">Errore</p>
              <p className="text-[11px] font-semibold text-red-900">{errorMessage}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setErrorMessage(null)}
              className="ml-auto text-red-750 hover:text-red-950 text-[11px] font-extrabold uppercase tracking-wide cursor-pointer"
            >
              chiudi
            </button>
          </div>
        )}

        {partiteChiuse.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortMatchesRecentFirst(partiteChiuse).map(p => {
              const pagantiCount = p.referto.filter(r => r.pagaQuota).length;
              const isAmichevole = p.dettagli ? p.dettagli.toLowerCase().includes("amichevole") : false;
              return (
                <div
                  key={p.id}
                  className="border border-gray-150 rounded-xl p-4 bg-gray-50/50 hover:bg-gray-50 flex flex-col justify-between gap-3 shadow-xs"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-extrabold text-gray-800 text-sm">{p.dettagli}</h4>
                      <p className="text-[10px] text-gray-405 font-bold uppercase flex flex-wrap items-center gap-2 mt-1">
                        <span className="bg-slate-50 text-slate-800 px-2 py-0.5 rounded border border-slate-200">👥 Convocati: <strong>{p.convocati?.length || 0}</strong></span>
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">💰 Paganti: <strong>{pagantiCount}</strong></span>
                        <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-150">💵 Costo: <strong>{p.costo.toFixed(2)}€</strong></span>
                      </p>
                      {p.note && (
                        <div className="mt-1.5 text-xs text-slate-850 bg-slate-50 border border-slate-200 p-2 rounded-lg font-medium italic select-none">
                          <span className="not-italic mr-1">📝</span> {p.note}
                        </div>
                      )}
                    </div>
                    <span className="bg-slate-800 text-white font-bold px-3 py-1 rounded-lg text-xs leading-none">
                      {p.risultato || "N/D"}
                    </span>
                  </div>

                  {/* Convocati listed by role */}
                  {!isAmichevole && p.convocati && p.convocati.length > 0 && (
                    <div className="bg-white/60 border border-gray-150 p-2.5 rounded-xl text-left space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1">
                        ⚽ Convocati per Ruolo:
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
                        {(() => {
                          const grouped: Record<string, string[]> = {};
                          p.convocati.forEach(name => {
                            const g = giocatori.find(x => x.nome.trim().toLowerCase() === name.trim().toLowerCase());
                            const role = g?.ultimoRuolo || "Altri";
                            if (!grouped[role]) grouped[role] = [];
                            grouped[role].push(name);
                          });
                          const rolesOrder = ["Portiere", "Centrale", "Laterale", "Pivot", "Allenatore"];
                          const sorted = Object.keys(grouped).sort((a, b) => {
                            const idxA = rolesOrder.indexOf(a);
                            const idxB = rolesOrder.indexOf(b);
                            if (idxA === -1 && idxB === -1) return a.localeCompare(b);
                            if (idxA === -1) return 1;
                            if (idxB === -1) return -1;
                            return idxA - idxB;
                          });
                          
                          const getRoleBadgeStyle = (role: string) => {
                            switch (role) {
                              case "Portiere": return "bg-amber-50 text-amber-800 border-amber-200/50";
                              case "Centrale": return "bg-sky-50 text-sky-800 border-sky-200/50";
                              case "Laterale": return "bg-slate-50 text-slate-800 border-slate-200";
                              case "Pivot": return "bg-rose-50 text-rose-800 border-rose-250";
                              case "Allenatore": return "bg-purple-50 text-purple-800 border-purple-200/50";
                              default: return "bg-gray-50 text-gray-700 border-gray-200";
                            }
                          };

                          return sorted.map(role => (
                            <div key={role} className="flex flex-col min-w-0 font-sans">
                              <span className={`px-1.5 py-0.5 rounded-[5px] text-[8.5px] font-extrabold uppercase border w-max ${getRoleBadgeStyle(role)}`}>
                                {role}
                              </span>
                              <div className="text-[10.5px] font-bold text-gray-750 pl-0.5 mt-0.5 leading-relaxed break-words whitespace-normal">
                                {grouped[role].join(", ")}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-1 border-t border-gray-100 pt-3 text-xs font-semibold">
                    <button
                      onClick={() => setActiveReviewMatch(p)}
                      className="py-2 px-3 bg-white hover:bg-gray-105 border border-gray-200 text-gray-700 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all flex-1"
                    >
                      <Eye className="h-3.5 w-3.5 text-gray-500" /> Vedi Referto
                    </button>
                    {isEditor && (
                      <button
                        onClick={() => handleStartEdit(p)}
                        className="py-2 px-3 bg-white hover:bg-slate-50 border border-gray-200 text-slate-700 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Modifica
                      </button>
                    )}
                    {isEditor && !(p.dettagli || "").toLowerCase().includes("amichevole") && (
                      p.inviatoFanta ? (
                        <span className="py-2 px-2.5 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-lg flex items-center justify-center gap-1 text-[11px] font-bold">
                          ✅ Inviato a Fanta
                        </span>
                      ) : (
                        <button
                          onClick={async () => {
                            if (onInviaFanta) {
                              try {
                                await onInviaFanta(p.id);
                                setSuccessMessage("Referto inviato correttamente a Fantacalcetto!");
                              } catch (err: any) {
                                setErrorMessage("Impossibile inviare il referto: " + err.message);
                              }
                            }
                          }}
                          className="py-2 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all font-bold border border-indigo-650"
                        >
                          ⚡ Invia a Fanta
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-400 italic text-sm">
            Nessuna partita completata inserita in archivio storico
          </div>
        )}
      </div>

      {/* POPUP 1: VIEW REPORT & WHATSAPP EXPORT */}
      {activeReviewMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-md my-8">
            <h3 className="text-base font-bold text-gray-900 border-b pb-2 mb-4">
              Gara: {activeReviewMatch.dettagli}
            </h3>

            <div className="text-center mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">PUNTEGGIO FINALE</span>
              <div className="text-3xl font-bold text-slate-900 mt-1 bg-slate-50 py-2.5 rounded-xl border border-slate-200">
                {activeReviewMatch.risultato || "N/D"}
              </div>
            </div>

            {/* BADGE GENERALE & ELENCO CONVOCATI */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 space-y-2 text-xs text-left">
              <div className="flex flex-wrap gap-1.5 justify-center">
                <span className="bg-slate-800 text-white font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                  👥 {activeReviewMatch.convocati?.length || 0} Convocati
                </span>
                <span className="bg-slate-100 text-slate-800 border border-slate-150 font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                  💰 {activeReviewMatch.referto.filter(r => r.pagaQuota).length} Paganti
                </span>
                <span className="bg-slate-100 text-slate-800 border border-slate-150 font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                  💵 Costo Gara: {activeReviewMatch.costo.toFixed(2)}€
                </span>
              </div>
              {activeReviewMatch.convocati && activeReviewMatch.convocati.length > 0 && (
                <div className="text-[11px] text-slate-900 pt-1.5 border-t border-slate-200">
                  <span className="font-bold text-slate-800 uppercase text-[9px] block mb-1">Elenco Convocati per Gara:</span>
                  <div className="flex flex-wrap gap-1">
                    {activeReviewMatch.convocati.map((name) => {
                      const present = activeReviewMatch.referto.some(r => (r.snapshotGiocatore?.nome || r.nome).trim().toLowerCase() === name.trim().toLowerCase());
                      return (
                        <span key={name} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${present ? "bg-slate-100 text-slate-900" : "bg-gray-100 text-gray-400 line-through"}`}>
                          {name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {activeReviewMatch.note && (
              <div className="mb-4 bg-slate-50/40 p-3 rounded-xl border border-slate-200 text-xs text-slate-900 italic">
                <strong className="block text-[10px] font-bold uppercase tracking-wider text-slate-800 not-italic mb-1">📝 Note della partita</strong>
                {activeReviewMatch.note}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {activeReviewMatch.referto.map(r => {
                const subTot = (r.subitiAzione || 0) + (r.subitiRigore || 0) + (r.subitiPiazzato || 0);
                const statsList: string[] = [];
                if (r.gol > 0) statsList.push(`⚽ ${r.gol} Gol`);
                if (r.assist > 0) statsList.push(`👟 ${r.assist} Assist`);
                if (r.amm > 0) statsList.push(`🟨 ${r.amm}`);
                if (r.rossi > 0) statsList.push(`🟥 ${r.rossi}`);
                if (subTot > 0) statsList.push(`🧤 Concessi: -${subTot}`);
                if (r.malusBrt) statsList.push(`📦 Malus BRT (-1pt)`);
                if (r.bonusAttivi && r.bonusAttivi.length > 0) statsList.push(`✨ ${r.bonusAttivi.length} Bonus`);

                return (
                  <div key={r.nome} className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-700">
                      {r.snapshotGiocatore?.nome || r.nome}
                    </span>
                    <span className="font-extrabold text-blue-900 flex items-center gap-1.5">
                      {statsList.length > 0 ? statsList.join(" | ") : <span className="text-gray-300 font-normal">-</span>}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t mt-5 font-semibold">
              <button
                onClick={() => handleCopyWhatsApp(activeReviewMatch)}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="h-4 w-4" /> Copia per WhatsApp
              </button>
              <button
                onClick={() => setActiveReviewMatch(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: EDIT GAME REPORTS AND STATS IN CLIENT */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-lg my-8">
            <h3 className="text-base font-bold text-gray-900 border-b pb-2 mb-3">
              Modifica Referto Storico
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Dettagli Partita</label>
                <input
                  type="text"
                  required
                  value={editDettagli}
                  onChange={e => setEditDettagli(e.target.value)}
                  className="w-full text-sm p-2 border rounded-lg focus:ring-1 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5 flex justify-between items-center">
                  <span>Note della partita</span>
                  <span className="text-[10px] text-gray-400 font-normal lowercase italic">Opzionale - svuota o ignora se non vuoi scrivere</span>
                </label>
                <textarea
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  rows={2}
                  className="w-full text-sm p-2 border rounded-lg focus:ring-1 focus:ring-slate-500 resize-none font-medium text-gray-850"
                  placeholder="Inserisci eventuali note (opzionale)..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pb-2 border-b">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Risultato</label>
                  <input
                    type="text"
                    required
                    value={editRisultato}
                    onChange={e => setEditRisultato(e.target.value)}
                    className="w-full text-sm p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-0.5">Costo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editCosto}
                    onChange={e => setEditCosto(e.target.value)}
                    className="w-full text-sm p-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Editable values for match report list */}
              <div>
                <label className="block text-xs font-extrabold text-gray-600 uppercase mb-2">Referto Giocatori</label>
                
                <div className="space-y-3.5 max-h-60 overflow-y-auto border border-gray-100 rounded-xl p-3 bg-gray-50">
                  {editReferto.map(r => {
                    const g = giocatori.find(x => x.nome === r.nome);
                    const isPort = g?.ultimoRuolo === "Portiere";

                    return (
                      <div key={r.nome} className="p-3 bg-white border rounded-lg space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-gray-800">{r.nome}</span>
                          <label className="flex items-center gap-1.5 text-xs text-slate-800 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={r.pagaQuota}
                              onChange={e => handleEditRefertoStat(r.nome, "pagaQuota", e.target.checked)}
                              className="w-3.5 h-3.5 text-slate-850 rounded focus:ring-slate-500"
                            />
                            Paga Quota
                          </label>
                        </div>

                        <div className="grid grid-cols-4 gap-1">
                          <div>
                            <span className="block text-[8px] text-gray-400 font-bold text-center">⚽ GOL</span>
                            <input
                              type="number"
                              min="0"
                              value={r.gol}
                              onChange={e => handleEditRefertoStat(r.nome, "gol", parseInt(e.target.value) || 0)}
                              className="w-full text-xs p-1 text-center border rounded"
                            />
                          </div>
                          <div>
                            <span className="block text-[8px] text-gray-400 font-bold text-center">ASSIST</span>
                            <input
                              type="number"
                              min="0"
                              value={r.assist}
                              onChange={e => handleEditRefertoStat(r.nome, "assist", parseInt(e.target.value) || 0)}
                              className="w-full text-xs p-1 text-center border rounded"
                            />
                          </div>
                          <div>
                            <span className="block text-[8px] text-gray-400 font-bold text-center">🟨 GIALLI</span>
                            <input
                              type="number"
                              min="0"
                              value={r.amm}
                              onChange={e => handleEditRefertoStat(r.nome, "amm", parseInt(e.target.value) || 0)}
                              className="w-full text-xs p-1 text-center border border-yellow-200 bg-yellow-50 rounded"
                            />
                          </div>
                          <div>
                            <span className="block text-[8px] text-gray-400 font-bold text-center">🟥 ROSSI</span>
                            <input
                              type="number"
                              min="0"
                              value={r.rossi}
                              onChange={e => handleEditRefertoStat(r.nome, "rossi", parseInt(e.target.value) || 0)}
                              className="w-full text-xs p-1 text-center border border-red-200 bg-red-50 rounded"
                            />
                          </div>
                        </div>

                         {/* GK options */}
                        {isPort && (
                          <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded">
                            <div>
                              <span className="block text-[8px] text-slate-800 font-bold text-center">GK (Azi)</span>
                              <input
                                type="number"
                                min="0"
                                value={r.subitiAzione}
                                onChange={e => handleEditRefertoStat(r.nome, "subitiAzione", parseInt(e.target.value) || 0)}
                                className="w-full text-xs p-1 text-center border bg-white rounded"
                              />
                            </div>
                            <div>
                              <span className="block text-[8px] text-slate-800 font-bold text-center">GK (Rig)</span>
                              <input
                                type="number"
                                min="0"
                                value={r.subitiRigore}
                                onChange={e => handleEditRefertoStat(r.nome, "subitiRigore", parseInt(e.target.value) || 0)}
                                className="w-full text-xs p-1 text-center border bg-white rounded"
                              />
                            </div>
                            <div>
                              <span className="block text-[8px] text-slate-800 font-bold text-center">GK (Pun)</span>
                              <input
                                type="number"
                                min="0"
                                value={r.subitiPiazzato}
                                onChange={e => handleEditRefertoStat(r.nome, "subitiPiazzato", parseInt(e.target.value) || 0)}
                                className="w-full text-xs p-1 text-center border bg-white rounded"
                              />
                            </div>
                          </div>
                        )}

                        {/* Custom Player-Specific and Generic/Global Bonuses for Match Editing */}
                        {(() => {
                          const allBonuses = bonuses || DEFAULT_BONUSES;
                          const currentGenericBonuses = allBonuses.filter(b => !b.isPersonale);
                          const bonusKey = getPlayerBonusKey(r.nome);
                          const baseBonuses = bonusKey ? allBonuses.filter(b => b.isPersonale && b.giocatoreId && (b.giocatoreId === bonusKey || b.giocatoreId.toLowerCase() === bonusKey.toLowerCase() || b.giocatoreId.toLowerCase().includes(bonusKey.toLowerCase()) || bonusKey.toLowerCase().includes(b.giocatoreId.toLowerCase()))) : [];
                          const currentActive = r.bonusAttivi || [];

                          return (
                            <div className="space-y-2 mt-2 border-t border-dashed border-gray-150 pt-2 bg-gray-50/5 p-1 rounded">
                              {/* Personal Bonuses (if present) */}
                              {baseBonuses.length > 0 && (
                                <div className="space-y-1 bg-yellow-50/15 p-1.5 rounded-lg border border-yellow-200/50">
                                  <span className="block text-[8px] font-black text-yellow-800 uppercase text-center tracking-wider">
                                    🎒 Bonus Personali Fantacalcetto
                                  </span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 select-none">
                                    {baseBonuses.map(b => {
                                      const isChecked = currentActive.includes(b.id);
                                      return (
                                        <label
                                          key={b.id}
                                          className={`flex items-start gap-1 p-1 rounded border text-[9.5px]/tight font-bold cursor-pointer transition-all ${
                                            isChecked
                                              ? "bg-yellow-105/90 border-yellow-300 text-yellow-950"
                                              : "bg-white border-gray-150 text-gray-700 hover:bg-gray-50"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                              const updated = isChecked
                                                ? currentActive.filter(id => id !== b.id)
                                                : [...currentActive, b.id];
                                              handleEditRefertoStat(r.nome, "bonusAttivi", updated);
                                            }}
                                            className="w-3 h-3 mt-0.5 text-yellow-600 focus:ring-yellow-500 rounded cursor-pointer"
                                          />
                                          <div className="leading-tight">
                                            <span className="block font-black text-[10px]">{b.nome}</span>
                                            <span className="text-[7.5px] text-gray-400 font-semibold block leading-none mt-0.5">{b.descrizione}</span>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Generic/Global Bonuses & Maluses */}
                              <div className="space-y-1 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                                <span className="block text-[8px] font-bold text-slate-800 uppercase text-center tracking-wider">
                                  🛡️ Bonus & Malus Generici / Globali
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[140px] overflow-y-auto pr-0.5 select-none text-left">
                                  {currentGenericBonuses.map(b => {
                                    const isChecked = currentActive.includes(b.id);
                                    const isMalus = typeof b.punti === "number" && b.punti < 0;
                                    return (
                                      <label
                                        key={b.id}
                                        className={`flex items-start gap-1 p-1 rounded border text-[9px]/tight font-bold cursor-pointer transition-all ${
                                          isChecked
                                            ? isMalus
                                              ? "bg-red-50 border-red-200 text-red-950"
                                              : "bg-slate-100 border-slate-300 text-slate-900"
                                            : "bg-white border-gray-150 text-gray-750 hover:bg-gray-50"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            const updated = isChecked
                                              ? currentActive.filter(id => id !== b.id)
                                              : [...currentActive, b.id];
                                            handleEditRefertoStat(r.nome, "bonusAttivi", updated);
                                          }}
                                          className={`w-3 h-3 mt-0.5 rounded cursor-pointer ${
                                            isMalus ? "text-red-650 focus:ring-red-500" : "text-slate-800 focus:ring-slate-500"
                                          }`}
                                        />
                                        <div className="leading-none min-w-0">
                                          <span className="block font-black text-[9.5px] text-gray-950 truncate">{b.nome}</span>
                                          <span className={`text-[8px] font-bold block mt-0.5 ${isMalus ? "text-red-600" : "text-slate-800"}`}>
                                            ({typeof b.punti === "number" && b.punti > 0 ? `+${b.punti}` : b.punti}pt)
                                          </span>
                                          <span className="text-[7.5px] text-gray-400 font-semibold block mt-0.5 leading-tight">{b.descrizione}</span>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dangerous operations triggers */}
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center space-y-2">
                <span className="block text-xs font-bold text-red-800">Sblocco e Gestione Gara</span>
                <div className="grid grid-cols-2 gap-2 text-xs font-extrabold">
                  <button
                    type="button"
                    onClick={() => handleReopen(editingMatch.id)}
                    className="py-2.5 bg-orange-500 hover:bg-orange-600 rounded text-white flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Undo2 className="h-4 w-4" /> Modifica Gara (Riapri)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(editingMatch.id)}
                    className="py-2.5 bg-red-650 hover:bg-red-750 text-white rounded flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" /> Elimina Gara
                  </button>
                </div>
                <p className="text-[10px] text-red-600 select-none">
                  Cliccando su Modifica Gara sbloccherai il referto riportandolo in stato Aperto senza perdere alcun dato inserito, consentendoti di modificarlo liberamente.
                </p>
              </div>

              {/* Row buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t font-semibold">
                <button
                  type="button"
                  onClick={() => setEditingMatch(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg cursor-pointer font-bold"
                >
                  Salva Modifiche Storiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Match Confirmation Modal */}
      {reopenMatchId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 text-left text-gray-905">
            <div className="bg-amber-600 p-4 font-bold text-white flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-amber-100 shrink-0" />
              <span>Sbloccare e Modificare Gara?</span>
            </div>
            <div className="p-5 space-y-4 text-left">
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                Stai per riaprire questa partita per modificarla. <strong>I dati gia inseriti (gol, assist, cartellini, fantabonus e quote) NON verranno cancellati!</strong> Saranno conservati e resi disponibili come bozza direttamente nella scheda <strong>Referto</strong> per permetterti di modificarli.
              </p>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-start gap-2.5">
                <div className="text-[11px] text-slate-900 font-bold leading-snug">
                  ✨ Conservazione Dati Attiva
                  <span className="block text-[10px] text-slate-700 font-medium mt-0.5 font-sans">
                    I dati del referto sono protetti e pronti per essere editati nella scheda "Referto".
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmReopen}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow-sm transition-colors cursor-pointer text-center"
                >
                  Sì, Sblocca per Modificare
                </button>
                <button
                  type="button"
                  onClick={() => setReopenMatchId(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer text-center"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Match Confirmation Modal */}
      {deleteMatchId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 text-left text-gray-905">
            <div className="bg-red-800 p-4 font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-200 shrink-0" />
              <span>Elimina DEFINITIVAMENTE?</span>
            </div>
            <div className="p-5 space-y-4 text-left">
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                ⚠️ AZIONE CRITICA ⚠️<br />
                Sei sicuro di voler eliminare DEFINITIVAMENTE questa partita? Questo stoglierà tutte le statistiche, rimborserà le quote campo, e cancellerà l'evento del tutto dall'archivio delle gare. Questa azione non può essere annullata.
              </p>
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 bg-red-650 hover:bg-red-550 text-white font-extrabold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  Sì, Elimina per Sempre
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteMatchId(null)}
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
