import { spawnSync } from 'node:child_process';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(pnpmCommand, ['--dir', 'remote', 'build'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
process.stdout.write(output);

const missingExportCount = (output.match(/\[MISSING_EXPORT\]/g) ?? []).length;

if (missingExportCount === 0) {
  console.error(
    `Expected the remote build to emit [MISSING_EXPORT], but it did not. Exit code: ${result.status ?? 'unknown'}`,
  );
  process.exit(result.status ?? 1);
}

console.log(
  `Reproduced: remote build emitted ${missingExportCount} [MISSING_EXPORT] diagnostic(s).`,
);
