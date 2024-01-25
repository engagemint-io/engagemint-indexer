import { BatchWriteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

export interface Database {
	fetchAllTickerConfigs(): Promise<any[]>;
	fetchUsersForTicker(ticker: string): Promise<any[]>;
	persistUserStatsInBulk(userStats: any[]): Promise<void>;
}

export class DynamoDBService implements Database {
	private docClient: DynamoDBDocumentClient;

	constructor(client: DynamoDBClient) {
		this.docClient = DynamoDBDocumentClient.from(client);
	}

	async fetchAllTickerConfigs() {
		const params = {
			TableName: 'engagemint-project_configuration_table'
		};

		try {
			const { Items } = await this.docClient.send(new ScanCommand(params));
			return Items || [];
		} catch (err) {
			console.error('Error querying DynamoDB:', err);
			return [];
		}
	}

	async fetchUsersForTicker(ticker: string) {
		const params = {
			TableName: 'engagemint-registered_users_table',
			KeyConditionExpression: 'ticker = :ticker',
			ExpressionAttributeValues: {
				':ticker': ticker
			}
		};

		try {
			const { Items } = await this.docClient.send(new QueryCommand(params));
			return Items || [];
		} catch (err) {
			console.error('Error querying DynamoDB:', err);
			return [];
		}
	}

	async persistUserStatsInBulk(userStats: any[]): Promise<void> {
		const BATCH_SIZE = 20;

		// Helper function to split an array into chunks
		const chunkArray = (array: any[], chunkSize: number) => {
			const chunks = [];
			for (let i = 0; i < array.length; i += chunkSize) {
				chunks.push(array.slice(i, i + chunkSize));
			}
			return chunks;
		};

		// Split userStats into chunks of BATCH_SIZE
		const userStatsChunks = chunkArray(userStats, BATCH_SIZE);

		// Iterate over the chunks and send each chunk to DynamoDB
		for (const userStatsChunk of userStatsChunks) {
			const params = {
				RequestItems: {
					'LeaderboardTable': userStatsChunk.map(userStat => ({
						PutRequest: {
							Item: userStat
						}
					}))
				}
			};
			await this.docClient.send(new BatchWriteCommand(params));
		}
	}
}