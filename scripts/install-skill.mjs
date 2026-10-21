#!/usr/bin/env node
/**
 * Backwards-compatible wrapper delegating to bin/openresume.mjs install
 */
import { promptInteractiveSetup } from '../bin/openresume.mjs';

const args = process.argv.slice(2);
await promptInteractiveSetup(args);



