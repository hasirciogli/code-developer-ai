'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import ModelSelector from '@/components/ModelSelector';
import { AIProvider } from '@/services/ai-provider';
import ReactMarkdown from 'react-markdown';
import { createId } from '@paralleldrive/cuid2';
import { log } from 'console';
import { Button } from './ui/button';

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
  const [localActions, setLocalActions] = useState<Record<string, LocalActionType>>({})

  // Chat state
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string, id: string, createdAt: string, hidden?: boolean }>>([
    { role: 'assistant', content: 'Merhaba! Proje geliştirmeyle ilgili nasıl yardımcı olabilirim? Kod yazma, hata ayıklama veya yeni özellikler ekleme konusunda sorularınızı yanıtlayabilirim.', id: createId(), createdAt: new Date().toISOString() }
  ]);

  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const addLocalAction = (action: LocalActionType) => {
    localActions[action.id] = action;
  }

  const updateLocalAction = (actionId: string, data: any, status?: "pending" | "success" | "error" | "in-progress") => {
    localActions[actionId] = { ...localActions[actionId], data, status: status || localActions[actionId]?.status || "pending" }
  }

  const removeLocalAction = (actionId: string) => {
    delete localActions[actionId];
  }

  const isLocalActionExists = (actionId: string) => {
    return localActions[actionId] !== undefined;
  }

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
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: `AI sağlayıcı ve model değiştirildi: ${provider === 'google' ? 'Google Gemini' : 'DeepSeek'} - ${modelId}`,
        id: createId(),
        createdAt: new Date().toISOString()
      }
    ]);
  };

  const addActionResponseToMessages = (actionId: string, actionResponseResult: string, action: string) => {
    // Parse the result if it's a string
    let parsedResult = actionResponseResult;
    try {
      if (typeof actionResponseResult === 'string') {
        parsedResult = JSON.parse(actionResponseResult);
      }
    } catch (e) {
      console.error("Error parsing result:", e);
    }

    // Create a structured message for the AI
    const actionResponse = {
      actionId: actionId,
      result: parsedResult,
      action: action
    };

    // Add the action response to messages
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: JSON.stringify(actionResponse),
      id: createId(),
      createdAt: new Date().toISOString(),
      hidden: true
    }]);

    // If the action has immediate flag, trigger a new AI response
    try {
      const immediate = localActions[actionId]?.immediate;
      const actionData = typeof actionResponseResult === 'string' ? JSON.parse(actionResponseResult) : actionResponseResult;

      // Always trigger a new AI response for command outputs to ensure AI can process them
      if (immediate || actionData.isCommandOutput) {
        console.log("actionData IMMEDIATE", actionData);
        handleActionSendMessage();
      }
    } catch (e) {
      console.error("Error checking immediate flag:", e);
    }
  }

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

        // Parse actions from the chunk
        const processedChunk = parseActionsFromChunk(chunkSum);

        // Update Message
        setMessages(prev => prev.map(msg => msg.id === newMessageId ? {
          ...msg,
          content: processedChunk
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

  const handleActionSendMessage = async () => {
    try {
      // Call the AI chat API
      const streamResponse = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/event-stream',
        },
        body: JSON.stringify({
          stream: true,
          message: undefined,
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

      setIsChatLoading(true);

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

        // Parse actions from the chunk
        const processedChunk = parseActionsFromChunk(chunkSum);

        // Update Message
        setMessages(prev => prev.map(msg => msg.id === newMessageId ? {
          ...msg,
          content: processedChunk
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
  }

  const parseActionsFromChunk = (summedChunk: string) => {
    // eğer başlangıç varsa ve eğer kapatılmadı ise gerisini gönderme.
    if (summedChunk.includes('<x-system-action>') && !summedChunk.includes('</x-system-action>')) {
      const startIndex = summedChunk.indexOf('<x-system-action>');
      if (startIndex) {
        return summedChunk.substring(startIndex);
      } else {
        return summedChunk;
      }
    }

    const matchedActions = summedChunk.match(/<x-system-action>([\s\S]*?)<\/x-system-action>/g);
    if (matchedActions) {
      matchedActions.forEach(action => {
        try {
          const parsed = JSON.parse(action.replace('<x-system-action>', '').replace('</x-system-action>', ''));

          // Check if action already exists and is not pending
          if (localActions[parsed.id] && localActions[parsed.id].status !== "pending") {
            return; // Skip if action already exists and is not pending
          }

          // Process different action types
          switch (parsed.action) {
            case "create_file":
              createFileAction(parsed);
              break;
            case "write_file":
              writeFileAction(parsed);
              break;
            case "run_command":
              runCommandAction(parsed);
              break;
            case "read_file":
              readFileAction(parsed);
              break;
            case "read_file_and_send_to_ai_chat_session":
              readFileAndSendToAiChatSession(parsed);
              break;
            default:
              console.warn(`Unknown action type: ${parsed.action}`);
          }
        } catch (e) {
          console.error("Error parsing action:", e);
        }
      });
    }
    return summedChunk.replaceAll(/<x-system-action>([\s\S]*?)<\/x-system-action>/g, '');
  }

  const createFileAction = async (action: ActionType) => {
    addLocalAction({
      action: action.action,
      id: action.id,
      immediate: action.immediate,
      status: "in-progress",
      data: action
    });

    try {
      // Get the WebContainer instance from the store
      const webcontainerInstance = useStore.getState().webcontainerInstance;

      if (!webcontainerInstance) {
        throw new Error("WebContainer is not initialized");
      }

      // Parse the action data to get file path
      const actionData = action;
      const filePath = actionData.file_path;

      if (!filePath) {
        throw new Error("File path is missing in the action data");
      }

      // Create the file in WebContainer
      await webcontainerInstance.fs.writeFile(filePath, "");

      // Update action status to success
      updateLocalAction(action.id, {
        success: true,
        message: `File created successfully: ${filePath}`,
        immediate: false,
        isCommandOutput: false
      }, "success");

      // Add a success message to the chat
      addActionResponseToMessages(
        action.id,
        JSON.stringify({ success: true, message: `File created successfully: ${filePath}` }),
        action.action
      );
    } catch (error) {
      console.error("Error creating file:", error);

      // Update action status to error
      updateLocalAction(action.id, {
        success: false,
        message: `Error creating file: ${error instanceof Error ? error.message : "Unknown error"}`,
        immediate: false,
        isCommandOutput: false
      }, "error");

      // Add an error message to the chat
      addActionResponseToMessages(
        action.id,
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
        action.action
      );
    }
  }

  const readFileAction = async (action: ActionType) => {
    addLocalAction({
      action: action.action,
      id: action.id,
      immediate: action.immediate,
      status: "in-progress",
      data: action
    });

    try {
      // Get the WebContainer instance from the store
      const webcontainerInstance = useStore.getState().webcontainerInstance;

      if (!webcontainerInstance) {
        throw new Error("WebContainer is not initialized");
      }

      // Parse the action data to get file path
      const actionData = action;
      const filePath = actionData.file_path;

      if (!filePath) {
        throw new Error("File path is missing in the action data");
      }

      const fileContent = await webcontainerInstance.fs.readFile(filePath, 'utf-8');

      // Update action status to success
      updateLocalAction(action.id, {
        success: true,
        message: `File content: ${fileContent}`,
        immediate: action.immediate,
        isCommandOutput: false
      }, "success");

      // Add the file content to the chat
      addActionResponseToMessages(
        action.id,
        JSON.stringify({
          success: true,
          message: `File content: ${fileContent}`,
          content: fileContent // Include the actual content for AI to process
        }),
        action.action
      );
    } catch (error) {
      console.error("Error reading file:", error);

      // Update action status to error
      updateLocalAction(action.id, {
        success: false,
        message: `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`,
        immediate: action.immediate,
        isCommandOutput: false
      }, "error");

      // Add an error message to the chat
      addActionResponseToMessages(
        action.id,
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
        action.action
      );
    }
  }

  const writeFileAction = async (action: ActionType) => {
    addLocalAction({
      action: action.action,
      id: action.id,
      immediate: action.immediate,
      status: "in-progress",
      data: action
    });

    try {
      // Get the WebContainer instance from the store
      const webcontainerInstance = useStore.getState().webcontainerInstance;

      if (!webcontainerInstance) {
        throw new Error("WebContainer is not initialized");
      }

      // Parse the action data to get file path and content
      const actionData = action;
      const filePath = actionData.file_path;
      const content = actionData.content;

      if (!filePath) {
        throw new Error("File path is missing in the action data");
      }

      if (content === undefined) {
        throw new Error("Content is missing in the action data");
      }

      console.log("writeFileAction", filePath, content);

      // Write the content to the file in WebContainer
      await webcontainerInstance.fs.writeFile(filePath, content);

      // Update action status to success
      updateLocalAction(action.id, {
        success: true,
        message: `Content written to file: ${filePath}`,
        immediate: action.immediate,
        isCommandOutput: false
      }, "success");

      // Add a success message to the chat
      addActionResponseToMessages(
        action.id,
        JSON.stringify({ success: true, message: `Content written to file: ${filePath}` }),
        action.action
      );
    } catch (error) {
      console.error("Error writing to file:", error);

      // Update action status to error
      updateLocalAction(action.id, {
        success: false,
        message: `Error writing to file: ${error instanceof Error ? error.message : "Unknown error"}`,
        immediate: action.immediate,
        isCommandOutput: false
      }, "error");

      // Add an error message to the chat
      addActionResponseToMessages(
        action.id,
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
        action.action
      );
    }
  }

  const runCommandAction = async (action: ActionType) => {
    addLocalAction({
      action: action.action,
      id: action.id,
      immediate: action.immediate,
      status: "in-progress",
      data: action
    });

    try {
      // Get the WebContainer instance from the store
      const webcontainerInstance = useStore.getState().webcontainerInstance;

      if (!webcontainerInstance) {
        throw new Error("WebContainer is not initialized");
      }

      // Parse the action data to get command
      const actionData = action;
      const command = actionData.command;

      if (!command) {
        throw new Error("Command is missing in the action data");
      }

      console.log("runCommandAction", command);

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

      // Add command output to the store for WebContainerConsole to display
      useStore.getState().addCommandOutput(command, output);

      // Update action status to success
      updateLocalAction(action.id, {
        success: true,
        message: `Command executed successfully with exit code ${exitCode}`,
        immediate: action.immediate,
        isCommandOutput: true
      }, "success");

      // Create a more detailed response with the command output
      const responseData = {
        success: true,
        message: `Command executed successfully with exit code ${exitCode}`,
        command: command,
        output: output,
        exitCode: exitCode,
        // Add a flag to indicate this is a command output that should be processed
        isCommandOutput: true
      };

      // Add a success message to the chat with the command output
      addActionResponseToMessages(
        action.id,
        JSON.stringify(responseData),
        action.action
      );
    } catch (error) {
      console.error("Error executing command:", error);

      // Update action status to error
      updateLocalAction(action.id, {
        success: false,
        message: `Error executing command: ${error instanceof Error ? error.message : "Unknown error"}`,
        immediate: action.immediate,
        isCommandOutput: true
      }, "error");

      // Add an error message to the chat
      addActionResponseToMessages(
        action.id,
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          command: action.command || "unknown command"
        }),
        action.action
      );
    }
  }

  const readFileAndSendToAiChatSession = async (action: ActionType) => {
    addLocalAction({
      action: action.action,
      id: action.id,
      immediate: action.immediate,
      status: "in-progress",
      data: action
    });

    try {
      const webcontainerInstance = useStore.getState().webcontainerInstance;
      if (!webcontainerInstance) {
        throw new Error("WebContainer is not initialized");
      }

      const actionData = action;
      const filePath = actionData.file_path;
      const fileRandomReadId = actionData.file_random_read_id;

      if (!filePath) {
        throw new Error("File path is missing in the action data");
      }

      const fileContent = await webcontainerInstance.fs.readFile(filePath, 'utf-8');
      console.log("readFileAndSendToAiChatSession", filePath, fileContent);

      // Update action status to success
      updateLocalAction(action.id, {
        success: true,
        message: `File content: ${fileContent}`,
        immediate: action.immediate,
        isCommandOutput: false
      }, "success");

      // Add the file content to the chat
      addActionResponseToMessages(
        action.id,
        JSON.stringify({
          success: true,
          message: `File content: ${fileContent}`,
          content: fileContent,
          file_random_read_id: fileRandomReadId
        }),
        action.action
      );
    } catch (error) {
      console.error("Error reading file and sending to AI chat session:", error);

      // Update action status to error
      updateLocalAction(action.id, {
        success: false,
        message: `Error reading file and sending to AI chat session: ${error instanceof Error ? error.message : "Unknown error"}`,
        immediate: action.immediate,
        isCommandOutput: false
      }, "error");

      // Add an error message to the chat
      addActionResponseToMessages(
        action.id,
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
        action.action
      );
    }
  }

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
                        {parseActionsFromChunk(message.content)}
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