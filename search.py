"""
Semantic search across insumos and conceptos using pgvector.
Usage:  python search.py "cemento gris"          (insumos, default)
        python search.py --conceptos "cimentacion"
        python search.py --all "block hueco"
"""
import os, sys, textwrap
from dotenv import load_dotenv
import psycopg2
from openai import OpenAI

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()

query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "cemento"
search_type = "insumos"  # default

# Generate embedding for the query
resp = client.embeddings.create(
    model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
    input=[query]
)
qv = resp.data[0].embedding

def search(table, label_cols, limit=10):
    cols = ", ".join(label_cols)
    sql = f"""
        SELECT {cols}, 1 - (embedding <=> %s::vector) AS score
        FROM {table}
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """
    cur.execute(sql, (qv, qv, limit))
    return cur.fetchall()

print(f"\n{'='*70}")
print(f"  SEMANTIC SEARCH: \"{query}\"")
print(f"{'='*70}")

# Search insumos
print(f"\n  INSUMOS (materials, labor, equipment):")
results = search("insumos", ["clave_neodata", "nombre", "unidad", "tipo", "familia"])
for r in results:
    code, name, unit, typ, fam = r[:5]
    score = r[-1]
    fam_s = f" [{fam}]" if fam else ""
    print(f"  {score:.2f}  {code:16s} {name[:50]:50s} {unit:5s} {typ:14s}{fam_s}")

# Search conceptos
print(f"\n  CONCEPTOS (unit prices):")
results = search("conceptos", ["clave_neodata", "nombre", "unidad", "tier"])
for r in results:
    code, name, unit, tiers = r[:4]
    score = r[-1]
    tiers_s = ", ".join(tiers) if tiers else ""
    print(f"  {score:.2f}  {code:16s} {name[:55]:55s} {unit:5s} tiers={tiers_s}")

print()
cur.close()
conn.close()
