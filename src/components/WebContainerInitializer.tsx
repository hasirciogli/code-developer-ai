'use client';

import { useState, useEffect, useRef } from 'react';
import { WebContainer } from '@webcontainer/api';
import { useStore } from '@/store';

interface WebContainerInitializerProps {
  projectSlug: string;
}

export default function WebContainerInitializer({ projectSlug }: WebContainerInitializerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setWebcontainerInstance = useStore(
    (state) => state.setWebcontainerInstance as (instance: WebContainer | null) => void
  );
  const currentInstance = useStore(state => state.webcontainerInstance);
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentInstance) {
      console.log('WebContainer already initialized');
      return;
    };
    if (error) {
      console.log('WebContainer has an error');
      return;
    };
    if (!projectSlug) {
      console.log('No project slug provided');
      return;
    };
    let isMounted = true;

    const overlayTargetId = "right-site-code-editor-preview"
    const overlayTarget = document.getElementById(overlayTargetId);

    const openInitializeModal = () => {
      if (overlayTarget) {
        if (loadingRef.current) {
          loadingRef.current.classList.remove("hidden")
          loadingRef.current.style.position = "fixed";
          loadingRef.current.style.top = overlayTarget.offsetTop + "px";
          loadingRef.current.style.zIndex = "1000";
          loadingRef.current.style.left = overlayTarget.offsetLeft + "px";
          loadingRef.current.style.width = "100%";
          loadingRef.current.style.height = "100vh";
          loadingRef.current.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
          loadingRef.current.style.display = "flex";
          loadingRef.current.style.flexDirection = "column"
          loadingRef.current.style.justifyContent = "center";
          loadingRef.current.style.alignItems = "center";
          loadingRef.current.style.color = "white";
          loadingRef.current.style.fontSize = "24px";
          loadingRef.current.style.fontWeight = "bold";
        }
      }
    }

    const closeInitializeModal = () => {
      if (loadingRef.current) {
        loadingRef.current.classList.add("hidden")
      }
    }

    const bootWebContainer = async () => {
      try {
        if (!isMounted) return;
        setIsLoading(true);
        setError(null);
        openInitializeModal();

        // If there's an existing WebContainer instance, set it to null in store
        // We can't properly dispose it due to API limitations, but this helps with state management
        if (currentInstance) {
          console.log('Releasing reference to previous WebContainer instance');
          setWebcontainerInstance(null);
        }

        try {
          // Boot a new WebContainer instance
          const webcontainerInstance = await WebContainer.boot();
          console.log('WebContainer booted successfully');

          if (isMounted) {
            setWebcontainerInstance(webcontainerInstance);
            setIsLoading(false);
            closeInitializeModal()
          }
        } catch (err) {
          if (isMounted) {
            console.error('Failed to boot WebContainer:', err);
            setError(err instanceof Error ? err.message : 'Failed to boot WebContainer');
            setIsLoading(false);
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error in WebContainer initialization:', error);
          setError(error instanceof Error ? error.message : 'Unknown error initializing WebContainer');
          setIsLoading(false);
        }
      }
    };

    // Boot WebContainer when the component mounts or projectSlug changes
    bootWebContainer();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log('WebContainer initializer unmounted');
    };
  }, [projectSlug, setWebcontainerInstance, currentInstance, error]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md">
        <h3 className="font-semibold mb-2">WebContainer Error</h3>
        <p>{error}</p>
        <p className="mt-2 text-sm">
          Try refreshing the page or using a different browser.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center hidden" ref={loadingRef}>
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent mx-auto"></div>
        <p className="mt-2 text-gray-600">Initializing WebContainer...</p>
      </div>
    );
  }

  return null;
} 