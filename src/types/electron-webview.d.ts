import type * as React from "react";

declare global {
  interface HTMLWebViewElement extends HTMLElement {
    getURL(): string;
    getTitle(): string;
    loadURL(url: string): void;
    executeJavaScript(code: string): Promise<unknown>;
    reload(): void;
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): void;
    goForward(): void;
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLWebViewElement>, HTMLWebViewElement> & {
        allowpopups?: string;
        partition?: string;
        preload?: string;
        src?: string;
      };
    }
  }

  interface EchoMirageBrowserSnapshot {
    ok?: boolean;
    url?: string;
    title?: string;
    text?: string;
    error?: string;
  }

  interface EchoMirageBrowserBridge {
    navigate(url: string): Promise<EchoMirageBrowserSnapshot>;
    click(selector: string): Promise<EchoMirageBrowserSnapshot>;
    type(selector: string, value: string): Promise<EchoMirageBrowserSnapshot>;
    submit(selector: string): Promise<EchoMirageBrowserSnapshot>;
    snapshot(): Promise<EchoMirageBrowserSnapshot>;
    reload(): Promise<EchoMirageBrowserSnapshot>;
    back(): Promise<EchoMirageBrowserSnapshot>;
    forward(): Promise<EchoMirageBrowserSnapshot>;
  }

  interface EchoMirageSaveBridge {
    showDialog(options: {
      defaultRelativePath: string;
      content: string;
    }): Promise<{ canceled: boolean; filePath?: string; error?: string }>;
    showBinaryDialog?(options: {
      base64: string;
      defaultRelativePath?: string;
      defaultPath?: string;
    }): Promise<{ canceled: boolean; filePath?: string; error?: string }>;
  }

  interface EchoMirageClipboardBridge {
    readText(): Promise<string>;
    writeText(text: string): Promise<{ ok: boolean }>;
  }

  interface EchoMirageOpenBridge {
    pickConvertDocument(): Promise<{ canceled: boolean; filePath?: string; error?: string }>;
    pickOperatorFolder(): Promise<{
      canceled: boolean;
      folderPath?: string;
      name?: string;
      error?: string;
    }>;
    listOperatorFolder(
      rootPath: string,
      relativePath: string,
      pathPrefix: string,
    ): Promise<{
      ok: boolean;
      nodes?: Array<{
        name: string;
        path: string;
        kind: "file" | "folder";
        ignored?: boolean;
        truncated?: boolean;
      }>;
      error?: string;
    }>;
    readOperatorFile(
      rootPath: string,
      logicalPath: string,
    ): Promise<{
      ok: boolean;
      name?: string;
      mimeType?: string;
      text?: string;
      base64?: string;
      binaryMetadata?: boolean;
      largeBinary?: boolean;
      filePath?: string;
      size?: number;
      error?: string;
    }>;
    writeOperatorFile(
      rootPath: string,
      logicalPath: string,
      content: string,
    ): Promise<{
      ok: boolean;
      filePath?: string;
      error?: string;
    }>;
    writeBinaryFile?(
      filePath: string,
      base64: string,
    ): Promise<{
      ok: boolean;
      filePath?: string;
      error?: string;
    }>;
    openPath(filePath: string): Promise<{
      ok: boolean;
      error?: string;
    }>;
  }

  interface Window {
    echoMirageClipboard?: EchoMirageClipboardBridge;
    echoMirageBrowser?: EchoMirageBrowserBridge;
    echoMirageSave?: EchoMirageSaveBridge;
    echoMirageOpen?: EchoMirageOpenBridge;
  }
}

export {};
