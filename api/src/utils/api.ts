import { $logger } from '../modules/logget';

export function toResponse<T>(data: T) {
    return { response: data };
}

export function logError(err: any) {
    $logger.error({ errorStack: err.stack, errorMessage: err.message }, 'Error');
}
