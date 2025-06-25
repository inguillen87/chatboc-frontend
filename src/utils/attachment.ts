export type AttachmentType = 'image' | 'pdf' | 'spreadsheet' | 'other'

export interface AttachmentInfo {
  url: string
  type: AttachmentType
  extension: string
  name: string
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const PDF_EXTS = ['pdf']
const SPREADSHEET_EXTS = ['xls', 'xlsx', 'csv']

export function getAttachmentInfo(text: string): AttachmentInfo | null {
  try {
    const match = text.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/)
    if (!match) return null
    const ext = match[1].toLowerCase()
    const name = text.split('/').pop()?.split(/[?#]/)[0] || `archivo.${ext}`
    if (IMAGE_EXTS.includes(ext)) return { url: text, type: 'image', extension: ext, name }
    if (PDF_EXTS.includes(ext)) return { url: text, type: 'pdf', extension: ext, name }
    if (SPREADSHEET_EXTS.includes(ext)) return { url: text, type: 'spreadsheet', extension: ext, name }
    return { url: text, type: 'other', extension: ext, name }
  } catch {
    return null
  }
}
