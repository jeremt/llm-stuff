import {type} from "arktype";
import type {Task} from "./task";

export const flow = async function* (tasks: Task<any, any, string>[], startKey: string, store: Map<string, unknown>) {
    let key = startKey;
    while (key !== "$done") {
        const currentTask = tasks.find((t) => t.key === key);
        if (!currentTask) {
            throw new Error(`TaskNotFound: ${key}`);
        }
        yield {status: "before_running", key} as const;
        const {inputsSchema, outputsSchema} = currentTask;
        const safeInputs = inputsSchema(await currentTask.beforeRun(store));
        if (safeInputs instanceof type.errors) {
            throw new Error(`InputValidationError: ${safeInputs.summary}`); // TODO: add task callback for this
        } else {
            yield {status: "running", key, inputs: safeInputs} as const;
            const outputs = await currentTask.run(safeInputs, {inputsSchema, outputsSchema}); // TODO: handle retry
            const safeOutputs = outputsSchema(outputs);
            if (safeOutputs instanceof type.errors) {
                throw new Error(`OutputValidationError: ${safeOutputs.summary}`);
            } else {
                yield {status: "after_running", key, outputs: safeOutputs} as const;
                key = await currentTask.afterRun(store, safeOutputs, safeInputs);
            }
        }
    }
};
