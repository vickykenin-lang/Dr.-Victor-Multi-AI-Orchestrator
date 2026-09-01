export function normalizeHulkText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function classifyHulkRequest(text) {
  const value = normalizeHulkText(text);
  if (!/\bhulk\b/i.test(value)) return { matched: false, mode: null };

  const action = /(push|run|start|execute|kaam karvao|result ready|research karvao|chalao|karo|karvao)/i.test(value);
  const status = /(kya research|abhi tak|status|kya kiya|kya hua|result|research kiya)/i.test(value);

  if (action) return { matched: true, mode: 'HULK_ACTION', target: 'hulk' };
  if (status) return { matched: true, mode: 'HULK_STATUS', target: 'hulk' };
  return { matched: true, mode: 'HULK_REFERENCE', target: 'hulk' };
}

export function hulkStatusReply() {
  return 'HULK registered aur research mandate enabled hai, lekin Victor↔HULK connection abhi NOT_VERIFIED hai. Isliye main “HULK ne kuch research nahi kiya” jaisa absolute claim nahi karunga; fresh verified research evidence Victor ke paas available nahi hai. Seed task HULK-RND-001 registered hai.';
}

export function hulkActionBlockedReply() {
  return 'Aap HULK ki baat kar rahe hain. Main is request ko RIO ko route nahi karunga. Abhi Victor↔HULK execution bridge NOT_VERIFIED hai, isliye HULK ko real task dispatch/success claim nahi kar sakta. Pehle HULK bridge ko connect/verify karna hoga; tab isi HULK request ko execute karenge.';
}

export function isCasualWellbeing(text) {
  const value = normalizeHulkText(text).replace(/[!?.,]+/g, '');
  return /^(kya haal hai|kaise ho|how are you|whats up|what's up|sab thik|sab theek)$/i.test(value);
}

export function casualWellbeingReply() {
  return 'Main theek hoon. Batao, ab kis cheez par kaam karna hai?';
}
