import { DynamoDB } from 'aws-sdk';
import { Context, ScheduledEvent } from 'aws-lambda';
import Twit from 'twit';

const T = new Twit({
  consumer_key: '...',
  consumer_secret: '...',
  access_token: '...',
  access_token_secret: '...',
  timeout_ms: 60 * 1000,  // optional HTTP request timeout to apply to all requests.
});

const dynamoDB = new DynamoDB.DocumentClient();

export const scheduledTweetHandler = async (event: ScheduledEvent<any>, context: Context): Promise<void> => {
  console.info(JSON.stringify(event));

  const since = '2022-01-01';  // Start date (YYYY-MM-DD)
  const until = '2022-01-31';  // End date (YYYY-MM-DD)

  // Query project_configuration_table to get all projects tickers
  const tickers: string[] = []; // Replace with actual tickers

  for (let ticker of tickers) {
    const users: string[] = []; // Get all the registered users for a given ticker from registered_users_table

    for (let user of users) {
      const params = {
        q: `from:${user} AND ($${ticker} OR #${ticker}) since:${since} until:${until}`,
        count: 100,
      };

      try {
        const { data } = await T.get('search/tweets', params);
        const tweets = data.statuses;

        // Using the engagement API query all the engagement metrics for each tweet
        const engagementInfos = await queryEngagement(tweets);

        for (let info of engagementInfos) {
          const params = {
            TableName: 'YourDynamoDBTableName',
            Item: info
          };

          try {
            await dynamoDB.put(params).promise();
          } catch (err) {
            console.error('Error saving to DynamoDB:', err);
          }
        }

        // Create entry in epoch_leaderboard_table with ticker/epoch composite
      } catch (err) {
        console.error('Error:', err);
      }

      // Add a delay between requests to avoid hitting the rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function queryEngagement(tweets: any[]): Promise<any[]> {
  return tweets.map(tweet => ({
    id: tweet.id_str,
    text: tweet.text,
    user: tweet.user.screen_name,
    retweet_count: tweet.retweet_count,
    favorite_count: tweet.favorite_count,
    // reply_count is not available in the tweet object
  }));
}