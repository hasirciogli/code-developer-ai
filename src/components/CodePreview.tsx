'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/store';
import Editor from '@monaco-editor/react';

interface CodePreviewProps {
  isPreviewMode: boolean;
  projectSlug: string;
}

export default function CodePreview({ isPreviewMode, projectSlug }: CodePreviewProps) {
  const [fileContent, setFileContent] = useState<string>('');
  const { webcontainerInstance, selectedFile } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load file content when selected file changes
  const loadFileContent = useCallback(async () => {
    if (!webcontainerInstance || !selectedFile) return;

    try {
      setIsLoading(true);
      setError(null);
      console.log(`Loading content for file: ${selectedFile}`);
      
      const content = await webcontainerInstance.fs.readFile(selectedFile, 'utf-8');
      console.log(`Content loaded successfully for: ${selectedFile}`);
      setFileContent(content);
    } catch (error) {
      console.error(`Error reading file ${selectedFile}:`, error);
      setError(error instanceof Error ? error.message : 'Error loading file content');
      setFileContent('');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, webcontainerInstance]);

  useEffect(() => {
    loadFileContent();
  }, [loadFileContent, selectedFile]);

  // Save file content to WebContainer
  const saveFileContent = useCallback(async (content: string) => {
    if (!webcontainerInstance || !selectedFile) return;
    
    try {
      console.log(`Saving content for file: ${selectedFile}`);
      await webcontainerInstance.fs.writeFile(selectedFile, content);
      console.log(`Content saved successfully for: ${selectedFile}`);
    } catch (error) {
      console.error(`Error saving file ${selectedFile}:`, error);
      setError(error instanceof Error ? error.message : 'Error saving file content');
    }
  }, [webcontainerInstance, selectedFile]);

  // Handle editor content change with debounce
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value === undefined) return;
    
    setFileContent(value);
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout for saving
    saveTimeoutRef.current = setTimeout(() => {
      saveFileContent(value);
    }, 1000);
  }, [saveFileContent]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (isPreviewMode) {
    return (
      <div className="h-full w-full bg-white">
        <iframe
          src="http://localhost:3000"
          className="w-full h-full border-none"
          title="Project Preview"
        />
      </div>
    );
  }

  if (!selectedFile) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background text-muted-foreground">
        Select a file to view its content
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background text-muted-foreground">
        Loading file content...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden border rounded-md">
      <div className="h-10 bg-muted flex items-center px-4 border-b">
        <span className="text-sm font-medium text-foreground">{selectedFile}</span>
      </div>
      <div className="h-[calc(100%-2.5rem)]">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          value={fileContent}
          options={{
            readOnly: false,
            minimap: { enabled: false },
            fontSize: 14,
            renderLineHighlight: 'all',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
          onChange={handleEditorChange}
          theme="vs-dark"
        />
      </div>
    </div>
  );
} 