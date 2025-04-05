import { log } from "console";
import { FileStructure } from "./deepseek";
import {
  GoogleGenAI,
  Content,
  GenerateContentResponse,
  Part,
  Tool,
  FunctionCall,
  FunctionDeclaration,
  ToolListUnion,
  FunctionCallingConfigMode,
} from "@google/genai";

export interface GoogleGenAIConfig {
  apiKey: string;
}

interface Message {
  role: string;
  content: string;
}

interface GoogleAIChatResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
      role: string;
    };
    finishReason: string;
    index: number;
  }[];
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface GoogleAIChatCompletionResult {
  text?: string;
  toolCalls?: { name: string; args: any }[];
  error?: string;
}

export class GoogleGenAIService {
  private genAI: GoogleGenAI;
  private contextCache: Map<string, string> = new Map();
  private defaultModel: string = "gemini-1.5-pro-preview-0325";

  constructor(config: GoogleGenAIConfig) {
    this.genAI = new GoogleGenAI({
      apiKey: config.apiKey || process.env.GOOGLE_AI_API_KEY || "",
    });
    if (!config.apiKey && !process.env.GOOGLE_AI_API_KEY) {
      console.warn(
        "GoogleGenAIService: API key not provided. Service might not work."
      );
    }
  }

  // Text completion API (using generateContent)
  async getCompletion(
    prompt: string,
    model: string = this.defaultModel,
    options: any = {}
  ): Promise<string> {
    try {
      const result = await this.genAI.models.generateContent({
        model,
        contents: [prompt],
      });

      return result.text || "";
    } catch (error) {
      console.error("Google AI completion error:", error);
      throw error;
    }
  }

  // Chat completion API - Updated for Tool Calling
  async getChatCompletion(
    messages: Array<{ role: string; content: string | Part[] }>,
    model: string = this.defaultModel,
    options: { temperature?: number; max_tokens?: number } = {},
    tools?: Tool[]
  ): Promise<GoogleAIChatCompletionResult> {
    try {
      // 1. Format messages and separate system instruction
      const contents: Content[] = [];

      for (const msg of messages) {
        if (msg.role === "system") {
          if (typeof msg.content === "string") {
            contents.push({
              role: "model",
              parts: [{ text: msg.content }],
            });
          } else if (Array.isArray(msg.content)) {
            contents.push({
              role: "model",
              parts: msg.content,
            });
          }
        } else if (
          msg.role === "user" ||
          msg.role === "model" ||
          msg.role === "tool"
        ) {
          let parts: Part[];
          if (typeof msg.content === "string") {
            parts = [{ text: msg.content }];
          } else if (Array.isArray(msg.content)) {
            parts = msg.content;
          } else {
            console.warn("Unsupported message content type:", msg.content);
            parts = [{ text: JSON.stringify(msg.content) }];
          }

          contents.push({
            role: msg.role,
            parts: parts,
          });
        }
      }

      // 2. Construct the request object
      const generationConfig: any = {};
      if (options.temperature !== undefined) {
        generationConfig.temperature = options.temperature;
      }
      if (options.max_tokens !== undefined) {
        generationConfig.maxOutputTokens = options.max_tokens;
      }

      // 3. Call the API
      const result = await this.genAI.models.generateContent({
        contents: contents,
        model: model,
        config: {
          ...generationConfig,
          tools: tools,
        },
      });

      console.log("tools", tools);

      // 4. Parse the response - Handle Text and Function Calls
      const candidate = result.candidates?.[0];
      if (!candidate) {
        console.error(
          "Google AI chat completion error: No candidates found in response.",
          result
        );
        return { error: "No response candidates found." };
      }

      const content = candidate.content;
      if (!content || !content.parts || content.parts.length === 0) {
        if (candidate.finishReason && candidate.finishReason !== "STOP") {
          console.warn(`Google AI finishReason: ${candidate.finishReason}`);
          return {
            error: `Generation stopped due to: ${candidate.finishReason}`,
          };
        }
        console.error(
          "Google AI chat completion error: No content parts found.",
          content
        );
        return { error: "No content parts found in response." };
      }

      const firstPart = content.parts[0];

      if (firstPart.text) {
        return { text: firstPart.text };
      } else if (firstPart.functionCall) {
        const functionCall = firstPart.functionCall;
        return {
          toolCalls: [
            { name: functionCall.name || "", args: functionCall.args },
          ],
        };
      } else {
        console.error(
          "Google AI chat completion error: Unknown part type.",
          firstPart
        );
        return { error: "Unknown response part type." };
      }
    } catch (error: any) {
      console.error("Google AI chat completion error:", error);
      if (error.message?.includes("API key not valid")) {
        return { error: "Google AI API key is invalid or missing." };
      }
      return { error: `Google AI Error: ${error.message || "Unknown error"}` };
    }
  }

  // Chat completion API - Updated for Tool Calling
  async getChatCompletionStream(
    messages: Array<{ role: string; content: string | Part[] }>,
    model: string = this.defaultModel,
    options: { temperature?: number; max_tokens?: number } = {},
    onChunk: (chunk: string) => void,
    onEnd: () => void,
    onError: (error: Error) => void,
    tools?: ToolListUnion,
    toolCall?: (functionName: string, args: any) => Promise<void>
  ): Promise<void> {
    try {
      // 1. Format messages and separate system instruction
      const contents: Content[] = [];

      for (const msg of messages) {
        if (msg.role === "system") {
          if (typeof msg.content === "string") {
            contents.push({
              role: "model",
              parts: [{ text: msg.content }],
            });
          } else if (Array.isArray(msg.content)) {
            contents.push({
              role: "model",
              parts: msg.content,
            });
          }
        } else if (
          msg.role === "user" ||
          msg.role === "model" ||
          msg.role === "tool"
        ) {
          let parts: Part[];
          if (typeof msg.content === "string") {
            parts = [{ text: msg.content }];
          } else if (Array.isArray(msg.content)) {
            parts = msg.content;
          } else {
            console.warn("Unsupported message content type:", msg.content);
            parts = [{ text: JSON.stringify(msg.content) }];
          }

          contents.push({
            role: msg.role,
            parts: parts,
          });
        }
      }

      // 2. Construct the request object
      const generationConfig: any = {};
      if (options.temperature !== undefined) {
        generationConfig.temperature = options.temperature;
      }
      if (options.max_tokens !== undefined) {
        generationConfig.maxOutputTokens = options.max_tokens;
      }

      // 3. Call the API
      const result = await this.genAI.models.generateContentStream({
        contents: contents,
        model: model,
        config: {
          ...generationConfig,
          tools: tools,
        },
      });

      for await (const chunk of result) {
        // check if chunk is function call
        if (chunk.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
          if (
            toolCall &&
            chunk.candidates[0].content.parts[0].functionCall.name &&
            chunk.candidates[0].content.parts[0].functionCall.args
          ) {
            toolCall(
              chunk.candidates[0].content.parts[0].functionCall.name,
              chunk.candidates[0].content.parts[0].functionCall.args
            );
          }
        }

        // chack text
        if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
          onChunk(chunk.candidates[0].content.parts[0].text || "");
        }
      }
      onEnd();
    } catch (error: any) {
      console.error("Google AI chat completion error:", error);
      if (error.message?.includes("API key not valid")) {
        onError(new Error("Google AI API key is invalid or missing."));
      }
      onError(
        new Error(`Google AI Error: ${error.message || "Unknown error"}`)
      );
    }
  }

  // Helper to format messages for Google AI's expected structure
  private formatMessagesForGoogle(
    messages: Array<{ role: string; content: string }>
  ): string[] {
    const formattedMessages = [];

    // Find system message if any
    const systemMessage = messages.find((msg) => msg.role === "system");
    let systemContent = "";

    if (systemMessage) {
      systemContent = systemMessage.content;
    }

    // Process regular messages
    for (const msg of messages) {
      if (msg.role === "system") continue;

      if (
        msg.role === "user" &&
        systemContent &&
        formattedMessages.length === 0
      ) {
        formattedMessages.push(`${systemContent}\n\n${msg.content}`);
      } else {
        formattedMessages.push(msg.content);
      }
    }

    return formattedMessages;
  }

  // Generate project structure
  async generateProjectStructure(
    prompt: string,
    model: string = "gemini-2.0-flash"
  ): Promise<FileStructure> {
    // Store the prompt in context cache for later file generation
    const cacheKey = `project:${prompt.substring(0, 50)}`;
    this.contextCache.set(cacheKey, prompt);

    // First, analyze what kind of project the user wants
    const analysisPrompt = `
    You are a professional software developer. Your task is to analyze what kind of project the user wants to build. 
    Based on the user's description, provide a brief analysis of:
    1. What programming languages should be used
    2. What frameworks or libraries might be needed
    3. What kind of project structure would be appropriate
    4. Any specific features that should be implemented

    User description: "${prompt}"
    `;

    const analysis = await this.getCompletion(analysisPrompt, model, {
      temperature: 0.5,
    });

    // Now, generate the project structure
    const structurePrompt = `
    You are a professional software developer who can design and create project structures based on user requirements.
    
    I need to create a project with the following requirements: ${prompt}
    
    Here's an analysis of what I might need: ${analysis}
    
    Please generate a JSON structure that represents the project files and directories. The structure should be in this exact format:
    
    {
      "projectName": "name_of_project",
      "files": [
        {
          "name": "filename",
          "type": "file",
          "path": "path/to/file",
          "content": "file content"
        },
        {
          "name": "dirname",
          "type": "directory",
          "path": "path/to/directory"
        }
      ],
      "description": "Brief description of project"
    }
    
    Only output valid JSON. Do not include any explanations, comments, or backticks.
    `;

    const structureResponse = await this.getCompletion(structurePrompt, model, {
      temperature: 0.2,
      max_tokens: 4096,
    });

    try {
      // Extract JSON from the response (in case there's any text around it)
      const jsonMatch = structureResponse.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : structureResponse;

      // Parse the JSON structure
      const projectData = JSON.parse(jsonStr);

      if (
        !projectData.projectName ||
        !projectData.files ||
        !Array.isArray(projectData.files)
      ) {
        throw new Error("Invalid project structure format");
      }

      // Convert flat file list to a nested structure (same as DeepSeek implementation)
      const rootStructure: FileStructure = {
        name: projectData.projectName,
        type: "directory",
        children: [],
      };

      // Create a map of paths to their directory objects
      const directoryMap: Record<string, FileStructure> = {
        "": rootStructure,
      };

      // First pass: create all directories
      for (const file of projectData.files) {
        if (file.type === "directory") {
          const pathParts = file.path.split("/").filter(Boolean);
          let currentPath = "";

          for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!directoryMap[currentPath]) {
              const newDir: FileStructure = {
                name: part,
                type: "directory",
                children: [],
              };

              directoryMap[currentPath] = newDir;

              if (
                directoryMap[parentPath] &&
                directoryMap[parentPath].children
              ) {
                directoryMap[parentPath].children.push(newDir);
              }
            }
          }
        }
      }

      // Second pass: add files to their parent directories
      for (const file of projectData.files) {
        if (file.type === "file") {
          const pathParts = file.path.split("/").filter(Boolean);
          const fileName = pathParts.pop() || file.name;
          const parentPath = pathParts.join("/");

          // Create parent directories if they don't exist
          let currentPath = "";
          for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!directoryMap[currentPath]) {
              const newDir: FileStructure = {
                name: part,
                type: "directory",
                children: [],
              };

              directoryMap[currentPath] = newDir;

              if (
                directoryMap[parentPath] &&
                directoryMap[parentPath].children
              ) {
                directoryMap[parentPath].children.push(newDir);
              }
            }
          }

          const fileObj: FileStructure = {
            name: fileName,
            type: "file",
            content: file.content || "",
          };

          if (directoryMap[parentPath] && directoryMap[parentPath].children) {
            directoryMap[parentPath].children.push(fileObj);
          } else {
            // If parent directory doesn't exist, add the file to the root
            rootStructure.children = rootStructure.children || [];
            rootStructure.children.push(fileObj);
          }
        }
      }

      return rootStructure;
    } catch (error) {
      console.error("Error parsing project structure:", error);
      throw new Error("Failed to generate valid project structure");
    }
  }

  async generateFileContent(
    prompt: string,
    filePath: string,
    model: string = "gemini-2.0-flash"
  ): Promise<string> {
    // Try to retrieve context from cache
    const contextKeys = Array.from(this.contextCache.keys()).filter((key) =>
      key.startsWith("project:")
    );

    let projectContext = "";
    if (contextKeys.length > 0) {
      // Use the most recent project context
      projectContext = this.contextCache.get(contextKeys[0]) || "";
    }

    // Parse the file path to understand what kind of file we're generating
    const pathParts = filePath.split("/");
    const fileName = pathParts[pathParts.length - 1];
    const fileExtension = fileName.includes(".")
      ? fileName.split(".").pop()?.toLowerCase() || ""
      : "";

    // Determine the programming language based on extension
    let language = "text";
    switch (fileExtension) {
      case "js":
        language = "JavaScript";
        break;
      case "ts":
        language = "TypeScript";
        break;
      case "jsx":
        language = "React JSX";
        break;
      case "tsx":
        language = "React TSX";
        break;
      case "css":
        language = "CSS";
        break;
      case "html":
        language = "HTML";
        break;
      case "json":
        language = "JSON";
        break;
      case "md":
        language = "Markdown";
        break;
      case "py":
        language = "Python";
        break;
      case "java":
        language = "Java";
        break;
      case "rb":
        language = "Ruby";
        break;
      case "go":
        language = "Go";
        break;
      case "php":
        language = "PHP";
        break;
      case "c":
      case "cpp":
      case "h":
        language = "C/C++";
        break;
      case "cs":
        language = "C#";
        break;
    }

    const fileGenerationPrompt = `
    You are a professional software developer tasked with generating a ${language} file.
    
    Project description: ${projectContext}
    
    File path: ${filePath}
    File name: ${fileName}
    
    Additional instructions: ${prompt}
    
    Generate appropriate, production-ready code for this file. 
    Make sure the code follows best practices and is well-commented.
    Only output the file content, no additional explanations.
    `;

    return await this.getCompletion(fileGenerationPrompt, model, {
      temperature: 0.2,
      max_tokens: 4096,
    });
  }
}
