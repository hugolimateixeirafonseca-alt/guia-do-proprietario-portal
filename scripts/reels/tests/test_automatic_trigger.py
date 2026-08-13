from __future__ import annotations

import sqlite3
import sys
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


REELS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REELS_DIR))

from automatic_trigger import claim_initial_trigger, complete_initial_trigger, fail_initial_trigger


class SQLiteQuery:
    def __init__(self):
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.execute("""CREATE TABLE reel_initial_triggers (
            slug TEXT PRIMARY KEY, publication_sha TEXT NOT NULL, state TEXT NOT NULL,
            claimed_at TEXT NOT NULL, completed_at TEXT, failed_at TEXT,
            generation_id TEXT, error TEXT
        )""")
        self.lock = threading.Lock()

    def __call__(self, sql: str, params: list[str | None]) -> int:
        with self.lock:
            before = self.connection.total_changes
            self.connection.execute(sql, params)
            self.connection.commit()
            return self.connection.total_changes - before

    def row(self, slug: str):
        return self.connection.execute(
            "SELECT slug, publication_sha, state, generation_id, error FROM reel_initial_triggers WHERE slug = ?",
            [slug],
        ).fetchone()


class AutomaticTriggerTests(unittest.TestCase):
    def test_check_duplicado_e_idempotencia_concorrente(self):
        database = SQLiteQuery()
        with ThreadPoolExecutor(max_workers=12) as executor:
            results = list(executor.map(
                lambda _: claim_initial_trigger("novo", "a" * 40, query=database, claimed_at="now"),
                range(24),
            ))
        self.assertEqual(results.count(True), 1)
        self.assertEqual(results.count(False), 23)

    def test_completa_com_generation_id(self):
        database = SQLiteQuery()
        self.assertTrue(claim_initial_trigger("novo", "a" * 40, query=database, claimed_at="claimed"))
        self.assertTrue(complete_initial_trigger(
            "novo", "a" * 40, "generation-1", query=database, completed_at="completed",
        ))
        self.assertEqual(database.row("novo"), ("novo", "a" * 40, "completed", "generation-1", None))

    def test_tentativa_falhada_nao_tem_retry_automatico(self):
        database = SQLiteQuery()
        self.assertTrue(claim_initial_trigger("novo", "a" * 40, query=database, claimed_at="claimed"))
        self.assertTrue(fail_initial_trigger(
            "novo", "a" * 40, "generation_failed", "generation-1", query=database, failed_at="failed",
        ))
        self.assertFalse(claim_initial_trigger("novo", "b" * 40, query=database, claimed_at="later"))
        self.assertEqual(
            database.row("novo"),
            ("novo", "a" * 40, "failed", "generation-1", "generation_failed"),
        )


if __name__ == "__main__":
    unittest.main()
