const dotenv = require('dotenv');
try {
  dotenv.config();
} catch (e) {
  // ignore if dotenv is not available
}

async function main() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('TEST_RESULT:FAIL:Missing GEMINI_API_KEY in environment or .env file');
      process.exit(1);
    }

    const { generateText } = require('../utils/geminiClient');

    const start = Date.now();
    const text = await generateText('Reply with exactly the word OK.', {
      maxTokens: 16,
      temperature: 0,
    });
    const durationMs = Date.now() - start;

    console.log(
      'TEST_RESULT:OK:' +
        JSON.stringify({
          output: text,
          durationMs,
        }),
    );
    process.exit(0);
  } catch (err) {
    const simplified = {
      name: err.name,
      message: err.message,
      status: err.status,
      code: err.code,
    };
    console.error('TEST_RESULT:ERROR:' + JSON.stringify(simplified));
    process.exit(1);
  }
}

main();

