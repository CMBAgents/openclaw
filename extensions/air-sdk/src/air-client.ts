import { execFile } from "node:child_process";
import { withTrustedWebToolsEndpoint } from "../../../src/agents/tools/web-guarded-fetch.js";
import { resolveAirApiKey, resolveAirBaseUrl } from "./config.js";

function getHeaders(): Record<string, string> {
  const apiKey = resolveAirApiKey();
  if (!apiKey) {
    throw new Error("AIR_API_KEY environment variable is not set.");
  }
  return {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function airPost(
  path: string,
  body: Record<string, unknown>,
  timeoutSeconds = 120,
): Promise<Record<string, unknown>> {
  const baseUrl = resolveAirBaseUrl();
  return await withTrustedWebToolsEndpoint(
    {
      url: `${baseUrl}${path}`,
      timeoutSeconds,
      init: {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
      },
    },
    async ({ response }) => {
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`AIR API error (${response.status}): ${detail}`);
      }
      return (await response.json()) as Record<string, unknown>;
    },
  );
}

async function airGet(path: string, timeoutSeconds = 120): Promise<Record<string, unknown>> {
  const baseUrl = resolveAirBaseUrl();
  return await withTrustedWebToolsEndpoint(
    {
      url: `${baseUrl}${path}`,
      timeoutSeconds,
      init: {
        method: "GET",
        headers: getHeaders(),
      },
    },
    async ({ response }) => {
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`AIR API error (${response.status}): ${detail}`);
      }
      return (await response.json()) as Record<string, unknown>;
    },
  );
}

async function airDelete(path: string, timeoutSeconds = 120): Promise<Record<string, unknown>> {
  const baseUrl = resolveAirBaseUrl();
  return await withTrustedWebToolsEndpoint(
    {
      url: `${baseUrl}${path}`,
      timeoutSeconds,
      init: {
        method: "DELETE",
        headers: getHeaders(),
      },
    },
    async ({ response }) => {
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`AIR API error (${response.status}): ${detail}`);
      }
      return (await response.json()) as Record<string, unknown>;
    },
  );
}

export async function airKeywords(params: {
  text: string;
  n: number;
  kwType: string;
}): Promise<Record<string, unknown>> {
  const result = await airPost("/api/v1/keywords", {
    text: params.text,
    n_keywords: params.n,
    kw_type: params.kwType,
  });
  return { keywords: result.keywords };
}

export async function airArxiv(params: { text: string }): Promise<Record<string, unknown>> {
  const result = await airPost("/api/v1/arxiv", { text: params.text });
  return (result.result as Record<string, unknown>) ?? {};
}

export async function airEnhance(params: {
  text: string;
  maxWorkers: number;
  maxDepth: number;
  resolveReferences: boolean;
  maxReferences: number;
}): Promise<Record<string, unknown>> {
  const result = await airPost("/api/v1/enhance", {
    text: params.text,
    max_workers: params.maxWorkers,
    max_depth: params.maxDepth,
    resolve_references: params.resolveReferences,
    max_references: params.maxReferences,
  });
  return { enhanced_text: result.enhanced_text ?? "" };
}

export async function airOcr(params: { filePath: string }): Promise<Record<string, unknown>> {
  const result = await airPost("/api/v1/ocr", { file_path: params.filePath });
  return (result.result as Record<string, unknown>) ?? {};
}

export async function airReview(params: {
  filePath: string;
  thoroughness: string;
  figuresReview: boolean;
  verifyStatements: boolean;
  reviewMaths: boolean;
  reviewNumerics: boolean;
}): Promise<Record<string, unknown>> {
  const result = await airPost(
    "/api/v1/review",
    {
      file_path: params.filePath,
      thoroughness: params.thoroughness,
      figures_review: params.figuresReview,
      verify_statements: params.verifyStatements,
      review_maths: params.reviewMaths,
      review_numerics: params.reviewNumerics,
    },
    3600,
  );
  const taskId = result.task_id as string;

  // Poll for completion
  const deadline = Date.now() + 3600_000;
  while (Date.now() < deadline) {
    const status = await airGet(`/api/v1/tasks/${taskId}`);
    if (status.status === "completed") {
      const taskResult = await airGet(`/api/v1/tasks/${taskId}/result`);
      return taskResult;
    }
    if (status.status === "failed") {
      const taskResult = await airGet(`/api/v1/tasks/${taskId}/result`);
      throw new Error(`Review task failed: ${JSON.stringify(taskResult)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Review task ${taskId} timed out`);
}

export async function airCreateProject(params: {
  name: string;
  dataDescription: string;
}): Promise<Record<string, unknown>> {
  return await airPost("/api/v1/projects", {
    name: params.name,
    data_description: params.dataDescription,
    iteration: 0,
  });
}

export async function airListProjects(): Promise<Record<string, unknown>> {
  return await airGet("/api/v1/projects");
}

export async function airDeleteProject(params: { name: string }): Promise<Record<string, unknown>> {
  return await airDelete(`/api/v1/projects/${encodeURIComponent(params.name)}`);
}

export async function airHealth(): Promise<Record<string, unknown>> {
  return await airGet("/api/health");
}

// ---------------------------------------------------------------------------
// Poll helper for async tasks
// ---------------------------------------------------------------------------

async function pollTask(taskId: string, timeoutMs = 600_000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await airGet(`/api/v1/tasks/${taskId}`);
    if (status.status === "completed") {
      return await airGet(`/api/v1/tasks/${taskId}/result`);
    }
    if (status.status === "failed") {
      const result = await airGet(`/api/v1/tasks/${taskId}/result`);
      throw new Error(`Task ${taskId} failed: ${JSON.stringify(result)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Task ${taskId} timed out after ${timeoutMs / 1000}s`);
}

// ---------------------------------------------------------------------------
// Project pipeline steps
// ---------------------------------------------------------------------------

export async function airProjectIdea(params: {
  project: string;
  mode?: string;
  iteration?: number;
  defaultModel?: string;
  criticModel?: string;
  ideaIterations?: number;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    mode: params.mode ?? "fast",
    iteration: params.iteration ?? 0,
    idea_iterations: params.ideaIterations ?? 3,
  };
  if (params.defaultModel) body.default_model = params.defaultModel;
  if (params.criticModel) body.default_formatter_model = params.criticModel;
  const result = await airPost(
    `/api/v1/projects/${encodeURIComponent(params.project)}/idea`,
    body,
    params.timeout ?? 600,
  );
  const taskId = result.task_id as string;
  return await pollTask(taskId, (params.timeout ?? 600) * 1000);
}

export async function airProjectLiterature(params: {
  project: string;
  iteration?: number;
  maxIterations?: number;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    iteration: params.iteration ?? 0,
  };
  if (params.maxIterations) body.max_iterations = params.maxIterations;
  const result = await airPost(
    `/api/v1/projects/${encodeURIComponent(params.project)}/literature`,
    body,
    params.timeout ?? 900,
  );
  const taskId = result.task_id as string;
  return await pollTask(taskId, (params.timeout ?? 900) * 1000);
}

export async function airProjectMethods(params: {
  project: string;
  mode?: string;
  iteration?: number;
  defaultModel?: string;
  criticModel?: string;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    mode: params.mode ?? "fast",
    iteration: params.iteration ?? 0,
  };
  if (params.defaultModel) body.default_model = params.defaultModel;
  if (params.criticModel) body.default_formatter_model = params.criticModel;
  const result = await airPost(
    `/api/v1/projects/${encodeURIComponent(params.project)}/methods`,
    body,
    params.timeout ?? 600,
  );
  const taskId = result.task_id as string;
  return await pollTask(taskId, (params.timeout ?? 600) * 1000);
}

export async function airProjectPaper(params: {
  project: string;
  journal?: string;
  iteration?: number;
  defaultModel?: string;
  addCitations?: boolean;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    journal: params.journal ?? "NONE",
    iteration: params.iteration ?? 0,
    add_citations: params.addCitations ?? false,
  };
  if (params.defaultModel) body.default_model = params.defaultModel;
  const result = await airPost(
    `/api/v1/projects/${encodeURIComponent(params.project)}/paper`,
    body,
    params.timeout ?? 900,
  );
  const taskId = result.task_id as string;
  return await pollTask(taskId, (params.timeout ?? 900) * 1000);
}

export async function airProjectReview(params: {
  project: string;
  iteration?: number;
  reviewEngine?: string;
  thoroughness?: string;
  figuresReview?: boolean;
  verifyStatements?: boolean;
  reviewMaths?: boolean;
  reviewNumerics?: boolean;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    iteration: params.iteration ?? 0,
  };
  if (params.reviewEngine) body.review_engine = params.reviewEngine;
  if (params.thoroughness) body.review_thoroughness = params.thoroughness;
  if (params.figuresReview) body.review_figures = params.figuresReview;
  if (params.verifyStatements) body.review_verify_statements = params.verifyStatements;
  if (params.reviewMaths) body.review_maths = params.reviewMaths;
  if (params.reviewNumerics) body.review_numerics = params.reviewNumerics;
  const result = await airPost(
    `/api/v1/projects/${encodeURIComponent(params.project)}/review`,
    body,
    params.timeout ?? 600,
  );
  const taskId = result.task_id as string;
  return await pollTask(taskId, (params.timeout ?? 600) * 1000);
}

// ---------------------------------------------------------------------------
// one_shot & deep_research — spawn Python with air-sdk
// ---------------------------------------------------------------------------

function resolveAirPython(): string {
  if (process.env.AIR_PYTHON_PATH) return process.env.AIR_PYTHON_PATH;
  if (process.env.AIR_VENV_PATH) {
    const venvBin = process.platform === "win32" ? "Scripts/python.exe" : "bin/python";
    return `${process.env.AIR_VENV_PATH}/${venvBin}`;
  }
  return "python3";
}

function runPythonScript(script: string, timeoutMs: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const pythonPath = resolveAirPython();
    execFile(
      pythonPath,
      ["-c", script],
      {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Python execution failed: ${error.message}\nstderr: ${stderr}`));
          return;
        }
        try {
          const lines = stdout.trim().split("\n");
          const result = JSON.parse(lines[lines.length - 1]);
          resolve(result as Record<string, unknown>);
        } catch {
          resolve({ output: stdout, stderr });
        }
      },
    );
  });
}

function escPy(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function airOneShot(params: {
  task: string;
  agent?: string;
  model?: string;
  maxRounds?: number;
  maxAttempts?: number;
  enableVlmReview?: boolean;
  vlmModel?: string;
  maxVlmReviewAttempts?: number;
  codeExecutionTimeout?: number;
  workDir?: string;
  venvPath?: string;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const timeoutSec = params.timeout ?? 600;
  const opts: string[] = [];
  if (params.model) opts.push(`model='${escPy(params.model)}',`);
  if (params.vlmModel) opts.push(`vlm_model='${escPy(params.vlmModel)}',`);
  if (params.workDir) opts.push(`work_dir='${escPy(params.workDir)}',`);
  const venv = process.env.AIR_VENV_PATH ?? params.venvPath;
  if (venv) opts.push(`venv_path='${escPy(venv)}',`);
  if (params.codeExecutionTimeout)
    opts.push(`code_execution_timeout=${params.codeExecutionTimeout},`);
  if (params.maxVlmReviewAttempts)
    opts.push(`max_vlm_review_attempts=${params.maxVlmReviewAttempts},`);
  const script = [
    "import os, json, air",
    "client = air.AIR(",
    "    api_key=os.environ['AIR_API_KEY'],",
    "    base_url=os.environ.get('AIR_BASE_URL', 'http://localhost:8000'),",
    ")",
    "result = client.one_shot(",
    `    task='${escPy(params.task)}',`,
    `    agent='${params.agent ?? "engineer"}',`,
    ...opts.map((o) => `    ${o}`),
    `    max_rounds=${params.maxRounds ?? 25},`,
    `    max_attempts=${params.maxAttempts ?? 3},`,
    `    enable_vlm_review=${params.enableVlmReview ? "True" : "False"},`,
    `    timeout=${timeoutSec},`,
    ")",
    "print(json.dumps({",
    "    'task_id': result.task_id,",
    "    'work_dir': result.work_dir,",
    "    'output': (result.output or '')[:5000],",
    "    'files_created': [f.path for f in result.files_created],",
    "    'error': result.error,",
    "}))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, timeoutSec * 1000 + 30_000);
}

export async function airDeepResearch(params: {
  task: string;
  engineerModel?: string;
  researcherModel?: string;
  plannerModel?: string;
  planReviewerModel?: string;
  maxPlanSteps?: number;
  nPlanReviews?: number;
  maxRoundsPlanning?: number;
  maxRounds?: number;
  maxAttempts?: number;
  planInstructions?: string;
  engineerInstructions?: string;
  researcherInstructions?: string;
  hardwareConstraints?: string;
  enableVlmReview?: boolean;
  vlmModel?: string;
  maxVlmReviewAttempts?: number;
  adaptivePlanning?: boolean;
  adaptivePlannerModel?: string;
  codeExecutionTimeout?: number;
  workDir?: string;
  venvPath?: string;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const timeoutSec = params.timeout ?? 3600;
  const opts: string[] = [];
  if (params.engineerModel) opts.push(`engineer_model='${escPy(params.engineerModel)}',`);
  if (params.researcherModel) opts.push(`researcher_model='${escPy(params.researcherModel)}',`);
  if (params.plannerModel) opts.push(`planner_model='${escPy(params.plannerModel)}',`);
  if (params.planReviewerModel)
    opts.push(`plan_reviewer_model='${escPy(params.planReviewerModel)}',`);
  if (params.planInstructions) opts.push(`plan_instructions='${escPy(params.planInstructions)}',`);
  if (params.engineerInstructions)
    opts.push(`engineer_instructions='${escPy(params.engineerInstructions)}',`);
  if (params.researcherInstructions)
    opts.push(`researcher_instructions='${escPy(params.researcherInstructions)}',`);
  if (params.hardwareConstraints)
    opts.push(`hardware_constraints='${escPy(params.hardwareConstraints)}',`);
  if (params.vlmModel) opts.push(`vlm_model='${escPy(params.vlmModel)}',`);
  if (params.maxVlmReviewAttempts)
    opts.push(`max_vlm_review_attempts=${params.maxVlmReviewAttempts},`);
  if (params.adaptivePlanning) opts.push("adaptive_planning=True,");
  if (params.adaptivePlannerModel)
    opts.push(`adaptive_planner_model='${escPy(params.adaptivePlannerModel)}',`);
  if (params.codeExecutionTimeout)
    opts.push(`code_execution_timeout=${params.codeExecutionTimeout},`);
  if (params.maxRoundsPlanning) opts.push(`max_rounds_planning=${params.maxRoundsPlanning},`);
  if (params.workDir) opts.push(`work_dir='${escPy(params.workDir)}',`);
  const venv = process.env.AIR_VENV_PATH ?? params.venvPath;
  if (venv) opts.push(`venv_path='${escPy(venv)}',`);
  const script = [
    "import os, json, air",
    "client = air.AIR(",
    "    api_key=os.environ['AIR_API_KEY'],",
    "    base_url=os.environ.get('AIR_BASE_URL', 'http://localhost:8000'),",
    ")",
    "result = client.deep_research(",
    `    task='${escPy(params.task)}',`,
    ...opts.map((o) => `    ${o}`),
    `    max_plan_steps=${params.maxPlanSteps ?? 3},`,
    `    n_plan_reviews=${params.nPlanReviews ?? 1},`,
    `    max_rounds=${params.maxRounds ?? 100},`,
    `    max_attempts=${params.maxAttempts ?? 3},`,
    `    enable_vlm_review=${params.enableVlmReview ? "True" : "False"},`,
    `    timeout=${timeoutSec},`,
    ")",
    "print(json.dumps({",
    "    'task_id': result.task_id,",
    "    'work_dir': result.work_dir,",
    "    'output': (result.output or '')[:5000],",
    "    'files_created': [f.path for f in result.files_created],",
    "    'error': result.error,",
    "}))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, timeoutSec * 1000 + 30_000);
}
