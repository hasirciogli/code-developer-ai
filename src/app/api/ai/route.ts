import { NextResponse } from "next/server";
import { AIService } from "@/services/ai-provider";

export async function POST(request: Request) {
  try {
    const { prompt, filePath, provider, model } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }

    // Initialize AI service with the requested provider and model or use defaults
    const aiService = new AIService({
      provider: provider || "google",
      model: model || "gemini-1.5-pro-preview-0325",
      deepseekApiKey: process.env.DEEPSEEK_API_KEY,
      googleApiKey: process.env.GOOGLE_AI_API_KEY,
    });

    // Generate file content
    const content = await aiService.generateFileContent(prompt, filePath);

    return NextResponse.json({
      content,
      provider: aiService.getCurrentConfig().provider,
      model: aiService.getCurrentConfig().model,
    });
  } catch (error) {
    console.error("Error generating file content:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate file content",
      },
      { status: 500 }
    );
  }
}
