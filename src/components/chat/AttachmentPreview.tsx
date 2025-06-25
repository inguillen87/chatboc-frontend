import React from 'react'
import { File, FileImage, FileSpreadsheet, FileText } from 'lucide-react'
import { AttachmentInfo } from '@/utils/attachment'

interface Props {
  attachment: AttachmentInfo
}

const AttachmentPreview: React.FC<Props> = ({ attachment }) => {
  if (attachment.type === 'image') {
    return (
      <div className="flex flex-col items-start">
        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-w-[260px] rounded-lg border cursor-pointer"
          />
        </a>
        <span className="text-xs mt-1 break-all">{attachment.name}</span>
      </div>
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
      <span className="break-all">{attachment.name}</span>
    </a>
  )
}

export default AttachmentPreview
