
    const steps = [
      { prg: 25, text: "Sincronizzazione della formazione..." },
      { prg: 70, text: "Caricamento delle rose e dei saldi..." },
      { prg: 100, text: "Accesso autorizzato!" },
--
      if (authenticatedTeamId !== selectedTeam.id) {
        alert(
          "Devi sbloccare la tua squadra con il PIN per poter modificare la formazione.",
        );
        return;
--
      if (selectedTeam && authenticatedTeamId !== selectedTeam.id) {
        alert(
          "Devi sbloccare la tua squadra con il PIN per poter completare la formazione.",
        );
        return;
--
      setSubmitted(true);
      alert(
        "Operazione completata con successo! La formazione è stata modificata e il mercato è bloccato fino al termine del prossimo turno.",
      );
      window.location.reload();
--
                  <p>
                    • <strong>Nuova Formula:</strong> Crea subito la tua
                    formazione con esattamente{" "}
                    <strong>3 Titolari + 1 Panchinaro</strong> rispettando il
                    budget massimo di 60 Izycoin!
--
                      <p className="bg-red-950/30 border border-red-900/40 rounded-xl p-3 text-[11px] text-red-200">
                        🔔 <strong>PRO-TIP:</strong> Le operazioni di mercato,
                        nuove iscrizioni e modifiche della formazione si{" "}
                        <strong>
                          bloccano rigorosamente alle 23:59 del giorno prima
--
                    ) : (
                      <>
                        Puoi inserire o aggiornare la tua formazione per il
                        turno di campionato del{" "}
                        <span className="font-extrabold text-white">
--
                           </div>
                           <div className="text-center py-4">
                             <p className="text-indigo-200 text-xs font-medium mb-1.5uppercase tracking-wider">Termine Consegna Formazione</p>
                             <div className="font-mono text-xl sm:text-2xl font-black text-yellow-400 tracking-widest bg-indigo-900/40 inline-flex items-center justify-center min-w-[200px] py-2.5 rounded-xl border border-indigo-800/80 shadow-md">
                               {timeLeft || "SCADUTO"}
--
              <div className="bg-indigo-900/30 border-l-4 border-sky-500 p-4 rounded-r-xl font-sans mt-2 shadow-sm">
                <p className="text-xs text-indigo-200 leading-relaxed font-medium">
                  <strong className="text-sky-400">ℹ️ Come Schierare la Formazione:</strong> Assicurati di schierare i 4 giocatori ogni settimana (prima che scada il tempo indicato)! Se un tuo titolare non giocherà la partita prenderà s.v. e verrà sostituito in automatico dal voto del tuo giocatore in panchina.
                </p>
              </div>
