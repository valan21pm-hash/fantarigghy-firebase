import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getPlayerBonusPointsForMatch, getPlayerBonusBreakdownForMatch } from "../types";

export const generateMatchPdf = (teamName: string, mb: any) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(0, 50, 0);
  doc.text(`Referto Fantacalcetto`, 14, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`Squadra: ${teamName}`, 14, 30);
  
  // Subtitle (Match details)
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Partita: ${mb.dettagli || "Sconosciuta"}`, 14, 38);
  doc.text(`Risultato Squadra: ${mb.risultato || "0"}`, 14, 44);
  const ptMatch = mb.puntiTotaliMatch || 0;
  doc.text(`Punti Fanta: ${ptMatch > 0 ? "+" : ""}${ptMatch} pt`, 14, 50);

  // Intro text
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const introTxt = "Di seguito e riportato il dettaglio dei calcoli effettuati per ogni giocatore della fantasquadra (titolari effettivi, sostituzioni per assenze e giocatori in panchina).";
  const lines = doc.splitTextToSize(introTxt, 180);
  doc.text(lines, 14, 60);

  // Table of players
  const tableData = (mb.giocatoriKpi || []).map((kpi: any) => {
    let ruolo = kpi.ruolo === "Titolare" ? "Titolare" : "Panchina";
    let subStatus = "";
    
    if (kpi.stato === "Sostituito") subStatus = "Assente (Sostituito)";
    else if (kpi.stato === "Subentrato") subStatus = "Subentrato";
    else if (kpi.stato === "Panchina") subStatus = "Rimasto in Panchina";
    else if (kpi.stato === "Assente") subStatus = "Assente";
    
    const highlights: string[] = [];
    if (kpi.gol > 0) highlights.push(`${kpi.gol} Gol`);
    if (kpi.assist > 0) highlights.push(`${kpi.assist} Assist`);
    if (kpi.amm > 0) highlights.push(`${kpi.amm} Amm`);
    if (kpi.rossi > 0) highlights.push(`${kpi.rossi} Esp`);
    const bonusPts = kpi.bonusPts || 0;
    if (bonusPts !== 0) highlights.push(`Bonus: ${bonusPts > 0 ? "+" : ""}${bonusPts}`);

    const puntiConteggiati = kpi.puntiConteggiati || 0;
    const displayPoints = puntiConteggiati > 0 ? `+${puntiConteggiati}` : `${puntiConteggiati}`;

    return [
      kpi.nome || "Sconosciuto",
      ruolo,
      subStatus,
      highlights.length > 0 ? highlights.join(", ") : "-",
      displayPoints
    ];
  });

  autoTable(doc, {
    startY: 70,
    head: [["Giocatore", "Ruolo Formazione", "Stato Presenza", "Bonus/Malus Calcolati", "Punti Fanta"]],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [4, 120, 87] },
    styles: { fontSize: 8, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 25 }
    }
  });

  let finalY = (doc as any).lastAutoTable?.finalY || 70;
  
  // Explanations about substitutions
  const hasSubs = (mb.giocatoriKpi || []).some((k: any) => k.stato === "Sostituito");
  
  if (hasSubs) {
    doc.setFontSize(9);
    doc.setTextColor(200, 50, 50);
    doc.text("* Attenzione: si e verificata una sostituzione. Un titolare scelto non ha giocato ed e stato sostituito con successo dal giocatore in panchina.", 14, finalY + 10);
  }

  // Save PDF
  doc.save(`Referto_${teamName.replace(/\s+/g, '_')}.pdf`);
};

export const generateGeneralReportPdf = (
  rankedTeams: any[],
  partiteChiuse: any[],
  getTeamMatchBreakdownList: (team: any) => any[]
) => {
  const doc = new jsPDF();
  
  // Header Design
  doc.setFillColor(4, 120, 87); // Primary emerald banner
  doc.rect(0, 0, 210, 42, "F");
  
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("Easy Rigging", 14, 18);
  
  doc.setFontSize(11);
  doc.setTextColor(190, 242, 190);
  doc.text("REFERTO GENERALE FANTACALCETTO (TUTTI I VOTI & CLASSIFICHE)", 14, 26);
  
  doc.setFontSize(9);
  doc.setTextColor(240, 240, 240);
  const now = new Date();
  doc.text(`Report ufficiale generato il: ${now.toLocaleDateString("it-IT")} alle ${now.toLocaleTimeString("it-IT")}`, 14, 34);
  
  // Section 1: Classifica Generale
  let currentY = 52;
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("1. Classifica Generale Aggiornata", 14, currentY);
  currentY += 4;
  
  const leaderboardTable = rankedTeams.map((team, idx) => [
    `${idx + 1}°`,
    team.nomeFantasquadra.toUpperCase(),
    team.nomePartecipante,
    `${team.score} p.ti`
  ]);
  
  autoTable(doc, {
    startY: currentY,
    head: [["Pos", "Fantasquadra", "Presidente / Iscritto", "Punti Fanta Totali"]],
    body: leaderboardTable,
    theme: "striped",
    headStyles: { fillColor: [4, 120, 87] },
    styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 70, overflow: 'linebreak' },
      2: { cellWidth: 65, overflow: 'linebreak' },
      3: { cellWidth: 'auto', halign: 'right' }
    }
  });
  
  currentY = (doc as any).lastAutoTable?.finalY || currentY;
  
  // Section 2: Rose Iscritte
  currentY += 14;
  if (currentY > 260) {
    doc.addPage();
    currentY = 20;
  }
  
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("2. Rose e Composizione Team", 14, currentY);
  currentY += 4;
  
  const squadsData = rankedTeams.map(team => {
    const playersStr = (team.giocatoriSelezionati || []).join(", ");
    const remainingCredits = team.creditoResiduo !== undefined ? `${team.creditoResiduo} Izycoin` : "-";
    return [
      team.nomeFantasquadra.toUpperCase(),
      team.nomePartecipante,
      playersStr,
      remainingCredits
    ];
  });
  
  autoTable(doc, {
    startY: currentY,
    head: [["Fantasquadra", "Presidente", "Composizione Rosa (4 Giocatori)", "Credito Residuo"]],
    body: squadsData,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 45, overflow: 'linebreak' },
      1: { cellWidth: 40, overflow: 'linebreak' },
      2: { cellWidth: 'auto', overflow: 'linebreak' },
      3: { cellWidth: 28, halign: 'center' }
    }
  });
  
  currentY = (doc as any).lastAutoTable?.finalY || currentY;
  
  // Section 3: Referti Giornate
  const validMatches = (partiteChiuse || []).filter(
    m => m.stato === "Chiusa" && m.inviatoFanta === true && !(m.dettagli || "").toLowerCase().includes("amichevole")
  );
  
  if (validMatches.length > 0) {
    doc.addPage();
    currentY = 20;
    
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("3. Referti Dettagliati e Voti Registrati per Partita", 14, currentY);
    currentY += 8;
    
    for (let i = 0; i < validMatches.length; i++) {
      const m = validMatches[i];
      
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(11);
      doc.setTextColor(4, 120, 87);
      doc.text(`Partita #${i + 1}: ${m.dettagli || "Sconosciuta"}`, 14, currentY);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Risultato finale registrato: ${m.risultato || "N.D."}`, 14, currentY + 5);
      currentY += 8;
      
      // Calculate scores for each team in this match
      const matchSquadRows: any[] = [];
      
      rankedTeams.forEach(team => {
        const breakDowns = getTeamMatchBreakdownList(team);
        const thisMatchBreakdown = breakDowns.find(b => b.matchId === m.id);
        
        if (thisMatchBreakdown) {
          const playersScoreStr = (thisMatchBreakdown.giocatoriKpi || []).map((kpi: any) => {
            let roleLabel = kpi.ruolo === "Titolare" ? "Tit." : "Pan.";
            let stateLabel = "";
            if (kpi.stato === "Sostituito") stateLabel = "🚫 Sostituito";
            else if (kpi.stato === "Subentrato") stateLabel = "🔄 Subentrato";
            else if (kpi.stato === "Panchina") stateLabel = "💻 In panchina";
            else if (kpi.stato === "Assente") stateLabel = "❌ Assente";
            else stateLabel = "✅ Attivo";
            
            const displayScore = kpi.puntiConteggiati > 0 ? `+${kpi.puntiConteggiati}` : kpi.puntiConteggiati;
            return `${kpi.nome} (${roleLabel} | ${stateLabel}): ${displayScore} pt`;
          }).join("\n");
          
          matchSquadRows.push([
            team.nomeFantasquadra.toUpperCase(),
            `+${thisMatchBreakdown.puntiTotaliMatch} pt`,
            playersScoreStr
          ]);
        }
      });
      
      autoTable(doc, {
        startY: currentY,
        head: [["Fantasquadra", "Punteggio Giornata", "Dettaglio Calcoli Giocatori (Stato e Punti)"]],
        body: matchSquadRows,
        theme: "grid",
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 45, overflow: 'linebreak' },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 'auto', overflow: 'linebreak' }
        }
      });
      
      currentY = (doc as any).lastAutoTable?.finalY || currentY;
      
      // Real player statistics inside the match
      currentY += 8;
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("Tabella Voti / Statistiche Reali dei Calciatori:", 14, currentY);
      currentY += 4;
      
      const realPlayersRows = (m.referto || []).map((r: any) => {
        const rGol = Number(r.gol) || 0;
        const rAssist = Number(r.assist) || 0;
        const rAmm = Number(r.amm) || 0;
        const rEsp = Number(r.rossi) || 0;
        const rBonusAttivi = r.bonusAttivi || [];
        
        let subStatus = "Giocato (Presenza)";
        if (r.statoPresenza === "assente") subStatus = "Assente";
        else if (r.statoPresenza === "sostituito") subStatus = "Sostituito";
        
        const highlights: string[] = [];
        if (rGol > 0) highlights.push(`${rGol} Gol`);
        if (rAssist > 0) highlights.push(`${rAssist} Assist`);
        if (rAmm > 0) highlights.push(`${rAmm} Ammonito`);
        if (rEsp > 0) highlights.push(`${rEsp} Espulso`);
        
        const bonusPts = getPlayerBonusPointsForMatch(r.nome, rBonusAttivi, rGol, rAssist, undefined, r.snapshotGiocatore?.ultimoRuolo, rAmm, rEsp);
        const breakdown = getPlayerBonusBreakdownForMatch(r.nome, rBonusAttivi, rGol, rAssist, undefined, r.snapshotGiocatore?.ultimoRuolo, rAmm, rEsp);
        if (breakdown.length > 0) {
          const breakdownStr = breakdown.map(b => `${b.nome} (${b.puntiVal > 0 ? "+" : ""}${b.puntiVal})`).join(", ");
          highlights.push(`Bonus Extra: ${breakdownStr} [Totale: ${bonusPts > 0 ? "+" : ""}${bonusPts}]`);
        } else if (bonusPts !== 0) {
          // Fallback in case some bonus wasn't parsed properly
          highlights.push(`Bonus Extra: ${bonusPts > 0 ? "+" : ""}${bonusPts}`);
        }
        
        const displayPtsValue = bonusPts;
        const ptsDisplay = displayPtsValue > 0 ? `+${displayPtsValue}` : `${displayPtsValue}`;
        
        return [
          r.nome,
          subStatus,
          highlights.length > 0 ? highlights.join(", ") : "Nessun bonus/malus",
          `${ptsDisplay} pt`
        ];
      });
      
      autoTable(doc, {
        startY: currentY,
        head: [["Calciatore Reale", "Assiduità / Presenza", "Dettaglio Statistiche Partita", "Punti Fantavoto"]],
        body: realPlayersRows,
        theme: "striped",
        headStyles: { fillColor: [100, 116, 139] },
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 45, overflow: 'linebreak' },
          1: { cellWidth: 35, overflow: 'linebreak' },
          2: { cellWidth: 'auto', overflow: 'linebreak' },
          3: { cellWidth: 25, halign: 'center' }
        }
      });
      
      currentY = (doc as any).lastAutoTable?.finalY || currentY;
      currentY += 15;
    }
  } else {
    currentY += 15;
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Nessun referto ufficiale di campionato ancora registrato.", 14, currentY);
  }
  
  doc.save("Referto_Generale_Easy_Rigging.pdf");
};

export const generatePartitaGiocatoriPdf = (match: any) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setTextColor(0, 50, 0);
  doc.text(`Report Giocatori - ${match.dettagli}`, 14, 20);

  const tableData = (match.referto || []).map((r: any) => {
    return [
      r.nome,
      r.gol || 0,
      r.assist || 0,
      (r.amm ? "Si" : "No"),
      (r.rossi ? "Si" : "No")
    ];
  });

  autoTable(doc, {
    startY: 30,
    head: [["Giocatore", "Gol", "Assist", "Gialli", "Rossi"]],
    body: tableData,
    theme: "grid"
  });

  doc.save(`Report_Giocatori_${match.id}.pdf`);
};

export const generatePartitaSingoloGiocatorePdf = (match: any, playerName: string) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(`Report Giocatore: ${playerName}`, 14, 20);
  doc.setFontSize(12);
  doc.text(`Partita: ${match.dettagli}`, 14, 28);

  const r = (match.referto || []).find((x: any) => x.nome === playerName);
  if (!r) {
    doc.text("Giocatore non trovato a referto.", 14, 40);
  } else {
    doc.text(`Gol: ${r.gol || 0}`, 14, 40);
    doc.text(`Assist: ${r.assist || 0}`, 14, 48);
    doc.text(`Ammonizioni: ${r.amm || 0}`, 14, 56);
    doc.text(`Espulsioni: ${r.rossi || 0}`, 14, 64);
  }

  doc.save(`Report_${playerName.replace(/\s+/g, '_')}_${match.id}.pdf`);
};

export const generatePartitaSquadraPdf = (match: any, teamName: string, mb: any) => {
  generateMatchPdf(teamName, mb);
};
