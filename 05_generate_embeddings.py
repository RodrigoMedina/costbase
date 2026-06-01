import os, sys, json, time
import psycopg2
import psycopg2.extras
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
PG_URL = os.getenv("DATABASE_URL")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = "text-embedding-3-small"
BATCH_SIZE = 200

def embed_texts(texts):
    texts = [t[:8000] for t in texts]
    resp = client.embeddings.create(model=MODEL, input=texts)
    return [d.embedding for d in resp.data]

def process_table(table, id_col, text_col, text_fn, where=""):
    conn = psycopg2.connect(PG_URL)
    cur = conn.cursor()
    cur.execute(f"SELECT {table}.{id_col}, {text_col} FROM {table} WHERE {table}.embedding IS NULL {where} ORDER BY 1")
    rows = cur.fetchall()
    if not rows:
        print(f"  {table}: all already embedded")
        cur.close()
        conn.close()
        return
    print(f"  {table}: {len(rows)} to embed")
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i+BATCH_SIZE]
        texts = [text_fn(r) for r in batch]
        try:
            embeddings = embed_texts(texts)
        except Exception as e:
            print(f"    error at row {i}: {e}")
            time.sleep(5)
            continue
        vals = [(emb, rid) for rid, emb in zip([r[0] for r in batch], embeddings)]
        psycopg2.extras.execute_values(cur, f"UPDATE {table} SET embedding = v.emb::vector FROM (VALUES %s) AS v(emb, id) WHERE {table}.{id_col} = v.id::uuid", vals)
        conn.commit()
        print(f"    {min(i+BATCH_SIZE, len(rows)):,}/{len(rows):,}", end="\r", flush=True)
    print()
    cur.close()
    conn.close()

print("Generating embeddings...")

print("\nInsumos:")
process_table("insumos", "id", "nombre, tipo, unidad, COALESCE(familia, 'general')",
    lambda r: f"Insumo de construccion: {r[1]}. Tipo: {r[2]}. Unidad: {r[3]}. Familia: {r[4]}",
    "")

print("\nConceptos:")
process_table("conceptos", "id", "nombre, unidad, COALESCE(tier::text, 'general')",
    lambda r: f"Concepto de obra: {r[1]}. Unidad: {r[2]}. Aplicable a: {r[3]}",
    "")

print("\nDone!")
