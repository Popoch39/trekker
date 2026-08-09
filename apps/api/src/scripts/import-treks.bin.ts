import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { config } from 'dotenv';

import { importTreks } from './import-treks';

/**
 * Amorce du script d'import. Volontairement reduite a l'orchestration : toute
 * la logique testable vit dans `import-treks.ts`.
 *
 *   pnpm --filter api import:treks [chemin/de/sortie.json]
 */
async function main(): Promise<void> {
  // `.env` unique de la racine du monorepo. En environnement deploye il
  // n'existe pas et les variables sont deja presentes : dotenv n'ecrase rien.
  config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

  const output = path.resolve(
    process.cwd(),
    process.argv[2] ?? 'data/treks.json',
  );

  const { rows, reports } = await importTreks({
    log: (message) => process.stdout.write(`${message}\n`),
  });

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');

  for (const report of reports) {
    process.stdout.write(
      `${report.instance} : ${report.imported} importes, ${report.skipped} ecartes\n`,
    );
  }

  process.stdout.write(`${rows.length} itineraires ecrits dans ${output}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
