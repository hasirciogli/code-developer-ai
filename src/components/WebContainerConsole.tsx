'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store';

interface WebContainerConsoleProps {
  projectSlug: string;
}

export default function WebContainerConsole({ projectSlug }: WebContainerConsoleProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const { webcontainerInstance } = useStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!webcontainerInstance) return;

    // Set up initial message
    setLogs(['Terminal ready. Type commands to interact with the container.']);

    // We can't remove the event listeners with WebContainer API v1.x,
    // but we can track if the component is mounted
    let isMounted = true;

    // Handle server-ready event
    webcontainerInstance.on('server-ready', (port, url) => {
      if (isMounted) {
        setLogs(prev => [...prev, `🚀 Server started at ${url}`]);
      }
    });

    // Handle errors
    webcontainerInstance.on('error', (error) => {
      if (isMounted) {
        setLogs(prev => [...prev, `❌ Error: ${error.message}`]);
      }
    });

    // Subscribe to the store to listen for command outputs from PromptEditor
    const unsubscribe = useStore.subscribe((state) => {
      const commandOutputs = state.commandOutputs;
      if (commandOutputs && commandOutputs.length > 0) {
        // Get the latest command output
        const latestOutput = commandOutputs[commandOutputs.length - 1];
        if (latestOutput && latestOutput.output) {
          // Add the command and its output to the logs
          setLogs(prev => [...prev, `$ ${latestOutput.command}`, latestOutput.output]);
        }
      }
    });

    return () => {
      // Mark component as unmounted to prevent state updates
      isMounted = false;
      // Unsubscribe from the store
      unsubscribe();
    };
  }, [webcontainerInstance]);

  useEffect(() => {
    if (isExpanded && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  const handleRunCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !webcontainerInstance) return;

    try {
      setLogs(prev => [...prev, `$ ${command}`]);
      const process = await webcontainerInstance.spawn('sh', ['-c', command]);

      process.output.pipeTo(
        new WritableStream({
          write(data) {
            setLogs(prev => [...prev, data]);
          }
        })
      );

      await process.exit;
      setCommand('');
    } catch (error) {
      console.error('Failed to execute command:', error);
      setLogs(prev => [...prev, `Error: ${error instanceof Error ? error.message : String(error)}`]);
    }
  };

  const handleClearLogs = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLogs(['Terminal cleared.']);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`
      absolute bottom-0 left-0 right-0 z-50
      flex flex-col 
      bg-gray-800 text-white 
      rounded-t-lg shadow-lg border border-gray-700
      transition-all duration-300 ease-in-out
      ${isExpanded ? 'max-h-96' : 'h-10'}
    `}>
      <div
        className="flex items-center justify-between px-4 h-10 flex-shrink-0 border-b border-gray-700 cursor-pointer select-none"
        onClick={toggleExpand}
      >
        <div className="flex items-center">
          <span className="mr-2 text-gray-400">{isExpanded ? '▼' : '▲'}</span>
          <h3 className="text-sm font-medium text-gray-200">Terminal</h3>
        </div>
        {isExpanded && (
          <button
            onClick={handleClearLogs}
            className="text-xs text-gray-400 hover:text-gray-200 z-10"
          >
            Clear
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="flex flex-col flex-grow overflow-hidden">
          <div
            ref={consoleRef}
            className="flex-grow p-2 overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900 font-mono text-sm text-gray-300 whitespace-pre"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#4B5563 #1F2937'
            }}
          >
            {logs.map((log, index) => (
              <div key={index} className="py-0.5 min-w-max">{log}</div>
            ))}
          </div>

          <form onSubmit={handleRunCommand} className="p-2 border-t border-gray-700 flex items-center flex-shrink-0">
            <span className="text-green-400 mr-2">$</span>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="flex-1 bg-transparent border-none text-gray-200 focus:outline-none placeholder-gray-500"
              placeholder="Enter command..."
            />
          </form>
        </div>
      )}
    </div>
  );
} 