import {tool} from "./llm";
import {type} from "arktype";

// TODO: vitest
console.log(
    tool(
        "get_weather",
        "Get current eather for a given location",
        type({location: type("string").describe("City and country e.g. Bogotá, Colombia")}),
        async ({location}) => ""
    )
);

console.log(
    tool(
        "get_files_in_folder",
        "Get all files within the current folder recursively",
        type({
            pwd: type("string").describe("The path of the root folder containing all the files."),
        }),
        async ({pwd}) => {
            return pwd;
        }
    )
);
