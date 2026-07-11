import React, { useState, useEffect } from 'react';
import { Key, Save, Sparkles } from 'lucide-react';

interface ConfigState {
  project_name: string;
  is_mongodb_connected: boolean;
  default_llm_provider: string;
  has_openai_key: boolean;
  has_gemini_key: boolean;
  has_anthropic_key: boolean;
  has_groq_key: boolean;
}

export const SettingsTab: React.FC = () => {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  
  // Input fields (write-only for security, we only display if key exists in backend)
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [provider, setProvider] = useState('gemini');

  const API_URL = 'http://localhost:8000/api';

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setProvider(data.default_llm_provider);
      }
    } catch (err) {
      console.error('Failed to load system config', err);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveStatus(null);
    try {
      const response = await fetch(`${API_URL}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openai_api_key: openaiKey.trim() || undefined,
          gemini_api_key: geminiKey.trim() || undefined,
          anthropic_api_key: anthropicKey.trim() || undefined,
          groq_api_key: groqKey.trim() || undefined,
          default_llm_provider: provider,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setSaveStatus('success');
        // Clear input values
        setOpenaiKey('');
        setGeminiKey('');
        setAnthropicKey('');
        setGroqKey('');
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setLoading(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '680px', animation: 'fadeIn 0.4s ease' }}>
      <div>
        <h1>System Settings</h1>
        <p>Configure model API credentials, toggle between offline heuristic solvers and cloud LLMs.</p>
      </div>

      <form onSubmit={handleSave} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
          <Key size={18} style={{ color: 'var(--accent-violet)' }} />
          <span>LLM Provider Credentials</span>
        </h3>



        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div className="flex-between" style={{ marginBottom: '6px' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Gemini API Key</label>
              {config?.has_gemini_key && <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>✓ Key Configured</span>}
            </div>
            <input
              type="password"
              className="input-field"
              placeholder={config?.has_gemini_key ? "••••••••••••••••••••••••" : "Enter GEMINI_API_KEY"}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>

          <div>
            <div className="flex-between" style={{ marginBottom: '6px' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Groq API Key</label>
              {config?.has_groq_key && <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>✓ Key Configured</span>}
            </div>
            <input
              type="password"
              className="input-field"
              placeholder={config?.has_groq_key ? "••••••••••••••••••••••••" : "Enter GROQ_API_KEY"}
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
            />
          </div>

          <div>
            <div className="flex-between" style={{ marginBottom: '6px' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>OpenAI API Key</label>
              {config?.has_openai_key && <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>✓ Key Configured</span>}
            </div>
            <input
              type="password"
              className="input-field"
              placeholder={config?.has_openai_key ? "••••••••••••••••••••••••" : "Enter OPENAI_API_KEY"}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
          </div>

          <div>
            <div className="flex-between" style={{ marginBottom: '6px' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Anthropic API Key</label>
              {config?.has_anthropic_key && <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>✓ Key Configured</span>}
            </div>
            <input
              type="password"
              className="input-field"
              placeholder={config?.has_anthropic_key ? "••••••••••••••••••••••••" : "Enter ANTHROPIC_API_KEY"}
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
            />
          </div>
        </div>

        <h3 style={{ display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', marginTop: '10px' }}>
          <Sparkles size={18} style={{ color: 'var(--accent-cyan)' }} />
          <span>Execution Engine</span>
        </h3>

        <div>
          <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Default Generator Provider</label>
          <select
            className="input-field"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="groq" disabled={config ? !config.has_groq_key && !groqKey : false}>Groq API (llama-3.3-70b-versatile)</option>
            <option value="gemini" disabled={config ? !config.has_gemini_key && !geminiKey : false}>Gemini API (gemini-2.5-flash)</option>
            <option value="openai" disabled={config ? !config.has_openai_key && !openaiKey : false}>OpenAI API (gpt-4o-mini)</option>
          </select>
        </div>

        <div className="flex-between" style={{ marginTop: '10px' }}>
          <span>
            {saveStatus === 'success' && <span style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 600 }}>✓ Settings Saved Successfully!</span>}
            {saveStatus === 'error' && <span style={{ color: 'var(--accent-rose)', fontSize: '0.9rem', fontWeight: 600 }}>✗ Failed to save settings.</span>}
          </span>
          <button type="submit" className="btn" disabled={loading}>
            <Save size={16} />
            <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
export default SettingsTab;
