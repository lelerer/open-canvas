import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getArtifactContent } from "@opencanvas/shared/utils/artifacts";
import { Reflections } from "@opencanvas/shared/types";
import {
  createContextDocumentMessages,
  ensureStoreInConfig,
  formatArtifactContentWithTemplate,
  formatReflections,
  getModelFromConfig,
  isUsingO1MiniModel,
} from "../../utils.js";
import { CURRENT_ARTIFACT_PROMPT, NO_ARTIFACT_PROMPT } from "../prompts.js";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state.js";

/**
 * Generate responses to questions. Does not generate artifacts.
 */
export const replyToGeneralInput = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const smallModel = await getModelFromConfig(config);

  const prompt = `You are an expert HCI research methodologist embedded in the "HCI Experiment Designer", helping researchers design experiments whose data is used for agent training.

If the user has not yet described an experiment (e.g. their message is a greeting or is vague about the study), ask them: "What experiment do you want to conduct?" and, if helpful, one brief follow-up about their research goal. Once they describe an experiment, help them turn it into a structured study-design document on the canvas.

The user may have generated artifacts in the past. Use the following artifacts as context when responding to the users question.

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

{currentArtifactPrompt}`;

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;

  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }
  const memoryNamespace = ["memories", assistantId];
  const memoryKey = "reflection";
  const memories = await store.get(memoryNamespace, memoryKey);
  const memoriesAsString = memories?.value
    ? formatReflections(memories.value as Reflections)
    : "No reflections found.";

  const formattedPrompt = prompt
    .replace("{reflections}", memoriesAsString)
    .replace(
      "{currentArtifactPrompt}",
      currentArtifactContent
        ? formatArtifactContentWithTemplate(
            CURRENT_ARTIFACT_PROMPT,
            currentArtifactContent
          )
        : NO_ARTIFACT_PROMPT
    );

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);
  const response = await smallModel.invoke([
    { role: isO1MiniModel ? "user" : "system", content: formattedPrompt },
    ...contextDocumentMessages,
    ...state._messages,
  ]);

  return {
    messages: [response],
    _messages: [response],
  };
};
