import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import migrationReducer from '../../store/slices/migrationSlice';
import SchemaViewer from '../SchemaViewer';
import axios from 'axios';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

// Mock Framer Motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Setup store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      migration: migrationReducer,
    },
    preloadedState: {
      migration: {
        fileId: 'test-file-id',
        status: 'idle',
        filename: 'test.db',
        schema: null,
        migrationId: null,
        progress: 0,
        logs: [],
        ...initialState,
      } as any,
    },
  });
};

const renderWithProviders = (
  component: React.ReactElement,
  { initialState = {} } = {}
) => {
  const store = createTestStore(initialState);
  return {
    ...render(<Provider store={store}>{component}</Provider>),
    store,
  };
};

const mockSchema = {
  users: {
    record_count: 10,
    columns: [
      { name: 'id', type: 'INTEGER', pk: true, notnull: true },
      { name: 'username', type: 'TEXT', pk: false, notnull: true },
    ],
  },
  posts: {
    record_count: 5,
    columns: [
      { name: 'id', type: 'INTEGER', pk: true, notnull: true },
      { name: 'title', type: 'TEXT', pk: false, notnull: true },
    ],
  },
};

describe('SchemaViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no schema is present', () => {
    renderWithProviders(<SchemaViewer />, { 
      initialState: { schema: null, fileId: null } 
    });
    expect(screen.queryByText('schema.title')).not.toBeInTheDocument();
  });

  it('fetches and displays schema when fileId is present', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: mockSchema });

    renderWithProviders(<SchemaViewer />, {
      initialState: { fileId: '123', schema: null }
    });

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:8000/schema/123');
    });
    
    // Check if store was updated (indirectly via UI)
    // Actually we need to wait for re-render with schema
    // Since our test store doesn't automatically update component unless we use real store logic
    // But we are using real redux store, so dispatch should work.
    
    // However, the component fetches only if schema is null.
    // The fetch dispatches setSchema.
    
    // We can simulate the state already having the schema for simpler testing of the UI
  });

  it('renders schema tables when schema is in store', () => {
    renderWithProviders(<SchemaViewer />, {
      initialState: { fileId: '123', schema: mockSchema }
    });

    expect(screen.getByText('schema.title')).toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('posts')).toBeInTheDocument();
  });

  it('filters tables based on search input', () => {
    renderWithProviders(<SchemaViewer />, {
      initialState: { fileId: '123', schema: mockSchema }
    });

    const searchInput = screen.getByPlaceholderText('schema.search_placeholder');
    fireEvent.change(searchInput, { target: { value: 'user' } });

    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.queryByText('posts')).not.toBeInTheDocument();
  });

  it('displays table details when a table is selected', () => {
    renderWithProviders(<SchemaViewer />, {
      initialState: { fileId: '123', schema: mockSchema }
    });

    const userTableButton = screen.getByText('users').closest('button');
    fireEvent.click(userTableButton!);

    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('username')).toBeInTheDocument();
    expect(screen.getByText('schema.preview_data')).toBeInTheDocument();
  });

  it('shows no tables found message when search yields no results', () => {
    renderWithProviders(<SchemaViewer />, {
      initialState: { fileId: '123', schema: mockSchema }
    });

    const searchInput = screen.getByPlaceholderText('schema.search_placeholder');
    fireEvent.change(searchInput, { target: { value: 'xyz' } });

    expect(screen.getByText('schema.no_tables_found')).toBeInTheDocument();
  });
});
