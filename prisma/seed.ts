import 'dotenv/config';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const dbPath = path.resolve(process.cwd(), databaseUrl.replace(/^file:/, ''));
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

const DATA_MODULE_DMC = 'SKODA-A-32-40-00-00-00-A-040-A-A';
const SPARE_PART_PN = 'BP-109E';

/** Train brake schematic: caliper housing (1), brake pad lining (2), upper mounting bolt (3). IDs match internalRefId in XML. */
const TRAIN_BRAKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="360" height="257">
  <defs>
    <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6">
      <path d="M0 6L6 0M-1 1L1 -1M5 7L7 5" stroke="#888" stroke-width="0.8" fill="none"/>
    </pattern>
    <pattern id="hatch2" patternUnits="userSpaceOnUse" width="5" height="5">
      <path d="M0 5L5 0" stroke="#999" stroke-width="0.6" fill="none"/>
    </pattern>
  </defs>
  <title>Train brake assembly – schematic</title>
  <!-- Caliper housing / třmen (1) -->
  <g id="brake-housing" stroke="#505050" stroke-width="1.8" fill="#e8e8e8">
    <path d="M40 45 L40 155 L120 155 L120 125 L100 95 L100 45 Z"/>
    <path d="M100 45 L100 95 L120 125 L120 155" fill="url(#hatch)"/>
    <path d="M120 65 L220 65 L220 135 L120 135 Z"/>
    <path d="M120 65 L120 135 L220 135 L220 65" fill="url(#hatch2)" stroke="#505050"/>
  </g>
  <!-- Brake pad lining / brzdové obložení (2) -->
  <rect id="brake-pad-lining" x="125" y="72" width="90" height="52" fill="#c4b8a8" stroke="#505050" stroke-width="1.5" rx="1"/>
  <line x1="125" y1="98" x2="215" y2="98" stroke="#888" stroke-width="0.6" stroke-dasharray="3 2"/>
  <!-- Upper mounting bolt / horní montážní šroub (3) -->
  <g id="mounting-bolt-upper" stroke="#404040" stroke-width="1.2" fill="#b0b0b0">
    <rect x="128" y="28" width="24" height="42" rx="2"/>
    <path d="M134 28 L134 18 L146 18 L146 28" fill="#d0d0d0" stroke="#404040"/>
    <line x1="135" y1="22" x2="145" y2="22" stroke="#606060" stroke-width="0.8"/>
    <line x1="137" y1="24" x2="143" y2="24" stroke="#606060" stroke-width="0.5"/>
    <line x1="139" y1="26" x2="141" y2="26" stroke="#606060" stroke-width="0.5"/>
  </g>
  <!-- Callouts (1), (2), (3) -->
  <text x="72" y="102" font-size="11" font-family="sans-serif" fill="#333" text-anchor="middle">(1)</text>
  <text x="170" y="102" font-size="11" font-family="sans-serif" fill="#333" text-anchor="middle">(2)</text>
  <text x="140" y="52" font-size="11" font-family="sans-serif" fill="#333" text-anchor="middle">(3)</text>
</svg>`;

const DEMO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<dmodule xmlns="http://www.s1000d.org/S1000D_5-1">
  <content>
    <procedure>
      <warning type="safety">
        <para>Před zahájením prací odpojte napájení a zajistěte proti opětovnému zapnutí. Používejte pouze schválené náhradní díly.</para>
      </warning>
      <mainProcedure>
        <procedureSteps>
          <proceduralStep>
            <para>Povolte horní montážní šroub <internalRef internalRefId="mounting-bolt-upper">3</internalRef>.</para>
          </proceduralStep>
          <proceduralStep>
            <para>Vysuňte brzdové obložení <internalRef internalRefId="brake-pad-lining">2</internalRef> z třmenu <internalRef internalRefId="brake-housing">1</internalRef>.</para>
          </proceduralStep>
          <proceduralStep>
            <para>Prohlédněte brzdové destičky z obou stran nápravy.</para>
          </proceduralStep>
          <proceduralStep>
            <para>Zkontrolujte tloušťku brzdových destiček. Minimální tloušťka: 3 mm.</para>
          </proceduralStep>
          <proceduralStep>
            <para>Při výměně použijte kompletní sadu brzdových destiček <partNumber>${SPARE_PART_PN}</partNumber> dle IPC.</para>
          </proceduralStep>
          <proceduralStep>
            <para>Po montáži proveďte funkční zkoušku brzd.</para>
          </proceduralStep>
        </procedureSteps>
      </mainProcedure>
    </procedure>
  </content>
</dmodule>`;

async function main() {
  console.log('🌱 Seeding database...');

  // Clean slate (order respects foreign keys: tasks reference modules and parts)
  await prisma.feedback.deleteMany();
  await prisma.maintenanceTask.deleteMany();
  await prisma.sparePart.deleteMany();
  await prisma.dataModule.deleteMany();

  // Spare Part (S2000M)
  const sparePart = await prisma.sparePart.create({
    data: {
      name: 'Brake Pad Kit',
      partNumber: SPARE_PART_PN,
      quantity: 50,
      unit: 'set',
    },
  });
  console.log('  ✓ Spare Part:', sparePart.partNumber, sparePart.name);

  // Data Module (S1000D) with inline SVG for hotspot demo
  const dataModule = await prisma.dataModule.create({
    data: {
      dmCode: DATA_MODULE_DMC,
      techName: 'Pneumaticka brzda',
      issueDate: new Date().toISOString().slice(0, 10),
      xmlContent: DEMO_XML,
      illustrationSvg: TRAIN_BRAKE_SVG,
    },
  });
  console.log('  ✓ Data Module:', dataModule.dmCode, dataModule.techName);

  // Maintenance Task (S3000L) – linked to DataModule and SparePart
  const maintenanceTask = await prisma.maintenanceTask.create({
    data: {
      taskCode: 'T-SKD-VI-10K',
      description: 'Visual Inspection 10k',
      interval: '10,000 km',
      personnel: 'Mechanic (Level 2)',
      duration: 1.0,
      dmId: dataModule.id,
      partId: sparePart.id,
    },
  });
  console.log('  ✓ Maintenance Task:', maintenanceTask.taskCode, maintenanceTask.description);

  // Feedback (technician note linked to manual by DMC)
  const feedback = await prisma.feedback.create({
    data: {
      dmCode: DATA_MODULE_DMC,
      message: 'Previous inspection noted wear on left side.',
      status: 'RESOLVED',
    },
  });
  console.log('  ✓ Feedback:', feedback.status, '-', feedback.message.slice(0, 40) + '...');

  console.log('✅ Demo seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
