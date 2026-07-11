import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface EvalTestCase {
  id: string;
  question: string;
  expected_output: string;
  vanilla_output?: string;
  vanilla_score?: number;
  vanilla_latency?: number;
  advanced_output?: string;
  advanced_score?: number;
  advanced_latency?: number;
}

export interface EvalReport {
  run_id: string;
  timestamp: string;
  llm_provider: string;
  vanilla_avg_score: number;
  vanilla_avg_latency: number;
  advanced_avg_score: number;
  advanced_avg_latency: number;
  test_cases: EvalTestCase[];
}

interface EvalState {
  history: EvalReport[];
  activeRun: EvalReport | null;
  loading: boolean;
  error: string | null;
}

const initialState: EvalState = {
  history: [],
  activeRun: null,
  loading: false,
  error: null,
};

const API_URL = 'http://localhost:8000/api';

export const runEvaluation = createAsyncThunk(
  'eval/run',
  async (
    { datasetPath, llmProvider }: { datasetPath?: string; llmProvider?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`${API_URL}/evaluations/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_path: datasetPath || 'artifacts/questions.csv',
          llm_provider: llmProvider === 'offline' ? undefined : llmProvider,
        }),
      });
      if (!response.ok) {
        throw new Error('Evaluation run failed');
      }
      return await response.json();
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchEvalHistory = createAsyncThunk(
  'eval/fetchHistory',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_URL}/evaluations/history`);
      if (!response.ok) {
        throw new Error('Failed to fetch evaluation history');
      }
      return await response.json();
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

const evalSlice = createSlice({
  name: 'eval',
  initialState,
  reducers: {
    setActiveRun: (state, action) => {
      state.activeRun = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(runEvaluation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(runEvaluation.fulfilled, (state, action) => {
        state.loading = false;
        state.activeRun = action.payload;
        state.history.unshift(action.payload); // prepend to history
      })
      .addCase(runEvaluation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchEvalHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEvalHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.history = action.payload;
        if (action.payload.length > 0 && !state.activeRun) {
          state.activeRun = action.payload[0];
        }
      })
      .addCase(fetchEvalHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setActiveRun } = evalSlice.actions;
export default evalSlice.reducer;
