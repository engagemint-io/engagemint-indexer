import { Time, TimeService } from '../../../time';

const timeService: Time = new TimeService();

describe('getCurrentEpochNumber function', () => {
	it('Returns epoch number 1 for a date within the first epoch', () => {
		const epochStartDate = '2024-01-16T00:00:00+00:00';
		const epochLengthDays = 7;
		const now = new Date('2024-01-18T00:00:00+00:00');
		const result = timeService.getCurrentEpochNumber(now, epochStartDate, epochLengthDays);
		expect(result).toBe(1);
	});

	it('Returns epoch number 1 if epoch just started and start date equals end date', () => {
		const epochStartDate = '2024-01-16T00:00:00+00:00';
		const epochLengthDays = 7;
		const now = new Date('2024-01-16T00:00:00+00:00');
		const result = timeService.getCurrentEpochNumber(now, epochStartDate, epochLengthDays);
		expect(result).toBe(1);
	});

	it('Returns epoch number 2 for a date within the second epoch', () => {
		const epochStartDate = '2024-01-16T00:00:00+00:00';
		const epochLengthDays = 7;
		const now = new Date('2024-01-26T00:00:00+00:00');
		const result = timeService.getCurrentEpochNumber(now, epochStartDate, epochLengthDays);
		expect(result).toBe(2);
	});

	it('Returns epoch number 1 for a date on the boundary of two epochs', () => {
		const epochStartDate = '2024-01-16T00:00:00+00:00';
		const epochLengthDays = 7;
		const now = new Date('2024-01-22T23:59:59+00:00');
		const result = timeService.getCurrentEpochNumber(now, epochStartDate, epochLengthDays);
		expect(result).toBe(1);
	});

	it('Returns epoch 2 for a date on the boundary of two epochs', () => {
		const epochStartDate = '2024-01-16T00:00:00+00:00';
		const epochLengthDays = 7;
		const now = new Date('2024-01-23T00:00:00+00:00');
		const result = timeService.getCurrentEpochNumber(now, epochStartDate, epochLengthDays);
		expect(result).toBe(2);
	});

	it('Returns epoch 2 for a date when close to boundary of two epochs (with one second in)', () => {
		const epochStartDate = '2024-01-16T00:00:00+00:00';
		const epochLengthDays = 7;
		const now = new Date('2024-01-23T00:00:01+00:00');
		const result = timeService.getCurrentEpochNumber(now, epochStartDate, epochLengthDays);
		expect(result).toBe(2);
	});

	it('Throws an error for a date before the start date', () => {
		const epochStartDate = '2022-01-01';
		const epochLengthDays = 7;
		const now = new Date('2021-12-31');
		expect(() => timeService.getCurrentEpochNumber(now, epochStartDate, epochLengthDays)).toThrow('Invalid date. The current date cannot be before the epoch start date.');
	});
});

describe('getCurrentEpochStartDate function', () => {
	it('Returns same start date for the first epoch', () => {
		const firstEpochStartDate = '2024-01-16T00:00:00.000Z';
		const currentEpochNumber = 1;
		const epochLengthDays = 7;
		const result = timeService.getCurrentEpochStartDate(firstEpochStartDate, currentEpochNumber, epochLengthDays);
		expect(result.toISOString()).toBe('2024-01-16T00:00:00.000Z');
	});

	it('Returns the start date exact one week ahead for the second epoch', () => {
		const firstEpochStartDate = '2024-01-16T00:00:00.000Z';
		const currentEpochNumber = 2;
		const epochLengthDays = 7;
		const result = timeService.getCurrentEpochStartDate(firstEpochStartDate, currentEpochNumber, epochLengthDays);
		expect(result.toISOString()).toBe('2024-01-23T00:00:00.000Z');
	});

	it('Throws an error for 0 passed as epoch', () => {
		const firstEpochStartDate = '2024-01-16T00:00:00.000Z';
		const currentEpochNumber = 0;
		const epochLengthDays = 7;
		expect(() => timeService.getCurrentEpochStartDate(firstEpochStartDate, currentEpochNumber, epochLengthDays)).toThrow('Invalid epoch. The current epoch can only be 1 or greater.');
	});

	it('Returns same start date for negative number passed as epoch', () => {
		const firstEpochStartDate = '2024-01-16T00:00:00.000Z';
		const currentEpochNumber = -20;
		const epochLengthDays = 7;
		expect(() => timeService.getCurrentEpochStartDate(firstEpochStartDate, currentEpochNumber, epochLengthDays)).toThrow('Invalid epoch. The current epoch can only be 1 or greater.');
	});
});
