const emojiPattern = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|[#*0-9]\uFE0F?\u20E3)/u;

export const containsEmoji = (value) => emojiPattern.test(value);

const hasEmojiValue = (value) => {
  if (typeof value === "string") return containsEmoji(value);
  if (Array.isArray(value)) return value.some(hasEmojiValue);
  if (value && typeof value === "object") return Object.values(value).some(hasEmojiValue);
  return false;
};

export function rejectEmojiInput(req, res, next) {
  if (hasEmojiValue(req.body)) {
    return res.status(400).json({ message: "Emoji characters are not allowed." });
  }
  return next();
}
