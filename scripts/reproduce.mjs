import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function runBuild(directory) {
  const result = spawnSync(pnpmCommand, ['--dir', directory, 'build'], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  process.stdout.write(`${result.stdout ?? ''}${result.stderr ?? ''}`);

  if (result.status !== 0) {
    console.error(`${directory} build failed with exit code ${result.status ?? 'unknown'}.`);
    process.exit(result.status ?? 1);
  }
}

runBuild('host');
runBuild('remote');

const manifest = JSON.parse(
  readFileSync('host/dist/mf-manifest.json', 'utf8'),
);
const shared = manifest.shared?.find(
  (entry) => entry.name === 'ag-grid-community',
);
const syncAssets = shared?.assets?.js?.sync ?? [];
const asyncAssets = shared?.assets?.js?.async ?? [];
const html = readFileSync('host/dist/index.html', 'utf8');
const gridPreloads = html.match(/modulepreload[^>]*ag_mf_2_grid/gi) ?? [];

if (!shared || syncAssets.length === 0 || asyncAssets.length !== 0) {
  console.error(
    'Expected ag-grid-community to be a non-empty sync shared asset with no async assets.',
  );
  process.exit(1);
}

if (gridPreloads.length === 0) {
  console.error(
    'Expected the host HTML to contain the AG Grid modulepreload emitted by the current behavior.',
  );
  process.exit(1);
}

console.log(
  `Reproduced: eager:false still emitted ${syncAssets.length} sync AG Grid asset(s) and ${gridPreloads.length} HTML modulepreload link(s).`,
);
