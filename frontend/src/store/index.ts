import { configureStore } from '@reduxjs/toolkit';
import documentReducer from './documentSlice';
import chatReducer from './chatSlice';
import evalReducer from './evalSlice';

export const store = configureStore({
  reducer: {
    documents: documentReducer,
    chat: chatReducer,
    eval: evalReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
