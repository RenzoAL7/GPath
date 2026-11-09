import { detectSkills } from '../../shared/skills.mjs'

export type CvSkill = { name: string; line: string | null; example: boolean }

/** Only this summary stays in memory. The file and its full text are discarded. */
export type CvProfile = {
  source: 'pdf' | 'manual'
  label: string
  skills: CvSkill[]
}

export class CvReadError extends Error {}

const maxCvBytes = 2_000_000
const maxPages = 15
const minimumTextLength = 40

function formatSize(bytes: number) {
  return bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`
}

async function extractText(data: Uint8Array) {
  // Loaded on demand: only people who add a CV download the PDF reader.
  const [pdfjs, { default: PdfWorker }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?worker'),
  ])
  const worker = new PdfWorker()
  pdfjs.GlobalWorkerOptions.workerPort = worker
  const task = pdfjs.getDocument({ data, disableFontFace: true })
  try {
    const document = await task.promise
    let text = ''
    for (let number = 1; number <= Math.min(document.numPages, maxPages); number++) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      for (const item of content.items)
        if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ')
      text += '\n'
    }
    return text
  } catch (reason) {
    if (reason instanceof Error && reason.name === 'PasswordException')
      throw new CvReadError(
        'Tu CV tiene contraseña. Súbelo sin protección o escribe tus habilidades.',
      )
    throw new CvReadError(
      'No pudimos abrir ese PDF. Prueba con otro archivo o escribe tus habilidades.',
    )
  } finally {
    await task.destroy()
    worker.terminate()
  }
}

export async function readCvFile(file: File): Promise<CvProfile> {
  if (file.size > maxCvBytes)
    throw new CvReadError(
      'Tu CV pesa más de 2 MB. Exporta una versión más liviana o escribe tus habilidades.',
    )
  const data = new Uint8Array(await file.arrayBuffer())
  if (String.fromCharCode(...data.subarray(0, 5)) !== '%PDF-')
    throw new CvReadError('Ese archivo no es un PDF. Elige un PDF o escribe tus habilidades.')
  const text = await extractText(data)
  if (text.replace(/\s+/g, '').length < minimumTextLength)
    throw new CvReadError(
      'Parece un PDF escaneado. Sube un PDF con texto o escribe tus habilidades.',
    )
  const skills = detectSkills(text)
  if (!skills.length)
    throw new CvReadError(
      'No reconocimos habilidades técnicas en tu CV. Escríbelas para compararlas.',
    )
  return { source: 'pdf', label: `${file.name} · ${formatSize(file.size)}`, skills }
}

export function profileFromSkills(value: string): CvProfile {
  const skills = detectSkills(value).map(({ name }) => ({ name, line: null, example: false }))
  if (!skills.length)
    throw new CvReadError(
      'No reconocimos esas habilidades. Prueba con nombres como SQL, Excel o Python.',
    )
  return { source: 'manual', label: 'Habilidades que escribiste', skills }
}
