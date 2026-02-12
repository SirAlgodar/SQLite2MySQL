import { configureStore } from '@reduxjs/toolkit';
import migrationReducer from './slices/migrationSlice';

export const store = configureStore({
  reducer: {
    migration: migrationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


