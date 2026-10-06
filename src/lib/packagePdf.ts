import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Requirement, Tender, UploadedFile } from "./tender";

export interface PackageEntry {
  req: Requirement;
  file: UploadedFile;
}

const MARGIN = 56;
const FOOTER_Y = 28;

function drawFooter(
  page: { drawText: (t: string, o: object) => void; getSize: () => { width: number; height: number } },
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  text: string
) {
  const { width } = page.getSize();
  const size = 9;
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (width - w) / 2,
    y: FOOTER_Y,
    size,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
}

export async function buildPackagePdf(opts: {
  tender: Tender;
  entries: PackageEntry[]; // already sorted by req.order, only entries with files
  includeIndex: boolean;
  generatedOn: string; // YYYY-MM-DD
}): Promise<Uint8Array> {
  const { tender, entries, includeIndex, generatedOn } = opts;
  const out = await PDFDocument.create();
  const helvetica = await out.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await out.embedFont(StandardFonts.HelveticaBold);

  // ---- Cover page ----
  const cover = out.addPage([595.28, 841.89]); // A4
  const { width: cw } = cover.getSize();
  let y = 780;
  const center = (text: string, size: number, font = helvetica, dy = 26) => {
    const w = font.widthOfTextAtSize(text, size);
    cover.drawText(text, { x: (cw - w) / 2, y, size, font, color: rgb(0.1, 0.1, 0.1) });
    y -= dy;
  };
  center("TENDER SUBMISSION PACKAGE", 20, helveticaBold, 48);
  center(`Tender ID: ${tender.tender_id}`, 13, helveticaBold, 24);
  center(tender.title, 13, helvetica, 24);
  center(`Procuring Entity: ${tender.procuring_entity}`, 12, helvetica, 20);
  center(`Bidder: ${tender.bidder}`, 12, helvetica, 20);
  center(`Submission Deadline: ${tender.submission_deadline}`, 12, helvetica, 20);
  center(`Package Generated: ${generatedOn}`, 12, helvetica, 40);
  center("Included Documents", 14, helveticaBold, 24);
  entries.forEach((e, i) => {
    center(`${i + 1}. ${e.req.title_en}`, 11, helvetica, 18);
  });

  // ---- Copy document pages ----
  const docStartPages: number[] = []; // 1-based page numbers in final package
  let cursor = 1; // cover is page 1
  if (includeIndex) cursor += 1;

  for (const e of entries) {
    docStartPages.push(cursor + 1);
    const src = await PDFDocument.load(e.file.bytes.slice(0), {
      ignoreEncryption: true,
    });
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
    cursor += pages.length;
  }

  // ---- Index page (inserted at position 2) ----
  if (includeIndex) {
    const idx = out.insertPage(1, [595.28, 841.89]);
    let iy = 780;
    const iw = helveticaBold.widthOfTextAtSize("Index", 18);
    idx.drawText("Index", { x: (595.28 - iw) / 2, y: iy, size: 18, font: helveticaBold });
    iy -= 44;
    entries.forEach((e, i) => {
      const label = `${i + 1}. ${e.req.title_en}`;
      const pageNo = String(docStartPages[i]);
      idx.drawText(label, { x: MARGIN, y: iy, size: 11, font: helvetica });
      const pw = helvetica.widthOfTextAtSize(pageNo, 11);
      idx.drawText(pageNo, { x: 595.28 - MARGIN - pw, y: iy, size: 11, font: helvetica });
      iy -= 20;
    });
  }

  // ---- Footers on every page ----
  const total = out.getPageCount();
  out.getPages().forEach((p, i) => {
    drawFooter(p, helvetica, `${tender.tender_id} | Page ${i + 1} of ${total}`);
  });

  return out.save();
}
