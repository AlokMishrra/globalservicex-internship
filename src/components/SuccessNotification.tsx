import { useEffect } from 'react';
import './SuccessNotification.css';

interface SuccessNotificationProps {
    isOpen: boolean;
    message: string;
    onClose: () => void;
    duration?: number;
}

export const SuccessNotification = ({
    isOpen,
    message,
    onClose,
    duration = 3000
}: SuccessNotificationProps) => {
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isOpen, duration, onClose]);

    if (!isOpen) return null;

    return (
        <div className="success-notification">
            <div className="success-notification-content">
                <div className="success-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <p className="success-message">{message}</p>
                <button className="success-close" onClick={onClose}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </div>
    );
};
