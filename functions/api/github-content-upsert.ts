interface Env {
  SOCIAL_CARD_RENDERER_SECRET?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

type UpsertInput = {
  path?: unknown;
  message?: unknown;
  content?: unknown;
  branch?: unknown;
};

type GitHubContent = {
  sha?: string;
};

const OWNER = 'hugolimateixeirafonseca-alt';
const REPO = 'guia-do-proprietario-portal';
const API_VERSION = '2022-11-28';
const ALLOWED_PATHS = [
  /^public\/social\/noticias\/[A-Za-z0-9._-]+\.png$/,
  /^src\/content\/notas\/[A-Za-z0-9._-]+\.mdx$/,
  /^public\/share\/noticias\/[A-Za-z0-9._-]+\/index\.html$/,
];

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

function encodePath(path: string) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function isAllowedPath(path: string) {
  return ALLOWED_PATHS.some((pattern) => pattern.test(path));
}

async function parseInput(request: Request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('unsupported_content_type');
  }
  return (await request.json()) as UpsertInput;
}

async function githubRequest(
  url: string,
  githubAuthorization: string,
  init: RequestInit = {},
) {
  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: githubAuthorization,
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'Guia-do-Proprietario-Pages-Upsert',
      ...(init.headers || {}),
    },
  });
}

async function upsert({ request, env }: RequestContext) {
  const bridgeSecret = env.SOCIAL_CARD_RENDERER_SECRET?.trim();
  if (!bridgeSecret) return json({ error: 'bridge_not_configured' }, 503);
  if (request.headers.get('Authorization') !== `Bearer ${bridgeSecret}`) {
    return json({ error: 'unauthorized' }, 401);
  }

  const githubAuthorization = request.headers.get('X-GitHub-Authorization')?.trim() || '';
  if (!githubAuthorization || githubAuthorization.length < 16) {
    return json({ error: 'github_authorization_missing' }, 401);
  }

  let raw: UpsertInput;
  try {
    raw = await parseInput(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_request';
    return json({ error: code === 'unsupported_content_type' ? code : 'invalid_request' }, code === 'unsupported_content_type' ? 415 : 400);
  }

  const path = typeof raw.path === 'string' ? raw.path.trim() : '';
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  const content = typeof raw.content === 'string' ? raw.content.trim() : '';
  const branch = typeof raw.branch === 'string' ? raw.branch.trim() : '';

  if (branch !== 'main') return json({ error: 'branch_must_be_main' }, 400);
  if (!path || path.includes('..') || !isAllowedPath(path)) return json({ error: 'path_not_allowed' }, 400);
  if (!message || message.length > 240) return json({ error: 'invalid_commit_message' }, 400);
  if (!content || content.length > 100_000_000) return json({ error: 'invalid_content' }, 400);

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodePath(path)}`;

  try {
    const lookup = await githubRequest(`${url}?ref=main`, githubAuthorization);
    let existingSha = '';

    if (lookup.status === 200) {
      const current = (await lookup.json()) as GitHubContent;
      existingSha = typeof current.sha === 'string' ? current.sha.trim() : '';
      if (!existingSha) return json({ error: 'github_existing_file_missing_sha' }, 502);
    } else if (lookup.status !== 404) {
      return json({ error: 'github_lookup_failed', github_status: lookup.status }, 502);
    }

    const body: Record<string, string> = {
      message,
      content,
      branch,
    };
    if (existingSha) body.sha = existingSha;

    const write = await githubRequest(url, githubAuthorization, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = await write.json().catch(() => null) as Record<string, unknown> | null;
    if (!write.ok || !payload) {
      return json({ error: 'github_write_failed', github_status: write.status }, 502);
    }

    // Return the native GitHub Contents response shape so existing Make mappings,
    // especially 15.data.commit.sha, keep working unchanged.
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-GitHub-Upsert-Mode': existingSha ? 'update' : 'create',
      },
    });
  } catch {
    return json({ error: 'github_request_failed' }, 502);
  }
}

export const onRequest = async (context: RequestContext) => {
  if (context.request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  return upsert(context);
};
