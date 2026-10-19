// Enhanced Peaches voice: ElevenLabs streaming TTS. GET so the <audio> element can
// start playing while bytes stream in, and so repeat lines hit the HTTP cache.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // warm, upbeat female
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5"; // lowest latency

export async function GET(request: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return new Response("TTS not configured", { status: 503 });
  const text = new URL(request.url).searchParams.get("text")?.trim().slice(0, 600);
  if (!text) return new Response("Missing text", { status: 400 });

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_64&optimize_streaming_latency=3`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 1.05 },
      }),
    },
  );
  if (!upstream.ok || !upstream.body) {
    console.error("tts: elevenlabs", upstream.status, await upstream.text().catch(() => ""));
    return new Response("TTS failed", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=604800, immutable" },
  });
}
