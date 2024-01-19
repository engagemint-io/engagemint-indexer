import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { Context, ScheduledEvent } from 'aws-lambda';
import { TweetSearchRecentV2Paginator, TwitterApi } from 'twitter-api-v2';

import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { secretsManagerClient } from './utils/secretsManagerClient';

export const getSecrets = async () => {
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
};

export const getTwitterApiClient = async () => {
	const { appKey, appSecret } = await getSecrets();
	const twitterConsumerClient = new TwitterApi({
		appKey: appKey,
		appSecret: appSecret
	});
	return await twitterConsumerClient.appLogin();
};

// Must have an AWS profile named EngageMint setup
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' } as any);

const docClient = DynamoDBDocumentClient.from(client);

export const fetchAllTickerConfigs = async () => {
	const params = {
		TableName: 'engagemint-project_configuration_table'
	};

	try {
		const { Items } = await docClient.send(new ScanCommand(params));
		return Items || [];
	} catch (err) {
		console.error('Error querying DynamoDB:', err);
		return [];
	}
};

export const fetchUsersForTicker = async (ticker: string) => {
	const params = {
		TableName: 'engagemint-registered_users_table',
		KeyConditionExpression: 'ticker = :ticker',
		ExpressionAttributeValues: {
			':ticker': ticker
		}
	};

	try {
		const { Items } = await docClient.send(new QueryCommand(params));
		return Items || [];
	} catch (err) {
		console.error('Error querying DynamoDB:', err);
		return [];
	}
};

const fetchUserTweetsWithTicker = async (user: string, ticker: string, startTime: string, endTime: string): Promise<TweetSearchRecentV2Paginator> => {
	try {
		const twitterConsumerClient = await getTwitterApiClient();
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
};

export const handler = async (event: ScheduledEvent, _context: Context): Promise<void> => {
	console.info('HANDLING_EVENT: ', JSON.stringify(event));

	const tickerConfigs = await fetchAllTickerConfigs();
	for (const tickerConfig of tickerConfigs) {
		const tickerString = tickerConfig.ticker.S || '';
		const epochStartDate = tickerConfig.epoch_start_date_utc.S || '';

		const users = await fetchUsersForTicker(tickerString);

		for (const user of users) {
			// Get current time
			let currentDate = new Date();

			// Subtract 1 minute as per Twitter API docs 'end_time' must be a minimum of 10 seconds prior to the request time.
			// we subtract 1 minute to be safe
			currentDate.setMinutes(currentDate.getMinutes() - 1);

			// We need RFC3339 format per Twitter API docs. The toISOString() method in JavaScript returns a string in
			// simplified extended ISO format (ISO 8601), which is functionally equivalent to the RFC3339 datetime format.
			// Therefore, we can use toISOString() to get a date-time string that is compatible with both ISO 8601 and RFC3339.
			const endTime = currentDate.toISOString();

			const userTweetsMentioningTicker = await fetchUserTweetsWithTicker(user.twitter_id, tickerString, epochStartDate, endTime);
			const tweets = userTweetsMentioningTicker.tweets;
			const includes = userTweetsMentioningTicker.includes;

			for (const tweet of tweets) {
				console.log('Tweet:', tweet);
				// const likes = tweet.public_metrics?.like_count;
				// const retweets = tweet.public_metrics?.retweet_count;
				const attachedMedia = includes.media.filter(m => tweet.attachments?.media_keys?.includes(m.media_key));
				for (const m of attachedMedia) {
					console.log('Media view count:', m.public_metrics?.view_count);
				}
			}

			//TODO: Use the tweetsWithEngagement to create/update the users entry into the engagemint-epoch_leaderboard_table
		}
	}
};
