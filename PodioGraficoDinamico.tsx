/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, ClipboardCopy, ToggleLeft, ToggleRight, XCircle } from "lucide-react";
import { useState } from "react";
import { Giocatore } from "../types";

interface IscrizioniProps {
  giocatori: Giocatore[];
  onVersaIscrizione: (nome: string, importo: number) => Promise<void>;
  onCambiaStatoGiocatore: (nome: string, nuovoStato: boolean) => Promise<void>;
  onDisattivaTutti: () => Promise<void>;
  isEditor?: boolean;
}

export default function Iscrizioni({
  giocatori,
  onVersaIscrizione,
  onCambiaStatoGiocatore,
  onDisattivaTutti,
  isEditor = false,
}: IscrizioniProps) {
  if (!isEditor) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" id="sezione-iscrizioni">
        <div className="bg-slate-900 px-6 py-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎟️</span> Tessere & Iscrizioni
          </h2>
          <p className="text-xs text-slate-300">
            Controlla iscrizioni e stato giocatori
          </p>
        </div>
        <div className="p-12 text-center max-w-sm mx-auto space-y-4">
          <div className="text-4xl font-semibold">🔒</div>
          <h3 className="text-lg font-bold text-gray-800 tracking-tight">Area riservata agli amministratori</h3>
        </div>
      </div>
    );
  }

  const [depositi, setDepositi] = useState<Record<string, string>>({});

  const handleDepositChange = (nome: string, val: string) => {
    setDepositi(prev => ({ ...prev, [nome]: val }));
  };

  const handleVersaSubmit = async (nome: string) => {
    const amt = parseFloat(depositi[nome] || "0");
    if (isNaN(amt) || amt <= 0) {
      alert("Si prega di inserire una cifra valida maggiore di zero.");
      return;
    }
    await onVersaIscrizione(nome, amt);
    setDepositi(prev => ({ ...prev, [nome]: "" })); // Clear
    alert(`Quota d'iscrizione di ${amt.toFixed(2)}€ registrata con successo per ${nome}!`);
  };

  const handleDisattivaClicca = async () => {
    if (
      confirm(
        "Sei sicuro di voler disattivare TUTTA la rosa? Questo impedirà le convocazioni finché non verranno riattivati singolarmente (utile all'inizio di nuove stagioni)."
      )
    ) {
      await onDisattivaTutti();
      alert("Tutti i giocatori sono stati impostati como Inattivi!");
    }
  };

  const handleCopyReportConvocazioni = () => {
    let txt = `🎟️ *REPORT ISCRIZIONI SQUADRA* 🎟️\n\n`;
    const ordinati = [...giocatori].sort((a, b) => (b.quotaIscrizione || 0) - (a.quotaIscrizione || 0));
    ordinati.forEach(g => {
      const quota = g.quotaIscrizione || 0;
      const spuntato = quota > 0 ? "✅" : "❌";
      const attivoBadge = g.attivo ? " (Attivo/Convocabile)" : " (Inattivo)";
      txt += `${spuntato} *${g.nome}*: ${quota.toFixed(2)}€${attivoBadge}\n`;
    });
    const totaleIscrizioni = giocatori.reduce((acc, curr) => acc + (curr.quotaIscrizione || 0), 0);
    txt += `\n💰 *Totale Fondi Iscrizioni Raccolti:* ${totaleIscrizioni.toFixed(2)}€`;

    navigator.clipboard.writeText(txt);
    alert("Report iscrizioni copiato negli appunti! Condividi sul tuo gruppo WhatsApp.");
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" id="sezione-iscrizioni">
      <div className="bg-slate-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎟️</span> Gestione Iscrizioni & Quote Annuali
          </h2>
          <p className="text-xs text-slate-300">
            Controlla chi è attivo e regola le quote di iscrizione stagionali o quote tessera
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleCopyReportConvocazioni}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ClipboardCopy className="h-4 w-4" /> Esporta Report
          </button>
          {isEditor && (
            <button
              onClick={handleDisattivaClicca}
              className="px-3.5 py-1.5 bg-red-650 hover:bg-red-750 rounded-lg text-xs font-bold text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              <XCircle className="h-4 w-4" /> Disattiva Tutti
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        <p className="text-xs text-gray-500 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
          ℹ️ I giocatori contrassegnati come <strong>Inattivi</strong> rimangono salvati in rosa e mantengono il proprio storico statistiche/saldo, ma <strong>non appariranno più</strong> nella lista delle nuove convocazioni partitelle settimanali.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-1">
          {giocatori.map(g => {
            const quota = g.quotaIscrizione || 0;
            const hasPaid = quota > 0;
            return (
              <div
                key={g.nome}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 shadow-xs transition-shadow hover:shadow-sm ${
                  hasPaid ? "bg-green-50/50 border-green-200" : "bg-white border-gray-150"
                }`}
              >
                {/* Header Row of Single Profile */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-extrabold text-gray-800 text-sm">{g.nome}</h4>
                    <span className="inline-block text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-150/40 uppercase">
                      Maglia {g.numeroMaglia}
                    </span>
                  </div>

                  {/* Active status switcher */}
                  {isEditor ? (
                    <button
                      onClick={() => onCambiaStatoGiocatore(g.nome, !g.attivo)}
                      className={`cursor-pointer transition-colors p-1.5 rounded-lg flex items-center gap-1 text-[10px] font-bold uppercase leading-none border ${
                        g.attivo
                          ? "bg-green-150 text-green-800 border-green-200"
                          : "bg-red-100 text-red-800 border-red-200"
                      }`}
                      title={g.attivo ? "Disattiva Giocatore" : "Attiva Giocatore"}
                    >
                      {g.attivo ? (
                        <>
                          <ToggleRight className="h-4 w-4 text-green-700" /> Attivo
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-4 w-4 text-red-700" /> Inattivo
                        </>
                      )}
                    </button>
                  ) : (
                    <div
                      className={`p-1.5 rounded-lg flex items-center gap-1 text-[10px] font-bold uppercase leading-none border ${
                        g.attivo
                          ? "bg-green-150 text-green-800 border-green-200"
                          : "bg-red-100 text-red-800 border-red-200"
                      }`}
                    >
                      {g.attivo ? "Attivo" : "Inattivo"}
                    </div>
                  )}
                </div>

                {/* Accounting box */}
                <div className="bg-white/80 border border-gray-100 p-2.5 rounded-lg flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Fondo iscrizione versato:</span>
                  <strong className={hasPaid ? "text-green-700 font-extrabold" : "text-gray-400 font-bold"}>
                    {(g.quotaIscrizione || 0).toFixed(2)} €
                  </strong>
                </div>

                {/* Interactive Deposit form */}
                {isEditor && (
                  <div className="flex gap-1.5 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="€"
                      value={depositi[g.nome] || ""}
                      onChange={e => handleDepositChange(g.nome, e.target.value)}
                      className="w-16 sm:w-20 text-xs p-2 bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-slate-500"
                    />
                    <button
                      onClick={() => handleVersaSubmit(g.nome)}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      Registra Versamento
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
