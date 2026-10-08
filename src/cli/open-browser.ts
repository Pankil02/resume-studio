import { spawn } from 'node:child_process';

/**
 * Safely opens a URL in the system's default browser using OS argument-array spawn.
 * Avoids any shell interpolation or command execution vulnerabilities.
 */
export function openBrowser(url: string): void {
  try {
    let command: string;
    let args: string[];

    if (process.platform === 'darwin') {
      command = 'open';
      args = [url];
    } else if (process.platform === 'win32') {
      command = 'cmd.exe';
      args = ['/c', 'start', '', url];
    } else {
      command = 'xdg-open';
      args = [url];
    }

    const child = spawn(command, args, {
      stdio: 'ignore',
      detached: true,
    });

    child.on('error', () => {
      // Ignore browser launch failure; URL is already printed to terminal
    });

    child.unref();
  } catch {
    // Non-fatal if browser opening fails
  }
}
