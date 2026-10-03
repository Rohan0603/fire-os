/* global URL, console, setTimeout, clearTimeout */
import { execFileSync, spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectId = 'fire-os-dd6d6';
const emulatorPort = process.env.FIRESTORE_EMULATOR_PORT || '8082';
const firebaseCli = fileURLToPath(
  new URL('../node_modules/firebase-tools/lib/bin/firebase.js', import.meta.url),
);

function listFirestoreEmulatorProcesses() {
  if (process.platform !== 'win32') return [];
  try {
    const output = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'java.exe' -and $_.CommandLine -like '*cloud-firestore-emulator*' -and $_.CommandLine -like '*--port ${emulatorPort}*' -and $_.CommandLine -like '*--project_id ${projectId}*' } | ForEach-Object { $_.ProcessId }`,
      ],
      { encoding: 'utf8', timeout: 5000 },
    );
    return output
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function stopNewFirestoreEmulatorProcesses(existingProcesses) {
  const newProcesses = listFirestoreEmulatorProcesses().filter(
    (pid) => !existingProcesses.has(pid),
  );
  if (process.platform !== 'win32' || newProcesses.length === 0) return;
  try {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Stop-Process -Id ${newProcesses.join(',')} -Force -ErrorAction SilentlyContinue`,
      ],
      { stdio: 'ignore', timeout: 5000 },
    );
  } catch {
    console.warn('[Firestore tests] Could not stop emulator processes:', newProcesses);
  }
}

const preexistingEmulatorProcesses = new Set(listFirestoreEmulatorProcesses());

const child = spawn(
  process.execPath,
  [
    firebaseCli,
    'emulators:exec',
    '--only',
    'firestore',
    '--project',
    projectId,
    'npm run test:rules',
  ],
  { stdio: 'inherit' },
);

let timedOut = false;
const timeout = setTimeout(() => {
  timedOut = true;
  child.kill('SIGTERM');
}, 90_000);

let exit;
try {
  exit = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
} finally {
  clearTimeout(timeout);
}

// On Windows the Firebase CLI can orphan Java after emulators:exec exits.
stopNewFirestoreEmulatorProcesses(preexistingEmulatorProcesses);

if (timedOut) {
  console.error('[Firestore tests] Emulator test run timed out after 90 seconds');
  process.exitCode = 1;
} else if (exit.signal) {
  process.kill(process.pid, exit.signal);
} else {
  process.exitCode = exit.code ?? 1;
}
