import React, { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "model";
  text: string;
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", text: "Ciao! Sono il tuo assistente IA. Sono qui per aiutarti coi crediti, il mercato, e per rispondere ad informazioni base del Fantacalcetto. Chiedimi pure!" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: userMsg,
          history: messages.filter(m => !(m.role === "model" && m.text.includes("Ciao! Sono il tuo assistente")))
        })
      });
      if (!response.ok) throw new Error("Errore di connessione con l'A.I.");
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: "model", text: data.text }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "model", text: "Scusa, in questo momento i server IA sono sovraccarichi. Riprova più tardi!" }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        document.getElementById("assistant-input")?.focus();
      }, 50);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 rounded-full bg-slate-900 text-amber-400 shadow-xl hover:bg-slate-800 transition-transform transform hover:scale-110 z-50 flex items-center justify-center cursor-pointer border border-amber-400/20 group"
          title="Fai una domanda all'IA"
        >
          <Bot className="w-6 h-6 group-hover:animate-pulse" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[340px] sm:w-[380px] bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden max-h-[75vh] min-h-[480px]">
          {/* Header */}
          <div className="bg-slate-900 border-b border-slate-800 text-white p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 font-bold select-none text-amber-400">
              <Bot className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">Aiutante Fantacalcetto</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-full hover:bg-slate-800 shrink-0"
              title="Chiudi pannello"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Area messaggi */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50 relative selection:bg-amber-200" style={{ scrollbarWidth: "thin" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 text-[14px] ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "model" && <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-1 border border-amber-200"><Bot className="w-4 h-4 text-amber-600" /></div>}
                
                <div className={`p-3.5 rounded-2xl max-w-[80%] leading-relaxed shadow-xs ${msg.role === "user" ? "bg-slate-800 text-slate-100 rounded-tr-sm" : "bg-white text-slate-700 border border-slate-200 rounded-tl-sm"}`}>
                  {msg.text.split('\n').map((line, lidx) => (
                      <React.Fragment key={lidx}>
                          {line}
                          {lidx !== msg.text.split('\n').length - 1 && <br />}
                      </React.Fragment>
                  ))}
                </div>

                {msg.role === "user" && <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1 border border-slate-300"><User className="w-4 h-4 text-slate-600" /></div>}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-1 border border-amber-200"><Bot className="w-4 h-4 text-amber-600" /></div>
                <div className="p-3 bg-white border border-slate-200 shadow-xs rounded-2xl rounded-tl-sm min-w-[60px] flex justify-center items-center">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-2 py-1.5 focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-transparent transition-all">
              <input
                id="assistant-input"
                type="text"
                placeholder="Come faccio a inserire la..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 bg-transparent border-none outline-none text-[15px] text-slate-700 py-1.5 px-2 placeholder:text-slate-400"
                disabled={isLoading}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 group shadow-sm"
              >
                <Send className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
