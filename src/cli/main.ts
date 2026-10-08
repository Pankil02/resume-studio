#!/usr/bin/env node
/**
 * CLI Entry point for Resume Studio.
 * Native Node ESM executable without runtime dependencies.
 */

import { parseArgs, CliUsageError, type ParsedCommand } from './args.js';
import {
  initDocument,
  inspectDocument,
  validateDocument,
  readDocument,
  DocumentConflictError,
  DocumentIoError,
} from './documents.js';
import { applyDocumentTransaction, LockTimeoutError } from './locks.js';
import { listTemplates } from '../core/templates.js';
import { FIELD_BOUNDS, EDITORIAL_GUIDANCE } from '../core/generated/guidance.js';
import type { Validation } from '../core/validation.js';

const VERSION = '0.1.0';

const HELP_TEXT = `Resume Studio CLI (v${VERSION})

Usage:
  resume <command> [options]

Commands:
  init       Create a safe starter resume document
             Options: --file <path> [--template <classic>] [--max-pages <1|2>] [--json]

  inspect    Inspect revision hash and document content
             Options: --file <path> [--json]

  validate   Validate a resume document against schema & editorial rules
             Options: --file <path> [--json]

  apply      Safely apply changes with revision checking & backup
             Options: --file <path> --from <candidate.json> --expected-revision <sha256> [--json]

  preview    Launch local preview server with loopback bridge
             Options: --file <path> [--port <number>] [--open]

  templates  List supported templates and reading-order caveats
             Options: [--json]

  guidance   Display schema bounds and recommended editorial budgets
             Options: [--json]

Options:
  -h, --help     Show this help message
  -v, --version  Show version number

Exit Codes:
  0: Success
  1: Usage / IO / Internal error
  2: Validation failure
  3: Conflict (revision mismatch or lock acquisition failure)
`;

export async function runCli(argv: string[]): Promise<number> {
  let parsed: ParsedCommand;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (err instanceof CliUsageError) {
      process.stderr.write(`Error: ${err.message}\n\nUse --help for usage.\n`);
      return 1;
    }
    process.stderr.write(`Unexpected argument error: ${(err as Error).message}\n`);
    return 1;
  }

  const isJson = 'json' in parsed && Boolean(parsed.json);

  try {
    switch (parsed.kind) {
      case 'help': {
        process.stdout.write(HELP_TEXT);
        return 0;
      }

      case 'version': {
        process.stdout.write(`${VERSION}\n`);
        return 0;
      }

      case 'init': {
        const result = initDocument({
          filePath: parsed.file,
          template: parsed.template,
          maxPages: parsed.maxPages,
        });

        if (parsed.json) {
          process.stdout.write(
            JSON.stringify({ ok: true, file: result.filePath, revision: result.revision }, null, 2) + '\n'
          );
        } else {
          process.stdout.write(
            `Initialized new resume at '${result.filePath}' (revision: ${result.revision}).\n`
          );
        }
        return 0;
      }

      case 'inspect': {
        const result = inspectDocument(parsed.file);
        if (parsed.json) {
          process.stdout.write(
            JSON.stringify({ revision: result.revision, document: result.document }, null, 2) + '\n'
          );
        } else {
          process.stdout.write(`Document: ${parsed.file}\n`);
          process.stdout.write(`Revision: ${result.revision}\n`);
          process.stdout.write(`Title:    ${result.document.document.title}\n`);
          process.stdout.write(`Template: ${result.document.document.template}\n`);
          process.stdout.write(`MaxPages: ${result.document.document.maxPages}\n`);
          process.stdout.write(`Profile:  ${result.document.profile.name}\n`);
          process.stdout.write(`Roles:    ${result.document.experience.length}\n`);
          process.stdout.write(`Projects: ${result.document.projects.length}\n`);
        }
        return 0;
      }

      case 'validate': {
        const result = validateDocument(parsed.file);
        if (parsed.json) {
          process.stdout.write(
            JSON.stringify(
              {
                ok: result.ok,
                revision: result.revision,
                issues: result.issues,
              },
              null,
              2
            ) + '\n'
          );
        } else {
          process.stdout.write(`File:     ${parsed.file}\n`);
          process.stdout.write(`Revision: ${result.revision}\n`);
          process.stdout.write(`Status:   ${result.ok ? 'VALID' : 'INVALID'}\n`);
          if (result.issues.length > 0) {
            process.stdout.write(`Issues (${result.issues.length}):\n`);
            for (const issue of result.issues) {
              const prefix = issue.severity === 'error' ? '  [ERROR]' : '  [WARN] ';
              process.stdout.write(`${prefix} ${issue.path}: ${issue.message} (${issue.code})\n`);
            }
          }
        }
        return result.ok ? 0 : 2;
      }

      case 'apply': {
        // Read candidate file
        const candidate = readDocument(parsed.from);
        if (!candidate.validation.ok) {
          if (parsed.json) {
            process.stdout.write(
              JSON.stringify(
                {
                  ok: false,
                  error: 'Candidate resume failed validation.',
                  issues: candidate.validation.issues,
                },
                null,
                2
              ) + '\n'
            );
          } else {
            process.stderr.write(`Validation failed for candidate file '${parsed.from}'.\n`);
            for (const issue of candidate.validation.issues) {
              if (issue.severity === 'error') {
                process.stderr.write(`  [ERROR] ${issue.path}: ${issue.message}\n`);
              }
            }
          }
          return 2;
        }

        const result = await applyDocumentTransaction({
          targetPath: parsed.file,
          candidateContent: candidate.text,
          expectedRevision: parsed.expectedRevision,
        });

        if (parsed.json) {
          process.stdout.write(
            JSON.stringify(
              {
                ok: true,
                revision: result.revision,
                previousRevision: result.previousRevision,
              },
              null,
              2
            ) + '\n'
          );
        } else {
          process.stdout.write(
            `Successfully applied candidate changes to '${parsed.file}'.\nNew revision: ${result.revision}\n`
          );
        }
        return 0;
      }

      case 'templates': {
        const templates = listTemplates();
        if (parsed.json) {
          process.stdout.write(JSON.stringify({ templates }, null, 2) + '\n');
        } else {
          process.stdout.write('Supported Resume Templates:\n\n');
          for (const t of templates) {
            process.stdout.write(`- ${t.name} (id: ${t.id})\n`);
            process.stdout.write(`  Columns:     ${t.columns}\n`);
            process.stdout.write(`  Font family: ${t.fontFamily}\n`);
            process.stdout.write(`  ATS ready:   ${t.atsOptimized ? 'Yes' : 'No (sidebar caveat)'}\n`);
            if (t.readingOrderCaveat) {
              process.stdout.write(`  Caveat:      ${t.readingOrderCaveat}\n`);
            }
            process.stdout.write(`  Description: ${t.description}\n\n`);
          }
        }
        return 0;
      }

      case 'guidance': {
        if (parsed.json) {
          process.stdout.write(
            JSON.stringify({ bounds: FIELD_BOUNDS, guidance: EDITORIAL_GUIDANCE }, null, 2) + '\n'
          );
        } else {
          process.stdout.write('Resume Studio Editorial Guidance & Hard Bounds:\n\n');
          process.stdout.write(`Max Document Bytes: ${FIELD_BOUNDS.maxInputBytes} bytes (128 KiB)\n`);
          process.stdout.write(`Title Length:        ${FIELD_BOUNDS.document.title.minLength} - ${FIELD_BOUNDS.document.title.maxLength} chars\n`);
          process.stdout.write(`Name Length:         ${FIELD_BOUNDS.profile.name.minLength} - ${FIELD_BOUNDS.profile.name.maxLength} chars\n`);
          process.stdout.write(`Max Links:           ${FIELD_BOUNDS.profile.maxLinks}\n`);
          process.stdout.write(`Max Experience:      ${FIELD_BOUNDS.experience.maxItems} roles, ${FIELD_BOUNDS.experience.maxBullets} bullets/role\n`);
          process.stdout.write(`Max Bullet Chars:    ${FIELD_BOUNDS.experience.bullet.maxLength} chars\n`);
        }
        return 0;
      }

      case 'preview': {
        // Handled in Phase 4
        const { startPreviewServer } = await import('./server.js');
        await startPreviewServer({
          file: parsed.file,
          port: parsed.port,
          open: parsed.open,
        });
        return 0;
      }

      default:
        process.stderr.write(`Unrecognized command.\n`);
        return 1;
    }
  } catch (err: unknown) {
    if (err instanceof DocumentConflictError || err instanceof LockTimeoutError) {
      if (isJson) {
        process.stdout.write(
          JSON.stringify({ ok: false, conflict: true, message: (err as Error).message }, null, 2) + '\n'
        );
      } else {
        process.stderr.write(`Conflict: ${(err as Error).message}\n`);
      }
      return 3;
    }

    if (err instanceof DocumentIoError) {
      const validation = (err as unknown as { validation?: Validation }).validation;
      if (validation && !validation.ok) {
        if (isJson) {
          process.stdout.write(
            JSON.stringify({ ok: false, error: err.message, issues: validation.issues }, null, 2) + '\n'
          );
        } else {
          process.stderr.write(`Validation Error: ${err.message}\n`);
        }
        return 2;
      }

      if (isJson) {
        process.stdout.write(
          JSON.stringify({ ok: false, error: err.message, code: err.code }, null, 2) + '\n'
        );
      } else {
        process.stderr.write(`IO Error: ${err.message}\n`);
      }
      return 1;
    }

    const message = err instanceof Error ? err.message : String(err);
    if (isJson) {
      process.stdout.write(
        JSON.stringify({ ok: false, error: message }, null, 2) + '\n'
      );
    } else {
      process.stderr.write(`Internal Error: ${message}\n`);
    }
    return 1;
  }
}

// Only invoke if running directly as a script
if (process.argv[1] && (process.argv[1].endsWith('/cli/main.ts') || process.argv[1].endsWith('/cli/main.js'))) {
  runCli(process.argv.slice(2)).then((code) => {
    if (code !== 0 && process.exitCode === undefined) {
      process.exit(code);
    }
  });
}
