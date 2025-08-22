import React from 'react';
import { Post } from '@/types/chat';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EventCardProps {
  post: Post;
}

const EventCard: React.FC<EventCardProps> = ({ post }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return null;
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "HH:mm 'hs'", { locale: es });
    } catch {
      return null;
    }
  };

  const startDate = formatDate(post.fecha_evento_inicio);
  const startTime = formatTime(post.fecha_evento_inicio);
  const endDate = formatDate(post.fecha_evento_fin);
  const endTime = formatTime(post.fecha_evento_fin);

  return (
    <Card className="w-full max-w-sm bg-card/60 border-border/80 shadow-lg rounded-xl overflow-hidden my-2">
      {post.imagen_url && (
        <div className="aspect-video w-full overflow-hidden">
          <img src={post.imagen_url} alt={post.titulo} className="w-full h-full object-cover" />
        </div>
      )}
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-lg font-bold text-primary">{post.titulo}</CardTitle>
            <Badge variant={post.tipo_post === 'evento' ? 'default' : 'secondary'} className="capitalize shrink-0">
                {post.tipo_post}
            </Badge>
        </div>
        {post.subtitulo && (
          <p className="text-sm text-muted-foreground pt-1">{post.subtitulo}</p>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{post.contenido}</p>

        {post.tipo_post === 'evento' && startDate && (
          <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{startDate}</span>
              {endDate && startDate !== endDate && <span>- {endDate}</span>}
            </div>
            {startTime && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{startTime}</span>
                {endTime && <span>- {endTime}</span>}
              </div>
            )}
          </div>
        )}
      </CardContent>
      {post.url && (
        <CardFooter>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Ver más detalles...
          </a>
        </CardFooter>
      )}
    </Card>
  );
};

export default EventCard;
