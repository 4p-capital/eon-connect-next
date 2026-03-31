"use client";

import { Component, type ReactNode } from "react";
import { sanitizeError, type SanitizedError } from "@/utils/errorHandler";
import { ErrorDisplay } from "./ErrorDisplay";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  sanitizedError: SanitizedError | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, sanitizedError: null };
  }

  static getDerivedStateFromError(error: Error): State {
    const sanitizedError = sanitizeError(error);
    return { hasError: true, sanitizedError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(error, {
      component: "ErrorBoundary",
      componentStack: errorInfo.componentStack || undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorDisplay
          error={this.state.sanitizedError || undefined}
          showReload={true}
          showHome={false}
        />
      );
    }
    return this.props.children;
  }
}
