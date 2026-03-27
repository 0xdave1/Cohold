declare const _default: (() => {
    app: {
        env: string;
        port: number;
        apiPrefix: string;
        corsOrigin: string;
    };
    elasticsearch: {
        node: string | undefined;
    };
    db: {
        url: string | undefined;
    };
    redis: {
        url: string | undefined;
    };
    jwtUser: {
        secret: string | undefined;
        accessTtl: string;
        refreshTtl: string;
        audience: string;
    };
    jwtAdmin: {
        secret: string | undefined;
        accessTtl: string;
        refreshTtl: string;
        audience: string;
    };
    paystack: {
        secretKey: string | undefined;
        webhookSecret: string | undefined;
    };
    s3: {
        accessKey: string | undefined;
        secretKey: string | undefined;
        bucket: string | undefined;
        region: string | undefined;
        endpoint: string | undefined;
    };
    email: {
        apiKey: string | undefined;
        from: string | undefined;
    };
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    app: {
        env: string;
        port: number;
        apiPrefix: string;
        corsOrigin: string;
    };
    elasticsearch: {
        node: string | undefined;
    };
    db: {
        url: string | undefined;
    };
    redis: {
        url: string | undefined;
    };
    jwtUser: {
        secret: string | undefined;
        accessTtl: string;
        refreshTtl: string;
        audience: string;
    };
    jwtAdmin: {
        secret: string | undefined;
        accessTtl: string;
        refreshTtl: string;
        audience: string;
    };
    paystack: {
        secretKey: string | undefined;
        webhookSecret: string | undefined;
    };
    s3: {
        accessKey: string | undefined;
        secretKey: string | undefined;
        bucket: string | undefined;
        region: string | undefined;
        endpoint: string | undefined;
    };
    email: {
        apiKey: string | undefined;
        from: string | undefined;
    };
}>;
export default _default;
