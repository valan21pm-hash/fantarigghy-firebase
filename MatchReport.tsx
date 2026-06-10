/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lightbulb, Check, Trash2, Clock, User, MessageSquare } from "lucide-react";
import { Consiglio } from "../types";
import { useState } from "react";

interface ConsigliRicevutiProps {
  consigli: Consiglio[];
  onSegnaLetto: (id: string) => Promise<any>;
  onElimina: (id: string) => Promise<any>;
  onClose: () => void;
}

export default function ConsigliRicevuti({
  consigli,
  onSegnaLetto,
  onElimina,
  onClose,
}: ConsigliRicevutiProps) {
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleAction = async (id: string, actionType: "letto" | "elimina") => {
    setSubmittingId(id + actionType);
    try {
      if (actionType === "letto") {
        await onSegnaLetto(id);
      } else {
        await onElimina(id);
      }
    } catch (err: any) {
      alert("Errore nell'operazione: " + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  // Sort newest first, with unread ones highlighted or at the top
  const sortedConsigli = [...consigli].sort((a, b) => {
    if (a.letto === b.letto) {
      // Sort by timeline if same state
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    }
    return a.letto ? 1 : -1; // Unread first
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-xl text-amber-600 animate-pulse">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Consigli & Miglioramenti Proposti
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Idee e richieste inviate dai presidenti durante l'inserimento delle formazioni
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer p-1"
          >
            Chiudi
          </button>
        </div>

        {/* Suggestion List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {sortedConsigli.length > 0 ? (
            sortedConsigli.map((consiglio) => {
              const isUnread = !consiglio.letto;
              return (
                <div
                  key={consiglio.id}
                  className={`border rounded-2xl p-4.5 transition-all text-left flex flex-col sm:flex-row justify-between items-start gap-4 ${
                    isUnread
                      ? "bg-amber-50/50 border-amber-200/80 shadow-xs"
                      : "bg-gray-50/50 border-gray-200/60"
                  }`}
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-black uppercase text-gray-800 bg-white border px-2.5 py-1 rounded-lg shadow-2xs">
                        <User className="h-3.5 w-3.5 text-emerald-600" />
                        {consiglio.autore}
                      </span>
                      <span className="flex items-center gap-1 text-[9.5px] font-bold text-gray-400 font-mono">
                        <Clock className="h-3 w-3" />
                        {consiglio.data}
                      </span>
                      {isUnread && (
                        <span className="text-[8.5px] font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-md animate-pulse">
                          Nuovo
                        </span>
                      )}
                    </div>
                    
                    <div className="text-gray-700 text-xs font-semibold leading-relaxed break-words bg-white/70 border border-gray-150/50 rounded-xl p-3 flex gap-2.5">
                      <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{consiglio.testo}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col items-center sm:items-stretch gap-1.5 self-end sm:self-center shrink-0 w-full sm:w-auto">
                    {isUnread && (
                      <button
                        type="button"
                        disabled={submittingId === consiglio.id + "letto"}
                        onClick={() => handleAction(consiglio.id, "letto")}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-black uppercase rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Letto</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={submittingId === consiglio.id + "elimina"}
                      onClick={() => handleAction(consiglio.id, "elimina")}
                      className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-[10.5px] font-black uppercase rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                        isUnread
                          ? "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
                          : "bg-red-50 hover:bg-red-100 text-red-650 border border-red-200"
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Elimina</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
              <div className="bg-gray-100 p-3 rounded-2xl text-gray-400">
                <Lightbulb className="h-8 w-8 text-gray-400" />
              </div>
              <p className="font-extrabold text-sm text-gray-500">Nessun consiglio o miglioramento proposto</p>
              <p className="text-[11px] text-gray-400 font-medium">
                Quando i presidenti salveranno il loro roster fantacalcetto, potranno inviare feedback qui!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t mt-4">
          <span className="text-[10px] text-gray-400 font-bold">
            Totale proposte: {consigli.length} ({consigli.filter(c => !c.letto).length} nuove)
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-xl font-bold transition-all cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
