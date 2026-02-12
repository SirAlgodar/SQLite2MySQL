from migrate import DatabaseAnalyzer, DuplicateResolver
import os

def test_logic():
    db_path = "grafana_test.db"
    analyzer = DatabaseAnalyzer(db_path)
    resolver = DuplicateResolver(analyzer)
    
    print("--- Analisando Tabelas ---")
    tables = analyzer.get_tables()
    print(f"Tabelas encontradas: {tables}")
    
    for table in tables:
        schema = analyzer.get_table_schema(table)
        print(f"\nEsquema de {table}:")
        for col in schema:
            print(f"  - {col['name']} ({col['type']})")
            
        indexes = analyzer.get_indexes(table)
        print(f"Índices de {table}: {indexes}")
        
    print("\n--- Testando Detecção de Duplicatas ---")
    # Vamos simular a detecção no campo 'login' da tabela 'user'
    dupes = resolver.find_duplicates("user", ["login"])
    print(f"Duplicatas em 'user' (login): {dupes}")
    
    if dupes:
        print("\n--- Resolvendo Duplicatas (Estratégia: remove) ---")
        resolutions = resolver.resolve("user", strategy="remove")
        for res in resolutions:
            print(f"Resolução: {res}")
            
        # Verificar se removeu
        dupes_after = resolver.find_duplicates("user", ["login"])
        print(f"Duplicatas após resolução: {dupes_after}")

if __name__ == "__main__":
    test_logic()
