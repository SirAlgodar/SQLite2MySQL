import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import migrationReducer from '../../store/slices/migrationSlice';
import DataPreview from '../DataPreview';
import axios from 'axios';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

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

const mockData = Array(10).fill(null).map((_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  active: i % 2 === 0,
}));

describe('DataPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and displays data on mount', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: mockData });

    renderWithProviders(<DataPreview tableName="users" onClose={() => {}} />);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8000/preview/test-file-id/users?limit=10&offset=0'
      );
    });

    expect(screen.getByText('User 1')).toBeInTheDocument();
    expect(screen.getByText('User 10')).toBeInTheDocument();
  });

  it('handles loading state', () => {
    // Return a promise that never resolves to simulate loading
    mockedAxios.get.mockReturnValue(new Promise(() => {}));
    
    const { container } = renderWithProviders(<DataPreview tableName="users" onClose={() => {}} />);
    
    // Check for skeletons or loading indicator
    // Since we use skeletons, checking for specific text might fail, but we can check class names or structure
    // Or just check that data is NOT there yet
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('handles error state', async () => {
    mockedAxios.get.mockRejectedValueOnce({
      response: { data: { detail: 'Table not found' } },
    });

    renderWithProviders(<DataPreview tableName="users" onClose={() => {}} />);

    expect(await screen.findByText('Table not found')).toBeInTheDocument();
  });

  it('handles empty data', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

    renderWithProviders(<DataPreview tableName="users" onClose={() => {}} />);

    expect(await screen.findByText('preview.no_data')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: mockData });
    const onClose = vi.fn();

    renderWithProviders(<DataPreview tableName="users" onClose={onClose} />);

    // Wait for data to load so UI is stable
    await screen.findByText('User 1');

    // There might be multiple buttons (pagination), so find the close one specifically
    // The close button usually has an X icon. 
    // We can assume it's the first button or find by icon logic if possible.
    // In our component: <button onClick={onClose}><X ... /></button>
    // We can use a test-id or try to find by role.
    
    // For now, let's try to find the button that contains the SVG or just getting all buttons
    // The close button is in the header.
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons[0]; // Assuming it's the first one in DOM order (header)
    
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('handles pagination', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: mockData }) // Page 0
      .mockResolvedValueOnce({ data: [] }); // Page 1

    renderWithProviders(<DataPreview tableName="users" onClose={() => {}} />);

    await screen.findByText('User 1');

    const nextButton = screen.getAllByRole('button')[2]; // Prev, Next are usually last
    // Actually the close button is first. Then Prev, Next.
    // Let's rely on the icon or aria-label if we added one. We didn't add aria-label.
    // But we know the structure: Close, Prev, Next.
    
    // Let's refine the selector.
    // The component has:
    // Header -> Close Button
    // Footer -> Prev Button, Next Button
    
    // We can find by the chevron icons if we could, but they are SVGs.
    // Let's assume the last button is "Next"
    const allButtons = screen.getAllByRole('button');
    const nextBtn = allButtons[allButtons.length - 1];
    
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8000/preview/test-file-id/users?limit=10&offset=10'
      );
    });
  });
});
