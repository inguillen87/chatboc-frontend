import { useEffect, useMemo, useState } from 'react';
import { Send, ThumbsUp, User } from 'lucide-react';
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
import { SurveyComment } from '@/types/encuestas';

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
}

interface SurveyCommentsProps {
  slug: string;
  tenantSlug?: string;
  realtimeComments: SurveyComment[];
  copy?: SurveyCommentsCopy;
}

export function SurveyComments({ slug, tenantSlug, realtimeComments, copy }: SurveyCommentsProps) {
  const [comments, setComments] = useState<SurveyComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [commentMode, setCommentMode] = useState<'anonimo' | 'facebook'>('anonimo');
  const [orderBy, setOrderBy] = useState<'recent' | 'top'>('recent');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safeText = (value?: string) => (typeof value === 'string' ? value : '');

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

    setIsSubmitting(true);
    try {
      const payload = {
        texto: newComment,
        nombre: commentMode === 'facebook' ? authorName || undefined : authorName || undefined,
        modo: commentMode,
      };
      const savedComment = await postSurveyComment(slug, payload, tenantSlug);

      // Optimistic update (or rely on socket, but let's add it locally just in case)
      setComments((prev) => [savedComment, ...prev]);
      setNewComment('');
      toast({ title: safeText(copy?.toastSuccess) });
    } catch (error) {
        console.error(error);
      toast({
        title: safeText(copy?.toastErrorTitle),
        description: safeText(copy?.toastErrorDescription),
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
        <CardTitle className="text-xl">{safeText(copy?.title)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comment Form */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-gradient-to-br from-muted/20 to-muted/40 p-4">
          <div className="space-y-3">
            <Label className="text-xs uppercase text-muted-foreground">{safeText(copy?.modeLabel)}</Label>
            <RadioGroup
              value={commentMode}
              onValueChange={(value) => setCommentMode(value as 'anonimo' | 'facebook')}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="comment-anon" value="anonimo" />
                <Label htmlFor="comment-anon">{safeText(copy?.modeAnonymous)}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="comment-facebook" value="facebook" />
                <Label htmlFor="comment-facebook">{safeText(copy?.modeFacebook)}</Label>
              </div>
            </RadioGroup>
          </div>
          <Textarea
            placeholder={safeText(copy?.placeholder)}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[92px] rounded-xl"
          />
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <Input
                placeholder={safeText(copy?.namePlaceholder)}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full max-w-[220px] rounded-xl"
              />
              {commentMode === 'facebook' ? (
                <Button type="button" variant="outline" size="sm" className="whitespace-nowrap">
                  {safeText(copy?.connectFacebook)}
                </Button>
              ) : null}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !newComment.trim()}
              size="sm"
            >
              {isSubmitting ? safeText(copy?.submittingLabel) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {safeText(copy?.submitLabel)}
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{safeText(copy?.orderLabel)}</p>
          <Select value={orderBy} onValueChange={(value) => setOrderBy(value as 'recent' | 'top')}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder={safeText(copy?.orderPlaceholder)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">{safeText(copy?.orderRecent)}</SelectItem>
              <SelectItem value="top">{safeText(copy?.orderTop)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Comments List */}
        <div className="space-y-3 sm:space-y-4">
            {loading ? (
                <p className="text-muted-foreground text-center">{safeText(copy?.loadingLabel)}</p>
            ) : comments.length === 0 ? (
                <p className="text-muted-foreground text-center">{safeText(copy?.emptyLabel)}</p>
            ) : (
                sortedComments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 items-start rounded-xl border border-border/40 bg-background/70 p-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={`https://api.dicebear.com/7.x/initials/svg?seed=${toDisplayText(comment.nombre_autor) || safeText(copy?.authorFallback)}`}
                            />
                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium leading-none">
                                    {toDisplayText(comment.nombre_autor) || safeText(copy?.authorFallback)}
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
