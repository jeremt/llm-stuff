import dotenv from "dotenv";
import {task} from "../src/task";
import {type} from "arktype";
import {llm, responseSchema} from "../src/llm";
import {webSearch} from "../src/webSearch";
import {flow} from "../src/flow";

dotenv.config({quiet: true});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    throw new Error("env OPENAI_API_KEY is missing");
}

const kv = new Map<string, unknown>();

kv.set("question", "Qui est éliminé de secret story ?");

const mainTask = task({
    key: "main",
    inputsSchema: type({question: "string", "context?": "string"}),
    outputsSchema: type({
        action: "'webSearch' | 'answer'",
        reason: type("string").describe("why you chose this action"),
        answer: type("string").describe("if action is answer"),
        search_query: type("string").describe("specific search query if action is search"),
    }),

    beforeRun: async (store) => {
        return {
            question: store.get("question") as string,
            context: (store.get("context") ?? "No previous search") as string,
        };
    },
    run: async ({question, context}, {outputsSchema}) => {
        const response = await llm(
            `### Context
You are a research assistant that can search the web.
Question: ${question}
Previous Research: ${context}

### Actions
[1] webSearch
  Description: Look up more information on the web
  Parameters:
    - searchQuery (string): What to search for

[2] answer
  Description: Answer the question with current knowledge
  Parameters:
    - answer (string): Final answer to the question

## Next action
Decide the next action based on the context and available actions.
`,
            OPENAI_API_KEY,
            {schema: responseSchema(outputsSchema)}
        );
        return response;
    },
    afterRun: async (store, {action, answer, search_query}) => {
        if (action === "webSearch") {
            store.set("search_query", search_query);
        } else {
            store.set("context", answer);
        }
        return action;
    },
});

const webSearchTask = task({
    key: "webSearch",
    inputsSchema: type({searchQuery: "string"}),
    outputsSchema: type({results: "string[]"}),
    beforeRun: async (store) => {
        return {
            searchQuery: store.get("search_query") as string,
        };
    },
    run: async ({searchQuery}) => ({results: await webSearch(searchQuery)}),
    afterRun: async (store, {results}) => {
        const previous = store.get("context");
        store.set(
            "context",
            `${previous ? `${previous}\n` : ""}searchQuery: ${store.get("search_query")}\nresults: ${results}`
        );
        return "main"; // always go back to main after searching
    },
});

const answerTask = task({
    key: "answer",
    inputsSchema: type({question: "string", context: "string"}),
    outputsSchema: type({answer: "string"}),
    beforeRun: async (store) => {
        return {
            question: store.get("question") as string,
            context: store.get("context") as string,
        };
    },
    run: async ({question, context}) => {
        const answer = await llm(
            `# Context
Based on the following information, answer the question.
Question: ${question}
Research: ${context}

## Your answer
Provide a comprehensive answer using the research results.`,
            OPENAI_API_KEY
        );
        return {answer};
    },
    afterRun: async (store, {answer}) => {
        store.set("answer", answer);
        return "$done"; // special key to stop the loop
    },
});

const main = async () => {
    for await (const taskState of flow([mainTask, webSearchTask, answerTask], "main", kv)) {
        const {key, status, ...rest} = taskState;
        console.log(`\x1b[33m[${status}] ${key}\x1b[0m`, rest);
    }
    console.log(kv.get("answer"));
};

main();
