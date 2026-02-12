# Guia Completo de Acesso e Execução - MigrateDB

Este guia fornece instruções detalhadas sobre como configurar, executar e acessar a aplicação completa (Frontend + Backend) para migração de bancos de dados SQLite para MySQL.

## Pré-requisitos

Certifique-se de ter as seguintes ferramentas instaladas no seu sistema:

- **Node.js** (v18 ou superior)
- **Python** (v3.10 ou superior)
- **MySQL** ou **MariaDB** (rodando e acessível)

## Inicialização Rápida (Recomendado)

Criamos um script automatizado que configura e inicia todos os serviços para você.

1. Abra o terminal na raiz do projeto.
2. Execute o script de inicialização:

```bash
./start.sh
```

O script irá automaticamente:
1. Criar e ativar o ambiente virtual Python (`venv`) no backend.
2. Instalar as dependências do backend (`requirements.txt`).
3. Iniciar o servidor backend na porta **8000**.
4. Instalar as dependências do frontend (`node_modules`).
5. Iniciar o servidor de desenvolvimento do frontend (geralmente na porta **5173**).

## Acesso à Aplicação

Após a inicialização bem-sucedida:

- **Frontend (Interface Web)**: Acesse [http://localhost:5173](http://localhost:5173) (ou a porta indicada no terminal).
- **Backend (API Docs)**: Acesse [http://localhost:8000/docs](http://localhost:8000/docs) para ver a documentação interativa da API (Swagger UI).

## Inicialização Manual

Caso prefira rodar os serviços separadamente, siga os passos abaixo em dois terminais diferentes.

### Terminal 1: Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Terminal 2: Frontend

```bash
cd frontend
npm install
npm run dev
```

## Funcionalidades Principais

1.  **Upload**: Arraste e solte seu arquivo `.db` ou `.sqlite`.
2.  **Schema Viewer**: Visualize a estrutura das tabelas e colunas do seu banco de dados SQLite.
3.  **Data Preview**: Veja uma prévia dos dados contidos nas tabelas.
4.  **Configuração de Destino**: Insira as credenciais do seu banco MySQL/MariaDB.
5.  **Migração**: Execute a migração completa, incluindo resolução de duplicatas e validação de dados.

## Testes

Para executar os testes automatizados do frontend e garantir a integridade do código:

```bash
cd frontend
npm run test:coverage
```

## Solução de Problemas Comuns

-   **Erro `zsh: command not found: uvicorn`**: Certifique-se de que o ambiente virtual está ativado (`source venv/bin/activate`) antes de rodar o `uvicorn`.
-   **Porta em uso**: Se as portas 8000 ou 5173 estiverem ocupadas, feche os processos que as estão utilizando ou configure portas diferentes.
-   **Erro de Conexão MySQL**: Verifique se o serviço MySQL está rodando e se as credenciais (host, user, password) estão corretas. O usuário deve ter permissões para criar tabelas e inserir dados.
-   **Erro `SyntaxError: Unexpected token '.'` (Vite)**: Isso ocorre porque sua versão do Node.js é antiga. O projeto requer **Node.js v18** ou superior. Atualize seu ambiente.
-   **Erros `command not found` (python3, pip, npm, uvicorn)**: Certifique-se de que todas as dependências estão instaladas.
    -   **Ubuntu/Debian**:
        ```bash
        sudo apt update
        sudo apt install python3 python3-venv python3-pip nodejs npm
        ```
    -   **CentOS/RHEL**:
        ```bash
        sudo yum install python3 python3-pip nodejs npm
        ```
