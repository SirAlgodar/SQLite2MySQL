import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileCode, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { setUploadSuccess } from '../store/slices/migrationSlice';
import ProgressBar from './ProgressBar';

const FileUploader: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
      setError(t('uploader.invalid_file'));
      return;
    }

    setError(null);
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/upload', formData, {
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      dispatch(setUploadSuccess({ 
        fileId: response.data.file_id, 
        filename: response.data.filename 
      }));
    } catch (err: any) {
      setError(err.response?.data?.detail || t('common.error'));
    } finally {
      setIsUploading(false);
    }
  }, [t, dispatch]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/x-sqlite3': ['.db', '.sqlite'],
    }
  });

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white flex items-center gap-2">
        <Upload className="w-6 h-6 text-blue-500" />
        {t('uploader.title')}
      </h2>

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}
          ${isUploading ? 'pointer-events-none opacity-50' : 'hover:border-blue-400 dark:hover:border-blue-500'}
        `}
      >
        <input {...getInputProps()} />
        <FileCode className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
        <p className="text-gray-600 dark:text-gray-300 text-lg">
          {isDragActive ? t('uploader.dropzone_active') : t('uploader.dropzone')}
        </p>
      </div>

      {isUploading && (
        <div className="mt-6">
          <p className="text-sm text-gray-500 mb-2">{t('uploader.uploading')}</p>
          <ProgressBar progress={uploadProgress} />
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
