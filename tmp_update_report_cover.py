import shutil
import tempfile
import zipfile
from pathlib import Path

docx_path = Path(
    r"c:\Users\quang\Downloads\amazon product recommendation\Amazon_Product_Recommendation_System_Report.docx"
)
pdf_path = docx_path.with_suffix(".pdf")
backup = docx_path.with_suffix(".docx.bak")

if not backup.exists():
    shutil.copy2(docx_path, backup)

old = (
    "<w:p><w:pPr><w:jc w:val=\"center\"/></w:pPr>"
    "<w:r><w:t>Prepared for submission</w:t></w:r></w:p>"
)
new = (
    "<w:p><w:pPr><w:jc w:val=\"center\"/></w:pPr>"
    "<w:r><w:t>Quang Le</w:t></w:r></w:p>"
    "<w:p><w:pPr><w:jc w:val=\"center\"/></w:pPr>"
    "<w:r><w:t>Project: Amazon Product Recommendation System</w:t></w:r></w:p>"
)

tmpdir = Path(tempfile.mkdtemp())
with zipfile.ZipFile(docx_path, "r") as zin:
    zin.extractall(tmpdir)

xml_path = tmpdir / "word" / "document.xml"
xml = xml_path.read_text(encoding="utf-8")
if old not in xml:
    raise SystemExit("Expected text block not found in document.xml")
xml_path.write_text(xml.replace(old, new, 1), encoding="utf-8")

with zipfile.ZipFile(docx_path, "w", zipfile.ZIP_DEFLATED) as zout:
    for file_path in sorted(tmpdir.rglob("*")):
        if file_path.is_file():
            zout.write(file_path, file_path.relative_to(tmpdir).as_posix())

print("DOCX updated")

try:
    from docx2pdf import convert

    convert(str(docx_path), str(pdf_path))
    print(f"PDF regenerated: {pdf_path}")
except Exception as exc:
    print(f"PDF auto-export failed: {exc}")
    print("DOCX is updated; open in Word and Save As PDF if needed.")
