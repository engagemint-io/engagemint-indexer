import { filterTweets } from '../../../handler';

describe('filterTweets function', () => {
	const ticker = 'TESTSEITOKEN';
	const username = 'testuser';
	it('should filter tweets that contain the ticker with $ or #', () => {

		const tweets = [
			{
				text: `Post containing token name $${ticker}`
			},
			{
				text: `Post containing token name #${ticker}`
			},
			{
				text: `Post containing token name ${ticker}`
			}
		];
		const result = filterTweets(tweets, ticker, username);
		expect(result).toEqual([
			{
				text: `Post containing token name $${ticker}`
			},
			{
				text: `Post containing token name #${ticker}`
			}
		]);
	});
	it('should not filter out tweets with mixed case $ or #', () => {
		const tweets = [
			{
				text: 'Post containing token name $tESTSEITOKEN'
			},
			{
				text: 'Post containing token name #Testseitoken'
			},
			{
				text: 'Post containing token name TESTSEITOKEN'
			}
		];
		const ticker = 'TESTSEITOKEN';
		const result = filterTweets(tweets, ticker, username);
		expect(result).toEqual([
			{
				text: 'Post containing token name $tESTSEITOKEN'
			},
			{
				text: 'Post containing token name #Testseitoken'
			}
		]);
	});
	it('should filter out retweets of own user tweets', () => {
		const tweets = [
			{
				text: `RT @${username}: Post containing token name $${ticker}`
			},
			{
				text: `RT @${username}: Post containing token name #${ticker}`
			},
			{
				text: `RT @${username}: Post containing token name ${ticker}`
			}
		];
		const result = filterTweets(tweets, ticker, username);
		expect(result).toEqual([]);
	});

	it('should filter out retweets of own user tweets, but let others through', () => {
		const tweets = [
			{
				text: `RT @${username}: Post containing token name $${ticker}`
			},
			{
				text: `RT @${username}: Post containing token name #${ticker}`
			},
			{
				text: `RT @${username}: Post containing token name ${ticker}`
			},
			{
				text: 'Post containing token name $tESTSEITOKEN'
			}
		];
		const result = filterTweets(tweets, ticker, username);
		expect(result).toEqual([{
			text: 'Post containing token name $tESTSEITOKEN'
		}]);
	});
});
