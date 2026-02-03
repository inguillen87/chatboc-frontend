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

interface SurveyCommentsProps {
  slug: string;
  tenantSlug?: string;
  realtimeComments: SurveyComment[];
}

export function SurveyComments({ slug, tenantSlug, realtimeComments }: SurveyCommentsProps) {
  const [comments, setComments] = useState<SurveyComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [commentMode, setCommentMode] = useState<'anonimo' | 'facebook'>('anonimo');
  const [orderBy, setOrderBy] = useState<'recent' | 'top'>('recent');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Initial fetch
    const fetchComments = async () => {
      try {
        const data = await getSurveyComments(slug, tenantSlug);
        setComments(data);
      } catch (error) {
        console.error('Error fetching comments:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
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
      toast({ title: 'Comentario enviado' });
    } catch (error) {
        console.error(error);
      toast({
        title: 'Error al enviar comentario',
        description: 'Por favor intentá nuevamente.',
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
    <Card className="w-full mt-8">
      <CardHeader>
        <CardTitle className="text-xl">Debate y Comentarios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comment Form */}
        <div className="flex flex-col gap-4 rounded-lg bg-muted/30 p-4">
          <div className="space-y-3">
            <Label className="text-xs uppercase text-muted-foreground">Modo de comentario</Label>
            <RadioGroup
              value={commentMode}
              onValueChange={(value) => setCommentMode(value as 'anonimo' | 'facebook')}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="comment-anon" value="anonimo" />
                <Label htmlFor="comment-anon">Anónimo</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="comment-facebook" value="facebook" />
                <Label htmlFor="comment-facebook">Facebook</Label>
              </div>
            </RadioGroup>
          </div>
          <Textarea
            placeholder="Dejá tu comentario (anónimo o con Facebook)"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <Input
                placeholder="Tu nombre (opcional)"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="max-w-[200px]"
              />
              {commentMode === 'facebook' ? (
                <Button type="button" variant="outline" size="sm" className="whitespace-nowrap">
                  Conectar Facebook
                </Button>
              ) : null}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !newComment.trim()}
              size="sm"
            >
              {isSubmitting ? 'Enviando...' : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Publicar
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Ordenar por</p>
          <Select value={orderBy} onValueChange={(value) => setOrderBy(value as 'recent' | 'top')}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Seleccioná un orden" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Más recientes</SelectItem>
              <SelectItem value="top">Más votados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Comments List */}
        <div className="space-y-4">
            {loading ? (
                <p className="text-muted-foreground text-center">Cargando comentarios...</p>
            ) : comments.length === 0 ? (
                <p className="text-muted-foreground text-center">Sé el primero en comentar.</p>
            ) : (
                sortedComments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 items-start border-b border-border/40 pb-4 last:border-0">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${comment.nombre_autor || 'Anon'}`} />
                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium leading-none">
                                    {comment.nombre_autor || 'Anónimo'}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                    {timeAgo(comment.fecha)}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{comment.texto}</p>
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
