import { Type } from "@sinclair/typebox";
import { optionalStringEnum } from "../../../src/agents/schema/typebox.js";
import { jsonResult, readNumberParam, readStringParam } from "../../../src/agents/tools/common.js";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import {
  airArxiv,
  airCreateProject,
  airDeepResearch,
  airDeleteProject,
  airEnhance,
  airHealth,
  airKeywords,
  airListProjects,
  airOcr,
  airOneShot,
  airProjectIdea,
  airProjectLiterature,
  airProjectMethods,
  airProjectPaper,
  airProjectReview,
  airReview,
} from "./air-client.js";

// ---------------------------------------------------------------------------
// air_keywords
// ---------------------------------------------------------------------------

const KeywordsSchema = Type.Object(
  {
    text: Type.String({ description: "Input text to extract keywords from." }),
    n: Type.Optional(
      Type.Number({ description: "Number of keywords to extract.", minimum: 1, maximum: 50 }),
    ),
    kw_type: optionalStringEnum(["unesco", "aas", "aaai"] as const, {
      description: 'Keyword taxonomy: "unesco", "aas", or "aaai". Default: "unesco".',
    }),
  },
  { additionalProperties: false },
);

export function createKeywordsTool(_api: OpenClawPluginApi) {
  return {
    name: "air_keywords",
    label: "AIR Keywords",
    description:
      "Extract scientific keywords from text using the AIR platform. Supports UNESCO, AAS, and AAAI taxonomies.",
    parameters: KeywordsSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const text = readStringParam(rawParams, "text", { required: true });
      const n = readNumberParam(rawParams, "n", { integer: true }) ?? 5;
      const kwType = readStringParam(rawParams, "kw_type") ?? "unesco";
      return jsonResult(await airKeywords({ text, n, kwType }));
    },
  };
}

// ---------------------------------------------------------------------------
// air_arxiv
// ---------------------------------------------------------------------------

const ArxivSchema = Type.Object(
  {
    text: Type.String({ description: "Text containing arXiv URLs to download and summarize." }),
  },
  { additionalProperties: false },
);

export function createArxivTool(_api: OpenClawPluginApi) {
  return {
    name: "air_arxiv",
    label: "AIR arXiv",
    description: "Extract arXiv URLs from text, download the papers, and return summaries.",
    parameters: ArxivSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const text = readStringParam(rawParams, "text", { required: true });
      return jsonResult(await airArxiv({ text }));
    },
  };
}

// ---------------------------------------------------------------------------
// air_enhance
// ---------------------------------------------------------------------------

const EnhanceSchema = Type.Object(
  {
    text: Type.String({
      description:
        "Text to enhance with contextual information from referenced papers (supports arXiv, bioRxiv, PubMed URLs and loose references).",
    }),
    max_workers: Type.Optional(
      Type.Number({ description: "Parallel download workers.", minimum: 1 }),
    ),
    max_depth: Type.Optional(Type.Number({ description: "Max summarization depth.", minimum: 1 })),
    resolve_references: Type.Optional(
      Type.Boolean({
        description: "Resolve loose references like 'Smith et al. 2020' to arXiv papers.",
      }),
    ),
    max_references: Type.Optional(
      Type.Number({ description: "Max number of loose references to resolve.", minimum: 1 }),
    ),
  },
  { additionalProperties: false },
);

export function createEnhanceTool(_api: OpenClawPluginApi) {
  return {
    name: "air_enhance",
    label: "AIR Enhance",
    description:
      "Enhance text with contextual information from referenced papers. Supports arXiv, bioRxiv, PubMed URLs and loose bibliographic references.",
    parameters: EnhanceSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const text = readStringParam(rawParams, "text", { required: true });
      const maxWorkers = readNumberParam(rawParams, "max_workers", { integer: true }) ?? 2;
      const maxDepth = readNumberParam(rawParams, "max_depth", { integer: true }) ?? 10;
      const resolveReferences =
        typeof rawParams.resolve_references === "boolean" ? rawParams.resolve_references : true;
      const maxReferences = readNumberParam(rawParams, "max_references", { integer: true }) ?? 10;
      return jsonResult(
        await airEnhance({ text, maxWorkers, maxDepth, resolveReferences, maxReferences }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// air_ocr
// ---------------------------------------------------------------------------

const OcrSchema = Type.Object(
  {
    file_path: Type.String({ description: "Path to a PDF file (server-side path or URL)." }),
  },
  { additionalProperties: false },
);

export function createOcrTool(_api: OpenClawPluginApi) {
  return {
    name: "air_ocr",
    label: "AIR OCR",
    description: "Process a PDF with OCR and return full text and markdown content.",
    parameters: OcrSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const filePath = readStringParam(rawParams, "file_path", { required: true });
      return jsonResult(await airOcr({ filePath }));
    },
  };
}

// ---------------------------------------------------------------------------
// air_review
// ---------------------------------------------------------------------------

const ReviewSchema = Type.Object(
  {
    file_path: Type.String({ description: "Path to the paper PDF (server-side path or URL)." }),
    thoroughness: optionalStringEnum(["Standard", "High"] as const, {
      description:
        '"Standard" (single reviewer) or "High" (two reviewers merged). Default: "Standard".',
    }),
    figures_review: Type.Optional(
      Type.Boolean({ description: "Enable detailed figure/diagram analysis." }),
    ),
    verify_statements: Type.Optional(
      Type.Boolean({ description: "Enable key statement verification." }),
    ),
    review_maths: Type.Optional(
      Type.Boolean({ description: "Enable mathematical derivation audit." }),
    ),
    review_numerics: Type.Optional(
      Type.Boolean({ description: "Enable numerical computation audit." }),
    ),
  },
  { additionalProperties: false },
);

export function createReviewTool(_api: OpenClawPluginApi) {
  return {
    name: "air_review",
    label: "AIR Review",
    description:
      "Review a scientific paper PDF using Skepthical. Returns a detailed peer review with optional math, numerics, figures, and statement verification.",
    parameters: ReviewSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const filePath = readStringParam(rawParams, "file_path", { required: true });
      const thoroughness = readStringParam(rawParams, "thoroughness") ?? "Standard";
      const figuresReview =
        typeof rawParams.figures_review === "boolean" ? rawParams.figures_review : false;
      const verifyStatements =
        typeof rawParams.verify_statements === "boolean" ? rawParams.verify_statements : false;
      const reviewMaths =
        typeof rawParams.review_maths === "boolean" ? rawParams.review_maths : false;
      const reviewNumerics =
        typeof rawParams.review_numerics === "boolean" ? rawParams.review_numerics : false;
      return jsonResult(
        await airReview({
          filePath,
          thoroughness,
          figuresReview,
          verifyStatements,
          reviewMaths,
          reviewNumerics,
        }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// air_create_project
// ---------------------------------------------------------------------------

const CreateProjectSchema = Type.Object(
  {
    name: Type.String({ description: "Project name (used as directory name on the server)." }),
    data_description: Type.Optional(
      Type.String({ description: "Description of the research data/topic." }),
    ),
  },
  { additionalProperties: false },
);

export function createProjectTool(_api: OpenClawPluginApi) {
  return {
    name: "air_create_project",
    label: "AIR Create Project",
    description:
      "Create a new AIR research project for running the full pipeline (idea, literature, methods, results, paper, review).",
    parameters: CreateProjectSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const name = readStringParam(rawParams, "name", { required: true });
      const dataDescription = readStringParam(rawParams, "data_description") ?? "";
      return jsonResult(await airCreateProject({ name, dataDescription }));
    },
  };
}

// ---------------------------------------------------------------------------
// air_list_projects
// ---------------------------------------------------------------------------

const ListProjectsSchema = Type.Object({}, { additionalProperties: false });

export function createListProjectsTool(_api: OpenClawPluginApi) {
  return {
    name: "air_list_projects",
    label: "AIR List Projects",
    description: "List all AIR research projects.",
    parameters: ListProjectsSchema,
    execute: async (_toolCallId: string, _rawParams: Record<string, unknown>) => {
      return jsonResult(await airListProjects());
    },
  };
}

// ---------------------------------------------------------------------------
// air_delete_project
// ---------------------------------------------------------------------------

const DeleteProjectSchema = Type.Object(
  {
    name: Type.String({ description: "Name of the project to delete." }),
  },
  { additionalProperties: false },
);

export function createDeleteProjectTool(_api: OpenClawPluginApi) {
  return {
    name: "air_delete_project",
    label: "AIR Delete Project",
    description: "Delete an AIR research project.",
    parameters: DeleteProjectSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const name = readStringParam(rawParams, "name", { required: true });
      return jsonResult(await airDeleteProject({ name }));
    },
  };
}

// ---------------------------------------------------------------------------
// air_health
// ---------------------------------------------------------------------------

const HealthSchema = Type.Object({}, { additionalProperties: false });

export function createHealthTool(_api: OpenClawPluginApi) {
  return {
    name: "air_health",
    label: "AIR Health",
    description: "Check if the AIR backend is healthy and reachable.",
    parameters: HealthSchema,
    execute: async (_toolCallId: string, _rawParams: Record<string, unknown>) => {
      return jsonResult(await airHealth());
    },
  };
}

// ---------------------------------------------------------------------------
// air_idea — generate a research idea for a project
// ---------------------------------------------------------------------------

const IdeaSchema = Type.Object(
  {
    project: Type.String({ description: "Project name (must already exist)." }),
    default_model: Type.Optional(
      Type.String({
        description:
          "LLM for idea generation (e.g. claude-sonnet-4-6, gemini-3.1-flash-lite-preview).",
      }),
    ),
    critic_model: Type.Optional(Type.String({ description: "LLM for the idea critic." })),
    idea_iterations: Type.Optional(
      Type.Number({ description: "Number of maker/critic rounds (default 3).", minimum: 1 }),
    ),
  },
  { additionalProperties: false },
);

export function createIdeaTool(_api: OpenClawPluginApi) {
  return {
    name: "air_idea",
    label: "AIR Idea",
    description:
      "Generate a research idea for an existing AIR project. The idea is saved on the server and used as input for subsequent pipeline steps.",
    parameters: IdeaSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const project = readStringParam(rawParams, "project", { required: true });
      const defaultModel = readStringParam(rawParams, "default_model");
      const criticModel = readStringParam(rawParams, "critic_model");
      const ideaIterations = readNumberParam(rawParams, "idea_iterations", { integer: true });
      return jsonResult(
        await airProjectIdea({
          project,
          defaultModel: defaultModel ?? undefined,
          criticModel: criticModel ?? undefined,
          ideaIterations: ideaIterations ?? undefined,
        }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// air_literature — run literature search for a project
// ---------------------------------------------------------------------------

const LiteratureSchema = Type.Object(
  {
    project: Type.String({ description: "Project name (must have an idea generated first)." }),
    max_iterations: Type.Optional(
      Type.Number({
        description: "How many times Semantic Scholar is called (default 10).",
        minimum: 1,
      }),
    ),
  },
  { additionalProperties: false },
);

export function createLiteratureTool(_api: OpenClawPluginApi) {
  return {
    name: "air_literature",
    label: "AIR Literature",
    description:
      "Run a literature search for an AIR project using Semantic Scholar. Requires that an idea has already been generated.",
    parameters: LiteratureSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const project = readStringParam(rawParams, "project", { required: true });
      const maxIterations = readNumberParam(rawParams, "max_iterations", { integer: true });
      return jsonResult(
        await airProjectLiterature({
          project,
          maxIterations: maxIterations ?? undefined,
          timeout: 900,
        }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// air_methods — develop methods for a project
// ---------------------------------------------------------------------------

const MethodsSchema = Type.Object(
  {
    project: Type.String({ description: "Project name." }),
    default_model: Type.Optional(Type.String({ description: "LLM for the methods writer." })),
    critic_model: Type.Optional(
      Type.String({ description: "LLM for the methods reviewer/critic." }),
    ),
  },
  { additionalProperties: false },
);

export function createMethodsTool(_api: OpenClawPluginApi) {
  return {
    name: "air_methods",
    label: "AIR Methods",
    description:
      "Develop research methods for an AIR project. Requires idea and literature to exist.",
    parameters: MethodsSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const project = readStringParam(rawParams, "project", { required: true });
      const defaultModel = readStringParam(rawParams, "default_model");
      const criticModel = readStringParam(rawParams, "critic_model");
      return jsonResult(
        await airProjectMethods({
          project,
          defaultModel: defaultModel ?? undefined,
          criticModel: criticModel ?? undefined,
        }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// air_paper — write a paper for a project
// ---------------------------------------------------------------------------

const PaperSchema = Type.Object(
  {
    project: Type.String({ description: "Project name." }),
    journal: Type.Optional(
      Type.String({
        description: 'Target journal (e.g. "AAS", "MNRAS", "NONE"). Default: "NONE".',
      }),
    ),
    default_model: Type.Optional(Type.String({ description: "LLM for paper writing." })),
    add_citations: Type.Optional(
      Type.Boolean({ description: "Include bibliography from literature search." }),
    ),
  },
  { additionalProperties: false },
);

export function createPaperTool(_api: OpenClawPluginApi) {
  return {
    name: "air_paper",
    label: "AIR Paper",
    description:
      "Write a LaTeX paper for an AIR project. Requires idea, literature, methods, and results to exist.",
    parameters: PaperSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const project = readStringParam(rawParams, "project", { required: true });
      const journal = readStringParam(rawParams, "journal");
      const defaultModel = readStringParam(rawParams, "default_model");
      const addCitations =
        typeof rawParams.add_citations === "boolean" ? rawParams.add_citations : undefined;
      return jsonResult(
        await airProjectPaper({
          project,
          journal: journal ?? undefined,
          defaultModel: defaultModel ?? undefined,
          addCitations: addCitations ?? undefined,
        }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// air_project_review — review a project's paper
// ---------------------------------------------------------------------------

const ProjectReviewSchema = Type.Object(
  {
    project: Type.String({ description: "Project name." }),
    review_engine: optionalStringEnum(["denario", "skepthical"] as const, {
      description: 'Review engine: "denario" (default) or "skepthical".',
    }),
    thoroughness: optionalStringEnum(["Standard", "High"] as const, {
      description:
        'Skepthical only. "Standard" (single reviewer) or "High" (two reviewers merged).',
    }),
    figures_review: Type.Optional(
      Type.Boolean({ description: "Skepthical only. Enable detailed figure analysis." }),
    ),
    verify_statements: Type.Optional(
      Type.Boolean({ description: "Skepthical only. Enable statement verification." }),
    ),
    review_maths: Type.Optional(
      Type.Boolean({ description: "Skepthical only. Enable mathematical audit." }),
    ),
    review_numerics: Type.Optional(
      Type.Boolean({ description: "Skepthical only. Enable numerical audit." }),
    ),
  },
  { additionalProperties: false },
);

export function createProjectReviewTool(_api: OpenClawPluginApi) {
  return {
    name: "air_project_review",
    label: "AIR Project Review",
    description: "Review a project's paper using Denario or Skepthical review engine.",
    parameters: ProjectReviewSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const project = readStringParam(rawParams, "project", { required: true });
      const reviewEngine = readStringParam(rawParams, "review_engine");
      const thoroughness = readStringParam(rawParams, "thoroughness");
      const figuresReview =
        typeof rawParams.figures_review === "boolean" ? rawParams.figures_review : undefined;
      const verifyStatements =
        typeof rawParams.verify_statements === "boolean" ? rawParams.verify_statements : undefined;
      const reviewMaths =
        typeof rawParams.review_maths === "boolean" ? rawParams.review_maths : undefined;
      const reviewNumerics =
        typeof rawParams.review_numerics === "boolean" ? rawParams.review_numerics : undefined;
      return jsonResult(
        await airProjectReview({
          project,
          reviewEngine: reviewEngine ?? undefined,
          thoroughness: thoroughness ?? undefined,
          figuresReview: figuresReview ?? undefined,
          verifyStatements: verifyStatements ?? undefined,
          reviewMaths: reviewMaths ?? undefined,
          reviewNumerics: reviewNumerics ?? undefined,
        }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// air_one_shot — execute a one-shot task with local code execution
// ---------------------------------------------------------------------------

const OneShotSchema = Type.Object(
  {
    task: Type.String({ description: "Natural-language description of the task to execute." }),
    agent: optionalStringEnum(["engineer", "researcher"] as const, {
      description: 'Agent type: "engineer" (default) or "researcher".',
    }),
    model: Type.Optional(
      Type.String({
        description:
          "LLM model (e.g. gemini-3.1-flash-lite-preview, gpt-5-nano, claude-sonnet-4-6). Uses server default if omitted.",
      }),
    ),
    max_rounds: Type.Optional(
      Type.Number({ description: "Maximum agent conversation rounds (default 25).", minimum: 1 }),
    ),
    max_attempts: Type.Optional(
      Type.Number({ description: "Retry attempts on failure (default 3).", minimum: 1 }),
    ),
    enable_vlm_review: Type.Optional(
      Type.Boolean({ description: "Enable VLM-based review of generated plots." }),
    ),
    vlm_model: Type.Optional(Type.String({ description: "Model to use for VLM review." })),
    work_dir: Type.Optional(
      Type.String({
        description: "Local directory for code and outputs. Defaults to ~/ai-scientist.",
      }),
    ),
    venv_path: Type.Optional(
      Type.String({
        description: "Path to an existing Python virtual environment for code execution.",
      }),
    ),
    timeout: Type.Optional(
      Type.Number({
        description: "Max seconds for the entire session (default 600).",
        minimum: 30,
      }),
    ),
  },
  { additionalProperties: false },
);

export function createOneShotTool(_api: OpenClawPluginApi) {
  return {
    name: "air_one_shot",
    label: "AIR One-Shot",
    description:
      "Execute a one-shot task: the AI agent writes code which runs locally in an isolated venv. Returns output, created files, and work directory. Good for data analysis, plotting, code generation.",
    parameters: OneShotSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const task = readStringParam(rawParams, "task", { required: true });
      const agent = readStringParam(rawParams, "agent");
      const model = readStringParam(rawParams, "model");
      const maxRounds = readNumberParam(rawParams, "max_rounds", { integer: true });
      const maxAttempts = readNumberParam(rawParams, "max_attempts", { integer: true });
      const enableVlmReview =
        typeof rawParams.enable_vlm_review === "boolean" ? rawParams.enable_vlm_review : undefined;
      const vlmModel = readStringParam(rawParams, "vlm_model");
      const workDir = readStringParam(rawParams, "work_dir");
      const venvPath = readStringParam(rawParams, "venv_path");
      const timeout = readNumberParam(rawParams, "timeout", { integer: true });
      return jsonResult(
        await airOneShot({
          task,
          agent: agent ?? undefined,
          model: model ?? undefined,
          maxRounds: maxRounds ?? undefined,
          maxAttempts: maxAttempts ?? undefined,
          enableVlmReview: enableVlmReview ?? undefined,
          vlmModel: vlmModel ?? undefined,
          workDir: workDir ?? undefined,
          venvPath: venvPath ?? undefined,
          timeout: timeout ?? undefined,
        }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// air_deep_research — multi-step planning + execution with local code
// ---------------------------------------------------------------------------

const DeepResearchSchema = Type.Object(
  {
    task: Type.String({ description: "Natural-language description of the research task." }),
    engineer_model: Type.Optional(Type.String({ description: "LLM for the engineer agent." })),
    researcher_model: Type.Optional(Type.String({ description: "LLM for the researcher agent." })),
    planner_model: Type.Optional(Type.String({ description: "LLM for the planner agent." })),
    plan_reviewer_model: Type.Optional(Type.String({ description: "LLM for the plan reviewer." })),
    max_plan_steps: Type.Optional(
      Type.Number({ description: "Maximum number of plan steps (default 3).", minimum: 1 }),
    ),
    n_plan_reviews: Type.Optional(
      Type.Number({ description: "Number of plan review rounds (default 1).", minimum: 0 }),
    ),
    max_rounds: Type.Optional(
      Type.Number({
        description: "Max conversation rounds per control step (default 100).",
        minimum: 1,
      }),
    ),
    max_attempts: Type.Optional(
      Type.Number({ description: "Retry attempts per step (default 3).", minimum: 1 }),
    ),
    plan_instructions: Type.Optional(
      Type.String({
        description: "Extra instructions for the planner (e.g. '1. engineer, 2. researcher.').",
      }),
    ),
    engineer_instructions: Type.Optional(
      Type.String({ description: "Extra instructions for the engineer agent." }),
    ),
    researcher_instructions: Type.Optional(
      Type.String({ description: "Extra instructions for the researcher agent." }),
    ),
    hardware_constraints: Type.Optional(
      Type.String({ description: "Hardware constraint description for agents." }),
    ),
    enable_vlm_review: Type.Optional(
      Type.Boolean({ description: "Enable VLM-based review of generated plots." }),
    ),
    work_dir: Type.Optional(
      Type.String({
        description: "Local directory for code and outputs. Defaults to ~/ai-scientist.",
      }),
    ),
    venv_path: Type.Optional(
      Type.String({
        description: "Path to an existing Python virtual environment for code execution.",
      }),
    ),
    timeout: Type.Optional(
      Type.Number({
        description: "Max seconds for the entire session (default 3600).",
        minimum: 60,
      }),
    ),
  },
  { additionalProperties: false },
);

export function createDeepResearchTool(_api: OpenClawPluginApi) {
  return {
    name: "air_deep_research",
    label: "AIR Deep Research",
    description:
      "Execute a multi-step deep research task with planning and specialized agents. The planner designs steps, then engineer and researcher agents execute them with local code execution. Good for complex scientific analysis, data processing pipelines, and multi-step investigations.",
    parameters: DeepResearchSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const task = readStringParam(rawParams, "task", { required: true });
      const engineerModel = readStringParam(rawParams, "engineer_model");
      const researcherModel = readStringParam(rawParams, "researcher_model");
      const plannerModel = readStringParam(rawParams, "planner_model");
      const planReviewerModel = readStringParam(rawParams, "plan_reviewer_model");
      const maxPlanSteps = readNumberParam(rawParams, "max_plan_steps", { integer: true });
      const nPlanReviews = readNumberParam(rawParams, "n_plan_reviews", { integer: true });
      const maxRounds = readNumberParam(rawParams, "max_rounds", { integer: true });
      const maxAttempts = readNumberParam(rawParams, "max_attempts", { integer: true });
      const planInstructions = readStringParam(rawParams, "plan_instructions");
      const engineerInstructions = readStringParam(rawParams, "engineer_instructions");
      const researcherInstructions = readStringParam(rawParams, "researcher_instructions");
      const hardwareConstraints = readStringParam(rawParams, "hardware_constraints");
      const enableVlmReview =
        typeof rawParams.enable_vlm_review === "boolean" ? rawParams.enable_vlm_review : undefined;
      const workDir = readStringParam(rawParams, "work_dir");
      const venvPath = readStringParam(rawParams, "venv_path");
      const timeout = readNumberParam(rawParams, "timeout", { integer: true });
      return jsonResult(
        await airDeepResearch({
          task,
          engineerModel: engineerModel ?? undefined,
          researcherModel: researcherModel ?? undefined,
          plannerModel: plannerModel ?? undefined,
          planReviewerModel: planReviewerModel ?? undefined,
          maxPlanSteps: maxPlanSteps ?? undefined,
          nPlanReviews: nPlanReviews ?? undefined,
          maxRounds: maxRounds ?? undefined,
          maxAttempts: maxAttempts ?? undefined,
          planInstructions: planInstructions ?? undefined,
          engineerInstructions: engineerInstructions ?? undefined,
          researcherInstructions: researcherInstructions ?? undefined,
          hardwareConstraints: hardwareConstraints ?? undefined,
          enableVlmReview: enableVlmReview ?? undefined,
          workDir: workDir ?? undefined,
          venvPath: venvPath ?? undefined,
          timeout: timeout ?? undefined,
        }),
      );
    },
  };
}
