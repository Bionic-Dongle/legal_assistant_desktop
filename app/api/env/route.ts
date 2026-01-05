import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper function to safely update or insert a key-value pair in the .env file
function updateEnvFile(key: string, value: string) {
  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = '';

  try {
    envContent = fs.readFileSync(envPath, 'utf-8');
  } catch (err) {
    console.warn('.env file not found, creating a new one.');
  }

  const envLines = envContent.split('\n');
  const keyIndex = envLines.findIndex((line) => line.startsWith(`${key}=`));

  if (keyIndex !== -1) {
    envLines[keyIndex] = `${key}=${value}`;
  } else {
    envLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envPath, envLines.join('\n'));
  process.env[key] = value; // Update runtime environment variable
}

export async function POST(request: Request) {
  try {
    const { key, value } = await request.json();

    if (!key || typeof value !== 'string') {
      return NextResponse.json({ error: 'Invalid key or value' }, { status: 400 });
    }

    updateEnvFile(key, value);

    return NextResponse.json({ success: true, message: `${key} updated successfully.` });
  } catch (error) {
    console.error('Error updating .env file:', error);
    return NextResponse.json({ error: 'Failed to update .env file' }, { status: 500 });
  }
}
