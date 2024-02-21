import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Context, ScheduledEvent } from 'aws-lambda';

import { Database, DynamoDBService } from './database';
import { Twitter, TwitterService } from './twitter';
import { Time, TimeService } from './time';
import { DateTime } from 'luxon';

// Must have an AWS profile named EngageMint setup
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' } as any);

export function filterTweets(tweets: any[], ticker: string, username: string): any[] {
	const formattedTicker = ticker.toLowerCase();
	return tweets.filter(tweet => {
		const text = tweet.text.toLowerCase();
		const isRetweetOfSelf = text.startsWith(`rt @${username.toLowerCase()}:`);
		const isAboutTicker = text.includes(`$${formattedTicker}`) || text.includes(`#${formattedTicker}`);
		return isAboutTicker && !isRetweetOfSelf;
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

function verifyFields(tickerConfig: any): boolean {
	const fields = [
		'ticker',
		'epoch_start_date_utc',
		'epoch_length_days',
		'like_multiplier',
		'retweet_multiplier',
		'view_multiplier',
		'video_view_multiplier',
		'quote_multiplier'
	];
	for (const field of fields) {
		if (!tickerConfig[field]) {
			console.error(`${field} is undefined for ticker: ${tickerConfig.ticker.S}. Skipping ticker processing.`);
			return false;
		}
	}
	return true;
}

export const handler = async (_event: ScheduledEvent, _context: Context): Promise<void> => {
	const dbService: Database = new DynamoDBService(client);
	const twitterService: Twitter = new TwitterService();
	const timeService: Time = new TimeService();
	const tickerConfigs = await dbService.fetchAllTickerConfigs();
	for (const tickerConfig of tickerConfigs) {
		if (!verifyFields(tickerConfig)) {
			continue;
		}
		const tickerString = tickerConfig.ticker.S || '';
		const firstEpochStartDate = tickerConfig.epoch_start_date_utc.S || '';
		const epochLengthDays = Number(tickerConfig.epoch_length_days.N) || 1;
		const likeMultiplier = Number(tickerConfig.like_multiplier.N) || 1;
		const retweetMultiplier = Number(tickerConfig.retweet_multiplier.N) || 1;
		const viewMultiplier = Number(tickerConfig.view_multiplier.N) || 1;
		const videoViewMultiplier = Number(tickerConfig.video_view_multiplier.N) || 1;
		const quoteMultiplier = Number(tickerConfig.quote_multiplier.N) || 1;
		const currentDate = timeService.getCurrentTime();
		const firstEpochStartDateDateTime = DateTime.fromISO(firstEpochStartDate);
		if (firstEpochStartDateDateTime > DateTime.fromJSDate(currentDate)) {
			console.log(`Skipping ticker: ${tickerString} as its epoch has not started yet.`);
			continue;
		}

		const currentEpochNumber = timeService.getCurrentEpochNumber(currentDate, firstEpochStartDate, epochLengthDays);
		const currentEpochStartTime = timeService.getCurrentEpochStartDate(firstEpochStartDate, currentEpochNumber, epochLengthDays).toISOString();

		const users = await dbService.fetchUsersForTicker(tickerString);
		const userStats = [];
		for (const user of users) {
			const adjustedCurrentDate = timeService.getCurrentTime();
			adjustedCurrentDate.setMinutes(adjustedCurrentDate.getMinutes() - 1);
			const endTime = adjustedCurrentDate.toISOString();

			const xUsername = await twitterService.getUsernameById(user.twitter_id);
			if (xUsername === null) {
				console.log(`Skipping user: ${user.twitter_id} as username is not found.`);
				continue;
			}
			const userTweetsMentioningTicker =
				await twitterService.fetchUserTweetsWithTicker(user.twitter_id, tickerString, currentEpochStartTime, endTime);
			const tweets = userTweetsMentioningTicker.tweets;
			if (!tweets || tweets.length === 0) {
				continue;
			}
			const filteredTweets = filterTweets(tweets, tickerString, xUsername);
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
			if (totalPoints === 0) {
				continue;
			}
			const ticker_epoch_composite = `${tickerString}#${currentEpochNumber}`;
			const userStat = {
				ticker_epoch_composite: ticker_epoch_composite,
				user_account_id: user.twitter_id,
				last_updated_at: currentDate.toISOString(),
				username: xUsername,
				total_points: totalPoints,
				favorite_points: likePoints,
				quote_points: quotePoints,
				retweet_points: retweetPoints,
				view_points: viewPoints,
				video_view_points: videoViewPoints,
				rank: 0
			};
			userStats.push(userStat);
		}
		if (userStats.length > 0) {
			// Sort userStats in descending order based on totalPoints
			userStats.sort((a, b) => b.total_points - a.total_points);

			// Assign rank based on the position in the sorted array
			userStats.forEach((userStat, index) => {
				userStat.rank = index + 1;
			});

			// Persist user stats in bulk
			await dbService.persistUserStatsInBulk(userStats);
		}
	}
};
