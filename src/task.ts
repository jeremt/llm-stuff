import type {Type} from "arktype";

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
