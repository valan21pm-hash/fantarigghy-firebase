import { DatabaseSchema, Giocatore, Partita, Fantasquadra, Consiglio } from "../types";
import { dbServer, collection, getDocs, doc, setDoc, writeBatch, getDoc } from "./firestore-server";

export async function fetchFromFirestore(): Promise<DatabaseSchema | null> {
  try {
    const giocatoriSnap = await getDocs(collection(dbServer, "giocatori"));
    const campiSnap = await getDocs(collection(dbServer, "campi"));
    const partiteSnap = await getDocs(collection(dbServer, "partite"));
    const logsSnap = await getDocs(collection(dbServer, "logs"));
    const fantasquadreSnap = await getDocs(collection(dbServer, "fantasquadre"));
    const consigliSnap = await getDocs(collection(dbServer, "consigli"));
    const settingsSnap = await getDoc(doc(dbServer, "system", "settings"));

    // If completely empty, we assume no data is there yet
    if (giocatoriSnap.empty && partiteSnap.empty && fantasquadreSnap.empty) {
      return null;
    }

    const giocatori = giocatoriSnap.docs.map(d => d.data() as Giocatore);
    const campi = campiSnap.docs.map(d => d.data().nome as string);
    const partite = partiteSnap.docs.map(d => d.data() as Partita);
    const logs = logsSnap.docs.map(d => d.data() as any);
    const fantasquadre = fantasquadreSnap.docs.map(d => d.data() as Fantasquadra);
    const consigli = consigliSnap.docs.map(d => d.data() as Consiglio);
    const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};

    return {
      giocatori,
      campi,
      partite,
      logs,
      fantasquadre,
      consigli,
      sessioneMercatoLibero: settingsData.sessioneMercatoLibero || false,
      scadenzaMercatoLibero: settingsData.scadenzaMercatoLibero || null,
      bonuses: settingsData.bonuses || undefined
    };
  } catch (err) {
    console.error("[Firestore] Error fetching from Firestore:", err);
    return null;
  }
}

export async function saveToFirestore(db: DatabaseSchema): Promise<void> {
  try {
    const batch = writeBatch(dbServer);
    let count = 0;

    const commitBatchIfNeeded = async () => {
      if (count >= 400) {
        await batch.commit();
        count = 0;
      }
    };

    // Helper to get all current ids in a collection
    const getExistingIds = async (collectionName: string) => {
      const snap = await getDocs(collection(dbServer, collectionName));
      return snap.docs.map(d => d.id);
    };

    // 1. Giocatori
    const existingGiocatori = await getExistingIds("giocatori");
    const newGiocatori = db.giocatori.map(g => encodeURIComponent(g.nome));
    for (const id of existingGiocatori.filter(id => !newGiocatori.includes(id))) {
      batch.delete(doc(dbServer, "giocatori", id));
      count++; await commitBatchIfNeeded();
    }
    for (const g of db.giocatori) {
      const gRef = doc(dbServer, "giocatori", encodeURIComponent(g.nome));
      batch.set(gRef, g);
      count++; await commitBatchIfNeeded();
    }

    // 2. Campi
    const existingCampi = await getExistingIds("campi");
    const newCampi = db.campi.map(c => encodeURIComponent(c));
    for (const id of existingCampi.filter(id => !newCampi.includes(id))) {
      batch.delete(doc(dbServer, "campi", id));
      count++; await commitBatchIfNeeded();
    }
    for (const c of db.campi) {
      const cRef = doc(dbServer, "campi", encodeURIComponent(c));
      batch.set(cRef, { nome: c });
      count++; await commitBatchIfNeeded();
    }

    // 3. Partite
    const existingPartite = await getExistingIds("partite");
    const newPartite = db.partite.map(p => p.id);
    for (const id of existingPartite.filter(id => !newPartite.includes(id))) {
      batch.delete(doc(dbServer, "partite", id));
      count++; await commitBatchIfNeeded();
    }
    for (const p of db.partite) {
      const pRef = doc(dbServer, "partite", p.id);
      batch.set(pRef, p);
      count++; await commitBatchIfNeeded();
    }

    // 4. Logs
    const existingLogs = await getExistingIds("logs");
    const newLogs = db.logs.map(l => encodeURIComponent(`${l.data}_${l.operazione}_${l.dettagli}`).slice(0, 100));
    for (const id of existingLogs.filter(id => !newLogs.includes(id))) {
      batch.delete(doc(dbServer, "logs", id));
      count++; await commitBatchIfNeeded();
    }
    for (const l of db.logs) {
      const key = encodeURIComponent(`${l.data}_${l.operazione}_${l.dettagli}`).slice(0, 100);
      const lRef = doc(dbServer, "logs", key);
      batch.set(lRef, l);
      count++; await commitBatchIfNeeded();
    }

    // 5. Fantasquadre
    const existingFanta = await getExistingIds("fantasquadre");
    const newFanta = (db.fantasquadre || []).map(fs => fs.id || fs.nomeFantasquadra);
    for (const id of existingFanta.filter(id => !newFanta.includes(id))) {
      batch.delete(doc(dbServer, "fantasquadre", id));
      count++; await commitBatchIfNeeded();
    }
    if (db.fantasquadre) {
      for (const fs of db.fantasquadre) {
        const fsRef = doc(dbServer, "fantasquadre", fs.id || fs.nomeFantasquadra);
        batch.set(fsRef, fs);
        count++; await commitBatchIfNeeded();
      }
    }

    // 6. Consigli
    const existingConsigli = await getExistingIds("consigli");
    const newConsigli = (db.consigli || []).map(c => c.id);
    for (const id of existingConsigli.filter(id => !newConsigli.includes(id))) {
      batch.delete(doc(dbServer, "consigli", id));
      count++; await commitBatchIfNeeded();
    }
    if (db.consigli) {
      for (const c of db.consigli) {
        const cRef = doc(dbServer, "consigli", c.id);
        batch.set(cRef, c);
        count++; await commitBatchIfNeeded();
      }
    }

    // 7. System Settings
    const settingsRef = doc(dbServer, "system", "settings");
    batch.set(settingsRef, {
      sessioneMercatoLibero: db.sessioneMercatoLibero ?? false,
      scadenzaMercatoLibero: db.scadenzaMercatoLibero || null,
      bonuses: db.bonuses || null
    }, { merge: true });
    count++; await commitBatchIfNeeded();

    if (count > 0) {
      await batch.commit();
    }

    console.log("[Firestore] Database successfully synced to Firebase Firestore (24/7).");
  } catch (err) {
    console.error("[Firestore] Error saving to Firestore:", err);
  }
}
