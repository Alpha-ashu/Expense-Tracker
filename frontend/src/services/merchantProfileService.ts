import { documentIntelligenceService } from './documentIntelligenceService';

export class MerchantProfileService {
  async upsertFromReceipt(
    merchantName: string,
    category: string,
    confidence: number,
    userId: string,
    keywordSource?: string,
  ): Promise<void> {
    if (!merchantName) return;

    await documentIntelligenceService.upsertMerchantProfile({
      merchantName,
      normalizedName: documentIntelligenceService.normalizeMerchantName(merchantName),
      suggestedCategory: category,
      confidenceScore: confidence,
      userId,
    });

    await documentIntelligenceService.upsertCategoryPreference({
      userId,
      merchantKey: merchantName,
      keywordKey: keywordSource || merchantName,
      category,
      confidenceScore: confidence,
    });
  }
}
