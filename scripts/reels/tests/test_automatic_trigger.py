from __future__ import annotations

import sqlite3
import sys
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


REELS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REELS_DIR))

from automatic_trigger import (
    claim_initial_trigger,
    complete_initial_trigger,
    describe_initial_trigger,
    fail_initial_trigger,
)


class SQLiteQuery:
    def __init__(self):
        self.connection = sqlite3.connect(":memory:", check_same_thread=False)
        self.connection.execute("""CREATE TABLE reel_initial_triggers (
            slug TEXT PRIMARY KEY, publication_sha TEXT NOT NULL, state TEXT NOT NULL,
            claimed_at TEXT NOT NULL, completed_at TEXT, failed_at TEXT,
            generation_id TEXT, error TEXT
        )""")
        self.connection.execute("""CREATE TABLE reel_generations (
            generation_id TEXT PRIMARY KEY,
            slug TEXT NOT NULL,
            status TEXT NOT NULL
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

    def add_generation(self, generation_id: str, slug: str, status: str) -> None:
        self.connection.execute(
            "INSERT INTO reel_generations (generation_id, slug, status) VALUES (?, ?, ?)",
            [generation_id, slug, status],
        )
        self.connection.commit()


class AutomaticTriggerTests(unittest.TestCase):
    def test_repository_dispatch_duplicado_e_idempotencia_concorrente(self):
        database = SQLiteQuery()
        with ThreadPoolExecutor(max_workers=12) as executor:
            results = list(executor.map(
                lambda _: claim_initial_trigger(
                    "novo", "a" * 40, query=database, claimed_at="2026-08-26 10:00:00"
                ),
                range(24),
            ))
        self.assertEqual(results.count(True), 1)
        self.assertEqual(results.count(False), 23)

    def test_push_e_repository_dispatch_do_mesmo_artigo_criam_uma_reserva(self):
        database = SQLiteQuery()
        publication_sha = "a" * 40
        self.assertTrue(claim_initial_trigger(
            "novo", publication_sha, query=database, claimed_at="2026-08-26 10:00:00"
        ))
        self.assertFalse(claim_initial_trigger(
            "novo", publication_sha, query=database, claimed_at="2026-08-26 10:05:00"
        ))
        self.assertEqual(database.row("novo"), ("novo", publication_sha, "claimed", None, None))

    def test_slug_nao_e_reaberto_por_outro_sha(self):
        database = SQLiteQuery()
        self.assertTrue(claim_initial_trigger(
            "novo", "a" * 40, query=database, claimed_at="2026-08-26 10:00:00"
        ))
        self.assertTrue(fail_initial_trigger(
            "novo", "a" * 40, "generation_failed", "generation-1",
            query=database, failed_at="2026-08-26 10:01:00",
        ))
        self.assertFalse(claim_initial_trigger(
            "novo", "b" * 40, query=database, claimed_at="2026-08-26 11:00:00"
        ))
        self.assertEqual(
            database.row("novo"),
            ("novo", "a" * 40, "failed", "generation-1", "generation_failed"),
        )

    def test_falha_do_mesmo_sha_pode_ser_recuperada(self):
        database = SQLiteQuery()
        sha = "a" * 40
        self.assertTrue(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 10:00:00"
        ))
        self.assertTrue(fail_initial_trigger(
            "novo", sha, "generate_json_failed", "generation-1",
            query=database, failed_at="2026-08-26 10:01:00",
        ))
        self.assertTrue(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 10:02:00"
        ))
        self.assertEqual(database.row("novo"), ("novo", sha, "claimed", None, None))

    def test_claim_fresco_bloqueia_e_claim_abandonado_recupera(self):
        database = SQLiteQuery()
        sha = "a" * 40
        self.assertTrue(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 09:45:00"
        ))
        self.assertFalse(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 10:00:00"
        ))
        self.assertTrue(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 10:16:00"
        ))

    def test_generation_valida_bloqueia_repeticao_mesmo_sem_complete(self):
        database = SQLiteQuery()
        sha = "a" * 40
        self.assertTrue(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 09:00:00"
        ))
        database.add_generation("generation-1", "novo", "pending_review")
        self.assertFalse(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 10:00:00"
        ))
        self.assertEqual(database.row("novo"), ("novo", sha, "claimed", None, None))

    def test_generation_valida_preexistente_impede_novo_trigger(self):
        database = SQLiteQuery()
        database.add_generation("generation-1", "novo", "approved")
        self.assertFalse(claim_initial_trigger(
            "novo", "a" * 40, query=database, claimed_at="2026-08-26 10:00:00"
        ))
        self.assertIsNone(database.row("novo"))

    def test_completed_sem_generation_real_e_autocorrigido(self):
        database = SQLiteQuery()
        sha = "a" * 40
        self.assertTrue(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 09:00:00"
        ))
        self.assertTrue(complete_initial_trigger(
            "novo", sha, "generation-missing", query=database, completed_at="2026-08-26 09:05:00",
        ))
        self.assertTrue(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 09:06:00"
        ))
        self.assertEqual(database.row("novo"), ("novo", sha, "claimed", None, None))

    def test_completed_com_generation_falhada_e_autocorrigido(self):
        database = SQLiteQuery()
        sha = "a" * 40
        self.assertTrue(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 09:00:00"
        ))
        database.add_generation("generation-1", "novo", "generation_failed")
        self.assertTrue(complete_initial_trigger(
            "novo", sha, "generation-1", query=database, completed_at="2026-08-26 09:05:00",
        ))
        self.assertTrue(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 09:06:00"
        ))

    def test_completed_com_pending_review_nao_duplica(self):
        database = SQLiteQuery()
        sha = "a" * 40
        self.assertTrue(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 09:00:00"
        ))
        database.add_generation("generation-1", "novo", "pending_review")
        self.assertTrue(complete_initial_trigger(
            "novo", sha, "generation-1", query=database, completed_at="2026-08-26 09:05:00",
        ))
        self.assertFalse(claim_initial_trigger(
            "novo", sha, query=database, claimed_at="2026-08-26 11:00:00"
        ))
        self.assertEqual(database.row("novo"), ("novo", sha, "completed", "generation-1", None))

    def test_status_distingue_claim_recente_sem_generation_valida(self):
        sha = "a" * 40
        responses = iter([
            [{
                "slug": "novo",
                "publication_sha": sha,
                "state": "claimed",
                "claimed_at": "2026-08-26T11:10:00+00:00",
                "completed_at": None,
                "failed_at": None,
                "generation_id": None,
                "error": None,
            }],
            [{
                "generation_id": "failed-1",
                "status": "generation_failed",
                "created_at": "2026-08-26T11:05:00+00:00",
                "publication_sha": None,
            }],
        ])
        result = describe_initial_trigger("novo", sha, fetch=lambda _sql, _params: next(responses))
        self.assertEqual(result["block_reason"], "active_or_recent_claim")
        self.assertEqual(result["valid_generation_count"], 0)
        self.assertEqual(result["trigger"]["claimed_at"], "2026-08-26T11:10:00+00:00")

    def test_status_distingue_generation_valida(self):
        sha = "a" * 40
        responses = iter([
            [{
                "slug": "novo",
                "publication_sha": sha,
                "state": "claimed",
                "claimed_at": "2026-08-26T11:10:00+00:00",
                "completed_at": None,
                "failed_at": None,
                "generation_id": None,
                "error": None,
            }],
            [{
                "generation_id": "review-1",
                "status": "pending_review",
                "created_at": "2026-08-26T11:12:00+00:00",
                "publication_sha": sha,
            }],
        ])
        result = describe_initial_trigger("novo", sha, fetch=lambda _sql, _params: next(responses))
        self.assertEqual(result["block_reason"], "valid_generation_exists")
        self.assertEqual(result["valid_generation_count"], 1)
        self.assertEqual(result["latest_generations"][0]["status"], "pending_review")
        self.assertNotIn("video_key", result["latest_generations"][0])


if __name__ == "__main__":
    unittest.main()
