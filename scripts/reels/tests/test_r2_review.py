from __future__ import annotations

import sys
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace


REELS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REELS_DIR))

from publish_review import publish_after_validation
from review_metadata import D1Config
from storage import R2Config, UploadedGeneration, build_object_keys, generate_generation_id, upload_generation


class FakeS3:
    def __init__(self):
        self.uploads = []

    def upload_file(self, filename, bucket, key, ExtraArgs):
        self.uploads.append((filename, bucket, key, ExtraArgs))


class R2ReviewTests(unittest.TestCase):
    def test_generation_id_tem_timestamp_e_identificador_curto(self):
        value = generate_generation_id(datetime(2026, 8, 13, 10, 11, 12, tzinfo=UTC), "a1b2c3d4")
        self.assertEqual(value, "20260813T101112Z-a1b2c3d4")

    def test_regeneracao_cria_id_diferente(self):
        self.assertNotEqual(generate_generation_id(), generate_generation_id())

    def test_constroi_keys_sem_sobrescrever_geracoes(self):
        keys = build_object_keys("vizinho-barulhento", "20260813T101112Z-a1b2c3d4")
        self.assertEqual(keys.video_key, "reels/vizinho-barulhento/20260813T101112Z-a1b2c3d4/video.mp4")
        self.assertTrue(keys.contact_key.endswith("/contact.jpg"))
        self.assertTrue(keys.json_key.endswith("/reel.json"))

    def test_falta_de_credenciais_falha_antes_do_upload(self):
        with self.assertRaisesRegex(ValueError, "R2_ACCESS_KEY_ID"):
            R2Config.from_env({"CLOUDFLARE_ACCOUNT_ID": "account"})
        with self.assertRaisesRegex(ValueError, "CLOUDFLARE_D1_DATABASE_ID"):
            D1Config.from_env({"CLOUDFLARE_ACCOUNT_ID": "account"})

    def test_upload_mockado_publica_os_tres_objetos(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = [root / "video.mp4", root / "contact.jpg", root / "reel.json"]
            for path in paths:
                path.write_bytes(b"ok")
            client = FakeS3()
            config = R2Config("account", "access", "secret", "bucket", "https://endpoint")
            result = upload_generation(
                slug="teste", generation_id="g1", video=paths[0], contact=paths[1], reel_json=paths[2],
                config=config, client=client,
            )
            self.assertEqual(len(client.uploads), 3)
            self.assertEqual(result.video_key, "reels/teste/g1/video.mp4")

    def test_metadata_pending_review_so_e_criada_depois_da_validacao_e_upload(self):
        registered = []
        result = publish_after_validation(
            slug="teste", generation_id="g1", reel_json=Path("reel.json"), video=Path("video.mp4"),
            contact=Path("contact.jpg"), validator=lambda *_: {"template": "ordered_steps"},
            uploader=lambda **_: UploadedGeneration("g1", "v", "c", "j"), registrar=registered.append,
            article_reader=lambda *_: SimpleNamespace(
                title="Artigo acabado de publicar",
                canonical_url="https://guiadoproprietario.pt/casa/artigo-acabado-de-publicar/",
            ),
            publication_sha="a" * 40,
        )
        self.assertEqual(result["status"], "pending_review")
        self.assertEqual(registered[0].status, "pending_review")
        self.assertEqual(registered[0].article_title, "Artigo acabado de publicar")
        self.assertEqual(
            registered[0].article_url,
            "https://guiadoproprietario.pt/casa/artigo-acabado-de-publicar/",
        )
        self.assertEqual(registered[0].publication_sha, "a" * 40)

    def test_falha_no_render_nao_faz_upload(self):
        uploads = []
        with self.assertRaisesRegex(RuntimeError, "render"):
            publish_after_validation(
                slug="teste", generation_id="g1", reel_json=Path("x"), video=Path("y"), contact=Path("z"),
                validator=lambda *_: (_ for _ in ()).throw(RuntimeError("render inválido")),
                uploader=lambda **kwargs: uploads.append(kwargs), registrar=lambda _: None,
            )
        self.assertEqual(uploads, [])

    def test_falha_no_upload_nao_cria_metadata_aprovada(self):
        registered = []
        with self.assertRaisesRegex(RuntimeError, "R2"):
            publish_after_validation(
                slug="teste", generation_id="g1", reel_json=Path("x"), video=Path("y"), contact=Path("z"),
                validator=lambda *_: {"template": "ordered_steps"},
                uploader=lambda **_: (_ for _ in ()).throw(RuntimeError("R2 indisponível")),
                registrar=registered.append,
            )
        self.assertEqual(registered, [])


if __name__ == "__main__":
    unittest.main()
