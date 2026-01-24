// Google Gemini models only
export const DEFAULT_CHAT_MODEL = "google/gemini-3-flash-preview";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro (Preview)",
    provider: "google",
    description: "Preview - Advanced model, may have availability issues",
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash (Preview)",
    provider: "google",
    description: "Preview - Fast model, may have availability issues",
  },
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description: "Fast and efficient for everyday tasks",
  },
  {
    id: "google/gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    description: "Most capable Google model for complex tasks",
  },
];

// Group models by provider for UI
export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
