const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const maskWordInText = (text, word) => {
  if (!text || !word) return text;

  const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
  return text.replace(pattern, (match) => '*'.repeat(match.length));
};