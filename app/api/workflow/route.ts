import { serve } from '@upstash/workflow/nextjs'
import { CommitRequest, FolderContents, OpenAiResponse, RequestPayload, TranslationRequest } from './types'

const defaultRequestPayload: RequestPayload = {
  newLang: 'fr',
  folder: 'app/blogs/en',
  repo: 'rishi-raj-jain/scheduled-i18n-nextjs-app',
}

const githubHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
}

const openaiHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
}

export const POST = serve(
  async (context) => {
    // Destructure the request payload or use default values
    const {
      repo = defaultRequestPayload.repo,
      folder = defaultRequestPayload.folder,
      newLang = defaultRequestPayload.newLang,
    } = (context.requestPayload as RequestPayload) || defaultRequestPayload

    // If any of the required fields are missing, exit early
    if (!folder || !repo || !newLang) return

    // Construct the URL to fetch the folder contents from GitHub
    const fetchUrl = `https://api.github.com/repos/${repo}/contents/${folder}`
    // Fetch the folder contents
    const { body: fetchResult } = await context.call<FolderContents[]>(`fetch-${repo}-${folder}`, { url: fetchUrl, method: 'GET' })

    // Iterate over each file in the folder
    for (const file of fetchResult) {
      // Fetch the content of the file
      const { body: fileContent } = await context.call<string>(`fetch-${folder}/${file.name}`, { url: file.download_url, method: 'GET', headers: githubHeaders })

      // Prepare the translation request payload
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
      }

      // Call the OpenAI API to get the translation
      const { body: translationResult } = await context.call<OpenAiResponse>(`translate-${folder}/${file.name}`, {
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        body: JSON.stringify(translationRequest),
        headers: openaiHeaders,
      })

      // Determine the new folder path for the translated file
      const newFolder = folder.replace('en', newLang)

      // Commit the translated file to the new folder
      await context.run(`commit-${newFolder}/${file.name}`, async () => {
        const existingFileUrl = `https://api.github.com/repos/${repo}/contents/${newFolder}/${file.name}`
        const existingFileResponse = await fetch(existingFileUrl, {
          headers: githubHeaders,
        })

        // Check if the file already exists and get its SHA if it does
        let sha = null
        if (existingFileResponse.ok) {
          const existingFileResponseJson = await existingFileResponse.json()
          sha = existingFileResponseJson?.['sha']
        }

        // Prepare the commit request payload
        const commitRequest: CommitRequest = {
          message: `Add translated file ${file.name} to ${newLang} locale`,
          content: Buffer.from(translationResult.choices[0].message.content.trim()).toString('base64'),
        }
        if (sha) commitRequest['sha'] = sha

        // Commit the translated file to GitHub
        await fetch(existingFileUrl, {
          method: 'PUT',
          headers: githubHeaders,
          body: JSON.stringify(commitRequest),
        })
      })
    }

    // Trigger a deployment to Vercel if the deploy hook URL is set
    if (process.env.VERCEL_DEPLOY_HOOK_URL) await context.call('deploy-to-vercel', { url: process.env.VERCEL_DEPLOY_HOOK_URL, method: 'POST' })
  },
  {
    verbose: true,
  },
)
