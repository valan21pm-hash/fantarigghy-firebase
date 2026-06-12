import React, { useState } from "react";
import { PlusCircle, Save, Trash2, Edit2, CheckCircle, XCircle } from "lucide-react";
import { CustomBonusDef, Giocatore, getPlayerBonusKey } from "../types";

interface BonusManagerProps {
  bonuses: CustomBonusDef[];
  giocatori: Giocatore[];
  isEditor: boolean;
  onUpdateBonuses?: (bonuses: CustomBonusDef[]) => Promise<any>;
}

export default function BonusManager({ bonuses, giocatori, isEditor, onUpdateBonuses }: BonusManagerProps) {
  const [localBonuses, setLocalBonuses] = useState<CustomBonusDef[]>(bonuses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Sync state if the bonuses prop changes from the server
  React.useEffect(() => {
    setLocalBonuses(bonuses);
  }, [bonuses]);

  const handleAdd = () => {
    const newBonus: CustomBonusDef = {
      id: `bonus_${Date.now()}`,
      nome: "Nuovo Bonus",
      descrizione: "Descrizione del bonus",
      punti: 1,
      isPersonale: false
    };
    setLocalBonuses([...localBonuses, newBonus]);
    setEditingId(newBonus.id);
  };

  const handleUpdate = (id: string, field: keyof CustomBonusDef, value: any) => {
    setLocalBonuses(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questo bonus/malus?")) {
      setLocalBonuses(prev => prev.filter(b => b.id !== id));
    }
  };

  const saveToDb = async () => {
    if (!onUpdateBonuses) return;
    setIsSaving(true);
    try {
      await onUpdateBonuses(localBonuses);
      setSuccessMsg("Regolamento bonus aggiornato con successo!");
      setTimeout(() => setSuccessMsg(""), 3000);
      setEditingId(null);
    } catch (e) {
      alert("Errore durante il salvataggio.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 p-4 sm:p-6 shadow-xl w-full mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>⚖️</span> Regolamento Bonus e Malus
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Gestisci tutti i modificatori punteggio.
          </p>
        </div>
        {isEditor && (
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> Aggiungi
            </button>
            <button
              onClick={saveToDb}
              disabled={isSaving}
              className="bg-yellow-500 hover:bg-yellow-400 text-emerald-950 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {isSaving ? "Salvataggio..." : "Salva Tutto"}
            </button>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="mb-4 bg-emerald-900/40 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl flex items-center justify-between text-sm transition-all shadow-md">
           <div className="flex items-center gap-2">
             <CheckCircle className="w-4 h-4 text-emerald-400" />
             <span className="font-medium drop-shadow-sm">{successMsg}</span>
           </div>
        </div>
      )}

      <div className="space-y-4">
        {[...localBonuses].sort((a, b) => (a.isAutomatic ? 1 : 0) - (b.isAutomatic ? 1 : 0)).map(bonus => {
          const isEditing = editingId === bonus.id && !bonus.isAutomatic;
          return (
            <div key={bonus.id} className={`p-4 rounded-xl border ${isEditing ? 'bg-slate-800 border-indigo-500' : 'bg-slate-800/50 border-slate-700'}`}>
              {isEditing && isEditor ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Titolo Bonus/Malus</label>
                      <input
                        type="text"
                        value={bonus.nome}
                        onChange={e => handleUpdate(bonus.id, "nome", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Punti Fissi</label>
                      <input
                        type="number"
                        step="0.5"
                        value={bonus.punti || 0}
                        onChange={e => handleUpdate(bonus.id, "punti", parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Descrizione</label>
                    <input
                      type="text"
                      value={bonus.descrizione}
                      onChange={e => handleUpdate(bonus.id, "descrizione", e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Moltiplicatore Gol (Opz.)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={bonus.moltiplicatoreGol || ""}
                        placeholder="Es. 1 per +1 ogni gol"
                        onChange={e => handleUpdate(bonus.id, "moltiplicatoreGol", e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Moltiplicatore Assist (Opz.)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={bonus.moltiplicatoreAssist || ""}
                        placeholder="Es. 0.5 per +0.5 x assist"
                        onChange={e => handleUpdate(bonus.id, "moltiplicatoreAssist", e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-700 flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bonus.isPersonale}
                        onChange={e => handleUpdate(bonus.id, "isPersonale", e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-300">Assegna Personale</span>
                    </label>

                    {bonus.isPersonale && (
                      <select
                        value={bonus.giocatoreId || ""}
                        onChange={e => handleUpdate(bonus.id, "giocatoreId", e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                      >
                        <option value="">-- Seleziona Giocatore --</option>
                        {giocatori.map(g => (
                          <option key={g.nome} value={getPlayerBonusKey(g.nome) || g.nome.toLowerCase().replace(/\s+/g, "_")}>{g.nome}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Fatto
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {bonus.nome}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${bonus.punti && bonus.punti > 0 ? "bg-emerald-500/20 text-emerald-300" : bonus.punti && bonus.punti < 0 ? "bg-red-500/20 text-red-300" : "bg-slate-500/20 text-slate-300"}`}>
                        {bonus.punti != null && bonus.punti !== 0 ? (bonus.punti > 0 ? `+${bonus.punti}` : bonus.punti) : "Variabile"}
                      </span>
                      {bonus.isPersonale && <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full">Personale</span>}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">{bonus.descrizione}</p>
                    
                    {(bonus.moltiplicatoreGol || bonus.moltiplicatoreAssist) && (
                      <div className="mt-2 flex gap-2">
                        {bonus.moltiplicatoreGol && <span className="bg-slate-900 border border-slate-700 text-slate-300 text-xs px-2 py-1 rounded">Moltiplicatore Gol: x{bonus.moltiplicatoreGol}</span>}
                        {bonus.moltiplicatoreAssist && <span className="bg-slate-900 border border-slate-700 text-slate-300 text-xs px-2 py-1 rounded">Moltiplicatore Assist: x{bonus.moltiplicatoreAssist}</span>}
                      </div>
                    )}
                    
                    {bonus.isPersonale && bonus.giocatoreId && (
                      <div className="mt-2 bg-slate-900 border border-slate-700 text-slate-300 text-xs px-2 py-1 rounded inline-block">
                        Assegnato a: <strong>{bonus.giocatoreId.replace(/_/g, " ")}</strong>
                      </div>
                    )}
                  </div>
                  
                  {isEditor && !bonus.isAutomatic && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setEditingId(bonus.id)} className="text-slate-400 hover:text-white p-2">
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDelete(bonus.id)} className="text-slate-400 hover:text-red-500 p-2">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                  {bonus.isAutomatic && (
                    <div className="flex shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Sistema (Automatico)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
