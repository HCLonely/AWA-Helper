/** Finds a suitable Daily Quest topic and posts one safe acknowledgement. */
import FormData from 'form-data';
import { load } from 'cheerio';
import { AWAContext } from '../../AWAContext';

export const replyPost = async (context: AWAContext, requestedPostId?: string): Promise<boolean> => {
  let postId = requestedPostId;
  if (!postId) {
    const listOptions: myAxiosConfig = {
      url: `${context.baseURL}/forums/board/113/awa-on-topic`, method: 'GET',
      headers: { ...context.headers, referer: `${context.baseURL}/` }
    };
    if (context.httpsAgent) listOptions.httpsAgent = context.httpsAgent;
    const page = await context.request<string>(listOptions);
    const $ = load(page.data);
    [postId] = $('.card-title a.forums__topic-link').toArray()
      .filter((link) => /Daily\s*Quest/i.test($(link).text()) && $(link).prev().attr('title') !== 'Locked')
      .flatMap((link) => $(link).attr('href')?.match(/ucf\/show\/([\d]+)/)?.[1] || []);
  }
  if (!postId) return false;
  const form = new FormData();
  form.append('topic_post[content]', '<p>Thanks!</p>');
  form.append('topic_post[quotedPostIds]', '');
  form.append('topic_post[parentPost]', '');
  const options: myAxiosConfig = {
    url: `${context.baseURL}/comments/${postId}/new/ucf`, method: 'POST', data: form,
    headers: { ...context.headers, origin: context.baseURL, referer: `${context.baseURL}/ucf/show/${postId}`, ...form.getHeaders() }
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  return (await context.request<{ success?: boolean }>(options)).data.success === true;
};
