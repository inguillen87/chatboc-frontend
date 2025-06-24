export type AttachmentType = 'image' | 'pdf' | 'spreadsheet' | 'other'

export interface AttachmentInfo {
  url: string
  type: AttachmentType
  extension: string
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const PDF_EXTS = ['pdf']
const SPREADSHEET_EXTS = ['xls', 'xlsx', 'csv']

export function getAttachmentInfo(text: string): AttachmentInfo | null {
  try {
    const url = new URL(text)
    const match = url.pathname.match(/\.([a-zA-Z0-9]+)$/)
    if (!match) return null
    const ext = match[1].toLowerCase()
    if (IMAGE_EXTS.includes(ext)) return { url: text, type: 'image', extension: ext }
    if (PDF_EXTS.includes(ext)) return { url: text, type: 'pdf', extension: ext }
    if (SPREADSHEET_EXTS.includes(ext)) return { url: text, type: 'spreadsheet', extension: ext }
    return { url: text, type: 'other', extension: ext }
  } catch {
    return null
  }
}
