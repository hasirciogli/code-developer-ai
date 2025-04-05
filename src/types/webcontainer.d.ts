import { WebContainer } from '@webcontainer/api';

declare module '@webcontainer/api' {
  interface WebContainerProcess {
    exit: Promise<number>;
    output: ReadableStream;
    input: WritableStream;
  }

  interface WebContainerFS {
    readFile(path: string, encoding: 'utf-8'): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  }

  interface WebContainer {
    fs: WebContainerFS;
    spawn(command: string, args?: string[]): Promise<WebContainerProcess>;
    mount(files: Record<string, unknown>): Promise<void>;
    on(event: 'server-ready', listener: (port: number, url: string) => void): void;
    on(event: 'error', listener: (error: Error) => void): void;
    teardown(): Promise<void>;
  }
} 