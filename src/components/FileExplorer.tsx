'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store';
import { FileStructure } from '@/services/deepseek';

interface FileExplorerProps {
  projectSlug: string;
}

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export default function FileExplorer({ projectSlug }: FileExplorerProps) {
  const { projectStructure, webcontainerInstance, setSelectedFile } = useStore();
  const [selectedFile, setSelectedFileState] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to build a file tree from WebContainer
  const buildFileTree = useCallback(async () => {
    if (!webcontainerInstance) return;
    
    try {
      setIsLoading(true);
      console.log('Building file tree...');
      
      // Function to recursively read directory
      const readDirectory = async (path: string): Promise<FileNode> => {
        console.log(`Reading directory: ${path}`);
        const entries = await webcontainerInstance.fs.readdir(path, { withFileTypes: true });
        
        const children: FileNode[] = [];
        
        for (const entry of entries) {
          const fullPath = `${path}/${entry.name}`;
          
          // Check if it's a directory by trying to read it
          try {
            await webcontainerInstance.fs.readdir(fullPath);
            // If we can read it, it's a directory
            // Skip node_modules and other large directories
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            
            const childNode = await readDirectory(fullPath);
            children.push(childNode);
          } catch (e) {
            // If we can't read it, it's a file
            children.push({
              name: entry.name,
              type: 'file'
            });
          }
        }
        
        return {
          name: path.split('/').pop() || path,
          type: 'directory',
          children: children.sort((a, b) => {
            // Sort directories first, then files
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          })
        };
      };
      
      const root = await readDirectory('.');
      console.log('File tree built successfully:', root);
      setFileTree(root);
    } catch (error) {
      console.error('Error building file tree:', error);
    } finally {
      setIsLoading(false);
    }
  }, [webcontainerInstance]);

  // Build file tree when WebContainer is initialized
  useEffect(() => {
    if (webcontainerInstance) {
      buildFileTree();
    }
  }, [webcontainerInstance, buildFileTree]);

  // Refresh file tree periodically and when actions are completed
  useEffect(() => {
    if (!webcontainerInstance) return;
    
    // Initial refresh
    buildFileTree();
    
    // Set up periodic refresh
    const intervalId = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 5000); // Refresh every 5 seconds
    
    // Subscribe to store changes
    const unsubscribe = useStore.subscribe((state) => {
      // Check if any actions have been completed
      const actions = (state as any).actions || {};
      const hasCompletedActions = Object.values(actions).some(
        (action: any) => action.status === 'success'
      );
      
      if (hasCompletedActions) {
        console.log('Action completed, refreshing file tree');
        buildFileTree();
      }
    });
    
    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [webcontainerInstance, buildFileTree]);

  // Refresh file tree when refreshTrigger changes
  useEffect(() => {
    if (webcontainerInstance) {
      buildFileTree();
    }
  }, [refreshTrigger, webcontainerInstance, buildFileTree]);

  const handleFileSelect = (filePath: string) => {
    console.log(`File selected: ${filePath}`);
    setSelectedFileState(filePath);
    setSelectedFile(filePath);
  };

  const renderTree = (node: FileNode | FileStructure, path: string = '') => {
    const currentPath = path ? `${path}/${node.name}` : node.name;
    
    if (node.type === 'file') {
      return (
        <div 
          key={currentPath}
          onClick={() => handleFileSelect(currentPath)}
          className={`pl-4 py-1 cursor-pointer hover:bg-accent ${
            selectedFile === currentPath ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground'
          }`}
        >
          {node.name}
        </div>
      );
    }
    
    return (
      <div key={currentPath}>
        <div className="pl-2 py-1 font-medium text-foreground">{node.name}</div>
        <div className="pl-2">
          {node.children?.map(child => renderTree(child, currentPath))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="text-muted-foreground p-4">
        Loading file structure...
      </div>
    );
  }

  if (!fileTree && !projectStructure) {
    return (
      <div className="text-muted-foreground p-4">
        No project structure generated yet.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="text-lg font-semibold mb-2">Files</div>
      {fileTree && renderTree(fileTree)}
      {!fileTree && projectStructure && renderTree(projectStructure)}
    </div>
  );
}