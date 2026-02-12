import React, { useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { setMigrationId, updateMigrationStatus } from '../store/slices/migrationSlice';
import axios, { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { Database, Server, User, Lock, Globe, Play, Download, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

// Interfaces for strict typing
interface ConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface MigrationOptions {
  include_data: boolean;
  resolve_duplicates: boolean;
  duplicate_strategy: string;
}

type ValidationErrors = Partial<Record<keyof ConnectionConfig, string>>;

const MigrationForm: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { fileId, status } = useSelector((state: RootState) => state.migration);
  
  const [config, setConfig] = useState<ConnectionConfig>({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: '',
  });

  const [options, setOptions] = useState<MigrationOptions>({
    include_data: true,
    resolve_duplicates: true,
    duplicate_strategy: 'remove',
  });

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Validation logic
  const validateForm = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    if (!config.host.trim()) {
      newErrors.host = t('validation.host_required');
      isValid = false;
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      newErrors.port = t('validation.port_invalid');
      isValid = false;
    }

    if (!config.user.trim()) {
      newErrors.user = t('validation.user_required');
      isValid = false;
    }

    if (!config.database.trim()) {
      newErrors.database = t('validation.database_required');
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [config, t]);

  const handleConfigChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ 
      ...prev, 
      [name]: name === 'port' ? parseInt(value) || 0 : value 
    }));
    // Clear error for this field when modified
    if (errors[name as keyof ValidationErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleOptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked, name } = e.target;
    if (name === 'include_data' || name === 'resolve_duplicates') {
       setOptions(prev => ({ ...prev, [name]: checked }));
    }
  }, []);

  const testConnection = useCallback(async () => {
    if (!validateForm()) return;

    setTestingConnection(true);
    setConnectionStatus('idle');
    setConnectionMessage('');
    
    try {
      const response = await axios.post('http://localhost:8000/test-connection', config);
      if (response.data.status === 'success') {
        setConnectionStatus('success');
        setConnectionMessage(t('migration.connection_success'));
      } else {
        setConnectionStatus('error');
        setConnectionMessage(response.data.message);
      }
    } catch (err: unknown) {
      setConnectionStatus('error');
      if (axios.isAxiosError(err)) {
         setConnectionMessage(err.response?.data?.message || err.message || t('common.error'));
      } else {
         setConnectionMessage(String(err));
      }
    } finally {
      setTestingConnection(false);
    }
  }, [config, validateForm, t]);
  
  const pollStatus = useCallback((migrationId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/status/${migrationId}`);
        dispatch(updateMigrationStatus(response.data));
        
        if (response.data.status === 'completed' || response.data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(interval);
      }
    }, 2000);
  }, [dispatch]);

  const startMigration = useCallback(async () => {
    if (!fileId) return;
    if (!validateForm()) return;

    try {
      const response = await axios.post('/api/migrate', {
        sqlite_file_id: fileId,
        connection: config,
        ...options,
      });
      dispatch(setMigrationId(response.data.migration_id));
      pollStatus(response.data.migration_id);
    } catch (err: unknown) {
      console.error('Migration error:', err);
      setConnectionStatus('error');
      if (axios.isAxiosError(err)) {
        setConnectionMessage(err.response?.data?.detail || t('migration.start_failed'));
      } else {
        setConnectionMessage(t('migration.start_failed'));
      }
    }
  }, [fileId, config, options, validateForm, dispatch, pollStatus, t]);

  const exportSQL = useCallback(async () => {
    if (!fileId) return;
    try {
      const response = await axios.get(`http://localhost:8000/export-sql/${fileId}?include_data=${options.include_data}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `migration_${new Date().getTime()}.sql`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  }, [fileId, options.include_data]);

  const isMigrating = useMemo(() => status === 'migrating', [status]);

  // Input wrapper for consistent styling and error handling
  const InputField = useCallback(({ 
    label, 
    name, 
    type = 'text', 
    value, 
    placeholder, 
    icon: Icon 
  }: { 
    label: string, 
    name: keyof ConnectionConfig, 
    type?: string, 
    value: string | number, 
    placeholder: string, 
    icon: any 
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${errors[name] ? 'text-red-400' : 'text-gray-400'}`} />
        <input
          type={type}
          name={name}
          value={value}
          onChange={handleConfigChange}
          className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 outline-none transition-all ${
            errors[name] 
              ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50' 
              : 'border-gray-200 focus:ring-blue-500 focus:border-transparent'
          }`}
          placeholder={placeholder}
        />
      </div>
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  ), [config, errors, handleConfigChange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Connection Config */}
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Database className="text-blue-600" />
          {t('migration.target_config')}
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <InputField 
                label={t('migration.host')} 
                name="host" 
                value={config.host} 
                placeholder="localhost" 
                icon={Globe} 
              />
            </div>
            <div>
              <InputField 
                label={t('migration.port')} 
                name="port" 
                type="number" 
                value={config.port} 
                placeholder="3306" 
                icon={Server} 
              />
            </div>
          </div>

          <InputField 
            label={t('migration.user')} 
            name="user" 
            value={config.user} 
            placeholder="root" 
            icon={User} 
          />

          <InputField 
            label={t('migration.password')} 
            name="password" 
            type="password" 
            value={config.password} 
            placeholder="••••••••" 
            icon={Lock} 
          />

          <InputField 
            label={t('migration.database')} 
            name="database" 
            value={config.database} 
            placeholder="my_database" 
            icon={Server} 
          />

          <button
            onClick={testConnection}
            disabled={testingConnection || isMigrating}
            className={`w-full py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              connectionStatus === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200'
                : connectionStatus === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            {testingConnection ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {t('migration.test_connection')}
          </button>
          
          {connectionMessage && (
            <motion.p 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-xs mt-1 flex items-center gap-1 ${
                connectionStatus === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              {connectionMessage}
            </motion.p>
          )}
        </div>
      </div>

      {/* Migration Options & Actions */}
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Play className="text-blue-600" />
          {t('migration.options_title')}
        </h3>

        <div className="space-y-6 flex-1">
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  name="include_data"
                  checked={options.include_data}
                  onChange={handleOptionChange}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${options.include_data ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${options.include_data ? 'translate-x-4' : ''}`}></div>
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                {t('migration.include_data')}
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  name="resolve_duplicates"
                  checked={options.resolve_duplicates}
                  onChange={handleOptionChange}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${options.resolve_duplicates ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${options.resolve_duplicates ? 'translate-x-4' : ''}`}></div>
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                {t('migration.resolve_duplicates')}
              </span>
            </label>
          </div>

          <div className="pt-6 border-t border-gray-100 space-y-4">
            <button
              onClick={startMigration}
              disabled={isMigrating || !config.database}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-3"
            >
              {isMigrating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              {t('migration.start_button')}
            </button>

            <button
              onClick={exportSQL}
              disabled={isMigrating}
              className="w-full py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-3"
            >
              <Download className="w-5 h-5" />
              {t('migration.export_button')}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6 italic">
          {t('migration.disclaimer')}
        </p>
      </div>
    </div>
  );
};

export default MigrationForm;
