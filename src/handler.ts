import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { Context, ScheduledEvent } from 'aws-lambda';

// import Twit from 'twit';
//
// // Configure Twit
// const TwitClient = new Twit({
//     consumer_key: process.env.TWITTER_CONSUMER_KEY || '',
//     consumer_secret: process.env.TWITTER_CONSUMER_SECRET || '',
//     access_token: process.env.TWITTER_ACCESS_TOKEN || '',
//     access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET || '',
//     timeout_ms: 60 * 1000,
// });

// Must have an AWS profile named EngageMint setup
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' } as any);

const docClient = DynamoDBDocumentClient.from(client);

export const fetchAllTickers = async () => {
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

// @ts-ignore
const fetchUserTweetsWithTicker = async (user: string, ticker: string, since: string, until: string) => {
	// const params = {
	//     q: `from:${user} AND ($${ticker} OR #${ticker}) since:${since} until:${until}`,
	//     count: 100,
	// };

	try {
		// const { data } = await TwitClient.get('search/tweets', params);
		//Simply return the tweets here
		// @ts-ignore
		// return data["statuses"];
		return [];
	} catch (err) {
		console.error('Error:', err);
		return [];
	}
};

export const queryEngagement = (tweets: any[]): any[] => {
	console.log('tweets', tweets);

	//TODO: Iterate through tweets and query twitter engagement API to get engagement metrics
	return [];
};

export const handler = async (event: ScheduledEvent, _context: Context): Promise<void> => {
	console.info('HANDLING_EVENT: ', JSON.stringify(event));

	// TODO: Fetch tickers from DynamoDB engagemint-project_configuration_table
	const tickers = await fetchAllTickers();
	console.log('tickers', tickers);
	for (const ticker of tickers) {
		const tickerString = ticker.ticker.S || '';

		//TODO: Fetch users from DynamoDB engagemint-registered_users_table by ticker
		const users = await fetchUsersForTicker(tickerString);

		for (const user of users) {
			const since = '2022-01-01';
			const until = '2022-01-31';

			const userTweetsMentioningTicker = await fetchUserTweetsWithTicker(user.twitter_id, tickerString, since, until);
			console.log('userTweetsMentioningTicker', userTweetsMentioningTicker);

			//TODO: Iterate through tweets and query twitter engagement API

			// const tweetsWithEngagement = queryEngagement(userTweetsMentioningTicker);

			//TODO: Use the tweetsWithEngagement to create/update the users entry into the engagemint-epoch_leaderboard_table
		}
	}
};
