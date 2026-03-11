#!/usr/bin/env node
import { spawn } from 'node:child_process';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const processes = [
  spawn(npmCmd, ['run', 'dev'], { stdio: 'inherit', env: process.env }),
  spawn(npmCmd, ['run', 'dev:backend'], { stdio: 'inherit', env: process.env }),
];

let shuttingDown = false;
let exitCode = 0;
let closedCount = 0;

const shutdown = (signal = 'SIGTERM') => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const proc of processes) {
    if (!proc.killed) {
      proc.kill(signal);
    }
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

processes.forEach(proc => {
  proc.on('exit', code => {
    if (typeof code === 'number' && code !== 0) {
      exitCode = code;
      shutdown();
    }

    closedCount += 1;
    if (closedCount >= processes.length) {
      process.exit(exitCode);
    }
  });
});
