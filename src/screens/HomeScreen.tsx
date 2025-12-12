// src/screens/HomeScreen.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={styles.viewport}>
      <main style={styles.main}>
        <h1 style={styles.logo}>FoodDude</h1>

        <p style={styles.tagline}>
          Track what you eat.<br />
          Own your health.
        </p>

        <p style={styles.subtitle}>326,760+ foods • offline • zero excuses</p>

        <button style={styles.button} onClick={() => navigate('/auth')}>
          <span style={styles.buttonText}>Get Started</span>
        </button>
      </main>

      <footer style={styles.footer}>
        No ads. No tracking. Just results.
      </footer>
    </div>
  );
};

const styles = {
  viewport: {
    height: "100dvh",
    width: "100vw",
    backgroundColor: "#fff",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between" as const,
    alignItems: "center",
    overflow: "hidden", 
    padding: "20px 0",  
    boxSizing: "border-box" as const,
  },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center" as const,
    padding: "0 20px",
    maxWidth: 400,
  },

  logo: {
    fontSize: 44,
    fontWeight: 900 as const,
    color: "#C19A00",
    marginBottom: 12,
  },

  tagline: {
    fontSize: 26,
    fontWeight: 700 as const,
    color: "#333",
    lineHeight: "32px",
    marginBottom: 14,
  },

  subtitle: {
    fontSize: 16,
    color: "#777",
    marginBottom: 36,
  },

  button: {
    backgroundColor: "#C19A00",
    padding: "14px 50px",
    borderRadius: 28,
    border: "none",
    cursor: "pointer",
  },

  buttonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold" as const,
  },

  footer: {
    paddingBottom: 12,
    fontSize: 14,
    fontWeight: 600 as const,
    color: "#999",
  },
} as const;

export default HomeScreen;
