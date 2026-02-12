module.exports = {
  apps: [
    {
      name: 'backend',
      script: './venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8000',
      cwd: './backend',
      interpreter: 'none',
      env: {
        PYTHONUNBUFFERED: '1',
      },
    },
    {
      name: 'frontend',
      script: 'npm',
      args: 'run dev -- --host',
      cwd: './frontend',
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
