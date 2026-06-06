import fs from 'fs';
import { zipSync } from 'fflate';

function generateWavHeader(sampleRate, numChannels, bitsPerSample, numSamples) {
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const fileSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // subchunk1size
  header.writeUInt16LE(1, 20);  // audioFormat (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return header;
}

function main() {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const durationSec = 45; // 45 seconds
  const numSamples = sampleRate * durationSec;
  
  console.log(`Generating a ${durationSec}s WAV file...`);
  const header = generateWavHeader(sampleRate, numChannels, bitsPerSample, numSamples);
  const dataSize = numSamples * ((numChannels * bitsPerSample) / 8);
  const data = Buffer.alloc(dataSize); // filled with zeros (silence)
  const wavBytes = Buffer.concat([header, data]);
  
  console.log(`Zipping the WAV file...`);
  const zipData = zipSync({
    'test_45s.wav': new Uint8Array(wavBytes)
  });
  
  fs.writeFileSync('test_audio.zip', Buffer.from(zipData));
  console.log('test_audio.zip created successfully.');
}

main();
