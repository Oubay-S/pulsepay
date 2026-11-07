import { resetAndSeedDatabase } from '../src/lib/seed';

async function main() {
  console.log('[SEED] Starting PulsePay database seed...');
  try {
    const res = await resetAndSeedDatabase();
    console.log('[SUCCESS] Seed complete:', res.message);
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Seed failed:', err);
    process.exit(1);
  }
}

main();
