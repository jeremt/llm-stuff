import {type} from "arktype";
import {tool} from "../llm";
import {readFile} from "fs/promises";
import {getDocumentProxy, getResolvedPDFJS} from "unpdf";

interface Item {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    font: string;
}

const nearlyEqual = (a: number, b: number, epsilon: number = 0.0001): boolean => {
    return Math.abs(a - b) < epsilon;
};

export const pdfToMarkdown = tool("pdf_to_markdown", "", type({filePath: "string"}), async ({filePath}) => {
    const buffer = await readFile(filePath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    let markdown = "";

    let lastTextItem: Item | undefined;
    const fonts = {
        ids: new Set<string>(),
        map: new Map<string, any>(),
    };

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        await page.getOperatorList();
        const content = await page.getTextContent();
        let isBold = false;
        const pdfjs = await getResolvedPDFJS();

        for (let i = 0; i < content.items.length; ++i) {
            const item = content.items[i] as {
                str: string;
                dir: string;
                transform: Array<any>;
                width: number;
                height: number;
                fontName: string;
                hasEOL: boolean;
            };
            const tx = pdfjs.Util.transform(page.getViewport({scale: 1}).transform, item.transform);

            const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
            const dividedHeight = item.height / fontHeight;
            const textItem = {
                x: Math.round(item.transform[4]),
                y: Math.round(item.transform[5]),
                width: Math.round(item.width),
                height: Math.round(dividedHeight <= 1 ? item.height : dividedHeight),
                text: item.str,
                font: item.fontName,
            };

            const text = textItem.text;
            const fontName = textItem.font || "";
            const transport = pdf._transport;

            if (text === "") {
                continue;
            }

            let font: any;
            if (fonts.ids.has(fontName)) {
                font = fonts.map.get(fontName);
            } else {
                font = await new Promise((resolve) => transport.commonObjs.get(fontName, resolve));
                fonts.ids.add(fontName);
                fonts.map.set(fontName, font);
            }

            // Check if a newline or space is needed
            if (lastTextItem) {
                const isSameLine = nearlyEqual(lastTextItem.y, textItem.y, 5);
                const isAdjacent = nearlyEqual(lastTextItem.x + lastTextItem.width, textItem.x, 3);
                if (!isSameLine) {
                    markdown += "\n";
                } else if (!isAdjacent) {
                    // Add a space only if the current text does not already end with one
                    if (!markdown.endsWith(" ")) {
                        markdown += " ";
                    }
                }
            }

            if (font.name.toLowerCase().includes("bold") && !isBold) {
                isBold = true;
                markdown += `<b>`;
            } else if (!font.name.toLowerCase().includes("bold") && isBold) {
                isBold = false;
                markdown += `</b>`;
            }

            markdown += `${text}`;
            lastTextItem = textItem;
        }
        if (isBold) {
            markdown += `</b>`;
        }
        markdown += "\n\n";
    }
    return markdown;
});
