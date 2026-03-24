import { db, type DocumentRecord } from '@/lib/database';
import { documentIntelligenceService } from './documentIntelligenceService';

export class DocumentManagementService {
  async createDocumentRecord(file: File, accountId?: number): Promise<number> {
    return documentIntelligenceService.createDocumentRecord({
      documentType: 'receipt',
      file,
      processingStatus: 'processing',
      accountId: accountId ?? undefined,
    });
  }

  async updateDocumentStatus(
    documentId: number,
    status: DocumentRecord['processingStatus'],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await documentIntelligenceService.updateDocumentRecord(documentId, {
      processingStatus: status,
      ...metadata,
    });
  }

  async linkTransaction(documentId: number, transactionId: number): Promise<void> {
    await db.transaction('rw', db.documents, db.transactions, async () => {
      const transaction = await db.transactions.get(transactionId);
      const document = await db.documents.get(documentId);
      const importMetadata = {
        ...(transaction?.importMetadata ?? {}),
        'Document Id': String(documentId),
      };

      await documentIntelligenceService.updateDocumentRecord(documentId, {
        processingStatus: 'completed',
        linkedTransactionId: transactionId,
        metadata: {
          ...(document?.metadata ?? {}),
          'Document Id': String(documentId),
        },
      });

      if (transaction?.id) {
        await db.transactions.update(transaction.id, {
          attachment: `document:${documentId}`,
          importMetadata,
          updatedAt: new Date(),
        });
      }
    });
  }

  async markAsFailed(documentId: number): Promise<void> {
    await documentIntelligenceService.updateDocumentRecord(documentId, {
      processingStatus: 'failed',
    });
  }

  async getDocument(documentId: number): Promise<DocumentRecord | undefined> {
    return db.documents.get(documentId);
  }

  async getLinkedReceipt(transactionId: number): Promise<DocumentRecord | undefined> {
    return db.documents
      .filter((document) => document.documentType === 'receipt' && document.linkedTransactionId === transactionId)
      .first();
  }
}
