import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const secretsManagerClient = new SecretsManagerClient({ region: 'us-west-2' });

export { secretsManagerClient };