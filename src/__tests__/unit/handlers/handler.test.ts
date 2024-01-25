// Import DynamoDBService class from the correct file
import { handler } from '../../../handler';
import { jest } from '@jest/globals';
import { Context, ScheduledEvent } from 'aws-lambda';

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

describe('Handler tests', function() {
	const testTicker = 'TESTTICKER';
	const username = 'TESTUSER';
	const twitterId = '1234567890';
	// Add a new test to assess the handler
	it('Verifies the handler calls the correct methods', async () => {
		mockFetchAllTickerConfigs.mockImplementation(() => [{
			ticker: { S: testTicker },
			epoch_start_date_utc: { S: '2024-01-16T00:00:00+00:00' },
			epoch_length_days: { N: '7' },
			like_multiplier: { N: '2' },
			retweet_multiplier: { N: '3' },
			view_multiplier: { N: '4' },
			video_view_multiplier: { N: '5' },
			quote_multiplier: { N: '6' }
		}]);

		mockFetchUsersForTicker.mockImplementation(() => [{ twitter_id: twitterId }]);
		mockGetUsernameById.mockImplementation(() => username);
		mockFetchUserTweetsWithTicker.mockImplementation(() => {
			return {
				tweets: [{
					text: 'this is a tweet about $' + testTicker,
					public_metrics: { like_count: 1, quote_count: 2, retweet_count: 3, impression_count: 4 },
					attachments: { media_keys: ['123'] }
				}], includes: { media: [{ public_metrics: { view_count: 7 }, media_key: '123' }] }
			};
		});

		await handler(payload, null as unknown as Context);

		const likePoints = 2;
		const quotePoints = 12;
		const retweetPoints = 9;
		const viewPoints = 16;
		const videoViewPoints = 35;
		const totalPoints = likePoints + quotePoints + retweetPoints + viewPoints + videoViewPoints;

		// ... rest of your test code

		expect(mockPersistUserStatsInBulk).toHaveBeenCalledWith([{
			username: username,
			twitter_id: twitterId,
			ticker: testTicker,
			epoch: 1,
			likePoints: likePoints,
			quotePoints: quotePoints,
			retweetPoints: retweetPoints,
			viewPoints: viewPoints,
			videoViewPoints: videoViewPoints,
			totalPoints: totalPoints,
			rank: 1
		}]);
	});

	// This test invokes the scheduled-event-logger Lambda function and verifies that the received payload is logged
	it('Verifies the payload is logged', async () => {
		// Mock console.log statements so we can verify them. For more information, see
		// https://jestjs.io/docs/en/mock-functions.html
		console.info = jest.fn();
		mockFetchAllTickerConfigs = jest.fn().mockImplementation(() => []);
		await handler(payload, null as unknown as Context);

		// Verify that console.info has been called with the expected payload
		expect(console.info).toHaveBeenCalledWith(JSON.stringify(payload));
	});
});