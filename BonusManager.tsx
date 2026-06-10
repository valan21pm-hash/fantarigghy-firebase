import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, X, Medal, Crown } from "lucide-react";
import { Fantasquadra, Giocatore, Partita, calculatePlayerChampionshipStats, CustomBonusDef, DEFAULT_BONUSES } from "../types";

export interface PodioGraficoDinamicoProps {
  giocatori: Giocatore[];
  fantasquadre: Fantasquadra[];
  partiteChiuse: Partita[];
  rankedTeams: any[]; // The already calculated leaderboard of Fantasquadre
  bonuses?: CustomBonusDef[];
  onClose: () => void;
  targetId: string; // "Tutte", "GiocatoriAssoluti", or "fantasquadra_id"
}

export default function PodioGraficoDinamico({
  giocatori,
  fantasquadre,
  partiteChiuse,
  rankedTeams,
  bonuses = DEFAULT_BONUSES,
  onClose,
  targetId
}: PodioGraficoDinamicoProps) {
  const [step, setStep] = useState(0); // 0 = start, 1 = show 3rd, 2 = show 2nd, 3 = show 1st

  useEffect(() => {
    // Sequenziale: 3° dopo 1s, 2° dopo 2.5s, 1° dopo 4.5s
    const t1 = setTimeout(() => setStep(1), 800);
    const t2 = setTimeout(() => setStep(2), 2500);
    const t3 = setTimeout(() => setStep(3), 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Compute the podium
  let title = "PODIO FANTACALCETTO";
  let subtitle = "Classifica Ufficiale";
  let podiumData = [
    { rank: 1, name: "N/A", score: 0 },
    { rank: 2, name: "N/A", score: 0 },
    { rank: 3, name: "N/A", score: 0 },
  ];

  if (targetId === "Tutte") {
    title = "CLASSIFICA FANTASQUADRE";
    subtitle = "Migliori Team Assoluti";
    const top3 = rankedTeams.slice(0, 3);
    podiumData = top3.map((t, idx) => ({
      rank: idx + 1,
      name: t.nomeFantasquadra,
      score: Number(t.score).toFixed(1)
    }));
  } else if (targetId === "GiocatoriAssoluti") {
    title = "MIGLIORI GIOCATORI";
    subtitle = "Classifica Assoluta Invididuale";
    const scoringPlayers = giocatori.map(g => {
      const stats = calculatePlayerChampionshipStats(g.nome, partiteChiuse, bonuses);
      return { nome: g.nome, score: stats.fantaScore };
    }).sort((a, b) => b.score - a.score);
    
    podiumData = scoringPlayers.slice(0, 3).map((p, idx) => ({
      rank: idx + 1,
      name: p.nome,
      score: p.score.toFixed(1)
    }));
  } else {
    // Specific Fantasquadra
    const fq = fantasquadre.find(f => f.id === targetId);
    if (fq) {
      title = fq.nomeFantasquadra.toUpperCase();
      subtitle = "I Migliori della Rosa";
      const teamPlayers = fq.giocatoriSelezionati.map(nome => {
        const stats = calculatePlayerChampionshipStats(nome, partiteChiuse, bonuses);
        return { nome, score: stats.fantaScore };
      }).sort((a, b) => b.score - a.score);

      podiumData = teamPlayers.slice(0, 3).map((p, idx) => ({
        rank: idx + 1,
        name: p.nome,
        score: p.score.toFixed(1)
      }));
    }
  }

  // Se ci sono meno di 3, riempiamo per evitare crash
  while(podiumData.length < 3) {
      podiumData.push({ rank: podiumData.length + 1, name: "-", score: "0" });
  }

  const p1 = podiumData[0];
  const p2 = podiumData[1];
  const p3 = podiumData[2];

  return (
    <div className="fixed inset-0 bg-indigo-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 z-50 overflow-hidden font-sans">
      
      {/* Intestazione */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-16 relative z-10"
      >
        <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-widest uppercase truncate max-w-xl mx-auto drop-shadow-md">
          {title}
        </h1>
        <p className="text-indigo-300 text-lg md:text-xl font-bold tracking-widest mt-2 uppercase">
          {subtitle}
        </p>
      </motion.div>

      {/* Podio Area */}
      <div className="relative w-full max-w-3xl h-[400px] flex items-end justify-center gap-1 sm:gap-4 md:gap-8 z-10">
        
        {/* 2° Posto (Sinistra) - Appare allo step >= 2 */}
        <div className="flex-1 flex flex-col items-center justify-end h-full max-w-[200px]">
          <AnimatePresence>
            {step >= 2 && (
              <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
                className="w-full flex flex-col items-center"
              >
                <div className="bg-slate-300/10 border border-slate-300/30 w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(203,213,225,0.4)]">
                  <Medal className="w-6 h-6 md:w-8 md:h-8 text-slate-300" />
                </div>
                <div className="text-center mb-4 px-2 w-full">
                  <h3 className="text-white font-black text-sm md:text-xl truncate drop-shadow-md">{p2.name}</h3>
                  <p className="text-slate-300 font-bold text-lg">{p2.score} <span className="text-xs">pt</span></p>
                </div>
                <div className="w-full bg-gradient-to-t from-slate-500/80 to-slate-400/90 rounded-t-xl h-[120px] md:h-[180px] flex items-start justify-center pt-4 shadow-lg border-t-2 border-slate-300/50">
                  <span className="text-white font-black text-4xl opacity-50">2</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 1° Posto (Centro) - Appare allo step >= 3 */}
        <div className="flex-1 flex flex-col items-center justify-end h-full max-w-[220px]">
          <AnimatePresence>
            {step >= 3 && (
              <motion.div 
                initial={{ y: 150, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 90, damping: 12, delay: 0.1 }}
                className="w-full flex flex-col items-center relative z-20"
              >
                {/* Particelle per il primo posto */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="absolute -top-12 opacity-80"
                >
                  <Crown className="w-16 h-16 text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.8)]" />
                </motion.div>

                <div className="bg-yellow-400/20 border-2 border-yellow-400/50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(250,204,21,0.6)] mt-8">
                  <Trophy className="w-8 h-8 md:w-10 md:h-10 text-yellow-400" />
                </div>
                <div className="text-center mb-4 px-2 w-full">
                  <h3 className="text-yellow-300 font-extrabold text-base md:text-2xl truncate drop-shadow-md">{p1.name}</h3>
                  <p className="text-yellow-100 font-black text-xl">{p1.score} <span className="text-xs">pt</span></p>
                </div>
                <div className="w-full bg-gradient-to-t from-yellow-600/90 to-yellow-500 rounded-t-xl h-[160px] md:h-[240px] flex items-start justify-center pt-4 shadow-2xl border-t-2 border-yellow-300/80">
                  <span className="text-yellow-100 font-black text-5xl opacity-80">1</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3° Posto (Destra) - Appare allo step >= 1 */}
        <div className="flex-1 flex flex-col items-center justify-end h-full max-w-[200px]">
          <AnimatePresence>
            {step >= 1 && (
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
                className="w-full flex flex-col items-center"
              >
                <div className="bg-amber-700/20 border border-amber-600/30 w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(180,83,9,0.4)]">
                  <Medal className="w-6 h-6 md:w-8 md:h-8 text-amber-500" />
                </div>
                <div className="text-center mb-4 px-2 w-full">
                  <h3 className="text-white font-black text-sm md:text-xl truncate drop-shadow-md">{p3.name}</h3>
                  <p className="text-amber-400 font-bold text-lg">{p3.score} <span className="text-xs">pt</span></p>
                </div>
                <div className="w-full bg-gradient-to-t from-amber-800/80 to-amber-600/90 rounded-t-xl h-[90px] md:h-[130px] flex items-start justify-center pt-4 shadow-lg border-t-2 border-amber-500/50">
                  <span className="text-white font-black text-4xl opacity-50">3</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Pulsante chiusura */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 5.5, duration: 1 }}
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-8 sm:right-8 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 backdrop-blur-md transition-colors"
      >
        <X className="w-6 h-6" />
      </motion.button>
      
      {/* Istruzione condivisore */}
      <AnimatePresence>
        {step >= 3 && (
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 2.0 }}
             className="absolute bottom-10 left-0 right-0 text-center px-4"
           >
             <p className="text-indigo-300 text-sm italic font-medium">Ora puoi fare uno screenshot e condividerlo ai giocatori!</p>
           </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
