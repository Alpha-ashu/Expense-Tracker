/**
 * migration.ts
 *
 * Handles one-time migration of legacy localStorage keys:
 *   v1: Finora (original) → Kanakku (intermediate brand)
 *   v2: Kanakku → Finora  (current brand, migrating back)
 */

const MIGRATION_V1_KEY = 'kanakku_global_migration_v1';
const MIGRATION_V2_KEY = 'finora_global_migration_v2';

export function runGlobalMigration() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  // ── v1: Finora (original) → Kanakku ──────────────────────────────
  if (!localStorage.getItem(MIGRATION_V1_KEY)) {
    const v1Migrations = [
      // Encryption keys
      { old: 'Finora_encrypted_key', new: 'Kanakku_encrypted_key' },
      { old: 'Finora_salt', new: 'Kanakku_salt' },
      { old: 'finora_encrypted_key', new: 'Kanakku_encrypted_key' },
      { old: 'finora_salt', new: 'Kanakku_salt' },

      // Guest Mode
      { old: 'finora_guest_mode', new: 'kanakku_guest_mode' },
      { old: 'finora_guest_created_at', new: 'kanakku_guest_created_at' },

      // Sync & Engine
      { old: 'finora_sync_queue_v3', new: 'kanakku_sync_queue_v3' },
      { old: 'finora_learning_data', new: 'kanakku_learning_data' },
      { old: 'finora_merchant_patterns', new: 'kanakku_merchant_patterns' },
      { old: 'finora_description_repair_v2', new: 'kanakku_description_repair_v2' },

      // App State
      { old: 'finora_onboarding_completed', new: 'onboarding_completed' },
    ];

    let v1Count = 0;
    v1Migrations.forEach(({ old, new: newKey }) => {
      const val = localStorage.getItem(old);
      if (val !== null) {
        if (!localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, val);
          v1Count++;
        }
      }
    });

    localStorage.setItem(MIGRATION_V1_KEY, 'done');
    if (v1Count > 0) {
      console.info(`[Finora/Migration] v1 complete. ${v1Count} keys migrated.`);
    }
  }

  // ── v2: Kanakku → Finora ─────────────────────────────────────────
  if (!localStorage.getItem(MIGRATION_V2_KEY)) {
    console.info('[Finora/Migration] Starting v2 brand migration (Kanakku → Finora)...');

    const v2Migrations = [
      // Encryption keys (critical — must migrate before app reads them)
      { old: 'Kanakku_encrypted_key', new: 'Finora_encrypted_key' },
      { old: 'Kanakku_salt', new: 'Finora_salt' },

      // Guest Mode
      { old: 'kanakku_guest_mode', new: 'finora_guest_mode' },
      { old: 'kanakku_guest_created_at', new: 'finora_guest_created_at' },

      // Sync & Engine
      { old: 'kanakku_sync_queue_v3', new: 'finora_sync_queue_v3' },
      { old: 'kanakku_learning_data', new: 'finora_learning_data' },
      { old: 'kanakku_merchant_patterns', new: 'finora_merchant_patterns' },
      { old: 'kanakku_description_repair_v2', new: 'finora_description_repair_v2' },

      // Internal repair flags
      { old: 'kanakku_global_migration_v1', new: MIGRATION_V1_KEY },
    ];

    let v2Count = 0;
    v2Migrations.forEach(({ old, new: newKey }) => {
      const val = localStorage.getItem(old);
      if (val !== null) {
        if (!localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, val);
          v2Count++;
        }
        // Keep old key for one cycle to prevent data loss during the transition
      }
    });

    localStorage.setItem(MIGRATION_V2_KEY, 'done');
    console.info(`[Finora/Migration] v2 complete. ${v2Count} keys migrated.`);
  }
}
