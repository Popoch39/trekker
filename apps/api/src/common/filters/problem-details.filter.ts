import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  PROBLEM_CONTENT_TYPE,
  type ProblemDetails,
  type ValidationIssue,
} from '@repo/contracts';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

/**
 * Traduit toute exception en reponse RFC 9457 (`application/problem+json`).
 *
 * Un seul format d'erreur pour toute l'API : le front web et le client mobile
 * partagent le meme parseur, y compris pour les erreurs de validation.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const problem = this.toProblem(exception, request);

    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception);
    }

    response.status(problem.status).type(PROBLEM_CONTENT_TYPE).json(problem);
  }

  private toProblem(
    exception: unknown,
    request: Request,
  ): ProblemDetails & { errors?: ValidationIssue[] } {
    const base = {
      type: 'about:blank',
      instance: request.originalUrl,
      requestId: this.requestId(request),
    };

    if (exception instanceof ZodValidationException) {
      return {
        ...base,
        type: 'https://datatracker.ietf.org/doc/html/rfc9457#name-validation',
        title: 'Validation Failed',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'La requete contient des champs invalides.',
        errors: this.toValidationIssues(exception),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      return {
        ...base,
        title: this.titleFor(status),
        status,
        detail:
          typeof payload === 'string'
            ? payload
            : this.detailFromPayload(payload, exception.message),
      };
    }

    return {
      ...base,
      title: this.titleFor(HttpStatus.INTERNAL_SERVER_ERROR),
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'Une erreur inattendue est survenue.',
    };
  }

  private toValidationIssues(
    exception: ZodValidationException,
  ): ValidationIssue[] {
    const error = exception.getZodError();

    if (!(error instanceof ZodError)) {
      return [];
    }

    return error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
  }

  private detailFromPayload(payload: object, fallback: string): string {
    const message = (payload as { message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return fallback;
  }

  private requestId(request: Request): string | undefined {
    const id = (request as { id?: unknown }).id;

    return typeof id === 'string' ? id : undefined;
  }

  /** Libelle stable derive du code HTTP (`NOT_FOUND` -> `Not Found`). */
  private titleFor(status: number): string {
    const name = HttpStatus[status] as string | undefined;

    if (!name) {
      return 'Error';
    }

    return name
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
