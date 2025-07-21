import dotenv from "dotenv";
import {type} from "arktype";
import {task} from "../src/task";
import {llm, responseSchema} from "../src/llm";
import {flow} from "../src/flow";
import {pdfToMarkdown} from "../src/tools/pdfToMarkdown";

dotenv.config({quiet: true});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    throw new Error("env OPENAI_API_KEY is missing");
}

const mainTask = task({
    key: "main",
    inputsSchema: type({invoicePath: "string"}),
    outputsSchema: type({
        emissionDate: "string",
        dueDate: "string",
        totalInEuros: "number",
        title: "string",
        number: "number",
        clientName: "string",
        companyName: "string",
        companyEmail: "string",
    }),
    beforeRun: async (store) => {
        return {
            invoicePath: store.get("invoicePath") as string,
        };
    },
    run: async ({invoicePath}, {outputsSchema}) => {
        const response = await llm(`Extract relevant infos from the given invoice ${invoicePath}`, OPENAI_API_KEY, {
            schema: responseSchema(outputsSchema),
            tools: [pdfToMarkdown],
        });
        return response;
    },
    afterRun: async (store, result) => {
        store.set("result", result);
        return "$done";
    },
});

const listInvoicesTask = task({
    key: "list_invoices",
    inputsSchema: type({rootDir: "string"}),
    outputsSchema: type({
        invoiceFiles: "string[]",
    }),
    beforeRun: async (store) => {
        return {
            rootDir: store.get("current_pdf_content"),
        };
    },
    run: async ({rootDir}, {outputsSchema}) => {
        // readdir(rootDir);
        // return response;
    },
    afterRun: async (store) => {
        return "$done";
    },
});

const readInvoiceTask = task({
    key: "read_invoice",
    inputsSchema: type({pdfTextContent: "string"}),
    outputsSchema: type({
        emissionDate: "string.date",
        dueDate: "string.date",
        totalInEuros: "number",
        title: "string",
        number: "number",
        clientName: "string",
        companyName: "string",
        companyEmail: "string",
    }),
    beforeRun: async (store) => {
        return {
            pdfTextContent: store.get("current_pdf_content"),
        };
    },
    run: async ({pdfTextContent}, {outputsSchema}) => {
        const response = await llm(
            `Extract infos from this text extracted from an invoice pdf: ${pdfTextContent}`,
            OPENAI_API_KEY,
            {schema: responseSchema(outputsSchema)}
        );
        return response;
    },
    afterRun: async (store) => {
        return "$done";
    },
});

const reportTask = task({
    key: "report",
    inputsSchema: type({}),
    outputsSchema: type({message: "string"}),
    beforeRun: async (store) => {
        return {};
    },
    run: async (inputs) => {},
    afterRun: async (store, {message}) => {
        return "$done";
    },
});

const main = async () => {
    const kv = new Map<string, unknown>();
    kv.set("invoicePath", __dirname + "/assets/invoice (1).pdf");
    for await (const taskState of flow([mainTask], "main", kv)) {
        console.log(taskState);
    }
    console.log(kv.get("result"));
};

main();
