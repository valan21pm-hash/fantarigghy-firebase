import { DatabaseSchema, Giocatore, Partita, Fantasquadra, Consiglio } from "../types";
import { dbServer, collection, getDocs, doc, setDoc, writeBatch } from "./firestore-server";

export async function fetchFromFirestore(): Promise<DatabaseSchema | null> {
  try {
    const giocatoriSnap = await getDocs(collection(dbServer, "giocatori"));
    const campiSnap = await getDocs(collection(dbServer, "campi"));
    const partiteSnap = await getDocs(collection(dbServer, "partite"));
    const logsSnap = await getDocs(collection(dbServer, "logs"));
    const fantasquadreSnap = await getDocs(collection(dbServer, "fantasquadre"));
    const consigliSnap = await getDocs(collection(dbServer, "consigli"));

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

    return {
      giocatori,
      campi,
      partite,
      logs,
      fantasquadre,
      consigli
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

    // A batch can hold up to 500 writes. To be safe, we'll execute it in chunks if necessary.
    const commitBatchIfNeeded = async () => {
      if (count >= 400) {
        await batch.commit();
        count = 0;
      }
    };

    // Replace the collection content by writing documents named by their primary identifier
    // For giocatori, let's use nome encoded as ID or simple strings
    for (const g of db.giocatori) {
      const gRef = doc(dbServer, "giocatori", encodeURIComponent(g.nome));
      batch.set(gRef, g);
      count++;
      await commitBatchIfNeeded();
    }

    // campi
    for (const c of db.campi) {
      const cRef = doc(dbServer, "campi", encodeURIComponent(c));
      batch.set(cRef, { nome: c });
      count++;
      await commitBatchIfNeeded();
    }

    // partite
    for (const p of db.partite) {
      const pRef = doc(dbServer, "partite", p.id);
      batch.set(pRef, p);
      count++;
      await commitBatchIfNeeded();
    }

    // logs - Use data + operazione as ID
    for (const l of db.logs) {
      const key = encodeURIComponent(`${l.data}_${l.operazione}_${l.dettagli}`).slice(0, 100);
      const lRef = doc(dbServer, "logs", key);
      batch.set(lRef, l);
      count++;
      await commitBatchIfNeeded();
    }

    if (db.fantasquadre) {
      for (const fs of db.fantasquadre) {
        const fsRef = doc(dbServer, "fantasquadre", fs.id || fs.nomeFantasquadra);
        batch.set(fsRef, fs);
        count++;
        await commitBatchIfNeeded();
      }
    }

    if (db.consigli) {
      for (const c of db.consigli) {
        const cRef = doc(dbServer, "consigli", c.id);
        batch.set(cRef, c);
        count++;
        await commitBatchIfNeeded();
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    console.log("[Firestore] Database successfully synced to Firebase Firestore (24/7).");
  } catch (err) {
    console.error("[Firestore] Error saving to Firestore:", err);
  }
}
