import { Tool, ToolListUnion } from "@google/genai";
import { DeepSeekService, FileStructure } from "./deepseek";
import {
  GoogleGenAIService,
  GoogleAIChatCompletionResult,
} from "./google-genai";

export type AIProvider = "deepseek" | "google";

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  description?: string;
  isNew?: boolean;
  isHot?: boolean;
}

// DeepSeek model options
export const DEEPSEEK_MODELS: AIModelOption[] = [
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "deepseek",
    description: "General-purpose chat model",
  },
  {
    id: "deepseek-coder",
    name: "DeepSeek Coder",
    provider: "deepseek",
    description: "Specialized for coding tasks",
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    provider: "deepseek",
    description: "Advanced reasoning capabilities",
  },
];

// Google Gemini model options (Refreshed List)
export const GOOGLE_MODELS: AIModelOption[] = [
  {
    id: "gemini-2.5-pro-preview-03-25",
    name: "Gemini 2.5 Pro Preview 03-25",
    provider: "google",
    description: "Most capable model for complex tasks.",
    isHot: true,
    isNew: true,
  },
  {
    id: "gemini-2.0-flash-thinking-exp-01-21",
    name: "Gemini 2.0 Flash Thinking Exp 01-21",
    provider: "google",
    description: "Most capable model for complex tasks.",
    isHot: true,
    isNew: true,
  },
];

// Combined list of all models
export const ALL_AI_MODELS: AIModelOption[] = [
  ...DEEPSEEK_MODELS,
  ...GOOGLE_MODELS,
];

export interface AIServiceConfig {
  provider: AIProvider;
  model: string;
  deepseekApiKey?: string;
  googleApiKey?: string;
}

// Interface for chat message
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

// Unified AI service
export class AIService {
  private deepseekService: DeepSeekService;
  private googleService: GoogleGenAIService;
  private currentProvider: AIProvider;
  private currentModel: string;

  constructor(config: AIServiceConfig) {
    this.deepseekService = new DeepSeekService({
      apiKey: config.deepseekApiKey || process.env.DEEPSEEK_API_KEY || "",
    });

    this.googleService = new GoogleGenAIService({
      apiKey: config.googleApiKey || process.env.GOOGLE_AI_API_KEY || "",
    });

    this.currentProvider = config.provider;
    this.currentModel = config.model;
  }

  // Switch provider and model
  switchProvider(provider: AIProvider, model: string) {
    this.currentProvider = provider;
    this.currentModel = model;
  }

  // Get current provider and model
  getCurrentConfig(): { provider: AIProvider; model: string } {
    return {
      provider: this.currentProvider,
      model: this.currentModel,
    };
  }

  // Chat completion API
  async getChatCompletion(
    messages: ChatMessage[],
    options: any = {},
    tools?: ToolListUnion
  ): Promise<GoogleAIChatCompletionResult> {
    try {
      if (this.currentProvider === "deepseek") {
        const response = await this.deepseekService.getChatCompletion(
          messages as any[],
          undefined,
          { ...options, model: this.currentModel }
        );
        return { text: response.choices[0].message.content };
      } else {
        const response = await this.googleService.getChatCompletion(
          messages,
          this.currentModel,
          options,
          tools
        );
        return response;
      }
    } catch (error) {
      console.error("AI service error:", error);
      throw error;
    }
  }

  // Chat completion API
  async getChatCompletionStream(
    messages: ChatMessage[],
    options: any = {},
    onChunk: (chunk: string) => void,
    onEnd: () => void,
    onError: (error: Error) => void,
    tools?: ToolListUnion,
    toolCall?: (functionName: string, args: any) => Promise<void>
  ): Promise<void> {
    try {
      if (this.currentProvider === "deepseek") {
        await this.deepseekService.getChatCompletionStream(
          messages as any[],
          onEnd,
          onChunk,
          onError,
          { ...options, model: this.currentModel },
          tools
        );
      } else {
        await this.googleService.getChatCompletionStream(
          messages,
          this.currentModel,
          options,
          onChunk,
          onEnd,
          onError,
          tools,
          toolCall
        );
      }
    } catch (error) {
      console.error("AI service error:", error);
      throw error;
    }
  }

  // Generate project structure
  async generateProjectStructure(prompt: string): Promise<FileStructure> {
    try {
      if (this.currentProvider === "deepseek") {
        return await this.deepseekService.generateProjectStructure(prompt);
      } else {
        return await this.googleService.generateProjectStructure(
          prompt,
          this.currentModel
        );
      }
    } catch (error) {
      console.error("Project structure generation error:", error);
      throw error;
    }
  }

  // Generate file content
  async generateFileContent(prompt: string, filePath: string): Promise<string> {
    try {
      if (this.currentProvider === "deepseek") {
        return await this.deepseekService.generateFileContent(prompt, filePath);
      } else {
        return await this.googleService.generateFileContent(
          prompt,
          filePath,
          this.currentModel
        );
      }
    } catch (error) {
      console.error("File content generation error:", error);
      throw error;
    }
  }
}
