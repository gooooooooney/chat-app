import React, { createContext, useContext, useState, useCallback } from 'react';

interface NotificationContextType {
  hasViewedContacts: boolean;
  markContactsAsViewed: () => void;
  resetContactsView: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [hasViewedContacts, setHasViewedContacts] = useState(false);

  const markContactsAsViewed = useCallback(() => {
    setHasViewedContacts(true);
  }, []);

  const resetContactsView = useCallback(() => {
    setHasViewedContacts(false);
  }, []);

  return (
    <NotificationContext.Provider value={{
      hasViewedContacts,
      markContactsAsViewed,
      resetContactsView,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}