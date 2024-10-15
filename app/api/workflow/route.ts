import { serve } from "@upstash/qstash/nextjs";

interface RequestPayload {
    repo?: string;
    folder?: string;
    newLang?: string;
}

interface FolderContents {
    name: string;
    download_url: string;
}

interface OpenAiResponse {
    choices: {
        message: {
            role: string,
            content: string
        }
    }[]
}

interface TranslationRequest {
    model: string;
    messages: {
        role: string;
        content: string;
    }[];
    max_tokens: number;
}

interface CommitRequest {
    sha?: string;
    message: string;
    content: string;
}

const defaultRequestPayload: RequestPayload = {
    repo: 'rishi-raj-jain/scheduled-i18n-nextjs-app',
    folder: 'app/blogs/en',
    newLang: 'fr'
};

export const POST = serve(async (context) => {
    const { repo = defaultRequestPayload.repo, folder = defaultRequestPayload.folder, newLang = defaultRequestPayload.newLang } = context.requestPayload as RequestPayload || defaultRequestPayload;
    if (!folder || !repo || !newLang) return;
    const fetchUrl = `https://api.github.com/repos/${repo}/contents/${folder}`;
    const fetchResult = await context.call<FolderContents[]>(`fetch-${repo}-${folder}`, fetchUrl, 'GET');
    for (const file of fetchResult) {
        const fileContentUrl = file.download_url;
        const fileContent = await context.call<string>(`fetch-${folder}/${file.name}`, fileContentUrl, 'GET');
        const translationRequest: TranslationRequest = {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Only respond with the translation of the markdown. No other or unrelated text or characters. Make sure to avoid translating links, HTML tags, code blocks, image links.`,
                },
                {
                    role: 'user',
                    content: `Translate the following text to ${newLang} locale:\n\n${fileContent}`,
                },
            ],
            max_tokens: 4000,
        };
        const translationResult = await context.call<OpenAiResponse>(`translate-${folder}/${file.name}`, "https://api.openai.com/v1/chat/completions", 'POST', translationRequest, {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        });
        const newFolder = folder.replace('en', newLang);
        await context.run(`commit-${newFolder}/${file.name}`, async () => {
            const existingFileUrl = `https://api.github.com/repos/${repo}/contents/${newFolder}/${file.name}`;
            const existingFileResponse = await fetch(existingFileUrl, {
                headers: {
                    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
                }
            });
            let sha = null;
            if (existingFileResponse.ok) {
                const existingFileResponseJson = await existingFileResponse.json();
                sha = existingFileResponseJson?.['sha'];
            } 
            const commitRequest: CommitRequest = {
                ...(sha && { sha }),
                message: `Add translated file ${file.name} to ${newLang} locale`,
                content: Buffer.from(translationResult.choices[0].message.content.trim()).toString('base64'),
            };
            await fetch(existingFileUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
                },
                body: JSON.stringify(commitRequest)
            });
        });
    }
}, {
    verbose: true
});