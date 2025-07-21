import {Type} from "arktype";
import {OpenAI} from "openai";
import {ResponseFormatJSONSchema} from "openai/resources";

const _toJsonSchema = <T>(schema: Type<T>) => {
    const jsonSchema = schema.toJsonSchema() as any;
    let root = jsonSchema;
    const dfs = (node: any) => {
        if (node.type === "object") {
            node.additionalProperties = false;
            for (const key of node.required ?? []) {
                dfs(node.properties[key]);
            }
        } else if (node.type === "array") {
            // TODO: recurse on arrays
        }
    };
    dfs(root);
    return jsonSchema;
};

export const responseSchema = <T>(schema: Type<T>) => {
    return {
        type: "json_schema",
        json_schema: {name: "result", strict: true, schema: _toJsonSchema(schema)},
    } satisfies ResponseFormatJSONSchema;
};

export const tool = <T>(
    name: string,
    description: string,
    parameters: Type<T>,
    func: (parameters: T) => Promise<string>
) => {
    return {
        schema: parameters,
        jsonSchema: {
            type: "function",
            function: {
                name,
                description,
                strict: true,
                parameters: _toJsonSchema(parameters),
            },
        } satisfies OpenAI.Chat.Completions.ChatCompletionTool,
        func,
    };
};

type LLMOptions = {
    schema?: ReturnType<typeof responseSchema>;
    tools?: ReturnType<typeof tool<any>>[];
    model?: OpenAI.AllModels;
};

// TODO: return costs and handle streaming
export const llm = async (prompt: string, apiKey: string, {schema, tools, model = "gpt-4.1-mini"}: LLMOptions = {}) => {
    try {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{role: "user", content: prompt}];
        const openai = new OpenAI({apiKey});
        let completion = await openai.chat.completions.create({
            model,
            messages,
            response_format: schema,
            tool_choice: tools ? "auto" : "none",
            tools: tools?.map((tool) => tool.jsonSchema),
        });
        // tool calling
        if (tools?.length && completion.choices[0].message.tool_calls?.[0]) {
            do {
                const call = completion.choices[0].message.tool_calls[0];
                const toolToCall = tools.find((tool) => tool.jsonSchema.function.name === call.function.name);
                if (!toolToCall) {
                    throw new Error(`Tool ${call.function.name} doesn't exist`);
                }
                const returnValue = await toolToCall.func(toolToCall.schema(JSON.parse(call.function.arguments)));
                messages.push(
                    {
                        role: "assistant",
                        tool_calls: [call],
                    },
                    {
                        role: "tool",
                        tool_call_id: call.id,
                        content: JSON.stringify(returnValue),
                    }
                );
                completion = await openai.chat.completions.create({
                    model,
                    messages,
                    response_format: schema,
                });
            } while (completion.choices[0].message.tool_calls?.[0]);
        }
        // parse response format
        if (schema && completion.choices[0].message.content) {
            return JSON.parse(completion.choices[0].message.content) as Record<string, unknown>;
        }
        // text answer
        return completion.choices[0].message.content || "";
    } catch (error) {
        return `LLMError: ${(error as Error)?.message ?? error}`; // TODO: better error handling
    }
};
