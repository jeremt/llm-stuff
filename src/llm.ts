import {OpenAI} from "openai";
import {ResponseFormatJSONSchema} from "openai/resources";

export const llm = async (prompt: string, apiKey: string, schema?: ResponseFormatJSONSchema.JSONSchema["schema"]) => {
    try {
        const openai = new OpenAI({apiKey});
        const completion = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [{role: "user", content: prompt}],
            response_format: schema
                ? {type: "json_schema", json_schema: {name: "result", strict: true, schema}}
                : undefined,
        });
        if (schema && completion.choices[0].message.content) {
            return JSON.parse(completion.choices[0].message.content) as Record<string, unknown>;
        }
        return completion.choices[0].message.content || "";
    } catch (error) {
        return `LLMError: ${(error as Error)?.message ?? error}`;
    }
};
