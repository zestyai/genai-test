import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { runEvaluation, fetchEvalHistory, setActiveRun } from '../store/evalSlice';
import type { EvalTestCase } from '../store/evalSlice';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Play, BarChart3, Clock, AlertCircle, Eye } from 'lucide-react';

export const EvalTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { history, activeRun, loading, error } = useSelector((state: RootState) => state.eval);
  const { llmProvider } = useSelector((state: RootState) => state.chat);
  
  const [selectedCase, setSelectedCase] = useState<EvalTestCase | null>(null);

  useEffect(() => {
    dispatch(fetchEvalHistory());
  }, [dispatch]);

  const handleRunEval = () => {
    dispatch(runEvaluation({ llmProvider }));
  };

  // Format active run data for the charts
  const getChartData = () => {
    if (!activeRun) return [];
    return [
      {
        name: 'Accuracy (Score)',
        Vanilla: activeRun.vanilla_avg_score * 100,
        Advanced: activeRun.advanced_avg_score * 100,
      },
      {
        name: 'Latency (s x 10)',
        Vanilla: activeRun.vanilla_avg_latency * 10,
        Advanced: activeRun.advanced_avg_latency * 10,
      }
    ];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease' }}>
      
      {/* Header */}
      <div className="flex-between">
        <div>
          <h1>RAG Experimentation Harness</h1>
          <p>Evaluate multiple RAG pipeline configurations against `questions.csv` ground truths.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {history.length > 0 && (
            <select
              className="input-field"
              style={{ width: '220px', padding: '10px 16px', borderRadius: '10px' }}
              value={activeRun?.run_id || ''}
              onChange={(e) => {
                const run = history.find((h) => h.run_id === e.target.value);
                if (run) dispatch(setActiveRun(run));
              }}
            >
              {history.map((run) => (
                <option key={run.run_id} value={run.run_id}>
                  Run: {new Date(run.timestamp).toLocaleString()} ({run.llm_provider})
                </option>
              ))}
            </select>
          )}
          <button className="btn" onClick={handleRunEval} disabled={loading}>
            <Play size={16} fill="currentColor" />
            <span>{loading ? 'Running Eval...' : 'Run Experiment'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel" style={{ borderColor: 'var(--accent-rose)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <AlertCircle style={{ color: 'var(--accent-rose)' }} />
          <span>Error running evaluation harness: {error}</span>
        </div>
      )}

      {loading && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '16px' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
          <h3>Running Batch RAG Experimentation Harness...</h3>
          <p style={{ maxWidth: '400px', textAlign: 'center', fontSize: '0.9rem' }}>
            We are executing all test cases across both Vanilla and Advanced RAG variations. Retrieving data from ChromaDB and scoring answers. Please wait.
          </p>
        </div>
      )}

      {!loading && activeRun && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
          
          {/* Left: Summary Metrics Cards & Comparison Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Metric Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ background: 'rgba(6, 182, 212, 0.08)', padding: '14px', borderRadius: '12px' }}>
                  <BarChart3 style={{ color: 'var(--accent-cyan)' }} size={28} />
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Average Accuracy (ROUGE)</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>{(activeRun.advanced_avg_score * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: '0.85rem', color: '#10b981' }}>vs {(activeRun.vanilla_avg_score * 100).toFixed(0)}% vanilla</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ background: 'rgba(139, 92, 246, 0.08)', padding: '14px', borderRadius: '12px' }}>
                  <Clock style={{ color: 'var(--accent-violet)' }} size={28} />
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Average Latency</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>{activeRun.advanced_avg_latency.toFixed(3)}s</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--accent-rose)' }}>vs {activeRun.vanilla_avg_latency.toFixed(3)}s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Cases Table */}
            <div className="glass-panel" style={{ padding: '20px 0 0 0', overflow: 'hidden' }}>
              <h3 style={{ padding: '0 20px 14px 20px', borderBottom: '1px solid var(--border-glass)' }}>Test Case Comparison</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(10, 8, 16, 0.4)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '12px 20px' }}>ID</th>
                      <th style={{ padding: '12px 20px' }}>Question</th>
                      <th style={{ padding: '12px 20px', textAlign: 'center' }}>Vanilla Score</th>
                      <th style={{ padding: '12px 20px', textAlign: 'center' }}>Advanced Score</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRun.test_cases.map((tc) => (
                      <tr key={tc.id} style={{ borderBottom: '1px solid rgba(139, 92, 246, 0.05)', transition: 'background 0.2s' }} className="table-row-hover">
                        <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{tc.id}</td>
                        <td style={{ padding: '14px 20px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tc.question}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', color: tc.vanilla_score && tc.vanilla_score >= 0.8 ? '#10b981' : 'var(--text-muted)' }}>
                          {tc.vanilla_score !== undefined ? `${(tc.vanilla_score * 100).toFixed(0)}%` : '-'}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', color: tc.advanced_score && tc.advanced_score >= 0.8 ? '#10b981' : 'var(--accent-rose)', fontWeight: 600 }}>
                          {tc.advanced_score !== undefined ? `${(tc.advanced_score * 100).toFixed(0)}%` : '-'}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex' }} onClick={() => setSelectedCase(tc)}>
                            <Eye size={12} style={{ marginRight: '4px' }} />
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right: Gorgeous Charts Visualizer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel" style={{ height: '360px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '20px' }}>Variation Performance Chart</h3>
              <div style={{ flexGrow: 1, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={getChartData()}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.08)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#0e0c15', borderColor: 'var(--border-glass-bright)', color: '#fff' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="Vanilla" fill="rgba(6, 182, 212, 0.65)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Advanced" fill="rgba(139, 92, 246, 0.65)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="glass-panel">
              <h3>Harness Configuration</h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', fontSize: '0.85rem' }}>
                <li className="flex-between">
                  <span style={{ color: 'var(--text-muted)' }}>LLM Engine:</span>
                  <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{activeRun.llm_provider}</span>
                </li>
                <li className="flex-between">
                  <span style={{ color: 'var(--text-muted)' }}>ChromaDB Chunk 1 (Vanilla):</span>
                  <span>300 tokens</span>
                </li>
                <li className="flex-between">
                  <span style={{ color: 'var(--text-muted)' }}>ChromaDB Chunk 2 (Advanced):</span>
                  <span>800 tokens</span>
                </li>
                <li className="flex-between">
                  <span style={{ color: 'var(--text-muted)' }}>Evaluator Scorer:</span>
                  <span>Sequential text + rule matches</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      )}

      {/* Selected case details inspector modal */}
      {selectedCase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
          <div className="glass-panel" style={{ width: '900px', maxHeight: '90vh', overflowY: 'auto', background: 'rgba(12, 10, 20, 0.95)', border: '1px solid var(--border-glass-bright)' }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px', marginBottom: '20px' }}>
              <h2 style={{ color: 'var(--accent-cyan)' }}>Case Inspector: {selectedCase.id}</h2>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setSelectedCase(null)}>Close</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '6px' }}>Question</h4>
                <div style={{ background: 'rgba(10, 8, 16, 0.4)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  {selectedCase.question}
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '6px' }}>Expected Ground Truth Output</h4>
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)', color: '#10b981', whiteSpace: 'pre-wrap' }}>
                  {selectedCase.expected_output}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h4 className="flex-between" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '6px' }}>
                    <span>Vanilla RAG Output</span>
                    <span style={{ color: selectedCase.vanilla_score && selectedCase.vanilla_score >= 0.8 ? '#10b981' : 'var(--text-muted)' }}>Score: {(selectedCase.vanilla_score || 0)*100}%</span>
                  </h4>
                  <div style={{ background: 'rgba(10, 8, 16, 0.4)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', minHeight: '160px', overflowY: 'auto', maxHeight: '300px', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                    {selectedCase.vanilla_output}
                  </div>
                </div>

                <div>
                  <h4 className="flex-between" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '6px' }}>
                    <span>Advanced RAG Output</span>
                    <span style={{ color: selectedCase.advanced_score && selectedCase.advanced_score >= 0.8 ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>Score: {(selectedCase.advanced_score || 0)*100}%</span>
                  </h4>
                  <div style={{ background: 'rgba(139, 92, 246, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', minHeight: '160px', overflowY: 'auto', maxHeight: '300px', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                    {selectedCase.advanced_output}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default EvalTab;
