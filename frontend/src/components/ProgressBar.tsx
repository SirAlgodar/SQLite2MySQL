import React, { useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Loader2, Terminal } from 'lucide-react';

const ProgressBar: React.FC = () => {
  const { t } = useTranslation();
  const { progress, status, logs } = useSelector((state: RootState) => state.migration);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (status === 'idle' || status === 'uploading' || status === 'analyzing') return null;

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          {status === 'migrating' ? (
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          ) : status === 'completed' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          {t(`status.${status}`)}
        </h3>
        <span className="text-2xl font-black text-blue-600">{progress}%</span>
      </div>

      <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={`h-full transition-all duration-500 ${
            status === 'completed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-blue-600'
          }`}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
          <Terminal className="w-4 h-4" />
          {t('status.logs')}
        </div>
        <div className="bg-gray-900 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs text-gray-300 shadow-inner border border-gray-800">
          {logs.map((log, index) => (
            <div key={index} className="mb-1 flex gap-2">
              <span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span>
              <span className={log.startsWith('ERRO') ? 'text-red-400' : log.includes('sucesso') ? 'text-green-400' : ''}>
                {log}
              </span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
