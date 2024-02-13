import { TweetSearchRecentV2Paginator, TwitterApi } from 'twitter-api-v2';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { secretsManagerClient } from './utils/secretsManagerClient';

export interface Twitter {
	getUsernameById(userId: string): Promise<string | null>;
	fetchUserTweetsWithTicker(user: string, ticker: string, startTime: string, endTime: string): Promise<TweetSearchRecentV2Paginator>;
}

export class TwitterService implements Twitter {
	private readonly twitterApiClient: Promise<TwitterApi>;

	constructor() {
		this.twitterApiClient = this.getTwitterApiClient();
	}

	private async getTwitterApiClient(): Promise<TwitterApi> {
		const { appKey, appSecret } = await this.getSecrets();
		const twitterConsumerClient = new TwitterApi({
			appKey: appKey,
			appSecret: appSecret
		});
		return await twitterConsumerClient.appLogin();
	}

	async getUsernameById(userId: string): Promise<string | null> {
		try {
			const twitterConsumerClient = await this.twitterApiClient;
			const user = await twitterConsumerClient.v2.user(userId);
			if (user.errors && user.errors.length > 0) {
				console.error('Error fetching user profile:', user.errors);
				return null;
			}
			return user.data.username;
		} catch (err) {
			console.error('Error fetching user profile:', err);
			return null;
		}
	}

	async fetchUserTweetsWithTicker(user: string, ticker: string, startTime: string, endTime: string): Promise<TweetSearchRecentV2Paginator> {
		try {
			const twitterConsumerClient = await this.twitterApiClient;
			return await twitterConsumerClient.v2.search({
				query: `from:${user} ${ticker}`,
				start_time: startTime,
				end_time: endTime,
				expansions: 'attachments.media_keys',
				'media.fields': 'public_metrics',
				'tweet.fields': 'public_metrics'
			});
		} catch (err) {
			console.error('Error:', err);
			return {} as TweetSearchRecentV2Paginator;
		}
	}

	private async getSecrets() {
		const command = new GetSecretValueCommand({
			SecretId: 'engagemint-x-credentials'
		});
		const secrets = await secretsManagerClient.send(command);
		if (!secrets.SecretString) {
			return {};
		}
		const parsedSecrets = JSON.parse(secrets.SecretString);
		return {
			appKey: parsedSecrets.X_API_KEY,
			appSecret: parsedSecrets.X_API_SECRET
		};
	}
}