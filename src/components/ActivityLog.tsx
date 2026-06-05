/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileSpreadsheet, Search } from "lucide-react";
import { useState } from "react";

interface LogNode {
  data: string;
  operazione: string;
  importo: string;
  dettagli: string;
}

interface ActivityLogProps {
  logs: LogNode[];
  onClose: () => void;
}

export default function ActivityLog({ logs, onClose }: ActivityLogProps) {
  const [logSearch, setLogSearch] = useState("");

  const filteredLogs = [...logs]
    .filter(l => {
      const matchOp = l.operazione.toLowerCase().includes(logSearch.toLowerCase());
      const matchDet = l.dettagli.toLowerCase().includes(logSearch.toLowerCase());
      return matchOp || matchDet;
    })
    .reverse(); // Newest first

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-slate-700" /> Registro Attività & Log Operazioni
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer p-1"
          >
            Chiudi
          </button>
        </div>

        {/* Filter */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Filtra operazioni o dettagli..."
            value={logSearch}
            onChange={e => setLogSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-slate-500 outline-none"
          />
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
        </div>

        {/* Table list */}
        <div className="flex-1 overflow-y-auto border border-gray-150 rounded-xl bg-gray-50/50">
          {filteredLogs.length > 0 ? (
            <div className="min-w-full divide-y divide-gray-200">
              <table className="min-w-full text-left text-xs divide-y divide-gray-150">
                <thead className="bg-slate-900 text-slate-100 uppercase font-extrabold tracking-wider text-[10px]">
                  <tr>
                    <th scope="col" className="px-4 py-3">Data</th>
                    <th scope="col" className="px-4 py-3">Operazione</th>
                    <th scope="col" className="px-4 py-3">Importo</th>
                    <th scope="col" className="px-4 py-3">Dettagli Operazione</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-gray-700">
                  {filteredLogs.map((log, idx) => {
                    let badgeColor = "bg-gray-100 text-gray-800";
                    if (log.operazione === "Ricarica") badgeColor = "bg-green-100 text-green-800";
                    if (log.operazione === "Chiusura Partita") badgeColor = "bg-blue-105 text-blue-900";
                    if (log.operazione === "Spesa Condivisa") badgeColor = "bg-yellow-100 text-yellow-800";
                    if (log.operazione === "Quota Iscrizione") badgeColor = "bg-sky-100 text-sky-800";

                    return (
                      <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-400 font-mono">
                          {log.data}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${badgeColor}`}>
                            {log.operazione}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-900 font-mono">
                          {log.importo === "-" ? "-" : `${parseFloat(log.importo).toFixed(2)}€`}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs sm:max-w-md font-medium break-words">
                          {log.dettagli}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400 italic">
              Nessun record corrispondente nel registro attività
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t mt-4">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-xl font-bold transition-all cursor-pointer"
          >
            Chiudi Registro
          </button>
        </div>
      </div>
    </div>
  );
}
