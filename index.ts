import * as readline from 'readline';
import cliMarkdown from 'cli-markdown';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

// Naming Conventions: Use descriptive and consistent naming for environment variables
const geminiApiKey = Bun.env.GEMINI_API_KEY;
const googleCustomSearchApiKey = Bun.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
const googleCseId = Bun.env.GOOGLE_CSE_ID;

// Guard Clauses: Early exit if environment variables are not set, improving readability and reducing nesting
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

/**
 * Analyzes search results using Google Gemini API and provides a summary.
 *
 * @param {string} query - The original search query.
 * @param {any} searchResults - The search results from Google Custom Search API.
 * @returns {Promise<string>} - A promise that resolves to a summary and analysis of the search results, or an error message.
 */
const analyzeSearchResults = async (query: string, searchResults: any): Promise<string> => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Guard Clause: Handle cases with no search results early, simplifying logic
    if (!searchResults?.items?.length) { // Optional chaining and nullish coalescing for conciseness and safety
        return "No relevant search results found.";
    }

    const prompt = `Analyze the following search results for the query: "${query}". \n\nSearch Results:\n${searchResults.items.map((item: any, index: number) => `- [${index + 1}] Title: ${item.title}\n  Link: ${item.link}\n  Snippet: ${item.snippet}`).join('\n')}\n\nProvide a concise summary and analysis of these results, highlighting the main themes and insights. Put links at the end of the summary.`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        return responseText;
    } catch (error: any) {
        console.error("Error during Gemini analysis:", error); // More specific error logging
        return "Error analyzing search results with Gemini."; // Return user-friendly error message
    }
};

/**
 * Processes the search query, performs a Google Custom Search, and optionally analyzes results with Gemini.
 *
 * @param {string} query - The search query entered by the user.
 * @returns {Promise<void>} - A promise that resolves after processing the search (or immediately if query is empty).
 */
const processSearchQuery = async (query: string): Promise<void> => {
    // Guard Clause: Handle empty query immediately
    if (!query) {
        console.log('No search query provided.');
        return; // Early return for empty query
    }

    if (query.toLowerCase() === 'exit') { // Consistent toLowerCase for comparison
        rl.close();
        return; // Early return for exit command
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
                console.log(cliMarkdown(analysis));
            } else {
                console.log("\nSearch Results (Analysis Skipped):\n");
                if (searchResponse.data.items && searchResponse.data.items.length > 0) {
                    searchResponse.data.items.forEach((item: any, index: number) => {
                        console.log(`[${index + 1}] Title: ${item.title}`);
                        console.log(`  Link: ${item.link}`);
                        console.log(`  Snippet: ${item.snippet}`);
                        console.log('\n');
                    });
                } else {
                    console.log("No search results found.");
                }
            }

        } catch (error: any) {
            console.error("Error during search or analysis:", error); // More general error logging
        } finally {
            // Single Responsibility Principle: Keep the loop and next question prompt outside of the search logic
            askForSearchQuery(); // Call the function to ask for the next query
        }
    });
};


/**
 * Initiates the recursive query prompt to keep the application running.
 * This function is now responsible for the loop and user interaction, adhering to SRP.
 */
const askForSearchQuery = (): void => {
    rl.question('\nEnter your search query (or type "exit"): ', processSearchQuery); // processSearchQuery now handles the search logic
};


// Start the application by asking for the first query
askForSearchQuery();