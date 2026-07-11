import React from 'react';
import { MessageSquare, Files, BarChart3, Settings, Sparkles } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mongodbConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, mongodbConnected }) => {
  return (
    <aside className="sidebar">
      <div className="logo-section">
        <div className="logo-icon">
          <Sparkles size={14} fill="currentColor" />
        </div>
        <span className="logo-text">RAG Sandbox</span>
      </div>

      <ul className="nav-links">
        <li
          className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare className="nav-icon" />
          <span>Chat & Query</span>
        </li>
        <li
          className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          <Files className="nav-icon" />
          <span>Document Library</span>
        </li>
        <li
          className={`nav-item ${activeTab === 'evaluations' ? 'active' : ''}`}
          onClick={() => setActiveTab('evaluations')}
        >
          <BarChart3 className="nav-icon" />
          <span>Experiment Harness</span>
        </li>
        <li
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings className="nav-icon" />
          <span>System Settings</span>
        </li>
      </ul>

      <div className="sidebar-footer">
        <div className="flex-between" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Sync Status:</span>
          <span className="flex-between gap-10">
            <span className={`status-dot ${mongodbConnected ? 'active' : 'inactive'}`} />
            <span>{mongodbConnected ? 'Connected' : 'Offline'}</span>
          </span>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
