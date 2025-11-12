import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import api from '../api';

const LoginForm = ({ onSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', data.access_token);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
      <Paper elevation={8} sx={{ p: 4, width: 360 }}>
        <Typography variant="h5" mb={2} fontWeight="bold">
          Вход в систему
        </Typography>
        <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2}>
          <TextField
            label="Логин"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label="Пароль"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
          <Button type="submit" variant="contained" size="large" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginForm;
