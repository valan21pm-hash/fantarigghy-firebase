/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Coins, History, ShieldAlert, Trophy, Lightbulb } from "lucide-react";

interface NavbarProps {
  fondoCassa: number;
  onOpenLogs: () => void;
  user: any;
  onLogin: () => void;
  onLogout: () => void;
  isGoogleSheetsSynced?: boolean;
  syncError?: string | null;
  unreadConsigliCount: number;
  onOpenConsigli: () => void;
}

export default function Navbar({
  fondoCassa,
  onOpenLogs,
  user,
  onLogin,
  onLogout,
  isGoogleSheetsSynced = false,
  syncError = null,
  unreadConsigliCount,
  onOpenConsigli,
}: NavbarProps) {
  const isPositive = fondoCassa >= 0;

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-slate-100 shadow-sm border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex justify-between items-center">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
              Easy Rigging
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              Gestione Campionato, Quote & Statistiche
            </p>
          </div>
        </div>

        {/* Right side widgets: Google Sync, Fund Tracker and Logs Button */}
        <div className="flex items-center gap-3">
          {/* OAuth Sync Indicator */}
          <div className="flex items-center shrink-0">
            {user ? (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 h-8">
                {isGoogleSheetsSynced ? (
                  <>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="text-[11px] font-bold uppercase text-green-400 tracking-wider hidden sm:inline">
                      Sheets
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm leading-none" title="Errore Sync">⚠️</span>
                    <button
                      type="button"
                      onClick={onLogin}
                      className="text-[10px] uppercase font-extrabold text-amber-400 hover:text-amber-300 cursor-pointer"
                      title="Forza Accesso per riprovare"
                    >
                      Login
                    </button>
                    <span className="text-slate-600">|</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-[10px] uppercase font-extrabold text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Disconnetti l'account Google"
                >
                  Esci
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-md transition-all cursor-pointer h-8 uppercase tracking-wider"
                title="Collega l'applicazione a Google Drive"
              >
                <span>📁</span> Login
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg shadow-sm h-8">
            <Coins className="h-4 w-4 text-amber-400" />
            <div className="text-right">
              <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold leading-none">
                Cassa Squadra
              </span>
              <span
                className={`text-xs sm:text-sm font-bold font-mono tracking-tight leading-none ${
                  isPositive ? "text-green-400" : "text-red-400"
                }`}
              >
                {isPositive ? "+" : ""}
                {fondoCassa.toFixed(2)} €
              </span>
            </div>
            {fondoCassa < 0 && (
              <ShieldAlert className="h-4 w-4 text-red-400 animate-pulse" />
            )}
          </div>

          <button
            onClick={onOpenConsigli}
            className="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-slate-200 transition-all cursor-pointer shadow-sm relative group h-8 flex items-center justify-center"
            title="Consigli dell'amico & Miglioramenti"
          >
            <Lightbulb className={`h-4.5 w-4.5 ${unreadConsigliCount > 0 ? "text-amber-400 animate-pulse" : ""}`} />
            {unreadConsigliCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full h-4 w-4 flex items-center justify-center border border-slate-950 animate-bounce leading-none">
                {unreadConsigliCount}
              </span>
            )}
            <span className="sr-only">Suggerimenti Ricevuti</span>
          </button>

          <button
            onClick={onOpenLogs}
            className="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-slate-200 transition-all cursor-pointer shadow-sm relative group h-8 flex items-center justify-center"
            title="Log Attività"
          >
            <History className="h-4.5 w-4.5" />
            <span className="sr-only">Log Attività</span>
          </button>
        </div>
      </div>
    </header>
  );
}
