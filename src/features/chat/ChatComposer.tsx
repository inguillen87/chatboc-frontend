import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Image, MapPin, Mic, MicOff, Paperclip, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { requestLocation } from '@/utils/geolocation';
import useAudioRecorder from '@/hooks/useAudioRecorder';
import type { ChatMediaCapabilities, ChatMediaInputModeConfig } from '@/types/chat';

export interface ChatComposerPayload {
  text: string;
  intent?: string | null;
  payload?: Record<string, unknown> | null;
  attachmentInfo?: unknown;
  location?: { lat: number; lon: number; accuracy?: number | null };
  audioBlob?: Blob;
  audioFilename?: string;
}

export default function ChatComposer({
  onSend,
  placeholder = 'Escribi tu mensaje',
  sendLabel = 'Enviar',
  mediaCapabilities,
  draftText,
  intent,
  payload,
}: {
  onSend: (payload: ChatComposerPayload) => void;
  placeholder?: string;
  sendLabel?: string;
  mediaCapabilities?: ChatMediaCapabilities | null;
  draftText?: string | null;
  intent?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const [text, setText] = useState('');
  const [composerState, setComposerState] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedFileModeRef = useRef<'image' | 'file'>('file');
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

  const emitText = () => {
    const trimmed = text.trim();
    if (!trimmed || textMode?.enabled === false) return;
    onSend({ text: trimmed, intent, payload });
    setText('');
    setError(null);
  };

  const uploadAttachment = async (file: File, mode: ChatMediaInputModeConfig | undefined) => {
    const endpoint = mode?.upload_endpoint || '/archivos/upload/chat_attachment';
    const responseKey = mode?.upload_response_key || 'attachmentInfo';
    const formData = new FormData();
    formData.append('file', file);
    setComposerState('uploading');
    try {
      const response = await apiFetch<Record<string, unknown>>(endpoint, {
        method: 'POST',
        body: formData,
        isWidgetRequest: true,
      });
      const attachmentInfo = response?.[responseKey] ?? response;
      onSend({
        text: text.trim(),
        intent,
        payload,
        attachmentInfo,
      });
      setText('');
      setError(null);
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
          lon: coords.longitud,
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
      selectedFileModeRef.current = 'image';
      fileInputRef.current?.click();
      return;
    }
    if (type === 'file') {
      selectedFileModeRef.current = 'file';
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
        accept={selectedFileModeRef.current === 'image' ? 'image/*' : undefined}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const mode = selectedFileModeRef.current === 'image' ? imageMode : fileMode;
          void uploadAttachment(file, mode);
        }}
      />
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded border px-2 py-1"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={resolvedPlaceholder}
          aria-label="Mensaje"
          disabled={textMode?.enabled === false || composerState !== 'idle'}
        />
        <Button type="submit" size="sm" aria-label={sendLabel} disabled={!text.trim() || composerState !== 'idle'}>
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
                disabled={composerState !== 'idle' && !(action.type === 'audio' && isRecording)}
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
