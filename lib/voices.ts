// ElevenLabs voice casting: one distinct voice per resident.
// IDs are ElevenLabs' default voices (available on every account, including free):
// https://elevenlabs.io/docs/voices/default-voices
// Swap any ID for a voice from your own ElevenLabs Voice Library if you prefer.
// Gemini still writes every word the residents say; ElevenLabs only speaks it.

export interface VoiceCast {
  voiceId: string;
  /** ElevenLabs default-voice name, for reference */
  name: string;
  /** 0.7–1.2; older residents speak a little slower */
  speed: number;
}

export const VOICES: Record<string, VoiceCast> = {
  marisol: { voiceId: "cgSgspJ2msm6clMCkdW9", name: "Jessica", speed: 1.02 }, // 34, PSW, busy parent
  desmond: { voiceId: "pqHfZKP75CvOlQylNhV4", name: "Bill", speed: 0.92 }, // 67, retired TTC mechanic
  tariq: { voiceId: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", speed: 1.04 }, // 28, warehouse shift lead
  priya: { voiceId: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", speed: 1.0 }, // 41, accountant
  lin: { voiceId: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", speed: 1.06 }, // 19, student
  agnes: { voiceId: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", speed: 0.88 }, // 78, retired seamstress
  jordan: { voiceId: "bIHbv24MWmeRgasZH58o", name: "Will", speed: 1.05 }, // 31, barista & courier
  fatima: { voiceId: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", speed: 0.98 }, // 45, home daycare
  robert: { voiceId: "nPczCjzI2devNBz1zQrb", name: "Brian", speed: 0.97 }, // 55, professor
  grace: { voiceId: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", speed: 0.95 }, // 62, overnight cleaner
  daniel: { voiceId: "iP95p4xoKVk53GoZ742B", name: "Chris", speed: 1.03 }, // 38, courier van driver
  amara: { voiceId: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", speed: 1.02 }, // 26, nursing student
};

/** Used if a resident has no entry above (e.g. a future persona). */
export const FALLBACK_VOICE: VoiceCast = { voiceId: "JBFqnCBsd6RMkjVDRZzb", name: "George", speed: 1.0 };
