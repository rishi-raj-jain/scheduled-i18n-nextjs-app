import { serve } from "@upstash/qstash/nextjs"

export const POST = serve(async (context) => {
    const result = await context.run("fetch-git-files", async () => {
        let newLang = 'fr';
        let folder = 'app/blogs/en';
        let repo = 'rishi-raj-jain/scheduled-i18n-nextjs-app';
        if (context.requestPayload) {
            const { repo: repoParam, folder: folderParam, newLang: newLangParam } = context.requestPayload as { repo?: string, folder?: string, newLang?: string }
            if (repoParam) repo = repoParam
            if (folderParam) folder = folderParam
            if (newLangParam) newLang = newLangParam
        }
        const response = await fetch(`https://api.github.com/repos/${repo}/contents/${folder}`)
        if (!response.ok) return { status: response.status }
        const files = await response.json()
        return { files, newLang, repo, folder }
    })
    for (const file of result.files) {
        if (!result.repo || !result.folder || !result.newLang) return
        await context.run(`translate-${file.name}`, async () => {
            const fileResponse = await fetch(file.download_url);
            if (!fileResponse.ok) return { status: fileResponse.status };
            const fileContent = await fileResponse.text();
            const translationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `Only respond with the translation of the markdown. No other or unrelated text or characters. Make sure to avoid translating links, HTML tags, code blocks, image links.`,
                        },
                        {
                            role: 'user',
                            content: `Translate the following text to ${result.newLang} locale:\n\n${fileContent}`,
                        },
                    ],
                    max_tokens: 4000,
                })
            });
            if (!translationResponse.ok) return { status: translationResponse.status };
            const translationResult = await translationResponse.json();
            const translatedContent = translationResult.choices[0].message.content.trim();
            await context.run(`commit-${file.name.replace('en', result.newLang)}`, async () => {
                const commitResponse = await fetch(`https://api.github.com/repos/${result.repo}/contents/${result.folder.replace('en', result.newLang)}/${file.name}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
                    },
                    body: JSON.stringify({
                        message: `Add translated file ${file.name} to ${result.newLang} locale`,
                        content: Buffer.from(translatedContent).toString('base64')
                    })
                });
                if (!commitResponse.ok) return { note: 'failed to commit file ' + file.name.replace('en', result.newLang) };
                return { note: 'committed file ' + file.name.replace('en', result.newLang) };
            });
            return translatedContent;
        })
    }
})
