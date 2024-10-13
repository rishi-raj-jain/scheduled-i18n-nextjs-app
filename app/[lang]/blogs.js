import { globSync } from 'fast-glob'
import { readFileSync } from 'fs'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import 'server-only'
import { unified } from 'unified'

export const getDictionary = async (locale) => {
    const files = globSync('**/*.md', {
        cwd: `./app/blogs/${locale}`,
    })
    const htmlFiles = await Promise.all(files.map(async (file) => {
        const content = readFileSync(`./app/blogs/${locale}/${file}`)
        const result = await unified()
            .use(remarkParse)
            .use(remarkRehype)
            .use(rehypeSanitize)
            .use(rehypeStringify)
            .process(content)
        return String(result)
    }))
    return htmlFiles
}