import { NextResponse } from "next/server";
import { AIService, ChatMessage } from "@/services/ai-provider";
import { SocketService } from "@/services/socket-service";
import { Type, Tool } from "@google/genai";
import { GoogleAIChatCompletionResult } from "@/services/google-genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Initialize AI Service with default provider and model
const aiService = new AIService({
  provider: "google", // Default to Google
  model: "gemini-1.5-pro-preview-0325", // Default to Gemini 2.5 Pro Preview
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  googleApiKey: process.env.GOOGLE_AI_API_KEY,
});

const socketService = new SocketService();

const Functions = {
  create_file: async ({
    filePath,
    content,
    userId,
  }: {
    filePath: string;
    content: string;
    userId: string;
  }) => {
    console.log("create_file", filePath);
    return {
      status: true,
      data: "File created successfully",
    };
    await socketService.callClientsideFunction(
      "create_file",
      {
        filePath,
      },
      userId
    );
  },
  write_file: async ({
    filePath,
    content,
    userId,
  }: {
    filePath: string;
    content: string;
    userId: string;
  }) => {
    await socketService.callClientsideFunction(
      "write_file",
      {
        filePath,
        content,
      },
      userId
    );
  },
  read_file: async ({
    filePath,
    userId,
  }: {
    filePath: string;
    userId: string;
  }) => {
    const { status, data } = await socketService.callClientsideFunction(
      "read_file",
      { filePath },
      userId
    );
    return { status, data };
  },
  list_files: async ({
    folderPath,
    userId,
  }: {
    folderPath: string;
    userId: string;
  }) => {
    const { status, data } = await socketService.callClientsideFunction(
      "list_files",
      { folderPath },
      userId
    );
    return { status, data };
  },
  run_command: async ({
    command,
    userId,
  }: {
    command: string;
    userId: string;
  }) => {
    const { status, data } = await socketService.callClientsideFunction(
      "run_command",
      { command },
      userId
    );
    return { status, data };
  },
  create_directory: async ({
    directoryPath,
    userId,
  }: {
    directoryPath: string;
    userId: string;
  }) => {
    const { status, data } = await socketService.callClientsideFunction(
      "create_directory",
      { directoryPath },
      userId
    );
    return { status, data };
  },
  send_mail: async ({
    to,
    subject,
    body,
    userId,
  }: {
    to: string;
    subject: string;
    body: string;
    userId: string;
  }) => {
    console.log("send_mail", to, subject, body);

    return {
      status: true,
      data: "Email sent successfully",
    };
  },
};

const functionCaller = (functionName: string, args: any) => {
  console.log("functionCaller", functionName, args);
  return Functions[functionName as keyof typeof Functions](args);
};

const FunctionDeclarations = {
  create_file: {
    name: "create_file",
    description: "Create a new file with the specified name",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: "The path of the file to create",
        },
      },
      required: ["filePath"],
    },
  },
  write_file: {
    name: "write_file",
    description: "Write content to an existing file",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: "The path of the file to write to",
        },
        content: {
          type: Type.STRING,
          description: "The content to write to the file",
        },
        userId: {
          type: Type.STRING,
          description: "The ID of the user making the request",
        },
      },
      required: ["filePath", "content"],
    },
  },
  read_file: {
    name: "read_file",
    description: "Read the contents of a file",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: "The path of the file to read",
        },
        userId: {
          type: Type.STRING,
          description: "The ID of the user making the request",
        },
      },
      required: ["filePath"],
    },
  },
  list_files: {
    name: "list_files",
    description: "List all files in a directory",
    parameters: {
      type: Type.OBJECT,
      properties: {
        folderPath: {
          type: Type.STRING,
          description: "The path of the directory to list files from",
        },
        userId: {
          type: Type.STRING,
          description: "The ID of the user making the request",
        },
      },
      required: ["folderPath"],
    },
  },
  run_command: {
    name: "run_command",
    description: "Run a terminal command",
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: {
          type: Type.STRING,
          description: "The command to run",
        },
        userId: {
          type: Type.STRING,
          description: "The ID of the user making the request",
        },
      },
      required: ["command"],
    },
  },
  create_directory: {
    name: "create_directory",
    description: "Create a new directory",
    parameters: {
      type: Type.OBJECT,
      properties: {
        directoryPath: {
          type: Type.STRING,
          description: "The path of the directory to create",
        },
        userId: {
          type: Type.STRING,
          description: "The ID of the user making the request",
        },
      },
      required: ["directoryPath"],
    },
  },
  send_mail: {
    name: "send_mail",
    description: "Send an email",
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: {
          type: Type.STRING,
          description: "The email address of the recipient",
        },
        subject: {
          type: Type.STRING,
          description: "The subject of the email",
        },
        body: {
          type: Type.STRING,
          description: "The body of the email",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
};

export async function POST(request: Request) {
  try {
    const { message, history, provider, model, stream } = await request.json();

    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    const streamMode = stream || false;

    // Switch provider and model if specified
    if (provider && model) {
      aiService.switchProvider(provider, model);
    }

    // Convert history to the format expected by the AI service
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are an AI assistant specialized in writing code and building software projects. You only do what the user asks, nothing more, nothing less.
    
    ⚠️ CRITICAL RULES:
    - The project root is always \`./\`. Never assume or use nested folders unless explicitly stated.
    - You have access to various tools that you can call directly.
    - Before each tool call, include a short explanation in plain text of what you're about to do.
    - YOU MUST ONLY USE THE TOOLS LISTED BELOW. DO NOT INVENT NEW TOOLS. AND DO NOT TELL ABOUT THE TOOLS YOU ARE USING.
    - DO NOT WRITE CODE THAT CALLS THE FUNCTIONS DIRECTLY. The system will automatically call the functions for you when you use the function calling mechanism.
    - DO NOT WRITE CODE LIKE \`print(create_file(file_name="hello.txt"))\`. Instead, just explain what you're going to do and the system will call the function for you.
    - WHEN YOU WANT TO USE A FUNCTION, JUST EXPLAIN WHAT YOU'RE GOING TO DO IN PLAIN TEXT. For example: "I'll create a file named hello.txt" or "I'll list the files in the current directory."
    - IMPORTANT: You must use the function calling mechanism provided by the Google AI API. Do not try to call functions directly in your response text.
    - IMPORTANT: When you want to create a file, just say "I'll create a file named [filename]" and the system will automatically call the create_file function.
    - IMPORTANT: When you want to write to a file, just say "I'll write [content] to [filename]" and the system will automatically call the write_file function.
    - IMPORTANT: When you want to read a file, just say "I'll read [filename]" and the system will automatically call the read_file function.
    - IMPORTANT: When you want to list files, just say "I'll list files in [directory]" and the system will automatically call the list_files function.
    - IMPORTANT: When you want to run a command, just say "I'll run [command]" and the system will automatically call the run_command function.
    - IMPORTANT: When you want to create a directory, just say "I'll create a directory named [directory]" and the system will automatically call the create_directory function.
    - DO NOT USE CUSTOM FORMATS LIKE THIS:
      \`\`\`
      I'll create a file named \`neemo.rs\`.
      \`\`\`tool_code
      {"tool_code": "create_file", "file_name": "neemo.rs"}
      \`\`\`
      \`\`\`
    - INSTEAD, JUST SAY:
      \`\`\`
      I'll create a file named neemo.rs
      \`\`\`
    - IMPORTANT: You must use the function calling mechanism provided by the Google AI API. The API will automatically detect your intent and call the appropriate function.
    - IMPORTANT: Do not try to call functions directly in your response text. Just describe what you're going to do, and the API will handle the function call.
    
    📦 EXAMPLE FORMAT for UI:
    Creating base HTML file... (call function: create_file behind the scenes)
    
    📦 EXAMPLE OF FUNCTION CALLING:
    User: Create a file named example.txt
    Assistant: I'll create a file named example.txt
    [The system will automatically call the create_file function with filePath="example.txt"]
    
    User: Write "Hello, world!" to example.txt
    Assistant: I'll write "Hello, world!" to example.txt
    [The system will automatically call the write_file function with filePath="example.txt" and content="Hello, world!"]
    `,
      },
      ...history.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      ...(message
        ? [
            {
              role: "user",
              content: message,
            },
          ]
        : []),
    ];

    try {
      // Get current AI provider and model
      const currentConfig = aiService.getCurrentConfig();
      // For mock/testing purposes when no API keys are available
      if (
        (!process.env.DEEPSEEK_API_KEY &&
          currentConfig.provider === "deepseek") ||
        (!process.env.GOOGLE_AI_API_KEY && currentConfig.provider === "google")
      ) {
        console.log(
          `No API key found for ${currentConfig.provider}, returning mock response`
        );

        // More sophisticated mock response
        let mockResponse = "";
        const lowercaseMessage = message.toLowerCase();

        if (
          lowercaseMessage.includes("merhaba") ||
          lowercaseMessage.includes("selam")
        ) {
          mockResponse = "Merhaba! Size nasıl yardımcı olabilirim?";
        } else if (
          lowercaseMessage.includes("javascript") ||
          lowercaseMessage.includes("js")
        ) {
          mockResponse = `JavaScript hakkında bilgi mi istiyorsunuz? JavaScript, web tarayıcılarında çalışan popüler bir programlama dilidir. İşte basit bir örnek:

\`\`\`javascript
function hello() {
  console.log("Merhaba Dünya!");
}
hello();
\`\`\``;
        } else if (lowercaseMessage.includes("react")) {
          mockResponse =
            "React, Facebook tarafından geliştirilen popüler bir JavaScript kütüphanesidir. Kullanıcı arayüzleri oluşturmak için kullanılır.";
        } else if (
          lowercaseMessage.includes("model") ||
          lowercaseMessage.includes("ai")
        ) {
          mockResponse = `Şu anda ${currentConfig.provider} sağlayıcısını ve ${currentConfig.model} modelini kullanıyorsunuz. Sağlayıcıyı ve modeli değiştirmek için model seçim menüsünü kullanabilirsiniz.`;
        } else {
          mockResponse = `Mesajınızı aldım: "${message}". Bu bir mock yanıttır çünkü ${currentConfig.provider} API anahtarı yapılandırılmamış.`;
        }

        return NextResponse.json({
          response: mockResponse,
          action: null,
          provider: currentConfig.provider,
          model: currentConfig.model,
        });
      }

      // if (streamMode) {
      //   const encoder = new TextEncoder();
      //   // Create a streaming response
      //   const customReadable = new ReadableStream({
      //     start(controller) {
      //       // Get chat completion from AI service
      //       let sumChunk = "";
      //       aiService.getChatCompletionStream(
      //         messages,
      //         {
      //           temperature: 0.7,
      //           max_tokens: 2048,
      //         },
      //         (chunk) => {
      //           controller.enqueue(encoder.encode(`data: ${chunk}`));
      //         },
      //         () => {
      //           controller.close();
      //         },
      //         (error) => {
      //           controller.error(error);
      //         },
      //         Object.values(FunctionDeclarations) as Tool[],
      //         async (functionName: string, args: any) => {
      //           console.log(
      //             "Function call in streaming mode:",
      //             functionName,
      //             args
      //           );
      //           try {
      //             // Add userId to the function arguments
      //             const functionArgs = {
      //               ...args,
      //               userId: userId || "default-user",
      //             };

      //             // Call the function
      //             const result = await functionCaller(
      //               functionName,
      //               functionArgs
      //             );
      //             console.log("Function result:", result);

      //             // Add function results to the conversation
      //             messages.push({
      //               role: "tool",
      //               content: JSON.stringify({
      //                 name: functionName,
      //                 result,
      //               }),
      //             });
      //           } catch (error) {
      //             console.error(
      //               `Error executing function ${functionName}:`,
      //               error
      //             );

      //             // Add function error to the conversation
      //             messages.push({
      //               role: "tool",
      //               content: JSON.stringify({
      //                 name: functionName,
      //                 error:
      //                   error instanceof Error
      //                     ? error.message
      //                     : "Unknown error",
      //               }),
      //             });
      //           }
      //         }
      //       );
      //     },
      //   });

      //   // Cancel the stream if the request is aborted
      //   request.signal.onabort = () => {
      //     customReadable.cancel();
      //   };

      //   // Return the stream response and keep the connection alive
      //   return new Response(customReadable, {
      //     // Set the headers for Server-Sent Events (SSE)
      //     headers: {
      //       Connection: "keep-alive",
      //       "Content-Encoding": "none",
      //       "Cache-Control": "no-cache, no-transform",
      //       "Content-Type": "text/event-stream; charset=utf-8",
      //     },
      //   });
      // }

      // else {
      // Get chat completion from AI service with function declarations
      const aiResponse: GoogleAIChatCompletionResult =
        await aiService.getChatCompletion(
          messages,
          {
            temperature: 0.7,
            max_tokens: 2048,
          },
          Object.values(FunctionDeclarations) as Tool[]
        );


      // Handle function calls if present
      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        console.log(
          "Function calls detected:",
          JSON.stringify(aiResponse.toolCalls, null, 2)
        );
        const functionResults = [];

        for (const toolCall of aiResponse.toolCalls) {
          try {
            // Add userId to the function arguments
            const args = {
              ...toolCall.args,
              userId: userId || "default-user",
            };

            console.log(
              `Calling function ${toolCall.name} with args:`,
              JSON.stringify(args, null, 2)
            );

            // Call the function
            const result = await functionCaller(toolCall.name, args);
            console.log(
              `Function ${toolCall.name} result:`,
              JSON.stringify(result, null, 2)
            );

            functionResults.push({
              name: toolCall.name,
              result,
            });
          } catch (error) {
            console.error(`Error executing function ${toolCall.name}:`, error);
            functionResults.push({
              name: toolCall.name,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        // Add function results to the conversation
        messages.push({
          role: "tool",
          content: JSON.stringify(functionResults),
        });

        // Get a follow-up response from the AI
        const followUpResponse: GoogleAIChatCompletionResult =
          await aiService.getChatCompletion(messages, {
            temperature: 0.7,
            max_tokens: 2048,
          });

        return NextResponse.json({
          response:
            followUpResponse.text ||
            "Üzgünüm, yanıt üretirken bir sorun oluştu.",
          action: null,
          provider: currentConfig.provider,
          model: currentConfig.model,
          functionResults,
        });
      }

      // Check if the response contains a generate_code action
      const containsGenerateCode =
        aiResponse.text && aiResponse.text.includes('"action":"generate_code"');

      return NextResponse.json({
        response:
          aiResponse.text || "Üzgünüm, yanıt üretirken bir sorun oluştu.",
        action: containsGenerateCode ? "generate_code" : null,
        provider: currentConfig.provider,
        model: currentConfig.model,
      });
      // }
    } catch (error) {
      console.error("AI service error:", error);

      // More helpful error response
      let errorMessage =
        "Üzgünüm, bir sorun oluştu. Lütfen daha sonra tekrar deneyin.";

      if (error instanceof Error) {
        if (error.message.includes("API key")) {
          errorMessage =
            "AI servisi için gerekli yapılandırma eksik. Lütfen sistem yöneticisine bildirin.";
        } else if (error.message.includes("timeout")) {
          errorMessage =
            "AI servisi şu anda yanıt vermiyor. Lütfen daha sonra tekrar deneyin.";
        }
      }

      return NextResponse.json(
        {
          response: errorMessage,
          action: null,
          error: error instanceof Error ? error.message : "Unknown error",
          provider: aiService.getCurrentConfig().provider,
          model: aiService.getCurrentConfig().model,
        },
        { status: 200 }
      ); // Still return 200 to client for graceful handling
    }
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
