import { getDictionary } from './blogs'

export async function generateStaticParams() {
  return ['en', 'fr'].map((lang) => ({
    lang,
  }))
}

export default async function Page({ params: { lang } }) {
  const dict = await getDictionary(lang)
  return <div className='prose flex flex-col gap-4'>
    {dict.map((item, ind) => <div key={ind} dangerouslySetInnerHTML={{ __html: item }} />)}
  </div>
}
