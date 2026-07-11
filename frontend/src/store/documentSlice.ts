import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface Document {
  name: string;
  size_mb: number;
  is_indexed: boolean;
  folder: string;
}

interface DocumentState {
  items: Document[];
  loading: boolean;
  error: string | null;
  activeFolder: string;
}

const initialState: DocumentState = {
  items: [],
  loading: false,
  error: null,
  activeFolder: 'artifacts/1',
};

// API Base URL (FastAPI)
const API_URL = 'http://localhost:8000/api';

export const fetchDocuments = createAsyncThunk(
  'documents/fetch',
  async (folder: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_URL}/documents?folder=${encodeURIComponent(folder)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      return await response.json();
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const indexDocument = createAsyncThunk(
  'documents/index',
  async ({ filename, folder }: { filename: string; folder: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${API_URL}/documents/index?filename=${encodeURIComponent(filename)}&folder=${encodeURIComponent(folder)}`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error('Failed to index document');
      }
      return { filename, success: true };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

const documentSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    setFolder: (state, action) => {
      state.activeFolder = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDocuments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(indexDocument.fulfilled, (state, action) => {
        const doc = state.items.find((d) => d.name === action.payload.filename);
        if (doc) {
          doc.is_indexed = true;
        }
      });
  },
});

export const { setFolder } = documentSlice.actions;
export default documentSlice.reducer;
