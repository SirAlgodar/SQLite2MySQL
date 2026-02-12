import sqlite3
import os

def create_dummy_db(db_path):
    if os.path.exists(db_path):
        os.remove(db_path)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Tabela user (com duplicata potencial no login)
    cursor.execute("""
    CREATE TABLE user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT NOT NULL,
        email TEXT,
        is_admin BOOLEAN
    )
    """)
    cursor.execute("CREATE UNIQUE INDEX idx_user_login ON user(login)")
    
    # Tabela dashboard
    cursor.execute("""
    CREATE TABLE dashboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT NOT NULL,
        slug TEXT NOT NULL,
        data TEXT
    )
    """)
    cursor.execute("CREATE UNIQUE INDEX idx_dashboard_uid ON dashboard(uid)")
    
    # Inserir dados com duplicatas (precisamos desativar o index temporariamente ou inserir antes de criar o index)
    # Na verdade, o SQLite não permite inserir duplicatas se o index único já existe.
    # Mas o problema no Grafana geralmente ocorre quando migrações de esquema falham ou algo assim.
    # Vamos simular inserindo dados e depois tentando criar um índice que falharia se não resolvêssemos.
    
    cursor.execute("INSERT INTO user (login, email, is_admin) VALUES ('admin', 'admin@local', 1)")
    cursor.execute("INSERT INTO user (login, email, is_admin) VALUES ('user1', 'user1@local', 0)")
    # Para simular duplicata real no SQLite (sem o index único ativo ainda)
    cursor.execute("DROP INDEX idx_user_login")
    cursor.execute("INSERT INTO user (login, email, is_admin) VALUES ('admin', 'admin2@local', 0)")
    
    # Dashboards
    cursor.execute("INSERT INTO dashboard (uid, slug, data) VALUES ('db1', 'dash-1', '{}')")
    
    conn.commit()
    conn.close()
    print(f"Banco de dados dummy criado em {db_path}")

if __name__ == "__main__":
    create_dummy_db("grafana_test.db")
