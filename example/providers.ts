import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";
import { createNearAI } from "./providers/near-ai-sdk";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const nearAI = createNearAI({
  apiKey: process.env.NEAR_AI_API_KEY,
  endpoint: process.env.NEAR_AI_ENDPOINT,
});

if (!process.env.ANTHROPIC_API_KEY && !isTestEnvironment) {
  console.warn(
    "ANTHROPIC_API_KEY is not set. Claude models will not be available.",
  );
}

if (!process.env.NEAR_AI_API_KEY && !isTestEnvironment) {
  console.warn(
    "NEAR_AI_API_KEY is not set. NEAR AI models will not be available.",
  );
}

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": google("gemini-2.0-flash-exp"),
        "chat-model-reasoning": wrapLanguageModel({
          model: google("gemini-2.0-flash-thinking-exp-1219"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": google("gemini-2.0-flash-exp"),
        "artifact-model": google("gemini-2.0-flash-exp"),
        // Claude models with skill support
        "claude-flash": anthropic("claude-3-5-haiku-20241022"),
        "claude-sonnet": anthropic("claude-3-5-sonnet-20241022"),
        "claude-sonnet-4-5": anthropic("claude-sonnet-4-5"),
        "claude-opus": anthropic("claude-3-opus-20240229"),
        // NEAR AI models with privacy-preserving inference
        "near-deepseek-v3": nearAI("deepseek-ai/DeepSeek-V3.1"),
        "near-glm-4": nearAI("zai-org/GLM-4.6-FP8"),
        "near-gpt-oss": nearAI("openai/gpt-oss-120b"),
        "near-qwen-3": nearAI("Qwen/Qwen3-30B-A3B-Instruct-2507"),
      },
    });
