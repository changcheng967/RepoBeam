import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo } from '@/lib/supabase';
import crypto from 'crypto';
import { syncFiles } from '@/lib/sync';

export const dynamic = 'force-dynamic';

// POST /api/webhook/github
export async function POST(request: NextRequest) {
  const signature = request.headers.get('X-Hub-Signature-256');
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get raw body for signature verification
  const rawBody = await request.text();

  // Verify signature
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')}`;

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);

    // Only handle push events
    if (payload.ref_type !== 'branch' && !payload.ref) {
      return NextResponse.json({ received: true });
    }

    const fullName = payload.repository?.full_name;
    if (!fullName) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const [owner, name] = fullName.split('/');

    // Get repo from database
    const { data: repo } = await supabase
      .from('repos')
      .select('*')
      .eq('full_name', fullName)
      .single();

    if (!repo) {
      return NextResponse.json({ error: 'Repository not tracked' }, { status: 404 });
    }

    // Get changed files from commits
    const changedFiles = new Set<string>();
    if (payload.commits) {
      for (const commit of payload.commits) {
        commit.added?.forEach((f: string) => changedFiles.add(f));
        commit.modified?.forEach((f: string) => changedFiles.add(f));
      }
    }

    // Sync changed files
    if (changedFiles.size > 0) {
      syncFiles(repo.id, owner, name, Array.from(changedFiles)).catch(console.error);
    }

    return NextResponse.json({ received: true, files_changed: changedFiles.size });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
