// Import DynamoDBService class from the correct file
import { handler } from '../../../handler';
import { jest } from '@jest/globals';
import { Context, ScheduledEvent } from 'aws-lambda';

describe('Handler tests', function() {

	const username = 'testuser';
	const twitterId = '123';
	const testTicker = 'TESTTICKER';

	const likeMultiplier = 2;
	const quoteMultiplier = 6;
	const retweetMultiplier = 3;
	const viewMultiplier = 4;
	const videoViewMultiplier = 5;

	it('Verifies no user points persisted there are no tweets for a user', async () => {
		mockFetchAllTickerConfigs.mockImplementation(() => [{
			ticker: { S: testTicker },
			epoch_start_date_utc: { S: '2024-01-16T00:00:00+00:00' },
			epoch_length_days: { N: '7' },
			like_multiplier: { N: likeMultiplier.toString() },
			retweet_multiplier: { N: retweetMultiplier.toString() },
			view_multiplier: { N: viewMultiplier.toString() },
			video_view_multiplier: { N: videoViewMultiplier.toString() },
			quote_multiplier: { N: quoteMultiplier.toString() }
		}]);

		mockFetchUsersForTicker.mockImplementation(() => [{ twitter_id: twitterId }]);
		mockGetCurrentTime.mockImplementation(() => new Date('2024-01-18T00:00:00+00:00'));
		mockGetCurrentEpochNumber.mockImplementation(() => 1);
		mockGetCurrentEpochStartDate.mockImplementation(() => new Date('2024-01-16T00:00:00+00:00'));

		mockFetchUserTweetsWithTicker.mockImplementation(() => {
			return {
				tweets: []
			};
		});

		mockPersistUserStatsInBulk = jest.fn();
		await handler(payload, null as unknown as Context);
		expect(mockPersistUserStatsInBulk).not.toHaveBeenCalled();
	});

	it('Verifies ticker config is skipped if require field is missing', async () => {
		const consoleSpy = jest.spyOn(console, 'error');
		mockFetchAllTickerConfigs.mockImplementation(() => [{
			ticker: { S: testTicker },
			epoch_length_days: { N: '7' },
			like_multiplier: { N: likeMultiplier.toString() },
			retweet_multiplier: { N: retweetMultiplier.toString() },
			view_multiplier: { N: viewMultiplier.toString() },
			video_view_multiplier: { N: videoViewMultiplier.toString() },
			quote_multiplier: { N: quoteMultiplier.toString() }
		}]);

		mockPersistUserStatsInBulk = jest.fn();
		await handler(payload, null as unknown as Context);
		// Verify that console.error was called
		expect(consoleSpy).toHaveBeenCalled();

		// If you want to verify that console.error was called with a specific message, you can do this:
		expect(consoleSpy).toHaveBeenCalledWith('epoch_start_date_utc is undefined for ticker: TESTTICKER. Skipping ticker processing.');

		expect(mockPersistUserStatsInBulk).not.toHaveBeenCalled();
	});

	it('Verifies no user points persisted when there are no users for a ticker', async () => {
		mockFetchAllTickerConfigs.mockImplementation(() => [{
			ticker: { S: testTicker },
			epoch_start_date_utc: { S: '2024-01-16T00:00:00+00:00' },
			epoch_length_days: { N: '7' },
			like_multiplier: { N: likeMultiplier.toString() },
			retweet_multiplier: { N: retweetMultiplier.toString() },
			view_multiplier: { N: viewMultiplier.toString() },
			video_view_multiplier: { N: videoViewMultiplier.toString() },
			quote_multiplier: { N: quoteMultiplier.toString() }
		}]);

		mockFetchUsersForTicker.mockImplementation(() => []);
		mockGetCurrentTime.mockImplementation(() => new Date('2024-01-18T00:00:00+00:00'));
		mockGetCurrentEpochNumber.mockImplementation(() => 1);
		mockGetCurrentEpochStartDate.mockImplementation(() => new Date('2024-01-16T00:00:00+00:00'));

		mockPersistUserStatsInBulk = jest.fn();
		await handler(payload, null as unknown as Context);
		expect(mockPersistUserStatsInBulk).not.toHaveBeenCalled();
	});

	it('Verifies the handler calculates user points based on 1 tweet', async () => {

		const likeCount = 1;
		const quoteCount = 2;
		const retweetCount = 3;
		const impressionCount = 4;
		const viewCount = 7;
		const nowDateTimeString = '2024-01-18T00:00:00+00:00';

		mockFetchAllTickerConfigs.mockImplementation(() => [{
			ticker: { S: testTicker },
			epoch_start_date_utc: { S: '2024-01-16T00:00:00+00:00' },
			epoch_length_days: { N: '7' },
			like_multiplier: { N: likeMultiplier.toString() },
			retweet_multiplier: { N: retweetMultiplier.toString() },
			view_multiplier: { N: viewMultiplier.toString() },
			video_view_multiplier: { N: videoViewMultiplier.toString() },
			quote_multiplier: { N: quoteMultiplier.toString() }
		}]);

		mockFetchUserTweetsWithTicker.mockImplementation(() => {
			return {
				tweets: [{
					text: 'this is a tweet about $' + testTicker,
					public_metrics: { like_count: likeCount, quote_count: quoteCount, retweet_count: retweetCount, impression_count: impressionCount },
					attachments: { media_keys: ['123'] }
				}], includes: { media: [{ public_metrics: { view_count: viewCount }, media_key: '123' }] }
			};
		});

		mockFetchUsersForTicker.mockImplementation(() => [{ twitter_id: twitterId }]);
		mockGetUsernameById.mockImplementation(() => username);
		mockGetCurrentTime.mockImplementation(() => new Date(nowDateTimeString));
		mockGetCurrentEpochNumber.mockImplementation(() => 1);
		mockGetCurrentEpochStartDate.mockImplementation(() => new Date('2024-01-16T00:00:00+00:00'));

		await handler(payload, null as unknown as Context);

		const likePoints = likeCount * likeMultiplier;
		const quotePoints = quoteCount * quoteMultiplier;
		const retweetPoints = retweetCount * retweetMultiplier;
		const viewPoints = impressionCount * viewMultiplier;
		const videoViewPoints = viewCount * videoViewMultiplier;
		const totalPoints = likePoints + quotePoints + retweetPoints + viewPoints + videoViewPoints;

		expect(mockPersistUserStatsInBulk).toHaveBeenCalledWith([{
			ticker_epoch_composite: `${testTicker}#1`,
			username: username,
			last_updated_at: new Date(nowDateTimeString).toISOString(),
			user_account_id: twitterId,
			favorite_points: likePoints,
			quote_points: quotePoints,
			retweet_points: retweetPoints,
			view_points: viewPoints,
			video_view_points: videoViewPoints,
			total_points: totalPoints,
			rank: 1
		}]);
	});
	it('should skip user if username is not found', async () => {
		const consoleSpy = jest.spyOn(console, 'log');
		const event = {} as ScheduledEvent;
		const context = {} as Context;

		mockFetchAllTickerConfigs.mockImplementation(() => [{
			ticker: { S: testTicker },
			epoch_start_date_utc: { S: '2024-01-16T00:00:00+00:00' },
			epoch_length_days: { N: '7' },
			like_multiplier: { N: likeMultiplier.toString() },
			retweet_multiplier: { N: retweetMultiplier.toString() },
			view_multiplier: { N: viewMultiplier.toString() },
			video_view_multiplier: { N: videoViewMultiplier.toString() },
			quote_multiplier: { N: quoteMultiplier.toString() }
		}]);
		mockFetchUsersForTicker.mockImplementation(() => [{ twitter_id: twitterId }]);
		mockGetUsernameById.mockImplementation(() => null);

		await handler(event, context);

		expect(consoleSpy).toHaveBeenCalledWith(`Skipping user: ${twitterId} as username is not found.`);
	});

	it('should skip ticker if epoch has not started yet', async () => {
		const consoleSpy = jest.spyOn(console, 'log');
		const event = {} as ScheduledEvent;
		const context = {} as Context;

		mockFetchAllTickerConfigs.mockImplementation(() => [{
			ticker: { S: testTicker },
			epoch_start_date_utc: { S: '2024-01-16T00:00:00+00:00' },
			epoch_length_days: { N: '7' },
			like_multiplier: { N: likeMultiplier.toString() },
			retweet_multiplier: { N: retweetMultiplier.toString() },
			view_multiplier: { N: viewMultiplier.toString() },
			video_view_multiplier: { N: videoViewMultiplier.toString() },
			quote_multiplier: { N: quoteMultiplier.toString() }
		}]);
		mockGetCurrentTime.mockImplementation(() => new Date('2024-01-15T00:00:00+00:00'));

		await handler(event, context);

		expect(consoleSpy).toHaveBeenCalledWith(`Skipping ticker: ${testTicker} as its epoch has not started yet.`);
	});
})

// Create a sample payload with CloudWatch scheduled event message format
const payload: ScheduledEvent<any> = {
	'id': 'cdc73f9d-aea9-11e3-9d5a-835b769c0d9c',
	'detail-type': 'Scheduled Event',
	'source': 'aws.events',
	'account': '',
	'time': '1970-01-01T00:00:00Z',
	'region': 'us-west-2',
	'resources': [
		'arn:aws:events:us-west-2:123456789012:rule/ExampleRule'
	],
	'detail': {},
	version: ''
};

jest.mock('../../../database', () => {
	return {
		DynamoDBService: jest.fn().mockImplementation(() => {
			return {
				fetchAllTickerConfigs: mockFetchAllTickerConfigs,
				fetchUsersForTicker: mockFetchUsersForTicker,
				persistUserStatsInBulk: mockPersistUserStatsInBulk
			};
		})
	};
});

let mockFetchAllTickerConfigs = jest.fn();
let mockFetchUsersForTicker = jest.fn();
let mockPersistUserStatsInBulk = jest.fn();

jest.mock('../../../twitter', () => {
	return {
		TwitterService: jest.fn().mockImplementation(() => {
			return {
				getUsernameById: mockGetUsernameById,
				fetchUserTweetsWithTicker: mockFetchUserTweetsWithTicker
			};
		})
	};
});

let mockGetUsernameById = jest.fn();
let mockFetchUserTweetsWithTicker = jest.fn();

jest.mock('../../../time', () => {
	return {
		TimeService: jest.fn().mockImplementation(() => {
			return {
				getCurrentTime: mockGetCurrentTime,
				getCurrentEpochNumber: mockGetCurrentEpochNumber,
				getCurrentEpochStartDate: mockGetCurrentEpochStartDate
			};
		})
	};
});

let mockGetCurrentTime = jest.fn();
let mockGetCurrentEpochNumber = jest.fn();
let mockGetCurrentEpochStartDate = jest.fn();