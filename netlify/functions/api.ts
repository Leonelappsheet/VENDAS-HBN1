import serverless from 'serverless-http';
import app from '../../server';

const handlerFunc = serverless(app);

export const handler = async (event: any, context: any) => {
  try {
    console.log(`[Function] Handling ${event.httpMethod} ${event.path}`);
    return await handlerFunc(event, context);
  } catch (err: any) {
    console.error('[Function] Fatal Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Function Error', message: err.message, stack: err.stack }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
