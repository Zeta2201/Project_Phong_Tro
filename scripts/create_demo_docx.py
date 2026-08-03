from html import escape
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "KICH_BAN_DEMO_PROJECT.md"
OUTPUT = ROOT / "KICH_BAN_DEMO_PROJECT.docx"


def paragraph(text="", style=None, align=None):
    ppr = []
    if style:
        ppr.append(f'<w:pStyle w:val="{style}"/>')
    if align:
        ppr.append(f'<w:jc w:val="{align}"/>')
    ppr_xml = f"<w:pPr>{''.join(ppr)}</w:pPr>" if ppr else ""
    return f"<w:p>{ppr_xml}{runs_from_markdown(text)}</w:p>"


def run(text, bold=False, italic=False, size=None, color=None):
    props = []
    if bold:
        props.append("<w:b/>")
    if italic:
        props.append("<w:i/>")
    if size:
        props.append(f'<w:sz w:val="{size * 2}"/>')
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    props.append('<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>')
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>"
    return f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def runs_from_markdown(text):
    parts = text.split("**")
    xml = []
    for index, part in enumerate(parts):
        if part:
            xml.append(run(part, bold=index % 2 == 1))
    return "".join(xml)


def number_paragraph(text, num_id, ilvl=0):
    return (
        "<w:p>"
        f'<w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="{ilvl}"/>'
        f'<w:numId w:val="{num_id}"/></w:numPr></w:pPr>'
        f"{runs_from_markdown(text)}"
        "</w:p>"
    )


def parse_markdown():
    body = [
        paragraph("KICH BAN DEMO PROJECT NESTFINDER", style="Title", align="center"),
        paragraph("Website tim kiem va quan ly phong tro", style="Subtitle", align="center"),
    ]
    first_heading_skipped = False

    for raw in SOURCE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue

        if line.startswith("# "):
            if not first_heading_skipped:
                first_heading_skipped = True
                continue
            body.append(paragraph(line[2:].strip(), style="Heading1"))
        elif line.startswith("## "):
            body.append(paragraph(line[3:].strip(), style="Heading1"))
        elif line.startswith("### "):
            body.append(paragraph(line[4:].strip(), style="Heading2"))
        elif line.startswith("- "):
            body.append(number_paragraph(line[2:].strip(), num_id=1))
        elif ". " in line and line.split(". ", 1)[0].isdigit():
            body.append(number_paragraph(line.split(". ", 1)[1].strip(), num_id=2))
        else:
            body.append(paragraph(line))

    return "\n".join(body)


def content_types():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""


def root_rels():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""


def document_rels():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>"""


def styles():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="160" w:after="80"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="44"/><w:color w:val="000000"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:after="360"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:i/><w:sz w:val="26"/><w:color w:val="595959"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="360" w:after="200"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="32"/><w:color w:val="2E74B5"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="280" w:after="140"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="26"/><w:color w:val="2E74B5"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr>
  </w:style>
</w:styles>"""


def numbering():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="540" w:hanging="270"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="2">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="540" w:hanging="270"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>"""


def document_xml():
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    {parse_markdown()}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""


def core_props():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Kich ban demo project NestFinder</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
</cp:coreProperties>"""


def app_props():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
</Properties>"""


def main():
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types())
        docx.writestr("_rels/.rels", root_rels())
        docx.writestr("word/_rels/document.xml.rels", document_rels())
        docx.writestr("word/document.xml", document_xml())
        docx.writestr("word/styles.xml", styles())
        docx.writestr("word/numbering.xml", numbering())
        docx.writestr("docProps/core.xml", core_props())
        docx.writestr("docProps/app.xml", app_props())
    print(OUTPUT.name)


if __name__ == "__main__":
    main()
