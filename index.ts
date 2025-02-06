import * as readline from 'readline';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
const cliMarkdown = require('cli-markdown');

dotenv.config();

const geminiApiKey = Bun.env.GEMINI_API_KEY;
const googleCustomSearchApiKey = Bun.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
const googleCseId = Bun.env.GOOGLE_CSE_ID;

if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set. Please set it before running this application.");
}

if (!googleCustomSearchApiKey) {
    throw new Error("GOOGLE_CUSTOM_SEARCH_API_KEY environment variable is not set. Please set it before running this application.");
}

if (!googleCseId) {
    throw new Error("GOOGLE_CSE_ID environment variable is not set. Please set it before running this application.");
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const customsearch = google.customsearch('v1');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const analyzeSearchResults = async (query: string, searchResults: any): Promise<string> => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    if (!searchResults?.items?.length) {
        return "No relevant search results found.";
    }

    const prompt = `Analyze the following search results for the query: "${query}". \n\nSearch Results:\n${searchResults.items.map((item: any, index: number) => `- [${index + 1}] Title: ${item.title}\n  Link: ${item.link}\n  Snippet: ${item.snippet}`).join('\n')}\n\nProvide a concise summary and analysis of these results, highlighting the main themes and insights. Put links at the end of the summary. Use markdown elements for better readability.`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        return responseText;
    } catch (error: any) {
        console.error("Error during Gemini analysis:", error);
        return "Error analyzing search results with Gemini.";
    }
};

const processSearchQuery = async (query: string): Promise<void> => {
    if (!query) {
        console.log('No search query provided.');
        return;
    }

    if (query.toLowerCase() === 'exit') {
        rl.close();
        return;
    }

    rl.question('\nDo you want to analyze the search results with Gemini? (yes/no): ', async (analyzeChoice) => {
        const shouldAnalyze = analyzeChoice.toLowerCase() === 'yes' || analyzeChoice.toLowerCase() === 'y';

        try {
            const searchResponse = await customsearch.cse.list({
                auth: googleCustomSearchApiKey,
                cx: googleCseId,
                q: query,
            });

            if (shouldAnalyze) {
                const analysis = await analyzeSearchResults(query, searchResponse.data);
                console.log("\nSearch Results Analysis by Gemini:\n");
                console.log(await applyMarkdown(analysis));
            } else {
                console.log("\nSearch Results (Analysis Skipped):\n");
                if (searchResponse.data.items && searchResponse.data.items.length > 0) {
                    for (const index in searchResponse.data.items) {
                        const item = searchResponse.data.items[index];
                        console.log(await applyMarkdown(`# [${Number(index) + 1} ${item.title}\n> ${item.snippet}\n[${item.displayLink}](${item.link})\n`));
                    };
                } else {
                    console.log("No search results found.");
                }
            }

        } catch (error: any) {
            console.error("Error during search or analysis:", error);
        } finally {
            askForSearchQuery();
        }
    });
};

const askForSearchQuery = (): void => {
    rl.question('Enter your search query (or type "exit"): ', processSearchQuery);
};

const applyMarkdown = async (content: string): Promise<string> => {
    const convert = cliMarkdown.default;
    return await convert(content);
}

const showCommands = async () => {
    const helpText = `# Available commands:\n\n${commands.map(command => `## ${command.name}\n- **Description**: ${command.description}\n- **Usage**: \`${command.usage}\`\n`).join('\n')}`;
    const formattedHelpText = await applyMarkdown(helpText);
    console.log(formattedHelpText);
    process.exit();
}

const commands = [
    {
        name: "search",
        description: "Browse for information using Google",
        usage: "Bun . search",
        execute: askForSearchQuery
    },
    {
        name: "help",
        description: "Show available commands",
        usage: "Bun . help",
        execute: showCommands
    }
]

const argument = Bun.argv[2]

const command = commands.find(({ name }) => name === argument);

if (!command)
    throw Error(`Command doesn't exist; please run "Bun . help" for more information.`);

if (argument === 'help') {
    command.execute();
} else if (argument === 'search') {
    command.execute();
}