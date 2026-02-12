import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton } from './ui/Skeleton';

interface DataPreviewProps {
  tableName: string;
  onClose: () => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ tableName, onClose }) => {
  const { t } = useTranslation();
  const { fileId } = useSelector((state: RootState) => state.migration);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    const fetchData = async () => {
      if (!fileId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(
          `/api/preview/${fileId}/${tableName}?limit=${pageSize}&offset=${page * pageSize}`
        );
        setData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [fileId, tableName, page, t]);

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {t('preview.title')}: <span className="text-blue-600">{tableName}</span>
            </h3>
            <p className="text-sm text-gray-500 mt-1">{t('preview.subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-4 w-24" />
                ))}
              </div>
              <div className="divide-y divide-gray-100">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div key={i} className="p-4 flex gap-4">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <Skeleton key={j} className="h-4 w-24" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3">
              <span className="font-medium">{error}</span>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <p>{t('preview.no_data')}</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="bg-gray-50">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        {columns.map((col) => (
                          <td
                            key={`${idx}-${col}`}
                            className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap"
                          >
                            {row[col] === null ? (
                              <span className="text-gray-300 italic">NULL</span>
                            ) : typeof row[col] === 'boolean' ? (
                              row[col].toString()
                            ) : (
                              row[col].toString()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {t('preview.showing_page', { page: page + 1 })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={data.length < pageSize || loading}
              className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DataPreview;
