export const NATIVE_REWRITE_PROMPT = `Task:
Rewrite the user's Chinese meaning into natural spoken American English.

This is NOT direct translation.
The core task is:
Chinese intent -> natural spoken American English

Think silently. Do not show your analysis.
Return only the final options in the requested format.

Inside this single response, silently complete this five-step workflow:

1. Analyze intent
Understand what the Chinese sentence is really trying to express. Do not translate word by word.

2. Infer context
Use the provided Scene/context if available. Infer the situation, relationship between speakers, emotional tone, politeness level, and whether the line sounds like ordering, texting, asking, inviting, refusing, explaining, apologizing, or chatting.

3. Rewrite for spoken American English
Express the idea the way a 25-year-old college-educated American would naturally say it out loud in real conversation.

4. Review for native quality
Reject phrasing that sounds translated from Chinese, stiff, overly formal, written, corporate, robotic, outdated, textbook-like, or unnatural.

5. Polish and rank
Return 1-3 options. The first option must be the most default, common, instinctive, and high-frequency everyday phrasing.

The target voice:
Relaxed, real, educated, warm, and natural.
It should sound like everyday spoken American English, not written English, not an email, and not textbook English.

Situations this English may be used in:
- texting and chatting with friends
- casual everyday conversations
- class discussions
- dating and meeting new people
- restaurants, cafes, stores, doctors, school, work, and daily social situations

Rules:
- Express the idea, don't translate the words.
- Prefer the most instinctive, default way a native speaker would say it first in real-life conversation.
- Prioritize high-frequency conversational templates used by native speakers over freshly composed sentences.
- Prefer ready-made conversational chunks instead of constructing sentences word-by-word from the Chinese meaning.
- Before finalizing, choose the phrase a native speaker would most likely say spontaneously as their first instinct.
- Use contractions naturally, such as I'm, you're, I'll, I'd, don't, can't, gonna, kinda, and wanna when appropriate.
- Match the emotional tone of the Chinese sentence.
- Keep the English easy to say out loud and suitable for shadowing practice.
- The English must sound like real contemporary American spoken English.
- Use only phrases that are still commonly used today.
- Prefer expressions that have been common in the last 10 years and are still actively used by native speakers.
- Avoid outdated, old-fashioned, overly literary, textbook, or rarely used expressions, even if they are grammatically correct.
- Avoid TikTok-style slang or trendy internet language, such as "no cap", "it's giving", or "slay".
- Avoid expressions that sound translated, overly formal, textbook-like, corporate, robotic, or unnatural in modern speech.
- Prefer expressions commonly used by Americans in real-life dialogue, including movies, TV shows, podcasts, interviews, YouTube videos, realistic dialogue in novels, and conversation transcripts.
- Prioritize phrases based on actual everyday usage frequency among native speakers.
- Do not use dashes inside the English phrase itself.
- If the idea needs a pause or connection, use a period, comma, or a shorter separate sentence instead.
- Do not over-explain.
- Do not make the English overly long unless the meaning truly requires it.

If giving multiple options:
- #1 should be the most commonly used and most natural everyday phrasing.
- #2 can be slightly more casual, softer, warmer, or more situational.
- #3 should appear only if it adds a genuinely useful alternative.

Output format:
Give 1-3 most natural ways to say it.
Rank them by how commonly a native speaker would actually say them in everyday life.

Format EXACTLY:
1. "English phrase here" — short note
2. "English phrase here" — short note
3. "English phrase here" — short note

The English phrase inside the quotes must not contain dashes.
The short note should be brief and practical, such as:
- best default
- softer and polite
- casual with friends
- common when ordering
- good for texting
- natural at work

Examples:

Example 1
Chinese: 感谢提醒
Avoid: "Thanks for the reminder."
Prefer:
1. "Thanks for the heads-up." — best default

Example 2
Chinese: 我要去A餐厅，如果你想一起去就一起
Avoid: "I'm gonna grab food at Restaurant A. You're welcome to come if you want."
Avoid: "I'm heading to Restaurant A. Come with me if you want."
Prefer:
1. "Feel free to come with me." — casual and no pressure
2. "I'm heading to Restaurant A. Feel free to come with me." — adds context naturally

Example 3
Chinese: 有任何问题随时问我
Prefer:
1. "Let me know if you have any questions." — best default
2. "Feel free to ask me if anything comes up." — warmer and open
3. "Feel free to reach out if anything comes up." — natural but slightly more work-like

Example 4
Chinese: 你有没有时间
Prefer:
1. "Are you free?" — best default
2. "Do you have a minute?" — natural when asking for quick help
Avoid: "Do you have time?"`
