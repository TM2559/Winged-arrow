import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

async function main() {
  console.log('🌱 Starting MAXIMO Mobile Gateway seed...');

  // 1. CLEANUP (Smazání starých dat)
  try {
    await prisma.feedback.deleteMany();
    await prisma.maintenanceTask.deleteMany();
    await prisma.sparePart.deleteMany();
    await prisma.dataModule.deleteMany();
    console.log('🧹 Database cleaned.');
  } catch (e) {
    console.log('⚠️ Cleanup skipped (Database might be empty).');
  }

  // 2. CREATE SPARE PARTS
  const partBrake = await prisma.sparePart.create({
    data: { partNumber: 'BP-109E', name: 'Sada brzdových destiček', quantity: 48, unit: 'SET' }
  });
  const partFilter = await prisma.sparePart.create({
    data: { partNumber: 'FILT-AC-200', name: 'HEPA Filtr Klimatizace', quantity: 12, unit: 'PC' }
  });
  const partSensor = await prisma.sparePart.create({
    data: { partNumber: 'SENS-DR-55', name: 'Optický senzor dveří', quantity: 5, unit: 'PC' }
  });
  const partWheel = await prisma.sparePart.create({
    data: { partNumber: 'WHEEL-FOR-01', name: 'Kolo tramvaje (Ocel)', quantity: 8, unit: 'PC' }
  });

  console.log('📦 Parts created.');

  // 3. CREATE DATA MODULES (XML + SVG)

  // --- BRAKES (Výkres brzdy) ---
  const svgBrake = `
    <svg viewBox="0 0 400 300" style="background-color: #f8f9fa; border: 1px solid #ccc;">
      <text x="380" y="280" text-anchor="end" font-family="monospace" font-size="10" fill="#999">FIG 1.0 - BRAKE ASSY</text>
      <circle cx="200" cy="150" r="100" fill="#e0e0e0" stroke="#333" stroke-width="2" />
      <circle cx="200" cy="150" r="60" fill="none" stroke="#333" stroke-width="1" stroke-dasharray="5,5" />
      <path d="M 140 60 Q 200 40 260 60 L 260 180 Q 200 200 140 180 Z" fill="#cfd8dc" stroke="#455a64" stroke-width="3" />
      <g id="pad-main" style="cursor: pointer;">
        <rect x="160" y="80" width="80" height="100" rx="5" fill="#5d4037" stroke="#3e2723" stroke-width="2"/>
        <text x="200" y="130" text-anchor="middle" fill="white" font-size="10" font-family="Arial">PAD</text>
      </g>
      <g id="bolt-top" style="cursor: pointer;">
        <circle cx="200" cy="50" r="12" fill="#ffca28" stroke="#f57f17" stroke-width="2" />
        <path d="M 200 42 L 207 46 L 207 54 L 200 58 L 193 54 L 193 46 Z" fill="none" stroke="#333" />
      </g>
      <line x1="200" y1="50" x2="280" y2="30" stroke="#333" stroke-width="1" />
      <text x="290" y="35" font-family="Arial" font-size="12" font-weight="bold">1</text>
      <line x1="240" y1="130" x2="300" y2="130" stroke="#333" stroke-width="1" />
      <text x="310" y="135" font-family="Arial" font-size="12" font-weight="bold">2</text>
    </svg>
  `;

  const dmBrake = await prisma.dataModule.create({
    data: {
      dmCode: 'SKODA-A-32-40-00-00-00-A-040-A-A',
      techName: 'Pneumatická brzda',
      issueDate: '2024-01-15',
      xmlContent: `<?xml version="1.0"?><dmodule>
        <identAndStatusSection><dmTitle><techName>Pneumatická brzda</techName><infoName>Výměna obložení</infoName></dmTitle></identAndStatusSection>
        <content>
          <warning><para>Pozor na vysoký tlak v systému!</para></warning>
          <proceduralStep><para>Povolte <internalRef internalRefId="bolt-top">horní šroub (1)</internalRef> klíčem č. 14.</para></proceduralStep>
          <proceduralStep><para>Vyjměte opotřebované <internalRef internalRefId="pad-main">brzdové obložení (2)</internalRef> směrem dolů.</para></proceduralStep>
          <figure id="fig-001">${svgBrake}</figure>
        </content>
      </dmodule>`
    }
  });

  // --- HVAC (Klimatizace) ---
  const svgHvac = `
    <svg viewBox="0 0 400 200" style="background-color: #fff; border: 1px solid #ccc;">
      <rect x="50" y="20" width="300" height="160" rx="10" fill="#e1f5fe" stroke="#0277bd" stroke-width="3"/>
      <g id="filter-unit" style="cursor: pointer;">
        <rect x="100" y="30" width="40" height="140" fill="#fff" stroke="#333" stroke-width="2"/>
        <rect x="95" y="25" width="50" height="150" fill="none" stroke="red" stroke-width="2" stroke-dasharray="5,5" opacity="0.5"/>
      </g>
      <g id="service-door" style="cursor: pointer;">
         <rect x="80" y="10" width="80" height="10" fill="#424242" />
         <text x="120" y="18" text-anchor="middle" fill="white" font-size="8">DOOR A</text>
      </g>
      <text x="120" y="190" text-anchor="middle" font-family="Arial" font-size="10">HEPA FILTER SECTION</text>
    </svg>
  `;

  const dmHvac = await prisma.dataModule.create({
    data: {
      dmCode: 'SKODA-A-21-50-00-00-00-A-120-A-A',
      techName: 'Klimatizační jednotka HVAC',
      issueDate: '2024-02-10',
      xmlContent: `<?xml version="1.0"?><dmodule>
        <identAndStatusSection><dmTitle><techName>Klimatizace Salonu</techName><infoName>Čištění filtrů</infoName></dmTitle></identAndStatusSection>
        <content>
          <caution><para>Vypněte hlavní jistič HVAC.</para></caution>
          <proceduralStep><para>Otevřete horní <internalRef internalRefId="service-door">servisní dvířka (A)</internalRef>.</para></proceduralStep>
          <proceduralStep><para>Vysuňte znečištěný <internalRef internalRefId="filter-unit">HEPA filtr (F1)</internalRef> a zkontrolujte průchodnost.</para></proceduralStep>
          <figure id="fig-hvac">${svgHvac}</figure>
        </content>
      </dmodule>`
    }
  });

  // --- DOORS (Dveře) ---
  const svgDoor = `
    <svg viewBox="0 0 300 300" style="background-color: #fff;">
       <rect x="20" y="20" width="260" height="260" fill="none" stroke="#333" stroke-width="4"/>
       <rect id="door-leaf" x="30" y="30" width="115" height="240" fill="#eceff1" stroke="#546e7a" stroke-width="2"/>
       <rect x="155" y="30" width="115" height="240" fill="#eceff1" stroke="#546e7a" stroke-width="2"/>
       <g id="sensor-eye" style="cursor: pointer;">
          <circle cx="150" cy="280" r="10" fill="#d32f2f" stroke="#b71c1c" stroke-width="2"/>
          <path d="M 140 280 L 120 280" stroke="#d32f2f" stroke-width="1" stroke-dasharray="2,2"/>
          <path d="M 160 280 L 180 280" stroke="#d32f2f" stroke-width="1" stroke-dasharray="2,2"/>
       </g>
       <text x="150" y="295" text-anchor="middle" font-size="8">OPTICAL SENSOR</text>
    </svg>
  `;

  const dmDoor = await prisma.dataModule.create({
    data: {
      dmCode: 'SKODA-A-52-10-00-00-00-A-010-A-A',
      techName: 'Dveřní systém',
      issueDate: '2023-11-20',
      xmlContent: `<?xml version="1.0"?><dmodule>
        <identAndStatusSection><dmTitle><techName>Dveře</techName><infoName>Kalibrace</infoName></dmTitle></identAndStatusSection>
        <content>
          <proceduralStep><para>Zkontrolujte čistotu čočky <internalRef internalRefId="sensor-eye">optického senzoru (S1)</internalRef>.</para></proceduralStep>
          <proceduralStep><para>Pokud se <internalRef internalRefId="door-leaf">dveřní křídlo</internalRef> vrací, očistěte dráhu.</para></proceduralStep>
          <figure id="fig-door">${svgDoor}</figure>
        </content>
      </dmodule>`
    }
  });

  console.log('📚 Manuals created.');

  // 4. CREATE TASKS (S3000L)
  await prisma.maintenanceTask.createMany({
    data: [
      { taskCode: 'TASK-BRK-10K', description: 'Výměna brzd', interval: '10,000 km', personnel: 'Mechanik II', duration: 1.5, dmId: dmBrake.id, partId: partBrake.id },
      { taskCode: 'TASK-HVAC-AN', description: 'Roční servis HVAC', interval: '1 Rok', personnel: 'Elektrikář I', duration: 2.0, dmId: dmHvac.id, partId: partFilter.id },
      { taskCode: 'TASK-DOOR-CHK', description: 'Test dveří', interval: 'Denně', personnel: 'Řidič', duration: 0.2, dmId: dmDoor.id, partId: partSensor.id }
    ]
  });

  // 5. CREATE FEEDBACK
  await prisma.feedback.createMany({
    data: [
      { dmCode: 'SKODA-A-32-40-00-00-00-A-040-A-A', message: 'Těsnění pod šroubem chybí v nákresu.', status: 'OPEN', createdAt: new Date('2024-02-01') },
      { dmCode: 'SKODA-A-21-50-00-00-00-A-120-A-A', message: 'Kryt filtru rezonuje při vysokých otáčkách.', status: 'OPEN', createdAt: new Date('2024-02-12') },
    ]
  });

  console.log('✅ SEED COMPLETE');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });