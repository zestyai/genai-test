import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatTab from './components/ChatTab';
import DocumentTab from './components/DocumentTab';
import EvalTab from './components/EvalTab';
import SettingsTab from './components/SettingsTab';

interface ConfigState {
  project_name: string;
  is_mongodb_connected: boolean;
  default_llm_provider: string;
  has_openai_key: boolean;
  has_gemini_key: boolean;
  has_anthropic_key: boolean;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [mongodbConnected, setMongodbConnected] = useState<boolean>(false);

  const API_URL = 'http://localhost:8000/api';

  useEffect(() => {
    const fetchDBStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/config`);
        if (response.ok) {
          const data: ConfigState = await response.json();
          setMongodbConnected(data.is_mongodb_connected);
        }
      } catch (err) {
        console.error('Failed to contact backend:', err);
      }
    };

    fetchDBStatus();
    // Poll DB status every 15 seconds
    const interval = setInterval(fetchDBStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatTab />;
      case 'documents':
        return <DocumentTab />;
      case 'evaluations':
        return <EvalTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <ChatTab />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mongodbConnected={mongodbConnected}
      />
      <main className="main-content">
        {renderTabContent()}
      </main>
    </div>
  );
};

export default App;
