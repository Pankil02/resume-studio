import type { TemplateId, MaxPages } from '../core/generated/resume.js';

export interface InitCommand {
  kind: 'init';
  file: string;
  template: TemplateId;
  maxPages: MaxPages;
  json: boolean;
}

export interface InspectCommand {
  kind: 'inspect';
  file: string;
  json: boolean;
}

export interface ValidateCommand {
  kind: 'validate';
  file: string;
  json: boolean;
}

export interface ApplyCommand {
  kind: 'apply';
  file: string;
  from: string;
  expectedRevision: string;
  json: boolean;
}

export interface PreviewCommand {
  kind: 'preview';
  file: string;
  port: number;
  open: boolean;
}

export interface TemplatesCommand {
  kind: 'templates';
  json: boolean;
}

export interface GuidanceCommand {
  kind: 'guidance';
  json: boolean;
}

export interface HelpCommand {
  kind: 'help';
}

export interface VersionCommand {
  kind: 'version';
}

export type ParsedCommand =
  | InitCommand
  | InspectCommand
  | ValidateCommand
  | ApplyCommand
  | PreviewCommand
  | TemplatesCommand
  | GuidanceCommand
  | HelpCommand
  | VersionCommand;

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

const HEX_SHA256_REGEX = /^[0-9a-f]{64}$/;

interface RawOptions {
  flags: Set<string>;
  options: Map<string, string>;
  positionals: string[];
}

function parseRawArgv(argv: string[]): RawOptions {
  const flags = new Set<string>();
  const options = new Map<string, string>();
  const positionals: string[] = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === undefined) {
      break;
    }

    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const value = arg.slice(eqIdx + 1);
        if (options.has(key) && options.get(key) !== value) {
          throw new CliUsageError(`Conflicting duplicate option: --${key}`);
        }
        options.set(key, value);
      } else {
        const key = arg.slice(2);
        // Look ahead to see if next token is a value or another flag
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          if (options.has(key) && options.get(key) !== next) {
            throw new CliUsageError(`Conflicting duplicate option: --${key}`);
          }
          options.set(key, next);
          i++;
        } else {
          flags.add(key);
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      const flagName = arg.slice(1);
      flags.add(flagName);
    } else {
      positionals.push(arg);
    }
    i++;
  }

  return { flags, options, positionals };
}

function assertAllowed(
  options: Map<string, string>,
  flags: Set<string>,
  allowedOptions: string[],
  allowedFlags: string[],
  commandName: string
): void {
  const allowedOptSet = new Set(allowedOptions);
  for (const opt of options.keys()) {
    if (!allowedOptSet.has(opt)) {
      throw new CliUsageError(`Unrecognized option: --${opt} for '${commandName}'`);
    }
  }
  const allowedFlagSet = new Set(allowedFlags);
  for (const flag of flags) {
    if (!allowedFlagSet.has(flag)) {
      throw new CliUsageError(`Unrecognized option: --${flag} for '${commandName}'`);
    }
  }
}

export function parseArgs(argv: string[]): ParsedCommand {
  const { flags, options, positionals } = parseRawArgv(argv);

  if (flags.has('h') || flags.has('help')) {
    return { kind: 'help' };
  }

  if (flags.has('v') || flags.has('version')) {
    return { kind: 'version' };
  }

  if (positionals.length === 0) {
    return { kind: 'help' };
  }

  const command = positionals[0];
  const extraPositionals = positionals.slice(1);
  if (extraPositionals.length > 0) {
    throw new CliUsageError(`Unexpected positional argument: '${extraPositionals[0]}'`);
  }

  const isJson = flags.has('json') || options.get('json') === 'true';

  switch (command) {
    case 'init': {
      assertAllowed(options, flags, ['file', 'template', 'max-pages', 'json'], ['json'], 'init');
      const file = options.get('file');
      if (!file) {
        throw new CliUsageError("Missing required option: --file <path> for 'init'");
      }
      const rawTemplate = options.get('template') || 'classic';
      if (rawTemplate !== 'classic') {
        throw new CliUsageError(`Invalid template: '${rawTemplate}'. Only 'classic' is supported.`);
      }
      const rawMaxPages = options.get('max-pages');
      let maxPages: MaxPages = 1;
      if (rawMaxPages !== undefined) {
        if (rawMaxPages === '1') {
          maxPages = 1;
        } else if (rawMaxPages === '2') {
          maxPages = 2;
        } else {
          throw new CliUsageError(`Invalid --max-pages: '${rawMaxPages}'. Must be 1 or 2.`);
        }
      }

      return {
        kind: 'init',
        file,
        template: rawTemplate as TemplateId,
        maxPages,
        json: isJson,
      };
    }

    case 'inspect': {
      assertAllowed(options, flags, ['file', 'json'], ['json'], 'inspect');
      const file = options.get('file');
      if (!file) {
        throw new CliUsageError("Missing required option: --file <path> for 'inspect'");
      }
      return { kind: 'inspect', file, json: isJson };
    }

    case 'validate': {
      assertAllowed(options, flags, ['file', 'json'], ['json'], 'validate');
      const file = options.get('file');
      if (!file) {
        throw new CliUsageError("Missing required option: --file <path> for 'validate'");
      }
      return { kind: 'validate', file, json: isJson };
    }

    case 'apply': {
      assertAllowed(options, flags, ['file', 'from', 'expected-revision', 'json'], ['json'], 'apply');
      const file = options.get('file');
      if (!file) {
        throw new CliUsageError("Missing required option: --file <path> for 'apply'");
      }
      const from = options.get('from');
      if (!from) {
        throw new CliUsageError("Missing required option: --from <path> for 'apply'");
      }
      const expectedRevision = options.get('expected-revision');
      if (!expectedRevision) {
        throw new CliUsageError("Missing required option: --expected-revision <sha256> for 'apply'");
      }
      if (!HEX_SHA256_REGEX.test(expectedRevision)) {
        throw new CliUsageError(`Invalid --expected-revision: must be a 64-character lowercase hex string.`);
      }
      return { kind: 'apply', file, from, expectedRevision, json: isJson };
    }

    case 'preview': {
      assertAllowed(options, flags, ['file', 'port'], ['open'], 'preview');
      const file = options.get('file');
      if (!file) {
        throw new CliUsageError("Missing required option: --file <path> for 'preview'");
      }
      const rawPort = options.get('port');
      let port = 0;
      if (rawPort !== undefined) {
        const parsedPort = Number.parseInt(rawPort, 10);
        if (Number.isNaN(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
          throw new CliUsageError(`Invalid --port: '${rawPort}'. Must be an integer between 0 and 65535.`);
        }
        port = parsedPort;
      }
      const open = flags.has('open');
      return { kind: 'preview', file, port, open };
    }

    case 'templates': {
      assertAllowed(options, flags, ['json'], ['json'], 'templates');
      return { kind: 'templates', json: isJson };
    }

    case 'guidance': {
      assertAllowed(options, flags, ['json'], ['json'], 'guidance');
      return { kind: 'guidance', json: isJson };
    }

    default:
      throw new CliUsageError(`Unrecognized command: '${command}'. Use --help for usage.`);
  }
}
