import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { fetchDocuments, indexDocument } from '../store/documentSlice';
import { Files, Database, CheckCircle2, AlertCircle } from 'lucide-react';

export const DocumentTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, error, activeFolder } = useSelector((state: RootState) => state.documents);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchDocuments(activeFolder));
  }, [dispatch, activeFolder]);

  const handleIndex = (filename: string) => {
    dispatch(indexDocument({ filename, folder: activeFolder }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported.');
      return;
    }
    
    setUploading(true);
    setUploadError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`http://localhost:8000/api/documents/upload?folder=${activeFolder}`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        dispatch(fetchDocuments(activeFolder));
      } else {
        const data = await response.json();
        setUploadError(data.detail || 'Failed to upload document.');
      }
    } catch (err) {
      setUploadError('Network error uploading document.');
    } finally {
      setUploading(false);
    }
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

      {/* Upload area */}
      <div className="glass-panel" style={{ borderStyle: 'dashed', borderWidth: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
        <input 
          type="file" 
          accept=".pdf" 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
          onChange={handleFileUpload}
          disabled={uploading}
        />
        <Files style={{ color: 'var(--text-muted)', marginBottom: '8px' }} size={28} />
        {uploading ? (
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Uploading your PDF manual...</span>
        ) : (
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Drag & drop or click to upload PDF</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upload insurance rate pages or rules manually (max 20MB)</span>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="glass-panel" style={{ borderColor: 'var(--accent-rose)', display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px' }}>
          <AlertCircle style={{ color: 'var(--accent-rose)' }} size={16} />
          <span style={{ fontSize: '0.85rem', color: 'var(--accent-rose)' }}>{uploadError}</span>
        </div>
      )}

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
