import React from 'react'
import { File, FileImage, FileSpreadsheet, FileText } from 'lucide-react'
import { AttachmentInfo } from '@/utils/attachment'

interface Props {
  attachment: AttachmentInfo
}

const AttachmentPreview: React.FC<Props> = ({ attachment }) => {
  if (attachment.type === 'image') {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer">
        <img
          src={attachment.url}
          alt="archivo"
          className="max-w-[260px] rounded-lg border cursor-pointer"
        />
      </a>
    )
  }

  const Icon =
    attachment.type === 'pdf'
      ? FileText
      : attachment.type === 'spreadsheet'
      ? FileSpreadsheet
      : File

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-primary underline hover:opacity-80"
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span>{attachment.extension.toUpperCase()}</span>
    </a>
  )
}

export default AttachmentPreview
