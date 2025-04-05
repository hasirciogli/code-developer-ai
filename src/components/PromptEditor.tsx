'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import ModelSelector from '@/components/ModelSelector';
import { AIProvider } from '@/services/ai-provider';
import ReactMarkdown from 'react-markdown';
import { createId } from '@paralleldrive/cuid2';
import { log } from 'console';
import { Button } from './ui/button';
import { SocketService } from '@/services/socket-service';
import { useTools } from '@/hooks/useTools';

interface PromptEditorProps {
  projectSlug: string;
}

type ActionType = {
  id: string;
  action: string;
  immediate?: boolean;
  [key: string]: any;
}

type LocalActionType = ActionType & {
  status: "pending" | "success" | "error" | "in-progress";
  data: any;
}


export default function PromptEditor({ projectSlug }: PromptEditorProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const generateProject = useStore(state => state.generateProject);
  const isProjectGenerating = useStore(state => state.isProjectGenerating);
  const generationProgress = useStore(state => state.generationProgress);
  const [activeTab, setActiveTab] = useState<'prompt' | 'chat'>('chat');
  const [aiProvider, setAiProvider] = useState<AIProvider>(localStorage.getItem('aiProvider') as AIProvider || 'google');
  const [aiModel, setAiModel] = useState(localStorage.getItem('aiModel') || 'gemini-1.5-pro-preview-0325');

  // Chat state
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string, id: string, createdAt: string, hidden?: boolean }>>([
    { role: 'assistant', content: 'Merhaba! Proje geliştirmeyle ilgili nasıl yardımcı olabilirim? Kod yazma, hata ayıklama veya yeni özellikler ekleme konusunda sorularınızı yanıtlayabilirim.', id: createId(), createdAt: new Date().toISOString() }
  ]);

  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { isConnected, registerCallback, unregisterCallback } = useTools();

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-resize the textarea based on content
  useEffect(() => {

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [chatInput]);

  // Save AI provider and model to localStorage
  useEffect(() => {
    localStorage.setItem('aiProvider', aiProvider);
    localStorage.setItem('aiModel', aiModel);
  }, [aiProvider, aiModel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isChatLoading) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleSelectModel = (provider: AIProvider, modelId: string) => {
    setAiProvider(provider);
    setAiModel(modelId);
    // setMessages(prev => [
    //   ...prev,
    //   {
    //     role: 'assistant',
    //     content: `AI sağlayıcı ve model değiştirildi: ${provider === 'google' ? 'Google Gemini' : 'DeepSeek'} - ${modelId}`,
    //     id: createId(),
    //     createdAt: new Date().toISOString()
    //   }
    // ]);
  };

  // Handle send message
  const handleSendMessageAsStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, id: createId(), createdAt: new Date().toISOString() }]);
    setIsChatLoading(true);

    try {
      // Call the AI chat API
      const streamResponse = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/event-stream',
        },
        body: JSON.stringify({
          stream: true,
          message: userMessage,
          history: messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          provider: aiProvider,
          model: aiModel
        }),
      });

      if (!streamResponse.ok) {
        throw new Error('API request failed');
      }

      setIsChatLoading(false);

      const reader = streamResponse.body
        ?.pipeThrough(new TextDecoderStream())
        .getReader();

      const newMessageId = createId();
      const newMessageCreatedAt = new Date().toISOString();
      const newMessageRole = 'assistant';
      const newMessageContent = '';

      setMessages(prev => [...prev, {
        role: newMessageRole,
        content: newMessageContent,
        id: newMessageId,
        createdAt: newMessageCreatedAt
      }]);

      let chunkSum = '';

      while (true) {
        if (!reader) break;
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value || '';
        // remove data: from chunk
        const cleanChunk = chunk.replace('data: ', '').replace("data:", "");
        chunkSum += cleanChunk;

        // Update Message
        setMessages(prev => prev.map(msg => msg.id === newMessageId ? {
          ...msg,
          content: chunkSum
        } : msg));
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        id: createId(),
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setIsChatLoading(false);
      // Focus input after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, id: createId(), createdAt: new Date().toISOString() }]);
    setIsChatLoading(true);

    try {
      // Call the AI chat API
      const streamResponse = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/event-stream',
        },
        body: JSON.stringify({
          stream: false,
          message: userMessage,
          history: messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          provider: aiProvider,
          model: aiModel
        }),
      });

      if (!streamResponse.ok) {
        throw new Error('API request failed');
      }

      const data = await streamResponse.json();

      setIsChatLoading(false);

      const newMessageId = createId();
      const newMessageCreatedAt = new Date().toISOString();
      const newMessageRole = 'assistant';
      const newMessageContent = data.response;

      setMessages(prev => [...prev, {
        role: newMessageRole,
        content: newMessageContent,
        id: newMessageId,
        createdAt: newMessageCreatedAt
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        id: createId(),
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setIsChatLoading(false);
      // Focus input after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };



  // clientside actions
  const createFileAction = async (filePath: string, callback: (status: boolean, result: any) => void) => {
    try {
      // Get the WebContainer instance from the store
      const webcontainerInstance = useStore.getState().webcontainerInstance;

      if (!webcontainerInstance) {
        throw new Error("WebContainer is not initialized");
      }

      // Parse the action data to get file path
      if (!filePath) {
        return callback(false, "File path is missing");
      }

      // Create the file in WebContainer
      await webcontainerInstance.fs.writeFile(filePath, "");

      // Update action status to success
      callback(true, `File created successfully: ${filePath}`);
    } catch (error) {
      console.error("Error creating file:", error);

      // Update action status to error
      callback(false, `Error creating file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  const readFileAction = async (filePath: string, callback: (status: boolean, result: any) => void) => {
    try {
      // Get the WebContainer instance from the store
      const webcontainerInstance = useStore.getState().webcontainerInstance;

      if (!webcontainerInstance) {
        throw new Error("WebContainer is not initialized");
      }

      // Parse the action data to get file path

      if (!filePath) {
        return callback(false, "File path is missing");
      }

      const fileContent = await webcontainerInstance.fs.readFile(filePath, 'utf-8');

      callback(true, `File content: ${fileContent}`);
    } catch (error) {
      console.error("Error reading file:", error);
      callback(false, `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  const writeFileAction = async (filePath: string, content: string, callback: (status: boolean, result: any) => void) => {
    try {
      // Get the WebContainer instance from the store
      const webcontainerInstance = useStore.getState().webcontainerInstance;

      if (!webcontainerInstance) {
        throw new Error("WebContainer is not initialized");
      }

      // Parse the action data to get file path and content

      if (!filePath) {
        return callback(false, "File path is missing");
      }

      if (content === undefined) {
        return callback(false, "Content is missing");
      }

      // Use socket service to write to the file
      await webcontainerInstance.fs.writeFile(filePath, content);

      callback(true, `Content written to file: ${filePath}`);


    } catch (error) {
      console.error("Error writing to file:", error);
      callback(false, `Error writing to file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  const runCommandAction = async (command: string, callback: (status: boolean, result: any) => void) => {
    try {
      // Get the WebContainer instance from the store
      const webcontainerInstance = useStore.getState().webcontainerInstance;

      if (!webcontainerInstance) {
        return callback(false, "WebContainer is not initialized");
      }

      // Parse the action data to get command

      if (!command) {
        return callback(false, "Command is missing");
      }


      // Execute the command in WebContainer
      const process = await webcontainerInstance.spawn('sh', ['-c', command]);

      // Collect command output
      let output = '';
      const outputStream = new WritableStream({
        write(data) {
          output += data;
        }
      });

      // Pipe the process output to our WritableStream
      process.output.pipeTo(outputStream);

      // Wait for the process to exit
      const exitCode = await process.exit;

      callback(true, `Command executed successfully: ${command}\n${output}`);

    } catch (error) {
      console.error("Error executing command:", error);
      callback(false, `Error executing command: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  const listFilesAction = async (folderPath: string, callback: (status: boolean, result: any) => void) => {
    try {
      // Get the WebContainer instance from the store
      const webcontainerInstance = useStore.getState().webcontainerInstance;

      if (!webcontainerInstance) {
        return callback(false, "WebContainer is not initialized");
      }

      const files = await webcontainerInstance.fs.readdir(folderPath);
      callback(true, `Files in ${folderPath}: ${files.join(', ')}`);
    } catch (error) {
      console.error("Error listing files:", error);
      callback(false, `Error listing files: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  const createDirectoryAction = async (directoryPath: string, callback: (status: boolean, result: any) => void) => {
    try {
      // Get the WebContainer instance from the store
      const webcontainerInstance = useStore.getState().webcontainerInstance;

      if (!webcontainerInstance) {
        return callback(false, "WebContainer is not initialized");
      }

      await webcontainerInstance.fs.mkdir(directoryPath);
      callback(true, `Directory created successfully: ${directoryPath}`);
    } catch (error) {
      console.error("Error creating directory:", error);
      callback(false, `Error creating directory: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  useEffect(() => {
    if (isConnected) {
      registerCallback("create_file", ({ functionName, args, callBack }) => {
        createFileAction(args.filePath, (status, result) => {
          callBack({ status, result });
        });
      });
      registerCallback("read_file", ({ functionName, args, callBack }) => {
        readFileAction(args.filePath, (status, result) => {
          callBack({ status, result });
        });
      });
      registerCallback("write_file", ({ functionName, args, callBack }) => {
        writeFileAction(args.filePath, args.content, (status, result) => {
          callBack({ status, result });
        });
      });
      registerCallback("run_command", ({ functionName, args, callBack }) => {
        runCommandAction(args.command, (status, result) => {
          callBack({ status, result });
        });
      });
      registerCallback("list_files", ({ functionName, args, callBack }) => {
        listFilesAction(args.folderPath, (status, result) => {
          callBack({ status, result });
        });
      });
      registerCallback("create_directory", ({ functionName, args, callBack }) => {
        createDirectoryAction(args.directoryPath, (status, result) => {
          callBack({ status, result });
        });
      });
    }

    return () => {
      unregisterCallback("read_file");
      unregisterCallback("write_file");
      unregisterCallback("run_command");
      unregisterCallback("list_files");
      unregisterCallback("create_directory");
    }
  }, [isConnected]);

  return (
    <div className="flex flex-col h-full bg-white">

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {messages.filter(message => !message.hidden).map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
            >
              <div className="flex items-start max-w-full">
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold mr-2 flex-shrink-0 mt-1">
                    AI
                  </div>
                )}
                <div
                  className={`rounded-lg px-4 py-3 ${message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-50 border border-gray-200 text-gray-800'
                    }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold ml-2 flex-shrink-0 mt-1">
                    U
                  </div>
                )}
              </div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="flex items-start max-w-full">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold mr-2 flex-shrink-0 mt-1">
                  AI
                </div>
                <div className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg px-4 py-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat input */}
        <div className="border-t p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm text-gray-500">
              AI Model:
            </div>
            <ModelSelector
              selectedProvider={aiProvider}
              selectedModel={aiModel}
              onSelect={handleSelectModel}
            />
          </div>
          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <div className="flex-1 min-w-0 relative">
              <textarea
                ref={inputRef}
                rows={1}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full rounded-md border border-gray-300 bg-white px-3.5 py-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none max-h-32"
                placeholder="Mesajınızı yazın... (Göndermek için Enter, yeni satır için Shift+Enter)"
                disabled={isChatLoading}
              />
              <div className="absolute right-3 bottom-2 text-xs text-gray-400">
                {isChatLoading ? 'Yanıt bekleniyor...' : 'Enter tuşu ile gönder'}
              </div>
            </div>
            <Button
              onClick={() => setMessages([])}
            >
              Reset
            </Button>
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatLoading}
              className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 