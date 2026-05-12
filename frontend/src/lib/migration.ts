/**
 * migration.ts
 *
 * Handles one-time migration of legacy localStorage keys:
 *   v1: KANKU (original) â†’ KANKU(intermediate brand)
 *   v2: KANKUâ†’ KANKU  (current brand, migrating back)
 */

const MIGRATION_V1_KEY = 'KANKU_global_migration_v1';
const MIGRATION_V2_KEY = 'KANKU_global_migration_v2';

export function runGlobalMigration() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  // â”€â”€ v1: KANKU (original) â†’ KANKUâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!localStorage.getItem(MIGRATION_V1_KEY)) {
    const v1Migrations = [
      // Encryption keys
      { old: 'KANKU_encrypted_key', new: 'KANKU_encrypted_key' },
      { old: 'KANKU_salt', new: 'KANKU_salt' },
      { old: 'KANKU_encrypted_key', new: 'KANKU_encrypted_key' },
      { old: 'KANKU_salt', new: 'KANKU_salt' },

      // Guest Mode
      { old: 'KANKU_guest_mode', new: 'KANKU_guest_mode' },
      { old: 'KANKU_guest_created_at', new: 'KANKU_guest_created_at' },

      // Sync & Engine
      { old: 'KANKU_sync_queue_v3', new: 'KANKU_sync_queue_v3' },
      { old: 'KANKU_learning_data', new: 'KANKU_learning_data' },
      { old: 'KANKU_merchant_patterns', new: 'KANKU_merchant_patterns' },
      { old: 'KANKU_description_repair_v2', new: 'KANKU_description_repair_v2' },

      // App State
      { old: 'KANKU_onboarding_completed', new: 'onboarding_completed' },
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
      console.info(`[KANKU/Migration] v1 complete. ${v1Count} keys migrated.`);
    }
  }

  // â”€â”€ v2: KANKUâ†’ KANKU â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!localStorage.getItem(MIGRATION_V2_KEY)) {
    console.info('[KANKU/Migration] Starting v2 brand migration (KANKU â†’ KANKU)...');

    const v2Migrations = [
      // Encryption keys (critical â€” must migrate before app reads them)
      { old: 'KANKU_encrypted_key', new: 'KANKU_encrypted_key' },
      { old: 'KANKU_salt', new: 'KANKU_salt' },

      // Guest Mode
      { old: 'KANKU_guest_mode', new: 'KANKU_guest_mode' },
      { old: 'KANKU_guest_created_at', new: 'KANKU_guest_created_at' },

      // Sync & Engine
      { old: 'KANKU_sync_queue_v3', new: 'KANKU_sync_queue_v3' },
      { old: 'KANKU_learning_data', new: 'KANKU_learning_data' },
      { old: 'KANKU_merchant_patterns', new: 'KANKU_merchant_patterns' },
      { old: 'KANKU_description_repair_v2', new: 'KANKU_description_repair_v2' },

      // Internal repair flags
      { old: 'KANKU_global_migration_v1', new: MIGRATION_V1_KEY },
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
    console.info(`[KANKU/Migration] v2 complete. ${v2Count} keys migrated.`);
  }
}

