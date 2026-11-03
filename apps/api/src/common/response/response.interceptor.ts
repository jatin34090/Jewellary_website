import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";

/** Success envelope used by every JSON response: `{ success: true, data }`. */
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<T | null>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T | null>> {
    return next.handle().pipe(map((data) => ({ success: true as const, data: data ?? null })));
  }
}
