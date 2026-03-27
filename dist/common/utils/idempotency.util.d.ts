export declare class IdempotencyService {
    executeOnce<T>(_reference: string, handler: () => Promise<T>): Promise<T>;
}
