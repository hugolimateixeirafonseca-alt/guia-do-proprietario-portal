interface Env {
  SOCIAL_CARD_RENDERER_SECRET?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_PAGES_PROJECT?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

type CloudflareEnvelope<T> = {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: T;
};

type PagesDeployment = {
  id?: string;
  url?: string;
  environment?: 'production' | 'preview' | string;
  latest_stage?: {
    name?: string;
    status?: 'success' | 'idle' | 'active' | 'failure' | 'canceled' | string;
  };
  deployment_trigger?: {
    metadata?: {
      branch?: string;
      commit_hash?: string;
    };
  };
};

const MAX_WAIT_MS = 250_000;
// Workers Free allows 50 external subrequests per invocation. At 7s polling,
// the whole 250s gate remains comfortably below that ceiling.
const POLL_MS = 7_000;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const PROJECT_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/i;

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

function cloudflareErrorCode(payload: CloudflareEnvelope<unknown>) {
  const first = payload.errors?.[0];
  if (!first) return 'cloudflare_api_error';
  return first.code ? `cloudflare_api_error_${first.code}` : 'cloudflare_api_error';
}

async function parseInput(request: Request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    const form = await request.formData();
    return {
      branch: typeof form.get('branch') === 'string' ? String(form.get('branch')).trim() : '',
      commitSha: typeof form.get('commit_sha') === 'string' ? String(form.get('commit_sha')).trim() : '',
    };
  }

  if (contentType.toLowerCase().includes('application/json')) {
    const data = (await request.json()) as Record<string, unknown>;
    return {
      branch: typeof data.branch === 'string' ? data.branch.trim() : '',
      commitSha: typeof data.commit_sha === 'string' ? data.commit_sha.trim() : '',
    };
  }

  throw new Error('unsupported_content_type');
}

async function cfRequest<T>(url: string, token: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  let payload: CloudflareEnvelope<T>;
  try {
    payload = (await response.json()) as CloudflareEnvelope<T>;
  } catch {
    throw new Error(`cloudflare_invalid_response_${response.status}`);
  }

  if (!response.ok || payload.success === false || payload.result === undefined || payload.result === null) {
    throw new Error(`${cloudflareErrorCode(payload)}_${response.status}`);
  }

  return payload.result;
}

async function createDeployment(url: string, token: string, form: FormData) {
  const response = await fetch(url, {
    method: 'POST',
    body: form,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  // Cloudflare can return 304 when the Git integration has already created a
  // deployment for the exact same commit. That is a race, not a failure.
  if (response.status === 304) return null;

  let payload: CloudflareEnvelope<PagesDeployment>;
  try {
    payload = (await response.json()) as CloudflareEnvelope<PagesDeployment>;
  } catch {
    throw new Error(`cloudflare_invalid_response_${response.status}`);
  }

  if (!response.ok || payload.success === false || !payload.result) {
    throw new Error(`${cloudflareErrorCode(payload)}_${response.status}`);
  }

  return payload.result;
}

function deployedCommit(deployment: PagesDeployment) {
  return deployment.deployment_trigger?.metadata?.commit_hash?.trim() || '';
}

function deployedBranch(deployment: PagesDeployment) {
  return deployment.deployment_trigger?.metadata?.branch?.trim() || '';
}

function statusOf(deployment: PagesDeployment) {
  return deployment.latest_stage?.status || 'idle';
}

function selectMatchingDeployment(deployments: PagesDeployment[], commitSha: string, branch: string) {
  const matches = deployments.filter((deployment) => {
    const commit = deployedCommit(deployment);
    const deployedOnBranch = deployedBranch(deployment);
    return (
      commit.toLowerCase() === commitSha.toLowerCase() &&
      (!deployedOnBranch || deployedOnBranch === branch) &&
      (!deployment.environment || deployment.environment === 'production')
    );
  });

  return (
    matches.find((deployment) => statusOf(deployment) === 'success') ||
    matches.find((deployment) => ['active', 'idle'].includes(statusOf(deployment))) ||
    matches[0] ||
    null
  );
}

async function findDeployment(base: string, token: string, commitSha: string, branch: string) {
  const deployments = await cfRequest<PagesDeployment[]>(
    `${base}/deployments?env=production&page=1&per_page=25`,
    token,
  );
  return selectMatchingDeployment(deployments, commitSha, branch);
}

async function deployAndWait({ request, env }: RequestContext) {
  if (!env.SOCIAL_CARD_RENDERER_SECRET) return json({ error: 'bridge_not_configured' }, 503);
  if (request.headers.get('Authorization') !== `Bearer ${env.SOCIAL_CARD_RENDERER_SECRET}`) {
    return json({ error: 'unauthorized' }, 401);
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  const project = env.CLOUDFLARE_PAGES_PROJECT?.trim();
  if (!accountId || !token || !project) return json({ error: 'cloudflare_pages_not_configured' }, 503);
  if (!PROJECT_PATTERN.test(project)) return json({ error: 'invalid_pages_project' }, 500);

  let input: { branch: string; commitSha: string };
  try {
    input = await parseInput(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_request';
    return json({ error: code === 'unsupported_content_type' ? code : 'invalid_request' }, code === 'unsupported_content_type' ? 415 : 400);
  }

  if (input.branch !== 'main') return json({ error: 'branch_must_be_main' }, 400);
  if (!SHA_PATTERN.test(input.commitSha)) return json({ error: 'invalid_commit_sha' }, 400);

  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(project)}`;
  const deadline = Date.now() + MAX_WAIT_MS;

  try {
    // Prefer the deployment already started by the GitHub integration. This
    // avoids duplicate builds and makes the gate deterministic even when the
    // Git-triggered deployment wins the race by milliseconds.
    let deployment = await findDeployment(base, token, input.commitSha, input.branch);

    if (!deployment) {
      const form = new FormData();
      form.set('branch', input.branch);
      form.set('commit_hash', input.commitSha);
      form.set('commit_dirty', 'false');
      form.set('commit_message', `Make deterministic publish ${input.commitSha.slice(0, 12)}`);

      deployment = await createDeployment(`${base}/deployments`, token, form);
    }

    // A 304 means an equivalent deployment already exists but can race the
    // deployments-list index. Keep looking for that exact SHA until it appears.
    while (!deployment) {
      if (Date.now() >= deadline) return json({ error: 'deployment_not_found_after_304' }, 504);
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      deployment = await findDeployment(base, token, input.commitSha, input.branch);
    }

    if (!deployment.id) return json({ error: 'cloudflare_missing_deployment_id' }, 502);
    const deploymentId = deployment.id;

    while (true) {
      const status = statusOf(deployment);
      const commit = deployedCommit(deployment);
      const branch = deployedBranch(deployment);

      if (commit && commit.toLowerCase() !== input.commitSha.toLowerCase()) {
        return json({ error: 'deployment_commit_mismatch', deployment_id: deploymentId }, 502);
      }
      if (branch && branch !== input.branch) {
        return json({ error: 'deployment_branch_mismatch', deployment_id: deploymentId }, 502);
      }

      if (status === 'success') {
        return json({
          ok: true,
          deployment_id: deploymentId,
          status,
          commit_sha: input.commitSha,
          reused_existing_deployment: true,
          url: deployment.url || null,
        });
      }

      if (status === 'failure' || status === 'canceled') {
        return json({ error: `deployment_${status}`, deployment_id: deploymentId }, 502);
      }

      if (Date.now() >= deadline) {
        return json({ error: 'deployment_timeout', deployment_id: deploymentId }, 504);
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      deployment = await cfRequest<PagesDeployment>(`${base}/deployments/${encodeURIComponent(deploymentId)}`, token);
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : 'cloudflare_request_failed';
    return json({ error: code.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) }, 502);
  }
}

export const onRequest = async (context: RequestContext) => {
  if (context.request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  return deployAndWait(context);
};
