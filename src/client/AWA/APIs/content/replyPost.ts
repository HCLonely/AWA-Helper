/**
 * @file src/client/AWA/APIs/content/replyPost.ts
 * @description 查找合适的每日任务主题并安全发布论坛回复。
 */
import FormData from 'form-data';
import { load } from 'cheerio';
import { AWAContext } from '../../AWAContext';

/**
 * 处理 reply Post 相关逻辑。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `AWAContext`。
 * @param requestedPostId - 目标资源的唯一标识，类型为 `string | undefined`。
 * @returns `Promise<boolean>`，表示 replyPost 检查是否通过。
 */
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
