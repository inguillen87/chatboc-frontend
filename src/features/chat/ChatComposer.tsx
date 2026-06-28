import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Image, MapPin, Mic, MicOff, Paperclip, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/utils/api';
import { requestLocation } from '@/utils/geolocation';
import useAudioRecorder from '@/hooks/useAudioRecorder';
import type { ChatMediaCapabilities, ChatMediaInputModeConfig } from '@/types/chat';
import { uploadChatAttachment } from './uploadChatAttachment';

export interface ChatComposerPayload {
  text: string;
  intent?: string | null;
  action_id?: string | null;
  payload?: Record<string, unknown> | null;
  attachmentInfo?: unknown;
  attachmentFile?: File;
  location?: { lat: number; lng?: number; lon?: number; address?: string | null; accuracy?: number | null };
  audioBlob?: Blob;
  audioFilename?: string;
  audioField?: string;
  audioEndpoint?: string;
}

type AttachmentDraft = {
  file: File;
  mode: 'image' | 'file';
  previewUrl?: string;
};

export default function ChatComposer({
  onSend,
  placeholder = 'Escribi tu mensaje',
  sendLabel = 'Enviar',
  mediaCapabilities,
  draftText,
  intent,
  payload,
  disabled = false,
}: {
  onSend: (payload: ChatComposerPayload) => void;
  placeholder?: string;
  sendLabel?: string;
  mediaCapabilities?: ChatMediaCapabilities | null;
  draftText?: string | null;
  intent?: string | null;
  payload?: Record<string, unknown> | null;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [composerState, setComposerState] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attachmentDraft, setAttachmentDraft] = useState<AttachmentDraft | null>(null);
  const [selectedFileMode, setSelectedFileMode] = useState<'image' | 'file'>('file');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  useEffect(() => {
    if (typeof draftText !== 'string') return;
    setText(draftText);
  }, [draftText]);

  const inputModes = mediaCapabilities?.input_modes ?? {};
  const isModeEnabled = (mode: string) => inputModes[mode]?.enabled !== false;
  const textMode = inputModes.text;
  const imageMode = inputModes.image;
  const fileMode = inputModes.file;
  const audioMode = inputModes.audio;
  const locationMode = inputModes.location;

  const enabledActions = useMemo(
    () =>
      (mediaCapabilities?.composer?.actions ?? []).filter((action) => {
        if (!action?.type) return false;
        return isModeEnabled(action.type);
      }),
    [mediaCapabilities?.composer?.actions, mediaCapabilities?.input_modes],
  );

  const resolvedPlaceholder =
    mediaCapabilities?.composer?.placeholder?.trim() ||
    placeholder;

  const resolveActionIcon = (type: string) => {
    if (type === 'image') return Image;
    if (type === 'audio') return isRecording ? MicOff : Mic;
    if (type === 'location') return MapPin;
    if (type === 'file') return Paperclip;
    return FileText;
  };

  const clearAttachmentDraft = () => {
    setAttachmentDraft((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    return () => {
      if (attachmentDraft?.previewUrl) {
        URL.revokeObjectURL(attachmentDraft.previewUrl);
      }
    };
  }, [attachmentDraft?.previewUrl]);

  const emitText = async () => {
    const trimmed = text.trim();
    if (attachmentDraft) {
      await uploadAttachment(attachmentDraft.file, attachmentDraft.mode === 'image' ? imageMode : fileMode);
      return;
    }
    if (disabled || !trimmed || textMode?.enabled === false) return;
    onSend({ text: trimmed, intent, payload });
    setText('');
    setError(null);
  };

  const uploadAttachment = async (file: File, mode: ChatMediaInputModeConfig | undefined) => {
    const endpoint = mode?.upload_endpoint?.trim();
    if (!endpoint) {
      setError('Esta accion no esta disponible en esta demo.');
      return null;
    }
    const responseKey = mode?.upload_response_key || 'attachmentInfo';
    const createFormData = () => {
      const formData = new FormData();
      formData.append('file', file);
      return formData;
    };
    setComposerState('uploading');
    try {
      const response = await uploadChatAttachment<Record<string, unknown>>(endpoint, createFormData);
      const attachmentInfo = response?.[responseKey] ?? response;
      onSend({
        text: text.trim(),
        intent,
        payload,
        attachmentInfo,
        attachmentFile: file,
      });
      setText('');
      setError(null);
      clearAttachmentDraft();
      setComposerState('thinking');
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo subir el archivo.'));
    } finally {
      setComposerState('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const shareLocation = async () => {
    setComposerState('uploading');
    try {
      const coords = await requestLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      if (!coords) {
        setError('No se pudo obtener la ubicacion.');
        return;
      }
      onSend({
        text: text.trim(),
        intent,
        payload,
        location: {
          lat: coords.latitud,
          lng: coords.longitud,
        },
      });
      setText('');
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo obtener la ubicacion.'));
    } finally {
      setComposerState('idle');
    }
  };

  const toggleAudio = async () => {
    if (isRecording) {
      setComposerState('transcribing');
      try {
        const audioBlob = await stopRecording();
        if (audioBlob) {
          onSend({
            text: text.trim(),
            intent,
            payload,
            audioBlob,
            audioFilename: `audio-${Date.now()}.webm`,
            audioField: audioMode?.multipart_field || 'audio_file',
            audioEndpoint: audioMode?.chat_endpoint || undefined,
          });
          setText('');
          setError(null);
        }
      } catch (err) {
        setError(getErrorMessage(err, 'No se pudo enviar el audio.'));
      } finally {
        setComposerState('idle');
      }
      return;
    }
    try {
      setComposerState('recording');
      await startRecording();
    } catch (err) {
      setComposerState('idle');
      setError(getErrorMessage(err, 'No se pudo iniciar la grabacion.'));
    }
  };

  const handleAction = (type: string) => {
    if (type === 'image') {
      setSelectedFileMode('image');
      fileInputRef.current?.click();
      return;
    }
    if (type === 'file') {
      setSelectedFileMode('file');
      fileInputRef.current?.click();
      return;
    }
    if (type === 'location' && locationMode?.enabled !== false) {
      void shareLocation();
      return;
    }
    if (type === 'audio' && audioMode?.enabled !== false) {
      void toggleAudio();
    }
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        emitText();
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={selectedFileMode === 'image' ? 'image/*' : undefined}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const nextDraft: AttachmentDraft = {
            file,
            mode: selectedFileMode,
            ...(file.type.startsWith('image/') ? { previewUrl: URL.createObjectURL(file) } : {}),
          };
          setError(null);
          setAttachmentDraft((current) => {
            if (current?.previewUrl) {
              URL.revokeObjectURL(current.previewUrl);
            }
            return nextDraft;
          });
        }}
      />
      {attachmentDraft ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2">
          {attachmentDraft.previewUrl ? (
            <img src={attachmentDraft.previewUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-background">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{attachmentDraft.file.name}</p>
            <p className="text-xs text-muted-foreground">{Math.round(attachmentDraft.file.size / 1024)} KB</p>
            {composerState === 'uploading' ? (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
              </div>
            ) : null}
          </div>
          {error ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={composerState !== 'idle'}
              onClick={() => void uploadAttachment(attachmentDraft.file, attachmentDraft.mode === 'image' ? imageMode : fileMode)}
            >
              Reintentar
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={composerState !== 'idle'}
            onClick={clearAttachmentDraft}
            aria-label="Cancelar adjunto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded border px-2 py-1"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={resolvedPlaceholder}
          aria-label="Mensaje"
          disabled={disabled || textMode?.enabled === false || composerState !== 'idle'}
        />
        <Button type="submit" size="sm" aria-label={sendLabel} disabled={disabled || (!text.trim() && !attachmentDraft) || composerState !== 'idle'}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {enabledActions.length ? (
        <div className="flex flex-wrap gap-2">
          {enabledActions.map((action) => {
            const Icon = resolveActionIcon(action.type);
            return (
              <Button
                key={action.id}
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 px-2 text-xs"
                disabled={disabled || (composerState !== 'idle' && !(action.type === 'audio' && isRecording))}
                onClick={() => handleAction(action.type)}
                title={action.label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{action.label}</span>
              </Button>
            );
          })}
        </div>
      ) : null}
      {composerState !== 'idle' ? (
        <p className="text-xs text-muted-foreground" role="status">
          {composerState}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
