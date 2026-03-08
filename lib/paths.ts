import path from 'path';
import os from 'os';
import fs from 'fs';

// Single source of truth for where LegalMind data lives.
// Always AppData\Roaming\LegalMind — same in dev and production.
function getAppDataDir(): string {
  return path.join(os.homedir(), 'AppData', 'Roaming', 'LegalMind');
}

export function getDataDir(): string {
  const dataDir = path.join(getAppDataDir(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

export function getEnvFilePath(): string {
  return path.join(getAppDataDir(), '.env');
}
