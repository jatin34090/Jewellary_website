import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";

/** Error envelope used by every failed response: `{ success: false, error }`. */
export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string[];
    path: string;
    timestamp: string;
  };
}

const STATUS_CODES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: "BAD_REQUEST",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.TOO_MANY_REQUESTS]: "RATE_LIMITED",
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      let message = exception.message;
      let details: string[] | undefined;

      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object") {
        const raw = (body as { message?: unknown }).message;
        if (Array.isArray(raw)) {
          message = "Validation failed";
          details = raw.map(String);
        } else if (typeof raw === "string") {
          message = raw;
        }
      }

      const envelope: ErrorEnvelope = {
        success: false,
        error: {
          code: STATUS_CODES[status] ?? "ERROR",
          message,
          ...(details ? { details } : {}),
          path: request.url,
          timestamp,
        },
      };
      response.status(status).json(envelope);
      return;
    }

    // Unknown errors: log the full error server-side, never leak internals to the client.
    this.logger.error(
      `Unhandled error on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const envelope: ErrorEnvelope = {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
        path: request.url,
        timestamp,
      },
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(envelope);
  }
}
