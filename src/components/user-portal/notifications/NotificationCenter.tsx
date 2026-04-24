import React from 'react';
import { Bell, Check, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from 'react-router-dom';
import { PortalNotification } from '@/data/portalDemoContent'; // Ideally from a shared types file
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  notifications: PortalNotification[];
  onMarkAsRead?: (id: string) => void;
  onClearAll?: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onClearAll,
}) => {
  const navigate = useNavigate();
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = (notification: PortalNotification) => {
    if (onMarkAsRead && !notification.read) {
      onMarkAsRead(notification.id);
    }
    if (notification.actionHref) {
      navigate(notification.actionHref);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-primary rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notificaciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96">
        <DropdownMenuLabel className="flex items-center justify-between py-2">
          <span>Notificaciones</span>
          {notifications.length > 0 && (
             <Button
                variant="ghost"
                size="sm"
                className="text-xs h-auto px-2 text-muted-foreground hover:text-destructive"
                onClick={onClearAll}
              >
                Limpiar todo
             </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No tienes notificaciones nuevas</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 cursor-pointer focus:bg-muted/50",
                    !notification.read && "bg-muted/20 border-l-2 border-primary"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium text-sm text-foreground">
                      {notification.title}
                    </span>
                    {notification.severity && (
                      <Badge variant="outline" className={cn(
                        "text-[10px] px-1.5 py-0 capitalize",
                        notification.severity === 'error' && "border-destructive text-destructive",
                        notification.severity === 'warning' && "border-warning text-warning-foreground",
                        notification.severity === 'success' && "border-success text-success-foreground",
                        notification.severity === 'info' && "border-primary text-primary"
                      )}>
                        {notification.severity}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between w-full mt-1">
                    <span className="text-[10px] text-muted-foreground/70">
                        {notification.date ? new Date(notification.date).toLocaleDateString() : 'Reciente'}
                    </span>
                    {notification.actionLabel && (
                        <span className="text-[10px] font-medium text-primary hover:underline">
                            {notification.actionLabel}
                        </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-center text-primary text-xs cursor-pointer py-2"
              onClick={() => navigate('/portal/noticias')}
            >
              Ver centro de notificaciones
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationCenter;
