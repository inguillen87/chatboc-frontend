import { useEffect, useMemo, useState } from 'react';
import { MessageCircleMore, Send, ThumbsUp, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { getSurveyComments, postSurveyComment } from '@/api/encuestas';
import { SurveyComment, type SurveyCommentConfig } from '@/types/encuestas';
import { trackSurveyCommentModeChanged, trackSurveyCommentSubmitted } from '@/utils/surveyAnalytics';
import { ApiError } from '@/utils/api';

export interface SurveyCommentsCopy {
  title?: string;
  modeLabel?: string;
  modeAnonymous?: string;
  modeFacebook?: string;
  connectFacebook?: string;
  placeholder?: string;
  namePlaceholder?: string;
  submitLabel?: string;
  submittingLabel?: string;
  orderLabel?: string;
  orderPlaceholder?: string;
  orderRecent?: string;
  orderTop?: string;
  loadingLabel?: string;
  emptyLabel?: string;
  toastSuccess?: string;
  toastErrorTitle?: string;
  toastErrorDescription?: string;
  authorFallback?: string;
  helperText?: string;
  characterCountLabel?: string;
  socialModeLabel?: string;
  providerLabel?: string;
  modeGoogle?: string;
  modeInstagram?: string;
  connectGoogle?: string;
  connectInstagram?: string;
  socialProviders?: Array<{
    id?: string;
    label?: string;
    connectLabel?: string;
    oauthUrl?: string;
  }>;
}


const DEFAULT_COMMENTS_COPY: Required<SurveyCommentsCopy> = {
  title: 'Comentarios de la comunidad',
  modeLabel: 'Cómo querés publicar tu comentario',
  modeAnonymous: 'Anónimo',
  modeFacebook: 'Con nombre',
  connectFacebook: 'Conectar Facebook',
  placeholder: 'Escribí tu comentario para aportar a esta votación.',
  namePlaceholder: 'Tu nombre (opcional)',
  submitLabel: 'Publicar comentario',
  submittingLabel: 'Publicando…',
  orderLabel: 'Ordenar comentarios',
  orderPlaceholder: 'Seleccioná un orden',
  orderRecent: 'Más recientes',
  orderTop: 'Más valorados',
  loadingLabel: 'Cargando comentarios…',
  emptyLabel: 'Todavía no hay comentarios. Sé la primera persona en participar.',
  toastSuccess: 'Comentario publicado correctamente',
  toastErrorTitle: 'No pudimos publicar tu comentario',
  toastErrorDescription: 'Intentá nuevamente en unos segundos.',
  authorFallback: 'Participante',
  helperText: 'Tu comentario ayuda a sumar contexto para interpretar mejor los resultados.',
  characterCountLabel: 'Caracteres',
  socialModeLabel: 'Con cuenta verificada',
  providerLabel: 'Red social para identificarte',
  modeGoogle: 'Google',
  modeInstagram: 'Instagram',
  connectGoogle: 'Conectar Google',
  connectInstagram: 'Conectar Instagram',
  socialProviders: [
    { id: 'facebook', label: 'Facebook', connectLabel: 'Conectar Facebook' },
    { id: 'google', label: 'Google', connectLabel: 'Conectar Google' },
    { id: 'instagram', label: 'Instagram', connectLabel: 'Conectar Instagram' },
  ],
};


const toDisplayText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferred = record.texto ?? record.label ?? record.nombre ?? record.value ?? record.pregunta ?? record.lider;
    if (typeof preferred === 'string' || typeof preferred === 'number' || typeof preferred === 'boolean') {
      return String(preferred);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
};

interface SurveyCommentsProps {
  slug: string;
  tenantSlug?: string;
  realtimeComments: SurveyComment[];
  copy?: SurveyCommentsCopy;
  commentConfig?: SurveyCommentConfig;
}

interface SocialAuthProfile {
  provider: string;
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

export function SurveyComments({ slug, tenantSlug, realtimeComments, copy, commentConfig }: SurveyCommentsProps) {
  const [comments, setComments] = useState<SurveyComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [commentMode, setCommentMode] = useState<'anonimo' | 'social'>('anonimo');
  const [socialProvider, setSocialProvider] = useState<string>('facebook');
  const [socialAuthProfile, setSocialAuthProfile] = useState<SocialAuthProfile | null>(null);
  const [orderBy, setOrderBy] = useState<'recent' | 'top'>('recent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const maxCommentLength = 500;

  const copyText = (value: string | undefined, fallback: string) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized.length ? normalized : fallback;
  };

  const configuredProviders = useMemo(() => {
    const fromBackend = Array.isArray(copy?.socialProviders) ? copy.socialProviders : DEFAULT_COMMENTS_COPY.socialProviders;
    return fromBackend
      .map((provider) => ({
        id: typeof provider?.id === 'string' && provider.id.trim().length > 0 ? provider.id.trim().toLowerCase() : '',
        label: typeof provider?.label === 'string' && provider.label.trim().length > 0 ? provider.label.trim() : '',
        connectLabel:
          typeof provider?.connectLabel === 'string' && provider.connectLabel.trim().length > 0
            ? provider.connectLabel.trim()
            : '',
        oauthUrl:
          typeof provider?.oauthUrl === 'string' && provider.oauthUrl.trim().length > 0
            ? provider.oauthUrl.trim()
            : null,
      }))
      .filter((provider) => provider.id && provider.label);
  }, [copy?.socialProviders]);

  const acceptedModes = useMemo(() => {
    const modes = Array.isArray(commentConfig?.acceptedModes) ? commentConfig.acceptedModes : [];
    return new Set(
      modes
        .map((mode) => (typeof mode === 'string' ? mode.trim().toLowerCase() : ''))
        .filter(Boolean),
    );
  }, [commentConfig?.acceptedModes]);

  const allowAnonymous = useMemo(() => {
    if (!acceptedModes.size) return true;
    return acceptedModes.has('anonimo') || acceptedModes.has('anonymous');
  }, [acceptedModes]);

  const allowSocial = useMemo(() => {
    if (!acceptedModes.size) return true;
    return (
      acceptedModes.has('social') ||
      acceptedModes.has('facebook') ||
      acceptedModes.has('google') ||
      acceptedModes.has('instagram')
    );
  }, [acceptedModes]);

  useEffect(() => {
    if (!configuredProviders.length) return;
    if (configuredProviders.some((provider) => provider.id === socialProvider)) return;
    setSocialProvider(configuredProviders[0].id);
  }, [configuredProviders, socialProvider]);

  useEffect(() => {
    if (commentMode === 'anonimo' && !allowAnonymous && allowSocial) {
      setCommentMode('social');
      return;
    }
    if (commentMode === 'social' && !allowSocial && allowAnonymous) {
      setCommentMode('anonimo');
    }
  }, [allowAnonymous, allowSocial, commentMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      const payload = data as Record<string, unknown>;
      const eventType = typeof payload.type === 'string' ? payload.type : '';
      if (eventType !== 'chatboc:survey-social-auth-success') return;

      const provider = typeof payload.provider === 'string' ? payload.provider.toLowerCase().trim() : '';
      if (!provider) return;
      const profile: SocialAuthProfile = {
        provider,
        userId: typeof payload.user_id === 'string' ? payload.user_id : undefined,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        firstName: typeof payload.first_name === 'string' ? payload.first_name : undefined,
        lastName: typeof payload.last_name === 'string' ? payload.last_name : undefined,
        fullName: typeof payload.full_name === 'string' ? payload.full_name : undefined,
      };
      setSocialAuthProfile(profile);
      if (profile.fullName?.trim()) {
        setAuthorName(profile.fullName.trim());
      } else if (profile.firstName?.trim() || profile.lastName?.trim()) {
        setAuthorName(`${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim());
      }
      setCommentMode('social');
      setSocialProvider(provider);
      trackSurveyCommentModeChanged({
        slug,
        tenant: tenantSlug ?? null,
        mode: 'social_connected',
        provider,
      });
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [slug, tenantSlug]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchComments = async (attempt = 0) => {
      try {
        const data = await getSurveyComments(slug, tenantSlug);
        if (cancelled) return;
        setComments(Array.isArray(data) ? data : []);
      } catch (error) {
        if (cancelled) return;
        if (attempt === 0) {
          retryTimer = setTimeout(() => {
            void fetchComments(1);
          }, 1200);
          return;
        }
        setComments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchComments(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [slug, tenantSlug]);

  useEffect(() => {
    // Merge realtime comments
    if (realtimeComments.length > 0) {
      setComments((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const uniqueNew = realtimeComments.filter((c) => !existingIds.has(c.id));
        return [...uniqueNew, ...prev].sort((a, b) =>
            new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        );
      });
    }
  }, [realtimeComments]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    if (commentMode === 'social' && commentConfig?.requiresSocialToken && !socialAuthProfile?.userId) {
      toast({
        title: copyText(copy?.toastErrorTitle, DEFAULT_COMMENTS_COPY.toastErrorTitle),
        description: 'Necesitás conectar una cuenta social válida para comentar en este espacio.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedMode =
        commentMode === 'anonimo'
          ? 'anonimo'
          : (configuredProviders.some((provider) => provider.id === socialProvider) ? socialProvider : 'social');
      const payload = {
        texto: newComment,
        nombre:
          commentMode === 'social'
            ? socialAuthProfile?.fullName || authorName || undefined
            : undefined,
        modo: resolvedMode,
        auth_provider: commentMode === 'social' ? socialProvider || undefined : undefined,
        auth_user_id: commentMode === 'social' ? socialAuthProfile?.userId : undefined,
        auth_email: commentMode === 'social' ? socialAuthProfile?.email : undefined,
        auth_first_name: commentMode === 'social' ? socialAuthProfile?.firstName : undefined,
        auth_last_name: commentMode === 'social' ? socialAuthProfile?.lastName : undefined,
      };
      const savedComment = await postSurveyComment(slug, payload, tenantSlug);

      // Optimistic update (or rely on socket, but let's add it locally just in case)
      setComments((prev) => [savedComment, ...prev]);
      setNewComment('');
      trackSurveyCommentSubmitted({
        slug,
        tenant: tenantSlug ?? null,
        mode: commentMode,
        provider: commentMode === 'social' ? socialProvider : null,
        commentLength: newComment.trim().length,
      });
      toast({ title: copyText(copy?.toastSuccess, DEFAULT_COMMENTS_COPY.toastSuccess) });
    } catch (error) {
      console.error(error);
      const reasonCode = error instanceof ApiError
        ? (error.body as Record<string, unknown> | undefined)?.reason_code
        : null;
      const reasonText = typeof reasonCode === 'string' ? reasonCode.trim().toLowerCase() : '';
      let reasonDescription = copyText(copy?.toastErrorDescription, DEFAULT_COMMENTS_COPY.toastErrorDescription);
      if (reasonText === 'social_token_required') {
        reasonDescription = 'Este tenant requiere autenticación social para comentar.';
      } else if (reasonText === 'invalid_social_token') {
        reasonDescription = 'Tu sesión social expiró o es inválida. Volvé a conectar tu cuenta.';
      } else if (reasonText === 'social_identity_mismatch') {
        reasonDescription = 'La identidad social no coincide con el perfil activo. Reconectá la cuenta correcta.';
      }
      toast({
        title: copyText(copy?.toastErrorTitle, DEFAULT_COMMENTS_COPY.toastErrorTitle),
        description: reasonDescription,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedComments = useMemo(() => {
    if (orderBy === 'top') {
      return [...comments].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    }
    return [...comments].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [comments, orderBy]);

  const showLikes = useMemo(() => comments.some((comment) => typeof comment.likes === 'number'), [comments]);

  const timeAgo = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch (e) {
      return '';
    }
  };

  return (
    <Card className="w-full mt-8 border border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">{copyText(copy?.title, DEFAULT_COMMENTS_COPY.title)}</CardTitle>
        <p className="text-sm text-muted-foreground">{copyText(copy?.helperText, DEFAULT_COMMENTS_COPY.helperText)}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comment Form */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-gradient-to-br from-muted/20 to-muted/40 p-4">
          <div className="space-y-3">
            <Label className="text-xs uppercase text-muted-foreground">{copyText(copy?.modeLabel, DEFAULT_COMMENTS_COPY.modeLabel)}</Label>
            <RadioGroup
              value={commentMode}
              onValueChange={(value) => {
                const nextMode = value as 'anonimo' | 'social';
                setCommentMode(nextMode);
                trackSurveyCommentModeChanged({
                  slug,
                  tenant: tenantSlug ?? null,
                  mode: nextMode,
                  provider: nextMode === 'social' ? socialProvider : null,
                });
              }}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="comment-anon" value="anonimo" disabled={!allowAnonymous} />
                <Label htmlFor="comment-anon">{copyText(copy?.modeAnonymous, DEFAULT_COMMENTS_COPY.modeAnonymous)}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="comment-social" value="social" disabled={!allowSocial} />
                <Label htmlFor="comment-social">{copyText(copy?.socialModeLabel, DEFAULT_COMMENTS_COPY.socialModeLabel)}</Label>
              </div>
            </RadioGroup>
          </div>
          <Textarea
            placeholder={copyText(copy?.placeholder, DEFAULT_COMMENTS_COPY.placeholder)}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[92px] rounded-xl"
            maxLength={maxCommentLength}
          />
          <div className="-mt-2 flex justify-end">
            <span className="text-xs text-muted-foreground">{copyText(copy?.characterCountLabel, DEFAULT_COMMENTS_COPY.characterCountLabel)}: {newComment.length}/{maxCommentLength}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              {commentMode === 'social' ? (
                <>
                  <div className="w-full sm:w-[220px]">
                    <Select
                      value={socialProvider}
                      onValueChange={(value) => {
                        setSocialProvider(value);
                        trackSurveyCommentModeChanged({
                          slug,
                          tenant: tenantSlug ?? null,
                          mode: commentMode,
                          provider: value,
                        });
                      }}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={copyText(copy?.providerLabel, DEFAULT_COMMENTS_COPY.providerLabel)} />
                      </SelectTrigger>
                      <SelectContent>
                        {configuredProviders.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    placeholder={copyText(copy?.namePlaceholder, DEFAULT_COMMENTS_COPY.namePlaceholder)}
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full max-w-[220px] rounded-xl"
                    disabled={Boolean(
                      socialAuthProfile &&
                      socialAuthProfile.provider === socialProvider &&
                      (socialAuthProfile.fullName || socialAuthProfile.firstName || socialAuthProfile.lastName),
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => {
                      const providerConfig = configuredProviders.find((provider) => provider.id === socialProvider);
                      trackSurveyCommentModeChanged({
                        slug,
                        tenant: tenantSlug ?? null,
                        mode: 'social_connect_click',
                        provider: socialProvider,
                      });
                      if (providerConfig?.oauthUrl && typeof window !== 'undefined') {
                        const popup = window.open(providerConfig.oauthUrl, '_blank', 'noopener,noreferrer,width=580,height=680');
                        if (!popup) {
                          toast({
                            title: copyText(copy?.toastErrorTitle, DEFAULT_COMMENTS_COPY.toastErrorTitle),
                            description: copyText(copy?.toastErrorDescription, DEFAULT_COMMENTS_COPY.toastErrorDescription),
                            variant: 'destructive',
                          });
                        }
                      }
                    }}
                  >
                    {configuredProviders.find((provider) => provider.id === socialProvider)?.connectLabel ||
                      copyText(copy?.connectFacebook, DEFAULT_COMMENTS_COPY.connectFacebook)}
                  </Button>
                  {socialAuthProfile?.provider === socialProvider && (socialAuthProfile.fullName || socialAuthProfile.firstName || socialAuthProfile.lastName) ? (
                    <p className="text-xs text-emerald-600">
                      Conectado como {socialAuthProfile.fullName || `${socialAuthProfile.firstName ?? ''} ${socialAuthProfile.lastName ?? ''}`.trim()}
                    </p>
                  ) : null}
                  {commentConfig?.requiresSocialToken ? (
                    <p className="text-xs text-muted-foreground">
                      Este espacio requiere cuenta social verificada para publicar comentarios.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !newComment.trim()}
              size="sm"
              aria-label={copyText(copy?.submitLabel, DEFAULT_COMMENTS_COPY.submitLabel)}
              title={copyText(copy?.submitLabel, DEFAULT_COMMENTS_COPY.submitLabel)}
            >
              {isSubmitting ? copyText(copy?.submittingLabel, DEFAULT_COMMENTS_COPY.submittingLabel) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {copyText(copy?.submitLabel, DEFAULT_COMMENTS_COPY.submitLabel)}
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{copyText(copy?.orderLabel, DEFAULT_COMMENTS_COPY.orderLabel)}</p>
          <Select value={orderBy} onValueChange={(value) => setOrderBy(value as 'recent' | 'top')}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder={copyText(copy?.orderPlaceholder, DEFAULT_COMMENTS_COPY.orderPlaceholder)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">{copyText(copy?.orderRecent, DEFAULT_COMMENTS_COPY.orderRecent)}</SelectItem>
              <SelectItem value="top">{copyText(copy?.orderTop, DEFAULT_COMMENTS_COPY.orderTop)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Comments List */}
        <div className="space-y-3 sm:space-y-4">
            {loading ? (
                <p className="text-muted-foreground text-center">{copyText(copy?.loadingLabel, DEFAULT_COMMENTS_COPY.loadingLabel)}</p>
            ) : comments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-center">
                  <MessageCircleMore className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                  <p className="text-muted-foreground text-center">{copyText(copy?.emptyLabel, DEFAULT_COMMENTS_COPY.emptyLabel)}</p>
                </div>
            ) : (
                sortedComments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 items-start rounded-xl border border-border/40 bg-background/70 p-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={`https://api.dicebear.com/7.x/initials/svg?seed=${toDisplayText(comment.nombre_autor) || copyText(copy?.authorFallback, DEFAULT_COMMENTS_COPY.authorFallback)}`}
                            />
                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium leading-none">
                                    {toDisplayText(comment.nombre_autor) || copyText(copy?.authorFallback, DEFAULT_COMMENTS_COPY.authorFallback)}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                    {timeAgo(comment.fecha)}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{toDisplayText(comment.texto)}</p>
                            {showLikes ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Button variant="ghost" size="sm" className="h-7 px-2" disabled>
                                  <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                                  {comment.likes ?? 0}
                                </Button>
                              </div>
                            ) : null}
                        </div>
                    </div>
                ))
            )}
        </div>
      </CardContent>
    </Card>
  );
}
