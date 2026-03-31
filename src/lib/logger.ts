/**
 * Sistema de logging centralizado
 * Preparado para integração com Sentry ou outro serviço de monitoramento
 *
 * Para integrar com Sentry:
 * 1. npm install @sentry/nextjs
 * 2. Descomentar as linhas marcadas com [SENTRY]
 * 3. Configurar sentry.client.config.ts e sentry.server.config.ts
 */

// [SENTRY] import * as Sentry from "@sentry/nextjs";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  userId?: string;
  component?: string;
  action?: string;
  [key: string]: unknown;
}

class Logger {
  private isDev = process.env.NODE_ENV !== "production";

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext) {
    if (this.isDev) {
      console.log(this.formatMessage("info", message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.isDev) {
      console.warn(this.formatMessage("warn", message, context));
    }
    // [SENTRY] Sentry.captureMessage(message, { level: "warning", extra: context });
  }

  error(error: Error | string, context?: LogContext) {
    const message = error instanceof Error ? error.message : error;
    const errorObj = error instanceof Error ? error : new Error(message);

    if (this.isDev) {
      console.error(this.formatMessage("error", message, context));
      console.error(errorObj);
    }

    // [SENTRY] Sentry.captureException(errorObj, { extra: context });
  }

  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  /**
   * Registra um breadcrumb para rastreamento
   * Útil para entender a sequência de eventos antes de um erro
   */
  breadcrumb(message: string, category: string, data?: Record<string, unknown>) {
    if (this.isDev) {
      console.log(`[BREADCRUMB] [${category}] ${message}`, data || "");
    }
    // [SENTRY] Sentry.addBreadcrumb({ message, category, data, level: "info" });
  }

  /**
   * Define contexto do usuário para rastreamento de erros
   */
  setUser(user: { id: string; email?: string; name?: string }) {
    // [SENTRY] Sentry.setUser(user);
    if (this.isDev) {
      console.log("[LOGGER] User context set:", user.id);
    }
  }

  /**
   * Limpa contexto do usuário (logout)
   */
  clearUser() {
    // [SENTRY] Sentry.setUser(null);
    if (this.isDev) {
      console.log("[LOGGER] User context cleared");
    }
  }
}

export const logger = new Logger();
