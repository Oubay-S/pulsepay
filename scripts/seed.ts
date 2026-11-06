import { resetAndSeedDatabase } from '../src/lib/seed';

async function main() {
  console.log('🌱 Starting PulsePay database seed...');
  try {
    const res = await resetAndSeedDatabase();
    console.log('✅ Seed complete:', res.message);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

main();

