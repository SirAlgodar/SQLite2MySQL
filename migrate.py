import sqlite3
import mysql.connector
import logging
import argparse
import sys
import json
from datetime import datetime
from typing import List, Dict, Any, Tuple
from tqdm import tqdm
from rich.console import Console
from rich.table import Table
from rich.logging import RichHandler

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True)]
)
logger = logging.getLogger("migrator")
console = Console()

class DatabaseAnalyzer:
    """Analisa o esquema do SQLite."""
    def __init__(self, sqlite_path: str):
        self.sqlite_path = sqlite_path
        self.conn = sqlite3.connect(sqlite_path)
        self.cursor = self.conn.cursor()

    def get_tables(self) -> List[str]:
        self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        return [row[0] for row in self.cursor.fetchall()]

    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        self.cursor.execute(f"PRAGMA table_info('{table_name}');")
        columns = []
        for row in self.cursor.fetchall():
            columns.append({
                "cid": row[0],
                "name": row[1],
                "type": row[2],
                "notnull": row[3],
                "dflt_value": row[4],
                "pk": row[5]
            })
        return columns

    def get_indexes(self, table_name: str) -> List[Dict[str, Any]]:
        self.cursor.execute(f"PRAGMA index_list('{table_name}');")
        indexes = []
        for row in self.cursor.fetchall():
            idx_name = row[1]
            unique = row[2]
            self.cursor.execute(f"PRAGMA index_info('{idx_name}');")
            cols = [r[2] for r in self.cursor.fetchall()]
            indexes.append({
                "name": idx_name,
                "unique": unique,
                "columns": cols
            })
        return indexes

    def get_foreign_keys(self, table_name: str) -> List[Dict[str, Any]]:
        self.cursor.execute(f"PRAGMA foreign_key_list('{table_name}');")
        fks = []
        for row in self.cursor.fetchall():
            fks.append({
                "table": row[2],
                "from": row[3],
                "to": row[4]
            })
        return fks

class TypeMapper:
    """Mapeia tipos de dados SQLite para MySQL."""
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
    def map_type(sqlite_type: str, column_name: str, table_name: str) -> str:
        sqlite_type = sqlite_type.upper()
        
        # Tratamento especial para colunas específicas do Grafana se necessário
        if "VARCHAR" in sqlite_type:
            if "(" not in sqlite_type:
                return "VARCHAR(255)"
            return sqlite_type
        
        # Mapeamento padrão
        for key, value in TypeMapper.MAPPING.items():
            if key in sqlite_type:
                return value
        
        return "LONGTEXT" # Default fallback

class DuplicateResolver:
    """Detecta e resolve duplicatas no SQLite."""
    def __init__(self, analyzer: DatabaseAnalyzer):
        self.analyzer = analyzer

    def find_duplicates(self, table_name: str, unique_cols: List[str]) -> List[Tuple]:
        if not unique_cols:
            return []
        
        cols_str = ", ".join([f"`{c}`" for c in unique_cols])
        query = f"SELECT {cols_str}, COUNT(*) FROM `{table_name}` GROUP BY {cols_str} HAVING COUNT(*) > 1"
        try:
            self.analyzer.cursor.execute(query)
            return self.analyzer.cursor.fetchall()
        except sqlite3.OperationalError:
            return []

    def resolve(self, table_name: str, strategy: str = "remove"):
        """
        Estratégias:
        - remove: Remove as duplicatas mantendo apenas a primeira (menor ID).
        - rename: Adiciona um sufixo ao valor (apenas para campos de texto).
        """
        indexes = self.analyzer.get_indexes(table_name)
        unique_indexes = [idx for idx in indexes if idx['unique']]
        
        # Colunas comuns do Grafana que deveriam ser únicas mas às vezes têm duplicatas no SQLite
        common_grafana_unique = {
            "user": [["login"], ["email"]],
            "dashboard": [["uid"], ["slug", "org_id"]],
            "org": [["name"]],
            "data_source": [["uid", "org_id"], ["name", "org_id"]],
            "team": [["name", "org_id"]],
            "folder": [["uid"], ["title", "org_id"]]
        }
        
        # Adicionar colunas comuns à lista de verificação se a tabela existir
        if table_name in common_grafana_unique:
            existing_cols = [c['name'] for c in self.analyzer.get_table_schema(table_name)]
            for check_cols in common_grafana_unique[table_name]:
                # Filtrar colunas que realmente existem na tabela
                valid_cols = [c for c in check_cols if c in existing_cols]
                if len(valid_cols) == len(check_cols):
                    # Se não houver um índice para essas colunas, adicionamos um "pseudo-índice" para verificação
                    if not any(set(idx['columns']) == set(valid_cols) for idx in unique_indexes):
                        unique_indexes.append({'name': f'pseudo_idx_{"_".join(valid_cols)}', 'columns': valid_cols, 'unique': 1})

        resolutions = []
        
        for idx in unique_indexes:
            dupes = self.find_duplicates(table_name, idx['columns'])
            if dupes:
                logger.warning(f"Encontradas {len(dupes)} duplicatas na tabela {table_name} para as colunas {idx['columns']}")
                
                for dupe in dupes:
                    cols_vals = " AND ".join([f"`{c}` = ?" if dupe[i] is not None else f"`{c}` IS NULL" for i, c in enumerate(idx['columns'])])
                    vals = [v for v in dupe[:-1] if v is not None]
                    
                    # Pegar o ID da primeira ocorrência para manter
                    try:
                        self.analyzer.cursor.execute(f"SELECT rowid FROM `{table_name}` WHERE {cols_vals} ORDER BY rowid ASC LIMIT 1", vals)
                        keep_id_row = self.analyzer.cursor.fetchone()
                        if not keep_id_row: continue
                        keep_id = keep_id_row[0]
                        
                        if strategy == "remove":
                            # Remover as outras
                            self.analyzer.cursor.execute(f"DELETE FROM `{table_name}` WHERE {cols_vals} AND rowid != ?", (*vals, keep_id))
                            deleted_count = self.analyzer.cursor.rowcount
                            logger.info(f"Removidas {deleted_count} duplicatas de {table_name} para {vals}")
                            resolutions.append(f"Removidas {deleted_count} duplicatas de {table_name} para {vals}")
                        
                        elif strategy == "rename":
                            # Pegar todos os IDs exceto o que vamos manter
                            self.analyzer.cursor.execute(f"SELECT rowid FROM `{table_name}` WHERE {cols_vals} AND rowid != ?", vals)
                            ids_to_fix = [r[0] for r in self.analyzer.cursor.fetchall()]
                            
                            for i, rid in enumerate(ids_to_fix, 1):
                                col_to_rename = idx['columns'][0]
                                # Precisamos pegar o valor original para renomear
                                self.analyzer.cursor.execute(f"SELECT `{col_to_rename}` FROM `{table_name}` WHERE rowid = ?", (rid,))
                                orig_val = self.analyzer.cursor.fetchone()[0]
                                new_val = f"{orig_val}_dup_{i}"
                                self.analyzer.cursor.execute(f"UPDATE `{table_name}` SET `{col_to_rename}` = ? WHERE rowid = ?", (new_val, rid))
                                resolutions.append(f"Renomeada duplicata em {table_name}: {orig_val} -> {new_val}")
                    except Exception as e:
                        logger.error(f"Erro ao resolver duplicata em {table_name}: {e}")
        
        if resolutions:
            self.analyzer.conn.commit()
            
        return resolutions

class Validator:
    """Validação pós-migração."""
    def __init__(self, sqlite_analyzer: DatabaseAnalyzer, mysql_conn):
        self.sqlite_analyzer = sqlite_analyzer
        self.mysql_conn = mysql_conn

    def validate_counts(self, table_name: str) -> bool:
        self.sqlite_analyzer.cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
        sqlite_count = self.sqlite_analyzer.cursor.fetchone()[0]
        
        mysql_cursor = self.mysql_conn.cursor()
        mysql_cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
        mysql_count = mysql_cursor.fetchone()[0]
        
        return sqlite_count == mysql_count

    def run_grafana_tests(self) -> List[Dict[str, Any]]:
        tests = []
        # Teste 1: Verificar se existem usuários administradores
        try:
            mysql_cursor = self.mysql_conn.cursor(dictionary=True)
            mysql_cursor.execute("SELECT COUNT(*) as count FROM `user` WHERE is_admin = 1")
            res = mysql_cursor.fetchone()
            tests.append({"name": "Admin User Check", "status": "pass" if res['count'] > 0 else "warn", "message": f"Found {res['count']} admins"})
        except: pass

        # Teste 2: Verificar dashboards
        try:
            mysql_cursor.execute("SELECT COUNT(*) as count FROM `dashboard`")
            res = mysql_cursor.fetchone()
            tests.append({"name": "Dashboard Check", "status": "pass" if res['count'] > 0 else "warn", "message": f"Found {res['count']} dashboards"})
        except: pass

        return tests

class Migrator:
    """Gerencia o processo de migração."""
    def __init__(self, sqlite_path: str, mysql_config: Dict[str, Any], options: Dict[str, Any]):
        self.analyzer = DatabaseAnalyzer(sqlite_path)
        self.resolver = DuplicateResolver(self.analyzer)
        self.mysql_config = mysql_config
        self.options = options
        self.mysql_conn = None
        self.report = {
            "start_time": datetime.now().isoformat(),
            "tables": {},
            "duplicate_resolutions": [],
            "validation_results": [],
            "errors": [],
            "status": "started"
        }

    def connect_mysql(self):
        try:
            self.mysql_conn = mysql.connector.connect(**self.mysql_config)
            self.mysql_conn.autocommit = False
            logger.info("Conectado ao MySQL com sucesso.")
        except Exception as e:
            logger.error(f"Erro ao conectar ao MySQL: {e}")
            sys.exit(1)

    def create_mysql_schema(self, table_name: str):
        columns = self.analyzer.get_table_schema(table_name)
        indexes = self.analyzer.get_indexes(table_name)
        
        mysql_cols = []
        pk_cols = []
        
        for col in columns:
            mysql_type = TypeMapper.map_type(col['type'], col['name'], table_name)
            null_str = "NOT NULL" if col['notnull'] else "NULL"
            
            # Tratamento de valor padrão
            dflt = col['dflt_value']
            if dflt is not None:
                if dflt.upper() == "CURRENT_TIMESTAMP":
                    default_str = "DEFAULT CURRENT_TIMESTAMP"
                elif dflt.startswith("'") and dflt.endswith("'"):
                    default_str = f"DEFAULT {dflt}"
                elif dflt.isdigit():
                    default_str = f"DEFAULT {dflt}"
                else:
                    default_str = "" # Ignorar defaults complexos do SQLite
            else:
                default_str = ""
            
            extra = ""
            if col['pk'] and "INT" in mysql_type.upper():
                extra = "AUTO_INCREMENT"
                pk_cols.append(col['name'])
            elif col['pk']:
                pk_cols.append(col['name'])

            mysql_cols.append(f"`{col['name']}` {mysql_type} {null_str} {default_str} {extra}")

        create_query = f"CREATE TABLE IF NOT EXISTS `{table_name}` (\n  " + ",\n  ".join(mysql_cols)
        
        if pk_cols:
            create_query += f",\n  PRIMARY KEY (" + ", ".join([f"`{c}`" for c in pk_cols]) + ")"
        
        create_query += "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
        
        cursor = self.mysql_conn.cursor()
        cursor.execute(f"DROP TABLE IF EXISTS `{table_name}`")
        cursor.execute(create_query)
        
        # Índices
        for idx in indexes:
            # Skip primary key indexes as they are already handled
            if any(col in pk_cols for col in idx['columns']) and idx['unique'] and len(idx['columns']) == 1:
                continue
                
            idx_type = "UNIQUE INDEX" if idx['unique'] else "INDEX"
            cols = ", ".join([f"`{c}`" for c in idx['columns']])
            try:
                cursor.execute(f"CREATE {idx_type} `{idx['name']}` ON `{table_name}` ({cols})")
            except Exception as e:
                logger.warning(f"Erro ao criar índice {idx['name']} em {table_name}: {e}")
                if idx['unique']:
                    logger.info(f"Tentando criar índice não-único para {idx['name']}")
                    cursor.execute(f"CREATE INDEX `{idx['name']}_non_unique` ON `{table_name}` ({cols})")

    def migrate_data(self, table_name: str):
        self.analyzer.cursor.execute(f"SELECT * FROM `{table_name}`")
        rows = self.analyzer.cursor.fetchall()
        if not rows:
            return

        col_names = [description[0] for description in self.analyzer.cursor.description]
        placeholders = ", ".join(["%s"] * len(col_names))
        cols_str = ", ".join([f"`{c}`" for c in col_names])
        
        insert_query = f"INSERT INTO `{table_name}` ({cols_str}) VALUES ({placeholders})"
        
        mysql_cursor = self.mysql_conn.cursor()
        
        batch_size = 1000
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            # Convert SQLite types to MySQL compatible ones if needed
            cleaned_batch = []
            for row in batch:
                cleaned_row = []
                for val in row:
                    if isinstance(val, bytes):
                        cleaned_row.append(val)
                    else:
                        cleaned_row.append(val)
                cleaned_batch.append(tuple(cleaned_row))
                
            try:
                mysql_cursor.executemany(insert_query, cleaned_batch)
            except Exception as e:
                logger.error(f"Erro ao inserir dados na tabela {table_name}: {e}")
                raise

    def run(self):
        self.connect_mysql()
        tables = self.analyzer.get_tables()
        
        try:
            # 1. Resolução de duplicatas no SQLite
            if self.options.get("resolve_duplicates"):
                logger.info("Iniciando detecção e resolução de duplicatas...")
                for table in tables:
                    resolutions = self.resolver.resolve(table, strategy=self.options.get("duplicate_strategy", "remove"))
                    self.report["duplicate_resolutions"].extend(resolutions)

            # 2. Migração
            for table in tqdm(tables, desc="Migrando tabelas"):
                logger.debug(f"Processando tabela: {table}")
                self.create_mysql_schema(table)
                self.migrate_data(table)
                self.report["tables"][table] = {"status": "success"}
            
            # 3. Validação
            logger.info("Iniciando validação pós-migração...")
            validator = Validator(self.analyzer, self.mysql_conn)
            for table in tables:
                count_ok = validator.validate_counts(table)
                if not count_ok:
                    logger.warning(f"Diferença na contagem de registros para a tabela: {table}")
                    self.report["tables"][table]["validation"] = "count_mismatch"
                else:
                    self.report["tables"][table]["validation"] = "ok"

            grafana_tests = validator.run_grafana_tests()
            self.report["validation_results"] = grafana_tests

            self.mysql_conn.commit()
            self.report["status"] = "completed"
            logger.info("Migração concluída com sucesso!")
            
        except Exception as e:
            if self.mysql_conn:
                self.mysql_conn.rollback()
            self.report["status"] = "failed"
            self.report["errors"].append(str(e))
            logger.error(f"Migração falhou. Rollback executado. Erro: {e}")
        finally:
            self.report["end_time"] = datetime.now().isoformat()
            self.generate_report()

    def generate_report(self):
        # JSON Report
        with open("migration_report.json", "w") as f:
            json.dump(self.report, f, indent=4)
        
        # Terminal Report (Rich)
        console.print("\n[bold blue]Relatório de Migração[/bold blue]")
        
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Tabela")
        table.add_column("Status")
        table.add_column("Validação")
        
        for name, data in self.report["tables"].items():
            status = "[green]Success[/green]" if data["status"] == "success" else "[red]Failed[/red]"
            val = "[green]OK[/green]" if data.get("validation") == "ok" else "[yellow]Mismatch[/yellow]"
            table.add_row(name, status, val)
        
        console.print(table)
        
        if self.report["duplicate_resolutions"]:
            console.print("\n[bold yellow]Resoluções de Duplicatas:[/bold yellow]")
            for res in self.report["duplicate_resolutions"]:
                console.print(f"- {res}")
        
        if self.report["validation_results"]:
            console.print("\n[bold cyan]Testes Específicos Grafana:[/bold cyan]")
            for test in self.report["validation_results"]:
                color = "green" if test["status"] == "pass" else "yellow"
                console.print(f"- {test['name']}: [{color}]{test['status'].upper()}[/{color}] ({test['message']})")

        if self.report["errors"]:
            console.print("\n[bold red]Erros Encontrados:[/bold red]")
            for err in self.report["errors"]:
                console.print(f"- {err}")

        logger.info("Relatório detalhado salvo em: migration_report.json")

def main():
    parser = argparse.ArgumentParser(description="Migrador SQLite para MySQL (Otimizado para Grafana)")
    parser.add_argument("--sqlite", required=True, help="Caminho para o arquivo SQLite do Grafana")
    parser.add_argument("--host", default="localhost", help="Host do MySQL")
    parser.add_argument("--port", type=int, default=3306, help="Porta do MySQL")
    parser.add_argument("--user", required=True, help="Usuário do MySQL")
    parser.add_argument("--password", required=True, help="Senha do MySQL")
    parser.add_argument("--database", required=True, help="Banco de dados MySQL de destino")
    parser.add_argument("--resolve-dupes", action="store_true", help="Ativar resolução de duplicatas")
    parser.add_argument("--dupe-strategy", choices=["remove", "rename"], default="remove", help="Estratégia para resolução de duplicatas")
    parser.add_argument("--log-level", choices=["DEBUG", "INFO", "WARNING", "ERROR"], default="INFO", help="Nível de logging")
    
    args = parser.parse_args()
    
    logger.setLevel(args.log_level)
    
    mysql_config = {
        "host": args.host,
        "port": args.port,
        "user": args.user,
        "password": args.password,
        "database": args.database
    }
    
    options = {
        "resolve_duplicates": args.resolve_dupes,
        "duplicate_strategy": args.dupe_strategy
    }
    
    migrator = Migrator(args.sqlite, mysql_config, options)
    migrator.run()

if __name__ == "__main__":
    main()
