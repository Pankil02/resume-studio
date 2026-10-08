import { chmodSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const cliPath = resolve('dist/cli/main.js');
if (existsSync(cliPath)) {
  chmodSync(cliPath, 0o755);
}
