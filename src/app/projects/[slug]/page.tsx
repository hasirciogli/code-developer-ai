'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import SplitPane from 'split-pane-react';
import 'split-pane-react/esm/themes/default.css';
import PromptEditor from '@/components/PromptEditor';
import CodePreview from '@/components/CodePreview';
import FileExplorer from '@/components/FileExplorer';
import WebContainerConsole from '@/components/WebContainerConsole';
import WebContainerInitializer from '@/components/WebContainerInitializer';
import dynamic from 'next/dynamic';

interface ProjectPageProps {
  params: Promise<{
    slug: string;
  }>;
}

const DynamicClientsidePromptEditor = dynamic(() => import('@/components/PromptEditor'), {
  ssr: false,
});

export default function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const [mainSizes, setMainSizes] = useState<number[]>([30, 70]);
  const [rightSizes, setRightSizes] = useState<number[]>([70, 30]); // Height split for code/preview and console
  const [codeSizes, setCodeSizes] = useState<number[]>([30, 70]); // Width split for file tree and code editor
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Project Editor</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="px-3 py-1 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
            >
              {isPreviewMode ? 'Show Code' : 'Show Preview'}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <SplitPane
          split="vertical"
          sizes={mainSizes}
          onChange={setMainSizes}
          sashRender={() => <div className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors" />}
        >
          {/* Left side - Prompt Editor */}
          <div className="h-full">
            <DynamicClientsidePromptEditor projectSlug={slug} />
          </div>

          {/* Right side - Code Editor and Preview */}
          <div className="h-full" id='right-site-code-editor-preview'>
            {/* Top section - Code Editor */}
            <div className="h-full">
              <SplitPane
                split="vertical"
                sizes={codeSizes}
                onChange={setCodeSizes}
                sashRender={() => <div className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors" />}
              >
                {/* File Explorer */}
                <div className="h-full bg-gray-50 p-4">
                  <FileExplorer projectSlug={slug} />
                </div>

                {/* Code Editor / Preview */}
                <div className="h-full flex flex-col">
                  <div className="flex-1 flex">
                    <div className="flex-1">
                      <CodePreview isPreviewMode={isPreviewMode} projectSlug={slug} />
                    </div>
                  </div>
                </div>
              </SplitPane>
            </div>

            {/* Bottom section - WebContainer Console */}
            <div className="w-full bg-gray-900 relative">
              <WebContainerConsole projectSlug={slug} />
            </div>
          </div>
        </SplitPane>
      </div>

      {/* WebContainer initializer */}
      <WebContainerInitializer projectSlug={slug} />
    </div>
  );
} 