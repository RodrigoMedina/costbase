import pymssql
import sys

conn = pymssql.connect(
    server="localhost",
    user="sa",
    password="CostBase123!",
    database="ConstruBase",
)

cur = conn.cursor()
cur.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
tables = [r[0] for r in cur.fetchall()]

print(f"\nFound {len(tables)} tables:\n")

for t in tables:
    cur.execute(f"SELECT COUNT(*) FROM [{t}]")
    count = cur.fetchone()[0]
    cur.execute(f"""
        SELECT COLUMN_NAME, DATA_TYPE + 
        CASE WHEN CHARACTER_MAXIMUM_LENGTH IS NOT NULL THEN '(' + CAST(CHARACTER_MAXIMUM_LENGTH AS VARCHAR) + ')' ELSE '' END
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '{t}' 
        ORDER BY ORDINAL_POSITION
    """)
    cols = [f"{r[0]}({r[1]})" for r in cur.fetchall()]
    print(f"  {t:45s} {count:>8,} rows  |  {', '.join(cols[:8])}{'...' if len(cols)>8 else ''}")

conn.close()
