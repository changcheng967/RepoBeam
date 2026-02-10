import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';
import { syncFiles } from '@/lib/sync';

export const dynamic = 'force-dynamic';

// POST /api/webhook/github
export async function POST(request: NextRequest) {
  const signature = request.headers.get('X-Hub-Signature-256');
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  // If no webhook secret configured, skip verification (for development)
  if (webhookSecret && (!signature || signature === '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let rawBody = '';

  try {
    rawBody = await request.text();

    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      const expectedSignature = `sha256=${crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex')}`;

      if (signature !== expectedSignature) {
        console.error('[webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);

    // Only handle push events to main/master branch
    const branch = payload.ref?.replace('refs/heads/', '');
    if (payload.ref_type !== 'branch' && !branch) {
      return NextResponse.json({ received: true, skipped: 'not a push event' });
    }

    const fullName = payload.repository?.full_name;
    if (!fullName) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const [owner, name] = fullName.split('/');

    console.log(`[webhook] Received push for ${fullName} (${branch})`);

    // Get repo from database
    const { data: repo } = await supabase
      .from('repos')
      .select('*')
      .eq('full_name', fullName)
      .single();

    if (!repo) {
      console.log(`[webhook] Repository ${fullName} not tracked, skipping`);
      return NextResponse.json({ received: true, skipped: 'repository not tracked' }, { status: 202 });
    }

    // Get changed files from commits
    const changedFiles = new Set<string>();
    const deletedFiles = new Set<string>();

    if (payload.commits) {
      for (const commit of payload.commits) {
        commit.added?.forEach((f: string) => changedFiles.add(f));
        commit.modified?.forEach((f: string) => changedFiles.add(f));
        commit.removed?.forEach((f: string) => deletedFiles.add(f));
      }
    }

    // Delete removed files from database
    if (deletedFiles.size > 0) {
      console.log(`[webhook] Deleting ${deletedFiles.size} removed files`);
      for (const path of deletedFiles) {
        await supabase
          .from('files')
          .delete()
          .eq('repo_id', repo.id)
          .eq('path', path);
      }
    }

    // Sync changed files
    if (changedFiles.size > 0) {
      console.log(`[webhook] Syncing ${changedFiles.size} changed files: ${Array.from(changedFiles).join(', ')}`);
      syncFiles(repo.id, owner, name, Array.from(changedFiles)).catch(console.error);
    } else {
      console.log(`[webhook] No source files changed in ${fullName}`);
    }

    return NextResponse.json({
      received: true,
      repository: fullName,
      branch,
      files_added: changedFiles.size,
      files_deleted: deletedFiles.size,
    });
  } catch (error) {
    console.error('[webhook] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
