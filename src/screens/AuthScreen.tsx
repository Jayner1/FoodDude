// src/screens/AuthScreen.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthScreen: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/food-log', { replace: true });
      } else {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter email and password');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading FoodDude...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>FoodDude</h1>
        <h2 style={styles.title}>
          {isLogin ? 'Welcome back!' : 'Join FoodDude'}
        </h2>

        {error && (
          <div style={styles.error}>
            <p style={styles.errorText}>{error}</p>
          </div>
        )}

        <form onSubmit={handleAuth} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.button,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          style={styles.switch}
        >
          {isLogin
            ? "Don't have an account? Sign up"
            : 'Already have an account? Log in'}
        </button>

        <div style={styles.divider}>
          <div style={styles.line} />
          <span style={styles.or}>OR</span>
          <div style={styles.line} />
        </div>

        <button
          type="button"
          style={styles.google}
          onClick={() => alert('Google login coming soon!')}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  loading: {
    height: '100dvh',
    width: '100vw',
    backgroundColor: '#FFF8DC',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: '5px solid #C19A00',
    borderTopColor: 'transparent',
  },
  loadingText: {
    marginTop: 18,
    fontSize: 18,
    color: '#C19A00',
    fontWeight: 600,
  },

  container: {
    height: '100dvh',
    width: '100vw',
    backgroundColor: '#FFF8DC',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    boxSizing: 'border-box',
  },

  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    padding: 28,
    borderRadius: 24,
    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
    boxSizing: 'border-box',
  },

  logo: {
    fontSize: 40,
    fontWeight: 900,
    color: '#C19A00',
    textAlign: 'center',
    marginBottom: 8,
  },

  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
  },

  input: {
    height: 52,
    borderRadius: 16,
    border: '1px solid #ddd',
    padding: '0 16px',
    fontSize: 16,
    marginBottom: 14,
    outline: 'none',
    backgroundColor: '#f9f9f9',
  },

  button: {
    height: 52,
    borderRadius: 16,
    border: 'none',
    backgroundColor: '#C19A00',
    color: '#fff',
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
    marginBottom: 8,
  },

  switch: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: '#C19A00',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
    marginTop: 4,
    marginBottom: 10,
    textAlign: 'center',
  },

  divider: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 18,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  or: {
    margin: '0 12px',
    color: '#888',
    fontWeight: 600,
    fontSize: 12,
  },

  google: {
    height: 52,
    borderRadius: 16,
    border: 'none',
    backgroundColor: '#4285F4',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },

  error: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    fontSize: 14,
  },
};

export default AuthScreen;
