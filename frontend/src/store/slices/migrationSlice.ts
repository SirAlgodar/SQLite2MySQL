import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface MigrationState {
  fileId: string | null;
  filename: string | null;
  schema: Record<string, any> | null;
  migrationId: string | null;
  status: 'idle' | 'uploading' | 'analyzing' | 'migrating' | 'completed' | 'failed';
  progress: number;
  logs: string[];
}

const initialState: MigrationState = {
  fileId: null,
  filename: null,
  schema: null,
  migrationId: null,
  status: 'idle',
  progress: 0,
  logs: [],
};

export const migrationSlice = createSlice({
  name: 'migration',
  initialState,
  reducers: {
    setUploadSuccess: (state, action: PayloadAction<{ fileId: string; filename: string }>) => {
      state.fileId = action.payload.fileId;
      state.filename = action.payload.filename;
      state.status = 'analyzing';
    },
    setSchema: (state, action: PayloadAction<Record<string, any>>) => {
      state.schema = action.payload;
      state.status = 'idle';
    },
    setMigrationId: (state, action: PayloadAction<string>) => {
      state.migrationId = action.payload;
      state.status = 'migrating';
      state.logs = ['Iniciando migração...'];
    },
    updateMigrationStatus: (state, action: PayloadAction<{ status: string; progress: number; logs: string[] }>) => {
      state.status = action.payload.status as any;
      state.progress = action.payload.progress;
      state.logs = action.payload.logs;
    },
    reset: (state) => {
      return initialState;
    },
  },
});

export const { setUploadSuccess, setSchema, setMigrationId, updateMigrationStatus, reset } = migrationSlice.actions;
export default migrationSlice.reducer;
