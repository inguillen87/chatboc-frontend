from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from pypdf import PdfReader, PdfWriter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "tdf_disability_proposal.html"
OUTPUT = ROOT / "output" / "pdf" / "propuesta-ejecutiva-agente-ia-discapacidad-tdf.pdf"
PUBLIC_OUTPUT = ROOT / "public" / "propuestas" / OUTPUT.name
RENDERER = ROOT / "scripts" / "render_tagged_pdf.mjs"
TEMP_RENDER = ROOT / "tmp" / "pdfs" / "tdf-disability-proposal-chromium.pdf"
AUTHOR = "Marcelo Guillén, Ingeniero en Informática y Telecomunicaciones, fundador y CEO de Inmovar Latam"


def build_pdf(output: Path = OUTPUT) -> Path:
    """Render the semantic proposal with Chromium's accessible PDF structure."""
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing semantic proposal source: {SOURCE}")
    if not RENDERER.exists():
        raise FileNotFoundError(f"Missing tagged PDF renderer: {RENDERER}")

    output.parent.mkdir(parents=True, exist_ok=True)
    TEMP_RENDER.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            ["node", str(RENDERER), str(SOURCE), str(TEMP_RENDER)],
            cwd=ROOT,
            check=True,
            stdout=subprocess.DEVNULL,
        )

        reader = PdfReader(TEMP_RENDER)
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        writer.add_metadata(
            {
                "/Title": "Propuesta ejecutiva | Agente de IA Accesible y Mesa Única",
                "/Author": AUTHOR,
                "/Subject": "MVP accesible de WhatsApp y CRM para la Mesa Única de Discapacidad de Tierra del Fuego",
                "/Keywords": "Agente de IA, accesibilidad, discapacidad, Tierra del Fuego, WhatsApp, CRM, Mesa Única",
            }
        )
        with output.open("wb") as stream:
            writer.write(stream)
    finally:
        TEMP_RENDER.unlink(missing_ok=True)

    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(output, PUBLIC_OUTPUT)
    return output


if __name__ == "__main__":
    generated = build_pdf()
    print(generated)
    print(PUBLIC_OUTPUT)
