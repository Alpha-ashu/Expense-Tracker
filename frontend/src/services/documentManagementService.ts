import { documentIntelligenceService } from './documentIntelligenceService';
import type { DocumentRecord } from '@/lib/database';

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
    await documentIntelligenceService.updateDocumentRecord(documentId, {
      processingStatus: 'completed',
      linkedTransactionId: transactionId,
    });
  }

  async markAsFailed(documentId: number): Promise<void> {
    await documentIntelligenceService.updateDocumentRecord(documentId, {
      processingStatus: 'failed',
    });
  }
}
