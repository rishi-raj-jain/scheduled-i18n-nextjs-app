export interface RequestPayload {
  repo?: string
  folder?: string
  newLang?: string
}

export interface FolderContents {
  name: string
  download_url: string
}

export interface OpenAiResponse {
  choices: {
    message: {
      role: string
      content: string
    }
  }[]
}

export interface TranslationRequest {
  model: string
  messages: {
    role: string
    content: string
  }[]
  max_tokens: number
}

export interface CommitRequest {
  sha?: string
  message: string
  content: string
}
