"""Embed each lab's focus_text with OpenAI and store in SQLite + sqlite-vec.

Schema:
  labs(lab_id PK, display_name, depts_json, funding_json, clinical_json,
       scholar_json, focus_text, source_blob_json)
  vec_labs(rowid, embedding float[1536])   -- sqlite-vec virtual table

rowid in vec_labs corresponds to ROWID in labs.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import struct
import time
from pathlib import Path

import sqlite_vec
from openai import OpenAI
from tqdm import tqdm

from .common import DATA, log, read_jsonl

DB_PATH = DATA / "catalog.db"
MODEL = "text-embedding-3-small"
DIM = 1536
BATCH = 64


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.enable_load_extension(True)
    sqlite_vec.load(conn)
    conn.enable_load_extension(False)
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(f"""
    CREATE TABLE IF NOT EXISTS labs (
      lab_id TEXT PRIMARY KEY,
      display_name TEXT,
      depts_json TEXT,
      funding_json TEXT,
      clinical_json TEXT,
      scholar_json TEXT,
      focus_text TEXT,
      source_blob_json TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_labs USING vec0(
      embedding float[{DIM}]
    );
    """)
    conn.commit()


def _embed_batch(client: OpenAI, texts: list[str]) -> list[list[float]]:
    delay = 2.0
    for attempt in range(5):
        try:
            r = client.embeddings.create(model=MODEL, input=texts)
            return [d.embedding for d in r.data]
        except Exception as e:
            if attempt == 4:
                raise
            log(f"  embed retry {attempt+1}: {e}")
            time.sleep(delay)
            delay = min(delay * 2, 30.0)
    raise RuntimeError("unreachable")


def _to_blob(vec: list[float]) -> bytes:
    return struct.pack(f"{DIM}f", *vec)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rebuild", action="store_true",
                    help="drop existing tables before rebuilding")
    args = ap.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY not set; export it and rerun")

    catalog = DATA / "catalog.jsonl"
    if not catalog.exists():
        raise SystemExit(f"missing {catalog}; run build_catalog first")

    if args.rebuild and DB_PATH.exists():
        DB_PATH.unlink()

    conn = _connect()
    _init_schema(conn)

    existing = {row[0] for row in conn.execute("SELECT lab_id FROM labs")}
    log(f"existing rows: {len(existing)}")

    client = OpenAI()
    rows = [r for r in read_jsonl(catalog) if r["lab_id"] not in existing]
    log(f"to embed: {len(rows)}")

    for i in tqdm(range(0, len(rows), BATCH), desc="embedding"):
        chunk = rows[i:i + BATCH]
        # OpenAI rejects empty input; substitute display name if focus_text is blank
        texts = [r["focus_text"] or r["display_name"] or r["lab_id"] for r in chunk]
        embeds = _embed_batch(client, texts)
        with conn:
            for r, vec in zip(chunk, embeds):
                cur = conn.execute(
                    """
                    INSERT INTO labs(lab_id, display_name, depts_json, funding_json,
                                     clinical_json, scholar_json, focus_text, source_blob_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        r["lab_id"],
                        r["display_name"],
                        json.dumps(r.get("depts") or []),
                        json.dumps(r.get("funding") or {}),
                        json.dumps(r.get("clinical") or {}),
                        json.dumps(r.get("scholar") or {}),
                        r.get("focus_text") or "",
                        json.dumps({
                            "nih_grants": r.get("nih_grants") or [],
                            "nsf_awards": r.get("nsf_awards") or [],
                            "name_aliases": r.get("name_aliases") or [],
                        }),
                    ),
                )
                row_id = cur.lastrowid
                conn.execute(
                    "INSERT INTO vec_labs(rowid, embedding) VALUES (?, ?)",
                    (row_id, _to_blob(vec)),
                )

    n_labs = conn.execute("SELECT COUNT(*) FROM labs").fetchone()[0]
    n_vecs = conn.execute("SELECT COUNT(*) FROM vec_labs").fetchone()[0]
    log(f"done. labs={n_labs} vectors={n_vecs} -> {DB_PATH}")


if __name__ == "__main__":
    main()
