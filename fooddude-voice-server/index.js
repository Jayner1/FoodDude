require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 4000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors({
  origin: '*', 
}));
app.use(express.json({ limit: '20mb' })); 

app.get('/', (req, res) => {
  res.send('FoodDude STT server is running ✅');
});

app.post('/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required' });
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');

    const ext = mimeType && mimeType.includes('wav') ? '.wav' : '.m4a';
    const tempPath = path.join(os.tmpdir(), `fooddude-${Date.now()}${ext}`);
    fs.writeFileSync(tempPath, audioBuffer);

    console.log('[STT] Audio saved to', tempPath, '— transcribing…');

    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1', 
    });

    fs.unlink(tempPath, () => {});

    const text = transcription.text || '';
    console.log('[STT] Transcript:', text);

    return res.json({ text });
  } catch (err) {
    console.error('[STT] Error in /transcribe:', err);
    return res.status(500).json({ error: 'Transcription failed' });
  }
});

app.listen(port, () => {
  console.log(`FoodDude STT server listening on http://localhost:${port}`);
});
