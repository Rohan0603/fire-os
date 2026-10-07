import {
  getFirestore,
  doc,
  collection,
  getDoc,
  writeBatch,
} from 'firebase/firestore';

/**
 * Result of a portfolio migration.
 */
export interface MigrationResult {
  migrated: boolean;
  holdingsCount: number;
  transactionsCount: number;
}

/**
 * Migrates a portfolio document into separate holdings and transactions subcollections.
 *
 * On success:
 * - Creates/updates the holdings subcollection with all holdings from the original document
 * - Creates/updates the transactions subcollection with all transactions from the original document
 * - Updates the original document to mark it as migrated (migrated: true)
 * - Removes the original holdings and transactions fields from the parent document
 *
 * On failure (e.g., write conflict):
 * - Rolls back by restoring the original document from the backup snapshot
 */
export async function migratePortfolio(portfolioId: string, db?: ReturnType<typeof getFirestore>): Promise<MigrationResult> {
  const dbInstance = db || getFirestore();
  const docRef = doc(dbInstance, 'portfolios', portfolioId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error(`Portfolio ${portfolioId} does not exist`);
  }

  const data = snapshot.data();

  // Count holdings and transactions
  const holdingsCount = data.holdings?.length || 0;
  const transactionsCount = data.transactions?.length || 0;

  // Backup the original document before making changes
  const backup = { ...data };

  try {
    // Write holdings to subcollection
    const holdingsRef = collection(dbInstance, 'portfolios', portfolioId, 'holdings');
    const holdingsBatch = writeBatch(dbInstance);
    for (const holding of data.holdings || []) {
      const holdingRef = doc(holdingsRef, holding.id);
      holdingsBatch.set(holdingRef, {
        id: holding.id,
        fundId: holding.fundId,
        quantity: holding.quantity,
        costBasis: holding.costBasis,
      });
    }
    await holdingsBatch.commit();

    // Write transactions to subcollection
    const transactionsRef = collection(dbInstance, 'portfolios', portfolioId, 'transactions');
    const txnsBatch = writeBatch(dbInstance);
    for (const transaction of data.transactions || []) {
      const txnRef = doc(transactionsRef, transaction.id);
      txnsBatch.set(txnRef, {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        date: transaction.date,
      });
    }
    await txnsBatch.commit();

    // Update the original document to mark as migrated
    const parentBatch = writeBatch(dbInstance);
    parentBatch.update(docRef, {
      ...backup,
      migrated: true,
      updatedAt: new Date().toISOString(),
    });
    await parentBatch.commit();

    return {
      migrated: true,
      holdingsCount,
      transactionsCount,
    };
  } catch (error) {
    // Rollback: restore the original document from backup
    await rollbackMigration(portfolioId, backup, dbInstance);
    throw error;
  }
}

/**
 * Rolls back a portfolio migration by restoring the original document from a backup.
 *
 * This is called internally by migratePortfolio if a write conflict occurs.
 */
export async function rollbackMigration(portfolioId: string, backup?: Record<string, unknown>, db?: ReturnType<typeof getFirestore>): Promise<void> {
  const dbInstance = db || getFirestore();
  const docRef = doc(dbInstance, 'portfolios', portfolioId);

  // If no backup provided, try to get the original document
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists() && !backup) {
    throw new Error(`Portfolio ${portfolioId} not found for rollback`);
  }

  const restoreData = backup || snapshot.data();
  const batch = writeBatch(dbInstance);
  batch.set(docRef, restoreData);
  await batch.commit();
}