# Native Rewrite Design

SayNative is not designed as a direct translation product. Its core language task is:

```text
Chinese intent -> natural spoken American English
```

The product should understand what the learner is trying to say, infer the real-life context, and rewrite the meaning into the kind of English a contemporary American would naturally say out loud.

## Runtime Strategy

The app should stay fast. For the main user flow, SayNative uses one OpenAI call for native English generation.

Inside that single call, the model is instructed to silently complete a five-step rewrite workflow:

1. **Analyze intent**  
   Understand what the Chinese sentence is really trying to express. Do not translate word by word.

2. **Infer context**  
   Use the optional scene to infer the situation, relationship, emotional tone, and politeness level.

3. **Rewrite for spoken American English**  
   Express the idea as natural, high-frequency American English that people would actually say in daily conversation.

4. **Review for native quality**  
   Reject phrasing that sounds translated, stiff, overly formal, outdated, textbook-like, or unnatural.

5. **Polish and rank**  
   Return one to three options. The first option must be the most default, common, and instinctive phrasing.

The model should think silently and return only the final options shown to the learner.

## Why Not Multi-Step API Calls

A full agent workflow could run separate calls for analysis, draft, review, revision, and polish. That can improve control, but it adds latency and cost.

SayNative's main loop depends on speed. Learners should be able to speak Chinese, receive an English phrase, and start practicing without waiting through a long pipeline.

For that reason, the production app uses:

```text
one API call + internal five-step reasoning
```

instead of:

```text
analyze -> draft -> review -> revise -> polish
```

## Prompt as Product Infrastructure

The native rewrite prompt is a core product asset. It should be treated like code:

- stored in the repository
- reviewed through small commits
- improved with real product examples
- tested against known quality cases
- changed separately from unrelated UI or ASR work

This keeps language quality traceable and prevents accidental prompt drift.

## Quality Iteration

SayNative should improve through real examples, not abstract prompt guessing.

When an output does not sound native, the case should be recorded with:

- Chinese input
- optional scene
- current output
- preferred output
- reason the preferred version sounds more natural

These examples become quality cases that guide future prompt updates.

Example:

```text
Chinese: 我想要一份鸡肉
Scene: ordering at a casual restaurant

Bad:
- I want a chicken.

Good:
- I'll have the chicken.
- Can I get the chicken?
- I'll do the chicken.

Rule:
When ordering a dish, do not translate 想要 as want. Use common restaurant ordering chunks.
```

## Future Modes

The product can eventually support two generation modes:

| Mode | Use case | API pattern |
| --- | --- | --- |
| Fast | Default daily practice | One call with internal five-step rewrite |
| Refined | Offline testing or premium-quality review | Multi-step analyze, review, revise, and polish |

The current product should prioritize Fast mode because it gives the best balance between native quality and learning speed.
