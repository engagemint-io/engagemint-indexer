import { APIGatewayEventIdentity, APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from './processTweetsLambda';

function createTestEvent(): APIGatewayProxyEvent {
    return {
        body: '', // Provide the necessary body data for testing
        headers: {}, // Provide the necessary headers data for testing
        multiValueHeaders: {}, // Provide the necessary multiValueHeaders data for testing
        httpMethod: '', // Provide the necessary httpMethod data for testing
        isBase64Encoded: false,
        path: '', // Provide the necessary path data for testing
        pathParameters: {}, // Provide the necessary pathParameters data for testing
        queryStringParameters: {}, // Provide the necessary queryStringParameters data for testing
        stageVariables: {}, // Provide the necessary stageVariables data for testing
        requestContext: {
            accountId: '',
            apiId: '',
            authorizer: undefined,
            protocol: '',
            httpMethod: '',
            identity: {} as APIGatewayEventIdentity,
            path: '',
            stage: '',
            requestId: '',
            requestTimeEpoch: 0,
            resourceId: '',
            resourcePath: ''
        }, // Provide the necessary requestContext data for testing
        resource: '',
        multiValueQueryStringParameters: null
    };
}

function createTestContext(): Context {
    return {
        callbackWaitsForEmptyEventLoop: false,
        functionName: 'myFunction',
        functionVersion: '1.0',
        invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:myFunction',
        memoryLimitInMB: '',
        awsRequestId: '',
        logGroupName: '',
        logStreamName: '',
        getRemainingTimeInMillis: function (): number {
            throw new Error('Function not implemented.');
        },
        done: function (error?: Error | undefined, result?: any): void {
            throw new Error('Function not implemented.');
        },
        fail: function (error: string | Error): void {
            throw new Error('Function not implemented.');
        },
        succeed: function (messageOrObject: any): void {
            throw new Error('Function not implemented.');
        }
    };
}


describe('processTweetsLambda', () => {
    it('should return a successful response', async () => {
        const event = createTestEvent();
        const context = createTestContext();

        const result = await handler(event, context);

        expect(result.statusCode).toBe(200);
        expect(result.body).toEqual(JSON.stringify({ message: 'Lambda function executed successfully' }));
    });

    it('should return an error response', async () => {
        const event = createTestEvent();
        const context = createTestContext();

        // Mock the code logic that throws an error
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });

        const result = await handler(event, context);

        expect(result.statusCode).toBe(500);
        expect(result.body).toEqual(JSON.stringify({ message: 'An error occurred' }));

        // Restore the original console methods
        jest.restoreAllMocks();
    });
});