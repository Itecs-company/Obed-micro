import { useEffect, useState } from 'react';
import {
  Box,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import api from '../api';

const LogViewer = () => {
  const [logs, setLogs] = useState([]);

  const loadLogs = async () => {
    try {
      const { data } = await api.get('/logs');
      setLogs(data.entries);
    } catch (error) {
      console.error('Не удалось получить логи', error);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <Box p={2} width={360} role="presentation">
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="h6">Логи</Typography>
        <IconButton onClick={loadLogs} size="small">
          <Refresh fontSize="small" />
        </IconButton>
      </Box>
      <Divider />
      <List dense sx={{ maxHeight: 480, overflowY: 'auto' }}>
        {logs.map((log, idx) => (
          <ListItem key={`${log.timestamp}-${idx}`} alignItems="flex-start">
            <ListItemText
              primary={`${new Date(log.timestamp).toLocaleString()} • ${log.level}`}
              secondary={log.message}
            />
          </ListItem>
        ))}
        {logs.length === 0 && (
          <Typography variant="body2" color="text.secondary" mt={2}>
            Логи отсутствуют
          </Typography>
        )}
      </List>
    </Box>
  );
};

export default LogViewer;
