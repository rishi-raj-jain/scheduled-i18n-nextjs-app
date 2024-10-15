import { serve } from "@upstash/qstash/nextjs"

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

const defaultRequestPayload: RequestPayload = {
    repo: 'rishi-raj-jain/scheduled-i18n-nextjs-app',
    folder: 'app/blogs/en',
    newLang: 'fr'
};

export const POST = serve(async (context) => {
    const { repo = defaultRequestPayload.repo, folder = defaultRequestPayload.folder, newLang = defaultRequestPayload.newLang } = context.requestPayload as RequestPayload || defaultRequestPayload;
    if (!folder || !repo || !newLang) return
    const fetchResult = await context.call<FolderContents[]>("fetch-" + repo + folder, `https://api.github.com/repos/${repo}/contents/${folder}`, 'GET');
    for (const file of fetchResult) {
        const fileContent = await context.call<string>(`fetch-${file.name}`, file.download_url, 'GET');
        const translationResult = await context.call<OpenAiResponse>(`translate-${file.name}`, "https://api.openai.com/v1/chat/completions", 'POST', {
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
        },
            { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` });
        await context.call(`commit-${file.name.replace('en', newLang)}`, `https://api.github.com/repos/${repo}/contents/${folder.replace('en', newLang)}/${file.name}`, 'PUT', {
            message: `Add translated file ${file.name} to ${newLang} locale`,
            content: Buffer.from(translationResult.choices[0].message.content.trim()).toString('base64')
        },
            {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
            })
    }
}, {
    verbose: true
});
