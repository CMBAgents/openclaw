import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ProviderWrapStreamFnContext } from "openclaw/plugin-sdk/plugin-entry";
import { composeProviderStreamWrappers } from "openclaw/plugin-sdk/provider-stream-shared";

// Translate OpenAI-style thinking signals emitted by buildOpenAICompletionsParams
// (reasoning / reasoning_effort / reasoningEffort) into the vLLM wire format
// for models that expose thinking through chat_template_kwargs — notably
// Gemma 4 31B served via vLLM. Without this, a local Gemma endpoint silently
// ignores `reasoning_effort` and the model never enters thinking mode.
//
// The mapping is intentionally binary: any non-empty effort becomes
// chat_template_kwargs.enable_thinking=true; absence means leave thinking off.
// The openai-style fields are dropped so vLLM doesn't surface a warning about
// unknown request fields.
export function createVllmChatTemplateThinkingWrapper(
  baseStreamFn: StreamFn | undefined,
): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  return (model, context, options) => {
    const originalOnPayload = options?.onPayload;
    return underlying(model, context, {
      ...options,
      onPayload: (payload) => {
        if (payload && typeof payload === "object") {
          const payloadObj = payload as Record<string, unknown>;
          const effort =
            payloadObj.reasoning_effort ??
            (payloadObj.reasoning as { effort?: unknown } | undefined)?.effort;
          if (effort !== undefined && effort !== null && effort !== "off") {
            const extraBody =
              (payloadObj.extra_body as Record<string, unknown> | undefined) ?? {};
            const chatTemplateKwargs =
              (extraBody.chat_template_kwargs as Record<string, unknown> | undefined) ?? {};
            if (chatTemplateKwargs.enable_thinking === undefined) {
              chatTemplateKwargs.enable_thinking = true;
            }
            extraBody.chat_template_kwargs = chatTemplateKwargs;
            payloadObj.extra_body = extraBody;
          }
          delete payloadObj.reasoning;
          delete payloadObj.reasoning_effort;
          delete (payloadObj as Record<string, unknown>).reasoningEffort;
        }
        return originalOnPayload?.(payload, model);
      },
    });
  };
}

export function wrapVllmProviderStream(ctx: ProviderWrapStreamFnContext): StreamFn | undefined {
  return composeProviderStreamWrappers(ctx.streamFn, (streamFn) => {
    return createVllmChatTemplateThinkingWrapper(streamFn);
  });
}
