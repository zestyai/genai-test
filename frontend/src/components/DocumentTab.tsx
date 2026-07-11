import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { fetchDocuments, indexDocument } from '../store/documentSlice';
import { Files, Database, CheckCircle2, AlertCircle } from 'lucide-react';

export const DocumentTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, error, activeFolder } = useSelector((state: RootState) => state.documents);

  useEffect(() => {
    dispatch(fetchDocuments(activeFolder));
  }, [dispatch, activeFolder]);

  const handleIndex = (filename: string) => {
    dispatch(indexDocument({ filename, folder: activeFolder }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease' }}>
      <div className="flex-between">
        <div>
          <h1>Document Library</h1>
          <p>Index and manage insurance rule books and rating manuals inside `{activeFolder}`.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => dispatch(fetchDocuments(activeFolder))}>
          Refresh Files
        </button>
      </div>

      {error && (
        <div className="glass-panel" style={{ borderColor: 'var(--accent-rose)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <AlertCircle style={{ color: 'var(--accent-rose)' }} />
          <span>Error loading folder content: {error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {items.map((doc) => (
            <div key={doc.name} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '160px' }}>
              <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
                <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', height: 'fit-content' }}>
                  <Files style={{ color: 'var(--accent-violet)' }} size={24} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h3 style={{ fontSize: '0.95rem', wordBreak: 'break-all', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }} title={doc.name}>
                    {doc.name}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{doc.size_mb} MB</span>
                </div>
              </div>

              <div className="flex-between" style={{ borderTop: '1px solid rgba(139, 92, 246, 0.08)', paddingTop: '12px', marginTop: '12px' }}>
                <span className="flex-between gap-10" style={{ fontSize: '0.85rem' }}>
                  {doc.is_indexed ? (
                    <>
                      <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                      <span style={{ color: '#10b981', fontWeight: 600 }}>Indexed in ChromaDB</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} style={{ color: 'var(--text-muted)' }} />
                      <span>Not indexed</span>
                    </>
                  )}
                </span>
                
                {!doc.is_indexed && (
                  <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={() => handleIndex(doc.name)}>
                    <Database size={12} />
                    <span>Index PDF</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default DocumentTab;
