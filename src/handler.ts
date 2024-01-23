import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { Context, ScheduledEvent } from 'aws-lambda';
import { TweetSearchRecentV2Paginator, TwitterApi } from 'twitter-api-v2';
import { DateTime } from 'luxon';

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

export const getUsernameById = async (userId: string) => {
	const twitterConsumerClient = await getTwitterApiClient();
	try {
		const user = await twitterConsumerClient.v2.user(userId);
		return user.data.username;
	} catch (err) {
		console.error('Error fetching user profile:', err);
		return null;
	}
};

export const persistToLeaderboardTable = async (ticker: string,
																								userAccountId: string,
																								username: string,
																								epoch: string,
																								totalPoints: number,
																								likePoints: number,
																								quotePoints: number,
																								retweetPoints: number,
																								viewPoints: number,
																								videoViewPoints: number) => {
	const ticker_epoch_composite = `${epoch}#${ticker}`;

	const params = {
		TableName: 'engagemint-epoch_leaderboard_table',
		Item: {
			ticker_epoch_composite: ticker_epoch_composite,
			user_account_id: userAccountId,
			username: username,
			last_updated_at: new Date().toISOString(),
			total_points: totalPoints,
			favorite_points: likePoints,
			quote_points: quotePoints,
			retweet_points: retweetPoints,
			view_points: viewPoints,
			video_view_points: videoViewPoints
		}
	};

	try {
		await docClient.send(new PutCommand(params));
		console.log(`Successfully persisted data for ${ticker_epoch_composite}`);
	} catch (err) {
		console.error('Error persisting data to DynamoDB:', err);
	}
};

export function getCurrentEpochNumber(now: Date, epochStartDate: string, epochLengthDays: number): number {
	const startDate = DateTime.fromISO(epochStartDate);
	let nowDateTime = DateTime.fromJSDate(now);

	// Adding one second to the current date to account for the edge case when we run job at the exact start of an hour
	// e.g. 2024-01-23T00:00:00.000Z and in this case we could incorrectly return the previous epoch number.
	nowDateTime = nowDateTime.plus({ seconds: 1 });
	if (nowDateTime < startDate) {
		throw new Error('Invalid date. The current date cannot be before the epoch start date.');
	}

	// Edge case where the epoch start date is the same as the current date. Which means the epoch just started.
	if (nowDateTime.equals(startDate)) {
		return 1;
	}

	const diffInDays = nowDateTime.diff(startDate, 'days').days;

	return Math.ceil(diffInDays / epochLengthDays);
}

export function getCurrentEpochStartDate(firstEpochStartDate: string, currentEpochNumber: number, epochLengthDays: number): Date {
	let startDate = DateTime.fromISO(firstEpochStartDate);
	// If the current epoch number is 0, return the start date of the first epoch
	if (currentEpochNumber <= 0) {
		throw new Error('Invalid epoch. The current epoch can only be 1 or greater.');
	}
	// Subtract 1 from the currentEpochNumber because the first epoch is considered as 1
	const daysToAdd = (currentEpochNumber - 1) * epochLengthDays;
	startDate = startDate.plus({ days: daysToAdd });
	return startDate.toJSDate();
}

export function filterTweets(tweets: any[], ticker: string): any[] {
	return tweets.filter(tweet => {
		const tickerWithDollar = `$${ticker}`;
		const tickerWithHash = `#${ticker}`;
		return tweet.text.includes(tickerWithDollar) || tweet.text.includes(tickerWithHash);
	});
}

// Function to calculate points
function calculatePoints(tweet: any, includes: any, multipliers: any): any {
	const { likeMultiplier, quoteMultiplier, retweetMultiplier, viewMultiplier, videoViewMultiplier } = multipliers;
	let likePoints = 0;
	let quotePoints = 0;
	let retweetPoints = 0;
	let viewPoints = 0;
	let videoViewPoints = 0;

	const likes = tweet.public_metrics?.like_count || 0;
	likePoints += likes * likeMultiplier;
	const quotes = tweet.public_metrics?.quote_count || 0;
	quotePoints += quotes * quoteMultiplier;
	const retweets = tweet.public_metrics?.retweet_count || 0;
	retweetPoints += retweets * retweetMultiplier;
	const views = tweet.public_metrics?.impression_count || 0;
	viewPoints += views * viewMultiplier;

	const attachedMedia = includes.media.filter((m: any) => tweet.attachments?.media_keys?.includes(m.media_key));
	for (const m of attachedMedia) {
		videoViewPoints += (m.public_metrics?.view_count || 0) * videoViewMultiplier;
	}

	const totalPoints = likePoints + quotePoints + retweetPoints + viewPoints + videoViewPoints;
	return { totalPoints, likePoints, quotePoints, retweetPoints, viewPoints, videoViewPoints };
}

export const handler = async (event: ScheduledEvent, _context: Context): Promise<void> => {
	console.info(JSON.stringify(event));

	const tickerConfigs = await fetchAllTickerConfigs();
	for (const tickerConfig of tickerConfigs) {
		const tickerString = tickerConfig.ticker.S || '';
		const firstEpochStartDate = tickerConfig.epoch_start_date_utc.S || '';
		const epochLengthDays = Number(tickerConfig.epoch_length_days.N) || 1;
		const likeMultiplier = Number(tickerConfig.like_multiplier.N) || 1;
		const retweetMultiplier = Number(tickerConfig.retweet_multiplier.N) || 1;
		const viewMultiplier = Number(tickerConfig.view_multiplier.N) || 1;
		const videoViewMultiplier = Number(tickerConfig.video_view_multiplier.N) || 1;
		const quoteMultiplier = Number(tickerConfig.quote_multiplier.N) || 1;
		const currentEpochNumber = getCurrentEpochNumber(new Date(), firstEpochStartDate, epochLengthDays);
		const currentEpochStartTime = getCurrentEpochStartDate(firstEpochStartDate, currentEpochNumber, epochLengthDays).toISOString();

		const users = await fetchUsersForTicker(tickerString);

		for (const user of users) {
			let currentDate = new Date();
			currentDate.setMinutes(currentDate.getMinutes() - 1);
			const endTime = currentDate.toISOString();

			const xUsername = await getUsernameById(user.twitter_id) || '';
			const userTweetsMentioningTicker =
				await fetchUserTweetsWithTicker(user.twitter_id, tickerString, currentEpochStartTime, endTime);
			const tweets = userTweetsMentioningTicker.tweets;
			if (!tweets || tweets.length === 0) {
				continue;
			}
			const filteredTweets = filterTweets(tweets, tickerString);
			const includes = userTweetsMentioningTicker.includes;

			let likePoints = 0;
			let quotePoints = 0;
			let retweetPoints = 0;
			let viewPoints = 0;
			let videoViewPoints = 0;

			for (const tweet of filteredTweets) {
				const points = calculatePoints(tweet, includes, {
					likeMultiplier,
					quoteMultiplier,
					retweetMultiplier,
					viewMultiplier,
					videoViewMultiplier
				});
				likePoints += points.likePoints;
				quotePoints += points.quotePoints;
				retweetPoints += points.retweetPoints;
				viewPoints += points.viewPoints;
				videoViewPoints += points.videoViewPoints;
			}

			const totalPoints = likePoints + quotePoints + retweetPoints + viewPoints + videoViewPoints;
			await persistToLeaderboardTable(
				tickerString,
				user.twitter_id,
				xUsername,
				currentEpochNumber.toString(),
				totalPoints,
				likePoints,
				quotePoints,
				retweetPoints,
				viewPoints,
				videoViewPoints);
		}
	}
};
