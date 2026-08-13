from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REELS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REELS_DIR))

from detect_new_publications import detect_new_publications


def article(title: str, *, draft: bool = False, body: str = "Texto") -> str:
    return f"---\ntitulo: {title}\nrascunho: {'true' if draft else 'false'}\n---\n\n{body}\n"


class GitRepository:
    def __init__(self, root: Path):
        self.root = root
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Tests")
        self.git("config", "user.email", "tests@example.com")

    def git(self, *args: str) -> str:
        return subprocess.run(
            ["git", "-C", str(self.root), *args], check=True, capture_output=True, text=True,
        ).stdout.strip()

    def write(self, relative: str, content: str) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def commit(self, message: str) -> str:
        self.git("add", "-A")
        self.git("commit", "-m", message)
        return self.git("rev-parse", "HEAD")


class DetectNewPublicationsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.repo = GitRepository(Path(self.temporary.name))
        self.repo.write("README.md", "base\n")
        self.base = self.repo.commit("base")

    def tearDown(self):
        self.temporary.cleanup()

    def detect(self, sha: str) -> list[str]:
        return detect_new_publications(self.repo.root, sha).slugs

    def test_movimento_de_por_publicar_para_artigos(self):
        self.repo.write("src/content/por-publicar/novo.mdx", article("Novo"))
        self.repo.commit("rascunho editorial")
        (self.repo.root / "src/content/artigos").mkdir(parents=True, exist_ok=True)
        self.repo.git("mv", "src/content/por-publicar/novo.mdx", "src/content/artigos/novo.mdx")
        self.assertEqual(self.detect(self.repo.commit("publicar")), ["novo"])

    def test_adicao_manual_direta(self):
        self.repo.write("src/content/artigos/direto.mdx", article("Direto"))
        self.assertEqual(self.detect(self.repo.commit("publicar diretamente")), ["direto"])

    def test_edicao_de_artigo_existente(self):
        self.repo.write("src/content/artigos/existente.mdx", article("Existente"))
        self.repo.commit("publicar")
        self.repo.write("src/content/artigos/existente.mdx", article("Existente", body="Revisto"))
        self.assertEqual(self.detect(self.repo.commit("editar")), [])

    def test_rename_entre_artigos_publicados(self):
        self.repo.write("src/content/artigos/antigo.mdx", article("Antigo"))
        self.repo.commit("publicar")
        self.repo.git("mv", "src/content/artigos/antigo.mdx", "src/content/artigos/novo-slug.mdx")
        self.assertEqual(self.detect(self.repo.commit("renomear")), [])

    def test_rascunho_nao_e_publicacao(self):
        self.repo.write("src/content/artigos/rascunho.mdx", article("Rascunho", draft=True))
        self.assertEqual(self.detect(self.repo.commit("guardar rascunho")), [])

    def test_varios_artigos(self):
        self.repo.write("src/content/artigos/um.mdx", article("Um"))
        self.repo.write("src/content/artigos/dois.mdx", article("Dois"))
        self.assertEqual(self.detect(self.repo.commit("publicar dois")), ["dois", "um"])

    def test_alteracao_tecnica(self):
        self.repo.write("scripts/tecnico.py", "print('ok')\n")
        self.assertEqual(self.detect(self.repo.commit("tecnico")), [])

    def test_delete_e_add_quando_git_nao_deteta_rename(self):
        self.repo.write("src/content/por-publicar/mudado.mdx", article("Inicial", body="A" * 500))
        self.repo.commit("rascunho editorial")
        (self.repo.root / "src/content/por-publicar/mudado.mdx").unlink()
        self.repo.write("src/content/artigos/mudado.mdx", article("Final", body="Conteúdo totalmente diferente"))
        self.assertEqual(self.detect(self.repo.commit("publicar reescrito")), ["mudado"])

    def test_merge_commit_usa_primeiro_parent(self):
        self.repo.git("checkout", "-b", "conteudo")
        self.repo.write("src/content/artigos/merge.mdx", article("Merge"))
        self.repo.commit("artigo no ramo")
        self.repo.git("checkout", "main")
        self.repo.write("tecnico.txt", "mudança paralela\n")
        self.repo.commit("mudanca main")
        self.repo.git("merge", "--no-ff", "conteudo", "-m", "merge")
        sha = self.repo.git("rev-parse", "HEAD")
        self.assertEqual(self.detect(sha), ["merge"])

    def test_artigo_removido_e_restaurado_nao_e_novo(self):
        self.repo.write("src/content/artigos/restaurado.mdx", article("Restaurado"))
        self.repo.commit("publicar")
        (self.repo.root / "src/content/artigos/restaurado.mdx").unlink()
        self.repo.commit("remover")
        self.repo.write("src/content/artigos/restaurado.mdx", article("Restaurado"))
        self.assertEqual(self.detect(self.repo.commit("restaurar")), [])


if __name__ == "__main__":
    unittest.main()
