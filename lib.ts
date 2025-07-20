import {type, type Type} from "arktype";
import {OpenAI} from "openai";
import {ResponseFormatJSONSchema} from "openai/resources";

export type Task<Inputs, Outputs, TaskKey extends string> = {
    key: TaskKey;
    inputsSchema: Type<Inputs>;
    outputsSchema: Type<Outputs>;
    //
    beforeRun: (store: Map<string, unknown>) => Promise<Inputs>;
    run: (inputs: Inputs, schemas: {inputsSchema: Type<Inputs>; outputsSchema: Type<Outputs>}) => Promise<unknown>; // Outputs but validated after
    afterRun: (store: Map<string, unknown>, outputs: Outputs, inputs: Inputs) => Promise<TaskKey>;
    //
    maxRetries?: number;
    msForRetry?: number;
};

export const task = <Inputs, Outputs, TaskKey extends string>(params: Task<Inputs, Outputs, TaskKey>) => params;

export const flow = async (tasks: Task<any, any, string>[], startKey: string, store: Map<string, unknown>) => {
    let key = startKey;
    while (key !== "$done") {
        const currentTask = tasks.find((t) => t.key === key);
        if (!currentTask) {
            throw new Error(`TaskNotFound: ${key}`);
        }
        console.log(`Running task \x1b[33m${key}\x1b[0m`);
        const {inputsSchema, outputsSchema} = currentTask;
        const safeInputs = inputsSchema(await currentTask?.beforeRun(store));
        if (safeInputs instanceof type.errors) {
            throw new Error(`InputValidationError: ${safeInputs.summary}`); // TODO: add task callback for this
        } else {
            const outputs = await currentTask.run(safeInputs, {inputsSchema, outputsSchema}); // TODO: handle retry
            const safeOutputs = outputsSchema(outputs);
            if (safeOutputs instanceof type.errors) {
                throw new Error(`OutputValidationError: ${safeOutputs.summary}`);
            } else {
                key = await currentTask?.afterRun(store, safeOutputs, safeInputs);
            }
        }
    }
};

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

export const webSearch = async (query: string) => {
    return ["Bob won secret story !", "Nina a été éliminée :/"];
};
