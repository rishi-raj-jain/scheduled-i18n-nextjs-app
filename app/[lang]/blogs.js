import { globSync } from 'fast-glob'
import { readFileSync } from 'fs'
import { join } from 'path'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import 'server-only'
import { unified } from 'unified'

const blogDir = join(process.cwd(), 'app', 'blogs')

export const getDictionary = async (locale) => {
    const files = globSync('**/*.md', {
        cwd: join(blogDir, locale),
    })
    return await Promise.all(files.map(async (file) => {
        const content = readFileSync(join(blogDir, locale, file))
        const result = await unified().use(remarkParse).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify).process(content)
        return String(result)
    }))
}
