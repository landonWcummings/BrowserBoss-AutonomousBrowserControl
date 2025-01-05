import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

export async function queryNova(input) {
    try {
        // Initialize the Bedrock Runtime client
        const client = new BedrockRuntimeClient({
            region: "us-east-1",
            credentials: {
                accessKeyId: "input access here",
                secretAccessKey: "input secret here",
            },
        });

        // Construct the messages payload for the Nova API
        const messages = [
            {
                role: 'user',
                content: [{ text: input }],
            },
        ];


        // Create the ConverseCommand for the Nova API
        const command = new ConverseCommand({
            modelId: 'amazon.nova-lite-v1:0',
            messages,
        });

        const response = await client.send(command);

        // Extract the relevant content from the response
        let final = JSON.stringify(response?.output?.message?.content?.[0]?.text);

        console.log("Nova: ", final)

        if (final.startsWith('"') && final.endsWith('"')) {
            final = final.slice(1, -1);
        }
        
        return final;

    } catch (error) {
        console.error("Error invoking Bedrock:", error);
        throw new Error(`Error querying Nova API: ${error.message}`);
    }
}
