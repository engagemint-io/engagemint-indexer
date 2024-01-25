import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Context, ScheduledEvent } from 'aws-lambda';
import { DateTime } from 'luxon';

import { Database, DynamoDBService } from './database';
import { Twitter, TwitterService } from './twitter';

// Must have an AWS profile named EngageMint setup
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' } as any);

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

export const handler = async (_event: ScheduledEvent, _context: Context): Promise<void> => {
	console.info(JSON.stringify(_event));
	const dbService: Database = new DynamoDBService(client);
	const twitterService: Twitter = new TwitterService();
	const tickerConfigs = await dbService.fetchAllTickerConfigs();
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

		const users = await dbService.fetchUsersForTicker(tickerString);
		const userStats = [];
		for (const user of users) {
			let currentDate = new Date();
			currentDate.setMinutes(currentDate.getMinutes() - 1);
			const endTime = currentDate.toISOString();

			const xUsername = await twitterService.getUsernameById(user.twitter_id) || '';
			const userTweetsMentioningTicker =
				await twitterService.fetchUserTweetsWithTicker(user.twitter_id, tickerString, currentEpochStartTime, endTime);
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
			const userStat = {
				ticker: tickerString,
				twitter_id: user.twitter_id,
				username: xUsername,
				epoch: currentEpochNumber.toString(),
				totalPoints,
				likePoints,
				quotePoints,
				retweetPoints,
				viewPoints,
				videoViewPoints,
				rank: 0
			};
			userStats.push(userStat);
		}
		if (userStats.length > 0) {
			// Sort userStats in descending order based on totalPoints
			userStats.sort((a, b) => b.totalPoints - a.totalPoints);

			// Assign rank based on the position in the sorted array
			userStats.forEach((userStat, index) => {
				userStat.rank = index + 1;
			});

			// Persist user stats in bulk
			await dbService.persistUserStatsInBulk(userStats);
		}
	}
};
