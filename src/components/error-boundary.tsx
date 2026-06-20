'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md w-full text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              Error al cargar el componente
            </h3>
            <p className="text-sm text-red-600 dark:text-red-300 mb-4">
              Ocurrió un error inesperado. Por favor, intente nuevamente.
            </p>
            {this.state.error && (
              <p className="text-xs text-red-400 mb-4 font-mono bg-red-100 p-2 rounded overflow-auto max-h-20">
                {this.state.error.message}
              </p>
            )}
            <Button
              onClick={this.handleRetry}
              variant="outline"
              className="bg-red-50 border-red-300 text-red-700 dark:text-red-300 hover:bg-red-100 hover:text-red-800 dark:text-red-200"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
