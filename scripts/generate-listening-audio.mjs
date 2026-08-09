import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('OPENAI_API_KEY is not configured');
}

const openai = new OpenAI({ apiKey });

const transcript = `
Maya: Hey Daniel, are you still coming to the team picnic on Saturday?

Daniel: I was planning to, but my car is at the mechanic.

Maya: Oh no. What happened?

Daniel: The engine warning light came on yesterday. They need to keep the car until Monday.

Maya: You can ride with me. I am leaving at ten, and the picnic starts at eleven.

Daniel: That would be great. Can you pick me up near the train station?

Maya: Sure. Text me the exact address tonight.

Daniel: Thanks. I will bring dessert, then.
`.trim();

const speech = await openai.audio.speech.create({
  model: 'gpt-4o-mini-tts',
  voice: 'marin',
  input: transcript,
  instructions: `
Perform this as a natural, casual conversation between two coworkers.

Maya sounds friendly and helpful.
Daniel sounds slightly concerned at first, then relieved.

Use clearly different delivery for the two speakers.
Speak at a natural but learner-friendly speed.
Pause briefly between turns.
Do not read punctuation aloud.
  `.trim(),
});

const outputDirectory = path.resolve('public/audio');
const outputPath = path.join(
  outputDirectory,
  'team-picnic-ride.mp3'
);

await mkdir(outputDirectory, { recursive: true });

const buffer = Buffer.from(await speech.arrayBuffer());

await writeFile(outputPath, buffer);

console.log(`Audio created: ${outputPath}`);