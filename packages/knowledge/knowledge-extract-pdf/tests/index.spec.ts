import { describe, expect, it } from 'vitest'
import { pdfExtractor } from '../src/index.ts'

function tinyPdf(text: string): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`
  objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Uint8Array.from(Buffer.from(pdf))
}

describe('PDF knowledge extractor', () => {
  it('extracts text without detaching the original bytes needed by the store', async () => {
    const bytes = tinyPdf('Curupira PDF funcionando')
    const originalLength = bytes.byteLength
    const result = await pdfExtractor.extract(bytes)
    expect(result.text).toContain('Curupira PDF funcionando')
    expect(result.regions).toEqual([{ start: 0, end: 24, locator: 'p. 1' }])
    expect(bytes.byteLength).toBe(originalLength)
  })
})
