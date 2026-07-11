import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface SourceSnippet {
  document_name: string;
  page: number;
  text: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  variation?: string;
  llm_provider?: string;
  latency_seconds?: number;
  retrieved_sources?: SourceSnippet[];
  timestamp: string;
}

interface ChatState {
  messages: ChatMessage[];
  activeVariation: 'vanilla' | 'advanced';
  llmProvider: string; // 'offline' or override
  loading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  messages: [],
  activeVariation: 'advanced',
  llmProvider: 'offline',
  loading: false,
  error: null,
};

const API_URL = 'http://localhost:8000/api';

export const sendChatMessage = createAsyncThunk(
  'chat/sendQuery',
  async (
    { question, folder }: { question: string; folder: string },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as { chat: ChatState };
      const response = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          folder,
          variation: state.chat.activeVariation,
          llm_provider: state.chat.llmProvider === 'offline' ? undefined : state.chat.llmProvider,
        }),
      });
      
      if (!response.ok) {
        throw new Error('RAG query failed');
      }
      return await response.json();
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setVariation: (state, action) => {
      state.activeVariation = action.payload;
    },
    setProvider: (state, action) => {
      state.llmProvider = action.payload;
    },
    clearChat: (state) => {
      state.messages = [];
    },
    addLocalUserMessage: (state, action) => {
      state.messages.push({
        id: Math.random().toString(36).substring(7),
        sender: 'user',
        text: action.payload,
        timestamp: new Date().toLocaleTimeString(),
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendChatMessage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        state.loading = false;
        state.messages.push({
          id: Math.random().toString(36).substring(7),
          sender: 'assistant',
          text: action.payload.answer,
          variation: action.payload.variation,
          llm_provider: action.payload.llm_provider,
          latency_seconds: action.payload.latency_seconds,
          retrieved_sources: action.payload.retrieved_sources,
          timestamp: new Date().toLocaleTimeString(),
        });
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.messages.push({
          id: Math.random().toString(36).substring(7),
          sender: 'assistant',
          text: `Error: ${action.payload || 'Failed to generate response'}`,
          timestamp: new Date().toLocaleTimeString(),
        });
      });
  },
});

export const { setVariation, setProvider, clearChat, addLocalUserMessage } = chatSlice.actions;
export default chatSlice.reducer;
