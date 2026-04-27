"use client";

import { useState, useRef, useEffect } from "react";
import { art } from "@/lib/TerminalArt";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

const servers = [
  { id: "m", glyph: "Ø", label: "ØPERATOR" },
  { id: "s", glyph: "μ", label: "MAINNET-UPLINK" },
  { id: "b", glyph: "§", label: "SAMUS-MANUS" },
];

export default function CyberdeckPage() {
  const [server, setServer] = useState("m");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [generatedUI, setGeneratedUI] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const serverLabel = servers.find((s) => s.id === server)?.label || "";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  const handleServerClick = (id: string) => {
    setServer(id);
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsStreaming(true);
    setStreamText("");
    setGeneratedUI(null);

    try {
      const res = await fetch("/api/cyberdeck-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamText(fullText);
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", text: fullText }]);
      setStreamText("");

      if (fullText.includes("[UI]")) {
        const uiMatch = fullText.match(/\[UI\](.*?)\[\/UI\]/s);
        if (uiMatch) {
          setGeneratedUI(uiMatch[1].trim());
        }
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: String(err) }]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-green-500 font-mono terminal-window">
      {/* COL 1: TAB STRIP */}
      <aside className="flex flex-col items-center flex-shrink-0 w-16 border-r border-gray-800 bg-gray-900 py-4 z-40">
        {servers.map((btn) => (
          <div
            key={btn.id}
            className="btn-container"
            style={{ width: "56px", height: "52px", position: "relative", marginBottom: "8px" }}
          >
            <pre
              className="ascii-btn"
              onClick={() => handleServerClick(btn.id)}
              style={{
                position: "absolute",
                inset: 0,
                margin: 0,
                cursor: "pointer",
                lineHeight: "1.1",
                fontSize: "13px",
                color: server === btn.id ? "#00ff00" : "#8a8a8a",
                textShadow: server === btn.id ? "0 0 8px rgba(0, 255, 0, 0.6)" : "none",
              }}
            >
              {server === btn.id ? art.pushed(btn.glyph) : art.popped(btn.glyph)}
            </pre>
          </div>
        ))}
      </aside>

      {/* COL 2 & 3: RESIZABLE PANELS */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* COL 2: TUI / CHAT */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex flex-col h-full border-r border-gray-800 bg-black">
            <header className="flex items-center justify-end h-16 px-6 border-b border-gray-800 bg-black">
              <pre className="text-green-400 text-[5px] leading-[1.0] whitespace-pre font-mono" style={{ textShadow: "0 0 5px #00ff00" }}>
{`
          _            _             _       _    _       
        ╱╲ ╲         ╱╲ ╲           ╱ ╱╲    ╱ ╱╲ ╱╲ ╲     
       ╱  ╲ ╲       ╱  ╲ ╲         ╱ ╱ ╱   ╱ ╱ ╱╱  ╲ ╲    
      ╱ ╱╲ ╲ ╲     ╱ ╱╲ ╲ ╲       ╱ ╱_╱   ╱ ╱ ╱╱ ╱╲ ╲ ╲   
     ╱ ╱ ╱╲ ╲_╲   ╱ ╱ ╱╲ ╲ ╲     ╱ ╱╲ ╲__╱ ╱ ╱╱ ╱ ╱╲ ╲ ╲  
    ╱ ╱_╱_ ╲╱_╱  ╱ ╱ ╱  ╲ ╲_╲   ╱ ╱╲ ╲___╲╱ ╱╱ ╱ ╱  ╲ ╲_╲ 
   ╱ ╱____╱╲    ╱ ╱ ╱    ╲╱_╱  ╱ ╱ ╱╲╱___╱ ╱╱ ╱ ╱   ╱ ╱ ╱ 
  ╱ ╱╲____╲╱   ╱ ╱ ╱          ╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱   ╱ ╱ ╱  
 ╱ ╱ ╱______  ╱ ╱ ╱________  ╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱___╱ ╱ ╱   
╱ ╱ ╱_______╲╱ ╱ ╱_________╲╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱____╲╱ ╱    
╲╱__________╱╲╱____________╱╲╱_╱    ╲╱_╱ ╲╱_________╱`}
              </pre>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.map((m, i) => (
                <div key={i} className="text-xs">
                  <span className={m.role === "user" ? "text-gray-600" : m.role === "assistant" ? "text-green-400" : "text-red-400"}>
                    [{m.role === "user" ? "USR" : m.role === "assistant" ? "AI" : "ERR"}]{" "}
                  </span>
                  <span className="text-gray-300 whitespace-pre-wrap">{m.text}</span>
                </div>
              ))}
              {streamText && (
                <div className="text-xs">
                  <span className="text-green-400">[AI] </span>
                  <span className="text-green-300">{streamText}</span>
                  <span className="animate-pulse">█</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-800 bg-gray-950">
              <div className="flex gap-2">
                <span className="text-green-500 font-bold">$</span>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Enter command..."
                  className="flex-1 bg-black border border-gray-700 px-3 py-2 text-green-400 placeholder-gray-600 focus:outline-none focus:border-green-500 text-xs"
                  disabled={isStreaming}
                />
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* COL 3: GENERATED UI */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex flex-col h-full bg-black">
            <header className="flex items-center h-16 px-6 border-b border-gray-800 bg-black">
              <pre className="text-green-400 text-[5px] leading-[1.0] whitespace-pre font-mono" style={{ textShadow: "0 0 5px #00ff00" }}>
{`
        _   _          _          _           _                   _              _      
       ╱╲_╲╱╲_╲ _     ╱╲ ╲       ╱╲ ╲        ╱ ╱╲                ╱╲ ╲           ╱╲ ╲    
      ╱ ╱ ╱ ╱ ╱╱╲_╲   ╲ ╲ ╲     ╱  ╲ ╲      ╱ ╱  ╲              ╱  ╲ ╲         ╱  ╲ ╲   
     ╱╲ ╲╱ ╲ ╲╱ ╱ ╱   ╱╲ ╲_╲   ╱ ╱╲ ╲ ╲    ╱ ╱ ╱╲ ╲            ╱ ╱╲ ╲_╲       ╱ ╱╲ ╲ ╲  
    ╱  ╲____╲__╱ ╱   ╱ ╱╲╱_╱  ╱ ╱ ╱╲ ╲_╲  ╱ ╱ ╱╲ ╲ ╲          ╱ ╱ ╱╲╱_╱      ╱ ╱ ╱╲ ╲_╲ 
   ╱ ╱╲╱________╱   ╱ ╱ ╱    ╱ ╱ ╱_╱ ╱ ╱ ╱ ╱ ╱  ╲ ╲ ╲        ╱ ╱ ╱ ______   ╱ ╱_╱_ ╲╱_╱ 
  ╱ ╱ ╱╲╱_╱╱ ╱ ╱   ╱ ╱ ╱    ╱ ╱ ╱__╲╱ ╱ ╱ ╱ ╱___╱ ╱╲ ╲      ╱ ╱ ╱ ╱╲_____╲ ╱ ╱____╱╲    
 ╱ ╱ ╱    ╱ ╱ ╱   ╱ ╱ ╱    ╱ ╱ ╱_____╱ ╱ ╱ ╱_____╱ ╱╲ ╲    ╱ ╱ ╱  ╲╱____ ╱╱ ╱╲____╲╱    
╱ ╱ ╱    ╱ ╱ ╱___╱ ╱ ╱__  ╱ ╱ ╱╲ ╲ ╲  ╱ ╱_________╱╲ ╲ ╲  ╱ ╱ ╱_____╱ ╱ ╱╱ ╱ ╱______    
╲╱_╱    ╱ ╱ ╱╱╲__╲╱_╱___╲╱ ╱ ╱  ╲ ╲ ╲╱ ╱ ╱_       __╲ ╲_╲╱ ╱ ╱______╲╱ ╱╱ ╱ ╱_______╲   
        ╲╱_╱ ╲╱_________╱╲╱_╱    ╲_╲╱╲_╲___╲     ╱____╱_╱╲╱___________╱ ╲╱__________╱`}
              </pre>
            </header>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {generatedUI ? (
                <div className="border border-green-900 bg-gray-950 p-6 rounded">
                  <div className="text-green-500 text-xs mb-4">// GENERATED COMPONENT</div>
                  <pre className="text-green-300 text-sm whitespace-pre-wrap">{generatedUI}</pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                  <div className="text-center">
                    <div className="text-4xl mb-4">⌘</div>
                    <div>Send a command to generate UI</div>
                    <div className="text-gray-700 mt-2">AI will create components in this panel</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
