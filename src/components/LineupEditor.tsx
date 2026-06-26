/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClipboardCheck, Copy, Share2, Users, AlertCircle, RefreshCw, Star, Info, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Formazione, Giocatore, Partita, getLastName, sortMatchesRecentFirst } from "../types";

interface LineupEditorProps {
  giocatori: Giocatore[];
  partiteAperte: Partita[];
  onSalvaFormazione: (idPartita: string, formazione: Formazione) => Promise<void>;
  isEditor?: boolean;
}

interface PitchSlot {
  id: string;
  label: string;
  x: number; // percentage from left
  y: number; // percentage from top
  suggestedRuolo: string;
}

export default function LineupEditor({
  giocatori,
  partiteAperte,
  onSalvaFormazione,
  isEditor = false,
}: LineupEditorProps) {
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [modulo, setModulo] = useState<"1-2-1" | "2-2" | "2-1-1" | "1-1-2">("1-2-1");
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);

  // Lineup states (5 starters padded with empty strings for coordinates mapping)
  const [titolari, setTitolari] = useState<string[]>(Array(5).fill(""));
  const [panchina, setPanchina] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const activeMatch = partiteAperte.find(p => p.id === selectedMatchId);
  const isAmichevole = activeMatch ? activeMatch.dettagli.includes("[Amichevole]") : false;
  let labelSquadraA = "Squadra A";
  let labelSquadraB = "Squadra B";

  if (activeMatch && isAmichevole) {
    const matchTeams = activeMatch.dettagli.match(/\(([^)]+)\s+vs\s+([^)]+)\)/);
    if (matchTeams && matchTeams.length >= 3) {
      labelSquadraA = matchTeams[1].trim();
      labelSquadraB = matchTeams[2].trim();
    }
  }

  // Get active pitch slots coordinates based on selected module
  const getSlots = (selectedModulo: typeof modulo): PitchSlot[] => {
    switch (selectedModulo) {
      case "1-2-1":
        return [
          { id: "por", label: "Portiere", x: 50, y: 88, suggestedRuolo: "Portiere" },
          { id: "cen", label: "Centrale", x: 50, y: 65, suggestedRuolo: "Centrale" },
          { id: "lat_sx", label: "Laterale Sx", x: 22, y: 46, suggestedRuolo: "Laterale" },
          { id: "lat_dx", label: "Laterale Dx", x: 78, y: 46, suggestedRuolo: "Laterale" },
          { id: "piv", label: "Pivot", x: 50, y: 20, suggestedRuolo: "Pivot" },
        ];
      case "2-2":
        return [
          { id: "por", label: "Portiere", x: 50, y: 88, suggestedRuolo: "Portiere" },
          { id: "cen_sx", label: "Centrale Sx", x: 28, y: 64, suggestedRuolo: "Centrale" },
          { id: "cen_dx", label: "Centrale Dx", x: 72, y: 64, suggestedRuolo: "Centrale" },
          { id: "piv_sx", label: "Pivot Sx", x: 28, y: 22, suggestedRuolo: "Pivot" },
          { id: "piv_dx", label: "Pivot Dx", x: 72, y: 22, suggestedRuolo: "Pivot" },
        ];
      case "2-1-1":
        return [
          { id: "por", label: "Portiere", x: 50, y: 88, suggestedRuolo: "Portiere" },
          { id: "cen_sx", label: "Centrale S", x: 28, y: 66, suggestedRuolo: "Centrale" },
          { id: "cen_dx", label: "Centrale D", x: 72, y: 66, suggestedRuolo: "Centrale" },
          { id: "lat", label: "Laterale", x: 50, y: 45, suggestedRuolo: "Laterale" },
          { id: "piv", label: "Pivot", x: 50, y: 20, suggestedRuolo: "Pivot" },
        ];
      case "1-1-2":
        return [
          { id: "por", label: "Portiere", x: 50, y: 88, suggestedRuolo: "Portiere" },
          { id: "cen", label: "Centrale", x: 50, y: 68, suggestedRuolo: "Centrale" },
          { id: "lat", label: "Laterale", x: 50, y: 45, suggestedRuolo: "Laterale" },
          { id: "piv_sx", label: "Pivot Sx", x: 28, y: 20, suggestedRuolo: "Pivot" },
          { id: "piv_dx", label: "Pivot Dx", x: 72, y: 20, suggestedRuolo: "Pivot" },
        ];
    }
  };

  // Sync state whenever match choice changes
  useEffect(() => {
    if (activeMatch) {
      const initialTitolari = activeMatch.formazione?.titolari || [];
      const padded = Array(5).fill("");
      initialTitolari.forEach((name, idx) => {
        if (idx < 5) padded[idx] = name;
      });
      setTitolari(padded);

      if (!isAmichevole) {
        const autoPanchina = activeMatch.convocati.filter(x => !initialTitolari.includes(x));
        setPanchina(autoPanchina);
      } else {
        setPanchina(activeMatch.formazione?.panchina || []);
      }
    } else {
      setTitolari(Array(5).fill(""));
      setPanchina([]);
    }
    setActiveSlotIdx(null);
  }, [selectedMatchId, activeMatch, isAmichevole]);

  // Position radio trigger for direct list clicking
  const handlePositionRadio = (nome: string, type: "T" | "P" | "NONE") => {
    let newTitolari = [...titolari];
    let newPanchina = [...panchina];

    if (type === "T") {
      if (newTitolari.includes(nome)) return;
      // Assign to the first empty slot in tactical positions order
      const emptyIdx = newTitolari.findIndex(x => x === "" || !x);
      if (emptyIdx !== -1) {
        newTitolari[emptyIdx] = nome;
      } else {
        alert("Configurazione campo piena! Rimuovi un titolare o clicca su un cerchio della lavagna per sostituirlo con un altro giocatore.");
        return;
      }
      newPanchina = newPanchina.filter(x => x !== nome);
    } else if (type === "P") {
      newTitolari = newTitolari.map(x => x === nome ? "" : x);
      if (!newPanchina.includes(nome)) {
        newPanchina.push(nome);
      }
    } else {
      newTitolari = newTitolari.map(x => x === nome ? "" : x);
      newPanchina = newPanchina.filter(x => x !== nome);
    }

    setTitolari(newTitolari);
    setPanchina(newPanchina);
  };

  // Drag-free visual slot assigner
  const handleSelectPlayerForSlot = (nome: string, slotIdx: number) => {
    const newTitolari = [...titolari];
    const prevPlayerInSlot = newTitolari[slotIdx];

    // Check if selected player is already assigned somewhere else
    const previousSlotOfSelected = newTitolari.indexOf(nome);
    if (previousSlotOfSelected !== -1) {
      // SWAP positions inside titolari!
      newTitolari[previousSlotOfSelected] = prevPlayerInSlot || "";
    }
    newTitolari[slotIdx] = nome;
    setTitolari(newTitolari);

    if (activeMatch) {
      const cleanTitolari = newTitolari.filter(x => x !== "");
      const finalPanchina = activeMatch.convocati.filter(x => !cleanTitolari.includes(x));
      setPanchina(finalPanchina);
    }
    setActiveSlotIdx(null);
  };

  const handleResetSlot = (slotIdx: number) => {
    const newTitolari = [...titolari];
    newTitolari[slotIdx] = "";
    setTitolari(newTitolari);

    if (activeMatch) {
      const cleanTitolari = newTitolari.filter(x => x !== "");
      const finalPanchina = activeMatch.convocati.filter(x => !cleanTitolari.includes(x));
      setPanchina(finalPanchina);
    }
  };

  const handleSave = async () => {
    if (!selectedMatchId) return;
    const cleanTitolari = titolari.filter(x => x !== "");
    if (!isAmichevole && cleanTitolari.length !== 5) {
      if (!confirm(`La formazione ufficiale per il campionato prevede solitamente 5 Titolari di partenza (1 Portiere e 4 giocatori in campo).\nAttualmente hai impostato solo: ${cleanTitolari.length} Titolari.\nVuoi comunque procedere con il salvataggio?`)) {
        return;
      }
    }
    await onSalvaFormazione(selectedMatchId, { titolari: cleanTitolari, panchina });
    showToast("Formazione salvata con successo!");
  };

  const handleCopyWhatsApp = () => {
    if (!activeMatch) return;
    const cleanTitolari = titolari.filter(x => x !== "");
    if (cleanTitolari.length === 0 && panchina.length === 0) {
      alert("Configura e salva la formazione prima di copiare.");
      return;
    }

    if (isAmichevole) {
      const primaRiga = activeMatch.dettagli.split("\n")[0] || "";
      let dataOraAmichevole = "";
      let campoAmichevole = "";
      
      const regexLine = /^(.*?)\s+-\s+([^(]*)\s*\(([^)]+)\s+vs\s+([^)]+)\)\s+\[Amichevole\]/;
      const matchDetails = primaRiga.match(regexLine);
      
      if (matchDetails) {
        dataOraAmichevole = matchDetails[1].trim();
        campoAmichevole = matchDetails[2].trim();
      } else {
        const parts = primaRiga.split(" - ");
        if (parts.length > 0) dataOraAmichevole = parts[0].trim();
        if (parts.length > 1) campoAmichevole = parts[1].split("(")[0].trim();
      }

      const quotaSingola = activeMatch.costo && activeMatch.convocati.length
        ? (activeMatch.costo / activeMatch.convocati.length).toFixed(2)
        : "0.00";

      let txtAmichevole = `⚽ *FORMAZIONI AMICHEVOLE* ⚽\n`;
      if (dataOraAmichevole) txtAmichevole += `📅 *Data e ora:* ${dataOraAmichevole}\n`;
      if (campoAmichevole) txtAmichevole += `📍 *Campo:* ${campoAmichevole}\n`;
      if (activeMatch.costo > 0) txtAmichevole += `💰 *Quota:* ${quotaSingola}€ a testa\n`;
      txtAmichevole += `\n`;

      txtAmichevole += `👕 *${labelSquadraA}*:\n`;
      cleanTitolari.forEach(n => {
        const cleanName = n.replace(" (Esterno)", "");
        const maglia = giocatori.find(x => x.nome === n)?.numeroMaglia;
        txtAmichevole += `- ${cleanName}${maglia ? ` (#${maglia})` : ""}\n`;
      });
      txtAmichevole += `\n👕 *${labelSquadraB}*:\n`;
      panchina.forEach(n => {
        const cleanName = n.replace(" (Esterno)", "");
        const maglia = giocatori.find(x => x.nome === n)?.numeroMaglia;
        txtAmichevole += `- ${cleanName}${maglia ? ` (#${maglia})` : ""}\n`;
      });

      navigator.clipboard.writeText(txtAmichevole.trim());
      alert("Formazione Copiata! Incolla direttamente nella chat WhatsApp del tuo gruppo.");
      return;
    }

    const quotaSingola = activeMatch.costo && activeMatch.convocati.length
      ? (activeMatch.costo / activeMatch.convocati.length).toFixed(2)
      : "0.00";

    const dett = activeMatch.dettagli;
    let dataOra = "";
    let campo = "";
    let avversario = "";

    const partiVs = dett.split(" vs ");
    if (partiVs.length > 1) avversario = partiVs[1].trim();

    const partiVirgola = partiVs[0].split(", ");
    dataOra = partiVirgola[0].trim();
    if (partiVirgola.length > 1) campo = partiVirgola[1].trim();

    const dataOraGrassetto = dataOra
      .split(" ")
      .map(blocco => {
        const pulito = blocco.replace(/[\/:]/g, match => "\u200B" + match);
        return `*${pulito}*`;
      })
      .join(" ");

    let txt = `📋 *LA PROBABILE* (${modulo}) 📋\n\n`;
    txt += `📅 *Data e ora:* ${dataOraGrassetto}\n`;
    txt += `💰 *Quota Individuale:* ${quotaSingola}€\n`;
    if (campo) txt += `📍 *Campo:* ${campo}\n`;
    if (avversario) txt += `🆚 *Avversario:* ${avversario}\n`;
    txt += `\n`;

    const getRuolo = (nome: string) => {
      const g = giocatori.find(x => x.nome === nome);
      return g ? g.ultimoRuolo || "" : "";
    };

    const isStaff = (nome: string) => {
      const r = getRuolo(nome);
      return r === "Allenatore" || r === "Tifoso";
    };

    const ruoliCampo = ["Portiere", "Centrale", "Laterale", "Pivot"];

    // 1. Titolari
    const tit = cleanTitolari.filter(n => !isStaff(n));
    if (tit.length > 0) {
      txt += `*👕 TITOLARI DI PARTENZA*\n`;
      ruoliCampo.forEach(r => {
        const inRuolo = tit.filter(n => getRuolo(n) === r);
        if (inRuolo.length > 0) {
          const label = r === "Centrale" ? "Centrali" : r === "Laterale" ? "Laterali" : r;
          txt += `_${label}_\n`;
          inRuolo.forEach(n => {
            const maglia = giocatori.find(x => x.nome === n)?.numeroMaglia || "99";
            txt += `- ${n} (#${maglia})\n`;
          });
        }
      });
      const altriTit = tit.filter(n => !ruoliCampo.includes(getRuolo(n)));
      if (altriTit.length > 0) {
        txt += `_Altri Ruoli_\n`;
        altriTit.forEach(n => {
          const maglia = giocatori.find(x => x.nome === n)?.numeroMaglia || "99";
          txt += `- ${n} (#${maglia})\n`;
        });
      }
      txt += `\n`;
    }

    // 2. Panchina
    const pan = panchina.filter(n => !isStaff(n));
    if (pan.length > 0) {
      txt += `*🎽 PANCHINA*\n`;
      ruoliCampo.forEach(r => {
        const inRuolo = pan.filter(n => getRuolo(n) === r);
        if (inRuolo.length > 0) {
          const label = r === "Centrale" ? "Centrali" : r === "Laterale" ? "Laterali" : r;
          txt += `_${label}_\n`;
          inRuolo.forEach(n => {
            const maglia = giocatori.find(x => x.nome === n)?.numeroMaglia || "99";
            txt += `- ${n} (#${maglia})\n`;
          });
        }
      });
      const altriPan = pan.filter(n => !ruoliCampo.includes(getRuolo(n)));
      if (altriPan.length > 0) {
        txt += `_Altri Ruoli_\n`;
        altriPan.forEach(n => {
          const maglia = giocatori.find(x => x.nome === n)?.numeroMaglia || "99";
          txt += `- ${n} (#${maglia})\n`;
        });
      }
      txt += `\n`;
    }

    const united = [...cleanTitolari, ...panchina];
    const coachs = united.filter(n => getRuolo(n) === "Allenatore");
    if (coachs.length > 0) {
      txt += `*👔 Allenatore*\n`;
      coachs.forEach(n => (txt += `- ${n}\n`));
      txt += `\n`;
    }

    const fans = united.filter(n => getRuolo(n) === "Tifoso");
    if (fans.length > 0) {
      txt += `*📣 Tifosi & Accompagnatori*\n`;
      fans.forEach(n => (txt += `- ${n}\n`));
      txt += `\n`;
    }

    navigator.clipboard.writeText(txt.trim());
    alert("Formazione Copiata! Incolla direttamente nella chat WhatsApp del tuo gruppo.");
  };

  const slots = getSlots(modulo);

  if (!isEditor) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" id="sezione-formazione">
        <div className="bg-slate-900 px-6 py-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📋</span> Componi Formazione Gara
          </h2>
          <p className="text-xs text-slate-300">
            Assegna i ruoli di partenza ai convocati e genera i diagrammi per la chat
          </p>
        </div>
        <div className="p-12 text-center max-w-sm mx-auto space-y-4">
          <div className="text-4xl font-semibold">🔒</div>
          <h3 className="text-lg font-bold text-gray-800 tracking-tight">Area riservata agli amministratori</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in relative" id="sezione-formazione">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 sm:bottom-12 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in pointer-events-none">
          <div className="bg-emerald-500 text-white px-4 py-2.5 rounded-full shadow-2xl font-sans font-bold text-xs sm:text-sm tracking-wide flex items-center gap-2 border border-emerald-400">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
      <div className="bg-slate-900 px-6 py-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📋</span> Componi Formazione Gara
        </h2>
        <p className="text-xs text-slate-300">
          Usa la lavagna tattica per trascinare o assegnare con un click i giocatori, scegli il modulo e genera lo schieramento
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Match Selector */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Seleziona Partita Aperta</label>
          <select
            value={selectedMatchId}
            onChange={e => setSelectedMatchId(e.target.value)}
            className="w-full text-sm p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
          >
            <option value="">-- Seleziona Gara --</option>
            {sortMatchesRecentFirst(partiteAperte).map(p => (
              <option key={p.id} value={p.id}>
                {p.dettagli}
              </option>
            ))}
          </select>
        </div>

        {activeMatch ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* LEFT SIDE: TACTICAL FIELD PLAYGROUND */}
            <div className="md:col-span-5 flex flex-col items-center space-y-4">
              <div className="w-full max-w-[340px] flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                <span className="text-xs font-bold text-gray-600">Modulo Tattico:</span>
                <select
                  value={modulo}
                  onChange={e => {
                    setModulo(e.target.value as any);
                    setActiveSlotIdx(null);
                  }}
                  className="text-xs font-extrabold bg-white border border-gray-200 py-1 px-2 rounded focus:ring-1 focus:ring-slate-500 outline-none"
                >
                  <option value="1-2-1">1-2-1 (Rombo Standard)</option>
                  <option value="2-2">2-2 (Quadrato Solido)</option>
                  <option value="2-1-1">2-1-1 (Ypsilon Tesa)</option>
                  <option value="1-1-2">1-1-2 (Albero Spinto)</option>
                </select>
              </div>

              {/* Soccer Futsal Pitch Visual */}
              <div className="relative aspect-[3/4] w-full max-w-[340px] bg-gradient-to-b from-emerald-600 to-emerald-700 rounded-2xl overflow-hidden border-4 border-emerald-800 shadow-xl p-4">
                {/* Grass stripes overlay */}
                <div className="absolute inset-y-0 left-0 right-0 grid grid-rows-6 opacity-10 pointer-events-none">
                  <div className="bg-black/20"></div>
                  <div></div>
                  <div className="bg-black/20"></div>
                  <div></div>
                  <div className="bg-black/20"></div>
                  <div></div>
                </div>

                {/* Outer Field lines */}
                <div className="absolute inset-2 border border-white/40 rounded-xl pointer-events-none"></div>

                {/* Center circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/40 pointer-events-none"></div>
                {/* Midfield line */}
                <div className="absolute top-1/2 left-2 right-2 h-px bg-white/40 pointer-events-none"></div>
                {/* Midfield center spot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/50 rounded-full pointer-events-none"></div>

                {/* Top D-Area */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-40 h-20 rounded-b-full border border-white/40 border-t-0 pointer-events-none"></div>
                <div className="absolute top-15 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/50 rounded-full pointer-events-none"></div>

                {/* Bottom D-Area */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-40 h-20 rounded-t-full border border-white/40 border-b-0 pointer-events-none"></div>
                <div className="absolute bottom-15 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/50 rounded-full pointer-events-none"></div>

                {/* Interactive Player Node Slots */}
                {slots.map((slot, index) => {
                  const assignedPlayerName = titolari[index];
                  const details = giocatori.find(x => x.nome === assignedPlayerName);
                  const isSlotActive = activeSlotIdx === index;

                  return (
                    <div
                      key={slot.id}
                      style={{
                        position: "absolute",
                        left: `${slot.x}%`,
                        top: `${slot.y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      className="flex flex-col items-center space-y-1.5 z-10"
                    >
                      {assignedPlayerName ? (
                        <div className="group relative flex flex-col items-center">
                          {/* Player disc jersey element */}
                          <button
                            onClick={() => {
                              if (isEditor) setActiveSlotIdx(isSlotActive ? null : index);
                            }}
                            className={`w-12 h-12 rounded-full border-2 bg-slate-950 flex items-center justify-center text-white shadow-lg cursor-pointer transform hover:scale-110 active:scale-95 duration-200 ${
                              isSlotActive ? "border-amber-400 ring-4 ring-amber-400/30" : "border-slate-800"
                            }`}
                            type="button"
                          >
                            <span className="text-[14px] font-black tracking-tight select-none">
                              {details?.numeroMaglia || "99"}
                            </span>
                          </button>
                          
                          {/* Close slot trigger mini button popup */}
                          {isEditor && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetSlot(index);
                              }}
                              className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-500 text-white w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] hover:scale-110 shadow-md border border-white cursor-pointer"
                              title="Poni in panchina"
                            >
                              ✕
                            </button>
                          )}

                          {/* Player visual Nameplate */}
                          <div className="bg-slate-900/95 border border-slate-700 text-[10px] font-bold text-white px-2 py-0.5 rounded shadow-md truncate max-w-[76px] text-center whitespace-nowrap leading-tight mt-1">
                            {getLastName(assignedPlayerName)}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (isEditor) setActiveSlotIdx(isSlotActive ? null : index);
                          }}
                          className={`w-11 h-11 rounded-full border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                            isSlotActive
                              ? "border-amber-400 bg-amber-400/20 text-white scale-105 shadow-md"
                              : "border-white/60 bg-black/30 hover:bg-black/45 text-white/90 hover:scale-105"
                          } cursor-pointer`}
                          type="button"
                          title={`Assegna ${slot.label}`}
                        >
                          <span className="text-[9px] font-extrabold tracking-wider leading-none uppercase select-none">
                            {slot.label.split(" ").map(w => w[0]).join("")}
                          </span>
                          <span className="text-[10px] m-0 leading-none font-bold">+</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Informative field note */}
              <div className="text-[10px] text-gray-400 text-center uppercase tracking-wider font-semibold">
                ⚽ Clicca sulle posizioni della lavagna per schierare i titolari
              </div>
            </div>

            {/* RIGHT SIDE: ASSIGNER CARD & PLAYERS LISTS */}
            <div className="md:col-span-7 space-y-4">
              {/* Context Selector List to assign players */}
              {activeSlotIdx !== null && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3 shadow-inner animate-fade-in">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                        Seleziona titolare per: {slots[activeSlotIdx]?.label}
                      </h4>
                      <p className="text-[11px] text-amber-800">
                        Consigliato per il ruolo di: <strong>{slots[activeSlotIdx]?.suggestedRuolo}</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveSlotIdx(null)}
                      className="text-xs text-amber-700 font-bold hover:text-amber-950 uppercase cursor-pointer"
                    >
                      Chiudi
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {activeMatch.convocati.map(nome => {
                      const g = giocatori.find(x => x.nome === nome);
                      const isAlreadyStarter = titolari.includes(nome);
                      const currentIdx = titolari.indexOf(nome);

                      return (
                        <button
                          key={nome}
                          onClick={() => handleSelectPlayerForSlot(nome, activeSlotIdx)}
                          className={`p-2.5 rounded-lg text-left text-xs transition-all flex flex-col justify-between cursor-pointer border ${
                            isAlreadyStarter
                              ? currentIdx === activeSlotIdx
                                ? "bg-amber-600 text-white border-amber-700 font-extrabold shadow-sm"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200/80"
                              : "bg-white hover:bg-amber-100/50 border-gray-200/80 text-gray-800"
                          }`}
                        >
                          <span className="font-extrabold truncate w-full">{getLastName(nome)}</span>
                          <span className="text-[9px] font-semibold text-gray-400 capitalize mt-0.5">
                            {g?.ultimoRuolo || "Laterale"} {isAlreadyStarter && `(Spostato)`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Squad view overview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Riepilogo Squadre</h3>
                    <p className="text-[11px] text-slate-500">I convocati odierni ({activeMatch.convocati.length}) schierati per la gara</p>
                  </div>
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="bg-slate-200 text-slate-800 px-2 py-1 rounded">
                      TIT ({titolari.filter(Boolean).length} / 5)
                    </span>
                    <span className="bg-orange-100 text-orange-850 px-2 py-1 rounded">
                      PAN ({panchina.length})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* STARTERS TEAM */}
                  <div className="bg-white p-3 rounded-lg border border-slate-250/80 shadow-3xs space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Titolari (TIT)
                    </h4>
                    <div className="space-y-1.5 font-sans">
                      {slots.map((slot, index) => {
                        const name = titolari[index];
                        return (
                          <div key={slot.id} className="text-xs flex items-center justify-between gap-1 py-1 px-1.5 rounded bg-gray-50/50 hover:bg-gray-50 border border-gray-100/70">
                            <span className="font-mono text-[9px] text-slate-400 uppercase font-black">{slot.label}:</span>
                            <span className="font-extrabold text-slate-800 truncate text-right flex-1">{name || "Libero"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* BENCH TEAM */}
                  <div className="bg-white p-3 rounded-lg border border-slate-250/80 shadow-3xs space-y-2">
                    <h4 className="text-[10px] font-bold text-orange-650 uppercase tracking-widest">
                      🎽 Panchina (PAN)
                    </h4>
                    <div className="space-y-1 overflow-y-auto max-h-44 pr-1">
                      {panchina.length > 0 ? (
                        panchina.map(name => {
                          const g = giocatori.find(x => x.nome === name);
                          return (
                            <div key={name} className="text-xs bg-slate-55/60 p-1 px-2 rounded flex justify-between items-center text-slate-700 truncate font-semibold">
                              <span className="truncate">{name}</span>
                              <span className="text-[9px] font-semibold text-slate-400 capitalize">{g?.ultimoRuolo || "G"}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[11px] text-gray-400 italic py-4 text-center">Nessun giocatore in panchina</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fallback Checkboxes Row Table */}
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                <div className="p-3 bg-gray-50 text-xs font-bold text-gray-600 flex justify-between items-center">
                  <span>Modifica manuale dei ruoli convocati</span>
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-150">Roster 9 Ruoli</span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                  {activeMatch.convocati.map(nome => {
                    const g = giocatori.find(x => x.nome === nome);
                    const isTit = titolari.includes(nome);
                    const isPan = panchina.includes(nome);

                    return (
                      <div key={nome} className="p-2.2 px-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-gray-50">
                        <div>
                          <span className="font-extrabold text-sm text-gray-800">
                            {getLastName(nome)}
                            {g?.numeroMaglia && (
                              <span className="text-[10px] text-slate-400 font-mono font-bold ml-1.5">#{g.numeroMaglia}</span>
                            )}
                          </span>
                          <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            {g?.ultimoRuolo || "Laterale"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase cursor-pointer">
                            <input
                              type="radio"
                              name={`tbl-lin-${nome}`}
                              checked={isTit}
                              onChange={() => handlePositionRadio(nome, "T")}
                              className="w-4 h-4 text-slate-800 focus:ring-slate-500 hover:scale-105"
                            />
                            TIT
                          </label>

                          <label className="flex items-center gap-1.5 text-xs font-bold text-orange-900 uppercase cursor-pointer">
                            <input
                              type="radio"
                              name={`tbl-lin-${nome}`}
                              checked={isPan}
                              onChange={() => handlePositionRadio(nome, "P")}
                              className="w-4 h-4 text-orange-500 focus:ring-orange-500 hover:scale-105"
                            />
                            PAN
                          </label>

                          <button
                            onClick={() => handlePositionRadio(nome, "NONE")}
                            className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase px-1"
                            type="button"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleSave}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ClipboardCheck className="h-4 w-4" /> Salva Formazione
                  </button>
                  <button
                    onClick={handleCopyWhatsApp}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl text-white font-extrabold text-sm shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="h-4 w-4" /> Whatsapp
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-gray-400 italic text-sm space-y-2">
            <div className="text-3xl">⚽</div>
            <div>Nessuna gara selezionata. Scegli un evento in cima per visualizzare la Lavagna Tattica.</div>
          </div>
        )}
      </div>
    </div>
  );
}
