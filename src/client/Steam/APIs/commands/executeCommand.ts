/**
 * @file src/client/Steam/APIs/commands/executeCommand.ts
 * @description 发送底层 ASF IPC 命令并校验返回信封。
 */
import { ASFContext } from '../../ASFContext';
import { ASFError } from '../../ASFError';
import type { ASFCommandResponse } from '../../types';

/**
 * 执行命令。
 * @param context - 发起远程请求及保存会话状态所需的客户端上下文，类型为 `ASFContext`。
 * @param command - 需要发送给远程服务或命令解释器的命令文本，类型为 `string`。
 * @returns `Promise<string>`，executeCommand 获取或生成的文本内容。
 */
export const executeCommand = async (context: ASFContext, command: string): Promise<string> => {
  const options: myAxiosConfig = {
    url: context.commandURL,
    method: 'POST',
    headers: context.headers,
    data: JSON.stringify({
      Command: command
    })
  };
  if (context.httpsAgent) {
    options.httpsAgent = context.httpsAgent;
  }
  try {
    const response = await context.request<ASFCommandResponse>(options);
    const envelope = response.data as ASFCommandResponse;
    if (response.status !== 200 || !envelope.Success || envelope.Message !== 'OK') {
      throw new ASFError('executeCommand', envelope.Message || `ASF returned HTTP ${response.status}`, false, response.status);
    }
    return envelope.Result || '';
  } catch (error) {
    if (error instanceof ASFError) {
      throw error;
    }
    throw new ASFError('executeCommand', 'Unable to execute ASF command', true, undefined, {
      cause: error
    });
  }
};
