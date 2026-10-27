"""Package the static site for the existing GitHub Pages workflow.

Only allowlisted public web assets are included. Keys, local settings,
test outputs and Git metadata are never part of the deployment archive.
"""
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "小欧实训室_GitHubPages_网站包.zip"
PUBLIC_ROOT_FILES = ["index.html", "knowledge.html", ".nojekyll", "README.md"]
PUBLIC_FOLDERS = ["assets", "knowledge", "classic"]

def main():
    files = [ROOT / name for name in PUBLIC_ROOT_FILES]
    for folder in PUBLIC_FOLDERS:
        files.extend(path for path in (ROOT / folder).rglob("*") if path.is_file())
    for path in files:
        if not path.exists():
            raise FileNotFoundError(path)
        if any(part.startswith(".env") or part in {".git", "node_modules", "__pycache__"} for part in path.relative_to(ROOT).parts):
            raise ValueError("Refusing to package non-public configuration")
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(files):
            archive.write(path, path.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(OUTPUT) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("Archive failed validation")
    print(f"Packaged {len(files)} public files: {OUTPUT.name} ({OUTPUT.stat().st_size:,} bytes)")

if __name__ == "__main__":
    main()
