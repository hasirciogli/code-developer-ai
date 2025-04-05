'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import ModelSelector from '@/components/ModelSelector';
import { AIProvider } from '@/services/ai-provider';

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'chat' | 'about'>('chat');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: 'Merhaba! Ben AI Code Generator asistanınızım. Size nasıl yardımcı olabilirim? Proje oluşturma, kod yazma veya programlama hakkında herhangi bir sorunuz varsa bana sorabilirsiniz.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [aiProvider, setAiProvider] = useState<AIProvider>('google');
  const [aiModel, setAiModel] = useState('gemini-1.5-pro-preview-0325');

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
  }, [input]);

  // Save the selected provider and model to localStorage
  useEffect(() => {
    localStorage.setItem('aiProvider', aiProvider);
    localStorage.setItem('aiModel', aiModel);
  }, [aiProvider, aiModel]);

  // Load saved provider and model from localStorage on first render
  useEffect(() => {
    const savedProvider = localStorage.getItem('aiProvider');
    const savedModel = localStorage.getItem('aiModel');
    if (savedProvider) {
      setAiProvider(savedProvider as AIProvider);
    }
    if (savedModel) {
      setAiModel(savedModel);
    }
  }, []);

  // Handle Enter key to submit (with Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
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
        content: `AI sağlayıcı ve model değiştirildi: ${provider === 'google' ? 'Google Gemini' : 'DeepSeek'} - ${modelId}`
      }
    ]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Call the AI chat API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: userMessage,
          history: messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          provider: aiProvider,
          model: aiModel
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      
      // Update provider and model if they changed on the server
      if (data.provider && data.model) {
        setAiProvider(data.provider);
        setAiModel(data.model);
      }
      
      // If action is create_project, redirect to project creation page
      if (data.action === 'create_project') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response
        }]);
        
        setTimeout(() => {
          router.push('/projects/new');
        }, 1500);
      } else {
        // Just display the response
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response
        }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.' 
      }]);
    } finally {
      setIsLoading(false);
      // Focus input after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="relative isolate">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          {/* Header */}
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              AI Code Generator
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Yapay zeka ile kod projeleri oluşturun ve geliştirin.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex justify-center mb-8">
            <div className="border-b border-gray-200 w-full max-w-3xl">
              <nav className="-mb-px flex" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                    activeTab === 'chat'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Sohbet
                </button>
                <button
                  onClick={() => setActiveTab('about')}
                  className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                    activeTab === 'about'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Hakkında
                </button>
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="mx-auto max-w-3xl">
            {activeTab === 'chat' ? (
              <div className="bg-white rounded-lg shadow-sm border flex flex-col h-[600px]">
                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div className="flex items-start max-w-3xl">
                        {message.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold mr-2 flex-shrink-0 mt-1">
                            AI
                          </div>
                        )}
                        <div
                          className={`rounded-lg px-4 py-3 ${
                            message.role === 'user'
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
                            {session?.user?.name?.charAt(0) || 'U'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex items-start max-w-3xl">
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
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full rounded-md border border-gray-300 bg-white px-3.5 py-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none max-h-32"
                        placeholder="Mesajınızı yazın... (Göndermek için Enter, yeni satır için Shift+Enter)"
                        disabled={isLoading}
                      />
                      <div className="absolute right-3 bottom-2 text-xs text-gray-400">
                        {isLoading ? 'Yanıt bekleniyor...' : 'Enter tuşu ile gönder'}
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">Bu Uygulama Hakkında</h2>
                <p className="mb-4">
                  AI Code Generator, yapay zeka teknolojisini kullanarak kod projeleri oluşturmanızı sağlayan 
                  bir web uygulamasıdır. Projelerinizi tanımlamanız yeterli, yapay zeka sizin için kodu oluşturacak.
                </p>
                <p className="mb-4">
                  Özellikler:
                </p>
                <ul className="list-disc pl-5 mb-4 space-y-2">
                  <li>Yapay zeka ile kod projesi oluşturma</li>
                  <li>Canlı kod önizleme</li>
                  <li>Proje yönetimi</li>
                  <li>Otomatik dosya yapısı oluşturma</li>
                  <li>GitHub entegrasyonu</li>
                  <li>Google Gemini ve DeepSeek AI model seçenekleri</li>
                </ul>
                {session ? (
                  <div className="mt-8">
                    <Link
                      href="/projects"
                      className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      Projelerime Git
                    </Link>
                  </div>
                ) : (
                  <div className="mt-8">
                    <Link
                      href="/login"
                      className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      Giriş Yap
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 