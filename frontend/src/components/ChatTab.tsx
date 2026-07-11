import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { sendChatMessage, addLocalUserMessage, setVariation, setProvider, clearChat } from '../store/chatSlice';
import type { SourceSnippet } from '../store/chatSlice';
import { Cpu, Send, Sparkles, Clock, FileText, Database, ShieldCheck } from 'lucide-react';

export const ChatTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { messages, activeVariation, llmProvider, loading } = useSelector((state: RootState) => state.chat);
  const { activeFolder } = useSelector((state: RootState) => state.documents);
  const [inputText, setInputText] = useState('');
  const [selectedSource, setSelectedSource] = useState<SourceSnippet | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Auto-select first source if available in last assistant response
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender === 'assistant' && lastMsg.retrieved_sources && lastMsg.retrieved_sources.length > 0) {
        setSelectedSource(lastMsg.retrieved_sources[0]);
      }
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;
    
    const queryText = inputText;
    setInputText('');
    dispatch(addLocalUserMessage(queryText));
    dispatch(sendChatMessage({ question: queryText, folder: activeFolder }));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', height: 'calc(100vh - 100px)', animation: 'fadeIn 0.4s ease' }}>
      
      {/* Left side: Chat Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', overflow: 'hidden' }}>
        
        {/* Chat Header Settings */}
        <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Cpu size={20} style={{ color: 'var(--accent-cyan)' }} />
            <div>
              <h3 style={{ fontSize: '1rem' }}>RAG Engine Config</h3>
              <p style={{ fontSize: '0.75rem' }}>Select retrieval model & LLM backend</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Variation Selection */}
            <div style={{ display: 'flex', background: 'rgba(10, 8, 16, 0.6)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '3px' }}>
              <button
                className={`btn btn-secondary`}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  border: 'none',
                  background: activeVariation === 'vanilla' ? 'var(--bg-glass-active)' : 'transparent',
                  borderColor: activeVariation === 'vanilla' ? 'var(--border-glass-bright)' : 'transparent',
                  boxShadow: activeVariation === 'vanilla' ? 'var(--shadow-cyan-glow)' : 'none'
                }}
                onClick={() => dispatch(setVariation('vanilla'))}
              >
                Vanilla RAG
              </button>
              <button
                className={`btn btn-secondary`}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  border: 'none',
                  background: activeVariation === 'advanced' ? 'var(--bg-glass-active)' : 'transparent',
                  borderColor: activeVariation === 'advanced' ? 'var(--border-glass-bright)' : 'transparent',
                  boxShadow: activeVariation === 'advanced' ? 'var(--shadow-cyan-glow)' : 'none'
                }}
                onClick={() => dispatch(setVariation('advanced'))}
              >
                Advanced RAG
              </button>
            </div>

            {/* Provider Override */}
            <select
              className="input-field"
              style={{ width: '130px', padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
              value={llmProvider}
              onChange={(e) => dispatch(setProvider(e.target.value))}
            >
              <option value="groq">Groq API</option>
              <option value="gemini">Gemini API</option>
              <option value="openai">OpenAI API</option>
            </select>

            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => dispatch(clearChat())}>
              Clear
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="glass-panel" style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
          {messages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
              <div style={{ background: 'rgba(6, 182, 212, 0.08)', padding: '16px', borderRadius: '50%' }}>
                <Sparkles size={36} style={{ color: 'var(--accent-cyan)' }} />
              </div>
              <h2>Ask Anything About PDFs</h2>
              <p style={{ fontSize: '0.9rem' }}>Type a question to search and query your indexed PDFs. Select a RAG variation above to compare accuracy.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '10px' }}>
                <button className="btn btn-secondary" style={{ fontSize: '0.85rem', width: '100%' }} onClick={() => setInputText("List all rating plan rules")}>
                  "List all rating plan rules"
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.85rem', width: '100%' }} onClick={() => setInputText("Using the Base Rate and the applicable Mandatory Hurricane Deductible Factor, calculate the unadjusted Hurricane premium for an HO3 policy with a $750,000 Coverage A limit located 3,000 feet from the coast in a Coastline Neighborhood.")}>
                  "Calculate Hurricane Premium"
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                {/* Bubble */}
                <div
                  style={{
                    background: msg.sender === 'user' ? 'var(--bg-glass-active)' : 'rgba(20, 16, 32, 0.45)',
                    border: msg.sender === 'user' ? '1px solid var(--border-glass-bright)' : '1px solid var(--border-glass)',
                    padding: '16px 20px',
                    borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    fontSize: '0.95rem',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.6',
                    boxShadow: msg.sender === 'user' ? 'var(--shadow-cyan-glow)' : 'none',
                  }}
                >
                  {msg.text}
                </div>

                {/* Sub info */}
                {msg.sender === 'assistant' && (
                  <div style={{ display: 'flex', gap: '14px', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 4px', marginTop: '4px' }}>
                    <span className="flex-between gap-10">
                      <Clock size={12} />
                      <span>{msg.latency_seconds?.toFixed(3)}s</span>
                    </span>
                    <span className="flex-between gap-10">
                      <Database size={12} />
                      <span>{msg.variation === 'advanced' ? 'Advanced RAG' : 'Vanilla RAG'}</span>
                    </span>
                    <span className="flex-between gap-10">
                      <ShieldCheck size={12} />
                      <span style={{ textTransform: 'uppercase' }}>{msg.llm_provider}</span>
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
          
          {loading && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(20, 16, 32, 0.45)', padding: '12px 20px', borderRadius: '16px 16px 16px 2px', border: '1px solid var(--border-glass)' }}>
              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Retrieving documents & reasoning...</span>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Input box */}
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <input
            type="text"
            className="input-field"
            placeholder="Ask a question about the PDFs..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn" disabled={loading || !inputText.trim()}>
            <Send size={16} />
          </button>
        </form>

      </div>

      {/* Right side: Retrieved Sources Inspector */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', overflow: 'hidden', padding: '20px' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>Retrieved Context</h3>
        
        {/* Source items list */}
        <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.length > 0 && messages[messages.length - 1].retrieved_sources ? (
            messages[messages.length - 1].retrieved_sources?.map((src, index) => (
              <div
                key={index}
                className="glass-panel"
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: selectedSource?.text === src.text ? 'rgba(6, 182, 212, 0.08)' : 'rgba(10, 8, 16, 0.3)',
                  borderColor: selectedSource?.text === src.text ? 'var(--border-glass-bright)' : 'var(--border-glass)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => setSelectedSource(src)}
              >
                <div className="flex-between" style={{ marginBottom: '6px' }}>
                  <span className="flex-between gap-10" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-cyan)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <FileText size={12} />
                    {src.document_name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Page {src.page}</span>
                </div>
                <p style={{ fontSize: '0.8rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {src.text}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  Similarity: {(src.score * 100).toFixed(1)}%
                </div>
              </div>
            ))
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.9rem', padding: '20px' }}>
              No documents retrieved yet. Send a message to see sources.
            </div>
          )}
        </div>

        {/* Selected source detail drawer */}
        {selectedSource && (
          <div style={{ height: '180px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <FileText size={14} style={{ color: 'var(--accent-violet)' }} />
              <span>Full Segment Source</span>
            </h4>
            <div style={{ background: 'rgba(10, 8, 16, 0.5)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '10px', fontSize: '0.8rem', overflowY: 'auto', flexGrow: 1, lineBreak: 'anywhere' }}>
              {selectedSource.text}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
export default ChatTab;
