const MAX_OCR_PAGES = 5;
const MAX_OCR_TEXT_LENGTH = 1_000_000;

export type OcrResult = {
  status: 'Completed' | 'Skipped' | 'Failed';
  text: string | null;
  pages: number;
  error?: string;
};

export async function extractDocumentText(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  if (mimeType === 'text/plain') {
    return { status: 'Completed', text: buffer.toString('utf8').slice(0, MAX_OCR_TEXT_LENGTH), pages: 1 };
  }

  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    return { status: 'Skipped', text: null, pages: 0 };
  }

  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const pages: Buffer[] = [];

    if (mimeType === 'application/pdf') {
      const { pdf } = await import('pdf-to-img');
      const document = await pdf(buffer, { scale: 1.5, format: 'png' });
      let pageCount = 0;
      for await (const page of document) {
        pages.push(page);
        pageCount += 1;
        if (pageCount >= MAX_OCR_PAGES) break;
      }
      await document.destroy();
    } else {
      pages.push(buffer);
    }

    const textParts: string[] = [];
    for (const page of pages) {
      const result = await worker.recognize(page);
      if (result.data.text.trim()) textParts.push(result.data.text.trim());
    }
    await worker.terminate();
    const text = textParts.join('\n\n').slice(0, MAX_OCR_TEXT_LENGTH);
    return { status: 'Completed', text: text || null, pages: pages.length };
  } catch (error: any) {
    return { status: 'Failed', text: null, pages: 0, error: error?.message || 'OCR processing failed.' };
  }
}
