const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

app.http('getThoughts', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Processing getThoughts request.');

        try {
            const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
            if (!connectionString) {
                 return { status: 500, body: "Database connection not configured." };
            }

            const cosmosClient = new CosmosClient(connectionString);
            const { database } = await cosmosClient.databases.createIfNotExists({ id: process.env.COSMOS_DB_DATABASE_NAME });
            const { container } = await database.containers.createIfNotExists({ 
                id: process.env.COSMOS_DB_CONTAINER_NAME,
                partitionKey: { paths: ["/id"] }
            });

            // Fetch all thoughts (in production, you would filter by UserId)
            const querySpec = {
                query: "SELECT * from c ORDER BY c.createdAt DESC"
            };

            const { resources: thoughts } = await container.items.query(querySpec).fetchAll();

            return {
                status: 200,
                jsonBody: thoughts
            };

        } catch (error) {
            context.log.error('Error retrieving thoughts:', error);
            return { status: 500, body: "An error occurred while retrieving thoughts." };
        }
    }
});
