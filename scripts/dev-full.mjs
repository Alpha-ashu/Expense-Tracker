#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const backendDir = resolve(root, 'backend');

const processes = [
  // Frontend: vite dev server from root
  spawn('npm', ['run', 'dev'], { stdio: 'inherit', cwd: root, env: process.env, shell: true }),
  // Backend: ts-node-dev from backend/ directory
  spawn('npm', ['run', 'dev'], { stdio: 'inherit', cwd: backendDir, env: process.env, shell: true }),
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
