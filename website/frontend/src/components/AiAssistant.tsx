import { useState } from "react";
import { apiUrl } from "../lib/appConfig";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AiAssistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "user",
      content: "Which route improved the most?",
    },
    {
      id: "2",
      role: "assistant",
      content:
        "510 Spadina improved most — avg delay dropped from 9 to 5 min (-44%), coinciding with removal of construction on Spadina Ave in early 2023.",
    },
  ]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userContent = input;
    const newUserMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userContent,
    };
    
    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    
    try {
      const response = await fetch(apiUrl("/api/ai/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, newUserMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from AI");
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI chat error:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I encountered an error while processing your request. Please try again later.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div className="ai-assistant-container chart-enter--delay-3">
      {/* AI Summary Section */}
      <div className="ai-section mb-6">
        <div className="flex items-center gap-2 mb-3 text-[var(--muted)]">
          <svg className="w-3.5 h-3.5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.85 8.65L22 12L14.85 15.35L12 22L9.15 15.35L2 12L9.15 8.65L12 2Z" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">AI Summary</span>
        </div>
        <div className="ai-summary-card p-4 rounded-lg border shadow-sm">
          <p className="text-sm leading-relaxed text-[var(--text)]">
            Delays on <span className="font-bold text-[var(--accent)]">504 King</span> peaked in <span className="font-bold">Oct–Nov</span>, up <span className="font-bold text-[var(--accent)]">+14%</span> vs the prior period — mostly operator diversions near downtown.
          </p>
        </div>
      </div>

      {/* Ask Section */}
      <div className="ai-section flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-3 text-[var(--muted)]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Ask about this data</span>
        </div>
        
        <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 panel-scroll">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  m.role === "user"
                    ? "bg-[#ede9fe] text-[#4c1d95] rounded-tr-none"
                    : "bg-[var(--control-bg)] text-[var(--text)] rounded-tl-none border border-[var(--border)]"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>

        <div className="relative mt-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask a question..."
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none shadow-sm"
          />
          <button
            onClick={handleSend}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[var(--accent)] text-white rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
