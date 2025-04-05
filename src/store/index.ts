import { create } from 'zustand';
import { WebContainer } from '@webcontainer/api';
import { FileStructure } from '@/services/deepseek';

interface GenerationProgress {
  currentFile: string | null;
  error: string | null;
  completedFiles: string[];
  totalFiles: number;
}

interface StoreState {
  webcontainerInstance: WebContainer | null;
  projectStructure: FileStructure | null;
  isProjectGenerating: boolean;
  generationProgress: GenerationProgress;
  commandOutputs: Array<{ command: string; output: string }>;
  actions: Record<string, { id: string; result: string; action: string; status: "pending" | "success" | "error" | "in-progress" }>;
  selectedFile: string | null;
  setWebcontainerInstance: (instance: WebContainer | null) => void;
  setProjectStructure: (structure: FileStructure | null) => void;
  generateProject: (prompt: string, projectSlug: string) => Promise<void>;
  generateFileContent: (prompt: string, filePath: string) => Promise<string>;
  addCommandOutput: (command: string, output: string) => void;
  setAction: (actionId: string, action: { id: string; result: string; action: string; status: "pending" | "success" | "error" | "in-progress" }) => void;
  setSelectedFile: (filePath: string | null) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  webcontainerInstance: null,
  projectStructure: null,
  isProjectGenerating: false,
  generationProgress: {
    currentFile: null,
    error: null,
    completedFiles: [],
    totalFiles: 0,
  },
  commandOutputs: [],
  actions: {},
  selectedFile: null,

  setWebcontainerInstance: (instance) => set({ webcontainerInstance: instance }),
  
  setProjectStructure: (structure) => set({ projectStructure: structure }),
  
  addCommandOutput: (command, output) => set(state => ({
    commandOutputs: [...state.commandOutputs, { command, output }]
  })),
  
  setAction: (actionId, action) => set(state => ({
    actions: {
      ...state.actions,
      [actionId]: action
    }
  })),
  
  setSelectedFile: (filePath) => set({ selectedFile: filePath }),
  
  generateProject: async (prompt, projectSlug) => {
    const { webcontainerInstance } = get();
    
    if (!webcontainerInstance) {
      const error = 'WebContainer not initialized. Please try reloading the page.';
      set(state => ({
        generationProgress: {
          ...state.generationProgress,
          error,
        }
      }));
      throw new Error(error);
    }

    set({ isProjectGenerating: true });
    
    try {
      // Check if current provider and model are stored in localStorage
      const storedProvider = localStorage.getItem('aiProvider') || 'google';
      const storedModel = localStorage.getItem('aiModel') || 'gemini-1.5-pro-preview-0325';
      
      const response = await fetch('/api/projects/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: prompt,
          provider: storedProvider,
          model: storedModel
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate project';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If we can't parse the error as JSON, use the status text
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.files || !Array.isArray(data.files)) {
        throw new Error('Invalid response from server: missing files array');
      }
      
      set({ projectStructure: data.structure });

      // Count total files for progress tracking
      const countFiles = (node: FileStructure): number => {
        let count = node.type === 'file' ? 1 : 0;
        if (node.children) {
          count += node.children.reduce((acc, child) => acc + countFiles(child), 0);
        }
        return count;
      };
      
      const totalFiles = countFiles(data.structure);
      set(state => ({
        generationProgress: {
          ...state.generationProgress,
          totalFiles,
          completedFiles: [],
          error: null,
        }
      }));

      // Helper function to write files recursively
      const writeFiles = async (node: FileStructure, path: string = '') => {
        const fullPath = path ? `${path}/${node.name}` : node.name;
        
        if (node.type === 'directory') {
          await webcontainerInstance.fs.mkdir(fullPath, { recursive: true });
          if (node.children) {
            for (const child of node.children) {
              await writeFiles(child, fullPath);
            }
          }
        } else {
          set(state => ({
            generationProgress: {
              ...state.generationProgress,
              currentFile: fullPath,
            }
          }));

          // Generate file content using API
          const content = node.content || await get().generateFileContent(prompt, fullPath);
          await webcontainerInstance.fs.writeFile(fullPath, content);
          
          set(state => ({
            generationProgress: {
              ...state.generationProgress,
              completedFiles: [...state.generationProgress.completedFiles, fullPath],
            }
          }));
        }
      };

      // Write all files
      await writeFiles(data.structure);
    } catch (error) {
      console.error('Error generating project:', error);
      set(state => ({
        generationProgress: {
          ...state.generationProgress,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }));
    } finally {
      set({ isProjectGenerating: false });
    }
  },

  generateFileContent: async (prompt: string, filePath: string) => {
    try {
      // Get current provider and model from localStorage
      const provider = localStorage.getItem('aiProvider') || 'google';
      const model = localStorage.getItem('aiModel') || 'gemini-1.5-pro-preview-0325';
      
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt, 
          filePath,
          provider,
          model
        }),
      });

      if (!response.ok) {
        let errorMessage = `Failed to generate file content for ${filePath}`;
        
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If response body isn't JSON, use status text
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.content) {
        throw new Error(`Invalid response from AI service: missing content for ${filePath}`);
      }
      
      // Update localStorage with the provider and model if they changed
      if (data.provider && data.model) {
        localStorage.setItem('aiProvider', data.provider);
        localStorage.setItem('aiModel', data.model);
      }
      
      return data.content;
    } catch (error) {
      console.error(`Error generating file content for ${filePath}:`, error);
      // Return an error message as content instead of throwing
      return `// Error generating content for ${filePath}\n// ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    }
  },
})); 