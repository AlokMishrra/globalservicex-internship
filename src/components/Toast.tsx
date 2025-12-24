import React, { useEffect } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
    message,
    type = 'info',
    duration = 4000,
    onClose
}) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success':
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" />
                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'error':
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" />
                        <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                );
            case 'warning':
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 20h20L12 2z" fill="currentColor" opacity="0.2" />
                        <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                );
            case 'info':
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" />
                        <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                );
        }
    };

    return (
        <div className={`toast toast-${type}`}>
            <div className="toast-icon">
                {getIcon()}
            </div>
            <div className="toast-message">{message}</div>
            <button className="toast-close" onClick={onClose} aria-label="Close">
                ✕
            </button>
        </div>
    );
};

// Toast Container Component
interface ToastContainerProps {
    toasts: Array<{ id: string; message: string; type: ToastType }>;
    onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={() => onRemove(toast.id)}
                />
            ))}
        </div>
    );
};
