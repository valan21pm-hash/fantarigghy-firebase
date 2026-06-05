/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Calendar, CheckSquare, ClipboardCheck, Plus, Users, Trash2, Shuffle, Check, ArrowLeft } from "lucide-react";
import { Giocatore, getLastName } from "../types";

interface ConvocationsProps {
  giocatori: Giocatore[];
  campi: string[];
  onCreaPartita: (
    costo: number,
    convocati: string[],
    dettagli: string,
    campo: string,
    mappaRuoli: Record<string, string>
  ) => Promise<void>;
  isEditor?: boolean;
}

const RUOLI = ["Portiere", "Centrale", "Laterale", "Pivot", "Allenatore", "Tifoso"];

export default function Convocations({
  giocatori,
  campi,
  onCreaPartita,
  isEditor = false,
}: ConvocationsProps) {
  // Mode switcher: "campionato" (standard convocations) vs "amichevole" (friendly match with lineups)
  const [activeMode, setActiveMode] = useState<"campionato" | "amichevole">("campionato");

  // Core fields
  const [data, setData] = useState("");
  const [ora, setOra] = useState("");
  const [campo, setCampo] = useState("");
  const [nuovoCampo, setNuovoCampo] = useState("");
  const [costo, setCosto] = useState("");
  const [avversario, setAvversario] = useState("");

  // Convocati checklist state (default we check all active players)
  const [selezionati, setSelezionati] = useState<string[]>(
    giocatori.filter(g => g.attivo).map(g => g.nome)
  );

  // Mappa ruoli convocati
  const [ruoliConvocati, setRuoliConvocati] = useState<Record<string, string>>(
    giocatori.reduce((acc, curr) => {
      acc[curr.nome] = curr.ultimoRuolo || "";
      return acc;
    }, {} as Record<string, string>)
  );

  // Friendly match specific fields
  const [squadraA, setSquadraA] = useState("Noi");
  const [squadraB, setSquadraB] = useState("Avversari");
  const [esterni, setEsterni] = useState<string[]>([]);
  const [nuovoEsterno, setNuovoEsterno] = useState("");
  const [lineupStep, setLineupStep] = useState(false);
  const [lineupAssignments, setLineupAssignments] = useState<Record<string, "A" | "B">>({});

  const handleToggleSelectAll = () => {
    const activeOnes = giocatori.filter(g => g.attivo).map(g => g.nome);
    if (selezionati.length === activeOnes.length) {
      setSelezionati([]);
    } else {
      setSelezionati(activeOnes);
    }
  };

  const handleTogglePlayer = (nome: string) => {
    if (selezionati.includes(nome)) {
      setSelezionati(selezionati.filter(x => x !== nome));
    } else {
      setSelezionati([...selezionati, nome]);
    }
  };

  const handleRoleChange = (nome: string, ruolo: string) => {
    setRuoliConvocati({
      ...ruoliConvocati,
      [nome]: ruolo,
    });
  };

  // Add a temporary external player name
  const handleAddEsterno = () => {
    const nomeLibero = nuovoEsterno.trim();
    if (!nomeLibero) return;
    const nomeCompleto = `${nomeLibero} (Esterno)`;
    if (esterni.includes(nomeCompleto) || giocatori.some(g => g.nome.toLowerCase() === nomeLibero.toLowerCase())) {
      alert("Questo nome è già presente in lista!");
      return;
    }
    setEsterni([...esterni, nomeCompleto]);
    setNuovoEsterno("");
  };

  const handleRemoveEsterno = (nome: string) => {
    setEsterni(esterni.filter(e => e !== nome));
  };

  // Stagger/Alternating setup for line-ups
  const handleRandomizeLineup = () => {
    const tutteUnite = [...selezionati, ...esterni];
    const nState: Record<string, "A" | "B"> = {};
    tutteUnite.forEach((nome, i) => {
      nState[nome] = i % 2 === 0 ? "A" : "B";
    });
    setLineupAssignments(nState);
  };

  // Advance to Friendly match squad composing step
  const handleProcediFormazione = () => {
    let finalData = data;
    let finalOra = ora;
    let finalCampo = campo;

    if (!finalData) {
      finalData = new Date().toISOString().split("T")[0];
    }
    if (!finalOra) {
      finalOra = "21:00";
    }
    if (!finalCampo) {
      finalCampo = campi[0] || "Campo Amichevole";
    }

    // Force values so they are defined when saving
    setData(finalData);
    setOra(finalOra);
    setCampo(finalCampo);

    const tutteConvocati = [...selezionati, ...esterni];
    if (tutteConvocati.length < 2) {
      alert("Si prega di includere almeno due calciatori (interni o esterni) per comporre le squadre.");
      return;
    }

    // Prepare initial step state (even indices to A, odd to B)
    const nState: Record<string, "A" | "B"> = {};
    tutteConvocati.forEach((nome, i) => {
      nState[nome] = i % 2 === 0 ? "A" : "B";
    });
    setLineupAssignments(nState);
    setLineupStep(true);
  };

  // Save friendly match
  const handleSalvaAmichevole = async () => {
    const campoScelto = campo === "NUOVO" ? nuovoCampo.trim() : (campo || campi[0] || "Campo Amichevole");
    const costoTotale = parseFloat(costo) || 0;

    let localData = data || new Date().toISOString().split("T")[0];
    // Format Date to long Italian string
    const [year, month, day] = localData.split("-");
    const dateObj = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
    const formatter = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });
    let dataLeggibile = formatter.format(dateObj);
    dataLeggibile = dataLeggibile.charAt(0).toUpperCase() + dataLeggibile.slice(1);

    const tutteLeSquadre = [...selezionati, ...esterni];
    const formatiA = tutteLeSquadre.filter(name => lineupAssignments[name] === "A");
    const formatiB = tutteLeSquadre.filter(name => lineupAssignments[name] === "B");

    const formazioniStr = `\n\n👕 *${squadraA}*:\n${formatiA.map(n => n.replace(" (Esterno)", "")).join(", ")}\n\n👕 *${squadraB}*:\n${formatiB.map(n => n.replace(" (Esterno)", "")).join(", ")}`;
    const dettagliDatabase = `${dataLeggibile} ore ${ora || "21:00"} - ${campoScelto} (${squadraA} vs ${squadraB}) [Amichevole]` + formazioniStr;

    // Create the match row in backend!
    await onCreaPartita(costoTotale, tutteLeSquadre, dettagliDatabase, campoScelto, {});

    // Prepare share text containing ONLY those items! (squads and players)
    let msg = `👕 *${squadraA}*\n`;
    formatiA.forEach(n => {
      const cleanName = n.replace(" (Esterno)", "");
      msg += `- ${cleanName}\n`;
    });
    msg += `\n👕 *${squadraB}*\n`;
    formatiB.forEach(n => {
      const cleanName = n.replace(" (Esterno)", "");
      msg += `- ${cleanName}\n`;
    });

    navigator.clipboard.writeText(msg.trim());
    alert("Partita Amichevole creata con successo nel sistema! Ricordati di impostare la formazione nella sezione lavagna. Formazioni pronte copiate negli appunti!");

    // Reset forms and exit step
    setData("");
    setOra("");
    setCampo("");
    setNuovoCampo("");
    setCosto("");
    setEsterni([]);
    setLineupStep(false);
  };

  // Submit standard convocations (Campionato / Interna)
  const handleSubmitCampionato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !ora || !campo) {
      alert("Si prega di inserire data, ora e campo da gioco.");
      return;
    }

    if (selezionati.length === 0) {
      alert("Si prega di selezionare almeno un convocato.");
      return;
    }

    const campoScelto = campo === "NUOVO" ? nuovoCampo.trim() : campo;
    if (!campoScelto) {
      alert("Inserire un nome valido per il nuovo campo.");
      return;
    }

    // Format Date from YYYY-MM-DD to DD/MM/YYYY
    const [year, month, day] = data.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    const dettagliDatabase = `${formattedDate} ${ora}, ${campoScelto}` + (avversario ? ` vs ${avversario}` : "");
    const costoTotale = parseFloat(costo) || 0;

    // Structure WhatsApp message
    const rigaAvversario = avversario ? `🆚 *Avversario:* ${avversario}\n` : "";
    let msg = `⚽ *NUOVA CONVOCAZIONE* ⚽\n\n📅 ${formattedDate} *${ora}*\n📍 ${campoScelto}\n${rigaAvversario}💰 Costo: ${costoTotale}€\n\n`;

    // Grouping players by role
    RUOLI.forEach(role => {
      const playersInRole = selezionati.filter(name => ruoliConvocati[name] === role);
      if (playersInRole.length > 0) {
        msg += `*${role.toUpperCase()}*\n`;
        playersInRole.forEach(name => {
          const gInfo = giocatori.find(x => x.nome === name);
          msg += `- ${name} (#${gInfo?.numeroMaglia || "99"})\n`;
        });
        msg += `\n`;
      }
    });

    // Handle players without role
    const withoutRole = selezionati.filter(name => !ruoliConvocati[name] || !RUOLI.includes(ruoliConvocati[name]));
    if (withoutRole.length > 0) {
      msg += `*SENZA RUOLO*\n`;
      withoutRole.forEach(name => {
        const gInfo = giocatori.find(x => x.nome === name);
        msg += `- ${name} (#${gInfo?.numeroMaglia || "99"})\n`;
      });
      msg += `\n`;
    }

    // Create standard game in backend
    await onCreaPartita(costoTotale, selezionati, dettagliDatabase, campoScelto, ruoliConvocati);

    // Copy to clipboard
    navigator.clipboard.writeText(msg.trim());
    alert("Evento Convocazione creato con successo nel sistema! Ricordati di impostare la formazione nella sezione lavagna. Testo pronto per WhatsApp salvato negli appunti!");

    // Reset forms
    setData("");
    setOra("");
    setCampo("");
    setNuovoCampo("");
    setCosto("");
    setAvversario("");
  };

  if (!isEditor) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" id="sezione-convocazioni">
        <div className="bg-slate-900 px-6 py-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>⚽</span> Convocazioni & Gare
          </h2>
          <p className="text-xs text-slate-300">
            Punto di coordinamento partite
          </p>
        </div>
        <div className="p-12 text-center max-w-sm mx-auto space-y-4">
          <div className="text-4xl font-semibold">🔒</div>
          <h3 className="text-lg font-bold text-gray-800 tracking-tight">Area riservata agli amministratori</h3>
        </div>
      </div>
    );
  }

  // Visual layout for dividing players to Team A and Team B (Step 2 of Amichevole)
  if (lineupStep) {
    const tutteUnite = [...selezionati, ...esterni];
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>👕</span> Componi le Formazioni Amichevole
            </h2>
            <p className="text-xs text-slate-300">
              Assegna ciascun partecipante selezionato a una delle due squadre
            </p>
          </div>
          <button
            onClick={() => setLineupStep(false)}
            className="text-slate-300 hover:text-white flex items-center gap-1 text-xs cursor-pointer font-extrabold"
          >
            <ArrowLeft className="h-4 w-4" /> Indietro
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-slate-800 font-medium">
              Hai <b className="font-extrabold">{tutteUnite.length} convocati totali</b>. Puoi dividerli equamente o personalizzarli a mano!
            </div>
            <button
              type="button"
              onClick={handleRandomizeLineup}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Shuffle className="h-3.5 w-3.5" /> Alterna Automatico
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto border border-gray-100 rounded-xl p-4 bg-gray-50/50">
            {tutteUnite.map(nome => {
              const teamSelected = lineupAssignments[nome] || "A";
              const isEst = nome.includes("(Esterno)");
              return (
                <div
                  key={nome}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 bg-white transition-all shadow-xs ${
                    teamSelected === "A" ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-orange-500"
                  }`}
                >
                  <div className="flex flex-col truncate">
                    <span className="font-bold text-gray-800 text-sm truncate">{getLastName(nome)}</span>
                    <span className="text-[10px] uppercase font-bold text-gray-400">
                      {isEst ? "Giocatore Esterno" : "Rosa Interna"}
                    </span>
                  </div>

                  <div className="flex bg-gray-100 p-0.5 rounded-lg shrink-0 select-none">
                    <button
                      type="button"
                      onClick={() => setLineupAssignments({ ...lineupAssignments, [nome]: "A" })}
                      className={`px-3 py-1.5 rounded-md text-xs font-black transition-all cursor-pointer ${
                        teamSelected === "A"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {squadraA}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineupAssignments({ ...lineupAssignments, [nome]: "B" })}
                      className={`px-3 py-1.5 rounded-md text-xs font-black transition-all cursor-pointer ${
                        teamSelected === "B"
                          ? "bg-orange-600 text-white shadow-xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {squadraB}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Formations preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <h4 className="font-extrabold text-blue-900 border-b border-blue-200 pb-1.5 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>👕</span> {squadraA} ({tutteUnite.filter(n => lineupAssignments[n] === "A").length})
              </h4>
              <ul className="space-y-1 text-slate-700 text-xs">
                {tutteUnite.filter(n => lineupAssignments[n] === "A").map(n => <li key={n}>- {n}</li>)}
              </ul>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
              <h4 className="font-extrabold text-orange-950 border-b border-orange-200 pb-1.5 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>👕</span> {squadraB} ({tutteUnite.filter(n => lineupAssignments[n] === "B").length})
              </h4>
              <ul className="space-y-1 text-slate-700 text-xs">
                {tutteUnite.filter(n => lineupAssignments[n] === "B").map(n => <li key={n}>- {n}</li>)}
              </ul>
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={() => setLineupStep(false)}
              className="px-5 py-3 bg-gray-150 hover:bg-gray-200 rounded-xl text-gray-700 font-extrabold text-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> Modifica Invito
            </button>
            <button
              type="button"
              onClick={handleSalvaAmichevole}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="h-5 w-5" /> Salva Amichevole & Copia Formazioni WhatsApp
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" id="sezione-convocazioni">
      <div className="bg-slate-900 px-6 py-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>⚽</span> Gestione Convocazioni & Gare
        </h2>
        <p className="text-xs text-slate-300">
          Programma una partita e genera la convocazione. Puoi scegliere tra Campionato Interno o Match Amichevole.
        </p>
      </div>

      {/* Tabs Selector for Game Modes */}
      <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-1.5">
        <button
          onClick={() => setActiveMode("campionato")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeMode === "campionato"
              ? "bg-white border border-slate-200 text-slate-800 shadow-xs"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
          }`}
        >
          🏆 Campionato / Interna
        </button>
        <button
          onClick={() => setActiveMode("amichevole")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeMode === "amichevole"
              ? "bg-white border border-slate-200 text-slate-800 shadow-xs"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
          }`}
        >
          🤝 Partita Amichevole
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Date, Hour and Field Options (Common fields - shown for both types of matches) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Gara</label>
            <input
              type="date"
              required
              value={data}
              onChange={e => setData(e.target.value)}
              className="w-full text-sm p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ora Calcio d'Inizio</label>
            <input
              type="time"
              required
              value={ora}
              onChange={e => setOra(e.target.value)}
              className="w-full text-sm p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Campo da Gioco</label>
            <select
              required
              value={campo}
              onChange={e => setCampo(e.target.value)}
              className="w-full text-sm p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
            >
              <option value="">Seleziona Campo...</option>
              {campi.map(c => (
                <option key={c} value={c}>
                  {c                }
                </option>
              ))}
              <option value="NUOVO" className="font-bold text-slate-755">
                + Nuovo Campo...
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Costo Totale Campo (€)</label>
            <input
              type="number"
              step="0.01"
              placeholder="es. 60"
              value={costo}
              onChange={e => setCosto(e.target.value)}
              className="w-full text-sm p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>
        </div>

        {/* Conditional text input for new field */}
        {campo === "NUOVO" && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 uppercase mb-1">Nome Nuovo Campo</label>
            <input
              type="text"
              required
              placeholder="es. Impianto Sportivo San Siro"
              value={nuovoCampo}
              onChange={e => setNuovoCampo(e.target.value)}
              className="w-full text-sm p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>
        )}

        {/* Mode Dependent: Campionato vs Amichevole Form */}
        {activeMode === "campionato" ? (
          <form onSubmit={handleSubmitCampionato} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Squadra Avversaria <span className="text-gray-400 font-normal">(lasciare vuoto se interna)</span>
              </label>
              <input
                type="text"
                placeholder="es. Scapoli FC"
                value={avversario}
                onChange={e => setAvversario(e.target.value)}
                className="w-full text-sm p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Users className="h-4 w-4" /> Seleziona Giocatori & Ruoli ({selezionati.length} scelti)
                </h3>
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-xs text-slate-700 font-bold cursor-pointer hover:underline"
                >
                  Invita/Deseleziona Tutti Attivi
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto border border-gray-100 rounded-xl p-4 bg-gray-50">
                {giocatori.map(g => {
                  const checked = selezionati.includes(g.nome);
                  return (
                    <div
                      key={g.nome}
                      className={`p-3 rounded-lg border flex flex-col justify-between gap-2.5 transition-all ${
                        checked
                          ? "bg-slate-50 border-slate-200 text-slate-800 shadow-xs"
                          : "bg-white border-gray-200 text-gray-400 opacity-60"
                      } ${!g.attivo ? "bg-red-50/20 border-red-100" : ""}`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer w-full">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleTogglePlayer(g.nome)}
                          className="w-4 h-4 rounded text-slate-800 focus:ring-slate-500"
                        />
                        <span className="font-bold text-sm truncate flex-1">
                          {g.nome}{" "}
                          <span className="text-[10px] font-mono font-semibold text-indigo-600 bg-indigo-50/50 px-1 py-0.2 rounded border border-indigo-150/40 ml-1">
                            {g.numeroMaglia}
                          </span>
                        </span>
                        {!g.attivo && (
                          <span className="text-[9px] bg-red-150 text-red-700 px-1 py-0.2 rounded font-extrabold uppercase ml-1">
                            Inattivo
                          </span>
                        )}
                      </label>

                      {/* Position role selector */}
                      <div className="flex items-center gap-1.5 border-t border-dashed border-slate-200 pt-2 shrink-0">
                        <span className="text-[10px] uppercase font-semibold text-gray-400">Ruolo:</span>
                        <select
                          disabled={!checked}
                          value={ruoliConvocati[g.nome] || ""}
                          onChange={e => handleRoleChange(g.nome, e.target.value)}
                          className="text-xs p-1 border rounded bg-white font-medium text-gray-700 disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none flex-1"
                        >
                          <option value="">Seleziona...</option>
                          {RUOLI.map(r => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ClipboardCheck className="h-5 w-5" /> Crea Evento & Copia Testo WhatsApp
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Friendly match custom team names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Squadra A</label>
                <input
                  type="text"
                  required
                  placeholder="Noi"
                  value={squadraA}
                  onChange={e => setSquadraA(e.target.value)}
                  className="w-full text-sm p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Squadra B</label>
                <input
                  type="text"
                  required
                  placeholder="Avversari"
                  value={squadraB}
                  onChange={e => setSquadraB(e.target.value)}
                  className="w-full text-sm p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none font-bold"
                />
              </div>
            </div>

            {/* Total Players Counter for Amichevole */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Giocatori Scelti per l'Amichevole</span>
                <span className="text-xs text-slate-600">
                  Consigliato: esattamente <strong>10 giocatori</strong> (rosa interna + esterni)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-base font-black px-3 py-1.5 rounded-lg border transition-colors ${
                  (selezionati.length + esterni.length) === 10
                    ? "bg-slate-800 border-slate-900 text-white"
                    : "bg-amber-100 border-amber-200 text-amber-800"
                }`}>
                  {selezionati.length + esterni.length} / 10 scelti
                </span>
                {(selezionati.length + esterni.length) !== 10 ? (
                  <span className="text-[11px] font-bold text-amber-700">
                    ⚠️ {selezionati.length + esterni.length < 10 ? "Seleziona altri!" : "Troppi giocatori!"}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-700 block">
                    ✅ Perfetto!
                  </span>
                )}
              </div>
            </div>

            {/* Players Checklist (Roster) */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="font-bold text-gray-700">1. Seleziona Convocati Interni ({selezionati.length} scelti)</span>
                </h3>
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-xs text-slate-700 font-bold cursor-pointer hover:underline"
                >
                  Deseleziona/Seleziona Tutti Attivi
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto border border-gray-150 rounded-xl p-3 bg-gray-50">
                {giocatori.map(g => {
                  const checked = selezionati.includes(g.nome);
                  return (
                    <label
                      key={g.nome}
                      className={`p-2.5 rounded-lg border text-xs font-bold flex items-center gap-2.5 cursor-pointer truncate transition-all ${
                        checked
                          ? "bg-white border-slate-305 text-slate-900 shadow-xs"
                          : "bg-gray-100/55 border-gray-200 text-gray-400"
                      } ${!g.attivo ? "bg-red-50/20 border-red-100 cursor-not-allowed opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        disabled={!g.attivo}
                        checked={checked}
                        onChange={() => handleTogglePlayer(g.nome)}
                        className="w-3.5 h-3.5 rounded text-slate-800 focus:ring-slate-500"
                      />
                      <span className="truncate flex-1">{g.nome}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* External players registry */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                2. Aggiungi Giocatori Esterni (Opzionale)
              </h4>
              <p className="text-[10px] text-slate-600 font-medium">
                I giocatori esterni non appartengono alla rosa interna e non subiranno addebiti personali diretti sui saldi, ma influiranno sul conteggio paganti riducendo la quota campo.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="es. Cristiano"
                  value={nuovoEsterno}
                  onChange={e => setNuovoEsterno(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddEsterno();
                    }
                  }}
                  className="flex-1 text-sm p-3 bg-white border border-slate-205 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddEsterno}
                  className="px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-sm shrink-0 shadow-sm transition-colors cursor-pointer"
                >
                  Aggiungi +
                </button>
              </div>

              {/* Badges of added external players */}
              <div className="flex flex-wrap gap-1.5 p-2 bg-white/70 border border-slate-200 rounded-lg min-h-[44px]">
                {esterni.length === 0 ? (
                  <span className="text-[11px] text-gray-400 italic font-medium m-auto">
                    Nessun giocatore esterno aggiunto.
                  </span>
                ) : (
                  esterni.map(n => (
                    <span
                      key={n}
                      className="bg-slate-50 text-slate-800 border border-slate-150 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                    >
                      {n.replace(" (Esterno)", "")}
                      <button
                        type="button"
                        onClick={() => handleRemoveEsterno(n)}
                        className="text-red-600 font-bold text-xs hover:text-red-800"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Advance Button */}
            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleProcediFormazione}
                className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                Procedi alla Formazione 📋
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
