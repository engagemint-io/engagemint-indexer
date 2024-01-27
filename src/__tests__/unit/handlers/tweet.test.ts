import { filterTweets } from '../../../handler';

describe('filterTweets function', () => {
	it('should filter tweets that contain the ticker with $ or #', () => {
		const tweets = [
			{
				text: 'Post containing token name $TESTSEITOKEN',
			},
			{
				text: 'Post containing token name #TESTSEITOKEN',
			},
			{
				text: 'Post containing token name TESTSEITOKEN',
			},
		];
		const ticker = 'TESTSEITOKEN';
		const result = filterTweets(tweets, ticker);
		expect(result).toEqual([
			{
				text: 'Post containing token name $TESTSEITOKEN',
			},
			{
				text: 'Post containing token name #TESTSEITOKEN',
			},
		]);
	});
	it('should not filter out tweets with mixed case $ or #', () => {
		const tweets = [
			{
				text: 'Post containing token name $tESTSEITOKEN',
			},
			{
				text: 'Post containing token name #Testseitoken',
			},
			{
				text: 'Post containing token name TESTSEITOKEN',
			},
		];
		const ticker = 'TESTSEITOKEN';
		const result = filterTweets(tweets, ticker);
		expect(result).toEqual([
			{
				text: 'Post containing token name $tESTSEITOKEN'
			},
			{
				text: 'Post containing token name #Testseitoken',
			},
		]);
	});
});
