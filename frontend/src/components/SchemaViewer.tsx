import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { setSchema } from '../store/slices/migrationSlice';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Search, Table, Columns, Hash, Eye, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DataPreview from './DataPreview';
import { Skeleton } from './ui/Skeleton';

const SchemaViewerSkeleton = () => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
    <div className="p-6 border-b border-gray-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full md:w-64" />
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[500px]">
      <div className="border-r border-gray-100 p-4 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-4 h-4" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
      <div className="lg:col-span-2 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Skeleton className="w-3 h-3" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const SchemaViewer: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { fileId, schema } = useSelector((state: RootState) => state.migration);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const fetchSchema = async () => {
      if (!fileId || schema) return;

      setLoading(true);
      try {
        const response = await axios.get(`/api/schema/${fileId}`);
        dispatch(setSchema(response.data));
      } catch (error) {
        console.error('Error fetching schema:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchema();
  }, [fileId, schema, dispatch]);

  if (loading) {
    return <SchemaViewerSkeleton />;
  }

  if (!schema) return null;

  const tableNames = Object.keys(schema).filter((name) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
      <div className="p-6 border-b border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Table className="text-blue-600" />
            {t('schema.title')}
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('schema.search_placeholder')}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full md:w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[500px]">
        {/* Table List */}
        <div className="border-r border-gray-100 overflow-y-auto max-h-[600px]">
          {tableNames.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {t('schema.no_tables_found')}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {tableNames.map((tableName) => (
                <button
                  key={tableName}
                  onClick={() => setSelectedTable(tableName)}
                  className={`w-full text-left p-4 transition-colors flex items-center justify-between hover:bg-blue-50 ${
                    selectedTable === tableName ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Table className={`w-4 h-4 ${selectedTable === tableName ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`font-medium ${selectedTable === tableName ? 'text-blue-700' : 'text-gray-700'}`}>
                      {tableName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Hash className="w-3 h-3" />
                    {schema[tableName].record_count}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table Details */}
        <div className="lg:col-span-2 p-6 bg-gray-50/30">
          <AnimatePresence mode="wait">
            {selectedTable ? (
              <motion.div
                key={selectedTable}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedTable}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {schema[selectedTable].record_count} {t('schema.records')}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    {t('schema.preview_data')}
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          {t('schema.column')}
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          {t('schema.type')}
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          {t('schema.constraints')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {schema[selectedTable].columns.map((col: any) => (
                        <tr key={col.name} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 flex items-center gap-2">
                            <Columns className="w-3 h-3 text-gray-400" />
                            <span className="font-medium text-gray-800">{col.name}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <code className="bg-gray-100 px-2 py-0.5 rounded text-blue-600">{col.type}</code>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              {col.pk && (
                                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                  PK
                                </span>
                              )}
                              {col.notnull && (
                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                  NOT NULL
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                <Table className="w-16 h-16 opacity-20" />
                <p>{t('schema.select_table')}</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Data Preview Modal */}
      <AnimatePresence>
        {showPreview && selectedTable && (
          <DataPreview
            tableName={selectedTable}
            onClose={() => setShowPreview(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SchemaViewer;
