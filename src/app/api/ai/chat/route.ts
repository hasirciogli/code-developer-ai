import { NextResponse } from "next/server";
import { AIService, ChatMessage } from "@/services/ai-provider";

// Initialize AI Service with default provider and model
const aiService = new AIService({
  provider: "google", // Default to Google
  model: "gemini-1.5-pro-preview-0325", // Default to Gemini 2.5 Pro Preview
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  googleApiKey: process.env.GOOGLE_AI_API_KEY,
});

const actionList = [
  {
    name: "write_file",
    parameters: {
      type: "object",
      id: "cuid()",
      title: "Dosyaya Yaz",
      description: "Bir dosyaya içerik yazılacak",
      properties: {
        immediate: {
          type: "boolean",
          description: "İmmediate action call back",
        },
        file_path: { type: "string", description: "Yazılacak dosya yolu" },
        content: { type: "string", description: "Dosya içeriği" },
      },
      required: ["file_path", "content"],
    },
    description: "Bir dosyaya içerik yaz",
  },
  {
    name: "read_file",
    parameters: {
      type: "object",
      id: "cuid()",
      title: "Dosyayı Oku",
      description: "Bir dosyayı oku",
      properties: {
        immediate: {
          type: "boolean",
          description: "İmmediate action call back",
        },
        file_path: { type: "string", description: "Okunacak dosya yolu" },
      },
      required: ["file_path"],
    },
    description: "Dosya içeriğini oku",
  },
  {
    name: "list_files",
    parameters: {
      type: "object",
      id: "cuid()",
      title: "Klasör İçeriğini Listele",
      description: "Bir klasör içeriğini listele",
      properties: {
        immediate: {
          type: "boolean",
          description: "İmmediate action call back",
        },
        folder_path: { type: "string", description: "Klasör yolu" },
      },
      required: ["folder_path"],
    },
    description: "Klasör içeriğini listele",
  },
  {
    name: "run_command",
    parameters: {
      type: "object",
      id: "cuid()",
      title: "Terminal Komutu Çalıştır",
      description: "Bir terminal komutu çalıştır",
      properties: {
        immediate: {
          type: "boolean",
          description: "İmmediate action call back",
        },
        command: {
          type: "string",
          description: "Çalıştırılacak komut (örn: npm install)",
        },
      },
      required: ["command"],
    },
    description: "Terminal komutu çalıştır",
  },
  {
    name: "generate_code",
    parameters: {
      type: "object",
      id: "cuid()",
      title: "Kod Üret",
      description: "Bir kod üret",
      properties: {
        immediate: {
          type: "boolean",
          description: "İmmediate action call back",
        },
        language: {
          type: "string",
          description: "Kodun dili (örn: javascript, python)",
        },
        file_path: {
          type: "string",
          description:
            "Tam dosya yolu + .dosyaTipi (örn: ./src/components/Button.tsx)",
        },
        code: { type: "string", description: "Üretilecek kod" },
      },
      required: ["language", "file_path", "code"],
    },
    description: "Belirli bir dilde kod üret",
  },
  {
    name: "read_file_and_send_to_ai_chat_session",
    parameters: {
      type: "object",
      id: "cuid()",
      title: "Dosyayı Oku ve AI Chat'e Gönder",
      description: "Dosyayı oku ve AI chat'e gönder",
      properties: {
        immediate: {
          type: "boolean",
          description: "İmmediate action call back",
        },
        file_path: { type: "string", description: "Okunacak dosya yolu" },
        file_random_read_id: {
          type: "string",
          description: "Dosya içeriğini ilişkilendirmek için kullanılacak ID",
        },
      },
      required: ["file_path", "file_random_read_id"],
    },
    description: "Dosyayı oku ve AI chat'e gönder",
  },
];


export async function POST(request: Request) {
  try {
    const { message, history, provider, model, stream } = await request.json();
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
    - Each action must be wrapped in <x-system-action> tags — one per block.
    - Before each action, include a short explanation in plain text of what you're about to do.
    - EVERY action MUST include a unique "id" field with a UUID format (e.g., "123e4567-e89b-12d3-a456-426614174000").
    - NEVER use generate_code and write_file actions together in the same response.
    - If you need to generate complex code, use ONLY the generate_code action as the final action.
    - For simple/short code snippets, use ONLY the write_file action directly.
    - ALWAYS USE PROPER JSON FORMAT - DO NOT BREAK JSON STRINGS ACROSS LINES.
    - YOU MUST ONLY USE THE ACTIONS LISTED BELOW. DO NOT INVENT NEW ACTIONS.
    - IF AN ACTION HAS THE "immediate" PARAMETER, EITHER SEND IT AS THE LAST ACTION OR SEND ONLY ONE ACTION WITH "immediate" PARAMETER.
    
    📦 EXAMPLE FORMAT:
    Creating base HTML file...
    <x-system-action>
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "action": "write_file",
      "file_path": "./index.html",
      "content": "<!DOCTYPE html>\\n<html>...</html>"
    }
    </x-system-action>
    
    For complex code generation:
    Generating complex React component...
    <x-system-action>
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "action": "generate_code",
      "language": "typescript",
      "file_path": "./src/components/ComplexComponent.tsx",
      "code": "// Complex component code will be generated in a separate request"
    }
    </x-system-action>
    
    Available Actions:
    ${actionList
      .map((action) => `- ${action.name}: ${action.description}`)
      .join("\n")}
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

      if (streamMode) {
        const encoder = new TextEncoder();
        // Create a streaming response
        const customReadable = new ReadableStream({
          start(controller) {
            // Get chat completion from AI service
            aiService.getChatCompletionStream(
              messages,
              {
                temperature: 0.7,
                max_tokens: 2048,
              },
              (chunk) => {
                controller.enqueue(encoder.encode(`data: ${chunk}`));
              },
              () => {
                controller.close();
              },
              (error) => {
                controller.error(error);
              }
            );
          },
        });

        // Cancel the stream if the request is aborted
        request.signal.onabort = () => {
          customReadable.cancel();
        };

        // Return the stream response and keep the connection alive
        return new Response(customReadable, {
          // Set the headers for Server-Sent Events (SSE)
          headers: {
            Connection: "keep-alive",
            "Content-Encoding": "none",
            "Cache-Control": "no-cache, no-transform",
            "Content-Type": "text/event-stream; charset=utf-8",
          },
        });
      } else {
        // Get chat completion from AI service
        const aiResponse = await aiService.getChatCompletion(messages, {
          temperature: 0.7,
          max_tokens: 2048,
        });

        // Check if the response contains a generate_code action
        const containsGenerateCode =
          aiResponse && aiResponse.includes('"action":"generate_code"');

        return NextResponse.json({
          response: aiResponse || "Üzgünüm, yanıt üretirken bir sorun oluştu.",
          action: containsGenerateCode ? "generate_code" : null,
          provider: currentConfig.provider,
          model: currentConfig.model,
        });
      }
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
