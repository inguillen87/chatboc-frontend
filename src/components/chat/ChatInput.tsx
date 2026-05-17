// src/components/chat/ChatInput.tsx
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Send, MapPin, Mic, MicOff, X, FileText, Smile, ArrowUp, CheckCircle2, Sparkles } from "lucide-react";
import AdjuntarArchivo, { AdjuntarArchivoHandle } from "@/components/ui/AdjuntarArchivo";
import { getErrorMessage } from "@/utils/api";
import { requestLocation } from "@/utils/geolocation";
import { toast } from "@/components/ui/use-toast";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import { AttachmentInfo, deriveAttachmentInfo } from "@/utils/attachment";
import { ChatMediaCapabilities, ChatUxChannelCapabilities, ChatWidgetUiHints, SendPayload } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  coalesceNumber,
  coalesceString,
  normalizeUploadResponse,
  UploadResponsePayload,
  UploadResponseLike,
} from "@/utils/uploadResponse";
import { ensureAbsoluteUrl } from "@/utils/chatButtons";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { uploadChatAttachment } from "@/features/chat/uploadChatAttachment";

export interface ChatInputHandle {
  openFilePicker: () => void;
}

interface Props {
  onSendMessage: (payload: SendPayload) => void;
  isTyping: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
  inputRef?: React.RefObject<HTMLInputElement>;
  onTypingChange?: (typing: boolean) => void;
  onSystemMessage?: (text: string, type: 'error' | 'info') => void;
  validateBeforeSend?: (payload: SendPayload) => string | null;
  channelCapabilities?: ChatUxChannelCapabilities | null;
  mediaCapabilities?: ChatMediaCapabilities | null;
  uiHints?: ChatWidgetUiHints | null;
  guidedFlow?: {
    currentField?: string | null;
    fields?: string[];
  } | null;
  supportsMultimodalIntake?: boolean;
}


const PLACEHOLDERS = ["Escribí tu mensaje..."];
const COMPACT_PLACEHOLDER_MAX_LENGTH = 42;

// Emojis funcionales para reclamos comunes (incluye alternativas para
// accesibilidad e inclusión). Se mantienen íconos claros y específicos.
const QUICK_EMOJIS = [
  { emoji: "💧", category: "agua" },
  { emoji: "💦", category: "agua" },
  { emoji: "🌧️", category: "agua" },
  { emoji: "🌳", category: "arbolado" },
  { emoji: "🌲", category: "arbolado" },
  { emoji: "🔥", category: "fuego" },
  { emoji: "🚒", category: "fuego" },
  { emoji: "🐶", category: "animales" },
  { emoji: "🐾", category: "animales" },
  { emoji: "🚮", category: "limpieza" },
  { emoji: "🧹", category: "limpieza" },
  { emoji: "🗑️", category: "limpieza" },
];
const CHAT_INPUT_DRAFT_KEY = "chat_widget_input_draft_v1";

type UploadResponse = UploadResponseLike;

const normalizeFieldLabel = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};


const capabilityEnabledByDefault = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
    if (["true", "1", "yes", "si", "on", "enabled"].includes(normalized)) return true;
  }
  return true;
};

const mediaCapabilityEnabled = (
  mediaCapabilities: ChatMediaCapabilities | null | undefined,
  mode: string,
  legacyEnabled: boolean,
): boolean => {
  if (!mediaCapabilities) return legacyEnabled;
  const inputMode = mediaCapabilities.input_modes?.[mode];
  if (inputMode?.enabled === false) return false;
  if (inputMode?.enabled === true) return true;
  const actions = mediaCapabilities.composer?.actions;
  if (Array.isArray(actions) && actions.length > 0) {
    return actions.some((action) => action?.type === mode);
  }
  return legacyEnabled;
};

const mediaActionLabel = (
  mediaCapabilities: ChatMediaCapabilities | null | undefined,
  mode: string,
  fallback: string,
) => mediaCapabilities?.composer?.actions?.find((action) => action?.type === mode)?.label?.trim() || fallback;

const ChatInput = forwardRef<ChatInputHandle, Props>(({ onSendMessage, isTyping, disabled = false, disabledReason = null, inputRef, onTypingChange, onSystemMessage, validateBeforeSend, channelCapabilities, mediaCapabilities, uiHints, guidedFlow, supportsMultimodalIntake = true }, ref) => {
  const [input, setInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{ file: File; previewUrl: string } | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const internalRef = inputRef || fallbackInputRef;
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const adjRef = useRef<AdjuntarArchivoHandle>(null);
  const supportsAudioInput =
    supportsMultimodalIntake &&
    mediaCapabilityEnabled(
      mediaCapabilities,
      'audio',
      capabilityEnabledByDefault(channelCapabilities?.supports_audio_input),
    );
  const supportsFileUpload =
    supportsMultimodalIntake &&
    mediaCapabilityEnabled(
      mediaCapabilities,
      'file',
      capabilityEnabledByDefault(channelCapabilities?.supports_file_upload),
    );
  const supportsImageInput =
    supportsMultimodalIntake &&
    mediaCapabilityEnabled(
      mediaCapabilities,
      'image',
      capabilityEnabledByDefault(channelCapabilities?.supports_image_input),
    );
  const supportsLocationShare =
    supportsMultimodalIntake &&
    mediaCapabilityEnabled(
      mediaCapabilities,
      'location',
      capabilityEnabledByDefault(channelCapabilities?.supports_location_share),
    );
  const composerPlaceholder = mediaCapabilities?.composer?.placeholder?.trim();
  const compactComposer =
    uiHints?.density === "compact" ||
    uiHints?.composer?.single_row_actions ||
    uiHints?.composer?.icon_buttons_only;
  const toolbarShow = uiHints?.toolbar?.show;
  const shouldShowToolbarAction = React.useCallback(
    (action: string) => {
      if (!Array.isArray(toolbarShow) || toolbarShow.length === 0) return true;
      return toolbarShow.includes(action);
    },
    [toolbarShow],
  );
  const imageLabel = mediaActionLabel(mediaCapabilities, 'image', channelCapabilities?.image_input_label || 'Imagen');
  const fileLabel = mediaActionLabel(mediaCapabilities, 'file', channelCapabilities?.file_upload_label || 'Archivo');
  const audioLabel = mediaActionLabel(mediaCapabilities, 'audio', channelCapabilities?.audio_input_label || 'Audio');
  const locationLabel = mediaActionLabel(mediaCapabilities, 'location', channelCapabilities?.location_share_label || 'Ubicacion');
  const attachmentLabel = supportsImageInput && supportsFileUpload
    ? `${imageLabel} / ${fileLabel}`
    : supportsImageInput
      ? imageLabel
      : fileLabel;
  const allowedFileTypes = React.useMemo(() => {
    const nextTypes: string[] = [];
    if (supportsImageInput) nextTypes.push('image/*');
    if (supportsFileUpload) nextTypes.push('application/pdf', 'video/*');
    if (!mediaCapabilities && supportsAudioInput) nextTypes.push('audio/*');
    return nextTypes;
  }, [mediaCapabilities, supportsAudioInput, supportsFileUpload, supportsImageInput]);
  const showAttachAction = allowedFileTypes.length > 0 && shouldShowToolbarAction("attach_file");
  const showLocationAction = supportsLocationShare && shouldShowToolbarAction("share_location");
  const showAudioAction = supportsAudioInput && shouldShowToolbarAction("record_audio");
  const showEmojiAction = shouldShowToolbarAction("emoji");
  const currentGuidedFieldLabel = normalizeFieldLabel(guidedFlow?.currentField);
  const resolvedPlaceholder =
    attachmentPreview
      ? "Agrega un comentario..."
      : currentGuidedFieldLabel ||
        (composerPlaceholder &&
        composerPlaceholder.length > COMPACT_PLACEHOLDER_MAX_LENGTH
          ? PLACEHOLDERS[0]
          : composerPlaceholder) ||
        PLACEHOLDERS[placeholderIndex];
  const guidedFields = React.useMemo(
    () => (guidedFlow?.fields || []).map((field) => normalizeFieldLabel(field)).filter((field): field is string => Boolean(field)),
    [guidedFlow?.fields],
  );
  const currentGuidedStepIndex = currentGuidedFieldLabel
    ? Math.max(guidedFields.findIndex((field) => field === currentGuidedFieldLabel), 0)
    : -1;
  const guidedProgress = guidedFields.length > 0 && currentGuidedStepIndex >= 0
    ? ((currentGuidedStepIndex + 1) / guidedFields.length) * 100
    : 0;
  const draftStorageKey = React.useMemo(() => {
    if (typeof window === "undefined") return CHAT_INPUT_DRAFT_KEY;
    const scope = window.location.pathname.replace(/[^a-z0-9/_-]+/gi, "_").toLowerCase() || "root";
    return `${CHAT_INPUT_DRAFT_KEY}:${scope}`;
  }, []);

  useImperativeHandle(ref, () => ({
    openFilePicker: () => {
      adjRef.current?.openFileDialog();
    },
  }));

  useEffect(() => {
    if (PLACEHOLDERS.length <= 1) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedDraft = safeLocalStorage.getItem(draftStorageKey);
    if (!savedDraft) return;
    setInput(savedDraft);
    onTypingChange?.(savedDraft.trim().length > 0);
    setDraftRecovered(true);
  }, [draftStorageKey, onTypingChange]);

  useEffect(() => {
    if (!draftRecovered) return;
    const timer = window.setTimeout(() => setDraftRecovered(false), 3200);
    return () => window.clearTimeout(timer);
  }, [draftRecovered]);

  useEffect(() => {
    if (!input) {
      safeLocalStorage.removeItem(draftStorageKey);
      return;
    }
    safeLocalStorage.setItem(draftStorageKey, input);
  }, [draftStorageKey, input]);

  const handleSend = async () => {
    if ((!input.trim() && !attachmentPreview) || isTyping || disabled) return;

    let attachmentData: AttachmentInfo | undefined = undefined;
    let legacyArchivoUrl: string | undefined;
    let legacyEsFoto = false;

    if (attachmentPreview) {
      toast({ title: "Subiendo archivo...", description: attachmentPreview.file.name });
      const createUploadFormData = () => {
        const formData = new FormData();
        formData.append('file', attachmentPreview.file);
        return formData;
      };
      const selectedMode = attachmentPreview.file.type.startsWith("image/")
        ? mediaCapabilities?.input_modes?.image
        : mediaCapabilities?.input_modes?.file;
      const uploadEndpoint = selectedMode?.upload_endpoint || '/archivos/upload/chat_attachment';
      const uploadResponseKey = selectedMode?.upload_response_key || 'attachmentInfo';

      try {
        const response = await uploadChatAttachment<UploadResponse>(
          uploadEndpoint,
          createUploadFormData,
        );
        const originalFile = attachmentPreview.file;
        const uploadRaw =
          response && typeof response === 'object'
            ? ((response as Record<string, unknown>)[uploadResponseKey] as UploadResponse | undefined) ?? response
            : response;
        const normalized = normalizeUploadResponse(uploadRaw);
        const responsePayload =
          uploadRaw && typeof uploadRaw === 'object'
            ? (uploadRaw as UploadResponsePayload)
            : undefined;
        const fallbackRawUrl =
          coalesceString(
            responsePayload?.url,
            responsePayload?.attachmentUrl,
            responsePayload?.attachment_url,
            responsePayload?.fileUrl,
            responsePayload?.file_url,
            responsePayload?.archivo_url,
            responsePayload?.public_url,
            responsePayload?.publicUrl,
            responsePayload?.secure_url,
            responsePayload?.fallbackUrl,
            responsePayload?.fallback_url,
            responsePayload?.fallbackPublicUrl,
            responsePayload?.fallback_public_url,
            responsePayload?.local_url,
            responsePayload?.localUrl,
            responsePayload?.local_path,
            responsePayload?.localPath,
            responsePayload?.local_relative_path,
            responsePayload?.localRelativePath,
            responsePayload?.storage_path,
            responsePayload?.storagePath,
            responsePayload?.storage_url,
            responsePayload?.storageUrl,
            responsePayload?.static_url,
            responsePayload?.staticUrl,
            responsePayload?.relative_url,
            responsePayload?.relativeUrl,
            responsePayload?.full_path,
            responsePayload?.fullPath,
            responsePayload?.public_path,
            responsePayload?.publicPath,
            responsePayload?.path,
            responsePayload?.web_path,
            responsePayload?.webPath,
            typeof uploadRaw === 'string' ? uploadRaw : undefined,
          );
        const uploadedUrlCandidate =
          normalized.url ||
          (fallbackRawUrl
            ? normalizeUploadResponse(fallbackRawUrl).url || fallbackRawUrl
            : undefined);
        const absoluteUploadedUrl =
          uploadedUrlCandidate
            ? ensureAbsoluteUrl(uploadedUrlCandidate) ?? uploadedUrlCandidate
            : undefined;

        if (!absoluteUploadedUrl) {
          throw new Error('La respuesta del servidor no incluyó la URL del archivo subido.');
        }

        const uploadedName =
          normalized.name ||
          coalesceString(
            responsePayload?.name,
            responsePayload?.filename,
            responsePayload?.fileName,
          ) ||
          originalFile.name;
        const uploadedMime =
          normalized.mimeType ||
          coalesceString(
            responsePayload?.mimeType,
            responsePayload?.mime_type,
            originalFile.type,
          );
        const uploadedSize =
          normalized.size ??
          coalesceNumber(responsePayload?.size, responsePayload?.fileSize) ??
          originalFile.size;
        const uploadedThumbCandidate =
          normalized.thumbUrl ||
          coalesceString(
            responsePayload?.thumbUrl,
            responsePayload?.thumb_url,
            responsePayload?.thumbnailUrl,
            responsePayload?.thumbnail_url,
          );
        const resolvedThumb =
          uploadedThumbCandidate
            ? ensureAbsoluteUrl(uploadedThumbCandidate) ?? uploadedThumbCandidate
            : undefined;

        const derivedAttachment = deriveAttachmentInfo(
          absoluteUploadedUrl,
          uploadedName,
          uploadedMime,
          uploadedSize,
          resolvedThumb,
        );

        attachmentData = {
          ...derivedAttachment,
          ...(normalized.id ? { id: normalized.id } : {}),
        };
        legacyArchivoUrl = absoluteUploadedUrl;
        legacyEsFoto = derivedAttachment.type === 'image';
      } catch (error) {
        console.error("Error uploading file:", error);
        toast({ title: "Error de subida", description: "No se pudo subir el archivo.", variant: "destructive" });
        setAttachmentPreview(null); // Clear preview on error
        return;
      }
    }

    const finalAttachment = attachmentData;
    const finalArchivoUrl = legacyArchivoUrl || finalAttachment?.url;
    const finalEsFoto =
      legacyEsFoto || ((finalAttachment?.mimeType || '').toLowerCase().startsWith('image/'));

    const nextPayload: SendPayload = {
      text: input.trim(),
      attachmentInfo: finalAttachment,
      ...(finalArchivoUrl ? { archivo_url: finalArchivoUrl } : {}),
      ...(finalEsFoto ? { es_foto: true } : {}),
      source: 'input',
    };

    const validationError = validateBeforeSend?.(nextPayload) ?? null;
    if (validationError) {
      setInlineError(validationError);
      return;
    }

    onSendMessage(nextPayload);
    setInput("");
    setInlineError(null);
    setAttachmentPreview(null);
    setShowEmojis(false);
    onTypingChange?.(false);
    safeLocalStorage.removeItem(draftStorageKey);
    internalRef.current?.focus();
  };

  const handleFileSelected = (file: File) => {
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    setAttachmentPreview({ file, previewUrl });
    // Revoke the object URL when the component unmounts or the preview changes
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  };

  const handleShareLocation = async () => {
    if (isTyping || isLocating || disabled) return;
    setIsLocating(true);
    toast({ title: "Obteniendo ubicación...", description: "Por favor, acepta la solicitud de GPS.", duration: 2000 });
    try {
      const coords = await requestLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      if (coords) {
        onSendMessage({
          text: "", // Texto vacío como pide el backend
          location: { lat: coords.latitud, lon: coords.longitud }, // Usar el nuevo formato
          source: 'system',
        });
        toast({ title: "Ubicación enviada", description: "Tu ubicación ha sido compartida.", duration: 3000 });
      } else {
        toast({ title: "Ubicación no disponible", description: "No pudimos acceder a tu ubicación por GPS. Verificá los permisos y que estés usando una conexión segura (https).", variant: "destructive", duration: 5000 });
      }
    } catch (error) {
      console.error("Error al obtener ubicación:", error);
      toast({ title: "Error al obtener ubicación", description: "Hubo un problema al intentar obtener tu ubicación.", variant: "destructive", duration: 5000 });
    } finally {
      setIsLocating(false);
    }
    setInput("");
    setInlineError(null);
    onTypingChange?.(false);
    safeLocalStorage.removeItem(draftStorageKey);
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    if (isTyping || disabled) return;
    onSystemMessage?.('Enviando audio...', 'info');

    const filename = `audio-grabado-${Date.now()}.webm`;
    const audioMode = mediaCapabilities?.input_modes?.audio;
    if (audioMode && audioMode.enabled !== false) {
      onSendMessage({
        text: '',
        audioBlob,
        audioFilename: filename,
        audioField: audioMode.multipart_field || 'audio_file',
        audioEndpoint: audioMode.chat_endpoint || '/ask',
        source: 'input',
      });
      return;
    }

    const createAudioUploadFormData = () => {
      const formData = new FormData();
      formData.append('file', audioBlob, filename);
      return formData;
    };

    try {
      const data = await uploadChatAttachment<UploadResponse>(
        '/archivos/upload/chat_attachment',
        createAudioUploadFormData,
      );

      const normalized = normalizeUploadResponse(data);
      const responsePayload =
        data && typeof data === 'object' ? (data as UploadResponsePayload) : undefined;
      const fallbackRawUrl =
        coalesceString(
          responsePayload?.url,
          responsePayload?.attachmentUrl,
          responsePayload?.attachment_url,
          responsePayload?.fileUrl,
          responsePayload?.file_url,
          responsePayload?.archivo_url,
          responsePayload?.public_url,
          responsePayload?.publicUrl,
          responsePayload?.secure_url,
          responsePayload?.fallbackUrl,
          responsePayload?.fallback_url,
          responsePayload?.fallbackPublicUrl,
          responsePayload?.fallback_public_url,
          responsePayload?.local_url,
          responsePayload?.localUrl,
          responsePayload?.local_path,
          responsePayload?.localPath,
          responsePayload?.local_relative_path,
          responsePayload?.localRelativePath,
          responsePayload?.storage_path,
          responsePayload?.storagePath,
          responsePayload?.storage_url,
          responsePayload?.storageUrl,
          responsePayload?.static_url,
          responsePayload?.staticUrl,
          responsePayload?.relative_url,
          responsePayload?.relativeUrl,
          responsePayload?.full_path,
          responsePayload?.fullPath,
          responsePayload?.public_path,
          responsePayload?.publicPath,
          responsePayload?.path,
          responsePayload?.web_path,
          responsePayload?.webPath,
          typeof data === 'string' ? data : undefined,
        );
      const uploadedUrlCandidate =
        normalized.url ||
        (fallbackRawUrl
          ? normalizeUploadResponse(fallbackRawUrl).url || fallbackRawUrl
          : undefined);
      const absoluteUploadedUrl =
        uploadedUrlCandidate
          ? ensureAbsoluteUrl(uploadedUrlCandidate) ?? uploadedUrlCandidate
          : undefined;

      if (!absoluteUploadedUrl) {
        throw new Error("La respuesta del servidor para la subida del audio fue inválida.");
      }

      const uploadedName =
        normalized.name ||
        coalesceString(
          responsePayload?.name,
          responsePayload?.filename,
          responsePayload?.fileName,
        ) ||
        filename;
      const uploadedMime =
        normalized.mimeType ||
        coalesceString(responsePayload?.mimeType, responsePayload?.mime_type) ||
        'audio/webm';
      const uploadedSize =
        normalized.size ??
        coalesceNumber(responsePayload?.size, responsePayload?.fileSize) ??
        (typeof audioBlob.size === 'number' ? audioBlob.size : undefined);
      const uploadedThumbCandidate =
        normalized.thumbUrl ||
        coalesceString(
          responsePayload?.thumbUrl,
          responsePayload?.thumb_url,
          responsePayload?.thumbnailUrl,
          responsePayload?.thumbnail_url,
        );
      const resolvedThumb =
        uploadedThumbCandidate
          ? ensureAbsoluteUrl(uploadedThumbCandidate) ?? uploadedThumbCandidate
          : undefined;

      const derivedAttachment = deriveAttachmentInfo(
        absoluteUploadedUrl,
        uploadedName,
        uploadedMime,
        uploadedSize,
        resolvedThumb,
      );

      onSendMessage({
        text: '',
        attachmentInfo: {
          ...derivedAttachment,
          ...(normalized.id ? { id: normalized.id } : {}),
        },
        archivo_url: absoluteUploadedUrl,
        source: 'input',
      });
      // Optional: a success system message could be sent here, but it might be noisy.
      // onSystemMessage?.('Audio enviado con éxito.', 'info');
    } catch (error) {
      console.error("Error al enviar audio:", error);
      const friendlyError = getErrorMessage(error, "Hubo un problema al subir tu grabación.");
      onSystemMessage?.(friendlyError, 'error');
    }
  };

  return (
    <div className="chatboc-chat-composer w-full flex flex-col gap-1.5 px-1 py-1 sm:gap-2 sm:px-2 sm:py-2 bg-background">
      {disabled && disabledReason ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          {disabledReason}
        </div>
      ) : null}
      {draftRecovered ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          Recuperamos tu borrador anterior automáticamente.
        </div>
      ) : null}
      {guidedFields.length > 0 ? (
        <div className="rounded-[22px] border border-primary/10 bg-gradient-to-br from-primary/[0.08] via-background to-secondary/20 px-3 py-3 shadow-[0_12px_35px_rgba(2,6,23,0.06)]">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground"><div className="inline-flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/12 text-primary"><Sparkles className="h-3.5 w-3.5" /></span>
            <div className="flex flex-col">
            <span className="font-medium uppercase tracking-wide">{currentGuidedFieldLabel || guidedFields[0]}</span>
              <span className="text-[11px] text-muted-foreground/80">Paso guiado</span>
            </div>
          </div>
            <span className="rounded-full bg-background/80 px-2 py-1 font-semibold text-foreground shadow-sm">{currentGuidedStepIndex >= 0 ? `${currentGuidedStepIndex + 1}/${guidedFields.length}` : guidedFields.length}</span>
          </div>
          <Progress value={guidedProgress || undefined} className="h-1.5 bg-background" />
          <div className="mt-3 flex flex-wrap gap-2">
            {guidedFields.map((field, index) => {
              const isActive = field === currentGuidedFieldLabel;
              const isCompleted = currentGuidedStepIndex > index;
              return (
                <span
                  key={`${field}_${index}`}
                  className={[
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : isCompleted
                        ? 'border-emerald-200/80 bg-emerald-500/10 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'border-border/70 bg-background/80 text-muted-foreground backdrop-blur',
                  ].join(' ')}
                >
                  {field}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
      {attachmentPreview && (
        <div className="relative w-full p-2 bg-muted rounded-lg flex items-center gap-3">
          {attachmentPreview.previewUrl ? (
            <img src={attachmentPreview.previewUrl} alt="Preview" className="w-14 h-14 rounded-md object-cover" />
          ) : (
            <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-secondary rounded-md">
              <FileText className="w-7 h-7 text-secondary-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{attachmentPreview.file.name}</p>
            <p className="text-xs text-muted-foreground">{(attachmentPreview.file.size / 1024).toFixed(1)} KB</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 w-6 h-6"
            onClick={() => setAttachmentPreview(null)}
            aria-label="Quitar adjunto"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="rounded-[22px] border border-border/70 bg-gradient-to-br from-background via-background to-muted/25 p-1 shadow-[0_10px_26px_rgba(15,23,42,0.07)] sm:rounded-[24px] sm:p-1.5 dark:shadow-[0_16px_32px_rgba(0,0,0,0.24)]">
          <div className="w-full">
          <input
            ref={internalRef}
            className={`
              w-full
              rounded-[18px] px-3.5 py-2 sm:rounded-[20px] sm:px-4 sm:py-3
              text-base
              outline-none transition-all duration-200
              focus:ring-2 focus:ring-primary/50 focus:border-transparent
              placeholder:text-sm placeholder:text-muted-foreground sm:placeholder:text-base
              font-medium
              disabled:cursor-not-allowed
              bg-input/80 text-foreground
              border border-border/70 shadow-inner
              dark:bg-input dark:text-foreground dark:border-border
              ${isTyping ? "opacity-60 bg-muted-foreground/10 dark:bg-muted-foreground/20" : ""}
            `}
            type="text"
            placeholder={resolvedPlaceholder}
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              onTypingChange?.(val.trim().length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            autoFocus
            autoComplete="off"
            maxLength={200}
            aria-label="Escribir mensaje"
            aria-keyshortcuts="Enter"
            inputMode="text"
            disabled={disabled || isTyping || isRecording}
          />
          </div>
        <div
          className={`relative mt-1 flex w-full items-center gap-1 sm:mt-1.5 sm:gap-1.5 ${compactComposer ? "flex-nowrap" : "flex-wrap"}`}
          role="toolbar"
          aria-label="Acciones del mensaje"
        >
          {showEmojiAction && showEmojis && (
            <div className="absolute bottom-full right-0 z-10 mb-2 flex max-w-[280px] flex-wrap gap-2 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur">
              {QUICK_EMOJIS.map((item) => (
                <button
                  key={item.emoji}
                  className="rounded-2xl p-2 text-2xl transition hover:scale-110 hover:bg-muted"
                  onClick={() => {
                    onSendMessage({
                      text: item.emoji,
                      action: "quick_emoji",
                      payload: { category: item.category },
                      source: 'button',
                    });
                    setShowEmojis(false);
                  }}
                  type="button"
                  aria-label={`Enviar emoji ${item.emoji}`}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          )}
          <div className={`flex min-w-0 items-center gap-1.5 ${compactComposer ? "flex-nowrap" : "flex-wrap"}`}>
            {showAttachAction ? (
              <div className="rounded-full border border-border/60 bg-background p-0.5 shadow-sm transition hover:shadow-md [&_button]:h-9 [&_button]:w-9 sm:[&_button]:h-10 sm:[&_button]:w-10" title={attachmentLabel}>
              <AdjuntarArchivo
                ref={adjRef}
                onFileSelected={handleFileSelected}
                disabled={disabled || isRecording || !!attachmentPreview}
                allowedFileTypes={allowedFileTypes}
              />
              </div>
            ) : null}
            {showLocationAction ? (
            <button
              onClick={handleShareLocation}
              disabled={disabled || isTyping || isLocating || isRecording || !!attachmentPreview}
              className={`
                flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10
                rounded-full p-2 sm:p-3
                shadow-md transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-1 focus:ring-offset-background
                active:scale-95
                border border-border/60 bg-background text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary/80 hover:shadow-lg
                ${disabled || isTyping || isLocating || !!attachmentPreview ? "opacity-50 cursor-not-allowed" : ""}
              `}
              aria-label={locationLabel}
              title={locationLabel}
              type="button"
            >
              {isLocating ? <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin sm:h-5 sm:w-5" /> : <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
            ) : null}
            {showAudioAction ? (
            <button
              onClick={async () => {
                if (isRecording) {
                  const audioBlob = await stopRecording();
                  if (audioBlob) {
                    handleSendAudio(audioBlob);
                  }
                } else {
                  try {
                    await startRecording();
                  } catch (error) {
                    toast({ title: "Error al grabar", description: "No se pudo iniciar la grabación. Verifica los permisos del micrófono.", variant: "destructive" });
                  }
                }
              }}
              disabled={disabled || isTyping || isLocating || !!attachmentPreview}
              className={`
                flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10
                rounded-full p-2 sm:p-3
                shadow-md transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-1 focus:ring-offset-background
                active:scale-95
                border border-border/60 bg-background text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary/80 hover:shadow-lg
                ${disabled || isTyping || isLocating || !!attachmentPreview ? "opacity-50 cursor-not-allowed" : ""}
                ${isRecording ? "text-destructive bg-destructive/20 hover:bg-destructive/30" : ""}
              `}
              aria-label={isRecording ? "Detener grabación" : audioLabel}
              title={audioLabel}
              type="button"
            >
              {isRecording ? <MicOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
            ) : null}
            {showEmojiAction ? (
            <button
              onClick={() => setShowEmojis((v) => !v)}
              disabled={disabled || isTyping || isLocating || !!attachmentPreview}
              className={`
                flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10
                rounded-full p-2 sm:p-3
                shadow-md transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-1 focus:ring-offset-background
                active:scale-95
                border border-border/60 bg-background text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary/80 hover:shadow-lg
                ${disabled || isTyping || isLocating || !!attachmentPreview ? "opacity-50 cursor-not-allowed" : ""}
              `}
              aria-label="Mostrar emojis"
              type="button"
            >
              <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            ) : null}
          </div>
          <button
            className={`
              ml-auto flex-shrink-0
              flex h-10 w-10 items-center justify-center sm:h-11 sm:w-11
              rounded-full p-2.5 sm:p-3.5
              shadow-md transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-1 focus:ring-offset-background
              active:scale-95
              gap-1.5 bg-primary text-primary-foreground hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_14px_30px_rgba(0,122,255,0.28)]
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            onClick={handleSend}
            disabled={disabled || (!input.trim() && !attachmentPreview) || isTyping || isRecording}
            aria-label="Enviar mensaje"
            type="button"
          >
            {input.trim() || attachmentPreview ? <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" /> : <Send className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
        </div>
        {(input.trim() || attachmentPreview || currentGuidedFieldLabel) ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-2 pb-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              {currentGuidedFieldLabel ? `Campo activo: ${currentGuidedFieldLabel}` : attachmentPreview ? 'Listo para enviar adjunto' : 'Mensaje listo para enviar'}
            </span>
            <span>{input.length}/200</span>
          </div>
        ) : null}
        </div>
      </div>
      {inlineError ? (
        <p className="mt-1 text-xs text-destructive">{inlineError}</p>
      ) : null}
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
