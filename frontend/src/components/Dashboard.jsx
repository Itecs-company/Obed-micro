import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Add,
  CloudDownload,
  CloudUpload,
  DarkMode,
  Delete,
  Edit,
  LightMode,
  Logout,
  MenuBook,
  PriceChange,
  Refresh,
  TableView
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import api from '../api';
import LogViewer from './LogViewer';

const createDefaultEmployee = () => ({
  full_name: '',
  status: true,
  date: dayjs(),
  note: ''
});

const Dashboard = ({ onLogout, themeMode, onToggleTheme }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState(150);
  const [editedPrice, setEditedPrice] = useState('150');
  const [totals, setTotals] = useState({ total_participants: 0, total_cost: 0 });
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState(createDefaultEmployee());
  const [importing, setImporting] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [logsOpen, setLogsOpen] = useState(false);

  const fetchEmployees = useCallback(
    async (rangeStart, rangeEnd) => {
      const effectiveStart = rangeStart === undefined ? startDate : rangeStart;
      const effectiveEnd = rangeEnd === undefined ? endDate : rangeEnd;
      setLoading(true);
      try {
        const params = {};
        if (effectiveStart) params.start_date = effectiveStart.format('YYYY-MM-DD');
        if (effectiveEnd) params.end_date = effectiveEnd.format('YYYY-MM-DD');
        const { data } = await api.get('/employees', { params });
        setEmployees(
          data.employees.map((item) => ({
            ...item,
            id: item.id,
            date: dayjs(item.date).format('YYYY-MM-DD')
          }))
        );
        setTotals({ total_participants: data.total_participants, total_cost: data.total_cost });
        setPrice(data.lunch_price);
        setEditedPrice(String(data.lunch_price));
      } catch (error) {
        console.error('Ошибка загрузки сотрудников', error);
      } finally {
        setLoading(false);
      }
    },
    [endDate, startDate]
  );

  useEffect(() => {
    fetchEmployees(startDate, endDate);
  }, [startDate, endDate, fetchEmployees]);

  const handleAddEmployee = async () => {
    try {
      const payload = {
        full_name: newEmployee.full_name,
        status: newEmployee.status,
        date: newEmployee.date.format('YYYY-MM-DD'),
        note: newEmployee.note
      };
      await api.post('/employees', payload);
      setAddDialogOpen(false);
      setNewEmployee(createDefaultEmployee());
      fetchEmployees(startDate, endDate);
    } catch (error) {
      console.error('Не удалось добавить сотрудника', error);
    }
  };

  const normalizeStatus = (value) => {
    if (typeof value === 'string') {
      return value === 'true' || value === '1';
    }
    return Boolean(value);
  };

  const processRowUpdate = async (newRow, oldRow) => {
    const payload = {};
    if (newRow.full_name !== oldRow.full_name) payload.full_name = newRow.full_name;
    if (newRow.status !== oldRow.status) payload.status = normalizeStatus(newRow.status);
    if (newRow.date !== oldRow.date) payload.date = dayjs(newRow.date).format('YYYY-MM-DD');
    if (newRow.note !== oldRow.note) payload.note = newRow.note;
    if (Object.keys(payload).length) {
      await api.put(`/employees/${newRow.id}`, payload);
      await fetchEmployees(startDate, endDate);
    }
    return newRow;
  };

  const handleProcessRowUpdateError = useCallback((error) => {
    console.error('Ошибка обновления', error);
  }, []);

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Удалить запись?')) return;
    try {
      await api.delete(`/employees/${id}`);
      fetchEmployees(startDate, endDate);
    } catch (error) {
      console.error('Не удалось удалить', error);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post('/employees/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchEmployees(startDate, endDate);
    } catch (error) {
      console.error('Ошибка импорта', error);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const downloadFile = async (endpoint, params, filename) => {
    try {
      const response = await api.get(endpoint, {
        params,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Не удалось скачать файл', error);
    }
  };

  const handleExport = (type, withPrice) => {
    const params = { include_price: withPrice };
    const startLabel = startDate ? startDate.format('YYYY-MM-DD') : 'all';
    const endLabel = endDate ? endDate.format('YYYY-MM-DD') : 'all';
    if (startDate) params.start_date = startDate.format('YYYY-MM-DD');
    if (endDate) params.end_date = endDate.format('YYYY-MM-DD');
    const filename = `employees_${startLabel}_${endLabel}.${type}`;
    downloadFile(`/employees/export/${type}`, params, filename);
  };

  const handlePriceUpdate = async () => {
    const parsed = parseFloat(editedPrice);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    try {
      const { data } = await api.put('/settings', { lunch_price: parsed });
      setPrice(data.lunch_price);
      fetchEmployees();
    } catch (error) {
      console.error('Не удалось обновить стоимость', error);
    }
  };

  const handleCredentialsUpdate = async () => {
    try {
      await api.put('/auth/credentials', credentials);
      setCredentials({ username: '', password: '' });
      alert('Данные обновлены. Перезайдите с новыми учетными данными.');
      onLogout();
    } catch (error) {
      console.error('Ошибка обновления учетных данных', error);
    }
  };

  const columns = useMemo(
    () => [
      { field: 'id', headerName: '№', width: 70 },
      { field: 'full_name', headerName: 'Ф.И.О', flex: 1, editable: true },
      {
        field: 'status',
        headerName: 'Статус',
        width: 200,
        type: 'singleSelect',
        valueOptions: [
          { value: true, label: 'Участвует в обеде' },
          { value: false, label: 'Не участвует' }
        ],
        editable: true,
        valueFormatter: ({ value }) => (value ? 'Участвует' : 'Не участвует')
      },
      {
        field: 'date',
        headerName: 'Дата',
        width: 160,
        editable: true
      },
      { field: 'note', headerName: 'Примечание', flex: 1, editable: true },
      {
        field: 'actions',
        headerName: '',
        width: 90,
        sortable: false,
        renderCell: ({ id }) => (
          <Tooltip title="Удалить">
            <IconButton size="small" onClick={() => handleDeleteEmployee(id)}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        )
      }
    ],
    []
  );

  useEffect(() => {
    if (startDate && endDate) {
      fetchEmployees(startDate, endDate);
    }
  }, [startDate, endDate, fetchEmployees]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
      <AppBar position="static" color="transparent" elevation={0} sx={{ backdropFilter: 'blur(8px)' }}>
        <Toolbar>
          <MenuBook sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Учет обедов сотрудников
          </Typography>
          <Tooltip title="Переключить тему">
            <IconButton onClick={onToggleTheme} color="inherit">
              {themeMode === 'dark' ? <LightMode /> : <DarkMode />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Логи">
            <IconButton onClick={() => setLogsOpen(true)}>
              <TableView />
            </IconButton>
          </Tooltip>
          <Tooltip title="Выход">
            <IconButton onClick={onLogout} color="inherit">
              <Logout />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box p={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Участников в обеде
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {totals.total_participants}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary" mt={1}>
                  Стоимость за период
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {totals.total_cost.toLocaleString('ru-RU', {
                    style: 'currency',
                    currency: 'RUB'
                  })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                  <Typography variant="subtitle2">Стоимость обеда, руб.</Typography>
                  <TextField
                    size="small"
                    value={editedPrice}
                    onChange={(e) => setEditedPrice(e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₽</InputAdornment>,
                      endAdornment: (
                        <Tooltip title="Обновить стоимость">
                          <IconButton onClick={handlePriceUpdate}>
                            <PriceChange />
                          </IconButton>
                        </Tooltip>
                      )
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Текущая цена: <strong>{price}</strong>
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems="center">
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                  <DatePicker
                    label="Дата начала"
                    value={startDate}
                    onChange={(value) => setStartDate(value)}
                  />
                  <DatePicker
                    label="Дата окончания"
                    value={endDate}
                    onChange={(value) => setEndDate(value)}
                  />
                  <Tooltip title="Обновить">
                    <IconButton onClick={() => fetchEmployees(startDate, endDate)}>
                      <Refresh />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
                  <Button startIcon={<Add />} variant="contained" onClick={() => setAddDialogOpen(true)}>
                    Добавить
                  </Button>
                  <Button component="label" startIcon={<CloudUpload />} variant="outlined" disabled={importing}>
                    Импорт Excel
                    <input type="file" hidden accept=".xlsx,.xls" onChange={handleImport} />
                  </Button>
                  <Button startIcon={<CloudDownload />} variant="outlined" onClick={() => handleExport('excel', true)}>
                    Excel с ценой
                  </Button>
                  <Button startIcon={<CloudDownload />} variant="outlined" onClick={() => handleExport('excel', false)}>
                    Excel без цены
                  </Button>
                  <Button startIcon={<CloudDownload />} variant="outlined" onClick={() => handleExport('pdf', true)}>
                    PDF с ценой
                  </Button>
                  <Button startIcon={<CloudDownload />} variant="outlined" onClick={() => handleExport('pdf', false)}>
                    PDF без цены
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ height: 520 }}>
              <DataGrid
                rows={employees}
                columns={columns}
                disableRowSelectionOnClick
                loading={loading}
                pageSizeOptions={[10, 20, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                processRowUpdate={processRowUpdate}
                onProcessRowUpdateError={handleProcessRowUpdateError}
                editMode="row"
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" mb={2}>
                  Смена учетных данных
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Новый логин"
                    value={credentials.username}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
                  />
                  <TextField
                    label="Новый пароль"
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                  />
                  <Button variant="contained" onClick={handleCredentialsUpdate} startIcon={<Edit />}>
                    Сохранить
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" mb={2}>
                  Интеграция по API и webhook
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Используйте токен авторизации Bearer для запросов.
                </Typography>
                <Box mt={2}>
                  <Typography variant="subtitle2">Пример cURL (webhook)</Typography>
                  <Paper variant="outlined" sx={{ p: 2, mt: 1, fontFamily: 'monospace', fontSize: 12 }}>
{`curl -X POST http://localhost:8000/webhook/employee \
  -H 'Content-Type: application/json' \
  -d '{"secret":"obed-webhook-secret","action":"add","employee":{"full_name":"Иванов Иван","status":true,"date":"2024-04-01"}}'`}
                  </Paper>
                </Box>
                <Box mt={2}>
                  <Typography variant="subtitle2">Пример API</Typography>
                  <Paper variant="outlined" sx={{ p: 2, mt: 1, fontFamily: 'monospace', fontSize: 12 }}>
{`curl -X POST http://localhost:8000/employees \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Иванова Анна","status":false,"date":"2024-04-01"}'`}
                  </Paper>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Добавить сотрудника</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Ф.И.О"
              fullWidth
              value={newEmployee.full_name}
              onChange={(e) => setNewEmployee((prev) => ({ ...prev, full_name: e.target.value }))}
            />
            <DatePicker
              label="Дата"
              value={newEmployee.date}
              onChange={(value) => value && setNewEmployee((prev) => ({ ...prev, date: value }))}
            />
            <FormControl>
              <InputLabel id="status-label">Статус</InputLabel>
              <Select
                labelId="status-label"
                label="Статус"
                value={newEmployee.status}
                onChange={(e) => setNewEmployee((prev) => ({ ...prev, status: e.target.value }))}
              >
                <MenuItem value={true}>Участвует в обеде</MenuItem>
                <MenuItem value={false}>Не участвует</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Примечание"
              fullWidth
              value={newEmployee.note}
              onChange={(e) => setNewEmployee((prev) => ({ ...prev, note: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleAddEmployee} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={logsOpen} onClose={() => setLogsOpen(false)}>
        <LogViewer />
      </Drawer>
    </LocalizationProvider>
  );
};

export default Dashboard;
