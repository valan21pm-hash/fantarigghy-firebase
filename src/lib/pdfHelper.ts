import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
    if (kpi.gol > 0) highlights.push(`${kpi.gol} Gol (+${kpi.gol * 3})`);
    if (kpi.assist > 0) highlights.push(`${kpi.assist} Assist (+${kpi.assist * 1})`);
    if (kpi.amm > 0) highlights.push(`${kpi.amm} Amm (-${kpi.amm * 0.5})`);
    if (kpi.rossi > 0) highlights.push(`${kpi.rossi} Esp (-${kpi.rossi * 1})`);
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
    styles: { fontSize: 8 }
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
