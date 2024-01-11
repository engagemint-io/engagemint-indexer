require('dotenv').config();

import event from './event-cloudwatch-event.json';
import { handler } from '../src/handler';

handler(event as any, {} as any).then();
