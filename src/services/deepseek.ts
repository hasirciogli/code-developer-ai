export interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface FileStructure {
  name: string;
  type: "file" | "directory";
  content?: string;
  children?: FileStructure[];
}

interface DeepSeekCompletionResponse {
  id: string;
  choices: {
    text: string;
    index: number;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface DeepSeekChatResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
      function_call?: {
        name: string;
        arguments: string;
      };
    };
    finish_reason: string;
    index: number;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface ProjectFile {
  name: string;
  type: "file" | "directory";
  path: string;
  content?: string;
}

interface ProjectData {
  projectName: string;
  files: ProjectFile[];
  description?: string;
}

export class DeepSeekService {
  private apiKey: string;
  private baseUrl: string;
  private contextCache: Map<string, string> = new Map();

  constructor(config: DeepSeekConfig) {
    this.apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://api.deepseek.com/v1";
  }

  // Helper method for API requests
  private async makeApiRequest(endpoint: string, body: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}, ${errorText}`
      );
    }

    return response.json();
  }

  // Text completion API
  async getCompletion(prompt: string, options: any = {}): Promise<string> {
    // Use chat completion instead as deepseek-reasoner doesn't support completions API
    const messages = [{ role: "user", content: prompt }];

    const response = await this.getChatCompletion(messages, undefined, options);
    return response.choices[0].message.content;
  }

  // Chat completion API with function calling
  async getChatCompletion(
    messages: Array<{
      role: string;
      content: string;
      name?: string;
      function_call?: any;
    }>,
    functions?: FunctionDefinition[],
    options: any = {}
  ): Promise<DeepSeekChatResponse> {
    const body = {
      model: "deepseek-chat",
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 2048,
      ...options,
    };

    if (functions && functions.length > 0) {
      body.functions = functions;
      body.function_call = options.function_call || "auto";
    }

    return (await this.makeApiRequest(
      "/chat/completions",
      body
    )) as DeepSeekChatResponse;
  }

  // Chat completion API with function calling
  async getChatCompletionStream(
    messages: Array<{
      role: string;
      content: string;
      name?: string;
      function_call?: any;
    }>,
    onEnd: () => void,
    onChunk: (chunk: string) => void,
    onError: (error: Error) => void,
    functions?: FunctionDefinition[],
    options: any = {}
  ): Promise<void> {
    const body = {
      model: "deepseek-chat",
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 2048,
      ...options,
    };

    if (functions && functions.length > 0) {
      body.functions = functions;
      body.function_call = options.function_call || "auto";
    }

    onChunk("test");
    onError(new Error("Invalid Error"));
    onEnd();
  }

  // Generate project structure using function calling
  async generateProjectStructure(prompt: string): Promise<FileStructure> {
    // Define the project generation function
    const generateProjectFunction: FunctionDefinition = {
      name: "generate_project_structure",
      description: "Generate a project structure based on the user prompt",
      parameters: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          files: {
            type: "array",
            description: "List of files and directories in the project",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Name of the file or directory",
                },
                type: {
                  type: "string",
                  enum: ["file", "directory"],
                  description: "Whether this is a file or directory",
                },
                path: {
                  type: "string",
                  description:
                    "Path of the file or directory within the project",
                },
                content: {
                  type: "string",
                  description:
                    "Content of the file if it is a file (can be empty for directories)",
                },
              },
              required: ["name", "type", "path"],
            },
          },
          description: {
            type: "string",
            description: "A description of what the project does",
          },
        },
        required: ["projectName", "files"],
      },
    };

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

    const analysis = await this.getCompletion(analysisPrompt, {
      temperature: 0.5,
    });

    // Now, use function calling to generate the project structure
    const messages = [
      {
        role: "system",
        content:
          "You are a professional software developer who can design and create project structures based on user requirements.",
      },
      {
        role: "user",
        content: `I need to create a project with the following requirements: ${prompt}\n\nHere's an analysis of what I might need: ${analysis}`,
      },
    ];

    const response = await this.getChatCompletion(
      messages,
      [generateProjectFunction],
      {
        temperature: 0.7,
        function_call: { name: "generate_project_structure" },
      }
    );

    const functionCall = response.choices[0].message.function_call;

    if (!functionCall) {
      throw new Error(
        "Failed to generate project structure - no function call returned"
      );
    }

    try {
      const projectData = JSON.parse(functionCall.arguments) as ProjectData;

      if (
        !projectData.projectName ||
        !projectData.files ||
        !Array.isArray(projectData.files)
      ) {
        throw new Error("Invalid project structure format");
      }

      // Convert flat file list to a nested structure
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

  async generateFileContent(prompt: string, filePath: string): Promise<string> {
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

    return await this.getCompletion(fileGenerationPrompt, {
      temperature: 0.2,
      max_tokens: 4096,
    });
  }
}
