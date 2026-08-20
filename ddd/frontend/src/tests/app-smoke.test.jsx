import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { App } from '../app/App.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';

describe('frontend scaffold smoke', () => {
  it('renders app shell and login route', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [{ path: 'login', element: <LoginPage /> }],
        },
      ],
      { initialEntries: ['/login'] },
    );

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('link', { name: 'JoeKnock' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Login' }),
    ).toBeInTheDocument();
  });
});
