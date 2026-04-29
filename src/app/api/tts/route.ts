import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = (body?.text || '').toString().trim();
    const profile = (body?.profile || 'jenny-neural').toString().trim() || 'jenny-neural';

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    // Use local voice profile helper; prefer Windows launcher on win32.
    const runner = process.platform === 'win32' ? 'py' : 'python3';
    const scriptPath = 'tools/voice_profile.py';
    const args = [scriptPath, 'speak', profile, text];

    const result = await new Promise<{ ok: boolean; stderr: string; code: number | null }>((resolve) => {
      const child = spawn(runner, args, {
        cwd: process.cwd(),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (err) => {
        resolve({ ok: false, stderr: err.message, code: -1 });
      });
      child.on('close', (code) => {
        resolve({ ok: code === 0, stderr, code });
      });
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: 'VOICE_PROFILE_FAILED', detail: result.stderr || `exit ${result.code}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    console.error('[tts] failed', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 }
    );
  }
}
