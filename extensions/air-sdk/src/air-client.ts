import { execFile } from "node:child_process";

// ---------------------------------------------------------------------------
// Python / venv resolution
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
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
}

/** Build the standard `air.AIR(...)` constructor lines. */
function clientPreamble(): string[] {
  return [
    "import os, json, air",
    "client = air.AIR(",
    "    api_key=os.environ['AIR_API_KEY'],",
    "    base_url=os.environ.get('AIR_BASE_URL', 'http://localhost:8000'),",
    ")",
  ];
}

// ---------------------------------------------------------------------------
// Standalone tools
// ---------------------------------------------------------------------------

export async function airHealth(): Promise<Record<string, unknown>> {
  const script = [...clientPreamble(), "print(json.dumps(client.health()))", "client.close()"].join(
    "\n",
  );
  return await runPythonScript(script, 30_000);
}

export async function airKeywords(params: {
  text: string;
  n: number;
  kwType: string;
}): Promise<Record<string, unknown>> {
  const script = [
    ...clientPreamble(),
    `result = client.keywords('${escPy(params.text)}', n=${params.n}, kw_type='${escPy(params.kwType)}')`,
    "print(json.dumps({'keywords': result}))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, 120_000);
}

export async function airArxiv(params: { text: string }): Promise<Record<string, unknown>> {
  const script = [
    ...clientPreamble(),
    `result = client.arxiv('${escPy(params.text)}')`,
    "print(json.dumps(result))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, 300_000);
}

export async function airEnhance(params: {
  text: string;
  maxWorkers: number;
  maxDepth: number;
  resolveReferences: boolean;
  maxReferences: number;
}): Promise<Record<string, unknown>> {
  const script = [
    ...clientPreamble(),
    `result = client.enhance(`,
    `    '${escPy(params.text)}',`,
    `    max_workers=${params.maxWorkers},`,
    `    max_depth=${params.maxDepth},`,
    `    resolve_references=${params.resolveReferences ? "True" : "False"},`,
    `    max_references=${params.maxReferences},`,
    `)`,
    "print(json.dumps({'enhanced_text': result}))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, 600_000);
}

export async function airOcr(params: { filePath: string }): Promise<Record<string, unknown>> {
  const script = [
    ...clientPreamble(),
    `result = client.ocr('${escPy(params.filePath)}')`,
    "print(json.dumps(result))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, 300_000);
}

export async function airReview(params: {
  filePath: string;
  thoroughness: string;
  figuresReview: boolean;
  verifyStatements: boolean;
  reviewMaths: boolean;
  reviewNumerics: boolean;
}): Promise<Record<string, unknown>> {
  const script = [
    ...clientPreamble(),
    `result = client.review(`,
    `    '${escPy(params.filePath)}',`,
    `    thoroughness='${escPy(params.thoroughness)}',`,
    `    figures_review=${params.figuresReview ? "True" : "False"},`,
    `    verify_statements=${params.verifyStatements ? "True" : "False"},`,
    `    review_maths=${params.reviewMaths ? "True" : "False"},`,
    `    review_numerics=${params.reviewNumerics ? "True" : "False"},`,
    `)`,
    "print(json.dumps(result))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, 3_630_000);
}

// ---------------------------------------------------------------------------
// Project management
// ---------------------------------------------------------------------------

export async function airCreateProject(params: {
  name: string;
  dataDescription: string;
}): Promise<Record<string, unknown>> {
  const script = [
    ...clientPreamble(),
    `result = client.create_project('${escPy(params.name)}', data_description='${escPy(params.dataDescription)}')`,
    "print(json.dumps({'project': result.name, 'status': 'created'}))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, 60_000);
}

export async function airListProjects(): Promise<Record<string, unknown>> {
  const script = [
    ...clientPreamble(),
    "result = client.list_projects()",
    "print(json.dumps({'projects': result}))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, 60_000);
}

export async function airDeleteProject(params: { name: string }): Promise<Record<string, unknown>> {
  const script = [
    ...clientPreamble(),
    `result = client.delete_project('${escPy(params.name)}')`,
    "print(json.dumps({'deleted': True}))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, 60_000);
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
  const timeoutSec = params.timeout ?? 600;
  const opts: string[] = [];
  if (params.mode) opts.push(`mode='${escPy(params.mode)}',`);
  if (params.defaultModel) opts.push(`default_model='${escPy(params.defaultModel)}',`);
  if (params.criticModel) opts.push(`critic_model='${escPy(params.criticModel)}',`);
  if (params.ideaIterations) opts.push(`idea_iterations=${params.ideaIterations},`);
  const script = [
    ...clientPreamble(),
    `project = client.get_project('${escPy(params.project)}')`,
    `result = project.idea(`,
    ...opts.map((o) => `    ${o}`),
    `)`,
    "print(json.dumps(result))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, timeoutSec * 1000 + 30_000);
}

export async function airProjectLiterature(params: {
  project: string;
  iteration?: number;
  maxIterations?: number;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const timeoutSec = params.timeout ?? 900;
  const opts: string[] = [];
  if (params.maxIterations) opts.push(`max_iterations=${params.maxIterations},`);
  if (params.timeout) opts.push(`timeout=${params.timeout},`);
  const script = [
    ...clientPreamble(),
    `project = client.get_project('${escPy(params.project)}')`,
    `result = project.literature(`,
    ...opts.map((o) => `    ${o}`),
    `)`,
    "print(json.dumps(result))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, timeoutSec * 1000 + 30_000);
}

export async function airProjectMethods(params: {
  project: string;
  mode?: string;
  defaultModel?: string;
  criticModel?: string;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const timeoutSec = params.timeout ?? 600;
  const opts: string[] = [];
  if (params.mode) opts.push(`mode='${escPy(params.mode)}',`);
  if (params.defaultModel) opts.push(`default_model='${escPy(params.defaultModel)}',`);
  if (params.criticModel) opts.push(`critic_model='${escPy(params.criticModel)}',`);
  const script = [
    ...clientPreamble(),
    `project = client.get_project('${escPy(params.project)}')`,
    `result = project.methods(`,
    ...opts.map((o) => `    ${o}`),
    `)`,
    "print(json.dumps(result))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, timeoutSec * 1000 + 30_000);
}

export async function airProjectPaper(params: {
  project: string;
  journal?: string;
  defaultModel?: string;
  addCitations?: boolean;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const timeoutSec = params.timeout ?? 900;
  const opts: string[] = [];
  if (params.journal) opts.push(`journal='${escPy(params.journal)}',`);
  if (params.defaultModel) opts.push(`default_model='${escPy(params.defaultModel)}',`);
  if (params.addCitations !== undefined)
    opts.push(`add_citations=${params.addCitations ? "True" : "False"},`);
  const script = [
    ...clientPreamble(),
    `project = client.get_project('${escPy(params.project)}')`,
    `result = project.paper(`,
    ...opts.map((o) => `    ${o}`),
    `)`,
    "print(json.dumps(result))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, timeoutSec * 1000 + 30_000);
}

export async function airProjectReview(params: {
  project: string;
  reviewEngine?: string;
  thoroughness?: string;
  figuresReview?: boolean;
  verifyStatements?: boolean;
  reviewMaths?: boolean;
  reviewNumerics?: boolean;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const timeoutSec = params.timeout ?? 600;
  const opts: string[] = [];
  if (params.reviewEngine) opts.push(`review_engine='${escPy(params.reviewEngine)}',`);
  if (params.thoroughness) opts.push(`thoroughness='${escPy(params.thoroughness)}',`);
  if (params.figuresReview !== undefined)
    opts.push(`figures_review=${params.figuresReview ? "True" : "False"},`);
  if (params.verifyStatements !== undefined)
    opts.push(`verify_statements=${params.verifyStatements ? "True" : "False"},`);
  if (params.reviewMaths !== undefined)
    opts.push(`review_maths=${params.reviewMaths ? "True" : "False"},`);
  if (params.reviewNumerics !== undefined)
    opts.push(`review_numerics=${params.reviewNumerics ? "True" : "False"},`);
  const script = [
    ...clientPreamble(),
    `project = client.get_project('${escPy(params.project)}')`,
    `result = project.review(`,
    ...opts.map((o) => `    ${o}`),
    `)`,
    "print(json.dumps(result))",
    "client.close()",
  ].join("\n");
  return await runPythonScript(script, timeoutSec * 1000 + 30_000);
}

// ---------------------------------------------------------------------------
// one_shot & deep_research — WebSocket-based local code execution
// ---------------------------------------------------------------------------

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
    ...clientPreamble(),
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
    ...clientPreamble(),
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
