import { NextResponse } from 'next/server';
import { AIService } from '@/services/ai-provider';

// Function to handle project generation requests
export async function POST(request: Request) {
  try {
    const { prompt, provider, model } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    // Initialize AI service with the requested provider and model
    const aiService = new AIService({
      provider: provider || 'google',
      model: model || 'gemini-1.5-pro-preview-0325',
      deepseekApiKey: process.env.DEEPSEEK_API_KEY,
      googleApiKey: process.env.GOOGLE_AI_API_KEY,
    });

    // Generate project structure
    const projectStructure = await aiService.generateProjectStructure(prompt);

    // Convert the hierarchical structure to a flat list of files for the frontend
    const files: { name: string; path: string; content: string; type: string }[] = [];

    // Recursive function to flatten the file structure
    const flattenStructure = (structure: any, currentPath: string = '') => {
      if (structure.type === 'file') {
        files.push({
          name: structure.name,
          path: currentPath ? `${currentPath}/${structure.name}` : structure.name,
          content: structure.content || '',
          type: 'file'
        });
      } else if (structure.type === 'directory' && structure.children) {
        // Add the directory itself
        files.push({
          name: structure.name,
          path: currentPath ? `${currentPath}/${structure.name}` : structure.name,
          content: '',
          type: 'directory'
        });

        // Process all children
        const dirPath = currentPath ? `${currentPath}/${structure.name}` : structure.name;
        for (const child of structure.children) {
          flattenStructure(child, dirPath);
        }
      }
    };

    // Start with root level items
    if (projectStructure.children) {
      for (const child of projectStructure.children) {
        flattenStructure(child);
      }
    }

    return NextResponse.json({
      name: projectStructure.name,
      description: prompt,
      files: files,
      structure: projectStructure,
      provider: aiService.getCurrentConfig().provider,
      model: aiService.getCurrentConfig().model
    });
  } catch (error) {
    console.error('Project generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate project' },
      { status: 500 }
    );
  }
} 