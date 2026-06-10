'use client';

import * as React from 'react';

function canUseElectronWebview() {
  if (typeof window === 'undefined') return false;
  return /Electron/i.test(window.navigator.userAgent);
}

type CyberdeckWebTabFrameProps = {
  url: string;
  webviewRef?: React.RefObject<HTMLWebViewElement | null>;
  className?: string;
};

export function CyberdeckWebTabFrame({
  url,
  webviewRef,
  className = 'h-full w-full',
}: CyberdeckWebTabFrameProps) {
  const localWebviewRef = React.useRef<HTMLWebViewElement | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const useWebview = canUseElectronWebview();

  const setWebviewRef = React.useCallback(
    (node: HTMLWebViewElement | null) => {
      localWebviewRef.current = node;
      if (webviewRef && 'current' in webviewRef) {
        (webviewRef as React.MutableRefObject<HTMLWebViewElement | null>).current = node;
      }
    },
    [webviewRef],
  );

  React.useEffect(() => {
    const target = url.trim();
    if (!target) return;

    if (useWebview) {
      const view = localWebviewRef.current;
      if (!view) return;
      view.setAttribute("allowpopups", "");
      try {
        const current = view.getURL?.();
        if (current !== target) {
          view.loadURL(target);
        }
      } catch {
        view.setAttribute('src', target);
      }
      return;
    }

    const frame = iframeRef.current;
    if (frame) {
      const absolute = new URL(target, window.location.origin).href;
      if (frame.src !== absolute) {
        frame.src = absolute;
      }
    }
  }, [url, useWebview]);

  if (useWebview) {
    return (
      <webview
        ref={setWebviewRef}
        src={url}
        partition="persist:custom-tab-browser"
        className={className}
      />
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={url}
      title="Web tab"
      className={`${className} border-0 bg-black`}
    />
  );
}
