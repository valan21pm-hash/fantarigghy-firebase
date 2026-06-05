/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Coins,
  Copy,
  Plus,
  Receipt,
  Search,
  Trash2,
  Edit3,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { Giocatore, Partita } from "../types";

interface PlayerListProps {
  giocatori: Giocatore[];
  partiteAperte?: any[];
  partiteChiuse?: Partita[];
  onAddPlayer: (nome: string) => Promise<void>;
  onDeletePlayer: (nome: string) => Promise<void>;
  onVersaQuota: (nome: string, importo: number) => Promise<void>;
  onVersaQuotaMassivo: (ricariche: { nome: string; importo: number }[]) => Promise<void>;
  onDividiSpesa: (
    importo: number,
    causale: string,
    giocatori: string[]
  ) => Promise<void>;
  onEditPlayer: (nomeOriginale: string, dati: Partial<Giocatore>) => Promise<void>;
  isEditor?: boolean;
}

export default function PlayerList({
  giocatori,
  partiteAperte = [],
  partiteChiuse = [],
  onAddPlayer,
  onDeletePlayer,
  onVersaQuota,
  onVersaQuotaMassivo,
  onDividiSpesa,
  onEditPlayer,
  isEditor = false,
}: PlayerListProps) {
  // Filter and Search States
  const [search, setSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [sortBy, setSortBy] = useState<"maglia" | "nome" | "saldo" | "gol">("maglia");

  // Add player form
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Quick Recharge state
  const [rechargePlayer, setRechargePlayer] = useState("");
  const [rechargeAmt, setRechargeAmt] = useState("");
  const [isRecharging, setIsRecharging] = useState(false);
  const [rechargeMode, setRechargeMode] = useState<"singolo" | "massivo">("massivo");
  const [bulkRecharges, setBulkRecharges] = useState<{ nome: string; importo: number }[]>([]);
  const [bulkAddPlayerName, setBulkAddPlayerName] = useState("");
  const [globalFlatQuota, setGlobalFlatQuota] = useState("");

  // Split Expense state
  const [expenseAmt, setExpenseAmt] = useState("");
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expensePlayers, setExpensePlayers] = useState<string[]>([]);
  const [isSplitting, setIsSplitting] = useState(false);

  // Edit Player State
  const [editingPlayer, setEditingPlayer] = useState<Giocatore | null>(null);

  // Sort & Filter
  const filtered = giocatori
    .filter(g => {
      const matchSearch = g.nome.toLowerCase().includes(search.toLowerCase());
      const matchActive = !showOnlyActive || g.attivo;
      return matchSearch && matchActive;
    })
    .sort((a, b) => {
      if (sortBy === "maglia") return a.numeroMaglia - b.numeroMaglia;
      if (sortBy === "nome") return a.nome.localeCompare(b.nome);
      if (sortBy === "saldo") return b.saldo - a.saldo;
      if (sortBy === "gol") return b.gol - a.gol;
      return 0;
    });

  // Actions
  const handleAddNewPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    await onAddPlayer(newPlayerName.trim());
    setNewPlayerName("");
    setIsAdding(false);
  };

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargePlayer || !rechargeAmt || parseFloat(rechargeAmt) <= 0) return;
    await onVersaQuota(rechargePlayer, parseFloat(rechargeAmt));
    setRechargeAmt("");
    setRechargePlayer("");
    setIsRecharging(false);
  };

  const handleAddPlayerToBulk = (nome: string) => {
    if (!nome) return;
    if (bulkRecharges.some(r => r.nome === nome)) return;
    setBulkRecharges([...bulkRecharges, { nome, importo: 0 }]);
    setBulkAddPlayerName("");
  };

  const handleRemovePlayerFromBulk = (nome: string) => {
    setBulkRecharges(bulkRecharges.filter(r => r.nome !== nome));
  };

  const handleUpdateBulkAmount = (nome: string, importo: number) => {
    setBulkRecharges(
      bulkRecharges.map(r => (r.nome === nome ? { ...r, importo: isNaN(importo) ? 0 : Math.max(0, importo) } : r))
    );
  };

  const handleApplyGlobalFlatQuota = () => {
    const parsed = parseFloat(globalFlatQuota);
    if (isNaN(parsed) || parsed < 0) return;
    setBulkRecharges(bulkRecharges.map(r => ({ ...r, importo: parsed })));
  };

  const handlePrepopulateActive = () => {
    const activePlayers = giocatori.filter(g => g.attivo).map(g => ({ nome: g.nome, importo: 0 }));
    setBulkRecharges(activePlayers);
  };

  const handlePrepopulateConvocati = (matchConvocati: string[]) => {
    const mapped = matchConvocati.map(nome => ({ nome, importo: 0 }));
    setBulkRecharges(mapped);
  };

  const handleSaveBulkRecharges = async () => {
    const ricaricheDaSalvare = bulkRecharges.filter(r => r.importo > 0);
    if (ricaricheDaSalvare.length === 0) {
      alert("Nessun importo valido (> 0€) è stato inserito.");
      return;
    }
    await onVersaQuotaMassivo(ricaricheDaSalvare);
    setBulkRecharges([]);
    setIsRecharging(false);
    alert("Tutte le ricariche di gruppo sono state salvate e i saldi aggiornati!");
  };

  const handleSplitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expenseAmt);
    if (!expenseLabel.trim() || isNaN(amt) || amt <= 0 || expensePlayers.length === 0) return;
    await onDividiSpesa(amt, expenseLabel.trim(), expensePlayers);
    setExpenseAmt("");
    setExpenseLabel("");
    setExpensePlayers([]);
    setIsSplitting(false);
  };

  const handleToggleSelectAllExpense = () => {
    const list = giocatori.filter(g => g.attivo).map(g => g.nome);
    if (expensePlayers.length === list.length) {
      setExpensePlayers([]);
    } else {
      setExpensePlayers(list);
    }
  };

  const handleTogglePlayerExpenseSelection = (nome: string) => {
    if (expensePlayers.includes(nome)) {
      setExpensePlayers(expensePlayers.filter(x => x !== nome));
    } else {
      setExpensePlayers([...expensePlayers, nome]);
    }
  };

  const handleSaveEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    await onEditPlayer(editingPlayer.nome, editingPlayer);
    setEditingPlayer(null);
  };

  const handleCopyRepForWhatsApp = () => {
    const sortedBalances = [...giocatori].sort((a, b) => b.saldo - a.saldo);
    let msg = `🏦 *SITUAZIONE CASSA SQUADRA* 🏦\n\n`;
    sortedBalances.forEach(g => {
      const icon = g.saldo > 0 ? "🟢 +" : g.saldo < 0 ? "🔴 " : "⚪ ";
      msg += `${icon}${g.saldo.toFixed(2)}€ - ${g.nome} (#${g.numeroMaglia})\n`;
    });
    const cassaTot = giocatori.reduce((acc, curr) => acc + curr.saldo, 0);
    msg += `\n💰 *Fondo Totale:* ${cassaTot.toFixed(2)}€`;

    navigator.clipboard.writeText(msg);
    alert("Modulo di riepilogo saldi copiato negli appunti!");
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" id="sezione-rosa">
      {/* Roster Header */}
      <div className="bg-slate-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>👥</span> Rosa dei Giocatori
          </h2>
          <p className="text-xs text-slate-300">
            {giocatori.filter(g => g.attivo).length} attivi su {giocatori.length} registrati
          </p>
        </div>

        {/* Header Roster Operations */}
        <div className="flex flex-wrap gap-2">
          {isEditor && (
            <>
              <button
                onClick={() => {
                  setIsAdding(!isAdding);
                  setIsRecharging(false);
                  setIsSplitting(false);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-white flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Aggiungi
              </button>
              <button
                onClick={() => {
                  setIsRecharging(!isRecharging);
                  setIsAdding(false);
                  setIsSplitting(false);
                }}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-650 rounded-lg text-xs font-bold text-white flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
              >
                <Coins className="h-3.5 w-3.5" /> Ricarica
              </button>
              <button
                onClick={() => {
                  setIsSplitting(!isSplitting);
                  setIsAdding(false);
                  setIsRecharging(false);
                  // Default to selecting all active players
                  setExpensePlayers(giocatori.filter(g => g.attivo).map(g => g.nome));
                }}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-550 rounded-lg text-xs font-bold text-white flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
              >
                <Receipt className="h-3.5 w-3.5" /> Dividi Spesa
              </button>
            </>
          )}
          {isEditor && (
            <button
              onClick={handleCopyRepForWhatsApp}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
              title="Copia WhatsApp"
            >
              <Copy className="h-3.5 w-3.5" /> Copia Saldi
            </button>
          )}
        </div>
      </div>

      {/* Expandable Panel: Add Player */}
      {isAdding && (
        <form onSubmit={handleAddNewPlayer} className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              required
              placeholder="Nome e Cognome nuovo giocatore"
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" /> Registra in Rosa
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded-lg transition-all cursor-pointer"
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {/* Expandable Panel: Quick Recharge */}
      {isRecharging && (
        <div className="p-5 bg-green-50/70 border-b border-green-100 space-y-4 shadow-inner">
          <div className="flex items-center justify-between border-b border-green-150 pb-3 flex-wrap gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-green-950 flex items-center gap-1.5">
                <span>💰</span> Gestione Versamenti & Ricariche Saldi
              </h3>
              <p className="text-[11px] text-green-850">
                Registra le quote che ricevi al campo per rimpinguare i saldi dei giocatori in tempo reale.
              </p>
            </div>
            
            {/* Segment switch */}
            <div className="flex bg-green-150/40 p-1 rounded-xl shrink-0 select-none">
              <button
                type="button"
                onClick={() => setRechargeMode("singolo")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  rechargeMode === "singolo"
                    ? "bg-white text-green-950 shadow-xs"
                    : "text-green-800 hover:text-green-950"
                }`}
              >
                👤 Singolo Giocatore
              </button>
              <button
                type="button"
                onClick={() => {
                  setRechargeMode("massivo");
                  if (bulkRecharges.length === 0) {
                    handlePrepopulateActive();
                  }
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  rechargeMode === "massivo"
                    ? "bg-white text-green-950 shadow-xs"
                    : "text-green-800 hover:text-green-950"
                }`}
              >
                ⚡ Di Gruppo al Campo (Massivo)
              </button>
            </div>
          </div>

          {rechargeMode === "singolo" ? (
            <form onSubmit={handleRecharge} className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold uppercase text-green-800 mb-1">Seleziona Giocatore</label>
                <select
                  required
                  value={rechargePlayer}
                  onChange={e => setRechargePlayer(e.target.value)}
                  className="w-full p-2.5 bg-white border border-green-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="">-- Chi versa? --</option>
                  {giocatori.map(g => (
                    <option key={g.nome} value={g.nome}>
                      {g.numeroMaglia} - {g.nome} ({g.saldo.toFixed(2)}€)
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-32">
                <label className="block text-[10px] font-bold uppercase text-green-800 mb-1">Importo (€)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="0.00"
                  value={rechargeAmt}
                  onChange={e => setRechargeAmt(e.target.value)}
                  className="w-full p-2.5 bg-white border border-green-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="submit"
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-green-700 hover:bg-green-650 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer font-black"
                >
                  Registra Ricarica
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecharging(false)}
                  className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded-lg cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Intelligent Prepopulate & Flat quota row */}
              <div className="flex flex-wrap gap-3 items-center justify-between bg-white border border-green-100 p-3 rounded-xl">
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-green-900 font-extrabold self-center">Pre-popola:</span>
                  <button
                    type="button"
                    onClick={handlePrepopulateActive}
                    className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-950 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                  >
                    👥 Carica Tutti Attivi
                  </button>

                  {/* Open match convocati check */}
                  {(() => {
                    const firstOpenMatch = partiteAperte?.find(p => p.stato === "Aperta");
                    if (!firstOpenMatch || !firstOpenMatch.convocati || firstOpenMatch.convocati.length === 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => handlePrepopulateConvocati(firstOpenMatch.convocati)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                        title={firstOpenMatch.dettagli}
                      >
                        ⚽ Carica Convocati Gara ({firstOpenMatch.convocati.length})
                      </button>
                    );
                  })()}
                </div>

                {/* Flat standard amount setter */}
                <div className="flex gap-1.5 items-center w-full sm:w-auto mt-2 sm:mt-0">
                  <span className="text-xs text-green-900 font-bold hidden sm:inline">Quota Comune:</span>
                  <input
                    type="number"
                    placeholder="Quota fissa"
                    value={globalFlatQuota}
                    onChange={e => setGlobalFlatQuota(e.target.value)}
                    className="w-20 p-2 text-xs bg-white border border-green-200 rounded-lg outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyGlobalFlatQuota}
                    className="px-3 py-2 bg-green-700 hover:bg-green-650 text-white font-black text-xs rounded-lg cursor-pointer transition-colors"
                  >
                    Applica a tutti
                  </button>
                </div>
              </div>

              {/* Grid of players being recharged */}
              <div className="max-h-72 overflow-y-auto border border-green-150 bg-white rounded-xl p-3 space-y-2">
                {bulkRecharges.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400 italic font-semibold">
                    La lista ricariche è vuota. Seleziona i giocatori sotto o usa i bottoni Pre-popola.
                  </div>
                ) : (
                  bulkRecharges.map(item => {
                    const matchedGioc = giocatori.find(g => g.nome === item.nome);
                    return (
                      <div
                        key={item.nome}
                        className="flex flex-wrap items-center justify-between gap-3 p-2 bg-green-50/20 hover:bg-green-50/70 border border-green-100/50 rounded-lg"
                      >
                        <div className="flex items-center gap-2.5 truncate flex-1 min-w-[150px]">
                          <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-150/50 px-1.5 py-0.5 rounded shrink-0">
                            {matchedGioc?.numeroMaglia ?? 99}
                          </span>
                          <div className="truncate flex flex-col">
                            <span className="font-extrabold text-sm text-green-950 truncate">{item.nome}</span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              Saldo attuale: <b className={`font-bold ${matchedGioc && matchedGioc.saldo < 0 ? "text-red-650" : "text-gray-500"}`}>{matchedGioc?.saldo.toFixed(2)}€</b>
                            </span>
                          </div>
                        </div>

                        {/* Money input and fast shortcut buttons */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {/* Fast Shortcuts */}
                          <div className="flex p-0.5 bg-white border border-green-100 rounded-lg text-[10px] label-neutral font-extrabold">
                            <button
                              type="button"
                              onClick={() => handleUpdateBulkAmount(item.nome, 5)}
                              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${item.importo === 5 ? "bg-green-600 text-white font-black" : "hover:bg-green-50 text-green-900"}`}
                            >
                              5€
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateBulkAmount(item.nome, 10)}
                              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${item.importo === 10 ? "bg-green-600 text-white font-black" : "hover:bg-green-50 text-green-900"}`}
                            >
                              10€
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateBulkAmount(item.nome, 12)}
                              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${item.importo === 12 ? "bg-green-600 text-white font-black" : "hover:bg-green-50 text-green-900"}`}
                            >
                              12€
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateBulkAmount(item.nome, item.importo + 5)}
                              className="px-2 py-1 rounded-md hover:bg-green-100 text-green-900 cursor-pointer text-[9px]"
                              title="Aggiungi 5€"
                            >
                              +5€
                            </button>
                          </div>

                          {/* Numeric input */}
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              value={item.importo === 0 ? "" : item.importo}
                              onChange={e => handleUpdateBulkAmount(item.nome, parseFloat(e.target.value))}
                              className="w-16 p-1.5 text-xs text-right font-black bg-white border border-green-200 rounded-lg outline-none text-green-950"
                            />
                          </div>

                          {/* Delete from queue */}
                          <button
                            type="button"
                            onClick={() => handleRemovePlayerFromBulk(item.nome)}
                            className="p-1 px-1.5 text-red-500 hover:text-white hover:bg-red-500 rounded-md transition-all font-black text-sm cursor-pointer"
                            title="Rimuovi"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add and submit section */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-green-100">
                {/* Add one-off player to the queue */}
                <div className="flex items-center gap-1 w-full sm:w-auto">
                  <select
                    value={bulkAddPlayerName}
                    onChange={e => handleAddPlayerToBulk(e.target.value)}
                    className="p-2 text-xs bg-white border border-green-200 rounded-lg outline-none max-w-xs"
                  >
                    <option value="">➕ Seleziona altro da inserire...</option>
                    {giocatori
                      .filter(g => !bulkRecharges.some(r => r.nome === g.nome))
                      .map(g => (
                        <option key={g.nome} value={g.nome}>
                          {g.numeroMaglia} - {g.nome}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Subtotals & Submit actions */}
                <div className="flex items-center gap-4 flex-wrap justify-end ml-auto">
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-bold text-green-800">Totale Contanti Ricevuti</span>
                    <strong className="text-lg text-green-950 font-black">
                      {bulkRecharges.reduce((acc, curr) => acc + (curr.importo || 0), 0).toFixed(2)}€
                    </strong>
                    <span className="text-[10px] text-green-800 font-medium block">
                      ({bulkRecharges.filter(r => r.importo > 0).length} quote compilate)
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBulkRecharges([]);
                        setIsRecharging(false);
                      }}
                      className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveBulkRecharges}
                      className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                    >
                      Registra Quote e Aggiorna Saldi 💾
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expandable Panel: Split Shared Expense */}
      {isSplitting && (
        <form onSubmit={handleSplitExpense} className="p-4 bg-yellow-50 border-b border-yellow-100 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-yellow-800 mb-1">Causale della Spesa</label>
              <input
                type="text"
                required
                placeholder="es. Acquisto nuovo pallone da gioco, affitto casacche"
                value={expenseLabel}
                onChange={e => setExpenseLabel(e.target.value)}
                className="w-full p-2.5 bg-white border border-yellow-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-yellow-800 mb-1">Costo Totale (€)</label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                placeholder="0.00"
                value={expenseAmt}
                onChange={e => setExpenseAmt(e.target.value)}
                className="w-full p-2.5 bg-white border border-yellow-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-bold uppercase text-yellow-800">
                Seleziona i partecipanti alla divisione ({expensePlayers.length})
              </label>
              <button
                type="button"
                onClick={handleToggleSelectAllExpense}
                className="text-xs text-yellow-700 font-extrabold cursor-pointer hover:underline"
              >
                {expensePlayers.length === giocatori.filter(g => g.attivo).length ? "Deseleziona Tutti" : "Seleziona Tutti Attivi"}
              </button>
            </div>
            
            <div className="max-h-32 overflow-y-auto bg-white border border-yellow-200 rounded-lg p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {giocatori.map(g => (
                <label
                  key={g.nome}
                  className={`flex items-center gap-1.5 p-1.5 rounded border text-xs cursor-pointer transition-colors ${
                    expensePlayers.includes(g.nome)
                      ? "bg-yellow-100 border-yellow-300 text-yellow-900"
                      : "bg-gray-50 border-gray-100 text-gray-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 text-yellow-600 rounded"
                    checked={expensePlayers.includes(g.nome)}
                    onChange={() => handleTogglePlayerExpenseSelection(g.nome)}
                  />
                  <span className="truncate font-semibold">{g.nome}</span>
                </label>
              ))}
            </div>
            {expensePlayers.length > 0 && !isNaN(parseFloat(expenseAmt)) && parseFloat(expenseAmt) > 0 && (
              <p className="text-xs text-yellow-800 font-bold mt-2">
                Quota individuale: {(parseFloat(expenseAmt) / expensePlayers.length).toFixed(2)}€ a testa ({expensePlayers.length} giocatori).
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={expensePlayers.length === 0}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-xs rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              Esegui Divisione & Addebita
            </button>
            <button
              type="button"
              onClick={() => setIsSplitting(false)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded-lg cursor-pointer"
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {/* Filters Bench */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row gap-3 justify-between items-center">
        {/* Search */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Cerca giocatore..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 outline-none"
          />
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
        </div>

        {/* Sorting & Status Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 font-semibold cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-slate-800 focus:ring-slate-500"
              checked={showOnlyActive}
              onChange={e => setShowOnlyActive(e.target.checked)}
            />
            Solo Attivi/Convocabili
          </label>

          <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto md:ml-0">
            <span className="font-semibold text-gray-600">Ordina:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="border border-gray-200 bg-white p-1 rounded font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="maglia">Jersey #</option>
              <option value="nome">Nome</option>
              {isEditor && <option value="saldo">Saldo</option>}
              <option value="gol">Gol</option>
            </select>
          </div>
        </div>
      </div>

      {/* Players Visual Grid */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(g => {
          const subConceded = (g.golSubitiAzione || 0) + (g.golSubitiRigore || 0) + (g.golSubitiPiazzato || 0);
          const isDebtor = g.saldo < 0;
          const isCreditor = g.saldo > 0;

          // Calculate Amichevoli stats for player 'g' by scanning 'partiteChiuse'
          let amichevoleGol = 0;
          let amichevoleAssist = 0;
          let amichevoleAmm = 0;
          let amichevoleEsp = 0;

          if (partiteChiuse && partiteChiuse.length > 0) {
            for (const m of partiteChiuse) {
              const isFriendly = m.dettagli ? m.dettagli.toLowerCase().includes("amichevole") : false;
              if (isFriendly && m.referto) {
                const r = m.referto.find(x => x.nome.toLowerCase() === g.nome.toLowerCase());
                if (r) {
                  amichevoleGol += Number(r.gol) || 0;
                  amichevoleAssist += Number(r.assist) || 0;
                  amichevoleAmm += Number(r.amm) || 0;
                  amichevoleEsp += Number(r.rossi) || 0;
                }
              }
            }
          }

          // Campionato stats = Total stats - Amichevoli stats
          const campionatoGol = Math.max(0, (g.gol || 0) - amichevoleGol);
          const campionatoAssist = Math.max(0, (g.assist || 0) - amichevoleAssist);
          const campionatoAmm = Math.max(0, (g.ammonizioni || 0) - amichevoleAmm);
          const campionatoEsp = Math.max(0, (g.espulsioni || 0) - amichevoleEsp);
          
          return (
            <div
              key={g.nome}
              className={`border rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all hover:shadow-md relative overflow-hidden ${
                !g.attivo ? "bg-gray-50 border-gray-200 opacity-65" : "bg-white border-gray-100"
              }`}
            >
              {/* Top Banner Ribbon for inactive */}
              {!g.attivo && (
                <div className="absolute top-0 right-0 bg-red-100 text-red-700 text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-bl">
                  Inattivo
                </div>
              )}

              {/* Player Row Header */}
              <div className="flex justify-between items-start gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full flex items-center justify-center min-w-[1.75rem]">
                    {g.numeroMaglia}
                  </span>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">{g.nome}</h4>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                      {g.ultimoRuolo || "Nessun ruolo prioritario"}
                    </p>
                  </div>
                </div>

                {/* Account balance bubble */}
                {isEditor && (
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-extrabold ${
                        isCreditor
                          ? "bg-green-100 text-green-800"
                          : isDebtor
                          ? "bg-red-100 text-red-800 animate-pulse-slow"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {isCreditor ? "+" : ""}
                      {g.saldo.toFixed(2)} €
                    </span>
                  </div>
                )}
              </div>

              {/* Statistics strip with 2 distinct rows */}
              <div className="bg-gray-50 border border-gray-100/55 rounded-xl p-2.5 mb-3 text-xs space-y-2 shadow-2xs">
                {/* Header labels */}
                <div className="grid grid-cols-5 gap-1 text-[8.5px] text-gray-400 font-extrabold uppercase text-center border-b border-gray-100/70 pb-1">
                  <div>REGISTRO</div>
                  <div>GOL</div>
                  <div>ASSIST</div>
                  <div>AMMON.</div>
                  <div>ESPUL.</div>
                </div>
                {/* CAMPIONATO ROW */}
                <div className="grid grid-cols-5 gap-1 text-center items-center py-0.5 text-[11px] font-sans">
                  <div className="text-[8.5px] font-black text-slate-800 uppercase tracking-wide text-left pl-1">🏆 CAMP.</div>
                  <div className="font-extrabold text-blue-900">{campionatoGol}</div>
                  <div className="font-extrabold text-sky-800">{campionatoAssist}</div>
                  <div className="font-extrabold text-yellow-600">{campionatoAmm}</div>
                  <div className="font-extrabold text-red-650">{campionatoEsp}</div>
                </div>
                {/* AMICHEVOLE ROW */}
                <div className="grid grid-cols-5 gap-1 text-center items-center pt-1 border-t border-gray-100/60 text-[11px] font-sans">
                  <div className="text-[8.5px] font-black text-amber-600 uppercase tracking-wide text-left pl-1">🤝 AMICH.</div>
                  <div className="font-extrabold text-gray-700/80">{amichevoleGol}</div>
                  <div className="font-extrabold text-gray-700/80">{amichevoleAssist}</div>
                  <div className="font-extrabold text-yellow-600/70">{amichevoleAmm}</div>
                  <div className="font-extrabold text-red-600/70">{amichevoleEsp}</div>
                </div>
              </div>

              {/* Additional Goalkeeper feedback */}
              {subConceded > 0 && (
                <p className="text-[10px] text-slate-800 bg-slate-50 px-2 py-1 rounded border border-slate-200 mb-3 text-center font-medium">
                  🧤 Gol subiti come portiere: <strong className="font-bold">{subConceded}</strong> (Azione {g.golSubitiAzione}, Rigore {g.golSubitiRigore}, Puniz {g.golSubitiPiazzato})
                </p>
              )}

               {/* Footer row options */}
              <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-1 text-xs">
                {isEditor ? (
                  <span className="text-[10px] text-gray-400 font-medium">
                    Quota Iscrizione: <strong className="text-slate-800">{g.quotaIscrizione.toFixed(2)}€</strong>
                  </span>
                ) : (
                  <div />
                )}

                {isEditor && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingPlayer(g)}
                      className="p-1 text-gray-500 hover:text-slate-800 bg-gray-100 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                      title="Modifica Giocatore"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Sei sicuro di voler eliminare definitivamente ${g.nome} dalla rosa?`
                          )
                        ) {
                          onDeletePlayer(g.nome);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title="Inabilita / Rimuovi"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-8 text-center text-gray-400 italic">
            Nessun giocatore corrisponde ai criteri impostati
          </div>
        )}
      </div>

      {/* Dialog Edit Profile Profile */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-md my-8">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4">
              Modifica Profilo: {editingPlayer.nome}
            </h3>

            <form onSubmit={handleSaveEditProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome e Cognome</label>
                  <input
                    type="text"
                    required
                    value={editingPlayer.nome}
                    onChange={e => setEditingPlayer({ ...editingPlayer, nome: e.target.value })}
                    className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Numero Maglia</label>
                  <input
                    type="number"
                    required
                    value={editingPlayer.numeroMaglia}
                    onChange={e =>
                      setEditingPlayer({ ...editingPlayer, numeroMaglia: parseInt(e.target.value) || 99 })
                    }
                    className="w-full text-sm p-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Saldo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingPlayer.saldo}
                    onChange={e =>
                      setEditingPlayer({ ...editingPlayer, saldo: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full text-sm p-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quota Iscrizione (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingPlayer.quotaIscrizione}
                    onChange={e =>
                      setEditingPlayer({
                        ...editingPlayer,
                        quotaIscrizione: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full text-sm p-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ruolo Preferito</label>
                  <select
                    value={editingPlayer.ultimoRuolo}
                    onChange={e => setEditingPlayer({ ...editingPlayer, ultimoRuolo: e.target.value })}
                    className="w-full text-sm p-2 border bg-white rounded-lg focus:ring-2 focus:ring-slate-500"
                  >
                    <option value="">Nessuno</option>
                    <option value="Portiere">Portiere</option>
                    <option value="Centrale">Centrale</option>
                    <option value="Laterale">Laterale</option>
                    <option value="Pivot">Pivot</option>
                    <option value="Allenatore">Allenatore</option>
                    <option value="Tifoso">Tifoso</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="edit-attivo"
                    className="w-4 h-4 rounded text-slate-800 focus:ring-slate-500"
                    checked={editingPlayer.attivo}
                    onChange={e => setEditingPlayer({ ...editingPlayer, attivo: e.target.checked })}
                  />
                  <label htmlFor="edit-attivo" className="text-xs font-bold text-gray-700 uppercase cursor-pointer">
                    Giocatore Attivo
                  </label>
                </div>
              </div>

              {/* Statistics Panel in Edit */}
              <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-extrabold text-gray-600 uppercase border-b pb-1">Statistiche Carriera</h4>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[8px] font-bold text-gray-400 uppercase text-center">GOL</label>
                    <input
                      type="number"
                      value={editingPlayer.gol}
                      onChange={e =>
                        setEditingPlayer({ ...editingPlayer, gol: parseInt(e.target.value) || 0 })
                      }
                      className="w-full text-xs p-1 text-center border bg-white rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-gray-400 uppercase text-center">ASSIST</label>
                    <input
                      type="number"
                      value={editingPlayer.assist}
                      onChange={e =>
                        setEditingPlayer({ ...editingPlayer, assist: parseInt(e.target.value) || 0 })
                      }
                      className="w-full text-xs p-1 text-center border bg-white rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-gray-400 uppercase text-center">AMM (🟨)</label>
                    <input
                      type="number"
                      value={editingPlayer.ammonizioni}
                      onChange={e =>
                        setEditingPlayer({ ...editingPlayer, ammonizioni: parseInt(e.target.value) || 0 })
                      }
                      className="w-full text-xs p-1 text-center border bg-white rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-gray-400 uppercase text-center">ESP (🟥)</label>
                    <input
                      type="number"
                      value={editingPlayer.espulsioni}
                      onChange={e =>
                        setEditingPlayer({ ...editingPlayer, espulsioni: parseInt(e.target.value) || 0 })
                      }
                      className="w-full text-xs p-1 text-center border bg-white rounded"
                    />
                  </div>
                </div>

                {/* Conceded details */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[8px] font-bold text-gray-400 uppercase text-center">SUB (Az)</label>
                    <input
                      type="number"
                      value={editingPlayer.golSubitiAzione}
                      onChange={e =>
                        setEditingPlayer({
                          ...editingPlayer,
                          golSubitiAzione: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full text-xs p-1 text-center border bg-white rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-gray-400 uppercase text-center">SUB (Rig)</label>
                    <input
                      type="number"
                      value={editingPlayer.golSubitiRigore}
                      onChange={e =>
                        setEditingPlayer({
                          ...editingPlayer,
                          golSubitiRigore: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full text-xs p-1 text-center border bg-white rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-gray-400 uppercase text-center">SUB (Pia)</label>
                    <input
                      type="number"
                      value={editingPlayer.golSubitiPiazzato}
                      onChange={e =>
                        setEditingPlayer({
                          ...editingPlayer,
                          golSubitiPiazzato: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full text-xs p-1 text-center border bg-white rounded"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t font-semibold">
                <button
                  type="button"
                  onClick={() => setEditingPlayer(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg cursor-pointer font-bold"
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
