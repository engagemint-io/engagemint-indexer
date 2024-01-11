import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';
import { fromIni } from '@aws-sdk/credential-provider-ini';

const profile = 'Sei';
const s3Client = new S3Client({ region: 'us-west-2', credentials: fromIni({ profile }) });
const bucketName = 'engagemint';
const localFilePath = './lambda.zip';

const uploadFile = async () => {
	console.log('Uploading lambda binary...');
	try {
		if (!process.env.GIT_HASH) throw new Error('GIT_HASH env var not set');

		const s3FilePath = `infra/indexer/${process.env.GIT_HASH}.zip`;

		const fileData = await readFile(localFilePath);

		const params = {
			Bucket: bucketName,
			Key: s3FilePath,
			Body: fileData
		};

		const command = new PutObjectCommand(params);
		await s3Client.send(command);
		console.log(`Lambda binary uploaded successfully to ${bucketName}/${s3FilePath}!`);
	} catch (err) {
		console.error('Error uploading lambda binary:', err);
	}
};

uploadFile();
