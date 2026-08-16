interface Env {
  SOCIAL_CARD_RENDERER_SECRET?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

type GateInput = {
  branch: string;
  commitSha: string;
  deploymentId: string;
  requireSuccess: boolean;
  probeUrl: string;
};

type PublicProbe = {
  ready: boolean;
  pageStatus: number;
  imageUrl: string;
  imageStatus: number | null;
};

// This endpoint is intentionally a PUBLIC-READINESS gate, not a deployment engine.
// Git/Cloudflare own the deployment. Make only needs to know when Facebook can
// fetch both the final page and its OG image without receiving a transient 404.
const WAIT_WINDOW_MS = 80_000;
const PUBLIC_PROBE_POLL_MS = 2_000;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const DEPLOYMENT_ID_PATTERN = /^[0-9a-f-]{20,80}$/i;
const PUBLIC_ORIGIN = 'https://guiadoproprietario.pt';
const FACEBOOK_CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function asBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}

async function parseInput(request: Request): Promise<GateInput> {
  const contentType = request.headers.get('Content-Type') || '';

  if (contentType.toLowerCase().includes('multipart/form-data')) {
    const form = await request.formData();
    return {
      branch: typeof form.get('branch') === 'string' ? String(form.get('branch')).trim() : '',
      commitSha: typeof form.get('commit_sha') === 'string' ? String(form.get('commit_sha')).trim() : '',
      deploymentId: typeof form.get('deployment_id') === 'string' ? String(form.get('deployment_id')).trim() : '',
      requireSuccess: asBoolean(form.get('require_success')),
      probeUrl: typeof form.get('probe_url') === 'string' ? String(form.get('probe_url')).trim() : '',
    };
  }

  if (contentType.toLowerCase().includes('application/json')) {
    const data = (await request.json()) as Record<string, unknown>;
    return {
      branch: typeof data.branch === 'string' ? data.branch.trim() : '',
      commitSha: typeof data.commit_sha === 'string' ? data.commit_sha.trim() : '',
      deploymentId: typeof data.deployment_id === 'string' ? data.deployment_id.trim() : '',
      requireSuccess: asBoolean(data.require_success),
      probeUrl: typeof data.probe_url === 'string' ? data.probe_url.trim() : '',
    };
  }

  throw new Error('unsupported_content_type');
}

function validatedPublicUrl(value: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.origin !== PUBLIC_ORIGIN) return '';
    if (url.protocol !== 'https:') return '';
    if (url.username || url.password) return '';
    if (url.pathname.startsWith('/api/')) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function extractOgImage(html: string, pageUrl: string) {
  const patterns = [
    /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      const url = new URL(match[1], pageUrl);
      if (url.protocol !== 'https:') return '';
      return url.toString();
    } catch {
      return '';
    }
  }

  return '';
}

async function fetchAsFacebook(url: string, accept: string) {
  const target = new URL(url);
  target.searchParams.set('__pages_gate', `${Date.now()}`);

  return fetch(target.toString(), {
    method: 'GET',
    redirect: 'follow',
    headers: {
      Accept: accept,
      'Cache-Control': 'no-cache',
      'User-Agent': FACEBOOK_CRAWLER_UA,
    },
  });
}

async function probePublicReadiness(pageUrl: string): Promise<PublicProbe> {
  try {
    const page = await fetchAsFacebook(pageUrl, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5');
    const pageStatus = page.status;

    if (pageStatus < 200 || pageStatus >= 300) {
      return { ready: false, pageStatus, imageUrl: '', imageStatus: null };
    }

    const contentType = page.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) {
      return { ready: false, pageStatus, imageUrl: '', imageStatus: null };
    }

    const html = await page.text();
    const imageUrl = extractOgImage(html, pageUrl);

    // A page without og:image is still publishable. If an OG image is declared,
    // however, do not release Facebook until that asset is also fetchable.
    if (!imageUrl) {
      return { ready: true, pageStatus, imageUrl: '', imageStatus: null };
    }

    try {
      const image = await fetchAsFacebook(imageUrl, 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8');
      const imageStatus = image.status;
      const imageType = image.headers.get('content-type') || '';
      const imageReady = imageStatus >= 200 && imageStatus < 300 && imageType.toLowerCase().startsWith('image/');
      return { ready: imageReady, pageStatus, imageUrl, imageStatus };
    } catch {
      return { ready: false, pageStatus, imageUrl, imageStatus: 0 };
    }
  } catch {
    return { ready: false, pageStatus: 0, imageUrl: '', imageStatus: null };
  }
}

async function waitForPublicReadiness(url: string, deadline: number) {
  let probe: PublicProbe = { ready: false, pageStatus: 0, imageUrl: '', imageStatus: null };

  while (Date.now() < deadline) {
    probe = await probePublicReadiness(url);
    if (probe.ready) return probe;
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, PUBLIC_PROBE_POLL_MS));
  }

  return probe;
}

async function deployAndWaitWindow({ request, env }: RequestContext) {
  if (!env.SOCIAL_CARD_RENDERER_SECRET) return json({ error: 'bridge_not_configured' }, 503);
  if (request.headers.get('Authorization') !== `Bearer ${env.SOCIAL_CARD_RENDERER_SECRET}`) {
    return json({ error: 'unauthorized' }, 401);
  }

  let input: GateInput;
  try {
    input = await parseInput(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_request';
    return json(
      { error: code === 'unsupported_content_type' ? code : 'invalid_request' },
      code === 'unsupported_content_type' ? 415 : 400,
    );
  }

  if (input.branch && input.branch !== 'main') return json({ error: 'branch_must_be_main' }, 400);
  if (input.commitSha && !SHA_PATTERN.test(input.commitSha)) return json({ error: 'invalid_commit_sha' }, 400);
  if (input.deploymentId && !DEPLOYMENT_ID_PATTERN.test(input.deploymentId)) {
    return json({ error: 'invalid_deployment_id' }, 400);
  }

  const probeUrl = validatedPublicUrl(input.probeUrl);
  if (!probeUrl) return json({ error: 'invalid_probe_url' }, 400);

  const deadline = Date.now() + WAIT_WINDOW_MS;
  const probe = await waitForPublicReadiness(probeUrl, deadline);

  if (probe.ready) {
    return json({
      ok: true,
      pending: false,
      status: 'success',
      commit_sha: input.commitSha || null,
      branch: input.branch || 'main',
      deployment_id: input.deploymentId || null,
      public_url_ready: true,
      probe_status: probe.pageStatus,
      og_image_url: probe.imageUrl || null,
      og_image_status: probe.imageStatus,
    });
  }

  const body = {
    ok: false,
    pending: true,
    status: 'waiting_for_public_url',
    commit_sha: input.commitSha || null,
    branch: input.branch || 'main',
    deployment_id: input.deploymentId || null,
    public_url_ready: false,
    probe_status: probe.pageStatus || null,
    og_image_url: probe.imageUrl || null,
    og_image_status: probe.imageStatus,
    error: 'public_assets_still_pending',
  };

  // Make can call the same gate again with the same payload. 202 is deliberate:
  // it is a successful HTTP transport response while signalling "not ready yet".
  // require_success is retained for backward compatibility but no longer turns a
  // transient publishing delay into a hard scenario failure.
  return json(body, 202);
}

export const onRequestPost = deployAndWaitWindow;
