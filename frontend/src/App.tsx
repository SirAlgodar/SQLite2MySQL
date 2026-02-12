import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from './store';
import { reset } from './store/slices/migrationSlice';
import { useTranslation } from 'react-i18next';
import FileUploader from './components/FileUploader';
import SchemaViewer from './components/SchemaViewer';
import MigrationForm from './components/MigrationForm';
import ProgressBar from './components/ProgressBar';
import LanguageSelector from './components/LanguageSelector';
import { Database, ArrowLeft, RefreshCw, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const App: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { fileId, filename, status } = useSelector((state: RootState) => state.migration);

  const handleReset = () => {
    if (window.confirm(t('common.confirm_reset'))) {
      dispatch(reset());
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                  SQLite2MySQL
                </h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">
                  Migrator Pro
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <LanguageSelector />
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatePresence mode="wait">
          {!fileId ? (
            <motion.div
              key="uploader"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto text-center"
            >
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                {t('app.welcome_title')}
              </h2>
              <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto">
                {t('app.welcome_subtitle')}
              </p>
              <FileUploader />
              
              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { title: t('features.fast_title'), desc: t('features.fast_desc'), icon: '⚡' },
                  { title: t('features.secure_title'), desc: t('features.secure_desc'), icon: '🛡️' },
                  { title: t('features.smart_title'), desc: t('features.smart_desc'), icon: '🧠' },
                ].map((f, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-3xl mb-3">{f.icon}</div>
                    <h3 className="font-bold text-slate-800 mb-2">{f.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="workspace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              {/* Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-blue-600 p-6 rounded-3xl shadow-xl shadow-blue-200 text-white">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleReset}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    title={t('common.back')}
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold">{filename}</h2>
                    <p className="text-blue-100 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      {t('app.ready_to_migrate')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-medium border border-white/20"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('common.new_migration')}
                  </button>
                </div>
              </div>

              {/* Progress Bar (Visible during migration) */}
              <ProgressBar />

              <div className="grid grid-cols-1 gap-12">
                {/* Schema Viewer Section */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Database className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">{t('app.schema_analysis')}</h3>
                  </div>
                  <SchemaViewer />
                </section>

                {/* Migration Form Section */}
                <section className="bg-slate-100/50 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-12 border-y border-slate-200">
                  <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-blue-600" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800">{t('app.migration_config')}</h3>
                    </div>
                    <MigrationForm />
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 mt-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">
            © 2026 SQLite2MySQL Migrator Pro. {t('footer.made_with')} ❤️
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
