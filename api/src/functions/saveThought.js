const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { TextAnalysisClient, AzureKeyCredential } = require('@azure/ai-language-text');

app.http('saveThought', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Processing saveThought request.');

        try {
            const body = await request.json();
            const { text, image, voiceNote, overrideCategory } = body;

            if (!text && !image && !voiceNote) {
                return { status: 400, body: "Please provide a thought to save." };
            }

            // 1. Initialize Azure Cosmos DB Client
            const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
            const cosmosClient = new CosmosClient(connectionString);
            const { database } = await cosmosClient.databases.createIfNotExists({ id: process.env.COSMOS_DB_DATABASE_NAME });
            const { container } = await database.containers.createIfNotExists({ 
                id: process.env.COSMOS_DB_CONTAINER_NAME,
                partitionKey: { paths: ["/id"] }
            });

            // 2. Initialize Azure AI Language Client for sentiment/category classification
            let autoCategory = "Positive";
            if (text && process.env.AZURE_AI_LANGUAGE_ENDPOINT && process.env.AZURE_AI_LANGUAGE_KEY) {
                const textClient = new TextAnalysisClient(
                    process.env.AZURE_AI_LANGUAGE_ENDPOINT, 
                    new AzureKeyCredential(process.env.AZURE_AI_LANGUAGE_KEY)
                );
                
                // Example: Use Sentiment Analysis to determine positive/negative automatically
                const sentimentResult = await textClient.analyzeSentiment([text]);
                if (sentimentResult.length > 0 && !sentimentResult[0].error) {
                    const sentiment = sentimentResult[0].sentiment; // 'positive', 'neutral', 'negative', 'mixed'
                    if (sentiment === 'negative') {
                        autoCategory = "Negative";
                    } else if (sentiment === 'mixed') {
                        autoCategory = "Unnecessary";
                    }
                }
            }

            // 3. Prepare item to save
            const thoughtItem = {
                id: crypto.randomUUID(),
                text: text || "[Image/Voice Note]",
                image: image || "",
                voiceNote: voiceNote || "",
                category: overrideCategory || autoCategory,
                autoCategory: autoCategory,
                repeated: false, // You could add logic here to query previous items and check repetition
                createdAt: new Date().toISOString()
            };

            // 4. Save to Azure Cosmos DB
            const { resource: createdItem } = await container.items.create(thoughtItem);

            return {
                status: 201,
                jsonBody: createdItem
            };

        } catch (error) {
            context.log.error('Error saving thought:', error);
            return { status: 500, body: "An error occurred while saving the thought." };
        }
    }
});
