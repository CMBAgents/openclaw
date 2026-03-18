import type { AnyAgentTool } from "../../src/agents/tools/common.js";
import { emptyPluginConfigSchema } from "../../src/plugins/config-schema.js";
import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import {
  createArxivTool,
  createDeepResearchTool,
  createDeleteProjectTool,
  createEnhanceTool,
  createHealthTool,
  createIdeaTool,
  createKeywordsTool,
  createLiteratureTool,
  createListProjectsTool,
  createMethodsTool,
  createOcrTool,
  createOneShotTool,
  createPaperTool,
  createProjectReviewTool,
  createProjectTool,
  createReviewTool,
} from "./src/tools.js";

const airSdkPlugin = {
  id: "air-sdk",
  name: "AIR SDK Plugin",
  description:
    "AI Research (AIR) platform tools for scientific research: keywords, arXiv, enhance, OCR, paper review, project management, and full research pipeline (idea, literature, methods, results, paper, review).",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    // Standalone tools
    api.registerTool(createHealthTool(api) as AnyAgentTool);
    api.registerTool(createKeywordsTool(api) as AnyAgentTool);
    api.registerTool(createArxivTool(api) as AnyAgentTool);
    api.registerTool(createEnhanceTool(api) as AnyAgentTool);
    api.registerTool(createOcrTool(api) as AnyAgentTool);
    api.registerTool(createReviewTool(api) as AnyAgentTool);
    // Project management
    api.registerTool(createProjectTool(api) as AnyAgentTool);
    api.registerTool(createListProjectsTool(api) as AnyAgentTool);
    api.registerTool(createDeleteProjectTool(api) as AnyAgentTool);
    // Pipeline steps
    api.registerTool(createIdeaTool(api) as AnyAgentTool);
    api.registerTool(createLiteratureTool(api) as AnyAgentTool);
    api.registerTool(createMethodsTool(api) as AnyAgentTool);
    api.registerTool(createPaperTool(api) as AnyAgentTool);
    api.registerTool(createProjectReviewTool(api) as AnyAgentTool);
    // One-shot & deep research (local code execution via Python)
    api.registerTool(createOneShotTool(api) as AnyAgentTool);
    api.registerTool(createDeepResearchTool(api) as AnyAgentTool);
  },
};

export default airSdkPlugin;
