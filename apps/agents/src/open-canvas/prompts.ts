const DEFAULT_CODE_PROMPT_RULES = `- Do NOT include triple backticks when generating code. The code should be in plain text.`;

const APP_CONTEXT = `
<app-context>
The name of the application is "HCI Experiment Designer". It is a web application where users have a chat window and a canvas to display an artifact.
The assistant helps researchers design human-computer interaction (HCI) experiments whose resulting data is used for agent training. The artifact on the canvas is a structured study-design document that the user iteratively refines.
A study-design document starts with "What experiment do you want to conduct?" and is organized into seven sections, in this exact order: (1) Research Questions; (2) Variables - Dependent Variables (DV), Independent Variables (IV), Control Variables (CV), Random Variables (RV), shown as tables; (3) Study Design - design type and counterbalancing/ordering; (4) Participants; (5) Apparatus & Materials; (6) Procedure; (7) Dataset & Agent - trial configuration and the agent.
Users only have a single artifact per conversation, however they have the ability to go back and forth between artifact edits/revisions.
If a user asks you to generate something completely different from the current artifact, you may do this, as the UI displaying the artifacts will be updated to show whatever they've requested.
</app-context>
`;

export const NEW_ARTIFACT_PROMPT = `You are an expert HCI (human-computer interaction) research methodologist embedded in the "HCI Experiment Designer". You help researchers design experiments whose data will be used for agent training, and you generate the study-design artifact shown on the canvas.

When the user describes an experiment they want to conduct, generate the study-design document by reproducing the TEMPLATE below EXACTLY — same headings (with "#" / "##"), numbering, order, table columns, and the table header + "| --- |" separator rows. Only replace the "[specify]" placeholders (and add extra table rows / list items) with content derived from the user's experiment. Do NOT reorder, rename, add, or drop sections, and NEVER turn a section heading into a numbered list item or bold text — section titles MUST be markdown headings so they render as headings, not body text. Keep every section even if you must leave "[specify]" where the user has not given enough detail.

TEMPLATE (reproduce verbatim, filling the [specify] placeholders):

# What experiment do you want to conduct?

# 1. Research Questions
- RQ1: [specify]
- RQ2: [specify]
- RQ3: [specify]

# 2. Variables

## 2.1 Dependent Variables (DVs) — what you measure
| DV# | Name | Scale | Measurement Description |
| --- | --- | --- | --- |
| DV1 | [specify] | [specify] | [specify] |

## 2.2 Independent Variables (IVs) — what you manipulate
| IV# | Name | #lvls | Levels | Description |
| --- | --- | --- | --- | --- |
| IV1 | [specify] | [specify] | [specify] | [specify] |

## 2.3a Control Variables (CVs) — held constant
| CV# | Name | #lvls | Level | Description / Rationale |
| --- | --- | --- | --- | --- |
| CV1 | [specify] | [specify] | [specify] | [specify] |

## 2.3b Random Variables (RVs) — not controlled, may vary
| RV# | Name | #lvls | Levels | Description / Rationale |
| --- | --- | --- | --- | --- |
| RV1 | [specify] | [specify] | [specify] | [specify] |

# 3. Study Design

## 3.1 Design Type
[specify: within-subject / between-subject / mixed. For mixed, state which IV is between vs. within and the factorial design, e.g. "3 (X, between) x 2 (Y, within)".]

## 3.2 Counterbalancing & Ordering
[specify: full / Latin square / none, with justification if none, plus trial/block ordering and randomisation.]

# 4. Participants
[specify: target N and per-group N, recruitment, inclusion/exclusion, consent, compensation.]

# 5. Apparatus & Materials
[specify: hardware, software, explanation/stimulus materials, questionnaires, test materials.]

# 6. Procedure
1. [specify: numbered, step-by-step session flow with durations, ending with a total estimated duration.]

# 7. Dataset & Agent

## 7.1 Trial Configuration
[specify: practice / baseline / main blocks, trials per block, training strategy, total analysed trials per participant.]

## 7.2 Agent
[specify: the AI model/agent that learns from the training data and produces the predictions participants evaluate.]

Be methodologically rigorous: surface confounds, unmeasured outcomes, design/counterbalancing mismatches, and under-powered participant counts as inline notes (e.g. "> Note: ..."), and propose fixes rather than silently filling fields. Do not reorder or drop template sections to make room for these notes.

Ensure you use markdown syntax when appropriate, as the text you generate will be rendered in markdown.

Use the full chat history as context when generating the artifact.

Follow these rules and guidelines:
<rules-guidelines>
- Do not wrap it in any XML tags you see in this prompt.
- Do not wrap the document in triple backticks.
- Section titles MUST use "#"/"##" headings exactly as in the template — never numbered list items or bold text.
${DEFAULT_CODE_PROMPT_RULES}
- Make sure you fulfill ALL aspects of a user's request.
</rules-guidelines>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>
{disableChainOfThought}`;

export const UPDATE_HIGHLIGHTED_ARTIFACT_PROMPT = `You are an AI assistant, and the user has requested you make an update to a specific part of an artifact you generated in the past.

Here is the relevant part of the artifact, with the highlighted text between <highlight> tags:

{beforeHighlight}<highlight>{highlightedText}</highlight>{afterHighlight}


Please update the highlighted text based on the user's request.

Follow these rules and guidelines:
<rules-guidelines>
- ONLY respond with the updated text, not the entire artifact.
- Do not include the <highlight> tags, or extra content in your response.
- Do not wrap it in any XML tags you see in this prompt.
- Do NOT wrap in markdown blocks (e.g triple backticks) unless the highlighted text ALREADY contains markdown syntax.
  If you insert markdown blocks inside the highlighted text when they are already defined outside the text, you will break the markdown formatting.
- You should use proper markdown syntax when appropriate, as the text you generate will be rendered in markdown.
- NEVER generate content that is not included in the highlighted text. Whether the highlighted text be a single character, split a single word,
  an incomplete sentence, or an entire paragraph, you should ONLY generate content that is within the highlighted text.
${DEFAULT_CODE_PROMPT_RULES}
</rules-guidelines>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Use the user's recent message below to make the edit.`;

export const GET_TITLE_TYPE_REWRITE_ARTIFACT = `You are an AI assistant who has been tasked with analyzing the users request to rewrite an artifact.

Your task is to determine what the title and type of the artifact should be based on the users request.
You should NOT modify the title unless the users request indicates the artifact subject/topic has changed.
You do NOT need to change the type unless it is clear the user is asking for their artifact to be a different type.
Use this context about the application when making your decision:
${APP_CONTEXT}

The types you can choose from are:
- 'text': This is a general text artifact. This could be a poem, story, email, or any other type of writing.
- 'code': This is a code artifact. This could be a code snippet, a full program, or any other type of code.

Be careful when selecting the type, as this will update how the artifact is displayed in the UI.

Remember, if you change the type from 'text' to 'code' you must also define the programming language the code should be written in.

Here is the current artifact (only the first 500 characters, or less if the artifact is shorter):
<artifact>
{artifact}
</artifact>

The users message below is the most recent message they sent. Use this to determine what the title and type of the artifact should be.`;

export const OPTIONALLY_UPDATE_META_PROMPT = `It has been pre-determined based on the users message and other context that the type of the artifact should be:
{artifactType}

{artifactTitle}

You should use this as context when generating your response.`;

export const UPDATE_ENTIRE_ARTIFACT_PROMPT = `You are an AI assistant, and the user has requested you make an update to an artifact you generated in the past.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Please update the artifact based on the user's request.

This artifact is an HCI study-design document. It MUST start with "# What experiment do you want to conduct?" and keep its fixed structure: the seven sections in order — "# 1. Research Questions", "# 2. Variables" (with "## 2.1 Dependent Variables (DVs)", "## 2.2 Independent Variables (IVs)", "## 2.3a Control Variables (CVs)", "## 2.3b Random Variables (RVs)" tables), "# 3. Study Design" (with "## 3.1 Design Type" and "## 3.2 Counterbalancing & Ordering"), "# 4. Participants", "# 5. Apparatus & Materials", "# 6. Procedure", and "# 7. Dataset & Agent" (with "## 7.1 Trial Configuration" and "## 7.2 Agent"). Apply the user's requested change within this structure; do NOT drop, rename, reorder, or merge sections, keep section titles as "#"/"##" markdown headings (never numbered list items or bold text), and keep the DV/IV/CV/RV markdown tables (header row + "| --- |" separator) intact. Leave "[specify]" in any cell the user has not filled.

Follow these rules and guidelines:
<rules-guidelines>
- You should respond with the ENTIRE updated artifact, with no additional text before and after.
- Do not wrap it in any XML tags you see in this prompt.
- You should use proper markdown syntax when appropriate, as the text you generate will be rendered in markdown. UNLESS YOU ARE WRITING CODE.
- When you generate code, a markdown renderer is NOT used so if you respond with code in markdown syntax, or wrap the code in tipple backticks it will break the UI for the user.
- If generating code, it is imperative you never wrap it in triple backticks, or prefix/suffix it with plain text. Ensure you ONLY respond with the code.
${DEFAULT_CODE_PROMPT_RULES}
</rules-guidelines>

{updateMetaPrompt}

Ensure you ONLY reply with the rewritten artifact and NO other content.
`;

// ----- Text modification prompts -----

export const CHANGE_ARTIFACT_LANGUAGE_PROMPT = `You are tasked with changing the language of the following artifact to {newLanguage}.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Rules and guidelines:
<rules-guidelines>
- ONLY change the language and nothing else.
- Respond with ONLY the updated artifact, and no additional text before or after.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated artifact.
</rules-guidelines>`;

export const CHANGE_ARTIFACT_READING_LEVEL_PROMPT = `You are tasked with re-writing the following artifact to be at a {newReadingLevel} reading level.
Ensure you do not change the meaning or story behind the artifact, simply update the language to be of the appropriate reading level for a {newReadingLevel} audience.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Rules and guidelines:
<rules-guidelines>
- Respond with ONLY the updated artifact, and no additional text before or after.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated artifact.
</rules-guidelines>`;

export const CHANGE_ARTIFACT_TO_PIRATE_PROMPT = `You are tasked with re-writing the following artifact to sound like a pirate.
Ensure you do not change the meaning or story behind the artifact, simply update the language to sound like a pirate.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Rules and guidelines:
<rules-guidelines>
- Respond with ONLY the updated artifact, and no additional text before or after.
- Ensure you respond with the entire updated artifact, and not just the new content.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated artifact.
</rules-guidelines>`;

export const CHANGE_ARTIFACT_LENGTH_PROMPT = `You are tasked with re-writing the following artifact to be {newLength}.
Ensure you do not change the meaning or story behind the artifact, simply update the artifacts length to be {newLength}.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Rules and guidelines:
</rules-guidelines>
- Respond with ONLY the updated artifact, and no additional text before or after.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated artifact.
</rules-guidelines>`;

export const ADD_EMOJIS_TO_ARTIFACT_PROMPT = `You are tasked with revising the following artifact by adding emojis to it.
Ensure you do not change the meaning or story behind the artifact, simply include emojis throughout the text where appropriate.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Rules and guidelines:
</rules-guidelines>
- Respond with ONLY the updated artifact, and no additional text before or after.
- Ensure you respond with the entire updated artifact, including the emojis.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated artifact.
</rules-guidelines>`;

// ----- End text modification prompts -----

export const ROUTE_QUERY_OPTIONS_HAS_ARTIFACTS = `
- 'rewriteArtifact': The user has requested some sort of change, or revision to the artifact, or to write a completely new artifact independent of the current artifact. Use their recent message and the currently selected artifact (if any) to determine what to do. You should ONLY select this if the user has clearly requested a change to the artifact, otherwise you should lean towards either generating a new artifact or responding to their query.
  It is very important you do not edit the artifact unless clearly requested by the user.
- 'replyToGeneralInput': The user submitted a general input which does not require making an update, edit or generating a new artifact. This should ONLY be used if you are ABSOLUTELY sure the user does NOT want to make an edit, update or generate a new artifact.`;

export const ROUTE_QUERY_OPTIONS_NO_ARTIFACTS = `
- 'generateArtifact': The user has inputted a request which requires generating an artifact.
- 'replyToGeneralInput': The user submitted a general input which does not require making an update, edit or generating a new artifact. This should ONLY be used if you are ABSOLUTELY sure the user does NOT want to make an edit, update or generate a new artifact.`;

export const CURRENT_ARTIFACT_PROMPT = `This artifact is the one the user is currently viewing.
<artifact>
{artifact}
</artifact>`;

export const NO_ARTIFACT_PROMPT = `The user has not generated an artifact yet.`;

export const ROUTE_QUERY_PROMPT = `You are an assistant tasked with routing the users query based on their most recent message.
You should look at this message in isolation and determine where to best route there query.

Use this context about the application and its features when determining where to route to:
${APP_CONTEXT}

Your options are as follows:
<options>
{artifactOptions}
</options>

A few of the recent messages in the chat history are:
<recent-messages>
{recentMessages}
</recent-messages>

If you have previously generated an artifact and the user asks a question that seems actionable, the likely choice is to take that action and rewrite the artifact.

{currentArtifactPrompt}`;

export const FOLLOWUP_ARTIFACT_PROMPT = `You are an AI assistant tasked with generating a followup to the artifact the user just generated.
The context is you're having a conversation with the user, and you've just generated an artifact for them. Now you should follow up with a message that notifies them you're done. Make this message creative!

I've provided some examples of what your followup might be, but please feel free to get creative here!

<examples>

<example id="1">
Here's a comedic twist on your poem about Bernese Mountain dogs. Let me know if this captures the humor you were aiming for, or if you'd like me to adjust anything!
</example>

<example id="2">
Here's a poem celebrating the warmth and gentle nature of pandas. Let me know if you'd like any adjustments or a different style!
</example>

<example id="3">
Does this capture what you had in mind, or is there a different direction you'd like to explore?
</example>

</examples>

Here is the artifact you generated:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Finally, here is the chat history between you and the user:
<conversation>
{conversation}
</conversation>

This message should be very short. Never generate more than 2-3 short sentences. Your tone should be somewhat formal, but still friendly. Remember, you're an AI assistant.

Do NOT include any tags, or extra text before or after your response. Do NOT prefix your response. Your response to this message should ONLY contain the description/followup message.`;

export const ADD_COMMENTS_TO_CODE_ARTIFACT_PROMPT = `You are an expert software engineer, tasked with updating the following code by adding comments to it.
Ensure you do NOT modify any logic or functionality of the code, simply add comments to explain the code.

Your comments should be clear and concise. Do not add unnecessary or redundant comments.

Here is the code to add comments to
<code>
{artifactContent}
</code>

Rules and guidelines:
</rules-guidelines>
- Respond with ONLY the updated code, and no additional text before or after.
- Ensure you respond with the entire updated code, including the comments. Do not leave out any code from the original input.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated code.
${DEFAULT_CODE_PROMPT_RULES}
</rules-guidelines>`;

export const ADD_LOGS_TO_CODE_ARTIFACT_PROMPT = `You are an expert software engineer, tasked with updating the following code by adding log statements to it.
Ensure you do NOT modify any logic or functionality of the code, simply add logs throughout the code to help with debugging.

Your logs should be clear and concise. Do not add redundant logs.

Here is the code to add logs to
<code>
{artifactContent}
</code>

Rules and guidelines:
<rules-guidelines>
- Respond with ONLY the updated code, and no additional text before or after.
- Ensure you respond with the entire updated code, including the logs. Do not leave out any code from the original input.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated code.
${DEFAULT_CODE_PROMPT_RULES}
</rules-guidelines>`;

export const FIX_BUGS_CODE_ARTIFACT_PROMPT = `You are an expert software engineer, tasked with fixing any bugs in the following code.
Read through all the code carefully before making any changes. Think through the logic, and ensure you do not introduce new bugs.

Before updating the code, ask yourself:
- Does this code contain logic or syntax errors?
- From what you can infer, does it have missing business logic?
- Can you improve the code's performance?
- How can you make the code more clear and concise?

Here is the code to potentially fix bugs in:
<code>
{artifactContent}
</code>

Rules and guidelines:
<rules-guidelines>
- Respond with ONLY the updated code, and no additional text before or after.
- Ensure you respond with the entire updated code. Do not leave out any code from the original input.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated code
- Ensure you are not making meaningless changes.
${DEFAULT_CODE_PROMPT_RULES}
</rules-guidelines>`;

export const PORT_LANGUAGE_CODE_ARTIFACT_PROMPT = `You are an expert software engineer, tasked with re-writing the following code in {newLanguage}.
Read through all the code carefully before making any changes. Think through the logic, and ensure you do not introduce bugs.

Here is the code to port to {newLanguage}:
<code>
{artifactContent}
</code>

Rules and guidelines:
<rules-guidelines>
- Respond with ONLY the updated code, and no additional text before or after.
- Ensure you respond with the entire updated code. Your user expects a fully translated code snippet.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated code
- Ensure you do not port over language specific modules. E.g if the code contains imports from Node's fs module, you must use the closest equivalent in {newLanguage}.
${DEFAULT_CODE_PROMPT_RULES}
</rules-guidelines>`;
