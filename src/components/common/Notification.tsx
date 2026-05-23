import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { CheckOutlined, CloseOutlined, ExclamationOutlined, InfoCircleOutlined } from '@ant-design/icons';
// Use higher resolution icon from public folder for better quality
const pluralityLogo = '/icon128.png';

// Notification types
type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationItem {
  id: string;
  message: string;
  type: NotificationType;
  duration: number;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Animations
const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const slideOut = keyframes`
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100px);
  }
`;

// Styled components
const NotificationContainer = styled.div`
  position: fixed;
  top: 20px;
  right: 30px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
`;

const NotificationCard = styled.div<{ $type: NotificationType; $isExiting: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
  min-width: 340px;
  max-width: 440px;
  background: ${({ theme }) => theme.colors.background};
  border-radius: 14px;
  border: 2px solid ${({ $type, theme }) => {
    switch ($type) {
      case 'success': return theme.colors.success || '#52c41a';
      case 'error': return theme.colors.error || '#ff4d4f';
      case 'warning': return theme.colors.warning || '#faad14';
      case 'info': return theme.colors.info || '#1890ff';
      default: return theme.colors.border;
    }
  }};
  box-shadow: 0 6px 24px ${({ theme }) => theme.colors.shadowColor || 'rgba(0, 0, 0, 0.15)'};
  animation: ${({ $isExiting }) => ($isExiting ? slideOut : slideIn)} 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  pointer-events: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
`;

const AppIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;

  img {
    width: 36px;
    height: 36px;
    object-fit: contain;
  }
`;

const ContentWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AppName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const StatusIcon = styled.span<{ $type: NotificationType }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 10px;
  background: ${({ $type }) => {
    switch ($type) {
      case 'success': return 'rgba(82, 196, 26, 0.15)';
      case 'error': return 'rgba(255, 77, 79, 0.15)';
      case 'warning': return 'rgba(250, 173, 20, 0.15)';
      case 'info': return 'rgba(24, 144, 255, 0.15)';
      default: return 'rgba(0, 0, 0, 0.1)';
    }
  }};
  color: ${({ $type }) => {
    switch ($type) {
      case 'success': return '#52c41a';
      case 'error': return '#ff4d4f';
      case 'warning': return '#faad14';
      case 'info': return '#1890ff';
      default: return 'inherit';
    }
  }};
`;

const Message = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.5;
  word-wrap: break-word;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.backgroundHover};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const NotificationCardWrapper = styled.div`
  position: relative;

  &:hover ${CloseButton} {
    opacity: 1;
  }
`;

// Progress bar at the bottom
const ProgressBar = styled.div<{ $type: NotificationType; $duration: number }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: ${({ $type }) => {
    switch ($type) {
      case 'success': return 'rgba(82, 196, 26, 0.3)';
      case 'error': return 'rgba(255, 77, 79, 0.3)';
      case 'warning': return 'rgba(250, 173, 20, 0.3)';
      case 'info': return 'rgba(24, 144, 255, 0.3)';
      default: return 'rgba(0, 0, 0, 0.1)';
    }
  }};
  border-radius: 0 0 14px 14px;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    background: ${({ $type }) => {
      switch ($type) {
        case 'success': return '#52c41a';
        case 'error': return '#ff4d4f';
        case 'warning': return '#faad14';
        case 'info': return '#1890ff';
        default: return '#8A2BE2';
      }
    }};
    animation: shrink ${({ $duration }) => $duration}ms linear forwards;
  }

  @keyframes shrink {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }
`;

const getStatusIcon = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return <CheckOutlined />;
    case 'error':
      return <CloseOutlined />;
    case 'warning':
      return <ExclamationOutlined />;
    case 'info':
      return <InfoCircleOutlined />;
    default:
      return null;
  }
};

// Single notification component
const NotificationItem: React.FC<{
  notification: NotificationItem;
  onClose: (id: string) => void;
}> = ({ notification, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, notification.duration - 350);

    const removeTimer = setTimeout(() => {
      onClose(notification.id);
    }, notification.duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [notification, onClose]);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onClose(notification.id), 350);
  }, [notification.id, onClose]);

  return (
    <NotificationCardWrapper>
      <NotificationCard $type={notification.type} $isExiting={isExiting}>
        <AppIcon>
          <img src={pluralityLogo} alt="Plurality" />
        </AppIcon>
        <ContentWrapper>
          <HeaderRow>
            <AppName>Plurality</AppName>
            <StatusIcon $type={notification.type}>
              {getStatusIcon(notification.type)}
            </StatusIcon>
          </HeaderRow>
          <Message>{notification.message}</Message>
        </ContentWrapper>
        <CloseButton onClick={handleClose}>
          <CloseOutlined style={{ fontSize: 10 }} />
        </CloseButton>
        <ProgressBar $type={notification.type} $duration={notification.duration} />
      </NotificationCard>
    </NotificationCardWrapper>
  );
};

// Provider component
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback(
    (message: string, type: NotificationType = 'info', duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newNotification: NotificationItem = { id, message, type, duration };

      setNotifications((prev) => {
        // Limit to 5 notifications at once
        const updated = [...prev, newNotification];
        if (updated.length > 5) {
          return updated.slice(-5);
        }
        return updated;
      });
    },
    []
  );

  const success = useCallback(
    (message: string, duration?: number) => showNotification(message, 'success', duration),
    [showNotification]
  );

  const error = useCallback(
    (message: string, duration?: number) => showNotification(message, 'error', duration),
    [showNotification]
  );

  const warning = useCallback(
    (message: string, duration?: number) => showNotification(message, 'warning', duration),
    [showNotification]
  );

  const info = useCallback(
    (message: string, duration?: number) => showNotification(message, 'info', duration),
    [showNotification]
  );

  return (
    <NotificationContext.Provider value={{ showNotification, success, error, warning, info }}>
      {children}
      <NotificationContainer>
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
          />
        ))}
      </NotificationContainer>
    </NotificationContext.Provider>
  );
};

// Hook to use notifications
export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
