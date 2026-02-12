import os
import sqlite3
import mysql.connector
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Tuple
import shutil
import uuid
import json
from datetime import datetime

app = FastAPI(title="SQLite to MySQL Migrator API")

# Configuração de CORS para permitir o frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class ConnectionConfig(BaseModel):
    host: str
    port: int
    user: str
    password: str
    database: str

class MigrationOptions(BaseModel):
    sqlite_file_id: str
    connection: ConnectionConfig
    include_data: bool = True
    resolve_duplicates: bool = True
    duplicate_strategy: str = "remove"

# Dicionário em memória para rastrear o status das migrações
migration_status = {}

class TypeMapper:
    MAPPING = {
        "INTEGER": "INT",
        "INT": "INT",
        "TINYINT": "TINYINT",
        "SMALLINT": "SMALLINT",
        "MEDIUMINT": "MEDIUMINT",
        "BIGINT": "BIGINT",
        "UNSIGNED BIG INT": "BIGINT UNSIGNED",
        "INT2": "SMALLINT",
        "INT8": "BIGINT",
        "TEXT": "LONGTEXT",
        "CLOB": "LONGTEXT",
        "BLOB": "LONGBLOB",
        "REAL": "DOUBLE",
        "DOUBLE": "DOUBLE",
        "DOUBLE PRECISION": "DOUBLE",
        "FLOAT": "FLOAT",
        "NUMERIC": "DECIMAL(10,5)",
        "BOOLEAN": "BOOLEAN",
        "DATETIME": "DATETIME",
        "DATE": "DATE",
        "VARCHAR": "VARCHAR",
        "NVARCHAR": "VARCHAR",
        "CHARACTER": "CHAR",
    }

    @staticmethod
    def map_type(sqlite_type: str) -> str:
        sqlite_type = sqlite_type.upper()
        if "VARCHAR" in sqlite_type:
            if "(" not in sqlite_type:
                return "VARCHAR(255)"
            return sqlite_type
        for key, value in TypeMapper.MAPPING.items():
            if key in sqlite_type:
                return value
        return "LONGTEXT"

def run_migration_task(migration_id: str, options: MigrationOptions):
    file_path = os.path.join(UPLOAD_DIR, f"{options.sqlite_file_id}.db")
    status = migration_status[migration_id]
    status["status"] = "migrating"
    
    sqlite_conn = None
    mysql_conn = None
    
    try:
        sqlite_conn = sqlite3.connect(file_path)
        sqlite_cursor = sqlite_conn.cursor()
        
        mysql_conn = mysql.connector.connect(
            host=options.connection.host,
            port=options.connection.port,
            user=options.connection.user,
            password=options.connection.password,
            database=options.connection.database
        )
        mysql_conn.autocommit = False
        mysql_cursor = mysql_conn.cursor()
        
        sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tables = [row[0] for row in sqlite_cursor.fetchall()]
        
        total_tables = len(tables)
        
        # 1. Resolução de duplicatas se ativado
        if options.resolve_duplicates:
            status["logs"].append("Iniciando resolução de duplicatas...")
            common_grafana_unique = {
                "user": [["login"], ["email"]],
                "dashboard": [["uid"], ["slug", "org_id"]],
                "org": [["name"]],
                "data_source": [["uid", "org_id"], ["name", "org_id"]],
                "team": [["name", "org_id"]],
                "folder": [["uid"], ["title", "org_id"]]
            }
            
            for table in tables:
                if table in common_grafana_unique:
                    # Get table columns to verify they exist
                    sqlite_cursor.execute(f"PRAGMA table_info('{table}')")
                    existing_cols = [r[1] for r in sqlite_cursor.fetchall()]
                    
                    for check_cols in common_grafana_unique[table]:
                        valid_cols = [c for c in check_cols if c in existing_cols]
                        if len(valid_cols) == len(check_cols):
                            cols_str = ", ".join([f"`{c}`" for c in valid_cols])
                            sqlite_cursor.execute(f"SELECT {cols_str}, COUNT(*) FROM `{table}` GROUP BY {cols_str} HAVING COUNT(*) > 1")
                            dupes = sqlite_cursor.fetchall()
                            
                            for dupe in dupes:
                                cols_vals = " AND ".join([f"`{c}` = ?" if dupe[i] is not None else f"`{c}` IS NULL" for i, c in enumerate(valid_cols)])
                                vals = [v for v in dupe[:-1] if v is not None]
                                
                                sqlite_cursor.execute(f"SELECT rowid FROM `{table}` WHERE {cols_vals} ORDER BY rowid ASC LIMIT 1", vals)
                                keep_id = sqlite_cursor.fetchone()[0]
                                
                                if options.duplicate_strategy == "remove":
                                    sqlite_cursor.execute(f"DELETE FROM `{table}` WHERE {cols_vals} AND rowid != ?", (*vals, keep_id))
                                    status["logs"].append(f"Removidas {sqlite_cursor.rowcount} duplicatas em {table}")
            
            sqlite_conn.commit()

        # 2. Migração de Esquema e Dados
        for idx, table in enumerate(tables):
            status["logs"].append(f"Processando tabela: {table}")
            
            sqlite_cursor.execute(f"PRAGMA table_info('{table}')")
            cols = sqlite_cursor.fetchall()
            
            mysql_cols = []
            pk_cols = []
            for col in cols:
                name, type_name, notnull, pk = col[1], col[2], col[3], col[5]
                m_type = TypeMapper.map_type(type_name)
                null_str = "NOT NULL" if notnull else "NULL"
                
                extra = ""
                if pk and "INT" in m_type.upper():
                    extra = "AUTO_INCREMENT"
                
                mysql_cols.append(f"`{name}` {m_type} {null_str} {extra}")
                if pk: pk_cols.append(f"`{name}`")
            
            create_query = f"CREATE TABLE IF NOT EXISTS `{table}` (\n  " + ",\n  ".join(mysql_cols)
            if pk_cols:
                create_query += f",\n  PRIMARY KEY ({', '.join([f'`{c}`' for c in pk_cols])})"
            create_query += "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
            
            mysql_cursor.execute(f"DROP TABLE IF EXISTS `{table}`")
            mysql_cursor.execute(create_query)
            
            if options.include_data:
                sqlite_cursor.execute(f"SELECT * FROM `{table}`")
                rows = sqlite_cursor.fetchall()
                if rows:
                    col_names = [c[1] for c in cols]
                    placeholders = ", ".join(["%s"] * len(col_names))
                    insert_query = f"INSERT INTO `{table}` ({', '.join([f'`{c}`' for c in col_names])}) VALUES ({placeholders})"
                    
                    batch_size = 1000
                    for i in range(0, len(rows), batch_size):
                        batch = rows[i:i + batch_size]
                        mysql_cursor.executemany(insert_query, batch)
            
            status["progress"] = int(((idx + 1) / total_tables) * 100)
            status["logs"].append(f"Tabela {table} migrada.")
            
        mysql_conn.commit()
        
        # 3. Validação final
        status["logs"].append("Validando contagem de registros...")
        validation_errors = []
        for table in tables:
            sqlite_cursor.execute(f"SELECT COUNT(*) FROM `{table}`")
            sqlite_count = sqlite_cursor.fetchone()[0]
            mysql_cursor.execute(f"SELECT COUNT(*) FROM `{table}`")
            mysql_count = mysql_cursor.fetchone()[0]
            if sqlite_count != mysql_count:
                validation_errors.append(f"Divergência em {table}: SQLite={sqlite_count}, MySQL={mysql_count}")
        
        if validation_errors:
            for err in validation_errors:
                status["logs"].append(f"AVISO: {err}")
        else:
            status["logs"].append("Validação concluída: Todos os registros conferem.")

        status["status"] = "completed"
        status["logs"].append("Migração finalizada com sucesso!")
        
    except Exception as e:
        if mysql_conn: mysql_conn.rollback()
        status["status"] = "failed"
        status["logs"].append(f"ERRO CRÍTICO: {str(e)}")
    finally:
        if sqlite_conn: sqlite_conn.close()
        if mysql_conn: mysql_conn.close()

@app.post("/upload")
async def upload_sqlite(file: UploadFile = File(...)):
    if not file.filename.endswith(('.db', '.sqlite')):
        raise HTTPException(status_code=400, detail="Formato de arquivo inválido. Use .db ou .sqlite")
    
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.db")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        conn = sqlite3.connect(file_path)
        conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        conn.close()
        
        return {"file_id": file_id, "filename": file.filename}
    except Exception as e:
        if os.path.exists(file_path): os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Erro ao processar arquivo: {str(e)}")

@app.get("/schema/{file_id}")
async def get_schema(file_id: str):
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.db")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    
    try:
        conn = sqlite3.connect(file_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tables = [row[0] for row in cursor.fetchall()]
        
        schema = {}
        for table in tables:
            cursor.execute(f"PRAGMA table_info('{table}')")
            columns = [{"name": r[1], "type": r[2], "notnull": bool(r[3]), "pk": bool(r[5])} for r in cursor.fetchall()]
            cursor.execute(f"SELECT COUNT(*) FROM `{table}`")
            count = cursor.fetchone()[0]
            schema[table] = {"columns": columns, "record_count": count}
            
        conn.close()
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/preview/{file_id}/{table_name}")
async def get_preview(file_id: str, table_name: str, limit: int = 100, offset: int = 0):
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.db")
    try:
        conn = sqlite3.connect(file_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM `{table_name}` LIMIT {limit} OFFSET {offset}")
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/test-connection")
async def test_connection(config: ConnectionConfig):
    try:
        conn = mysql.connector.connect(
            host=config.host,
            port=config.port,
            user=config.user,
            password=config.password,
            database=config.database,
            connect_timeout=5
        )
        conn.close()
        return {"status": "success", "message": "Conexão estabelecida com sucesso"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/migrate")
async def start_migration(options: MigrationOptions, background_tasks: BackgroundTasks):
    migration_id = str(uuid.uuid4())
    migration_status[migration_id] = {"status": "pending", "progress": 0, "logs": []}
    background_tasks.add_task(run_migration_task, migration_id, options)
    return {"migration_id": migration_id}

@app.get("/status/{migration_id}")
async def get_migration_status(migration_id: str):
    return migration_status.get(migration_id, {"status": "not_found"})

@app.get("/export-sql/{file_id}")
async def export_sql(file_id: str, include_data: bool = True):
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.db")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    
    output_filename = f"migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    output_path = os.path.join(UPLOAD_DIR, output_filename)
    
    try:
        conn = sqlite3.connect(file_path)
        cursor = conn.cursor()
        
        with open(output_path, "w") as f:
            f.write(f"-- Migration from SQLite to MySQL\n-- Generated: {datetime.now().isoformat()}\n\n")
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            tables = [row[0] for row in cursor.fetchall()]
            
            for table in tables:
                cursor.execute(f"PRAGMA table_info('{table}')")
                cols = cursor.fetchall()
                mysql_cols = []
                pk_cols = []
                for col in cols:
                    m_type = TypeMapper.map_type(col[2])
                    null_str = "NOT NULL" if col[3] else "NULL"
                    mysql_cols.append(f"`{col[1]}` {m_type} {null_str}")
                    if col[5]: pk_cols.append(f"`{col[1]}`")
                
                f.write(f"DROP TABLE IF EXISTS `{table}`;\n")
                f.write(f"CREATE TABLE `{table}` (\n  " + ",\n  ".join(mysql_cols))
                if pk_cols: f.write(f",\n  PRIMARY KEY ({', '.join([f'`{c}`' for c in pk_cols])})")
                f.write("\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n")
                
                if include_data:
                    cursor.execute(f"SELECT * FROM `{table}`")
                    rows = cursor.fetchall()
                    if rows:
                        col_names = ", ".join([f"`{c[1]}`" for c in cols])
                        for row in rows:
                            vals = []
                            for v in row:
                                if v is None: vals.append("NULL")
                                elif isinstance(v, (int, float)): vals.append(str(v))
                                else: vals.append(f"'{str(v).replace(chr(39), chr(39)+chr(39))}'")
                            f.write(f"INSERT INTO `{table}` ({col_names}) VALUES ({', '.join(vals)});\n")
                        f.write("\n")
        
        conn.close()
        return FileResponse(output_path, filename=output_filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
