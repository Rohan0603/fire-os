/**
 * Firebase Cloud Function entry for the assistant proxy.
 *
 * Deploy (once):  firebase functions:secrets:set OPENROUTER_API_KEY
 * Deploy:         firebase deploy --only functions:assistantProxy,hosting
 *
 * Local development uses `npm run dev` in this directory instead.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import app from './server.js';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const openRouterApiKey = defineSecret('OPENROUTER_API_KEY');

export const assistantProxy = onRequest(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
    cors: false,
    secrets: [openRouterApiKey],
  },
  (req, res) => {
    if (!process.env.OPENROUTER_API_KEY) {
      process.env.OPENROUTER_API_KEY = openRouterApiKey.value();
    }
    return app(req, res);
  },
);
