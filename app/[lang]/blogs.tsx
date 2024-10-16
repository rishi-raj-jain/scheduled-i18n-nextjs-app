import { globSync } from 'fast-glob'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import 'server-only'
import { unified } from 'unified'

const blogDir = join(process.cwd(), 'app', 'blogs')

export const getDictionary = async (locale: string) => {
  const langDir = join(blogDir, locale)
  if (!existsSync(langDir)) return []
  const files = globSync('**/*.md', { cwd: langDir })
  return await Promise.all(
    files.map(async (file) => {
      const content = readFileSync(join(langDir, file))
      const result = await unified().use(remarkParse).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify).process(content)
      return String(result)
    }),
  )
}
