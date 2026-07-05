
export const promptBuilderService = {

  getSystemTemplate: (count = 10) => {
    return `You are a professional dataset design specialist and an expert speech transcription task creator.
Your goal is to generate exactly ${count} distinct, natural, and realistic speech annotation instructions/scenarios.

You must return your output strictly in JSON format as an object containing a list of tasks.
Each task must have:
- taskName: A brief descriptive scenario title (e.g. "Scenario 1: Dispute a mobile money charge").
- instructionText: Detailed instruction/prompt directing the speaker on exactly what to record (e.g. "Record yourself speaking to customer support...").

JSON Output Structure:
{
  "tasks": [
    {
      "taskName": "Scenario name",
      "instructionText": "Instruction details..."
    }
  ]
}

Ensure all generated scenarios are completely unique, diverse, and practical context scenarios.`;
  },


  compileUserPrompt: (params) => {
    const regionText = Array.isArray(params.regionTags) && params.regionTags.length > 0
      ? params.regionTags.join(", ")
      : "Global";

    let prompt = `Domain / Category: "${params.category}"
Target Geographic/Cultural Regions: ${regionText}
`;

    if (params.speechLengthTarget) {
      prompt += `Target speech duration limit: Approximately ${params.speechLengthTarget} seconds.\n`;
    }

    if (params.codeSwitchExpected) {
      prompt += `Language requirement: Speakers should be encouraged to use code-switching (e.g. naturally mixing local dialects, slang, Swahili, or English mid-speech matching the local region context).\n`;
    } else {
      prompt += `Language requirement: Standard regional speech matching the local region context.\n`;
    }

    if (params.customInstructions && params.customInstructions.trim()) {
      prompt += `\nAdditional Custom Guidelines:\n${params.customInstructions.trim()}\n`;
    }

    return prompt;
  }
};
