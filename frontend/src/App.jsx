import { useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import Dashboard from './components/Dashboard';
import LoginForm from './components/LoginForm';

dayjs.locale('ru');

const App = () => {
  const [mode, setMode] = useState(localStorage.getItem('theme') || 'light');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === 'dark' ? '#90caf9' : '#1565c0'
          },
          background: {
            default: mode === 'dark' ? '#0f172a' : '#f4f6fb',
            paper: mode === 'dark' ? '#1e293b' : '#ffffff'
          }
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
        },
        shape: {
          borderRadius: 14
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 18
              }
            }
          }
        }
      }),
    [mode]
  );

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isAuthenticated ? (
        <Dashboard onLogout={handleLogout} themeMode={mode} onToggleTheme={toggleTheme} />
      ) : (
        <LoginForm onSuccess={() => setIsAuthenticated(true)} />
      )}
    </ThemeProvider>
  );
};

export default App;
