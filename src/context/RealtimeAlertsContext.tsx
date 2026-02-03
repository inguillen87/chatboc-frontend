import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useTicketUpdates from '@/hooks/useTicketUpdates';
import { playProactiveSound } from '@/utils/sounds';

interface RealtimeAlertsContextValue {
  ticketUnreadCount: number;
  orderUnreadCount: number;
  clearTicketAlerts: () => void;
  clearOrderAlerts: () => void;
}

const RealtimeAlertsContext = createContext<RealtimeAlertsContextValue | undefined>(undefined);

const matchesSection = (pathname: string, section: string) => {
  const normalized = pathname.toLowerCase();
  return new RegExp(`(^|/)${section}(/|$)`).test(normalized);
};

export const RealtimeAlertsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [ticketUnreadCount, setTicketUnreadCount] = useState(0);
  const [orderUnreadCount, setOrderUnreadCount] = useState(0);

  const clearTicketAlerts = useCallback(() => setTicketUnreadCount(0), []);
  const clearOrderAlerts = useCallback(() => setOrderUnreadCount(0), []);

  const isInTicketsSection =
    matchesSection(location.pathname, 'tickets') ||
    matchesSection(location.pathname, 'reclamos');
  const isInOrdersSection = matchesSection(location.pathname, 'pedidos');

  useEffect(() => {
    if (isInTicketsSection && ticketUnreadCount > 0) {
      clearTicketAlerts();
    }
  }, [clearTicketAlerts, isInTicketsSection, ticketUnreadCount]);

  useEffect(() => {
    if (isInOrdersSection && orderUnreadCount > 0) {
      clearOrderAlerts();
    }
  }, [clearOrderAlerts, isInOrdersSection, orderUnreadCount]);

  useTicketUpdates({
    onNewTicket: () => {
      if (!isInTicketsSection) {
        setTicketUnreadCount((prev) => prev + 1);
        playProactiveSound();
      }
    },
    onNewComment: () => {
      if (!isInTicketsSection) {
        setTicketUnreadCount((prev) => prev + 1);
        playProactiveSound();
      }
    },
  });

  const value = useMemo(
    () => ({
      ticketUnreadCount,
      orderUnreadCount,
      clearTicketAlerts,
      clearOrderAlerts,
    }),
    [ticketUnreadCount, orderUnreadCount, clearTicketAlerts, clearOrderAlerts],
  );

  return <RealtimeAlertsContext.Provider value={value}>{children}</RealtimeAlertsContext.Provider>;
};

export const useRealtimeAlerts = () => {
  const context = useContext(RealtimeAlertsContext);
  if (!context) {
    throw new Error('useRealtimeAlerts must be used within a RealtimeAlertsProvider');
  }
  return context;
};
