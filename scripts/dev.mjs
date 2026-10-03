import { spawn } from 'node:child_process';
import process from 'node:process';

const npmCommand = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';

function npmArgs(script, args = []) {
  const forwardedArgs = args.length > 0 ? ` -- ${args.join(' ')}` : '';
  return process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm.cmd run ${script}${forwardedArgs}`]
    : ['run', script, ...(args.length > 0 ? ['--', ...args] : [])];
}

const uiArgs = process.argv.slice(2);

const children = [
  spawn(npmCommand, npmArgs('dev:ui', uiArgs), {
    stdio: 'inherit',
  }),
  spawn(npmCommand, npmArgs('dev:server'), {
    stdio: 'inherit',
  }),
];

let shuttingDown = false;

function stopChildren(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill(signal);
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (code !== 0) {
      stopChildren('SIGTERM');
      process.exitCode = code ?? 1;
    }
    if (signal) {
      stopChildren('SIGTERM');
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => stopChildren('SIGINT'));
process.on('SIGTERM', () => stopChildren('SIGTERM'));
