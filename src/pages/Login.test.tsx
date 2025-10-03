import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';

// Mock the useAuth hook
const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    logout: vi.fn(),
    isLoggedIn: false,
    userRoles: null,
  }),
}));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderLoginComponent = () => {
    return render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
  };

  test('renders login form correctly', () => {
    renderLoginComponent();

    expect(screen.getByRole('heading', { name: /aida login/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('handles email and password input changes', () => {
    renderLoginComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  test('shows loading state and redirects on successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined); // Simulate successful login

    renderLoginComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);

    expect(loginButton).toHaveTextContent(/logging in.../i);
    expect(loginButton).toBeDisabled();

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', false);
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    expect(loginButton).toHaveTextContent(/login/i);
    expect(loginButton).not.toBeDisabled();
  });

  test('shows error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials')); // Simulate failed login

    renderLoginComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(loginButton);

    expect(loginButton).toHaveTextContent(/logging in.../i);
    expect(loginButton).toBeDisabled();

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'wrongpassword', false);
      expect(
        screen.getByText(/failed to login. please check your credentials./i)
      ).toBeInTheDocument();
    });

    expect(loginButton).toHaveTextContent(/login/i);
    expect(loginButton).not.toBeDisabled();
    expect(mockNavigate).not.toHaveBeenCalled(); // Should not navigate on error
  });
});
