/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { CheckCircle2, Trophy, AlertTriangle } from "lucide-react";
import { Giocatore, Partita, RefertoGiocatore, getPlayerBonusKey, CustomBonusDef, DEFAULT_BONUSES } from "../types";

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
  onSalvaBozza?: (
    idPartita: string,
    costoFinale: number,
    presenti: string[],
    risultato: string,
    referto: RefertoGiocatore[],
    note?: string
  ) => Promise<void>;
  onAggiungiConvocato?: (idPartita: string, nomeGiocatore: string) => Promise<void>;
  onCreaBackupBozza?: (backup: any) => Promise<void>;
  onEliminaBackupBozza?: (backupId: string) => Promise<void>;
  savedBackups?: any[];
  onAnnullaPartita: (idPartita: string) => Promise<void>;
  isEditor?: boolean;
  selectedMatchId?: string;
  onSelectMatchId?: (id: string) => void;
  bonuses?: CustomBonusDef[];
}

export default function MatchReport({
  giocatori,
  partiteAperte,
  onChiudiPartita,
  onSalvaBozza,
  onAggiungiConvocato,
  onCreaBackupBozza,
  onEliminaBackupBozza,
  savedBackups = [],
  onAnnullaPartita,
  isEditor = false,
  selectedMatchId: externalSelectedMatchId,
  onSelectMatchId,
  bonuses
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
    presentsList?: string[];
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Tabs structure
  const [activeTab, setActiveTab] = useState<"referto" | "generic" | "personal">("referto");
  
  // Verification tracking for Generic and Personal Bonuses
  const [verifiedGeneric, setVerifiedGeneric] = useState<Record<string, boolean>>({});
  const [verifiedPersonal, setVerifiedPersonal] = useState<Record<string, boolean>>({});

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
  const [noEventsPlayers, setNoEventsPlayers] = useState<Record<string, boolean>>({});
  const [extraConvocato, setExtraConvocato] = useState<string>("");
  const [isAddingExtra, setIsAddingExtra] = useState(false);

  const [hasBackedUpDraft, setHasBackedUpDraft] = useState(false);
  const [showBackupsModal, setShowBackupsModal] = useState(false);
  const [tipoInvio, setTipoInvio] = useState<"provvisorio" | "definitivo">("provvisorio");
  const [postSubmitState, setPostSubmitState] = useState<"provvisorio" | "definitivo" | null>(null);

  // Initialize form state when match changes

  const handleBackupBozza = async () => {
    if (!activeMatch) return;
    try {
      const newBackup = {
        id: "backup_" + Date.now(),
        createdAt: new Date().toLocaleString(),
        idPartita: activeMatch.id,
        dettagliPartita: activeMatch.dettagli,
        presents,
        payers,
        costo,
        risultato,
        note,
        goals,
        assists,
        yellows,
        reds,
        subAzione,
        subRigore,
        subPiazzato,
        selectedBonuses,
        statoPresenza,
        sostitutoDa,
        noEventsPlayers,
        verifiedGeneric,
        verifiedPersonal,
      };
      if (onCreaBackupBozza) {
        await onCreaBackupBozza(newBackup);
      }
      setHasBackedUpDraft(true);
      setSuccessMessage("Backup bozza creato e salvato con successo.");
      setTimeout(() => {
         setSuccessMessage(null);
      }, 4000);
    } catch (e: any) {
      setValidationError("Failed to create backup: " + e.message);
    }
  };

  const handleRestoreBackup = (b: any) => {
    if (!window.confirm("Sei sicuro di voler ripristinare questo backup? I dati attualmente inseriti nel referto andranno persi.")) return;
    if (b.idPartita !== activeMatch?.id) {
       if (!window.confirm(`Attenzione! Questo backup fa riferimento a un'altra partita ("${b.dettagliPartita}"). Vuoi procedere comunque?`)) return;
    }
    setPresents(b.presents || []);
    setPayers(b.payers || []);
    setCosto(b.costo || "");
    setRisultato(b.risultato || "");
    setNote(b.note || "");
    setGoals(b.goals || {});
    setAssists(b.assists || {});
    setYellows(b.yellows || {});
    setReds(b.reds || {});
    setSubAzione(b.subAzione || {});
    setSubRigore(b.subRigore || {});
    setSubPiazzato(b.subPiazzato || {});
    setSelectedBonuses(b.selectedBonuses || {});
    setStatoPresenza(b.statoPresenza || {});
    setSostitutoDa(b.sostitutoDa || {});
    setNoEventsPlayers(b.noEventsPlayers || {});
    setVerifiedGeneric(b.verifiedGeneric || {});
    setVerifiedPersonal(b.verifiedPersonal || {});
    setHasBackedUpDraft(true);
    setShowBackupsModal(false);
  };

  const handleDeleteBackup = async (id: string) => {
    if (!window.confirm("Vuoi davvero eliminare definitivamente questo backup della bozza?")) return;
    if (onEliminaBackupBozza) {
      await onEliminaBackupBozza(id);
    }
  };

  // Initialize form state when match changes
  const handleSelectMatch = (id: string) => {
    setSelectedMatchId(id);
    if (onSelectMatchId) onSelectMatchId(id);
    setValidationError(null);
    setSuccessMessage(null);
    setHasBackedUpDraft(false);
    setActiveTab("referto");
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
        const noEventsMap: Record<string, boolean> = {};
        const vGenMap: Record<string, boolean> = {};
        const vPerMap: Record<string, boolean> = {};

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
          
          if (r.verifiedGeneric) vGenMap[r.nome] = true;
          if (r.verifiedPersonal) vPerMap[r.nome] = true;

          // Auto-mark Nessun Evento if they played but have zero stats
          const isPresent = statoPresMap[r.nome] === "giocato";
          const hasStats = r.gol > 0 || r.assist > 0 || r.amm > 0 || r.rossi > 0 || (r.subitiAzione || 0) > 0 || (r.subitiRigore || 0) > 0 || (r.subitiPiazzato || 0) > 0;
          if (isPresent && !hasStats) {
            noEventsMap[r.nome] = true;
          }
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
        setNoEventsPlayers(noEventsMap);
        
        setVerifiedGeneric(vGenMap);
        setVerifiedPersonal(vPerMap);
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
        setVerifiedGeneric({});
        setVerifiedPersonal({});
        setNoEventsPlayers({});
      }
    } else {
      setPresents([]);
      setPayers([]);
      setNote("");
      setSelectedBonuses({});
      setStatoPresenza({});
      setSostitutoDa({});
      setVerifiedGeneric({});
      setVerifiedPersonal({});
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
    const parsed = parseInt(val) || 0;
    if (parsed > 0) {
      setNoEventsPlayers(prev => ({ ...prev, [nome]: false }));
    }
  };

  const buildReferto = (): RefertoGiocatore[] => {
    if (!activeMatch) return [];
    
    const activeSubstitutes = activeMatch.convocati
      .filter(nome => statoPresenza[nome] === "sostituito" && sostitutoDa[nome])
      .map(nome => sostitutoDa[nome]);

    const unconvokedPlayers = giocatori
      .filter(g => g.attivo)
      .filter(g => !activeMatch.convocati.includes(g.nome))
      .filter(g => !activeSubstitutes.includes(g.nome));

    const allPlayersInReport = [...activeMatch.convocati, ...activeSubstitutes, ...unconvokedPlayers.map(g => g.nome)];

    return allPlayersInReport.map(nome => {
      const isConvocato = activeMatch.convocati.includes(nome);
      const isSubstitute = activeSubstitutes.includes(nome);
      
      let pres: "giocato" | "assente" | "sostituito" = "giocato";
      if (isConvocato) {
        pres = statoPresenza[nome] || "giocato";
      } else if (isSubstitute) {
        pres = "giocato";
      } else {
        pres = "assente";
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
        verifiedGeneric: !!verifiedGeneric[nome],
        verifiedPersonal: !!verifiedPersonal[nome],
        snapshotGiocatore: giocatori.find(x => x.nome === nome),
      };
    });
  };

  const handleSalvaBozza = async () => {
    if (!activeMatch || !onSalvaBozza) return;
    try {
      setValidationError(null);
      
      const presentsList: string[] = [];
      activeMatch.convocati.forEach(nome => {
        const state = statoPresenza[nome] || "giocato";
        if (state === "giocato") {
          presentsList.push(nome);
        } else if (state === "sostituito" && sostitutoDa[nome]) {
          presentsList.push(sostitutoDa[nome]);
        }
      });
      
      const costNum = parseFloat(costo) || parseFloat(activeMatch.costo?.toString() || "0");
      const refertoCompleto = buildReferto();

      await onSalvaBozza(
        activeMatch.id,
        costNum,
        presentsList,
        risultato.trim(),
        refertoCompleto,
        note.trim()
      );
      
      setSuccessMessage("Bozza salvata con successo!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setValidationError(`Errore durante il salvataggio della bozza: ${err.message || err}`);
    }
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);
    if (!selectedMatchId || !activeMatch) return;
    
    if (!hasBackedUpDraft) {
      setValidationError("E' obbligatorio effettuare il backup della bozza sul dispositivo prima di procedere all'invio o alla chiusura del referto. Trovi il pulsante 'Backup Bozza di Sicurezza' a fine pagina.");
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return;
    }

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

    // --- Referto Validation Check (At least one stat or Nessun Evento) ---
    const invalidPlayersInReferto: string[] = [];
    presentsList.forEach(nome => {
      const g = giocatori.find(x => x.nome === nome);
      const isPortiere = g?.ultimoRuolo === "Portiere";
      const pGoals = Number(goals[nome]) || 0;
      const pAssists = Number(assists[nome]) || 0;
      const pYellows = Number(yellows[nome]) || 0;
      const pReds = Number(reds[nome]) || 0;
      const pSubAzione = Number(subAzione[nome]) || 0;
      const pSubRigore = Number(subRigore[nome]) || 0;
      const pSubPiazzato = Number(subPiazzato[nome]) || 0;
      
      const hasStatsEvent = pGoals > 0 || pAssists > 0 || pYellows > 0 || pReds > 0 || (isPortiere && (pSubAzione > 0 || pSubRigore > 0 || pSubPiazzato > 0));
      let hasNessunEvento = !!noEventsPlayers[nome];

      // If the user already clicked "Assegna Nessun Bonus/Malus" for this player, 
      // automatically assume "Nessun Evento" to avoid blocking them twice
      if (!hasStatsEvent && !hasNessunEvento && verifiedGeneric[nome]) {
        hasNessunEvento = true;
      }

      if (!hasStatsEvent && !hasNessunEvento) {
        invalidPlayersInReferto.push(nome);
      }
    });

    if (invalidPlayersInReferto.length > 0) {
      setValidationError(
        `Azione bloccata per verifica dettagli: è obbligatorio che ogni singolo giocatore presente a referto abbia registrato almeno un evento/statistica (Gol, Assist, Cartellini) OPPURE sia stata spuntata la casella "Nessun evento".\n\nI seguenti giocatori non hanno alcuno stato definito:\n${invalidPlayersInReferto.map(n => `• ${n}`).join("\n")}\n\nClicca sul nome del giocatore e metti la spunta su "Nessun Evento" se non ha fatto gol/assist o preso cartellini.`
      );
      return;
    }

    // --- Strict Bonus Verification Flow ---
    if (!isAmichevole) {
      const allBonuses = bonuses || DEFAULT_BONUSES;
      const genericBonusIds = allBonuses.filter(b => !b.isPersonale && !b.isAutomatic && !["gen_gol_pivot", "gen_gol_laterale", "gen_gol_centrale", "gen_gol_portiere"].includes(b.id)).map(b => b.id);
      const personalBonusIds = allBonuses.filter(b => b.isPersonale).map(b => b.id);

      const activeGiocatori = giocatori.filter(g => g.attivo);

      const giocatoriMancantiGenerico = activeGiocatori.filter(g => {
        const pBonuses = selectedBonuses[g.nome] || [];
        const hasGeneric = pBonuses.some(bId => genericBonusIds.includes(bId));
        if (hasGeneric) return false;
        return !verifiedGeneric[g.nome];
      });

      const giocatoriMancantiPersonali = activeGiocatori.filter(g => {
        const pBonuses = selectedBonuses[g.nome] || [];
        const hasPersonal = pBonuses.some(bId => personalBonusIds.includes(bId));
        if (hasPersonal) return false;
        return !verifiedPersonal[g.nome];
      });

      if (giocatoriMancantiGenerico.length > 0 || giocatoriMancantiPersonali.length > 0) {
        let errorMsg = "Attenzione / Errore Azione bloccata: è obbligatorio verificare tutti i giocatori per i bonus generici e personali.\n";
        
        if (giocatoriMancantiGenerico.length > 0) {
          const nomiGenerico = giocatoriMancantiGenerico.map(g => g.nome).join(", ");
          errorMsg += `\nRiassunto giocatori mancanti nella sezione Bonus Generici:
  • Mancano all'appello i seguenti giocatori: ${nomiGenerico}.`;
        }
        
        if (giocatoriMancantiPersonali.length > 0) {
          const nomiPersonali = giocatoriMancantiPersonali.map(g => g.nome).join(", ");
          errorMsg += `\nRiassunto giocatori mancanti nella sezione Bonus Personali:
  • Mancano all'appello i seguenti giocatori: ${nomiPersonali}.`;
        }
        
        errorMsg += `\n\nAttenzione: usa il tasto 'Assegna Nessun Bonus/Malus a tutti i rimanenti' in fondo alla tab corrispondente per velocizzare la procedura.`;
        setValidationError(errorMsg);
        return;
      }
    }
    // ------------------------------------------------------

    // Form accurate dynamic list of players to save in the report
    const refertoCompleto = buildReferto();

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
      
      // Store post submission state before clearing
      setPostSubmitState(tipoInvio);

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

            {/* TABS NAVIGATION */}
            <div className="flex border-b border-gray-200 mt-6 mb-4">
              <button
                type="button"
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${
                  activeTab === "referto" 
                    ? "border-slate-800 text-slate-900 bg-slate-50/50" 
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab("referto")}
              >
                1. Referto Gara
              </button>
              {!isAmichevole && (
                <button
                  type="button"
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${
                    activeTab === "generic" 
                      ? "border-slate-800 text-slate-900 bg-slate-50/50" 
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                  }`}
                  onClick={() => setActiveTab("generic")}
                >
                  2. Bonus Generici
                </button>
              )}
              {!isAmichevole && (
                <button
                  type="button"
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${
                    activeTab === "personal" 
                      ? "border-slate-800 text-slate-900 bg-slate-50/50" 
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                  }`}
                  onClick={() => setActiveTab("personal")}
                >
                  3. Bonus Personali
                </button>
              )}
            </div>

            {/* Attendance & stats input list */}
            {activeTab === "referto" && (
            <>
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
                        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-gray-200">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">👕 Giocatori Convocati ({activeMatch.convocati.length})</span>
                          </div>
                          {onAggiungiConvocato && !isAddingExtra && (
                            <button
                              type="button"
                              onClick={() => setIsAddingExtra(true)}
                              className="text-[10px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded border border-orange-200 transition-colors"
                            >
                              + Aggiungi
                            </button>
                          )}
                        </div>
                        {isAddingExtra && (
                          <div className="mb-4 bg-orange-50/50 p-3 rounded-lg border border-orange-100 flex items-center gap-2">
                            <select
                              value={extraConvocato}
                              onChange={(e) => setExtraConvocato(e.target.value)}
                              className="flex-1 text-xs p-2 bg-white border border-gray-200 rounded focus:ring-2 focus:ring-orange-500 font-bold outline-none"
                            >
                              <option value="">-- Seleziona Giocatore Extra --</option>
                              {giocatori
                                .filter(gj => gj.attivo && !activeMatch.convocati.includes(gj.nome))
                                .map(nc => (
                                  <option key={nc.nome} value={nc.nome}>{nc.nome}</option>
                                ))}
                            </select>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!extraConvocato) return;
                                try {
                                  await onAggiungiConvocato?.(activeMatch.id, extraConvocato);
                                  setIsAddingExtra(false);
                                  setExtraConvocato("");
                                  // The match array updates automatically as the component rerenders or data refetches 
                                  // through App.tsx -> useApp(). In case it needs specific sync, onAggiungiConvocato should trigger it.
                                } catch (e) {
                                  alert("Errore");
                                }
                              }}
                              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-3 py-2 rounded transition-colors"
                            >
                              Conferma
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingExtra(false);
                                setExtraConvocato("");
                              }}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs px-3 py-2 rounded transition-colors"
                            >
                              Annulla
                            </button>
                          </div>
                        )}
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
                                  {isPresent && !noEventsPlayers[nome] && pills.length === 0 && (
                                    <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[9px] px-1.5 py-0.5 rounded animate-pulse tracking-wide uppercase">
                                      ⚠️ Da Definire
                                    </span>
                                  )}
                                  {isPresent && noEventsPlayers[nome] && (
                                    <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-[9px] px-1.5 py-0.5 rounded tracking-wide uppercase">
                                      ✔️ Nessun Evento
                                    </span>
                                  )}
                                  {pills.length > 0 ? (
                                    pills.map((p, pIdx) => (
                                      <span key={pIdx} className="bg-gray-150 text-gray-800 font-bold text-[9px] px-1.5 py-0.5 rounded border border-gray-200">
                                        {p}
                                      </span>
                                    ))
                                  ) : (
                                    (!isPresent || !noEventsPlayers[nome]) && (
                                      <span className="text-[10px] text-gray-405 group-hover:text-slate-700 transition-colors flex items-center gap-1 font-semibold uppercase">
                                        {isPresent ? "Dettagli ➔" : state === "assente" ? "Dettagli Extra" : "Reclutato"}
                                      </span>
                                    )
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

              {/* ACTION QUICK FIX ALL NO EVENTS */}
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                 <p className="text-xs text-amber-800 font-bold mb-3">Tutti i giocatori presenti che non hanno né gol, né assist, né cartellini devono obbligatoriamente avere la spunta "Nessun Evento". Se hai fretta, usa questo pulsante:</p>
                 <button
                   type="button"
                   onClick={() => {
                     const newNoEvents = { ...noEventsPlayers };
                     const activeSubstitutes = (activeMatch?.convocati || [])
                       .filter(nome => statoPresenza[nome] === "sostituito" && sostitutoDa[nome])
                       .map(nome => sostitutoDa[nome]);
                     
                     const unconvokedPlayers = giocatori
                       .filter(g => g.attivo)
                       .filter(g => !(activeMatch?.convocati || []).includes(g.nome))
                       .filter(g => !activeSubstitutes.includes(g.nome));
                 
                     const allPlayersInReport = [...(activeMatch?.convocati || []), ...activeSubstitutes, ...unconvokedPlayers.map(g => g.nome)];
                     
                     allPlayersInReport.forEach(nome => {
                       const isConvocato = (activeMatch?.convocati || []).includes(nome);
                       const isSubstitute = activeSubstitutes.includes(nome);
                       let pres = "giocato";
                       if (isConvocato) {
                         pres = statoPresenza[nome] || "giocato";
                       } else if (isSubstitute) {
                         pres = "giocato";
                       } else {
                         pres = "assente";
                       }
                       const isPresent = pres === "giocato";
                 
                       const g = giocatori.find(x => x.nome === nome);
                       const isPortiere = g?.ultimoRuolo === "Portiere";
                       const pGoals = Number(goals[nome]) || 0;
                       const pAssists = Number(assists[nome]) || 0;
                       const pYellows = Number(yellows[nome]) || 0;
                       const pReds = Number(reds[nome]) || 0;
                       const pSubAzione = Number(subAzione[nome]) || 0;
                       const pSubRigore = Number(subRigore[nome]) || 0;
                       const pSubPiazzato = Number(subPiazzato[nome]) || 0;
                       
                       const hasStatsEvent = pGoals > 0 || pAssists > 0 || pYellows > 0 || pReds > 0 || (isPortiere && (pSubAzione > 0 || pSubRigore > 0 || pSubPiazzato > 0));
                       
                       if (isPresent && !hasStatsEvent) {
                         newNoEvents[nome] = true;
                       }
                     });
                     setNoEventsPlayers(newNoEvents);
                   }}
                   className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-xs uppercase tracking-wider rounded-lg shadow-sm cursor-pointer"
                 >
                   ✨ Imposta "Nessun Evento" ai restanti giocatori
                 </button>
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
              
              const allBonuses = bonuses || DEFAULT_BONUSES;
              const currentGenericBonuses = allBonuses.filter(b => !b.isPersonale);
              const isCurrentlyPlaying = currentStato === "giocato";
              const isPayer = payers.includes(nome);
              const bonusKey = getPlayerBonusKey(nome);
              const baseBonuses = bonusKey ? allBonuses.filter(b => b.isPersonale && b.giocatoreId === bonusKey) : [];

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
                          {/* "Nessun Evento" Checkbox Option */}
                          <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 mb-2">
                            <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-amber-950 select-none">
                              <input
                                type="checkbox"
                                checked={!!noEventsPlayers[nome]}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setNoEventsPlayers(prev => ({ ...prev, [nome]: checked }));
                                  if (checked) {
                                    setGoals(prev => ({ ...prev, [nome]: "" }));
                                    setAssists(prev => ({ ...prev, [nome]: "" }));
                                    setYellows(prev => ({ ...prev, [nome]: "" }));
                                    setReds(prev => ({ ...prev, [nome]: "" }));
                                    setSubAzione(prev => ({ ...prev, [nome]: "" }));
                                    setSubRigore(prev => ({ ...prev, [nome]: "" }));
                                    setSubPiazzato(prev => ({ ...prev, [nome]: "" }));
                                  }
                                }}
                                className="w-5 h-5 text-amber-700 focus:ring-amber-500 rounded border-amber-300 cursor-pointer"
                              />
                              <div className="flex flex-col">
                                <span className="font-extrabold text-amber-950 text-sm">Nessun Evento / Statistica</span>
                                <span className="text-[10px] text-amber-800/80 font-medium">Spunta questa casella se il giocatore ha giocato senza registrare gol, assist o cartellini.</span>
                              </div>
                            </label>
                          </div>

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
                                <div className="flex gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={assists[nome] || ""}
                                    onChange={e => handleStatNumberInput(nome, e.target.value, setAssists)}
                                    className="w-full text-xs p-2 text-center border rounded-lg font-bold bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const current = selectedBonuses[nome] || [];
                                      const hasMerda = current.includes("gen_assist_merda");
                                      setSelectedBonuses(prev => ({
                                        ...prev,
                                        [nome]: hasMerda 
                                          ? current.filter(b => b !== "gen_assist_merda") 
                                          : [...current.filter(b => b !== "gen_assist_extra"), "gen_assist_merda"]
                                      }));
                                    }}
                                    className={`w-9 flex items-center justify-center rounded-lg border text-base transition-colors shrink-0 ${
                                      (selectedBonuses[nome] || []).includes("gen_assist_merda")
                                        ? "bg-amber-100 border-amber-300 shadow-inner grayscale-0 opacity-100"
                                        : "bg-slate-50 border-slate-200 opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
                                    }`}
                                    title="Assist della merda (💩)"
                                  >
                                    💩
                                  </button>
                                </div>
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
            </>
            )}

            {/* TABS CONTENT: BONUS GENERICI */}
            {activeTab === "generic" && (
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2">
                    🛡️ Assegnazione Bonus Generici
                  </h3>
                  <div className="space-y-2">
                    {(bonuses || DEFAULT_BONUSES).filter(b => !b.isPersonale && !b.isAutomatic && !["gen_gol_pivot", "gen_gol_laterale", "gen_gol_centrale", "gen_gol_portiere"].includes(b.id)).map(b => (
                      <details key={b.id} className="bg-white border text-sm border-gray-200 rounded-lg group">
                        <summary className="p-3 cursor-pointer font-bold text-slate-800 group-open:border-b border-gray-100 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span>{b.nome} {typeof b.punti === 'number' ? (b.punti > 0 ? `(+${b.punti}pt)` : `(${b.punti}pt)`) : ''}</span>
                            <span className="text-[10px] text-gray-500 font-medium">{b.descrizione}</span>
                          </div>
                          <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="p-3 bg-gray-50 max-h-[300px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {giocatori.filter(g => g.attivo).map(g => {
                             const isChecked = (selectedBonuses[g.nome] || []).includes(b.id);
                             return (
                               <label key={`${b.id}-${g.nome}`} className="flex items-center gap-2 p-2 bg-white border border-gray-150 rounded cursor-pointer hover:bg-gray-50">
                                 <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleBonus(g.nome, b.id)}
                                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                                 />
                                 <span className="text-xs font-bold text-gray-800 truncate">{g.nome}</span>
                               </label>
                             )
                          })}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>

                <div className="bg-yellow-50/50 border border-yellow-200/50 rounded-xl p-4">
                   <h3 className="text-xs font-extrabold text-yellow-800 uppercase tracking-widest border-b border-yellow-200/50 pb-2 mb-3">
                     ⚠️ Giocatori Senza Bonus Generici
                   </h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4 max-h-[160px] overflow-y-auto">
                     {giocatori.filter(g => g.attivo).map(g => {
                       const pBonuses = selectedBonuses[g.nome] || [];
                       const hasGeneric = pBonuses.some(bId => (bonuses || DEFAULT_BONUSES).find(b => b.id === bId && !b.isPersonale && !b.isAutomatic && !["gen_gol_pivot", "gen_gol_laterale", "gen_gol_centrale", "gen_gol_portiere"].includes(b.id)));
                       if (hasGeneric) return null;
                       
                       return (
                         <label key={`ver-gen-${g.nome}`} className="flex items-center gap-2 p-2 bg-white border border-yellow-200/50 rounded cursor-pointer">
                           <input
                              type="checkbox"
                              checked={!!verifiedGeneric[g.nome]}
                              onChange={(e) => setVerifiedGeneric(prev => ({ ...prev, [g.nome]: e.target.checked }))}
                              className="w-4 h-4 text-yellow-600 rounded cursor-pointer"
                           />
                           <span className="text-xs font-bold text-gray-700 truncate">{g.nome} - Nessuno</span>
                         </label>
                       )
                     })}
                   </div>
                   
                   <button
                     type="button"
                     onClick={() => {
                       const newVer = { ...verifiedGeneric };
                       giocatori.filter(g => g.attivo).forEach(g => {
                         const pBonuses = selectedBonuses[g.nome] || [];
                         const hasGeneric = pBonuses.some(bId => (bonuses || DEFAULT_BONUSES).find(b => b.id === bId && !b.isPersonale && !b.isAutomatic && !["gen_gol_pivot", "gen_gol_laterale", "gen_gol_centrale", "gen_gol_portiere"].includes(b.id)));
                         if (!hasGeneric) newVer[g.nome] = true;
                       });
                       setVerifiedGeneric(newVer);
                     }}
                     className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-black text-xs uppercase tracking-wider rounded-lg shadow-sm cursor-pointer"
                   >
                     ✨ Assegna "Nessun Bonus/Malus" a tutti i rimanenti
                   </button>
                </div>
              </div>
            )}

            {/* TABS CONTENT: BONUS PERSONALI */}
            {activeTab === "personal" && (
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2">
                    🎒 Bonus Personali
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
                    {giocatori.filter(g => g.attivo).map(g => {
                      const bonusKey = getPlayerBonusKey(g.nome);
                      const baseBonuses = bonusKey ? (bonuses || DEFAULT_BONUSES).filter(b => b.isPersonale && b.giocatoreId === bonusKey) : [];
                      
                      return (
                        <div key={`bp-${g.nome}`} className="bg-white border border-gray-200 rounded-lg p-3">
                           <h4 className="text-xs font-black text-gray-800 pb-1.5 border-b border-gray-100 mb-2 truncate">{g.nome}</h4>
                           {baseBonuses.length === 0 ? (
                             <p className="text-[10px] text-gray-400 font-medium italic">Nessun bonus personale configurato.</p>
                           ) : (
                             <div className="space-y-1.5 mb-2">
                               {baseBonuses.map(b => {
                                  const isChecked = (selectedBonuses[g.nome] || []).includes(b.id);
                                  return (
                                    <label key={b.id} className="flex flex-start gap-2 p-1.5 bg-gray-50 border border-gray-150 rounded cursor-pointer hover:bg-white transition-colors">
                                      <input
                                         type="checkbox"
                                         checked={isChecked}
                                         onChange={() => handleToggleBonus(g.nome, b.id)}
                                         className="w-3.5 h-3.5 mt-0.5 text-emerald-600 rounded cursor-pointer"
                                      />
                                      <div className="leading-tight min-w-0">
                                        <span className="text-xs font-bold text-slate-800 block truncate">{b.nome}</span>
                                      </div>
                                    </label>
                                  )
                               })}
                             </div>
                           )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-yellow-50/50 border border-yellow-200/50 rounded-xl p-4">
                   <h3 className="text-xs font-extrabold text-yellow-800 uppercase tracking-widest border-b border-yellow-200/50 pb-2 mb-3">
                     ⚠️ Giocatori Senza Bonus Personali
                   </h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4 max-h-[160px] overflow-y-auto">
                     {giocatori.filter(g => g.attivo).map(g => {
                       const pBonuses = selectedBonuses[g.nome] || [];
                       const hasPersonal = pBonuses.some(bId => (bonuses || DEFAULT_BONUSES).find(b => b.id === bId && b.isPersonale));
                       if (hasPersonal) return null;
                       
                       return (
                         <label key={`ver-pers-${g.nome}`} className="flex items-center gap-2 p-2 bg-white border border-yellow-200/50 rounded cursor-pointer">
                           <input
                              type="checkbox"
                              checked={!!verifiedPersonal[g.nome]}
                              onChange={(e) => setVerifiedPersonal(prev => ({ ...prev, [g.nome]: e.target.checked }))}
                              className="w-4 h-4 text-yellow-600 rounded cursor-pointer"
                           />
                           <span className="text-xs font-bold text-gray-700 truncate">{g.nome} - Nessuno</span>
                         </label>
                       )
                     })}
                   </div>
                   
                   <button
                     type="button"
                     onClick={() => {
                       const newVer = { ...verifiedPersonal };
                       giocatori.filter(g => g.attivo).forEach(g => {
                         const pBonuses = selectedBonuses[g.nome] || [];
                         const hasPersonal = pBonuses.some(bId => (bonuses || DEFAULT_BONUSES).find(b => b.id === bId && b.isPersonale));
                         if (!hasPersonal) newVer[g.nome] = true;
                       });
                       setVerifiedPersonal(newVer);
                     }}
                     className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-black text-xs uppercase tracking-wider rounded-lg shadow-sm cursor-pointer"
                   >
                     ✨ Assegna "Nessun Bonus/Malus" a tutti i rimanenti
                   </button>
                </div>
              </div>
            )}

            {/* Backup actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleBackupBozza}
                className="flex-1 py-3 bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-200 font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>💾</span> Backup Bozza di Sicurezza
              </button>
              <button
                type="button"
                onClick={() => setShowBackupsModal(true)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>📂</span> Recupera un Backup ({savedBackups.length})
              </button>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <button
                type="submit"
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 rounded-xl text-white text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer font-bold"
              >
                <CheckCircle2 className="h-5 w-5" /> Chiudi Partita & Addebita Quote
              </button>
              {onSalvaBozza && (
                <button
                  type="button"
                  onClick={handleSalvaBozza}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-800 text-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer font-bold"
                >
                  💾 Salva Bozza
                </button>
              )}
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

              <div className="pt-2">
                <p className="text-[11px] font-bold text-gray-800 mb-2">Tipologia Invio Referto:</p>
                <div className="flex flex-col gap-2">
                  <label className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${tipoInvio === 'provvisorio' ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-200'}`}>
                    <input type="radio" value="provvisorio" checked={tipoInvio === 'provvisorio'} onChange={() => setTipoInvio("provvisorio")} className="accent-indigo-600 w-4 h-4" />
                    <div>
                      <p className="font-bold text-xs text-indigo-900">Provvisorio</p>
                      <p className="text-[10px] text-indigo-700">In attesa pagelle e bonus ATLeague.</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${tipoInvio === 'definitivo' ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-gray-200'}`}>
                    <input type="radio" value="definitivo" checked={tipoInvio === 'definitivo'} onChange={() => setTipoInvio("definitivo")} className="accent-emerald-600 w-4 h-4" />
                    <div>
                      <p className="font-bold text-xs text-emerald-900">Definitivo</p>
                      <p className="text-[10px] text-emerald-700">Dati completi e pronti per l'archivio.</p>
                    </div>
                  </label>
                </div>
              </div>

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
      {/* Backups List Modal */}
      {showBackupsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-800 p-4 font-bold text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>📂</span>
                <span>Recupero Backup Bozza</span>
              </div>
              <button onClick={() => setShowBackupsModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-gray-50">
              {savedBackups.length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-6">Non ci sono backup salvati su questo dispositivo.</p>
              ) : (
                savedBackups.map((bak: any) => (
                  <div key={bak.id} className="bg-white border text-left border-gray-200 rounded-xl p-3 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-gray-900 leading-tight mb-1">{bak.dettagliPartita}</p>
                      <p className="text-[10px] text-gray-500 font-medium">Salvato il: {bak.createdAt}</p>
                      <p className="text-[10px] text-indigo-600 font-bold mt-1">Risultato inserito: {bak.risultato || "N/D"}</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                       <button onClick={() => handleRestoreBackup(bak)} className="flex-1 sm:flex-none text-[10px] font-bold px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded transition-colors">
                         Ripristina
                       </button>
                       <button onClick={() => handleDeleteBackup(bak.id)} className="flex-1 sm:flex-none text-[10px] font-bold px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded transition-colors">
                         Elimina
                       </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 bg-white border-t border-gray-100">
               <button
                 type="button"
                 onClick={() => setShowBackupsModal(false)}
                 className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
               >
                 Chiudi
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Submit Modal */}
      {postSubmitState && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border ${postSubmitState === 'provvisorio' ? 'border-indigo-100' : 'border-emerald-100'} animate-in fade-in zoom-in-95 duration-200 text-center`}>
            <div className={`p-6 space-y-4 ${postSubmitState === 'provvisorio' ? 'bg-indigo-50' : 'bg-emerald-50'}`}>
              <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-white shadow-sm mb-2 text-2xl">
                {postSubmitState === 'provvisorio' ? '⏳' : '✅'}
              </div>
              <h3 className={`font-black text-lg leading-tight ${postSubmitState === 'provvisorio' ? 'text-indigo-900' : 'text-emerald-900'}`}>
                {postSubmitState === 'provvisorio' ? 'Referto Provvisorio Inviato' : 'Referto Definitivo Archiviato'}
              </h3>
              <p className={`text-sm font-medium leading-relaxed ${postSubmitState === 'provvisorio' ? 'text-indigo-800' : 'text-emerald-800'}`}>
                {postSubmitState === 'provvisorio' 
                  ? "Il referto è stato inviato come Provvisorio. Restiamo in attesa che vengano pubblicate le pagelle ufficiali di ATLeague per aggiornare bonus/malus e consolidare definitivamente le statistiche della partita."
                  : "Referto aggiornato e reso Definitivo! Tutti i dati (compresi i bonus/malus delle pagelle) sono stati acquisiti con successo. Il referto ora è ufficialmente consolidato a sistema."}
              </p>
            </div>
            <div className="p-4 bg-white">
              <button
                onClick={() => setPostSubmitState(null)}
                className={`w-full py-3 font-extrabold text-sm rounded-xl shadow-sm transition-colors cursor-pointer ${postSubmitState === 'provvisorio' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
              >
                Chiudi Notifica
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
