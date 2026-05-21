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
  }

  interface Window {
    echoMirageBrowser?: EchoMirageBrowserBridge;
    echoMirageSave?: EchoMirageSaveBridge;
  }
}

export {};
