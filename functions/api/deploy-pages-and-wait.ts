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

type GateInput = {
  branch: string;
  commitSha: string;
  deploymentId: string;
  requireSuccess: boolean;
};

// Keep every public HTTP request safely below Cloudflare's proxy timeout.
// Make can chain several of these deterministic windows for long builds.
const WAIT_WINDOW_MS = 80_000;
const POLL_MS = 5_000;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const DEPLOYMENT_ID_PATTERN = /^[0-9a-f-]{20,80}$/i;
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
    };
  }

  if (contentType.toLowerCase().includes('application/json')) {
    const data = (await request.json()) as Record<string, unknown>;
    return {
      branch: typeof data.branch === 'string' ? data.branch.trim() : '',
      commitSha: typeof data.commit_sha === 'string' ? data.commit_sha.trim() : '',
      deploymentId: typeof data.deployment_id === 'string' ? data.deployment_id.trim() : '',
      requireSuccess: asBoolean(data.require_success),
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

  // Git integration may win the race for the same commit.
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

function validateDeployment(deployment: PagesDeployment, input: GateInput) {
  const commit = deployedCommit(deployment);
  const branch = deployedBranch(deployment);
  if (commit && commit.toLowerCase() !== input.commitSha.toLowerCase()) return 'deployment_commit_mismatch';
  if (branch && branch !== input.branch) return 'deployment_branch_mismatch';
  return '';
}

function successResponse(deployment: PagesDeployment, input: GateInput, reused: boolean) {
  return json({
    ok: true,
    pending: false,
    status: 'success',
    deployment_id: deployment.id || null,
    deployment_url: deployment.url || null,
    commit_sha: input.commitSha,
    branch: input.branch,
    reused_existing_deployment: reused,
  });
}

function pendingResponse(deployment: PagesDeployment | null, input: GateInput, reused: boolean) {
  const status = deployment ? statusOf(deployment) : 'locating';
  const body = {
    ok: false,
    pending: true,
    status,
    deployment_id: deployment?.id || null,
    deployment_url: deployment?.url || null,
    commit_sha: input.commitSha,
    branch: input.branch,
    reused_existing_deployment: reused,
  };

  if (input.requireSuccess) {
    return json({ ...body, error: 'cloudflare_deployment_still_pending' }, 504);
  }
  return json(body, 202);
}

async function deployAndWaitWindow({ request, env }: RequestContext) {
  if (!env.SOCIAL_CARD_RENDERER_SECRET) return json({ error: 'bridge_not_configured' }, 503);
  if (request.headers.get('Authorization') !== `Bearer ${env.SOCIAL_CARD_RENDERER_SECRET}`) {
    return json({ error: 'unauthorized' }, 401);
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  const project = env.CLOUDFLARE_PAGES_PROJECT?.trim();
  if (!accountId || !token || !project) return json({ error: 'cloudflare_pages_not_configured' }, 503);
  if (!PROJECT_PATTERN.test(project)) return json({ error: 'invalid_pages_project' }, 500);

  let input: GateInput;
  try {
    input = await parseInput(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_request';
    return json({ error: code === 'unsupported_content_type' ? code : 'invalid_request' }, code === 'unsupported_content_type' ? 415 : 400);
  }

  if (input.branch !== 'main') return json({ error: 'branch_must_be_main' }, 400);
  if (!SHA_PATTERN.test(input.commitSha)) return json({ error: 'invalid_commit_sha' }, 400);
  if (input.deploymentId && !DEPLOYMENT_ID_PATTERN.test(input.deploymentId)) return json({ error: 'invalid_deployment_id' }, 400);

  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(project)}`;
  const deadline = Date.now() + WAIT_WINDOW_MS;

  try {
    let deployment: PagesDeployment | null = null;
    let reusedExistingDeployment = false;

    if (input.deploymentId) {
      deployment = await cfRequest<PagesDeployment>(`${base}/deployments/${encodeURIComponent(input.deploymentId)}`, token);
      reusedExistingDeployment = true;
    } else {
      deployment = await findDeployment(base, token, input.commitSha, input.branch);
      reusedExistingDeployment = Boolean(deployment);

      if (!deployment) {
        const form = new FormData();
        form.set('branch', input.branch);
        form.set('commit_hash', input.commitSha);
        form.set('commit_dirty', 'false');
        form.set('commit_message', `Make deterministic publish ${input.commitSha.slice(0, 12)}`);
        deployment = await createDeployment(`${base}/deployments`, token, form);
        reusedExistingDeployment = !deployment;
      }
    }

    // A 304 can briefly precede the deployment appearing in the list API.
    while (!deployment && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      deployment = await findDeployment(base, token, input.commitSha, input.branch);
    }

    if (!deployment) return pendingResponse(null, input, true);
    if (!deployment.id) return json({ error: 'cloudflare_missing_deployment_id' }, 502);
    const deploymentId = deployment.id;

    while (true) {
      const mismatch = validateDeployment(deployment, input);
      if (mismatch) return json({ error: mismatch, deployment_id: deploymentId }, 502);

      const status = statusOf(deployment);
      if (status === 'success') return successResponse(deployment, input, reusedExistingDeployment);
      if (status === 'failure' || status === 'canceled') {
        return json({ error: `cloudflare_deployment_${status}`, deployment_id: deploymentId }, 502);
      }
      if (Date.now() >= deadline) return pendingResponse(deployment, input, reusedExistingDeployment);

      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      deployment = await cfRequest<PagesDeployment>(`${base}/deployments/${encodeURIComponent(deploymentId)}`, token);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'cloudflare_request_failed';
    return json({ error: message.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) }, 502);
  }
}

export const onRequestPost = deployAndWaitWindow;
