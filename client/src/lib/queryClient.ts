import { QueryClient, DefaultOptions } from '@tanstack/react-query';

// Default options for all queries
const defaultOptions: DefaultOptions = {
  queries: {
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    retry: 1, // Only retry once
    staleTime: 5 * 60 * 1000, // 5 minutes
  },
};

// Create a new query client instance
export const queryClient = new QueryClient({
  defaultOptions,
});

// Helper function for API requests
export async function apiRequest<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: any
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}